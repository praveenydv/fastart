import React from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TactileTouchable } from "./TactileTouchable";

export interface ModalHeaderProps {
  title?: string;
  subtitle?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onClose?: () => void;
  closeAriaLabel?: string;
  closeIconName?: keyof typeof Ionicons.glyphMap;
  onDone?: () => void;
  doneAriaLabel?: string;
  doneIconName?: keyof typeof Ionicons.glyphMap;
  doneText?: string;
  doneDisabled?: boolean;
  doneLoading?: boolean;
  onReset?: () => void;
  resetText?: string;
  leftNode?: React.ReactNode;
  rightNode?: React.ReactNode;
  centerNode?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  hideBorder?: boolean;
}

export function ModalHeader({
  title,
  subtitle,
  iconName,
  iconColor = "#00F2FE",
  onClose,
  closeAriaLabel = "Cancel",
  closeIconName = "close",
  onDone,
  doneAriaLabel = "Apply",
  doneIconName = "checkmark",
  doneText,
  doneDisabled = false,
  doneLoading = false,
  onReset,
  resetText = "Reset",
  leftNode,
  rightNode,
  centerNode,
  style,
  titleStyle,
  hideBorder = false,
}: ModalHeaderProps) {
  // Clear visual hierarchy: When onDone is present, default to showing "Apply" text pill unless explicitly empty
  const showApplyText = doneText !== "";
  const displayDoneText = doneText ?? "Apply";

  return (
    <View style={[styles.headerBar, hideBorder && styles.noBorder, style]}>
      {/* Left section: Cancel / Dismiss action */}
      <View style={styles.leftSection}>
        {leftNode ? (
          leftNode
        ) : onClose ? (
          <TactileTouchable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.cancelButton}
            accessibilityLabel={closeAriaLabel}
            accessibilityRole="button"
          >
            <Ionicons name={closeIconName} size={15} color="#94A3B8" />
          </TactileTouchable>
        ) : (
          <View style={styles.leftSpacer} />
        )}

        {onReset && (
          <TactileTouchable
            onPress={onReset}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.resetChip}
            accessibilityLabel={resetText}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={10.5} color="#00F2FE" style={{ marginRight: 3 }} />
            <Text style={styles.resetChipText}>{resetText}</Text>
          </TactileTouchable>
        )}
      </View>

      {/* Center section: Clean, space-optimized Title */}
      <View style={styles.centerSection}>
        {centerNode ? (
          centerNode
        ) : (
          <View style={styles.titleRow}>
            {iconName && (
              <Ionicons
                name={iconName}
                size={14}
                color={iconColor}
                style={styles.headerIcon}
              />
            )}
            <Text
              style={[styles.titleText, titleStyle]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Right section: High-prominence affirmative Apply Action Pill */}
      <View style={styles.rightSection}>
        {rightNode ? (
          rightNode
        ) : onDone ? (
          <TactileTouchable
            onPress={doneDisabled || doneLoading ? undefined : onDone}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[
              showApplyText ? styles.applyPillButton : styles.applyIconButton,
              doneDisabled && styles.disabledButton,
            ]}
            disabled={doneDisabled || doneLoading}
            accessibilityLabel={doneAriaLabel}
            accessibilityRole="button"
          >
            {doneLoading ? (
              <ActivityIndicator
                size="small"
                color="#08090E"
              />
            ) : (
              <>
                <Ionicons name={doneIconName} size={14} color="#08090E" style={{ fontWeight: "800" }} />
                {showApplyText && (
                  <Text style={styles.applyButtonText}>{displayDoneText}</Text>
                )}
              </>
            )}
          </TactileTouchable>
        ) : (
          <View style={styles.rightSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    backgroundColor: "#0B0E17",
    borderBottomWidth: 1,
    borderBottomColor: "#1C2436",
    zIndex: 10,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 40,
    gap: 6,
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 40,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  headerIcon: {
    marginRight: 5,
  },
  titleText: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  subtitleText: {
    color: "#64748B",
    fontSize: 10.5,
    marginLeft: 5,
    fontWeight: "500",
  },
  cancelButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  leftSpacer: {
    width: 28,
    height: 28,
  },
  rightSpacer: {
    width: 28,
    height: 28,
  },
  applyPillButton: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: "#00F2FE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  applyIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  applyButtonText: {
    color: "#08090E",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  resetChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.20)",
  },
  resetChipText: {
    color: "#00F2FE",
    fontSize: 10.5,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.45,
  },
});
