use std::collections::HashMap;
use std::slice;

/// Loads a MODNet ONNX model into the shared Rust inference runtime.
#[no_mangle]
pub extern "C" fn fastart_init_modnet_c(model_ptr: *const u8, model_len: usize) -> u32 {
    if model_ptr.is_null() || model_len == 0 {
        return 0;
    }
    let model = unsafe { slice::from_raw_parts(model_ptr, model_len) };
    u32::from(fastart_core::initialize_modnet(model).is_ok())
}

/// Runs Rust MODNet inference over a prepared 512x512 NCHW input tensor.
#[no_mangle]
pub extern "C" fn fastart_run_modnet_c(
    input_ptr: *const f32,
    input_len: usize,
    output_ptr: *mut f32,
    output_len: usize,
) -> u32 {
    const INPUT_LEN: usize = 3 * 512 * 512;
    const OUTPUT_LEN: usize = 512 * 512;
    if input_ptr.is_null() || output_ptr.is_null() || input_len != INPUT_LEN || output_len < OUTPUT_LEN {
        return 0;
    }
    let input = unsafe { slice::from_raw_parts(input_ptr, input_len) };
    let output = unsafe { slice::from_raw_parts_mut(output_ptr, OUTPUT_LEN) };
    u32::from(fastart_core::infer_modnet(input, output).is_ok())
}

use fastart_core::{FastArtEngine, FastArtProject};

static mut SCRATCHPAD: Option<Vec<u8>> = None;

/// Initializes or returns a persistent scratchpad buffer in WebAssembly linear memory
/// to eliminate per-call malloc/free churn and garbage collection pauses.
#[no_mangle]
pub extern "C" fn fastart_get_scratchpad(size: usize) -> *mut u8 {
    unsafe {
        if let Some(ref mut buf) = SCRATCHPAD {
            if buf.len() < size {
                buf.resize(size, 0);
            }
            buf.as_mut_ptr()
        } else {
            let initial_size = size.max(16 * 1024 * 1024); // 16MB default scratchpad
            let mut buf = vec![0u8; initial_size];
            let ptr = buf.as_mut_ptr();
            SCRATCHPAD = Some(buf);
            ptr
        }
    }
}

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

