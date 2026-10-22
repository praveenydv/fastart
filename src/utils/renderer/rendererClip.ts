import { VideoClip } from "../../types/project";
import { getInterpolatedTransform } from "../keyframeEngine";
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
  let yOffset = 0;
  let motionRot = 0;

  if (trans && trans.duration > 0 && timeLeft <= trans.duration) {
    const progress = 1 - timeLeft / trans.duration;
    if (trans.type === "dissolve") {
      alpha = 1 - progress;
    } else if (trans.type === "zoom_in") {
      scaleModifier = 1 + progress * 0.45;
      alpha = 1 - progress * 0.5;
    } else if (trans.type === "zoom_out") {
      scaleModifier = 1 - progress * 0.45;
      alpha = 1 - progress;
    } else if (trans.type === "slide_left") {
      xOffset = -progress * w;
    } else if (trans.type === "slide_right") {
      xOffset = progress * w;
    } else if (trans.type === "push_up") {
      yOffset = -progress * h;
    } else if (trans.type === "push_down") {
      yOffset = progress * h;
    } else if (trans.type === "flash_white") {
      if (progress > 0.5) alpha = 1 - (progress - 0.5) * 2;
    } else if (trans.type === "fade_black") {
      alpha = 1 - progress;
    } else if (trans.type === "spin_cw") {
      motionRot += progress * 180;
      scaleModifier = 1 - progress * 0.4;
      alpha = 1 - progress * 0.6;
    } else if (trans.type === "spin_ccw") {
      motionRot -= progress * 180;
      scaleModifier = 1 - progress * 0.4;
      alpha = 1 - progress * 0.6;
    } else if (trans.type === "light_leak") {
      alpha = 1 - progress * 0.4;
      scaleModifier = 1 + progress * 0.2;
    } else if (trans.type === "glitch_transition") {
      if (Math.random() > 0.3) xOffset = (Math.random() - 0.5) * 60;
      alpha = 1 - progress * 0.6;
    }
  }

  const t = getInterpolatedTransform(clip, time, "video");
  const keyframeOpacity = t.opacity;

  if (clip.motionTrack && clip.motionTrack.enabled) {
    const motion = applyMotionTracking(time, clip.startTime, clip.duration, clip.motionTrack);
    xOffset += motion.dx;
    yOffset += motion.dy;
    scaleModifier *= motion.dScale;
    motionRot += motion.dRot || 0;
  }

  const clipOpacity = (t?.opacity !== undefined ? t.opacity : 1.0) * keyframeOpacity;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha * clipOpacity));

  ctx.translate(w / 2 + t.x + xOffset, h / 2 + t.y + yOffset);
  ctx.rotate((((t.rotation || 0) + motionRot) * Math.PI) / 180);

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

  const isVideoReady =
    isVideo &&
    ((mediaEl as HTMLVideoElement).readyState >= 1 || (mediaEl as HTMLVideoElement).videoWidth > 0);
  const isImageReady =
    isImage &&
    (mediaEl as HTMLImageElement).complete &&
    (mediaEl as HTMLImageElement).naturalWidth > 0;
  const isReady = isImageReady || isVideoReady;

  let activeMedia: any = isReady ? mediaEl : null;

  // Fall back to clip thumbnail whenever video element is not ready, seeking, or buffering
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

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

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
    const aspect = 16 / 9;
    let dw = w;
    let dh = w / aspect;
    const fitMode = clip.fit || "contain";
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
    drawLoadingPreview(ctx, clip, clipLocalTime, dw, dh, hasError);
  }

  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
  ctx.restore();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;

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
