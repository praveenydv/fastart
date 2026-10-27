pub mod audio;
pub mod codecs;
pub mod compositor;
pub mod effects;
pub mod engine;
pub mod motion_track;
pub mod speed_curve;
pub mod transform;
pub mod types;

pub use audio::*;
pub use codecs::*;
pub use compositor::*;
pub use effects::*;
pub use engine::*;
pub use motion_track::*;
pub use speed_curve::*;
pub use transform::*;
pub use types::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_framebuffer_and_blending() {
        let fb = FrameBuffer::with_color(10, 10, 0, 0, 0, 255);
        assert_eq!(fb.get_pixel(5, 5), (0, 0, 0, 255));

        let mut px = [0, 0, 0, 255];
        blend_pixel_over(&mut px, 255, 0, 0, 255, 1.0, BlendMode::Normal);
        assert_eq!(px, [255, 0, 0, 255]);
    }

    #[test]
    fn test_audio_waveform_and_beats() {
        let mut samples = Vec::new();
        // Generate a synthetic pulse at 44.1kHz
        for i in 0..44100 {
            let t = i as f32 / 44100.0;
            // Pulse every 0.5s (120 BPM)
            let is_beat = (i % 22050) < 500;
            let sample = if is_beat { (t * 440.0 * 2.0 * std::f32::consts::PI).sin() } else { 0.0 };
            samples.push(sample);
        }

        let peaks = generate_waveform_peaks(&samples, 10);
        assert_eq!(peaks.len(), 10);
        assert!(peaks[0] > 0.0);

        let beat_res = detect_audio_beats(&samples, 44100);
        assert!(!beat_res.beats.is_empty());
    }

    #[test]
    fn test_png_encoder() {
        let fb = FrameBuffer::with_color(4, 4, 255, 128, 0, 255);
        let png = encode_png_fast(&fb);
        assert!(png.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]));
        assert!(png.len() > 30);
    }

    #[test]
    fn test_motion_track_and_speed_curve() {
        let track = evaluate_motion_track(1.5, 0.0, 3.0, "follow_center", 60.0);
        assert!(track.dx.abs() > 0.0 || track.dy.abs() > 0.0);

        let points = vec![
            SpeedCurvePoint { t: 0.0, s: 1.0 },
            SpeedCurvePoint { t: 0.5, s: 3.0 },
            SpeedCurvePoint { t: 1.0, s: 0.5 },
        ];
        let speed = evaluate_speed_curve(&points, 0.25);
        assert!(speed > 1.0 && speed < 3.0);
    }
}

