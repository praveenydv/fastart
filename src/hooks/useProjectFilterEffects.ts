import { useCallback } from "react";
import {
  FastArtProject,
  CutoutConfig,
  MotionTrackConfig,
  CustomLutConfig,
  ClipTransform,
  AspectRatio,
  MaskConfig,
} from "../types/project";
import { getMediaDuration } from "../utils/mediaDuration";

interface UseProjectFilterEffectsParams {
  project: FastArtProject | null;
  projectRef: React.MutableRefObject<FastArtProject | null>;
  selectedClip: any;
  selectedClipId: string | null;
  selectedClipType: string;
  transitionTargetClipId: string | null;
  updateProjectWithHistory: (proj: any) => void;
  setActiveModal: (modal: string | null) => void;
}

export function useProjectFilterEffects({
  project,
  projectRef,
  selectedClip,
  selectedClipId,
  selectedClipType,
  transitionTargetClipId,
  updateProjectWithHistory,
  setActiveModal,
}: UseProjectFilterEffectsParams) {
  // Apply color filter or custom 3D LUT
  const handleApplyFilter = useCallback(
    (filterId: string, customLut?: CustomLutConfig) => {
      if (!project) return;
      if (selectedClip && selectedClipType === "video") {
        const videoClips = [...(project.tracks.video || [])];
        const idx = videoClips.findIndex((c) => c.id === selectedClipId);
        if (idx >= 0) {
          videoClips[idx] = {
            ...videoClips[idx],
            filter: filterId,
            customLut: customLut,
          };
          updateProjectWithHistory({
            ...project,
            tracks: { ...project.tracks, video: videoClips },
          });
        }
      }
      setActiveModal(null);
    },
    [project, selectedClip, selectedClipType, selectedClipId, updateProjectWithHistory, setActiveModal],
  );

  // Apply Cutout
  const handleApplyCutout = useCallback(
    (cutoutConfig: CutoutConfig) => {
      if (!project || !selectedClip) return;
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx >= 0) {
        videoClips[idx] = {
          ...videoClips[idx],
          cutout: cutoutConfig,
          transform: {
            ...(videoClips[idx].transform || {}),
            cutout: cutoutConfig,
          },
        };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: videoClips },
        });
      }
    },
    [project, selectedClip, selectedClipId, updateProjectWithHistory],
  );

  // Apply AI Motion Tracking
  const handleApplyMotionTracking = useCallback(
    (motionConfig: MotionTrackConfig) => {
      if (!project || !selectedClip) return;
      if (selectedClipType === "text") {
        const textClips = [...(project.tracks.text || [])];
        const idx = textClips.findIndex((t) => t.id === selectedClipId);
        if (idx >= 0) {
          textClips[idx] = { ...textClips[idx], motionTrack: motionConfig };
          updateProjectWithHistory({
            ...project,
            tracks: { ...project.tracks, text: textClips },
          });
        }
      } else if (
        selectedClipType === "stickers" ||
        selectedClipType === "sticker"
      ) {
        const stickerClips = [...(project.tracks.stickers || [])];
        const idx = stickerClips.findIndex((s) => s.id === selectedClipId);
        if (idx >= 0) {
          stickerClips[idx] = { ...stickerClips[idx], motionTrack: motionConfig };
          updateProjectWithHistory({
            ...project,
            tracks: { ...project.tracks, stickers: stickerClips },
          });
        }
      } else if (selectedClipType === "video") {
        const videoClips = [...(project.tracks.video || [])];
        const idx = videoClips.findIndex((v) => v.id === selectedClipId);
        if (idx >= 0) {
          videoClips[idx] = { ...videoClips[idx], motionTrack: motionConfig };
          updateProjectWithHistory({
            ...project,
            tracks: { ...project.tracks, video: videoClips },
          });
        }
      }
    },
    [project, selectedClip, selectedClipType, selectedClipId, updateProjectWithHistory],
  );

  // Apply transition
  const handleApplyTransition = useCallback(
    (trans: any) => {
      if (!project || !transitionTargetClipId) return;
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === transitionTargetClipId);
      if (idx >= 0) {
        videoClips[idx] = { ...videoClips[idx], transition: trans };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: videoClips },
        });
      }
    },
    [project, transitionTargetClipId, updateProjectWithHistory],
  );

  // Apply speed change
  const handleApplySpeed = useCallback(
    (
      speedVal: number,
      curve?: any,
      smoothSlowMo?: "none" | "blend" | "optical_flow",
    ) => {
      if (!project || !selectedClip) return;
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx >= 0) {
        const clip = videoClips[idx];
        const mediaDur = getMediaDuration(clip, clip.type);
        let newDuration = clip.duration;
        let newTrimOut = clip.trimOut;

        if (mediaDur && mediaDur > 0 && clip.type === "video") {
          const currentTrimIn = Math.max(0, clip.trimIn || 0);
          const maxTimelineDur = (mediaDur - currentTrimIn) / speedVal;
          if (newDuration > maxTimelineDur) {
            newDuration = Number(maxTimelineDur.toFixed(3));
            newTrimOut = mediaDur;
          }
        }

        videoClips[idx] = {
          ...clip,
          speed: speedVal,
          speedCurve: curve,
          smoothSlowMo: smoothSlowMo || "none",
          duration: newDuration,
          trimOut: newTrimOut,
        };

        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: videoClips },
        });
      }
    },
    [project, selectedClip, selectedClipId, updateProjectWithHistory],
  );

  // Apply Volume & Dynamics
  const handleApplyVolume = useCallback(
    (vol: number, fadeIn: number, fadeOut: number) => {
      if (!project || !selectedClip) return;
      const list = [
        ...(((project.tracks as any)[selectedClipType] as any[]) || []),
      ];
      const idx = list.findIndex((c: any) => c.id === selectedClipId);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          volume: vol,
          fadeIn,
          fadeOut,
        };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, [selectedClipType]: list } as any,
        });
      }
    },
    [project, selectedClip, selectedClipType, selectedClipId, updateProjectWithHistory],
  );

  // Apply Transform, Mask & Canvas Ratio
  const handleApplyTransform = useCallback(
    (
      t: ClipTransform,
      newAspectRatio?: AspectRatio,
      newMask?: MaskConfig,
    ) => {
      const current = projectRef.current;
      if (!current) return;
      let updated: any = { ...current };
      if (newAspectRatio && newAspectRatio !== current.aspectRatio) {
        updated.aspectRatio = newAspectRatio;
      }
      if (selectedClip && selectedClipType === "video") {
        const videoClips = [...(current.tracks.video || [])];
        const idx = videoClips.findIndex((c) => c.id === selectedClipId);
        if (idx >= 0) {
          const finalMask =
            newMask !== undefined
              ? newMask
              : t.mask !== undefined
                ? t.mask
                : videoClips[idx].mask;
          const preservedCrop = videoClips[idx].crop;
          videoClips[idx] = {
            ...videoClips[idx],
            transform: {
              ...(videoClips[idx].transform || {}),
              ...t,
              mask: finalMask,
              crop: preservedCrop,
            },
            mask: finalMask,
            crop: preservedCrop,
          };
          updated.tracks = { ...current.tracks, video: videoClips };
        }
      }
      updateProjectWithHistory(updated);
    },
    [projectRef, selectedClip, selectedClipType, selectedClipId, updateProjectWithHistory],
  );

  // Apply AI Enhance
  const handleApplyEnhance = useCallback(
    (preset: { filterLut: string }) => {
      if (!project) return;
      const videoClips = (project.tracks.video || []).map((c) => {
        if (!selectedClipId || c.id === selectedClipId) {
          return { ...c, filter: preset.filterLut };
        }
        return c;
      });
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    },
    [project, selectedClipId, updateProjectWithHistory],
  );

  return {
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
