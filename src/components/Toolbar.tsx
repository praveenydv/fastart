import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { theme } from "../constants/theme";
import {
  mediaHasAudioTrack,
  subscribeMediaAudioChange,
  extractRealMediaAudioPeaks,
} from "../utils/mediaAudioDetector";
import {
  ASPECT_RATIOS,
  FILTER_PRESETS,
  EFFECT_PRESETS,
} from "../constants/sampleMedia";

interface ToolbarProps {
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
  onOpenTransformModal?: (tab?: 'crop' | 'flip' | 'rotate' | 'stretch' | 'angle') => void;
  onOpenMaskModal?: () => void;
  onOpenAudioModal: () => void;
  onOpenTextModal: () => void;
  onOpenFiltersModal: () => void;
  onOpenEffectsModal: () => void;
  onOpenStickersModal: () => void;
  onOpenMediaPicker: () => void;
  onOpenTTS?: () => void;
  onOpenEnhance?: () => void;
  onOpenAutoCut?: () => void;
  onOpenCutoutModal?: (mode?: 'auto' | 'chroma') => void;
  onOpenMotionTracking?: () => void;
  onOpenCanvasModal?: () => void;
  onOpenBackgroundModal?: () => void;
  onOpenKeyframeModal?: () => void;
  onOpenAutoCaptions?: () => void;
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
  onSelectDesktopTab?: (tab: 'media' | 'audio') => void;
  onOpenLayerModal?: () => void;
  onOpenOpacityModal?: () => void;
  onOpenAnimationModal?: () => void;
  onOpenAudioEffectsModal?: () => void;
}

// CapCut Root Toolbar Items
const ROOT_TOOLBAR_ITEMS = [
  { id: "media", title: "Media", icon: "folder-multiple-image" as const },
  { id: "audio", title: "Audio", icon: "music-note" as const },
  { id: "text", title: "Text", icon: "format-text" as const },
  { id: "captions", title: "Captions", icon: "subtitles-outline" as const },
  { id: "stickers", title: "Stickers", icon: "emoticon-happy-outline" as const },
  { id: "effects", title: "Effects", icon: "auto-fix" as const },
  { id: "filters", title: "Filters", icon: "palette-outline" as const },
  { id: "adjust", title: "Adjust", icon: "tune" as const },
  { id: "canvas", title: "Canvas", icon: "aspect-ratio" as const },
  { id: "background", title: "Background", icon: "image-outline" as const },
];

// CapCut Clip Selected Tools
const CLIP_SELECTED_TOOLS = [
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "speed", title: "Speed", icon: "speedometer" as const },
  { id: "animation", title: "Animation", icon: "motion-play-outline" as const },
  { id: "style", title: "Style", icon: "magic-staff" as const, isPro: true },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
  { id: "volume", title: "Volume", icon: "volume-high" as const },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "cutout", title: "Cutout", icon: "account-outline" as const },
  { id: "audio_effects", title: "Audio effects", icon: "waveform" as const },
  { id: "extract_audio", title: "Extract audio", icon: "music-box-outline" as const },
  { id: "transform", title: "Transform", icon: "rotate-right" as const },
  { id: "filters", title: "Filters", icon: "palette-outline" as const },
  { id: "adjust", title: "Adjust", icon: "tune" as const },
  { id: "retouch", title: "Retouch", icon: "face-woman-shimmer" as const, isPro: true },
  { id: "mask", title: "Mask", icon: "shape-outline" as const },
  { id: "reverse", title: "Reverse", icon: "rewind" as const },
  { id: "freeze", title: "Freeze", icon: "snowflake" as const },
  { id: "motion_blur", title: "Motion blur", icon: "blur" as const },
  { id: "opacity", title: "Opacity", icon: "opacity" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "replace", title: "Replace", icon: "swap-horizontal" as const },
];

