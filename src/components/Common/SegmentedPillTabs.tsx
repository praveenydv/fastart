import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TactileTouchable } from "./TactileTouchable";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: string | number;
}

export interface SegmentedPillTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onSelectTab?: (id: T) => void;
  onTabChange?: (id: T) => void;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SegmentedPillTabs<T extends string = string>({
  tabs,
  activeTab,
  onSelectTab,
  onTabChange,
  scrollable = false,
  style,
  containerStyle,
}: SegmentedPillTabsProps<T>) {
  const handleSelect = (id: T) => {
    if (onTabChange) {
      onTabChange(id);
    } else if (onSelectTab) {
      onSelectTab(id);
    }
  };

  const content = tabs.map((tab) => {
    const isActive = tab.id === activeTab;
    return (
      <TactileTouchable
        key={tab.id}
        onPress={() => handleSelect(tab.id)}
        style={[
          styles.pill,
          scrollable && styles.scrollablePill,
          isActive && styles.activePill,
          style,
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
      >
        {tab.icon && (
          <Ionicons
            name={tab.icon}
            size={13}
            color={isActive ? "#FFFFFF" : "#71717A"}
            style={styles.pillIcon}
          />
        )}
        <Text style={[styles.pillText, isActive && styles.activePillText]}>
          {tab.label}
        </Text>
        {tab.badge !== undefined && (
          <View style={[styles.badge, isActive && styles.activeBadge]}>
            <Text
              style={[styles.badgeText, isActive && styles.activeBadgeText]}
            >
              {tab.badge}
            </Text>
          </View>
        )}
      </TactileTouchable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContainer, containerStyle]}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={[styles.fixedContainer, containerStyle]}>{content}</View>;
}

const styles = StyleSheet.create({
  fixedContainer: {
    flexDirection: "row",
    backgroundColor: "#141416",
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: "#1F1F23",
    marginHorizontal: 8,
    marginVertical: 4,
    height: 28,
  },
  scrollContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  scrollablePill: {
    flex: undefined,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingVertical: 3.5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  activePill: {
    backgroundColor: "#27272A",
    borderWidth: 1,
    borderColor: "#3F3F46",
  },
  pillIcon: {
    marginRight: 4,
  },
  pillText: {
    color: "#71717A",
    fontSize: 10.5,
    fontWeight: "500",
  },
  activePillText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  badge: {
    marginLeft: 4,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRadius: 4,
    backgroundColor: "#27272A",
  },
  activeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  badgeText: {
    color: "#71717A",
    fontSize: 9,
    fontWeight: "500",
  },
  activeBadgeText: {
    color: "#FFFFFF",
  },
});
