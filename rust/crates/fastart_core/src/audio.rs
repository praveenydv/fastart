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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WavPeaksOutput {
    pub duration: f64,
    pub peaks: Vec<f32>,
}

/// Parses PCM/IEEE-float WAV data and reduces it to normalized waveform peaks.
pub fn parse_wav_peaks(data: &[u8], num_points: usize) -> Option<WavPeaksOutput> {
    if data.len() < 44 || &data[0..4] != b"RIFF" || &data[8..12] != b"WAVE" {
        return None;
    }

    let mut offset = 12usize;
    let mut format = 0u16;
    let mut channels = 0usize;
    let mut sample_rate = 0usize;
    let mut bits = 0usize;
    let mut data_range = None;
    while offset.checked_add(8)? <= data.len() {
        let id = &data[offset..offset + 4];
        let chunk_len = u32::from_le_bytes(data[offset + 4..offset + 8].try_into().ok()?) as usize;
        let start = offset + 8;
        let end = start.checked_add(chunk_len)?.min(data.len());
        if id == b"fmt " && end >= start + 16 {
            format = u16::from_le_bytes(data[start..start + 2].try_into().ok()?);
            channels = u16::from_le_bytes(data[start + 2..start + 4].try_into().ok()?) as usize;
            sample_rate = u32::from_le_bytes(data[start + 4..start + 8].try_into().ok()?) as usize;
            bits = u16::from_le_bytes(data[start + 14..start + 16].try_into().ok()?) as usize;
        } else if id == b"data" {
            data_range = Some((start, end));
            break;
        }
        offset = start.checked_add(chunk_len + (chunk_len & 1))?;
    }

    let (data_start, data_end) = data_range?;
    if channels == 0 || sample_rate == 0 || num_points == 0 || !matches!(format, 1 | 3) {
        return None;
    }
    if !matches!((format, bits), (1, 8 | 16 | 24 | 32) | (3, 32)) {
        return None;
    }
    let bytes_per_sample = bits / 8;
    let bytes_per_frame = bytes_per_sample.checked_mul(channels)?;
    if bytes_per_frame == 0 {
        return None;
    }
    let frames = (data_end - data_start) / bytes_per_frame;
    if frames == 0 {
        return None;
    }

    let point_count = num_points.min(frames);
    let frames_per_point = (frames / point_count).max(1);
    let mut raw_peaks = vec![0.0f32; point_count];
    let mut max_peak = 0.0001f32;
    for (index, peak_out) in raw_peaks.iter_mut().enumerate() {
        let first_frame = index * frames_per_point;
        let last_frame = (first_frame + frames_per_point).min(frames);
        let sample_stride = ((last_frame - first_frame) / 32).max(1);
        let mut peak = 0.0f32;
        for frame in (first_frame..last_frame).step_by(sample_stride) {
            for channel in 0..channels {
                let at = data_start + frame * bytes_per_frame + channel * bytes_per_sample;
                let value = match (format, bits) {
                    (1, 8) => (data[at] as f32 - 128.0).abs() / 128.0,
                    (1, 16) => {
                        i16::from_le_bytes(data[at..at + 2].try_into().ok()?).unsigned_abs() as f32
                            / 32768.0
                    }
                    (1, 24) => {
                        let raw = (data[at] as i32)
                            | ((data[at + 1] as i32) << 8)
                            | ((data[at + 2] as i32) << 16);
                        let signed = (raw << 8) >> 8;
                        signed.abs() as f32 / 8_388_608.0
                    }
                    (1, 32) => {
                        i32::from_le_bytes(data[at..at + 4].try_into().ok()?).unsigned_abs() as f32
                            / 2_147_483_648.0
                    }
                    (3, 32) => f32::from_le_bytes(data[at..at + 4].try_into().ok()?).abs(),
                    _ => 0.0,
                };
                peak = peak.max(value.min(1.0));
            }
        }
        *peak_out = peak;
        max_peak = max_peak.max(peak);
    }

    let peaks = raw_peaks
        .into_iter()
        .map(|value| (value / max_peak).powf(0.78).clamp(0.04, 1.0))
        .collect();
    Some(WavPeaksOutput {
        duration: frames as f64 / sample_rate as f64,
        peaks,
    })
}

