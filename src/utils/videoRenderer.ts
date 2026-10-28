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
import { setOnMaskUpdated } from "../services/selfieSegmentationService";

export type { ExportFormat, ExportOptions, ExportResult };

export class VideoRenderer {
  public canvas: HTMLCanvasElement | null;
  public ctx: CanvasRenderingContext2D | null;
  public videoElements: Map<string, HTMLVideoElement | HTMLImageElement>;
  public thumbnailElements: Map<string, HTMLImageElement> = new Map();
  public bgImageElements: Map<string, HTMLImageElement> = new Map();
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
  public isPlaying: boolean = false;
  private maskFramePending: boolean = false;

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

    setOnMaskUpdated(() => {
      // If video is playing, animation loop already renders at 60fps; do NOT re-trigger!
      // When paused, debounce with requestAnimationFrame to prevent recursion lockup.
      if (this.onFrameNeeded && !this.isPlaying) {
        if (!this.maskFramePending) {
          this.maskFramePending = true;
          requestAnimationFrame(() => {
            this.maskFramePending = false;
            if (!this.isPlaying && this.onFrameNeeded) {
              this.onFrameNeeded();
            }
          });
        }
      }
    });
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

  getClipRenderDimensions(
    clip: any,
    logicalWidth?: number,
    logicalHeight?: number
  ): { dw: number; dh: number; sw: number; sh: number } {
    const w = logicalWidth && logicalWidth > 0 ? logicalWidth : (this.canvas?.clientWidth || 360);
    const h = logicalHeight && logicalHeight > 0 ? logicalHeight : (this.canvas?.clientHeight || 640);

    const natural = this.getMediaNaturalDimensions(clip?.url);
    const mw = natural?.width || clip?.naturalWidth || clip?.width || 1920;
    const mh = natural?.height || clip?.naturalHeight || clip?.height || 1080;

    const crop = clip?.crop || clip?.transform?.crop;
    let sw = mw;
    let sh = mh;
    if (crop && crop.width > 0 && crop.height > 0) {
      sw = Math.min(mw, (crop.width / 100) * mw);
      sh = Math.min(mh, (crop.height / 100) * mh);
    }

    const aspect = (sw / sh) || (16 / 9);
    let dw = w;
    let dh = w / aspect;
    const fitMode = clip?.fit || "contain";

    if (fitMode === "cover") {
      if (dh < h) {
        dh = h;
        dw = h * aspect;
      }
    } else {
      if (dh > h) {
        dh = h;
        dw = h * aspect;
      }
    }

    return { dw, dh, sw, sh };
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
    this.bgImageElements.clear();
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
    transientOverride?: {
      clipId: string;
      x?: number;
      y?: number;
      scale?: number;
      rotation?: number;
      mask?: any;
    } | null,
  ) {
    if (!this.canvas || !this.ctx) return;
    this.isPlaying = isPlaying;
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

        // Standard active video playback window (exclusive end boundary when adjacent next clip exists to prevent cut bleed)
        const hasAdjacentNext = videoClips.some(
          (other) =>
            other.id !== c.id &&
            (other.trackIndex || 0) === (c.trackIndex || 0) &&
            Math.abs(other.startTime - cEnd) < 0.01,
        );
        const isActiveAtTime = hasAdjacentNext
          ? time >= c.startTime && time < cEnd
          : time >= c.startTime && time <= cEnd;

        if (!handledVideoIds.has(c.id) && isActiveAtTime) {
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
        if (canvasBg.startsWith("image:")) {
          const imgUrl = canvasBg.replace("image:", "");
          let imgEl = this.bgImageElements.get(imgUrl);
          if (!imgEl) {
            imgEl = new Image();
            if (!imgUrl.startsWith("blob:") && !imgUrl.startsWith("data:")) {
              imgEl.crossOrigin = "anonymous";
            }
            imgEl.onload = () => {
              if (this.onFrameNeeded) this.onFrameNeeded();
            };
            imgEl.onerror = () => {
              if (imgEl && imgEl.crossOrigin) {
                imgEl.removeAttribute("crossorigin");
                imgEl.src = imgUrl;
              }
            };
            imgEl.src = imgUrl;
            this.bgImageElements.set(imgUrl, imgEl);
          }

          if (imgEl.complete && imgEl.naturalWidth > 0) {
            const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight;
            const canvasAspect = w / h;
            let sx = 0, sy = 0, sw = imgEl.naturalWidth, sh = imgEl.naturalHeight;
            if (imgAspect > canvasAspect) {
              sw = imgEl.naturalHeight * canvasAspect;
              sx = (imgEl.naturalWidth - sw) / 2;
            } else {
              sh = imgEl.naturalWidth / canvasAspect;
              sy = (imgEl.naturalHeight - sh) / 2;
            }
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, w, h);
            ctx.restore();
            return;
          }
          ctx.fillStyle = "#121620";
          ctx.fillRect(0, 0, w, h);
          return;
        }

        if (canvasBg.startsWith("blur:")) {
          const blurPx = parseInt(canvasBg.split(":")[1]) || 25;
          let media: any = null;

          // 1. Check currently active video elements
          for (const vid of activeVideos) {
            const el = this.videoElements.get(vid.url);
            if (el) {
              if (el instanceof HTMLVideoElement && (el.readyState >= 1 || el.videoWidth > 0)) {
                media = el;
                break;
              } else if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) {
                media = el;
                break;
              }
            }
            const thumb = this.thumbnailElements.get(vid.id);
            if (thumb && thumb.complete && thumb.naturalWidth > 0) {
              media = thumb;
              break;
            }
          }

          // 2. If no active video element is ready, check other clips from project.tracks.video
          if (!media && videoClips.length > 0) {
            for (const vid of videoClips) {
              const el = this.videoElements.get(vid.url);
              if (el) {
                if (el instanceof HTMLVideoElement && (el.readyState >= 1 || el.videoWidth > 0)) {
                  media = el;
                  break;
                } else if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) {
                  media = el;
                  break;
                }
              }
              const thumb = this.thumbnailElements.get(vid.id);
              if (thumb && thumb.complete && thumb.naturalWidth > 0) {
                media = thumb;
                break;
              }
            }
          }

