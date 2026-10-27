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
import { allocateClipPlacement, doesClipOverlap, allocateNewTrackForClip } from "../utils/trackPlacement";
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
    currentTime,
    transitionTargetClipId,
    updateProjectWithHistory,
    setActiveModal,
    setSelectedClipId,
    setSelectedClipType,
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
      const current = projectRef.current || project;
      if (!current) return;
      const list = [...(current.tracks.effects || [])];
      const idx = list.findIndex((c) => c.id === updatedClip.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updatedClip };
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, effects: list },
        });
      }
    },
    [project, projectRef, updateProjectWithHistory],
  );

  // Add new media clip
  const handleAddMedia = useCallback(
    (newClip: any) => {
      const current = projectRef.current || project;
      if (!current) return;
      startProcessing(
        `Importing ${newClip.title || (newClip.type === "photo" ? "Photo" : "Video")}...`,
        450,
      );
      const videoClips = [...(current.tracks.video || [])];
      const endingIdx = videoClips.findIndex((c) => (c as any).isEnding);
      const endingClip =
        endingIdx >= 0 ? videoClips.splice(endingIdx, 1)[0] : null;

      let targetStart = currentTime > 0 ? currentTime : 0;
      if (typeof newClip.startTime === "number" && newClip.startTime > 0) {
        targetStart = newClip.startTime;
      }

      // If project has no media clips yet, place on Track 0. Otherwise allocate brand-new track.
      if (videoClips.length === 0) {
        newClip.startTime = Math.max(0, Number(targetStart.toFixed(3)));
        newClip.trackIndex = 0;
        videoClips.push(newClip);
      } else {
        const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
          current,
          targetStart,
        );
        newClip.startTime = Math.max(0, Number(targetStart.toFixed(3)));
        newClip.trackIndex = newTrackIndex;
        videoClips.push(newClip);
        addNotification({
          title: "Added on New Track",
          message: `Placed on Track ${newTrackIndex + 1}.`,
          icon: "videocam-outline",
        });
      }

      if (endingClip) {
        const maxEnd = Math.max(
          ...videoClips.map((c) => c.startTime + c.duration),
        );
        endingClip.startTime = maxEnd;
        videoClips.push(endingClip);
      }

      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, video: videoClips },
      });

      if (setSelectedClipId) {
        setSelectedClipId(newClip.id);
      }
      if (setSelectedClipType) {
        setSelectedClipType(newClip.type === "photo" ? "photo" : "video");
      }

      if (newClip.url && newClip.type !== "photo") {
        extractRealMediaAudioPeaks(newClip.url, newClip.id);
      }
    },
    [project, projectRef, currentTime, updateProjectWithHistory, startProcessing, addNotification, setSelectedClipId, setSelectedClipType],
  );

  // Add text overlay on a new track
  const handleAddText = useCallback(
    (newTextClip: any) => {
      const current = projectRef.current || project;
      if (!current) return;
      startProcessing("Adding Text Overlay...", 350);
      const desiredStart = currentTime;
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        current,
        desiredStart,
      );

      newTextClip.startTime = Math.max(0, Number(desiredStart.toFixed(3)));
      newTextClip.trackIndex = newTrackIndex;
      const textClips = [...(current.tracks.text || []), newTextClip];

      addNotification({
        title: "Text Overlay Added",
        message: `Placed on Track ${newTrackIndex + 1}.`,
        icon: "text-outline",
      });

      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, text: textClips },
      });

      if (setSelectedClipId) {
        setSelectedClipId(newTextClip.id);
      }
      if (setSelectedClipType) {
        setSelectedClipType("text");
      }
    },
    [project, projectRef, currentTime, updateProjectWithHistory, addNotification, setSelectedClipId, setSelectedClipType, startProcessing],
  );

  // Add multiple synchronized auto-captions on a new dedicated track
  const handleAddCaptions = useCallback(
    (captions: any[]) => {
      const current = projectRef.current || project;
      if (!current || !captions || captions.length === 0) return;
      startProcessing(
        `Synchronizing ${captions.length} Auto Captions...`,
        500,
      );
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        current,
        0,
      );
      const syncedCaptions = captions.map((c) => ({
        ...c,
        trackIndex: newTrackIndex,
      }));
      // Clean up previous auto-captions so re-running replaces them cleanly without overlap
      const nonAuto = (current.tracks.captions || []).filter(
        (c: any) => !c.id?.startsWith("cap-"),
      );
      const updatedTracks = {
        ...current.tracks,
        captions: [...nonAuto, ...syncedCaptions],
      };
      updateProjectWithHistory({
        tracks: updatedTracks,
      });
      if (setSelectedClipId) {
        setSelectedClipId(syncedCaptions[0].id);
      }
      if (setSelectedClipType) {
        setSelectedClipType("caption");
      }
      addNotification({
        title: "Auto-Captions Added",
        message: `Successfully synchronized on Track ${newTrackIndex + 1}.`,
        icon: "chatbox-ellipses-outline",
      });
    },
    [project, projectRef, updateProjectWithHistory, addNotification, setSelectedClipId, setSelectedClipType, startProcessing],
  );

  // Add audio clip on a new track
  const handleAddAudio = useCallback(
    (newAudioClip: any) => {
      const current = projectRef.current || project;
      if (!current) return;
      startProcessing(
        `Adding Audio "${newAudioClip.title || "Sound Track"}"...`,
        450,
      );
      const desiredStart = currentTime;
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        current,
        desiredStart,
      );

      newAudioClip.startTime = Math.max(0, Number(desiredStart.toFixed(3)));
      newAudioClip.trackIndex = newTrackIndex;
      const audioClips = [...(current.tracks.audio || []), newAudioClip];

      addNotification({
        title: "Audio Track Added",
        message: `Placed on Track ${newTrackIndex + 1}.`,
        icon: "musical-notes-outline",
      });

      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, audio: audioClips },
      });

      if (setSelectedClipId) {
        setSelectedClipId(newAudioClip.id);
      }
      if (setSelectedClipType) {
        setSelectedClipType("audio");
      }

      if (newAudioClip.url) {
        extractRealMediaAudioPeaks(newAudioClip.url, newAudioClip.id);
      }
    },
    [project, projectRef, currentTime, updateProjectWithHistory, startProcessing, addNotification, setSelectedClipId, setSelectedClipType],
  );

  // Add sticker overlay on a new track
  const handleAddSticker = useCallback(
    (newStickerClip: any) => {
      const current = projectRef.current || project;
      if (!current) return;
      startProcessing("Adding Sticker Overlay...", 350);
      const desiredStart = currentTime;
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        current,
        desiredStart,
      );

      newStickerClip.startTime = Math.max(0, Number(desiredStart.toFixed(3)));
      newStickerClip.trackIndex = newTrackIndex;
      const stickerClips = [...(current.tracks.stickers || []), newStickerClip];

      addNotification({
        title: "Sticker Added",
        message: `Placed on Track ${newTrackIndex + 1}.`,
        icon: "happy-outline",
      });

      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, stickers: stickerClips },
      });

      if (setSelectedClipId) {
        setSelectedClipId(newStickerClip.id);
      }
      if (setSelectedClipType) {
        setSelectedClipType("sticker");
      }
    },
    [project, projectRef, currentTime, updateProjectWithHistory, startProcessing, addNotification, setSelectedClipId, setSelectedClipType],
  );

  // Add or preview effect on a new track
  const handleAddEffect = useCallback(
    (preset: any) => {
      const current = projectRef.current || project;
      if (!current) return;

      // 1. If explicit on-clip application requested:
      if (preset.applyToClip && selectedClip && selectedClipType === "video" && selectedClipId) {
        const videoClips = [...(current.tracks.video || [])];
        const idx = videoClips.findIndex((c) => c.id === selectedClipId);
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

      // 2. Otherwise: create a standalone Timeline Effect Clip on a brand-new track!
      if (preset.id === "none") return;
      const dur = preset.duration || 3.0;
      const desiredStart = currentTime || 0;
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        current,
        desiredStart,
      );

      const newEff: EffectClip = {
        id: preset.id && String(preset.id).startsWith("eff-") ? preset.id : "eff-" + Date.now(),
        type: preset.type || preset.id,
        name: preset.name || "Effect",
        startTime: Math.max(0, Number(desiredStart.toFixed(3))),
        duration: dur,
        intensity: preset.intensity !== undefined ? preset.intensity : 0.8,
        trackIndex: newTrackIndex,
      };
      const effectClips = [...(current.tracks.effects || []), newEff];

      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, effects: effectClips },
      });

      if (setSelectedClipId) {
        setSelectedClipId(newEff.id);
      }
      if (setSelectedClipType) {
        setSelectedClipType("effects");
      }

      addNotification({
        title: "Effect Added",
        message: `Placed "${newEff.name}" on Track ${newTrackIndex + 1}.`,
        icon: "sparkles",
      });
    },
    [project, projectRef, selectedClip, selectedClipType, selectedClipId, currentTime, updateProjectWithHistory, setSelectedClipId, setSelectedClipType, addNotification],
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
