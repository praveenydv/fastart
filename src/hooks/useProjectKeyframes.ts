import { useMemo, useCallback } from "react";
import { FastArtProject } from "../types/project";
import { soundEngine } from "../utils/audioEngine";
import {
  cleanAndSortKeyframes,
  findKeyframeAtTime,
  getInterpolatedTransform,
} from "../utils/keyframeEngine";

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

const getTrackKey = (type: string): "video" | "audio" | "text" | "stickers" | "effects" => {
  if (type === "sticker" || type === "stickers") return "stickers";
  if (type === "effect" || type === "effects") return "effects";
  if (type === "text" || type === "texts") return "text";
  if (type === "audio") return "audio";
  return "video"; // video, photo, etc.
};

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
    return !!findKeyframeAtTime(clip.keyframes, localTime, 0.12);
  }, [selectedClip, project?.tracks?.video, currentTime]);

  // Add or Remove Keyframe to active clip
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
    const rawKeyframes = targetClip.keyframes || [];
    const localTime = Math.max(0, currentTime - (targetClip.startTime || 0));
    const existing = findKeyframeAtTime(rawKeyframes, localTime, 0.12);

    let updatedKf = [];
    let actionType: "added" | "removed" = "added";
    if (existing) {
      actionType = "removed";
      updatedKf = rawKeyframes.filter(
        (k: any) => Math.abs(k.time - localTime) >= 0.12,
      );
    } else {
      actionType = "added";
      // Sample exact interpolated state at currentTime so there is NO jumping or snapping
      const curT = getInterpolatedTransform(targetClip, currentTime, targetType);
      const curOpacity =
        targetClip.opacity !== undefined ? targetClip.opacity : 1.0;
      updatedKf = [
        ...rawKeyframes,
        {
          time: Number(localTime.toFixed(3)),
          transform: {
            scale: Number(curT.scale.toFixed(3)),
            rotation: Number(curT.rotation.toFixed(2)),
            x: Math.round(curT.x),
            y: Math.round(curT.y),
          },
          opacity: Number(curOpacity.toFixed(2)),
        },
      ];
    }

    updatedKf = cleanAndSortKeyframes(updatedKf);

    const key = getTrackKey(targetType);
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
    easing?: any,
  ) => {
    if (!selectedClip || !project) return;
    const rawKeyframes: any[] = selectedClip.keyframes || [];
    const existingIndex = rawKeyframes.findIndex(
      (k) => Math.abs(k.time - time) < 0.12,
    );

    let updatedKf = [...rawKeyframes];
    if (existingIndex >= 0) {
      const existing = updatedKf[existingIndex];
      updatedKf[existingIndex] = {
        ...existing,
        transform: { ...(existing.transform || {}), ...transform },
        opacity: opacity !== undefined ? opacity : (existing.opacity ?? 1.0),
        easing: easing !== undefined ? easing : (existing.easing ?? 'easeInOut'),
      };
    } else {
      const curT = getInterpolatedTransform(
        selectedClip,
        (selectedClip.startTime || 0) + time,
        selectedClipType,
      );
      updatedKf.push({
        time: Number(time.toFixed(3)),
        transform: {
          scale: curT.scale,
          rotation: curT.rotation,
          x: curT.x,
          y: curT.y,
          ...transform,
        },
        opacity: opacity !== undefined ? opacity : (selectedClip.opacity ?? 1.0),
        easing: easing || 'easeInOut',
      });
    }

    updatedKf = cleanAndSortKeyframes(updatedKf);

    const key = getTrackKey(selectedClipType);
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
    const rawKeyframes: any[] = selectedClip.keyframes || [];
    const updatedKf = cleanAndSortKeyframes(
      rawKeyframes.filter((k) => Math.abs(k.time - time) >= 0.12),
    );

    const key = getTrackKey(selectedClipType);
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
    const key = getTrackKey(selectedClipType);
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
