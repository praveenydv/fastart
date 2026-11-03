use std::collections::HashMap;
use crate::audio::{encode_wav_16bit, AudioBuffer};
use crate::codecs::{
    build_h264_pps, build_h264_sps, encode_h264_iframe_into,
    encode_h264_pframe_into, encode_png_fast, BitWriter,
};
use crate::compositor::{render_canvas_background, BlendMode};
use crate::effects::{apply_color_adjustments, apply_fast_blur, apply_vignette};
use crate::transform::{composite_transformed, evaluate_keyframes, evaluate_mask_keyframes, EvaluatedTransform};
use crate::types::{FastArtProject, FrameBuffer};

pub struct FastArtExporter;

impl FastArtExporter {
    fn sorted_video_order(project: &FastArtProject) -> Vec<usize> {
        let mut order: Vec<usize> = (0..project.tracks.video.len()).collect();
        order.sort_by_key(|&idx| {
            let clip = &project.tracks.video[idx];
            clip.layer.unwrap_or(clip.track_index.unwrap_or(0))
        });
        order
    }

    /// Renders a single composite project frame at time_sec into an existing RGBA FrameBuffer.
    /// Eliminates heap allocations during export rendering loops.
    pub fn render_frame_into(
        project: &FastArtProject,
        time_sec: f64,
        fb: &mut FrameBuffer,
        media_cache: &HashMap<String, FrameBuffer>,
    ) {
        let video_order = Self::sorted_video_order(project);
        Self::render_frame_into_ordered(project, time_sec, fb, media_cache, &video_order);
    }

