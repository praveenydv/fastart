import { ClipTransform, KeyframePoint, MaskConfig, MaskKeyframePoint, FastArtProject } from "../types/project";
import { rustCoreBridge } from "../services/rustCoreBridge";

export interface ResolvedTransform {
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
  rotateX?: number;
  rotateY?: number;
  skewX?: number;
  skewY?: number;
  perspective?: number;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
  mask?: MaskConfig;
}

/**
 * Extracts and sanitizes the base static transform for any clip type.
 */
export function getBaseTransform(
  clip: any,
  clipType?: string,
): ResolvedTransform {
  if (!clip) {
    return {
      x: 0,
      y: 0,
      scale: 1.0,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      rotateX: 0,
      rotateY: 0,
      skewX: 0,
      skewY: 0,
      perspective: 800,
      opacity: 1.0,
      flipX: false,
      flipY: false,
    };
  }

  const isCaption = clipType === "caption" || clipType === "captions";
  const isTextOrSticker =
    clipType === "text" ||
    clipType === "texts" ||
    clipType === "sticker" ||
    clipType === "stickers" ||
    isCaption ||
    !!clip.text ||
    !!clip.char;

  const defaultScale = clip.char ? 1.2 : 1.0;
  const defaultX = isTextOrSticker ? 50 : 0;
  const defaultY = isTextOrSticker ? (isCaption ? 82 : 50) : 0;

  const t = clip.transform || {};
  const pos = clip.position || {};

  let x: number;
  let y: number;
  if (isTextOrSticker) {
    x =
      Number.isFinite(pos.x) && Number(pos.x) !== 0
        ? Number(pos.x)
        : Number.isFinite(t.x) && Number(t.x) !== 0
          ? Number(t.x)
          : Number.isFinite(pos.x)
            ? Number(pos.x)
            : Number.isFinite(t.x)
              ? Number(t.x)
              : defaultX;
    y =
      Number.isFinite(pos.y) && Number(pos.y) !== 0
        ? Number(pos.y)
        : Number.isFinite(t.y) && Number(t.y) !== 0
          ? Number(t.y)
          : Number.isFinite(pos.y)
            ? Number(pos.y)
            : Number.isFinite(t.y)
              ? Number(t.y)
              : defaultY;
  } else {
    x = Number.isFinite(t.x)
      ? Number(t.x)
      : Number.isFinite(pos.x)
        ? Number(pos.x)
        : defaultX;
    y = Number.isFinite(t.y)
      ? Number(t.y)
      : Number.isFinite(pos.y)
        ? Number(pos.y)
        : defaultY;
  }

  const scale = Number.isFinite(t.scale)
    ? Number(t.scale)
    : Number.isFinite(clip.scale)
      ? Number(clip.scale)
      : defaultScale;

  const rotation = Number.isFinite(t.rotation)
    ? Number(t.rotation)
    : Number.isFinite(clip.rotation)
      ? Number(clip.rotation)
      : 0;

  const opacity = Number.isFinite(t.opacity)
    ? Number(t.opacity)
    : Number.isFinite(clip.opacity)
      ? Number(clip.opacity)
      : 1.0;

  const flipX = Boolean(t.flipX ?? clip.flipX ?? false);
  const flipY = Boolean(t.flipY ?? clip.flipY ?? false);
  const scaleX = Number.isFinite(t.scaleX) ? Number(t.scaleX) : 1.0;
  const scaleY = Number.isFinite(t.scaleY) ? Number(t.scaleY) : 1.0;
  const rotateX = Number.isFinite(t.rotateX) ? Number(t.rotateX) : 0;
  const rotateY = Number.isFinite(t.rotateY) ? Number(t.rotateY) : 0;
  const skewX = Number.isFinite(t.skewX) ? Number(t.skewX) : 0;
  const skewY = Number.isFinite(t.skewY) ? Number(t.skewY) : 0;
  const perspective = Number.isFinite(t.perspective)
    ? Number(t.perspective)
    : 800;

  return {
    x,
    y,
    scale: Math.max(0.1, Math.min(10.0, scale)),
    scaleX,
    scaleY,
    rotation: ((Math.round(rotation) % 360) + 360) % 360,
    rotateX,
    rotateY,
    skewX,
    skewY,
    perspective,
    opacity: Math.max(0, Math.min(1, opacity)),
    flipX,
    flipY,
  };
}

