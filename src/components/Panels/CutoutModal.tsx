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
import {
  processVideoFrameByFrame,
  hasClipMasks,
  getClipProcessedCount,
  clearClipMasks,
  processClipStudioCutout,
} from "../../services/selfieSegmentationService";
import { rustCoreBridge } from "../../services/rustCoreBridge";

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
  onApplyCutout: (config: CutoutConfig) => void;
  initialMode?: "auto" | "chroma";
  isInline?: boolean;
  selectedClip?: any;
}

type CutoutMode = "chroma" | "auto";

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
  const [frameProgress, setFrameProgress] = useState<number>(0);
  const [processedFrames, setProcessedFrames] = useState<number>(0);
  const [totalFramesToProcess, setTotalFramesToProcess] = useState<number>(0);
  const [finishTab, setFinishTab] = useState<"bg" | "outline">("bg");
  const abortCtrlRef = useRef<AbortController | null>(null);
  const customBgInputRef = useRef<any>(null);
  const customStrokeInputRef = useRef<any>(null);

  const clipId = selectedClip?.id || "";
  const isVideoClip = selectedClip?.type === "video" || !!selectedClip?.duration;
  const isAlreadyProcessed = clipId ? hasClipMasks(clipId) : false;
  const currentProcessedCount = clipId ? getClipProcessedCount(clipId) : 0;

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
    const targetMode: CutoutMode =
      initialMode || currentCutout?.mode || "chroma";
    cutoutModeRef.current = targetMode;
    setCutoutMode(targetMode);
    const en = currentCutout?.enabled || false;
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
  }, [visible, initialMode]); // Values are loaded once per modal session; updates must not reset active controls.

  // Sync cutout — reads from refs so it always has fresh values
  const syncCutout = useCallback(
    (overrides?: Partial<CutoutConfig>) => {
      const nextEnabled =
        overrides?.enabled !== undefined
          ? overrides.enabled
          : enabledRef.current;
      const nextMode =
        overrides?.mode !== undefined ? overrides.mode : cutoutModeRef.current;
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
      });
    },
    [onApplyCutout],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleApply = () => {
    soundEngine.playSfx("whoosh");
    syncCutout({ enabled: enabledRef.current });
    if (onApply) onApply();
  };

  const handleReset = () => {
    soundEngine.playSfx("click");
    setEnabled(false);
    setCutoutMode("chroma");
    setKeyColor("#00FF00");
    setIntensity(45);
    setShadow(25);
    setStrokeColor("none");
    setStrokeWidth(3);
    setBgColor("none");
    enabledRef.current = false;
    cutoutModeRef.current = "chroma";
    keyColorRef.current = "#00FF00";
    intensityRef.current = 45;
    shadowRef.current = 25;
    strokeColorRef.current = "none";
    strokeWidthRef.current = 3;
    bgColorRef.current = "none";
    onApplyCutout({
      enabled: false,
      mode: "chroma",
      keyColor: "#00FF00",
      intensity: 45,
      shadow: 25,
      strokeWidth: 0,
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
  };
  const updateShadow = (val: number) => {
    const v = Math.max(0, Math.min(100, val));
    shadowRef.current = v;
    setShadow(v);
    syncCutout({ shadow: v });
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
  const [isProcessingActiveFrame, setIsProcessingActiveFrame] = useState<boolean>(false);

  const handleProcessActiveFrame = async () => {
    if (!clipId || typeof document === "undefined") return;
    soundEngine.playSfx("click");
    setIsProcessingActiveFrame(true);

    try {
      const videoEl: any = document.querySelector("video");
      const imgEl: any = document.querySelector("img");
      const canvasEl: any = document.querySelector("canvas");
      const source = videoEl || imgEl || canvasEl || selectedClip?.url;

      if (source) {
        const ok = await processClipStudioCutout(source, clipId, 0);
        if (ok) {
          soundEngine.playSfx("whoosh");
          syncCutout({ mode: "auto", enabled: true });
        }
      }
    } catch (e) {
      console.warn("[CutoutModal] Active frame processing error:", e);
    } finally {
      setIsProcessingActiveFrame(false);
    }
  };

  const handleClearBakedMasks = () => {
    soundEngine.playSfx("pop");
    clearClipMasks(clipId);
    syncCutout({ mode: "auto", enabled: true });
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
      syncCutout({ enabled: true, mode });

      // Automatically run studio neural cutout for image clips or active preview
      if (mode === "auto" && !isAlreadyProcessed) {
        handleProcessActiveFrame().catch(() => {});
      }
    }
  };

  const handleProcessFrameByFrame = async () => {
    if (!selectedClip?.url || !clipId) return;
    soundEngine.playSfx("click");
    setIsProcessingFrames(true);
    setFrameProgress(0);
    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;

    const dur = selectedClip.duration || 5;
    const count = await processVideoFrameByFrame(
      selectedClip.url,
      clipId,
      dur,
      15,
      (pct, curr, total) => {
        setFrameProgress(pct);
        setProcessedFrames(curr);
        setTotalFramesToProcess(total);
      },
      abortCtrl.signal,
      true // High-accuracy IS-Net studio model
    );

    setIsProcessingFrames(false);
    if (count > 0) {
      soundEngine.playSfx("whoosh");
      syncCutout({ mode: "auto", enabled: true });
    }
  };

  const handleCancelProcessing = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    setIsProcessingFrames(false);
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
        onChange={onChange}
      />
    </View>
  );

  const renderCutoutContent = () => {
    const isAiChecked = enabled && cutoutMode === "auto";
    const isChromaChecked = enabled && cutoutMode === "chroma";

    return (
      <>
        {/* Compact Mode Selector Bar */}
        <View style={s.compactModeBar}>
          <TouchableOpacity
            style={[s.compactModeChip, isAiChecked && s.compactModeChipActive]}
            onPress={() => toggleCutoutOption("auto")}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isAiChecked }}
            accessibilityLabel="AI Cutout"
          >
            <View style={[s.compactCheckbox, isAiChecked && s.compactCheckboxActive]}>
              {isAiChecked ? <Ionicons name="checkmark" size={11} color="#08090E" /> : null}
            </View>
            <Ionicons
              name="sparkles"
              size={13}
              color={isAiChecked ? "#00F2FE" : "#94A3B8"}
            />
            <Text style={[s.compactModeLabel, isAiChecked && s.compactModeLabelActive]}>
              AI Cutout
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.compactModeChip, isChromaChecked && s.compactModeChipActive]}
            onPress={() => toggleCutoutOption("chroma")}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChromaChecked }}
            accessibilityLabel="Chroma Key"
          >
            <View style={[s.compactCheckbox, isChromaChecked && s.compactCheckboxActive]}>
              {isChromaChecked ? <Ionicons name="checkmark" size={11} color="#08090E" /> : null}
            </View>
            <Ionicons
              name="color-filter"
              size={13}
              color={isChromaChecked ? "#00F2FE" : "#94A3B8"}
            />
            <Text style={[s.compactModeLabel, isChromaChecked && s.compactModeLabelActive]}>
              Chroma Key
            </Text>
          </TouchableOpacity>
        </View>

        {!enabled ? (
          <View style={s.compactNoneBox}>
            <Ionicons name="shield-checkmark-outline" size={15} color="#00F2FE" />
            <Text style={s.compactNoneText}>
              No cutout applied — Original video background is preserved.
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
                      const isSelected = keyColor.toLowerCase() === p.color.toLowerCase();
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
                              color={p.color === "#FFFFFF" || p.color === "#00FF00" ? "#000000" : "#FFFFFF"}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={s.compactPickerTrigger}>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}
                    onPress={handleOpenEyeDropper}
                    activeOpacity={0.8}
                  >
                    <View style={[s.compactColorSwatch, { backgroundColor: keyColor }]} />
                    <Text style={s.compactHex}>{keyColor.toUpperCase()}</Text>
                    <View style={s.dropperIconBadge}>
                      <Ionicons name="eyedrop" size={12} color="#00F2FE" />
                      <Text style={s.dropperBadgeText}>Sample</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.dropperIconBadge, { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" }]}
                    onPress={handleAutoDetectBackdrop}
                    activeOpacity={0.8}
                    accessibilityLabel="Auto-detect backdrop color using Rust engine"
                  >
                    <Ionicons name="sparkles" size={12} color="#10B981" />
                    <Text style={[s.dropperBadgeText, { color: "#10B981" }]}>Auto Detect</Text>
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

                {renderSlider("Tolerance", intensity, "%", 1, 100, updateIntensity)}
                {renderSlider("Softness", shadow, "%", 0, 100, updateShadow)}
              </>
            ) : (
              <View style={s.autoCutoutPanel}>
                <View style={s.compactAiHeader}>
                  <View style={s.compactAiBadge}>
                    <Ionicons name="sparkles" size={12} color="#00F2FE" />
                    <Text style={s.compactAiBadgeText}>Studio AI (IS-Net)</Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TouchableOpacity
                      onPress={handleProcessActiveFrame}
                      style={[
                        s.compactProcessBtn,
                        {
                          backgroundColor: isProcessingActiveFrame ? "rgba(0, 242, 254, 0.2)" : "rgba(255, 255, 255, 0.08)",
                          borderWidth: 1,
                          borderColor: "rgba(0, 242, 254, 0.3)",
                        },
                      ]}
                      activeOpacity={0.8}
                      disabled={isProcessingActiveFrame}
                      accessibilityLabel="Matte current frame using studio IS-Net neural network"
                    >
                      {isProcessingActiveFrame ? (
                        <ActivityIndicator size="small" color="#00F2FE" />
                      ) : (
                        <Ionicons name="scan" size={11} color="#00F2FE" />
                      )}
                      <Text style={[s.compactProcessBtnText, { color: "#00F2FE" }]}>
                        {isProcessingActiveFrame ? "Matting..." : "Matte Frame"}
                      </Text>
                    </TouchableOpacity>

                    {isVideoClip && (
                      isProcessingFrames ? (
                        <View style={s.compactProgressInline}>
                          <ActivityIndicator size="small" color="#00F2FE" />
                          <Text style={s.compactProgressPct}>{frameProgress}%</Text>
                          <TouchableOpacity onPress={handleCancelProcessing} style={s.compactCancelBtn}>
                            <Text style={s.compactCancelText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      ) : isAlreadyProcessed ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <TouchableOpacity onPress={handleProcessFrameByFrame} style={s.compactReprocessBtn} activeOpacity={0.8}>
                            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                            <Text style={s.compactReprocessText}>Studio HD ↻</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={handleClearBakedMasks} style={[s.compactCancelBtn, { paddingHorizontal: 6 }]}>
                            <Ionicons name="trash-outline" size={11} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={handleProcessFrameByFrame} style={s.compactProcessBtn} activeOpacity={0.8}>
                          <Ionicons name="flash" size={11} color="#08090E" />
                          <Text style={s.compactProcessBtnText}>Process Video</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                {isProcessingFrames && (
                  <View style={s.progressBarTrack}>
                    <View style={[s.progressBarFill, { width: `${frameProgress}%` }]} />
                  </View>
                )}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
                  <Ionicons name="information-circle-outline" size={12} color="#64748B" />
                  <Text style={{ fontSize: 10, color: "#64748B" }}>
                    Studio IS-Net removes outdoor fences, foliage & limb gaps with zero artifacts.
                  </Text>
                </View>

                {renderSlider("Matte Threshold", intensity, "%", 1, 100, updateIntensity)}
                {renderSlider("Edge Softness", shadow, "%", 0, 100, updateShadow)}
              </View>
            )}
          </View>
        )}

        {enabled && (
          <View style={s.sectionBox}>
            <View style={s.finishSegmentRow}>
              <View style={s.finishTabGroup}>
                <TouchableOpacity
                  style={[s.finishTabBtn, finishTab === "bg" && s.finishTabBtnActive]}
                  onPress={() => setFinishTab("bg")}
                  activeOpacity={0.8}
                >
                  <Text style={[s.finishTabText, finishTab === "bg" && s.finishTabTextActive]}>Background</Text>
                  {bgColor !== "none" && <View style={s.activeDot} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.finishTabBtn, finishTab === "outline" && s.finishTabBtnActive]}
                  onPress={() => setFinishTab("outline")}
                  activeOpacity={0.8}
                >
                  <Text style={[s.finishTabText, finishTab === "outline" && s.finishTabTextActive]}>Outline</Text>
                  {strokeColor !== "none" && <View style={s.activeDot} />}
                </TouchableOpacity>
              </View>

              {(finishTab === "bg" ? bgColor !== "none" : strokeColor !== "none") && (
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
                  const isSelected = bgColor.toUpperCase() === preset.color.toUpperCase();
                  return (
                    <TouchableOpacity
                      key={preset.color}
                      style={[
                        s.colorSwatch,
                        { backgroundColor: preset.color === "none" ? "#202832" : preset.color },
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
                <TouchableOpacity
                  style={[
                    s.colorSwatch,
                    s.customSwatchBtn,
                    bgColor !== "none" && !QUICK_BG_COLORS.some((p) => p.color.toUpperCase() === bgColor.toUpperCase()) && s.colorSwatchSelected,
                  ]}
                  onPress={() => customBgInputRef.current?.click()}
                  activeOpacity={0.8}
                  accessibilityLabel="Pick custom background color"
                >
                  <Ionicons name="color-palette-outline" size={13} color="#00F2FE" />
                </TouchableOpacity>

                {Platform.OS === "web" && (
                  <WebInput
                    ref={customBgInputRef}
                    type="color"
                    value={bgColor === "none" ? "#000000" : bgColor}
                    onChange={(e: any) => updateBgColor(e.target.value)}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: 1,
                      height: 1,
                      pointerEvents: "none",
                    }}
                  />
                )}
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
                          { backgroundColor: sp.color === "none" ? "#202832" : sp.color },
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
                  <TouchableOpacity
                    style={[
                      s.colorSwatch,
                      s.customSwatchBtn,
                      strokeColor !== "none" && !QUICK_STROKE_COLORS.some((sp) => sp.color === strokeColor) && s.colorSwatchSelected,
                    ]}
                    onPress={() => customStrokeInputRef.current?.click()}
                    activeOpacity={0.8}
                    accessibilityLabel="Pick custom outline color"
                  >
                    <Ionicons name="color-palette-outline" size={13} color="#00F2FE" />
                  </TouchableOpacity>

                  {Platform.OS === "web" && (
                    <WebInput
                      ref={customStrokeInputRef}
                      type="color"
                      value={strokeColor === "none" ? "#FFFFFF" : strokeColor}
                      onChange={(e: any) => updateStrokeColor(e.target.value)}
                      style={{
                        position: "absolute",
                        opacity: 0,
                        width: 1,
                        height: 1,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </View>

                {strokeColor !== "none" && (
                  renderSlider("Outline Width", strokeWidth, "px", 1, 20, updateStrokeWidth, 1)
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
            <Ionicons name="person-remove-outline" size={16} color="#00F2FE" />
            <Text style={s.sheetTitle}>Cutout</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleReset}
              style={[s.resetBtn, { paddingHorizontal: 10, height: 26, flexDirection: 'row', alignItems: 'center' }]}
              activeOpacity={0.7}
              accessibilityLabel="Reset cutout"
            >
              <Ionicons name="refresh-outline" size={12} color="#00F2FE" style={{ marginRight: 3 }} />
              <Text style={[s.resetText, { fontSize: 11 }]}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={s.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false}>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#08090E",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  resetText: { color: "#94A3B8", fontSize: 10.5, fontWeight: "600" },
  doneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  checkboxCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
    backgroundColor: "#131826",
  },
  compactModeBar: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  compactModeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  compactModeChipActive: {
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  compactCheckbox: {
    width: 15,
    height: 15,
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: "#475569",
    backgroundColor: "#0B0E17",
    alignItems: "center",
    justifyContent: "center",
  },
  compactCheckboxActive: {
    borderColor: "#00F2FE",
    backgroundColor: "#00F2FE",
  },
  compactModeLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#94A3B8",
  },
  compactModeLabelActive: {
    color: "#FFFFFF",
  },
  compactNoneBox: {
    backgroundColor: "#131826",
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#1F2637",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  compactNoneText: {
    fontSize: 11,
    color: "#94A3B8",
    flex: 1,
  },
  sheetBody: { padding: 8 },
  sectionBox: {
    backgroundColor: "#131826",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  compactChromaHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  compactPresetGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  compactPresetSwatch: {
    width: 20,
    height: 20,
    borderRadius: 5,
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
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
    gap: 8,
    marginBottom: 4,
  },
  compactColorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#2E384D",
  },
  compactHex: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    flex: 1,
  },
  dropperIconBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
  },
  dropperBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#00F2FE",
  },
  compactAiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  compactAiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
  },
  compactAiBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#00F2FE",
  },
  compactProcessBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#00F2FE",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  compactProcessBtnText: {
    color: "#08090E",
    fontSize: 10.5,
    fontWeight: "700",
  },
  compactReprocessBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  compactReprocessText: {
    color: "#10B981",
    fontSize: 10.5,
    fontWeight: "700",
  },
  compactProgressInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compactProgressPct: {
    fontSize: 11,
    fontWeight: "700",
    color: "#00F2FE",
  },
  compactCancelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#1F2637",
  },
  compactCancelText: {
    fontSize: 9.5,
    color: "#EF4444",
    fontWeight: "700",
  },
  finishSegmentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  finishTabGroup: {
    flexDirection: "row",
    backgroundColor: "#0B0E17",
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  finishTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  finishTabBtnActive: {
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  finishTabText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#94A3B8",
  },
  finishTabTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#00F2FE",
  },
  clearBtnTouch: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  compactSwatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  customSwatchBtn: {
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
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
  clearBtn: { fontSize: 10.5, color: "#00F2FE", fontWeight: "600" },
  sliderGroup: { marginTop: 4 },
  autoCutoutPanel: {
    marginTop: 2,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "#1F2637",
    borderRadius: 2,
    overflow: "hidden",
    marginVertical: 4,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 2,
  },
});
