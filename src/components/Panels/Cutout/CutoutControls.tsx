import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { CutoutConfig } from "../../../types/project";
import { CompactSliderInput } from "../../Common/CompactSliderInput";
import { CustomColorPickerButton } from "../../Common/CustomColorPickerButton";
import { SegmentedPillTabs } from "../../Common/SegmentedPillTabs";
import { rustCoreBridge } from "../../../services/rustCoreBridge";
import { getActiveMediaElement } from "../../../utils/videoRenderer";
import { CutoutColorDropperModal } from "./CutoutColorDropperModal";
import {
  CHROMA_QUICK_PRESETS,
  BG_COLOR_PRESETS,
  STROKE_PRESETS,
  QUICK_BG_COLORS,
  QUICK_STROKE_COLORS,
  CutoutMode,
  CUTOUT_TABS,
} from "./CutoutConstants";

export {
  CHROMA_QUICK_PRESETS,
  BG_COLOR_PRESETS,
  STROKE_PRESETS,
  QUICK_BG_COLORS,
  QUICK_STROKE_COLORS,
  CUTOUT_TABS,
};
export type { CutoutMode };

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
  errorMessage?: string | null;
  onPreviewFrame?: () => void;
  onProcessVideo?: () => void;
  onCancelProcessing?: () => void;
  onReset?: () => void;
}

