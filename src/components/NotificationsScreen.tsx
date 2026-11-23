import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "./Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
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
        bgColor: "rgba(239, 68, 68, 0.12)",
      };
    }
    if (combined.includes("export") || combined.includes("render") || combined.includes("download")) {
      return {
        icon: "cloud-download-outline",
        color: "#EDEDED",
        bgColor: "rgba(255, 255, 255, 0.08)",
      };
    }
    if (combined.includes("duplicate") || combined.includes("copy")) {
      return {
        icon: "copy-outline",
        color: "#A1A1AA",
        bgColor: "rgba(255, 255, 255, 0.06)",
      };
    }
    if (combined.includes("create") || combined.includes("new project") || combined.includes("ready for editing")) {
      return {
        icon: "film-outline",
        color: "#10B981",
        bgColor: "rgba(16, 185, 129, 0.12)",
      };
    }
    if (combined.includes("media") || combined.includes("audio") || combined.includes("music") || combined.includes("sound")) {
      return {
        icon: "musical-notes-outline",
        color: "#EDEDED",
        bgColor: "rgba(255, 255, 255, 0.08)",
      };
    }

    return {
      icon: item.projectId ? "videocam-outline" : "notifications-outline",
      color: item.unread ? "#FFFFFF" : "#71717A",
      bgColor: item.unread ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.04)",
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
                  onMarkAllAsRead();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name="checkmark-done"
                  size={14}
                  color="#EDEDED"
                />
                <Text style={styles.markReadText}>Mark read</Text>
              </TouchableOpacity>
            )}

            {notifications.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  onClearAll();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Clear all notifications"
              >
                <Ionicons name="trash-outline" size={15} color="#71717A" />
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
                  size={32}
                  color="#71717A"
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
                        size={16}
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
                                color="#71717A"
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
                                color="#EDEDED"
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
                          onDeleteNotification(item.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Dismiss notification"
                      >
                        <Ionicons name="close" size={15} color="#71717A" />
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
    backgroundColor: "#121214",
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
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    backgroundColor: "#121214",
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
    color: "#EDEDED",
    fontSize: 13,
    fontWeight: "500",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  unreadCountBadge: {
    backgroundColor: "#27272A",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3F3F46",
  },
  unreadCountText: {
    color: "#EDEDED",
    fontSize: 11,
    fontWeight: "600",
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
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  markReadText: {
    color: "#EDEDED",
    fontSize: 11.5,
    fontWeight: "500",
  },
  clearBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 64,
  },
  contentContainer: {
    width: "100%",
  },
  filterBar: {
    marginBottom: 16,
  },
  filterTrack: {
    flexDirection: "row",
    backgroundColor: "#141416",
    borderRadius: 8,
    padding: 2.5,
    borderWidth: 1,
    borderColor: "#1F1F23",
    alignSelf: "flex-start",
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  filterPillActive: {
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  filterPillText: {
    color: "#71717A",
    fontSize: 11.5,
    fontWeight: "500",
  },
  filterPillTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  cardList: {
    gap: 8,
  },
  notifCard: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#18181A",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#1F1F23",
    overflow: "hidden",
  },
  notifCardUnread: {
    backgroundColor: "#1D1D20",
    borderColor: "#27272A",
  },
  unreadAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#FFFFFF",
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
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
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  notifTitleUnread: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  unreadDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFFFFF",
    flexShrink: 0,
  },
  timeText: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "400",
    flexShrink: 0,
  },
  notifDesc: {
    color: "#A1A1AA",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  projectBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#1F1F23",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  projectBadgeText: {
    color: "#71717A",
    fontSize: 10.5,
    fontWeight: "500",
    maxWidth: 200,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#27272A",
    borderWidth: 1,
    borderColor: "#3F3F46",
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  actionBtnText: {
    color: "#EDEDED",
    fontSize: 10.5,
    fontWeight: "500",
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
    paddingVertical: 56,
    paddingHorizontal: 20,
    backgroundColor: "#141416",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F1F23",
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#71717A",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 18,
  },
});
