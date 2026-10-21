import { FastArtProject } from "../../types/project";
import { createGif, GifFrame } from "../gifEncoder";
import { exportProjectAudioToWav } from "../audioExporter";
import type { VideoRenderer } from "../videoRenderer";

export type ExportFormat = "mp4" | "webm" | "gif" | "png" | "wav";

export interface ExportOptions {
  fps?: number;
  duration?: number;
  format?: ExportFormat;
  currentTime?: number;
  logicalWidth?: number;
  logicalHeight?: number;
  videoBitsPerSecond?: number;
}

export interface ExportResult {
  blob: Blob;
  videoUrl: string;
  mimeType: string;
  format: ExportFormat;
  extension: string;
  fileSize?: number;
}

export async function exportVideo(
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

  // 1. PNG Snapshot / Poster Frame Export
  if (format === "png") {
    const captureTime = Math.max(0, Math.min(currentTime, duration));
    exportRenderer.renderFrame(project, captureTime, false, exportLogicalW, exportLogicalH);
    if (onProgress) onProgress(100, captureTime, duration);

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

  // 2. WAV Studio Audio Export
  if (format === "wav") {
    if (onProgress) onProgress(50, 0, duration);
    const audioBlob = await exportProjectAudioToWav(project, duration, 44100);
    if (onProgress) onProgress(100, duration, duration);
    const videoUrl = URL.createObjectURL(audioBlob);
    return {
      blob: audioBlob,
      videoUrl,
      mimeType: "audio/wav",
      format: "wav",
      extension: "wav",
      fileSize: audioBlob.size,
    };
  }

  // 3. GIF Animated Image Export
  if (format === "gif") {
    const gifFps = Math.min(fps, 12); // standard 10-12 fps for smooth lightweight GIF
    const gifFramesCount = Math.ceil(duration * gifFps);
    const delayMs = Math.round(1000 / gifFps);

    // Downscale canvas to max 480px width for fast encoding & optimized file size
    const maxGifWidth = 480;
    const scale = Math.min(1, maxGifWidth / exportCanvas.width);
    const gifW = Math.round(exportCanvas.width * scale);
    const gifH = Math.round(exportCanvas.height * scale);

    const gifCanvas = document.createElement("canvas");
    gifCanvas.width = gifW;
    gifCanvas.height = gifH;
    const gifCtx = gifCanvas.getContext("2d", { willReadFrequently: true });

    const gifFrames: GifFrame[] = [];

    for (let frame = 0; frame < gifFramesCount; frame++) {
      const frameTime = frame / gifFps;
      exportRenderer.renderFrame(project, frameTime, false, exportLogicalW, exportLogicalH);

      if (gifCtx) {
        gifCtx.clearRect(0, 0, gifW, gifH);
        gifCtx.drawImage(exportCanvas, 0, 0, gifW, gifH);
        const imgData = gifCtx.getImageData(0, 0, gifW, gifH);
        gifFrames.push({ imageData: imgData, delayMs });
      }

      if (onProgress) {
        const percent = Math.round(((frame + 1) / gifFramesCount) * 85);
        onProgress(percent, frameTime, duration);
      }

      await new Promise((r) => setTimeout(r, 10));
    }

    if (onProgress) onProgress(90, duration, duration);
    const gifBytes = createGif(gifW, gifH, gifFrames, 0);
    const gifBlob = new Blob([gifBytes.buffer as ArrayBuffer], { type: "image/gif" });
    const videoUrl = URL.createObjectURL(gifBlob);
    if (onProgress) onProgress(100, duration, duration);

    return {
      blob: gifBlob,
      videoUrl,
      mimeType: "image/gif",
      format: "gif",
      extension: "gif",
      fileSize: gifBlob.size,
    };
  }

  // 4. Video Recording (MP4 or WebM)
  // Initial frame render so canvas has raster pixels before stream capture
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
    if (isSupported("video/mp4;codecs=avc1")) {
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
    if (isSupported("video/webm;codecs=vp9")) {
      mimeType = "video/webm;codecs=vp9";
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
  if (exportCanvas.width >= 3840 || exportCanvas.height >= 3840 || exportCanvas.width >= 2160 || exportCanvas.height >= 2160) {
    defaultBitrate = isMobileDevice ? 35000000 : 50000000; // 35 - 50 Mbps 4K Ultra HD
  } else if (exportCanvas.width >= 1920 || exportCanvas.height >= 1920 || exportCanvas.width >= 1080 || exportCanvas.height >= 1080) {
    defaultBitrate = isMobileDevice ? 18000000 : 25000000; // 18 - 25 Mbps 1080p FHD
  } else {
    defaultBitrate = isMobileDevice ? 8000000 : 12000000;  // 8 - 12 Mbps 720p HD
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
      const audioDest = audioCtx.createMediaStreamDestination();
      const audioBlob = await exportProjectAudioToWav(project, duration, audioCtx.sampleRate || 44100);
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
        audioSourceNode.start(0);
      }
    }
  } catch (audioErr) {
    console.warn("Audio mixing in video export:", audioErr);
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
    mediaRecorder.onstop = () => {
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
        } catch (e) {}
      }
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (e) {}
      }
      exportRenderer.cleanup();
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
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
        } catch (e) {}
      }
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (e) {}
      }
      exportRenderer.cleanup();
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
    if (audioSourceNode) {
      try {
        audioSourceNode.start(0);
      } catch (e) {}
    }

    const recStartTime = performance.now();
    let completed = false;

    const renderTick = () => {
      if (completed) return;
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
