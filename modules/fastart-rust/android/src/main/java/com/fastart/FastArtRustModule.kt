package com.fastart

import android.util.Base64
import android.util.Log
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * FastArt Native Rust Bridge for Android.
 * Uses modern Expo Modules API (Kotlin DSL).
 * Loads the compiled libfastart_jni.so library if available
 * and exposes SIMD multi-threaded Rust functions directly to React Native JavaScript.
 */
class FastArtRustModule : Module() {

    companion object {
        private const val TAG = "FastArtRust"
        var isLoaded = false
            private set

        init {
            try {
                System.loadLibrary("fastart_jni")
                isLoaded = true
                Log.i(TAG, "Successfully loaded native libfastart_jni.so")
            } catch (e: UnsatisfiedLinkError) {
                Log.w(TAG, "Native library libfastart_jni.so not present: ${e.message}")
                isLoaded = false
            }
        }

        // Native C-FFI entrypoints into libfastart_jni.so
        @JvmStatic external fun nativeInit(): Boolean
        @JvmStatic external fun nativeDetectBeats(samples: FloatArray, sampleRate: Int): String
        @JvmStatic external fun nativeGenerateWaveform(samples: FloatArray, buckets: Int): FloatArray
        @JvmStatic external fun nativeRenderSnapshot(projectJson: String, timeSec: Double, width: Int, height: Int): ByteArray
    }

    override fun definition() = ModuleDefinition {
        Name("FastArtRust")

        AsyncFunction("isAvailable") {
            isLoaded
        }

        AsyncFunction("detectBeats") Coroutine { samplesArray: List<Double>, sampleRate: Int ->
            if (!isLoaded) {
                throw Exception("Rust native library not loaded")
            }
            val floatArr = FloatArray(samplesArray.size) { samplesArray[it].toFloat() }
            nativeDetectBeats(floatArr, sampleRate)
        }

        AsyncFunction("generateWaveform") Coroutine { samplesArray: List<Double>, buckets: Int ->
            if (!isLoaded) {
                throw Exception("Rust native library not loaded")
            }
            val floatArr = FloatArray(samplesArray.size) { samplesArray[it].toFloat() }
            val peaks = nativeGenerateWaveform(floatArr, buckets)
            peaks.map { it.toDouble() }
        }

        AsyncFunction("renderSnapshot") Coroutine { projectJson: String, timeSec: Double, width: Int, height: Int ->
            if (!isLoaded) {
                throw Exception("Rust native library not loaded")
            }
            val pngBytes = nativeRenderSnapshot(projectJson, timeSec, width, height)
            val base64 = Base64.encodeToString(pngBytes, Base64.NO_WRAP)
            "data:image/png;base64,$base64"
        }
    }
}
