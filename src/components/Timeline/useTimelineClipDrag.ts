import { useState, useRef, useMemo, useCallback } from "react";
import { PanResponder, Platform } from "react-native";
import { soundEngine } from "../../utils/audioEngine";
import { triggerHaptic } from "../../utils/haptics";
import {
  UnifiedClipItem,
  TRACK_ROW_HEIGHT,
  MAX_TRACKS,
  TimelineDragState,
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
    type: "video" | "audio" | "text" | "sticker" | "effects" | "caption",
  ) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  onMoveClip?: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects" | "caption",
    newStartTime: number,
    newTrackIndex?: number,
    isInsertNewTrack?: boolean,
  ) => void;
}

// Universal snap, in-between track creation & non-overlapping position calculator
function computeTargetPosition(
  deltaX: number,
  deltaYPixels: number,
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
  const rawTrackPos = initialTrack + deltaYPixels / TRACK_ROW_HEIGHT;

  // Check if any existing active track is currently empty
  const usedTracks = new Set(
    allClips
      .filter((c) => c.id !== clipId)
      .map((c) => c.effectiveTrackIndex),
  );
  const hasEmptyTrack = Array.from({ length: activeTrackCount }).some(
    (_, idx) => !usedTracks.has(idx),
  );

  let isInsertingNewTrack = false;
  let insertTrackIndex: number | null = null;
  let targetTrack = Math.max(
    0,
    Math.min(activeTrackCount - 1, Math.round(rawTrackPos)),
  );

  // If there is already an empty track, DO NOT create a new track (use the empty track)!
  // If NO empty track exists AND user specifically drags below the bottom track, target a new bottom track
  if (!hasEmptyTrack && activeTrackCount < MAX_TRACKS && rawTrackPos >= activeTrackCount - 0.25) {
    isInsertingNewTrack = true;
    insertTrackIndex = activeTrackCount;
    targetTrack = activeTrackCount;
  }

  let desiredStart = Math.max(0, initialStart + deltaX);

  // If hovering over an insertion slot for a new track, no other clips exist on it yet
  if (isInsertingNewTrack) {
    if (isSnappingEnabled) {
      const snapThresholdSec = 12 / pxPerSec;
      if (Math.abs(desiredStart) < snapThresholdSec) {
        desiredStart = 0;
      }
    }
    return {
      targetTrack,
      rawStart: desiredStart,
      clampedStart: desiredStart,
      isInsertingNewTrack,
      insertTrackIndex,
    };
  }

  const otherClipsOnTarget = allClips.filter(
    (c) => c.id !== clipId && c.effectiveTrackIndex === targetTrack,
  );

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

  return {
    targetTrack,
    rawStart: desiredStart,
    clampedStart,
    isInsertingNewTrack: false,
    insertTrackIndex: null,
  };
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
  const [dragState, setDragState] = useState<TimelineDragState | null>(null);

  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const previousTargetTrackRef = useRef<number | null>(null);
  const previousIsInsertingRef = useRef<boolean>(false);
  const previousInsertTrackRef = useRef<number | null>(null);

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
    trackType: "video" | "audio" | "text" | "sticker" | "effects" | "caption";
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
      trackType: "video" | "audio" | "text" | "sticker" | "effects" | "caption",
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
          targetStart: clip.startTime,
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
      const minY = (-state.initialTrack - 1) * TRACK_ROW_HEIGHT;
      const maxY = (activeTrackCount - state.initialTrack) * TRACK_ROW_HEIGHT;
      const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

      const { targetTrack, rawStart, clampedStart, isInsertingNewTrack, insertTrackIndex } =
        computeTargetPosition(
          deltaX,
          deltaYPixels,
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

      const hasChangedState =
        previousTargetTrackRef.current !== targetTrack ||
        previousIsInsertingRef.current !== isInsertingNewTrack ||
        previousInsertTrackRef.current !== insertTrackIndex;

      if (hasChangedState) {
        soundEngine.playSfx("pop");
        triggerHaptic("selection", isHapticEnabledRef.current);
      }
      previousTargetTrackRef.current = targetTrack;
      previousIsInsertingRef.current = isInsertingNewTrack;
      previousInsertTrackRef.current = insertTrackIndex;

      setDragState({
        clipId: state.clipId,
        currentStart: rawStart,
        targetStart: clampedStart,
        currentTrack: targetTrack,
        dragOffsetY,
        isInsertingNewTrack,
        insertTrackIndex,
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
        previousIsInsertingRef.current = false;
        previousInsertTrackRef.current = null;

        if (state && currentDrag && onMoveClipRef.current) {
          const isInsert = !!currentDrag.isInsertingNewTrack;
          const finalTrack = isInsert
            ? (currentDrag.insertTrackIndex ?? currentDrag.currentTrack)
            : currentDrag.currentTrack;
          const finalStart = currentDrag.targetStart ?? currentDrag.currentStart;

          const hasPositionChanged =
            isInsert ||
            Math.abs(finalStart - state.initialStart) > 0.01 ||
            finalTrack !== state.initialTrack;

          if (hasPositionChanged) {
            soundEngine.playSfx("pop");
            triggerHaptic("light", isHapticEnabledRef.current);
            onMoveClipRef.current(
              state.clipId,
              state.trackType,
              finalStart,
              finalTrack,
              isInsert,
            );
            if (onSeekRef.current) {
              const prevOffset = currentTimeRef.current - state.initialStart;
              if (prevOffset >= 0 && prevOffset <= state.duration) {
                onSeekRef.current(
                  Math.max(0, finalStart + prevOffset),
                );
              } else if (
                currentTimeRef.current < finalStart ||
                currentTimeRef.current > finalStart + state.duration
              ) {
                onSeekRef.current(finalStart);
              }
            }
          }
        }
        touchStateRef.current = null;
        return;
      }

      setIsDraggingClip(false);
      setDragState(null);
      touchStateRef.current = null;
      previousIsInsertingRef.current = false;
      previousInsertTrackRef.current = null;
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
      trackType: "video" | "audio" | "text" | "sticker" | "effects" | "caption",
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
        targetStart: initialStartTime,
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
          previousIsInsertingRef.current = false;
          previousInsertTrackRef.current = null;
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
      trackType: "video" | "audio" | "text" | "sticker" | "effects" | "caption",
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
        const minY = (-initialTrackIndex - 1) * TRACK_ROW_HEIGHT;
        const maxY = (activeTrackCount - initialTrackIndex) * TRACK_ROW_HEIGHT;
        const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

        const { targetTrack, rawStart, clampedStart, isInsertingNewTrack, insertTrackIndex } =
          computeTargetPosition(
            deltaX,
            deltaYPixels,
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

        const hasChangedState =
          previousTargetTrackRef.current !== targetTrack ||
          previousIsInsertingRef.current !== isInsertingNewTrack ||
          previousInsertTrackRef.current !== insertTrackIndex;

        if (hasChangedState) {
          soundEngine.playSfx("pop");
          triggerHaptic("selection", isHapticEnabledRef.current);
        }
        previousTargetTrackRef.current = targetTrack;
        previousIsInsertingRef.current = isInsertingNewTrack;
        previousInsertTrackRef.current = insertTrackIndex;

        latestStart = clampedStart;
        const currentRaw = rawStart;
        latestTrack = targetTrack;

        if (pendingRaf === null) {
          pendingRaf = requestAnimationFrame(() => {
            pendingRaf = null;
            setDragState({
              clipId,
              currentStart: currentRaw,
              targetStart: latestStart,
              currentTrack: latestTrack,
              dragOffsetY,
              isInsertingNewTrack,
              insertTrackIndex,
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
          const currentDrag = dragStateRef.current;
          setDragState(null);
          previousIsInsertingRef.current = false;
          previousInsertTrackRef.current = null;
          soundEngine.playSfx("pop");
          triggerHaptic("light", isHapticEnabledRef.current);
          if (onMoveClipRef.current) {
            const isInsert = !!currentDrag?.isInsertingNewTrack;
            const finalTrack = isInsert
              ? (currentDrag?.insertTrackIndex ?? latestTrack)
              : latestTrack;
            const finalStart = currentDrag?.targetStart ?? latestStart;
            onMoveClipRef.current(
              clipId,
              trackType,
              finalStart,
              finalTrack,
              isInsert,
            );
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
          targetStart: clip.startTime,
          currentTrack: clip.effectiveTrackIndex,
          dragOffsetY: 0,
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const info = clipDragStartInfoRef.current;
        if (!info) return;

        const deltaX = gestureState.dx / pxPerSecRef.current;
        const deltaYPixels = gestureState.dy;
        const minY = (-info.initialTrack - 1) * TRACK_ROW_HEIGHT;
        const maxY = (activeTrackCount - info.initialTrack) * TRACK_ROW_HEIGHT;
        const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

        const { targetTrack, rawStart, clampedStart, isInsertingNewTrack, insertTrackIndex } =
          computeTargetPosition(
            deltaX,
            deltaYPixels,
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

        const hasChangedState =
          previousTargetTrackRef.current !== targetTrack ||
          previousIsInsertingRef.current !== isInsertingNewTrack ||
          previousInsertTrackRef.current !== insertTrackIndex;

        if (hasChangedState) {
          soundEngine.playSfx("pop");
          triggerHaptic("selection", isHapticEnabledRef.current);
        }
        previousTargetTrackRef.current = targetTrack;
        previousIsInsertingRef.current = isInsertingNewTrack;
        previousInsertTrackRef.current = insertTrackIndex;

        setDragState({
          clipId: info.clipId,
          currentStart: rawStart,
          targetStart: clampedStart,
          currentTrack: targetTrack,
          dragOffsetY,
          isInsertingNewTrack,
          insertTrackIndex,
        });
      },
      onPanResponderRelease: () => {
        const info = clipDragStartInfoRef.current;
        const currentDrag = dragStateRef.current;
        setIsDraggingClip(false);
        setDragState(null);
        clipDragStartInfoRef.current = null;
        previousIsInsertingRef.current = false;
        previousInsertTrackRef.current = null;

        if (info && currentDrag && onMoveClipRef.current) {
          const isInsert = !!currentDrag.isInsertingNewTrack;
          const finalTrack = isInsert
            ? (currentDrag.insertTrackIndex ?? currentDrag.currentTrack)
            : currentDrag.currentTrack;
          const finalStart = currentDrag.targetStart ?? currentDrag.currentStart;

          const hasPositionChanged =
            isInsert ||
            Math.abs(finalStart - info.initialStart) > 0.01 ||
            finalTrack !== info.initialTrack;

          if (hasPositionChanged) {
            soundEngine.playSfx("pop");
            triggerHaptic("light", isHapticEnabledRef.current);
            onMoveClipRef.current(
              info.clipId,
              info.trackType,
              finalStart,
              finalTrack,
              isInsert,
            );
            if (onSeekRef.current) {
              const prevOffset = currentTimeRef.current - info.initialStart;
              if (prevOffset >= 0 && prevOffset <= info.duration) {
                onSeekRef.current(
                  Math.max(0, finalStart + prevOffset),
                );
              } else if (
                currentTimeRef.current < finalStart ||
                currentTimeRef.current > finalStart + info.duration
              ) {
                onSeekRef.current(finalStart);
              }
            }
          }
        }
      },
      onPanResponderTerminate: () => {
        setIsDraggingClip(false);
        setDragState(null);
        clipDragStartInfoRef.current = null;
        previousIsInsertingRef.current = false;
        previousInsertTrackRef.current = null;
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
