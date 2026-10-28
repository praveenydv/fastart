use std::collections::HashMap;
use crate::audio::{detect_audio_beats, generate_waveform_peaks, BeatDetectionOutput};
use crate::effects::{apply_lut_to_frame, Lut3D};
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
        crate::exporter::FastArtExporter::render_frame(project, time_sec, width, height, media_cache)
    }

    /// Renders a project frame and encodes directly to PNG bytes in Rust
    pub fn render_snapshot_png(
        project: &FastArtProject,
        time_sec: f64,
        width: u32,
        height: u32,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> Vec<u8> {
        crate::exporter::FastArtExporter::export_snapshot_png(project, time_sec, width, height, media_cache)
    }

    /// Renders animated GIF directly in Rust
    pub fn export_gif(
        project: &FastArtProject,
        fps: u32,
        width: u32,
        height: u32,
        total_duration: f64,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> Vec<u8> {
        crate::exporter::FastArtExporter::export_gif(project, fps, width, height, total_duration, media_cache)
    }

    /// Mixes multi-track project audio into a single AudioBuffer
    pub fn mix_project_audio(
        project: &FastArtProject,
        sample_rate: u32,
        total_duration: f64,
        audio_cache: &HashMap<String, crate::audio::AudioBuffer>,
    ) -> crate::audio::AudioBuffer {
        crate::exporter::FastArtExporter::mix_audio(project, sample_rate, total_duration, audio_cache)
    }

    /// Mixes project audio and encodes directly to WAV bytes
    pub fn export_wav(
        project: &FastArtProject,
        sample_rate: u32,
        total_duration: f64,
        audio_cache: &HashMap<String, crate::audio::AudioBuffer>,
    ) -> Vec<u8> {
        crate::exporter::FastArtExporter::export_wav(project, sample_rate, total_duration, audio_cache)
    }

    /// Renders and encodes standard H.264 MP4 directly in Rust
    pub fn export_mp4(
        project: &FastArtProject,
        fps: u32,
        width: u32,
        height: u32,
        total_duration: f64,
        media_cache: &HashMap<String, FrameBuffer>,
    ) -> Vec<u8> {
        crate::exporter::FastArtExporter::export_mp4(project, fps, width, height, total_duration, media_cache)
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
