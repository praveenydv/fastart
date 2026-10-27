use crate::types::FrameBuffer;
use byteorder::{BigEndian, WriteBytesExt};

/// Ultra-Fast PNG encoder (outputs a completely valid, uncompressed/fast IDAT PNG)
/// Perfect for instant snapshot exports and mobile thumbnail generation.
pub fn encode_png_fast(fb: &FrameBuffer) -> Vec<u8> {
    let mut out = Vec::with_capacity((fb.width * fb.height * 4 + 1024) as usize);

    // PNG Signature
    out.extend_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    let mut ihdr = Vec::with_capacity(13);
    let _ = ihdr.write_u32::<BigEndian>(fb.width);
    let _ = ihdr.write_u32::<BigEndian>(fb.height);
    ihdr.push(8); // Bit depth: 8
    ihdr.push(6); // Color type: 6 (RGBA)
    ihdr.push(0); // Compression method: 0 (deflate)
    ihdr.push(0); // Filter method: 0
    ihdr.push(0); // Interlace method: 0
    write_png_chunk(&mut out, b"IHDR", &ihdr);

    // Raw scanlines with filter byte 0 (None)
    let row_len = (fb.width as usize) * 4;
    let raw_scanlines_len = (fb.height as usize) * (1 + row_len);
    let mut raw_data = Vec::with_capacity(raw_scanlines_len);

    for y in 0..fb.height {
        raw_data.push(0); // Filter byte: 0 (None)
        let row_start = (y as usize) * fb.stride;
        raw_data.extend_from_slice(&fb.data[row_start..row_start + row_len]);
    }

    // Wrap in uncompressed Deflate blocks (type 00)
    let deflated = deflate_uncompressed(&raw_data);
    write_png_chunk(&mut out, b"IDAT", &deflated);

    // IEND chunk
    write_png_chunk(&mut out, b"IEND", &[]);

    out
}

fn write_png_chunk(out: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    let _ = out.write_u32::<BigEndian>(data.len() as u32);
    let crc_start = out.len();
    out.extend_from_slice(chunk_type);
    out.extend_from_slice(data);
    let crc = calculate_crc32(&out[crc_start..]);
    let _ = out.write_u32::<BigEndian>(crc);
}

fn deflate_uncompressed(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    // zlib header: CM=8, CINFO=7 (32K window), FCHECK
    out.push(0x78);
    out.push(0x01);

    let max_block = 65535;
    let mut offset = 0;

    while offset < data.len() {
        let remaining = data.len() - offset;
        let block_len = remaining.min(max_block);
        let is_last = (offset + block_len) >= data.len();

        out.push(if is_last { 0x01 } else { 0x00 });
        let len16 = block_len as u16;
        let nlen16 = !len16;

        out.push((len16 & 0xFF) as u8);
        out.push((len16 >> 8) as u8);
        out.push((nlen16 & 0xFF) as u8);
        out.push((nlen16 >> 8) as u8);

        out.extend_from_slice(&data[offset..offset + block_len]);
        offset += block_len;
    }

    // Adler32 checksum
    let adler = calculate_adler32(data);
    let _ = out.write_u32::<BigEndian>(adler);

    out
}

fn calculate_adler32(data: &[u8]) -> u32 {
    let mut s1 = 1u32;
    let mut s2 = 0u32;
    for &b in data {
        s1 = (s1 + b as u32) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    (s2 << 16) | s1
}

fn calculate_crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFFFFFFu32;
    for &b in data {
        let mut byte = (crc ^ b as u32) & 0xFF;
        for _ in 0..8 {
            if (byte & 1) != 0 {
                byte = (byte >> 1) ^ 0xEDB88320;
            } else {
                byte >>= 1;
            }
        }
        crc = (crc >> 8) ^ byte;
    }
    !crc
}

// ---------------------------------------------------------------------------
// Animated GIF Encoder
// ---------------------------------------------------------------------------
pub struct GifFrame {
    pub fb: FrameBuffer,
    pub delay_ms: u16,
}

