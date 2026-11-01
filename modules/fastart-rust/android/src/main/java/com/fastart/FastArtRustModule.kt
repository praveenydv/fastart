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
        @JvmStatic external fun nativeRenderFrameRgba(projectJson: String, timeSec: Double, width: Int, height: Int): ByteArray
        @JvmStatic external fun nativeExportGif(projectJson: String, fps: Int, width: Int, height: Int, duration: Double): ByteArray
        @JvmStatic external fun nativeExportWav(projectJson: String, sampleRate: Int, duration: Double): ByteArray
        @JvmStatic external fun nativeExportMp4(projectJson: String, fps: Int, width: Int, height: Int, duration: Double): ByteArray

        @JvmStatic external fun nativeExportMp4File(projectJson: String, fps: Int, width: Int, height: Int, duration: Double, outputPath: String): Boolean
        @JvmStatic external fun nativeExportGifFile(projectJson: String, fps: Int, width: Int, height: Int, duration: Double, outputPath: String): Boolean
        @JvmStatic external fun nativeExportWavFile(projectJson: String, sampleRate: Int, duration: Double, outputPath: String): Boolean
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

        AsyncFunction("renderFrameRgba") Coroutine { projectJson: String, timeSec: Double, width: Int, height: Int ->
            if (!isLoaded) {
                throw Exception("Rust native library not loaded")
            }
            val bytes = nativeRenderFrameRgba(projectJson, timeSec, width, height)
            bytes.map { it.toInt() and 0xFF }
        }

        AsyncFunction("exportGif") Coroutine { projectJson: String, fps: Int, width: Int, height: Int, duration: Double, targetPath: String? ->
            if (!isLoaded) {
                throw Exception("Rust native library not loaded")
            }
            val cacheDir = appContext.reactContext?.cacheDir ?: java.io.File("/tmp")
            val destFile = if (!targetPath.isNullOrBlank()) {
                val clean = targetPath.removePrefix("file://")
                java.io.File(clean)
            } else {
                java.io.File(cacheDir, "fastart_export_${java.util.UUID.randomUUID()}.gif")
            }
            destFile.parentFile?.mkdirs()
            val ok = nativeExportGifFile(projectJson, fps, width, height, duration, destFile.absolutePath)
            if (!ok) {
                throw Exception("Failed to encode GIF in Rust native core")
            }
            destFile.absolutePath
        }

        AsyncFunction("exportWav") Coroutine { projectJson: String, sampleRate: Int, duration: Double, targetPath: String? ->
            if (!isLoaded) {
                throw Exception("Rust native library not loaded")
            }
            val cacheDir = appContext.reactContext?.cacheDir ?: java.io.File("/tmp")
            val destFile = if (!targetPath.isNullOrBlank()) {
                val clean = targetPath.removePrefix("file://")
                java.io.File(clean)
            } else {
                java.io.File(cacheDir, "fastart_export_${java.util.UUID.randomUUID()}.wav")
            }
            destFile.parentFile?.mkdirs()
            val ok = nativeExportWavFile(projectJson, sampleRate, duration, destFile.absolutePath)
            if (!ok) {
                throw Exception("Failed to mix WAV audio in Rust native core")
            }
            destFile.absolutePath
        }

        AsyncFunction("exportMp4") Coroutine { projectJson: String, fps: Int, width: Int, height: Int, duration: Double, targetPath: String? ->
            if (!isLoaded) {
                throw Exception("Rust native library not loaded")
            }
            val cacheDir = appContext.reactContext?.cacheDir ?: java.io.File("/tmp")
            val destFile = if (!targetPath.isNullOrBlank()) {
                val clean = targetPath.removePrefix("file://")
                java.io.File(clean)
            } else {
                java.io.File(cacheDir, "fastart_export_${java.util.UUID.randomUUID()}.mp4")
            }
            destFile.parentFile?.mkdirs()
            val ok = nativeExportMp4File(projectJson, fps, width, height, duration, destFile.absolutePath)
            if (!ok) {
                throw Exception("Failed to encode MP4 video in Rust native core")
            }
            destFile.absolutePath
        }
    }
}
