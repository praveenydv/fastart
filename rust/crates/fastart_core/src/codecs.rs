use crate::types::FrameBuffer;
use byteorder::{BigEndian, WriteBytesExt};
use std::io::{Seek, SeekFrom, Write};

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

/// Zero-Memory Streaming Animated GIF Writer
pub struct GifStreamWriter<W: Write> {
    pub writer: W,
    pub width: u16,
    pub height: u16,
    palette: Vec<u8>,
}

impl<W: Write> GifStreamWriter<W> {
    pub fn new(mut writer: W, width: u16, height: u16) -> std::io::Result<Self> {
        writer.write_all(b"GIF89a")?;
        writer.write_all(&width.to_le_bytes())?;
        writer.write_all(&height.to_le_bytes())?;

        // Global Color Table flag (none, using local 256-color table per frame)
        writer.write_all(&[0x70, 0, 0])?;

        // Netscape 2.0 Loop Extension (Infinite Loop)
        writer.write_all(&[0x21, 0xFF, 0x0B])?;
        writer.write_all(b"NETSCAPE2.0")?;
        writer.write_all(&[0x03, 0x01, 0x00, 0x00, 0x00])?;

        // High-fidelity 256-color palette (6x6x6 color cube = 216 colors + 40 grayscale levels)
        let mut palette = Vec::with_capacity(256 * 3);
        for r in 0..6 {
            for g in 0..6 {
                for b in 0..6 {
                    palette.push(((r * 255) / 5) as u8);
                    palette.push(((g * 255) / 5) as u8);
                    palette.push(((b * 255) / 5) as u8);
                }
            }
        }
        for i in 0..40 {
            let v = ((i * 255) / 39) as u8;
            palette.push(v);
            palette.push(v);
            palette.push(v);
        }

        Ok(Self {
            writer,
            width,
            height,
            palette,
        })
    }

    pub fn append_frame(&mut self, fb: &FrameBuffer, delay_ms: u16) -> std::io::Result<()> {
        let delay_hundredths = (delay_ms / 10).max(1);

        // Graphic Control Extension
        self.writer.write_all(&[0x21, 0xF9, 0x04, 0x04])?;
        self.writer.write_all(&delay_hundredths.to_le_bytes())?;
        self.writer.write_all(&[0, 0])?;

        // Image Descriptor
        self.writer.write_all(&[0x2C, 0, 0, 0, 0])?;
        self.writer.write_all(&self.width.to_le_bytes())?;
        self.writer.write_all(&self.height.to_le_bytes())?;

        // Local Color Table Flag (Local table present, 256 colors = 2^(7+1))
        self.writer.write_all(&[0x87])?;
        self.writer.write_all(&self.palette)?;

        // Quantize frame pixels to 256-color indices
        let pixel_count = (self.width as usize) * (self.height as usize);
        let mut indexed_pixels = Vec::with_capacity(pixel_count);
        for chunk in fb.data.chunks_exact(4) {
            let r = chunk[0];
            let g = chunk[1];
            let b = chunk[2];

            let diff_rg = (r as i32 - g as i32).abs();
            let diff_gb = (g as i32 - b as i32).abs();
            let color_index = if diff_rg <= 8 && diff_gb <= 8 {
                let gray = ((r as u32 + g as u32 + b as u32) / 3) as u8;
                let gray_idx = ((gray as u32 * 39 + 127) / 255).min(39) as u8;
                216 + gray_idx
            } else {
                let r_idx = ((r as u32 * 5 + 25) / 255).min(5) as u8;
                let g_idx = ((g as u32 * 5 + 25) / 255).min(5) as u8;
                let b_idx = ((b as u32 * 5 + 25) / 255).min(5) as u8;
                r_idx * 36 + g_idx * 6 + b_idx
            };
            indexed_pixels.push(color_index);
        }

        write_lzw_subblocks_to_writer(&mut self.writer, &indexed_pixels, 8)?;
        Ok(())
    }

    pub fn finish(mut self) -> std::io::Result<W> {
        self.writer.write_all(&[0x3B])?;
        self.writer.flush()?;
        Ok(self.writer)
    }
}

