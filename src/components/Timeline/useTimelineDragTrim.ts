import { useRef } from "react";
import { UnifiedClipItem } from "./timelineTypes";
import { useTimelineClipDrag } from "./useTimelineClipDrag";
import { useTimelineClipTrim } from "./useTimelineClipTrim";

interface UseTimelineDragTrimParams {
  allClips: UnifiedClipItem[];
  selectedClipId: string | null;
  activeTrackCount: number;
  pxPerSec: number;
  isSnappingEnabled: boolean;
  isHapticEnabled: boolean;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onSelectClip: (
    id: string,
    type: "video" | "audio" | "text" | "sticker" | "effects",
  ) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  onMoveClip?: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
    newStartTime: number,
    newTrackIndex?: number,
  ) => void;
  onTrimClip?: (
    clipId: string,
    updates: {
      startTime?: number;
      duration?: number;
      trimIn?: number;
      trimOut?: number;
      trackIndex?: number;
    },
    isFinal?: boolean,
  ) => void;
}

export function useTimelineDragTrim({
  allClips,
  selectedClipId,
  activeTrackCount,
  pxPerSec,
  isSnappingEnabled,
  isHapticEnabled,
  currentTime,
  onSeek,
  onSelectClip,
  onOpenEditModal,
  onMoveClip,
  onTrimClip,
}: UseTimelineDragTrimParams) {
  const isTrimmingActiveRef = useRef(false);

  const {
    dragState,
    setDragState,
    isDraggingClip,
    setIsDraggingClip,
    clipMovePanResponder,
    handleClipPress,
    handleClipLongPress,
    handleClipMouseDown,
    handleClipTouchStart,
    handleClipTouchMove,
    handleClipTouchEnd,
    handleClipTouchCancel,
    cancelClipDrag,
  } = useTimelineClipDrag({
    allClips,
    selectedClipId,
    activeTrackCount,
    pxPerSec,
    isSnappingEnabled,
    isHapticEnabled,
    isTrimmingActiveRef,
    currentTime,
    onSeek,
    onSelectClip,
    onOpenEditModal,
    onMoveClip,
  });

  const {
    activeTrimming,
    activeTrimDelta,
    leftTrimPanResponder,
    rightTrimPanResponder,
    handleLeftTrimStart,
    handleRightTrimStart,
  } = useTimelineClipTrim({
    allClips,
    selectedClipId,
    pxPerSec,
    isHapticEnabled,
    isTrimmingActiveRef,
    onTrimClip,
  });

  return {
    activeTrimming,
    activeTrimDelta,
    dragState,
    setDragState,
    isDraggingClip,
    setIsDraggingClip,
    clipMovePanResponder,
    leftTrimPanResponder,
    rightTrimPanResponder,
    handleClipPress,
    handleClipLongPress,
    handleClipMouseDown,
    handleClipTouchStart,
    handleClipTouchMove,
    handleClipTouchEnd,
    handleClipTouchCancel,
    cancelClipDrag,
    handleLeftTrimStart,
    handleRightTrimStart,
  };
}
