import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { FastArtProject, CaptionClip } from "../../types/project";
import { generateAutoCaptions, WHISPER_API_KEY_STORAGE_KEY } from "../../services/aiCaptionEngine";
import MobileWhisperTranscriberView from "./MobileWhisperTranscriberView";
import {
  parseSrtOrVttContent,
  generateWordTimings,
  rechunkCaptionClips,
} from "../../utils/srtParser";
import {
  loadAllProjects,
  loadCaptionSettings,
  saveCaptionSettings,
  CaptionSettings,
  defaultCaptionSettings,
  getStorageItem,
  setStorageItem,
} from "../../utils/storage";

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
  { label: "Classic Color", value: "color", icon: "color-palette-outline" },
  { label: "Pop Badge", value: "box", icon: "tablet-portrait-outline" },
  { label: "Scale Pop", value: "scale", icon: "expand-outline" },
  { label: "Neon Glow", value: "glow", icon: "flashlight-outline" },
  { label: "Accent Bar", value: "underline", icon: "remove-outline" },
];

const HIGHLIGHT_COLOR_SWATCHES = [
  { label: "Viral Yellow", value: "#FFE600" },
  { label: "Neon Cyan", value: "#00F2FE" },
  { label: "Emerald Green", value: "#22C55E" },
  { label: "Hot Pink", value: "#FF007F" },
  { label: "Electric Orange", value: "#FF6600" },
  { label: "Cyber Violet", value: "#A855F7" },
  { label: "Gold", value: "#EAB308" },
  { label: "Fire Red", value: "#EF4444" },
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
  { label: "Lavender", value: "#C084FC" },
  { label: "Pure Black", value: "#000000" },
];

const STROKE_COLOR_SWATCHES = [
  { label: "Pure Black", value: "#000000" },
  { label: "Crisp White", value: "#FFFFFF" },
  { label: "Slate Gray", value: "#64748B" },
  { label: "Neon Cyan", value: "#00F2FE" },
  { label: "Viral Yellow", value: "#FFE600" },
  { label: "Deep Crimson", value: "#DC2626" },
  { label: "Deep Purple", value: "#7E22CE" },
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
  { label: "Translucent White", value: "rgba(255, 255, 255, 0.2)" },
  { label: "Accent Yellow", value: "rgba(255, 230, 0, 0.25)" },
  { label: "Accent Cyan", value: "rgba(0, 242, 254, 0.25)" },
];

