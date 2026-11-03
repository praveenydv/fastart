import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "./TactileTouchable";
import { Ionicons } from "@expo/vector-icons";

// Comprehensive palette of 32 vibrant colors across all spectrums
const EXTENDED_PALETTE = [
  // Reds & Corals
  "#FF0050", "#EF4444", "#DC2626", "#F43F5E",
  // Oranges & Ambers
  "#FF6B00", "#F97316", "#F59E0B", "#FFE600",
  // Limes & Greens
  "#84CC16", "#22C55E", "#10B981", "#059669",
  // Cyans & Teals
  "#00F2FE", "#06B6D4", "#14B8A6", "#0D9488",
  // Blues & Indigos
  "#0047FF", "#3B82F6", "#2563EB", "#6366F1",
  // Purples & Violets
  "#8B5CF6", "#A855F7", "#9333EA", "#7E22CE",
  // Magentas & Pinks
  "#FF00FF", "#D946EF", "#EC4899", "#DB2777",
  // Neutrals & Monochromes
  "#FFFFFF", "#CBD5E1", "#64748B", "#000000",
];

const SPECTRUM_HUES = [
  "#FF0000", "#FF4500", "#FF8C00", "#FFD700",
  "#FFE600", "#ADFF2F", "#00FF00", "#00FF7F",
  "#00F2FE", "#00BFFF", "#0047FF", "#4B0082",
  "#8B5CF6", "#FF00FF", "#FF1493", "#FFFFFF", "#000000"
];

export interface CustomColorPickerButtonProps {
  value: string;
  presets?: (string | { color?: string; value?: string; id?: string })[];
  onColorChange: (color: string) => void;
  size?: number;
  shape?: "circle" | "square";
  iconSize?: number;
  accessibilityLabel?: string;
  style?: any;
  onPickFromScreen?: () => void;
}