const sortedKfCache = new WeakMap<KeyframePoint[], KeyframePoint[]>();
const sortedMaskKfCache = new WeakMap<MaskKeyframePoint[], MaskKeyframePoint[]>();

/**
 * Validates, sorts, and deduplicates mask keyframes by timestamp.
 */
export function cleanAndSortMaskKeyframes(
  keyframes: MaskKeyframePoint[] | undefined | null,
): MaskKeyframePoint[] {
  if (!keyframes || !Array.isArray(keyframes) || keyframes.length === 0) {
    return [];
  }

  const cached = sortedMaskKfCache.get(keyframes);
  if (cached) {
    return cached;
  }

  const valid = keyframes.filter(
    (k) => k && typeof k.time === "number" && Number.isFinite(k.time) && k.mask,
  );

  const sorted = [...valid].sort((a, b) => a.time - b.time);

  const result: MaskKeyframePoint[] = [];
  for (const kf of sorted) {
    const cleanTime = Math.max(0, Number(kf.time.toFixed(3)));
    const m = kf.mask;
    const s = Number.isFinite(m.size) ? Number(m.size) : 60;
    const cleanMask: MaskConfig = {
      shape: m.shape || "none",
      size: s,
      width: Number.isFinite(m.width) ? Number(m.width) : s,
      height: Number.isFinite(m.height) ? Number(m.height) : s,
      feather: Number.isFinite(m.feather) ? Number(m.feather) : 0,
      roundness: Number.isFinite(m.roundness) ? Number(m.roundness) : 16,
      inverted: Boolean(m.inverted),
      x: Number.isFinite(m.x) ? Number(m.x) : 0,
      y: Number.isFinite(m.y) ? Number(m.y) : 0,
      rotation: Number.isFinite(m.rotation)
        ? ((Math.round(Number(m.rotation)) % 360) + 360) % 360
        : 0,
    };

    const cleanKf: MaskKeyframePoint = {
      time: cleanTime,
      mask: cleanMask,
      easing: kf.easing,
    };

    if (result.length > 0) {
      const last = result[result.length - 1];
      if (Math.abs(last.time - cleanTime) < 0.04) {
        result[result.length - 1] = cleanKf;
        continue;
      }
    }
    result.push(cleanKf);
  }

  sortedMaskKfCache.set(keyframes, result);
  return result;
}

/**
 * Finds a mask keyframe point near the specified local time.
 */
export function findMaskKeyframeAtTime(
  keyframes: MaskKeyframePoint[] | undefined | null,
  localTime: number,
  threshold = 0.12,
): MaskKeyframePoint | null {
  if (!keyframes || !Array.isArray(keyframes) || keyframes.length === 0) {
    return null;
  }
  return (
    keyframes.find((k) => Math.abs(k.time - localTime) <= threshold) || null
  );
}

/**
 * Validates, sorts, and deduplicates keyframes by timestamp.
 */
