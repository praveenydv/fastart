import { useState, useEffect, useMemo, useRef } from "react";
import { Platform, PanResponder } from "react-native";
import { soundEngine } from "../../utils/audioEngine";
import { CustomCrop, FastArtProject } from "../../types/project";
import { CROP_PRESETS } from "./playerUtils";
import { CropDragState } from "./playerTypes";
import { getPointerCoords } from "../Timeline";

interface UsePlayerCropGesturesProps {
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
  boxWidth: number;
  canvasHeight: number;
  selectedClipId?: string | null;
  selectedClipType?: string;
  isCroppingPreviewProp?: boolean;
  onToggleCropPreview?: (isCropping: boolean) => void;
  onUpdateClipCrop?: (clipId: string, crop: CustomCrop, isFinal?: boolean) => void;
  rendererRef: React.RefObject<any>;
  canvasRef: React.RefObject<any>;
}

export function usePlayerCropGestures({
  project,
  currentTime,
  isPlaying,
  boxWidth,
  canvasHeight,
  selectedClipId,
  selectedClipType,
  isCroppingPreviewProp,
  onToggleCropPreview,
  onUpdateClipCrop,
  rendererRef,
  canvasRef,
}: UsePlayerCropGesturesProps) {
  const [internalCroppingMode, setInternalCroppingMode] = useState(false);
  const isCroppingMode =
    isCroppingPreviewProp !== undefined
      ? isCroppingPreviewProp
      : internalCroppingMode;

  const [cropBox, setCropBox] = useState<CustomCrop>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [cropPreset, setCropPreset] = useState<string>("free");
  const [cropTargetClipId, setCropTargetClipId] = useState<string | null>(null);
  const [cropDragState, setCropDragState] = useState<any>(null);

  const onUpdateClipCropRef = useRef(onUpdateClipCrop);
  onUpdateClipCropRef.current = onUpdateClipCrop;

  const cropBoxRef = useRef(cropBox);
  cropBoxRef.current = cropBox;

  const activeVideos = useMemo(
    () =>
      (project.tracks.video || []).filter(
        (v) =>
          currentTime >= v.startTime && currentTime <= v.startTime + v.duration,
      ),
    [project.tracks.video, currentTime],
  );

  const selectedVideo =
    selectedClipType === "video" || selectedClipType === "photo"
      ? activeVideos.find((v) => v.id === selectedClipId) || null
      : null;

  const targetCropClip =
    (project.tracks.video || []).find(
      (v) => v.id === (cropTargetClipId || selectedClipId),
    ) ||
    selectedVideo ||
    activeVideos[0] ||
    (project.tracks.video || [])[0] ||
    null;

  const projectTargetDims = useMemo(() => {
    const res = project.resolution || "1080p";
    const aspect = project.aspectRatio || "9:16";
    let baseH = 1080;
    if (res === "720p") baseH = 720;
    else if (res === "2K/4K") baseH = 2160;

    switch (aspect) {
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
  }, [project.resolution, project.aspectRatio]);

  const mediaNaturalDims = targetCropClip
    ? rendererRef.current?.getMediaNaturalDimensions(targetCropClip.url)
    : null;
  const naturalW = mediaNaturalDims?.width || 0;
  const naturalH = mediaNaturalDims?.height || 0;
  const mw = Math.max(naturalW, projectTargetDims.width, 1080);
  const mh = Math.max(naturalH, projectTargetDims.height, 1080);
  const mediaAspect =
    naturalW > 0 && naturalH > 0
      ? naturalW / naturalH
      : projectTargetDims.width / projectTargetDims.height;

  let mediaDisplayW = boxWidth;
  let mediaDisplayH = boxWidth / mediaAspect;
  if (mediaDisplayH > canvasHeight) {
    mediaDisplayH = canvasHeight;
    mediaDisplayW = canvasHeight * mediaAspect;
  }

  const cropPixelX =
    (boxWidth - mediaDisplayW) / 2 + (cropBox.x / 100) * mediaDisplayW;
  const cropPixelY =
    (canvasHeight - mediaDisplayH) / 2 + (cropBox.y / 100) * mediaDisplayH;
  const cropPixelW = (cropBox.width / 100) * mediaDisplayW;
  const cropPixelH = (cropBox.height / 100) * mediaDisplayH;

  const handleEnterCropMode = (clipId?: string) => {
    soundEngine.playSfx("click");
    const target =
      (project.tracks.video || []).find((v) => v.id === clipId) ||
      targetCropClip;
    if (target) {
      setCropTargetClipId(target.id);
      const existingCrop = target.crop || {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      setCropBox(existingCrop);
    }
    if (onToggleCropPreview) {
      onToggleCropPreview(true);
    } else {
      setInternalCroppingMode(true);
    }
    if (rendererRef.current && target) {
      rendererRef.current.setPreviewCropMode(target.id);
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  };

  // Automatically activate crop preview & sync cropBox to full size by default whenever isCroppingMode changes
  useEffect(() => {
    if (isCroppingMode) {
      if (targetCropClip) {
        setCropTargetClipId(targetCropClip.id);
        const existingCrop = targetCropClip.crop;
        if (existingCrop && existingCrop.width > 0 && existingCrop.height > 0) {
          setCropBox(existingCrop);
        } else {
          // Full size by default (100% width, 100% height)
          setCropBox({
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          });
        }
        if (rendererRef.current) {
          rendererRef.current.setPreviewCropMode(targetCropClip.id);
          rendererRef.current.renderFrame(
            project,
            currentTime,
            isPlaying,
            boxWidth,
            canvasHeight,
          );
        }
      }
    } else {
      if (rendererRef.current) {
        rendererRef.current.setPreviewCropMode(null);
        rendererRef.current.renderFrame(
          project,
          currentTime,
          isPlaying,
          boxWidth,
          canvasHeight,
        );
      }
    }
  }, [
    isCroppingMode,
    targetCropClip?.id,
    targetCropClip?.crop?.x,
    targetCropClip?.crop?.y,
    targetCropClip?.crop?.width,
    targetCropClip?.crop?.height,
  ]);

  const handleCropDragStart = (
    e: any,
    handle: "pan" | "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r",
  ) => {
    e.stopPropagation?.();
    e.nativeEvent?.stopPropagation?.();
    if (e.cancelable && e.preventDefault) {
      e.preventDefault();
    }
    const { clientX, clientY } = getPointerCoords(e);

    setCropDragState({
      handle,
      startClientX: clientX,
      startClientY: clientY,
      startCrop: { ...cropBox },
      mediaDisplayW,
      mediaDisplayH,
    });
  };

  const handleApplyPresetCrop = (presetId: string) => {
    soundEngine.playSfx("click");
    setCropPreset(presetId);
    if (presetId === "free") {
      return;
    }
    const preset = CROP_PRESETS.find((p) => p.id === presetId);
    if (!preset || preset.ratio <= 0) return;

    const targetRatio = preset.ratio;
    const ratioFactor = targetRatio / mediaAspect;

    let newW = 100;
    let newH = newW / ratioFactor;
    if (newH > 100) {
      newH = 100;
      newW = newH * ratioFactor;
    }
    newW = Math.max(10, Math.min(100, Number(newW.toFixed(2))));
    newH = Math.max(10, Math.min(100, Number(newH.toFixed(2))));
    const newX = Number(((100 - newW) / 2).toFixed(2));
    const newY = Number(((100 - newH) / 2).toFixed(2));

    setCropBox({
      x: newX,
      y: newY,
      width: newW,
      height: newH,
    });
  };

  const handleResetCrop = () => {
    soundEngine.playSfx("click");
    setCropBox({ x: 0, y: 0, width: 100, height: 100 });
    setCropPreset("free");
  };

  const handleCancelCrop = () => {
    soundEngine.playSfx("click");
    rendererRef.current?.setPreviewCropMode(null);
    if (onToggleCropPreview) {
      onToggleCropPreview(false);
    } else {
      setInternalCroppingMode(false);
    }
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  };

  const handleConfirmCrop = () => {
    soundEngine.playSfx("click");
    const targetId = cropTargetClipId || selectedClipId || activeVideos[0]?.id;
    if (targetId && onUpdateClipCropRef.current) {
      onUpdateClipCropRef.current(
        targetId,
        {
          x: Math.round(cropBox.x),
          y: Math.round(cropBox.y),
          width: Math.round(cropBox.width),
          height: Math.round(cropBox.height),
        },
        true,
      );
    }
    rendererRef.current?.setPreviewCropMode(null);
    if (onToggleCropPreview) {
      onToggleCropPreview(false);
    } else {
      setInternalCroppingMode(false);
    }
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  };

  useEffect(() => {
    if (!cropDragState) return;

    let pendingRaf: number | null = null;
    let latestBox = { ...cropBox };

    const handlePointerMove = (e: any) => {
      if (e.cancelable && e.preventDefault) {
        e.preventDefault();
      }
      const { clientX, clientY } = getPointerCoords(e);

      const dxPx = clientX - cropDragState.startClientX;
      const dyPx = clientY - cropDragState.startClientY;
      const dxPct = (dxPx / cropDragState.mediaDisplayW) * 100;
      const dyPct = (dyPx / cropDragState.mediaDisplayH) * 100;

      const { handle, startCrop } = cropDragState;
      let nextX = startCrop.x;
      let nextY = startCrop.y;
      let nextW = startCrop.width;
      let nextH = startCrop.height;

      if (handle === "pan") {
        nextX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + dxPct));
        nextY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + dyPct));
      } else if (handle === "br") {
        nextW = Math.max(10, Math.min(100 - startCrop.x, startCrop.width + dxPct));
        nextH = Math.max(10, Math.min(100 - startCrop.y, startCrop.height + dyPct));
      } else if (handle === "tl") {
        const candidateX = Math.max(
          0,
          Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dxPct),
        );
        const candidateY = Math.max(
          0,
          Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dyPct),
        );
        nextW = startCrop.width - (candidateX - startCrop.x);
        nextH = startCrop.height - (candidateY - startCrop.y);
        nextX = candidateX;
        nextY = candidateY;
      } else if (handle === "tr") {
        const candidateY = Math.max(
          0,
          Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dyPct),
        );
        nextW = Math.max(10, Math.min(100 - startCrop.x, startCrop.width + dxPct));
        nextH = startCrop.height - (candidateY - startCrop.y);
        nextY = candidateY;
      } else if (handle === "bl") {
        const candidateX = Math.max(
          0,
          Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dxPct),
        );
        nextW = startCrop.width - (candidateX - startCrop.x);
        nextH = Math.max(10, Math.min(100 - startCrop.y, startCrop.height + dyPct));
        nextX = candidateX;
      } else if (handle === "t") {
        const candidateY = Math.max(
          0,
          Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dyPct),
        );
        nextH = startCrop.height - (candidateY - startCrop.y);
        nextY = candidateY;
      } else if (handle === "b") {
        nextH = Math.max(10, Math.min(100 - startCrop.y, startCrop.height + dyPct));
      } else if (handle === "l") {
        const candidateX = Math.max(
          0,
          Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dxPct),
        );
        nextW = startCrop.width - (candidateX - startCrop.x);
        nextX = candidateX;
      } else if (handle === "r") {
        nextW = Math.max(10, Math.min(100 - startCrop.x, startCrop.width + dxPct));
      }

      latestBox = {
        x: Number(nextX.toFixed(2)),
        y: Number(nextY.toFixed(2)),
        width: Number(nextW.toFixed(2)),
        height: Number(nextH.toFixed(2)),
      };

      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(() => {
          pendingRaf = null;
          setCropBox(latestBox);
        });
      }
    };

    const handlePointerUp = () => {
      if (pendingRaf !== null) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = null;
      }
      setCropBox(latestBox);
      setCropDragState(null);
      const targetId = cropTargetClipId || selectedClipId || activeVideos[0]?.id;
      if (targetId && onUpdateClipCropRef.current) {
        onUpdateClipCropRef.current(
          targetId,
          {
            x: Math.round(latestBox.x),
            y: Math.round(latestBox.y),
            width: Math.round(latestBox.width),
            height: Math.round(latestBox.height),
          },
          true,
        );
      }
    };

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);
      window.addEventListener("touchmove", handlePointerMove, {
        passive: false,
      });
      window.addEventListener("touchend", handlePointerUp);
      window.addEventListener("touchcancel", handlePointerUp);
      return () => {
        if (pendingRaf !== null) {
          cancelAnimationFrame(pendingRaf);
        }
        if (typeof window.removeEventListener === "function") {
          window.removeEventListener("mousemove", handlePointerMove);
          window.removeEventListener("mouseup", handlePointerUp);
          window.removeEventListener("touchmove", handlePointerMove);
          window.removeEventListener("touchend", handlePointerUp);
          window.removeEventListener("touchcancel", handlePointerUp);
        }
      };
    }
  }, [cropDragState]);

  const mediaDisplayWRef = useRef(mediaDisplayW);
  mediaDisplayWRef.current = mediaDisplayW;

  const mediaDisplayHRef = useRef(mediaDisplayH);
  mediaDisplayHRef.current = mediaDisplayH;

  const createCropResponder = (
    handle: "pan" | "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r",
  ) => {
    const startRef = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startRef.x = cropBoxRef.current.x;
        startRef.y = cropBoxRef.current.y;
        startRef.width = cropBoxRef.current.width;
        startRef.height = cropBoxRef.current.height;
      },
      onPanResponderMove: (_, gs) => {
        const dw = mediaDisplayWRef.current;
        const dh = mediaDisplayHRef.current;
        if (dw <= 0 || dh <= 0) return;
        const dxPct = (gs.dx / dw) * 100;
        const dyPct = (gs.dy / dh) * 100;

        let nextX = startRef.x;
        let nextY = startRef.y;
        let nextW = startRef.width;
        let nextH = startRef.height;

        if (handle === "pan") {
          nextX = Math.max(
            0,
            Math.min(100 - startRef.width, startRef.x + dxPct),
          );
          nextY = Math.max(
            0,
            Math.min(100 - startRef.height, startRef.y + dyPct),
          );
        } else if (handle === "br") {
          nextW = Math.max(
            10,
            Math.min(100 - startRef.x, startRef.width + dxPct),
          );
          nextH = Math.max(
            10,
            Math.min(100 - startRef.y, startRef.height + dyPct),
          );
        } else if (handle === "tl") {
          const candidateX = Math.max(
            0,
            Math.min(startRef.x + startRef.width - 10, startRef.x + dxPct),
          );
          const candidateY = Math.max(
            0,
            Math.min(startRef.y + startRef.height - 10, startRef.y + dyPct),
          );
          nextW = startRef.width - (candidateX - startRef.x);
          nextH = startRef.height - (candidateY - startRef.y);
          nextX = candidateX;
          nextY = candidateY;
        } else if (handle === "tr") {
          const candidateY = Math.max(
            0,
            Math.min(startRef.y + startRef.height - 10, startRef.y + dyPct),
          );
          nextW = Math.max(
            10,
            Math.min(100 - startRef.x, startRef.width + dxPct),
          );
          nextH = startRef.height - (candidateY - startRef.y);
          nextY = candidateY;
        } else if (handle === "bl") {
          const candidateX = Math.max(
            0,
            Math.min(startRef.x + startRef.width - 10, startRef.x + dxPct),
          );
          nextW = startRef.width - (candidateX - startRef.x);
          nextH = Math.max(
            10,
            Math.min(100 - startRef.y, startRef.height + dyPct),
          );
          nextX = candidateX;
        } else if (handle === "t") {
          const candidateY = Math.max(
            0,
            Math.min(startRef.y + startRef.height - 10, startRef.y + dyPct),
          );
          nextH = startRef.height - (candidateY - startRef.y);
          nextY = candidateY;
        } else if (handle === "b") {
          nextH = Math.max(
            10,
            Math.min(100 - startRef.y, startRef.height + dyPct),
          );
        } else if (handle === "l") {
          const candidateX = Math.max(
            0,
            Math.min(startRef.x + startRef.width - 10, startRef.x + dxPct),
          );
          nextW = startRef.width - (candidateX - startRef.x);
          nextX = candidateX;
        } else if (handle === "r") {
          nextW = Math.max(
            10,
            Math.min(100 - startRef.x, startRef.width + dxPct),
          );
        }

        setCropBox({
          x: Number(nextX.toFixed(2)),
          y: Number(nextY.toFixed(2)),
          width: Number(nextW.toFixed(2)),
          height: Number(nextH.toFixed(2)),
        });
      },
      onPanResponderRelease: () => {
        const targetId = cropTargetClipId || selectedClipId || activeVideos[0]?.id;
        if (targetId && onUpdateClipCropRef.current) {
          onUpdateClipCropRef.current(
            targetId,
            {
              x: Math.round(cropBoxRef.current.x),
              y: Math.round(cropBoxRef.current.y),
              width: Math.round(cropBoxRef.current.width),
              height: Math.round(cropBoxRef.current.height),
            },
            true,
          );
        }
      },
    });
  };

  const cropPanResponder = useRef(createCropResponder("pan")).current;
  const cropTLResponder = useRef(createCropResponder("tl")).current;
  const cropTRResponder = useRef(createCropResponder("tr")).current;
  const cropBLResponder = useRef(createCropResponder("bl")).current;
  const cropBRResponder = useRef(createCropResponder("br")).current;
  const cropTResponder = useRef(createCropResponder("t")).current;
  const cropBResponder = useRef(createCropResponder("b")).current;
  const cropLResponder = useRef(createCropResponder("l")).current;
  const cropRResponder = useRef(createCropResponder("r")).current;

  return {
    isCroppingMode,
    cropBox,
    cropPreset,
    targetCropClip,
    cropPixelX,
    cropPixelY,
    cropPixelW,
    cropPixelH,
    mw,
    mh,
    mediaDisplayW,
    mediaDisplayH,
    handleEnterCropMode,
    handleCropDragStart,
    handleApplyPresetCrop,
    handleResetCrop,
    handleCancelCrop,
    handleConfirmCrop,
    cropResponders: {
      pan: cropPanResponder,
      tl: cropTLResponder,
      tr: cropTRResponder,
      bl: cropBLResponder,
      br: cropBRResponder,
      t: cropTResponder,
      b: cropBResponder,
      l: cropLResponder,
      r: cropRResponder,
    },
  };
}
