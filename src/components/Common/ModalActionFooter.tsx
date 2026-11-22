import React from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TactileTouchable } from "./TactileTouchable";

export interface ModalActionFooterProps {
  onApply?: () => void;
  applyLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  onReset?: () => void;
  resetLabel?: string;
  onApplyToAll?: () => void;
  applyToAllLabel?: string;
  applyToAllChecked?: boolean;
  applyDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ModalActionFooter({
  onApply,
  applyLabel = "Apply",
  onCancel,
  cancelLabel = "Cancel",
  onReset,
  resetLabel = "Reset",
  onApplyToAll,
  applyToAllLabel = "Apply to all",
  applyToAllChecked = false,
  applyDisabled = false,
  style,
}: ModalActionFooterProps) {
  return (
    <View style={[styles.footerBar, style]}>
      <View style={styles.leftSection}>
        {onApplyToAll && (
          <TactileTouchable
            onPress={onApplyToAll}
            style={styles.applyToAllBtn}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: applyToAllChecked }}
          >
            <View
              style={[
                styles.checkbox,
                applyToAllChecked && styles.checkboxActive,
              ]}
            >
              {applyToAllChecked && (
                <Ionicons name="checkmark" size={12} color="#121214" />
              )}
            </View>
            <Text style={styles.applyToAllText}>{applyToAllLabel}</Text>
          </TactileTouchable>
        )}

        {onReset && !onApplyToAll && (
          <TactileTouchable
            onPress={onReset}
            style={styles.secondaryBtn}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={13} color="#00F2FE" />
            <Text style={styles.secondaryBtnText}>{resetLabel}</Text>
          </TactileTouchable>
        )}
      </View>

      <View style={styles.rightSection}>
        {onCancel && (
          <TactileTouchable
            onPress={onCancel}
            style={styles.cancelBtn}
            accessibilityRole="button"
          >
            <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
          </TactileTouchable>
        )}

        {onApply && (
          <TactileTouchable
            onPress={applyDisabled ? undefined : onApply}
            style={[styles.applyBtn, applyDisabled && styles.applyBtnDisabled]}
            disabled={applyDisabled}
            accessibilityRole="button"
          >
            <Text style={styles.applyBtnText}>{applyLabel}</Text>
          </TactileTouchable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerBar: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    backgroundColor: "#121214",
    borderTopWidth: 1,
    borderTopColor: "#1F1F23",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  applyToAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#27272A",
    backgroundColor: "#18181A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  checkboxActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  applyToAllText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "400",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
  },
  secondaryBtnText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "600",
  },
  cancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: "transparent",
  },
  cancelBtnText: {
    color: "#8E8E93",
    fontSize: 10.5,
    fontWeight: "400",
  },
  applyBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  applyBtnDisabled: {
    opacity: 0.35,
  },
  applyBtnText: {
    color: "#0E0E10",
    fontSize: 10.5,
    fontWeight: "500",
  },
});

