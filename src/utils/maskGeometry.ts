import type { MaskConfig } from "../types/project";

const svgCache = new Map<string, string>();

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
  const rawPoints: [number, number][] = [
    [0, -50],
    [12.34, -17.0],
    [47.55, -15.45],
    [19.97, 6.49],
    [29.39, 40.45],
    [0, 21],
    [-29.39, 40.45],
    [-19.97, 6.49],
    [-47.55, -15.45],
    [-12.34, -17.0],
  ];
  return "M " + rawPoints.map(([x, y]) => `${(x * sx).toFixed(2)},${(y * sy).toFixed(2)}`).join(" L ") + " Z";
}

/** Build the canonical alpha-mask SVG with true hardware-accelerated gradients across Web and Mobile. */
export function buildMaskSvg(
  mask: MaskConfig,
  width: number,
  height: number,
): string | null {
  const shape = mask.shape;
  if (!shape || shape === "none" || width <= 0 || height <= 0) return null;

  const feather = Math.max(0, Math.min(100, mask.feather ?? 0));
  const minDim = Math.min(width, height);
  // Matches Web's (minDim * (rawFeather / 100)) * 0.38 exactly
  const featherPx = feather > 0 ? (feather / 100) * (minDim * 0.38) : 0;

  const effW = mask.width ?? mask.size ?? 60;
  const effH = mask.height ?? mask.size ?? 60;
  const cx = width / 2 + ((mask.x ?? 0) / 100) * width;
  const cy = height / 2 + ((mask.y ?? 0) / 100) * height;
  const rotation = mask.rotation ?? 0;
  const roundness = Math.max(0, mask.roundness ?? 16);
  const inverted = !!mask.inverted;

  const key = `${shape}:${width}:${height}:${effW}:${effH}:${cx.toFixed(1)}:${cy.toFixed(1)}:${rotation}:${roundness}:${feather}:${inverted}`;
  const cached = svgCache.get(key);
  if (cached) return cached;

  const extent = Math.max(width, height) * 3;
  let defs = "";
  let body = "";

  const filterId = "mask_blur_filter";
  const hasBlur = featherPx > 0.5;
  if (hasBlur) {
    defs = `
      <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${featherPx.toFixed(1)}" />
      </filter>
    `;
  }
  const filterAttr = hasBlur ? ` filter="url(#${filterId})"` : "";

  if (shape === "linear") {
    const transform = `translate(${cx} ${cy}) rotate(${rotation})`;
    body = `
      <g transform="${transform}"${filterAttr}>
        <rect x="${-extent}" y="${inverted ? -extent : 0}" width="${extent * 2}" height="${extent}" fill="white" />
      </g>
    `;
  } else if (shape === "mirror") {
    const transform = `translate(${cx} ${cy}) rotate(${rotation})`;
    const bandH = Math.max(4, (height * effH) / 100);
    const halfH = bandH / 2;
    if (!inverted) {
      body = `
        <g transform="${transform}"${filterAttr}>
          <rect x="${-extent}" y="${-halfH}" width="${extent * 2}" height="${bandH}" fill="white" />
        </g>
      `;
    } else {
      body = `
        <g transform="${transform}"${filterAttr}>
          <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z M ${-extent} ${-halfH} H ${extent} V ${halfH} H ${-extent} Z" fill="white" fill-rule="evenodd" />
        </g>
      `;
    }
  } else if (shape === "circle") {
    const transform = `translate(${cx} ${cy}) rotate(${rotation})`;
    const rx = Math.max(2, (minDim * effW) / 200);
    const ry = Math.max(2, (minDim * effH) / 200);
    if (!inverted) {
      body = `
        <g transform="${transform}"${filterAttr}>
          <ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="white"/>
        </g>
      `;
    } else {
      body = `
        <g transform="${transform}"${filterAttr}>
          <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z M ${rx} 0 A ${rx} ${ry} 0 1 0 ${-rx} 0 A ${rx} ${ry} 0 1 0 ${rx} 0 Z" fill="white" fill-rule="evenodd"/>
        </g>
      `;
    }
  } else if (shape === "rectangle") {
    const transform = `translate(${cx} ${cy}) rotate(${rotation})`;
    const rw = (width * effW) / 100;
    const rh = (height * effH) / 100;
    const radius = Math.min(roundness, rw / 2, rh / 2);
    if (!inverted) {
      body = `
        <g transform="${transform}"${filterAttr}>
          <rect x="${-rw / 2}" y="${-rh / 2}" width="${rw}" height="${rh}" rx="${radius}" fill="white"/>
        </g>
      `;
    } else {
      body = `
        <g transform="${transform}"${filterAttr}>
          <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z M ${-rw / 2} ${-rh / 2} h ${rw} v ${rh} h ${-rw} Z" fill="white" fill-rule="evenodd"/>
        </g>
      `;
    }
  } else if (shape === "heart") {
    const transform = `translate(${cx} ${cy}) rotate(${rotation})`;
    const hw = Math.max(1, (minDim * effW) / 100);
    const hh = Math.max(1, (minDim * effH) / 100);
    const baseScaleX = hw / 100;
    const baseScaleY = hh / 100;
    if (!inverted) {
      body = `
        <g transform="${transform}"${filterAttr}>
          <path d="${getHeartPath(baseScaleX, baseScaleY)}" fill="white"/>
        </g>
      `;
    } else {
      body = `
        <g transform="${transform}"${filterAttr}>
          <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getHeartPath(baseScaleX, baseScaleY)}" fill="white" fill-rule="evenodd"/>
        </g>
      `;
    }
  } else if (shape === "star") {
    const transform = `translate(${cx} ${cy}) rotate(${rotation})`;
    const sw = Math.max(1, (minDim * effW) / 100);
    const sh = Math.max(1, (minDim * effH) / 100);
    const baseScaleX = sw / 100;
    const baseScaleY = sh / 100;
    if (!inverted) {
      body = `
        <g transform="${transform}"${filterAttr}>
          <path d="${getStarPath(baseScaleX, baseScaleY)}" fill="white"/>
        </g>
      `;
    } else {
      body = `
        <g transform="${transform}"${filterAttr}>
          <path d="M ${-extent} ${-extent} H ${extent} V ${extent} H ${-extent} Z ${getStarPath(baseScaleX, baseScaleY)}" fill="white" fill-rule="evenodd"/>
        </g>
      `;
    }
  } else {
    return null;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`;
  if (svgCache.size > 256) svgCache.clear();
  svgCache.set(key, svg);
  return svg;
}

export function maskSvgDataUri(mask: MaskConfig, width: number, height: number): string | null {
  const svg = buildMaskSvg(mask, width, height);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
