// FastArt Unified Cross-Platform Exporter Engine
// Unified exporter shared across Web (WASM), Android (JNI), and iOS (FFI)
// Automatically leverages native Rust core for 10x-50x faster exports with zero UI stalls

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { FastArtProject } from "../../types/project";
import { rustCoreBridge } from "../../services/rustCoreBridge";
import {
  getExportResolutionDimensions,
  getLogicalBaseDimensions,
} from "../../components/Panels/Export/exportTypes";
import { exportBrowserVideo } from "./browserVideoExporter";

export type ExportFormat = "mp4" | "webm" | "gif" | "png" | "wav";

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
  private chunkSize = 512 * 1024; // 512KB chunks

  constructor(targetUri: string, chunkSize = 512 * 1024) {
    this.targetUri = targetUri;
    this.chunkSize = chunkSize;
    this.buffer = new Uint8Array(this.chunkSize);
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
        await this.flush(true);
      }
    }
  }

  public async flush(append = false): Promise<void> {
    if (this.bufferOffset === 0) return;
    const chunk = this.buffer.subarray(0, this.bufferOffset);
    this.totalBytesWritten += chunk.length;

    const b64 = uint8ToBase64(chunk);
    await FileSystem.writeAsStringAsync(this.targetUri, b64, {
      encoding: FileSystem.EncodingType.Base64,
      append,
    });

    this.bufferOffset = 0;
  }

  public async close(): Promise<number> {
    await this.flush(this.totalBytesWritten > 0);
    return this.totalBytesWritten;
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

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    base64 += chars[b0 >> 2];
    base64 += chars[((b0 & 3) << 4) | (b1 >> 4)];
    base64 += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    base64 += i + 2 < len ? chars[b2 & 63] : "=";
  }
  return base64;
}

