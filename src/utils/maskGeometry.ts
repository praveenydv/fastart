import type { MaskConfig } from "../types/project";

const svgCache = new Map<string, string>();

/** Build the canonical alpha-mask SVG used by CSS on web and SvgXml on native. */
export function buildMaskSvg(
  mask: MaskConfig,
  width: number,
  height: number,
  native = false,
): string | null {
  const shape = mask.shape;
  if (!shape || shape === "none" || width <= 0 || height <= 0) return null;

  const feather = Math.max(0, Math.min(80, mask.feather ?? 0));
  const targetBlur = feather * (Math.min(width, height) / 100) * 0.5;
  // Android's SVG blur implementation clamps large radii. Render the mask in
  // a proportionally smaller coordinate plane and scale it back up so the
  // filter stays below that limit while preserving its full on-screen radius.
  // A single Gaussian filter gives a continuous opacity falloff; approximating
  // it with a stack of strokes produces visible bands at high softness values.
  const nativeScale = native && targetBlur > 20 ? Math.ceil(targetBlur / 20) : 1;
  const geometryWidth = width / nativeScale;
  const geometryHeight = height / nativeScale;
  const effW = mask.width ?? mask.size ?? 60;
  const effH = mask.height ?? mask.size ?? 60;
  const minDim = Math.min(geometryWidth, geometryHeight);
  const cx = geometryWidth / 2 + ((mask.x ?? 0) / 100) * geometryWidth;
  const cy = geometryHeight / 2 + ((mask.y ?? 0) / 100) * geometryHeight;
  const rotation = mask.rotation ?? 0;
  const roundness = Math.max(0, (mask.roundness ?? 16) / nativeScale);
  const key = `${shape}:${width}:${height}:${effW}:${effH}:${cx}:${cy}:${rotation}:${roundness}:${feather}:${!!mask.inverted}:${native}`;
  const cached = svgCache.get(key);
  if (cached) return cached;

  let body: string;
  const transform = `translate(${cx} ${cy}) rotate(${rotation})`;
  if (shape === "circle") {
    const rx = Math.max(1, (minDim * effW) / 200);
    const ry = Math.max(1, (minDim * effH) / 200);
    body = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotation} ${cx} ${cy})"/>`;
  } else if (shape === "rectangle") {
    const rw = (geometryWidth * effW) / 100;
    const rh = (geometryHeight * effH) / 100;
    const radius = Math.min(roundness, rw / 2, rh / 2);
    body = `<rect x="${-rw / 2}" y="${-rh / 2}" width="${rw}" height="${rh}" rx="${radius}" transform="${transform}"/>`;
  } else if (shape === "linear") {
    const extent = Math.max(geometryWidth, geometryHeight) * 5;
    body = `<path d="M ${-extent} 0 H ${extent} V ${extent} H ${-extent} Z" transform="${transform}"/>`;
  } else if (shape === "mirror") {
    const bandH = Math.max(2 / nativeScale, (geometryHeight * effH) / 100);
    const extent = Math.max(geometryWidth, geometryHeight) * 5;
    body = `<rect x="${-extent}" y="${-bandH / 2}" width="${extent * 2}" height="${bandH}" transform="${transform}"/>`;
  } else if (shape === "heart") {
    const hw = Math.max(1, (minDim * effW) / 100);
    const hh = Math.max(1, (minDim * effH) / 100);
    // Match the exact 0..100 preview path in PlayerMaskOverlay.
    body = `<path d="M 50 96 C 22 72 0 56 0 40 A 25 25 0 0 1 50 40 A 25 25 0 0 1 100 40 C 100 56 78 72 50 96 Z" transform="${transform} translate(${-hw / 2} ${-hh / 2}) scale(${hw / 100} ${hh / 100})"/>`;
  } else if (shape === "star") {
    const sx = Math.max(0.01, (minDim * effW) / 200);
    const sy = Math.max(0.01, (minDim * effH) / 200);
    // Use the same vertices as the mobile and web manipulation outline.
    const points = "50,2 63,38 100,38 69,60 82,98 50,75 18,98 31,60 0,38 37,38";
    body = `<polygon points="${points}" transform="${transform} translate(${-sx} ${-sy}) scale(${(sx * 2) / 100} ${(sy * 2) / 100})"/>`;
  } else {
    return null;
  }

  const blur = targetBlur / nativeScale;
  // Retain three Gaussian sigmas around the canvas (over 99% of the visible
  // falloff) without allocating a fixed 3x-by-3x filter surface for small
  // feather values. Coordinates are local to the scaled shape group.
  const filterPad = blur * 3;
  const filter = blur > 0
    ? `<filter id="f" filterUnits="userSpaceOnUse" x="${-filterPad}" y="${-filterPad}" width="${geometryWidth + filterPad * 2}" height="${geometryHeight + filterPad * 2}"><feGaussianBlur stdDeviation="${blur}"/></filter>`
    : "";
  const shapeFill = mask.inverted ? "black" : "white";
  const backgroundFill = mask.inverted ? "white" : "black";
  const filterAttr = filter ? ` filter="url(#f)"` : "";
  const scaleAttr = nativeScale > 1 ? ` transform="scale(${nativeScale})"` : "";
  const shapeLayer = `<g fill="${shapeFill}"${scaleAttr}${filterAttr}>${body}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${filter}<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${backgroundFill}"/>${shapeLayer}</mask></defs><rect width="${width}" height="${height}" fill="white" mask="url(#m)"/></svg>`;
  if (svgCache.size > 256) svgCache.clear();
  svgCache.set(key, svg);
  return svg;
}

export function maskSvgDataUri(mask: MaskConfig, width: number, height: number): string | null {
  const svg = buildMaskSvg(mask, width, height);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
