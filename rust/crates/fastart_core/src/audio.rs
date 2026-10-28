use byteorder::{LittleEndian, WriteBytesExt};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct AudioBuffer {
    pub sample_rate: u32,
    pub channels: u16,
    pub samples: Vec<f32>, // Interleaved L, R, L, R... or mono
}

impl AudioBuffer {
    pub fn new(sample_rate: u32, channels: u16, length_frames: usize) -> Self {
        Self {
            sample_rate,
            channels,
            samples: vec![0.0; length_frames * channels as usize],
        }
    }

    pub fn duration_sec(&self) -> f64 {
        if self.sample_rate == 0 || self.channels == 0 {
            return 0.0;
        }
        (self.samples.len() / self.channels as usize) as f64 / self.sample_rate as f64
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeatDetectionOutput {
    pub bpm: f64,
    pub beats: Vec<f64>, // Timestamps in seconds
}

/// Detects beats and rhythmic energy transients from PCM audio samples
pub fn detect_audio_beats(samples: &[f32], sample_rate: u32) -> BeatDetectionOutput {
    if samples.is_empty() || sample_rate == 0 {
        return BeatDetectionOutput {
            bpm: 120.0,
            beats: Vec::new(),
        };
    }

    // Step 1: Calculate short-term energy envelope in ~20ms frames
    let hop_size = (sample_rate as usize) / 50; // 20ms
    let frame_count = samples.len() / hop_size.max(1);

    if frame_count < 10 {
        return BeatDetectionOutput {
            bpm: 120.0,
            beats: Vec::new(),
        };
    }

    let mut energies = Vec::with_capacity(frame_count);
    for f in 0..frame_count {
        let start = f * hop_size;
        let end = (start + hop_size).min(samples.len());
        let mut sum_sq = 0.0f32;
        for &s in &samples[start..end] {
            sum_sq += s * s;
        }
        energies.push(sum_sq / (end - start) as f32);
    }

    // Step 2: Spectral energy flux (positive difference / onset detection)
    let mut flux = Vec::with_capacity(frame_count);
    flux.push(0.0f32);
    for i in 1..frame_count {
        let diff = energies[i] - energies[i - 1];
        flux.push(diff.max(0.0));
    }

    // Step 3: Local adaptive thresholding to pick genuine beat peaks
    let win = 14; // ~280ms local window
    let mut beats = Vec::new();

    for i in win..(frame_count - win) {
        let current = flux[i];
        if current <= 0.0001 {
            continue;
        }

        let mut local_sum = 0.0;
        let mut is_local_max = true;
        for k in (i - win)..=(i + win) {
            local_sum += flux[k];
            if k != i && flux[k] >= current {
                is_local_max = false;
                break;
            }
        }

        let local_avg = local_sum / (win * 2 + 1) as f32;
        // Peak must exceed local average by threshold multiplier
        if is_local_max && current > local_avg * 1.35 {
            let timestamp_sec = (i * hop_size) as f64 / sample_rate as f64;
            // Prevent two beats from occurring within 220ms (max ~270 BPM)
            if beats.is_empty() || (timestamp_sec - beats[beats.len() - 1]) > 0.22 {
                beats.push((timestamp_sec * 1000.0).round() / 1000.0);
            }
        }
    }

    // Step 4: Estimate BPM from inter-beat intervals
    let mut bpm = 120.0;
    if beats.len() >= 4 {
        let mut intervals = Vec::new();
        for i in 1..beats.len() {
            let dt = beats[i] - beats[i - 1];
            if dt >= 0.25 && dt <= 1.5 {
                intervals.push(dt);
            }
        }

        if !intervals.is_empty() {
            intervals.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let median_interval = intervals[intervals.len() / 2];
            let estimated_bpm = 60.0 / median_interval;
            // Normalize into common 70-170 music range
            bpm = if estimated_bpm < 70.0 {
                estimated_bpm * 2.0
            } else if estimated_bpm > 170.0 {
                estimated_bpm * 0.5
            } else {
                estimated_bpm
            };
            bpm = (bpm * 10.0).round() / 10.0;
        }
    }

    BeatDetectionOutput { bpm, beats }
}

/// High-speed Waveform Peak Generator (calculates normalized amplitude buckets [0.0..1.0])
pub fn generate_waveform_peaks(samples: &[f32], buckets: usize) -> Vec<f32> {
    if samples.is_empty() || buckets == 0 {
        return vec![0.0; buckets];
    }

    let mut result = Vec::with_capacity(buckets);
    let step = samples.len() as f64 / buckets as f64;

    for i in 0..buckets {
        let start = (i as f64 * step) as usize;
        let end = (((i + 1) as f64 * step) as usize).min(samples.len());

        let mut max_val = 0.0f32;
        let mut sum_sq = 0.0f32;
        let count = (end - start).max(1);

        for &val in &samples[start..end] {
            let abs_val = val.abs();
            if abs_val > max_val {
                max_val = abs_val;
            }
            sum_sq += val * val;
        }

        let rms = (sum_sq / count as f32).sqrt();
        // Blend peak and RMS for a punchy visual waveform like CapCut
        let amplitude = (max_val * 0.7 + rms * 0.3).clamp(0.0, 1.0);
        result.push((amplitude * 1000.0).round() / 1000.0);
    }

    result
}

/// Applies spectral denoise transfer function to waveform peaks:
/// - Attenuates noise floor (< 0.22) smoothly down to a quiet baseline (0.02 - 0.04)
/// - Expands dynamic contrast of speech/dialogue peaks
pub fn denoise_waveform_peaks(peaks: &mut [f32]) {
    let noise_floor = 0.22f32;
    for val in peaks.iter_mut() {
        let v = *val;
        if v <= noise_floor {
            let factor = v / noise_floor;
            *val = (factor * factor * 0.05).max(0.02);
        } else {
            let above = (v - noise_floor) / (1.0 - noise_floor);
            let boosted = 0.05 + above.powf(0.85) * 0.95;
            *val = boosted.clamp(0.04, 1.0);
        }
    }
}

/// Encodes 32-bit float audio buffer into standard 16-bit PCM RIFF WAV bytes
pub fn encode_wav_16bit(buffer: &AudioBuffer) -> Vec<u8> {
    let mut out = Vec::new();
    let num_channels = buffer.channels;
    let sample_rate = buffer.sample_rate;
    let bits_per_sample = 16u16;
    let block_align = num_channels * (bits_per_sample / 8);
    let byte_rate = sample_rate * block_align as u32;
    let data_len = buffer.samples.len() * 2;
    let total_len = 36 + data_len;

    // RIFF Header
    out.extend_from_slice(b"RIFF");
    let _ = out.write_u32::<LittleEndian>(total_len as u32);
    out.extend_from_slice(b"WAVE");

    // fmt chunk
    out.extend_from_slice(b"fmt ");
    let _ = out.write_u32::<LittleEndian>(16); // Chunk size
    let _ = out.write_u16::<LittleEndian>(1);  // Audio format 1 = PCM
    let _ = out.write_u16::<LittleEndian>(num_channels);
    let _ = out.write_u32::<LittleEndian>(sample_rate);
    let _ = out.write_u32::<LittleEndian>(byte_rate);
    let _ = out.write_u16::<LittleEndian>(block_align);
    let _ = out.write_u16::<LittleEndian>(bits_per_sample);

    // data chunk
    out.extend_from_slice(b"data");
    let _ = out.write_u32::<LittleEndian>(data_len as u32);

    for &s in &buffer.samples {
        // Soft-knee limiting and clamping
        let clamped = s.clamp(-1.0, 1.0);
        let pcm = (clamped * 32767.0) as i16;
        let _ = out.write_i16::<LittleEndian>(pcm);
    }

    out
}
