import React from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  StyleSheet,
  Platform,
  GestureResponderEvent,
} from "react-native";
import { triggerHaptic, HapticType } from "../../utils/haptics";

export interface TactileButtonProps extends Omit<PressableProps, "style"> {
  /** Style for the button (object, array, or function based on pressed state) */
  style?:
    | StyleProp<ViewStyle>
    | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Active opacity on press (default: 0.8) */
  activeOpacity?: number;
  /** Active scale multiplier on press (default: 0.95 for snappy micro-press feel; set 1.0 to disable scale) */
  activeScale?: number;
  /** Android material ripple color (default: 'rgba(0, 242, 254, 0.22)') */
  rippleColor?: string;
  /** Whether the ripple expands beyond bounds (true for circular icon buttons) */
  rippleBorderless?: boolean;
  /** Haptic feedback type on press (default: 'selection'; false to disable) */
  haptic?: HapticType | boolean;
  /** Hit slop padding for easier mobile tapping (default: 8px on all sides if not specified) */
  hitSlop?: PressableProps["hitSlop"];
  /** Children (ReactNode or function based on pressed state) */
  children?:
    | React.ReactNode
    | ((state: { pressed: boolean }) => React.ReactNode);
}

const DEFAULT_RIPPLE_COLOR = "rgba(0, 242, 254, 0.22)";
const DEFAULT_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
const DEFAULT_PRESS_RETENTION = { top: 20, bottom: 20, left: 20, right: 20 };

/**
 * TactileButton: High-performance, tactile pressable with native Android ripple,
 * zero-delay visual response, micro-scale spring bounce, and instant mechanical haptics.
 */
export const TactileButton = React.forwardRef<any, TactileButtonProps>(
  (
    {
      style,
      activeOpacity = 0.8,
      activeScale = 0.95,
      rippleColor = DEFAULT_RIPPLE_COLOR,
      rippleBorderless = false,
      haptic = "selection",
      hitSlop = DEFAULT_HIT_SLOP,
      disabled,
      onPress,
      onPressIn,
      onPressOut,
      children,
      ...restProps
    },
    ref,
  ) => {
    const handlePressIn = (e: GestureResponderEvent) => {
      onPressIn?.(e);
    };

    const handlePress = (e: GestureResponderEvent) => {
      if (!disabled) {
        if (haptic !== false) {
          const hapticType = typeof haptic === "string" ? haptic : "selection";
          triggerHaptic(hapticType);
        }
      }
      onPress?.(e);
    };

    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        hitSlop={hitSlop}
        pressRetentionOffset={DEFAULT_PRESS_RETENTION}
        unstable_pressDelay={0}
        android_ripple={
          disabled
            ? null
            : {
                color: rippleColor,
                borderless: rippleBorderless,
                foreground: Platform.OS === "android",
              }
        }
        onPressIn={handlePressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
        style={
          ((state: { pressed: boolean }) => {
            const resolvedStyle =
              typeof style === "function" ? style(state) : style;
            const flatStyle = {
              ...((StyleSheet.flatten(resolvedStyle) || {}) as ViewStyle),
            };

            if (Platform.OS === "web") {
              (flatStyle as any).cursor = disabled ? "default" : "pointer";
              (flatStyle as any).touchAction = "manipulation";
              (flatStyle as any).userSelect = "none";
              (flatStyle as any).WebkitTapHighlightColor = "transparent";
            }

            // Critical defensive safeguard: remove null/undefined transform to prevent React Native processTransform crash
            if (
              flatStyle.transform === null ||
              flatStyle.transform === undefined
            ) {
              delete flatStyle.transform;
            } else if (Array.isArray(flatStyle.transform)) {
              flatStyle.transform = flatStyle.transform.filter(Boolean);
              if (flatStyle.transform.length === 0) {
                delete flatStyle.transform;
              }
            }

            if (disabled) {
              return [flatStyle, { opacity: (flatStyle.opacity ?? 1) * 0.45 }];
            }

            if (state.pressed) {
              const existingTransforms = Array.isArray(flatStyle.transform)
                ? flatStyle.transform
                : [];
              const hasScale = activeScale !== 1;
              const combinedTransforms = hasScale
                ? [...existingTransforms, { scale: activeScale }]
                : existingTransforms;

              return [
                flatStyle,
                {
                  opacity: (flatStyle.opacity ?? 1) * activeOpacity,
                  ...(combinedTransforms.length > 0
                    ? { transform: combinedTransforms }
                    : {}),
                },
              ];
            }

            return flatStyle;
          }) as any
        }
        {...restProps}
      >
        {typeof children === "function" ? (state) => children(state) : children}
      </Pressable>
    );
  },
);

TactileButton.displayName = "TactileButton";

export default TactileButton;
