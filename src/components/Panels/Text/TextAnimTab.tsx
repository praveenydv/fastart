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
  const [animCategory, setAnimCategory] = React.useState<"all" | "in" | "loop">("all");

  const filteredAnims = ANIMATION_OPTIONS.filter((a: any) => {
    if (animCategory === "all") return true;
    return a.category === animCategory;
  });

  return (
    <>
      {/* Animation Category Filter */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.sectionTitle}>MOTION ANIMATION ({filteredAnims.length})</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {(["all", "in", "loop"] as const).map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => {
                soundEngine.playSfx("click");
                setAnimCategory(cat);
              }}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: animCategory === cat ? "#00F2FE" : "#1E2333",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: animCategory === cat ? "#000000" : "#8E95A5",
                  textTransform: "uppercase",
                }}
              >
                {cat === "all" ? "All" : cat === "in" ? "Entrance (In)" : "Continuous (Loop)"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
      >
        {filteredAnims.map((anim) => {
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
                color={isActive ? "#000000" : "#8E95A5"}
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


      {/* Viral Presets & Hooks */}
      <Text style={styles.sectionTitle}>{"VIRAL HOOKS & PRESETS"}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalRow}
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
    </>
  );
}