export function cleanAndSortKeyframes(
  keyframes: KeyframePoint[] | undefined | null,
): KeyframePoint[] {
  if (!keyframes || !Array.isArray(keyframes) || keyframes.length === 0) {
    return [];
  }

  const cached = sortedKfCache.get(keyframes);
  if (cached) {
    return cached;
  }

  // Filter valid entries
  const valid = keyframes.filter(
    (k) => k && typeof k.time === "number" && Number.isFinite(k.time),
  );

  // Sort by time
  const sorted = [...valid].sort((a, b) => a.time - b.time);

  // Deduplicate entries within 0.04s threshold (keeps later one)
  const result: KeyframePoint[] = [];
  for (const kf of sorted) {
    const cleanTime = Math.max(0, Number(kf.time.toFixed(3)));
    const cleanTransform: ClipTransform = {
      ...(Number.isFinite(kf.transform?.x) ? { x: Number(kf.transform.x) } : {}),
      ...(Number.isFinite(kf.transform?.y) ? { y: Number(kf.transform.y) } : {}),
      scale: Number.isFinite(kf.transform?.scale)
        ? Math.max(0.1, Math.min(10.0, Number(kf.transform.scale)))
        : 1.0,
      rotation: Number.isFinite(kf.transform?.rotation)
        ? ((Math.round(Number(kf.transform.rotation)) % 360) + 360) % 360
        : 0,
      scaleX: Number.isFinite(kf.transform?.scaleX)
        ? Number(kf.transform?.scaleX)
        : 1.0,
      scaleY: Number.isFinite(kf.transform?.scaleY)
        ? Number(kf.transform?.scaleY)
        : 1.0,
      rotateX: Number.isFinite(kf.transform?.rotateX)
        ? Number(kf.transform?.rotateX)
        : 0,
      rotateY: Number.isFinite(kf.transform?.rotateY)
        ? Number(kf.transform?.rotateY)
        : 0,
      skewX: Number.isFinite(kf.transform?.skewX)
        ? Number(kf.transform?.skewX)
        : 0,
      skewY: Number.isFinite(kf.transform?.skewY)
        ? Number(kf.transform?.skewY)
        : 0,
      perspective: Number.isFinite(kf.transform?.perspective)
        ? Number(kf.transform?.perspective)
        : 800,
      flipX: Boolean(kf.transform?.flipX),
      flipY: Boolean(kf.transform?.flipY),
    };
    const rawMask = kf.mask || kf.transform?.mask;
    let cleanMask: MaskConfig | undefined = undefined;
    if (rawMask && rawMask.shape && rawMask.shape !== "none") {
      cleanMask = {
        shape: rawMask.shape,
        size: Number.isFinite(rawMask.size) ? Number(rawMask.size) : 60,
        width: Number.isFinite(rawMask.width)
          ? Number(rawMask.width)
          : rawMask.size || 60,
        height: Number.isFinite(rawMask.height)
          ? Number(rawMask.height)
          : rawMask.size || 60,
        feather: Number.isFinite(rawMask.feather) ? Number(rawMask.feather) : 0,
        roundness: Number.isFinite(rawMask.roundness)
          ? Number(rawMask.roundness)
          : 16,
        inverted: Boolean(rawMask.inverted),
        x: Number.isFinite(rawMask.x) ? Number(rawMask.x) : 0,
        y: Number.isFinite(rawMask.y) ? Number(rawMask.y) : 0,
        rotation: Number.isFinite(rawMask.rotation)
          ? Number(rawMask.rotation)
          : 0,
      };
      cleanTransform.mask = cleanMask;
    }

    const cleanOpacity = Number.isFinite(kf.opacity)
      ? Math.max(0, Math.min(1, Number(kf.opacity)))
      : 1.0;

    const cleanKf: KeyframePoint = {
      time: cleanTime,
      transform: cleanTransform,
      opacity: cleanOpacity,
      easing: kf.easing,
      mask: cleanMask,
    };

    if (result.length > 0) {
      const last = result[result.length - 1];
      if (Math.abs(last.time - cleanTime) < 0.04) {
        // Replace close keyframe with the latest definition
        result[result.length - 1] = cleanKf;
        continue;
      }
    }
    result.push(cleanKf);
  }

  sortedKfCache.set(keyframes, result);
  return result;
}

/**
 * Finds a keyframe point near the specified local time.
 */
export function findKeyframeAtTime(
  keyframes: KeyframePoint[] | undefined | null,
  localTime: number,
  threshold = 0.12,
): KeyframePoint | null {
  if (!keyframes || !Array.isArray(keyframes) || keyframes.length === 0) {
    return null;
  }
  return (
    keyframes.find((k) => Math.abs(k.time - localTime) <= threshold) || null
  );
}