#[no_mangle]
pub extern "C" fn fastart_decode_audio_peaks_c(
    data_ptr: *const u8,
    data_len: usize,
    num_points: usize,
    out_peaks_ptr: *mut f32,
    out_capacity: usize,
    out_duration_ptr: *mut f64,
) -> usize {
    if data_ptr.is_null() || out_peaks_ptr.is_null() || out_duration_ptr.is_null() {
        return 0;
    }
    let data = unsafe { std::slice::from_raw_parts(data_ptr, data_len) };
    let Some(parsed) = fastart_core::decode_media_audio_peaks(data, num_points)
        .or_else(|| fastart_core::parse_wav_peaks(data, num_points))
    else {
        return 0;
    };
    if parsed.peaks.len() > out_capacity {
        return 0;
    }
    unsafe {
        std::slice::from_raw_parts_mut(out_peaks_ptr, parsed.peaks.len())
            .copy_from_slice(&parsed.peaks);
        *out_duration_ptr = parsed.duration;
    }
    parsed.peaks.len()
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
    let png_bytes =
        FastArtEngine::render_snapshot_png(&project, time_sec, width, height, &media_cache);
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

#[no_mangle]
pub extern "C" fn fastart_evaluate_object_track_c(
    time: f64,
    times_ptr: *const f64,
    x_ptr: *const f64,
    y_ptr: *const f64,
    scales_ptr: *const f64,
    rotations_ptr: *const f64,
    count: usize,
    anchor_time: f64,
    track_scale: u32,
    track_rotation: u32,
    camera_center: u32,
    camera_fit_to_screen: u32,
    camera_zoom: f64,
    camera_lock_center: u32,
    out_dx: *mut f64,
    out_dy: *mut f64,
    out_scale: *mut f64,
    out_rotation: *mut f64,
) -> u32 {
    if count == 0
        || times_ptr.is_null()
        || x_ptr.is_null()
        || y_ptr.is_null()
        || scales_ptr.is_null()
        || rotations_ptr.is_null()
        || out_dx.is_null()
        || out_dy.is_null()
        || out_scale.is_null()
        || out_rotation.is_null()
    {
        return 0;
    }
    let times = unsafe { std::slice::from_raw_parts(times_ptr, count) };
    let xs = unsafe { std::slice::from_raw_parts(x_ptr, count) };
    let ys = unsafe { std::slice::from_raw_parts(y_ptr, count) };
    let scales = unsafe { std::slice::from_raw_parts(scales_ptr, count) };
    let rotations = unsafe { std::slice::from_raw_parts(rotations_ptr, count) };
    let trajectory: Vec<fastart_core::TrajectoryPoint> = (0..count)
        .map(|index| fastart_core::TrajectoryPoint {
            time: times[index],
            x: xs[index],
            y: ys[index],
            scale: scales[index],
            rotation: rotations[index],
            confidence: 0.0,
            box_width: None,
            box_height: None,
        })
        .collect();
    let anchor_index = if anchor_time.is_finite() {
        times
            .iter()
            .enumerate()
            .min_by(|(_, left), (_, right)| {
                (*left - anchor_time)
                    .abs()
                    .total_cmp(&(*right - anchor_time).abs())
            })
            .map(|(index, _)| index)
            .unwrap_or(0)
    } else {
        0
    };
    let result = fastart_core::evaluate_object_track_trajectory_with_options(
        time,
        &trajectory,
        anchor_index,
        track_scale != 0,
        track_rotation != 0,
        camera_center != 0,
        camera_fit_to_screen != 0,
        camera_lock_center != 0,
        camera_zoom,
    );
    unsafe {
        *out_dx = result.dx;
        *out_dy = result.dy;
        *out_scale = result.d_scale;
        *out_rotation = result.d_rot;
    }
    1
}

/// High-Performance Chroma Keying with Despill in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_process_chroma_c(
    pixels_ptr: *mut u8,
    width: u32,
    height: u32,
    r_key: u8,
    g_key: u8,
    b_key: u8,
    threshold: f32,
    feather: f32,
    despill: u32,
) {
    if pixels_ptr.is_null() || width == 0 || height == 0 {
        return;
    }
    let total_len = (width as usize) * (height as usize) * 4;
    let pixels = unsafe { slice::from_raw_parts_mut(pixels_ptr, total_len) };
    let params = fastart_core::ChromaKeyParams {
        key_color: (r_key, g_key, b_key),
        threshold,
        feather,
        despill: despill != 0,
    };
    fastart_core::process_chroma_key(pixels, width as usize, height as usize, &params);
}

/// High-Accuracy O(N) Guided Filter Alpha Matting (backgroundremover inspired) in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_guided_filter_matting_c(
    guide_ptr: *const u8,
    mask_ptr: *const u8,
    out_ptr: *mut u8,
    width: u32,
    height: u32,
    radius: u32,
    eps: f32,
) {
    if guide_ptr.is_null() || mask_ptr.is_null() || out_ptr.is_null() || width == 0 || height == 0 {
        return;
    }
    let total_pixels = (width as usize) * (height as usize);
    let guide = unsafe { slice::from_raw_parts(guide_ptr, total_pixels * 4) };
    let mask = unsafe { slice::from_raw_parts(mask_ptr, total_pixels) };
    let out_mask = unsafe { slice::from_raw_parts_mut(out_ptr, total_pixels) };

    fastart_core::guided_filter_matting(
        guide,
        mask,
        out_mask,
        width as usize,
        height as usize,
        radius as usize,
        eps,
    );
}

/// Applies refined alpha matte to RGBA buffer in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_apply_matte_c(
    pixels_ptr: *mut u8,
    mask_ptr: *const u8,
    width: u32,
    height: u32,
    threshold: f32,
    feather: f32,
) {
    if pixels_ptr.is_null() || mask_ptr.is_null() || width == 0 || height == 0 {
        return;
    }
    let total_pixels = (width as usize) * (height as usize);
    let pixels = unsafe { slice::from_raw_parts_mut(pixels_ptr, total_pixels * 4) };
    let mask = unsafe { slice::from_raw_parts(mask_ptr, total_pixels) };

    fastart_core::apply_matte_to_buffer(
        pixels,
        mask,
        width as usize,
        height as usize,
        threshold,
        feather,
    );
}

