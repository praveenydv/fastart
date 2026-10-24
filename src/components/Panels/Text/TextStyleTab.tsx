import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import {
  FONT_OPTIONS,
  COLOR_SWATCHES,
  BG_SWATCHES,
  STROKE_COLOR_SWATCHES,
  STROKE_WIDTH_OPTIONS,
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
  selectedStrokeColor?: string;
  setSelectedStrokeColor: (color: string | undefined) => void;
  selectedStrokeWidth: number;
  setSelectedStrokeWidth: (width: number) => void;
}

export default function TextStyleTab({
  selectedFont,
  setSelectedFont,
  selectedColor,
  setSelectedColor,
  selectedBg,
  setSelectedBg,
  selectedStrokeColor,
  setSelectedStrokeColor,
  selectedStrokeWidth,
  setSelectedStrokeWidth,
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
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "#202026", borderRadius: 6, borderWidth: 1, borderColor: "#27272F" }}
            onPress={handleCustomFontUpload}
          >
            <Ionicons name="cloud-upload-outline" size={13} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>+ Upload Font</Text>
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
                isActive && { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
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

      {/* Text Stroke / Outline Controls */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 6 }}>
        <Text style={styles.sectionTitle}>STROKE & OUTLINE</Text>
        {selectedStrokeColor && selectedStrokeColor !== "none" && selectedStrokeWidth > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedStrokeWidth(Math.max(0.5, Number((selectedStrokeWidth - 0.5).toFixed(1))));
              }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#202026",
                borderWidth: 1,
                borderColor: "#27272F",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="remove" size={13} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={{ color: "#00F2FE", fontSize: 12, fontWeight: "800", minWidth: 34, textAlign: "center" }}>
              {selectedStrokeWidth}px
            </Text>
            <TouchableOpacity
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedStrokeWidth(Math.min(16, Number((selectedStrokeWidth + 0.5).toFixed(1))));
              }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#202026",
                borderWidth: 1,
                borderColor: "#27272F",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="add" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Stroke Width Size Presets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.horizontalRow, { marginBottom: 10 }]}
      >
        {STROKE_WIDTH_OPTIONS.map((sw) => {
          const isSelected = selectedStrokeWidth === sw.value;
          return (
            <TouchableOpacity
              key={sw.value}
              style={[
                styles.fontPill,
                { paddingHorizontal: 13, paddingVertical: 6, minWidth: 50, alignItems: "center" },
                isSelected && { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
              ]}
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedStrokeWidth(sw.value);
                if (sw.value > 0 && (!selectedStrokeColor || selectedStrokeColor === "none")) {
                  setSelectedStrokeColor("#000000");
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.fontPillText,
                  isSelected && { color: "#000000", fontWeight: "900" },
                ]}
              >
                {sw.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stroke Color Swatches */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
      >
        {STROKE_COLOR_SWATCHES.map((swatch) => {
          const isSelected =
            (swatch.value === "none" && (!selectedStrokeColor || selectedStrokeColor === "none" || selectedStrokeWidth === 0)) ||
            (selectedStrokeColor === swatch.value && selectedStrokeWidth > 0);

          if (swatch.value === "none") {
            return (
              <TouchableOpacity
                key="none"
                style={[
                  styles.colorCircle,
                  { backgroundColor: "#18181C", borderWidth: 1, borderColor: isSelected ? "#FFFFFF" : "#27272F", alignItems: "center", justifyContent: "center" },
                ]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setSelectedStrokeColor("none");
                  setSelectedStrokeWidth(0);
                }}
              >
                <Ionicons name="ban-outline" size={15} color={isSelected ? "#EF4444" : "#71717A"} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={swatch.value}
              style={[
                styles.colorCircle,
                { backgroundColor: swatch.value },
                isSelected && styles.colorCircleSelected,
              ]}
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedStrokeColor(swatch.value);
                if (!selectedStrokeWidth || selectedStrokeWidth === 0) {
                  setSelectedStrokeWidth(2.5);
                }
              }}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={swatch.value === "#FFFFFF" || swatch.value === "#FFE600" ? "#000000" : "#FFFFFF"}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}
