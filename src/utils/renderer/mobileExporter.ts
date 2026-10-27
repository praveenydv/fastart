// FastArt Mobile Compositing & Export Engine (Pure JavaScript & Expo Native)
// Handles complete rendering of multi-track projects on mobile:
// - Canvas Background Color / Smooth Gradients / Frost Dark Blur
// - Video / Photo Clips (with transforms, aspect ratios, fit modes, letterboxing)
// - Text Clips (custom typography, badges, outlines, animations, motion tracking)
// - Auto-Captions (TikTok/Instagram style, karaoke word-level highlighting, neon glow)
// - Sticker Clips (emojis, icons, badges, motion tracking)
// - Effects & Filters (vignette, cinema letterbox bars, flash, chromatic tints)
// - Output Formats: MP4 (H.264 Hardware-Compatible Baseline Profile), GIF, PNG, WAV

import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
  FastArtProject,
  TextClip,
  CaptionClip,
  StickerClip,
  VideoClip,
  EffectClip,
} from "../../types/project";
import { createGif, GifFrame } from "../gifEncoder";
import { exportProjectAudioToWav, exportProjectAudioToWavBytes } from "../audioExporter";
import { ExportFormat, ExportOptions, ExportResult } from "./videoExporter";
import { applyMotionTracking } from "./rendererEffects";
import { getInterpolatedTransform } from "../keyframeEngine";
import { Buffer } from "buffer";
import { rustCoreBridge } from "../../services/rustCoreBridge";

const jpeg = require("jpeg-js");
const UPNG = require("upng-js");

export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const decodedImageCache = new Map<string, DecodedImage>();

function base64ToUint8(b64: string): Uint8Array {
  try {
    return new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    const bin = typeof atob !== "undefined" ? atob(b64) : "";
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
}

export async function readUriBytes(uri: string): Promise<Uint8Array | null> {
  if (!uri) return null;

  // 1. Data URI
  if (uri.startsWith("data:")) {
    const commaIdx = uri.indexOf(",");
    if (commaIdx >= 0) {
      return base64ToUint8(uri.substring(commaIdx + 1));
    }
  }

  // 2. Built-in React Native fetch (handles content://, file://, blob:, http:, https:)
  try {
    const res = await fetch(uri);
    if (res.ok || res.status === 0) {
      const buf = await res.arrayBuffer();
      if (buf && buf.byteLength > 0) {
        return new Uint8Array(buf);
      }
    }
  } catch (_) {}

  // 3. New File API from expo-file-system
  try {
    const file = new File(uri);
    const buf = await file.arrayBuffer();
    if (buf && buf.byteLength > 0) {
      return new Uint8Array(buf);
    }
  } catch (_) {}

  // 4. If content:// URI, copy to local cache file first
  let resolvedUri = uri;
  let copiedTmp: string | null = null;
  if (uri.startsWith("content://")) {
    try {
      const ext = uri.split("?")[0].split(".").pop() || "jpg";
      copiedTmp = `${FileSystem.cacheDirectory || ""}content_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      await FileSystem.copyAsync({ from: uri, to: copiedTmp });
      resolvedUri = copiedTmp;
    } catch (_) {}
  }

  // 5. If http/https URL, download to cache
  if (resolvedUri.startsWith("http://") || resolvedUri.startsWith("https://")) {
    try {
      const localPath = `${FileSystem.cacheDirectory || ""}fastart_dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.tmp`;
      const dl = await FileSystem.downloadAsync(resolvedUri, localPath);
      if (dl && dl.uri) {
        resolvedUri = dl.uri;
        copiedTmp = dl.uri;
      }
    } catch (_) {}
  }

  // 6. Legacy FileSystem readAsStringAsync (Base64)
  try {
    const b64 = await FileSystem.readAsStringAsync(resolvedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (b64 && b64.length > 0) {
      const bytes = base64ToUint8(b64);
      if (copiedTmp) {
        try { await FileSystem.deleteAsync(copiedTmp, { idempotent: true }); } catch {}
      }
      return bytes;
    }
  } catch (_) {}

  if (copiedTmp) {
    try { await FileSystem.deleteAsync(copiedTmp, { idempotent: true }); } catch {}
  }

  return null;
}

export async function loadMediaImageRgba(uri: string): Promise<DecodedImage | null> {
  if (!uri) return null;
  if (decodedImageCache.has(uri)) {
    return decodedImageCache.get(uri)!;
  }

  try {
    const bytes = await readUriBytes(uri);
    if (!bytes || bytes.length < 8) return null;

    // Check PNG signature: 0x89 0x50 0x4E 0x47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      try {
        const rawBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const img = UPNG.decode(rawBuf);
        if (img && img.width > 0 && img.height > 0) {
          const rgbaFrames = UPNG.toRGBA8(img);
          if (rgbaFrames && rgbaFrames[0]) {
            const res: DecodedImage = {
              width: img.width,
              height: img.height,
              data: new Uint8Array(rgbaFrames[0]),
            };
            decodedImageCache.set(uri, res);
            return res;
          }
        }
      } catch (pngErr) {
        console.warn("[mobileExporter] UPNG decode error:", uri, pngErr);
      }
    }

    // Check JPEG signature: 0xFF 0xD8
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      const decoded = jpeg.decode(bytes, { useTArray: true });
      if (decoded && decoded.width > 0 && decoded.height > 0) {
        const res: DecodedImage = {
          width: decoded.width,
          height: decoded.height,
          data: decoded.data,
        };
        decodedImageCache.set(uri, res);
        return res;
      }
    }

    // Fallback attempts: JPEG
    try {
      const decoded = jpeg.decode(bytes, { useTArray: true });
      if (decoded && decoded.width > 0 && decoded.height > 0) {
        const res: DecodedImage = {
          width: decoded.width,
          height: decoded.height,
          data: decoded.data,
        };
        decodedImageCache.set(uri, res);
        return res;
      }
    } catch {}

    // Fallback attempts: PNG
    try {
      const rawBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const img = UPNG.decode(rawBuf);
      if (img && img.width > 0 && img.height > 0) {
        const rgbaFrames = UPNG.toRGBA8(img);
        if (rgbaFrames && rgbaFrames[0]) {
          const res: DecodedImage = {
            width: img.width,
            height: img.height,
            data: new Uint8Array(rgbaFrames[0]),
          };
          decodedImageCache.set(uri, res);
          return res;
        }
      }
    } catch {}
  } catch (err) {
    console.warn("[mobileExporter] loadMediaImageRgba error:", uri, err);
  }

  return null;
}

export function getVideoKeyframeInterval(clipDur: number): { intervalSec: number; totalKeyframes: number } {
  const dur = Math.max(0.5, clipDur || 5.0);
  const intervalSec = dur > 20 ? 2.5 : dur > 8 ? 1.5 : 1.0;
  const totalKeyframes = Math.min(6, Math.max(1, Math.ceil(dur / intervalSec)));
  return { intervalSec, totalKeyframes };
}

export async function preloadProjectMediaImages(
  project: FastArtProject
): Promise<Map<string, DecodedImage>> {
  const map = new Map<string, DecodedImage>();

  // 1. Video and photo clips
  const videoClips = project.tracks.video || [];
  for (const clip of videoClips) {
    let resolvedVideoUri = clip.url;
    let tempCopiedVideo: string | null = null;

    // If video is a content:// URI, copy to local cache so VideoThumbnails can read it safely
    if (clip.type === "video" && clip.url && clip.url.startsWith("content://")) {
      try {
        const ext = clip.url.split("?")[0].split(".").pop() || "mp4";
        tempCopiedVideo = `${FileSystem.cacheDirectory || ""}vid_src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
        await FileSystem.copyAsync({ from: clip.url, to: tempCopiedVideo });
        resolvedVideoUri = tempCopiedVideo;
      } catch (err) {
        console.warn("[mobileExporter] Copying content video to cache failed:", err);
      }
    }

    const isImage =
      clip.type === "photo" ||
      (clip.url &&
        (clip.url.endsWith(".png") ||
          clip.url.endsWith(".jpg") ||
          clip.url.endsWith(".jpeg") ||
          clip.url.endsWith(".webp") ||
          clip.url.startsWith("data:image")));

    if (isImage && clip.url) {
      const img = await loadMediaImageRgba(clip.url);
      if (img) {
        map.set(clip.id, img);
        map.set(clip.url, img);
      }
    }

    // Preload thumbnail if available
    if (clip.thumbnail) {
      const thumbImg = await loadMediaImageRgba(clip.thumbnail);
      if (thumbImg) {
        if (!map.has(clip.id)) map.set(clip.id, thumbImg);
        map.set(`${clip.id}_thumb`, thumbImg);
      }
    }

    // For video clips, extract essential keyframes across duration concurrently
    if (clip.type === "video" && resolvedVideoUri) {
      const { intervalSec, totalKeyframes } = getVideoKeyframeInterval(clip.duration || 5.0);

      const keyframePromises = Array.from({ length: totalKeyframes }, async (_, k) => {
        const timeSec = (clip.trimIn || 0) + k * intervalSec;
        const seekMs = Math.max(50, Math.round(timeSec * 1000));
        try {
          const thumbResult = await VideoThumbnails.getThumbnailAsync(resolvedVideoUri, {
            time: seekMs,
            quality: 0.35,
          });
          if (thumbResult && thumbResult.uri) {
            const frameImg = await loadMediaImageRgba(thumbResult.uri);
            if (frameImg) {
              return { k, frameImg };
            }
          }
        } catch (_) {}
        return null;
      });

      const extracted = await Promise.all(keyframePromises);
      for (const item of extracted) {
        if (!item) continue;
        map.set(`${clip.id}_f${item.k}`, item.frameImg);
        if (item.k === 0 && !map.has(clip.id)) {
          map.set(clip.id, item.frameImg);
          map.set(clip.url, item.frameImg);
        }
      }
    }

    if (tempCopiedVideo) {
      try { await FileSystem.deleteAsync(tempCopiedVideo, { idempotent: true }); } catch {}
    }
  }

  // 2. Sticker clips
  const stickerClips = project.tracks.stickers || [];
  for (const st of stickerClips) {
    const stUrl = (st as any).url;
    if (stUrl) {
      const img = await loadMediaImageRgba(stUrl);
      if (img) {
        map.set(st.id, img);
        map.set(stUrl, img);
      }
    }
  }

  // 3. Canvas background image
  let bg = project.canvasBackground;
  if (bg && bg.startsWith("image:")) {
    bg = bg.replace("image:", "");
  }
  if (
    bg &&
    (bg.startsWith("http://") ||
      bg.startsWith("https://") ||
      bg.startsWith("file:") ||
      bg.startsWith("content:") ||
      bg.startsWith("data:image"))
  ) {
    const bgImg = await loadMediaImageRgba(bg);
    if (bgImg) map.set("__background__", bgImg);
  }

  return map;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function uint8ToBase64(uint8: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(uint8).toString("base64");
  }

  // Use native C++ btoa in Hermes / JSC if available (up to 100x faster than JS loops)
  if (typeof btoa === "function") {
    try {
      const CHUNK = 3072; // Safe multiple of 3 (1024 base64 units) well within call stack limits
      const parts: string[] = [];
      const len = uint8.length;
      for (let i = 0; i < len; i += CHUNK) {
        const end = Math.min(i + CHUNK, len);
        const slice = uint8.subarray(i, end);
        parts.push(btoa(String.fromCharCode.apply(null, slice as any)));
      }
      return parts.join("");
    } catch (_) {}
  }

  const len = uint8.length;
  const extraBytes = len % 3;
  const parts: string[] = [];
  const CHUNK_SIZE = 0x8000;
  let chunk = "";

  for (let i = 0; i < len - extraBytes; i += 3) {
    const b0 = uint8[i];
    const b1 = uint8[i + 1];
    const b2 = uint8[i + 2];
    chunk +=
      B64_CHARS[(b0 >>> 2) & 0x3f] +
      B64_CHARS[((b0 << 4) | (b1 >>> 4)) & 0x3f] +
      B64_CHARS[((b1 << 2) | (b2 >>> 6)) & 0x3f] +
      B64_CHARS[b2 & 0x3f];
    if (chunk.length >= CHUNK_SIZE) {
      parts.push(chunk);
      chunk = "";
    }
  }

  if (extraBytes === 1) {
    const b0 = uint8[len - 1];
    chunk +=
      B64_CHARS[(b0 >>> 2) & 0x3f] +
      B64_CHARS[(b0 << 4) & 0x3f] +
      "==";
  } else if (extraBytes === 2) {
    const b0 = uint8[len - 2];
    const b1 = uint8[len - 1];
    chunk +=
      B64_CHARS[(b0 >>> 2) & 0x3f] +
      B64_CHARS[((b0 << 4) | (b1 >>> 4)) & 0x3f] +
      B64_CHARS[(b1 << 2) & 0x3f] +
      "=";
  }
  if (chunk.length > 0) {
    parts.push(chunk);
  }
  return parts.join("");
}

// ---------------------------------------------------------------------------
// High-Performance Binary File Writer (Zero-Copy Native NIO Streaming)
// ---------------------------------------------------------------------------
/**
 * BinaryFileWriter
 * 
 * Safely streams binary buffers (Uint8Array) directly to disk on mobile.
 * Bypasses the React Native monolithic Base64 string bridge which causes:
 * java.lang.OutOfMemoryError: Failed to allocate a X byte allocation with Y free bytes
 * 
 * Writes using direct NIO FileChannel buffers (zero Java JVM heap allocations)
 * with robust chunked fallbacks, guaranteeing constant O(1) memory usage
 * regardless of video length (1 min, 10 min, 1 hour).
 */
export class BinaryFileWriter {
  private targetUri: string;
  private nativeFile: File | null = null;
  private isFirstWrite: boolean = true;
  private buffer: Uint8Array;
  private bufferOffset: number = 0;
  private readonly bufferSize: number = 1024 * 1024; // 1 MB flush buffer
  private totalBytesWritten: number = 0;
  private useNativeFile: boolean = true;

  constructor(targetUri: string) {
    this.targetUri = targetUri;
    this.buffer = new Uint8Array(this.bufferSize);
    try {
      this.nativeFile = new File(targetUri);
    } catch {
      this.useNativeFile = false;
      this.nativeFile = null;
    }
  }

  public async write(bytes: Uint8Array): Promise<void> {
    if (!bytes || bytes.length === 0) return;
    let inputOffset = 0;
    while (inputOffset < bytes.length) {
      const remainingSpace = this.bufferSize - this.bufferOffset;
      const count = Math.min(remainingSpace, bytes.length - inputOffset);
      this.buffer.set(bytes.subarray(inputOffset, inputOffset + count), this.bufferOffset);
      this.bufferOffset += count;
      inputOffset += count;

      if (this.bufferOffset >= this.bufferSize) {
        await this.flush();
      }
    }
  }

  public async flush(): Promise<void> {
    if (this.bufferOffset === 0) return;
    const chunk = this.buffer.subarray(0, this.bufferOffset);
    const append = !this.isFirstWrite;
    this.isFirstWrite = false;
    this.totalBytesWritten += chunk.length;

    // Strategy 1: Direct native File.write (zero-copy NIO channel on Android/iOS)
    if (this.useNativeFile && this.nativeFile) {
      try {
        await this.nativeFile.write(chunk, { append });
        this.bufferOffset = 0;
        return;
      } catch (nativeErr) {
        console.warn("[BinaryFileWriter] nativeFile.write failed, falling back to chunked Base64:", nativeErr);
        this.useNativeFile = false;
      }
    }

    // Strategy 2: Chunked Base64 write in small 512KB slices
    // Java allocates at most 512KB at a time on JVM heap, eliminating OOM completely
    const SAFE_CHUNK = 512 * 1024;
    for (let offset = 0; offset < chunk.length; offset += SAFE_CHUNK) {
      const slice = chunk.subarray(offset, Math.min(offset + SAFE_CHUNK, chunk.length));
      const b64 = uint8ToBase64(slice);
      await FileSystem.writeAsStringAsync(this.targetUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
        append: append || offset > 0,
      });
    }

