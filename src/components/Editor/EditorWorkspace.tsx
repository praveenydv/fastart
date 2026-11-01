import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import Header from "../Header";
import Player from "../Player";
import Timeline from "../Timeline";
import Toolbar from "../Toolbar";
import { useTimelineResize } from "../Timeline/useTimelineResize";
import {
  DesktopMediaAudioPanel,
  DesktopResourceTab,
} from "../Desktop/DesktopMediaAudioPanel";
import { DesktopInspector } from "../Desktop/DesktopInspector";
import { INLINE_MODAL_KEYS } from "./EditorModals";
import { soundEngine } from "../../utils/audioEngine";
import {
  FastArtProject,
  EffectClip,
  MotionTrackConfig,
} from "../../types/project";
import { allocateNewTrackForClip } from "../../utils/trackPlacement";
import { THEME_COLORS } from "../../constants/designConstants";
import { mediaHasAudioTrack } from "../../utils/mediaAudioDetector";
import { reconnectLinkedMedia } from "../../utils/largeMediaStorage";
import { pauseActiveVideoRenderer } from "../../utils/videoRenderer";
import { pauseAllAudio } from "../Player/usePlayerAudioSync";
import { ErrorBoundary } from "../Common/ErrorBoundary";
import KeyboardShortcutsModal from "../Panels/KeyboardShortcutsModal";
import UndoHistoryModal from "../Panels/UndoHistoryModal";

const CLIP_TYPE_AVAILABLE_MENUS: Record<string, Set<string>> = {
  text: new Set([
    "text",
    "edit",
    "animation",
    "keyframe",
    "tracking",
    "opacity",
  ]),
  caption: new Set([
    "captions",
    "caption",
    "text",
    "edit",
    "keyframe",
    "tracking",
    "animation",
    "opacity",
  ]),
  captions: new Set([
    "captions",
    "caption",
    "text",
    "edit",
    "keyframe",
    "tracking",
    "animation",
    "opacity",
  ]),
  sticker: new Set([
    "stickers",
    "sticker",
    "edit",
    "animation",
    "keyframe",
    "tracking",
    "opacity",
  ]),
  stickers: new Set([
    "stickers",
    "sticker",
    "edit",
    "animation",
    "keyframe",
    "tracking",
    "opacity",
  ]),
  audio: new Set([
    "volume",
    "speed",
    "denoise",
    "audio",
    "audio_effects",
    "voice_effects",
  ]),
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
  handleUpdateClipMask?: (
    clipId: string,
    mask: any,
    isFinal?: boolean,
    timeOverride?: number,
  ) => void;
  handleSplitClip: () => void;
  handleDuplicateClip: (targetId?: string, targetType?: string) => void;
  handleDeleteClip: (targetId?: string, targetType?: string) => void;
  handleDeleteProjectAsset?: (assetId: string, type?: string) => void;
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
  handleOpenTransformModal?: (
    tab?: "crop" | "flip" | "rotate" | "stretch" | "angle",
  ) => void;
  handleOpenMaskModal: () => void;
  handleOpenAudioModal: () => void;
  handleOpenTextModal: () => void;
  handleOpenFiltersModal: () => void;
  handleOpenEffectsModal: () => void;
  handleOpenStickersModal: () => void;
  handleOpenMediaPicker: () => void;
  handleOpenEnhance: () => void;
  handleOpenAutoCut: () => void;
  handleOpenCanvasModal: () => void;
  handleOpenBackgroundModal?: () => void;
  handleOpenCutoutModal: (mode?: "auto" | "chroma") => void;
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
  historyStack?: FastArtProject[];
  redoStack?: FastArtProject[];
  handleJumpToState?: (index: number) => void;
  isShortcutsOpen?: boolean;
  setIsShortcutsOpen?: (open: boolean) => void;
  isHistoryOpen?: boolean;
  setIsHistoryOpen?: (open: boolean) => void;
}

