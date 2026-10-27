use std::collections::HashMap;
use crate::audio::{detect_audio_beats, generate_waveform_peaks, BeatDetectionOutput};
use crate::codecs::encode_png_fast;
use crate::compositor::{render_canvas_background, BlendMode};
use crate::effects::{apply_color_adjustments, apply_fast_blur, apply_lut_to_frame, apply_vignette, Lut3D};
use crate::transform::{composite_transformed, evaluate_keyframes};
use crate::types::{FastArtProject, FrameBuffer};

pub struct FastArtEngine;

impl FastArtEngine {
    /// Renders a single composite project frame at time `time_sec` into an RGBA FrameBuffer
    pub fn render_frame(
        project: &FastArtProject,
        time_sec: f64,
        width: u32,
        height: u32,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> FrameBuffer {
        let mut fb = FrameBuffer::new(width, height);

        // 1. Render Canvas Background (Solid color / aesthetic gradient)
        render_canvas_background(&mut fb, &project.canvas_background);

        // 2. Active Video Clips
        for clip in &project.tracks.video {
            let start = clip.start_time;
            let end = start + clip.duration;
            if time_sec < start || time_sec >= end {
                continue;
            }

            // Find decoded media image from cache
            let clip_media = media_cache
                .get(&clip.url)
                .or_else(|| clip.thumbnail.as_ref().and_then(|t| media_cache.get(t)));

            if let Some(src_frame) = clip_media {
                let local_time = (time_sec - start) * clip.speed + clip.trim_in.unwrap_or(0.0);
                let transform = evaluate_keyframes(
                    clip.transform.as_ref(),
                    clip.keyframes.as_deref(),
                    local_time,
                );

                let fit = clip.fit.as_deref().unwrap_or("contain");

                // If pillarbox blur background needed when aspect ratio differs
                if fit == "contain" && (src_frame.width != width || src_frame.height != height) {
                    let mut blur_bg = src_frame.clone();
                    apply_fast_blur(&mut blur_bg, 8);
                    let mut bg_transform = transform;
                    bg_transform.opacity = 0.5;
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

                // Render main clip
                composite_transformed(
                    &mut fb,
                    src_frame,
                    &transform,
                    Some(fit),
                    clip.mask.as_ref(),
                    clip.cutout.as_ref(),
                    BlendMode::Normal,
                );
            }
        }

        // 3. Active Effects & Shaders
        for effect in &project.tracks.effects {
            let start = effect.start_time;
            let end = start + effect.duration;
            if time_sec < start || time_sec >= end {
                continue;
            }

            let intensity = effect.intensity as f32;
            match effect.effect_type.as_str() {
                "vignette" => apply_vignette(&mut fb, intensity * 0.8, 0.4),
                "blur" => apply_fast_blur(&mut fb, (intensity * 10.0) as u32),
                "contrast" => apply_color_adjustments(&mut fb, 0.0, 1.0 + intensity * 0.5, 1.0),
                "saturation" => apply_color_adjustments(&mut fb, 0.0, 1.0, 1.0 + intensity * 0.8),
                _ => {}
            }
        }

        fb
    }

    /// Renders a project frame and encodes directly to PNG bytes in Rust
    pub fn render_snapshot_png(
        project: &FastArtProject,
        time_sec: f64,
        width: u32,
        height: u32,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> Vec<u8> {
        let frame = Self::render_frame(project, time_sec, width, height, media_cache);
        encode_png_fast(&frame)
    }

    /// High-speed beat and tempo detector
    pub fn detect_beats(samples: &[f32], sample_rate: u32) -> BeatDetectionOutput {
        detect_audio_beats(samples, sample_rate)
    }

    /// High-speed waveform peak generator
    pub fn generate_waveform(samples: &[f32], buckets: usize) -> Vec<f32> {
        generate_waveform_peaks(samples, buckets)
    }

    /// Applies 3D LUT to raw RGBA buffer
    pub fn apply_lut(
        rgba: &mut [u8],
        width: u32,
        height: u32,
        cube_str: &str,
        intensity: f32,
    ) -> bool {
        if let Some(lut) = Lut3D::from_cube(cube_str) {
            let mut fb = FrameBuffer {
                width,
                height,
                stride: (width as usize) * 4,
                data: rgba.to_vec(),
            };
            apply_lut_to_frame(&mut fb, &lut, intensity);
            rgba.copy_from_slice(&fb.data);
            true
        } else {
            false
        }
    }
}
