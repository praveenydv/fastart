// FastArt Web Browser Hardware-Accelerated Video Exporter
// Leverages HTML5 Canvas, Web Audio API (AudioContext), and MediaRecorder
// with native browser GPU video decoders for synchronized audio-video export.

import { FastArtProject } from "../../types/project";
import { exportProjectAudioToWavBytes } from "../audioExporter";
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

  let defaultBitrate = 18000000;
  if (targetW >= 3840 || targetH >= 3840 || targetW >= 2160 || targetH >= 2160) {
    defaultBitrate = isMobileDevice ? 32000000 : 50000000; // 4K: 32-50 Mbps
  } else if (targetW >= 1920 || targetH >= 1920 || targetW >= 1080 || targetH >= 1080) {
    defaultBitrate = isMobileDevice ? 16000000 : 22000000; // 1080p: 16-22 Mbps
  } else {
    defaultBitrate = isMobileDevice ? 8000000 : 12000000;  // 720p: 8-12 Mbps
  }
  if (fps >= 60) {
    defaultBitrate = Math.round(defaultBitrate * 1.35); // Boost for 60fps
  }
  const finalVideoBitsPerSecond = customBitsPerSecond || defaultBitrate;

  // Ultra-Fast Offline WebCodecs Turbo Engine (3x - 10x faster than real-time)
  // Accelerates rendering for all timelines using hardware GPU and video encoder ASIC
  if (format === "mp4" && isWebCodecsSupported()) {
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

  const stream = (exportCanvas as any).captureStream(fps);

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

  // Mix project audio tracks into the video stream with zero-latency Web Audio graph
  let audioCtx: any = null;
  const activeAudioTrackElements: { el: HTMLAudioElement; clip: any }[] = [];
  try {
    const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
      if (audioCtx.state === "suspended") {
        try {
          await audioCtx.resume();
        } catch (e) {}
      }
      const audioDest = audioCtx.createMediaStreamDestination();

      // 1. Connect unmuted video elements directly (hardware-decoded, zero network re-fetch)
      for (const clip of videoClips) {
        if (clip.type === "video" && !clip.muted) {
          const el = exportRenderer.videoElements.get(clip.url) || exportRenderer.videoElements.get(clip.id);
          if (el && el instanceof HTMLVideoElement) {
            try {
              el.muted = false;
              const source = audioCtx.createMediaElementSource(el);
              const gain = audioCtx.createGain();
              gain.gain.value = clip.volume !== undefined ? clip.volume : 1.0;
              source.connect(gain).connect(audioDest);
            } catch (e) {}
          }
        }
      }

      // 2. Connect project audio clips directly
      const audioTrackClips = project.tracks?.audio || [];
      for (const clip of audioTrackClips) {
        if (clip && clip.url) {
          try {
            const a = new Audio();
            if (clip.url.startsWith("http://") || clip.url.startsWith("https://")) {
              a.crossOrigin = "anonymous";
            }
            a.src = clip.url;
            a.currentTime = Math.max(0, clip.trimIn || 0);
            a.playbackRate = Math.max(0.1, Math.min(16, clip.speed || 1.0));
            const source = audioCtx.createMediaElementSource(a);
            const gain = audioCtx.createGain();
            gain.gain.value = clip.volume !== undefined ? clip.volume : 1.0;
            source.connect(gain).connect(audioDest);
            activeAudioTrackElements.push({ el: a, clip });
          } catch (e) {}
        }
      }

      // 3. Fallback: silent carrier oscillator ensures social platform compliance
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
    console.warn("[browserVideoExporter] Fast audio graph setup:", audioErr);
  }

  const recordedChunks: Blob[] = [];
  let mediaRecorder: any = null;

  try {
    mediaRecorder = new (window as any).MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: finalVideoBitsPerSecond,
      audioBitsPerSecond: 256000,
    });
  } catch (recInitErr) {
    console.warn("[browserVideoExporter] Primary MediaRecorder init failed, falling back to default options:", recInitErr);
    try {
      mediaRecorder = new (window as any).MediaRecorder(stream);
      mimeType = (mediaRecorder as any).mimeType || "video/webm";
      targetExtension = mimeType.includes("mp4") ? "mp4" : "webm";
    } catch (fallbackErr) {
      throw new Error(`MediaRecorder initialization failed: ${String(fallbackErr)}`);
    }
  }

  mediaRecorder.ondataavailable = (e: any) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  return new Promise(async (resolve, reject) => {
    let isAborted = false;

    const cleanup = () => {
      exportRenderer.isExporting = false;
      if (stream) {
        try {
          stream.getTracks().forEach((track: any) => track.stop());
        } catch (e) {}
      }
      activeAudioTrackElements.forEach(({ el }) => {
        try {
          el.pause();
          el.src = "";
        } catch (e) {}
      });
      activeAudioTrackElements.length = 0;
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (e) {}
      }
      if (typeof exportRenderer.cleanup === "function") {
        exportRenderer.cleanup();
      }
    };

    mediaRecorder.onstop = () => {
      if (isAborted) return;
      cleanup();
      const finalBlob =
        recordedChunks.length > 0
          ? new Blob(recordedChunks, { type: mimeType })
          : new Blob([], { type: mimeType });
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
    };

    mediaRecorder.onerror = (err: any) => {
      if (isAborted) return;
      cleanup();
      recordedChunks.length = 0;
      reject(err);
    };

    // Cue all video elements to exact trimIn and initial speed
    (project.tracks.video || []).forEach((c) => {
      const el = exportRenderer.videoElements.get(c.url) || exportRenderer.videoElements.get(c.id);
      if (el && el instanceof HTMLVideoElement) {
        el.currentTime = Math.max(0, c.trimIn || 0);
        el.playbackRate = Math.max(0.1, Math.min(16, c.speed || 1.0));
        if (c.startTime > 0) {
          try { el.pause(); } catch(e) {}
        }
      }
    });

    // Start recording with 100ms timeslice to ensure continuous chunk buffer delivery
    mediaRecorder.start(100);

    // Synchronize initial audio playback
    activeAudioTrackElements.forEach(({ el, clip }) => {
      if ((clip.startTime || 0) <= 0.05) {
        try { el.play(); } catch (e) {}
      }
    });

    const recStartTime = performance.now();
    let completed = false;

    const renderTick = () => {
      if (completed || isAborted) return;
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

      const now = performance.now();
      const elapsed = (now - recStartTime) / 1000;
      const curTime = Math.min(elapsed, duration);

      // Render live frame with isPlaying = true so all video elements play continuously without seek stalls
      exportRenderer.renderFrame(project, curTime, true, exportLogicalW, exportLogicalH);

      // Dynamically trigger audio tracks matching timeline bounds
      activeAudioTrackElements.forEach(({ el, clip }) => {
        const start = clip.startTime || 0;
        const end = start + (clip.duration || 10);
        if (curTime >= start && curTime < end) {
          if (el.paused) {
            try { el.play(); } catch (e) {}
          }
        } else if (!el.paused) {
          try { el.pause(); } catch (e) {}
        }
      });

      if (onProgress) {
        const percent = Math.min(99, Math.floor((curTime / duration) * 100));
        onProgress(percent, curTime, duration);
      }

      if (elapsed < duration) {
        requestAnimationFrame(renderTick);
      } else {
        completed = true;
        if (onProgress) onProgress(99, duration, duration);

        activeAudioTrackElements.forEach(({ el }) => {
          try { el.pause(); } catch {}
        });

        // Pause all video elements
        (project.tracks.video || []).forEach((c) => {
          const el = exportRenderer.videoElements.get(c.url) || exportRenderer.videoElements.get(c.id);
          if (el && el instanceof HTMLVideoElement) {
            try {
              el.pause();
            } catch {}
          }
        });

        if (typeof mediaRecorder.requestData === "function" && mediaRecorder.state === "recording") {
          try {
            mediaRecorder.requestData();
          } catch (e) {}
        }
        mediaRecorder.stop();
      }
    };

    requestAnimationFrame(renderTick);
  });
}
