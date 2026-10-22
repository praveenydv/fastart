import { useCallback } from "react";
import { Alert } from "react-native";
import {
  FastArtProject,
  TextClip,
  CaptionClip,
  StickerClip,
  EffectClip,
} from "../types/project";
import { addNotification } from "../utils/storage";
import { allocateClipPlacement, doesClipOverlap } from "../utils/trackPlacement";
import { useProjectFilterEffects } from "./useProjectFilterEffects";
import { extractRealMediaAudioPeaks } from "../utils/mediaAudioDetector";

interface UseProjectMediaAddersParams {
  project: FastArtProject | null;
  projectRef: React.MutableRefObject<FastArtProject | null>;
  selectedClip: any;
  selectedClipId: string | null;
  selectedClipType: string;
  currentTime: number;
  transitionTargetClipId: string | null;
  updateProjectWithHistory: (proj: any) => void;
  setActiveModal: (modal: string | null) => void;
  setSelectedClipId?: (id: string | null) => void;
  setSelectedClipType?: (type: string) => void;
}

export function useProjectMediaAdders({
  project,
  projectRef,
  selectedClip,
  selectedClipId,
  selectedClipType,
  currentTime,
  transitionTargetClipId,
  updateProjectWithHistory,
  setActiveModal,
  setSelectedClipId,
  setSelectedClipType,
}: UseProjectMediaAddersParams) {
  // Delegate filter, effects, tracking, speed, cutout, volume, transform operations
  const {
    handleApplyFilter,
    handleApplyCutout,
    handleApplyMotionTracking,
    handleApplyTransition,
    handleApplySpeed,
    handleApplyVolume,
    handleToggleDenoise,
    handleExtractAudioFromVideo,
    handleApplyTransform,
    handleApplyEnhance,
    isProcessing,
    processingMessage,
    startProcessing,
    withProcessing,
  } = useProjectFilterEffects({
    project,
    projectRef,
    selectedClip,
    selectedClipId,
    selectedClipType,
    transitionTargetClipId,
    updateProjectWithHistory,
    setActiveModal,
  });

  // Update text clip from modal
  const handleUpdateText = useCallback(
    (updatedClip: any) => {
      const current = projectRef.current || project;
      if (!current || !updatedClip?.id) return;

      const textList = [...(current.tracks.text || [])];
      const textIdx = textList.findIndex((c) => c.id === updatedClip.id);
      if (textIdx >= 0) {
        textList[textIdx] = { ...textList[textIdx], ...updatedClip };
        updateProjectWithHistory({
          tracks: { ...current.tracks, text: textList },
        });
        if (setSelectedClipId) setSelectedClipId(updatedClip.id);
        if (setSelectedClipType) setSelectedClipType("text");
        return;
      }

      const capList = [...(current.tracks.captions || [])];
      const capIdx = capList.findIndex((c) => c.id === updatedClip.id);
      if (capIdx >= 0) {
        capList[capIdx] = { ...capList[capIdx], ...updatedClip };
        updateProjectWithHistory({
          tracks: { ...current.tracks, captions: capList },
        });
        if (setSelectedClipId) setSelectedClipId(updatedClip.id);
        if (setSelectedClipType) setSelectedClipType("caption");
        return;
      }
    },
    [project, projectRef, updateProjectWithHistory, setSelectedClipId, setSelectedClipType],
  );

  // Update caption clip
  const handleUpdateCaption = useCallback(
    (updatedClip: any) => {
      const current = projectRef.current || project;
      if (!current || !updatedClip?.id) return;

      const capList = [...(current.tracks.captions || [])];
      const capIdx = capList.findIndex((c) => c.id === updatedClip.id);
      if (capIdx >= 0) {
        capList[capIdx] = { ...capList[capIdx], ...updatedClip };
        updateProjectWithHistory({
          tracks: { ...current.tracks, captions: capList },
        });
        if (setSelectedClipId) setSelectedClipId(updatedClip.id);
        if (setSelectedClipType) setSelectedClipType("caption");
        return;
      }

      const textList = [...(current.tracks.text || [])];
      const textIdx = textList.findIndex((c) => c.id === updatedClip.id);
      if (textIdx >= 0) {
        textList[textIdx] = { ...textList[textIdx], ...updatedClip };
        updateProjectWithHistory({
          tracks: { ...current.tracks, text: textList },
        });
        if (setSelectedClipId) setSelectedClipId(updatedClip.id);
        if (setSelectedClipType) setSelectedClipType("text");
        return;
      }
    },
    [project, projectRef, updateProjectWithHistory, setSelectedClipId, setSelectedClipType],
  );

  // Update sticker clip from modal
  const handleUpdateSticker = useCallback(
    (updatedClip: StickerClip) => {
      const current = projectRef.current;
      if (!current) return;
      const list = [...(current.tracks.stickers || [])];
      const idx = list.findIndex((c) => c.id === updatedClip.id);
      if (idx >= 0) {
        list[idx] = updatedClip;
        updateProjectWithHistory({
          tracks: { ...current.tracks, stickers: list },
        });
      }
    },
    [projectRef, updateProjectWithHistory],
  );

  // Update effect clip from modal
  const handleUpdateEffect = useCallback(
    (updatedClip: EffectClip) => {
      const current = projectRef.current;
      if (!current) return;
      const list = [...(current.tracks.effects || [])];
      const idx = list.findIndex((c) => c.id === updatedClip.id);
      if (idx >= 0) {
        list[idx] = updatedClip;
        updateProjectWithHistory({
          tracks: { ...current.tracks, effects: list },
        });
      }
    },
    [projectRef, updateProjectWithHistory],
  );

  // Add new media clip
  const handleAddMedia = useCallback(
    (newClip: any) => {
      if (!project) return;
      startProcessing(
        `Importing ${newClip.title || (newClip.type === "photo" ? "Photo" : "Video")}...`,
        450,
      );
      const videoClips = [...(project.tracks.video || [])];
      const endingIdx = videoClips.findIndex((c) => (c as any).isEnding);
      const endingClip =
        endingIdx >= 0 ? videoClips.splice(endingIdx, 1)[0] : null;
      const newDuration = newClip.duration || 5.0;

      let targetStart = currentTime > 0 ? currentTime : 0;
      if (typeof newClip.startTime === "number" && newClip.startTime > 0) {
        targetStart = newClip.startTime;
      }

      const track0Clips = videoClips.filter((c) => (c.trackIndex ?? 0) === 0);
      const lastTrack0End =
        track0Clips.length > 0
          ? Math.max(...track0Clips.map((c) => c.startTime + c.duration))
          : 0;

      if (targetStart === 0 && track0Clips.length > 0) {
        targetStart = lastTrack0End;
      }

      const fitsOnTrack0 = !doesClipOverlap(
        targetStart,
        newDuration,
        track0Clips,
      );

      if (fitsOnTrack0) {
        newClip.startTime = Math.max(0, Number(targetStart.toFixed(3)));
        newClip.trackIndex = 0;
        videoClips.push(newClip);
      } else {
        const placement = allocateClipPlacement(
          project,
          targetStart,
          newDuration,
          0,
        );
        if (placement && placement.trackIndex !== 0) {
          newClip.startTime = placement.startTime;
          newClip.trackIndex = placement.trackIndex;
          videoClips.push(newClip);
          addNotification({
            title: "Added on New Track",
            message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
            icon: "videocam-outline",
          });
        } else {
          newClip.startTime = Math.max(0, Number(lastTrack0End.toFixed(3)));
          newClip.trackIndex = 0;
          videoClips.push(newClip);
          addNotification({
            title: "Appended to Timeline",
            message: `Position occupied; placed after previous clip to prevent overlap.`,
            icon: "videocam-outline",
          });
        }
      }

      if (endingClip) {
        const maxEnd = Math.max(
          ...videoClips.map((c) => c.startTime + c.duration),
        );
        endingClip.startTime = maxEnd;
        videoClips.push(endingClip);
      }

      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });

      if (newClip.url && newClip.type !== "photo") {
        extractRealMediaAudioPeaks(newClip.url, newClip.id);
      }
    },
    [project, currentTime, updateProjectWithHistory],
  );

  // Add text overlay
  const handleAddText = useCallback(
    (newTextClip: any) => {
      if (!project) return;
      startProcessing("Adding Text Overlay...", 350);
      const dur = newTextClip.duration || 3.0;
      const desiredStart = currentTime;
      const placement = allocateClipPlacement(project, desiredStart, dur, 2);

      if (!placement) {
        Alert.alert(
          "Not Enough Space",
          "All tracks are occupied at this playhead position. Please move existing clips or free up a track.",
        );
        return;
      }

      newTextClip.startTime = placement.startTime;
      newTextClip.trackIndex = placement.trackIndex;
      const textClips = [...(project.tracks.text || []), newTextClip];

      if (placement.trackIndex !== 2) {
        addNotification({
          title: "Text Overlay Added",
          message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
          icon: "text-outline",
        });
      }

      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, text: textClips },
      });

      if (setSelectedClipId) {
        setSelectedClipId(newTextClip.id);
      }
      if (setSelectedClipType) {
        setSelectedClipType("text");
      }
    },
    [project, currentTime, updateProjectWithHistory, addNotification, setSelectedClipId, setSelectedClipType],
  );

  // Add multiple synchronized auto-captions
  const handleAddCaptions = useCallback(
    (captions: any[]) => {
      const current = projectRef.current || project;
      if (!current || !captions || captions.length === 0) return;
      startProcessing(
        `Synchronizing ${captions.length} Auto Captions...`,
        500,
      );
      // Clean up previous auto-captions so re-running replaces them cleanly without overlap
      const nonAuto = (current.tracks.captions || []).filter(
        (c: any) => !c.id?.startsWith("cap-"),
      );
      const updatedTracks = {
        ...current.tracks,
        captions: [...nonAuto, ...captions],
      };
      updateProjectWithHistory({
        tracks: updatedTracks,
      });
      if (setSelectedClipId) {
        setSelectedClipId(captions[0].id);
      }
      if (setSelectedClipType) {
        setSelectedClipType("caption");
      }
      addNotification({
        title: "Auto-Captions Added",
        message: `Successfully synchronized ${captions.length} captions along the timeline.`,
        icon: "chatbox-ellipses-outline",
      });
    },
    [project, projectRef, updateProjectWithHistory, addNotification, setSelectedClipId, setSelectedClipType],
  );

  // Add audio clip
  const handleAddAudio = useCallback(
    (newAudioClip: any) => {
      if (!project) return;
      startProcessing(
        `Adding Audio "${newAudioClip.title || "Sound Track"}"...`,
        450,
      );
      const dur = newAudioClip.duration || 5.0;
      const desiredStart = currentTime;
      const placement = allocateClipPlacement(project, desiredStart, dur, 1);

      if (!placement) {
        Alert.alert(
          "Not Enough Space",
          "All audio/track lanes are occupied at this playhead position. Please move existing clips or free up a track.",
        );
        return;
      }

      newAudioClip.startTime = placement.startTime;
      newAudioClip.trackIndex = placement.trackIndex;
      const audioClips = [...(project.tracks.audio || []), newAudioClip];

      if (placement.trackIndex !== 1) {
        addNotification({
          title: "Audio Track Added",
          message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
          icon: "musical-notes-outline",
        });
      }

      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, audio: audioClips },
      });

      if (newAudioClip.url) {
        extractRealMediaAudioPeaks(newAudioClip.url, newAudioClip.id);
      }
    },
    [project, currentTime, updateProjectWithHistory, startProcessing],
  );

  // Add sticker overlay
  const handleAddSticker = useCallback(
    (newStickerClip: any) => {
      if (!project) return;
      startProcessing("Adding Sticker Overlay...", 350);
      const dur = newStickerClip.duration || 3.0;
      const desiredStart = currentTime;
      const placement = allocateClipPlacement(project, desiredStart, dur, 3);

      if (!placement) {
        Alert.alert(
          "Not Enough Space",
          "All tracks are occupied at this playhead position. Please move existing clips or free up a track.",
        );
        return;
      }

      newStickerClip.startTime = placement.startTime;
      newStickerClip.trackIndex = placement.trackIndex;
      const stickerClips = [...(project.tracks.stickers || []), newStickerClip];

      if (placement.trackIndex !== 3) {
        addNotification({
          title: "Sticker Added",
          message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
          icon: "happy-outline",
        });
      }

      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, stickers: stickerClips },
      });
    },
    [project, currentTime, updateProjectWithHistory],
  );

  // Add or preview effect
  const handleAddEffect = useCallback(
    (preset: any) => {
      const current = projectRef.current || project;
      if (!current) return;

      const targetId =
        (selectedClip && selectedClipType === "video" ? selectedClipId : null) ||
        current.tracks.video?.find(
          (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration,
        )?.id ||
        current.tracks.video?.[0]?.id;

      if (targetId) {
        const videoClips = [...(current.tracks.video || [])];
        const idx = videoClips.findIndex((c) => c.id === targetId);
        if (idx >= 0) {
          videoClips[idx] = {
            ...videoClips[idx],
            effect: preset.id === "none" ? undefined : (preset.type || preset.id),
            effectIntensity: preset.intensity !== undefined ? preset.intensity : 0.8,
          };
          updateProjectWithHistory({
            ...current,
            tracks: { ...current.tracks, video: videoClips },
          });
          return;
        }
      }

      if (preset.id === "none") return;
      const dur = 3.0;
      const desiredStart = currentTime;
      const placement = allocateClipPlacement(current, desiredStart, dur, 4);

      if (!placement) {
        Alert.alert(
          "Not Enough Space",
          "All tracks are occupied at this playhead position. Please move existing clips or free up a track.",
        );
        return;
      }

      const newEff = {
        id: "eff-" + Date.now(),
        type: preset.type || preset.id,
        name: preset.name,
        startTime: placement.startTime,
        duration: dur,
        intensity: preset.intensity || 0.8,
        trackIndex: placement.trackIndex,
      };
      const effectClips = [...(current.tracks.effects || []), newEff];

      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, effects: effectClips },
      });
    },
    [project, projectRef, selectedClip, selectedClipType, selectedClipId, currentTime, updateProjectWithHistory],
  );

  return {
    handleUpdateText,
    handleUpdateCaption,
    handleUpdateSticker,
    handleUpdateEffect,
    handleAddMedia,
    handleAddText,
    handleAddAudio,
    handleAddSticker,
    handleAddEffect,
    handleApplyFilter,
    handleApplyCutout,
    handleApplyMotionTracking,
    handleApplyTransition,
    handleApplySpeed,
    handleApplyVolume,
    handleToggleDenoise,
    handleExtractAudioFromVideo,
    handleApplyTransform,
    handleApplyEnhance,
    handleAddCaptions,
    isProcessing,
    processingMessage,
    startProcessing,
    withProcessing,
  };
}
