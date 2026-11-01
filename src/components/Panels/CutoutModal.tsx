import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CutoutConfig } from "../../types/project";
import { soundEngine } from "../../utils/audioEngine";
import { CompactSliderInput } from "../Common/CompactSliderInput";
import { CustomColorPickerButton } from "../Common/CustomColorPickerButton";
import {
  processVideoFrameByFrame,
  renderCutoutToVideoBlob,
  hasClipMasks,
  hasFrameMask,
  getClipProcessedCount,
  clearClipMasks,
  restoreClipMasksFromStorage,
  getClipBakedFps,
  processClipStudioCutout,
  updateActiveFrameMatteParams,
  initSelfieSegmentation,
  initStudioNeuralEngine,
} from "../../services/selfieSegmentationService";
import { rustCoreBridge } from "../../services/rustCoreBridge";
import { getActiveMediaElement } from "../../utils/videoRenderer";

// ─── Constants ────────────────────────────────────────────────────────────────

const STROKE_PRESETS = [
  { label: "None", color: "none" },
  { label: "White", color: "#FFFFFF" },
  { label: "Neon Cyan", color: "#00F2FE" },
  { label: "Amber Gold", color: "#FFE600" },
  { label: "Hot Pink", color: "#FF0050" },
  { label: "Emerald", color: "#10B981" },
  { label: "Purple Glow", color: "#A855F7" },
];

const BG_COLOR_PRESETS = [
  { label: "Transparent", color: "none" },
  { label: "Black", color: "#000000" },
  { label: "White", color: "#FFFFFF" },
  { label: "Neon Cyan", color: "#00F2FE" },
  { label: "Purple", color: "#8B5CF6" },
  { label: "Red", color: "#FF0050" },
  { label: "Amber", color: "#FFE600" },
  { label: "Emerald", color: "#10B981" },
  { label: "Royal Blue", color: "#2563EB" },
  { label: "Deep Slate", color: "#1E293B" },
];

const QUICK_BG_COLORS = BG_COLOR_PRESETS.slice(0, 5);
const QUICK_STROKE_COLORS = STROKE_PRESETS.slice(0, 5);
const CHROMA_QUICK_PRESETS = [
  { label: "Green", color: "#00FF00" },
  { label: "Blue", color: "#0047FF" },
  { label: "Black", color: "#000000" },
  { label: "White", color: "#FFFFFF" },
  { label: "Magenta", color: "#FF00FF" },
];

function isLightColor(hex: string): boolean {
  if (!hex || hex === "none" || hex === "transparent") return false;
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CutoutModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentCutout?: CutoutConfig;
  onApplyCutout: (config: CutoutConfig, clipId?: string) => void;
  initialMode?: "auto" | "chroma";
  isInline?: boolean;
  selectedClip?: any;
  currentTime?: number;
  isPlaying?: boolean;
  onReplaceClipWithMedia?: (
    clipId: string,
    newUrl: string,
    newThumbnail?: string,
  ) => void;
}

type CutoutMode = "none" | "chroma" | "auto";

