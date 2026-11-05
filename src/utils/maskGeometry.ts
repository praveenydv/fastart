import type { MaskConfig } from "../types/project";

// Two-tier cache:
// templateCache caches the inner SVG definition (defs + shapes) keyed by shape parameters
// fullSvgCache caches the assembled SVG string including translation and rotation
const templateCache = new Map<string, { defs: string; innerBody: string }>();
const fullSvgCache = new Map<string, string>();

export function getHeartPath(sx: number, sy: number): string {
  const x1 = (-28 * sx).toFixed(2);
  const y1 = (18 * sy).toFixed(2);
  const x2 = (-50 * sx).toFixed(2);
  const y2 = (-20 * sy).toFixed(2);
  const rx = (25 * Math.abs(sx)).toFixed(2);
  const ry = (25 * Math.abs(sy)).toFixed(2);
  const x3 = (50 * sx).toFixed(2);
  const x4 = (28 * sx).toFixed(2);
  const yBot = (44 * sy).toFixed(2);
  const yDip = (-20 * sy).toFixed(2);
  return `M 0,${yBot} C ${x1},${y1} ${x2},0 ${x2},${yDip} A ${rx},${ry} 0 0,1 0,${yDip} A ${rx},${ry} 0 0,1 ${x3},${yDip} C ${x3},0 ${x4},${y1} 0,${yBot} Z`;
}

export function getStarPath(sx: number, sy: number): string {
  return getStarPolyPath(50, 21, sx, sy);
}

export function getStarPolyPath(rOuter: number, rInner: number, sx: number, sy: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const x = (r * Math.cos(a) * sx).toFixed(2);
    const y = (r * Math.sin(a) * sy).toFixed(2);
    pts.push(`${x},${y}`);
  }
  return "M " + pts.join(" L ") + " Z";
}

function getRoundRectPath(w: number, h: number, r: number): string {
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.max(0, Math.min(r, hw, hh));
  if (rad <= 0.5) {
    return `M ${(-hw).toFixed(2)} ${(-hh).toFixed(2)} h ${w.toFixed(2)} v ${h.toFixed(2)} h ${(-w).toFixed(2)} Z`;
  }
  return `M ${(-hw + rad).toFixed(2)} ${(-hh).toFixed(2)} h ${(w - 2 * rad).toFixed(2)} a ${rad.toFixed(2)} ${rad.toFixed(2)} 0 0 1 ${rad.toFixed(2)} ${rad.toFixed(2)} v ${(h - 2 * rad).toFixed(2)} a ${rad.toFixed(2)} ${rad.toFixed(2)} 0 0 1 ${(-rad).toFixed(2)} ${rad.toFixed(2)} h ${(-(w - 2 * rad)).toFixed(2)} a ${rad.toFixed(2)} ${rad.toFixed(2)} 0 0 1 ${(-rad).toFixed(2)} ${(-rad).toFixed(2)} v ${(-(h - 2 * rad)).toFixed(2)} a ${rad.toFixed(2)} ${rad.toFixed(2)} 0 0 1 ${rad.toFixed(2)} ${(-rad).toFixed(2)} Z`;
}

/**
 * Quintic Hermite Smootherstep:
 * alpha(u) = 6u^5 - 15u^4 + 10u^3
 * Ensures both first derivative (alpha' = 0) and second derivative (alpha'' = 0)
 * at boundaries u = 0 and u = 1.
 * Completely eliminates Mach band hairlines and edge cutoffs.
 */
