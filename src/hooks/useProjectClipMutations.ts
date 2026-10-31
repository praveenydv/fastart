import { useCallback } from "react";
import { Alert } from "react-native";
import { FastArtProject } from "../types/project";
import { soundEngine } from "../utils/audioEngine";
import { triggerHaptic } from "../utils/haptics";
import { deleteMedia } from "../utils/largeMediaStorage";
import { allocateClipPlacement, allocateNewTrackForClip } from "../utils/trackPlacement";
import { MAX_TRACKS } from "../components/Timeline/timelineTypes";
import { addNotification } from "../utils/storage";
import {
  requestMediaThumbnail,
  captureActiveFrameNow,
  globalThumbnailCache,
} from "../utils/mediaThumbnailGenerator";
import { cloneClipMasks } from "../services/selfieSegmentationService";
import { useClipTransformOperations } from "./useClipTransformOperations";

interface UseProjectClipMutationsParams {
  project: FastArtProject | null;
  projectRef: React.MutableRefObject<FastArtProject | null>;
  setProject: React.Dispatch<React.SetStateAction<FastArtProject | null>>;
  selectedClip: any;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  selectedClipType: string;
  setSelectedClipType: (type: any) => void;
  currentTimeRef: React.MutableRefObject<number>;
  settings: any;
  clipToDelete: any;
  setClipToDelete: (val: any) => void;
  updateProjectWithHistory: (proj: any) => void;
  setIsCroppingPreview: (val: boolean) => void;
  startProcessing?: (msg: string, durationMs?: number) => void;
}

