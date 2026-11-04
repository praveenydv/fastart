import { useState, useRef, useMemo, useCallback } from "react";
import { PanResponder, Platform } from "react-native";
import { triggerHaptic } from "../../utils/haptics";
import {
  UnifiedClipItem,
  TRACK_ROW_HEIGHT,
  MAX_TRACKS,
  TimelineDragState,
} from "./timelineTypes";
import { clampNonOverlapping, getPointerCoords } from "./timelineUtils";
import { getPlaybackTime } from "../../utils/playbackTimeStore";

interface UseTimelineClipDragParams {
  allClips: UnifiedClipItem[];
  selectedClipId: string | null;
  activeTrackCount: number;
  trackRowHeight?: number;
  pxPerSec: number;
  isSnappingEnabled: boolean;
  isHapticEnabled: boolean;
  isTrimmingActiveRef: React.MutableRefObject<boolean>;
  onSeek?: (time: number) => void;
  onSelectClip: (
    id: string,
    type: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
  ) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  onMoveClip?: (
    clipId: string,
    trackType: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
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
  wasInsertingNewTrack: boolean = false,
  previousInsertTrack: number | null = null,
  currentTime?: number,
  cachedDraggingClip?: UnifiedClipItem,
  cachedOtherClips?: UnifiedClipItem[],
  rowHeight: number = TRACK_ROW_HEIGHT,
) {
  const rawTrackPos = initialTrack - deltaYPixels / rowHeight;

  // Other clips excluding the one being dragged (uses precomputed cache during active drag)
  const otherClips = cachedOtherClips || allClips.filter((c) => c.id !== clipId);

  let desiredStart = Math.max(0, initialStart + deltaX);

  // Magnetic Snapping against all other clips, playhead, and timeline bounds
  if (isSnappingEnabled) {
    const snapThresholdSec = Math.min(1.5, 24 / pxPerSec);
    let bestSnap = desiredStart;
    let snapDist = snapThresholdSec;

    // 1. Snap to Timeline Start (0)
    if (Math.abs(desiredStart) < snapDist) {
      bestSnap = 0;
      snapDist = Math.abs(desiredStart);
    }

    // 2. Snap to Playhead / Current Time
    if (typeof currentTime === "number" && currentTime >= 0) {
      if (Math.abs(desiredStart - currentTime) < snapDist) {
        bestSnap = currentTime;
        snapDist = Math.abs(desiredStart - currentTime);
      }
      if (Math.abs(desiredStart + duration - currentTime) < snapDist) {
        bestSnap = Math.max(0, currentTime - duration);
        snapDist = Math.abs(desiredStart + duration - currentTime);
      }
    }

    // 3. Multi-track Magnetic Snapping:
    // Pass 1: Start-to-Start alignment (highest priority for multi-track synchronization!)
    // Prioritizes matching clip starts across all tracks, giving counterpart clips (sharing URL or sourceMediaId) priority
    const draggingClip = cachedDraggingClip || allClips.find((c) => c.id === clipId);
    const draggingSourceId = draggingClip?.rawClip?.sourceMediaId || draggingClip?.rawClip?.id || clipId;
    const draggingUrl = draggingClip?.rawClip?.url;

    otherClips.forEach((other) => {
      const otherSourceId = other.rawClip?.sourceMediaId || other.rawClip?.id || other.id;
      const isCounterpart =
        (draggingSourceId && otherSourceId && draggingSourceId === otherSourceId) ||
        (draggingUrl && other.rawClip?.url && draggingUrl === other.rawClip.url);

      const effectiveThreshold = isCounterpart ? snapThresholdSec * 1.5 : snapThresholdSec;
      const diff = Math.abs(desiredStart - other.startTime);

      if (diff < effectiveThreshold && diff < snapDist) {
        bestSnap = other.startTime;
        snapDist = diff;
      }
    });

    // Pass 2: Other edge alignments (Start-to-End, End-to-Start, End-to-End)
    otherClips.forEach((other) => {
      const otherEnd = other.startTime + other.duration;

      // Start-to-End: Sequential snap
      if (Math.abs(desiredStart - otherEnd) < snapDist) {
        bestSnap = otherEnd;
        snapDist = Math.abs(desiredStart - otherEnd);
      }
      // End-to-Start: Snap my end to other's start
      if (Math.abs(desiredStart + duration - other.startTime) < snapDist) {
        bestSnap = Math.max(0, other.startTime - duration);
        snapDist = Math.abs(desiredStart + duration - other.startTime);
      }
      // End-to-End: Align ends across tracks
      if (Math.abs(desiredStart + duration - otherEnd) < snapDist) {
        bestSnap = Math.max(0, otherEnd - duration);
        snapDist = Math.abs(desiredStart + duration - otherEnd);
      }
    });

    desiredStart = bestSnap;
  }

  // Nearest track index based on pointer vertical position
  const nearestTrack = Math.max(
    0,
    Math.min(activeTrackCount - 1, Math.round(rawTrackPos)),
  );

  const otherClipsOnNearest = otherClips.filter(
    (c) => c.effectiveTrackIndex === nearestTrack,
  );

  const hasOverlapOnNearest = otherClipsOnNearest.some((other) => {
    const otherEnd = other.startTime + other.duration;
    return (
      desiredStart < otherEnd - 0.05 && desiredStart + duration > other.startTime + 0.05
    );
  });

  // Track emptiness helper (from perspective of other clips during drag)
  const isTrackEmpty = (t: number) => {
    if (t < 0 || t >= activeTrackCount) return false;
    return !otherClips.some((c) => c.effectiveTrackIndex === t);
  };

  // Seam and boundary detection for track insertion
  const baseTrack = Math.floor(rawTrackPos);
  const fraction = rawTrackPos - baseTrack;

  // 1. Moving to Top side (above highest active track in timeline)
  const isDraggingAboveTop = rawTrackPos >= activeTrackCount - 0.15;

  // 2. Moving to Bottom side (below track 0 / main track)
  const isDraggingPastBottom = rawTrackPos <= 0.15;

  // 3. Hovering between tracks (seam between baseTrack and baseTrack + 1)
  const isHoveringBetweenTracks =
    baseTrack >= 0 &&
    baseTrack < activeTrackCount - 1 &&
    fraction >= 0.28 &&
    fraction <= 0.72;

  let isInsertingNewTrack = false;
  let insertTrackIndex: number | null = null;
  let targetTrack = nearestTrack;

  if (activeTrackCount < MAX_TRACKS) {
    if (isDraggingAboveTop) {
      isInsertingNewTrack = true;
      insertTrackIndex = activeTrackCount;
      targetTrack = activeTrackCount;
    } else if (isDraggingPastBottom) {
      isInsertingNewTrack = true;
      insertTrackIndex = 0;
      targetTrack = 0;
    } else if (isHoveringBetweenTracks) {
      isInsertingNewTrack = true;
      insertTrackIndex = baseTrack + 1;
      targetTrack = baseTrack + 1;
    } else if (wasInsertingNewTrack) {
      // Hysteresis: smoothly maintain insertion until cursor is unambiguously inside a track body
      const isClearlyInsideTrack = fraction < 0.20 || fraction > 0.80;
      if (
        isClearlyInsideTrack &&
        rawTrackPos > 0.25 &&
        rawTrackPos < activeTrackCount - 0.25
      ) {
        isInsertingNewTrack = false;
        targetTrack = nearestTrack;
      } else {
        isInsertingNewTrack = true;
        insertTrackIndex =
          previousInsertTrack !== null ? previousInsertTrack : baseTrack + 1;
        targetTrack = insertTrackIndex;
      }
    }
  }

  // If inserting new track: clip's horizontal start time is maintained cleanly
  if (isInsertingNewTrack) {
    return {
      targetTrack,
      rawStart: desiredStart,
      clampedStart: desiredStart,
      isInsertingNewTrack: true,
      insertTrackIndex,
      hasOverlap: false,
    };
  }

  // If not inserting new track and overlap exists: clamp to non-overlapping position
  let clampedStart = desiredStart;
  if (hasOverlapOnNearest) {
    clampedStart = clampNonOverlapping(
      desiredStart,
      duration,
      otherClipsOnNearest,
    );
  }

  return {
    targetTrack,
    rawStart: desiredStart,
    clampedStart,
    isInsertingNewTrack: false,
    insertTrackIndex: null,
    hasOverlap: hasOverlapOnNearest,
  };
}

export function useTimelineClipDrag({
  allClips,
  selectedClipId,
  activeTrackCount,
  trackRowHeight,
  pxPerSec,
  isSnappingEnabled,
  isHapticEnabled,
  isTrimmingActiveRef,
  onSeek,
  onSelectClip,
  onOpenEditModal,
  onMoveClip,
}: UseTimelineClipDragParams) {
  const rowHeight = trackRowHeight || TRACK_ROW_HEIGHT;
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;
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
  const panDragRafRef = useRef<number | null>(null);
  const latestDragStateRef = useRef<TimelineDragState | null>(null);
  const touchMoveRafRef = useRef<number | null>(null);
  const latestTouchDragStateRef = useRef<TimelineDragState | null>(null);
  const cachedDraggingClipRef = useRef<UnifiedClipItem | undefined>(undefined);
  const cachedOtherClipsRef = useRef<UnifiedClipItem[] | undefined>(undefined);
  const lastTapRef = useRef({ time: 0, clipId: "" });
  const lastDragEndTimeRef = useRef(0);

  // Touch tracking state for mobile gesture handling
  const touchStateRef = useRef<{
    clipId: string;
    trackType: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption";
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
      trackType: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
    ) => {
      // Ignore click only if an actual drag just completed within 350ms
      if (Date.now() - lastDragEndTimeRef.current < 350) return;
      if (isDraggingClip) return;

      const now = Date.now();
      const elapsed = now - lastTapRef.current.time;

      // Ignore redundant immediate duplicate event for the exact same click
      if (elapsed < 60 && lastTapRef.current.clipId === clipId) {
        return;
      }

      const clip = allClipsRef.current.find((c) => c.id === clipId);
      if (clip && onSeekRef.current) {
        const cur = getPlaybackTime();
        if (cur < clip.startTime || cur > clip.startTime + clip.duration) {
          onSeekRef.current(clip.startTime);
        }
      }

      if (
        elapsed < 350 &&
        lastTapRef.current.clipId === clipId
      ) {
        lastTapRef.current = { time: 0, clipId: "" };
        triggerHaptic("selection", isHapticEnabledRef.current);
        onSelectClip(clipId, trackType);
        onOpenEditModal?.(clipId, trackType);
      } else {
        lastTapRef.current = { time: now, clipId };
        triggerHaptic("selection", isHapticEnabledRef.current);
        onSelectClip(clipId, trackType);
      }
    },
    [onSelectClip, onOpenEditModal, isDraggingClip],
  );