function interpolateMaskPair(
  m1: MaskConfig,
  m2: MaskConfig,
  ease: number,
  progress: number,
): MaskConfig {
  const rot1 = m1.rotation ?? 0;
  const rot2 = m2.rotation ?? 0;
  let rotDiff = (rot2 - rot1) % 360;
  if (rotDiff > 180) rotDiff -= 360;
  if (rotDiff < -180) rotDiff += 360;
  const interpRot = (((rot1 + rotDiff * ease) % 360) + 360) % 360;

  const s1 = m1.size ?? 60;
  const s2 = m2.size ?? 60;
  const w1 = m1.width ?? s1;
  const w2 = m2.width ?? s2;
  const h1 = m1.height ?? s1;
  const h2 = m2.height ?? s2;
  const f1 = m1.feather ?? 0;
  const f2 = m2.feather ?? 0;
  const r1 = m1.roundness ?? 16;
  const r2 = m2.roundness ?? 16;
  const x1 = m1.x ?? 0;
  const x2 = m2.x ?? 0;
  const y1 = m1.y ?? 0;
  const y2 = m2.y ?? 0;

  return {
    shape: progress < 0.5 ? m1.shape : m2.shape,
    size: s1 + (s2 - s1) * ease,
    width: w1 + (w2 - w1) * ease,
    height: h1 + (h2 - h1) * ease,
    feather: Math.max(0, f1 + (f2 - f1) * ease),
    roundness: Math.max(0, r1 + (r2 - r1) * ease),
    x: x1 + (x2 - x1) * ease,
    y: y1 + (y2 - y1) * ease,
    rotation: interpRot,
    inverted: progress < 0.5 ? m1.inverted : m2.inverted,
  };
}

/**
 * Smoothly interpolates clip mask parameters across keyframes,
 * prioritizing dedicated `maskKeyframes`, with fallback to embedded legacy keyframes.
 */
export function getInterpolatedMask(
  clip: any,
  curTime: number,
): MaskConfig | undefined {
  if (!clip) return undefined;

  const baseMask: MaskConfig | undefined = clip.mask || clip.transform?.mask;

  // 1. Dedicated mask keyframes
  const rawMaskKfs = clip.maskKeyframes || clip.mask?.keyframes;
  if (rawMaskKfs && Array.isArray(rawMaskKfs) && rawMaskKfs.length > 0) {
    const maskKfs = cleanAndSortMaskKeyframes(rawMaskKfs);
    if (maskKfs.length > 0) {
      const localTime = Math.max(0, curTime - (clip.startTime || 0));

      if (localTime <= maskKfs[0].time) {
        return maskKfs[0].mask || baseMask;
      }

      if (localTime >= maskKfs[maskKfs.length - 1].time) {
        const last = maskKfs[maskKfs.length - 1];
        return last.mask || baseMask;
      }

      for (let i = 0; i < maskKfs.length - 1; i++) {
        const k1 = maskKfs[i];
        const k2 = maskKfs[i + 1];
        if (localTime >= k1.time && localTime <= k2.time) {
          const span = k2.time - k1.time;
          const progress = span > 0 ? (localTime - k1.time) / span : 0;
          const easingType = (k1 as any).easing || (k2 as any).easing || "smooth";
          let ease = progress;
          if (easingType === "linear") {
            ease = progress;
          } else if (easingType === "easeIn") {
            ease = progress * progress * progress;
          } else if (easingType === "easeOut") {
            ease = 1 - Math.pow(1 - progress, 3);
          } else if (easingType === "easeInOut") {
            ease =
              progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          } else if (easingType === "spring") {
            ease =
              1 +
              Math.sin(progress * Math.PI * 4) * Math.pow(1 - progress, 2) * 0.3;
          } else {
            ease = progress * progress * (3 - 2 * progress);
          }

          const m1 = k1.mask || baseMask;
          const m2 = k2.mask || baseMask;
          if (!m1 && !m2) return undefined;
          if (!m1) return m2;
          if (!m2) return m1;

          return interpolateMaskPair(m1, m2, ease, progress);
        }
      }
    }
  }

  // 2. Legacy fallback to embedded transform keyframes
  if (
    clip.keyframes &&
    Array.isArray(clip.keyframes) &&
    clip.keyframes.length > 0
  ) {
    const kfs = cleanAndSortKeyframes(clip.keyframes);
    const legacyMaskKfs = kfs.filter((k) => k.mask || k.transform?.mask);
    if (legacyMaskKfs.length > 0) {
      const localTime = Math.max(0, curTime - (clip.startTime || 0));

      if (localTime <= legacyMaskKfs[0].time) {
        return legacyMaskKfs[0].mask || legacyMaskKfs[0].transform?.mask || baseMask;
      }

      if (localTime >= legacyMaskKfs[legacyMaskKfs.length - 1].time) {
        const last = legacyMaskKfs[legacyMaskKfs.length - 1];
        return last.mask || last.transform?.mask || baseMask;
      }

      for (let i = 0; i < legacyMaskKfs.length - 1; i++) {
        const k1 = legacyMaskKfs[i];
        const k2 = legacyMaskKfs[i + 1];
        if (localTime >= k1.time && localTime <= k2.time) {
          const span = k2.time - k1.time;
          const progress = span > 0 ? (localTime - k1.time) / span : 0;
          const easingType = (k1 as any).easing || (k2 as any).easing || "smooth";
          let ease = progress;
          if (easingType === "linear") {
            ease = progress;
          } else if (easingType === "easeIn") {
            ease = progress * progress * progress;
          } else if (easingType === "easeOut") {
            ease = 1 - Math.pow(1 - progress, 3);
          } else if (easingType === "easeInOut") {
            ease =
              progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          } else if (easingType === "spring") {
            ease =
              1 +
              Math.sin(progress * Math.PI * 4) * Math.pow(1 - progress, 2) * 0.3;
          } else {
            ease = progress * progress * (3 - 2 * progress);
          }

          const m1 = k1.mask || k1.transform?.mask || baseMask;
          const m2 = k2.mask || k2.transform?.mask || baseMask;
          if (!m1 && !m2) return undefined;
          if (!m1) return m2;
          if (!m2) return m1;

          return interpolateMaskPair(m1, m2, ease, progress);
        }
      }
    }
  }

  return baseMask;
}

