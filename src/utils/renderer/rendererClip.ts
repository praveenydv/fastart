import { VideoClip } from "../../types/project";
import { getInterpolatedTransform } from "../keyframeEngine";
import {
  applyMaskPath,
  drawClipWithMask,
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

export interface TransitionRenderState {
  role: "outgoing" | "incoming";
  type: string;
  progress: number;
}

export function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip,
  time: number,
  w: number,
  h: number,
  renderCtx: ClipRenderContext,
  transitionState?: TransitionRenderState | null,
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

  // Resolve transition type and progress
  let activeTransType: string | null = null;
  let activeProgress = 0;
  let activeRole: "outgoing" | "incoming" = "outgoing";

  if (transitionState) {
    activeTransType = transitionState.type;
    activeProgress = Math.max(0, Math.min(1, transitionState.progress));
    activeRole = transitionState.role;
  } else if (trans && trans.duration > 0 && trans.type && trans.type !== "none" && timeLeft <= trans.duration) {
    activeTransType = trans.type;
    activeProgress = Math.max(0, Math.min(1, 1 - timeLeft / trans.duration));
    activeRole = "outgoing";
  }

  if (activeTransType && activeTransType !== "none" && activeTransType !== "cut") {
    const progress = activeProgress;
    if (activeRole === "outgoing") {
      if (activeTransType === "dissolve") {
        alpha = 1 - progress;
      } else if (activeTransType === "zoom_in") {
        scaleModifier = 1 + progress * 0.5;
        alpha = 1 - progress;
      } else if (activeTransType === "zoom_out") {
        scaleModifier = 1 - progress * 0.45;
        alpha = 1 - progress;
      } else if (activeTransType === "slide_left") {
        xOffset = -progress * w;
      } else if (activeTransType === "slide_right") {
        xOffset = progress * w;
      } else if (activeTransType === "push_up") {
        yOffset = -progress * h;
      } else if (activeTransType === "push_down") {
        yOffset = progress * h;
      } else if (activeTransType === "flash_white") {
        if (progress > 0.5) alpha = 0;
      } else if (activeTransType === "fade_black") {
        alpha = Math.max(0, 1 - progress * 2);
      } else if (activeTransType === "spin_cw") {
        motionRot += progress * 180;
        scaleModifier = 1 - progress * 0.4;
        alpha = 1 - progress;
      } else if (activeTransType === "spin_ccw") {
        motionRot -= progress * 180;
        scaleModifier = 1 - progress * 0.4;
        alpha = 1 - progress;
      } else if (activeTransType === "light_leak") {
        alpha = 1 - progress;
        scaleModifier = 1 + progress * 0.15;
      } else if (activeTransType === "glitch_transition") {
        if (Math.random() > 0.3) xOffset = (Math.random() - 0.5) * 60;
        alpha = 1 - progress;
      }
    } else {
      // Incoming clip transitioning IN
      if (activeTransType === "dissolve") {
        alpha = progress;
      } else if (activeTransType === "zoom_in") {
        scaleModifier = 0.8 + progress * 0.2;
        alpha = progress;
      } else if (activeTransType === "zoom_out") {
        scaleModifier = 1.3 - progress * 0.3;
        alpha = progress;
      } else if (activeTransType === "slide_left") {
        xOffset = (1 - progress) * w;
      } else if (activeTransType === "slide_right") {
        xOffset = -(1 - progress) * w;
      } else if (activeTransType === "push_up") {
        yOffset = (1 - progress) * h;
      } else if (activeTransType === "push_down") {
        yOffset = -(1 - progress) * h;
      } else if (activeTransType === "flash_white") {
        if (progress < 0.5) alpha = 0;
      } else if (activeTransType === "fade_black") {
        alpha = Math.max(0, (progress - 0.5) * 2);
      } else if (activeTransType === "spin_cw") {
        motionRot += -(1 - progress) * 180;
        scaleModifier = 0.6 + progress * 0.4;
        alpha = progress;
      } else if (activeTransType === "spin_ccw") {
        motionRot -= -(1 - progress) * 180;
        scaleModifier = 0.6 + progress * 0.4;
        alpha = progress;
      } else if (activeTransType === "light_leak") {
        alpha = progress;
      } else if (activeTransType === "glitch_transition") {
        if (Math.random() > 0.4) xOffset = (Math.random() - 0.5) * 35;
        alpha = progress;
      }
    }
  }

  // ─── CLIP ANIMATION (IN / OUT / COMBO) ───
  const anim = (clip as any).animation;
  if (anim) {
    const inPreset = anim.inPreset || (anim.type === 'in' ? anim.preset : (typeof anim.preset === 'string' && anim.preset.endsWith('_in') ? anim.preset : null));
    const inDur = Math.max(0.05, anim.inDuration || anim.duration || 0.5);

    const outPreset = anim.outPreset || (anim.type === 'out' ? anim.preset : (typeof anim.preset === 'string' && anim.preset.endsWith('_out') ? anim.preset : null));
    const outDur = Math.max(0.05, anim.outDuration || anim.duration || 0.5);

    const comboPreset = anim.comboPreset || (anim.type === 'combo' ? anim.preset : null);

    // 1. IN Animation
    if (inPreset && inPreset !== 'none' && clipLocalTime < inDur) {
      const p = Math.max(0, Math.min(1, clipLocalTime / inDur));
      const easeOutQuad = 1 - (1 - p) * (1 - p);
      const easeOutBack = 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);

      if (inPreset === 'fade_in') {
        alpha *= p;
      } else if (inPreset === 'zoom_in') {
        scaleModifier *= (0.2 + 0.8 * easeOutQuad);
        alpha *= p;
      } else if (inPreset === 'zoom_in_2') {
        scaleModifier *= Math.max(0.01, easeOutBack);
        alpha *= p;
      } else if (inPreset === 'slide_right') {
        xOffset -= (1 - easeOutQuad) * w;
      } else if (inPreset === 'slide_left') {
        xOffset += (1 - easeOutQuad) * w;
      } else if (inPreset === 'slide_up') {
        yOffset += (1 - easeOutQuad) * h;
      } else if (inPreset === 'slide_down') {
        yOffset -= (1 - easeOutQuad) * h;
      } else if (inPreset === 'spin_in') {
        motionRot += (1 - easeOutQuad) * 360;
        scaleModifier *= (0.3 + 0.7 * easeOutQuad);
        alpha *= p;
      } else if (inPreset === 'bounce_in') {
        scaleModifier *= Math.max(0.01, easeOutBack);
      } else if (inPreset === 'wipe_right') {
        xOffset -= (1 - p) * (w * 0.5);
        alpha *= p;
      } else if (inPreset === 'shake_in') {
        if (p < 0.8) xOffset += (Math.random() - 0.5) * (1 - p) * 30;
        alpha *= p;
      } else if (inPreset === 'blur_in') {
        alpha *= p;
        scaleModifier *= (0.9 + 0.1 * p);
      }
    }

    // 2. OUT Animation
    if (outPreset && outPreset !== 'none' && timeLeft < outDur) {
      const p = Math.max(0, Math.min(1, timeLeft / outDur));
      const easeInQuad = p * p;

      if (outPreset === 'fade_out') {
        alpha *= p;
      } else if (outPreset === 'zoom_out') {
        scaleModifier *= (0.3 + 0.7 * easeInQuad);
        alpha *= p;
      } else if (outPreset === 'slide_left') {
        xOffset -= (1 - easeInQuad) * w;
      } else if (outPreset === 'slide_right') {
        xOffset += (1 - easeInQuad) * w;
      } else if (outPreset === 'slide_down') {
        yOffset += (1 - easeInQuad) * h;
      } else if (outPreset === 'slide_up') {
        yOffset -= (1 - easeInQuad) * h;
      } else if (outPreset === 'spin_out') {
        motionRot -= (1 - easeInQuad) * 360;
        scaleModifier *= (0.3 + 0.7 * easeInQuad);
        alpha *= p;
      } else if (outPreset === 'shrink_out') {
        scaleModifier *= easeInQuad;
      } else if (outPreset === 'wipe_left') {
        xOffset += (1 - p) * (w * 0.5);
        alpha *= p;
      } else if (outPreset === 'shake_out') {
        if (p > 0.2) xOffset += (Math.random() - 0.5) * (1 - p) * 30;
        alpha *= p;
      } else if (outPreset === 'dissolve') {
        alpha *= p;
      }
    }

    // 3. COMBO Animation (continuous motion loop)
    if (comboPreset && comboPreset !== 'none') {
      if (comboPreset === 'pulse' || comboPreset === 'zoom_pulse') {
        scaleModifier *= (1.0 + 0.06 * Math.sin(clipLocalTime * 5));
      } else if (comboPreset === 'wobble') {
        motionRot += Math.sin(clipLocalTime * 7) * 4;
      } else if (comboPreset === 'heartbeat') {
        const beat = (clipLocalTime * 2) % 1;
        const bScale = beat < 0.2 ? Math.sin(beat * Math.PI * 5) * 0.08 : 0;
        scaleModifier *= (1.0 + bScale);
      } else if (comboPreset === 'pendulum' || comboPreset === 'swing') {
        motionRot += Math.sin(clipLocalTime * 4) * 6;
      } else if (comboPreset === 'float') {
        yOffset += Math.sin(clipLocalTime * 3) * 12;
      } else if (comboPreset === 'wave') {
        xOffset += Math.sin(clipLocalTime * 4) * 10;
        yOffset += Math.cos(clipLocalTime * 4) * 8;
      } else if (comboPreset === 'jitter') {
        xOffset += (Math.random() - 0.5) * 4;
        yOffset += (Math.random() - 0.5) * 4;
      }
    }
  }

  const t = getInterpolatedTransform(clip, time, "video");
  const keyframeOpacity = t.opacity;

  if (clip.motionTrack && clip.motionTrack.enabled && clip.motionTrack.actionType === 'camera_center') {
    const motion = applyMotionTracking(time, clip.startTime, clip.duration, clip.motionTrack);
    xOffset += (motion.dx / 100) * w;
    yOffset += (motion.dy / 100) * h;
    scaleModifier *= motion.dScale;
    motionRot += motion.dRot || 0;
  }

  const clipOpacity = (t?.opacity !== undefined ? t.opacity : 1.0) * keyframeOpacity;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha * clipOpacity));

  const rawBlend = (clip as any).blendMode || (t as any)?.blendMode || "normal";
  const blendMap: Record<string, GlobalCompositeOperation> = {
    normal: "source-over",
    screen: "screen",
    multiply: "multiply",
    overlay: "overlay",
    darken: "darken",
    lighten: "lighten",
    "color-dodge": "color-dodge",
    "color-burn": "color-burn",
    "soft-light": "soft-light",
    difference: "difference",
    exclusion: "exclusion",
  };
  ctx.globalCompositeOperation = blendMap[rawBlend] || "source-over";

  ctx.translate(w / 2 + t.x + xOffset, h / 2 + t.y + yOffset);
  ctx.rotate((((t.rotation || 0) + motionRot) * Math.PI) / 180);

  const stretchX = t.scaleX !== undefined ? t.scaleX : 1.0;
  const stretchY = t.scaleY !== undefined ? t.scaleY : 1.0;
  const scaleX = (t.flipX ? -1 : 1) * (t.scale || 1) * stretchX * scaleModifier;
  const scaleY = (t.flipY ? -1 : 1) * (t.scale || 1) * stretchY * scaleModifier;

  const rotX = t.rotateX || 0;
  const rotY = t.rotateY || 0;
  const skewX = t.skewX || 0;
  const skewY = t.skewY || 0;

  if (rotX !== 0 || rotY !== 0 || skewX !== 0 || skewY !== 0) {
    const radRotX = (rotX * Math.PI) / 180;
    const radRotY = (rotY * Math.PI) / 180;
    const radSkewX = (skewX * Math.PI) / 180;
    const radSkewY = (skewY * Math.PI) / 180;
    const cosX = Math.max(0.05, Math.cos(radRotX));
    const cosY = Math.max(0.05, Math.cos(radRotY));
    ctx.scale(cosY, cosX);
    if (skewX !== 0 || skewY !== 0) {
      ctx.transform(1, Math.tan(radSkewY), Math.tan(radSkewX), 1, 0, 0);
    }
  }

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
    const rawCutout = clip.cutout || clip.transform?.cutout;
    const cutout = rawCutout
      ? {
          ...rawCutout,
          clipId: clip.id,
          clipTime: Math.max(0, time - clip.startTime),
        }
      : rawCutout;

    if (mask && mask.shape && mask.shape !== "none") {
      drawClipWithMask(
        ctx,
        activeMedia as any,
        sx,
        sy,
        sw,
        sh,
        dw,
        dh,
        mask,
        cutout,
        clip,
        renderCtx,
      );
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (cutout && cutout.enabled) {
        drawClipWithCutout(
          ctx,
          activeMedia as any,
          sx,
          sy,
          sw,
          sh,
          -dw / 2,
          -dh / 2,
          dw,
          dh,
          cutout,
          renderCtx.offscreenCanvas,
          renderCtx.offscreenCtx,
        );
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

  const rawEff = (clip as any).effect;
  const effType = typeof rawEff === "string" ? rawEff : (rawEff?.type || rawEff?.id);
  if (effType && effType !== "none" && effType !== "None") {
    applyEffectOverlay(
      ctx,
      {
        id: "clip-eff-" + clip.id,
        type: effType,
        name: typeof rawEff === "object" && rawEff?.name ? rawEff.name : effType,
        startTime: clip.startTime,
        duration: clip.duration,
        intensity: (clip as any).effectIntensity !== undefined ? (clip as any).effectIntensity : 0.8,
      },
      time,
      w,
      h,
      renderCtx.canvas,
      renderCtx.ensureOffscreen,
    );
  }

  if (activeTransType === "flash_white") {
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(activeProgress * Math.PI) * 0.95})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else if (activeTransType === "light_leak") {
    ctx.save();
    const leakGrad = ctx.createLinearGradient(0, 0, w, h);
    const leakIntensity = Math.sin(activeProgress * Math.PI) * 0.85;
    leakGrad.addColorStop(0, `rgba(255, 120, 0, ${leakIntensity * 0.6})`);
    leakGrad.addColorStop(0.5, `rgba(255, 240, 180, ${leakIntensity * 0.9})`);
    leakGrad.addColorStop(1, `rgba(255, 0, 120, ${leakIntensity * 0.5})`);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = leakGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
