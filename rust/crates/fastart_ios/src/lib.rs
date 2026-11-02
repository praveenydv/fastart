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
pub extern "C" fn fastart_ios_generate_animation_keyframes(
    preset_ptr: *const c_char,
    category_ptr: *const c_char,
    frames: usize,
) -> *mut c_char {
    if preset_ptr.is_null() || category_ptr.is_null() {
        return CString::new("{\"frames\":[]}").unwrap().into_raw();
    }
    let Ok(preset) = (unsafe { CStr::from_ptr(preset_ptr) }).to_str() else {
        return CString::new("{\"frames\":[]}").unwrap().into_raw();
    };
    let Ok(category) = (unsafe { CStr::from_ptr(category_ptr) }).to_str() else {
        return CString::new("{\"frames\":[]}").unwrap().into_raw();
    };

    let values = fastart_core::generate_animation_keyframes(preset, category, frames.clamp(2, 240));
    let frame_values: Vec<[f32; 6]> = values
        .chunks_exact(6)
        .map(|chunk| [chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5]])
        .collect();
    let json = serde_json::json!({ "frames": frame_values }).to_string();
    CString::new(json).unwrap_or_else(|_| CString::new("{\"frames\":[]}").unwrap()).into_raw()
}

#[no_mangle]
pub extern "C" fn fastart_ios_initialize_modnet(path: *const c_char) -> bool {
    if path.is_null() { return false; }
    let Ok(path) = (unsafe { CStr::from_ptr(path) }).to_str() else { return false; };
    let Ok(local_path) = fastart_core::local_model_path(path) else { return false; };
    let Ok(bytes) = std::fs::read(local_path) else { return false; };
    fastart_core::initialize_modnet(&bytes).is_ok()
}

