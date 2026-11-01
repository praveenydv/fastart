use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::slice;

use fastart_core::{FastArtEngine, FastArtProject};

#[no_mangle]
pub extern "C" fn fastart_ios_init() -> bool {
    true
}

#[no_mangle]
pub extern "C" fn fastart_ios_detect_beats(
    samples_ptr: *const f32,
    count: usize,
    sample_rate: u32,
) -> *mut c_char {
    if samples_ptr.is_null() || count == 0 {
        return CString::new("{}").unwrap().into_raw();
    }

    let samples = unsafe { slice::from_raw_parts(samples_ptr, count) };
    let output = FastArtEngine::detect_beats(samples, sample_rate);
    let json_str = serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string());
    CString::new(json_str).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn fastart_ios_generate_waveform(
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

#[no_mangle]
pub extern "C" fn fastart_ios_render_snapshot(
    project_json_ptr: *const c_char,
    time_sec: f64,
    width: u32,
    height: u32,
    out_len: *mut usize,
) -> *mut u8 {
    if project_json_ptr.is_null() || out_len.is_null() {
        return std::ptr::null_mut();
    }

    let c_str = unsafe { CStr::from_ptr(project_json_ptr) };
    let json_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return std::ptr::null_mut(),
    };

    let media_cache = HashMap::new();
    let mut png_bytes = FastArtEngine::render_snapshot_png(&project, time_sec, width, height, &media_cache);
    let len = png_bytes.len();
    unsafe {
        *out_len = len;
    }

    let ptr = png_bytes.as_mut_ptr();
    std::mem::forget(png_bytes);
    ptr
}

#[no_mangle]
pub extern "C" fn fastart_ios_render_frame_rgba(
    project_json_ptr: *const c_char,
    time_sec: f64,
    width: u32,
    height: u32,
    out_len: *mut usize,
) -> *mut u8 {
    if project_json_ptr.is_null() || out_len.is_null() {
        return std::ptr::null_mut();
    }

    let c_str = unsafe { CStr::from_ptr(project_json_ptr) };
    let json_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return std::ptr::null_mut(),
    };

    let media_cache = HashMap::new();
    let fb = FastArtEngine::render_frame(&project, time_sec, width, height, &media_cache);
    let mut data = fb.data;
    let len = data.len();
    unsafe {
        *out_len = len;
    }

    let ptr = data.as_mut_ptr();
    std::mem::forget(data);
    ptr
}

#[no_mangle]
pub extern "C" fn fastart_ios_export_gif(
    project_json_ptr: *const c_char,
    fps: u32,
    width: u32,
    height: u32,
    duration: f64,
    out_len: *mut usize,
) -> *mut u8 {
    if project_json_ptr.is_null() || out_len.is_null() {
        return std::ptr::null_mut();
    }

    let c_str = unsafe { CStr::from_ptr(project_json_ptr) };
    let json_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return std::ptr::null_mut(),
    };

    let media_cache = HashMap::new();
    let mut gif_bytes = FastArtEngine::export_gif(&project, fps, width, height, duration, &media_cache);
    let len = gif_bytes.len();
    unsafe {
        *out_len = len;
    }

    let ptr = gif_bytes.as_mut_ptr();
    std::mem::forget(gif_bytes);
    ptr
}

#[no_mangle]
pub extern "C" fn fastart_ios_export_wav(
    project_json_ptr: *const c_char,
    sample_rate: u32,
    duration: f64,
    out_len: *mut usize,
) -> *mut u8 {
    if project_json_ptr.is_null() || out_len.is_null() {
        return std::ptr::null_mut();
    }

    let c_str = unsafe { CStr::from_ptr(project_json_ptr) };
    let json_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return std::ptr::null_mut(),
    };

    let audio_cache = HashMap::new();
    let mut wav_bytes = FastArtEngine::export_wav(&project, sample_rate, duration, &audio_cache);
    let len = wav_bytes.len();
    unsafe {
        *out_len = len;
    }

    let ptr = wav_bytes.as_mut_ptr();
    std::mem::forget(wav_bytes);
    ptr
}

