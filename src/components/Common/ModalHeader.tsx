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
  iconColor = "#A1A1AA",
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
            <Ionicons name={closeIconName} size={14} color="#8E8E93" />
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
            <Ionicons name="refresh-outline" size={10} color="#00F2FE" style={{ marginRight: 2.5 }} />
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
                size={12}
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
                color="#121214"
              />
            ) : (
              <>
                <Ionicons name={doneIconName} size={13} color={showApplyText ? "#0E0E10" : "#FFFFFF"} />
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
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    backgroundColor: "#121214",
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    zIndex: 10,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 36,
    gap: 4,
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 36,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  headerIcon: {
    marginRight: 4,
  },
  titleText: {
    color: "#EDEDED",
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0,
  },
  subtitleText: {
    color: "#71717A",
    fontSize: 9.5,
    marginLeft: 4,
    fontWeight: "400",
  },
  cancelButton: {
    width: 24,
    height: 24,
    borderRadius: 3,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  leftSpacer: {
    width: 24,
    height: 24,
  },
  rightSpacer: {
    width: 24,
    height: 24,
  },
  applyPillButton: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  applyIconButton: {
    width: 24,
    height: 24,
    borderRadius: 3,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#0E0E10",
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0,
  },
  resetChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 3,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
  },
  resetChipText: {
    color: "#00F2FE",
    fontSize: 9.5,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.35,
  },
});
