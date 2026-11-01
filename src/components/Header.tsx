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
  const isVerySmallScreen = width < 360;

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
      <View style={styles.leftSection}>
        {!hideBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackToHome}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 8 }}
            accessibilityLabel="Back to Home"
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
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
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          accessibilityLabel="Change Canvas Format"
        >
          <Text style={styles.ratioText}>{currentRatio.label}</Text>
          {!isSmallScreen && (
            <>
              <Text style={styles.ratioDivider}>•</Text>
              <Text style={styles.resolutionText}>1080P</Text>
            </>
          )}
          <Ionicons name="chevron-down" size={12} color="#94A3B8" style={{ marginLeft: 3 }} />
        </TouchableOpacity>

        {/* Project Title (Clean, tap to rename) */}
        {!isVerySmallScreen && (
          <TouchableOpacity
            style={styles.titlePill}
            onPress={() => {
              soundEngine.playSfx("click");
              setEditedTitle(displayTitle);
              setIsRenaming(true);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel="Rename Project"
          >
            <Text style={styles.titleText} numberOfLines={1}>
              {displayTitle}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Right: Undo / Redo & Export CTA */}
      <View style={styles.rightSection}>
        {/* Undo */}
        <TouchableOpacity
          style={[
            styles.historyButton,
            !canUndo && styles.disabledButton,
          ]}
          onPress={onUndo}
          disabled={!canUndo}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 4 }}
          accessibilityLabel="Undo"
        >
          <Ionicons
            name="arrow-undo-outline"
            size={17}
            color={canUndo ? "#FFFFFF" : "#64748B"}
          />
        </TouchableOpacity>

        {/* Redo */}
        <TouchableOpacity
          style={[
            styles.historyButton,
            !canRedo && styles.disabledButton,
          ]}
          onPress={onRedo}
          disabled={!canRedo}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 4, right: 6 }}
          accessibilityLabel="Redo"
        >
          <Ionicons
            name="arrow-redo-outline"
            size={17}
            color={canRedo ? "#FFFFFF" : "#64748B"}
          />
        </TouchableOpacity>

        {/* Monochromatic Pro Export CTA Button */}
        <TouchableOpacity
          style={[styles.exportButton, isSmallScreen && styles.exportButtonCompact]}
          onPress={onOpenExport}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
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
    height: 54,
    backgroundColor: "#08090E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    zIndex: 10,
    flexShrink: 0,
  },
  headerCompact: {
    paddingHorizontal: 10,
    height: 52,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  ratioPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131826",
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#1F2637",
    flexShrink: 0,
  },
  ratioPillCompact: {
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 9,
  },
  ratioText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  ratioDivider: {
    color: "#64748B",
    fontSize: 10,
    marginHorizontal: 4,
  },
  resolutionText: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "600",
  },
  titlePill: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 8,
    maxWidth: 140,
    flexShrink: 1,
  },
  titleText: {
    color: "#E2E8F0",
    fontSize: 12.5,
    fontWeight: "500",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  historyButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  disabledButton: {
    opacity: 0.35,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  exportButtonCompact: {
    height: 36,
    paddingHorizontal: 11,
    borderRadius: 9,
  },
  exportText: {
    color: "#000000",
    fontSize: 12.5,
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
