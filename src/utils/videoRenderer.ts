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
  public onFrameNeeded?: () => void;

  constructor(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.videoElements = new Map();
  }

  setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
  }

  // Preload and cache media elements with instant load notifications
  async preloadClip(
    clip: VideoClip,
  ): Promise<HTMLVideoElement | HTMLImageElement | null> {
    if (typeof window === "undefined") return null;
    if (this.videoElements.has(clip.url)) {
      return this.videoElements.get(clip.url)!;
    }

    if (clip.type === "video") {
      const vid = document.createElement("video");
      if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
        vid.crossOrigin = "anonymous";
      }
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "auto";
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

  // Sync HTML5 video playback for butter-smooth 60fps rendering without decoder stutter
  syncPlayback(
    activeClip: VideoClip | null,
    time: number,
    isPlaying: boolean,
  ) {
    if (typeof window === "undefined") return;

    // 1. Pause any video that is NOT the active clip
    this.videoElements.forEach((el, url) => {
      if (el instanceof HTMLVideoElement && (!activeClip || url !== activeClip.url)) {
        if (!el.paused) {
          el.pause();
        }
      }
    });

    if (!activeClip || activeClip.type !== "video") return;

    const mediaEl = this.videoElements.get(activeClip.url);
    if (!mediaEl || !(mediaEl instanceof HTMLVideoElement)) return;
    const vid = mediaEl as HTMLVideoElement;

    const clipLocalTime = Math.max(0, time - activeClip.startTime);
    const mediaTime = activeClip.reverse
      ? Math.max(
          0,
          (activeClip.trimOut || activeClip.duration) -
            clipLocalTime * (activeClip.speed || 1.0),
        )
      : (activeClip.trimIn || 0) + clipLocalTime * (activeClip.speed || 1.0);

    const speed = Math.max(0.1, Math.min(16, activeClip.speed || 1.0));
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
        vid.currentTime = Math.max(0, mediaTime);
      }
    }
  }

  // Render a specific timestamp frame
  renderFrame(
    project: FastArtProject,
    time: number,
    isPlaying: boolean = false,
    targetWidth = 1080,
    targetHeight = 1920,
  ) {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear background
    ctx.fillStyle = "#0B0D13";
    ctx.fillRect(0, 0, w, h);

    const videoClips = project.tracks.video || [];
    let activeClip: VideoClip | null = null;
    let nextClip: VideoClip | null = null;

    for (let i = 0; i < videoClips.length; i++) {
      const c = videoClips[i];
      const start = c.startTime;
      const end = c.startTime + c.duration;
      if (time >= start && time <= end) {
        activeClip = c;
        if (i < videoClips.length - 1) {
          nextClip = videoClips[i + 1];
        }
        break;
      }
    }

    // Synchronize HTML5 video playback
    this.syncPlayback(activeClip, time, isPlaying);

    // 1. Draw Active Video Clip Frame
    if (activeClip) {
      this.drawClip(ctx, activeClip, time, w, h, nextClip);
    } else if (videoClips.length > 0) {
      this.drawProceduralPlaceholder(ctx, w, h, "FastArt Video Engine", time);
    } else {
      this.drawProceduralPlaceholder(ctx, w, h, "No Media Added", time);
    }

    // 2. Draw Active Effects
    const effects = project.tracks.effects || [];
    effects.forEach((eff) => {
      if (time >= eff.startTime && time <= eff.startTime + eff.duration) {
        this.applyEffectOverlay(ctx, eff, time, w, h);
      }
    });

    // 3. Draw Active Stickers
    const stickers = project.tracks.stickers || [];
    stickers.forEach((stk) => {
      if (time >= stk.startTime && time <= stk.startTime + stk.duration) {
        this.drawSticker(ctx, stk, time, w, h);
      }
    });

    // 4. Draw Active Text Overlays
    const texts = project.tracks.text || [];
    texts.forEach((txt) => {
      if (time >= txt.startTime && time <= txt.startTime + txt.duration) {
        this.drawTextOverlay(ctx, txt, time, w, h);
      }
    });
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

    this.applyColorFilter(ctx, clip.filter);

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
      const aspect = mw / mh;
      let dw = w;
      let dh = w / aspect;
      if (dh < h) {
        dh = h;
        dw = h * aspect;
      }
      ctx.drawImage(mediaEl, -dw / 2, -dh / 2, dw, dh);
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

  applyColorFilter(ctx: CanvasRenderingContext2D, filterId?: string) {
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
    const px = (stk.position?.x ?? 50) * (w / 100);
    const py = (stk.position?.y ?? 50) * (h / 100);
    const scale = stk.scale || 1.0;
    const rot = stk.rotation || 0;
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
    const px = (txt.position?.x ?? 50) * (w / 100);
    const py = (txt.position?.y ?? 50) * (h / 100);
    const elapsed = Math.max(0, time - txt.startTime);
    let displayText = txt.text || "";
    let scale = txt.scale || 1.0;
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

    // Text Shadow / Glow
    if (style.textShadowColor) {
      ctx.shadowColor = style.textShadowColor;
      ctx.shadowBlur = style.textShadowRadius || 12;
      ctx.shadowOffsetX = style.textShadowOffset?.width || 0;
      ctx.shadowOffsetY = style.textShadowOffset?.height || 0;
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
    } = options;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const exportRenderer = new VideoRenderer(exportCanvas);

    // 1. PNG Snapshot / Poster Frame Export
    if (format === "png") {
      const captureTime = Math.max(0, Math.min(currentTime, duration));
      exportRenderer.renderFrame(project, captureTime);
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
        exportRenderer.renderFrame(project, frameTime);

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
    const stream = (exportCanvas as any).captureStream(fps);

    // Pick best MIME type supported by browser
    const isSupported = (type: string) =>
      typeof (window as any).MediaRecorder?.isTypeSupported === "function" &&
      (window as any).MediaRecorder.isTypeSupported(type);

    let mimeType = "video/webm";
    let targetExtension = "webm";

    if (format === "mp4") {
      targetExtension = "mp4";
      if (isSupported("video/mp4;codecs=avc1")) {
        mimeType = "video/mp4;codecs=avc1";
      } else if (isSupported("video/mp4")) {
        mimeType = "video/mp4";
      } else if (isSupported("video/mp4;codecs=h264")) {
        mimeType = "video/mp4;codecs=h264";
      } else if (isSupported("video/webm;codecs=h264")) {
        mimeType = "video/webm;codecs=h264";
      } else if (isSupported("video/webm;codecs=vp9")) {
        mimeType = "video/webm;codecs=vp9";
      } else {
        mimeType = "video/webm";
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

    const recordedChunks: Blob[] = [];
    const mediaRecorder = new (window as any).MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: format === "mp4" ? 10000000 : 8000000,
    });

    mediaRecorder.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    return new Promise(async (resolve, reject) => {
      mediaRecorder.onstop = () => {
        const finalMime = format === "mp4" ? "video/mp4" : mimeType;
        const blob = new Blob(recordedChunks, { type: finalMime });
        const videoUrl = URL.createObjectURL(blob);
        resolve({
          blob,
          videoUrl,
          mimeType: finalMime,
          format,
          extension: targetExtension,
          fileSize: blob.size,
        });
      };

      mediaRecorder.onerror = (err: any) => reject(err);

      mediaRecorder.start();

      for (let frame = 0; frame < totalFrames; frame++) {
        const frameTime = frame / fps;
        exportRenderer.renderFrame(project, frameTime);

        if (onProgress) {
          const percent = Math.round((frame / totalFrames) * 100);
          onProgress(percent, frameTime, duration);
        }

        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      mediaRecorder.stop();
    });
  }
}
