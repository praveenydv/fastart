import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  FastArtProject,
  VideoClip,
  AudioClip,
  TextClip,
  StickerClip,
  EffectClip,
} from "../types/project";
import { soundEngine } from "../utils/audioEngine";
import { triggerHaptic } from "../utils/haptics";

export const MAX_TRACKS = 10;
export const TRACK_ROW_HEIGHT = 48;
export const MIN_CLIP_DURATION = 0.05; // 50 milliseconds precision

export interface UnifiedClipItem {
  id: string;
  type: "video" | "audio" | "text" | "sticker" | "effects";
  startTime: number;
  duration: number;
  trackIndex?: number;
  effectiveTrackIndex: number;
  title: string;
  subtitle?: string;
  badge?: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  iconName: any;
  rawClip: any;
}

// Strict non-overlapping clamp: another item starts ONLY when the one before it ends
export function clampNonOverlapping(
  desiredStart: number,
  duration: number,
  otherClips: { id: string; startTime: number; duration: number }[],
): number {
  if (!otherClips || otherClips.length === 0) {
    return Math.max(0, desiredStart);
  }

  const sorted = [...otherClips].sort((a, b) => a.startTime - b.startTime);
  let start = Math.max(0, desiredStart);

  // Prevent overlapping with any existing clip on this track
  for (const c of sorted) {
    const cEnd = c.startTime + c.duration;
    const overlaps =
      start < cEnd - 0.01 && start + duration > c.startTime + 0.01;
    if (overlaps) {
      if (start + duration / 2 >= c.startTime + c.duration / 2) {
        start = cEnd;
      } else {
        const beforeStart = c.startTime - duration;
        if (beforeStart >= 0) {
          start = beforeStart;
        } else {
          start = cEnd;
        }
      }
    }
  }

  // Verification pass
  for (const c of sorted) {
    const cEnd = c.startTime + c.duration;
    if (start < cEnd - 0.01 && start + duration > c.startTime + 0.01) {
      start = cEnd;
    }
  }

  return Math.max(0, Number(start.toFixed(3)));
}

interface TimelineProps {
  project: FastArtProject;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  selectedClipId: string | null;
  selectedClipType?: string;
  onSelectClip: (
    id: string,
    type: "video" | "audio" | "text" | "sticker" | "effects",
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
  onMoveClip?: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
    newStartTime: number,
    newTrackIndex?: number,
  ) => void;
  onOpenTransitions: (clipId: string) => void;
  onOpenMediaPicker?: () => void;
  onOpenTextModal?: () => void;
  onOpenAudioModal?: () => void;
  onOpenEffectsModal?: () => void;
  onOpenStickersModal?: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onAdjustDuration?: (delta: number) => void;
  onUpdateProject?: (updates: Partial<FastArtProject>) => void;
  onSplitClip?: () => void;
  onDuplicateClip?: () => void;
  onDeleteClip?: () => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  settings?: any;
}

