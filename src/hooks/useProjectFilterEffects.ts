import { useCallback, useState, useRef } from "react";
import {
  FastArtProject,
  AudioClip,
  CutoutConfig,
  MotionTrackConfig,
  CustomLutConfig,
  ClipTransform,
  AspectRatio,
  MaskConfig,
} from "../types/project";
import { getMediaDuration } from "../utils/mediaDuration";
import { soundEngine } from "../utils/audioEngine";

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Processing Edit...");
  const processingTimer = useRef<any>(null);

  const startProcessing = useCallback((msg: string, durationMs: number = 750) => {
    setProcessingMessage(msg);
    setIsProcessing(true);
    if (processingTimer.current) clearTimeout(processingTimer.current);
    processingTimer.current = setTimeout(() => {
      setIsProcessing(false);
    }, durationMs);
  }, []);

  // Apply color filter or custom 3D LUT
  const handleApplyFilter = useCallback(
    (filterId: string, customLut?: CustomLutConfig) => {
      startProcessing("Applying Color Grade & LUT...");
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
      startProcessing("Applying Cutout & Color...");
      if (!project || !selectedClip) return;
      const videoClips = [...(project.tracks.video || [])];
      let idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx === -1 && selectedClip?.id) {
        idx = videoClips.findIndex((c) => c.id === selectedClip.id);
      }
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
      startProcessing("Tracking Motion Vectors...");
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

  // Apply speed change with accurate duration adjustment, track-0 ripple, and audio track support
  const handleApplySpeed = useCallback(
    (
      speedVal: number,
      curve?: any,
      smoothSlowMo?: "none" | "blend" | "optical_flow",
    ) => {
      startProcessing("Calculating Speed & Duration...");
      const current = projectRef.current || project;
      if (!current || !selectedClipId) return;

      // Determine effective speed multiplier (from curve points or direct speedVal)
      let effectiveSpeedVal = Math.max(0.1, Math.min(16, speedVal || 1.0));
      if (curve) {
        const points = Array.isArray(curve)
          ? curve
          : Array.isArray(curve.points)
            ? curve.points
            : [];
        if (points.length > 0) {
          const sum = points.reduce((acc: number, pt: any) => {
            const s =
              typeof pt === "object" && pt && "s" in pt
                ? pt.s
                : typeof pt === "number"
                  ? pt
                  : 1;
            return acc + s;
          }, 0);
          effectiveSpeedVal = Math.max(
            0.1,
            Math.min(16, Number((sum / points.length).toFixed(2))),
          );
        }
      }

      // Check video tracks
      const videoClips = [...(current.tracks.video || [])];
      const vIdx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (vIdx >= 0) {
        const clip = videoClips[vIdx];
        const mediaDur = getMediaDuration(clip, clip.type);
        const oldSpeed = Math.max(0.1, clip.speed || 1.0);
        const trimIn = Math.max(0, clip.trimIn || 0);

        // Calculate source media duration that was selected
        let sourceDuration = 0;
        if (typeof clip.trimOut === "number" && clip.trimOut > trimIn) {
          sourceDuration = clip.trimOut - trimIn;
        } else if (mediaDur && mediaDur > trimIn) {
          sourceDuration = mediaDur - trimIn;
        } else {
          sourceDuration = Math.max(0.1, clip.duration * oldSpeed);
        }

        const newDuration = Math.max(
          0.05,
          Number((sourceDuration / effectiveSpeedVal).toFixed(3)),
        );
        const newTrimOut = Number((trimIn + sourceDuration).toFixed(3));

        videoClips[vIdx] = {
          ...clip,
          speed: effectiveSpeedVal,
          speedCurve: curve || null,
          smoothSlowMo: smoothSlowMo || "none",
          duration: newDuration,
          trimOut: newTrimOut,
        };

        // If on primary video track (track 0), ripple-align subsequent clips
        if (!clip.trackIndex || clip.trackIndex === 0) {
          let t = 0;
          videoClips.forEach((c) => {
            if (!c.trackIndex || c.trackIndex === 0) {
              c.startTime = Number(t.toFixed(3));
              t += c.duration;
            }
          });
        }

        soundEngine.playSfx("click");
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, video: videoClips },
        });
        return;
      }

      // Check audio tracks
      const audioClips = [...(current.tracks.audio || [])];
      const aIdx = audioClips.findIndex((c) => c.id === selectedClipId);
      if (aIdx >= 0) {
        const clip = audioClips[aIdx];
        const mediaDur = getMediaDuration(clip, "audio");
        const oldSpeed = Math.max(0.1, clip.speed || 1.0);
        const trimIn = Math.max(0, clip.trimIn || 0);

        let sourceDuration = 0;
        if (typeof clip.trimOut === "number" && clip.trimOut > trimIn) {
          sourceDuration = clip.trimOut - trimIn;
        } else if (mediaDur && mediaDur > trimIn) {
          sourceDuration = mediaDur - trimIn;
        } else {
          sourceDuration = Math.max(0.1, clip.duration * oldSpeed);
        }

        const newDuration = Math.max(
          0.05,
          Number((sourceDuration / effectiveSpeedVal).toFixed(3)),
        );
        const newTrimOut = Number((trimIn + sourceDuration).toFixed(3));

        audioClips[aIdx] = {
          ...clip,
          speed: effectiveSpeedVal,
          duration: newDuration,
          trimOut: newTrimOut,
        };

        soundEngine.playSfx("click");
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, audio: audioClips },
        });
        return;
      }
    },
    [project, projectRef, selectedClipId, updateProjectWithHistory],
  );

  // Apply Volume, Fades & AI Denoise to video or audio clips
  const handleApplyVolume = useCallback(
    (vol: number, fadeIn: number, fadeOut: number, denoise?: boolean) => {
      startProcessing(denoise ? "Applying AI Denoise DSP..." : "Updating Audio Volume...");
      const current = projectRef.current || project;
      if (!current || !selectedClipId) return;

      // Check video tracks
      const videoClips = [...(current.tracks.video || [])];
      const vIdx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (vIdx >= 0) {
        videoClips[vIdx] = {
          ...videoClips[vIdx],
          volume: vol,
          fadeIn,
          fadeOut,
          ...(denoise !== undefined ? { denoise } : {}),
        };
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, video: videoClips },
        });
        return;
      }

      // Check audio tracks
      const audioClips = [...(current.tracks.audio || [])];
      const aIdx = audioClips.findIndex((c) => c.id === selectedClipId);
      if (aIdx >= 0) {
        audioClips[aIdx] = {
          ...audioClips[aIdx],
          volume: vol,
          fadeIn,
          fadeOut,
          ...(denoise !== undefined ? { denoise } : {}),
        };
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, audio: audioClips },
        });
        return;
      }
    },
    [project, projectRef, selectedClipId, updateProjectWithHistory],
  );

  // Extract Audio from Video Clip to Independent Audio Track
  const handleExtractAudioFromVideo = useCallback(() => {
    const current = projectRef.current;
    if (!current || !selectedClipId) return;
    const videoClips = current.tracks.video || [];
    const targetVideo = videoClips.find((v) => v.id === selectedClipId);
    if (!targetVideo) return;

    const newAudioClip: AudioClip = {
      id: `clip-a-ext-${Date.now()}`,
      title: `${targetVideo.title || "Video"} (Audio)`,
      artist: "Extracted Audio",
      duration: targetVideo.duration,
      startTime: targetVideo.startTime,
      trimIn: targetVideo.trimIn || 0,
      trimOut: targetVideo.trimOut || targetVideo.duration,
      mediaDuration: targetVideo.mediaDuration || targetVideo.duration,
      volume: targetVideo.volume ?? 1.0,
      fadeIn: targetVideo.fadeIn ?? 0,
      fadeOut: targetVideo.fadeOut ?? 0,
      denoise: targetVideo.denoise,
      url: targetVideo.url,
      trackIndex: 1,
    };

    // Mute the video clip
    const updatedVideos = videoClips.map((v) =>
      v.id === selectedClipId ? { ...v, volume: 0 } : v
    );

    const updatedAudio = [...(current.tracks.audio || []), newAudioClip];

    soundEngine.playSfx("split");
    updateProjectWithHistory({
      ...current,
      tracks: {
        ...current.tracks,
        video: updatedVideos,
        audio: updatedAudio,
      },
    });
    setActiveModal(null);
  }, [projectRef, selectedClipId, updateProjectWithHistory, setActiveModal]);

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
    (preset: {
      hdr?: boolean;
      sharpness?: number;
      colorBoost?: number;
      denoise?: boolean;
      filterLut: string;
      skinSmoothing?: number;
      faceRadiance?: number;
    }) => {
      const current = projectRef.current;
      if (!current) return;
      const boostVal = (preset.colorBoost ?? 80) / 100;
      const sharpVal = (preset.sharpness ?? 75) / 100;
      const smoothVal = (preset.skinSmoothing ?? 0) / 100;
      const radianceVal = (preset.faceRadiance ?? 0) / 100;

      const sat = 1.0 + boostVal * 0.55;
      const cont = 1.0 + sharpVal * 0.3 + (preset.hdr ? 0.15 : 0);
      const bright = (preset.hdr ? 1.05 : 1.0) + radianceVal * 0.1;
      const blurDrop = smoothVal > 0.25 ? ` drop-shadow(0px 0px ${(smoothVal * 2.5).toFixed(1)}px rgba(255,255,255,0.18))` : "";
      const cssFilter = `contrast(${cont.toFixed(2)}) saturate(${sat.toFixed(2)}) brightness(${bright.toFixed(2)})${blurDrop}`;

      const videoClips = (current.tracks.video || []).map((c) => {
        if (!selectedClipId || c.id === selectedClipId) {
          return {
            ...c,
            filter: preset.filterLut,
            customLut: {
              id: "ai_enhance",
              name: "AI Enhanced",
              cssFilter,
            },
          };
        }
        return c;
      });
      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, video: videoClips },
      });
    },
    [projectRef, selectedClipId, updateProjectWithHistory],
  );

  return {
    handleApplyFilter,
    handleApplyCutout,
    handleApplyMotionTracking,
    handleApplyTransition,
    handleApplySpeed,
    handleApplyVolume,
    handleExtractAudioFromVideo,
    handleApplyTransform,
    handleApplyEnhance,
    isProcessing,
    processingMessage,
    startProcessing,
  };
}
