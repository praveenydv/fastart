import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { theme } from "../constants/theme";
import { mediaHasAudioTrack } from "../utils/mediaAudioDetector";
import FastArtLogo from "./FastArtLogo";

export interface ToolbarProps {
  selectedClip: any | null;
  selectedClipType?: string;
  project?: any;
  onDeselectClip: () => void;
  onSelectMainClip?: () => void;
  onSplitClip: () => void;
  onDeleteClip: () => void;
  onDuplicateClip: () => void;
  onRotateClip?: () => void;
  onToggleReverse?: () => void;
  onOpenSpeedModal: () => void;
  onOpenVolumeModal?: () => void;
  onOpenCropModal?: () => void;
  onOpenTransformModal?: (
    tab?: "crop" | "flip" | "rotate" | "stretch" | "angle",
  ) => void;
  onOpenMaskModal?: () => void;
  onOpenAudioModal: () => void;
  onOpenTextModal: () => void;
  onOpenFiltersModal: () => void;
  onOpenEffectsModal: () => void;
  onOpenStickersModal: () => void;
  onOpenMediaPicker: () => void;
  onOpenEnhance?: () => void;
  onOpenAutoCut?: () => void;
  onOpenCutoutModal?: (mode?: "auto" | "chroma") => void;
  onOpenMotionTracking?: () => void;
  onOpenCanvasModal?: () => void;
  onOpenBackgroundModal?: () => void;
  onOpenKeyframeModal?: () => void;
  onOpenAutoCaptions?: () => void;
  onOpenTransitionsModal?: () => void;
  onToggleDenoise?: () => void;
  onExtractAudio?: () => void;
  onFreezeFrame?: () => void;
  onMoveClip?: (
    clipId: string,
    trackType: "text" | "video" | "audio" | "sticker" | "effects" | "caption",
    newStartTime: number,
    newTrackIndex?: number,
    isInsertNewTrack?: boolean,
  ) => void;
  onApplyFilter?: (filterId: string, intensity?: number) => void;
  onApplySpeed?: (speed: number) => void;
  onApplyVolume?: (volume: number) => void;
  onApplyRatio?: (ratio: string) => void;
  onApplyCanvasBg?: (bg: string) => void;
  onAddText?: (text: string, color?: string) => void;
  onAddSticker?: (label: string) => void;
  onAddEffect?: (effectId: string) => void;
  orientation?: "horizontal" | "vertical";
  onSelectDesktopTab?: (tab: "media" | "audio") => void;
  onOpenOpacityModal?: () => void;
  onOpenAnimationModal?: () => void;
  onOpenAudioEffectsModal?: () => void;
  onOpenBlendModal?: () => void;
  onOpenHSLModal?: () => void;
  onOpenTTSModal?: () => void;
  /** ID of the currently-open modal/panel — used to highlight the active toolbar button */
  activeToolId?: string;
  onCloseModal?: () => void;
  onBackToHome?: () => void;
}

// Global tools for whole video (when no clip is selected) - Matches CapCut
const ROOT_TOOLS = [
  { id: "overlay", title: "Overlay", icon: "layers-outline" as const },
  { id: "audio", title: "Audio", icon: "music-note" as const },
  { id: "text", title: "Text", icon: "format-text" as const },
  { id: "captions", title: "Caption", icon: "subtitles-outline" as const },
  { id: "effects", title: "Effect", icon: "auto-fix" as const },
  { id: "filters", title: "Filter", icon: "palette-outline" as const },
  { id: "stickers", title: "Sticker", icon: "emoticon-happy-outline" as const },
  { id: "canvas", title: "Canvas", icon: "aspect-ratio" as const },
  { id: "background", title: "BG", icon: "image-outline" as const },
];

