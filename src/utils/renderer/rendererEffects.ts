import { VideoClip, EffectClip } from "../../types/project";
import { LowLevelPixelEngine } from "../lowLevelEngine";

export function evaluateSpeedCurve(curve: any[], progress: number): number {
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

export function applyMotionTracking(
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

export function applyMaskPath(
  ctx: CanvasRenderingContext2D,
  mask: any,
  dw: number,
  dh: number,
) {
  if (!mask || !mask.shape || mask.shape === "none") return;

  const size = Math.max(1, mask.size ?? 50);
  const offsetX = (mask.x || 0) * (dw / 100);
  const offsetY = (mask.y || 0) * (dh / 100);
  const rot = ((mask.rotation || 0) * Math.PI) / 180;

  // Translate and rotate into mask coordinate system
  ctx.translate(offsetX, offsetY);
  ctx.rotate(rot);

  ctx.beginPath();
  if (mask.inverted) {
    // Large outer rectangle for evenodd inverted cutout
    const outerExtent = Math.max(dw, dh) * 4;
    ctx.rect(-outerExtent, -outerExtent, outerExtent * 2, outerExtent * 2);
  }

  if (mask.shape === "circle") {
    const radius = Math.max(1, (Math.min(dw, dh) * size) / 200);
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  } else if (mask.shape === "rectangle") {
    const rw = (dw * size) / 100;
    const rh = (dh * size) / 100;
    const maxRad = Math.min(rw, rh) / 2;
    const rad = Math.max(0, Math.min(mask.roundness ?? 16, maxRad));
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(-rw / 2, -rh / 2, rw, rh, rad);
    } else {
      ctx.rect(-rw / 2, -rh / 2, rw, rh);
    }
  } else if (mask.shape === "linear") {
    // Sweep split line across the frame based on size (50% is center)
    const splitY = ((50 - size) / 100) * dh;
    const outerExtent = Math.max(dw, dh) * 4;
    ctx.rect(-outerExtent, splitY, outerExtent * 2, outerExtent * 2);
  } else if (mask.shape === "mirror") {
    // Central horizontal slot/band of height bandH
    const bandH = Math.max(2, (dh * size) / 100);
    const outerExtent = Math.max(dw, dh) * 4;
    ctx.rect(-outerExtent, -bandH / 2, outerExtent * 2, bandH);
  } else if (mask.shape === "heart") {
    const s = Math.max(2, (Math.min(dw, dh) * size) / 100);
    ctx.moveTo(0, s * 0.28);
    ctx.bezierCurveTo(-s * 0.5, -s * 0.35, -s * 0.85, s * 0.15, 0, s * 0.85);
    ctx.bezierCurveTo(s * 0.85, s * 0.15, s * 0.5, -s * 0.35, 0, s * 0.28);
  } else if (mask.shape === "star") {
    const outerR = Math.max(2, (Math.min(dw, dh) * size) / 200);
    const innerR = outerR * 0.42;
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

  // Clip the canvas using the mask path
  ctx.clip(mask.inverted ? "evenodd" : "nonzero");

  // Revert mask coordinate system back so drawImage has (0, 0) at clip center!
  // Note: We deliberately do NOT call ctx.restore() here, because ctx.restore() would destroy the clipping region.
  // The outer drawClip wrapper already calls ctx.restore() when finished with this clip.
  ctx.rotate(-rot);
  ctx.translate(-offsetX, -offsetY);
}

export function drawLoadingPreview(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip,
  localTime: number,
  w: number,
  h: number,
  hasError: boolean,
) {
  const dw = w;
  const dh = h;
  const left = -dw / 2;
  const top = -dh / 2;

  ctx.save();
  const grad = ctx.createLinearGradient(left, top, left, top + dh);
  grad.addColorStop(0, "#161924");
  grad.addColorStop(1, "#0A0C11");
  ctx.fillStyle = grad;
  ctx.fillRect(left, top, dw, dh);

  ctx.strokeStyle = hasError ? "rgba(0, 242, 254, 0.4)" : "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left + 1, top + 1, dw - 2, dh - 2);

  if (hasError) {
    const boxSize = Math.min(54, Math.min(dw, dh) * 0.3);
    ctx.fillStyle = "rgba(0, 242, 254, 0.14)";
    ctx.beginPath();
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(-boxSize / 2, -boxSize / 2 - 30, boxSize, boxSize, 12);
    } else {
      ctx.rect(-boxSize / 2, -boxSize / 2 - 30, boxSize, boxSize);
    }
    ctx.fill();

    ctx.fillStyle = "#00F2FE";
    ctx.beginPath();
    ctx.arc(0, -30, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    const cleanTitle = clip.title ? (clip.title.length > 22 ? clip.title.slice(0, 20) + "…" : clip.title) : "Video Clip";
    ctx.fillText(cleanTitle, 0, 10);

    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = "#00F2FE";
    ctx.fillText(`${localTime.toFixed(1)}s / ${clip.duration.toFixed(1)}s`, 0, 28);

    const barCount = 10;
    const totalBarW = 80;
    const barW = 4;
    const barGap = (totalBarW - barCount * barW) / (barCount - 1);
    ctx.fillStyle = "#00F2FE";
    for (let i = 0; i < barCount; i++) {
      const hFactor = 0.25 + 0.75 * Math.abs(Math.sin(localTime * 7 + i * 0.7));
      const barH = 16 * hFactor;
      const bx = -totalBarW / 2 + i * (barW + barGap);
      ctx.fillRect(bx, 48 - barH / 2, barW, barH);
    }

    const pct = Math.max(0, Math.min(1, localTime / Math.max(0.1, clip.duration)));
    ctx.fillStyle = "rgba(0, 242, 254, 0.2)";
    ctx.fillRect(left, top + dh - 4, dw, 4);
    ctx.fillStyle = "#00F2FE";
    ctx.fillRect(left, top + dh - 4, dw * pct, 4);
  } else {
    const angle = (localTime * 5) % (Math.PI * 2);
    ctx.strokeStyle = "#00F2FE";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, -10, 20, angle, angle + Math.PI * 1.3);
    ctx.stroke();

    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = "#8E95A5";
    ctx.textAlign = "center";
    ctx.fillText("Buffering...", 0, 28);
  }

  ctx.restore();
}

export function applyColorFilter(ctx: CanvasRenderingContext2D, filterId?: string, customLut?: any) {
  if (customLut && customLut.cssFilter) {
    ctx.filter = customLut.cssFilter;
    return;
  }

  if (!filterId || filterId === "none" || filterId === "normal") {
    ctx.filter = "none";
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

export function drawClipWithCutout(
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
  offCanvas: HTMLCanvasElement | null,
  offCtx: CanvasRenderingContext2D | null,
) {
  if (typeof document === "undefined" || !offCanvas || !offCtx) {
    ctx.drawImage(mediaEl, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }

  LowLevelPixelEngine.processCutout(
    ctx,
    mediaEl as any,
    sx,
    sy,
    sw,
    sh,
    dx,
    dy,
    dw,
    dh,
    cutout,
    offCanvas,
    offCtx
  );
}

export function applyEffectOverlay(
  ctx: CanvasRenderingContext2D,
  eff: EffectClip,
  time: number,
  w: number,
  h: number,
  canvas: HTMLCanvasElement | null,
  ensureOffscreen: (cw: number, ch: number) => HTMLCanvasElement | null,
) {
  if (!canvas) return;
  ctx.save();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  const intensity = eff.intensity !== undefined ? eff.intensity : 0.8;
  const cw = canvas.width;
  const ch = canvas.height;
  const sourceCanvas =
    eff.type === "glitch" || eff.type === "mirror" || eff.type === "shake" || eff.type === "blur" || eff.type === "blur_cinematic"
      ? ensureOffscreen(cw, ch) || canvas
      : canvas;

  if (eff.type === "glitch") {
    const sliceH = Math.max(12, h * 0.035);
    for (let y = 0; y < h; y += sliceH * 1.5) {
      if (Math.random() > 0.35) {
        const shift = (Math.random() - 0.5) * (w * 0.12) * intensity;
        const sy = (y / h) * ch;
        const sh = (sliceH / h) * ch;
        ctx.drawImage(sourceCanvas, 0, sy, cw, sh, shift, y, w, sliceH);
      }
    }
  } else if (eff.type === "vhs") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 2);
    }
    const barY = (time * 260) % h;
    ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
    ctx.fillRect(0, barY, w, 14);
    ctx.font = "bold 16px Courier, monospace";
    ctx.fillStyle = "#00FF66";
    const secs = Math.floor(time).toString().padStart(2, "0");
    const frames = Math.floor((time % 1) * 30).toString().padStart(2, "0");
    ctx.fillText(`PLAY ▶ SP 00:${secs}:${frames}`, 24, h - 32);
  } else if (eff.type === "rgb_split") {
    ctx.globalCompositeOperation = "screen";
    const offset = Math.max(4, w * 0.015) * intensity;
    ctx.fillStyle = "rgba(0, 242, 254, 0.28)";
    ctx.fillRect(offset, 0, w, h);
    ctx.fillStyle = "rgba(255, 0, 80, 0.28)";
    ctx.fillRect(-offset, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else if (eff.type === "film_grain") {
    const numDots = Math.floor(300 * intensity);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    for (let i = 0; i < numDots; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      ctx.fillRect(rx, ry, 2, 2);
    }
  } else if (eff.type === "zoom_pulse") {
    const pulseScale = 1.0 + Math.sin(time * 8) * 0.06 * intensity;
    ctx.translate(w / 2, h / 2);
    ctx.scale(pulseScale, pulseScale);
    ctx.translate(-w / 2, -h / 2);
  } else if (eff.type === "neon_edge") {
    ctx.strokeStyle = "rgba(0, 242, 254, 0.7)";
    ctx.lineWidth = Math.max(4, w * 0.015) * intensity;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.strokeStyle = "rgba(255, 0, 80, 0.5)";
    ctx.lineWidth = Math.max(2, w * 0.008) * intensity;
    ctx.strokeRect(10, 10, w - 20, h - 20);
  } else if (eff.type === "blur" || eff.type === "blur_cinematic") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      ctx.filter = `blur(${Math.max(1, Math.round(intensity * 5))}px)`;
      ctx.globalAlpha = Math.min(0.6, intensity * 0.6);
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, 0, 0, w, h);
      ctx.restore();
    }
  } else if (eff.type === "flash") {
    const flashVal = Math.sin(time * 12);
    if (flashVal > 0.6) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(flashVal - 0.6) * 2.5 * intensity})`;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (eff.type === "vignette") {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, Math.max(w, h) * 0.65);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${0.85 * intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  } else if (eff.type === "mirror") {
    ctx.drawImage(sourceCanvas, 0, 0, cw / 2, ch, w / 2, 0, w / 2, h);
  } else if (eff.type === "shake") {
    const sx = (Math.random() - 0.5) * (w * 0.035) * intensity;
    const sy = (Math.random() - 0.5) * (h * 0.035) * intensity;
    ctx.drawImage(sourceCanvas, 0, 0, cw, ch, sx, sy, w, h);
  } else if (eff.type === "rainbow_flow") {
    const hue = Math.floor((time * 120) % 360);
    ctx.fillStyle = `hsla(${hue}, 90%, 50%, 0.15)`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
  ctx.restore();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
}
