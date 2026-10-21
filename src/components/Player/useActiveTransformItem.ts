import { useMemo } from "react";
import { ActiveTransformItem, TransientTransformState } from "./playerTypes";
import { getItemBaseDimensions } from "./playerUtils";

interface UseActiveTransformItemProps {
  isCroppingMode: boolean;
  selectedClipId?: string | null;
  selectedClipType?: string;
  activeTexts: any[];
  activeStickers: any[];
  activeVideos: any[];
  activeTransient: TransientTransformState | null;
  boxWidth: number;
  canvasHeight: number;
}

export function useActiveTransformItem({
  isCroppingMode,
  selectedClipId,
  selectedClipType,
  activeTexts,
  activeStickers,
  activeVideos,
  activeTransient,
  boxWidth,
  canvasHeight,
}: UseActiveTransformItemProps): ActiveTransformItem | null {
  return useMemo(() => {
    if (isCroppingMode) return null;

    const selectedText = activeTexts.find((t) => t.id === selectedClipId);
    const selectedSticker = activeStickers.find((s) => s.id === selectedClipId);
    const selectedVideo =
      selectedClipType === "video"
        ? activeVideos.find((v) => v.id === selectedClipId) || null
        : null;

    const isTransText =
      activeTransient &&
      selectedText &&
      activeTransient.clipId === selectedText.id;
    const isTransStk =
      activeTransient &&
      selectedSticker &&
      activeTransient.clipId === selectedSticker.id;
    const isTransVid =
      activeTransient &&
      selectedVideo &&
      activeTransient.clipId === selectedVideo.id;

    if (selectedText) {
      const { baseW, baseH } = getItemBaseDimensions(
        "text",
        selectedText,
        boxWidth,
        canvasHeight,
      );
      const s = isTransText
        ? activeTransient!.scale
        : (selectedText.scale ?? 1.0);
      const rot = isTransText
        ? activeTransient!.rotation
        : (selectedText.rotation ?? 0);
      const pos = isTransText
        ? { x: activeTransient!.x, y: activeTransient!.y }
        : selectedText.position || { x: 50, y: 35 };
      return {
        id: selectedText.id,
        type: "text",
        label: selectedText.text,
        pos,
        scale: s,
        rotation: rot,
        baseW,
        baseH,
        width: Math.round(baseW * s),
        height: Math.round(baseH * s),
      };
    }

    if (selectedSticker) {
      const { baseW, baseH } = getItemBaseDimensions(
        "sticker",
        selectedSticker,
        boxWidth,
        canvasHeight,
      );
      const s = isTransStk
        ? activeTransient!.scale
        : (selectedSticker.scale ?? 1.2);
      const rot = isTransStk
        ? activeTransient!.rotation
        : (selectedSticker.rotation ?? 0);
      const pos = isTransStk
        ? { x: activeTransient!.x, y: activeTransient!.y }
        : selectedSticker.position || { x: 50, y: 50 };
      return {
        id: selectedSticker.id,
        type: "sticker",
        label: selectedSticker.char,
        pos,
        scale: s,
        rotation: rot,
        baseW,
        baseH,
        width: Math.round(baseW * s),
        height: Math.round(baseH * s),
      };
    }

    if (selectedVideo) {
      const { baseW, baseH } = getItemBaseDimensions(
        "video",
        selectedVideo,
        boxWidth,
        canvasHeight,
      );
      const s = isTransVid
        ? activeTransient!.scale
        : (selectedVideo.transform?.scale ?? 1.0);
      const rot = isTransVid
        ? activeTransient!.rotation
        : (selectedVideo.transform?.rotation ?? 0);
      const pos = isTransVid
        ? {
            x: 50 + (activeTransient!.x / boxWidth) * 100,
            y: 50 + (activeTransient!.y / canvasHeight) * 100,
          }
        : {
            x: 50 + ((selectedVideo.transform?.x || 0) / boxWidth) * 100,
            y: 50 + ((selectedVideo.transform?.y || 0) / canvasHeight) * 100,
          };
      return {
        id: selectedVideo.id,
        type: "video",
        label: selectedVideo.title,
        pos,
        scale: s,
        rotation: rot,
        baseW,
        baseH,
        width: Math.round(baseW * s),
        height: Math.round(baseH * s),
      };
    }

    return null;
  }, [
    isCroppingMode,
    selectedClipId,
    selectedClipType,
    activeTexts,
    activeStickers,
    activeVideos,
    activeTransient,
    boxWidth,
    canvasHeight,
  ]);
}