/// Demuxes and decodes supported media audio in Rust, reducing PCM to waveform buckets as it streams.
pub fn decode_media_audio_peaks(data: &[u8], num_points: usize) -> Option<WavPeaksOutput> {
    use std::io::Cursor;
    use symphonia::core::codecs::audio::AudioDecoderOptions;
    use symphonia::core::errors::Error as SymphoniaError;
    use symphonia::core::formats::probe::Hint;
    use symphonia::core::formats::{FormatOptions, TrackType};
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;

    if data.is_empty() || num_points == 0 {
        return None;
    }
    let source = Box::new(Cursor::new(data));
    let media_stream = MediaSourceStream::new(source, Default::default());
    let mut format = symphonia::default::get_probe()
        .probe(
            &Hint::new(),
            media_stream,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .ok()?;
    let track = format.default_track(TrackType::Audio)?;
    let track_id = track.id;
    let total_frames = track.num_frames.unwrap_or(0) as usize;
    let codec_params = track.codec_params.as_ref()?.clone();
    let audio_params = codec_params.audio()?.clone();
    let sample_rate = audio_params.sample_rate? as usize;
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(&audio_params, &AudioDecoderOptions::default())
        .ok()?;
    let requested_points = num_points.min(24_000).max(1);
    let target_points = if total_frames > 0 {
        let duration_points = (total_frames as f64 / sample_rate as f64 * 150.0).round() as usize;
        duration_points
            .clamp(2_400, 24_000)
            .min(requested_points)
            .min(total_frames)
    } else {
        requested_points
    };
    let frames_per_bucket = if total_frames > 0 {
        total_frames.div_ceil(target_points).max(1)
    } else {
        (sample_rate / 20).max(1)
    };

    let mut raw_peaks = Vec::with_capacity(target_points);
    let mut bucket_max = 0.0f32;
    let mut bucket_sum_squares = 0.0f64;
    let mut bucket_sample_count = 0usize;
    let mut bucket_frames = 0usize;
    let mut decoded_frames = 0usize;
    let mut max_peak = 0.0f32;

    let flush_bucket = |raw_peaks: &mut Vec<f32>,
                        bucket_max: &mut f32,
                        bucket_sum_squares: &mut f64,
                        bucket_sample_count: &mut usize,
                        bucket_frames: &mut usize,
                        max_peak: &mut f32| {
        if *bucket_frames == 0 || raw_peaks.len() >= target_points {
            return;
        }
        let rms = if *bucket_sample_count > 0 {
            (*bucket_sum_squares / *bucket_sample_count as f64).sqrt() as f32
        } else {
            0.0
        };
        let value = *bucket_max * 0.72 + rms * 0.28;
        raw_peaks.push(value);
        *max_peak = max_peak.max(value);
        *bucket_max = 0.0;
        *bucket_sum_squares = 0.0;
        *bucket_sample_count = 0;
        *bucket_frames = 0;
    };

    loop {
        let packet = match format.next_packet() {
            Ok(Some(packet)) => packet,
            Ok(None) | Err(SymphoniaError::ResetRequired) => break,
            Err(SymphoniaError::IoError(_)) => break,
            Err(_) => return None,
        };
        if packet.track_id != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(SymphoniaError::DecodeError(_)) | Err(SymphoniaError::IoError(_)) => continue,
            Err(_) => return None,
        };
        let channels = decoded.spec().channels().count().max(1);
        let frames = decoded.frames();
        let mut interleaved = vec![0.0f32; decoded.samples_interleaved()];
        decoded.copy_to_slice_interleaved(&mut interleaved);
        for frame in interleaved.chunks_exact(channels) {
            let mut frame_max = 0.0f32;
            for sample in frame {
                let sample = if sample.is_finite() { *sample } else { 0.0 };
                frame_max = frame_max.max(sample.abs());
                bucket_sum_squares += (sample as f64) * (sample as f64);
                bucket_sample_count += 1;
            }
            bucket_max = bucket_max.max(frame_max.min(1.0));
            bucket_frames += 1;
            if bucket_frames >= frames_per_bucket {
                flush_bucket(
                    &mut raw_peaks,
                    &mut bucket_max,
                    &mut bucket_sum_squares,
                    &mut bucket_sample_count,
                    &mut bucket_frames,
                    &mut max_peak,
                );
            }
        }
        decoded_frames += frames;
        if raw_peaks.len() >= target_points {
            break;
        }
    }

    flush_bucket(
        &mut raw_peaks,
        &mut bucket_max,
        &mut bucket_sum_squares,
        &mut bucket_sample_count,
        &mut bucket_frames,
        &mut max_peak,
    );
    if raw_peaks.is_empty() || max_peak <= 0.003 {
        return None;
    }
    let peaks = raw_peaks
        .into_iter()
        .map(|value| (value / max_peak).powf(0.78).clamp(0.04, 1.0))
        .collect();
    Some(WavPeaksOutput {
        duration: decoded_frames as f64 / sample_rate as f64,
        peaks,
    })
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
    let mut out = Vec::with_capacity(44 + buffer.samples.len() * 2);
    let _ = encode_wav_16bit_to_writer(&mut out, buffer);
    out
}

/// Encodes 32-bit float audio buffer directly into any std::io::Write stream
pub fn encode_wav_16bit_to_writer<W: std::io::Write>(
    writer: &mut W,
    buffer: &AudioBuffer,
) -> std::io::Result<()> {
    let num_channels = buffer.channels;
    let sample_rate = buffer.sample_rate;
    let bits_per_sample = 16u16;
    let block_align = num_channels * (bits_per_sample / 8);
    let byte_rate = sample_rate * block_align as u32;
    let data_len = buffer.samples.len() * 2;
    let total_len = 36 + data_len;

    // RIFF Header
    writer.write_all(b"RIFF")?;
    writer.write_all(&(total_len as u32).to_le_bytes())?;
    writer.write_all(b"WAVE")?;

    // fmt chunk
    writer.write_all(b"fmt ")?;
    writer.write_all(&16u32.to_le_bytes())?; // Chunk size
    writer.write_all(&1u16.to_le_bytes())?; // Audio format 1 = PCM
    writer.write_all(&num_channels.to_le_bytes())?;
    writer.write_all(&sample_rate.to_le_bytes())?;
    writer.write_all(&byte_rate.to_le_bytes())?;
    writer.write_all(&block_align.to_le_bytes())?;
    writer.write_all(&bits_per_sample.to_le_bytes())?;

    // data chunk
    writer.write_all(b"data")?;
    writer.write_all(&(data_len as u32).to_le_bytes())?;

    for &s in &buffer.samples {
        let clamped = s.clamp(-1.0, 1.0);
        let pcm = (clamped * 32767.0) as i16;
        writer.write_all(&pcm.to_le_bytes())?;
    }

    writer.flush()?;
    Ok(())
}
