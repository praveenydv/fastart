import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import {
  FONT_OPTIONS,
  COLOR_SWATCHES,
  BG_SWATCHES,
} from "./textModalConstants";
import { FONT_CATEGORIES, FontDefinition, loadGoogleFont, registerCustomFont } from "../../../utils/fontCatalog";
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
    <>
      {/* Font Family Categories */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.sectionTitle}>TYPOGRAPHY & FONTS ({filteredFonts.length})</Text>
        {Platform.OS === "web" && (
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(0, 242, 254, 0.12)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(0, 242, 254, 0.3)" }}
            onPress={handleCustomFontUpload}
          >
            <Ionicons name="cloud-upload-outline" size={13} color="#00F2FE" />
            <Text style={{ color: "#00F2FE", fontSize: 11, fontWeight: "800" }}>+ Upload Font</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.horizontalRow, { marginBottom: 8 }]}
      >
        {FONT_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.fontPill,
                { paddingHorizontal: 12, paddingVertical: 6 },
                isActive && { backgroundColor: "#00F2FE", borderColor: "#00F2FE" },
              ]}
              onPress={() => {
                soundEngine.playSfx("click");
                setActiveCategory(cat.id);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.fontPillText,
                  isActive && { color: "#000000", fontWeight: "900" },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Font Family Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
      >
        {filteredFonts.map((f) => {
          const isActive = selectedFont === f.id || selectedFont === f.fontFamily;
          return (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.fontPill,
                { minWidth: 95, alignItems: "center" },
                isActive && styles.fontPillActive,
              ]}
              onPress={() => handleSelectFont(f)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.fontPillText,
                  { fontFamily: f.fontFamily as any },
                  isActive && styles.fontPillTextActive,
                ]}
                numberOfLines={1}
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
