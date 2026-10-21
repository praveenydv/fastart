import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
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
import { PlayerNativeCompositor } from "./Player/PlayerNativeCompositor";
import { PlayerTransformOverlay } from "./Player/PlayerTransformOverlay";
import { usePlayerCropGestures } from "./Player/usePlayerCropGestures";
import { usePlayerTransformGestures } from "./Player/usePlayerTransformGestures";
import { usePlayerViewport } from "./Player/usePlayerViewport";
import { usePlayerWebRenderer } from "./Player/usePlayerWebRenderer";
import { usePlayerAudioSync } from "./Player/usePlayerAudioSync";
import { useActiveTransformItem } from "./Player/useActiveTransformItem";

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
  onDeleteClip,
  onDuplicateClip,
  onSplitClip,
  fullscreen: fullscreenProp,
  onToggleFullscreen,
  isCroppingPreview: isCroppingPreviewProp,
  onToggleCropPreview,
  onUpdateClipCrop,
}: PlayerProps) {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
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
  const activeVideos = useMemo(
    () =>
      (project.tracks.video || []).filter(
        (v) =>
          currentTime >= v.startTime && currentTime <= v.startTime + v.duration,
      ),
    [project.tracks.video, currentTime],
  );
  const activeEffects = useMemo(
    () =>
      (project.tracks.effects || []).filter(
        (e) =>
          currentTime >= e.startTime && currentTime <= e.startTime + e.duration,
      ),
    [project.tracks.effects, currentTime],
  );

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

  // Resolved Active Selected Transform Item
  const activeTransformItem = useActiveTransformItem({
    isCroppingMode,
    selectedClipId,
    selectedClipType,
    activeTexts,
    activeStickers,
    activeVideos,
    activeTransient,
    boxWidth,
    canvasHeight,
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
              backgroundColor: project.canvasBackground || "#000000",
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
              }}
            />
          ) : (
            <PlayerNativeCompositor
              activeVideos={activeVideos}
              activeTexts={activeTexts}
              activeStickers={activeStickers}
              activeEffects={activeEffects}
              activeTransient={activeTransient}
              currentTime={currentTime}
              isPlaying={isPlaying}
              boxWidth={boxWidth}
              canvasHeight={canvasHeight}
              onSelectClip={onSelectClip}
              getItemBaseDimensions={getItemDimsHelper}
              getInterpolatedTransform={getInterpolatedTransform}
            />
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
              />
            ) : (
              <PlayerTransformOverlay
                selectedClipId={selectedClipId}
                activeVideos={activeVideos}
                activeTexts={activeTexts}
                activeStickers={activeStickers}
                activeTransformItem={activeTransformItem}
                boxWidth={boxWidth}
                canvasHeight={canvasHeight}
                currentTime={currentTime}
                onSelectClip={onSelectClip}
                onOpenEditModal={onOpenEditModal}
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
            )}
          </View>

          {/* Safe Zone Grid Overlay */}
          {showSafeZone && (
            <View style={styles.safeZoneBox} pointerEvents="none">
              <View style={styles.safeZoneLineHoriz} />
              <View style={styles.safeZoneLineVert} />
            </View>
          )}

          {/* Empty State Overlay */}
          {isProjectEmpty && (
            <TouchableOpacity
              style={styles.emptyCanvasOverlay}
              activeOpacity={0.85}
              onPress={onOpenMediaPicker}
            >
              <View style={styles.emptyUploadCircle}>
                <Ionicons name="film-outline" size={32} color="#00F2FE" />
              </View>
              <Text style={styles.emptyCanvasTitle}>No Media Added</Text>
              <Text style={styles.emptyCanvasSubtitle}>
                Import photos, videos, or pick from verified library
              </Text>
              {/* <View style={styles.emptyActionRow}>
                <View style={styles.emptyUploadBtn}>
                  <Ionicons name="add" size={16} color="#000000" />
                  <Text style={styles.emptyUploadBtnText}>Add Media</Text>
                </View>
              </View> */}
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
      {isCroppingMode ? (
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