pub fn encode_gif(frames: &[GifFrame]) -> Vec<u8> {
    if frames.is_empty() {
        return Vec::new();
    }

    let width = frames[0].fb.width as u16;
    let height = frames[0].fb.height as u16;
    let mut writer = match GifStreamWriter::new(Vec::new(), width, height) {
        Ok(w) => w,
        Err(_) => return Vec::new(),
    };

    for frame in frames {
        let _ = writer.append_frame(&frame.fb, frame.delay_ms);
    }

    match writer.finish() {
        Ok(vec) => vec,
        Err(_) => Vec::new(),
    }
}

pub fn write_lzw_subblocks_to_writer<W: Write>(out: &mut W, pixels: &[u8], min_code_size: u8) -> std::io::Result<()> {
    out.write_all(&[min_code_size])?;
    let clear_code = 1u16 << min_code_size;
    let eoi_code = clear_code + 1;

    let mut bit_buf = 0u32;
    let mut bit_count = 0u8;
    let mut code_size = min_code_size + 1;
    let mut next_code = clear_code + 2;

    let mut subblock = Vec::with_capacity(255);

    let mut emit_code = |code: u16, cur_code_size: u8, subblock: &mut Vec<u8>, out: &mut W| -> std::io::Result<()> {
        bit_buf |= (code as u32) << bit_count;
        bit_count += cur_code_size;

        while bit_count >= 8 {
            subblock.push((bit_buf & 0xFF) as u8);
            bit_buf >>= 8;
            bit_count -= 8;

            if subblock.len() == 254 {
                out.write_all(&[subblock.len() as u8])?;
                out.write_all(subblock)?;
                subblock.clear();
            }
        }
        Ok(())
    };

    // Emit initial Clear code
    emit_code(clear_code, code_size, &mut subblock, out)?;

    let mut is_first = true;
    for &px in pixels {
        emit_code(px as u16, code_size, &mut subblock, out)?;

        if is_first {
            is_first = false;
        } else {
            next_code += 1;
            if next_code == (1 << code_size) {
                if code_size < 12 {
                    code_size += 1;
                } else {
                    emit_code(clear_code, code_size, &mut subblock, out)?;
                    code_size = min_code_size + 1;
                    next_code = clear_code + 2;
                    is_first = true;
                }
            }
        }
    }

    emit_code(eoi_code, code_size, &mut subblock, out)?;

    // Flush remaining bits
    if bit_count > 0 {
        subblock.push((bit_buf & 0xFF) as u8);
    }

    if !subblock.is_empty() {
        out.write_all(&[subblock.len() as u8])?;
        out.write_all(&subblock)?;
    }

    out.write_all(&[0x00])?; // Block terminator
    Ok(())
}

// ---------------------------------------------------------------------------
// H.264 Video Encoder & MP4 Container Muxer
// ---------------------------------------------------------------------------

pub struct BitWriter {
    data: Vec<u8>,
    current_byte: u8,
    bits_in_byte: u8,
}

impl BitWriter {
    pub fn new(capacity: usize) -> Self {
        Self {
            data: Vec::with_capacity(capacity),
            current_byte: 0,
            bits_in_byte: 0,
        }
    }

    #[inline]
    pub fn reset(&mut self) {
        self.data.clear();
        self.current_byte = 0;
        self.bits_in_byte = 0;
    }

    #[inline]
    pub fn write_bit(&mut self, bit: u8) {
        self.current_byte = (self.current_byte << 1) | (bit & 1);
        self.bits_in_byte += 1;
        if self.bits_in_byte == 8 {
            self.data.push(self.current_byte);
            self.current_byte = 0;
            self.bits_in_byte = 0;
        }
    }

    pub fn write_bits(&mut self, val: u32, count: u8) {
        if count == 0 {
            return;
        }
        for i in (0..count).rev() {
            let bit = ((val >> i) & 1) as u8;
            self.write_bit(bit);
        }
    }

    pub fn write_ue(&mut self, val: u32) {
        let val_plus_1 = (val as u64) + 1;
        let len = 64 - val_plus_1.leading_zeros(); // number of bits
        // Write (len - 1) zeros
        for _ in 0..(len - 1) {
            self.write_bit(0);
        }
        // Write val_plus_1
        for i in (0..len).rev() {
            let bit = ((val_plus_1 >> i) & 1) as u8;
            self.write_bit(bit);
        }
    }

    pub fn write_se(&mut self, val: i32) {
        let mapped = if val <= 0 {
            ((-val as i64) * 2) as u32
        } else {
            ((val as i64) * 2 - 1) as u32
        };
        self.write_ue(mapped);
    }