const TEXT_CLIP_TOOLS = [
  { id: "style", title: "Style", icon: "format-paint" as const },
  { id: "animation", title: "Animation", icon: "motion-play-outline" as const },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "tts", title: "Text to speech", icon: "microphone-outline" as const },
  { id: "tracking", title: "Tracking", icon: "crosshairs-gps" as const },
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const STICKER_CLIP_TOOLS = [
  { id: "edit", title: "Edit", icon: "emoticon-happy-outline" as const },
  { id: "animation", title: "Animation", icon: "motion-play-outline" as const },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "tracking", title: "Tracking", icon: "crosshairs-gps" as const },
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const EFFECT_CLIP_TOOLS = [
  { id: "adjust", title: "Adjust", icon: "tune" as const },
  { id: "replace", title: "Replace", icon: "swap-horizontal" as const },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const AUDIO_CLIP_TOOLS = [
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "volume", title: "Volume", icon: "volume-high" as const },
  { id: "fade", title: "Fade", icon: "trending-up" as const },
  { id: "denoise", title: "Denoise", icon: "ear-hearing" as const },
  { id: "speed", title: "Speed", icon: "speedometer" as const },
  { id: "audio_effects", title: "Voice effects", icon: "waveform" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const CAPTION_CLIP_TOOLS = [
  { id: "edit", title: "Edit", icon: "subtitles-outline" as const },
  { id: "style", title: "Style", icon: "format-paint" as const },
  { id: "animation", title: "Animation", icon: "motion-play-outline" as const },
  { id: "layer", title: "Layer", icon: "layers-outline" as const },
  { id: "split", title: "Split", icon: "content-cut" as const },
  { id: "copy", title: "Copy", icon: "content-copy" as const },
  { id: "delete", title: "Delete", icon: "trash-can-outline" as const },
];

const STICKERS_LIST = [
  { id: "stk-1", label: "🔥 Fire" },
  { id: "stk-2", label: "✨ Sparkle" },
  { id: "stk-3", label: "🔴 REC" },
  { id: "stk-4", label: "🔔 Subscribe" },
  { id: "stk-5", label: "👀 Wait for it" },
  { id: "stk-6", label: "💯 100" },
  { id: "stk-7", label: "⚡ Bolt" },
  { id: "stk-8", label: "🎬 Cinema" },
];

const ANIMATIONS_LIST = [
  { id: "fade_in", name: "Fade In", type: "In" },
  { id: "zoom_1", name: "Zoom 1", type: "In" },
  { id: "shake_down", name: "Shake Down", type: "Combo", isPro: true },
  { id: "spin_3d", name: "3D Spin", type: "Combo", isPro: true },
  { id: "fade_out", name: "Fade Out", type: "Out" },
  { id: "zoom_out", name: "Zoom Out", type: "Out" },
];

function Toolbar({
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
  onOpenTTS,
  onOpenEnhance,
  onOpenAutoCut,
  onOpenCutoutModal,
  onOpenMotionTracking,
  onOpenCanvasModal,
  onOpenBackgroundModal,
  onOpenKeyframeModal,
  onOpenAutoCaptions,
  onToggleDenoise,
  onExtractAudio,
  onMoveClip,
  onApplyFilter,
  onApplySpeed,
  onApplyVolume,
  onApplyRatio,
  onApplyCanvasBg,
  onAddText,
  onAddSticker,
  onAddEffect,
  orientation = "horizontal",
  onSelectDesktopTab,
  onOpenLayerModal,
  onOpenOpacityModal,
  onOpenAnimationModal,
  onOpenAudioEffectsModal,
}: ToolbarProps) {
  const isVertical = orientation === "vertical";
  const [activeSubPanel, setActiveSubPanel] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subpanel state
  const [speedMode, setSpeedMode] = useState<"normal" | "curve">("normal");
  const [speedVal, setSpeedVal] = useState("1.0x");
  const [pitchEnabled, setPitchEnabled] = useState(true);
  const [curvePreset, setCurvePreset] = useState("Montage");
  const [volumeVal, setVolumeVal] = useState(100);
  const [filterIntensity, setFilterIntensity] = useState(80);
  const [canvasTab, setCanvasTab] = useState<"color" | "blur">("color");
  const [textInputText, setTextInputText] = useState("");
  const [selectedTextColor, setSelectedTextColor] = useState("#FFFFFF");
  const [activeMask, setActiveMask] = useState("none");
  const [motionBlurVal, setMotionBlurVal] = useState(50);
  const [clipOpacity, setClipOpacity] = useState(100);

  // Audio presence
  const [, setAudioPresenceTick] = useState(0);

  useEffect(() => {
    return subscribeMediaAudioChange(() => {
      setAudioPresenceTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    if (selectedClip?.url && selectedClipType !== "photo") {
      extractRealMediaAudioPeaks(selectedClip.url, selectedClip.id);
    }
  }, [selectedClip?.id, selectedClip?.url, selectedClipType]);

  const showToast = (msg: string) => {
    soundEngine.playSfx("pop");
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const currentClipTools = React.useMemo(() => {
    if (!selectedClip) return [];
    if (selectedClipType === "text") return TEXT_CLIP_TOOLS;
    if (selectedClipType === "sticker" || selectedClipType === "stickers") return STICKER_CLIP_TOOLS;
    if (selectedClipType === "effect" || selectedClipType === "effects") return EFFECT_CLIP_TOOLS;
    if (selectedClipType === "audio") return AUDIO_CLIP_TOOLS;
    if (selectedClipType === "caption" || selectedClipType === "captions") return CAPTION_CLIP_TOOLS;
    return CLIP_SELECTED_TOOLS;
  }, [selectedClip, selectedClipType]);

  const handleRootToolPress = (toolId: string) => {
    soundEngine.playSfx("click");
    if (toolId === "media" || toolId === "overlay") {
      if (isVertical && onSelectDesktopTab) {
        onSelectDesktopTab("media");
      } else {
        onOpenMediaPicker();
      }
    } else if (toolId === "audio") {
      if (isVertical && onSelectDesktopTab) {
        onSelectDesktopTab("audio");
      } else {
        onOpenAudioModal();
      }
    } else if (toolId === "text") {
      if (onOpenTextModal) onOpenTextModal();
    } else if (toolId === "captions") {
      if (onOpenAutoCaptions) onOpenAutoCaptions();
    } else if (toolId === "stickers") {
      if (onOpenStickersModal) onOpenStickersModal();
    } else if (toolId === "effects") {
      if (onOpenEffectsModal) onOpenEffectsModal();
    } else if (toolId === "filters") {
      if (onOpenFiltersModal) onOpenFiltersModal();
    } else if (toolId === "ratio" || toolId === "canvas") {
      if (onOpenCanvasModal) onOpenCanvasModal();
    } else if (toolId === "background") {
      if (onOpenBackgroundModal) onOpenBackgroundModal();
      else if (onOpenCanvasModal) onOpenCanvasModal();
    } else if (toolId === "adjust") {
      if (onOpenEnhance) onOpenEnhance();
      else if (onOpenFiltersModal) onOpenFiltersModal();
    } else {
      if (!isVertical) {
        setActiveSubPanel(activeSubPanel === toolId ? null : toolId);
      }
    }
  };

  const handleClipToolPress = (toolId: string) => {
    soundEngine.playSfx("click");
    if (toolId === "split") {
      soundEngine.playSfx("split");
      onSplitClip();
    } else if (toolId === "delete") {
      soundEngine.playSfx("pop");
      onDeleteClip();
    } else if (toolId === "copy") {
      soundEngine.playSfx("pop");
      onDuplicateClip();
    } else if (toolId === "style" || toolId === "edit") {
      if (selectedClipType === "text" || selectedClipType === "caption" || selectedClipType === "captions") {
        if (onOpenTextModal) onOpenTextModal();
      } else if (selectedClipType === "sticker" || selectedClipType === "stickers") {
        if (onOpenStickersModal) onOpenStickersModal();
      } else if (selectedClipType === "effect" || selectedClipType === "effects") {
        if (onOpenEffectsModal) onOpenEffectsModal();
      } else {
        showToast("Style: Not implemented yet");
      }
    } else if (toolId === "animation") {
      if (selectedClipType === "text" || selectedClipType === "caption" || selectedClipType === "captions") {
        if (onOpenTextModal) onOpenTextModal();
      } else if (selectedClipType === "sticker" || selectedClipType === "stickers") {
        if (onOpenStickersModal) onOpenStickersModal();
      } else if (onOpenAnimationModal) {
        onOpenAnimationModal();
      } else if (!isVertical) {
        setActiveSubPanel(activeSubPanel === toolId ? null : toolId);
      }
    } else if (toolId === "tts") {
      if (onOpenTTS) onOpenTTS();
      else showToast("Text to Speech: Not implemented yet");
    } else if (toolId === "tracking") {
      if (onOpenMotionTracking) onOpenMotionTracking();
      else showToast("Motion Tracking: Not implemented yet");
    } else if (toolId === "speed") {
      if (onOpenSpeedModal) onOpenSpeedModal();
    } else if (toolId === "volume" || toolId === "fade") {
      if (onOpenVolumeModal) onOpenVolumeModal();
    } else if (toolId === "denoise") {
      if (onToggleDenoise) onToggleDenoise();
      else if (onOpenVolumeModal) onOpenVolumeModal();
    } else if (toolId === "cutout") {
      if (onOpenCutoutModal) onOpenCutoutModal();
    } else if (toolId === "mask") {
      if (onOpenMaskModal) onOpenMaskModal();
    } else if (toolId === "filters") {
      if (onOpenFiltersModal) onOpenFiltersModal();
    } else if (toolId === "adjust") {
      if (selectedClipType === "effect" || selectedClipType === "effects") {
        if (onOpenEffectsModal) onOpenEffectsModal();
      } else if (onOpenEnhance) {
        onOpenEnhance();
      } else if (onOpenFiltersModal) {
        onOpenFiltersModal();
      }
    } else if (toolId === "transform") {
      if (onOpenTransformModal) onOpenTransformModal();
      else if (onOpenCropModal) onOpenCropModal();
      else if (onRotateClip) onRotateClip();
    } else if (toolId === "crop") {
      if (onOpenTransformModal) onOpenTransformModal("crop");
      else if (onOpenCropModal) onOpenCropModal();
    } else if (toolId === "rotate") {
      if (onOpenTransformModal) onOpenTransformModal("rotate");
      else if (onRotateClip) onRotateClip();
    } else if (toolId === "extract_audio") {
      if (onExtractAudio) onExtractAudio();
    } else if (toolId === "reverse") {
      if (onToggleReverse) onToggleReverse();
    } else if (toolId === "replace") {
      if (selectedClipType === "effect" || selectedClipType === "effects") {
        if (onOpenEffectsModal) onOpenEffectsModal();
      } else {
        onOpenMediaPicker();
      }
    } else if (toolId === "layer") {
      if (onOpenLayerModal) {
        onOpenLayerModal();
      } else if (!isVertical) {
        setActiveSubPanel(activeSubPanel === "layer" ? null : "layer");
      }
    } else if (toolId === "opacity") {
      if (onOpenOpacityModal) {
        onOpenOpacityModal();
      } else if (!isVertical) {
        setActiveSubPanel(activeSubPanel === "opacity" ? null : "opacity");
      }
    } else if (toolId === "audio_effects") {
      if (onOpenAudioEffectsModal) {
        onOpenAudioEffectsModal();
      } else if (!isVertical) {
        setActiveSubPanel(activeSubPanel === "audio_effects" ? null : "audio_effects");
      }
    } else if (toolId === "freeze") {
      showToast("Freeze frame: Not implemented yet");
    } else if (toolId === "retouch") {
      showToast("Retouch: Not implemented yet");
    } else {
      if (!isVertical) {
        setActiveSubPanel(activeSubPanel === toolId ? null : toolId);
      }
    }
  };

  const isVideo = selectedClipType === "video";
  const hasAudioTrack = selectedClip ? mediaHasAudioTrack(selectedClip) : false;

  return (
    <View style={[styles.container, isVertical && styles.containerVertical]}>
      {/* Toast Alert */}
      {toastMessage && (
        <View style={styles.toastBox}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Dynamic Subpanels (Only for mobile horizontal layout) */}
      <View style={isVertical ? { display: "none" } : undefined}>
        {/* ================= DYNAMIC SUB-PANELS ================= */}

      {/* 1. Filters Subpanel */}
      {activeSubPanel === "filters" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Filters</Text>
            <TouchableOpacity
              onPress={() => setActiveSubPanel(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Intensity Slider */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Intensity: {filterIntensity}%</Text>
            <View style={styles.sliderTrack}>
              {[20, 40, 60, 80, 100].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.sliderTick,
                    filterIntensity === val && styles.sliderTickActive,
                  ]}
                  onPress={() => setFilterIntensity(val)}
                >
                  <Text
                    style={[
                      styles.sliderTickText,
                      filterIntensity === val && styles.sliderTickTextActive,
                    ]}
                  >
                    {val}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Filters List */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {FILTER_PRESETS.map((filter) => {
              const isSelected = selectedClip?.filter === filter.id;
              return (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterItem,
                    isSelected && styles.filterItemActive,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    if (onApplyFilter) onApplyFilter(filter.id);
                    else onOpenFiltersModal();
                  }}
                >
                  <View
                    style={[
                      styles.filterColorCircle,
                      isSelected && { borderColor: "#FFFFFF", borderWidth: 2 },
                    ]}
                  />
                  <Text
                    style={[
                      styles.filterName,
                      isSelected && styles.filterNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {filter.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 2. Color Adjustments Subpanel */}
      {activeSubPanel === "adjust" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Color Adjustments</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.adjustScroll}
          >
            {[
              { id: "brightness", label: "Brightness", icon: "white-balance-sunny" as const },
              { id: "contrast", label: "Contrast", icon: "contrast-circle" as const },
              { id: "saturation", label: "Saturation", icon: "water-percent" as const },
              { id: "exposure", label: "Exposure", icon: "camera-iris" as const },
              { id: "vignette", label: "Vignette", icon: "circle-outline" as const },
            ].map((adj) => (
              <TouchableOpacity
                key={adj.id}
                style={styles.adjustChip}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenEnhance) onOpenEnhance();
                  else onOpenFiltersModal();
                }}
              >
                <MaterialCommunityIcons
                  name={adj.icon}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.adjustChipText}>{adj.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 3. Canvas Aspect Ratio Subpanel */}
      {activeSubPanel === "ratio" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Canvas Aspect Ratio</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ratioScroll}
          >
            {ASPECT_RATIOS.map((item) => {
              const isSelected = project?.aspectRatio === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.ratioChip,
                    isSelected && styles.ratioChipActive,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    if (onApplyRatio) onApplyRatio(item.id);
                    else if (onOpenCanvasModal) onOpenCanvasModal();
                  }}
                >
                  <Text
                    style={[
                      styles.ratioText,
                      isSelected && styles.ratioTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.ratioDesc}>{item.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 4. Text Subpanel */}
      {activeSubPanel === "text" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Text</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.textInputBox}>
            <TextInput
              style={styles.textInput}
              value={textInputText}
              onChangeText={setTextInputText}
              placeholder="Type text overlay..."
              placeholderTextColor="#71717A"
              onSubmitEditing={() => {
                if (textInputText.trim() && onAddText) {
                  onAddText(textInputText.trim(), selectedTextColor);
                  setTextInputText("");
                  setActiveSubPanel(null);
                }
              }}
            />
            {textInputText.trim() ? (
              <TouchableOpacity
                style={styles.textAddBtn}
                onPress={() => {
                  if (onAddText) onAddText(textInputText.trim(), selectedTextColor);
                  setTextInputText("");
                  setActiveSubPanel(null);
                }}
              >
                <Text style={styles.textAddBtnText}>Add</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Color Palette Row */}
          <View style={styles.colorPaletteRow}>
            {["#FFFFFF", "#00E5FF", "#FFD700", "#FF2A6D", "#10B981", "#A855F7"].map(
              (col) => (
                <TouchableOpacity
                  key={col}
                  style={[
                    styles.colorDot,
                    { backgroundColor: col },
                    selectedTextColor === col && styles.colorDotActive,
                  ]}
                  onPress={() => setSelectedTextColor(col)}
                />
              )
            )}
          </View>

          {/* Quick presets */}
          <View style={styles.quickTextRow}>
            {["Tokyo Nights ✨", "Wait for it 🔥", "Vlog 2026", "Aesthetic 🚀"].map(
              (p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.presetChip}
                  onPress={() => {
                    if (onAddText) onAddText(p, selectedTextColor);
                    setActiveSubPanel(null);
                  }}
                >
                  <Text style={styles.presetText}>{p}</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Full Text Editor Modal Button */}
          {onOpenTextModal && (
            <TouchableOpacity
              style={styles.textStudioBtn}
              onPress={() => {
                onOpenTextModal();
                setActiveSubPanel(null);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="format-font" size={16} color="#000000" />
              <Text style={styles.textStudioBtnText}>
                Open Text Studio & Fonts
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 4b. Captions Subpanel */}
      {activeSubPanel === "captions" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Captions</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.captionsList}>
            <TouchableOpacity
              style={styles.captionActionCard}
              onPress={() => {
                if (onOpenAutoCaptions) {
                  onOpenAutoCaptions();
                  setActiveSubPanel(null);
                } else {
                  showToast("Auto Captions: Not implemented yet");
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.captionIconCircle}>
                <MaterialCommunityIcons name="auto-fix" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.captionTextCol}>
                <Text style={styles.captionCardTitle}>Auto Captions</Text>
                <Text style={styles.captionCardDesc}>
                  Convert speech from video/audio to subtitles automatically
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#A1A1AA" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captionActionCard}
              onPress={() => showToast("Bilingual Subtitles: Not implemented yet")}
              activeOpacity={0.8}
            >
              <View style={styles.captionIconCircle}>
                <MaterialCommunityIcons name="translate" size={18} color="#A1A1AA" />
              </View>
              <View style={styles.captionTextCol}>
                <Text style={styles.captionCardTitle}>Bilingual Captions</Text>
                <Text style={styles.captionCardDesc}>
                  Translate spoken dialogue into dual-language subtitles
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captionActionCard}
              onPress={() => showToast("Identify Lyrics: Not implemented yet")}
              activeOpacity={0.8}
            >
              <View style={styles.captionIconCircle}>
                <MaterialCommunityIcons name="music-note-eighth" size={18} color="#A1A1AA" />
              </View>
              <View style={styles.captionTextCol}>
                <Text style={styles.captionCardTitle}>Identify Lyrics</Text>
                <Text style={styles.captionCardDesc}>
                  Extract and synchronize song lyrics with the music track
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. Speed Subpanel */}
      {activeSubPanel === "speed" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <View style={styles.speedTabGroup}>
              <TouchableOpacity
                style={[
                  styles.speedModeBtn,
                  speedMode === "normal" && styles.speedModeBtnActive,
                ]}
                onPress={() => setSpeedMode("normal")}
              >
                <Text
                  style={[
                    styles.speedModeText,
                    speedMode === "normal" && styles.speedModeTextActive,
                  ]}
                >
                  Normal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.speedModeBtn,
                  speedMode === "curve" && styles.speedModeBtnActive,
                ]}
                onPress={() => setSpeedMode("curve")}
              >
                <Text
                  style={[
                    styles.speedModeText,
                    speedMode === "curve" && styles.speedModeTextActive,
                  ]}
                >
                  Curve
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {speedMode === "normal" ? (
            <View style={styles.speedOptions}>
              {["0.1x", "0.5x", "1.0x", "1.5x", "2.0x", "5.0x", "10x"].map(
                (s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.speedPill,
                      speedVal === s && styles.speedPillActive,
                    ]}
                    onPress={() => {
                      setSpeedVal(s);
                      const num = parseFloat(s.replace("x", ""));
                      if (onApplySpeed) onApplySpeed(num);
                    }}
                  >
                    <Text
                      style={[
                        styles.speedPillText,
                        speedVal === s && styles.speedPillTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.curveScroll}
            >
              {["Montage", "Hero", "Bullet", "Jump Cut", "Flash In", "Flash Out"].map(
                (crv) => {
                  const isSelected = curvePreset === crv;
                  return (
                    <TouchableOpacity
                      key={crv}
                      style={[
                        styles.curveCard,
                        isSelected && styles.curveCardActive,
                      ]}
                      onPress={() => {
                        setCurvePreset(crv);
                        const mult = crv === "Hero" ? 2.5 : crv === "Bullet" ? 4.0 : 1.5;
                        if (onApplySpeed) onApplySpeed(mult);
                      }}
                    >
                      <View style={styles.curveGraphIcon}>
                        <View style={[styles.curveBar, { height: 14 }]} />
                        <View
                          style={[
                            styles.curveBar,
                            {
                              height: 24,
                              backgroundColor: isSelected ? "#FFFFFF" : "#52525B",
                            },
                          ]}
                        />
                        <View style={[styles.curveBar, { height: 10 }]} />
                        <View style={[styles.curveBar, { height: 20 }]} />
                      </View>
                      <Text
                        style={[
                          styles.curveName,
                          isSelected && styles.curveNameActive,
                        ]}
                      >
                        {crv}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>
          )}

          {/* Pitch Toggle Row */}
          <View style={styles.pitchRow}>
            <Text style={styles.pitchLabel}>
              Pitch (Keep natural voice frequency)
            </Text>
            <TouchableOpacity
              style={[
                styles.pitchSwitch,
                pitchEnabled && styles.pitchSwitchActive,
              ]}
              onPress={() => setPitchEnabled(!pitchEnabled)}
            >
              <View
                style={[
                  styles.pitchKnob,
                  pitchEnabled && styles.pitchKnobActive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 6. Volume Subpanel */}
      {activeSubPanel === "volume" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Clip Volume: {volumeVal}%</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.volumeOptions}>
            {[0, 50, 100, 150, 200].map((v) => (
              <TouchableOpacity
                key={v}
                style={[
                  styles.volChip,
                  volumeVal === v && styles.volChipActive,
                ]}
                onPress={() => {
                  setVolumeVal(v);
                  if (onApplyVolume) onApplyVolume(v / 100);
                }}
              >
                <Text
                  style={[
                    styles.volChipText,
                    volumeVal === v && styles.volChipTextActive,
                  ]}
                >
                  {v}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 7. Animation Subpanel */}
      {activeSubPanel === "animation" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Clip Animations</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.animScroll}
          >
            {ANIMATIONS_LIST.map((anim) => (
              <TouchableOpacity
                key={anim.id}
                style={styles.animCard}
                onPress={() => showToast(`Animation ${anim.name}: Not implemented yet`)}
              >
                <MaterialCommunityIcons
                  name="motion-play-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.animName}>{anim.name}</Text>
                <View style={styles.animTypeTag}>
                  <Text style={styles.animTypeText}>{anim.type}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 8. Effects Subpanel */}
      {activeSubPanel === "effects" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Video Effects</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.effectsScroll}
          >
            {EFFECT_PRESETS.slice(0, 8).map((eff) => (
              <TouchableOpacity
                key={eff.id}
                style={styles.effectChip}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onAddEffect) onAddEffect(eff.id);
                  else onOpenEffectsModal();
                  setActiveSubPanel(null);
                }}
              >
                <MaterialCommunityIcons
                  name={(eff.icon as any) || "auto-fix"}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.effectName}>{eff.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 9. Stickers Subpanel */}
      {activeSubPanel === "stickers" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Trending Stickers</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stickersScroll}
          >
            {STICKERS_LIST.map((stk) => (
              <TouchableOpacity
                key={stk.id}
                style={styles.stickerChip}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onAddSticker) onAddSticker(stk.label);
                  else onOpenStickersModal();
                  setActiveSubPanel(null);
                }}
              >
                <Text style={styles.stickerText}>{stk.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 10. Canvas / Background Subpanel */}
      {(activeSubPanel === "canvas" || activeSubPanel === "background") && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <View style={styles.speedTabGroup}>
              <TouchableOpacity
                style={[
                  styles.speedModeBtn,
                  canvasTab === "color" && styles.speedModeBtnActive,
                ]}
                onPress={() => setCanvasTab("color")}
              >
                <Text
                  style={[
                    styles.speedModeText,
                    canvasTab === "color" && styles.speedModeTextActive,
                  ]}
                >
                  Color
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.speedModeBtn,
                  canvasTab === "blur" && styles.speedModeBtnActive,
                ]}
                onPress={() => setCanvasTab("blur")}
              >
                <Text
                  style={[
                    styles.speedModeText,
                    canvasTab === "blur" && styles.speedModeTextActive,
                  ]}
                >
                  Blur
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {canvasTab === "color" ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorPaletteRow}
            >
              {[
                "#000000",
                "#1C1C1E",
                "#00E5FF",
                "#FF2A6D",
                "#FFD700",
                "#10B981",
                "#8B5CF6",
                "#FFFFFF",
              ].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    if (onApplyCanvasBg) onApplyCanvasBg(c);
                    else if (onOpenCanvasModal) onOpenCanvasModal();
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.speedOptions}>
              {["None", "Blur 1x", "Blur 2x", "Blur 3x", "Blur 4x"].map(
                (b, idx) => (
                  <TouchableOpacity
                    key={b}
                    style={styles.speedPill}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      if (onApplyCanvasBg) {
                        onApplyCanvasBg(idx === 0 ? "#000000" : `blur:${idx}`);
                      } else if (onOpenCanvasModal) {
                        onOpenCanvasModal();
                      }
                    }}
                  >
                    <Text style={styles.speedPillText}>{b}</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}
        </View>
      )}

      {/* 11. Cutout Subpanel */}
      {activeSubPanel === "cutout" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Cutout / Background Removal</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.cutoutRow}>
            <TouchableOpacity
              style={styles.cutoutBtn}
              onPress={() => {
                soundEngine.playSfx("click");
                if (onOpenCutoutModal) onOpenCutoutModal("auto");
                setActiveSubPanel(null);
              }}
            >
              <MaterialCommunityIcons
                name="account-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text style={styles.cutoutBtnText}>Auto Cutout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cutoutBtn}
              onPress={() => {
                soundEngine.playSfx("click");
                if (onOpenCutoutModal) onOpenCutoutModal("chroma");
                setActiveSubPanel(null);
              }}
            >
              <Ionicons name="color-filter-outline" size={22} color="#FFFFFF" />
              <Text style={styles.cutoutBtnText}>Chroma Key</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 12. Opacity Subpanel */}
      {activeSubPanel === "opacity" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Opacity: {clipOpacity}%</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.volumeOptions}>
            {[25, 50, 75, 100].map((op) => (
              <TouchableOpacity
                key={op}
                style={[
                  styles.volChip,
                  clipOpacity === op && styles.volChipActive,
                ]}
                onPress={() => setClipOpacity(op)}
              >
                <Text
                  style={[
                    styles.volChipText,
                    clipOpacity === op && styles.volChipTextActive,
                  ]}
                >
                  {op}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 12b. Layer / Track Order Subpanel */}
      {activeSubPanel === "layer" && selectedClip && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <MaterialCommunityIcons name="layers-outline" size={18} color="#00F2FE" />
              <Text style={styles.subPanelTitle}>
                Layer / Order (Current: Layer {((typeof selectedClip.trackIndex === "number" ? selectedClip.trackIndex : (selectedClipType === "video" ? 0 : selectedClipType === "audio" ? 1 : selectedClipType === "sticker" ? 3 : selectedClipType === "effects" ? 4 : 2))) + 1})
              </Text>
            </View>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Quick Reorder Actions */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
            {(() => {
              const normType = (selectedClipType === "captions" ? "caption" : selectedClipType === "stickers" ? "sticker" : selectedClipType === "effects" ? "effects" : selectedClipType) as any;
              return (
                <>
                  <TouchableOpacity
                    style={[styles.ratioChip, { paddingHorizontal: 12, paddingVertical: 6 }]}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      const cur = typeof selectedClip.trackIndex === "number" ? selectedClip.trackIndex : (selectedClipType === "video" ? 0 : 2);
                      if (cur > 0 && onMoveClip) {
                        onMoveClip(selectedClip.id, normType, selectedClip.startTime, cur - 1);
                        showToast(`Moved down to Layer ${cur}`);
                      }
                    }}
                  >
                    <Text style={styles.ratioText}>⬇ Move Down</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ratioChip, { paddingHorizontal: 12, paddingVertical: 6 }]}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      const cur = typeof selectedClip.trackIndex === "number" ? selectedClip.trackIndex : (selectedClipType === "video" ? 0 : 2);
                      if (onMoveClip) {
                        onMoveClip(selectedClip.id, normType, selectedClip.startTime, cur + 1);
                        showToast(`Moved up to Layer ${cur + 2}`);
                      }
                    }}
                  >
                    <Text style={styles.ratioText}>⬆ Move Up</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ratioChip, { paddingHorizontal: 12, paddingVertical: 6 }]}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      if (onMoveClip) {
                        onMoveClip(selectedClip.id, normType, selectedClip.startTime, 0);
                        showToast("Sent to Back (Layer 1)");
                      }
                    }}
                  >
                    <Text style={styles.ratioText}>⏮ Send to Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ratioChip, { paddingHorizontal: 12, paddingVertical: 6 }]}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      const allClips = [
                        ...(project?.tracks?.video || []),
                        ...(project?.tracks?.text || []),
                        ...(project?.tracks?.stickers || []),
                        ...(project?.tracks?.captions || []),
                        ...(project?.tracks?.effects || []),
                      ];
                      const maxTrk = Math.max(0, ...allClips.map((c: any) => typeof c.trackIndex === "number" ? c.trackIndex : 0));
                      if (onMoveClip) {
                        onMoveClip(selectedClip.id, normType, selectedClip.startTime, maxTrk + 1);
                        showToast(`Brought to Front (Layer ${maxTrk + 2})`);
                      }
                    }}
                  >
                    <Text style={styles.ratioText}>⏭ Bring to Front</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>

          {/* Layer Selector Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ratioScroll}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((layerIdx) => {
              const cur = typeof selectedClip.trackIndex === "number" ? selectedClip.trackIndex : (selectedClipType === "video" ? 0 : 2);
              const isSelected = cur === layerIdx;
              const normType = (selectedClipType === "captions" ? "caption" : selectedClipType === "stickers" ? "sticker" : selectedClipType === "effects" ? "effects" : selectedClipType) as any;
              return (
                <TouchableOpacity
                  key={layerIdx}
                  style={[
                    styles.ratioChip,
                    isSelected && styles.ratioChipActive,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    if (onMoveClip) {
                      onMoveClip(selectedClip.id, normType, selectedClip.startTime, layerIdx);
                      showToast(`Layer set to ${layerIdx + 1}`);
                    }
                  }}
                >
                  <Text style={[styles.ratioText, isSelected && styles.ratioTextActive]}>
                    Layer {layerIdx + 1}
                  </Text>
                  <Text style={styles.ratioDesc}>
                    {layerIdx === 0 ? "Main / Bottom" : `Overlay Track ${layerIdx}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 13. Style (PRO) Subpanel */}
      {activeSubPanel === "style" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>AI Style & 3D Zoom</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.effectsScroll}
          >
            {[
              { id: "3d_zoom", name: "3D Zoom Pro", icon: "cube-outline" as const },
              { id: "ai_anime", name: "AI Anime", icon: "face-woman-shimmer" as const },
              { id: "velocity_blur", name: "Velocity Blur", icon: "weather-windy" as const },
              { id: "cyber_avatar", name: "Cyberpunk AI", icon: "robot" as const },
            ].map((sty) => (
              <TouchableOpacity
                key={sty.id}
                style={styles.effectChip}
                onPress={() => showToast(`AI Style ${sty.name}: Not implemented yet`)}
              >
                <MaterialCommunityIcons
                  name={sty.icon}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.effectName}>{sty.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 14. Mask Subpanel */}
      {activeSubPanel === "mask" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Mask</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.effectsScroll}
          >
            {[
              { id: "none", name: "None", icon: "close-circle-outline" as const },
              { id: "split", name: "Split", icon: "arrow-split-vertical" as const },
              { id: "filmstrip", name: "Filmstrip", icon: "movie-roll" as const },
              { id: "circle", name: "Circle", icon: "circle-outline" as const },
              { id: "rectangle", name: "Rectangle", icon: "rectangle-outline" as const },
              { id: "heart", name: "Heart", icon: "heart-outline" as const },
              { id: "star", name: "Star", icon: "star-outline" as const },
            ].map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.maskChip,
                  activeMask === m.id && styles.maskChipActive,
                ]}
                onPress={() => {
                  setActiveMask(m.id);
                  if (onOpenMaskModal) onOpenMaskModal();
                  else showToast(`Mask ${m.name}: Applied`);
                }}
              >
                <MaterialCommunityIcons
                  name={m.icon}
                  size={20}
                  color={activeMask === m.id ? "#000000" : "#FFFFFF"}
                />
                <Text
                  style={[
                    styles.maskText,
                    activeMask === m.id && styles.maskTextActive,
                  ]}
                >
                  {m.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 15. Retouch (PRO) Subpanel */}
      {activeSubPanel === "retouch" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>AI Retouch & Beauty</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.effectsScroll}
          >
            {[
              { id: "smooth", name: "Smooth Face", icon: "sparkles" as const },
              { id: "brighten", name: "Brighten Skin", icon: "white-balance-sunny" as const },
              { id: "teeth", name: "Teeth Whiten", icon: "emoticon-outline" as const },
              { id: "reshape", name: "Slim Face", icon: "arrow-collapse-horizontal" as const },
            ].map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.retouchChip}
                onPress={() => showToast(`AI Retouch ${r.name}: Not implemented yet`)}
              >
                <MaterialCommunityIcons
                  name={r.icon as any}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.retouchText}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 16. Motion Blur Subpanel */}
      {activeSubPanel === "motion_blur" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Motion Blur: {motionBlurVal}%</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Intensity</Text>
            <View style={styles.sliderTrack}>
              {[20, 40, 60, 80, 100].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.sliderTick,
                    motionBlurVal === val && styles.sliderTickActive,
                  ]}
                  onPress={() => {
                    setMotionBlurVal(val);
                    showToast("Motion Blur: Not implemented yet");
                  }}
                >
                  <Text
                    style={[
                      styles.sliderTickText,
                      motionBlurVal === val && styles.sliderTickTextActive,
                    ]}
                  >
                    {val}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 17. Audio Effects Subpanel */}
      {activeSubPanel === "audio_effects" && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Voice & Audio Effects</Text>
            <TouchableOpacity onPress={() => setActiveSubPanel(null)}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.effectsScroll}
          >
            {["Deep Voice", "Echo Chamber", "Robot Synth", "Mic Reverb", "Lo-Fi Vinyl", "High Pitch"].map(
              (eff) => (
                <TouchableOpacity
                  key={eff}
                  style={styles.voiceEffChip}
                  onPress={() => showToast(`Audio effect ${eff}: Not implemented yet`)}
                >
                  <MaterialCommunityIcons
                    name="waveform"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.voiceEffText}>{eff}</Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        </View>
      )}
      </View>

      {/* ================= BOTTOM / VERTICAL TOOLBAR STRIP ================= */}
      <View style={[styles.toolbarStrip, isVertical && styles.toolbarStripVertical]}>
        {selectedClip ? (
          /* LEVEL 2: CLIP SELECTED CONTEXTUAL TOOLBAR */
          <>
            <TouchableOpacity
              style={[styles.backButton, isVertical && styles.backButtonVertical]}
              onPress={onDeselectClip}
              activeOpacity={0.7}
              accessibilityLabel="Deselect clip"
            >
              <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <ScrollView
              horizontal={!isVertical}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.toolsScroll, isVertical && styles.toolsScrollVertical]}
            >
              {currentClipTools.map((tool: any) => {
                const isActive = activeSubPanel === tool.id;
                return (
                  <TouchableOpacity
                    key={tool.id}
                    style={[styles.toolItem, isVertical && styles.toolItemVertical, isActive && styles.toolItemActive]}
                    onPress={() => handleClipToolPress(tool.id)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={tool.icon}
                      size={20}
                      color={
                        tool.id === "delete"
                          ? "#EF4444"
                          : isActive
                            ? "#00F2FE"
                            : "#D4D4D8"
                      }
                    />
                    <Text
                      style={[
                        styles.toolLabel,
                        tool.id === "delete" && { color: "#EF4444" },
                        isActive && styles.toolLabelActive,
                        isVertical && styles.toolLabelVertical,
                      ]}
                      numberOfLines={1}
                    >
                      {tool.title}
                    </Text>
                    {tool.isPro && (
                      <View style={styles.proTag}>
                        <Text style={styles.proTagText}>PRO</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : (
          /* LEVEL 1: ROOT TOOLBAR (when no clip is selected) */
          <ScrollView
            horizontal={!isVertical}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.toolsScroll, isVertical && styles.toolsScrollVertical]}
          >
            {ROOT_TOOLBAR_ITEMS.map((item) => {
              const isActive = activeSubPanel === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.toolItem, isVertical && styles.toolItemVertical, isActive && styles.toolItemActive]}
                  onPress={() => handleRootToolPress(item.id)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={isActive ? "#00F2FE" : "#D4D4D8"}
                  />
                  <Text
                    style={[
                      styles.toolLabel,
                      isActive && styles.toolLabelActive,
                      isVertical && styles.toolLabelVertical,
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexShrink: 0,
  },
  containerVertical: {
    width: 68,
    height: "100%",
    backgroundColor: "#0A0B0E",
    borderRightWidth: 1,
    borderRightColor: "#1A1B22",
    borderTopWidth: 0,
    flexShrink: 0,
    zIndex: 25,
  },
  subPanelsWrapperVertical: {
    position: "absolute",
    left: 68,
    top: 0,
    bottom: 0,
    width: 290,
    backgroundColor: "#0E0F14",
    borderRightWidth: 1,
    borderRightColor: "#1A1B22",
    zIndex: 100,
    overflow: "auto" as any,
  } as any,
  toastBox: {
    position: "absolute",
    top: -44,
    alignSelf: "center",
    backgroundColor: "#202026",
    borderWidth: 1,
    borderColor: "#32323D",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    zIndex: 99999,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  toolbarStrip: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    backgroundColor: "#000000",
  },
  toolbarStripVertical: {
    height: "100%",
    width: 68,
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 0,
    paddingVertical: 8,
    backgroundColor: "#0A0B0E",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backButtonVertical: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    marginRight: 0,
    backgroundColor: "#1A1B22",
    borderWidth: 1,
    borderColor: "#2A2D3A",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 2,
  },
  toolsScroll: {
    alignItems: "center",
    paddingRight: 16,
    gap: 2,
  },
  toolsScrollVertical: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 0,
    paddingVertical: 4,
    paddingRight: 0,
    gap: 4,
  },
  toolItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 54,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "relative",
  },
  toolItemVertical: {
    width: 58,
    minWidth: 58,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  },
  toolItemActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
  },
  toolLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 3,
  },
  toolLabelVertical: {
    fontSize: 9.5,
    textAlign: "center",
  },
  toolLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  proTag: {
    position: "absolute",
    top: 2,
    right: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  proTagText: {
    color: "#000000",
    fontSize: 7,
    fontWeight: "900",
  },

  // Subpanel Styles
  subPanel: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  subPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  subPanelTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Sliders
  sliderRow: {
    marginBottom: 10,
    gap: 6,
  },
  sliderLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  sliderTrack: {
    flexDirection: "row",
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 6,
    padding: 2,
    gap: 4,
  },
  sliderTick: {
    flex: 1,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  sliderTickActive: {
    backgroundColor: "#FFFFFF",
  },
  sliderTickText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  sliderTickTextActive: {
    color: "#000000",
    fontWeight: "700",
  },

  // Filters Scroll
  filterScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  filterItem: {
    alignItems: "center",
    width: 58,
    gap: 4,
  },
  filterItemActive: {
    transform: [{ scale: 1.05 }],
  },
  filterColorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#27272F",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterName: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    textAlign: "center",
  },
  filterNameActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Adjust Chips
  adjustScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  adjustChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  adjustChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },

  // Ratio Chips
  ratioScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  ratioChip: {
    backgroundColor: theme.colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  ratioChipActive: {
    borderColor: "#FFFFFF",
    backgroundColor: theme.colors.cardElevated,
  },
  ratioText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  ratioTextActive: {
    color: "#FFFFFF",
  },
  ratioDesc: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },

  // Text Subpanel
  textInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    paddingVertical: 8,
  },
  textAddBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  textAddBtnText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "700",
  },
  colorPaletteRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
    paddingVertical: 4,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  colorDotActive: {
    borderColor: "#FFFFFF",
    borderWidth: 2.5,
    transform: [{ scale: 1.15 }],
  },
  quickTextRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: theme.colors.cardBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  presetText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  textStudioBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingVertical: 8,
    gap: 6,
  },
  textStudioBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "700",
  },
  captionsList: {
    gap: 8,
    paddingVertical: 4,
  },
  captionActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  captionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.cardElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  captionTextCol: {
    flex: 1,
  },
  captionCardTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  captionCardDesc: {
    color: theme.colors.textMuted,
    fontSize: 10.5,
    lineHeight: 14,
  },

  // Speed Subpanel
  speedTabGroup: {
    flexDirection: "row",
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 6,
    padding: 2,
  },
  speedModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  speedModeBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  speedModeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  speedModeTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  speedOptions: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  speedPill: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  speedPillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  speedPillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  speedPillTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  curveScroll: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  curveCard: {
    width: 66,
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  curveCardActive: {
    borderColor: "#FFFFFF",
  },
  curveGraphIcon: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 24,
    gap: 2,
  },
  curveBar: {
    width: 3,
    backgroundColor: "#52525B",
    borderRadius: 1.5,
  },
  curveName: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
  },
  curveNameActive: {
    color: "#FFFFFF",
  },
  pitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  pitchLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  pitchSwitch: {
    width: 32,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#33333D",
    padding: 2,
  },
  pitchSwitchActive: {
    backgroundColor: "#FFFFFF",
  },
  pitchKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
  },
  pitchKnobActive: {
    transform: [{ translateX: 14 }],
    backgroundColor: "#000000",
  },

  // Volume
  volumeOptions: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  volChip: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  volChipActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  volChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  volChipTextActive: {
    color: "#000000",
    fontWeight: "700",
  },

  // Animations
  animScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  animCard: {
    width: 66,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  animName: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },
  animTypeTag: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  animTypeText: {
    color: theme.colors.textMuted,
    fontSize: 8,
    fontWeight: "700",
  },

  // Effects & Stickers
  effectsScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  effectChip: {
    backgroundColor: theme.colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    gap: 4,
  },
  effectName: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  stickersScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  stickerChip: {
    backgroundColor: theme.colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stickerText: {
    color: "#FFFFFF",
    fontSize: 13,
  },

  // Cutout
  cutoutRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
  },
  cutoutBtn: {
    flex: 1,
    height: 54,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  cutoutBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },

  // Mask
  maskChip: {
    width: 64,
    height: 60,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  maskChipActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  maskText: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: "600",
  },
  maskTextActive: {
    color: "#000000",
    fontWeight: "700",
  },

  // Retouch
  retouchChip: {
    width: 72,
    height: 60,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  retouchText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },

  // Audio Effects
  voiceEffChip: {
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voiceEffText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
});

export default React.memo(Toolbar);
