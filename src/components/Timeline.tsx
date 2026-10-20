import React, { useRef, useState, useMemo, useEffect } from "react";
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
}: TimelineProps) {
  const containerRef = useRef<any>(null);
  const scrollRef = useRef<any>(null);
  const rulerRef = useRef<any>(null);
  const isDraggingPlayhead = useRef(false);
  const screenWidth = Dimensions.get("window").width;

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
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.nativeEvent?.touches;
    if (touches && touches.length === 2 && pinchStartDist.current) {
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
  };

  // Generate ruler tick marks based on zoom scale
  const ticks = useMemo(() => {
    const list: Array<{ time: number; label: string; isMajor: boolean }> = [];
    const maxDur = Math.max(10, totalDuration) + 3;

    if (pxPerSec >= 500) {
      // 100ms precision ticks
      for (let t = 0; t <= maxDur; t += 0.1) {
        const timeVal = Number(t.toFixed(1));
        const isMajor = Math.round(timeVal * 10) % 10 === 0;
        const sec = Math.floor(timeVal);
        const ms = Math.round((timeVal - sec) * 1000);
        const label = isMajor
          ? `00:${sec.toString().padStart(2, "0")}`
          : `.${ms.toString().padStart(3, "0")}`;
        list.push({ time: timeVal, label, isMajor });
      }
    } else if (pxPerSec >= 200) {
      // 200ms ticks
      for (let t = 0; t <= maxDur; t += 0.2) {
        const timeVal = Number(t.toFixed(1));
        const isMajor = Math.round(timeVal * 10) % 10 === 0;
        const sec = Math.floor(timeVal);
        const ms = Math.round((timeVal - sec) * 1000);
        const label = isMajor
          ? `00:${sec.toString().padStart(2, "0")}`
          : `.${ms.toString().padStart(3, "0")}`;
        list.push({ time: timeVal, label, isMajor });
      }
    } else {
      // 1s ticks
      const numSeconds = Math.ceil(maxDur);
      for (let s = 0; s <= numSeconds; s++) {
        list.push({
          time: s,
          label: `00:${s.toString().padStart(2, "0")}`,
          isMajor: s % 5 === 0,
        });
      }
    }
    return list;
  }, [totalDuration, pxPerSec]);

  // Active drag state: ONLY the dragged item moves, other clips stay strictly in place
  const [dragState, setDragState] = useState<{
    clipId: string;
    currentStart: number;
    currentTrack: number;
  } | null>(null);

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

    // Re-index clips located on tracks higher than trackIdx down by 1
    const shiftTrack = (c: any) => {
      if (typeof c.trackIndex === "number" && c.trackIndex > trackIdx) {
        return { ...c, trackIndex: c.trackIndex - 1 };
      }
      return c;
    };

    if (onUpdateProject) {
      onUpdateProject({
        tracks: {
          video: (project.tracks.video || []).map(shiftTrack),
          audio: (project.tracks.audio || []).map(shiftTrack),
          text: (project.tracks.text || []).map(shiftTrack),
          stickers: (project.tracks.stickers || []).map(shiftTrack),
          effects: (project.tracks.effects || []).map(shiftTrack),
        },
      });
    }

    setUserTrackCount((prev) => Math.max(1, activeTrackCount - 1));
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
    soundEngine.playSfx("click");
    updateSeekFromPointer(e);
  };

  // Global window listeners for ruler scrubbing
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const onPointerMove = (e: MouseEvent) => {
      if (isDraggingPlayhead.current) {
        const el = rulerRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const maxDur = Math.max(1, totalDuration);
          const newTime = Math.max(0, Math.min(maxDur, clickX / pxPerSec));
          onSeek(Number(newTime.toFixed(3)));
        }
      }
    };

    const onPointerUp = () => {
      if (isDraggingPlayhead.current) {
        isDraggingPlayhead.current = false;
      }
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
    };
  }, [totalDuration, pxPerSec]);

  // Dragging handler: move single item across tracks and along time with ZERO switching of others
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
    e.stopPropagation();

    const startClientX = e.clientX ?? 0;
    const startClientY = e.clientY ?? 0;
    let didMove = false;
    let latestStart = initialStartTime;
    let latestTrack = initialTrackIndex;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const deltaX = (moveEvt.clientX - startClientX) / pxPerSec;
      const deltaY = moveEvt.clientY - startClientY;

      if (Math.abs(deltaX) > 0.03 || Math.abs(deltaY) > 5) {
        didMove = true;
      }

      if (!didMove) return;

      const trackShift = Math.round(deltaY / TRACK_ROW_HEIGHT);
      const targetTrack = Math.max(
        0,
        Math.min(activeTrackCount - 1, initialTrackIndex + trackShift),
      );

      const otherClipsOnTarget = allClipsWithTracks.filter(
        (c) => c.id !== clipId && c.effectiveTrackIndex === targetTrack,
      );

      const desiredStart = Math.max(0, initialStartTime + deltaX);
      const clampedStart = clampNonOverlapping(
        desiredStart,
        duration,
        otherClipsOnTarget,
      );

      latestStart = clampedStart;
      latestTrack = targetTrack;

      setDragState({
        clipId,
        currentStart: clampedStart,
        currentTrack: targetTrack,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      if (didMove) {
        setDragState(null);
        soundEngine.playSfx("pop");
        if (onMoveClip) {
          onMoveClip(clipId, trackType, latestStart, latestTrack);
        }
      } else {
        setDragState(null);
        soundEngine.playSfx("click");
        onSelectClip(clipId, trackType);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
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
    soundEngine.playSfx("click");
    const startClientX = e.clientX;

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

    const onMove = (moveEvt: MouseEvent) => {
      const deltaX = (moveEvt.clientX - startClientX) / pxPerSec;
      const maxDelta = initialDur - MIN_CLIP_DURATION;
      const minDelta = minAllowedStart - initialStart;
      const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaX));
      const newStart = Math.max(minAllowedStart, initialStart + clampedDelta);
      const newDur = Math.max(MIN_CLIP_DURATION, initialDur - clampedDelta);
      const newTrimIn = Math.max(0, initialTrimIn + clampedDelta);

      if (onTrimClip) {
        onTrimClip(clipId, {
          startTime: Number(newStart.toFixed(3)),
          duration: Number(newDur.toFixed(3)),
          trimIn: Number(newTrimIn.toFixed(3)),
          trackIndex,
        });
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
    soundEngine.playSfx("click");
    const startClientX = e.clientX;

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

    const onMove = (moveEvt: MouseEvent) => {
      const deltaX = (moveEvt.clientX - startClientX) / pxPerSec;
      const rawDur = initialDur + deltaX;
      const newDur = Math.max(
        MIN_CLIP_DURATION,
        Math.min(maxAllowedDur, rawDur),
      );
      const newTrimOut = Math.max(MIN_CLIP_DURATION, initialTrimOut + deltaX);

      if (onTrimClip) {
        onTrimClip(clipId, {
          duration: Number(newDur.toFixed(3)),
          trimOut: Number(newTrimOut.toFixed(3)),
          trackIndex,
        });
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Active clip info for top bar
  const getActiveClipInfo = () => {
    if (!selectedClipId) return null;
    const found = allClipsWithTracks.find((c) => c.id === selectedClipId);
    if (found) {
      return {
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

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Preference Bar: Multi-Track Info, Track Counter, Active Clip Details & Fluid Zoom Controls */}
      <View style={styles.timelineBar}>
        <View style={styles.trackPreferenceGroup}>
          <View style={styles.trackTitleBadge}>
            <Ionicons name="layers-outline" size={13} color="#00F2FE" />
            <Text style={styles.trackLabelTitle}>MULTI-TRACK</Text>
          </View>

          {/* Track Count Preference */}
          <View style={styles.trackCountBadge}>
            <Text style={styles.trackCountBadgeText}>
              {activeTrackCount}/{MAX_TRACKS} Tracks
            </Text>
          </View>

          {/* Plus Sign to Add Track directly (Max 10) */}
          {activeTrackCount < MAX_TRACKS && (
            <TouchableOpacity
              style={styles.addTrackHeaderBtn}
              onPress={handleAddTrack}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={13} color="#00F2FE" />
              <Text style={styles.addTrackHeaderBtnText}>+ Track</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Selected Clip Time Frame Details with millisecond precision */}
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
            <Text style={styles.activeClipTimeframeText} numberOfLines={1}>
              {activeClipInfo.title} • {activeClipInfo.start.toFixed(2)}s ➔{" "}
              {(activeClipInfo.start + activeClipInfo.duration).toFixed(2)}s (
              {Math.round(activeClipInfo.duration * 1000)}ms)
            </Text>
            {onAdjustDuration && (
              <View style={styles.nudgeButtonsRow}>
                {/* Fine millisecond nudge buttons */}
                <TouchableOpacity
                  style={styles.nudgeBtn}
                  onPress={() => onAdjustDuration(-0.05)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.nudgeBtnText}>-50ms</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nudgeBtn}
                  onPress={() => onAdjustDuration(0.05)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.nudgeBtnText}>+50ms</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nudgeBtn}
                  onPress={() => onAdjustDuration(-0.25)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.nudgeBtnText}>-0.25s</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nudgeBtn}
                  onPress={() => onAdjustDuration(0.25)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.nudgeBtnText}>+0.25s</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.timelineHintText}>
              Pinch with fingers or mouse wheel anywhere to zoom •
              Non-overlapping
            </Text>
          </View>
        )}

        {/* Fluid Zoom Controls with mouse wheel & finger pinch support */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => onZoomChange(Math.max(20, pxPerSec - 25))}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={14} color="#8E95A5" />
          </TouchableOpacity>

          <Text style={styles.zoomText}>
            {pxPerSec}px/s {pxPerSec >= 250 ? "(ms)" : ""}
          </Text>

          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => onZoomChange(Math.min(1000, pxPerSec + 25))}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={14} color="#8E95A5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Synchronized Vertical Scroll for all tracks (Headers + Scrollable Lanes) */}
      <ScrollView
        style={styles.timelineVerticalScroll}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.timelineBody}>
          {/* General Left Track Headers Column */}
          <View style={styles.leftHeadersColumn}>
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
                      Track {idx + 1}
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
                  {/* {isEmptyTrack && (
                    <TouchableOpacity
                      style={styles.removeEmptyTrackHeaderBtn}
                      onPress={() => handleRemoveTrack(idx)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={12} color="#EF4444" />
                    </TouchableOpacity>
                  )} */}
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
                <Ionicons name="add" size={14} color="#00F2FE" />
                <Text style={styles.addTrackLeftColumnText}>+ Track</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Scrollable Timeline Canvas */}
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.timelineScroll}
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
                  <View key={trackIdx} style={styles.universalTrackLane}>
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
                                }
                              : {})}
                            style={
                              {
                                position: "absolute",
                                left,
                                width,
                                top: 4,
                                bottom: 4,
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
                                      }
                                    : {})}
                                  style={styles.trimHandleBoxLeft}
                                >
                                  <View
                                    style={[
                                      styles.universalTrimHandle,
                                      { backgroundColor: clip.accentColor },
                                    ]}
                                  >
                                    <View style={styles.trimGripBar} />
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
                                      }
                                    : {})}
                                  style={styles.trimHandleBoxRight}
                                >
                                  <View
                                    style={[
                                      styles.universalTrimHandle,
                                      { backgroundColor: clip.accentColor },
                                    ]}
                                  >
                                    <View style={styles.trimGripBar} />
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
                            ) < 0.2 && (
                              <TouchableOpacity
                                style={[
                                  styles.transitionButton,
                                  {
                                    left:
                                      (clip.startTime + clip.duration) *
                                        pxPerSec -
                                      12,
                                  },
                                ]}
                                onPress={() => onOpenTransitions(clip.id)}
                                activeOpacity={0.8}
                              >
                                <Ionicons
                                  name="flash"
                                  size={10}
                                  color="#00F2FE"
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

const { height: screenH } = Dimensions.get("window");
const TIMELINE_HEIGHT = Math.max(
  220,
  Math.min(300, Math.round(screenH * 0.32)),
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0E1118",
    height: TIMELINE_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: "#1A1E29",
    flexShrink: 0,
    overflow: "hidden" as any,
  },
  timelineBar: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    backgroundColor: "#0B0D13",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
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
  rulerCornerHeader: {
    height: 24,
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
    height: 24,
    width: "100%",
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
  },
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
    zIndex: 25,
    height: "100%",
  } as any,
  trimHandleBoxRight: {
    position: "relative",
    cursor: "ew-resize",
    zIndex: 25,
    height: "100%",
  } as any,
  universalTrimHandle: {
    width: 10,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  trimGripBar: {
    width: 2,
    height: 14,
    backgroundColor: "#000000",
    borderRadius: 1,
  },
  transitionButton: {
    position: "absolute",
    top: 13,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#141824",
    borderWidth: 1.5,
    borderColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 16,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  activeClipTimeframePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E2333",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  activeClipTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeClipTypeBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "700",
  },
  activeClipTimeframeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  nudgeButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 6,
  },
  nudgeBtn: {
    backgroundColor: "#2A3042",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nudgeBtnText: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "700",
  },
  timelineHintText: {
    color: "#64748B",
    fontSize: 11,
    fontStyle: "italic",
  },
});
