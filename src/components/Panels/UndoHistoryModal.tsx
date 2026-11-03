import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { ModalHeader } from "../Common/ModalHeader";
import { THEME_COLORS } from "../../constants/designConstants";
import { FastArtProject } from "../../types/project";

export interface UndoHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  historyStack: FastArtProject[];
  redoStack: FastArtProject[];
  currentProject: FastArtProject | null;
  onJumpToState: (targetIndex: number) => void;
}

function summarizeProjectChange(
  current: FastArtProject | undefined,
  prev: FastArtProject | undefined,
  idx: number
): { title: string; subtitle: string; icon: any } {
  if (!prev) {
    return {
      title: "Project Baseline",
      subtitle: "Initial state / project opened",
      icon: "flag-outline",
    };
  }

  const curVideos = current?.tracks?.video?.length || 0;
  const prevVideos = prev?.tracks?.video?.length || 0;
  if (curVideos > prevVideos) {
    return {
      title: "Added Video Clip",
      subtitle: `${curVideos} video clips total`,
      icon: "videocam-outline",
    };
  }
  if (curVideos < prevVideos) {
    return {
      title: "Removed Video Clip",
      subtitle: `${curVideos} video clips remaining`,
      icon: "trash-outline",
    };
  }

  const curAudio = current?.tracks?.audio?.length || 0;
  const prevAudio = prev?.tracks?.audio?.length || 0;
  if (curAudio !== prevAudio) {
    return {
      title: curAudio > prevAudio ? "Added Audio Track" : "Removed Audio Track",
      subtitle: `${curAudio} audio tracks`,
      icon: "musical-notes-outline",
    };
  }

  const curText = (current?.tracks?.text?.length || 0) + (current?.tracks?.captions?.length || 0);
  const prevText = (prev?.tracks?.text?.length || 0) + (prev?.tracks?.captions?.length || 0);
  if (curText !== prevText) {
    return {
      title: curText > prevText ? "Added Text / Captions" : "Deleted Text",
      subtitle: `${curText} text overlays`,
      icon: "text-outline",
    };
  }

  const curEffects = current?.tracks?.effects?.length || 0;
  const prevEffects = prev?.tracks?.effects?.length || 0;
  if (curEffects !== prevEffects) {
    return {
      title: "Effect Adjustment",
      subtitle: `${curEffects} active effects`,
      icon: "sparkles-outline",
    };
  }

  if (current?.aspectRatio !== prev?.aspectRatio) {
    return {
      title: "Changed Canvas Ratio",
      subtitle: `Ratio set to ${current?.aspectRatio}`,
      icon: "aspect-ratio-outline",
    };
  }

  return {
    title: `Edit Step #${idx + 1}`,
    subtitle: "Timeline trim, transform, or property update",
    icon: "create-outline",
  };
}

export const UndoHistoryModal: React.FC<UndoHistoryModalProps> = ({
  visible,
  onClose,
  historyStack,
  redoStack,
  currentProject,
  onJumpToState,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.card, isMobile && styles.cardMobile]}>
          {/* Header */}
          <ModalHeader
            title="Edit History"
            subtitle={`${historyStack.length} undo step${historyStack.length !== 1 ? "s" : ""} available`}
            iconName="time-outline"
            onClose={onClose}
          />

          {/* Timeline Stack List */}
          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {/* Current Active State */}
            <View style={[styles.historyRow, styles.activeRow]}>
              <View style={styles.activeDot} />
              <View style={styles.rowInfo}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.activeRowTitle}>Current State</Text>
                  <View style={styles.nowBadge}>
                    <Text style={styles.nowBadgeText}>ACTIVE</Text>
                  </View>
                </View>
                <Text style={styles.rowSubtitle}>Latest edits in timeline</Text>
              </View>
            </View>

            {/* Past History (in reverse order: most recent first) */}
            {historyStack.slice().reverse().map((state, revIdx) => {
              const originalIdx = historyStack.length - 1 - revIdx;
              const prevSnapshot = originalIdx > 0 ? historyStack[originalIdx - 1] : undefined;
              const info = summarizeProjectChange(state, prevSnapshot, originalIdx);

              return (
                <TouchableOpacity
                  key={`hist-${originalIdx}`}
                  style={styles.historyRow}
                  onPress={() => {
                    onJumpToState(originalIdx);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconCircle}>
                    <Ionicons name={info.icon} size={15} color={THEME_COLORS.textSecondary} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{info.title}</Text>
                    <Text style={styles.rowSubtitle}>{info.subtitle}</Text>
                  </View>
                  <Ionicons name="arrow-undo-outline" size={14} color={THEME_COLORS.textMuted} />
                </TouchableOpacity>
              );
            })}

            {historyStack.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="sparkles-outline" size={32} color={THEME_COLORS.textDisabled} />
                <Text style={styles.emptyText}>No undo history recorded yet</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              Tip: Tap any past state to restore your timeline to that moment.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "75%",
    backgroundColor: THEME_COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderLight,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  cardMobile: {
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(0, 229, 201, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME_COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: THEME_COLORS.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: THEME_COLORS.surface,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 6,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    gap: 12,
  },
  activeRow: {
    backgroundColor: "rgba(0, 229, 201, 0.08)",
    borderColor: "rgba(0, 229, 201, 0.3)",
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME_COLORS.accent,
  },
  rowIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: THEME_COLORS.cardBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: {
    flex: 1,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeRowTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME_COLORS.accent,
  },
  nowBadge: {
    backgroundColor: THEME_COLORS.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  nowBadgeText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "800",
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME_COLORS.textPrimary,
  },
  rowSubtitle: {
    fontSize: 11,
    color: THEME_COLORS.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: THEME_COLORS.textMuted,
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.border,
  },
  footerNote: {
    fontSize: 11,
    color: THEME_COLORS.textMuted,
    textAlign: "center",
  },
});

export default UndoHistoryModal;
