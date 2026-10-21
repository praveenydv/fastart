import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { AppNotification, formatNotificationTime } from "../utils/storage";

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
        color: "#FF4567",
        bgColor: "rgba(255, 69, 103, 0.12)",
      };
    }
    if (combined.includes("export") || combined.includes("render") || combined.includes("download")) {
      return {
        icon: "cloud-download-outline",
        color: "#38BDF8",
        bgColor: "rgba(56, 189, 248, 0.12)",
      };
    }
    if (combined.includes("duplicate") || combined.includes("copy")) {
      return {
        icon: "copy-outline",
        color: "#818CF8",
        bgColor: "rgba(129, 140, 248, 0.12)",
      };
    }
    if (combined.includes("create") || combined.includes("new project") || combined.includes("ready for editing")) {
      return {
        icon: "film-outline",
        color: "#00F2FE",
        bgColor: "rgba(0, 242, 254, 0.12)",
      };
    }
    if (combined.includes("media") || combined.includes("audio") || combined.includes("music") || combined.includes("sound")) {
      return {
        icon: "musical-notes-outline",
        color: "#10B981",
        bgColor: "rgba(16, 185, 129, 0.12)",
      };
    }

    if (item.icon && (Ionicons.glyphMap as any)[item.icon]) {
      return {
        icon: item.icon as keyof typeof Ionicons.glyphMap,
        color: item.unread ? "#00F2FE" : "#94A3B8",
        bgColor: item.unread ? "rgba(0, 242, 254, 0.1)" : "rgba(148, 163, 184, 0.08)",
      };
    }

    return {
      icon: item.projectId ? "videocam-outline" : "notifications-outline",
      color: item.unread ? "#00F2FE" : "#94A3B8",
      bgColor: item.unread ? "rgba(0, 242, 254, 0.1)" : "rgba(148, 163, 184, 0.08)",
    };
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            soundEngine.playSfx("click");
            onBack();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.navTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{unreadCount} new</Text>
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
                name="checkmark-done-outline"
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
              <Ionicons name="trash-outline" size={17} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerWrapper}>
          {/* Filter Pills (All / Unread) */}
          {notifications.length > 0 && (
            <View style={styles.filterRow}>
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
          )}

          {/* Notifications List */}
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={filter === "unread" ? "checkmark-circle-outline" : "notifications-outline"}
                  size={32}
                  color="#64748B"
                />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === "unread" ? "No unread notifications" : "No Notifications"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filter === "unread"
                  ? "You're all caught up! Switch to 'All' to view history."
                  : "Updates about your projects, renders, and media will show up here."}
              </Text>
            </View>
          ) : (
            filteredNotifications.map((item) => {
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
                  activeOpacity={hasAction ? 0.75 : 1}
                  onPress={() => {
                    if (hasAction && onActionClick) {
                      soundEngine.playSfx("whoosh");
                      onActionClick(item);
                    }
                  }}
                >
                  {/* Left Icon Badge */}
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: meta.bgColor },
                    ]}
                  >
                    <Ionicons
                      name={meta.icon}
                      size={15}
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
                              size={10.5}
                              color="#64748B"
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
                      <Ionicons name="close" size={14} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0D13",
  },
  navBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#171B26",
    backgroundColor: "#0E1118",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
    paddingRight: 8,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  navTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  unreadCountBadge: {
    backgroundColor: "#00F2FE",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  unreadCountText: {
    color: "#000000",
    fontSize: 10,
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
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
  },
  markReadText: {
    color: "#00F2FE",
    fontSize: 11.5,
    fontWeight: "700",
  },
  clearBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 640,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterPillActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "rgba(0, 242, 254, 0.3)",
  },
  filterPillText: {
    color: "#64748B",
    fontSize: 11.5,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#10141E",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  notifCardUnread: {
    backgroundColor: "#121826",
    borderColor: "rgba(0, 242, 254, 0.22)",
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    marginRight: 10,
    flexShrink: 0,
  },
  contentCol: {
    flex: 1,
    marginRight: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  titleWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  notifTitle: {
    color: "#CBD5E1",
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
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 0,
  },
  deleteItemBtn: {
    padding: 3,
    marginTop: -1,
    marginRight: -2,
    opacity: 0.75,
  },
  notifDesc: {
    color: "#94A3B8",
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 7,
  },
  projectBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  projectBadgeText: {
    color: "#8E95A5",
    fontSize: 10.5,
    fontWeight: "600",
    maxWidth: 160,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.26)",
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  actionBtnText: {
    color: "#00F2FE",
    fontSize: 10.5,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#131722",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 12.5,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 18,
  },
});