    pub fn align_zero(&mut self) {
        if self.bits_in_byte > 0 {
            let pad = 8 - self.bits_in_byte;
            self.current_byte <<= pad;
            self.data.push(self.current_byte);
            self.current_byte = 0;
            self.bits_in_byte = 0;
        }
    }

    pub fn write_rbsp_trailing_bits(&mut self) {
        self.write_bit(1);
        self.align_zero();
    }

    pub fn into_bytes(mut self) -> Vec<u8> {
        self.align_zero();
        self.data
    }
}

pub fn rbsp_to_nal(rbsp: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(rbsp.len() + 128);
    let mut zero_count = 0;
    for &b in rbsp {
        if zero_count == 2 && b <= 3 {
            out.push(3);
            zero_count = 0;
        }
        out.push(b);
        if b == 0 {
            zero_count += 1;
        } else {
            zero_count = 0;
        }
    }
    out
}

pub fn build_h264_sps(mb_width: u32, mb_height: u32, fps: u32) -> Vec<u8> {
    let mut bw = BitWriter::new(256);
    bw.write_bits(66, 8); // Profile: Baseline (66)
    bw.write_bits(0xE0, 8); // Constraints
    let level = if mb_width * mb_height > 3600 { 41 } else { 31 }; // Level 4.1 for 1080p, 3.1 for 720p
    bw.write_bits(level, 8);
    bw.write_ue(0); // seq_parameter_set_id
    bw.write_ue(0); // log2_max_frame_num_minus4
    bw.write_ue(2); // pic_order_cnt_type: 2
    bw.write_ue(1); // max_num_ref_frames
    bw.write_bit(0); // gaps_in_frame_num_value_allowed_flag
    bw.write_ue(mb_width - 1);
    bw.write_ue(mb_height - 1);
    bw.write_bit(1); // frame_mbs_only_flag
    bw.write_bit(1); // direct_8x8_inference_flag
    bw.write_bit(0); // frame_cropping_flag
    bw.write_bit(1); // vui_parameters_present_flag
    bw.write_bit(0);
    bw.write_bit(0);
    bw.write_bit(0);
    bw.write_bit(0);
    bw.write_bit(1); // timing_info_present_flag
    bw.write_bits(1, 32); // num_units_in_tick
    bw.write_bits(fps.max(1) * 2, 32); // time_scale
    bw.write_bit(1); // fixed_frame_rate_flag
    bw.write_bit(0);
    bw.write_bit(0);
    bw.write_bit(0);
    bw.write_bit(1); // bitstream_restriction_flag
    bw.write_bit(1);
    bw.write_ue(0);
    bw.write_ue(0);
    bw.write_ue(0);
    bw.write_ue(0);
    bw.write_ue(0);
    bw.write_ue(1);
    bw.write_rbsp_trailing_bits();

    let body = rbsp_to_nal(&bw.into_bytes());
    let mut nal = Vec::with_capacity(1 + body.len());
    nal.push(0x67); // SPS (type 7, nal_ref_idc 3)
    nal.extend_from_slice(&body);
    nal
}

pub fn build_h264_pps() -> Vec<u8> {
    let mut bw = BitWriter::new(256);
    bw.write_ue(0); // pic_parameter_set_id
    bw.write_ue(0); // seq_parameter_set_id
    bw.write_bit(0); // entropy_coding_mode_flag (CAVLC)
    bw.write_bit(0); // bottom_field_pic_order_in_frame_present_flag
    bw.write_ue(0); // num_slice_groups_minus1
    bw.write_ue(0); // num_ref_idx_l0_default_active_minus1
    bw.write_ue(0); // num_ref_idx_l1_default_active_minus1
    bw.write_bit(0); // weighted_pred_flag
    bw.write_bits(0, 2); // weighted_bipred_idc
    bw.write_se(0); // pic_init_qp_minus26
    bw.write_se(0); // pic_init_qs_minus26
    bw.write_se(0); // chroma_qp_index_offset
    bw.write_bit(0); // deblocking_filter_control_present_flag
    bw.write_bit(0); // constrained_intra_pred_flag
    bw.write_bit(0); // redundant_pic_cnt_present_flag
    bw.write_rbsp_trailing_bits();

    let body = rbsp_to_nal(&bw.into_bytes());
    let mut nal = Vec::with_capacity(1 + body.len());
    nal.push(0x68); // PPS (type 8, nal_ref_idc 3)
    nal.extend_from_slice(&body);
    nal
}

