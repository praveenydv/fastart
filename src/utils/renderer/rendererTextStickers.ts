import { StickerClip, TextClip } from "../../types/project";
import { applyMotionTracking } from "./rendererEffects";

export function drawSticker(
  ctx: CanvasRenderingContext2D,
  stk: StickerClip,
  time: number,
  w: number,
  h: number,
) {
  ctx.save();
  const motion = applyMotionTracking(time, stk.startTime, stk.duration, stk.motionTrack);
  const px = (stk.position?.x ?? 50) * (w / 100) + motion.dx;
  const py = (stk.position?.y ?? 50) * (h / 100) + motion.dy;
  const elapsed = Math.max(0, time - stk.startTime);
  let scale = (stk.scale || 1.0) * motion.dScale;
  const rot = (stk.rotation || 0) + motion.dRot;
  let alpha = 1.0;
  let offsetY = 0;

  const anim = stk.animation || "bounce";
  if (anim === "bounce") {
    const bounce = Math.sin(elapsed * 4) * 0.08;
    scale += bounce;
  } else if (anim === "pulse") {
    scale *= (1.0 + Math.sin(elapsed * 6) * 0.1);
  } else if (anim === "wave") {
    offsetY = Math.sin(elapsed * 4) * 8;
  } else if (anim === "fade") {
    if (elapsed < 0.35) alpha = elapsed / 0.35;
  } else if (anim === "pop") {
    if (elapsed < 0.3) {
      const p = elapsed / 0.3;
      scale *= (0.3 + p * 0.85);
      alpha = p;
    }
  } // if anim === 'none', static without bounce

  ctx.translate(px, py + offsetY);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  const charText = stk.char || "🔥";
  const isBadge = charText.length > 2;

  if (isBadge) {
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
    ctx.font = "64px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(charText, 0, 0);
  }

  ctx.restore();
}

export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  txt: TextClip,
  time: number,
  w: number,
  h: number,
  isPlaying: boolean = false,
) {
  ctx.save();
  const motion = applyMotionTracking(time, txt.startTime, txt.duration, txt.motionTrack);
  const px = (txt.position?.x ?? 50) * (w / 100) + motion.dx;
  const py = (txt.position?.y ?? 50) * (h / 100) + motion.dy;
  const elapsed = Math.max(0, time - txt.startTime);
  const duration = Math.max(0.5, txt.duration || 3.0);
  const timeLeft = Math.max(0, duration - elapsed);
  let displayText = txt.text || "";
  let scale = (txt.scale || 1.0) * motion.dScale;
  let alpha = 1.0;
  let xOffset = 0;
  let yOffset = 0;

  const anim = (txt.animation || "none").toLowerCase().replace(/[-_]/g, "");
  const introDur = Math.min(0.5, duration * 0.35);
  const exitDur = Math.min(0.35, duration * 0.25);

  if (anim === "typewriter") {
    const chars = Math.min(displayText.length, Math.floor(elapsed * 14));
    displayText = displayText.slice(0, chars);
  } else if (anim === "bounce") {
    if (elapsed < introDur) {
      const p = elapsed / introDur;
      scale = (0.45 + Math.sin(p * Math.PI) * 0.75) * (txt.scale || 1.0);
      alpha = Math.min(1, p * 2);
    }
  } else if (anim === "fade" || anim === "fadein") {
    if (elapsed < introDur) {
      alpha = elapsed / introDur;
    } else if (timeLeft < exitDur) {
      alpha = timeLeft / exitDur;
    }
  } else if (anim === "slideup" || anim === "up") {
    if (elapsed < introDur) {
      const p = elapsed / introDur;
      const easeOut = Math.sin((p * Math.PI) / 2);
      yOffset = (1 - easeOut) * 50;
      alpha = p;
    } else if (timeLeft < exitDur) {
      const p = 1 - (timeLeft / exitDur);
      yOffset = -p * 30;
      alpha = 1 - p;
    }
  } else if (anim === "slidedown" || anim === "down") {
    if (elapsed < introDur) {
      const p = elapsed / introDur;
      const easeOut = Math.sin((p * Math.PI) / 2);
      yOffset = -(1 - easeOut) * 50;
      alpha = p;
    } else if (timeLeft < exitDur) {
      const p = 1 - (timeLeft / exitDur);
      yOffset = p * 30;
      alpha = 1 - p;
    }
  } else if (anim === "slide" || anim === "slideleft") {
    if (elapsed < introDur) {
      const p = elapsed / introDur;
      const easeOut = Math.sin((p * Math.PI) / 2);
      xOffset = (1 - easeOut) * 70;
      alpha = p;
    } else if (timeLeft < exitDur) {
      const p = 1 - (timeLeft / exitDur);
      xOffset = -p * 40;
      alpha = 1 - p;
    }
  } else if (anim === "slideright") {
    if (elapsed < introDur) {
      const p = elapsed / introDur;
      const easeOut = Math.sin((p * Math.PI) / 2);
      xOffset = -(1 - easeOut) * 70;
      alpha = p;
    } else if (timeLeft < exitDur) {
      const p = 1 - (timeLeft / exitDur);
      xOffset = p * 40;
      alpha = 1 - p;
    }
  } else if (anim === "zoomin" || anim === "zoom") {
    if (elapsed < introDur) {
      const p = elapsed / introDur;
      const easeOut = Math.sin((p * Math.PI) / 2);
      scale = (0.35 + easeOut * 0.75) * (txt.scale || 1.0);
      alpha = p;
    } else if (timeLeft < exitDur) {
      const p = 1 - (timeLeft / exitDur);
      scale = (1.0 + p * 0.25) * (txt.scale || 1.0);
      alpha = 1 - p;
    }
  } else if (anim === "pulse") {
    scale = (1.0 + Math.sin(elapsed * 6) * 0.08) * (txt.scale || 1.0);
  } else if (anim === "glitch") {
    if (isPlaying && Math.random() > 0.7) {
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
  const rot = (txt.rotation || 0) + (motion ? motion.dRot : 0);
  ctx.rotate((rot * Math.PI) / 180);
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

export function drawProceduralPlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  time: number,
  canvasBackground?: string,
) {
  const bg = canvasBackground || "#000000";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cleanHex = bg.replace("#", "").trim();
  let isLight = false;
  if (cleanHex.length === 3 || cleanHex.length === 6) {
    const full = cleanHex.length === 3
      ? cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2]
      : cleanHex;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    isLight = (r * 299 + g * 587 + b * 114) / 1000 > 155;
  }

  ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  ctx.fillStyle = isLight ? "#1E293B" : "#8E95A5";
  ctx.textAlign = "center";
  ctx.fillText(title, w / 2, h / 2 - 10);

  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  ctx.fillStyle = isLight ? "#64748B" : "#4B5563";
  ctx.fillText("Tap + to add video clips or audio tracks", w / 2, h / 2 + 25);
}
