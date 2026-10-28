import { StickerClip, TextClip, CaptionClip } from "../../types/project";
import { applyMotionTracking } from "./rendererEffects";
import { generateWordTimings } from "../srtParser";
import { evaluateClipAnimation } from "../animationEngine";

export function drawSticker(
  ctx: CanvasRenderingContext2D,
  stk: StickerClip,
  time: number,
  w: number,
  h: number,
) {
  ctx.save();
  const previewScale = Math.max(0.2, (w || 360) / 360);
  const motion = applyMotionTracking(
    time,
    stk.startTime,
    stk.duration,
    stk.motionTrack,
  );
  const px = (stk.position?.x ?? 50) * (w / 100) + motion.dx;
  const py = (stk.position?.y ?? 50) * (h / 100) + motion.dy;
  const elapsed = Math.max(0, time - stk.startTime);
  const duration = Math.max(0.5, stk.duration || 3.0);

  const animEval = evaluateClipAnimation(
    stk.animation,
    elapsed,
    duration,
    60 * previewScale,
    60 * previewScale,
    previewScale
  );

  const animScale = (animEval.scaleX + animEval.scaleY) / 2;
  const scale = (stk.scale || 1.0) * motion.dScale * animScale;
  const rot = (stk.rotation || 0) + motion.dRot + animEval.rotation;
  const alpha = animEval.alpha;
  const offsetX = animEval.offsetX;
  const offsetY = animEval.offsetY;

  ctx.translate(px + offsetX, py + offsetY);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  const charText = stk.char || "🔥";
  const isBadge = charText.length > 2;

  if (isBadge) {
    const badgeFontSize = Math.round(20 * previewScale);
    ctx.font =
      `bold ${badgeFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    const metrics = ctx.measureText(charText);
    const badgeW = metrics.width + 24 * previewScale;
    const badgeH = 38 * previewScale;

    ctx.shadowColor = "rgba(0, 242, 254, 0.4)";
    ctx.shadowBlur = 12 * previewScale;

    ctx.fillStyle = "rgba(11, 13, 19, 0.9)";
    if ((ctx as any).roundRect) {
      ctx.beginPath();
      (ctx as any).roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 19 * previewScale);
      ctx.fill();
      ctx.strokeStyle = "#00F2FE";
      ctx.lineWidth = Math.max(1, 2 * previewScale);
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
    const stickerFontSize = Math.round(64 * previewScale);
    ctx.font = `${stickerFontSize}px sans-serif`;
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
  const previewScale = Math.max(0.2, (w || 360) / 360);
  const motion = applyMotionTracking(
    time,
    txt.startTime,
    txt.duration,
    txt.motionTrack,
  );
  const px = (txt.position?.x ?? 50) * (w / 100) + motion.dx;
  const py = (txt.position?.y ?? 50) * (h / 100) + motion.dy;
  const elapsed = Math.max(0, time - txt.startTime);
  const duration = Math.max(0.5, txt.duration || 3.0);
  const timeLeft = Math.max(0, duration - elapsed);
  const animEval = evaluateClipAnimation(
    txt.animation,
    elapsed,
    duration,
    150 * previewScale,
    50 * previewScale,
    previewScale,
    txt.text || ""
  );

  let displayText = animEval.displayText ?? (txt.text || "");
  const animScale = (animEval.scaleX + animEval.scaleY) / 2;
  let scale = (txt.scale || 1.0) * motion.dScale * animScale;
  let alpha = animEval.alpha;
  let xOffset = animEval.offsetX;
  let yOffset = animEval.offsetY;
  let rot = (txt.rotation || 0) + (motion ? motion.dRot : 0) + animEval.rotation;

  // When paused in editor, guarantee full visibility and clean frame alignment
  if (!isPlaying && (!txt.animation || txt.animation === "none")) {
    alpha = 1.0;
  }

  ctx.translate(px + xOffset, py + yOffset);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  const style = txt.style || {};
  const rawFontSize = style.fontSize || 24;
  const fontSize = Math.round(rawFontSize * previewScale);
  const fontWeight = style.fontWeight || "bold";
  const fontFamily =
    style.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Automatic multi-line word wrapping so long text never spills outside canvas
  const maxAllowedW = Math.max(120 * previewScale, (w * 0.88) / Math.max(0.1, scale));
  const rawParagraphs = displayText.split("\n");
  const lines: string[] = [];

  for (const para of rawParagraphs) {
    const words = para.split(" ");
    let curLine = "";

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = curLine ? `${curLine} ${word}` : word;
      const testMetrics = ctx.measureText(testLine);

      if (testMetrics.width > maxAllowedW && curLine) {
        lines.push(curLine);
        curLine = word;
      } else {
        curLine = testLine;
      }
    }
    if (curLine) {
      lines.push(curLine);
    }
  }

  const effectiveLines = lines.length > 0 ? lines : [displayText];
  const lineHeight = fontSize * 1.35;
  const totalTextHeight = effectiveLines.length * lineHeight;

  let maxLineWidth = 0;
  for (const line of effectiveLines) {
    const lw = ctx.measureText(line).width;
    if (lw > maxLineWidth) maxLineWidth = lw;
  }
  const textWidth = maxLineWidth;
  const textHeight = totalTextHeight;

  // Draw Background Pill or Box if present
  if (style.backgroundColor && style.backgroundColor !== "transparent") {
    ctx.fillStyle = style.backgroundColor;
    const padX = (style.paddingHorizontal || 14) * previewScale;
    const padY = (style.paddingVertical || 8) * previewScale;
    const radius = (style.borderRadius || 8) * previewScale;

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
      ctx.lineWidth = Math.max(1, (style.borderWidth || 2) * previewScale);
      ctx.stroke();
    }
  }

  // Text Effects & Shadows Setup
  const effect = style.textEffect || "none";

  if (effect === "neon") {
    const glowColor = style.borderColor || style.color || "#00F2FE";
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20 * previewScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (effect === "3d") {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4 * previewScale;
    ctx.shadowOffsetX = 4 * previewScale;
    ctx.shadowOffsetY = 4 * previewScale;
  } else if (effect === "shadow") {
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 12 * previewScale;
    ctx.shadowOffsetX = 3 * previewScale;
    ctx.shadowOffsetY = 5 * previewScale;
  } else if (effect === "gold") {
    ctx.shadowColor = "#FFE600";
    ctx.shadowBlur = 18 * previewScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (effect === "fire") {
    ctx.shadowColor = "#FF3300";
    ctx.shadowBlur = 22 * previewScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = -2 * previewScale;
  } else if (effect === "frost") {
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 20 * previewScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (effect === "retro_box") {
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.fillRect(
      -textWidth / 2 - 8 * previewScale,
      -textHeight / 2 - 4 * previewScale,
      textWidth + 16 * previewScale,
      textHeight + 8 * previewScale,
    );
    ctx.restore();
  } else if (style.textShadowColor) {
    ctx.shadowColor = style.textShadowColor;
    ctx.shadowBlur = (style.textShadowRadius || 12) * previewScale;
    ctx.shadowOffsetX = (style.textShadowOffset?.width || 0) * previewScale;
    ctx.shadowOffsetY = (style.textShadowOffset?.height || 0) * previewScale;
  }

  // Render each wrapped line centered vertically and horizontally
  const startY = -(effectiveLines.length - 1) * (lineHeight / 2);

  effectiveLines.forEach((line, idx) => {
    const lineY = startY + idx * lineHeight;

    if (effect === "3d") {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      for (let offset = Math.max(1, Math.round(4 * previewScale)); offset >= 1; offset--) {
        ctx.fillText(line, offset, lineY + offset);
      }
      ctx.restore();
    } else if (effect === "cyber") {
      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 80, 0.85)";
      ctx.fillText(line, 3 * previewScale, lineY + 2 * previewScale);
      ctx.fillStyle = "rgba(0, 242, 254, 0.85)";
      ctx.fillText(line, -2 * previewScale, lineY - 2 * previewScale);
      ctx.restore();
    } else if (effect === "glitch") {
      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 80, 0.8)";
      ctx.fillText(line, 3 * previewScale, lineY);
      ctx.fillStyle = "rgba(0, 242, 254, 0.8)";
      ctx.fillText(line, -3 * previewScale, lineY);
      ctx.restore();
    } else if (effect === "hologram") {
      ctx.save();
      ctx.fillStyle = "rgba(0, 242, 254, 0.6)";
      ctx.fillText(line, -2 * previewScale, lineY);
      ctx.fillStyle = "rgba(255, 0, 128, 0.6)";
      ctx.fillText(line, 2 * previewScale, lineY);
      ctx.restore();
    }

    // Optional Stroke / Outline
    if (effect === "stroke" || (style.strokeColor && (style.strokeWidth || 2))) {
      ctx.strokeStyle = style.strokeColor || style.borderColor || "#000000";
      ctx.lineWidth = Math.max(0.5, (style.strokeWidth || 3) * previewScale);
      ctx.strokeText(line, 0, lineY);
    }

    ctx.fillStyle = style.color || "#FFFFFF";
    ctx.fillText(line, 0, lineY);
  });

  ctx.restore();
}

/**
 * Dedicated Subtitle & Caption renderer with live speaking word highlighting (Karaoke mode),
 * custom subtitle presets, outline strokes, shadow glow, and multi-line word wrapping.
 */
export function drawCaptionOverlay(
  ctx: CanvasRenderingContext2D,
  cap: CaptionClip,
  time: number,
  w: number,
  h: number,
  isPlaying: boolean = false,
) {
  ctx.save();
  const previewScale = Math.max(0.2, (w || 360) / 360);
  const motion = applyMotionTracking(
    time,
    cap.startTime,
    cap.duration,
    cap.motionTrack,
  );

  // Default subtitle position is bottom center (y=82) if not specified
  const px = (cap.position?.x ?? 50) * (w / 100) + motion.dx;
  const py = (cap.position?.y ?? 82) * (h / 100) + motion.dy;
  const elapsed = Math.max(0, time - cap.startTime);
  const duration = Math.max(0.5, cap.duration || 3.0);
  const timeLeft = Math.max(0, duration - elapsed);

  const animEval = evaluateClipAnimation(
    cap.animation,
    elapsed,
    duration,
    150 * previewScale,
    40 * previewScale,
    previewScale,
    cap.text || ""
  );

  const animScale = (animEval.scaleX + animEval.scaleY) / 2;
  const scale = (cap.scale || 1.0) * motion.dScale * animScale;
  const alpha = animEval.alpha;
  const xOffset = animEval.offsetX;
  const yOffset = animEval.offsetY;

  ctx.translate(px + xOffset, py + yOffset);
  const rot = (cap.rotation || 0) + motion.dRot + animEval.rotation;
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  const style = cap.style || {};
  const rawFontSize = style.fontSize || 26;
  const fontSize = Math.round(rawFontSize * previewScale);
  const fontWeight = style.fontWeight || "900";
  const fontFamily =
    style.fontFamily || 'Impact, Arial Black, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const isUppercase = Boolean((style as any)?.uppercase ?? (cap as any)?.uppercase);
  const rawText = isUppercase ? (cap.text || "").toUpperCase() : cap.text || "";
  const rawWords =
    cap.words && cap.words.length > 0
      ? cap.words
      : generateWordTimings(rawText, cap.startTime, cap.duration);
  const wordsList = isUppercase
    ? rawWords.map((item) => ({ ...item, word: item.word.toUpperCase() }))
    : rawWords;

  const enableWordHighlight =
    cap.enableWordHighlight !== false &&
    (cap.animation === "karaoke" ||
      cap.highlightColor !== undefined ||
      cap.style?.highlightColor !== undefined ||
      cap.presetId === "mrbeast" ||
      cap.presetId === "hormozi" ||
      cap.presetId === "karaoke");

  const highlightColor =
    cap.highlightColor || cap.style?.highlightColor || "#FFE600";
  const baseTextColor = style.color || "#FFFFFF";
  const strokeColor = style.strokeColor || "#000000";
  const strokeWidth = Math.max(0.5, (style.strokeWidth ?? 3.5) * previewScale);

  // Measure word widths and lay them out into wrapped lines
  const spaceWidth = ctx.measureText(" ").width;
  const maxAllowedW = Math.max(140 * previewScale, (w * 0.9) / Math.max(0.1, scale));

  interface MeasuredWord {
    word: string;
    width: number;
    isActive: boolean;
  }

  interface SubtitleLine {
    words: MeasuredWord[];
    lineWidth: number;
  }

  const lines: SubtitleLine[] = [];
  let currentLineWords: MeasuredWord[] = [];
  let currentLineWidth = 0;

  for (let i = 0; i < wordsList.length; i++) {
    const item = wordsList[i];
    const wWidth = ctx.measureText(item.word).width;
    const isWordActive = time >= item.start && time < item.end;

    // Check if adding this word exceeds line width
    const additional = currentLineWords.length > 0 ? spaceWidth + wWidth : wWidth;

    if (currentLineWidth + additional > maxAllowedW && currentLineWords.length > 0) {
      lines.push({
        words: currentLineWords,
        lineWidth: currentLineWidth,
      });
      currentLineWords = [{ word: item.word, width: wWidth, isActive: isWordActive }];
      currentLineWidth = wWidth;
    } else {
      currentLineWords.push({
        word: item.word,
        width: wWidth,
        isActive: isWordActive,
      });
      currentLineWidth += additional;
    }
  }

  if (currentLineWords.length > 0) {
    lines.push({
      words: currentLineWords,
      lineWidth: currentLineWidth,
    });
  }

  const effectiveLines = lines.length > 0 ? lines : [{
    words: [{ word: rawText, width: ctx.measureText(rawText).width, isActive: true }],
    lineWidth: ctx.measureText(rawText).width,
  }];

  const lineHeight = fontSize * 1.35;
  const totalTextHeight = effectiveLines.length * lineHeight;
  let maxLineWidth = 0;
  for (const l of effectiveLines) {
    if (l.lineWidth > maxLineWidth) maxLineWidth = l.lineWidth;
  }

  // Draw Background Box / Pill if configured (e.g. Minimal subtitle box)
  if (style.backgroundColor && style.backgroundColor !== "transparent") {
    ctx.fillStyle = style.backgroundColor;
    const padX = (style.paddingHorizontal || 16) * previewScale;
    const padY = (style.paddingVertical || 8) * previewScale;
    const radius = (style.borderRadius || 10) * previewScale;

    ctx.beginPath();
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(
        -maxLineWidth / 2 - padX,
        -totalTextHeight / 2 - padY,
        maxLineWidth + padX * 2,
        totalTextHeight + padY * 2,
        radius,
      );
    } else {
      ctx.rect(
        -maxLineWidth / 2 - padX,
        -totalTextHeight / 2 - padY,
        maxLineWidth + padX * 2,
        totalTextHeight + padY * 2,
      );
    }
    ctx.fill();

    if (style.borderColor && (style.borderWidth || 1)) {
      ctx.strokeStyle = style.borderColor;
      ctx.lineWidth = Math.max(1, (style.borderWidth || 2) * previewScale);
      ctx.stroke();
    }
  }

  // Text Shadow / Glow Setup
  const effect = style.textEffect || "none";
  if (effect === "neon") {
    ctx.shadowColor = highlightColor || "#00F2FE";
    ctx.shadowBlur = 18 * previewScale;
  } else if (effect === "3d") {
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 4 * previewScale;
    ctx.shadowOffsetX = 3 * previewScale;
    ctx.shadowOffsetY = 3 * previewScale;
  } else if (effect === "shadow") {
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 10 * previewScale;
    ctx.shadowOffsetX = 2 * previewScale;
    ctx.shadowOffsetY = 4 * previewScale;
  }

  // Draw lines & words with live speaking word highlight
  const startY = -(effectiveLines.length - 1) * (lineHeight / 2);

  effectiveLines.forEach((lineObj, lineIdx) => {
    const lineY = startY + lineIdx * lineHeight;
    const align = style.textAlign || "center";
    let curX =
      align === "left"
        ? -maxLineWidth / 2
        : align === "right"
          ? maxLineWidth / 2 - lineObj.lineWidth
          : -lineObj.lineWidth / 2;

    for (let wIdx = 0; wIdx < lineObj.words.length; wIdx++) {
      const mw = lineObj.words[wIdx];
      const isHighlighted = mw.isActive && enableWordHighlight;
      const hlStyle = (cap as any).highlightStyle || (style as any).highlightStyle || "color";

      ctx.save();

      // If active speaking word, apply specific highlight style
      if (isHighlighted) {
        if (hlStyle === "scale") {
          ctx.translate(curX + mw.width / 2, lineY);
          ctx.scale(1.18, 1.18);
          ctx.translate(-(curX + mw.width / 2), -lineY);
        } else if (hlStyle === "glow") {
          ctx.shadowColor = highlightColor;
          ctx.shadowBlur = 24 * previewScale;
        } else if (hlStyle === "box") {
          // Rounded background badge behind active word
          ctx.save();
          ctx.fillStyle = highlightColor;
          const hp = 6 * previewScale;
          const vp = 3 * previewScale;
          const bw = mw.width + hp * 2;
          const bh = fontSize * 1.3 + vp * 2;
          const bx = curX - hp;
          const by = lineY - fontSize * 0.65 - vp;
          ctx.beginPath();
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(bx, by, bw, bh, 6 * previewScale);
          } else {
            ctx.rect(bx, by, bw, bh);
          }
          ctx.fill();
          ctx.restore();
        } else if (hlStyle === "underline") {
          // Underline bar beneath the active word
          ctx.save();
          ctx.fillStyle = highlightColor;
          ctx.fillRect(curX, lineY + fontSize * 0.55, mw.width, Math.max(1, 4 * previewScale));
          ctx.restore();
        }
      }

      // 1. Draw outline stroke
      if (strokeWidth > 0 && !(isHighlighted && hlStyle === "box")) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isHighlighted ? strokeWidth + 1 : strokeWidth;
        ctx.lineJoin = "round";
        ctx.strokeText(mw.word, curX, lineY);
      }

      // 2. Draw fill text
      if (isHighlighted && hlStyle === "box") {
        ctx.fillStyle = "#000000";
      } else {
        ctx.fillStyle = isHighlighted ? highlightColor : baseTextColor;
      }
      ctx.fillText(mw.word, curX, lineY);

      ctx.restore();

      curX += mw.width + spaceWidth;
    }
  });

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
    const full =
      cleanHex.length === 3
        ? cleanHex[0] +
          cleanHex[0] +
          cleanHex[1] +
          cleanHex[1] +
          cleanHex[2] +
          cleanHex[2]
        : cleanHex;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    isLight = (r * 299 + g * 587 + b * 114) / 1000 > 155;
  }

  ctx.strokeStyle = isLight
    ? "rgba(0, 0, 0, 0.12)"
    : "rgba(255, 255, 255, 0.1)";
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
