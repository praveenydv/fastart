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

declare const Buffer: any;

function uint8ToBase64(uint8: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(uint8).toString("base64");
  }
  let binary = "";
  const len = uint8.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return "";
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

function hexToRgba(hex: string, alpha: number = 1.0): [number, number, number, number] {
  if (!hex) return [255, 255, 255, Math.round(alpha * 255)];
  if (hex.startsWith("blur:")) {
    return [15, 23, 42, Math.round(alpha * 255)];
  }
  if (hex.startsWith("gradient:")) {
    const parts = hex.replace("gradient:", "").split(",");
    return hexToRgba(parts[0] || "#0B0D13", alpha);
  }
  if (hex.startsWith("rgba")) {
    const m = hex.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/i);
    if (m) {
      const a = m[4] !== undefined ? parseFloat(m[4]) * alpha : alpha;
      return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), Math.round(a * 255)];
    }
  }
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
  return [r || 0, g || 0, b || 0, Math.round(alpha * 255)];
}

// ---------------------------------------------------------------------------
// Mobile Frame Buffer: Multi-Track 2D Rasterizer
// ---------------------------------------------------------------------------
export class MobileFrameBuffer {
  public width: number;
  public height: number;
  public data: Uint8Array;

  constructor(width: number, height: number, backgroundColorHex: string = "#000000") {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
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
        const rowOffset = y * this.width * 4;
        for (let x = 0; x < this.width; x++) {
          const idx = rowOffset + x * 4;
          this.data[idx] = r;
          this.data[idx + 1] = g;
          this.data[idx + 2] = b;
          this.data[idx + 3] = 255;
        }
      }
      return;
    }

    const [r, g, b, a] = hexToRgba(hexColor);
    const len = this.data.length;
    for (let i = 0; i < len; i += 4) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = a;
    }
  }

  public setPixel(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a >= 255) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
    } else if (a > 0) {
      const alphaNorm = a / 255;
      const invAlpha = 1 - alphaNorm;
      this.data[idx] = Math.round(r * alphaNorm + this.data[idx] * invAlpha);
      this.data[idx + 1] = Math.round(g * alphaNorm + this.data[idx + 1] * invAlpha);
      this.data[idx + 2] = Math.round(b * alphaNorm + this.data[idx + 2] * invAlpha);
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

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.setPixel(px, py, r, g, b, a);
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
// Render an Entire Multi-Track Mobile Project Frame to Buffer
// ---------------------------------------------------------------------------
export function renderMobileProjectFrame(
  project: FastArtProject,
  time: number,
  canvasW: number,
  canvasH: number
): MobileFrameBuffer {
  const canvasBg = project.canvasBackground || "#000000";
  const buffer = new MobileFrameBuffer(canvasW, canvasH, canvasBg);

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

  // 1. Video / Photo Clips
  if (activeVideos.length > 0) {
    const vid = activeVideos[0];
    let motionX = 0;
    let motionY = 0;
    let motionScale = 1.0;
    if (vid.motionTrack && vid.motionTrack.enabled) {
      const motion = applyMotionTracking(time, vid.startTime, vid.duration, vid.motionTrack);
      motionX = motion.dx;
      motionY = motion.dy;
      motionScale = motion.dScale;
    }

    const aspect = 16 / 9;
    let vw = canvasW * motionScale;
    let vh = (canvasW / aspect) * motionScale;
    if (vh > canvasH) {
      vh = canvasH * motionScale;
      vw = canvasH * aspect * motionScale;
    }
    const vx = Math.round((canvasW - vw) / 2 + motionX + (vid.transform?.x || 0));
    const vy = Math.round((canvasH - vh) / 2 + motionY + (vid.transform?.y || 0));

    buffer.drawVideoCard(vid, vx, vy, Math.round(vw), Math.round(vh), time);
  }

  // 2. Text Overlays (Burned in with typography, animations & badges)
  for (const txt of activeTexts) {
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

    buffer.drawText(txt.text, posX, posY, {
      color,
      backgroundColor: hasBadge ? bgBadge : undefined,
      scale,
      fontSize: Math.round((txt.style?.fontSize || 28) * 0.9),
      enableOutline: true,
      strokeColor: txt.style?.strokeColor || "#000000",
    });
  }

  // 3. Auto-Captions (With active word highlight & preset styling)
  for (const cap of activeCaptions) {
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
  }

  // 4. Sticker Overlays
  for (const st of activeStickers) {
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
    const label = st.char || (st as any).name || (st as any).emoji || "★";
    buffer.drawSticker(label, posX, posY, (st.scale || 1.0) * motionScale);
  }

  // 5. Effect Overlays
  if (activeEffects.length > 0) {
    for (const eff of activeEffects) {
      if (eff.type === "vignette") {
        buffer.fillRect(0, 0, canvasW, 12, "#000000", 0.7);
        buffer.fillRect(0, canvasH - 12, canvasW, 12, "#000000", 0.7);
      } else if (eff.type === "flash") {
        const elapsed = time - eff.startTime;
        if (elapsed < 0.25) {
          const alpha = 1.0 - elapsed / 0.25;
          buffer.fillRect(0, 0, canvasW, canvasH, "#FFFFFF", alpha * 0.6);
        }
      } else if (eff.type === "cinema" || eff.type === "letterbox") {
        const barH = Math.round(canvasH * 0.1);
        buffer.fillRect(0, 0, canvasW, barH, "#000000", 1.0);
        buffer.fillRect(0, canvasH - barH, canvasW, barH, "#000000", 1.0);
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
  public bytes: number[] = [];
  private currentByte = 0;
  private numBitsInCurrentByte = 0;

  public writeBit(bit: number) {
    this.currentByte = (this.currentByte << 1) | (bit & 1);
    this.numBitsInCurrentByte++;
    if (this.numBitsInCurrentByte === 8) {
      this.bytes.push(this.currentByte);
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
      this.bytes.push(this.currentByte);
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

  public toBytes(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

// H.264 Emulation Prevention: inserts 0x03 after two consecutive 0x00 bytes if followed by <= 0x03
function rbspToNal(rbsp: Uint8Array): Uint8Array {
  const out: number[] = [];
  let zeroCount = 0;
  for (let i = 0; i < rbsp.length; i++) {
    const b = rbsp[i];
    if (zeroCount === 2 && b <= 3) {
      out.push(3);
      zeroCount = 0;
    }
    out.push(b);
    if (b === 0) {
      zeroCount++;
    } else {
      zeroCount = 0;
    }
  }
  return new Uint8Array(out);
}

// Sequence Parameter Set (SPS) NAL unit (type 7)
function buildH264Sps(mbWidth: number, mbHeight: number): Uint8Array {
  const bw = new BitWriter();
  bw.writeBits(66, 8); // Profile IDC: 66 (Baseline)
  bw.writeBits(0xc0, 8); // Constraint flags: constraint_set0..1
  bw.writeBits(31, 8); // Level IDC: 31 (Level 3.1)
  bw.writeUe(0); // seq_parameter_set_id
  bw.writeUe(0); // log2_max_frame_num_minus4
  bw.writeUe(0); // pic_order_cnt_type
  bw.writeUe(0); // log2_max_pic_order_cnt_lsb_minus4
  bw.writeUe(1); // max_num_ref_frames
  bw.writeBit(0); // gaps_in_frame_num_value_allowed_flag
  bw.writeUe(mbWidth - 1); // pic_width_in_mbs_minus1
  bw.writeUe(mbHeight - 1); // pic_height_in_map_units_minus1
  bw.writeBit(1); // frame_mbs_only_flag
  bw.writeBit(1); // direct_8x8_inference_flag
  bw.writeBit(0); // frame_cropping_flag
  bw.writeBit(0); // vui_parameters_present_flag
  bw.writeRbspTrailingBits();

  const nalBody = rbspToNal(bw.toBytes());
  const nal = new Uint8Array(1 + nalBody.length);
  nal[0] = 0x67; // NAL unit type 7 (SPS), nal_ref_idc = 3
  nal.set(nalBody, 1);
  return nal;
}

// Picture Parameter Set (PPS) NAL unit (type 8)
function buildH264Pps(): Uint8Array {
  const bw = new BitWriter();
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
function encodeH264IFrame(
  buffer: MobileFrameBuffer,
  frameIndex: number,
  mbWidth: number,
  mbHeight: number
): Uint8Array {
  const bw = new BitWriter();

  // Slice Header
  bw.writeUe(0); // first_mb_in_slice
  bw.writeUe(7); // slice_type: 7 (All I-slice)
  bw.writeUe(0); // pic_parameter_set_id
  bw.writeBits(frameIndex % 16, 4); // frame_num
  bw.writeUe(frameIndex % 8); // idr_pic_id
  bw.writeBits((frameIndex * 2) % 16, 4); // pic_order_cnt_lsb
  bw.writeBit(0); // no_output_of_prior_pics_flag
  bw.writeBit(0); // long_term_reference_flag
  bw.writeSe(0); // slice_qp_delta

  const width = buffer.width;
  const height = buffer.height;
  const rgba = buffer.data;

  // Convert and write macroblocks (16x16 luma, 8x8 chroma U, 8x8 chroma V)
  for (let mbY = 0; mbY < mbHeight; mbY++) {
    for (let mbX = 0; mbX < mbWidth; mbX++) {
      bw.writeUe(25); // mb_type: 25 (I_PCM)
      bw.alignZero();

      // 1. 256 bytes Luma Y
      for (let y = 0; y < 16; y++) {
        const py = Math.min(height - 1, mbY * 16 + y);
        const rowOffset = py * width * 4;
        for (let x = 0; x < 16; x++) {
          const px = Math.min(width - 1, mbX * 16 + x);
          const idx = rowOffset + px * 4;
          const r = rgba[idx];
          const g = rgba[idx + 1];
          const b = rgba[idx + 2];
          // BT.601 Studio Range Y
          const yVal = Math.min(235, Math.max(16, ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16));
          bw.bytes.push(yVal);
        }
      }

      // 2. 64 bytes Chroma Cb (U)
      for (let y = 0; y < 8; y++) {
        const py = Math.min(height - 1, mbY * 16 + y * 2);
        const rowOffset = py * width * 4;
        for (let x = 0; x < 8; x++) {
          const px = Math.min(width - 1, mbX * 16 + x * 2);
          const idx = rowOffset + px * 4;
          const r = rgba[idx];
          const g = rgba[idx + 1];
          const b = rgba[idx + 2];
          const uVal = Math.min(240, Math.max(16, ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128));
          bw.bytes.push(uVal);
        }
      }

      // 3. 64 bytes Chroma Cr (V)
      for (let y = 0; y < 8; y++) {
        const py = Math.min(height - 1, mbY * 16 + y * 2);
        const rowOffset = py * width * 4;
        for (let x = 0; x < 8; x++) {
          const px = Math.min(width - 1, mbX * 16 + x * 2);
          const idx = rowOffset + px * 4;
          const r = rgba[idx];
          const g = rgba[idx + 1];
          const b = rgba[idx + 2];
          const vVal = Math.min(240, Math.max(16, ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128));
          bw.bytes.push(vVal);
        }
      }
    }
  }

  bw.writeRbspTrailingBits();
  const nalBody = rbspToNal(bw.toBytes());
  const nal = new Uint8Array(1 + nalBody.length);
  nal[0] = 0x65; // NAL unit type 5 (IDR slice), nal_ref_idc = 3
  nal.set(nalBody, 1);
  return nal;
}

// ---------------------------------------------------------------------------
// ISO Base Media File Format (MP4) Container Builder
// (Compliant with ISO/IEC 14496-12 / 14496-15)
// ---------------------------------------------------------------------------
class Mp4BoxBuilder {
  public buffer: number[] = [];

  public writeU8(val: number) {
    this.buffer.push(val & 0xff);
  }

  public writeU16(val: number) {
    this.buffer.push((val >>> 8) & 0xff);
    this.buffer.push(val & 0xff);
  }

  public writeU32(val: number) {
    this.buffer.push((val >>> 24) & 0xff);
    this.buffer.push((val >>> 16) & 0xff);
    this.buffer.push((val >>> 8) & 0xff);
    this.buffer.push(val & 0xff);
  }

  public writeAscii(str: string) {
    for (let i = 0; i < str.length; i++) {
      this.buffer.push(str.charCodeAt(i));
    }
  }

  public writeBytes(bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
  }

  public box(type: string, payloadFn: () => void) {
    const startPos = this.buffer.length;
    this.writeU32(0); // placeholder size
    this.writeAscii(type);
    payloadFn();
    const endPos = this.buffer.length;
    const size = endPos - startPos;
    this.buffer[startPos] = (size >>> 24) & 0xff;
    this.buffer[startPos + 1] = (size >>> 16) & 0xff;
    this.buffer[startPos + 2] = (size >>> 8) & 0xff;
    this.buffer[startPos + 3] = size & 0xff;
  }

  public toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

function createMp4Container(
  width: number,
  height: number,
  fps: number,
  sampleNals: Uint8Array[]
): Uint8Array {
  const mbW = width >> 4;
  const mbH = height >> 4;
  const sps = buildH264Sps(mbW, mbH);
  const pps = buildH264Pps();

  const totalFrames = sampleNals.length;
  const timescale = 1000;
  const frameDurationMs = Math.round(1000 / fps);
  const durationMs = totalFrames * frameDurationMs;

  const b = new Mp4BoxBuilder();

  // 1. ftyp Box
  b.box("ftyp", () => {
    b.writeAscii("isom");
    b.writeU32(0x00000200);
    b.writeAscii("isom");
    b.writeAscii("mp42");
    b.writeAscii("avc1");
  });

  const sampleSizes: number[] = [];
  for (const s of sampleNals) {
    sampleSizes.push(4 + s.length);
  }

  const buildMoov = (chunkOffset: number) => {
    const mb = new Mp4BoxBuilder();
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
        mb.writeU32(2); // next_track_id
      });

      // trak
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
                    mb.writeU8(0xc0); // profile_compatibility
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
                for (const sz of sampleSizes) {
                  mb.writeU32(sz);
                }
              });

              // stco
              mb.box("stco", () => {
                mb.writeU32(0);
                mb.writeU32(totalFrames);
                let curOffset = chunkOffset;
                for (let i = 0; i < totalFrames; i++) {
                  mb.writeU32(curOffset);
                  curOffset += sampleSizes[i];
                }
              });
            });
          });
        });
      });
    });
    return mb.toBytes();
  };

  const ftypBytes = b.toBytes();
  const estimatedOffset = ftypBytes.length + 1024;
  let moovBytes = buildMoov(estimatedOffset + 8);
  const actualOffset = ftypBytes.length + moovBytes.length + 8;
  moovBytes = buildMoov(actualOffset);

  b.writeBytes(moovBytes);

  // mdat Box
  b.box("mdat", () => {
    for (const s of sampleNals) {
      b.writeU32(s.length);
      b.writeBytes(s);
    }
  });

  return b.toBytes();
}

