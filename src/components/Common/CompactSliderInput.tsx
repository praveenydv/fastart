import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from './TactileTouchable';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { THEME_COLORS } from '../../constants/designConstants';

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
  layout?: 'stack' | 'inline';    // 'stack' (label + input on top, slider below) or 'inline' (label, slider, input in 1 row)
  inputWidth?: number;            // width of numeric input box (default ~54)
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onReset?: () => void;
}

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
  accentColor = THEME_COLORS.accent,
  icon,
  hint,
  layout = 'stack',
  inputWidth = 54,
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

  const formatNumber = (num: number): string => {
    if (isNaN(num)) return '0';
    return precision > 0 ? num.toFixed(precision) : Math.round(num).toString();
  };

  const [textVal, setTextVal] = useState<string>(() => formatNumber(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [_isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const currentValueRef = useRef<number>(value);
  currentValueRef.current = value;

  const inputRef = useRef<any>(null);

  // Sync internal text when external value changes and not focused
  useEffect(() => {
    if (!isFocused) {
      setTextVal(formatNumber(value));
    }
  }, [value, isFocused, precision]);

  const commitValue = (raw: string) => {
    let parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      parsed = defaultValue !== undefined ? defaultValue : value;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    const rounded = parseFloat(clamped.toFixed(precision));
    setTextVal(formatNumber(rounded));
    onChange(rounded);
    onChangeEnd?.(rounded);
  };

  const handleSliderChange = useCallback(
    (raw: number) => {
      if (disabled) return;
      const clamped = Math.max(min, Math.min(max, raw));
      const rounded = parseFloat(clamped.toFixed(precision));
      currentValueRef.current = rounded;
      setTextVal(formatNumber(rounded));
      onChange(rounded);
    },
    [disabled, min, max, precision, onChange]
  );

  const handleStepDelta = useCallback(
    (delta: number) => {
      if (disabled) return;
      const next = Math.max(min, Math.min(max, currentValueRef.current + delta));
      const rounded = parseFloat(next.toFixed(precision));
      handleSliderChange(rounded);
      onChangeEnd?.(rounded);
    },
    [disabled, min, max, precision, handleSliderChange, onChangeEnd]
  );

  const handleReset = () => {
    if (disabled) return;
    if (onReset) {
      onReset();
    } else if (defaultValue !== undefined) {
      handleSliderChange(defaultValue);
      onChangeEnd?.(defaultValue);
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
              onChange(parseFloat(parsed.toFixed(precision)));
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

  // Native Expo Slider component
  const renderSliderTrack = () => (
    <View style={styles.sliderTrackContainer}>
      <Slider
        style={styles.nativeSlider}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor={accentColor}
        maximumTrackTintColor="#27272A"
        thumbTintColor={accentColor}
        disabled={disabled}
        tapToSeek={true}
        onSlidingStart={() => {
          isDraggingRef.current = true;
          setIsDragging(true);
          onDragStart?.();
        }}
        onValueChange={(val) => {
          handleSliderChange(val);
        }}
        onSlidingComplete={(val) => {
          isDraggingRef.current = false;
          setIsDragging(false);
          onDragEnd?.();
          const clamped = Math.max(min, Math.min(max, val));
          const rounded = parseFloat(clamped.toFixed(precision));
          onChangeEnd?.(rounded);
        }}
      />
    </View>
  );

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
          <View style={styles.inlineLabelBox}>
            {icon ? <View style={styles.iconBox}>{icon}</View> : null}
            <Text style={styles.labelTitle} numberOfLines={1}>
              {label}
            </Text>
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
              <Ionicons name="refresh" size={11} color={THEME_COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
          {renderSmallInput()}
        </View>
      </View>
    );
  }

  // Default 'stack' layout (Label + Small Input on top, Slider below)
  return (
    <View style={[styles.stackContainer, containerStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {icon ? <View style={styles.iconBox}>{icon}</View> : null}
          <Text style={styles.labelTitle}>{label}</Text>
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
              <Ionicons name="refresh" size={10} color={THEME_COLORS.accent} />
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
    paddingVertical: 2,
  },
  inlineContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 70,
    maxWidth: 110,
  },
  iconBox: {
    marginRight: 2,
  },
  labelTitle: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0,
  },
  positivePrefix: {
    color: THEME_COLORS.accent,
    fontSize: 9.5,
    fontWeight: '500',
  },
  sliderRow: {
    width: '100%',
    marginTop: 1,
  },
  trackWithSteppersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  stepperBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16171B',
    borderWidth: 1,
    borderColor: '#292B33',
    borderRadius: 3,
    paddingHorizontal: 3,
  },
  inputWrapperFocused: {
    borderColor: THEME_COLORS.accent,
    backgroundColor: '#1B1C22',
  },
  textInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    margin: 0,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'center',
    outlineStyle: 'none' as any,
  },
  unitText: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '400',
    marginLeft: 1,
  },
  // Native slider container with comfortable height & hit targets
  sliderTrackContainer: {
    width: '100%',
    height: 24,
    justifyContent: 'center',
  },
  nativeSlider: {
    width: '100%',
    height: 24,
  },
  tinyResetBtn: {
    padding: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resetBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 229, 201, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 201, 0.25)',
  },
  resetBadgeText: {
    color: THEME_COLORS.accent,
    fontSize: 8.5,
    fontWeight: '500',
  },
  hintText: {
    color: '#64748B',
    fontSize: 8.5,
    marginTop: 1,
  },
  disabledOpacity: {
    opacity: 0.4,
  },
});

export default CompactSliderInput;