/// Detects uniform studio backdrop color in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_detect_uniform_backdrop_c(
    pixels_ptr: *const u8,
    width: u32,
    height: u32,
    out_r: *mut u8,
    out_g: *mut u8,
    out_b: *mut u8,
) -> u32 {
    if pixels_ptr.is_null() || width < 16 || height < 16 {
        return 0;
    }
    let total_len = (width as usize) * (height as usize) * 4;
    let pixels = unsafe { slice::from_raw_parts(pixels_ptr, total_len) };

    if let Some((r, g, b)) =
        fastart_core::detect_uniform_backdrop(pixels, width as usize, height as usize)
    {
        unsafe {
            if !out_r.is_null() {
                *out_r = r;
            }
            if !out_g.is_null() {
                *out_g = g;
            }
            if !out_b.is_null() {
                *out_b = b;
            }
        }
        1
    } else {
        0
    }
}

/// Evaluates multi-point Bezier / Hermite speed curve in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_evaluate_speed_curve_c(
    points_t_ptr: *const f64,
    points_s_ptr: *const f64,
    count: usize,
    progress: f64,
) -> f64 {
    if points_t_ptr.is_null() || points_s_ptr.is_null() || count == 0 {
        return 1.0;
    }
    let t_slice = unsafe { slice::from_raw_parts(points_t_ptr, count) };
    let s_slice = unsafe { slice::from_raw_parts(points_s_ptr, count) };
    let mut points = Vec::with_capacity(count);
    for i in 0..count {
        points.push(fastart_core::SpeedCurvePoint {
            t: t_slice[i],
            s: s_slice[i],
        });
    }
    fastart_core::evaluate_speed_curve(&points, progress)
}

/// In-place Color Grading (Brightness, Contrast, Saturation) in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_apply_color_adjustments_c(
    pixels_ptr: *mut u8,
    width: u32,
    height: u32,
    brightness: f32,
    contrast: f32,
    saturation: f32,
) {
    if pixels_ptr.is_null() || width == 0 || height == 0 {
        return;
    }
    let total_bytes = (width as usize) * (height as usize) * 4;
    let pixels = unsafe { slice::from_raw_parts_mut(pixels_ptr, total_bytes) };
    fastart_core::apply_color_adjustments_raw(pixels, brightness, contrast, saturation);
}

/// In-place Vignette falloff directly in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_apply_vignette_c(
    pixels_ptr: *mut u8,
    width: u32,
    height: u32,
    intensity: f32,
    radius: f32,
) {
    if pixels_ptr.is_null() || width == 0 || height == 0 {
        return;
    }
    let total_bytes = (width as usize) * (height as usize) * 4;
    let pixels = unsafe { slice::from_raw_parts_mut(pixels_ptr, total_bytes) };
    fastart_core::apply_vignette_raw(pixels, width as usize, height as usize, intensity, radius);
}

/// Converts MediaPipe segmentation confidence into a crisp alpha matte in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_process_segmentation_confidence_c(
    pixels_ptr: *mut u8,
    width: u32,
    height: u32,
) -> u32 {
    if pixels_ptr.is_null() || width == 0 || height == 0 {
        return 0;
    }
    let total_bytes = (width as usize) * (height as usize) * 4;
    let pixels = unsafe { slice::from_raw_parts_mut(pixels_ptr, total_bytes) };
    fastart_core::process_segmentation_confidence(pixels, width as usize, height as usize)
}

/// Refines raw segmentation mask using Fast Guided Filtering in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_refine_cutout_c(
    rgba_ptr: *mut u8,
    mask_ptr: *const u8,
    width: u32,
    height: u32,
    threshold: f32,
    feather: f32,
    despill: u32,
) {
    if rgba_ptr.is_null() || mask_ptr.is_null() || width == 0 || height == 0 {
        return;
    }
    let total_bytes = (width as usize) * (height as usize) * 4;
    let rgba_pixels = unsafe { slice::from_raw_parts_mut(rgba_ptr, total_bytes) };
    let mask_pixels = unsafe { slice::from_raw_parts(mask_ptr, total_bytes) };

    fastart_core::refine_cutout_matte(
        rgba_pixels,
        mask_pixels,
        width as usize,
        height as usize,
        threshold,
        feather,
        despill != 0,
    );
}

