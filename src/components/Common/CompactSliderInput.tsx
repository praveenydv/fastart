import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  PanResponder,
} from 'react-native';
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
  inputWidth?: number;            // width of numeric input box (default ~52)
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
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
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const currentValueRef = useRef<number>(value);
  currentValueRef.current = value;

  const inputRef = useRef<any>(null);
  const trackRef = useRef<any>(null);
  const trackLayoutRef = useRef<{ left: number; width: number }>({ left: 0, width: 1 });
  const capturedPointerIdRef = useRef<number | null>(null);

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

  const handleSliderChange = useCallback((raw: number) => {
    if (disabled) return;
    const clamped = Math.max(min, Math.min(max, raw));
    const rounded = parseFloat(clamped.toFixed(precision));
    setTextVal(formatNumber(rounded));
    onChange(rounded);
  }, [disabled, min, max, precision, onChange]);

  const handleStepDelta = useCallback((delta: number) => {
    if (disabled) return;
    const next = Math.max(min, Math.min(max, currentValueRef.current + delta));
    const rounded = parseFloat(next.toFixed(precision));
    handleSliderChange(rounded);
    onChangeEnd?.(rounded);
  }, [disabled, min, max, precision, handleSliderChange, onChangeEnd]);

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

  // Percentage for track fill and thumb placement (clamped 0..100)
  const range = Math.max(0.0001, max - min);
  const percent = Math.max(0, Math.min(100, ((value - min) / range) * 100));

  // ── Universal Pointer Event Handlers for Web (Supports Mouse, Touch & Pen with Pointer Capture) ──
  const handlePointerDown = (e: any) => {
    if (disabled) return;
    setIsDragging(true);
    isDraggingRef.current = true;

    const target = e.currentTarget || e.target;
    if (target) {
      if (typeof target.setPointerCapture === 'function' && e.pointerId !== undefined) {
        try {
          target.setPointerCapture(e.pointerId);
          capturedPointerIdRef.current = e.pointerId;
        } catch (_) {}
      }

      if (typeof target.getBoundingClientRect === 'function') {
        const rect = target.getBoundingClientRect();
        if (rect && rect.width > 0) {
          trackLayoutRef.current = { left: rect.left, width: rect.width };
          const clientX = e.clientX ?? (e.nativeEvent && e.nativeEvent.clientX);
          if (clientX !== undefined) {
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const rawVal = min + ratio * (max - min);
            const stepped = Math.round((rawVal - min) / step) * step + min;
            handleSliderChange(stepped);
          }
        }
      }
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDraggingRef.current || disabled) return;
    const { left, width } = trackLayoutRef.current;
    if (width <= 0) return;
    const clientX = e.clientX ?? (e.nativeEvent && e.nativeEvent.clientX);
    if (clientX === undefined) return;
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    const rawVal = min + ratio * (max - min);
    const stepped = Math.round((rawVal - min) / step) * step + min;
    handleSliderChange(stepped);
  };

  const handlePointerUp = (e: any) => {
    if (!isDraggingRef.current) return;
    setIsDragging(false);
    isDraggingRef.current = false;

    const target = e.currentTarget || e.target;
    if (
      target &&
      typeof target.releasePointerCapture === 'function' &&
      capturedPointerIdRef.current !== null
    ) {
      try {
        target.releasePointerCapture(capturedPointerIdRef.current);
      } catch (_) {}
      capturedPointerIdRef.current = null;
    }

    onChangeEnd?.(currentValueRef.current);
  };

  // Keyboard navigation on Web (Arrow keys, Home, End, PageUp, PageDown)
  const handleKeyDown = (e: any) => {
    if (disabled) return;
    let handled = false;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      handleStepDelta(-step);
      handled = true;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      handleStepDelta(step);
      handled = true;
    } else if (e.key === 'PageDown') {
      handleStepDelta(-step * 5);
      handled = true;
    } else if (e.key === 'PageUp') {
      handleStepDelta(step * 5);
      handled = true;
    } else if (e.key === 'Home') {
      handleSliderChange(min);
      onChangeEnd?.(min);
      handled = true;
    } else if (e.key === 'End') {
      handleSliderChange(max);
      onChangeEnd?.(max);
      handled = true;
    }
    if (handled) {
      e.preventDefault?.();
      e.stopPropagation?.();
    }
  };

  // ── PanResponder for Native iOS/Android ──
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onStartShouldSetPanResponderCapture: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        isDraggingRef.current = true;
        const { pageX, locationX } = evt.nativeEvent;
        const { width } = trackLayoutRef.current;
        if (pageX !== undefined && locationX !== undefined) {
          trackLayoutRef.current.left = pageX - locationX;
        }
        if (width > 0) {
          const curX =
            locationX !== undefined
              ? locationX
              : pageX !== undefined
              ? pageX - trackLayoutRef.current.left
              : 0;
          const ratio = Math.max(0, Math.min(1, curX / width));
          const rawVal = min + ratio * (max - min);
          const stepped = Math.round((rawVal - min) / step) * step + min;
          handleSliderChange(stepped);
        }
      },
      onPanResponderMove: (evt) => {
        if (!isDraggingRef.current || disabled) return;
        const { pageX } = evt.nativeEvent;
        const { left, width } = trackLayoutRef.current;
        if (width > 0 && pageX !== undefined) {
          const ratio = Math.max(0, Math.min(1, (pageX - left) / width));
          const rawVal = min + ratio * (max - min);
          const stepped = Math.round((rawVal - min) / step) * step + min;
          handleSliderChange(stepped);
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        isDraggingRef.current = false;
        onChangeEnd?.(currentValueRef.current);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        isDraggingRef.current = false;
        onChangeEnd?.(currentValueRef.current);
      },
    })
  ).current;

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

  // Universal interactive slider track (works seamlessly on Web and Mobile)
  const renderSliderTrack = () => (
    <View
      ref={trackRef}
      collapsable={false}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        trackLayoutRef.current.width = width;
        if (Platform.OS === 'web' && trackRef.current) {
          try {
            const el = trackRef.current as any;
            if (el && typeof el.getBoundingClientRect === 'function') {
              const rect = el.getBoundingClientRect();
              trackLayoutRef.current.left = rect.left;
              trackLayoutRef.current.width = rect.width;
            }
          } catch (_) {}
        } else if (trackRef.current && (trackRef.current as any).measureInWindow) {
          (trackRef.current as any).measureInWindow((x: number) => {
            if (x !== undefined && !isNaN(x)) {
              trackLayoutRef.current.left = x;
            }
          });
        }
      }}
      style={[
        styles.sliderTrackHitbox,
        Platform.OS === 'web'
          ? ({
              touchAction: 'none',
              userSelect: 'none',
              cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'pointer',
              outlineStyle: 'none',
            } as any)
          : null,
      ]}
      {...(Platform.OS === 'web'
        ? {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerUp,
            onKeyDown: handleKeyDown,
            tabIndex: disabled ? -1 : 0,
            role: 'slider',
            'aria-valuenow': value,
            'aria-valuemin': min,
            'aria-valuemax': max,
          }
        : panResponder.panHandlers)}
    >
      {/* Background Track Line */}
      <View style={styles.trackBackground} pointerEvents="none">
        {/* Active Colored Progress Fill Bar */}
        <View
          style={[
            styles.trackFill,
            {
              width: `${percent}%`,
              backgroundColor: accentColor,
            },
          ]}
        />
      </View>

      {/* Visual Thumb Indicator (with active glow and scaling) */}
      <View
        style={[
          styles.thumbNode,
          {
            left: `${percent}%`,
            borderColor: accentColor,
            shadowColor: accentColor,
            transform: [{ scale: isDragging ? 1.22 : 1 }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.thumbCenterDot, { backgroundColor: accentColor }]} />
      </View>
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
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Decrease"
        >
          <Ionicons name="remove" size={14} color="#CBD5E1" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>{renderSliderTrack()}</View>

        <TouchableOpacity
          style={[styles.stepperBtn, (disabled || value >= max) && styles.disabledOpacity]}
          onPress={() => handleStepDelta(step)}
          disabled={disabled || value >= max}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Increase"
        >
          <Ionicons name="add" size={14} color="#CBD5E1" />
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
    paddingVertical: 4,
  },
  inlineContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
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
    gap: 6,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 80,
    maxWidth: 120,
  },
  iconBox: {
    marginRight: 2,
  },
  labelTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  positivePrefix: {
    color: THEME_COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  sliderRow: {
    width: '100%',
    marginTop: 2,
  },
  trackWithSteppersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  stepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
  // Full-height hitbox for comfortable touch & click targets
  sliderTrackHitbox: {
    width: '100%',
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    width: '100%',
    height: 6,
    backgroundColor: '#23252C',
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  thumbNode: {
    position: 'absolute',
    top: '50%',
    marginTop: -9,
    marginLeft: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbCenterDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
    fontSize: 10,
    fontWeight: '700',
  },
  hintText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  disabledOpacity: {
    opacity: 0.4,
  },
});

export default CompactSliderInput;