export function useProjectClipMutations({
  project,
  projectRef,
  setProject,
  selectedClip,
  selectedClipId,
  setSelectedClipId,
  selectedClipType,
  setSelectedClipType,
  currentTimeRef,
  settings,
  clipToDelete,
  setClipToDelete,
  updateProjectWithHistory,
  setIsCroppingPreview,
  startProcessing,
}: UseProjectClipMutationsParams) {
  // Delegate transform, crop, rotate, reverse, trim, move operations
  const {
    handleUpdateClipTransform,
    handleUpdateClipCrop,
    handleUpdateClipMask,
    handleRotateClip,
    handleToggleReverse,
    handleTrimClip,
    handleMoveClip,
  } = useClipTransformOperations({
    project,
    projectRef,
    setProject,
    selectedClip,
    selectedClipId,
    selectedClipType,
    currentTimeRef,
    updateProjectWithHistory,
    startProcessing,
  });

  // Split active clip at currentTime
  const handleSplitClip = useCallback(() => {
    if (!project || !selectedClipId) return;
    const key = (
      selectedClipType === "caption" || selectedClipType === "captions"
        ? "captions"
        : selectedClipType === "sticker" || selectedClipType === "stickers"
          ? "stickers"
          : selectedClipType === "effect" || selectedClipType === "effects"
            ? "effects"
            : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...(((project.tracks as any)[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const clip = list[idx];
    const clipStart = clip.startTime || 0;
    const clipEnd = clipStart + (clip.duration || 0);

    const curTime = currentTimeRef.current;
    if (curTime <= clipStart + 0.05 || curTime >= clipEnd - 0.05) {
      soundEngine.playSfx("click");
      Alert.alert(
        "Split Position",
        "Move the playhead inside the selected clip to split it into two sections.",
      );
      return;
    }

    soundEngine.playSfx("split");
    triggerHaptic("medium", settings?.hapticFeedback !== false);
    startProcessing?.("Splitting Clip at Playhead...", 350);

    const speed = Math.max(0.1, Math.min(16, clip.speed || 1.0));
    const firstDuration = Number((curTime - clipStart).toFixed(3));
    const secondDuration = Number((clipEnd - curTime).toFixed(3));

    const initialTrimIn = typeof clip.trimIn === "number" ? clip.trimIn : 0;
    const mediaElapsed = Number((firstDuration * speed).toFixed(3));
    const splitTrimPoint = Number((initialTrimIn + mediaElapsed).toFixed(3));
    const originalTrimOut =
      typeof clip.trimOut === "number"
        ? clip.trimOut
        : Number((initialTrimIn + (clip.duration || 0) * speed).toFixed(3));

    const baseSourceId = clip.sourceMediaId || clip.id;

    // Filter and adjust keyframes if present
    const rawKeyframes = Array.isArray(clip.keyframes) ? clip.keyframes : [];
    const firstKeyframes = rawKeyframes.filter((k: any) => k.time <= firstDuration);
    const secondKeyframes = rawKeyframes
      .filter((k: any) => k.time >= firstDuration)
      .map((k: any) => ({
        ...k,
        time: Number((k.time - firstDuration).toFixed(3)),
      }));

    const parentMinTrimIn = typeof clip.minTrimIn === "number" ? clip.minTrimIn : initialTrimIn;
    const parentMaxTrimOut = typeof clip.maxTrimOut === "number" ? clip.maxTrimOut : originalTrimOut;

    const isMediaClip = key === "video" || key === "audio" || Boolean(clip.url && clip.type !== "text");

    const firstClip = {
      ...clip,
      sourceMediaId: baseSourceId,
      duration: firstDuration,
      maxDuration: firstDuration,
      minTrimIn: parentMinTrimIn,
      maxTrimOut: splitTrimPoint,
      thumbnailTrimIn: initialTrimIn,
      ...(isMediaClip
        ? {
            trimIn: initialTrimIn,
            trimOut: splitTrimPoint,
          }
        : {}),
      transition: undefined, // Split cut is a clean boundary without transition
      ...(rawKeyframes.length > 0 ? { keyframes: firstKeyframes } : {}),
    };

    const instantSplitThumb = isMediaClip && clip.url ? captureActiveFrameNow(clip.url, splitTrimPoint) : null;

    const secondClip = {
      ...clip,
      id: `clip-${String(key)[0]}-${Date.now()}`,
      sourceMediaId: baseSourceId,
      startTime: Number(curTime.toFixed(3)),
      duration: secondDuration,
      maxDuration: secondDuration,
      minTrimIn: splitTrimPoint,
      maxTrimOut: parentMaxTrimOut,
      thumbnail: instantSplitThumb || undefined, // Immediate frame preview if active in player
      thumbnailTrimIn: splitTrimPoint,
      ...(isMediaClip
        ? {
            trimIn: splitTrimPoint,
            trimOut: originalTrimOut,
          }
        : {}),
      transition: clip.transition,
      ...(rawKeyframes.length > 0 ? { keyframes: secondKeyframes } : {}),
    };

    if (instantSplitThumb) {
      globalThumbnailCache.set(secondClip.id, instantSplitThumb);
      globalThumbnailCache.set(`${secondClip.id}_t${splitTrimPoint.toFixed(2)}`, instantSplitThumb);
      if (secondClip.url) {
        globalThumbnailCache.set(`${secondClip.url}_t${splitTrimPoint.toFixed(2)}`, instantSplitThumb);
      }
    }

    list.splice(idx, 1, firstClip, secondClip);

    const updated = {
      ...project,
      tracks: {
        ...project.tracks,
        [key]: list,
      },
    };
    setSelectedClipId(secondClip.id);
    updateProjectWithHistory(updated);

    // Immediately trigger thumbnail extraction for the newly splitted second clip
    if (isMediaClip && secondClip.url) {
      requestMediaThumbnail(secondClip, !instantSplitThumb);
    }
  }, [project, selectedClipId, selectedClipType, settings, currentTimeRef, setSelectedClipId, updateProjectWithHistory]);

  // Insert Freeze Frame from selected video clip at playhead (CapCut / ReaCut parity)
  const handleFreezeFrame = useCallback((freezeDuration = 3.0) => {
    if (!project || !selectedClipId) return;
    if (selectedClipType !== "video") {
      Alert.alert("Freeze Frame", "Select a video clip to insert a freeze frame.");
      return;
    }

    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const clip = videoClips[idx];
    const clipStart = clip.startTime || 0;
    const clipEnd = clipStart + (clip.duration || 0);
    const curTime = currentTimeRef.current;

    if (curTime < clipStart || curTime > clipEnd) {
      Alert.alert("Freeze Frame", "Move the playhead inside the video clip to generate a freeze frame.");
      return;
    }

    soundEngine.playSfx("pop");
    triggerHaptic("medium", settings?.hapticFeedback !== false);
    startProcessing?.("Generating Freeze Frame...", 350);

    const firstDuration = Math.max(0.1, Number((curTime - clipStart).toFixed(3)));
    const speed = Math.max(0.1, Math.min(16, clip.speed || 1.0));
    const initialTrimIn = typeof clip.trimIn === "number" ? clip.trimIn : 0;
    const mediaElapsed = Number((firstDuration * speed).toFixed(3));
    const splitTrimPoint = Number((initialTrimIn + mediaElapsed).toFixed(3));

    // 0. Capture frame at playhead
    const instantFreezeThumb = captureActiveFrameNow(clip.url, splitTrimPoint);

    // 1. First half of video
    const firstClip = {
      ...clip,
      duration: firstDuration,
      maxDuration: firstDuration,
      minTrimIn: typeof clip.minTrimIn === "number" ? clip.minTrimIn : initialTrimIn,
      maxTrimOut: splitTrimPoint,
      trimIn: initialTrimIn,
      trimOut: splitTrimPoint,
      thumbnailTrimIn: initialTrimIn,
    };

    // 2. Freeze photo clip (inserted at curTime)
    const freezeClipId = `freeze-${Date.now()}`;
    const freezeClip = {
      id: freezeClipId,
      sourceMediaId: clip.sourceMediaId || clip.id,
      title: `${clip.title || "Video"} (Freeze)`,
      type: "photo" as const,
      url: clip.url,
      thumbnail: instantFreezeThumb || undefined,
      thumbnailTrimIn: splitTrimPoint,
      startTime: Number(curTime.toFixed(3)),
      duration: freezeDuration,
      trimIn: 0,
      trimOut: freezeDuration,
      speed: 1.0,
      volume: 0,
      filter: clip.filter,
      customLut: clip.customLut,
      transform: clip.transform ? { ...clip.transform } : undefined,
      mask: clip.mask ? { ...clip.mask } : undefined,
      crop: clip.crop ? { ...clip.crop } : undefined,
      trackIndex: clip.trackIndex,
    };

    // 3. Second half of video (shifted by freezeDuration)
    const secondDuration = Math.max(0.1, Number((clipEnd - curTime).toFixed(3)));
    const secondClip = {
      ...clip,
      id: `clip-v-${Date.now()}`,
      startTime: Number((curTime + freezeDuration).toFixed(3)),
      duration: secondDuration,
      maxDuration: secondDuration,
      minTrimIn: splitTrimPoint,
      maxTrimOut: typeof clip.maxTrimOut === "number" ? clip.maxTrimOut : clip.trimOut,
      trimIn: splitTrimPoint,
      trimOut: clip.trimOut,
      thumbnail: instantFreezeThumb || undefined,
      thumbnailTrimIn: splitTrimPoint,
    };

    if (instantFreezeThumb) {
      globalThumbnailCache.set(freezeClip.id, instantFreezeThumb);
      globalThumbnailCache.set(secondClip.id, instantFreezeThumb);
      globalThumbnailCache.set(`${secondClip.id}_t${splitTrimPoint.toFixed(2)}`, instantFreezeThumb);
    }

    // Shift video clips on timeline starting at or after curTime
    const newVideoClips: any[] = [];
    for (let i = 0; i < videoClips.length; i++) {
      if (i === idx) {
        newVideoClips.push(firstClip, freezeClip, secondClip);
      } else {
        const other = videoClips[i];
        if (other.startTime >= curTime) {
          newVideoClips.push({
            ...other,
            startTime: Number((other.startTime + freezeDuration).toFixed(3)),
          });
        } else {
          newVideoClips.push(other);
        }
      }
    }

    // Shift other track clips starting after curTime to keep alignment
    const shiftTrack = (items: any[]) =>
      (items || []).map((item) =>
        item.startTime >= curTime
          ? { ...item, startTime: Number((item.startTime + freezeDuration).toFixed(3)) }
          : item
      );

    const updatedProject = {
      ...project,
      tracks: {
        ...project.tracks,
        video: newVideoClips,
        audio: shiftTrack(project.tracks.audio),
        text: shiftTrack(project.tracks.text),
        stickers: shiftTrack(project.tracks.stickers),
        captions: shiftTrack(project.tracks.captions || []),
        effects: shiftTrack(project.tracks.effects),
      },
    };

    setSelectedClipId(freezeClipId);
    setSelectedClipType("photo");
    updateProjectWithHistory(updatedProject);

    if (freezeClip.url) {
      requestMediaThumbnail(freezeClip, true);
    }
    if (secondClip.url) {
      requestMediaThumbnail(secondClip, true);
    }

    addNotification({
      title: "Freeze Frame Inserted",
      message: `Created 3.0s freeze frame at ${curTime.toFixed(1)}s`,
      icon: "snow-outline",
    });
  }, [project, selectedClipId, selectedClipType, currentTimeRef, settings, setSelectedClipId, setSelectedClipType, updateProjectWithHistory, startProcessing]);

  // Request delete clip with confirmation modal
  const handleDeleteClip = useCallback(
    (targetId?: string, targetType?: string) => {
      if (!project) return;
      const clipId = targetId || selectedClipId;
      if (!clipId) return;

      let clipType = targetType || selectedClipType;
      let foundTrackKey: keyof typeof project.tracks | null = null;
      let clip: any = null;

      const trackKeys: Array<keyof typeof project.tracks> = [
        "video",
        "audio",
        "captions",
        "text",
        "stickers",
        "effects",
      ];
      if (clipType) {
        const preferredKey = (
          clipType === "caption" || clipType === "captions"
            ? "captions"
            : clipType === "sticker" || clipType === "stickers"
              ? "stickers"
              : clipType === "effect" || clipType === "effects"
                ? "effects"
                : clipType
        ) as keyof typeof project.tracks;
        const list = (project.tracks[preferredKey] as any[]) || [];
        const match = list.find((c) => c.id === clipId);
        if (match) {
          foundTrackKey = preferredKey;
          clip = match;
        }
      }

      if (!clip) {
        for (const k of trackKeys) {
          const list = (project.tracks[k] as any[]) || [];
          const match = list.find((c) => c.id === clipId);
          if (match) {
            foundTrackKey = k;
            clip = match;
            clipType =
              k === "stickers" ? "sticker" : k === "effects" ? "effects" : k === "captions" ? "caption" : k;
            break;
          }
        }
      }

      let name = `${(clipType || "item").charAt(0).toUpperCase() + (clipType || "item").slice(1)} Clip`;
      if (clip) {
        if ((clipType === "text" || clipType === "caption") && clip.text) {
          name = `"${clip.text.length > 25 ? clip.text.slice(0, 25) + "..." : clip.text}"`;
        } else if (clip.name) {
          name = clip.name;
        } else if (clip.label) {
          name = clip.label;
        } else if (clip.char) {
          name = `Sticker ${clip.char}`;
        } else if (clip.title) {
          name = clip.title;
        }
      }

      setClipToDelete({
        id: clipId,
        type: clipType || (foundTrackKey === "stickers" ? "sticker" : "video"),
        name,
        duration: clip?.duration,
      });
    },
    [project, selectedClipId, selectedClipType, setClipToDelete],
  );

  // Perform actual deletion after confirmation
  const handleConfirmDeleteClip = useCallback(() => {
    if (!project || !clipToDelete) return;
    const { id: clipId, type: clipType } = clipToDelete;

    const trackKeys: Array<keyof typeof project.tracks> = [
      "video",
      "audio",
      "captions",
      "text",
      "stickers",
      "effects",
    ];
    const preferredKey = (
      clipType === "caption" || clipType === "captions"
        ? "captions"
        : clipType === "sticker" || clipType === "stickers"
          ? "stickers"
          : clipType === "effect" || clipType === "effects"
            ? "effects"
            : clipType
    ) as keyof typeof project.tracks;

    let targetKey = preferredKey;
    if (
      !((project.tracks[targetKey] as any[]) || []).some((c) => c.id === clipId)
    ) {
      for (const k of trackKeys) {
        if (((project.tracks[k] as any[]) || []).some((c) => c.id === clipId)) {
          targetKey = k;
          break;
        }
      }
    }

    const list = [...(((project.tracks as any)[targetKey] as any[]) || [])];
    const filtered = list.filter((c) => c.id !== clipId);

    if (targetKey === "video") {
      let t = 0;
      filtered.forEach((c) => {
        if (!c.trackIndex || c.trackIndex === 0) {
          c.startTime = t;
          t += c.duration;
        }
      });
    }

    const updated = {
      ...project,
      tracks: {
        ...project.tracks,
        [targetKey]: filtered,
      },
    };
    setSelectedClipId(null);
    setSelectedClipType(null);
    soundEngine.playSfx("pop");
    triggerHaptic("warning", settings?.hapticFeedback !== false);
    updateProjectWithHistory(updated);
    setClipToDelete(null);
  }, [project, clipToDelete, settings, setSelectedClipId, setSelectedClipType, updateProjectWithHistory, setClipToDelete]);

  // Duplicate selected clip with non-overlapping multi-track placement
  const handleDuplicateClip = useCallback(
    (targetId?: string, targetType?: string) => {
      if (!project) return;
      const clipId = targetId || selectedClipId;
      const clipType = targetType || selectedClipType;
      if (!clipId) return;

      const key = (
        clipType === "caption" || clipType === "captions"
          ? "captions"
          : clipType === "sticker" || clipType === "stickers"
            ? "stickers"
            : clipType === "effect" || clipType === "effects"
              ? "effects"
              : clipType
      ) as keyof typeof project.tracks;
      const list = [...(((project.tracks as any)[key] as any[]) || [])];
      const idx = list.findIndex((c) => c.id === clipId);
      if (idx === -1) return;

      const original = list[idx];
      startProcessing?.("Duplicating Clip to Timeline...", 350);
      const dur = original.duration || 3.0;
      const origTrack =
        typeof original.trackIndex === "number"
          ? original.trackIndex
          : clipType === "caption" || clipType === "captions"
            ? 1
            : clipType === "audio"
              ? 1
              : clipType === "text"
                ? 2
                : clipType === "sticker" || clipType === "stickers"
                  ? 3
                  : clipType === "effects"
                    ? 4
                    : 0;

      // Place copied clip on a brand-new track directly below the existing one
      const newTrackIndex = Math.min(MAX_TRACKS - 1, origTrack + 1);

      const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id: `clip-${clipType[0]}-${Date.now()}`,
        sourceMediaId: original.sourceMediaId || original.id,
        startTime: original.startTime,
        trackIndex: newTrackIndex,
        position: original.position
          ? {
              x: Math.min(85, (original.position.x || 50) + 5),
              y: Math.min(85, (original.position.y || 50) + 5),
            }
          : undefined,
      };

      // Clone neural cutout masks immediately so copied overlay is in 100% sync
      if (original.id) {
        cloneClipMasks(original.id, clone.id);
        if (original.sourceMediaId) {
          cloneClipMasks(original.sourceMediaId, clone.id);
        }
      }

      // Shift all other clips across the project on tracks >= newTrackIndex down by 1
      const shiftTrackDown = (c: any) => {
        if (!c) return c;
        const curTrk = typeof c.trackIndex === "number" ? c.trackIndex : 0;
        if (curTrk >= newTrackIndex) {
          return { ...c, trackIndex: Math.min(MAX_TRACKS - 1, curTrk + 1) };
        }
        return c;
      };

      const updatedTracks: any = {
        video: (project.tracks.video || []).map(shiftTrackDown),
        audio: (project.tracks.audio || []).map(shiftTrackDown),
        captions: (project.tracks.captions || []).map(shiftTrackDown),
        text: (project.tracks.text || []).map(shiftTrackDown),
        stickers: (project.tracks.stickers || []).map(shiftTrackDown),
        effects: (project.tracks.effects || []).map(shiftTrackDown),
        filters: (project.tracks.filters || []).map(shiftTrackDown),
      };

      // Append clone to target list
      updatedTracks[key] = [...(updatedTracks[key] || []), clone];

      addNotification({
        title: "Clip Copied",
        message: `Placed on new Track ${newTrackIndex + 1} below existing clip.`,
        icon: "copy-outline",
      });

      const updated = {
        ...project,
        tracks: updatedTracks,
      };
      setSelectedClipId(clone.id);
      setSelectedClipType(clipType);
      updateProjectWithHistory(updated);
    },
    [project, selectedClipId, selectedClipType, setSelectedClipId, setSelectedClipType, updateProjectWithHistory],
  );

  return {
    handleSplitClip,
    handleFreezeFrame,
    handleDeleteClip,
    handleConfirmDeleteClip,
    handleDuplicateClip,
    handleRotateClip,
    handleToggleReverse,
    handleUpdateClipTransform,
    handleUpdateClipCrop,
    handleUpdateClipMask,
    handleTrimClip,
    handleMoveClip,
  };
}