          if (media) {
            const mw = (media as any).videoWidth || (media as any).naturalWidth || (media as any).width || w;
            const mh = (media as any).videoHeight || (media as any).naturalHeight || (media as any).height || h;
            const mediaAspect = mw / mh;
            const canvasAspect = w / h;

            let drawW = w;
            let drawH = h;
            if (mediaAspect > canvasAspect) {
              drawH = h;
              drawW = h * mediaAspect;
            } else {
              drawW = w;
              drawH = w / mediaAspect;
            }

            // Margin and scale so blur expands beyond canvas boundaries without edge feathering
            const margin = Math.max(48, blurPx * 2.5);
            const scale = Math.max((w + margin * 2) / drawW, (h + margin * 2) / drawH, 1.25);
            const finalW = drawW * scale;
            const finalH = drawH * scale;
            const finalX = (w - finalW) / 2;
            const finalY = (h - finalH) / 2;

            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.filter = `blur(${blurPx}px) brightness(0.72) saturate(1.2)`;
            ctx.drawImage(media as any, finalX, finalY, finalW, finalH);
            ctx.restore();
            return;
          }

          ctx.fillStyle = "#0B0D13";
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
          trackIndex: (typeof item.clip.trackIndex === "number" ? item.clip.trackIndex : 0) * 100,
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
          const activeFilterClip = activeEffects.find((e) => e.filter || e.type?.startsWith("filter_"));
          const effectiveFilter = item.clip.filter || activeFilterClip?.filter || (activeFilterClip ? activeFilterClip.type.replace(/^filter_/, "") : undefined) || project.filter;
          const effectiveCustomLut = item.clip.customLut || activeFilterClip?.customLut || project.customLut;
          const clipToDraw: VideoClip = isOverridden
            ? {
                ...item.clip,
                filter: effectiveFilter,
                customLut: effectiveCustomLut,
                transform: {
                  ...(item.clip.transform || {}),
                  x: transientOverride!.x !== undefined ? transientOverride!.x : (item.clip.transform?.x || 0),
                  y: transientOverride!.y !== undefined ? transientOverride!.y : (item.clip.transform?.y || 0),
                  scale: transientOverride!.scale !== undefined ? transientOverride!.scale : (item.clip.transform?.scale ?? 1.0),
                  rotation: transientOverride!.rotation !== undefined ? transientOverride!.rotation : (item.clip.transform?.rotation ?? 0),
                  mask: transientOverride!.mask !== undefined ? transientOverride!.mask : (item.clip.transform?.mask || item.clip.mask),
                },
                mask: transientOverride!.mask !== undefined ? transientOverride!.mask : (item.clip.mask || item.clip.transform?.mask),
              }
            : {
                ...item.clip,
                filter: effectiveFilter,
                customLut: effectiveCustomLut,
              };
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
        if (item.clip && item.clip.type && item.clip.type !== "none" && item.clip.type !== "None") {
          this.applyEffectOverlay(ctx, item.clip, time, w, h);
        }
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