#[no_mangle]
pub extern "C" fn fastart_ios_infer_modnet_rgba(
    rgba_ptr: *const u8, rgba_len: usize, width: usize, height: usize,
    threshold: f32, feather: f32, out_ptr: *mut u8, out_len: usize,
) -> bool {
    if rgba_ptr.is_null() || out_ptr.is_null() { return false; }
    let rgba = unsafe { slice::from_raw_parts(rgba_ptr, rgba_len) };
    let Ok(alpha) = fastart_core::infer_modnet_rgba(rgba, width, height, threshold, feather) else { return false; };
    if out_len < alpha.len() { return false; }
    unsafe { slice::from_raw_parts_mut(out_ptr, alpha.len()).copy_from_slice(&alpha); }
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
pub extern "C" fn fastart_ios_denoise_waveform_peaks(peaks_ptr: *mut f32, count: usize) -> bool {
    if count == 0 {
        return true;
    }
    if peaks_ptr.is_null() && count != 0 {
        return false;
    }
    let peaks = unsafe { slice::from_raw_parts_mut(peaks_ptr, count) };
    fastart_core::denoise_waveform_peaks(peaks);
    true
}

#[no_mangle]
pub extern "C" fn fastart_ios_decode_audio_peaks(
    data_ptr: *const u8,
    data_len: usize,
    num_points: usize,
) -> *mut c_char {
    if data_ptr.is_null() || data_len == 0 {
        return std::ptr::null_mut();
    }
    let data = unsafe { slice::from_raw_parts(data_ptr, data_len) };
    let Some(parsed) = fastart_core::decode_media_audio_peaks(data, num_points)
        .or_else(|| fastart_core::parse_wav_peaks(data, num_points))
    else {
        return std::ptr::null_mut();
    };
    CString::new(serde_json::to_string(&parsed).unwrap_or_default())
        .map(CString::into_raw)
        .unwrap_or(std::ptr::null_mut())
}

/// Processes an RGBA frame with the shared Rust chroma-key implementation.
#[no_mangle]
pub extern "C" fn fastart_ios_process_chroma(
    rgba_ptr: *mut u8,
    rgba_len: usize,
    width: usize,
    height: usize,
    r: u8,
    g: u8,
    b: u8,
    threshold: f32,
    feather: f32,
    despill: bool,
) -> bool {
    let expected = width.saturating_mul(height).saturating_mul(4);
    if rgba_ptr.is_null() || width == 0 || height == 0 || rgba_len < expected {
        return false;
    }
    let rgba = unsafe { slice::from_raw_parts_mut(rgba_ptr, expected) };
    let params = fastart_core::ChromaKeyParams {
        key_color: (r, g, b),
        threshold,
        feather,
        despill,
    };
    fastart_core::process_chroma_key(rgba, width, height, &params);
    true
}

/// Produces an alpha matte using the shared Rust frame segmentation routine.
#[no_mangle]
pub extern "C" fn fastart_ios_segment_frame_rgba(
    rgba_ptr: *const u8,
    rgba_len: usize,
    width: usize,
    height: usize,
    threshold: f32,
    feather: f32,
    out_alpha_ptr: *mut u8,
    out_alpha_len: usize,
) -> bool {
    let pixels = width.saturating_mul(height);
    let expected_rgba = pixels.saturating_mul(4);
    if rgba_ptr.is_null()
        || out_alpha_ptr.is_null()
        || width == 0
        || height == 0
        || rgba_len < expected_rgba
        || out_alpha_len < pixels
    {
        return false;
    }
    let rgba = unsafe { slice::from_raw_parts(rgba_ptr, expected_rgba) };
    let alpha = unsafe { slice::from_raw_parts_mut(out_alpha_ptr, pixels) };
    fastart_core::segment_frame_rgba(rgba, width, height, threshold, feather, None, alpha);
    true
}

#[no_mangle]
pub extern "C" fn fastart_ios_pack_alpha_rle(
    alpha_ptr: *const u8,
    alpha_len: usize,
    out_ptr: *mut u8,
    out_capacity: usize,
) -> usize {
    if alpha_ptr.is_null() || out_ptr.is_null() || alpha_len == 0 {
        return 0;
    }
    let alpha = unsafe { slice::from_raw_parts(alpha_ptr, alpha_len) };
    let encoded = fastart_core::pack_alpha_rle(alpha);
    if encoded.len() > out_capacity {
        return 0;
    }
    unsafe {
        slice::from_raw_parts_mut(out_ptr, encoded.len()).copy_from_slice(&encoded);
    }
    encoded.len()
}

#[no_mangle]
pub extern "C" fn fastart_ios_unpack_alpha_rle(
    rle_ptr: *const u8,
    rle_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
) -> usize {
    if rle_ptr.is_null() || out_ptr.is_null() || out_len == 0 {
        return 0;
    }
    let rle = unsafe { slice::from_raw_parts(rle_ptr, rle_len) };
    let output = unsafe { slice::from_raw_parts_mut(out_ptr, out_len) };
    fastart_core::unpack_alpha_rle(rle, output)
}

#[no_mangle]
pub extern "C" fn fastart_ios_encode_rgba_png(
    rgba_ptr: *const u8,
    rgba_len: usize,
    width: usize,
    height: usize,
    out_len: *mut usize,
) -> *mut u8 {
    let expected = width.saturating_mul(height).saturating_mul(4);
    if rgba_ptr.is_null() || out_len.is_null() || width == 0 || height == 0 || rgba_len < expected {
        return std::ptr::null_mut();
    }
    let rgba = unsafe { slice::from_raw_parts(rgba_ptr, expected) };
    let mut png = fastart_core::encode_rgba_to_png(rgba, width, height);
    unsafe {
        *out_len = png.len();
    }
    let ptr = png.as_mut_ptr();
    std::mem::forget(png);
    ptr
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
    let mut png_bytes =
        FastArtEngine::render_snapshot_png(&project, time_sec, width, height, &media_cache);
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
    let mut gif_bytes =
        FastArtEngine::export_gif(&project, fps, width, height, duration, &media_cache);
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
    let mut mp4_bytes =
        FastArtEngine::export_mp4(&project, fps, width, height, duration, &media_cache);
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
    )
    .is_ok()
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
    )
    .is_ok()
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
    FastArtEngine::export_wav_file(&project, sample_rate, duration, &audio_cache, output_path)
        .is_ok()
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

    let res =
        fastart_core::evaluate_motion_track(time, clip_start, clip_duration, mode_str, intensity);
    unsafe {
        if !out_dx.is_null() {
            *out_dx = res.dx;
        }
        if !out_dy.is_null() {
            *out_dy = res.dy;
        }
        if !out_scale.is_null() {
            *out_scale = res.d_scale;
        }
        if !out_rot.is_null() {
            *out_rot = res.d_rot;
        }
    }
}