/**
 * Centralized, authoritative keyframe interpolation function.
 * Smoothly interpolates transform parameters across keyframes or returns static base.
 */
export function getInterpolatedTransform(
  clip: any,
  curTime: number,
  clipType?: string,
): ResolvedTransform {
  const baseT = getBaseTransform(clip, clipType);
  const interpolatedMask = getInterpolatedMask(clip, curTime);

  if (
    !clip?.keyframes ||
    !Array.isArray(clip.keyframes) ||
    clip.keyframes.length === 0
  ) {
    return {
      ...baseT,
      mask: interpolatedMask,
    };
  }

  const kfs = cleanAndSortKeyframes(clip.keyframes);
  if (kfs.length === 0) {
    return {
      ...baseT,
      mask: interpolatedMask,
    };
  }

  const localTime = Math.max(0, curTime - (clip.startTime || 0));

  // Before or at first keyframe
  if (localTime <= kfs[0].time) {
    const t0 = kfs[0].transform || {};
    return {
      x: t0.x ?? baseT.x,
      y: t0.y ?? baseT.y,
      scale: t0.scale ?? baseT.scale,
      scaleX: t0.scaleX ?? baseT.scaleX ?? 1.0,
      scaleY: t0.scaleY ?? baseT.scaleY ?? 1.0,
      rotation: t0.rotation ?? baseT.rotation,
      rotateX: t0.rotateX ?? baseT.rotateX ?? 0,
      rotateY: t0.rotateY ?? baseT.rotateY ?? 0,
      skewX: t0.skewX ?? baseT.skewX ?? 0,
      skewY: t0.skewY ?? baseT.skewY ?? 0,
      perspective: t0.perspective ?? baseT.perspective ?? 800,
      opacity: kfs[0].opacity !== undefined ? kfs[0].opacity : baseT.opacity,
      flipX: t0.flipX !== undefined ? t0.flipX : baseT.flipX,
      flipY: t0.flipY !== undefined ? t0.flipY : baseT.flipY,
      mask: interpolatedMask,
    };
  }

  // After or at last keyframe
  if (localTime >= kfs[kfs.length - 1].time) {
    const last = kfs[kfs.length - 1];
    const tLast = last.transform || {};
    return {
      x: tLast.x ?? baseT.x,
      y: tLast.y ?? baseT.y,
      scale: tLast.scale ?? baseT.scale,
      scaleX: tLast.scaleX ?? baseT.scaleX ?? 1.0,
      scaleY: tLast.scaleY ?? baseT.scaleY ?? 1.0,
      rotation: tLast.rotation ?? baseT.rotation,
      rotateX: tLast.rotateX ?? baseT.rotateX ?? 0,
      rotateY: tLast.rotateY ?? baseT.rotateY ?? 0,
      skewX: tLast.skewX ?? baseT.skewX ?? 0,
      skewY: tLast.skewY ?? baseT.skewY ?? 0,
      perspective: tLast.perspective ?? baseT.perspective ?? 800,
      opacity: last.opacity !== undefined ? last.opacity : baseT.opacity,
      flipX: tLast.flipX !== undefined ? tLast.flipX : baseT.flipX,
      flipY: tLast.flipY !== undefined ? tLast.flipY : baseT.flipY,
      mask: interpolatedMask,
    };
  }

  // 1. High-Performance Native Rust / WebAssembly Evaluation with Hermite Ease
  const hasAdvancedProps = kfs.some(
    (k: any) =>
      k.easing ||
      k.transform?.rotateX ||
      k.transform?.rotateY ||
      k.transform?.skewX,
  );
  if (!hasAdvancedProps) {
    const rustInterp = rustCoreBridge.evaluateKeyframes(baseT, kfs, localTime);
    if (rustInterp) {
      return {
        x: rustInterp.x,
        y: rustInterp.y,
        scale: Math.max(0.1, Math.min(10.0, rustInterp.scale)),
        scaleX: baseT.scaleX,
        scaleY: baseT.scaleY,
        rotation: ((Math.round(rustInterp.rotation) % 360) + 360) % 360,
        rotateX: baseT.rotateX,
        rotateY: baseT.rotateY,
        skewX: baseT.skewX,
        skewY: baseT.skewY,
        perspective: baseT.perspective,
        opacity: Math.max(0, Math.min(1, rustInterp.opacity)),
        flipX: baseT.flipX,
        flipY: baseT.flipY,
        mask: interpolatedMask,
      };
    }
  }

  // 2. Fallback / Advanced Custom Easing Keyframe Loop
  for (let i = 0; i < kfs.length - 1; i++) {
    const k1 = kfs[i];
    const k2 = kfs[i + 1];
    if (localTime >= k1.time && localTime <= k2.time) {
      const span = k2.time - k1.time;
      const progress = span > 0 ? (localTime - k1.time) / span : 0;

      const easingType = (k1 as any).easing || (k2 as any).easing || "smooth";
      let ease = progress;
      if (easingType === "linear") {
        ease = progress;
      } else if (easingType === "easeIn") {
        ease = progress * progress * progress;
      } else if (easingType === "easeOut") {
        ease = 1 - Math.pow(1 - progress, 3);
      } else if (easingType === "easeInOut") {
        ease =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      } else if (easingType === "spring") {
        ease =
          1 +
          Math.sin(progress * Math.PI * 4) * Math.pow(1 - progress, 2) * 0.3;
      } else {
        // Hermite smoothstep cubic ease curve
        ease = progress * progress * (3 - 2 * progress);
      }

      const t1 = k1.transform || {};
      const t2 = k2.transform || {};
      const op1 = k1.opacity !== undefined ? k1.opacity : baseT.opacity;
      const op2 = k2.opacity !== undefined ? k2.opacity : baseT.opacity;

      const scale1 = t1.scale ?? baseT.scale;
      const scale2 = t2.scale ?? baseT.scale;
      const sx1 = t1.scaleX ?? baseT.scaleX ?? 1.0;
      const sx2 = t2.scaleX ?? baseT.scaleX ?? 1.0;
      const sy1 = t1.scaleY ?? baseT.scaleY ?? 1.0;
      const sy2 = t2.scaleY ?? baseT.scaleY ?? 1.0;
      const rx1 = t1.rotateX ?? baseT.rotateX ?? 0;
      const rx2 = t2.rotateX ?? baseT.rotateX ?? 0;
      const ry1 = t1.rotateY ?? baseT.rotateY ?? 0;
      const ry2 = t2.rotateY ?? baseT.rotateY ?? 0;
      const sk1 = t1.skewX ?? baseT.skewX ?? 0;
      const sk2 = t2.skewX ?? baseT.skewX ?? 0;
      const p1 = t1.perspective ?? baseT.perspective ?? 800;
      const p2 = t2.perspective ?? baseT.perspective ?? 800;
      const x1 = t1.x ?? baseT.x;
      const x2 = t2.x ?? baseT.x;
      const y1 = t1.y ?? baseT.y;
      const y2 = t2.y ?? baseT.y;
      const rot1 = t1.rotation ?? baseT.rotation;
      const rot2 = t2.rotation ?? baseT.rotation;

      // Calculate shortest rotational delta
      let rotDiff = (rot2 - rot1) % 360;
      if (rotDiff > 180) rotDiff -= 360;
      if (rotDiff < -180) rotDiff += 360;
      const interpolatedRot = (((rot1 + rotDiff * ease) % 360) + 360) % 360;

      return {
        x: x1 + (x2 - x1) * ease,
        y: y1 + (y2 - y1) * ease,
        scale: scale1 + (scale2 - scale1) * ease,
        scaleX: sx1 + (sx2 - sx1) * ease,
        scaleY: sy1 + (sy2 - sy1) * ease,
        rotation: interpolatedRot,
        rotateX: rx1 + (rx2 - rx1) * ease,
        rotateY: ry1 + (ry2 - ry1) * ease,
        skewX: sk1 + (sk2 - sk1) * ease,
        skewY: 0,
        perspective: p1 + (p2 - p1) * ease,
        opacity: op1 + (op2 - op1) * ease,
        flipX: t2.flipX !== undefined ? t2.flipX : (t1.flipX ?? baseT.flipX),
        flipY: t2.flipY !== undefined ? t2.flipY : (t1.flipY ?? baseT.flipY),
        mask: interpolatedMask,
      };
    }
  }

  return {
    ...baseT,
    mask: interpolatedMask,
  };
}

