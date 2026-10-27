import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { TEXT_TEMPLATES } from "../../../constants/sampleMedia";
import { ANIMATION_OPTIONS } from "./textModalConstants";
import { styles } from "./TextModalStyles";

interface TextAnimTabProps {
  selectedAnim: string;
  setSelectedAnim: (anim: string) => void;
  onApplyTemplate: (tmpl: any) => void;
}

export default function TextAnimTab({
  selectedAnim,
  setSelectedAnim,
  onApplyTemplate,
}: TextAnimTabProps) {
  return (
    <View style={{ gap: 14 }}>
      {/* 1. MOTION ANIMATIONS */}
      <View>
        <Text style={styles.sectionTitle}>MOTION ANIMATION</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalRow}
          contentContainerStyle={{ paddingVertical: 2 }}
        >
          {ANIMATION_OPTIONS.map((anim) => {
            const isActive = selectedAnim === anim.id;
            return (
              <TouchableOpacity
                key={anim.id}
                style={[styles.animPill, isActive && styles.animPillActive]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setSelectedAnim(anim.id);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={anim.icon as any}
                  size={14}
                  color={isActive ? "#00F2FE" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.animPillText,
                    isActive && styles.animPillTextActive,
                  ]}
                >
                  {anim.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. VIRAL PRESETS & HOOKS */}
      <View>
        <Text style={styles.sectionTitle}>VIRAL HOOKS & PRESETS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalRow}
          contentContainerStyle={{ paddingVertical: 2 }}
        >
          {TEXT_TEMPLATES.map((tmpl) => (
            <TouchableOpacity
              key={tmpl.id}
              style={styles.templatePill}
              onPress={() => onApplyTemplate(tmpl)}
              activeOpacity={0.75}
            >
              <Text style={styles.templatePillText}>{tmpl.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
