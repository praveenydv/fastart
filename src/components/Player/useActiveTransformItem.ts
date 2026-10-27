import { useMemo } from "react";
import { ActiveTransformItem, TransientTransformState } from "./playerTypes";
import { getItemBaseDimensions } from "./playerUtils";
import { FastArtProject } from "../../types/project";
import { applyMotionTracking } from "../../utils/renderer/rendererEffects";

interface UseActiveTransformItemProps {
  isCroppingMode: boolean;
  isPlaying?: boolean;
  selectedClipId?: string | null;
  selectedClipType?: string;
  activeCaptions?: any[];
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
  isPlaying = false,
  selectedClipId,
  selectedClipType,
  activeCaptions,
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

    const safeBoxW = Math.max(1, boxWidth || 360);
    const safeCanvasH = Math.max(1, canvasHeight || 640);

    const isCaptionType =
      !selectedClipType ||
      selectedClipType === "caption" ||
      selectedClipType === "captions";
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

    const selectedCaption = isCaptionType
      ? (activeCaptions?.find((c) => c.id === selectedClipId) ||
        project?.tracks?.captions?.find((c) => c.id === selectedClipId) ||
        null)
      : null;

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

    const isTransCap =
      activeTransient &&
      selectedCaption &&
      activeTransient.clipId === selectedCaption.id;
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

    if (selectedCaption) {
      const isCapActive =
        currentTime >= (selectedCaption.startTime ?? 0) &&
        currentTime <= (selectedCaption.startTime ?? 0) + (selectedCaption.duration ?? 0);
      if (!isCapActive) return null;

      const { baseW, baseH } = getItemBaseDimensions(
        "caption",
        selectedCaption,
        boxWidth,
        canvasHeight,
      );
      const kfT = getInterpolatedTransform
        ? getInterpolatedTransform(selectedCaption, currentTime, "caption")
        : null;
      const baseS = isTransCap
        ? activeTransient!.scale
        : (kfT?.scale ?? selectedCaption.scale ?? 1.0);
      const rot = isTransCap
        ? activeTransient!.rotation
        : (kfT?.rotation ?? selectedCaption.rotation ?? 0);

      const elapsed = Math.max(0, currentTime - (selectedCaption.startTime || 0));
      const anim = (selectedCaption.animation || "none").toLowerCase();
      let animScale = 1.0;
      if (anim === "bounce" && elapsed < 0.35) {
        const p = elapsed / 0.35;
        animScale = 0.5 + Math.sin(p * Math.PI) * 0.7;
      } else if (anim === "zoomin" && elapsed < 0.3) {
        const p = elapsed / 0.3;
        animScale = 0.4 + p * 0.6;
      }

      let motionX = 0;
      let motionY = 0;
      let motionScale = 1.0;
      let motionRot = 0;
      if (selectedCaption.motionTrack && selectedCaption.motionTrack.enabled) {
        const motion = applyMotionTracking(
          currentTime,
          selectedCaption.startTime,
          selectedCaption.duration,
          selectedCaption.motionTrack,
        );
        motionX = motion.dx;
        motionY = motion.dy;
        motionScale = motion.dScale;
        motionRot = motion.dRot;
      }

      const effScale = baseS * animScale * motionScale;
      const effRot = rot + motionRot;
      const rawX = isTransCap
        ? activeTransient!.x
        : (kfT ? kfT.x : (selectedCaption.position?.x ?? 50));
      const rawY = isTransCap
        ? activeTransient!.y
        : (kfT ? kfT.y : (selectedCaption.position?.y ?? 80));

      const pos = isTransCap
        ? { x: rawX, y: rawY }
        : {
            x: rawX + (motionX / safeBoxW) * 100,
            y: rawY + (motionY / safeCanvasH) * 100,
          };

      return {
        id: selectedCaption.id,
        type: "caption",
        label: selectedCaption.text,
        pos,
        scale: effScale,
        rotation: effRot,
        baseW,
        baseH,
        width: Math.round(baseW * effScale),
        height: Math.round(baseH * effScale),
      };
    }