/**
 * Applies a transform change (from drag, scale, rotate) to a clip.
 * In pro editors (CapCut/Premiere):
 * - If the clip has NO keyframes, updates static base transform.
 * - If the clip HAS keyframes, updates existing keyframe at playhead OR auto-stamps keyframe at playhead.
 */
export function applyTransformUpdateToClip(
  clip: any,
  clipType: string,
  transform: { x: number; y: number; scale: number; rotation: number },
  currentTime: number = 0,
): any {
  if (!clip) return clip;

  const isVideoOrPhoto =
    clipType === "video" ||
    clipType === "photo" ||
    clip.type === "photo" ||
    clip.type === "video";

  const updatedTransform: ClipTransform = {
    ...(clip.transform || {}),
    x: transform.x,
    y: transform.y,
    scale: transform.scale,
    rotation: transform.rotation,
  };

  let updatedClip = {
    ...clip,
    scale: transform.scale,
    rotation: transform.rotation,
    transform: updatedTransform,
  };

  if (!isVideoOrPhoto) {
    updatedClip.position = { x: transform.x, y: transform.y };
  }

  // If clip has keyframes, update the active keyframe or auto-stamp at playhead
  if (
    clip.keyframes &&
    Array.isArray(clip.keyframes) &&
    clip.keyframes.length > 0
  ) {
    const localTime = Math.max(0, currentTime - (clip.startTime || 0));
    const kfs = cleanAndSortKeyframes(clip.keyframes);

    let closestIdx = 0;
    let minDiff = Math.abs(kfs[0].time - localTime);
    for (let i = 1; i < kfs.length; i++) {
      const diff = Math.abs(kfs[i].time - localTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    const keyframeTransform: ClipTransform = {
      ...(kfs[closestIdx]?.transform || {}),
      x: transform.x,
      y: transform.y,
      scale: transform.scale,
      rotation: transform.rotation,
    };

    if (minDiff <= 0.2) {
      // Update keyframe closest to playhead
      kfs[closestIdx] = {
        ...kfs[closestIdx],
        transform: keyframeTransform,
      };
    } else {
      // Auto-keyframe: user adjusted transform at a new time!
      kfs.push({
        time: Number(localTime.toFixed(3)),
        transform: keyframeTransform,
        opacity: clip.opacity ?? 1.0,
      });
    }

    updatedClip.keyframes = cleanAndSortKeyframes(kfs);
  }

  return updatedClip;
}

/**
 * Applies a mask update to a clip.
 * - If the clip has NO mask keyframes, updates static base mask.
 * - If the clip HAS mask keyframes, updates closest mask keyframe at playhead OR auto-stamps a new mask keyframe.
 */
export function applyMaskUpdateToClip(
  clip: any,
  newMask: MaskConfig,
  currentTime: number = 0,
): any {
  if (!clip) return clip;

  const rawMaskKfs = clip.maskKeyframes || clip.mask?.keyframes;
  const hasMaskKfs =
    rawMaskKfs &&
    Array.isArray(rawMaskKfs) &&
    rawMaskKfs.length > 0;

  if (hasMaskKfs) {
    const localTime = Math.max(0, currentTime - (clip.startTime || 0));
    // Always clone objects to prevent mutating cached instances
    const kfs = cleanAndSortMaskKeyframes(rawMaskKfs).map((k) => ({
      time: k.time,
      mask: { ...k.mask },
      easing: k.easing,
    }));

    let closestIdx = 0;
    let minDiff = Math.abs(kfs[0].time - localTime);
    for (let i = 1; i < kfs.length; i++) {
      const diff = Math.abs(kfs[i].time - localTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    if (minDiff <= 0.2) {
      // Update mask keyframe closest to playhead
      kfs[closestIdx] = {
        ...kfs[closestIdx],
        mask: { ...newMask },
      };
    } else {
      // Auto-keyframe: user adjusted mask at a new time!
      kfs.push({
        time: Number(localTime.toFixed(3)),
        mask: { ...newMask },
        easing: "easeInOut",
      });
    }

    const sorted = cleanAndSortMaskKeyframes(kfs);
    const updatedMask = {
      ...(clip.mask || {}),
      ...newMask,
      keyframes: sorted,
    };
    const updatedTransform: ClipTransform = {
      ...(clip.transform || {}),
      mask: updatedMask,
    };

    return {
      ...clip,
      maskKeyframes: sorted,
      mask: updatedMask,
      transform: updatedTransform,
    };
  }

  // Clip has no mask keyframes: update static base mask
  const updatedTransform: ClipTransform = {
    ...(clip.transform || {}),
    mask: newMask,
  };

  return {
    ...clip,
    mask: newMask,
    transform: updatedTransform,
  };
}

export interface ClipSearchResult {
  trackKey: string;
  index: number;
  clip: any;
}

/**
 * Universal clip resolver across all project tracks (video, overlay, text, captions, stickers, audio, effects).
 * Makes keyframes, transforms, and mutations effortlessly work for ANY feature without duplicated lookup logic.
 */
export function findClipInProject(
  project: FastArtProject | null | undefined,
  clipId: string | null | undefined,
  preferredType?: string,
): ClipSearchResult | null {
  if (!project || !project.tracks || !clipId) return null;

  // 1. Try preferred candidate tracks first
  if (preferredType) {
    const norm = preferredType.toLowerCase();
    const candidateKeys: string[] =
      norm === "caption" || norm === "captions"
        ? ["captions", "text"]
        : norm === "sticker" || norm === "stickers"
          ? ["stickers"]
          : norm === "text" || norm === "texts"
            ? ["text", "captions"]
            : norm === "overlay"
              ? ["overlay", "video"]
              : norm === "audio"
                ? ["audio"]
                : ["video", "overlay"];

    for (const key of candidateKeys) {
      const list = (project.tracks as any)[key];
      if (Array.isArray(list)) {
        const idx = list.findIndex((c: any) => c && c.id === clipId);
        if (idx !== -1) {
          return { trackKey: key, index: idx, clip: list[idx] };
        }
      }
    }
  }

  // 2. Comprehensive search across ALL project tracks
  const allKeys = ["video", "overlay", "text", "captions", "stickers", "audio", "effects", "filters"];
  for (const key of allKeys) {
    const list = (project.tracks as any)[key];
    if (Array.isArray(list)) {
      const idx = list.findIndex((c: any) => c && c.id === clipId);
      if (idx !== -1) {
        return { trackKey: key, index: idx, clip: list[idx] };
      }
    }
  }

  return null;
}

/**
 * Universal clip mutator in project tracks.
 * Seamlessly applies immutable updates to any clip on any track (video, text, captions, stickers, etc.).
 */
export function updateClipInProject(
  project: FastArtProject,
  clipId: string,
  mutator: (clip: any) => any,
  preferredType?: string,
): FastArtProject {
  const match = findClipInProject(project, clipId, preferredType);
  if (!match) return project;

  const { trackKey, index, clip } = match;
  const updatedClip = mutator(clip);
  const currentList = [...((project.tracks as any)[trackKey] || [])];
  currentList[index] = updatedClip;

  return {
    ...project,
    tracks: {
      ...project.tracks,
      [trackKey]: currentList,
    },
  };
}
