import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME_COLORS } from '../../constants/designConstants';

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : TextInput;

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
  accentColor?: string;
  icon?: React.ReactNode;
  hint?: string;
  layout?: 'stack' | 'inline';    // 'stack' (label + input on top, slider below) or 'inline' (label, slider, input in 1 row)
  inputWidth?: number;            // width of numeric input box (default ~52)
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onChange: (value: number) => void;
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
  accentColor = THEME_COLORS.accent,
  icon,
  hint,
  layout = 'stack',
  inputWidth = 54,
  containerStyle,
  disabled = false,
  onChange,
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
  };

  const handleSliderChange = (raw: number) => {
    if (disabled) return;
    const clamped = Math.max(min, Math.min(max, raw));
    const rounded = parseFloat(clamped.toFixed(precision));
    setTextVal(formatNumber(rounded));
    onChange(rounded);
  };

  const handleReset = () => {
    if (disabled) return;
    if (onReset) {
      onReset();
    } else if (defaultValue !== undefined) {
      handleSliderChange(defaultValue);
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
          // If a valid numeric value without pending decimal or minus sign, update live
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
                  handleSliderChange(value + step);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  handleSliderChange(value - step);
                }
              },
            }
          : {})}
      />
      {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
    </View>
  );

  // Slider track component
  const renderSliderTrack = () => (
    <View style={styles.sliderTrackContainer}>
      {Platform.OS === 'web' ? (
        <WebDiv style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
          <WebInput
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              handleSliderChange(val);
            }}
            style={{
              width: '100%',
              accentColor: accentColor,
              height: 4,
              borderRadius: 2,
              cursor: disabled ? 'not-allowed' : 'pointer',
              backgroundColor: '#23252C',
              outline: 'none',
            }}
          />
        </WebDiv>
      ) : (
        // Mobile fallback interactive track with stepper buttons
        <View style={styles.mobileTrackRow}>
          <TouchableOpacity
            style={styles.mobileStepBtn}
            disabled={disabled || value <= min}
            onPress={() => handleSliderChange(value - step)}
          >
            <Ionicons name="remove" size={13} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.mobileBarTrack}>
            <View
              style={[
                styles.mobileBarFill,
                {
                  width: `${Math.max(
                    0,
                    Math.min(100, ((value - min) / Math.max(0.0001, max - min)) * 100)
                  )}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
          <TouchableOpacity
            style={styles.mobileStepBtn}
            disabled={disabled || value >= max}
            onPress={() => handleSliderChange(value + step)}
          >
            <Ionicons name="add" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

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

        <View style={styles.inlineSliderFlex}>{renderSliderTrack()}</View>

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
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={11} color={THEME_COLORS.accent} />
              <Text style={styles.resetBadgeText}>Reset</Text>
            </TouchableOpacity>
          ) : null}
          {renderSmallInput()}
        </View>
      </View>

      {renderSliderTrack()}

      {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
};

export default CompactSliderInput;

const styles = StyleSheet.create({
  stackContainer: {
    marginVertical: 4,
    width: '100%',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 3,
    width: '100%',
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
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBox: {
    marginRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelTitle: {
    color: '#E2E8F0',
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  positivePrefix: {
    color: THEME_COLORS.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  inlineLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 82,
    flexShrink: 0,
  },
  inlineSliderFlex: {
    flex: 1,
    paddingHorizontal: 2,
  },
  inlineRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  // Small size numeric input box
  inputWrapper: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16171B',
    borderWidth: 1,
    borderColor: '#292B33',
    borderRadius: 4,
    paddingHorizontal: 4,
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
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    outlineStyle: 'none' as any,
  },
  unitText: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
    marginLeft: 1,
  },
  sliderTrackContainer: {
    width: '100%',
    paddingVertical: 2,
  },
  tinyResetBtn: {
    padding: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resetBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 229, 201, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 201, 0.25)',
  },
  resetBadgeText: {
    color: THEME_COLORS.accent,
    fontSize: 9.5,
    fontWeight: '700',
  },
  hintText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  disabledOpacity: {
    opacity: 0.45,
  },
  // Mobile fallback
  mobileTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  mobileStepBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#222329',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#23252C',
    borderRadius: 2,
    overflow: 'hidden',
  },
  mobileBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});
