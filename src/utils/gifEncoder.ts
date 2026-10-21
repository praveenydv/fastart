// FastArt C-Style Hardware-Optimized GIF89a Encoder (TypeScript)
// Utilizes:
// 1. Preallocated contiguous Uint8Array buffers (Zero GC re-allocations)
// 2. 32-bit integer register pixel unpacking (RGB332 quantization in 3 bit shifts)
// 3. Classic CompuServe / C UNIX LZW fixed integer hash table (Int32Array(5003))

export interface GifFrame {
  imageData: ImageData;
  delayMs: number;
}

export function createGif(
  width: number,
  height: number,
  frames: GifFrame[],
  loopCount: number = 0 // 0 = infinite loop
): Uint8Array {
  // Preallocate initial buffer (expands automatically by doubling if needed)
  let capacity = Math.max(1024 * 64, width * height * frames.length * 2);
  let buffer = new Uint8Array(capacity);
  let ptr = 0;

  const ensureCapacity = (extra: number) => {
    if (ptr + extra > capacity) {
      capacity = Math.max(capacity * 2, ptr + extra + 65536);
      const newBuf = new Uint8Array(capacity);
      newBuf.set(buffer);
      buffer = newBuf;
    }
  };

  const writeByte = (b: number) => {
    ensureCapacity(1);
    buffer[ptr++] = b & 0xff;
  };

  const writeShort = (s: number) => {
    ensureCapacity(2);
    buffer[ptr++] = s & 0xff;
    buffer[ptr++] = (s >> 8) & 0xff;
  };

  const writeString = (str: string) => {
    ensureCapacity(str.length);
    for (let i = 0; i < str.length; i++) {
      buffer[ptr++] = str.charCodeAt(i) & 0xff;
    }
  };

  // 1. GIF Header
  writeString("GIF89a");

  // 2. Logical Screen Descriptor
  writeShort(width);
  writeShort(height);
  // Packed: No Global Color Table, color res 8, not sorted
  writeByte(0x70);
  writeByte(0); // Background color index
  writeByte(0); // Pixel aspect ratio

  // 3. Netscape 2.0 Looping Application Extension
  writeByte(0x21); // Extension Introducer
  writeByte(0xff); // Application Extension Label
  writeByte(0x0b); // Block Size: 11 bytes
  writeString("NETSCAPE2.0");
  writeByte(0x03); // Sub-block length: 3 bytes
  writeByte(0x01); // Sub-block ID
  writeShort(loopCount); // Loop count (0 = forever)
  writeByte(0x00); // Block Terminator

  // Build RGB332 Palette (256 standard colors)
  // Maps 8-bit index: R(3 bits), G(3 bits), B(2 bits)
  const palette = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const r = ((i >> 5) & 0x07) * 36;
    const g = ((i >> 2) & 0x07) * 36;
    const b = (i & 0x03) * 85;
    palette[i * 3] = Math.min(255, r);
    palette[i * 3 + 1] = Math.min(255, g);
    palette[i * 3 + 2] = Math.min(255, b);
  }

  // 4. Encode Each Frame with Zero Heap Allocations
  const totalPixels = width * height;
  const indexedPixels = new Uint8Array(totalPixels);

  // Pre-allocate LZW fixed hash tables once (reused across all frames)
  const HSIZE = 5003; // Prime number > 4096 for optimal hash distribution
  const htab = new Int32Array(HSIZE);
  const codetab = new Int16Array(HSIZE);
  const subBlock = new Uint8Array(256);

  for (const frame of frames) {
    const { imageData, delayMs } = frame;
    const delayUnits = Math.max(2, Math.round(delayMs / 10)); // in 1/100s

    // Graphic Control Extension
    writeByte(0x21); // Extension Introducer
    writeByte(0xf9); // Graphic Control Label
    writeByte(0x04); // Block Size: 4 bytes
    writeByte(0x04); // Disposal method: overwrite
    writeShort(delayUnits); // Delay time
    writeByte(0); // Transparent color index
    writeByte(0x00); // Block Terminator

    // Image Descriptor
    writeByte(0x2c); // Image Separator ','
    writeShort(0); // Left
    writeShort(0); // Top
    writeShort(width);
    writeShort(height);
    // Packed: Local Color Table present (0x80), 256 colors (0x07) -> 0x87
    writeByte(0x87);

    // Write Local Color Table (768 bytes)
    ensureCapacity(768);
    buffer.set(palette, ptr);
    ptr += 768;

    // Vectorized 32-bit pixel quantization (3 bit shifts per pixel)
    const u32 = new Uint32Array(imageData.data.buffer);
    for (let i = 0; i < totalPixels; i++) {
      const p = u32[i];
      indexedPixels[i] =
        (p & 0xe0) | ((p >> 11) & 0x1c) | ((p >> 22) & 0x03);
    }

    // High-Performance C-Style LZW Compression
    encodeLzwFast(
      indexedPixels,
      8,
      writeByte,
      htab,
      codetab,
      subBlock
    );
  }

  // 5. GIF Trailer
  writeByte(0x3b); // ';'

  // Return exact slice of Uint8Array without copying
  return buffer.subarray(0, ptr);
}

