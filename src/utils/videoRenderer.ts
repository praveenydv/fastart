// FastArt Real-time Canvas Rendering & Video Export Engine (TypeScript)
import {
  FastArtProject,
  VideoClip,
  TextClip,
  CaptionClip,
  StickerClip,
  EffectClip,
} from "../types/project";

import {
  ExportFormat,
  ExportOptions,
  ExportResult,
  exportVideo,
} from "./renderer/videoExporter";
import {
  evaluateSpeedCurve,
  applyMotionTracking,
  applyMaskPath,
  drawLoadingPreview,
  applyColorFilter,
  drawClipWithCutout,
  applyEffectOverlay,
} from "./renderer/rendererEffects";
import {
  drawSticker,
  drawTextOverlay,
  drawCaptionOverlay,
  drawProceduralPlaceholder,
} from "./renderer/rendererTextStickers";
import {
  cleanupMedia,
  pruneUnusedMedia,
  preloadClip,
  syncPlayback,
  MediaSyncContext,
} from "./renderer/rendererMediaSync";
import { drawClip as renderClipItem, TransitionRenderState } from "./renderer/rendererClip";

export type { ExportFormat, ExportOptions, ExportResult };

export class VideoRenderer {
  public canvas: HTMLCanvasElement | null;
  public ctx: CanvasRenderingContext2D | null;
  public videoElements: Map<string, HTMLVideoElement | HTMLImageElement>;
  public thumbnailElements: Map<string, HTMLImageElement> = new Map();
  public lastUsedTimestamp: Map<string, number> = new Map();
  public onFrameNeeded?: () => void;
  public offscreenCanvas: HTMLCanvasElement | null = null;
  public offscreenCtx: CanvasRenderingContext2D | null = null;
  public effectOffscreenCanvas: HTMLCanvasElement | null = null;
  public effectOffscreenCtx: CanvasRenderingContext2D | null = null;
  private maxDecoders =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      ? 16
      : 32;
  public previewCropClipId: string | null = null;

