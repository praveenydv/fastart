import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { View, Text, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { THEME_COLORS } from "../constants/designConstants";

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
  onUpdateClipMotionTrack,
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
  } = usePlayerViewport({ project, fullscreen });

  // Web VideoRenderer Canvas hook
  const { canvasRef, canvasBoxRef, rendererRef } = usePlayerWebRenderer({
    project,
    currentTime,
    isPlaying,
    boxWidth,
    canvasHeight,
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

  const activeCaptions = useMemo(
    () =>
      (project.tracks.captions || []).filter(
        (c) =>
          currentTime >= c.startTime && currentTime <= c.startTime + c.duration,
      ),
    [project.tracks.captions, currentTime],
  );
  const activeTexts = useMemo(
    () =>
      (project.tracks.text || []).filter(
        (t) =>
          currentTime >= t.startTime && currentTime <= t.startTime + t.duration,
      ),
    [project.tracks.text, currentTime],
  );
  const activeStickers = useMemo(
    () =>
      (project.tracks.stickers || []).filter(
        (s) =>
          currentTime >= s.startTime && currentTime <= s.startTime + s.duration,
      ),
    [project.tracks.stickers, currentTime],
  );
  // Visible active videos (strictly within active playback interval, used for transform & overlays)
  const activeVideos = useMemo(() => {
    const vids = project.tracks.video || [];
    return vids.filter((v) => {
      const start = v.startTime;
      const end = v.startTime + v.duration;
      // If another clip on the same track begins at this clip's end, make end boundary exclusive
      const hasAdjacentNext = vids.some(
        (other) =>
          other.id !== v.id &&
          (other.trackIndex || 0) === (v.trackIndex || 0) &&
          Math.abs(other.startTime - end) < 0.01,
      );
      if (hasAdjacentNext) {
        return currentTime >= start && currentTime < end;
      }
      return currentTime >= start && currentTime <= end;
    });
  }, [project.tracks.video, currentTime]);

  // Buffered native videos: includes 1.5s lookahead pre-warming without overlapping adjacent cut clips
  const bufferedNativeVideos = useMemo(() => {
    const list = project.tracks.video || [];
    if (list.length === 0) return [];
    const filtered = list.filter((v) => {
      const start = v.startTime;
      const end = v.startTime + v.duration;
      const hasAdjacentNext = list.some(
        (other) =>
          other.id !== v.id &&
          (other.trackIndex || 0) === (v.trackIndex || 0) &&
          Math.abs(other.startTime - end) < 0.01,
      );
      // 1. Actively inside playback
      if (hasAdjacentNext ? (currentTime >= start && currentTime < end) : (currentTime >= start && currentTime <= end)) return true;
      // 2. Pre-warm upcoming clip within 1.5s before its cut
      if (currentTime < start && start - currentTime <= 1.5) return true;
      // 3. Tail-hold recently finished clip ONLY if there is no adjacent next clip on this track
      if (!hasAdjacentNext && currentTime > end && currentTime - end <= 0.25) return true;
      return false;
    });
    return filtered.sort((a, b) => (a.trackIndex || 0) - (b.trackIndex || 0));
  }, [project.tracks.video, currentTime]);

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
    return [...trackEffs, ...clipEffs];
  }, [project.tracks.effects, activeVideos, currentTime]);

  const activeAudios = useMemo(
    () =>
      (project.tracks.audio || []).filter(
        (a) =>
          currentTime >= a.startTime && currentTime <= a.startTime + a.duration,
      ),
    [project.tracks.audio, currentTime],
  );

  // Buffered native audio tracks: includes 1.5s lookahead pre-warming
  const bufferedNativeAudios = useMemo(() => {
    const list = project.tracks.audio || [];
    if (list.length === 0) return [];
    return list.filter((a) => {
      const start = a.startTime;
      const end = a.startTime + a.duration;
      if (currentTime >= start && currentTime <= end) return true;
      if (currentTime < start && start - currentTime <= 1.5) return true;
      return false;
    });
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
          style={styles.floatingExitBtn}
          onPress={toggleFullscreen}
          activeOpacity={0.8}
        >
          <Ionicons name="contract" size={15} color="#000000" />
          <Text style={styles.floatingExitBtnText}>Exit Fullscreen</Text>
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
            {project.aspectRatio === "9:16"
              ? "1080 × 1920"
              : project.aspectRatio === "1:1"
                ? "1080 × 1080"
                : project.aspectRatio === "4:5"
                  ? "1080 × 1350"
                  : "1920 × 1080"} · 30 fps
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
              backgroundColor: effectiveCanvasBg,
            },
          ]}
        >
          {Platform.OS === "web" ? (
            <canvas
              ref={canvasRef as any}
              width={Math.round(
                canvasWidth *
                  (typeof window !== "undefined"
                    ? Math.min(
                        window.devicePixelRatio || 1,
                        isMobile ? 1.5 : 2.0,
                      )
                    : 1),
              )}
              height={Math.round(
                canvasHeight *
                  (typeof window !== "undefined"
                    ? Math.min(
                        window.devicePixelRatio || 1,
                        isMobile ? 1.5 : 2.0,
                      )
                    : 1),
              )}
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
                onCloseMaskPreview={() => {
                  if (onToggleMaskPreview) onToggleMaskPreview(false);
                  setInternalMaskingMode(false);
                }}
                getInterpolatedTransform={getInterpolatedTransform}
                rendererRef={rendererRef}
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
                onSelectClip={onSelectClip}
                onOpenEditModal={onOpenEditModal}
                onOpenMaskModal={onOpenMaskModal}
                onOpenAnimationModal={onOpenAnimationModal}
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

          {/* HUD Badge: Aspect Ratio */}
          <View style={styles.hudBadge}>
            <Text style={styles.hudText}>{project.aspectRatio}</Text>
          </View>

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
          stepFrame={stepFrame}
          showSafeZone={showSafeZone}
          setShowSafeZone={setShowSafeZone}
          hasKeyframeAtCurrentTime={hasKeyframeAtCurrentTime}
          handleKeyframePress={handleKeyframePress}
          onOpenKeyframeModal={onOpenKeyframeModal}
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
          isMobile={isMobile}
        />
      )}
    </View>
  );
}

export default React.memo(Player);
