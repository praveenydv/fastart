import { useCallback } from "react";
import { FastArtProject, CustomCrop, MaskConfig } from "../types/project";
import { clampClipTrimUpdates } from "../utils/mediaDuration";
import { requestMediaThumbnail } from "../utils/mediaThumbnailGenerator";
import {
  applyTransformUpdateToClip,
  applyMaskUpdateToClip,
  getInterpolatedTransform,
} from "../utils/keyframeEngine";

interface UseClipTransformOperationsParams {
  project: FastArtProject | null;
  projectRef: React.MutableRefObject<FastArtProject | null>;
  setProject: React.Dispatch<React.SetStateAction<FastArtProject | null>>;
  selectedClip: any;
  selectedClipId: string | null;
  selectedClipType: string;
  currentTimeRef?: React.MutableRefObject<number>;
  updateProjectWithHistory: (proj: any) => void;
  startProcessing?: (msg: string, durationMs?: number) => void;
}

export function useClipTransformOperations({
  project,
  projectRef,
  setProject,
  selectedClip,
  selectedClipId,
  selectedClipType,
  currentTimeRef,
  updateProjectWithHistory,
  startProcessing,
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
        clipType === "caption" || clipType === "captions"
          ? "captions"
          : clipType === "sticker" || clipType === "stickers"
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

      const activeTime = currentTimeRef?.current ?? current.currentTime ?? 0;
      list[idx] = applyTransformUpdateToClip(
        list[idx],
        clipType,
        transform,
        activeTime,
      );

      const updated = {
        ...current,
        tracks: { ...current.tracks, [key]: list } as any,
      };

      if (isFinal) {
        updateProjectWithHistory(updated);
      } else {
        projectRef.current = updated;
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
      const willReverse = !videoClips[idx].reverse;
      startProcessing?.(
        willReverse
          ? "Reversing Clip Video & Audio..."
          : "Restoring Normal Direction...",
        450,
      );
      videoClips[idx] = {
        ...videoClips[idx],
        reverse: willReverse,
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    }
  }, [project, selectedClip, selectedClipType, selectedClipId, updateProjectWithHistory, startProcessing]);

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
        }
      }
    },
    [projectRef, setProject, updateProjectWithHistory],
  );

  // Update clip mask
  const handleUpdateClipMask = useCallback(
    (
      clipId: string,
      newMask: MaskConfig,
      isFinal = true,
      timeOverride?: number,
    ) => {
      const current = projectRef.current;
      if (!current) return;
      const activeTime =
        typeof timeOverride === "number"
          ? timeOverride
          : (currentTimeRef?.current ?? current.currentTime ?? 0);
      const videoClips = [...(current.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        videoClips[idx] = applyMaskUpdateToClip(
          videoClips[idx],
          newMask,
          activeTime,
        );
        const updatedProject = {
          ...current,
          tracks: { ...current.tracks, video: videoClips },
        };
        if (isFinal) {
          updateProjectWithHistory(updatedProject);
        } else {
          projectRef.current = updatedProject;
        }
      }
    },
    [projectRef, setProject, updateProjectWithHistory, currentTimeRef],
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
        captions: project.tracks.captions ? [...project.tracks.captions] : [],
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
          const oldTrimIn = tracks.video[idx].trimIn || 0;
          const newTrimIn =
            typeof clampedUpdates.trimIn === "number"
              ? clampedUpdates.trimIn
              : oldTrimIn;

          tracks.video[idx] = { ...tracks.video[idx], ...clampedUpdates };

          if (isFinal && Math.abs(newTrimIn - oldTrimIn) > 0.15) {
            tracks.video[idx].thumbnail = undefined;
            tracks.video[idx].thumbnailTrimIn = newTrimIn;
            requestMediaThumbnail(tracks.video[idx], true);
          }
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
      if (!found && tracks.captions) {
        const idx = tracks.captions.findIndex((c) => c.id === clipId);
        if (idx >= 0) {
          tracks.captions[idx] = { ...tracks.captions[idx], ...updates };
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

  // Draggable Move Clip with automatic track insertion and empty track cleanup
  const handleMoveClip = useCallback(
    (
      clipId: string,
      trackType: "video" | "audio" | "text" | "caption" | "sticker" | "effects",
      newStartTime: number,
      newTrackIndex?: number,
      isInsertNewTrack?: boolean,
    ) => {
      if (!project) return;
      const tracks = {
        video: project.tracks.video ? [...project.tracks.video] : [],
        audio: project.tracks.audio ? [...project.tracks.audio] : [],
        captions: project.tracks.captions ? [...project.tracks.captions] : [],
        text: project.tracks.text ? [...project.tracks.text] : [],
        stickers: project.tracks.stickers ? [...project.tracks.stickers] : [],
        effects: project.tracks.effects ? [...project.tracks.effects] : [],
        filters: project.tracks.filters ? [...project.tracks.filters] : [],
      };

      // 1. If inserting a new track in between, shift subsequent tracks down by 1
      if (isInsertNewTrack && typeof newTrackIndex === "number") {
        const shiftTrackDown = (c: any) => {
          if (c.id === clipId) return c;
          const curTrk = typeof c.trackIndex === "number" ? c.trackIndex : 0;
          if (curTrk >= newTrackIndex) {
            return { ...c, trackIndex: curTrk + 1 };
          }
          return c;
        };
        tracks.video = tracks.video.map(shiftTrackDown);
        tracks.audio = tracks.audio.map(shiftTrackDown);
        tracks.captions = tracks.captions.map(shiftTrackDown);
        tracks.text = tracks.text.map(shiftTrackDown);
        tracks.stickers = tracks.stickers.map(shiftTrackDown);
        tracks.effects = tracks.effects.map(shiftTrackDown);
      }

      // 2. Update the target clip's start time and track index
      const updateItem = (c: any) =>
        c.id === clipId
          ? {
              ...c,
              startTime: Math.max(0, Number(newStartTime.toFixed(3))),
              ...(typeof newTrackIndex === "number"
                ? { trackIndex: newTrackIndex }
                : {}),
            }
          : c;

      const typeStr = String(trackType || "").toLowerCase();
      if ((typeStr === "video" || typeStr === "photo") && tracks.video) {
        tracks.video = tracks.video.map(updateItem);
      } else if (typeStr === "audio" && tracks.audio) {
        tracks.audio = tracks.audio.map(updateItem);
      } else if ((typeStr === "caption" || typeStr === "captions") && tracks.captions) {
        tracks.captions = tracks.captions.map(updateItem);
      } else if (typeStr === "text" && tracks.text) {
        tracks.text = tracks.text.map(updateItem);
      } else if ((typeStr === "sticker" || typeStr === "stickers") && tracks.stickers) {
        tracks.stickers = tracks.stickers.map(updateItem);
      } else if ((typeStr === "effect" || typeStr === "effects") && tracks.effects) {
        tracks.effects = tracks.effects.map(updateItem);
      } else {
        // Fallback across all tracks if type was ambiguous
        tracks.video = tracks.video.map(updateItem);
        tracks.audio = tracks.audio.map(updateItem);
        tracks.captions = tracks.captions.map(updateItem);
        tracks.text = tracks.text.map(updateItem);
        tracks.stickers = tracks.stickers.map(updateItem);
        tracks.effects = tracks.effects.map(updateItem);
      }

      // Do NOT auto-remove or compact empty tracks on clip leave (keeps tracks stable)
      updateProjectWithHistory({ ...project, tracks });
    },
    [project, updateProjectWithHistory],
  );

  return {
    handleUpdateClipTransform,
    handleUpdateClipCrop,
    handleUpdateClipMask,
    handleRotateClip,
    handleToggleReverse,
    handleTrimClip,
    handleMoveClip,
  };
    }