/// Prepares a 512x512 NCHW planar Float32 tensor for neural matting (MODNet / CapCut model)
#[no_mangle]
pub extern "C" fn fastart_prepare_modnet_input_c(
    rgba_ptr: *const u8,
    width: u32,
    height: u32,
    out_tensor_ptr: *mut f32,
) -> usize {
    if rgba_ptr.is_null() || out_tensor_ptr.is_null() || width == 0 || height == 0 {
        return 0;
    }
    let total_in = (width as usize) * (height as usize) * 4;
    let rgba = unsafe { slice::from_raw_parts(rgba_ptr, total_in) };
    let out_tensor = unsafe { slice::from_raw_parts_mut(out_tensor_ptr, 512 * 512 * 3) };
    fastart_core::prepare_modnet_input_tensor(rgba, width as usize, height as usize, out_tensor);
    512 * 512 * 3
}

/// Converts raw neural model output alpha floats into packed 32-bit RGBA mask pixels
#[no_mangle]
pub extern "C" fn fastart_process_modnet_output_c(
    raw_alpha_ptr: *const f32,
    out_rgba_ptr: *mut u8,
    threshold: f32,
    feather: f32,
) -> usize {
    if raw_alpha_ptr.is_null() || out_rgba_ptr.is_null() {
        return 0;
    }
    let total_pixels = 512 * 512;
    let raw_alpha = unsafe { slice::from_raw_parts(raw_alpha_ptr, total_pixels) };
    let out_rgba = unsafe { slice::from_raw_parts_mut(out_rgba_ptr, total_pixels * 4) };
    fastart_core::process_modnet_output_tensor(raw_alpha, out_rgba, threshold, feather);
    total_pixels * 4
}

/// Compresses an 8-bit alpha buffer using Run-Length Encoding (RLE) in WebAssembly.
/// Returns the number of compressed bytes written to out_rle_ptr.
#[no_mangle]
pub extern "C" fn fastart_pack_alpha_rle_c(
    alpha_ptr: *const u8,
    len: usize,
    out_rle_ptr: *mut u8,
    max_out_len: usize,
) -> usize {
    if alpha_ptr.is_null() || out_rle_ptr.is_null() || len == 0 || max_out_len == 0 {
        return 0;
    }
    let alpha = unsafe { slice::from_raw_parts(alpha_ptr, len) };
    let packed = fastart_core::pack_alpha_rle(alpha);
    let copy_len = packed.len().min(max_out_len);
    unsafe {
        std::ptr::copy_nonoverlapping(packed.as_ptr(), out_rle_ptr, copy_len);
    }
    copy_len
}

/// Decompresses an RLE buffer into an 8-bit alpha buffer in WebAssembly.
/// Returns the number of decompressed alpha bytes written to out_alpha_ptr.
#[no_mangle]
pub extern "C" fn fastart_unpack_alpha_rle_c(
    rle_ptr: *const u8,
    rle_len: usize,
    out_alpha_ptr: *mut u8,
    max_out_len: usize,
) -> usize {
    if rle_ptr.is_null() || out_alpha_ptr.is_null() || rle_len == 0 || max_out_len == 0 {
        return 0;
    }
    let rle = unsafe { slice::from_raw_parts(rle_ptr, rle_len) };
    let out_alpha = unsafe { slice::from_raw_parts_mut(out_alpha_ptr, max_out_len) };
    fastart_core::unpack_alpha_rle(rle, out_alpha)
}

/// Applies MODNet threshold/feather and RLE compression in one Rust call.
#[no_mangle]
pub extern "C" fn fastart_modnet_alpha_to_rle_c(
    alpha_ptr: *const f32,
    alpha_len: usize,
    threshold: f32,
    feather: f32,
    out_ptr: *mut u8,
    out_capacity: usize,
) -> usize {
    if alpha_ptr.is_null() || alpha_len == 0 || out_ptr.is_null() || out_capacity == 0 {
        return 0;
    }
    let alpha = unsafe { slice::from_raw_parts(alpha_ptr, alpha_len) };
    let encoded = fastart_core::modnet_alpha_to_rle(alpha, threshold, feather);
    if encoded.len() > out_capacity {
        return 0;
    }
    unsafe {
        slice::from_raw_parts_mut(out_ptr, encoded.len()).copy_from_slice(&encoded);
    }
    encoded.len()
}

