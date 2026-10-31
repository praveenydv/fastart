import { VideoClip, EffectClip, HSLAdjustments } from "../../types/project";
import { rustCoreBridge } from "../../services/rustCoreBridge";
import { buildHslCssFilter } from "../hslEngine";

export function evaluateSpeedCurve(curveInput: any, progress: number): number {
  if (!curveInput) return 1.0;
  const curve = Array.isArray(curveInput)
    ? curveInput
    : Array.isArray(curveInput?.points)
      ? curveInput.points
      : null;
  if (!curve || curve.length === 0) return 1.0;
  const clampedP = Math.max(0, Math.min(1, progress));

  // Array of SpeedCurvePoint objects: [{ t, s }]
  if (typeof curve[0] === "object" && "t" in curve[0]) {
    return rustCoreBridge.evaluateSpeedCurve(curve, clampedP);
  }

  // Array of speed multiplier numbers: [s0, s1, ...] -> evaluate in native Rust
  const numPoints = curve.length;
  const points = curve.map((s: number, i: number) => ({
    t: i / Math.max(1, numPoints - 1),
    s: Number(s) || 1.0,
  }));
  return rustCoreBridge.evaluateSpeedCurve(points, clampedP);
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
  if (motionTrack.trajectory && Array.isArray(motionTrack.trajectory) && motionTrack.trajectory.length > 0) {
    return rustCoreBridge.evaluateObjectTrackTrajectory(
      time,
      motionTrack.trajectory,
      motionTrack.trackScale !== false,
      motionTrack.trackRotation === true,
      motionTrack.actionType === 'camera_center'
    );
  }
  return rustCoreBridge.evaluateMotionTrack(
    time,
    clipStartTime,
    clipDuration,
    motionTrack.mode || "follow_center",
    motionTrack.intensity ?? 60,
  );
}

let maskClipCanvas: HTMLCanvasElement | null = null;
let maskClipCtx: CanvasRenderingContext2D | null = null;
let maskShapeCanvas: HTMLCanvasElement | null = null;
let maskShapeCtx: CanvasRenderingContext2D | null = null;

export function buildMaskPath(
  ctx: CanvasRenderingContext2D,
  shape: string,
  size: number,
  dw: number,
  dh: number,
  roundness?: number,
  width?: number,
  height?: number,
) {
  const effW = width !== undefined ? width : size;
  const effH = height !== undefined ? height : size;
  const minDim = Math.min(dw, dh);

  if (shape === "circle") {
    // Isotropic circular radii based on minDim so circle is round and matches preview overlay
    const rx = Math.max(1, (minDim * effW) / 200);
    const ry = Math.max(1, (minDim * effH) / 200);
    if ((ctx as any).ellipse) {
      (ctx as any).ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.save();
      ctx.scale(rx, ry);
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
    }
  } else if (shape === "rectangle") {
    const rw = (dw * effW) / 100;
    const rh = (dh * effH) / 100;
    const maxRad = Math.min(rw, rh) / 2;
    const rad = Math.max(0, Math.min(roundness ?? 16, maxRad));
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(-rw / 2, -rh / 2, rw, rh, rad);
    } else {
      ctx.rect(-rw / 2, -rh / 2, rw, rh);
    }
  } else if (shape === "linear") {
    // Split line passes right through origin (0, 0), extending downwards in local coords
    const outerExtent = Math.max(dw, dh) * 4;
    ctx.rect(-outerExtent, 0, outerExtent * 2, outerExtent * 2);
  } else if (shape === "mirror") {
    // Central horizontal slot/band of height bandH
    const bandH = Math.max(2, (dh * effH) / 100);
    const outerExtent = Math.max(dw, dh) * 4;
    ctx.rect(-outerExtent, -bandH / 2, outerExtent * 2, bandH);
  } else if (shape === "heart") {
    const hw = Math.max(1, (minDim * effW) / 100);
    const hh = Math.max(1, (minDim * effH) / 100);
    ctx.save();
    ctx.scale(hw / 100, hh / 100);
    // Exact mathematical match with SVG heart path centered at (0, 0)
    ctx.moveTo(0, 44);
    ctx.bezierCurveTo(-28, 18, -50, 0, -50, -20);
    ctx.arc(-25, -20, 25, Math.PI, 0, false);
    ctx.arc(25, -20, 25, Math.PI, 0, false);
    ctx.bezierCurveTo(50, 0, 28, 18, 0, 44);
    ctx.closePath();
    ctx.restore();
  } else if (shape === "star") {
    const scaleX = Math.max(0.01, (minDim * effW) / 200);
    const scaleY = Math.max(0.01, (minDim * effH) / 200);
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const radiusFactor = i % 2 === 0 ? 1.0 : 0.42;
      const a = (i * Math.PI) / points - Math.PI / 2;
      const x = scaleX * radiusFactor * Math.cos(a);
      const y = scaleY * radiusFactor * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}

