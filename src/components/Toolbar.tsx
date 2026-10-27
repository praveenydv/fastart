import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { theme } from "../constants/theme";
import { mediaHasAudioTrack } from "../utils/mediaAudioDetector";

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
  onOpenTransformModal?: (tab?: "crop" | "flip" | "rotate" | "stretch" | "angle") => void;
  onOpenAudioModal: () => void;
  onOpenTextModal: () => void;
  onOpenFiltersModal: () => void;
  onOpenEffectsModal: () => void;
  onOpenStickersModal: () => void;
  onOpenMediaPicker: () => void;
  onOpenTTS?: () => void;
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
  onOpenLayerModal?: () => void;
  onOpenOpacityModal?: () => void;
  onOpenAnimationModal?: () => void;
  onOpenAudioEffectsModal?: () => void;
}

// Global tools for whole video (when no clip is selected)
const ROOT_TOOLS = [
  { id: "media", title: "Media", icon: "folder-multiple-image" as const },
  { id: "audio", title: "Audio", icon: "music-note" as const },
  { id: "text", title: "Text", icon: "format-text" as const },
  { id: "captions", title: "Caption", icon: "subtitles-outline" as const },
  { id: "stickers", title: "Sticker", icon: "emoticon-happy-outline" as const },
  { id: "effects", title: "Effect", icon: "auto-fix" as const },
  { id: "transitions", title: "Transit", icon: "swap-horizontal" as const },
  { id: "filters", title: "Filter", icon: "palette-outline" as const },
  { id: "canvas", title: "Canvas", icon: "aspect-ratio" as const },
  { id: "background", title: "BG", icon: "image-outline" as const },
];

