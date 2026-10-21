import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { TEXT_EFFECT_OPTIONS, BORDER_OPTIONS } from "./textModalConstants";
import { styles } from "./TextModalStyles";

interface TextEffectsTabProps {
  selectedTextEffect: string;
  setSelectedTextEffect: (effect: string) => void;
  selectedBorderColor?: string;
  setSelectedBorderColor: (border?: string) => void;
}

export default function TextEffectsTab({
  selectedTextEffect,
  setSelectedTextEffect,
  selectedBorderColor,
  setSelectedBorderColor,
}: TextEffectsTabProps) {
  return (
    <>
      {/* Text Effects */}
      <Text style={styles.sectionTitle}>TEXT EFFECT STYLES</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
      >
        {TEXT_EFFECT_OPTIONS.map((eff) => {
          const isActive = selectedTextEffect === eff.id;
          return (
            <TouchableOpacity
              key={eff.id}
              style={[styles.effectPill, isActive && styles.effectPillActive]}
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedTextEffect(eff.id);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={eff.icon as any}
                size={16}
                color={isActive ? "#00F2FE" : "#8E95A5"}
              />
              <View style={{ marginLeft: 6 }}>
                <Text
                  style={[
                    styles.effectPillTitle,
                    isActive && styles.effectPillTitleActive,
                  ]}
                >
                  {eff.label}
                </Text>
                <Text style={styles.effectPillDesc}>{eff.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Border & Outline */}
      <Text style={styles.sectionTitle}>{"BORDER & GLOW OUTLINE"}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
      >
        {BORDER_OPTIONS.map((b) => {
          const isSelected = selectedBorderColor === b.color;
          return (
            <TouchableOpacity
              key={b.label}
              style={[
                styles.bgOptionPill,
                isSelected && styles.bgOptionPillActive,
              ]}
              onPress={() => {
                soundEngine.playSfx("click");
                setSelectedBorderColor(b.color);
              }}
            >
              {b.color && (
                <View
                  style={[styles.bgPreviewDot, { backgroundColor: b.color }]}
                />
              )}
              <Text
                style={[
                  styles.bgOptionText,
                  isSelected && styles.bgOptionTextActive,
                ]}
              >
                {b.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}
