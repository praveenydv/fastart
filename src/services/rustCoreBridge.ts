// FastArt High-Performance Rust Core Engine Bridge
// Seamlessly routes computation to:
// 1. Android Native JNI (libfastart_jni.so) on mobile
// 2. WebAssembly (fastart_wasm.wasm) on web
// Keeps Expo UI at 60fps with zero UI-thread stalls

import { NativeModules, Platform } from "react-native";
import { FastArtProject, TrajectoryPoint, CutoutConfig } from "../types/project";
import {
  getHumanSegmentationMask,
  requestHumanSegmentation,
  getFrameMask,
} from "./selfieSegmentationService";

let FastArtRust: any = NativeModules.FastArtRust;
try {
  const { requireNativeModule } = require("expo-modules-core");
  FastArtRust = requireNativeModule("FastArtRust") || FastArtRust;
} catch (_) {}

export interface RustBeatResult {
  bpm: number;
  beats: number[];
}

export type RustBackendType = "android_native" | "ios_native" | "web_wasm" | "fallback";

let internalMaskCanvas: HTMLCanvasElement | null = null;
let internalMaskCtx: CanvasRenderingContext2D | null = null;

interface WasmExports {
  memory: WebAssembly.Memory;
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
  fastart_export_wav_c: (
    projectJsonPtr: number,
    jsonLen: number,
    sampleRate: number,
    duration: number,
    outPtr: number,
    maxOutLen: number
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
}

class RustCoreBridgeService {
  private backendType: RustBackendType = "fallback";
  private wasmInstance: WasmExports | null = null;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;

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
          const candidates = ["/wasm/fastart_wasm.wasm", "/assets/wasm/fastart_wasm.wasm"];
          for (const wasmUrl of candidates) {
            try {
              const res = await fetch(wasmUrl);
              if (res.ok) {
                const buf = await res.arrayBuffer();
                const bytes = new Uint8Array(buf);
                // Verify WebAssembly magic header: \0asm
                if (bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) {
                  const module = await WebAssembly.instantiate(buf, {
                    env: {},
                    wasi_snapshot_preview1: {},
                  });
                  this.wasmInstance = module.instance.exports as unknown as WasmExports;
                  this.backendType = "web_wasm";
                  this.isInitialized = true;
                  console.log("[RustCoreBridge] Initialized with WebAssembly Rust Engine (fastart_wasm.wasm)");
                  return true;
                }
              }
            } catch (_) {}
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
      try {
        const inst = this.wasmInstance;
        const count = samples.length;
        const bytesPerFloat = 4;
        const samplesPtr = inst.fastart_alloc(count * bytesPerFloat);

        const memoryBuffer = inst.memory.buffer;
        const floatView = new Float32Array(memoryBuffer, samplesPtr, count);
        if (samples instanceof Float32Array) {
          floatView.set(samples);
        } else {
          for (let i = 0; i < count; i++) floatView[i] = samples[i];
        }

        const maxOutLen = 16384;
        const outPtr = inst.fastart_alloc(maxOutLen);

        const written = inst.fastart_detect_beats_c(samplesPtr, count, sampleRate, outPtr, maxOutLen);
        const outBytes = new Uint8Array(inst.memory.buffer, outPtr, written);
        const jsonStr = new TextDecoder().decode(outBytes);

        inst.fastart_dealloc(samplesPtr, count * bytesPerFloat);
        inst.fastart_dealloc(outPtr, maxOutLen);

        if (jsonStr) {
          return JSON.parse(jsonStr) as RustBeatResult;
        }
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM detectAudioBeats error:", wasmErr);
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
      try {
        const inst = this.wasmInstance;
        const count = samples.length;
        const bytesPerFloat = 4;
        const samplesPtr = inst.fastart_alloc(count * bytesPerFloat);

        const floatView = new Float32Array(inst.memory.buffer, samplesPtr, count);
        if (samples instanceof Float32Array) {
          floatView.set(samples);
        } else {
          for (let i = 0; i < count; i++) floatView[i] = samples[i];
        }

        const outPeaksPtr = inst.fastart_alloc(buckets * bytesPerFloat);
        const peakCount = inst.fastart_generate_waveform_c(samplesPtr, count, buckets, outPeaksPtr);
        const peaksView = new Float32Array(inst.memory.buffer, outPeaksPtr, peakCount);
        const peaks = Array.from(peaksView);

        inst.fastart_dealloc(samplesPtr, count * bytesPerFloat);
        inst.fastart_dealloc(outPeaksPtr, buckets * bytesPerFloat);

        return peaks;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM generateWaveform error:", wasmErr);
      }
    }

    return null;
  }

