import { Platform } from "react-native";
import { CropPreset } from "./playerTypes";

export const CROP_PRESETS: CropPreset[] = [
  { id: "free", label: "Free", ratio: 0 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "2.35:1", label: "2.35:1", ratio: 2.35 },
];

export function formatTime(secs: number): string {
  const totalSecs = Math.max(0, secs || 0);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  const ms = Math.floor((totalSecs % 1) * 30);
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export const mediaDimensionsCache = new Map<string, { width: number; height: number }>();

export function registerMediaDimensions(key: string | undefined, width: number, height: number): void {
  if (!key || !width || !height || width <= 0 || height <= 0) return;
  mediaDimensionsCache.set(key, { width, height });
}

export function computeVideoClipDimensions(
  clip: any,
  boxWidth: number,
  canvasHeight: number,
): { baseW: number; baseH: number; uncroppedW: number; uncroppedH: number } {
  const w = boxWidth > 0 ? boxWidth : 360;
  const h = canvasHeight > 0 ? canvasHeight : 640;

  const cached =
    mediaDimensionsCache.get(clip?.url) ||
    mediaDimensionsCache.get(clip?.id) ||
    mediaDimensionsCache.get(clip?.thumbnail);

  let nw = clip?.naturalWidth || clip?.width || cached?.width;
  let nh = clip?.naturalHeight || clip?.height || cached?.height;

  // If dimensions not known yet: infer from viewport/canvas aspect ratio
  if (!nw || !nh || nw <= 0 || nh <= 0) {
    if (w < h) {
      // Portrait container (e.g. 9:16 mobile canvas): default to portrait 1080x1920
      nw = 1080;
      nh = 1920;
    } else {
      // Landscape container: default to 1920x1080
      nw = 1920;
      nh = 1080;
    }
  }

  const crop = clip?.crop || clip?.transform?.crop;
  let sw = nw;
  let sh = nh;
  if (crop && crop.width > 0 && crop.height > 0) {
    sw = Math.min(nw, (crop.width / 100) * nw);
    sh = Math.min(nh, (crop.height / 100) * nh);
  }

  const aspect = (sw / sh) || (16 / 9);
  let dw = w;
  let dh = w / aspect;
  const fitMode = clip?.fit || "contain";

  if (fitMode === "cover") {
    if (dh < h) {
      dh = h;
      dw = h * aspect;
    }
  } else {
    if (dh > h) {
      dh = h;
      dw = h * aspect;
    }
  }

  const uncroppedAspect = (nw / nh) || (16 / 9);
  let uncroppedW = w;
  let uncroppedH = w / uncroppedAspect;
  if (fitMode === "cover") {
    if (uncroppedH < h) {
      uncroppedH = h;
      uncroppedW = h * uncroppedAspect;
    }
  } else {
    if (uncroppedH > h) {
      uncroppedH = h;
      uncroppedW = h * uncroppedAspect;
    }
  }

  return {
    baseW: Math.round(dw),
    baseH: Math.round(dh),
    uncroppedW: Math.round(uncroppedW),
    uncroppedH: Math.round(uncroppedH),
  };
}

export function getItemBaseDimensions(
  type: "text" | "sticker" | "video" | "caption",
  clip: any,
  boxWidth: number,
  canvasHeight: number,
): { baseW: number; baseH: number } {
  const previewScale = Math.max(0.2, (boxWidth || 360) / 360);

  if (type === "video") {
    const { baseW, baseH } = computeVideoClipDimensions(clip, boxWidth, canvasHeight);
    return { baseW, baseH };
  }

  if (type === "text" || type === "caption") {
    const rawFontSize = clip.style?.fontSize || (type === "caption" ? 24 : 22);
    const fontSize = Math.round(rawFontSize * previewScale);
    const str = (clip.text || "").trim();
    const padX = (clip.style?.paddingHorizontal || 14) * previewScale;
    const padY = (clip.style?.paddingVertical || 8) * previewScale;
    const maxAvailableW = Math.max(100 * previewScale, boxWidth * 0.88);

    // Measure text width using 2D canvas context on web, or char heuristic
    let measureLineWidth = (line: string): number => {
      if (Platform.OS === "web" && typeof document !== "undefined") {
        try {
          const font = `${clip.style?.fontWeight || "bold"} ${fontSize}px ${clip.style?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'}`;
          const canvas =
            (document as any)._measureCanvas ||
            ((document as any)._measureCanvas = document.createElement("canvas"));
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.font = font;
            return ctx.measureText(line).width;
          }
        } catch {}
      }
      return Math.round(line.length * (fontSize * 0.58));
    };

    const rawLines = str.split("\n");
    let wrappedLinesCount = 0;
    let maxMeasuredLineW = 0;

    for (const rawLine of rawLines) {
      const lineW = measureLineWidth(rawLine);
      if (lineW > maxAvailableW - padX * 2) {
        // Line wraps into multiple lines
        const subLines = Math.max(1, Math.ceil(lineW / (maxAvailableW - padX * 2)));
        wrappedLinesCount += subLines;
        maxMeasuredLineW = Math.max(maxMeasuredLineW, maxAvailableW - padX * 2);
      } else {
        wrappedLinesCount += 1;
        maxMeasuredLineW = Math.max(maxMeasuredLineW, lineW);
      }
    }

    const totalLines = Math.max(1, wrappedLinesCount);
    const baseW = Math.max(
      Math.round(50 * previewScale),
      Math.min(maxAvailableW, Math.round(maxMeasuredLineW + padX * 2)),
    );
    const lineHeight = fontSize * 1.35;
    const baseH = Math.max(Math.round(28 * previewScale), Math.round(totalLines * lineHeight + padY * 2));
    return { baseW, baseH };
  }
  if (type === "sticker") {
    const isBadge = (clip.char || "").length > 2;
    const baseW = Math.round(
      (isBadge
        ? Math.max(90, Math.round((clip.char || "").length * 11 + 24))
        : 56) * previewScale,
    );
    const baseH = Math.round((isBadge ? 36 : 56) * previewScale);
    return { baseW: Math.max(20, baseW), baseH: Math.max(20, baseH) };
  }
  return { baseW: boxWidth, baseH: canvasHeight };
}

export {
  getInterpolatedTransform,
  getBaseTransform,
  cleanAndSortKeyframes,
  findKeyframeAtTime,
  applyTransformUpdateToClip,
} from "../../utils/keyframeEngine";

export function calculateProjectTargetDims(
  resolution: string = "1080p",
  aspectRatio: string = "9:16",
): { width: number; height: number } {
  let baseH = 1080;
  if (resolution === "720p") baseH = 720;
  else if (resolution === "2K/4K") baseH = 2160;

  switch (aspectRatio) {
    case "9:16":
      return {
        width: baseH === 720 ? 720 : baseH === 2160 ? 2160 : 1080,
        height: baseH === 720 ? 1280 : baseH === 2160 ? 3840 : 1920,
      };
    case "1:1":
      return {
        width: baseH === 720 ? 720 : baseH === 2160 ? 2160 : 1080,
        height: baseH === 720 ? 720 : baseH === 2160 ? 2160 : 1080,
      };
    case "4:5":
      return {
        width: baseH === 720 ? 720 : baseH === 2160 ? 2160 : 1080,
        height: Math.round(baseH * 1.25),
      };
    case "2.35:1":
      return {
        width: Math.round(baseH * 2.35),
        height: baseH,
      };
    case "16:9":
    default:
      return {
        width: baseH === 720 ? 1280 : baseH === 2160 ? 3840 : 1920,
        height: baseH,
      };
  }
}
