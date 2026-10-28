import { ClipAnimationConfig } from '../types/project';

export interface EvaluatedClipAnimation {
  alpha: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  displayText?: string;
}

/**
 * Universal evaluation function for clip animations across web player and offline renderers.
 * Supports:
 * - IN animations (fade_in, zoom_in, zoom_in_2/pop, slide_right/left/up/down, spin_in, bounce_in, wipe_right, shake_in, blur_in)
 * - OUT animations (fade_out, zoom_out, slide_left/right/down/up, spin_out, shrink_out, wipe_left, shake_out, dissolve)
 * - LOOP animations (pulse, bounce, float, wave, wobble, pendulum, swing, heartbeat, zoom_pulse, jitter)
 * - Backward-compatible legacy single-string animations
 */
export function evaluateClipAnimation(
  anim: ClipAnimationConfig | string | undefined | null,
  elapsed: number,
  duration: number,
  w: number = 100,
  h: number = 100,
  previewScale: number = 1.0,
  rawText?: string
): EvaluatedClipAnimation {
  let alpha = 1.0;
  let scaleX = 1.0;
  let scaleY = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let displayText = rawText;

  if (!anim || anim === 'none') {
    return { alpha, scaleX, scaleY, offsetX, offsetY, rotation, displayText };
  }

  const timeLeft = Math.max(0, duration - elapsed);

  // 1. OBJECT CONFIGURATION (IN / OUT / LOOP)
  if (typeof anim === 'object') {
    const inPreset =
      anim.inPreset ||
      (anim.type === 'in'
        ? anim.preset
        : typeof anim.preset === 'string' && anim.preset.endsWith('_in')
        ? anim.preset
        : null);
    const inDur = Math.max(0.05, anim.inDuration || anim.duration || 0.5);

    const outPreset =
      anim.outPreset ||
      (anim.type === 'out'
        ? anim.preset
        : typeof anim.preset === 'string' && anim.preset.endsWith('_out')
        ? anim.preset
        : null);
    const outDur = Math.max(0.05, anim.outDuration || anim.duration || 0.5);

    const loopPreset =
      anim.loopPreset ||
      anim.comboPreset ||
      (anim.type === 'combo' || anim.type === 'loop' ? anim.preset : null);

    // ─── A. IN ANIMATION ───
    if (inPreset && inPreset !== 'none' && elapsed < inDur) {
      const p = Math.max(0, Math.min(1, elapsed / inDur));
      const easeOutQuad = 1 - (1 - p) * (1 - p);
      const easeOutBack = 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);

      if (inPreset === 'fade_in') {
        alpha *= p;
      } else if (inPreset === 'zoom_in') {
        const sc = 0.2 + 0.8 * easeOutQuad;
        scaleX *= sc;
        scaleY *= sc;
        alpha *= p;
      } else if (inPreset === 'zoom_in_2' || inPreset === 'pop') {
        const sc = Math.max(0.01, easeOutBack);
        scaleX *= sc;
        scaleY *= sc;
        alpha *= p;
      } else if (inPreset === 'slide_right') {
        offsetX -= (1 - easeOutQuad) * (w || 100);
      } else if (inPreset === 'slide_left') {
        offsetX += (1 - easeOutQuad) * (w || 100);
      } else if (inPreset === 'slide_up') {
        offsetY += (1 - easeOutQuad) * (h || 100);
      } else if (inPreset === 'slide_down') {
        offsetY -= (1 - easeOutQuad) * (h || 100);
      } else if (inPreset === 'spin_in') {
        rotation += (1 - easeOutQuad) * 360;
        const sc = 0.3 + 0.7 * easeOutQuad;
        scaleX *= sc;
        scaleY *= sc;
        alpha *= p;
      } else if (inPreset === 'bounce_in') {
        const sc = Math.max(0.01, easeOutBack);
        scaleX *= sc;
        scaleY *= sc;
      } else if (inPreset === 'wipe_right') {
        offsetX -= (1 - p) * (w * 0.5);
        alpha *= p;
      } else if (inPreset === 'shake_in') {
        if (p < 0.8) offsetX += Math.sin(p * 35) * (1 - p) * 15 * previewScale;
        alpha *= p;
      } else if (inPreset === 'blur_in') {
        alpha *= p;
        const sc = 0.9 + 0.1 * p;
        scaleX *= sc;
        scaleY *= sc;
      }
    }

    // ─── B. OUT ANIMATION ───
    if (outPreset && outPreset !== 'none' && timeLeft < outDur) {
      const p = Math.max(0, Math.min(1, timeLeft / outDur));
      const easeInQuad = p * p;

      if (outPreset === 'fade_out') {
        alpha *= p;
      } else if (outPreset === 'zoom_out') {
        const sc = 0.3 + 0.7 * easeInQuad;
        scaleX *= sc;
        scaleY *= sc;
        alpha *= p;
      } else if (outPreset === 'slide_left') {
        offsetX -= (1 - easeInQuad) * (w || 100);
      } else if (outPreset === 'slide_right') {
        offsetX += (1 - easeInQuad) * (w || 100);
      } else if (outPreset === 'slide_down') {
        offsetY += (1 - easeInQuad) * (h || 100);
      } else if (outPreset === 'slide_up') {
        offsetY -= (1 - easeInQuad) * (h || 100);
      } else if (outPreset === 'spin_out') {
        rotation -= (1 - easeInQuad) * 360;
        const sc = 0.3 + 0.7 * easeInQuad;
        scaleX *= sc;
        scaleY *= sc;
        alpha *= p;
      } else if (outPreset === 'shrink_out') {
        scaleX *= easeInQuad;
        scaleY *= easeInQuad;
      } else if (outPreset === 'wipe_left') {
        offsetX += (1 - p) * (w * 0.5);
        alpha *= p;
      } else if (outPreset === 'shake_out') {
        if (p > 0.2) offsetX += Math.sin(p * 35) * (1 - p) * 15 * previewScale;
        alpha *= p;
      } else if (outPreset === 'dissolve') {
        alpha *= p;
      }
    }

    // ─── C. LOOP ANIMATION (Runs continuously throughout clip) ───
    if (loopPreset && loopPreset !== 'none') {
      if (loopPreset === 'pulse' || loopPreset === 'zoom_pulse') {
        const sc = 1.0 + 0.08 * Math.sin(elapsed * 5);
        scaleX *= sc;
        scaleY *= sc;
      } else if (loopPreset === 'bounce') {
        offsetY += -Math.abs(Math.sin(elapsed * 5)) * (14 * previewScale);
      } else if (loopPreset === 'wobble') {
        rotation += Math.sin(elapsed * 7) * 4;
      } else if (loopPreset === 'heartbeat') {
        const beat = (elapsed * 2) % 1;
        const bScale = beat < 0.2 ? Math.sin(beat * Math.PI * 5) * 0.08 : 0;
        scaleX *= 1.0 + bScale;
        scaleY *= 1.0 + bScale;
      } else if (loopPreset === 'pendulum' || loopPreset === 'swing') {
        rotation += Math.sin(elapsed * 4) * 6;
      } else if (loopPreset === 'float') {
        offsetY += Math.sin(elapsed * 3) * (12 * previewScale);
      } else if (loopPreset === 'wave') {
        offsetX += Math.sin(elapsed * 4) * (10 * previewScale);
        offsetY += Math.cos(elapsed * 4) * (8 * previewScale);
      } else if (loopPreset === 'jitter') {
        offsetX += Math.sin(elapsed * 35) * (3 * previewScale);
        offsetY += Math.cos(elapsed * 45) * (3 * previewScale);
      }
    }

    return { alpha, scaleX, scaleY, offsetX, offsetY, rotation, displayText };
  }

  // 2. BACKWARD-COMPATIBLE LEGACY STRING ANIMATION
  if (typeof anim === 'string') {
    const sAnim = anim.toLowerCase().replace(/[-_]/g, '');
    const introDur = Math.min(0.5, duration * 0.35);
    const exitDur = Math.min(0.35, duration * 0.25);

    if (sAnim === 'typewriter' && displayText) {
      const chars = Math.min(displayText.length, Math.floor(elapsed * 14));
      displayText = displayText.slice(0, chars);
    } else if (sAnim === 'bounce') {
      if (elapsed < introDur) {
        const p = elapsed / introDur;
        const sc = 0.45 + Math.sin(p * Math.PI) * 0.75;
        scaleX *= sc;
        scaleY *= sc;
        alpha = Math.min(1, p * 2);
      } else {
        const sc = 1.0 + Math.sin(elapsed * 4) * 0.06;
        scaleX *= sc;
        scaleY *= sc;
      }
    } else if (sAnim === 'fade' || sAnim === 'fadein') {
      if (elapsed < introDur) {
        alpha = elapsed / introDur;
      } else if (timeLeft < exitDur) {
        alpha = timeLeft / exitDur;
      }
    } else if (sAnim === 'slideup' || sAnim === 'up') {
      if (elapsed < introDur) {
        const p = elapsed / introDur;
        const easeOut = Math.sin((p * Math.PI) / 2);
        offsetY = (1 - easeOut) * (45 * previewScale);
        alpha = p;
      } else if (timeLeft < exitDur) {
        const p = 1 - timeLeft / exitDur;
        offsetY = -p * (25 * previewScale);
        alpha = 1 - p;
      }
    } else if (sAnim === 'slidedown' || sAnim === 'down') {
      if (elapsed < introDur) {
        const p = elapsed / introDur;
        const easeOut = Math.sin((p * Math.PI) / 2);
        offsetY = -(1 - easeOut) * (45 * previewScale);
        alpha = p;
      } else if (timeLeft < exitDur) {
        const p = 1 - timeLeft / exitDur;
        offsetY = p * (25 * previewScale);
        alpha = 1 - p;
      }
    } else if (sAnim === 'slide' || sAnim === 'slideleft') {
      if (elapsed < introDur) {
        const p = elapsed / introDur;
        const easeOut = Math.sin((p * Math.PI) / 2);
        offsetX = (1 - easeOut) * (60 * previewScale);
        alpha = p;
      } else if (timeLeft < exitDur) {
        const p = 1 - timeLeft / exitDur;
        offsetX = -p * (35 * previewScale);
        alpha = 1 - p;
      }
    } else if (sAnim === 'slideright') {
      if (elapsed < introDur) {
        const p = elapsed / introDur;
        const easeOut = Math.sin((p * Math.PI) / 2);
        offsetX = -(1 - easeOut) * (60 * previewScale);
        alpha = p;
      } else if (timeLeft < exitDur) {
        const p = 1 - timeLeft / exitDur;
        offsetX = p * (35 * previewScale);
        alpha = 1 - p;
      }
    } else if (sAnim === 'zoomin' || sAnim === 'zoom') {
      if (elapsed < introDur) {
        const p = elapsed / introDur;
        const easeOut = Math.sin((p * Math.PI) / 2);
        const sc = 0.35 + easeOut * 0.75;
        scaleX *= sc;
        scaleY *= sc;
        alpha = p;
      } else if (timeLeft < exitDur) {
        const p = 1 - timeLeft / exitDur;
        const sc = 1.0 + p * 0.25;
        scaleX *= sc;
        scaleY *= sc;
        alpha = 1 - p;
      }
    } else if (sAnim === 'pulse') {
      const sc = 1.0 + Math.sin(elapsed * 6) * 0.08;
      scaleX *= sc;
      scaleY *= sc;
    } else if (sAnim === 'shake') {
      if (elapsed < 0.8) {
        offsetX = Math.sin(elapsed * 40) * (4 * previewScale);
      }
    } else if (sAnim === 'wave') {
      offsetY = Math.sin(elapsed * 4) * (6 * previewScale);
    } else if (sAnim === 'pop') {
      if (elapsed < 0.3) {
        const p = elapsed / 0.3;
        const sc = 0.3 + p * 0.85;
        scaleX *= sc;
        scaleY *= sc;
        alpha = p;
      }
    }
  }

  return { alpha, scaleX, scaleY, offsetX, offsetY, rotation, displayText };
}
