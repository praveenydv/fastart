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
  EffectClip,
  BlendMode,
  HSLAdjustments,
  VoiceEffectId,
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
  currentTime?: number;
  transitionTargetClipId: string | null;
  updateProjectWithHistory: (proj: any) => void;
  setActiveModal: (modal: string | null) => void;
  setSelectedClipId?: (id: string | null) => void;
  setSelectedClipType?: (type: string) => void;
}

export function useProjectFilterEffects({
  project,
  projectRef,
  selectedClip,
  selectedClipId,
  selectedClipType,
  currentTime = 0,
  transitionTargetClipId,
  updateProjectWithHistory,
  setActiveModal,
  setSelectedClipId,
  setSelectedClipType,
}: UseProjectFilterEffectsParams) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Processing Edit...");
  const processingTimer = useRef<any>(null);

  // Helper to resolve the active clip at the current playhead or first clip
  const resolveTargetClipId = useCallback(
    (preferredType: "video" | "audio" = "video", autoSelect: boolean = false): string | null => {
      const current = projectRef.current || project;
      if (!current) return null;
      if (selectedClipId) return selectedClipId;

      const curTime = typeof currentTime === "number" ? currentTime : 0;
      if (preferredType === "audio") {
        const audioAtTime = current.tracks.audio?.find(
          (c) => curTime >= c.startTime && curTime <= c.startTime + c.duration,
        ) || current.tracks.audio?.[0];
        if (audioAtTime) {
          if (autoSelect && setSelectedClipId) setSelectedClipId(audioAtTime.id);
          if (autoSelect && setSelectedClipType) setSelectedClipType("audio");
          return audioAtTime.id;
        }
      }

      const videoAtTime = current.tracks.video?.find(
        (c) => curTime >= c.startTime && curTime <= c.startTime + c.duration,
      ) || current.tracks.video?.[0];

      if (videoAtTime) {
        if (autoSelect && setSelectedClipId) setSelectedClipId(videoAtTime.id);
        if (autoSelect && setSelectedClipType) setSelectedClipType("video");
        return videoAtTime.id;
      }

      return null;
    },
    [project, projectRef, selectedClipId, currentTime, setSelectedClipId, setSelectedClipType],
  );

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

  // Apply color filter or custom 3D LUT (attached to video clip if selected, or create timeline filter clip if global)
  const handleApplyFilter = useCallback(
    (filterId: string, customLut?: CustomLutConfig) => {
      const current = projectRef.current || project;
      if (!current) return;

      // 1. VIDEO ATTACHED: If a video clip is currently selected, attach the filter to that clip!
      if (selectedClipId && selectedClipType === "video") {
        const videoClips = [...(current.tracks.video || [])];
        const idx = videoClips.findIndex((c) => c.id === selectedClipId);
        if (idx >= 0) {
          const isNone = filterId === "none" || filterId === "normal";
          videoClips[idx] = {
            ...videoClips[idx],
            filter: isNone ? undefined : filterId,
            customLut: isNone ? undefined : customLut,
          };
          updateProjectWithHistory({
            ...current,
            tracks: { ...current.tracks, video: videoClips },
          });
        }
        return;
      }

      // 2. If an effect/filter clip is currently selected, update its filter!
      if ((selectedClipType === "effects" || selectedClipType === "effect") && selectedClipId) {
        const effectClips = [...(current.tracks.effects || [])];
        const idx = effectClips.findIndex((e) => e.id === selectedClipId);
        if (idx >= 0) {
          const isNone = filterId === "none" || filterId === "normal";
          if (isNone) {
            effectClips.splice(idx, 1);
            updateProjectWithHistory({
              ...current,
              tracks: { ...current.tracks, effects: effectClips },
            });
            if (setSelectedClipId) setSelectedClipId(null);
            if (setSelectedClipType) setSelectedClipType("");
          } else {
            const filterName = filterId.charAt(0).toUpperCase() + filterId.slice(1);
            effectClips[idx] = {
              ...effectClips[idx],
              filter: filterId,
              type: "filter_" + filterId,
              name: `Filter: ${filterName}`,
              customLut,
            };
            updateProjectWithHistory({
              ...current,
              tracks: { ...current.tracks, effects: effectClips },
            });
          }
          return;
        }
      }

      // 3. GLOBAL: Create timeline filter clip!
      if (filterId === "none" || filterId === "normal") return;

      const desiredStart = currentTime || 0;
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        current,
        desiredStart,
      );

      const filterName = filterId.charAt(0).toUpperCase() + filterId.slice(1);
      const newFilterClip: EffectClip = {
        id: "eff-flt-" + Date.now(),
        type: "filter_" + filterId,
        name: `Filter: ${filterName}`,
        filter: filterId,
        customLut,
        startTime: Math.max(0, Number(desiredStart.toFixed(3))),
        duration: 3.0,
        intensity: 0.8,
        trackIndex: newTrackIndex,
      };

      const effectClips = [...(current.tracks.effects || []), newFilterClip];
      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, effects: effectClips },
      });

      if (setSelectedClipId) setSelectedClipId(newFilterClip.id);
      if (setSelectedClipType) setSelectedClipType("effects");
    },
    [project, projectRef, selectedClipId, selectedClipType, currentTime, updateProjectWithHistory, setSelectedClipId, setSelectedClipType],
  );

  // Apply Cutout — only writes to clip.cutout, never overwrites clip.transform
  const handleApplyCutout = useCallback(
    (cutoutConfig: CutoutConfig) => {
      const current = projectRef.current;
      if (!current) return;
      const targetId = resolveTargetClipId("video");
      if (!targetId) return;

      const videoClips = [...(current.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === targetId);
      if (idx >= 0) {
        videoClips[idx] = {
          ...videoClips[idx],
          cutout: cutoutConfig,
        };
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, video: videoClips },
        });
      }
    },
    [projectRef, resolveTargetClipId, updateProjectWithHistory],
  );

  // Apply AI Motion Tracking
  const handleApplyMotionTracking = useCallback(
    (motionConfig: MotionTrackConfig) => {
      const current = projectRef.current || project;
      if (!current) return;
      const targetId = resolveTargetClipId(selectedClipType === "audio" ? "audio" : "video");
      if (!targetId) return;

      if (selectedClipType === "text") {
        const textClips = [...(current.tracks.text || [])];
        const idx = textClips.findIndex((t) => t.id === targetId);
        if (idx >= 0) {
          textClips[idx] = { ...textClips[idx], motionTrack: motionConfig };
          updateProjectWithHistory({
            ...current,
            tracks: { ...current.tracks, text: textClips },
          });
        }
      } else if (
        selectedClipType === "stickers" ||
        selectedClipType === "sticker"
      ) {
        const stickerClips = [...(current.tracks.stickers || [])];
        const idx = stickerClips.findIndex((s) => s.id === targetId);
        if (idx >= 0) {
          stickerClips[idx] = { ...stickerClips[idx], motionTrack: motionConfig };
          updateProjectWithHistory({
            ...current,
            tracks: { ...current.tracks, stickers: stickerClips },
          });
        }
      } else {
        const videoClips = [...(current.tracks.video || [])];
        const idx = videoClips.findIndex((v) => v.id === targetId);
        if (idx >= 0) {
          videoClips[idx] = { ...videoClips[idx], motionTrack: motionConfig };
          updateProjectWithHistory({
            ...current,
            tracks: { ...current.tracks, video: videoClips },
          });
        }
      }
    },
    [project, projectRef, selectedClipType, resolveTargetClipId, updateProjectWithHistory],
  );

  // Apply transition
  const handleApplyTransition = useCallback(
    (trans: any) => {
      const current = projectRef.current || project;
      if (!current) return;
      const targetId = transitionTargetClipId || resolveTargetClipId("video");
      if (!targetId) return;

      const videoClips = [...(current.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === targetId);
      if (idx >= 0) {
        videoClips[idx] = { ...videoClips[idx], transition: trans };
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, video: videoClips },
        });
      }
    },
    [project, projectRef, transitionTargetClipId, resolveTargetClipId, updateProjectWithHistory],
  );

  // Apply speed change with accurate duration adjustment, track-0 ripple, and audio track support
  const handleApplySpeed = useCallback(
    (
      speedVal: number,
      curve?: any,
      smoothSlowMo?: "none" | "blend" | "optical_flow",
    ) => {
      const current = projectRef.current || project;
      if (!current) return;
      const targetId = resolveTargetClipId("video");
      if (!targetId) return;

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
      const vIdx = videoClips.findIndex((c) => c.id === targetId);
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
      const aIdx = audioClips.findIndex((c) => c.id === targetId);
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
    [project, projectRef, resolveTargetClipId, updateProjectWithHistory],
  );

  // Apply Volume & Fades to video or audio clips smoothly without flashing spinners
  const handleApplyVolume = useCallback(
    (vol: number, fadeIn: number, fadeOut: number, denoise?: boolean) => {
      const current = projectRef.current || project;
      if (!current) return;
      const targetId = resolveTargetClipId(selectedClipType === "audio" ? "audio" : "video");
      if (!targetId) return;

      // Check video tracks
      const videoClips = [...(current.tracks.video || [])];
      const vIdx = videoClips.findIndex((c) => c.id === targetId);
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
      const aIdx = audioClips.findIndex((c) => c.id === targetId);
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
    [project, projectRef, selectedClipType, resolveTargetClipId, updateProjectWithHistory],
  );

  // Dedicated 1-tap AI Noise Reduction toggle
  const handleToggleDenoise = useCallback(() => {
    const current = projectRef.current || project;
    if (!current) return;
    const targetId = resolveTargetClipId(selectedClipType === "audio" ? "audio" : "video");
    if (!targetId) return;

    // Check audio tracks first
    const audioClips = [...(current.tracks.audio || [])];
    const aIdx = audioClips.findIndex((c) => c.id === targetId);
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
    const vIdx = videoClips.findIndex((c) => c.id === targetId);
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
  }, [project, projectRef, selectedClipType, resolveTargetClipId, updateProjectWithHistory]);

  // Extract Audio from Video Clip to Independent Audio Track
  const handleExtractAudioFromVideo = useCallback(async () => {
    const current = projectRef.current;
    if (!current) return;
    const targetId = resolveTargetClipId("video");
    if (!targetId) return;
    const videoClips = current.tracks.video || [];
    const targetVideo = videoClips.find((v) => v.id === targetId);
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
        v.id === targetId ? { ...v, volume: 0 } : v,
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
  }, [projectRef, resolveTargetClipId, updateProjectWithHistory, setActiveModal, withProcessing]);

  // Apply Transform, Mask & Canvas Ratio
  const handleApplyTransform = useCallback(
    (
      t: ClipTransform,
      newAspectRatio?: AspectRatio,
      newMask?: MaskConfig,
    ) => {
      const current = projectRef.current;
      if (!current) return;
      const targetId = resolveTargetClipId("video");
      let updated: any = { ...current };
      if (newAspectRatio && newAspectRatio !== current.aspectRatio) {
        updated.aspectRatio = newAspectRatio;
      }
      if (targetId) {
        const videoClips = [...(current.tracks.video || [])];
        const idx = videoClips.findIndex((c) => c.id === targetId);
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
    [projectRef, resolveTargetClipId, updateProjectWithHistory],
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
      const targetId = resolveTargetClipId("video");
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
        if (!targetId || c.id === targetId) {
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
    [project, projectRef, resolveTargetClipId, updateProjectWithHistory],
  );

  // Apply layer blend mode and opacity to active video / photo clip
  const handleApplyBlendMode = useCallback(
    (mode: BlendMode, opacity?: number) => {
      const current = projectRef.current || project;
      if (!current) return;
      const targetId = resolveTargetClipId("video");
      if (!targetId) return;

      const videoClips = (current.tracks.video || []).map((c) => {
        if (c.id === targetId) {
          const prevTransform = c.transform || { scale: 1, rotation: 0, x: 0, y: 0 };
          return {
            ...c,
            opacity: opacity !== undefined ? opacity : (c.opacity ?? 1.0),
            transform: {
              ...prevTransform,
              blendMode: mode,
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
    [project, projectRef, resolveTargetClipId, updateProjectWithHistory],
  );

  // Apply 8-channel selective HSL adjustments to active clip
  const handleApplyHSL = useCallback(
    (adjustments: HSLAdjustments) => {
      const current = projectRef.current || project;
      if (!current) return;
      const targetId = resolveTargetClipId("video");
      if (!targetId) return;

      const videoClips = (current.tracks.video || []).map((c) => {
        if (c.id === targetId) {
          return {
            ...c,
            hslAdjustments: adjustments,
          };
        }
        return c;
      });

      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, video: videoClips },
      });
    },
    [project, projectRef, resolveTargetClipId, updateProjectWithHistory],
  );

  // Apply character voice changer profile
  const handleApplyVoiceEffect = useCallback(
    (voiceEffect: VoiceEffectId) => {
      const current = projectRef.current || project;
      if (!current) return;
      const targetAudioId = resolveTargetClipId("audio");
      const targetVideoId = resolveTargetClipId("video");

      if (selectedClipType === "audio" && targetAudioId) {
        const audioClips = (current.tracks.audio || []).map((c) => {
          if (c.id === targetAudioId) {
            return {
              ...c,
              voiceEffect: voiceEffect === "none" ? undefined : voiceEffect,
            };
          }
          return c;
        });
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, audio: audioClips },
        });
        return;
      }

      if (targetVideoId) {
        const videoClips = (current.tracks.video || []).map((c) => {
          if (c.id === targetVideoId) {
            return {
              ...c,
              voiceEffect: voiceEffect === "none" ? undefined : voiceEffect,
            };
          }
          return c;
        });
        updateProjectWithHistory({
          ...current,
          tracks: { ...current.tracks, video: videoClips },
        });
      }
    },
    [project, projectRef, resolveTargetClipId, selectedClipType, updateProjectWithHistory],
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
    handleApplyBlendMode,
    handleApplyHSL,
    handleApplyVoiceEffect,
    isProcessing,
    processingMessage,
    startProcessing,
    withProcessing,
  };
}
