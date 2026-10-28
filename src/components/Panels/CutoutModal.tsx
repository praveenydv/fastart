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
} from "../../services/selfieSegmentationService";

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
  const abortCtrlRef = useRef<AbortController | null>(null);

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
      abortCtrl.signal
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
        {/* Checkbox Buttons: AI Cutout vs Chroma Key */}
        <View style={s.checkboxRow}>
          {/* AI Cutout Checkbox */}
          <TouchableOpacity
            style={[s.checkboxCard, isAiChecked && s.checkboxCardActive]}
            onPress={() => toggleCutoutOption("auto")}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isAiChecked }}
            accessibilityLabel="AI Cutout"
          >
            <View style={[s.checkboxBox, isAiChecked && s.checkboxBoxActive]}>
              {isAiChecked ? (
                <Ionicons name="checkmark" size={13} color="#08090E" />
              ) : null}
            </View>
            <View style={s.checkboxContent}>
              <View style={s.checkboxTitleRow}>
                <Ionicons
                  name="sparkles"
                  size={13}
                  color={isAiChecked ? "#00F2FE" : "#94A3B8"}
                />
                <Text
                  style={[s.checkboxTitle, isAiChecked && s.checkboxTitleActive]}
                >
                  AI Cutout
                </Text>
              </View>
              <Text style={s.checkboxSub}>Auto person removal</Text>
            </View>
          </TouchableOpacity>

          {/* Chroma Key Checkbox */}
          <TouchableOpacity
            style={[s.checkboxCard, isChromaChecked && s.checkboxCardActive]}
            onPress={() => toggleCutoutOption("chroma")}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChromaChecked }}
            accessibilityLabel="Chroma Key"
          >
            <View
              style={[s.checkboxBox, isChromaChecked && s.checkboxBoxActive]}
            >
              {isChromaChecked ? (
                <Ionicons name="checkmark" size={13} color="#08090E" />
              ) : null}
            </View>
            <View style={s.checkboxContent}>
              <View style={s.checkboxTitleRow}>
                <Ionicons
                  name="color-filter"
                  size={13}
                  color={isChromaChecked ? "#00F2FE" : "#94A3B8"}
                />
                <Text
                  style={[
                    s.checkboxTitle,
                    isChromaChecked && s.checkboxTitleActive,
                  ]}
                >
                  Chroma Key
                </Text>
              </View>
              <Text style={s.checkboxSub}>Color screen picker</Text>
            </View>
          </TouchableOpacity>
        </View>

        {!enabled ? (
          <View style={s.noneActiveCard}>
            <View style={s.noneActiveIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#64748B"
              />
            </View>
            <View style={s.noneActiveTextWrap}>
              <Text style={s.noneActiveTitle}>No Cutout Applied</Text>
              <Text style={s.noneActiveSub}>
                Original video background is retained. Select "AI Cutout" or "Chroma Key" above to remove background.
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.sectionBox}>
            {cutoutMode === "chroma" ? (
              <>
                <View style={s.dropperHeaderRow}>
                  <Text style={s.sectionHeader}>CHROMA KEY COLOR</Text>
                  <TouchableOpacity
                    style={s.dropperIconBtn}
                    onPress={handleOpenEyeDropper}
                    activeOpacity={0.8}
                    accessibilityLabel="Pick color with dropper"
                  >
                    <Ionicons name="eyedrop" size={17} color="#00F2FE" />
                  </TouchableOpacity>
                </View>

                <View style={s.dropperCard}>
                  <TouchableOpacity
                    style={s.dropperCardTouch}
                    onPress={handleOpenEyeDropper}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[s.dropperSwatchLarge, { backgroundColor: keyColor }]}
                    />
                    <View style={s.dropperInfo}>
                      <Text style={s.dropperCardTitle}>Key Color</Text>
                      <Text style={s.dropperCardHex}>
                        {keyColor.toUpperCase()}
                      </Text>
                    </View>
                    <View style={s.dropperIconPill}>
                      <Ionicons name="eyedrop" size={18} color="#00F2FE" />
                    </View>
                  </TouchableOpacity>

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
                </View>
                <Text style={s.dropperHint}>
                  Tap the eyedrop icon to sample any green screen or background color directly from the video.
                </Text>

                {renderSlider(
                  "Color tolerance",
                  intensity,
                  "%",
                  1,
                  100,
                  updateIntensity,
                )}
                {renderSlider("Edge softness", shadow, "%", 0, 100, updateShadow)}
              </>
            ) : (
              <View style={s.autoCutoutPanel}>
                <View style={s.aiBadge}>
                  <Ionicons name="sparkles" size={15} color="#00F2FE" />
                  <Text style={s.aiBadgeTitle}>Neural AI Background Removal</Text>
                </View>
                <Text style={s.autoHelperText}>
                  Automatically isolates human persons and portraits from video backgrounds frame-by-frame using real-time neural segmentation.
                </Text>

                {isVideoClip && (
                  <View style={s.frameProcessBox}>
                    <View style={s.frameProcessHeader}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Ionicons name="film-outline" size={14} color="#00F2FE" />
                        <Text style={s.frameProcessTitle}>
                          Frame-by-Frame Video Processing
                        </Text>
                      </View>
                      {isAlreadyProcessed && !isProcessingFrames && (
                        <View style={s.cachedBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color="#10B981"
                          />
                          <Text style={s.cachedBadgeText}>Pre-rendered</Text>
                        </View>
                      )}
                    </View>

                    {isProcessingFrames ? (
                      <View style={s.processingContainer}>
                        <View style={s.progressRow}>
                          <ActivityIndicator size="small" color="#00F2FE" />
                          <Text style={s.progressText}>
                            Processing frame {processedFrames}/
                            {totalFramesToProcess} ({frameProgress}%)
                          </Text>
                          <TouchableOpacity
                            style={s.cancelProcessBtn}
                            onPress={handleCancelProcessing}
                          >
                            <Text style={s.cancelProcessText}>Cancel</Text>
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
                    ) : (
                      <TouchableOpacity
                        style={s.processFramesBtn}
                        onPress={handleProcessFrameByFrame}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="scan-outline" size={16} color="#08090E" />
                        <Text style={s.processFramesBtnText}>
                          {isAlreadyProcessed
                            ? "Re-Process Video Frames"
                            : "Process Video Frame-by-Frame"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

      {enabled && (
        <View style={s.sectionBox}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text style={s.sectionHeader}>FINISH</Text>
            {bgColor !== "none" && (
              <TouchableOpacity onPress={() => updateBgColor("none")}>
                <Text style={s.clearBtn}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.subsectionLabel}>Background</Text>
          <View style={s.swatchRow}>
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
                  accessibilityLabel={`Use ${preset.label} background`}
                >
                  {preset.color === "none" && (
                    <Ionicons name="close" size={14} color="#00F2FE" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.customColorRow}>
            <Text style={s.sliderLabel}>Custom</Text>
            <View style={s.colorInputBox}>
              <View
                style={[
                  s.sampleSquare,
                  { backgroundColor: bgColor === "none" ? "#141721" : bgColor },
                ]}
              />
              {Platform.OS === "web" ? (
                <WebInput
                  type="color"
                  value={bgColor === "none" ? "#000000" : bgColor}
                  onChange={(e: any) => updateBgColor(e.target.value)}
                  style={{
                    width: 38,
                    height: 24,
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                />
              ) : null}
              <Text style={s.hexCodeText}>
                {bgColor === "none" ? "TRANSPARENT" : bgColor.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={s.finishDivider} />
          <Text style={s.subsectionLabel}>Outline</Text>
          <View style={s.swatchRow}>
            {QUICK_STROKE_COLORS.map((sp) => {
              const isSelected = strokeColor === sp.color;
              return (
                <TouchableOpacity
                  key={sp.color}
                  style={[
                    s.colorSwatch,
                    {
                      backgroundColor: sp.color === "none" ? "#202832" : sp.color,
                    },
                    sp.color === "none" && s.transparentSwatch,
                    isSelected && s.colorSwatchSelected,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    updateStrokeColor(sp.color);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel={`Use ${sp.label} outline`}
                >
                  {sp.color === "none" && (
                    <Ionicons name="close" size={14} color="#00F2FE" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {strokeColor !== "none" && (
            <>
              {renderSlider(
                "Outline width",
                strokeWidth,
                "px",
                1,
                20,
                updateStrokeWidth,
                1,
              )}
              <View style={s.customColorRow}>
                <Text style={s.sliderLabel}>Custom</Text>
                <View style={s.colorInputBox}>
                  <View
                    style={[s.sampleSquare, { backgroundColor: strokeColor }]}
                  />
                  {Platform.OS === "web" ? (
                    <WebInput
                      type="color"
                      value={strokeColor}
                      onChange={(e: any) => updateStrokeColor(e.target.value)}
                      style={{
                        width: 38,
                        height: 24,
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    />
                  ) : null}
                  <Text style={s.hexCodeText}>{strokeColor.toUpperCase()}</Text>
                </View>
              </View>
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
  checkboxCardActive: {
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#475569",
    backgroundColor: "#0B0E17",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxActive: {
    borderColor: "#00F2FE",
    backgroundColor: "#00F2FE",
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  checkboxTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#CBD5E1",
  },
  checkboxTitleActive: {
    color: "#FFFFFF",
  },
  checkboxSub: {
    fontSize: 9.5,
    color: "#64748B",
    marginTop: 2,
  },
  noneActiveCard: {
    backgroundColor: "#131826",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2637",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  noneActiveIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  noneActiveTextWrap: {
    flex: 1,
  },
  noneActiveTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  noneActiveSub: {
    fontSize: 10.5,
    color: "#64748B",
    lineHeight: 15,
  },
  sheetBody: { padding: 10 },
  sectionBox: {
    backgroundColor: "#131826",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1F2637",
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  dropperHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dropperIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderWidth: 1,
    borderColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  dropperCard: {
    backgroundColor: "#0B0E17",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
    marginBottom: 6,
    overflow: "hidden",
  },
  dropperCardTouch: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 10,
  },
  dropperSwatchLarge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#2E384D",
    alignItems: "center",
    justifyContent: "center",
  },
  dropperInfo: {
    flex: 1,
  },
  dropperCardTitle: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
  dropperCardHex: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  dropperIconPill: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  dropperHint: {
    fontSize: 10,
    color: "#64748B",
    lineHeight: 14,
    marginBottom: 8,
  },
  subsectionLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
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
  finishDivider: { height: 1, backgroundColor: "#1F2637", marginVertical: 8 },
  customColorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
    marginTop: 4,
  },
  colorInputBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  sampleSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  hexCodeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  clearBtn: { fontSize: 10.5, color: "#00F2FE", fontWeight: "600" },
  sliderGroup: { marginTop: 8 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sliderLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  sliderVal: { fontSize: 11, color: "#FFFFFF", fontWeight: "700" },
  sliderContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#1B2234",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  trackFallback: {
    flex: 1,
    height: 4,
    backgroundColor: "#1F2637",
    borderRadius: 2,
  },
  fillFallback: { height: 4, backgroundColor: "#00F2FE", borderRadius: 2 },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#131826",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  autoBadgeText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF", flex: 1 },
  helperText: {
    fontSize: 10.5,
    color: "#64748B",
    lineHeight: 15,
    marginBottom: 8,
  },
  inlineApplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#00F2FE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  inlineAppliedBtn: {
    backgroundColor: "#10B981",
  },
  inlineApplyText: {
    color: "#08090E",
    fontSize: 11,
    fontWeight: "700",
  },
  autoCutoutPanel: {
    marginTop: 4,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
    marginBottom: 6,
  },
  aiBadgeTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#00F2FE",
  },
  autoHelperText: {
    fontSize: 10.5,
    color: "#94A3B8",
    lineHeight: 15,
    marginBottom: 10,
  },
  frameProcessBox: {
    backgroundColor: "#0B0E17",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
    padding: 10,
    marginTop: 4,
  },
  frameProcessHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  frameProcessTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cachedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  cachedBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#10B981",
  },
  processingContainer: {
    marginTop: 2,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  progressText: {
    fontSize: 10.5,
    color: "#00F2FE",
    fontWeight: "600",
    flex: 1,
  },
  cancelProcessBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#1F2637",
  },
  cancelProcessText: {
    fontSize: 10,
    color: "#EF4444",
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "#1F2637",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 2,
  },
  processFramesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00F2FE",
    paddingVertical: 8,
    borderRadius: 6,
  },
  processFramesBtnText: {
    color: "#08090E",
    fontSize: 11.5,
    fontWeight: "700",
  },
});
