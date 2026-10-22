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
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 30);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function getItemBaseDimensions(
  type: "text" | "sticker" | "video" | "caption",
  clip: any,
  boxWidth: number,
  canvasHeight: number,
): { baseW: number; baseH: number } {
  if (type === "text" || type === "caption") {
    const fontSize = clip.style?.fontSize || 22;
    const str = clip.text || "";
    let textWidth = 0;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      try {
        const font = `${clip.style?.fontWeight || "bold"} ${fontSize}px ${clip.style?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'}`;
        const canvas =
          (document as any)._measureCanvas ||
          ((document as any)._measureCanvas = document.createElement("canvas"));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.font = font;
          textWidth = ctx.measureText(str).width;
        }
      } catch {}
    }
    if (!textWidth) {
      textWidth = Math.round(str.length * (fontSize * 0.58));
    }
    const padX = clip.style?.paddingHorizontal || 14;
    const padY = clip.style?.paddingVertical || 8;
    const baseW = Math.max(
      50,
      Math.min(boxWidth * 0.95, Math.round(textWidth + padX * 2)),
    );
    const baseH = Math.max(30, Math.round(fontSize * 1.25 + padY * 2));
    return { baseW, baseH };
  }
  if (type === "sticker") {
    const isBadge = (clip.char || "").length > 2;
    const baseW = isBadge
      ? Math.max(90, Math.round((clip.char || "").length * 11 + 24))
      : 56;
    const baseH = isBadge ? 36 : 56;
    return { baseW, baseH };
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
