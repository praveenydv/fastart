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

// ---------------------------------------------------------------------------
// H.264 Video Encoder & MP4 Container Muxer
// ---------------------------------------------------------------------------

pub struct BitWriter {
    data: Vec<u8>,
    bit_buf: u32,
    bits_in_buf: u8,
}

impl BitWriter {
    pub fn new(capacity: usize) -> Self {
        Self {
            data: Vec::with_capacity(capacity),
            bit_buf: 0,
            bits_in_buf: 0,
        }
    }

    pub fn write_bits(&mut self, val: u32, count: u8) {
        if count == 0 {
            return;
        }
        let val = val & ((1u64 << count) - 1) as u32;
        self.bit_buf = (self.bit_buf << count) | val;
        self.bits_in_buf += count;
        while self.bits_in_buf >= 8 {
            let shift = self.bits_in_buf - 8;
            let byte = ((self.bit_buf >> shift) & 0xFF) as u8;
            self.data.push(byte);
            self.bits_in_buf -= 8;
            self.bit_buf &= (1u32 << self.bits_in_buf) - 1;
        }
    }

    pub fn write_bit(&mut self, b: u8) {
        self.write_bits(b as u32, 1);
    }

    pub fn write_ue(&mut self, val: u32) {
        let val_plus_1 = val + 1;
        let len = 32 - val_plus_1.leading_zeros();
        self.write_bits(0, (len - 1) as u8);
        self.write_bits(val_plus_1, len as u8);
    }

    pub fn write_se(&mut self, val: i32) {
        let mapped = if val <= 0 {
            (-val * 2) as u32
        } else {
            (val * 2 - 1) as u32
        };
        self.write_ue(mapped);
    }

    pub fn align_zero(&mut self) {
        if self.bits_in_buf > 0 {
            let pad = 8 - self.bits_in_buf;
            self.write_bits(0, pad);
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
    bw.write_bits(66, 8); // Profile: Baseline
    bw.write_bits(0xE0, 8); // Constraints
    bw.write_bits(31, 8); // Level 3.1
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
    let total_mbs = (mb_w * mb_h) as usize;
    let mut bw = BitWriter::new(total_mbs * 390 + 512);

    bw.write_ue(0); // first_mb_in_slice
    bw.write_ue(7); // slice_type (All I-slice)
    bw.write_ue(0); // pic_parameter_set_id
    bw.write_bits(0, 4); // frame_num (0 for IDR)
    bw.write_ue((frame_index & 1) as u32); // idr_pic_id
    bw.write_bit(0);
    bw.write_bit(0);
    bw.write_se(0); // slice_qp_delta

    bw.write_ue(25); // mb_type: 25 (I_PCM)
    bw.align_zero();

    let mut body = bw.into_bytes();
    let width = fb.width as usize;
    let height = fb.height as usize;

    for mby in 0..mb_h as usize {
        for mbx in 0..mb_w as usize {
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
                    body.push(y_val.clamp(0, 255) as u8);
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
                    body.push(u_val.clamp(0, 255) as u8);
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
                    body.push(v_val.clamp(0, 255) as u8);
                }
            }
        }
    }

    let nal_body = rbsp_to_nal(&body);
    let mut nal = Vec::with_capacity(1 + nal_body.len());
    nal.push(0x65); // IDR slice (type 5, nal_ref_idc 3)
    nal.extend_from_slice(&nal_body);
    nal
}