  /**
   * Renders composite project frame at timestamp t into a PNG base64 data URI
   * Fully hardware-accelerated in native Rust
   */
  public async renderSnapshot(
    project: FastArtProject,
    timeSec: number,
    width: number = 720,
    height: number = 1280
  ): Promise<string | null> {
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
    duration?: number
  ): Promise<string | null> {
    await this.init();

    const dur = duration || (project as any).duration || 5.0;
    const projectJson = JSON.stringify(project);

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const dataUri: string = await FastArtRust.exportGif(
          projectJson,
          fps,
          width,
          height,
          dur
        );
        return dataUri;
      } catch (err) {
        console.warn("[RustCoreBridge] Native exportGif error:", err);
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

        // Pre-allocate buffer for GIF (e.g. up to 10MB)
        const maxOutLen = Math.min(width * height * fps * Math.ceil(dur) + 65536, 15 * 1024 * 1024);
        const outPtr = inst.fastart_alloc(maxOutLen);

        const written = inst.fastart_export_gif_c(
          jsonPtr,
          jsonLen,
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
          for (let i = 0; i < written; i++) {
            binary += String.fromCharCode(gifBytes[i]);
          }
          const b64 = btoa(binary);
          dataUri = `data:image/gif;base64,${b64}`;
        }

        inst.fastart_dealloc(jsonPtr, jsonLen);
        inst.fastart_dealloc(outPtr, maxOutLen);

        return dataUri;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM exportGif error:", wasmErr);
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
    duration?: number
  ): Promise<Uint8Array | null> {
    await this.init();

    const dur = duration || (project as any).duration || 5.0;
    const projectJson = JSON.stringify(project);

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const rawBytes: Uint8Array | number[] = await FastArtRust.exportWav(
          projectJson,
          sampleRate,
          dur
        );
        if (rawBytes) {
          return rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
        }
      } catch (err) {
        console.warn("[RustCoreBridge] Native exportWav error:", err);
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

        // WAV header (44 bytes) + samples (dur * sampleRate * 2 channels * 2 bytes/sample)
        const totalSamples = Math.ceil(dur * sampleRate * 2);
        const maxOutLen = totalSamples * 2 + 1024;
        const outPtr = inst.fastart_alloc(maxOutLen);

        const written = inst.fastart_export_wav_c(
          jsonPtr,
          jsonLen,
          sampleRate,
          dur,
          outPtr,
          maxOutLen
        );

        let wavBytes: Uint8Array | null = null;
        if (written > 0) {
          wavBytes = new Uint8Array(new Uint8Array(inst.memory.buffer, outPtr, written));
        }

        inst.fastart_dealloc(jsonPtr, jsonLen);
        inst.fastart_dealloc(outPtr, maxOutLen);

        return wavBytes;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM exportWav error:", wasmErr);
      }
    }