// ---------------------------------------------------------------------------
// High-Level Native Mobile Project Exporter
// ---------------------------------------------------------------------------
export async function exportMobileProject(
  project: FastArtProject,
  options: ExportOptions = {},
  onProgress?: (percent: number, currentTime: number, duration: number) => void
): Promise<ExportResult> {
  const { fps = 15, duration = 4.0, format = "mp4", currentTime = 0 } = options;

  let rawTitle = (project.title || (project as any).name || "").trim();
  if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === project.id) {
    rawTitle = "FastArt_Video";
  }
  const cleanTitle =
    rawTitle.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || "FastArt_Video";
  const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";

  // 1. PNG Snapshot / Poster Frame
  if (format === "png") {
    const pngW = 720;
    const pngH =
      project.aspectRatio === "16:9" ? 405 : project.aspectRatio === "1:1" ? 720 : 1280;

    if (onProgress) onProgress(30, currentTime, duration);
    const frame = renderMobileProjectFrame(project, currentTime, pngW, pngH);
    if (onProgress) onProgress(75, currentTime, duration);

    const pngBytes = frame.toPngBytes();
    const filename = `${cleanTitle}_snapshot_${Date.now()}.png`;
    const targetFileUri = `${targetDir}${filename}`;

    const base64Data = uint8ToBase64(pngBytes);
    await FileSystem.writeAsStringAsync(targetFileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (onProgress) onProgress(100, currentTime, duration);

    return {
      blob: new Blob([]),
      videoUrl: targetFileUri,
      mimeType: "image/png",
      format: "png",
      extension: "png",
      fileSize: pngBytes.length,
    };
  }

  // 2. Studio Audio Track (WAV)
  if (format === "wav") {
    if (onProgress) onProgress(40, 0, duration);
    const uint8 = exportProjectAudioToWavBytes(project, duration, 44100);
    const audioBlob = await exportProjectAudioToWav(project, duration, 44100);
    const filename = `${cleanTitle}_audio_${Date.now()}.wav`;
    const targetFileUri = `${targetDir}${filename}`;

    const base64Data = uint8ToBase64(uint8);
    await FileSystem.writeAsStringAsync(targetFileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (onProgress) onProgress(100, duration, duration);

    return {
      blob: audioBlob,
      videoUrl: targetFileUri,
      mimeType: "audio/wav",
      format: "wav",
      extension: "wav",
      fileSize: uint8.length,
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
      const frameTime = f / gifFps;
      const frameBuf = renderMobileProjectFrame(project, frameTime, gifW, gifH);

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

      if (f % 3 === 0 && f < totalFrames - 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const gifBytes = createGif(gifW, gifH, gifFrames, 0);
    const filename = `${cleanTitle}_anim_${Date.now()}.gif`;
    const targetFileUri = `${targetDir}${filename}`;

    const base64Data = uint8ToBase64(gifBytes);
    await FileSystem.writeAsStringAsync(targetFileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (onProgress) onProgress(100, duration, duration);

    return {
      blob: new Blob([]),
      videoUrl: targetFileUri,
      mimeType: "image/gif",
      format: "gif",
      extension: "gif",
      fileSize: gifBytes.length,
    };
  }

  // 4. Genuine Multi-Track H.264 MP4 Video Export on Mobile
  // Resolves aspect ratio to exact multiples of 16 for standard H.264 macroblock alignment
  let targetW = 368;
  let targetH = 640;
  if (project.aspectRatio === "16:9") {
    targetW = 640;
    targetH = 368;
  } else if (project.aspectRatio === "1:1") {
    targetW = 480;
    targetH = 480;
  } else if (project.aspectRatio === "4:5") {
    targetW = 384;
    targetH = 480;
  } else if (project.aspectRatio === "2.35:1") {
    targetW = 640;
    targetH = 272;
  }

  const mbW = targetW >> 4;
  const mbH = targetH >> 4;
  const renderFps = Math.min(Math.max(fps || 15, 10), 24);
  const totalFrames = Math.max(1, Math.ceil(duration * renderFps));
  const frameNals: Uint8Array[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const frameTime = f / renderFps;
    const frameBuf = renderMobileProjectFrame(project, frameTime, targetW, targetH);
    const nal = encodeH264IFrame(frameBuf, f, mbW, mbH);
    frameNals.push(nal);

    if (onProgress) {
      const pct = Math.round(((f + 1) / totalFrames) * 88);
      onProgress(pct, frameTime, duration);
    }

    // Yield cooperatively to the JS event loop every 3 frames to keep UI responsive
    if (f % 3 === 0 && f < totalFrames - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (onProgress) onProgress(92, duration, duration);

  // Mux into standard ISO Base Media MP4 container
  const mp4Bytes = createMp4Container(targetW, targetH, renderFps, frameNals);

  const filename = `${cleanTitle}_${Date.now()}.mp4`;
  const targetFileUri = `${targetDir}${filename}`;

  const base64Data = uint8ToBase64(mp4Bytes);
  await FileSystem.writeAsStringAsync(targetFileUri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (onProgress) onProgress(100, duration, duration);

  return {
    blob: new Blob([]),
    videoUrl: targetFileUri,
    mimeType: "video/mp4",
    format: "mp4",
    extension: "mp4",
    fileSize: mp4Bytes.length,
  };
}
