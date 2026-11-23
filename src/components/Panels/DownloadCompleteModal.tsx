import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";

interface DownloadCompleteModalProps {
  visible: boolean;
  onClose: () => void;
  filename: string;
  destinationPath?: string;
  fileSize?: string;
  resolution?: string;
  fps?: number;
  duration?: number;
  isSavedToGallery?: boolean;
  onDownloadAgain?: () => void;
}

export default function DownloadCompleteModal({
  visible,
  onClose,
  filename,
  destinationPath,
  fileSize,
  resolution,
  fps,
  duration,
  isSavedToGallery = false,
  onDownloadAgain,
}: DownloadCompleteModalProps) {
  const isWeb = Platform.OS === "web";
  const formatExt = filename.split(".").pop()?.toLowerCase() || "mp4";
  const formatLabel = formatExt.toUpperCase();

  const displayLocation = isWeb
    ? "Saved to your browser Downloads folder"
    : destinationPath
      ? `Saved to: ${destinationPath}`
      : isSavedToGallery
        ? "Saved directly to Photos & Gallery"
        : "Exported to device storage";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          <View style={styles.glowBorder}>
            {/* Header / Celebration Icon */}
            <View style={styles.iconCircleOuter}>
              <View style={styles.iconCircleInner}>
                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
              </View>
            </View>

            {/* Title & Headline */}
            <Text style={styles.title}>Download Complete!</Text>
            <Text style={styles.subtitle}>{displayLocation}</Text>

            {/* Media Information Card */}
            <View style={styles.infoCard}>
              <View style={styles.filenameRow}>
                <Ionicons
                  name={
                    formatExt.includes("png")
                      ? "image"
                      : formatExt.includes("wav")
                        ? "musical-notes"
                        : "film"
                  }
                  size={15}
                  color="#EDEDED"
                />
                <Text
                  style={styles.filenameText}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {filename}
                </Text>
              </View>

              {/* Badges Row */}
              <View style={styles.badgeRow}>
                <View style={[styles.badge, styles.formatBadge]}>
                  <Text style={styles.formatBadgeText}>{formatLabel}</Text>
                </View>

                {resolution ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{resolution}</Text>
                  </View>
                ) : null}

                {fps ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{fps} FPS</Text>
                  </View>
                ) : null}

                {fileSize ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{fileSize}</Text>
                  </View>
                ) : null}

                {duration ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {duration.toFixed(1)}s
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Exact Destination Path Card */}
              {destinationPath ? (
                <View style={styles.destinationCard}>
                  <Ionicons name="folder-open" size={14} color="#EDEDED" />
                  <View style={styles.destinationTextContainer}>
                    <Text style={styles.destinationHeader}>File Location</Text>
                    <Text
                      style={styles.destinationValue}
                      numberOfLines={2}
                      ellipsizeMode="middle"
                    >
                      {destinationPath}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Status Verification Pill */}
              <View style={styles.verifiedRow}>
                <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                <Text style={styles.verifiedText}>
                  {isWeb
                    ? "Verified download • Check your Downloads folder"
                    : "Notification sent • Ready to view in Gallery or Files"}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {/* Primary Action: Done / Back to Editor */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-sharp" size={15} color="#08090E" />
                <Text style={styles.primaryBtnText}>Done / Back to Editor</Text>
              </TouchableOpacity>

              {/* Secondary Action: Save/Download Again */}
              {onDownloadAgain && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    onDownloadAgain();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="cloud-download-outline"
                    size={14}
                    color="#EDEDED"
                  />
                  <Text style={styles.secondaryBtnText}>
                    {isWeb ? "Download Again" : "Save Another Copy"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    zIndex: 99999,
  },
  cardContainer: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    backgroundColor: "#18181A",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
    overflow: "hidden",
  },
  glowBorder: {
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    backgroundColor: "#18181A",
  },
  iconCircleOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  iconCircleInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#EDEDED",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 3,
    textAlign: "center",
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: 10.5,
    textAlign: "center",
    marginBottom: 14,
    fontWeight: "400",
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#141416",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 14,
  },
  filenameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  filenameText: {
    flex: 1,
    color: "#EDEDED",
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: "#18181A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  badgeText: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "500",
  },
  formatBadge: {
    backgroundColor: "#27272A",
    borderColor: "#3F3F46",
  },
  formatBadgeText: {
    color: "#EDEDED",
    fontSize: 9.5,
    fontWeight: "600",
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#1F1F23",
  },
  verifiedText: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "400",
  },
  destinationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 6,
    padding: 7,
    marginBottom: 8,
  },
  destinationTextContainer: {
    flex: 1,
  },
  destinationHeader: {
    color: "#8E8E93",
    fontSize: 8.5,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  destinationValue: {
    color: "#EDEDED",
    fontSize: 9.5,
    fontWeight: "400",
    lineHeight: 13,
  },
  actionsContainer: {
    width: "100%",
    gap: 6,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00F2FE",
    paddingVertical: 9,
    borderRadius: 6,
  },
  primaryBtnText: {
    color: "#08090E",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#18181A",
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  secondaryBtnText: {
    color: "#EDEDED",
    fontSize: 11,
    fontWeight: "500",
  },
});
