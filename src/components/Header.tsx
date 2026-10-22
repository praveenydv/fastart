import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from "react-native";
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

  const displayTitle =
    project?.title &&
    !/^proj[_-]\d+/i.test(project.title) &&
    project.title !== project?.id
      ? project.title
      : "Project";

  const [isRenaming, setIsRenaming] = useState(false);
  const [editedTitle, setEditedTitle] = useState(displayTitle);

  return (
    <View style={styles.header}>
      {/* Left: Back button, Ratio & Project Name */}
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
          style={styles.projectTitlePill}
          onPress={() => {
            soundEngine.playSfx("click");
            setEditedTitle(displayTitle);
            setIsRenaming(true);
          }}
          activeOpacity={0.7}
          accessibilityLabel="Rename Project"
        >
          <Ionicons name="film-outline" size={12} color="#00F2FE" />
          <Text style={styles.projectTitleText} numberOfLines={1}>
            {displayTitle}
          </Text>
          <Ionicons name="pencil" size={9} color="#64748B" />
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
          <Ionicons name="arrow-up" size={16} color="#000000ff" />
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Rename Project Modal */}
      <Modal
        visible={isRenaming}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenaming(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsRenaming(false)}
        >
          <View style={styles.renameCard}>
            <View style={styles.renameHeaderRow}>
              <View style={styles.renameHeaderIcon}>
                <Ionicons name="film-outline" size={16} color="#00F2FE" />
              </View>
              <Text style={styles.renameTitle}>Rename Project</Text>
            </View>

            <TextInput
              style={styles.renameInput}
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Project Name..."
              placeholderTextColor="#64748B"
              autoFocus
              selectTextOnFocus
              maxLength={40}
              onSubmitEditing={() => {
                if (editedTitle.trim()) {
                  soundEngine.playSfx("whoosh");
                  onUpdateProject({ title: editedTitle.trim() });
                }
                setIsRenaming(false);
              }}
            />

            <View style={styles.renameActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setIsRenaming(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  !editedTitle.trim() && styles.saveBtnDisabled,
                ]}
                disabled={!editedTitle.trim()}
                onPress={() => {
                  if (editedTitle.trim()) {
                    soundEngine.playSfx("whoosh");
                    onUpdateProject({ title: editedTitle.trim() });
                  }
                  setIsRenaming(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  projectTitlePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141721",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252B3B",
    gap: 4,
    maxWidth: Platform.OS === "web" ? 160 : 96,
  },
  projectTitleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    maxWidth: Platform.OS === "web" ? 110 : 66,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 99999,
  },
  renameCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#10141E",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#252B3B",
  },
  renameHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  renameHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  renameTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  renameInput: {
    backgroundColor: "#0B0D13",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#00F2FE",
    marginBottom: 16,
  },
  renameActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1A1F2C",
  },
  cancelBtnText: {
    color: "#8E95A5",
    fontSize: 13,
    fontWeight: "600",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#00F2FE",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
});

export default React.memo(Header);
