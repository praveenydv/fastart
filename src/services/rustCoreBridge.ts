// FastArt High-Performance Rust Core Engine Bridge
// Seamlessly routes computation to:
// 1. Android Native JNI (libfastart_jni.so) on mobile
// 2. WebAssembly (fastart_wasm.wasm) on web
// Keeps Expo UI at 60fps with zero UI-thread stalls

import { NativeModules, Platform } from "react-native";
import { Buffer } from "buffer";
import { FastArtProject, TrajectoryPoint, CutoutConfig, HSLAdjustments } from "../types/project";
import { resolveAssetUrl } from "../utils/router";

export interface MaskProvider {
  getFrameMask: (
    clipId: string,
    clipTime: number,
    fps?: number,
    fallbackClipId?: string,
    sourceTime?: number,
    isImage?: boolean,
  ) => HTMLCanvasElement | null;
  getHumanSegmentationMask: (
    clipId?: string,
    clipTime?: number,
    fallbackClipId?: string,
    sourceTime?: number,
    isImage?: boolean,
  ) => HTMLCanvasElement | null;
  requestHumanSegmentation: (mediaElement: any, clipId?: string, clipTime?: number) => void;
  hasClipMasks?: (clipId: string) => boolean;
  hasFrameMask?: (clipId: string, frameIdx: number, isSource?: boolean) => boolean;
  getClipProcessedCount?: (clipId: string) => number;
}

let activeMaskProvider: MaskProvider | null = null;
const clipLastKnownMaskMap = new Map<string, HTMLCanvasElement>();
const clipLastKnownMaskTimeMap = new Map<string, number>();
const lastDecodedVideoTimeMap = typeof WeakMap !== "undefined" ? new WeakMap<HTMLVideoElement, number>() : null;
let guidedMaskScratchCanvas: HTMLCanvasElement | null = null;
let guidedMaskScratchCtx: CanvasRenderingContext2D | null = null;
let guidedInputMaskBuffer: Uint8Array | null = null;
let guidedOutputMaskBuffer: Uint8Array | null = null;

export function clearCutoutLastKnownMask(clipId?: string): void {
  if (clipId) {
    clipLastKnownMaskMap.delete(clipId);
    clipLastKnownMaskTimeMap.delete(clipId);
  } else {
    clipLastKnownMaskMap.clear();
    clipLastKnownMaskTimeMap.clear();
  }
}

export function registerMaskProvider(provider: MaskProvider): void {
  activeMaskProvider = provider;
}

let FastArtRust: any = NativeModules.FastArtRust;
try {
  const { requireNativeModule } = require("expo-modules-core");
  FastArtRust = requireNativeModule("FastArtRust") || FastArtRust;
} catch (_) {}

