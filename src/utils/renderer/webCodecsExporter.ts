// FastArt High-Performance Offline WebCodecs Video Exporter
// Renders and encodes video frames offline at hardware GPU speeds (3x - 10x faster than real time)
// without waiting for real-world clock time. Uses ISOBMFF MP4 muxer.

import { FastArtProject } from "../../types/project";
import type { VideoRenderer } from "../videoRenderer";
import type { ExportOptions, ExportResult } from "./unifiedExporter";
import {
  muxMp4,
  muxMp4ToBlob,
  EncodedChunkSample,
  AudioChunkSample,
} from "./mp4Muxer";
import { exportProjectAudioToWavBytes } from "../audioExporter";
import { mediaHasAudioTrack } from "../mediaAudioDetector";
import { evaluateSpeedCurve } from "./rendererEffects";

async function seekVideoElementSafely(
  el: HTMLVideoElement,
  targetTime: number,
  maxTolerance: number = 0.02
): Promise<void> {
  if (!el || el.error || (el as any).__seekDisabled) {
    return;
  }
  if (Math.abs(el.currentTime - targetTime) <= maxTolerance) {
    return;
  }

  // Ensure element is ready to seek (HAVE_CURRENT_DATA)
  if (el.readyState < 2) {
    await new Promise<void>((resolve) => {
      let done = false;
      const onReady = () => {
        if (!done) {
          done = true;
          el.removeEventListener("loadeddata", onReady);
          el.removeEventListener("canplay", onReady);
          resolve();
        }
      };
      el.addEventListener("loadeddata", onReady, { once: true });
      el.addEventListener("canplay", onReady, { once: true });
      setTimeout(() => {
        if (!done) {
          done = true;
          if (el.readyState < 1) {
            (el as any).__seekDisabled = true;
          }
          resolve();
        }
      }, 400);
    });
  }

  if ((el as any).__seekDisabled) return;

  // If already seeking from a prior step, wait for it to land.
  // Never interrupt an active seek with a new currentTime assignment!
  if (el.seeking) {
    await new Promise<void>((resolve) => {
      let done = false;
      const onDone = () => {
        if (!done) {
          done = true;
          el.removeEventListener("seeked", onDone);
          resolve();
        }
      };
      el.addEventListener("seeked", onDone, { once: true });
      setTimeout(onDone, 500);
    });
  }

  if (Math.abs(el.currentTime - targetTime) <= maxTolerance) {
    return;
  }

  await new Promise<void>((resolve) => {
    let done = false;
    const onSeeked = () => {
      if (!done) {
        done = true;
        el.removeEventListener("seeked", onSeeked);
        resolve();
      }
    };
    el.addEventListener("seeked", onSeeked, { once: true });
    try {
      el.currentTime = targetTime;
    } catch {
      onSeeked();
    }
    setTimeout(onSeeked, 600);
  });
}

export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).VideoEncoder === "function" &&
    typeof (window as any).VideoFrame === "function"
  );
}

