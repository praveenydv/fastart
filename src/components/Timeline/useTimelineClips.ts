import { useState, useMemo, useEffect } from "react";
import { Platform } from "react-native";
import { FastArtProject } from "../../types/project";
import { UnifiedClipItem, MAX_TRACKS, TimelineDragState } from "./timelineTypes";
import { probeAndCacheMediaDuration, isImageClip } from "../../utils/mediaDuration";
import { soundEngine } from "../../utils/audioEngine";
import { THEME_COLORS } from "../../constants/theme";

interface UseTimelineClipsProps {
  project: FastArtProject;
  dragState: TimelineDragState | null;
  selectedClipId: string | null;
  onUpdateProject?: (updates: Partial<FastArtProject>) => void;
}

export function useTimelineClips({
  project,
  dragState,
  selectedClipId,
  onUpdateProject,
}: UseTimelineClipsProps) {
  const videoClips = project.tracks.video || [];
  const audioClips = project.tracks.audio || [];
  const textClips = project.tracks.text || [];
  const captionClips = project.tracks.captions || [];
  const stickerClips = project.tracks.stickers || [];
  const effectClips = project.tracks.effects || [];

  const allClipsWithTracks: UnifiedClipItem[] = useMemo(() => {
    return [
      ...videoClips.map((v, i) => ({
        id: v.id,
        type: isImageClip(v) ? ("photo" as const) : ("video" as const),
        startTime: v.startTime,
        duration: v.duration,
        trackIndex: v.trackIndex,
        effectiveTrackIndex:
          typeof v.trackIndex === "number"
            ? Math.min(MAX_TRACKS - 1, Math.max(0, v.trackIndex))
            : 0,
        title: v.title || (isImageClip(v) ? `Photo ${i + 1}` : `Video ${i + 1}`),
        subtitle: isImageClip(v)
          ? `Photo • ${v.duration.toFixed(2)}s`
          : `${v.duration.toFixed(2)}s • ${v.speed || 1}x`,
        badge: `${i + 1}`,
        accentColor: THEME_COLORS.primary,
        bgColor: THEME_COLORS.clipVideoBg,
        borderColor: THEME_COLORS.borderSubtle,
        iconName: (isImageClip(v) ? "image" : "videocam") as any,
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
        accentColor: THEME_COLORS.success,
        bgColor: THEME_COLORS.clipAudioBg,
        borderColor: THEME_COLORS.borderSubtle,
        iconName: "musical-notes" as const,
        rawClip: a,
      })),
      ...captionClips.map((c) => ({
        id: c.id,
        type: "caption" as const,
        startTime: c.startTime,
        duration: c.duration,
        trackIndex: c.trackIndex,
        effectiveTrackIndex:
          typeof c.trackIndex === "number"
            ? Math.min(MAX_TRACKS - 1, Math.max(0, c.trackIndex))
            : 2,
        title: c.text || "Caption Subtitle",
        subtitle: `Caption • ${c.duration.toFixed(2)}s`,
        accentColor: THEME_COLORS.accent,
        bgColor: THEME_COLORS.clipCaptionBg,
        borderColor: THEME_COLORS.borderSubtle,
        iconName: "chatbox-ellipses" as const,
        rawClip: c,
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
        accentColor: THEME_COLORS.primary,
        bgColor: THEME_COLORS.clipTextBg,
        borderColor: THEME_COLORS.borderSubtle,
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
        accentColor: THEME_COLORS.warning,
        bgColor: THEME_COLORS.clipStickerBg,
        borderColor: THEME_COLORS.borderSubtle,
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
        accentColor: THEME_COLORS.accent,
        bgColor: THEME_COLORS.clipEffectBg,
        borderColor: THEME_COLORS.borderSubtle,
        iconName: "sparkles" as const,
        rawClip: e,
      })),
    ];
  }, [videoClips, audioClips, captionClips, textClips, stickerClips, effectClips]);

  // Ensure media durations are pre-cached for exact trimming limits
  useEffect(() => {
    if (Platform.OS !== "web") return;
    allClipsWithTracks.forEach((clip) => {
      if (clip.type === "video" && !isImageClip(clip) && clip.rawClip?.url) {
        probeAndCacheMediaDuration(clip.rawClip.url, clip.id, false);
      } else if (clip.type === "audio" && clip.rawClip?.url) {
        probeAndCacheMediaDuration(clip.rawClip.url, clip.id, true);
      }
    });
  }, [allClipsWithTracks]);

  const [persistentTrackCount, setPersistentTrackCount] = useState<number>(() => {
    const initialMax = allClipsWithTracks.length > 0
      ? Math.max(...allClipsWithTracks.map((c) => c.effectiveTrackIndex))
      : 0;
    return Math.max(1, initialMax + 1);
  });

  // Expand track count when a clip is on a higher track, but NEVER auto-remove tracks when clips leave!
  useEffect(() => {
    if (allClipsWithTracks.length > 0) {
      const currentMax = Math.max(...allClipsWithTracks.map((c) => c.effectiveTrackIndex));
      setPersistentTrackCount((prev) => Math.max(prev, currentMax + 1));
    }
  }, [allClipsWithTracks]);

  const [extraTracks, setExtraTracks] = useState<number>(0);
  const activeTrackCount = Math.min(
    MAX_TRACKS,
    Math.max(1, persistentTrackCount + extraTracks),
  );

  const handleAddTrack = () => {
    soundEngine.playSfx("click");
    setPersistentTrackCount((prev) => Math.min(MAX_TRACKS, prev + 1));
  };

  const handleRemoveTrack = (trackIdx: number) => {
    soundEngine.playSfx("click");

    // Shift all clips located on tracks after trackIdx down by 1 track
    const shiftClip = <T extends { trackIndex?: number }>(
      clip: T,
      defaultTrack: number,
    ): T => {
      const curTrack =
        typeof clip.trackIndex === "number" ? clip.trackIndex : defaultTrack;
      if (curTrack > trackIdx) {
        return {
          ...clip,
          trackIndex: Math.max(0, curTrack - 1),
        };
      }
      return clip;
    };

    if (onUpdateProject) {
      const updatedVideo = videoClips.map((c) => shiftClip(c, 0));
      const updatedAudio = audioClips.map((c) => shiftClip(c, 1));
      const updatedCaptions = captionClips.map((c) => shiftClip(c, 2));
      const updatedText = textClips.map((c) => shiftClip(c, 2));
      const updatedStickers = stickerClips.map((c) => shiftClip(c, 3));
      const updatedEffects = effectClips.map((c) => shiftClip(c, 4));

      onUpdateProject({
        tracks: {
          ...project.tracks,
          video: updatedVideo,
          audio: updatedAudio,
          captions: updatedCaptions,
          text: updatedText,
          stickers: updatedStickers,
          effects: updatedEffects,
        },
      });
    }

    setPersistentTrackCount((prev) => Math.max(1, prev - 1));
    setExtraTracks((prev) => Math.max(0, prev - 1));
  };

  const trackRows = useMemo(() => {
    const rows: UnifiedClipItem[][] = Array.from(
      { length: activeTrackCount },
      () => [],
    );

    allClipsWithTracks.forEach((clip) => {
      const trk = Math.min(activeTrackCount - 1, clip.effectiveTrackIndex);
      rows[trk].push(clip);
    });

    rows.forEach((row) => row.sort((a, b) => a.startTime - b.startTime));
    return rows;
  }, [allClipsWithTracks, activeTrackCount]);

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