    fn render_frame_into_ordered(
        project: &FastArtProject,
        time_sec: f64,
        fb: &mut FrameBuffer,
        media_cache: &HashMap<String, FrameBuffer>,
        video_order: &[usize],
    ) {
        let width = fb.width;
        let height = fb.height;

        // 1. Canvas Background
        render_canvas_background(fb, &project.canvas_background);

        if time_sec < 0.0 {
            return;
        }

        // 2. Video and Photo Clips sorted by track layer
        for &video_idx in video_order {
            let clip = &project.tracks.video[video_idx];
            let start = clip.start_time;
            let duration = clip.duration.max(0.001);
            let end = start + duration;

            if time_sec < start || time_sec >= end {
                continue;
            }

            let clip_media = media_cache
                .get(&clip.url)
                .or_else(|| clip.thumbnail.as_ref().and_then(|t| media_cache.get(t)))
                .or_else(|| media_cache.get(&clip.id));

            let placeholder_frame: FrameBuffer;
            let src_frame: &FrameBuffer = if let Some(src) = clip_media {
                src
            } else {
                // Procedural placeholder card so clips without cache still render visually
                let w = width.min(720).max(64);
                let h = height.min(1280).max(64);
                let mut fallback = FrameBuffer::new(w, h);
                let seed = clip.id.as_bytes().iter().fold(0u32, |acc, &b| acc.wrapping_add(b as u32));
                let r1 = ((seed.wrapping_mul(1103515245).wrapping_add(12345)) >> 16) & 0xFF;
                let g1 = ((seed.wrapping_mul(214013).wrapping_add(2531011)) >> 16) & 0xFF;
                let b1 = (seed ^ (seed >> 8)) & 0xFF;
                for y in 0..h {
                    let fy = y as f32 / h as f32;
                    let r = ((r1 as f32 * (1.0 - fy * 0.4)).clamp(25.0, 215.0)) as u8;
                    let g = ((g1 as f32 * (1.0 - fy * 0.4)).clamp(25.0, 215.0)) as u8;
                    let b = ((b1 as f32 * (1.0 - fy * 0.4)).clamp(35.0, 225.0)) as u8;
                    for x in 0..w {
                        fallback.set_pixel(x, y, r, g, b, 255);
                    }
                }
                placeholder_frame = fallback;
                &placeholder_frame
            };

            let speed = if clip.speed > 0.01 && clip.speed.is_finite() {
                clip.speed
            } else {
                1.0
            };
            let trim_in = clip.trim_in.unwrap_or(0.0).max(0.0);
            let local_time = (time_sec - start) * speed + trim_in;

            let mut transform = evaluate_keyframes(
                clip.transform.as_ref(),
                clip.keyframes.as_deref(),
                local_time,
            );

            sanitize_transform(&mut transform);
            transform.opacity = (transform.opacity * clip.opacity as f32).clamp(0.0, 1.0);

            let fit = clip.fit.as_deref().unwrap_or("contain");

            if project.canvas_background == "blur" && (src_frame.width != width || src_frame.height != height) {
                // Downsample to 128x72 for instant 0.05ms blur instead of 50ms 1080p full blur
                let thumb_w = 128u32;
                let thumb_h = ((128.0 * src_frame.height as f32 / src_frame.width.max(1) as f32) as u32).clamp(32, 128);
                let mut blur_bg = FrameBuffer::new(thumb_w, thumb_h);
                for ty in 0..thumb_h {
                    let sy = (ty as usize * src_frame.height as usize) / thumb_h as usize;
                    let src_row = sy * src_frame.stride;
                    let dst_row = ty as usize * blur_bg.stride;
                    for tx in 0..thumb_w {
                        let sx = (tx as usize * src_frame.width as usize) / thumb_w as usize;
                        let s_idx = src_row + sx * 4;
                        let d_idx = dst_row + tx as usize * 4;
                        blur_bg.data[d_idx..d_idx + 4].copy_from_slice(&src_frame.data[s_idx..s_idx + 4]);
                    }
                }
                apply_fast_blur(&mut blur_bg, 3);
                let mut bg_transform = transform;
                bg_transform.opacity = (bg_transform.opacity * 0.45).clamp(0.0, 1.0);
                composite_transformed(
                    fb,
                    &blur_bg,
                    &bg_transform,
                    Some("cover"),
                    None,
                    None,
                    BlendMode::Normal,
                );
            }

            let evaluated_mask = evaluate_mask_keyframes(
                clip.mask.as_ref(),
                clip.mask_keyframes.as_deref().or_else(|| clip.mask.as_ref().and_then(|m| m.keyframes.as_deref())),
                clip.keyframes.as_deref(),
                local_time,
            );

            composite_transformed(
                fb,
                src_frame,
                &transform,
                Some(fit),
                evaluated_mask.as_ref().or(clip.mask.as_ref()),
                clip.cutout.as_ref(),
                BlendMode::Normal,
            );
        }

        // 3. Effects Track
        for effect in &project.tracks.effects {
            let start = effect.start_time;
            let duration = effect.duration.max(0.001);
            let end = start + duration;

            if time_sec < start || time_sec >= end {
                continue;
            }

            let intensity = if effect.intensity.is_finite() {
                effect.intensity.clamp(0.0, 5.0) as f32
            } else {
                1.0f32
            };

            match effect.effect_type.as_str() {
                "vignette" => apply_vignette(fb, intensity * 0.8, 0.4),
                "blur" => apply_fast_blur(fb, ((intensity * 10.0) as u32).min(32)),
                "contrast" => apply_color_adjustments(fb, 0.0, 1.0 + intensity * 0.5, 1.0),
                "saturation" => apply_color_adjustments(fb, 0.0, 1.0, 1.0 + intensity * 0.8),
                "cinema" | "letterbox" => {
                    let bar_h = ((height as f32) * 0.12 * intensity).min(height as f32 * 0.3) as u32;
                    let stride = fb.stride;
                    for y in 0..bar_h {
                        let top_idx = (y as usize) * stride;
                        let btm_idx = ((height - 1 - y) as usize) * stride;
                        for x in 0..(width as usize * 4) {
                            fb.data[top_idx + x] = 0;
                            fb.data[btm_idx + x] = 0;
                        }
                    }
                }
                _ => {}
            }
        }

        // 4. Overlays from Media Cache (Text, Captions, Stickers)
        for text_clip in &project.tracks.text {
            let start = text_clip.start_time;
            let end = start + text_clip.duration.max(0.001);
            if time_sec >= start && time_sec < end {
                if let Some(text_frame) = media_cache.get(&format!("text_{}", text_clip.id)) {
                    let mut transform = EvaluatedTransform::default();
                    transform.scale_x = text_clip.scale as f32;
                    transform.scale_y = text_clip.scale as f32;
                    transform.rotation_rad = (text_clip.rotation as f32).to_radians();
                    if let Some(pos) = &text_clip.position {
                        transform.x = pos.x as f32;
                        transform.y = pos.y as f32;
                    }
                    composite_transformed(
                        fb,
                        text_frame,
                        &transform,
                        Some("contain"),
                        None,
                        None,
                        BlendMode::Normal,
                    );
                }
            }
        }

        if let Some(captions) = &project.tracks.captions {
            for cap in captions {
                let start = cap.start_time;
                let end = start + cap.duration.max(0.001);
                if time_sec >= start && time_sec < end {
                    if let Some(cap_frame) = media_cache.get(&format!("caption_{}", cap.id)) {
                        let mut transform = EvaluatedTransform::default();
                        transform.scale_x = cap.scale as f32;
                        transform.scale_y = cap.scale as f32;
                        transform.rotation_rad = (cap.rotation as f32).to_radians();
                        if let Some(pos) = &cap.position {
                            transform.x = pos.x as f32;
                            transform.y = pos.y as f32;
                        }
                        composite_transformed(
                            fb,
                            cap_frame,
                            &transform,
                            Some("contain"),
                            None,
                            None,
                            BlendMode::Normal,
                        );
                    }
                }
            }
        }

        for sticker in &project.tracks.stickers {
            let start = sticker.start_time;
            let end = start + sticker.duration.max(0.001);
            if time_sec >= start && time_sec < end {
                if let Some(stk_frame) = media_cache.get(&format!("sticker_{}", sticker.id)) {
                    let mut transform = EvaluatedTransform::default();
                    transform.scale_x = sticker.scale as f32;
                    transform.scale_y = sticker.scale as f32;
                    transform.rotation_rad = (sticker.rotation as f32).to_radians();
                    if let Some(pos) = &sticker.position {
                        transform.x = pos.x as f32;
                        transform.y = pos.y as f32;
                    }
                    composite_transformed(
                        fb,
                        stk_frame,
                        &transform,
                        Some("contain"),
                        None,
                        None,
                        BlendMode::Normal,
                    );
                }
            }
        }
    }

