// FastArt 8-Channel Selective HSL Color Grading Engine
import { HSLAdjustments, HSLColorChannel, HSLChannelConfig } from '../types/project';

export interface ChannelMetrics {
  id: HSLColorChannel;
  name: string;
  centerHue: number; // degrees 0..360
  weight: number;
}

export const HSL_CHANNEL_METRICS: Record<HSLColorChannel, ChannelMetrics> = {
  red: { id: 'red', name: 'Red', centerHue: 0, weight: 0.16 },
  orange: { id: 'orange', name: 'Orange', centerHue: 30, weight: 0.12 },
  yellow: { id: 'yellow', name: 'Yellow', centerHue: 60, weight: 0.18 },
  green: { id: 'green', name: 'Green', centerHue: 120, weight: 0.22 },
  cyan: { id: 'cyan', name: 'Cyan', centerHue: 180, weight: 0.12 },
  blue: { id: 'blue', name: 'Blue', centerHue: 240, weight: 0.10 },
  purple: { id: 'purple', name: 'Purple', centerHue: 275, weight: 0.05 },
  magenta: { id: 'magenta', name: 'Magenta', centerHue: 315, weight: 0.05 },
};

/**
 * Checks whether any HSL channel has a non-zero adjustment.
 */
export function isHslActive(adjustments?: HSLAdjustments): boolean {
  if (!adjustments) return false;
  return Object.values(adjustments).some(
    (cfg) => cfg && (cfg.hue !== 0 || cfg.saturation !== 0 || cfg.luminance !== 0)
  );
}

/**
 * Derives a hardware-accelerated CSS filter string from active 8-channel HSL adjustments
 * for 60fps real-time Canvas 2D and Web preview playback.
 */
export function buildHslCssFilter(adjustments?: HSLAdjustments): string {
  if (!adjustments || !isHslActive(adjustments)) {
    return '';
  }

  let totalWeight = 0;
  let weightedHue = 0;
  let weightedSat = 0;
  let weightedLum = 0;

  let maxSatAbs = 0;
  let maxLumAbs = 0;
  let maxHueAbs = 0;
  let dominantSat = 0;
  let dominantLum = 0;
  let dominantHue = 0;

  for (const [key, cfg] of Object.entries(adjustments)) {
    if (!cfg) continue;
    const channelKey = key as HSLColorChannel;
    const metric = HSL_CHANNEL_METRICS[channelKey];
    if (!metric) continue;

    const h = cfg.hue || 0;
    const s = cfg.saturation || 0;
    const l = cfg.luminance || 0;

    if (h === 0 && s === 0 && l === 0) continue;

    const w = metric.weight;
    totalWeight += w;
    weightedHue += h * w;
    weightedSat += s * w;
    weightedLum += l * w;

    if (Math.abs(s) > maxSatAbs) {
      maxSatAbs = Math.abs(s);
      dominantSat = s;
    }
    if (Math.abs(l) > maxLumAbs) {
      maxLumAbs = Math.abs(l);
      dominantLum = l;
    }
    if (Math.abs(h) > maxHueAbs) {
      maxHueAbs = Math.abs(h);
      dominantHue = h;
    }
  }

  if (totalWeight <= 0) {
    return '';
  }

  // Blend weighted average with dominant channel to maintain sensitivity even when single channel is moved
  const avgHue = weightedHue / totalWeight;
  const avgSat = weightedSat / totalWeight;
  const avgLum = weightedLum / totalWeight;

  const effectiveHue = avgHue * 0.65 + dominantHue * 0.35;
  const effectiveSat = avgSat * 0.60 + dominantSat * 0.40;
  const effectiveLum = avgLum * 0.65 + dominantLum * 0.35;

  const filterParts: string[] = [];

  // 1. Hue Rotation
  if (Math.abs(effectiveHue) >= 0.5) {
    filterParts.push(`hue-rotate(${effectiveHue.toFixed(1)}deg)`);
  }

  // 2. Saturation
  const satMultiplier = Math.max(0.0, Math.min(3.5, 1.0 + (effectiveSat / 100) * 1.35));
  if (Math.abs(satMultiplier - 1.0) >= 0.015) {
    filterParts.push(`saturate(${satMultiplier.toFixed(3)})`);
  }

  // 3. Brightness / Luminance
  const brightMultiplier = Math.max(0.15, Math.min(2.5, 1.0 + (effectiveLum / 100) * 0.85));
  if (Math.abs(brightMultiplier - 1.0) >= 0.015) {
    filterParts.push(`brightness(${brightMultiplier.toFixed(3)})`);
  }

  // 4. Contrast compensation when high saturation or luminance changes occur
  if (Math.abs(effectiveLum) > 20 || Math.abs(effectiveSat) > 35) {
    const contrastVal = Math.max(0.8, Math.min(1.4, 1.0 + (effectiveLum / 100) * 0.25));
    if (Math.abs(contrastVal - 1.0) >= 0.02) {
      filterParts.push(`contrast(${contrastVal.toFixed(3)})`);
    }
  }

  return filterParts.join(' ');
}

