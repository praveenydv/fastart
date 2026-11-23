import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { MaskConfig, MaskShape } from "../../types/project";
import { CompactSliderInput } from "../Common/CompactSliderInput";
import { ModalHeader } from "../Common";
import { cleanAndSortMaskKeyframes } from "../../utils/keyframeEngine";

interface MaskModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentMask?: MaskConfig;
  onApplyMask: (newMask: MaskConfig, isFinal?: boolean) => void;
  isInline?: boolean;
  selectedClip?: any;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onAddKeyframe?: (mode?: "add" | "remove" | "toggle", maskOverride?: MaskConfig) => void;
  hasKeyframeAtCurrentTime?: boolean;
  hasPrevKeyframe?: boolean;
  hasNextKeyframe?: boolean;
  onJumpPrevKeyframe?: () => void;
  onJumpNextKeyframe?: () => void;
  onClearAllKeyframes?: () => void;
  onDeleteKeyframeAtTime?: (time?: number) => void;
}

const MASK_SHAPES: {
  id: MaskShape;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: "none",
    label: "None",
    icon: "close-circle-outline",
    desc: "Full Video",
  },
  {
    id: "circle",
    label: "Radial Circle",
    icon: "radio-button-on-outline",
    desc: "Spotlight",
  },
  {
    id: "rectangle",
    label: "Rounded Box",
    icon: "square-outline",
    desc: "Pill Box",
  },
  {
    id: "linear",
    label: "Split Line",
    icon: "remove-outline",
    desc: "Half Screen",
  },
  {
    id: "mirror",
    label: "Mirror Band",
    icon: "pause-outline",
    desc: "Center Band",
  },
  { id: "heart", label: "Love Heart", icon: "heart-outline", desc: "Vignette" },
  { id: "star", label: "Star", icon: "star-outline", desc: "Badge" },
];

