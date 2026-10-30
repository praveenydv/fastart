use std::collections::HashMap;
use crate::audio::{encode_wav_16bit, AudioBuffer};
use crate::codecs::{
    build_h264_pps, build_h264_sps, create_mp4_container, encode_gif, encode_h264_iframe,
    encode_png_fast, GifFrame,
};
use crate::compositor::{render_canvas_background, BlendMode};
use crate::effects::{apply_color_adjustments, apply_fast_blur, apply_vignette};
use crate::transform::{composite_transformed, evaluate_keyframes, evaluate_mask_keyframes, EvaluatedTransform};
use crate::types::{FastArtProject, FrameBuffer, VideoClip};

pub struct FastArtExporter;

impl FastArtExporter {
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

        // 1. Canvas Background
        render_canvas_background(&mut fb, &project.canvas_background);

        if time_sec < 0.0 {
            return fb;
        }

        // 2. Video and Photo Clips sorted by track layer
        let mut sorted_video_clips: Vec<&VideoClip> = project.tracks.video.iter().collect();
        sorted_video_clips.sort_by_key(|c| c.layer.unwrap_or(c.track_index.unwrap_or(0)));

        for clip in sorted_video_clips {
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

            if let Some(src_frame) = clip_media {
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

                if fit == "contain" && (src_frame.width != width || src_frame.height != height) {
                    let mut blur_bg = src_frame.clone();
                    apply_fast_blur(&mut blur_bg, 8);
                    let mut bg_transform = transform;
                    bg_transform.opacity = (bg_transform.opacity * 0.45).clamp(0.0, 1.0);
                    composite_transformed(
                        &mut fb,
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
                    &mut fb,
                    src_frame,
                    &transform,
                    Some(fit),
                    evaluated_mask.as_ref().or(clip.mask.as_ref()),
                    clip.cutout.as_ref(),
                    BlendMode::Normal,
                );
            }
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
                "vignette" => apply_vignette(&mut fb, intensity * 0.8, 0.4),
                "blur" => apply_fast_blur(&mut fb, ((intensity * 10.0) as u32).min(32)),
                "contrast" => apply_color_adjustments(&mut fb, 0.0, 1.0 + intensity * 0.5, 1.0),
                "saturation" => apply_color_adjustments(&mut fb, 0.0, 1.0, 1.0 + intensity * 0.8),
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
                        &mut fb,
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
                            &mut fb,
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
                        &mut fb,
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

        let mut gif_frames = Vec::with_capacity(total_frames);
        for frame_idx in 0..total_frames {
            let time_sec = frame_idx as f64 / fps as f64;
            let fb = Self::render_frame(project, time_sec, width, height, media_cache);
            gif_frames.push(GifFrame { fb, delay_ms });
        }

        encode_gif(&gif_frames)
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

        let mut nal_frames = Vec::with_capacity(total_frames);
        for frame_idx in 0..total_frames {
            let time_sec = frame_idx as f64 / fps as f64;
            let fb = Self::render_frame(project, time_sec, width, height, media_cache);
            let nal = encode_h264_iframe(&fb, frame_idx, mb_w, mb_h);
            nal_frames.push(nal);
        }

        create_mp4_container(width, height, fps, &sps, &pps, &nal_frames)
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
