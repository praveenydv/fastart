import { useMemo, useCallback } from "react";
import { FastArtProject, MaskConfig, MaskKeyframePoint } from "../types/project";
import { soundEngine } from "../utils/audioEngine";
import {
  cleanAndSortKeyframes,
  cleanAndSortMaskKeyframes,
  findKeyframeAtTime,
  findMaskKeyframeAtTime,
  getInterpolatedTransform,
  getInterpolatedMask,
  updateClipInProject,
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
  setCurrentTime?: (t: number) => void;
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
  setCurrentTime,
  updateProjectWithHistory,
  openModal,
}: UseProjectKeyframesParams) {
  const activeClip = useMemo(() => {
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
    return clip;
  }, [selectedClip, project?.tracks?.video, currentTime]);

  const rawKeyframes = useMemo(() => {
    return cleanAndSortKeyframes(activeClip?.keyframes || []);
  }, [activeClip?.keyframes]);

  const localTime = Math.max(0, currentTime - (activeClip?.startTime || 0));

  const isKeyframeAtPlayhead = useMemo(() => {
    if (rawKeyframes.length === 0) return false;
    return !!findKeyframeAtTime(rawKeyframes, localTime, 0.12);
  }, [rawKeyframes, localTime]);

  const prevKeyframe = useMemo(() => {
    return [...rawKeyframes].reverse().find((k) => k.time < localTime - 0.06);
  }, [rawKeyframes, localTime]);

  const nextKeyframe = useMemo(() => {
    return rawKeyframes.find((k) => k.time > localTime + 0.06);
  }, [rawKeyframes, localTime]);

  const hasPrevKeyframe = !!prevKeyframe;
  const hasNextKeyframe = !!nextKeyframe;
  const keyframeCount = rawKeyframes.length;

  // --- Dedicated Mask Keyframes Track ---
  const rawMaskKeyframes = useMemo(() => {
    return cleanAndSortMaskKeyframes(
      activeClip?.maskKeyframes || activeClip?.mask?.keyframes || [],
    );
  }, [activeClip?.maskKeyframes, activeClip?.mask?.keyframes]);

  const isMaskKeyframeAtPlayhead = useMemo(() => {
    if (rawMaskKeyframes.length === 0) return false;
    return !!findMaskKeyframeAtTime(rawMaskKeyframes, localTime, 0.12);
  }, [rawMaskKeyframes, localTime]);

  const prevMaskKeyframe = useMemo(() => {
    return [...rawMaskKeyframes].reverse().find((k) => k.time < localTime - 0.06);
  }, [rawMaskKeyframes, localTime]);

  const nextMaskKeyframe = useMemo(() => {
    return rawMaskKeyframes.find((k) => k.time > localTime + 0.06);
  }, [rawMaskKeyframes, localTime]);

  const hasPrevMaskKeyframe = !!prevMaskKeyframe;
  const hasNextMaskKeyframe = !!nextMaskKeyframe;
  const maskKeyframeCount = rawMaskKeyframes.length;

  const handleJumpPrevMaskKeyframe = useCallback(() => {
    if (!prevMaskKeyframe || !activeClip) return;
    soundEngine.playSfx("pop");
    const targetTime = Math.max(0, (activeClip.startTime || 0) + prevMaskKeyframe.time);
    if (setCurrentTime) {
      setCurrentTime(targetTime);
    }
    return targetTime;
  }, [prevMaskKeyframe, activeClip, setCurrentTime]);

  const handleJumpNextMaskKeyframe = useCallback(() => {
    if (!nextMaskKeyframe || !activeClip) return;
    soundEngine.playSfx("pop");
    const targetTime = Math.max(0, (activeClip.startTime || 0) + nextMaskKeyframe.time);
    if (setCurrentTime) {
      setCurrentTime(targetTime);
    }
    return targetTime;
  }, [nextMaskKeyframe, activeClip, setCurrentTime]);

  // Add or Remove Mask Keyframe to active video clip
  const handleAddMaskKeyframe = useCallback((): { action: "added" | "removed"; time: number } | void => {
    let targetClip = selectedClip;
    let targetId = selectedClipId;

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
        targetId = activeVideo.id;
        setSelectedClipId(activeVideo.id);
        setSelectedClipType("video");
      }
    }

    if (!targetClip) {
      soundEngine.playSfx("click");
      openModal("mask");
      return;
    }

    soundEngine.playSfx("pop");
    const activeTime = currentTimeRef?.current ?? currentTime;
    const clipMaskKfs = cleanAndSortMaskKeyframes(
      targetClip.maskKeyframes || targetClip.mask?.keyframes || [],
    );
    const clipLocalTime = Math.max(0, activeTime - (targetClip.startTime || 0));
    const existing = findMaskKeyframeAtTime(clipMaskKfs, clipLocalTime, 0.12);

    let updatedMaskKfs: MaskKeyframePoint[] = [];
    let actionType: "added" | "removed" = "added";
    if (existing) {
      actionType = "removed";
      updatedMaskKfs = clipMaskKfs.filter(
        (k) => Math.abs(k.time - clipLocalTime) >= 0.12,
      );
    } else {
      actionType = "added";
      const curMask =
        getInterpolatedMask(targetClip, activeTime) ||
        targetClip.mask ||
        targetClip.transform?.mask || {
          shape: "circle",
          size: 60,
          width: 60,
          height: 60,
          feather: 0,
          roundness: 16,
          inverted: false,
          x: 0,
          y: 0,
          rotation: 0,
        };

      updatedMaskKfs = [
        ...clipMaskKfs,
        {
          time: Number(clipLocalTime.toFixed(3)),
          mask: { ...curMask },
          easing: "easeInOut",
        },
      ];
    }

    updatedMaskKfs = cleanAndSortMaskKeyframes(updatedMaskKfs);

    if (project && targetId) {
      const updatedProject = updateClipInProject(
        project,
        targetId,
        (clip) => {
          const updatedMask = {
            ...(clip.mask || {}),
            keyframes: updatedMaskKfs,
          } as MaskConfig;
          return {
            ...clip,
            maskKeyframes: updatedMaskKfs,
            mask: updatedMask,
            transform: {
              ...(clip.transform || {}),
              mask: updatedMask,
            },
          };
        },
        "video",
      );
      updateProjectWithHistory(updatedProject);
    }

    return { action: actionType, time: activeTime };
  }, [
    selectedClip,
    selectedClipId,
    currentTimeRef,
    project,
    currentTime,
    setSelectedClipId,
    setSelectedClipType,
    openModal,
    updateProjectWithHistory,
  ]);

  const handleDeleteMaskKeyframeAtTime = useCallback((time: number) => {
    if (!selectedClip || !project || !selectedClipId) return;
    const rawMaskKfs = cleanAndSortMaskKeyframes(
      selectedClip.maskKeyframes || selectedClip.mask?.keyframes || [],
    );
    const updated = cleanAndSortMaskKeyframes(
      rawMaskKfs.filter((k) => Math.abs(k.time - time) >= 0.12),
    );
    const updatedProject = updateClipInProject(
      project,
      selectedClipId,
      (clip) => {
        const updatedMask = {
          ...(clip.mask || {}),
          keyframes: updated,
        } as MaskConfig;
        return {
          ...clip,
          maskKeyframes: updated,
          mask: updatedMask,
          transform: {
            ...(clip.transform || {}),
            mask: updatedMask,
          },
        };
      },
      selectedClipType,
    );
    updateProjectWithHistory(updatedProject);
  }, [selectedClip, project, selectedClipId, selectedClipType, updateProjectWithHistory]);

  const handleClearAllMaskKeyframes = useCallback(() => {
    if (!selectedClip || !project || !selectedClipId) return;
    const updatedProject = updateClipInProject(
      project,
      selectedClipId,
      (clip) => {
        const updatedMask = {
          ...(clip.mask || {}),
          keyframes: [],
        } as MaskConfig;
        return {
          ...clip,
          maskKeyframes: [],
          mask: updatedMask,
          transform: {
            ...(clip.transform || {}),
            mask: updatedMask,
          },
        };
      },
      selectedClipType,
    );
    updateProjectWithHistory(updatedProject);
  }, [selectedClip, project, selectedClipId, selectedClipType, updateProjectWithHistory]);

  const handleJumpPrevKeyframe = useCallback(() => {
    if (!prevKeyframe || !activeClip) return;
    soundEngine.playSfx("pop");
    const targetTime = Math.max(0, (activeClip.startTime || 0) + prevKeyframe.time);
    if (setCurrentTime) {
      setCurrentTime(targetTime);
    }
    return targetTime;
  }, [prevKeyframe, activeClip, setCurrentTime]);

  const handleJumpNextKeyframe = useCallback(() => {
    if (!nextKeyframe || !activeClip) return;
    soundEngine.playSfx("pop");
    const targetTime = Math.max(0, (activeClip.startTime || 0) + nextKeyframe.time);
    if (setCurrentTime) {
      setCurrentTime(targetTime);
    }
    return targetTime;
  }, [nextKeyframe, activeClip, setCurrentTime]);

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
    const clipKeyframes = targetClip.keyframes || [];
    const clipLocalTime = Math.max(0, currentTime - (targetClip.startTime || 0));
    const existing = findKeyframeAtTime(clipKeyframes, clipLocalTime, 0.12);

    let updatedKf = [];
    let actionType: "added" | "removed" = "added";
    if (existing) {
      actionType = "removed";
      updatedKf = clipKeyframes.filter(
        (k: any) => Math.abs(k.time - clipLocalTime) >= 0.12,
      );
    } else {
      actionType = "added";
      // Sample exact interpolated state at currentTime so there is NO jumping or snapping
      const curT = getInterpolatedTransform(targetClip, currentTime, targetType);
      const curOpacity =
        targetClip.opacity !== undefined ? targetClip.opacity : 1.0;
      updatedKf = [
        ...clipKeyframes,
        {
          time: Number(clipLocalTime.toFixed(3)),
          transform: {
            scale: Number(curT.scale.toFixed(3)),
            scaleX: curT.scaleX ?? 1.0,
            scaleY: curT.scaleY ?? 1.0,
            rotation: Number(curT.rotation.toFixed(2)),
            rotateX: curT.rotateX ?? 0,
            rotateY: curT.rotateY ?? 0,
            skewX: curT.skewX ?? 0,
            skewY: curT.skewY ?? 0,
            perspective: curT.perspective ?? 800,
            x: Math.round(curT.x),
            y: Math.round(curT.y),
            flipX: curT.flipX,
            flipY: curT.flipY,
          },
          opacity: Number(curOpacity.toFixed(2)),
        },
      ];
    }

    updatedKf = cleanAndSortKeyframes(updatedKf);

    if (project && targetId) {
      const updatedProject = updateClipInProject(
        project,
        targetId,
        (clip) => ({
          ...clip,
          keyframes: updatedKf,
        }),
        targetType,
      );
      updateProjectWithHistory(updatedProject);
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
    if (!selectedClip || !project || !selectedClipId) return;
    const rawKeyframes: any[] = selectedClip.keyframes || [];
    const existingIndex = rawKeyframes.findIndex(
      (k) => Math.abs(k.time - time) < 0.12,
    );

    let updatedKf = [...rawKeyframes];
    const newMask = transform?.mask;
    if (existingIndex >= 0) {
      const existing = updatedKf[existingIndex];
      updatedKf[existingIndex] = {
        ...existing,
        transform: { ...(existing.transform || {}), ...transform },
        opacity: opacity !== undefined ? opacity : (existing.opacity ?? 1.0),
        easing: easing !== undefined ? easing : (existing.easing ?? 'easeInOut'),
        ...(newMask !== undefined ? { mask: newMask } : {}),
      };
    } else {
      const curT = getInterpolatedTransform(
        selectedClip,
        (selectedClip.startTime || 0) + time,
        selectedClipType,
      );
      const curMask = newMask || getInterpolatedMask(selectedClip, (selectedClip.startTime || 0) + time);
      updatedKf.push({
        time: Number(time.toFixed(3)),
        transform: {
          scale: curT.scale,
          rotation: curT.rotation,
          x: curT.x,
          y: curT.y,
          ...transform,
          ...(curMask ? { mask: curMask } : {}),
        },
        opacity: opacity !== undefined ? opacity : (selectedClip.opacity ?? 1.0),
        easing: easing || 'easeInOut',
        ...(curMask ? { mask: curMask } : {}),
      });
    }

    updatedKf = cleanAndSortKeyframes(updatedKf);

    let updatedMaskKfs = selectedClip.maskKeyframes;
    if (newMask && updatedMaskKfs && Array.isArray(updatedMaskKfs) && updatedMaskKfs.length > 0) {
      const mkIdx = updatedMaskKfs.findIndex((k: any) => Math.abs(k.time - time) < 0.12);
      if (mkIdx >= 0) {
        updatedMaskKfs = [...updatedMaskKfs];
        updatedMaskKfs[mkIdx] = {
          ...updatedMaskKfs[mkIdx],
          mask: { ...(updatedMaskKfs[mkIdx].mask || {}), ...newMask },
        };
      } else {
        updatedMaskKfs = cleanAndSortMaskKeyframes([
          ...updatedMaskKfs,
          { time: Number(time.toFixed(3)), mask: newMask },
        ]);
      }
    }

    const updatedProject = updateClipInProject(
      project,
      selectedClipId,
      (clip) => {
        const isOverlayOrText =
          selectedClipType === "text" ||
          selectedClipType === "texts" ||
          selectedClipType === "caption" ||
          selectedClipType === "captions" ||
          selectedClipType === "sticker" ||
          selectedClipType === "stickers" ||
          clip.text !== undefined ||
          clip.char !== undefined;

        const mutated: any = {
          ...clip,
          transform: { ...(clip.transform || {}), ...transform },
          opacity: opacity !== undefined ? opacity : (clip.opacity ?? 1.0),
          keyframes: updatedKf,
          ...(updatedMaskKfs ? { maskKeyframes: updatedMaskKfs } : {}),
        };

        if (isOverlayOrText) {
          if (transform.x !== undefined || transform.y !== undefined) {
            mutated.position = {
              x: transform.x !== undefined ? transform.x : (clip.position?.x ?? 50),
              y:
                transform.y !== undefined
                  ? transform.y
                  : (clip.position?.y ??
                    (selectedClipType === "caption" || selectedClipType === "captions"
                      ? 82
                      : 50)),
            };
          }
          if (transform.scale !== undefined) {
            mutated.scale = transform.scale;
          }
          if (transform.rotation !== undefined) {
            mutated.rotation = transform.rotation;
          }
        }

        return mutated;
      },
      selectedClipType,
    );
    updateProjectWithHistory(updatedProject);
  }, [selectedClip, project, selectedClipType, selectedClipId, updateProjectWithHistory]);

  const handleDeleteKeyframeAtTime = useCallback((time: number) => {
    if (!selectedClip || !project || !selectedClipId) return;
    const rawKeyframes: any[] = selectedClip.keyframes || [];
    const updatedKf = cleanAndSortKeyframes(
      rawKeyframes.filter((k) => Math.abs(k.time - time) >= 0.12),
    );

    const updatedProject = updateClipInProject(
      project,
      selectedClipId,
      (clip) => ({
        ...clip,
        keyframes: updatedKf,
      }),
      selectedClipType,
    );
    updateProjectWithHistory(updatedProject);
  }, [selectedClip, project, selectedClipType, selectedClipId, updateProjectWithHistory]);

  const handleClearAllKeyframes = useCallback(() => {
    if (!selectedClip || !project || !selectedClipId) return;
    const updatedProject = updateClipInProject(
      project,
      selectedClipId,
      (clip) => ({
        ...clip,
        keyframes: [],
      }),
      selectedClipType,
    );
    updateProjectWithHistory(updatedProject);
  }, [selectedClip, project, selectedClipType, selectedClipId, updateProjectWithHistory]);

  return {
    isKeyframeAtPlayhead,
    handleAddKeyframe,
    handleUpdateKeyframeTransform,
    handleDeleteKeyframeAtTime,
    handleClearAllKeyframes,
    handleJumpPrevKeyframe,
    handleJumpNextKeyframe,
    hasPrevKeyframe,
    hasNextKeyframe,
    keyframeCount,

    // Mask Keyframes Track
    isMaskKeyframeAtPlayhead,
    hasPrevMaskKeyframe,
    hasNextMaskKeyframe,
    maskKeyframeCount,
    handleJumpPrevMaskKeyframe,
    handleJumpNextMaskKeyframe,
    handleAddMaskKeyframe,
    handleDeleteMaskKeyframeAtTime,
    handleClearAllMaskKeyframes,
  };
}