/// Expands an 8-bit alpha buffer into 32-bit RGBA mask pixels in WebAssembly.
#[no_mangle]
pub extern "C" fn fastart_alpha_to_rgba_c(
    alpha_ptr: *const u8,
    alpha_len: usize,
    out_rgba_ptr: *mut u8,
    max_out_len: usize,
) {
    if alpha_ptr.is_null()
        || out_rgba_ptr.is_null()
        || alpha_len == 0
        || max_out_len < alpha_len * 4
    {
        return;
    }
    let alpha = unsafe { slice::from_raw_parts(alpha_ptr, alpha_len) };
    let out_rgba = unsafe { slice::from_raw_parts_mut(out_rgba_ptr, max_out_len) };
    fastart_core::alpha_to_rgba(alpha, out_rgba);
}

/// End-to-end native portrait segmentation in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_segment_frame_rgba_c(
    rgba_ptr: *const u8,
    width: u32,
    height: u32,
    threshold: f32,
    feather: f32,
    seed_mask_ptr: *const u8,
    seed_mask_len: usize,
    out_alpha_ptr: *mut u8,
    max_out_len: usize,
) -> u32 {
    if rgba_ptr.is_null() || out_alpha_ptr.is_null() || width == 0 || height == 0 {
        return 0;
    }
    let total = (width * height) as usize;
    if max_out_len < total {
        return 0;
    }
    let rgba = unsafe { slice::from_raw_parts(rgba_ptr, total * 4) };
    let seed_mask = if !seed_mask_ptr.is_null() && seed_mask_len >= total {
        Some(unsafe { slice::from_raw_parts(seed_mask_ptr, total) })
    } else {
        None
    };
    let out_alpha = unsafe { slice::from_raw_parts_mut(out_alpha_ptr, total) };
    fastart_core::segment_frame_rgba(
        rgba,
        width as usize,
        height as usize,
        threshold,
        feather,
        seed_mask,
        out_alpha,
    );
    total as u32
}

/// Encodes raw RGBA pixels directly into valid PNG bytes in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_encode_rgba_png_c(
    rgba_ptr: *const u8,
    width: u32,
    height: u32,
    out_ptr: *mut u8,
    max_out_len: usize,
) -> u32 {
    if rgba_ptr.is_null() || out_ptr.is_null() || width == 0 || height == 0 {
        return 0;
    }
    let total = (width * height) as usize;
    let rgba = unsafe { slice::from_raw_parts(rgba_ptr, total * 4) };
    let png = fastart_core::encode_rgba_to_png(rgba, width as usize, height as usize);
    if png.len() > max_out_len {
        return 0;
    }
    let out = unsafe { slice::from_raw_parts_mut(out_ptr, png.len()) };
    out.copy_from_slice(&png);
    png.len() as u32
}

/// Normalized Cross-Correlation (NCC) multi-scale template matching in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_search_template_ncc_c(
    frame_ptr: *const u8,
    fw: u32,
    fh: u32,
    template_ptr: *const f32,
    dim: u32,
    t_mean: f32,
    t_std: f32,
    t_angle: f32,
    cx: f32,
    cy: f32,
    bw: f32,
    bh: f32,
    radius: f32,
    scales_ptr: *const f32,
    num_scales: u32,
    step: u32,
    out_best_x: *mut f32,
    out_best_y: *mut f32,
    out_best_scale: *mut f32,
    out_best_angle: *mut f32,
    out_best_score: *mut f32,
) {
    if frame_ptr.is_null()
        || template_ptr.is_null()
        || scales_ptr.is_null()
        || num_scales == 0
        || dim == 0
    {
        return;
    }

    let frame_len = (fw as usize) * (fh as usize) * 4;
    let frame_slice = unsafe { slice::from_raw_parts(frame_ptr, frame_len) };
    let template_slice =
        unsafe { slice::from_raw_parts(template_ptr, (dim as usize) * (dim as usize)) };
    let scales_slice = unsafe { slice::from_raw_parts(scales_ptr, num_scales as usize) };

    let (bx, by, bscale, bangle, bscore) = fastart_core::search_template_ncc(
        frame_slice,
        fw as usize,
        fh as usize,
        template_slice,
        dim as usize,
        t_mean,
        t_std,
        t_angle,
        cx,
        cy,
        bw,
        bh,
        radius,
        scales_slice,
        step as usize,
    );

    unsafe {
        if !out_best_x.is_null() {
            *out_best_x = bx;
        }
        if !out_best_y.is_null() {
            *out_best_y = by;
        }
        if !out_best_scale.is_null() {
            *out_best_scale = bscale;
        }
        if !out_best_angle.is_null() {
            *out_best_angle = bangle;
        }
        if !out_best_score.is_null() {
            *out_best_score = bscore;
        }
    }
}

