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

  // Dedicated, isolated video and image element instances for export:
  // Each project clip gets its own independent HTMLVideoElement keyed by clip.id,
  // preventing play/pause collisions across multiple clips, split segments, or transitions,
  // and ensuring the live preview player's media cache is never corrupted or destroyed!
  exportRenderer.videoElements = new Map();
  const createdExportMediaElements: (HTMLVideoElement | HTMLImageElement)[] = [];

  const videoClips = project.tracks?.video || [];
  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    if (!clip || !clip.url) continue;
    const clipKey = clip.id || `export_clip_${i}`;

    if (clip.type === "video") {
      const vid = document.createElement("video");
      vid.muted = true;
      vid.defaultMuted = true;
      vid.playsInline = true;
      (vid as any).playsinline = true;
      vid.preload = "auto";
      if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
        vid.crossOrigin = "anonymous";
      }
      vid.src = clip.url;
      try {
        vid.load();
      } catch (e) {}
      if (domContainer) {
        domContainer.appendChild(vid);
      }
      createdExportMediaElements.push(vid);
      exportRenderer.videoElements.set(clipKey, vid);
      if (clip.id) exportRenderer.videoElements.set(clip.id, vid);
      if (clip.sourceMediaId) exportRenderer.videoElements.set(clip.sourceMediaId, vid);
      if (!exportRenderer.videoElements.has(clip.url)) {
        exportRenderer.videoElements.set(clip.url, vid);
      }
    } else {
      const img = new Image();
      if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
        img.crossOrigin = "anonymous";
      }
      img.src = clip.url;
      createdExportMediaElements.push(img);
      exportRenderer.videoElements.set(clipKey, img);
      if (clip.id) exportRenderer.videoElements.set(clip.id, img);
      if (!exportRenderer.videoElements.has(clip.url)) {
        exportRenderer.videoElements.set(clip.url, img);
      }
    }
  }

  // Pre-cue all media elements to readyState >= 2 and exact trimIn before rendering frame 0
  const cuePromises = (project.tracks.video || []).map(async (c, idx) => {
    if (!c) return;
    const clipKey = c.id || `export_clip_${idx}`;
    if (c.type !== "video") {
      const img =
        (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
        exportRenderer.videoElements.get(clipKey) ||
        exportRenderer.videoElements.get(c.url);
      if (img && img instanceof HTMLImageElement && !img.complete) {
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          setTimeout(res, 2500);
        });
      }
      return;
    }
    const el =
      (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
      (c.sourceMediaId ? exportRenderer.videoElements.get(c.sourceMediaId) : null) ||
      exportRenderer.videoElements.get(clipKey) ||
      exportRenderer.videoElements.get(c.url);
    if (el && el instanceof HTMLVideoElement) {
      el.muted = true;
      el.defaultMuted = true;
      const targetTrim = c.reverse
        ? (c.trimOut || (c.trimIn || 0) + (c.duration || 0))
        : Math.max(0, c.trimIn || 0);
      el.playbackRate = Math.max(0.1, Math.min(16, c.speed || 1.0));

      // Ensure video has loaded data before seeking
      if (el.readyState < 2) {
        await new Promise<void>((res) => {
          let done = false;
          const onReady = () => {
            if (!done) {
              done = true;
              el.removeEventListener("loadeddata", onReady);
              el.removeEventListener("canplay", onReady);
              res();
            }
          };
          el.addEventListener("loadeddata", onReady, { once: true });
          el.addEventListener("canplay", onReady, { once: true });
          setTimeout(onReady, 2500);
        });
      }

      if (Math.abs(el.currentTime - targetTrim) > 0.04 || el.seeking) {
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
          setTimeout(onSeek, 2500);
        });
      }
      try {
        el.pause();
      } catch (e) {}
      (el as any)._isExportStarted = false;
      (el as any)._isPlayPending = false;
    }
  });
  await Promise.all(cuePromises);

  if ((renderer as any).thumbnailElements) {
    exportRenderer.thumbnailElements = new Map((renderer as any).thumbnailElements);
  }
  if ((renderer as any).bgImageElements) {
    exportRenderer.bgImageElements = new Map((renderer as any).bgImageElements);
  }

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
      createdExportMediaElements.forEach((el) => {
        if (el instanceof HTMLVideoElement) {
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
            if (el.parentNode) el.parentNode.removeChild(el);
          } catch (e) {}
        }
      });
      createdExportMediaElements.length = 0;
      exportRenderer.videoElements.clear();
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

          try {
            const rawBuffer = await rawBlob.arrayBuffer();
            const patchedBytes = patchMediaContainerDuration(
              new Uint8Array(rawBuffer),
              duration
            );
            finalBlob = new Blob([patchedBytes as any], { type: mimeType });
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

    // Start studio audio stream synchronously
    if (audioSourceNode) {
      try {
        audioSourceNode.start(0);
      } catch (e) {}
    }

    // Start initial active video clips (startTime <= 0.05) synchronously with recording
    const initialClips = (project.tracks.video || []).filter(
      (c) => (c.startTime || 0) <= 0.05 && c.type === "video"
    );
    for (const initClip of initialClips) {
      const el =
        (initClip.id ? exportRenderer.videoElements.get(initClip.id) : null) ||
        (initClip.sourceMediaId ? exportRenderer.videoElements.get(initClip.sourceMediaId) : null) ||
        exportRenderer.videoElements.get(initClip.url);
      if (el && el instanceof HTMLVideoElement) {
        (el as any)._isExportStarted = true;
        (el as any)._isPlayPending = false;
        el.play().catch(() => {});
      }
    }

    // Render frame 0 with isPlaying=true immediately before starting recorder
    exportRenderer.renderFrame(project, 0, true, exportLogicalW, exportLogicalH);

    // Start recording with 250ms timeslice: continuously streams chunks to JS to keep
    // Chromium's native encoder memory strictly bounded (< 20 MB) with zero frame accumulation
    mediaRecorder.start(250);

    const recStartTime = performance.now();
    let completed = false;
    const targetFrameIntervalMs = 1000 / Math.max(1, fps);

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

        const elapsedWallMs = performance.now() - recStartTime;
        const curTime = Math.min(duration, elapsedWallMs / 1000);

        // Check if recording duration has been reached
        if (elapsedWallMs >= duration * 1000 || curTime >= duration) {
          completed = true;

          // Render exact final frame
          exportRenderer.renderFrame(project, duration, true, exportLogicalW, exportLogicalH);
          if (onProgress) onProgress(99, duration, duration);

          // 1. Immediately pause video elements
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

          // 4. Immediately stop all MediaStream tracks so encoder stops receiving frames
          if (stream) {
            try {
              stream.getTracks().forEach((track: any) => track.stop());
            } catch (e) {}
          }

          // 5. Fail-safe watchdog (3.5s): If mediaRecorder.onstop fails to fire, force completion
          if (!stopWatchdogTimer) {
            stopWatchdogTimer = setTimeout(() => {
              if (!hasFinalized) {
                console.warn("[browserVideoExporter] Recorder onstop watchdog triggered fallback finalization");
                finalizeRecording();
              }
            }, 3500);
          }
          return;
        }

        const videoClips = project.tracks.video || [];

        // Synchronize video element playback across timeline cuts and transitions
        for (let i = 0; i < videoClips.length; i++) {
          const c = videoClips[i];
          if (c.type !== "video") continue;
          const el =
            (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
            (c.sourceMediaId ? exportRenderer.videoElements.get(c.sourceMediaId) : null) ||
            exportRenderer.videoElements.get(c.url);
          if (!el || !(el instanceof HTMLVideoElement)) continue;

          // Check if an incoming transition from a preceding clip on the same track requires this clip to play early
          let transLead = 0;
          for (let j = 0; j < videoClips.length; j++) {
            const other = videoClips[j];
            if (other.id !== c.id && (other.trackIndex || 0) === (c.trackIndex || 0)) {
              const otherEnd = (other.startTime || 0) + (other.duration || 0);
              const otherTrans = other.transition;
              if (
                otherTrans &&
                otherTrans.duration > 0 &&
                otherTrans.type &&
                otherTrans.type !== "none" &&
                otherTrans.type !== "cut" &&
                Math.abs(otherEnd - c.startTime) < 0.35
              ) {
                transLead = otherTrans.duration;
                break;
              }
            }
          }

          const activeStart = Math.max(0, c.startTime - transLead);
          const activeEnd = c.startTime + c.duration;
          const isInside = curTime >= activeStart && curTime < activeEnd;

          // Pre-cue upcoming clip if it drifted while dormant so it's ready at the cut
          const isApproaching = curTime >= c.startTime - 1.0 && curTime < c.startTime;
          if (isApproaching && el.paused && !el.seeking) {
            const targetTrim = c.reverse
              ? (c.trimOut || (c.trimIn || 0) + (c.duration || 0))
              : Math.max(0, c.trimIn || 0);
            if (Math.abs(el.currentTime - targetTrim) > 0.05) {
              try { el.currentTime = targetTrim; } catch {}
            }
          }

          if (isInside) {
            let clipLocalTime = Math.max(0, curTime - c.startTime);
            if (curTime < c.startTime && transLead > 0) {
              const transProg = Math.max(0, Math.min(1, (curTime - (c.startTime - transLead)) / transLead));
              clipLocalTime = transProg * transLead;
            }
            let speed = Math.max(0.1, Math.min(16, c.speed || 1.0));
            if (c.speedCurve) {
              speed = exportRenderer.evaluateSpeedCurve(c.speedCurve, clipLocalTime / Math.max(0.1, c.duration));
            }
            const rawMediaTime = c.reverse
              ? Math.max(0, (c.trimOut || (c.trimIn || 0) + (c.duration || 0)) - clipLocalTime * speed)
              : (c.trimIn || 0) + clipLocalTime * speed;
            const expectedMediaTime = el.duration && el.duration > 0
              ? Math.min(el.duration, Math.max(0, rawMediaTime))
              : Math.max(0, rawMediaTime);

            if (el.paused) {
              if (!(el as any)._isPlayPending) {
                (el as any)._isPlayPending = true;
                if (Math.abs(el.currentTime - expectedMediaTime) > 0.05) {
                  try { el.currentTime = expectedMediaTime; } catch {}
                }
                el.playbackRate = speed;
                const p = el.play();
                if (p && typeof p.then === "function") {
                  p.then(() => {
                    (el as any)._isPlayPending = false;
                  }).catch(() => {
                    (el as any)._isPlayPending = false;
                  });
                } else {
                  (el as any)._isPlayPending = false;
                }
              }
            } else {
              (el as any)._isPlayPending = false;
              const drift = el.currentTime - expectedMediaTime;
              // Smooth micro-adjustment via playbackRate WITHOUT decoder-flushing hard seeks.
              // Hard seeking during playback flushes the hardware decoder pipeline, stalling frames!
              if (Math.abs(drift) > 0.08) {
                const comp = Math.max(0.80, Math.min(1.20, 1 - drift * 0.4));
                try {
                  el.playbackRate = Math.max(0.1, Math.min(16, speed * comp));
                } catch {}
              } else if (Math.abs(el.playbackRate - speed) > 0.01) {
                el.playbackRate = speed;
              }
            }
          } else {
            (el as any)._isExportStarted = false;
            (el as any)._isPlayPending = false;
            if (!el.paused) {
              try { el.pause(); } catch {}
            }
          }
        }

        // Render live frame at exact timeline timestamp
        exportRenderer.renderFrame(project, curTime, true, exportLogicalW, exportLogicalH);

        if (onProgress) {
          const percent = Math.min(99, Math.floor((curTime / duration) * 100));
          onProgress(percent, curTime, duration);
        }

        // Precise next-frame pacing: self-correcting wall-clock timer schedule
        const nextTargetWallMs = Math.floor(elapsedWallMs / targetFrameIntervalMs + 1) * targetFrameIntervalMs;
        const delayMs = Math.max(4, Math.round(nextTargetWallMs - elapsedWallMs));
        setTimeout(renderTick, delayMs);
      } catch (renderErr) {
        isAborted = true;
        completed = true;
        cleanup();
        reject(renderErr);
      }
    };

    // Synchronously execute frame 0 so the recorder captures the pristine, cued initial frame
    renderTick();
  });
}
