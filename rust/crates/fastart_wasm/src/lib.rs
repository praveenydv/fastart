use std::collections::HashMap;
use std::slice;

use fastart_core::{FastArtEngine, FastArtProject};

/// Memory allocator for WebAssembly linear memory
#[no_mangle]
pub extern "C" fn fastart_alloc(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// Memory deallocator for WebAssembly linear memory
#[no_mangle]
pub extern "C" fn fastart_dealloc(ptr: *mut u8, size: usize) {
    if !ptr.is_null() && size > 0 {
        unsafe {
            let _ = Vec::from_raw_parts(ptr, 0, size);
        }
    }
}

/// Detects beats from PCM float samples in WebAssembly linear memory
#[no_mangle]
pub extern "C" fn fastart_detect_beats_c(
    samples_ptr: *const f32,
    count: usize,
    sample_rate: u32,
    out_ptr: *mut u8,
    max_out_len: usize,
) -> usize {
    if samples_ptr.is_null() || count == 0 || out_ptr.is_null() || max_out_len == 0 {
        return 0;
    }

    let samples = unsafe { slice::from_raw_parts(samples_ptr, count) };
    let output = FastArtEngine::detect_beats(samples, sample_rate);
    let json_str = serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string());
    let bytes = json_str.as_bytes();
    let to_copy = bytes.len().min(max_out_len);

    unsafe {
        let out_slice = slice::from_raw_parts_mut(out_ptr, to_copy);
        out_slice.copy_from_slice(&bytes[..to_copy]);
    }

    to_copy
}

/// Generates waveform peaks into linear memory
#[no_mangle]
pub extern "C" fn fastart_generate_waveform_c(
    samples_ptr: *const f32,
    count: usize,
    buckets: usize,
    out_peaks_ptr: *mut f32,
) -> usize {
    if samples_ptr.is_null() || count == 0 || out_peaks_ptr.is_null() || buckets == 0 {
        return 0;
    }

    let samples = unsafe { slice::from_raw_parts(samples_ptr, count) };
    let peaks = FastArtEngine::generate_waveform(samples, buckets);

    unsafe {
        let out_slice = slice::from_raw_parts_mut(out_peaks_ptr, peaks.len());
        out_slice.copy_from_slice(&peaks);
    }

    peaks.len()
}

/// Renders a project frame and encodes directly to PNG bytes into WebAssembly linear memory
#[no_mangle]
pub extern "C" fn fastart_render_snapshot_c(
    project_json_ptr: *const u8,
    json_len: usize,
    time_sec: f64,
    width: u32,
    height: u32,
    out_ptr: *mut u8,
    max_out_len: usize,
) -> usize {
    if project_json_ptr.is_null() || json_len == 0 || out_ptr.is_null() || max_out_len == 0 {
        return 0;
    }

    let json_bytes = unsafe { slice::from_raw_parts(project_json_ptr, json_len) };
    let json_str = match std::str::from_utf8(json_bytes) {
        Ok(s) => s,
        Err(_) => return 0,
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return 0,
    };

    let media_cache = HashMap::new();
    let png_bytes = FastArtEngine::render_snapshot_png(&project, time_sec, width, height, &media_cache);
    let to_copy = png_bytes.len().min(max_out_len);

    unsafe {
        let out_slice = slice::from_raw_parts_mut(out_ptr, to_copy);
        out_slice.copy_from_slice(&png_bytes[..to_copy]);
    }

    to_copy
}

/// Evaluates motion tracking transform in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_motion_track_c(
    time: f64,
    clip_start: f64,
    clip_duration: f64,
    mode_idx: u32,
    intensity: f64,
    out_dx: *mut f64,
    out_dy: *mut f64,
    out_scale: *mut f64,
    out_rot: *mut f64,
) {
    let mode = match mode_idx {
        1 => "follow_center",
        2 => "cinematic_drift",
        3 => "dynamic_zoom",
        4 => "orbit_float",
        _ => "none",
    };
    let res = fastart_core::evaluate_motion_track(time, clip_start, clip_duration, mode, intensity);
    unsafe {
        if !out_dx.is_null() { *out_dx = res.dx; }
        if !out_dy.is_null() { *out_dy = res.dy; }
        if !out_scale.is_null() { *out_scale = res.d_scale; }
        if !out_rot.is_null() { *out_rot = res.d_rot; }
    }
}

