import { useCallback, useState, useRef } from "react";
import { Alert } from "react-native";
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

import {
  extractRealMediaAudioPeaks,
  mediaHasAudioTrack,
  setCachedMediaPeaks,
  getMediaAudioDuration,
} from "../utils/mediaAudioDetector";
import { allocateClipPlacement, allocateNewTrackForClip } from "../utils/trackPlacement";

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

  const startProcessing = useCallback((msg: string, durationMs: number = 650) => {
    setProcessingMessage(msg);
    setIsProcessing(true);
    if (processingTimer.current) clearTimeout(processingTimer.current);
    processingTimer.current = setTimeout(() => {
      setIsProcessing(false);
    }, durationMs);
  }, []);

  const withProcessing = useCallback(
    async <T,>(msg: string, task: () => Promise<T> | T, minDurationMs: number = 400): Promise<T> => {
      setProcessingMessage(msg);
      setIsProcessing(true);
      const start = Date.now();
      try {
        const result = await Promise.resolve(task());
        const elapsed = Date.now() - start;
        if (elapsed < minDurationMs) {
          await new Promise((r) => setTimeout(r, minDurationMs - elapsed));
        }
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  // Apply color filter or custom 3D LUT
  const handleApplyFilter = useCallback(
    (filterId: string, customLut?: CustomLutConfig) => {
      const current = projectRef.current || project;
      if (!current) return;
      const curTime = current.currentTime || 0;
      const targetId =
        (selectedClip && selectedClipType === "video" ? selectedClipId : null) ||
        current.tracks.video?.find(
          (c) => curTime >= c.startTime && curTime <= c.startTime + c.duration,
        )?.id ||
        current.tracks.video?.[0]?.id;

      if (targetId) {
        const videoClips = [...(current.tracks.video || [])];
        const idx = videoClips.findIndex((c) => c.id === targetId);
        if (idx >= 0) {
          videoClips[idx] = {
            ...videoClips[idx],
            filter: filterId,
            customLut: customLut,
          };
          updateProjectWithHistory({
            ...current,
            tracks: { ...current.tracks, video: videoClips },
          });
        }
      }
    },
    [project, projectRef, selectedClip, selectedClipType, selectedClipId, updateProjectWithHistory],
  );

  // Apply Cutout
  const handleApplyCutout = useCallback(
    (cutoutConfig: CutoutConfig) => {
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

  // Apply Volume & Fades to video or audio clips smoothly without flashing spinners
  const handleApplyVolume = useCallback(
    (vol: number, fadeIn: number, fadeOut: number, denoise?: boolean) => {
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

  // Dedicated 1-tap AI Noise Reduction toggle
  const handleToggleDenoise = useCallback(() => {
    const current = projectRef.current || project;
    if (!current || !selectedClipId) return;

    // Check audio tracks first
    const audioClips = [...(current.tracks.audio || [])];
    const aIdx = audioClips.findIndex((c) => c.id === selectedClipId);
    if (aIdx >= 0) {
      const nextDenoise = !audioClips[aIdx].denoise;
      audioClips[aIdx] = {
        ...audioClips[aIdx],
        denoise: nextDenoise,
      };
      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, audio: audioClips },
      });
      soundEngine.playSfx(nextDenoise ? "pop" : "click");
      return nextDenoise;
    }

    // Check video tracks
    const videoClips = [...(current.tracks.video || [])];
    const vIdx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (vIdx >= 0) {
      if (!mediaHasAudioTrack(videoClips[vIdx])) {
        Alert.alert(
          "No Audio Track",
          "Cannot apply AI Noise Reduction to a video without an audio track."
        );
        return false;
      }
      const nextDenoise = !videoClips[vIdx].denoise;
      videoClips[vIdx] = {
        ...videoClips[vIdx],
        denoise: nextDenoise,
      };
      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, video: videoClips },
      });
      soundEngine.playSfx(nextDenoise ? "pop" : "click");
      return nextDenoise;
    }
  }, [project, projectRef, selectedClipId, updateProjectWithHistory]);

  // Extract Audio from Video Clip to Independent Audio Track
  const handleExtractAudioFromVideo = useCallback(async () => {
    const current = projectRef.current;
    if (!current || !selectedClipId) return;
    const videoClips = current.tracks.video || [];
    const targetVideo = videoClips.find((v) => v.id === selectedClipId);
    if (!targetVideo) return;

    if (!mediaHasAudioTrack(targetVideo)) {
      Alert.alert(
        "No Audio Track",
        "Cannot extract audio from a silent video or photo."
      );
      return;
    }

    await withProcessing("Extracting Audio Track...", async () => {
      const speed = Math.max(0.1, targetVideo.speed || 1.0);
      const trimIn = Math.max(0, targetVideo.trimIn || 0);
      const trimOut =
        typeof targetVideo.trimOut === "number" && targetVideo.trimOut > trimIn
          ? targetVideo.trimOut
          : Number((trimIn + targetVideo.duration * speed).toFixed(3));
      const mediaDuration =
        getMediaDuration(targetVideo, targetVideo.type) ||
        targetVideo.mediaDuration ||
        (targetVideo.url ? getMediaAudioDuration(targetVideo.url) : null) ||
        Math.max(0.1, trimIn + targetVideo.duration * speed);

      // Allocate a brand-new track for extracted audio
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        current,
        targetVideo.startTime,
      );

      const existingPeaks = targetVideo.peaks;
      const newAudioClipId = `clip-a-ext-${Date.now()}`;
      const newAudioClip: AudioClip = {
        id: newAudioClipId,
        title: `${targetVideo.title || "Video"} (Audio)`,
        artist: "Extracted Audio",
        duration: targetVideo.duration,
        startTime: targetVideo.startTime,
        trimIn,
        trimOut,
        mediaDuration,
        speed,
        speedCurve: targetVideo.speedCurve,
        volume:
          targetVideo.volume !== undefined && targetVideo.volume > 0
            ? targetVideo.volume
            : 1.0,
        fadeIn: targetVideo.fadeIn ?? 0,
        fadeOut: targetVideo.fadeOut ?? 0,
        denoise: targetVideo.denoise,
        url: targetVideo.url,
        trackIndex: newTrackIndex,
        peaks: existingPeaks ? [...existingPeaks] : undefined,
      };

      if (existingPeaks && existingPeaks.length > 0) {
        setCachedMediaPeaks(newAudioClipId, existingPeaks, mediaDuration);
      }

      // Mute the video clip
      const updatedVideos = videoClips.map((v) =>
        v.id === selectedClipId ? { ...v, volume: 0 } : v,
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

      if (targetVideo.url) {
        extractRealMediaAudioPeaks(targetVideo.url, newAudioClip.id);
      }
      setActiveModal(null);
    });
  }, [projectRef, selectedClipId, updateProjectWithHistory, setActiveModal, withProcessing]);

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
          const finalCrop =
            t.crop !== undefined
              ? t.crop
              : videoClips[idx].crop;
          videoClips[idx] = {
            ...videoClips[idx],
            transform: {
              ...(videoClips[idx].transform || {}),
              ...t,
              mask: finalMask,
              crop: finalCrop,
            },
            mask: finalMask,
            crop: finalCrop,
          };
          updated.tracks = { ...current.tracks, video: videoClips };
        }
      }
      updateProjectWithHistory(updated);
    },
    [projectRef, selectedClip, selectedClipType, selectedClipId, updateProjectWithHistory],
  );

  // Apply AI Enhance (Beauty, Clarity & HDR)
  const handleApplyEnhance = useCallback(
    (preset: {
      hdr?: boolean;
      sharpness?: number;
      colorBoost?: number;
      skinSmoothing?: number;
      faceRadiance?: number;
      filterLut?: string;
    }) => {
      const current = projectRef.current || project;
      if (!current) return;
      const boostVal = (preset.colorBoost ?? 0) / 100;
      const sharpVal = (preset.sharpness ?? 0) / 100;
      const smoothVal = (preset.skinSmoothing ?? 0) / 100;
      const radianceVal = (preset.faceRadiance ?? 0) / 100;

      const sat = 1.0 + boostVal * 0.55;
      const cont = 1.0 + sharpVal * 0.3 + (preset.hdr ? 0.15 : 0);
      const bright = (preset.hdr ? 1.05 : 1.0) + radianceVal * 0.15;
      const blurDrop =
        smoothVal > 0.15
          ? ` drop-shadow(0px 0px ${(smoothVal * 2.5).toFixed(1)}px rgba(255,255,255,0.18))`
          : "";
      const isZero =
        !preset.hdr &&
        (preset.colorBoost ?? 0) === 0 &&
        (preset.sharpness ?? 0) === 0 &&
        (preset.skinSmoothing ?? 0) === 0 &&
        (preset.faceRadiance ?? 0) === 0;

      const cssFilter = isZero
        ? ""
        : `contrast(${cont.toFixed(2)}) saturate(${sat.toFixed(2)}) brightness(${bright.toFixed(2)})${blurDrop}`;

      const videoClips = (current.tracks.video || []).map((c) => {
        if (!selectedClipId || c.id === selectedClipId) {
          return {
            ...c,
            ...(preset.filterLut ? { filter: preset.filterLut } : {}),
            enhance: {
              hdr: preset.hdr ?? false,
              sharpness: preset.sharpness ?? 0,
              colorBoost: preset.colorBoost ?? 0,
              skinSmoothing: preset.skinSmoothing ?? 0,
              faceRadiance: preset.faceRadiance ?? 0,
            },
            customLut: cssFilter
              ? {
                  id: "ai_enhance",
                  name: "AI Enhanced",
                  cssFilter,
                }
              : undefined,
          };
        }
        return c;
      });
      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, video: videoClips },
      });
    },
    [project, projectRef, selectedClipId, updateProjectWithHistory],
  );

  return {
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
  };
}
