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

/**
 * Helper to detect if a clip is a seamless continuation of an immediately preceding clip
 * on the same track (same media source, adjacent timeline cut, continuous trim range, same speed).
 * When contiguous, the clips can share a single HTMLVideoElement during export, eliminating
 * decoder flushes, seek stalls, and playback jerks across splits.
 */
function findContiguousPrecedingClip(
  clip: any,
  allClips: any[]
): any | null {
  if (!clip || clip.type !== "video" || clip.reverse) return null;
  const clipTrack = clip.trackIndex || 0;
  const clipStart = clip.startTime || 0;
  const clipTrimIn = clip.trimIn || 0;
  const clipSpeed = clip.speed || 1.0;
  if (clip.speedCurve) return null;

  for (let j = 0; j < allClips.length; j++) {
    const prev = allClips[j];
    if (!prev || prev.id === clip.id || prev.type !== "video" || prev.reverse || prev.speedCurve) continue;
    if ((prev.trackIndex || 0) !== clipTrack) continue;

    // Check matching media source
    const sameUrl = Boolean(clip.url && prev.url && clip.url === prev.url);
    const sameSourceId = Boolean(
      clip.sourceMediaId && prev.sourceMediaId && clip.sourceMediaId === prev.sourceMediaId
    );
    if (!sameUrl && !sameSourceId) continue;

    // Timeline adjacency: preceding clip ends exactly where current begins
    const prevEnd = (prev.startTime || 0) + (prev.duration || 0);
    if (Math.abs(prevEnd - clipStart) > 0.05) continue;

    // Media continuity: preceding clip playback ends exactly where current begins
    const prevSpeed = prev.speed || 1.0;
    if (Math.abs(prevSpeed - clipSpeed) > 0.01) continue;
    const prevMediaEnd = (prev.trimIn || 0) + (prev.duration || 0) * prevSpeed;
    if (Math.abs(prevMediaEnd - clipTrimIn) > 0.05) continue;

    // No overlapping cross-fade transition
    const trans = prev.transition;
    if (trans && trans.type && trans.type !== "none" && trans.type !== "cut" && (trans.duration || 0) > 0) {
      continue;
    }

    return prev;
  }
  return null;
}

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

  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (options.isCancelled?.()) {
    throw new Error("Export cancelled");
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = targetW;
  exportCanvas.height = targetH;

  const domContainer = getMediaContainer();
  if (domContainer) {
    domContainer.appendChild(exportCanvas);
  }

  const exportRenderer = createRenderer
    ? createRenderer(exportCanvas)
    : new (renderer.constructor as any)(exportCanvas, { registerAsActive: false });

  // Set export mode for highest quality bicubic filtering
  exportRenderer.isExporting = true;

  // Dedicated video and image element instances for export:
  // Distinct visual tracks and discontinuous cuts get independent HTMLVideoElement instances,
  // while seamless contiguous splits on the same track reuse the same element without interruptions.
  // On mobile browsers, load video decoders in a sliding window (<= 3.5s initial, 2.5s lookahead)
  // and dispose finished elements immediately so hardware decoder pools never exhaust or hang.
  exportRenderer.videoElements = new Map();
  const createdExportMediaElements: (HTMLVideoElement | HTMLImageElement)[] = [];

  interface ExportVideoSlot {
    id: number;
    leaderClip: any;
    clips: any[];
    clipKeys: string[];
    minStartTime: number;
    maxEndTime: number;
    el: HTMLVideoElement | null;
    disposed: boolean;
    mediaSourceConnected: boolean;
    gainNode: any;
  }

  const videoClips = project.tracks?.video || [];
  const videoSlots: ExportVideoSlot[] = [];
  const clipToSlot = new Map<any, ExportVideoSlot>();
  const slotByLeaderClipId = new Map<string, ExportVideoSlot>();

  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    if (!clip || !clip.url) continue;
    const clipKey = clip.id || `export_clip_${i}`;

    if (clip.type === "video") {
      const contiguousPrev = findContiguousPrecedingClip(clip, videoClips);
      const prevSlot =
        contiguousPrev && contiguousPrev.id
          ? slotByLeaderClipId.get(contiguousPrev.id) || clipToSlot.get(contiguousPrev)
          : contiguousPrev
          ? clipToSlot.get(contiguousPrev)
          : null;

      const cStart = Math.max(0, clip.startTime || 0);
      const cEnd = cStart + (clip.duration || 0);

      if (prevSlot) {
        prevSlot.clips.push(clip);
        prevSlot.clipKeys.push(clipKey);
        prevSlot.minStartTime = Math.min(prevSlot.minStartTime, cStart);
        prevSlot.maxEndTime = Math.max(prevSlot.maxEndTime, cEnd);
        clipToSlot.set(clip, prevSlot);
        if (clip.id) slotByLeaderClipId.set(clip.id, prevSlot);
      } else {
        const slot: ExportVideoSlot = {
          id: videoSlots.length,
          leaderClip: clip,
          clips: [clip],
          clipKeys: [clipKey],
          minStartTime: cStart,
          maxEndTime: cEnd,
          el: null,
          disposed: false,
          mediaSourceConnected: false,
          gainNode: null,
        };
        videoSlots.push(slot);
        clipToSlot.set(clip, slot);
        if (clip.id) slotByLeaderClipId.set(clip.id, slot);
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

  let useLiveMediaElementAudio = false;
  let audioCtx: any = null;
  let audioSourceNode: any = null;
  let audioDest: any = null;

  const ensureSlotAudioConnected = (slot: ExportVideoSlot) => {
    if (
      !useLiveMediaElementAudio ||
      slot.mediaSourceConnected ||
      !slot.el ||
      !audioCtx ||
      !audioDest
    ) {
      return;
    }
    const leader = slot.leaderClip;
    if (leader.muted || leader.volume === 0 || !mediaHasAudioTrack(leader)) {
      return;
    }
    try {
      const src = audioCtx.createMediaElementSource(slot.el);
      const gain = audioCtx.createGain();
      gain.gain.value = leader.volume !== undefined ? leader.volume : 1.0;
      src.connect(gain).connect(audioDest);
      slot.gainNode = gain;
      slot.mediaSourceConnected = true;
      slot.el.muted = false;
      slot.el.defaultMuted = false;
    } catch {
      slot.mediaSourceConnected = true;
    }
  };

  const materializeVideoSlot = (slot: ExportVideoSlot): HTMLVideoElement | null => {
    if (slot.disposed) return null;
    if (slot.el) return slot.el;

    const clip = slot.leaderClip;
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
    slot.el = vid;
    (vid as any)._isExportStarted = false;
    (vid as any)._isPlayPending = false;

    for (let k = 0; k < slot.clips.length; k++) {
      const c = slot.clips[k];
      const ck = slot.clipKeys[k];
      exportRenderer.videoElements.set(ck, vid);
      if (c.id) exportRenderer.videoElements.set(c.id, vid);
      if (c.sourceMediaId) exportRenderer.videoElements.set(c.sourceMediaId, vid);
      if (c.url) exportRenderer.videoElements.set(c.url, vid);
    }

    const targetTrim = clip.reverse
      ? clip.trimOut || (clip.trimIn || 0) + (clip.duration || 0)
      : Math.max(0, clip.trimIn || 0);
    vid.playbackRate = Math.max(0.1, Math.min(16, clip.speed || 1.0));
    vid.addEventListener(
      "loadedmetadata",
      () => {
        if (slot.disposed) return;
        if (!(vid as any)._isExportStarted && Math.abs(vid.currentTime - targetTrim) > 0.04) {
          try {
            vid.currentTime = targetTrim;
          } catch {}
        }
      },
      { once: true }
    );

    if (useLiveMediaElementAudio) {
      ensureSlotAudioConnected(slot);
    }

    return vid;
  };

  const disposeVideoSlot = (slot: ExportVideoSlot) => {
    if (slot.disposed) return;
    slot.disposed = true;
    const el = slot.el;
    slot.el = null;
    if (slot.gainNode) {
      try {
        slot.gainNode.disconnect();
      } catch {}
      slot.gainNode = null;
    }
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch {}
      for (let k = 0; k < slot.clips.length; k++) {
        const c = slot.clips[k];
        const ck = slot.clipKeys[k];
        if (exportRenderer.videoElements.get(ck) === el) exportRenderer.videoElements.delete(ck);
        if (c.id && exportRenderer.videoElements.get(c.id) === el) exportRenderer.videoElements.delete(c.id);
        if (c.sourceMediaId && exportRenderer.videoElements.get(c.sourceMediaId) === el) {
          exportRenderer.videoElements.delete(c.sourceMediaId);
        }
        if (c.url && exportRenderer.videoElements.get(c.url) === el) {
          exportRenderer.videoElements.delete(c.url);
        }
      }
    }
  };

  // Initial creation: on desktop load all slots upfront; on mobile web, only initial 3.5s window
  const initialWindowSec = isMobileDevice ? 3.5 : Number.POSITIVE_INFINITY;
  for (const slot of videoSlots) {
    if (slot.minStartTime <= initialWindowSec) {
      materializeVideoSlot(slot);
    }
  }

  // Pre-cue materialized media elements to readyState >= 2 and exact initial trimIn before frame 0
  const cuedElements = new Set<HTMLVideoElement | HTMLImageElement>();
  const cueImagePromises = (project.tracks.video || []).map(async (c, idx) => {
    if (!c || c.type === "video") return;
    const clipKey = c.id || `export_clip_${idx}`;
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
  });

  const cueVideoPromises = videoSlots.map(async (slot) => {
    const el = slot.el;
    const c = slot.leaderClip;
    if (!el || cuedElements.has(el)) return;
    cuedElements.add(el);
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
  });

  await Promise.all([...cueImagePromises, ...cueVideoPromises]);

  if (options.isCancelled?.()) {
    videoSlots.forEach(disposeVideoSlot);
    try {
      exportCanvas.width = 1;
      exportCanvas.height = 1;
      if (exportCanvas.parentNode) exportCanvas.parentNode.removeChild(exportCanvas);
    } catch {}
    throw new Error("Export cancelled");
  }

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

  let defaultBitrate = isMobileDevice ? 6000000 : 8500000;
  if (targetW >= 3840 || targetH >= 3840 || targetW >= 2160 || targetH >= 2160) {
    defaultBitrate = isMobileDevice ? 14000000 : 22000000; // 4K: 14 Mbps mobile / 22 Mbps desktop
  } else if (targetW >= 1920 || targetH >= 1920 || targetW >= 1080 || targetH >= 1080) {
    defaultBitrate = isMobileDevice ? 6000000 : 8500000;   // 1080p: 6 Mbps mobile / 8.5 Mbps desktop
  } else {
    defaultBitrate = isMobileDevice ? 3500000 : 4500000;   // 720p: 3.5 Mbps mobile / 4.5 Mbps desktop
  }
  if (fps >= 60) {
    defaultBitrate = Math.round(defaultBitrate * (isMobileDevice ? 1.25 : 1.4));
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
  try {
    const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
      if (audioCtx.state === "suspended") {
        try {
          // Bound resume() wait so mobile browsers without active gesture never hang at 0%
          await Promise.race([
            audioCtx.resume(),
            new Promise<void>((r) => setTimeout(r, isMobileDevice ? 400 : 1500)),
          ]);
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

        // Fallback for large mobile videos (> 48MB) skipped from ArrayBuffer mixdown:
        // stream live element audio directly through MediaElementAudioSourceNode
        if (!audioSourceNode && hasVideoAudio) {
          useLiveMediaElementAudio = true;
          videoSlots.forEach((slot) => ensureSlotAudioConnected(slot));
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
  const targetAudioBps = isMobileDevice ? 128000 : 192000;
  const candidateConfigs = [
    { mimeType, videoBitsPerSecond: finalVideoBitsPerSecond, audioBitsPerSecond: targetAudioBps },
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
      videoSlots.forEach(disposeVideoSlot);
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
        if (renderer && renderer.canvas && renderer.canvas.width > 1) {
          const { setActiveVideoRenderer } = require("../videoRenderer");
          if (typeof setActiveVideoRenderer === "function") {
            setActiveVideoRenderer(renderer);
          }
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
        await new Promise<void>((r) => setTimeout(r, 0));
        let finalBlob: Blob;
        if (recordedChunks.length > 0) {
          const rawBlob = new Blob(recordedChunks, { type: mimeType });
          // Clear chunk array immediately to free memory
          recordedChunks.length = 0;
          finalBlob = rawBlob;

          const maxFullPatchBytes = isMobileDevice ? 36 * 1024 * 1024 : 192 * 1024 * 1024;
          try {
            if (rawBlob.size <= maxFullPatchBytes) {
              const rawBuffer = await rawBlob.arrayBuffer();
              const patchedBytes = patchMediaContainerDuration(
                new Uint8Array(rawBuffer),
                duration
              );
              finalBlob = new Blob([patchedBytes as any], { type: mimeType });
            } else if (mimeType.includes("mp4") && rawBlob.size > 512 * 1024) {
              // On large mobile MP4s, patch only the leading moov slice when located in the first 512KB
              // to avoid cloning a huge ArrayBuffer on memory-constrained devices.
              const headSize = 512 * 1024;
              const headBytes = new Uint8Array(await rawBlob.slice(0, headSize).arrayBuffer());
              const dv = new DataView(headBytes.buffer, headBytes.byteOffset, headBytes.byteLength);
              let off = 0;
              let moovFitsHead = false;
              while (off + 8 <= headBytes.length) {
                let sz = dv.getUint32(off);
                const tp = String.fromCharCode(
                  headBytes[off + 4],
                  headBytes[off + 5],
                  headBytes[off + 6],
                  headBytes[off + 7]
                );
                if (sz === 1 && off + 16 <= headBytes.length) {
                  sz = dv.getUint32(off + 8) * 4294967296 + dv.getUint32(off + 12);
                }
                if (sz < 8) break;
                if (tp === "moov") {
                  moovFitsHead = off + sz <= headBytes.length;
                  break;
                }
                off += sz;
              }
              if (moovFitsHead) {
                const patchedHead = patchMediaContainerDuration(headBytes, duration);
                finalBlob = new Blob([patchedHead as any, rawBlob.slice(headSize)], { type: mimeType });
              }
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

    // Start studio audio stream synchronously
    if (audioSourceNode) {
      try {
        audioSourceNode.start(0);
      } catch (e) {}
    }

    // Precompute incoming transition lead duration per video clip once outside the hot render loop
    const transLeadByClip = new Map<any, number>();
    for (let i = 0; i < videoClips.length; i++) {
      const c = videoClips[i];
      if (!c || c.type !== "video") continue;
      let lead = 0;
      for (let j = 0; j < videoClips.length; j++) {
        const other = videoClips[j];
        if (other && other.id !== c.id && (other.trackIndex || 0) === (c.trackIndex || 0)) {
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
            lead = otherTrans.duration;
            break;
          }
        }
      }
      transLeadByClip.set(c, lead);
    }

    // Start initial active video clips (startTime <= 0.05) synchronously with recording
    const initialClips = videoClips.filter(
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
        el.play().catch(() => {
          if (!el.muted) {
            el.muted = true;
            el.defaultMuted = true;
            el.play().catch(() => {});
          }
        });
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

        const tickStartMs = performance.now();
        const elapsedWallMs = tickStartMs - recStartTime;
        const curTime = Math.min(duration, elapsedWallMs / 1000);

        // Check if recording duration has been reached
        if (elapsedWallMs >= duration * 1000 || curTime >= duration) {
          completed = true;

          // Render exact final frame
          exportRenderer.renderFrame(project, duration, true, exportLogicalW, exportLogicalH);
          if (onProgress) onProgress(99, duration, duration);

          // 1. Immediately pause video elements
          videoClips.forEach((c, idx) => {
            const clipKey = c.id || `export_clip_${idx}`;
            const el =
              (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
              exportRenderer.videoElements.get(clipKey) ||
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

        // On mobile browsers: lazily materialize approaching slots (2.5s lookahead)
        // and dispose finished slots (0.35s past end) to keep hardware decoders bounded.
        if (isMobileDevice) {
          for (let s = 0; s < videoSlots.length; s++) {
            const slot = videoSlots[s];
            if (slot.disposed) continue;
            if (curTime > slot.maxEndTime + 0.35) {
              disposeVideoSlot(slot);
            } else if (!slot.el && curTime >= slot.minStartTime - 2.5) {
              materializeVideoSlot(slot);
            }
          }
        }

        // 1. Identify which video elements are active across all tracks in this frame
        const activeElementsThisTick = new Set<HTMLVideoElement>();
        for (let i = 0; i < videoClips.length; i++) {
          const c = videoClips[i];
          if (c.type !== "video") continue;
          const transLead = transLeadByClip.get(c) || 0;
          const activeStart = Math.max(0, c.startTime - transLead);
          const activeEnd = c.startTime + c.duration;
          if (curTime >= activeStart && curTime < activeEnd) {
            const clipKey = c.id || `export_clip_${i}`;
            const el =
              (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
              exportRenderer.videoElements.get(clipKey) ||
              (c.sourceMediaId ? exportRenderer.videoElements.get(c.sourceMediaId) : null) ||
              exportRenderer.videoElements.get(c.url);
            if (el && el instanceof HTMLVideoElement) {
              activeElementsThisTick.add(el);
            }
          }
        }

        // 2. Synchronize video element playback across timeline cuts and transitions
        for (let i = 0; i < videoClips.length; i++) {
          const c = videoClips[i];
          if (c.type !== "video") continue;
          const clipKey = c.id || `export_clip_${i}`;
          const el =
            (c.id ? exportRenderer.videoElements.get(c.id) : null) ||
            exportRenderer.videoElements.get(clipKey) ||
            (c.sourceMediaId ? exportRenderer.videoElements.get(c.sourceMediaId) : null) ||
            exportRenderer.videoElements.get(c.url);
          if (!el || !(el instanceof HTMLVideoElement) || el.readyState < 1) continue;

          const transLead = transLeadByClip.get(c) || 0;
          const activeStart = Math.max(0, c.startTime - transLead);
          const activeEnd = c.startTime + c.duration;
          const isInside = curTime >= activeStart && curTime < activeEnd;

          // Warm pre-cue (seek only, NEVER play early!): Ensure element is cued to targetTrim without running forward
          const isPreRolling = curTime >= activeStart - 0.50 && curTime < activeStart;
          if (isPreRolling && !activeElementsThisTick.has(el)) {
            const targetTrim = c.reverse
              ? (c.trimOut || (c.trimIn || 0) + (c.duration || 0))
              : Math.max(0, c.trimIn || 0);
            if (!(el as any)._isPreRollCued) {
              (el as any)._isPreRollCued = true;
              if (Math.abs(el.currentTime - targetTrim) > 0.05) {
                try { el.currentTime = targetTrim; } catch {}
              }
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
                (el as any)._isExportStarted = true;
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
                    if (!el.muted) {
                      el.muted = true;
                      el.defaultMuted = true;
                      el.play().catch(() => {});
                    }
                  });
                } else {
                  (el as any)._isPlayPending = false;
                }
              }
            } else {
              (el as any)._isPlayPending = false;
              const drift = el.currentTime - expectedMediaTime;
              if (Math.abs(drift) > 0.45 && !el.seeking) {
                // Hard seek fallback if drift exceeds 450ms or playback stalled
                try { el.currentTime = expectedMediaTime; } catch {}
              } else if (Math.abs(drift) > 0.06) {
                // Smooth speed nudge without decoder flush
                const comp = Math.max(0.75, Math.min(1.25, 1 - drift * 0.5));
                try {
                  el.playbackRate = Math.max(0.1, Math.min(16, speed * comp));
                } catch {}
              } else if (Math.abs(el.playbackRate - speed) > 0.01) {
                el.playbackRate = speed;
              }
            }
          } else if (!isPreRolling && !activeElementsThisTick.has(el)) {
            // Only pause if this element is NOT currently playing for another active clip
            (el as any)._isPreRollCued = false;
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

        // Precise next-frame pacing with guaranteed UI breathing room on mobile browsers
        const afterRenderMs = performance.now();
        const renderElapsedMs = afterRenderMs - tickStartMs;
        const postRenderWallMs = afterRenderMs - recStartTime;
        const nextTargetWallMs = Math.floor(postRenderWallMs / targetFrameIntervalMs + 1) * targetFrameIntervalMs;
        const minYieldMs = isMobileDevice ? (renderElapsedMs > 45 ? 16 : 12) : 4;
        const delayMs = Math.max(minYieldMs, Math.round(nextTargetWallMs - postRenderWallMs));
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
