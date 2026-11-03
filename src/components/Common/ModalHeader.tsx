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
  closeAriaLabel = "Close",
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
  return (
    <View style={[styles.headerBar, hideBorder && styles.noBorder, style]}>
      {/* Left section: Close button or custom node */}
      <View style={styles.leftSection}>
        {leftNode ? (
          leftNode
        ) : onClose ? (
          <TactileTouchable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.iconButton}
            accessibilityLabel={closeAriaLabel}
            accessibilityRole="button"
          >
            <Ionicons name={closeIconName} size={18} color="#94A3B8" />
          </TactileTouchable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}

        {onReset && (
          <TactileTouchable
            onPress={onReset}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.resetButton}
            accessibilityLabel={resetText}
            accessibilityRole="button"
          >
            <Text style={styles.resetButtonText}>{resetText}</Text>
          </TactileTouchable>
        )}
      </View>

      {/* Center section: Title and subtitle or custom center node */}
      <View style={styles.centerSection}>
        {centerNode ? (
          centerNode
        ) : (
          <View style={styles.titleWrapper}>
            {iconName && (
              <Ionicons
                name={iconName}
                size={16}
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

      {/* Right section: Done / Confirm button or custom right node */}
      <View style={styles.rightSection}>
        {rightNode ? (
          rightNode
        ) : onDone ? (
          <TactileTouchable
            onPress={doneDisabled || doneLoading ? undefined : onDone}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[
              doneText ? styles.doneTextButton : styles.doneIconButton,
              doneDisabled && styles.disabledButton,
            ]}
            disabled={doneDisabled || doneLoading}
            accessibilityLabel={doneAriaLabel}
            accessibilityRole="button"
          >
            {doneLoading ? (
              <ActivityIndicator
                size="small"
                color={doneText ? "#FFFFFF" : "#08090E"}
              />
            ) : doneText ? (
              <Text style={styles.doneButtonText}>{doneText}</Text>
            ) : (
              <Ionicons name={doneIconName} size={19} color="#08090E" />
            )}
          </TactileTouchable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: "#08090E",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    zIndex: 10,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 44,
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 44,
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  headerIcon: {
    marginRight: 6,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitleText: {
    color: "#64748B",
    fontSize: 11,
    marginLeft: 6,
    fontWeight: "500",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonSpacer: {
    width: 36,
    height: 36,
  },
  doneIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  doneTextButton: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: "#08090E",
    fontSize: 13,
    fontWeight: "700",
  },
  resetButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  resetButtonText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.45,
  },
});

