import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { CutoutConfig } from "../../../types/project";
import { soundEngine } from "../../../utils/audioEngine";
import { CompactSliderInput } from "../../Common/CompactSliderInput";
import { CustomColorPickerButton } from "../../Common/CustomColorPickerButton";
import { rustCoreBridge } from "../../../services/rustCoreBridge";
import { getActiveMediaElement } from "../../../utils/videoRenderer";

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHROMA_QUICK_PRESETS = [
  { label: "Green", color: "#00FF00" },
  { label: "Blue", color: "#0047FF" },
  { label: "Black", color: "#000000" },
  { label: "White", color: "#FFFFFF" },
  { label: "Magenta", color: "#FF00FF" },
];

export const BG_COLOR_PRESETS = [
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

export const STROKE_PRESETS = [
  { label: "None", color: "none" },
  { label: "White", color: "#FFFFFF" },
  { label: "Neon Cyan", color: "#00F2FE" },
  { label: "Amber Gold", color: "#FFE600" },
  { label: "Hot Pink", color: "#FF0050" },
  { label: "Emerald", color: "#10B981" },
  { label: "Purple Glow", color: "#A855F7" },
];

export const QUICK_BG_COLORS = BG_COLOR_PRESETS.slice(0, 5);
export const QUICK_STROKE_COLORS = STROKE_PRESETS.slice(0, 5);

export type CutoutMode = "none" | "chroma" | "auto";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CutoutControlsProps {
  config?: CutoutConfig;
  onChange: (config: CutoutConfig) => void;
  selectedClip?: any;
  currentTime?: number;
  isPlaying?: boolean;
  isProcessingFrames?: boolean;
  isProcessingActiveFrame?: boolean;
  frameProgress?: number;
  processedFrames?: number;
  totalFramesToProcess?: number;
  isAlreadyProcessed?: boolean;
  processedCount?: number;
  onPreviewFrame?: () => void;
  onProcessVideo?: () => void;
  onCancelProcessing?: () => void;
  onReset?: () => void;
}

export const CutoutControls: React.FC<CutoutControlsProps> = ({
  config,
  onChange,
  selectedClip,
  isPlaying = false,
  isProcessingFrames = false,
  isProcessingActiveFrame = false,
  frameProgress = 0,
  processedFrames = 0,
  totalFramesToProcess = 0,
  isAlreadyProcessed = false,
  processedCount = 0,
  onPreviewFrame,
  onProcessVideo,
  onCancelProcessing,
  onReset,
}) => {
  const enabled = config?.enabled ?? false;
  const cutoutMode: CutoutMode = !enabled ? "none" : (config?.mode ?? "chroma");
  const keyColor = config?.keyColor ?? "#00FF00";
  const intensity = config?.intensity ?? 45;
  const shadow = config?.shadow ?? 25;
  const bgColor = config?.bgColor ?? "none";
  const strokeColor = config?.strokeColor ?? "none";
  const strokeWidth = config?.strokeWidth ?? 3;

  const [finishTab, setFinishTab] = useState<"bg" | "outline">("bg");

  const isVideoClip =
    selectedClip?.type === "video" ||
    (typeof selectedClip?.url === "string" &&
      !selectedClip.url.endsWith(".png") &&
      !selectedClip.url.endsWith(".jpg") &&
      !selectedClip.url.endsWith(".jpeg") &&
      !selectedClip.url.endsWith(".webp"));

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleModeChange = (mode: CutoutMode) => {
    soundEngine.playSfx("click");
    if (mode === "none") {
      onChange({
        ...config,
        enabled: false,
        mode: "chroma",
      });
    } else {
      onChange({
        ...config,
        enabled: true,
        mode,
      });
      if (onPreviewFrame && !isPlaying) {
        onPreviewFrame();
      }
    }
  };

  const handleOpenEyeDropper = async () => {
    soundEngine.playSfx("click");
    if (typeof window !== "undefined" && (window as any).EyeDropper) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          onChange({
            ...config,
            enabled: true,
            mode: "chroma",
            keyColor: result.sRGBHex,
          });
        }
      } catch {}
    }
  };

  const handleAutoDetectBackdrop = () => {
    soundEngine.playSfx("click");
    try {
      const activeMedia = getActiveMediaElement(selectedClip?.id || selectedClip?.url || "");
      if (activeMedia) {
        let canvas: HTMLCanvasElement | null = null;
        let ctx: CanvasRenderingContext2D | null = null;

        if (typeof document !== "undefined") {
          canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          ctx = canvas.getContext("2d");
        }

        if (ctx && canvas) {
          ctx.drawImage(activeMedia as any, 0, 0, 64, 64);
          const imgData = ctx.getImageData(0, 0, 64, 64);
          // Backend Rust calculation for backdrop detection
          const detected = rustCoreBridge.detectUniformBackdrop(imgData.data, 64, 64);
          if (detected?.hex) {
            onChange({
              ...config,
              enabled: true,
              mode: "chroma",
              keyColor: detected.hex,
            });
            if (onPreviewFrame && !isPlaying) onPreviewFrame();
            return;
          }
        }
      }
    } catch {}

    // Fallback to vibrant green
    onChange({
      ...config,
      enabled: true,
      mode: "chroma",
      keyColor: "#00FF00",
    });
    if (onPreviewFrame && !isPlaying) onPreviewFrame();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={sc.container}>
      {/* Sleek Segmented Mode Switcher */}
      <View style={sc.modeSegmentedBar}>
        <TouchableOpacity
          style={[sc.modeSegmentItem, cutoutMode === "none" && sc.modeSegmentItemActive]}
          onPress={() => handleModeChange("none")}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: cutoutMode === "none" }}
        >
          <Ionicons
            name="close-circle-outline"
            size={13}
            color={cutoutMode === "none" ? "#00F2FE" : "#94A3B8"}
          />
          <Text style={[sc.modeSegmentText, cutoutMode === "none" && sc.modeSegmentTextActive]}>
            None
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sc.modeSegmentItem, cutoutMode === "auto" && sc.modeSegmentItemActive]}
          onPress={() => handleModeChange("auto")}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: cutoutMode === "auto" }}
        >
          <Ionicons
            name="sparkles"
            size={13}
            color={cutoutMode === "auto" ? "#00F2FE" : "#94A3B8"}
          />
          <Text style={[sc.modeSegmentText, cutoutMode === "auto" && sc.modeSegmentTextActive]}>
            Auto Cutout
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sc.modeSegmentItem, cutoutMode === "chroma" && sc.modeSegmentItemActive]}
          onPress={() => handleModeChange("chroma")}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: cutoutMode === "chroma" }}
        >
          <Ionicons
            name="color-filter"
            size={13}
            color={cutoutMode === "chroma" ? "#00F2FE" : "#94A3B8"}
          />
          <Text style={[sc.modeSegmentText, cutoutMode === "chroma" && sc.modeSegmentTextActive]}>
            Chroma Key
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode Content */}
      {cutoutMode === "none" ? (
        <View style={sc.compactNoneBox}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#00F2FE" />
          <Text style={sc.compactNoneText}>
            Original video background is preserved. Select Auto Cutout or Chroma Key above to remove background.
          </Text>
        </View>
      ) : (
        <View style={sc.sectionBox}>
          {cutoutMode === "chroma" ? (
            <>
              {/* Screen Color Row */}
              <View style={sc.compactChromaHeaderRow}>
                <Text style={sc.sectionHeader}>SCREEN COLOR</Text>
                <View style={sc.compactPresetGroup}>
                  {CHROMA_QUICK_PRESETS.map((p) => {
                    const isSelected = keyColor.toLowerCase() === p.color.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={p.color}
                        style={[
                          sc.compactPresetSwatch,
                          { backgroundColor: p.color },
                          isSelected && sc.compactPresetSwatchSelected,
                        ]}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          onChange({ ...config, enabled: true, mode: "chroma", keyColor: p.color });
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
                  <CustomColorPickerButton
                    value={keyColor}
                    presets={CHROMA_QUICK_PRESETS}
                    onColorChange={(c) => onChange({ ...config, enabled: true, mode: "chroma", keyColor: c })}
                    size={18}
                    shape="square"
                    accessibilityLabel="Pick custom screen color"
                  />
                </View>
              </View>

              {/* Sampler & Auto-detect bar */}
              <View style={sc.compactPickerTrigger}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}
                  onPress={handleOpenEyeDropper}
                  activeOpacity={0.8}
                >
                  <View style={[sc.compactColorSwatch, { backgroundColor: keyColor }]} />
                  <Text style={sc.compactHex}>{keyColor.toUpperCase()}</Text>
                  <View style={sc.dropperIconBadge}>
                    <Ionicons name="eyedrop" size={12} color="#00F2FE" />
                    <Text style={sc.dropperBadgeText}>Sample</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    sc.dropperIconBadge,
                    { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" },
                  ]}
                  onPress={handleAutoDetectBackdrop}
                  activeOpacity={0.8}
                  accessibilityLabel="Auto-detect backdrop color"
                >
                  <Ionicons name="sparkles" size={12} color="#10B981" />
                  <Text style={[sc.dropperBadgeText, { color: "#10B981" }]}>Auto Detect</Text>
                </TouchableOpacity>
              </View>

              {/* Sliders */}
              <View style={sc.sliderRow}>
                <Text style={sc.sliderLabel}>Tolerance</Text>
                <View style={sc.sliderWrapper}>
                  <CompactSliderInput
                    label=""
                    value={intensity}
                    unit="%"
                    min={1}
                    max={100}
                    step={1}
                    onChange={(v) => onChange({ ...config, enabled: true, mode: "chroma", intensity: v })}
                  />
                </View>
              </View>

              <View style={sc.sliderRow}>
                <Text style={sc.sliderLabel}>Softness</Text>
                <View style={sc.sliderWrapper}>
                  <CompactSliderInput
                    label=""
                    value={shadow}
                    unit="%"
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => onChange({ ...config, enabled: true, mode: "chroma", shadow: v })}
                  />
                </View>
              </View>
            </>
          ) : (
            <View style={sc.autoCutoutPanel}>
              {/* Header Status Bar */}
              <View style={sc.compactAiHeader}>
                <View style={sc.compactAiBadge}>
                  <Ionicons name="sparkles" size={12} color="#00F2FE" />
                  <Text style={sc.compactAiBadgeText}>Auto Cutout</Text>
                </View>

                {isProcessingFrames ? (
                  <View style={sc.statusPillProcessing}>
                    <ActivityIndicator size="small" color="#00F2FE" style={{ transform: [{ scale: 0.65 }] }} />
                    <Text style={sc.statusPillTextProcessing}>{frameProgress}%</Text>
                  </View>
                ) : isAlreadyProcessed ? (
                  <View style={sc.statusPillSuccess}>
                    <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                    <Text style={sc.statusPillTextSuccess}>{processedCount} frames removed</Text>
                  </View>
                ) : enabled ? (
                  <View style={sc.statusPillSuccess}>
                    <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                    <Text style={sc.statusPillTextSuccess}>Cutout Active</Text>
                  </View>
                ) : (
                  <Text style={sc.statusPillMuted}>Ready to preview</Text>
                )}
              </View>

              {/* Active Processing Banner */}
              {isProcessingFrames && (
                <View style={sc.compactProcessingBanner}>
                  <View style={sc.compactProcessingHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <ActivityIndicator size="small" color="#00F2FE" />
                      <Text style={sc.compactProgressPct} numberOfLines={1}>
                        Removing background... {frameProgress}% ({processedFrames}/{totalFramesToProcess})
                      </Text>
                    </View>
                    {onCancelProcessing && (
                      <TouchableOpacity onPress={onCancelProcessing} style={sc.compactCancelBtn}>
                        <Text style={sc.compactCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={sc.progressBarTrack}>
                    <View style={[sc.progressBarFill, { width: `${frameProgress}%` }]} />
                  </View>
                </View>
              )}

              {/* Main Action Controls */}
              {!isProcessingFrames && (
                <View style={sc.actionsContainer}>
                  <View style={{ gap: 8 }}>
                    {isVideoClip && onProcessVideo && (
                      <TouchableOpacity onPress={onProcessVideo} style={sc.heroBtn} activeOpacity={0.8}>
                        <Ionicons name={isAlreadyProcessed ? "refresh" : "sparkles"} size={14} color="#08090E" />
                        <Text style={sc.heroBtnText}>
                          {isAlreadyProcessed ? "Reprocess Video" : "Remove Background (Full Video)"}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      {onPreviewFrame && (
                        <TouchableOpacity
                          onPress={onPreviewFrame}
                          style={[sc.secondaryActionBtn, { flex: 1.2 }]}
                          activeOpacity={0.8}
                          disabled={isProcessingActiveFrame}
                        >
                          {isProcessingActiveFrame ? (
                            <ActivityIndicator size="small" color="#00F2FE" />
                          ) : (
                            <Ionicons name="eye-outline" size={14} color="#00F2FE" />
                          )}
                          <Text style={[sc.secondaryActionText, { color: "#00F2FE" }]} numberOfLines={1}>
                            {isProcessingActiveFrame ? "Processing..." : "Preview Frame"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {onReset && (
                        <TouchableOpacity
                          onPress={onReset}
                          style={[sc.secondaryActionBtn, { flex: 0.8, borderColor: "rgba(148, 163, 184, 0.25)" }]}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="reload-outline" size={13} color="#94A3B8" />
                          <Text style={[sc.secondaryActionText, { color: "#94A3B8" }]} numberOfLines={1}>
                            Reset Cutout
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Sliders */}
                  <View style={{ marginTop: 6 }}>
                    <View style={sc.sliderRow}>
                      <Text style={sc.sliderLabel}>Cutout Threshold</Text>
                      <View style={sc.sliderWrapper}>
                        <CompactSliderInput
                          label=""
                          value={intensity}
                          unit="%"
                          min={1}
                          max={100}
                          step={1}
                          onChange={(v) => onChange({ ...config, enabled: true, mode: "auto", intensity: v })}
                        />
                      </View>
                    </View>

                    <View style={sc.sliderRow}>
                      <Text style={sc.sliderLabel}>Edge Softness</Text>
                      <View style={sc.sliderWrapper}>
                        <CompactSliderInput
                          label=""
                          value={shadow}
                          unit="%"
                          min={0}
                          max={100}
                          step={1}
                          onChange={(v) => onChange({ ...config, enabled: true, mode: "auto", shadow: v })}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Finish Segment: Background & Outline */}
      {cutoutMode !== "none" && (
        <View style={sc.sectionBox}>
          <View style={sc.finishSegmentRow}>
            <View style={sc.finishTabGroup}>
              <TouchableOpacity
                style={[sc.finishTabBtn, finishTab === "bg" && sc.finishTabBtnActive]}
                onPress={() => setFinishTab("bg")}
                activeOpacity={0.8}
              >
                <Text style={[sc.finishTabText, finishTab === "bg" && sc.finishTabTextActive]}>
                  Background
                </Text>
                {bgColor !== "none" && <View style={sc.activeDot} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[sc.finishTabBtn, finishTab === "outline" && sc.finishTabBtnActive]}
                onPress={() => setFinishTab("outline")}
                activeOpacity={0.8}
              >
                <Text style={[sc.finishTabText, finishTab === "outline" && sc.finishTabTextActive]}>
                  Outline
                </Text>
                {strokeColor !== "none" && <View style={sc.activeDot} />}
              </TouchableOpacity>
            </View>

            {(finishTab === "bg" ? bgColor !== "none" : strokeColor !== "none") && (
              <TouchableOpacity
                onPress={() => {
                  if (finishTab === "bg") onChange({ ...config, bgColor: "none" });
                  else onChange({ ...config, strokeColor: "none" });
                }}
                style={sc.clearBtnTouch}
              >
                <Text style={sc.clearBtn}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          {finishTab === "bg" ? (
            <View style={sc.compactSwatchRow}>
              {QUICK_BG_COLORS.map((preset) => {
                const isSelected = bgColor.toUpperCase() === preset.color.toUpperCase();
                return (
                  <TouchableOpacity
                    key={preset.color}
                    style={[
                      sc.colorSwatch,
                      { backgroundColor: preset.color === "none" ? "#202832" : preset.color },
                      preset.color === "none" && sc.transparentSwatch,
                      isSelected && sc.colorSwatchSelected,
                    ]}
                    onPress={() => onChange({ ...config, bgColor: preset.color })}
                    activeOpacity={0.8}
                    accessibilityLabel={preset.label}
                  >
                    {preset.color === "none" && <Ionicons name="close" size={13} color="#00F2FE" />}
                  </TouchableOpacity>
                );
              })}
              <CustomColorPickerButton
                value={bgColor}
                presets={QUICK_BG_COLORS}
                onColorChange={(c) => onChange({ ...config, bgColor: c })}
                size={24}
                shape="square"
                accessibilityLabel="Pick custom background color"
              />
            </View>
          ) : (
            <>
              <View style={sc.compactSwatchRow}>
                {QUICK_STROKE_COLORS.map((sp) => {
                  const isSelected = strokeColor === sp.color;
                  return (
                    <TouchableOpacity
                      key={sp.color}
                      style={[
                        sc.colorSwatch,
                        { backgroundColor: sp.color === "none" ? "#202832" : sp.color },
                        sp.color === "none" && sc.transparentSwatch,
                        isSelected && sc.colorSwatchSelected,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx("click");
                        onChange({ ...config, strokeColor: sp.color });
                      }}
                      activeOpacity={0.8}
                      accessibilityLabel={sp.label}
                    >
                      {sp.color === "none" && <Ionicons name="close" size={13} color="#00F2FE" />}
                    </TouchableOpacity>
                  );
                })}
                <CustomColorPickerButton
                  value={strokeColor}
                  presets={QUICK_STROKE_COLORS}
                  onColorChange={(c) => onChange({ ...config, strokeColor: c })}
                  size={24}
                  shape="square"
                  accessibilityLabel="Pick custom outline color"
                />
              </View>

              {strokeColor !== "none" && (
                <View style={sc.sliderRow}>
                  <Text style={sc.sliderLabel}>Outline Width</Text>
                  <View style={sc.sliderWrapper}>
                    <CompactSliderInput
                      label=""
                      value={strokeWidth}
                      unit="px"
                      min={1}
                      max={20}
                      step={1}
                      onChange={(w) => onChange({ ...config, strokeWidth: w })}
                    />
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  container: {
    width: "100%",
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
    borderRadius: 5,
  },
  modeSegmentItemActive: {
    backgroundColor: "#161D2E",
  },
  modeSegmentText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94A3B8",
  },
  modeSegmentTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  compactNoneBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F1420",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 6,
  },
  compactNoneText: {
    fontSize: 9.5,
    color: "#94A3B8",
    flex: 1,
    lineHeight: 13,
  },
  sectionBox: {
    backgroundColor: "#0F1420",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  compactChromaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  compactPresetGroup: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  compactPresetSwatch: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  compactPresetSwatchSelected: {
    borderColor: "#00F2FE",
    transform: [{ scale: 1.1 }],
  },
  compactPickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0A0D15",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 6,
  },
  compactColorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  compactHex: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  dropperIconBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
  },
  dropperBadgeText: {
    fontSize: 8.5,
    fontWeight: "600",
    color: "#00F2FE",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 9.5,
    fontWeight: "500",
    color: "#94A3B8",
    flex: 1,
  },
  sliderWrapper: {
    flex: 1.8,
  },
  autoCutoutPanel: {
    gap: 6,
  },
  compactAiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactAiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactAiBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#00F2FE",
  },
  statusPillProcessing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.3)",
  },
  statusPillTextProcessing: {
    fontSize: 9,
    fontWeight: "700",
    color: "#00F2FE",
  },
  statusPillSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusPillTextSuccess: {
    fontSize: 9,
    fontWeight: "600",
    color: "#10B981",
  },
  statusPillMuted: {
    fontSize: 9,
    color: "#64748B",
  },
  compactProcessingBanner: {
    backgroundColor: "#0A0D15",
    padding: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#1E2638",
    gap: 4,
  },
  compactProcessingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactProgressPct: {
    fontSize: 9,
    color: "#00F2FE",
    fontWeight: "600",
  },
  compactCancelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  compactCancelText: {
    fontSize: 8.5,
    fontWeight: "600",
    color: "#EF4444",
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: "#161D2E",
    borderRadius: 1.5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 1.5,
  },
  actionsContainer: {
    gap: 6,
  },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00F2FE",
    paddingVertical: 6,
    borderRadius: 5,
  },
  heroBtnText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#08090E",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#131826",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.3)",
  },
  secondaryActionText: {
    fontSize: 9.5,
    fontWeight: "600",
  },
  finishSegmentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  finishTabGroup: {
    flexDirection: "row",
    backgroundColor: "#0A0D15",
    borderRadius: 4,
    padding: 1.5,
    gap: 2,
  },
  finishTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  finishTabBtnActive: {
    backgroundColor: "#161D2E",
  },
  finishTabText: {
    fontSize: 9,
    fontWeight: "500",
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
    paddingHorizontal: 4,
  },
  clearBtn: {
    fontSize: 9,
    color: "#94A3B8",
  },
  compactSwatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    borderColor: "#00F2FE",
    borderWidth: 1.5,
    transform: [{ scale: 1.08 }],
  },
  transparentSwatch: {
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.3)",
  },
});
