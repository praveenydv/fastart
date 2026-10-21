// FastArt Real-time Canvas Rendering & Video Export Engine (TypeScript)
import {
  FastArtProject,
  VideoClip,
  TextClip,
  StickerClip,
  EffectClip,
} from "../types/project";

import { createGif, GifFrame } from "./gifEncoder";
import { exportProjectAudioToWav } from "./audioExporter";

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

export class VideoRenderer {
  public canvas: HTMLCanvasElement | null;
  public ctx: CanvasRenderingContext2D | null;
  public videoElements: Map<string, HTMLVideoElement | HTMLImageElement>;
  public lastUsedTimestamp: Map<string, number> = new Map();
  public onFrameNeeded?: () => void;
  public offscreenCanvas: HTMLCanvasElement | null = null;
  public offscreenCtx: CanvasRenderingContext2D | null = null;
  private maxDecoders =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      ? 4
      : 6;

  constructor(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas
      ? (canvas.getContext("2d", { alpha: false, desynchronized: true }) as CanvasRenderingContext2D | null) ||
        canvas.getContext("2d")
      : null;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
    }
    this.videoElements = new Map();
  }

  setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas
      ? (canvas.getContext("2d", { alpha: false, desynchronized: true }) as CanvasRenderingContext2D | null) ||
        canvas.getContext("2d")
      : null;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
    }
  }

  // Release resources and hardware decoders to prevent mobile browser memory leaks
  cleanup() {
    this.videoElements.forEach((el) => {
      if (el instanceof HTMLVideoElement) {
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch (e) {}
      }
    });
    this.videoElements.clear();
    this.lastUsedTimestamp.clear();
    this.canvas = null;
    this.ctx = null;
  }

  // Prune unused media elements to preserve mobile GPU memory and limited hardware decoders
  pruneUnusedMedia(activeUrls: Set<string>) {
    this.videoElements.forEach((el, url) => {
      if (!activeUrls.has(url)) {
        if (el instanceof HTMLVideoElement) {
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
          } catch (e) {}
        }
        this.videoElements.delete(url);
        this.lastUsedTimestamp.delete(url);
      }
    });
  }

  // Preload and cache media elements with hardware decoder LRU eviction for large files
  async preloadClip(
    clip: VideoClip,
  ): Promise<HTMLVideoElement | HTMLImageElement | null> {
    if (typeof window === "undefined") return null;
    this.lastUsedTimestamp.set(clip.url, Date.now());

    if (this.videoElements.has(clip.url)) {
      return this.videoElements.get(clip.url)!;
    }

    if (clip.type === "video") {
      // LRU Eviction: enforce maximum concurrent hardware decoders
      if (this.videoElements.size >= this.maxDecoders) {
        let oldestUrl: string | null = null;
        let oldestScore = Infinity;
        this.videoElements.forEach((el, url) => {
          const t = this.lastUsedTimestamp.get(url) || 0;
          const isPaused = el instanceof HTMLVideoElement ? el.paused : true;
          const score = t + (isPaused ? 0 : 1000000);
          if (score < oldestScore) {
            oldestScore = score;
            oldestUrl = url;
          }
        });

        if (oldestUrl) {
          const oldEl = this.videoElements.get(oldestUrl);
          if (oldEl instanceof HTMLVideoElement) {
            try {
              oldEl.pause();
              oldEl.removeAttribute("src");
              oldEl.load();
            } catch (e) {}
          }
          this.videoElements.delete(oldestUrl);
          this.lastUsedTimestamp.delete(oldestUrl);
        }
      }

      const vid = document.createElement("video");
      if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
        vid.crossOrigin = "anonymous";
      }
      vid.muted = true;
      vid.playsInline = true;
      // Use metadata preload for memory safety on multi-gigabyte 4K files
      vid.preload = "metadata";
      vid.src = clip.url;

      const trigger = () => {
        if (this.onFrameNeeded) this.onFrameNeeded();
      };

      vid.addEventListener("loadeddata", trigger);
      vid.addEventListener("canplay", trigger);
      vid.addEventListener("seeked", trigger);
      vid.load();

      this.videoElements.set(clip.url, vid);
      return vid;
    } else {
      const img = new Image();
      if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => {
        if (this.onFrameNeeded) this.onFrameNeeded();
      };
      img.src = clip.url;
      this.videoElements.set(clip.url, img);
      return img;
    }
  }

  // Sync HTML5 video playback for butter-smooth 60fps rendering across all active video tracks
  syncPlayback(
    activeClips: VideoClip[],
    time: number,
    isPlaying: boolean,
  ) {
    if (typeof window === "undefined") return;

    const activeUrls = new Set(activeClips.filter((c) => c.type === "video").map((c) => c.url));

    // 1. Pause any video that is NOT in activeClips
    this.videoElements.forEach((el, url) => {
      if (el instanceof HTMLVideoElement && !activeUrls.has(url)) {
        if (!el.paused) {
          el.pause();
        }
      }
    });

    // 2. Synchronize all active videos simultaneously
    activeClips.forEach((activeClip) => {
      if (activeClip.type !== "video") return;

      const mediaEl = this.videoElements.get(activeClip.url);
      if (!mediaEl || !(mediaEl instanceof HTMLVideoElement)) return;
      const vid = mediaEl as HTMLVideoElement;

      const clipLocalTime = Math.max(0, time - activeClip.startTime);
      let effectiveSpeed = Math.max(0.1, Math.min(16, activeClip.speed || 1.0));
      if (
        activeClip.speedCurve &&
        Array.isArray(activeClip.speedCurve) &&
        activeClip.speedCurve.length > 0
      ) {
        effectiveSpeed = this.evaluateSpeedCurve(
          activeClip.speedCurve as any[],
          clipLocalTime / Math.max(0.1, activeClip.duration),
        );
      }

      const mediaTime = activeClip.reverse
        ? Math.max(
            0,
            (activeClip.trimOut || activeClip.duration) -
              clipLocalTime * effectiveSpeed,
          )
        : (activeClip.trimIn || 0) + clipLocalTime * effectiveSpeed;

      const speed = Math.max(0.1, Math.min(16, effectiveSpeed));
      if (vid.playbackRate !== speed) {
        vid.playbackRate = speed;
      }

      if (isPlaying) {
        if (vid.paused) {
          if (Math.abs(vid.currentTime - mediaTime) > 0.1) {
            vid.currentTime = Math.max(0, mediaTime);
          }
          vid.play().catch(() => {});
        } else {
          // Active playback drift correction: only seek if drifted by >0.35s
          // This avoids destroying the 60fps hardware decoder pipeline
          if (Math.abs(vid.currentTime - mediaTime) > 0.35) {
            vid.currentTime = Math.max(0, mediaTime);
          }
        }
      } else {
        if (!vid.paused) {
          vid.pause();
        }
        if (Math.abs(vid.currentTime - mediaTime) > 0.04) {
          const target = Math.max(0, mediaTime);
          if (typeof (vid as any).fastSeek === "function") {
            try {
              (vid as any).fastSeek(target);
            } catch (e) {
              vid.currentTime = target;
            }
          } else {
            vid.currentTime = target;
          }
        }
      }
      this.lastUsedTimestamp.set(activeClip.url, Date.now());
    });
  }

  // Render a specific timestamp frame
  renderFrame(
    project: FastArtProject,
    time: number,
    isPlaying: boolean = false,
    logicalWidth?: number,
    logicalHeight?: number,
  ) {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    // Determine logical coordinate space (matches Player display box for 1:1 on-screen transform accuracy)
    const w = logicalWidth && logicalWidth > 0 ? logicalWidth : (this.canvas.clientWidth || canvasW);
    const h = logicalHeight && logicalHeight > 0 ? logicalHeight : (this.canvas.clientHeight || canvasH);

    ctx.save();
    // Enable high-quality image smoothing for zero degradation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Scale canvas context to normalize all draw operations to logical (w, h) coordinates
    ctx.scale(canvasW / w, canvasH / h);

    // Clear background
    ctx.fillStyle = "#0B0D13";
    ctx.fillRect(0, 0, w, h);

    const videoClips = project.tracks.video || [];
    const textClips = project.tracks.text || [];
    const stickerClips = project.tracks.stickers || [];
    const effectClips = project.tracks.effects || [];

    // Collect all active clips at the current playhead time
    const activeVideos = videoClips.filter(
      (c) => time >= c.startTime && time <= c.startTime + c.duration
    );
    const activeTexts = textClips.filter(
      (t) => time >= t.startTime && time <= t.startTime + t.duration
    );
    const activeStickers = stickerClips.filter(
      (s) => time >= s.startTime && time <= s.startTime + s.duration
    );
    const activeEffects = effectClips.filter(
      (e) => time >= e.startTime && time <= e.startTime + e.duration
    );

    // Synchronize HTML5 video playback across all active video tracks
    this.syncPlayback(activeVideos, time, isPlaying);

    const hasAnyTrackContent = Boolean(
      videoClips.length > 0 ||
      textClips.length > 0 ||
      stickerClips.length > 0 ||
      effectClips.length > 0 ||
      (project.tracks.audio && project.tracks.audio.length > 0)
    );

    if (activeVideos.length === 0 && !hasAnyTrackContent) {
      this.drawProceduralPlaceholder(ctx, w, h, "No Media Added", time);
      ctx.restore();
      return;
    }

    // Studio canvas background
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(0, 0, w, h);

    // Build unified list of active visual items across all tracks
    type VisualItem =
      | { kind: "video"; clip: VideoClip; trackIndex: number }
      | { kind: "text"; clip: TextClip; trackIndex: number }
      | { kind: "sticker"; clip: StickerClip; trackIndex: number }
      | { kind: "effect"; clip: EffectClip; trackIndex: number };

    const visualItems: VisualItem[] = [
      ...activeVideos.map((c) => ({
        kind: "video" as const,
        clip: c,
        trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 0,
      })),
      ...activeTexts.map((t) => ({
        kind: "text" as const,
        clip: t,
        trackIndex: typeof t.trackIndex === "number" ? t.trackIndex : 2,
      })),
      ...activeStickers.map((s) => ({
        kind: "sticker" as const,
        clip: s,
        trackIndex: typeof s.trackIndex === "number" ? s.trackIndex : 3,
      })),
      ...activeEffects.map((e) => ({
        kind: "effect" as const,
        clip: e,
        trackIndex: typeof e.trackIndex === "number" ? e.trackIndex : 4,
      })),
    ];

    // Sort by trackIndex ascending (lower trackIndex draws first = underneath; higher trackIndex draws later = on top)
    visualItems.sort((a, b) => a.trackIndex - b.trackIndex);

    visualItems.forEach((item) => {
      if (item.kind === "video") {
        this.drawClip(ctx, item.clip, time, w, h, null);
      } else if (item.kind === "text") {
        this.drawTextOverlay(ctx, item.clip, time, w, h);
      } else if (item.kind === "sticker") {
        this.drawSticker(ctx, item.clip, time, w, h);
      } else if (item.kind === "effect") {
        this.applyEffectOverlay(ctx, item.clip, time, w, h);
      }
    });

    ctx.restore();
  }

  drawClip(
    ctx: CanvasRenderingContext2D,
    clip: VideoClip,
    time: number,
    w: number,
    h: number,
    nextClip: VideoClip | null,
  ) {
    ctx.save();

    const clipLocalTime = Math.max(0, time - clip.startTime);
    const timeLeft = clip.duration - clipLocalTime;
    const trans = clip.transition;
    let alpha = 1.0;
    let scaleModifier = 1.0;
    let xOffset = 0;

    if (trans && trans.duration > 0 && timeLeft <= trans.duration) {
      const progress = 1 - timeLeft / trans.duration;
      if (trans.type === "dissolve") {
        alpha = 1 - progress;
      } else if (trans.type === "zoom_in") {
        scaleModifier = 1 + progress * 0.4;
        alpha = 1 - progress * 0.5;
      } else if (trans.type === "slide_left") {
        xOffset = -progress * w;
      } else if (trans.type === "flash_white") {
        if (progress > 0.5) alpha = 1 - (progress - 0.5) * 2;
      }
    }
    const t = clip.transform || { scale: 1, rotation: 0, x: 0, y: 0 };

    const clipOpacity = t?.opacity !== undefined ? t.opacity : 1.0;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha * clipOpacity));

    ctx.translate(w / 2 + t.x + xOffset, h / 2 + t.y);
    ctx.rotate(((t.rotation || 0) * Math.PI) / 180);

    const scaleX = (t.flipX ? -1 : 1) * (t.scale || 1) * scaleModifier;
    const scaleY = (t.flipY ? -1 : 1) * (t.scale || 1) * scaleModifier;
    ctx.scale(scaleX, scaleY);

    this.applyColorFilter(ctx, clip.filter, clip.customLut);

    if (!this.videoElements.has(clip.url)) {
      this.preloadClip(clip);
    }

    const mediaEl = this.videoElements.get(clip.url);
    const isImage =
      mediaEl instanceof HTMLImageElement ||
      (mediaEl && (mediaEl as any).tagName === "IMG");
    const isVideo =
      mediaEl instanceof HTMLVideoElement ||
      (mediaEl && (mediaEl as any).tagName === "VIDEO");

    // Check genuine readiness: Images use complete & naturalWidth, Videos use readyState & dimensions
    const isReady = isImage
      ? (mediaEl as HTMLImageElement).complete &&
        (mediaEl as HTMLImageElement).naturalWidth > 0
      : isVideo
        ? (mediaEl as HTMLVideoElement).readyState >= 1 &&
          (mediaEl as HTMLVideoElement).videoWidth > 0
        : false;

    if (isReady && mediaEl) {
      const mw =
        (mediaEl as any).videoWidth ||
        (mediaEl as any).naturalWidth ||
        (mediaEl as any).width ||
        1280;
      const mh =
        (mediaEl as any).videoHeight ||
        (mediaEl as any).naturalHeight ||
        (mediaEl as any).height ||
        720;

      // Custom Size Crop
      const crop = clip.crop || clip.transform?.crop;
      let sx = 0;
      let sy = 0;
      let sw = mw;
      let sh = mh;
      if (crop && crop.width > 0 && crop.height > 0) {
        sx = Math.max(0, (crop.x / 100) * mw);
        sy = Math.max(0, (crop.y / 100) * mh);
        sw = Math.min(mw - sx, (crop.width / 100) * mw);
        sh = Math.min(mh - sy, (crop.height / 100) * mh);
      }

      const aspect = sw / sh;
      let dw = w;
      let dh = w / aspect;
      if (dh < h) {
        dh = h;
        dw = h * aspect;
      }

      // Video Masking
      const mask = clip.mask || clip.transform?.mask;
      if (mask && mask.shape && mask.shape !== "none") {
        this.applyMaskPath(ctx, mask, dw, dh);
      }

      // Smart Cutout / Chroma Key (CapCut Pro)
      const cutout = clip.cutout || clip.transform?.cutout;
      if (cutout && cutout.enabled) {
        this.drawClipWithCutout(ctx, mediaEl as any, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh, cutout);
      } else {
        ctx.drawImage(mediaEl, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
      }

      // Smooth Slow-Mo (Frame Blending / Optical Flow simulation)
      if (
        (clip.smoothSlowMo === "blend" || clip.smoothSlowMo === "optical_flow") &&
        (clip.speed || 1.0) < 1.0
      ) {
        ctx.save();
        ctx.globalAlpha = clip.smoothSlowMo === "optical_flow" ? 0.35 : 0.22;
        ctx.drawImage(mediaEl, sx, sy, sw, sh, -dw / 2 + 1, -dh / 2, dw, dh);
        ctx.restore();
      }
    } else {
      this.drawLoadingPreview(ctx, clip, clipLocalTime, w, h);
    }

    ctx.restore();

    if (trans && trans.type === "flash_white" && timeLeft <= trans.duration) {
      const p = 1 - timeLeft / trans.duration;
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(p * Math.PI)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  applyMaskPath(
    ctx: CanvasRenderingContext2D,
    mask: any,
    dw: number,
    dh: number,
  ) {
    const size = mask.size || 50;
    const offsetX = (mask.x || 0) * (dw / 100);
    const offsetY = (mask.y || 0) * (dh / 100);
    const rot = ((mask.rotation || 0) * Math.PI) / 180;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.rotate(rot);

    ctx.beginPath();
    // If inverted, add outer boundary using evenodd winding rule
    if (mask.inverted) {
      ctx.rect(-dw * 2, -dh * 2, dw * 4, dh * 4);
    }

    if (mask.shape === "circle") {
      const radius = (Math.min(dw, dh) * size) / 200;
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    } else if (mask.shape === "rectangle") {
      const rw = (dw * size) / 100;
      const rh = (dh * size) / 100;
      const rad = mask.roundness || 12;
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(-rw / 2, -rh / 2, rw, rh, rad);
      } else {
        ctx.rect(-rw / 2, -rh / 2, rw, rh);
      }
    } else if (mask.shape === "linear") {
      ctx.rect(-dw * 2, -dh * 2, dw * 4, dh * 2);
    } else if (mask.shape === "mirror") {
      const bandH = (dh * size) / 100;
      ctx.rect(-dw * 2, -bandH / 2, dw * 4, bandH);
    } else if (mask.shape === "heart") {
      const s = (Math.min(dw, dh) * size) / 150;
      ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(-s * 0.5, -s * 0.2, -s * 0.8, s * 0.3, 0, s * 0.9);
      ctx.bezierCurveTo(s * 0.8, s * 0.3, s * 0.5, -s * 0.2, 0, s * 0.3);
    } else if (mask.shape === "star") {
      const outerR = (Math.min(dw, dh) * size) / 200;
      const innerR = outerR * 0.45;
      const points = 5;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / points - Math.PI / 2;
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.clip(mask.inverted ? "evenodd" : "nonzero");
    ctx.restore();
  }

  drawLoadingPreview(
    ctx: CanvasRenderingContext2D,
    clip: VideoClip,
    localTime: number,
    w: number,
    h: number,
  ) {
    const dw = w;
    const dh = h;
    const left = -dw / 2;
    const top = -dh / 2;

    // Dark cinematic canvas background
    ctx.fillStyle = "#10131A";
    ctx.fillRect(left, top, dw, dh);

    // Subtle neon cyan loading spinner
    const angle = (localTime * 5) % (Math.PI * 2);
    ctx.save();
    ctx.strokeStyle = "#00F2FE";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 22, angle, angle + Math.PI * 1.3);
    ctx.stroke();

    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = "#8E95A5";
    ctx.textAlign = "center";
    ctx.fillText("Loading...", 0, 38);
    ctx.restore();
  }

  applyColorFilter(ctx: CanvasRenderingContext2D, filterId?: string, customLut?: any) {
    if (customLut && customLut.cssFilter) {
      ctx.filter = customLut.cssFilter;
      return;
    }

    if (filterId === "teal_orange") {
      ctx.filter = "contrast(1.25) saturate(1.35) hue-rotate(15deg)";
    } else if (filterId === "vintage") {
      ctx.filter = "sepia(0.35) contrast(0.95) brightness(1.08)";
    } else if (filterId === "cyberpunk") {
      ctx.filter = "hue-rotate(290deg) contrast(1.4) saturate(1.85)";
    } else if (filterId === "noir") {
      ctx.filter = "grayscale(1) contrast(1.45) brightness(0.92)";
    } else if (filterId === "warm_sunset") {
      ctx.filter = "sepia(0.22) saturate(1.45) brightness(1.08)";
    } else if (filterId === "cold_moody") {
      ctx.filter = "hue-rotate(185deg) saturate(0.85) contrast(1.2)";
    } else if (filterId === "emerald") {
      ctx.filter = "hue-rotate(95deg) saturate(1.25) contrast(1.12)";
    } else if (filterId === "vhs_retro") {
      ctx.filter = "contrast(1.3) saturate(1.6) brightness(1.05)";
    } else if (filterId === "pastel_dream") {
      ctx.filter = "brightness(1.15) saturate(1.2) contrast(0.9)";
    } else if (filterId === "cinematic_warm") {
      ctx.filter = "sepia(0.3) saturate(1.35) contrast(1.15)";
    } else if (filterId === "matrix_code") {
      ctx.filter = "hue-rotate(80deg) saturate(1.8) contrast(1.3)";
    } else if (filterId === "sepia_antique") {
      ctx.filter = "sepia(0.85) contrast(1.1) brightness(0.95)";
    } else if (filterId === "high_contrast") {
      ctx.filter = "contrast(1.5) saturate(1.3) brightness(1.02)";
    } else if (filterId === "polaroid_fade") {
      ctx.filter = "contrast(0.9) saturate(0.8) brightness(1.12) sepia(0.15)";
    } else if (filterId === "solar_pop") {
      ctx.filter = "saturate(2.0) contrast(1.2)";
    } else {
      ctx.filter = "none";
    }
  }

  // Real-time Chroma Key & Smart Auto Cutout Studio (CapCut Pro)
  drawClipWithCutout(
    ctx: CanvasRenderingContext2D,
    mediaEl: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    cutout: any,
  ) {
    if (typeof document === "undefined") {
      ctx.drawImage(mediaEl, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }
    const offCanvas = this.offscreenCanvas;
    const offCtx = this.offscreenCtx;
    if (!offCanvas || !offCtx) {
      ctx.drawImage(mediaEl, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }

    // High performance resolution clamp for 60fps mobile execution
    const procW = Math.min(640, Math.max(16, Math.floor(Math.abs(dw))));
    const procH = Math.min(480, Math.max(16, Math.floor(Math.abs(dh))));
    if (offCanvas.width !== procW || offCanvas.height !== procH) {
      offCanvas.width = procW;
      offCanvas.height = procH;
    }

    offCtx.clearRect(0, 0, procW, procH);
    try {
      offCtx.drawImage(mediaEl, sx, sy, sw, sh, 0, 0, procW, procH);
      const imgData = offCtx.getImageData(0, 0, procW, procH);
      const data = imgData.data;

      const hex = cutout.keyColor || "#00FF00";
      const rKey = parseInt(hex.slice(1, 3), 16) || 0;
      const gKey = parseInt(hex.slice(3, 5), 16) || 255;
      const bKey = parseInt(hex.slice(5, 7), 16) || 0;

      const threshold = ((cutout.intensity ?? 45) / 100) * 195;
      const feather = Math.max(1, ((cutout.shadow ?? 25) / 100) * 70);
      const isAuto = cutout.mode === "auto";

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (isAuto) {
          // Automatic subject luminance/edge contrast isolation
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const autoDiff = Math.abs(lum - 128);
          if (autoDiff < threshold * 0.75) {
            data[i + 3] = 0;
          } else if (autoDiff < threshold * 0.75 + feather) {
            data[i + 3] = Math.floor(((autoDiff - threshold * 0.75) / feather) * 255);
          }
        } else {
          // High-precision Chroma Key Euclidean RGB color distance
          const dr = r - rKey;
          const dg = g - gKey;
          const db = b - bKey;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);

          if (dist < threshold) {
            data[i + 3] = 0;
          } else if (dist < threshold + feather) {
            data[i + 3] = Math.floor(((dist - threshold) / feather) * 255);
          }
        }
      }

      offCtx.putImageData(imgData, 0, 0);

      // Optional glowing edge outline (CapCut Pro Cutout Stroke)
      if (cutout.strokeColor && cutout.strokeWidth && cutout.strokeWidth > 0) {
        offCtx.save();
        offCtx.globalCompositeOperation = "destination-over";
        offCtx.shadowColor = cutout.strokeColor;
        offCtx.shadowBlur = cutout.strokeWidth * 3;
        offCtx.drawImage(offCanvas, 0, 0);
        offCtx.restore();
      }

      ctx.drawImage(offCanvas, 0, 0, procW, procH, dx, dy, dw, dh);
    } catch (e) {
      // Fallback if cross-origin tainted canvas
      ctx.drawImage(mediaEl, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  }

  // Evaluate continuous Bezier speed curve at normalized progress [0..1]
  evaluateSpeedCurve(curve: any[], progress: number): number {
    if (!curve || curve.length === 0) return 1.0;
    const clampedP = Math.max(0, Math.min(1, progress));

    // Array of SpeedCurvePoint objects: [{ t, s }]
    if (typeof curve[0] === "object" && "t" in curve[0]) {
      const points = curve as { t: number; s: number }[];
      if (clampedP <= points[0].t) return points[0].s;
      if (clampedP >= points[points.length - 1].t)
        return points[points.length - 1].s;

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (clampedP >= p1.t && clampedP <= p2.t) {
          const ratio = (clampedP - p1.t) / (p2.t - p1.t || 1);
          const smoothRatio = ratio * ratio * (3 - 2 * ratio);
          return p1.s + smoothRatio * (p2.s - p1.s);
        }
      }
      return 1.0;
    }

    // Array of speed multiplier numbers: [s0, s1, ...]
    const numPoints = curve.length;
    const idx = clampedP * (numPoints - 1);
    const low = Math.floor(idx);
    const high = Math.min(numPoints - 1, low + 1);
    const frac = idx - low;
    return curve[low] * (1 - frac) + curve[high] * frac;
  }

  // Calculate dynamic motion tracking trajectory for text and stickers
  applyMotionTracking(
    time: number,
    clipStartTime: number,
    clipDuration: number,
    motionTrack?: any,
  ): { dx: number; dy: number; dScale: number; dRot: number } {
    if (!motionTrack || !motionTrack.enabled) {
      return { dx: 0, dy: 0, dScale: 1.0, dRot: 0 };
    }
    const elapsed = Math.max(0, time - clipStartTime);
    const progress = clipDuration > 0 ? elapsed / clipDuration : 0;
    const intensity = (motionTrack.intensity || 60) / 100;

    switch (motionTrack.mode) {
      case "follow_center": {
        const dx = Math.sin(progress * Math.PI * 2) * 28 * intensity;
        const dy = Math.cos(progress * Math.PI * 2) * 14 * intensity;
        return { dx, dy, dScale: 1.0, dRot: 0 };
      }
      case "cinematic_drift": {
        const dx = (progress - 0.5) * 65 * intensity;
        const dy = Math.sin(progress * Math.PI) * -16 * intensity;
        return { dx, dy, dScale: 1.0 + progress * 0.12 * intensity, dRot: 0 };
      }
      case "dynamic_zoom": {
        const dScale = 1.0 + Math.sin(progress * Math.PI) * 0.28 * intensity;
        const dy = (progress - 0.5) * -22 * intensity;
        return { dx: 0, dy, dScale, dRot: 0 };
      }
      case "orbit_float": {
        const dx = Math.sin(elapsed * 2.5) * 18 * intensity;
        const dy = Math.cos(elapsed * 2.5) * 18 * intensity;
        const dRot = Math.sin(elapsed * 1.5) * 4 * intensity;
        return { dx, dy, dScale: 1.0, dRot };
      }
      default:
        return { dx: 0, dy: 0, dScale: 1.0, dRot: 0 };
    }
  }

  applyEffectOverlay(
    ctx: CanvasRenderingContext2D,
    eff: EffectClip,
    time: number,
    w: number,
    h: number,
  ) {
    if (!this.canvas) return;
    ctx.save();
    const intensity = eff.intensity || 0.8;

    if (eff.type === "glitch") {
      const sliceH = 18;
      for (let y = 0; y < h; y += sliceH * 1.5) {
        if (Math.random() > 0.35) {
          const shift = (Math.random() - 0.5) * 45 * intensity;
          ctx.drawImage(this.canvas, 0, y, w, sliceH, shift, y, w, sliceH);
        }
      }
      ctx.fillStyle = "rgba(255, 0, 80, 0.12)";
      ctx.fillRect(0, 0, w, h);
    } else if (eff.type === "vhs") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 2);
      }
      const barY = (time * 260) % h;
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.fillRect(0, barY, w, 14);
      ctx.font = "bold 16px Courier, monospace";
      ctx.fillStyle = "#00FF66";
      const secs = Math.floor(time).toString().padStart(2, "0");
      const frames = Math.floor((time % 1) * 30).toString().padStart(2, "0");
      ctx.fillText(`PLAY ▶ SP 00:${secs}:${frames}`, 24, h - 32);
    } else if (eff.type === "rgb_split") {
      ctx.globalCompositeOperation = "screen";
      const offset = 6 * intensity;
      ctx.fillStyle = "rgba(0, 242, 254, 0.28)";
      ctx.fillRect(offset, 0, w, h);
      ctx.fillStyle = "rgba(255, 0, 80, 0.28)";
      ctx.fillRect(-offset, 0, w, h);
    } else if (eff.type === "film_grain") {
      const numDots = Math.floor(200 * intensity);
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      for (let i = 0; i < numDots; i++) {
        const rx = Math.random() * w;
        const ry = Math.random() * h;
        ctx.fillRect(rx, ry, 2, 2);
      }
    } else if (eff.type === "zoom_pulse") {
      const pulseScale = 1.0 + Math.sin(time * 8) * 0.05 * intensity;
      ctx.translate(w / 2, h / 2);
      ctx.scale(pulseScale, pulseScale);
      ctx.translate(-w / 2, -h / 2);
    } else if (eff.type === "neon_edge") {
      ctx.strokeStyle = "rgba(0, 242, 254, 0.6)";
      ctx.lineWidth = 8 * intensity;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.strokeStyle = "rgba(255, 0, 80, 0.4)";
      ctx.lineWidth = 4 * intensity;
      ctx.strokeRect(10, 10, w - 20, h - 20);
    } else if (eff.type === "blur" || eff.type === "blur_cinematic") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(0, 0, w, h);
    } else if (eff.type === "flash") {
      const flashVal = Math.sin(time * 12);
      if (flashVal > 0.7) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(flashVal - 0.7) * 2 * intensity})`;
        ctx.fillRect(0, 0, w, h);
      }
    } else if (eff.type === "vignette") {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, `rgba(0,0,0,${0.75 * intensity})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    } else if (eff.type === "mirror") {
      // Bilateral vertical mirror split
      ctx.drawImage(this.canvas, 0, 0, w / 2, h, w / 2, 0, w / 2, h);
    } else if (eff.type === "shake") {
      const sx = (Math.random() - 0.5) * 12 * intensity;
      const sy = (Math.random() - 0.5) * 12 * intensity;
      ctx.drawImage(this.canvas, 0, 0, w, h, sx, sy, w, h);
    } else if (eff.type === "rainbow_flow") {
      const hue = Math.floor((time * 120) % 360);
      ctx.fillStyle = `hsla(${hue}, 90%, 50%, 0.12)`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  drawSticker(
    ctx: CanvasRenderingContext2D,
    stk: StickerClip,
    time: number,
    w: number,
    h: number,
  ) {
    ctx.save();
    const motion = this.applyMotionTracking(time, stk.startTime, stk.duration, stk.motionTrack);
    const px = (stk.position?.x ?? 50) * (w / 100) + motion.dx;
    const py = (stk.position?.y ?? 50) * (h / 100) + motion.dy;
    const scale = (stk.scale || 1.0) * motion.dScale;
    const rot = (stk.rotation || 0) + motion.dRot;
    const bounce = Math.sin((time - stk.startTime) * 4) * 0.08;
    const finalScale = scale + bounce;

    ctx.translate(px, py);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(finalScale, finalScale);

    const charText = stk.char || "🔥";
    const isBadge = charText.length > 2;

    if (isBadge) {
      // Render as a vibrant creator badge card
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
      const metrics = ctx.measureText(charText);
      const badgeW = metrics.width + 24;
      const badgeH = 38;

      ctx.shadowColor = "rgba(0, 242, 254, 0.4)";
      ctx.shadowBlur = 12;

      ctx.fillStyle = "rgba(11, 13, 19, 0.9)";
      if ((ctx as any).roundRect) {
        ctx.beginPath();
        (ctx as any).roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 19);
        ctx.fill();
        ctx.strokeStyle = "#00F2FE";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(charText, 0, 0);
    } else {
      // Render as large crisp emoji
      ctx.font = "64px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(charText, 0, 0);
    }

    ctx.restore();
  }

  drawTextOverlay(
    ctx: CanvasRenderingContext2D,
    txt: TextClip,
    time: number,
    w: number,
    h: number,
  ) {
    ctx.save();
    const motion = this.applyMotionTracking(time, txt.startTime, txt.duration, txt.motionTrack);
    const px = (txt.position?.x ?? 50) * (w / 100) + motion.dx;
    const py = (txt.position?.y ?? 50) * (h / 100) + motion.dy;
    const elapsed = Math.max(0, time - txt.startTime);
    let displayText = txt.text || "";
    let scale = (txt.scale || 1.0) * motion.dScale;
    let alpha = 1.0;
    let xOffset = 0;
    let yOffset = 0;

    const anim = txt.animation || "fade";

    if (anim === "typewriter") {
      const chars = Math.min(displayText.length, Math.floor(elapsed * 14));
      displayText = displayText.slice(0, chars);
    } else if (anim === "bounce") {
      if (elapsed < 0.45) {
        const p = elapsed / 0.45;
        scale = (0.5 + Math.sin(p * Math.PI) * 0.7) * (txt.scale || 1.0);
      }
    } else if (anim === "fade") {
      if (elapsed < 0.4) alpha = elapsed / 0.4;
    } else if (anim === "slideUp") {
      if (elapsed < 0.35) {
        const p = elapsed / 0.35;
        yOffset = (1 - p) * 45;
        alpha = p;
      }
    } else if (anim === "slideDown") {
      if (elapsed < 0.35) {
        const p = elapsed / 0.35;
        yOffset = -(1 - p) * 45;
        alpha = p;
      }
    } else if (anim === "zoomIn") {
      if (elapsed < 0.4) {
        const p = elapsed / 0.4;
        scale = (p * 1.15) * (txt.scale || 1.0);
        alpha = p;
      }
    } else if (anim === "pulse") {
      scale = (1.0 + Math.sin(elapsed * 6) * 0.08) * (txt.scale || 1.0);
    } else if (anim === "glitch") {
      if (Math.random() > 0.7) {
        xOffset = (Math.random() - 0.5) * 8;
        yOffset = (Math.random() - 0.5) * 4;
      }
    } else if (anim === "shake") {
      if (elapsed < 0.8) {
        xOffset = Math.sin(elapsed * 40) * 4;
      }
    } else if (anim === "wave") {
      yOffset = Math.sin(elapsed * 4) * 8;
    }

    ctx.translate(px + xOffset, py + yOffset);
    ctx.rotate(((txt.rotation || 0) * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const style = txt.style || {};
    const fontSize = style.fontSize || 24;
    const fontWeight = style.fontWeight || "bold";
    const fontFamily = style.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textMetrics = ctx.measureText(displayText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.25;

    // Draw Background Pill or Box if present
    if (style.backgroundColor && style.backgroundColor !== "transparent") {
      ctx.fillStyle = style.backgroundColor;
      const padX = style.paddingHorizontal || 14;
      const padY = style.paddingVertical || 8;
      const radius = style.borderRadius || 8;

      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(
          -textWidth / 2 - padX,
          -textHeight / 2 - padY,
          textWidth + padX * 2,
          textHeight + padY * 2,
          radius,
        );
      } else {
        ctx.rect(
          -textWidth / 2 - padX,
          -textHeight / 2 - padY,
          textWidth + padX * 2,
          textHeight + padY * 2,
        );
      }
      ctx.fill();

      if (style.borderColor && (style.borderWidth || 1)) {
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = style.borderWidth || 2;
        ctx.stroke();
      }
    }

    // Text Effects & Shadows
    const effect = style.textEffect || "none";

    if (effect === "neon") {
      const glowColor = style.borderColor || style.color || "#00F2FE";
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (effect === "3d") {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      for (let offset = 4; offset >= 1; offset--) {
        ctx.fillText(displayText, offset, offset);
      }
      ctx.restore();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
    } else if (effect === "shadow") {
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 5;
    } else if (effect === "cyber") {
      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 80, 0.85)";
      ctx.fillText(displayText, 3, 2);
      ctx.fillStyle = "rgba(0, 242, 254, 0.85)";
      ctx.fillText(displayText, -2, -2);
      ctx.restore();
    } else if (effect === "gold") {
      ctx.shadowColor = "#FFE600";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (effect === "glitch") {
      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 80, 0.8)";
      ctx.fillText(displayText, 3, 0);
      ctx.fillStyle = "rgba(0, 242, 254, 0.8)";
      ctx.fillText(displayText, -3, 0);
      ctx.restore();
    } else if (style.textShadowColor) {
      ctx.shadowColor = style.textShadowColor;
      ctx.shadowBlur = style.textShadowRadius || 12;
      ctx.shadowOffsetX = style.textShadowOffset?.width || 0;
      ctx.shadowOffsetY = style.textShadowOffset?.height || 0;
    }

    // Optional Stroke / Outline
    if (effect === "stroke" || (style.strokeColor && (style.strokeWidth || 2))) {
      ctx.strokeStyle = style.strokeColor || style.borderColor || "#000000";
      ctx.lineWidth = style.strokeWidth || 3;
      ctx.strokeText(displayText, 0, 0);
    }

    ctx.fillStyle = style.color || "#FFFFFF";
    ctx.fillText(displayText, 0, 0);

    ctx.restore();
  }

  drawProceduralPlaceholder(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    title: string,
    time: number,
  ) {
    ctx.fillStyle = "#10131A";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#252A36";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    ctx.font =
      'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = "#6B7280";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, h / 2 - 10);

    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = "#4B5563";
    ctx.fillText("Tap + to add video clips or audio tracks", w / 2, h / 2 + 25);
  }

  async exportVideo(
    project: FastArtProject,
    options: ExportOptions = {},
    onProgress?: (
      percent: number,
      currentTime: number,
      duration: number,
    ) => void,
  ): Promise<ExportResult> {
    if (typeof window === "undefined" || !this.canvas) {
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
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const exportRenderer = new VideoRenderer(exportCanvas);
    // Inherit preloaded media cache from this renderer so clips render immediately
    exportRenderer.videoElements = new Map(this.videoElements);

    const exportLogicalW =
      logicalWidth && logicalWidth > 0
        ? logicalWidth
        : this.canvas.clientWidth > 0
          ? this.canvas.clientWidth
          : exportCanvas.width;

    const exportLogicalH =
      logicalHeight && logicalHeight > 0
        ? logicalHeight
        : this.canvas.clientHeight > 0
          ? this.canvas.clientHeight
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
    const totalFrames = Math.ceil(duration * fps);

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
      // webm
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

      // Start recording with 100ms timeslice to ensure continuous chunk buffer delivery
      mediaRecorder.start(100);

      for (let frame = 0; frame < totalFrames; frame++) {
        const frameTime = frame / fps;
        exportRenderer.renderFrame(project, frameTime, false, exportLogicalW, exportLogicalH);

        if (onProgress) {
          const percent = Math.round((frame / totalFrames) * 100);
          onProgress(percent, frameTime, duration);
        }

        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      if (typeof mediaRecorder.requestData === "function" && mediaRecorder.state === "recording") {
        try {
          mediaRecorder.requestData();
        } catch (e) {}
      }
      mediaRecorder.stop();
    });
  }
}
