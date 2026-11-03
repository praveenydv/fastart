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
            color={isSelected ? "#00F2FE" : "#94A3B8"}
          />
        ) : (
          <Ionicons
            name="cube-outline"
            size={24}
            color={isSelected ? "#00F2FE" : "#94A3B8"}
          />
        )}

        {isSelected && (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark" size={10} color="#08090E" />
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
    backgroundColor: "#131826",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#1F2637",
    padding: 6,
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  cardActive: {
    borderColor: "#00F2FE",
    backgroundColor: "#162032",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
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
    borderRadius: 8,
  },
  selectedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  topBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(0, 242, 254, 0.2)",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  topBadgeText: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "700",
  },
  label: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
    width: "100%",
  },
  labelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

