import { useMemo, useCallback } from "react";
import { FastArtProject } from "../types/project";
import { soundEngine } from "../utils/audioEngine";

interface UseProjectKeyframesParams {
  project: FastArtProject | null;
  selectedClip: any;
  selectedClipId: string | null;
  selectedClipType: string;
  setSelectedClipId: (id: string | null) => void;
  setSelectedClipType: (type: string) => void;
  currentTime: number;
  currentTimeRef: React.MutableRefObject<number>;
  updateProjectWithHistory: (proj: any) => void;
  openModal: (modal: string) => void;
}

export function useProjectKeyframes({
  project,
  selectedClip,
  selectedClipId,
  selectedClipType,
  setSelectedClipId,
  setSelectedClipType,
  currentTime,
  currentTimeRef,
  updateProjectWithHistory,
  openModal,
}: UseProjectKeyframesParams) {
  const isKeyframeAtPlayhead = useMemo(() => {
    let clip = selectedClip;
    if (!clip) {
      const curTime = currentTime;
      const videoClips = project?.tracks?.video || [];
      clip = videoClips.find(
        (c: any) =>
          curTime >= (c.startTime || 0) - 0.05 &&
          curTime <= (c.startTime || 0) + (c.duration || 0) + 0.05,
      );
    }
    if (!clip?.keyframes || clip.keyframes.length === 0) return false;
    const localTime = Math.max(0, currentTime - (clip.startTime || 0));
    return clip.keyframes.some((k: any) => Math.abs(k.time - localTime) < 0.12);
  }, [selectedClip, project?.tracks?.video, currentTime]);

  // Add Keyframe to active clip (Modern - zero system alerts!)
  const handleAddKeyframe = useCallback((): { action: "added" | "removed"; time: number } | void => {
    let targetClip = selectedClip;
    let targetType = selectedClipType;
    let targetId = selectedClipId;

    // Auto-target: If user hasn't tapped a clip, target the video clip right under playhead!
    if (!targetClip) {
      const curTime = currentTimeRef.current;
      const videoClips = project?.tracks?.video || [];
      const activeVideo = videoClips.find(
        (c: any) =>
          curTime >= (c.startTime || 0) - 0.05 &&
          curTime <= (c.startTime || 0) + (c.duration || 0) + 0.05,
      );
      if (activeVideo) {
        targetClip = activeVideo;
        targetType = "video";
        targetId = activeVideo.id;
        setSelectedClipId(activeVideo.id);
        setSelectedClipType("video");
      }
    }

    if (!targetClip) {
      soundEngine.playSfx("click");
      openModal("keyframe");
      return;
    }

    soundEngine.playSfx("pop");
    // Toggle keyframe stamp
    const keyframes = targetClip.keyframes || [];
    const localTime = Math.max(0, currentTime - targetClip.startTime);
    const exists = keyframes.some(
      (k: any) => Math.abs(k.time - localTime) < 0.12,
    );

    let updatedKf = [];
    let actionType: "added" | "removed" = "added";
    if (exists) {
      actionType = "removed";
      updatedKf = keyframes.filter(
        (k: any) => Math.abs(k.time - localTime) >= 0.12,
      );
    } else {
      actionType = "added";
      updatedKf = [
        ...keyframes,
        {
          time: localTime,
          transform: {
            ...(targetClip.transform || {
              scale: 1,
              rotation: 0,
              x: 0,
              y: 0,
            }),
          },
          opacity: targetClip.opacity !== undefined ? targetClip.opacity : 1.0,
        },
      ];
    }

    const key = (
      targetType === "sticker" || targetType === "stickers"
        ? "stickers"
        : targetType === "effect" || targetType === "effects"
          ? "effects"
          : targetType === "text" || targetType === "texts"
            ? "text"
            : targetType
    ) as keyof typeof project.tracks;

    const list = [...(((project?.tracks as any)?.[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === targetId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], keyframes: updatedKf };
      updateProjectWithHistory({
        ...project,
        tracks: { ...(project?.tracks || {}), [key]: list } as any,
      });
    }

    return { action: actionType, time: currentTime };
  }, [
    selectedClip,
    selectedClipType,
    selectedClipId,
    currentTimeRef,
    project,
    currentTime,
    setSelectedClipId,
    setSelectedClipType,
    openModal,
    updateProjectWithHistory,
  ]);

  const handleUpdateKeyframeTransform = useCallback((
    time: number,
    transform: any,
    opacity?: number,
  ) => {
    if (!selectedClip || !project) return;
    const keyframes: any[] = selectedClip.keyframes || [];
    const existingIndex = keyframes.findIndex(
      (k) => Math.abs(k.time - time) < 0.12,
    );

    let updatedKf = [...keyframes];
    if (existingIndex >= 0) {
      const existing = updatedKf[existingIndex];
      updatedKf[existingIndex] = {
        ...existing,
        transform: { ...(existing.transform || {}), ...transform },
        opacity: opacity !== undefined ? opacity : (existing.opacity ?? 1.0),
      };
    } else {
      updatedKf.push({
        time,
        transform: { ...(selectedClip.transform || {}), ...transform },
        opacity: opacity !== undefined ? opacity : (selectedClip.opacity ?? 1.0),
      });
    }

    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "effect" || selectedClipType === "effects"
          ? "effects"
          : selectedClipType === "text" || selectedClipType === "texts"
            ? "text"
            : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...(((project.tracks as any)?.[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        transform: { ...(list[idx].transform || {}), ...transform },
        opacity: opacity !== undefined ? opacity : (list[idx].opacity ?? 1.0),
        keyframes: updatedKf,
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, [key]: list } as any,
      });
    }
  }, [selectedClip, project, selectedClipType, selectedClipId, updateProjectWithHistory]);

  const handleDeleteKeyframeAtTime = useCallback((time: number) => {
    if (!selectedClip || !project) return;
    const keyframes: any[] = selectedClip.keyframes || [];
    const updatedKf = keyframes.filter((k) => Math.abs(k.time - time) >= 0.12);

    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "effect" || selectedClipType === "effects"
          ? "effects"
          : selectedClipType === "text" || selectedClipType === "texts"
            ? "text"
            : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...(((project.tracks as any)?.[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], keyframes: updatedKf };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, [key]: list } as any,
      });
    }
  }, [selectedClip, project, selectedClipType, selectedClipId, updateProjectWithHistory]);

  const handleClearAllKeyframes = useCallback(() => {
    if (!selectedClip || !project) return;
    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "effect" || selectedClipType === "effects"
          ? "effects"
          : selectedClipType === "text" || selectedClipType === "texts"
            ? "text"
            : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...(((project.tracks as any)?.[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], keyframes: [] };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, [key]: list } as any,
      });
    }
  }, [selectedClip, project, selectedClipType, selectedClipId, updateProjectWithHistory]);

  return {
    isKeyframeAtPlayhead,
    handleAddKeyframe,
    handleUpdateKeyframeTransform,
    handleDeleteKeyframeAtTime,
    handleClearAllKeyframes,
  };
}