pub fn encode_h264_iframe(fb: &FrameBuffer, frame_index: usize, mb_w: u32, mb_h: u32) -> Vec<u8> {
    let mut bw = BitWriter::new(128);
    let mut body = Vec::with_capacity((mb_w * mb_h) as usize * 386 + 128);
    let mut nal_out = Vec::with_capacity((mb_w * mb_h) as usize * 386 + 128);
    encode_h264_iframe_into(fb, frame_index, mb_w, mb_h, &mut bw, &mut body, &mut nal_out);
    nal_out
}

pub fn encode_h264_iframe_into(
    fb: &FrameBuffer,
    frame_index: usize,
    mb_w: u32,
    mb_h: u32,
    bw: &mut BitWriter,
    body: &mut Vec<u8>,
    nal_out: &mut Vec<u8>,
) {
    bw.reset();
    bw.write_ue(0); // first_mb_in_slice
    bw.write_ue(7); // slice_type (All I-slice)
    bw.write_ue(0); // pic_parameter_set_id
    bw.write_bits(0, 4); // frame_num (0 for IDR)
    bw.write_ue((frame_index & 1) as u32); // idr_pic_id
    bw.write_bit(0); // no_output_of_prior_pics_flag
    bw.write_bit(0); // long_term_reference_flag
    bw.write_se(0); // slice_qp_delta

    // Macroblock 0 mb_type: 25 (I_PCM)
    bw.write_ue(25);
    bw.align_zero();

    body.clear();
    body.extend_from_slice(&bw.data);

    let width = fb.width as usize;
    let height = fb.height as usize;

    for mby in 0..mb_h as usize {
        for mbx in 0..mb_w as usize {
            if mbx > 0 || mby > 0 {
                body.push(0x0D);
                body.push(0x00);
            }

            let start_x = mbx * 16;
            let start_y = mby * 16;

            // 1. 256 Y samples (16x16)
            for py in 0..16 {
                let cy = (start_y + py).min(height - 1);
                let row_offset = cy * fb.stride;
                for px in 0..16 {
                    let cx = (start_x + px).min(width - 1);
                    let idx = row_offset + cx * 4;
                    let r = fb.data[idx] as i32;
                    let g = fb.data[idx + 1] as i32;
                    let b = fb.data[idx + 2] as i32;
                    let y_val = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
                    body.push(y_val.clamp(16, 235) as u8);
                }
            }

            // 2. 64 Cb (U) samples (8x8)
            for py in 0..8 {
                let cy = (start_y + py * 2).min(height - 1);
                let row_offset = cy * fb.stride;
                for px in 0..8 {
                    let cx = (start_x + px * 2).min(width - 1);
                    let idx = row_offset + cx * 4;
                    let r = fb.data[idx] as i32;
                    let g = fb.data[idx + 1] as i32;
                    let b = fb.data[idx + 2] as i32;
                    let u_val = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                    body.push(u_val.clamp(16, 240) as u8);
                }
            }

            // 3. 64 Cr (V) samples (8x8)
            for py in 0..8 {
                let cy = (start_y + py * 2).min(height - 1);
                let row_offset = cy * fb.stride;
                for px in 0..8 {
                    let cx = (start_x + px * 2).min(width - 1);
                    let idx = row_offset + cx * 4;
                    let r = fb.data[idx] as i32;
                    let g = fb.data[idx + 1] as i32;
                    let b = fb.data[idx + 2] as i32;
                    let v_val = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                    body.push(v_val.clamp(16, 240) as u8);
                }
            }
        }
    }

    body.push(0x80);

    nal_out.clear();
    nal_out.push(0x65); // IDR slice (type 5, nal_ref_idc 3)
    let mut zero_count = 0;
    for &b in body.iter() {
        if zero_count == 2 && b <= 3 {
            nal_out.push(3);
            zero_count = 0;
        }
        nal_out.push(b);
        if b == 0 {
            zero_count += 1;
        } else {
            zero_count = 0;
        }
    }
}

