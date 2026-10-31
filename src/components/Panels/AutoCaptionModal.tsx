import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { FastArtProject, CaptionClip } from "../../types/project";
import {
  generateAutoCaptions,
  WHISPER_API_KEY_STORAGE_KEY,
  CAPTION_STYLE_PRESETS,
  CaptionStylePreset,
} from "../../services/aiCaptionEngine";
import MobileWhisperTranscriberView from "./MobileWhisperTranscriberView";
import {
  parseSrtOrVttContent,
  generateWordTimings,
  rechunkCaptionClips,
} from "../../utils/srtParser";
import {
  loadAllProjects,
  CaptionSettings,
  defaultCaptionSettings,
  getStorageItem,
  setStorageItem,
} from "../../utils/storage";
import { THEME_COLORS, DESIGN_CONSTANTS } from "../../constants/designConstants";
import { CustomColorPickerButton } from "../Common/CustomColorPickerButton";

interface AutoCaptionModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  project: FastArtProject | null;
  onAddCaptions: (clips: CaptionClip[]) => void;
  onUpdateProject?: (updates: Partial<FastArtProject>) => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
  selectedClipId?: string | null;
  isInline?: boolean;
}

const HIGHLIGHT_STYLE_OPTIONS: {
  label: string;
  value: "color" | "box" | "scale" | "glow" | "underline";
  icon: string;
}[] = [
  { label: "Classic", value: "color", icon: "color-palette-outline" },
  { label: "Pop Badge", value: "box", icon: "tablet-portrait-outline" },
  { label: "Scale Pop", value: "scale", icon: "expand-outline" },
  { label: "Neon Glow", value: "glow", icon: "flashlight-outline" },
  { label: "Underline", value: "underline", icon: "remove-outline" },
];

const HIGHLIGHT_COLOR_SWATCHES = [
  { label: "Viral Yellow", value: "#FFE600" },
  { label: "Neon Cyan", value: "#00F2FE" },
  { label: "Emerald Green", value: "#22C55E" },
  { label: "Hot Pink", value: "#FF007F" },
  { label: "Electric Orange", value: "#FF6600" },
  { label: "Cyber Violet", value: "#A855F7" },
  { label: "Crisp White", value: "#FFFFFF" },
  { label: "Pure Black", value: "#000000" },
];

const TEXT_COLOR_SWATCHES = [
  { label: "Crisp White", value: "#FFFFFF" },
  { label: "Viral Yellow", value: "#FFE600" },
  { label: "Neon Cyan", value: "#00F2FE" },
  { label: "Mint Green", value: "#34D399" },
  { label: "Hot Pink", value: "#FF007F" },
  { label: "Electric Orange", value: "#FF6600" },
  { label: "Cyber Violet", value: "#C084FC" },
  { label: "Pure Black", value: "#000000" },
];

const STROKE_COLOR_SWATCHES = [
  { label: "Pure Black", value: "#000000" },
  { label: "Crisp White", value: "#FFFFFF" },
  { label: "Slate Gray", value: "#64748B" },
  { label: "Neon Cyan", value: "#00F2FE" },
  { label: "Viral Yellow", value: "#FFE600" },
  { label: "Deep Crimson", value: "#DC2626" },
  { label: "None", value: "transparent" },
];

const STROKE_WIDTH_OPTIONS = [
  { label: "None", value: 0 },
  { label: "1.5px", value: 1.5 },
  { label: "3px", value: 3 },
  { label: "4.5px", value: 4.5 },
  { label: "6px", value: 6 },
];

const BG_BOX_PRESETS = [
  { label: "None", value: "transparent" },
  { label: "Studio Dark", value: "rgba(11, 13, 19, 0.85)" },
  { label: "Solid Black", value: "#000000" },
  { label: "Glass White", value: "rgba(255, 255, 255, 0.2)" },
  { label: "Neon Cyan", value: "rgba(0, 242, 254, 0.25)" },
  { label: "Viral Yellow", value: "rgba(255, 230, 0, 0.25)" },
];

