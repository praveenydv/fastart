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
            size={16}
            color={canUndo ? "#FFFFFF" : "#64748B"}
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
            size={16}
            color={canRedo ? "#FFFFFF" : "#64748B"}
          />
        </TouchableOpacity>

        {/* Monochromatic Pro Export CTA Button */}
        <TouchableOpacity
          style={styles.exportButton}
          onPress={onOpenExport}
          activeOpacity={0.85}
          accessibilityLabel="Export Project"
        >
          <Ionicons name="arrow-up" size={14} color="#000000" style={{ marginRight: 2 }} />
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
    height: 48,
    backgroundColor: "rgba(8, 9, 14, 0.98)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
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
    borderRadius: 8,
    backgroundColor: "#0F131D",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  ratioPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F131D",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  ratioText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  ratioDivider: {
    color: "#64748B",
    fontSize: 10,
    marginHorizontal: 4,
  },
  resolutionText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  titlePill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 160,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "600",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#0F131D",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.45,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 6.5,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
    padding: 20,
  },
  renameCard: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: "#131826",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  renameTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  renameInput: {
    backgroundColor: "#0F131D",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#FFFFFF",
    fontSize: 12,
    marginBottom: 12,
  },
  renameActionsRow: {
    flexDirection: "row",
    gap: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#0F131D",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "700",
  },
});

export default React.memo(Header);
