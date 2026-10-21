import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import {
  FONT_OPTIONS,
  COLOR_SWATCHES,
  BG_SWATCHES,
} from "./textModalConstants";
import { styles } from "./TextModalStyles";

interface TextStyleTabProps {
  selectedFont: string;
  setSelectedFont: (font: string) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  selectedBg: string;
  setSelectedBg: (bg: string) => void;
}

export default function TextStyleTab({
  selectedFont,
  setSelectedFont,
  selectedColor,
  setSelectedColor,
  selectedBg,
  setSelectedBg,
}: TextStyleTabProps) {
  return (
    <>
      {/* Font Family */}
      <Text style={styles.sectionTitle}>FONT FAMILY</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
      >
        {FONT_OPTIONS.map((f) => {
          const isActive = selectedFont === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.fontPill, isActive && styles.fontPillActive]}
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedFont(f.id);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.fontPillText,
                  isActive && styles.fontPillTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Text Color Palette */}
      <Text style={styles.sectionTitle}>TEXT COLOR</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
      >
        {COLOR_SWATCHES.map((color) => {
          const isSelected = selectedColor === color;
          return (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorCircle,
                { backgroundColor: color },
                isSelected && styles.colorCircleSelected,
              ]}
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedColor(color);
              }}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={
                    color === "#FFFFFF" || color === "#FFE600"
                      ? "#000000"
                      : "#FFFFFF"
                  }
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Background Pill Color */}
      <Text style={styles.sectionTitle}>BACKGROUND</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
      >
        {BG_SWATCHES.map((bg) => {
          const isSelected = selectedBg === bg.value;
          return (
            <TouchableOpacity
              key={bg.value}
              style={[
                styles.bgOptionPill,
                isSelected && styles.bgOptionPillActive,
              ]}
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedBg(bg.value);
              }}
            >
              <View
                style={[
                  styles.bgPreviewDot,
                  {
                    backgroundColor:
                      bg.value === "transparent" ? "#1E2333" : bg.value,
                    borderWidth: bg.value === "transparent" ? 1 : 0,
                    borderColor: "#8E95A5",
                  },
                ]}
              />
              <Text
                style={[
                  styles.bgOptionText,
                  isSelected && styles.bgOptionTextActive,
                ]}
              >
                {bg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}
