// FastArt Lightweight High-Performance GIF89a Encoder
// Generates standard, cross-platform animated GIFs directly from Canvas RGBA pixel buffers.
// Zero native or third-party dependencies — works identically across Web, Mobile WebView, and Node.

export interface GifFrameOptions {
  delayMs?: number; // Delay in milliseconds (default 66ms = ~15fps)
  transparent?: boolean;
}

export class FastArtGifEncoder {
  private width: number;
  private height: number;
  private out: number[] = [];

  constructor(width: number, height: number) {
    this.width = Math.max(16, Math.min(1080, Math.round(width)));
    this.height = Math.max(16, Math.min(1080, Math.round(height)));
    this.writeHeader();
  }

  private writeHeader() {
    // 1. Signature & Version "GIF89a"
    this.writeString("GIF89a");

    // 2. Logical Screen Descriptor
    this.writeUInt16(this.width);
    this.writeUInt16(this.height);
    // Packed field: GCT flag = 0 (we use Local Color Tables per frame for highest color fidelity)
    this.out.push(0x70); // 8 bits per pixel resolution, no global color table
    this.out.push(0x00); // Background color index
    this.out.push(0x00); // Pixel aspect ratio

    // 3. Netscape 2.0 Application Extension (Infinite Animation Loop)
    this.out.push(0x21); // Extension Introducer
    this.out.push(0xff); // Application Extension Label
    this.out.push(0x0b); // Block Size (11 bytes)
    this.writeString("NETSCAPE2.0");
    this.out.push(0x03); // Sub-block length
    this.out.push(0x01); // Sub-block ID
    this.writeUInt16(0); // Loop count (0 = infinite loop)
    this.out.push(0x00); // Block Terminator
  }

  /**
   * Adds an RGBA frame buffer to the animated GIF sequence
   */
  public addFrame(rgba: Uint8ClampedArray | Uint8Array, options: GifFrameOptions = {}) {
    const delay = Math.max(2, Math.round((options.delayMs || 66) / 10)); // in 1/100ths of a sec
    const { palette, indexedPixels } = this.quantizeRgba(rgba);

    // Graphic Control Extension
    this.out.push(0x21); // Extension Introducer
    this.out.push(0xf9); // Graphic Control Label
    this.out.push(0x04); // Block Size
    this.out.push(0x04); // Packed field: disposal method = 1 (do not dispose, overwrite)
    this.writeUInt16(delay); // Delay time in 1/100s
    this.out.push(0x00); // Transparent color index (unused)
    this.out.push(0x00); // Block Terminator

    // Image Descriptor
    this.out.push(0x2c); // Image Separator ','
    this.writeUInt16(0); // Left position
    this.writeUInt16(0); // Top position
    this.writeUInt16(this.width);
    this.writeUInt16(this.height);
    // Packed field: Local Color Table Flag (1), Interlace (0), Sort (0), Size of LCT (7 => 256 colors)
    this.out.push(0x87);

    // Local Color Table (256 RGB entries = 768 bytes)
    for (let i = 0; i < 256; i++) {
      if (i < palette.length) {
        this.out.push(palette[i][0], palette[i][1], palette[i][2]);
      } else {
        this.out.push(0, 0, 0);
      }
    }

    // LZW Image Data
    this.encodeLzw(indexedPixels, 8);
  }

  /**
   * Finishes encoding and returns the complete binary GIF byte array
   */
  public finish(): Uint8Array {
    this.out.push(0x3b); // GIF Trailer ';'
    const result = new Uint8Array(this.out);
    this.out = [];
    return result;
  }

