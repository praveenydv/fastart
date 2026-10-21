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
  resolution?: string;
  fps?: number;
  fileSize?: string;
  duration?: number;
  isSavedToGallery?: boolean;
  onShare?: () => void;
  onDownloadAgain?: () => void;
}

export default function DownloadCompleteModal({
  visible,
  onClose,
  filename,
  formatLabel,
  formatExt,
  resolution,
  fps,
  fileSize,
  duration,
  isSavedToGallery = true,
  onShare,
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
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
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
                  size={18}
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

              {/* Status Verification Pill */}
              <View style={styles.verifiedRow}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text style={styles.verifiedText}>
                  {isWeb
                    ? "Verified download • Ready to play or upload"
                    : "Verified in Camera Roll • Ready to post"}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {/* Primary Action: Share */}
              {onShare && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    onShare();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="share-social-outline"
                    size={20}
                    color="#000000"
                  />
                  <Text style={styles.primaryBtnText}>
                    Share via Apps (WhatsApp, IG, etc.)
                  </Text>
                </TouchableOpacity>
              )}

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
                    size={18}
                    color="#00F2FE"
                  />
                  <Text style={styles.secondaryBtnText}>
                    {isWeb ? "Download Again" : "Save Another Copy"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Done / Return to Editor */}
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.doneBtnText}>Done / Back to Editor</Text>
              </TouchableOpacity>
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
    backgroundColor: "rgba(3, 6, 12, 0.82)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 99999,
  },
  cardContainer: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: "#0D111A",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 20,
    overflow: "hidden",
  },
  glowBorder: {
    borderWidth: 1.2,
    borderColor: "rgba(0, 242, 254, 0.3)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    backgroundColor: "rgba(16, 21, 33, 0.95)",
  },
  iconCircleOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.28)",
  },
  iconCircleInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    color: "#8E95A5",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "500",
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#090C14",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E2638",
    marginBottom: 22,
  },
  filenameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  filenameText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: "#161D2B",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#243046",
  },
  badgeText: {
    color: "#C2C9D6",
    fontSize: 11,
    fontWeight: "600",
  },
  formatBadge: {
    backgroundColor: "rgba(0, 242, 254, 0.15)",
    borderColor: "rgba(0, 242, 254, 0.35)",
  },
  formatBadgeText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "800",
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#161D2B",
  },
  verifiedText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "600",
  },
  actionsContainer: {
    width: "100%",
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00F2FE",
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
  },
  secondaryBtnText: {
    color: "#00F2FE",
    fontSize: 13,
    fontWeight: "700",
  },
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 10,
  },
  doneBtnText: {
    color: "#8E95A5",
    fontSize: 13,
    fontWeight: "600",
  },
});