/// Applies spectral denoise transfer function to waveform peaks in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_denoise_waveform_peaks_c(peaks_ptr: *mut f32, count: usize) {
    if peaks_ptr.is_null() || count == 0 {
        return;
    }
    let peaks = unsafe { slice::from_raw_parts_mut(peaks_ptr, count) };
    fastart_core::denoise_waveform_peaks(peaks);
}

/// Fast Keyframe Interpolation with Hermite easing directly in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_evaluate_keyframes_c(
    base_x: f64,
    base_y: f64,
    base_scale: f64,
    base_rotation: f64,
    base_opacity: f64,
    kf_times_ptr: *const f64,
    kf_x_ptr: *const f64,
    kf_y_ptr: *const f64,
    kf_scale_ptr: *const f64,
    kf_rot_ptr: *const f64,
    kf_opacity_ptr: *const f64,
    kf_count: usize,
    query_time: f64,
    out_x: *mut f64,
    out_y: *mut f64,
    out_scale: *mut f64,
    out_rot: *mut f64,
    out_opacity: *mut f64,
) {
    if kf_count == 0 || kf_times_ptr.is_null() {
        unsafe {
            if !out_x.is_null() {
                *out_x = base_x;
            }
            if !out_y.is_null() {
                *out_y = base_y;
            }
            if !out_scale.is_null() {
                *out_scale = base_scale;
            }
            if !out_rot.is_null() {
                *out_rot = base_rotation;
            }
            if !out_opacity.is_null() {
                *out_opacity = base_opacity;
            }
        }
        return;
    }

    let times = unsafe { slice::from_raw_parts(kf_times_ptr, kf_count) };
    let xs = unsafe { slice::from_raw_parts(kf_x_ptr, kf_count) };
    let ys = unsafe { slice::from_raw_parts(kf_y_ptr, kf_count) };
    let scales = unsafe { slice::from_raw_parts(kf_scale_ptr, kf_count) };
    let rots = unsafe { slice::from_raw_parts(kf_rot_ptr, kf_count) };
    let opacities = unsafe { slice::from_raw_parts(kf_opacity_ptr, kf_count) };

    let mut res_x = base_x;
    let mut res_y = base_y;
    let mut res_scale = base_scale;
    let mut res_rot = base_rotation;
    let mut res_opacity = base_opacity;

    if query_time <= times[0] {
        res_x = xs[0];
        res_y = ys[0];
        res_scale = scales[0];
        res_rot = rots[0];
        res_opacity = opacities[0];
    } else if query_time >= times[kf_count - 1] {
        let last = kf_count - 1;
        res_x = xs[last];
        res_y = ys[last];
        res_scale = scales[last];
        res_rot = rots[last];
        res_opacity = opacities[last];
    } else {
        for i in 0..(kf_count - 1) {
            let t1 = times[i];
            let t2 = times[i + 1];
            if query_time >= t1 && query_time <= t2 {
                let range = (t2 - t1).max(0.0001);
                let t = ((query_time - t1) / range).clamp(0.0, 1.0);
                // Hermite ease: 3t^2 - 2t^3
                let ease = t * t * (3.0 - 2.0 * t);

                res_x = xs[i] + (xs[i + 1] - xs[i]) * ease;
                res_y = ys[i] + (ys[i + 1] - ys[i]) * ease;
                res_scale = scales[i] + (scales[i + 1] - scales[i]) * ease;
                res_rot = rots[i] + (rots[i + 1] - rots[i]) * ease;
                res_opacity = opacities[i] + (opacities[i + 1] - opacities[i]) * ease;
                break;
            }
        }
    }

    unsafe {
        if !out_x.is_null() {
            *out_x = res_x;
        }
        if !out_y.is_null() {
            *out_y = res_y;
        }
        if !out_scale.is_null() {
            *out_scale = res_scale;
        }
        if !out_rot.is_null() {
            *out_rot = res_rot;
        }
        if !out_opacity.is_null() {
            *out_opacity = res_opacity;
        }
    }
}

