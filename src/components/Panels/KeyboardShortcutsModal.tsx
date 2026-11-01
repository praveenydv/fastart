import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { THEME_COLORS, DESIGN_CONSTANTS } from "../../constants/designConstants";
import { soundEngine } from "../../utils/audioEngine";

export interface KeyboardShortcutsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Transport" | "Editing" | "Timeline" | "General";
}

const SHORTCUT_DEFINITIONS: ShortcutItem[] = [
  // Transport
  { keys: ["Space"], description: "Play / Pause playback", category: "Transport" },
  { keys: ["J"], description: "Shuttle backward (rewind)", category: "Transport" },
  { keys: ["K"], description: "Pause / Stop playback", category: "Transport" },
  { keys: ["L"], description: "Shuttle forward (fast-forward)", category: "Transport" },
  { keys: ["←"], description: "Step 1 frame backward", category: "Transport" },
  { keys: ["→"], description: "Step 1 frame forward", category: "Transport" },
  { keys: ["Shift", "←"], description: "Jump 1 second backward", category: "Transport" },
  { keys: ["Shift", "→"], description: "Jump 1 second forward", category: "Transport" },

  // Editing
  { keys: ["C"], description: "Split / Razor clip at playhead", category: "Editing" },
  { keys: ["S"], description: "Split clip at playhead", category: "Editing" },
  { keys: ["D"], description: "Duplicate selected clip", category: "Editing" },
  { keys: ["Delete"], description: "Delete selected clip", category: "Editing" },
  { keys: ["Backspace"], description: "Delete selected clip", category: "Editing" },
  { keys: ["M"], description: "Toggle audio mute on/off", category: "Editing" },

  // Timeline
  { keys: ["+"], description: "Zoom in on timeline", category: "Timeline" },
  { keys: ["-"], description: "Zoom out on timeline", category: "Timeline" },
  { keys: ["0"], description: "Reset timeline zoom to default", category: "Timeline" },
  { keys: ["Home"], description: "Jump to start of timeline", category: "Timeline" },
  { keys: ["End"], description: "Jump to end of timeline", category: "Timeline" },

  // General
  { keys: ["Cmd/Ctrl", "Z"], description: "Undo last change", category: "General" },
  { keys: ["Cmd/Ctrl", "Shift", "Z"], description: "Redo change", category: "General" },
  { keys: ["Cmd/Ctrl", "Y"], description: "Redo change (Windows)", category: "General" },
  { keys: ["Esc"], description: "Deselect clip / Close active panel", category: "General" },
  { keys: ["?"], description: "Open keyboard shortcuts guide", category: "General" },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  visible,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = ["All", "Transport", "Editing", "Timeline", "General"];

  const filteredShortcuts = useMemo(() => {
    return SHORTCUT_DEFINITIONS.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.keys.some((k) =>
          k.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

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
        <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.titleRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="keypad-outline" size={18} color={THEME_COLORS.accent} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Keyboard Shortcuts</Text>
                <Text style={styles.modalSubtitle}>
                  Pro NLE hotkeys for ultra-fast precision editing
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                soundEngine.playSfx("click");
                onClose();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={THEME_COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search bar & Category filters */}
          <View style={styles.filterSection}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={14} color={THEME_COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search shortcut (e.g. split, play, zoom)..."
                placeholderTextColor={THEME_COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={14} color={THEME_COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                    onPress={() => {
                      soundEngine.playSfx("click");
                      setSelectedCategory(cat);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isActive && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Shortcuts List */}
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
          >
            {filteredShortcuts.map((item, idx) => (
              <View key={`${item.category}-${idx}`} style={styles.shortcutRow}>
                <Text style={styles.shortcutDesc}>{item.description}</Text>
                <View style={styles.keysGroup}>
                  {item.keys.map((k, kIdx) => (
                    <React.Fragment key={kIdx}>
                      {kIdx > 0 && <Text style={styles.plusSign}>+</Text>}
                      <View style={styles.keyCap}>
                        <Text style={styles.keyText}>{k}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ))}

            {filteredShortcuts.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={32} color={THEME_COLORS.textDisabled} />
                <Text style={styles.emptyStateText}>
                  No shortcuts found matching &quot;{searchQuery}&quot;
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer note */}
          <View style={styles.modalFooter}>
            <Ionicons name="information-circle-outline" size={14} color={THEME_COLORS.textMuted} />
            <Text style={styles.footerText}>
              Press <Text style={styles.footerHighlight}>?</Text> anywhere on Web to open this cheat sheet.
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
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "82%",
    backgroundColor: THEME_COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderLight,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },
  modalCardMobile: {
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0, 229, 201, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 201, 0.25)",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME_COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: THEME_COLORS.surface,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME_COLORS.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  categoryPillActive: {
    backgroundColor: "rgba(0, 229, 201, 0.14)",
    borderColor: THEME_COLORS.accent,
  },
  categoryPillText: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    fontWeight: "500",
  },
  categoryPillTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: "600",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  shortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  shortcutDesc: {
    flex: 1,
    fontSize: 13,
    color: THEME_COLORS.textPrimary,
    marginRight: 16,
  },
  keysGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  plusSign: {
    color: THEME_COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  keyCap: {
    backgroundColor: "#262832",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#3A3D4D",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  keyText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyStateText: {
    color: THEME_COLORS.textMuted,
    fontSize: 13,
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.border,
  },
  footerText: {
    fontSize: 11,
    color: THEME_COLORS.textMuted,
  },
  footerHighlight: {
    color: THEME_COLORS.accent,
    fontWeight: "700",
  },
});

export default KeyboardShortcutsModal;