    /// Renders a single composite project frame at time_sec into an RGBA FrameBuffer
    pub fn render_frame(
        project: &FastArtProject,
        time_sec: f64,
        width: u32,
        height: u32,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> FrameBuffer {
        let width = width.max(16);
        let height = height.max(16);
        let mut fb = FrameBuffer::new(width, height);
        Self::render_frame_into(project, time_sec, &mut fb, media_cache);
        fb
    }

    /// High-performance multi-track audio mixdown in Rust
    pub fn mix_audio(
        project: &FastArtProject,
        sample_rate: u32,
        total_duration: f64,
        audio_cache: &HashMap<String, AudioBuffer>,
    ) -> AudioBuffer {
        let sample_rate = if sample_rate >= 8000 && sample_rate <= 192000 {
            sample_rate
        } else {
            44100
        };
        let duration = total_duration.max(0.1);
        let total_frames = (duration * sample_rate as f64) as usize;
        let mut master = AudioBuffer::new(sample_rate, 2, total_frames);

        for clip in &project.tracks.audio {
            let clip_buf = audio_cache
                .get(&clip.url)
                .or_else(|| audio_cache.get(&clip.id));

            if let Some(src) = clip_buf {
                mix_clip_into_master(
                    &mut master,
                    src,
                    clip.start_time,
                    clip.duration,
                    clip.trim_in.unwrap_or(0.0),
                    clip.speed,
                    clip.volume,
                    clip.fade_in.unwrap_or(0.0),
                    clip.fade_out.unwrap_or(0.0),
                );
            }
        }

        for clip in &project.tracks.video {
            if clip.has_audio == Some(false) || clip.muted == Some(true) {
                continue;
            }

            let clip_buf = audio_cache
                .get(&clip.url)
                .or_else(|| audio_cache.get(&clip.id));

            if let Some(src) = clip_buf {
                mix_clip_into_master(
                    &mut master,
                    src,
                    clip.start_time,
                    clip.duration,
                    clip.trim_in.unwrap_or(0.0),
                    clip.speed,
                    clip.volume,
                    clip.fade_in.unwrap_or(0.0),
                    clip.fade_out.unwrap_or(0.0),
                );
            }
        }

        for s in &mut master.samples {
            let val = *s;
            let abs_v = val.abs();
            if abs_v > 0.85 {
                let sign = if val >= 0.0 { 1.0 } else { -1.0 };
                let excess = abs_v - 0.85;
                let compressed = 0.85 + excess / (1.0 + excess * 1.5);
                *s = sign * compressed.min(1.0);
            }
        }

        master
    }

    /// Encodes mixed project audio directly into standard 16-bit PCM RIFF WAV bytes
    pub fn export_wav(
        project: &FastArtProject,
        sample_rate: u32,
        total_duration: f64,
        audio_cache: &HashMap<String, AudioBuffer>,
    ) -> Vec<u8> {
        let master = Self::mix_audio(project, sample_rate, total_duration, audio_cache);
        encode_wav_16bit(&master)
    }

    /// Renders project into an animated GIF in Rust
    pub fn export_gif(
        project: &FastArtProject,
        fps: u32,
        width: u32,
        height: u32,
        total_duration: f64,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> Vec<u8> {
        let fps = fps.clamp(5, 30);
        let duration = total_duration.max(0.2).min(30.0);
        let total_frames = ((duration * fps as f64) as usize).max(1);
        let delay_ms = (1000 / fps) as u16;

        let mut writer = match crate::codecs::GifStreamWriter::new(Vec::new(), width as u16, height as u16) {
            Ok(w) => w,
            Err(_) => return Vec::new(),
        };

        let mut curr_fb = FrameBuffer::new(width, height);
        let video_order = Self::sorted_video_order(project);
        for frame_idx in 0..total_frames {
            let time_sec = frame_idx as f64 / fps as f64;
            Self::render_frame_into_ordered(project, time_sec, &mut curr_fb, media_cache, &video_order);
            let _ = writer.append_frame(&curr_fb, delay_ms);
        }

        match writer.finish() {
            Ok(vec) => vec,
            Err(_) => Vec::new(),
        }
    }

    /// Renders a single project frame at time_sec and encodes to PNG
    pub fn export_snapshot_png(
        project: &FastArtProject,
        time_sec: f64,
        width: u32,
        height: u32,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> Vec<u8> {
        let fb = Self::render_frame(project, time_sec, width, height, media_cache);
        encode_png_fast(&fb)
    }

    /// Encodes the entire multi-track project into a standard H.264 MP4 container directly in Rust
    pub fn export_mp4(
        project: &FastArtProject,
        fps: u32,
        width: u32,
        height: u32,
        total_duration: f64,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> Vec<u8> {
        let fps = fps.clamp(5, 60);
        let duration = total_duration.max(0.2);
        let total_frames = ((duration * fps as f64) as usize).max(1);

        // Align dimensions to 16 for H.264 macroblocks
        let width = ((width + 15) / 16) * 16;
        let height = ((height + 15) / 16) * 16;
        let mb_w = width / 16;
        let mb_h = height / 16;

        let sps = build_h264_sps(mb_w, mb_h, fps);
        let pps = build_h264_pps();

        let cursor = std::io::Cursor::new(Vec::with_capacity(total_frames * 512 + 65536));
        let mut writer = match crate::codecs::Mp4StreamWriter::new(cursor, width, height, fps, &sps, &pps) {
            Ok(w) => w,
            Err(_) => return Vec::new(),
        };

        let mut curr_fb = FrameBuffer::new(width, height);
        let mut prev_fb = FrameBuffer::new(width, height);
        let video_order = Self::sorted_video_order(project);
        let gop_size = (fps * 2).clamp(30, 60) as usize;

        let mut bw = BitWriter::new((mb_w * mb_h * 64) as usize + 2048);
        let mut nal_body = Vec::with_capacity((mb_w * mb_h * 386) as usize + 2048);
        let mut nal_out = Vec::with_capacity((mb_w * mb_h * 386) as usize + 2048);

        for frame_idx in 0..total_frames {
            let time_sec = frame_idx as f64 / fps as f64;
            Self::render_frame_into_ordered(project, time_sec, &mut curr_fb, media_cache, &video_order);

            let is_keyframe = frame_idx == 0 || (frame_idx % gop_size == 0);
            if is_keyframe {
                encode_h264_iframe_into(
                    &curr_fb,
                    frame_idx,
                    mb_w,
                    mb_h,
                    &mut bw,
                    &mut nal_body,
                    &mut nal_out,
                );
            } else {
                encode_h264_pframe_into(
                    &curr_fb,
                    &prev_fb,
                    frame_idx,
                    mb_w,
                    mb_h,
                    &mut bw,
                    &mut nal_out,
                );
            }

            let _ = writer.append_frame(&nal_out);
            std::mem::swap(&mut curr_fb, &mut prev_fb);
        }

        match writer.finish() {
            Ok(c) => c.into_inner(),
            Err(_) => Vec::new(),
        }
    }

    /// Zero-Memory direct-to-disk streaming MP4 export
    #[cfg(not(target_arch = "wasm32"))]
    pub fn export_mp4_file(
        project: &FastArtProject,
        fps: u32,
        width: u32,
        height: u32,
        total_duration: f64,
        media_cache: &HashMap<String, FrameBuffer>,
        output_path: &str,
    ) -> std::io::Result<()> {
        let fps = fps.clamp(5, 60);
        let duration = total_duration.max(0.2);
        let total_frames = ((duration * fps as f64) as usize).max(1);

        let width = ((width + 15) / 16) * 16;
        let height = ((height + 15) / 16) * 16;
        let mb_w = width / 16;
        let mb_h = height / 16;

        let sps = build_h264_sps(mb_w, mb_h, fps);
        let pps = build_h264_pps();

        let file = std::fs::File::create(output_path)?;
        let buf_writer = std::io::BufWriter::with_capacity(512 * 1024, file);
        let mut writer = crate::codecs::Mp4StreamWriter::new(buf_writer, width, height, fps, &sps, &pps)?;

        let mut curr_fb = FrameBuffer::new(width, height);
        let mut prev_fb = FrameBuffer::new(width, height);
        let video_order = Self::sorted_video_order(project);
        let gop_size = (fps * 2).clamp(30, 60) as usize;

        let mut bw = BitWriter::new((mb_w * mb_h * 64) as usize + 2048);
        let mut nal_body = Vec::with_capacity((mb_w * mb_h * 386) as usize + 2048);
        let mut nal_out = Vec::with_capacity((mb_w * mb_h * 386) as usize + 2048);

        for frame_idx in 0..total_frames {
            let time_sec = frame_idx as f64 / fps as f64;
            Self::render_frame_into_ordered(project, time_sec, &mut curr_fb, media_cache, &video_order);

            let is_keyframe = frame_idx == 0 || (frame_idx % gop_size == 0);
            if is_keyframe {
                encode_h264_iframe_into(
                    &curr_fb,
                    frame_idx,
                    mb_w,
                    mb_h,
                    &mut bw,
                    &mut nal_body,
                    &mut nal_out,
                );
            } else {
                encode_h264_pframe_into(
                    &curr_fb,
                    &prev_fb,
                    frame_idx,
                    mb_w,
                    mb_h,
                    &mut bw,
                    &mut nal_out,
                );
            }

            writer.append_frame(&nal_out)?;
            std::mem::swap(&mut curr_fb, &mut prev_fb);
        }

        writer.finish()?;
        Ok(())
    }

    /// Zero-Memory direct-to-disk streaming GIF export
    #[cfg(not(target_arch = "wasm32"))]
    pub fn export_gif_file(
        project: &FastArtProject,
        fps: u32,
        width: u32,
        height: u32,
        total_duration: f64,
        media_cache: &HashMap<String, FrameBuffer>,
        output_path: &str,
    ) -> std::io::Result<()> {
        let fps = fps.clamp(5, 30);
        let duration = total_duration.max(0.2).min(30.0);
        let total_frames = ((duration * fps as f64) as usize).max(1);
        let delay_ms = (1000 / fps) as u16;

        let file = std::fs::File::create(output_path)?;
        let buf_writer = std::io::BufWriter::with_capacity(256 * 1024, file);
        let mut writer = crate::codecs::GifStreamWriter::new(buf_writer, width as u16, height as u16)?;

        let mut curr_fb = FrameBuffer::new(width, height);
        let video_order = Self::sorted_video_order(project);
        for frame_idx in 0..total_frames {
            let time_sec = frame_idx as f64 / fps as f64;
            Self::render_frame_into_ordered(project, time_sec, &mut curr_fb, media_cache, &video_order);
            writer.append_frame(&curr_fb, delay_ms)?;
        }

        writer.finish()?;
        Ok(())
    }

    /// Direct-to-disk WAV master audio export
    #[cfg(not(target_arch = "wasm32"))]
    pub fn export_wav_file(
        project: &FastArtProject,
        sample_rate: u32,
        total_duration: f64,
        audio_cache: &HashMap<String, AudioBuffer>,
        output_path: &str,
    ) -> std::io::Result<()> {
        let master = Self::mix_audio(project, sample_rate, total_duration, audio_cache);
        let file = std::fs::File::create(output_path)?;
        let mut buf_writer = std::io::BufWriter::with_capacity(256 * 1024, file);
        crate::audio::encode_wav_16bit_to_writer(&mut buf_writer, &master)?;
        Ok(())
    }
}

fn sanitize_transform(t: &mut EvaluatedTransform) {
    if !t.scale_x.is_finite() || t.scale_x <= 0.001 {
        t.scale_x = 1.0;
    }
    if !t.scale_y.is_finite() || t.scale_y <= 0.001 {
        t.scale_y = 1.0;
    }
    if !t.rotation_rad.is_finite() {
        t.rotation_rad = 0.0;
    }
    if !t.x.is_finite() {
        t.x = 0.0;
    }
    if !t.y.is_finite() {
        t.y = 0.0;
    }
    if !t.opacity.is_finite() {
        t.opacity = 1.0;
    }
    t.scale_x = t.scale_x.clamp(0.01, 100.0);
    t.scale_y = t.scale_y.clamp(0.01, 100.0);
    t.opacity = t.opacity.clamp(0.0, 1.0);
}

fn mix_clip_into_master(
    master: &mut AudioBuffer,
    src: &AudioBuffer,
    start_time: f64,
    clip_duration: f64,
    trim_in: f64,
    speed: f64,
    volume: f64,
    fade_in: f64,
    fade_out: f64,
) {
    if src.samples.is_empty() || src.channels == 0 || src.sample_rate == 0 {
        return;
    }

    let speed = if speed.is_finite() && speed > 0.01 {
        speed
    } else {
        1.0
    };
    let volume = if volume.is_finite() {
        volume.clamp(0.0, 4.0) as f32
    } else {
        1.0f32
    };

    let sample_rate = master.sample_rate as f64;
    let master_start_frame = (start_time * sample_rate).max(0.0) as usize;
    let master_duration_frames = (clip_duration * sample_rate) as usize;
    let total_master_frames = master.samples.len() / 2;

    let end_frame = (master_start_frame + master_duration_frames).min(total_master_frames);
    let src_channels = src.channels as usize;
    let src_total_frames = src.samples.len() / src_channels;

    let fade_in_frames = (fade_in * sample_rate).max(0.0);
    let fade_out_frames = (fade_out * sample_rate).max(0.0);

    for m_idx in master_start_frame..end_frame {
        let local_frame = (m_idx - master_start_frame) as f64;
        let local_sec = local_frame / sample_rate;

        let src_sec = local_sec * speed + trim_in;
        let src_sample_pos = src_sec * src.sample_rate as f64;

        if src_sample_pos < 0.0 || src_sample_pos >= (src_total_frames as f64 - 1.0) {
            continue;
        }

        let s_idx0 = src_sample_pos.floor() as usize;
        let s_idx1 = (s_idx0 + 1).min(src_total_frames - 1);
        let frac = (src_sample_pos - s_idx0 as f64) as f32;

        let (src_l, src_r) = if src_channels == 1 {
            let v0 = src.samples[s_idx0];
            let v1 = src.samples[s_idx1];
            let v = v0 + (v1 - v0) * frac;
            (v, v)
        } else {
            let v0_l = src.samples[s_idx0 * src_channels];
            let v1_l = src.samples[s_idx1 * src_channels];
            let v0_r = src.samples[s_idx0 * src_channels + 1];
            let v1_r = src.samples[s_idx1 * src_channels + 1];
            (v0_l + (v1_l - v0_l) * frac, v0_r + (v1_r - v0_r) * frac)
        };

        let mut gain = volume;
        if fade_in_frames > 0.0 && local_frame < fade_in_frames {
            gain *= (local_frame / fade_in_frames) as f32;
        }

        let remaining_frames = (end_frame - m_idx) as f64;
        if fade_out_frames > 0.0 && remaining_frames < fade_out_frames {
            gain *= (remaining_frames / fade_out_frames) as f32;
        }

        let out_idx = m_idx * 2;
        master.samples[out_idx] += src_l * gain;
        master.samples[out_idx + 1] += src_r * gain;
    }
}
