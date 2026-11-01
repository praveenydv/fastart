import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { View, Text, Platform, ActivityIndicator } from "react-native";
import { TactileTouchable as TouchableOpacity } from "./Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { PlayerProps, TransientTransformState } from "./Player/playerTypes";
import {
  getItemBaseDimensions,
  getInterpolatedTransform,
} from "./Player/playerUtils";
import { styles } from "./Player/PlayerStyles";
import { PlayerControlsBar } from "./Player/PlayerControlsBar";
import { PlayerCropBar } from "./Player/PlayerCropBar";
import { PlayerCropOverlay } from "./Player/PlayerCropOverlay";
import { PlayerMaskOverlay } from "./Player/PlayerMaskOverlay";
import { PlayerTrackingReticle } from "./Player/PlayerTrackingReticle";
import { PlayerNativeCompositor } from "./Player/PlayerNativeCompositor";
import { PlayerTransformOverlay } from "./Player/PlayerTransformOverlay";
import { usePlayerCropGestures } from "./Player/usePlayerCropGestures";
import { usePlayerTransformGestures } from "./Player/usePlayerTransformGestures";
import { usePlayerViewport } from "./Player/usePlayerViewport";
import { usePlayerWebRenderer } from "./Player/usePlayerWebRenderer";
import { usePlayerAudioSync } from "./Player/usePlayerAudioSync";
import { useActiveTransformItem } from "./Player/useActiveTransformItem";
import { getExportResolutionDimensions } from "./Panels/Export/exportTypes";
import { THEME_COLORS } from "../constants/designConstants";
import { relinkMediaFile, reconnectLinkedMedia } from "../utils/largeMediaStorage";
import { MaskConfig } from "../types/project";

const EMPTY_ARRAY: any[] = Object.freeze([]) as any[];