function smootherstep(u: number): number {
  const x = Math.max(0, Math.min(1, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Build the canonical alpha-mask SVG with true bidirectional (inside + outside)
 * hardware-accelerated softness across Web, Android, and iOS.
 */
export function buildMaskSvg(
  mask: MaskConfig,
  width: number,
  height: number,
): string | null {
  const shape = mask.shape;
  if (!shape || shape === "none" || width <= 0 || height <= 0) return null;

  const feather = Math.max(0, Math.min(100, mask.feather ?? 0));
  const minDim = Math.min(width, height);
  const hasSoftness = feather > 0.5;

  const effW = mask.width ?? mask.size ?? 60;
  const effH = mask.height ?? mask.size ?? 60;
  const cx = width / 2 + ((mask.x ?? 0) / 100) * width;
  const cy = height / 2 + ((mask.y ?? 0) / 100) * height;
  const rotation = mask.rotation ?? 0;
  const roundness = Math.max(0, mask.roundness ?? 16);
  const inverted = !!mask.inverted;

  const fullKey = `${shape}:${width}:${height}:${effW}:${effH}:${cx.toFixed(1)}:${cy.toFixed(1)}:${rotation}:${roundness}:${feather}:${inverted}`;
  const fullCached = fullSvgCache.get(fullKey);
  if (fullCached) return fullCached;

  const templateKey = `${shape}:${width}:${height}:${effW}:${effH}:${roundness}:${feather}:${inverted}`;
  let template = templateCache.get(templateKey);

  if (!template) {
    const extent = Math.max(width, height) * 3;
    let defs = "";
    let innerBody = "";

    if (shape === "linear") {
      if (!hasSoftness) {
        innerBody = `<rect x="${-extent}" y="${inverted ? -extent : 0}" width="${extent * 2}" height="${extent}" fill="white" />`;
      } else {
        // Linear Split Line: S-curve Hermite falloff with 24 stops
        // alpha(u) glides smoothly into 0.0 at -fDist and into 1.0 at +fDist.
        // Single infinite quad spanning [-extent, +extent]: ZERO seams or lines!
        const fDist = Math.max(4, (feather / 100) * (minDim * 0.45));
        const gradId = `lgrad_${Math.round(feather)}_${inverted ? 1 : 0}`;
        const stops: string[] = [];
        const numStops = 24;
        for (let i = 0; i <= numStops; i++) {
          const u = i / numStops;
          const pct = (u * 100).toFixed(2);
          const alpha = smootherstep(u);
          const finalAlpha = inverted ? 1 - alpha : alpha;
          stops.push(`<stop offset="${pct}%" stop-color="white" stop-opacity="${finalAlpha.toFixed(4)}" />`);
        }
        defs = `
          <linearGradient id="${gradId}" x1="0" y1="${(-fDist).toFixed(2)}" x2="0" y2="${fDist.toFixed(2)}" gradientUnits="userSpaceOnUse" spreadMethod="pad">
            ${stops.join("\n")}
          </linearGradient>
        `;
        innerBody = `<rect x="${-extent}" y="${-extent}" width="${extent * 2}" height="${extent * 2}" fill="url(#${gradId})" />`;
      }
    } else if (shape === "mirror") {
      const bandH = Math.max(4, (height * effH) / 100);
      const halfH = bandH / 2;

      if (!hasSoftness) {
        if (!inverted) {
          innerBody = `<rect x="${-extent}" y="${-halfH}" width="${extent * 2}" height="${bandH}" fill="white" />`;
        } else {
          innerBody = `<path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z M ${-extent} ${-halfH} H ${extent} V ${halfH} H ${-extent} Z" fill="white" fill-rule="evenodd" />`;
        }
      } else {
        // Mirror Band: Exact mathematical boundaries
        // Top feather from yTopOut (-halfH - fDist) to -halfH
        // Solid center band from -halfH to +halfH
        // Bottom feather from +halfH to yBotOut (+halfH + fDist)
        const fDist = Math.max(4, (feather / 100) * (minDim * 0.35));
        const gradId = `mgrad_${Math.round(halfH)}_${Math.round(feather)}_${inverted ? 1 : 0}`;

        const yTopOut = -halfH - fDist;
        const yBotOut = halfH + fDist;
        const totalSpan = yBotOut - yTopOut; // = 2 * halfH + 2 * fDist

        const p1 = (fDist / totalSpan) * 100; // top feather end / solid band start
        const p2 = 100 - p1;                  // solid band end / bottom feather start

        const a = (alpha: number) => (inverted ? (1 - alpha).toFixed(4) : alpha.toFixed(4));
        const stops: string[] = [];
        const numStops = 16;

        // 1. Top feather zone (0% to p1%): alpha goes from 0.0 to 1.0 with smootherstep
        for (let i = 0; i <= numStops; i++) {
          const u = i / numStops;
          const pct = (u * p1).toFixed(3);
          const alpha = smootherstep(u);
          stops.push(`<stop offset="${pct}%" stop-color="white" stop-opacity="${a(alpha)}" />`);
        }

        // 2. Solid center band (p1% to p2%): alpha is 1.0
        stops.push(`<stop offset="${p2.toFixed(3)}%" stop-color="white" stop-opacity="${a(1.0)}" />`);

        // 3. Bottom feather zone (p2% to 100%): alpha goes from 1.0 to 0.0 with smootherstep
        for (let i = 1; i <= numStops; i++) {
          const u = i / numStops;
          const pct = (p2 + u * (100 - p2)).toFixed(3);
          const alpha = 1 - smootherstep(u);
          stops.push(`<stop offset="${pct}%" stop-color="white" stop-opacity="${a(alpha)}" />`);
        }

        defs = `
          <linearGradient id="${gradId}" x1="0" y1="${yTopOut.toFixed(2)}" x2="0" y2="${yBotOut.toFixed(2)}" gradientUnits="userSpaceOnUse" spreadMethod="pad">
            ${stops.join("\n")}
          </linearGradient>
        `;
        innerBody = `<rect x="${-extent}" y="${-extent}" width="${extent * 2}" height="${extent * 2}" fill="url(#${gradId})" />`;
      }
    } else if (shape === "circle") {
      const rx = Math.max(2, (minDim * effW) / 200);
      const ry = Math.max(2, (minDim * effH) / 200);

      if (!hasSoftness) {
        if (!inverted) {
          innerBody = `<ellipse cx="0" cy="0" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="white"/>`;
        } else {
          innerBody = `<path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z M ${rx.toFixed(2)} 0 A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(-rx).toFixed(2)} 0 A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${rx.toFixed(2)} 0 Z" fill="white" fill-rule="evenodd"/>`;
        }
      } else {
        const fDist = (feather / 100) * (minDim * 0.35);
        const outerRx = rx + fDist;
        const outerRy = ry + fDist;
        const innerRx = Math.max(0, rx - fDist);

        const gradId = `cgrad_${Math.round(rx)}_${Math.round(ry)}_${Math.round(feather)}_${inverted ? 1 : 0}`;
        const innerPct = (innerRx / outerRx) * 100;
        const range = 100 - innerPct;

        const a = (alpha: number) => (inverted ? (1 - alpha).toFixed(4) : alpha.toFixed(4));
        const stops: string[] = [];
        stops.push(`<stop offset="0%" stop-color="white" stop-opacity="${a(1.0)}" />`);
        stops.push(`<stop offset="${innerPct.toFixed(2)}%" stop-color="white" stop-opacity="${a(1.0)}" />`);

        const numStops = 20;
        for (let i = 1; i <= numStops; i++) {
          const u = i / numStops;
          const pct = (innerPct + u * range).toFixed(3);
          const alpha = 1 - smootherstep(u);
          stops.push(`<stop offset="${pct}%" stop-color="white" stop-opacity="${a(alpha)}" />`);
        }

        defs = `
          <radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">
            ${stops.join("\n")}
          </radialGradient>
        `;

        if (!inverted) {
          innerBody = `<ellipse cx="0" cy="0" rx="${outerRx.toFixed(2)}" ry="${outerRy.toFixed(2)}" fill="url(#${gradId})"/>`;
        } else {
          innerBody = `
            <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z" fill="white"/>
            <ellipse cx="0" cy="0" rx="${outerRx.toFixed(2)}" ry="${outerRy.toFixed(2)}" fill="url(#${gradId})"/>
          `;
        }
      }
    } else if (shape === "rectangle") {
      const rw = (width * effW) / 100;
      const rh = (height * effH) / 100;
      const radius = Math.min(roundness, rw / 2, rh / 2);

      if (!hasSoftness) {
        if (!inverted) {
          innerBody = `<rect x="${(-rw / 2).toFixed(2)}" y="${(-rh / 2).toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" rx="${radius.toFixed(2)}" fill="white"/>`;
        } else {
          innerBody = `<path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z M ${(-rw / 2).toFixed(2)} ${(-rh / 2).toFixed(2)} h ${rw.toFixed(2)} v ${rh.toFixed(2)} h ${(-rw).toFixed(2)} Z" fill="white" fill-rule="evenodd"/>`;
        }
      } else {
        // High-density subpixel Hermite smootherstep sampling (80 steps)
        // Step width is ~0.5px (subpixel), completely eliminating visible chips/bands
        const fDist = (feather / 100) * (minDim * 0.35);
        const f = Math.min(Math.min(rw, rh) * 0.45, fDist);
        const inW = Math.max(0, rw - 2 * f);
        const inH = Math.max(0, rh - 2 * f);
        const inR = Math.max(0, radius - f);
        const outW = rw + 2 * f;
        const outH = rh + 2 * f;
        const outR = radius + f;

        const steps = 80;
        if (!inverted) {
          let rectLayers = "";
          for (let k = 1; k <= steps; k++) {
            const u = 1 - k / steps; // 1 at outer boundary, 0 at inner boundary
            const curW = inW + (outW - inW) * u;
            const curH = inH + (outH - inH) * u;
            const curR = inR + (outR - inR) * u;

            const targetAlpha = 1 - smootherstep(u);
            const prevAlpha = k === 1 ? 0 : 1 - smootherstep(1 - (k - 1) / steps);
            const layerAlpha = Math.max(0, Math.min(1, (targetAlpha - prevAlpha) / (1 - prevAlpha)));

            if (layerAlpha > 0.0001) {
              rectLayers += `<rect x="${(-curW / 2).toFixed(2)}" y="${(-curH / 2).toFixed(2)}" width="${curW.toFixed(2)}" height="${curH.toFixed(2)}" rx="${curR.toFixed(2)}" fill="white" fill-opacity="${layerAlpha.toFixed(4)}" />\n`;
            }
          }
          innerBody = `
            ${rectLayers}
            ${inW > 0 && inH > 0 ? `<rect x="${(-inW / 2).toFixed(2)}" y="${(-inH / 2).toFixed(2)}" width="${inW.toFixed(2)}" height="${inH.toFixed(2)}" rx="${inR.toFixed(2)}" fill="white" />` : ""}
          `;
        } else {
          let invLayers = "";
          for (let k = 1; k <= steps; k++) {
            const u = k / steps; // 0 at inner boundary, 1 at outer boundary
            const curW = inW + (outW - inW) * u;
            const curH = inH + (outH - inH) * u;
            const curR = inR + (outR - inR) * u;

            const targetAlpha = smootherstep(u);
            const prevAlpha = k === 1 ? 0 : smootherstep((k - 1) / steps);
            const layerAlpha = Math.max(0, Math.min(1, (targetAlpha - prevAlpha) / (1 - prevAlpha)));

            if (layerAlpha > 0.0001) {
              invLayers += `<path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getRoundRectPath(curW, curH, curR)}" fill="white" fill-rule="evenodd" fill-opacity="${layerAlpha.toFixed(4)}" />\n`;
            }
          }
          innerBody = `
            ${invLayers}
            <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getRoundRectPath(outW, outH, outR)}" fill="white" fill-rule="evenodd"/>
          `;
        }
      }
    } else if (shape === "heart") {
      const hw = Math.max(1, (minDim * effW) / 100);
      const hh = Math.max(1, (minDim * effH) / 100);
      const baseScaleX = hw / 100;
      const baseScaleY = hh / 100;

      if (!hasSoftness) {
        if (!inverted) {
          innerBody = `<path d="${getHeartPath(baseScaleX, baseScaleY)}" fill="white"/>`;
        } else {
          innerBody = `<path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getHeartPath(baseScaleX, baseScaleY)}" fill="white" fill-rule="evenodd"/>`;
        }
      } else {
        // High-density subpixel Hermite smootherstep sampling (80 steps)
        // Eliminates stepped terraces and produces a continuous smooth gradient
        const fDist = (feather / 100) * (minDim * 0.35);
        const basePxX = Math.max(1, (minDim * effW) / 200);
        const fRatio = Math.min(0.55, fDist / (basePxX * 1.5));

        const inScaleX = baseScaleX * (1 - fRatio);
        const inScaleY = baseScaleY * (1 - fRatio);
        const outScaleX = baseScaleX * (1 + fRatio);
        const outScaleY = baseScaleY * (1 + fRatio);

        const steps = 80;
        if (!inverted) {
          let heartLayers = "";
          for (let k = 1; k <= steps; k++) {
            const u = 1 - k / steps;
            const sX = inScaleX + (outScaleX - inScaleX) * u;
            const sY = inScaleY + (outScaleY - inScaleY) * u;

            const targetAlpha = 1 - smootherstep(u);
            const prevAlpha = k === 1 ? 0 : 1 - smootherstep(1 - (k - 1) / steps);
            const layerAlpha = Math.max(0, Math.min(1, (targetAlpha - prevAlpha) / (1 - prevAlpha)));

            if (layerAlpha > 0.0001) {
              heartLayers += `<path d="${getHeartPath(sX, sY)}" fill="white" fill-opacity="${layerAlpha.toFixed(4)}" />\n`;
            }
          }
          innerBody = `
            ${heartLayers}
            ${inScaleX > 0.01 && inScaleY > 0.01 ? `<path d="${getHeartPath(inScaleX, inScaleY)}" fill="white" />` : ""}
          `;
        } else {
          let invLayers = "";
          for (let k = 1; k <= steps; k++) {
            const u = k / steps;
            const sX = inScaleX + (outScaleX - inScaleX) * u;
            const sY = inScaleY + (outScaleY - inScaleY) * u;

            const targetAlpha = smootherstep(u);
            const prevAlpha = k === 1 ? 0 : smootherstep((k - 1) / steps);
            const layerAlpha = Math.max(0, Math.min(1, (targetAlpha - prevAlpha) / (1 - prevAlpha)));

            if (layerAlpha > 0.0001) {
              invLayers += `<path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getHeartPath(sX, sY)}" fill="white" fill-rule="evenodd" fill-opacity="${layerAlpha.toFixed(4)}" />\n`;
            }
          }
          innerBody = `
            ${invLayers}
            <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getHeartPath(outScaleX, outScaleY)}" fill="white" fill-rule="evenodd" />
          `;
        }
      }
    } else if (shape === "star") {
      const sw = Math.max(1, (minDim * effW) / 100);
      const sh = Math.max(1, (minDim * effH) / 100);
      const baseScaleX = sw / 100;
      const baseScaleY = sh / 100;

      if (!hasSoftness) {
        if (!inverted) {
          innerBody = `<path d="${getStarPath(baseScaleX, baseScaleY)}" fill="white"/>`;
        } else {
          innerBody = `<path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getStarPath(baseScaleX, baseScaleY)}" fill="white" fill-rule="evenodd"/>`;
        }
      } else {
        // Exact trigonometric perpendicular edge offset:
        // When edges shift perpendicularly by distance d:
        // Tip (convex angle) shifts radially by 2.855 * d
        // Notch (concave angle) shifts radially by 1.199 * d
        // This ensures the feather width is 100% uniform across every arm and notch.
        const fDist = (feather / 100) * (minDim * 0.35);
        const baseROuter = 50;
        const baseRInner = 21;
        const unitPixels = Math.max(0.1, baseScaleX);
        const fUnits = fDist / unitPixels;
        // Maximum inward offset so the notch (21) preserves a clean solid star core
        const dMax = Math.min(13.5, Math.max(0.5, fUnits / 2.855));

        const inROuter = Math.max(8, baseROuter - 2.855 * dMax);
        const inRInner = Math.max(3, baseRInner - 1.199 * dMax);
        const outROuter = baseROuter + 2.855 * dMax;
        const outRInner = baseRInner + 1.199 * dMax;

        const steps = 80;
        if (!inverted) {
          let starLayers = "";
          for (let k = 1; k <= steps; k++) {
            const u = 1 - k / steps;
            const rOuter = inROuter + (outROuter - inROuter) * u;
            const rInner = inRInner + (outRInner - inRInner) * u;

            const targetAlpha = 1 - smootherstep(u);
            const prevAlpha = k === 1 ? 0 : 1 - smootherstep(1 - (k - 1) / steps);
            const layerAlpha = Math.max(0, Math.min(1, (targetAlpha - prevAlpha) / (1 - prevAlpha)));

            if (layerAlpha > 0.0001) {
              starLayers += `<path d="${getStarPolyPath(rOuter, rInner, baseScaleX, baseScaleY)}" fill="white" fill-opacity="${layerAlpha.toFixed(4)}" />\n`;
            }
          }
          innerBody = `
            ${starLayers}
            ${inROuter > 0.5 ? `<path d="${getStarPolyPath(inROuter, inRInner, baseScaleX, baseScaleY)}" fill="white" />` : ""}
          `;
        } else {
          let invLayers = "";
          for (let k = 1; k <= steps; k++) {
            const u = k / steps;
            const rOuter = inROuter + (outROuter - inROuter) * u;
            const rInner = inRInner + (outRInner - inRInner) * u;

            const targetAlpha = smootherstep(u);
            const prevAlpha = k === 1 ? 0 : smootherstep((k - 1) / steps);
            const layerAlpha = Math.max(0, Math.min(1, (targetAlpha - prevAlpha) / (1 - prevAlpha)));

            if (layerAlpha > 0.0001) {
              invLayers += `<path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getStarPolyPath(rOuter, rInner, baseScaleX, baseScaleY)}" fill="white" fill-rule="evenodd" fill-opacity="${layerAlpha.toFixed(4)}" />\n`;
            }
          }
          innerBody = `
            ${invLayers}
            <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getStarPolyPath(outROuter, outRInner, baseScaleX, baseScaleY)}" fill="white" fill-rule="evenodd" />
          `;
        }
      }
    }

    template = { defs, innerBody };
    if (templateCache.size > 256) templateCache.clear();
    templateCache.set(templateKey, template);
  }

  const transform = `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${rotation})`;
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${template.defs}</defs><g transform="${transform}">${template.innerBody}</g></svg>`;

  if (fullSvgCache.size > 256) fullSvgCache.clear();
  fullSvgCache.set(fullKey, fullSvg);

  return fullSvg;
}

export function maskSvgDataUri(mask: MaskConfig, width: number, height: number): string | null {
  const svg = buildMaskSvg(mask, width, height);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