/// Renders a single project frame at `time_sec` directly into RGBA32 linear memory
#[no_mangle]
pub extern "C" fn fastart_render_frame_rgba_c(
    project_json_ptr: *const u8,
    json_len: usize,
    time_sec: f64,
    width: u32,
    height: u32,
    out_rgba_ptr: *mut u8,
    max_out_len: usize,
) -> usize {
    if project_json_ptr.is_null() || json_len == 0 || out_rgba_ptr.is_null() || max_out_len == 0 {
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
    let fb = FastArtEngine::render_frame(&project, time_sec, width, height, &media_cache);
    let to_copy = fb.data.len().min(max_out_len);

    unsafe {
        let out_slice = slice::from_raw_parts_mut(out_rgba_ptr, to_copy);
        out_slice.copy_from_slice(&fb.data[..to_copy]);
    }

    to_copy
}

static mut LAST_EXPORT_BUFFER: Vec<u8> = Vec::new();

/// Returns pointer to the last generated export buffer in WebAssembly linear memory
#[no_mangle]
pub extern "C" fn fastart_get_export_buffer_ptr() -> *const u8 {
    unsafe {
        let ptr = std::ptr::addr_of!(LAST_EXPORT_BUFFER);
        (*ptr).as_ptr()
    }
}

/// Frees the export buffer in WebAssembly linear memory to immediately reclaim RAM
#[no_mangle]
pub extern "C" fn fastart_free_export_buffer() {
    unsafe {
        let ptr = std::ptr::addr_of_mut!(LAST_EXPORT_BUFFER);
        *ptr = Vec::new();
    }
}

/// Zero-copy, dynamically-sized GIF export into WebAssembly heap
#[no_mangle]
pub extern "C" fn fastart_export_gif_to_heap(
    project_json_ptr: *const u8,
    json_len: usize,
    fps: u32,
    width: u32,
    height: u32,
    duration: f64,
) -> usize {
    if project_json_ptr.is_null() || json_len == 0 {
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
    let bytes = FastArtEngine::export_gif(&project, fps, width, height, duration, &media_cache);
    let len = bytes.len();
    unsafe {
        LAST_EXPORT_BUFFER = bytes;
    }
    len
}

/// Zero-copy, dynamically-sized WAV master audio export into WebAssembly heap
#[no_mangle]
pub extern "C" fn fastart_export_wav_to_heap(
    project_json_ptr: *const u8,
    json_len: usize,
    sample_rate: u32,
    duration: f64,
) -> usize {
    if project_json_ptr.is_null() || json_len == 0 {
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
    let audio_cache = HashMap::new();
    let bytes = FastArtEngine::export_wav(&project, sample_rate, duration, &audio_cache);
    let len = bytes.len();
    unsafe {
        LAST_EXPORT_BUFFER = bytes;
    }
    len
}

/// Zero-copy, dynamically-sized MP4 video export into WebAssembly heap
#[no_mangle]
pub extern "C" fn fastart_export_mp4_to_heap(
    project_json_ptr: *const u8,
    json_len: usize,
    fps: u32,
    width: u32,
    height: u32,
    duration: f64,
) -> usize {
    if project_json_ptr.is_null() || json_len == 0 {
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
    let bytes = FastArtEngine::export_mp4(&project, fps, width, height, duration, &media_cache);
    let len = bytes.len();
    unsafe {
        LAST_EXPORT_BUFFER = bytes;
    }
    len
}

/// Renders project into an animated GIF directly in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_export_gif_c(
    project_json_ptr: *const u8,
    json_len: usize,
    fps: u32,
    width: u32,
    height: u32,
    duration: f64,
    out_ptr: *mut u8,
    max_out_len: usize,
) -> usize {
    if project_json_ptr.is_null() || json_len == 0 {
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
    let gif_bytes = FastArtEngine::export_gif(&project, fps, width, height, duration, &media_cache);

    if out_ptr.is_null() || max_out_len == 0 {
        return gif_bytes.len();
    }

    let to_copy = gif_bytes.len().min(max_out_len);
    unsafe {
        let out_slice = slice::from_raw_parts_mut(out_ptr, to_copy);
        out_slice.copy_from_slice(&gif_bytes[..to_copy]);
    }

    to_copy
}

/// Mixes project audio tracks and exports standard 16-bit WAV bytes in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_export_wav_c(
    project_json_ptr: *const u8,
    json_len: usize,
    sample_rate: u32,
    duration: f64,
    out_ptr: *mut u8,
    max_out_len: usize,
) -> usize {
    if project_json_ptr.is_null() || json_len == 0 {
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

    let audio_cache = HashMap::new();
    let wav_bytes = FastArtEngine::export_wav(&project, sample_rate, duration, &audio_cache);

    if out_ptr.is_null() || max_out_len == 0 {
        return wav_bytes.len();
    }

    let to_copy = wav_bytes.len().min(max_out_len);
    unsafe {
        let out_slice = slice::from_raw_parts_mut(out_ptr, to_copy);
        out_slice.copy_from_slice(&wav_bytes[..to_copy]);
    }

    to_copy
}

/// Renders and encodes standard H.264 MP4 directly in WebAssembly
#[no_mangle]
pub extern "C" fn fastart_export_mp4_c(
    project_json_ptr: *const u8,
    json_len: usize,
    fps: u32,
    width: u32,
    height: u32,
    duration: f64,
    out_ptr: *mut u8,
    max_out_len: usize,
) -> usize {
    if project_json_ptr.is_null() || json_len == 0 {
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
    let mp4_bytes = FastArtEngine::export_mp4(&project, fps, width, height, duration, &media_cache);

    if out_ptr.is_null() || max_out_len == 0 {
        return mp4_bytes.len();
    }

    let to_copy = mp4_bytes.len().min(max_out_len);
    unsafe {
        let out_slice = slice::from_raw_parts_mut(out_ptr, to_copy);
        out_slice.copy_from_slice(&mp4_bytes[..to_copy]);
    }

    to_copy
}

/// Generate animation keyframes (WASM export).
///
/// `preset_ptr` / `preset_len` – UTF-8 bytes of the preset id string (e.g. "fade_in").
/// `category_ptr` / `category_len` – UTF-8 bytes of the category ("in", "out", "loop").
/// `frames`  – number of frames to generate.
/// `out_ptr` – caller-allocated f32 buffer, length must be >= frames * 6.
///
/// Returns the number of f32 values written (frames * 6), or 0 on error.
#[no_mangle]
pub extern "C" fn fastart_generate_animation_keyframes_c(
    preset_ptr: *const u8,
    preset_len: usize,
    category_ptr: *const u8,
    category_len: usize,
    frames: usize,
    out_ptr: *mut f32,
) -> usize {
    if preset_ptr.is_null() || category_ptr.is_null() || out_ptr.is_null() || frames == 0 {
        return 0;
    }

    let preset = unsafe {
        let bytes = slice::from_raw_parts(preset_ptr, preset_len);
        match std::str::from_utf8(bytes) {
            Ok(s) => s,
            Err(_) => return 0,
        }
    };

    let category = unsafe {
        let bytes = slice::from_raw_parts(category_ptr, category_len);
        match std::str::from_utf8(bytes) {
            Ok(s) => s,
            Err(_) => return 0,
        }
    };

    let keyframes = fastart_core::generate_animation_keyframes(preset, category, frames);
    let count = keyframes.len();

    unsafe {
        let out_slice = slice::from_raw_parts_mut(out_ptr, count);
        out_slice.copy_from_slice(&keyframes);
    }

    count
}
