use jni::objects::{JClass, JFloatArray, JString};
use jni::sys::{jboolean, jbyteArray, jfloatArray, jint, jsize, jstring, JNI_TRUE};
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


