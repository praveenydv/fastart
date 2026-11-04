import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
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

// Precision-safe step snapper that eliminates IEEE 754 floating point drift
const snapToStep = (
  val: number,
  minVal: number,
  maxVal: number,
  stepVal?: number,
): number => {
  const clamped = Math.max(minVal, Math.min(maxVal, val));
  if (!stepVal || stepVal <= 0) {
    return parseFloat(clamped.toFixed(2));
  }
  const steps = Math.round((clamped - minVal) / stepVal);
  const rawSnapped = minVal + steps * stepVal;
  const bounded = Math.max(minVal, Math.min(maxVal, rawSnapped));
  const precision = stepVal < 1 ? Math.max(1, (stepVal.toString().split(".")[1] || "").length) : 0;
  return parseFloat(bounded.toFixed(precision));
};

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
  const [localVal, setLocalVal] = useState<number>(() =>
    snapToStep(value, min, max, step),
  );
  const isDraggingRef = useRef<boolean>(false);
  const latestValueRef = useRef<number>(value);
  const lastCommittedValueRef = useRef<number>(value);
  const lastEmitTimeRef = useRef<number>(0);
  const lastDragEndTimeRef = useRef<number>(0);
  const throttleTimerRef = useRef<any>(null);

  // Clean up any pending throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, []);

  // Sync internal slider value only when user is NOT dragging & not from stale backlog
  useEffect(() => {
    if (isDraggingRef.current) return;
    if (value === lastCommittedValueRef.current) return;

    const timeSinceDragEnd = Date.now() - lastDragEndTimeRef.current;
    if (timeSinceDragEnd < 600) {
      return;
    }

    const snapped = snapToStep(value, min, max, step);
    setLocalVal(snapped);
    latestValueRef.current = snapped;
    lastCommittedValueRef.current = snapped;
  }, [value, min, max, step]);

  const handleChange = useCallback(
    (raw: number) => {
      const snapped = snapToStep(raw, min, max, step);
      latestValueRef.current = snapped;
      setLocalVal(snapped);

      const now = Date.now();
      const elapsed = now - lastEmitTimeRef.current;

      if (elapsed >= 40) {
        lastEmitTimeRef.current = now;
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        onValueChange(snapped);
      } else if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null;
          lastEmitTimeRef.current = Date.now();
          if (isDraggingRef.current) {
            onValueChange(latestValueRef.current);
          }
        }, 40 - elapsed);
      }
    },
    [min, max, step, onValueChange],
  );

  const handleComplete = useCallback(
    (raw?: number) => {
      isDraggingRef.current = false;
      lastDragEndTimeRef.current = Date.now();

      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }

      const finalVal =
        typeof raw === "number" && !isNaN(raw)
          ? snapToStep(raw, min, max, step)
          : latestValueRef.current;

      latestValueRef.current = finalVal;
      lastCommittedValueRef.current = finalVal;
      lastEmitTimeRef.current = Date.now();

      setLocalVal(finalVal);
      onValueChange(finalVal);
      onValueChangeComplete?.(finalVal);
    },
    [min, max, step, onValueChange, onValueChangeComplete],
  );

  const displayVal = formatValue
    ? formatValue(localVal)
    : `${Math.round(localVal)}${unit}`;
  const canReset =
    onReset ||
    (defaultValue !== undefined && Math.abs(localVal - defaultValue) > 0.001);

  const rangePercent =
    max > min
      ? Math.max(0, Math.min(100, ((localVal - min) / (max - min)) * 100))
      : 0;

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
                else if (defaultValue !== undefined) {
                  handleChange(defaultValue);
                  handleComplete(defaultValue);
                }
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
        {Platform.OS === "web" ? (
          <input
            type="range"
            min={min}
            max={max}
            step={step || 1}
            value={localVal}
            onMouseDown={() => {
              isDraggingRef.current = true;
            }}
            onTouchStart={() => {
              isDraggingRef.current = true;
            }}
            onChange={(e: any) => {
              const raw = parseFloat(e.target.value);
              if (!isNaN(raw)) {
                handleChange(raw);
              }
            }}
            onInput={(e: any) => {
              const raw = parseFloat(e.target.value);
              if (!isNaN(raw)) {
                handleChange(raw);
              }
            }}
            onMouseUp={(e: any) => {
              const raw = parseFloat(e.target.value);
              handleComplete(!isNaN(raw) ? raw : undefined);
            }}
            onTouchEnd={(e: any) => {
              const raw = parseFloat(e.target.value);
              handleComplete(!isNaN(raw) ? raw : undefined);
            }}
            style={
              {
                width: "100%",
                height: 20,
                cursor: "pointer",
                accentColor: "#00F2FE",
                background: `linear-gradient(to right, #00F2FE 0%, #00F2FE ${rangePercent}%, #1F2637 ${rangePercent}%, #1F2637 100%)`,
                borderRadius: 3,
                outline: "none",
                margin: 0,
                padding: 0,
              } as any
            }
          />
        ) : (
          <Slider
            value={localVal}
            minimumValue={min}
            maximumValue={max}
            step={step}
            minimumTrackTintColor="#00F2FE"
            maximumTrackTintColor="#1F2637"
            thumbTintColor="#00F2FE"
            onSlidingStart={() => {
              isDraggingRef.current = true;
            }}
            onValueChange={handleChange}
            onSlidingComplete={handleComplete}
            style={styles.slider}
          />
        )}
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

