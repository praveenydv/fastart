use jni::objects::{JByteArray, JClass, JFloatArray, JString};
use jni::sys::{jboolean, jbyteArray, jfloat, jfloatArray, jint, jsize, jstring, JNI_TRUE};
use jni::JNIEnv;
use std::collections::HashMap;

use fastart_core::{FastArtEngine, FastArtProject};

fn initialize_modnet_path(mut env: JNIEnv, path: JString) -> jstring {
    let result = (|| -> Result<(), String> {
        let path: String = env.get_string(&path).map_err(|error| format!("Invalid MODNet path: {error}"))?.into();
        let model = std::fs::read(&path).map_err(|error| format!("Could not read MODNet model at {path}: {error}"))?;
        fastart_core::initialize_modnet(&model)
    })();
    let message = result.map(|_| "ok".to_string()).unwrap_or_else(|error| error);
    env.new_string(message).expect("create MODNet init result").into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeInitializeModnet(
    env: JNIEnv, _class: JClass, path: JString,
) -> jstring { initialize_modnet_path(env, path) }

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeInitializeModnet(
    env: JNIEnv, class: JClass, path: JString,
) -> jstring { Java_com_fastart_FastArtRustModule_00024Companion_nativeInitializeModnet(env, class, path) }

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeInferModnetRgba(
    env: JNIEnv, _class: JClass, j_rgba: JByteArray, width: jint, height: jint,
    threshold: jni::sys::jfloat, feather: jni::sys::jfloat,
) -> jbyteArray {
    let len = match env.get_array_length(&j_rgba) { Ok(len) => len as usize, Err(_) => return env.new_byte_array(0).unwrap().into_raw() };
    let mut signed = vec![0i8; len];
    if env.get_byte_array_region(&j_rgba, 0, &mut signed).is_err() { return env.new_byte_array(0).unwrap().into_raw(); }
    let rgba: Vec<u8> = signed.into_iter().map(|byte| byte as u8).collect();
    let Ok(alpha) = fastart_core::infer_modnet_rgba(&rgba, width.max(0) as usize, height.max(0) as usize, threshold, feather) else { return env.new_byte_array(0).unwrap().into_raw(); };
    let output = env.new_byte_array(alpha.len() as jsize).unwrap();
    let signed_alpha: Vec<i8> = alpha.into_iter().map(|byte| byte as i8).collect();
    let _ = env.set_byte_array_region(&output, 0, &signed_alpha);
    output.into_raw()
}

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
    if env
        .get_float_array_region(&j_samples, 0, &mut samples)
        .is_err()
    {
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
    if env
        .get_float_array_region(&j_samples, 0, &mut samples)
        .is_err()
    {
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
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeDecodeAudioPeaks(
    env: JNIEnv,
    _class: JClass,
    j_data: JByteArray,
    num_points: jint,
) -> jstring {
    let len = match env.get_array_length(&j_data) {
        Ok(len) => len as usize,
        Err(_) => return env.new_string("").unwrap().into_raw(),
    };
    let mut data = vec![0i8; len];
    if env.get_byte_array_region(&j_data, 0, &mut data).is_err() {
        return env.new_string("").unwrap().into_raw();
    }
    let bytes: Vec<u8> = data.into_iter().map(|byte| byte as u8).collect();
    let Some(parsed) = fastart_core::decode_media_audio_peaks(&bytes, num_points.max(1) as usize)
        .or_else(|| fastart_core::parse_wav_peaks(&bytes, num_points.max(1) as usize))
    else {
        return env.new_string("").unwrap().into_raw();
    };
    let json = serde_json::to_string(&parsed).unwrap_or_default();
    env.new_string(json).unwrap().into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeDecodeAudioPeaks(
    env: JNIEnv,
    class: JClass,
    data: JByteArray,
    num_points: jint,
) -> jstring {
    Java_com_fastart_FastArtRustBridge_nativeDecodeAudioPeaks(env, class, data, num_points)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeDecodeAudioPeaks(
    env: JNIEnv,
    class: JClass,
    data: JByteArray,
    num_points: jint,
) -> jstring {
    Java_com_fastart_FastArtRustBridge_nativeDecodeAudioPeaks(env, class, data, num_points)
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
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeRenderFrameRgba(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    time_sec: f64,
    width: jint,
    height: jint,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeRenderFrameRgba(
        env,
        class,
        j_project_json,
        time_sec,
        width,
        height,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeExportGif(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportGif(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeExportWav(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    sample_rate: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportWav(
        env,
        class,
        j_project_json,
        sample_rate,
        duration,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeExportMp4(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportMp4(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
    )
}

// Aliases for com.fastart.FastArtRustModule direct invocations
#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeDetectBeats(
    env: JNIEnv,
    class: JClass,
    samples: JFloatArray,
    sample_rate: jint,
) -> jstring {
    Java_com_fastart_FastArtRustBridge_nativeDetectBeats(env, class, samples, sample_rate)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeDetectBeats(
    env: JNIEnv,
    class: JClass,
    samples: JFloatArray,
    sample_rate: jint,
) -> jstring {
    Java_com_fastart_FastArtRustBridge_nativeDetectBeats(env, class, samples, sample_rate)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeGenerateWaveform(
    env: JNIEnv,
    class: JClass,
    samples: JFloatArray,
    buckets: jint,
) -> jfloatArray {
    Java_com_fastart_FastArtRustBridge_nativeGenerateWaveform(env, class, samples, buckets)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeGenerateWaveform(
    env: JNIEnv,
    class: JClass,
    samples: JFloatArray,
    buckets: jint,
) -> jfloatArray {
    Java_com_fastart_FastArtRustBridge_nativeGenerateWaveform(env, class, samples, buckets)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeDenoiseWaveformPeaks(
    env: JNIEnv,
    _class: JClass,
    j_peaks: JFloatArray,
) -> jfloatArray {
    let len = match env.get_array_length(&j_peaks) {
        Ok(len) => len as usize,
        Err(_) => return env.new_float_array(0).unwrap().into_raw(),
    };
    let mut peaks = vec![0.0f32; len];
    if env.get_float_array_region(&j_peaks, 0, &mut peaks).is_err() {
        return env.new_float_array(0).unwrap().into_raw();
    }
    fastart_core::denoise_waveform_peaks(&mut peaks);
    let result = match env.new_float_array(len as jsize) {
        Ok(array) => array,
        Err(_) => return env.new_float_array(0).unwrap().into_raw(),
    };
    let _ = env.set_float_array_region(&result, 0, &peaks);
    result.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeDenoiseWaveformPeaks(
    env: JNIEnv,
    class: JClass,
    peaks: JFloatArray,
) -> jfloatArray {
    Java_com_fastart_FastArtRustBridge_nativeDenoiseWaveformPeaks(env, class, peaks)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeDenoiseWaveformPeaks(
    env: JNIEnv,
    class: JClass,
    peaks: JFloatArray,
) -> jfloatArray {
    Java_com_fastart_FastArtRustBridge_nativeDenoiseWaveformPeaks(env, class, peaks)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeSegmentFrameRgba(
    env: JNIEnv,
    class: JClass,
    rgba: JByteArray,
    width: jint,
    height: jint,
    threshold: jfloat,
    feather: jfloat,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeSegmentFrameRgba(
        env, class, rgba, width, height, threshold, feather,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeSegmentFrameRgba(
    env: JNIEnv,
    class: JClass,
    rgba: JByteArray,
    width: jint,
    height: jint,
    threshold: jfloat,
    feather: jfloat,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeSegmentFrameRgba(
        env, class, rgba, width, height, threshold, feather,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeProcessChroma(
    env: JNIEnv,
    class: JClass,
    rgba: JByteArray,
    width: jint,
    height: jint,
    r: jint,
    g: jint,
    b: jint,
    threshold: jfloat,
    feather: jfloat,
    despill: jboolean,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeProcessChroma(
        env, class, rgba, width, height, r, g, b, threshold, feather, despill,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeProcessChroma(
    env: JNIEnv,
    class: JClass,
    rgba: JByteArray,
    width: jint,
    height: jint,
    r: jint,
    g: jint,
    b: jint,
    threshold: jfloat,
    feather: jfloat,
    despill: jboolean,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeProcessChroma(
        env, class, rgba, width, height, r, g, b, threshold, feather, despill,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativePackAlphaRLE(
    env: JNIEnv,
    class: JClass,
    alpha: JByteArray,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativePackAlphaRLE(env, class, alpha)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativePackAlphaRLE(
    env: JNIEnv,
    class: JClass,
    alpha: JByteArray,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativePackAlphaRLE(env, class, alpha)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeUnpackAlphaRLE(
    env: JNIEnv,
    class: JClass,
    rle: JByteArray,
    output_len: jint,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeUnpackAlphaRLE(env, class, rle, output_len)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeUnpackAlphaRLE(
    env: JNIEnv,
    class: JClass,
    rle: JByteArray,
    output_len: jint,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeUnpackAlphaRLE(env, class, rle, output_len)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeEncodeRgbaPng(
    env: JNIEnv,
    class: JClass,
    rgba: JByteArray,
    width: jint,
    height: jint,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeEncodeRgbaPng(env, class, rgba, width, height)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeEncodeRgbaPng(
    env: JNIEnv,
    class: JClass,
    rgba: JByteArray,
    width: jint,
    height: jint,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeEncodeRgbaPng(env, class, rgba, width, height)
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeRenderSnapshot(
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
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeRenderSnapshot(
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
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeRenderFrameRgba(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    time_sec: f64,
    width: jint,
    height: jint,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeRenderFrameRgba(
        env,
        class,
        j_project_json,
        time_sec,
        width,
        height,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeRenderFrameRgba(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    time_sec: f64,
    width: jint,
    height: jint,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeRenderFrameRgba(
        env,
        class,
        j_project_json,
        time_sec,
        width,
        height,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeExportGif(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportGif(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeExportGif(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportGif(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeExportWav(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    sample_rate: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportWav(
        env,
        class,
        j_project_json,
        sample_rate,
        duration,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeExportWav(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    sample_rate: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportWav(
        env,
        class,
        j_project_json,
        sample_rate,
        duration,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeExportMp4(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportMp4(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeExportMp4(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
) -> jbyteArray {
    Java_com_fastart_FastArtRustBridge_nativeExportMp4(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
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
    let wav_bytes = FastArtEngine::export_wav(&project, sample_rate as u32, duration, &audio_cache);

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
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeExportMp4File(
    mut env: JNIEnv,
    _class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    let project_str: String = match env.get_string(&j_project_json) {
        Ok(s) => s.into(),
        Err(_) => return 0,
    };
    let output_path: String = match env.get_string(&j_output_path) {
        Ok(s) => s.into(),
        Err(_) => return 0,
    };

    let project: FastArtProject = match serde_json::from_str(&project_str) {
        Ok(p) => p,
        Err(_) => return 0,
    };

    let media_cache = HashMap::new();
    match FastArtEngine::export_mp4_file(
        &project,
        fps as u32,
        width as u32,
        height as u32,
        duration,
        &media_cache,
        &output_path,
    ) {
        Ok(_) => 1,
        Err(_) => 0,
    }
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeExportGifFile(
    mut env: JNIEnv,
    _class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    let project_str: String = match env.get_string(&j_project_json) {
        Ok(s) => s.into(),
        Err(_) => return 0,
    };
    let output_path: String = match env.get_string(&j_output_path) {
        Ok(s) => s.into(),
        Err(_) => return 0,
    };

    let project: FastArtProject = match serde_json::from_str(&project_str) {
        Ok(p) => p,
        Err(_) => return 0,
    };

    let media_cache = HashMap::new();
    match FastArtEngine::export_gif_file(
        &project,
        fps as u32,
        width as u32,
        height as u32,
        duration,
        &media_cache,
        &output_path,
    ) {
        Ok(_) => 1,
        Err(_) => 0,
    }
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeExportWavFile(
    mut env: JNIEnv,
    _class: JClass,
    j_project_json: JString,
    sample_rate: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    let project_str: String = match env.get_string(&j_project_json) {
        Ok(s) => s.into(),
        Err(_) => return 0,
    };
    let output_path: String = match env.get_string(&j_output_path) {
        Ok(s) => s.into(),
        Err(_) => return 0,
    };

    let project: FastArtProject = match serde_json::from_str(&project_str) {
        Ok(p) => p,
        Err(_) => return 0,
    };

    let audio_cache = HashMap::new();
    match FastArtEngine::export_wav_file(
        &project,
        sample_rate as u32,
        duration,
        &audio_cache,
        &output_path,
    ) {
        Ok(_) => 1,
        Err(_) => 0,
    }
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeExportMp4File(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportMp4File(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
        j_output_path,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeExportMp4File(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportMp4File(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
        j_output_path,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeExportGifFile(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportGifFile(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
        j_output_path,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeExportGifFile(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportGifFile(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
        j_output_path,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeExportWavFile(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    sample_rate: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportWavFile(
        env,
        class,
        j_project_json,
        sample_rate,
        duration,
        j_output_path,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeExportWavFile(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    sample_rate: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportWavFile(
        env,
        class,
        j_project_json,
        sample_rate,
        duration,
        j_output_path,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeExportMp4File(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportMp4File(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
        j_output_path,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeExportGifFile(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    fps: jint,
    width: jint,
    height: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportGifFile(
        env,
        class,
        j_project_json,
        fps,
        width,
        height,
        duration,
        j_output_path,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeExportWavFile(
    env: JNIEnv,
    class: JClass,
    j_project_json: JString,
    sample_rate: jint,
    duration: f64,
    j_output_path: JString,
) -> jboolean {
    Java_com_fastart_FastArtRustBridge_nativeExportWavFile(
        env,
        class,
        j_project_json,
        sample_rate,
        duration,
        j_output_path,
    )
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
    if env
        .get_byte_array_region(&j_rgba, 0, &mut rgba_signed)
        .is_err()
    {
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
    if env
        .get_byte_array_region(&j_rgba, 0, &mut rgba_signed)
        .is_err()
    {
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
    if env
        .get_byte_array_region(&j_alpha, 0, &mut alpha_signed)
        .is_err()
    {
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
    if env
        .get_byte_array_region(&j_rle, 0, &mut rle_signed)
        .is_err()
    {
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
    if env
        .get_byte_array_region(&j_rgba, 0, &mut rgba_signed)
        .is_err()
    {
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

/// Generate animation keyframes from Rust.
/// Returns a JSON string: {"frames": [[opacity,scaleX,scaleY,translateX,translateY,rotation], ...]}
#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustBridge_nativeGenerateAnimationKeyframes(
    mut env: JNIEnv,
    _class: JClass,
    j_preset: JString,
    j_category: JString,
    frames: jint,
) -> jstring {
    let fallback = env.new_string("{}").unwrap().into_raw();
    let preset: String = match env.get_string(&j_preset) {
        Ok(v) => v.into(),
        Err(_) => return fallback,
    };
    let category: String = match env.get_string(&j_category) {
        Ok(v) => v.into(),
        Err(_) => return fallback,
    };
    let n = frames.max(2) as usize;
    let flat = fastart_core::generate_animation_keyframes(&preset, &category, n);
    // Serialise as JSON array of 6-element arrays for easy JS consumption
    let mut json = String::from("{\"frames\":[");
    for chunk in flat.chunks(6) {
        if chunk.len() < 6 { break; }
        json.push('[');
        for (i, v) in chunk.iter().enumerate() {
            if i > 0 { json.push(','); }
            // 4 decimal places is plenty for animation
            json.push_str(&format!("{:.4}", v));
        }
        json.push(']');
        json.push(',');
    }
    if json.ends_with(',') { json.pop(); }
    json.push_str("]}");
    env.new_string(json).unwrap_or_else(|_| env.new_string("{}").unwrap()).into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_00024Companion_nativeGenerateAnimationKeyframes(
    env: JNIEnv,
    class: JClass,
    preset: JString,
    category: JString,
    frames: jint,
) -> jstring {
    Java_com_fastart_FastArtRustBridge_nativeGenerateAnimationKeyframes(
        env, class, preset, category, frames,
    )
}

#[no_mangle]
pub extern "system" fn Java_com_fastart_FastArtRustModule_nativeGenerateAnimationKeyframes(
    env: JNIEnv,
    class: JClass,
    preset: JString,
    category: JString,
    frames: jint,
) -> jstring {
    Java_com_fastart_FastArtRustModule_00024Companion_nativeGenerateAnimationKeyframes(
        env, class, preset, category, frames,
    )
}

// Alias under the alternative package prefix used elsewhere in this codebase
#[no_mangle]
pub extern "system" fn Java_com_FastArt_FastArtRustBridge_nativeGenerateAnimationKeyframes(
    env: JNIEnv,
    class: JClass,
    j_preset: JString,
    j_category: JString,
    frames: jint,
) -> jstring {
    Java_com_fastart_FastArtRustBridge_nativeGenerateAnimationKeyframes(env, class, j_preset, j_category, frames)
}