function Player({
  project,
  currentTime,
  isPlaying,
  totalDuration,
  onTogglePlay,
  onSeek,
  onAddKeyframe,
  hasKeyframeAtCurrentTime,
  onOpenKeyframeModal,
  onOpenMediaPicker,
  selectedClipId,
  selectedClipType,
  onSelectClip,
  onUpdateClipTransform,
  onOpenEditModal,
  onOpenCropModal,
  onOpenMaskModal,
  onOpenAnimationModal,
  onDeleteClip,
  onDuplicateClip,
  onSplitClip,
  fullscreen: fullscreenProp,
  onToggleFullscreen,
  isCroppingPreview: isCroppingPreviewProp,
  onToggleCropPreview,
  onUpdateClipCrop,
  isMaskingPreview: isMaskingPreviewProp,
  onToggleMaskPreview,
  onUpdateClipMask,
  isProcessing,
  processingMessage,
  activeModal,
  isResizing = false,
  onUpdateClipMotionTrack,
  onRelinkClip,
}: PlayerProps) {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [internalMaskingMode, setInternalMaskingMode] = useState(false);
  const isMaskingMode =
    isMaskingPreviewProp !== undefined
      ? isMaskingPreviewProp
      : internalMaskingMode;
  const fullscreen =
    fullscreenProp !== undefined ? fullscreenProp : internalFullscreen;

  const toggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen(!internalFullscreen);
    }
  };

  const [showSafeZone, setShowSafeZone] = useState(false);
  const [activeTransient, setActiveTransient] =
    useState<TransientTransformState | null>(null);

  const handleTransientMaskUpdate = useCallback((clipId: string, mask: MaskConfig | null) => {
    if (!mask) {
      setActiveTransient(null);
    } else {
      setActiveTransient((prev) => {
        if (prev?.clipId === clipId && prev.mask === mask) return prev;
        return {
          clipId,
          x: prev?.clipId === clipId && !prev.mask ? prev.x : 0,
          y: prev?.clipId === clipId && !prev.mask ? prev.y : 0,
          scale: prev?.clipId === clipId && !prev.mask ? prev.scale : 1,
          rotation: prev?.clipId === clipId && !prev.mask ? prev.rotation : 0,
          mask,
        };
      });
    }
  }, []);

  // Clear transient state when changing selected clip to prevent transform bleed
  useEffect(() => {
    setActiveTransient(null);
  }, [selectedClipId]);

  // Viewport & Dimensions hook
  const {
    viewportWrapperRef,
    isMobile,
    canvasWidth,
    canvasHeight,
    boxWidth,
    handleViewportLayout,
  } = usePlayerViewport({ project, fullscreen, isResizing });

  // Freeze canvas buffer resolution during drag/resize to prevent context wiping and glitching
  const stableResolutionRef = useRef<{ width: number; height: number }>({
    width: canvasWidth,
    height: canvasHeight,
  });

  if (!isResizing && canvasWidth > 0 && canvasHeight > 0) {
    stableResolutionRef.current = {
      width: canvasWidth,
      height: canvasHeight,
    };
  }

  const effectiveBufferW = stableResolutionRef.current.width || canvasWidth;
  const effectiveBufferH = stableResolutionRef.current.height || canvasHeight;

  const dpr =
    typeof window !== "undefined"
      ? Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0)
      : 1;

  const canvasBufferWidth = Math.round(effectiveBufferW * dpr);
  const canvasBufferHeight = Math.round(effectiveBufferH * dpr);

  const targetRatio = useMemo(() => {
    const ratioMap: Record<string, number> = {
      "9:16": 9 / 16,
      "16:9": 16 / 9,
      "1:1": 1 / 1,
      "4:5": 4 / 5,
      "2.35:1": 235 / 100,
    };
    return ratioMap[project.aspectRatio] || 9 / 16;
  }, [project.aspectRatio]);

  // Web VideoRenderer Canvas hook
  const { canvasRef, canvasBoxRef, rendererRef } = usePlayerWebRenderer({
    project,
    currentTime,
    isPlaying,
    boxWidth,
    canvasHeight,
    isResizing,
  });

  // Audio synchronization hook
  usePlayerAudioSync({ project, currentTime, isPlaying });

  const hasAnyTrackContent = Boolean(
    (project.tracks.video && project.tracks.video.length > 0) ||
    (project.tracks.text && project.tracks.text.length > 0) ||
    (project.tracks.stickers && project.tracks.stickers.length > 0) ||
    (project.tracks.effects && project.tracks.effects.length > 0) ||
    (project.tracks.audio && project.tracks.audio.length > 0),
  );
  const isProjectEmpty = !hasAnyTrackContent;

  const hasMissingOrPermissionClips = useMemo(() => {
    return (project?.tracks?.video || []).some(
      (c: any) => c.needsPermission || c.isMissing,
    );
  }, [project?.tracks?.video]);

  const currentActiveClip = useMemo(() => {
    if (!hasMissingOrPermissionClips) return null;
    if (selectedClipId) {
      const selectedVideo = (project?.tracks?.video || []).find((c) => c.id === selectedClipId);
      if (selectedVideo && ((selectedVideo as any).needsPermission || (selectedVideo as any).isMissing)) {
        return selectedVideo;
      }
    }
    return (project?.tracks?.video || []).find(
      (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
    );
  }, [hasMissingOrPermissionClips, project?.tracks?.video, currentTime, selectedClipId]);

  const currentActiveClipRef = useRef(currentActiveClip);
  useEffect(() => {
    currentActiveClipRef.current = currentActiveClip;
  }, [currentActiveClip]);

  const handleRelinkActiveClip = useCallback(async () => {
    const activeClip = currentActiveClipRef.current;
    if (!activeClip) return;
    const lookupId = activeClip.sourceMediaId || activeClip.id;
    const clipType = ("type" in activeClip && (activeClip as any).type) ? (activeClip as any).type : "video";
    // 1. Try zero-dialog reconnect first using the handle
    let result = await reconnectLinkedMedia(lookupId, activeClip.title);
    // 2. If reconnect fails, open file picker
    if (!result) {
      result = await relinkMediaFile(lookupId, clipType as any);
    }
    if (result) {
      (activeClip as any).isMissing = false;
      (activeClip as any).needsPermission = false;
      activeClip.url = result.url;
      if (onRelinkClip) {
        onRelinkClip(activeClip.id, clipType, result.url, lookupId);
      }
    } else if (Platform.OS !== "web" && onOpenMediaPicker) {
      onOpenMediaPicker();
    }
  }, [onRelinkClip, onOpenMediaPicker]);

  const handleChooseReplacementFile = useCallback(async () => {
    const activeClip = currentActiveClipRef.current;
    if (!activeClip) return;
    const lookupId = activeClip.sourceMediaId || activeClip.id;
    const clipType = ("type" in activeClip && (activeClip as any).type) ? (activeClip as any).type : "video";
    const res = await relinkMediaFile(lookupId, clipType as any);
    if (res) {
      (activeClip as any).isMissing = false;
      (activeClip as any).needsPermission = false;
      activeClip.url = res.url;
      if (onRelinkClip) {
        onRelinkClip(activeClip.id, clipType, res.url, lookupId);
      }
    } else if (Platform.OS !== "web" && onOpenMediaPicker) {
      onOpenMediaPicker();
    }
  }, [onRelinkClip, onOpenMediaPicker]);

  const isLightBg = useMemo(() => {
    const bg = (project.canvasBackground || "#000000").toLowerCase();
    if (bg.startsWith("blur:") || bg.startsWith("gradient:") || bg.startsWith("image:")) return false;
    return (
      bg === "#ffffff" ||
      bg === "white" ||
      bg === "#f8fafc" ||
      bg === "#f1f5f9" ||
      bg === "#e2e8f0"
    );
  }, [project.canvasBackground]);

  const effectiveCanvasBg = useMemo(() => {
    const raw = project.canvasBackground || "#000000";
    if (raw.startsWith("blur:") || raw.startsWith("image:")) return "#000000";
    if (raw.startsWith("gradient:")) return raw.replace("gradient:", "").split(",")[0] || "#000000";
    return raw;
  }, [project.canvasBackground]);

  // ESC key listener to exit fullscreen mode
  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    )
      return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (typeof window.removeEventListener === "function") {
        window.removeEventListener("keydown", onKeyDown);
      }
    };
  }, [fullscreen]);

  const activeCaptions = useMemo(() => {
    const list = project.tracks.captions;
    if (!list || list.length === 0) return EMPTY_ARRAY;
    const filtered = list.filter(
      (c) =>
        currentTime >= c.startTime && currentTime <= c.startTime + c.duration,
    );
    return filtered.length > 0 ? filtered : EMPTY_ARRAY;
  }, [project.tracks.captions, currentTime]);

  const activeTexts = useMemo(() => {
    const list = project.tracks.text;
    if (!list || list.length === 0) return EMPTY_ARRAY;
    const filtered = list.filter(
      (t) =>
        currentTime >= t.startTime && currentTime <= t.startTime + t.duration,
    );
    return filtered.length > 0 ? filtered : EMPTY_ARRAY;
  }, [project.tracks.text, currentTime]);

  const activeStickers = useMemo(() => {
    const list = project.tracks.stickers;
    if (!list || list.length === 0) return EMPTY_ARRAY;
    const filtered = list.filter(
      (s) =>
        currentTime >= s.startTime && currentTime <= s.startTime + s.duration,
    );
    return filtered.length > 0 ? filtered : EMPTY_ARRAY;
  }, [project.tracks.stickers, currentTime]);

  // Precomputed set of video clip IDs that have adjacent next clips on the same track.
  // Calculated once per track topology change instead of running O(N^2) loops 60 times a second.
  const adjacentNextClipIds = useMemo(() => {
    const vids = project.tracks.video || [];
    const set = new Set<string>();
    if (vids.length <= 1) return set;
    for (let i = 0; i < vids.length; i++) {
      const v = vids[i];
      const end = v.startTime + v.duration;
      const track = v.trackIndex || 0;
      for (let j = 0; j < vids.length; j++) {
        if (i !== j) {
          const other = vids[j];
          if ((other.trackIndex || 0) === track && Math.abs(other.startTime - end) < 0.01) {
            set.add(v.id);
            break;
          }
        }
      }
    }
    return set;
  }, [project.tracks.video]);

  // Visible active videos (strictly within active playback interval, used for transform & overlays)
  const activeVideos = useMemo(() => {
    const vids = project.tracks.video;
    if (!vids || vids.length === 0) return EMPTY_ARRAY;
    const filtered = vids.filter((v) => {
      const start = v.startTime;
      const end = v.startTime + v.duration;
      const hasAdjacentNext = adjacentNextClipIds.has(v.id);
      if (hasAdjacentNext) {
        return currentTime >= start && currentTime < end;
      }
      return currentTime >= start && currentTime <= end;
    });
    return filtered.length > 0 ? filtered : EMPTY_ARRAY;
  }, [project.tracks.video, currentTime, adjacentNextClipIds]);

  // Buffered native videos: includes 1.0s lookahead pre-warming with Hardware Decoder Safety Cap
  const bufferedNativeVideos = useMemo(() => {
    const list = project.tracks.video || [];
    if (list.length === 0) return EMPTY_ARRAY;
    const filtered = list.filter((v) => {
      const start = v.startTime;
      const end = v.startTime + v.duration;
      const hasAdjacentNext = adjacentNextClipIds.has(v.id);
      // 1. Actively inside playback
      if (hasAdjacentNext ? (currentTime >= start && currentTime < end) : (currentTime >= start && currentTime <= end)) return true;
      // 2. Pre-warm upcoming clip within 1.0s before its cut
      if (currentTime < start && start - currentTime <= 1.0) return true;
      // 3. Tail-hold recently finished clip ONLY if there is no adjacent next clip on this track
      if (!hasAdjacentNext && currentTime > end && currentTime - end <= 0.2) return true;
      return false;
    });

    if (filtered.length === 0) return EMPTY_ARRAY;

    // Mobile Hardware Decoder Protection:
    // Strictly cap to at most 3-4 concurrent native video decoders (MediaCodec / AVPlayer)
    // Prioritize strictly active visible clips first, then immediately upcoming clips
    filtered.sort((a, b) => {
      const aActive = currentTime >= a.startTime && currentTime <= a.startTime + a.duration;
      const bActive = currentTime >= b.startTime && currentTime <= b.startTime + b.duration;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return (a.trackIndex || 0) - (b.trackIndex || 0);
    });

    return filtered.slice(0, 4);
  }, [project.tracks.video, currentTime, adjacentNextClipIds]);

  const activeEffects = useMemo(() => {
    const trackEffs = (project.tracks.effects || []).filter(
      (e) =>
        currentTime >= (e.startTime - 0.005) &&
        currentTime <= (e.startTime + e.duration + 0.005),
    );
    const clipEffs = activeVideos
      .filter((v) => v.effect && v.effect !== "none")
      .map((v) => ({
        id: "clip-eff-" + v.id,
        type: v.effect!,
        startTime: v.startTime,
        duration: v.duration,
        intensity: v.effectIntensity !== undefined ? v.effectIntensity : 0.8,
      }));
    const combined = [...trackEffs, ...clipEffs];
    return combined.length > 0 ? combined : EMPTY_ARRAY;
  }, [project.tracks.effects, activeVideos, currentTime]);

  const activeAudios = useMemo(() => {
    const list = project.tracks.audio;
    if (!list || list.length === 0) return EMPTY_ARRAY;
    const filtered = list.filter(
      (a) =>
        currentTime >= a.startTime && currentTime <= a.startTime + a.duration,
    );
    return filtered.length > 0 ? filtered : EMPTY_ARRAY;
  }, [project.tracks.audio, currentTime]);

  // Buffered native audio tracks: includes 1.5s lookahead pre-warming
  const bufferedNativeAudios = useMemo(() => {
    const list = project.tracks.audio;
    if (!list || list.length === 0) return EMPTY_ARRAY;
    const filtered = list.filter((a) => {
      const start = a.startTime;
      const end = a.startTime + a.duration;
      if (currentTime >= start && currentTime <= end) return true;
      if (currentTime < start && start - currentTime <= 1.5) return true;
      return false;
    });
    return filtered.length > 0 ? filtered : EMPTY_ARRAY;
  }, [project.tracks.audio, currentTime]);

  // Crop Gestures Hook
  const {
    isCroppingMode,
    cropBox,
    cropPreset,
    targetCropClip,
    cropPixelX,
    cropPixelY,
    cropPixelW,
    cropPixelH,
    mw,
    mh,
    handleEnterCropMode,
    handleCropDragStart,
    handleApplyPresetCrop,
    handleResetCrop,
    handleCancelCrop,
    handleConfirmCrop,
    cropResponders,
  } = usePlayerCropGestures({
    project,
    currentTime,
    isPlaying,
    boxWidth,
    canvasHeight,
    selectedClipId,
    selectedClipType,
    isCroppingPreviewProp,
    onToggleCropPreview,
    onUpdateClipCrop,
    rendererRef,
    canvasRef,
  });

  const targetMaskClip = useMemo(() => {
    if (selectedClipId) {
      const match = (project.tracks.video || []).find((v) => v.id === selectedClipId);
      if (match) return match;
    }
    return activeVideos[0] || (project.tracks.video || [])[0] || null;
  }, [selectedClipId, project.tracks.video, activeVideos]);

  const targetTrackingClip = useMemo(() => {
    if (selectedClipId) {
      const match =
        (project.tracks.video || []).find((v) => v.id === selectedClipId) ||
        (project.tracks.text || []).find((t) => t.id === selectedClipId) ||
        (project.tracks.stickers || []).find((s) => s.id === selectedClipId);
      if (match) return match as any;
    }
    return activeVideos[0] || (project.tracks.video || [])[0] || null;
  }, [selectedClipId, project.tracks, activeVideos]);

  // Resolved Active Selected Transform Item
  const activeTransformItem = useActiveTransformItem({
    isCroppingMode,
    isPlaying,
    selectedClipId,
    selectedClipType,
    activeCaptions,
    activeTexts,
    activeStickers,
    activeVideos,
    activeTransient,
    boxWidth,
    canvasHeight,
    currentTime,
    project,
    getInterpolatedTransform,
  });

  // Transform Gestures Hook
  const {
    canvasMultiTouchPanResponder,
    nativeBoxPanResponder,
    nativeRotPanResponder,
    scaleTLResponder,
    scaleTRResponder,
    scaleBLResponder,
    scaleBRResponder,
    handleStartDrag,
  } = usePlayerTransformGestures({
    activeTransformItem,
    boxWidth,
    canvasHeight,
    canvasRef,
    canvasBoxRef,
    rendererRef,
    project,
    currentTime,
    isPlaying,
    onUpdateClipTransform,
    onOpenEditModal,
    setActiveTransient,
  });

  // Keyframe Pressed HUD Toast
  const [kfToast, setKfToast] = useState<{
    text: string;
    isAdd: boolean;
  } | null>(null);
  const kfToastTimer = useRef<any>(null);

  const handleKeyframePress = useCallback(() => {
    const res = (onAddKeyframe as any)?.();
    if (res && res.action) {
      const timeSec = res.time ?? currentTime;
      const min = Math.floor(timeSec / 60);
      const sec = timeSec % 60;
      const timeStr = `${min < 10 ? "0" : ""}${min}:${sec < 10 ? "0" : ""}${sec.toFixed(1)}`;
      setKfToast({
        text:
          res.action === "added"
            ? `◆ Keyframe Stamped at ${timeStr}`
            : `◇ Keyframe Removed`,
        isAdd: res.action === "added",
      });
      if (kfToastTimer.current) clearTimeout(kfToastTimer.current);
      kfToastTimer.current = setTimeout(() => {
        setKfToast(null);
      }, 1800);
    }
  }, [onAddKeyframe, currentTime]);

  // Active clip for keyframe navigation
  const activeClip = useMemo(() => {
    if (selectedClipId && selectedClipType) {
      const trackKey = (
        selectedClipType === "sticker" || selectedClipType === "stickers"
          ? "stickers"
          : selectedClipType === "text" || selectedClipType === "texts"
            ? "text"
            : selectedClipType === "caption" || selectedClipType === "captions"
              ? "captions"
              : "video"
      ) as keyof typeof project.tracks;
      const list = project.tracks[trackKey] || [];
      const found = list.find((c: any) => c.id === selectedClipId);
      if (found) return found;
    }
    return (project.tracks.video || []).find(
      (c: any) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
    );
  }, [project.tracks, selectedClipId, selectedClipType, currentTime]);

  const clipKeyframes = useMemo(() => {
    return activeClip?.keyframes || [];
  }, [activeClip?.keyframes]);

  const hasKeyframesOnClip = clipKeyframes.length > 0;
  const localClipTime = Math.max(0, currentTime - (activeClip?.startTime || 0));

  const prevKeyframe = useMemo(() => {
    return [...clipKeyframes].reverse().find((k: any) => k.time < localClipTime - 0.05);
  }, [clipKeyframes, localClipTime]);

  const nextKeyframe = useMemo(() => {
    return clipKeyframes.find((k: any) => k.time > localClipTime + 0.05);
  }, [clipKeyframes, localClipTime]);

  const hasPrevKeyframe = !!prevKeyframe;
  const hasNextKeyframe = !!nextKeyframe;

  const handleJumpPrevKeyframe = useCallback(() => {
    if (!prevKeyframe || !activeClip) return;
    soundEngine.playSfx("pop");
    onSeek(Math.max(0, (activeClip.startTime || 0) + prevKeyframe.time));
  }, [prevKeyframe, activeClip, onSeek]);

  const handleJumpNextKeyframe = useCallback(() => {
    if (!nextKeyframe || !activeClip) return;
    soundEngine.playSfx("pop");
    onSeek(Math.max(0, (activeClip.startTime || 0) + nextKeyframe.time));
  }, [nextKeyframe, activeClip, onSeek]);

  const stepFrame = (frames: number) => {
    if (totalDuration <= 0) {
      onSeek(0);
      return;
    }
    const fps = 30;
    const nextTime = Math.max(
      0,
      Math.min(totalDuration, currentTime + frames / fps),
    );
    onSeek(nextTime);
  };

  const getItemDimsHelper = useCallback(
    (type: "text" | "sticker" | "video", clip: any) =>
      getItemBaseDimensions(type, clip, boxWidth, canvasHeight),
    [boxWidth, canvasHeight],
  );

  return (
    <View
      style={[
        styles.container,
        fullscreen && styles.containerFullscreen,
        Platform.OS === "web"
          ? ({
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
            } as any)
          : undefined,
      ]}
    >
      {/* Floating Exit Fullscreen Button */}
      {fullscreen && (
        <TouchableOpacity
          style={[
            styles.floatingExitBtn,
            isMobile && { paddingHorizontal: 9, paddingVertical: 9, borderRadius: 18 },
          ]}
          onPress={toggleFullscreen}
          activeOpacity={0.8}
          accessibilityLabel="Exit Fullscreen"
        >
          <Ionicons name="contract" size={15} color="#000000" />
          {!isMobile && <Text style={styles.floatingExitBtnText}>Exit Fullscreen</Text>}
        </TouchableOpacity>
      )}

      {/* CapCut Desktop Player Header Bar */}
      {!fullscreen && (
        <View style={styles.playerHeaderBar}>
          <View style={styles.playerHeaderTitleRow}>
            <Ionicons name="tv-outline" size={13} color={THEME_COLORS.textSecondary} />
            <Text style={styles.playerHeaderTitle}>Player</Text>
          </View>
          <Text style={styles.playerHeaderResolution}>
            {(() => {
              const [resW, resH] = getExportResolutionDimensions("1080p", project.aspectRatio);
              return `${resW} × ${resH} · ${project.fps || 30} fps`;
            })()}
          </Text>
        </View>
      )}

      {/* Canvas Viewport Area */}
      <View
        ref={viewportWrapperRef}
        style={styles.viewportWrapper}
        onLayout={handleViewportLayout}
      >
        <View
          ref={canvasBoxRef}
          style={[
            styles.canvasBox,
            {
              width: boxWidth,
              height: canvasHeight,
              aspectRatio: targetRatio,
              maxWidth: "100%",
              maxHeight: "100%",
              backgroundColor: effectiveCanvasBg,
            },
          ]}
        >
          {Platform.OS === "web" ? (
            <canvas
              ref={canvasRef as any}
              width={canvasBufferWidth}
              height={canvasBufferHeight}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                borderRadius: 8,
                backgroundColor: effectiveCanvasBg,
              }}
            />
          ) : (
            <>
              <PlayerNativeCompositor
                activeVideos={bufferedNativeVideos}
                activeAudios={bufferedNativeAudios}
                activeCaptions={activeCaptions}
                activeTexts={activeTexts}
                activeStickers={activeStickers}
                activeEffects={activeEffects}
                activeTransient={activeTransient}
                currentTime={currentTime}
                isPlaying={isPlaying}
                boxWidth={boxWidth}
                canvasHeight={canvasHeight}
                canvasBackground={project.canvasBackground}
                onSelectClip={onSelectClip}
                getItemBaseDimensions={getItemDimsHelper}
                getInterpolatedTransform={getInterpolatedTransform}
              />
            </>
          )}

          {/* Interactive On-Canvas Layer */}
          <View style={styles.interactiveCanvasLayer} pointerEvents="box-none">
            {isCroppingMode && targetCropClip ? (
              <PlayerCropOverlay
                cropPixelX={cropPixelX}
                cropPixelY={cropPixelY}
                cropPixelW={cropPixelW}
                cropPixelH={cropPixelH}
                cropBox={cropBox}
                cropPreset={cropPreset}
                mw={mw}
                mh={mh}
                handleCropDragStart={handleCropDragStart}
                cropResponders={cropResponders}
              />
            ) : isMaskingMode && targetMaskClip ? (
              <PlayerMaskOverlay
                targetClip={targetMaskClip}
                boxWidth={boxWidth}
                canvasHeight={canvasHeight}
                currentTime={currentTime}
                project={project}
                onUpdateClipMask={onUpdateClipMask}
                onTransientMaskUpdate={handleTransientMaskUpdate}
                onCloseMaskPreview={() => {
                  if (onToggleMaskPreview) onToggleMaskPreview(false);
                  setInternalMaskingMode(false);
                }}
                getInterpolatedTransform={getInterpolatedTransform}
                rendererRef={rendererRef}
                canvasBoxRef={canvasBoxRef}
              />
            ) : activeModal === "tracking" && targetTrackingClip ? (
              <PlayerTrackingReticle
                targetRect={
                  targetTrackingClip.motionTrack?.targetRect || {
                    x: 35,
                    y: 30,
                    width: 30,
                    height: 30,
                  }
                }
                onChangeTargetRect={(rect) => {
                  if (onUpdateClipMotionTrack) {
                    onUpdateClipMotionTrack({
                      enabled: targetTrackingClip.motionTrack?.enabled || false,
                      mode: "object_track",
                      ...(targetTrackingClip.motionTrack || {}),
                      targetRect: rect,
                    });
                  }
                }}
                boxWidth={boxWidth}
                canvasHeight={canvasHeight}
                isScanning={targetTrackingClip.motionTrack?.trackingStatus === "tracking"}
                isCompleted={
                  !!targetTrackingClip.motionTrack?.trajectory &&
                  targetTrackingClip.motionTrack.trajectory.length > 0
                }
              />
            ) : !isPlaying ? (
              <PlayerTransformOverlay
                selectedClipId={selectedClipId}
                activeVideos={activeVideos}
                activeCaptions={activeCaptions}
                activeTexts={activeTexts}
                activeStickers={activeStickers}
                activeTransformItem={activeTransformItem}
                boxWidth={boxWidth}
                canvasHeight={canvasHeight}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSelectClip={onSelectClip}
                onOpenEditModal={onOpenEditModal}
                onOpenMaskModal={onOpenMaskModal}
                onOpenAnimationModal={onOpenAnimationModal}
                onDuplicateClip={onDuplicateClip}
                onDeleteClip={onDeleteClip}
                handleEnterCropMode={handleEnterCropMode}
                handleStartDrag={handleStartDrag}
                canvasMultiTouchPanResponder={canvasMultiTouchPanResponder}
                nativeBoxPanResponder={nativeBoxPanResponder}
                nativeRotPanResponder={nativeRotPanResponder}
                scaleTLResponder={scaleTLResponder}
                scaleTRResponder={scaleTRResponder}
                scaleBLResponder={scaleBLResponder}
                scaleBRResponder={scaleBRResponder}
                getItemBaseDimensions={getItemDimsHelper}
                getInterpolatedTransform={getInterpolatedTransform}
              />
            ) : null}
          </View>

          {/* Processing / Status HUD Overlay */}
          {isProcessing && (
            <View style={styles.processingHUD} pointerEvents="none">
              <View
                style={[
                  styles.processingPill,
                  processingMessage?.includes("Noise Reduction On") &&
                    styles.processingPillDenoiseOn,
                ]}
              >
                {processingMessage?.includes("Noise Reduction On") ? (
                  <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                ) : processingMessage?.includes("Noise Reduction Off") ? (
                  <Ionicons name="volume-medium" size={13} color="#94A3B8" />
                ) : (
                  <ActivityIndicator size="small" color={THEME_COLORS.accent} />
                )}
                <Text
                  style={[
                    styles.processingText,
                    processingMessage?.includes("Noise Reduction On") && {
                      color: "#10B981",
                    },
                  ]}
                >
                  {processingMessage || "Processing..."}
                </Text>
              </View>
            </View>
          )}

          {/* Safe Zone Grid & Social UI Overlay */}
          {showSafeZone && (
            <View style={styles.safeZoneBox} pointerEvents="none">
              {/* Badge indicator */}
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  backgroundColor: "rgba(0, 0, 0, 0.75)",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: "rgba(0, 229, 201, 0.4)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  zIndex: 10,
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={10} color="#00E5C9" />
                <Text style={{ color: "#00E5C9", fontSize: 8.5, fontWeight: "700" }}>
                  SAFE ZONE ACTIVE
                </Text>
              </View>

              {/* 3x3 Rule of Thirds Grid */}
              <View style={styles.safeZoneLineHoriz} />
              <View style={styles.safeZoneLineVert} />

              {/* Center Magnetic Crosshairs */}
              <View
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: "rgba(0, 242, 254, 0.5)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: "rgba(0, 242, 254, 0.5)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 8,
                  height: 8,
                  marginLeft: -4,
                  marginTop: -4,
                  borderRadius: 4,
                  backgroundColor: "#00F2FE",
                }}
              />

              {/* Social Safe Zones: Header, Actions, Captions */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "12%",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(239, 68, 68, 0.4)",
                  backgroundColor: "rgba(239, 68, 68, 0.05)",
                  padding: 4,
                }}
              >
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 8, fontWeight: "700" }}>
                  TOP HEADER DANGER
                </Text>
              </View>

              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "20%",
                  borderTopWidth: 1,
                  borderTopColor: "rgba(239, 68, 68, 0.4)",
                  backgroundColor: "rgba(239, 68, 68, 0.05)",
                  padding: 4,
                }}
              >
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 8, fontWeight: "700" }}>
                  REELS / TIKTOK CAPTIONS DANGER
                </Text>
              </View>

              <View
                style={{
                  position: "absolute",
                  bottom: "20%",
                  right: 0,
                  width: "16%",
                  height: "45%",
                  borderLeftWidth: 1,
                  borderLeftColor: "rgba(239, 68, 68, 0.4)",
                  backgroundColor: "rgba(239, 68, 68, 0.04)",
                  padding: 4,
                }}
              >
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 7, fontWeight: "700" }}>
                  LIKE / SHARE
                </Text>
              </View>

              {/* HUD Badge */}
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  backgroundColor: "rgba(13, 14, 21, 0.9)",
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: "rgba(0, 242, 254, 0.4)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Ionicons name="shield-checkmark" size={10} color="#00F2FE" />
                <Text style={{ color: "#00F2FE", fontSize: 8, fontWeight: "800" }}>
                  SAFE ZONE HUD
                </Text>
              </View>
            </View>
          )}

          {/* Whole Player Reconnect & Relink Overlay */}
          {!isProjectEmpty && currentActiveClip && ((currentActiveClip as any).needsPermission || (currentActiveClip as any).isMissing) && (() => {
            const isMissing = Boolean((currentActiveClip as any).isMissing);
            const isUltraCompact = boxWidth < 220 || canvasHeight < 190;
            const isCompact = !isUltraCompact && (boxWidth < 300 || canvasHeight < 250);
            const isNarrowCard = boxWidth < 240;

            const iconCircleSize = isUltraCompact ? 28 : isCompact ? 36 : 46;
            const iconSize = isUltraCompact ? 14 : isCompact ? 18 : 22;
            const cardPadH = isUltraCompact ? 8 : isCompact ? 12 : 16;
            const cardPadV = isUltraCompact ? 8 : isCompact ? 10 : 14;

            const titleFontSize = isUltraCompact ? 11 : isCompact ? 12.5 : 14;
            const subTitleFontSize = isUltraCompact ? 9.5 : isCompact ? 10.5 : 11.5;
            const subTitleLines = isUltraCompact ? 1 : 2;

            const clipTitle = currentActiveClip.title || "Source file";
            const subTitleText = isUltraCompact
              ? (isMissing ? `"${clipTitle}" missing` : `"${clipTitle}" needs link`)
              : isCompact
                ? (isMissing ? `"${clipTitle}" was moved or removed.` : `"${clipTitle}" linked. Click to reconnect.`)
                : (isMissing
                    ? `"${clipTitle}" was moved or removed from its disk location.`
                    : `"${clipTitle}" is linked on your device. Click below to reconnect.`);

            return (
              <View style={styles.offlineMediaOverlay}>
                <View
                  style={[
                    styles.offlineMediaCard,
                    {
                      paddingHorizontal: cardPadH,
                      paddingVertical: cardPadV,
                      borderColor: isMissing ? "rgba(239, 68, 68, 0.35)" : "rgba(0, 242, 254, 0.28)",
                    },
                  ]}
                >
                  <View
                    style={{
                      width: iconCircleSize,
                      height: iconCircleSize,
                      borderRadius: iconCircleSize / 2,
                      backgroundColor: isMissing
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(0, 242, 254, 0.12)",
                      borderWidth: 1.5,
                      borderColor: isMissing
                        ? "rgba(239, 68, 68, 0.45)"
                        : "rgba(0, 242, 254, 0.4)",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: isUltraCompact ? 4 : isCompact ? 6 : 8,
                    }}
                  >
                    <Ionicons
                      name={isMissing ? "alert-circle" : "link-outline"}
                      size={iconSize}
                      color={isMissing ? "#EF4444" : "#00F2FE"}
                    />
                  </View>

                  <Text
                    style={[
                      styles.offlineMediaTitle,
                      { fontSize: titleFontSize },
                      !isMissing && { color: "#FFFFFF" },
                    ]}
                    numberOfLines={1}
                  >
                    {isMissing ? "Media Offline" : "Linked Media"}
                  </Text>

                  <Text
                    style={[
                      styles.offlineMediaSubtitle,
                      {
                        fontSize: subTitleFontSize,
                        marginTop: isUltraCompact ? 2 : 4,
                        lineHeight: subTitleFontSize * 1.35,
                      },
                    ]}
                    numberOfLines={subTitleLines}
                  >
                    {subTitleText}
                  </Text>

                  <View
                    style={{
                      flexDirection: isNarrowCard ? "column" : "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: isUltraCompact ? 5 : 6,
                      marginTop: isUltraCompact ? 6 : isCompact ? 8 : 12,
                      width: isNarrowCard ? "100%" : "auto",
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.relinkBtn,
                        isMissing && { backgroundColor: "#EF4444" },
                        isUltraCompact && { paddingHorizontal: 8, paddingVertical: 5 },
                        isNarrowCard && { width: "100%" },
                      ]}
                      activeOpacity={0.85}
                      onPress={handleRelinkActiveClip}
                    >
                      <Ionicons
                        name={isMissing ? "folder-open-outline" : "flash"}
                        size={isUltraCompact ? 11 : isCompact ? 12 : 14}
                        color={isMissing ? "#FFFFFF" : "#000000"}
                      />
                      <Text
                        style={[
                          styles.relinkBtnText,
                          isMissing && { color: "#FFFFFF" },
                          isUltraCompact && { fontSize: 10.5 },
                        ]}
                        numberOfLines={1}
                      >
                        {isMissing
                          ? (isUltraCompact ? "Relink" : "Relink File")
                          : (isUltraCompact ? "Reconnect" : "Reconnect Media")}
                      </Text>
                    </TouchableOpacity>

                    {!isMissing && (
                      <TouchableOpacity
                        style={[
                          styles.relinkSecondaryBtn,
                          isUltraCompact && { paddingHorizontal: 8, paddingVertical: 4.5 },
                          isNarrowCard && { width: "100%" },
                        ]}
                        activeOpacity={0.85}
                        onPress={handleChooseReplacementFile}
                      >
                        <Ionicons
                          name="folder-open-outline"
                          size={isUltraCompact ? 11 : isCompact ? 12 : 13}
                          color="#94A3B8"
                        />
                        <Text
                          style={[
                            styles.relinkSecondaryBtnText,
                            isUltraCompact && { fontSize: 10 },
                          ]}
                          numberOfLines={1}
                        >
                          {isUltraCompact ? "Browse" : "Choose File"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })()}

          {/* Empty State Overlay */}
          {isProjectEmpty && (
            <TouchableOpacity
              style={[
                styles.emptyCanvasOverlay,
                { backgroundColor: "transparent" },
              ]}
              activeOpacity={0.85}
              onPress={onOpenMediaPicker}
            >
              <View
                style={[
                  styles.emptyUploadCircle,
                  isLightBg && { backgroundColor: "rgba(0, 0, 0, 0.08)" },
                ]}
              >
                <Ionicons
                  name="film-outline"
                  size={32}
                  color={isLightBg ? THEME_COLORS.primaryDark : THEME_COLORS.accent}
                />
              </View>
              <Text
                style={[
                  styles.emptyCanvasTitle,
                  isLightBg && { color: "#0F172A" },
                ]}
              >
                No Media Added
              </Text>
              <Text
                style={[
                  styles.emptyCanvasSubtitle,
                  isLightBg && { color: "#64748B" },
                ]}
              >
                Import photos, videos, or pick from verified library
              </Text>
            </TouchableOpacity>
          )}

          {/* Floating Keyframe Action HUD Toast */}
          {kfToast && (
            <View style={styles.floatingKfToast} pointerEvents="none">
              <Ionicons
                name={kfToast.isAdd ? "diamond" : "diamond-outline"}
                size={14}
                color={kfToast.isAdd ? "#FFE600" : "#C2C9D6"}
              />
              <Text style={styles.floatingKfToastText}>{kfToast.text}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Control Bar beneath player OR on-preview crop bar card */}
      {isCroppingMode && activeModal !== "transform" ? (
        <PlayerCropBar
          cropPreset={cropPreset}
          isMobile={isMobile}
          onApplyPreset={handleApplyPresetCrop}
          onReset={handleResetCrop}
          onCancel={handleCancelCrop}
          onConfirm={handleConfirmCrop}
        />
      ) : (
        <PlayerControlsBar
          currentTime={currentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onSeek={onSeek}
          stepFrame={stepFrame}
          showSafeZone={showSafeZone}
          setShowSafeZone={setShowSafeZone}
          hasKeyframeAtCurrentTime={hasKeyframeAtCurrentTime}
          handleKeyframePress={handleKeyframePress}
          onOpenKeyframeModal={onOpenKeyframeModal}
          hasPrevKeyframe={hasPrevKeyframe}
          hasNextKeyframe={hasNextKeyframe}
          onJumpPrevKeyframe={handleJumpPrevKeyframe}
          onJumpNextKeyframe={handleJumpNextKeyframe}
          hasKeyframesOnClip={hasKeyframesOnClip}
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
          isMobile={isMobile}
        />
      )}
    </View>
  );
}

export default React.memo(Player);