const FONT_FAMILY_OPTIONS = [
  { label: "Impact", value: "Impact, Arial Black, sans-serif" },
  {
    label: "Modern Sans",
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  { label: "Montserrat", value: "'Montserrat', 'Arial Black', sans-serif" },
  { label: "Bebas", value: "'Bebas Neue', 'Oswald', sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Typewriter", value: "'Courier New', Courier, monospace" },
];

const FONT_WEIGHT_OPTIONS = [
  { label: "Heavy (900)", value: "900" },
  { label: "Extra Bold (800)", value: "800" },
  { label: "Bold (700)", value: "700" },
  { label: "SemiBold (600)", value: "600" },
];

const TEXT_EFFECT_OPTIONS = [
  { label: "None", value: "none", icon: "ban-outline" },
  { label: "3D Shadow", value: "3d", icon: "layers-outline" },
  { label: "Neon Glow", value: "neon", icon: "flashlight-outline" },
  { label: "Soft Shadow", value: "shadow", icon: "cloudy-night-outline" },
];

const ANIMATION_OPTIONS = [
  { label: "Karaoke", value: "karaoke", icon: "mic-outline" },
  { label: "Bounce", value: "bounce", icon: "trending-up-outline" },
  { label: "Zoom Punch", value: "zoomIn", icon: "scan-outline" },
  { label: "Smooth Fade", value: "fade", icon: "eye-outline" },
  { label: "Static", value: "none", icon: "pause-outline" },
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
  { label: "Punchy (2-3 words)", value: "punchy", maxWords: 3 },
  { label: "Balanced (4-5 words)", value: "balanced", maxWords: 5 },
  { label: "Sentence (6+ words)", value: "sentence", maxWords: 8 },
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
      if (targetClip.enableWordHighlight !== undefined)
        setEnableHighlight(targetClip.enableWordHighlight);
      if (targetClip.highlightColor)
        setHighlightColor(targetClip.highlightColor);
      if (targetClip.highlightStyle)
        setHighlightStyle(targetClip.highlightStyle);
      else if (targetClip.style?.highlightStyle)
        setHighlightStyle(targetClip.style.highlightStyle);
      if (targetClip.style?.fontSize) setFontSize(targetClip.style.fontSize);
      if (targetClip.style?.fontFamily)
        setFontFamily(targetClip.style.fontFamily);
      if (targetClip.style?.fontWeight)
        setFontWeight(targetClip.style.fontWeight);
      if (targetClip.style?.color) setTextColor(targetClip.style.color);
      if (targetClip.style?.strokeColor)
        setStrokeColor(targetClip.style.strokeColor);
      if (targetClip.style?.strokeWidth !== undefined)
        setStrokeWidth(targetClip.style.strokeWidth);
      if (targetClip.style?.backgroundColor)
        setBackgroundColor(targetClip.style.backgroundColor);
      if (targetClip.style?.textEffect)
        setTextEffect(targetClip.style.textEffect);
      if (targetClip.animation) setAnimation(targetClip.animation);
      if (targetClip.position?.y !== undefined)
        setCaptionPositionY(targetClip.position.y);
      if (targetClip.style?.textAlign)
        setTextAlign(targetClip.style.textAlign as any);
      if (targetClip.uppercase !== undefined)
        setUppercase(targetClip.uppercase);
      else if (targetClip.style?.uppercase !== undefined)
        setUppercase(targetClip.style.uppercase);
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
      setChunkMode(saved.chunkMode || "punchy");
      setMaxWordsPerCue(saved.maxWordsPerCue || 3);
    }
  }, [visible, selectedClipId]);

  // Persist current settings to the project (not global)
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
      ...overrides,
    };

    if (onUpdateProject) {
      onUpdateProject({ captionSettings: updatedSettings });
    }
  };

  const getActiveStyleOverrides = (): Partial<CaptionClip> & {
    maxWordsPerCue?: number;
  } => ({
    presetId: selectedPresetId,
    position: { x: 50, y: captionPositionY },
    enableWordHighlight: enableHighlight,
    highlightColor,
    highlightStyle,
    animation: enableHighlight ? "karaoke" : animation,
    uppercase,
    maxWordsPerCue,
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

    // If not standard SRT/VTT format, treat as dialogue sentences and align to audio cadence
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

  // =================== APPLY STYLING ===================
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
      `Re-chunked ${existingCaptions.length} captions into ${rechunked.length} short punchy phrases!`,
    );
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

  const handleCancel = () => {
    soundEngine.playSfx("pop");
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx("whoosh");
    if (selectedClipId) {
      handleApplyStyleToSelected();
    } else {
      handleApplyStyleToAll();
    }
    if (onApply) {
      onApply();
    }
  };

  // =================== AI TRANSCRIPTION (ENGLISH ONLY) ===================
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
          "Could not detect clear spoken English in this video's audio.",
        );
      }

      soundEngine.playSfx("pop");
      onAddCaptions(generated);
      setStatusText(
        `Generated ${generated.length} English subtitle cues! Tap any cue below to edit dialogue.`,
      );
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
    <View style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Standardized Header: Cancel (Left) | Title (Center) | Apply (Right) */}
      <View style={styles.sheetHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TouchableOpacity
                onPress={handleCancel}
                style={[
                  styles.doneBtn,
                  {
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    borderWidth: 1,
                    borderColor: "rgba(239, 68, 68, 0.3)",
                  },
                ]}
                activeOpacity={0.7}
                accessibilityLabel="Cancel changes"
              >
                <Ionicons name="close" size={17} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResetToDefaults}
                style={styles.resetBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.titleRow}>
              <View style={styles.titleIconBadge}>
                <Ionicons name="chatbox-ellipses" size={13} color="#000000" />
              </View>
              <Text style={styles.sheetTitle}>Captions</Text>
            </View>

            <TouchableOpacity
              onPress={handleApply}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Apply captions"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Top Category Tabs & SRT Actions */}
          <View style={styles.topControlRow}>
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "captions" && styles.tabButtonActive,
                ]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setActiveTab("captions");
                }}
              >
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={13}
                  color={activeTab === "captions" ? "#00F2FE" : "#8E95A5"}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "captions" && styles.tabButtonTextActive,
                  ]}
                >
                  Captions ({existingCaptions.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "style" && styles.tabButtonActive,
                ]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setActiveTab("style");
                }}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={13}
                  color={activeTab === "style" ? "#00F2FE" : "#8E95A5"}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "style" && styles.tabButtonTextActive,
                  ]}
                >
                  Style & Highlight
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.srtActionGroup}>
              <TouchableOpacity
                style={styles.srtBtn}
                onPress={handleImportSrtFile}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={13}
                  color="#00F2FE"
                />
                <Text style={styles.srtBtnText}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity
                onPress={() => setErrorMessage(null)}
                style={styles.errorDismissBtn}
              >
                <Ionicons name="close" size={14} color="#FCA5A5" />
              </TouchableOpacity>
            </View>
          )}

          {/* ================= TAB 1: CAPTIONS (AUTO TRANSCRIBE + LIVE CUES TRACK) ================= */}
          {activeTab === "captions" && (
            <ScrollView
              style={styles.bodyScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Top Auto Transcribe & Audio Tools Box */}
              <View style={styles.generateCardBox}>
                {isGenerating ? (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${progressPct}%` },
                        ]}
                      />
                    </View>
                    <View style={styles.progressStatusRow}>
                      <ActivityIndicator size="small" color="#00F2FE" />
                      <Text style={styles.statusText}>{statusText}</Text>
                      <Text style={styles.pctText}>{progressPct}%</Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.primaryTranscribeBtn}
                      onPress={handleGenerate}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="sparkles" size={16} color="#000000" />
                      <Text style={styles.primaryTranscribeBtnText}>
                        Auto Transcribe to English
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.englishNoticeRow}>
                      <View style={styles.englishBadge}>
                        <Text style={styles.englishBadgeText}>
                          ENGLISH ONLY
                        </Text>
                      </View>
                      <Text style={styles.englishNoticeText}>
                        Speech is automatically transcribed & translated to
                        English subtitles
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Caption Section Length / Chunking Box */}
              <View style={styles.chunkSectionBox}>
                <View style={styles.chunkSectionHeader}>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name="options-outline"
                      size={13}
                      color="#00F2FE"
                    />
                    <Text style={styles.chunkSectionTitle}>
                      PHRASE LENGTH PER FRAME
                    </Text>
                  </View>
                  {existingCaptions.length > 0 && (
                    <TouchableOpacity
                      style={styles.rechunkBtn}
                      onPress={handleRechunkTimelineCaptions}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cut-outline" size={12} color="#00F2FE" />
                      <Text style={styles.rechunkBtnText}>
                        Re-chunk Phrases
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.chunkModeRow}>
                  {CHUNK_MODE_OPTIONS.map((opt) => {
                    const isSelected = chunkMode === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.chunkModePill,
                          isSelected && styles.chunkModePillActive,
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
                            styles.chunkModePillText,
                            isSelected && styles.chunkModePillTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Captions Cues Track Header */}
              <View style={styles.cuesHeaderRow}>
                <Text style={styles.cuesSectionTitle}>
                  CAPTIONS TRACK ({existingCaptions.length} CUES)
                </Text>
                {existingCaptions.length > 0 && (
                  <TouchableOpacity
                    style={[styles.cueActionBtn, { borderColor: "#EF4444" }]}
                    onPress={handleClearAllCaptions}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={12} color="#EF4444" />
                    <Text style={[styles.cueActionText, { color: "#EF4444" }]}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {existingCaptions.length === 0 ? (
                <View style={styles.emptyCuesContainer}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={38}
                    color="#2D3748"
                  />
                  <Text style={styles.emptyCuesTitle}>
                    No captions on this timeline
                  </Text>
                  <Text style={styles.emptyCuesSubtitle}>
                    Tap "Auto Transcribe to English" above to generate
                    synchronized captions, or use Import SRT at the top.
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
                          <View style={styles.cueTimePill}>
                            <Text style={styles.cueTimeText}>
                              #{idx + 1} • {startStr}s ➔ {endStr}s (
                              {cap.duration.toFixed(1)}s)
                            </Text>
                          </View>

                          <View style={styles.cueButtonsRow}>
                            {onSeek && (
                              <TouchableOpacity
                                style={styles.cueMiniBtn}
                                onPress={() => {
                                  soundEngine.playSfx("click");
                                  onSeek(cap.startTime);
                                }}
                              >
                                <Ionicons
                                  name="play-circle-outline"
                                  size={15}
                                  color="#00F2FE"
                                />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.cueMiniBtn}
                              onPress={() => handleDeleteCue(cap.id)}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={14}
                                color="#EF4444"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <TextInput
                          style={styles.cueTextInput}
                          value={cap.text}
                          onChangeText={(txt) =>
                            handleUpdateCueText(cap.id, txt)
                          }
                          multiline
                          placeholder="Subtitle text..."
                          placeholderTextColor="#64748B"
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {/* ================= TAB 2: STYLE & LIVE WORD HIGHLIGHT ================= */}
          {activeTab === "style" && (
            <View style={{ flex: 1 }}>
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={{ paddingBottom: 90 }}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. HERO CARD: LIVE SPEAKING WORD HIGHLIGHT & PREVIEW */}
                <View style={styles.cardSection}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderTitleGroup}>
                      <Ionicons name="sparkles" size={14} color="#FFE600" />
                      <Text style={styles.cardHeaderTitle}>
                        KARAOKE WORD HIGHLIGHT
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        soundEngine.playSfx("click");
                        setHighlightColor("#FFE600");
                        setHighlightStyle("color");
                        persistSettings({
                          highlightColor: "#FFE600",
                          highlightStyle: "color",
                        });
                      }}
                      style={styles.resetLinkBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="refresh-outline"
                        size={12}
                        color="#8E95A5"
                      />
                      <Text style={styles.resetLinkText}>Reset</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Highlight Styles & Swatches - Directly configurable */}
                  <View style={{ marginTop: 10, gap: 10 }}>
                      <View style={styles.highlightStyleRow}>
                        {HIGHLIGHT_STYLE_OPTIONS.map((opt) => {
                          const isSelected = highlightStyle === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              style={[
                                styles.highlightStylePill,
                                isSelected && styles.highlightStylePillActive,
                              ]}
                              onPress={() => {
                                soundEngine.playSfx("click");
                                setHighlightStyle(opt.value);
                                persistSettings({ highlightStyle: opt.value });
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={opt.icon as any}
                                size={13}
                                color={isSelected ? "#000000" : "#8E95A5"}
                              />
                              <Text
                                style={[
                                  styles.highlightStylePillText,
                                  isSelected &&
                                    styles.highlightStylePillTextActive,
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8 }}
                      >
                        {HIGHLIGHT_COLOR_SWATCHES.map((swatch) => {
                          const isSelected = highlightColor === swatch.value;
                          return (
                            <TouchableOpacity
                              key={swatch.value}
                              style={[
                                styles.colorCircle,
                                { backgroundColor: swatch.value },
                                isSelected && styles.colorCircleSelected,
                              ]}
                              onPress={() => {
                                soundEngine.playSfx("click");
                                setHighlightColor(swatch.value);
                                persistSettings({
                                  highlightColor: swatch.value,
                                });
                              }}
                            >
                              {isSelected && (
                                <Ionicons
                                  name="checkmark"
                                  size={13}
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
                      </ScrollView>
                    </View>

                  {/* Live Preview Display Box */}
                  <View style={styles.livePreviewBox}>
                    <Text style={styles.livePreviewHeader}>
                      LIVE PLAYBACK PREVIEW
                    </Text>
                    <View
                      style={[
                        styles.karaokeWordsContainer,
                        backgroundColor &&
                          backgroundColor !== "transparent" && {
                            backgroundColor,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 12,
                          },
                      ]}
                    >
                      <View
                        style={[
                          styles.karaokeWordsRow,
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
                          const isBox =
                            isActiveWord && highlightStyle === "box";
                          const isGlow =
                            isActiveWord && highlightStyle === "glow";
                          const isScale =
                            isActiveWord && highlightStyle === "scale";
                          const isUnderline =
                            isActiveWord && highlightStyle === "underline";

                          let wordColor = textColor;
                          if (isActiveWord) {
                            if (isBox) {
                              wordColor =
                                highlightColor === "#000000"
                                  ? "#FFFFFF"
                                  : "#000000";
                            } else {
                              wordColor = highlightColor;
                            }
                          }

                          return (
                            <View
                              key={wIdx}
                              style={[
                                styles.karaokeWordPill,
                                isBox && {
                                  backgroundColor: highlightColor,
                                  borderRadius: 6,
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                },
                                isScale && { transform: [{ scale: 1.18 }] },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.karaokeWordText,
                                  {
                                    color: wordColor,
                                    fontFamily,
                                    fontSize: Math.min(24, fontSize),
                                    fontWeight: fontWeight as any,
                                    textShadowColor: isGlow
                                      ? highlightColor
                                      : textEffect === "neon"
                                        ? wordColor
                                        : textEffect === "3d" ||
                                            textEffect === "shadow"
                                          ? strokeColor !== "transparent"
                                            ? strokeColor
                                            : "#000000"
                                          : "transparent",
                                    textShadowRadius: isGlow
                                      ? 18
                                      : textEffect === "neon"
                                        ? 16
                                        : textEffect === "shadow"
                                          ? 6
                                          : textEffect === "3d"
                                            ? 3
                                            : 0,
                                    textShadowOffset:
                                      textEffect === "3d" && !isGlow
                                        ? { width: 2, height: 2 }
                                        : { width: 0, height: 0 },
                                  },
                                ]}
                              >
                                {displayedWord}
                              </Text>
                              {isUnderline && (
                                <View
                                  style={{
                                    height: 3,
                                    backgroundColor: highlightColor,
                                    borderRadius: 2,
                                    marginTop: 2,
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
                </View>

                {/* 2. TYPOGRAPHY STUDIO */}
                <View style={styles.cardSection}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderTitleGroup}>
                      <Ionicons name="text-outline" size={14} color="#00F2FE" />
                      <Text style={styles.cardHeaderTitle}>TYPOGRAPHY</Text>
                    </View>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          const next = Math.max(10, fontSize - 2);
                          setFontSize(next);
                          persistSettings({ fontSize: next });
                        }}
                      >
                        <Ionicons name="remove" size={13} color="#CBD5E1" />
                      </TouchableOpacity>
                      <Text style={styles.stepperValueText}>{fontSize}px</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          const next = Math.min(52, fontSize + 2);
                          setFontSize(next);
                          persistSettings({ fontSize: next });
                        }}
                      >
                        <Ionicons name="add" size={13} color="#CBD5E1" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Font Family Pills */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, marginVertical: 6 }}
                  >
                    {FONT_FAMILY_OPTIONS.map((font) => {
                      const isSelected = fontFamily === font.value;
                      return (
                        <TouchableOpacity
                          key={font.value}
                          style={[
                            styles.fontFamilyPill,
                            isSelected && styles.fontFamilyPillActive,
                          ]}
                          onPress={() => {
                            soundEngine.playSfx("click");
                            setFontFamily(font.value);
                            persistSettings({ fontFamily: font.value });
                          }}
                        >
                          <Text
                            style={[
                              styles.fontFamilyPillText,
                              { fontFamily: font.value },
                              isSelected && styles.fontFamilyPillTextActive,
                            ]}
                          >
                            {font.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Weights + Formatting + Align Bar */}
                  <View style={styles.compactControlsRow}>
                    <View style={styles.weightPillsGroup}>
                      {FONT_WEIGHT_OPTIONS.map((fw) => {
                        const isSelected = fontWeight === fw.value;
                        const shortLabel =
                          fw.value === "900"
                            ? "Heavy"
                            : fw.value === "800"
                              ? "Extra"
                              : fw.value === "700"
                                ? "Bold"
                                : "Semi";
                        return (
                          <TouchableOpacity
                            key={fw.value}
                            style={[
                              styles.miniWeightPill,
                              isSelected && styles.miniWeightPillActive,
                            ]}
                            onPress={() => {
                              soundEngine.playSfx("click");
                              setFontWeight(fw.value);
                              persistSettings({ fontWeight: fw.value });
                            }}
                          >
                            <Text
                              style={[
                                styles.miniWeightPillText,
                                isSelected && styles.miniWeightPillTextActive,
                              ]}
                            >
                              {shortLabel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* All Caps Toggle */}
                    <TouchableOpacity
                      style={[
                        styles.miniFormatPill,
                        uppercase && styles.miniFormatPillActive,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx("click");
                        const next = !uppercase;
                        setUppercase(next);
                        persistSettings({ uppercase: next });
                      }}
                    >
                      <Ionicons
                        name="text"
                        size={12}
                        color={uppercase ? "#000000" : "#8E95A5"}
                      />
                      <Text
                        style={[
                          styles.miniFormatPillText,
                          uppercase && styles.miniFormatPillTextActive,
                        ]}
                      >
                        CAPS
                      </Text>
                    </TouchableOpacity>

                    {/* Alignment */}
                    <View style={styles.alignGroup}>
                      {ALIGNMENT_OPTIONS.map((al) => {
                        const isSelected = textAlign === al.value;
                        return (
                          <TouchableOpacity
                            key={al.value}
                            style={[
                              styles.alignBtn,
                              isSelected && styles.alignBtnActive,
                            ]}
                            onPress={() => {
                              soundEngine.playSfx("click");
                              setTextAlign(al.value as any);
                              persistSettings({ textAlign: al.value as any });
                            }}
                          >
                            <Ionicons
                              name={al.icon as any}
                              size={14}
                              color={isSelected ? "#000000" : "#8E95A5"}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* 3. COLOR & OUTLINE STUDIO */}
                <View style={styles.cardSection}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderTitleGroup}>
                      <Ionicons
                        name="color-palette-outline"
                        size={14}
                        color="#00F2FE"
                      />
                      <Text style={styles.cardHeaderTitle}>
                        COLOR & OUTLINE
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.subSectionTitle}>TEXT COLOR</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, marginBottom: 10 }}
                  >
                    {TEXT_COLOR_SWATCHES.map((swatch) => {
                      const isSelected = textColor === swatch.value;
                      return (
                        <TouchableOpacity
                          key={swatch.value}
                          style={[
                            styles.colorCircle,
                            { backgroundColor: swatch.value },
                            isSelected && styles.colorCircleSelected,
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
                              size={13}
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
                  </ScrollView>

                  <Text style={styles.subSectionTitle}>
                    OUTLINE WIDTH & COLOR
                  </Text>
                  <View style={styles.pillsRow}>
                    {STROKE_WIDTH_OPTIONS.map((sw) => {
                      const isSelected = strokeWidth === sw.value;
                      return (
                        <TouchableOpacity
                          key={sw.value}
                          style={[
                            styles.strokeWidthPill,
                            isSelected && styles.strokeWidthPillActive,
                          ]}
                          onPress={() => {
                            soundEngine.playSfx("click");
                            setStrokeWidth(sw.value);
                            persistSettings({ strokeWidth: sw.value });
                          }}
                        >
                          <Text
                            style={[
                              styles.strokeWidthPillText,
                              isSelected && styles.strokeWidthPillTextActive,
                            ]}
                          >
                            {sw.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {strokeWidth > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, marginTop: 8 }}
                    >
                      {STROKE_COLOR_SWATCHES.map((swatch) => {
                        const isSelected = strokeColor === swatch.value;
                        return (
                          <TouchableOpacity
                            key={swatch.value}
                            style={[
                              styles.colorCircle,
                              {
                                backgroundColor:
                                  swatch.value === "transparent"
                                    ? "#1E2638"
                                    : swatch.value,
                              },
                              isSelected && styles.colorCircleSelected,
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
                                size={13}
                                color={
                                  swatch.value === "#FFFFFF"
                                    ? "#000000"
                                    : "#FFFFFF"
                                }
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                {/* 4. BACKDROP & EFFECTS */}
                <View style={styles.cardSection}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderTitleGroup}>
                      <Ionicons
                        name="layers-outline"
                        size={14}
                        color="#00F2FE"
                      />
                      <Text style={styles.cardHeaderTitle}>
                        BACKDROP & VISUAL EFFECTS
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.subSectionTitle}>BACKGROUND BOX</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, marginBottom: 10 }}
                  >
                    {BG_BOX_PRESETS.map((box) => {
                      const isSelected = backgroundColor === box.value;
                      return (
                        <TouchableOpacity
                          key={box.value}
                          style={[
                            styles.bgBoxPill,
                            isSelected && styles.bgBoxPillActive,
                          ]}
                          onPress={() => {
                            soundEngine.playSfx("click");
                            setBackgroundColor(box.value);
                            persistSettings({ backgroundColor: box.value });
                          }}
                        >
                          <View
                            style={[
                              styles.bgBoxIndicator,
                              {
                                backgroundColor:
                                  box.value === "transparent"
                                    ? "transparent"
                                    : box.value,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.bgBoxPillText,
                              isSelected && styles.bgBoxPillTextActive,
                            ]}
                          >
                            {box.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.subSectionTitle}>TEXT EFFECT</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingRight: 8 }}
                  >
                    {TEXT_EFFECT_OPTIONS.map((eff) => {
                      const isSelected = textEffect === eff.value;
                      return (
                        <TouchableOpacity
                          key={eff.value}
                          style={[
                            styles.effectPill,
                            isSelected && styles.effectPillActive,
                          ]}
                          onPress={() => {
                            soundEngine.playSfx("click");
                            setTextEffect(eff.value);
                            persistSettings({ textEffect: eff.value });
                          }}
                        >
                          <Ionicons
                            name={eff.icon as any}
                            size={13}
                            color={isSelected ? "#000000" : "#8E95A5"}
                          />
                          <Text
                            style={[
                              styles.effectPillText,
                              isSelected && styles.effectPillTextActive,
                            ]}
                          >
                            {eff.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </ScrollView>

              {/* STICKY BOTTOM ACTION BAR FOR TAB 2 */}
              <View style={styles.stickyFooterBar}>
                {selectedClipId && (
                  <TouchableOpacity
                    style={styles.footerSecondaryBtn}
                    onPress={handleApplyStyleToSelected}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-done" size={15} color="#00F2FE" />
                    <Text style={styles.footerSecondaryBtnText}>
                      Selected Cue
                    </Text>
                  </TouchableOpacity>
                )}

                {existingCaptions.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.footerPrimaryBtn,
                      !selectedClipId && { flex: 1 },
                    ]}
                    onPress={handleApplyStyleToAll}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="color-wand" size={15} color="#000000" />
                    <Text style={styles.footerPrimaryBtnText}>
                      Apply to All ({existingCaptions.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Manual Paste SRT / API Key Dialog */}
          {showPasteSrtBox && (
            <Modal transparent animationType="fade">
              <View style={styles.dialogOverlay}>
                <View style={styles.dialogCard}>
                  <Text style={styles.dialogTitle}>Import Subtitle / Script</Text>

                  {/* Mobile-only: API key section for cloud Whisper */}
                  {Platform.OS !== "web" && (
                    <View
                      style={{
                        backgroundColor: "rgba(0,242,254,0.07)",
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "rgba(0,242,254,0.18)",
                        padding: 12,
                        marginBottom: 12,
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <Ionicons name="flash-outline" size={15} color="#00F2FE" />
                        <Text style={{ color: "#00F2FE", fontSize: 13, fontWeight: "800" }}>
                          CLOUD ACCELERATION (OPTIONAL)
                        </Text>
                      </View>
                      <Text style={{ color: "#94A3B8", fontSize: 11, lineHeight: 16 }}>
                        FastArt generates captions on mobile for free with zero API keys and zero mic permissions. If you prefer ultra-fast cloud processing (1s), you can optionally paste a Groq or OpenAI key below:
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: "#0F1929",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: whisperApiKey
                            ? "rgba(0,242,254,0.4)"
                            : "rgba(255,255,255,0.08)",
                          color: "#E2E8F0",
                          fontSize: 12,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          fontFamily: "monospace",
                        }}
                        value={whisperApiKey}
                        onChangeText={setWhisperApiKey}
                        placeholder="gsk_... or sk-... or groq:gsk_..."
                        placeholderTextColor="#475569"
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={false}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          const trimmed = whisperApiKey.trim();
                          setStorageItem(WHISPER_API_KEY_STORAGE_KEY, trimmed);
                          if (trimmed) {
                            setShowPasteSrtBox(false);
                            setTimeout(() => {
                              handleGenerate();
                            }, 150);
                          }
                        }}
                        style={{
                          alignSelf: "flex-start",
                          backgroundColor: whisperApiKey.trim()
                            ? "rgba(0,242,254,0.15)"
                            : "rgba(255,255,255,0.05)",
                          borderRadius: 7,
                          borderWidth: 1,
                          borderColor: whisperApiKey.trim()
                            ? "rgba(0,242,254,0.35)"
                            : "rgba(255,255,255,0.08)",
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name="sparkles"
                          size={14}
                          color={whisperApiKey.trim() ? "#00F2FE" : "#475569"}
                        />
                        <Text
                          style={{
                            color: whisperApiKey.trim() ? "#00F2FE" : "#475569",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          Save Key & Transcribe With Whisper AI
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.dialogSubtitle}>
                    {Platform.OS !== "web"
                      ? "— OR — Paste dialogue script / .SRT below:"
                      : "Paste .SRT, WebVTT, or plain dialogue sentences:"}
                  </Text>
                  <TextInput
                    style={styles.dialogInput}
                    multiline
                    value={pastedSrtText}
                    onChangeText={setPastedSrtText}
                    placeholder={`Paste .SRT timestamps or dialogue script lines:\n\nHello welcome to my video\nToday we talk about FastArt`}
                    placeholderTextColor="#64748B"
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
            </Modal>
          )}

          {/* Headless Mobile Whisper Speech Recognizer (Browser Parity) */}
          {Platform.OS !== "web" && (
            <MobileWhisperTranscriberView />
          )}
        </View>
  );

  if (isInline) {
    if (!visible) return null;
    return <View style={styles.inlineWrapper}>{sheetContent}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        {sheetContent}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#0F131D",
  },
  inlineSheetContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    maxHeight: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0F131D",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Platform.OS === "web" ? "78%" : "85%",
    minHeight: "60%",
    borderTopWidth: 1,
    borderColor: "#1E2638",
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? 18 : 6,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2234",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#141A28",
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  resetText: {
    color: "#8E95A5",
    fontSize: 11.5,
    fontWeight: "700",
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  topControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginTop: 6,
    gap: 8,
  },
  srtActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  srtBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#141A28",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  srtBtnText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2234",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#141A28",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  headerActionText: {
    color: "#00F2FE",
    fontSize: 10.5,
    fontWeight: "700",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E2638",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#080B12",
    padding: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A2234",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "#1E2638",
  },
  tabButtonText: {
    color: "#8E95A5",
    fontSize: 11.5,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: "#00F2FE",
    fontWeight: "800",
  },
  bodyScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  cuesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cuesSectionTitle: {
    color: "#8E95A5",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cueActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "#141A28",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  cueActionText: {
    color: "#00F2FE",
    fontSize: 10.5,
    fontWeight: "700",
  },
  emptyCuesContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#141A28",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginVertical: 8,
  },
  emptyCuesTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  emptyCuesSubtitle: {
    color: "#8E95A5",
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  emptyCuesButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  emptyPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#00F2FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  emptyPrimaryBtnText: {
    color: "#000000",
    fontSize: 11.5,
    fontWeight: "800",
  },
  emptySecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1E2638",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  emptySecondaryBtnText: {
    color: "#00F2FE",
    fontSize: 11.5,
    fontWeight: "700",
  },
  cuesList: {
    gap: 6,
    paddingBottom: 20,
  },
  cueCard: {
    backgroundColor: "#141926",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  cueCardSelected: {
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.06)",
  },
  cueMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cueTimePill: {
    backgroundColor: "#0A0D14",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cueTimeText: {
    color: "#00F2FE",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cueButtonsRow: {
    flexDirection: "row",
    gap: 6,
  },
  cueMiniBtn: {
    padding: 3,
  },
  cueTextInput: {
    color: "#FFFFFF",
    fontSize: 12.5,
    backgroundColor: "#0A0D14",
    padding: 6,
    borderRadius: 6,
    minHeight: 32,
    lineHeight: 16,
  },
  cardSection: {
    backgroundColor: "#141926",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardHeaderTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardHeaderTitle: {
    color: "#CBD5E1",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  highlightSection: {
    backgroundColor: "#141926",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 10,
  },
  highlightHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  highlightTitle: {
    color: "#FFE600",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  highlightSubtitle: {
    color: "#8E95A5",
    fontSize: 10.5,
    marginTop: 1,
  },
  toggleSwitch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#20283A",
    padding: 2,
    justifyContent: "center",
  },
  toggleSwitchActive: {
    backgroundColor: "#FFE600",
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#8E95A5",
  },
  toggleKnobActive: {
    backgroundColor: "#000000",
    alignSelf: "flex-end",
  },
  subSectionTitle: {
    color: "#8E95A5",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  highlightStyleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  highlightStylePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#141A28",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  highlightStylePillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  highlightStylePillText: {
    color: "#8E95A5",
    fontSize: 10.5,
    fontWeight: "700",
  },
  highlightStylePillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  livePreviewBox: {
    backgroundColor: "#07080C",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  livePreviewHeader: {
    color: "#64748B",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  karaokeWordsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  karaokeWordPill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  karaokeWordText: {
    fontSize: 18,
    fontWeight: "900",
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#8E95A5",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  positionButtonsRow: {
    flexDirection: "row",
    gap: 6,
  },
  posBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    backgroundColor: "#141A28",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  posBtnActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  posBtnText: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "700",
  },
  posBtnTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  fontSizesRow: {
    flexDirection: "row",
    gap: 6,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: "#141A28",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  sizeBtnActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  sizeBtnText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  sizeBtnTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  applyAllBtn: {
    flexDirection: "row",
    backgroundColor: "#00F2FE",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  applyAllBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
  },
  applySelectedBtn: {
    flexDirection: "row",
    backgroundColor: "#141A28",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  applySelectedBtnText: {
    color: "#00F2FE",
    fontSize: 13,
    fontWeight: "800",
  },
  compactControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  weightPillsGroup: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  miniWeightPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    backgroundColor: "#161D2E",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#232D42",
  },
  miniWeightPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  miniWeightPillText: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "700",
  },
  miniWeightPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  miniFormatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: "#161D2E",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#232D42",
  },
  miniFormatPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  miniFormatPillText: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "700",
  },
  miniFormatPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  stickyFooterBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(15, 19, 29, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "#1E273C",
  },
  footerPrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00F2FE",
    paddingVertical: 11,
    borderRadius: 10,
  },
  footerPrimaryBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "900",
  },
  footerSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#161D2E",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  footerSecondaryBtnText: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "800",
  },
  chunkSectionBox: {
    backgroundColor: "#111624",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 16,
    gap: 10,
  },
  chunkSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  chunkSectionTitle: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  chunkSectionDesc: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  rechunkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
  },
  rechunkBtnText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  chunkModeRow: {
    flexDirection: "row",
    gap: 8,
  },
  chunkModePill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141A28",
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
  },
  chunkModePillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  chunkModePillText: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  chunkModePillTextActive: {
    color: "#000000",
    fontWeight: "900",
  },
  karaokeWordsContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resetLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: "#161D2C",
  },
  resetLinkText: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "700",
  },
  formatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  formatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#141A28",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
  },
  formatPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  formatPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  formatPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  alignGroup: {
    flexDirection: "row",
    backgroundColor: "#141A28",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
    overflow: "hidden",
  },
  alignBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  alignBtnActive: {
    backgroundColor: "#00F2FE",
  },
  fontFamilyPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#141A28",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
    marginRight: 8,
  },
  fontFamilyPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  fontFamilyPillText: {
    color: "#8E95A5",
    fontSize: 13,
    fontWeight: "700",
  },
  fontFamilyPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#141A28",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: "#1A2234",
  },
  stepperValueText: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "800",
    minWidth: 38,
    textAlign: "center",
  },
  pillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  weightPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#141A28",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
  },
  weightPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  weightPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  weightPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  strokeWidthPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#141A28",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
  },
  strokeWidthPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  strokeWidthPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  strokeWidthPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  bgBoxPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#141A28",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
    marginRight: 8,
  },
  bgBoxPillActive: {
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
  bgBoxIndicator: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  bgBoxPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  bgBoxPillTextActive: {
    color: "#00F2FE",
    fontWeight: "800",
  },
  effectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#141A28",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
    marginRight: 8,
  },
  effectPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  effectPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  effectPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  animPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#141A28",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
    marginRight: 8,
  },
  animPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  animPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  animPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  horizontalRow: {
    flexDirection: "row",
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#141A28",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#22293A",
    marginRight: 8,
  },
  langPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  langPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  langPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "#20283A",
  },
  colorCircleSelected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  micBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#141A28",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  micBtnActive: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  micBtnText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  generateCardBox: {
    backgroundColor: "#111624",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 16,
    gap: 10,
  },
  primaryTranscribeBtn: {
    flexDirection: "row",
    backgroundColor: "#00F2FE",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryTranscribeBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
  },
  englishNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
  },
  englishBadge: {
    backgroundColor: "#00F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  englishBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  englishNoticeText: {
    flex: 1,
    color: "#CBD5E1",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  generateBtn: {
    flexDirection: "row",
    backgroundColor: "#00F2FE",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "900",
  },
  progressContainer: {
    gap: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#1E2333",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 3,
  },
  progressStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    flex: 1,
    color: "#8E95A5",
    fontSize: 12,
  },
  pctText: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "800",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    color: "#FCA5A5",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  errorDismissBtn: {
    padding: 4,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogCard: {
    backgroundColor: "#141A28",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#20283A",
  },
  dialogTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  dialogSubtitle: {
    color: "#8E95A5",
    fontSize: 12,
    marginBottom: 10,
  },
  dialogInput: {
    backgroundColor: "#0B0E17",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#20283A",
    color: "#FFFFFF",
    fontSize: 12,
    padding: 10,
    minHeight: 130,
    textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  dialogButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  dialogCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dialogCancelText: {
    color: "#8E95A5",
    fontSize: 13,
    fontWeight: "600",
  },
  dialogApplyBtn: {
    backgroundColor: "#00F2FE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dialogApplyText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
});