export function drawClipWithMask(
  ctx: CanvasRenderingContext2D,
  activeMedia: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  mask: any,
  cutout: any,
  clip: VideoClip,
  renderCtx: {
    offscreenCanvas: HTMLCanvasElement | null;
    offscreenCtx: CanvasRenderingContext2D | null;
  },
) {
  if (typeof document === "undefined") {
    ctx.drawImage(activeMedia, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    return;
  }

  const canvasW = Math.max(1, Math.ceil(dw));
  const canvasH = Math.max(1, Math.ceil(dh));

  if (!maskClipCanvas) {
    maskClipCanvas = document.createElement("canvas");
    maskClipCtx = maskClipCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!maskClipCanvas || !maskClipCtx) {
    ctx.drawImage(activeMedia, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    return;
  }

  if (maskClipCanvas.width !== canvasW || maskClipCanvas.height !== canvasH) {
    maskClipCanvas.width = canvasW;
    maskClipCanvas.height = canvasH;
  }

  // 1. Draw media onto isolated maskClipCanvas
  maskClipCtx.save();
  maskClipCtx.clearRect(0, 0, canvasW, canvasH);
  maskClipCtx.imageSmoothingEnabled = true;
  maskClipCtx.imageSmoothingQuality = "high";
  maskClipCtx.filter = "none";
  maskClipCtx.globalCompositeOperation = "source-over";

  if (cutout && cutout.enabled) {
    drawClipWithCutout(
      maskClipCtx,
      activeMedia,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      dw,
      dh,
      cutout,
      renderCtx.offscreenCanvas,
      renderCtx.offscreenCtx,
    );
  } else {
    maskClipCtx.drawImage(activeMedia, sx, sy, sw, sh, 0, 0, dw, dh);
  }

  if (
    !cutout?.enabled &&
    (clip.smoothSlowMo === "blend" || clip.smoothSlowMo === "optical_flow") &&
    (clip.speed || 1.0) < 1.0
  ) {
    maskClipCtx.save();
    maskClipCtx.globalAlpha = clip.smoothSlowMo === "optical_flow" ? 0.35 : 0.22;
    maskClipCtx.drawImage(activeMedia, sx, sy, sw, sh, 1, 0, dw, dh);
    maskClipCtx.restore();
  }

  // 2. Prepare maskShapeCanvas
  if (!maskShapeCanvas) {
    maskShapeCanvas = document.createElement("canvas");
    maskShapeCtx = maskShapeCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!maskShapeCanvas || !maskShapeCtx) {
    ctx.drawImage(maskClipCanvas, -dw / 2, -dh / 2, dw, dh);
    maskClipCtx.restore();
    return;
  }

  const rawFeather = Math.max(0, Math.min(80, mask.feather ?? 0));
  const minDim = Math.min(dw, dh);
  const featherPx = rawFeather > 0 ? Math.max(1, (minDim * (rawFeather / 100)) * 0.38) : 0;
  const pad = featherPx > 0 ? Math.ceil(featherPx * 2.5 + 8) : 0;
  const shapeCanvasW = canvasW + pad * 2;
  const shapeCanvasH = canvasH + pad * 2;

  if (maskShapeCanvas.width !== shapeCanvasW || maskShapeCanvas.height !== shapeCanvasH) {
    maskShapeCanvas.width = shapeCanvasW;
    maskShapeCanvas.height = shapeCanvasH;
  }

  maskShapeCtx.save();
  maskShapeCtx.clearRect(0, 0, shapeCanvasW, shapeCanvasH);
  maskShapeCtx.imageSmoothingEnabled = true;
  maskShapeCtx.imageSmoothingQuality = "high";
  maskShapeCtx.globalCompositeOperation = "source-over";

  const offsetX = (mask.x || 0) * (dw / 100);
  const offsetY = (mask.y || 0) * (dh / 100);
  const rot = ((mask.rotation || 0) * Math.PI) / 180;
  const size = Math.max(1, mask.size ?? 50);

  maskShapeCtx.translate(dw / 2 + pad + offsetX, dh / 2 + pad + offsetY);
  maskShapeCtx.rotate(rot);

  if (featherPx > 0) {
    maskShapeCtx.filter = `blur(${featherPx.toFixed(1)}px)`;
  } else {
    maskShapeCtx.filter = "none";
  }

  maskShapeCtx.beginPath();
  if (mask.inverted) {
    const outerExtent = Math.max(shapeCanvasW, shapeCanvasH) * 3;
    maskShapeCtx.rect(-outerExtent, -outerExtent, outerExtent * 2, outerExtent * 2);
  }

  buildMaskPath(maskShapeCtx, mask.shape, size, dw, dh, mask.roundness, mask.width, mask.height);

  maskShapeCtx.fillStyle = "#ffffff";
  maskShapeCtx.fill(mask.inverted ? "evenodd" : "nonzero");
  maskShapeCtx.restore();
  maskShapeCtx.filter = "none";

  // 3. Composite mask onto maskClipCanvas with destination-in
  maskClipCtx.globalCompositeOperation = "destination-in";
  if (pad > 0) {
    maskClipCtx.drawImage(maskShapeCanvas, pad, pad, dw, dh, 0, 0, dw, dh);
  } else {
    maskClipCtx.drawImage(maskShapeCanvas, 0, 0);
  }
  maskClipCtx.restore();

  // 4. Draw final masked clip to target context
  ctx.drawImage(maskClipCanvas, -dw / 2, -dh / 2, dw, dh);
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
    const outerExtent = Math.max(dw, dh) * 4;
    ctx.rect(-outerExtent, -outerExtent, outerExtent * 2, outerExtent * 2);
  }

  buildMaskPath(ctx, mask.shape, size, dw, dh, mask.roundness, mask.width, mask.height);

  // Clip the canvas using the mask path
  ctx.clip(mask.inverted ? "evenodd" : "nonzero");

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
    const nowSec = typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;
    const angle = (nowSec * 4.5) % (Math.PI * 2);
    ctx.strokeStyle = "#00F2FE";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, -14, 22, angle, angle + Math.PI * 1.35);
    ctx.stroke();

    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText("Processing Video Edit...", 0, 26);

    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = "#00F2FE";
    ctx.fillText("Applying changes & syncing frames", 0, 44);
  }

  ctx.restore();
}