#[inline(always)]
pub fn macroblock_has_changed(
    curr: &FrameBuffer,
    prev: &FrameBuffer,
    mbx: usize,
    mby: usize,
    width: usize,
    height: usize,
) -> bool {
    let start_x = mbx * 16;
    let start_y = mby * 16;

    let mut diff_sum: u32 = 0;
    for py in (0..16).step_by(2) {
        let cy = (start_y + py).min(height - 1);
        let offset = cy * curr.stride;
        for px in (0..16).step_by(2) {
            let cx = (start_x + px).min(width - 1);
            let idx = offset + cx * 4;
            let dr = (curr.data[idx] as i32 - prev.data[idx] as i32).abs() as u32;
            let dg = (curr.data[idx + 1] as i32 - prev.data[idx + 1] as i32).abs() as u32;
            let db = (curr.data[idx + 2] as i32 - prev.data[idx + 2] as i32).abs() as u32;
            diff_sum += dr + dg + db;
            if diff_sum > 256 {
                return true;
            }
        }
    }
    false
}

pub fn encode_h264_pframe_into(
    curr_fb: &FrameBuffer,
    prev_fb: &FrameBuffer,
    frame_index: usize,
    mb_w: u32,
    mb_h: u32,
    bw: &mut BitWriter,
    nal_out: &mut Vec<u8>,
) {
    bw.reset();
    bw.write_ue(0); // first_mb_in_slice
    bw.write_ue(0); // slice_type (0 = P-slice)
    bw.write_ue(0); // pic_parameter_set_id
    bw.write_bits((frame_index & 15) as u32, 4); // frame_num (4 bits)
    bw.write_bit(0); // num_ref_idx_active_override_flag = 0
    bw.write_bit(0); // ref_pic_list_modification_flag_l0 = 0
    bw.write_bit(0); // adaptive_ref_pic_marking_mode_flag = 0
    bw.write_se(0); // slice_qp_delta: 0

    let width = curr_fb.width as usize;
    let height = curr_fb.height as usize;
    let mut skip_run = 0u32;

    for mby in 0..mb_h as usize {
        for mbx in 0..mb_w as usize {
            let changed = macroblock_has_changed(curr_fb, prev_fb, mbx, mby, width, height);
            if !changed {
                skip_run += 1;
            } else {
                bw.write_ue(skip_run);
                skip_run = 0;

                // Table 7-13 in H.264 spec: mb_type 30 is I_PCM for P-slices
                bw.write_ue(30);
                bw.align_zero();

                let start_x = mbx * 16;
                let start_y = mby * 16;

                // 1. 256 Y samples (16x16)
                for py in 0..16 {
                    let cy = (start_y + py).min(height - 1);
                    let row_offset = cy * curr_fb.stride;
                    for px in 0..16 {
                        let cx = (start_x + px).min(width - 1);
                        let idx = row_offset + cx * 4;
                        let r = curr_fb.data[idx] as i32;
                        let g = curr_fb.data[idx + 1] as i32;
                        let b = curr_fb.data[idx + 2] as i32;
                        let y_val = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
                        bw.data.push(y_val.clamp(16, 235) as u8);
                    }
                }

                // 2. 64 Cb (U) samples (8x8)
                for py in 0..8 {
                    let cy = (start_y + py * 2).min(height - 1);
                    let row_offset = cy * curr_fb.stride;
                    for px in 0..8 {
                        let cx = (start_x + px * 2).min(width - 1);
                        let idx = row_offset + cx * 4;
                        let r = curr_fb.data[idx] as i32;
                        let g = curr_fb.data[idx + 1] as i32;
                        let b = curr_fb.data[idx + 2] as i32;
                        let u_val = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                        bw.data.push(u_val.clamp(16, 240) as u8);
                    }
                }

                // 3. 64 Cr (V) samples (8x8)
                for py in 0..8 {
                    let cy = (start_y + py * 2).min(height - 1);
                    let row_offset = cy * curr_fb.stride;
                    for px in 0..8 {
                        let cx = (start_x + px * 2).min(width - 1);
                        let idx = row_offset + cx * 4;
                        let r = curr_fb.data[idx] as i32;
                        let g = curr_fb.data[idx + 1] as i32;
                        let b = curr_fb.data[idx + 2] as i32;
                        let v_val = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                        bw.data.push(v_val.clamp(16, 240) as u8);
                    }
                }
            }
        }
    }

    if skip_run > 0 {
        bw.write_ue(skip_run);
    }
    bw.write_rbsp_trailing_bits();

    nal_out.clear();
    nal_out.push(0x41); // Non-IDR P-slice (nal_ref_idc 2, type 1)
    let mut zero_count = 0;
    for &b in bw.data.iter() {
        if zero_count == 2 && b <= 3 {
            nal_out.push(3);
            zero_count = 0;
        }
        nal_out.push(b);
        if b == 0 {
            zero_count += 1;
        } else {
            zero_count = 0;
        }
    }
}

