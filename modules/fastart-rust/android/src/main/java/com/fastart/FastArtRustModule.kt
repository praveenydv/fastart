package com.fastart

import android.content.Context
import android.util.Base64
import android.util.Log
import android.os.Build
import android.graphics.Bitmap
import android.graphics.BitmapFactory
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
    private val videoDecoderLock = Any()
    private var videoDecoderUri: String? = null
    private var videoDecoder: MediaMetadataRetriever? = null
    private val videoDecoderPool = ArrayList<MediaMetadataRetriever>()
    private var videoDecoderWidth: Int = 512
    private var videoDecoderHeight: Int = 512
    private var modnetDirectByteBuffer: ByteBuffer? = null
    private var modnetRawFloats: FloatArray? = null
    private val threadLocalMaskPixels = object : ThreadLocal<IntArray>() {
        override fun initialValue(): IntArray = IntArray(512 * 512)
    }
    private val threadLocalRgbaBytes = object : ThreadLocal<ByteArray>() {
        override fun initialValue(): ByteArray = ByteArray(512 * 512 * 4)
    }

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
                    for (retriever in videoDecoderPool) {
                        try { retriever.release() } catch (_: Exception) {}
                    }
                    videoDecoderPool.clear()
                    videoDecoderUri = null
                }
            }
        }

        AsyncFunction("clearCutoutCache") { clipId: String? ->
            clearCutoutDirectoryFiles(clipId)
            true
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

    private fun clearCutoutDirectoryFiles(clipId: String?) {
        val context = appContext.reactContext ?: return
        val directory = File(context.cacheDir, "cutout")
        if (!directory.exists() || !directory.isDirectory) return
        val safeClipId = clipId?.replace(Regex("[^A-Za-z0-9_-]"), "_")
        val files = directory.listFiles() ?: return
        for (file in files) {
            if (safeClipId.isNullOrBlank() || file.name.startsWith("${safeClipId}_") || file.name.startsWith("${safeClipId}.")) {
                try {
                    file.delete()
                } catch (_: Exception) {}
            }
        }
    }

    private fun unwrapOnnxValue(value: Any?): OnnxValue? {
        if (value == null) return null
        if (value is java.util.Optional<*>) {
            return if (value.isPresent) value.get() as? OnnxValue else null
        }
        return value as? OnnxValue
    }

    /** Initializes the ultra-fast 256x256 MediaPipe Selfie Segmentation ONNX neural model. */
    private fun initializeAcceleratedModnet(modelPath: String): String = synchronized(modnetInferenceLock) {
        if (modnetSession != null) return "ok"
        val context = appContext.reactContext
        val environment = modnetEnvironment ?: OrtEnvironment.getEnvironment().also { modnetEnvironment = it }

        val cleanModelPath = if (modelPath.startsWith("file://")) modelPath.removePrefix("file://") else modelPath
        val candidate = if (cleanModelPath.isNotBlank()) File(cleanModelPath) else null

        val localModelFile = if (candidate != null && candidate.exists() && candidate.length() >= 20_000_000) {
            candidate
        } else {
            // Prioritize studio-grade MODNet (25.8MB) for full-body human portrait matting
            val targetFile = File(context?.cacheDir, "modnet.onnx")
            if (context != null && (!targetFile.exists() || targetFile.length() < 20_000_000)) {
                val assetNames = listOf(
                    "models/modnet.onnx",
                    "modnet.onnx"
                )
                for (assetName in assetNames) {
                    try {
                        context.assets.open(assetName).use { input ->
                            FileOutputStream(targetFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                        if (targetFile.exists() && targetFile.length() >= 20_000_000) break
                    } catch (_: Exception) {}
                }
            }
            targetFile
        }

        if (!localModelFile.exists() || localModelFile.length() < 20_000_000) {
            throw IllegalStateException("Studio MODNet cutout model not found at ${localModelFile.absolutePath} (expected >= 20MB)")
        }

        val cores = Runtime.getRuntime().availableProcessors()
        val cpuThreads = maxOf(2, cores)

        val options = OrtSession.SessionOptions().apply {
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            setIntraOpNumThreads(cpuThreads)
            setInterOpNumThreads(2)
            try {
                addNnapi()
                Log.i(TAG, "Hardware NNAPI acceleration enabled for Studio MODNet")
            } catch (_: Throwable) {
                try {
                    val addNnapiMethod = javaClass.getMethod("addNnapi")
                    addNnapiMethod.invoke(this)
                    Log.i(TAG, "Hardware NNAPI acceleration enabled via reflection")
                } catch (_: Throwable) {
                    Log.i(TAG, "Hardware NNAPI unavailable, using $cpuThreads optimized CPU threads")
                }
            }
        }

        val session = try {
            val created = environment.createSession(localModelFile.absolutePath, options)
            modnetSessionOptions = options
            created
        } catch (nnapiErr: Exception) {
            options.close()
            Log.w(TAG, "Accelerated session creation failed, retrying on CPU: ${nnapiErr.message}")
            val cpuOptions = OrtSession.SessionOptions().apply {
                setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
                setIntraOpNumThreads(cpuThreads)
                setInterOpNumThreads(2)
            }
            try {
                val createdCpu = environment.createSession(localModelFile.absolutePath, cpuOptions)
                modnetSessionOptions = cpuOptions
                createdCpu
            } catch (cpuErr: Exception) {
                cpuOptions.close()
                throw IllegalStateException("Failed to create ONNX session: ${cpuErr.message}", cpuErr)
            }
        }

        modnetSession = session

        val inputName = session.inputNames.firstOrNull() ?: "input"
        val outputName = session.outputNames.firstOrNull() ?: "output"
        modnetInputName = inputName
        modnetOutputName = outputName
        modnetModelWidth = 512
        modnetModelHeight = 512

        Log.i(TAG, "Studio MODNet AI Cutout initialized: model=${localModelFile.name}, input=$inputName [1, 3, 512, 512], output=$outputName")
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
        if (modnetSession == null) {
            initializeAcceleratedModnet("")
        }
        val session = modnetSession ?: throw IllegalStateException("AI Cutout session is not initialized")
        val environment = modnetEnvironment ?: throw IllegalStateException("ONNX Runtime is unavailable")
        val inputName = modnetInputName ?: "input"

        val mWidth = 512
        val mHeight = 512
        val planeSize = mWidth * mHeight

        var inputBytes = modnetDirectByteBuffer
        if (inputBytes == null || inputBytes.capacity() < planeSize * 3 * 4) {
            inputBytes = ByteBuffer.allocateDirect(planeSize * 3 * 4).order(ByteOrder.nativeOrder())
            modnetDirectByteBuffer = inputBytes
        }
        inputBytes.clear()
        val floatBuf = inputBytes.asFloatBuffer()
        floatBuf.position(0)

        // Prepare planar Float32 RGB tensor: [1, 3, 512, 512]
        // MODNet photographic portrait matting expects [-1.0..1.0] ((pixel - 127.5) / 127.5)
        val invScale = 1.0f / 127.5f
        val gOffset = planeSize
        val bOffset = planeSize * 2

        if (width == mWidth && height == mHeight) {
            var srcIdx = 0
            for (i in 0 until planeSize) {
                val r = rgba[srcIdx].toInt() and 0xFF
                val g = rgba[srcIdx + 1].toInt() and 0xFF
                val b = rgba[srcIdx + 2].toInt() and 0xFF
                floatBuf.put(i, (r - 127.5f) * invScale)
                floatBuf.put(gOffset + i, (g - 127.5f) * invScale)
                floatBuf.put(bOffset + i, (b - 127.5f) * invScale)
                srcIdx += 4
            }
        } else {
            val scaleX = (width - 1).toFloat() / (mWidth - 1).toFloat()
            val scaleY = (height - 1).toFloat() / (mHeight - 1).toFloat()
            var dIdx = 0
            for (y in 0 until mHeight) {
                val sy = y * scaleY
                val y0 = sy.toInt().coerceIn(0, height - 1)
                val y1 = (y0 + 1).coerceIn(0, height - 1)
                val fy = sy - y0
                val row0 = y0 * width * 4
                val row1 = y1 * width * 4

                for (x in 0 until mWidth) {
                    val sx = x * scaleX
                    val x0 = sx.toInt().coerceIn(0, width - 1)
                    val x1 = (x0 + 1).coerceIn(0, width - 1)
                    val fx = sx - x0

                    val i00 = row0 + (x0 shl 2)
                    val i10 = row0 + (x1 shl 2)
                    val i01 = row1 + (x0 shl 2)
                    val i11 = row1 + (x1 shl 2)

                    val w00 = (1f - fx) * (1f - fy)
                    val w10 = fx * (1f - fy)
                    val w01 = (1f - fx) * fy
                    val w11 = fx * fy

                    val r = (rgba[i00].toInt() and 0xFF) * w00 + (rgba[i10].toInt() and 0xFF) * w10 +
                            (rgba[i01].toInt() and 0xFF) * w01 + (rgba[i11].toInt() and 0xFF) * w11
                    val g = (rgba[i00 + 1].toInt() and 0xFF) * w00 + (rgba[i10 + 1].toInt() and 0xFF) * w10 +
                            (rgba[i01 + 1].toInt() and 0xFF) * w01 + (rgba[i11 + 1].toInt() and 0xFF) * w11
                    val b = (rgba[i00 + 2].toInt() and 0xFF) * w00 + (rgba[i10 + 2].toInt() and 0xFF) * w10 +
                            (rgba[i01 + 2].toInt() and 0xFF) * w01 + (rgba[i11 + 2].toInt() and 0xFF) * w11

                    floatBuf.put(dIdx, (r - 127.5f) * invScale)
                    floatBuf.put(gOffset + dIdx, (g - 127.5f) * invScale)
                    floatBuf.put(bOffset + dIdx, (b - 127.5f) * invScale)
                    dIdx++
                }
            }
        }
        floatBuf.position(0)

        val inputTensor = OnnxTensor.createTensor(environment, floatBuf, longArrayOf(1, 3, mHeight.toLong(), mWidth.toLong()))
        try {
            session.run(mapOf(inputName to inputTensor)).use { result ->
                var alphaTensor: OnnxTensor? = null
                for (entry in result) {
                    val value = entry.value
                    if (value is OnnxTensor) {
                        alphaTensor = value
                        break
                    }
                }
                if (alphaTensor == null) {
                    throw IllegalStateException("AI Cutout neural model did not produce an output tensor")
                }

                val outputFloats = alphaTensor.floatBuffer
                outputFloats.position(0)
                var rawFloats = modnetRawFloats
                if (rawFloats == null || rawFloats.size < planeSize) {
                    rawFloats = FloatArray(planeSize)
                    modnetRawFloats = rawFloats
                }
                outputFloats.get(rawFloats)

                val (tNorm, sNorm) = if (threshold <= 0.001f && feather <= 0.001f) {
                    Pair(0.45f, 0.25f)
                } else {
                    Pair(threshold.coerceIn(0f, 1f), feather.coerceIn(0f, 1f))
                }

                val vMin = (0.20f + (tNorm - 0.45f) * 0.25f).coerceIn(0.14f, 0.38f)
                val vMax = (0.58f + tNorm * 0.10f + sNorm * 0.08f).coerceIn(vMin + 0.25f, 0.85f)
                val span = maxOf(0.10f, vMax - vMin)
                val invSpan = 1.0f / span

                val alpha = ByteArray(width * height)
                if (width == mWidth && height == mHeight) {
                    for (i in 0 until planeSize) {
                        val v = rawFloats[i]
                        val a = if (v <= vMin) 0f
                        else if (v >= vMax) 1f
                        else {
                            val u = (v - vMin) * invSpan
                            u * u * u * (u * (u * 6f - 15f) + 10f)
                        }
                        alpha[i] = (a.coerceIn(0f, 1f) * 255f).toInt().toByte()
                    }
                } else {
                    val invW = (mWidth - 1).toFloat() / maxOf(1, width - 1).toFloat()
                    val invH = (mHeight - 1).toFloat() / maxOf(1, height - 1).toFloat()

                    for (y in 0 until height) {
                        val sy = y * invH
                        val y0 = sy.toInt().coerceIn(0, mHeight - 1)
                        val y1 = (y0 + 1).coerceIn(0, mHeight - 1)
                        val fy = sy - y0
                        val row0 = y0 * mWidth
                        val row1 = y1 * mWidth
                        val dstRow = y * width

                        for (x in 0 until width) {
                            val sx = x * invW
                            val x0 = sx.toInt().coerceIn(0, mWidth - 1)
                            val x1 = (x0 + 1).coerceIn(0, mWidth - 1)
                            val fx = sx - x0

                            val v00 = rawFloats[row0 + x0]
                            val v10 = rawFloats[row0 + x1]
                            val v01 = rawFloats[row1 + x0]
                            val v11 = rawFloats[row1 + x1]

                            val top = v00 + fx * (v10 - v00)
                            val btm = v01 + fx * (v11 - v01)
                            val v = top + fy * (btm - top)

                            val a = if (v <= vMin) 0f
                            else if (v >= vMax) 1f
                            else {
                                val u = (v - vMin) * invSpan
                                u * u * (3f - 2f * u)
                            }
                            alpha[dstRow + x] = (a.coerceIn(0f, 1f) * 255f).toInt().toByte()
                        }
                    }
                }

                // Edge-aware 3x3 anti-aliasing on transition boundaries to eliminate jagged staircases
                if (width > 2 && height > 2) {
                    val scratch = alpha.clone()
                    for (y in 1 until height - 1) {
                        val row = y * width
                        val rowPrev = (y - 1) * width
                        val rowNext = (y + 1) * width
                        for (x in 1 until width - 1) {
                            val idx = row + x
                            val v = scratch[idx].toInt() and 0xFF
                            if (v in 1..254) {
                                val tl = scratch[rowPrev + x - 1].toInt() and 0xFF
                                val tc = scratch[rowPrev + x].toInt() and 0xFF
                                val tr = scratch[rowPrev + x + 1].toInt() and 0xFF
                                val cl = scratch[row + x - 1].toInt() and 0xFF
                                val cr = scratch[row + x + 1].toInt() and 0xFF
                                val bl = scratch[rowNext + x - 1].toInt() and 0xFF
                                val bc = scratch[rowNext + x].toInt() and 0xFF
                                val br = scratch[rowNext + x + 1].toInt() and 0xFF
                                val sum = (tl + tr + bl + br) + ((tc + cl + cr + bc) shl 1) + (v shl 2)
                                alpha[idx] = ((sum + 8) shr 4).toByte()
                            }
                        }
                    }
                }
                alpha
            }
        } finally {
            inputTensor.close()
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
        val paramTag = if (mode == "chroma") {
            "chroma_v2_${keyColor.replace("#", "")}_${(threshold * 100).toInt()}_${(feather * 100).toInt()}"
        } else {
            "auto_v2"
        }
        val webpOutput = File(directory, "${safeClipId}_${frameIdx}_${paramTag}.webp")
        val pngOutput = File(directory, "${safeClipId}_${frameIdx}_${paramTag}.png")
        if (webpOutput.exists() && webpOutput.length() > 0) {
            return Uri.fromFile(webpOutput).toString()
        }
        if (pngOutput.exists() && pngOutput.length() > 0) {
            return Uri.fromFile(pngOutput).toString()
        }

        val parsed = Uri.parse(uri)
        val uriPath = (parsed.path ?: uri).lowercase()
        val isPhoto = uriPath.endsWith(".png") ||
                      uriPath.endsWith(".jpg") ||
                      uriPath.endsWith(".jpeg") ||
                      uriPath.endsWith(".webp")

        var sourceBitmap: Bitmap? = null
        var scaledBitmap: Bitmap? = null
        try {
            var rawW = 512
            var rawH = 512

            if (isPhoto) {
                sourceBitmap = if (parsed.scheme == "content" || parsed.scheme == "android.resource") {
                    context.contentResolver.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it) }
                } else {
                    BitmapFactory.decodeFile(parsed.path ?: uri)
                } ?: throw IllegalStateException("Could not decode image at $uri")
                rawW = sourceBitmap.width
                rawH = sourceBitmap.height
            } else {
                val retriever: MediaMetadataRetriever
                synchronized(videoDecoderLock) {
                    if (videoDecoderUri != uri) {
                        for (r in videoDecoderPool) {
                            try { r.release() } catch (_: Exception) {}
                        }
                        videoDecoderPool.clear()
                        videoDecoderUri = uri
                    }
                    if (videoDecoderPool.isNotEmpty()) {
                        retriever = videoDecoderPool.removeAt(videoDecoderPool.size - 1)
                    } else {
                        val next = MediaMetadataRetriever()
                        if (parsed.scheme == "content" || parsed.scheme == "android.resource") {
                            next.setDataSource(context, parsed)
                        } else {
                            next.setDataSource(parsed.path ?: uri)
                        }
                        videoDecoderWidth = next.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 512
                        videoDecoderHeight = next.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 512
                        val rotation = next.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
                        if (rotation == 90 || rotation == 270) {
                            val temp = videoDecoderWidth
                            videoDecoderWidth = videoDecoderHeight
                            videoDecoderHeight = temp
                        }
                        retriever = next
                    }
                    rawW = videoDecoderWidth
                    rawH = videoDecoderHeight
                }

                // Preserve exact aspect ratio to prevent squashing and boundary letterboxing
                val maxDim = 512
                val (targetW, targetH) = if (rawW >= rawH) {
                    Pair(maxDim, maxOf(16, (maxDim * rawH) / maxOf(1, rawW)))
                } else {
                    Pair(maxOf(16, (maxDim * rawW) / maxOf(1, rawH)), maxDim)
                }

                try {
                    val timeUs = (timeSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong()
                    sourceBitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                        retriever.getScaledFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST, targetW, targetH)
                            ?: retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
                    } else {
                        retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
                    } ?: throw IllegalStateException("Could not decode video frame at ${timeSeconds}s")
                } finally {
                    synchronized(videoDecoderLock) {
                        if (videoDecoderUri == uri && videoDecoderPool.size < 4) {
                            videoDecoderPool.add(retriever)
                        } else {
                            try { retriever.release() } catch (_: Exception) {}
                        }
                    }
                }
            }

            val decodedBitmap = sourceBitmap ?: throw IllegalStateException("Decoded frame is unavailable")
            if (rawW <= 0 || rawH <= 0) {
                rawW = decodedBitmap.width
                rawH = decodedBitmap.height
            }

            // Target dimensions maintain the identical aspect ratio of the source footage
            val maxDim = 512
            val (targetWidth, targetHeight) = if (rawW >= rawH) {
                Pair(maxDim, maxOf(16, (maxDim * rawH) / maxOf(1, rawW)))
            } else {
                Pair(maxOf(16, (maxDim * rawW) / maxOf(1, rawH)), maxDim)
            }

            val processingBitmap = if (decodedBitmap.width == targetWidth && decodedBitmap.height == targetHeight) {
                decodedBitmap
            } else {
                Bitmap.createScaledBitmap(decodedBitmap, targetWidth, targetHeight, true)
            }
            scaledBitmap = processingBitmap

            val rgbaLen = targetWidth * targetHeight * 4
            var rgba = threadLocalRgbaBytes.get()
            if (rgba == null || rgba.size < rgbaLen) {
                rgba = ByteArray(rgbaLen)
                threadLocalRgbaBytes.set(rgba)
            }
            val rgbaBuffer = ByteBuffer.wrap(rgba, 0, rgbaLen)
            if (processingBitmap.config == Bitmap.Config.ARGB_8888) {
                processingBitmap.copyPixelsToBuffer(rgbaBuffer)
            } else {
                val argbCopy = processingBitmap.copy(Bitmap.Config.ARGB_8888, false)
                argbCopy.copyPixelsToBuffer(rgbaBuffer)
                argbCopy.recycle()
            }

            val totalPixels = targetWidth * targetHeight
            var maskPixels = threadLocalMaskPixels.get()
            if (maskPixels == null || maskPixels.size < totalPixels) {
                maskPixels = IntArray(totalPixels)
                threadLocalMaskPixels.set(maskPixels)
            }

            if (mode == "chroma") {
                val color = keyColor.removePrefix("#").toLong(16).toInt()
                val processed = nativeProcessChroma(
                    rgba, targetWidth, targetHeight,
                    (color shr 16) and 0xff, (color shr 8) and 0xff, color and 0xff,
                    threshold, feather, true,
                )
                for (i in 0 until totalPixels) {
                    val i4 = i * 4
                    val r = processed[i4].toInt() and 0xFF
                    val g = processed[i4 + 1].toInt() and 0xFF
                    val b = processed[i4 + 2].toInt() and 0xFF
                    val a = processed[i4 + 3].toInt() and 0xFF
                    maskPixels[i] = if (a < 4) 0 else (a shl 24) or (r shl 16) or (g shl 8) or b
                }
            } else {
                val effThresh = if (threshold <= 0.001f) 0.45f else threshold.coerceIn(0.001f, 0.60f)
                val effFeath = if (feather <= 0.001f) 0.25f else feather.coerceIn(0.02f, 0.95f)
                val alpha = inferAlphaRgba(rgba, targetWidth, targetHeight, effThresh, effFeath)
                val defringeRadius = maxOf(3, minOf(6, maxOf(targetWidth, targetHeight) / 250))

                for (y in 0 until targetHeight) {
                    val rowIdx = y * targetWidth
                    for (x in 0 until targetWidth) {
                        val i = rowIdx + x
                        val a = alpha[i].toInt() and 0xFF
                        if (a < 4) {
                            maskPixels[i] = 0
                            continue
                        }
                        val i4 = i * 4
                        var r = rgba[i4].toInt() and 0xFF
                        var g = rgba[i4 + 1].toInt() and 0xFF
                        var b = rgba[i4 + 2].toInt() and 0xFF

                        if (a <= 245 && targetWidth > 4 && targetHeight > 4) {
                            var fgR = 0L
                            var fgG = 0L
                            var fgB = 0L
                            var fgW = 0L
                            val yMin = maxOf(0, y - defringeRadius)
                            val yMax = minOf(targetHeight - 1, y + defringeRadius)
                            val xMin = maxOf(0, x - defringeRadius)
                            val xMax = minOf(targetWidth - 1, x + defringeRadius)
                            for (ny in yMin..yMax) {
                                val nRow = ny * targetWidth
                                for (nx in xMin..xMax) {
                                    val nIdx = nRow + nx
                                    val na = alpha[nIdx].toInt() and 0xFF
                                    if (na >= 242) {
                                        val n4 = nIdx * 4
                                        val w = (na - 239).toLong()
                                        fgR += (rgba[n4].toInt() and 0xFF) * w
                                        fgG += (rgba[n4 + 1].toInt() and 0xFF) * w
                                        fgB += (rgba[n4 + 2].toInt() and 0xFF) * w
                                        fgW += w
                                    }
                                }
                            }
                            if (fgW > 0L) {
                                val blendW = minOf(0.95f, maxOf(0f, 1f - a / 255f) * 1.10f)
                                val invW = 1f - blendW
                                r = (r * invW + (fgR.toFloat() / fgW) * blendW).toInt().coerceIn(0, 255)
                                g = (g * invW + (fgG.toFloat() / fgW) * blendW).toInt().coerceIn(0, 255)
                                b = (b * invW + (fgB.toFloat() / fgW) * blendW).toInt().coerceIn(0, 255)
                            }
                        }
                        maskPixels[i] = (a shl 24) or (r shl 16) or (g shl 8) or b
                    }
                }
            }
            val mask = Bitmap.createBitmap(maskPixels, targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
            var compressed = false

            // Ultra-fast hardware-assisted WebP encoding (4x-6x faster than single-threaded PNG)
            if (webpOutput.exists()) webpOutput.delete()
            try {
                BufferedOutputStream(FileOutputStream(webpOutput)).use { stream ->
                    val webpFormat = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        Bitmap.CompressFormat.WEBP_LOSSLESS
                    } else {
                        @Suppress("DEPRECATION")
                        Bitmap.CompressFormat.WEBP
                    }
                    compressed = mask.compress(webpFormat, 100, stream)
                    stream.flush()
                }
                if (compressed) {
                    mask.recycle()
                    return Uri.fromFile(webpOutput).toString()
                }
            } catch (_: Exception) {}

            // PNG fallback for older Android platforms
            if (pngOutput.exists()) pngOutput.delete()
            BufferedOutputStream(FileOutputStream(pngOutput)).use { stream ->
                compressed = mask.compress(Bitmap.CompressFormat.PNG, 100, stream)
                stream.flush()
            }
            mask.recycle()
            if (!compressed) {
                throw IllegalStateException("Could not encode native cutout mask")
            }
            return Uri.fromFile(pngOutput).toString()
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
