package com.fastart

import android.util.Base64
import android.util.Log
import android.os.Build
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.io.File
import java.io.FileOutputStream

/**
 * FastArt Native Rust Bridge for Android.
 * Uses modern Expo Modules API (Kotlin DSL).
 * Loads the compiled libfastart_jni.so library if available
 * and exposes SIMD multi-threaded Rust functions directly to React Native JavaScript.
 */
class FastArtRustModule : Module() {

    @Volatile private var modnetEnvironment: OrtEnvironment? = null
    @Volatile private var modnetSession: OrtSession? = null
    @Volatile private var modnetSessionOptions: OrtSession.SessionOptions? = null
    @Volatile private var modnetInputName: String? = null
    @Volatile private var modnetOutputName: String? = null
    private val modnetInferenceLock = Any()
    private var modnetInputBuffer: FloatBuffer? = null
    private var modnetInputByteBuffer: ByteBuffer? = null
    private val videoDecoderLock = Any()
    private var videoDecoderUri: String? = null
    private var videoDecoder: MediaMetadataRetriever? = null

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
        @JvmStatic external fun nativePrepareModnetInput(rgba: ByteArray, width: Int, height: Int, output: ByteBuffer): Boolean
        @JvmStatic external fun nativeProcessModnetAlpha(raw: java.nio.FloatBuffer, width: Int, height: Int, threshold: Float, feather: Float): ByteArray
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
            initializeAcceleratedModnet(modelPath)
        }

        AsyncFunction("inferModnetRgba") Coroutine { rgbaBase64: String, width: Int, height: Int, threshold: Double, feather: Double ->
            if (!isLoaded) throw Exception("Rust native library not loaded")
            inferAcceleratedModnetRgba(rgbaBase64, width, height, threshold.toFloat(), feather.toFloat())
        }

        AsyncFunction("processVideoFrameNative") Coroutine { uri: String, clipId: String, frameIdx: Int, timeSeconds: Double, threshold: Double, feather: Double, mode: String, keyColor: String ->
            processVideoFrameNative(uri, clipId, frameIdx, timeSeconds, threshold.toFloat(), feather.toFloat(), mode, keyColor)
        }

        AsyncFunction("getVideoFrameInfo") Coroutine { uri: String ->
            getVideoFrameInfo(uri)
        }

        AsyncFunction("releaseVideoCutoutDecoder") { uri: String ->
            synchronized(videoDecoderLock) {
                if (videoDecoderUri == uri) {
                    videoDecoder?.release()
                    videoDecoder = null
                    videoDecoderUri = null
                }
            }
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

    /** Creates one long-lived ORT session, preferring NNAPI and then XNNPACK/CPU. */
    private fun initializeAcceleratedModnet(modelPath: String): String = synchronized(modnetInferenceLock) {
        if (modnetSession != null) return "ok"
        val environment = OrtEnvironment.getEnvironment()
        // Keep one logical core available to playback, React, and the OS; small
        // devices must not be forced to run inference on every core.
        val cpuThreads = (Runtime.getRuntime().availableProcessors() - 1).coerceIn(1, 6)
        val modelUri = Uri.parse(modelPath)
        val localModelPath = if (modelUri.scheme == "file") modelUri.path ?: modelPath else modelPath

        fun createSession(useNnapi: Boolean): Pair<OrtSession, OrtSession.SessionOptions> {
            val options = OrtSession.SessionOptions()
            try {
                options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
                options.setIntraOpNumThreads(cpuThreads)
                options.setInterOpNumThreads(1)
                if (useNnapi && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    options.addNnapi()
                }
                // XNNPACK handles CPU partitions when NNAPI cannot execute an op;
                // ORT's default CPU provider remains the final native provider.
                options.addXnnpack(emptyMap())
                return environment.createSession(localModelPath, options) to options
            } catch (error: Exception) {
                options.close()
                throw error
            }
        }

        val created = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) createSession(useNnapi = true)
            else createSession(useNnapi = false)
        } catch (acceleratorError: Exception) {
            Log.w(TAG, "NNAPI session unavailable; retrying with optimized native CPU", acceleratorError)
            createSession(useNnapi = false)
        }
        val session = created.first
        modnetSessionOptions = created.second
        modnetEnvironment = environment
        modnetInputName = session.inputNames.firstOrNull()
            ?: throw IllegalStateException("MODNet model has no input")
        modnetOutputName = session.outputNames.firstOrNull()
            ?: throw IllegalStateException("MODNet model has no output")
        modnetSession = session
        "ok"
    }

    /** Keeps input conversion, inference, and matte conversion on native memory. */
    private fun inferAcceleratedModnetRgba(
        rgbaBase64: String,
        width: Int,
        height: Int,
        threshold: Float,
        feather: Float,
    ): String = synchronized(modnetInferenceLock) {
        require(width > 0 && height > 0) { "Invalid frame dimensions" }
        val pixels = Math.multiplyExact(width, height)
        val rgba = Base64.decode(rgbaBase64, Base64.DEFAULT)
        require(rgba.size == Math.multiplyExact(pixels, 4)) { "Invalid RGBA frame size" }
        Base64.encodeToString(inferAlphaRgba(rgba, width, height, threshold, feather), Base64.NO_WRAP)
    }

    private fun inferAlphaRgba(rgba: ByteArray, width: Int, height: Int, threshold: Float, feather: Float): ByteArray = synchronized(modnetInferenceLock) {
        val pixels = Math.multiplyExact(width, height)
        require(rgba.size == Math.multiplyExact(pixels, 4)) { "Invalid RGBA frame size" }
        val session = modnetSession ?: throw IllegalStateException("Accelerated MODNet is not initialized")
        val environment = modnetEnvironment ?: throw IllegalStateException("ONNX Runtime is unavailable")
        val inputName = modnetInputName ?: throw IllegalStateException("MODNet input is unavailable")
        val outputName = modnetOutputName ?: throw IllegalStateException("MODNet output is unavailable")

        val planeSize = 512 * 512
        val inputBytes = modnetInputByteBuffer ?: ByteBuffer.allocateDirect(planeSize * 3 * 4)
            .order(ByteOrder.nativeOrder()).also { modnetInputByteBuffer = it }
        if (!nativePrepareModnetInput(rgba, width, height, inputBytes)) {
            throw IllegalStateException("Rust MODNet input preparation failed")
        }
        val inputBuffer = modnetInputBuffer ?: inputBytes.asFloatBuffer().also { modnetInputBuffer = it }
        inputBuffer.position(0)
        inputBuffer.limit(planeSize * 3)
        val input = OnnxTensor.createTensor(environment, inputBuffer, longArrayOf(1, 3, 512, 512))
        try {
            session.run(mapOf(inputName to input)).use { result ->
                val alphaTensor = result[outputName] as? OnnxTensor
                    ?: throw IllegalStateException("MODNet output is not a tensor")
                val outputFloats = alphaTensor.floatBuffer
                require(outputFloats.remaining() >= planeSize) { "MODNet returned an invalid matte" }
                val rawAlpha = if (outputFloats.isDirect) {
                    outputFloats
                } else {
                    // ORT may materialize output into a heap FloatBuffer on some
                    // providers. Give JNI a direct view without per-value access.
                    ByteBuffer.allocateDirect(planeSize * Float.SIZE_BYTES)
                        .order(ByteOrder.nativeOrder()).asFloatBuffer().apply {
                            put(outputFloats.duplicate().apply { position(0); limit(planeSize) })
                            position(0)
                        }
                }
                val matte = nativeProcessModnetAlpha(rawAlpha, width, height, threshold, feather)
                require(matte.size == pixels) { "Rust MODNet alpha post-processing failed" }
                matte
            }
        } finally {
            input.close()
            inputBuffer.clear()
        }
    }

    private fun processVideoFrameNative(
        uri: String,
        clipId: String,
        frameIdx: Int,
        timeSeconds: Double,
        threshold: Float,
        feather: Float,
        mode: String,
        keyColor: String,
    ): String {
        val context = appContext.reactContext ?: throw IllegalStateException("React context is unavailable")
        val retriever: MediaMetadataRetriever
        var sourceBitmap: Bitmap? = null
        var scaledBitmap: Bitmap? = null
        try {
            synchronized(videoDecoderLock) {
                if (videoDecoderUri != uri || videoDecoder == null) {
                    videoDecoder?.release()
                    val next = MediaMetadataRetriever()
                    val parsed = Uri.parse(uri)
                    if (parsed.scheme == "content" || parsed.scheme == "android.resource") {
                        next.setDataSource(context, parsed)
                    } else {
                        next.setDataSource(parsed.path ?: uri)
                    }
                    videoDecoder = next
                    videoDecoderUri = uri
                }
                retriever = videoDecoder ?: throw IllegalStateException("Video decoder could not be initialized")
            }
            synchronized(videoDecoderLock) {
                val timeUs = (timeSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong()
                val decodedBitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    val sourceWidth = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 512
                    val sourceHeight = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 512
                    val scale = minOf(1f, 512f / maxOf(sourceWidth, sourceHeight).toFloat())
                    retriever.getScaledFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST, maxOf(1, (sourceWidth * scale).toInt()), maxOf(1, (sourceHeight * scale).toInt()))
                } else {
                    retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
                } ?: throw IllegalStateException("Could not decode video frame at ${timeSeconds}s")
                sourceBitmap = decodedBitmap
            }

            val decodedBitmap = sourceBitmap ?: throw IllegalStateException("Decoded frame is unavailable")
            val maxDimension = maxOf(decodedBitmap.width, decodedBitmap.height)
            val scale = minOf(1f, 512f / maxDimension.toFloat())
            val targetWidth = maxOf(1, (decodedBitmap.width * scale).toInt())
            val targetHeight = maxOf(1, (decodedBitmap.height * scale).toInt())
            val processingBitmap = if (decodedBitmap.width == targetWidth && decodedBitmap.height == targetHeight) decodedBitmap else Bitmap.createScaledBitmap(decodedBitmap, targetWidth, targetHeight, true)
            scaledBitmap = processingBitmap
            val colors = IntArray(targetWidth * targetHeight)
            processingBitmap.getPixels(colors, 0, targetWidth, 0, 0, targetWidth, targetHeight)
            val rgba = ByteArray(colors.size * 4)
            for (i in colors.indices) {
                val color = colors[i]
                val offset = i * 4
                rgba[offset] = (color shr 16).toByte()
                rgba[offset + 1] = (color shr 8).toByte()
                rgba[offset + 2] = color.toByte()
                rgba[offset + 3] = 0xff.toByte()
            }
            val alpha = if (mode == "chroma") {
                val color = keyColor.removePrefix("#").toLong(16).toInt()
                val processed = nativeProcessChroma(
                    rgba, targetWidth, targetHeight,
                    (color shr 16) and 0xff, (color shr 8) and 0xff, color and 0xff,
                    threshold, feather, true,
                )
                ByteArray(targetWidth * targetHeight) { index -> processed[index * 4 + 3] }
            } else {
                inferAlphaRgba(rgba, targetWidth, targetHeight, threshold, feather)
            }
            val maskPixels = IntArray(alpha.size) { (alpha[it].toInt().and(0xff) shl 24) }
            val mask = Bitmap.createBitmap(maskPixels, targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
            val directory = File(context.cacheDir, "cutout")
            if (!directory.exists() && !directory.mkdirs()) throw IllegalStateException("Could not create native cutout cache")
            val safeClipId = clipId.replace(Regex("[^A-Za-z0-9_-]"), "_")
            val output = File(directory, "${safeClipId}_${frameIdx}.png")
            FileOutputStream(output).use { stream ->
                if (!mask.compress(Bitmap.CompressFormat.PNG, 100, stream)) throw IllegalStateException("Could not encode native cutout mask")
            }
            mask.recycle()
            return Uri.fromFile(output).toString()
        } finally {
            if (scaledBitmap !== sourceBitmap) scaledBitmap?.recycle()
            sourceBitmap?.recycle()
        }
    }

    private fun getVideoFrameInfo(uri: String): Map<String, Any> {
        val context = appContext.reactContext ?: throw IllegalStateException("React context is unavailable")
        val retriever = synchronized(videoDecoderLock) {
            if (videoDecoderUri != uri || videoDecoder == null) {
                videoDecoder?.release()
                val next = MediaMetadataRetriever()
                val parsed = Uri.parse(uri)
                if (parsed.scheme == "content" || parsed.scheme == "android.resource") next.setDataSource(context, parsed)
                else next.setDataSource(parsed.path ?: uri)
                videoDecoder = next
                videoDecoderUri = uri
            }
            videoDecoder ?: throw IllegalStateException("Video decoder could not be initialized")
        }
        val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0
        val frameCount = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)?.toDoubleOrNull() ?: 0.0
        } else 0.0
        val captureRate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)?.toDoubleOrNull() ?: 0.0
        val measuredRate = if (frameCount > 0.0 && durationMs > 0.0) frameCount * 1000.0 / durationMs else 0.0
        val frameRate = when {
            measuredRate in 1.0..240.0 -> measuredRate
            captureRate in 1.0..240.0 -> captureRate
            else -> throw IllegalStateException("Could not read source video frame rate")
        }
        val resolvedCount = if (frameCount > 0.0) frameCount.toLong() else kotlin.math.ceil(durationMs * frameRate / 1000.0).toLong()
        return mapOf(
            "frameRate" to frameRate,
            "frameCount" to resolvedCount,
            "duration" to durationMs / 1000.0,
        )
    }
}
