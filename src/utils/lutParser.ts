// FastArt .cube 3D LUT Parser & Color Transform Engine
import { CustomLutConfig } from '../types/project';

export interface ParsedCubeLut {
  title: string;
  size: number;
  data: Float32Array;
  cssFilter: string;
}

/**
 * High-Performance single-pass parser for Adobe / DaVinci Resolve .cube LUT file text content.
 * Avoids splitting hundreds of thousands of lines into JS strings, operating directly on indices
 * to prevent massive memory allocations and garbage collection pauses.
 */
export function parseCubeLut(textContent: string, fileName?: string): ParsedCubeLut {
  let title = fileName ? fileName.replace(/\.[^/.]+$/, "") : "Custom 3D LUT";
  let size = 33;
  
  // Fast first pass: look for TITLE and LUT_3D_SIZE in header without splitting entire string
  const headerLimit = Math.min(textContent.length, 4096);
  const headerSlice = textContent.slice(0, headerLimit);
  
  const titleMatch = headerSlice.match(/TITLE\s+["']?([^"'\r\n]+)["']?/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }
  
  const sizeMatch = headerSlice.match(/LUT_3D_SIZE\s+(\d+)/i);
  if (sizeMatch && sizeMatch[1]) {
    const s = parseInt(sizeMatch[1], 10);
    if (!isNaN(s) && s > 1) {
      size = s;
    }
  }

  // Pre-allocate typed array based on detected size (size^3 * 3 floats)
  const expectedFloats = size * size * size * 3;
  let data = new Float32Array(expectedFloats);
  let floatIndex = 0;

  // Single-pass scanner over characters
  const len = textContent.length;
  let i = 0;

  while (i < len) {
    // Skip leading whitespace / carriage returns / newlines
    while (i < len && (textContent.charCodeAt(i) <= 32)) {
      i++;
    }
    if (i >= len) break;

    // Check for comments or keywords
    const ch = textContent.charCodeAt(i);
    if (ch === 35 /* # */) {
      // Skip line
      while (i < len && textContent.charCodeAt(i) !== 10 /* \n */ && textContent.charCodeAt(i) !== 13 /* \r */) {
        i++;
      }
      continue;
    }

    // Check if line starts with a letter (keyword like DOMAIN_MIN, TITLE, etc.)
    if ((ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122) || ch === 95 /* _ */) {
      // Skip entire keyword line
      while (i < len && textContent.charCodeAt(i) !== 10 && textContent.charCodeAt(i) !== 13) {
        i++;
      }
      continue;
    }

    // Parse float number directly
    const startNum = i;
    while (i < len && textContent.charCodeAt(i) > 32) {
      i++;
    }
    const val = parseFloat(textContent.slice(startNum, i));
    if (!isNaN(val)) {
      if (floatIndex >= data.length) {
        // Expand if file had more entries than expected
        const expanded = new Float32Array(data.length * 2);
        expanded.set(data);
        data = expanded;
      }
      data[floatIndex++] = val;
    }
  }

  // Shrink to actual parsed floats if needed
  const finalData = floatIndex === data.length ? data : data.subarray(0, floatIndex);

  // Derive high-fidelity CSS canvas filter approximation from LUT samples
  const cssFilter = deriveCssFilterFromLut(finalData, size);

  return {
    title,
    size,
    data: finalData,
    cssFilter,
  };
}

/**
 * Derives optimal CSS canvas filter representation from sample points of a 3D LUT.
 */
function deriveCssFilterFromLut(data: Float32Array, size: number): string {
  if (data.length < 3) {
    return 'contrast(1.1) saturate(1.15)';
  }

  // Sample corner points: black (0,0,0), mid (0.5, 0.5, 0.5), white (1,1,1)
  const totalPoints = Math.floor(data.length / 3);
  const midIndex = Math.floor(totalPoints / 2) * 3;
  const endIndex = Math.max(0, totalPoints - 1) * 3;

  const rBlack = data[0] || 0;
  const gBlack = data[1] || 0;
  const bBlack = data[2] || 0;

  const rMid = data[midIndex] || 0.5;
  const gMid = data[midIndex + 1] || 0.5;
  const bMid = data[midIndex + 2] || 0.5;

  const rWhite = data[endIndex] || 1.0;
  const gWhite = data[endIndex + 1] || 1.0;
  const bWhite = data[endIndex + 2] || 1.0;

  // Approximate contrast from black-to-white spread
  const avgSpread = ((rWhite - rBlack) + (gWhite - gBlack) + (bWhite - bBlack)) / 3;
  const contrastVal = Math.max(0.7, Math.min(1.8, 1.0 + (1.0 - avgSpread) * 0.8));

  // Approximate brightness from mid tone
  const avgMid = (rMid + gMid + bMid) / 3;
  const brightnessVal = Math.max(0.8, Math.min(1.4, 0.7 + avgMid * 0.6));

  // Approximate warmth / hue shift
  const rBias = rMid - (gMid + bMid) / 2;
  const bBias = bMid - (rMid + gMid) / 2;

  let hueShift = 0;
  let sepia = 0;
  if (rBias > 0.04) {
    sepia = Math.min(0.5, rBias * 2.5);
  } else if (bBias > 0.04) {
    hueShift = Math.min(220, Math.floor(180 + bBias * 120));
  }

  const parts = [
    `contrast(${contrastVal.toFixed(2)})`,
    `brightness(${brightnessVal.toFixed(2)})`,
    `saturate(1.25)`,
  ];

  if (sepia > 0.05) {
    parts.push(`sepia(${sepia.toFixed(2)})`);
  }
  if (hueShift > 0) {
    parts.push(`hue-rotate(${hueShift}deg)`);
  }

  return parts.join(' ');
}

// Built-in Pro 3D LUT Presets
export const PRO_3D_LUTS: CustomLutConfig[] = [
  {
    id: 'lut_kodak_2383',
    name: 'Kodak 2383 Print',
    cssFilter: 'contrast(1.28) saturate(1.2) brightness(0.98) sepia(0.18)',
  },
  {
    id: 'lut_fuji_pro400h',
    name: 'Fuji Pro 400H',
    cssFilter: 'contrast(1.08) saturate(1.15) brightness(1.12) hue-rotate(350deg)',
  },
  {
    id: 'lut_bleach_bypass',
    name: 'Bleach Bypass',
    cssFilter: 'contrast(1.55) saturate(0.55) brightness(1.02)',
  },
  {
    id: 'lut_teal_orange_pop',
    name: 'Teal & Orange Pop',
    cssFilter: 'contrast(1.35) saturate(1.4) hue-rotate(15deg) sepia(0.12)',
  },
  {
    id: 'lut_noir_classic',
    name: 'Noir Classic B&W',
    cssFilter: 'contrast(1.45) saturate(0) brightness(0.95)',
  },
  {
    id: 'lut_warm_sunset',
    name: 'Golden Sunset',
    cssFilter: 'contrast(1.15) saturate(1.3) brightness(1.05) sepia(0.25)',
  },
  {
    id: 'lut_cyberpunk_neon',
    name: 'Cyberpunk Neon',
    cssFilter: 'contrast(1.4) saturate(1.6) hue-rotate(330deg)',
  },
  {
    id: 'lut_moody_forest',
    name: 'Moody Forest',
    cssFilter: 'contrast(1.22) saturate(0.85) brightness(0.92) hue-rotate(40deg)',
  },
];
