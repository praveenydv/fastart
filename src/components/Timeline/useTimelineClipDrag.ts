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
}

// Universal snap & non-overlapping position calculator
function computeTargetPosition(
  deltaX: number,
  trackShift: number,
  initialStart: number,
  initialTrack: number,
  duration: number,
  clipId: string,
  activeTrackCount: number,
  pxPerSec: number,
  allClips: UnifiedClipItem[],
  isSnappingEnabled: boolean,
  isHapticEnabled: boolean,
) {
  const targetTrack = Math.max(
    0,
    Math.min(activeTrackCount - 1, initialTrack + trackShift),
  );

  const otherClipsOnTarget = allClips.filter(
    (c) => c.id !== clipId && c.effectiveTrackIndex === targetTrack,
  );

  let desiredStart = Math.max(0, initialStart + deltaX);

  if (isSnappingEnabled) {
    const snapThresholdSec = 12 / pxPerSec;
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
      triggerHaptic("selection", isHapticEnabled);
    }
    desiredStart = bestSnap;
  }

  const clampedStart = clampNonOverlapping(
    desiredStart,
    duration,
    otherClipsOnTarget,
  );

  return { targetTrack, clampedStart };
}

export function useTimelineClipDrag({
  allClips,
  selectedClipId,
  activeTrackCount,
  pxPerSec,
  isSnappingEnabled,
  isHapticEnabled,
  isTrimmingActiveRef,
  currentTime = 0,
  onSeek,
  onSelectClip,
  onOpenEditModal,
  onMoveClip,
}: UseTimelineClipDragParams) {
  const [dragState, setDragState] = useState<{
    clipId: string;
    currentStart: number;
    currentTrack: number;
    dragOffsetY: number;
  } | null>(null);

  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const previousTargetTrackRef = useRef<number | null>(null);

  // Mutable refs
  const allClipsRef = useRef(allClips);
  allClipsRef.current = allClips;
  const selectedClipIdRef = useRef(selectedClipId);
  selectedClipIdRef.current = selectedClipId;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
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

  // Touch tracking state for mobile gesture handling
  const touchStateRef = useRef<{
    clipId: string;
    trackType: "video" | "audio" | "text" | "sticker" | "effects";
    startX: number;
    startY: number;
    initialStart: number;
    initialTrack: number;
    duration: number;
    startTime: number;
    isDragging: boolean;
    hasMoved: boolean;
    timer: any;
  } | null>(null);

  // Unified Clip Press handler (tap / double tap)
  const handleClipPress = useCallback(
    (
      clipId: string,
      trackType: "video" | "audio" | "text" | "sticker" | "effects",
    ) => {
      const clip = allClipsRef.current.find((c) => c.id === clipId);
      if (clip && onSeekRef.current) {
        const cur = currentTimeRef.current;
        if (cur < clip.startTime || cur > clip.startTime + clip.duration) {
          onSeekRef.current(clip.startTime);
        }
      }

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

  // Explicit safety cleanup function
  const cancelClipDrag = useCallback(() => {
    if (touchStateRef.current?.timer) {
      clearTimeout(touchStateRef.current.timer);
    }
    touchStateRef.current = null;
    clipDragStartInfoRef.current = null;
    setIsDraggingClip(false);
    setDragState(null);
  }, []);

  // Mobile Touch Gestures (TouchStart with 200ms hold-to-lift)
  const handleClipTouchStart = useCallback(
    (
      e: any,
      clip: UnifiedClipItem,
      trackIdx: number,
    ) => {
      if (isTrimmingActiveRef.current) return;

      // Check if touch is near trim handles on an already-selected clip
      const isSelected = selectedClipIdRef.current === clip.id;
      if (isSelected) {
        const locX = e.nativeEvent?.locationX ?? -1;
        const clipPxWidth = Math.max(24, clip.duration * pxPerSecRef.current);
        if (locX >= 0 && (locX <= 26 || locX >= clipPxWidth - 26)) {
          // Touching trim handles, leave gesture to trim pan responder
          return;
        }
      }

      const coords = getPointerCoords(e);
      const startX = coords.clientX;
      const startY = coords.clientY;

      if (touchStateRef.current?.timer) {
        clearTimeout(touchStateRef.current.timer);
      }

      // 200ms hold timer to lift clip and start drag mode
      const timer = setTimeout(() => {
        soundEngine.playSfx("pop");
        triggerHaptic("medium", isHapticEnabledRef.current);
        onSelectClip(clip.id, clip.type);
        setIsDraggingClip(true);

        if (touchStateRef.current) {
          touchStateRef.current.isDragging = true;
        }

        clipDragStartInfoRef.current = {
          clipId: clip.id,
          trackType: clip.type,
          initialStart: clip.startTime,
          initialTrack: trackIdx,
          duration: clip.duration,
        };

        previousTargetTrackRef.current = trackIdx;
        setDragState({
          clipId: clip.id,
          currentStart: clip.startTime,
          currentTrack: trackIdx,
          dragOffsetY: 0,
        });
      }, 200);

      touchStateRef.current = {
        clipId: clip.id,
        trackType: clip.type,
        startX,
        startY,
        initialStart: clip.startTime,
        initialTrack: trackIdx,
        duration: clip.duration,
        startTime: Date.now(),
        isDragging: false,
        hasMoved: false,
        timer,
      };
    },
    [isTrimmingActiveRef, onSelectClip],
  );

  // Mobile Touch Move
  const handleClipTouchMove = useCallback(
    (e: any) => {
      const state = touchStateRef.current;
      if (!state) return;

      const coords = getPointerCoords(e);
      const deltaXPixels = coords.clientX - state.startX;
      const deltaYPixels = coords.clientY - state.startY;
      const dist = Math.hypot(deltaXPixels, deltaYPixels);

      if (!state.isDragging) {
        // If moved > 8px before timer fired, user is scrolling the timeline
        if (dist > 8) {
          if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
          }
          state.hasMoved = true;
        }
        return;
      }

      // Dragging is active: stop native page scrolling
      if (e.cancelable && e.preventDefault) {
        e.preventDefault();
      }

      const deltaX = deltaXPixels / pxPerSecRef.current;
      const trackShift = Math.round(deltaYPixels / TRACK_ROW_HEIGHT);
      const minY = -state.initialTrack * TRACK_ROW_HEIGHT;
      const maxY = (activeTrackCount - 1 - state.initialTrack) * TRACK_ROW_HEIGHT;
      const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

      const { targetTrack, clampedStart } = computeTargetPosition(
        deltaX,
        trackShift,
        state.initialStart,
        state.initialTrack,
        state.duration,
        state.clipId,
        activeTrackCount,
        pxPerSecRef.current,
        allClipsRef.current,
        isSnappingEnabledRef.current,
        isHapticEnabledRef.current,
      );

      if (
        previousTargetTrackRef.current !== null &&
        previousTargetTrackRef.current !== targetTrack
      ) {
        soundEngine.playSfx("pop");
        triggerHaptic("selection", isHapticEnabledRef.current);
      }
      previousTargetTrackRef.current = targetTrack;

      setDragState({
        clipId: state.clipId,
        currentStart: clampedStart,
        currentTrack: targetTrack,
        dragOffsetY,
      });
    },
    [activeTrackCount],
  );

  // Mobile Touch End (Clean drop & exit)
  const handleClipTouchEnd = useCallback(
    (e: any) => {
      const state = touchStateRef.current;
      if (state?.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }

      if (state?.isDragging || isDraggingClip) {
        const currentDrag = dragStateRef.current;
        setIsDraggingClip(false);
        setDragState(null);
        clipDragStartInfoRef.current = null;

        if (state && currentDrag && onMoveClipRef.current) {
          const hasPositionChanged =
            Math.abs(currentDrag.currentStart - state.initialStart) > 0.01 ||
            currentDrag.currentTrack !== state.initialTrack;

          if (hasPositionChanged) {
            soundEngine.playSfx("pop");
            triggerHaptic("light", isHapticEnabledRef.current);
            onMoveClipRef.current(
              state.clipId,
              state.trackType,
              currentDrag.currentStart,
              currentDrag.currentTrack,
            );
          }
        }
        touchStateRef.current = null;
        return;
      }

      setIsDraggingClip(false);
      setDragState(null);
      touchStateRef.current = null;
    },
    [isDraggingClip],
  );

  // Mobile Touch Cancel
  const handleClipTouchCancel = useCallback(() => {
    cancelClipDrag();
  }, [cancelClipDrag]);

  // Mobile Long-Press handler with auto-exit on release
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
        dragOffsetY: 0,
      });

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const cleanup = () => {
          window.removeEventListener("mouseup", cleanup);
          window.removeEventListener("touchend", cleanup);
          setIsDraggingClip(false);
          setDragState(null);
          clipDragStartInfoRef.current = null;
        };
        window.addEventListener("mouseup", cleanup, { once: true });
        window.addEventListener("touchend", cleanup, { once: true });
      }
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
          if (moveDistance >= 4) {
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
        const minY = -initialTrackIndex * TRACK_ROW_HEIGHT;
        const maxY = (activeTrackCount - 1 - initialTrackIndex) * TRACK_ROW_HEIGHT;
        const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

        const { targetTrack, clampedStart } = computeTargetPosition(
          deltaX,
          trackShift,
          initialStartTime,
          initialTrackIndex,
          duration,
          clipId,
          activeTrackCount,
          pxPerSecRef.current,
          allClipsRef.current,
          isSnappingEnabledRef.current,
          isHapticEnabledRef.current,
        );

        if (
          previousTargetTrackRef.current !== null &&
          previousTargetTrackRef.current !== targetTrack
        ) {
          soundEngine.playSfx("pop");
          triggerHaptic("selection", isHapticEnabledRef.current);
        }
        previousTargetTrackRef.current = targetTrack;

        latestStart = clampedStart;
        latestTrack = targetTrack;

        if (pendingRaf === null) {
          pendingRaf = requestAnimationFrame(() => {
            pendingRaf = null;
            setDragState({
              clipId,
              currentStart: latestStart,
              currentTrack: latestTrack,
              dragOffsetY,
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

  // Universal PanResponder for moving selected clips via center grip pill
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
        soundEngine.playSfx("pop");
        triggerHaptic("medium", isHapticEnabledRef.current);
        clipDragStartInfoRef.current = {
          clipId: clip.id,
          trackType: clip.type,
          initialStart: clip.startTime,
          initialTrack: clip.effectiveTrackIndex,
          duration: clip.duration,
        };
        previousTargetTrackRef.current = clip.effectiveTrackIndex;
        setDragState({
          clipId: clip.id,
          currentStart: clip.startTime,
          currentTrack: clip.effectiveTrackIndex,
          dragOffsetY: 0,
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const info = clipDragStartInfoRef.current;
        if (!info) return;

        const deltaX = gestureState.dx / pxPerSecRef.current;
        const deltaYPixels = gestureState.dy;
        const trackShift = Math.round(deltaYPixels / TRACK_ROW_HEIGHT);
        const minY = -info.initialTrack * TRACK_ROW_HEIGHT;
        const maxY = (activeTrackCount - 1 - info.initialTrack) * TRACK_ROW_HEIGHT;
        const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

        const { targetTrack, clampedStart } = computeTargetPosition(
          deltaX,
          trackShift,
          info.initialStart,
          info.initialTrack,
          info.duration,
          info.clipId,
          activeTrackCount,
          pxPerSecRef.current,
          allClipsRef.current,
          isSnappingEnabledRef.current,
          isHapticEnabledRef.current,
        );

        if (
          previousTargetTrackRef.current !== null &&
          previousTargetTrackRef.current !== targetTrack
        ) {
          soundEngine.playSfx("pop");
          triggerHaptic("selection", isHapticEnabledRef.current);
        }
        previousTargetTrackRef.current = targetTrack;

        setDragState({
          clipId: info.clipId,
          currentStart: clampedStart,
          currentTrack: targetTrack,
          dragOffsetY,
        });
      },
      onPanResponderRelease: () => {
        const info = clipDragStartInfoRef.current;
        const currentDrag = dragStateRef.current;
        setIsDraggingClip(false);
        setDragState(null);
        clipDragStartInfoRef.current = null;
        if (info && currentDrag && onMoveClipRef.current) {
          const hasPositionChanged =
            Math.abs(currentDrag.currentStart - info.initialStart) > 0.01 ||
            currentDrag.currentTrack !== info.initialTrack;
          if (hasPositionChanged) {
            soundEngine.playSfx("pop");
            triggerHaptic("light", isHapticEnabledRef.current);
            onMoveClipRef.current(
              info.clipId,
              info.trackType,
              currentDrag.currentStart,
              currentDrag.currentTrack,
            );
          }
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
    handleClipTouchStart,
    handleClipTouchMove,
    handleClipTouchEnd,
    handleClipTouchCancel,
    cancelClipDrag,
  };
}
