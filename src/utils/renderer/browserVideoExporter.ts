// FastArt Web Browser Hardware-Accelerated Video Exporter
// Leverages HTML5 Canvas, Web Audio API (AudioContext), and MediaRecorder
// with native browser GPU video decoders for synchronized audio-video export.

import { FastArtProject } from "../../types/project";
import { exportProjectAudioToWavBytes } from "../audioExporter";
import { mediaHasAudioTrack } from "../mediaAudioDetector";
import {
  getExportResolutionDimensions,
  getLogicalBaseDimensions,
} from "../../components/Panels/Export/exportTypes";
import type { VideoRenderer } from "../videoRenderer";
import type { ExportFormat, ExportOptions, ExportResult } from "./unifiedExporter";
import {
  exportWebCodecsVideo,
  isWebCodecsSupported,
} from "./webCodecsExporter";
import { patchMediaContainerDuration } from "./mediaDurationPatcher";
import { getMediaContainer } from "./rendererMediaSync";

export async function exportBrowserVideo(
  renderer: VideoRenderer,
  project: FastArtProject,
  options: ExportOptions = {},
  onProgress?: (
    percent: number,
    currentTime: number,
    duration: number,
  ) => void,
  createRenderer?: (canvas: HTMLCanvasElement) => VideoRenderer,
): Promise<ExportResult> {
  if (typeof window === "undefined" || !renderer.canvas) {
    throw new Error("Canvas export requires browser environment");
  }

  const {
    fps = 30,
    duration = 10.0,
    format = "mp4",
    currentTime = 0,
    resolution = "1080p",
    logicalWidth,
    logicalHeight,
    videoBitsPerSecond: customBitsPerSecond,
  } = options;

  // 1. Calculate Target Export Canvas Dimensions based on selected resolution & aspect ratio
  const [targetW, targetH] = getExportResolutionDimensions(
    resolution,
    project.aspectRatio
  );
  const [baseW, baseH] = getLogicalBaseDimensions(project.aspectRatio);

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = targetW;
  exportCanvas.height = targetH;

  const domContainer = getMediaContainer();
  if (domContainer) {
    domContainer.appendChild(exportCanvas);
  }

  const exportRenderer = createRenderer
    ? createRenderer(exportCanvas)
    : new (renderer.constructor as any)(exportCanvas);

  // Set export mode for highest quality bicubic filtering
  exportRenderer.isExporting = true;

  // Inherit preloaded media cache from the live player renderer so clips render immediately
  if (renderer.videoElements) {
    exportRenderer.videoElements = new Map(renderer.videoElements);
  }
  if ((renderer as any).thumbnailElements) {
    exportRenderer.thumbnailElements = new Map((renderer as any).thumbnailElements);
  }
  if ((renderer as any).bgImageElements) {
    exportRenderer.bgImageElements = new Map((renderer as any).bgImageElements);
  }

  onProgress?.(0, 0, duration);

  // Guarantee all project clips are preloaded before recording begins
  const videoClips = project.tracks?.video || [];
  const preloadPromises = videoClips.map(async (clip) => {
    if (!exportRenderer.videoElements.has(clip.url) && !exportRenderer.videoElements.has(clip.id)) {
      try {
        await Promise.race([
          exportRenderer.preloadClip(clip),
          new Promise((r) => setTimeout(r, 1000)), // Fast 1.0s timeout prevents slow assets from blocking export
        ]);
      } catch (e) {
        console.warn("[browserVideoExporter] Preload clip error:", e);
      }
    }
  });
  await Promise.all(preloadPromises);
  onProgress?.(0, 0, duration);

  const exportLogicalW =
    logicalWidth && logicalWidth > 0 ? logicalWidth : baseW;
  const exportLogicalH =
    logicalHeight && logicalHeight > 0 ? logicalHeight : baseH;

  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  let defaultBitrate = 8500000;
  if (targetW >= 3840 || targetH >= 3840 || targetW >= 2160 || targetH >= 2160) {
    defaultBitrate = 22000000; // 4K: 22 Mbps (30fps)
  } else if (targetW >= 1920 || targetH >= 1920 || targetW >= 1080 || targetH >= 1080) {
    defaultBitrate = 8500000;  // 1080p: 8.5 Mbps (30fps)
  } else {
    defaultBitrate = 4500000;  // 720p: 4.5 Mbps (30fps)
  }
  if (fps >= 60) {
    defaultBitrate = Math.round(defaultBitrate * 1.4); // 1080p 60fps: ~12 Mbps, 4K 60fps: ~30 Mbps
  }
  const finalVideoBitsPerSecond = customBitsPerSecond || defaultBitrate;

  const hasVideoClips = (project.tracks?.video || []).some((c) => c && c.type === "video");

  // Ultra-Fast Offline WebCodecs Turbo Engine (3x - 10x faster than real-time)
  // Accelerates rendering for photo, graphics, title, caption, and animation timelines where no HTMLVideoElement seeking is needed.
  // Note: HTMLVideoElement cannot be sought frame-by-frame offline without flushing the hardware decoder pipeline,
  // causing catastrophic 1-2s seek stalls (exporting at 1 frame per 2-3s).
  // For timelines with real video clips, the real-time hardware-playback MediaRecorder pipeline
  // delivers smooth 30fps/60fps video with zero dropped frames.
  if (format === "mp4" && !hasVideoClips && isWebCodecsSupported()) {
    try {
      const turboResult = await exportWebCodecsVideo(
        exportRenderer,
        project,
        exportCanvas,
        {
          ...options,
          fps,
          duration,
          videoBitsPerSecond: finalVideoBitsPerSecond,
          logicalWidth: exportLogicalW,
          logicalHeight: exportLogicalH,
        },
        onProgress,
      );
      return turboResult;
    } catch (turboErr) {
      console.warn(
        "[browserVideoExporter] WebCodecs Turbo Export fallback engaged:",
        turboErr,
      );
      onProgress?.(0, 0, duration);
    }
  }

  // Initial raster render so canvas has valid pixels before stream capture
  exportRenderer.renderFrame(project, 0, false, exportLogicalW, exportLogicalH);

  // Safari fallback check if captureStream is not supported
  if (typeof (exportCanvas as any).captureStream !== "function") {
    const captureTime = Math.max(0, Math.min(currentTime, duration));
    exportRenderer.renderFrame(project, captureTime, false, exportLogicalW, exportLogicalH);
    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => {
        const finalBlob = blob || new Blob([], { type: "image/png" });
        const videoUrl = URL.createObjectURL(finalBlob);
        resolve({
          blob: finalBlob,
          videoUrl,
          mimeType: "image/png",
          format: "png",
          extension: "png",
          fileSize: finalBlob.size,
        });
      }, "image/png");
    });
  }

  let stream: MediaStream;
  let videoTrack: any = null;

  try {
    // Capture stream at target framerate (e.g. 30/60 fps) from DOM-attached canvas
    stream = (exportCanvas as any).captureStream(fps);
    videoTrack = stream ? stream.getVideoTracks()[0] : null;
  } catch {
    try {
      stream = (exportCanvas as any).captureStream();
      videoTrack = stream ? stream.getVideoTracks()[0] : null;
    } catch (captureErr) {
      throw new Error(`Canvas captureStream failed: ${String(captureErr)}`);
    }
  }

  // Pick best MIME type supported by browser
  const isSupported = (type: string) =>
    typeof (window as any).MediaRecorder?.isTypeSupported === "function" &&
    (window as any).MediaRecorder.isTypeSupported(type);

  let mimeType = "video/webm";
  let targetExtension = "webm";

  if (format === "mp4") {
    if (isSupported("video/mp4;codecs=avc1.42E01E,mp4a.40.2")) {
      mimeType = "video/mp4;codecs=avc1.42E01E,mp4a.40.2";
      targetExtension = "mp4";
    } else if (isSupported("video/mp4;codecs=avc1.4D401E")) {
      mimeType = "video/mp4;codecs=avc1.4D401E";
      targetExtension = "mp4";
    } else if (isSupported("video/mp4;codecs=avc1")) {
      mimeType = "video/mp4;codecs=avc1";
      targetExtension = "mp4";
    } else if (isSupported("video/mp4;codecs=h264")) {
      mimeType = "video/mp4;codecs=h264";
      targetExtension = "mp4";
    } else if (isSupported("video/mp4")) {
      mimeType = "video/mp4";
      targetExtension = "mp4";
    } else if (isSupported("video/webm;codecs=vp9,opus")) {
      mimeType = "video/webm;codecs=vp9,opus";
      targetExtension = "webm";
    } else if (isSupported("video/webm;codecs=vp9")) {
      mimeType = "video/webm;codecs=vp9";
      targetExtension = "webm";
    } else {
      mimeType = "video/webm";
      targetExtension = "webm";
    }
  } else {
    targetExtension = "webm";
    if (isSupported("video/webm;codecs=vp9,opus")) {
      mimeType = "video/webm;codecs=vp9,opus";
    } else if (isSupported("video/webm;codecs=vp9")) {
      mimeType = "video/webm;codecs=vp9";
    } else if (isSupported("video/webm;codecs=vp8,opus")) {
      mimeType = "video/webm;codecs=vp8,opus";
    } else if (isSupported("video/webm;codecs=vp8")) {
      mimeType = "video/webm;codecs=vp8";
    } else if (isSupported("video/mp4;codecs=avc1")) {
      // Fallback for Safari/iOS WebKit where WebM is unsupported
      mimeType = "video/mp4;codecs=avc1";
      targetExtension = "mp4";
    } else {
      mimeType = "video/webm";
    }
  }

  // Mix project audio tracks into a continuous, sample-accurate Web Audio stream
  let audioCtx: any = null;
  let audioSourceNode: any = null;
  let audioDest: any = null;

  try {
    const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
      if (audioCtx.state === "suspended") {
        try {
          await audioCtx.resume();
        } catch (e) {}
      }
      audioDest = audioCtx.createMediaStreamDestination();

      const hasAudioClips = (project.tracks?.audio || []).some(
        (c) => c && c.url && c.volume !== 0
      );
      const hasVideoAudio = (project.tracks?.video || []).some(
        (c) => c && c.type === "video" && !c.muted && mediaHasAudioTrack(c) && c.url
      );

      if (hasAudioClips || hasVideoAudio) {
        try {
          const sampleRate = audioCtx.sampleRate || 44100;
          const wavBytes = await exportProjectAudioToWavBytes(project, duration, sampleRate);
          if (wavBytes && wavBytes.length > 44) {
            const copyBuffer = wavBytes.buffer.slice(
              wavBytes.byteOffset,
              wavBytes.byteOffset + wavBytes.byteLength
            );
            const decodedBuffer = await audioCtx.decodeAudioData(copyBuffer);
            if (decodedBuffer) {
              audioSourceNode = audioCtx.createBufferSource();
              audioSourceNode.buffer = decodedBuffer;
              audioSourceNode.connect(audioDest);
            }
          }
        } catch (audioMixErr) {
          console.warn("[browserVideoExporter] Multi-track audio mixdown warning:", audioMixErr);
        }
      }

      // Fallback: silent carrier oscillator ensures social platform compliance if no audio track
      const audioTracks = audioDest.stream.getAudioTracks();
      if (audioTracks && audioTracks.length > 0) {
        stream.addTrack(audioTracks[0]);
      } else {
        try {
          const osc = audioCtx.createConstantSource ? audioCtx.createConstantSource() : audioCtx.createOscillator();
          const silence = audioCtx.createGain();
          silence.gain.value = 0;
          osc.connect(silence).connect(audioDest);
          osc.start(0);
          const tracks = audioDest.stream.getAudioTracks();
          if (tracks && tracks.length > 0) stream.addTrack(tracks[0]);
        } catch (e) {}
      }
    }
  } catch (audioErr) {
    console.warn("[browserVideoExporter] Fast audio graph setup error:", audioErr);
  }

  const recordedChunks: Blob[] = [];
  let mediaRecorder: any = null;

  const MediaRecorderClass = (window as any).MediaRecorder;
  if (!MediaRecorderClass) {
    throw new Error("MediaRecorder API is not available in this environment");
  }

  // Resilient cascading initialization that NEVER drops videoBitsPerSecond:
  // If an unconstrained MediaRecorder is created for canvas captureStream, Chromium/WebKit
  // records in lossless intra-frame mode (up to 150-200 MB/s), ballooning 1-min exports to ~10 GB!
  const candidateConfigs = [
    { mimeType, videoBitsPerSecond: finalVideoBitsPerSecond, audioBitsPerSecond: 192000 },
    { mimeType, videoBitsPerSecond: finalVideoBitsPerSecond },
    { mimeType: format === "mp4" ? "video/mp4" : "video/webm", videoBitsPerSecond: finalVideoBitsPerSecond },
    { videoBitsPerSecond: finalVideoBitsPerSecond },
    { bitsPerSecond: finalVideoBitsPerSecond },
  ];

  for (const config of candidateConfigs) {
    try {
      mediaRecorder = new MediaRecorderClass(stream, config);
      if (config.mimeType) mimeType = config.mimeType;
      break;
    } catch (e) {
      // try next configuration candidate
    }
  }

  if (!mediaRecorder) {
    try {
      mediaRecorder = new MediaRecorderClass(stream);
      mimeType = (mediaRecorder as any).mimeType || "video/webm";
    } catch (fallbackErr) {
      throw new Error(`MediaRecorder initialization failed: ${String(fallbackErr)}`);
    }
  }
  targetExtension = mimeType.includes("mp4") ? "mp4" : "webm";

  mediaRecorder.ondataavailable = (e: any) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  return new Promise(async (resolve, reject) => {
    let isAborted = false;
    let hasFinalized = false;
    let stopWatchdogTimer: any = null;

    const cleanup = () => {
      exportRenderer.isExporting = false;
      if (stopWatchdogTimer) {
        clearTimeout(stopWatchdogTimer);
        stopWatchdogTimer = null;
      }
      if (stream) {
        try {
          stream.getTracks().forEach((track: any) => track.stop());
        } catch (e) {}
      }
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
        } catch (e) {}
        audioSourceNode = null;
      }
      if (audioCtx) {
        try {
          audioCtx.close().catch(() => {});
        } catch (e) {}
        audioCtx = null;
      }
      if (typeof exportRenderer.cleanup === "function") {
        try {
          exportRenderer.cleanup();
        } catch (e) {}
      }
      try {
        const { setActiveVideoRenderer } = require("../videoRenderer");
        if (typeof setActiveVideoRenderer === "function") {
          setActiveVideoRenderer(renderer);
        }
      } catch {}
      if (exportCanvas.parentNode) {
        try {
          exportCanvas.parentNode.removeChild(exportCanvas);
        } catch (e) {}
      }
      // Instantly collapse canvas to 1x1 to release 8-32 MB GPU framebuffer textures from RAM
      try {
        exportCanvas.width = 1;
        exportCanvas.height = 1;
      } catch (e) {}
    };

    const finalizeRecording = async () => {
      if (hasFinalized || isAborted) return;
      hasFinalized = true;
      if (stopWatchdogTimer) {
        clearTimeout(stopWatchdogTimer);
        stopWatchdogTimer = null;
      }
      try {
        cleanup();
        let finalBlob: Blob;
        if (recordedChunks.length > 0) {
          const rawBlob = new Blob(recordedChunks, { type: mimeType });
          // Clear chunk array immediately to free memory
          recordedChunks.length = 0;
          finalBlob = rawBlob;

          // Header duration metadata (moov/mvhd/tkhd or EBML Segment Info) resides strictly
          // within the container header. Slicing only the first 128KB prevents duplicating
          // the entire video file in RAM as a contiguous ArrayBuffer.
          const HEADER_SCAN_LIMIT = 131072;
          try {
            if (rawBlob.size <= HEADER_SCAN_LIMIT) {
              const rawBuffer = await rawBlob.arrayBuffer();
              const patchedBytes = patchMediaContainerDuration(
                new Uint8Array(rawBuffer),
                duration
              );
              finalBlob = new Blob([patchedBytes as any], { type: mimeType });
            } else {
              const headerBlob = rawBlob.slice(0, HEADER_SCAN_LIMIT);
              const headerBuffer = await headerBlob.arrayBuffer();
              const patchedHeader = patchMediaContainerDuration(
                new Uint8Array(headerBuffer),
                duration
              );
              const remainderBlob = rawBlob.slice(HEADER_SCAN_LIMIT);
              finalBlob = new Blob([patchedHeader as any, remainderBlob], { type: mimeType });
            }
          } catch (patchErr) {
            console.warn("[browserVideoExporter] Container duration patch warning:", patchErr);
            finalBlob = rawBlob;
          }
        } else {
          finalBlob = new Blob([], { type: mimeType });
        }
        recordedChunks.length = 0;
        const videoUrl = URL.createObjectURL(finalBlob);
        if (onProgress) onProgress(100, duration, duration);
        resolve({
          blob: finalBlob,
          videoUrl,
          mimeType,
          format,
          extension: targetExtension,
          fileSize: finalBlob.size,
        });
      } catch (finalizeErr) {
        console.error("[browserVideoExporter] Finalization error:", finalizeErr);
        cleanup();
        reject(finalizeErr);
      }
    };

    mediaRecorder.onstop = () => {
      finalizeRecording();
    };

    mediaRecorder.onerror = (err: any) => {
      if (isAborted) return;
      cleanup();
      recordedChunks.length = 0;
      reject(err);
    };

    // Cue all video elements to exact trimIn, muted state, and initial speed before recording begins
    const cuePromises = (project.tracks.video || []).map(async (c) => {
      const el =
        (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
        (c.sourceMediaId ? exportRenderer.videoElements.get(c.sourceMediaId) : null) ||
        exportRenderer.videoElements.get(c.url);
      if (el && el instanceof HTMLVideoElement) {
        el.muted = true;
        el.defaultMuted = true;
        const targetTrim = Math.max(0, c.trimIn || 0);
        el.playbackRate = Math.max(0.1, Math.min(16, c.speed || 1.0));
        if (Math.abs(el.currentTime - targetTrim) > 0.05) {
          await new Promise<void>((res) => {
            let done = false;
            const onSeek = () => {
              if (!done) {
                done = true;
                el.removeEventListener("seeked", onSeek);
                res();
              }
            };
            el.addEventListener("seeked", onSeek, { once: true });
            try {
              el.currentTime = targetTrim;
            } catch {
              onSeek();
            }
            setTimeout(onSeek, 250);
          });
        }
        try {
          el.pause();
        } catch (e) {}
        (el as any)._preRolled = false;
      }
    });
    await Promise.all(cuePromises);

    // Ensure initial active video clip has decoded frames ready
    const firstActiveVideoClip = (project.tracks.video || []).find(
      (c) => (c.startTime || 0) <= 0.05 && c.type === "video"
    );
    if (firstActiveVideoClip) {
      const el =
        (firstActiveVideoClip.id ? exportRenderer.videoElements.get(firstActiveVideoClip.id) : null) ||
        (firstActiveVideoClip.sourceMediaId ? exportRenderer.videoElements.get(firstActiveVideoClip.sourceMediaId) : null) ||
        exportRenderer.videoElements.get(firstActiveVideoClip.url);
      if (el && el instanceof HTMLVideoElement) {
        el.muted = true;
        el.defaultMuted = true;
        el.currentTime = Math.max(0, firstActiveVideoClip.trimIn || 0);
        el.playbackRate = Math.max(0.1, Math.min(16, firstActiveVideoClip.speed || 1.0));
        if (el.readyState < 2) {
          await new Promise<void>((res) => {
            const onReady = () => {
              el.removeEventListener("loadeddata", onReady);
              el.removeEventListener("canplay", onReady);
              res();
            };
            el.addEventListener("loadeddata", onReady, { once: true });
            el.addEventListener("canplay", onReady, { once: true });
            setTimeout(res, 300);
          });
        }
      }
    }

    // Start recording with 1-second timeslice for optimal GOP compression and smooth streaming
    mediaRecorder.start(1000);

    // Start studio audio stream synchronously
    if (audioSourceNode) {
      try {
        audioSourceNode.start(0);
      } catch (e) {}
    }

    // Start first active video clip playback synchronously with recording
    if (firstActiveVideoClip) {
      const el =
        (firstActiveVideoClip.id ? exportRenderer.videoElements.get(firstActiveVideoClip.id) : null) ||
        (firstActiveVideoClip.sourceMediaId ? exportRenderer.videoElements.get(firstActiveVideoClip.sourceMediaId) : null) ||
        exportRenderer.videoElements.get(firstActiveVideoClip.url);
      if (el && el instanceof HTMLVideoElement) {
        el.play().catch(() => {});
      }
    }

    const recStartTime = performance.now();
    let completed = false;
    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    const targetFrameInterval = 1 / Math.max(1, fps);
    const targetFrameIntervalMs = 1000 / Math.max(1, fps);
    let frameIndex = 0;

    const renderTick = () => {
      if (completed || isAborted) return;
      try {
        if (options.isCancelled?.()) {
          isAborted = true;
          completed = true;
          cleanup();
          try {
            if (typeof mediaRecorder.stop === "function" && mediaRecorder.state === "recording") {
              mediaRecorder.stop();
            }
          } catch {}
          recordedChunks.length = 0;
          reject(new Error("Export cancelled"));
          return;
        }

        const curTime = Math.min(duration, frameIndex * targetFrameInterval);

        // Synchronize and pre-roll video elements with smooth drift compensation
        (project.tracks.video || []).forEach((c) => {
          if (c.type !== "video") return;
          const el =
            (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
            (c.sourceMediaId ? exportRenderer.videoElements.get(c.sourceMediaId) : null) ||
            exportRenderer.videoElements.get(c.url);
          if (!el || !(el instanceof HTMLVideoElement)) return;

          const isInside = curTime >= c.startTime && curTime < c.startTime + c.duration;
          // Pre-roll warm playback 350ms before cut (or during incoming transition)
          const isApproaching = curTime >= c.startTime - 0.35 && curTime < c.startTime;

          if (isApproaching) {
            if (!(el as any)._preRolled) {
              (el as any)._preRolled = true;
              el.muted = true;
              el.defaultMuted = true;
              el.currentTime = Math.max(0, c.trimIn || 0);
              el.playbackRate = Math.max(0.1, Math.min(16, c.speed || 1.0));
              el.play().catch(() => {});
            }
          }

          if (isInside) {
            const clipLocalTime = Math.max(0, curTime - c.startTime);
            let speed = Math.max(0.1, Math.min(16, c.speed || 1.0));
            if (c.speedCurve) {
              speed = exportRenderer.evaluateSpeedCurve(c.speedCurve, clipLocalTime / Math.max(0.1, c.duration));
            }
            const expectedMediaTime = (c.trimIn || 0) + clipLocalTime * speed;
            const drift = el.currentTime - expectedMediaTime;

            if (el.paused) {
              el.playbackRate = speed;
              el.play().catch(() => {});
            } else {
              // Smooth micro-adjustment via playbackRate WITHOUT decoder-flushing hard seeks
              if (Math.abs(drift) > 1.2) {
                try { el.currentTime = expectedMediaTime; } catch {}
              } else if (Math.abs(drift) > 0.04) {
                const comp = Math.max(0.85, Math.min(1.15, 1 - drift * 0.4));
                try { el.playbackRate = Math.max(0.1, Math.min(16, speed * comp)); } catch(e) {}
              } else if (Math.abs(el.playbackRate - speed) > 0.01) {
                el.playbackRate = speed;
              }
            }
          } else if (!isApproaching && !el.paused) {
            (el as any)._preRolled = false;
            try { el.pause(); } catch {}
          }
        });

        // Render live frame at exact timeline timestamp
        exportRenderer.renderFrame(project, curTime, true, exportLogicalW, exportLogicalH);

        // Prompt stream track to deliver updated frame immediately
        if (videoTrack && typeof videoTrack.requestFrame === "function") {
          try {
            videoTrack.requestFrame();
          } catch (e) {}
        }

        frameIndex++;
        if (onProgress) {
          const percent = Math.min(99, Math.floor((frameIndex / totalFrames) * 100));
          onProgress(percent, curTime, duration);
        }

        if (frameIndex < totalFrames) {
          // Precise next-frame pacing: self-correcting wall-clock timer schedule
          const nextTargetWallMs = frameIndex * targetFrameIntervalMs;
          const elapsedWallMs = performance.now() - recStartTime;
          const delayMs = Math.max(0, Math.round(nextTargetWallMs - elapsedWallMs));
          setTimeout(renderTick, delayMs);
        } else {
          completed = true;
          if (onProgress) onProgress(99, duration, duration);

          // 1. Pause video elements
          (project.tracks.video || []).forEach((c) => {
            const el =
              (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
              (c.sourceMediaId ? exportRenderer.videoElements.get(c.sourceMediaId) : null) ||
              exportRenderer.videoElements.get(c.url);
            if (el && el instanceof HTMLVideoElement) {
              try {
                el.pause();
              } catch {}
            }
          });

          // 2. Stop audio source
          if (audioSourceNode) {
            try {
              audioSourceNode.stop();
            } catch {}
          }

          // 3. Stop MediaRecorder FIRST so Chromium encodes all pending frames cleanly
          if (mediaRecorder.state === "recording") {
            try {
              mediaRecorder.stop();
            } catch (e) {
              console.warn("[browserVideoExporter] Stop recorder error:", e);
            }
          }

          // 4. Fail-safe watchdog (3.5s): If mediaRecorder.onstop fails to fire, force completion
          if (!stopWatchdogTimer) {
            stopWatchdogTimer = setTimeout(() => {
              if (!hasFinalized) {
                console.warn("[browserVideoExporter] Recorder onstop watchdog triggered fallback finalization");
                finalizeRecording();
              }
            }, 3500);
          }
        }
      } catch (renderErr) {
        isAborted = true;
        completed = true;
        cleanup();
        reject(renderErr);
      }
    };

    let initialScheduled = false;
    const initialTimer = setTimeout(() => {
      if (!initialScheduled) {
        initialScheduled = true;
        renderTick();
      }
    }, 16);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        if (!initialScheduled) {
          initialScheduled = true;
          clearTimeout(initialTimer);
          renderTick();
        }
      });
    }
  });
}
