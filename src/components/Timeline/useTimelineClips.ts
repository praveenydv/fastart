import { useState, useMemo, useEffect } from "react";
import { Platform } from "react-native";
import { FastArtProject } from "../../types/project";
import { UnifiedClipItem, MAX_TRACKS } from "./timelineTypes";
import { probeAndCacheMediaDuration } from "../../utils/mediaDuration";
import { soundEngine } from "../../utils/audioEngine";

interface UseTimelineClipsProps {
  project: FastArtProject;
  dragState: { clipId: string; currentStart: number; currentTrack: number } | null;
  selectedClipId: string | null;
}

export function useTimelineClips({
  project,
  dragState,
  selectedClipId,
}: UseTimelineClipsProps) {
  const videoClips = project.tracks.video || [];
  const audioClips = project.tracks.audio || [];
  const textClips = project.tracks.text || [];
  const stickerClips = project.tracks.stickers || [];
  const effectClips = project.tracks.effects || [];

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

  // Ensure media durations are pre-cached for exact trimming limits
  useEffect(() => {
    if (Platform.OS !== "web") return;
    allClipsWithTracks.forEach((clip) => {
      if (clip.type === "video" && clip.rawClip?.type !== "photo" && clip.rawClip?.url) {
        probeAndCacheMediaDuration(clip.rawClip.url, clip.id, false);
      } else if (clip.type === "audio" && clip.rawClip?.url) {
        probeAndCacheMediaDuration(clip.rawClip.url, clip.id, true);
      }
    });
  }, [allClipsWithTracks]);

  const maxUsedTrackIndex = useMemo(() => {
    if (allClipsWithTracks.length === 0) return 0;
    return Math.max(...allClipsWithTracks.map((c) => c.effectiveTrackIndex));
  }, [allClipsWithTracks]);

  const [userTrackCount, setUserTrackCount] = useState<number>(3);
  const activeTrackCount = Math.max(
    1,
    Math.min(MAX_TRACKS, Math.max(userTrackCount, maxUsedTrackIndex + 1)),
  );

  const handleAddTrack = () => {
    soundEngine.playSfx("click");
    setUserTrackCount((prev) => Math.min(MAX_TRACKS, Math.max(prev, activeTrackCount) + 1));
  };

  const handleRemoveTrack = (trackIdx: number) => {
    soundEngine.playSfx("click");
    setUserTrackCount((prev) => Math.max(1, prev - 1));
  };

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
        rows[targetTrack].push(clip);
      } else {
        const trk = Math.min(activeTrackCount - 1, clip.effectiveTrackIndex);
        rows[trk].push(clip);
      }
    });

    rows.forEach((row) => row.sort((a, b) => a.startTime - b.startTime));
    return rows;
  }, [allClipsWithTracks, activeTrackCount, dragState]);

  const activeClipInfo = useMemo(() => {
    if (!selectedClipId) return null;
    const clip = allClipsWithTracks.find((c) => c.id === selectedClipId);
    if (!clip) return null;
    return {
      title: clip.title,
      type: clip.type.toUpperCase(),
      color: clip.accentColor,
      trackIndex: clip.effectiveTrackIndex,
      start: clip.startTime,
      duration: clip.duration,
    };
  }, [selectedClipId, allClipsWithTracks]);

  return {
    allClipsWithTracks,
    activeTrackCount,
    trackRows,
    activeClipInfo,
    handleAddTrack,
    handleRemoveTrack,
  };
}