  /**
   * Converts the finished GIF to a Data URL
   */
  public toDataUri(): string {
    const bytes = this.finish();
    let binary = "";
    const len = bytes.length;
    const chunkSize = 16384;
    for (let i = 0; i < len; i += chunkSize) {
      const sub = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, sub as any);
    }
    return `data:image/gif;base64,${btoa(binary)}`;
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers & LZW Compression
  // ---------------------------------------------------------------------------
  private writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      this.out.push(str.charCodeAt(i));
    }
  }

  private writeUInt16(val: number) {
    this.out.push(val & 0xff);
    this.out.push((val >> 8) & 0xff);
  }

  /**
   * High-speed uniform color quantization to 256-color palette
   */
  private quantizeRgba(rgba: Uint8ClampedArray | Uint8Array): {
    palette: [number, number, number][];
    indexedPixels: Uint8Array;
  } {
    const numPixels = this.width * this.height;
    const indexedPixels = new Uint8Array(numPixels);
    const colorMap = new Map<number, number>();
    const palette: [number, number, number][] = [];

    // Pre-seed palette with standard black and white
    palette.push([0, 0, 0]);
    palette.push([255, 255, 255]);
    colorMap.set(0, 0);
    colorMap.set((255 << 16) | (255 << 8) | 255, 1);

    for (let i = 0; i < numPixels; i++) {
      const offset = i * 4;
      // Quantize to 5-bit color channels (32 levels per channel = 32768 total)
      const r = rgba[offset] & 0xf8;
      const g = rgba[offset + 1] & 0xf8;
      const b = rgba[offset + 2] & 0xf8;
      const key = (r << 16) | (g << 8) | b;

      let idx = colorMap.get(key);
      if (idx === undefined) {
        if (palette.length < 256) {
          idx = palette.length;
          palette.push([rgba[offset], rgba[offset + 1], rgba[offset + 2]]);
          colorMap.set(key, idx);
        } else {
          // Nearest palette index lookup using fast Manhattan distance
          let minDist = 999999;
          let bestIdx = 0;
          for (let p = 0; p < palette.length; p++) {
            const pr = palette[p][0];
            const pg = palette[p][1];
            const pb = palette[p][2];
            const dist =
              Math.abs(r - pr) * 3 + Math.abs(g - pg) * 4 + Math.abs(b - pb) * 2;
            if (dist < minDist) {
              minDist = dist;
              bestIdx = p;
              if (dist < 8) break;
            }
          }
          idx = bestIdx;
          colorMap.set(key, idx);
        }
      }
      indexedPixels[i] = idx;
    }

    return { palette, indexedPixels };
  }

  /**
   * Standard GIF Variable-Length Code LZW Compressor
   */
  private encodeLzw(pixels: Uint8Array, minCodeSize: number) {
    const initCodeSize = Math.max(2, minCodeSize);
    this.out.push(initCodeSize);

    const clearCode = 1 << initCodeSize;
    const eoiCode = clearCode + 1;
    let nextCode = eoiCode + 1;
    let codeSize = initCodeSize + 1;
    let maxCode = (1 << codeSize) - 1;

    // Dictionary using numeric keys (prefix << 8 | character)
    const dict = new Map<number, number>();

    const packetBuffer: number[] = [];
    let curAccum = 0;
    let curBits = 0;

    const emitBits = (code: number, numBits: number) => {
      curAccum |= code << curBits;
      curBits += numBits;
      while (curBits >= 8) {
        packetBuffer.push(curAccum & 0xff);
        curAccum >>= 8;
        curBits -= 8;
        if (packetBuffer.length === 254) {
          this.out.push(254);
          for (let b = 0; b < 254; b++) this.out.push(packetBuffer[b]);
          packetBuffer.length = 0;
        }
      }
    };

    const flushPacket = () => {
      if (curBits > 0) {
        packetBuffer.push(curAccum & 0xff);
        curAccum = 0;
        curBits = 0;
      }
      if (packetBuffer.length > 0) {
        this.out.push(packetBuffer.length);
        for (let b = 0; b < packetBuffer.length; b++) this.out.push(packetBuffer[b]);
        packetBuffer.length = 0;
      }
    };

    // Output Clear Code
    emitBits(clearCode, codeSize);

    if (pixels.length === 0) {
      emitBits(eoiCode, codeSize);
      flushPacket();
      this.out.push(0x00);
      return;
    }

    let prefix = pixels[0];

    for (let i = 1; i < pixels.length; i++) {
      const c = pixels[i];
      const key = (prefix << 8) | c;
      const match = dict.get(key);

      if (match !== undefined) {
        prefix = match;
      } else {
        emitBits(prefix, codeSize);

        if (nextCode <= 4095) {
          dict.set(key, nextCode++);
          if (nextCode > maxCode && codeSize < 12) {
            codeSize++;
            maxCode = (1 << codeSize) - 1;
          }
        } else {
          // Dictionary full: reset
          emitBits(clearCode, codeSize);
          dict.clear();
          codeSize = initCodeSize + 1;
          maxCode = (1 << codeSize) - 1;
          nextCode = eoiCode + 1;
        }
        prefix = c;
      }
    }

    emitBits(prefix, codeSize);
    emitBits(eoiCode, codeSize);
    flushPacket();
    this.out.push(0x00); // Block Terminator
  }
}

