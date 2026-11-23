import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import {
  FastArtProject,
  ClipTransform,
  CustomCrop,
  MaskConfig,
  MaskShape,
  CutoutConfig,
  AspectRatio,
  Resolution,
  FPS,
  computeTotalDuration,
} from "../../types/project";
import { THEME_COLORS } from "../../constants/designConstants";
import { FILTER_PRESETS } from "../../constants/sampleMedia";
import { CompactSliderInput } from "../Common/CompactSliderInput";
import { CustomColorPickerButton } from "../Common/CustomColorPickerButton";
import { BeatAndDuckingCard } from "../Common/BeatAndDuckingCard";
import { mediaHasAudioTrack } from "../../utils/mediaAudioDetector";

interface DesktopInspectorProps {
  project: FastArtProject;
  selectedClip: any;
  selectedClipType: string;
  currentTime: number;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
  onUpdateClipTransform?: (
    clipId: string,
    transform: ClipTransform,
    isFinal?: boolean,
  ) => void;
  onUpdateClipCrop?: (clipId: string, crop: CustomCrop) => void;
  onUpdateClipMask?: (
    clipId: string,
    mask: MaskConfig,
    isFinal?: boolean,
  ) => void;
  onApplyVolume?: (
    vol: number,
    fadeIn: number,
    fadeOut: number,
    denoise?: boolean,
  ) => void;
  onApplySpeed?: (speed: number, curve?: any, smoothSlowMo?: any) => void;
  onApplyEnhance?: (preset: any) => void;
  onApplyFilter?: (filterId: string) => void;
  onDeleteClip?: () => void;
  onDuplicateClip?: () => void;
  onAddKeyframe?: () => void;
  hasKeyframeAtPlayhead?: boolean;
  onOpenModal?: (modal: string) => void;
  width?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  style?: any;
}

const MASK_SHAPES: { id: MaskShape; label: string; icon: string }[] = [
  { id: "none", label: "None", icon: "close-circle-outline" },
  { id: "circle", label: "Circle", icon: "radio-button-on-outline" },
  { id: "rectangle", label: "Rectangle", icon: "square-outline" },
  { id: "linear", label: "Split", icon: "remove-outline" },
  { id: "mirror", label: "Mirror", icon: "pause-outline" },
  { id: "heart", label: "Heart", icon: "heart-outline" },
  { id: "star", label: "Star", icon: "star-outline" },
];