export function applyColorFilter(
  ctx: CanvasRenderingContext2D,
  filterId?: string,
  customLut?: any,
  hslAdjustments?: HSLAdjustments
) {
  let baseFilter = "none";
  if (customLut && customLut.cssFilter) {
    baseFilter = customLut.cssFilter;
  } else if (filterId && filterId !== "none" && filterId !== "normal") {
    if (filterId === "teal_orange") {
      baseFilter = "contrast(1.25) saturate(1.35) hue-rotate(15deg)";
    } else if (filterId === "vintage") {
      baseFilter = "sepia(0.35) contrast(0.95) brightness(1.08)";
    } else if (filterId === "cyberpunk") {
      baseFilter = "hue-rotate(290deg) contrast(1.4) saturate(1.85)";
    } else if (filterId === "noir") {
      baseFilter = "grayscale(1) contrast(1.45) brightness(0.92)";
    } else if (filterId === "warm_sunset") {
      baseFilter = "sepia(0.22) saturate(1.45) brightness(1.08)";
    } else if (filterId === "cold_moody") {
      baseFilter = "hue-rotate(185deg) saturate(0.85) contrast(1.2)";
    } else if (filterId === "emerald") {
      baseFilter = "hue-rotate(95deg) saturate(1.25) contrast(1.12)";
    } else if (filterId === "vhs_retro") {
      baseFilter = "contrast(1.3) saturate(1.6) brightness(1.05)";
    } else if (filterId === "pastel_dream") {
      baseFilter = "brightness(1.15) saturate(1.2) contrast(0.9)";
    } else if (filterId === "cinematic_warm") {
      baseFilter = "sepia(0.3) saturate(1.35) contrast(1.15)";
    } else if (filterId === "matrix_code") {
      baseFilter = "hue-rotate(80deg) saturate(1.8) contrast(1.3)";
    } else if (filterId === "sepia_antique") {
      baseFilter = "sepia(0.85) contrast(1.1) brightness(0.95)";
    } else if (filterId === "high_contrast") {
      baseFilter = "contrast(1.5) saturate(1.3) brightness(1.02)";
    } else if (filterId === "polaroid_fade") {
      baseFilter = "contrast(0.9) saturate(0.8) brightness(1.12) sepia(0.15)";
    } else if (filterId === "solar_pop") {
      baseFilter = "saturate(2.0) contrast(1.2)";
    }
  }

  const hslFilter = buildHslCssFilter(hslAdjustments);

  if (baseFilter !== "none" && hslFilter) {
    ctx.filter = `${baseFilter} ${hslFilter}`;
  } else if (baseFilter !== "none") {
    ctx.filter = baseFilter;
  } else if (hslFilter) {
    ctx.filter = hslFilter;
  } else {
    ctx.filter = "none";
  }
}

