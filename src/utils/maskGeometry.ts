import type { MaskConfig } from "../types/project";

const svgCache = new Map<string, string>();

/** Build the canonical alpha-mask SVG used by CSS on web and SvgXml on native. */
export function buildMaskSvg(mask: MaskConfig, width: number, height: number): string | null {
  const shape = mask.shape;
  if (!shape || shape === "none" || width <= 0 || height <= 0) return null;

  const effW = mask.width ?? mask.size ?? 60;
  const effH = mask.height ?? mask.size ?? 60;
  const minDim = Math.min(width, height);
  const cx = width / 2 + ((mask.x ?? 0) / 100) * width;
  const cy = height / 2 + ((mask.y ?? 0) / 100) * height;
  const rotation = mask.rotation ?? 0;
  const roundness = Math.max(0, mask.roundness ?? 16);
  const key = `${shape}:${width}:${height}:${effW}:${effH}:${cx}:${cy}:${rotation}:${roundness}:${mask.feather ?? 0}:${!!mask.inverted}`;
  const cached = svgCache.get(key);
  if (cached) return cached;

  let body: string;
  const transform = `translate(${cx} ${cy}) rotate(${rotation})`;
  if (shape === "circle") {
    const rx = Math.max(1, (minDim * effW) / 200);
    const ry = Math.max(1, (minDim * effH) / 200);
    body = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotation} ${cx} ${cy})"/>`;
  } else if (shape === "rectangle") {
    const rw = (width * effW) / 100;
    const rh = (height * effH) / 100;
    const radius = Math.min(roundness, rw / 2, rh / 2);
    body = `<rect x="${-rw / 2}" y="${-rh / 2}" width="${rw}" height="${rh}" rx="${radius}" transform="${transform}"/>`;
  } else if (shape === "linear") {
    const extent = Math.max(width, height) * 5;
    body = `<path d="M ${-extent} 0 H ${extent} V ${extent} H ${-extent} Z" transform="${transform}"/>`;
  } else if (shape === "mirror") {
    const bandH = Math.max(2, (height * effH) / 100);
    const extent = Math.max(width, height) * 5;
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

  // Feather is 0..80 in the UI. Keep the full range and expand the filter
  // region so high softness is not clipped back to a sharp edge on native SVG.
  const blur = Math.max(0, Math.min(80, mask.feather ?? 0)) * (minDim / 100) * 0.5;
  // SVG's default filter and mask regions are only slightly larger than the
  // target bounds (often 10%). That clips most of a large feather on native
  // SVG, making the edge look almost hard even though the blur is configured.
  // Use explicit user-space regions with a full-canvas pad so SvgXml and the
  // browser rasterize the same feather width.
  const filter = blur > 0
    ? `<filter id="f" filterUnits="userSpaceOnUse" x="${-width}" y="${-height}" width="${width * 3}" height="${height * 3}"><feGaussianBlur stdDeviation="${blur}"/></filter>`
    : "";
  const shapeFill = mask.inverted ? "black" : "white";
  const backgroundFill = mask.inverted ? "white" : "black";
  const filterAttr = filter ? ` filter="url(#f)"` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${filter}<mask id="m" maskUnits="userSpaceOnUse" x="${-width}" y="${-height}" width="${width * 3}" height="${height * 3}"><rect width="${width}" height="${height}" fill="${backgroundFill}"/><g fill="${shapeFill}"${filterAttr}>${body}</g></mask></defs><rect width="${width}" height="${height}" fill="white" mask="url(#m)"/></svg>`;
  if (svgCache.size > 256) svgCache.clear();
  svgCache.set(key, svg);
  return svg;
}

export function maskSvgDataUri(mask: MaskConfig, width: number, height: number): string | null {
  const svg = buildMaskSvg(mask, width, height);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