    if (selectedText) {
      const isTxtActive =
        currentTime >= (selectedText.startTime ?? 0) &&
        currentTime <= (selectedText.startTime ?? 0) + (selectedText.duration ?? 0);
      if (!isTxtActive) return null;

      const { baseW, baseH } = getItemBaseDimensions(
        "text",
        selectedText,
        boxWidth,
        canvasHeight,
      );
      const kfT = getInterpolatedTransform
        ? getInterpolatedTransform(selectedText, currentTime, "text")
        : null;
      const baseS = isTransText
        ? activeTransient!.scale
        : (kfT?.scale ?? selectedText.scale ?? 1.0);
      const rot = isTransText
        ? activeTransient!.rotation
        : (kfT?.rotation ?? selectedText.rotation ?? 0);

      const elapsed = Math.max(0, currentTime - (selectedText.startTime || 0));
      let animScale = 1.0;
      let animOffsetX = 0;
      let animOffsetY = 0;
      const anim = (selectedText.animation || "none").toLowerCase();

      if (anim === "bounce" && elapsed < 0.4) {
        const p = elapsed / 0.4;
        animScale = 0.5 + Math.sin(p * Math.PI) * 0.7;
      } else if (anim === "zoomin" && elapsed < 0.35) {
        const p = elapsed / 0.35;
        animScale = 0.4 + p * 0.6;
      } else if (anim === "pulse") {
        animScale = 1.0 + Math.sin(elapsed * 6) * 0.08;
      } else if (anim === "shake") {
        if (elapsed < 0.8) {
          animOffsetX = Math.sin(elapsed * 40) * 4;
        }
      } else if (anim === "wave") {
        animOffsetY = Math.sin(elapsed * 4) * 6;
      }

      let motionX = 0;
      let motionY = 0;
      let motionScale = 1.0;
      let motionRot = 0;
      if (selectedText.motionTrack && selectedText.motionTrack.enabled) {
        const motion = applyMotionTracking(
          currentTime,
          selectedText.startTime,
          selectedText.duration,
          selectedText.motionTrack,
        );
        motionX = motion.dx;
        motionY = motion.dy;
        motionScale = motion.dScale;
        motionRot = motion.dRot;
      }

      const effScale = baseS * animScale * motionScale;
      const effRot = rot + motionRot;
      const rawX = isTransText
        ? activeTransient!.x
        : (kfT ? kfT.x : (selectedText.position?.x ?? 50));
      const rawY = isTransText
        ? activeTransient!.y
        : (kfT ? kfT.y : (selectedText.position?.y ?? 35));

      const pos = isTransText
        ? { x: rawX, y: rawY }
        : {
            x: rawX + ((animOffsetX + motionX) / safeBoxW) * 100,
            y: rawY + ((animOffsetY + motionY) / safeCanvasH) * 100,
          };

      return {
        id: selectedText.id,
        type: "text",
        label: selectedText.text,
        pos,
        scale: effScale,
        rotation: effRot,
        baseW,
        baseH,
        width: Math.round(baseW * effScale),
        height: Math.round(baseH * effScale),
      };
    }

