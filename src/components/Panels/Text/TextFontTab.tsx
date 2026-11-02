import React from "react";
import { View, Text, ScrollView } from "react-native";
import { TactileTouchable as TouchableOpacity } from "../../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { FONT_OPTIONS } from "./textModalConstants";
import { FontDefinition, loadGoogleFont } from "../../../utils/fontCatalog";
import { styles } from "./TextModalStyles";

interface TextFontTabProps {
  selectedFont: string;
  setSelectedFont: (font: string) => void;
  selectedFontSize: number;
  setSelectedFontSize: (size: number) => void;
}

const FONT_SIZE_PRESETS = [18, 24, 30, 36, 48];

export default function TextFontTab({
  selectedFont,
  setSelectedFont,
  selectedFontSize,
  setSelectedFontSize,
}: TextFontTabProps) {
  const handleSelectFont = (font: FontDefinition) => {
    loadGoogleFont(font);
    setSelectedFont(font.fontFamily || font.id);
  };

  return (
    <View style={{ gap: 14 }}>
      {/* 1. FONT SELECTION */}
      <View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text style={styles.sectionTitle}>TYPOGRAPHY & FONTS</Text>
        </View>

        {/* Linear Horizontal Scroll of Font Family Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalRow}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {FONT_OPTIONS.map((f) => {
            const isActive = selectedFont === f.id || selectedFont === f.fontFamily;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.fontCard, isActive && styles.fontCardActive]}
                onPress={() => handleSelectFont(f)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.fontCardPreview,
                    { fontFamily: f.fontFamily as any },
                    isActive && styles.fontCardPreviewActive,
                  ]}
                  numberOfLines={1}
                >
                  Aa
                </Text>
                <Text
                  style={[
                    styles.fontCardLabel,
                    isActive && styles.fontCardLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. FONT SIZE & QUICK PRESETS */}
      <View style={styles.sizeSection}>
        <Text style={styles.sectionTitle}>FONT SIZE</Text>
        <View style={styles.sizeRow}>
          <View style={styles.stepperBox}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => {
                setSelectedFontSize(Math.max(12, selectedFontSize - 2));
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={14} color="#94A3B8" />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{selectedFontSize}px</Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => {
                setSelectedFontSize(Math.min(96, selectedFontSize + 2));
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.presetGroup}>
            {FONT_SIZE_PRESETS.map((sz) => {
              const isSelected = selectedFontSize === sz;
              return (
                <TouchableOpacity
                  key={sz}
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
                  onPress={() => {
                    setSelectedFontSize(sz);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      isSelected && styles.presetChipTextActive,
                    ]}
                  >
                    {sz}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