pub fn encode_h264_pframe(
    curr_fb: &FrameBuffer,
    prev_fb: &FrameBuffer,
    frame_index: usize,
    mb_w: u32,
    mb_h: u32,
) -> Vec<u8> {
    let mut bw = BitWriter::new(128);
    let mut nal_out = Vec::with_capacity(mb_w as usize * mb_h as usize * 386 + 128);
    encode_h264_pframe_into(curr_fb, prev_fb, frame_index, mb_w, mb_h, &mut bw, &mut nal_out);
    nal_out
}

/// Zero-Memory Streaming MP4 Writer supporting both in-memory and direct-to-disk sinks
pub struct Mp4StreamWriter<W: Write + Seek> {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub sps: Vec<u8>,
    pub pps: Vec<u8>,
    pub sample_sizes: Vec<u32>,
    pub writer: W,
    pub mdat_header_pos: u64,
}

impl<W: Write + Seek> Mp4StreamWriter<W> {
    pub fn new(mut writer: W, width: u32, height: u32, fps: u32, sps: &[u8], pps: &[u8]) -> std::io::Result<Self> {
        // 1. ftyp box
        let mut ftyp = Vec::with_capacity(32);
        write_mp4_box(&mut ftyp, b"ftyp", |b| {
            b.extend_from_slice(b"isom");
            let _ = b.write_u32::<BigEndian>(512);
            b.extend_from_slice(b"isom");
            b.extend_from_slice(b"iso2");
            b.extend_from_slice(b"avc1");
            b.extend_from_slice(b"mp41");
        });
        writer.write_all(&ftyp)?;

        // 2. Start mdat box
        let mdat_header_pos = writer.stream_position()?;
        writer.write_all(&[0, 0, 0, 0, b'm', b'd', b'a', b't'])?;

        Ok(Self {
            width,
            height,
            fps,
            sps: sps.to_vec(),
            pps: pps.to_vec(),
            sample_sizes: Vec::new(),
            writer,
            mdat_header_pos,
        })
    }

    #[inline]
    pub fn append_frame(&mut self, nal_frame: &[u8]) -> std::io::Result<()> {
        let len = nal_frame.len() as u32;
        self.sample_sizes.push(len + 4);
        self.writer.write_all(&len.to_be_bytes())?;
        self.writer.write_all(nal_frame)?;
        Ok(())
    }