// Clip-specific tools (when clip is selected)
const VIDEO_CLIP_TOOLS = [
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "speed", title: "Speed", icon: "speedometer" as const },
  { id: "volume", title: "Volume", icon: "volume-high" as const, requiresAudio: true },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "transform", title: "Transform", icon: "crop" as const },
  { id: "cutout", title: "Cutout", icon: "account-outline" as const },
  { id: "filters", title: "Filters", icon: "palette-outline" as const },
  { id: "adjust", title: "Enhance", icon: "tune" as const },
  { id: "keyframe", title: "Keyframe", icon: "motion-play-outline" as const },
  { id: "tracking", title: "Tracking", icon: "crosshairs-gps" as const },
  { id: "extract_audio", title: "Extract", icon: "music-box-outline" as const, requiresAudio: true },
  { id: "denoise", title: "Denoise", icon: "ear-hearing" as const, requiresAudio: true },
  { id: "reverse", title: "Reverse", icon: "rewind" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const TEXT_CLIP_TOOLS = [
  { id: "edit", title: "Edit", icon: "format-text" as const },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "keyframe", title: "Keyframe", icon: "motion-play-outline" as const },
  { id: "tts", title: "Speech", icon: "microphone-outline" as const },
  { id: "tracking", title: "Tracking", icon: "crosshairs-gps" as const },
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const STICKER_CLIP_TOOLS = [
  { id: "edit", title: "Change", icon: "emoticon-happy-outline" as const },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "keyframe", title: "Keyframe", icon: "motion-play-outline" as const },
  { id: "tracking", title: "Tracking", icon: "crosshairs-gps" as const },
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const AUDIO_CLIP_TOOLS = [
  { id: "volume", title: "Volume", icon: "volume-high" as const },
  { id: "speed", title: "Speed", icon: "speedometer" as const },
  { id: "denoise", title: "Denoise", icon: "ear-hearing" as const },
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const EFFECT_CLIP_TOOLS = [
  { id: "effects", title: "Change", icon: "auto-fix" as const },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "split", title: "Split", icon: "content-cut" as const },
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
  onOpenAudioModal,
  onOpenTextModal,
  onOpenFiltersModal,
  onOpenEffectsModal,
  onOpenStickersModal,
  onOpenMediaPicker,
  onOpenTTS,
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
  orientation = "horizontal",
  onSelectDesktopTab,
  onOpenLayerModal,
  onOpenOpacityModal,
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
    switch (toolId) {
      case "media":
        if (isVertical && onSelectDesktopTab) {
          onSelectDesktopTab("media");
        } else {
          onOpenMediaPicker();
        }
        break;
      case "audio":
        if (isVertical && onSelectDesktopTab) {
          onSelectDesktopTab("audio");
        } else {
          onOpenAudioModal();
        }
        break;
      case "text":
      case "edit":
        if (selectedClipType === "sticker" || selectedClipType === "stickers") {
          onOpenStickersModal();
        } else {
          onOpenTextModal();
        }
        break;
      case "captions":
        if (onOpenAutoCaptions) onOpenAutoCaptions();
        break;
      case "stickers":
        onOpenStickersModal();
        break;
      case "effects":
        onOpenEffectsModal();
        break;
      case "transitions":
        if (onOpenTransitionsModal) onOpenTransitionsModal();
        break;
      case "filters":
        onOpenFiltersModal();
        break;
      case "transform":
      case "crop":
        if (onOpenTransformModal) onOpenTransformModal("crop");
        else if (onOpenCropModal) onOpenCropModal();
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
      case "tts":
        if (onOpenTTS) onOpenTTS();
        break;
      case "split":
        soundEngine.playSfx("split");
        onSplitClip();
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
      case "layer":
        if (onOpenLayerModal) onOpenLayerModal();
        break;
      case "opacity":
        if (onOpenOpacityModal) onOpenOpacityModal();
        break;
      default:
        break;
    }
  };

  const activeTools = React.useMemo(() => {
    if (!selectedClip) return ROOT_TOOLS;
    if (
      selectedClipType === "text" ||
      selectedClipType === "caption" ||
      selectedClipType === "captions"
    ) {
      return TEXT_CLIP_TOOLS;
    }
    if (selectedClipType === "sticker" || selectedClipType === "stickers") {
      return STICKER_CLIP_TOOLS;
    }
    if (selectedClipType === "audio") {
      return AUDIO_CLIP_TOOLS;
    }
    if (selectedClipType === "effects" || selectedClipType === "effect") {
      return EFFECT_CLIP_TOOLS;
    }
    return VIDEO_CLIP_TOOLS.filter((t) => !t.requiresAudio || hasAudio);
  }, [selectedClip, selectedClipType, hasAudio]);

  // Desktop vertical toolbar
  if (isVertical) {
    return (
      <View style={styles.verticalContainer}>
        {/* If a clip is selected, show back button and category indicator at top */}
        {selectedClip ? (
          <View style={styles.verticalHeader}>
            <TouchableOpacity
              style={styles.verticalBackBtn}
              onPress={onDeselectClip}
              activeOpacity={0.7}
              accessibilityLabel="Back to root tools"
            >
              <Ionicons name="chevron-back" size={16} color="#00F2FE" />
              <Text style={styles.verticalBackText}>Back</Text>
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
          style={Platform.OS === 'web' ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any) : undefined}
          contentContainerStyle={styles.verticalScrollContent}
        >
          {activeTools.map((item) => {
            const isDelete = item.id === "delete";
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.verticalToolBtn,
                  isDelete && styles.verticalDeleteBtn,
                ]}
                onPress={() => handleToolAction(item.id)}
                activeOpacity={0.7}
                accessibilityLabel={item.title}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color={isDelete ? "#EF4444" : "#8E95A5"}
                />
                <Text
                  style={[
                    styles.verticalToolLabel,
                    isDelete && { color: "#EF4444" },
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
        <TouchableOpacity
          style={styles.mobileBackBtn}
          onPress={onDeselectClip}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back to root tools"
        >
          <Ionicons name="chevron-back" size={17} color="#00F2FE" />
        </TouchableOpacity>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={Platform.OS === 'web' ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any) : undefined}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {activeTools.map((tool) => {
          const isDelete = tool.id === "delete";
          return (
            <TouchableOpacity
              key={tool.id}
              style={[
                styles.horizontalToolBtn,
                isDelete && { backgroundColor: "rgba(239, 68, 68, 0.08)" },
              ]}
              onPress={() => handleToolAction(tool.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={tool.icon}
                size={20}
                color={isDelete ? "#EF4444" : "#D4D4D8"}
              />
              <Text
                style={[
                  styles.horizontalToolLabel,
                  isDelete && { color: "#EF4444" },
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
    width: 50,
    backgroundColor: "#08090E",
    borderRightWidth: 1,
    borderRightColor: "#1F2637",
    height: "100%",
    justifyContent: "space-between",
  },
  verticalScrollContent: {
    paddingVertical: 4,
    alignItems: "center",
    gap: 1,
  },
  verticalToolBtn: {
    width: 44,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    paddingHorizontal: 2,
    marginVertical: 1,
  },
  verticalToolLabel: {
    color: "#94A3B8",
    fontSize: 8,
    fontWeight: "500",
    marginTop: 1,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  verticalHeader: {
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 3,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    gap: 2,
  },
  verticalBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 5,
    width: "100%",
  },
  verticalBackText: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "700",
  },
  verticalClipBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  verticalClipBadgeText: {
    color: "#94A3B8",
    fontSize: 7.5,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  verticalRootHeader: {
    paddingVertical: 5,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
  },
  verticalRootTitle: {
    color: "#64748B",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  verticalDeleteBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  verticalClipActions: {
    paddingBottom: 6,
    paddingHorizontal: 3,
    gap: 3,
    alignItems: "center",
  },
  verticalDivider: {
    width: 32,
    height: 1,
    backgroundColor: "#1F2637",
    marginVertical: 2,
  },
  verticalActionBtn: {
    width: 44,
    height: 30,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  verticalActionText: {
    color: "#94A3B8",
    fontSize: 7.5,
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
    height: 44,
    paddingHorizontal: 4,
  },
  mobileBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    marginRight: 4,
  },
  mobileBackText: {
    color: "#00F2FE",
    fontSize: 8,
    fontWeight: "700",
  },
  horizontalScrollContent: {
    alignItems: "center",
    paddingHorizontal: 2,
    gap: 3,
  },
  horizontalToolBtn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 40,
    height: 38,
    paddingHorizontal: 2,
    borderRadius: 5,
  },
  horizontalToolLabel: {
    color: "#94A3B8",
    fontSize: 8,
    fontWeight: "500",
    marginTop: 1,
    textAlign: "center",
    letterSpacing: 0.1,
  },
});
