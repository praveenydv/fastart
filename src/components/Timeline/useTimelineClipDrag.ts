import { useState, useRef, useMemo, useCallback } from "react";
import { PanResponder, Platform } from "react-native";
import { soundEngine } from "../../utils/audioEngine";
import { triggerHaptic } from "../../utils/haptics";
import {
  UnifiedClipItem,
  TRACK_ROW_HEIGHT,
} from "./timelineTypes";
import { clampNonOverlapping, getPointerCoords } from "./timelineUtils";

interface UseTimelineClipDragParams {
  allClips: UnifiedClipItem[];
  selectedClipId: string | null;
  activeTrackCount: number;
  pxPerSec: number;
  isSnappingEnabled: boolean;
  isHapticEnabled: boolean;
  isTrimmingActiveRef: React.MutableRefObject<boolean>;
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
}

export function useTimelineClipDrag({
  allClips,
  selectedClipId,
  activeTrackCount,
  pxPerSec,
  isSnappingEnabled,
  isHapticEnabled,
  isTrimmingActiveRef,
  onSelectClip,
  onOpenEditModal,
  onMoveClip,
}: UseTimelineClipDragParams) {
  const [dragState, setDragState] = useState<{
    clipId: string;
    currentStart: number;
    currentTrack: number;
  } | null>(null);

  const [isDraggingClip, setIsDraggingClip] = useState(false);

  // Mutable refs
  const allClipsRef = useRef(allClips);
  allClipsRef.current = allClips;
  const selectedClipIdRef = useRef(selectedClipId);
  selectedClipIdRef.current = selectedClipId;
  const pxPerSecRef = useRef(pxPerSec);
  pxPerSecRef.current = pxPerSec;
  const isSnappingEnabledRef = useRef(isSnappingEnabled);
  isSnappingEnabledRef.current = isSnappingEnabled;
  const isHapticEnabledRef = useRef(isHapticEnabled);
  isHapticEnabledRef.current = isHapticEnabled;
  const onMoveClipRef = useRef(onMoveClip);
  onMoveClipRef.current = onMoveClip;

  const clipDragStartInfoRef = useRef<any>(null);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const lastTapRef = useRef({ time: 0, clipId: "" });

  // Unified Clip Press handler (mobile & web)
  const handleClipPress = useCallback(
    (
      clipId: string,
      trackType: "video" | "audio" | "text" | "sticker" | "effects",
    ) => {
      const now = Date.now();
      if (
        now - lastTapRef.current.time < 350 &&
        lastTapRef.current.clipId === clipId
      ) {
        lastTapRef.current = { time: 0, clipId: "" };
        soundEngine.playSfx("click");
        triggerHaptic("selection", isHapticEnabledRef.current);
        onSelectClip(clipId, trackType);
        onOpenEditModal?.(clipId, trackType);
      } else {
        lastTapRef.current = { time: now, clipId };
        soundEngine.playSfx("click");
        triggerHaptic("selection", isHapticEnabledRef.current);
        onSelectClip(clipId, trackType);
      }
    },
    [onSelectClip, onOpenEditModal],
  );

  // Mobile Long-Press handler to pick up and drag any clip
  const handleClipLongPress = useCallback(
    (
      clipId: string,
      trackType: "video" | "audio" | "text" | "sticker" | "effects",
      initialStartTime: number,
      initialTrackIndex: number,
      duration: number,
    ) => {
      soundEngine.playSfx("pop");
      triggerHaptic("medium", isHapticEnabledRef.current);
      onSelectClip(clipId, trackType);
      setIsDraggingClip(true);
      clipDragStartInfoRef.current = {
        clipId,
        trackType,
        initialStart: initialStartTime,
        initialTrack: initialTrackIndex,
        duration,
      };
      setDragState({
        clipId,
        currentStart: initialStartTime,
        currentTrack: initialTrackIndex,
      });
    },
    [onSelectClip],
  );

  // Desktop Mouse Drag handler
  const handleClipMouseDown = useCallback(
    (
      e: any,
      clipId: string,
      trackType: "video" | "audio" | "text" | "sticker" | "effects",
      initialStartTime: number,
      initialTrackIndex: number,
      duration: number,
    ) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      if (e.button !== 0) return;
      if (isTrimmingActiveRef.current) return;
      if (
        e.target &&
        e.target.closest &&
        (e.target.closest('[data-trim-handle="true"]') ||
          e.target.closest('[data-trim]') ||
          e.target.closest(".trim-handle-box"))
      ) {
        return;
      }

      const { clientX: startClientX, clientY: startClientY } =
        getPointerCoords(e);
      let hasStartedDragging = false;
      let latestStart = initialStartTime;
      let latestTrack = initialTrackIndex;
      let pendingRaf: number | null = null;

      const onMove = (moveEvt: MouseEvent) => {
        const { clientX, clientY } = getPointerCoords(moveEvt);
        const deltaXPixels = clientX - startClientX;
        const deltaYPixels = clientY - startClientY;
        const moveDistance = Math.hypot(deltaXPixels, deltaYPixels);

        if (!hasStartedDragging) {
          if (moveDistance >= 5) {
            hasStartedDragging = true;
            setIsDraggingClip(true);
            soundEngine.playSfx("click");
            triggerHaptic("selection", isHapticEnabledRef.current);
            onSelectClip(clipId, trackType);
          } else {
            return;
          }
        }

        const deltaX = deltaXPixels / pxPerSecRef.current;
        const trackShift = Math.round(deltaYPixels / TRACK_ROW_HEIGHT);
        const targetTrack = Math.max(
          0,
          Math.min(activeTrackCount - 1, initialTrackIndex + trackShift),
        );

        const otherClipsOnTarget = allClipsRef.current.filter(
          (c) => c.id !== clipId && c.effectiveTrackIndex === targetTrack,
        );

        let desiredStart = Math.max(0, initialStartTime + deltaX);

        if (isSnappingEnabledRef.current) {
          const snapThresholdSec = 12 / pxPerSecRef.current;
          let bestSnap = desiredStart;
          let snapDist = snapThresholdSec;

          if (Math.abs(desiredStart) < snapDist) {
            bestSnap = 0;
            snapDist = Math.abs(desiredStart);
          }

          otherClipsOnTarget.forEach((other) => {
            const otherEnd = other.startTime + other.duration;
            if (Math.abs(desiredStart - otherEnd) < snapDist) {
              bestSnap = otherEnd;
              snapDist = Math.abs(desiredStart - otherEnd);
            }
            if (Math.abs(desiredStart + duration - other.startTime) < snapDist) {
              bestSnap = Math.max(0, other.startTime - duration);
              snapDist = Math.abs(desiredStart + duration - other.startTime);
            }
          });

          if (bestSnap !== desiredStart) {
            triggerHaptic("selection", isHapticEnabledRef.current);
          }
          desiredStart = bestSnap;
        }

        const clampedStart = clampNonOverlapping(
          desiredStart,
          duration,
          otherClipsOnTarget,
        );

        latestStart = clampedStart;
        latestTrack = targetTrack;

        if (pendingRaf === null) {
          pendingRaf = requestAnimationFrame(() => {
            pendingRaf = null;
            setDragState({
              clipId,
              currentStart: clampedStart,
              currentTrack: targetTrack,
            });
          });
        }
      };

      const onUp = () => {
        if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setIsDraggingClip(false);

        if (hasStartedDragging) {
          setDragState(null);
          soundEngine.playSfx("pop");
          triggerHaptic("light", isHapticEnabledRef.current);
          if (onMoveClipRef.current) {
            onMoveClipRef.current(clipId, trackType, latestStart, latestTrack);
          }
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [activeTrackCount, isTrimmingActiveRef, onSelectClip],
  );

  // Universal PanResponder for moving selected clips smoothly on mobile & web
  const clipMovePanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1,
      onPanResponderGrant: () => {
        const clip = allClipsRef.current.find(
          (c) => c.id === selectedClipIdRef.current,
        );
        if (!clip) return;
        setIsDraggingClip(true);
        soundEngine.playSfx("click");
        triggerHaptic("selection", isHapticEnabledRef.current);
        clipDragStartInfoRef.current = {
          clipId: clip.id,
          trackType: clip.type,
          initialStart: clip.startTime,
          initialTrack: clip.effectiveTrackIndex,
          duration: clip.duration,
        };
        setDragState({
          clipId: clip.id,
          currentStart: clip.startTime,
          currentTrack: clip.effectiveTrackIndex,
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const info = clipDragStartInfoRef.current;
        if (!info) return;
        const deltaX = gestureState.dx / pxPerSecRef.current;
        const trackShift = Math.round(gestureState.dy / TRACK_ROW_HEIGHT);
        const targetTrack = Math.max(
          0,
          Math.min(activeTrackCount - 1, info.initialTrack + trackShift),
        );

        const otherClipsOnTarget = allClipsRef.current.filter(
          (c) => c.id !== info.clipId && c.effectiveTrackIndex === targetTrack,
        );

        let desiredStart = Math.max(0, info.initialStart + deltaX);

        if (isSnappingEnabledRef.current) {
          const snapThresholdSec = 12 / pxPerSecRef.current;
          let bestSnap = desiredStart;
          let snapDist = snapThresholdSec;

          if (Math.abs(desiredStart) < snapDist) {
            bestSnap = 0;
            snapDist = Math.abs(desiredStart);
          }

          otherClipsOnTarget.forEach((other) => {
            const otherEnd = other.startTime + other.duration;
            if (Math.abs(desiredStart - otherEnd) < snapDist) {
              bestSnap = otherEnd;
              snapDist = Math.abs(desiredStart - otherEnd);
            }
            if (
              Math.abs(desiredStart + info.duration - other.startTime) < snapDist
            ) {
              bestSnap = Math.max(0, other.startTime - info.duration);
              snapDist = Math.abs(
                desiredStart + info.duration - other.startTime,
              );
            }
          });

          if (bestSnap !== desiredStart) {
            triggerHaptic("selection", isHapticEnabledRef.current);
          }
          desiredStart = bestSnap;
        }

        const clampedStart = clampNonOverlapping(
          desiredStart,
          info.duration,
          otherClipsOnTarget,
        );

        setDragState({
          clipId: info.clipId,
          currentStart: clampedStart,
          currentTrack: targetTrack,
        });
      },
      onPanResponderRelease: () => {
        const info = clipDragStartInfoRef.current;
        const currentDrag = dragStateRef.current;
        setIsDraggingClip(false);
        setDragState(null);
        clipDragStartInfoRef.current = null;
        if (info && currentDrag && onMoveClipRef.current) {
          soundEngine.playSfx("pop");
          triggerHaptic("light", isHapticEnabledRef.current);
          onMoveClipRef.current(
            info.clipId,
            info.trackType,
            currentDrag.currentStart,
            currentDrag.currentTrack,
          );
        }
      },
      onPanResponderTerminate: () => {
        setIsDraggingClip(false);
        setDragState(null);
        clipDragStartInfoRef.current = null;
      },
    });
  }, [activeTrackCount]);

  return {
    dragState,
    setDragState,
    isDraggingClip,
    setIsDraggingClip,
    clipMovePanResponder,
    handleClipPress,
    handleClipLongPress,
    handleClipMouseDown,
  };
}
