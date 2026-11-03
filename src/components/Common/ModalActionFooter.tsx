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
                <Ionicons name="checkmark" size={12} color="#08090E" />
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
            <Ionicons name="refresh-outline" size={14} color="#94A3B8" />
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
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: "#08090E",
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  applyToAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#131826",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  applyToAllText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  secondaryBtnText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  cancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  applyBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#00F2FE",
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    color: "#08090E",
    fontSize: 12,
    fontWeight: "700",
  },
});

