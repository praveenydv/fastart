import React from "react";
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Platform, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../Header";
import Player from "../Player";
import Timeline from "../Timeline";
import Toolbar from "../Toolbar";
import { DesktopMediaAudioPanel, DesktopResourceTab } from "../Desktop/DesktopMediaAudioPanel";
import { DesktopInspector } from "../Desktop/DesktopInspector";
import { INLINE_MODAL_KEYS } from "./EditorModals";
import { soundEngine } from "../../utils/audioEngine";
import { FastArtProject, EffectClip, MotionTrackConfig } from "../../types/project";
import { allocateNewTrackForClip } from "../../utils/trackPlacement";
import { THEME_COLORS } from "../../constants/designConstants";
import { mediaHasAudioTrack } from "../../utils/mediaAudioDetector";

const CLIP_TYPE_AVAILABLE_MENUS: Record<string, Set<string>> = {
  text: new Set(["text", "edit", "animation", "keyframe", "tracking", "opacity"]),
  caption: new Set(["captions", "caption", "text", "edit", "keyframe", "tracking", "animation", "opacity"]),
  captions: new Set(["captions", "caption", "text", "edit", "keyframe", "tracking", "animation", "opacity"]),
  sticker: new Set(["stickers", "sticker", "edit", "animation", "keyframe", "tracking", "opacity"]),
  stickers: new Set(["stickers", "sticker", "edit", "animation", "keyframe", "tracking", "opacity"]),
  audio: new Set(["volume", "speed", "denoise", "audio", "audio_effects", "voice_effects"]),
  effects: new Set(["effects", "effect"]),
  effect: new Set(["effects", "effect"]),
  photo: new Set([
    "animation",
    "transform",
    "crop",
    "blend",
    "mask",
    "cutout",
    "filters",
    "hsl",
    "adjust",
    "enhance",
    "effects",
    "transitions",
    "keyframe",
    "opacity",
    "background",
    "canvas",
  ]),
  video: new Set([
    "speed",
    "volume",
    "audio_effects",
    "voice_effects",
    "animation",
    "transform",
    "crop",
    "blend",
    "mask",
    "cutout",
    "filters",
    "hsl",
    "adjust",
    "enhance",
    "effects",
    "transitions",
    "keyframe",
    "opacity",
    "tracking",
    "extract_audio",
    "denoise",
    "reverse",
    "background",
    "canvas",
  ]),
};

