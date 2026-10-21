import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { ClipTransform } from "../../../types/project";
import { styles } from "./KeyframeModalStyles";

const WebDiv: any = Platform.OS === "web" ? "div" : View;
const WebInput: any = Platform.OS === "web" ? "input" : View;

interface KeyframePropertyControlsProps {
  hasKeyframeAtCurrentTime: boolean;
  activeScale: number;
  activeRotation: number;
  activeX: number;
  activeY: number;
  activeOpacity: number;
  activeTransform: ClipTransform;
  localTime: number;
  onUpdateKeyframeTransform?: (
    time: number,
    transform: Partial<ClipTransform>,
    opacity?: number,
  ) => void;
}

export default function KeyframePropertyControls({
  hasKeyframeAtCurrentTime,
  activeScale,
  activeRotation,
  activeX,
  activeY,
  activeOpacity,
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
        onUpdateKeyframeTransform(localTime, activeTransform, value);
      } else {
        onUpdateKeyframeTransform(
          localTime,
          { ...activeTransform, [key]: value },
          activeOpacity,
        );
      }
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
        <View style={styles.propLabelRow}>
          <View style={styles.propLabelLeft}>
            <Ionicons name="expand" size={15} color="#00F2FE" />
            <Text style={styles.propName}>Scale / Zoom</Text>
          </View>
          <Text style={styles.propValue}>{activeScale.toFixed(2)}x</Text>
        </View>

        {Platform.OS === "web" ? (
          <WebDiv style={{ margin: "6px 0 10px" }}>
            <WebInput
              type="range"
              min="0.2"
              max="3.0"
              step="0.05"
              value={activeScale}
              onChange={(e: any) =>
                handleUpdateProperty("scale", parseFloat(e.target.value))
              }
              style={{
                width: "100%",
                accentColor: "#00F2FE",
                height: 6,
                cursor: "pointer",
              }}
            />
          </WebDiv>
        ) : (
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() =>
                handleUpdateProperty(
                  "scale",
                  Math.max(0.2, parseFloat((activeScale - 0.1).toFixed(2))),
                )
              }
            >
              <Ionicons name="remove" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.stepperText}>{activeScale.toFixed(2)}x</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() =>
                handleUpdateProperty(
                  "scale",
                  Math.min(3.0, parseFloat((activeScale + 0.1).toFixed(2))),
                )
              }
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

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
        <View style={styles.propLabelRow}>
          <View style={styles.propLabelLeft}>
            <Ionicons name="refresh" size={15} color="#38BDF8" />
            <Text style={styles.propName}>Rotation</Text>
          </View>
          <Text style={styles.propValue}>{activeRotation}°</Text>
        </View>

        {Platform.OS === "web" ? (
          <WebDiv style={{ margin: "6px 0 10px" }}>
            <WebInput
              type="range"
              min="-180"
              max="180"
              step="5"
              value={activeRotation}
              onChange={(e: any) =>
                handleUpdateProperty("rotation", parseInt(e.target.value, 10))
              }
              style={{
                width: "100%",
                accentColor: "#38BDF8",
                height: 6,
                cursor: "pointer",
              }}
            />
          </WebDiv>
        ) : (
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() =>
                handleUpdateProperty("rotation", Math.max(-180, activeRotation - 15))
              }
            >
              <Ionicons name="remove" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.stepperText}>{activeRotation}°</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() =>
                handleUpdateProperty("rotation", Math.min(180, activeRotation + 15))
              }
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

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

      {/* 3. POSITION NUDGE (X & Y) */}
      <View style={styles.propertyRow}>
        <View style={styles.propLabelRow}>
          <View style={styles.propLabelLeft}>
            <Ionicons name="move-outline" size={15} color="#F59E0B" />
            <Text style={styles.propName}>Position Offset</Text>
          </View>
          <Text style={styles.propValue}>
            X: {activeX}px • Y: {activeY}px
          </Text>
        </View>

        <View style={styles.nudgePad}>
          <TouchableOpacity
            style={styles.nudgeBtn}
            onPress={() => handleUpdateProperty("y", activeY - 15)}
          >
            <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.nudgeMiddleRow}>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => handleUpdateProperty("x", activeX - 15)}
            >
              <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
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
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.nudgeBtn}
            onPress={() => handleUpdateProperty("y", activeY + 15)}
          >
            <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. OPACITY */}
      <View style={styles.propertyRow}>
        <View style={styles.propLabelRow}>
          <View style={styles.propLabelLeft}>
            <Ionicons name="contrast-outline" size={15} color="#10B981" />
            <Text style={styles.propName}>Opacity</Text>
          </View>
          <Text style={styles.propValue}>
            {Math.round(activeOpacity * 100)}%
          </Text>
        </View>

        {Platform.OS === "web" ? (
          <WebDiv style={{ margin: "6px 0 10px" }}>
            <WebInput
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={activeOpacity}
              onChange={(e: any) =>
                handleUpdateProperty("opacity", parseFloat(e.target.value))
              }
              style={{
                width: "100%",
                accentColor: "#10B981",
                height: 6,
                cursor: "pointer",
              }}
            />
          </WebDiv>
        ) : (
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() =>
                handleUpdateProperty(
                  "opacity",
                  Math.max(0, parseFloat((activeOpacity - 0.1).toFixed(2))),
                )
              }
            >
              <Ionicons name="remove" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.stepperText}>
              {Math.round(activeOpacity * 100)}%
            </Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() =>
                handleUpdateProperty(
                  "opacity",
                  Math.min(1.0, parseFloat((activeOpacity + 0.1).toFixed(2))),
                )
              }
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

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
    </View>
  );
}