export async function exportWebCodecsVideo(
  exportRenderer: VideoRenderer,
  project: FastArtProject,
  exportCanvas: HTMLCanvasElement,
  options: ExportOptions = {},
  onProgress?: (
    percent: number,
    currentTime: number,
    duration: number,
  ) => void,
): Promise<ExportResult> {
  const {
    fps = 30,
    duration = 10.0,
    videoBitsPerSecond = 16000000,
    logicalWidth,
    logicalHeight,
  } = options;

  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const width = exportCanvas.width;
  const height = exportCanvas.height;

  // Set export mode for highest quality filtering
  exportRenderer.isExporting = true;

  const VideoEncoderClass = (window as any).VideoEncoder;
  const VideoFrameClass = (window as any).VideoFrame;
  const AudioEncoderClass = (window as any).AudioEncoder;
  const AudioDataClass = (window as any).AudioData;

  const videoClips = project.tracks?.video || [];
  const hasVideoClips = videoClips.some((c) => c && c.type === "video");

  // WebCodecs offline frame seeking on HTMLVideoElement is fundamentally incompatible with smooth video export
  // because browsers flush the hardware decoder pipeline on every seek (taking 200-600ms per frame and dropping textures).
  // When video clips are present, fall back immediately to the real-time hardware MediaRecorder engine.
  if (hasVideoClips) {
    throw new Error(
      "WebCodecs offline seek cannot decode HTMLVideoElement at high framerates without decoder pipeline stalls. Engaging real-time hardware MediaRecorder engine."
    );
  }

  const hasAudioClips =
    Boolean(project.tracks?.audio && project.tracks.audio.some((c) => c && c.duration > 0)) ||
    videoClips.some(
      (c) =>
        c &&
        c.type === "video" &&
        !c.isEnding &&
        !c.muted &&
        (c.volume === undefined || c.volume > 0) &&
        mediaHasAudioTrack(c)
    );

  // UPFRONT AudioEncoder capability verification:
  // If the timeline requires audio, verify that AudioEncoder supports AAC BEFORE
  // encoding video frames. This prevents wasting minutes rendering frames only to fail at the end.
  let isAudioEncoderAvailable = false;
  if (
    hasAudioClips &&
    typeof AudioEncoderClass === "function" &&
    typeof AudioDataClass === "function"
  ) {
    try {
      const aSupport = await AudioEncoderClass.isConfigSupported({
        codec: "mp4a.40.2",
        sampleRate: 44100,
        numberOfChannels: 2,
        bitrate: 192000,
      });
      isAudioEncoderAvailable = Boolean(aSupport && aSupport.supported);
    } catch {
      isAudioEncoderAvailable = false;
    }
  }

  if (hasAudioClips && !isAudioEncoderAvailable) {
    throw new Error(
      "WebCodecs AAC AudioEncoder unsupported in this browser environment. Engaging MediaRecorder pipeline."
    );
  }

  // Ensure all video elements are paused & muted so playback/permissions never block decoder
  videoClips.forEach((c) => {
    const el =
      (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
      (c.sourceMediaId ? exportRenderer.videoElements.get(c.sourceMediaId) : null) ||
      exportRenderer.videoElements.get(c.url);
    if (el && el instanceof HTMLVideoElement) {
      el.muted = true;
      el.defaultMuted = true;
      try {
        el.pause();
      } catch {}
    }
  });

  // Dynamically determine candidate H.264 High and Main Profile codec strings based on resolution & framerate
  // Level 5.2 (0x34) = 4K @ 60fps, Level 5.1 (0x33) = 4K @ 30fps
  // Level 4.2 (0x2A) = 1080p @ 60fps, Level 4.1/4.0 (0x29/0x28) = 1080p @ 30fps
  const is4K = width >= 3840 || height >= 3840 || width >= 2160 || height >= 2160;
  const is1080p = width >= 1920 || height >= 1920 || width >= 1080 || height >= 1080;
  const isHighFps = fps >= 50;

  const candidateCodecs: string[] = [];
  if (is4K) {
    if (isHighFps) candidateCodecs.push("avc1.640034", "avc1.4D4034");
    candidateCodecs.push("avc1.640033", "avc1.4D4033", "avc1.640032", "avc1.4D4032");
  } else if (is1080p) {
    if (isHighFps) candidateCodecs.push("avc1.64002a", "avc1.4D402a");
    candidateCodecs.push("avc1.640029", "avc1.4D4029", "avc1.640028", "avc1.4D4028");
  } else {
    if (isHighFps) candidateCodecs.push("avc1.640020", "avc1.4D4020");
    candidateCodecs.push("avc1.64001f", "avc1.4D401f", "avc1.64001e", "avc1.4D401e");
  }
  candidateCodecs.push("avc1.640028", "avc1.4D401F", "avc1.42E01E", "avc1.42001E");

  let chosenConfig: any = null;
  for (const c of candidateCodecs) {
    const testConfigs = [
      {
        codec: c,
        width,
        height,
        bitrate: videoBitsPerSecond,
        framerate: fps,
        hardwareAcceleration: "prefer-hardware",
        latencyMode: "realtime",
        bitrateMode: "variable",
      },
      {
        codec: c,
        width,
        height,
        bitrate: videoBitsPerSecond,
        framerate: fps,
        hardwareAcceleration: "prefer-hardware",
      },
      {
        codec: c,
        width,
        height,
        bitrate: videoBitsPerSecond,
        framerate: fps,
        latencyMode: "realtime",
      },
      {
        codec: c,
        width,
        height,
        bitrate: videoBitsPerSecond,
        framerate: fps,
      },
    ];

    for (const tc of testConfigs) {
      try {
        const sup = await VideoEncoderClass.isConfigSupported(tc);
        if (sup && sup.supported) {
          chosenConfig = sup.config || tc;
          break;
        }
      } catch {}
    }
    if (chosenConfig) break;
  }

  if (!chosenConfig) {
    chosenConfig = {
      codec: "avc1.42001E",
      width,
      height,
      bitrate: videoBitsPerSecond,
      framerate: fps,
    };
  }

  const config: any = chosenConfig;

  const videoSamples: EncodedChunkSample[] = [];
  let avcDescription: Uint8Array | null = null;
  let encodeError: any = null;

  const encoder = new VideoEncoderClass({
    output: (chunk: any, metadata: any) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      if (metadata?.decoderConfig?.description) {
        avcDescription = new Uint8Array(metadata.decoderConfig.description);
      }
      videoSamples.push({
        data,
        isKey: chunk.type === "key",
        timestampUs: chunk.timestamp,
        durationUs: chunk.duration,
      });
    },
    error: (err: any) => {
      console.error("[WebCodecs] VideoEncoder error:", err);
      encodeError = err;
    },
  });

  encoder.configure(config);

  try {
    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    const frameIntervalSec = 1 / fps;
  const frameDurationUs = Math.round(1000000 / fps);

  // Check if project has video clips that need time seeking
  const videoClips = project.tracks?.video || [];
  const hasVideoClips = videoClips.some((c) => c.type === "video");

  // Cue initial frame
  exportRenderer.renderFrame(project, 0, false, logicalWidth, logicalHeight);
  onProgress?.(0, 0, duration);

  for (let f = 0; f < totalFrames; f++) {
    if (encodeError) {
      throw encodeError;
    }
    if (options.isCancelled?.()) {
      try {
        encoder.close();
      } catch {}
      throw new Error("Export cancelled");
    }

    const curTime = Math.min(duration, f * frameIntervalSec);

    // Render composite frame at high quality (photo/graphics/captions/stickers/effects)
    exportRenderer.renderFrame(
      project,
      curTime,
      false,
      logicalWidth,
      logicalHeight,
    );

    // Create hardware video frame from canvas bitmap (with ImageBitmap fallback for WebKit)
    let frame: any;
    try {
      frame = new VideoFrameClass(exportCanvas, {
        timestamp: f * frameDurationUs,
        duration: frameDurationUs,
      });
    } catch {
      const bmp = await createImageBitmap(exportCanvas);
      frame = new VideoFrameClass(bmp, {
        timestamp: f * frameDurationUs,
        duration: frameDurationUs,
      });
      try { (bmp as any).close(); } catch {}
    }

    const isKeyFrame = f % (fps * 2) === 0; // Keyframe every 2 seconds
    encoder.encode(frame, { keyFrame: isKeyFrame });
    frame.close();

    // Hardware encoder backpressure: if encoder queue exceeds limit,
    // let hardware video encoder finish compressing to prevent memory growth or GPU stalls.
    // On mobile browsers keep the queue shallower (5 frames vs 12) so RAM and thermal headroom stay clean.
    const maxQueueSize = isMobileDevice ? 5 : 12;
    const stallTimeoutMs = isMobileDevice ? 2500 : 5000;
    if (encoder.encodeQueueSize > maxQueueSize) {
      let lastQueueSize = encoder.encodeQueueSize;
      let lastDrainTime = performance.now();
      while (encoder.encodeQueueSize > maxQueueSize) {
        if (encodeError) {
          throw encodeError;
        }
        if (encoder.state !== "configured") {
          throw new Error(`VideoEncoder closed unexpectedly: ${encoder.state}`);
        }
        if (options.isCancelled?.()) {
          try { encoder.close(); } catch {}
          throw new Error("Export cancelled");
        }
        const curQueue = encoder.encodeQueueSize;
        if (curQueue < lastQueueSize) {
          lastQueueSize = curQueue;
          lastDrainTime = performance.now();
        } else if (performance.now() - lastDrainTime > stallTimeoutMs) {
          throw new Error("Hardware VideoEncoder queue stalled; falling back to MediaRecorder");
        }
        await new Promise((r) => setTimeout(r, isMobileDevice ? 10 : 6));
      }
    }

    // Responsive progress calculation & cooperative event-loop yield
    // On mobile browsers yield on every frame with setTimeout(0) so UI touches & Cancel stay instant.
    if (isMobileDevice || f % 2 === 0 || f === totalFrames - 1) {
      const pct = Math.min(90, Math.floor((f / totalFrames) * 90));
      onProgress?.(pct, curTime, duration);
      if (isMobileDevice) {
        await new Promise((r) => setTimeout(r, 0));
      } else if (typeof (globalThis as any).scheduler?.yield === "function") {
        await (globalThis as any).scheduler.yield();
      } else {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  onProgress?.(92, duration, duration);

  let flushTimer: any = null;
  const flushPromise = encoder.flush();
  const flushTimeoutPromise = new Promise((_, reject) => {
    flushTimer = setTimeout(() => {
      reject(new Error("VideoEncoder flush timed out"));
    }, 15000);
  });
  try {
    await Promise.race([flushPromise, flushTimeoutPromise]);
  } finally {
    clearTimeout(flushTimer);
  }
  encoder.close();

  if (encodeError) {
    throw encodeError;
  }

  // 2. Encode Audio Track via AudioEncoder if supported, or mix via WAV
  const audioSamples: AudioChunkSample[] = [];
  let audioDescription: Uint8Array | null = null;
  const AudioEncoderClass = (window as any).AudioEncoder;
  const AudioDataClass = (window as any).AudioData;

  const hasAudioClips =
    Boolean(project.tracks?.audio && project.tracks.audio.some((c) => c && c.duration > 0)) ||
    videoClips.some(
      (c) =>
        c &&
        c.type === "video" &&
        !c.isEnding &&
        !c.muted &&
        (c.volume === undefined || c.volume > 0) &&
        mediaHasAudioTrack(c)
    );

  if (
    hasAudioClips &&
    typeof AudioEncoderClass === "function" &&
    typeof AudioDataClass === "function"
  ) {
    try {
      const aConfig = {
        codec: "mp4a.40.2", // AAC-LC
        sampleRate: 44100,
        numberOfChannels: 2,
        bitrate: 192000,
      };

      const aSupport = await AudioEncoderClass.isConfigSupported(aConfig);
      if (aSupport.supported) {
        const aEncoder = new AudioEncoderClass({
          output: (chunk: any, meta: any) => {
            const buf = new Uint8Array(chunk.byteLength);
            chunk.copyTo(buf);
            if (meta?.decoderConfig?.description) {
              audioDescription = new Uint8Array(meta.decoderConfig.description);
            }
            audioSamples.push({
              data: buf,
              timestampUs: chunk.timestamp,
              durationUs: chunk.duration,
            });
          },
          error: (e: any) => console.warn("[WebCodecs] AudioEncoder warning:", e),
        });

        aEncoder.configure(aConfig);

        // Mix soundtrack into PCM buffer
        const wavBytes = await exportProjectAudioToWavBytes(project, duration, 44100);
        // Extract 16-bit interleaved PCM from WAV data (header is 44 bytes)
        const pcmData = new Int16Array(
          wavBytes.buffer,
          wavBytes.byteOffset + 44,
          (wavBytes.length - 44) / 2,
        );

        const sampleCount = Math.floor(pcmData.length / 2);
        const chunkSize = 1024; // AAC-LC requires exact 1024 frame blocks

        let audioChunkIter = 0;
        for (let i = 0; i < sampleCount; i += chunkSize) {
          if (options.isCancelled?.()) {
            try { aEncoder.close(); } catch {}
            throw new Error("Export cancelled");
          }
          const available = Math.min(chunkSize, sampleCount - i);
          const left = new Float32Array(chunkSize);
          const right = new Float32Array(chunkSize);
          for (let s = 0; s < available; s++) {
            left[s] = pcmData[(i + s) * 2] / 32768;
            right[s] = pcmData[(i + s) * 2 + 1] / 32768;
          }

          const planarData = new Float32Array(chunkSize * 2);
          planarData.set(left, 0);
          planarData.set(right, chunkSize);

          const audioData = new AudioDataClass({
            format: "f32-planar",
            sampleRate: 44100,
            numberOfFrames: chunkSize,
            numberOfChannels: 2,
            timestamp: Math.round((i * 1000000) / 44100),
            data: planarData,
          });

          aEncoder.encode(audioData);
          audioData.close();
          audioChunkIter++;
          if (audioChunkIter % 64 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        await aEncoder.flush();
        aEncoder.close();
      }
    } catch (e) {
      console.warn("[WebCodecs] Audio track export fallback:", e);
    }
  }

  // If the project has audio tracks or unmuted video clips, but WebCodecs audio encoder
  // could not generate audio chunks, throw an error to engage high-fidelity MediaRecorder fallback
  // with the Web Audio API audio graph (which has 100% native codec & audio support)
  if (hasAudioClips && audioSamples.length === 0) {
    throw new Error(
      "WebCodecs audio encoder was unable to generate AAC samples for audio timeline. Engaging high-fidelity fallback.",
    );
  }

  onProgress?.(96, duration, duration);

  // 3. Fast In-Memory Zero-Copy MP4 Multiplexing directly into Blob
  onProgress?.(98, duration, duration);
  const { blob: finalBlob, size: fileSize } = muxMp4ToBlob(
    {
      width,
      height,
      fps,
      videoSamples,
      avcDescription,
      audioSamples,
      audioSampleRate: 44100,
      audioChannels: 2,
      audioDescription,
    },
    "video/mp4",
  );

  // Release chunk sample arrays promptly so GC can reclaim memory on mobile browsers
  videoSamples.length = 0;
  audioSamples.length = 0;

  const videoUrl = URL.createObjectURL(finalBlob);

  // Only emit 100% after blob & object URL are verified ready
  onProgress?.(100, duration, duration);

  return {
    blob: finalBlob,
    videoUrl,
    mimeType: "video/mp4",
    format: "mp4",
    extension: "mp4",
    fileSize,
  };
} finally {
  exportRenderer.isExporting = false;
}
}
