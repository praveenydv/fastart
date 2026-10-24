import React from "react";
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../Header";
import Player from "../Player";
import Timeline from "../Timeline";
import Toolbar from "../Toolbar";
import { DesktopMediaAudioPanel } from "../Desktop/DesktopMediaAudioPanel";
import { INLINE_MODAL_KEYS } from "./EditorModals";
import { soundEngine } from "../../utils/audioEngine";
import { FastArtProject } from "../../types/project";

interface EditorWorkspaceProps {
  project: FastArtProject;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  totalDuration: number;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  selectedClipType: string;
  setSelectedClipType: (type: string) => void;
  selectedClip: any;
  zoom: number;
  setZoom: (z: number) => void;
  settings: any;
  isCroppingPreview: boolean;
  setIsCroppingPreview: (c: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  onBackToHome: () => void;
  onAddKeyframe: () => void;
  onOpenKeyframeModal: () => void;
  isKeyframeAtPlayhead: boolean;
  activeModal?: string | null;
  openModal: (modal: string) => void;
  updateProjectWithHistory: (updates: any) => void;
  handleUpdateClipTransform: (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal?: boolean,
  ) => void;
  handleUpdateClipCrop: (clipId: string, crop: any, isFinal?: boolean) => void;
  handleUpdateClipMask?: (clipId: string, mask: any, isFinal?: boolean) => void;
  handleSplitClip: () => void;
  handleDuplicateClip: (targetId?: string, targetType?: string) => void;
  handleDeleteClip: (targetId?: string, targetType?: string) => void;
  handleMoveClip: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects" | "caption",
    newStartTime: number,
    newTrackIndex?: number,
    isInsertNewTrack?: boolean,
  ) => void;
  handleTrimClip: (
    clipId: string,
    updates: {
      startTime?: number;
      duration?: number;
      trimIn?: number;
      trimOut?: number;
      trackIndex?: number;
    },
    isFinal?: boolean,
  ) => void;
  handleRotateClip: () => void;
  handleToggleReverse: () => void;
  handleOpenTransitionsModal: (clipId: string) => void;
  handleDeselectClip: () => void;
  handleOpenSpeedModal: () => void;
  handleOpenVolumeModal: () => void;
  handleOpenCropModal: () => void;
  handleOpenTransformModal?: (tab?: 'crop' | 'flip' | 'rotate' | 'stretch' | 'angle') => void;
  handleOpenMaskModal: () => void;
  handleOpenAudioModal: () => void;
  handleOpenTextModal: () => void;
  handleOpenFiltersModal: () => void;
  handleOpenEffectsModal: () => void;
  handleOpenStickersModal: () => void;
  handleOpenMediaPicker: () => void;
  handleOpenTTS: () => void;
  handleOpenEnhance: () => void;
  handleOpenAutoCut: () => void;
  handleOpenCanvasModal: () => void;
  handleOpenBackgroundModal?: () => void;
  handleOpenCutoutModal: (mode?: 'auto' | 'chroma') => void;
  handleOpenMotionTracking: () => void;
  handleOpenAutoCaptions: () => void;
  handleToggleDenoise?: () => void;
  handleExtractAudio?: () => void;
  isProcessing?: boolean;
  processingMessage?: string;
  renderModals?: (isInline?: boolean) => React.ReactNode;
  handleAddMedia?: (clip: any) => void;
  handleAddAudio?: (clip: any) => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  project,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  totalDuration,
  isFullscreen,
  setIsFullscreen,
  selectedClipId,
  setSelectedClipId,
  selectedClipType,
  setSelectedClipType,
  selectedClip,
  zoom,
  setZoom,
  settings,
  isCroppingPreview,
  setIsCroppingPreview,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
  onBackToHome,
  onAddKeyframe,
  onOpenKeyframeModal,
  isKeyframeAtPlayhead,
  activeModal,
  openModal,
  updateProjectWithHistory,
  handleUpdateClipTransform,
  handleUpdateClipCrop,
  handleUpdateClipMask,
  handleSplitClip,
  handleDuplicateClip,
  handleDeleteClip,
  handleMoveClip,
  handleTrimClip,
  handleRotateClip,
  handleToggleReverse,
  handleOpenTransitionsModal,
  handleDeselectClip,
  isProcessing,
  processingMessage,
  handleOpenSpeedModal,
  handleOpenVolumeModal,
  handleOpenCropModal,
  handleOpenTransformModal,
  handleOpenMaskModal,
  handleOpenAudioModal,
  handleOpenTextModal,
  handleOpenFiltersModal,
  handleOpenEffectsModal,
  handleOpenStickersModal,
  handleOpenMediaPicker,
  handleOpenTTS,
  handleOpenEnhance,
  handleOpenAutoCut,
  handleOpenCanvasModal,
  handleOpenBackgroundModal,
  handleOpenCutoutModal,
  handleOpenMotionTracking,
  handleOpenAutoCaptions,
  handleToggleDenoise,
  handleExtractAudio,
  renderModals,
  handleAddMedia,
  handleAddAudio,
}) => {
  const handleOpenEditModal = React.useCallback(
    (clipId: string, clipType?: string) => {
      soundEngine.playSfx("click");
      setSelectedClipId(clipId);
      let resolvedType = clipType || selectedClipType;
      if (!resolvedType && project) {
        if (project.tracks.captions?.some((c) => c.id === clipId)) resolvedType = "caption";
        else if (project.tracks.text?.some((c) => c.id === clipId)) resolvedType = "text";
        else if (project.tracks.stickers?.some((c) => c.id === clipId)) resolvedType = "stickers";
        else if (project.tracks.video?.some((c) => c.id === clipId)) resolvedType = "video";
        else if (project.tracks.audio?.some((c) => c.id === clipId)) resolvedType = "audio";
        else if (project.tracks.effects?.some((c) => c.id === clipId)) resolvedType = "effects";
      }

      const normalizedType =
        resolvedType === "caption" || resolvedType === "captions"
          ? "caption"
          : resolvedType === "sticker" || resolvedType === "stickers"
            ? "stickers"
            : resolvedType === "effect" || resolvedType === "effects"
              ? "effects"
              : resolvedType;

      setSelectedClipType(normalizedType);

      if (normalizedType === "caption" || normalizedType === "captions") {
        openModal("captions");
      } else if (normalizedType === "text") {
        openModal("text");
      } else if (normalizedType === "stickers") {
        openModal("stickers");
      } else if (normalizedType === "audio") {
        openModal("volume");
      } else if (normalizedType === "effects") {
        openModal("effects");
      } else if (normalizedType === "video") {
        setIsCroppingPreview(true);
      }
    },
    [project, selectedClipType, setSelectedClipId, setSelectedClipType, openModal, setIsCroppingPreview, handleOpenAutoCaptions]
  );

  const handleApplyFilter = React.useCallback(
    (filter: string, intensity?: number) => {
      if (!selectedClipId || !project) return;
      const safeIntensity = intensity ?? 80;
      const updatedVideos = (project.tracks?.video || []).map((c: any) =>
        c.id === selectedClipId
          ? { ...c, filter, filterIntensity: safeIntensity }
          : c
      );
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          video: updatedVideos,
        },
      });
    },
    [project, selectedClipId, updateProjectWithHistory]
  );

  const handleApplySpeed = React.useCallback(
    (speed: number, curve?: string, pitch?: boolean) => {
      if (!selectedClipId || !project) return;
      const updatedVideos = (project.tracks?.video || []).map((c: any) =>
        c.id === selectedClipId
          ? { ...c, speed, speedCurve: curve, keepPitch: pitch }
          : c
      );
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          video: updatedVideos,
        },
      });
    },
    [project, selectedClipId, updateProjectWithHistory]
  );

  const handleApplyVolume = React.useCallback(
    (volume: number, fade?: { in: number; out: number }) => {
      if (!selectedClipId || !project) return;
      const updatedVideos = (project.tracks?.video || []).map((c: any) =>
        c.id === selectedClipId
          ? { ...c, volume, fadeIn: fade?.in, fadeOut: fade?.out }
          : c
      );
      const updatedAudios = (project.tracks?.audio || []).map((c: any) =>
        c.id === selectedClipId
          ? { ...c, volume, fadeIn: fade?.in, fadeOut: fade?.out }
          : c
      );
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          video: updatedVideos,
          audio: updatedAudios,
        },
      });
    },
    [project, selectedClipId, updateProjectWithHistory]
  );

  const handleAddText = React.useCallback(
    (text: string, color: string) => {
      if (!project) return;
      const newText = {
        id: `text_${Date.now()}`,
        text: text || "Sample Text",
        startTime: currentTime,
        duration: 3,
        trackIndex: 2,
        color: color || "#FFFFFF",
      };
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          text: [...(project.tracks?.text || []), newText],
        },
      });
    },
    [currentTime, project, updateProjectWithHistory]
  );

  const handleAddSticker = React.useCallback(
    (char: string) => {
      if (!project) return;
      const newSticker = {
        id: `stk_${Date.now()}`,
        char: char || "🔥",
        startTime: currentTime,
        duration: 3,
        trackIndex: 3,
      };
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          stickers: [...(project.tracks?.stickers || []), newSticker],
        },
      });
    },
    [currentTime, project, updateProjectWithHistory]
  );

  const handleAddEffect = React.useCallback(
    (name: string) => {
      if (!project) return;
      const newEffect = {
        id: `fx_${Date.now()}`,
        name: name || "Glitch",
        startTime: currentTime,
        duration: 3,
        trackIndex: 4,
      };
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          effects: [...(project.tracks?.effects || []), newEffect],
        },
      });
    },
    [currentTime, project, updateProjectWithHistory]
  );

  // Determine platform layout
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== "undefined" ? window.innerWidth : 800
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isDesktop = windowWidth >= 768;

  // Desktop: track which left-panel tab is open
  const [desktopTab, setDesktopTab] = React.useState<'media' | 'audio'>('media');
  const [isMediaPanelCollapsed, setIsMediaPanelCollapsed] = React.useState(false);

  const hasDesktopRightPanel = isDesktop && !!activeModal && INLINE_MODAL_KEYS.has(activeModal);
  const isMobileInlineActive = !isDesktop && !!activeModal && INLINE_MODAL_KEYS.has(activeModal);

  // Unified Toolbar renderer (horizontal at bottom for mobile, vertical on whole left for laptop)
  const renderToolbar = (orientation: "horizontal" | "vertical" = "horizontal") => (
    <Toolbar
      orientation={orientation}
      selectedClip={selectedClip}
      selectedClipType={selectedClipType}
      onDeselectClip={handleDeselectClip}
      onSelectMainClip={() => {
        if (project?.tracks?.video && project.tracks.video.length > 0) {
          const cur = currentTime || 0;
          const target =
            project.tracks.video.find((c) => cur >= c.startTime && cur <= c.startTime + c.duration) ||
            project.tracks.video[0];
          if (target) {
            setSelectedClipId(target.id);
            setSelectedClipType("video");
          }
        }
      }}
      onSplitClip={handleSplitClip}
      onDeleteClip={handleDeleteClip}
      onDuplicateClip={handleDuplicateClip}
      onMoveClip={handleMoveClip}
      onRotateClip={handleRotateClip}
      onToggleReverse={handleToggleReverse}
      onOpenSpeedModal={handleOpenSpeedModal}
      onOpenVolumeModal={handleOpenVolumeModal}
      onOpenCropModal={handleOpenCropModal}
      onOpenTransformModal={handleOpenTransformModal}
      onOpenMaskModal={handleOpenMaskModal}
      onOpenAudioModal={handleOpenAudioModal}
      onOpenTextModal={handleOpenTextModal}
      onOpenFiltersModal={handleOpenFiltersModal}
      onOpenEffectsModal={handleOpenEffectsModal}
      onOpenStickersModal={handleOpenStickersModal}
      onOpenMediaPicker={handleOpenMediaPicker}
      onOpenTTS={handleOpenTTS}
      onOpenEnhance={handleOpenEnhance}
      onOpenAutoCut={handleOpenAutoCut}
      onOpenCanvasModal={handleOpenCanvasModal}
      onOpenBackgroundModal={handleOpenBackgroundModal || (() => openModal("background"))}
      onOpenCutoutModal={handleOpenCutoutModal}
      onOpenMotionTracking={handleOpenMotionTracking}
      onOpenKeyframeModal={onOpenKeyframeModal}
      onOpenAutoCaptions={handleOpenAutoCaptions}
      onToggleDenoise={handleToggleDenoise}
      onExtractAudio={handleExtractAudio}
      project={project}
      onApplyFilter={handleApplyFilter}
      onApplySpeed={handleApplySpeed}
      onApplyVolume={handleApplyVolume}
      onApplyRatio={(ratio) => updateProjectWithHistory({ ...project, aspectRatio: ratio })}
      onApplyCanvasBg={(bg) => updateProjectWithHistory({ ...project, canvasBackground: bg })}
      onAddText={(txt, col) => handleAddText(txt, col)}
      onAddSticker={(stk) => handleAddSticker(stk)}
      onAddEffect={(eff) => handleAddEffect(eff)}
      onSelectDesktopTab={(tab) => {
        setDesktopTab(tab);
        setIsMediaPanelCollapsed(false);
      }}
      onOpenLayerModal={() => openModal("layer")}
      onOpenOpacityModal={() => openModal("opacity")}
      onOpenAnimationModal={() => openModal("animation")}
      onOpenAudioEffectsModal={() => openModal("audio_effects")}
    />
  );

  // Build the multi-track timeline
  const renderTimelineOnly = () => (
    <Timeline
      project={project}
      currentTime={currentTime}
      totalDuration={totalDuration}
      isPlaying={isPlaying}
      onSeek={(t) => setCurrentTime(t)}
      selectedClipId={selectedClipId}
      selectedClipType={selectedClipType}
      onSelectClip={(id, type) => {
        setSelectedClipId(id);
        if (type) setSelectedClipType(type);
      }}
      onTrimClip={handleTrimClip}
      onMoveClip={handleMoveClip}
      onOpenTransitions={handleOpenTransitionsModal}
      onOpenMediaPicker={() => openModal("media")}
      onOpenTextModal={() => openModal("text")}
      onOpenAudioModal={() => openModal("audio")}
      onOpenEffectsModal={() => openModal("effects")}
      onOpenStickersModal={() => openModal("stickers")}
      zoom={zoom}
      onZoomChange={(newZoom) => setZoom(newZoom)}
      onAdjustDuration={(delta) => {
        if (!selectedClipId) return;
        const key =
          selectedClipType === "caption" || selectedClipType === "captions"
            ? "captions"
            : selectedClipType === "sticker" || selectedClipType === "stickers"
              ? "stickers"
              : selectedClipType;
        const list = [...((project.tracks as any)[key] || [])];
        const idx = list.findIndex((c: any) => c.id === selectedClipId);
        if (idx >= 0) {
          const newDur = Math.max(0.05, (list[idx].duration || 0) + delta);
          list[idx] = { ...list[idx], duration: Number(newDur.toFixed(3)) };
          updateProjectWithHistory({ ...project, tracks: { ...project.tracks, [key]: list } as any });
        }
      }}
      onUpdateProject={updateProjectWithHistory}
      onSplitClip={handleSplitClip}
      onDuplicateClip={handleDuplicateClip}
      onDeleteClip={handleDeleteClip}
      onOpenEditModal={handleOpenEditModal}
      onAddMedia={(clip) => {
        if (handleAddMedia) handleAddMedia(clip);
        else {
          const videos = [...(project.tracks?.video || []), clip];
          updateProjectWithHistory({
            ...project,
            tracks: { ...project.tracks, video: videos },
          });
        }
      }}
      onAddAudio={(clip) => {
        if (handleAddAudio) handleAddAudio(clip);
        else {
          const audios = [...(project.tracks?.audio || []), clip];
          updateProjectWithHistory({
            ...project,
            tracks: { ...project.tracks, audio: audios },
          });
        }
      }}
    />
  );

  // Player JSX shared between desktop and mobile
  const renderPlayer = () => (
    <Player
      project={project}
      currentTime={currentTime}
      isPlaying={isPlaying}
      totalDuration={totalDuration}
      fullscreen={isFullscreen}
      isProcessing={isProcessing}
      processingMessage={processingMessage}
      onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
      onTogglePlay={() => {
        if (totalDuration <= 0) {
          soundEngine.playSfx("click");
          setIsPlaying(false);
          setCurrentTime(0);
          return;
        }
        soundEngine.playSfx("click");
        if (!isPlaying && (currentTime >= totalDuration - 0.05 || currentTime >= totalDuration)) {
          setCurrentTime(0);
        }
        setIsPlaying(!isPlaying);
      }}
      onSeek={(t) => setCurrentTime(t)}
      onAddKeyframe={onAddKeyframe}
      onOpenKeyframeModal={onOpenKeyframeModal}
      hasKeyframeAtCurrentTime={isKeyframeAtPlayhead}
      onOpenMediaPicker={() => openModal("media")}
      selectedClipId={selectedClipId}
      selectedClipType={selectedClipType}
      onSelectClip={(id, type) => {
        setSelectedClipId(id);
        if (type) setSelectedClipType(type);
      }}
      onUpdateClipTransform={handleUpdateClipTransform}
      onOpenEditModal={handleOpenEditModal}
      onDeleteClip={(clipId, clipType) => {
        soundEngine.playSfx("click");
        handleDeleteClip(clipId, clipType);
      }}
      onDuplicateClip={(clipId, clipType) => {
        soundEngine.playSfx("click");
        handleDuplicateClip(clipId, clipType);
      }}
      onSplitClip={handleSplitClip}
      onOpenCropModal={handleOpenCropModal}
      onOpenMaskModal={handleOpenMaskModal}
      isCroppingPreview={isCroppingPreview}
      onToggleCropPreview={setIsCroppingPreview}
      onUpdateClipCrop={handleUpdateClipCrop}
      isMaskingPreview={activeModal === "mask"}
      onUpdateClipMask={handleUpdateClipMask}
    />
  );

  // ─────────────────────────────────────────────
  // DESKTOP LAYOUT (Full-Height Sidebar on Left, Top: Media -> Player -> Selected Menu Config, Bottom: Tracks)
  // ─────────────────────────────────────────────
  if (isDesktop && !isFullscreen) {
    return (
      <View style={styles.desktopContainer}>
        {/* Full-Height Left Sidebar: Vertical Toolbar with main menu / sub-menu */}
        <View style={styles.desktopSidebarArea}>
          {renderToolbar("vertical")}
        </View>

        {/* Right Content Column: Split into Top Area (Media, Player, Config) and Bottom Area (Timeline) */}
        <View style={styles.desktopContentArea}>
          {/* Top Header Bar */}
          <Header
            project={project}
            onUpdateProject={updateProjectWithHistory}
            onBackToHome={onBackToHome}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onOpenExport={onOpenExport}
            onOpenCanvasModal={handleOpenCanvasModal}
            hideBackButton={true}
          />

          {/* Top side: [Media / Audio] -> [Player] -> [Selected Menu Configuration] */}
          <View style={styles.desktopPlayerRow}>
            {/* 1. Left of player: Uploaded Media & Audio options */}
            <DesktopMediaAudioPanel
              project={project}
              activeTab={desktopTab}
              onSelectTab={(tab) => setDesktopTab(tab)}
              onAddMedia={(clip) => {
                if (handleAddMedia) handleAddMedia(clip);
                else {
                  const videos = [...(project.tracks?.video || []), clip];
                  updateProjectWithHistory({
                    ...project,
                    tracks: { ...project.tracks, video: videos },
                  });
                }
              }}
              onAddAudio={(clip) => {
                if (handleAddAudio) handleAddAudio(clip);
                else {
                  const audios = [...(project.tracks?.audio || []), clip];
                  updateProjectWithHistory({
                    ...project,
                    tracks: { ...project.tracks, audio: audios },
                  });
                }
              }}
              currentTime={currentTime}
              isCollapsed={isMediaPanelCollapsed}
              onToggleCollapse={() => setIsMediaPanelCollapsed((prev) => !prev)}
            />

            {/* 2. Center: Player Canvas */}
            <View style={styles.desktopPlayerArea}>
              {renderPlayer()}
            </View>

            {/* 3. Right of player: Selected menu configuration (when any tool modal is active) */}
            {hasDesktopRightPanel && (
              <View style={styles.desktopRightPanel}>
                <View style={styles.desktopRightPanelHeader}>
                  <Text style={styles.desktopRightPanelTitle}>
                    {activeModal === "filters" && "🎨 Filters & LUTs"}
                    {activeModal === "transform" && "⚙️ Transform & Crop"}
                    {activeModal === "mask" && "🔶 Shape Mask"}
                    {activeModal === "speed" && "⚡ Speed & Velocity"}
                    {activeModal === "volume" && "🔊 Volume & Audio"}
                    {activeModal === "text" && "✏️ Text & Titles"}
                    {activeModal === "stickers" && "🎭 Stickers & Badges"}
                    {activeModal === "effects" && "✨ Visual Effects"}
                    {activeModal === "captions" && "💬 Speech Captions"}
                    {activeModal === "transitions" && "↔️ Transitions"}
                    {activeModal === "enhance" && "💎 AI Enhance"}
                    {activeModal === "autocut" && "✂️ Auto Cut"}
                    {activeModal === "canvas" && "📐 Canvas Ratio"}
                    {activeModal === "background" && "🖼️ Background"}
                    {activeModal === "keyframe" && "◆ Keyframes"}
                    {activeModal === "tts" && "🗣️ Text to Speech"}
                    {activeModal === "cutout" && "✂️ Cutout & Chroma"}
                    {activeModal === "tracking" && "🎯 Motion Tracking"}
                    {activeModal === "layer" && "📑 Layer & Track Order"}
                    {activeModal === "opacity" && "👁️ Clip Opacity"}
                    {activeModal === "animation" && "🎬 Animation Presets"}
                    {activeModal === "audio_effects" && "🎙️ Voice & Audio Effects"}
                  </Text>
                  <TouchableOpacity
                    style={styles.desktopRightPanelClose}
                    onPress={() => openModal("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={16} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                {/* Inline modal content rendered live */}
                <View style={styles.desktopRightPanelContent}>
                  {renderModals ? renderModals(true) : null}
                </View>
              </View>
            )}
          </View>

          {/* Bottom side: Multi-Track Timeline taking remaining width */}
          <View style={styles.desktopTimelineArea}>
            {renderTimelineOnly()}
          </View>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // MOBILE / FULLSCREEN LAYOUT
  // Top: Player, Below: Timeline OR Selected menu config, Bottom: Menus
  // ─────────────────────────────────────────────
  return (
    <View style={styles.editorContainer}>
      {/* Top Header Bar */}
      {!isFullscreen && (
        <Header
          project={project}
          onUpdateProject={updateProjectWithHistory}
          onBackToHome={onBackToHome}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onOpenExport={onOpenExport}
          onOpenCanvasModal={handleOpenCanvasModal}
        />
      )}

      {/* Top: Canvas Viewport & Player Controls (clearly visible so user sees what is applying live!) */}
      <View
        style={[
          styles.playerStage,
          isFullscreen && styles.playerStageFullscreen,
        ]}
      >
        {renderPlayer()}
      </View>

      {/* Below Player: Timeline OR Selected menu configuration */}
      {!isFullscreen && (
        <View style={styles.mobileBottomArea}>
          {isMobileInlineActive ? (
            <View style={styles.mobileInlineConfigArea}>
              {renderModals ? renderModals(true) : null}
            </View>
          ) : (
            <View style={styles.mobileTimelineArea}>
              {renderTimelineOnly()}
            </View>
          )}

          {/* Bottom: Menus bar */}
          {renderToolbar("horizontal")}
        </View>
      )}
    </View>
  );
};
const styles = StyleSheet.create({
  editorContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    backgroundColor: "#000000",
    overflow: "hidden" as any,
  },

  // ── Desktop Layout ──
  desktopContainer: {
    flex: 1,
    flexDirection: "row" as const,
    backgroundColor: "#000000",
    overflow: "hidden" as any,
    width: "100%",
    height: "100%",
  },
  desktopSidebarArea: {
    flexDirection: "row" as const,
    height: "100%",
    flexShrink: 0,
    zIndex: 25,
  },
  desktopContentArea: {
    flex: 1,
    flexDirection: "column" as const,
    height: "100%",
    overflow: "hidden" as any,
    minWidth: 0,
  },
  desktopPlayerRow: {
    flex: 1,
    flexDirection: "row" as const,
    overflow: "hidden" as any,
    minHeight: 0,
  },
  desktopMainRow: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden" as any,
  },
  desktopLeftNav: {
    width: 64,
    backgroundColor: "#0A0B0E",
    borderRightWidth: 1,
    borderRightColor: "#1A1B22",
    paddingVertical: 6,
    alignItems: "center",
    overflowY: "auto" as any,
  } as any,
  desktopNavItemWrap: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginBottom: 2,
  },
  desktopNavActiveBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 2.5,
    backgroundColor: "#00F2FE",
    borderRadius: 1.5,
    zIndex: 2,
  },
  desktopNavItem: {
    width: 56,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: "center",
    cursor: "pointer" as any,
  } as any,
  desktopNavItemActive: {
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  desktopNavIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  desktopNavLabel: {
    color: "#71717A",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  desktopNavLabelActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  desktopMediaPanel: {
    width: 240,
    backgroundColor: "#0E0F14",
    borderRightWidth: 1,
    borderRightColor: "#1A1B22",
    display: "flex",
    flexDirection: "column",
    overflowY: "hidden" as any,
  } as any,
  desktopCollapsedPanel: {
    width: 18,
    backgroundColor: "#0A0B0E",
    borderRightWidth: 1,
    borderRightColor: "#1A1B22",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  } as any,
  desktopPanelTabBar: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1B22",
    paddingHorizontal: 8,
    gap: 4,
    backgroundColor: "#09090C",
  },
  desktopPanelTab: {
    flex: 1,
    height: 30,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer" as any,
  } as any,
  desktopPanelTabActive: {
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  desktopPanelTabText: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "600",
  },
  desktopPanelTabTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  desktopPanelCollapseBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  } as any,
  desktopPanelBody: {
    flex: 1,
    padding: 10,
    overflowY: "auto" as any,
  } as any,
  desktopImportBtn: {
    borderWidth: 1.5,
    borderStyle: "dashed" as any,
    borderColor: "rgba(0,242,254,0.35)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    alignItems: "center",
    cursor: "pointer" as any,
  } as any,
  desktopImportBtnText: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "700",
  },
  desktopImportBtnSub: {
    color: "#52525B",
    fontSize: 10,
    marginTop: 3,
  },
  desktopPanelSectionTitle: {
    color: "#3F3F46",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  desktopEmptyState: {
    paddingVertical: 24,
    alignItems: "center",
  },
  desktopEmptyStateIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  desktopEmptyStateText: {
    color: "#52525B",
    fontSize: 12,
    fontWeight: "600",
  },
  desktopEmptyStateSub: {
    color: "#3F3F46",
    fontSize: 10,
    marginTop: 4,
  },
  desktopClipRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181C",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272F",
    padding: 8,
    marginBottom: 6,
  },
  desktopClipThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#09090C",
    alignItems: "center",
    justifyContent: "center",
  },
  desktopClipTitle: {
    color: "#E4E4E7",
    fontSize: 11,
    fontWeight: "600",
  },
  desktopClipMeta: {
    color: "#71717A",
    fontSize: 9.5,
    marginTop: 2,
  },
  desktopPlayerArea: {
    flex: 1,
    backgroundColor: "#000000",
    overflow: "hidden" as any,
    minWidth: 0,
  } as any,
  desktopRightPanel: {
    width: 310,
    backgroundColor: "#0E0F14",
    borderLeftWidth: 1,
    borderLeftColor: "#1A1B22",
    display: "flex",
    flexDirection: "column",
    overflowY: "hidden" as any,
  } as any,
  desktopRightPanelHeader: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1B22",
    backgroundColor: "#09090C",
  },
  desktopRightPanelTitle: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "700",
  },
  desktopRightPanelClose: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  } as any,
  desktopRightPanelContent: {
    flex: 1,
    overflowY: "auto" as any,
  } as any,

  desktopTimelineArea: {
    width: "100%",
    flexShrink: 0,
    backgroundColor: "#000000",
  },

  // ── Mobile / Shared Layout ──
  playerStage: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden" as any,
    backgroundColor: "#000000",
  },
  playerStageFullscreen: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },
  mobileBottomArea: {
    width: "100%",
    flexShrink: 0,
    backgroundColor: "#000000",
  },
  mobileInlineConfigArea: {
    height: 310,
    width: "100%",
    backgroundColor: "#121215",
    borderTopWidth: 1,
    borderTopColor: "#1A1B22",
    overflow: "hidden" as any,
  },
  mobileTimelineArea: {
    width: "100%",
  },
  bottomDock: {
    width: "100%",
    flexShrink: 0,
    backgroundColor: "#000000",
  },
});

