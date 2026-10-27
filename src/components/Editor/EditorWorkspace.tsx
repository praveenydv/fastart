import React from "react";
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
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

  const resolveActiveClipId = React.useCallback(
    (type: "video" | "audio" = "video") => {
      if (selectedClipId) return selectedClipId;
      if (!project) return null;
      const cur = currentTime || 0;
      if (type === "audio") {
        const audio =
          project.tracks?.audio?.find((c: any) => cur >= c.startTime && cur <= c.startTime + c.duration) ||
          project.tracks?.audio?.[0];
        if (audio) {
          setSelectedClipId(audio.id);
          setSelectedClipType("audio");
          return audio.id;
        }
      }
      const video =
        project.tracks?.video?.find((c: any) => cur >= c.startTime && cur <= c.startTime + c.duration) ||
        project.tracks?.video?.[0];
      if (video) {
        setSelectedClipId(video.id);
        setSelectedClipType("video");
        return video.id;
      }
      return null;
    },
    [project, selectedClipId, currentTime, setSelectedClipId, setSelectedClipType]
  );

  const handleApplyFilter = React.useCallback(
    (filter: string, intensity?: number) => {
      const targetId = resolveActiveClipId("video");
      if (!targetId || !project) return;
      const safeIntensity = intensity ?? 80;
      const updatedVideos = (project.tracks?.video || []).map((c: any) =>
        c.id === targetId
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
    [project, resolveActiveClipId, updateProjectWithHistory]
  );

  const handleApplySpeed = React.useCallback(
    (speed: number, curve?: string, pitch?: boolean) => {
      const targetId = resolveActiveClipId("video");
      if (!targetId || !project) return;
      const updatedVideos = (project.tracks?.video || []).map((c: any) =>
        c.id === targetId
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
    [project, resolveActiveClipId, updateProjectWithHistory]
  );

  const handleApplyVolume = React.useCallback(
    (volume: number, fade?: { in: number; out: number }) => {
      const targetId = resolveActiveClipId(selectedClipType === "audio" ? "audio" : "video");
      if (!targetId || !project) return;
      const updatedVideos = (project.tracks?.video || []).map((c: any) =>
        c.id === targetId
          ? { ...c, volume, fadeIn: fade?.in, fadeOut: fade?.out }
          : c
      );
      const updatedAudios = (project.tracks?.audio || []).map((c: any) =>
        c.id === targetId
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
    [project, selectedClipType, resolveActiveClipId, updateProjectWithHistory]
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
  const [isConfigPanelExpanded, setIsConfigPanelExpanded] = React.useState(true);
  const [configPanelWidth, setConfigPanelWidth] = React.useState(280);
  const [mediaPanelWidth, setMediaPanelWidth] = React.useState(250);
  const [desktopPanelOrder, setDesktopPanelOrder] = React.useState<'config_left' | 'media_left'>('config_left');

  const handleConfigResizeStart = React.useCallback((e: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const startX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const startWidth = configPanelWidth;

    const onMove = (moveEv: any) => {
      const currentX = moveEv.clientX || (moveEv.touches && moveEv.touches[0]?.clientX) || 0;
      const delta = desktopPanelOrder === 'config_left' ? (currentX - startX) : (startX - currentX);
      const nextW = Math.max(220, Math.min(520, startWidth + delta));
      setConfigPanelWidth(nextW);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  }, [configPanelWidth, desktopPanelOrder]);

  const handleMediaResizeStart = React.useCallback((e: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const startX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const startWidth = mediaPanelWidth;

    const onMove = (moveEv: any) => {
      const currentX = moveEv.clientX || (moveEv.touches && moveEv.touches[0]?.clientX) || 0;
      const delta = desktopPanelOrder === 'config_left' ? (startX - currentX) : (currentX - startX);
      const nextW = Math.max(200, Math.min(520, startWidth + delta));
      setMediaPanelWidth(nextW);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  }, [mediaPanelWidth, desktopPanelOrder]);

  const hasDesktopRightPanel = isDesktop && !!activeModal && INLINE_MODAL_KEYS.has(activeModal);
  const isMobileInlineActive = !isDesktop && !!activeModal && INLINE_MODAL_KEYS.has(activeModal);

  // Label for active config panel
  const getConfigPanelTitle = () => {
    const TITLES: Record<string, string> = {
      filters: '🎨 Filters & LUTs', transform: '⚙️ Transform', mask: '🔶 Mask',
      speed: '⚡ Speed', volume: '🔊 Volume & Fade', text: '✏️ Text', stickers: '🎭 Stickers',
      effects: '✨ Effects', captions: '💬 Captions', transitions: '↔️ Transitions',
      enhance: '💎 AI Enhance', autocut: '✂️ AutoCut', canvas: '📐 Canvas', background: '🖼️ Background',
      keyframe: '◆ Keyframe', tts: '🗣️ Text to Speech', cutout: '✂️ Cutout', tracking: '🎯 Tracking',
      layer: '📑 Layer Order', opacity: '👁️ Opacity', animation: '🎬 Animation', audio_effects: '🎙️ Audio FX',
    };
    return activeModal ? (TITLES[activeModal] || activeModal) : '';
  };
  // Auto-expand config panel when switching tools
  React.useEffect(() => {
    if (activeModal && INLINE_MODAL_KEYS.has(activeModal)) {
      setIsConfigPanelExpanded(true);
    }
  }, [activeModal]);

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
      onOpenTransitionsModal={() => handleOpenTransitionsModal(selectedClipId || "")}
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
  // DESKTOP LAYOUT:
  // [Vertical Toolbar] | [Config Panel (LEFT, when tool active)] | [Player (CENTER, flex:1)] | [Media & Audio Panel (RIGHT)]
  // Bottom: Full-width Timeline
  // ─────────────────────────────────────────────
  if (isDesktop && !isFullscreen) {
    const addMediaFn = (clip: any) => {
      if (handleAddMedia) handleAddMedia(clip);
      else updateProjectWithHistory({ ...project, tracks: { ...project.tracks, video: [...(project.tracks?.video || []), clip] } });
    };
    const addAudioFn = (clip: any) => {
      if (handleAddAudio) handleAddAudio(clip);
      else updateProjectWithHistory({ ...project, tracks: { ...project.tracks, audio: [...(project.tracks?.audio || []), clip] } });
    };

    return (
      <View style={styles.desktopContainer}>
        {/* ① Full-Height Vertical Toolbar */}
        <View style={styles.desktopSidebarArea}>
          {renderToolbar("vertical")}
        </View>

        {/* ② Main Content Column */}
        <View style={styles.desktopContentArea}>
          {/* Top Header Bar (no back button on desktop) */}
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

          {/* Middle Row: Config Panel & Media Panel & Player with Draggable Splitters */}
          <View style={styles.desktopPlayerRow}>
            {desktopPanelOrder === 'config_left' ? (
              <>
                {/* [1] Config Panel (LEFT) */}
                {hasDesktopRightPanel && isConfigPanelExpanded && (
                  <>
                    <View
                      style={[styles.desktopConfigPanel, { width: configPanelWidth }]}
                      {...(Platform.OS === 'web'
                        ? {
                            onDragOver: (e: any) => e.preventDefault(),
                            onDrop: (e: any) => {
                              e.preventDefault();
                              setDesktopPanelOrder('media_left');
                            },
                          }
                        : {})}
                    >
                      {/* Config Panel Header */}
                      <View style={styles.desktopConfigPanelHeader}>
                        {/* Drag grip to reposition or reorder */}
                        <View
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'grab' as any }}
                          {...(Platform.OS === 'web'
                            ? {
                                draggable: true,
                                onDragStart: (e: any) => {
                                  e.dataTransfer?.setData('text/plain', 'panel_config');
                                },
                              }
                            : {})}
                        >
                          <Ionicons name="reorder-two" size={15} color="#71717A" />
                          <Text style={styles.desktopConfigPanelTitle} numberOfLines={1}>
                            {getConfigPanelTitle()}
                          </Text>
                        </View>
                        {/* Swap panels */}
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setDesktopPanelOrder('media_left')}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Swap panels: Media Left, Tool Right"
                        >
                          <Ionicons name="swap-horizontal" size={14} color="#71717A" />
                        </TouchableOpacity>
                        {/* Collapse config panel */}
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setIsConfigPanelExpanded(false)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Collapse tool panel"
                        >
                          <Ionicons name="chevron-back" size={15} color="#71717A" />
                        </TouchableOpacity>
                        {/* Close tool */}
                        <TouchableOpacity
                          style={[styles.desktopPanelIconBtn, { marginLeft: 2 }]}
                          onPress={() => openModal('')}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Close tool"
                        >
                          <Ionicons name="close" size={15} color="#71717A" />
                        </TouchableOpacity>
                      </View>

                      {/* Scrollable tool content */}
                      <View style={styles.desktopConfigPanelContent}>
                        {renderModals ? renderModals(true) : null}
                      </View>
                    </View>

                    {/* Resizer Splitter between Config Panel & Player */}
                    <View
                      style={styles.desktopResizeSplitter}
                      {...(Platform.OS === 'web' ? { onMouseDown: handleConfigResizeStart, onTouchStart: handleConfigResizeStart } : {})}
                    >
                      <View style={styles.resizeHandleBar} />
                    </View>
                  </>
                )}

                {/* Collapsed config panel tab */}
                {hasDesktopRightPanel && !isConfigPanelExpanded && (
                  <TouchableOpacity
                    style={styles.desktopConfigPanelCollapsed}
                    onPress={() => setIsConfigPanelExpanded(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-forward" size={14} color="#00F2FE" />
                    <Text style={styles.desktopConfigPanelCollapsedLabel} numberOfLines={6}>
                      {getConfigPanelTitle()}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* [2] Player (CENTER) */}
                <View style={styles.desktopPlayerArea}>
                  {renderPlayer()}
                </View>

                {/* Resizer Splitter between Player & Media Panel */}
                {!isMediaPanelCollapsed && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === 'web' ? { onMouseDown: handleMediaResizeStart, onTouchStart: handleMediaResizeStart } : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [3] Media & Audio Panel (RIGHT) */}
                <DesktopMediaAudioPanel
                  project={project}
                  activeTab={desktopTab}
                  onSelectTab={(tab) => setDesktopTab(tab)}
                  onAddMedia={addMediaFn}
                  onAddAudio={addAudioFn}
                  currentTime={currentTime}
                  width={mediaPanelWidth}
                  position="right"
                  onSwapPosition={() => setDesktopPanelOrder('media_left')}
                  isCollapsed={isMediaPanelCollapsed}
                  onToggleCollapse={() => setIsMediaPanelCollapsed((prev) => !prev)}
                />
              </>
            ) : (
              <>
                {/* [1] Media & Audio Panel (LEFT) */}
                <DesktopMediaAudioPanel
                  project={project}
                  activeTab={desktopTab}
                  onSelectTab={(tab) => setDesktopTab(tab)}
                  onAddMedia={addMediaFn}
                  onAddAudio={addAudioFn}
                  currentTime={currentTime}
                  width={mediaPanelWidth}
                  position="left"
                  onSwapPosition={() => setDesktopPanelOrder('config_left')}
                  isCollapsed={isMediaPanelCollapsed}
                  onToggleCollapse={() => setIsMediaPanelCollapsed((prev) => !prev)}
                />

                {/* Resizer Splitter between Media Panel & Player */}
                {!isMediaPanelCollapsed && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === 'web' ? { onMouseDown: handleMediaResizeStart, onTouchStart: handleMediaResizeStart } : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [2] Player (CENTER) */}
                <View style={styles.desktopPlayerArea}>
                  {renderPlayer()}
                </View>

                {/* Resizer Splitter between Player & Config Panel */}
                {hasDesktopRightPanel && isConfigPanelExpanded && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === 'web' ? { onMouseDown: handleConfigResizeStart, onTouchStart: handleConfigResizeStart } : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [3] Config Panel (RIGHT) */}
                {hasDesktopRightPanel && isConfigPanelExpanded && (
                  <View
                    style={[styles.desktopConfigPanel, { width: configPanelWidth, borderRightWidth: 0, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' }]}
                    {...(Platform.OS === 'web'
                      ? {
                          onDragOver: (e: any) => e.preventDefault(),
                          onDrop: (e: any) => {
                            e.preventDefault();
                            setDesktopPanelOrder('config_left');
                          },
                        }
                      : {})}
                  >
                    {/* Config Panel Header */}
                    <View style={styles.desktopConfigPanelHeader}>
                      {/* Drag grip to reposition or reorder */}
                      <View
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'grab' as any }}
                        {...(Platform.OS === 'web'
                          ? {
                              draggable: true,
                              onDragStart: (e: any) => {
                                e.dataTransfer?.setData('text/plain', 'panel_config');
                              },
                            }
                          : {})}
                      >
                        <Ionicons name="reorder-two" size={15} color="#71717A" />
                        <Text style={styles.desktopConfigPanelTitle} numberOfLines={1}>
                          {getConfigPanelTitle()}
                        </Text>
                      </View>
                      {/* Swap panels */}
                      <TouchableOpacity
                        style={styles.desktopPanelIconBtn}
                        onPress={() => setDesktopPanelOrder('config_left')}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityLabel="Swap panels: Tool Left, Media Right"
                      >
                        <Ionicons name="swap-horizontal" size={14} color="#71717A" />
                      </TouchableOpacity>
                      {/* Collapse config panel */}
                      <TouchableOpacity
                        style={styles.desktopPanelIconBtn}
                        onPress={() => setIsConfigPanelExpanded(false)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityLabel="Collapse tool panel"
                      >
                        <Ionicons name="chevron-forward" size={15} color="#71717A" />
                      </TouchableOpacity>
                      {/* Close tool */}
                      <TouchableOpacity
                        style={[styles.desktopPanelIconBtn, { marginLeft: 2 }]}
                        onPress={() => openModal('')}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityLabel="Close tool"
                      >
                        <Ionicons name="close" size={15} color="#71717A" />
                      </TouchableOpacity>
                    </View>

                    {/* Scrollable tool content */}
                    <View style={styles.desktopConfigPanelContent}>
                      {renderModals ? renderModals(true) : null}
                    </View>
                  </View>
                )}

                {/* Collapsed config panel tab on right */}
                {hasDesktopRightPanel && !isConfigPanelExpanded && (
                  <TouchableOpacity
                    style={[styles.desktopConfigPanelCollapsed, { borderRightWidth: 0, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' }]}
                    onPress={() => setIsConfigPanelExpanded(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={14} color="#00F2FE" />
                    <Text style={styles.desktopConfigPanelCollapsedLabel} numberOfLines={6}>
                      {getConfigPanelTitle()}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* ⑤ Bottom: Full-width Timeline */}
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
    backgroundColor: "#08090E",
    overflow: "hidden" as any,
  },

  // ── Desktop Layout ──
  desktopContainer: {
    flex: 1,
    flexDirection: "row" as const,
    backgroundColor: "#08090E",
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
    width: 52,
    backgroundColor: "#08090E",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    paddingVertical: 4,
    alignItems: "center",
    overflowY: "auto" as any,
    overflowX: "hidden" as any,
    scrollbarWidth: "none" as any,
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
    top: 4,
    bottom: 4,
    width: 2.5,
    backgroundColor: "#00F2FE",
    borderRadius: 1.5,
    zIndex: 2,
  },
  desktopNavItem: {
    width: 46,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 6,
    alignItems: "center",
    cursor: "pointer" as any,
  } as any,
  desktopNavItemActive: {
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  desktopNavIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  desktopNavLabel: {
    color: "#64748B",
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  desktopNavLabelActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  desktopMediaPanel: {
    width: 240,
    backgroundColor: "#0F131D",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    display: "flex",
    flexDirection: "column",
    overflowY: "hidden" as any,
  } as any,
  desktopCollapsedPanel: {
    width: 18,
    backgroundColor: "#08090E",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  } as any,
  desktopPanelTabBar: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    paddingHorizontal: 6,
    gap: 4,
    backgroundColor: "#08090E",
  },
  desktopPanelTab: {
    flex: 1,
    height: 26,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer" as any,
  } as any,
  desktopPanelTabActive: {
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  desktopPanelTabText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
  },
  desktopPanelTabTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  desktopPanelCollapseBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  } as any,
  desktopPanelBody: {
    flex: 1,
    padding: 8,
    overflowY: "auto" as any,
  } as any,
  desktopImportBtn: {
    borderWidth: 1,
    borderStyle: "dashed" as any,
    borderColor: "rgba(0, 242, 254, 0.4)",
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    alignItems: "center",
    backgroundColor: "rgba(0, 242, 254, 0.03)",
    cursor: "pointer" as any,
  } as any,
  desktopImportBtnText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  desktopImportBtnSub: {
    color: "#64748B",
    fontSize: 9,
    marginTop: 2,
  },
  desktopPanelSectionTitle: {
    color: "#64748B",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  desktopEmptyState: {
    paddingVertical: 18,
    alignItems: "center",
  },
  desktopEmptyStateIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  desktopEmptyStateText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  desktopEmptyStateSub: {
    color: "#64748B",
    fontSize: 9.5,
    marginTop: 2,
  },
  desktopClipRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131826",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
    padding: 6,
    marginBottom: 4,
  },
  desktopClipThumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: "#08090E",
    alignItems: "center",
    justifyContent: "center",
  },
  desktopClipTitle: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "600",
  },
  desktopClipMeta: {
    color: "#64748B",
    fontSize: 8.5,
    marginTop: 1,
  },
  desktopPlayerArea: {
    flex: 1,
    backgroundColor: "#08090E",
    overflow: "hidden" as any,
    minWidth: 0,
  } as any,

  // Config panel (shows when tool is open)
  desktopConfigPanel: {
    width: 300,
    flexShrink: 0,
    backgroundColor: "#0F131D",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden" as any,
    ...(Platform.OS === "web"
      ? ({ animation: "fastartPanelIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)" } as any)
      : {}),
  } as any,
  desktopConfigPanelHeader: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingRight: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    backgroundColor: "#131826",
    gap: 4,
  },
  desktopConfigPanelTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    flex: 1,
  },
  desktopPanelIconBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    cursor: "pointer" as any,
  } as any,
  desktopConfigPanelCollapsed: {
    width: 24,
    flexShrink: 0,
    backgroundColor: "#0F131D",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    alignItems: "center",
    paddingTop: 10,
    gap: 4,
    cursor: "pointer" as any,
  } as any,
  desktopConfigPanelCollapsedLabel: {
    color: "#00F2FE",
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase" as any,
    writingMode: "vertical-rl" as any,
    transform: [{ rotate: "180deg" }],
    maxHeight: 180,
    overflow: "hidden" as any,
  } as any,
  desktopConfigPanelContent: {
    flex: 1,
    overflow: "hidden" as any,
  } as any,

  // Keep legacy aliases for any remaining references
  desktopRightPanel: {
    width: 300,
    backgroundColor: "#0F131D",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden" as any,
  } as any,
  desktopRightPanelHeader: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    backgroundColor: "#131826",
  },
  desktopRightPanelTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  desktopRightPanelClose: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    cursor: "pointer" as any,
  } as any,
  desktopRightPanelContent: {
    flex: 1,
    overflow: "hidden" as any,
  } as any,

  desktopTimelineArea: {
    width: "100%",
    flexShrink: 0,
    backgroundColor: "#08090E",
  },

  // ── Mobile / Shared Layout ──
  playerStage: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden" as any,
    backgroundColor: "#08090E",
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
    backgroundColor: "#08090E",
  },
  mobileBottomArea: {
    width: "100%",
    flexShrink: 0,
    backgroundColor: "#08090E",
  },
  mobileInlineConfigArea: {
    height: 260,
    width: "100%",
    backgroundColor: "#0F131D",
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
    overflow: "hidden" as any,
  },
  mobileTimelineArea: {
    width: "100%",
  },
  bottomDock: {
    width: "100%",
    flexShrink: 0,
    backgroundColor: "#08090E",
  },
  desktopResizeSplitter: {
    width: 5,
    height: "100%",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    cursor: "col-resize" as any,
    zIndex: 20,
    userSelect: "none" as any,
  } as any,
  resizeHandleBar: {
    width: 2,
    height: 28,
    borderRadius: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
});
