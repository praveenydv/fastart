import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from './TactileTouchable';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'capcut-slider-styles';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    .capcut-thin-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 18px;
      background-color: transparent !important;
      background-repeat: no-repeat !important;
      background-size: 100% 2px !important;
      background-position: center !important;
      outline: none;
      margin: 0;
      padding: 0;
      cursor: pointer;
    }
    .capcut-thin-slider:focus,
    .capcut-thin-slider:active {
      outline: none;
      background-size: 100% 2px !important;
    }
    .capcut-thin-slider::-webkit-slider-runnable-track {
      height: 2px !important;
      max-height: 2px !important;
      border-radius: 1px;
      background: transparent !important;
      border: none;
    }
    .capcut-thin-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #FFFFFF;
      margin-top: -4px;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      border: none;
    }
    .capcut-thin-slider::-webkit-slider-thumb:active {
      width: 10px;
      height: 10px;
      background: #FFFFFF;
    }
    .capcut-thin-slider::-moz-range-track {
      height: 2px !important;
      max-height: 2px !important;
      border-radius: 1px;
      background: transparent !important;
      border: none;
    }
    .capcut-thin-slider::-moz-range-thumb {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #FFFFFF;
      border: none;
      cursor: pointer;
    }
    .capcut-thin-slider::-moz-range-thumb:active {
      width: 10px;
      height: 10px;
      background: #FFFFFF;
    }
  `;
}

export interface CompactSliderInputProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;                  // e.g. '°', '%', 'px', 'x', 's'
  decimals?: number;              // decimal places (default derived from step)
  prefix?: string;                // e.g. '+' for positive values
  defaultValue?: number;          // enables reset button
  showReset?: boolean;
  showSteppers?: boolean;         // adds - and + stepper buttons flanking the slider
  accentColor?: string;
  icon?: React.ReactNode;
  hint?: string;
  layout?: 'stack' | 'inline';    // 'stack' (label + input on top, full-width slider below) or 'inline'
  labelWidth?: number;            // custom width for inline label
  labelStyle?: StyleProp<TextStyle>;
  inputWidth?: number;            // width of numeric input box (default ~48)
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onReset?: () => void;
}

// Precision-safe step snapper that eliminates IEEE 754 floating point drift
const snapToStep = (
  val: number,
  minVal: number,
  maxVal: number,
  stepVal?: number,
  prec: number = 0,
): number => {
  const clamped = Math.max(minVal, Math.min(maxVal, val));
  if (!stepVal || stepVal <= 0) {
    return parseFloat(clamped.toFixed(prec));
  }
  const steps = Math.round((clamped - minVal) / stepVal);
  const rawSnapped = minVal + steps * stepVal;
  const bounded = Math.max(minVal, Math.min(maxVal, rawSnapped));
  return parseFloat(bounded.toFixed(prec));
};

export const CompactSliderInput: React.FC<CompactSliderInputProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  decimals,
  prefix = '',
  defaultValue,
  showReset,
  showSteppers = false,
  accentColor = '#FFFFFF',
  icon,
  hint,
  layout = 'stack',
  labelWidth,
  labelStyle,
  inputWidth = 48,
  containerStyle,
  disabled = false,
  onChange,
  onChangeEnd,
  onDragStart,
  onDragEnd,
  onReset,
}) => {
  // Determine appropriate decimal precision
  const precision =
    decimals !== undefined
      ? decimals
      : step < 1
      ? Math.max(1, (step.toString().split('.')[1] || '').length)
      : 0;

  const formatNumber = useCallback(
    (num: number): string => {
      if (isNaN(num)) return '0';
      return precision > 0 ? num.toFixed(precision) : Math.round(num).toString();
    },
    [precision],
  );

  const [localVal, setLocalVal] = useState<number>(() =>
    snapToStep(value, min, max, step, precision),
  );
  const [textVal, setTextVal] = useState<string>(() => formatNumber(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const latestValueRef = useRef<number>(value);
  const lastCommittedValueRef = useRef<number>(value);
  const lastEmitTimeRef = useRef<number>(0);
  const lastDragEndTimeRef = useRef<number>(0);
  const throttleTimerRef = useRef<any>(null);

  const inputRef = useRef<any>(null);

  // Clean up any pending throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, []);

  // Sync internal text & slider when external value changes and not actively dragging/focused
  useEffect(() => {
    // If user is focused on numeric input, do NOT overwrite
    if (isFocused) return;
    // If user is actively dragging, do NOT overwrite with lagging parent render
    if (isDraggingRef.current) return;

    // If incoming value matches our last committed value, we are already in sync
    if (value === lastCommittedValueRef.current) return;

    // Guard against delayed backlog renders from parent.
    // If drag ended less than 600ms ago, the parent is still flushing old queued state updates
    // that were initiated BEFORE drag ended. Do NOT let those past values overwrite the user's final value!
    const timeSinceDragEnd = Date.now() - lastDragEndTimeRef.current;
    if (timeSinceDragEnd < 600) {
      return;
    }

    const snapped = snapToStep(value, min, max, step, precision);
    setLocalVal(snapped);
    latestValueRef.current = snapped;
    lastCommittedValueRef.current = snapped;
    setTextVal(formatNumber(snapped));
  }, [value, isFocused, precision, min, max, step, formatNumber]);

  const commitValue = useCallback(
    (raw: string) => {
      let parsed = parseFloat(raw);
      if (isNaN(parsed)) {
        parsed = defaultValue !== undefined ? defaultValue : value;
      }
      const snapped = snapToStep(parsed, min, max, step, precision);
      latestValueRef.current = snapped;
      lastCommittedValueRef.current = snapped;
      lastDragEndTimeRef.current = Date.now();
      setLocalVal(snapped);
      setTextVal(formatNumber(snapped));
      onChange(snapped);
      onChangeEnd?.(snapped);
    },
    [defaultValue, value, min, max, step, precision, formatNumber, onChange, onChangeEnd],
  );

  const handleSliderChange = useCallback(
    (raw: number) => {
      if (disabled) return;
      const snapped = snapToStep(raw, min, max, step, precision);
      latestValueRef.current = snapped;

      // 1. Immediately update local UI so the thumb & numeric text respond with 0ms latency
      setLocalVal(snapped);
      setTextVal(formatNumber(snapped));

      // 2. Throttle parent onChange updates (40ms interval = ~25fps)
      // This completely prevents congesting the JS thread with 120 heavy project/canvas renders per second
      const now = Date.now();
      const elapsed = now - lastEmitTimeRef.current;

      if (elapsed >= 40) {
        lastEmitTimeRef.current = now;
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        onChange(snapped);
      } else if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null;
          lastEmitTimeRef.current = Date.now();
          if (isDraggingRef.current) {
            onChange(latestValueRef.current);
          }
        }, 40 - elapsed);
      }
    },
    [disabled, min, max, step, precision, formatNumber, onChange],
  );

  const handleSliderComplete = useCallback(
    (raw?: number) => {
      isDraggingRef.current = false;
      lastDragEndTimeRef.current = Date.now();
      onDragEnd?.();

      // Cancel any pending throttled timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }

      const finalVal =
        typeof raw === "number" && !isNaN(raw)
          ? snapToStep(raw, min, max, step, precision)
          : latestValueRef.current;

      latestValueRef.current = finalVal;
      lastCommittedValueRef.current = finalVal;
      lastEmitTimeRef.current = Date.now();

      setLocalVal(finalVal);
      setTextVal(formatNumber(finalVal));

      // Emit final value immediately without any throttle
      onChange(finalVal);
      onChangeEnd?.(finalVal);
    },
    [min, max, step, precision, formatNumber, onChange, onChangeEnd, onDragEnd],
  );

  const handleStepDelta = useCallback(
    (delta: number) => {
      if (disabled) return;
      const next = latestValueRef.current + delta;
      const snapped = snapToStep(next, min, max, step, precision);
      latestValueRef.current = snapped;
      lastCommittedValueRef.current = snapped;
      lastDragEndTimeRef.current = Date.now();
      setLocalVal(snapped);
      setTextVal(formatNumber(snapped));
      onChange(snapped);
      onChangeEnd?.(snapped);
    },
    [disabled, min, max, step, precision, formatNumber, onChange, onChangeEnd],
  );

  const handleReset = () => {
    if (disabled) return;
    if (onReset) {
      onReset();
    } else if (defaultValue !== undefined) {
      const snapped = snapToStep(defaultValue, min, max, step, precision);
      latestValueRef.current = snapped;
      lastCommittedValueRef.current = snapped;
      lastDragEndTimeRef.current = Date.now();
      setLocalVal(snapped);
      setTextVal(formatNumber(snapped));
      onChange(snapped);
      onChangeEnd?.(snapped);
    }
  };

  const canReset =
    (showReset || defaultValue !== undefined) &&
    defaultValue !== undefined &&
    Math.abs(value - defaultValue) > 0.0001;

  // Small size numeric input component
  const renderSmallInput = () => (
    <View
      style={[
        styles.inputWrapper,
        { width: inputWidth + (unit ? 16 : 0) },
        isFocused && styles.inputWrapperFocused,
        disabled && styles.disabledOpacity,
      ]}
    >
      <TextInput
        ref={inputRef}
        style={styles.textInput}
        value={textVal}
        keyboardType="numeric"
        editable={!disabled}
        selectTextOnFocus
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          commitValue(textVal);
        }}
        onChangeText={(txt) => {
          setTextVal(txt);
          if (txt !== '-' && txt !== '.' && txt !== '-.' && !txt.endsWith('.')) {
            const parsed = parseFloat(txt);
            if (!isNaN(parsed) && parsed >= min && parsed <= max) {
              const snapped = snapToStep(parsed, min, max, step, precision);
              latestValueRef.current = snapped;
              lastCommittedValueRef.current = snapped;
              lastDragEndTimeRef.current = Date.now();
              setLocalVal(snapped);
              onChange(snapped);
            }
          }
        }}
        onSubmitEditing={() => {
          setIsFocused(false);
          commitValue(textVal);
        }}
        {...(Platform.OS === 'web'
          ? {
              onKeyDown: (e: any) => {
                if (e.key === 'Enter') {
                  e.target?.blur?.();
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  handleStepDelta(step);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  handleStepDelta(-step);
                }
              },
            }
          : {})}
      />
      {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
    </View>
  );

  const renderWebSlider = () => {
    const rangePercent =
      max > min
        ? Math.max(0, Math.min(100, ((localVal - min) / (max - min)) * 100))
        : 0;
    const effectiveStep =
      step && step > 0 ? step : precision > 0 ? Math.pow(10, -precision) : 1;
    const fillColor = accentColor || '#FFFFFF';

    return (
      <View style={styles.sliderTrackContainer}>
        <input
          type="range"
          className="capcut-thin-slider"
          min={min}
          max={max}
          step={effectiveStep}
          value={localVal}
          disabled={disabled}
          onMouseDown={() => {
            isDraggingRef.current = true;
            onDragStart?.();
          }}
          onTouchStart={() => {
            isDraggingRef.current = true;
            onDragStart?.();
          }}
          onChange={(e: any) => {
            const raw = parseFloat(e.target.value);
            if (!isNaN(raw)) {
              handleSliderChange(raw);
            }
          }}
          onInput={(e: any) => {
            const raw = parseFloat(e.target.value);
            if (!isNaN(raw)) {
              handleSliderChange(raw);
            }
          }}
          onMouseUp={(e: any) => {
            const raw = parseFloat(e.target.value);
            handleSliderComplete(!isNaN(raw) ? raw : undefined);
          }}
          onTouchEnd={(e: any) => {
            const raw = parseFloat(e.target.value);
            handleSliderComplete(!isNaN(raw) ? raw : undefined);
          }}
          style={
            {
              width: "100%",
              height: 18,
              cursor: disabled ? "not-allowed" : "pointer",
              backgroundImage: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${rangePercent}%, #27272A ${rangePercent}%, #27272A 100%)`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 2px",
              backgroundPosition: "center",
              backgroundColor: "transparent",
              outline: "none",
              margin: 0,
              padding: 0,
              opacity: disabled ? 0.35 : 1,
            } as any
          }
        />
      </View>
    );
  };

  const renderNativeSlider = () => (
    <View style={styles.sliderTrackContainer}>
      <Slider
        style={styles.nativeSlider}
        value={localVal}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor={accentColor || "#FFFFFF"}
        maximumTrackTintColor="#27272A"
        thumbTintColor="#FFFFFF"
        disabled={disabled}
        tapToSeek={true}
        onSlidingStart={() => {
          isDraggingRef.current = true;
          onDragStart?.();
        }}
        onValueChange={(val) => {
          handleSliderChange(val);
        }}
        onSlidingComplete={(val) => {
          handleSliderComplete(val);
        }}
      />
    </View>
  );

  const renderSliderTrack = () =>
    Platform.OS === "web" ? renderWebSlider() : renderNativeSlider();

  const renderTrackWithSteppers = () => {
    if (!showSteppers) return renderSliderTrack();

    return (
      <View style={styles.trackWithSteppersRow}>
        <TouchableOpacity
          style={[styles.stepperBtn, (disabled || value <= min) && styles.disabledOpacity]}
          onPress={() => handleStepDelta(-step)}
          disabled={disabled || value <= min}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Decrease"
        >
          <Ionicons name="remove" size={12} color="#CBD5E1" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 2 }}>{renderSliderTrack()}</View>

        <TouchableOpacity
          style={[styles.stepperBtn, (disabled || value >= max) && styles.disabledOpacity]}
          onPress={() => handleStepDelta(step)}
          disabled={disabled || value >= max}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Increase"
        >
          <Ionicons name="add" size={12} color="#CBD5E1" />
        </TouchableOpacity>
      </View>
    );
  };

  if (layout === 'inline') {
    return (
      <View style={[styles.inlineContainer, containerStyle]}>
        {label ? (
          <View
            style={[
              styles.inlineLabelBox,
              labelWidth != null
                ? { width: labelWidth, minWidth: labelWidth, maxWidth: labelWidth }
                : null,
            ]}
          >
            {icon ? <View style={styles.iconBox}>{icon}</View> : null}
            <Text
              style={[styles.labelTitle, labelStyle]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label}
            </Text>
            {prefix && value > 0 ? (
              <Text style={styles.positivePrefix}>({prefix})</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.inlineSliderFlex}>{renderTrackWithSteppers()}</View>

        <View style={styles.inlineRightControls}>
          {canReset ? (
            <TouchableOpacity
              onPress={handleReset}
              style={styles.tinyResetBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Reset"
            >
              <Ionicons name="refresh" size={11} color="#00F2FE" />
            </TouchableOpacity>
          ) : null}
          {renderSmallInput()}
        </View>
      </View>
    );
  }

  // Fallback 'stack' layout (Label + Small Input on top, Slider below)
  return (
    <View style={[styles.stackContainer, containerStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {icon ? <View style={styles.iconBox}>{icon}</View> : null}
          <Text style={[styles.labelTitle, labelStyle]}>{label}</Text>
          {prefix && value > 0 ? (
            <Text style={styles.positivePrefix}>({prefix})</Text>
          ) : null}
        </View>

        <View style={styles.headerRight}>
          {canReset ? (
            <TouchableOpacity
              onPress={handleReset}
              style={styles.resetBadgeBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Reset to default"
            >
              <Ionicons name="refresh" size={10} color="#00F2FE" />
              <Text style={styles.resetBadgeText}>Reset</Text>
            </TouchableOpacity>
          ) : null}
          {renderSmallInput()}
        </View>
      </View>

      <View style={styles.sliderRow}>{renderTrackWithSteppers()}</View>

      {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  stackContainer: {
    width: '100%',
    paddingVertical: 3,
  },
  inlineContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inlineLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 54,
    maxWidth: 95,
    flexShrink: 0,
  },
  iconBox: {
    marginRight: 2,
  },
  labelTitle: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  positivePrefix: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '400',
  },
  sliderRow: {
    width: '100%',
    marginTop: 1,
  },
  trackWithSteppersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    width: '100%',
  },
  stepperBtn: {
    width: 17,
    height: 17,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineSliderFlex: {
    flex: 1,
  },
  inlineRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  // Small size numeric input box
  inputWrapper: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#26262B',
    borderRadius: 3,
    paddingHorizontal: 3,
  },
  inputWrapperFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#18181B',
  },
  textInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    margin: 0,
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '400',
    textAlign: 'center',
    outlineStyle: 'none' as any,
  },
  unitText: {
    color: '#71717A',
    fontSize: 8.5,
    fontWeight: '400',
    marginLeft: 1,
  },
  // Native slider container with comfortable height & hit targets
  sliderTrackContainer: {
    width: '100%',
    height: 22,
    justifyContent: 'center',
  },
  nativeSlider: {
    width: '100%',
    height: 22,
  },
  tinyResetBtn: {
    padding: 2,
    borderRadius: 3,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  resetBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  resetBadgeText: {
    color: '#00F2FE',
    fontSize: 8.5,
    fontWeight: '600',
  },
  hintText: {
    color: '#64748B',
    fontSize: 8.5,
    marginTop: 1,
  },
  disabledOpacity: {
    opacity: 0.35,
  },
});

export default CompactSliderInput;