    pub fn finish(mut self) -> std::io::Result<W> {
        let total_samples = self.sample_sizes.len();
        let timescale = self.fps.max(1) * 1000;
        let duration = (total_samples as u64 * 1000) as u32;

        let mdat_end = self.writer.stream_position()?;
        let mdat_len = (mdat_end - self.mdat_header_pos) as u32;

        // Finalize mdat length in-place without copying payload
        self.writer.seek(SeekFrom::Start(self.mdat_header_pos))?;
        self.writer.write_all(&mdat_len.to_be_bytes())?;
        self.writer.seek(SeekFrom::Start(mdat_end))?;

        let chunk_offset = (self.mdat_header_pos + 8) as u32;

        // moov box
        let mut moov = Vec::with_capacity(total_samples * 4 + 1024);
        write_mp4_box(&mut moov, b"moov", |m| {
            // mvhd
            write_mp4_box(m, b"mvhd", |mvhd| {
                mvhd.push(0);
                mvhd.extend_from_slice(&[0, 0, 0]);
                let _ = mvhd.write_u32::<BigEndian>(0);
                let _ = mvhd.write_u32::<BigEndian>(0);
                let _ = mvhd.write_u32::<BigEndian>(timescale);
                let _ = mvhd.write_u32::<BigEndian>(duration);
                let _ = mvhd.write_u32::<BigEndian>(0x00010000);
                let _ = mvhd.write_u16::<BigEndian>(0x0100);
                mvhd.extend_from_slice(&[0; 10]);
                let _ = mvhd.write_u32::<BigEndian>(0x00010000);
                let _ = mvhd.write_u32::<BigEndian>(0);
                let _ = mvhd.write_u32::<BigEndian>(0);
                let _ = mvhd.write_u32::<BigEndian>(0);
                let _ = mvhd.write_u32::<BigEndian>(0x00010000);
                let _ = mvhd.write_u32::<BigEndian>(0);
                let _ = mvhd.write_u32::<BigEndian>(0);
                let _ = mvhd.write_u32::<BigEndian>(0);
                let _ = mvhd.write_u32::<BigEndian>(0x40000000);
                mvhd.extend_from_slice(&[0; 24]);
                let _ = mvhd.write_u32::<BigEndian>(2);
            });

            // trak
            write_mp4_box(m, b"trak", |trak| {
                write_mp4_box(trak, b"tkhd", |tkhd| {
                    tkhd.push(0);
                    tkhd.extend_from_slice(&[0, 0, 3]);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(1);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(duration);
                    tkhd.extend_from_slice(&[0; 8]);
                    let _ = tkhd.write_u16::<BigEndian>(0);
                    let _ = tkhd.write_u16::<BigEndian>(0);
                    let _ = tkhd.write_u16::<BigEndian>(0);
                    let _ = tkhd.write_u16::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(0x00010000);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(0x00010000);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(0);
                    let _ = tkhd.write_u32::<BigEndian>(0x40000000);
                    let _ = tkhd.write_u32::<BigEndian>(self.width << 16);
                    let _ = tkhd.write_u32::<BigEndian>(self.height << 16);
                });

                write_mp4_box(trak, b"mdia", |mdia| {
                    write_mp4_box(mdia, b"mdhd", |mdhd| {
                        mdhd.push(0);
                        mdhd.extend_from_slice(&[0, 0, 0]);
                        let _ = mdhd.write_u32::<BigEndian>(0);
                        let _ = mdhd.write_u32::<BigEndian>(0);
                        let _ = mdhd.write_u32::<BigEndian>(timescale);
                        let _ = mdhd.write_u32::<BigEndian>(duration);
                        let _ = mdhd.write_u16::<BigEndian>(0x55C4);
                        let _ = mdhd.write_u16::<BigEndian>(0);
                    });

                    write_mp4_box(mdia, b"hdlr", |hdlr| {
                        hdlr.push(0);
                        hdlr.extend_from_slice(&[0, 0, 0]);
                        let _ = hdlr.write_u32::<BigEndian>(0);
                        hdlr.extend_from_slice(b"vide");
                        hdlr.extend_from_slice(&[0; 12]);
                        hdlr.extend_from_slice(b"VideoHandler\0");
                    });

                    write_mp4_box(mdia, b"minf", |minf| {
                        write_mp4_box(minf, b"vmhd", |vmhd| {
                            vmhd.push(0);
                            vmhd.extend_from_slice(&[0, 0, 1]);
                            let _ = vmhd.write_u16::<BigEndian>(0);
                            let _ = vmhd.write_u16::<BigEndian>(0);
                            let _ = vmhd.write_u16::<BigEndian>(0);
                            let _ = vmhd.write_u16::<BigEndian>(0);
                        });

                        write_mp4_box(minf, b"dinf", |dinf| {
                            write_mp4_box(dinf, b"dref", |dref| {
                                dref.push(0);
                                dref.extend_from_slice(&[0, 0, 0]);
                                let _ = dref.write_u32::<BigEndian>(1);
                                write_mp4_box(dref, b"url ", |u| {
                                    u.push(0);
                                    u.extend_from_slice(&[0, 0, 1]);
                                });
                            });
                        });

                        write_mp4_box(minf, b"stbl", |stbl| {
                            write_mp4_box(stbl, b"stsd", |stsd| {
                                stsd.push(0);
                                stsd.extend_from_slice(&[0, 0, 0]);
                                let _ = stsd.write_u32::<BigEndian>(1);

                                write_mp4_box(stsd, b"avc1", |avc1| {
                                    avc1.extend_from_slice(&[0; 6]);
                                    let _ = avc1.write_u16::<BigEndian>(1);
                                    let _ = avc1.write_u16::<BigEndian>(0);
                                    let _ = avc1.write_u16::<BigEndian>(0);
                                    avc1.extend_from_slice(&[0; 12]);
                                    let _ = avc1.write_u16::<BigEndian>(self.width as u16);
                                    let _ = avc1.write_u16::<BigEndian>(self.height as u16);
                                    let _ = avc1.write_u32::<BigEndian>(0x00480000);
                                    let _ = avc1.write_u32::<BigEndian>(0x00480000);
                                    let _ = avc1.write_u32::<BigEndian>(0);
                                    let _ = avc1.write_u16::<BigEndian>(1);
                                    avc1.extend_from_slice(&[0; 32]);
                                    let _ = avc1.write_u16::<BigEndian>(0x0018);
                                    let _ = avc1.write_i16::<BigEndian>(-1);

                                    write_mp4_box(avc1, b"avcC", |avcc| {
                                        avcc.push(1);
                                        avcc.push(self.sps[1]);
                                        avcc.push(self.sps[2]);
                                        avcc.push(self.sps[3]);
                                        avcc.push(0xFF);
                                        avcc.push(0xE1);
                                        let _ = avcc.write_u16::<BigEndian>(self.sps.len() as u16);
                                        avcc.extend_from_slice(&self.sps);
                                        avcc.push(1);
                                        let _ = avcc.write_u16::<BigEndian>(self.pps.len() as u16);
                                        avcc.extend_from_slice(&self.pps);
                                    });
                                });
                            });

                            write_mp4_box(stbl, b"stts", |stts| {
                                stts.push(0);
                                stts.extend_from_slice(&[0, 0, 0]);
                                let _ = stts.write_u32::<BigEndian>(1);
                                let _ = stts.write_u32::<BigEndian>(total_samples as u32);
                                let _ = stts.write_u32::<BigEndian>(1000);
                            });

                            write_mp4_box(stbl, b"stsc", |stsc| {
                                stsc.push(0);
                                stsc.extend_from_slice(&[0, 0, 0]);
                                let _ = stsc.write_u32::<BigEndian>(1);
                                let _ = stsc.write_u32::<BigEndian>(1);
                                let _ = stsc.write_u32::<BigEndian>(total_samples as u32);
                                let _ = stsc.write_u32::<BigEndian>(1);
                            });

                            write_mp4_box(stbl, b"stsz", |stsz| {
                                stsz.push(0);
                                stsz.extend_from_slice(&[0, 0, 0]);
                                let _ = stsz.write_u32::<BigEndian>(0);
                                let _ = stsz.write_u32::<BigEndian>(total_samples as u32);
                                for &sz in &self.sample_sizes {
                                    let _ = stsz.write_u32::<BigEndian>(sz);
                                }
                            });

                            write_mp4_box(stbl, b"stco", |stco| {
                                stco.push(0);
                                stco.extend_from_slice(&[0, 0, 0]);
                                let _ = stco.write_u32::<BigEndian>(1);
                                let _ = stco.write_u32::<BigEndian>(chunk_offset);
                            });
                        });
                    });
                });
            });
        });

        self.writer.write_all(&moov)?;
        self.writer.flush()?;
        Ok(self.writer)
    }
}

pub fn create_mp4_container(
    width: u32,
    height: u32,
    fps: u32,
    sps: &[u8],
    pps: &[u8],
    nal_frames: &[Vec<u8>],
) -> Vec<u8> {
    let cursor = std::io::Cursor::new(Vec::with_capacity(nal_frames.len() * 512 + 65536));
    let mut writer = match Mp4StreamWriter::new(cursor, width, height, fps, sps, pps) {
        Ok(w) => w,
        Err(_) => return Vec::new(),
    };
    for frame in nal_frames {
        let _ = writer.append_frame(frame);
    }
    match writer.finish() {
        Ok(cursor) => cursor.into_inner(),
        Err(_) => Vec::new(),
    }
}

fn write_mp4_box<F: FnOnce(&mut Vec<u8>)>(out: &mut Vec<u8>, fourcc: &[u8; 4], writer: F) {
    let start_pos = out.len();
    let _ = out.write_u32::<BigEndian>(0);
    out.extend_from_slice(fourcc);
    writer(out);
    let box_len = (out.len() - start_pos) as u32;
    out[start_pos..start_pos + 4].copy_from_slice(&box_len.to_be_bytes());
}
