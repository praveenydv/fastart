import { useCallback } from "react";
import { Alert } from "react-native";
import { FastArtProject } from "../types/project";
import { soundEngine } from "../utils/audioEngine";
import { triggerHaptic } from "../utils/haptics";
import { deleteMedia } from "../utils/largeMediaStorage";
import { allocateClipPlacement } from "../utils/trackPlacement";
import { addNotification } from "../utils/storage";
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
}: UseProjectClipMutationsParams) {
  // Delegate transform, crop, rotate, reverse, trim, move operations
  const {
    handleUpdateClipTransform,
    handleUpdateClipCrop,
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
    updateProjectWithHistory,
  });

  // Split active clip at currentTime
  const handleSplitClip = useCallback(() => {
    if (!project || !selectedClipId) return;
    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
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

    const firstDuration = curTime - clipStart;
    const secondDuration = clipEnd - curTime;

    const firstClip = {
      ...clip,
      duration: Number(firstDuration.toFixed(3)),
      ...(clip.trimIn !== undefined
        ? { trimOut: Number(((clip.trimIn || 0) + firstDuration).toFixed(3)) }
        : {}),
    };

    const secondClip = {
      ...clip,
      id: `clip-${String(key)[0]}-${Date.now()}`,
      startTime: Number(curTime.toFixed(3)),
      duration: Number(secondDuration.toFixed(3)),
      ...(clip.trimIn !== undefined
        ? {
            trimIn: Number(((clip.trimIn || 0) + firstDuration).toFixed(3)),
            trimOut: clip.trimOut,
          }
        : {}),
    };

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
  }, [project, selectedClipId, selectedClipType, settings, currentTimeRef, setSelectedClipId, updateProjectWithHistory]);

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
        "text",
        "stickers",
        "effects",
      ];
      if (clipType) {
        const preferredKey = (
          clipType === "sticker" || clipType === "stickers"
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
              k === "stickers" ? "sticker" : k === "effects" ? "effects" : k;
            break;
          }
        }
      }

      let name = `${(clipType || "item").charAt(0).toUpperCase() + (clipType || "item").slice(1)} Clip`;
      if (clip) {
        if (clipType === "text" && clip.text) {
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
      "text",
      "stickers",
      "effects",
    ];
    const preferredKey = (
      clipType === "sticker" || clipType === "stickers"
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
    deleteMedia(clipId).catch(() => {});
  }, [project, clipToDelete, settings, setSelectedClipId, setSelectedClipType, updateProjectWithHistory, setClipToDelete]);

  // Duplicate selected clip with non-overlapping multi-track placement
  const handleDuplicateClip = useCallback(
    (targetId?: string, targetType?: string) => {
      if (!project) return;
      const clipId = targetId || selectedClipId;
      const clipType = targetType || selectedClipType;
      if (!clipId) return;

      const key = (
        clipType === "sticker" || clipType === "stickers"
          ? "stickers"
          : clipType === "effect" || clipType === "effects"
            ? "effects"
            : clipType
      ) as keyof typeof project.tracks;
      const list = [...(((project.tracks as any)[key] as any[]) || [])];
      const idx = list.findIndex((c) => c.id === clipId);
      if (idx === -1) return;

      const original = list[idx];
      const dur = original.duration || 3.0;
      const origTrack =
        typeof original.trackIndex === "number"
          ? original.trackIndex
          : clipType === "audio"
            ? 1
            : clipType === "text"
              ? 2
              : clipType === "sticker" || clipType === "stickers"
                ? 3
                : clipType === "effects"
                  ? 4
                  : 0;

      const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id: `clip-${clipType[0]}-${Date.now()}`,
        position: original.position
          ? {
              x: Math.min(85, (original.position.x || 50) + 5),
              y: Math.min(85, (original.position.y || 50) + 5),
            }
          : undefined,
      };

      if (clipType === "video" && origTrack === 0) {
        clone.startTime = original.startTime + original.duration;
        clone.trackIndex = 0;
        list.splice(idx + 1, 0, clone);
        let t = 0;
        list.forEach((c) => {
          c.startTime = t;
          t += c.duration;
        });
      } else {
        const placement = allocateClipPlacement(
          project,
          original.startTime,
          dur,
          origTrack + 1,
          original.id,
        );
        if (placement) {
          clone.startTime = placement.startTime;
          clone.trackIndex = placement.trackIndex;
          addNotification({
            title: "Clip Duplicated",
            message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
            icon: "copy-outline",
          });
        } else {
          clone.startTime = original.startTime + original.duration;
          clone.trackIndex = origTrack;
        }
        list.push(clone);
      }

      const updated = {
        ...project,
        tracks: {
          ...project.tracks,
          [key]: list,
        },
      };
      setSelectedClipId(clone.id);
      setSelectedClipType(clipType);
      updateProjectWithHistory(updated);
    },
    [project, selectedClipId, selectedClipType, setSelectedClipId, setSelectedClipType, updateProjectWithHistory],
  );

  return {
    handleSplitClip,
    handleDeleteClip,
    handleConfirmDeleteClip,
    handleDuplicateClip,
    handleRotateClip,
    handleToggleReverse,
    handleUpdateClipTransform,
    handleUpdateClipCrop,
    handleTrimClip,
    handleMoveClip,
  };
}