const FONT_FAMILY_OPTIONS = [
  { label: "Impact", value: "Impact, Arial Black, sans-serif" },
  {
    label: "Modern Sans",
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  { label: "Montserrat", value: "'Montserrat', 'Arial Black', sans-serif" },
  { label: "Bebas", value: "'Bebas Neue', 'Oswald', sans-serif" },
  { label: "Typewriter", value: "'Courier New', Courier, monospace" },
];

const FONT_WEIGHT_OPTIONS = [
  { label: "Heavy", value: "900" },
  { label: "Extra", value: "800" },
  { label: "Bold", value: "700" },
  { label: "Semi", value: "600" },
];

const TEXT_EFFECT_OPTIONS = [
  { label: "None", value: "none", icon: "ban-outline" },
  { label: "3D", value: "3d", icon: "layers-outline" },
  { label: "Neon", value: "neon", icon: "flashlight-outline" },
  { label: "Dark", value: "shadow", icon: "cloudy-night-outline" },
];

const POSITION_PRESETS = [
  { label: "Bottom (82%)", value: 82, icon: "arrow-down" },
  { label: "Lower 3rd (70%)", value: 70, icon: "chevron-down" },
  { label: "Center (50%)", value: 50, icon: "remove" },
  { label: "Top (18%)", value: 18, icon: "arrow-up" },
];

const ALIGNMENT_OPTIONS = [
  { label: "Left", value: "left", icon: "reorder-three" },
  { label: "Center", value: "center", icon: "reorder-two" },
  { label: "Right", value: "right", icon: "reorder-four" },
];

export const CHUNK_MODE_OPTIONS = [
  { label: "Punchy (2-3w)", value: "punchy", maxWords: 3 },
  { label: "Balanced (4-5w)", value: "balanced", maxWords: 5 },
  { label: "Sentence (6+w)", value: "sentence", maxWords: 8 },
];

export default function AutoCaptionModal({
  visible,
  onClose,
  onApply,
  project,
  onAddCaptions,
  onUpdateProject,
  currentTime = 0,
  onSeek,
  selectedClipId,
  isInline = false,
}: AutoCaptionModalProps) {
  const currentProject = project || loadAllProjects()[0] || null;
  const existingCaptions = currentProject?.tracks?.captions || [];

  const [activeTab, setActiveTab] = useState<"captions" | "style">("captions");

  // Project-scoped caption styling state initialized from current project
  const initialSettings: CaptionSettings =
    currentProject?.captionSettings || defaultCaptionSettings;

  const [selectedPresetId, setSelectedPresetId] = useState(
    initialSettings.presetId,
  );
  const [enableHighlight, setEnableHighlight] = useState(
    initialSettings.enableHighlight,
  );
  const [highlightColor, setHighlightColor] = useState(
    initialSettings.highlightColor,
  );
  const [highlightStyle, setHighlightStyle] = useState<
    "color" | "box" | "scale" | "glow" | "underline"
  >(initialSettings.highlightStyle || "color");
  const [fontSize, setFontSize] = useState<number>(initialSettings.fontSize);
  const [fontFamily, setFontFamily] = useState<string>(
    initialSettings.fontFamily,
  );
  const [fontWeight, setFontWeight] = useState<string>(
    initialSettings.fontWeight,
  );
  const [textColor, setTextColor] = useState<string>(initialSettings.textColor);
  const [strokeColor, setStrokeColor] = useState<string>(
    initialSettings.strokeColor,
  );
  const [strokeWidth, setStrokeWidth] = useState<number>(
    initialSettings.strokeWidth,
  );
  const [backgroundColor, setBackgroundColor] = useState<string>(
    initialSettings.backgroundColor,
  );
  const [textEffect, setTextEffect] = useState<string>(
    initialSettings.textEffect,
  );
  const [animation, setAnimation] = useState<string>(initialSettings.animation);
  const [captionPositionY, setCaptionPositionY] = useState<number>(
    initialSettings.positionY,
  );
  const [textAlign, setTextAlign] = useState<"center" | "left" | "right">(
    initialSettings.textAlign,
  );
  const [uppercase, setUppercase] = useState<boolean>(
    initialSettings.uppercase,
  );
  const [chunkMode, setChunkMode] = useState<
    "punchy" | "balanced" | "sentence"
  >(initialSettings.chunkMode || "punchy");
  const [maxWordsPerCue, setMaxWordsPerCue] = useState<number>(
    initialSettings.maxWordsPerCue || 3,
  );

  const initialCaptionsRef = useRef<CaptionClip[]>([]);
  const initialSettingsRef = useRef<CaptionSettings | undefined>(undefined);

  // Synchronize state when opening modal or selecting clip
  useEffect(() => {
    if (!visible) return;

    initialCaptionsRef.current = currentProject?.tracks?.captions
      ? JSON.parse(JSON.stringify(currentProject.tracks.captions))
      : [];
    initialSettingsRef.current = currentProject?.captionSettings
      ? JSON.parse(JSON.stringify(currentProject.captionSettings))
      : undefined;

    const targetClip = selectedClipId
      ? existingCaptions.find((c) => c.id === selectedClipId)
      : null;

    if (targetClip) {
      if (targetClip.presetId) setSelectedPresetId(targetClip.presetId);
      if (targetClip.style?.color) setTextColor(targetClip.style.color);
      if (targetClip.style?.fontSize) setFontSize(targetClip.style.fontSize);
      if (targetClip.style?.fontFamily) setFontFamily(targetClip.style.fontFamily);
      if (targetClip.style?.fontWeight)
        setFontWeight(String(targetClip.style.fontWeight));
      if (targetClip.style?.strokeColor !== undefined)
        setStrokeColor(targetClip.style.strokeColor);
      if (targetClip.style?.strokeWidth !== undefined)
        setStrokeWidth(targetClip.style.strokeWidth);
      if (targetClip.style?.backgroundColor !== undefined)
        setBackgroundColor(targetClip.style.backgroundColor);
      if (targetClip.style?.textEffect !== undefined)
        setTextEffect(targetClip.style.textEffect);
      if (targetClip.animation) {
        const animStr = typeof targetClip.animation === 'string'
          ? targetClip.animation
          : targetClip.animation.preset || targetClip.animation.inPreset || 'karaoke';
        setAnimation(animStr);
      }
        setEnableHighlight(targetClip.enableWordHighlight);
      if (targetClip.highlightColor)
        setHighlightColor(targetClip.highlightColor);
      if (targetClip.highlightStyle)
        setHighlightStyle(targetClip.highlightStyle);
      if (targetClip.uppercase !== undefined)
        setUppercase(targetClip.uppercase);
      if (targetClip.position?.y !== undefined)
        setCaptionPositionY(targetClip.position.y);
    } else {
      const saved = currentProject?.captionSettings || defaultCaptionSettings;
      setSelectedPresetId(saved.presetId);
      setEnableHighlight(saved.enableHighlight);
      setHighlightColor(saved.highlightColor);
      setHighlightStyle(saved.highlightStyle || "color");
      setFontSize(saved.fontSize);
      setFontFamily(saved.fontFamily);
      setFontWeight(saved.fontWeight);
      setTextColor(saved.textColor);
      setStrokeColor(saved.strokeColor);
      setStrokeWidth(saved.strokeWidth);
      setBackgroundColor(saved.backgroundColor);
      setTextEffect(saved.textEffect);
      setAnimation(saved.animation);
      setCaptionPositionY(saved.positionY);
      setTextAlign(saved.textAlign);
      setUppercase(saved.uppercase);
      setChunkMode(saved.chunkMode);
      setMaxWordsPerCue(saved.maxWordsPerCue);
    }
  }, [visible, selectedClipId]);

  const persistSettings = (overrides?: Partial<CaptionSettings>) => {
    const updatedSettings: CaptionSettings = {
      presetId: overrides?.presetId ?? selectedPresetId,
      enableHighlight: overrides?.enableHighlight ?? enableHighlight,
      highlightColor: overrides?.highlightColor ?? highlightColor,
      highlightStyle: overrides?.highlightStyle ?? highlightStyle,
      fontSize: overrides?.fontSize ?? fontSize,
      fontFamily: overrides?.fontFamily ?? fontFamily,
      fontWeight: overrides?.fontWeight ?? fontWeight,
      textColor: overrides?.textColor ?? textColor,
      strokeColor: overrides?.strokeColor ?? strokeColor,
      strokeWidth: overrides?.strokeWidth ?? strokeWidth,
      backgroundColor: overrides?.backgroundColor ?? backgroundColor,
      textEffect: overrides?.textEffect ?? textEffect,
      animation: overrides?.animation ?? animation,
      positionY: overrides?.positionY ?? captionPositionY,
      textAlign: overrides?.textAlign ?? textAlign,
      uppercase: overrides?.uppercase ?? uppercase,
      maxWordsPerCue: overrides?.maxWordsPerCue ?? maxWordsPerCue,
      chunkMode: overrides?.chunkMode ?? chunkMode,
    };

    if (currentProject && onUpdateProject) {
      onUpdateProject({ captionSettings: updatedSettings });
    }
  };

  const getActiveStyleOverrides = (): Partial<CaptionClip> & {
    style?: CaptionClip["style"];
  } => ({
    presetId: selectedPresetId,
    position: { x: 50, y: captionPositionY },
    enableWordHighlight: enableHighlight,
    highlightColor,
    highlightStyle,
    animation: enableHighlight ? "karaoke" : animation,
    uppercase,
    style: {
      color: textColor,
      fontSize,
      fontFamily,
      fontWeight: fontWeight as any,
      strokeColor,
      strokeWidth,
      textEffect,
      backgroundColor,
      textAlign,
      uppercase,
      highlightStyle,
    },
  });

  // AI Generation state (English-only)
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual Paste SRT / API Key Modal state
  const [showPasteSrtBox, setShowPasteSrtBox] = useState(false);
  const [pastedSrtText, setPastedSrtText] = useState("");
  const [whisperApiKey, setWhisperApiKey] = useState(
    () => getStorageItem(WHISPER_API_KEY_STORAGE_KEY) || "",
  );

  // Live Highlight demo ticker for the Style tab preview
  const [previewTick, setPreviewTick] = useState(0);
  useEffect(() => {
    if (visible && activeTab === "style") {
      const interval = setInterval(() => {
        setPreviewTick((t) => t + 1);
      }, 650);
      return () => clearInterval(interval);
    }
  }, [visible, activeTab]);

  // =================== SRT FILE IMPORT / EXPORT ===================
  const handleImportSrtFile = () => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".srt,.vtt,.txt";
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
              const parsedCaptions = parseSrtOrVttContent(
                content,
                highlightColor,
                getActiveStyleOverrides(),
              );
              if (parsedCaptions.length > 0) {
                soundEngine.playSfx("pop");
                onAddCaptions(parsedCaptions);
                setActiveTab("captions");
              } else {
                setErrorMessage(
                  "Could not parse valid subtitles. Please verify the .SRT or .VTT file format.",
                );
              }
            }
          };
          reader.readAsText(file);
        }
      };
      setTimeout(() => {
        try {
          input.click();
        } catch (_) {}
      }, 40);
    } else {
      setShowPasteSrtBox(true);
    }
  };

  const handleApplyPastedSrt = async () => {
    if (!pastedSrtText.trim()) return;
    const parsed = parseSrtOrVttContent(
      pastedSrtText,
      highlightColor,
      getActiveStyleOverrides(),
    );
    if (parsed.length > 0) {
      soundEngine.playSfx("pop");
      onAddCaptions(parsed);
      setPastedSrtText("");
      setShowPasteSrtBox(false);
      setActiveTab("captions");
      return;
    }

    const lines = pastedSrtText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\d+$/.test(l));

    if (lines.length > 0 && currentProject) {
      try {
        setIsGenerating(true);
        setStatusText("Aligning dialogue script to audio cadence...");
        const aligned = await generateAutoCaptions(
          currentProject,
          "en-US",
          selectedPresetId,
          lines,
          undefined,
          getActiveStyleOverrides(),
        );
        if (aligned && aligned.length > 0) {
          soundEngine.playSfx("pop");
          onAddCaptions(aligned);
          setPastedSrtText("");
          setShowPasteSrtBox(false);
          setActiveTab("captions");
          setStatusText(`Imported and aligned ${aligned.length} subtitle cues!`);
          return;
        }
      } catch (e: any) {
        setErrorMessage(e?.message || "Failed to align dialogue.");
      } finally {
        setIsGenerating(false);
      }
    } else {
      setErrorMessage(
        "Invalid subtitle format. Paste standard SRT or dialogue text.",
      );
    }
  };

  // =================== SUBTITLE CUE EDITING ===================
  const handleUpdateCueText = (cueId: string, newText: string) => {
    if (!currentProject || !onUpdateProject) return;
    const updated = existingCaptions.map((cap) => {
      if (cap.id === cueId) {
        const words = generateWordTimings(newText, cap.startTime, cap.duration);
        return { ...cap, text: newText, words };
      }
      return cap;
    });
    onUpdateProject({
      tracks: { ...currentProject.tracks, captions: updated },
    });
  };

  const handleDeleteCue = (cueId: string) => {
    if (!currentProject || !onUpdateProject) return;
    soundEngine.playSfx("pop");
    const filtered = existingCaptions.filter((c) => c.id !== cueId);
    onUpdateProject({
      tracks: { ...currentProject.tracks, captions: filtered },
    });
  };

  const handleAddNewCueAtPlayhead = () => {
    if (!currentProject || !onUpdateProject) return;
    soundEngine.playSfx("pop");
    const styleOverrides = getActiveStyleOverrides();
    const newCue: CaptionClip = {
      id: `cap-${Date.now()}`,
      text: uppercase ? "NEW SUBTITLE LINE" : "New subtitle line",
      startTime: Number(currentTime.toFixed(2)),
      duration: 2.5,
      position: styleOverrides.position || { x: 50, y: captionPositionY },
      scale: 1.0,
      rotation: 0,
      animation: styleOverrides.animation || "karaoke",
      enableWordHighlight: enableHighlight,
      highlightColor,
      presetId: selectedPresetId,
      uppercase,
      words: generateWordTimings(
        uppercase ? "NEW SUBTITLE LINE" : "New subtitle line",
        currentTime,
        2.5,
      ),
      style: {
        color: textColor,
        fontSize,
        fontFamily,
        fontWeight: fontWeight as any,
        strokeColor,
        strokeWidth,
        textEffect,
        backgroundColor,
        textAlign,
        uppercase,
      },
    };
    const updated = [...existingCaptions, newCue].sort(
      (a, b) => a.startTime - b.startTime,
    );
    onUpdateProject({
      tracks: { ...currentProject.tracks, captions: updated },
    });
  };

  const handleClearAllCaptions = () => {
    if (!currentProject || !onUpdateProject) return;
    soundEngine.playSfx("click");
    onUpdateProject({
      tracks: { ...currentProject.tracks, captions: [] },
    });
  };

  const handleResetToDefaults = () => {
    soundEngine.playSfx("click");
    setSelectedPresetId(defaultCaptionSettings.presetId);
    setEnableHighlight(defaultCaptionSettings.enableHighlight);
    setHighlightColor(defaultCaptionSettings.highlightColor);
    setHighlightStyle(defaultCaptionSettings.highlightStyle || "color");
    setFontSize(defaultCaptionSettings.fontSize);
    setFontFamily(defaultCaptionSettings.fontFamily);
    setFontWeight(defaultCaptionSettings.fontWeight);
    setTextColor(defaultCaptionSettings.textColor);
    setStrokeColor(defaultCaptionSettings.strokeColor);
    setStrokeWidth(defaultCaptionSettings.strokeWidth);
    setBackgroundColor(defaultCaptionSettings.backgroundColor);
    setTextEffect(defaultCaptionSettings.textEffect);
    setAnimation(defaultCaptionSettings.animation);
    setCaptionPositionY(defaultCaptionSettings.positionY);
    setTextAlign(defaultCaptionSettings.textAlign);
    setUppercase(defaultCaptionSettings.uppercase);
    setChunkMode(defaultCaptionSettings.chunkMode);
    setMaxWordsPerCue(defaultCaptionSettings.maxWordsPerCue);
    persistSettings(defaultCaptionSettings);
  };

  const handleRechunkTimelineCaptions = () => {
    if (!currentProject || !onUpdateProject || existingCaptions.length === 0)
      return;
    soundEngine.playSfx("pop");
    const rechunked = rechunkCaptionClips(
      existingCaptions,
      maxWordsPerCue,
      1.8,
    );
    onUpdateProject({
      tracks: { ...currentProject.tracks, captions: rechunked },
    });
    setStatusText(
      `Re-chunked ${existingCaptions.length} captions into ${rechunked.length} short phrases!`,
    );
  };

  const handleApplyPreset = (preset: CaptionStylePreset) => {
    soundEngine.playSfx("click");
    setSelectedPresetId(preset.id);
    setTextColor(preset.color);
    setBackgroundColor(preset.bgColor || "transparent");
    setFontFamily(preset.fontFamily);
    setFontSize(preset.fontSize);
    setFontWeight(preset.fontWeight || "800");
    setStrokeColor(preset.strokeColor || "transparent");
    setStrokeWidth(preset.strokeWidth || 0);
    setTextEffect(preset.textEffect || "none");
    setAnimation(preset.animation || "karaoke");
    if (preset.color) {
      setHighlightColor(preset.color === "#FFE600" ? "#00F2FE" : "#FFE600");
    }
    persistSettings({
      presetId: preset.id,
      textColor: preset.color,
      backgroundColor: preset.bgColor || "transparent",
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight || "800",
      strokeColor: preset.strokeColor || "transparent",
      strokeWidth: preset.strokeWidth || 0,
      textEffect: preset.textEffect || "none",
      animation: preset.animation || "karaoke",
    });
  };

  const handleApplyStyleToAll = () => {
    if (!currentProject || !onUpdateProject || existingCaptions.length === 0)
      return;
    soundEngine.playSfx("pop");

    const updatedSettings: CaptionSettings = {
      presetId: selectedPresetId,
      enableHighlight,
      highlightColor,
      highlightStyle,
      fontSize,
      fontFamily,
      fontWeight,
      textColor,
      strokeColor,
      strokeWidth,
      backgroundColor,
      textEffect,
      animation,
      positionY: captionPositionY,
      textAlign,
      uppercase,
      maxWordsPerCue,
      chunkMode,
    };

    const updated = existingCaptions.map((cap) => ({
      ...cap,
      presetId: selectedPresetId,
      position: { x: cap.position?.x ?? 50, y: captionPositionY },
      enableWordHighlight: enableHighlight,
      highlightColor,
      highlightStyle,
      animation: enableHighlight ? "karaoke" : animation,
      uppercase,
      style: {
        ...cap.style,
        color: textColor,
        fontSize,
        fontFamily,
        fontWeight: fontWeight as any,
        strokeColor,
        strokeWidth,
        textEffect,
        backgroundColor,
        textAlign,
        uppercase,
        highlightStyle,
      },
    }));

    onUpdateProject({
      tracks: { ...currentProject.tracks, captions: updated },
      captionSettings: updatedSettings,
    });
    onClose();
  };

  const handleApplyStyleToSelected = () => {
    if (!currentProject || !onUpdateProject || !selectedClipId) return;
    soundEngine.playSfx("pop");

    const updatedSettings: CaptionSettings = {
      presetId: selectedPresetId,
      enableHighlight,
      highlightColor,
      highlightStyle,
      fontSize,
      fontFamily,
      fontWeight,
      textColor,
      strokeColor,
      strokeWidth,
      backgroundColor,
      textEffect,
      animation,
      positionY: captionPositionY,
      textAlign,
      uppercase,
      maxWordsPerCue,
      chunkMode,
    };

    const updated = existingCaptions.map((cap) => {
      if (cap.id === selectedClipId) {
        return {
          ...cap,
          presetId: selectedPresetId,
          position: { x: cap.position?.x ?? 50, y: captionPositionY },
          enableWordHighlight: enableHighlight,
          highlightColor,
          highlightStyle,
          animation: enableHighlight ? "karaoke" : animation,
          uppercase,
          style: {
            ...cap.style,
            color: textColor,
            fontSize,
            fontFamily,
            fontWeight: fontWeight as any,
            strokeColor,
            strokeWidth,
            textEffect,
            backgroundColor,
            textAlign,
            uppercase,
            highlightStyle,
          },
        };
      }
      return cap;
    });

    onUpdateProject({
      tracks: { ...currentProject.tracks, captions: updated },
      captionSettings: updatedSettings,
    });
    onClose();
  };

  // =================== AI TRANSCRIPTION ===================
  const handleGenerate = async () => {
    if (!currentProject) {
      setErrorMessage("Please open or create a project first.");
      return;
    }

    soundEngine.playSfx("click");
    setErrorMessage(null);
    setIsGenerating(true);
    setProgressPct(10);
    setStatusText("Analyzing master timeline audio...");

    let maxSeenPct = 10;
    try {
      const generated = await generateAutoCaptions(
        currentProject,
        "en-US",
        selectedPresetId,
        undefined,
        (pct, status) => {
          maxSeenPct = Math.max(maxSeenPct, Math.min(99, Math.round(pct)));
          setProgressPct(maxSeenPct);
          if (status) setStatusText(status);
        },
        getActiveStyleOverrides(),
      );

      if (!generated || generated.length === 0) {
        throw new Error(
          "Could not detect clear spoken audio in this project.",
        );
      }

      soundEngine.playSfx("pop");
      onAddCaptions(generated);
      setStatusText(`Generated ${generated.length} caption cues!`);
    } catch (err: any) {
      console.error("FastArt: AutoCaption error", err);
      const msg = err?.message || "Failed to generate captions.";
      setStatusText(msg);
      setErrorMessage(msg);
      soundEngine.playSfx("click");
    } finally {
      setIsGenerating(false);
    }
  };

  const sheetContent = (
    <View style={styles.sheetContainer}>
      {/* Top Header - Rendered only in Standalone Modal Mode (Hidden in Inline Mobile Sheet) */}
      {!isInline && (
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="chatbox-ellipses-outline" size={15} color={THEME_COLORS.accent} />
            <Text style={styles.headerTitle}>Auto Captions</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TouchableOpacity
              onPress={handleResetToDefaults}
              style={styles.headerActionBtn}
              activeOpacity={0.7}
              accessibilityLabel="Reset defaults"
            >
              <Ionicons name="refresh-outline" size={11} color={THEME_COLORS.accent} />
              <Text style={styles.headerActionText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={14} color={THEME_COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modern Clean Segmented Navigation Bar */}
      <View style={styles.navBar}>
        <View style={styles.segmentedRow}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === "captions" && styles.segmentBtnActive,
            ]}
            onPress={() => {
              soundEngine.playSfx("click");
              setActiveTab("captions");
            }}
          >
            <Ionicons
              name="chatbox-ellipses-outline"
              size={13}
              color={activeTab === "captions" ? "#000000" : THEME_COLORS.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === "captions" && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              Captions ({existingCaptions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === "style" && styles.segmentBtnActive,
            ]}
            onPress={() => {
              soundEngine.playSfx("click");
              setActiveTab("style");
            }}
          >
            <Ionicons
              name="sparkles-outline"
              size={13}
              color={activeTab === "style" ? "#000000" : THEME_COLORS.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === "style" && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              Style & Presets
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Banner */}
      {errorMessage && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={styles.errorText} numberOfLines={2}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            onPress={() => setErrorMessage(null)}
            style={{ padding: 2 }}
          >
            <Ionicons name="close" size={13} color="#FCA5A5" />
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================
          TAB 1: CAPTIONS CUE EDITOR & AUTO TRANSCRIBE
          ======================================================== */}
      {activeTab === "captions" && (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={{ paddingBottom: 28 }}
          showsVerticalScrollIndicator={true}
        >
          {/* Action Card: Auto Transcribe + Import SRT */}
          <View style={styles.compactActionCard}>
            {isGenerating ? (
              <View style={styles.generatingRow}>
                <ActivityIndicator size="small" color={THEME_COLORS.accent} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.statusText} numberOfLines={1}>
                    {statusText || "Generating captions..."}
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[styles.progressBarFill, { width: `${progressPct}%` }]}
                    />
                  </View>
                </View>
                <Text style={styles.pctText}>{progressPct}%</Text>
              </View>
            ) : (
              <View style={styles.actionCardContent}>
                {/* Full-width primary Auto Transcribe button */}
                <TouchableOpacity
                  style={styles.transcribeBtn}
                  onPress={handleGenerate}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sparkles" size={14} color="#000000" />
                  <Text style={styles.transcribeBtnText}>Auto Transcribe (AI FREE)</Text>
                </TouchableOpacity>

                {/* Import SRT / Script Button */}
                <TouchableOpacity
                  style={styles.importSrtRowBtn}
                  onPress={handleImportSrtFile}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cloud-upload-outline" size={13} color={THEME_COLORS.accent} />
                  <Text style={styles.importSrtRowText}>Import .SRT or Dialogue Script</Text>
                </TouchableOpacity>

                {/* Phrase Length Selector */}
                <View style={styles.chunkSection}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.microTitle}>PHRASE LENGTH</Text>
                    {existingCaptions.length > 0 && (
                      <TouchableOpacity
                        style={styles.rechunkActionBtn}
                        onPress={handleRechunkTimelineCaptions}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="cut-outline" size={11} color={THEME_COLORS.accent} />
                        <Text style={styles.rechunkActionText}>Re-chunk Timeline</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.chunkChipsGroup}>
                    {CHUNK_MODE_OPTIONS.map((opt) => {
                      const isSelected = chunkMode === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.chunkChip,
                            isSelected && styles.chunkChipActive,
                          ]}
                          onPress={() => {
                            soundEngine.playSfx("click");
                            setChunkMode(opt.value as any);
                            setMaxWordsPerCue(opt.maxWords);
                            persistSettings({
                              chunkMode: opt.value as any,
                              maxWordsPerCue: opt.maxWords,
                            });
                          }}
                        >
                          <Text
                            style={[
                              styles.chunkChipText,
                              isSelected && styles.chunkChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Cues List Header */}
          <View style={styles.cuesListHeader}>
            <Text style={styles.sectionHeaderTitle}>
              SUBTITLE CUES ({existingCaptions.length})
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TouchableOpacity
                style={styles.cueActionBtn}
                onPress={handleAddNewCueAtPlayhead}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={12} color={THEME_COLORS.accent} />
                <Text style={styles.cueActionText}>Add Cue</Text>
              </TouchableOpacity>

              {existingCaptions.length > 0 && (
                <TouchableOpacity
                  style={[styles.cueActionBtn, { borderColor: THEME_COLORS.error }]}
                  onPress={handleClearAllCaptions}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={11} color={THEME_COLORS.error} />
                  <Text style={[styles.cueActionText, { color: THEME_COLORS.error }]}>
                    Clear
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Cues Content List */}
          {existingCaptions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={30}
                color={THEME_COLORS.textMuted}
              />
              <Text style={styles.emptyTitle}>No captions yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap "Auto Transcribe" above to generate subtitles automatically, or import an SRT script.
              </Text>
            </View>
          ) : (
            <View style={styles.cuesList}>
              {existingCaptions.map((cap, idx) => {
                const isSelected = selectedClipId === cap.id;
                const startStr = cap.startTime.toFixed(2);
                const endStr = (cap.startTime + cap.duration).toFixed(2);

                return (
                  <View
                    key={cap.id}
                    style={[
                      styles.cueCard,
                      isSelected && styles.cueCardSelected,
                    ]}
                  >
                    <View style={styles.cueMetaRow}>
                      <View style={styles.cueTimeBadge}>
                        <Text style={styles.cueTimeText}>
                          #{idx + 1} · {startStr}s ➔ {endStr}s ({cap.duration.toFixed(1)}s)
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {onSeek && (
                          <TouchableOpacity
                            style={styles.cueIconBtn}
                            onPress={() => {
                              soundEngine.playSfx("click");
                              onSeek(cap.startTime);
                            }}
                            accessibilityLabel="Play at cue"
                          >
                            <Ionicons
                              name="play-circle-outline"
                              size={14}
                              color={THEME_COLORS.accent}
                            />
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={styles.cueIconBtn}
                          onPress={() => handleDeleteCue(cap.id)}
                          accessibilityLabel="Delete cue"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={13}
                            color={THEME_COLORS.error}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TextInput
                      style={styles.cueInput}
                      value={cap.text}
                      onChangeText={(txt) => handleUpdateCueText(cap.id, txt)}
                      multiline
                      placeholder="Subtitle dialogue text..."
                      placeholderTextColor={THEME_COLORS.textMuted}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ========================================================
          TAB 2: STYLE & VIRAL PRESETS
          ======================================================== */}
      {activeTab === "style" && (
        <View style={styles.styleTabRoot}>
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.styleScrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* 1. Live Karaoke Animation Preview Banner */}
            <View style={styles.previewBanner}>
              <View
                style={[
                  styles.previewBox,
                  backgroundColor &&
                    backgroundColor !== "transparent" && {
                      backgroundColor,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 6,
                    },
                ]}
              >
                <View
                  style={[
                    styles.previewWordsRow,
                    {
                      justifyContent:
                        textAlign === "left"
                          ? "flex-start"
                          : textAlign === "right"
                          ? "flex-end"
                          : "center",
                    },
                  ]}
                >
                  {["SPEAK", "EVERY", "SINGLE", "WORD"].map((w, wIdx) => {
                    const displayedWord = uppercase ? w.toUpperCase() : w;
                    const isActiveWord =
                      enableHighlight && previewTick % 4 === wIdx;
                    const isBox = isActiveWord && highlightStyle === "box";
                    const isGlow = isActiveWord && highlightStyle === "glow";
                    const isScale = isActiveWord && highlightStyle === "scale";
                    const isUnderline =
                      isActiveWord && highlightStyle === "underline";

                    let wordColor = textColor;
                    if (isActiveWord) {
                      if (isBox) {
                        wordColor =
                          highlightColor === "#000000" ? "#FFFFFF" : "#000000";
                      } else {
                        wordColor = highlightColor;
                      }
                    }

                    return (
                      <View
                        key={wIdx}
                        style={[
                          styles.wordPill,
                          isBox && {
                            backgroundColor: highlightColor,
                            borderRadius: 4,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                          },
                          isScale && { transform: [{ scale: 1.15 }] },
                        ]}
                      >
                        <Text
                          style={[
                            styles.wordText,
                            {
                              color: wordColor,
                              fontFamily,
                              fontSize: Math.min(18, fontSize),
                              fontWeight: fontWeight as any,
                              textShadowColor: isGlow
                                ? highlightColor
                                : textEffect === "neon"
                                ? wordColor
                                : textEffect === "3d" || textEffect === "shadow"
                                ? strokeColor !== "transparent"
                                ? strokeColor
                                : "#000000"
                                : "transparent",
                              textShadowRadius: isGlow
                                ? 12
                                : textEffect === "neon"
                                ? 10
                                : textEffect === "shadow"
                                ? 4
                                : 0,
                              textShadowOffset:
                                textEffect === "3d" && !isGlow
                                  ? { width: 1.5, height: 1.5 }
                                  : { width: 0, height: 0 },
                            },
                          ]}
                        >
                          {displayedWord}
                        </Text>
                        {isUnderline && (
                          <View
                            style={{
                              height: 2.5,
                              backgroundColor: highlightColor,
                              borderRadius: 2,
                              marginTop: 1,
                              width: "100%",
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 2. Viral Preset 3-Column Grid (ALL VISIBLE - ZERO HORIZONTAL SCROLL) */}
            <View style={styles.sectionCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>VIRAL PRESETS</Text>
                <TouchableOpacity
                  onPress={handleResetToDefaults}
                  style={styles.resetPresetBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={10} color={THEME_COLORS.textMuted} />
                  <Text style={styles.resetPresetText}>Reset</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.presetGrid}>
                {CAPTION_STYLE_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  const shortName =
                    preset.id === "mrbeast"
                      ? "Viral Pop"
                      : preset.id === "hormozi"
                      ? "Hormozi"
                      : preset.id === "karaoke"
                      ? "Karaoke"
                      : preset.id === "minimal_box"
                      ? "Modern Box"
                      : preset.id === "cyber_violet"
                      ? "Cyber Neon"
                      : preset.id === "cinema_yellow"
                      ? "Cinema"
                      : preset.name.split(" ")[0];

                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetGridCard,
                        isSelected && styles.presetGridCardActive,
                      ]}
                      onPress={() => handleApplyPreset(preset)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.presetBadge,
                          {
                            backgroundColor:
                              preset.bgColor && preset.bgColor !== "transparent"
                                ? preset.bgColor
                                : "#08090E",
                            borderColor: preset.strokeColor || "transparent",
                            borderWidth: preset.strokeWidth ? 1 : 0,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: preset.color,
                            fontSize: 11,
                            fontWeight: "900",
                            fontFamily: preset.fontFamily,
                          }}
                          numberOfLines={1}
                        >
                          Aa
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.presetGridName,
                          isSelected && styles.presetGridNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {shortName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Karaoke Word Highlight Style & Colors (ALL VISIBLE) */}
            <View style={styles.sectionCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>KARAOKE WORD HIGHLIGHT</Text>
                <TouchableOpacity
                  onPress={() => {
                    const next = !enableHighlight;
                    setEnableHighlight(next);
                    persistSettings({ enableHighlight: next });
                  }}
                  style={[styles.pillSwitch, enableHighlight && styles.pillSwitchActive]}
                >
                  <Text style={[styles.pillSwitchText, enableHighlight && styles.pillSwitchTextActive]}>
                    {enableHighlight ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>

              {enableHighlight && (
                <>
                  {/* Highlight Style Options Grid (3-col + 2-col, NO CLIPPING) */}
                  <View style={styles.highlightPillsGrid}>
                    {HIGHLIGHT_STYLE_OPTIONS.map((opt, optIdx) => {
                      const isSelected = highlightStyle === opt.value;
                      const isThreeCol = optIdx < 3;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            isThreeCol ? styles.highlightChip3Col : styles.highlightChip2Col,
                            isSelected && styles.highlightChipActive,
                          ]}
                          onPress={() => {
                            soundEngine.playSfx("click");
                            setHighlightStyle(opt.value);
                            persistSettings({ highlightStyle: opt.value });
                          }}
                        >
                          <Ionicons
                            name={opt.icon as any}
                            size={11}
                            color={isSelected ? "#000000" : THEME_COLORS.textSecondary}
                          />
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 8 Highlight Colors in 1 Balanced Row (ZERO HORIZONTAL SCROLL) */}
                  <View style={styles.swatchesRow}>
                    {HIGHLIGHT_COLOR_SWATCHES.map((swatch) => {
                      const isSelected = highlightColor === swatch.value;
                      return (
                        <TouchableOpacity
                          key={swatch.value}
                          style={[
                            styles.swatchCircle,
                            { backgroundColor: swatch.value },
                            isSelected && styles.swatchCircleSelected,
                          ]}
                          onPress={() => {
                            soundEngine.playSfx("click");
                            setHighlightColor(swatch.value);
                            persistSettings({ highlightColor: swatch.value });
                          }}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={11}
                              color={
                                swatch.value === "#FFFFFF" ||
                                swatch.value === "#FFE600" ||
                                swatch.value === "#00F2FE"
                                  ? "#000000"
                                  : "#FFFFFF"
                              }
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <CustomColorPickerButton
                      value={highlightColor}
                      presets={HIGHLIGHT_COLOR_SWATCHES}
                      onColorChange={(col) => {
                        setHighlightColor(col);
                        persistSettings({ highlightColor: col });
                      }}
                      size={24}
                      shape="circle"
                      accessibilityLabel="Pick custom highlight color"
                    />
                  </View>
                </>
              )}
            </View>

            {/* 4. Typography: Font Size, 2-Col Font Grid, Weights, Alignment */}
            <View style={styles.sectionCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>TYPOGRAPHY</Text>
                {/* Font Size Stepper */}
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperAction}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      const next = Math.max(10, fontSize - 2);
                      setFontSize(next);
                      persistSettings({ fontSize: next });
                    }}
                  >
                    <Ionicons name="remove" size={11} color={THEME_COLORS.textSecondary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperLabel}>{fontSize}px</Text>
                  <TouchableOpacity
                    style={styles.stepperAction}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      const next = Math.min(52, fontSize + 2);
                      setFontSize(next);
                      persistSettings({ fontSize: next });
                    }}
                  >
                    <Ionicons name="add" size={11} color={THEME_COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Font Family 2-Column Grid (ALL 5 VISIBLE, EASY TO TAP) */}
              <View style={styles.fontGrid}>
                {FONT_FAMILY_OPTIONS.map((f, fIdx) => {
                  const isSelected = fontFamily === f.value;
                  const isLastOdd = fIdx === FONT_FAMILY_OPTIONS.length - 1 && fIdx % 2 === 0;
                  return (
                    <TouchableOpacity
                      key={f.value}
                      style={[
                        styles.fontChip,
                        isLastOdd && { width: "100%" },
                        isSelected && styles.fontChipActive,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx("click");
                        setFontFamily(f.value);
                        persistSettings({ fontFamily: f.value });
                      }}
                    >
                      <Text
                        style={[
                          styles.fontChipText,
                          { fontFamily: f.value },
                          isSelected && styles.fontChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Weights + Caps + Alignment */}
              <View style={styles.typographyToolbar}>
                <View style={{ flexDirection: "row", gap: 3, flex: 1 }}>
                  {FONT_WEIGHT_OPTIONS.map((fw) => {
                    const isSelected = fontWeight === fw.value;
                    return (
                      <TouchableOpacity
                        key={fw.value}
                        style={[
                          styles.microBtn,
                          isSelected && styles.microBtnActive,
                        ]}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          setFontWeight(fw.value);
                          persistSettings({ fontWeight: fw.value });
                        }}
                      >
                        <Text
                          style={[
                            styles.microBtnText,
                            isSelected && styles.microBtnTextActive,
                          ]}
                        >
                          {fw.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* CAPS toggle */}
                <TouchableOpacity
                  style={[styles.microBtn, uppercase && styles.microBtnActive]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    const next = !uppercase;
                    setUppercase(next);
                    persistSettings({ uppercase: next });
                  }}
                >
                  <Text
                    style={[
                      styles.microBtnText,
                      uppercase && styles.microBtnTextActive,
                    ]}
                  >
                    CAPS
                  </Text>
                </TouchableOpacity>

                {/* Alignment buttons */}
                <View style={styles.alignPillGroup}>
                  {ALIGNMENT_OPTIONS.map((al) => {
                    const isSelected = textAlign === al.value;
                    return (
                      <TouchableOpacity
                        key={al.value}
                        style={[styles.alignItem, isSelected && styles.alignItemActive]}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          setTextAlign(al.value as any);
                          persistSettings({ textAlign: al.value as any });
                        }}
                      >
                        <Ionicons
                          name={al.icon as any}
                          size={12}
                          color={isSelected ? "#000000" : THEME_COLORS.textSecondary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 5. Text & Outline Color (ALL VISIBLE IN 1 ROW - ZERO HORIZONTAL SCROLL) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>TEXT & OUTLINE COLOR</Text>
              
              {/* 8 Text Colors in 1 Balanced Row */}
              <View style={styles.swatchesRow}>
                {TEXT_COLOR_SWATCHES.map((swatch) => {
                  const isSelected = textColor === swatch.value;
                  return (
                    <TouchableOpacity
                      key={swatch.value}
                      style={[
                        styles.swatchCircle,
                        { backgroundColor: swatch.value },
                        isSelected && styles.swatchCircleSelected,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx("click");
                        setTextColor(swatch.value);
                        persistSettings({ textColor: swatch.value });
                      }}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={11}
                          color={
                            swatch.value === "#FFFFFF" ||
                            swatch.value === "#FFE600" ||
                            swatch.value === "#00F2FE"
                              ? "#000000"
                              : "#FFFFFF"
                          }
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
                <CustomColorPickerButton
                  value={textColor}
                  presets={TEXT_COLOR_SWATCHES}
                  onColorChange={(col) => {
                    setTextColor(col);
                    persistSettings({ textColor: col });
                  }}
                  size={24}
                  shape="circle"
                  accessibilityLabel="Pick custom caption text color"
                />
              </View>

              {/* Stroke Widths */}
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={styles.microTitle}>STROKE</Text>
                <View style={{ flexDirection: "row", gap: 3, flex: 1, justifyContent: "flex-end" }}>
                  {STROKE_WIDTH_OPTIONS.map((sw) => {
                    const isSelected = strokeWidth === sw.value;
                    return (
                      <TouchableOpacity
                        key={sw.value}
                        style={[styles.microBtn, isSelected && styles.microBtnActive]}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          setStrokeWidth(sw.value);
                          persistSettings({ strokeWidth: sw.value });
                        }}
                      >
                        <Text
                          style={[
                            styles.microBtnText,
                            isSelected && styles.microBtnTextActive,
                          ]}
                        >
                          {sw.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 7 Stroke Color Swatches in 1 Balanced Row */}
              {strokeWidth > 0 && (
                <View style={[styles.swatchesRow, { marginTop: 6 }]}>
                  {STROKE_COLOR_SWATCHES.map((swatch) => {
                    const isSelected = strokeColor === swatch.value;
                    return (
                      <TouchableOpacity
                        key={swatch.value}
                        style={[
                          styles.swatchCircle,
                          {
                            backgroundColor:
                              swatch.value === "transparent" ? "#1E2638" : swatch.value,
                          },
                          isSelected && styles.swatchCircleSelected,
                        ]}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          setStrokeColor(swatch.value);
                          persistSettings({ strokeColor: swatch.value });
                        }}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={11}
                            color={swatch.value === "#FFFFFF" ? "#000000" : "#FFFFFF"}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <CustomColorPickerButton
                    value={strokeColor}
                    presets={STROKE_COLOR_SWATCHES}
                    onColorChange={(col) => {
                      setStrokeColor(col);
                      persistSettings({ strokeColor: col });
                    }}
                    size={24}
                    shape="circle"
                    accessibilityLabel="Pick custom caption stroke color"
                  />
                </View>
              )}
            </View>

            {/* 6. Backdrop Box & Effects (3-COL GRID - ZERO HORIZONTAL SCROLL) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>BACKDROP BOX & EFFECTS</Text>
              
              {/* 6 Backdrop Options in 3x2 Grid - All Visible */}
              <View style={styles.boxGrid}>
                {BG_BOX_PRESETS.map((box) => {
                  const isSelected = backgroundColor === box.value;
                  return (
                    <TouchableOpacity
                      key={box.value}
                      style={[styles.boxChip, isSelected && styles.boxChipActive]}
                      onPress={() => {
                        soundEngine.playSfx("click");
                        setBackgroundColor(box.value);
                        persistSettings({ backgroundColor: box.value });
                      }}
                    >
                      <View
                        style={[
                          styles.boxDot,
                          {
                            backgroundColor:
                              box.value === "transparent" ? "transparent" : box.value,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.boxChipText,
                          isSelected && styles.boxChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {box.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Text Effect 4 Pills in 1 Row */}
              <View style={{ flexDirection: "row", gap: 4 }}>
                {TEXT_EFFECT_OPTIONS.map((eff) => {
                  const isSelected = textEffect === eff.value;
                  return (
                    <TouchableOpacity
                      key={eff.value}
                      style={[
                        styles.chipBtn,
                        { flex: 1, justifyContent: "center" },
                        isSelected && styles.chipBtnActive,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx("click");
                        setTextEffect(eff.value);
                        persistSettings({ textEffect: eff.value });
                      }}
                    >
                      <Ionicons
                        name={eff.icon as any}
                        size={11}
                        color={isSelected ? "#000000" : THEME_COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {eff.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 7. Screen Position (2x2 Grid - ALL VISIBLE) */}
            <View style={[styles.sectionCard, { marginBottom: 16 }]}>
              <Text style={styles.sectionTitle}>SCREEN POSITION</Text>
              <View style={styles.posGrid}>
                {POSITION_PRESETS.map((pos) => {
                  const isSelected = captionPositionY === pos.value;
                  return (
                    <TouchableOpacity
                      key={pos.value}
                      style={[
                        styles.posChip,
                        isSelected && styles.posChipActive,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx("click");
                        setCaptionPositionY(pos.value);
                        persistSettings({ positionY: pos.value });
                      }}
                    >
                      <Ionicons
                        name={pos.icon as any}
                        size={12}
                        color={isSelected ? "#000000" : THEME_COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.posChipText,
                          isSelected && styles.posChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {pos.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Sticky Docked Action Footer */}
          <View style={styles.dockedFooter}>
            {selectedClipId && (
              <TouchableOpacity
                style={styles.dockedSecondaryBtn}
                onPress={handleApplyStyleToSelected}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-done" size={13} color={THEME_COLORS.accent} />
                <Text style={styles.dockedSecondaryBtnText}>Selected Cue</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.dockedPrimaryBtn,
                !selectedClipId && { flex: 1 },
              ]}
              onPress={handleApplyStyleToAll}
              activeOpacity={0.8}
            >
              <Ionicons name="color-wand" size={14} color="#000000" />
              <Text style={styles.dockedPrimaryBtnText}>
                Apply to All ({existingCaptions.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Manual Paste SRT / API Key Dialog */}
      {showPasteSrtBox && (
        <View style={[StyleSheet.absoluteFill, styles.dialogOverlay, { zIndex: 999 }]}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Import Subtitle / Script</Text>

            {Platform.OS !== "web" && (
              <View style={styles.cloudKeyCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="flash-outline" size={13} color={THEME_COLORS.accent} />
                  <Text style={styles.cloudKeyTitle}>CLOUD ACCELERATION</Text>
                </View>
                <TextInput
                  style={styles.keyInput}
                  value={whisperApiKey}
                  onChangeText={setWhisperApiKey}
                  placeholder="Paste optional Groq or OpenAI Whisper key..."
                  placeholderTextColor={THEME_COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <Text style={styles.dialogSubtitle}>
              Paste .SRT, WebVTT, or plain dialogue lines:
            </Text>
            <TextInput
              style={styles.dialogInput}
              multiline
              value={pastedSrtText}
              onChangeText={setPastedSrtText}
              placeholder={`Paste .SRT timestamps or dialogue script lines:\n\nHello welcome to my video\nToday we talk about FastArt`}
              placeholderTextColor={THEME_COLORS.textMuted}
            />
            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setShowPasteSrtBox(false)}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogApplyBtn}
                onPress={handleApplyPastedSrt}
              >
                <Text style={styles.dialogApplyText}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Headless Mobile Whisper Speech Recognizer */}
      {Platform.OS !== "web" && <MobileWhisperTranscriberView />}
    </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: THEME_COLORS.background,
  },
  sheetContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: THEME_COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
    backgroundColor: THEME_COLORS.background,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  headerActionText: {
    color: THEME_COLORS.accent,
    fontSize: 10,
    fontWeight: "600",
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: THEME_COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
    gap: 8,
  },
  segmentedRow: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
    borderRadius: 5,
  },
  segmentBtnActive: {
    backgroundColor: THEME_COLORS.accent,
  },
  segmentText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 10.5,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  quickActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navIconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  navIconText: {
    color: THEME_COLORS.accent,
    fontSize: 10,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 10,
    marginTop: 6,
  },
  errorText: {
    flex: 1,
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "500",
  },
  bodyScroll: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  compactActionCard: {
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    marginBottom: 8,
  },
  generatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 10.5,
    fontWeight: "500",
  },
  pctText: {
    color: THEME_COLORS.accent,
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  progressBarBg: {
    height: 4,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: THEME_COLORS.accent,
    borderRadius: 2,
  },
  actionCardContent: {
    gap: 6,
  },
  transcribeBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME_COLORS.accent,
    paddingVertical: 8,
    borderRadius: 6,
  },
  transcribeBtnText: {
    color: "#000000",
    fontSize: 11.5,
    fontWeight: "800",
  },
  importSrtRowBtn: {
    width: "100%",
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  importSrtRowText: {
    color: THEME_COLORS.accent,
    fontSize: 10.5,
    fontWeight: "600",
  },
  chunkSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.borderSubtle,
    gap: 5,
  },
  rechunkActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.3)",
  },
  rechunkActionText: {
    color: THEME_COLORS.accent,
    fontSize: 9.5,
    fontWeight: "700",
  },
  chunkChipsGroup: {
    flexDirection: "row",
    gap: 4,
    width: "100%",
  },
  chunkChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 2,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  chunkChipActive: {
    borderColor: THEME_COLORS.accent,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  chunkChipText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9.5,
    fontWeight: "600",
  },
  chunkChipTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: "800",
  },
  cuesListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    marginTop: 2,
  },
  sectionHeaderTitle: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cueActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  cueActionText: {
    color: THEME_COLORS.accent,
    fontSize: 9.5,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    marginTop: 4,
  },
  emptyTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  emptySubtitle: {
    color: THEME_COLORS.textMuted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
    lineHeight: 14,
  },
  cuesList: {
    gap: 5,
    paddingBottom: 24,
  },
  cueCard: {
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 7,
    padding: 7,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  cueCardSelected: {
    borderColor: THEME_COLORS.accent,
    backgroundColor: "rgba(0, 242, 254, 0.05)",
  },
  cueMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cueTimeBadge: {
    backgroundColor: THEME_COLORS.background,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cueTimeText: {
    color: THEME_COLORS.accent,
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  cueIconBtn: {
    padding: 2,
  },
  cueInput: {
    color: THEME_COLORS.textPrimary,
    fontSize: 11.5,
    backgroundColor: THEME_COLORS.background,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 5,
    minHeight: 28,
    lineHeight: 15,
  },
  previewBanner: {
    backgroundColor: "#07090E",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    marginBottom: 8,
    minHeight: 32,
  },
  previewBox: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewWordsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
  },
  wordPill: {
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  wordText: {
    fontSize: 16,
    fontWeight: "800",
  },
  sectionCard: {
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    marginBottom: 8,
  },
  sectionTitle: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  resetPresetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  resetPresetText: {
    color: THEME_COLORS.textMuted,
    fontSize: 9,
    fontWeight: "600",
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 6,
  },
  presetGridCard: {
    width: "31.5%",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  presetGridCardActive: {
    borderColor: THEME_COLORS.accent,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  presetBadge: {
    width: 38,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  presetGridName: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9.5,
    fontWeight: "600",
    textAlign: "center",
  },
  presetGridNameActive: {
    color: THEME_COLORS.accent,
    fontWeight: "800",
  },
  microTitle: {
    color: THEME_COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  pillSwitch: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  pillSwitchActive: {
    borderColor: THEME_COLORS.accent,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  pillSwitchText: {
    color: THEME_COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
  },
  pillSwitchTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: "800",
  },
  highlightPillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  highlightChip3Col: {
    width: "31.5%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 5,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  highlightChip2Col: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 5,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  highlightChipActive: {
    backgroundColor: THEME_COLORS.accent,
    borderColor: THEME_COLORS.accent,
  },
  swatchesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingVertical: 4,
  },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  chipBtnActive: {
    backgroundColor: THEME_COLORS.accent,
    borderColor: THEME_COLORS.accent,
  },
  chipText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  swatchCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: THEME_COLORS.borderSubtle,
  },
  swatchCircleSelected: {
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.08 }],
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  stepperAction: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    backgroundColor: THEME_COLORS.surfaceElevated,
  },
  stepperLabel: {
    color: THEME_COLORS.accent,
    fontSize: 10,
    fontWeight: "700",
    minWidth: 32,
    textAlign: "center",
    fontFamily: "monospace",
  },
  fontGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingVertical: 4,
  },
  fontChip: {
    width: "48.5%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  fontChipActive: {
    borderColor: THEME_COLORS.accent,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  fontChipText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  fontChipTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: "800",
  },
  typographyToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  microBtn: {
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  microBtnActive: {
    backgroundColor: THEME_COLORS.accent,
    borderColor: THEME_COLORS.accent,
  },
  microBtnText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9,
    fontWeight: "600",
  },
  microBtnTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  alignPillGroup: {
    flexDirection: "row",
    backgroundColor: THEME_COLORS.background,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    overflow: "hidden",
  },
  alignItem: {
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    alignItems: "center",
    justifyContent: "center",
  },
  alignItemActive: {
    backgroundColor: THEME_COLORS.accent,
  },
  boxGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 8,
  },
  boxChip: {
    width: "31.5%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  boxChipActive: {
    borderColor: THEME_COLORS.accent,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  boxChipText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9.5,
    fontWeight: "600",
  },
  boxChipTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: "800",
  },
  boxDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  posGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  posChip: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  posChipActive: {
    borderColor: THEME_COLORS.accent,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  posChipText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9.5,
    fontWeight: "600",
  },
  posChipTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: "800",
  },
  styleTabRoot: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  styleScrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 20,
  },
  dockedFooter: {
    flexShrink: 0,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: THEME_COLORS.card,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.borderSubtle,
    zIndex: 10,
  },
  dockedPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: THEME_COLORS.accent,
    paddingVertical: 8,
    borderRadius: 6,
  },
  dockedPrimaryBtnText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "800",
  },
  dockedSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: THEME_COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME_COLORS.accent,
  },
  dockedSecondaryBtnText: {
    color: THEME_COLORS.accent,
    fontSize: 10.5,
    fontWeight: "700",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  dialogCard: {
    backgroundColor: THEME_COLORS.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  dialogTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  cloudKeyCard: {
    backgroundColor: "rgba(0,242,254,0.06)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,242,254,0.18)",
    padding: 8,
    marginBottom: 8,
    gap: 4,
  },
  cloudKeyTitle: {
    color: THEME_COLORS.accent,
    fontSize: 10,
    fontWeight: "800",
  },
  keyInput: {
    backgroundColor: THEME_COLORS.background,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontFamily: "monospace",
  },
  dialogSubtitle: {
    color: THEME_COLORS.textSecondary,
    fontSize: 10.5,
    marginBottom: 6,
  },
  dialogInput: {
    backgroundColor: THEME_COLORS.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    padding: 8,
    minHeight: 100,
    textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  dialogButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  dialogCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dialogCancelText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  dialogApplyBtn: {
    backgroundColor: THEME_COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 5,
  },
  dialogApplyText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "800",
  },
});
