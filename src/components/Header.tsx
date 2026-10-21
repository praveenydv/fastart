import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastArtLogo from "./FastArtLogo";
import { soundEngine } from "../utils/audioEngine";
import { ASPECT_RATIOS } from "../constants/sampleMedia";
import { FastArtProject, AspectRatio } from "../types/project";

interface HeaderProps {
  project: FastArtProject;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
  onBackToHome: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  onOpenCanvasModal?: () => void;
}

function Header({
  project,
  onUpdateProject,
  onBackToHome,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
  onOpenCanvasModal,
}: HeaderProps) {
  const currentRatio =
    ASPECT_RATIOS.find((r) => r.id === project.aspectRatio) || ASPECT_RATIOS[0];

  return (
    <View style={styles.header}>
      {/* Left: Back button & Ratio */}
      <View style={styles.leftSection}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onBackToHome}
          activeOpacity={0.7}
          accessibilityLabel="Back to Home"
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ratioPill}
          onPress={() => {
            soundEngine.playSfx("click");
            if (onOpenCanvasModal) onOpenCanvasModal();
          }}
          activeOpacity={0.7}
          accessibilityLabel="Change Canvas Ratio"
        >
          <Ionicons
            name={currentRatio.icon || "phone-portrait-outline"}
            size={13}
            color="#00F2FE"
          />
          <Text style={styles.ratioText}>{currentRatio.label}</Text>
          <Ionicons name="chevron-down" size={11} color="#8E95A5" />
        </TouchableOpacity>
      </View>

      {/* Center: Undo / Redo */}
      <View style={styles.centerSection}>
        <TouchableOpacity
          style={[styles.historyButton, !canUndo && styles.disabledButton]}
          onPress={onUndo}
          disabled={!canUndo}
          activeOpacity={0.7}
          accessibilityLabel="Undo"
        >
          <Ionicons
            name="arrow-undo-outline"
            size={18}
            color={canUndo ? "#FFFFFF" : "#4B5563"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.historyButton, !canRedo && styles.disabledButton]}
          onPress={onRedo}
          disabled={!canRedo}
          activeOpacity={0.7}
          accessibilityLabel="Redo"
        >
          <Ionicons
            name="arrow-redo-outline"
            size={18}
            color={canRedo ? "#FFFFFF" : "#4B5563"}
          />
        </TouchableOpacity>
      </View>

      {/* Right: Export CTA */}
      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={onOpenExport}
          activeOpacity={0.8}
          accessibilityLabel="Export Project"
        >
          <Ionicons name="arrow-up" size={16} color="#000000" />
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 48,
    backgroundColor: "#0B0D13",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
    zIndex: 10,
    flexShrink: 0,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141721",
  },
  ratioPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141721",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252B3B",
    gap: 4,
  },
  ratioText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  centerSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141721",
  },
  disabledButton: {
    opacity: 0.4,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00F2FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  exportText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },
});

export default React.memo(Header);