// Clip-specific tools (when video clip is selected) - CapCut hierarchy
const VIDEO_CLIP_TOOLS = [
  { id: "speed", title: "Speed", icon: "speedometer" as const },
  {
    id: "volume",
    title: "Volume",
    icon: "volume-high" as const,
    requiresAudio: true,
  },
  { id: "animation", title: "Animation", icon: "play-circle-outline" as const },
  { id: "transform", title: "Transform", icon: "crop" as const },
  { id: "cutout", title: "Cutout", icon: "account-outline" as const },
  { id: "mask", title: "Mask", icon: "shape-outline" as const },
  { id: "blend", title: "Blend", icon: "layers-outline" as const },
  { id: "filters", title: "Filters", icon: "palette-outline" as const },
  { id: "hsl", title: "HSL Color", icon: "palette-swatch-outline" as const },
  { id: "effects", title: "Effect", icon: "auto-fix" as const },
  { id: "transitions", title: "Transit", icon: "swap-horizontal" as const },
  { id: "keyframe", title: "Keyframe", icon: "motion-play-outline" as const },
  { id: "opacity", title: "Opacity", icon: "opacity" as const },
  {
    id: "audio_effects",
    title: "Voice FX",
    icon: "microphone-outline" as const,
    requiresAudio: true,
  },
  { id: "tracking", title: "Track & Blur", icon: "crosshairs-gps" as const },
  {
    id: "extract_audio",
    title: "Extract",
    icon: "music-box-outline" as const,
    requiresAudio: true,
  },
  {
    id: "denoise",
    title: "Denoise",
    icon: "ear-hearing" as const,
    requiresAudio: true,
  },
  { id: "reverse", title: "Reverse", icon: "rewind" as const },
  { id: "freeze", title: "Freeze", icon: "snowflake" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

// Photo/Image-specific tools (tailored for still graphics, removing audio/speed)
const PHOTO_CLIP_TOOLS = [
  { id: "animation", title: "Animation", icon: "play-circle-outline" as const },
  { id: "transform", title: "Transform", icon: "crop" as const },
  { id: "cutout", title: "Cutout", icon: "account-outline" as const },
  { id: "mask", title: "Mask", icon: "shape-outline" as const },
  { id: "blend", title: "Blend", icon: "layers-outline" as const },
  { id: "filters", title: "Filters", icon: "palette-outline" as const },
  { id: "hsl", title: "HSL Color", icon: "palette-swatch-outline" as const },
  { id: "effects", title: "Effect", icon: "auto-fix" as const },
  { id: "transitions", title: "Transit", icon: "swap-horizontal" as const },
  { id: "keyframe", title: "Keyframe", icon: "motion-play-outline" as const },
  { id: "opacity", title: "Opacity", icon: "opacity" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const TEXT_CLIP_TOOLS = [
  { id: "text", title: "Edit", icon: "format-text" as const },
  { id: "tts", title: "TTS", icon: "microphone-outline" as const },
  { id: "animation", title: "Animation", icon: "play-circle-outline" as const },
  { id: "tracking", title: "Track", icon: "crosshairs-gps" as const },
  { id: "keyframe", title: "Keyframe", icon: "motion-play-outline" as const },
  { id: "opacity", title: "Opacity", icon: "opacity" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const CAPTION_CLIP_TOOLS = [
  { id: "captions", title: "Captions", icon: "subtitles-outline" as const },
  { id: "text", title: "Style", icon: "format-text" as const },
  { id: "tts", title: "TTS", icon: "microphone-outline" as const },
  { id: "animation", title: "Animation", icon: "play-circle-outline" as const },
  { id: "keyframe", title: "Keyframe", icon: "motion-play-outline" as const },
  { id: "opacity", title: "Opacity", icon: "opacity" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const STICKER_CLIP_TOOLS = [
  {
    id: "stickers",
    title: "Stickers",
    icon: "emoticon-happy-outline" as const,
  },
  { id: "animation", title: "Animation", icon: "play-circle-outline" as const },
  { id: "tracking", title: "Track", icon: "crosshairs-gps" as const },
  { id: "keyframe", title: "Keyframe", icon: "motion-play-outline" as const },
  { id: "opacity", title: "Opacity", icon: "opacity" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const AUDIO_CLIP_TOOLS = [
  { id: "volume", title: "Volume", icon: "volume-high" as const },
  { id: "speed", title: "Speed", icon: "speedometer" as const },
  {
    id: "audio_effects",
    title: "Voice FX",
    icon: "microphone-outline" as const,
  },
  { id: "denoise", title: "Denoise", icon: "ear-hearing" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const EFFECT_CLIP_TOOLS = [
  { id: "effects", title: "Effects", icon: "auto-fix" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

export default function Toolbar({
  selectedClip,
  selectedClipType = "video",
  project,
  onDeselectClip,
  onSelectMainClip,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onRotateClip,
  onToggleReverse,
  onOpenSpeedModal,
  onOpenVolumeModal,
  onOpenCropModal,
  onOpenTransformModal,
  onOpenMaskModal,
  onOpenAudioModal,
  onOpenTextModal,
  onOpenFiltersModal,
  onOpenEffectsModal,
  onOpenStickersModal,
  onOpenMediaPicker,
  onOpenEnhance,
  onOpenCutoutModal,
  onOpenMotionTracking,
  onOpenCanvasModal,
  onOpenBackgroundModal,
  onOpenKeyframeModal,
  onOpenAutoCaptions,
  onOpenTransitionsModal,
  onToggleDenoise,
  onExtractAudio,
  onFreezeFrame,
  orientation = "horizontal",
  onSelectDesktopTab,
  onOpenOpacityModal,
  onOpenAnimationModal,
  onOpenAudioEffectsModal,
  onOpenBlendModal,
  onOpenHSLModal,
  onOpenTTSModal,
  activeToolId,
  onCloseModal,
  onBackToHome,
}: ToolbarProps) {
  const isVertical = orientation === "vertical";
  const hasAudio = selectedClip ? mediaHasAudioTrack(selectedClip) : false;

  const clipCategoryLabel = React.useMemo(() => {
    if (!selectedClip) return "";
    switch (selectedClipType) {
      case "text":
        return "Text";
      case "caption":
      case "captions":
        return "Captions";
      case "sticker":
      case "stickers":
        return "Stickers";
      case "audio":
        return "Audio";
      case "effects":
      case "effect":
        return "Effects";
      case "video":
      default:
        return selectedClip.type === "photo" ? "Photo" : "Video";
    }
  }, [selectedClip, selectedClipType]);

  const handleToolAction = (toolId: string) => {
    soundEngine.playSfx("click");
    // If user clicks the currently active tool, toggle it closed to make timeline visible again
    if (activeToolId === toolId && onCloseModal) {
      onCloseModal();
      return;
    }
    switch (toolId) {
      case "edit":
        if (!selectedClip) {
          if (onSelectMainClip) onSelectMainClip();
        } else if (
          selectedClipType === "sticker" ||
          selectedClipType === "stickers"
        ) {
          onOpenStickersModal();
        } else if (
          selectedClipType === "caption" ||
          selectedClipType === "captions"
        ) {
          if (onOpenAutoCaptions) onOpenAutoCaptions();
          else onOpenTextModal();
        } else if (selectedClipType === "text") {
          onOpenTextModal();
        } else {
          if (onOpenTransformModal) onOpenTransformModal("crop");
        }
        break;
      case "overlay":
      case "media":
        if (isVertical && onSelectDesktopTab) {
          onSelectDesktopTab("media");
        } else {
          onOpenMediaPicker();
        }
        break;
      case "tts":
        if (onOpenTTSModal) onOpenTTSModal();
        break;
      case "audio":
        if (isVertical && onSelectDesktopTab) {
          onSelectDesktopTab("audio");
        } else {
          onOpenAudioModal();
        }
        break;
      case "text":
        onOpenTextModal();
        break;
      case "captions":
        if (onOpenAutoCaptions) onOpenAutoCaptions();
        else onOpenTextModal();
        break;
      case "stickers":
        onOpenStickersModal();
        break;
      case "effects":
        onOpenEffectsModal();
        break;
      case "animation":
        if (onOpenAnimationModal) onOpenAnimationModal();
        break;
      case "audio_effects":
        if (onOpenAudioEffectsModal) onOpenAudioEffectsModal();
        break;
      case "blend":
        if (onOpenBlendModal) onOpenBlendModal();
        break;
      case "hsl":
        if (onOpenHSLModal) onOpenHSLModal();
        break;
      case "transitions":
        if (onOpenTransitionsModal) onOpenTransitionsModal();
        break;
      case "filters":
        onOpenFiltersModal();
        break;
      case "crop":
        if (onOpenCropModal) onOpenCropModal();
        else if (onOpenTransformModal) onOpenTransformModal("crop");
        break;
      case "transform":
        if (onOpenTransformModal) onOpenTransformModal("crop");
        else if (onOpenCropModal) onOpenCropModal();
        break;
      case "mask":
        if (onOpenMaskModal) onOpenMaskModal();
        break;
      case "speed":
        onOpenSpeedModal();
        break;
      case "volume":
        if (onOpenVolumeModal) onOpenVolumeModal();
        break;
      case "cutout":
        if (onOpenCutoutModal) onOpenCutoutModal();
        break;
      case "keyframe":
        if (onOpenKeyframeModal) onOpenKeyframeModal();
        break;
      case "tracking":
        if (onOpenMotionTracking) onOpenMotionTracking();
        break;
      case "adjust":
      case "enhance":
        if (onOpenEnhance) onOpenEnhance();
        else onOpenFiltersModal();
        break;
      case "canvas":
        if (onOpenCanvasModal) onOpenCanvasModal();
        break;
      case "background":
        if (onOpenBackgroundModal) onOpenBackgroundModal();
        else if (onOpenCanvasModal) onOpenCanvasModal();
        break;
      case "split":
        soundEngine.playSfx("split");
        onSplitClip();
        break;
      case "freeze":
        if (onFreezeFrame) onFreezeFrame();
        break;
      case "copy":
        onDuplicateClip();
        break;
      case "delete":
        onDeleteClip();
        break;
      case "reverse":
        if (onToggleReverse) onToggleReverse();
        break;
      case "extract_audio":
        if (onExtractAudio) onExtractAudio();
        break;
      case "denoise":
        if (onToggleDenoise) onToggleDenoise();
        break;
      case "opacity":
        if (onOpenOpacityModal) onOpenOpacityModal();
        break;
      default:
        break;
    }
  };

  const activeTools = React.useMemo(() => {
    let list: Array<{
      id: string;
      title: string;
      icon: any;
      requiresAudio?: boolean;
    }> = [];
    if (!selectedClip) {
      list = ROOT_TOOLS;
    } else if (
      selectedClipType === "caption" ||
      selectedClipType === "captions"
    ) {
      list = CAPTION_CLIP_TOOLS;
    } else if (selectedClipType === "text") {
      list = TEXT_CLIP_TOOLS;
    } else if (
      selectedClipType === "sticker" ||
      selectedClipType === "stickers"
    ) {
      list = STICKER_CLIP_TOOLS;
    } else if (selectedClipType === "audio") {
      list = AUDIO_CLIP_TOOLS;
    } else if (
      selectedClipType === "effects" ||
      selectedClipType === "effect"
    ) {
      list = EFFECT_CLIP_TOOLS;
    } else if (selectedClipType === "photo" || selectedClip?.type === "photo") {
      list = PHOTO_CLIP_TOOLS;
    } else {
      list = VIDEO_CLIP_TOOLS.filter((t) => !t.requiresAudio || hasAudio);
    }

    // Ensure split and adjust are removed from main toolbar
    list = list.filter((t) => t.id !== "split" && t.id !== "adjust");

    // On big screen (isVertical), remove audio and media/overlay because they are already present on the desktop panel!
    if (isVertical) {
      list = list.filter(
        (t) => t.id !== "audio" && t.id !== "media" && t.id !== "overlay",
      );
    }

    return list;
  }, [selectedClip, selectedClipType, hasAudio, isVertical]);

  // Desktop vertical toolbar
  if (isVertical) {
    return (
      <View style={styles.verticalContainer}>
        {/* Top of vertical toolbar: App icon on laptop */}
        <View style={styles.verticalTopBrand}>
          <TouchableOpacity
            activeOpacity={onBackToHome ? 0.7 : 1}
            onPress={onBackToHome}
            disabled={!onBackToHome}
            accessibilityLabel="FastArt Home"
            style={styles.verticalLogoBtn}
          >
            <FastArtLogo size={26} />
          </TouchableOpacity>
        </View>

        {/* If a clip is selected, show back button and category indicator at top */}
        {selectedClip ? (
          <View style={styles.verticalHeader}>
            <TouchableOpacity
              style={styles.verticalBackBtn}
              onPress={onDeselectClip}
              activeOpacity={0.7}
              accessibilityLabel="Back to root tools"
            >
              <Ionicons name="chevron-back" size={15} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.verticalClipBadge}>
              <Text style={styles.verticalClipBadgeText} numberOfLines={1}>
                {clipCategoryLabel}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.verticalRootHeader}>
            <Text style={styles.verticalRootTitle}>STUDIO</Text>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={
            Platform.OS === "web"
              ? ({ scrollbarWidth: "none", msOverflowStyle: "none" } as any)
              : undefined
          }
          contentContainerStyle={styles.verticalScrollContent}
        >
          {activeTools.map((item) => {
            const isDelete = item.id === "delete";
            const isActive = activeToolId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.verticalToolBtn,
                  isDelete && styles.verticalDeleteBtn,
                  isActive && styles.verticalToolBtnActive,
                ]}
                onPress={() => handleToolAction(item.id)}
                activeOpacity={0.7}
                accessibilityLabel={item.title}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color={
                    isDelete ? "#EF4444" : isActive ? "#00E5FF" : "#FFFFFF"
                  }
                />
                <Text
                  style={[
                    styles.verticalToolLabel,
                    isDelete && { color: "#EF4444" },
                    isActive && { color: "#00E5FF" },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // Mobile horizontal bottom toolbar
  return (
    <View style={styles.horizontalContainer}>
      {selectedClip && (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={styles.mobileBackBtn}
            onPress={onDeselectClip}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Back to root tools"
          >
            <Ionicons name="chevron-back" size={17} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.mobileBackDivider} />
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={
          Platform.OS === "web"
            ? ({ scrollbarWidth: "none", msOverflowStyle: "none" } as any)
            : undefined
        }
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {activeTools.map((tool) => {
          const isDelete = tool.id === "delete";
          const isActive = activeToolId === tool.id;
          return (
            <TouchableOpacity
              key={tool.id}
              style={[
                styles.horizontalToolBtn,
                isDelete && styles.horizontalToolBtnDelete,
                isActive && styles.horizontalToolBtnActive,
              ]}
              onPress={() => handleToolAction(tool.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={tool.icon}
                size={20}
                color={isDelete ? "#EF4444" : isActive ? "#00E5FF" : "#FFFFFF"}
              />
              <Text
                style={[
                  styles.horizontalToolLabel,
                  isDelete && { color: "#EF4444" },
                  isActive && { color: "#00E5FF" },
                ]}
                numberOfLines={1}
              >
                {tool.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop Vertical Toolbar
  verticalContainer: {
    width: 62,
    backgroundColor: "#08090E",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    height: "100%",
    justifyContent: "space-between",
  },
  verticalScrollContent: {
    paddingVertical: 6,
    alignItems: "center",
    gap: 3,
  },
  verticalToolBtn: {
    width: 52,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    paddingHorizontal: 2,
    marginVertical: 1,
  },
  verticalToolBtnActive: {
    backgroundColor: "rgba(0, 229, 255, 0.12)",
  },
  verticalToolLabel: {
    color: "#94A3B8",
    fontSize: 9.5,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  verticalHeader: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 4,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    gap: 4,
  },
  verticalBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "#0F131D",
    borderWidth: 1,
    borderColor: "#1F2637",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    width: "100%",
  },
  verticalBackText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  verticalClipBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  verticalClipBadgeText: {
    color: "#94A3B8",
    fontSize: 8.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  verticalTopBrand: {
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  verticalLogoBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  verticalRootHeader: {
    paddingVertical: 6,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
  },
  verticalRootTitle: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  verticalDeleteBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  verticalClipActions: {
    paddingBottom: 8,
    paddingHorizontal: 4,
    gap: 4,
    alignItems: "center",
  },
  verticalDivider: {
    width: 40,
    height: 1,
    backgroundColor: "#1F2637",
    marginVertical: 3,
  },
  verticalActionBtn: {
    width: 52,
    height: 34,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  verticalActionText: {
    color: "#94A3B8",
    fontSize: 8.5,
    fontWeight: "600",
    marginTop: 1,
  },

  // Mobile Horizontal Toolbar
  horizontalContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#08090E",
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
    height: 52,
    paddingHorizontal: 6,
  },
  horizontalToolBtnActive: {
    backgroundColor: "rgba(0, 229, 255, 0.1)",
    borderRadius: 8,
  },
  horizontalToolBtnDelete: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  mobileBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F131D",
    borderWidth: 1,
    borderColor: "#1F2637",
    marginRight: 6,
  },
  mobileBackDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#1F2637",
    marginRight: 6,
  },
  mobileBackText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "600",
  },
  horizontalScrollContent: {
    alignItems: "center",
    paddingHorizontal: 2,
    gap: 4,
  },
  horizontalToolBtn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 46,
    height: 44,
    paddingHorizontal: 4,
    borderRadius: 7,
  },
  horizontalToolLabel: {
    color: "#94A3B8",
    fontSize: 9.5,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
    letterSpacing: 0.1,
  },
});