function encodeNativeBytes(bytes: Uint8Array | Uint8ClampedArray): string {
  return Buffer.from(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

function decodeBase64ToUint8(b64: string): Uint8Array {
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export interface RustBeatResult {
  bpm: number;
  beats: number[];
}

export type RustBackendType = "android_native" | "ios_native" | "web_wasm" | "fallback";
export type AnimationKeyframe = readonly [number, number, number, number, number, number];

export interface NativeVideoFrameInfo {
  frameRate: number;
  frameCount: number;
  duration: number;
}

/**
 * The Rust project renderer currently accepts no decoded media buffers from the
 * JS/native bridge. Only route projects with no raster media through its
 * project-level exporters; otherwise those exporters render placeholders or
 * silence instead of the user's source assets.
 */
function rustProjectHasVisualMedia(project: FastArtProject): boolean {
  const tracks = project?.tracks;
  return !!(
    tracks?.video?.length ||
    tracks?.text?.length ||
    tracks?.captions?.length ||
    tracks?.stickers?.length ||
    tracks?.filters?.length
  );
}

function rustProjectHasAudioMedia(project: FastArtProject): boolean {
  return !!(project?.tracks?.audio?.length || project?.tracks?.video?.length);
}

let internalMaskCanvas: HTMLCanvasElement | null = null;
let internalMaskCtx: CanvasRenderingContext2D | null = null;
let internalStrokeCanvas: HTMLCanvasElement | null = null;
let internalStrokeCtx: CanvasRenderingContext2D | null = null;
let internalStrokeDilatedCanvas: HTMLCanvasElement | null = null;
let internalStrokeDilatedCtx: CanvasRenderingContext2D | null = null;
let internalContourScanCanvas: HTMLCanvasElement | null = null;
let internalContourScanCtx: CanvasRenderingContext2D | null = null;

interface FastContour {
  pts: { x: number; y: number }[];
  isClosed: boolean;
}

/**
 * Ultra-fast integer-keyed Marching Squares contour extraction (< 0.08ms)
 * Extracts ordered closed or boundary-anchored polygon chains along the subject perimeter.
 */
function extractContoursMarchingSquaresFast(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  threshold = 36
): FastContour[] {
  // Zero out the 1-pixel outer boundary of the scan buffer so any edge-touching
  // subject (e.g. walking legs at the bottom of the video frame) forms a complete
  // closed contour loop instead of dead-ending at one edge and discarding the other side.
  const rowLast = (H - 1) * W;
  for (let x = 0; x < W; x++) {
    data[x * 4 + 3] = 0;
    data[(rowLast + x) * 4 + 3] = 0;
  }
  for (let y = 0; y < H; y++) {
    data[(y * W) * 4 + 3] = 0;
    data[(y * W + (W - 1)) * 4 + 3] = 0;
  }

  const fromMap = new Map<number, number>();
  const starts: number[] = [];

  for (let y = 0; y < H - 1; y++) {
    const row0 = y * W;
    const row1 = (y + 1) * W;
    const y2 = y * 2;
    for (let x = 0; x < W - 1; x++) {
      const tl = data[(row0 + x) * 4 + 3] >= threshold ? 1 : 0;
      const tr = data[(row0 + x + 1) * 4 + 3] >= threshold ? 1 : 0;
      const br = data[(row1 + x + 1) * 4 + 3] >= threshold ? 1 : 0;
      const bl = data[(row1 + x) * 4 + 3] >= threshold ? 1 : 0;
      const idx = tl | (tr << 1) | (br << 2) | (bl << 3);
      if (idx === 0 || idx === 15) continue;

      const x2 = x * 2;
      // N: (x + 0.5, y) -> (2x + 1, 2y)
      const N = (y2 << 16) | (x2 + 1);
      // E: (x + 1, y + 0.5) -> (2x + 2, 2y + 1)
      const E = ((y2 + 1) << 16) | (x2 + 2);
      // S: (x + 0.5, y + 1) -> (2x + 1, 2y + 2)
      const S = ((y2 + 2) << 16) | (x2 + 1);
      // W: (x, y + 0.5) -> (2x, 2y + 1)
      const W_pt = ((y2 + 1) << 16) | x2;

      switch (idx) {
        case 1: fromMap.set(W_pt, N); starts.push(W_pt); break;
        case 2: fromMap.set(N, E); starts.push(N); break;
        case 3: fromMap.set(W_pt, E); starts.push(W_pt); break;
        case 4: fromMap.set(E, S); starts.push(E); break;
        case 5:
          fromMap.set(W_pt, N); starts.push(W_pt);
          fromMap.set(E, S); starts.push(E);
          break;
        case 6: fromMap.set(N, S); starts.push(N); break;
        case 7: fromMap.set(W_pt, S); starts.push(W_pt); break;
        case 8: fromMap.set(S, W_pt); starts.push(S); break;
        case 9: fromMap.set(S, N); starts.push(S); break;
        case 10:
          fromMap.set(N, W_pt); starts.push(N);
          fromMap.set(S, E); starts.push(S);
          break;
        case 11: fromMap.set(S, E); starts.push(S); break;
        case 12: fromMap.set(E, W_pt); starts.push(E); break;
        case 13: fromMap.set(E, N); starts.push(E); break;
        case 14: fromMap.set(N, W_pt); starts.push(N); break;
      }
    }
  }

  const contours: FastContour[] = [];
  const visited = new Set<number>();

  for (const start of starts) {
    if (visited.has(start)) continue;
    const chain: { x: number; y: number }[] = [];
    let curr: number | undefined = start;
    let loopSteps = 0;
    let isClosed = false;

    while (curr !== undefined && loopSteps < 8000) {
      if (visited.has(curr)) {
        if (curr === start) {
          isClosed = true;
          const kx = (start & 0xffff) / 2;
          const ky = (start >> 16) / 2;
          chain.push({ x: kx, y: ky });
        }
        break;
      }
      visited.add(curr);
      const kx = (curr & 0xffff) / 2;
      const ky = (curr >> 16) / 2;
      chain.push({ x: kx, y: ky });
      curr = fromMap.get(curr);
      loopSteps++;
    }

    if (chain.length > 15) {
      contours.push({ pts: chain, isClosed });
    }
  }

  return contours;
}

/**
 * 2-pass moving-average filter to eliminate pixel staircase noise & micro-jitter
 */
function smoothContourPoints(
  points: { x: number; y: number }[],
  isClosed: boolean,
  passes = 2
): { x: number; y: number }[] {
  const n = points.length;
  if (n < 5) return points;
  let curr = points.map(p => ({ x: p.x, y: p.y }));

  for (let pass = 0; pass < passes; pass++) {
    const next: { x: number; y: number }[] = new Array(n);
    if (isClosed) {
      for (let i = 0; i < n; i++) {
        const prev = curr[(i - 1 + n) % n];
        const p = curr[i];
        const nxt = curr[(i + 1) % n];
        next[i] = {
          x: (prev.x + p.x * 2 + nxt.x) * 0.25,
          y: (prev.y + p.y * 2 + nxt.y) * 0.25,
        };
      }
    } else {
      next[0] = { x: curr[0].x, y: curr[0].y };
      next[n - 1] = { x: curr[n - 1].x, y: curr[n - 1].y };
      for (let i = 1; i < n - 1; i++) {
        const prev = curr[i - 1];
        const p = curr[i];
        const nxt = curr[i + 1];
        next[i] = {
          x: (prev.x + p.x * 2 + nxt.x) * 0.25,
          y: (prev.y + p.y * 2 + nxt.y) * 0.25,
        };
      }
    }
    curr = next;
  }
  return curr;
}

interface WasmExports {
  memory: WebAssembly.Memory;
  fastart_motion_track_c?: (
    time: number,
    clipStart: number,
    clipDuration: number,
    modeIndex: number,
    intensity: number,
    outDx: number,
    outDy: number,
    outScale: number,
    outRotation: number,
  ) => void;
  fastart_get_scratchpad?: (size: number) => number;
  fastart_alloc: (size: number) => number;
  fastart_dealloc: (ptr: number, size: number) => void;
  fastart_detect_beats_c: (
    samplesPtr: number,
    count: number,
    sampleRate: number,
    outPtr: number,
    maxOutLen: number
  ) => number;
  fastart_generate_waveform_c: (
    samplesPtr: number,
    count: number,
    buckets: number,
    outPeaksPtr: number
  ) => number;
  fastart_decode_audio_peaks_c?: (
    dataPtr: number,
    dataLength: number,
    numPoints: number,
    outPeaksPtr: number,
    outCapacity: number,
    outDurationPtr: number,
  ) => number;
  fastart_render_snapshot_c: (
    projectJsonPtr: number,
    jsonLen: number,
    timeSec: number,
    width: number,
    height: number,
    outPtr: number,
    maxOutLen: number
  ) => number;
  fastart_process_chroma_c: (
    pixelsPtr: number,
    width: number,
    height: number,
    rKey: number,
    gKey: number,
    bKey: number,
    threshold: number,
    feather: number,
    despill: number
  ) => void;
  fastart_guided_filter_matting_c: (
    guidePtr: number,
    maskPtr: number,
    outPtr: number,
    width: number,
    height: number,
    radius: number,
    eps: number
  ) => void;
  fastart_apply_matte_c: (
    pixelsPtr: number,
    maskPtr: number,
    width: number,
    height: number,
    threshold: number,
    feather: number
  ) => void;
  fastart_defringe_rgba_c?: (
    pixelsPtr: number,
    width: number,
    height: number
  ) => void;
  fastart_guided_composite_defringe_c?: (
    rgbaPtr: number,
    maskRgbaPtr: number,
    width: number,
    height: number,
    radius: number,
    eps: number,
    subsample: number
  ) => void;
  fastart_detect_uniform_backdrop_c: (
    pixelsPtr: number,
    width: number,
    height: number,
    outRPtr: number,
    outGPtr: number,
    outBPtr: number
  ) => number;
  fastart_evaluate_speed_curve_c: (
    pointsTPtr: number,
    pointsSPtr: number,
    count: number,
    progress: number
  ) => number;
  fastart_evaluate_object_track_c?: (
    time: number,
    timesPtr: number,
    xPtr: number,
    yPtr: number,
    scalesPtr: number,
    rotationsPtr: number,
    count: number,
    anchorTime: number,
    trackScale: number,
    trackRotation: number,
    cameraCenter: number,
    cameraFitToScreen: number,
    cameraZoom: number,
    cameraLockCenter: number,
    outDx: number,
    outDy: number,
    outScale: number,
    outRotation: number,
  ) => number;
  fastart_apply_color_adjustments_c: (
    pixelsPtr: number,
    width: number,
    height: number,
    brightness: number,
    contrast: number,
    saturation: number
  ) => void;
  fastart_apply_vignette_c: (
    pixelsPtr: number,
    width: number,
    height: number,
    intensity: number,
    radius: number
  ) => void;
  fastart_apply_hsl_color_grading_c?: (
    pixelsPtr: number,
    width: number,
    height: number,
    settingsPtr: number,
    settingsLen: number,
  ) => number;
  fastart_process_segmentation_confidence_c: (
    pixelsPtr: number,
    width: number,
    height: number
  ) => number;
  fastart_refine_cutout_c: (
    rgbaPtr: number,
    maskPtr: number,
    width: number,
    height: number,
    threshold: number,
    feather: number,
    despill: number
  ) => void;
  fastart_prepare_modnet_input_c: (
    rgbaPtr: number,
    width: number,
    height: number,
    outTensorPtr: number
  ) => number;
  fastart_process_modnet_output_c: (
    rawAlphaPtr: number,
    outRgbaPtr: number,
    threshold: number,
    feather: number
  ) => number;
  fastart_process_modnet_output_cropped_c?: (
    rawAlphaPtr: number,
    outRgbaPtr: number,
    threshold: number,
    feather: number,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number
  ) => number;
  fastart_search_template_ncc_c: (
    framePtr: number,
    fw: number,
    fh: number,
    templatePtr: number,
    dim: number,
    tMean: number,
    tStd: number,
    tAngle: number,
    cx: number,
    cy: number,
    bw: number,
    bh: number,
    radius: number,
    scalesPtr: number,
    numScales: number,
    step: number,
    outBestX: number,
    outBestY: number,
    outBestScale: number,
    outBestAngle: number,
    outBestScore: number
  ) => void;
  fastart_denoise_waveform_peaks_c: (
    peaksPtr: number,
    count: number
  ) => void;
  fastart_evaluate_keyframes_c: (
    baseX: number,
    baseY: number,
    baseScale: number,
    baseRotation: number,
    baseOpacity: number,
    kfTimesPtr: number,
    kfXPtr: number,
    kfYPtr: number,
    kfScalePtr: number,
    kfRotPtr: number,
    kfOpacityPtr: number,
    kfCount: number,
    queryTime: number,
    outX: number,
    outY: number,
    outScale: number,
    outRot: number,
    outOpacity: number
  ) => void;
  fastart_render_frame_rgba_c: (
    projectJsonPtr: number,
    jsonLen: number,
    timeSec: number,
    width: number,
    height: number,
    outRgbaPtr: number,
    maxOutLen: number
  ) => number;
  fastart_export_gif_c: (
    projectJsonPtr: number,
    jsonLen: number,
    fps: number,
    width: number,
    height: number,
    duration: number,
    outPtr: number,
    maxOutLen: number
  ) => number;
  fastart_export_gif_to_heap?: (
    projectJsonPtr: number,
    jsonLen: number,
    fps: number,
    width: number,
    height: number,
    duration: number
  ) => number;
  fastart_export_wav_c: (
    projectJsonPtr: number,
    jsonLen: number,
    sampleRate: number,
    duration: number,
    outPtr: number,
    maxOutLen: number
  ) => number;
  fastart_export_wav_to_heap?: (
    projectJsonPtr: number,
    jsonLen: number,
    sampleRate: number,
    duration: number
  ) => number;
  fastart_export_mp4_c: (
    projectJsonPtr: number,
    jsonLen: number,
    fps: number,
    width: number,
    height: number,
    duration: number,
    outPtr: number,
    maxOutLen: number
  ) => number;
  fastart_export_mp4_to_heap?: (
    projectJsonPtr: number,
    jsonLen: number,
    fps: number,
    width: number,
    height: number,
    duration: number
  ) => number;
  fastart_get_export_buffer_ptr?: () => number;
  fastart_free_export_buffer?: () => void;
  fastart_pack_alpha_rle_c?: (
    alphaPtr: number,
    len: number,
    outRlePtr: number,
    maxOutLen: number
  ) => number;
  fastart_unpack_alpha_rle_c?: (
    rlePtr: number,
    rleLen: number,
    outAlphaPtr: number,
    maxOutLen: number
  ) => number;
  fastart_unpack_alpha_rle_rgba_c?: (
    rlePtr: number,
    rleLen: number,
    outRgbaPtr: number,
    maxOutLen: number
  ) => number;
  fastart_modnet_alpha_to_rle_c?: (
    alphaPtr: number,
    alphaLen: number,
    threshold: number,
    feather: number,
    outPtr: number,
    outCapacity: number
  ) => number;
  fastart_segment_frame_rgba_c?: (
    rgbaPtr: number,
    width: number,
    height: number,
    threshold: number,
    feather: number,
    seedMaskPtr: number,
    seedMaskLen: number,
    outAlphaPtr: number,
    maxOutLen: number
  ) => number;
  fastart_encode_rgba_png_c?: (
    rgbaPtr: number,
    width: number,
    height: number,
    outPtr: number,
    maxOutLen: number
  ) => number;
  fastart_generate_animation_keyframes_c?: (
    presetPtr: number,
    presetLength: number,
    categoryPtr: number,
    categoryLength: number,
    frames: number,
    outPtr: number,
  ) => number;
}

class RustCoreBridgeService {
  private backendType: RustBackendType = "fallback";
  private wasmInstance: WasmExports | null = null;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;
  private lastModnetInitError: string | null = null;

  constructor() {
    this.init();
  }

  public async init(): Promise<boolean> {
    if (this.isInitialized) {
      return this.backendType !== "fallback";
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // 1. Check Android / iOS Native Module
      if (Platform.OS !== "web" && FastArtRust && typeof FastArtRust.isAvailable === "function") {
        try {
          const avail = await FastArtRust.isAvailable();
          if (avail) {
            this.backendType = Platform.OS === "ios" ? "ios_native" : "android_native";
            this.isInitialized = true;
            console.log(`[RustCoreBridge] Initialized with ${Platform.OS.toUpperCase()} Native Rust Core Engine`);
            return true;
          }
        } catch (_) {}
      }

      // 2. Check WebAssembly on Web
      if (Platform.OS === "web" && typeof window !== "undefined" && window.WebAssembly) {
        try {
          // Attempt loading WASM binary from static public directory
          // Resolve with base path support for GitHub Pages / subpaths
          const wasmUrl = resolveAssetUrl("/wasm/fastart_wasm.wasm?v=31");
          const fallbackOriginUrl = new URL("/wasm/fastart_wasm.wasm?v=21", window.location.origin).toString();
          const candidates = Array.from(new Set([wasmUrl, fallbackOriginUrl]));
          for (const wasmUrl of candidates) {
            try {
              const res = await fetch(wasmUrl);
              if (res.ok) {
                const buf = await res.arrayBuffer();
                const bytes = new Uint8Array(buf);
                // Verify WebAssembly magic header: \0asm
                if (bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) {
                  let wasmInstance: WebAssembly.Instance | null = null;
                  const module = await WebAssembly.instantiate(buf, {
                    env: { fastart_fill_random: (ptr: number, length: number) => {
                      const cryptoApi = window.crypto;
                      if (!cryptoApi || !wasmInstance) return 0;
                      const memory = wasmInstance.exports.memory as WebAssembly.Memory;
                      const output = new Uint8Array(memory.buffer, ptr, length);
                      for (let offset = 0; offset < length; offset += 65536) {
                        cryptoApi.getRandomValues(output.subarray(offset, Math.min(length, offset + 65536)));
                      }
                      return 1;
                    } },
                    wasi_snapshot_preview1: {},
                  });
                  wasmInstance = module.instance;
                  this.wasmInstance = module.instance.exports as unknown as WasmExports;
                  this.backendType = "web_wasm";
                  this.isInitialized = true;
                  console.log("[RustCoreBridge] Initialized with WebAssembly Rust Engine (fastart_wasm.wasm)");
                  return true;
                }
                console.warn(`[RustCoreBridge] Invalid WASM response from ${wasmUrl}`);
              } else {
                console.warn(`[RustCoreBridge] WASM request failed (${res.status}) for ${wasmUrl}`);
              }
            } catch (error) {
              console.warn(`[RustCoreBridge] WASM initialization failed for ${wasmUrl}:`, error);
            }
          }
        } catch (wasmErr) {
          console.warn("[RustCoreBridge] WebAssembly fetch skipped, fallback active:", wasmErr);
        }
      }

      this.backendType = "fallback";
      this.isInitialized = true;
      return false;
    })();

    return this.initPromise;
  }

  public async isAvailable(): Promise<boolean> {
    await this.init();
    return this.backendType !== "fallback";
  }

  public getBackendType(): RustBackendType {
    return this.backendType;
  }

  public hasNativeModnetModule(): boolean {
    return Platform.OS !== "web" && typeof FastArtRust?.initializeModnet === "function";
  }

  public getLastModnetInitError(): string | null {
    return this.lastModnetInitError;
  }

  public async initializeModnet(customModelPath = ""): Promise<boolean> {
    await this.init();
    if (this.backendType === "web_wasm") return false;
    if ((this.backendType !== "ios_native" && this.backendType !== "android_native") || !FastArtRust?.initializeModnet) {
      this.lastModnetInitError =
        "Native AI Cutout module is unavailable in this runtime. Build a native development/release client (npx expo run:ios or npx expo run:android).";
      return false;
    }
    try {
      this.lastModnetInitError = null;
      const result = await FastArtRust.initializeModnet(customModelPath);
      const ok = result === true || result === "ok";
      if (!ok) {
        this.lastModnetInitError = "Native AI Cutout model returned an invalid initialization state.";
      }
      return ok;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error || "Unknown native initialization error");
      this.lastModnetInitError = msg;
      console.warn("[RustCoreBridge] AI Cutout native initialization failed:", error);
      return false;
    }
  }

  public async inferModnetRgba(
    rgba: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    threshold: number,
    feather: number,
  ): Promise<Uint8Array> {
    await this.init();
    if ((this.backendType !== "ios_native" && this.backendType !== "android_native") || !FastArtRust?.inferModnetRgba) {
      throw new Error("Native Rust MODNet is unavailable");
    }
    const result = await FastArtRust.inferModnetRgba(
      encodeNativeBytes(rgba), width, height, threshold, feather,
    );
    if (typeof result !== "string") throw new Error("Native Rust MODNet returned no alpha mask");
    return decodeBase64ToUint8(result);
  }

  /** Decode and cut out a native video frame entirely inside the platform module. */
  public async processVideoFrameNative(
    videoUri: string,
    clipId: string,
    frameIndex: number,
    timeSeconds: number,
    threshold: number,
    feather: number,
    mode: "auto" | "chroma" = "auto",
    keyColor = "#00FF00",
  ): Promise<string | null> {
    await this.init();
    if ((this.backendType !== "android_native" && this.backendType !== "ios_native") ||
        typeof FastArtRust?.processVideoFrameNative !== "function") return null;
    const uri = await FastArtRust.processVideoFrameNative(
      videoUri, clipId, frameIndex, timeSeconds, threshold, feather, mode, keyColor,
    );
    return typeof uri === "string" && uri.length > 0 ? uri : null;
  }

  public async getNativeVideoFrameInfo(videoUri: string): Promise<NativeVideoFrameInfo | null> {
    await this.init();
    if ((this.backendType !== "android_native" && this.backendType !== "ios_native") ||
        typeof FastArtRust?.getVideoFrameInfo !== "function") return null;
    const info = await FastArtRust.getVideoFrameInfo(videoUri);
    const frameRate = Number(info?.frameRate);
    const frameCount = Number(info?.frameCount);
    const duration = Number(info?.duration);
    if (!Number.isFinite(frameRate) || frameRate <= 0 || !Number.isFinite(duration) || duration <= 0) return null;
    return {
      frameRate,
      frameCount: Number.isFinite(frameCount) && frameCount > 0 ? Math.floor(frameCount) : Math.ceil(frameRate * duration),
      duration,
    };
  }

  public async releaseVideoCutoutDecoder(videoUri: string): Promise<void> {
    if (typeof FastArtRust?.releaseVideoCutoutDecoder !== "function") return;
    try {
      await FastArtRust.releaseVideoCutoutDecoder(videoUri);
    } catch (error) {
      console.warn("[RustCoreBridge] Could not release native video decoder:", error);
    }
  }

  public async clearCutoutCache(clipId?: string): Promise<boolean> {
    if (Platform.OS !== "web" && typeof FastArtRust?.clearCutoutCache === "function") {
      try {
        await FastArtRust.clearCutoutCache(clipId || "");
        return true;
      } catch (error) {
        console.warn("[RustCoreBridge] Could not clear native cutout cache:", error);
      }
    }
    return false;
  }

  public async sampleVideoPixel(
    videoUri: string,
    timeSeconds: number = 0,
    normX: number = 0.5,
    normY: number = 0.5,
    mediaElement?: any
  ): Promise<string> {
    await this.init();
    if (Platform.OS !== "web" && typeof FastArtRust?.sampleVideoPixel === "function") {
      try {
        const hex = await FastArtRust.sampleVideoPixel(videoUri, timeSeconds, normX, normY);
        if (hex && typeof hex === "string" && hex.startsWith("#")) return hex;
      } catch (err) {
        console.warn("[RustCoreBridge] Native sampleVideoPixel error:", err);
      }
    }

    // Web or fallback pixel extraction via HTML5 Video / Canvas
    if (typeof document !== "undefined") {
      try {
        const media = mediaElement || (typeof window !== "undefined" && (window as any).getActiveMediaElement?.(videoUri));
        if (media && (media.videoWidth || media.naturalWidth || media.width)) {
          const w = media.videoWidth || media.naturalWidth || media.width || 64;
          const h = media.videoHeight || media.naturalHeight || media.height || 64;
          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const sx = Math.max(0, Math.min(w - 1, Math.floor(normX * w)));
            const sy = Math.max(0, Math.min(h - 1, Math.floor(normY * h)));
            ctx.drawImage(media, sx, sy, 1, 1, 0, 0, 1, 1);
            const data = ctx.getImageData(0, 0, 1, 1).data;
            const hex = `#${((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1).toUpperCase()}`;
            return hex;
          }
        }
      } catch {}
    }

    return "#00FF00";
  }

  public async detectBackdropColor(
    videoUri: string,
    timeSeconds: number = 0,
    mediaElement?: any
  ): Promise<string> {
    await this.init();
    if (Platform.OS !== "web" && typeof FastArtRust?.detectBackdropColor === "function") {
      try {
        const hex = await FastArtRust.detectBackdropColor(videoUri, timeSeconds);
        if (hex && typeof hex === "string" && hex.startsWith("#")) return hex;
      } catch (err) {
        console.warn("[RustCoreBridge] Native detectBackdropColor error:", err);
      }
    }

    // Web fallback via detectUniformBackdrop
    if (typeof document !== "undefined") {
      try {
        const media = mediaElement || (typeof window !== "undefined" && (window as any).getActiveMediaElement?.(videoUri));
        if (media) {
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(media, 0, 0, 64, 64);
            const imgData = ctx.getImageData(0, 0, 64, 64);
            const detected = this.detectUniformBackdrop(imgData.data, 64, 64);
            if (detected?.hex) return detected.hex;
          }
        }
      } catch {}
    }

    return "#00FF00";
  }

  /**
   * High-Performance Spectral Energy Flux Beat Detection
   * Executes in native Rust (Android JNI or WebAssembly)
   */
  public async detectAudioBeats(
    samples: Float32Array | number[],
    sampleRate: number = 44100
  ): Promise<RustBeatResult | null> {
    await this.init();

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const samplesList = Array.isArray(samples) ? samples : Array.from(samples);
        const jsonStr: string = await FastArtRust.detectBeats(samplesList, sampleRate);
        if (jsonStr) {
          return JSON.parse(jsonStr) as RustBeatResult;
        }
      } catch (err) {
        console.warn("[RustCoreBridge] Native detectAudioBeats error:", err);
      }
    }

    // 2. WebAssembly (Web)
    if (this.backendType === "web_wasm" && this.wasmInstance) {
      const inst = this.wasmInstance;
      const count = samples.length;
      const bytesPerFloat = 4;
      const maxOutLen = 16384;
      const neededBytes = count * bytesPerFloat + maxOutLen;
      const isScratchpad = typeof inst.fastart_get_scratchpad === "function";
      let basePtr = 0;
      let samplesPtr = 0;
      let outPtr = 0;
      try {
        if (isScratchpad) {
          basePtr = inst.fastart_get_scratchpad!(neededBytes);
          samplesPtr = basePtr;
          outPtr = basePtr + count * bytesPerFloat;
        } else {
          samplesPtr = inst.fastart_alloc(count * bytesPerFloat);
          outPtr = inst.fastart_alloc(maxOutLen);
        }

        const memoryBuffer = inst.memory.buffer;
        const floatView = new Float32Array(memoryBuffer, samplesPtr, count);
        if (samples instanceof Float32Array) {
          floatView.set(samples);
        } else {
          for (let i = 0; i < count; i++) floatView[i] = samples[i];
        }

        const written = inst.fastart_detect_beats_c(samplesPtr, count, sampleRate, outPtr, maxOutLen);
        const outBytes = new Uint8Array(inst.memory.buffer, outPtr, written);
        const jsonStr = new TextDecoder().decode(outBytes);

        if (jsonStr) {
          return JSON.parse(jsonStr) as RustBeatResult;
        }
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM detectAudioBeats error:", wasmErr);
      } finally {
        if (!isScratchpad) {
          if (samplesPtr) {
            try { inst.fastart_dealloc(samplesPtr, count * bytesPerFloat); } catch {}
          }
          if (outPtr) {
            try { inst.fastart_dealloc(outPtr, maxOutLen); } catch {}
          }
        }
      }
    }

    return null;
  }

  /**
   * High-Speed Waveform Peak Generator
   * Executes in native Rust in < 1ms
   */
  public async generateWaveform(
    samples: Float32Array | number[],
    buckets: number = 100
  ): Promise<number[] | null> {
    await this.init();

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const samplesList = Array.isArray(samples) ? samples : Array.from(samples);
        const peaks: number[] = await FastArtRust.generateWaveform(samplesList, buckets);
        return peaks;
      } catch (err) {
        console.warn("[RustCoreBridge] Native generateWaveform error:", err);
      }
    }

    // 2. WebAssembly (Web)
    if (this.backendType === "web_wasm" && this.wasmInstance) {
      const inst = this.wasmInstance;
      const count = samples.length;
      const bytesPerFloat = 4;
      const neededBytes = (count + buckets) * bytesPerFloat;
      const isScratchpad = typeof inst.fastart_get_scratchpad === "function";
      let basePtr = 0;
      let samplesPtr = 0;
      let outPeaksPtr = 0;
      try {
        if (isScratchpad) {
          basePtr = inst.fastart_get_scratchpad!(neededBytes);
          samplesPtr = basePtr;
          outPeaksPtr = basePtr + count * bytesPerFloat;
        } else {
          samplesPtr = inst.fastart_alloc(count * bytesPerFloat);
          outPeaksPtr = inst.fastart_alloc(buckets * bytesPerFloat);
        }

        const floatView = new Float32Array(inst.memory.buffer, samplesPtr, count);
        if (samples instanceof Float32Array) {
          floatView.set(samples);
        } else {
          for (let i = 0; i < count; i++) floatView[i] = samples[i];
        }

        const peakCount = inst.fastart_generate_waveform_c(samplesPtr, count, buckets, outPeaksPtr);
        const peaksView = new Float32Array(inst.memory.buffer, outPeaksPtr, peakCount);
        const peaks = Array.from(peaksView);

        return peaks;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM generateWaveform error:", wasmErr);
      } finally {
        if (!isScratchpad) {
          if (samplesPtr) {
            try { inst.fastart_dealloc(samplesPtr, count * bytesPerFloat); } catch {}
          }
          if (outPeaksPtr) {
            try { inst.fastart_dealloc(outPeaksPtr, buckets * bytesPerFloat); } catch {}
          }
        }
      }
    }

    return null;
  }

  public async decodeAudioPeaks(
    buffer: ArrayBuffer,
    numPoints = 3200,
  ): Promise<{ duration: number; peaks: number[] } | null> {
    await this.init();
    const bytes = new Uint8Array(buffer);
    if (this.backendType === "android_native" || this.backendType === "ios_native") {
      if (!FastArtRust || typeof FastArtRust.decodeAudioPeaks !== "function") {
        throw new Error("Rust audio decoding is not exposed by the native module");
      }
      const json = await FastArtRust.decodeAudioPeaks(
        Buffer.from(bytes).toString("base64"),
        numPoints,
      );
      if (!json) return null;
      const result = JSON.parse(json) as { duration: number; peaks: number[] };
      return result.peaks?.length ? result : null;
    }
    const inst = this.wasmInstance;
    if (
      this.backendType !== "web_wasm" ||
      !inst?.fastart_decode_audio_peaks_c
    ) {
      throw new Error("Rust WASM WAV parsing is unavailable");
    }
    const pointCapacity = Math.min(24_000, Math.max(1, Math.floor(numPoints)));
    const outputBytes = pointCapacity * Float32Array.BYTES_PER_ELEMENT;
    // WASM memory views require naturally aligned offsets even when the input
    // media byte length is arbitrary (compressed files rarely end on 4/8 bytes).
    const alignmentPadding = 3 + 7;
    const totalBytes = bytes.length + outputBytes + alignmentPadding + Float64Array.BYTES_PER_ELEMENT;
    const scratch = typeof inst.fastart_get_scratchpad === "function";
    const basePtr = scratch
      ? inst.fastart_get_scratchpad!(totalBytes)
      : inst.fastart_alloc(totalBytes);
    if (!basePtr) throw new Error("Rust WASM allocation failed for WAV parsing");
    try {
      const outputPtr = Math.ceil((basePtr + bytes.length) / Float32Array.BYTES_PER_ELEMENT) * Float32Array.BYTES_PER_ELEMENT;
      const durationAddress = outputPtr + outputBytes;
      const durationPtr = Math.ceil(durationAddress / Float64Array.BYTES_PER_ELEMENT) * Float64Array.BYTES_PER_ELEMENT;
      new Uint8Array(inst.memory.buffer, basePtr, bytes.length).set(bytes);
      const count = inst.fastart_decode_audio_peaks_c(
        basePtr,
        bytes.length,
        pointCapacity,
        outputPtr,
        pointCapacity,
        durationPtr,
      );
      if (count <= 0 || count > pointCapacity) return null;
      const peaks = Array.from(new Float32Array(inst.memory.buffer, outputPtr, count));
      const duration = new Float64Array(inst.memory.buffer, durationPtr, 1)[0];
      return { duration, peaks };
    } finally {
      if (!scratch) inst.fastart_dealloc(basePtr, totalBytes);
    }
  }

  /**
   * Renders media-free project frames in Rust. Source video/image and overlay
   * pixels must be supplied by a platform renderer, so media-bearing projects
   * are left to that renderer.
   */
  public async renderSnapshot(
    project: FastArtProject,
    timeSec: number,
    width: number = 720,
    height: number = 1280
  ): Promise<string | null> {
    if (rustProjectHasVisualMedia(project)) return null;
    await this.init();

    const projectJson = JSON.stringify(project);

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const dataUri: string = await FastArtRust.renderSnapshot(projectJson, timeSec, width, height);
        return dataUri;
      } catch (err) {
        console.warn("[RustCoreBridge] Native renderSnapshot error:", err);
      }
    }

    // 2. WebAssembly (Web)
    if (this.backendType === "web_wasm" && this.wasmInstance) {
      try {
        const inst = this.wasmInstance;
        const jsonEncoder = new TextEncoder();
        const jsonBytes = jsonEncoder.encode(projectJson);
        const jsonLen = jsonBytes.length;

        const jsonPtr = inst.fastart_alloc(jsonLen);
        new Uint8Array(inst.memory.buffer, jsonPtr, jsonLen).set(jsonBytes);

        const maxOutLen = width * height * 4 + 4096;
        const outPtr = inst.fastart_alloc(maxOutLen);

        const written = inst.fastart_render_snapshot_c(
          jsonPtr,
          jsonLen,
          timeSec,
          width,
          height,
          outPtr,
          maxOutLen
        );

        let dataUri: string | null = null;
        if (written > 0) {
          const pngBytes = new Uint8Array(inst.memory.buffer, outPtr, written);
          // Convert to binary string
          let binary = "";
          for (let i = 0; i < written; i++) {
            binary += String.fromCharCode(pngBytes[i]);
          }
          const b64 = btoa(binary);
          dataUri = `data:image/png;base64,${b64}`;
        }

        inst.fastart_dealloc(jsonPtr, jsonLen);
        inst.fastart_dealloc(outPtr, maxOutLen);

        return dataUri;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM renderSnapshot error:", wasmErr);
      }
    }

    return null;
  }

  /**
   * Renders a single composite project frame at timeSec directly into an RGBA32 pixel buffer
   * In-memory zero-copy rendering in native Rust
   */
  public async renderProjectFrame(
    project: FastArtProject,
    timeSec: number,
    width: number,
    height: number,
    targetBuffer?: Uint8Array
  ): Promise<Uint8Array | null> {
    if (rustProjectHasVisualMedia(project)) return null;
    await this.init();

    const projectJson = JSON.stringify(project);

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const rawBytes: Uint8Array | number[] = await FastArtRust.renderFrameRgba(
          projectJson,
          timeSec,
          width,
          height
        );
        if (rawBytes) {
          const u8 = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
          if (targetBuffer && targetBuffer.length >= u8.length) {
            targetBuffer.set(u8);
            return targetBuffer;
          }
          return u8;
        }
      } catch (err) {
        console.warn("[RustCoreBridge] Native renderFrameRgba error:", err);
      }
    }

    // 2. WebAssembly (Web)
    if (this.backendType === "web_wasm" && this.wasmInstance) {
      try {
        const inst = this.wasmInstance;
        const jsonEncoder = new TextEncoder();
        const jsonBytes = jsonEncoder.encode(projectJson);
        const jsonLen = jsonBytes.length;

        const jsonPtr = inst.fastart_alloc(jsonLen);
        new Uint8Array(inst.memory.buffer, jsonPtr, jsonLen).set(jsonBytes);

        const frameByteLen = width * height * 4;
        const outPtr = inst.fastart_alloc(frameByteLen);

        const written = inst.fastart_render_frame_rgba_c(
          jsonPtr,
          jsonLen,
          timeSec,
          width,
          height,
          outPtr,
          frameByteLen
        );

        let result: Uint8Array | null = null;
        if (written > 0) {
          const wasmSlice = new Uint8Array(inst.memory.buffer, outPtr, written);
          if (targetBuffer && targetBuffer.length >= written) {
            targetBuffer.set(wasmSlice);
            result = targetBuffer;
          } else {
            result = new Uint8Array(wasmSlice);
          }
        }

        inst.fastart_dealloc(jsonPtr, jsonLen);
        inst.fastart_dealloc(outPtr, frameByteLen);

        return result;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM renderFrameRgba error:", wasmErr);
      }
    }

    return null;
  }

  /**
   * High-performance animated GIF export directly in native Rust
   * Quantizes and compresses project frames with maximum efficiency
   */
  public async exportProjectGif(
    project: FastArtProject,
    fps: number = 15,
    width: number = 480,
    height: number = 854,
    duration?: number,
    targetFilePath?: string
  ): Promise<string | null> {
    if (rustProjectHasVisualMedia(project)) return null;
    await this.init();

    const dur = duration || (project as any).duration || 5.0;
    const projectJson = JSON.stringify(project);

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const result: string = await FastArtRust.exportGif(
          projectJson,
          fps,
          width,
          height,
          dur,
          targetFilePath || ""
        );
        return result;
      } catch (err) {
        console.warn("[RustCoreBridge] Native exportGif error:", err);
      }
    }

    // 2. WebAssembly (Web)
    if (this.backendType === "web_wasm" && this.wasmInstance) {
      let jsonPtr = 0;
      let outPtr = 0;
      let maxOutLen = 0;
      const jsonLen = new TextEncoder().encode(projectJson).length;
      try {
        const inst = this.wasmInstance;
        const jsonEncoder = new TextEncoder();
        const jsonBytes = jsonEncoder.encode(projectJson);

        jsonPtr = inst.fastart_alloc(jsonBytes.length);
        if (!jsonPtr) return null;
        new Uint8Array(inst.memory.buffer, jsonPtr, jsonBytes.length).set(jsonBytes);

        // Check if fastart_export_gif_to_heap is available for zero-copy dynamically-sized export
        if (typeof inst.fastart_export_gif_to_heap === "function" && typeof inst.fastart_get_export_buffer_ptr === "function") {
          const written = inst.fastart_export_gif_to_heap(
            jsonPtr,
            jsonBytes.length,
            fps,
            width,
            height,
            dur
          );

          if (written > 0) {
            const ptr = inst.fastart_get_export_buffer_ptr();
            const gifBytes = new Uint8Array(inst.memory.buffer, ptr, written);
            let binary = "";
            const chunkSize = 16384;
            for (let i = 0; i < written; i += chunkSize) {
              const sub = gifBytes.subarray(i, Math.min(i + chunkSize, written));
              binary += String.fromCharCode.apply(null, sub as any);
            }
            if (typeof inst.fastart_free_export_buffer === "function") {
              inst.fastart_free_export_buffer();
            }
            const b64 = btoa(binary);
            return `data:image/gif;base64,${b64}`;
          }
        }

        // Fallback to fastart_export_gif_c
        maxOutLen = Math.min(width * height * fps * Math.ceil(dur) + 65536, 30 * 1024 * 1024);
        outPtr = inst.fastart_alloc(maxOutLen);
        if (!outPtr) return null;

        const written = inst.fastart_export_gif_c(
          jsonPtr,
          jsonBytes.length,
          fps,
          width,
          height,
          dur,
          outPtr,
          maxOutLen
        );

        let dataUri: string | null = null;
        if (written > 0) {
          const gifBytes = new Uint8Array(inst.memory.buffer, outPtr, written);
          let binary = "";
          const chunkSize = 16384;
          for (let i = 0; i < written; i += chunkSize) {
            const sub = gifBytes.subarray(i, Math.min(i + chunkSize, written));
            binary += String.fromCharCode.apply(null, sub as any);
          }
          const b64 = btoa(binary);
          dataUri = `data:image/gif;base64,${b64}`;
        }

        return dataUri;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM exportGif error:", wasmErr);
      } finally {
        if (this.wasmInstance) {
          if (jsonPtr) this.wasmInstance.fastart_dealloc(jsonPtr, jsonLen);
          if (outPtr && maxOutLen) this.wasmInstance.fastart_dealloc(outPtr, maxOutLen);
        }
      }
    }

    return null;
  }

  /**
   * Multi-track audio mixdown directly in native Rust to 16-bit PCM WAV
   */
  public async exportProjectWav(
    project: FastArtProject,
    sampleRate: number = 44100,
    duration?: number,
    targetFilePath?: string
  ): Promise<Uint8Array | string | null> {
    if (rustProjectHasAudioMedia(project)) return null;
    await this.init();

    const dur = duration || (project as any).duration || 5.0;
    const projectJson = JSON.stringify(project);

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const rawResult: any = await FastArtRust.exportWav(
          projectJson,
          sampleRate,
          dur,
          targetFilePath || ""
        );
        if (rawResult) {
          if (typeof rawResult === "string") {
            return rawResult;
          }
          return rawResult instanceof Uint8Array ? rawResult : new Uint8Array(rawResult);
        }
      } catch (err) {
        console.warn("[RustCoreBridge] Native exportWav error:", err);
      }
    }

    // 2. WebAssembly (Web)
    if (this.backendType === "web_wasm" && this.wasmInstance) {
      let jsonPtr = 0;
      let outPtr = 0;
      let maxOutLen = 0;
      const jsonLen = new TextEncoder().encode(projectJson).length;
      try {
        const inst = this.wasmInstance;
        const jsonEncoder = new TextEncoder();
        const jsonBytes = jsonEncoder.encode(projectJson);

        jsonPtr = inst.fastart_alloc(jsonBytes.length);
        if (!jsonPtr) return null;
        new Uint8Array(inst.memory.buffer, jsonPtr, jsonBytes.length).set(jsonBytes);

        // Check if fastart_export_wav_to_heap is available for zero-copy export
        if (typeof inst.fastart_export_wav_to_heap === "function" && typeof inst.fastart_get_export_buffer_ptr === "function") {
          const written = inst.fastart_export_wav_to_heap(
            jsonPtr,
            jsonBytes.length,
            sampleRate,
            dur
          );

          if (written > 0) {
            const ptr = inst.fastart_get_export_buffer_ptr();
            const wasmSlice = new Uint8Array(inst.memory.buffer, ptr, written);
            const copy = new Uint8Array(wasmSlice);
            if (typeof inst.fastart_free_export_buffer === "function") {
              inst.fastart_free_export_buffer();
            }
            return copy;
          }
        }

        // WAV header (44 bytes) + samples (dur * sampleRate * 2 channels * 2 bytes/sample)
        const totalSamples = Math.ceil(dur * sampleRate * 2);
        maxOutLen = totalSamples * 2 + 1024;
        outPtr = inst.fastart_alloc(maxOutLen);
        if (!outPtr) return null;

        const written = inst.fastart_export_wav_c(
          jsonPtr,
          jsonBytes.length,
          sampleRate,
          dur,
          outPtr,
          maxOutLen
        );

        let wavBytes: Uint8Array | null = null;
        if (written > 0) {
          wavBytes = new Uint8Array(new Uint8Array(inst.memory.buffer, outPtr, written));
        }

        return wavBytes;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM exportWav error:", wasmErr);
      } finally {
        if (this.wasmInstance) {
          if (jsonPtr) this.wasmInstance.fastart_dealloc(jsonPtr, jsonLen);
          if (outPtr && maxOutLen) this.wasmInstance.fastart_dealloc(outPtr, maxOutLen);
        }
      }
    }

    return null;
  }

  /**
   * Exports media-free projects in Rust. Projects with real video, audio, or
   * raster overlays must use a platform media renderer with decoded sources.
   */
  public async exportProjectMp4(
    project: FastArtProject,
    fps: number = 30,
    width: number = 720,
    height: number = 1280,
    duration?: number,
    targetFilePath?: string
  ): Promise<Uint8Array | string | null> {
    if (rustProjectHasVisualMedia(project) || rustProjectHasAudioMedia(project)) return null;
    await this.init();

    const dur = duration || (project as any).duration || 5.0;
    const projectJson = JSON.stringify(project);

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const rawResult: any = await FastArtRust.exportMp4(
          projectJson,
          fps,
          width,
          height,
          dur,
          targetFilePath || ""
        );
        if (rawResult) {
          if (typeof rawResult === "string") {
            return rawResult;
          }
          return rawResult instanceof Uint8Array ? rawResult : new Uint8Array(rawResult);
        }
      } catch (err) {
        console.warn("[RustCoreBridge] Native exportMp4 error:", err);
      }
    }

    // 2. WebAssembly (Web)
    if (this.backendType === "web_wasm" && this.wasmInstance) {
      let jsonPtr = 0;
      let outPtr = 0;
      let maxOutLen = 0;
      const jsonLen = new TextEncoder().encode(projectJson).length;
      try {
        const inst = this.wasmInstance;
        const jsonEncoder = new TextEncoder();
        const jsonBytes = jsonEncoder.encode(projectJson);

        jsonPtr = inst.fastart_alloc(jsonBytes.length);
        if (!jsonPtr) return null;
        new Uint8Array(inst.memory.buffer, jsonPtr, jsonBytes.length).set(jsonBytes);

        // Check if fastart_export_mp4_to_heap is available for zero-copy export
        if (typeof inst.fastart_export_mp4_to_heap === "function" && typeof inst.fastart_get_export_buffer_ptr === "function") {
          const written = inst.fastart_export_mp4_to_heap(
            jsonPtr,
            jsonBytes.length,
            fps,
            width,
            height,
            dur
          );

          if (written > 0) {
            const ptr = inst.fastart_get_export_buffer_ptr();
            const wasmSlice = new Uint8Array(inst.memory.buffer, ptr, written);
            const copy = new Uint8Array(wasmSlice);
            if (typeof inst.fastart_free_export_buffer === "function") {
              inst.fastart_free_export_buffer();
            }
            return copy;
          }
        }

        const totalFrames = Math.max(1, Math.ceil(dur * fps));
        maxOutLen = Math.max(totalFrames * 500 * 1024, 64 * 1024 * 1024);
        outPtr = inst.fastart_alloc(maxOutLen);
        if (!outPtr) {
          return null;
        }

        const written = inst.fastart_export_mp4_c(
          jsonPtr,
          jsonBytes.length,
          fps,
          width,
          height,
          dur,
          outPtr,
          maxOutLen
        );

        let mp4Bytes: Uint8Array | null = null;
        if (written > 0) {
          mp4Bytes = new Uint8Array(new Uint8Array(inst.memory.buffer, outPtr, written));
        }

        return mp4Bytes;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM exportMp4 error:", wasmErr);
      } finally {
        if (this.wasmInstance) {
          if (jsonPtr) this.wasmInstance.fastart_dealloc(jsonPtr, jsonLen);
          if (outPtr && maxOutLen) this.wasmInstance.fastart_dealloc(outPtr, maxOutLen);
        }
      }
    }

    return null;
  }

  /**
   * Evaluates Motion Tracking offsets (dx, dy, dScale, dRot)
   * Computed in native Rust for 60fps gesture and timeline playback
   */
  public evaluateMotionTrack(
    time: number,
    clipStartTime: number,
    clipDuration: number,
    mode: string = "follow_center",
    intensity: number = 60
  ): { dx: number; dy: number; dScale: number; dRot: number } {
    const identity = { dx: 0, dy: 0, dScale: 1.0, dRot: 0 };
    if (this.backendType !== "web_wasm" || !this.wasmInstance?.fastart_motion_track_c) {
      return identity;
    }
    let outPtr = 0;
    try {
      const inst = this.wasmInstance;
      const modeMap: Record<string, number> = {
        follow_center: 1,
        cinematic_drift: 2,
        dynamic_zoom: 3,
        orbit_float: 4,
      };
      const modeIdx = modeMap[mode] || 0;
      outPtr = inst.fastart_alloc(32); // 4 * sizeof(f64)
      if (!outPtr) return identity;
      inst.fastart_motion_track_c(
        time,
        clipStartTime,
        clipDuration,
        modeIdx,
        intensity,
        outPtr,
        outPtr + 8,
        outPtr + 16,
        outPtr + 24
      );
      const f64View = new Float64Array(inst.memory.buffer, outPtr, 4);
      return { dx: f64View[0], dy: f64View[1], dScale: f64View[2], dRot: f64View[3] };
    } catch (error) {
      console.error("[RustCoreBridge] Rust motion tracking failed:", error);
      return identity;
    } finally {
      if (outPtr) this.wasmInstance?.fastart_dealloc(outPtr, 32);
    }
  }

  public evaluateObjectTrackTrajectory(
    time: number,
    trajectory: TrajectoryPoint[],
    trackScale = true,
    trackRotation = false,
    cameraCenter = false,
    anchorTime?: number,
    cameraFitToScreen = true,
    cameraZoom = 1.25,
    cameraLockCenter = true,
  ): { dx: number; dy: number; dScale: number; dRot: number } {
    const identity = { dx: 0, dy: 0, dScale: 1.0, dRot: 0 };
    if (!trajectory || trajectory.length === 0) {
      return identity;
    }
    const inst = this.wasmInstance;
    if (
      this.backendType === "web_wasm" &&
      inst?.fastart_evaluate_object_track_c
    ) {
      const count = trajectory.length;
      const valuesBytes = count * Float64Array.BYTES_PER_ELEMENT;
      const outputBytes = 4 * Float64Array.BYTES_PER_ELEMENT;
      const totalBytes = valuesBytes * 5 + outputBytes;
      const scratch = typeof inst.fastart_get_scratchpad === "function";
      const basePtr = scratch
        ? inst.fastart_get_scratchpad!(totalBytes)
        : inst.fastart_alloc(totalBytes);
      if (basePtr) {
        try {
          const timesPtr = basePtr;
          const xPtr = timesPtr + valuesBytes;
          const yPtr = xPtr + valuesBytes;
          const scalesPtr = yPtr + valuesBytes;
          const rotationsPtr = scalesPtr + valuesBytes;
          const outputPtr = rotationsPtr + valuesBytes;
          const memory = inst.memory.buffer;
          const times = new Float64Array(memory, timesPtr, count);
          const xs = new Float64Array(memory, xPtr, count);
          const ys = new Float64Array(memory, yPtr, count);
          const scales = new Float64Array(memory, scalesPtr, count);
          const rotations = new Float64Array(memory, rotationsPtr, count);
          for (let index = 0; index < count; index++) {
            const point = trajectory[index];
            times[index] = point.time;
            xs[index] = point.x;
            ys[index] = point.y;
            scales[index] = point.scale;
            rotations[index] = point.rotation;
          }
          const output = new Float64Array(memory, outputPtr, 4);
          const success = inst.fastart_evaluate_object_track_c(
            time,
            timesPtr,
            xPtr,
            yPtr,
            scalesPtr,
            rotationsPtr,
            count,
            anchorTime ?? Number.NaN,
            Number(trackScale),
            Number(trackRotation),
            Number(cameraCenter),
            Number(cameraFitToScreen),
            cameraZoom,
            Number(cameraLockCenter),
            outputPtr,
            outputPtr + 8,
            outputPtr + 16,
            outputPtr + 24,
          );
          if (success === 1) {
            return { dx: output[0], dy: output[1], dScale: output[2], dRot: output[3] };
          }
        } catch (error) {
          console.error("[RustCoreBridge] Rust object tracking failed, using JS fallback:", error);
        } finally {
          if (!scratch) inst.fastart_dealloc(basePtr, totalBytes);
        }
      }
    }

    // High-precision TypeScript / JS fallback (guarantees silky smooth tracking on native mobile and web fallback)
    let origin = trajectory[0];
    if (anchorTime !== undefined && Number.isFinite(anchorTime)) {
      let bestDist = Infinity;
      for (let i = 0; i < trajectory.length; i++) {
        const dist = Math.abs(trajectory[i].time - anchorTime);
        if (dist < bestDist) {
          bestDist = dist;
          origin = trajectory[i];
        }
      }
    }

    let pt = trajectory[0];
    if (time <= trajectory[0].time) {
      pt = trajectory[0];
    } else if (time >= trajectory[trajectory.length - 1].time) {
      pt = trajectory[trajectory.length - 1];
    } else {
      let low = 0;
      let high = trajectory.length - 1;
      while (low + 1 < high) {
        const mid = (low + high) >> 1;
        if (trajectory[mid].time <= time) low = mid;
        else high = mid;
      }
      const p0 = trajectory[low];
      const p1 = trajectory[high];
      const dt = Math.max(0.0001, p1.time - p0.time);
      const frac = Math.min(1, Math.max(0, (time - p0.time) / dt));
      pt = {
        time,
        x: p0.x + (p1.x - p0.x) * frac,
        y: p0.y + (p1.y - p0.y) * frac,
        scale: (p0.scale || 1.0) + ((p1.scale || 1.0) - (p0.scale || 1.0)) * frac,
        rotation: (p0.rotation || 0) + ((p1.rotation || 0) - (p0.rotation || 0)) * frac,
        confidence: 1,
      };
    }

    if (cameraCenter) {
      const targetScale = cameraFitToScreen ? cameraZoom : 1.0;
      const effectiveScale = trackScale ? Math.max(0.2, (pt.scale || 1.0) * targetScale) : targetScale;
      const panX = cameraLockCenter ? (50 - pt.x) : -(pt.x - origin.x);
      const panY = cameraLockCenter ? (50 - pt.y) : -(pt.y - origin.y);
      const rot = trackRotation ? -(pt.rotation || 0) : 0;
      return { dx: panX, dy: panY, dScale: effectiveScale, dRot: rot };
    }

    const deltaX = pt.x - origin.x;
    const deltaY = pt.y - origin.y;
    const dScale = trackScale ? Math.max(0.1, (pt.scale || 1.0) / (origin.scale || 1.0)) : 1.0;
    const dRot = trackRotation ? (pt.rotation || 0) - (origin.rotation || 0) : 0;

    return { dx: deltaX, dy: deltaY, dScale, dRot };
  }

  public isWasmReady(): boolean {
    return this.backendType === "web_wasm" && this.wasmInstance !== null;
  }

  /**
   * Synchronous WASM chroma keying for browser canvas rendering.
   * Includes high-precision Rec. 709 Hermite fallback if WASM is initializing.
   */
  public processChromaCutout(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    keyHex: string,
    threshold: number,
    feather: number,
    despill = true
  ): boolean {
    const hex = keyHex.startsWith("#") ? keyHex.slice(1) : keyHex;
    const rKey = parseInt(hex.slice(0, 2), 16) || 0;
    const gKey = parseInt(hex.slice(2, 4), 16) || 0;
    const bKey = parseInt(hex.slice(4, 6), 16) || 0;

    const inst = this.wasmInstance;
    if (inst && typeof inst.fastart_process_chroma_c === "function") {
      try {
        const totalBytes = width * height * 4;
        const isScratchpad = typeof inst.fastart_get_scratchpad === "function";
        const pixelsPtr = isScratchpad
          ? inst.fastart_get_scratchpad!(totalBytes)
          : inst.fastart_alloc(totalBytes);
        if (pixelsPtr) {
          // Copy input pixels to WebAssembly linear memory
          new Uint8Array(inst.memory.buffer, pixelsPtr, totalBytes).set(pixels);

          // Execute optimized Rust SIMD/parallel chroma pipeline
          inst.fastart_process_chroma_c(
            pixelsPtr,
            width,
            height,
            rKey,
            gKey,
            bKey,
            threshold,
            feather,
            despill ? 1 : 0
          );

          // Read back processed pixels with despilled RGB and smooth Hermite alpha
          pixels.set(new Uint8Array(inst.memory.buffer, pixelsPtr, totalBytes));

          if (!isScratchpad) {
            inst.fastart_dealloc(pixelsPtr, totalBytes);
          }
          return true;
        }
      } catch (err) {
        // Fall back to pure JS implementation below
      }
    }

    // High-performance YCbCr perceptual chroma key distance + smooth Hermite S-curve + edge-isolated despill
    const yKey = 0.299 * rKey + 0.587 * gKey + 0.114 * bKey;
    const cbKey = -0.168736 * rKey - 0.331264 * gKey + 0.5 * bKey + 128.0;
    const crKey = 0.5 * rKey - 0.418688 * gKey - 0.081312 * bKey + 128.0;

    const threshNorm = Math.max(0.01, Math.min(1.0, threshold));
    const featherNorm = Math.max(0.01, Math.min(1.0, feather));

    const tolerance = 4.0 + threshNorm * 90.0;
    const softness = Math.max(0.5, 1.0 + featherNorm * 40.0);
    const outer = tolerance + softness;
    const invSoftness = 1.0 / softness;

    const isGreenScreen = gKey > rKey && gKey > bKey;
    const isBlueScreen = bKey > rKey && bKey > gKey;
    const totalPixels = width * height;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      let g = pixels[idx + 1];
      let b = pixels[idx + 2];
      const origA = pixels[idx + 3] / 255;

      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128.0;
      const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128.0;

      const dCb = cb - cbKey;
      const dCr = cr - crKey;
      const dY = y - yKey;
      const dist = Math.sqrt(dCb * dCb + dCr * dCr + 0.06 * dY * dY);

      if (dist <= tolerance) {
        pixels[idx + 3] = 0;
        continue;
      }

      if (dist >= outer) {
        continue;
      }

      const u = (dist - tolerance) * invSoftness;
      const alpha = u * u * (3.0 - 2.0 * u);

      if (despill) {
        const despillWeight = (1.0 - alpha) * 0.95;
        if (isGreenScreen) {
          const maxRb = Math.max(r, b);
          if (g > maxRb) {
            g = Math.round(g - (g - maxRb) * despillWeight);
            pixels[idx + 1] = g;
          }
        } else if (isBlueScreen) {
          const maxRg = Math.max(r, g);
          if (b > maxRg) {
            b = Math.round(b - (b - maxRg) * despillWeight);
            pixels[idx + 2] = b;
          }
        }
      }

      pixels[idx + 3] = Math.round(Math.max(0, Math.min(1, alpha * origA)) * 255);
    }
    return true;
  }

  /**
   * Studio Edge Decontamination (De-Fringing):
   * Purges background light-wrap bleed/halos from semi-transparent edge pixels (denim jackets, hair).
   * Runs in native Rust WASM with seamless typed-array fallback.
   */
  public defringeCutoutEdges(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
  ): void {
    const inst = this.wasmInstance;
    const totalBytes = width * height * 4;
    if (
      this.backendType === "web_wasm" &&
      inst?.fastart_defringe_rgba_c &&
      inst.memory
    ) {
      try {
        const useScratch = typeof inst.fastart_get_scratchpad === "function";
        const ptr = useScratch
          ? inst.fastart_get_scratchpad!(totalBytes)
          : inst.fastart_alloc?.(totalBytes) || 0;
        if (ptr) {
          new Uint8Array(inst.memory.buffer, ptr, totalBytes).set(pixels);
          inst.fastart_defringe_rgba_c(ptr, width, height);
          pixels.set(new Uint8Array(inst.memory.buffer, ptr, totalBytes));
          if (!useScratch) {
            inst.fastart_dealloc?.(ptr, totalBytes);
          }
          return;
        }
      } catch (err) {
        console.warn("[RustCoreBridge] WASM defringe fallback:", err);
      }
    }

    let hasTransition = false;
    const total = width * height;
    for (let i = 0; i < total; i++) {
      const a = pixels[i * 4 + 3];
      if (a >= 4 && a <= 250) {
        hasTransition = true;
        break;
      }
    }
    if (!hasTransition) {
      for (let i = 0; i < total; i++) {
        if (pixels[i * 4 + 3] < 4) pixels[i * 4 + 3] = 0;
      }
      return;
    }

    const maxDim = Math.max(width, height);
    const r = Math.max(3, Math.min(7, Math.round(maxDim / 300)));

    for (let y = 0; y < height; y++) {
      const rowIdx = y * width;
      const yMin = Math.max(0, y - r);
      const yMax = Math.min(height - 1, y + r);

      for (let x = 0; x < width; x++) {
        const idx = (rowIdx + x) * 4;
        const a = pixels[idx + 3];

        if (a < 4) {
          pixels[idx + 3] = 0;
          continue;
        }
        if (a > 250) {
          continue;
        }

        const xMin = Math.max(0, x - r);
        const xMax = Math.min(width - 1, x + r);

        let fgR = 0;
        let fgG = 0;
        let fgB = 0;
        let fgWeight = 0;

        for (let ny = yMin; ny <= yMax; ny++) {
          const nRow = ny * width;
          const dy = ny - y;
          for (let nx = xMin; nx <= xMax; nx++) {
            const nIdx = (nRow + nx) * 4;
            if (pixels[nIdx + 3] >= 235) {
              const dx = nx - x;
              const w = 1.0 / (1.0 + dx * dx + dy * dy);
              fgR += pixels[nIdx] * w;
              fgG += pixels[nIdx + 1] * w;
              fgB += pixels[nIdx + 2] * w;
              fgWeight += w;
            }
          }
        }

        if (fgWeight > 0) {
          const avgR = fgR / fgWeight;
          const avgG = fgG / fgWeight;
          const avgB = fgB / fgWeight;

          const curR = pixels[idx];
          const curG = pixels[idx + 1];
          const curB = pixels[idx + 2];

          const alphaNorm = a / 255.0;
          const blendW = Math.pow(1.0 - alphaNorm, 0.75) * 0.95;
          const invBlend = 1.0 - blendW;

          pixels[idx] = Math.round(curR * invBlend + avgR * blendW);
          pixels[idx + 1] = Math.round(curG * invBlend + avgG * blendW);
          pixels[idx + 2] = Math.round(curB * invBlend + avgB * blendW);
        }
      }
    }
  }

  /**
   * Studio Guided Filter Edge Matting (He et al. / Industry-standard matting):
   * Refines a neural alpha matte by transferring high-frequency edge gradients from the native RGB frame.
   * Snaps clothing, hair strands, and body boundaries with pixel-perfect precision in WASM.
   */
  public refineMatteGuided(
    guideRgba: Uint8ClampedArray,
    inputMaskAlpha: Uint8Array | Uint8ClampedArray,
    outputMaskAlpha: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    radius = 3,
    eps = 1e-4,
  ): boolean {
    const inst = this.wasmInstance;
    const totalPixels = width * height;
    if (
      this.backendType !== "web_wasm" ||
      !inst?.fastart_guided_filter_matting_c ||
      !inst.memory ||
      guideRgba.length < totalPixels * 4 ||
      inputMaskAlpha.length < totalPixels
    ) {
      return false;
    }

    try {
      const guideBytes = totalPixels * 4;
      const maskBytes = totalPixels;
      const totalBytes = guideBytes + maskBytes * 2;
      const useScratch = typeof inst.fastart_get_scratchpad === "function";
      let guidePtr = 0;
      let maskPtr = 0;
      let outPtr = 0;

      if (useScratch) {
        const base = inst.fastart_get_scratchpad!(totalBytes);
        if (base) {
          guidePtr = base;
          maskPtr = base + guideBytes;
          outPtr = maskPtr + maskBytes;
        }
      } else if (inst.fastart_alloc && inst.fastart_dealloc) {
        guidePtr = inst.fastart_alloc(guideBytes);
        maskPtr = inst.fastart_alloc(maskBytes);
        outPtr = inst.fastart_alloc(maskBytes);
      }

      if (!guidePtr || !maskPtr || !outPtr) {
        if (!useScratch && inst.fastart_dealloc) {
          if (guidePtr) inst.fastart_dealloc(guidePtr, guideBytes);
          if (maskPtr) inst.fastart_dealloc(maskPtr, maskBytes);
          if (outPtr) inst.fastart_dealloc(outPtr, maskBytes);
        }
        return false;
      }

      new Uint8Array(inst.memory.buffer, guidePtr, guideBytes).set(guideRgba);
      new Uint8Array(inst.memory.buffer, maskPtr, maskBytes).set(inputMaskAlpha);

      inst.fastart_guided_filter_matting_c(
        guidePtr,
        maskPtr,
        outPtr,
        width,
        height,
        radius,
        eps,
      );

      outputMaskAlpha.set(new Uint8Array(inst.memory.buffer, outPtr, maskBytes));

      if (!useScratch && inst.fastart_dealloc) {
        inst.fastart_dealloc(guidePtr, guideBytes);
        inst.fastart_dealloc(maskPtr, maskBytes);
        inst.fastart_dealloc(outPtr, maskBytes);
      }
      return true;
    } catch (e) {
      console.warn("[RustCoreBridge] refineMatteGuided error:", e);
      return false;
    }
  }

  /**
   * Unified WASM RGB-guided matting + edge color decontamination in a single scratchpad pass.
   * Uses `subsample = 1` for full-res paused/export polish or `subsample = 2` for 60 FPS playback/scrubbing.
   */
  public refineAndDefringeCutout(
    rgba: Uint8ClampedArray,
    maskRgba: Uint8ClampedArray,
    width: number,
    height: number,
    radius = 6,
    eps = 1e-4,
    subsample = 1,
  ): boolean {
    const inst = this.wasmInstance;
    const totalPixels = width * height;
    const totalBytes = totalPixels * 4;
    if (
      this.backendType !== "web_wasm" ||
      !inst?.fastart_guided_composite_defringe_c ||
      !inst.memory ||
      rgba.length < totalBytes ||
      maskRgba.length < totalBytes
    ) {
      return false;
    }

    try {
      const useScratch = typeof inst.fastart_get_scratchpad === "function";
      let rgbaPtr = 0;
      let maskPtr = 0;
      if (useScratch) {
        const base = inst.fastart_get_scratchpad!(totalBytes * 2);
        if (base) {
          rgbaPtr = base;
          maskPtr = base + totalBytes;
        }
      } else if (inst.fastart_alloc && inst.fastart_dealloc) {
        rgbaPtr = inst.fastart_alloc(totalBytes);
        maskPtr = inst.fastart_alloc(totalBytes);
      }

      if (!rgbaPtr || !maskPtr) {
        if (!useScratch && inst.fastart_dealloc) {
          if (rgbaPtr) inst.fastart_dealloc(rgbaPtr, totalBytes);
          if (maskPtr) inst.fastart_dealloc(maskPtr, totalBytes);
        }
        return false;
      }

      new Uint8Array(inst.memory.buffer, rgbaPtr, totalBytes).set(rgba);
      new Uint8Array(inst.memory.buffer, maskPtr, totalBytes).set(maskRgba);

      inst.fastart_guided_composite_defringe_c(
        rgbaPtr,
        maskPtr,
        width,
        height,
        radius,
        eps,
        subsample,
      );

      rgba.set(new Uint8Array(inst.memory.buffer, rgbaPtr, totalBytes));

      if (!useScratch && inst.fastart_dealloc) {
        inst.fastart_dealloc(rgbaPtr, totalBytes);
        inst.fastart_dealloc(maskPtr, totalBytes);
      }
      return true;
    } catch (e) {
      console.warn("[RustCoreBridge] refineAndDefringeCutout error:", e);
      return false;
    }
  }

  /** Runs a cutout pixel buffer through the active native Rust or WASM backend. */
  public async processChromaCutoutFrame(
    pixels: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    keyHex: string,
    threshold: number,
    feather: number,
    despill = true,
  ): Promise<Uint8Array> {
    await this.init();
    if (width < 1 || height < 1 || pixels.length !== width * height * 4) {
      throw new Error("Invalid RGBA frame for Rust chroma cutout");
    }

    if (this.backendType === "android_native" || this.backendType === "ios_native") {
      if (!FastArtRust || typeof FastArtRust.processChromaCutout !== "function") {
        throw new Error("Rust chroma cutout is not exposed by the native module");
      }
      const hex = keyHex.replace(/^#/, "");
      const rgb = parseInt(hex.slice(0, 6), 16) || 0;
      const result = await FastArtRust.processChromaCutout(
        encodeNativeBytes(pixels), width, height, rgb, threshold, feather, despill,
      );
      if (typeof result !== "string") {
        throw new Error("Rust chroma cutout returned an invalid frame");
      }
      const decoded = decodeBase64ToUint8(result);
      if (decoded.length !== pixels.length) throw new Error("Rust chroma cutout returned an invalid frame");
      return decoded;
    }

    if (this.backendType === "web_wasm") {
      const output = new Uint8Array(pixels);
      if (!this.processChromaCutout(new Uint8ClampedArray(output.buffer), width, height, keyHex, threshold, feather, despill)) {
        throw new Error("Rust WASM chroma cutout failed");
      }
      return output;
    }

    throw new Error("Rust core is unavailable; chroma cutout requires Rust");
  }

  /** Generate preview transform samples with the active Rust backend. */
  public async generateAnimationKeyframes(
    preset: string,
    category: "in" | "out" | "loop" | "combo",
    frameCount = 24,
  ): Promise<AnimationKeyframe[]> {
    await this.init();
    const count = Math.max(2, Math.min(240, Math.floor(frameCount)));

    if (this.backendType === "android_native" || this.backendType === "ios_native") {
      if (!FastArtRust || typeof FastArtRust.generateAnimationKeyframes !== "function") {
        throw new Error("Rust animation keyframe generation is not exposed by the native module");
      }
      const response = await FastArtRust.generateAnimationKeyframes(preset, category, count);
      const parsed = typeof response === "string" ? JSON.parse(response) : response;
      if (!Array.isArray(parsed?.frames) || parsed.frames.length !== count) {
        throw new Error("Native Rust returned invalid animation keyframes");
      }
      return parsed.frames as AnimationKeyframe[];
    }

    if (this.backendType === "web_wasm" && this.wasmInstance) {
      const inst = this.wasmInstance;
      const generate = inst.fastart_generate_animation_keyframes_c;
      if (typeof generate !== "function") {
        throw new Error("Rust WASM animation keyframe generation is not exported");
      }

      const encoder = new TextEncoder();
      const presetBytes = encoder.encode(preset);
      const categoryBytes = encoder.encode(category);
      const outputCount = count * 6;
      const outputBytes = outputCount * Float32Array.BYTES_PER_ELEMENT;
      const presetPtr = inst.fastart_alloc(presetBytes.length);
      const categoryPtr = inst.fastart_alloc(categoryBytes.length);
      const outputPtr = inst.fastart_alloc(outputBytes);
      if (!presetPtr || !categoryPtr || !outputPtr) {
        if (presetPtr) inst.fastart_dealloc(presetPtr, presetBytes.length);
        if (categoryPtr) inst.fastart_dealloc(categoryPtr, categoryBytes.length);
        if (outputPtr) inst.fastart_dealloc(outputPtr, outputBytes);
        throw new Error("Rust WASM could not allocate animation keyframe memory");
      }

      try {
        new Uint8Array(inst.memory.buffer, presetPtr, presetBytes.length).set(presetBytes);
        new Uint8Array(inst.memory.buffer, categoryPtr, categoryBytes.length).set(categoryBytes);
        const written = generate(
          presetPtr,
          presetBytes.length,
          categoryPtr,
          categoryBytes.length,
          count,
          outputPtr,
        );
        if (written !== outputCount) {
          throw new Error("Rust WASM returned invalid animation keyframes");
        }
        const flat = new Float32Array(inst.memory.buffer, outputPtr, written).slice();
        return Array.from({ length: count }, (_, index) =>
          Array.from(flat.subarray(index * 6, index * 6 + 6)) as unknown as AnimationKeyframe,
        );
      } finally {
        inst.fastart_dealloc(presetPtr, presetBytes.length);
        inst.fastart_dealloc(categoryPtr, categoryBytes.length);
        inst.fastart_dealloc(outputPtr, outputBytes);
      }
    }

    throw new Error("Rust core is unavailable; animation preview requires Rust");
  }

  /**
   * O(N) Guided Filter Alpha Matting (backgroundremover inspired) in Rust/WASM
   * Refines a coarse mask using RGB guide edges to extract fine hair/fur and eliminate dark halos
   */
  public refineAlphaMatte(
    guideRgba: Uint8ClampedArray,
    mask: Uint8Array,
    width: number,
    height: number,
    radius = 4,
    eps = 1e-4
  ): Uint8Array | null {
    const inst = this.wasmInstance;
    if (!inst) return null;

    try {
      const totalPixels = width * height;
      const guideBytes = totalPixels * 4;
      const totalNeeded = guideBytes + totalPixels * 2;

      let guidePtr = 0;
      let maskPtr = 0;
      let outPtr = 0;
      let isScratch = false;

      if (inst.fastart_get_scratchpad) {
        const scratchPtr = inst.fastart_get_scratchpad(totalNeeded);
        if (scratchPtr) {
          isScratch = true;
          guidePtr = scratchPtr;
          maskPtr = guidePtr + guideBytes;
          outPtr = maskPtr + totalPixels;
        }
      }

      if (!isScratch) {
        guidePtr = inst.fastart_alloc(guideBytes);
        maskPtr = inst.fastart_alloc(totalPixels);
        outPtr = inst.fastart_alloc(totalPixels);
      }

      if (!guidePtr || !maskPtr || !outPtr) {
        if (!isScratch) {
          if (guidePtr) inst.fastart_dealloc(guidePtr, guideBytes);
          if (maskPtr) inst.fastart_dealloc(maskPtr, totalPixels);
          if (outPtr) inst.fastart_dealloc(outPtr, totalPixels);
        }
        return null;
      }

      new Uint8Array(inst.memory.buffer, guidePtr, guideBytes).set(guideRgba);
      new Uint8Array(inst.memory.buffer, maskPtr, totalPixels).set(mask);

      inst.fastart_guided_filter_matting_c(
        guidePtr,
        maskPtr,
        outPtr,
        width,
        height,
        radius,
        eps
      );

      const refined = new Uint8Array(
        new Uint8Array(inst.memory.buffer, outPtr, totalPixels)
      );

      if (!isScratch) {
        inst.fastart_dealloc(guidePtr, guideBytes);
        inst.fastart_dealloc(maskPtr, totalPixels);
        inst.fastart_dealloc(outPtr, totalPixels);
      }

      return refined;
    } catch (err) {
      console.warn("[RustCoreBridge] refineAlphaMatte error:", err);
      return null;
    }
  }

  /**
   * Applies refined alpha matte to RGBA pixel buffer in Rust/WASM
   */
  public applyMatte(
    pixels: Uint8ClampedArray,
    mask: Uint8Array,
    width: number,
    height: number,
    threshold = 0.5,
    feather = 0.1
  ): boolean {
    const inst = this.wasmInstance;
    if (!inst) return false;

    try {
      const totalPixels = width * height;
      const pixelsBytes = totalPixels * 4;
      const totalNeeded = pixelsBytes + totalPixels;

      let pixelsPtr = 0;
      let maskPtr = 0;
      let isScratch = false;

      if (inst.fastart_get_scratchpad) {
        const scratchPtr = inst.fastart_get_scratchpad(totalNeeded);
        if (scratchPtr) {
          isScratch = true;
          pixelsPtr = scratchPtr;
          maskPtr = pixelsPtr + pixelsBytes;
        }
      }

      if (!isScratch) {
        pixelsPtr = inst.fastart_alloc(pixelsBytes);
        maskPtr = inst.fastart_alloc(totalPixels);
      }

      if (!pixelsPtr || !maskPtr) {
        if (!isScratch) {
          if (pixelsPtr) inst.fastart_dealloc(pixelsPtr, pixelsBytes);
          if (maskPtr) inst.fastart_dealloc(maskPtr, totalPixels);
        }
        return false;
      }

      new Uint8Array(inst.memory.buffer, pixelsPtr, pixelsBytes).set(pixels);
      new Uint8Array(inst.memory.buffer, maskPtr, totalPixels).set(mask);

      inst.fastart_apply_matte_c(
        pixelsPtr,
        maskPtr,
        width,
        height,
        threshold,
        feather
      );

      pixels.set(new Uint8Array(inst.memory.buffer, pixelsPtr, pixelsBytes));

      if (!isScratch) {
        inst.fastart_dealloc(pixelsPtr, pixelsBytes);
        inst.fastart_dealloc(maskPtr, totalPixels);
      }
      return true;
    } catch (err) {
      console.warn("[RustCoreBridge] applyMatte error:", err);
      return false;
    }
  }

  /**
   * Detects uniform studio/screen backdrop color in Rust/WASM
   */
  public detectUniformBackdrop(
    pixels: Uint8ClampedArray,
    width: number,
    height: number
  ): { r: number; g: number; b: number; hex: string } | null {
    const inst = this.wasmInstance;
    if (!inst) return null;

    try {
      const totalBytes = width * height * 4;
      const totalNeeded = totalBytes + 4;

      let pixelsPtr = 0;
      let outRPtr = 0;
      let outGPtr = 0;
      let outBPtr = 0;
      let isScratch = false;

      if (inst.fastart_get_scratchpad) {
        const scratchPtr = inst.fastart_get_scratchpad(totalNeeded);
        if (scratchPtr) {
          isScratch = true;
          pixelsPtr = scratchPtr;
          outRPtr = pixelsPtr + totalBytes;
          outGPtr = outRPtr + 1;
          outBPtr = outGPtr + 1;
        }
      }

      if (!isScratch) {
        pixelsPtr = inst.fastart_alloc(totalBytes);
        outRPtr = inst.fastart_alloc(1);
        outGPtr = inst.fastart_alloc(1);
        outBPtr = inst.fastart_alloc(1);
      }

      if (!pixelsPtr || !outRPtr || !outGPtr || !outBPtr) {
        if (!isScratch) {
          if (pixelsPtr) inst.fastart_dealloc(pixelsPtr, totalBytes);
          if (outRPtr) inst.fastart_dealloc(outRPtr, 1);
          if (outGPtr) inst.fastart_dealloc(outGPtr, 1);
          if (outBPtr) inst.fastart_dealloc(outBPtr, 1);
        }
        return null;
      }

      new Uint8Array(inst.memory.buffer, pixelsPtr, totalBytes).set(pixels);

      const found = inst.fastart_detect_uniform_backdrop_c(
        pixelsPtr,
        width,
        height,
        outRPtr,
        outGPtr,
        outBPtr
      );

      let result: { r: number; g: number; b: number; hex: string } | null = null;
      if (found === 1) {
        const mem = new Uint8Array(inst.memory.buffer);
        const r = mem[outRPtr];
        const g = mem[outGPtr];
        const b = mem[outBPtr];
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
        result = { r, g, b, hex };
      }

      if (!isScratch) {
        inst.fastart_dealloc(pixelsPtr, totalBytes);
        inst.fastart_dealloc(outRPtr, 1);
        inst.fastart_dealloc(outGPtr, 1);
        inst.fastart_dealloc(outBPtr, 1);
      }

      return result;
    } catch (err) {
      console.warn("[RustCoreBridge] detectUniformBackdrop error:", err);
      return null;
    }
  }

  /**
   * High-Performance Studio Cutout & Background Removal Engine
   * Powered by native Rust/WASM with Rec. 709 perceptual color distance,
   * smooth Hermite S-curve interpolation, and despill edge suppression.
   */
  public renderCutout(
    ctx: CanvasRenderingContext2D,
    media: TexImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    options: CutoutConfig,
    offCanvas: HTMLCanvasElement,
    offCtx: CanvasRenderingContext2D
  ): boolean {
    if (options.bgColor && options.bgColor !== "none" && options.bgColor !== "transparent") {
      ctx.save();
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(dx, dy, dw, dh);
      ctx.restore();
    }

    try {
      const isScrubbing = (options as any).isScrubbing === true;
      const isPlaying = Boolean((options as any).isPlaying);
      let currentScaleX = 1;
      let currentScaleY = 1;
      try {
        const xform = ctx.getTransform();
        currentScaleX = Math.max(1, Math.hypot(xform.a, xform.b));
        currentScaleY = Math.max(1, Math.hypot(xform.c, xform.d));
      } catch {
        const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        currentScaleX = dpr;
        currentScaleY = dpr;
      }

      // GPU-accelerated compositing during playback/scrubbing keeps 60 FPS fluid even in fullscreen;
      // settled paused frames and exports run full RGB-guided matting & edge defringing.
      const isExporting = Boolean((options as any).isExporting);
      const isInteractive = (isScrubbing || isPlaying) && !isExporting;
      const isMobileWeb =
        typeof navigator !== "undefined" &&
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
      const maxDim = isExporting
        ? (isMobileWeb ? (options.mode === "auto" ? 960 : 720) : 3840)
        : isScrubbing
        ? 720
        : isInteractive
        ? 960
        : 1280;
      const scaleDown = 1.0;
      const targetProcW = Math.round(Math.abs(dw) * (scaleDown * currentScaleX));
      const targetProcH = Math.round(Math.abs(dh) * (scaleDown * currentScaleY));
      const procW = Math.max(16, Math.min(maxDim, targetProcW));
      const procH = Math.max(16, Math.min(maxDim, targetProcH));

      if (offCanvas.width !== procW || offCanvas.height !== procH) {
        offCanvas.width = procW;
        offCanvas.height = procH;
      }

      offCtx.clearRect(0, 0, procW, procH);
      offCtx.drawImage(media as any, sx, sy, sw, sh, 0, 0, procW, procH);

      const isAuto = options.mode === "auto";

      if (isAuto) {
        const fallbackId = (options as any).sourceMediaId;
        const sourceTime = (options as any).sourceTime;
        const clipReverse = Boolean((options as any).clipReverse);

        const hasReadyVideoTime =
          typeof HTMLVideoElement !== "undefined" &&
          media instanceof HTMLVideoElement &&
          media.readyState >= 2 &&
          Number.isFinite(media.currentTime) &&
          media.currentTime >= 0;

        if (hasReadyVideoTime && !media.seeking) {
          lastDecodedVideoTimeMap?.set(media, media.currentTime);
          (media as any)._lastDecodedTime = media.currentTime;
        }

        // Exact timestamp of the decoded frame currently drawn by drawImage(media).
        // Whenever !isExporting and a video is attached, always lock mask lookup to this
        // decoded frame timestamp (even when paused & seeking!) so the cutout never jumps ahead of video.
        const displayedVideoTime = hasReadyVideoTime
          ? (!media.seeking
              ? media.currentTime
              : (lastDecodedVideoTimeMap?.get(media) ?? (media as any)._lastDecodedTime))
          : undefined;

        const effectiveSourceTime =
          !isExporting && displayedVideoTime !== undefined
            ? displayedVideoTime
            : sourceTime !== undefined && Number.isFinite(sourceTime)
            ? sourceTime
            : displayedVideoTime !== undefined
            ? displayedVideoTime
            : hasReadyVideoTime
            ? media.currentTime
            : 0;

        const sourceDelta =
          displayedVideoTime !== undefined && sourceTime !== undefined && Number.isFinite(sourceTime)
            ? displayedVideoTime - sourceTime
            : 0;
        const actualClipTime =
          options.clipTime !== undefined
            ? (!isExporting && displayedVideoTime !== undefined && sourceTime !== undefined && Number.isFinite(sourceTime)
                ? Math.max(0, options.clipTime + (clipReverse ? -sourceDelta : sourceDelta))
                : Math.max(0, options.clipTime))
            : effectiveSourceTime;

        const clipFps = (options as any).fps || (options as any).sourceFrameRate;
        const isImage =
          Boolean((options as any).isImage) ||
          (typeof HTMLImageElement !== "undefined" && media instanceof HTMLImageElement);

        let humanMask =
          options.clipId && activeMaskProvider
            ? activeMaskProvider.getFrameMask(options.clipId, actualClipTime, clipFps, fallbackId, effectiveSourceTime, isImage)
            : null;

        if (!humanMask && fallbackId && activeMaskProvider) {
          humanMask = activeMaskProvider.getFrameMask(fallbackId, actualClipTime, clipFps, undefined, effectiveSourceTime, isImage);
        }

        if (!humanMask && activeMaskProvider) {
          humanMask = activeMaskProvider.getHumanSegmentationMask(options.clipId, actualClipTime, fallbackId, effectiveSourceTime, isImage);
          if (!humanMask && fallbackId) {
            humanMask = activeMaskProvider.getHumanSegmentationMask(fallbackId, effectiveSourceTime, undefined, undefined, isImage);
          }
        }

        const effectiveFps = clipFps || 30;
        const currentSrcFrameIdx = Math.max(0, Math.round(effectiveSourceTime * effectiveFps));
        const effectiveId = options.clipId || fallbackId;
        const hasExactMask =
          effectiveId && activeMaskProvider?.hasFrameMask
            ? activeMaskProvider.hasFrameMask(effectiveId, currentSrcFrameIdx, true)
            : false;
        const bakedCount =
          (options.clipId && activeMaskProvider?.getClipProcessedCount
            ? activeMaskProvider.getClipProcessedCount(options.clipId)
            : 0) +
          (fallbackId && activeMaskProvider?.getClipProcessedCount
            ? activeMaskProvider.getClipProcessedCount(fallbackId)
            : 0);
        const hasAnyMaskEntries =
          Boolean(options.clipId && activeMaskProvider?.hasClipMasks?.(options.clipId)) ||
          Boolean(fallbackId && activeMaskProvider?.hasClipMasks?.(fallbackId));
        const hasBakedMasks = isImage
          ? hasAnyMaskEntries
          : bakedCount > 1;

        if (humanMask) {
          if (!(humanMask as any)._isTemporalBlend) {
            if (options.clipId) {
              clipLastKnownMaskMap.set(options.clipId, humanMask);
            }
            if (fallbackId) {
              clipLastKnownMaskMap.set(fallbackId, humanMask);
            }
          }
          if (options.clipId) {
            clipLastKnownMaskTimeMap.set(options.clipId, effectiveSourceTime);
          }
          if (fallbackId) {
            clipLastKnownMaskTimeMap.set(fallbackId, effectiveSourceTime);
          }
        } else {
          // Continuous temporal hold: smoothly bridge frame gaps without flashing raw background
          const held =
            (options.clipId ? clipLastKnownMaskMap.get(options.clipId) : null) ||
            (fallbackId ? clipLastKnownMaskMap.get(fallbackId) : null);
          const heldTime =
            (options.clipId ? clipLastKnownMaskTimeMap.get(options.clipId) : undefined) ??
            (fallbackId ? clipLastKnownMaskTimeMap.get(fallbackId) : undefined);
          if (held && heldTime !== undefined && Math.abs(effectiveSourceTime - heldTime) <= 0.08) {
            humanMask = held;
          }
        }

        if (!humanMask && activeMaskProvider) {
          // Anchor start of clip or photo to frame 0 or any available mask for this clip
          const clipHasMasks =
            Boolean(options.clipId && activeMaskProvider.hasClipMasks?.(options.clipId)) ||
            Boolean(fallbackId && activeMaskProvider.hasClipMasks?.(fallbackId));
          if (clipHasMasks && (isImage || (!isPlaying && effectiveSourceTime < 0.25))) {
            humanMask =
              (options.clipId ? activeMaskProvider.getFrameMask(options.clipId, 0, clipFps, fallbackId, 0, isImage) : null) ||
              (fallbackId ? activeMaskProvider.getFrameMask(fallbackId, 0, clipFps, undefined, 0, isImage) : null);
            if (humanMask) {
              if (options.clipId) clipLastKnownMaskMap.set(options.clipId, humanMask);
              if (fallbackId) clipLastKnownMaskMap.set(fallbackId, humanMask);
            }
          }
        }

        // Stream inference for unbaked frames during interactive playback (never during export or when clip is already baked)
        if (
          !hasBakedMasks &&
          !hasExactMask &&
          !isScrubbing &&
          !(options as any)?.isExporting &&
          activeMaskProvider?.requestHumanSegmentation
        ) {
          activeMaskProvider.requestHumanSegmentation(media as any, options.clipId, actualClipTime);
        }

        if (humanMask) {
          const mediaW =
            (media as any).videoWidth || (media as any).naturalWidth || (media as any).width || sw;
          const mediaH =
            (media as any).videoHeight || (media as any).naturalHeight || (media as any).height || sh;

          // If humanMask is still an uncropped 512x512 neural buffer, dynamically slice
          // the letterboxed/pillarboxed active content area so it perfectly matches the media aspect ratio!
          let maskCropX = 0;
          let maskCropY = 0;
          let maskCropW = humanMask.width;
          let maskCropH = humanMask.height;

          if (
            humanMask.width === 512 &&
            humanMask.height === 512 &&
            mediaW > 0 &&
            mediaH > 0 &&
            Math.abs(mediaW - mediaH) > 2
          ) {
            const aspect = mediaW / mediaH;
            if (aspect >= 1.0) {
              maskCropH = Math.max(128, Math.min(512, Math.round(512 / aspect)));
              maskCropY = Math.floor((512 - maskCropH) / 2);
            } else {
              maskCropW = Math.max(128, Math.min(512, Math.round(512 * aspect)));
              maskCropX = Math.floor((512 - maskCropW) / 2);
            }
          }

          const scaleX = maskCropW / Math.max(1, mediaW);
          const scaleY = maskCropH / Math.max(1, mediaH);
          const mSx = maskCropX + sx * scaleX;
          const mSy = maskCropY + sy * scaleY;
          const mSw = sw * scaleX;
          const mSh = sh * scaleY;

          let refinedWithGuided = false;

          // Run Studio RGB-Guided Edge Snapping + Edge Color Decontamination on settled frames and exports.
          // Skip synchronous GPU->CPU readback during interactive playback/scrubbing so fullscreen stays 60 FPS.
          if ((!isInteractive || isExporting) && typeof document !== "undefined") {
            try {
              if (!guidedMaskScratchCanvas) {
                guidedMaskScratchCanvas = document.createElement("canvas");
                guidedMaskScratchCtx = guidedMaskScratchCanvas.getContext("2d", { willReadFrequently: true });
              }
              if (guidedMaskScratchCanvas.width !== procW || guidedMaskScratchCanvas.height !== procH) {
                guidedMaskScratchCanvas.width = procW;
                guidedMaskScratchCanvas.height = procH;
              }
              if (guidedMaskScratchCtx) {
                guidedMaskScratchCtx.clearRect(0, 0, procW, procH);
                guidedMaskScratchCtx.imageSmoothingEnabled = true;
                guidedMaskScratchCtx.imageSmoothingQuality = "high";
                guidedMaskScratchCtx.drawImage(humanMask, mSx, mSy, mSw, mSh, 0, 0, procW, procH);

                const maskImgData = guidedMaskScratchCtx.getImageData(0, 0, procW, procH);
                const guideImgData = offCtx.getImageData(0, 0, procW, procH);
                const guidedRadius = Math.max(5, Math.min(10, Math.round(Math.max(procW, procH) / 200)));
                const guidedSubsample = !isExporting && (procW * procH > 450_000 || isMobileWeb) ? 2 : 1;

                if (
                  this.refineAndDefringeCutout(
                    guideImgData.data,
                    maskImgData.data,
                    procW,
                    procH,
                    guidedRadius,
                    1e-4,
                    guidedSubsample,
                  )
                ) {
                  offCtx.putImageData(guideImgData, 0, 0);
                  refinedWithGuided = true;
                } else {
                  const totalPixels = procW * procH;
                  if (!guidedInputMaskBuffer || guidedInputMaskBuffer.length !== totalPixels) {
                    guidedInputMaskBuffer = new Uint8Array(totalPixels);
                    guidedOutputMaskBuffer = new Uint8Array(totalPixels);
                  }
                  for (let i = 0; i < totalPixels; i++) {
                    guidedInputMaskBuffer[i] = maskImgData.data[i * 4 + 3];
                  }
                  if (
                    guidedOutputMaskBuffer &&
                    this.refineMatteGuided(
                      guideImgData.data,
                      guidedInputMaskBuffer,
                      guidedOutputMaskBuffer,
                      procW,
                      procH,
                      guidedRadius,
                      1e-4,
                    )
                  ) {
                    for (let i = 0; i < totalPixels; i++) {
                      guideImgData.data[i * 4 + 3] = guidedOutputMaskBuffer[i];
                    }
                    this.defringeCutoutEdges(guideImgData.data, procW, procH);
                    offCtx.putImageData(guideImgData, 0, 0);
                    refinedWithGuided = true;
                  }
                }
              }
            } catch (err) {
              console.warn("[RustCoreBridge] Guided filter edge refinement fallback:", err);
            }
          }

          if (!refinedWithGuided) {
            // Hardware GPU-accelerated alpha compositing (zero readback stall for 60 FPS playback & fullscreen)
            offCtx.save();
            offCtx.imageSmoothingEnabled = true;
            offCtx.imageSmoothingQuality = "high";
            offCtx.globalCompositeOperation = "destination-in";
            offCtx.drawImage(humanMask, mSx, mSy, mSw, mSh, 0, 0, procW, procH);
            offCtx.restore();

            if (!isInteractive || isExporting) {
              const imgData = offCtx.getImageData(0, 0, procW, procH);
              this.defringeCutoutEdges(imgData.data, procW, procH);
              offCtx.putImageData(imgData, 0, 0);
            }
          }
        }
      } else {
        // Chroma Key mode in native Rust WASM
        const imgData = offCtx.getImageData(0, 0, procW, procH);
        const hex = options.keyColor || "#00FF00";
        const thresh = Math.max(0.01, Math.min(1.0, (options.intensity ?? 45) / 100));
        const feather = Math.max(0.01, Math.min(1.0, (options.shadow ?? 25) / 100));

        this.processChromaCutout(
          imgData.data,
          procW,
          procH,
          hex,
          thresh,
          feather,
          true
        );
        offCtx.putImageData(imgData, 0, 0);
      }

      // Background color backdrop if configured
      if (options.bgColor && options.bgColor !== "none" && options.bgColor !== "transparent") {
        ctx.save();
        ctx.fillStyle = options.bgColor;
        ctx.fillRect(dx, dy, dw, dh);
        ctx.restore();
      }

      // Crisp perimeter outline (stroke) dilated close to the cutout subject
      if (options.strokeColor && options.strokeColor !== "none" && options.strokeWidth && options.strokeWidth > 0) {
        if (!internalStrokeCanvas && typeof document !== "undefined") {
          internalStrokeCanvas = document.createElement("canvas");
          internalStrokeCtx = internalStrokeCanvas.getContext("2d");
        }
        if (!internalStrokeDilatedCanvas && typeof document !== "undefined") {
          internalStrokeDilatedCanvas = document.createElement("canvas");
          internalStrokeDilatedCtx = internalStrokeDilatedCanvas.getContext("2d");
        }
        if (internalStrokeCanvas && internalStrokeCtx && internalStrokeDilatedCanvas && internalStrokeDilatedCtx) {
          if (internalStrokeCanvas.width !== procW || internalStrokeCanvas.height !== procH) {
            internalStrokeCanvas.width = procW;
            internalStrokeCanvas.height = procH;
          }
          if (internalStrokeDilatedCanvas.width !== procW || internalStrokeDilatedCanvas.height !== procH) {
            internalStrokeDilatedCanvas.width = procW;
            internalStrokeDilatedCanvas.height = procH;
          }

          // 1. Create solid color silhouette from offCanvas in local (procW, procH) coordinates
          internalStrokeCtx.clearRect(0, 0, procW, procH);
          internalStrokeCtx.drawImage(offCanvas, 0, 0);
          internalStrokeCtx.globalCompositeOperation = "source-in";
          internalStrokeCtx.fillStyle = options.strokeColor;
          internalStrokeCtx.fillRect(0, 0, procW, procH);
          internalStrokeCtx.globalCompositeOperation = "source-over";

          const strokeW = Math.max(1, Math.min(24, options.strokeWidth));
          const isGlow = options.strokeStyle === "glow";
          const isDotted = options.strokeStyle === "dotted";

          internalStrokeDilatedCtx.clearRect(0, 0, procW, procH);

          let renderedDottedPath = false;

          if (isDotted) {
            // Extract contour in local coordinates to stroke dashes along the exact curve
            const gridW = 480;
            const gridH = Math.max(1, Math.round((procH / procW) * gridW));

            if (!internalContourScanCanvas && typeof document !== "undefined") {
              internalContourScanCanvas = document.createElement("canvas");
              internalContourScanCtx = internalContourScanCanvas.getContext("2d", { willReadFrequently: true });
            }

            if (internalContourScanCanvas && internalContourScanCtx) {
              if (internalContourScanCanvas.width !== gridW || internalContourScanCanvas.height !== gridH) {
                internalContourScanCanvas.width = gridW;
                internalContourScanCanvas.height = gridH;
              }

              internalContourScanCtx.clearRect(0, 0, gridW, gridH);
              internalContourScanCtx.drawImage(offCanvas, 0, 0, gridW, gridH);
              const imgData = internalContourScanCtx.getImageData(0, 0, gridW, gridH);
              const contours = extractContoursMarchingSquaresFast(imgData.data, gridW, gridH, 64);

              if (contours.length > 0) {
                internalStrokeDilatedCtx.save();
                internalStrokeDilatedCtx.strokeStyle = options.strokeColor;

                // Scale line width so it stays crisp and prominent at any resolution
                const baseScale = procW / 720;
                const targetLineWidth = Math.max(3, Math.round(strokeW * 1.8 * Math.max(0.7, Math.min(2.5, baseScale))));
                internalStrokeDilatedCtx.lineWidth = targetLineWidth;
                internalStrokeDilatedCtx.lineCap = "round";
                internalStrokeDilatedCtx.lineJoin = "round";

                // Cleanly separated rounded pill dashes (caps add targetLineWidth to dash length)
                const dashLen = Math.max(12, Math.round(targetLineWidth * 1.8));
                const gapLen = Math.max(16, Math.round(targetLineWidth * 2.6));
                internalStrokeDilatedCtx.setLineDash([dashLen, gapLen]);

                for (const contour of contours) {
                  const smoothed = smoothContourPoints(contour.pts, contour.isClosed, 3);
                  const n = smoothed.length;
                  if (n < 6) continue;

                  const path = new Path2D();
                  const p0x = ((smoothed[0].x + smoothed[1].x) * 0.5 / gridW) * procW;
                  const p0y = ((smoothed[0].y + smoothed[1].y) * 0.5 / gridH) * procH;
                  path.moveTo(p0x, p0y);

                  const stride = n > 600 ? 3 : (n > 150 ? 2 : 1);
                  for (let i = 1; i < n; i += stride) {
                    const curr = smoothed[i];
                    const next = contour.isClosed
                      ? smoothed[(i + stride) % n]
                      : smoothed[Math.min(n - 1, i + stride)];
                    const cpX = (curr.x / gridW) * procW;
                    const cpY = (curr.y / gridH) * procH;
                    const endX = ((curr.x + next.x) * 0.5 / gridW) * procW;
                    const endY = ((curr.y + next.y) * 0.5 / gridH) * procH;
                    path.quadraticCurveTo(cpX, cpY, endX, endY);
                  }

                  if (contour.isClosed) {
                    path.closePath();
                  } else {
                    const last = smoothed[n - 1];
                    path.lineTo((last.x / gridW) * procW, (last.y / gridH) * procH);
                  }

                  internalStrokeDilatedCtx.stroke(path);
                }

                // Clear bottom scan-boundary pixels where frame clipping occurred so no artificial horizontal border line appears
                internalStrokeDilatedCtx.clearRect(0, procH - Math.ceil(targetLineWidth * 0.7), procW, Math.ceil(targetLineWidth * 0.7) + 2);

                internalStrokeDilatedCtx.restore();
                renderedDottedPath = true;
              }
            }
          }

          // Fallback or solid/glow mode: smooth 16-step perimeter dilation close to cutout
          if (!renderedDottedPath) {
            const numSteps = 16;
            for (let i = 0; i < numSteps; i++) {
              const angle = (i * 2 * Math.PI) / numSteps;
              const ox = Math.round(Math.cos(angle) * strokeW);
              const oy = Math.round(Math.sin(angle) * strokeW);
              internalStrokeDilatedCtx.drawImage(internalStrokeCanvas, ox, oy);
            }

            internalStrokeDilatedCtx.globalCompositeOperation = "destination-out";
            internalStrokeDilatedCtx.drawImage(offCanvas, 0, 0);
            internalStrokeDilatedCtx.globalCompositeOperation = "source-over";
          }

          // 3. Draw the local perimeter outline to destination context using exact same bounds as offCanvas
          ctx.save();
          if (isGlow) {
            ctx.shadowColor = options.strokeColor;
            ctx.shadowBlur = strokeW * 3;
          }
          ctx.drawImage(internalStrokeDilatedCanvas, 0, 0, procW, procH, dx, dy, dw, dh);
          ctx.restore();
        }
      }

      // Draw the actual cut-out subject ON TOP of the dilated outline
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(offCanvas, 0, 0, procW, procH, dx, dy, dw, dh);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Evaluates multi-point Bezier / Hermite speed curves directly in native Rust/WASM
   */
  public evaluateSpeedCurve(
    points: { t: number; s: number }[],
    progress: number
  ): number {
    const inst = this.wasmInstance;
    if (!points || points.length === 0) return 1.0;
    if (this.backendType !== "web_wasm" || !inst || typeof inst.fastart_evaluate_speed_curve_c !== "function") return 1.0;
    try {
      const count = points.length;
      const bytesPerDouble = 8;
      const tPtr = inst.fastart_alloc(count * bytesPerDouble);
      const sPtr = inst.fastart_alloc(count * bytesPerDouble);

      if (!tPtr || !sPtr) {
        if (tPtr) inst.fastart_dealloc(tPtr, count * bytesPerDouble);
        if (sPtr) inst.fastart_dealloc(sPtr, count * bytesPerDouble);
        return 1.0;
      }

      const mem = inst.memory.buffer;
      const tView = new Float64Array(mem, tPtr, count);
      const sView = new Float64Array(mem, sPtr, count);
      for (let i = 0; i < count; i++) {
        tView[i] = points[i].t;
        sView[i] = points[i].s;
      }

      const res = inst.fastart_evaluate_speed_curve_c(tPtr, sPtr, count, progress);

      inst.fastart_dealloc(tPtr, count * bytesPerDouble);
      inst.fastart_dealloc(sPtr, count * bytesPerDouble);
      return res;
    } catch {
      return 1.0;
    }
  }

  /**
   * Applies in-place color grading (brightness, contrast, saturation) in native Rust/WASM
   */
  public applyColorAdjustments(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    brightness: number,
    contrast: number,
    saturation: number
  ): boolean {
    const inst = this.wasmInstance;
    if (!inst) return false;

    try {
      const totalBytes = width * height * 4;
      let ptr = 0;
      let isScratch = false;
      if (typeof inst.fastart_get_scratchpad === "function") {
        ptr = inst.fastart_get_scratchpad(totalBytes);
        isScratch = ptr !== 0;
      }
      if (!ptr) ptr = inst.fastart_alloc(totalBytes);
      if (!ptr) return false;

      new Uint8Array(inst.memory.buffer, ptr, totalBytes).set(pixels);
      inst.fastart_apply_color_adjustments_c(ptr, width, height, brightness, contrast, saturation);
      pixels.set(new Uint8Array(inst.memory.buffer, ptr, totalBytes));
      if (!isScratch) inst.fastart_dealloc(ptr, totalBytes);
      return true;
    } catch {
      return false;
    }
  }

  /** Applies selective 8-channel HSL grading to RGBA pixels in Rust/WASM. */
  public applyHslColorGrading(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    adjustments: HSLAdjustments,
  ): boolean {
    const inst = this.wasmInstance;
    const apply = inst?.fastart_apply_hsl_color_grading_c;
    const totalBytes = width * height * 4;
    if (
      this.backendType !== "web_wasm" || !inst || !apply ||
      width <= 0 || height <= 0 || pixels.length !== totalBytes
    ) return false;

    const channels = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "magenta"] as const;
    const settings = new Float32Array(24);
    channels.forEach((channel, index) => {
      const value = adjustments[channel];
      settings[index * 3] = value?.hue ?? 0;
      settings[index * 3 + 1] = value?.saturation ?? 0;
      settings[index * 3 + 2] = value?.luminance ?? 0;
    });

    const settingsBytes = settings.byteLength;
    const totalScratchBytes = totalBytes + settingsBytes;
    const scratchAvailable = typeof inst.fastart_get_scratchpad === "function";
    let basePtr = scratchAvailable ? inst.fastart_get_scratchpad!(totalScratchBytes) : 0;
    const isScratch = basePtr !== 0;
    if (!basePtr) basePtr = inst.fastart_alloc(totalScratchBytes);
    if (!basePtr) return false;
    const settingsPtr = basePtr + totalBytes;
    try {
      new Uint8Array(inst.memory.buffer, basePtr, totalBytes).set(pixels);
      new Float32Array(inst.memory.buffer, settingsPtr, settings.length).set(settings);
      if (apply(basePtr, width, height, settingsPtr, settings.length) !== 1) return false;
      pixels.set(new Uint8Array(inst.memory.buffer, basePtr, totalBytes));
      return true;
    } catch {
      return false;
    } finally {
      if (!isScratch) inst.fastart_dealloc(basePtr, totalScratchBytes);
    }
  }

  /**
   * Applies in-place vignette falloff in native Rust/WASM
   */
  public applyVignette(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    intensity: number,
    radius: number
  ): boolean {
    const inst = this.wasmInstance;
    if (!inst) return false;

    try {
      const totalBytes = width * height * 4;
      let ptr = 0;
      let isScratch = false;
      if (typeof inst.fastart_get_scratchpad === "function") {
        ptr = inst.fastart_get_scratchpad(totalBytes);
        isScratch = ptr !== 0;
      }
      if (!ptr) ptr = inst.fastart_alloc(totalBytes);
      if (!ptr) return false;

      new Uint8Array(inst.memory.buffer, ptr, totalBytes).set(pixels);
      inst.fastart_apply_vignette_c(ptr, width, height, intensity, radius);
      pixels.set(new Uint8Array(inst.memory.buffer, ptr, totalBytes));
      if (!isScratch) inst.fastart_dealloc(ptr, totalBytes);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Converts MediaPipe segmentation confidence into a crisp alpha matte in native Rust/WASM
   * Operates directly in linear memory with Hermite S-curve contrast transfer and validation.
   */
  public processSegmentationMask(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
  ): { isValid: boolean; maxConfidence: number } {
    const inst = this.wasmInstance;
    const expected = width * height * 4;
    if (this.backendType !== "web_wasm" || !inst || pixels.length !== expected) {
      throw new Error("Rust WASM segmentation-mask processing is unavailable");
    }
    const ptr = inst.fastart_alloc(expected);
    if (!ptr) throw new Error("Rust WASM allocation failed for segmentation mask");
    try {
      new Uint8Array(inst.memory.buffer, ptr, expected).set(pixels);
      const packed = inst.fastart_process_segmentation_confidence_c(ptr, width, height);
      pixels.set(new Uint8Array(inst.memory.buffer, ptr, expected));
      return {
        isValid: (packed & 1) === 1,
        maxConfidence: (packed >> 8) & 0xff,
      };
    } finally {
      inst.fastart_dealloc(ptr, expected);
    }
  }

  /**
   * Prepares a 512x512 NCHW planar Float32 tensor for MODNet neural matting in native Rust/WASM
   * Replaces 786,432 JavaScript float operations with SIMD-vectorized native speed.
   */
  public prepareModnetInput(
    rgbaPixels: Uint8ClampedArray,
    width = 512,
    height = 512,
    outFloatBuffer?: Float32Array,
  ): Float32Array {
    const inst = this.wasmInstance;
    const floats = 512 * 512 * 3;
    const bytes = width * height * 4;
    const dest = outFloatBuffer?.length === floats ? outFloatBuffer : new Float32Array(floats);
    if (this.backendType !== "web_wasm" || !inst || !inst.fastart_prepare_modnet_input_c) {
      // Pure JS planar NCHW float tensor preparation fallback
      const gOffset = width * height;
      const bOffset = width * height * 2;
      const invScale = 1.0 / 127.5;
      const totalPixels = width * height;
      for (let i = 0; i < totalPixels; i++) {
        const srcIdx = i * 4;
        dest[i] = (rgbaPixels[srcIdx] - 127.5) * invScale;
        dest[gOffset + i] = (rgbaPixels[srcIdx + 1] - 127.5) * invScale;
        dest[bOffset + i] = (rgbaPixels[srcIdx + 2] - 127.5) * invScale;
      }
      return dest;
    }
    if (rgbaPixels.length !== bytes) throw new Error("Invalid RGBA input dimensions for MODNet");

    const outputBytes = floats * Float32Array.BYTES_PER_ELEMENT;
    const isScratch = typeof inst.fastart_get_scratchpad === "function";
    let rgbaPtr = 0;
    let tensorPtr = 0;
    try {
      if (isScratch) {
        rgbaPtr = inst.fastart_get_scratchpad!(bytes + outputBytes);
        tensorPtr = rgbaPtr + bytes;
      } else {
        rgbaPtr = inst.fastart_alloc(bytes);
        tensorPtr = inst.fastart_alloc(outputBytes);
      }
      if (!rgbaPtr || !tensorPtr) throw new Error("Rust WASM allocation failed");
      new Uint8Array(inst.memory.buffer, rgbaPtr, bytes).set(rgbaPixels);
      inst.fastart_prepare_modnet_input_c(rgbaPtr, width, height, tensorPtr);
      dest.set(new Float32Array(inst.memory.buffer, tensorPtr, floats));
      return dest;
    } finally {
      if (!isScratch) {
        if (rgbaPtr) inst.fastart_dealloc(rgbaPtr, bytes);
        if (tensorPtr) inst.fastart_dealloc(tensorPtr, outputBytes);
      }
    }
  }

  /**
   * Compresses an 8-bit alpha buffer using native Rust/WASM Run-Length Encoding.
   * Compresses 262 KB masks down to ~5-15 KB (95%+ reduction).
   */
  public packAlphaRLE(alpha: Uint8Array): Uint8Array {
    const inst = this.wasmInstance;
    if (this.backendType !== "web_wasm" || !inst?.fastart_pack_alpha_rle_c) {
      throw new Error("Rust WASM alpha compression is unavailable");
    }
    const inputLen = alpha.length;
    const outputCapacity = inputLen * 2;
    const isScratch = typeof inst.fastart_get_scratchpad === "function";
    let inputPtr = 0;
    let outputPtr = 0;
    try {
      if (isScratch) {
        inputPtr = inst.fastart_get_scratchpad!(inputLen + outputCapacity);
        outputPtr = inputPtr + inputLen;
      } else {
        inputPtr = inst.fastart_alloc(inputLen);
        outputPtr = inst.fastart_alloc(outputCapacity);
      }
      if (!inputPtr || !outputPtr) throw new Error("Rust WASM allocation failed");
      new Uint8Array(inst.memory.buffer, inputPtr, inputLen).set(alpha);
      const written = inst.fastart_pack_alpha_rle_c(inputPtr, inputLen, outputPtr, outputCapacity);
      if (written <= 0 || written > outputCapacity) throw new Error("Rust WASM alpha compression failed");
      return new Uint8Array(new Uint8Array(inst.memory.buffer, outputPtr, written));
    } finally {
      if (!isScratch) {
        if (inputPtr) inst.fastart_dealloc(inputPtr, inputLen);
        if (outputPtr) inst.fastart_dealloc(outputPtr, outputCapacity);
      }
    }
  }

  public async packAlphaRLEForPlatform(alpha: Uint8Array): Promise<Uint8Array> {
    await this.init();
    if (this.backendType === "web_wasm") return this.packAlphaRLE(alpha);
    if (this.backendType === "android_native" || this.backendType === "ios_native") {
      if (!FastArtRust || typeof FastArtRust.packAlphaRLE !== "function") {
        throw new Error("Rust alpha compression is not exposed by the native module");
      }
      const encoded = await FastArtRust.packAlphaRLE(encodeNativeBytes(alpha));
      if (typeof encoded !== "string" || encoded.length === 0) throw new Error("Native Rust alpha compression failed");
      return decodeBase64ToUint8(encoded);
    }
    throw new Error("Rust core is unavailable; alpha compression requires Rust");
  }

  public unpackAlphaRLE(rle: Uint8Array, outLen: number): Uint8Array {
    const inst = this.wasmInstance;
    if (this.backendType !== "web_wasm" || !inst?.fastart_unpack_alpha_rle_c) {
      throw new Error("Rust WASM alpha decompression is unavailable");
    }
    const output = new Uint8Array(outLen);
    const isScratch = typeof inst.fastart_get_scratchpad === "function";
    let inputPtr = 0;
    let outputPtr = 0;
    try {
      if (isScratch) {
        inputPtr = inst.fastart_get_scratchpad!(rle.length + outLen);
        outputPtr = inputPtr + rle.length;
      } else {
        inputPtr = inst.fastart_alloc(rle.length);
        outputPtr = inst.fastart_alloc(outLen);
      }
      if (!inputPtr || !outputPtr) throw new Error("Rust WASM allocation failed");
      new Uint8Array(inst.memory.buffer, inputPtr, rle.length).set(rle);
      const written = inst.fastart_unpack_alpha_rle_c(inputPtr, rle.length, outputPtr, outLen);
      if (written !== outLen) throw new Error("Rust WASM alpha decompression failed");
      output.set(new Uint8Array(inst.memory.buffer, outputPtr, outLen));
      return output;
    } finally {
      if (!isScratch) {
        if (inputPtr) inst.fastart_dealloc(inputPtr, rle.length);
        if (outputPtr) inst.fastart_dealloc(outputPtr, outLen);
      }
    }
  }

  /**
   * Decompresses an RLE mask directly into a 32-bit RGBA image buffer via native Rust/WASM.
   * Completely avoids intermediate 8-bit array allocations and eliminates JS pixel loops.
   */
  public unpackAlphaRLEToRGBA(rle: Uint8Array, outRgba: Uint8ClampedArray): boolean {
    const inst = this.wasmInstance;
    const outBytes = outRgba.length;
    if (this.backendType !== "web_wasm" || !inst) {
      // Deterministic JS RLE unpack fallback: zero intermediate allocations
      let pixelIdx = 0;
      const maxPixels = outBytes / 4;
      for (let i = 0; i + 1 < rle.length && pixelIdx < maxPixels; i += 2) {
        const count = rle[i];
        const val = rle[i + 1];
        const end = Math.min(maxPixels, pixelIdx + count);
        for (let p = pixelIdx; p < end; p++) {
          const idx = p * 4;
          outRgba[idx] = val;
          outRgba[idx + 1] = val;
          outRgba[idx + 2] = val;
          outRgba[idx + 3] = val;
        }
        pixelIdx = end;
      }
      return true;
    }
    const isScratch = typeof inst.fastart_get_scratchpad === "function";
    let inputPtr = 0;
    let outputPtr = 0;
    try {
      if (isScratch) {
        inputPtr = inst.fastart_get_scratchpad!(rle.length + outBytes);
        outputPtr = inputPtr + rle.length;
      } else {
        inputPtr = inst.fastart_alloc(rle.length);
        outputPtr = inst.fastart_alloc(outBytes);
      }
      if (!inputPtr || !outputPtr) throw new Error("Rust WASM allocation failed");
      new Uint8Array(inst.memory.buffer, inputPtr, rle.length).set(rle);
      if (inst.fastart_unpack_alpha_rle_rgba_c) {
        const written = inst.fastart_unpack_alpha_rle_rgba_c(inputPtr, rle.length, outputPtr, outBytes);
        if (written > 0) {
          outRgba.set(new Uint8Array(inst.memory.buffer, outputPtr, outBytes));
          return true;
        }
      }
      const pixels = outBytes / 4;
      const written = inst.fastart_unpack_alpha_rle_c?.(inputPtr, rle.length, outputPtr, pixels) ?? 0;
      if (written === pixels) {
        const alpha = new Uint8Array(inst.memory.buffer, outputPtr, pixels);
        for (let i = 0; i < pixels; i++) {
          const a = alpha[i];
          const idx = i * 4;
          outRgba[idx] = a;
          outRgba[idx + 1] = a;
          outRgba[idx + 2] = a;
          outRgba[idx + 3] = a;
        }
        return true;
      }
      return false;
    } finally {
      if (!isScratch) {
        if (inputPtr) inst.fastart_dealloc(inputPtr, rle.length);
        if (outputPtr) inst.fastart_dealloc(outputPtr, outBytes);
      }
    }
  }

  /**
   * Converts raw neural model output alpha floats into packed 32-bit RGBA mask pixels in native Rust/WASM
   */
  public processModnetOutput(
    rawAlpha: Float32Array,
    outRgbaPixels?: Uint8ClampedArray,
    threshold = 0.0,
    feather = 0.0,
    crop?: { dx: number; dy: number; dw: number; dh: number },
  ): Uint8ClampedArray {
    const inst = this.wasmInstance;
    const pixels = 512 * 512;
    const bytes = pixels * 4;
    const dest = outRgbaPixels?.length === bytes ? outRgbaPixels : new Uint8ClampedArray(bytes);
    if (this.backendType !== "web_wasm" || !inst || !inst.fastart_process_modnet_output_c) {
      // High-performance typed JS quintic smootherstep + geodesic region-growing human isolation + interior solid boost + curvature choke + Gaussian anti-aliasing fallback (< 2ms)
      const tNorm = (threshold <= 0.001 && feather <= 0.001) ? 0.45 : Math.max(0, Math.min(1, threshold));
      const sNorm = (threshold <= 0.001 && feather <= 0.001) ? 0.25 : Math.max(0, Math.min(1, feather));
      const vMin = Math.max(0.14, Math.min(0.38, 0.20 + (tNorm - 0.45) * 0.25));
      const vMax = Math.max(vMin + 0.20, Math.min(0.85, 0.58 + tNorm * 0.10 + sNorm * 0.08));
      const span = Math.max(0.10, vMax - vMin);
      const invSpan = 1.0 / span;

      // Step 1: Find high-confidence Human Core Seeds (raw alpha >= 0.50)
      const coreVisited = new Uint8Array(pixels);
      const labels = new Uint32Array(pixels);
      let currentLabel = 0;
      interface CoreComp {
        label: number;
        size: number;
      }
      const compSizes: CoreComp[] = [];
      const queue = new Int32Array(pixels);

      // Use crop bounds to limit CC scan to actual video content region (avoid letterbox gray bands)
      const rcMinY = crop ? Math.max(0, crop.dy) : 0;
      const rcMaxY = crop ? Math.min(511, crop.dy + crop.dh - 1) : 511;
      const rcMinX = crop ? Math.max(0, crop.dx) : 0;
      const rcMaxX = crop ? Math.min(511, crop.dx + crop.dw - 1) : 511;

      for (let idx = 0; idx < pixels; idx++) {
        const cy = (idx / 512) | 0;
        const cx = idx % 512;
        if (cy >= rcMinY && cy <= rcMaxY && cx >= rcMinX && cx <= rcMaxX &&
            rawAlpha[idx] >= 0.50 && coreVisited[idx] === 0) {
          currentLabel++;
          let head = 0;
          let tail = 0;
          queue[tail++] = idx;
          coreVisited[idx] = 1;
          labels[idx] = currentLabel;
          let count = 0;

          while (head < tail) {
            const cur = queue[head++];
            count++;
            const y = (cur / 512) | 0;
            const x = cur % 512;

            if (y > rcMinY) {
              const n = cur - 512;
              if (rawAlpha[n] >= 0.50 && coreVisited[n] === 0) {
                coreVisited[n] = 1; labels[n] = currentLabel; queue[tail++] = n;
              }
            }
            if (y < rcMaxY) {
              const n = cur + 512;
              if (rawAlpha[n] >= 0.50 && coreVisited[n] === 0) {
                coreVisited[n] = 1; labels[n] = currentLabel; queue[tail++] = n;
              }
            }
            if (x > rcMinX) {
              const n = cur - 1;
              if (rawAlpha[n] >= 0.50 && coreVisited[n] === 0) {
                coreVisited[n] = 1; labels[n] = currentLabel; queue[tail++] = n;
              }
            }
            if (x < rcMaxX) {
              const n = cur + 1;
              if (rawAlpha[n] >= 0.50 && coreVisited[n] === 0) {
                coreVisited[n] = 1; labels[n] = currentLabel; queue[tail++] = n;
              }
            }
          }
          compSizes.push({ label: currentLabel, size: count });
        }
      }

      // Step 2: Crown detection + geodesic region growing with floating-island rejection
      const isHuman = new Uint8Array(pixels);
      let maxComp: CoreComp | null = null;
      for (let i = 0; i < compSizes.length; i++) {
        if (!maxComp || compSizes[i].size > maxComp.size) maxComp = compSizes[i];
      }

      if (maxComp && maxComp.size >= 120) {
        // --- Crown detection on main (largest) component ---
        let bodyMinY = rcMaxY, bodyMaxY = rcMinY;
        const rowSpans: Array<{ minX: number; maxX: number } | null> = new Array(512).fill(null);
        for (let y = rcMinY; y <= rcMaxY; y++) {
          let rMinX = 512, rMaxX = 0, cnt = 0;
          for (let x = rcMinX; x <= rcMaxX; x++) {
            if (labels[y * 512 + x] === maxComp.label) {
              cnt++; if (x < rMinX) rMinX = x; if (x > rMaxX) rMaxX = x;
            }
          }
          if (cnt > 0) {
            if (y < bodyMinY) bodyMinY = y;
            if (y > bodyMaxY) bodyMaxY = y;
            rowSpans[y] = { minX: rMinX, maxX: rMaxX };
          }
        }

        // Find crown_y: first row with span >= 6 sustained over 3+ of next 4 rows
        let crownY = bodyMinY;
        for (let y = bodyMinY; y <= Math.min(bodyMaxY, bodyMinY + 60); y++) {
          const s = rowSpans[y];
          if (s && (s.maxX - s.minX + 1) >= 6) {
            let sustained = 0;
            for (let k = 1; k <= 4; k++) {
              const sk = rowSpans[y + k];
              if (sk && (sk.maxX - sk.minX + 1) >= 6) sustained++;
            }
            if (sustained >= 3) { crownY = y; break; }
          }
        }

        // Shoulder span for horizontal overlap check
        let mainMinXAtCrown = 512, mainMaxXAtCrown = 0;
        const shoulderEnd = Math.min(crownY + 20, rcMaxY);
        for (let sy = crownY; sy <= shoulderEnd; sy++) {
          for (let sx = rcMinX; sx <= rcMaxX; sx++) {
            if (labels[sy * 512 + sx] === maxComp.label) {
              if (sx < mainMinXAtCrown) mainMinXAtCrown = sx;
              if (sx > mainMaxXAtCrown) mainMaxXAtCrown = sx;
            }
          }
        }

        // Valid core labels: secondary component must start AT/BELOW crownY AND overlap horizontally
        const validCoreLabels = new Uint8Array(currentLabel + 1);
        validCoreLabels[maxComp.label] = 1;
        const minKeepSize = (maxComp.size / 6) | 0;
        for (let i = 0; i < compSizes.length; i++) {
          if (compSizes[i].label === maxComp.label) continue;
          if (compSizes[i].size >= minKeepSize) {
            let cMinY = rcMaxY, cMaxY = rcMinY, cMinX = 512, cMaxX = 0;
            for (let idx = 0; idx < pixels; idx++) {
              if (labels[idx] === compSizes[i].label) {
                const cy = (idx / 512) | 0, cx = idx % 512;
                if (cy < cMinY) cMinY = cy; if (cy > cMaxY) cMaxY = cy;
                if (cx < cMinX) cMinX = cx; if (cx > cMaxX) cMaxX = cx;
              }
            }
            if (cMinY >= crownY && cMinX <= mainMaxXAtCrown && cMaxX >= mainMinXAtCrown) {
              validCoreLabels[compSizes[i].label] = 1;
            }
          }
        }

        // Geodesic region growing — strictly no growing above crownY
        let head = 0;
        let tail = 0;
        for (let idx = 0; idx < pixels; idx++) {
          const l = labels[idx];
          if (l > 0 && validCoreLabels[l] === 1) {
            const cy = (idx / 512) | 0;
            if (cy >= crownY) { isHuman[idx] = 1; queue[tail++] = idx; }
          }
        }
        while (head < tail) {
          const cur = queue[head++];
          const cy = (cur / 512) | 0;
          const cx = cur % 512;
          for (let ddy = -1; ddy <= 1; ddy++) {
            for (let ddx = -1; ddx <= 1; ddx++) {
              if (ddx === 0 && ddy === 0) continue;
              const ny = cy + ddy, nx = cx + ddx;
              if (ny >= crownY && ny <= rcMaxY && nx >= rcMinX && nx <= rcMaxX) {
                const nIdx = ny * 512 + nx;
                if (isHuman[nIdx] === 0 && rawAlpha[nIdx] >= vMin) {
                  isHuman[nIdx] = 1; queue[tail++] = nIdx;
                }
              }
            }
          }
        }
        // Preserve natural rounded apex 1-2 pixels above crownY
        for (let y = Math.max(rcMinY, crownY - 2); y < crownY; y++) {
          for (let x = rcMinX; x <= rcMaxX; x++) {
            const idx = y * 512 + x;
            if (rawAlpha[idx] >= 0.50 && idx + 512 < pixels && isHuman[idx + 512] === 1) {
              isHuman[idx] = 1;
            }
          }
        }
      } else {
        // No salient human detected — use full alpha threshold (fallback for synthetic/test frames)
        for (let idx = 0; idx < pixels; idx++) {
          if (rawAlpha[idx] >= vMin) isHuman[idx] = 1;
        }
      }

      // Step 3: Two-Pass Euclidean Distance Transform (Chamfer 1.0 / 1.414)
      const dist = new Float32Array(pixels);
      const INF = 1e6;
      for (let idx = 0; idx < pixels; idx++) {
        dist[idx] = isHuman[idx] === 1 ? INF : 0.0;
      }

      // Forward pass (top-left to bottom-right)
      for (let y = 0; y < 512; y++) {
        const row = y * 512;
        const rowPrev = y > 0 ? (y - 1) * 512 : -1;
        for (let x = 0; x < 512; x++) {
          const idx = row + x;
          if (dist[idx] > 0.0) {
            let m = dist[idx];
            if (x > 0) {
              const d = dist[idx - 1] + 1.0;
              if (d < m) m = d;
            }
            if (rowPrev >= 0) {
              const d = dist[rowPrev + x] + 1.0;
              if (d < m) m = d;
              if (x > 0) {
                const dDiag = dist[rowPrev + x - 1] + 1.414;
                if (dDiag < m) m = dDiag;
              }
              if (x + 1 < 512) {
                const dDiag = dist[rowPrev + x + 1] + 1.414;
                if (dDiag < m) m = dDiag;
              }
            }
            dist[idx] = m;
          }
        }
      }

      // Backward pass (bottom-right to top-left)
      for (let y = 511; y >= 0; y--) {
        const row = y * 512;
        const rowNext = y + 1 < 512 ? (y + 1) * 512 : -1;
        for (let x = 511; x >= 0; x--) {
          const idx = row + x;
          if (dist[idx] > 0.0) {
            let m = dist[idx];
            if (x + 1 < 512) {
              const d = dist[idx + 1] + 1.0;
              if (d < m) m = d;
            }
            if (rowNext >= 0) {
              const d = dist[rowNext + x] + 1.0;
              if (d < m) m = d;
              if (x + 1 < 512) {
                const dDiag = dist[rowNext + x + 1] + 1.414;
                if (dDiag < m) m = dDiag;
              }
              if (x > 0) {
                const dDiag = dist[rowNext + x - 1] + 1.414;
                if (dDiag < m) m = dDiag;
              }
            }
            dist[idx] = m;
          }
        }
      }

      // Step 4: Smooth the alpha probability field phi (preserving subpixel curves) with interior reinforcement.
      const phi = new Float32Array(pixels);
      for (let idx = 0; idx < pixels; idx++) {
        if (isHuman[idx] === 1) {
          const d = dist[idx];
          const r = rawAlpha[idx];
          if (d >= 2.5) {
            phi[idx] = Math.max(r, 0.88);
          } else if (d >= 1.2) {
            const w = (d - 1.2) / 1.3;
            phi[idx] = Math.max(r, r * (1.0 - w) + 0.88 * w);
          } else {
            phi[idx] = r;
          }
        }
      }

      // Step 5: Separable 5-tap Gaussian blur on phi for smooth organic isocontours.
      const G = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136];
      const blurH = new Float32Array(pixels);
      for (let y = rcMinY; y <= rcMaxY; y++) {
        const row = y * 512;
        for (let x = rcMinX; x <= rcMaxX; x++) {
          blurH[row + x] =
            phi[row + Math.max(rcMinX, x - 2)] * G[0] +
            phi[row + Math.max(rcMinX, x - 1)] * G[1] +
            phi[row + x] * G[2] +
            phi[row + Math.min(rcMaxX, x + 1)] * G[3] +
            phi[row + Math.min(rcMaxX, x + 2)] * G[4];
        }
      }
      const smoothed = new Float32Array(pixels);
      for (let x = rcMinX; x <= rcMaxX; x++) {
        for (let y = rcMinY; y <= rcMaxY; y++) {
          smoothed[y * 512 + x] =
            blurH[Math.max(rcMinY, y - 2) * 512 + x] * G[0] +
            blurH[Math.max(rcMinY, y - 1) * 512 + x] * G[1] +
            blurH[y * 512 + x] * G[2] +
            blurH[Math.min(rcMaxY, y + 1) * 512 + x] * G[3] +
            blurH[Math.min(rcMaxY, y + 2) * 512 + x] * G[4];
        }
      }

      // Step 6: Higher cutoff (0.48) quintic smootherstep eliminates outer mixed grass/sky halos.
      const cutoff = Math.max(0.45, Math.min(0.70, 0.58 + (tNorm - 0.45) * 0.20));
      const halfW = Math.max(0.05, Math.min(0.14, 0.08 + (sNorm - 0.25) * 0.06));
      const minT = cutoff - halfW;
      const maxT = cutoff + halfW;
      const invW = 1.0 / (2.0 * halfW);

      for (let y = rcMinY; y <= rcMaxY; y++) {
        for (let x = rcMinX; x <= rcMaxX; x++) {
          const idx = y * 512 + x;
          if (isHuman[idx] !== 1) continue;
          let a = 0;
          if (y >= rcMaxY - 2 && rawAlpha[idx] >= 0.20) {
            a = 255;
          } else {
            const val = smoothed[idx];
            if (val <= minT) a = 0;
            else if (val >= maxT) a = 255;
            else {
              const u = (val - minT) * invW;
              const s = u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
              a = Math.min(255, Math.max(0, Math.round(s * 255)));
            }
          }
          const pxIdx = idx * 4;
          dest[pxIdx] = a;
          dest[pxIdx + 1] = a;
          dest[pxIdx + 2] = a;
          dest[pxIdx + 3] = a;
        }
      }
      return dest;
    }
    if (rawAlpha.length !== pixels) throw new Error("Invalid MODNet output dimensions");
    const alphaBytes = rawAlpha.byteLength;
    const isScratch = typeof inst.fastart_get_scratchpad === "function";
    let alphaPtr = 0;
    let rgbaPtr = 0;
    try {
      if (isScratch) {
        alphaPtr = inst.fastart_get_scratchpad!(alphaBytes + bytes);
        rgbaPtr = alphaPtr + alphaBytes;
      } else {
        alphaPtr = inst.fastart_alloc(alphaBytes);
        rgbaPtr = inst.fastart_alloc(bytes);
      }
      if (!alphaPtr || !rgbaPtr) throw new Error("Rust WASM allocation failed");
      new Float32Array(inst.memory.buffer, alphaPtr, pixels).set(rawAlpha);
      if (crop && inst.fastart_process_modnet_output_cropped_c) {
        inst.fastart_process_modnet_output_cropped_c(
          alphaPtr,
          rgbaPtr,
          threshold,
          feather,
          crop.dx | 0,
          crop.dy | 0,
          crop.dw | 0,
          crop.dh | 0,
        );
      } else {
        inst.fastart_process_modnet_output_c(alphaPtr, rgbaPtr, threshold, feather);
      }
      dest.set(new Uint8Array(inst.memory.buffer, rgbaPtr, bytes));
      return dest;
    } finally {
      if (!isScratch) {
        if (alphaPtr) inst.fastart_dealloc(alphaPtr, alphaBytes);
        if (rgbaPtr) inst.fastart_dealloc(rgbaPtr, bytes);
      }
    }
  }

  public modnetAlphaToRLE(
    rawAlpha: Float32Array,
    threshold: number = 0.0,
    feather: number = 0.0
  ): Uint8Array {
    const inst = this.wasmInstance;
    if (this.backendType !== "web_wasm" || !inst || !inst.fastart_modnet_alpha_to_rle_c) {
      throw new Error("Rust WASM MODNet post-processing is unavailable");
    }
    const maxOutLen = rawAlpha.length * 2;
    const inputBytes = rawAlpha.byteLength;
    const isScratch = typeof inst.fastart_get_scratchpad === "function";
    let alphaPtr = 0;
    let outputPtr = 0;
    try {
      if (isScratch) {
        alphaPtr = inst.fastart_get_scratchpad!(inputBytes + maxOutLen);
        outputPtr = alphaPtr + inputBytes;
      } else {
        alphaPtr = inst.fastart_alloc(inputBytes);
        outputPtr = inst.fastart_alloc(maxOutLen);
      }
      if (!alphaPtr || !outputPtr) throw new Error("Rust WASM allocation failed");
      new Float32Array(inst.memory.buffer, alphaPtr, rawAlpha.length).set(rawAlpha);
      const written = inst.fastart_modnet_alpha_to_rle_c(
        alphaPtr, rawAlpha.length, threshold, feather, outputPtr, maxOutLen,
      );
      if (written <= 0 || written > maxOutLen) throw new Error("Rust WASM RLE encoding failed");
      return new Uint8Array(new Uint8Array(inst.memory.buffer, outputPtr, written));
    } finally {
      if (!isScratch) {
        if (alphaPtr) inst.fastart_dealloc(alphaPtr, inputBytes);
        if (outputPtr) inst.fastart_dealloc(outputPtr, maxOutLen);
      }
    }
  }

  /**
   * Multi-scale Normalized Cross-Correlation (NCC) template matching in native Rust/WASM
   */
  public searchTemplateNCC(
    framePixels: Uint8ClampedArray,
    fw: number,
    fh: number,
    templateData: Float32Array,
    dim: number,
    tMean: number,
    tStd: number,
    tAngle: number,
    cx: number,
    cy: number,
    bw: number,
    bh: number,
    searchRadius: number,
    scales: number[],
    step: number = 2
  ): { x: number; y: number; scale: number; rotation: number; confidence: number } | null {
    const inst = this.wasmInstance;
    if (!inst) return null;

    try {
      const frameBytes = fw * fh * 4;
      const templateLen = dim * dim;
      const scalesCount = scales.length;
      const totalNeeded = frameBytes + templateLen * 4 + scalesCount * 4 + 32;

      let framePtr = 0;
      let templatePtr = 0;
      let scalesPtr = 0;
      let outBestXPtr = 0;
      let outBestYPtr = 0;
      let outBestScalePtr = 0;
      let outBestAnglePtr = 0;
      let outBestScorePtr = 0;
      let isScratch = false;

      if (inst.fastart_get_scratchpad) {
        const scratchPtr = inst.fastart_get_scratchpad(totalNeeded);
        if (scratchPtr) {
          isScratch = true;
          framePtr = scratchPtr;
          templatePtr = framePtr + frameBytes;
          scalesPtr = templatePtr + templateLen * 4;
          outBestXPtr = scalesPtr + scalesCount * 4;
          outBestYPtr = outBestXPtr + 4;
          outBestScalePtr = outBestYPtr + 4;
          outBestAnglePtr = outBestScalePtr + 4;
          outBestScorePtr = outBestAnglePtr + 4;
        }
      }

      if (!isScratch) {
        framePtr = inst.fastart_alloc(frameBytes);
        templatePtr = inst.fastart_alloc(templateLen * 4);
        scalesPtr = inst.fastart_alloc(scalesCount * 4);
        outBestXPtr = inst.fastart_alloc(4);
        outBestYPtr = inst.fastart_alloc(4);
        outBestScalePtr = inst.fastart_alloc(4);
        outBestAnglePtr = inst.fastart_alloc(4);
        outBestScorePtr = inst.fastart_alloc(4);
      }

      if (!framePtr || !templatePtr || !scalesPtr) {
        if (!isScratch) {
          if (framePtr) inst.fastart_dealloc(framePtr, frameBytes);
          if (templatePtr) inst.fastart_dealloc(templatePtr, templateLen * 4);
          if (scalesPtr) inst.fastart_dealloc(scalesPtr, scalesCount * 4);
          if (outBestXPtr) inst.fastart_dealloc(outBestXPtr, 4);
          if (outBestYPtr) inst.fastart_dealloc(outBestYPtr, 4);
          if (outBestScalePtr) inst.fastart_dealloc(outBestScalePtr, 4);
          if (outBestAnglePtr) inst.fastart_dealloc(outBestAnglePtr, 4);
          if (outBestScorePtr) inst.fastart_dealloc(outBestScorePtr, 4);
        }
        return null;
      }

      new Uint8Array(inst.memory.buffer, framePtr, frameBytes).set(framePixels);
      new Float32Array(inst.memory.buffer, templatePtr, templateLen).set(templateData);
      new Float32Array(inst.memory.buffer, scalesPtr, scalesCount).set(scales);

      inst.fastart_search_template_ncc_c(
        framePtr,
        fw,
        fh,
        templatePtr,
        dim,
        tMean,
        tStd,
        tAngle,
        cx,
        cy,
        bw,
        bh,
        searchRadius,
        scalesPtr,
        scalesCount,
        step,
        outBestXPtr,
        outBestYPtr,
        outBestScalePtr,
        outBestAnglePtr,
        outBestScorePtr
      );

      const memF32 = new Float32Array(inst.memory.buffer);
      const bestX = memF32[outBestXPtr >> 2];
      const bestY = memF32[outBestYPtr >> 2];
      const bestScale = memF32[outBestScalePtr >> 2];
      const bestAngle = memF32[outBestAnglePtr >> 2];
      const bestScore = memF32[outBestScorePtr >> 2];

      if (!isScratch) {
        inst.fastart_dealloc(framePtr, frameBytes);
        inst.fastart_dealloc(templatePtr, templateLen * 4);
        inst.fastart_dealloc(scalesPtr, scalesCount * 4);
        inst.fastart_dealloc(outBestXPtr, 4);
        inst.fastart_dealloc(outBestYPtr, 4);
        inst.fastart_dealloc(outBestScalePtr, 4);
        inst.fastart_dealloc(outBestAnglePtr, 4);
        inst.fastart_dealloc(outBestScorePtr, 4);
      }

      return {
        x: bestX,
        y: bestY,
        scale: bestScale,
        rotation: bestAngle,
        confidence: bestScore,
      };
    } catch {
      return null;
    }
  }

  /**
   * Applies AI noise gate & dynamic speech boost to waveform peaks in native Rust/WASM
   */
  public async denoiseWaveformPeaks(peaks: number[]): Promise<number[]> {
    await this.init();
    const inst = this.wasmInstance;
    if (this.backendType === "android_native" || this.backendType === "ios_native") {
      if (!FastArtRust || typeof FastArtRust.denoiseWaveformPeaks !== "function") {
        throw new Error("Rust waveform denoising is not exposed by the native module");
      }
      return await FastArtRust.denoiseWaveformPeaks(peaks);
    }
    if (this.backendType !== "web_wasm" || !inst?.fastart_denoise_waveform_peaks_c) {
      throw new Error("Rust waveform denoising is unavailable");
    }
    const count = peaks.length;
    const bytes = count * Float32Array.BYTES_PER_ELEMENT;
    const ptr = inst.fastart_alloc(bytes);
    if (!ptr && bytes > 0) throw new Error("Rust WASM allocation failed for waveform denoising");
    try {
      const f32View = new Float32Array(inst.memory.buffer, ptr, count);
      f32View.set(peaks);
      inst.fastart_denoise_waveform_peaks_c(ptr, count);
      return Array.from(f32View);
    } finally {
      if (ptr) inst.fastart_dealloc(ptr, bytes);
    }
  }

  /**
   * Evaluates keyframe transforms with smooth Hermite easing in native Rust/WASM
   */
  public evaluateKeyframes(
    base: { x: number; y: number; scale: number; rotation: number; opacity: number },
    keyframes: { time: number; transform?: { x?: number; y?: number; scale?: number; rotation?: number }; opacity?: number }[],
    queryTime: number
  ): { x: number; y: number; scale: number; rotation: number; opacity: number } | null {
    const inst = this.wasmInstance;
    if (!inst || !keyframes || keyframes.length === 0) return null;

    try {
      const count = keyframes.length;
      const bytesPerF64 = 8;
      const totalBytes = count * bytesPerF64 * 6 + bytesPerF64 * 5;

      let tPtr = 0, xPtr = 0, yPtr = 0, scalePtr = 0, rotPtr = 0, opPtr = 0;
      let outXPtr = 0, outYPtr = 0, outScalePtr = 0, outRotPtr = 0, outOpPtr = 0;
      let isScratch = false;

      if (typeof inst.fastart_get_scratchpad === "function") {
        const scratchPtr = inst.fastart_get_scratchpad(totalBytes);
        if (scratchPtr) {
          isScratch = true;
          const stride = count * bytesPerF64;
          tPtr = scratchPtr;
          xPtr = tPtr + stride;
          yPtr = xPtr + stride;
          scalePtr = yPtr + stride;
          rotPtr = scalePtr + stride;
          opPtr = rotPtr + stride;
          outXPtr = opPtr + stride;
          outYPtr = outXPtr + bytesPerF64;
          outScalePtr = outYPtr + bytesPerF64;
          outRotPtr = outScalePtr + bytesPerF64;
          outOpPtr = outRotPtr + bytesPerF64;
        }
      }

      if (!isScratch) {
        tPtr = inst.fastart_alloc(count * bytesPerF64);
        xPtr = inst.fastart_alloc(count * bytesPerF64);
        yPtr = inst.fastart_alloc(count * bytesPerF64);
        scalePtr = inst.fastart_alloc(count * bytesPerF64);
        rotPtr = inst.fastart_alloc(count * bytesPerF64);
        opPtr = inst.fastart_alloc(count * bytesPerF64);

        outXPtr = inst.fastart_alloc(bytesPerF64);
        outYPtr = inst.fastart_alloc(bytesPerF64);
        outScalePtr = inst.fastart_alloc(bytesPerF64);
        outRotPtr = inst.fastart_alloc(bytesPerF64);
        outOpPtr = inst.fastart_alloc(bytesPerF64);
      }

      if (!tPtr || !xPtr || !yPtr || !scalePtr || !rotPtr || !opPtr) {
        return null;
      }

      const mem = inst.memory.buffer;
      const tView = new Float64Array(mem, tPtr, count);
      const xView = new Float64Array(mem, xPtr, count);
      const yView = new Float64Array(mem, yPtr, count);
      const scaleView = new Float64Array(mem, scalePtr, count);
      const rotView = new Float64Array(mem, rotPtr, count);
      const opView = new Float64Array(mem, opPtr, count);

      for (let i = 0; i < count; i++) {
        const kf = keyframes[i];
        tView[i] = kf.time;
        xView[i] = kf.transform?.x ?? base.x;
        yView[i] = kf.transform?.y ?? base.y;
        scaleView[i] = kf.transform?.scale ?? base.scale;
        rotView[i] = kf.transform?.rotation ?? base.rotation;
        opView[i] = kf.opacity ?? base.opacity;
      }

      let res = null;
      try {
        inst.fastart_evaluate_keyframes_c(
          base.x,
          base.y,
          base.scale,
          base.rotation,
          base.opacity,
          tPtr,
          xPtr,
          yPtr,
          scalePtr,
          rotPtr,
          opPtr,
          count,
          queryTime,
          outXPtr,
          outYPtr,
          outScalePtr,
          outRotPtr,
          outOpPtr
        );

        const memF64 = new Float64Array(inst.memory.buffer);
        res = {
          x: memF64[outXPtr >> 3],
          y: memF64[outYPtr >> 3],
          scale: memF64[outScalePtr >> 3],
          rotation: memF64[outRotPtr >> 3],
          opacity: memF64[outOpPtr >> 3],
        };
      } finally {
        if (!isScratch) {
          if (tPtr) inst.fastart_dealloc(tPtr, count * bytesPerF64);
          if (xPtr) inst.fastart_dealloc(xPtr, count * bytesPerF64);
          if (yPtr) inst.fastart_dealloc(yPtr, count * bytesPerF64);
          if (scalePtr) inst.fastart_dealloc(scalePtr, count * bytesPerF64);
          if (rotPtr) inst.fastart_dealloc(rotPtr, count * bytesPerF64);
          if (opPtr) inst.fastart_dealloc(opPtr, count * bytesPerF64);

          if (outXPtr) inst.fastart_dealloc(outXPtr, bytesPerF64);
          if (outYPtr) inst.fastart_dealloc(outYPtr, bytesPerF64);
          if (outScalePtr) inst.fastart_dealloc(outScalePtr, bytesPerF64);
          if (outRotPtr) inst.fastart_dealloc(outRotPtr, bytesPerF64);
          if (outOpPtr) inst.fastart_dealloc(outOpPtr, bytesPerF64);
        }
      }

      return res;
    } catch {
      return null;
    }
  }

  /**
   * Unified platform-agnostic foreground segmentation.
   * 
   * On Web: Uses WASM Guided Filter Matting (fastart_guided_filter_matting_c) 
   *         seeded with a center-ellipse prior mask for CapCut-grade edges.
   * On Native: Falls back to high-quality JS saliency segmentation 
   *            (skin-tone YCbCr + luminance + center ellipse prior + Hermite smoothing).
   * 
   * @param rgba     RGBA pixel buffer (Uint8Array or Uint8ClampedArray), w×h×4 bytes
   * @param w        Pixel width
   * @param h        Pixel height  
   * @param threshold Cutout aggressiveness 0.0–1.0 (maps to center-prior radius)
   * @param feather  Edge softness 0.0–1.0
   * @returns        Alpha Uint8Array, length = w×h (0=transparent, 255=opaque)
   */
  public async segmentFrameRgba(
    rgba: Uint8Array | Uint8ClampedArray,
    w: number,
    h: number,
    threshold = 0.45,
    feather = 0.25,
  ): Promise<Uint8Array> {
    await this.init();
    const pixels = w * h;
    if (w < 1 || h < 1 || rgba.length !== pixels * 4) {
      throw new Error("Invalid RGBA frame for Rust segmentation");
    }

    if (this.backendType === "android_native" || this.backendType === "ios_native") {
      if (!FastArtRust || typeof FastArtRust.segmentFrameRgba !== "function") {
        throw new Error("Rust segmentation is not exposed by the native module");
      }
      const encoded = await FastArtRust.segmentFrameRgba(
        encodeNativeBytes(rgba), w, h, threshold, feather,
      );
      if (typeof encoded !== "string") {
        throw new Error("Rust segmentation returned an invalid alpha mask");
      }
      const result = decodeBase64ToUint8(encoded);
      if (result.length !== pixels) {
        throw new Error("Rust segmentation returned an invalid alpha mask");
      }
      return result;
    }

    const inst = this.wasmInstance;
    if (this.backendType !== "web_wasm" || !inst || typeof inst.fastart_segment_frame_rgba_c !== "function") {
      throw new Error("Rust core is unavailable; segmentation requires Rust");
    }

    const rgbaBytes = pixels * 4;
    const totalNeeded = rgbaBytes + pixels;
    const isScratch = typeof inst.fastart_get_scratchpad === "function";
    let rgbaPtr = 0;
    let alphaPtr = 0;
    try {
      if (isScratch) {
        rgbaPtr = inst.fastart_get_scratchpad!(totalNeeded);
        alphaPtr = rgbaPtr + rgbaBytes;
      } else {
        rgbaPtr = inst.fastart_alloc(rgbaBytes);
        alphaPtr = inst.fastart_alloc(pixels);
      }
      if (!rgbaPtr || !alphaPtr) throw new Error("Rust WASM memory allocation failed");
      new Uint8Array(inst.memory.buffer, rgbaPtr, rgbaBytes).set(rgba);
      const written = inst.fastart_segment_frame_rgba_c(
        rgbaPtr, w, h, threshold, feather, 0, 0, alphaPtr, pixels,
      );
      if (written !== pixels) throw new Error("Rust WASM segmentation failed");
      return new Uint8Array(new Uint8Array(inst.memory.buffer, alphaPtr, pixels));
    } finally {
      if (!isScratch) {
        if (rgbaPtr) inst.fastart_dealloc(rgbaPtr, rgbaBytes);
        if (alphaPtr) inst.fastart_dealloc(alphaPtr, pixels);
      }
    }
  }

  public encodeRGBAPng(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array {
    const inst = this.wasmInstance;
    if (this.backendType !== "web_wasm" || !inst?.fastart_encode_rgba_png_c) {
      throw new Error("Rust WASM PNG encoding is unavailable");
    }
    const inputLen = w * h * 4;
    if (rgba.length !== inputLen) throw new Error("Invalid RGBA buffer for Rust PNG encoding");
    const outputCapacity = inputLen + 16384;
    const isScratch = typeof inst.fastart_get_scratchpad === "function";
    let inputPtr = 0;
    let outputPtr = 0;
    try {
      if (isScratch) {
        inputPtr = inst.fastart_get_scratchpad!(inputLen + outputCapacity);
        outputPtr = inputPtr + inputLen;
      } else {
        inputPtr = inst.fastart_alloc(inputLen);
        outputPtr = inst.fastart_alloc(outputCapacity);
      }
      if (!inputPtr || !outputPtr) throw new Error("Rust WASM allocation failed");
      new Uint8Array(inst.memory.buffer, inputPtr, inputLen).set(rgba);
      const written = inst.fastart_encode_rgba_png_c(inputPtr, w, h, outputPtr, outputCapacity);
      if (written <= 0 || written > outputCapacity) throw new Error("Rust WASM PNG encoding failed");
      return new Uint8Array(new Uint8Array(inst.memory.buffer, outputPtr, written));
    } finally {
      if (!isScratch) {
        if (inputPtr) inst.fastart_dealloc(inputPtr, inputLen);
        if (outputPtr) inst.fastart_dealloc(outputPtr, outputCapacity);
      }
    }
  }

  public async encodeRGBAPngForPlatform(
    rgba: Uint8Array | Uint8ClampedArray,
    w: number,
    h: number,
  ): Promise<Uint8Array> {
    await this.init();
    if (this.backendType === "web_wasm") return this.encodeRGBAPng(rgba, w, h);
    if (this.backendType === "android_native" || this.backendType === "ios_native") {
      if (!FastArtRust || typeof FastArtRust.encodeRgbaPng !== "function") {
        throw new Error("Rust PNG encoding is not exposed by the native module");
      }
      const png = await FastArtRust.encodeRgbaPng(encodeNativeBytes(rgba), w, h);
      if (typeof png !== "string" || png.length === 0) throw new Error("Native Rust PNG encoding failed");
      const pngBytes = decodeBase64ToUint8(png);
      if (pngBytes.length < 8) throw new Error("Native Rust PNG encoding failed");
      return pngBytes;
    }
    throw new Error("Rust core is unavailable; PNG encoding requires Rust");
  }

}

export const rustCoreBridge = new RustCoreBridgeService();
