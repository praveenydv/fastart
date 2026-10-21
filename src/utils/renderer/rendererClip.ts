import { VideoClip } from "../../types/project";
import {
  applyMaskPath,
  drawClipWithCutout,
  drawLoadingPreview,
  applyColorFilter,
  applyEffectOverlay,
  applyMotionTracking,
} from "./rendererEffects";

export interface ClipRenderContext {
  videoElements: Map<string, HTMLVideoElement | HTMLImageElement>;
  thumbnailElements: Map<string, HTMLImageElement>;
  previewCropClipId: string | null;
  offscreenCanvas: HTMLCanvasElement | null;
  offscreenCtx: CanvasRenderingContext2D | null;
  canvas: HTMLCanvasElement | null;
  onFrameNeeded?: () => void;
  preloadClip: (clip: VideoClip) => Promise<HTMLVideoElement | HTMLImageElement | null>;
  ensureOffscreen: (cw: number, ch: number) => HTMLCanvasElement | null;
}

export function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip,
  time: number,
  w: number,
  h: number,
  renderCtx: ClipRenderContext,
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
  let yOffset = 0;

  let t = clip.transform || { scale: 1, rotation: 0, x: 0, y: 0 };
  let keyframeOpacity = 1.0;

  if (clip.keyframes && clip.keyframes.length > 0) {
    const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time);
    if (clipLocalTime <= kfs[0].time) {
      t = { ...t, ...(kfs[0].transform || {}) };
      if (kfs[0].opacity !== undefined) keyframeOpacity = kfs[0].opacity;
    } else if (clipLocalTime >= kfs[kfs.length - 1].time) {
      const last = kfs[kfs.length - 1];
      t = { ...t, ...(last.transform || {}) };
      if (last.opacity !== undefined) keyframeOpacity = last.opacity;
    } else {
      for (let i = 0; i < kfs.length - 1; i++) {
        const k1 = kfs[i];
        const k2 = kfs[i + 1];
        if (clipLocalTime >= k1.time && clipLocalTime <= k2.time) {
          const span = k2.time - k1.time;
          const progress = span > 0 ? (clipLocalTime - k1.time) / span : 0;
          const ease = progress * progress * (3 - 2 * progress);
          const t1 = k1.transform || {};
          const t2 = k2.transform || {};
          t = {
            scale: (t1.scale ?? 1) + ((t2.scale ?? 1) - (t1.scale ?? 1)) * ease,
            rotation: (t1.rotation ?? 0) + ((t2.rotation ?? 0) - (t1.rotation ?? 0)) * ease,
            x: (t1.x ?? 0) + ((t2.x ?? 0) - (t1.x ?? 0)) * ease,
            y: (t1.y ?? 0) + ((t2.y ?? 0) - (t1.y ?? 0)) * ease,
            flipX: t2.flipX !== undefined ? t2.flipX : t1.flipX,
            flipY: t2.flipY !== undefined ? t2.flipY : t1.flipY,
          };
          const op1 = k1.opacity ?? 1.0;
          const op2 = k2.opacity ?? 1.0;
          keyframeOpacity = op1 + (op2 - op1) * ease;
          break;
        }
      }
    }
  }

  if (clip.motionTrack && clip.motionTrack.enabled) {
    const motion = applyMotionTracking(time, clip.startTime, clip.duration, clip.motionTrack);
    xOffset += motion.dx;
    yOffset += motion.dy;
    scaleModifier *= motion.dScale;
  }

  const clipOpacity = (t?.opacity !== undefined ? t.opacity : 1.0) * keyframeOpacity;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha * clipOpacity));

  ctx.translate(w / 2 + t.x + xOffset, h / 2 + t.y + yOffset);
  ctx.rotate(((t.rotation || 0) * Math.PI) / 180);

  const scaleX = (t.flipX ? -1 : 1) * (t.scale || 1) * scaleModifier;
  const scaleY = (t.flipY ? -1 : 1) * (t.scale || 1) * scaleModifier;
  ctx.scale(scaleX, scaleY);

  applyColorFilter(ctx, clip.filter, clip.customLut);

  if (!renderCtx.videoElements.has(clip.url)) {
    renderCtx.preloadClip(clip);
  }

  const mediaEl = renderCtx.videoElements.get(clip.url);
  const isImage = mediaEl instanceof HTMLImageElement || (mediaEl && (mediaEl as any).tagName === "IMG");
  const isVideo = mediaEl instanceof HTMLVideoElement || (mediaEl && (mediaEl as any).tagName === "VIDEO");

  const isVideoReady = isVideo && (mediaEl as HTMLVideoElement).readyState >= 1 && (mediaEl as HTMLVideoElement).videoWidth > 0;
  const isImageReady = isImage && (mediaEl as HTMLImageElement).complete && (mediaEl as HTMLImageElement).naturalWidth > 0;
  const isReady = isImageReady || isVideoReady;

  let activeMedia: any = isReady ? mediaEl : null;

  if (!activeMedia && clip.thumbnail) {
    let thumbEl = renderCtx.thumbnailElements.get(clip.id);
    if (!thumbEl) {
      thumbEl = new Image();
      thumbEl.onload = () => {
        if (renderCtx.onFrameNeeded) renderCtx.onFrameNeeded();
      };
      thumbEl.src = clip.thumbnail;
      renderCtx.thumbnailElements.set(clip.id, thumbEl);
    }
    if (thumbEl.complete && thumbEl.naturalWidth > 0) {
      activeMedia = thumbEl;
    }
  }

  if (activeMedia) {
    const mw = (activeMedia as any).videoWidth || (activeMedia as any).naturalWidth || (activeMedia as any).width || 1920;
    const mh = (activeMedia as any).videoHeight || (activeMedia as any).naturalHeight || (activeMedia as any).height || 1080;

    const isPreviewCropping = renderCtx.previewCropClipId === clip.id;
    const crop = isPreviewCropping ? null : (clip.crop || clip.transform?.crop);
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
    const fitMode = clip.fit || "contain";

    if (isPreviewCropping || fitMode === "cover") {
      if (dh < h) {
        dh = h;
        dw = h * aspect;
      }
    } else {
      // Default "contain" mode: keep the full video visible and reveal canvas background
      if (dh > h) {
        dh = h;
        dw = h * aspect;
      }
    }

    const mask = clip.mask || clip.transform?.mask;
    if (mask && mask.shape && mask.shape !== "none") {
      applyMaskPath(ctx, mask, dw, dh);
    }

    const cutout = clip.cutout || clip.transform?.cutout;
    if (cutout && cutout.enabled) {
      drawClipWithCutout(ctx, activeMedia as any, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh, cutout, renderCtx.offscreenCanvas, renderCtx.offscreenCtx);
    } else {
      ctx.drawImage(activeMedia, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    }

    if (
      (clip.smoothSlowMo === "blend" || clip.smoothSlowMo === "optical_flow") &&
      (clip.speed || 1.0) < 1.0
    ) {
      ctx.save();
      ctx.globalAlpha = clip.smoothSlowMo === "optical_flow" ? 0.35 : 0.22;
      ctx.drawImage(activeMedia, sx, sy, sw, sh, -dw / 2 + 1, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else {
    const hasError = Boolean(mediaEl && (mediaEl as any).error);
    drawLoadingPreview(ctx, clip, clipLocalTime, w, h, hasError);
  }

  ctx.restore();

  if (clip.effect && clip.effect !== "none") {
    applyEffectOverlay(
      ctx,
      {
        id: "clip-eff-" + clip.id,
        type: clip.effect,
        name: clip.effect,
        startTime: clip.startTime,
        duration: clip.duration,
        intensity: 0.8,
      },
      time,
      w,
      h,
      renderCtx.canvas,
      renderCtx.ensureOffscreen,
    );
  }

  if (trans && trans.type === "flash_white" && timeLeft <= trans.duration) {
    const p = 1 - timeLeft / trans.duration;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(p * Math.PI)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