const EditorWorkspaceComponent: React.FC<EditorWorkspaceProps> = ({
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
  handleDeleteProjectAsset,
  historyStack = [],
  redoStack = [],
  handleJumpToState,
  isShortcutsOpen: propIsShortcutsOpen,
  setIsShortcutsOpen: propSetIsShortcutsOpen,
  isHistoryOpen: propIsHistoryOpen,
  setIsHistoryOpen: propSetIsHistoryOpen,
}) => {
  const [localShortcutsOpen, setLocalShortcutsOpen] = React.useState(false);
  const [localHistoryOpen, setLocalHistoryOpen] = React.useState(false);

  const isShortcutsOpen = propIsShortcutsOpen !== undefined ? propIsShortcutsOpen : localShortcutsOpen;
  const setIsShortcutsOpen = propSetIsShortcutsOpen || setLocalShortcutsOpen;

  const isHistoryOpen = propIsHistoryOpen !== undefined ? propIsHistoryOpen : localHistoryOpen;
  const setIsHistoryOpen = propSetIsHistoryOpen || setLocalHistoryOpen;

  const activeModalRef = React.useRef(activeModal);
  activeModalRef.current = activeModal;

  const handleOpenEditModal = React.useCallback(
    (clipId: string, clipType?: string) => {
      soundEngine.playSfx("click");
      setSelectedClipId(clipId);
      let resolvedType = clipType || selectedClipType;
      if (!resolvedType && project) {
        if (project.tracks.captions?.some((c) => c.id === clipId))
          resolvedType = "caption";
        else if (project.tracks.text?.some((c) => c.id === clipId))
          resolvedType = "text";
        else if (project.tracks.stickers?.some((c) => c.id === clipId))
          resolvedType = "stickers";
        else if (project.tracks.video?.some((c) => c.id === clipId)) {
          const v = project.tracks.video.find((c) => c.id === clipId);
          resolvedType =
            v?.type === "photo" || (v as any)?.isPhoto ? "photo" : "video";
        } else if (project.tracks.audio?.some((c) => c.id === clipId))
          resolvedType = "audio";
        else if (project.tracks.effects?.some((c) => c.id === clipId))
          resolvedType = "effects";
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
    [
      project,
      selectedClipType,
      setSelectedClipId,
      setSelectedClipType,
      openModal,
    ],
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
          resolvedType =
            v?.type === "photo" || (v as any)?.isPhoto ? "photo" : "video";
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
        let isToolSupported = availableMenus
          ? availableMenus.has(currentModal)
          : false;

        // Special audio check: if video clip has no audio track, audio-related tools are not available
        if (
          normalizedType === "video" &&
          targetClip &&
          !mediaHasAudioTrack(targetClip)
        ) {
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
    [project, activeModal, openModal, setSelectedClipId, setSelectedClipType],
  );

  const resolveActiveClipId = React.useCallback(
    (type: "video" | "audio" = "video") => {
      if (selectedClipId) return selectedClipId;
      if (!project) return null;
      const cur = currentTime || 0;
      if (type === "audio") {
        const audio =
          project.tracks?.audio?.find(
            (c: any) => cur >= c.startTime && cur <= c.startTime + c.duration,
          ) || project.tracks?.audio?.[0];
        return audio ? audio.id : null;
      }
      const video =
        project.tracks?.video?.find(
          (c: any) => cur >= c.startTime && cur <= c.startTime + c.duration,
        ) || project.tracks?.video?.[0];
      return video ? video.id : null;
    },
    [project, selectedClipId, currentTime],
  );

  const handleApplyFilter = React.useCallback(
    (filter: string, intensity?: number) => {
      if (!project) return;
      const safeIntensity = intensity ?? 80;

      // 1. VISUAL CLIP ATTACHED: If a video or photo/image clip is currently selected, attach the filter to that clip!
      const isVisualClip = Boolean(
        selectedClipId &&
          (selectedClipType === "video" ||
            selectedClipType === "photo" ||
            selectedClipType === "image" ||
            (project.tracks?.video || []).some((c: any) => c.id === selectedClipId))
      );

      if (isVisualClip) {
        const isNone = filter === "none" || filter === "normal";
        const updatedVideos = (project.tracks?.video || []).map((c: any) =>
          c.id === selectedClipId
            ? {
                ...c,
                filter: isNone ? undefined : filter,
                filterIntensity: safeIntensity,
              }
            : c,
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
      if (
        (selectedClipType === "effects" || selectedClipType === "effect") &&
        selectedClipId
      ) {
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
    [
      project,
      selectedClipId,
      selectedClipType,
      currentTime,
      updateProjectWithHistory,
      setSelectedClipId,
      setSelectedClipType,
    ],
  );

  const handleApplySpeed = React.useCallback(
    (speed: number, curve?: string, pitch?: boolean) => {
      const targetId = resolveActiveClipId("video");
      if (!targetId || !project) return;
      const updatedVideos = (project.tracks?.video || []).map((c: any) =>
        c.id === targetId
          ? { ...c, speed, speedCurve: curve, keepPitch: pitch }
          : c,
      );
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          video: updatedVideos,
        },
      });
    },
    [project, resolveActiveClipId, updateProjectWithHistory],
  );

  const handleApplyVolume = React.useCallback(
    (volume: number, fade?: { in: number; out: number }) => {
      const targetId = resolveActiveClipId(
        selectedClipType === "audio" ? "audio" : "video",
      );
      if (!targetId || !project) return;
      const updatedVideos = (project.tracks?.video || []).map((c: any) =>
        c.id === targetId
          ? { ...c, volume, fadeIn: fade?.in, fadeOut: fade?.out }
          : c,
      );
      const updatedAudios = (project.tracks?.audio || []).map((c: any) =>
        c.id === targetId
          ? { ...c, volume, fadeIn: fade?.in, fadeOut: fade?.out }
          : c,
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
    [project, selectedClipType, resolveActiveClipId, updateProjectWithHistory],
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
    [currentTime, project, updateProjectWithHistory],
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
    [currentTime, project, updateProjectWithHistory],
  );

  const handleAddEffect = React.useCallback(
    (nameOrPreset: any) => {
      if (!project) return;

      const effType =
        typeof nameOrPreset === "string"
          ? nameOrPreset
          : nameOrPreset?.type || nameOrPreset?.id;
      const isNone = !effType || effType === "none" || effType === "None";
      const effInt =
        typeof nameOrPreset === "object" &&
        nameOrPreset?.intensity !== undefined
          ? nameOrPreset.intensity
          : 0.8;

      // 1. VISUAL CLIP ATTACHED: If a video or photo/image clip is currently selected, attach the effect to that clip!
      const isVisualClip = Boolean(
        selectedClipId &&
          (selectedClipType === "video" ||
            selectedClipType === "photo" ||
            selectedClipType === "image" ||
            (project.tracks?.video || []).some((c: any) => c.id === selectedClipId))
      );

      if (isVisualClip) {
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
      if (
        (selectedClipType === "effects" || selectedClipType === "effect") &&
        selectedClipId
      ) {
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
              name:
                (typeof nameOrPreset === "object" && nameOrPreset?.name) ||
                effType ||
                "Effect",
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
        name:
          (typeof nameOrPreset === "object" && nameOrPreset?.name) ||
          effType ||
          "Glitch",
        startTime: Math.max(0, Number(desiredStart.toFixed(3))),
        duration:
          (typeof nameOrPreset === "object" && nameOrPreset?.duration) || 3,
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
    [
      currentTime,
      project,
      selectedClipId,
      selectedClipType,
      updateProjectWithHistory,
      setSelectedClipId,
      setSelectedClipType,
    ],
  );

  // Determine platform layout via standard responsive dimensions hook
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Desktop: track which left-panel tab is open
  const [desktopTab, setDesktopTab] =
    React.useState<DesktopResourceTab>("media");
  const [isMediaPanelCollapsed, setIsMediaPanelCollapsed] =
    React.useState(false);
  const [isConfigPanelExpanded, setIsConfigPanelExpanded] =
    React.useState(true);
  const [configPanelWidth, setConfigPanelWidth] = React.useState(320);
  const [mediaPanelWidth, setMediaPanelWidth] = React.useState(260);
  const [desktopPanelOrder, setDesktopPanelOrder] = React.useState<
    "config_left" | "media_left"
  >("media_left");

  const handleConfigResizeStart = React.useCallback(
    (e: any) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      const startX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
      const startWidth = configPanelWidth;

      const onMove = (moveEv: any) => {
        const currentX =
          moveEv.clientX || (moveEv.touches && moveEv.touches[0]?.clientX) || 0;
        const delta =
          desktopPanelOrder === "config_left"
            ? currentX - startX
            : startX - currentX;
        const nextW = Math.max(220, Math.min(520, startWidth + delta));
        setConfigPanelWidth(nextW);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onUp);
    },
    [configPanelWidth, desktopPanelOrder],
  );

  const handleMediaResizeStart = React.useCallback(
    (e: any) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      const startX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
      const startWidth = mediaPanelWidth;

      const onMove = (moveEv: any) => {
        const currentX =
          moveEv.clientX || (moveEv.touches && moveEv.touches[0]?.clientX) || 0;
        const delta =
          desktopPanelOrder === "config_left"
            ? startX - currentX
            : currentX - startX;
        const nextW = Math.max(200, Math.min(520, startWidth + delta));
        setMediaPanelWidth(nextW);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onUp);
    },
    [mediaPanelWidth, desktopPanelOrder],
  );

  const hasDesktopRightPanel =
    isDesktop && !!activeModal && INLINE_MODAL_KEYS.has(activeModal);
  const isMobileInlineActive =
    !isDesktop && !!activeModal && INLINE_MODAL_KEYS.has(activeModal);

  // Unified timeline & dock height resize logic
  const {
    timelineHeight: currentTimelineHeight,
    setTimelineHeight: setCurrentTimelineHeight,
    isResizingHeight: isTimelineResizing,
    resizeHandleProps: timelineResizeProps,
    handleResetResizeHeight,
  } = useTimelineResize({
    isMobile: !isDesktop,
    windowHeight,
  });

  // Unified Root Draggable Bottom Container (Hosts either Tool Modal OR Timeline)
  const defaultMobileToolHeight = React.useMemo(() => {
    return Math.min(
      Math.round(windowHeight * 0.50),
      Math.max(300, Math.round(windowHeight * 0.44)),
    );
  }, [windowHeight]);

  const minMobileToolHeight = 220;

  const maxMobileToolHeight = React.useMemo(() => {
    // Guarantees at least 250px vertical clearance for Header + Player at all times
    return Math.min(
      Math.round(windowHeight * 0.60),
      Math.max(minMobileToolHeight, windowHeight - 250),
    );
  }, [windowHeight, minMobileToolHeight]);

  const [mobileModalHeight, setMobileModalHeight] = React.useState<number | null>(null);

  // Active height of the root draggable bottom container
  const activeBottomHeight = React.useMemo(() => {
    if (isDesktop) return currentTimelineHeight;
    if (isMobileInlineActive) {
      if (mobileModalHeight !== null) {
        return Math.max(minMobileToolHeight, Math.min(maxMobileToolHeight, mobileModalHeight));
      }
      return defaultMobileToolHeight;
    }
    return Math.max(180, Math.min(maxMobileToolHeight, currentTimelineHeight));
  }, [isDesktop, isMobileInlineActive, mobileModalHeight, defaultMobileToolHeight, minMobileToolHeight, maxMobileToolHeight, currentTimelineHeight]);

  const activeBottomHeightRef = React.useRef(activeBottomHeight);
  activeBottomHeightRef.current = activeBottomHeight;

  // Single unified translation & drag state for root bottom container
  const bottomTranslateY = React.useRef(new Animated.Value(0)).current;
  const [isDraggingBottom, setIsDraggingBottom] = React.useState(false);
  const isDraggingBottomRef = React.useRef(false);

  // Reset modal state whenever activeModal changes
  React.useEffect(() => {
    bottomTranslateY.setValue(0);
    setIsDraggingBottom(false);
    isDraggingBottomRef.current = false;
    setMobileModalHeight(null);
  }, [activeModal, bottomTranslateY]);

  // Robust pointer/touch Y-coordinate extractor across all mobile browsers and environments
  const getPointerClientY = (evt: any): number => {
    if (typeof evt.clientY === "number") return evt.clientY;
    if (typeof evt.pageY === "number") return evt.pageY;
    if (evt.nativeEvent) {
      if (typeof evt.nativeEvent.clientY === "number") return evt.nativeEvent.clientY;
      if (typeof evt.nativeEvent.pageY === "number") return evt.nativeEvent.pageY;
      if (evt.nativeEvent.touches && evt.nativeEvent.touches.length > 0) {
        const t = evt.nativeEvent.touches[0];
        if (typeof t.clientY === "number") return t.clientY;
        if (typeof t.pageY === "number") return t.pageY;
      }
      if (evt.nativeEvent.changedTouches && evt.nativeEvent.changedTouches.length > 0) {
        const t = evt.nativeEvent.changedTouches[0];
        if (typeof t.clientY === "number") return t.clientY;
        if (typeof t.pageY === "number") return t.pageY;
      }
    }
    if (evt.touches && evt.touches.length > 0) {
      const t = evt.touches[0];
      if (typeof t.clientY === "number") return t.clientY;
      if (typeof t.pageY === "number") return t.pageY;
    }
    return 0;
  };

  // Unified Web pointer & touch drag handler
  const handleBottomDragStart = React.useCallback(
    (e: any) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      e.preventDefault?.();
      e.stopPropagation?.();

      const startY = getPointerClientY(e);
      const startHeight = activeBottomHeightRef.current;
      let lastDy = 0;
      let rafHandle: number | null = null;
      isDraggingBottomRef.current = true;
      setIsDraggingBottom(true);

      const onPointerMove = (moveEvt: any) => {
        const clientY = getPointerClientY(moveEvt);
        const dy = clientY - startY;
        lastDy = dy;

        if (rafHandle === null) {
          rafHandle = requestAnimationFrame(() => {
            rafHandle = null;
            if (isMobileInlineActive) {
              // Strictly clamp height; never translate downwards to dismiss
              const targetH = Math.max(
                minMobileToolHeight,
                Math.min(maxMobileToolHeight, startHeight - dy),
              );
              setMobileModalHeight(targetH);
              bottomTranslateY.setValue(0);
            } else {
              bottomTranslateY.setValue(0);
              const nextH = Math.max(
                180,
                Math.min(maxMobileToolHeight, startHeight - dy),
              );
              setCurrentTimelineHeight(nextH);
            }
          });
        }
      };

      const onPointerUp = () => {
        if (rafHandle !== null) {
          cancelAnimationFrame(rafHandle);
          rafHandle = null;
        }
        isDraggingBottomRef.current = false;
        setIsDraggingBottom(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        window.removeEventListener("touchmove", onPointerMove);
        window.removeEventListener("touchend", onPointerUp);
        window.removeEventListener("touchcancel", onPointerUp);

        if (isMobileInlineActive) {
          // Never dismiss modal on drag-down; only snap between height bounds.
          // Modals close ONLY with the explicit close button or check/done button.
          bottomTranslateY.setValue(0);
          if (lastDy < -35) {
            setMobileModalHeight(maxMobileToolHeight);
          } else if (lastDy > 35) {
            setMobileModalHeight(defaultMobileToolHeight);
          }
        }
      };

      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);
      window.addEventListener("touchmove", onPointerMove, { passive: false });
      window.addEventListener("touchend", onPointerUp);
      window.addEventListener("touchcancel", onPointerUp);
    },
    [
      isMobileInlineActive,
      maxMobileToolHeight,
      minMobileToolHeight,
      defaultMobileToolHeight,
      setCurrentTimelineHeight,
      bottomTranslateY,
    ],
  );

  // Unified Native PanResponder for iOS / Android
  const bottomDragPanResponder = React.useMemo(() => {
    let startHeight = activeBottomHeightRef.current;
    let accumulatedDy = 0;
    let rafHandle: number | null = null;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startHeight = activeBottomHeightRef.current;
        isDraggingBottomRef.current = true;
        setIsDraggingBottom(true);
        accumulatedDy = 0;
      },
      onPanResponderMove: (_, gs) => {
        accumulatedDy = gs.dy;
        if (rafHandle === null) {
          rafHandle = requestAnimationFrame(() => {
            rafHandle = null;
            if (isMobileInlineActive) {
              // Strictly clamp height; never translate downwards to dismiss
              const targetH = Math.max(
                minMobileToolHeight,
                Math.min(maxMobileToolHeight, startHeight - gs.dy),
              );
              setMobileModalHeight(targetH);
              bottomTranslateY.setValue(0);
            } else {
              bottomTranslateY.setValue(0);
              const nextH = Math.max(
                180,
                Math.min(maxMobileToolHeight, startHeight - gs.dy),
              );
              setCurrentTimelineHeight(nextH);
            }
          });
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (rafHandle !== null) {
          cancelAnimationFrame(rafHandle);
          rafHandle = null;
        }
        isDraggingBottomRef.current = false;
        setIsDraggingBottom(false);

        if (isMobileInlineActive) {
          // Never dismiss modal on drag-down; only snap between height bounds.
          // Modals close ONLY with the explicit close button or check/done button.
          bottomTranslateY.setValue(0);
          if (accumulatedDy < -35) {
            setMobileModalHeight(maxMobileToolHeight);
          } else if (accumulatedDy > 35) {
            setMobileModalHeight(defaultMobileToolHeight);
          }
        }
      },
      onPanResponderTerminate: () => {
        if (rafHandle !== null) {
          cancelAnimationFrame(rafHandle);
          rafHandle = null;
        }
        isDraggingBottomRef.current = false;
        setIsDraggingBottom(false);
        bottomTranslateY.setValue(0);
      },
    });
  }, [
    isMobileInlineActive,
    maxMobileToolHeight,
    minMobileToolHeight,
    defaultMobileToolHeight,
    setCurrentTimelineHeight,
    bottomTranslateY,
  ]);

  // Label for active config panel
  const getConfigPanelTitle = () => {
    const TITLES: Record<string, string> = {
      media: "📁 Media",
      overlay: "📁 Media",
      audio: "🎵 Audio Studio",
      filters: "🎨 Filters",
      transform: "⚙️ Transform",
      mask: "🔶 Mask",
      speed: "⚡ Speed",
      volume: "🔊 Volume & Fade",
      text: "✏️ Text",
      stickers: "🎭 Stickers",
      effects: "✨ Effects",
      captions: "💬 Captions",
      transitions: "↔️ Transitions",
      enhance: "💎 AI Enhance",
      autocut: "✂️ AutoCut",
      canvas: "📐 Canvas",
      background: "🖼️ Background",
      keyframe: "◆ Keyframe",
      cutout: "✂️ Cutout",
      tracking: "🎯 Tracking & Blur",
      layer: "📑 Layer Order",
      opacity: "👁️ Opacity",
      animation: "🎬 Animation",
      audio_effects: "🎙️ Audio FX",
      voice_effects: "🎙️ Voice FX",
      blend: "🎨 Blend Mode",
      hsl: "🌈 HSL Color",
    };
    return activeModal ? TITLES[activeModal] || activeModal : "";
  };
  // Auto-expand config panel when switching tools
  React.useEffect(() => {
    if (activeModal && INLINE_MODAL_KEYS.has(activeModal)) {
      setIsConfigPanelExpanded(true);
    }
  }, [activeModal]);

  // Memoized main clip selector for toolbar
  const handleSelectMainClip = useCallback(() => {
    if (project?.tracks?.video && project.tracks.video.length > 0) {
      const cur = currentTime || 0;
      const target =
        project.tracks.video.find(
          (c) => cur >= c.startTime && cur <= c.startTime + c.duration,
        ) || project.tracks.video[0];
      if (target) {
        setSelectedClipId(target.id);
        setSelectedClipType("video");
      }
    }
  }, [project?.tracks?.video, currentTime, setSelectedClipId, setSelectedClipType]);

  // Unified Toolbar renderer (horizontal at bottom for mobile, vertical on whole left for laptop)
  const renderToolbar = (
    orientation: "horizontal" | "vertical" = "horizontal",
  ) => (
    <Toolbar
      settings={settings}
      orientation={orientation}
      activeToolId={activeModal || undefined}
      selectedClip={selectedClip}
      selectedClipType={selectedClipType}
      onDeselectClip={handleDeselectClip}
      onSelectMainClip={handleSelectMainClip}
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
      onOpenBackgroundModal={
        handleOpenBackgroundModal || (() => openModal("background"))
      }
      onOpenCutoutModal={handleOpenCutoutModal}
      onOpenMotionTracking={handleOpenMotionTracking}
      onOpenKeyframeModal={onOpenKeyframeModal}
      onOpenAutoCaptions={handleOpenAutoCaptions}
      onOpenTransitionsModal={() =>
        handleOpenTransitionsModal(selectedClipId || "")
      }
      onToggleDenoise={handleToggleDenoise}
      onExtractAudio={handleExtractAudio}
      project={project}
      onApplyFilter={handleApplyFilter}
      onApplySpeed={handleApplySpeed}
      onApplyVolume={handleApplyVolume}
      onApplyRatio={(ratio) =>
        updateProjectWithHistory({ ...project, aspectRatio: ratio })
      }
      onApplyCanvasBg={(bg) =>
        updateProjectWithHistory({ ...project, canvasBackground: bg })
      }
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

  const handleOpenMediaModal = useCallback(() => openModal("media"), [openModal]);
  const handleOpenTextModalCb = useCallback(() => openModal("text"), [openModal]);
  const handleOpenAudioModalCb = useCallback(() => openModal("audio"), [openModal]);
  const handleOpenEffectsModalCb = useCallback(() => openModal("effects"), [openModal]);
  const handleOpenStickersModalCb = useCallback(() => openModal("stickers"), [openModal]);

  const handleAdjustDuration = useCallback(
    (delta: number) => {
      if (!selectedClipId) return;
      const key = (
        selectedClipType === "caption" || selectedClipType === "captions"
          ? "captions"
          : selectedClipType === "sticker" || selectedClipType === "stickers"
            ? "stickers"
            : selectedClipType
      ) as keyof typeof project.tracks;
      const list = [...((project.tracks as any)[key] || [])];
      const idx = list.findIndex((c: any) => c.id === selectedClipId);
      if (idx >= 0) {
        const newDur = Math.max(0.05, (list[idx].duration || 0) + delta);
        list[idx] = { ...list[idx], duration: Number(newDur.toFixed(3)) };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, [key]: list } as any,
        });
      }
    },
    [selectedClipId, selectedClipType, project, updateProjectWithHistory],
  );

  const handleAddMediaCb = useCallback(
    (clip: any) => {
      if (handleAddMedia) handleAddMedia(clip);
      else {
        const videos = [...(project.tracks?.video || []), clip];
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: videos },
        });
      }
    },
    [handleAddMedia, project, updateProjectWithHistory],
  );

  const handleAddAudioCb = useCallback(
    (clip: any) => {
      if (handleAddAudio) handleAddAudio(clip);
      else {
        const audios = [...(project.tracks?.audio || []), clip];
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, audio: audios },
        });
      }
    },
    [handleAddAudio, project, updateProjectWithHistory],
  );

  // Build the multi-track timeline
  const renderTimelineOnly = () => (
    <Timeline
      timelineHeight={currentTimelineHeight}
      isResizingHeight={isDraggingBottom || isTimelineResizing}
      resizeHandleProps={timelineResizeProps}
      handleResetResizeHeight={handleResetResizeHeight}
      project={project}
      currentTime={currentTime}
      totalDuration={totalDuration}
      isPlaying={isPlaying}
      onSeek={setCurrentTime}
      selectedClipId={selectedClipId}
      selectedClipType={selectedClipType}
      onSelectClip={handleSelectClipWithMenuSwitch}
      onTrimClip={handleTrimClip}
      onMoveClip={handleMoveClip}
      onOpenTransitions={handleOpenTransitionsModal}
      onOpenMediaPicker={handleOpenMediaModal}
      onOpenTextModal={handleOpenTextModalCb}
      onOpenAudioModal={handleOpenAudioModalCb}
      onOpenEffectsModal={handleOpenEffectsModalCb}
      onOpenStickersModal={handleOpenStickersModalCb}
      zoom={zoom}
      onZoomChange={setZoom}
      onAdjustDuration={handleAdjustDuration}
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
      onAddMedia={handleAddMediaCb}
      onAddAudio={handleAddAudioCb}
    />
  );

  const handleUpdateClipMotionTrack = (track: MotionTrackConfig) => {
    if (!project || !selectedClipId) return;
    const current = { ...project };
    const vIdx = (current.tracks.video || []).findIndex(
      (v) => v.id === selectedClipId,
    );
    if (vIdx >= 0) {
      const video = [...current.tracks.video];
      video[vIdx] = { ...video[vIdx], motionTrack: track };
      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, video },
      });
      return;
    }
    const tIdx = (current.tracks.text || []).findIndex(
      (t) => t.id === selectedClipId,
    );
    if (tIdx >= 0) {
      const text = [...current.tracks.text];
      text[tIdx] = { ...text[tIdx], motionTrack: track };
      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, text },
      });
      return;
    }
    const sIdx = (current.tracks.stickers || []).findIndex(
      (s) => s.id === selectedClipId,
    );
    if (sIdx >= 0) {
      const stickers = [...current.tracks.stickers];
      stickers[sIdx] = { ...stickers[sIdx], motionTrack: track };
      updateProjectWithHistory({
        ...current,
        tracks: { ...current.tracks, stickers },
      });
      return;
    }
  };

  const handleRelinkClip = (
    clipId: string,
    clipType: string,
    newUrl: string,
    sourceMediaId?: string,
  ) => {
    if (!project) return;
    let changed = false;
    const targetSourceId = sourceMediaId || clipId;

    const updatedVideo = (project.tracks.video || []).map((c: any) => {
      const match =
        c.id === clipId ||
        c.sourceMediaId === targetSourceId ||
        (sourceMediaId && c.sourceMediaId === sourceMediaId);
      if (match) {
        changed = true;
        return {
          ...c,
          url: newUrl,
          sourceMediaId: targetSourceId,
          isMissing: false,
          needsPermission: false,
        };
      }
      return c;
    });

    const updatedAudio = (project.tracks.audio || []).map((c: any) => {
      const match =
        c.id === clipId ||
        c.sourceMediaId === targetSourceId ||
        (sourceMediaId && c.sourceMediaId === sourceMediaId);
      if (match) {
        changed = true;
        return {
          ...c,
          url: newUrl,
          sourceMediaId: targetSourceId,
          isMissing: false,
          needsPermission: false,
        };
      }
      return c;
    });

    if (changed) {
      updateProjectWithHistory({
        ...project,
        tracks: {
          ...project.tracks,
          video: updatedVideo,
          audio: updatedAudio,
        },
      });
    }
  };

  // Player JSX shared between desktop and mobile
  const renderPlayer = () => (
    <ErrorBoundary fallbackTitle="Player Preview">
      <Player
        project={project}
        currentTime={currentTime}
        isPlaying={isPlaying}
        totalDuration={totalDuration}
        fullscreen={isFullscreen}
        isProcessing={isProcessing}
        isResizing={isDraggingBottom || isTimelineResizing}
        processingMessage={processingMessage}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        onTogglePlay={() => {
          if (totalDuration <= 0) {
            soundEngine.playSfx("click");
            pauseActiveVideoRenderer();
            pauseAllAudio();
            setIsPlaying(false);
            setCurrentTime(0);
            return;
          }
          soundEngine.playSfx("click");
          if (isPlaying) {
            pauseActiveVideoRenderer();
            pauseAllAudio();
            setIsPlaying(false);
          } else {
            const needsPermClips = [
              ...(project?.tracks?.video || []),
              ...(project?.tracks?.audio || []),
            ].filter((c: any) => c.needsPermission);
            for (const c of needsPermClips) {
              const lookupId = c.sourceMediaId || c.id;
              reconnectLinkedMedia(lookupId, c.title).then((res) => {
                if (res) {
                  handleRelinkClip(
                    c.id,
                    (c as any).type || "video",
                    res.url,
                    lookupId,
                  );
                }
              });
            }
            if (
              currentTime >= totalDuration - 0.05 ||
              currentTime >= totalDuration
            ) {
              setCurrentTime(0);
            }
            setIsPlaying(true);
          }
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
        onUpdateClipMask={(clipId, mask, isFinal) =>
          handleUpdateClipMask &&
          handleUpdateClipMask(clipId, mask, isFinal, currentTime)
        }
        activeModal={activeModal}
        onUpdateClipMotionTrack={handleUpdateClipMotionTrack}
        onRelinkClip={handleRelinkClip}
      />
    </ErrorBoundary>
  );

  // ─────────────────────────────────────────────
  // DESKTOP LAYOUT:
  // [Vertical Toolbar] | [Config Panel (LEFT, when tool active)] | [Player (CENTER, flex:1)] | [Media & Audio Panel (RIGHT)]
  // Bottom: Full-width Timeline
  // ─────────────────────────────────────────────
  if (isDesktop && !isFullscreen) {
    const addMediaFn = (clip: any) => {
      if (handleAddMedia) handleAddMedia(clip);
      else
        updateProjectWithHistory({
          ...project,
          tracks: {
            ...project.tracks,
            video: [...(project.tracks?.video || []), clip],
          },
        });
    };
    const addAudioFn = (clip: any) => {
      if (handleAddAudio) handleAddAudio(clip);
      else
        updateProjectWithHistory({
          ...project,
          tracks: {
            ...project.tracks,
            audio: [...(project.tracks?.audio || []), clip],
          },
        });
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
            onOpenUndoHistory={() => setIsHistoryOpen(true)}
            onOpenKeyboardShortcuts={() => setIsShortcutsOpen(true)}
          />

          {/* Middle Row: Config Panel & Media Panel & Player with Draggable Splitters */}
          <View style={styles.desktopPlayerRow}>
            {desktopPanelOrder === "config_left" ? (
              <>
                {/* [1] Config / Inspector Panel (LEFT) */}
                {isConfigPanelExpanded ? (
                  hasDesktopRightPanel ? (
                    <View
                      style={[
                        styles.desktopConfigPanel,
                        { width: configPanelWidth },
                      ]}
                      {...(Platform.OS === "web"
                        ? {
                            onDragOver: (e: any) => e.preventDefault(),
                            onDrop: (e: any) => {
                              e.preventDefault();
                              setDesktopPanelOrder("media_left");
                            },
                          }
                        : {})}
                    >
                      {/* Config Panel Header */}
                      <View style={styles.desktopConfigPanelHeader}>
                        <View
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            cursor: "grab" as any,
                          }}
                          {...(Platform.OS === "web"
                            ? {
                                draggable: true,
                                onDragStart: (e: any) => {
                                  e.dataTransfer?.setData(
                                    "text/plain",
                                    "panel_config",
                                  );
                                },
                              }
                            : {})}
                        >
                          <Ionicons
                            name="reorder-two"
                            size={15}
                            color="#71717A"
                          />
                          <Text
                            style={styles.desktopConfigPanelTitle}
                            numberOfLines={1}
                          >
                            {getConfigPanelTitle()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setDesktopPanelOrder("media_left")}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Swap panels: Media Left, Tool Right"
                        >
                          <Ionicons
                            name="swap-horizontal"
                            size={14}
                            color="#71717A"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setIsConfigPanelExpanded(false)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Collapse tool panel"
                        >
                          <Ionicons
                            name="chevron-back"
                            size={15}
                            color="#71717A"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.desktopPanelIconBtn,
                            { marginLeft: 2 },
                          ]}
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
                      onUpdateProject={(updates) =>
                        updateProjectWithHistory(updates)
                      }
                      onUpdateClipTransform={(clipId, transform, isFinal) =>
                        handleUpdateClipTransform(
                          clipId,
                          selectedClipType,
                          transform as any,
                          isFinal,
                        )
                      }
                      onUpdateClipCrop={(clipId, crop) =>
                        handleUpdateClipCrop(clipId, crop, true)
                      }
                      onUpdateClipMask={(clipId, mask, isFinal) =>
                        handleUpdateClipMask &&
                        handleUpdateClipMask(clipId, mask, isFinal, currentTime)
                      }
                      onApplyVolume={(vol, fIn, fOut) =>
                        handleApplyVolume(vol, { in: fIn, out: fOut })
                      }
                      onApplySpeed={(speed, curve) =>
                        handleApplySpeed(speed, curve)
                      }
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
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={THEME_COLORS.accent}
                    />
                    <Text
                      style={styles.desktopConfigPanelCollapsedLabel}
                      numberOfLines={6}
                    >
                      {hasDesktopRightPanel
                        ? getConfigPanelTitle()
                        : selectedClip
                          ? selectedClip.title || "Clip"
                          : "Inspector"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Resizer Splitter between Left Panel & Center Player */}
                {isConfigPanelExpanded && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === "web"
                      ? {
                          onMouseDown: handleConfigResizeStart,
                          onTouchStart: handleConfigResizeStart,
                        }
                      : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [2] Player (CENTER) */}
                <View style={styles.desktopPlayerArea}>{renderPlayer()}</View>

                {/* Resizer Splitter between Center Player & Right Media Panel */}
                {!isMediaPanelCollapsed && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === "web"
                      ? {
                          onMouseDown: handleMediaResizeStart,
                          onTouchStart: handleMediaResizeStart,
                        }
                      : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [3] Media & Resource Library Panel (RIGHT) - Default Opened */}
                <DesktopMediaAudioPanel
                  project={project}
                  activeTab={desktopTab}
                  onSelectTab={(tab) => setDesktopTab(tab)}
                  onAddMedia={addMediaFn}
                  onAddAudio={addAudioFn}
                  onAddText={(txt, col) => handleAddText(txt, col)}
                  onAddSticker={(stk) => handleAddSticker(stk)}
                  onAddEffect={(eff) => handleAddEffect(eff)}
                  onAddTransition={(trId) =>
                    handleOpenTransitionsModal(selectedClipId || "")
                  }
                  currentTime={currentTime}
                  onDeleteMedia={handleDeleteProjectAsset || handleDeleteClip}
                  width={mediaPanelWidth}
                  position="right"
                  onSwapPosition={() => setDesktopPanelOrder("media_left")}
                  isCollapsed={isMediaPanelCollapsed}
                  onToggleCollapse={() =>
                    setIsMediaPanelCollapsed((prev) => !prev)
                  }
                />
              </>
            ) : (
              <>
                {/* [1] Media & Resource Library Panel (LEFT) - Default Opened */}
                <DesktopMediaAudioPanel
                  project={project}
                  activeTab={desktopTab}
                  onSelectTab={(tab) => setDesktopTab(tab)}
                  onAddMedia={addMediaFn}
                  onAddAudio={addAudioFn}
                  onAddText={(txt, col) => handleAddText(txt, col)}
                  onAddSticker={(stk) => handleAddSticker(stk)}
                  onAddEffect={(eff) => handleAddEffect(eff)}
                  onAddTransition={(trId) =>
                    handleOpenTransitionsModal(selectedClipId || "")
                  }
                  currentTime={currentTime}
                  onDeleteMedia={handleDeleteProjectAsset || handleDeleteClip}
                  width={mediaPanelWidth}
                  position="left"
                  onSwapPosition={() => setDesktopPanelOrder("config_left")}
                  isCollapsed={isMediaPanelCollapsed}
                  onToggleCollapse={() =>
                    setIsMediaPanelCollapsed((prev) => !prev)
                  }
                />

                {/* Resizer Splitter between Left Media Panel & Center Player */}
                {!isMediaPanelCollapsed && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === "web"
                      ? {
                          onMouseDown: handleMediaResizeStart,
                          onTouchStart: handleMediaResizeStart,
                        }
                      : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [2] Player (CENTER) */}
                <View style={styles.desktopPlayerArea}>{renderPlayer()}</View>

                {/* Resizer Splitter between Center Player & Right Config/Inspector Panel */}
                {isConfigPanelExpanded && (
                  <View
                    style={styles.desktopResizeSplitter}
                    {...(Platform.OS === "web"
                      ? {
                          onMouseDown: handleConfigResizeStart,
                          onTouchStart: handleConfigResizeStart,
                        }
                      : {})}
                  >
                    <View style={styles.resizeHandleBar} />
                  </View>
                )}

                {/* [3] Config / Inspector Panel (RIGHT) */}
                {isConfigPanelExpanded ? (
                  hasDesktopRightPanel ? (
                    <View
                      style={[
                        styles.desktopConfigPanel,
                        {
                          width: configPanelWidth,
                          borderRightWidth: 0,
                          borderLeftWidth: 1,
                          borderLeftColor: THEME_COLORS.borderSubtle,
                        },
                      ]}
                      {...(Platform.OS === "web"
                        ? {
                            onDragOver: (e: any) => e.preventDefault(),
                            onDrop: (e: any) => {
                              e.preventDefault();
                              setDesktopPanelOrder("config_left");
                            },
                          }
                        : {})}
                    >
                      {/* Config Panel Header */}
                      <View style={styles.desktopConfigPanelHeader}>
                        <View
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            cursor: "grab" as any,
                          }}
                          {...(Platform.OS === "web"
                            ? {
                                draggable: true,
                                onDragStart: (e: any) => {
                                  e.dataTransfer?.setData(
                                    "text/plain",
                                    "panel_config",
                                  );
                                },
                              }
                            : {})}
                        >
                          <Ionicons
                            name="reorder-two"
                            size={15}
                            color="#71717A"
                          />
                          <Text
                            style={styles.desktopConfigPanelTitle}
                            numberOfLines={1}
                          >
                            {getConfigPanelTitle()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setDesktopPanelOrder("config_left")}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Swap panels: Tool Left, Media Right"
                        >
                          <Ionicons
                            name="swap-horizontal"
                            size={14}
                            color="#71717A"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.desktopPanelIconBtn}
                          onPress={() => setIsConfigPanelExpanded(false)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Collapse tool panel"
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={15}
                            color="#71717A"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.desktopPanelIconBtn,
                            { marginLeft: 2 },
                          ]}
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
                      onUpdateProject={(updates) =>
                        updateProjectWithHistory(updates)
                      }
                      onUpdateClipTransform={(clipId, transform, isFinal) =>
                        handleUpdateClipTransform(
                          clipId,
                          selectedClipType,
                          transform as any,
                          isFinal,
                        )
                      }
                      onUpdateClipCrop={(clipId, crop) =>
                        handleUpdateClipCrop(clipId, crop, true)
                      }
                      onUpdateClipMask={(clipId, mask, isFinal) =>
                        handleUpdateClipMask &&
                        handleUpdateClipMask(clipId, mask, isFinal, currentTime)
                      }
                      onApplyVolume={(vol, fIn, fOut) =>
                        handleApplyVolume(vol, { in: fIn, out: fOut })
                      }
                      onApplySpeed={(speed, curve) =>
                        handleApplySpeed(speed, curve)
                      }
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
                    style={[
                      styles.desktopConfigPanelCollapsed,
                      {
                        borderRightWidth: 0,
                        borderLeftWidth: 1,
                        borderLeftColor: THEME_COLORS.borderSubtle,
                      },
                    ]}
                    onPress={() => setIsConfigPanelExpanded(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={14}
                      color={THEME_COLORS.accent}
                    />
                    <Text
                      style={styles.desktopConfigPanelCollapsedLabel}
                      numberOfLines={6}
                    >
                      {hasDesktopRightPanel
                        ? getConfigPanelTitle()
                        : selectedClip
                          ? selectedClip.title || "Clip"
                          : "Inspector"}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* ⑤ Bottom: Full-width Timeline */}
          <View style={styles.desktopTimelineArea}>{renderTimelineOnly()}</View>
        </View>

        {/* Global Modals for Desktop */}
        <KeyboardShortcutsModal
          visible={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />
        <UndoHistoryModal
          visible={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          historyStack={historyStack}
          redoStack={redoStack}
          currentProject={project}
          onJumpToState={handleJumpToState || (() => {})}
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // MOBILE / FULLSCREEN LAYOUT
  // 1. Root Top: Header
  // 2. Root Middle: Player Preview (flex: 1 fills remaining space)
  // 3. Root Bottom: Draggable Container (Modals OR Timeline directly at root!)
  // ─────────────────────────────────────────────
  return (
    <View style={styles.editorContainer}>
      {/* 1. Root Top: Header Bar */}
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
          onOpenUndoHistory={() => setIsHistoryOpen(true)}
          onOpenKeyboardShortcuts={() => setIsShortcutsOpen(true)}
        />
      )}

      {/* 2. Root Middle: Player Preview Stage (flex: 1 fills remaining space) */}
      <View
        style={[
          styles.playerStage,
          isFullscreen && styles.playerStageFullscreen,
        ]}
      >
        {renderPlayer()}
      </View>

      {/* 3. Root Bottom: Draggable Container (Modals OR Timeline directly at root!) */}
      {!isFullscreen && (
        <Animated.View
          style={[
            styles.draggableBottomRoot,
            {
              height: activeBottomHeight,
              transform: [{ translateY: bottomTranslateY }],
            },
          ]}
        >
          {/* Unified Grab Handle at the root of the draggable bottom section */}
          <View
            style={[
              styles.bottomDragHandle,
              isDraggingBottom && styles.bottomDragHandleActive,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 24, right: 24 }}
            {...(Platform.OS === "web"
              ? {
                  onMouseDown: handleBottomDragStart,
                  onTouchStart: handleBottomDragStart,
                }
              : bottomDragPanResponder.panHandlers)}
            accessibilityLabel={
              isMobileInlineActive
                ? "Drag up to expand tool, drag down to shrink tool"
                : "Drag up or down to adjust timeline height"
            }
          >
            <View
              style={[
                styles.bottomDragPill,
                isDraggingBottom && styles.bottomDragPillActive,
              ]}
            />
          </View>

          {/* Direct Root Content: Active Modal Tool OR Timeline + Toolbar */}
          {isMobileInlineActive ? (
            <View style={styles.modalContentRoot}>
              <View style={styles.modalHeaderBar}>
                <TouchableOpacity
                  style={styles.modalHeaderBtn}
                  onPress={handleCloseMenu}
                  activeOpacity={0.7}
                  accessibilityLabel="Close tool"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
                </TouchableOpacity>

                <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                  {getConfigPanelTitle()}
                </Text>

                <TouchableOpacity
                  style={styles.modalHeaderDoneBtn}
                  onPress={handleCloseMenu}
                  activeOpacity={0.7}
                  accessibilityLabel="Done"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="checkmark" size={15} color="#00E5FF" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBodyWrap}>
                {renderModals ? renderModals(true) : null}
              </View>
            </View>
          ) : (
            <View style={styles.timelineContentRoot}>
              <View style={styles.timelineBodyWrap}>
                {renderTimelineOnly()}
              </View>
              {renderToolbar("horizontal")}
            </View>
          )}
        </Animated.View>
      )}

      {/* Global Modals for Mobile */}
      <KeyboardShortcutsModal
        visible={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
      <UndoHistoryModal
        visible={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyStack={historyStack}
        redoStack={redoStack}
        currentProject={project}
        onJumpToState={handleJumpToState || (() => {})}
      />
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
    minHeight: 210,
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
  // ── Unified Root Draggable Bottom Container Styles ──
  draggableBottomRoot: {
    width: "100%",
    backgroundColor: "#0F131D",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: "hidden" as any,
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
    flexShrink: 0,
    zIndex: 30,
  },
  bottomDragHandle: {
    height: 15,
    width: "100%",
    backgroundColor: "#0D111A",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    cursor: "row-resize",
    userSelect: "none",
    touchAction: "none",
    zIndex: 50,
  } as any,
  bottomDragHandleActive: {
    backgroundColor: "#161D2B",
    borderBottomColor: "rgba(0, 242, 254, 0.4)",
  },
  bottomDragPill: {
    width: 32,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: "#4B5563",
  },
  bottomDragPillActive: {
    backgroundColor: "#00F2FE",
    width: 40,
  },
  modalContentRoot: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0F131D",
    overflow: "hidden" as any,
  },
  modalHeaderBar: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    backgroundColor: "#0D111A",
  },
  modalHeaderBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  modalHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  modalHeaderDoneBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 229, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.25)",
  },
  modalBodyWrap: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden" as any,
  },
  timelineContentRoot: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#08090E",
    overflow: "hidden" as any,
  },
  timelineBodyWrap: {
    flex: 1,
    width: "100%",
    height: "100%",
    minHeight: 120,
    overflow: "hidden" as any,
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

export const EditorWorkspace = React.memo(EditorWorkspaceComponent);
export default EditorWorkspace;
