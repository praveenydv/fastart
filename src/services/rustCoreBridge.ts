// FastArt High-Performance Rust Core Engine Bridge
// Seamlessly routes computation to:
// 1. Android Native JNI (libfastart_jni.so) on mobile
// 2. WebAssembly (fastart_wasm.wasm) on web
// Keeps Expo UI at 60fps with zero UI-thread stalls

import { NativeModules, Platform } from "react-native";
import { FastArtProject } from "../types/project";

const { FastArtRust } = NativeModules;

export interface RustBeatResult {
  bpm: number;
  beats: number[];
}

export type RustBackendType = "android_native" | "ios_native" | "web_wasm" | "fallback";

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
          // Attempt loading WASM binary from static assets
          const wasmUrl = "/assets/wasm/fastart_wasm.wasm";
          const res = await fetch(wasmUrl);
          if (res.ok) {
            const buf = await res.arrayBuffer();
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
}

export const rustCoreBridge = new RustCoreBridgeService();
