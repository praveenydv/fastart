import { useState, useRef, useMemo, useCallback } from "react";
import { PanResponder, Platform } from "react-native";
import { soundEngine } from "../../utils/audioEngine";
import { triggerHaptic } from "../../utils/haptics";
import { getMediaDuration } from "../../utils/mediaDuration";
import { UnifiedClipItem } from "./timelineTypes";
import { getPointerCoords } from "./timelineUtils";
import {
  computeLeftTrimUpdates,
  computeRightTrimUpdates,
} from "./timelineTrimHelper";

interface UseTimelineClipTrimParams {
  allClips: UnifiedClipItem[];
  selectedClipId: string | null;
  pxPerSec: number;
  isHapticEnabled: boolean;
  isTrimmingActiveRef: React.MutableRefObject<boolean>;
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

export function useTimelineClipTrim({
  allClips,
  selectedClipId,
  pxPerSec,
  isHapticEnabled,
  isTrimmingActiveRef,
  onTrimClip,
}: UseTimelineClipTrimParams) {
  const [activeTrimming, setActiveTrimming] = useState<{
    clipId: string;
    side: "left" | "right";
  } | null>(null);

  const [activeTrimDelta, setActiveTrimDelta] = useState<{
    clipId: string;
    side: "left" | "right";
    startTime: number;
    duration: number;
  } | null>(null);

  const allClipsRef = useRef(allClips);
  allClipsRef.current = allClips;
  const selectedClipIdRef = useRef(selectedClipId);
  selectedClipIdRef.current = selectedClipId;
  const pxPerSecRef = useRef(pxPerSec);
  pxPerSecRef.current = pxPerSec;
  const isHapticEnabledRef = useRef(isHapticEnabled);
  isHapticEnabledRef.current = isHapticEnabled;
  const onTrimClipRef = useRef(onTrimClip);
  onTrimClipRef.current = onTrimClip;

  const trimStartInfoRef = useRef<any>(null);
  const activeTrimDeltaRef = useRef(activeTrimDelta);
  activeTrimDeltaRef.current = activeTrimDelta;

  // Universal Left Trim PanResponder (Android, iOS & Web)
  const leftTrimPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        const clip = allClipsRef.current.find(
          (c) => c.id === selectedClipIdRef.current,
        );
        if (!clip) return;
        isTrimmingActiveRef.current = true;
        setActiveTrimming({ clipId: clip.id, side: "left" });
        soundEngine.playSfx("click");
        triggerHaptic("selection", isHapticEnabledRef.current);
        trimStartInfoRef.current = {
          clipId: clip.id,
          side: "left",
          initialStart: clip.startTime,
          initialDur: clip.duration,
          initialTrimIn: clip.rawClip?.trimIn || 0,
          initialTrimOut: clip.rawClip?.trimOut || clip.duration,
          trackIndex: clip.effectiveTrackIndex,
        };
      },
      onPanResponderMove: (_, gestureState) => {
        const info = trimStartInfoRef.current;
        if (!info || !isTrimmingActiveRef.current) return;
        const targetClip = allClipsRef.current.find(
          (c) => c.id === info.clipId,
        );
        if (!targetClip) return;

        const deltaX = gestureState.dx / pxPerSecRef.current;
        const updates = computeLeftTrimUpdates(
          targetClip,
          info.initialStart,
          info.initialDur,
          info.initialTrimIn,
          info.trackIndex,
          deltaX,
          allClipsRef.current,
        );

        setActiveTrimDelta({
          clipId: info.clipId,
          side: "left",
          startTime: updates.startTime,
          duration: updates.duration,
        });
        if (onTrimClipRef.current) {
          onTrimClipRef.current(info.clipId, updates, false);
        }
      },
      onPanResponderRelease: () => {
        const info = trimStartInfoRef.current;
        const activeDelta = activeTrimDeltaRef.current;
        if (info && activeDelta && onTrimClipRef.current) {
          const targetClip = allClipsRef.current.find(
            (c) => c.id === info.clipId,
          );
          const speed = Math.max(
            0.1,
            Math.min(16, targetClip?.rawClip?.speed || 1.0),
          );
          const deltaStart = activeDelta.startTime - info.initialStart;
          const newTrimIn = Math.max(
            0,
            info.initialTrimIn + deltaStart * speed,
          );
          onTrimClipRef.current(
            info.clipId,
            {
              startTime: activeDelta.startTime,
              duration: activeDelta.duration,
              trimIn: Number(newTrimIn.toFixed(3)),
              trackIndex: info.trackIndex,
            },
            true,
          );
        }
        setActiveTrimDelta(null);
        setActiveTrimming(null);
        trimStartInfoRef.current = null;
        soundEngine.playSfx("pop");
        triggerHaptic("light", isHapticEnabledRef.current);
        setTimeout(() => {
          isTrimmingActiveRef.current = false;
        }, 50);
      },
      onPanResponderTerminate: () => {
        setActiveTrimDelta(null);
        setActiveTrimming(null);
        trimStartInfoRef.current = null;
        isTrimmingActiveRef.current = false;
      },
    });
  }, [isTrimmingActiveRef]);

  // Universal Right Trim PanResponder (Android, iOS & Web)
  const rightTrimPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        const clip = allClipsRef.current.find(
          (c) => c.id === selectedClipIdRef.current,
        );
        if (!clip) return;
        isTrimmingActiveRef.current = true;
        setActiveTrimming({ clipId: clip.id, side: "right" });
        soundEngine.playSfx("click");
        triggerHaptic("selection", isHapticEnabledRef.current);
        trimStartInfoRef.current = {
          clipId: clip.id,
          side: "right",
          initialStart: clip.startTime,
          initialDur: clip.duration,
          initialTrimIn: clip.rawClip?.trimIn || 0,
          initialTrimOut: clip.rawClip?.trimOut || clip.duration,
          trackIndex: clip.effectiveTrackIndex,
        };
      },
      onPanResponderMove: (_, gestureState) => {
        const info = trimStartInfoRef.current;
        if (!info || !isTrimmingActiveRef.current) return;
        const targetClip = allClipsRef.current.find(
          (c) => c.id === info.clipId,
        );
        if (!targetClip) return;

        const deltaX = gestureState.dx / pxPerSecRef.current;
        const updates = computeRightTrimUpdates(
          targetClip,
          info.initialStart,
          info.initialDur,
          info.initialTrimOut,
          info.trackIndex,
          deltaX,
          allClipsRef.current,
        );

        setActiveTrimDelta({
          clipId: info.clipId,
          side: "right",
          startTime: info.initialStart,
          duration: updates.duration,
        });
        if (onTrimClipRef.current) {
          onTrimClipRef.current(info.clipId, updates, false);
        }
      },
      onPanResponderRelease: () => {
        const info = trimStartInfoRef.current;
        const activeDelta = activeTrimDeltaRef.current;
        if (info && activeDelta && onTrimClipRef.current) {
          const targetClip = allClipsRef.current.find(
            (c) => c.id === info.clipId,
          );
          const mediaDur = targetClip
            ? getMediaDuration(targetClip.rawClip, targetClip.type)
            : null;
          const speed = Math.max(
            0.1,
            Math.min(16, targetClip?.rawClip?.speed || 1.0),
          );
          const currentTrimIn = Math.max(0, targetClip?.rawClip?.trimIn || 0);
          const newTrimOut = mediaDur
            ? Math.min(mediaDur, currentTrimIn + activeDelta.duration * speed)
            : activeDelta.duration;
          onTrimClipRef.current(
            info.clipId,
            {
              duration: activeDelta.duration,
              trimOut: Number(newTrimOut.toFixed(3)),
              trackIndex: info.trackIndex,
            },
            true,
          );
        }
        setActiveTrimDelta(null);
        setActiveTrimming(null);
        trimStartInfoRef.current = null;
        soundEngine.playSfx("pop");
        triggerHaptic("light", isHapticEnabledRef.current);
        setTimeout(() => {
          isTrimmingActiveRef.current = false;
        }, 50);
      },
      onPanResponderTerminate: () => {
        setActiveTrimDelta(null);
        setActiveTrimming(null);
        trimStartInfoRef.current = null;
        isTrimmingActiveRef.current = false;
      },
    });
  }, [isTrimmingActiveRef]);

  // Left trim with mouse (desktop web)
  const handleLeftTrimStart = useCallback(
    (
      e: any,
      clipId: string,
      initialStart: number,
      initialDur: number,
      initialTrimIn: number,
      trackIndex: number,
    ) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      e.stopPropagation?.();
      e.nativeEvent?.stopPropagation?.();
      if (e.cancelable && e.preventDefault) e.preventDefault();
      soundEngine.playSfx("click");
      triggerHaptic("selection", isHapticEnabledRef.current);
      isTrimmingActiveRef.current = true;
      setActiveTrimming({ clipId, side: "left" });

      const targetClip = allClipsRef.current.find((c) => c.id === clipId);
      if (!targetClip) return;

      const { clientX: startClientX } = getPointerCoords(e);

      let pendingRaf: number | null = null;
      let latestUpdates = {
        startTime: initialStart,
        duration: initialDur,
        trimIn: initialTrimIn,
        trackIndex,
      };

      const performTrimUpdate = (isFinal = false) => {
        pendingRaf = null;
        if (onTrimClipRef.current) {
          onTrimClipRef.current(clipId, latestUpdates, isFinal);
        }
      };

      const onMove = (moveEvt: MouseEvent | TouchEvent) => {
        if (moveEvt.cancelable && moveEvt.preventDefault) {
          moveEvt.preventDefault();
        }
        const { clientX } = getPointerCoords(moveEvt);
        const deltaX = (clientX - startClientX) / pxPerSecRef.current;
        const updates = computeLeftTrimUpdates(
          targetClip,
          initialStart,
          initialDur,
          initialTrimIn,
          trackIndex,
          deltaX,
          allClipsRef.current,
        );

        latestUpdates = updates;
        setActiveTrimDelta({
          clipId,
          side: "left",
          startTime: updates.startTime,
          duration: updates.duration,
        });

        if (pendingRaf === null) {
          pendingRaf = requestAnimationFrame(() => performTrimUpdate(false));
        }
      };

      const onUp = () => {
        if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
        performTrimUpdate(true);
        setActiveTrimDelta(null);
        setActiveTrimming(null);
        setTimeout(() => {
          isTrimmingActiveRef.current = false;
        }, 50);
        soundEngine.playSfx("pop");
        triggerHaptic("light", isHapticEnabledRef.current);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove as any);
        window.removeEventListener("touchend", onUp);
        window.removeEventListener("touchcancel", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove as any, { passive: false });
      window.addEventListener("touchend", onUp);
      window.addEventListener("touchcancel", onUp);
    },
    [isTrimmingActiveRef],
  );

  // Right trim with mouse (desktop web)
  const handleRightTrimStart = useCallback(
    (
      e: any,
      clipId: string,
      initialStart: number,
      initialDur: number,
      initialTrimOut: number,
      trackIndex: number,
    ) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      e.stopPropagation?.();
      e.nativeEvent?.stopPropagation?.();
      if (e.cancelable && e.preventDefault) e.preventDefault();
      soundEngine.playSfx("click");
      triggerHaptic("selection", isHapticEnabledRef.current);
      isTrimmingActiveRef.current = true;
      setActiveTrimming({ clipId, side: "right" });

      const targetClip = allClipsRef.current.find((c) => c.id === clipId);
      if (!targetClip) return;

      const { clientX: startClientX } = getPointerCoords(e);

      let pendingRaf: number | null = null;
      let latestUpdates = {
        duration: initialDur,
        trimOut: initialTrimOut,
        trackIndex,
      };

      const performTrimUpdate = (isFinal = false) => {
        pendingRaf = null;
        if (onTrimClipRef.current) {
          onTrimClipRef.current(clipId, latestUpdates, isFinal);
        }
      };

      const onMove = (moveEvt: MouseEvent | TouchEvent) => {
        if (moveEvt.cancelable && moveEvt.preventDefault) {
          moveEvt.preventDefault();
        }
        const { clientX } = getPointerCoords(moveEvt);
        const deltaX = (clientX - startClientX) / pxPerSecRef.current;
        const updates = computeRightTrimUpdates(
          targetClip,
          initialStart,
          initialDur,
          initialTrimOut,
          trackIndex,
          deltaX,
          allClipsRef.current,
        );

        latestUpdates = updates;
        setActiveTrimDelta({
          clipId,
          side: "right",
          startTime: initialStart,
          duration: updates.duration,
        });

        if (pendingRaf === null) {
          pendingRaf = requestAnimationFrame(() => performTrimUpdate(false));
        }
      };

      const onUp = () => {
        if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
        performTrimUpdate(true);
        setActiveTrimDelta(null);
        setActiveTrimming(null);
        setTimeout(() => {
          isTrimmingActiveRef.current = false;
        }, 50);
        soundEngine.playSfx("pop");
        triggerHaptic("light", isHapticEnabledRef.current);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove as any);
        window.removeEventListener("touchend", onUp);
        window.removeEventListener("touchcancel", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove as any, { passive: false });
      window.addEventListener("touchend", onUp);
      window.addEventListener("touchcancel", onUp);
    },
    [isTrimmingActiveRef],
  );

  return {
    activeTrimming,
    activeTrimDelta,
    leftTrimPanResponder,
    rightTrimPanResponder,
    handleLeftTrimStart,
    handleRightTrimStart,
  };
}
