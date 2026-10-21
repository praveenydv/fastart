import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { PanResponder, Platform } from "react-native";
import { soundEngine } from "../../utils/audioEngine";
import { triggerHaptic } from "../../utils/haptics";
import { UnifiedClipItem } from "./timelineTypes";
import { getPointerCoords } from "./timelineUtils";

interface UseTimelineScrubbingParams {
  currentTime: number;
  totalDuration: number;
  pxPerSec: number;
  allClips: UnifiedClipItem[];
  isSnappingEnabled: boolean;
  isHapticEnabled: boolean;
  onSeek: (time: number) => void;
  rulerRef: React.RefObject<any>;
}

export function useTimelineScrubbing({
  currentTime,
  totalDuration,
  pxPerSec,
  allClips,
  isSnappingEnabled,
  isHapticEnabled,
  onSeek,
  rulerRef,
}: UseTimelineScrubbingParams) {
  const [isScrubbingRuler, setIsScrubbingRuler] = useState(false);
  const isDraggingPlayhead = useRef(false);
  const dragStartTimeRef = useRef(0);
  const latestClientXRef = useRef(0);

  // Keep references to prevent recreating panResponders
  const pxPerSecRef = useRef(pxPerSec);
  pxPerSecRef.current = pxPerSec;
  const totalDurationRef = useRef(totalDuration);
  totalDurationRef.current = totalDuration;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const allClipsRef = useRef(allClips);
  allClipsRef.current = allClips;
  const isSnappingEnabledRef = useRef(isSnappingEnabled);
  isSnappingEnabledRef.current = isSnappingEnabled;
  const isHapticEnabledRef = useRef(isHapticEnabled);
  isHapticEnabledRef.current = isHapticEnabled;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  const performSeekWithSnap = useCallback((clickX: number) => {
    const pxVal = pxPerSecRef.current;
    const maxDur = Math.max(1, totalDurationRef.current);
    let newTime = Math.max(0, Math.min(maxDur, clickX / pxVal));

    if (isSnappingEnabledRef.current) {
      const snapThresholdSec = 10 / pxVal;
      let closestSnap: number | null = null;
      let minDiff = snapThresholdSec;

      if (Math.abs(newTime) < minDiff) {
        closestSnap = 0;
        minDiff = Math.abs(newTime);
      }

      allClipsRef.current.forEach((c) => {
        const diffStart = Math.abs(newTime - c.startTime);
        if (diffStart < minDiff) {
          closestSnap = c.startTime;
          minDiff = diffStart;
        }
        const diffEnd = Math.abs(newTime - (c.startTime + c.duration));
        if (diffEnd < minDiff) {
          closestSnap = c.startTime + c.duration;
          minDiff = diffEnd;
        }
        const kfs = c.rawClip?.keyframes;
        if (kfs && Array.isArray(kfs)) {
          kfs.forEach((kf: any) => {
            const kfTime = c.startTime + (kf.time || 0);
            const diffKf = Math.abs(newTime - kfTime);
            if (diffKf < minDiff) {
              closestSnap = kfTime;
              minDiff = diffKf;
            }
          });
        }
      });

      if (closestSnap !== null) {
        newTime = closestSnap;
        triggerHaptic("selection", isHapticEnabledRef.current);
      }
    }

    onSeekRef.current(Number(newTime.toFixed(3)));
  }, []);

  // React Native PanResponder for smooth playhead needle & diamond head dragging on mobile
  const playheadPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 1,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dx) > 1,
      onPanResponderGrant: () => {
        isDraggingPlayhead.current = true;
        setIsScrubbingRuler(true);
        soundEngine.playSfx("click");
        triggerHaptic("selection", isHapticEnabledRef.current);
        dragStartTimeRef.current = currentTimeRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const dx = gestureState.dx;
        const initialTime = dragStartTimeRef.current;
        const pxPerSecVal = pxPerSecRef.current;
        const deltaSec = dx / pxPerSecVal;
        const maxDur = Math.max(1, totalDurationRef.current);
        let newTime = Math.max(0, Math.min(maxDur, initialTime + deltaSec));

        if (isSnappingEnabledRef.current) {
          const snapThresholdSec = 10 / pxPerSecVal;
          let closestSnap: number | null = null;
          let minDiff = snapThresholdSec;

          if (Math.abs(newTime) < minDiff) {
            closestSnap = 0;
            minDiff = Math.abs(newTime);
          }

          allClipsRef.current.forEach((c) => {
            const diffStart = Math.abs(newTime - c.startTime);
            if (diffStart < minDiff) {
              closestSnap = c.startTime;
              minDiff = diffStart;
            }
            const diffEnd = Math.abs(newTime - (c.startTime + c.duration));
            if (diffEnd < minDiff) {
              closestSnap = c.startTime + c.duration;
              minDiff = diffEnd;
            }
            const kfs = c.rawClip?.keyframes;
            if (kfs && Array.isArray(kfs)) {
              kfs.forEach((kf: any) => {
                const kfTime = c.startTime + (kf.time || 0);
                const diffKf = Math.abs(newTime - kfTime);
                if (diffKf < minDiff) {
                  closestSnap = kfTime;
                  minDiff = diffKf;
                }
              });
            }
          });

          if (closestSnap !== null) {
            newTime = closestSnap;
            triggerHaptic("selection", isHapticEnabledRef.current);
          }
        }

        onSeekRef.current(Number(newTime.toFixed(3)));
      },
      onPanResponderRelease: () => {
        isDraggingPlayhead.current = false;
        setIsScrubbingRuler(false);
      },
      onPanResponderTerminate: () => {
        isDraggingPlayhead.current = false;
        setIsScrubbingRuler(false);
      },
    });
  }, []);

  // Universal Time Ruler PanResponder (mobile touch + web pointer)
  const rulerPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 1,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dx) > 1,
      onPanResponderGrant: (evt) => {
        isDraggingPlayhead.current = true;
        setIsScrubbingRuler(true);
        soundEngine.playSfx("click");
        triggerHaptic("selection", isHapticEnabledRef.current);

        let clickX = 0;
        if (Platform.OS === "web" && rulerRef.current) {
          const rect = rulerRef.current.getBoundingClientRect();
          const coords = getPointerCoords(evt);
          clickX = coords.clientX - rect.left;
        } else {
          clickX = evt.nativeEvent?.locationX || 0;
        }
        performSeekWithSnap(clickX);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isDraggingPlayhead.current) return;
        let clickX = 0;
        if (Platform.OS === "web" && rulerRef.current) {
          const rect = rulerRef.current.getBoundingClientRect();
          const coords = getPointerCoords(evt);
          clickX = coords.clientX - rect.left;
        } else {
          clickX =
            evt.nativeEvent?.locationX ??
            currentTimeRef.current * pxPerSecRef.current + gestureState.dx;
        }
        performSeekWithSnap(clickX);
      },
      onPanResponderRelease: () => {
        isDraggingPlayhead.current = false;
        setIsScrubbingRuler(false);
      },
      onPanResponderTerminate: () => {
        isDraggingPlayhead.current = false;
        setIsScrubbingRuler(false);
      },
    });
  }, [performSeekWithSnap, rulerRef]);

  // Tap or drag on ruler / playhead to seek
  const updateSeekFromPointer = useCallback(
    (e: any) => {
      let clickX = 0;
      if (Platform.OS === "web") {
        const el = rulerRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const { clientX } = getPointerCoords(e);
          latestClientXRef.current = clientX;
          clickX = clientX - rect.left;
        }
      } else {
        clickX = e.nativeEvent?.locationX || 0;
      }
      performSeekWithSnap(clickX);
    },
    [performSeekWithSnap, rulerRef],
  );

  const handleRulerPointerDown = useCallback(
    (e: any) => {
      isDraggingPlayhead.current = true;
      setIsScrubbingRuler(true);
      soundEngine.playSfx("click");
      triggerHaptic("selection", isHapticEnabledRef.current);
      updateSeekFromPointer(e);
    },
    [updateSeekFromPointer],
  );

  const handlePlayheadPointerDown = useCallback(
    (e: any) => {
      if (e?.stopPropagation) e.stopPropagation();
      if (e?.preventDefault && e.cancelable) e.preventDefault();
      isDraggingPlayhead.current = true;
      setIsScrubbingRuler(true);
      soundEngine.playSfx("click");
      triggerHaptic("selection", isHapticEnabledRef.current);
      updateSeekFromPointer(e);
    },
    [updateSeekFromPointer],
  );

  // Global window listeners for desktop playhead / ruler scrubbing (coalesced with RAF for 60fps smooth seeking)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    let pendingRaf: number | null = null;

    const performSeek = () => {
      pendingRaf = null;
      const el = rulerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const clickX = latestClientXRef.current - rect.left;
        performSeekWithSnap(clickX);
      }
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (isDraggingPlayhead.current) {
        if ("touches" in e && e.cancelable) {
          e.preventDefault();
        }
        const { clientX } = getPointerCoords(e);
        latestClientXRef.current = clientX;
        if (pendingRaf === null) {
          pendingRaf = requestAnimationFrame(performSeek);
        }
      }
    };

    const onPointerUp = () => {
      if (isDraggingPlayhead.current) {
        isDraggingPlayhead.current = false;
        setIsScrubbingRuler(false);
        if (pendingRaf !== null) {
          cancelAnimationFrame(pendingRaf);
          performSeek();
        }
      }
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove as any, {
      passive: false,
    });
    window.addEventListener("touchend", onPointerUp);
    window.addEventListener("touchcancel", onPointerUp);
    return () => {
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchmove", onPointerMove as any);
      window.removeEventListener("touchend", onPointerUp);
      window.removeEventListener("touchcancel", onPointerUp);
    };
  }, [performSeekWithSnap, rulerRef]);

  return {
    isScrubbingRuler,
    performSeekWithSnap,
    playheadPanResponder,
    rulerPanResponder,
    handleRulerPointerDown,
    handlePlayheadPointerDown,
  };
}