export default function Timeline({
  project,
  currentTime,
  totalDuration,
  onSeek,
  selectedClipId,
  selectedClipType,
  onSelectClip,
  onTrimClip,
  onMoveClip,
  onOpenTransitions,
  zoom,
  onZoomChange,
  onAdjustDuration,
  onUpdateProject,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onOpenEditModal,
  settings,
}: TimelineProps) {
  const isSnappingEnabled = settings?.magneticSnapping !== false;
  const isHapticEnabled = settings?.hapticFeedback !== false;

  const containerRef = useRef<any>(null);
  const scrollRef = useRef<any>(null);
  const rulerRef = useRef<any>(null);
  const isDraggingPlayhead = useRef(false);
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const isMobile = screenWidth < 600;

  // Zoom scale: pixels per second, fluid range from 20px/s (overview) to 1000px/s (1ms = 1px)
  const pxPerSec = Math.max(20, Math.min(1000, zoom || 60));

  const timelineContentWidth = Math.max(
    screenWidth,
    Math.max(10, totalDuration) * pxPerSec + 320,
  );

  // Mouse wheel / Trackpad pinch zoom anywhere on timeline
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Zoom on trackpad pinch (ctrlKey=true), or holding Ctrl/Cmd/Alt, or mouse wheel over ruler
      const isRuler =
        rulerRef.current &&
        (e.target === rulerRef.current ||
          rulerRef.current.contains(e.target as Node));

      if (e.ctrlKey || e.metaKey || e.altKey || isRuler) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.max(
          20,
          Math.min(1000, Math.round(pxPerSec * factor)),
        );
        onZoomChange(newZoom);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [pxPerSec, onZoomChange]);

  // Touch pinch-to-zoom with fingers
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef<number>(pxPerSec);

  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent?.touches;
    if (touches && touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = pxPerSec;
      setIsPinching(true);
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.nativeEvent?.touches;
    if (touches && touches.length === 2 && pinchStartDist.current) {
      if (e.cancelable && e.preventDefault) e.preventDefault();
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const currentDist = Math.hypot(dx, dy);
      const ratio = currentDist / pinchStartDist.current;
      const newZoom = Math.max(
        20,
        Math.min(1000, Math.round(pinchStartZoom.current * ratio)),
      );
      onZoomChange(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchStartDist.current = null;
    setIsPinching(false);
  };

  // Generate ruler tick marks with adaptive density to prevent mobile DOM slowdown
  const ticks = useMemo(() => {
    const list: Array<{ time: number; label: string; isMajor: boolean }> = [];
    const maxDur = Math.max(10, totalDuration) + 3;

    // Target a comfortable spacing between tick labels (~50-80px)
    const targetPxSpacing = 65;
    const minTimeStep = targetPxSpacing / pxPerSec;

    // Pick cleanest time interval that satisfies target spacing
    const candidateSteps = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const step = candidateSteps.find((s) => s >= minTimeStep) || 60;

    const totalTicks = Math.ceil(maxDur / step);
    const limit = Math.min(totalTicks, 180); // Cap at 180 ticks max for ultra-smooth mobile scrolling

    for (let i = 0; i <= limit; i++) {
      const t = Number((i * step).toFixed(2));
      if (t > maxDur) break;

      const sec = Math.floor(t);
      const ms = Math.round((t - sec) * 1000);
      let label: string;
      let isMajor = false;

      if (step < 1) {
        isMajor = Math.abs(t - Math.round(t)) < 0.001;
        label = isMajor
          ? `00:${sec.toString().padStart(2, "0")}`
          : `.${ms.toString().padStart(3, "0").slice(0, 2)}`;
      } else {
        isMajor = sec % (step >= 5 ? step * 2 : 5) === 0;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        label = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      }

      list.push({ time: t, label, isMajor });
    }
    return list;
  }, [totalDuration, pxPerSec]);

  // Active drag state: ONLY the dragged item moves, other clips stay strictly in place
  const [dragState, setDragState] = useState<{
    clipId: string;
    currentStart: number;
    currentTrack: number;
  } | null>(null);

  // Active gesture tracking states to disambiguate scroll vs drag vs trim vs scrub
  const [isDraggingClip, setIsDraggingClip] = useState<boolean>(false);
  const [activeTrimming, setActiveTrimming] = useState<{
    clipId: string;
    side: "left" | "right";
  } | null>(null);
  const [isScrubbingRuler, setIsScrubbingRuler] = useState<boolean>(false);
  const [isPinching, setIsPinching] = useState<boolean>(false);

  // Raw clips from project
  const videoClips = project.tracks.video || [];
  const audioClips = project.tracks.audio || [];
  const textClips = project.tracks.text || [];
  const stickerClips = project.tracks.stickers || [];
  const effectClips = project.tracks.effects || [];

  // Deterministic track mapping: no other clips ever switch tracks on drag
  const allClipsWithTracks: UnifiedClipItem[] = useMemo(() => {
    return [
      ...videoClips.map((v, i) => ({
        id: v.id,
        type: "video" as const,
        startTime: v.startTime,
        duration: v.duration,
        trackIndex: v.trackIndex,
        effectiveTrackIndex:
          typeof v.trackIndex === "number"
            ? Math.min(MAX_TRACKS - 1, Math.max(0, v.trackIndex))
            : 0,
        title: v.title || `Video ${i + 1}`,
        subtitle: `${v.duration.toFixed(2)}s • ${v.speed || 1}x`,
        badge: `${i + 1}`,
        accentColor: "#00F2FE",
        bgColor: "#0B1E2E",
        borderColor: "#00F2FE",
        iconName: "videocam" as const,
        rawClip: v,
      })),
      ...audioClips.map((a) => ({
        id: a.id,
        type: "audio" as const,
        startTime: a.startTime,
        duration: a.duration,
        trackIndex: a.trackIndex,
        effectiveTrackIndex:
          typeof a.trackIndex === "number"
            ? Math.min(MAX_TRACKS - 1, Math.max(0, a.trackIndex))
            : 1,
        title: a.title || "Audio Track",
        subtitle: `${a.duration.toFixed(2)}s`,
        accentColor: "#10B981",
        bgColor: "#09241B",
        borderColor: "#10B981",
        iconName: "musical-notes" as const,
        rawClip: a,
      })),
      ...textClips.map((t) => ({
        id: t.id,
        type: "text" as const,
        startTime: t.startTime,
        duration: t.duration,
        trackIndex: t.trackIndex,
        effectiveTrackIndex:
          typeof t.trackIndex === "number"
            ? Math.min(MAX_TRACKS - 1, Math.max(0, t.trackIndex))
            : 2,
        title: t.text || "Text Overlay",
        subtitle: `Text • ${t.duration.toFixed(2)}s`,
        accentColor: "#D946EF",
        bgColor: "#260B2E",
        borderColor: "#D946EF",
        iconName: "text" as const,
        rawClip: t,
      })),
      ...stickerClips.map((s) => ({
        id: s.id,
        type: "sticker" as const,
        startTime: s.startTime,
        duration: s.duration,
        trackIndex: s.trackIndex,
        effectiveTrackIndex:
          typeof s.trackIndex === "number"
            ? Math.min(MAX_TRACKS - 1, Math.max(0, s.trackIndex))
            : 3,
        title: s.char || "Sticker",
        subtitle: `Sticker • ${s.duration.toFixed(2)}s`,
        accentColor: "#FBBF24",
        bgColor: "#2D1F08",
        borderColor: "#FBBF24",
        iconName: "happy" as const,
        rawClip: s,
      })),
      ...effectClips.map((e) => ({
        id: e.id,
        type: "effects" as const,
        startTime: e.startTime,
        duration: e.duration,
        trackIndex: e.trackIndex,
        effectiveTrackIndex:
          typeof e.trackIndex === "number"
            ? Math.min(MAX_TRACKS - 1, Math.max(0, e.trackIndex))
            : 4,
        title: e.name || "Effect",
        subtitle: `FX • ${e.duration.toFixed(2)}s`,
        accentColor: "#F59E0B",
        bgColor: "#2A1A06",
        borderColor: "#F59E0B",
        iconName: "sparkles" as const,
        rawClip: e,
      })),
    ];
  }, [videoClips, audioClips, textClips, stickerClips, effectClips]);

  // Compute highest track index in use
  const maxUsedTrackIndex = useMemo(() => {
    if (allClipsWithTracks.length === 0) return 0;
    return Math.max(...allClipsWithTracks.map((c) => c.effectiveTrackIndex));
  }, [allClipsWithTracks]);

  // User track count preference (default min 3, max 10)
  const [userTrackCount, setUserTrackCount] = useState<number>(3);
  const activeTrackCount = Math.max(
    1,
    Math.min(MAX_TRACKS, Math.max(userTrackCount, maxUsedTrackIndex + 1)),
  );

  // Group clips into track rows
  const trackRows = useMemo(() => {
    const rows: UnifiedClipItem[][] = Array.from(
      { length: activeTrackCount },
      () => [],
    );

    allClipsWithTracks.forEach((clip) => {
      if (dragState && dragState.clipId === clip.id) {
        const targetTrack = Math.min(
          activeTrackCount - 1,
          dragState.currentTrack,
        );
        rows[targetTrack].push({
          ...clip,
          startTime: dragState.currentStart,
          effectiveTrackIndex: targetTrack,
        });
      } else {
        const trackIdx = Math.min(
          activeTrackCount - 1,
          clip.effectiveTrackIndex,
        );
        rows[trackIdx].push(clip);
      }
    });

    rows.forEach((row) => row.sort((a, b) => a.startTime - b.startTime));
    return rows;
  }, [allClipsWithTracks, activeTrackCount, dragState]);

  // Directly add a new track without modal (max 10 allowed)
  const handleAddTrack = () => {
    if (activeTrackCount >= MAX_TRACKS) {
      soundEngine.playSfx("click");
      return;
    }
    soundEngine.playSfx("pop");
    setUserTrackCount((prev) =>
      Math.min(MAX_TRACKS, Math.max(prev, activeTrackCount) + 1),
    );
  };

  // Remove empty track option (only if not any items in there)
  const handleRemoveTrack = (trackIdx: number) => {
    const row = trackRows[trackIdx] || [];
    if (row.length > 0) return; // Strict safety: only remove if completely empty!

    soundEngine.playSfx("cut");

    const getEffectiveTrack = (c: any, defaultIndex: number) => {
      return typeof c.trackIndex === "number"
        ? Math.min(MAX_TRACKS - 1, Math.max(0, c.trackIndex))
        : defaultIndex;
    };

    // Re-index clips located on tracks higher than trackIdx down by 1
    const shiftTrack = (c: any, defaultIndex: number) => {
      const currentTrack = getEffectiveTrack(c, defaultIndex);
      if (currentTrack > trackIdx) {
        return { ...c, trackIndex: currentTrack - 1 };
      }
      return { ...c, trackIndex: currentTrack };
    };

    const newVideo = (project.tracks.video || []).map((c) => shiftTrack(c, 0));
    const newAudio = (project.tracks.audio || []).map((c) => shiftTrack(c, 1));
    const newText = (project.tracks.text || []).map((c) => shiftTrack(c, 2));
    const newStickers = (project.tracks.stickers || []).map((c) => shiftTrack(c, 3));
    const newEffects = (project.tracks.effects || []).map((c) => shiftTrack(c, 4));

    if (onUpdateProject) {
      onUpdateProject({
        tracks: {
          video: newVideo,
          audio: newAudio,
          text: newText,
          stickers: newStickers,
          effects: newEffects,
        },
      });
    }

    // Recalculate highest track index after shifting
    const allShiftedClips = [
      ...newVideo.map((c) => ({ track: c.trackIndex })),
      ...newAudio.map((c) => ({ track: c.trackIndex })),
      ...newText.map((c) => ({ track: c.trackIndex })),
      ...newStickers.map((c) => ({ track: c.trackIndex })),
      ...newEffects.map((c) => ({ track: c.trackIndex })),
    ];
    const newMaxTrack =
      allShiftedClips.length > 0
        ? Math.max(...allShiftedClips.map((c) => c.track))
        : 0;

    setUserTrackCount((prev) =>
      Math.max(1, Math.max(newMaxTrack + 1, Math.min(prev - 1, activeTrackCount - 1)))
    );
  };

  // Tap or drag on ruler to seek
  const updateSeekFromPointer = (e: any) => {
    let clickX = 0;
    if (Platform.OS === "web") {
      const el = rulerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const clientX =
          e.clientX ?? e.nativeEvent?.clientX ?? e.nativeEvent?.pageX ?? 0;
        clickX = clientX - rect.left;
      }
    } else {
      clickX = e.nativeEvent?.locationX || 0;
    }
    const maxDur = Math.max(1, totalDuration);
    const newTime = Math.max(0, Math.min(maxDur, clickX / pxPerSec));
    onSeek(Number(newTime.toFixed(3)));
  };

  const handleRulerPointerDown = (e: any) => {
    isDraggingPlayhead.current = true;
    setIsScrubbingRuler(true);
    soundEngine.playSfx("click");
    triggerHaptic("selection", isHapticEnabled);
    updateSeekFromPointer(e);
  };

  // Global window listeners for ruler scrubbing (coalesced with RAF for 60fps smooth seeking on 4K files)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    let pendingRaf: number | null = null;
    let latestClientX = 0;

    const performSeek = () => {
      pendingRaf = null;
      const el = rulerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const clickX = latestClientX - rect.left;
        const maxDur = Math.max(1, totalDuration);
        let newTime = Math.max(0, Math.min(maxDur, clickX / pxPerSec));

        // Magnetic snapping to clip start and end points
        if (isSnappingEnabled) {
          const snapThresholdSec = 10 / pxPerSec;
          let closestSnap: number | null = null;
          let minDiff = snapThresholdSec;

          if (Math.abs(newTime) < minDiff) {
            closestSnap = 0;
            minDiff = Math.abs(newTime);
          }

          allClipsWithTracks.forEach((c) => {
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
          });

          if (closestSnap !== null) {
            newTime = closestSnap;
            triggerHaptic("selection", isHapticEnabled);
          }
        }

        onSeek(Number(newTime.toFixed(3)));
      }
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (isDraggingPlayhead.current) {
        if ("touches" in e && e.cancelable) {
          e.preventDefault();
        }
        const clientX =
          "touches" in e
            ? (e.touches && e.touches[0] ? e.touches[0].clientX : latestClientX)
            : e.clientX;
        latestClientX = clientX;
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
    window.addEventListener("touchmove", onPointerMove as any, { passive: false });
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
  }, [totalDuration, pxPerSec, isSnappingEnabled, allClipsWithTracks, isHapticEnabled]);

  // Dragging handler: disambiguate tap/select, swipe-scroll, long-press drag, and selected-clip drag
  const handleClipDragStart = (
    e: any,
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
    initialStartTime: number,
    initialTrackIndex: number,
    duration: number,
  ) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (e.target && e.target.closest && e.target.closest(".trim-handle-box")) {
      return;
    }
    // Only respond to primary mouse button if mouse event
    if (e.button !== undefined && e.button !== 0) return;

    const isCurrentlySelected = selectedClipId === clipId;
    const isTouchEvent = !!(e.touches && e.touches.length > 0) || !("clientX" in e);

    const startClientX =
      e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const startClientY =
      e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const touchStartTime = Date.now();

    let hasStartedDragging = false;
    let didLongPress = false;
    let longPressTimer: any = null;
    let latestStart = initialStartTime;
    let latestTrack = initialTrackIndex;
    let pendingRaf: number | null = null;

    // Helper to initiate active drag
    const startDragMode = () => {
      hasStartedDragging = true;
      setIsDraggingClip(true);
      soundEngine.playSfx("click");
      triggerHaptic("selection", isHapticEnabled);
      if (!isCurrentlySelected) {
        onSelectClip(clipId, trackType);
      }
    };

    // For touch devices on unselected clips: 220ms long-press enters drag mode
    if (isTouchEvent && !isCurrentlySelected) {
      longPressTimer = setTimeout(() => {
        didLongPress = true;
        startDragMode();
      }, 220);
    }

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      const clientX =
        "touches" in moveEvt
          ? (moveEvt.touches && moveEvt.touches[0] ? moveEvt.touches[0].clientX : startClientX)
          : moveEvt.clientX;
      const clientY =
        "touches" in moveEvt
          ? (moveEvt.touches && moveEvt.touches[0] ? moveEvt.touches[0].clientY : startClientY)
          : moveEvt.clientY;

      const deltaXPixels = clientX - startClientX;
      const deltaYPixels = clientY - startClientY;
      const moveDistance = Math.hypot(deltaXPixels, deltaYPixels);

      // On touch devices: if unselected and not yet long-pressed
      if (isTouchEvent && !isCurrentlySelected && !didLongPress && !hasStartedDragging) {
        if (moveDistance > 8) {
          // User is swipe-scrolling the timeline! Cancel long-press and let parent scroll
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
          return;
        }
      }

      // If clip was already selected OR is desktop mouse: require 8px move to initiate drag
      if (!hasStartedDragging) {
        if (moveDistance > 8) {
          startDragMode();
        } else {
          return;
        }
      }

      // We are actively dragging the clip: prevent page scroll & lock
      if (moveEvt.cancelable) {
        moveEvt.preventDefault();
      }

      const deltaX = deltaXPixels / pxPerSec;
      const trackShift = Math.round(deltaYPixels / TRACK_ROW_HEIGHT);
      const targetTrack = Math.max(
        0,
        Math.min(activeTrackCount - 1, initialTrackIndex + trackShift),
      );

      const otherClipsOnTarget = allClipsWithTracks.filter(
        (c) => c.id !== clipId && c.effectiveTrackIndex === targetTrack,
      );

      let desiredStart = Math.max(0, initialStartTime + deltaX);

      // Magnetic timeline snapping
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
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as any);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);

      setIsDraggingClip(false);

      if (hasStartedDragging) {
        setDragState(null);
        soundEngine.playSfx("pop");
        triggerHaptic("light", isHapticEnabled);
        if (onMoveClip) {
          onMoveClip(clipId, trackType, latestStart, latestTrack);
        }
      } else {
        // Quick tap without dragging: select clip!
        const elapsed = Date.now() - touchStartTime;
        if (elapsed < 350) {
          soundEngine.playSfx("click");
          triggerHaptic("selection", isHapticEnabled);
          onSelectClip(clipId, trackType);
        }
        setDragState(null);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as any, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
  };

  // Left trim with millisecond precision & non-overlapping barrier
  const handleLeftTrimStart = (
    e: any,
    clipId: string,
    initialStart: number,
    initialDur: number,
    initialTrimIn: number,
    trackIndex: number,
  ) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    e.stopPropagation();
    if (e.cancelable && e.preventDefault) e.preventDefault();
    soundEngine.playSfx("click");
    triggerHaptic("selection", isHapticEnabled);
    setActiveTrimming({ clipId, side: "left" });

    const startClientX =
      e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);

    const clipsBefore = allClipsWithTracks
      .filter(
        (c) =>
          c.id !== clipId &&
          c.effectiveTrackIndex === trackIndex &&
          c.startTime + c.duration <= initialStart + 0.01,
      )
      .sort((a, b) => a.startTime - b.startTime);
    const minAllowedStart =
      clipsBefore.length > 0
        ? clipsBefore[clipsBefore.length - 1].startTime +
          clipsBefore[clipsBefore.length - 1].duration
        : 0;

    let pendingRaf: number | null = null;
    let latestUpdates = {
      startTime: initialStart,
      duration: initialDur,
      trimIn: initialTrimIn,
      trackIndex,
    };

    const performTrimUpdate = (isFinal = false) => {
      pendingRaf = null;
      if (onTrimClip) {
        onTrimClip(clipId, latestUpdates, isFinal);
      }
    };

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (moveEvt.cancelable) {
        moveEvt.preventDefault();
      }
      const clientX =
        "touches" in moveEvt
          ? (moveEvt.touches && moveEvt.touches[0] ? moveEvt.touches[0].clientX : startClientX)
          : moveEvt.clientX;
      const deltaX = (clientX - startClientX) / pxPerSec;
      const maxDelta = initialDur - MIN_CLIP_DURATION;
      const minDelta = minAllowedStart - initialStart;
      const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaX));
      const newStart = Math.max(minAllowedStart, initialStart + clampedDelta);
      const newDur = Math.max(MIN_CLIP_DURATION, initialDur - clampedDelta);
      const newTrimIn = Math.max(0, initialTrimIn + clampedDelta);

      latestUpdates = {
        startTime: Number(newStart.toFixed(3)),
        duration: Number(newDur.toFixed(3)),
        trimIn: Number(newTrimIn.toFixed(3)),
        trackIndex,
      };

      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(() => performTrimUpdate(false));
      }
    };

    const onUp = () => {
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      performTrimUpdate(true);
      setActiveTrimming(null);
      soundEngine.playSfx("pop");
      triggerHaptic("light", isHapticEnabled);
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
  };

  // Right trim with millisecond precision & non-overlapping barrier
  const handleRightTrimStart = (
    e: any,
    clipId: string,
    initialStart: number,
    initialDur: number,
    initialTrimOut: number,
    trackIndex: number,
  ) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    e.stopPropagation();
    if (e.cancelable && e.preventDefault) e.preventDefault();
    soundEngine.playSfx("click");
    triggerHaptic("selection", isHapticEnabled);
    setActiveTrimming({ clipId, side: "right" });

    const startClientX =
      e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);

    const clipsAfter = allClipsWithTracks
      .filter(
        (c) =>
          c.id !== clipId &&
          c.effectiveTrackIndex === trackIndex &&
          c.startTime >= initialStart + initialDur - 0.01,
      )
      .sort((a, b) => a.startTime - b.startTime);
    const maxAllowedDur =
      clipsAfter.length > 0 ? clipsAfter[0].startTime - initialStart : Infinity;

    let pendingRaf: number | null = null;
    let latestUpdates = {
      duration: initialDur,
      trimOut: initialTrimOut,
      trackIndex,
    };

    const performTrimUpdate = (isFinal = false) => {
      pendingRaf = null;
      if (onTrimClip) {
        onTrimClip(clipId, latestUpdates, isFinal);
      }
    };

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (moveEvt.cancelable) {
        moveEvt.preventDefault();
      }
      const clientX =
        "touches" in moveEvt
          ? (moveEvt.touches && moveEvt.touches[0] ? moveEvt.touches[0].clientX : startClientX)
          : moveEvt.clientX;
      const deltaX = (clientX - startClientX) / pxPerSec;
      const rawDur = initialDur + deltaX;
      const newDur = Math.max(
        MIN_CLIP_DURATION,
        Math.min(maxAllowedDur, rawDur),
      );
      const newTrimOut = Math.max(MIN_CLIP_DURATION, initialTrimOut + deltaX);

      latestUpdates = {
        duration: Number(newDur.toFixed(3)),
        trimOut: Number(newTrimOut.toFixed(3)),
        trackIndex,
      };

      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(() => performTrimUpdate(false));
      }
    };

    const onUp = () => {
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      performTrimUpdate(true);
      setActiveTrimming(null);
      soundEngine.playSfx("pop");
      triggerHaptic("light", isHapticEnabled);
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
  };

  // Active clip info for top bar
  const getActiveClipInfo = () => {
    if (!selectedClipId) return null;
    const found = allClipsWithTracks.find((c) => c.id === selectedClipId);
    if (found) {
      return {
        id: found.id,
        rawType: found.type,
        type: found.type.toUpperCase(),
        color: found.accentColor,
        title: found.title,
        start: found.startTime,
        duration: found.duration,
        trackIndex: found.effectiveTrackIndex,
      };
    }
    return null;
  };
  const activeClipInfo = getActiveClipInfo();

  // User custom resizable timeline height with local storage persistence
  const [userTimelineHeight, setUserTimelineHeight] = useState<number | null>(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("fastart_timeline_height");
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed >= 74 && parsed <= 500) {
            return parsed;
          }
        }
      } catch (_) {}
    }
    return null;
  });
  const [isResizingHeight, setIsResizingHeight] = useState(false);

  // Dynamic compact timeline height based on active tracks to eliminate empty dead space
  const autoTimelineHeight = useMemo(() => {
    // Resize handle (8) + Top bar (24) + ruler (18) + (activeTracks * 48) + 2 borders
    const contentH = 8 + 24 + 18 + Math.max(1, activeTrackCount) * TRACK_ROW_HEIGHT + 2;
    const maxH = isMobile ? 180 : 210;
    return Math.min(maxH, contentH);
  }, [activeTrackCount, isMobile]);

  const timelineHeight = userTimelineHeight !== null ? userTimelineHeight : autoTimelineHeight;

  const minTimelineHeight = 74;
  const maxTimelineHeight = Math.min(450, Math.round(screenHeight * 0.55));

  // Resize by Mouse (Desktop / Web)
  const handleResizeMouseDown = useCallback(
    (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizingHeight(true);

      const startY = e.clientY;
      const initialH = timelineHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        // Dragging UP decreases clientY (negative deltaY) -> height should INCREASE
        const newH = Math.round(
          Math.max(minTimelineHeight, Math.min(maxTimelineHeight, initialH - deltaY))
        );
        setUserTimelineHeight(newH);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        setIsResizingHeight(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        try {
          const finalDeltaY = upEvent.clientY - startY;
          const finalH = Math.round(
            Math.max(minTimelineHeight, Math.min(maxTimelineHeight, initialH - finalDeltaY))
          );
          localStorage.setItem("fastart_timeline_height", String(finalH));
        } catch (_) {}
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [timelineHeight, minTimelineHeight, maxTimelineHeight]
  );

  // Double-click resets to auto height
  const handleResetResizeHeight = useCallback(() => {
    setUserTimelineHeight(null);
    try {
      localStorage.removeItem("fastart_timeline_height");
    } catch (_) {}
    soundEngine.playSfx("pop");
  }, []);

  // Resize by Touch (Mobile / Tablet)
  const touchStartYRef = useRef<number>(0);
  const touchStartHeightRef = useRef<number>(0);

  const handleResizeTouchStart = useCallback(
    (e: any) => {
      const touch = e.nativeEvent.touches?.[0] || e.nativeEvent;
      touchStartYRef.current = touch.pageY;
      touchStartHeightRef.current = timelineHeight;
      setIsResizingHeight(true);
    },
    [timelineHeight]
  );

  const handleResizeTouchMove = useCallback(
    (e: any) => {
      if (!isResizingHeight) return;
      const touch = e.nativeEvent.touches?.[0] || e.nativeEvent;
      const deltaY = touch.pageY - touchStartYRef.current;
      const newH = Math.round(
        Math.max(
          minTimelineHeight,
          Math.min(maxTimelineHeight, touchStartHeightRef.current - deltaY)
        )
      );
      setUserTimelineHeight(newH);
    },
    [isResizingHeight, minTimelineHeight, maxTimelineHeight]
  );

  const handleResizeTouchEnd = useCallback(() => {
    setIsResizingHeight(false);
    if (userTimelineHeight !== null) {
      try {
        localStorage.setItem("fastart_timeline_height", String(userTimelineHeight));
      } catch (_) {}
    }
  }, [userTimelineHeight]);

  // Combined interaction state to dynamically lock ScrollViews during active gestures
  const isInteractingWithTimeline =
    isDraggingClip ||
    !!dragState ||
    !!activeTrimming ||
    isScrubbingRuler ||
    isPinching ||
    isResizingHeight;

  return (
    <View
      ref={containerRef}
      style={[styles.container, { height: timelineHeight }]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Interactive Top Drag-to-Resize Handle */}
      <View
        style={[styles.resizeHandleBar, isResizingHeight && styles.resizeHandleBarActive]}
        {...(Platform.OS === "web"
          ? {
              onMouseDown: handleResizeMouseDown,
              onDoubleClick: handleResetResizeHeight,
            }
          : {})}
        onTouchStart={handleResizeTouchStart}
        onTouchMove={handleResizeTouchMove}
        onTouchEnd={handleResizeTouchEnd}
        accessibilityLabel="Drag up or down to adjust timeline height"
      >
        <View
          style={[styles.resizeGripPill, isResizingHeight && styles.resizeGripPillActive]}
        />
      </View>

      {/* Top Preference Bar: Multi-Track Info, Track Counter, Active Clip Details & Fluid Zoom Controls */}
      <View style={styles.timelineBar}>
        <View style={styles.timelineBarLeft}>
          <View style={styles.trackPreferenceGroup}>
            <View style={styles.trackTitleBadge}>
              <Ionicons name="layers-outline" size={12} color="#00F2FE" />
              <Text style={styles.trackLabelTitle}>
                {isMobile ? "TRACKS" : "MULTI-TRACK"}
              </Text>
            </View>
          </View>

          {/* Selected Clip Time Details - Clean & Compact, Time Only, No Name, No Action Buttons */}
          {activeClipInfo ? (
            <View style={styles.activeClipTimeframePill}>
              <View
                style={[
                  styles.activeClipTypeBadge,
                  { backgroundColor: activeClipInfo.color },
                ]}
              >
                <Text style={styles.activeClipTypeBadgeText}>
                  {activeClipInfo.type} • T{activeClipInfo.trackIndex + 1}
                </Text>
              </View>
              <Ionicons name="time-outline" size={10} color="#00F2FE" />
              <Text style={styles.activeClipTimeframeText}>
                {activeClipInfo.start.toFixed(2)}s ➔ {(activeClipInfo.start + activeClipInfo.duration).toFixed(2)}s ({activeClipInfo.duration.toFixed(2)}s)
              </Text>
            </View>
          ) : null}
        </View>

        {/* Fluid Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => onZoomChange(Math.max(20, pxPerSec - 25))}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={13} color="#8E95A5" />
          </TouchableOpacity>

          <Text style={styles.zoomText}>
            {pxPerSec}px/s
          </Text>

          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => onZoomChange(Math.min(1000, pxPerSec + 25))}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={13} color="#8E95A5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Synchronized Vertical Scroll for all tracks (Headers + Scrollable Lanes) */}
      <ScrollView
        style={[
          styles.timelineVerticalScroll,
          {
            touchAction: isInteractingWithTimeline ? "none" : "pan-y",
          } as any,
        ]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        scrollEnabled={!isInteractingWithTimeline}
      >
        <View style={styles.timelineBody}>
          {/* General Left Track Headers Column */}
          <View
            style={[
              styles.leftHeadersColumn,
              isMobile && styles.leftHeadersColumnMobile,
            ]}
          >
            {/* Top ruler corner at time zero */}
            <View style={styles.rulerCornerHeader}>
              <Ionicons name="time-outline" size={11} color="#6B7280" />
              <Text style={styles.rulerCornerText}>00:00</Text>
            </View>

            {/* Track 1, Track 2, Track 3 ... with remove option if empty */}
            {trackRows.map((row, idx) => {
              const typesOnTrack = Array.from(new Set(row.map((c) => c.type)));
              const isEmptyTrack = row.length === 0;

              return (
                <View key={idx} style={styles.trackHeaderCellUniversal}>
                  <View style={styles.trackHeaderLabelBox}>
                    <Text style={styles.trackHeaderLabelUniversal}>
                      {isMobile ? `T${idx + 1}` : `Track ${idx + 1}`}
                    </Text>

                    {/* If track has items: show type indicator dots */}
                    {/* {!isEmptyTrack && (
                      <View style={styles.trackTypeDotsRow}>
                        {typesOnTrack.map((t) => (
                          <View
                            key={t}
                            style={[
                              styles.trackTypeDot,
                              {
                                backgroundColor:
                                  t === "video"
                                    ? "#00F2FE"
                                    : t === "audio"
                                      ? "#10B981"
                                      : t === "text"
                                        ? "#D946EF"
                                        : t === "sticker"
                                          ? "#FBBF24"
                                          : "#F59E0B",
                              },
                            ]}
                          />
                        ))}
                      </View>
                    )} */}

                    {/* If track is empty: show empty label */}
                    {/* {isEmptyTrack && (
                      <Text style={styles.trackHeaderEmptySubtext}>Empty</Text>
                    )} */}
                  </View>

                  {/* REMOVE TRACK OPTION: explicitly available if not any items in there! */}
                  {isEmptyTrack && (
                    <TouchableOpacity
                      style={styles.removeEmptyTrackHeaderBtn}
                      onPress={() => handleRemoveTrack(idx)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={11} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* Plus sign at bottom of headers to add track */}
            {activeTrackCount < MAX_TRACKS && (
              <TouchableOpacity
                style={styles.addTrackLeftColumnBtn}
                onPress={handleAddTrack}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={12} color="#00F2FE" />
                <Text style={styles.addTrackLeftColumnText}> Track</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Scrollable Timeline Canvas */}
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!isInteractingWithTimeline}
            style={[
              styles.timelineScroll,
              {
                touchAction: isInteractingWithTimeline ? "none" : "pan-x pan-y",
              } as any,
            ]}
            contentContainerStyle={styles.timelineContent}
          >
            <View
              style={[styles.tracksContainer, { width: timelineContentWidth }]}
            >
              {/* Playhead Needle with Diamond Head */}
              <View
                style={[styles.playheadLine, { left: currentTime * pxPerSec }]}
                pointerEvents="none"
              >
                <View style={styles.playheadHeadBox}>
                  <View style={styles.diamondShape} />
                </View>
                <View style={styles.playheadNeedle} />
              </View>

              {/* Time Ruler (Interactive Tap & Drag to Seek with ms precision) */}
              <TouchableOpacity
                ref={rulerRef}
                style={styles.rulerContainer}
                activeOpacity={1}
                onPress={updateSeekFromPointer}
                onPressIn={handleRulerPointerDown}
              >
                {ticks.map((tk, i) => (
                  <View
                    key={i}
                    style={[styles.tickWrapper, { left: tk.time * pxPerSec }]}
                  >
                    <View
                      style={[
                        styles.tickLine,
                        tk.isMajor ? styles.tickLineMajor : null,
                      ]}
                    />
                    <Text
                      style={[
                        styles.tickText,
                        tk.isMajor && styles.tickTextMajor,
                      ]}
                    >
                      {tk.label}
                    </Text>
                  </View>
                ))}
              </TouchableOpacity>

              {/* General Multi-Track Rows */}
              {trackRows.map((rowClips, trackIdx) => {
                const isEmptyTrack = rowClips.length === 0;

                return (
                  <View
                    key={trackIdx}
                    style={styles.universalTrackLane}
                    {...(Platform.OS === "web"
                      ? {
                          onClick: (e: any) => {
                            if (e.target === e.currentTarget) {
                              onSelectClip("", "video");
                            }
                          },
                        }
                      : {})}
                  >
                    {/* Subtle track lane guideline */}
                    <View style={styles.trackLaneGuideline} />

                    {/* Empty track lane helper with quick delete option */}
                    {isEmptyTrack && (
                      <View style={styles.emptyTrackLaneContainer}>
                        <Text style={styles.emptyTrackLanePrompt}>
                          Track {trackIdx + 1} is empty
                        </Text>
                        <TouchableOpacity
                          style={styles.removeEmptyTrackLaneBtn}
                          onPress={() => handleRemoveTrack(trackIdx)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={11}
                            color="#EF4444"
                          />
                          <Text style={styles.removeEmptyTrackLaneText}>
                            Remove Track
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Render all clips in this track */}
                    {rowClips.map((clip, clipIndexInRow) => {
                      const left = clip.startTime * pxPerSec;
                      const width = Math.max(24, clip.duration * pxPerSec);
                      const isSelected = selectedClipId === clip.id;
                      const isBeingDragged =
                        dragState && dragState.clipId === clip.id;

                      return (
                        <React.Fragment key={clip.id}>
                          {/* Draggable Clip Card across tracks & time */}
                          <View
                            {...(Platform.OS === "web"
                              ? {
                                  onMouseDown: (e: any) =>
                                    handleClipDragStart(
                                      e,
                                      clip.id,
                                      clip.type,
                                      clip.startTime,
                                      trackIdx,
                                      clip.duration,
                                    ),
                                  onTouchStart: (e: any) =>
                                    handleClipDragStart(
                                      e,
                                      clip.id,
                                      clip.type,
                                      clip.startTime,
                                      trackIdx,
                                      clip.duration,
                                    ),
                                  onDoubleClick: (e: any) => {
                                    e.stopPropagation();
                                    soundEngine.playSfx("click");
                                    onSelectClip(clip.id, clip.type);
                                    onOpenEditModal?.(clip.id, clip.type);
                                  },
                                }
                              : {})}
                            style={
                              {
                                position: "absolute",
                                left,
                                width,
                                top: 2,
                                bottom: 2,
                                cursor: "grab",
                                zIndex: isBeingDragged
                                  ? 50
                                  : isSelected
                                    ? 20
                                    : 6,
                                display: "flex",
                                transform: isBeingDragged
                                  ? [{ scale: 1.02 }]
                                  : undefined,
                                opacity: isBeingDragged ? 0.95 : 1,
                                touchAction: isSelected ? "none" : "pan-x pan-y",
                              } as any
                            }
                          >
                            <View
                              style={[
                                styles.universalClipCard,
                                {
                                  borderColor:
                                    isSelected || isBeingDragged
                                      ? clip.accentColor
                                      : "rgba(255,255,255,0.12)",
                                  backgroundColor: clip.bgColor,
                                },
                                (isSelected || isBeingDragged) && [
                                  styles.clipSelectedUniversal,
                                  {
                                    borderColor: clip.accentColor,
                                    shadowColor: clip.accentColor,
                                  },
                                ],
                              ]}
                            >
                              {/* Left Trim Handle */}
                              {isSelected && (
                                <View
                                  {...({ className: "trim-handle-box" } as any)}
                                  {...(Platform.OS === "web"
                                    ? {
                                        onMouseDown: (e: any) =>
                                          handleLeftTrimStart(
                                            e,
                                            clip.id,
                                            clip.startTime,
                                            clip.duration,
                                            clip.rawClip?.trimIn || 0,
                                            trackIdx,
                                          ),
                                        onTouchStart: (e: any) =>
                                          handleLeftTrimStart(
                                            e,
                                            clip.id,
                                            clip.startTime,
                                            clip.duration,
                                            clip.rawClip?.trimIn || 0,
                                            trackIdx,
                                          ),
                                      }
                                    : {})}
                                  hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                                  style={[
                                    styles.trimHandleBoxLeft,
                                    activeTrimming?.clipId === clip.id &&
                                      activeTrimming?.side === "left" &&
                                      styles.trimHandleBoxActive,
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.universalTrimHandle,
                                      styles.universalTrimHandleLeft,
                                      { backgroundColor: clip.accentColor },
                                      activeTrimming?.clipId === clip.id &&
                                        activeTrimming?.side === "left" &&
                                        styles.universalTrimHandleActive,
                                    ]}
                                  >
                                    <View style={styles.trimGripBar} />
                                    <View style={[styles.trimGripBar, { marginLeft: 2 }]} />
                                  </View>
                                </View>
                              )}

                              {/* Inner Content by Clip Type */}
                              <View style={styles.universalClipInner}>
                                {/* Type Icon Badge */}
                                <View
                                  style={[
                                    styles.clipIconBadge,
                                    { backgroundColor: clip.accentColor },
                                  ]}
                                >
                                  {clip.type === "sticker" ? (
                                    <Text style={{ fontSize: 11 }}>
                                      {clip.rawClip?.char || "✨"}
                                    </Text>
                                  ) : (
                                    <Ionicons
                                      name={clip.iconName}
                                      size={11}
                                      color="#000000"
                                    />
                                  )}
                                </View>

                                {/* Title and Duration in ms */}
                                <View
                                  style={{
                                    flex: 1,
                                    paddingHorizontal: 4,
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text
                                    style={styles.clipTitleText}
                                    numberOfLines={1}
                                  >
                                    {clip.title}
                                  </Text>
                                  <Text
                                    style={styles.clipDurationSubtext}
                                    numberOfLines={1}
                                  >
                                    {clip.duration.toFixed(2)}s •{" "}
                                    {Math.round(clip.duration * 1000)}ms
                                  </Text>
                                </View>

                                {/* Audio Waveform visualization */}
                                {clip.type === "audio" && (
                                  <View style={styles.miniWaveformRow}>
                                    {Array.from({
                                      length: Math.min(
                                        24,
                                        Math.floor(width / 6),
                                      ),
                                    }).map((_, wIdx) => (
                                      <View
                                        key={wIdx}
                                        style={[
                                          styles.waveBar,
                                          {
                                            height:
                                              4 +
                                              Math.abs(
                                                Math.sin((wIdx + 1) * 0.8) * 12,
                                              ),
                                          },
                                        ]}
                                      />
                                    ))}
                                  </View>
                                )}

                                {/* LUT filter indicator */}
                                {clip.type === "video" &&
                                  clip.rawClip?.filter &&
                                  clip.rawClip?.filter !== "normal" && (
                                    <View style={styles.filterTag}>
                                      <Text style={styles.filterTagText}>
                                        LUT
                                      </Text>
                                    </View>
                                  )}
                              </View>

                              {/* Right Trim Handle */}
                              {isSelected && (
                                <View
                                  {...({ className: "trim-handle-box" } as any)}
                                  {...(Platform.OS === "web"
                                    ? {
                                        onMouseDown: (e: any) =>
                                          handleRightTrimStart(
                                            e,
                                            clip.id,
                                            clip.startTime,
                                            clip.duration,
                                            clip.rawClip?.trimOut ||
                                              clip.duration,
                                            trackIdx,
                                          ),
                                        onTouchStart: (e: any) =>
                                          handleRightTrimStart(
                                            e,
                                            clip.id,
                                            clip.startTime,
                                            clip.duration,
                                            clip.rawClip?.trimOut ||
                                              clip.duration,
                                            trackIdx,
                                          ),
                                      }
                                    : {})}
                                  hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                                  style={[
                                    styles.trimHandleBoxRight,
                                    activeTrimming?.clipId === clip.id &&
                                      activeTrimming?.side === "right" &&
                                      styles.trimHandleBoxActive,
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.universalTrimHandle,
                                      styles.universalTrimHandleRight,
                                      { backgroundColor: clip.accentColor },
                                      activeTrimming?.clipId === clip.id &&
                                        activeTrimming?.side === "right" &&
                                        styles.universalTrimHandleActive,
                                    ]}
                                  >
                                    <View style={styles.trimGripBar} />
                                    <View style={[styles.trimGripBar, { marginLeft: 2 }]} />
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Transition Cut Button between adjacent video clips on same track */}
                          {clip.type === "video" &&
                            clipIndexInRow < rowClips.length - 1 &&
                            rowClips[clipIndexInRow + 1].type === "video" &&
                            Math.abs(
                              rowClips[clipIndexInRow + 1].startTime -
                                (clip.startTime + clip.duration),
                            ) < 0.25 && (
                              <TouchableOpacity
                                style={[
                                  styles.transitionButton,
                                  {
                                    left:
                                      (clip.startTime + clip.duration) *
                                        pxPerSec -
                                      11,
                                  },
                                  Boolean(
                                    clip.rawClip?.transition?.type &&
                                      clip.rawClip?.transition?.type !== "none",
                                  ) && styles.transitionButtonActive,
                                ]}
                                onPress={() => onOpenTransitions(clip.id)}
                                activeOpacity={0.8}
                                accessibilityLabel="Transition between clips"
                              >
                                <Ionicons
                                  name={
                                    clip.rawClip?.transition?.type &&
                                    clip.rawClip?.transition?.type !== "none"
                                      ? "flash"
                                      : "swap-horizontal"
                                  }
                                  size={11}
                                  color={
                                    clip.rawClip?.transition?.type &&
                                    clip.rawClip?.transition?.type !== "none"
                                      ? "#00F2FE"
                                      : "#94A3B8"
                                  }
                                />
                              </TouchableOpacity>
                            )}
                        </React.Fragment>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const { height: screenH, width: screenW } = Dimensions.get("window");
const isMobileDevice = screenW < 600;
const TIMELINE_HEIGHT = isMobileDevice
  ? Math.max(120, Math.min(155, Math.round(screenH * 0.20)))
  : Math.max(140, Math.min(190, Math.round(screenH * 0.24)));

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0E1118",
    borderTopWidth: 1,
    borderTopColor: "#1A1E29",
    flexShrink: 0,
    flexGrow: 0,
    overflow: "hidden" as any,
  },
  resizeHandleBar: {
    height: 8,
    width: "100%",
    backgroundColor: "#0B0D13",
    borderTopWidth: 1,
    borderTopColor: "#1A1E29",
    alignItems: "center",
    justifyContent: "center",
    cursor: "row-resize",
    userSelect: "none",
    touchAction: "none",
    zIndex: 40,
    flexShrink: 0,
  } as any,
  resizeHandleBarActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
  },
  resizeGripPill: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#334155",
  },
  resizeGripPillActive: {
    backgroundColor: "#00F2FE",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  timelineBar: {
    height: 24,
    maxHeight: 24,
    backgroundColor: "#0B0D13",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    flexShrink: 0,
    flexGrow: 0,
    overflow: "hidden" as any,
  },
  timelineBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    overflow: "hidden" as any,
  },
  trackPreferenceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trackTitleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trackLabelTitle: {
    color: "#E2E8F0",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  trackCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  trackCountBadgeText: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "700",
  },
  addTrackHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 242, 254, 0.14)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
    gap: 3,
  },
  addTrackHeaderBtnText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "700",
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  zoomBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#1E2333",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomText: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "700",
    minWidth: 44,
    textAlign: "center",
  },
  timelineVerticalScroll: {
    flex: 1,
  },
  timelineBody: {
    flexDirection: "row",
    width: "100%",
  },
  leftHeadersColumn: {
    width: 72,
    backgroundColor: "#0E1118",
    borderRightWidth: 1,
    borderRightColor: "#1A1E29",
    flexShrink: 0,
    zIndex: 20,
  },
  leftHeadersColumnMobile: {
    width: 44,
  },
  rulerCornerHeader: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
    backgroundColor: "#0E1118",
  },
  rulerCornerText: {
    color: "#6B7280",
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  trackHeaderCellUniversal: {
    height: TRACK_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: "#0E1118",
  },
  trackHeaderLabelBox: {
    flex: 1,
  },
  trackHeaderLabelUniversal: {
    fontSize: 10,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  trackHeaderEmptySubtext: {
    fontSize: 8,
    color: "#64748B",
    marginTop: 1,
  },
  trackTypeDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  trackTypeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  removeEmptyTrackHeaderBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  addTrackLeftColumnBtn: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "rgba(0, 242, 254, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
    borderStyle: "dashed",
    marginHorizontal: 4,
    marginVertical: 4,
    borderRadius: 4,
  },
  addTrackLeftColumnText: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "700",
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    position: "relative",
  },
  tracksContainer: {
    flexDirection: "column",
    position: "relative",
  },
  rulerContainer: {
    height: 18,
    width: "100%",
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
    touchAction: "none",
    cursor: "pointer",
  } as any,
  tickWrapper: {
    position: "absolute",
    top: 0,
    alignItems: "flex-start",
  },
  tickLine: {
    width: 1,
    height: 6,
    backgroundColor: "#374151",
  },
  tickLineMajor: {
    height: 10,
    backgroundColor: "#6B7280",
  },
  tickText: {
    color: "#6B7280",
    fontSize: 8,
    fontFamily: "monospace",
    marginTop: 2,
    marginLeft: 2,
  },
  tickTextMajor: {
    color: "#94A3B8",
    fontWeight: "700",
  },
  playheadLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 50,
    pointerEvents: "none",
    alignItems: "center",
    width: 20,
    marginLeft: -10,
  },
  playheadHeadBox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 52,
  },
  diamondShape: {
    width: 12,
    height: 12,
    backgroundColor: "#00F2FE",
    borderRadius: 2,
    transform: [{ rotate: "45deg" }],
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  playheadNeedle: {
    width: 2,
    flex: 1,
    backgroundColor: "#00F2FE",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  universalTrackLane: {
    height: TRACK_ROW_HEIGHT,
    width: "100%",
    position: "relative",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: "#0B0E15",
  },
  trackLaneGuideline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  emptyTrackLaneContainer: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyTrackLanePrompt: {
    color: "#475569",
    fontSize: 10,
    fontStyle: "italic",
  },
  removeEmptyTrackLaneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  removeEmptyTrackLaneText: {
    color: "#EF4444",
    fontSize: 9,
    fontWeight: "700",
  },
  universalClipCard: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  clipSelectedUniversal: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  universalClipInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  clipIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  clipTitleText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  clipDurationSubtext: {
    color: "#94A3B8",
    fontSize: 9,
    marginTop: 1,
  },
  miniWaveformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginRight: 4,
  },
  waveBar: {
    width: 2,
    backgroundColor: "#34D399",
    borderRadius: 1,
  },
  filterTag: {
    backgroundColor: "rgba(0, 242, 254, 0.2)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  filterTagText: {
    color: "#00F2FE",
    fontSize: 8,
    fontWeight: "800",
  },
  trimHandleBoxLeft: {
    position: "relative",
    cursor: "ew-resize",
    zIndex: 35,
    height: "100%",
    width: 20,
    justifyContent: "center",
    alignItems: "flex-start",
    touchAction: "none",
  } as any,
  trimHandleBoxRight: {
    position: "relative",
    cursor: "ew-resize",
    zIndex: 35,
    height: "100%",
    width: 20,
    justifyContent: "center",
    alignItems: "flex-end",
    touchAction: "none",
  } as any,
  trimHandleBoxActive: {
    zIndex: 40,
  },
  universalTrimHandle: {
    width: 14,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  universalTrimHandleLeft: {
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  universalTrimHandleRight: {
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  universalTrimHandleActive: {
    transform: [{ scale: 1.08 }],
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  trimGripBar: {
    width: 1.5,
    height: 14,
    backgroundColor: "#000000",
    borderRadius: 1,
    opacity: 0.85,
  },
  transitionButton: {
    position: "absolute",
    top: "50%",
    marginTop: -11,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#121622",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 35,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    cursor: "pointer",
  } as any,
  transitionButtonActive: {
    backgroundColor: "rgba(0, 242, 254, 0.25)",
    borderColor: "#00F2FE",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  activeClipTimeframePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161B26",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 4,
  },
  activeClipTypeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  activeClipTypeBadgeText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "800",
  },
  activeClipTimeframeText: {
    color: "#E2E8F0",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  timelineHintText: {
    color: "#64748B",
    fontSize: 11,
    fontStyle: "italic",
  },
});