function MaskModalComponent({
  visible,
  onClose,
  onApply,
  currentMask,
  onApplyMask,
  isInline = false,
  selectedClip,
  currentTime = 0,
  onSeek,
  onAddKeyframe,
  hasKeyframeAtCurrentTime = false,
  hasPrevKeyframe = false,
  hasNextKeyframe = false,
  onJumpPrevKeyframe,
  onJumpNextKeyframe,
  onClearAllKeyframes,
  onDeleteKeyframeAtTime,
}: MaskModalProps) {
  const [maskShape, setMaskShape] = useState<MaskShape>(
    currentMask?.shape || "none",
  );
  const [maskSize, setMaskSize] = useState<number>(currentMask?.size || 60);
  const [maskWidth, setMaskWidth] = useState<number>(
    currentMask?.width || currentMask?.size || 60,
  );
  const [maskHeight, setMaskHeight] = useState<number>(
    currentMask?.height || currentMask?.size || 60,
  );
  const [isAspectLocked, setIsAspectLocked] = useState<boolean>(false);
  const [maskFeather, setMaskFeather] = useState<number>(
    currentMask?.feather || 0,
  );
  const [maskRoundness, setMaskRoundness] = useState<number>(
    currentMask?.roundness || 16,
  );
  const [maskInverted, setMaskInverted] = useState<boolean>(
    currentMask?.inverted || false,
  );
  const [maskX, setMaskX] = useState<number>(currentMask?.x || 0);
  const [maskY, setMaskY] = useState<number>(currentMask?.y || 0);
  const [maskRotation, setMaskRotation] = useState<number>(
    currentMask?.rotation || 0,
  );
  const [isSliderDragging, setIsSliderDragging] = useState<boolean>(false);

  useEffect(() => {
    if (visible && !isSliderDragging && currentMask) {
      setMaskShape(currentMask.shape || "none");
      const s = currentMask.size || 60;
      setMaskSize(s);
      setMaskWidth(currentMask.width !== undefined ? currentMask.width : s);
      setMaskHeight(currentMask.height !== undefined ? currentMask.height : s);
      setMaskFeather(currentMask.feather || 0);
      setMaskRoundness(currentMask.roundness || 16);
      setMaskInverted(currentMask.inverted || false);
      setMaskX(currentMask.x || 0);
      setMaskY(currentMask.y || 0);
      setMaskRotation(currentMask.rotation || 0);
    }
  }, [
    visible,
    isSliderDragging,
    currentMask?.shape,
    currentMask?.size,
    currentMask?.width,
    currentMask?.height,
    currentMask?.feather,
    currentMask?.roundness,
    currentMask?.inverted,
    currentMask?.x,
    currentMask?.y,
    currentMask?.rotation,
  ]);

  const triggerUpdate = (
    overrides?: {
      shape?: MaskShape;
      size?: number;
      width?: number;
      height?: number;
      feather?: number;
      roundness?: number;
      inverted?: boolean;
      x?: number;
      y?: number;
      rotation?: number;
    },
    isFinal = true,
  ) => {
    const nextShape =
      overrides?.shape !== undefined ? overrides.shape : maskShape;
    const nextSize = overrides?.size !== undefined ? overrides.size : maskSize;
    const nextWidth =
      overrides?.width !== undefined ? overrides.width : maskWidth;
    const nextHeight =
      overrides?.height !== undefined ? overrides.height : maskHeight;
    const nextFeather =
      overrides?.feather !== undefined ? overrides.feather : maskFeather;
    const nextRoundness =
      overrides?.roundness !== undefined ? overrides.roundness : maskRoundness;
    const nextInverted =
      overrides?.inverted !== undefined ? overrides.inverted : maskInverted;
    const nextX = overrides?.x !== undefined ? overrides.x : maskX;
    const nextY = overrides?.y !== undefined ? overrides.y : maskY;
    const nextRotation =
      overrides?.rotation !== undefined ? overrides.rotation : maskRotation;

    const newMask: MaskConfig = {
      shape: nextShape,
      size: nextSize,
      width: nextWidth,
      height: nextHeight,
      feather: nextFeather,
      roundness: nextRoundness,
      inverted: nextInverted,
      x: nextX,
      y: nextY,
      rotation: nextRotation,
    };

    onApplyMask(newMask, isFinal);
  };

  const handleReset = () => {
    setMaskShape("none");
    setMaskSize(60);
    setMaskWidth(60);
    setMaskHeight(60);
    setIsAspectLocked(false);
    setMaskFeather(0);
    setMaskRoundness(16);
    setMaskInverted(false);
    setMaskX(0);
    setMaskY(0);
    setMaskRotation(0);

    triggerUpdate({
      shape: "none",
      size: 60,
      width: 60,
      height: 60,
      feather: 0,
      roundness: 16,
      inverted: false,
      x: 0,
      y: 0,
      rotation: 0,
    });
  };

  const formatSec = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min < 10 ? "0" : ""}${min}:${sec < 10 ? "0" : ""}${sec.toFixed(2)}`;
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const rawMaskKfs = useMemo(() => {
    const list =
      selectedClip?.maskKeyframes ||
      selectedClip?.mask?.keyframes ||
      [];
    return cleanAndSortMaskKeyframes(list);
  }, [selectedClip?.maskKeyframes, selectedClip?.mask?.keyframes]);

  const clipStart = selectedClip?.startTime || 0;
  const clipDuration = selectedClip?.duration || 10;
  const isInsideClip =
    currentTime >= clipStart - 0.05 &&
    currentTime <= clipStart + clipDuration + 0.05;
  const clipLocalTime = Math.max(0, Math.min(clipDuration, currentTime - clipStart));

  // Directly check if playhead is within 150ms of any keyframe on this clip
  const currentKeyframeIndex = isInsideClip
    ? rawMaskKfs.findIndex((k) => Math.abs(k.time - clipLocalTime) <= 0.15)
    : -1;
  const isKeyframeAtCurrent = currentKeyframeIndex >= 0;
  const keyframeCount = rawMaskKfs.length;

  const prevKf = isInsideClip
    ? [...rawMaskKfs].reverse().find((k) => k.time < clipLocalTime - 0.08)
    : undefined;
  const nextKf = isInsideClip
    ? rawMaskKfs.find((k) => k.time > clipLocalTime + 0.08)
    : undefined;
  const hasPrev = Boolean(prevKf);
  const hasNext = Boolean(nextKf);

  const handleJumpPrev = () => {
    if (prevKf && onSeek && selectedClip) {
      onSeek(Math.max(0, (selectedClip.startTime || 0) + prevKf.time));
    } else if (onJumpPrevKeyframe) {
      onJumpPrevKeyframe();
    }
  };

  const handleJumpNext = () => {
    if (nextKf && onSeek && selectedClip) {
      onSeek(Math.max(0, (selectedClip.startTime || 0) + nextKf.time));
    } else if (onJumpNextKeyframe) {
      onJumpNextKeyframe();
    }
  };

  const isModified = maskShape !== "none";

  const handleCancel = () => {
    onClose();
  };

  const handleApply = () => {
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const sheetContent = (
    <View
      style={[
        styles.sheetContainer,
        styles.inlineSheetContainer,
        Platform.OS === "web" ? ({ pointerEvents: "auto" } as any) : undefined,
      ]}
      pointerEvents="auto"
    >
      {/* Unified Live Panel Header - only shown in standalone modal */}
      {!isInline && (
        <ModalHeader
          title="Mask"
          iconName="shapes-outline"
          onClose={onClose}
          onReset={handleReset}
          resetText="Reset"
        />
      )}

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSliderDragging}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.groupContainer}>
          {/* Mask Shapes Grid */}
          <View style={styles.maskGrid}>
            {MASK_SHAPES.map((m) => {
              const isSelected = maskShape === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.maskCard, isSelected && styles.maskCardActive]}
                  onPress={() => {
                    setMaskShape(m.id);
                    triggerUpdate({ shape: m.id });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={15}
                    color={isSelected ? "#00F2FE" : "#8A8A8E"}
                  />
                  <Text
                    style={[
                      styles.maskCardTitle,
                      isSelected && styles.maskCardTitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {maskShape !== "none" && (
            <View style={styles.keyframeBar}>
              <View style={styles.kfLeftGroup}>
                <View style={styles.kfTimePill}>
                  <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                  <Text style={styles.kfTimeText} numberOfLines={1}>
                    {formatSec(currentTime)}
                  </Text>
                </View>

                {keyframeCount > 0 && (
                  <View style={[styles.kfCountBadge, isKeyframeAtCurrent && styles.kfCountBadgeActive]}>
                    <Ionicons name="diamond" size={8} color={isKeyframeAtCurrent ? "#FFFFFF" : "#A855F7"} />
                    <Text style={[styles.kfCountText, isKeyframeAtCurrent && styles.kfCountTextActive]}>
                      {isKeyframeAtCurrent
                        ? `${currentKeyframeIndex + 1}/${keyframeCount}`
                        : `${keyframeCount}`}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.kfActionGroup}>
                {/* Prev Keyframe Button */}
                <TouchableOpacity
                  style={[
                    styles.kfStepBtn,
                    !hasPrev && styles.kfStepBtnDisabled,
                  ]}
                  onPress={handleJumpPrev}
                  disabled={!hasPrev}
                  activeOpacity={0.7}
                  accessibilityLabel="Jump to previous mask keyframe"
                >
                  <Ionicons
                    name="caret-back"
                    size={12}
                    color={hasPrev ? "#FFFFFF" : "#3F3F46"}
                  />
                </TouchableOpacity>

                {/* Single Dynamic Keyframe Button: Shows [-] when on keyframe to remove, and [+] when not on keyframe to add */}
                <TouchableOpacity
                  style={[
                    styles.kfIconBtn,
                    isKeyframeAtCurrent ? styles.kfIconBtnRemove : styles.kfIconBtnAdd,
                  ]}
                  onPress={() => {
                    if (isKeyframeAtCurrent) {
                      if (onDeleteKeyframeAtTime) {
                        onDeleteKeyframeAtTime(clipLocalTime);
                      } else {
                        onAddKeyframe?.("remove");
                      }
                    } else {
                      const activeMaskConfig: MaskConfig = {
                        shape: maskShape,
                        size: maskSize,
                        width: maskWidth,
                        height: maskHeight,
                        feather: maskFeather,
                        roundness: maskRoundness,
                        inverted: maskInverted,
                        x: maskX,
                        y: maskY,
                        rotation: maskRotation,
                      };
                      (onAddKeyframe as any)?.("add", activeMaskConfig);
                    }
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={isKeyframeAtCurrent ? "Remove mask keyframe at playhead" : "Add mask keyframe at playhead"}
                >
                  <Ionicons
                    name={isKeyframeAtCurrent ? "remove" : "add"}
                    size={16}
                    color={isKeyframeAtCurrent ? "#EF4444" : "#FFFFFF"}
                  />
                </TouchableOpacity>

                {/* Next Keyframe Button */}
                <TouchableOpacity
                  style={[
                    styles.kfStepBtn,
                    !hasNext && styles.kfStepBtnDisabled,
                  ]}
                  onPress={handleJumpNext}
                  disabled={!hasNext}
                  activeOpacity={0.7}
                  accessibilityLabel="Jump to next mask keyframe"
                >
                  <Ionicons
                    name="caret-forward"
                    size={12}
                    color={hasNext ? "#FFFFFF" : "#3F3F46"}
                  />
                </TouchableOpacity>

                {/* Clear All Keyframes Button (if multiple keyframes exist) */}
                {keyframeCount > 1 && (
                  showClearConfirm ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <TouchableOpacity
                        style={[styles.kfIconBtn, { backgroundColor: "#EF4444", borderColor: "#EF4444" }]}
                        onPress={() => {
                          setShowClearConfirm(false);
                          onClearAllKeyframes?.();
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Confirm clear all keyframes"
                      >
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.kfIconBtn}
                        onPress={() => setShowClearConfirm(false)}
                        activeOpacity={0.7}
                        accessibilityLabel="Cancel clear"
                      >
                        <Ionicons name="close" size={13} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.kfIconBtn, { backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.35)" }]}
                      onPress={() => setShowClearConfirm(true)}
                      activeOpacity={0.7}
                      accessibilityLabel="Clear all mask keyframes"
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          )}

          {maskShape !== "none" && (
            <View style={styles.controlsCard}>
              {/* Dimensions & Deformation Header */}
              <View style={styles.dimHeaderRow}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons name="resize-outline" size={13} color="#EDEDED" />
                  <Text style={styles.dimLabel}>Dimensions & Deformation</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.lockBtn,
                    isAspectLocked && styles.lockBtnActive,
                  ]}
                  onPress={() => {
                    setIsAspectLocked(!isAspectLocked);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={isAspectLocked ? "Linked aspect ratio" : "Free deform"}
                >
                  <Ionicons
                    name={isAspectLocked ? "lock-closed" : "lock-open-outline"}
                    size={13}
                    color={isAspectLocked ? "#FFFFFF" : "#8E8E93"}
                  />
                </TouchableOpacity>
              </View>

              {/* Deformation Aspect Ratio Quick Presets */}
              <View style={styles.ratioPillsRow}>
                {[
                  { label: "1:1 Square", w: 60, h: 60 },
                  { label: "16:9 Wide", w: 80, h: 45 },
                  { label: "9:16 Tall", w: 45, h: 80 },
                  { label: "2:1 Pill", w: 84, h: 42 },
                  { label: "4:3 Standard", w: 72, h: 54 },
                ].map((preset) => {
                  const isActive =
                    maskWidth === preset.w && maskHeight === preset.h;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[
                        styles.ratioPill,
                        isActive && styles.ratioPillActive,
                      ]}
                      onPress={() => {
                        setMaskWidth(preset.w);
                        setMaskHeight(preset.h);
                        setMaskSize(Math.max(preset.w, preset.h));
                        triggerUpdate({
                          width: preset.w,
                          height: preset.h,
                          size: Math.max(preset.w, preset.h),
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.ratioPillText,
                          isActive && styles.ratioPillTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Mask Width Slider */}
              <View style={styles.sliderRow}>
                <CompactSliderInput
                  label="Width"
                  value={maskWidth}
                  min={10}
                  max={150}
                  step={1}
                  unit="%"
                  defaultValue={60}
                  accentColor="#FFFFFF"
                  showSteppers={true}
                  onDragStart={() => setIsSliderDragging(true)}
                  onDragEnd={() => {
                    setIsSliderDragging(false);
                    triggerUpdate({}, true);
                  }}
                  onChange={(val) => {
                    setMaskWidth(val);
                    if (isAspectLocked) {
                      const ratio = maskWidth > 0 ? maskHeight / maskWidth : 1;
                      const newH = Math.round(
                        Math.max(10, Math.min(150, val * ratio)),
                      );
                      setMaskHeight(newH);
                      triggerUpdate(
                        {
                          width: val,
                          height: newH,
                          size: Math.max(val, newH),
                        },
                        false,
                      );
                    } else {
                      triggerUpdate(
                        {
                          width: val,
                          size: Math.max(val, maskHeight),
                        },
                        false,
                      );
                    }
                  }}
                />
              </View>

              {/* Mask Height Slider */}
              <View style={styles.sliderRow}>
                <CompactSliderInput
                  label="Height"
                  value={maskHeight}
                  min={10}
                  max={150}
                  step={1}
                  unit="%"
                  defaultValue={60}
                  accentColor="#FFFFFF"
                  showSteppers={true}
                  onDragStart={() => setIsSliderDragging(true)}
                  onDragEnd={() => {
                    setIsSliderDragging(false);
                    triggerUpdate({}, true);
                  }}
                  onChange={(val) => {
                    setMaskHeight(val);
                    if (isAspectLocked) {
                      const ratio = maskHeight > 0 ? maskWidth / maskHeight : 1;
                      const newW = Math.round(
                        Math.max(10, Math.min(150, val * ratio)),
                      );
                      setMaskWidth(newW);
                      triggerUpdate(
                        {
                          height: val,
                          width: newW,
                          size: Math.max(newW, val),
                        },
                        false,
                      );
                    } else {
                      triggerUpdate(
                        {
                          height: val,
                          size: Math.max(maskWidth, val),
                        },
                        false,
                      );
                    }
                  }}
                />
              </View>

              {/* Edge Softness (Feather) */}
              <View style={styles.sliderRow}>
                <CompactSliderInput
                  label="Feather"
                  value={maskFeather}
                  min={0}
                  max={80}
                  step={1}
                  unit="%"
                  defaultValue={0}
                  accentColor="#FFFFFF"
                  showSteppers={true}
                  onDragStart={() => setIsSliderDragging(true)}
                  onDragEnd={() => {
                    setIsSliderDragging(false);
                    triggerUpdate({}, true);
                  }}
                  onChange={(val) => {
                    setMaskFeather(val);
                    triggerUpdate({ feather: val }, false);
                  }}
                />
              </View>

              {/* Box Roundness (if rectangle) */}
              {maskShape === "rectangle" && (
                <View style={styles.sliderRow}>
                  <CompactSliderInput
                    label="Roundness"
                    value={maskRoundness}
                    min={0}
                    max={60}
                    step={1}
                    unit="px"
                    defaultValue={16}
                    accentColor="#FFFFFF"
                    showSteppers={true}
                    onDragStart={() => setIsSliderDragging(true)}
                    onDragEnd={() => {
                      setIsSliderDragging(false);
                      triggerUpdate({}, true);
                    }}
                    onChange={(val) => {
                      setMaskRoundness(val);
                      triggerUpdate({ roundness: val }, false);
                    }}
                  />
                </View>
              )}

              {/* Rotation Angle Slider */}
              <View style={styles.sliderRow}>
                <CompactSliderInput
                  label="Rotate"
                  value={maskRotation}
                  min={-180}
                  max={180}
                  step={1}
                  unit="°"
                  defaultValue={0}
                  showReset={true}
                  showSteppers={true}
                  accentColor="#FFFFFF"
                  onDragStart={() => setIsSliderDragging(true)}
                  onDragEnd={() => {
                    setIsSliderDragging(false);
                    triggerUpdate({}, true);
                  }}
                  onChange={(val) => {
                    setMaskRotation(val);
                    triggerUpdate({ rotation: val }, false);
                  }}
                  onReset={() => {
                    setMaskRotation(0);
                    triggerUpdate({ rotation: 0 }, true);
                  }}
                />
              </View>

              {/* Position HUD & Sliders */}
              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <Text style={styles.sliderLabel}>Position</Text>
                  {(maskX !== 0 || maskY !== 0) && (
                    <TouchableOpacity
                      onPress={() => {
                        setMaskX(0);
                        setMaskY(0);
                        triggerUpdate({ x: 0, y: 0 });
                      }}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 3,
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Center mask position"
                    >
                      <Ionicons name="locate-outline" size={11} color="#A1A1AA" />
                    </TouchableOpacity>
                  )}
                </View>
                <CompactSliderInput
                  label="X"
                  value={maskX}
                  min={-100}
                  max={100}
                  step={1}
                  unit="%"
                  defaultValue={0}
                  accentColor="#FFFFFF"
                  showSteppers={true}
                  onDragStart={() => setIsSliderDragging(true)}
                  onDragEnd={() => setIsSliderDragging(false)}
                  onChange={(val) => {
                    setMaskX(val);
                    triggerUpdate({ x: val });
                  }}
                />
                <CompactSliderInput
                  label="Y"
                  value={maskY}
                  min={-100}
                  max={100}
                  step={1}
                  unit="%"
                  defaultValue={0}
                  accentColor="#FFFFFF"
                  showSteppers={true}
                  onDragStart={() => setIsSliderDragging(true)}
                  onDragEnd={() => setIsSliderDragging(false)}
                  onChange={(val) => {
                    setMaskY(val);
                    triggerUpdate({ y: val });
                  }}
                />
              </View>

              {/* Invert Mask Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => {
                  const next = !maskInverted;
                  setMaskInverted(next);
                  triggerUpdate({ inverted: next });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.sliderLabel}>
                  Invert Mask (Outside Area)
                </Text>
                <Ionicons
                  name={maskInverted ? "checkbox" : "square-outline"}
                  size={18}
                  color={maskInverted ? "#00F2FE" : "#71717A"}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

export const MaskModal = React.memo(MaskModalComponent);
export default MaskModal;

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#121214",
  },
  unifiedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    backgroundColor: "#121214",
  },
  sheetTitle: {
    color: "#EDEDED",
    fontSize: 11.5,
    fontWeight: "500",
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#121214",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    maxHeight: "75%",
    borderTopWidth: 1,
    borderColor: "#1F1F23",
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 28,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: "#27272A",
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#121214",
    borderBottomWidth: 1,
    borderColor: "#1F1F23",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  headerTitle: {
    color: "#EDEDED",
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
    flexDirection: "row",
    alignItems: "center",
  },
  resetText: {
    color: "#00F2FE",
    fontSize: 9.5,
    fontWeight: "600",
  },
  contentScroll: {
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  groupContainer: {
    gap: 5,
    paddingBottom: 8,
  },
  maskGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  maskCard: {
    width: "23.8%",
    backgroundColor: "#18181A",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  maskCardActive: {
    borderColor: "#00F2FE",
    backgroundColor: "#18181A",
  },
  maskCardTitle: {
    color: "#8A8A8E",
    fontSize: 8.5,
    fontWeight: "400",
    marginTop: 2,
    textAlign: "center",
  },
  maskCardTitleActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  controlsCard: {
    backgroundColor: "#18181A",
    borderRadius: 4,
    padding: 5,
    borderWidth: 1,
    borderColor: "#27272A",
    gap: 4,
  },
  sliderRow: {
    gap: 2,
  },
  labelValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabel: {
    color: "#94A3B8",
    fontSize: 9.5,
    fontWeight: "400",
  },
  badge: {
    color: "#CBD5E1",
    fontSize: 9.5,
    fontWeight: "400",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#1F1F23",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 2,
  },
  stepBtn: {
    backgroundColor: "#27272A",
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#3F3F46",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperVal: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "500",
    minWidth: 32,
    textAlign: "center",
  },
  dimHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
  },
  dimLabel: {
    color: "#EDEDED",
    fontSize: 9.5,
    fontWeight: "400",
  },
  lockBtn: {
    width: 26,
    height: 26,
    borderRadius: 5,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  lockBtnActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  lockBtnText: {
    color: "#8E8E93",
    fontSize: 8.5,
    fontWeight: "400",
  },
  lockBtnTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  ratioPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginVertical: 2,
  },
  ratioPill: {
    backgroundColor: "#18181A",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  ratioPillActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  ratioPillText: {
    color: "#8E8E93",
    fontSize: 8.5,
    fontWeight: "400",
  },
  ratioPillTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  keyframeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "nowrap",
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    marginBottom: 4,
    gap: 4,
  },
  kfLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  kfTimePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    gap: 3,
    flexShrink: 1,
  },
  kfTimeText: {
    color: "#EDEDED",
    fontSize: 10,
    fontWeight: "500",
  },
  kfOffsetTime: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "400",
  },
  kfCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141416",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2.5,
    flexShrink: 0,
  },
  kfCountText: {
    color: "#EDEDED",
    fontSize: 9.5,
    fontWeight: "500",
  },
  kfActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  kfStepBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  kfStepBtnDisabled: {
    opacity: 0.35,
    backgroundColor: "#141416",
  },
  kfIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  kfIconBtnAdd: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  kfIconBtnRemove: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  kfIconBtnDisabled: {
    opacity: 0.35,
    backgroundColor: "#141416",
    borderColor: "#27272A",
  },
  kfDiamondBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "relative",
  },
  kfDiamondBtnActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  kfDiamondBtnAdd: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  kfDiamondBtnRemove: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  kfDiamondText: {
    color: "#8E8E93",
    fontSize: 10.5,
    fontWeight: "500",
  },
  kfDiamondTextActive: {
    color: "#00F2FE",
  },
  kfDiamondTextAdd: {
    color: "#FFFFFF",
  },
  kfDiamondTextRemove: {
    color: "#EF4444",
  },
  kfDiamondBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 1,
  },
  kfDiamondBadgeAdd: {
    backgroundColor: "#FFFFFF",
  },
  kfDiamondBadgeRemove: {
    backgroundColor: "#EF4444",
  },
  kfCountBadgeActive: {
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  kfCountTextActive: {
    color: "#00F2FE",
  },
  kfNoKeyframesBadge: {
    backgroundColor: "#161B26",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2.5,
  },
  kfNoKeyframesText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "500",
  },
  kfClearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4.5,
  },
  kfClearAllText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "600",
  },
  kfConfirmClearBtn: {
    backgroundColor: "#EF4444",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 4.5,
  },
  kfConfirmClearText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  kfCancelClearBtn: {
    backgroundColor: "#182030",
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 4.5,
    borderWidth: 1,
    borderColor: "#26334A",
  },
});
