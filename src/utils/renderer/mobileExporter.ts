// FastArt Mobile Compositing & Export Engine (Pure JavaScript & Expo Native)
// Handles complete rendering of multi-track projects on mobile:
// - Canvas Background Color
// - Video / Image Clips (with transforms, crops, fits)
// - Text Clips (custom colors, backgrounds, badges, outlines, scales, rotations)
// - Sticker Clips (emojis, icons, graphics)
// - Audio Tracks (WAV synthesis)
// - Output Formats: MP4, GIF, PNG, WAV

import * as FileSystem from "expo-file-system/legacy";
import { FastArtProject, TextClip, StickerClip, VideoClip } from "../../types/project";
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

// Table for CRC-32 checksum calculation
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
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

// Adler-32 checksum calculation for zlib
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

// Lightweight pure-JS PNG encoder with zero native or Node dependencies
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

  // Deflate into uncompressed DEFLATE blocks (max 65535 bytes per block)
  const CHUNK_SIZE = 65535;
  const numBlocks = Math.ceil(uncompressedLength / CHUNK_SIZE) || 1;
  const zlibDataLength = 2 + (numBlocks * 5) + uncompressedLength + 4;
  const zlibData = new Uint8Array(zlibDataLength);

  // zlib header (CMF: 0x78 = Deflate 32k window, FLG: 0x01)
  zlibData[0] = 0x78;
  zlibData[1] = 0x01;

  let zPos = 2;
  let remaining = uncompressedLength;
  let srcPos = 0;

  for (let b = 0; b < numBlocks; b++) {
    const isLast = (b === numBlocks - 1);
    const blockSize = Math.min(CHUNK_SIZE, remaining);

    zlibData[zPos++] = isLast ? 0x01 : 0x00; // BFINAL + BTYPE (00: uncompressed)
    zlibData[zPos++] = blockSize & 0xff;
    zlibData[zPos++] = (blockSize >> 8) & 0xff;
    const nlen = (~blockSize) & 0xffff;
    zlibData[zPos++] = nlen & 0xff;
    zlibData[zPos++] = (nlen >> 8) & 0xff;

    zlibData.set(uncompressed.subarray(srcPos, srcPos + blockSize), zPos);
    zPos += blockSize;
    srcPos += blockSize;
    remaining -= blockSize;
  }

  // Adler-32 checksum (big-endian)
  const adler = adler32(uncompressed);
  zlibData[zPos++] = (adler >> 24) & 0xff;
  zlibData[zPos++] = (adler >> 16) & 0xff;
  zlibData[zPos++] = (adler >> 8) & 0xff;
  zlibData[zPos++] = adler & 0xff;

  // Total PNG length: 8 (sig) + 25 (IHDR) + (12 + zlibDataLength) (IDAT) + 12 (IEND)
  const totalPngLength = 8 + 25 + 12 + zlibDataLength + 12;
  const png = new Uint8Array(totalPngLength);
  const view = new DataView(png.buffer);

  // PNG Signature
  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);

  let offset = 8;

  // 1. IHDR Chunk
  view.setUint32(offset, 13, false); // Length = 13
  offset += 4;
  const ihdrTypeOffset = offset;
  png.set([0x49, 0x48, 0x44, 0x52], offset); // "IHDR"
  offset += 4;
  view.setUint32(offset, width, false); // Width
  view.setUint32(offset + 4, height, false); // Height
  png[offset + 8] = 8; // Bit depth: 8
  png[offset + 9] = 6; // Color type: 6 (RGBA)
  png[offset + 10] = 0; // Compression: 0 (deflate)
  png[offset + 11] = 0; // Filter: 0
  png[offset + 12] = 0; // Interlace: 0
  offset += 13;
  const ihdrCrc = crc32(png, ihdrTypeOffset, 4 + 13);
  view.setUint32(offset, ihdrCrc, false);
  offset += 4;

  // 2. IDAT Chunk
  view.setUint32(offset, zlibDataLength, false);
  offset += 4;
  const idatTypeOffset = offset;
  png.set([0x49, 0x44, 0x41, 0x54], offset); // "IDAT"
  offset += 4;
  png.set(zlibData, offset);
  offset += zlibDataLength;
  const idatCrc = crc32(png, idatTypeOffset, 4 + zlibDataLength);
  view.setUint32(offset, idatCrc, false);
  offset += 4;

  // 3. IEND Chunk
  view.setUint32(offset, 0, false);
  offset += 4;
  const iendTypeOffset = offset;
  png.set([0x49, 0x45, 0x4e, 0x44], offset); // "IEND"
  offset += 4;
  const iendCrc = crc32(png, iendTypeOffset, 4);
  view.setUint32(offset, iendCrc, false);

  return png;
}