#[no_mangle]
pub extern "C" fn fastart_ios_export_mp4(
    project_json_ptr: *const c_char,
    fps: u32,
    width: u32,
    height: u32,
    duration: f64,
    out_len: *mut usize,
) -> *mut u8 {
    if project_json_ptr.is_null() || out_len.is_null() {
        return std::ptr::null_mut();
    }

    let c_str = unsafe { CStr::from_ptr(project_json_ptr) };
    let json_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return std::ptr::null_mut(),
    };

    let media_cache = HashMap::new();
    let mut mp4_bytes = FastArtEngine::export_mp4(&project, fps, width, height, duration, &media_cache);
    let len = mp4_bytes.len();
    unsafe {
        *out_len = len;
    }

    let ptr = mp4_bytes.as_mut_ptr();
    std::mem::forget(mp4_bytes);
    ptr
}

#[no_mangle]
pub extern "C" fn fastart_ios_export_mp4_file(
    project_json_ptr: *const c_char,
    fps: u32,
    width: u32,
    height: u32,
    duration: f64,
    output_path_ptr: *const c_char,
) -> bool {
    if project_json_ptr.is_null() || output_path_ptr.is_null() {
        return false;
    }

    let json_str = match unsafe { CStr::from_ptr(project_json_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };
    let output_path = match unsafe { CStr::from_ptr(output_path_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return false,
    };

    let media_cache = HashMap::new();
    FastArtEngine::export_mp4_file(
        &project,
        fps,
        width,
        height,
        duration,
        &media_cache,
        output_path,
    ).is_ok()
}

#[no_mangle]
pub extern "C" fn fastart_ios_export_gif_file(
    project_json_ptr: *const c_char,
    fps: u32,
    width: u32,
    height: u32,
    duration: f64,
    output_path_ptr: *const c_char,
) -> bool {
    if project_json_ptr.is_null() || output_path_ptr.is_null() {
        return false;
    }

    let json_str = match unsafe { CStr::from_ptr(project_json_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };
    let output_path = match unsafe { CStr::from_ptr(output_path_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return false,
    };

    let media_cache = HashMap::new();
    FastArtEngine::export_gif_file(
        &project,
        fps,
        width,
        height,
        duration,
        &media_cache,
        output_path,
    ).is_ok()
}

#[no_mangle]
pub extern "C" fn fastart_ios_export_wav_file(
    project_json_ptr: *const c_char,
    sample_rate: u32,
    duration: f64,
    output_path_ptr: *const c_char,
) -> bool {
    if project_json_ptr.is_null() || output_path_ptr.is_null() {
        return false;
    }

    let json_str = match unsafe { CStr::from_ptr(project_json_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };
    let output_path = match unsafe { CStr::from_ptr(output_path_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };

    let project: FastArtProject = match serde_json::from_str(json_str) {
        Ok(p) => p,
        Err(_) => return false,
    };

    let audio_cache = HashMap::new();
    FastArtEngine::export_wav_file(
        &project,
        sample_rate,
        duration,
        &audio_cache,
        output_path,
    ).is_ok()
}

#[no_mangle]
pub extern "C" fn fastart_ios_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

#[no_mangle]
pub extern "C" fn fastart_ios_free_bytes(ptr: *mut u8, len: usize) {
    if !ptr.is_null() && len > 0 {
        unsafe {
            let _ = Vec::from_raw_parts(ptr, len, len);
        }
    }
}

#[no_mangle]
pub extern "C" fn fastart_ios_motion_track(
    time: f64,
    clip_start: f64,
    clip_duration: f64,
    mode_ptr: *const c_char,
    intensity: f64,
    out_dx: *mut f64,
    out_dy: *mut f64,
    out_scale: *mut f64,
    out_rot: *mut f64,
) {
    let mode_str = if mode_ptr.is_null() {
        "none"
    } else {
        unsafe { CStr::from_ptr(mode_ptr).to_str().unwrap_or("none") }
    };

    let res = fastart_core::evaluate_motion_track(time, clip_start, clip_duration, mode_str, intensity);
    unsafe {
        if !out_dx.is_null() { *out_dx = res.dx; }
        if !out_dy.is_null() { *out_dy = res.dy; }
        if !out_scale.is_null() { *out_scale = res.d_scale; }
        if !out_rot.is_null() { *out_rot = res.d_rot; }
    }
}

