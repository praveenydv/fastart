import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import {
  COLOR_SWATCHES,
  BG_SWATCHES,
  STROKE_COLOR_SWATCHES,
  STROKE_WIDTH_OPTIONS,
} from "./textModalConstants";
import { styles } from "./TextModalStyles";

interface TextStyleTabProps {
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
  selectedColor,
  setSelectedColor,
  selectedBg,
  setSelectedBg,
  selectedStrokeColor,
  setSelectedStrokeColor,
  selectedStrokeWidth,
  setSelectedStrokeWidth,
}: TextStyleTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"textColor" | "bg" | "stroke">("textColor");

  return (
    <View style={{ flex: 1 }}>
      {/* Space-Optimized Sub-Segment Switch */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabBtn, activeSubTab === "textColor" && styles.subTabBtnActive]}
          onPress={() => {
            soundEngine.playSfx("click");
            setActiveSubTab("textColor");
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="color-palette-outline"
            size={13}
            color={activeSubTab === "textColor" ? "#00F2FE" : "#8E9AA8"}
          />
          <Text
            style={[styles.subTabBtnText, activeSubTab === "textColor" && styles.subTabBtnTextActive]}
          >
            Text Color
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeSubTab === "bg" && styles.subTabBtnActive]}
          onPress={() => {
            soundEngine.playSfx("click");
            setActiveSubTab("bg");
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="square-outline"
            size={13}
            color={activeSubTab === "bg" ? "#00F2FE" : "#8E9AA8"}
          />
          <Text
            style={[styles.subTabBtnText, activeSubTab === "bg" && styles.subTabBtnTextActive]}
          >
            Background
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeSubTab === "stroke" && styles.subTabBtnActive]}
          onPress={() => {
            soundEngine.playSfx("click");
            setActiveSubTab("stroke");
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="scan-outline"
            size={13}
            color={activeSubTab === "stroke" ? "#00F2FE" : "#8E9AA8"}
          />
          <Text
            style={[styles.subTabBtnText, activeSubTab === "stroke" && styles.subTabBtnTextActive]}
          >
            Stroke & Outline
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. TEXT COLOR SECTION */}
      {activeSubTab === "textColor" && (
        <View>
          <Text style={styles.sectionTitle}>PALETTE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalRow}
            contentContainerStyle={{ alignItems: "center", paddingVertical: 2 }}
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
                  activeOpacity={0.75}
                >
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={15}
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
        </View>
      )}

      {/* 2. BACKGROUND SECTION */}
      {activeSubTab === "bg" && (
        <View>
          <Text style={styles.sectionTitle}>BACKGROUND STYLE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalRow}
            contentContainerStyle={{ paddingVertical: 2 }}
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
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.bgPreviewDot,
                      {
                        backgroundColor:
                          bg.value === "transparent" ? "#161E2E" : bg.value,
                        borderWidth: bg.value === "transparent" ? 1 : 0,
                        borderColor: "#64748B",
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
        </View>
      )}

      {/* 3. STROKE & OUTLINE SECTION */}
      {activeSubTab === "stroke" && (
        <View>
          {/* Thickness Header + Stepper */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={styles.sectionTitle}>THICKNESS</Text>
            {selectedStrokeColor && selectedStrokeColor !== "none" && selectedStrokeWidth > 0 && (
              <View style={styles.stepperBox}>
                <TouchableOpacity
                  onPress={() => {
                    soundEngine.playSfx("click");
                    setSelectedStrokeWidth(Math.max(0.5, Number((selectedStrokeWidth - 0.5).toFixed(1))));
                  }}
                  style={styles.stepperBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={13} color="#94A3B8" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>
                  {selectedStrokeWidth}px
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    soundEngine.playSfx("click");
                    setSelectedStrokeWidth(Math.min(16, Number((selectedStrokeWidth + 0.5).toFixed(1))));
                  }}
                  style={styles.stepperBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={13} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Stroke Width Size Presets */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.horizontalRow, { marginBottom: 10 }]}
            contentContainerStyle={{ gap: 6 }}
          >
            {STROKE_WIDTH_OPTIONS.map((sw) => {
              const isSelected = selectedStrokeWidth === sw.value;
              return (
                <TouchableOpacity
                  key={sw.value}
                  style={[
                    styles.presetChip,
                    isSelected && styles.presetChipActive,
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
                      styles.presetChipText,
                      isSelected && styles.presetChipTextActive,
                    ]}
                  >
                    {sw.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Stroke Color Swatches */}
          <Text style={styles.sectionTitle}>OUTLINE COLOR</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalRow}
            contentContainerStyle={{ alignItems: "center", paddingVertical: 2 }}
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
                      {
                        backgroundColor: "#131926",
                        borderWidth: 1,
                        borderColor: isSelected ? "#00F2FE" : "#1F293D",
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      setSelectedStrokeColor("none");
                      setSelectedStrokeWidth(0);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="ban-outline" size={15} color={isSelected ? "#EF4444" : "#64748B"} />
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
                  activeOpacity={0.75}
                >
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={15}
                      color={swatch.value === "#FFFFFF" || swatch.value === "#FFE600" ? "#000000" : "#FFFFFF"}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
