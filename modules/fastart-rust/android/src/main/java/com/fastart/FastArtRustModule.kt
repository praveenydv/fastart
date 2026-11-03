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
        @JvmStatic external fun nativeDenoiseWaveformPeaks(peaks: FloatArray): FloatArray
        @JvmStatic external fun nativeDecodeAudioPeaks(data: ByteArray, numPoints: Int): String
        @JvmStatic external fun nativeInitializeModnet(path: String): String
        @JvmStatic external fun nativeInferModnetRgba(rgba: ByteArray, width: Int, height: Int, threshold: Float, feather: Float): ByteArray
        @JvmStatic external fun nativeSegmentFrameRgba(rgba: ByteArray, width: Int, height: Int, threshold: Float, feather: Float): ByteArray
        @JvmStatic external fun nativeGenerateAnimationKeyframes(preset: String, category: String, frames: Int): String
        @JvmStatic external fun nativeProcessChroma(rgba: ByteArray, width: Int, height: Int, r: Int, g: Int, b: Int, threshold: Float, feather: Float, despill: Boolean): ByteArray
        @JvmStatic external fun nativePackAlphaRLE(alpha: ByteArray): ByteArray
        @JvmStatic external fun nativeUnpackAlphaRLE(rle: ByteArray, outputLength: Int): ByteArray
        @JvmStatic external fun nativeEncodeRgbaPng(rgba: ByteArray, width: Int, height: Int): ByteArray
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

        AsyncFunction("generateAnimationKeyframes") Coroutine { preset: String, category: String, frames: Int ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            nativeGenerateAnimationKeyframes(preset, category, frames)
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

        AsyncFunction("denoiseWaveformPeaks") Coroutine { peaksArray: List<Double> ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            nativeDenoiseWaveformPeaks(FloatArray(peaksArray.size) { peaksArray[it].toFloat() })
                .map { it.toDouble() }
        }

        AsyncFunction("decodeAudioPeaks") Coroutine { dataBase64: String, numPoints: Int ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            val data = Base64.decode(dataBase64, Base64.DEFAULT)
            val result = nativeDecodeAudioPeaks(data, numPoints)
            // Unsupported containers/codecs and media without a decodable audio
            // stream have no waveform; return null instead of rejecting a normal
            // media probe and logging it as an application error.
            result.takeUnless { it.isBlank() }
        }

        AsyncFunction("initializeModnet") Coroutine { modelPath: String ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            nativeInitializeModnet(modelPath)
        }

        AsyncFunction("inferModnetRgba") Coroutine { rgbaBase64: String, width: Int, height: Int, threshold: Double, feather: Double ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            val rgba = Base64.decode(rgbaBase64, Base64.DEFAULT)
            Base64.encodeToString(
                nativeInferModnetRgba(rgba, width, height, threshold.toFloat(), feather.toFloat()),
                Base64.NO_WRAP,
            )
        }

        AsyncFunction("segmentFrameRgba") Coroutine { rgbaBase64: String, width: Int, height: Int, threshold: Double, feather: Double ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            if (width <= 0 || height <= 0) throw Exception("Invalid RGBA frame dimensions")
            val rgba = Base64.decode(rgbaBase64, Base64.DEFAULT)
            if (rgba.size.toLong() != width.toLong() * height.toLong() * 4L) {
                throw Exception("Invalid RGBA frame size")
            }
            Base64.encodeToString(
                nativeSegmentFrameRgba(rgba, width, height, threshold.toFloat(), feather.toFloat()),
                Base64.NO_WRAP,
            )
        }

        AsyncFunction("processChromaCutout") Coroutine { rgbaBase64: String, width: Int, height: Int, rgb: Int, threshold: Double, feather: Double, despill: Boolean ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            val bytes = Base64.decode(rgbaBase64, Base64.DEFAULT)
            val r = (rgb shr 16) and 0xFF
            val g = (rgb shr 8) and 0xFF
            val b = rgb and 0xFF
            nativeProcessChroma(bytes, width, height, r, g, b, threshold.toFloat(), feather.toFloat(), despill)
                .let { Base64.encodeToString(it, Base64.NO_WRAP) }
        }

        AsyncFunction("packAlphaRLE") Coroutine { alphaBase64: String ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            val alpha = Base64.decode(alphaBase64, Base64.DEFAULT)
            Base64.encodeToString(nativePackAlphaRLE(alpha), Base64.NO_WRAP)
        }

        AsyncFunction("unpackAlphaRLE") Coroutine { rle: List<Int>, outputLength: Int ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            nativeUnpackAlphaRLE(ByteArray(rle.size) { rle[it].toByte() }, outputLength)
                .map { it.toInt() and 0xFF }
        }

        AsyncFunction("encodeRgbaPng") Coroutine { rgbaBase64: String, width: Int, height: Int ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            val rgba = Base64.decode(rgbaBase64, Base64.DEFAULT)
            Base64.encodeToString(nativeEncodeRgbaPng(rgba, width, height), Base64.NO_WRAP)
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
