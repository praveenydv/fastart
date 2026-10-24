import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { AppNotification, formatNotificationTime } from "../utils/storage";
import { theme } from "../constants/theme";

interface NotificationsScreenProps {
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onDeleteNotification?: (id: string) => void;
  onActionClick?: (notification: AppNotification) => void;
  onBack: () => void;
}

export default function NotificationsScreen({
  notifications = [],
  onMarkAllAsRead,
  onClearAll,
  onDeleteNotification,
  onActionClick,
  onBack,
}: NotificationsScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadCount = notifications.filter((n) => n.unread).length;

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => n.unread) : notifications;

  const getNotificationMeta = (
    item: AppNotification
  ): { icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string } => {
    const titleLower = (item.title || "").toLowerCase();
    const descLower = (item.message || item.body || item.description || "").toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    if (combined.includes("delete") || combined.includes("remove")) {
      return {
        icon: "trash-outline",
        color: "#EF4444",
        bgColor: "rgba(239, 68, 68, 0.15)",
      };
    }
    if (combined.includes("export") || combined.includes("render") || combined.includes("download")) {
      return {
        icon: "cloud-download-outline",
        color: "#00F2FE",
        bgColor: "rgba(0, 242, 254, 0.15)",
      };
    }
    if (combined.includes("duplicate") || combined.includes("copy")) {
      return {
        icon: "copy-outline",
        color: "#A78BFA",
        bgColor: "rgba(167, 139, 250, 0.15)",
      };
    }
    if (combined.includes("create") || combined.includes("new project") || combined.includes("ready for editing")) {
      return {
        icon: "film-outline",
        color: "#10B981",
        bgColor: "rgba(16, 185, 129, 0.15)",
      };
    }
    if (combined.includes("media") || combined.includes("audio") || combined.includes("music") || combined.includes("sound")) {
      return {
        icon: "musical-notes-outline",
        color: "#38BDF8",
        bgColor: "rgba(56, 189, 248, 0.15)",
      };
    }

    return {
      icon: item.projectId ? "videocam-outline" : "notifications-outline",
      color: item.unread ? "#00F2FE" : "#94A3B8",
      bgColor: item.unread ? "rgba(0, 242, 254, 0.12)" : "rgba(255, 255, 255, 0.05)",
    };
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <View
          style={[
            styles.navBarInner,
            isDesktop ? styles.desktopWrapper : styles.mobileWrapper,
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              soundEngine.playSfx("click");
              onBack();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Home</Text>
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Text style={styles.navTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unreadCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.navActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.markReadBtn}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onMarkAllAsRead();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name="checkmark-done"
                  size={14}
                  color="#00F2FE"
                />
                <Text style={styles.markReadText}>Mark read</Text>
              </TouchableOpacity>
            )}

            {notifications.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onClearAll();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Clear all notifications"
              >
                <Ionicons name="trash-outline" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.contentContainer,
            isDesktop ? styles.desktopWrapper : styles.mobileWrapper,
          ]}
        >
          {/* Filter Pills (All / Unread) */}
          {notifications.length > 0 && (
            <View style={styles.filterBar}>
              <View style={styles.filterTrack}>
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    filter === "all" && styles.filterPillActive,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    setFilter("all");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      filter === "all" && styles.filterPillTextActive,
                    ]}
                  >
                    All ({notifications.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    filter === "unread" && styles.filterPillActive,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    setFilter("unread");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      filter === "unread" && styles.filterPillTextActive,
                    ]}
                  >
                    Unread ({unreadCount})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Notifications List */}
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={filter === "unread" ? "checkmark-done-circle-outline" : "notifications-off-outline"}
                  size={36}
                  color="#00F2FE"
                />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === "unread" ? "You're All Caught Up" : "No Notifications Yet"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filter === "unread"
                  ? "All notifications have been reviewed. Switch to 'All' to view your project history."
                  : "Updates regarding your video renders, exports, project status, and audio clips will appear here."}
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {filteredNotifications.map((item) => {
                const meta = getNotificationMeta(item);
                const messageText =
                  item.message || item.body || item.description || "";
                const formattedTime = item.createdAt
                  ? formatNotificationTime(item.createdAt)
                  : item.timestamp || "Just now";

                const hasAction = Boolean(item.actionText && onActionClick);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notifCard,
                      item.unread && styles.notifCardUnread,
                    ]}
                    activeOpacity={hasAction ? 0.75 : 0.95}
                    onPress={() => {
                      if (hasAction && onActionClick) {
                        soundEngine.playSfx("whoosh");
                        onActionClick(item);
                      }
                    }}
                  >
                    {/* Unread Accent Indicator Bar */}
                    {item.unread && <View style={styles.unreadAccentBar} />}

                    {/* Left Icon Badge */}
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: meta.bgColor },
                      ]}
                    >
                      <Ionicons
                        name={meta.icon}
                        size={17}
                        color={meta.color}
                      />
                    </View>

                    {/* Center Content Column */}
                    <View style={styles.contentCol}>
                      <View style={styles.topRow}>
                        <View style={styles.titleWrapper}>
                          <Text
                            style={[
                              styles.notifTitle,
                              item.unread && styles.notifTitleUnread,
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          {item.unread && <View style={styles.unreadDot} />}
                        </View>

                        <Text style={styles.timeText}>{formattedTime}</Text>
                      </View>

                      {messageText ? (
                        <Text style={styles.notifDesc} numberOfLines={2}>
                          {messageText}
                        </Text>
                      ) : null}

                      {/* Compact Inline Tags & Action Row */}
                      {(item.projectTitle || hasAction) && (
                        <View style={styles.footerRow}>
                          {item.projectTitle && (
                            <View style={styles.projectBadge}>
                              <Ionicons
                                name="folder-outline"
                                size={11}
                                color="#94A3B8"
                              />
                              <Text
                                style={styles.projectBadgeText}
                                numberOfLines={1}
                              >
                                {item.projectTitle}
                              </Text>
                            </View>
                          )}

                          {hasAction && (
                            <TouchableOpacity
                              style={styles.actionBtn}
                              onPress={() => {
                                soundEngine.playSfx("whoosh");
                                onActionClick?.(item);
                              }}
                              activeOpacity={0.7}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <Text style={styles.actionBtnText}>
                                {item.actionText}
                              </Text>
                              <Ionicons
                                name="arrow-forward"
                                size={11}
                                color="#00F2FE"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Right Dismiss Button */}
                    {onDeleteNotification && (
                      <TouchableOpacity
                        style={styles.deleteItemBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          soundEngine.playSfx("pop");
                          onDeleteNotification(item.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Dismiss notification"
                      >
                        <Ionicons name="close" size={15} color="#64748B" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090E",
  },
  desktopWrapper: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  mobileWrapper: {
    width: "100%",
  },
  navBar: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    backgroundColor: "#0F131D",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  navBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingRight: 10,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  unreadCountBadge: {
    backgroundColor: "#00F2FE",
    paddingHorizontal: 6.5,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  unreadCountText: {
    color: "#08090E",
    fontSize: 11,
    fontWeight: "800",
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  markReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  markReadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  clearBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  contentContainer: {
    width: "100%",
  },
  filterBar: {
    marginBottom: 16,
  },
  filterTrack: {
    flexDirection: "row",
    backgroundColor: "#0F131D",
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: "#1F2637",
    alignSelf: "flex-start",
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  filterPillActive: {
    backgroundColor: "#1B2234",
    borderWidth: 1,
    borderColor: "#2C364D",
  },
  filterPillText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cardList: {
    gap: 8,
  },
  notifCard: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#131826",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#1F2637",
    overflow: "hidden",
  },
  notifCardUnread: {
    backgroundColor: "#161D2E",
    borderColor: "#2A3650",
  },
  unreadAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: "#00F2FE",
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    marginRight: 12,
    flexShrink: 0,
  },
  contentCol: {
    flex: 1,
    marginRight: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  titleWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  notifTitle: {
    color: "#94A3B8",
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  notifTitleUnread: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00F2FE",
    flexShrink: 0,
  },
  timeText: {
    color: "#64748B",
    fontSize: 11.5,
    fontWeight: "500",
    flexShrink: 0,
  },
  notifDesc: {
    color: "#94A3B8",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  projectBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4.5,
    backgroundColor: "#0F131D",
    borderWidth: 1,
    borderColor: "#1F2637",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  projectBadgeText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 200,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4.5,
    backgroundColor: "#1B2234",
    borderWidth: 1,
    borderColor: "#2C364D",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  deleteItemBtn: {
    padding: 4,
    marginTop: -2,
    marginRight: -4,
    opacity: 0.8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 20,
    backgroundColor: "#0F131D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2637",
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 19,
  },
});