const CutoutControlsComponent: React.FC<CutoutControlsProps> = ({
  config,
  onChange,
  selectedClip,
  currentTime = 0,
  isProcessingFrames = false,
  isProcessingActiveFrame = false,
  frameProgress = 0,
  processedFrames = 0,
  totalFramesToProcess = 0,
  isAlreadyProcessed = false,
  processedCount = 0,
  errorMessage,
  onPreviewFrame,
  onProcessVideo,
  onCancelProcessing,
  onReset,
}) => {
  const enabled = Boolean(config?.enabled && config?.mode && config.mode !== "none");
  const [selectedTab, setSelectedTab] = useState<CutoutMode>(
    config?.mode ? config.mode : (enabled ? "auto" : "none")
  );

  React.useEffect(() => {
    if (config?.mode && config.mode !== selectedTab) {
      if (isProcessingFrames && config.mode === "none") return;
      setSelectedTab(config.mode);
    }
  }, [config?.mode, isProcessingFrames]);

  const keyColor = config?.keyColor ?? "#00FF00";
  const intensity = config?.intensity ?? 45;
  const shadow = config?.shadow ?? 25;
  const bgColor = config?.bgColor ?? "none";
  const strokeColor = config?.strokeColor ?? "none";
  const strokeWidth = config?.strokeWidth ?? 3;
  const quality = config?.quality ?? "best";

  const [finishTab, setFinishTab] = useState<"bg" | "outline">("bg");
  const [isDropperModalOpen, setIsDropperModalOpen] = useState(false);

  const isVideoClip =
    selectedClip?.type === "video" ||
    (typeof selectedClip?.url === "string" &&
      !selectedClip.url.endsWith(".png") &&
      !selectedClip.url.endsWith(".jpg") &&
      !selectedClip.url.endsWith(".jpeg") &&
      !selectedClip.url.endsWith(".webp"));

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleModeChange = (mode: CutoutMode) => {
    setSelectedTab(mode);
    if (mode === "none") {
      onChange({
        ...config,
        enabled: false,
        mode: "none",
      });
    } else if (mode === "chroma") {
      onChange({
        ...config,
        enabled: true,
        mode: "chroma",
      });
    } else {
      onChange({
        ...config,
        enabled: true,
        mode: "auto",
        quality: config.quality || "best",
      });
    }
  };

  const handleOpenEyeDropper = () => {
    // If running in browser with fine pointer (desktop mouse), use native browser EyeDropper API
    if (
      typeof window !== "undefined" &&
      (window as any).EyeDropper &&
      window.matchMedia?.("(pointer: fine)").matches
    ) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        eyeDropper
          .open()
          .then((result: any) => {
            if (result && result.sRGBHex) {
              onChange({
                ...config,
                enabled: true,
                mode: "chroma",
                keyColor: result.sRGBHex,
              });
            }
          })
          .catch(() => {
            setIsDropperModalOpen(true);
          });
        return;
      } catch {}
    }

    // On mobile touch screens, open the interactive mobile screen dropper with magnified loupe
    setIsDropperModalOpen(true);
  };

  const handleAutoDetectBackdrop = async () => {
    try {
      const clipUrl = selectedClip?.url || selectedClip?.thumbnail || "";
      const detected = await rustCoreBridge.detectBackdropColor(clipUrl, selectedClip?.startTime ?? 0);
      if (detected) {
        onChange({
          ...config,
          enabled: true,
          mode: "chroma",
          keyColor: detected,
        });
        return;
      }
    } catch {}

    // Fallback to active media element on web if available
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
          const detected = rustCoreBridge.detectUniformBackdrop(imgData.data, 64, 64);
          if (detected?.hex) {
            onChange({
              ...config,
              enabled: true,
              mode: "chroma",
              keyColor: detected.hex,
            });
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
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={sc.container}>
      {/* Sleek Segmented Mode Switcher */}
      <SegmentedPillTabs
        tabs={CUTOUT_TABS}
        activeTab={selectedTab}
        onTabChange={handleModeChange}
        containerStyle={{ marginBottom: 12 }}
      />

      {errorMessage ? (
        <Text accessibilityRole="alert" style={{ color: "#FCA5A5", fontSize: 12, lineHeight: 17 }}>
          {errorMessage}
        </Text>
      ) : null}

      {/* Mode Content */}
      {selectedTab === "none" ? (
        <View style={sc.compactNoneBox}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#EDEDED" />
          <Text style={sc.compactNoneText}>
            Original video background is preserved. Select Auto Cutout or Chroma Key above to remove background.
          </Text>
        </View>
      ) : (
        <View style={sc.sectionBox}>
          {selectedTab === "chroma" ? (
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
                    onPickFromScreen={() => setIsDropperModalOpen(true)}
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
                    <Ionicons name="eyedrop" size={12} color="#EDEDED" />
                    <Text style={sc.dropperBadgeText}>Sample Screen</Text>
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
              <View style={{ gap: 8, marginTop: 6 }}>
                <CompactSliderInput
                  label="Tolerance"
                  value={intensity}
                  unit="%"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => onChange({ ...config, enabled: true, mode: "chroma", intensity: v })}
                />
                <CompactSliderInput
                  label="Softness"
                  value={shadow}
                  unit="%"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => onChange({ ...config, enabled: true, mode: "chroma", shadow: v })}
                />
              </View>
            </>
          ) : (
            <View style={sc.autoCutoutPanel}>
              {/* Active Processing Banner */}
              {isProcessingFrames && (
                <View style={sc.compactProcessingBanner}>
                  <View style={sc.compactProcessingHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
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
                  {/* Status Banner when already processed */}
                  {isAlreadyProcessed && (
                    <View style={sc.processedSuccessCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <View style={{ flex: 1 }}>
                          <Text style={sc.processedSuccessTitle}>
                            {isVideoClip ? "Background Removed (100%)" : "AI Background Removed"}
                          </Text>
                          {isVideoClip && processedCount > 0 && (
                            <Text style={sc.processedSuccessSubtext}>
                              {processedCount} frames baked • {quality === "fast" ? "Draft (~10 FPS)" : quality === "studio" ? "Smooth (~30 FPS)" : "Locked 60 FPS"}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  <View style={{ gap: 8 }}>
                    {isVideoClip && (
                      <View style={{ marginTop: 2, marginBottom: 4 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <Text style={sc.sectionHeader}>PROCESSING QUALITY</Text>
                          <Text style={{ fontSize: 10, color: "#EDEDED", fontWeight: "500" }}>
                            {quality === "best" ? "Every Frame (60 FPS)" : quality === "studio" ? "Smooth (~30 FPS)" : "Draft (~10 FPS)"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {[
                            { id: "fast" as const, label: "Draft", sublabel: "~10 FPS" },
                            { id: "studio" as const, label: "Smooth", sublabel: "~30 FPS" },
                            { id: "best" as const, label: "Best", sublabel: "Every Frame" },
                          ].map((opt) => {
                            const isSel = quality === opt.id;
                            return (
                              <TouchableOpacity
                                key={opt.id}
                                style={[
                                  sc.qualityTabBtn,
                                  isSel && sc.qualityTabBtnSelected,
                                ]}
                                onPress={() => {
                                  onChange({ ...config, enabled: true, mode: "auto", quality: opt.id });
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={[sc.qualityTabLabel, isSel && sc.qualityTabLabelSelected]}>
                                  {opt.label}
                                </Text>
                                <Text style={[sc.qualityTabSublabel, isSel && sc.qualityTabSublabelSelected]}>
                                  {opt.sublabel}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Edge Smoothness */}
                    <View style={{ marginTop: 6, marginBottom: 8 }}>
                      <CompactSliderInput
                        label="Smoothness"
                        value={shadow}
                        unit="%"
                        min={0}
                        max={100}
                        step={1}
                        onChange={(v) => onChange({ ...config, enabled: true, mode: "auto", shadow: v })}
                      />
                    </View>

                    {(!isAlreadyProcessed || isVideoClip) && (
                      <TouchableOpacity
                        onPress={() => {
                          if (isVideoClip) {
                            onProcessVideo?.();
                          } else if (onProcessVideo) {
                            onProcessVideo();
                          } else {
                            onPreviewFrame?.();
                          }
                        }}
                        style={[
                          sc.heroBtn,
                          isAlreadyProcessed && sc.heroBtnSecondary,
                        ]}
                        activeOpacity={0.8}
                        disabled={isProcessingActiveFrame}
                      >
                        {isProcessingActiveFrame ? (
                          <ActivityIndicator size="small" color={isAlreadyProcessed ? "#00F2FE" : "#08090E"} />
                        ) : (
                          <Ionicons
                            name={isAlreadyProcessed ? "refresh" : "sparkles"}
                            size={14}
                            color={isAlreadyProcessed ? "#EDEDED" : "#08090E"}
                          />
                        )}
                        <Text style={[sc.heroBtnText, isAlreadyProcessed && sc.heroBtnSecondaryText]}>
                          {isProcessingActiveFrame
                            ? "Processing Frame..."
                            : isAlreadyProcessed
                            ? "Reprocess Video"
                            : isVideoClip
                            ? "Remove Background"
                            : "Remove Photo Background"}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      {isVideoClip && onPreviewFrame && (
                        <TouchableOpacity
                          onPress={onPreviewFrame}
                          style={[sc.secondaryActionBtn, { flex: 1.2 }]}
                          activeOpacity={0.8}
                          disabled={isProcessingActiveFrame || isProcessingFrames}
                        >
                          {isProcessingActiveFrame ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Ionicons name="eye-outline" size={14} color="#EDEDED" />
                          )}
                          <Text style={[sc.secondaryActionText, { color: "#EDEDED" }]} numberOfLines={1}>
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
                            Reset
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Background & Outline Styling */}
      {selectedTab !== "none" && enabled && (
        <View style={sc.stylingBox}>
          {/* Header Switcher */}
          <View style={sc.stylingHeaderRow}>
            <View style={sc.stylingTabGroup}>
              <TouchableOpacity
                style={[sc.stylingTabBtn, finishTab === "bg" && sc.stylingTabBtnActive]}
                onPress={() => setFinishTab("bg")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="color-palette-outline"
                  size={12}
                  color={finishTab === "bg" ? "#FFFFFF" : "#8E8E93"}
                />
                <Text style={[sc.stylingTabText, finishTab === "bg" && sc.stylingTabTextActive]}>
                  Background
                </Text>
                {bgColor !== "none" && <View style={[sc.activeDot, { backgroundColor: "#FFFFFF" }]} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[sc.stylingTabBtn, finishTab === "outline" && sc.stylingTabBtnActive]}
                onPress={() => setFinishTab("outline")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="brush-outline"
                  size={12}
                  color={finishTab === "outline" ? "#FFFFFF" : "#8E8E93"}
                />
                <Text style={[sc.stylingTabText, finishTab === "outline" && sc.stylingTabTextActive]}>
                  Outline
                </Text>
                {strokeColor !== "none" && <View style={[sc.activeDot, { backgroundColor: "#FFFFFF" }]} />}
              </TouchableOpacity>
            </View>

            {(finishTab === "bg" ? bgColor !== "none" : strokeColor !== "none") && (
              <TouchableOpacity
                onPress={() => {
                  if (finishTab === "bg") onChange({ ...config, bgColor: "none" });
                  else onChange({ ...config, strokeColor: "none" });
                }}
                style={sc.resetStylingBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={12} color="#00F2FE" />
                <Text style={sc.resetStylingText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tab Content: Background */}
          {finishTab === "bg" ? (
            <View style={sc.paletteContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={sc.swatchScrollContent}
              >
                {/* Transparent Option */}
                <TouchableOpacity
                  style={[
                    sc.paletteSwatch,
                    sc.transparentSwatch,
                    bgColor === "none" && sc.paletteSwatchSelected,
                  ]}
                  onPress={() => onChange({ ...config, bgColor: "none" })}
                  activeOpacity={0.8}
                  accessibilityLabel="Transparent background"
                >
                  <Ionicons
                    name="ban-outline"
                    size={14}
                    color={bgColor === "none" ? "#FFFFFF" : "#71717A"}
                  />
                </TouchableOpacity>

                {/* Color Presets */}
                {BG_COLOR_PRESETS.filter((p) => p.color !== "none").map((preset) => {
                  const isSelected = bgColor.toUpperCase() === preset.color.toUpperCase();
                  const isLight = preset.color === "#FFFFFF" || preset.color === "#FFE600" || preset.color === "#00F2FE";
                  return (
                    <TouchableOpacity
                      key={preset.color}
                      style={[
                        sc.paletteSwatch,
                        { backgroundColor: preset.color },
                        isSelected && sc.paletteSwatchSelected,
                      ]}
                      onPress={() => onChange({ ...config, bgColor: preset.color })}
                      activeOpacity={0.8}
                      accessibilityLabel={preset.label}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color={isLight ? "#000000" : "#FFFFFF"}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Custom Color Picker Button */}
                <CustomColorPickerButton
                  value={bgColor}
                  presets={BG_COLOR_PRESETS}
                  onColorChange={(c) => onChange({ ...config, bgColor: c })}
                  size={32}
                  shape="square"
                  accessibilityLabel="Pick custom background color"
                />
              </ScrollView>
            </View>
          ) : (
            /* Tab Content: Outline */
            <View style={sc.paletteContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={sc.swatchScrollContent}
              >
                {/* None Option */}
                <TouchableOpacity
                  style={[
                    sc.paletteSwatch,
                    sc.transparentSwatch,
                    strokeColor === "none" && sc.paletteSwatchSelected,
                  ]}
                  onPress={() => onChange({ ...config, strokeColor: "none" })}
                  activeOpacity={0.8}
                  accessibilityLabel="No outline stroke"
                >
                  <Ionicons
                    name="ban-outline"
                    size={14}
                    color={strokeColor === "none" ? "#FFFFFF" : "#71717A"}
                  />
                </TouchableOpacity>

                {/* Stroke Color Presets */}
                {STROKE_PRESETS.filter((p) => p.color !== "none").map((sp) => {
                  const isSelected = strokeColor.toUpperCase() === sp.color.toUpperCase();
                  const isLight = sp.color === "#FFFFFF" || sp.color === "#FFE600" || sp.color === "#00F2FE";
                  return (
                    <TouchableOpacity
                      key={sp.color}
                      style={[
                        sc.paletteSwatch,
                        { backgroundColor: sp.color },
                        isSelected && sc.paletteSwatchSelected,
                      ]}
                      onPress={() => onChange({ ...config, strokeColor: sp.color })}
                      activeOpacity={0.8}
                      accessibilityLabel={sp.label}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color={isLight ? "#000000" : "#FFFFFF"}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Custom Color Picker Button */}
                <CustomColorPickerButton
                  value={strokeColor}
                  presets={STROKE_PRESETS}
                  onColorChange={(c) => onChange({ ...config, strokeColor: c })}
                  size={32}
                  shape="square"
                  accessibilityLabel="Pick custom outline color"
                />
              </ScrollView>

              {/* Stroke Width Controls (Only if outline active) */}
              {strokeColor !== "none" && (
                <View style={sc.outlineControlsSection}>
                  {/* Quick Preset Thickness Pills */}
                  <View style={sc.thicknessPillRow}>
                    {[
                      { label: "Thin", width: 2 },
                      { label: "Medium", width: 5 },
                      { label: "Bold", width: 10 },
                      { label: "Ultra", width: 16 },
                    ].map((item) => {
                      const isSelected = strokeWidth === item.width;
                      return (
                        <TouchableOpacity
                          key={item.label}
                          style={[
                            sc.thicknessPill,
                            isSelected && sc.thicknessPillActive,
                          ]}
                          onPress={() => onChange({ ...config, strokeWidth: item.width })}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              sc.thicknessPillText,
                              isSelected && sc.thicknessPillTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Width Slider (Clean stacked layout: title on row 1, full-width slider on row 2) */}
                  <View style={{ marginTop: 8 }}>
                    <CompactSliderInput
                      label="Stroke Width"
                      value={strokeWidth}
                      unit="px"
                      min={1}
                      max={24}
                      step={1}
                      onChange={(w) => onChange({ ...config, strokeWidth: w })}
                    />
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Interactive Mobile Screen Color Dropper Modal with Loupe */}
      <CutoutColorDropperModal
        visible={isDropperModalOpen}
        onClose={() => setIsDropperModalOpen(false)}
        initialColor={keyColor}
        selectedClip={selectedClip}
        currentTime={currentTime}
        onSelectColor={(hex) => {
          onChange({
            ...config,
            enabled: true,
            mode: "chroma",
            keyColor: hex,
          });
        }}
      />
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
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  modeSegmentText: {
    fontSize: 10,
    fontWeight: "400",
    color: "#8E8E93",
  },
  modeSegmentTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  compactNoneBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#18181A",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 6,
  },
  compactNoneText: {
    fontSize: 9.5,
    color: "#8E8E93",
    flex: 1,
    lineHeight: 13,
  },
  sectionBox: {
    backgroundColor: "#18181A",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: "500",
    color: "#71717A",
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
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.1 }],
  },
  compactPickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#141416",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#27272A",
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
    fontWeight: "500",
    color: "#EDEDED",
    letterSpacing: 0.3,
  },
  dropperIconBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  dropperBadgeText: {
    fontSize: 8.5,
    fontWeight: "500",
    color: "#EDEDED",
  },
  autoCutoutPanel: {
    gap: 6,
  },
  compactProcessingBanner: {
    backgroundColor: "#141416",
    padding: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#27272A",
    gap: 4,
  },
  compactProcessingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactProgressPct: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  compactCancelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  compactCancelText: {
    fontSize: 8.5,
    fontWeight: "500",
    color: "#EF4444",
  },
  progressBarTrack: {
    height: 2,
    backgroundColor: "#141416",
    borderRadius: 1,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 1,
  },
  actionsContainer: {
    gap: 6,
  },
  qualityTabBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  qualityTabBtnSelected: {
    backgroundColor: "#141416",
    borderColor: "#00F2FE",
  },
  qualityTabLabel: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#8E8E93",
  },
  qualityTabLabelSelected: {
    color: "#00F2FE",
  },
  qualityTabSublabel: {
    fontSize: 8.5,
    color: "#71717A",
    marginTop: 1,
  },
  qualityTabSublabelSelected: {
    color: "#EDEDED",
  },
  processedSuccessCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
  },
  processedSuccessTitle: {
    fontSize: 10,
    fontWeight: "500",
    color: "#10B981",
  },
  processedSuccessSubtext: {
    fontSize: 8.5,
    color: "#6EE7B7",
    marginTop: 1,
  },
  reprocessChipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#18181A",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  reprocessChipText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#00F2FE",
  },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00F2FE",
    paddingVertical: 7,
    borderRadius: 6,
  },
  heroBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#08090E",
  },
  heroBtnSecondary: {
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  heroBtnSecondaryText: {
    color: "#EDEDED",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#141416",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  secondaryActionText: {
    fontSize: 10,
    fontWeight: "500",
  },
  stylingBox: {
    backgroundColor: "#18181A",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    marginTop: 2,
    marginBottom: 6,
  },
  stylingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stylingTabGroup: {
    flexDirection: "row",
    backgroundColor: "#141416",
    borderRadius: 5,
    padding: 2,
    gap: 3,
  },
  stylingTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stylingTabBtnActive: {
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  stylingTabText: {
    fontSize: 10,
    fontWeight: "400",
    color: "#8E8E93",
  },
  stylingTabTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#00F2FE",
  },
  resetStylingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  resetStylingText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#00F2FE",
  },
  paletteContainer: {
    gap: 6,
  },
  swatchScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  paletteSwatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  paletteSwatchSelected: {
    borderColor: "#00F2FE",
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
  },
  transparentSwatch: {
    backgroundColor: "#141416",
    borderStyle: "dashed",
    borderColor: "#27272A",
  },
  outlineControlsSection: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#27272A",
    gap: 4,
  },
  thicknessPillRow: {
    flexDirection: "row",
    gap: 4,
  },
  thicknessPill: {
    flex: 1,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141416",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  thicknessPillActive: {
    backgroundColor: "#141416",
    borderColor: "#00F2FE",
  },
  thicknessPillText: {
    fontSize: 9.5,
    fontWeight: "400",
    color: "#8E8E93",
  },
  thicknessPillTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
});

export const CutoutControls = React.memo(CutoutControlsComponent);
export default CutoutControls;