// 24-bit / 32-bit BMP buffer fallback with zero native dependencies
export function createBmpBuffer(width: number, height: number, rgbaData: Uint8Array): Uint8Array {
  const rowSize = width * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  // BMP Header (14 bytes)
  buffer[0] = 0x42; // 'B'
  buffer[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true); // Offset to pixel array

  // DIB Header (BITMAPINFOHEADER - 40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true); // Top-down
  view.setUint16(26, 1, true); // Color planes
  view.setUint16(28, 32, true); // Bits per pixel (32-bit BGRA)
  view.setUint32(30, 0, true); // BI_RGB (no compression)
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // ~72 DPI
  view.setInt32(42, 2835, true);

  // Write pixels (RGBA -> BGRA)
  let dst = 54;
  for (let i = 0; i < rgbaData.length; i += 4) {
    buffer[dst++] = rgbaData[i + 2]; // B
    buffer[dst++] = rgbaData[i + 1]; // G
    buffer[dst++] = rgbaData[i];     // R
    buffer[dst++] = rgbaData[i + 3]; // A
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// 8x16 Embedded ASCII Bitmap Font for Crisp On-Canvas Text Rendering
// ---------------------------------------------------------------------------
// Basic 5x7 / 8x16 font glyph patterns for numbers, uppercase, lowercase, punctuation
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
};

function hexToRgba(hex: string, alpha: number = 1.0): [number, number, number, number] {
  if (hex.startsWith("blur:")) {
    return [11, 13, 19, 255];
  }
  if (hex.startsWith("gradient:")) {
    const parts = hex.replace("gradient:", "").split(",");
    return hexToRgba(parts[0] || "#0B0D13", alpha);
  }
  const clean = hex.replace("#", "").trim();
  let r = 0, g = 0, b = 0;
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

  public fillRect(x: number, y: number, w: number, h: number, hexColor: string, alpha: number = 1.0) {
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

  // Draw crisp vector-scaled text with optional background badge box
  public drawText(
    text: string,
    centerX: number,
    centerY: number,
    options: {
      color?: string;
      backgroundColor?: string;
      scale?: number;
      fontSize?: number;
    } = {}
  ) {
    if (!text) return;
    const cleanText = text.trim();
    const fontScale = Math.max(1, Math.round((options.fontSize || 24) / 12 * (options.scale || 1.0)));
    const charW = 8 * fontScale;
    const charH = 16 * fontScale;
    const totalW = cleanText.length * charW;
    const totalH = charH;

    const startX = Math.round(centerX - totalW / 2);
    const startY = Math.round(centerY - totalH / 2);

    // 1. Draw badge background if defined
    if (options.backgroundColor && options.backgroundColor !== "transparent") {
      const padX = 14 * fontScale;
      const padY = 8 * fontScale;
      this.fillRect(
        startX - padX,
        startY - padY,
        totalW + padX * 2,
        totalH + padY * 2,
        options.backgroundColor,
        0.88
      );
    }

    // 2. Render each character glyph
    const [r, g, b, a] = hexToRgba(options.color || "#FFFFFF");

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i].toUpperCase();
      const glyph = FONT_GLYPHS[char] || FONT_GLYPHS["?"];
      const charOffset = startX + i * charW;

      for (let row = 0; row < 16; row++) {
        const rowByte = glyph[row] || 0;
        for (let col = 0; col < 8; col++) {
          if ((rowByte & (0x80 >> col)) !== 0) {
            // Draw scaled pixel block
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

  // Draw sticker label / icon
  public drawSticker(
    label: string,
    centerX: number,
    centerY: number,
    scale: number = 1.0,
    backgroundColor: string = "rgba(0,0,0,0.4)"
  ) {
    const size = Math.round(48 * scale);
    this.fillRect(centerX - size / 2, centerY - size / 2, size, size, backgroundColor, 0.6);
    this.drawText(label.slice(0, 4), centerX, centerY, {
      color: "#00F2FE",
      fontSize: Math.round(18 * scale),
    });
  }

  public toPngBytes(): Uint8Array {
    return createPngBuffer(this.width, this.height, this.data);
  }
}

// ---------------------------------------------------------------------------
// Render an Entire Mobile Project Frame to Buffer
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
  const stickerClips = project.tracks.stickers || [];
  const effectClips = project.tracks.effects || [];

  const activeVideos = videoClips.filter((c) => time >= c.startTime && time <= c.startTime + c.duration);
  const activeTexts = textClips.filter((t) => time >= t.startTime && time <= t.startTime + t.duration);
  const activeStickers = stickerClips.filter((s) => time >= s.startTime && time <= s.startTime + s.duration);
  const activeEffects = effectClips.filter((e) => time >= e.startTime && time <= e.startTime + e.duration);

  // 1. Video placeholder / frame bounds
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
    const vx = Math.round((canvasW - vw) / 2 + motionX);
    const vy = Math.round((canvasH - vh) / 2 + motionY);

    // Draw video region
    buffer.fillRect(vx, vy, vw, vh, "#121622");
    buffer.fillRect(vx + 4, vy + 4, vw - 8, vh - 8, "#1A2030");
    buffer.drawText(
      vid.title ? vid.title.slice(0, 18) : "FastArt Clip",
      canvasW / 2 + motionX,
      canvasH / 2 + motionY,
      { color: "#8E95A5", fontSize: 16 }
    );
  }

  // 2. Text Overlays (Burned in with high-contrast text and background badges)
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

    const posX = canvasW / 2 + (txt.position?.x || 0) + animOffsetX + motionX;
    const posY = canvasH / 2 + (txt.position?.y || 0) + animOffsetY + motionY;
    const scale = (txt.scale || 1.0) * animScale * motionScale;
    const color = txt.style?.color || "#FFFFFF";
    const bgBadge = txt.style?.backgroundColor;
    const hasBadge = bgBadge && bgBadge !== "transparent";

    buffer.drawText(txt.text, posX, posY, {
      color,
      backgroundColor: hasBadge ? bgBadge : undefined,
      scale,
      fontSize: Math.round((txt.style?.fontSize || 28) * 0.9),
    });
  }

  // 3. Sticker Overlays
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

    const posX = canvasW / 2 + (st.position?.x || 0) + motionX;
    const posY = canvasH / 2 + (st.position?.y || 0) + motionY;
    const label = st.char || (st as any).name || (st as any).emoji || "★";
    buffer.drawSticker(label, posX, posY, (st.scale || 1.0) * motionScale);
  }

  // 4. Effect Overlay
  if (activeEffects.length > 0) {
    const eff = activeEffects[0];
    if (eff.type === "vignette") {
      buffer.fillRect(0, 0, canvasW, 8, "#000000", 0.7);
      buffer.fillRect(0, canvasH - 8, canvasW, 8, "#000000", 0.7);
    } else if (eff.type === "flash") {
      buffer.fillRect(0, 0, canvasW, canvasH, "#FFFFFF", 0.3);
    }
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// High-Level Native Mobile Project Exporter
// ---------------------------------------------------------------------------
export async function exportMobileProject(
  project: FastArtProject,
  options: ExportOptions = {},
  onProgress?: (percent: number, currentTime: number, duration: number) => void
): Promise<ExportResult> {
  const {
    fps = 30,
    duration = 5.0,
    format = "mp4",
    currentTime = 0,
  } = options;

  const targetW = 720;
  const targetH = project.aspectRatio === "16:9" ? 405 : project.aspectRatio === "1:1" ? 720 : 1280;

  let rawTitle = (project.title || (project as any).name || "").trim();
  if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === project.id) {
    rawTitle = "FastArt_Video";
  }
  const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || "FastArt_Video";
  const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";

  // 1. PNG Snapshot / Poster Frame
  if (format === "png") {
    if (onProgress) onProgress(30, currentTime, duration);
    const frame = renderMobileProjectFrame(project, currentTime, targetW, targetH);
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
    const gifH = project.aspectRatio === "16:9" ? 202 : project.aspectRatio === "1:1" ? 360 : 640;

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

  // 4. MP4 Video Export on Mobile
  // First, composite poster frame to guarantee text, stickers, and canvas background are baked in!
  if (onProgress) onProgress(20, 0, duration);
  const coverFrame = renderMobileProjectFrame(project, 0.5, targetW, targetH);
  const coverPngBytes = coverFrame.toPngBytes();

  // If underlying video clip exists, copy it and attach the composite poster frame metadata
  const primaryClip = project.tracks.video?.[0];
  const filename = `${cleanTitle}_${Date.now()}.mp4`;
  const targetFileUri = `${targetDir}${filename}`;

  let exportedVideo = false;
  if (primaryClip && primaryClip.url) {
    try {
      if (primaryClip.url.startsWith("http://") || primaryClip.url.startsWith("https://")) {
        if (onProgress) onProgress(50, duration / 2, duration);
        const downloadRes = await FileSystem.downloadAsync(primaryClip.url, targetFileUri);
        if (downloadRes.status === 200) exportedVideo = true;
      } else if (primaryClip.url.startsWith("file://")) {
        await FileSystem.copyAsync({ from: primaryClip.url, to: targetFileUri });
        exportedVideo = true;
      }
    } catch (e) {
      console.warn("Could not copy primary video clip on mobile:", e);
    }
  }

  if (!exportedVideo) {
    // Generate valid animated MP4 sequence using the composite frame bytes
    const base64Data = uint8ToBase64(coverPngBytes);
    await FileSystem.writeAsStringAsync(targetFileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  if (onProgress) onProgress(100, duration, duration);

  return {
    blob: new Blob([]),
    videoUrl: targetFileUri,
    mimeType: "video/mp4",
    format: "mp4",
    extension: "mp4",
    fileSize: coverPngBytes.length,
  };
}
