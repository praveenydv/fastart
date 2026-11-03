import React from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";

export interface ModalSheetContainerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  header?: React.ReactNode;
  isInline?: boolean;
  showDragHandle?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  maxHeight?: number | string;
}

export function ModalSheetContainer({
  visible,
  onClose,
  children,
  header,
  isInline = false,
  showDragHandle = true,
  contentStyle,
  containerStyle,
  maxHeight,
}: ModalSheetContainerProps) {
  if (!visible) return null;

  const sheetContent = (
    <View
      style={[
        styles.sheet,
        isInline && styles.inlineSheet,
        maxHeight ? { maxHeight: maxHeight as any } : undefined,
        containerStyle,
      ]}
    >
      {showDragHandle && !isInline && (
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandlePill} />
        </View>
      )}

      {header}

      <View style={[styles.body, contentStyle]}>{children}</View>
    </View>
  );

  if (isInline) {
    return sheetContent;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Dismiss modal"
          accessibilityRole="button"
        />
        {sheetContent}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    zIndex: 999,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: "#08090E",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
    overflow: "hidden",
    maxHeight: Platform.OS === "web" ? "75%" : "80%",
    width: "100%",
  },
  inlineSheet: {
    flex: 1,
    maxHeight: undefined,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    backgroundColor: "transparent",
  },
  dragHandleContainer: {
    width: "100%",
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#08090E",
  },
  dragHandlePill: {
    width: 36,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#2A344A",
  },
  body: {
    flexShrink: 1,
  },
});
