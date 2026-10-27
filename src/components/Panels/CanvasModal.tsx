import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { FastArtProject, AspectRatio } from "../../types/project";

interface CanvasModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  project: FastArtProject | null;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
  isInline?: boolean;
}

export interface ExtendedRatioOption {
  id: AspectRatio;
  label: string;
  desc: string;
  icon: any;
  platform: string;
}

export const RATIO_OPTIONS: ExtendedRatioOption[] = [
  {
    id: "9:16",
    label: "9:16",
    desc: "TikTok, Shorts, Reels",
    icon: "phone-portrait-outline",
    platform: "Mobile Vertical",
  },
  {
    id: "16:9",
    label: "16:9",
    desc: "YouTube, Landscape",
    icon: "phone-landscape-outline",
    platform: "Widescreen",
  },
  {
    id: "1:1",
    label: "1:1",
    desc: "Instagram, Square Feed",
    icon: "square-outline",
    platform: "Square",
  },
  {
    id: "4:5",
    label: "4:5",
    desc: "Instagram Portrait",
    icon: "newspaper-outline",
    platform: "Portrait Feed",
  },
  {
    id: "2.35:1",
    label: "2.35:1",
    desc: "Cinematic Widescreen",
    icon: "film-outline",
    platform: "Cinemascope",
  },
];

export default function CanvasModal({
  visible,
  onClose,
  onApply,
  project,
  onUpdateProject,
  isInline = false,
}: CanvasModalProps) {
  if (!project) return null;

  const currentRatio = project.aspectRatio || "9:16";

  const handleSelectRatio = (ratio: AspectRatio) => {
    soundEngine.playSfx("pop");
    onUpdateProject({ aspectRatio: ratio });
  };

  const sheetContent = (
    <View
      style={[styles.sheetContainer, styles.inlineSheetContainer]}
    >
      {/* Unified Live Header - only shown in standalone modal to avoid duplicate header on desktop */}
      {!isInline ? (
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="scan-outline" size={16} color="#00F2FE" />
            <Text style={styles.headerTitle}>Canvas Ratio</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Aspect Ratios Grid */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[styles.scrollBody, isInline && { paddingTop: 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ratioGrid}>
          {RATIO_OPTIONS.map((item) => {
            const isSelected = currentRatio === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.ratioCard, isSelected && styles.ratioCardActive]}
                onPress={() => handleSelectRatio(item.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.ratioIconBox,
                    isSelected && styles.ratioIconBoxActive,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={isSelected ? "#00F2FE" : "#8E95A5"}
                  />
                </View>
                <Text
                  style={[
                    styles.ratioLabel,
                    isSelected && styles.ratioLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={styles.ratioDesc} numberOfLines={1}>
                  {item.platform}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={10} color="#000000" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#0F131D",
  },
  inlineSheetContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    maxHeight: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0F131D",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: Platform.OS === "web" ? "55%" : "65%",
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
    borderTopWidth: 1,
    borderColor: "#1F2637",
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: "#1F2637",
    borderRadius: 1.5,
    alignSelf: "center",
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    backgroundColor: "#08090E",
  },
  headerCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    flexDirection: "row",
    alignItems: "center",
  },
  resetText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
  },
  doneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  contentScroll: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  scrollBody: {
    paddingBottom: 16,
  },
  ratioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  ratioCard: {
    width: "31.5%",
    backgroundColor: "#131826",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F2637",
    position: "relative",
  },
  ratioCardActive: {
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  ratioIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#08090E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  ratioIconBoxActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "#00F2FE",
  },
  ratioLabel: {
    fontSize: 10.5,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 1,
  },
  ratioLabelActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  ratioDesc: {
    fontSize: 8.5,
    color: "#64748B",
    textAlign: "center",
  },
  checkBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineApplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#00F2FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inlineAppliedBtn: {
    backgroundColor: "#10B981",
  },
  inlineApplyText: {
    color: "#08090E",
    fontSize: 11,
    fontWeight: "700",
  },
});