export const DesktopInspector: React.FC<DesktopInspectorProps> = ({
  project,
  selectedClip,
  selectedClipType,
  currentTime,
  onUpdateProject,
  onUpdateClipTransform,
  onUpdateClipCrop,
  onUpdateClipMask,
  onApplyVolume,
  onApplySpeed,
  onApplyEnhance,
  onApplyFilter,
  onDeleteClip,
  onDuplicateClip,
  onAddKeyframe,
  hasKeyframeAtPlayhead = false,
  onOpenModal,
  width = 300,
  isCollapsed = false,
  onToggleCollapse,
  style,
}) => {
  const isVisual = selectedClipType === "video" || selectedClipType === "photo";
  const isAudio = selectedClipType === "audio";
  const isText =
    selectedClipType === "text" ||
    selectedClipType === "caption" ||
    selectedClipType === "captions";

  // Collapsed side rail
  if (isCollapsed) {
    return (
      <View style={[styles.collapsedRail, style]}>
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={onToggleCollapse}
          activeOpacity={0.7}
          accessibilityLabel="Expand properties inspector"
        >
          <Ionicons name="chevron-back" size={14} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.collapsedLabel}>
          {selectedClip ? selectedClip.title || "Clip" : "Project"}
        </Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Project Properties (when no clip is selected)
  // ─────────────────────────────────────────────
  if (!selectedClip) {
    const aspectRatios: AspectRatio[] = [
      "16:9",
      "9:16",
      "1:1",
      "4:5",
      "2.35:1",
    ];
    const resolutions: Resolution[] = ["720p", "1080p", "2K/4K"];
    const frameRates: FPS[] = [24, 25, 30, 50, 60];
    const bgColors = [
      "#000000",
      "#121214",
      "#1B1C20",
      "#25262B",
      "#FFFFFF",
      "#00F2FE",
      "#1E3A5F",
      "#8C483A",
    ];

    return (
      <View style={[styles.container, width !== undefined && { width }, style]}>
        {/* Panel Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="options-outline" size={14} color="#8E8E93" />
            <Text style={styles.headerTitle}>Project</Text>
          </View>
          {onToggleCollapse && (
            <TouchableOpacity onPress={onToggleCollapse} style={styles.iconBtn}>
              <Ionicons name="chevron-forward" size={14} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
        >
          {/* Project Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Name</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={project.title || "Untitled Project"}
                onChangeText={(val: string) => onUpdateProject({ title: val })}
                placeholderTextColor={THEME_COLORS.textMuted}
              />
            </View>
          </View>

          {/* Aspect Ratio */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Canvas Aspect Ratio</Text>
            <View style={styles.chipsRow}>
              {aspectRatios.map((ratio) => {
                const isActive = (project.aspectRatio || "16:9") === ratio;
                return (
                  <TouchableOpacity
                    key={ratio}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      onUpdateProject({ aspectRatio: ratio });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isActive && styles.chipTextActive,
                      ]}
                    >
                      {ratio}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Resolution */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Canvas Resolution</Text>
            <View style={styles.chipsRow}>
              {resolutions.map((res) => {
                const isActive = (project.resolution || "1080p") === res;
                return (
                  <TouchableOpacity
                    key={res}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      onUpdateProject({ resolution: res });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isActive && styles.chipTextActive,
                      ]}
                    >
                      {res}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Frame Rate (FPS) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frame Rate (FPS)</Text>
            <View style={styles.chipsRow}>
              {frameRates.map((fps) => {
                const isActive = (project.fps || 30) === fps;
                return (
                  <TouchableOpacity
                    key={fps}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      onUpdateProject({ fps });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isActive && styles.chipTextActive,
                      ]}
                    >
                      {fps} FPS
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Canvas Background Color */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Canvas Background</Text>
            <View style={styles.colorSwatchesRow}>
              {bgColors.map((col) => {
                const isSelected =
                  (project.canvasBackground || "#000000") === col;
                return (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: col },
                      isSelected && styles.colorSwatchActive,
                    ]}
                    onPress={() => {
                      onUpdateProject({ canvasBackground: col });
                    }}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={col === "#FFFFFF" ? "#000000" : "#FFFFFF"}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
              <CustomColorPickerButton
                value={project.canvasBackground || "#000000"}
                presets={bgColors}
                onColorChange={(col) =>
                  onUpdateProject({ canvasBackground: col })
                }
                size={24}
                shape="circle"
                accessibilityLabel="Pick custom canvas background color"
              />
            </View>
          </View>

          {/* Project Summary Stats */}
          <View style={[styles.section, { borderBottomWidth: 0 }]}>
            <Text style={styles.sectionTitle}>Project Overview</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Duration:</Text>
              <Text style={styles.statValue}>
                {computeTotalDuration(project.tracks).toFixed(2)}s
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Video & Photo Clips:</Text>
              <Text style={styles.statValue}>
                {project.tracks.video?.length || 0}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Audio Tracks:</Text>
              <Text style={styles.statValue}>
                {project.tracks.audio?.length || 0}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Selected Clip Properties Inspector
  // ─────────────────────────────────────────────
  const transform = selectedClip.transform || {};
  const currentScale = transform.scale ?? 1.0;
  const currentPosX = transform.x ?? 0;
  const currentPosY = transform.y ?? 0;
  const currentRotation = transform.rotation ?? 0;
  const currentOpacity = selectedClip.opacity ?? transform.opacity ?? 1.0;
  const isFlipX = transform.flipX || false;
  const isFlipY = transform.flipY || false;

  const handleTransformChange = (overrides: Partial<ClipTransform>) => {
    if (!onUpdateClipTransform) return;
    const next: ClipTransform = {
      ...transform,
      ...overrides,
    };
    onUpdateClipTransform(selectedClip.id, next, true);
  };

  const currentMask = selectedClip.mask ||
    transform.mask || { shape: "none", size: 60, feather: 0 };
  const currentCutout: CutoutConfig = selectedClip.cutout || {
    enabled: false,
    mode: "none",
    keyColor: "#00FF00",
    intensity: 45,
    shadow: 25,
  };

  return (
    <View style={[styles.container, width !== undefined && { width }, style]}>
      {/* Top Header with Clip Name & Category Tabs */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons
            name={
              isVisual
                ? selectedClipType === "photo"
                  ? "image-outline"
                  : "videocam-outline"
                : isAudio
                  ? "musical-notes-outline"
                  : "text-outline"
            }
            size={14}
            color="#8E8E93"
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedClip.title || "Clip"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {onDuplicateClip && (
            <TouchableOpacity
              onPress={onDuplicateClip}
              style={styles.iconBtn}
              accessibilityLabel="Duplicate"
            >
              <Ionicons name="copy-outline" size={13} color="#8E8E93" />
            </TouchableOpacity>
          )}
          {onDeleteClip && (
            <TouchableOpacity
              onPress={onDeleteClip}
              style={styles.iconBtn}
              accessibilityLabel="Delete"
            >
              <Ionicons
                name="trash-outline"
                size={13}
                color={THEME_COLORS.error}
              />
            </TouchableOpacity>
          )}
          {onToggleCollapse && (
            <TouchableOpacity onPress={onToggleCollapse} style={styles.iconBtn}>
              <Ionicons name="chevron-forward" size={14} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─────────────────────────────────────────────
          CONTENT: Visual (Transform Controls)
          ───────────────────────────────────────────── */}
      {isVisual && (
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {/* Scale Slider */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Scale"
                value={Math.round(currentScale * 100)}
                min={10}
                max={300}
                step={1}
                unit="%"
                defaultValue={100}
                onChange={(val) => {
                  handleTransformChange({ scale: val / 100 });
                }}
              />
            </View>

            {/* Position X Slider & Small Input */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Position X"
                value={Math.round(currentPosX)}
                min={-500}
                max={500}
                step={1}
                unit="px"
                defaultValue={0}
                onChange={(val) => {
                  handleTransformChange({ x: val });
                }}
              />
            </View>

            {/* Position Y Slider & Small Input */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Position Y"
                value={Math.round(currentPosY)}
                min={-500}
                max={500}
                step={1}
                unit="px"
                defaultValue={0}
                onChange={(val) => {
                  handleTransformChange({ y: val });
                }}
              />
            </View>

            {/* Rotation Slider & Small Input */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Rotation"
                value={Math.round(currentRotation)}
                min={-180}
                max={180}
                step={1}
                unit="°"
                defaultValue={0}
                onChange={(val) => {
                  handleTransformChange({ rotation: val });
                }}
              />
            </View>

            {/* Opacity Slider & Small Input */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Opacity"
                value={Math.round(currentOpacity * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                defaultValue={100}
                onChange={(val) => {
                  handleTransformChange({ opacity: val / 100 });
                }}
              />
            </View>

            {/* Flip Buttons */}
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Flip & Orientation</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, isFlipX && styles.actionBtnActive]}
                  onPress={() => {
                    handleTransformChange({ flipX: !isFlipX });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={15}
                    color={
                      isFlipX ? THEME_COLORS.accent : THEME_COLORS.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      isFlipX && styles.actionBtnTextActive,
                    ]}
                  >
                    Flip H
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, isFlipY && styles.actionBtnActive]}
                  onPress={() => {
                    handleTransformChange({ flipY: !isFlipY });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="swap-vertical"
                    size={15}
                    color={
                      isFlipY ? THEME_COLORS.accent : THEME_COLORS.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      isFlipY && styles.actionBtnTextActive,
                    ]}
                  >
                    Flip V
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      borderColor: "#00F2FE",
                      backgroundColor: "#18181A",
                    },
                  ]}
                  onPress={() => {
                    handleTransformChange({
                      scale: 1,
                      x: 0,
                      y: 0,
                      rotation: 0,
                      opacity: 1,
                      flipX: false,
                      flipY: false,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={13} color="#00F2FE" />
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: "#00F2FE", fontWeight: "600" },
                    ]}
                  >
                    Reset
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Cutout (Background Removal) Quick Action */}
            <View style={{ borderTopWidth: 1, borderTopColor: "#1F1F23", paddingTop: 10, marginTop: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="sparkles" size={13} color="#00F2FE" />
                  <Text style={styles.sectionTitle}>CUTOUT & BACKGROUND</Text>
                </View>
                {currentCutout.enabled && currentCutout.mode !== "none" && (
                  <View
                    style={{
                      backgroundColor: "#18181A",
                      borderColor: "#00F2FE",
                      borderWidth: 1,
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                    }}
                  >
                    <Text style={{ color: "#00F2FE", fontSize: 9.5, fontWeight: "600" }}>
                      {currentCutout.mode === "auto" ? "AI CUTOUT ACTIVE" : "CHROMA KEY"}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    height: 32,
                    backgroundColor: "#18181A",
                    borderColor:
                      currentCutout.enabled && currentCutout.mode !== "none"
                        ? "#00F2FE"
                        : "#27272A",
                    borderRadius: 6,
                    justifyContent: "center",
                    marginTop: 4,
                  },
                ]}
                onPress={() => onOpenModal?.("cutout")}
                activeOpacity={0.8}
                accessibilityLabel="Open Cutout modal"
              >
                <Ionicons
                  name={
                    currentCutout.enabled && currentCutout.mode !== "none"
                      ? "checkmark-circle"
                      : "sparkles-outline"
                  }
                  size={14}
                  color={
                    currentCutout.enabled && currentCutout.mode !== "none"
                      ? "#00F2FE"
                      : "#EDEDED"
                  }
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    {
                      color:
                        currentCutout.enabled && currentCutout.mode !== "none"
                          ? "#00F2FE"
                          : "#EDEDED",
                      fontWeight: "600",
                      fontSize: 11,
                    },
                  ]}
                >
                  {currentCutout.enabled && currentCutout.mode !== "none"
                    ? "Edit Cutout Settings"
                    : "Open Cutout (Remove Background)"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Video Audio & Volume Controls (when video has audio) */}
            {selectedClipType === "video" && mediaHasAudioTrack(selectedClip) && (
              <View style={{ borderTopWidth: 1, borderTopColor: "#1F1F23", paddingTop: 10, marginTop: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Ionicons name="volume-medium-outline" size={14} color="#00F2FE" />
                  <Text style={styles.sectionTitle}>AUDIO & VOLUME</Text>
                </View>

                {/* Volume Slider */}
                <View style={styles.controlRow}>
                  <CompactSliderInput
                    label="Volume"
                    value={Math.round((selectedClip.volume ?? 1.0) * 100)}
                    min={0}
                    max={200}
                    step={1}
                    unit="%"
                    defaultValue={100}
                    onChange={(val) => {
                      onApplyVolume?.(
                        val / 100,
                        selectedClip.fadeIn || 0,
                        selectedClip.fadeOut || 0,
                      );
                    }}
                  />
                </View>

                {/* Fade Duration (s) */}
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Fade Duration (s)</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <View style={[styles.inputBox, { flex: 1 }]}>
                      <Text style={styles.inputPrefix}>In</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(selectedClip.fadeIn || 0)}
                        onChangeText={(val: string) => {
                          const num = Number(val) || 0;
                          onApplyVolume?.(
                            selectedClip.volume ?? 1.0,
                            num,
                            selectedClip.fadeOut || 0,
                          );
                        }}
                      />
                    </View>
                    <View style={[styles.inputBox, { flex: 1 }]}>
                      <Text style={styles.inputPrefix}>Out</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(selectedClip.fadeOut || 0)}
                        onChangeText={(val: string) => {
                          const num = Number(val) || 0;
                          onApplyVolume?.(
                            selectedClip.volume ?? 1.0,
                            selectedClip.fadeIn || 0,
                            num,
                          );
                        }}
                      />
                    </View>
                  </View>
                </View>

                {/* AI Noise Reduction Toggle */}
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#18181A",
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: selectedClip?.denoise ? "#00F2FE" : "#27272A",
                    marginVertical: 4,
                  }}
                  onPress={() => {
                    onApplyVolume?.(
                      selectedClip.volume ?? 1.0,
                      selectedClip.fadeIn || 0,
                      selectedClip.fadeOut || 0,
                      !selectedClip.denoise,
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name="ear-outline"
                      size={13}
                      color={selectedClip?.denoise ? "#00F2FE" : "#94A3B8"}
                    />
                    <Text
                      style={{
                        color: selectedClip?.denoise ? "#00F2FE" : "#CBD5E1",
                        fontSize: 10,
                        fontWeight: selectedClip?.denoise ? "600" : "400",
                      }}
                    >
                      Noise Reduction
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 4,
                        paddingVertical: 1,
                        borderRadius: 3,
                        backgroundColor: "#141416",
                        borderWidth: 1,
                        borderColor: selectedClip?.denoise
                          ? "#00F2FE"
                          : "#27272A",
                      }}
                    >
                      <Text
                        style={{
                          color: selectedClip?.denoise ? "#00F2FE" : "#8E8E93",
                          fontSize: 8,
                          fontWeight: selectedClip?.denoise ? "700" : "400",
                        }}
                      >
                        AI
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      width: 32,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: selectedClip?.denoise
                        ? "#00F2FE"
                        : "#27272A",
                      padding: 2,
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: selectedClip?.denoise
                          ? "#08090E"
                          : "#71717A",
                        alignSelf: selectedClip?.denoise
                          ? "flex-end"
                          : "flex-start",
                      }}
                    />
                  </View>
                </TouchableOpacity>

                {/* Beat Mapping & Smart Audio Ducking */}
                <BeatAndDuckingCard
                  project={project}
                  onUpdateProject={onUpdateProject}
                  currentTime={currentTime}
                  selectedClip={selectedClip}
                />
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────
          TAB CONTENT: Audio (Volume, Fade, Beat Sync)
          ───────────────────────────────────────────── */}
      {isAudio && (
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {/* Volume Slider */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Volume"
                value={Math.round((selectedClip.volume ?? 1.0) * 100)}
                min={0}
                max={200}
                step={1}
                unit="%"
                defaultValue={100}
                onChange={(val) => {
                  onApplyVolume?.(
                    val / 100,
                    selectedClip.fadeIn || 0,
                    selectedClip.fadeOut || 0,
                  );
                }}
              />
            </View>

            {/* Fade In & Fade Out */}
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Fade Duration (s)</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <Text style={styles.inputPrefix}>In</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={String(selectedClip.fadeIn || 0)}
                    onChangeText={(val: string) => {
                      const num = Number(val) || 0;
                      onApplyVolume?.(
                        selectedClip.volume ?? 1.0,
                        num,
                        selectedClip.fadeOut || 0,
                      );
                    }}
                  />
                </View>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <Text style={styles.inputPrefix}>Out</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={String(selectedClip.fadeOut || 0)}
                    onChangeText={(val: string) => {
                      const num = Number(val) || 0;
                      onApplyVolume?.(
                        selectedClip.volume ?? 1.0,
                        selectedClip.fadeIn || 0,
                        num,
                      );
                    }}
                  />
                </View>
              </View>
            </View>

            {/* AI Noise Reduction Toggle */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#18181A",
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: selectedClip?.denoise ? "#00F2FE" : "#27272A",
                marginVertical: 4,
              }}
              onPress={() => {
                onApplyVolume?.(
                  selectedClip.volume ?? 1.0,
                  selectedClip.fadeIn || 0,
                  selectedClip.fadeOut || 0,
                  !selectedClip.denoise,
                );
              }}
              activeOpacity={0.8}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons
                  name="ear-outline"
                  size={13}
                  color={selectedClip?.denoise ? "#00F2FE" : "#94A3B8"}
                />
                <Text
                  style={{
                    color: selectedClip?.denoise ? "#00F2FE" : "#CBD5E1",
                    fontSize: 10,
                    fontWeight: selectedClip?.denoise ? "600" : "400",
                  }}
                >
                  Noise Reduction
                </Text>
                <View
                  style={{
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    borderRadius: 3,
                    backgroundColor: "#141416",
                    borderWidth: 1,
                    borderColor: selectedClip?.denoise
                      ? "#00F2FE"
                      : "#27272A",
                  }}
                >
                  <Text
                    style={{
                      color: selectedClip?.denoise ? "#00F2FE" : "#8E8E93",
                      fontSize: 8,
                      fontWeight: selectedClip?.denoise ? "700" : "400",
                    }}
                  >
                    AI
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: selectedClip?.denoise
                    ? "#00F2FE"
                    : "#27272A",
                  padding: 2,
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: selectedClip?.denoise
                      ? "#08090E"
                      : "#71717A",
                    alignSelf: selectedClip?.denoise
                      ? "flex-end"
                      : "flex-start",
                  }}
                />
              </View>
            </TouchableOpacity>

            {/* Beat Mapping & Smart Audio Ducking Studio */}
            <BeatAndDuckingCard
              project={project}
              onUpdateProject={onUpdateProject}
              currentTime={currentTime}
              selectedClip={selectedClip}
            />
          </View>
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────
          CONTENT: Text
          ───────────────────────────────────────────── */}
      {isText && (
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edit Text</Text>
            <View style={styles.textAreaBox}>
              <TextInput
                style={styles.textAreaInput}
                multiline
                value={selectedClip?.text || ""}
                onChangeText={(val: string) => {
                  if (onUpdateProject) {
                    if (
                      project.tracks.text?.some((t) => t.id === selectedClip.id)
                    ) {
                      const texts = project.tracks.text.map((t) =>
                        t.id === selectedClip.id ? { ...t, text: val } : t,
                      );
                      onUpdateProject({
                        ...project,
                        tracks: { ...project.tracks, text: texts },
                      });
                    } else if (
                      project.tracks.captions?.some(
                        (c) => c.id === selectedClip.id,
                      )
                    ) {
                      const caps = project.tracks.captions.map((c) =>
                        c.id === selectedClip.id ? { ...c, text: val } : c,
                      );
                      onUpdateProject({
                        ...project,
                        tracks: { ...project.tracks, captions: caps },
                      });
                    }
                  }
                }}
                placeholder="Enter caption or title..."
                placeholderTextColor={THEME_COLORS.textMuted}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryActionBtn, { marginTop: 14 }]}
              onPress={() => onOpenModal?.("text")}
              activeOpacity={0.8}
            >
              <Ionicons name="text-outline" size={14} color="#08090E" />
              <Text style={styles.primaryActionBtnText}>
                Edit Font, Styles & Animations
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const webSliderStyle: any = {
  width: "100%",
  accentColor: THEME_COLORS.accent,
  height: 4,
  cursor: "pointer",
  marginTop: 6,
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#121214",
    borderLeftWidth: 1,
    borderLeftColor: "#1F1F23",
    height: "100%",
    flexDirection: "column",
  },
  collapsedRail: {
    width: 24,
    height: "100%",
    backgroundColor: "#121214",
    borderLeftWidth: 1,
    borderLeftColor: "#1F1F23",
    alignItems: "center",
    paddingTop: 8,
  },
  expandBtn: {
    width: 20,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#18181A",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  collapsedLabel: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "400",
    marginTop: 20,
    transform: [{ rotate: "90deg" }],
    width: 100,
  },
  header: {
    height: 34,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    backgroundColor: "#121214",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  headerTitle: {
    color: "#EDEDED",
    fontSize: 11.5,
    fontWeight: "500",
  },
  iconBtn: {
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  primaryTabBar: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    paddingHorizontal: 8,
    backgroundColor: "#121214",
    gap: 4,
  },
  primaryTab: {
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryTabActive: {
    backgroundColor: "transparent",
    borderBottomWidth: 2,
    borderBottomColor: "#00F2FE",
  },
  primaryTabText: {
    color: "#8E8E93",
    fontSize: 10.5,
    fontWeight: "400",
  },
  primaryTabTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  subTabBar: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: "#18181A",
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    gap: 3,
  },
  subTab: {
    flex: 1,
    height: 20,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  subTabActive: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  subTabText: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "400",
  },
  subTabTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  scrollArea: {
    flex: 1,
  },
  section: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
  },
  sectionTitle: {
    color: "#CBD5E1",
    fontSize: 10.5,
    fontWeight: "500",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  controlRow: {
    marginBottom: 8,
  },
  labelValueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  controlLabel: {
    color: "#8E8E93",
    fontSize: 10.5,
    fontWeight: "400",
  },
  controlValue: {
    color: "#EDEDED",
    fontSize: 10.5,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  inputBox: {
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    height: 28,
  },
  textAreaBox: {
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 68,
    overflow: "hidden",
  },
  textAreaInput: {
    color: "#EDEDED",
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
    minHeight: 52,
    textAlignVertical: "top",
    padding: 0,
    minWidth: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  inputPrefix: {
    color: "#71717A",
    fontSize: 10.5,
    fontWeight: "400",
    marginRight: 6,
  },
  textInput: {
    color: "#EDEDED",
    fontSize: 10.5,
    fontWeight: "400",
    flex: 1,
    padding: 0,
    minWidth: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  chipActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  chipText: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "400",
  },
  chipTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  colorSwatchesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#27272A",
    justifyContent: "center",
    alignItems: "center",
  },
  colorSwatchActive: {
    borderColor: "#00F2FE",
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  statLabel: {
    color: "#71717A",
    fontSize: 10,
    fontWeight: "400",
  },
  statValue: {
    color: "#EDEDED",
    fontSize: 10,
    fontWeight: "400",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 4,
    height: 26,
  },
  actionBtnActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  actionBtnText: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "400",
  },
  actionBtnTextActive: {
    color: "#00F2FE",
    fontWeight: "600",
  },
  primaryActionBtn: {
    backgroundColor: "#00F2FE",
    borderRadius: 5,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  primaryActionBtnText: {
    color: "#08090E",
    fontSize: 10.5,
    fontWeight: "600",
  },
  miniToggle: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  miniToggleActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  miniToggleText: {
    color: "#71717A",
    fontSize: 8.5,
    fontWeight: "400",
  },
  miniToggleTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  maskGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  maskCard: {
    width: "31%",
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 5,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  maskCardActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  maskCardLabel: {
    color: "#71717A",
    fontSize: 8.5,
    fontWeight: "400",
  },
  maskCardLabelActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
});