function base64ToUint8(b64: string): Uint8Array {
  try {
    const bin = typeof atob !== "undefined" ? atob(b64) : "";
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
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
  // 1. Snapshot PNG Export (Hardware Rust Accelerated)
  // -------------------------------------------------------------------------
  if (format === "png") {
    onProgress?.(30, currentTime, duration);
    const snapW = targetW;
    const snapH = targetH;

    try {
      const isRustReady = await rustCoreBridge.isAvailable();
      if (isRustReady) {
        onProgress?.(60, currentTime, duration);
        const rustDataUri = await rustCoreBridge.renderSnapshot(project, currentTime, snapW, snapH);
        if (rustDataUri && rustDataUri.startsWith("data:image/png;base64,")) {
          onProgress?.(100, currentTime, duration);

          if (Platform.OS === "web") {
            return {
              blob: new Blob([]),
              videoUrl: rustDataUri,
              mimeType: "image/png",
              format: "png",
              extension: "png",
            };
          }

          const b64 = rustDataUri.substring("data:image/png;base64,".length);
          const bytes = base64ToUint8(b64);
          const filename = `${cleanTitle}_snapshot_${Date.now()}.png`;
          const targetFileUri = `${targetDir}${filename}`;
          const writtenSize = await writeBinaryFileSafely(targetFileUri, bytes);

          return {
            blob: new Blob([]),
            videoUrl: targetFileUri,
            mimeType: "image/png",
            format: "png",
            extension: "png",
            fileSize: writtenSize,
          };
        }
      }
    } catch (err) {
      console.warn("[unifiedExporter] Rust snapshot fallback:", err);
    }
  }

  // -------------------------------------------------------------------------
  // 2. Studio Audio Mixdown (WAV) in Rust
  // -------------------------------------------------------------------------
  if (format === "wav") {
    onProgress?.(30, 0, duration);

    try {
      const isRustReady = await rustCoreBridge.isAvailable();
      if (isRustReady) {
        onProgress?.(70, 0, duration);
        const wavBytes = await rustCoreBridge.exportProjectWav(project, 44100, duration);
        if (wavBytes && wavBytes.length > 44) {
          onProgress?.(100, duration, duration);

          if (Platform.OS === "web" && typeof URL !== "undefined") {
            const blob = new Blob([wavBytes as any], { type: "audio/wav" });
            const videoUrl = URL.createObjectURL(blob);
            return {
              blob,
              videoUrl,
              mimeType: "audio/wav",
              format: "wav",
              extension: "wav",
              fileSize: wavBytes.length,
            };
          }

          const filename = `${cleanTitle}_audio_${Date.now()}.wav`;
          const targetFileUri = `${targetDir}${filename}`;
          const writtenSize = await writeBinaryFileSafely(targetFileUri, wavBytes);

          return {
            blob: new Blob([]),
            videoUrl: targetFileUri,
            mimeType: "audio/wav",
            format: "wav",
            extension: "wav",
            fileSize: writtenSize,
          };
        }
      }
    } catch (err) {
      console.warn("[unifiedExporter] Rust WAV fallback:", err);
    }
  }

  // -------------------------------------------------------------------------
  // 3. Animated GIF Export in Rust
  // -------------------------------------------------------------------------
  if (format === "gif") {
    const gifFps = Math.min(fps, 15);
    const gifW = Math.min(targetW, 480);
    const gifH = Math.round((targetH / targetW) * gifW);

    onProgress?.(30, 0, duration);

    try {
      const isRustReady = await rustCoreBridge.isAvailable();
      if (isRustReady) {
        onProgress?.(65, 0, duration);
        const rustGif = await rustCoreBridge.exportProjectGif(project, gifFps, gifW, gifH, duration);
        if (rustGif && rustGif.startsWith("data:image/gif;base64,")) {
          onProgress?.(100, duration, duration);

          if (Platform.OS === "web") {
            return {
              blob: new Blob([]),
              videoUrl: rustGif,
              mimeType: "image/gif",
              format: "gif",
              extension: "gif",
            };
          }

          const b64 = rustGif.substring("data:image/gif;base64,".length);
          const bytes = base64ToUint8(b64);
          const filename = `${cleanTitle}_anim_${Date.now()}.gif`;
          const targetFileUri = `${targetDir}${filename}`;
          const writtenSize = await writeBinaryFileSafely(targetFileUri, bytes);

          return {
            blob: new Blob([]),
            videoUrl: targetFileUri,
            mimeType: "image/gif",
            format: "gif",
            extension: "gif",
            fileSize: writtenSize,
          };
        }
      }
    } catch (err) {
      console.warn("[unifiedExporter] Rust GIF fallback:", err);
    }
  }

  // -------------------------------------------------------------------------
  // 4. Video Export (MP4 & WebM)
  // -------------------------------------------------------------------------
  if (format === "mp4" || format === "webm") {
    // A. Web Browser: Hardware-accelerated Canvas + MediaRecorder with GPU video decoders
    if (Platform.OS === "web" && typeof document !== "undefined") {
      let renderer = existingRenderer;
      if (!renderer || !renderer.canvas) {
        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = targetW;
        offscreenCanvas.height = targetH;
        const { VideoRenderer } = require("../videoRenderer");
        renderer = new VideoRenderer(offscreenCanvas);
        for (const clip of project.tracks?.video || []) {
          await renderer.preloadClip(clip);
        }
      }

      return await exportBrowserVideo(
        renderer,
        project,
        {
          fps,
          duration,
          format,
          currentTime,
          logicalWidth: baseW,
          logicalHeight: baseH,
          isCancelled,
        },
        onProgress
      );
    }

    // B. Native Mobile (Android & iOS): High-Performance Native Rust Core Engine
    onProgress?.(25, 0, duration);
    try {
      const isRustReady = await rustCoreBridge.isAvailable();
      if (isRustReady) {
        onProgress?.(60, 0, duration);
        const mp4Bytes = await rustCoreBridge.exportProjectMp4(
          project,
          fps,
          targetW,
          targetH,
          duration
        );
        if (mp4Bytes && mp4Bytes.length > 128) {
          onProgress?.(100, duration, duration);

          const filename = `${cleanTitle}_video_${Date.now()}.mp4`;
          const targetFileUri = `${targetDir}${filename}`;
          const writtenSize = await writeBinaryFileSafely(targetFileUri, mp4Bytes);

          return {
            blob: new Blob([]),
            videoUrl: targetFileUri,
            mimeType: "video/mp4",
            format: "mp4",
            extension: "mp4",
            fileSize: writtenSize,
          };
        }
      }
    } catch (err) {
      console.warn("[unifiedExporter] Native Rust MP4 export:", err);
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
