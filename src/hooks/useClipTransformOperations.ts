import { useCallback } from "react";
import { FastArtProject, CustomCrop } from "../types/project";
import { clampClipTrimUpdates } from "../utils/mediaDuration";
import {
  applyTransformUpdateToClip,
  getInterpolatedTransform,
} from "../utils/keyframeEngine";

interface UseClipTransformOperationsParams {
  project: FastArtProject | null;
  projectRef: React.MutableRefObject<FastArtProject | null>;
  setProject: React.Dispatch<React.SetStateAction<FastArtProject | null>>;
  selectedClip: any;
  selectedClipId: string | null;
  selectedClipType: string;
  updateProjectWithHistory: (proj: any) => void;
}

export function useClipTransformOperations({
  project,
  projectRef,
  setProject,
  selectedClip,
  selectedClipId,
  selectedClipType,
  updateProjectWithHistory,
}: UseClipTransformOperationsParams) {
  // Direct on-canvas transform update (move with hand, resize, rotate)
  const handleUpdateClipTransform = useCallback(
    (
      clipId: string,
      clipType: string,
      transform: { x: number; y: number; scale: number; rotation: number },
      isFinal: boolean = true,
    ) => {
      const current = projectRef.current;
      if (!current) return;
      const key = (
        clipType === "sticker" || clipType === "stickers"
          ? "stickers"
          : clipType === "photo" || clipType === "video"
            ? "video"
            : clipType === "text" || clipType === "texts"
              ? "text"
              : clipType === "effect" || clipType === "effects"
                ? "effects"
                : clipType
      ) as keyof typeof current.tracks;
      const list = [...(((current.tracks as any)[key] as any[]) || [])];
      const idx = list.findIndex((c) => c.id === clipId);
      if (idx < 0) return;

      list[idx] = applyTransformUpdateToClip(
        list[idx],
        clipType,
        transform,
        current.currentTime || 0,
      );

      const updated = {
        ...current,
        tracks: { ...current.tracks, [key]: list } as any,
      };

      if (isFinal) {
        updateProjectWithHistory(updated);
      } else {
        projectRef.current = updated;
        setProject(updated);
      }
    },
    [projectRef, setProject, updateProjectWithHistory],
  );

  // Rotate clip 90 degrees
  const handleRotateClip = useCallback(() => {
    if (!project || !selectedClip) return;
    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "photo" || selectedClipType === "video"
          ? "video"
          : selectedClipType === "text" || selectedClipType === "texts"
            ? "text"
            : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...(((project.tracks as any)[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const currentT = getInterpolatedTransform(
      list[idx],
      project.currentTime || 0,
      selectedClipType,
    );
    const newRotation = (currentT.rotation + 90) % 360;

    list[idx] = applyTransformUpdateToClip(
      list[idx],
      selectedClipType,
      {
        ...currentT,
        rotation: newRotation,
      },
      project.currentTime || 0,
    );

    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, [key]: list },
    });
  }, [project, selectedClip, selectedClipId, selectedClipType, updateProjectWithHistory]);

  // Toggle Reverse
  const handleToggleReverse = useCallback(() => {
    if (!project || !selectedClip || selectedClipType !== "video") return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      videoClips[idx] = {
        ...videoClips[idx],
        reverse: !videoClips[idx].reverse,
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    }
  }, [project, selectedClip, selectedClipType, selectedClipId, updateProjectWithHistory]);

  // Update clip crop
  const handleUpdateClipCrop = useCallback(
    (clipId: string, newCrop: CustomCrop, isFinal = true) => {
      const current = projectRef.current;
      if (!current) return;
      const videoClips = [...(current.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        videoClips[idx] = {
          ...videoClips[idx],
          crop: newCrop,
          transform: {
            ...(videoClips[idx].transform || {}),
            crop: newCrop,
          },
        };
        const updatedProject = {
          ...current,
          tracks: { ...current.tracks, video: videoClips },
        };
        if (isFinal) {
          updateProjectWithHistory(updatedProject);
        } else {
          projectRef.current = updatedProject;
          setProject(updatedProject);
        }
      }
    },
    [projectRef, setProject, updateProjectWithHistory],
  );

  // Draggable Trim Clip
  const handleTrimClip = useCallback(
    (
      clipId: string,
      updates: {
        startTime?: number;
        duration?: number;
        trimIn?: number;
        trimOut?: number;
        trackIndex?: number;
      },
      isFinal: boolean = true,
    ) => {
      if (!project) return;
      const tracks = {
        video: project.tracks.video ? [...project.tracks.video] : [],
        audio: project.tracks.audio ? [...project.tracks.audio] : [],
        text: project.tracks.text ? [...project.tracks.text] : [],
        stickers: project.tracks.stickers ? [...project.tracks.stickers] : [],
        effects: project.tracks.effects ? [...project.tracks.effects] : [],
        filters: project.tracks.filters ? [...project.tracks.filters] : [],
      };

      let found = false;
      if (tracks.video) {
        const idx = tracks.video.findIndex((c) => c.id === clipId);
        if (idx >= 0) {
          const clampedUpdates = clampClipTrimUpdates(
            tracks.video[idx],
            updates,
            tracks.video[idx].type,
          );
          tracks.video[idx] = { ...tracks.video[idx], ...clampedUpdates };
          found = true;
        }
      }
      if (!found && tracks.audio) {
        const idx = tracks.audio.findIndex((c) => c.id === clipId);
        if (idx >= 0) {
          const clampedUpdates = clampClipTrimUpdates(
            tracks.audio[idx],
            updates,
            "audio",
          );
          tracks.audio[idx] = { ...tracks.audio[idx], ...clampedUpdates };
          found = true;
        }
      }
      if (!found && tracks.text) {
        const idx = tracks.text.findIndex((c) => c.id === clipId);
        if (idx >= 0) {
          tracks.text[idx] = { ...tracks.text[idx], ...updates };
          found = true;
        }
      }
      if (!found && tracks.stickers) {
        const idx = tracks.stickers.findIndex((c) => c.id === clipId);
        if (idx >= 0) {
          tracks.stickers[idx] = { ...tracks.stickers[idx], ...updates };
          found = true;
        }
      }
      if (!found && tracks.effects) {
        const idx = tracks.effects.findIndex((c) => c.id === clipId);
        if (idx >= 0) {
          tracks.effects[idx] = { ...tracks.effects[idx], ...updates };
          found = true;
        }
      }

      const updated = { ...project, tracks };
      if (isFinal) {
        updateProjectWithHistory(updated);
      } else {
        setProject(updated);
      }
    },
    [project, setProject, updateProjectWithHistory],
  );

  // Draggable Move Clip
  const handleMoveClip = useCallback(
    (
      clipId: string,
      trackType: "video" | "audio" | "text" | "sticker" | "effects",
      newStartTime: number,
      newTrackIndex?: number,
    ) => {
      if (!project) return;
      const tracks = {
        video: project.tracks.video ? [...project.tracks.video] : [],
        audio: project.tracks.audio ? [...project.tracks.audio] : [],
        text: project.tracks.text ? [...project.tracks.text] : [],
        stickers: project.tracks.stickers ? [...project.tracks.stickers] : [],
        effects: project.tracks.effects ? [...project.tracks.effects] : [],
        filters: project.tracks.filters ? [...project.tracks.filters] : [],
      };

      const updateItem = (c: any) =>
        c.id === clipId
          ? {
              ...c,
              startTime: newStartTime,
              ...(typeof newTrackIndex === "number"
                ? { trackIndex: newTrackIndex }
                : {}),
            }
          : c;

      if (trackType === "video" && tracks.video) {
        tracks.video = tracks.video.map(updateItem);
      } else if (trackType === "audio" && tracks.audio) {
        tracks.audio = tracks.audio.map(updateItem);
      } else if (trackType === "text" && tracks.text) {
        tracks.text = tracks.text.map(updateItem);
      } else if (trackType === "sticker" && tracks.stickers) {
        tracks.stickers = tracks.stickers.map(updateItem);
      } else if (trackType === "effects" && tracks.effects) {
        tracks.effects = tracks.effects.map(updateItem);
      }

      updateProjectWithHistory({ ...project, tracks });
    },
    [project, updateProjectWithHistory],
  );

  return {
    handleUpdateClipTransform,
    handleUpdateClipCrop,
    handleRotateClip,
    handleToggleReverse,
    handleTrimClip,
    handleMoveClip,
  };
}