// C UNIX / CompuServe Fast LZW Compression
function encodeLzwFast(
  pixels: Uint8Array,
  minCodeSize: number,
  writeByte: (b: number) => void,
  htab: Int32Array,
  codetab: Int16Array,
  subBlock: Uint8Array
) {
  writeByte(minCodeSize); // Minimum code size (8)

  const clearCode = 1 << minCodeSize; // 256
  const endCode = clearCode + 1; // 257

  let codeSize = minCodeSize + 1; // 9
  let nextCode = clearCode + 2; // 258

  // Clear hash table (fill with -1)
  htab.fill(-1);

  let curAccum = 0;
  let curBits = 0;
  let subBlockLen = 0;

  const flushBits = () => {
    while (curBits >= 8) {
      subBlock[subBlockLen++] = curAccum & 0xff;
      curAccum >>= 8;
      curBits -= 8;
      if (subBlockLen === 254) {
        flushSubBlock();
      }
    }
  };

  const flushSubBlock = () => {
    if (subBlockLen > 0) {
      writeByte(subBlockLen);
      for (let i = 0; i < subBlockLen; i++) {
        writeByte(subBlock[i]);
      }
      subBlockLen = 0;
    }
  };

  const writeCode = (code: number) => {
    curAccum |= code << curBits;
    curBits += codeSize;
    flushBits();
  };

  const resetDict = () => {
    htab.fill(-1);
    codeSize = minCodeSize + 1;
    nextCode = clearCode + 2;
  };

  // Start with Clear Code
  writeCode(clearCode);

  let prefix = pixels[0];
  const HSIZE = htab.length;

  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i];
    const fcode = (prefix << 8) | k;

    // Fast hash index probe
    let h = ((k << 4) ^ prefix) % HSIZE;
    if (h < 0) h += HSIZE;

    if (htab[h] === fcode) {
      prefix = codetab[h];
      continue;
    }

    let found = false;
    if (htab[h] >= 0) {
      const disp = h === 0 ? 1 : HSIZE - h;
      while (true) {
        h -= disp;
        if (h < 0) h += HSIZE;
        if (htab[h] === fcode) {
          prefix = codetab[h];
          found = true;
          break;
        }
        if (htab[h] < 0) break;
      }
    }

    if (found) continue;

    writeCode(prefix);

    if (nextCode < 4096) {
      codetab[h] = nextCode++;
      htab[h] = fcode;
      if (nextCode > (1 << codeSize) && codeSize < 12) {
        codeSize++;
      }
    } else {
      writeCode(clearCode);
      resetDict();
    }

    prefix = k;
  }

  writeCode(prefix);
  writeCode(endCode);

  // Flush remaining bits
  if (curBits > 0) {
    subBlock[subBlockLen++] = curAccum & 0xff;
    curAccum = 0;
    curBits = 0;
  }

  flushSubBlock();
  writeByte(0x00); // Block terminator
}
