import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { FONT_OPTIONS } from "./textModalConstants";
import { FONT_CATEGORIES, FontDefinition, loadGoogleFont, registerCustomFont } from "../../../utils/fontCatalog";
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
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [fontsList, setFontsList] = useState<FontDefinition[]>(FONT_OPTIONS);

  const filteredFonts = fontsList.filter((f) => {
    if (activeCategory === "all") return true;
    return f.category === activeCategory;
  });

  const handleSelectFont = (font: FontDefinition) => {
    soundEngine.playSfx("click");
    loadGoogleFont(font);
    setSelectedFont(font.fontFamily || font.id);
  };

  const handleCustomFontUpload = () => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".ttf,.otf,.woff2";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const registered = await registerCustomFont(file.name, file);
          if (registered) {
            setFontsList((prev) => [registered, ...prev]);
            setSelectedFont(registered.fontFamily);
            soundEngine.playSfx("pop");
          }
        }
      };
      input.click();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Category Filter Pills & Upload Button */}
      <View style={styles.tabSectionHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, alignItems: "center" }}
        >
          {FONT_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setActiveCategory(cat.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {Platform.OS === "web" && (
          <TouchableOpacity
            style={styles.uploadFontBtn}
            onPress={handleCustomFontUpload}
            activeOpacity={0.7}
          >
            <Ionicons name="cloud-upload-outline" size={12} color="#00F2FE" />
            <Text style={styles.uploadFontBtnText}>Upload</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Font Family Cards Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        {filteredFonts.map((f) => {
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

      {/* Font Size Stepper & Quick Presets */}
      <View style={styles.sizeSection}>
        <Text style={styles.sectionTitle}>FONT SIZE</Text>
        <View style={styles.sizeRow}>
          <View style={styles.stepperBox}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => {
                soundEngine.playSfx("click");
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
                soundEngine.playSfx("click");
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
                    soundEngine.playSfx("click");
                    setSelectedFontSize(sz);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
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