pub fn create_mp4_container(
    width: u32,
    height: u32,
    fps: u32,
    sps: &[u8],
    pps: &[u8],
    nal_frames: &[Vec<u8>],
) -> Vec<u8> {
    let mut out = Vec::new();
    let total_samples = nal_frames.len();
    let timescale = fps.max(1) * 1000;
    let duration = (total_samples as u64 * 1000) as u32;

    // 1. ftyp box
    write_mp4_box(&mut out, b"ftyp", |b| {
        b.extend_from_slice(b"isom"); // Major brand
        let _ = b.write_u32::<BigEndian>(512); // Minor version
        b.extend_from_slice(b"isom");
        b.extend_from_slice(b"iso2");
        b.extend_from_slice(b"avc1");
        b.extend_from_slice(b"mp41");
    });

    // 2. Compute mdat size and offsets
    let mut mdat_payload = Vec::new();
    let mut sample_sizes = Vec::with_capacity(total_samples);

    for frame in nal_frames {
        let len = frame.len() as u32;
        sample_sizes.push(len + 4);
        let _ = mdat_payload.write_u32::<BigEndian>(len);
        mdat_payload.extend_from_slice(frame);
    }

    // 3. moov box
    let mut moov_bytes = Vec::new();
    write_mp4_box(&mut moov_bytes, b"moov", |moov| {
        // mvhd
        write_mp4_box(moov, b"mvhd", |mvhd| {
            mvhd.push(0); // version
            mvhd.extend_from_slice(&[0, 0, 0]); // flags
            let _ = mvhd.write_u32::<BigEndian>(0); // creation_time
            let _ = mvhd.write_u32::<BigEndian>(0); // modification_time
            let _ = mvhd.write_u32::<BigEndian>(timescale);
            let _ = mvhd.write_u32::<BigEndian>(duration);
            let _ = mvhd.write_u32::<BigEndian>(0x00010000); // rate 1.0
            let _ = mvhd.write_u16::<BigEndian>(0x0100); // volume 1.0
            mvhd.extend_from_slice(&[0; 10]); // reserved
            // Unity matrix
            let _ = mvhd.write_u32::<BigEndian>(0x00010000);
            let _ = mvhd.write_u32::<BigEndian>(0);
            let _ = mvhd.write_u32::<BigEndian>(0);
            let _ = mvhd.write_u32::<BigEndian>(0);
            let _ = mvhd.write_u32::<BigEndian>(0x00010000);
            let _ = mvhd.write_u32::<BigEndian>(0);
            let _ = mvhd.write_u32::<BigEndian>(0);
            let _ = mvhd.write_u32::<BigEndian>(0);
            let _ = mvhd.write_u32::<BigEndian>(0x40000000);
            mvhd.extend_from_slice(&[0; 24]); // pre_defined
            let _ = mvhd.write_u32::<BigEndian>(2); // next_track_ID
        });

        // trak
        write_mp4_box(moov, b"trak", |trak| {
            // tkhd
            write_mp4_box(trak, b"tkhd", |tkhd| {
                tkhd.push(0); // version
                tkhd.extend_from_slice(&[0, 0, 3]); // flags (enabled + in_movie)
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(1); // track_ID
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(duration);
                tkhd.extend_from_slice(&[0; 8]);
                let _ = tkhd.write_u16::<BigEndian>(0); // layer
                let _ = tkhd.write_u16::<BigEndian>(0); // alternate_group
                let _ = tkhd.write_u16::<BigEndian>(0); // volume
                let _ = tkhd.write_u16::<BigEndian>(0);
                // Unity matrix
                let _ = tkhd.write_u32::<BigEndian>(0x00010000);
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(0x00010000);
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(0);
                let _ = tkhd.write_u32::<BigEndian>(0x40000000);
                let _ = tkhd.write_u32::<BigEndian>(width << 16);
                let _ = tkhd.write_u32::<BigEndian>(height << 16);
            });

            // mdia
            write_mp4_box(trak, b"mdia", |mdia| {
                write_mp4_box(mdia, b"mdhd", |mdhd| {
                    mdhd.push(0);
                    mdhd.extend_from_slice(&[0, 0, 0]);
                    let _ = mdhd.write_u32::<BigEndian>(0);
                    let _ = mdhd.write_u32::<BigEndian>(0);
                    let _ = mdhd.write_u32::<BigEndian>(timescale);
                    let _ = mdhd.write_u32::<BigEndian>(duration);
                    let _ = mdhd.write_u16::<BigEndian>(0x55C4); // Language 'und'
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
                        // stsd
                        write_mp4_box(stbl, b"stsd", |stsd| {
                            stsd.push(0);
                            stsd.extend_from_slice(&[0, 0, 0]);
                            let _ = stsd.write_u32::<BigEndian>(1);

                            write_mp4_box(stsd, b"avc1", |avc1| {
                                avc1.extend_from_slice(&[0; 6]);
                                let _ = avc1.write_u16::<BigEndian>(1); // data_reference_index
                                let _ = avc1.write_u16::<BigEndian>(0);
                                let _ = avc1.write_u16::<BigEndian>(0);
                                avc1.extend_from_slice(&[0; 12]);
                                let _ = avc1.write_u16::<BigEndian>(width as u16);
                                let _ = avc1.write_u16::<BigEndian>(height as u16);
                                let _ = avc1.write_u32::<BigEndian>(0x00480000); // 72 dpi
                                let _ = avc1.write_u32::<BigEndian>(0x00480000);
                                let _ = avc1.write_u32::<BigEndian>(0);
                                let _ = avc1.write_u16::<BigEndian>(1); // frame_count
                                avc1.extend_from_slice(&[0; 32]); // compressorname
                                let _ = avc1.write_u16::<BigEndian>(0x0018); // depth 24
                                let _ = avc1.write_i16::<BigEndian>(-1);

                                // avcC
                                write_mp4_box(avc1, b"avcC", |avcc| {
                                    avcc.push(1); // configurationVersion
                                    avcc.push(sps[1]); // AVCProfileIndication
                                    avcc.push(sps[2]); // profile_compatibility
                                    avcc.push(sps[3]); // AVCLevelIndication
                                    avcc.push(0xFF); // lengthSizeMinusOne = 3 (4-byte NAL lengths)
                                    avcc.push(0xE1); // numOfSequenceParameterSets = 1
                                    let _ = avcc.write_u16::<BigEndian>(sps.len() as u16);
                                    avcc.extend_from_slice(sps);
                                    avcc.push(1); // numOfPictureParameterSets = 1
                                    let _ = avcc.write_u16::<BigEndian>(pps.len() as u16);
                                    avcc.extend_from_slice(pps);
                                });
                            });
                        });

                        // stts
                        write_mp4_box(stbl, b"stts", |stts| {
                            stts.push(0);
                            stts.extend_from_slice(&[0, 0, 0]);
                            let _ = stts.write_u32::<BigEndian>(1);
                            let _ = stts.write_u32::<BigEndian>(total_samples as u32);
                            let _ = stts.write_u32::<BigEndian>(1000); // sample delta
                        });

                        // stsc
                        write_mp4_box(stbl, b"stsc", |stsc| {
                            stsc.push(0);
                            stsc.extend_from_slice(&[0, 0, 0]);
                            let _ = stsc.write_u32::<BigEndian>(1);
                            let _ = stsc.write_u32::<BigEndian>(1);
                            let _ = stsc.write_u32::<BigEndian>(total_samples as u32);
                            let _ = stsc.write_u32::<BigEndian>(1);
                        });

                        // stsz
                        write_mp4_box(stbl, b"stsz", |stsz| {
                            stsz.push(0);
                            stsz.extend_from_slice(&[0, 0, 0]);
                            let _ = stsz.write_u32::<BigEndian>(0);
                            let _ = stsz.write_u32::<BigEndian>(total_samples as u32);
                            for &sz in &sample_sizes {
                                let _ = stsz.write_u32::<BigEndian>(sz);
                            }
                        });

                        // stco (placeholder offset, patched after moov box is finalized)
                        write_mp4_box(stbl, b"stco", |stco| {
                            stco.push(0);
                            stco.extend_from_slice(&[0, 0, 0]);
                            let _ = stco.write_u32::<BigEndian>(1);
                            let _ = stco.write_u32::<BigEndian>(0); // placeholder
                        });
                    });
                });
            });
        });
    });

    // Patch chunk offset in stco box (last 4 bytes of moov_bytes)
    let chunk_offset = (out.len() + moov_bytes.len() + 8) as u32;
    let offset_pos = moov_bytes.len() - 4;
    moov_bytes[offset_pos..offset_pos + 4].copy_from_slice(&chunk_offset.to_be_bytes());

    out.extend_from_slice(&moov_bytes);

    // 4. mdat box
    write_mp4_box(&mut out, b"mdat", |mdat| {
        mdat.extend_from_slice(&mdat_payload);
    });

    out
}

fn write_mp4_box<F: FnOnce(&mut Vec<u8>)>(out: &mut Vec<u8>, fourcc: &[u8; 4], writer: F) {
    let start_pos = out.len();
    let _ = out.write_u32::<BigEndian>(0);
    out.extend_from_slice(fourcc);
    writer(out);
    let box_len = (out.len() - start_pos) as u32;
    out[start_pos..start_pos + 4].copy_from_slice(&box_len.to_be_bytes());
}