const CLIP_TYPE_DEFAULT_MENU: Record<string, string> = {
  text: "text",
  caption: "captions",
  captions: "captions",
  sticker: "stickers",
  stickers: "stickers",
  audio: "volume",
  effects: "effects",
  effect: "effects",
  photo: "transform",
  video: "transform",
};

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
  closeModal?: () => void;
  onCloseModal?: () => void;
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
  handleFreezeFrame?: () => void;
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
  closeModal,
  onCloseModal,
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
  handleFreezeFrame,
  renderModals,
  handleAddMedia,
  handleAddAudio,
}) => {
  const activeModalRef = React.useRef(activeModal);
  activeModalRef.current = activeModal;

  const handleOpenEditModal = React.useCallback(
    (clipId: string, clipType?: string) => {
      soundEngine.playSfx("click");
      setSelectedClipId(clipId);
      let resolvedType = clipType || selectedClipType;
      if (!resolvedType && project) {
        if (project.tracks.captions?.some((c) => c.id === clipId)) resolvedType = "caption";
        else if (project.tracks.text?.some((c) => c.id === clipId)) resolvedType = "text";
        else if (project.tracks.stickers?.some((c) => c.id === clipId)) resolvedType = "stickers";
        else if (project.tracks.video?.some((c) => c.id === clipId)) {
          const v = project.tracks.video.find((c) => c.id === clipId);
          resolvedType = (v?.type === "photo" || (v as any)?.isPhoto) ? "photo" : "video";
        }
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
              : resolvedType === "photo"
                ? "photo"
                : resolvedType === "audio"
                  ? "audio"
                  : resolvedType === "text"
                    ? "text"
                    : resolvedType || "video";

      setSelectedClipType(normalizedType);

      const defaultMenu = CLIP_TYPE_DEFAULT_MENU[normalizedType];
      if (defaultMenu) {
        openModal(defaultMenu);
      }
    },
    [project, selectedClipType, setSelectedClipId, setSelectedClipType, openModal]
  );

  const handleCloseMenu = React.useCallback(() => {
    soundEngine.playSfx("click");
    if (onCloseModal) {
      onCloseModal();
    } else if (closeModal) {
      closeModal();
    } else {
      openModal("");
    }
  }, [onCloseModal, closeModal, openModal]);

  const handleSelectClipWithMenuSwitch = React.useCallback(
    (clipId: string | null, clipType?: string) => {
      if (!clipId) {
        setSelectedClipId(null);
        return;
      }
      setSelectedClipId(clipId);
      let resolvedType = clipType;
      let targetClip: any = null;
      if (project) {
        if (project.tracks.captions?.some((c) => c.id === clipId)) {
          resolvedType = "caption";
          targetClip = project.tracks.captions.find((c) => c.id === clipId);
        } else if (project.tracks.text?.some((c) => c.id === clipId)) {
          resolvedType = "text";
          targetClip = project.tracks.text.find((c) => c.id === clipId);
        } else if (project.tracks.stickers?.some((c) => c.id === clipId)) {
          resolvedType = "stickers";
          targetClip = project.tracks.stickers.find((c) => c.id === clipId);
        } else if (project.tracks.video?.some((c) => c.id === clipId)) {
          const v = project.tracks.video.find((c) => c.id === clipId);
          targetClip = v;
          resolvedType = (v?.type === "photo" || (v as any)?.isPhoto) ? "photo" : "video";
        } else if (project.tracks.audio?.some((c) => c.id === clipId)) {
          resolvedType = "audio";
          targetClip = project.tracks.audio.find((c) => c.id === clipId);
        } else if (project.tracks.effects?.some((c) => c.id === clipId)) {
          resolvedType = "effects";
          targetClip = project.tracks.effects.find((c) => c.id === clipId);
        }
      }

      const normalizedType =
        resolvedType === "caption" || resolvedType === "captions"
          ? "caption"
          : resolvedType === "sticker" || resolvedType === "stickers"
            ? "stickers"
            : resolvedType === "effect" || resolvedType === "effects"
              ? "effects"
              : resolvedType === "photo"
                ? "photo"
                : resolvedType === "audio"
                  ? "audio"
                  : resolvedType === "text"
                    ? "text"
                    : resolvedType || "video";

      setSelectedClipType(normalizedType);

      // If a menu/tool is currently open and is not in the list of available tools for this clip, open its default actual modal
      const currentModal = activeModalRef.current || activeModal;
      if (currentModal) {
        const availableMenus = CLIP_TYPE_AVAILABLE_MENUS[normalizedType];
        let isToolSupported = availableMenus ? availableMenus.has(currentModal) : false;

        // Special audio check: if video clip has no audio track, audio-related tools are not available
        if (normalizedType === "video" && targetClip && !mediaHasAudioTrack(targetClip)) {
          if (
            currentModal === "volume" ||
            currentModal === "audio_effects" ||
            currentModal === "voice_effects" ||
            currentModal === "denoise" ||
            currentModal === "extract_audio"
          ) {
            isToolSupported = false;
          }
        }

        if (!isToolSupported) {
          const defaultMenu = CLIP_TYPE_DEFAULT_MENU[normalizedType];
          if (defaultMenu) {
            openModal(defaultMenu);
          }
        }
      }
    },
    [project, activeModal, openModal, setSelectedClipId, setSelectedClipType]
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
        return audio ? audio.id : null;
      }
      const video =
        project.tracks?.video?.find((c: any) => cur >= c.startTime && cur <= c.startTime + c.duration) ||
        project.tracks?.video?.[0];
      return video ? video.id : null;
    },
    [project, selectedClipId, currentTime]
  );

  const handleApplyFilter = React.useCallback(
    (filter: string, intensity?: number) => {
      if (!project) return;
      const safeIntensity = intensity ?? 80;

      // 1. VIDEO ATTACHED: If a video clip is currently selected, attach the filter to that clip!
      if (selectedClipId && selectedClipType === "video") {
        const isNone = filter === "none" || filter === "normal";
        const updatedVideos = (project.tracks?.video || []).map((c: any) =>
          c.id === selectedClipId
            ? { ...c, filter: isNone ? undefined : filter, filterIntensity: safeIntensity }
            : c
        );
        updateProjectWithHistory({
          ...project,
          tracks: {
            ...project.tracks,
            video: updatedVideos,
          },
        });
        return;
      }

      // 2. If an effect/filter clip is currently selected, update its filter!
      if ((selectedClipType === "effects" || selectedClipType === "effect") && selectedClipId) {
        const effectClips = [...(project.tracks?.effects || [])];
        const idx = effectClips.findIndex((e) => e.id === selectedClipId);
        if (idx >= 0) {
          const isNone = filter === "none" || filter === "normal";
          if (isNone) {
            effectClips.splice(idx, 1);
            updateProjectWithHistory({
              ...project,
              tracks: { ...project.tracks, effects: effectClips },
            });
            if (setSelectedClipId) setSelectedClipId(null);
            if (setSelectedClipType) setSelectedClipType("");
          } else {
            const filterName = filter.charAt(0).toUpperCase() + filter.slice(1);
            effectClips[idx] = {
              ...effectClips[idx],
              filter,
              type: "filter_" + filter,
              name: `Filter: ${filterName}`,
            };
            updateProjectWithHistory({
              ...project,
              tracks: { ...project.tracks, effects: effectClips },
            });
          }
          return;
        }
      }

      // 3. GLOBAL: Create timeline filter clip!
      if (filter === "none" || filter === "normal") return;

      const desiredStart = currentTime || 0;
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        project,
        desiredStart,
      );

      const filterName = filter.charAt(0).toUpperCase() + filter.slice(1);
      const newFilterClip: EffectClip = {
        id: "eff-flt-" + Date.now(),
        type: "filter_" + filter,
        name: `Filter: ${filterName}`,
        filter,
        startTime: Math.max(0, Number(desiredStart.toFixed(3))),
        duration: 3.0,
        intensity: safeIntensity / 100,
        trackIndex: newTrackIndex,
      };

      const effectClips = [...(project.tracks?.effects || []), newFilterClip];
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          effects: effectClips,
        },
      });

      if (setSelectedClipId) setSelectedClipId(newFilterClip.id);
      if (setSelectedClipType) setSelectedClipType("effects");
    },
    [project, selectedClipId, selectedClipType, currentTime, updateProjectWithHistory, setSelectedClipId, setSelectedClipType]
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
    (nameOrPreset: any) => {
      if (!project) return;

      const effType = typeof nameOrPreset === "string" ? nameOrPreset : (nameOrPreset?.type || nameOrPreset?.id);
      const isNone = !effType || effType === "none" || effType === "None";
      const effInt = typeof nameOrPreset === "object" && nameOrPreset?.intensity !== undefined ? nameOrPreset.intensity : 0.8;

      // 1. VIDEO ATTACHED: If a video clip is currently selected, attach the effect to that clip!
      if (selectedClipId && selectedClipType === "video") {
        const updatedVideos = (project.tracks?.video || []).map((c: any) => {
          if (c.id === selectedClipId) {
            if (isNone) {
              const { effect, effectIntensity, ...cleanClip } = c;
              return cleanClip;
            }
            return { ...c, effect: effType, effectIntensity: effInt };
          }
          return c;
        });
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: updatedVideos },
        });
        return;
      }

      // 2. If an effect clip is already selected on timeline, update it!
      if ((selectedClipType === "effects" || selectedClipType === "effect") && selectedClipId) {
        const effectClips = [...(project.tracks?.effects || [])];
        const idx = effectClips.findIndex((e) => e.id === selectedClipId);
        if (idx >= 0) {
          if (isNone) {
            effectClips.splice(idx, 1);
            updateProjectWithHistory({
              ...project,
              tracks: { ...project.tracks, effects: effectClips },
            });
            if (setSelectedClipId) setSelectedClipId(null);
            if (setSelectedClipType) setSelectedClipType("");
          } else {
            effectClips[idx] = {
              ...effectClips[idx],
              type: effType,
              name: (typeof nameOrPreset === "object" && nameOrPreset?.name) || effType || "Effect",
              intensity: effInt,
            };
            updateProjectWithHistory({
              ...project,
              tracks: { ...project.tracks, effects: effectClips },
            });
          }
          return;
        }
      }

      // 3. GLOBAL: Create timeline effect clip!
      if (isNone) return;

      const desiredStart = currentTime || 0;
      const { trackIndex: newTrackIndex } = allocateNewTrackForClip(
        project,
        desiredStart,
      );

      const newEffect: EffectClip = {
        id: `eff_${Date.now()}`,
        type: effType || "Glitch",
        name: (typeof nameOrPreset === "object" && nameOrPreset?.name) || effType || "Glitch",
        startTime: Math.max(0, Number(desiredStart.toFixed(3))),
        duration: (typeof nameOrPreset === "object" && nameOrPreset?.duration) || 3,
        trackIndex: newTrackIndex,
        intensity: effInt,
      };

      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          effects: [...(project.tracks?.effects || []), newEffect],
        },
      });

      if (setSelectedClipId) setSelectedClipId(newEffect.id);
      if (setSelectedClipType) setSelectedClipType("effects");
    },
    [currentTime, project, selectedClipId, selectedClipType, updateProjectWithHistory, setSelectedClipId, setSelectedClipType]
  );

  // Determine platform layout via standard responsive dimensions hook
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Desktop: track which left-panel tab is open
  const [desktopTab, setDesktopTab] = React.useState<DesktopResourceTab>('media');
  const [isMediaPanelCollapsed, setIsMediaPanelCollapsed] = React.useState(false);
  const [isConfigPanelExpanded, setIsConfigPanelExpanded] = React.useState(true);
  const [configPanelWidth, setConfigPanelWidth] = React.useState(320);
  const [mediaPanelWidth, setMediaPanelWidth] = React.useState(260);
  const [desktopPanelOrder, setDesktopPanelOrder] = React.useState<'config_left' | 'media_left'>('media_left');

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

  // Keep modal container height identical to timeline height to prevent layout shifts
  const [currentTimelineHeight, setCurrentTimelineHeight] = React.useState<number>(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem("fastart_timeline_height");
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed >= 74 && parsed <= 500) return parsed;
        }
      } catch (_) {}
    }
    return 200;
  });

  // Label for active config panel
  const getConfigPanelTitle = () => {
    const TITLES: Record<string, string> = {
      audio: '🎵 Audio Studio', filters: '🎨 Filters & LUTs', transform: '⚙️ Transform', mask: '🔶 Mask',
      speed: '⚡ Speed', volume: '🔊 Volume & Fade', text: '✏️ Text', stickers: '🎭 Stickers',
      effects: '✨ Effects', captions: '💬 Captions', transitions: '↔️ Transitions',
      enhance: '💎 AI Enhance', autocut: '✂️ AutoCut', canvas: '📐 Canvas', background: '🖼️ Background',
      keyframe: '◆ Keyframe', tts: '🗣️ Text to Speech', cutout: '✂️ Cutout', tracking: '🎯 Tracking & Blur',
      layer: '📑 Layer Order', opacity: '👁️ Opacity', animation: '🎬 Animation', audio_effects: '🎙️ Audio FX',
      voice_effects: '🎙️ Voice FX', blend: '🎨 Blend Mode', hsl: '🌈 HSL Color',
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
      activeToolId={activeModal || undefined}
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
      onFreezeFrame={handleFreezeFrame}
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
      onOpenOpacityModal={() => openModal("opacity")}
      onOpenAnimationModal={() => openModal("animation")}
      onOpenAudioEffectsModal={() => openModal("audio_effects")}
      onOpenBlendModal={() => openModal("blend")}
      onOpenHSLModal={() => openModal("hsl")}
      onCloseModal={handleCloseMenu}
      onBackToHome={onBackToHome}
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
      onSelectClip={(id, type) => handleSelectClipWithMenuSwitch(id, type)}
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
      onFreezeFrame={handleFreezeFrame}
      onToggleReverse={handleToggleReverse}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
      onTimelineHeightChange={setCurrentTimelineHeight}
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

  const handleUpdateClipMotionTrack = (track: MotionTrackConfig) => {
    if (!project || !selectedClipId) return;
    const current = { ...project };
    const vIdx = (current.tracks.video || []).findIndex((v) => v.id === selectedClipId);
    if (vIdx >= 0) {
      const video = [...current.tracks.video];
      video[vIdx] = { ...video[vIdx], motionTrack: track };
      updateProjectWithHistory({ ...current, tracks: { ...current.tracks, video } });
      return;
    }
    const tIdx = (current.tracks.text || []).findIndex((t) => t.id === selectedClipId);
    if (tIdx >= 0) {
      const text = [...current.tracks.text];
      text[tIdx] = { ...text[tIdx], motionTrack: track };
      updateProjectWithHistory({ ...current, tracks: { ...current.tracks, text } });
      return;
    }
    const sIdx = (current.tracks.stickers || []).findIndex((s) => s.id === selectedClipId);
    if (sIdx >= 0) {
      const stickers = [...current.tracks.stickers];
      stickers[sIdx] = { ...stickers[sIdx], motionTrack: track };
      updateProjectWithHistory({ ...current, tracks: { ...current.tracks, stickers } });
      return;
    }
  };

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
      onSelectClip={(id, type) => handleSelectClipWithMenuSwitch(id, type)}
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
      onOpenAnimationModal={() => openModal("animation")}
      isCroppingPreview={isCroppingPreview}
      onToggleCropPreview={setIsCroppingPreview}
      onUpdateClipCrop={handleUpdateClipCrop}
      isMaskingPreview={activeModal === "mask"}
      onToggleMaskPreview={(val) => {
        if (!val) {
          handleCloseMenu();
        }
      }}
      onUpdateClipMask={handleUpdateClipMask}
      activeModal={activeModal}
      onUpdateClipMotionTrack={handleUpdateClipMotionTrack}
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
          />

          {/* Middle Row: Config Panel & Media Panel & Player with Draggable Splitters */}
          <View style={styles.desktopPlayerRow}>
            {desktopPanelOrder === 'config_left' ? (
              <>
                {/* [1] Config / Inspector Panel (LEFT) */}
                {isConfigPanelExpanded ? (
                  hasDesktopRightPanel ? (
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
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setDesktopPanelOrder('media_left')}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Swap panels: Media Left, Tool Right"
                        >
                          <Ionicons name="swap-horizontal" size={14} color="#71717A" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setIsConfigPanelExpanded(false)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Collapse tool panel"
                        >
                          <Ionicons name="chevron-back" size={15} color="#71717A" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.desktopPanelIconBtn, { marginLeft: 2 }]}
                          onPress={handleCloseMenu}
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
                  ) : (
                    <DesktopInspector
                      project={project}
                      selectedClip={selectedClip}
                      selectedClipType={selectedClipType}
                      currentTime={currentTime}
                      onUpdateProject={(updates) => updateProjectWithHistory(updates)}
                      onUpdateClipTransform={(clipId, transform, isFinal) =>
                        handleUpdateClipTransform(clipId, selectedClipType, transform as any, isFinal)
                      }
                      onUpdateClipCrop={(clipId, crop) => handleUpdateClipCrop(clipId, crop, true)}
                      onUpdateClipMask={(clipId, mask, isFinal) =>
                        handleUpdateClipMask && handleUpdateClipMask(clipId, mask, isFinal)
                      }
                      onApplyVolume={(vol, fIn, fOut) =>
                        handleApplyVolume(vol, { in: fIn, out: fOut })
                      }
                      onApplySpeed={(speed, curve) => handleApplySpeed(speed, curve)}
                      onApplyFilter={handleApplyFilter}
                      onDeleteClip={() => handleDeleteClip()}
                      onDuplicateClip={() => handleDuplicateClip()}
                      onAddKeyframe={onAddKeyframe}
                      hasKeyframeAtPlayhead={isKeyframeAtPlayhead}
                      onOpenModal={openModal}
                      width={configPanelWidth}
                      isCollapsed={false}
                      onToggleCollapse={() => setIsConfigPanelExpanded(false)}
                    />
                  )
                ) : (
                  <TouchableOpacity
                    style={styles.desktopConfigPanelCollapsed}
                    onPress={() => setIsConfigPanelExpanded(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-forward" size={14} color={THEME_COLORS.accent} />
                    <Text style={styles.desktopConfigPanelCollapsedLabel} numberOfLines={6}>
                      {hasDesktopRightPanel ? getConfigPanelTitle() : (selectedClip ? (selectedClip.title || 'Clip') : 'Inspector')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Resizer Splitter between Left Panel & Center Player */}
                {isConfigPanelExpanded && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === 'web' ? { onMouseDown: handleConfigResizeStart, onTouchStart: handleConfigResizeStart } : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [2] Player (CENTER) */}
                <View style={styles.desktopPlayerArea}>
                  {renderPlayer()}
                </View>

                {/* Resizer Splitter between Center Player & Right Media Panel */}
                {!isMediaPanelCollapsed && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === 'web' ? { onMouseDown: handleMediaResizeStart, onTouchStart: handleMediaResizeStart } : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [3] Media & Resource Library Panel (RIGHT) */}
                <DesktopMediaAudioPanel
                  project={project}
                  activeTab={desktopTab}
                  onSelectTab={(tab) => setDesktopTab(tab)}
                  onAddMedia={addMediaFn}
                  onAddAudio={addAudioFn}
                  onAddText={(txt, col) => handleAddText(txt, col)}
                  onAddSticker={(stk) => handleAddSticker(stk)}
                  onAddEffect={(eff) => handleAddEffect(eff)}
                  onAddTransition={(trId) => handleOpenTransitionsModal(selectedClipId || '')}
                  currentTime={currentTime}
                  onDeleteMedia={handleDeleteClip}
                  width={mediaPanelWidth}
                  position="right"
                  onSwapPosition={() => setDesktopPanelOrder('media_left')}
                  isCollapsed={isMediaPanelCollapsed}
                  onToggleCollapse={() => setIsMediaPanelCollapsed((prev) => !prev)}
                />
              </>
            ) : (
              <>
                {/* [1] Media & Resource Library Panel (LEFT) - CapCut Default */}
                <DesktopMediaAudioPanel
                  project={project}
                  activeTab={desktopTab}
                  onSelectTab={(tab) => setDesktopTab(tab)}
                  onAddMedia={addMediaFn}
                  onAddAudio={addAudioFn}
                  onAddText={(txt, col) => handleAddText(txt, col)}
                  onAddSticker={(stk) => handleAddSticker(stk)}
                  onAddEffect={(eff) => handleAddEffect(eff)}
                  onAddTransition={(trId) => handleOpenTransitionsModal(selectedClipId || '')}
                  currentTime={currentTime}
                  onDeleteMedia={handleDeleteClip}
                  width={mediaPanelWidth}
                  position="left"
                  onSwapPosition={() => setDesktopPanelOrder('config_left')}
                  isCollapsed={isMediaPanelCollapsed}
                  onToggleCollapse={() => setIsMediaPanelCollapsed((prev) => !prev)}
                />

                {/* Resizer Splitter between Left Media Panel & Center Player */}
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

                {/* Resizer Splitter between Center Player & Right Config/Inspector Panel */}
                {isConfigPanelExpanded && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === 'web' ? { onMouseDown: handleConfigResizeStart, onTouchStart: handleConfigResizeStart } : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [3] Config / Inspector Panel (RIGHT) - CapCut Parity */}
                {isConfigPanelExpanded ? (
                  hasDesktopRightPanel ? (
                    <View
                      style={[styles.desktopConfigPanel, { width: configPanelWidth, borderRightWidth: 0, borderLeftWidth: 1, borderLeftColor: THEME_COLORS.borderSubtle }]}
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
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setDesktopPanelOrder('config_left')}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Swap panels: Tool Left, Media Right"
                        >
                          <Ionicons name="swap-horizontal" size={14} color="#71717A" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setIsConfigPanelExpanded(false)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Collapse tool panel"
                        >
                          <Ionicons name="chevron-forward" size={15} color="#71717A" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.desktopPanelIconBtn, { marginLeft: 2 }]}
                          onPress={handleCloseMenu}
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
                  ) : (
                    <DesktopInspector
                      project={project}
                      selectedClip={selectedClip}
                      selectedClipType={selectedClipType}
                      currentTime={currentTime}
                      onUpdateProject={(updates) => updateProjectWithHistory(updates)}
                      onUpdateClipTransform={(clipId, transform, isFinal) =>
                        handleUpdateClipTransform(clipId, selectedClipType, transform as any, isFinal)
                      }
                      onUpdateClipCrop={(clipId, crop) => handleUpdateClipCrop(clipId, crop, true)}
                      onUpdateClipMask={(clipId, mask, isFinal) =>
                        handleUpdateClipMask && handleUpdateClipMask(clipId, mask, isFinal)
                      }
                      onApplyVolume={(vol, fIn, fOut) =>
                        handleApplyVolume(vol, { in: fIn, out: fOut })
                      }
                      onApplySpeed={(speed, curve) => handleApplySpeed(speed, curve)}
                      onApplyFilter={handleApplyFilter}
                      onDeleteClip={() => handleDeleteClip()}
                      onDuplicateClip={() => handleDuplicateClip()}
                      onAddKeyframe={onAddKeyframe}
                      hasKeyframeAtPlayhead={isKeyframeAtPlayhead}
                      onOpenModal={openModal}
                      width={configPanelWidth}
                      isCollapsed={false}
                      onToggleCollapse={() => setIsConfigPanelExpanded(false)}
                    />
                  )
                ) : (
                  <TouchableOpacity
                    style={[styles.desktopConfigPanelCollapsed, { borderRightWidth: 0, borderLeftWidth: 1, borderLeftColor: THEME_COLORS.borderSubtle }]}
                    onPress={() => setIsConfigPanelExpanded(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={14} color={THEME_COLORS.accent} />
                    <Text style={styles.desktopConfigPanelCollapsedLabel} numberOfLines={6}>
                      {hasDesktopRightPanel ? getConfigPanelTitle() : (selectedClip ? (selectedClip.title || 'Clip') : 'Inspector')}
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
            <View style={[styles.mobileInlineConfigArea, { height: Math.min(Math.round(windowHeight * 0.52), Math.max(220, currentTimelineHeight)) }]}>
              {/* Mobile menu modal header bar with close/back and done to restore timeline */}
              <View style={styles.mobileInlineHeader}>
                <TouchableOpacity
                  style={styles.mobileInlineHeaderBtn}
                  onPress={handleCloseMenu}
                  activeOpacity={0.7}
                  accessibilityLabel="Close tool"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.mobileInlineHeaderTitle} numberOfLines={1}>
                  {getConfigPanelTitle()}
                </Text>
                <TouchableOpacity
                  style={styles.mobileInlineHeaderDoneBtn}
                  onPress={handleCloseMenu}
                  activeOpacity={0.7}
                  accessibilityLabel="Done"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="checkmark" size={18} color="#00E5FF" />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                {renderModals ? renderModals(true) : null}
              </View>
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
    width: 62,
    backgroundColor: "#08090E",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    paddingVertical: 6,
    alignItems: "center",
    overflowY: "auto" as any,
    overflowX: "hidden" as any,
    scrollbarWidth: "none" as any,
  } as any,
  desktopNavItemWrap: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginBottom: 4,
  },
  desktopNavActiveBar: {
    position: "absolute",
    left: 0,
    top: 4,
    bottom: 4,
    width: 2.5,
    backgroundColor: THEME_COLORS.accent,
    borderRadius: 1.5,
    zIndex: 2,
  },
  desktopNavItem: {
    width: 52,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 7,
    alignItems: "center",
    cursor: "pointer" as any,
  } as any,
  desktopNavItemActive: {
    backgroundColor: THEME_COLORS.cyanBg,
  },
  desktopNavIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  desktopNavLabel: {
    color: THEME_COLORS.textMuted,
    fontSize: 9.5,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.15,
  },
  desktopNavLabelActive: {
    color: THEME_COLORS.accent,
    fontWeight: "700",
  },
  desktopMediaPanel: {
    width: 240,
    backgroundColor: THEME_COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: THEME_COLORS.borderSubtle,
    display: "flex",
    flexDirection: "column",
    overflowY: "hidden" as any,
  } as any,
  desktopCollapsedPanel: {
    width: 18,
    backgroundColor: THEME_COLORS.background,
    borderRightWidth: 1,
    borderRightColor: THEME_COLORS.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  } as any,
  desktopPanelTabBar: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
    paddingHorizontal: 6,
    gap: 4,
    backgroundColor: THEME_COLORS.surfaceElevated,
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
    backgroundColor: THEME_COLORS.card,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  desktopPanelTabText: {
    color: THEME_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  desktopPanelTabTextActive: {
    color: THEME_COLORS.accent,
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
    borderColor: THEME_COLORS.cyanBorder,
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    alignItems: "center",
    backgroundColor: THEME_COLORS.cyanBg,
    cursor: "pointer" as any,
  } as any,
  desktopImportBtnText: {
    color: THEME_COLORS.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  desktopImportBtnSub: {
    color: THEME_COLORS.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  desktopPanelSectionTitle: {
    color: THEME_COLORS.textMuted,
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
    color: THEME_COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  desktopEmptyStateSub: {
    color: THEME_COLORS.textMuted,
    fontSize: 9.5,
    marginTop: 2,
  },
  desktopClipRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME_COLORS.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    padding: 6,
    marginBottom: 4,
  },
  desktopClipThumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: THEME_COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  desktopClipTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 10.5,
    fontWeight: "600",
  },
  desktopClipMeta: {
    color: THEME_COLORS.textMuted,
    fontSize: 8.5,
    marginTop: 1,
  },
  desktopPlayerArea: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
    overflow: "hidden" as any,
    minWidth: 0,
  } as any,

  // Config panel (shows when tool is open)
  desktopConfigPanel: {
    width: 300,
    flexShrink: 0,
    backgroundColor: THEME_COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: THEME_COLORS.borderSubtle,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden" as any,
  } as any,
  desktopConfigPanelHeader: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingRight: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
    backgroundColor: THEME_COLORS.card,
    gap: 4,
  },
  desktopConfigPanelTitle: {
    color: THEME_COLORS.textPrimary,
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
    backgroundColor: THEME_COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: THEME_COLORS.borderSubtle,
    alignItems: "center",
    paddingTop: 10,
    gap: 4,
    cursor: "pointer" as any,
  } as any,
  desktopConfigPanelCollapsedLabel: {
    color: THEME_COLORS.accent,
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
    width: "100%",
    backgroundColor: "#0F131D",
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
    overflow: "hidden" as any,
  },
  mobileInlineHeader: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    backgroundColor: "#0D111A",
  },
  mobileInlineHeaderBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  mobileInlineHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  mobileInlineHeaderDoneBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 229, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.25)",
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
