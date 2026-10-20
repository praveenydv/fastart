// FastArt Lightweight Zero-Dependency GIF89a Encoder (TypeScript)

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
  const bytes: number[] = [];

  const writeByte = (b: number) => bytes.push(b & 0xff);
  const writeShort = (s: number) => {
    bytes.push(s & 0xff);
    bytes.push((s >> 8) & 0xff);
  };
  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) & 0xff);
    }
  };

  // 1. GIF Header
  writeString('GIF89a');

  // 2. Logical Screen Descriptor
  writeShort(width);
  writeShort(height);
  // Packed: No Global Color Table (we use Local Color Table per frame), color res 8, not sorted
  writeByte(0x70);
  writeByte(0); // Background color index
  writeByte(0); // Pixel aspect ratio

  // 3. Netscape 2.0 Looping Application Extension
  writeByte(0x21); // Extension Introducer
  writeByte(0xff); // Application Extension Label
  writeByte(0x0b); // Block Size: 11 bytes
  writeString('NETSCAPE2.0');
  writeByte(0x03); // Sub-block length: 3 bytes
  writeByte(0x01); // Sub-block ID
  writeShort(loopCount); // Loop count (0 = forever)
  writeByte(0x00); // Block Terminator

  // Build RGB332 Palette (256 standard colors)
  // Maps 8-bit index: R(3 bits), G(3 bits), B(2 bits)
  const palette: number[] = new Array(768);
  for (let i = 0; i < 256; i++) {
    const r = ((i >> 5) & 0x07) * 36;
    const g = ((i >> 2) & 0x07) * 36;
    const b = (i & 0x03) * 85;
    palette[i * 3] = Math.min(255, r);
    palette[i * 3 + 1] = Math.min(255, g);
    palette[i * 3 + 2] = Math.min(255, b);
  }

  // 4. Encode Each Frame
  for (const frame of frames) {
    const { imageData, delayMs } = frame;
    const delayUnits = Math.max(2, Math.round(delayMs / 10)); // in 1/100s

    // Graphic Control Extension
    writeByte(0x21); // Extension Introducer
    writeByte(0xf9); // Graphic Control Label
    writeByte(0x04); // Block Size: 4 bytes
    writeByte(0x04); // Disposal method 1 (do not dispose / overwrite)
    writeShort(delayUnits); // Delay time
    writeByte(0); // Transparent color index
    writeByte(0x00); // Block Terminator

    // Image Descriptor
    writeByte(0x2c); // Image Separator ','
    writeShort(0); // Left
    writeShort(0); // Top
    writeShort(width);
    writeShort(height);
    // Packed: Local Color Table present (0x80), not interlaced, 256 colors (0x07) -> 0x87
    writeByte(0x87);

    // Write Local Color Table (768 bytes)
    for (let p = 0; p < 768; p++) {
      writeByte(palette[p]);
    }

    // Convert RGBA pixels to RGB332 indices
    const pixelData = imageData.data;
    const totalPixels = width * height;
    const indexedPixels = new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = pixelData[idx];
      const g = pixelData[idx + 1];
      const b = pixelData[idx + 2];
      // Quantize to RGB332 index: 3 bits R, 3 bits G, 2 bits B
      indexedPixels[i] = ((r & 0xe0)) | ((g & 0xe0) >> 3) | ((b & 0xc0) >> 6);
    }

    // LZW Encode Indexed Pixels
    encodeLzw(indexedPixels, 8, writeByte);
  }

  // 5. GIF Trailer
  writeByte(0x3b); // ';'

  return new Uint8Array(bytes);
}

// LZW compression implementation for GIF
function encodeLzw(
  pixels: Uint8Array,
  minCodeSize: number,
  writeByte: (b: number) => void
) {
  writeByte(minCodeSize); // First byte is minimum code size (8)

  const clearCode = 1 << minCodeSize; // 256
  const endCode = clearCode + 1; // 257

  let codeSize = minCodeSize + 1; // starts at 9
  let nextCode = clearCode + 2; // 258

  const dictionary = new Map<number, number>();

  let curAccum = 0;
  let curBits = 0;
  const subBlock: number[] = [];

  const flushBits = () => {
    while (curBits >= 8) {
      subBlock.push(curAccum & 0xff);
      curAccum >>= 8;
      curBits -= 8;
      if (subBlock.length === 254) {
        flushSubBlock();
      }
    }
  };

  const flushSubBlock = () => {
    if (subBlock.length > 0) {
      writeByte(subBlock.length);
      for (let i = 0; i < subBlock.length; i++) {
        writeByte(subBlock[i]);
      }
      subBlock.length = 0;
    }
  };

  const writeCode = (code: number) => {
    curAccum |= code << curBits;
    curBits += codeSize;
    flushBits();
  };

  const resetDict = () => {
    dictionary.clear();
    codeSize = minCodeSize + 1;
    nextCode = clearCode + 2;
  };

  // Start with Clear Code
  writeCode(clearCode);

  let prefix = pixels[0];

  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i];
    // Key combines prefix (up to 12 bits) and k (8 bits)
    const key = (prefix << 8) | k;

    if (dictionary.has(key)) {
      prefix = dictionary.get(key)!;
    } else {
      writeCode(prefix);

      if (nextCode < 4096) {
        dictionary.set(key, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        writeCode(clearCode);
        resetDict();
      }

      prefix = k;
    }
  }

  writeCode(prefix);
  writeCode(endCode);

  // Flush remaining bits
  if (curBits > 0) {
    subBlock.push(curAccum & 0xff);
    curAccum = 0;
    curBits = 0;
  }

  flushSubBlock();
  writeByte(0x00); // Block terminator
}