  constructor(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas
      ? (canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null) ||
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
      ? (canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null) ||
        canvas.getContext("2d")
      : null;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
    }
  }

  setPreviewCropMode(clipId: string | null) {
    this.previewCropClipId = clipId;
  }

  getMediaNaturalDimensions(clipUrl: string): { width: number; height: number } | null {
    const el = this.videoElements.get(clipUrl);
    if (el) {
      const w = (el as any).videoWidth || (el as any).naturalWidth || (el as any).width || 0;
      const h = (el as any).videoHeight || (el as any).naturalHeight || (el as any).height || 0;
      if (w > 0 && h > 0) return { width: w, height: h };
    }
    for (const thumb of this.thumbnailElements.values()) {
      if (thumb.naturalWidth > 0 && thumb.naturalHeight > 0) {
        return { width: thumb.naturalWidth, height: thumb.naturalHeight };
      }
    }
    return null;
  }

  ensureOffscreen(w?: number, h?: number): HTMLCanvasElement | null {
    if (typeof document === "undefined" || !this.canvas) return null;
    if (!this.effectOffscreenCanvas) {
      this.effectOffscreenCanvas = document.createElement("canvas");
      this.effectOffscreenCtx = this.effectOffscreenCanvas.getContext("2d", { willReadFrequently: true });
    }
    const targetW = w && w > 0 ? Math.round(w) : this.canvas.width;
    const targetH = h && h > 0 ? Math.round(h) : this.canvas.height;
    if (this.effectOffscreenCanvas.width !== targetW || this.effectOffscreenCanvas.height !== targetH) {
      this.effectOffscreenCanvas.width = targetW;
      this.effectOffscreenCanvas.height = targetH;
    }
    if (this.effectOffscreenCtx && this.canvas) {
      this.effectOffscreenCtx.imageSmoothingEnabled = true;
      this.effectOffscreenCtx.imageSmoothingQuality = "high";
      this.effectOffscreenCtx.clearRect(0, 0, targetW, targetH);
      this.effectOffscreenCtx.drawImage(this.canvas, 0, 0, targetW, targetH);
    }
    return this.effectOffscreenCanvas;
  }

  private getMediaSyncContext(): MediaSyncContext {
    return {
      videoElements: this.videoElements,
      thumbnailElements: this.thumbnailElements,
      lastUsedTimestamp: this.lastUsedTimestamp,
      maxDecoders: this.maxDecoders,
      onFrameNeeded: this.onFrameNeeded,
    };
  }

  cleanup() {
    cleanupMedia(this.getMediaSyncContext(), this.offscreenCanvas);
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.canvas = null;
    this.ctx = null;
  }

  pruneUnusedMedia(activeUrls: Set<string>) {
    pruneUnusedMedia(this.getMediaSyncContext(), activeUrls);
  }

  async preloadClip(clip: VideoClip): Promise<HTMLVideoElement | HTMLImageElement | null> {
    return preloadClip(this.getMediaSyncContext(), clip);
  }

  syncPlayback(activeClips: VideoClip[], time: number, isPlaying: boolean) {
    syncPlayback(this.getMediaSyncContext(), activeClips, time, isPlaying);
  }

  evaluateSpeedCurve(curve: any[], progress: number): number {
    return evaluateSpeedCurve(curve, progress);
  }

  applyMotionTracking(
    time: number,
    clipStartTime: number,
    clipDuration: number,
    motionTrack?: any,
  ): { dx: number; dy: number; dScale: number; dRot: number } {
    return applyMotionTracking(time, clipStartTime, clipDuration, motionTrack);
  }

  applyMaskPath(ctx: CanvasRenderingContext2D, mask: any, dw: number, dh: number) {
    applyMaskPath(ctx, mask, dw, dh);
  }

  drawLoadingPreview(ctx: CanvasRenderingContext2D, clip: VideoClip, localTime: number, w: number, h: number) {
    const mediaEl = this.videoElements.get(clip.url);
    const hasError = Boolean(mediaEl && (mediaEl as any).error);
    drawLoadingPreview(ctx, clip, localTime, w, h, hasError);
  }

  applyColorFilter(ctx: CanvasRenderingContext2D, filterId?: string, customLut?: any) {
    applyColorFilter(ctx, filterId, customLut);
  }

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
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCtx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true });
    }
    drawClipWithCutout(ctx, mediaEl, sx, sy, sw, sh, dx, dy, dw, dh, cutout, this.offscreenCanvas, this.offscreenCtx);
  }

  applyEffectOverlay(ctx: CanvasRenderingContext2D, eff: EffectClip, time: number, w: number, h: number) {
    applyEffectOverlay(ctx, eff, time, w, h, this.canvas, (cw, ch) => this.ensureOffscreen(cw, ch));
  }

  drawSticker(ctx: CanvasRenderingContext2D, stk: StickerClip, time: number, w: number, h: number) {
    drawSticker(ctx, stk, time, w, h);
  }

  drawTextOverlay(
    ctx: CanvasRenderingContext2D,
    txt: TextClip,
    time: number,
    w: number,
    h: number,
    isPlaying: boolean = false,
  ) {
    drawTextOverlay(ctx, txt, time, w, h, isPlaying);
  }

  drawCaptionOverlay(
    ctx: CanvasRenderingContext2D,
    cap: CaptionClip,
    time: number,
    w: number,
    h: number,
    isPlaying: boolean = false,
  ) {
    drawCaptionOverlay(ctx, cap, time, w, h, isPlaying);
  }

  drawProceduralPlaceholder(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    title: string,
    time: number,
    canvasBackground?: string,
  ) {
    drawProceduralPlaceholder(ctx, w, h, title, time, canvasBackground);
  }

  renderFrame(
    project: FastArtProject,
    time: number,
    isPlaying: boolean = false,
    logicalWidth?: number,
    logicalHeight?: number,
    transientOverride?: { clipId: string; x: number; y: number; scale: number; rotation: number } | null,
  ) {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    const w = logicalWidth && logicalWidth > 0 ? logicalWidth : (this.canvas.clientWidth || canvasW);
    const h = logicalHeight && logicalHeight > 0 ? logicalHeight : (this.canvas.clientHeight || canvasH);

    ctx.clearRect(0, 0, canvasW, canvasH);

    ctx.save();
    try {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.scale(canvasW / w, canvasH / h);
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;

      const videoClips = project.tracks.video || [];
      const captionClips = project.tracks.captions || [];
      const textClips = project.tracks.text || [];
      const stickerClips = project.tracks.stickers || [];
      const effectClips = project.tracks.effects || [];

      // Collect active video clips and detect any active cross-clip transitions
      const activeVideoItems: {
        clip: VideoClip;
        trackIndex: number;
        transitionState?: TransitionRenderState | null;
      }[] = [];
      const handledVideoIds = new Set<string>();

      // Check transitions between adjacent clips on the same track
      for (let i = 0; i < videoClips.length; i++) {
        const c = videoClips[i];
        const cEnd = c.startTime + c.duration;
        const trans = c.transition;
        const transDur =
          trans && trans.type && trans.type !== "none" && trans.type !== "cut"
            ? trans.duration || 0.5
            : 0;

        // Is clip c currently in an active transition window leading into next clip?
        if (transDur > 0 && time >= cEnd - transDur && time <= cEnd) {
          const nextClip = videoClips.find(
            (other) =>
              other.id !== c.id &&
              (other.trackIndex || 0) === (c.trackIndex || 0) &&
              Math.abs(other.startTime - cEnd) < 0.35,
          );
          const p = Math.max(0, Math.min(1, (time - (cEnd - transDur)) / transDur));

          if (nextClip) {
            // 1. Draw incoming nextClip first (underneath / entering)
            activeVideoItems.push({
              clip: nextClip,
              trackIndex: (nextClip.trackIndex || 0) * 100,
              transitionState: { role: "incoming", type: trans.type, progress: p },
            });
            handledVideoIds.add(nextClip.id);

            // 2. Draw outgoing clip c on top (exiting / fading / wiping)
            activeVideoItems.push({
              clip: c,
              trackIndex: (c.trackIndex || 0) * 100 + 1,
              transitionState: { role: "outgoing", type: trans.type, progress: p },
            });
            handledVideoIds.add(c.id);
            continue;
          }
        }

        // Standard active video playback window
        if (!handledVideoIds.has(c.id) && time >= c.startTime - 0.02 && time <= cEnd + 0.02) {
          activeVideoItems.push({
            clip: c,
            trackIndex: (c.trackIndex || 0) * 100,
          });
          handledVideoIds.add(c.id);
        }
      }

      const activeVideos = activeVideoItems.map((item) => item.clip);
      const activeCaptions = captionClips.filter((c) => time >= c.startTime && time <= c.startTime + c.duration);
      const activeTexts = textClips.filter((t) => time >= t.startTime && time <= t.startTime + t.duration);
      const activeStickers = stickerClips.filter((s) => time >= s.startTime && time <= s.startTime + s.duration);
      const activeEffects = effectClips.filter((e) => time >= e.startTime && time <= e.startTime + e.duration);

      const canvasBg = (project.canvasBackground && project.canvasBackground.trim()) || "#000000";

      const drawBackground = () => {
        if (canvasBg.startsWith("blur:")) {
          const blurPx = parseInt(canvasBg.split(":")[1]) || 25;
          if (activeVideos.length > 0) {
            const primary = activeVideos[0];
            const media = this.videoElements.get(primary.url) || this.thumbnailElements.get(primary.id);
            if (media) {
              ctx.save();
              ctx.filter = `blur(${blurPx}px) brightness(0.68)`;
              ctx.drawImage(media as any, -30, -30, w + 60, h + 60);
              ctx.restore();
              return;
            }
          }
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, w, h);
        } else if (canvasBg.startsWith("gradient:")) {
          const parts = canvasBg.replace("gradient:", "").split(",");
          const c1 = parts[0] || "#1E293B";
          const c2 = parts[parts.length - 1] || "#0B0D13";
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, c1);
          grad.addColorStop(1, c2);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        } else if (canvasBg.toLowerCase() !== "transparent") {
          ctx.fillStyle = canvasBg;
          ctx.fillRect(0, 0, w, h);
        }
      };

      drawBackground();

      this.syncPlayback(activeVideos, time, isPlaying);

      const hasAnyTrackContent = Boolean(
        videoClips.length > 0 ||
        captionClips.length > 0 ||
        textClips.length > 0 ||
        stickerClips.length > 0 ||
        effectClips.length > 0 ||
        (project.tracks.audio && project.tracks.audio.length > 0)
      );

      if (activeVideos.length === 0 && !hasAnyTrackContent) {
        return;
      }

      type VisualItem =
        | { kind: "video"; clip: VideoClip; trackIndex: number; transitionState?: TransitionRenderState | null }
        | { kind: "caption"; clip: CaptionClip; trackIndex: number }
        | { kind: "text"; clip: TextClip; trackIndex: number }
        | { kind: "sticker"; clip: StickerClip; trackIndex: number }
        | { kind: "effect"; clip: EffectClip; trackIndex: number };

      const visualItems: VisualItem[] = [
        ...activeVideoItems.map((item) => ({
          kind: "video" as const,
          clip: item.clip,
          trackIndex: item.trackIndex,
          transitionState: item.transitionState,
        })),
        ...activeCaptions.map((c) => ({
          kind: "caption" as const,
          clip: c,
          trackIndex: (typeof c.trackIndex === "number" ? c.trackIndex : 2) * 100 + 2,
        })),
        ...activeTexts.map((t) => ({
          kind: "text" as const,
          clip: t,
          trackIndex: (typeof t.trackIndex === "number" ? t.trackIndex : 2) * 100 + 3,
        })),
        ...activeStickers.map((s) => ({
          kind: "sticker" as const,
          clip: s,
          trackIndex: (typeof s.trackIndex === "number" ? s.trackIndex : 3) * 100 + 4,
        })),
        ...activeEffects.map((e) => ({
          kind: "effect" as const,
          clip: e,
          trackIndex: (typeof e.trackIndex === "number" ? e.trackIndex : 4) * 100 + 5,
        })),
      ];

      visualItems.sort((a, b) => a.trackIndex - b.trackIndex);

      visualItems.forEach((item) => {
        const isOverridden = transientOverride && transientOverride.clipId === item.clip.id;
        if (item.kind === "video") {
          const clipToDraw: VideoClip = isOverridden
            ? {
                ...item.clip,
                transform: {
                  ...(item.clip.transform || {}),
                  x: transientOverride!.x,
                  y: transientOverride!.y,
                  scale: transientOverride!.scale,
                  rotation: transientOverride!.rotation,
                },
              }
            : item.clip;
          this.drawClip(ctx, clipToDraw, time, w, h, item.transitionState || null);
        } else if (item.kind === "caption") {
        const clipToDraw: CaptionClip = isOverridden
          ? {
              ...item.clip,
              position: { x: transientOverride!.x, y: transientOverride!.y },
              scale: transientOverride!.scale,
              rotation: transientOverride!.rotation,
            }
          : item.clip;
        this.drawCaptionOverlay(ctx, clipToDraw, time, w, h, isPlaying);
      } else if (item.kind === "text") {
        const clipToDraw: TextClip = isOverridden
          ? {
              ...item.clip,
              position: { x: transientOverride!.x, y: transientOverride!.y },
              scale: transientOverride!.scale,
              rotation: transientOverride!.rotation,
            }
          : item.clip;
        this.drawTextOverlay(ctx, clipToDraw, time, w, h, isPlaying);
      } else if (item.kind === "sticker") {
        const clipToDraw: StickerClip = isOverridden
          ? {
              ...item.clip,
              position: { x: transientOverride!.x, y: transientOverride!.y },
              scale: transientOverride!.scale,
              rotation: transientOverride!.rotation,
            }
          : item.clip;
        this.drawSticker(ctx, clipToDraw, time, w, h);
      } else if (item.kind === "effect") {
        this.applyEffectOverlay(ctx, item.clip, time, w, h);
      }
    });

    } catch (err) {
      console.error("[VideoRenderer] renderFrame error:", err);
    } finally {
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
      ctx.restore();
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
    }
  }

  drawClip(
    ctx: CanvasRenderingContext2D,
    clip: VideoClip,
    time: number,
    w: number,
    h: number,
    transitionState?: TransitionRenderState | null,
  ) {
    if (!this.offscreenCanvas && typeof document !== "undefined") {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCtx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true });
    }
    renderClipItem(
      ctx,
      clip,
      time,
      w,
      h,
      {
        videoElements: this.videoElements,
        thumbnailElements: this.thumbnailElements,
        previewCropClipId: this.previewCropClipId,
        offscreenCanvas: this.offscreenCanvas,
        offscreenCtx: this.offscreenCtx,
        canvas: this.canvas,
        onFrameNeeded: this.onFrameNeeded,
        preloadClip: (c) => this.preloadClip(c),
        ensureOffscreen: (cw, ch) => this.ensureOffscreen(cw, ch),
      },
      transitionState,
    );
  }

  async exportVideo(
    project: FastArtProject,
    options: ExportOptions = {},
    onProgress?: (percent: number, currentTime: number, duration: number) => void,
  ): Promise<ExportResult> {
    return exportVideo(this, project, options, onProgress, (c) => new VideoRenderer(c));
  }
}
