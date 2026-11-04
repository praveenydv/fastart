package com.fastart

import android.content.Context
import android.util.Base64
import android.util.Log
import android.os.Build
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OnnxValue
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
import java.io.BufferedOutputStream

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
    @Volatile private var modnetModelWidth: Int = 256
    @Volatile private var modnetModelHeight: Int = 256
    private val modnetInferenceLock = Any()
    private var modnetInputBuffer: FloatBuffer? = null
    private var modnetInputByteBuffer: ByteBuffer? = null
    private val videoDecoderLock = Any()
    private var videoDecoderUri: String? = null
    private var videoDecoder: MediaMetadataRetriever? = null
    private var videoDecoderWidth: Int = 512
    private var videoDecoderHeight: Int = 512

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

        AsyncFunction("sampleVideoPixel") Coroutine { uri: String, timeSeconds: Double, normX: Double, normY: Double ->
            sampleVideoPixelNative(uri, timeSeconds, normX.toFloat(), normY.toFloat())
        }

        AsyncFunction("detectBackdropColor") Coroutine { uri: String, timeSeconds: Double ->
            detectBackdropColorNative(uri, timeSeconds)
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

    private fun getCutoutDirectory(context: Context): File {
        val directory = File(context.cacheDir, "cutout")
        if (!directory.exists()) {
            directory.mkdirs()
        }
        return directory
    }

    private fun unwrapOnnxValue(value: Any?): OnnxValue? {
        if (value == null) return null
        if (value is java.util.Optional<*>) {
            return if (value.isPresent) value.get() as? OnnxValue else null
        }
        return value as? OnnxValue
    }

    /** Creates one long-lived ORT session, preferring NNAPI and then XNNPACK/CPU. */
    private fun initializeAcceleratedModnet(modelPath: String): String = synchronized(modnetInferenceLock) {
        if (modnetSession != null) return "ok"
        val environment = OrtEnvironment.getEnvironment()
        // Keep one logical core available to playback, React, and the OS; small
        // devices must not be forced to run inference on every core.
        val cpuThreads = (Runtime.getRuntime().availableProcessors() - 1).coerceIn(1, 6)
        val context = appContext.reactContext
        val cleanModelPath = if (modelPath.startsWith("file://")) modelPath.removePrefix("file://") else modelPath
        val resolvedPath = if (cleanModelPath.isNotBlank() && File(cleanModelPath).exists()) {
            cleanModelPath
        } else {
            // Check bundled asset: models/selfie_segmentation.onnx (462 KB ultra-fast offline AI model)
            val cachedAsset = File(context?.cacheDir, "fastart-selfie-bundled.onnx")
            if (context != null && (!cachedAsset.exists() || cachedAsset.length() < 400_000)) {
                try {
                    context.assets.open("models/selfie_segmentation.onnx").use { input ->
                        FileOutputStream(cachedAsset).use { output ->
                            input.copyTo(output)
                        }
                    }
                } catch (assetErr: Exception) {
                    Log.w(TAG, "Bundled asset model not accessible: ${assetErr.message}")
                }
            }
            if (cachedAsset.exists() && cachedAsset.length() >= 400_000) {
                cachedAsset.absolutePath
            } else {
                cleanModelPath
            }
        }
        val localModelPath = resolvedPath

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
        val inputName = session.inputNames.firstOrNull()
            ?: throw IllegalStateException("Model has no input")
        val outputName = session.outputNames.firstOrNull()
            ?: throw IllegalStateException("Model has no output")
        modnetInputName = inputName
        modnetOutputName = outputName

        try {
            val inputInfo = session.inputInfo[inputName]?.info as? ai.onnxruntime.TensorInfo
            val shape = inputInfo?.shape
            if (shape != null && shape.size >= 4) {
                if (shape[3] > 0) modnetModelWidth = shape[3].toInt()
                if (shape[2] > 0) modnetModelHeight = shape[2].toInt()
            }
        } catch (_: Exception) {}
        Log.i(TAG, "Initialized AI cutout session: input=$inputName [1, 3, $modnetModelHeight, $modnetModelWidth], output=$outputName")
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
        if (modnetSession == null) {
            initializeAcceleratedModnet("")
        }
        val session = modnetSession ?: throw IllegalStateException("Accelerated AI cutout is not initialized")
        val environment = modnetEnvironment ?: throw IllegalStateException("ONNX Runtime is unavailable")
        val inputName = modnetInputName ?: throw IllegalStateException("AI cutout input is unavailable")
        val outputName = modnetOutputName ?: throw IllegalStateException("AI cutout output is unavailable")

        val mWidth = modnetModelWidth
        val mHeight = modnetModelHeight
        val planeSize = mWidth * mHeight
        val inputBytes = modnetInputByteBuffer?.takeIf { it.capacity() >= planeSize * 3 * 4 }
            ?: ByteBuffer.allocateDirect(planeSize * 3 * 4)
                .order(ByteOrder.nativeOrder()).also { modnetInputByteBuffer = it }
        inputBytes.position(0)
        val inputBuffer = inputBytes.asFloatBuffer()

        if (mWidth == 512 && mHeight == 512 && width == 512 && height == 512) {
            if (!nativePrepareModnetInput(rgba, width, height, inputBytes)) {
                throw IllegalStateException("Rust MODNet input preparation failed")
            }
        } else {
            // Ultra-fast contiguous FloatArray sampling: R / 255f, G / 255f, B / 255f with single bulk native transfer
            val inputFloats = FloatArray(planeSize * 3)
            val inv255 = 1.0f / 255.0f
            val scaleX = width.toFloat() / mWidth.toFloat()
            val scaleY = height.toFloat() / mHeight.toFloat()
            val gOffset = planeSize
            val bOffset = planeSize * 2
            var dIdx = 0
            for (y in 0 until mHeight) {
                val sy = (y * scaleY).toInt().coerceIn(0, height - 1)
                val srcRow = sy * width * 4
                for (x in 0 until mWidth) {
                    val sx = (x * scaleX).toInt().coerceIn(0, width - 1)
                    val sIdx = srcRow + (sx shl 2)
                    inputFloats[dIdx] = (rgba[sIdx].toInt() and 0xFF) * inv255
                    inputFloats[gOffset + dIdx] = (rgba[sIdx + 1].toInt() and 0xFF) * inv255
                    inputFloats[bOffset + dIdx] = (rgba[sIdx + 2].toInt() and 0xFF) * inv255
                    dIdx++
                }
            }
            inputBuffer.position(0)
            inputBuffer.put(inputFloats)
        }
        inputBuffer.position(0)
        inputBuffer.limit(planeSize * 3)
        val input = OnnxTensor.createTensor(environment, inputBuffer, longArrayOf(1, 3, mHeight.toLong(), mWidth.toLong()))
        try {
            session.run(mapOf(inputName to input)).use { result ->
                var alphaTensor: OnnxTensor? = null

                // 1. Direct iterator extraction (safest in ONNX Runtime Java, bypasses any Optional wrapping)
                for (entry in result) {
                    val value = entry.value
                    if (value is OnnxTensor) {
                        alphaTensor = value
                        break
                    }
                }

                // 2. Direct index access
                if (alphaTensor == null && result.size() > 0) {
                    try {
                        val first = result.get(0)
                        if (first is OnnxTensor) {
                            alphaTensor = first
                        }
                    } catch (_: Exception) {}
                }

                // 3. Fallback: Lookup by output name unwrapping Optional
                if (alphaTensor == null) {
                    try {
                        val opt = result.get(outputName)
                        val unwrapped = unwrapOnnxValue(opt)
                        if (unwrapped is OnnxTensor) {
                            alphaTensor = unwrapped
                        }
                    } catch (_: Exception) {}
                }

                // 4. If no tensor could be extracted, throw error - NEVER fall back to chroma!
                if (alphaTensor == null) {
                    throw IllegalStateException("AI cutout neural model did not produce an output tensor")
                }

                val outputFloats = alphaTensor.floatBuffer
                outputFloats.position(0)
                require(outputFloats.remaining() >= planeSize) { "Model returned an invalid matte" }

                val thresh = threshold.coerceIn(0f, 1f)
                val soft = feather.coerceIn(0f, 1f).coerceAtLeast(0.01f)
                val invSoft = 1.0f / soft

                if (mWidth == 512 && mHeight == 512 && width == 512 && height == 512) {
                    val rawAlpha = if (outputFloats.isDirect) {
                        outputFloats
                    } else {
                        ByteBuffer.allocateDirect(planeSize * Float.SIZE_BYTES)
                            .order(ByteOrder.nativeOrder()).asFloatBuffer().apply {
                                put(outputFloats.duplicate().apply { position(0); limit(planeSize) })
                                position(0)
                            }
                    }
                    val matte = nativeProcessModnetAlpha(rawAlpha, width, height, threshold, feather)
                    if (matte.size == pixels) return matte
                }

                val rawFloats = FloatArray(planeSize)
                outputFloats.get(rawFloats)
                val alpha = ByteArray(width * height)
                if (width == mWidth && height == mHeight) {
                    for (i in 0 until planeSize) {
                        val v = rawFloats[i]
                        val a = if (v <= thresh) 0f
                                else if (v >= thresh + soft) 1f
                                else (v - thresh) * invSoft
                        alpha[i] = (a.coerceIn(0f, 1f) * 255f).toInt().toByte()
                    }
                } else {
                    val scaleX = mWidth.toFloat() / width.toFloat()
                    val scaleY = mHeight.toFloat() / height.toFloat()
                    for (y in 0 until height) {
                        val my = (y * scaleY).toInt().coerceIn(0, mHeight - 1)
                        val srcRow = my * mWidth
                        val dstRow = y * width
                        for (x in 0 until width) {
                            val mx = (x * scaleX).toInt().coerceIn(0, mWidth - 1)
                            val v = rawFloats[srcRow + mx]
                            val a = if (v <= thresh) 0f
                                    else if (v >= thresh + soft) 1f
                                    else (v - thresh) * invSoft
                            alpha[dstRow + x] = (a.coerceIn(0f, 1f) * 255f).toInt().toByte()
                        }
                    }
                }
                alpha
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
        val directory = getCutoutDirectory(context)
        val safeClipId = clipId.replace(Regex("[^A-Za-z0-9_-]"), "_")
        val output = File(directory, "${safeClipId}_${frameIdx}.png")
        if (output.exists() && output.length() > 0) {
            return Uri.fromFile(output).toString()
        }
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
                    videoDecoderWidth = next.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 512
                    videoDecoderHeight = next.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 512
                    videoDecoder = next
                    videoDecoderUri = uri
                }
                retriever = videoDecoder ?: throw IllegalStateException("Video decoder could not be initialized")
            }
            synchronized(videoDecoderLock) {
                val timeUs = (timeSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong()
                val decodedBitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    val maxDim = maxOf(modnetModelWidth, modnetModelHeight)
                    val scale = minOf(1f, maxDim.toFloat() / maxOf(videoDecoderWidth, videoDecoderHeight).toFloat())
                    val targetScaledW = maxOf(1, (videoDecoderWidth * scale).toInt())
                    val targetScaledH = maxOf(1, (videoDecoderHeight * scale).toInt())
                    retriever.getScaledFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST, targetScaledW, targetScaledH)
                        ?: retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
                } else {
                    retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
                } ?: throw IllegalStateException("Could not decode video frame at ${timeSeconds}s")
                sourceBitmap = decodedBitmap
            }

            val decodedBitmap = sourceBitmap ?: throw IllegalStateException("Decoded frame is unavailable")
            val maxDimension = maxOf(decodedBitmap.width, decodedBitmap.height)
            val maxModelDim = maxOf(modnetModelWidth, modnetModelHeight)
            val scale = minOf(1f, maxModelDim.toFloat() / maxDimension.toFloat())
            val targetWidth = maxOf(1, (decodedBitmap.width * scale).toInt())
            val targetHeight = maxOf(1, (decodedBitmap.height * scale).toInt())
            val processingBitmap = if (decodedBitmap.width == targetWidth && decodedBitmap.height == targetHeight) decodedBitmap else Bitmap.createScaledBitmap(decodedBitmap, targetWidth, targetHeight, true)
            scaledBitmap = processingBitmap
            val rgba = ByteArray(targetWidth * targetHeight * 4)
            val rgbaBuffer = ByteBuffer.wrap(rgba)
            if (processingBitmap.config == Bitmap.Config.ARGB_8888) {
                processingBitmap.copyPixelsToBuffer(rgbaBuffer)
            } else {
                val argbCopy = processingBitmap.copy(Bitmap.Config.ARGB_8888, false)
                argbCopy.copyPixelsToBuffer(rgbaBuffer)
                argbCopy.recycle()
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
                // Auto mode strictly uses AI neural segmentation - never mix with or fall back to chroma!
                inferAlphaRgba(rgba, targetWidth, targetHeight, threshold, feather)
            }
            // Smooth bilinear upsampling eliminates blocky staircase edges on high-DPI mobile screens
            val upsampleFactor = if (maxOf(targetWidth, targetHeight) <= 256) 2 else 1
            val finalWidth = targetWidth * upsampleFactor
            val finalHeight = targetHeight * upsampleFactor
            val smoothAlpha = if (upsampleFactor > 1) {
                smoothAndUpsampleAlpha(alpha, targetWidth, targetHeight, finalWidth, finalHeight)
            } else {
                alpha
            }
            val maskPixels = IntArray(finalWidth * finalHeight)
            for (i in maskPixels.indices) {
                val a = smoothAlpha[i].toInt() and 0xFF
                maskPixels[i] = (a shl 24) or 0x00FFFFFF
            }
            val mask = Bitmap.createBitmap(maskPixels, finalWidth, finalHeight, Bitmap.Config.ARGB_8888)
            var compressed = false
            BufferedOutputStream(FileOutputStream(output)).use { stream ->
                compressed = mask.compress(Bitmap.CompressFormat.PNG, 100, stream)
                stream.flush()
            }
            if (!compressed) {
                // Secondary format fallback: WEBP
                val webpOutput = File(directory, "${safeClipId}_${frameIdx}.webp")
                BufferedOutputStream(FileOutputStream(webpOutput)).use { stream ->
                    val webpFormat = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        Bitmap.CompressFormat.WEBP_LOSSY
                    } else {
                        @Suppress("DEPRECATION")
                        Bitmap.CompressFormat.WEBP
                    }
                    if (mask.compress(webpFormat, 90, stream)) {
                        stream.flush()
                        mask.recycle()
                        return Uri.fromFile(webpOutput).toString()
                    }
                }
                throw IllegalStateException("Could not encode native cutout mask (format=ARGB_8888, size=${finalWidth}x${finalHeight})")
            }
            mask.recycle()
            return Uri.fromFile(output).toString()
        } finally {
            if (scaledBitmap !== sourceBitmap) scaledBitmap?.recycle()
            sourceBitmap?.recycle()
        }
    }

    private fun smoothAndUpsampleAlpha(
        src: ByteArray,
        srcW: Int,
        srcH: Int,
        dstW: Int,
        dstH: Int
    ): ByteArray {
        val dst = ByteArray(dstW * dstH)
        val scaleX = (srcW - 1).toFloat() / maxOf(1, dstW - 1).toFloat()
        val scaleY = (srcH - 1).toFloat() / maxOf(1, dstH - 1).toFloat()

        for (y in 0 until dstH) {
            val sy = y * scaleY
            val y0 = sy.toInt().coerceIn(0, srcH - 1)
            val y1 = (y0 + 1).coerceIn(0, srcH - 1)
            val fy = sy - y0
            val row0 = y0 * srcW
            val row1 = y1 * srcW
            val dstRow = y * dstW

            for (x in 0 until dstW) {
                val sx = x * scaleX
                val x0 = sx.toInt().coerceIn(0, srcW - 1)
                val x1 = (x0 + 1).coerceIn(0, srcW - 1)
                val fx = sx - x0

                val v00 = src[row0 + x0].toInt() and 0xFF
                val v10 = src[row0 + x1].toInt() and 0xFF
                val v01 = src[row1 + x0].toInt() and 0xFF
                val v11 = src[row1 + x1].toInt() and 0xFF

                val top = v00 + fx * (v10 - v00)
                val btm = v01 + fx * (v11 - v01)
                val v = (top + fy * (btm - top)).toInt().coerceIn(0, 255)
                dst[dstRow + x] = v.toByte()
            }
        }
        return dst
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

    private var lastSampledUri: String? = null
    private var lastSampledTimeUs: Long = -1L
    private var lastSampledBitmap: Bitmap? = null

    private fun sampleVideoPixelNative(
        uri: String,
        timeSeconds: Double,
        normX: Float,
        normY: Float
    ): String = synchronized(videoDecoderLock) {
        val context = appContext.reactContext ?: return "#00FF00"
        try {
            if (videoDecoderUri != uri || videoDecoder == null) {
                videoDecoder?.release()
                val next = MediaMetadataRetriever()
                val parsed = Uri.parse(uri)
                if (parsed.scheme == "content" || parsed.scheme == "android.resource") next.setDataSource(context, parsed)
                else next.setDataSource(parsed.path ?: uri)
                videoDecoder = next
                videoDecoderUri = uri
            }
            val retriever = videoDecoder ?: return "#00FF00"
            val timeUs = (timeSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong()

            var bmp = lastSampledBitmap
            if (lastSampledUri != uri || kotlin.math.abs(lastSampledTimeUs - timeUs) > 100_000L || bmp == null || bmp.isRecycled) {
                bmp?.recycle()
                val fetched = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    retriever.getScaledFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST, 256, 256)
                } else {
                    retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
                }
                bmp = fetched ?: return "#00FF00"
                lastSampledBitmap = bmp
                lastSampledUri = uri
                lastSampledTimeUs = timeUs
            }

            val px = (normX.coerceIn(0f, 1f) * (bmp.width - 1)).toInt()
            val py = (normY.coerceIn(0f, 1f) * (bmp.height - 1)).toInt()
            val color = bmp.getPixel(px, py)
            val r = (color shr 16) and 0xFF
            val g = (color shr 8) and 0xFF
            val b = color and 0xFF
            return String.format("#%02X%02X%02X", r, g, b)
        } catch (e: Exception) {
            Log.w(TAG, "sampleVideoPixelNative error", e)
            return "#00FF00"
        }
    }

    private fun detectBackdropColorNative(
        uri: String,
        timeSeconds: Double
    ): String = synchronized(videoDecoderLock) {
        val context = appContext.reactContext ?: return "#00FF00"
        try {
            if (videoDecoderUri != uri || videoDecoder == null) {
                videoDecoder?.release()
                val next = MediaMetadataRetriever()
                val parsed = Uri.parse(uri)
                if (parsed.scheme == "content" || parsed.scheme == "android.resource") next.setDataSource(context, parsed)
                else next.setDataSource(parsed.path ?: uri)
                videoDecoder = next
                videoDecoderUri = uri
            }
            val retriever = videoDecoder ?: return "#00FF00"
            val timeUs = (timeSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong()
            val bmp = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                retriever.getScaledFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST, 64, 64)
            } else {
                retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
            } ?: return "#00FF00"

            val w = bmp.width
            val h = bmp.height
            val samples = intArrayOf(
                bmp.getPixel(2, 2),
                bmp.getPixel(w - 3, 2),
                bmp.getPixel(2, h - 3),
                bmp.getPixel(w - 3, h - 3),
                bmp.getPixel(w / 2, 2),
                bmp.getPixel(2, h / 2),
                bmp.getPixel(w - 3, h / 2)
            )
            var totalR = 0
            var totalG = 0
            var totalB = 0
            for (c in samples) {
                totalR += (c shr 16) and 0xFF
                totalG += (c shr 8) and 0xFF
                totalB += c and 0xFF
            }
            val avgR = totalR / samples.size
            val avgG = totalG / samples.size
            val avgB = totalB / samples.size
            return String.format("#%02X%02X%02X", avgR, avgG, avgB)
        } catch (e: Exception) {
            Log.w(TAG, "detectBackdropColorNative error", e)
            return "#00FF00"
        }
    }
}
