import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { ModalHeader } from "../Common";
import { Ionicons } from "@expo/vector-icons";
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
    onUpdateProject({ aspectRatio: ratio });
  };

  const sheetContent = (
    <View
      style={[styles.sheetContainer, styles.inlineSheetContainer]}
    >
      {/* Unified Live Header - only shown in standalone modal to avoid duplicate header on desktop */}
      {!isInline ? (
        <ModalHeader
          title="Canvas"
          iconName="scan-outline"
          onClose={onClose}
        />
      ) : null}

      {/* Aspect Ratios Grid */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[styles.scrollBody, isInline && { paddingTop: 6 }]}
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
                    size={14}
                    color={isSelected ? "#FFFFFF" : "#8E95A5"}
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
                    <Ionicons name="checkmark" size={7} color="#000000" />
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
    backgroundColor: "#121214",
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
    backgroundColor: "#121214",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: Platform.OS === "web" ? "55%" : "65%",
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
    borderTopWidth: 1,
    borderColor: "#1F1F23",
  },
  sheetHandle: {
    width: 28,
    height: 2.5,
    backgroundColor: "#2C2C2E",
    borderRadius: 1.5,
    alignSelf: "center",
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    backgroundColor: "#121214",
  },
  headerCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
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
    fontSize: 11.5,
    fontWeight: "500",
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    flexDirection: "row",
    alignItems: "center",
  },
  resetText: {
    color: "#8E8E93",
    fontSize: 9,
    fontWeight: "400",
  },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  contentScroll: {
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  scrollBody: {
    paddingBottom: 56,
  },
  ratioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  ratioCard: {
    width: "23.5%",
    backgroundColor: "#18181A",
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272A",
    position: "relative",
  },
  ratioCardActive: {
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  ratioIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#141416",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  ratioIconBoxActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "#FFFFFF",
  },
  ratioLabel: {
    fontSize: 8.5,
    color: "#8E8E93",
    fontWeight: "400",
    marginBottom: 1,
  },
  ratioLabelActive: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  ratioDesc: {
    fontSize: 7.5,
    color: "#71717A",
    textAlign: "center",
    fontWeight: "400",
  },
  checkBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineApplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  inlineAppliedBtn: {
    backgroundColor: "#10B981",
  },
  inlineApplyText: {
    color: "#000000",
    fontSize: 9.5,
    fontWeight: "500",
  },
});