const WebDiv: any = Platform.OS === "web" ? "div" : View;
const WebInput: any = Platform.OS === "web" ? "input" : View;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CutoutModal({
  visible,
  onClose,
  onApply,
  currentCutout,
  onApplyCutout,
  initialMode,
  isInline = false,
  selectedClip,
  currentTime = 0,
  isPlaying = false,
  onReplaceClipWithMedia,
}: CutoutModalProps) {
  // Cutout state
  const [enabled, setEnabled] = useState<boolean>(false);
  const [cutoutMode, setCutoutMode] = useState<CutoutMode>("chroma");
  const [keyColor, setKeyColor] = useState<string>("#00FF00");
  const [intensity, setIntensity] = useState<number>(45);
  const [shadow, setShadow] = useState<number>(25);
  const [strokeColor, setStrokeColor] = useState<string>("none");
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [bgColor, setBgColor] = useState<string>("none");

  // Frame-by-frame processing state
  const [isProcessingFrames, setIsProcessingFrames] = useState<boolean>(false);
  const [isProcessingActiveFrame, setIsProcessingActiveFrame] =
    useState<boolean>(false);
  const [activeFrameMatted, setActiveFrameMatted] = useState<boolean>(false);
  const [frameProgress, setFrameProgress] = useState<number>(0);
  const [processedFrames, setProcessedFrames] = useState<number>(0);
  const [totalFramesToProcess, setTotalFramesToProcess] = useState<number>(0);
  const [finishTab, setFinishTab] = useState<"bg" | "outline">("bg");
  const abortCtrlRef = useRef<AbortController | null>(null);

  const [currentFrameMatted, setCurrentFrameMatted] = useState<boolean>(false);
  const [settingsChangedSinceBake, setSettingsChangedSinceBake] =
    useState<boolean>(false);
  const [isReplacingClip, setIsReplacingClip] = useState<boolean>(false);
  const [isSliderDragging, setIsSliderDragging] = useState<boolean>(false);
  const lastMattedTimeRef = useRef<number | null>(null);
  const previousClipUrlRef = useRef<string | null>(selectedClip?.url || null);
  const bakedIntensityRef = useRef<number>(intensity);
  const bakedShadowRef = useRef<number>(shadow);

  const clipId = selectedClip?.id || "";
  const isVideoClip =
    selectedClip?.type === "video" || !!selectedClip?.duration;
  const isAlreadyProcessed = clipId ? hasClipMasks(clipId) : false;
  const currentProcessedCount = clipId ? getClipProcessedCount(clipId) : 0;

  const clipStart = selectedClip?.startTime || 0;
  const localTime = Math.max(0, (currentTime || 0) - clipStart);
  const effectiveSpeed = Math.max(0.1, Math.min(16, selectedClip?.speed || 1.0));
  const elapsedClipTime = localTime * effectiveSpeed;
  const trimIn = selectedClip?.trimIn || 0;
  const mediaTime = selectedClip?.reverse
    ? Math.max(0, (selectedClip.trimOut || selectedClip.duration) - elapsedClipTime)
    : trimIn + elapsedClipTime;
  const bakedFps = getClipBakedFps(clipId);
  const frameIdx = Math.max(0, Math.floor(elapsedClipTime * bakedFps));

  // Detect playhead movement / scrubbing and dynamically update active frame state
  useEffect(() => {
    if (!clipId || isPlaying) return;
    const hasMask = hasFrameMask(clipId, frameIdx);
    setCurrentFrameMatted((prev) => (prev !== hasMask ? hasMask : prev));

    // Auto-compute parked frame on scrub pause for instant feedback (never when clip is playing)
    if (
      visible &&
      enabled &&
      !isPlaying &&
      cutoutMode === "auto" &&
      !hasMask &&
      !isProcessingFrames &&
      !isProcessingActiveFrame
    ) {
      const timer = setTimeout(() => {
        handleProcessActiveFrame();
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [
    currentTime,
    clipId,
    frameIdx,
    visible,
    enabled,
    isPlaying,
    cutoutMode,
    isProcessingFrames,
    isProcessingActiveFrame,
  ]);

  // Auto-restore persisted masks from IndexedDB if not in memory
  useEffect(() => {
    if (!clipId || isPlaying) return;
    if (!hasClipMasks(clipId)) {
      restoreClipMasksFromStorage(clipId).then((restored) => {
        if (restored) {
          const has = hasFrameMask(clipId, frameIdx);
          setCurrentFrameMatted((prev) => (prev !== has ? has : prev));
        }
      });
    }
  }, [clipId, isPlaying]);

  // Pre-warm WebGL GPU and neural background worker as soon as modal opens for instant < 20ms execution
  useEffect(() => {
    if (visible && Platform.OS === "web") {
      initSelfieSegmentation().catch(() => {});
      initStudioNeuralEngine().catch(() => {});
    }
  }, [visible]);

  // Invalidate masks if the clip's media URL was replaced on the timeline
  useEffect(() => {
    if (
      selectedClip?.url &&
      previousClipUrlRef.current &&
      previousClipUrlRef.current !== selectedClip.url
    ) {
      clearClipMasks(clipId);
      setCurrentFrameMatted(false);
      lastMattedTimeRef.current = null;
      setSettingsChangedSinceBake(false);
    }
    previousClipUrlRef.current = selectedClip?.url || null;
  }, [selectedClip?.url, clipId]);

  // Refs for always-current values (avoids stale closures in callbacks)
  const enabledRef = useRef(enabled);
  const cutoutModeRef = useRef(cutoutMode);
  const keyColorRef = useRef(keyColor);
  const intensityRef = useRef(intensity);
  const shadowRef = useRef(shadow);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const bgColorRef = useRef(bgColor);

  // Sync refs whenever state changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    cutoutModeRef.current = cutoutMode;
  }, [cutoutMode]);
  useEffect(() => {
    keyColorRef.current = keyColor;
  }, [keyColor]);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);
  useEffect(() => {
    shadowRef.current = shadow;
  }, [shadow]);
  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);
  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);
  useEffect(() => {
    bgColorRef.current = bgColor;
  }, [bgColor]);

  // Load from props when modal opens
  // NOTE: we intentionally do NOT call onApplyCutout here to prevent
  // applying stale config from a previously selected clip (the "applying from
  // old config" bug). Only user interactions trigger onApplyCutout.
  useEffect(() => {
    if (!visible) return;
    const en = currentCutout?.enabled || false;
    const targetMode: CutoutMode =
      initialMode || (en && currentCutout?.mode ? currentCutout.mode : "none");
    cutoutModeRef.current = targetMode;
    setCutoutMode(targetMode);
    enabledRef.current = en;
    setEnabled(en);
    const kc = currentCutout?.keyColor || "#00FF00";
    keyColorRef.current = kc;
    setKeyColor(kc);
    const ints = currentCutout?.intensity ?? 45;
    intensityRef.current = ints;
    setIntensity(ints);
    const sh = currentCutout?.shadow ?? 25;
    shadowRef.current = sh;
    setShadow(sh);
    const sc = currentCutout?.strokeColor || "none";
    strokeColorRef.current = sc;
    setStrokeColor(sc);
    const sw = currentCutout?.strokeWidth ?? 3;
    strokeWidthRef.current = sw;
    setStrokeWidth(sw);
    const bg = currentCutout?.bgColor || "none";
    bgColorRef.current = bg;
    setBgColor(bg);
  }, [visible, initialMode, selectedClip?.id, currentCutout?.enabled, currentCutout?.mode]);

  // Sync cutout — reads from refs so it always has fresh values
  const syncCutout = useCallback(
    (overrides?: Partial<CutoutConfig>) => {
      const nextEnabled =
        overrides?.enabled !== undefined
          ? overrides.enabled
          : enabledRef.current;
      const rawMode =
        overrides?.mode !== undefined ? overrides.mode : cutoutModeRef.current;
      const nextMode: "chroma" | "auto" =
        rawMode === "auto" ? "auto" : "chroma";
      const nextKeyColor =
        overrides?.keyColor !== undefined
          ? overrides.keyColor
          : keyColorRef.current;
      const nextIntensity =
        overrides?.intensity !== undefined
          ? overrides.intensity
          : intensityRef.current;
      const nextShadow =
        overrides?.shadow !== undefined ? overrides.shadow : shadowRef.current;
      const nextStrokeColor =
        overrides?.strokeColor !== undefined
          ? overrides.strokeColor
          : strokeColorRef.current;
      const nextStrokeWidth =
        overrides?.strokeWidth !== undefined
          ? overrides.strokeWidth
          : strokeWidthRef.current;
      const nextBgColor =
        overrides?.bgColor !== undefined
          ? overrides.bgColor
          : bgColorRef.current;

      onApplyCutout({
        enabled: nextEnabled,
        mode: nextMode,
        keyColor: nextKeyColor,
        intensity: nextIntensity,
        shadow: nextShadow,
        strokeColor: nextStrokeColor === "none" ? undefined : nextStrokeColor,
        strokeWidth: nextStrokeColor === "none" ? 0 : nextStrokeWidth,
        bgColor: nextBgColor === "none" ? undefined : nextBgColor,
      }, clipId);
    },
    [onApplyCutout, clipId],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleApply = () => {
    soundEngine.playSfx("whoosh");
    syncCutout({ enabled: enabledRef.current });
    if (onApply) onApply();
  };

  const handleReset = () => {
    soundEngine.playSfx("click");
    clearClipMasks(clipId);
    setEnabled(false);
    enabledRef.current = false;
    setIntensity(45);
    setShadow(25);
    setStrokeColor("none");
    setStrokeWidth(3);
    setBgColor("none");
    intensityRef.current = 45;
    shadowRef.current = 25;
    strokeColorRef.current = "none";
    strokeWidthRef.current = 3;
    bgColorRef.current = "none";
    setCurrentFrameMatted(false);
    lastMattedTimeRef.current = null;
    setSettingsChangedSinceBake(false);
    const activeMode = cutoutModeRef.current === "chroma" ? "chroma" : "auto";
    onApplyCutout({
      enabled: false,
      mode: activeMode,
      keyColor: keyColorRef.current,
      intensity: 45,
      shadow: 25,
      strokeWidth: 0,
      bgColor: undefined,
      strokeColor: undefined,
    });
  };

  const handleCancel = () => {
    soundEngine.playSfx("pop");
    onClose();
  };

  // Updaters: immediately write to ref AND state AND sync
  const updateIntensity = (val: number) => {
    const v = Math.max(1, Math.min(100, val));
    intensityRef.current = v;
    setIntensity(v);
    syncCutout({ intensity: v });

    if (cutoutMode === "auto" && clipId) {
      // Instantly update active preview frame in 0.1ms via native Rust/WASM
      updateActiveFrameMatteParams(
        clipId,
        frameIdx,
        v / 100,
        shadowRef.current / 100,
      );
      if (isAlreadyProcessed && Math.abs(v - bakedIntensityRef.current) > 2) {
        setSettingsChangedSinceBake(true);
      }
    }
  };

  const updateShadow = (val: number) => {
    const v = Math.max(0, Math.min(100, val));
    shadowRef.current = v;
    setShadow(v);
    syncCutout({ shadow: v });

    if (cutoutMode === "auto" && clipId) {
      // Instantly update active preview frame in 0.1ms via native Rust/WASM
      updateActiveFrameMatteParams(
        clipId,
        frameIdx,
        intensityRef.current / 100,
        v / 100,
      );
      if (isAlreadyProcessed && Math.abs(v - bakedShadowRef.current) > 2) {
        setSettingsChangedSinceBake(true);
      }
    }
  };

  const updateKeyColor = (col: string) => {
    keyColorRef.current = col;
    setKeyColor(col);
    syncCutout({ keyColor: col });
  };

  const colorInputRef = useRef<any>(null);

  const handleOpenEyeDropper = async () => {
    soundEngine.playSfx("click");
    if (typeof window !== "undefined" && (window as any).EyeDropper) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          updateKeyColor(result.sRGBHex);
        }
      } catch {
        // User cancelled eyedropper
      }
    } else if (Platform.OS === "web" && colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  const handleAutoDetectBackdrop = () => {
    soundEngine.playSfx("click");
    if (typeof document === "undefined") return;

    const video = document.querySelector("video");
    const canvas = document.querySelector("canvas");
    const source: any = video || canvas;
    if (!source) return;

    try {
      const sw = 160;
      const sh = 90;
      const offC = document.createElement("canvas");
      offC.width = sw;
      offC.height = sh;
      const c = offC.getContext("2d", { willReadFrequently: true });
      if (!c) return;
      c.drawImage(source, 0, 0, sw, sh);
      const imgData = c.getImageData(0, 0, sw, sh);

      let detected: { hex: string } | null = null;
      if (rustCoreBridge.isWasmReady()) {
        detected = rustCoreBridge.detectUniformBackdrop(imgData.data, sw, sh);
      }

      if (!detected) {
        const u32 = new Uint32Array(imgData.data.buffer);
        const pTL = u32[0];
        const r = pTL & 0xff;
        const g = (pTL >> 8) & 0xff;
        const b = (pTL >> 16) & 0xff;
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
        detected = { hex };
      }

      if (detected && detected.hex) {
        soundEngine.playSfx("whoosh");
        updateKeyColor(detected.hex);
      }
    } catch {
      // Ignore
    }
  };

  const updateBgColor = (col: string) => {
    bgColorRef.current = col;
    setBgColor(col);
    syncCutout({ bgColor: col });
  };

  const updateStrokeColor = (col: string) => {
    strokeColorRef.current = col;
    setStrokeColor(col);
    syncCutout({ strokeColor: col });
  };

  const updateStrokeWidth = (w: number) => {
    const v = Math.max(1, Math.min(20, w));
    strokeWidthRef.current = v;
    setStrokeWidth(v);
    syncCutout({ strokeWidth: v });
  };

  const handleProcessActiveFrame = async () => {
    if (!clipId || typeof document === "undefined") return;
    soundEngine.playSfx("click");
    setIsProcessingActiveFrame(true);

    // Yield to the browser paint loop so the loading spinner renders immediately
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));

    try {
      let activeEl: any =
        getActiveMediaElement(clipId) ||
        getActiveMediaElement(selectedClip?.url || "");

      const ok = await processClipStudioCutout(
        activeEl || selectedClip?.url || clipId,
        clipId,
        frameIdx,
        mediaTime,
        intensityRef.current / 100,
        shadowRef.current / 100,
      );

      if (ok) {
        soundEngine.playSfx("whoosh");
        syncCutout({ mode: "auto", enabled: true });
        setCurrentFrameMatted(true);
        lastMattedTimeRef.current = currentTime;
      }
    } catch (e) {
      console.warn("[CutoutModal] Active frame processing error:", e);
    } finally {
      setIsProcessingActiveFrame(false);
    }
  };

  const toggleCutoutOption = (mode: CutoutMode) => {
    soundEngine.playSfx("click");
    if (enabled && cutoutMode === mode) {
      // Toggle OFF: no cutout applied
      setEnabled(false);
      enabledRef.current = false;
      syncCutout({ enabled: false });
    } else {
      // Toggle ON: apply selected cutout mode
      setEnabled(true);
      enabledRef.current = true;
      setCutoutMode(mode);
      cutoutModeRef.current = mode;
      const effectiveMode: "chroma" | "auto" =
        mode === "auto" ? "auto" : "chroma";
      syncCutout({ enabled: true, mode: effectiveMode });

      if (mode === "auto" && clipId && !hasFrameMask(clipId, frameIdx)) {
        handleProcessActiveFrame();
      }
    }
  };

  const handleProcessVideoClick = () => {
    soundEngine.playSfx("click");
    handleProcessFrameByFrame(true);
  };

  const handleProcessFrameByFrame = async (replace = false) => {
    if (!selectedClip?.url || !clipId) return;
    soundEngine.playSfx("click");
    setIsProcessingFrames(true);
    setFrameProgress(0);
    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;

    // Yield to the browser paint loop so the progress dialog displays immediately
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));

    if (replace) {
      clearClipMasks(clipId);
    }

    const dur = selectedClip.duration || 5;
    const trimIn = selectedClip.trimIn || 0;
    const speed = selectedClip.speed || 1;
    const count = await processVideoFrameByFrame(
      selectedClip.url,
      clipId,
      dur,
      trimIn,
      speed,
      20, // 20 FPS = high quality temporal sampling, zero jitter, perfectly smooth playback!
      intensityRef.current / 100,
      shadowRef.current / 100,
      (pct, curr, total) => {
        setFrameProgress(pct);
        setProcessedFrames(curr);
        setTotalFramesToProcess(total);
      },
      abortCtrl.signal,
    );

    setIsProcessingFrames(false);
    if (count > 0) {
      soundEngine.playSfx("whoosh");
      syncCutout({ mode: "auto", enabled: true });
      bakedIntensityRef.current = intensityRef.current;
      bakedShadowRef.current = shadowRef.current;
      setSettingsChangedSinceBake(false);
      setCurrentFrameMatted(true);
    }
  };

  const handleCancelProcessing = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    setIsProcessingFrames(false);
    setIsReplacingClip(false);
  };

  // ── Slider helper ─────────────────────────────────────────────────────────
  const renderSlider = (
    label: string,
    value: number,
    unit: string,
    min: number,
    max: number,
    onChange: (v: number) => void,
    step = 1,
    accentColor = "#00F2FE",
  ) => (
    <View style={s.sliderGroup}>
      <CompactSliderInput
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        accentColor={accentColor}
        showSteppers={true}
        onDragStart={() => setIsSliderDragging(true)}
        onDragEnd={() => setIsSliderDragging(false)}
        onChange={onChange}
      />
    </View>
  );

  const renderCutoutContent = () => {
    return (
      <>
        {/* Sleek Segmented Mode Switcher */}
        <View style={s.modeSegmentedBar}>
          <TouchableOpacity
            style={[
              s.modeSegmentItem,
              cutoutMode === "none" && s.modeSegmentItemActive,
            ]}
            onPress={() => {
              soundEngine.playSfx("click");
              setCutoutMode("none");
              cutoutModeRef.current = "none";
              setEnabled(false);
              enabledRef.current = false;
              syncCutout({ enabled: false });
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: cutoutMode === "none" }}
          >
            <Ionicons
              name="close-circle-outline"
              size={13}
              color={cutoutMode === "none" ? "#00F2FE" : "#94A3B8"}
            />
            <Text
              style={[
                s.modeSegmentText,
                cutoutMode === "none" && s.modeSegmentTextActive,
              ]}
            >
              None
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.modeSegmentItem,
              cutoutMode === "auto" && s.modeSegmentItemActive,
            ]}
            onPress={() => {
              soundEngine.playSfx("click");
              setCutoutMode("auto");
              cutoutModeRef.current = "auto";
              setEnabled(true);
              enabledRef.current = true;
              syncCutout({ enabled: true, mode: "auto" });
              if (clipId && !hasFrameMask(clipId, frameIdx) && !isPlaying) {
                handleProcessActiveFrame();
              }
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: cutoutMode === "auto" }}
          >
            <Ionicons
              name="sparkles"
              size={13}
              color={cutoutMode === "auto" ? "#00F2FE" : "#94A3B8"}
            />
            <Text
              style={[
                s.modeSegmentText,
                cutoutMode === "auto" && s.modeSegmentTextActive,
              ]}
            >
              Auto Cutout
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.modeSegmentItem,
              cutoutMode === "chroma" && s.modeSegmentItemActive,
            ]}
            onPress={() => {
              soundEngine.playSfx("click");
              setCutoutMode("chroma");
              cutoutModeRef.current = "chroma";
              setEnabled(true);
              enabledRef.current = true;
              syncCutout({ enabled: true, mode: "chroma" });
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: cutoutMode === "chroma" }}
          >
            <Ionicons
              name="color-filter"
              size={13}
              color={cutoutMode === "chroma" ? "#00F2FE" : "#94A3B8"}
            />
            <Text
              style={[
                s.modeSegmentText,
                cutoutMode === "chroma" && s.modeSegmentTextActive,
              ]}
            >
              Chroma Key
            </Text>
          </TouchableOpacity>
        </View>

        {cutoutMode === "none" ? (
          <View style={s.compactNoneBox}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color="#00F2FE"
            />
            <Text style={s.compactNoneText}>
              Original video background is preserved. Select Auto Cutout or
              Chroma Key above to remove background.
            </Text>
          </View>
        ) : (
          <View style={s.sectionBox}>
            {cutoutMode === "chroma" ? (
              <>
                <View style={s.compactChromaHeaderRow}>
                  <Text style={s.sectionHeader}>SCREEN COLOR</Text>
                  <View style={s.compactPresetGroup}>
                    {CHROMA_QUICK_PRESETS.map((p) => {
                      const isSelected =
                        keyColor.toLowerCase() === p.color.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={p.color}
                          style={[
                            s.compactPresetSwatch,
                            { backgroundColor: p.color },
                            isSelected && s.compactPresetSwatchSelected,
                          ]}
                          onPress={() => {
                            soundEngine.playSfx("click");
                            updateKeyColor(p.color);
                          }}
                          activeOpacity={0.8}
                          accessibilityLabel={p.label}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={10}
                              color={
                                p.color === "#FFFFFF" || p.color === "#00FF00"
                                  ? "#000000"
                                  : "#FFFFFF"
                              }
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <CustomColorPickerButton
                      value={keyColor}
                      presets={CHROMA_QUICK_PRESETS}
                      onColorChange={updateKeyColor}
                      size={18}
                      shape="square"
                      accessibilityLabel="Pick custom screen color"
                    />
                  </View>
                </View>

                <View style={s.compactPickerTrigger}>
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                    }}
                    onPress={handleOpenEyeDropper}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        s.compactColorSwatch,
                        { backgroundColor: keyColor },
                      ]}
                    />
                    <Text style={s.compactHex}>{keyColor.toUpperCase()}</Text>
                    <View style={s.dropperIconBadge}>
                      <Ionicons name="eyedrop" size={12} color="#00F2FE" />
                      <Text style={s.dropperBadgeText}>Sample</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      s.dropperIconBadge,
                      {
                        backgroundColor: "rgba(16, 185, 129, 0.12)",
                        borderColor: "rgba(16, 185, 129, 0.3)",
                      },
                    ]}
                    onPress={handleAutoDetectBackdrop}
                    activeOpacity={0.8}
                    accessibilityLabel="Auto-detect backdrop color"
                  >
                    <Ionicons name="sparkles" size={12} color="#10B981" />
                    <Text style={[s.dropperBadgeText, { color: "#10B981" }]}>
                      Auto Detect
                    </Text>
                  </TouchableOpacity>
                </View>

                {Platform.OS === "web" && (
                  <WebInput
                    ref={colorInputRef}
                    type="color"
                    value={keyColor}
                    onChange={(e: any) => updateKeyColor(e.target.value)}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: 1,
                      height: 1,
                      pointerEvents: "none",
                    }}
                  />
                )}

                {renderSlider(
                  "Tolerance",
                  intensity,
                  "%",
                  1,
                  100,
                  updateIntensity,
                )}
                {renderSlider("Softness", shadow, "%", 0, 100, updateShadow)}
              </>
            ) : (
              <View style={s.autoCutoutPanel}>
                {/* Header Status Bar */}
                <View style={s.compactAiHeader}>
                  <View style={s.compactAiBadge}>
                    <Ionicons name="sparkles" size={12} color="#00F2FE" />
                    <Text style={s.compactAiBadgeText}>Auto Cutout</Text>
                  </View>

                  {isProcessingFrames || isReplacingClip ? (
                    <View style={s.statusPillProcessing}>
                      <ActivityIndicator
                        size="small"
                        color="#00F2FE"
                        style={{ transform: [{ scale: 0.65 }] }}
                      />
                      <Text style={s.statusPillTextProcessing}>
                        {frameProgress}%
                      </Text>
                    </View>
                  ) : isAlreadyProcessed ? (
                    <View style={s.statusPillSuccess}>
                      <Ionicons
                        name="checkmark-circle"
                        size={10}
                        color="#10B981"
                      />
                      <Text style={s.statusPillTextSuccess}>
                        {currentProcessedCount} frames removed
                      </Text>
                    </View>
                  ) : enabled ? (
                    <View style={s.statusPillSuccess}>
                      <Ionicons
                        name="checkmark-circle"
                        size={10}
                        color="#10B981"
                      />
                      <Text style={s.statusPillTextSuccess}>
                        Cutout Active
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.statusPillMuted}>Ready to preview</Text>
                  )}
                </View>

                {/* Active Processing Banner */}
                {(isProcessingFrames || isReplacingClip) && (
                  <View style={s.compactProcessingBanner}>
                    <View style={s.compactProcessingHeader}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          flex: 1,
                        }}
                      >
                        <ActivityIndicator size="small" color="#00F2FE" />
                        <Text style={s.compactProgressPct} numberOfLines={1}>
                          {isReplacingClip
                            ? `Baking video clip... ${frameProgress}% (${processedFrames}/${totalFramesToProcess})`
                            : `Removing background... ${frameProgress}% (${processedFrames}/${totalFramesToProcess})`}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleCancelProcessing}
                        style={s.compactCancelBtn}
                      >
                        <Text style={s.compactCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={s.progressBarTrack}>
                      <View
                        style={[
                          s.progressBarFill,
                          { width: `${frameProgress}%` },
                        ]}
                      />
                    </View>
                  </View>
                )}

                {/* Main Action Controls */}
                {!isProcessingFrames && !isReplacingClip && (
                  <View style={s.actionsContainer}>
                    {/* Always Consistent 3 Actions: Preview, Full Video, and Reset */}
                    <View style={{ gap: 8 }}>
                      {/* 1. Full Video Action Button */}
                      {isVideoClip && (
                        <TouchableOpacity
                          onPress={handleProcessVideoClick}
                          style={s.heroBtn}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isAlreadyProcessed ? "refresh" : "sparkles"}
                            size={14}
                            color="#08090E"
                          />
                          <Text style={s.heroBtnText}>
                            {isAlreadyProcessed
                              ? "Reprocess Video"
                              : "Remove Background (Full Video)"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Row with Preview and Reset Options */}
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        {/* 2. Preview Action Button - Clean, stable label that never flickers during playback */}
                        <TouchableOpacity
                          onPress={handleProcessActiveFrame}
                          style={[s.secondaryActionBtn, { flex: 1.2 }]}
                          activeOpacity={0.8}
                          disabled={isProcessingActiveFrame}
                        >
                          {isProcessingActiveFrame ? (
                            <ActivityIndicator size="small" color="#00F2FE" />
                          ) : (
                            <Ionicons
                              name="eye-outline"
                              size={14}
                              color="#00F2FE"
                            />
                          )}
                          <Text
                            style={[
                              s.secondaryActionText,
                              { color: "#00F2FE" },
                            ]}
                            numberOfLines={1}
                          >
                            {isProcessingActiveFrame
                              ? "Processing..."
                              : "Preview Frame"}
                          </Text>
                        </TouchableOpacity>

                        {/* 3. Reset Action Button */}
                        <TouchableOpacity
                          onPress={handleReset}
                          style={[
                            s.secondaryActionBtn,
                            {
                              flex: 0.8,
                              borderColor: "rgba(148, 163, 184, 0.25)",
                            },
                          ]}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="reload-outline"
                            size={13}
                            color="#94A3B8"
                          />
                          <Text
                            style={[
                              s.secondaryActionText,
                              { color: "#94A3B8" },
                            ]}
                            numberOfLines={1}
                          >
                            Reset Cutout
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Threshold and Softness Tuning Sliders */}
                    <View style={{ marginTop: 6 }}>
                      {renderSlider(
                        "Cutout Threshold",
                        intensity,
                        "%",
                        1,
                        100,
                        updateIntensity,
                      )}
                      {renderSlider(
                        "Edge Softness",
                        shadow,
                        "%",
                        0,
                        100,
                        updateShadow,
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {(cutoutMode !== "none") && (
          <View style={s.sectionBox}>
            <View style={s.finishSegmentRow}>
              <View style={s.finishTabGroup}>
                <TouchableOpacity
                  style={[
                    s.finishTabBtn,
                    finishTab === "bg" && s.finishTabBtnActive,
                  ]}
                  onPress={() => setFinishTab("bg")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.finishTabText,
                      finishTab === "bg" && s.finishTabTextActive,
                    ]}
                  >
                    Background
                  </Text>
                  {bgColor !== "none" && <View style={s.activeDot} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.finishTabBtn,
                    finishTab === "outline" && s.finishTabBtnActive,
                  ]}
                  onPress={() => setFinishTab("outline")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.finishTabText,
                      finishTab === "outline" && s.finishTabTextActive,
                    ]}
                  >
                    Outline
                  </Text>
                  {strokeColor !== "none" && <View style={s.activeDot} />}
                </TouchableOpacity>
              </View>

              {(finishTab === "bg"
                ? bgColor !== "none"
                : strokeColor !== "none") && (
                <TouchableOpacity
                  onPress={() => {
                    if (finishTab === "bg") updateBgColor("none");
                    else updateStrokeColor("none");
                  }}
                  style={s.clearBtnTouch}
                >
                  <Text style={s.clearBtn}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            {finishTab === "bg" ? (
              <View style={s.compactSwatchRow}>
                {QUICK_BG_COLORS.map((preset) => {
                  const isSelected =
                    bgColor.toUpperCase() === preset.color.toUpperCase();
                  return (
                    <TouchableOpacity
                      key={preset.color}
                      style={[
                        s.colorSwatch,
                        {
                          backgroundColor:
                            preset.color === "none" ? "#202832" : preset.color,
                        },
                        preset.color === "none" && s.transparentSwatch,
                        isSelected && s.colorSwatchSelected,
                      ]}
                      onPress={() => updateBgColor(preset.color)}
                      activeOpacity={0.8}
                      accessibilityLabel={preset.label}
                    >
                      {preset.color === "none" && (
                        <Ionicons name="close" size={13} color="#00F2FE" />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Custom Color Palette Button */}
                <CustomColorPickerButton
                  value={bgColor}
                  presets={QUICK_BG_COLORS}
                  onColorChange={updateBgColor}
                  size={24}
                  shape="square"
                  accessibilityLabel="Pick custom background color"
                />
              </View>
            ) : (
              <>
                <View style={s.compactSwatchRow}>
                  {QUICK_STROKE_COLORS.map((sp) => {
                    const isSelected = strokeColor === sp.color;
                    return (
                      <TouchableOpacity
                        key={sp.color}
                        style={[
                          s.colorSwatch,
                          {
                            backgroundColor:
                              sp.color === "none" ? "#202832" : sp.color,
                          },
                          sp.color === "none" && s.transparentSwatch,
                          isSelected && s.colorSwatchSelected,
                        ]}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          updateStrokeColor(sp.color);
                        }}
                        activeOpacity={0.8}
                        accessibilityLabel={sp.label}
                      >
                        {sp.color === "none" && (
                          <Ionicons name="close" size={13} color="#00F2FE" />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* Custom Stroke Palette Button */}
                  <CustomColorPickerButton
                    value={strokeColor}
                    presets={QUICK_STROKE_COLORS}
                    onColorChange={updateStrokeColor}
                    size={24}
                    shape="square"
                    accessibilityLabel="Pick custom outline color"
                  />
                </View>

                {strokeColor !== "none" &&
                  renderSlider(
                    "Outline Width",
                    strokeWidth,
                    "px",
                    1,
                    20,
                    updateStrokeWidth,
                    1,
                  )}
              </>
            )}
          </View>
        )}
      </>
    );
  };

  // ── Sheet Content ─────────────────────────────────────────────────────────
  const sheetContent = (
    <View style={[s.sheetContainer, s.inlineSheet]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={s.header}>
          <View style={s.titleRow}>
            <Ionicons name="person-remove-outline" size={14} color="#00F2FE" />
            <Text style={s.sheetTitle}>Cutout</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TouchableOpacity
              onPress={handleReset}
              style={[
                s.resetBtn,
                {
                  paddingHorizontal: 6,
                  height: 22,
                  flexDirection: "row",
                  alignItems: "center",
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Reset cutout"
            >
              <Ionicons
                name="refresh-outline"
                size={11}
                color="#00F2FE"
                style={{ marginRight: 2 }}
              />
              <Text style={[s.resetText, { fontSize: 9 }]}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={s.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={14} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={s.sheetBody}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSliderDragging}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {renderCutoutContent()}
      </ScrollView>
    </View>
  );

  if (!visible) return null;
  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        backgroundColor: "#0F131D",
      }}
    >
      {sheetContent}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0F131D",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2637",
    maxHeight: Platform.OS === "web" ? "82%" : ("88%" as any),
  },
  inlineSheet: {
    flex: 1,
    maxHeight: "100%" as any,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 0,
  },
  sheetHandle: {
    width: 32,
    height: 4,
    backgroundColor: "#1F2637",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#08090E",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sheetTitle: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  resetText: { color: "#94A3B8", fontSize: 9, fontWeight: "400" },
  doneBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  checkboxCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
    backgroundColor: "#131826",
  },
  compactModeBar: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 5,
  },
  modeSegmentedBar: {
    flexDirection: "row",
    backgroundColor: "#0A0D15",
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 6,
    gap: 4,
  },
  modeSegmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 5,
    borderRadius: 4,
  },
  modeSegmentItemActive: {
    backgroundColor: "#161D2B",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
  },
  modeSegmentText: {
    fontSize: 9.5,
    fontWeight: "400",
    color: "#94A3B8",
  },
  modeSegmentTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  actionsContainer: {
    marginBottom: 4,
  },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#00F2FE",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  heroBtnText: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#08090E",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  secondaryActionText: {
    fontSize: 9.5,
    fontWeight: "400",
  },
  deleteGhostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  deleteGhostText: {
    fontSize: 9.5,
    fontWeight: "400",
    color: "#EF4444",
  },
  subtleHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 2,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  subtleHintText: {
    fontSize: 9,
    color: "#64748B",
    flex: 1,
    lineHeight: 12,
  },
  activeOnTimelineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeOnTimelineText: {
    fontSize: 9.5,
    color: "#10B981",
    fontWeight: "500",
    flex: 1,
  },
  compactNoneBox: {
    backgroundColor: "#131826",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  compactNoneText: {
    fontSize: 9.5,
    color: "#94A3B8",
    flex: 1,
  },
  sheetBody: { padding: 6 },
  sectionBox: {
    backgroundColor: "#131826",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
    marginBottom: 5,
  },
  sectionHeader: {
    fontSize: 8.5,
    fontWeight: "500",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  compactChromaHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  compactPresetGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactPresetSwatch: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  compactPresetSwatchSelected: {
    borderWidth: 2,
    borderColor: "#00F2FE",
    transform: [{ scale: 1.08 }],
  },
  compactPickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0E17",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#1F2637",
    gap: 6,
    marginBottom: 3,
  },
  compactColorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#2E384D",
  },
  compactHex: {
    fontSize: 10,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    flex: 1,
  },
  dropperIconBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
  },
  dropperBadgeText: {
    fontSize: 8.5,
    fontWeight: "400",
    color: "#00F2FE",
  },
  compactAiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  compactAiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
  },
  compactAiBadgeText: {
    fontSize: 9.5,
    fontWeight: "500",
    color: "#00F2FE",
  },
  statusPillSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  statusPillTextSuccess: {
    fontSize: 8.5,
    fontWeight: "400",
    color: "#10B981",
  },
  statusPillProcessing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  statusPillTextProcessing: {
    fontSize: 8.5,
    fontWeight: "500",
    color: "#00F2FE",
  },
  statusPillMuted: {
    fontSize: 8.5,
    fontWeight: "400",
    color: "#64748B",
  },
  compactAiActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 3,
    marginBottom: 6,
  },
  compactActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 5,
    minHeight: 26,
  },
  compactActionBtnText: {
    fontSize: 9.5,
    fontWeight: "500",
  },
  compactDeleteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 5,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    minHeight: 26,
    flexShrink: 0,
  },
  compactDeleteActionText: {
    fontSize: 8.5,
    fontWeight: "400",
    color: "#EF4444",
  },
  compactProcessingBanner: {
    backgroundColor: "#0A0D15",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
    borderRadius: 6,
    padding: 6,
    marginVertical: 4,
  },
  compactProcessingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 6,
  },
  compactProcessBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#00F2FE",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  compactProcessBtnText: {
    color: "#08090E",
    fontSize: 9.5,
    fontWeight: "500",
  },
  compactReprocessBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  compactReprocessText: {
    color: "#10B981",
    fontSize: 9.5,
    fontWeight: "500",
  },
  compactProgressInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  compactProgressPct: {
    fontSize: 10,
    fontWeight: "500",
    color: "#00F2FE",
  },
  compactCancelBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#1F2637",
  },
  compactCancelText: {
    fontSize: 8.5,
    color: "#EF4444",
    fontWeight: "500",
  },
  finishSegmentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  finishTabGroup: {
    flexDirection: "row",
    backgroundColor: "#0B0E17",
    borderRadius: 5,
    padding: 1.5,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  finishTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  finishTabBtnActive: {
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  finishTabText: {
    fontSize: 9.5,
    fontWeight: "400",
    color: "#94A3B8",
  },
  finishTabTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  activeDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: "#00F2FE",
  },
  clearBtnTouch: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  compactSwatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 3,
  },
  customSwatchBtn: {
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: "#00F2FE",
    transform: [{ scale: 1.06 }],
  },
  transparentSwatch: { borderColor: "#00F2FE", borderStyle: "dashed" },
  clearBtn: { fontSize: 9.5, color: "#00F2FE", fontWeight: "400" },
  sliderGroup: { marginTop: 3 },
  autoCutoutPanel: {
    marginTop: 2,
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: "#1F2637",
    borderRadius: 1.5,
    overflow: "hidden",
    marginVertical: 3,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 1.5,
  },
  settingsChangedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginVertical: 3,
  },
  settingsChangedText: {
    fontSize: 9,
    color: "#00F2FE",
    fontWeight: "400",
    flex: 1,
  },
  replaceConfirmOverlay: {
    marginVertical: 6,
    backgroundColor: "rgba(10, 14, 23, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.4)",
    borderRadius: 8,
    padding: 8,
  },
  replaceConfirmBox: {},
  replaceConfirmTitle: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#F8FAFC",
  },
  replaceConfirmDesc: {
    fontSize: 9.5,
    color: "#94A3B8",
    lineHeight: 13,
    marginBottom: 6,
  },
  replaceConfirmActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  replaceConfirmKeepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  replaceConfirmKeepText: {
    fontSize: 9.5,
    fontWeight: "400",
    color: "#94A3B8",
  },
  replaceConfirmReplaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#00F2FE",
  },
  replaceConfirmReplaceText: {
    fontSize: 9.5,
    fontWeight: "500",
    color: "#08090E",
  },
});
