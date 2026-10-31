// FastArt Web Browser Hardware-Accelerated Video Exporter
// Leverages HTML5 Canvas, Web Audio API (AudioContext), and MediaRecorder
// with native browser GPU video decoders for synchronized audio-video export.

import { FastArtProject } from "../../types/project";
import { exportProjectAudioToWav } from "../audioExporter";
import type { VideoRenderer } from "../videoRenderer";
import type { ExportFormat, ExportOptions, ExportResult } from "./unifiedExporter";

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
    logicalWidth,
    logicalHeight,
    videoBitsPerSecond: customBitsPerSecond,
  } = options;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = renderer.canvas.width;
  exportCanvas.height = renderer.canvas.height;
  const exportRenderer = createRenderer
    ? createRenderer(exportCanvas)
    : new (renderer.constructor as any)(exportCanvas);
  // Inherit preloaded media cache from this renderer so clips render immediately
  exportRenderer.videoElements = new Map(renderer.videoElements);

  // Guarantee all project clips are preloaded before recording begins
  for (const clip of project.tracks?.video || []) {
    if (!exportRenderer.videoElements.has(clip.url)) {
      try {
        await exportRenderer.preloadClip(clip);
      } catch (e) {
        console.warn("[browserVideoExporter] Preload clip error:", e);
      }
    }
  }

  const exportLogicalW =
    logicalWidth && logicalWidth > 0
      ? logicalWidth
      : renderer.canvas.clientWidth > 0
        ? renderer.canvas.clientWidth
        : exportCanvas.width;

  const exportLogicalH =
    logicalHeight && logicalHeight > 0
      ? logicalHeight
      : renderer.canvas.clientHeight > 0
        ? renderer.canvas.clientHeight
        : exportCanvas.height;

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
    } else if (isSupported("video/mp4;codecs=avc1")) {
      mimeType = "video/mp4;codecs=avc1";
      targetExtension = "mp4";
    } else if (isSupported("video/mp4")) {
      mimeType = "video/mp4";
      targetExtension = "mp4";
    } else if (isSupported("video/mp4;codecs=h264")) {
      mimeType = "video/mp4;codecs=h264";
      targetExtension = "mp4";
    } else if (isSupported("video/webm;codecs=h264")) {
      mimeType = "video/webm;codecs=h264";
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
    } else {
      mimeType = "video/webm";
    }
  }

  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  let defaultBitrate = 22000000; // 22 Mbps Full HD baseline
  if (
    exportCanvas.width >= 3840 ||
    exportCanvas.height >= 3840 ||
    exportCanvas.width >= 2160 ||
    exportCanvas.height >= 2160
  ) {
    defaultBitrate = isMobileDevice ? 35000000 : 50000000; // 35 - 50 Mbps 4K Ultra HD
  } else if (
    exportCanvas.width >= 1920 ||
    exportCanvas.height >= 1920 ||
    exportCanvas.width >= 1080 ||
    exportCanvas.height >= 1080
  ) {
    defaultBitrate = isMobileDevice ? 18000000 : 25000000; // 18 - 25 Mbps 1080p FHD
  } else {
    defaultBitrate = isMobileDevice ? 8000000 : 12000000; // 8 - 12 Mbps 720p HD
  }
  const finalVideoBitsPerSecond = customBitsPerSecond || defaultBitrate;

  // Mix project audio tracks into the video stream for complete synchronized sound
  let audioCtx: any = null;
  let audioSourceNode: any = null;
  try {
    const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    const hasAudio =
      (project.tracks.audio && project.tracks.audio.length > 0) ||
      (project.tracks.video && project.tracks.video.length > 0);
    if (AudioCtxClass && hasAudio) {
      audioCtx = new AudioCtxClass();
      if (audioCtx.state === "suspended") {
        try {
          await audioCtx.resume();
        } catch (e) {}
      }
      const audioDest = audioCtx.createMediaStreamDestination();
      const audioBlob = await exportProjectAudioToWav(
        project,
        duration,
        audioCtx.sampleRate || 44100
      );
      if (audioBlob && audioBlob.size > 44) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioSourceNode = audioCtx.createBufferSource();
        audioSourceNode.buffer = audioBuffer;
        audioSourceNode.connect(audioDest);
        const audioTracks = audioDest.stream.getAudioTracks();
        if (audioTracks && audioTracks.length > 0) {
          stream.addTrack(audioTracks[0]);
        }
      }
    }
  } catch (audioErr) {
    console.warn("[browserVideoExporter] Audio mixing in video export:", audioErr);
  }

  const recordedChunks: Blob[] = [];
  const mediaRecorder = new (window as any).MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: finalVideoBitsPerSecond,
    audioBitsPerSecond: 320000,
  });

  mediaRecorder.ondataavailable = (e: any) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  return new Promise(async (resolve, reject) => {
    let isAborted = false;

    mediaRecorder.onstop = () => {
      if (isAborted) return;
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
          audioSourceNode.disconnect();
        } catch (e) {}
      }
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (e) {}
      }
      if (typeof exportRenderer.cleanup === "function") {
        exportRenderer.cleanup();
      }
      const finalBlob =
        recordedChunks.length > 0
          ? new Blob(recordedChunks, { type: mimeType })
          : new Blob([], { type: mimeType });
      const videoUrl = URL.createObjectURL(finalBlob);
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
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
          audioSourceNode.disconnect();
        } catch (e) {}
      }
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (e) {}
      }
      if (typeof exportRenderer.cleanup === "function") {
        exportRenderer.cleanup();
      }
      reject(err);
    };

    // Mute video elements and cue to start
    (project.tracks.video || []).forEach((c) => {
      const el = exportRenderer.videoElements.get(c.url);
      if (el && el instanceof HTMLVideoElement) {
        el.muted = true;
        el.currentTime = Math.max(0, c.trimIn || 0);
      }
    });

    // Start recording with 100ms timeslice to ensure continuous chunk buffer delivery
    mediaRecorder.start(100);

    // Audio node begins strictly at frame 0 synchronized with recorder start
    if (audioSourceNode) {
      try {
        audioSourceNode.start(0);
      } catch (e) {}
    }

    const recStartTime = performance.now();
    let completed = false;

    const renderTick = () => {
      if (completed || isAborted) return;
      if (options.isCancelled?.()) {
        isAborted = true;
        completed = true;
        try {
          if (typeof mediaRecorder.stop === "function" && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
          }
        } catch {}
        if (audioSourceNode) {
          try {
            audioSourceNode.stop();
            audioSourceNode.disconnect();
          } catch {}
        }
        if (audioCtx) {
          try {
            audioCtx.close();
          } catch {}
        }
        if (typeof exportRenderer.cleanup === "function") {
          exportRenderer.cleanup();
        }
        reject(new Error("Export cancelled"));
        return;
      }
      const now = performance.now();
      const elapsed = (now - recStartTime) / 1000;
      const curTime = Math.min(elapsed, duration);

      // Render live frame with isPlaying = true so all video elements play continuously without seek stalls
      exportRenderer.renderFrame(project, curTime, true, exportLogicalW, exportLogicalH);

      if (onProgress) {
        const percent = Math.min(99, Math.round((curTime / duration) * 100));
        onProgress(percent, curTime, duration);
      }

      if (elapsed < duration) {
        requestAnimationFrame(renderTick);
      } else {
        completed = true;
        if (onProgress) onProgress(100, duration, duration);

        // Pause all video elements
        (project.tracks.video || []).forEach((c) => {
          const el = exportRenderer.videoElements.get(c.url);
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