  // Explicit safety cleanup function
  const cancelClipDrag = useCallback(() => {
    lastDragEndTimeRef.current = Date.now();
    if (touchStateRef.current?.timer) {
      clearTimeout(touchStateRef.current.timer);
    }
    if (touchMoveRafRef.current !== null) {
      cancelAnimationFrame(touchMoveRafRef.current);
      touchMoveRafRef.current = null;
    }
    touchStateRef.current = null;
    clipDragStartInfoRef.current = null;
    cachedDraggingClipRef.current = undefined;
    cachedOtherClipsRef.current = undefined;
    setIsDraggingClip(false);
    setDragState(null);
  }, []);

  // Mobile Touch Gestures: passive tracking without premature drag lock
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
        timer: null,
      };
    },
    [isTrimmingActiveRef],
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
        // If moved > 8px, user is scrolling the timeline: mark moved
        if (dist > 8) {
          state.hasMoved = true;
        }
        return;
      }

      // Dragging is active: stop native page scrolling
      if (e.cancelable && e.preventDefault) {
        e.preventDefault();
      }

      const deltaX = deltaXPixels / pxPerSecRef.current;
      const minY = (state.initialTrack - activeTrackCount - 1) * rowHeightRef.current;
      const maxY = (state.initialTrack + 1) * rowHeightRef.current;
      const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

      const { targetTrack, rawStart, clampedStart, isInsertingNewTrack, insertTrackIndex, hasOverlap } =
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
          previousIsInsertingRef.current,
          previousInsertTrackRef.current,
          getPlaybackTime(),
          cachedDraggingClipRef.current,
          cachedOtherClipsRef.current,
          rowHeightRef.current,
        );

      const hasTrackChanged = previousTargetTrackRef.current !== targetTrack;
      if (hasTrackChanged && previousTargetTrackRef.current !== null) {
        triggerHaptic("selection", isHapticEnabledRef.current);
      }
      previousTargetTrackRef.current = targetTrack;
      previousIsInsertingRef.current = isInsertingNewTrack;
      previousInsertTrackRef.current = insertTrackIndex;

      latestTouchDragStateRef.current = {
        clipId: state.clipId,
        currentStart: rawStart,
        targetStart: clampedStart,
        currentTrack: targetTrack,
        dragOffsetY,
        isInsertingNewTrack,
        insertTrackIndex,
        hasOverlap,
      };

      if (touchMoveRafRef.current === null) {
        touchMoveRafRef.current = requestAnimationFrame(() => {
          touchMoveRafRef.current = null;
          if (latestTouchDragStateRef.current) {
            setDragState(latestTouchDragStateRef.current);
          }
        });
      }
    },
    [activeTrackCount],
  );

  // Mobile Touch End (Clean drop & exit)
  const handleClipTouchEnd = useCallback(
    (e: any) => {
      if (touchMoveRafRef.current !== null) {
        cancelAnimationFrame(touchMoveRafRef.current);
        touchMoveRafRef.current = null;
      }
      cachedDraggingClipRef.current = undefined;
      cachedOtherClipsRef.current = undefined;

      const state = touchStateRef.current;
      if (state?.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }

      if (state?.isDragging || isDraggingClip) {
        lastDragEndTimeRef.current = Date.now();
        const currentDrag = latestTouchDragStateRef.current || dragStateRef.current;
        setIsDraggingClip(false);
        setDragState(null);
        latestTouchDragStateRef.current = null;
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
            triggerHaptic("light", isHapticEnabledRef.current);
            onMoveClipRef.current(
              state.clipId,
              state.trackType,
              finalStart,
              finalTrack,
              isInsert,
            );
            if (onSeekRef.current) {
              const prevOffset = getPlaybackTime() - state.initialStart;
              if (prevOffset >= 0 && prevOffset <= state.duration) {
                onSeekRef.current(
                  Math.max(0, finalStart + prevOffset),
                );
              } else if (
                getPlaybackTime() < finalStart ||
                getPlaybackTime() > finalStart + state.duration
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

  // Mobile Long-Press handler with full touch tracking on Web and Native
  const handleClipLongPress = useCallback(
    (
      clipId: string,
      trackType: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
      initialStartTime: number,
      initialTrackIndex: number,
      duration: number,
    ) => {
      triggerHaptic("medium", isHapticEnabledRef.current);
      onSelectClip(clipId, trackType);
      setIsDraggingClip(true);

      const clip = allClipsRef.current.find((c) => c.id === clipId);
      cachedDraggingClipRef.current = clip;
      cachedOtherClipsRef.current = allClipsRef.current.filter((c) => c.id !== clipId);

      clipDragStartInfoRef.current = {
        clipId,
        trackType,
        initialStart: initialStartTime,
        initialTrack: initialTrackIndex,
        duration,
      };
      previousTargetTrackRef.current = initialTrackIndex;
      previousIsInsertingRef.current = false;
      previousInsertTrackRef.current = null;

      setDragState({
        clipId,
        currentStart: initialStartTime,
        targetStart: initialStartTime,
        currentTrack: initialTrackIndex,
        dragOffsetY: 0,
      });

      if (touchStateRef.current) {
        touchStateRef.current.isDragging = true;
      }

      if (Platform.OS === "web" && typeof window !== "undefined") {
        let latestStart = initialStartTime;
        let latestTrack = initialTrackIndex;
        let isInsert = false;
        let insertIndex: number | null = null;
        let startClientX: number | null = null;
        let startClientY: number | null = null;
        let pendingRaf: number | null = null;

        const onTouchMove = (moveEvt: TouchEvent) => {
          if (!moveEvt.touches || moveEvt.touches.length === 0) return;
          const touch = moveEvt.touches[0];
          if (startClientX === null || startClientY === null) {
            startClientX = touch.clientX;
            startClientY = touch.clientY;
            return;
          }
          if (moveEvt.cancelable) moveEvt.preventDefault();

          const deltaXPixels = touch.clientX - startClientX;
          const deltaYPixels = touch.clientY - startClientY;
          const deltaX = deltaXPixels / pxPerSecRef.current;
          const minY = (initialTrackIndex - activeTrackCount - 1) * rowHeightRef.current;
          const maxY = (initialTrackIndex + 1) * rowHeightRef.current;
          const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

          const { targetTrack, rawStart, clampedStart, isInsertingNewTrack, insertTrackIndex, hasOverlap } =
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
              previousIsInsertingRef.current,
              previousInsertTrackRef.current,
              getPlaybackTime(),
              cachedDraggingClipRef.current,
              cachedOtherClipsRef.current,
              rowHeightRef.current,
            );

          const hasTrackChanged = previousTargetTrackRef.current !== targetTrack;
          if (hasTrackChanged && previousTargetTrackRef.current !== null) {
            triggerHaptic("selection", isHapticEnabledRef.current);
          }
          previousTargetTrackRef.current = targetTrack;
          previousIsInsertingRef.current = isInsertingNewTrack;
          previousInsertTrackRef.current = insertTrackIndex;

          latestStart = clampedStart;
          latestTrack = targetTrack;
          isInsert = isInsertingNewTrack;
          insertIndex = insertTrackIndex;

          if (pendingRaf === null) {
            pendingRaf = requestAnimationFrame(() => {
              pendingRaf = null;
              setDragState({
                clipId,
                currentStart: rawStart,
                targetStart: clampedStart,
                currentTrack: targetTrack,
                dragOffsetY,
                isInsertingNewTrack,
                insertTrackIndex,
                hasOverlap,
              });
            });
          }
        };

        const onTouchEnd = () => {
          if (pendingRaf !== null) {
            cancelAnimationFrame(pendingRaf);
            pendingRaf = null;
          }
          window.removeEventListener("touchmove", onTouchMove);
          window.removeEventListener("touchend", onTouchEnd);
          window.removeEventListener("touchcancel", onTouchEnd);
          window.removeEventListener("mouseup", onTouchEnd);

          lastDragEndTimeRef.current = Date.now();
          setIsDraggingClip(false);
          setDragState(null);
          clipDragStartInfoRef.current = null;
          previousIsInsertingRef.current = false;
          previousInsertTrackRef.current = null;
          cachedDraggingClipRef.current = undefined;
          cachedOtherClipsRef.current = undefined;

          const hasPositionChanged =
            isInsert ||
            Math.abs(latestStart - initialStartTime) > 0.01 ||
            latestTrack !== initialTrackIndex;

          if (hasPositionChanged && onMoveClipRef.current) {
            triggerHaptic("light", isHapticEnabledRef.current);
            const finalTrack = isInsert && insertIndex !== null ? insertIndex : latestTrack;
            onMoveClipRef.current(clipId, trackType, latestStart, finalTrack, isInsert);
            if (onSeekRef.current) {
              onSeekRef.current(latestStart);
            }
          }
        };

        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd, { once: true });
        window.addEventListener("touchcancel", onTouchEnd, { once: true });
        window.addEventListener("mouseup", onTouchEnd, { once: true });
      }
    },
    [activeTrackCount, onSelectClip],
  );

  // Desktop Mouse Drag handler
  const handleClipMouseDown = useCallback(
    (
      e: any,
      clipId: string,
      trackType: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
      initialStartTime: number,
      initialTrackIndex: number,
      duration: number,
    ) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      // Do not allow touch pointer events to trigger mouse drag!
      if (e?.nativeEvent?.pointerType === "touch" || e?.pointerType === "touch") return;
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
            cachedDraggingClipRef.current = allClipsRef.current.find((c) => c.id === clipId);
            cachedOtherClipsRef.current = allClipsRef.current.filter((c) => c.id !== clipId);
            triggerHaptic("selection", isHapticEnabledRef.current);
            onSelectClip(clipId, trackType);
          } else {
            return;
          }
        }

        const deltaX = deltaXPixels / pxPerSecRef.current;
        const minY = (initialTrackIndex - activeTrackCount - 1) * rowHeightRef.current;
        const maxY = (initialTrackIndex + 1) * rowHeightRef.current;
        const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

        const { targetTrack, rawStart, clampedStart, isInsertingNewTrack, insertTrackIndex, hasOverlap } =
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
            previousIsInsertingRef.current,
            previousInsertTrackRef.current,
            getPlaybackTime(),
            cachedDraggingClipRef.current,
            cachedOtherClipsRef.current,
            rowHeightRef.current,
          );

        const hasTrackChanged = previousTargetTrackRef.current !== targetTrack;
        if (hasTrackChanged && previousTargetTrackRef.current !== null) {
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
              hasOverlap,
            });
          });
        }
      };

      const onUp = () => {
        if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setIsDraggingClip(false);
        cachedDraggingClipRef.current = undefined;
        cachedOtherClipsRef.current = undefined;

        if (hasStartedDragging) {
          lastDragEndTimeRef.current = Date.now();
          const currentDrag = dragStateRef.current;
          setDragState(null);
          previousIsInsertingRef.current = false;
          previousInsertTrackRef.current = null;
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
        } else {
          // Stationary click on desktop web: select clip!
          handleClipPress(clipId, trackType);
        }
      };

      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }
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
        cachedDraggingClipRef.current = clip;
        cachedOtherClipsRef.current = allClipsRef.current.filter((c) => c.id !== clip.id);
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
        const minY = (info.initialTrack - activeTrackCount - 1) * rowHeightRef.current;
        const maxY = (info.initialTrack + 1) * rowHeightRef.current;
        const dragOffsetY = Math.max(minY - 12, Math.min(maxY + 12, deltaYPixels));

        const { targetTrack, rawStart, clampedStart, isInsertingNewTrack, insertTrackIndex, hasOverlap } =
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
            previousIsInsertingRef.current,
            previousInsertTrackRef.current,
            getPlaybackTime(),
            cachedDraggingClipRef.current,
            cachedOtherClipsRef.current,
            rowHeightRef.current,
          );

        const hasTrackChanged = previousTargetTrackRef.current !== targetTrack;
        if (hasTrackChanged && previousTargetTrackRef.current !== null) {
          triggerHaptic("selection", isHapticEnabledRef.current);
        }
        previousTargetTrackRef.current = targetTrack;
        previousIsInsertingRef.current = isInsertingNewTrack;
        previousInsertTrackRef.current = insertTrackIndex;

        const nextState: TimelineDragState = {
          clipId: info.clipId,
          currentStart: rawStart,
          targetStart: clampedStart,
          currentTrack: targetTrack,
          dragOffsetY,
          isInsertingNewTrack,
          insertTrackIndex,
          hasOverlap,
        };
        latestDragStateRef.current = nextState;
        dragStateRef.current = nextState;

        if (panDragRafRef.current === null) {
          panDragRafRef.current = requestAnimationFrame(() => {
            panDragRafRef.current = null;
            if (latestDragStateRef.current) {
              setDragState(latestDragStateRef.current);
            }
          });
        }
      },
      onPanResponderRelease: () => {
        lastDragEndTimeRef.current = Date.now();
        if (panDragRafRef.current !== null) {
          cancelAnimationFrame(panDragRafRef.current);
          panDragRafRef.current = null;
        }
        const info = clipDragStartInfoRef.current;
        const currentDrag = dragStateRef.current;
        setIsDraggingClip(false);
        setDragState(null);
        latestDragStateRef.current = null;
        clipDragStartInfoRef.current = null;
        cachedDraggingClipRef.current = undefined;
        cachedOtherClipsRef.current = undefined;
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
            triggerHaptic("light", isHapticEnabledRef.current);
            onMoveClipRef.current(
              info.clipId,
              info.trackType,
              finalStart,
              finalTrack,
              isInsert,
            );
            if (onSeekRef.current) {
              const prevOffset = getPlaybackTime() - info.initialStart;
              if (prevOffset >= 0 && prevOffset <= info.duration) {
                onSeekRef.current(
                  Math.max(0, finalStart + prevOffset),
                );
              } else if (
                getPlaybackTime() < finalStart ||
                getPlaybackTime() > finalStart + info.duration
              ) {
                onSeekRef.current(finalStart);
              }
            }
          }
        }
      },
      onPanResponderTerminate: () => {
        lastDragEndTimeRef.current = Date.now();
        if (panDragRafRef.current !== null) {
          cancelAnimationFrame(panDragRafRef.current);
          panDragRafRef.current = null;
        }
        setIsDraggingClip(false);
        setDragState(null);
        latestDragStateRef.current = null;
        clipDragStartInfoRef.current = null;
        cachedDraggingClipRef.current = undefined;
        cachedOtherClipsRef.current = undefined;
        previousIsInsertingRef.current = false;
        previousInsertTrackRef.current = null;
      },
    });
  }, [activeTrackCount]);

  return useMemo(
    () => ({
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
      lastDragEndTimeRef,
    }),
    [
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
    ],
  );
}
