import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "./Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
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
  onOpenUndoHistory?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  isSaving?: boolean;
}

function HeaderComponent({
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
  onOpenUndoHistory,
  onOpenKeyboardShortcuts,
  isSaving = false,
}: HeaderProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 640;

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

        {/* Project Title (Clean, tap to rename on desktop/tablet; hidden on small screens for better space) */}
        {!isSmallScreen && (
          <TouchableOpacity
            style={styles.titlePill}
            onPress={() => {
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

      {/* Right: Auto-Save Status, Undo / Redo & Export CTA */}
      <View style={styles.rightSection}>
        {/* Subtle Auto-Save Status Indicator */}
        {!isSmallScreen && (
          <View style={styles.autoSavePill} accessibilityLabel="Save Status">
            <View style={[styles.autoSaveDot, isSaving && styles.autoSaveDotSaving]} />
            <Text style={styles.autoSaveText}>{isSaving ? "Saving..." : "Saved"}</Text>
          </View>
        )}

        {/* Keyboard Shortcuts Trigger (Desktop / Web) */}
        {onOpenKeyboardShortcuts && width >= 640 && (
          <TouchableOpacity
            style={styles.historyButton}
            onPress={onOpenKeyboardShortcuts}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel="Keyboard Shortcuts"
          >
            <Ionicons name="help-circle-outline" size={17} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Undo (Tap for step-undo, long-press for visual history drawer) */}
        <TouchableOpacity
          style={[
            styles.historyButton,
            !canUndo && styles.disabledButton,
          ]}
          onPress={onUndo}
          onLongPress={onOpenUndoHistory ? () => {
            onOpenUndoHistory();
          } : undefined}
          disabled={!canUndo}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 4 }}
          accessibilityLabel="Undo (Long press for History)"
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
                  onUpdateProject({ title: editedTitle.trim() });
                }
                setIsRenaming(false);
              }}
            />

            <View style={styles.renameActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
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
    height: 42,
    backgroundColor: "#121214",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    zIndex: 10,
    flexShrink: 0,
  },
  headerCompact: {
    paddingHorizontal: 10,
    height: 40,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "#1F1F23",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  ratioPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F1F23",
    flexShrink: 0,
  },
  ratioPillCompact: {
    paddingHorizontal: 6,
    height: 28,
    borderRadius: 6,
  },
  ratioText: {
    color: "#EDEDED",
    fontSize: 11,
    fontWeight: "400",
  },
  ratioDivider: {
    color: "#52525B",
    fontSize: 9,
    marginHorizontal: 3,
  },
  resolutionText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "400",
  },
  titlePill: {
    height: 28,
    justifyContent: "center",
    paddingHorizontal: 6,
    maxWidth: 140,
    flexShrink: 1,
  },
  titleText: {
    color: "#CBD5E1",
    fontSize: 11.5,
    fontWeight: "400",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  autoSavePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    marginRight: 2,
  },
  autoSaveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10B981",
  },
  autoSaveDotSaving: {
    backgroundColor: "#00E5C9",
  },
  autoSaveText: {
    fontSize: 9.5,
    fontWeight: "400",
    color: "#71717A",
  },
  historyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "#1F1F23",
    alignItems: "center",
    justifyContent: "center",
  },
  historyButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  disabledButton: {
    opacity: 0.35,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "#FFFFFF",
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  exportButtonCompact: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  exportText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "500",
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
    maxWidth: 280,
    backgroundColor: "#18181A",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  renameTitle: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "500",
    marginBottom: 8,
  },
  renameInput: {
    backgroundColor: "#121214",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: "#EDEDED",
    fontSize: 11.5,
    fontWeight: "400",
    marginBottom: 10,
  },
  renameActionsRow: {
    flexDirection: "row",
    gap: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#8E8E93",
    fontSize: 10.5,
    fontWeight: "400",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: "#000000",
    fontSize: 10.5,
    fontWeight: "500",
  },
});

export const Header = React.memo(HeaderComponent);
export default Header;