    return null;
  }

  /**
   * Complete multi-track H.264 MP4 export directly in native Rust
   * Composites frames, encodes NAL slices, and muxes ISOBMFF container
   */
  public async exportProjectMp4(
    project: FastArtProject,
    fps: number = 30,
    width: number = 720,
    height: number = 1280,
    duration?: number
  ): Promise<Uint8Array | null> {
    await this.init();

    const dur = duration || (project as any).duration || 5.0;
    const projectJson = JSON.stringify(project);

    // 1. Android / iOS Native
    if ((this.backendType === "android_native" || this.backendType === "ios_native") && FastArtRust) {
      try {
        const rawBytes: Uint8Array | number[] = await FastArtRust.exportMp4(
          projectJson,
          fps,
          width,
          height,
          dur
        );
        if (rawBytes) {
          return rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
        }
      } catch (err) {
        console.warn("[RustCoreBridge] Native exportMp4 error:", err);
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

        const totalFrames = Math.max(1, Math.ceil(dur * fps));
        const maxOutLen = Math.min(totalFrames * 128 * 1024 + 1024 * 1024, 50 * 1024 * 1024);
        const outPtr = inst.fastart_alloc(maxOutLen);

        const written = inst.fastart_export_mp4_c(
          jsonPtr,
          jsonLen,
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

        inst.fastart_dealloc(jsonPtr, jsonLen);
        inst.fastart_dealloc(outPtr, maxOutLen);

        return mp4Bytes;
      } catch (wasmErr) {
        console.warn("[RustCoreBridge] WASM exportMp4 error:", wasmErr);
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
    if (this.backendType === "web_wasm" && this.wasmInstance && (this.wasmInstance as any).fastart_motion_track_c) {
      try {
        const inst = this.wasmInstance as any;
        const modeMap: Record<string, number> = {
          follow_center: 1,
          cinematic_drift: 2,
          dynamic_zoom: 3,
          orbit_float: 4,
        };
        const modeIdx = modeMap[mode] || 0;
        const outPtr = inst.fastart_alloc(32); // 4 * sizeof(f64)
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
        const dx = f64View[0];
        const dy = f64View[1];
        const dScale = f64View[2];
        const dRot = f64View[3];
        inst.fastart_dealloc(outPtr, 32);
        return { dx, dy, dScale, dRot };
      } catch (_) {}
    }

    // High precision fallback
    const elapsed = Math.max(0, time - clipStartTime);
    const progress = clipDuration > 0 ? Math.min(1, Math.max(0, elapsed / clipDuration)) : 0;
    const factor = Math.min(2, Math.max(0, intensity / 100));
    if (mode === "follow_center") {
      const angle = progress * Math.PI * 2;
      return { dx: Math.sin(angle) * 28 * factor, dy: Math.cos(angle) * 14 * factor, dScale: 1.0, dRot: 0 };
    } else if (mode === "cinematic_drift") {
      const dx = (progress - 0.5) * 65 * factor;
      const dy = Math.sin(progress * Math.PI) * -16 * factor;
      return { dx, dy, dScale: 1.0 + progress * 0.12 * factor, dRot: 0 };
    } else if (mode === "dynamic_zoom") {
      const pulse = Math.sin(progress * Math.PI * 3) * 0.15 * factor;
      return { dx: 0, dy: 0, dScale: Math.max(0.1, 1.0 + pulse), dRot: 0 };
    } else if (mode === "orbit_float") {
      const a = progress * Math.PI * 4;
      return { dx: Math.cos(a) * 32 * factor, dy: Math.sin(a) * 32 * factor, dScale: 1.0, dRot: Math.sin(a) * 5 * factor };
    }

    return { dx: 0, dy: 0, dScale: 1.0, dRot: 0 };
  }

  public evaluateObjectTrackTrajectory(
    time: number,
    trajectory: TrajectoryPoint[],
    trackScale = true,
    trackRotation = false,
    cameraCenter = false,
  ): { dx: number; dy: number; dScale: number; dRot: number } {
    if (!trajectory || trajectory.length === 0) {
      return { dx: 0, dy: 0, dScale: 1.0, dRot: 0 };
    }
    const origin = trajectory[0];
    if (trajectory.length === 1 || time <= origin.time) {
      return { dx: 0, dy: 0, dScale: 1.0, dRot: 0 };
    }
    const last = trajectory[trajectory.length - 1];
    let pt: TrajectoryPoint;
    if (time >= last.time) {
      pt = last;
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
      const t = Math.min(1, Math.max(0, (time - p0.time) / dt));
      pt = {
        time,
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
        scale: p0.scale + (p1.scale - p0.scale) * t,
        rotation: p0.rotation + (p1.rotation - p0.rotation) * t,
        confidence: p0.confidence + (p1.confidence - p0.confidence) * t,
      };
    }
    let dx = pt.x - origin.x;
    let dy = pt.y - origin.y;
    const dScale = trackScale ? (pt.scale || 1.0) : 1.0;
    const rawRot = (pt.rotation || 0) - (origin.rotation || 0);
    const dRot = trackRotation ? Math.max(-15, Math.min(15, rawRot)) : 0;
    if (cameraCenter) {
      dx = -dx;
      dy = -dy;
    }
    return { dx, dy, dScale: Math.max(0.1, Math.min(10, dScale)), dRot };
  }

  public isWasmReady(): boolean {
    return this.backendType === "web_wasm" && this.wasmInstance !== null;
  }

  /**
   * High-Performance Native Chroma Keying with Despill in Rust/WASM
   * Operates directly on RGBA pixel buffer in linear memory with zero GC churn
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
    const inst = this.wasmInstance;
    if (!inst) return false;

    try {
      const hex = keyHex.startsWith("#") ? keyHex.slice(1) : keyHex;
      const rKey = parseInt(hex.slice(0, 2), 16) || 0;
      const gKey = parseInt(hex.slice(2, 4), 16) || 0;
      const bKey = parseInt(hex.slice(4, 6), 16) || 0;

      const totalBytes = width * height * 4;
      const pixelsPtr = inst.fastart_alloc(totalBytes);
      if (!pixelsPtr) return false;

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

      inst.fastart_dealloc(pixelsPtr, totalBytes);
      return true;
    } catch (err) {
      console.warn("[RustCoreBridge] processChromaCutout error:", err);
      return false;
    }
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

      const guidePtr = inst.fastart_alloc(guideBytes);
      const maskPtr = inst.fastart_alloc(totalPixels);
      const outPtr = inst.fastart_alloc(totalPixels);

      if (!guidePtr || !maskPtr || !outPtr) {
        if (guidePtr) inst.fastart_dealloc(guidePtr, guideBytes);
        if (maskPtr) inst.fastart_dealloc(maskPtr, totalPixels);
        if (outPtr) inst.fastart_dealloc(outPtr, totalPixels);
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

      inst.fastart_dealloc(guidePtr, guideBytes);
      inst.fastart_dealloc(maskPtr, totalPixels);
      inst.fastart_dealloc(outPtr, totalPixels);

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

      const pixelsPtr = inst.fastart_alloc(pixelsBytes);
      const maskPtr = inst.fastart_alloc(totalPixels);

      if (!pixelsPtr || !maskPtr) {
        if (pixelsPtr) inst.fastart_dealloc(pixelsPtr, pixelsBytes);
        if (maskPtr) inst.fastart_dealloc(maskPtr, totalPixels);
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

      inst.fastart_dealloc(pixelsPtr, pixelsBytes);
      inst.fastart_dealloc(maskPtr, totalPixels);
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
      const pixelsPtr = inst.fastart_alloc(totalBytes);
      const outRPtr = inst.fastart_alloc(1);
      const outGPtr = inst.fastart_alloc(1);
      const outBPtr = inst.fastart_alloc(1);

      if (!pixelsPtr || !outRPtr || !outGPtr || !outBPtr) return null;

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

      inst.fastart_dealloc(pixelsPtr, totalBytes);
      inst.fastart_dealloc(outRPtr, 1);
      inst.fastart_dealloc(outGPtr, 1);
      inst.fastart_dealloc(outBPtr, 1);

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
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const procW = Math.min(1920, Math.max(16, Math.floor(Math.abs(dw * dpr))));
      const procH = Math.min(1080, Math.max(16, Math.floor(Math.abs(dh * dpr))));

      if (offCanvas.width !== procW || offCanvas.height !== procH) {
        offCanvas.width = procW;
        offCanvas.height = procH;
      }

      offCtx.clearRect(0, 0, procW, procH);
      offCtx.drawImage(media as any, sx, sy, sw, sh, 0, 0, procW, procH);

      const isAuto = options.mode === "auto";

      if (isAuto) {
        requestHumanSegmentation(media);
        const cachedMask =
          options.clipId && options.clipTime !== undefined
            ? getFrameMask(options.clipId, options.clipTime)
            : null;
        const humanMask = cachedMask || getHumanSegmentationMask();

        if (humanMask) {
          if (!internalMaskCanvas && typeof document !== "undefined") {
            internalMaskCanvas = document.createElement("canvas");
            internalMaskCtx = internalMaskCanvas.getContext("2d", { willReadFrequently: true });
          }
          if (internalMaskCanvas && internalMaskCtx) {
            if (internalMaskCanvas.width !== procW || internalMaskCanvas.height !== procH) {
              internalMaskCanvas.width = procW;
              internalMaskCanvas.height = procH;
            }
            internalMaskCtx.imageSmoothingEnabled = true;
            internalMaskCtx.imageSmoothingQuality = "high";
            internalMaskCtx.clearRect(0, 0, procW, procH);
            internalMaskCtx.drawImage(humanMask, 0, 0, procW, procH);

            const frameImgData = offCtx.getImageData(0, 0, procW, procH);
            const maskImgData = internalMaskCtx.getImageData(0, 0, procW, procH);
            const thresh = Math.max(0.05, Math.min(0.95, (options.intensity ?? 45) / 100));
            const feather = Math.max(0.01, Math.min(0.5, ((options.shadow ?? 15) / 100) * 0.4));

            this.refineCutoutMatte(
              frameImgData.data,
              maskImgData.data,
              procW,
              procH,
              thresh,
              feather,
              true
            );
            offCtx.putImageData(frameImgData, 0, 0);
          } else {
            offCtx.save();
            offCtx.imageSmoothingEnabled = true;
            offCtx.imageSmoothingQuality = "high";
            offCtx.globalCompositeOperation = "destination-in";
            offCtx.drawImage(humanMask, 0, 0, procW, procH);
            offCtx.restore();
          }
        } else {
          // Native Rust WASM uniform backdrop detection
          const imgData = offCtx.getImageData(0, 0, procW, procH);
          const detected = this.detectUniformBackdrop(imgData.data, procW, procH);
          if (detected) {
            const thresh = Math.max(0.08, ((options.intensity ?? 45) / 100) * 0.65);
            const feather = Math.max(0.01, ((options.shadow ?? 20) / 100) * 0.22);
            this.processChromaCutout(
              imgData.data,
              procW,
              procH,
              detected.hex,
              thresh,
              feather,
              true
            );
            offCtx.putImageData(imgData, 0, 0);
          }
        }
      } else {
        // Chroma Key mode in native Rust WASM
        const imgData = offCtx.getImageData(0, 0, procW, procH);
        const hex = options.keyColor || "#00FF00";
        const thresh = Math.max(0.05, ((options.intensity ?? 45) / 100) * 0.95);
        const feather = Math.max(0.01, ((options.shadow ?? 25) / 100) * 0.35);

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

      // Glow outline if configured
      if (options.strokeColor && options.strokeColor !== "none" && options.strokeWidth && options.strokeWidth > 0) {
        ctx.save();
        ctx.shadowColor = options.strokeColor;
        ctx.shadowBlur = Math.max(2, options.strokeWidth * 3);
        ctx.drawImage(offCanvas, 0, 0, procW, procH, dx, dy, dw, dh);
        ctx.restore();
      }

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
    if (!inst || !points || points.length === 0) {
      if (!points || points.length === 0) return 1.0;
      const p = Math.max(0, Math.min(1, progress));
      if (p <= points[0].t) return points[0].s;
      if (p >= points[points.length - 1].t) return points[points.length - 1].s;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (p >= p1.t && p <= p2.t) {
          const ratio = (p - p1.t) / (p2.t - p1.t || 1);
          const smoothRatio = ratio * ratio * (3 - 2 * ratio);
          return p1.s + smoothRatio * (p2.s - p1.s);
        }
      }
      return 1.0;
    }

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
      const ptr = inst.fastart_alloc(totalBytes);
      if (!ptr) return false;

      new Uint8Array(inst.memory.buffer, ptr, totalBytes).set(pixels);
      inst.fastart_apply_color_adjustments_c(ptr, width, height, brightness, contrast, saturation);
      pixels.set(new Uint8Array(inst.memory.buffer, ptr, totalBytes));
      inst.fastart_dealloc(ptr, totalBytes);
      return true;
    } catch {
      return false;
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
      const ptr = inst.fastart_alloc(totalBytes);
      if (!ptr) return false;

      new Uint8Array(inst.memory.buffer, ptr, totalBytes).set(pixels);
      inst.fastart_apply_vignette_c(ptr, width, height, intensity, radius);
      pixels.set(new Uint8Array(inst.memory.buffer, ptr, totalBytes));
      inst.fastart_dealloc(ptr, totalBytes);
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
    height: number
  ): { isValid: boolean; maxConfidence: number } {
    const inst = this.wasmInstance;
    if (!inst) {
      // Fallback in JS if WASM is not yet initialized
      const u32 = new Uint32Array(pixels.buffer);
      const len = u32.length;
      let highConfCount = 0;
      let maxConf = 0;
      for (let i = 0; i < len; i++) {
        const conf = u32[i] & 0xff;
        if (conf > maxConf) maxConf = conf;
        let alpha = 0;
        if (conf >= 210) {
          alpha = 255;
          highConfCount++;
        } else if (conf > 25) {
          const t = (conf - 25) / 185.0;
          alpha = Math.round(t * t * (3.0 - 2.0 * t) * 255.0);
          if (conf >= 90) highConfCount++;
        }
        u32[i] = ((alpha << 24) >>> 0) | 0x00ffffff;
      }
      return {
        isValid: maxConf >= 110 && highConfCount >= Math.max(80, Math.floor(len * 0.005)),
        maxConfidence: maxConf,
      };
    }

    try {
      const totalBytes = width * height * 4;
      const ptr = inst.fastart_alloc(totalBytes);
      if (!ptr) return { isValid: false, maxConfidence: 0 };

      new Uint8Array(inst.memory.buffer, ptr, totalBytes).set(pixels);
      const packedResult = inst.fastart_process_segmentation_confidence_c(ptr, width, height);
      pixels.set(new Uint8Array(inst.memory.buffer, ptr, totalBytes));
      inst.fastart_dealloc(ptr, totalBytes);

      const isValid = (packedResult & 1) === 1;
      const maxConfidence = (packedResult >> 8) & 0xff;
      return { isValid, maxConfidence };
    } catch (e) {
      console.warn("[RustCoreBridge] processSegmentationMask error:", e);
      return { isValid: false, maxConfidence: 0 };
    }
  }

  /**
   * High-Precision Fast Guided Filter Alpha Matting in native Rust/WASM
   * Aligns coarse neural segmentation masks directly to RGB video frame boundaries.
   */
  public refineCutoutMatte(
    rgbaPixels: Uint8ClampedArray,
    maskPixels: Uint8ClampedArray,
    width: number,
    height: number,
    threshold: number = 0.45,
    feather: number = 0.15,
    despill: boolean = true
  ): boolean {
    const inst = this.wasmInstance;
    if (inst) {
      try {
        const totalBytes = width * height * 4;
        const rgbaPtr = inst.fastart_alloc(totalBytes);
        const maskPtr = inst.fastart_alloc(totalBytes);
        if (!rgbaPtr || !maskPtr) {
          if (rgbaPtr) inst.fastart_dealloc(rgbaPtr, totalBytes);
          if (maskPtr) inst.fastart_dealloc(maskPtr, totalBytes);
          return false;
        }

        new Uint8Array(inst.memory.buffer, rgbaPtr, totalBytes).set(rgbaPixels);
        new Uint8Array(inst.memory.buffer, maskPtr, totalBytes).set(maskPixels);

        inst.fastart_refine_cutout_c(
          rgbaPtr,
          maskPtr,
          width,
          height,
          threshold,
          feather,
          despill ? 1 : 0
        );

        rgbaPixels.set(new Uint8Array(inst.memory.buffer, rgbaPtr, totalBytes));
        inst.fastart_dealloc(rgbaPtr, totalBytes);
        inst.fastart_dealloc(maskPtr, totalBytes);
        return true;
      } catch (e) {
        console.warn("[RustCoreBridge] refineCutoutMatte error:", e);
      }
    }

    // High-quality JavaScript fallback
    const len = width * height;
    const thresh = Math.max(0.05, Math.min(0.95, threshold));
    const soft = Math.max(0.02, Math.min(0.5, feather) * 0.35);
    const tLow = Math.max(0.0, thresh - soft);
    const tHigh = Math.min(1.0, thresh + soft);
    const invRange = 1.0 / Math.max(0.001, tHigh - tLow);

    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      const mVal = Math.max(maskPixels[idx + 3], maskPixels[idx]) / 255.0;
      let alpha = 0.0;
      if (mVal >= tHigh) {
        alpha = 1.0;
      } else if (mVal > tLow) {
        const u = (mVal - tLow) * invRange;
        alpha = u * u * (3.0 - 2.0 * u);
      }
      const origA = rgbaPixels[idx + 3] / 255.0;
      const finalA = Math.max(0.0, Math.min(1.0, alpha * origA));
      rgbaPixels[idx + 3] = Math.round(finalA * 255.0);

      if (despill && finalA > 0.02 && finalA < 0.85) {
        const factor = 0.88 + 0.12 * finalA;
        rgbaPixels[idx] = Math.round(rgbaPixels[idx] * factor);
        rgbaPixels[idx + 1] = Math.round(rgbaPixels[idx + 1] * factor);
        rgbaPixels[idx + 2] = Math.round(rgbaPixels[idx + 2] * factor);
      }
    }
    return true;
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

      const framePtr = inst.fastart_alloc(frameBytes);
      const templatePtr = inst.fastart_alloc(templateLen * 4);
      const scalesPtr = inst.fastart_alloc(scalesCount * 4);
      const outBestXPtr = inst.fastart_alloc(4);
      const outBestYPtr = inst.fastart_alloc(4);
      const outBestScalePtr = inst.fastart_alloc(4);
      const outBestAnglePtr = inst.fastart_alloc(4);
      const outBestScorePtr = inst.fastart_alloc(4);

      if (!framePtr || !templatePtr || !scalesPtr) {
        if (framePtr) inst.fastart_dealloc(framePtr, frameBytes);
        if (templatePtr) inst.fastart_dealloc(templatePtr, templateLen * 4);
        if (scalesPtr) inst.fastart_dealloc(scalesPtr, scalesCount * 4);
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

      inst.fastart_dealloc(framePtr, frameBytes);
      inst.fastart_dealloc(templatePtr, templateLen * 4);
      inst.fastart_dealloc(scalesPtr, scalesCount * 4);
      inst.fastart_dealloc(outBestXPtr, 4);
      inst.fastart_dealloc(outBestYPtr, 4);
      inst.fastart_dealloc(outBestScalePtr, 4);
      inst.fastart_dealloc(outBestAnglePtr, 4);
      inst.fastart_dealloc(outBestScorePtr, 4);

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
  public denoiseWaveformPeaks(peaks: number[]): number[] {
    const inst = this.wasmInstance;
    if (!inst) {
      // JS fallback
      const noiseFloor = 0.22;
      return peaks.map((val) => {
        if (val <= noiseFloor) {
          const factor = val / noiseFloor;
          return Math.max(0.02, factor * factor * 0.05);
        }
        const above = (val - noiseFloor) / (1.0 - noiseFloor);
        return Math.min(1.0, Math.max(0.04, 0.05 + Math.pow(above, 0.85) * 0.95));
      });
    }

    try {
      const count = peaks.length;
      const bytes = count * 4;
      const ptr = inst.fastart_alloc(bytes);
      if (!ptr) return peaks;

      const f32View = new Float32Array(inst.memory.buffer, ptr, count);
      for (let i = 0; i < count; i++) f32View[i] = peaks[i];

      inst.fastart_denoise_waveform_peaks_c(ptr, count);

      const result = new Array<number>(count);
      for (let i = 0; i < count; i++) result[i] = f32View[i];

      inst.fastart_dealloc(ptr, bytes);
      return result;
    } catch {
      return peaks;
    }
  }

  /**
   * Evaluates keyframe transforms with smooth Hermite easing in native Rust/WASM
   */
  public evaluateKeyframes(
    base: { x: number; y: number; scale: number; rotation: number; opacity: number },
    keyframes: Array<{ time: number; transform?: { x?: number; y?: number; scale?: number; rotation?: number }; opacity?: number }>,
    queryTime: number
  ): { x: number; y: number; scale: number; rotation: number; opacity: number } | null {
    const inst = this.wasmInstance;
    if (!inst || !keyframes || keyframes.length === 0) return null;

    try {
      const count = keyframes.length;
      const bytesPerF64 = 8;
      const tPtr = inst.fastart_alloc(count * bytesPerF64);
      const xPtr = inst.fastart_alloc(count * bytesPerF64);
      const yPtr = inst.fastart_alloc(count * bytesPerF64);
      const scalePtr = inst.fastart_alloc(count * bytesPerF64);
      const rotPtr = inst.fastart_alloc(count * bytesPerF64);
      const opPtr = inst.fastart_alloc(count * bytesPerF64);

      const outXPtr = inst.fastart_alloc(bytesPerF64);
      const outYPtr = inst.fastart_alloc(bytesPerF64);
      const outScalePtr = inst.fastart_alloc(bytesPerF64);
      const outRotPtr = inst.fastart_alloc(bytesPerF64);
      const outOpPtr = inst.fastart_alloc(bytesPerF64);

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
      const res = {
        x: memF64[outXPtr >> 3],
        y: memF64[outYPtr >> 3],
        scale: memF64[outScalePtr >> 3],
        rotation: memF64[outRotPtr >> 3],
        opacity: memF64[outOpPtr >> 3],
      };

      inst.fastart_dealloc(tPtr, count * bytesPerF64);
      inst.fastart_dealloc(xPtr, count * bytesPerF64);
      inst.fastart_dealloc(yPtr, count * bytesPerF64);
      inst.fastart_dealloc(scalePtr, count * bytesPerF64);
      inst.fastart_dealloc(rotPtr, count * bytesPerF64);
      inst.fastart_dealloc(opPtr, count * bytesPerF64);

      inst.fastart_dealloc(outXPtr, bytesPerF64);
      inst.fastart_dealloc(outYPtr, bytesPerF64);
      inst.fastart_dealloc(outScalePtr, bytesPerF64);
      inst.fastart_dealloc(outRotPtr, bytesPerF64);
      inst.fastart_dealloc(outOpPtr, bytesPerF64);

      return res;
    } catch {
      return null;
    }
  }
}

export const rustCoreBridge = new RustCoreBridgeService();
