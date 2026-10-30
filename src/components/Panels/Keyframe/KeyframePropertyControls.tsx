import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { ClipTransform, KeyframeEasing } from "../../../types/project";
import { styles } from "./KeyframeModalStyles";
import { CompactSliderInput } from "../../Common/CompactSliderInput";

const WebDiv: any = Platform.OS === "web" ? "div" : View;
const WebInput: any = Platform.OS === "web" ? "input" : View;

interface KeyframePropertyControlsProps {
  hasKeyframeAtCurrentTime: boolean;
  activeScale: number;
  activeRotation: number;
  activeX: number;
  activeY: number;
  activeOpacity: number;
  activeEasing?: KeyframeEasing;
  activeTransform: ClipTransform;
  localTime: number;
  onUpdateKeyframeTransform?: (
    time: number,
    transform: Partial<ClipTransform>,
    opacity?: number,
    easing?: KeyframeEasing,
  ) => void;
}

export default function KeyframePropertyControls({
  hasKeyframeAtCurrentTime,
  activeScale,
  activeRotation,
  activeX,
  activeY,
  activeOpacity,
  activeEasing = "easeInOut",
  activeTransform,
  localTime,
  onUpdateKeyframeTransform,
}: KeyframePropertyControlsProps) {
  const handleUpdateProperty = (
    key: "scale" | "rotation" | "x" | "y" | "opacity",
    value: number,
  ) => {
    soundEngine.playSfx("click");
    if (onUpdateKeyframeTransform) {
      if (key === "opacity") {
        onUpdateKeyframeTransform(localTime, activeTransform, value, activeEasing);
      } else {
        onUpdateKeyframeTransform(
          localTime,
          { ...activeTransform, [key]: value },
          activeOpacity,
          activeEasing,
        );
      }
    }
  };

  const handleUpdateEasing = (easing: KeyframeEasing) => {
    soundEngine.playSfx("pop");
    if (onUpdateKeyframeTransform) {
      onUpdateKeyframeTransform(localTime, activeTransform, activeOpacity, easing);
    }
  };

  return (
    <View style={styles.propertySection}>
      <Text style={styles.sectionHeader}>
        {hasKeyframeAtCurrentTime
          ? "KEYFRAME PROPERTIES (AT DIAMOND)"
          : "CLIP PROPERTIES (ADD KEYFRAME TO SAVE)"}
      </Text>

      {/* 1. SCALE */}
      <View style={styles.propertyRow}>
        <CompactSliderInput
          label="Scale / Zoom"
          icon={<Ionicons name="expand" size={14} color="#00F2FE" />}
          value={activeScale}
          min={0.2}
          max={3.0}
          step={0.01}
          unit="x"
          decimals={2}
          defaultValue={1.0}
          accentColor="#00F2FE"
          onChange={(val) => handleUpdateProperty("scale", val)}
        />

        {/* Scale Presets */}
        <View style={styles.presetRow}>
          {[0.5, 1.0, 1.5, 2.0].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.presetChip,
                Math.abs(activeScale - s) < 0.05 && styles.presetChipActive,
              ]}
              onPress={() => handleUpdateProperty("scale", s)}
            >
              <Text
                style={[
                  styles.presetChipText,
                  Math.abs(activeScale - s) < 0.05 &&
                    styles.presetChipTextActive,
                ]}
              >
                {s}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 2. ROTATION */}
      <View style={styles.propertyRow}>
        <CompactSliderInput
          label="Rotation"
          icon={<Ionicons name="refresh" size={14} color="#00F2FE" />}
          value={activeRotation}
          min={-180}
          max={180}
          step={1}
          unit="°"
          defaultValue={0}
          accentColor="#00F2FE"
          onChange={(val) => handleUpdateProperty("rotation", val)}
        />

        {/* Rotation Presets */}
        <View style={styles.presetRow}>
          {[-90, 0, 90, 180].map((r) => (
            <TouchableOpacity
              key={r}
              style={[
                styles.presetChip,
                activeRotation === r && styles.presetChipActive,
              ]}
              onPress={() => handleUpdateProperty("rotation", r)}
            >
              <Text
                style={[
                  styles.presetChipText,
                  activeRotation === r && styles.presetChipTextActive,
                ]}
              >
                {r}°
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 3. POSITION NUDGE & SLIDERS (X & Y) */}
      <View style={styles.propertyRow}>
        <CompactSliderInput
          label="Position X"
          icon={<Ionicons name="move-outline" size={14} color="#00F2FE" />}
          value={activeX}
          min={-400}
          max={400}
          step={1}
          unit="px"
          defaultValue={0}
          accentColor="#00F2FE"
          onChange={(val) => handleUpdateProperty("x", val)}
        />
        <CompactSliderInput
          label="Position Y"
          icon={<Ionicons name="move-outline" size={14} color="#00F2FE" />}
          value={activeY}
          min={-400}
          max={400}
          step={1}
          unit="px"
          defaultValue={0}
          accentColor="#00F2FE"
          onChange={(val) => handleUpdateProperty("y", val)}
        />

        <View style={styles.nudgePad}>
          <TouchableOpacity
            style={styles.nudgeBtn}
            onPress={() => handleUpdateProperty("y", activeY - 15)}
          >
            <Ionicons name="arrow-up" size={14} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.nudgeMiddleRow}>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => handleUpdateProperty("x", activeX - 15)}
            >
              <Ionicons name="arrow-back" size={14} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nudgeCenterBtn}
              onPress={() => {
                soundEngine.playSfx("pop");
                if (onUpdateKeyframeTransform) {
                  onUpdateKeyframeTransform(
                    localTime,
                    { ...activeTransform, x: 0, y: 0 },
                    activeOpacity,
                  );
                }
              }}
            >
              <Text style={styles.nudgeCenterText}>Center</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => handleUpdateProperty("x", activeX + 15)}
            >
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.nudgeBtn}
            onPress={() => handleUpdateProperty("y", activeY + 15)}
          >
            <Ionicons name="arrow-down" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. OPACITY */}
      <View style={styles.propertyRow}>
        <CompactSliderInput
          label="Opacity"
          icon={<Ionicons name="contrast-outline" size={14} color="#00F2FE" />}
          value={Math.round(activeOpacity * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          defaultValue={100}
          accentColor="#00F2FE"
          onChange={(val) => handleUpdateProperty("opacity", val / 100)}
        />

        {/* Opacity Presets */}
        <View style={styles.presetRow}>
          {[0.25, 0.5, 0.75, 1.0].map((op) => (
            <TouchableOpacity
              key={op}
              style={[
                styles.presetChip,
                Math.abs(activeOpacity - op) < 0.05 && styles.presetChipActive,
              ]}
              onPress={() => handleUpdateProperty("opacity", op)}
            >
              <Text
                style={[
                  styles.presetChipText,
                  Math.abs(activeOpacity - op) < 0.05 &&
                    styles.presetChipTextActive,
                ]}
              >
                {Math.round(op * 100)}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 5. EASING CURVE (CapCut Style Interpolation Curves) */}
      <View style={styles.propertyRow}>
        <View style={styles.propLabelRow}>
          <View style={styles.propLabelLeft}>
            <Ionicons name="pulse" size={14} color="#00F2FE" />
            <Text style={styles.propName}>Animation Curve / Easing</Text>
          </View>
          <Text style={[styles.propValue, { color: "#00F2FE", fontWeight: "700" }]}>
            {activeEasing}
          </Text>
        </View>

        <View style={[styles.presetRow, { flexWrap: "wrap", gap: 6, marginTop: 6 }]}>
          {(
            [
              { id: "linear", label: "Linear", icon: "remove" },
              { id: "easeInOut", label: "Ease In-Out", icon: "swap-horizontal" },
              { id: "easeIn", label: "Ease In", icon: "trending-down" },
              { id: "easeOut", label: "Ease Out", icon: "trending-up" },
              { id: "spring", label: "Spring", icon: "sparkles" },
              { id: "smooth", label: "Smooth", icon: "water" },
            ] as const
          ).map((c) => {
            const isSelected = activeEasing === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.presetChip,
                  { paddingHorizontal: 10, paddingVertical: 6, height: 28 },
                  isSelected && styles.presetChipActive,
                ]}
                onPress={() => handleUpdateEasing(c.id as KeyframeEasing)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={c.icon as any}
                  size={12}
                  color={isSelected ? "#00F2FE" : "#94A3B8"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.presetChipText,
                    isSelected && styles.presetChipTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 6. MASK KEYFRAME PROPERTIES */}
      {activeTransform.mask && activeTransform.mask.shape !== 'none' && (
        <View style={styles.propertyRow}>
          <View style={styles.propLabelRow}>
            <View style={styles.propLabelLeft}>
              <Ionicons name="shapes-outline" size={14} color="#00F2FE" />
              <Text style={styles.propName}>
                Mask Keyframe ({activeTransform.mask.shape.toUpperCase()})
              </Text>
            </View>
          </View>

          <CompactSliderInput
            label="Mask Size"
            icon={<Ionicons name="resize-outline" size={13} color="#00F2FE" />}
            value={activeTransform.mask.size ?? 60}
            min={10}
            max={100}
            step={1}
            unit="%"
            defaultValue={60}
            accentColor="#00F2FE"
            onChange={(val) => {
              if (onUpdateKeyframeTransform) {
                const updatedMask = {
                  ...activeTransform.mask!,
                  size: val,
                  width: val,
                  height: val,
                };
                onUpdateKeyframeTransform(
                  localTime,
                  { ...activeTransform, mask: updatedMask },
                  activeOpacity,
                  activeEasing,
                );
              }
            }}
          />

          <CompactSliderInput
            label="Mask Feather"
            icon={<Ionicons name="water-outline" size={13} color="#00F2FE" />}
            value={activeTransform.mask.feather ?? 0}
            min={0}
            max={50}
            step={1}
            unit="px"
            defaultValue={0}
            accentColor="#00F2FE"
            onChange={(val) => {
              if (onUpdateKeyframeTransform) {
                const updatedMask = {
                  ...activeTransform.mask!,
                  feather: val,
                };
                onUpdateKeyframeTransform(
                  localTime,
                  { ...activeTransform, mask: updatedMask },
                  activeOpacity,
                  activeEasing,
                );
              }
            }}
          />

          <CompactSliderInput
            label="Mask Rotation"
            icon={<Ionicons name="refresh-outline" size={13} color="#00F2FE" />}
            value={activeTransform.mask.rotation ?? 0}
            min={-180}
            max={180}
            step={1}
            unit="°"
            defaultValue={0}
            accentColor="#00F2FE"
            onChange={(val) => {
              if (onUpdateKeyframeTransform) {
                const updatedMask = {
                  ...activeTransform.mask!,
                  rotation: val,
                };
                onUpdateKeyframeTransform(
                  localTime,
                  { ...activeTransform, mask: updatedMask },
                  activeOpacity,
                  activeEasing,
                );
              }
            }}
          />

          <CompactSliderInput
            label="Mask Position X"
            icon={<Ionicons name="move-outline" size={13} color="#00F2FE" />}
            value={activeTransform.mask.x ?? 0}
            min={-100}
            max={100}
            step={1}
            unit="%"
            defaultValue={0}
            accentColor="#00F2FE"
            onChange={(val) => {
              if (onUpdateKeyframeTransform) {
                const updatedMask = {
                  ...activeTransform.mask!,
                  x: val,
                };
                onUpdateKeyframeTransform(
                  localTime,
                  { ...activeTransform, mask: updatedMask },
                  activeOpacity,
                  activeEasing,
                );
              }
            }}
          />

          <CompactSliderInput
            label="Mask Position Y"
            icon={<Ionicons name="move-outline" size={13} color="#00F2FE" />}
            value={activeTransform.mask.y ?? 0}
            min={-100}
            max={100}
            step={1}
            unit="%"
            defaultValue={0}
            accentColor="#00F2FE"
            onChange={(val) => {
              if (onUpdateKeyframeTransform) {
                const updatedMask = {
                  ...activeTransform.mask!,
                  y: val,
                };
                onUpdateKeyframeTransform(
                  localTime,
                  { ...activeTransform, mask: updatedMask },
                  activeOpacity,
                  activeEasing,
                );
              }
            }}
          />
        </View>
      )}
    </View>
  );
}
