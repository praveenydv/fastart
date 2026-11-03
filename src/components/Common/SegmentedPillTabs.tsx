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
            color={isActive ? "#08090E" : "#94A3B8"}
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
    backgroundColor: "#131826",
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: "#1F2637",
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
    borderRadius: 6,
  },
  scrollablePill: {
    flex: undefined,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    paddingVertical: 3.5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  activePill: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  pillIcon: {
    marginRight: 4,
  },
  pillText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
  },
  activePillText: {
    color: "#08090E",
    fontWeight: "700",
  },
  badge: {
    marginLeft: 4,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRadius: 6,
    backgroundColor: "#1E293B",
  },
  activeBadge: {
    backgroundColor: "rgba(8, 9, 14, 0.2)",
  },
  badgeText: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "700",
  },
  activeBadgeText: {
    color: "#08090E",
  },
});
