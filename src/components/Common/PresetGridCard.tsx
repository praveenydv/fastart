import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TactileTouchable } from "./TactileTouchable";

export interface PresetGridCardProps {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  imageUri?: string;
  isSelected: boolean;
  onPress: () => void;
  badge?: string;
  style?: StyleProp<ViewStyle>;
  aspectRatio?: number;
}

export function PresetGridCard({
  label,
  icon,
  imageUri,
  isSelected,
  onPress,
  badge,
  style,
  aspectRatio = 1,
}: PresetGridCardProps) {
  return (
    <TactileTouchable
      onPress={onPress}
      style={[
        styles.card,
        { aspectRatio },
        isSelected && styles.cardActive,
        style,
      ]}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.thumbnailContainer}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : icon ? (
          <Ionicons
            name={icon}
            size={24}
            color={isSelected ? "#FFFFFF" : "#71717A"}
          />
        ) : (
          <Ionicons
            name="cube-outline"
            size={24}
            color={isSelected ? "#FFFFFF" : "#71717A"}
          />
        )}

        {isSelected && (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark" size={10} color="#121214" />
          </View>
        )}

        {badge && (
          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText}>{badge}</Text>
          </View>
        )}
      </View>

      <Text
        style={[styles.label, isSelected && styles.labelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TactileTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#18181A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 6,
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  cardActive: {
    borderColor: "#FFFFFF",
    backgroundColor: "#222226",
  },
  thumbnailContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
  },
  selectedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  topBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  topBadgeText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "600",
  },
  label: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "400",
    textAlign: "center",
    marginTop: 4,
    width: "100%",
  },
  labelActive: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
});