/**
 * Fast RGB to HSL conversion (normalized [0..1] range)
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const d = max - min;
  const l = (max + min) / 2;

  if (d < 1e-5) {
    return [0, 0, l];
  }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === rf) {
    h = (gf - bf) / d + (gf < bf ? 6 : 0);
  } else if (max === gf) {
    h = (bf - rf) / d + 2;
  } else {
    h = (rf - gf) / d + 4;
  }
  h *= 60; // 0..360

  return [h, s, l];
}

/**
 * Fast HSL to RGB conversion ([0..255] byte range)
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s < 1e-5) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (((h % 360) + 360) % 360) / 360;

  const hue2rgb = (t: number) => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };

  return [
    Math.round(Math.max(0, Math.min(255, hue2rgb(hk + 1 / 3) * 255))),
    Math.round(Math.max(0, Math.min(255, hue2rgb(hk) * 255))),
    Math.round(Math.max(0, Math.min(255, hue2rgb(hk - 1 / 3) * 255))),
  ];
}

const ORDERED_CHANNELS: { id: HSLColorChannel; center: number }[] = [
  { id: 'red', center: 0 },
  { id: 'orange', center: 30 },
  { id: 'yellow', center: 60 },
  { id: 'green', center: 120 },
  { id: 'cyan', center: 180 },
  { id: 'blue', center: 240 },
  { id: 'purple', center: 275 },
  { id: 'magenta', center: 315 },
  { id: 'red', center: 360 }, // wrap-around for smooth red interpolation
];

/**
 * Applies exact pixel-accurate 8-channel selective HSL color grading directly to an ImageData buffer.
 * Used for precise offline rendering and high-quality snapshots.
 */
export function applyHslToImageData(imageData: ImageData, adjustments: HSLAdjustments): void {
  if (!isHslActive(adjustments)) return;

  const data = imageData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [h, s, l] = rgbToHsl(r, g, b);

    // Find the two adjacent channel centers surrounding hue h
    let c1 = ORDERED_CHANNELS[0];
    let c2 = ORDERED_CHANNELS[1];

    for (let k = 0; k < ORDERED_CHANNELS.length - 1; k++) {
      if (h >= ORDERED_CHANNELS[k].center && h <= ORDERED_CHANNELS[k + 1].center) {
        c1 = ORDERED_CHANNELS[k];
        c2 = ORDERED_CHANNELS[k + 1];
        break;
      }
    }

    const span = c2.center - c1.center;
    const factor2 = span > 0 ? (h - c1.center) / span : 0;
    const factor1 = 1 - factor2;

    const cfg1 = adjustments[c1.id] || { hue: 0, saturation: 0, luminance: 0 };
    const cfg2 = adjustments[c2.id] || { hue: 0, saturation: 0, luminance: 0 };

    const deltaHue = (cfg1.hue || 0) * factor1 + (cfg2.hue || 0) * factor2;
    const deltaSat = (cfg1.saturation || 0) * factor1 + (cfg2.saturation || 0) * factor2;
    const deltaLum = (cfg1.luminance || 0) * factor1 + (cfg2.luminance || 0) * factor2;

    if (deltaHue === 0 && deltaSat === 0 && deltaLum === 0) {
      continue;
    }

    const newH = ((h + deltaHue) % 360 + 360) % 360;
    const newS = Math.max(0, Math.min(1, s * (1 + deltaSat / 100)));
    const lumFactor = 1 - Math.abs(2 * l - 1);
    const newL = Math.max(0, Math.min(1, l + (deltaLum / 100) * lumFactor));

    const [outR, outG, outB] = hslToRgb(newH, newS, newL);
    data[i] = outR;
    data[i + 1] = outG;
    data[i + 2] = outB;
  }
}
