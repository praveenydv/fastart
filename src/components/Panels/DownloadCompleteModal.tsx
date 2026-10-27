import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";

export interface DownloadCompleteModalProps {
  visible: boolean;
  onClose: () => void;
  filename: string;
  formatLabel: string;
  formatExt: string;
  destinationPath?: string | null;
  resolution?: string;
  fps?: number;
  fileSize?: string;
  duration?: number;
  isSavedToGallery?: boolean;
  onDownloadAgain?: () => void;
}

export default function DownloadCompleteModal({
  visible,
  onClose,
  filename,
  formatLabel,
  formatExt,
  destinationPath,
  resolution,
  fps,
  fileSize,
  duration,
  isSavedToGallery = true,
  onDownloadAgain,
}: DownloadCompleteModalProps) {
  React.useEffect(() => {
    if (visible) {
      soundEngine.playSfx("pop");
    }
  }, [visible]);

  if (!visible) return null;

  const isWeb = Platform.OS === "web";
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
          {/* Subtle Ambient Glow Border */}
          <View style={styles.glowBorder}>
            {/* Header / Celebration Icon */}
            <View style={styles.iconCircleOuter}>
              <View style={styles.iconCircleInner}>
                <Ionicons name="checkmark-circle" size={36} color="#00F2FE" />
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
                  color="#00F2FE"
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
                  <Ionicons name="folder-open" size={14} color="#00F2FE" />
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
                <Ionicons name="shield-checkmark" size={13} color="#00F2FE" />
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
                  soundEngine.playSfx("pop");
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-sharp" size={16} color="#08090E" />
                <Text style={styles.primaryBtnText}>Done / Back to Editor</Text>
              </TouchableOpacity>

              {/* Secondary Action: Save/Download Again */}
              {onDownloadAgain && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    onDownloadAgain();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="cloud-download-outline"
                    size={15}
                    color="#00F2FE"
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
    backgroundColor: "#0F131D",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
    overflow: "hidden",
  },
  glowBorder: {
    borderWidth: 1,
    borderColor: "#1F2637",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    backgroundColor: "#0F131D",
  },
  iconCircleOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
  },
  iconCircleInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 242, 254, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#08090E",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1F2637",
    marginBottom: 16,
  },
  filenameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  filenameText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: "#131826",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  badgeText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
  },
  formatBadge: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "rgba(0, 242, 254, 0.25)",
  },
  formatBadgeText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "800",
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
  },
  verifiedText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "500",
  },
  destinationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  destinationTextContainer: {
    flex: 1,
  },
  destinationHeader: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  destinationValue: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "500",
    lineHeight: 14,
  },
  actionsContainer: {
    width: "100%",
    gap: 8,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00F2FE",
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: "#08090E",
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#131826",
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  secondaryBtnText: {
    color: "#00F2FE",
    fontSize: 11.5,
    fontWeight: "700",
  },
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },
  doneBtnText: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "600",
  },
});
