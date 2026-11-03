import React from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TactileTouchable } from "./TactileTouchable";
import Slider from "@react-native-community/slider";

export interface SliderControlRowProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  formatValue?: (val: number) => string;
  icon?: keyof typeof Ionicons.glyphMap;
  onValueChange: (val: number) => void;
  onValueChangeComplete?: (val: number) => void;
  onReset?: () => void;
  defaultValue?: number;
  style?: StyleProp<ViewStyle>;
}

export function SliderControlRow({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  formatValue,
  icon,
  onValueChange,
  onValueChangeComplete,
  onReset,
  defaultValue,
  style,
}: SliderControlRowProps) {
  const displayVal = formatValue
    ? formatValue(value)
    : `${Math.round(value)}${unit}`;
  const canReset =
    onReset ||
    (defaultValue !== undefined && Math.abs(value - defaultValue) > 0.001);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.labelRow}>
        <View style={styles.titleWrapper}>
          {icon && (
            <Ionicons
              name={icon}
              size={14}
              color="#00F2FE"
              style={styles.labelIcon}
            />
          )}
          <Text style={styles.labelText}>{label}</Text>
        </View>

        <View style={styles.valueRow}>
          <View style={styles.valueBadge}>
            <Text style={styles.valueText}>{displayVal}</Text>
          </View>
          {canReset && (
            <TactileTouchable
              onPress={() => {
                if (onReset) onReset();
                else if (defaultValue !== undefined)
                  onValueChange(defaultValue);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.resetBtn}
              accessibilityLabel={`Reset ${label}`}
              accessibilityRole="button"
            >
              <Ionicons name="refresh-outline" size={13} color="#64748B" />
            </TactileTouchable>
          )}
        </View>
      </View>

      <View style={styles.sliderWrapper}>
        <Slider
          value={value}
          minimumValue={min}
          maximumValue={max}
          step={step}
          minimumTrackTintColor="#00F2FE"
          maximumTrackTintColor="#1F2637"
          thumbTintColor="#00F2FE"
          onValueChange={onValueChange}
          onSlidingComplete={onValueChangeComplete}
          style={styles.slider}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelIcon: {
    marginRight: 6,
  },
  labelText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  valueBadge: {
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  valueText: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "700",
  },
  resetBtn: {
    marginLeft: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderWrapper: {
    height: 36,
    justifyContent: "center",
  },
  slider: {
    width: "100%",
    height: 36,
  },
});

