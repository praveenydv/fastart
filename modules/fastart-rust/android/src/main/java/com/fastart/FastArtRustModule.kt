package com.fastart

import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.util.concurrent.Executors

/**
 * FastArt Native Rust Bridge for Android.
 * Loads the bare-metal compiled libfastart_jni.so library
 * and exposes SIMD multi-threaded Rust functions directly to React Native JavaScript.
 */
class FastArtRustModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val executor = Executors.newFixedThreadPool(4)

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

    override fun getName(): String = "FastArtRust"

    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(isLoaded)
    }

    @ReactMethod
    fun detectBeats(samplesArray: ReadableArray, sampleRate: Int, promise: Promise) {
        if (!isLoaded) {
            promise.reject("NATIVE_NOT_LOADED", "Rust native library not loaded")
            return
        }

        executor.execute {
            try {
                val size = samplesArray.size()
                val floatArr = FloatArray(size) { samplesArray.getDouble(it).toFloat() }
                val jsonResult = nativeDetectBeats(floatArr, sampleRate)
                promise.resolve(jsonResult)
            } catch (e: Exception) {
                promise.reject("BEAT_DETECTION_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun generateWaveform(samplesArray: ReadableArray, buckets: Int, promise: Promise) {
        if (!isLoaded) {
            promise.reject("NATIVE_NOT_LOADED", "Rust native library not loaded")
            return
        }

        executor.execute {
            try {
                val size = samplesArray.size()
                val floatArr = FloatArray(size) { samplesArray.getDouble(it).toFloat() }
                val peaks = nativeGenerateWaveform(floatArr, buckets)
                val writableArray = Arguments.createArray()
                for (peak in peaks) {
                    writableArray.pushDouble(peak.toDouble())
                }
                promise.resolve(writableArray)
            } catch (e: Exception) {
                promise.reject("WAVEFORM_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun renderSnapshot(
        projectJson: String,
        timeSec: Double,
        width: Int,
        height: Int,
        promise: Promise
    ) {
        if (!isLoaded) {
            promise.reject("NATIVE_NOT_LOADED", "Rust native library not loaded")
            return
        }

        executor.execute {
            try {
                val pngBytes = nativeRenderSnapshot(projectJson, timeSec, width, height)
                val base64 = Base64.encodeToString(pngBytes, Base64.NO_WRAP)
                promise.resolve("data:image/png;base64,$base64")
            } catch (e: Exception) {
                promise.reject("RENDER_ERROR", e.message, e)
            }
        }
    }
}