export const CustomColorPickerButton: React.FC<CustomColorPickerButtonProps> = ({
  value,
  presets = [],
  onColorChange,
  size = 24,
  shape = "circle",
  iconSize,
  accessibilityLabel = "Pick custom color",
  style,
  onPickFromScreen,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [hexInput, setHexInput] = useState(value || "#00F2FE");
  const [tempColor, setTempColor] = useState(value || "#00F2FE");
  const webInputRef = useRef<any>(null);

  const curVal = (value || "").trim().toUpperCase();

  const isPreset =
    curVal === "NONE" ||
    curVal === "TRANSPARENT" ||
    !curVal ||
    presets.some((p) => {
      const hex = typeof p === "string" ? p : p.color || p.value || p.id || "";
      return hex.trim().toUpperCase() === curVal;
    });

  const isCustomActive = !isPreset && curVal.startsWith("#");

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
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 160;
  };

  const calculatedIconSize = iconSize || Math.max(11, Math.round(size * 0.52));

  const handleOpen = () => {
    if (Platform.OS === "web") {
      // On web, if native input is supported, trigger it; else show native modal
      if (webInputRef.current) {
        webInputRef.current.click();
        return;
      }
    }
    setTempColor(value && value.startsWith("#") ? value : "#00F2FE");
    setHexInput(value && value.startsWith("#") ? value.toUpperCase() : "#00F2FE");
    setModalVisible(true);
  };

  const handleSelectColor = (col: string) => {
    setTempColor(col);
    setHexInput(col.toUpperCase());
  };

  const handleHexChange = (text: string) => {
    let clean = text.trim();
    if (!clean.startsWith("#") && clean.length > 0) clean = `#${clean}`;
    setHexInput(clean.toUpperCase());
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      setTempColor(clean);
    }
  };

  const handleApply = () => {
    let finalColor = hexInput;
    if (!finalColor.startsWith("#")) finalColor = `#${finalColor}`;
    if (/^#[0-9A-Fa-f]{3,8}$/.test(finalColor)) {
      onColorChange(finalColor);
    } else if (tempColor) {
      onColorChange(tempColor);
    }
    setModalVisible(false);
  };

  const borderRadius = shape === "circle" ? size / 2 : 6;
  const dynamicStyle = {
    width: size,
    height: size,
    borderRadius,
    ...(isCustomActive
      ? {
          backgroundColor: value,
          borderWidth: 1.5,
          borderColor: "#00F2FE",
          transform: [{ scale: 1.05 }],
        }
      : {}),
  };

  const iconColor = isCustomActive
    ? isLightColor(value)
      ? "#08090E"
      : "#FFFFFF"
    : "#00F2FE";

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={[s.btn, dynamicStyle, style]}
        onPress={handleOpen}
        activeOpacity={0.8}
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons
          name="color-palette-outline"
          size={calculatedIconSize}
          color={iconColor}
        />
      </TouchableOpacity>

      {/* Hidden input for web browser native picker */}
      {Platform.OS === "web" && (
        <input
          ref={webInputRef}
          type="color"
          value={value && value.startsWith("#") ? value : "#00F2FE"}
          onChange={(e: any) => {
            if (e?.target?.value) {
              onColorChange(e.target.value);
            }
          }}
          style={s.hiddenInput as any}
        />
      )}

      {/* 100% Native Cross-Platform Color Palette Dialog for iOS, Android & Fallback Web */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity
            style={s.modalSheet}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={s.modalHeader}>
              <View style={s.headerTitleRow}>
                <Ionicons name="color-palette" size={16} color="#00F2FE" />
                <Text style={s.modalTitle}>Custom Color</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {onPickFromScreen && (
                  <TouchableOpacity
                    style={s.pickFromScreenBtn}
                    onPress={() => {
                      setModalVisible(false);
                      onPickFromScreen();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eyedrop" size={12} color="#00F2FE" />
                    <Text style={s.pickFromScreenBtnText}>Sample Screen</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={s.closeBtn}
                  accessibilityLabel="Close color picker"
                >
                  <Ionicons name="close" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Preview & Hex Input Row */}
            <View style={s.previewRow}>
              <View style={[s.livePreviewSwatch, { backgroundColor: tempColor }]} />
              <View style={s.hexInputContainer}>
                <Text style={s.hexPrefix}>#</Text>
                <TextInput
                  style={s.hexTextInput}
                  value={hexInput.replace("#", "")}
                  onChangeText={(t) => handleHexChange(t)}
                  placeholder="00F2FE"
                  placeholderTextColor="#64748B"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Rainbow Spectrum Hues Bar for Smooth Finger Selection */}
            <View style={s.spectrumContainer}>
              <Text style={s.paletteLabel}>SPECTRUM HUES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.spectrumScroll}>
                {SPECTRUM_HUES.map((col) => {
                  const isSelected = tempColor.toUpperCase() === col.toUpperCase();
                  return (
                    <TouchableOpacity
                      key={col}
                      style={[
                        s.spectrumSwatch,
                        { backgroundColor: col },
                        isSelected && s.spectrumSwatchSelected,
                      ]}
                      onPress={() => handleSelectColor(col)}
                      activeOpacity={0.8}
                    />
                  );
                })}
              </ScrollView>
            </View>

            {/* Palette Swatches Grid */}
            <ScrollView style={s.paletteScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.paletteLabel}>PALETTE</Text>
              <View style={s.swatchesGrid}>
                {EXTENDED_PALETTE.map((col) => {
                  const isSelected = tempColor.toUpperCase() === col.toUpperCase();
                  return (
                    <TouchableOpacity
                      key={col}
                      style={[
                        s.paletteSwatch,
                        { backgroundColor: col },
                        isSelected && s.paletteSwatchSelected,
                      ]}
                      onPress={() => handleSelectColor(col)}
                      activeOpacity={0.8}
                      accessibilityLabel={`Select color ${col}`}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={isLightColor(col) ? "#000000" : "#FFFFFF"}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.applyBtn}
                onPress={handleApply}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={14} color="#08090E" />
                <Text style={s.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.4)",
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
    pointerEvents: "none",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#0F1420",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2638",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
  },
  pickFromScreenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pickFromScreenBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#00F2FE",
  },
  spectrumContainer: {
    marginBottom: 12,
  },
  spectrumScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  spectrumSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  spectrumSwatchSelected: {
    borderColor: "#00F2FE",
    borderWidth: 2,
    transform: [{ scale: 1.15 }],
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  livePreviewSwatch: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  hexInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A0D15",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1E2638",
    paddingHorizontal: 10,
    height: 38,
  },
  hexPrefix: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00F2FE",
    marginRight: 2,
  },
  hexTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.8,
    padding: 0,
  },
  paletteScroll: {
    maxHeight: 180,
    marginBottom: 14,
  },
  paletteLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  swatchesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  paletteSwatch: {
    width: 27,
    height: 27,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  paletteSwatchSelected: {
    borderColor: "#00F2FE",
    borderWidth: 2,
    transform: [{ scale: 1.15 }],
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "#161D2E",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
  applyBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "#00F2FE",
  },
  applyBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#08090E",
  },
});