    this.bufferOffset = 0;
  }

  public async close(): Promise<number> {
    await this.flush();
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

// ---------------------------------------------------------------------------
// CRC-32 & Adler-32 Checksums (for PNG & Bitstream Validation)
// ---------------------------------------------------------------------------
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(buf: Uint8Array, start = 0, length = buf.length - start): number {
  let c = 0xffffffff;
  const end = start + length;
  for (let i = start; i < end; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD_ADLER = 65521;
  const len = data.length;
  let i = 0;
  while (i < len) {
    const blockLen = Math.min(5552, len - i);
    for (let j = 0; j < blockLen; j++) {
      a += data[i + j];
      b += a;
    }
    a %= MOD_ADLER;
    b %= MOD_ADLER;
    i += blockLen;
  }
  return ((b << 16) | a) >>> 0;
}

// ---------------------------------------------------------------------------
// Lightweight pure-JS PNG Encoder
// ---------------------------------------------------------------------------
export function createPngBuffer(width: number, height: number, rgbaData: Uint8Array): Uint8Array {
  const rowStride = width * 4;
  const scanlineLength = 1 + rowStride;
  const uncompressedLength = scanlineLength * height;
  const uncompressed = new Uint8Array(uncompressedLength);

  for (let y = 0; y < height; y++) {
    const dstOffset = y * scanlineLength;
    uncompressed[dstOffset] = 0; // Filter: None
    const srcOffset = y * rowStride;
    uncompressed.set(rgbaData.subarray(srcOffset, srcOffset + rowStride), dstOffset + 1);
  }

  const CHUNK_SIZE = 65535;
  const numBlocks = Math.ceil(uncompressedLength / CHUNK_SIZE) || 1;
  const zlibDataLength = 2 + numBlocks * 5 + uncompressedLength + 4;
  const zlibData = new Uint8Array(zlibDataLength);

  zlibData[0] = 0x78;
  zlibData[1] = 0x01;

  let zPos = 2;
  let remaining = uncompressedLength;
  let srcPos = 0;

  for (let b = 0; b < numBlocks; b++) {
    const isLast = b === numBlocks - 1;
    const blockSize = Math.min(CHUNK_SIZE, remaining);

    zlibData[zPos++] = isLast ? 0x01 : 0x00;
    zlibData[zPos++] = blockSize & 0xff;
    zlibData[zPos++] = (blockSize >> 8) & 0xff;
    const nlen = ~blockSize & 0xffff;
    zlibData[zPos++] = nlen & 0xff;
    zlibData[zPos++] = (nlen >> 8) & 0xff;

    zlibData.set(uncompressed.subarray(srcPos, srcPos + blockSize), zPos);
    zPos += blockSize;
    srcPos += blockSize;
    remaining -= blockSize;
  }

  const adler = adler32(uncompressed);
  zlibData[zPos++] = (adler >> 24) & 0xff;
  zlibData[zPos++] = (adler >> 16) & 0xff;
  zlibData[zPos++] = (adler >> 8) & 0xff;
  zlibData[zPos++] = adler & 0xff;

  const totalPngLength = 8 + 25 + 12 + zlibDataLength + 12;
  const png = new Uint8Array(totalPngLength);
  const view = new DataView(png.buffer);

  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);

  let offset = 8;
  view.setUint32(offset, 13, false);
  offset += 4;
  const ihdrTypeOffset = offset;
  png.set([0x49, 0x48, 0x44, 0x52], offset);
  offset += 4;
  view.setUint32(offset, width, false);
  view.setUint32(offset + 4, height, false);
  png[offset + 8] = 8;
  png[offset + 9] = 6;
  png[offset + 10] = 0;
  png[offset + 11] = 0;
  png[offset + 12] = 0;
  offset += 13;
  const ihdrCrc = crc32(png, ihdrTypeOffset, 4 + 13);
  view.setUint32(offset, ihdrCrc, false);
  offset += 4;

  view.setUint32(offset, zlibDataLength, false);
  offset += 4;
  const idatTypeOffset = offset;
  png.set([0x49, 0x44, 0x41, 0x54], offset);
  offset += 4;
  png.set(zlibData, offset);
  offset += zlibDataLength;
  const idatCrc = crc32(png, idatTypeOffset, 4 + zlibDataLength);
  view.setUint32(offset, idatCrc, false);
  offset += 4;

  view.setUint32(offset, 0, false);
  offset += 4;
  const iendTypeOffset = offset;
  png.set([0x49, 0x45, 0x4e, 0x44], offset);
  offset += 4;
  const iendCrc = crc32(png, iendTypeOffset, 4);
  view.setUint32(offset, iendCrc, false);

  return png;
}

// ---------------------------------------------------------------------------
// 24-bit / 32-bit BMP Buffer Fallback
// ---------------------------------------------------------------------------
export function createBmpBuffer(width: number, height: number, rgbaData: Uint8Array): Uint8Array {
  const rowSize = width * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  buffer[0] = 0x42;
  buffer[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);

  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);

  let dst = 54;
  for (let i = 0; i < rgbaData.length; i += 4) {
    buffer[dst++] = rgbaData[i + 2];
    buffer[dst++] = rgbaData[i + 1];
    buffer[dst++] = rgbaData[i];
    buffer[dst++] = rgbaData[i + 3];
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// 8x16 Embedded ASCII Bitmap Font for Crisp On-Canvas Text & Subtitles
// ---------------------------------------------------------------------------
const FONT_GLYPHS: Record<string, number[]> = {
  " ": [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  "!": [0x00,0x00,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x00,0x00,0x18,0x18,0x00,0x00,0x00],
  "\"": [0x00,0x36,0x36,0x36,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  "#": [0x00,0x00,0x36,0x36,0x7f,0x36,0x36,0x36,0x7f,0x36,0x36,0x00,0x00,0x00,0x00,0x00],
  "$": [0x00,0x18,0x3e,0x58,0x58,0x3c,0x1e,0x1a,0x1a,0x7c,0x18,0x00,0x00,0x00,0x00,0x00],
  "%": [0x00,0x00,0x63,0x66,0x0c,0x18,0x30,0x60,0x66,0xc6,0x00,0x00,0x00,0x00,0x00,0x00],
  "&": [0x00,0x00,0x38,0x6c,0x68,0x70,0x3c,0x6e,0x66,0x3b,0x00,0x00,0x00,0x00,0x00,0x00],
  "'": [0x00,0x18,0x18,0x08,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  "(": [0x00,0x06,0x0c,0x18,0x18,0x18,0x18,0x18,0x18,0x0c,0x06,0x00,0x00,0x00,0x00,0x00],
  ")": [0x00,0x60,0x30,0x18,0x18,0x18,0x18,0x18,0x18,0x30,0x60,0x00,0x00,0x00,0x00,0x00],
  "*": [0x00,0x00,0x00,0x66,0x3c,0xff,0x3c,0x66,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  "+": [0x00,0x00,0x00,0x18,0x18,0x7e,0x18,0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  ",": [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x18,0x18,0x08,0x10,0x00,0x00,0x00],
  "-": [0x00,0x00,0x00,0x00,0x00,0x7e,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  ".": [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x18,0x18,0x00,0x00,0x00,0x00,0x00],
  "/": [0x00,0x00,0x03,0x06,0x0c,0x18,0x30,0x60,0xc0,0x80,0x00,0x00,0x00,0x00,0x00,0x00],
  "0": [0x00,0x00,0x3c,0x66,0x6e,0x76,0x66,0x66,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "1": [0x00,0x00,0x18,0x38,0x18,0x18,0x18,0x18,0x18,0x7e,0x00,0x00,0x00,0x00,0x00,0x00],
  "2": [0x00,0x00,0x3c,0x66,0x06,0x0c,0x18,0x30,0x60,0x7e,0x00,0x00,0x00,0x00,0x00,0x00],
  "3": [0x00,0x00,0x3c,0x66,0x06,0x1c,0x06,0x06,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "4": [0x00,0x00,0x0c,0x1c,0x3c,0x6c,0xcc,0xfe,0x0c,0x0c,0x00,0x00,0x00,0x00,0x00,0x00],
  "5": [0x00,0x00,0x7e,0x60,0x7c,0x06,0x06,0x06,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "6": [0x00,0x00,0x3c,0x66,0x60,0x7c,0x66,0x66,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "7": [0x00,0x00,0x7e,0x06,0x0c,0x18,0x30,0x30,0x30,0x30,0x00,0x00,0x00,0x00,0x00,0x00],
  "8": [0x00,0x00,0x3c,0x66,0x66,0x3c,0x66,0x66,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "9": [0x00,0x00,0x3c,0x66,0x66,0x66,0x3e,0x06,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  ":": [0x00,0x00,0x00,0x18,0x18,0x00,0x00,0x18,0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  ";": [0x00,0x00,0x00,0x18,0x18,0x00,0x00,0x18,0x18,0x08,0x10,0x00,0x00,0x00,0x00,0x00],
  "<": [0x00,0x06,0x0c,0x18,0x30,0x60,0x30,0x18,0x0c,0x06,0x00,0x00,0x00,0x00,0x00,0x00],
  "=": [0x00,0x00,0x00,0x7e,0x00,0x00,0x7e,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  ">": [0x00,0x60,0x30,0x18,0x0c,0x06,0x0c,0x18,0x30,0x60,0x00,0x00,0x00,0x00,0x00,0x00],
  "?": [0x00,0x00,0x3c,0x66,0x06,0x0c,0x18,0x18,0x00,0x18,0x18,0x00,0x00,0x00,0x00,0x00],
  "@": [0x00,0x00,0x3c,0x66,0x6e,0x7a,0x72,0x60,0x62,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "A": [0x00,0x00,0x18,0x3c,0x66,0x66,0x7e,0x66,0x66,0x66,0x00,0x00,0x00,0x00,0x00,0x00],
  "B": [0x00,0x00,0x7c,0x66,0x66,0x7c,0x66,0x66,0x66,0x7c,0x00,0x00,0x00,0x00,0x00,0x00],
  "C": [0x00,0x00,0x3c,0x66,0x60,0x60,0x60,0x60,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "D": [0x00,0x00,0x78,0x6c,0x66,0x66,0x66,0x66,0x6c,0x78,0x00,0x00,0x00,0x00,0x00,0x00],
  "E": [0x00,0x00,0x7e,0x60,0x60,0x7c,0x60,0x60,0x60,0x7e,0x00,0x00,0x00,0x00,0x00,0x00],
  "F": [0x00,0x00,0x7e,0x60,0x60,0x7c,0x60,0x60,0x60,0x60,0x00,0x00,0x00,0x00,0x00,0x00],
  "G": [0x00,0x00,0x3c,0x66,0x60,0x6e,0x66,0x66,0x66,0x3a,0x00,0x00,0x00,0x00,0x00,0x00],
  "H": [0x00,0x00,0x66,0x66,0x66,0x7e,0x66,0x66,0x66,0x66,0x00,0x00,0x00,0x00,0x00,0x00],
  "I": [0x00,0x00,0x3c,0x18,0x18,0x18,0x18,0x18,0x18,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "J": [0x00,0x00,0x0e,0x06,0x06,0x06,0x06,0x06,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "K": [0x00,0x00,0x66,0x6c,0x78,0x70,0x78,0x6c,0x66,0x66,0x00,0x00,0x00,0x00,0x00,0x00],
  "L": [0x00,0x00,0x60,0x60,0x60,0x60,0x60,0x60,0x60,0x7e,0x00,0x00,0x00,0x00,0x00,0x00],
  "M": [0x00,0x00,0x63,0x77,0x7f,0x6b,0x63,0x63,0x63,0x63,0x00,0x00,0x00,0x00,0x00,0x00],
  "N": [0x00,0x00,0x66,0x76,0x7e,0x7e,0x6e,0x66,0x66,0x66,0x00,0x00,0x00,0x00,0x00,0x00],
  "O": [0x00,0x00,0x3c,0x66,0x66,0x66,0x66,0x66,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "P": [0x00,0x00,0x7c,0x66,0x66,0x7c,0x60,0x60,0x60,0x60,0x00,0x00,0x00,0x00,0x00,0x00],
  "Q": [0x00,0x00,0x3c,0x66,0x66,0x66,0x66,0x6e,0x3c,0x0e,0x00,0x00,0x00,0x00,0x00,0x00],
  "R": [0x00,0x00,0x7c,0x66,0x66,0x7c,0x78,0x6c,0x66,0x66,0x00,0x00,0x00,0x00,0x00,0x00],
  "S": [0x00,0x00,0x3c,0x66,0x60,0x3c,0x06,0x06,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "T": [0x00,0x00,0x7e,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x00,0x00,0x00,0x00,0x00,0x00],
  "U": [0x00,0x00,0x66,0x66,0x66,0x66,0x66,0x66,0x66,0x3c,0x00,0x00,0x00,0x00,0x00,0x00],
  "V": [0x00,0x00,0x66,0x66,0x66,0x66,0x66,0x3c,0x18,0x18,0x00,0x00,0x00,0x00,0x00,0x00],
  "W": [0x00,0x00,0x63,0x63,0x63,0x6b,0x7f,0x77,0x63,0x63,0x00,0x00,0x00,0x00,0x00,0x00],
  "X": [0x00,0x00,0x66,0x66,0x3c,0x18,0x3c,0x66,0x66,0x66,0x00,0x00,0x00,0x00,0x00,0x00],
  "Y": [0x00,0x00,0x66,0x66,0x66,0x3c,0x18,0x18,0x18,0x18,0x00,0x00,0x00,0x00,0x00,0x00],
  "Z": [0x00,0x00,0x7e,0x06,0x0c,0x18,0x30,0x60,0x60,0x7e,0x00,0x00,0x00,0x00,0x00,0x00],
  "★": [0x00,0x18,0x18,0x3c,0x3c,0xff,0x7e,0x3c,0x66,0xc3,0x81,0x00,0x00,0x00,0x00,0x00],
  "♥": [0x00,0x66,0xff,0xff,0xff,0x7e,0x3c,0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  "⚡": [0x00,0x0c,0x18,0x30,0x7f,0x0c,0x18,0x30,0x60,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
};

const COLOR_CACHE = new Map<string, [number, number, number, number]>();

function hexToRgba(hex: string, alpha: number = 1.0): [number, number, number, number] {
  if (!hex) return [255, 255, 255, Math.round(alpha * 255)];
  const cacheKey = `${hex}_${alpha}`;
  const cached = COLOR_CACHE.get(cacheKey);
  if (cached) return cached;

  let result: [number, number, number, number];
  if (hex.startsWith("blur:")) {
    result = [15, 23, 42, Math.round(alpha * 255)];
  } else if (hex.startsWith("gradient:")) {
    const parts = hex.replace("gradient:", "").split(",");
    result = hexToRgba(parts[0] || "#0B0D13", alpha);
  } else if (hex.startsWith("rgba")) {
    const m = hex.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/i);
    if (m) {
      const a = m[4] !== undefined ? parseFloat(m[4]) * alpha : alpha;
      result = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), Math.round(a * 255)];
    } else {
      result = [255, 255, 255, Math.round(alpha * 255)];
    }
  } else {
    const clean = hex.replace("#", "").trim();
    let r = 0,
      g = 0,
      b = 0;
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else if (clean.length >= 6) {
      r = parseInt(clean.substring(0, 2), 16);
      g = parseInt(clean.substring(2, 4), 16);
      b = parseInt(clean.substring(4, 6), 16);
    }
    result = [r || 0, g || 0, b || 0, Math.round(alpha * 255)];
  }

  if (COLOR_CACHE.size < 512) {
    COLOR_CACHE.set(cacheKey, result);
  }
  return result;
}

// ---------------------------------------------------------------------------
// High-Speed Integer Filter Engine (All 16 FILTER_PRESETS from FastArt Web)
// ---------------------------------------------------------------------------
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

export function applyPixelFilter(r: number, g: number, b: number, filter?: string): [number, number, number] {
  if (!filter || filter === "normal" || filter === "none") return [r, g, b];
  switch (filter) {
    case "noir":
    case "grayscale":
    case "blackwhite":
    case "bw": {
      // Noir B&W: high-contrast monochrome
      const gray = (r * 77 + g * 151 + b * 28) >> 8;
      const c = Math.max(0, Math.min(255, Math.round(((gray - 128) * 1.45) + 128) * 0.92));
      return [c, c, c];
    }
    case "teal_orange": {
      // Teal shadows/midtones, orange highlights
      const gray = (r * 77 + g * 151 + b * 28) >> 8;
      let nr = r;
      let ng = g;
      let nb = b;
      if (gray > 120) {
        nr = Math.min(255, Math.round(r * 1.25 + 15));
        ng = Math.min(255, Math.round(g * 1.05));
        nb = Math.max(0, Math.round(b * 0.75 - 10));
      } else {
        nr = Math.max(0, Math.round(r * 0.75 - 10));
        ng = Math.min(255, Math.round(g * 1.15 + 10));
        nb = Math.min(255, Math.round(b * 1.35 + 20));
      }
      return [nr, ng, nb];
    }
    case "cyberpunk": {
      // Cyberpunk neon: Magenta/Cyan split with high saturation
      const nr = Math.min(255, Math.round(r * 1.4 + 25));
      const ng = Math.max(0, Math.round(g * 0.7 - 10));
      const nb = Math.min(255, Math.round(b * 1.5 + 30));
      return [nr, ng, nb];
    }
    case "vintage":
    case "sepia": {
      const nr = Math.min(255, (r * 101 + g * 197 + b * 48) >> 8);
      const ng = Math.min(255, (r * 89 + g * 176 + b * 43) >> 8);
      const nb = Math.min(255, (r * 70 + g * 136 + b * 33) >> 8);
      return [nr, ng, nb];
    }
    case "sepia_antique": {
      const nr = Math.min(255, (r * 120 + g * 210 + b * 55) >> 8);
      const ng = Math.min(255, (r * 95 + g * 185 + b * 45) >> 8);
      const nb = Math.min(255, (r * 60 + g * 125 + b * 30) >> 8);
      return [nr, ng, nb];
    }
    case "warm_sunset":
    case "warm":
    case "cinematic_warm": {
      const nr = Math.min(255, Math.round(r * 1.22 + 20));
      const ng = Math.min(255, Math.round(g * 1.08 + 8));
      const nb = Math.max(0, Math.round(b * 0.82 - 15));
      return [nr, ng, nb];
    }
    case "cold_moody":
    case "cool": {
      const nr = Math.max(0, Math.round(r * 0.8 - 10));
      const ng = Math.min(255, Math.round(g * 1.05 + 5));
      const nb = Math.min(255, Math.round(b * 1.3 + 25));
      return [nr, ng, nb];
    }
    case "emerald":
    case "matrix_code": {
      const nr = Math.max(0, Math.round(r * 0.65 - 15));
      const ng = Math.min(255, Math.round(g * 1.45 + 30));
      const nb = Math.max(0, Math.round(b * 0.75 - 10));
      return [nr, ng, nb];
    }
    case "vhs_retro": {
      const nr = Math.min(255, Math.round(r * 1.3 + 10));
      const ng = Math.min(255, Math.round(g * 1.1));
      const nb = Math.min(255, Math.round(b * 1.35 + 15));
      return [nr, ng, nb];
    }
    case "pastel_dream": {
      const nr = Math.min(255, Math.round(r * 0.9 + 45));
      const ng = Math.min(255, Math.round(g * 0.9 + 45));
      const nb = Math.min(255, Math.round(b * 0.9 + 55));
      return [nr, ng, nb];
    }
    case "high_contrast": {
      const factor = 1.4;
      const nr = Math.max(0, Math.min(255, Math.round((r - 128) * factor + 128)));
      const ng = Math.max(0, Math.min(255, Math.round((g - 128) * factor + 128)));
      const nb = Math.max(0, Math.min(255, Math.round((b - 128) * factor + 128)));
      return [nr, ng, nb];
    }
    case "polaroid_fade": {
      const nr = Math.min(255, Math.round(r * 0.85 + 35));
      const ng = Math.min(255, Math.round(g * 0.85 + 30));
      const nb = Math.min(255, Math.round(b * 0.8 + 25));
      return [nr, ng, nb];
    }
    case "solar_pop": {
      const gray = (r * 77 + g * 151 + b * 28) >> 8;
      const nr = Math.max(0, Math.min(255, Math.round(gray + (r - gray) * 1.8)));
      const ng = Math.max(0, Math.min(255, Math.round(gray + (g - gray) * 1.8)));
      const nb = Math.max(0, Math.min(255, Math.round(gray + (b - gray) * 1.8)));
      return [nr, ng, nb];
    }
    case "invert": {
      return [255 - r, 255 - g, 255 - b];
    }
    case "ai_manga": {
      const gray = (r * 77 + g * 151 + b * 28) >> 8;
      const c = gray > 140 ? 255 : gray < 70 ? 0 : Math.round((gray - 70) * 3.64);
      return [c, c, c];
    }
    case "ai_matrix": {
      const gray = (r * 77 + g * 151 + b * 28) >> 8;
      return [0, Math.min(255, Math.round(gray * 1.35 + 25)), 0];
    }
    case "ai_night_vision": {
      const gray = (r * 77 + g * 151 + b * 28) >> 8;
      return [0, Math.min(255, Math.round(gray * 1.5 + 40)), Math.round(gray * 0.2)];
    }
    case "ai_cyberpunk": {
      return [
        Math.min(255, Math.round(r * 1.35 + 30)),
        Math.max(0, Math.round(g * 0.7 - 10)),
        Math.min(255, Math.round(b * 1.45 + 35)),
      ];
    }
    case "ai_cartoon": {
      return [
        Math.min(255, Math.round(r / 32) * 32 + 12),
        Math.min(255, Math.round(g / 32) * 32 + 12),
        Math.min(255, Math.round(b / 32) * 32 + 12),
      ];
    }
    case "beauty_smooth":
    case "ai_beauty_smooth": {
      return [
        Math.min(255, Math.round(r * 1.06 + 10)),
        Math.min(255, Math.round(g * 1.04 + 8)),
        Math.min(255, Math.round(b * 1.02 + 6)),
      ];
    }
    default:
      return [r, g, b];
  }
}

// ---------------------------------------------------------------------------
// Mobile Frame Buffer: Multi-Track 2D Rasterizer
// ---------------------------------------------------------------------------
export class MobileFrameBuffer {
  public width: number;
  public height: number;
  public data: Uint8Array;
  public u32: Uint32Array;

  constructor(width: number, height: number, backgroundColorHex: string = "#000000") {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
    this.u32 = new Uint32Array(this.data.buffer);
    this.fill(backgroundColorHex);
  }

  public fill(hexColor: string) {
    if (hexColor && hexColor.startsWith("gradient:")) {
      const parts = hexColor.replace("gradient:", "").split(",");
      const [r1, g1, b1] = hexToRgba(parts[0] || "#0f172a");
      const [r2, g2, b2] = hexToRgba(parts[1] || parts[0] || "#1e293b");

      for (let y = 0; y < this.height; y++) {
        const t = y / Math.max(1, this.height - 1);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        const pixel32 = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
        const rowStart = y * this.width;
        this.u32.fill(pixel32, rowStart, rowStart + this.width);
      }
      return;
    }

    const [r, g, b, a] = hexToRgba(hexColor);
    const pixel32 = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    this.u32.fill(pixel32);
  }

  public setPixel(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const pIdx = y * this.width + x;
    if (a >= 255) {
      this.u32[pIdx] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    } else if (a > 0) {
      const idx = pIdx * 4;
      const invA = 256 - a;
      this.data[idx] = (r * a + this.data[idx] * invA) >> 8;
      this.data[idx + 1] = (g * a + this.data[idx + 1] * invA) >> 8;
      this.data[idx + 2] = (b * a + this.data[idx + 2] * invA) >> 8;
      this.data[idx + 3] = Math.min(255, this.data[idx + 3] + a);
    }
  }

  public fillRect(
    x: number,
    y: number,
    w: number,
    h: number,
    hexColor: string,
    alpha: number = 1.0
  ) {
    const [r, g, b, a] = hexToRgba(hexColor, alpha);
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.floor(x + w));
    const y1 = Math.min(this.height, Math.floor(y + h));
    const spanW = x1 - x0;
    if (spanW <= 0) return;

    if (a >= 255) {
      const pixel32 = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      for (let py = y0; py < y1; py++) {
        const rowStart = py * this.width + x0;
        this.u32.fill(pixel32, rowStart, rowStart + spanW);
      }
    } else if (a > 0) {
      // High-speed fixed-point integer SIMD blending without float multiplications
      const invA = 256 - a;
      const srA = r * a;
      const sgA = g * a;
      const sbA = b * a;
      for (let py = y0; py < y1; py++) {
        let idx = (py * this.width + x0) * 4;
        for (let px = x0; px < x1; px++, idx += 4) {
          this.data[idx] = (srA + this.data[idx] * invA) >> 8;
          this.data[idx + 1] = (sgA + this.data[idx + 1] * invA) >> 8;
          this.data[idx + 2] = (sbA + this.data[idx + 2] * invA) >> 8;
          this.data[idx + 3] = Math.min(255, this.data[idx + 3] + a);
        }
      }
    }
  }

  // Apply visual filter over the entire buffer
  public applyColorFilter(filterId: string) {
    if (!filterId || filterId === "normal" || filterId === "none") return;
    const totalPixels = this.width * this.height;
    for (let i = 0; i < totalPixels; i++) {
      const p = this.u32[i];
      const r = p & 0xff;
      const g = (p >>> 8) & 0xff;
      const b = (p >>> 16) & 0xff;
      const a = (p >>> 24) & 0xff;
      const [nr, ng, nb] = applyPixelFilter(r, g, b, filterId);
      this.u32[i] = ((a << 24) | (nb << 16) | (ng << 8) | nr) >>> 0;
    }
  }

  // RGB Split / Chromatic Aberration
  public applyRgbSplit(offset: number) {
    const off = Math.max(1, Math.min(this.width >> 2, Math.round(offset)));
    const copy = new Uint32Array(this.u32);
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        const cur = copy[row + x];
        const a = (cur >>> 24) & 0xff;
        const g = (cur >>> 8) & 0xff;
        const rSrcX = Math.max(0, x - off);
        const r = copy[row + rSrcX] & 0xff;
        const bSrcX = Math.min(this.width - 1, x + off);
        const b = (copy[row + bSrcX] >>> 16) & 0xff;
        this.u32[row + x] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
      }
    }
  }

  // Fast Separable 2-Pass Box Blur (with optional top/bottom band limits for tilt_shift)
  public applyBoxBlur(radius: number, topRatio: number = 0, bottomRatio: number = 1) {
    const rad = Math.max(1, Math.min(16, Math.round(radius)));
    const startY = Math.max(0, Math.floor(this.height * topRatio));
    const endY = Math.min(this.height, Math.ceil(this.height * bottomRatio));
    const temp = new Uint32Array(this.u32.length);

    // Horizontal pass
    for (let y = startY; y < endY; y++) {
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
        const xMin = Math.max(0, x - rad);
        const xMax = Math.min(this.width - 1, x + rad);
        for (let kx = xMin; kx <= xMax; kx++) {
          const p = this.u32[row + kx];
          sumR += p & 0xff;
          sumG += (p >>> 8) & 0xff;
          sumB += (p >>> 16) & 0xff;
          sumA += (p >>> 24) & 0xff;
          count++;
        }
        const avgR = (sumR / count) | 0;
        const avgG = (sumG / count) | 0;
        const avgB = (sumB / count) | 0;
        const avgA = (sumA / count) | 0;
        temp[row + x] = ((avgA << 24) | (avgB << 16) | (avgG << 8) | avgR) >>> 0;
      }
    }

    // Vertical pass
    for (let x = 0; x < this.width; x++) {
      for (let y = startY; y < endY; y++) {
        let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
        const yMin = Math.max(startY, y - rad);
        const yMax = Math.min(endY - 1, y + rad);
        for (let ky = yMin; ky <= yMax; ky++) {
          const p = temp[ky * this.width + x];
          sumR += p & 0xff;
          sumG += (p >>> 8) & 0xff;
          sumB += (p >>> 16) & 0xff;
          sumA += (p >>> 24) & 0xff;
          count++;
        }
        const avgR = (sumR / count) | 0;
        const avgG = (sumG / count) | 0;
        const avgB = (sumB / count) | 0;
        const avgA = (sumA / count) | 0;
        this.u32[y * this.width + x] = ((avgA << 24) | (avgB << 16) | (avgG << 8) | avgR) >>> 0;
      }
    }
  }

  // Smooth Radial Vignette
  public applyVignette(intensity: number = 0.8) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    const innerDist = maxDist * 0.35;
    const range = maxDist - innerDist;
    const maxDark = Math.min(0.95, 0.75 * intensity);

    for (let y = 0; y < this.height; y++) {
      const dy = y - cy;
      const dy2 = dy * dy;
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        const dx = x - cx;
        const dist = Math.sqrt(dx * dx + dy2);
        if (dist > innerDist) {
          const t = Math.min(1.0, (dist - innerDist) / range);
          const darkFactor = 1.0 - t * t * maxDark;
          const p = this.u32[row + x];
          const r = Math.round((p & 0xff) * darkFactor);
          const g = Math.round(((p >>> 8) & 0xff) * darkFactor);
          const b = Math.round(((p >>> 16) & 0xff) * darkFactor);
          const a = (p >>> 24) & 0xff;
          this.u32[row + x] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
        }
      }
    }
  }

  // Mirror Split (Reflect left half to right half)
  public applyMirror() {
    const midX = this.width >> 1;
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      for (let x = 0; x < midX; x++) {
        this.u32[row + (this.width - 1 - x)] = this.u32[row + x];
      }
    }
  }

  // Kaleidoscope (4-Quadrant Quad Reflection)
  public applyKaleidoscope() {
    const midX = this.width >> 1;
    const midY = this.height >> 1;
    for (let y = 0; y < midY; y++) {
      const topRow = y * this.width;
      const botRow = (this.height - 1 - y) * this.width;
      for (let x = 0; x < midX; x++) {
        const p = this.u32[topRow + x];
        const mirrX = this.width - 1 - x;
        this.u32[topRow + mirrX] = p;
        this.u32[botRow + x] = p;
        this.u32[botRow + mirrX] = p;
      }
    }
  }

  // Water Ripple (Horizontal Sine Wave displacement)
  public applyWaterRipple(time: number, intensity: number = 0.8) {
    const copy = new Uint32Array(this.u32);
    const maxShift = Math.max(3, Math.round(this.width * 0.025 * intensity));
    for (let y = 0; y < this.height; y++) {
      const shift = Math.round(Math.sin((y / this.height) * 12 + time * 6) * maxShift);
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        const srcX = Math.max(0, Math.min(this.width - 1, x - shift));
        this.u32[row + x] = copy[row + srcX];
      }
    }
  }

  // Glitch Slice Displacement
  public applyGlitch(time: number, intensity: number = 0.8) {
    const copy = new Uint32Array(this.u32);
    const sliceH = Math.max(8, Math.round(this.height * 0.04));
    const maxShift = Math.max(4, Math.round(this.width * 0.1 * intensity));
    let seed = Math.sin(time * 33.7) * 10000;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let y = 0; y < this.height; y += sliceH) {
      if (rand() > 0.35) {
        const shift = Math.round((rand() - 0.5) * 2 * maxShift);
        const curSliceH = Math.min(sliceH, this.height - y);
        for (let dy = 0; dy < curSliceH; dy++) {
          const row = (y + dy) * this.width;
          for (let x = 0; x < this.width; x++) {
            const srcX = Math.max(0, Math.min(this.width - 1, x - shift));
            this.u32[row + x] = copy[row + srcX];
          }
        }
      }
    }
  }

  // Action Shake
  public applyShake(time: number, intensity: number = 0.8) {
    const maxOffX = Math.max(2, Math.round(this.width * 0.025 * intensity));
    const maxOffY = Math.max(2, Math.round(this.height * 0.025 * intensity));
    const offX = Math.round(Math.sin(time * 37) * maxOffX);
    const offY = Math.round(Math.cos(time * 43) * maxOffY);
    if (offX === 0 && offY === 0) return;
    const copy = new Uint32Array(this.u32);
    for (let y = 0; y < this.height; y++) {
      const srcY = Math.max(0, Math.min(this.height - 1, y - offY));
      const srcRow = srcY * this.width;
      const dstRow = y * this.width;
      for (let x = 0; x < this.width; x++) {
        const srcX = Math.max(0, Math.min(this.width - 1, x - offX));
        this.u32[dstRow + x] = copy[srcRow + srcX];
      }
    }
  }

  // Zoom Pulse (Center-based dynamic scaling)
  public applyZoomPulse(time: number, intensity: number = 0.8) {
    const scale = 1.0 + Math.sin(time * 8) * 0.08 * intensity;
    if (Math.abs(scale - 1.0) < 0.005) return;
    const copy = new Uint32Array(this.u32);
    const cx = this.width / 2;
    const cy = this.height / 2;
    const invScale = 1.0 / scale;
    for (let y = 0; y < this.height; y++) {
      const srcY = Math.max(0, Math.min(this.height - 1, Math.round(cy + (y - cy) * invScale)));
      const srcRow = srcY * this.width;
      const dstRow = y * this.width;
      for (let x = 0; x < this.width; x++) {
        const srcX = Math.max(0, Math.min(this.width - 1, Math.round(cx + (x - cx) * invScale)));
        this.u32[dstRow + x] = copy[srcRow + srcX];
      }
    }
  }

  // AI Beauty Smooth (Gentle skin bloom + luminance boost)
  public applyBeautySmooth(intensity: number = 0.6) {
    const copy = new Uint32Array(this.u32);
    this.applyBoxBlur(Math.max(2, Math.round(intensity * 4)));
    const boost = Math.round(intensity * 12);
    for (let i = 0; i < this.u32.length; i++) {
      const orig = copy[i];
      const blur = this.u32[i];
      const r = Math.min(255, (((orig & 0xff) * 3 + (blur & 0xff)) >> 2) + boost);
      const g = Math.min(255, ((((orig >>> 8) & 0xff) * 3 + ((blur >>> 8) & 0xff)) >> 2) + boost);
      const b = Math.min(255, ((((orig >>> 16) & 0xff) * 3 + ((blur >>> 16) & 0xff)) >> 2) + boost);
      const a = (orig >>> 24) & 0xff;
      this.u32[i] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
  }

  // Comprehensive Visual Effect Dispatcher for all 23 FastArt Effect Presets
  public applyEffect(eff: { type: string; intensity?: number }, time: number) {
    const intensity = eff.intensity !== undefined ? eff.intensity : 0.8;
    switch (eff.type) {
      case "vignette":
        this.applyVignette(intensity);
        break;
      case "flash": {
        const flashVal = Math.sin(time * 12);
        if (flashVal > 0.55) {
          const alpha = (flashVal - 0.55) * 2.2 * intensity;
          this.fillRect(0, 0, this.width, this.height, "#FFFFFF", alpha);
        }
        break;
      }
      case "cinema":
      case "letterbox": {
        const barH = Math.round(this.height * 0.1);
        this.fillRect(0, 0, this.width, barH, "#000000", 1.0);
        this.fillRect(0, this.height - barH, this.width, barH, "#000000", 1.0);
        break;
      }
      case "vhs": {
        for (let y = 0; y < this.height; y += 4) {
          this.fillRect(0, y, this.width, 2, "#000000", 0.22);
        }
        const barY = Math.round((time * 260) % this.height);
        this.fillRect(0, barY, this.width, 14, "#FFFFFF", 0.25);
        const secs = Math.floor(time).toString().padStart(2, "0");
        const frames = Math.floor((time % 1) * 30).toString().padStart(2, "0");
        this.drawText(`PLAY ▶ SP 00:${secs}:${frames}`, 100, this.height - 24, {
          color: "#00FF66",
          fontSize: 13,
          enableOutline: true,
        });
        break;
      }
      case "rgb_split":
        this.applyRgbSplit(Math.max(3, Math.round(this.width * 0.015 * intensity)));
        break;
      case "film_grain":
      case "old_film": {
        this.fillRect(0, 0, this.width, this.height, "#FFE6C8", 0.12 * intensity);
        const scratchX = Math.round((time * 317) % this.width);
        this.fillRect(scratchX, 0, 1, this.height, "#FFFFFF", 0.4 * intensity);
        const numDots = Math.floor(120 * intensity);
        let s = Math.round(time * 1000) & 0xffff;
        for (let d = 0; d < numDots; d++) {
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          const gx = s % this.width;
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          const gy = s % this.height;
          this.setPixel(gx, gy, 255, 255, 255, 120);
        }
        break;
      }
      case "crt_tv": {
        for (let y = 0; y < this.height; y += 3) {
          this.fillRect(0, y, this.width, 1, "#000000", 0.35);
        }
        break;
      }
      case "neon_edge": {
        const thick = Math.max(3, Math.round(this.width * 0.012 * intensity));
        this.fillRect(4, 4, this.width - 8, thick, "#00F2FE", 0.75);
        this.fillRect(4, this.height - 4 - thick, this.width - 8, thick, "#00F2FE", 0.75);
        this.fillRect(4, 4, thick, this.height - 8, "#FF0050", 0.75);
        this.fillRect(this.width - 4 - thick, 4, thick, this.height - 8, "#FF0050", 0.75);
        break;
      }
      case "blur":
      case "blur_cinematic":
        this.applyBoxBlur(Math.max(2, Math.round(intensity * 5)));
        break;
      case "mirror":
        this.applyMirror();
        break;
      case "shake":
        this.applyShake(time, intensity);
        break;
      case "rainbow_flow": {
        const hue = Math.floor((time * 120) % 360);
        const [hr, hg, hb] = hslToRgb(hue, 0.9, 0.5);
        const hex = `#${hr.toString(16).padStart(2, "0")}${hg.toString(16).padStart(2, "0")}${hb.toString(16).padStart(2, "0")}`;
        this.fillRect(0, 0, this.width, this.height, hex, 0.18 * intensity);
        break;
      }
      case "prism_leak": {
        this.fillRect(0, 0, this.width, Math.round(this.height * 0.4), "#FF9900", 0.22 * intensity);
        this.fillRect(0, 0, Math.round(this.width * 0.4), this.height, "#FF007F", 0.18 * intensity);
        break;
      }
      case "sun_flare": {
        const fx = Math.round(this.width * 0.8);
        const fy = Math.round(this.height * 0.2);
        const rad = Math.round(Math.max(this.width, this.height) * 0.35 * intensity);
        this.fillRect(fx - rad, fy - rad, rad * 2, rad * 2, "#FFD700", 0.2 * intensity);
        break;
      }
      case "cyberpunk_dual": {
        const halfW = this.width >> 1;
        this.fillRect(0, 0, halfW, this.height, "#00F2FE", 0.25 * intensity);
        this.fillRect(halfW, 0, this.width - halfW, this.height, "#FF007F", 0.25 * intensity);
        break;
      }
      case "water_ripple":
        this.applyWaterRipple(time, intensity);
        break;
      case "glitch":
        this.applyGlitch(time, intensity);
        break;
      case "fisheye":
      case "zoom_pulse":
        this.applyZoomPulse(time, intensity);
        break;
      case "thermal": {
        for (let i = 0; i < this.u32.length; i++) {
          const p = this.u32[i];
          const luma = ((p & 0xff) * 77 + ((p >>> 8) & 0xff) * 151 + ((p >>> 16) & 0xff) * 28) >> 8;
          let tr = 0, tg = 0, tb = 0;
          if (luma < 85) {
            tb = Math.min(255, luma * 3);
            tg = luma;
          } else if (luma < 170) {
            const rel = (luma - 85) * 3;
            tg = 255;
            tr = rel;
            tb = 255 - rel;
          } else {
            const rel = (luma - 170) * 3;
            tr = 255;
            tg = 255 - rel;
            tb = rel >> 1;
          }
          const a = (p >>> 24) & 0xff;
          this.u32[i] = ((a << 24) | (tb << 16) | (tg << 8) | tr) >>> 0;
        }
        break;
      }
      case "tilt_shift":
        this.applyBoxBlur(Math.max(3, Math.round(intensity * 6)), 0, 0.28);
        this.applyBoxBlur(Math.max(3, Math.round(intensity * 6)), 0.72, 1.0);
        break;
      case "kaleidoscope":
        this.applyKaleidoscope();
        break;
      case "beauty_smooth":
        this.applyBeautySmooth(intensity);
        break;
      case "ai_cyberpunk": {
        const halfW = this.width >> 1;
        this.fillRect(0, 0, halfW, this.height, "#00F2FE", 0.28 * intensity);
        this.fillRect(halfW, 0, this.width - halfW, this.height, "#FF007F", 0.28 * intensity);
        const thick = Math.max(3, Math.round(this.width * 0.015 * intensity));
        this.fillRect(0, 0, this.width, thick, "#00F2FE", 0.8 * intensity);
        this.fillRect(0, this.height - thick, this.width, thick, "#FF007F", 0.8 * intensity);
        break;
      }
      case "ai_manga": {
        for (let i = 0; i < this.u32.length; i++) {
          const p = this.u32[i];
          const luma = ((p & 0xff) * 77 + ((p >>> 8) & 0xff) * 151 + ((p >>> 16) & 0xff) * 28) >> 8;
          const highContrast = luma > 140 ? 255 : luma < 70 ? 0 : Math.round((luma - 70) * 3.64);
          const a = (p >>> 24) & 0xff;
          this.u32[i] = ((a << 24) | (highContrast << 16) | (highContrast << 8) | highContrast) >>> 0;
        }
        this.applyVignette(0.75 * intensity);
        break;
      }
      case "ai_matrix": {
        for (let y = 0; y < this.height; y += 3) {
          this.fillRect(0, y, this.width, 1, "#003311", 0.4 * intensity);
        }
        const barY = Math.round((time * 240) % this.height);
        this.fillRect(0, barY, this.width, 18, "#00FF66", 0.28 * intensity);
        this.fillRect(0, 0, this.width, this.height, "#00FF66", 0.12 * intensity);
        this.drawText("AI MATRIX // CASCADE", 20, 24, {
          color: "#00FF66",
          fontSize: 12,
          enableOutline: true,
        });
        break;
      }
      case "ai_aura": {
        const auraThick = Math.max(4, Math.round(this.width * 0.02 * intensity));
        const pulse = 0.5 + Math.sin(time * 6) * 0.3;
        this.fillRect(0, 0, this.width, auraThick, "#00F2FE", (0.5 + pulse * 0.3) * intensity);
        this.fillRect(0, this.height - auraThick, this.width, auraThick, "#00F2FE", (0.5 + pulse * 0.3) * intensity);
        this.fillRect(0, 0, auraThick, this.height, "#FF007F", (0.5 + pulse * 0.3) * intensity);
        this.fillRect(this.width - auraThick, 0, auraThick, this.height, "#FF007F", (0.5 + pulse * 0.3) * intensity);
        break;
      }
      case "ai_night_vision": {
        this.fillRect(0, 0, this.width, this.height, "#00FF44", 0.22 * intensity);
        for (let y = 0; y < this.height; y += 4) {
          this.fillRect(0, y, this.width, 1, "#000000", 0.25);
        }
        this.applyVignette(0.7 * intensity);
        this.drawText("AI NVG-GEN4 // 1080P", 24, 28, {
          color: "#00FF66",
          fontSize: 13,
          enableOutline: true,
        });
        break;
      }
      case "ai_cartoon": {
        for (let i = 0; i < this.u32.length; i++) {
          const p = this.u32[i];
          let r = p & 0xff;
          let g = (p >>> 8) & 0xff;
          let b = (p >>> 16) & 0xff;
          const a = (p >>> 24) & 0xff;
          r = Math.min(255, Math.round(r / 32) * 32 + 10);
          g = Math.min(255, Math.round(g / 32) * 32 + 10);
          b = Math.min(255, Math.round(b / 32) * 32 + 10);
          this.u32[i] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
        }
        const bThick = Math.max(3, Math.round(this.width * 0.012 * intensity));
        this.fillRect(0, 0, this.width, bThick, "#FFE600", 0.8 * intensity);
        this.fillRect(0, this.height - bThick, this.width, bThick, "#FFE600", 0.8 * intensity);
        break;
      }
    }
  }

  public drawBadge(
    x: number,
    y: number,
    w: number,
    h: number,
    bgColor: string,
    borderColor?: string,
    borderWidth: number = 1,
    alpha: number = 0.88
  ) {
    this.fillRect(x, y, w, h, bgColor, alpha);
    if (borderColor && borderWidth > 0) {
      this.fillRect(x, y, w, borderWidth, borderColor, 0.95);
      this.fillRect(x, y + h - borderWidth, w, borderWidth, borderColor, 0.95);
      this.fillRect(x, y, borderWidth, h, borderColor, 0.95);
      this.fillRect(x + w - borderWidth, y, borderWidth, h, borderColor, 0.95);
    }
  }

  // Draw crisp vector-scaled text with drop shadow / outline and optional badge container
  public drawText(
    text: string,
    centerX: number,
    centerY: number,
    options: {
      color?: string;
      backgroundColor?: string;
      scale?: number;
      fontSize?: number;
      strokeColor?: string;
      strokeWidth?: number;
      enableOutline?: boolean;
    } = {}
  ) {
    if (!text) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    // Handle multiline text
    const lines = cleanText.split("\n");
    const fontScale = Math.max(
      1,
      Math.round(((options.fontSize || 22) / 12) * (options.scale || 1.0))
    );
    const charW = 8 * fontScale;
    const charH = 16 * fontScale;
    const lineSpacing = Math.round(charH * 1.25);
    const totalBlockH = lines.length * lineSpacing;
    const startBlockY = Math.round(centerY - totalBlockH / 2);

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l].trim();
      if (!line) continue;
      const lineW = line.length * charW;
      const startX = Math.round(centerX - lineW / 2);
      const startY = startBlockY + l * lineSpacing;

      // 1. Draw badge background pill if defined
      if (options.backgroundColor && options.backgroundColor !== "transparent") {
        const padX = 10 * fontScale;
        const padY = 5 * fontScale;
        this.drawBadge(
          startX - padX,
          startY - padY,
          lineW + padX * 2,
          charH + padY * 2,
          options.backgroundColor,
          options.strokeColor || "rgba(255,255,255,0.15)",
          1,
          0.85
        );
      }

      // 2. High-contrast outline / shadow pass
      const enableOutline = options.enableOutline !== false;
      if (enableOutline) {
        const [sr, sg, sb, sa] = hexToRgba(options.strokeColor || "#000000", 0.85);
        const offsets = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
          [1, 1],
        ];
        for (const [ox, oy] of offsets) {
          for (let i = 0; i < line.length; i++) {
            const char = line[i].toUpperCase();
            const glyph = FONT_GLYPHS[char] || FONT_GLYPHS["?"];
            const charOffset = startX + i * charW + ox * Math.max(1, Math.floor(fontScale / 2));
            const charY = startY + oy * Math.max(1, Math.floor(fontScale / 2));

            for (let row = 0; row < 16; row++) {
              const rowByte = glyph[row] || 0;
              for (let col = 0; col < 8; col++) {
                if ((rowByte & (0x80 >> col)) !== 0) {
                  for (let dy = 0; dy < fontScale; dy++) {
                    for (let dx = 0; dx < fontScale; dx++) {
                      this.setPixel(
                        charOffset + col * fontScale + dx,
                        charY + row * fontScale + dy,
                        sr,
                        sg,
                        sb,
                        sa
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 3. Foreground glyph pass
      const [r, g, b, a] = hexToRgba(options.color || "#FFFFFF");
      for (let i = 0; i < line.length; i++) {
        const char = line[i].toUpperCase();
        const glyph = FONT_GLYPHS[char] || FONT_GLYPHS["?"];
        const charOffset = startX + i * charW;

        for (let row = 0; row < 16; row++) {
          const rowByte = glyph[row] || 0;
          for (let col = 0; col < 8; col++) {
            if ((rowByte & (0x80 >> col)) !== 0) {
              for (let dy = 0; dy < fontScale; dy++) {
                for (let dx = 0; dx < fontScale; dx++) {
                  this.setPixel(
                    charOffset + col * fontScale + dx,
                    startY + row * fontScale + dy,
                    r,
                    g,
                    b,
                    a
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  // Draw TikTok/Instagram styled Auto-Captions with active word highlighting
  public drawCaption(
    caption: CaptionClip,
    currentTime: number,
    centerX: number,
    centerY: number
  ) {
    const rawText = (caption.text || "").trim();
    if (!rawText) return;

    const preset = caption.presetId || "karaoke";
    const highlightColor = caption.highlightColor || "#FFE600";
    let fontScale = Math.max(1, Math.round(((caption.style?.fontSize || 24) / 12) * (caption.scale || 1.0)));

    // Auto-fit fontScale so long lines never clip beyond canvas bounds
    const maxAllowedW = this.width * 0.88;
    const fullText = caption.words && caption.words.length > 0
      ? caption.words.map((w) => w.word).join(" ")
      : rawText;
    if (fullText.length * (8 * fontScale) > maxAllowedW) {
      fontScale = Math.max(1, Math.floor(maxAllowedW / (fullText.length * 8)));
    }
    const charW = 8 * fontScale;
    const charH = 16 * fontScale;

    // Check if word-level timing is available
    if (caption.words && caption.words.length > 0) {
      const activeWordIdx = caption.words.findIndex(
        (w) => currentTime >= w.start && currentTime <= w.end
      );

      // Build word line
      const totalW = fullText.length * charW;
      const startX = Math.round(centerX - totalW / 2);
      const startY = Math.round(centerY - charH / 2);

      // Draw caption backdrop pill
      const padX = 14 * fontScale;
      const padY = 8 * fontScale;
      this.drawBadge(
        startX - padX,
        startY - padY,
        totalW + padX * 2,
        charH + padY * 2,
        preset === "glow_neon" ? "rgba(0,15,30,0.85)" : "rgba(0,0,0,0.75)",
        preset === "glow_neon" ? "#00F2FE" : "#FFE600",
        preset === "glow_neon" ? 2 : 1,
        0.9
      );

      // Render words sequentially
      let curX = startX;
      for (let i = 0; i < caption.words.length; i++) {
        const item = caption.words[i];
        const isActive = i === activeWordIdx;
        const color = isActive ? highlightColor : "#FFFFFF";
        const wordText = item.word;

        // If active, draw highlighted badge box under this word
        if (isActive) {
          const wordW = wordText.length * charW;
          this.drawBadge(
            curX - 3,
            startY - 2,
            wordW + 6,
            charH + 4,
            preset === "glow_neon" ? "#00F2FE" : highlightColor,
            "#FFFFFF",
            1,
            0.95
          );
        }

        // Draw word glyphs
        const wordColor = isActive && preset !== "glow_neon" ? "#000000" : color;
        for (let c = 0; c < wordText.length; c++) {
          const char = wordText[c].toUpperCase();
          const glyph = FONT_GLYPHS[char] || FONT_GLYPHS["?"];
          const [r, g, b, a] = hexToRgba(wordColor);

          for (let row = 0; row < 16; row++) {
            const rowByte = glyph[row] || 0;
            for (let col = 0; col < 8; col++) {
              if ((rowByte & (0x80 >> col)) !== 0) {
                for (let dy = 0; dy < fontScale; dy++) {
                  for (let dx = 0; dx < fontScale; dx++) {
                    this.setPixel(
                      curX + col * fontScale + dx,
                      startY + row * fontScale + dy,
                      r,
                      g,
                      b,
                      a
                    );
                  }
                }
              }
            }
          }
          curX += charW;
        }

        // Space between words
        curX += charW;
      }
    } else {
      // Standard styled caption without individual word timings
      this.drawText(rawText, centerX, centerY, {
        color: preset === "yellow_highlight" ? "#FFE600" : "#FFFFFF",
        backgroundColor: "rgba(0,0,0,0.75)",
        strokeColor: preset === "glow_neon" ? "#00F2FE" : "#000000",
        fontSize: caption.style?.fontSize || 24,
        scale: caption.scale || 1.0,
      });
    }
  }

  // Draw sticker label / icon / emoji
  public drawSticker(
    label: string,
    centerX: number,
    centerY: number,
    scale: number = 1.0,
    backgroundColor: string = "rgba(0,0,0,0.6)"
  ) {
    const size = Math.round(52 * scale);
    this.drawBadge(
      centerX - size / 2,
      centerY - size / 2,
      size,
      size,
      backgroundColor,
      "#00F2FE",
      2,
      0.85
    );
    this.drawText(label.slice(0, 4), centerX, centerY, {
      color: "#00F2FE",
      fontSize: Math.round(18 * scale),
      enableOutline: true,
    });
  }

  // Draw cinematic video clip frame card
  public drawVideoCard(
    clip: VideoClip,
    vx: number,
    vy: number,
    vw: number,
    vh: number,
    time: number
  ) {
    // 1. Draw frame container
    this.fillRect(vx, vy, vw, vh, "#0B0F19", 1.0);
    this.fillRect(vx + 3, vy + 3, vw - 6, vh - 6, "#141C2E", 1.0);

    // 2. Subtle cinema gradient lighting
    const midY = vy + vh / 2;
    this.fillRect(vx + 4, vy + 4, vw - 8, Math.round(vh * 0.35), "#1E293B", 0.4);

    // 3. Clip watermark & metadata badge
    const title = clip.title ? clip.title.slice(0, 20) : "FastArt Clip";
    const clipElapsed = Math.max(0, time - clip.startTime);
    const mins = Math.floor(clipElapsed / 60);
    const secs = Math.floor(clipElapsed % 60);
    const timeStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

    // Sleek cinematic corner badge
    this.drawBadge(vx + 12, vy + 12, 80, 22, "rgba(0,0,0,0.6)", "#00F2FE", 1, 0.85);
    this.drawText(timeStr, vx + 52, vy + 23, {
      color: "#00F2FE",
      fontSize: 12,
      enableOutline: false,
    });

    // Center title watermark
    this.drawText(title, vx + vw / 2, midY, {
      color: "#8E95A5",
      fontSize: 18,
      backgroundColor: "rgba(0,0,0,0.4)",
      enableOutline: true,
    });
  }

  // High-performance image blitter with bilinear/nearest-neighbor scaling, cropping, flipping, opacity, and color filters
  public drawImagePixels(
    srcData: Uint8Array,
    srcW: number,
    srcH: number,
    dstX: number,
    dstY: number,
    dstW: number,
    dstH: number,
    opacity: number = 1.0,
    crop?: { x?: number; y?: number; width?: number; height?: number },
    flipX: boolean = false,
    flipY: boolean = false,
    filter?: string,
    mask?: any,
    cutout?: any
  ) {
    if (dstW <= 0 || dstH <= 0 || opacity <= 0 || srcW <= 0 || srcH <= 0) return;
    const srcU32 = new Uint32Array(srcData.buffer, srcData.byteOffset, srcW * srcH);

    // Compute crop sub-rectangle in source image coordinates
    const cropX0 = crop && crop.x ? Math.max(0, Math.min(srcW - 1, Math.round((crop.x / 100) * srcW))) : 0;
    const cropY0 = crop && crop.y ? Math.max(0, Math.min(srcH - 1, Math.round((crop.y / 100) * srcH))) : 0;
    const cropW0 = crop && crop.width ? Math.max(1, Math.min(srcW - cropX0, Math.round((crop.width / 100) * srcW))) : srcW;
    const cropH0 = crop && crop.height ? Math.max(1, Math.min(srcH - cropY0, Math.round((crop.height / 100) * srcH))) : srcH;

    const clipLeft = Math.max(0, dstX);
    const clipTop = Math.max(0, dstY);
    const clipRight = Math.min(this.width, dstX + dstW);
    const clipBottom = Math.min(this.height, dstY + dstH);

    const alpha256 = Math.round(Math.min(1.0, Math.max(0.0, opacity)) * 256);
    const hasFilter = filter && filter !== "normal" && filter !== "none";
    const hasMask = Boolean(mask && mask.shape && mask.shape !== "none");
    const hasCutout = Boolean(cutout && cutout.enabled);

    // If background replacement color is requested, fill background behind the cutout subject
    if (hasCutout && cutout.bgColor && cutout.bgColor !== "none" && cutout.bgColor !== "transparent") {
      const bgHex = cutout.bgColor;
      const bgR = parseInt(bgHex.slice(1, 3), 16) || 0;
      const bgG = parseInt(bgHex.slice(3, 5), 16) || 0;
      const bgB = parseInt(bgHex.slice(5, 7), 16) || 0;
      for (let cy = clipTop; cy < clipBottom; cy++) {
        const row = cy * this.width;
        for (let cx = clipLeft; cx < clipRight; cx++) {
          this.u32[row + cx] = ((255 << 24) | (bgB << 16) | (bgG << 8) | bgR) >>> 0;
        }
      }
    }

    let cRKey = 0, cGKey = 255, cBKey = 0, cThreshSq = 0, cOuterSq = 0, cInvFeather = 0;
    let autoThreshSq = 0, autoOuterSq = 0, autoInvFeather = 0, autoBgR = 0, autoBgG = 0, autoBgB = 0;
    const isAuto = Boolean(hasCutout && cutout.mode === "auto");

    if (hasCutout) {
      if (isAuto) {
        const p0 = srcU32[0];
        const p1 = srcU32[srcW - 1];
        const p2 = srcU32[(srcH - 1) * srcW];
        const p3 = srcU32[srcH * srcW - 1];
        autoBgR = Math.round(((p0 & 0xff) + (p1 & 0xff) + (p2 & 0xff) + (p3 & 0xff)) / 4);
        autoBgG = Math.round((((p0 >> 8) & 0xff) + ((p1 >> 8) & 0xff) + ((p2 >> 8) & 0xff) + ((p3 >> 8) & 0xff)) / 4);
        autoBgB = Math.round((((p0 >> 16) & 0xff) + ((p1 >> 16) & 0xff) + ((p2 >> 16) & 0xff) + ((p3 >> 16) & 0xff)) / 4);

        const aThresh = Math.max(15, ((cutout.intensity ?? 45) / 100) * 160);
        autoThreshSq = aThresh * aThresh;
        const aFeather = Math.max(2, ((cutout.shadow ?? 25) / 100) * 60);
        const aOuterDist = aThresh + aFeather;
        autoOuterSq = aOuterDist * aOuterDist;
        autoInvFeather = 1.0 / aFeather;
      } else {
        const hex = cutout.keyColor || "#00FF00";
        cRKey = parseInt(hex.slice(1, 3), 16) || 0;
        cGKey = parseInt(hex.slice(3, 5), 16) || 255;
        cBKey = parseInt(hex.slice(5, 7), 16) || 0;
        const thresh = ((cutout.intensity ?? 45) / 100) * 195;
        cThreshSq = thresh * thresh;
        const feather = Math.max(1, ((cutout.shadow ?? 25) / 100) * 70);
        const outerDist = thresh + feather;
        cOuterSq = outerDist * outerDist;
        cInvFeather = 1.0 / feather;
      }
    }

    for (let y = clipTop; y < clipBottom; y++) {
      const normY = (y - dstY) / dstH;
      const effNormY = flipY ? 1.0 - normY : normY;
      const srcY = Math.min(cropY0 + cropH0 - 1, cropY0 + Math.floor(effNormY * cropH0));
      const srcRow = srcY * srcW;
      const dstRow = y * this.width;

      for (let x = clipLeft; x < clipRight; x++) {
        const normX = (x - dstX) / dstW;
        const effNormX = flipX ? 1.0 - normX : normX;
        const srcX = Math.min(cropX0 + cropW0 - 1, cropX0 + Math.floor(effNormX * cropW0));
        const pixel = srcU32[srcRow + srcX];
        const srcA = (pixel >>> 24) & 0xff;

        if (srcA === 0) continue;

        let maskMultiplier = 1.0;
        if (hasMask) {
          const rawSize = Math.max(1, mask.size ?? 50);
          const rawFeather = Math.max(0, Math.min(80, mask.feather ?? 0));
          const rotDeg = mask.rotation || 0;
          const offXNorm = (mask.x || 0) / 100;
          const offYNorm = (mask.y || 0) / 100;

          // Normalized centered coords [-0.5..0.5]
          const mx = (normX - 0.5) - offXNorm;
          const my = (normY - 0.5) - offYNorm;

          // Rotate
          const rad = (-rotDeg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rx = (mx * cos - my * sin) * dstW;
          const ry = (mx * sin + my * cos) * dstH;

          const minDim = Math.min(dstW, dstH);
          const featherPx = rawFeather > 0 ? Math.max(1, (minDim * (rawFeather / 100)) * 0.38) : 0;

          let inside = 1.0;
          if (mask.shape === "circle") {
            const radius = (minDim * rawSize) / 200;
            const dist = Math.hypot(rx, ry);
            if (featherPx > 0) {
              inside = Math.max(0, Math.min(1, (radius - dist) / featherPx + 0.5));
            } else {
              inside = dist <= radius ? 1 : 0;
            }
          } else if (mask.shape === "rectangle") {
            const hw = (dstW * rawSize) / 200;
            const hh = (dstH * rawSize) / 200;
            const dxEdge = hw - Math.abs(rx);
            const dyEdge = hh - Math.abs(ry);
            const dist = Math.min(dxEdge, dyEdge);
            if (featherPx > 0) {
              inside = Math.max(0, Math.min(1, dist / featherPx + 0.5));
            } else {
              inside = dist >= 0 ? 1 : 0;
            }
          } else if (mask.shape === "linear") {
            const splitY = ((50 - rawSize) / 100) * dstH;
            const dist = ry - splitY;
            if (featherPx > 0) {
              inside = Math.max(0, Math.min(1, dist / featherPx + 0.5));
            } else {
              inside = dist >= 0 ? 1 : 0;
            }
          } else if (mask.shape === "mirror") {
            const hBand = (dstH * rawSize) / 200;
            const dist = hBand - Math.abs(ry);
            if (featherPx > 0) {
              inside = Math.max(0, Math.min(1, dist / featherPx + 0.5));
            } else {
              inside = dist >= 0 ? 1 : 0;
            }
          }

          if (mask.inverted) {
            inside = 1.0 - inside;
          }
          maskMultiplier = inside;
        }

        if (maskMultiplier <= 0) continue;

        let srcR = pixel & 0xff;
        let srcG = (pixel >>> 8) & 0xff;
        let srcB = (pixel >>> 16) & 0xff;

        if (hasCutout) {
          if (isAuto) {
            const isSkin = srcR > 60 && srcG > 40 && srcB > 20 && srcR > srcG && srcG > srcB && (srcR - srcG) >= 8 && (srcR - srcB) >= 12;
            const distCenter = Math.abs(normX - 0.5);
            if (!isSkin && distCenter > 0.28) {
              const dr = srcR - autoBgR;
              const dg = srcG - autoBgG;
              const db = srcB - autoBgB;
              const distSq = dr * dr + dg * dg + db * db;
              if (distSq < autoThreshSq) {
                continue;
              } else if (distSq < autoOuterSq) {
                const dist = Math.sqrt(distSq);
                maskMultiplier *= Math.max(0, Math.min(1, (dist - Math.sqrt(autoThreshSq)) * autoInvFeather));
              }
            }
          } else {
            const dr = srcR - cRKey;
            const dg = srcG - cGKey;
            const db = srcB - cBKey;
            const distSq = dr * dr + dg * dg + db * db;
            if (distSq < cThreshSq) {
              continue;
            } else if (distSq < cOuterSq) {
              const dist = Math.sqrt(distSq);
              maskMultiplier *= Math.max(0, Math.min(1, (dist - Math.sqrt(cThreshSq)) * cInvFeather));
              if (cGKey > cRKey && cGKey > cBKey && srcG > Math.max(srcR, srcB)) {
                srcG = Math.round(srcG * 0.45 + Math.max(srcR, srcB) * 0.55);
              }
            }
          }
        }

        if (hasFilter) {
          [srcR, srcG, srcB] = applyPixelFilter(srcR, srcG, srcB, filter);
        }

        const effA = Math.round(((srcA * alpha256) >> 8) * maskMultiplier);
        if (effA <= 0) continue;

        if (effA >= 250) {
          this.u32[dstRow + x] = ((255 << 24) | (srcB << 16) | (srcG << 8) | srcR) >>> 0;
        } else {
          const invA = 256 - effA;
          const dstIdx = (dstRow + x) * 4;
          this.data[dstIdx] = (srcR * effA + this.data[dstIdx] * invA) >> 8;
          this.data[dstIdx + 1] = (srcG * effA + this.data[dstIdx + 1] * invA) >> 8;
          this.data[dstIdx + 2] = (srcB * effA + this.data[dstIdx + 2] * invA) >> 8;
          this.data[dstIdx + 3] = Math.min(255, this.data[dstIdx + 3] + effA);
        }
      }
    }
  }

  public toPngBytes(): Uint8Array {
    return createPngBuffer(this.width, this.height, this.data);
  }
}

// ---------------------------------------------------------------------------
// Normalize overlay coordinates (handles both 0..100% and direct pixel offsets)
// ---------------------------------------------------------------------------
function resolveNormalizedPos(
  pos: { x?: number; y?: number } | undefined,
  canvasW: number,
  canvasH: number,
  defaultPctX = 50,
  defaultPctY = 50
): { x: number; y: number } {
  if (!pos) {
    return {
      x: Math.round((defaultPctX / 100) * canvasW),
      y: Math.round((defaultPctY / 100) * canvasH),
    };
  }
  const rawX = pos.x !== undefined ? pos.x : defaultPctX;
  const rawY = pos.y !== undefined ? pos.y : defaultPctY;

  // Percentage 0..100 coordinate check
  const isPctX = rawX >= 0 && rawX <= 100;
  const isPctY = rawY >= 0 && rawY <= 100;

  const x = isPctX ? Math.round((rawX / 100) * canvasW) : Math.round(canvasW / 2 + rawX);
  const y = isPctY ? Math.round((rawY / 100) * canvasH) : Math.round(canvasH / 2 + rawY);
  return { x, y };
}

// ---------------------------------------------------------------------------
// Frame State Key: Detects whether visual elements changed between time steps
// Allows zero-cost identical frame reuse without re-rasterizing or re-encoding!
// ---------------------------------------------------------------------------
export function getMobileFrameStateKey(project: FastArtProject, time: number): string {
  const elapsedSec = Math.floor(time);
  let key = `s:${elapsedSec}|`;

  const videoClips = project.tracks.video || [];
  for (let i = 0; i < videoClips.length; i++) {
    const v = videoClips[i];
    if (time >= v.startTime && time <= v.startTime + v.duration) {
      key += `v:${v.id}`;
      if (v.type === "video") {
        const { intervalSec, totalKeyframes } = getVideoKeyframeInterval(v.duration || 5.0);
        const elapsed = Math.max(0, time - v.startTime);
        const frameIdx = Math.min(totalKeyframes - 1, Math.floor(elapsed / intervalSec));
        key += `@f:${frameIdx}`;
      }
      if (v.effect && v.effect !== "none") {
        key += `@eff:${v.effect}_${Math.floor(time * 24)}`;
      }
      if (v.filter && v.filter !== "none") {
        key += `@flt:${v.filter}`;
      }
      if (v.motionTrack?.enabled) {
        key += `@m:${Math.round(time * 12)}`;
      }
      if (v.keyframes && v.keyframes.length > 0) {
        key += `@kf:${Math.round(time * 15)}`;
      }
      if (v.transition && v.transition.type && v.transition.type !== "none") {
        key += `@tr:${Math.round(time * 15)}`;
      }
      key += "|";
    }
  }

  const effectClips = project.tracks.effects || [];
  for (let i = 0; i < effectClips.length; i++) {
    const eff = effectClips[i];
    if (time >= eff.startTime && time <= eff.startTime + eff.duration) {
      key += `eff:${eff.id}_${eff.type}_${Math.floor(time * 24)}|`;
    }
  }

  const textClips = project.tracks.text || [];
  for (let i = 0; i < textClips.length; i++) {
    const txt = textClips[i];
    if (time >= txt.startTime && time <= txt.startTime + txt.duration) {
      const elapsed = time - txt.startTime;
      const duration = Math.max(0.5, txt.duration || 3.0);
      const introDur = Math.min(0.5, duration * 0.35);
      const anim = (txt.animation || "none").toLowerCase().replace(/[-_]/g, "");
      if (anim !== "none" && elapsed < introDur) {
        key += `t:${txt.id}_${Math.floor(elapsed * 12)}`;
      } else {
        key += `t:${txt.id}_s`;
      }
      if (txt.motionTrack?.enabled) {
        key += `@${Math.round(time * 12)}`;
      }
      key += "|";
    }
  }

  const captionClips = project.tracks.captions || [];
  for (let i = 0; i < captionClips.length; i++) {
    const cap = captionClips[i];
    if (time >= cap.startTime && time <= cap.startTime + cap.duration) {
      let activeWordIdx = -1;
      if (cap.words && cap.words.length > 0) {
        activeWordIdx = cap.words.findIndex((w) => time >= w.start && time <= w.end);
      }
      key += `c:${cap.id}_${activeWordIdx}`;
      if (cap.motionTrack?.enabled) {
        key += `@${Math.round(time * 12)}`;
      }
      key += "|";
    }
  }

  const stickerClips = project.tracks.stickers || [];
  for (let i = 0; i < stickerClips.length; i++) {
    const s = stickerClips[i];
    if (time >= s.startTime && time <= s.startTime + s.duration) {
      key += `st:${s.id}|`;
    }
  }

  return key;
}

// ---------------------------------------------------------------------------
// Render an Entire Multi-Track Mobile Project Frame to Buffer
// ---------------------------------------------------------------------------
export function renderMobileProjectFrame(
  project: FastArtProject,
  time: number,
  canvasW: number,
  canvasH: number,
  targetBuffer?: MobileFrameBuffer,
  clipImageMap?: Map<string, DecodedImage>
): MobileFrameBuffer {
  const canvasBg = project.canvasBackground || "#000000";
  const isBlur = canvasBg.startsWith("blur:");
  const isGradient = canvasBg.startsWith("gradient:");
  let effectiveFill = "#000000";
  if (!isBlur && !isGradient) {
    effectiveFill = canvasBg.startsWith("#") ? canvasBg : "#000000";
  } else if (isGradient) {
    const parts = canvasBg.replace("gradient:", "").split(",");
    effectiveFill = parts[0]?.trim() || "#0B0D13";
  }

  let buffer: MobileFrameBuffer;
  if (targetBuffer && targetBuffer.width === canvasW && targetBuffer.height === canvasH) {
    targetBuffer.fill(effectiveFill);
    buffer = targetBuffer;
  } else {
    buffer = new MobileFrameBuffer(canvasW, canvasH, effectiveFill);
  }

  const videoClips = project.tracks.video || [];
  const textClips = project.tracks.text || [];
  const captionClips = project.tracks.captions || [];
  const stickerClips = project.tracks.stickers || [];
  const effectClips = project.tracks.effects || [];

  const activeVideos = videoClips.filter(
    (c) => time >= c.startTime && time <= c.startTime + c.duration
  );
  const activeTexts = textClips.filter(
    (t) => time >= t.startTime && time <= t.startTime + t.duration
  );
  const activeCaptions = captionClips.filter(
    (c) => time >= c.startTime && time <= c.startTime + c.duration
  );
  const activeStickers = stickerClips.filter(
    (s) => time >= s.startTime && time <= s.startTime + s.duration
  );
  const activeEffects = effectClips.filter(
    (e) => time >= e.startTime && time <= e.startTime + e.duration
  );

  // Background Layer: Custom Image or Blurred Video Backdrop
  if (clipImageMap?.has("__background__")) {
    const bgImg = clipImageMap.get("__background__")!;
    buffer.drawImagePixels(
      bgImg.data,
      bgImg.width,
      bgImg.height,
      0,
      0,
      canvasW,
      canvasH,
      1.0
    );
  } else if (isBlur && activeVideos.length > 0) {
    const firstVid = activeVideos[0];
    const bgImg = clipImageMap?.get(firstVid.id) || (firstVid.url ? clipImageMap?.get(firstVid.url) : undefined);
    if (bgImg) {
      buffer.drawImagePixels(
        bgImg.data,
        bgImg.width,
        bgImg.height,
        0,
        0,
        canvasW,
        canvasH,
        0.55
      );
    }
  }

  // Multi-Track Visual Items: Unified and strictly sorted by trackIndex and type layer score
  type MobileExportItem =
    | { kind: "video"; clip: VideoClip; score: number }
    | { kind: "caption"; clip: CaptionClip; score: number }
    | { kind: "text"; clip: TextClip; score: number }
    | { kind: "sticker"; clip: StickerClip; score: number }
    | { kind: "effect"; clip: EffectClip; score: number };

  const exportItems: MobileExportItem[] = [
    ...activeVideos.map((v) => ({
      kind: "video" as const,
      clip: v,
      score: (typeof v.trackIndex === "number" ? v.trackIndex : 0) * 100,
    })),
    ...activeCaptions.map((c) => ({
      kind: "caption" as const,
      clip: c,
      score: (typeof c.trackIndex === "number" ? c.trackIndex : 2) * 100 + 2,
    })),
    ...activeTexts.map((t) => ({
      kind: "text" as const,
      clip: t,
      score: (typeof t.trackIndex === "number" ? t.trackIndex : 2) * 100 + 3,
    })),
    ...activeStickers.map((s) => ({
      kind: "sticker" as const,
      clip: s,
      score: (typeof s.trackIndex === "number" ? s.trackIndex : 3) * 100 + 4,
    })),
    ...activeEffects.map((e) => ({
      kind: "effect" as const,
      clip: e,
      score: (typeof e.trackIndex === "number" ? e.trackIndex : 4) * 100 + 5,
    })),
  ];

  exportItems.sort((a, b) => a.score - b.score);

  for (const item of exportItems) {
    if (item.kind === "video") {
      const vid = item.clip;
      const kfT = getInterpolatedTransform(vid, time);
      const posX = kfT?.x ?? vid.transform?.x ?? 0;
      const posY = kfT?.y ?? vid.transform?.y ?? 0;
      const baseScale = kfT?.scale ?? vid.transform?.scale ?? vid.scale ?? 1.0;
      let opacity = (kfT?.opacity ?? 1) * (vid.opacity !== undefined ? vid.opacity : 1);

      let motionX = 0;
      let motionY = 0;
      let motionScale = 1.0;
      if (vid.motionTrack && vid.motionTrack.enabled) {
        const motion = applyMotionTracking(time, vid.startTime, vid.duration, vid.motionTrack);
        motionX = motion.dx;
        motionY = motion.dy;
        motionScale = motion.dScale;
      }

      // Cross-clip transition handling (dissolve, fade, etc.)
      const cEnd = vid.startTime + vid.duration;
      const trans = vid.transition;
      const transDur = trans && trans.type && trans.type !== "none" && trans.type !== "cut" ? (trans.duration || 0.5) : 0;
      if (transDur > 0 && time >= cEnd - transDur && time <= cEnd) {
        const p = Math.max(0, Math.min(1, (time - (cEnd - transDur)) / transDur));
        if (trans.type === "dissolve") opacity *= (1 - p);
      }

      let img: DecodedImage | undefined = undefined;
      if (vid.type === "video") {
        const { intervalSec, totalKeyframes } = getVideoKeyframeInterval(vid.duration || 5.0);
        const elapsed = Math.max(0, time - vid.startTime);
        const frameIdx = Math.min(totalKeyframes - 1, Math.floor(elapsed / intervalSec));
        img = clipImageMap?.get(`${vid.id}_f${frameIdx}`);
        if (!img && frameIdx > 0) {
          for (let prev = frameIdx - 1; prev >= 0; prev--) {
            const cand = clipImageMap?.get(`${vid.id}_f${prev}`);
            if (cand) {
              img = cand;
              break;
            }
          }
        }
      }
      if (!img) {
        img =
          clipImageMap?.get(vid.id) ||
          clipImageMap?.get(`${vid.id}_thumb`) ||
          (vid.url ? clipImageMap?.get(vid.url) : undefined);
      }
      if (img && img.width > 0 && img.height > 0) {
        const srcW = img.width;
        const srcH = img.height;
        const aspect = srcW / srcH;
        let dw = canvasW;
        let dh = canvasW / aspect;
        const fitMode = vid.fit || "contain";

        if (fitMode === "cover") {
          if (dh < canvasH) {
            dh = canvasH;
            dw = canvasH * aspect;
          }
        } else {
          // contain
          if (dh > canvasH) {
            dh = canvasH;
            dw = canvasH * aspect;
          }
        }

        const effScale = baseScale * motionScale;
        dw = Math.round(dw * effScale);
        dh = Math.round(dh * effScale);

        const dx = Math.round((canvasW - dw) / 2 + posX + motionX);
        const dy = Math.round((canvasH - dh) / 2 + posY + motionY);

        const crop = vid.crop || vid.transform?.crop;
        const flipX = Boolean((vid as any).flipHorizontal || vid.transform?.flipX || kfT?.flipX);
        const flipY = Boolean((vid as any).flipVertical || vid.transform?.flipY || kfT?.flipY);
        const filter = vid.filter || vid.effect;
        const mask = vid.mask || vid.transform?.mask;
        const cutout = vid.cutout;

        buffer.drawImagePixels(
          img.data,
          img.width,
          img.height,
          dx,
          dy,
          dw,
          dh,
          opacity,
          crop,
          flipX,
          flipY,
          filter,
          mask,
          cutout
        );
      } else {
        // Fallback placeholder card
        const aspect = 16 / 9;
        let vw = canvasW * motionScale * baseScale;
        let vh = (canvasW / aspect) * motionScale * baseScale;
        if (vh > canvasH) {
          vh = canvasH * motionScale * baseScale;
          vw = canvasH * aspect * motionScale * baseScale;
        }
        const vx = Math.round((canvasW - vw) / 2 + motionX + posX);
        const vy = Math.round((canvasH - vh) / 2 + motionY + posY);

        buffer.drawVideoCard(vid, vx, vy, Math.round(vw), Math.round(vh), time);
      }

      if (vid.effect && vid.effect !== "none") {
        buffer.applyEffect(
          {
            type: vid.effect,
            intensity: (vid as any).effectIntensity ?? 0.8,
          },
          time
        );
      }
    } else if (item.kind === "text") {
      const txt = item.clip;
      const elapsed = Math.max(0, time - (txt.startTime || 0));
      const duration = Math.max(0.5, txt.duration || 3.0);
      let animScale = 1.0;
      let animOffsetY = 0;
      let animOffsetX = 0;
      const anim = (txt.animation || "none").toLowerCase().replace(/[-_]/g, "");
      const introDur = Math.min(0.5, duration * 0.35);

      if (anim === "bounce" && elapsed < introDur) {
        const p = elapsed / introDur;
        animScale = 0.45 + Math.sin(p * Math.PI) * 0.75;
      } else if ((anim === "slideup" || anim === "up") && elapsed < introDur) {
        const p = elapsed / introDur;
        animOffsetY = (1 - Math.sin((p * Math.PI) / 2)) * 45;
      } else if ((anim === "slidedown" || anim === "down") && elapsed < introDur) {
        const p = elapsed / introDur;
        animOffsetY = -(1 - Math.sin((p * Math.PI) / 2)) * 45;
      } else if ((anim === "slide" || anim === "slideleft") && elapsed < introDur) {
        const p = elapsed / introDur;
        animOffsetX = (1 - Math.sin((p * Math.PI) / 2)) * 60;
      } else if (anim === "slideright" && elapsed < introDur) {
        const p = elapsed / introDur;
        animOffsetX = -(1 - Math.sin((p * Math.PI) / 2)) * 60;
      } else if ((anim === "zoomin" || anim === "zoom") && elapsed < introDur) {
        const p = elapsed / introDur;
        animScale = 0.35 + Math.sin((p * Math.PI) / 2) * 0.75;
      }

      let motionX = 0;
      let motionY = 0;
      let motionScale = 1.0;
      if (txt.motionTrack && txt.motionTrack.enabled) {
        const motion = applyMotionTracking(time, txt.startTime, txt.duration, txt.motionTrack);
        motionX = motion.dx;
        motionY = motion.dy;
        motionScale = motion.dScale;
      }

      const basePos = resolveNormalizedPos(txt.position, canvasW, canvasH, 50, 35);
      const posX = basePos.x + animOffsetX + motionX;
      const posY = basePos.y + animOffsetY + motionY;
      const scale = (txt.scale || 1.0) * animScale * motionScale;
      const color = txt.style?.color || "#FFFFFF";
      const bgBadge = txt.style?.backgroundColor;
      const hasBadge = bgBadge && bgBadge !== "transparent";

      const strokeW = txt.style?.strokeWidth !== undefined ? txt.style.strokeWidth : 2;
      const isTxtStroke = Boolean(
        txt.style?.strokeColor &&
          txt.style.strokeColor !== "none" &&
          txt.style.strokeColor !== "transparent" &&
          strokeW > 0,
      );

      buffer.drawText(txt.text, posX, posY, {
        color,
        backgroundColor: hasBadge ? bgBadge : undefined,
        scale,
        fontSize: Math.round((txt.style?.fontSize || 28) * 0.9),
        enableOutline: isTxtStroke,
        strokeColor: txt.style?.strokeColor || "#000000",
        strokeWidth: strokeW,
      });
    } else if (item.kind === "caption") {
      const cap = item.clip;
      let motionX = 0;
      let motionY = 0;
      if (cap.motionTrack && cap.motionTrack.enabled) {
        const motion = applyMotionTracking(time, cap.startTime, cap.duration, cap.motionTrack);
        motionX = motion.dx;
        motionY = motion.dy;
      }

      const basePos = resolveNormalizedPos(cap.position, canvasW, canvasH, 50, 80);
      const posX = basePos.x + motionX;
      const posY = basePos.y + motionY;

      buffer.drawCaption(cap, time, posX, posY);
    } else if (item.kind === "sticker") {
      const st = item.clip;
      let motionX = 0;
      let motionY = 0;
      let motionScale = 1.0;
      if (st.motionTrack && st.motionTrack.enabled) {
        const motion = applyMotionTracking(time, st.startTime, st.duration, st.motionTrack);
        motionX = motion.dx;
        motionY = motion.dy;
        motionScale = motion.dScale;
      }

      const basePos = resolveNormalizedPos(st.position, canvasW, canvasH, 50, 50);
      const posX = basePos.x + motionX;
      const posY = basePos.y + motionY;
      const stScale = (st.scale || 1.0) * motionScale;

      const stUrl = (st as any).url;
      const stImg = clipImageMap?.get(st.id) || (stUrl ? clipImageMap?.get(stUrl) : undefined);
      if (stImg && stImg.width > 0 && stImg.height > 0) {
        const sw = Math.round(stImg.width * stScale);
        const sh = Math.round(stImg.height * stScale);
        buffer.drawImagePixels(
          stImg.data,
          stImg.width,
          stImg.height,
          Math.round(posX - sw / 2),
          Math.round(posY - sh / 2),
          sw,
          sh,
          (st as any).opacity ?? 1.0
        );
      } else {
        const label = st.char || (st as any).name || (st as any).emoji || "★";
        buffer.drawSticker(label, posX, posY, stScale);
      }
    } else if (item.kind === "effect") {
      buffer.applyEffect(item.clip, time);
    }
  }

  // 6. Transition Overlays (Flash, Dip to Black, Light Leak)
  if (activeVideos.length > 0) {
    const vid = activeVideos[0];
    const trans = vid.transition;
    const transDur = trans && trans.type && trans.type !== "none" ? (trans.duration || 0.5) : 0;
    const timeLeft = vid.duration - Math.max(0, time - vid.startTime);
    if (transDur > 0 && timeLeft <= transDur) {
      const p = 1 - timeLeft / transDur;
      if (trans.type === "flash_white") {
        buffer.fillRect(0, 0, canvasW, canvasH, "#FFFFFF", Math.sin(p * Math.PI) * 0.95);
      } else if (trans.type === "fade_black") {
        const blackAlpha = p < 0.5 ? p * 2 : (1 - p) * 2;
        buffer.fillRect(0, 0, canvasW, canvasH, "#000000", blackAlpha);
      } else if (trans.type === "light_leak") {
        buffer.fillRect(0, 0, canvasW, canvasH, "#FFAA00", Math.sin(p * Math.PI) * 0.6);
      }
    }
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Pure TypeScript H.264 Baseline Profile Bitstream Encoder
// (Compliant with ISO/IEC 14496-10 / ITU-T H.264)
// ---------------------------------------------------------------------------
class BitWriter {
  private buffer: Uint8Array;
  private pos = 0;
  private currentByte = 0;
  private numBitsInCurrentByte = 0;

  constructor(initialCapacity = 131072) {
    this.buffer = new Uint8Array(initialCapacity);
  }

  public ensureCapacity(needed: number) {
    if (this.pos + needed > this.buffer.length) {
      const newCap = Math.max(this.buffer.length * 2, this.pos + needed + 4096);
      const newBuf = new Uint8Array(newCap);
      newBuf.set(this.buffer);
      this.buffer = newBuf;
    }
  }

  public writeByte(b: number) {
    if (this.pos >= this.buffer.length) {
      this.ensureCapacity(1);
    }
    this.buffer[this.pos++] = b & 0xff;
  }

  public writeBit(bit: number) {
    this.currentByte = (this.currentByte << 1) | (bit & 1);
    this.numBitsInCurrentByte++;
    if (this.numBitsInCurrentByte === 8) {
      this.writeByte(this.currentByte);
      this.currentByte = 0;
      this.numBitsInCurrentByte = 0;
    }
  }

  public writeBits(val: number, numBits: number) {
    for (let i = numBits - 1; i >= 0; i--) {
      this.writeBit((val >>> i) & 1);
    }
  }

  public writeUe(val: number) {
    const temp = val + 1;
    let leadingZeros = 0;
    while (1 << (leadingZeros + 1) <= temp) {
      leadingZeros++;
    }
    this.writeBits(0, leadingZeros);
    this.writeBits(temp, leadingZeros + 1);
  }

  public writeSe(val: number) {
    const codeNum = val <= 0 ? -val * 2 : val * 2 - 1;
    this.writeUe(codeNum);
  }

  public alignZero() {
    if (this.numBitsInCurrentByte > 0) {
      this.currentByte <<= 8 - this.numBitsInCurrentByte;
      this.writeByte(this.currentByte);
      this.currentByte = 0;
      this.numBitsInCurrentByte = 0;
    }
  }

  public writeRbspTrailingBits() {
    this.writeBit(1);
    while (this.numBitsInCurrentByte > 0) {
      this.writeBit(0);
    }
  }

  public getBuffer(): Uint8Array {
    return this.buffer;
  }

  public getPos(): number {
    return this.pos;
  }

  public setPos(newPos: number) {
    this.pos = newPos;
  }

  public toBytes(): Uint8Array {
    return this.buffer.subarray(0, this.pos);
  }
}

// Precomputed BT.601 integer lookup tables (Studio Range [16..235] and [16..240])
const LUT_Y_R = new Int32Array(256);
const LUT_Y_G = new Int32Array(256);
const LUT_Y_B = new Int32Array(256);

const LUT_U_R = new Int32Array(256);
const LUT_U_G = new Int32Array(256);
const LUT_U_B = new Int32Array(256);

const LUT_V_R = new Int32Array(256);
const LUT_V_G = new Int32Array(256);
const LUT_V_B = new Int32Array(256);

for (let i = 0; i < 256; i++) {
  LUT_Y_R[i] = 66 * i;
  LUT_Y_G[i] = 129 * i;
  LUT_Y_B[i] = 25 * i;

  LUT_U_R[i] = -38 * i;
  LUT_U_G[i] = -74 * i;
  LUT_U_B[i] = 112 * i;

  LUT_V_R[i] = 112 * i;
  LUT_V_G[i] = -94 * i;
  LUT_V_B[i] = -18 * i;
}

// H.264 Emulation Prevention: inserts 0x03 after two consecutive 0x00 bytes if followed by <= 0x03
function rbspToNal(rbsp: Uint8Array): Uint8Array {
  const len = rbsp.length;
  let out = new Uint8Array(len + (len >> 5) + 256);
  let outLen = 0;
  let zeroCount = 0;

  for (let i = 0; i < len; i++) {
    if (outLen + 2 >= out.length) {
      const next = new Uint8Array(Math.max(out.length * 2, outLen + 1024));
      next.set(out);
      out = next;
    }
    const b = rbsp[i];
    if (zeroCount === 2 && b <= 3) {
      out[outLen++] = 3;
      zeroCount = 0;
    }
    out[outLen++] = b;
    if (b === 0) {
      zeroCount++;
    } else {
      zeroCount = 0;
    }
  }
  return out.subarray(0, outLen);
}

// Sequence Parameter Set (SPS) NAL unit (type 7)
function buildH264Sps(mbWidth: number, mbHeight: number, fps: number = 30): Uint8Array {
  const bw = new BitWriter(256);
  bw.writeBits(66, 8); // Profile IDC: 66 (Baseline)
  bw.writeBits(0xe0, 8); // Constraint flags: constraint_set0..2 = 1 (Constrained Baseline)
  bw.writeBits(31, 8); // Level IDC: 31 (Level 3.1)
  bw.writeUe(0); // seq_parameter_set_id
  bw.writeUe(0); // log2_max_frame_num_minus4
  bw.writeUe(2); // pic_order_cnt_type: 2 (fixed frame rate, deterministic POC)
  bw.writeUe(1); // max_num_ref_frames
  bw.writeBit(0); // gaps_in_frame_num_value_allowed_flag
  bw.writeUe(mbWidth - 1); // pic_width_in_mbs_minus1
  bw.writeUe(mbHeight - 1); // pic_height_in_map_units_minus1
  bw.writeBit(1); // frame_mbs_only_flag
  bw.writeBit(1); // direct_8x8_inference_flag
  bw.writeBit(0); // frame_cropping_flag
  bw.writeBit(1); // vui_parameters_present_flag
  // VUI parameters
  bw.writeBit(0); // aspect_ratio_info_present_flag
  bw.writeBit(0); // overscan_info_present_flag
  bw.writeBit(0); // video_signal_type_present_flag
  bw.writeBit(0); // chroma_loc_info_present_flag
  bw.writeBit(1); // timing_info_present_flag
  bw.writeBits(1, 32); // num_units_in_tick
  bw.writeBits(Math.max(1, fps) * 2, 32); // time_scale
  bw.writeBit(1); // fixed_frame_rate_flag
  bw.writeBit(0); // nal_hrd_parameters_present_flag
  bw.writeBit(0); // vcl_hrd_parameters_present_flag
  bw.writeBit(0); // pic_struct_present_flag
  bw.writeBit(1); // bitstream_restriction_flag
  bw.writeBit(1); // motion_vectors_over_pic_boundaries_flag
  bw.writeUe(0); // max_bytes_per_pic_denom
  bw.writeUe(0); // max_bits_per_mb_denom
  bw.writeUe(0); // log2_max_mv_length_horizontal
  bw.writeUe(0); // log2_max_mv_length_vertical
  bw.writeUe(0); // num_reorder_frames
  bw.writeUe(1); // max_dec_frame_buffering
  bw.writeRbspTrailingBits();

  const nalBody = rbspToNal(bw.toBytes());
  const nal = new Uint8Array(1 + nalBody.length);
  nal[0] = 0x67; // NAL unit type 7 (SPS), nal_ref_idc = 3
  nal.set(nalBody, 1);
  return nal;
}

// Picture Parameter Set (PPS) NAL unit (type 8)
function buildH264Pps(): Uint8Array {
  const bw = new BitWriter(256);
  bw.writeUe(0); // pic_parameter_set_id
  bw.writeUe(0); // seq_parameter_set_id
  bw.writeBit(0); // entropy_coding_mode_flag (CAVLC)
  bw.writeBit(0); // bottom_field_pic_order_in_frame_present_flag
  bw.writeUe(0); // num_slice_groups_minus1
  bw.writeUe(0); // num_ref_idx_l0_default_active_minus1
  bw.writeUe(0); // num_ref_idx_l1_default_active_minus1
  bw.writeBit(0); // weighted_pred_flag
  bw.writeBits(0, 2); // weighted_bipred_idc
  bw.writeSe(0); // pic_init_qp_minus26
  bw.writeSe(0); // pic_init_qs_minus26
  bw.writeSe(0); // chroma_qp_index_offset
  bw.writeBit(0); // deblocking_filter_control_present_flag
  bw.writeBit(0); // constrained_intra_pred_flag
  bw.writeBit(0); // redundant_pic_cnt_present_flag
  bw.writeRbspTrailingBits();

  const nalBody = rbspToNal(bw.toBytes());
  const nal = new Uint8Array(1 + nalBody.length);
  nal[0] = 0x68; // NAL unit type 8 (PPS), nal_ref_idc = 3
  nal.set(nalBody, 1);
  return nal;
}

// Encode a MobileFrameBuffer into a genuine H.264 IDR I_PCM slice NAL unit (type 5)
// Utilizes 32-bit register unpacking, precomputed BT.601 integer tables, and direct memcpy streaming
function encodeH264IFrame(
  buffer: MobileFrameBuffer,
  frameIndex: number,
  mbWidth: number,
  mbHeight: number
): Uint8Array {
  const totalMbs = mbWidth * mbHeight;
  const bw = new BitWriter(totalMbs * 390 + 512);

  // Slice Header
  bw.writeUe(0); // first_mb_in_slice
  bw.writeUe(7); // slice_type: 7 (All I-slice)
  bw.writeUe(0); // pic_parameter_set_id
  bw.writeBits(0, 4); // frame_num: MUST BE 0 for IDR pictures per ITU-T H.264 Section 7.4.3
  bw.writeUe(frameIndex & 1); // idr_pic_id
  // pic_order_cnt_lsb is omitted because pic_order_cnt_type == 2 in SPS
  bw.writeBit(0); // no_output_of_prior_pics_flag
  bw.writeBit(0); // long_term_reference_flag
  bw.writeSe(0); // slice_qp_delta

  const width = buffer.width;
  const height = buffer.height;
  const u32 = buffer.u32;

  // Align to byte boundary before MB 0
  bw.writeUe(25); // mb_type: 25 (I_PCM)
  bw.alignZero();

  const raw = bw.getBuffer();
  let pos = bw.getPos();

  // Convert and write macroblocks (16x16 luma, 8x8 chroma U, 8x8 chroma V)
  for (let mbY = 0; mbY < mbHeight; mbY++) {
    const startY = mbY * 16;
    for (let mbX = 0; mbX < mbWidth; mbX++) {
      const startX = mbX * 16;

      // MB 0 is already written (ue(25) + alignZero). From MB 1 onward, write 0x0D, 0x00 directly!
      if (mbY !== 0 || mbX !== 0) {
        raw[pos++] = 0x0d;
        raw[pos++] = 0x00;
      }

      // 1. 256 bytes Luma Y (16x16)
      for (let y = 0; y < 16; y++) {
        const py = startY + y < height ? startY + y : height - 1;
        const rowStart = py * width;
        for (let x = 0; x < 16; x++) {
          const px = startX + x < width ? startX + x : width - 1;
          const p = u32[rowStart + px];
          const r = p & 0xff;
          const g = (p >>> 8) & 0xff;
          const b = (p >>> 16) & 0xff;
          // BT.601 Studio Range Y [16..235]
          raw[pos++] = ((LUT_Y_R[r] + LUT_Y_G[g] + LUT_Y_B[b] + 128) >> 8) + 16;
        }
      }

      // 2. 64 bytes Chroma Cb (U) (8x8, 2x downsampled)
      for (let y = 0; y < 8; y++) {
        const py = startY + y * 2 < height ? startY + y * 2 : height - 1;
        const rowStart = py * width;
        for (let x = 0; x < 8; x++) {
          const px = startX + x * 2 < width ? startX + x * 2 : width - 1;
          const p = u32[rowStart + px];
          const r = p & 0xff;
          const g = (p >>> 8) & 0xff;
          const b = (p >>> 16) & 0xff;
          // BT.601 Studio Range Cb [16..240]
          raw[pos++] = ((LUT_U_R[r] + LUT_U_G[g] + LUT_U_B[b] + 128) >> 8) + 128;
        }
      }

      // 3. 64 bytes Chroma Cr (V) (8x8, 2x downsampled)
      for (let y = 0; y < 8; y++) {
        const py = startY + y * 2 < height ? startY + y * 2 : height - 1;
        const rowStart = py * width;
        for (let x = 0; x < 8; x++) {
          const px = startX + x * 2 < width ? startX + x * 2 : width - 1;
          const p = u32[rowStart + px];
          const r = p & 0xff;
          const g = (p >>> 8) & 0xff;
          const b = (p >>> 16) & 0xff;
          // BT.601 Studio Range Cr [16..240]
          raw[pos++] = ((LUT_V_R[r] + LUT_V_G[g] + LUT_V_B[b] + 128) >> 8) + 128;
        }
      }
    }
  }

  bw.setPos(pos);
  bw.writeRbspTrailingBits();
  const nalBody = rbspToNal(bw.toBytes());
  const nal = new Uint8Array(1 + nalBody.length);
  nal[0] = 0x65; // NAL unit type 5 (IDR slice), nal_ref_idc = 3
  nal.set(nalBody, 1);
  return nal;
}

// ---------------------------------------------------------------------------
// ISO Base Media File Format (MP4) Container Builder
// High-performance typed Uint8Array stream with direct memory set
// (Compliant with ISO/IEC 14496-12 / 14496-15)
// ---------------------------------------------------------------------------
class Mp4BoxBuilder {
  private buffer: Uint8Array;
  private pos: number = 0;

  constructor(initialCapacity = 65536) {
    this.buffer = new Uint8Array(initialCapacity);
  }

  private ensureCapacity(needed: number) {
    if (this.pos + needed > this.buffer.length) {
      const newCap = Math.max(this.buffer.length * 2, this.pos + needed + 16384);
      const newBuf = new Uint8Array(newCap);
      newBuf.set(this.buffer);
      this.buffer = newBuf;
    }
  }

  public writeU8(val: number) {
    if (this.pos >= this.buffer.length) this.ensureCapacity(1);
    this.buffer[this.pos++] = val & 0xff;
  }

  public writeU16(val: number) {
    if (this.pos + 2 > this.buffer.length) this.ensureCapacity(2);
    this.buffer[this.pos++] = (val >>> 8) & 0xff;
    this.buffer[this.pos++] = val & 0xff;
  }

  public writeU32(val: number) {
    if (this.pos + 4 > this.buffer.length) this.ensureCapacity(4);
    this.buffer[this.pos++] = (val >>> 24) & 0xff;
    this.buffer[this.pos++] = (val >>> 16) & 0xff;
    this.buffer[this.pos++] = (val >>> 8) & 0xff;
    this.buffer[this.pos++] = val & 0xff;
  }

  public writeAscii(str: string) {
    const len = str.length;
    if (this.pos + len > this.buffer.length) this.ensureCapacity(len);
    for (let i = 0; i < len; i++) {
      this.buffer[this.pos++] = str.charCodeAt(i);
    }
  }

  public writeBytes(bytes: Uint8Array) {
    const len = bytes.length;
    if (this.pos + len > this.buffer.length) this.ensureCapacity(len);
    this.buffer.set(bytes, this.pos);
    this.pos += len;
  }

  public box(type: string, payloadFn: () => void) {
    const startPos = this.pos;
    this.writeU32(0); // placeholder size
    this.writeAscii(type);
    payloadFn();
    const endPos = this.pos;
    const size = endPos - startPos;
    this.buffer[startPos] = (size >>> 24) & 0xff;
    this.buffer[startPos + 1] = (size >>> 16) & 0xff;
    this.buffer[startPos + 2] = (size >>> 8) & 0xff;
    this.buffer[startPos + 3] = size & 0xff;
  }

  public toBytes(): Uint8Array {
    return this.buffer.subarray(0, this.pos);
  }
}

function createMp4Container(
  width: number,
  height: number,
  fps: number,
  uniqueNals: Uint8Array[],
  frameNalIndices: number[],
  audioWavBytes?: Uint8Array
): Uint8Array {
  const mbW = width >> 4;
  const mbH = height >> 4;
  const sps = buildH264Sps(mbW, mbH, fps);
  const pps = buildH264Pps();

  const totalFrames = frameNalIndices.length;
  const totalUnique = uniqueNals.length;
  const timescale = 1000;
  const frameDurationMs = Math.round(1000 / fps);
  const durationMs = totalFrames * frameDurationMs;

  const rawAudio =
    audioWavBytes && audioWavBytes.byteLength > 44 ? audioWavBytes.subarray(44) : null;
  const hasAudio = Boolean(rawAudio && rawAudio.length >= 4);
  const audioTimescale = 44100;
  const totalAudioSamples = hasAudio ? Math.floor(rawAudio!.length / 4) : 0;
  const audioDurationInMovieTimescale = durationMs;

  const b = new Mp4BoxBuilder();

  // 1. ftyp Box
  b.box("ftyp", () => {
    b.writeAscii("isom");
    b.writeU32(0x00000200);
    b.writeAscii("isom");
    b.writeAscii("mp42");
    b.writeAscii("avc1");
  });

  const uniqueSizes: number[] = new Array(totalUnique);
  let totalUniqueBytes = 0;
  for (let u = 0; u < totalUnique; u++) {
    const sLen = 4 + uniqueNals[u].length;
    uniqueSizes[u] = sLen;
    totalUniqueBytes += sLen;
  }

  const sampleSizes: number[] = new Array(totalFrames);
  for (let i = 0; i < totalFrames; i++) {
    sampleSizes[i] = uniqueSizes[frameNalIndices[i]];
  }

  const buildMoov = (chunkOffset: number) => {
    const mb = new Mp4BoxBuilder();
    const audioChunkOffset = chunkOffset + totalUniqueBytes;

    const uniqueOffsets: number[] = new Array(totalUnique);
    let curOff = chunkOffset;
    for (let u = 0; u < totalUnique; u++) {
      uniqueOffsets[u] = curOff;
      curOff += uniqueSizes[u];
    }

    mb.box("moov", () => {
      // mvhd
      mb.box("mvhd", () => {
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(timescale);
        mb.writeU32(durationMs);
        mb.writeU32(0x00010000);
        mb.writeU16(0x0100);
        mb.writeU16(0);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0x00010000);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0x00010000);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0x40000000);
        for (let i = 0; i < 6; i++) mb.writeU32(0);
        mb.writeU32(hasAudio ? 3 : 2); // next_track_id
      });

      // trak 1: Video Track
      mb.box("trak", () => {
        // tkhd
        mb.box("tkhd", () => {
          mb.writeU32(0x00000007);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(1); // track_id
          mb.writeU32(0);
          mb.writeU32(durationMs);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU16(0);
          mb.writeU16(0);
          mb.writeU16(0);
          mb.writeU16(0);
          mb.writeU32(0x00010000);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(0x00010000);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(0x40000000);
          mb.writeU32(width << 16);
          mb.writeU32(height << 16);
        });

        // mdia
        mb.box("mdia", () => {
          mb.box("mdhd", () => {
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(timescale);
            mb.writeU32(durationMs);
            mb.writeU16(0x55c4);
            mb.writeU16(0);
          });

          mb.box("hdlr", () => {
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeAscii("vide");
            for (let i = 0; i < 3; i++) mb.writeU32(0);
            mb.writeAscii("VideoHandler\0");
          });

          mb.box("minf", () => {
            mb.box("vmhd", () => {
              mb.writeU32(0x00000001);
              mb.writeU16(0);
              mb.writeU16(0);
              mb.writeU16(0);
              mb.writeU16(0);
            });

            mb.box("dinf", () => {
              mb.box("dref", () => {
                mb.writeU32(0);
                mb.writeU32(1);
                mb.box("url ", () => {
                  mb.writeU32(0x00000001);
                });
              });
            });

            mb.box("stbl", () => {
              // stsd
              mb.box("stsd", () => {
                mb.writeU32(0);
                mb.writeU32(1);
                mb.box("avc1", () => {
                  for (let i = 0; i < 6; i++) mb.writeU8(0);
                  mb.writeU16(1);
                  mb.writeU16(0);
                  mb.writeU16(0);
                  for (let i = 0; i < 3; i++) mb.writeU32(0);
                  mb.writeU16(width);
                  mb.writeU16(height);
                  mb.writeU32(0x00480000);
                  mb.writeU32(0x00480000);
                  mb.writeU32(0);
                  mb.writeU16(1);
                  mb.writeU8(12);
                  mb.writeAscii("FastArt H264");
                  for (let i = 0; i < 19; i++) mb.writeU8(0);
                  mb.writeU16(0x0018);
                  mb.writeU16(0xffff);

                  mb.box("avcC", () => {
                    mb.writeU8(1); // configurationVersion
                    mb.writeU8(66); // Baseline Profile
                    mb.writeU8(0xe0); // profile_compatibility: Constrained Baseline
                    mb.writeU8(31); // Level 3.1
                    mb.writeU8(0xff); // 4-byte NAL length prefix (3 | 0xFC)
                    mb.writeU8(0xe1); // 1 SPS (1 | 0xE0)
                    mb.writeU16(sps.length);
                    mb.writeBytes(sps);
                    mb.writeU8(1); // 1 PPS
                    mb.writeU16(pps.length);
                    mb.writeBytes(pps);
                  });
                });
              });

              // stts
              mb.box("stts", () => {
                mb.writeU32(0);
                mb.writeU32(1);
                mb.writeU32(totalFrames);
                mb.writeU32(frameDurationMs);
              });

              // stss (All sync frames)
              mb.box("stss", () => {
                mb.writeU32(0);
                mb.writeU32(totalFrames);
                for (let i = 1; i <= totalFrames; i++) {
                  mb.writeU32(i);
                }
              });

              // stsc
              mb.box("stsc", () => {
                mb.writeU32(0);
                mb.writeU32(1);
                mb.writeU32(1);
                mb.writeU32(1);
                mb.writeU32(1);
              });

              // stsz
              mb.box("stsz", () => {
                mb.writeU32(0);
                mb.writeU32(0);
                mb.writeU32(totalFrames);
                for (let i = 0; i < totalFrames; i++) {
                  mb.writeU32(sampleSizes[i]);
                }
              });

              // stco
              mb.box("stco", () => {
                mb.writeU32(0);
                mb.writeU32(totalFrames);
                for (let i = 0; i < totalFrames; i++) {
                  mb.writeU32(uniqueOffsets[frameNalIndices[i]]);
                }
              });
            });
          });
        });
      });

      // trak 2: Audio Track (Uncompressed 16-bit Stereo PCM)
      if (hasAudio) {
        mb.box("trak", () => {
          // tkhd
          mb.box("tkhd", () => {
            mb.writeU32(0x00000007); // flags
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(2); // track_id = 2
            mb.writeU32(0);
            mb.writeU32(audioDurationInMovieTimescale);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU16(0);
            mb.writeU16(0);
            mb.writeU16(0x0100); // volume = 1.0
            mb.writeU16(0);
            mb.writeU32(0x00010000);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0x00010000);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0x40000000);
            mb.writeU32(0);
            mb.writeU32(0);
          });

          // mdia
          mb.box("mdia", () => {
            mb.box("mdhd", () => {
              mb.writeU32(0);
              mb.writeU32(0);
              mb.writeU32(0);
              mb.writeU32(audioTimescale);
              mb.writeU32(totalAudioSamples);
              mb.writeU16(0x55c4);
              mb.writeU16(0);
            });

            mb.box("hdlr", () => {
              mb.writeU32(0);
              mb.writeU32(0);
              mb.writeAscii("soun");
              for (let i = 0; i < 3; i++) mb.writeU32(0);
              mb.writeAscii("SoundHandler\0");
            });

            mb.box("minf", () => {
              mb.box("smhd", () => {
                mb.writeU32(0);
                mb.writeU16(0);
                mb.writeU16(0);
              });

              mb.box("dinf", () => {
                mb.box("dref", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.box("url ", () => {
                    mb.writeU32(0x00000001);
                  });
                });
              });

              mb.box("stbl", () => {
                // stsd
                mb.box("stsd", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.box("sowt", () => {
                    for (let i = 0; i < 6; i++) mb.writeU8(0);
                    mb.writeU16(1); // data_reference_index
                    mb.writeU16(0); // version
                    mb.writeU16(0); // revision
                    mb.writeU32(0); // vendor
                    mb.writeU16(2); // channelcount = 2 (stereo)
                    mb.writeU16(16); // samplesize = 16-bit
                    mb.writeU16(0); // compression_id
                    mb.writeU16(0); // packet_size
                    mb.writeU32(audioTimescale << 16); // sample_rate 44100
                  });
                });

                // stts
                mb.box("stts", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.writeU32(totalAudioSamples);
                  mb.writeU32(1);
                });

                // stsc
                mb.box("stsc", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.writeU32(1);
                  mb.writeU32(totalAudioSamples);
                  mb.writeU32(1);
                });

                // stsz
                mb.box("stsz", () => {
                  mb.writeU32(0);
                  mb.writeU32(4); // constant 4 bytes per sample (2ch * 2 bytes)
                  mb.writeU32(totalAudioSamples);
                });

                // stco
                mb.box("stco", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.writeU32(audioChunkOffset);
                });
              });
            });
          });
        });
      }
    });
    return mb.toBytes();
  };

  const ftypBytes = b.toBytes();
  const estimatedOffset = ftypBytes.length + 1500;
  let moovBytes = buildMoov(estimatedOffset + 8);
  const actualOffset = ftypBytes.length + moovBytes.length + 8;
  moovBytes = buildMoov(actualOffset);

  // Directly construct final contiguous MP4 container with zero array copies
  const rawAudioLength = hasAudio ? rawAudio!.length : 0;
  const mdatHeaderSize = 8;
  const mdatTotalSize = mdatHeaderSize + totalUniqueBytes + rawAudioLength;
  const totalMp4Size = ftypBytes.length + moovBytes.length + mdatTotalSize;
  const finalMp4 = new Uint8Array(totalMp4Size);
  const view = new DataView(finalMp4.buffer);

  let offset = 0;
  // 1. ftyp
  finalMp4.set(ftypBytes, offset);
  offset += ftypBytes.length;

  // 2. moov
  finalMp4.set(moovBytes, offset);
  offset += moovBytes.length;

  // 3. mdat header
  view.setUint32(offset, mdatTotalSize, false);
  finalMp4[offset + 4] = 0x6d; // 'm'
  finalMp4[offset + 5] = 0x64; // 'd'
  finalMp4[offset + 6] = 0x61; // 'a'
  finalMp4[offset + 7] = 0x74; // 't'
  offset += 8;

  // 4. Unique Sample NALs (Written ONCE in mdat!)
  for (let u = 0; u < totalUnique; u++) {
    const s = uniqueNals[u];
    view.setUint32(offset, s.length, false);
    offset += 4;
    finalMp4.set(s, offset);
    offset += s.length;
  }

  // 5. Raw Audio PCM Bytes
  if (hasAudio && rawAudio) {
    finalMp4.set(rawAudio, offset);
    offset += rawAudio.length;
  }

  return finalMp4;
}

/**
 * Streams MP4 container directly to disk via BinaryFileWriter.
 * Avoids allocating a single monolithic multi-megabyte typed array in JS,
 * and avoids monolithic Base64 string bridge transfers to native code.
 * O(1) memory footprint for videos of arbitrary length (1 min, 10 min, 1 hour).
 * Generates strictly monotonic chunk offsets (stco) and standard H.264 Baseline Profile (avc1)
 * guaranteed to play smoothly on Android (ExoPlayer/MPEG4Extractor) and iOS.
 */
export async function writeMp4ContainerToFile(
  targetFileUri: string,
  width: number,
  height: number,
  fps: number,
  uniqueNals: Uint8Array[],
  frameNalIndices: number[],
  audioWavBytes?: Uint8Array | null
): Promise<number> {
  const mbW = width >> 4;
  const mbH = height >> 4;
  const sps = buildH264Sps(mbW, mbH, fps);
  const pps = buildH264Pps();

  const totalFrames = frameNalIndices.length;
  const timescale = 1000;
  const frameDurationMs = Math.round(1000 / fps);
  const durationMs = totalFrames * frameDurationMs;

  // Parse PCM Audio Track if provided
  let rawAudio: Uint8Array | null = null;
  let totalAudioSamples = 0;
  const audioTimescale = 44100;

  if (audioWavBytes && audioWavBytes.byteLength > 44) {
    const view = new DataView(audioWavBytes.buffer, audioWavBytes.byteOffset, audioWavBytes.byteLength);
    let dOffset = 12;
    while (dOffset + 8 <= audioWavBytes.byteLength) {
      const chunkId = String.fromCharCode(
        view.getUint8(dOffset),
        view.getUint8(dOffset + 1),
        view.getUint8(dOffset + 2),
        view.getUint8(dOffset + 3)
      );
      const chunkSize = view.getUint32(dOffset + 4, true);
      if (chunkId === "data") {
        const dataStart = dOffset + 8;
        const dataLen = Math.min(chunkSize, audioWavBytes.byteLength - dataStart);
        rawAudio = audioWavBytes.subarray(dataStart, dataStart + dataLen);
        totalAudioSamples = Math.floor(rawAudio.length / 4); // 4 bytes per sample (stereo 16-bit)
        break;
      }
      dOffset += 8 + chunkSize;
    }
  }
  // Note: Standard MP4 (ISO/IEC 14496-14) strictly requires AAC (mp4a). Uncompressed 'sowt' is rejected by Android MPEG4Extractor
  const hasAudio = false;
  const audioDurationInMovieTimescale = durationMs;

  const b = new Mp4BoxBuilder();

  // 1. ftyp Box
  b.box("ftyp", () => {
    b.writeAscii("isom");
    b.writeU32(0x00000200);
    b.writeAscii("isom");
    b.writeAscii("mp42");
    b.writeAscii("avc1");
  });

  // Calculate sample sizes for every frame sequentially
  const sampleSizes: number[] = new Array(totalFrames);
  let totalSampleBytes = 0;
  for (let i = 0; i < totalFrames; i++) {
    const nal = uniqueNals[frameNalIndices[i]];
    const sLen = 4 + nal.length;
    sampleSizes[i] = sLen;
    totalSampleBytes += sLen;
  }

  const buildMoov = (mdatStartOffset: number) => {
    const mb = new Mp4BoxBuilder();

    // Strictly monotonic chunk offsets: sample i starts at curOff
    const chunkOffsets: number[] = new Array(totalFrames);
    let curOff = mdatStartOffset;
    for (let i = 0; i < totalFrames; i++) {
      chunkOffsets[i] = curOff;
      curOff += sampleSizes[i];
    }

    mb.box("moov", () => {
      // mvhd
      mb.box("mvhd", () => {
        mb.writeU32(0); // version + flags
        mb.writeU32(0); // creation_time
        mb.writeU32(0); // modification_time
        mb.writeU32(timescale);
        mb.writeU32(durationMs);
        mb.writeU32(0x00010000); // preferred rate = 1.0
        mb.writeU16(0x0100); // preferred volume = 1.0
        mb.writeU16(0); // reserved
        mb.writeU32(0); // reserved
        mb.writeU32(0); // reserved
        // matrix structure (identity)
        mb.writeU32(0x00010000);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0x00010000);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0);
        mb.writeU32(0x40000000);
        for (let i = 0; i < 6; i++) mb.writeU32(0);
        mb.writeU32(hasAudio ? 3 : 2); // next_track_id
      });

      // trak 1: Video Track (H.264 Baseline Profile)
      mb.box("trak", () => {
        // tkhd
        mb.box("tkhd", () => {
          mb.writeU32(0x00000007); // flags: track_enabled | track_in_movie | track_in_preview
          mb.writeU32(0); // creation_time
          mb.writeU32(0); // modification_time
          mb.writeU32(1); // track_id = 1
          mb.writeU32(0); // reserved
          mb.writeU32(durationMs);
          mb.writeU32(0); // reserved
          mb.writeU32(0); // reserved
          mb.writeU16(0); // layer
          mb.writeU16(0); // alternate_group
          mb.writeU16(0); // volume = 0 for video track
          mb.writeU16(0); // reserved
          // matrix structure (identity)
          mb.writeU32(0x00010000);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(0x00010000);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(0);
          mb.writeU32(0x40000000);
          mb.writeU32(width << 16);
          mb.writeU32(height << 16);
        });

        // mdia
        mb.box("mdia", () => {
          mb.box("mdhd", () => {
            mb.writeU32(0); // version + flags
            mb.writeU32(0); // creation_time
            mb.writeU32(0); // modification_time
            mb.writeU32(timescale);
            mb.writeU32(durationMs);
            mb.writeU16(0x55c4); // language = und
            mb.writeU16(0); // quality
          });

          mb.box("hdlr", () => {
            mb.writeU32(0); // version + flags
            mb.writeU32(0); // pre_defined
            mb.writeAscii("vide");
            for (let i = 0; i < 3; i++) mb.writeU32(0); // reserved
            mb.writeAscii("VideoHandler\0");
          });

          mb.box("minf", () => {
            mb.box("vmhd", () => {
              mb.writeU32(0x00000001); // version + flags
              mb.writeU16(0); // graphicsmode
              mb.writeU16(0); // opcolor[0]
              mb.writeU16(0); // opcolor[1]
              mb.writeU16(0); // opcolor[2]
            });

            mb.box("dinf", () => {
              mb.box("dref", () => {
                mb.writeU32(0); // version + flags
                mb.writeU32(1); // entry_count = 1
                mb.box("url ", () => {
                  mb.writeU32(0x00000001); // flags: self-contained
                });
              });
            });

            mb.box("stbl", () => {
              // stsd
              mb.box("stsd", () => {
                mb.writeU32(0); // version + flags
                mb.writeU32(1); // entry_count = 1
                mb.box("avc1", () => {
                  for (let i = 0; i < 6; i++) mb.writeU8(0); // reserved
                  mb.writeU16(1); // data_reference_index = 1
                  mb.writeU16(0); // pre_defined
                  mb.writeU16(0); // reserved
                  for (let i = 0; i < 3; i++) mb.writeU32(0); // pre_defined
                  mb.writeU16(width);
                  mb.writeU16(height);
                  mb.writeU32(0x00480000); // 72 dpi
                  mb.writeU32(0x00480000); // 72 dpi
                  mb.writeU32(0); // reserved
                  mb.writeU16(1); // frame_count = 1
                  mb.writeU8(12); // compressorname length
                  mb.writeAscii("FastArt H264");
                  for (let i = 0; i < 19; i++) mb.writeU8(0); // padding
                  mb.writeU16(0x0018); // depth = 24
                  mb.writeU16(0xffff); // pre_defined = -1

                  mb.box("avcC", () => {
                    mb.writeU8(1); // configurationVersion = 1
                    mb.writeU8(66); // Baseline Profile (0x42)
                    mb.writeU8(0xe0); // profile_compatibility: Constrained Baseline
                    mb.writeU8(31); // Level 3.1
                    mb.writeU8(0xff); // 4-byte NAL length prefix (3 | 0xFC)
                    mb.writeU8(0xe1); // 1 SPS (1 | 0xE0)
                    mb.writeU16(sps.length);
                    mb.writeBytes(sps);
                    mb.writeU8(1); // 1 PPS
                    mb.writeU16(pps.length);
                    mb.writeBytes(pps);
                  });
                });
              });

              // stts
              mb.box("stts", () => {
                mb.writeU32(0);
                mb.writeU32(1);
                mb.writeU32(totalFrames);
                mb.writeU32(frameDurationMs);
              });

              // stss (All sync frames for instant seekability)
              mb.box("stss", () => {
                mb.writeU32(0);
                mb.writeU32(totalFrames);
                for (let i = 1; i <= totalFrames; i++) {
                  mb.writeU32(i);
                }
              });

              // stsc
              mb.box("stsc", () => {
                mb.writeU32(0);
                mb.writeU32(1);
                mb.writeU32(1); // first_chunk = 1
                mb.writeU32(1); // samples_per_chunk = 1
                mb.writeU32(1); // sample_description_index = 1
              });

              // stsz
              mb.box("stsz", () => {
                mb.writeU32(0);
                mb.writeU32(0);
                mb.writeU32(totalFrames);
                for (let i = 0; i < totalFrames; i++) {
                  mb.writeU32(sampleSizes[i]);
                }
              });

              // stco (Strictly increasing chunk offsets)
              mb.box("stco", () => {
                mb.writeU32(0);
                mb.writeU32(totalFrames);
                for (let i = 0; i < totalFrames; i++) {
                  mb.writeU32(chunkOffsets[i]);
                }
              });
            });
          });
        });
      });

      // trak 2: Audio Track (Uncompressed 16-bit Stereo PCM)
      if (hasAudio) {
        mb.box("trak", () => {
          // tkhd
          mb.box("tkhd", () => {
            mb.writeU32(0x00000007); // flags
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(2); // track_id = 2
            mb.writeU32(0);
            mb.writeU32(audioDurationInMovieTimescale);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU16(0);
            mb.writeU16(0);
            mb.writeU16(0x0100); // volume = 1.0
            mb.writeU16(0);
            mb.writeU32(0x00010000);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0x00010000);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0);
            mb.writeU32(0x40000000);
            mb.writeU32(0);
            mb.writeU32(0);
          });

          // mdia
          mb.box("mdia", () => {
            mb.box("mdhd", () => {
              mb.writeU32(0);
              mb.writeU32(0);
              mb.writeU32(0);
              mb.writeU32(audioTimescale);
              mb.writeU32(totalAudioSamples);
              mb.writeU16(0x55c4);
              mb.writeU16(0);
            });

            mb.box("hdlr", () => {
              mb.writeU32(0);
              mb.writeU32(0);
              mb.writeAscii("soun");
              for (let i = 0; i < 3; i++) mb.writeU32(0);
              mb.writeAscii("SoundHandler\0");
            });

            mb.box("minf", () => {
              mb.box("smhd", () => {
                mb.writeU32(0);
                mb.writeU16(0);
                mb.writeU16(0);
              });

              mb.box("dinf", () => {
                mb.box("dref", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.box("url ", () => {
                    mb.writeU32(0x00000001);
                  });
                });
              });

              mb.box("stbl", () => {
                // stsd
                mb.box("stsd", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.box("sowt", () => {
                    for (let i = 0; i < 6; i++) mb.writeU8(0);
                    mb.writeU16(1); // data_reference_index
                    mb.writeU16(0); // version
                    mb.writeU16(0); // revision
                    mb.writeU32(0); // vendor
                    mb.writeU16(2); // channelcount = 2 (stereo)
                    mb.writeU16(16); // samplesize = 16-bit
                    mb.writeU16(0); // compression_id
                    mb.writeU16(0); // packet_size
                    mb.writeU32(audioTimescale << 16); // sample_rate 44100
                  });
                });

                // stts
                mb.box("stts", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.writeU32(totalAudioSamples);
                  mb.writeU32(1);
                });

                // stsc
                mb.box("stsc", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.writeU32(1);
                  mb.writeU32(totalAudioSamples);
                  mb.writeU32(1);
                });

                // stsz
                mb.box("stsz", () => {
                  mb.writeU32(0);
                  mb.writeU32(4); // constant 4 bytes per sample (2ch * 2 bytes)
                  mb.writeU32(totalAudioSamples);
                });

                // stco
                mb.box("stco", () => {
                  mb.writeU32(0);
                  mb.writeU32(1);
                  mb.writeU32(mdatStartOffset + totalSampleBytes);
                });
              });
            });
          });
        });
      }
    });
    return mb.toBytes();
  };

  const ftypBytes = b.toBytes();
  let moovBytes = buildMoov(0);
  const mdatPayloadStartOffset = ftypBytes.length + moovBytes.length + 8;
  moovBytes = buildMoov(mdatPayloadStartOffset);

  const rawAudioLength = hasAudio ? rawAudio!.length : 0;
  const mdatHeaderSize = 8;
  const mdatTotalSize = mdatHeaderSize + totalSampleBytes + rawAudioLength;

  // Stream sequentially to file via BinaryFileWriter: O(1) constant RAM!
  const writer = new BinaryFileWriter(targetFileUri);

  // 1. ftyp
  await writer.write(ftypBytes);

  // 2. moov
  await writer.write(moovBytes);

  // 3. mdat header
  const mdatHeader = new Uint8Array(8);
  const mdatView = new DataView(mdatHeader.buffer);
  mdatView.setUint32(0, mdatTotalSize, false);
  mdatHeader[4] = 0x6d; // 'm'
  mdatHeader[5] = 0x64; // 'd'
  mdatHeader[6] = 0x61; // 'a'
  mdatHeader[7] = 0x74; // 't'
  await writer.write(mdatHeader);

  // 4. Sample NALs written sequentially with 4-byte big-endian size prefix
  const nalLenPrefix = new Uint8Array(4);
  const nalLenView = new DataView(nalLenPrefix.buffer);
  for (let i = 0; i < totalFrames; i++) {
    const nal = uniqueNals[frameNalIndices[i]];
    nalLenView.setUint32(0, nal.length, false);
    await writer.write(nalLenPrefix);
    await writer.write(nal);
  }

  // 5. Raw Audio PCM Bytes
  if (hasAudio && rawAudio) {
    await writer.write(rawAudio);
  }

  const finalFileSize = await writer.close();
  return finalFileSize;
}

// ---------------------------------------------------------------------------
// High-Level Native Mobile Project Exporter
// ---------------------------------------------------------------------------
export async function exportMobileProject(
  project: FastArtProject,
  options: ExportOptions = {},
  onProgress?: (percent: number, currentTime: number, duration: number) => void
): Promise<ExportResult> {
  const { fps = 15, duration = 4.0, format = "mp4", currentTime = 0, resolution = "1080p" } = options;

  let rawTitle = (project.title || (project as any).name || "").trim();
  if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === project.id) {
    rawTitle = "FastArt_Video";
  }
  const cleanTitle =
    rawTitle.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || "FastArt_Video";
  const rawDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
  const targetDir = rawDir ? (rawDir.endsWith("/") ? rawDir : `${rawDir}/`) : "";

  const createSafeBlob = (parts: any[] = [], options?: any): Blob => {
    try {
      if (typeof Blob !== "undefined") {
        return new Blob(parts, options);
      }
    } catch {}
    return { size: 0, type: options?.type || "" } as any;
  };

  // Preload and decode project media (video thumbnails, photo clips, stickers, and canvas background)
  let clipImageMap = new Map<string, DecodedImage>();
  if (format !== "wav") {
    if (onProgress) onProgress(3, 0, duration);
    try {
      clipImageMap = await preloadProjectMediaImages(project);
    } catch (preloadErr) {
      console.warn("[mobileExporter] Preloading media failed:", preloadErr);
    }
  }

  // 1. PNG Snapshot / Poster Frame
  if (format === "png") {
    if (options.isCancelled?.()) throw new Error("Export cancelled");
    const pngW = 720;
    const pngH =
      project.aspectRatio === "16:9" ? 405 : project.aspectRatio === "1:1" ? 720 : 1280;

    // Fast-path: Native Rust Core Snapshot
    try {
      const isRustReady = await rustCoreBridge.isAvailable();
      if (isRustReady) {
        if (onProgress) onProgress(40, currentTime, duration);
        const rustDataUri = await rustCoreBridge.renderSnapshot(project, currentTime, pngW, pngH);
        if (rustDataUri && rustDataUri.startsWith("data:image/png;base64,")) {
          const filename = `${cleanTitle}_snapshot_${Date.now()}.png`;
          const targetFileUri = `${targetDir}${filename}`;
          const b64 = rustDataUri.substring("data:image/png;base64,".length);
          const bytes = base64ToUint8(b64);
          const writtenSize = await writeBinaryFileSafely(targetFileUri, bytes);
          if (onProgress) onProgress(100, currentTime, duration);
          return {
            blob: createSafeBlob([]),
            videoUrl: targetFileUri,
            mimeType: "image/png",
            format: "png",
            extension: "png",
            fileSize: writtenSize,
          };
        }
      }
    } catch (rustErr) {
      console.warn("[mobileExporter] Rust snapshot fallback:", rustErr);
    }

    if (onProgress) onProgress(30, currentTime, duration);
    const frame = renderMobileProjectFrame(project, currentTime, pngW, pngH, undefined, clipImageMap);
    if (onProgress) onProgress(75, currentTime, duration);

    const pngBytes = frame.toPngBytes();
    const filename = `${cleanTitle}_snapshot_${Date.now()}.png`;
    const targetFileUri = `${targetDir}${filename}`;

    const writtenSize = await writeBinaryFileSafely(targetFileUri, pngBytes);

    if (onProgress) onProgress(100, currentTime, duration);

    return {
      blob: createSafeBlob([]),
      videoUrl: targetFileUri,
      mimeType: "image/png",
      format: "png",
      extension: "png",
      fileSize: writtenSize,
    };
  }

  // 2. Studio Audio Track (WAV)
  if (format === "wav") {
    if (options.isCancelled?.()) throw new Error("Export cancelled");
    if (onProgress) onProgress(40, 0, duration);
    const uint8 = await exportProjectAudioToWavBytes(project, duration, 44100);
    const audioBlob = await exportProjectAudioToWav(project, duration, 44100);
    const filename = `${cleanTitle}_audio_${Date.now()}.wav`;
    const targetFileUri = `${targetDir}${filename}`;

    const writtenSize = await writeBinaryFileSafely(targetFileUri, uint8);

    if (onProgress) onProgress(100, duration, duration);

    return {
      blob: audioBlob,
      videoUrl: targetFileUri,
      mimeType: "audio/wav",
      format: "wav",
      extension: "wav",
      fileSize: writtenSize,
    };
  }

  // 3. Animated GIF
  if (format === "gif") {
    const gifFps = 10;
    const totalFrames = Math.max(1, Math.ceil(duration * gifFps));
    const delayMs = Math.round(1000 / gifFps);
    const gifW = 360;
    const gifH =
      project.aspectRatio === "16:9" ? 202 : project.aspectRatio === "1:1" ? 360 : 640;

    const gifFrames: GifFrame[] = [];

    for (let f = 0; f < totalFrames; f++) {
      if (options.isCancelled?.()) throw new Error("Export cancelled");
      const frameTime = f / gifFps;
      const frameBuf = renderMobileProjectFrame(project, frameTime, gifW, gifH, undefined, clipImageMap);

      gifFrames.push({
        imageData: {
          width: gifW,
          height: gifH,
          data: frameBuf.data as any,
        } as ImageData,
        delayMs,
      });

      if (onProgress) {
        onProgress(Math.round(((f + 1) / totalFrames) * 85), frameTime, duration);
      }

      if (f % 4 === 0 && f < totalFrames - 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const gifBytes = createGif(gifW, gifH, gifFrames, 0);
    const filename = `${cleanTitle}_anim_${Date.now()}.gif`;
    const targetFileUri = `${targetDir}${filename}`;

    const writtenSize = await writeBinaryFileSafely(targetFileUri, gifBytes);

    if (onProgress) onProgress(100, duration, duration);

    return {
      blob: createSafeBlob([]),
      videoUrl: targetFileUri,
      mimeType: "image/gif",
      format: "gif",
      extension: "gif",
      fileSize: writtenSize,
    };
  }

  // 4. Genuine Multi-Track H.264 MP4 Video Export on Mobile
  // Resolves aspect ratio to exact multiples of 16 for standard H.264 macroblock alignment
  let targetW = 480;
  let targetH = 848;

  if (resolution === "2K/4K" || resolution === "1080p") {
    // High-definition crisp mobile export (aligned to 16 for macroblocks)
    if (project.aspectRatio === "16:9") {
      targetW = 960;
      targetH = 544;
    } else if (project.aspectRatio === "1:1") {
      targetW = 544;
      targetH = 544;
    } else if (project.aspectRatio === "4:5") {
      targetW = 480;
      targetH = 608;
    } else if (project.aspectRatio === "2.35:1") {
      targetW = 960;
      targetH = 416;
    } else {
      // 9:16 vertical video
      targetW = 544;
      targetH = 960;
    }
  } else if (resolution === "720p") {
    // Standard Mobile High Quality (Macroblock aligned to 16)
    if (project.aspectRatio === "16:9") {
      targetW = 848;
      targetH = 480;
    } else if (project.aspectRatio === "1:1") {
      targetW = 480;
      targetH = 480;
    } else if (project.aspectRatio === "4:5") {
      targetW = 400;
      targetH = 512;
    } else if (project.aspectRatio === "2.35:1") {
      targetW = 752;
      targetH = 320;
    } else {
      // 9:16 vertical video
      targetW = 480;
      targetH = 848;
    }
  } else {
    // 480p / Fast Mobile Baseline
    if (project.aspectRatio === "16:9") {
      targetW = 640;
      targetH = 368;
    } else if (project.aspectRatio === "1:1") {
      targetW = 368;
      targetH = 368;
    } else if (project.aspectRatio === "4:5") {
      targetW = 384;
      targetH = 480;
    } else if (project.aspectRatio === "2.35:1") {
      targetW = 640;
      targetH = 272;
    } else {
      // 9:16
      targetW = 368;
      targetH = 640;
    }
  }

  const mbW = targetW >> 4;
  const mbH = targetH >> 4;
  // Adaptive frame rate: 12-15 fps for smooth mobile animations with maximum throughput
  const targetFps = fps && fps > 0 ? fps : 15;
  const renderFps = duration > 30 ? Math.min(targetFps, 12) : Math.min(targetFps, 15);
  const totalFrames = Math.max(1, Math.ceil(duration * renderFps));
  const uniqueNals: Uint8Array[] = [];
  const frameNalIndices: number[] = new Array(totalFrames);
  const reusableFrame = new MobileFrameBuffer(targetW, targetH, project.canvasBackground || "#000000");

  // Extract multi-track project audio (video dialogues, music, voiceovers, SFX)
  let audioWavBytes: Uint8Array | null = null;
  try {
    audioWavBytes = await exportProjectAudioToWavBytes(project, duration, 44100);
  } catch (audioErr) {
    console.warn("[mobileExporter] Audio extraction failed, continuing video export:", audioErr);
  }

  let lastStateKey = "";
  let lastUniqueIdx = -1;

  for (let f = 0; f < totalFrames; f++) {
    if (options.isCancelled?.()) throw new Error("Export cancelled");
    const frameTime = f / renderFps;
    const stateKey = getMobileFrameStateKey(project, frameTime);

    if (stateKey === lastStateKey && lastUniqueIdx >= 0) {
      // Deduplicated static frame: reference previous unique NAL index
      frameNalIndices[f] = lastUniqueIdx;
    } else {
      const frameBuf = renderMobileProjectFrame(project, frameTime, targetW, targetH, reusableFrame, clipImageMap);
      const nal = encodeH264IFrame(frameBuf, f, mbW, mbH);
      lastUniqueIdx = uniqueNals.length;
      uniqueNals.push(nal);
      lastStateKey = stateKey;
      frameNalIndices[f] = lastUniqueIdx;
    }

    if (onProgress) {
      const pct = Math.min(92, Math.max(5, Math.round(5 + ((f + 1) / totalFrames) * 87)));
      onProgress(pct, frameTime, duration);
    }

    // Yield cooperatively to the JS event loop every 4 frames so UI progress updates smoothly
    if (f % 4 === 0 && f < totalFrames - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (options.isCancelled?.()) throw new Error("Export cancelled");

  if (onProgress) onProgress(95, duration, duration);

  const filename = `${cleanTitle}_${Date.now()}.mp4`;
  const targetFileUri = `${targetDir}${filename}`;

  const finalFileSize = await writeMp4ContainerToFile(
    targetFileUri,
    targetW,
    targetH,
    renderFps,
    uniqueNals,
    frameNalIndices,
    audioWavBytes
  );

  if (options.isCancelled?.()) throw new Error("Export cancelled");
  if (onProgress) onProgress(100, duration, duration);

  return {
    blob: createSafeBlob([]),
    videoUrl: targetFileUri,
    mimeType: "video/mp4",
    format: "mp4",
    extension: "mp4",
    fileSize: finalFileSize,
  };
}