let fallbackCutoutCanvas: HTMLCanvasElement | null = null;
let fallbackCutoutCtx: CanvasRenderingContext2D | null = null;

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
  if (typeof document === "undefined") {
    return;
  }

  let activeCanvas = offCanvas;
  let activeCtx = offCtx;

  if (!activeCanvas || !activeCtx) {
    if (!fallbackCutoutCanvas) {
      fallbackCutoutCanvas = document.createElement("canvas");
      fallbackCutoutCtx = fallbackCutoutCanvas.getContext("2d", { willReadFrequently: true });
    }
    activeCanvas = fallbackCutoutCanvas;
    activeCtx = fallbackCutoutCtx;
  }

  if (!activeCanvas || !activeCtx) {
    ctx.drawImage(mediaEl, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const success = rustCoreBridge.renderCutout(
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
    activeCanvas,
    activeCtx
  );

  if (!success) {
    ctx.drawImage(mediaEl, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
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
  if (!canvas || !eff || !eff.type || eff.type === "none" || eff.type === "None") return;
  ctx.save();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  const intensity = eff.intensity !== undefined ? eff.intensity : 0.8;
  const cw = canvas.width;
  const ch = canvas.height;
  const needsOffscreenSnapshot =
    eff.type === "glitch" ||
    eff.type === "mirror" ||
    eff.type === "shake" ||
    eff.type === "blur" ||
    eff.type === "blur_cinematic" ||
    eff.type === "gaussian_blur" ||
    eff.type === "motion_blur" ||
    eff.type === "radial_blur" ||
    eff.type === "mosaic_blur" ||
    eff.type === "water_ripple" ||
    eff.type === "tilt_shift" ||
    eff.type === "kaleidoscope" ||
    eff.type === "beauty_smooth" ||
    eff.type === "zoom_pulse" ||
    eff.type === "fisheye";

  const sourceCanvas = needsOffscreenSnapshot
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
    if (sourceCanvas && sourceCanvas !== canvas) {
      const pulseScale = 1.0 + Math.sin(time * 8) * 0.08 * intensity;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(pulseScale, pulseScale);
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
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
      ctx.filter = `blur(${Math.max(1, Math.round(intensity * 6))}px)`;
      ctx.globalAlpha = Math.min(0.65, intensity * 0.65);
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
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sourceCanvas, 0, 0, cw / 2, ch, 0, 0, w / 2, h);
      ctx.restore();
    }
  } else if (eff.type === "shake") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      const sx = (Math.random() - 0.5) * (w * 0.04) * intensity;
      const sy = (Math.random() - 0.5) * (h * 0.04) * intensity;
      ctx.save();
      const sc = 1.0 + 0.04 * intensity;
      ctx.translate(w / 2 + sx, h / 2 + sy);
      ctx.scale(sc, sc);
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  } else if (eff.type === "rainbow_flow") {
    const hue = Math.floor((time * 120) % 360);
    ctx.fillStyle = `hsla(${hue}, 90%, 50%, 0.15)`;
    ctx.fillRect(0, 0, w, h);
  } else if (eff.type === "old_film") {
    // 1920s Silent Film grain, scratches & flicker
    ctx.fillStyle = `rgba(255, 240, 200, ${0.12 * intensity})`;
    ctx.fillRect(0, 0, w, h);
    if (Math.random() > 0.4) {
      const scratchX = Math.random() * w;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * intensity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scratchX, 0);
      ctx.lineTo(scratchX + (Math.random() - 0.5) * 4, h);
      ctx.stroke();
    }
  } else if (eff.type === "crt_tv") {
    // CRT phosphor scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1.2);
    }
  } else if (eff.type === "prism_leak") {
    // Anamorphic rainbow light leak
    const leakGrad = ctx.createLinearGradient(0, 0, w, h);
    leakGrad.addColorStop(0, `rgba(255, 0, 80, ${0.28 * intensity})`);
    leakGrad.addColorStop(0.5, `rgba(0, 242, 254, ${0.2 * intensity})`);
    leakGrad.addColorStop(1, `rgba(255, 230, 0, ${0.25 * intensity})`);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = leakGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else if (eff.type === "sun_flare") {
    // Solar lens flare halo
    const flareGrad = ctx.createRadialGradient(w * 0.8, h * 0.2, 10, w * 0.8, h * 0.2, Math.max(w, h) * 0.6);
    flareGrad.addColorStop(0, `rgba(255, 240, 180, ${0.65 * intensity})`);
    flareGrad.addColorStop(0.3, `rgba(255, 120, 0, ${0.35 * intensity})`);
    flareGrad.addColorStop(1, "rgba(255, 120, 0, 0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = flareGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else if (eff.type === "cyberpunk_dual") {
    ctx.globalCompositeOperation = "color";
    const cpGrad = ctx.createLinearGradient(0, 0, w, 0);
    cpGrad.addColorStop(0, `rgba(0, 242, 254, ${0.4 * intensity})`);
    cpGrad.addColorStop(1, `rgba(255, 0, 128, ${0.4 * intensity})`);
    ctx.fillStyle = cpGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else if (eff.type === "water_ripple") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      const waveSliceH = Math.max(8, h * 0.02);
      for (let y = 0; y < h; y += waveSliceH) {
        const waveShift = Math.sin((y / h) * 12 + time * 6) * (w * 0.025) * intensity;
        const sy = (y / h) * ch;
        const sh = (waveSliceH / h) * ch;
        ctx.drawImage(sourceCanvas, 0, sy, cw, sh, waveShift, y, w, waveSliceH);
      }
    }
  } else if (eff.type === "fisheye") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      const scaleFactor = 1.0 + 0.22 * intensity;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleFactor, scaleFactor);
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, -w / 2, -h / 2, w, h);
      ctx.restore();
      const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.55);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${0.6 * intensity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (eff.type === "thermal") {
    ctx.save();
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = `rgba(0, 255, 255, ${0.75 * intensity})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "color-dodge";
    ctx.fillStyle = `rgba(255, 60, 0, ${0.45 * intensity})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else if (eff.type === "tilt_shift") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      ctx.filter = `blur(${Math.max(2, Math.round(intensity * 6))}px)`;
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch * 0.25, 0, 0, w, h * 0.25);
      ctx.drawImage(sourceCanvas, 0, ch * 0.75, cw, ch * 0.25, 0, h * 0.75, w, h * 0.25);
      ctx.restore();
    }
  } else if (eff.type === "gaussian_blur" || eff.type === "blur" || eff.type === "blur_cinematic") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      const blurPx = Math.max(2, Math.round(intensity * 24));
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, 0, 0, w, h);
      ctx.restore();
    }
  } else if (eff.type === "motion_blur") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      const passCount = 4;
      const maxOffset = Math.max(4, Math.round(intensity * 22));
      ctx.globalAlpha = 1.0 / passCount;
      for (let i = -passCount / 2; i <= passCount / 2; i++) {
        ctx.drawImage(sourceCanvas, 0, 0, cw, ch, i * (maxOffset / passCount), 0, w, h);
      }
      ctx.restore();
    }
  } else if (eff.type === "radial_blur") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      const passes = 4;
      ctx.globalAlpha = 1.0 / passes;
      for (let p = 0; p < passes; p++) {
        const scale = 1.0 + p * 0.04 * intensity;
        ctx.drawImage(sourceCanvas, 0, 0, cw, ch, (w * (1 - scale)) / 2, (h * (1 - scale)) / 2, w * scale, h * scale);
      }
      ctx.restore();
    }
  } else if (eff.type === "mosaic_blur") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      const blockSize = Math.max(4, Math.round(intensity * 24));
      const smallW = Math.max(4, Math.floor(w / blockSize));
      const smallH = Math.max(4, Math.floor(h / blockSize));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, 0, 0, smallW, smallH);
      ctx.drawImage(canvas, 0, 0, smallW, smallH, 0, 0, w, h);
      ctx.restore();
    }
  } else if (eff.type === "kaleidoscope") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      const hw = w / 2;
      const hh = h / 2;
      const chw = cw / 2;
      const chh = ch / 2;
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sourceCanvas, 0, 0, chw, chh, 0, 0, hw, hh);
      ctx.restore();
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(sourceCanvas, 0, 0, chw, chh, 0, 0, hw, hh);
      ctx.restore();
      ctx.save();
      ctx.translate(w, h);
      ctx.scale(-1, -1);
      ctx.drawImage(sourceCanvas, 0, 0, chw, chh, 0, 0, hw, hh);
      ctx.restore();
    }
  } else if (eff.type === "beauty_smooth") {
    // 2-pass bilateral skin smoothing emulation: soft bloom + contrast preserve
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.filter = `blur(${Math.max(2, Math.round(intensity * 5))}px) brightness(${1.05 + 0.1 * intensity})`;
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, 0, 0, w, h);
      ctx.restore();
      ctx.fillStyle = `rgba(255, 245, 235, ${0.08 * intensity})`;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (eff.type === "ai_cyberpunk") {
    ctx.globalCompositeOperation = "color";
    const cpGrad = ctx.createLinearGradient(0, 0, w, 0);
    cpGrad.addColorStop(0, `rgba(0, 242, 254, ${0.35 * intensity})`);
    cpGrad.addColorStop(1, `rgba(255, 0, 128, ${0.35 * intensity})`);
    ctx.fillStyle = cpGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else if (eff.type === "ai_manga") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      ctx.filter = `grayscale(1) contrast(${1.5 + 0.5 * intensity})`;
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, 0, 0, w, h);
      ctx.restore();
      const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.65);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${0.75 * intensity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (eff.type === "ai_matrix") {
    ctx.fillStyle = `rgba(0, 255, 100, ${0.12 * intensity})`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(0, 255, 120, ${0.3 * intensity})`;
    const barY = (time * 240) % h;
    ctx.fillRect(0, barY, w, 16);
    ctx.font = "bold 14px Courier, monospace";
    ctx.fillStyle = "#00FF66";
    ctx.fillText("AI MATRIX // CASCADE", 20, 28);
  } else if (eff.type === "ai_aura") {
    const pulse = 0.5 + Math.sin(time * 6) * 0.35;
    ctx.strokeStyle = `rgba(0, 242, 254, ${(0.6 + pulse * 0.3) * intensity})`;
    ctx.lineWidth = Math.max(4, w * 0.02) * intensity;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  } else if (eff.type === "ai_night_vision") {
    ctx.fillStyle = `rgba(10, 255, 60, ${0.22 * intensity})`;
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.6);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${0.85 * intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.font = "bold 13px Courier, monospace";
    ctx.fillStyle = "#00FF66";
    ctx.fillText("AI NVG-GEN4 // 1080P", 24, 28);
  } else if (eff.type === "ai_cartoon") {
    if (sourceCanvas && sourceCanvas !== canvas) {
      ctx.save();
      ctx.filter = `saturate(${1.6 + 0.5 * intensity}) contrast(1.2)`;
      ctx.drawImage(sourceCanvas, 0, 0, cw, ch, 0, 0, w, h);
      ctx.restore();
      ctx.strokeStyle = `rgba(255, 230, 0, ${0.85 * intensity})`;
      ctx.lineWidth = Math.max(4, w * 0.015) * intensity;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    }
  }

  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
  ctx.restore();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
}
