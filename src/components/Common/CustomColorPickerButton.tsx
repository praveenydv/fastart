import React, { useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";

const WebInput: any = Platform.OS === "web" ? "input" : View;

export interface CustomColorPickerButtonProps {
  value: string;
  presets: (string | { color?: string; value?: string; id?: string })[];
  onColorChange: (color: string) => void;
  size?: number;
  shape?: "circle" | "square";
  iconSize?: number;
  accessibilityLabel?: string;
  style?: any;
}

export const CustomColorPickerButton: React.FC<CustomColorPickerButtonProps> = ({
  value,
  presets,
  onColorChange,
  size = 24,
  shape = "circle",
  iconSize,
  accessibilityLabel = "Pick custom color",
  style,
}) => {
  const inputRef = useRef<any>(null);

  // Normalize color to uppercase hex
  const curVal = (value || "").trim().toUpperCase();

  // Check if current value matches any preset
  const isPreset =
    curVal === "NONE" ||
    curVal === "TRANSPARENT" ||
    !curVal ||
    presets.some((p) => {
      const hex =
        typeof p === "string"
          ? p
          : (p.color || p.value || p.id || "");
      return hex.trim().toUpperCase() === curVal;
    });

  const isCustomActive = !isPreset && curVal.startsWith("#");

  // Determine contrast for icon when custom background color is applied
  const isLightColor = (hex: string): boolean => {
    if (!hex || !hex.startsWith("#")) return false;
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length >= 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    // Standard luminance formula
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 160;
  };

  const calculatedIconSize = iconSize || Math.max(11, Math.round(size * 0.52));

  const handleClick = () => {
    soundEngine.playSfx("click");

    if (Platform.OS === "web") {
      inputRef.current?.click();
    } else if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        "Custom Hex Color",
        "Enter color code (e.g. #00F2FE or #FF0050):",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Apply",
            onPress: (text?: string) => {
              if (text) {
                let hex = text.trim();
                if (!hex.startsWith("#")) hex = `#${hex}`;
                if (/^#[0-9A-Fa-f]{3,8}$/.test(hex)) {
                  onColorChange(hex);
                }
              }
            },
          },
        ],
        "plain-text",
        value.startsWith("#") ? value : "#00F2FE"
      );
    } else {
      // Android / generic native prompt fallback
      if (inputRef.current?.click) {
        inputRef.current.click();
      }
    }
  };

  const borderRadius = shape === "circle" ? size / 2 : 6;

  const dynamicStyle = {
    width: size,
    height: size,
    borderRadius,
    ...(isCustomActive
      ? {
          backgroundColor: value,
          borderWidth: 2,
          borderColor: "#00F2FE",
          transform: [{ scale: 1.06 }],
        }
      : {}),
  };

  const iconColor = isCustomActive
    ? isLightColor(value)
      ? "#08090E"
      : "#FFFFFF"
    : "#00F2FE";

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, dynamicStyle, style]}
        onPress={handleClick}
        activeOpacity={0.8}
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons
          name="color-palette-outline"
          size={calculatedIconSize}
          color={iconColor}
        />
      </TouchableOpacity>

      {Platform.OS === "web" && (
        <WebInput
          ref={inputRef}
          type="color"
          value={value && value.startsWith("#") ? value : "#00F2FE"}
          onChange={(e: any) => {
            if (e?.target?.value) {
              onColorChange(e.target.value);
            }
          }}
          style={styles.hiddenInput}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.45)",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
    pointerEvents: "none",
  },
});

export default CustomColorPickerButton;

