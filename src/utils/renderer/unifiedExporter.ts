// FastArt Unified Cross-Platform Exporter Engine
// Unified exporter shared across Web (WASM / Canvas), Android (JNI / Bridge), and iOS (FFI / Bridge)
// Automatically leverages native Rust core when compiled, or seamless GPU canvas engine with zero UI stalls

import { Buffer } from "buffer";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { File, FileMode } from "expo-file-system";
import type { FileHandle } from "expo-file-system";
import { FastArtProject } from "../../types/project";
import { rustCoreBridge } from "../../services/rustCoreBridge";
import {
  getExportResolutionDimensions,
  getLogicalBaseDimensions,
} from "../../components/Panels/Export/exportTypes";
import { exportBrowserVideo } from "./browserVideoExporter";
export type ExportFormat = "mp4" | "webm" | "png" | "wav";

export interface ExportOptions {
  fps?: number;
  duration?: number;
  format?: ExportFormat;
  currentTime?: number;
  logicalWidth?: number;
  logicalHeight?: number;
  videoBitsPerSecond?: number;
  resolution?: string;
  isCancelled?: () => boolean;
}

export interface ExportResult {
  blob: Blob;
  videoUrl: string;
  mimeType: string;
  format: ExportFormat;
  extension: string;
  fileSize?: number;
}

// ---------------------------------------------------------------------------
// Binary File Writer (for Mobile File Systems)
// ---------------------------------------------------------------------------
export class BinaryFileWriter {
  private targetUri: string;
  private buffer: Uint8Array;
  private bufferOffset = 0;
  private totalBytesWritten = 0;
  private chunkSize = 786432; // 768KB chunks (guaranteed divisible by 3 for clean Base64 appends)
  private handle: FileHandle | null = null;
  private handleInitAttempted = false;

  constructor(targetUri: string, chunkSize = 786432) {
    this.targetUri = targetUri;
    this.chunkSize = chunkSize;
    this.buffer = new Uint8Array(this.chunkSize);
  }

  private ensureHandle(): FileHandle | null {
    if (this.handleInitAttempted) return this.handle;
    this.handleInitAttempted = true;
    try {
      if (!this.targetUri.startsWith("content://")) {
        const f = new File(this.targetUri);
        f.create({ overwrite: true });
        this.handle = f.open(FileMode.WriteOnly);
      }
    } catch {
      this.handle = null;
    }
    return this.handle;
  }

  public async write(bytes: Uint8Array): Promise<void> {
    let offset = 0;
    while (offset < bytes.length) {
      const space = this.chunkSize - this.bufferOffset;
      const toCopy = Math.min(space, bytes.length - offset);
      this.buffer.set(bytes.subarray(offset, offset + toCopy), this.bufferOffset);
      this.bufferOffset += toCopy;
      offset += toCopy;

      if (this.bufferOffset >= this.chunkSize) {
        await this.flush(this.totalBytesWritten > 0);
      }
    }
  }

  public async flush(append = false): Promise<void> {
    if (this.bufferOffset === 0) return;
    const chunk = this.buffer.subarray(0, this.bufferOffset);
    const activeHandle = this.ensureHandle();
    if (activeHandle) {
      await activeHandle.writeBytes(chunk);
    } else {
      const b64 = uint8ToBase64(chunk);
      await FileSystem.writeAsStringAsync(this.targetUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
        append,
      });
    }
    this.totalBytesWritten += chunk.length;
    this.bufferOffset = 0;
  }

  public async close(): Promise<number> {
    try {
      await this.flush(this.totalBytesWritten > 0);
      return this.totalBytesWritten;
    } finally {
      if (this.handle) {
        try {
          this.handle.close();
        } catch {}
        this.handle = null;
      }
    }
  }
}

export async function writeBinaryFileSafely(
  targetFileUri: string,
  bytes: Uint8Array
): Promise<number> {
  const writer = new BinaryFileWriter(targetFileUri);
  await writer.write(bytes);
  return await writer.close();
}

