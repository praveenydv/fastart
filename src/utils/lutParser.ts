// FastArt .cube 3D LUT Parser & Color Transform Engine
import { CustomLutConfig } from '../types/project';

export interface ParsedCubeLut {
  title: string;
  size: number;
  data: Float32Array;
  cssFilter: string;
}

/**
 * Parses Adobe / DaVinci Resolve .cube LUT file text content.
 */
export function parseCubeLut(textContent: string, fileName?: string): ParsedCubeLut {
  const lines = textContent.split(/\r?\n/);
  let title = fileName ? fileName.replace(/\.[^/.]+$/, "") : "Custom 3D LUT";
  let size = 33;
  const values: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('#')) continue;

    const upper = rawLine.toUpperCase();
    if (upper.startsWith('TITLE')) {
      const match = rawLine.match(/TITLE\s+["']?([^"'\n\r]+)["']?/i);
      if (match && match[1]) {
        title = match[1].trim();
      }
      continue;
    }

    if (upper.startsWith('LUT_3D_SIZE')) {
      const parts = rawLine.split(/\s+/);
      if (parts.length >= 2) {
        const parsedSize = parseInt(parts[1], 10);
        if (!isNaN(parsedSize) && parsedSize > 1) {
          size = parsedSize;
        }
      }
      continue;
    }

    if (upper.startsWith('DOMAIN_MIN') || upper.startsWith('DOMAIN_MAX')) {
      continue;
    }

    // Parse RGB float triples
    const tokens = rawLine.split(/\s+/);
    if (tokens.length >= 3) {
      const r = parseFloat(tokens[0]);
      const g = parseFloat(tokens[1]);
      const b = parseFloat(tokens[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        values.push(r, g, b);
      }
    }
  }

  const data = new Float32Array(values);

  // Derive high-fidelity CSS canvas filter approximation from LUT samples
  const cssFilter = deriveCssFilterFromLut(data, size);

  return {
    title,
    size,
    data,
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
    id: 'lut_teal_orange_film',
    name: 'Hollywood 35mm',
    cssFilter: 'contrast(1.35) saturate(1.4) hue-rotate(18deg) brightness(1.04)',
  },
];
