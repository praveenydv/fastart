use jni::objects::{JByteArray, JClass, JFloatArray, JString};
use jni::sys::{jboolean, jbyteArray, jfloat, jfloatArray, jint, jsize, jstring, JNI_TRUE};
use jni::JNIEnv;
use std::collections::HashMap;

use fastart_core::{FastArtEngine, FastArtProject};

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeInit(
    _env: JNIEnv,
    _class: JClass,
) -> jboolean {
    JNI_TRUE
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeDetectBeats(
    env: JNIEnv,
    _class: JClass,
    j_samples: JFloatArray,
    sample_rate: jint,
) -> jstring {
    let len = match env.get_array_length(&j_samples) {
        Ok(l) => l as usize,
        Err(_) => return env.new_string("{}").unwrap().into_raw(),
    };

    let mut samples = vec![0.0f32; len];
    if env.get_float_array_region(&j_samples, 0, &mut samples).is_err() {
        return env.new_string("{}").unwrap().into_raw();
    }

    let output = FastArtEngine::detect_beats(&samples, sample_rate as u32);
    let json_str = serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string());
    env.new_string(json_str).unwrap().into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeGenerateWaveform(
    env: JNIEnv,
    _class: JClass,
    j_samples: JFloatArray,
    buckets: jint,
) -> jfloatArray {
    let len = match env.get_array_length(&j_samples) {
        Ok(l) => l as usize,
        Err(_) => return env.new_float_array(0).unwrap().into_raw(),
    };

    let mut samples = vec![0.0f32; len];
    if env.get_float_array_region(&j_samples, 0, &mut samples).is_err() {
        return env.new_float_array(0).unwrap().into_raw();
    }

    let peaks = FastArtEngine::generate_waveform(&samples, buckets as usize);
    let result_array = match env.new_float_array(peaks.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_float_array(0).unwrap().into_raw(),
    };

    let _ = env.set_float_array_region(&result_array, 0, &peaks);
    result_array.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeRenderSnapshot(
    mut env: JNIEnv,
    _class: JClass,
    j_project_json: JString,
    time_sec: f64,
    width: jint,
    height: jint,
) -> jbyteArray {
    let project_str: String = match env.get_string(&j_project_json) {
        Ok(s) => s.into(),
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let project: FastArtProject = match serde_json::from_str(&project_str) {
        Ok(p) => p,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let media_cache = HashMap::new();
    let png_bytes = FastArtEngine::render_snapshot_png(
        &project,
        time_sec,
        width as u32,
        height as u32,
        &media_cache,
    );

    let j_bytes = match env.new_byte_array(png_bytes.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let signed_bytes: Vec<i8> = png_bytes.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_bytes);
    j_bytes.into_raw()
}

// Case aliases matching package com.FastArt
#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeInit(
    env: JNIEnv,
    class: JClass,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeInit(env, class)
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeDetectBeats(
    env: JNIEnv,
    class: JClass,
    j_samples: JFloatArray,
    sample_rate: jint,
) -> jstring {
    Java_com_fastart_FastArtRustBridge_nativeDetectBeats(env, class, j_samples, sample_rate)
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeGenerateWaveform(
    env: JNIEnv,
    class: JClass,
    j_samples: JFloatArray,
    buckets: jint,
) -> jfloatArray {
    Java_com_fastart_FastArtRustBridge_nativeGenerateWaveform(env, class, j_samples, buckets)
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeRenderSnapshot(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    time_sec: f64,
    width: jint,
    height: jint,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeRenderSnapshot(
        env,
        class,
        j_project_json,
        time_sec,
        width,
        height,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeRenderFrameRgba(
    mut env: JNIEnv,
    _class: JClass,
    j_project_json: JString,
    time_sec: f64,
    width: jint,
    height: jint,
) -> jbyteArray {
    let project_str: String = match env.get_string(&j_project_json) {
        Ok(s) => s.into(),
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let project: FastArtProject = match serde_json::from_str(&project_str) {
        Ok(p) => p,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let media_cache = HashMap::new();
    let fb = FastArtEngine::render_frame(
        &project,
        time_sec,
        width as u32,
        height as u32,
        &media_cache,
    );

    let j_bytes = match env.new_byte_array(fb.data.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let signed_bytes: Vec<i8> = fb.data.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_bytes);
    j_bytes.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeExportGif(
    mut env: JNIEnv,
    _class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
) -> jbyteArray {
    let project_str: String = match env.get_string(&j_project_json) {
        Ok(s) => s.into(),
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let project: FastArtProject = match serde_json::from_str(&project_str) {
        Ok(p) => p,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let media_cache = HashMap::new();
    let gif_bytes = FastArtEngine::export_gif(
        &project,
        fps as u32,
        width as u32,
        height as u32,
        duration,
        &media_cache,
    );

    let j_bytes = match env.new_byte_array(gif_bytes.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let signed_bytes: Vec<i8> = gif_bytes.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_bytes);
    j_bytes.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeExportWav(
    mut env: JNIEnv,
    _class: JClass,
    j_project_json: JString,
    sample_rate: jint,
    duration: f64,
) -> jbyteArray {
    let project_str: String = match env.get_string(&j_project_json) {
        Ok(s) => s.into(),
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let project: FastArtProject = match serde_json::from_str(&project_str) {
        Ok(p) => p,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let audio_cache = HashMap::new();
    let wav_bytes = FastArtEngine::export_wav(
        &project,
        sample_rate as u32,
        duration,
        &audio_cache,
    );

    let j_bytes = match env.new_byte_array(wav_bytes.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let signed_bytes: Vec<i8> = wav_bytes.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_bytes);
    j_bytes.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeExportMp4(
    mut env: JNIEnv,
    _class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
) -> jbyteArray {
    let project_str: String = match env.get_string(&j_project_json) {
        Ok(s) => s.into(),
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let project: FastArtProject = match serde_json::from_str(&project_str) {
        Ok(p) => p,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let media_cache = HashMap::new();
    let mp4_bytes = FastArtEngine::export_mp4(
        &project,
        fps as u32,
        width as u32,
        height as u32,
        duration,
        &media_cache,
    );

    let j_bytes = match env.new_byte_array(mp4_bytes.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };

    let signed_bytes: Vec<i8> = mp4_bytes.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_bytes);
    j_bytes.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeSegmentFrameRgba(
    env: JNIEnv,
    _class: JClass,
    j_rgba: JByteArray,
    width: jint,
    height: jint,
    threshold: jfloat,
    feather: jfloat,
) -> jbyteArray {
    let len = match env.get_array_length(&j_rgba) {
        Ok(l) => l as usize,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let mut rgba_signed = vec![0i8; len];
    if env.get_byte_array_region(&j_rgba, 0, &mut rgba_signed).is_err() {
        return env.new_byte_array(0).unwrap().into_raw();
    }
    let rgba: Vec<u8> = rgba_signed.into_iter().map(|b| b as u8).collect();

    let total = (width * height) as usize;
    let mut out_alpha = vec![0u8; total];
    fastart_core::segment_frame_rgba(
        &rgba,
        width as usize,
        height as usize,
        threshold as f32,
        feather as f32,
        None,
        &mut out_alpha,
    );

    let j_bytes = match env.new_byte_array(total as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let signed_alpha: Vec<i8> = out_alpha.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_alpha);
    j_bytes.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeProcessChroma(
    env: JNIEnv,
    _class: JClass,
    j_rgba: JByteArray,
    width: jint,
    height: jint,
    r: jint,
    g: jint,
    b: jint,
    threshold: jfloat,
    feather: jfloat,
    despill: jboolean,
) -> jbyteArray {
    let len = match env.get_array_length(&j_rgba) {
        Ok(l) => l as usize,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let mut rgba_signed = vec![0i8; len];
    if env.get_byte_array_region(&j_rgba, 0, &mut rgba_signed).is_err() {
        return env.new_byte_array(0).unwrap().into_raw();
    }
    let mut rgba: Vec<u8> = rgba_signed.into_iter().map(|b| b as u8).collect();

    let params = fastart_core::ChromaKeyParams {
        key_color: (r as u8, g as u8, b as u8),
        threshold: threshold as f32,
        feather: feather as f32,
        despill: despill == JNI_TRUE,
    };
    fastart_core::process_chroma_key(&mut rgba, width as usize, height as usize, &params);

    let j_bytes = match env.new_byte_array(rgba.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let signed_rgba: Vec<i8> = rgba.into_iter().map(|x| x as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_rgba);
    j_bytes.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativePackAlphaRLE(
    env: JNIEnv,
    _class: JClass,
    j_alpha: JByteArray,
) -> jbyteArray {
    let len = match env.get_array_length(&j_alpha) {
        Ok(l) => l as usize,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let mut alpha_signed = vec![0i8; len];
    if env.get_byte_array_region(&j_alpha, 0, &mut alpha_signed).is_err() {
        return env.new_byte_array(0).unwrap().into_raw();
    }
    let alpha: Vec<u8> = alpha_signed.into_iter().map(|b| b as u8).collect();
    let packed = fastart_core::pack_alpha_rle(&alpha);

    let j_bytes = match env.new_byte_array(packed.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let signed_packed: Vec<i8> = packed.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_packed);
    j_bytes.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeUnpackAlphaRLE(
    env: JNIEnv,
    _class: JClass,
    j_rle: JByteArray,
    out_len: jint,
) -> jbyteArray {
    let len = match env.get_array_length(&j_rle) {
        Ok(l) => l as usize,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let mut rle_signed = vec![0i8; len];
    if env.get_byte_array_region(&j_rle, 0, &mut rle_signed).is_err() {
        return env.new_byte_array(0).unwrap().into_raw();
    }
    let rle: Vec<u8> = rle_signed.into_iter().map(|b| b as u8).collect();

    let mut out_alpha = vec![0u8; out_len as usize];
    let written = fastart_core::unpack_alpha_rle(&rle, &mut out_alpha);

    let j_bytes = match env.new_byte_array(written as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let signed_out: Vec<i8> = out_alpha[..written].iter().map(|&b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_out);
    j_bytes.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeEncodeRgbaPng(
    env: JNIEnv,
    _class: JClass,
    j_rgba: JByteArray,
    width: jint,
    height: jint,
) -> jbyteArray {
    let len = match env.get_array_length(&j_rgba) {
        Ok(l) => l as usize,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let mut rgba_signed = vec![0i8; len];
    if env.get_byte_array_region(&j_rgba, 0, &mut rgba_signed).is_err() {
        return env.new_byte_array(0).unwrap().into_raw();
    }
    let rgba: Vec<u8> = rgba_signed.into_iter().map(|b| b as u8).collect();
    let png = fastart_core::encode_rgba_to_png(&rgba, width as usize, height as usize);

    let j_bytes = match env.new_byte_array(png.len() as jsize) {
        Ok(arr) => arr,
        Err(_) => return env.new_byte_array(0).unwrap().into_raw(),
    };
    let signed_png: Vec<i8> = png.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&j_bytes, 0, &signed_png);
    j_bytes.into_raw()
}