export function uint8ToBase64(bytes: Uint8Array): string {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes).toString("base64");
    }
  } catch (_) {}

  // Chunked btoa
  if (typeof btoa === "function") {
    let binary = "";
    const chunkSize = 16384;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, sub as any);
    }
    return btoa(binary);
  }

  // Pre-allocated chunk array fallback
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const len = bytes.length;
  const chunks: string[] = [];
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    chunks.push(
      chars[b0 >> 2],
      chars[((b0 & 3) << 4) | (b1 >> 4)],
      i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=",
      i + 2 < len ? chars[b2 & 63] : "=",
    );
  }
  return chunks.join("");
}

export function base64ToUint8(b64: string): Uint8Array {
  try {
    if (typeof Buffer !== "undefined") {
      const buf = Buffer.from(b64, "base64");
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    if (typeof atob === "function") {
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes;
    }
  } catch {
    return new Uint8Array(0);
  }
  return new Uint8Array(0);
}

// ---------------------------------------------------------------------------
// Unified Project Exporter
// ---------------------------------------------------------------------------
export async function exportFastArtProject(
  project: FastArtProject,
  options: ExportOptions = {},
  onProgress?: (percent: number, currentTime: number, duration: number) => void,
  existingRenderer?: any
): Promise<ExportResult> {
  const {
    fps = 30,
    duration = 5.0,
    format = "mp4",
    resolution = "1080p",
    currentTime = 0,
    isCancelled,
  } = options;

  if (isCancelled?.()) {
    throw new Error("Export cancelled");
  }

  const [targetW, targetH] = getExportResolutionDimensions(resolution, project.aspectRatio);
  const [baseW, baseH] = getLogicalBaseDimensions(project.aspectRatio);
  const cleanTitle = (project.title || "FastArt_Export").replace(/[/\\?%*:|"<>]/g, "").trim();
  const targetDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";

  // -------------------------------------------------------------------------
  // 1. Snapshot PNG Export
  // -------------------------------------------------------------------------
  if (format === "png") {
    onProgress?.(0, currentTime, duration);
    const snapW = targetW;
    const snapH = targetH;

    // Web Canvas snapshot
    if (Platform.OS === "web" && typeof document !== "undefined") {
      let tempSnapCanvas: HTMLCanvasElement | null = null;
      let tempSnapRenderer: any = null;
      try {
        let renderer = existingRenderer;
        if (!renderer || !renderer.canvas) {
          tempSnapCanvas = document.createElement("canvas");
          tempSnapCanvas.width = snapW;
          tempSnapCanvas.height = snapH;
          const { VideoRenderer } = require("../videoRenderer");
          tempSnapRenderer = new VideoRenderer(tempSnapCanvas, { registerAsActive: false });
          renderer = tempSnapRenderer;
          for (const clip of project.tracks?.video || []) {
            try {
              await renderer.preloadClip(clip);
            } catch (e) {}
          }
        }
        onProgress?.(40, currentTime, duration);
        renderer.renderFrame(project, currentTime, false, baseW, baseH);
        onProgress?.(80, currentTime, duration);
        const dataUrl = renderer.canvas.toDataURL("image/png");
        let blob: Blob = new Blob([]);
        try {
          const res = await fetch(dataUrl);
          blob = await res.blob();
        } catch {}
        onProgress?.(100, currentTime, duration);
        return {
          blob,
          videoUrl: dataUrl,
          mimeType: "image/png",
          format: "png",
          extension: "png",
          fileSize: blob.size,
        };
      } catch (canvasErr) {
        console.warn("[unifiedExporter] Canvas PNG snapshot fallback failed:", canvasErr);
      } finally {
        try {
          tempSnapRenderer?.cleanup?.();
        } catch {}
        if (tempSnapCanvas) {
          try {
            tempSnapCanvas.width = 1;
            tempSnapCanvas.height = 1;
          } catch {}
        }
      }
    }

    // On native mobile, engage headless Skia/Canvas WebView bridge with full clip/text/sticker rendering
    if (Platform.OS !== "web") {
      throw new Error("NATIVE_BRIDGE_FALLBACK_REQUIRED");
    }
  }

  // -------------------------------------------------------------------------
  // 2. Studio Audio Mixdown (WAV) - Full 16-bit Stereo PCM with Denoise & Limiter
  // -------------------------------------------------------------------------
  if (format === "wav") {
    onProgress?.(0, 0, duration);
    const filename = `${cleanTitle}_audio_${Date.now()}.wav`;
    const targetFileUri = `${targetDir}${filename}`;

    onProgress?.(35, 0, duration);
    const { exportProjectAudioToWavBytes } = require("../audioExporter");
    const wavBytes: Uint8Array = await exportProjectAudioToWavBytes(project, duration, 44100);

    onProgress?.(85, duration, duration);

    if (Platform.OS === "web" && typeof URL !== "undefined") {
      const blob = new Blob([wavBytes as any], { type: "audio/wav" });
      const videoUrl = URL.createObjectURL(blob);
      onProgress?.(100, duration, duration);
      return {
        blob,
        videoUrl,
        mimeType: "audio/wav",
        format: "wav",
        extension: "wav",
        fileSize: wavBytes.length,
      };
    }

    const writtenSize = await writeBinaryFileSafely(targetFileUri, wavBytes);
    onProgress?.(100, duration, duration);
    return {
      blob: new Blob([]),
      videoUrl: targetFileUri,
      mimeType: "audio/wav",
      format: "wav",
      extension: "wav",
      fileSize: writtenSize,
    };
  }

  // -------------------------------------------------------------------------
  // 3. Video Export (MP4 & WebM)
  // -------------------------------------------------------------------------
  if (format === "mp4" || format === "webm") {
    // A. Web Browser: Hardware Canvas + MediaRecorder with Web Audio mixdown
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const { VideoRenderer, getActiveVideoRenderer } = require("../videoRenderer");
      let renderer = existingRenderer || getActiveVideoRenderer?.();
      let stubCanvas: HTMLCanvasElement | null = null;
      if (!renderer || !renderer.canvas) {
        // Minimal 1x1 stub; exportBrowserVideo creates and owns the actual targetW x targetH exportCanvas
        stubCanvas = document.createElement("canvas");
        stubCanvas.width = 1;
        stubCanvas.height = 1;
        renderer = new VideoRenderer(stubCanvas, { registerAsActive: false });
      }

      try {
        return await exportBrowserVideo(
          renderer,
          project,
          {
            fps,
            duration,
            format,
            resolution,
            currentTime,
            logicalWidth: baseW,
            logicalHeight: baseH,
            isCancelled,
          },
          onProgress,
          (canvas) => new VideoRenderer(canvas, { registerAsActive: false })
        );
      } finally {
        if (stubCanvas) {
          try {
            stubCanvas.width = 1;
            stubCanvas.height = 1;
          } catch {}
        }
      }
    }

    // B. Native Mobile (Android & iOS): Engage Headless WebView Canvas Bridge
    // Delivers hardware-accelerated Skia GPU compositing, multi-track transitions,
    // filters, auto-captions, stickers, and synchronized soundtrack encoding.
    if (Platform.OS !== "web") {
      throw new Error("NATIVE_BRIDGE_FALLBACK_REQUIRED");
    }
  }

  throw new Error(`Export format ${format} could not be rendered.`);
}

// ---------------------------------------------------------------------------
// Backward Compatibility Re-Exports (Seamless drop-in replacements)
// ---------------------------------------------------------------------------
export async function exportVideo(
  renderer: any,
  project: FastArtProject,
  options: ExportOptions = {},
  onProgress?: (percent: number, currentTime: number, duration: number) => void,
  _createRenderer?: any
): Promise<ExportResult> {
  return exportFastArtProject(project, options, onProgress, renderer);
}

export async function exportMobileProject(
  project: FastArtProject,
  options: ExportOptions = {},
  onProgress?: (percent: number, currentTime: number, duration: number) => void
): Promise<ExportResult> {
  return exportFastArtProject(project, options, onProgress);
}