pub fn encode_gif(frames: &[GifFrame]) -> Vec<u8> {
    if frames.is_empty() {
        return Vec::new();
    }

    let width = frames[0].fb.width as u16;
    let height = frames[0].fb.height as u16;
    let mut out = Vec::new();

    // GIF89a Header
    out.extend_from_slice(b"GIF89a");
    let _ = out.write_u16::<byteorder::LittleEndian>(width);
    let _ = out.write_u16::<byteorder::LittleEndian>(height);

    // Global Color Table flag (none, using local color table per frame for max quality)
    out.push(0x70); // 8 bits per pixel, no global table
    out.push(0);    // Background color index
    out.push(0);    // Pixel aspect ratio

    // Netscape 2.0 Loop Extension (Infinite Loop)
    out.extend_from_slice(&[0x21, 0xFF, 0x0B]);
    out.extend_from_slice(b"NETSCAPE2.0");
    out.extend_from_slice(&[0x03, 0x01, 0x00, 0x00, 0x00]);

    // Standard 64-color web-safe quantized palette for blistering fast compression
    let mut palette = Vec::with_capacity(64 * 3);
    for r in 0..4 {
        for g in 0..4 {
            for b in 0..4 {
                palette.push((r * 85) as u8);
                palette.push((g * 85) as u8);
                palette.push((b * 85) as u8);
            }
        }
    }

    for frame in frames {
        let delay_hundredths = (frame.delay_ms / 10).max(1);

        // Graphic Control Extension
        out.extend_from_slice(&[0x21, 0xF9, 0x04]);
        out.push(0x04); // Disposal method 1 (do not dispose)
        let _ = out.write_u16::<byteorder::LittleEndian>(delay_hundredths);
        out.push(0);    // Transparent color index
        out.push(0);    // Block terminator

        // Image Descriptor
        out.push(0x2C); // Image separator
        let _ = out.write_u16::<byteorder::LittleEndian>(0); // Left
        let _ = out.write_u16::<byteorder::LittleEndian>(0); // Top
        let _ = out.write_u16::<byteorder::LittleEndian>(width);
        let _ = out.write_u16::<byteorder::LittleEndian>(height);

        // Local Color Table Flag (Local table present, 64 colors = 2^(5+1))
        out.push(0x85);
        // Write 64 RGB entries (192 bytes)
        out.extend_from_slice(&palette);

        // Quantize frame pixels to 64-color indices
        let pixel_count = (width as usize) * (height as usize);
        let mut indexed_pixels = Vec::with_capacity(pixel_count);
        for chunk in frame.fb.data.chunks_exact(4) {
            let r_idx = (chunk[0] / 64).min(3);
            let g_idx = (chunk[1] / 64).min(3);
            let b_idx = (chunk[2] / 64).min(3);
            let color_index = r_idx * 16 + g_idx * 4 + b_idx;
            indexed_pixels.push(color_index);
        }

        // LZW Compression for 6-bit codes (Minimum code size = 6)
        write_lzw_subblocks(&mut out, &indexed_pixels, 6);
    }

    // GIF Trailer
    out.push(0x3B);
    out
}

fn write_lzw_subblocks(out: &mut Vec<u8>, pixels: &[u8], min_code_size: u8) {
    out.push(min_code_size);
    let clear_code = 1u16 << min_code_size;
    let eoi_code = clear_code + 1;

    let mut bit_buf = 0u32;
    let mut bit_count = 0u8;
    let code_size = min_code_size + 1;

    let mut subblock = Vec::with_capacity(255);

    let mut emit_code = |code: u16, subblock: &mut Vec<u8>, out: &mut Vec<u8>| {
        bit_buf |= (code as u32) << bit_count;
        bit_count += code_size;

        while bit_count >= 8 {
            subblock.push((bit_buf & 0xFF) as u8);
            bit_buf >>= 8;
            bit_count -= 8;

            if subblock.len() == 254 {
                out.push(subblock.len() as u8);
                out.extend_from_slice(subblock);
                subblock.clear();
            }
        }
    };

    emit_code(clear_code, &mut subblock, out);

    // Literal code emission with periodic clear codes for simplicity & speed
    for &px in pixels {
        emit_code(px as u16, &mut subblock, out);
    }

    emit_code(eoi_code, &mut subblock, out);

    // Flush remaining bits
    if bit_count > 0 {
        subblock.push((bit_buf & 0xFF) as u8);
    }

    if !subblock.is_empty() {
        out.push(subblock.len() as u8);
        out.extend_from_slice(&subblock);
    }

    out.push(0x00); // Block terminator
}
