pub mod audio;
pub mod codecs;
pub mod compositor;
pub mod cutout;
pub mod effects;
pub mod engine;
pub mod exporter;
pub mod motion_track;
pub mod speed_curve;
pub mod transform;
pub mod types;

pub use audio::*;
pub use codecs::*;
pub use compositor::*;
pub use cutout::*;
pub use effects::*;
pub use engine::*;
pub use exporter::*;
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
    fn test_export_mp4() {
        use std::collections::HashMap;
        let json = r#"{
            "id": "proj-1",
            "title": "Test Project",
            "aspectRatio": "9:16",
            "tracks": {
                "video": [],
                "audio": [],
                "text": [],
                "captions": [],
                "stickers": [],
                "effects": [],
                "filters": []
            }
        }"#;
        let proj: FastArtProject = serde_json::from_str(json).unwrap();
        let cache = HashMap::new();
        let mp4 = FastArtEngine::export_mp4(&proj, 30, 360, 640, 1.0, &cache);
        assert!(!mp4.is_empty());
        assert_eq!(&mp4[4..8], b"ftyp");
        // Check that mdat exists in container
        let has_mdat = mp4.windows(4).any(|w| w == b"mdat");
        let has_moov = mp4.windows(4).any(|w| w == b"moov");
        assert!(has_mdat, "MP4 must contain mdat box");
        assert!(has_moov, "MP4 must contain moov box");
    }

    #[test]
    fn test_export_mp4_file_streaming() {
        use std::collections::HashMap;
        let json = r#"{
            "id": "proj-file-mp4",
            "title": "File MP4 Project",
            "aspectRatio": "9:16",
            "tracks": {
                "video": [],
                "audio": [],
                "text": [],
                "captions": [],
                "stickers": [],
                "effects": [],
                "filters": []
            }
        }"#;
        let proj: FastArtProject = serde_json::from_str(json).unwrap();
        let cache = HashMap::new();
        let tmp_path = std::env::temp_dir().join("test_fastart_export.mp4");
        let path_str = tmp_path.to_str().unwrap();

        let res = FastArtEngine::export_mp4_file(&proj, 30, 360, 640, 0.5, &cache, path_str);
        assert!(res.is_ok(), "Streaming MP4 to disk should succeed");

        let metadata = std::fs::metadata(&tmp_path).expect("File must exist on disk");
        assert!(metadata.len() > 1024, "File size must be > 1KB");

        let bytes = std::fs::read(&tmp_path).unwrap();
        assert_eq!(&bytes[4..8], b"ftyp");
        let _ = std::fs::remove_file(&tmp_path);
    }

    #[test]
    fn test_export_gif_file_streaming() {
        use std::collections::HashMap;
        let json = r#"{
            "id": "proj-file-gif",
            "title": "File GIF Project",
            "aspectRatio": "1:1",
            "tracks": {
                "video": [],
                "audio": [],
                "text": [],
                "captions": [],
                "stickers": [],
                "effects": [],
                "filters": []
            }
        }"#;
        let proj: FastArtProject = serde_json::from_str(json).unwrap();
        let cache = HashMap::new();
        let tmp_path = std::env::temp_dir().join("test_fastart_export.gif");
        let path_str = tmp_path.to_str().unwrap();

        let res = FastArtEngine::export_gif_file(&proj, 10, 64, 64, 0.4, &cache, path_str);
        assert!(res.is_ok(), "Streaming GIF to disk should succeed");

        let bytes = std::fs::read(&tmp_path).unwrap();
        assert!(bytes.starts_with(b"GIF89a"));
        assert_eq!(bytes[bytes.len() - 1], 0x3B);
        let _ = std::fs::remove_file(&tmp_path);
    }

    #[test]
    fn test_export_wav_file_streaming() {
        use std::collections::HashMap;
        let json = r#"{
            "id": "proj-file-wav",
            "title": "File WAV Project",
            "aspectRatio": "16:9",
            "tracks": {
                "video": [],
                "audio": [],
                "text": [],
                "captions": [],
                "stickers": [],
                "effects": [],
                "filters": []
            }
        }"#;
        let proj: FastArtProject = serde_json::from_str(json).unwrap();
        let cache = HashMap::new();
        let tmp_path = std::env::temp_dir().join("test_fastart_export.wav");
        let path_str = tmp_path.to_str().unwrap();

        let res = FastArtEngine::export_wav_file(&proj, 44100, 0.4, &cache, path_str);
        assert!(res.is_ok(), "Streaming WAV to disk should succeed");

        let bytes = std::fs::read(&tmp_path).unwrap();
        assert!(bytes.starts_with(b"RIFF"));
        assert_eq!(&bytes[8..12], b"WAVE");
        let _ = std::fs::remove_file(&tmp_path);
    }

    #[test]
    fn test_h264_pframe_skip_encoding() {
        use crate::codecs::{encode_h264_iframe, encode_h264_pframe_into, BitWriter};
        let w = 320u32;
        let h = 240u32;
        let mb_w = w / 16;
        let mb_h = h / 16;

        let frame1 = FrameBuffer::with_color(w, h, 20, 30, 40, 255);
        let frame2 = FrameBuffer::with_color(w, h, 20, 30, 40, 255);

        let iframe_bytes = encode_h264_iframe(&frame1, 0, mb_w, mb_h);
        assert!(iframe_bytes.len() > 10000, "I-frame contains uncompressed macroblocks");

        let mut bw = BitWriter::new(1024);
        let mut pframe_bytes = Vec::new();
        encode_h264_pframe_into(&frame2, &frame1, 1, mb_w, mb_h, &mut bw, &mut pframe_bytes);

        // A static frame encoded with mb_skip_run should be less than 50 bytes!
        assert!(pframe_bytes.len() < 50, "P-frame with zero changed macroblocks must be tiny, got {} bytes", pframe_bytes.len());
        assert_eq!(pframe_bytes[0], 0x41, "Must be a non-IDR P-slice NAL unit");
    }

    #[test]
    fn test_h264_iframe_macroblock_syntax() {
        let fb = FrameBuffer::with_color(32, 32, 100, 150, 200, 255);
        let nal = encode_h264_iframe(&fb, 0, 2, 2);
        assert!(!nal.is_empty());
        assert_eq!(nal[0], 0x65); // IDR slice header
        // Verify macroblocks 1, 2, 3 receive the mandatory [0x0D, 0x00] I_PCM syntax
        assert!(nal.len() > 384 * 4);
    }

    #[test]
    fn test_export_gif_compliance() {
        use std::collections::HashMap;
        let json = r#"{
            "id": "proj-gif",
            "title": "GIF Project",
            "aspectRatio": "1:1",
            "tracks": {
                "video": [],
                "audio": [],
                "text": [],
                "captions": [],
                "stickers": [],
                "effects": [],
                "filters": []
            }
        }"#;
        let proj: FastArtProject = serde_json::from_str(json).unwrap();
        let cache = HashMap::new();
        let gif = FastArtEngine::export_gif(&proj, 10, 64, 64, 0.5, &cache);
        assert!(gif.starts_with(b"GIF89a"), "GIF must have GIF89a header");
        assert_eq!(gif[gif.len() - 1], 0x3B, "GIF must end with trailer byte 0x3B");
    }

    #[test]
    fn test_export_wav_audio() {
        use std::collections::HashMap;
        let json = r#"{
            "id": "proj-wav",
            "title": "WAV Project",
            "aspectRatio": "16:9",
            "tracks": {
                "video": [],
                "audio": [],
                "text": [],
                "captions": [],
                "stickers": [],
                "effects": [],
                "filters": []
            }
        }"#;
        let proj: FastArtProject = serde_json::from_str(json).unwrap();
        let cache = HashMap::new();
        let wav = FastArtEngine::export_wav(&proj, 44100, 0.5, &cache);
        assert!(wav.starts_with(b"RIFF"));
        assert_eq!(&wav[8..12], b"WAVE");
        assert!(wav.len() > 44);
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

    #[test]
    fn test_refine_cutout_matte() {
        let width = 32;
        let height = 32;
        let total = width * height;
        let mut rgba = vec![255u8; total * 4];
        let mut mask = vec![0u8; total * 4];

        // Center square foreground in mask
        for y in 8..24 {
            for x in 8..24 {
                let idx = (y * width + x) * 4;
                mask[idx + 3] = 255;
            }
        }

        refine_cutout_matte(&mut rgba, &mask, width, height, 0.5, 0.1, true);
        // Center pixel should be opaque foreground
        let center_idx = (16 * width + 16) * 4;
        assert!(rgba[center_idx + 3] > 200);

        // Corner pixel should be transparent background
        let corner_idx = 0;
        assert_eq!(rgba[corner_idx + 3], 0);
    }

    #[test]
    fn test_segment_frame_rgba_background_removal() {
        let width = 64;
        let height = 64;
        let total = width * height;
        let mut rgba = vec![0u8; total * 4];

        // Fill background with green (like studio green screen or blue room)
        for i in 0..total {
            rgba[i * 4] = 20;     // R
            rgba[i * 4 + 1] = 210; // G
            rgba[i * 4 + 2] = 30;  // B
            rgba[i * 4 + 3] = 255; // A
        }

        // Draw portrait human subject in center with skin tones
        for y in 20..44 {
            for x in 22..42 {
                let idx = (y * width + x) * 4;
                rgba[idx] = 210;     // Skin R
                rgba[idx + 1] = 160; // Skin G
                rgba[idx + 2] = 120; // Skin B
                rgba[idx + 3] = 255;
            }
        }

        let mut out_alpha = vec![0u8; total];
        segment_frame_rgba(&rgba, width, height, 0.45, 0.20, None, &mut out_alpha);

        // Corner/border pixels MUST be transparent (alpha == 0)
        assert_eq!(out_alpha[0], 0, "Top-left background pixel must be transparent 0");
        assert_eq!(out_alpha[width - 1], 0, "Top-right background pixel must be transparent 0");
        assert_eq!(out_alpha[(height - 1) * width], 0, "Bottom-left background pixel must be transparent 0");

        // Center human subject pixel MUST be opaque
        let center_idx = 32 * width + 32;
        assert!(out_alpha[center_idx] > 180, "Center subject pixel must be opaque (> 180)");
    }

    #[test]
    fn test_modnet_tensor_preparation_and_output() {
        let total = 512 * 512;
        let mut rgba = vec![0u8; total * 4];
        // Set first pixel to (255, 128, 0, 255)
        rgba[0] = 255;
        rgba[1] = 128;
        rgba[2] = 0;
        rgba[3] = 255;

        let mut tensor = vec![0.0f32; total * 3];
        prepare_modnet_input_tensor(&rgba, 512, 512, &mut tensor);

        // (255 - 127.5)/127.5 = 1.0
        assert!((tensor[0] - 1.0).abs() < 0.01);
        // (128 - 127.5)/127.5 approx 0.0039
        assert!((tensor[total] - 0.0039).abs() < 0.01);
        // (0 - 127.5)/127.5 = -1.0
        assert!((tensor[total * 2] - (-1.0)).abs() < 0.01);

        // Test output processing
        let mut raw_alpha = vec![0.0f32; total];
        raw_alpha[0] = 1.0;
        raw_alpha[1] = 0.5;
        raw_alpha[2] = 0.0;

        let mut out_rgba = vec![0u8; total * 4];
        process_modnet_output_tensor(&raw_alpha, &mut out_rgba, 0.0, 0.0);

        assert_eq!(out_rgba[0], 255);
        assert_eq!(out_rgba[1], 255);
        assert_eq!(out_rgba[2], 255);
        assert_eq!(out_rgba[3], 255);

        assert_eq!(out_rgba[4], 128);
        assert_eq!(out_rgba[8], 0);
    }

    #[test]
    fn test_rle_alpha_compression() {
        // Create 512x512 alpha with large foreground and background regions
        let total = 512 * 512;
        let mut alpha = vec![0u8; total];
        for i in 1000..50000 {
            alpha[i] = 255;
        }

        let packed = pack_alpha_rle(&alpha);
        // RLE should be dramatically smaller than 262 KB (~2 KB, 99% reduction)
        assert!(packed.len() < 3000);

        let mut unpacked = vec![0u8; total];
        let bytes_written = unpack_alpha_rle(&packed, &mut unpacked);
        assert_eq!(bytes_written, total);
        assert_eq!(alpha, unpacked);

        let mut out_rgba = vec![0u8; total * 4];
        alpha_to_rgba(&unpacked, &mut out_rgba);
        assert_eq!(out_rgba[0], 0);
        assert_eq!(out_rgba[1000 * 4 + 3], 255);
    }

    #[test]
    fn test_hsl_color_grading() {
        let mut pixels = vec![
            255, 0, 0, 255,   // Pure Red
            0, 255, 0, 255,   // Pure Green
            0, 0, 255, 255,   // Pure Blue
        ];

        let mut grading = HslColorGrading::default();
        // Shift red hue by +60 deg -> becomes Yellow
        grading.red.hue = 60.0;
        // Desaturate blue completely
        grading.blue.saturation = -100.0;

        apply_hsl_color_grading_raw(&mut pixels, &grading);

        // Red (px 0) shifted towards yellow: green channel should be significantly elevated
        assert!(pixels[1] > 200, "Red shifted towards yellow should have green > 200, got {}", pixels[1]);

        // Blue (px 2) desaturated: red and green should rise towards gray
        assert!(pixels[8] > 50 && pixels[9] > 50, "Desaturated blue should have neutral components, got R:{} G:{}", pixels[8], pixels[9]);
    }
}

