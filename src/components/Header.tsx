import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { ASPECT_RATIOS } from "../constants/sampleMedia";
import { FastArtProject } from "../types/project";
import { THEME_COLORS } from "../constants/theme";

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
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 420;
  const isVerySmallScreen = width < 370;

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
    <View style={[styles.header, isSmallScreen && styles.headerCompact]}>
      {/* Left: Back button & Resolution/Aspect Ratio Pill */}
      <View style={[styles.leftSection, isSmallScreen && { gap: 6 }]}>
        {!hideBackButton && (
          <TouchableOpacity
            style={[styles.backButton, isSmallScreen && styles.backButtonSmall]}
            onPress={onBackToHome}
            activeOpacity={0.7}
            accessibilityLabel="Back to Home"
          >
            <Ionicons name="chevron-back" size={isSmallScreen ? 18 : 20} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Resolution / Aspect Ratio Pill Button */}
        <TouchableOpacity
          style={[styles.ratioPill, isSmallScreen && styles.ratioPillCompact]}
          onPress={() => {
            soundEngine.playSfx("click");
            if (onOpenCanvasModal) onOpenCanvasModal();
          }}
          activeOpacity={0.7}
          accessibilityLabel="Change Canvas Format"
        >
          <Text style={styles.ratioText}>{currentRatio.label}</Text>
          {!isSmallScreen && (
            <>
              <Text style={styles.ratioDivider}>•</Text>
              <Text style={styles.resolutionText}>1080P</Text>
            </>
          )}
          <Ionicons name="chevron-down" size={11} color="#8E8E93" style={{ marginLeft: 3 }} />
        </TouchableOpacity>

        {/* Project Title (Clean, tap to rename) */}
        <TouchableOpacity
          style={[
            styles.titlePill,
            isSmallScreen && { maxWidth: isVerySmallScreen ? 80 : 110, paddingHorizontal: 4 },
          ]}
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
      <View style={[styles.rightSection, isSmallScreen && { gap: 5 }]}>
        {/* Undo */}
        <TouchableOpacity
          style={[
            styles.historyButton,
            isSmallScreen && styles.historyButtonSmall,
            !canUndo && styles.disabledButton,
          ]}
          onPress={onUndo}
          disabled={!canUndo}
          activeOpacity={0.7}
          accessibilityLabel="Undo"
        >
          <Ionicons
            name="arrow-undo-outline"
            size={isSmallScreen ? 14 : 16}
            color={canUndo ? "#FFFFFF" : "#64748B"}
          />
        </TouchableOpacity>

        {/* Redo */}
        <TouchableOpacity
          style={[
            styles.historyButton,
            isSmallScreen && styles.historyButtonSmall,
            !canRedo && styles.disabledButton,
          ]}
          onPress={onRedo}
          disabled={!canRedo}
          activeOpacity={0.7}
          accessibilityLabel="Redo"
        >
          <Ionicons
            name="arrow-redo-outline"
            size={isSmallScreen ? 14 : 16}
            color={canRedo ? "#FFFFFF" : "#64748B"}
          />
        </TouchableOpacity>

        {/* Monochromatic Pro Export CTA Button */}
        <TouchableOpacity
          style={[styles.exportButton, isSmallScreen && styles.exportButtonCompact]}
          onPress={onOpenExport}
          activeOpacity={0.85}
          accessibilityLabel="Export Project"
        >
          <Ionicons name="arrow-up" size={13} color="#000000" style={{ marginRight: 2 }} />
          <Text style={[styles.exportText, isSmallScreen && { fontSize: 11.5 }]}>Export</Text>
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
    backgroundColor: THEME_COLORS.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.border,
    zIndex: 10,
    flexShrink: 0,
  },
  headerCompact: {
    paddingHorizontal: 8,
    height: 44,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  ratioPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    flexShrink: 0,
  },
  ratioPillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratioText: {
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  ratioDivider: {
    color: THEME_COLORS.textMuted,
    fontSize: 10,
    marginHorizontal: 4,
  },
  resolutionText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  titlePill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 160,
    flexShrink: 1,
  },
  titleText: {
    color: THEME_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  historyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  historyButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  disabledButton: {
    opacity: 0.45,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME_COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6.5,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  exportButtonCompact: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  exportText: {
    color: THEME_COLORS.primaryText,
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
    backgroundColor: THEME_COLORS.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  renameTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  renameInput: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: THEME_COLORS.textPrimary,
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
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: THEME_COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: THEME_COLORS.primaryText,
    fontSize: 11,
    fontWeight: "700",
  },
});

export default React.memo(Header);