    if (selectedSticker) {
      const isStkActive =
        currentTime >= (selectedSticker.startTime ?? 0) &&
        currentTime <= (selectedSticker.startTime ?? 0) + (selectedSticker.duration ?? 0);
      if (!isStkActive) return null;

      const { baseW, baseH } = getItemBaseDimensions(
        "sticker",
        selectedSticker,
        boxWidth,
        canvasHeight,
      );
      const kfT = getInterpolatedTransform
        ? getInterpolatedTransform(selectedSticker, currentTime, "sticker")
        : null;
      const baseS = isTransStk
        ? activeTransient!.scale
        : (kfT?.scale ?? selectedSticker.scale ?? 1.2);
      const rot = isTransStk
        ? activeTransient!.rotation
        : (kfT?.rotation ?? selectedSticker.rotation ?? 0);

      const elapsed = Math.max(0, currentTime - (selectedSticker.startTime || 0));
      let animScale = 1.0;
      let animOffsetY = 0;
      const anim = selectedSticker.animation || "none";

      if (anim === "bounce") {
        animScale = 1.0 + Math.sin(elapsed * 4) * 0.08;
      } else if (anim === "pulse") {
        animScale = 1.0 + Math.sin(elapsed * 6) * 0.1;
      } else if (anim === "wave") {
        animOffsetY = Math.sin(elapsed * 4) * 8;
      } else if (anim === "pop" && elapsed < 0.3) {
        const p = elapsed / 0.3;
        animScale = 0.3 + p * 0.85;
      }

      let motionX = 0;
      let motionY = 0;
      let motionScale = 1.0;
      let motionRot = 0;
      if (selectedSticker.motionTrack && selectedSticker.motionTrack.enabled) {
        const motion = applyMotionTracking(
          currentTime,
          selectedSticker.startTime,
          selectedSticker.duration,
          selectedSticker.motionTrack,
        );
        motionX = motion.dx;
        motionY = motion.dy;
        motionScale = motion.dScale;
        motionRot = motion.dRot;
      }

      const effScale = baseS * animScale * motionScale;
      const effRot = rot + motionRot;
      const rawX = isTransStk
        ? activeTransient!.x
        : (kfT ? kfT.x : (selectedSticker.position?.x ?? 50));
      const rawY = isTransStk
        ? activeTransient!.y
        : (kfT ? kfT.y : (selectedSticker.position?.y ?? 50));

      const pos = isTransStk
        ? { x: rawX, y: rawY }
        : {
            x: rawX + (motionX / safeBoxW) * 100,
            y: rawY + ((animOffsetY + motionY) / safeCanvasH) * 100,
          };

      return {
        id: selectedSticker.id,
        type: "sticker",
        label: selectedSticker.char,
        pos,
        scale: effScale,
        rotation: effRot,
        baseW,
        baseH,
        width: Math.round(baseW * effScale),
        height: Math.round(baseH * effScale),
      };
    }

    if (selectedVideo) {
      const isVidActive =
        currentTime >= (selectedVideo.startTime ?? 0) &&
        currentTime <= (selectedVideo.startTime ?? 0) + (selectedVideo.duration ?? 0);
      if (!isVidActive) return null;

      const { baseW, baseH } = getItemBaseDimensions(
        "video",
        selectedVideo,
        boxWidth,
        canvasHeight,
      );
      const kfT = getInterpolatedTransform
        ? getInterpolatedTransform(selectedVideo, currentTime, "video")
        : null;
      const baseS = isTransVid
        ? activeTransient!.scale
        : (kfT?.scale ?? selectedVideo.transform?.scale ?? selectedVideo.scale ?? 1.0);
      const rot = isTransVid
        ? activeTransient!.rotation
        : (kfT?.rotation ?? selectedVideo.transform?.rotation ?? selectedVideo.rotation ?? 0);

      let motionX = 0;
      let motionY = 0;
      let motionScale = 1.0;
      let motionRot = 0;
      if (selectedVideo.motionTrack && selectedVideo.motionTrack.enabled) {
        const motion = applyMotionTracking(
          currentTime,
          selectedVideo.startTime,
          selectedVideo.duration,
          selectedVideo.motionTrack,
        );
        motionX = motion.dx;
        motionY = motion.dy;
        motionScale = motion.dScale;
        motionRot = motion.dRot;
      }

      const effScale = baseS * motionScale;
      const effRot = rot + motionRot;
      const rawX = isTransVid ? activeTransient!.x : (kfT ? kfT.x : (selectedVideo.transform?.x || 0));
      const rawY = isTransVid ? activeTransient!.y : (kfT ? kfT.y : (selectedVideo.transform?.y || 0));

      const pos = isTransVid
        ? {
            x: 50 + (rawX / safeBoxW) * 100,
            y: 50 + (rawY / safeCanvasH) * 100,
          }
        : {
            x: 50 + ((rawX + motionX) / safeBoxW) * 100,
            y: 50 + ((rawY + motionY) / safeCanvasH) * 100,
          };

      return {
        id: selectedVideo.id,
        type: "video",
        label: selectedVideo.title,
        pos,
        scale: effScale,
        rotation: effRot,
        baseW,
        baseH,
        width: Math.round(baseW * effScale),
        height: Math.round(baseH * effScale),
      };
    }

    return null;
  }, [
    isCroppingMode,
    selectedClipId,
    selectedClipType,
    activeCaptions,
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
