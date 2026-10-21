import { useCallback } from "react";
import { Alert } from "react-native";
import {
  FastArtProject,
  TextClip,
  StickerClip,
  EffectClip,
} from "../types/project";
import { addNotification } from "../utils/storage";
import { allocateClipPlacement, doesClipOverlap } from "../utils/trackPlacement";
import { useProjectFilterEffects } from "./useProjectFilterEffects";

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
}: UseProjectMediaAddersParams) {
  // Delegate filter, effects, tracking, speed, cutout, volume, transform operations
  const {
    handleApplyFilter,
    handleApplyCutout,
    handleApplyMotionTracking,
    handleApplyTransition,
    handleApplySpeed,
    handleApplyVolume,
    handleApplyTransform,
    handleApplyEnhance,
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
    (updatedClip: TextClip) => {
      const current = projectRef.current;
      if (!current) return;
      const list = [...(current.tracks.text || [])];
      const idx = list.findIndex((c) => c.id === updatedClip.id);
      if (idx >= 0) {
        list[idx] = updatedClip;
        updateProjectWithHistory({
          tracks: { ...current.tracks, text: list },
        });
      }
    },
    [projectRef, updateProjectWithHistory],
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
    },
    [project, currentTime, updateProjectWithHistory],
  );

  // Add text overlay
  const handleAddText = useCallback(
    (newTextClip: any) => {
      if (!project) return;
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
    },
    [project, currentTime, updateProjectWithHistory],
  );

  // Add audio clip
  const handleAddAudio = useCallback(
    (newAudioClip: any) => {
      if (!project) return;
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
    },
    [project, currentTime, updateProjectWithHistory],
  );

  // Add sticker overlay
  const handleAddSticker = useCallback(
    (newStickerClip: any) => {
      if (!project) return;
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

  // Add effect
  const handleAddEffect = useCallback(
    (preset: any) => {
      if (!project) return;
      if (selectedClip && selectedClipType === "video") {
        const videoClips = [...(project.tracks.video || [])];
        const idx = videoClips.findIndex((c) => c.id === selectedClipId);
        if (idx >= 0) {
          videoClips[idx] = { ...videoClips[idx], effect: preset.id };
          updateProjectWithHistory({
            ...project,
            tracks: { ...project.tracks, video: videoClips },
          });
        }
      } else {
        const dur = 3.0;
        const desiredStart = currentTime;
        const placement = allocateClipPlacement(project, desiredStart, dur, 4);

        if (!placement) {
          Alert.alert(
            "Not Enough Space",
            "All tracks are occupied at this playhead position. Please move existing clips or free up a track.",
          );
          return;
        }

        const newEff = {
          id: "eff-" + Date.now(),
          type: preset.type,
          name: preset.name,
          startTime: placement.startTime,
          duration: dur,
          intensity: preset.intensity || 0.8,
          trackIndex: placement.trackIndex,
        };
        const effectClips = [...(project.tracks.effects || []), newEff];

        if (placement.trackIndex !== 4) {
          addNotification({
            title: "Effect Added",
            message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
            icon: "sparkles-outline",
          });
        }

        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, effects: effectClips },
        });
      }
      setActiveModal(null);
    },
    [project, selectedClip, selectedClipType, selectedClipId, currentTime, updateProjectWithHistory, setActiveModal],
  );

  return {
    handleUpdateText,
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
    handleApplyTransform,
    handleApplyEnhance,
  };
}
