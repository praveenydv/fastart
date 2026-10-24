import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { ASPECT_RATIOS } from "../constants/sampleMedia";
import { FastArtProject } from "../types/project";

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
  hideBackButton?: boolean;
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
  hideBackButton = false,
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
      {/* Left: Back button & Resolution/Aspect Ratio Pill */}
      <View style={styles.leftSection}>
        {!hideBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackToHome}
            activeOpacity={0.7}
            accessibilityLabel="Back to Home"
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* CapCut Resolution / Aspect Ratio Pill Button */}
        <TouchableOpacity
          style={styles.ratioPill}
          onPress={() => {
            soundEngine.playSfx("click");
            if (onOpenCanvasModal) onOpenCanvasModal();
          }}
          activeOpacity={0.7}
          accessibilityLabel="Change Canvas Format"
        >
          <Text style={styles.ratioText}>{currentRatio.label}</Text>
          <Text style={styles.ratioDivider}>•</Text>
          <Text style={styles.resolutionText}>1080P</Text>
          <Ionicons name="chevron-down" size={11} color="#8E8E93" style={{ marginLeft: 3 }} />
        </TouchableOpacity>

        {/* Project Title (Clean, tap to rename) */}
        <TouchableOpacity
          style={styles.titlePill}
          onPress={() => {
            soundEngine.playSfx("click");
            setEditedTitle(displayTitle);
            setIsRenaming(true);
          }}
          activeOpacity={0.7}
          accessibilityLabel="Rename Project"
        >
          <Text style={styles.titleText} numberOfLines={1}>
            {displayTitle}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Right: Undo / Redo & Export CTA */}
      <View style={styles.rightSection}>
        {/* Undo */}
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
            color={canUndo ? "#FFFFFF" : "#48484A"}
          />
        </TouchableOpacity>

        {/* Redo */}
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
            color={canRedo ? "#FFFFFF" : "#48484A"}
          />
        </TouchableOpacity>

        {/* CapCut Export Pill Button */}
        <TouchableOpacity
          style={styles.exportButton}
          onPress={onOpenExport}
          activeOpacity={0.8}
          accessibilityLabel="Export Project"
        >
          <Ionicons name="arrow-up" size={13} color="#000000" style={{ marginRight: 3 }} />
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
            <Text style={styles.renameTitle}>Rename Project</Text>

            <TextInput
              style={styles.renameInput}
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Project Name..."
              placeholderTextColor="#8E8E93"
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
    height: 44,
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    zIndex: 10,
    flexShrink: 0,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ratioPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  ratioText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  ratioDivider: {
    color: "#8E8E93",
    fontSize: 10,
    marginHorizontal: 3,
  },
  resolutionText: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "500",
  },
  titlePill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    maxWidth: 120,
  },
  titleText: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "500",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.35,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00E5FF",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  exportText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  renameCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  renameTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  renameInput: {
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#FFFFFF",
    fontSize: 13,
    marginBottom: 14,
  },
  renameActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#00E5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "700",
  },
});

export default React.memo(Header);
