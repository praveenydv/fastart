import { useMemo } from "react";
import { ActiveTransformItem, TransientTransformState } from "./playerTypes";
import { getItemBaseDimensions } from "./playerUtils";
import { FastArtProject } from "../../types/project";

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
  currentTime?: number;
  project?: FastArtProject;
  getInterpolatedTransform?: (
    clip: any,
    curTime: number,
    clipType?: string,
  ) => any;
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
  currentTime = 0,
  project,
  getInterpolatedTransform,
}: UseActiveTransformItemProps): ActiveTransformItem | null {
  return useMemo(() => {
    if (isCroppingMode || !selectedClipId) return null;

    const isTextType =
      !selectedClipType ||
      selectedClipType === "text" ||
      selectedClipType === "texts";
    const isStickerType =
      !selectedClipType ||
      selectedClipType === "sticker" ||
      selectedClipType === "stickers";
    const isVideoType =
      !selectedClipType ||
      selectedClipType === "video" ||
      selectedClipType === "photo" ||
      selectedClipType === "videos";

    const selectedText = isTextType
      ? activeTexts.find((t) => t.id === selectedClipId) ||
        project?.tracks?.text?.find((t) => t.id === selectedClipId) ||
        null
      : null;

    const selectedSticker = isStickerType
      ? activeStickers.find((s) => s.id === selectedClipId) ||
        project?.tracks?.stickers?.find((s) => s.id === selectedClipId) ||
        null
      : null;

    const selectedVideo = isVideoType
      ? activeVideos.find((v) => v.id === selectedClipId) ||
        project?.tracks?.video?.find((v) => v.id === selectedClipId) ||
        null
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
      const kfT = getInterpolatedTransform
        ? getInterpolatedTransform(selectedText, currentTime, "text")
        : null;
      const s = isTransText
        ? activeTransient!.scale
        : (kfT?.scale ?? selectedText.scale ?? 1.0);
      const rot = isTransText
        ? activeTransient!.rotation
        : (kfT?.rotation ?? selectedText.rotation ?? 0);
      const pos = isTransText
        ? { x: activeTransient!.x, y: activeTransient!.y }
        : {
            x: kfT ? kfT.x : (selectedText.position?.x ?? 50),
            y: kfT ? kfT.y : (selectedText.position?.y ?? 35),
          };
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
      const kfT = getInterpolatedTransform
        ? getInterpolatedTransform(selectedSticker, currentTime, "sticker")
        : null;
      const s = isTransStk
        ? activeTransient!.scale
        : (kfT?.scale ?? selectedSticker.scale ?? 1.2);
      const rot = isTransStk
        ? activeTransient!.rotation
        : (kfT?.rotation ?? selectedSticker.rotation ?? 0);
      const pos = isTransStk
        ? { x: activeTransient!.x, y: activeTransient!.y }
        : {
            x: kfT ? kfT.x : (selectedSticker.position?.x ?? 50),
            y: kfT ? kfT.y : (selectedSticker.position?.y ?? 50),
          };
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
      const kfT = getInterpolatedTransform
        ? getInterpolatedTransform(selectedVideo, currentTime, "video")
        : null;
      const s = isTransVid
        ? activeTransient!.scale
        : (kfT?.scale ?? selectedVideo.transform?.scale ?? selectedVideo.scale ?? 1.0);
      const rot = isTransVid
        ? activeTransient!.rotation
        : (kfT?.rotation ?? selectedVideo.transform?.rotation ?? selectedVideo.rotation ?? 0);
      const pos = isTransVid
        ? {
            x: 50 + (activeTransient!.x / boxWidth) * 100,
            y: 50 + (activeTransient!.y / canvasHeight) * 100,
          }
        : {
            x: 50 + ((kfT ? kfT.x : (selectedVideo.transform?.x || 0)) / boxWidth) * 100,
            y: 50 + ((kfT ? kfT.y : (selectedVideo.transform?.y || 0)) / canvasHeight) * 100,
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
    currentTime,
    project,
    getInterpolatedTransform,
  ]);
}
