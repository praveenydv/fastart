import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./PlayerStyles";
import { CROP_PRESETS } from "./playerUtils";

interface PlayerCropBarProps {
  cropPreset: string;
  isMobile: boolean;
  onApplyPreset: (presetId: string) => void;
  onReset: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const PlayerCropBarComponent: React.FC<PlayerCropBarProps> = ({
  cropPreset,
  isMobile,
  onApplyPreset,
  onReset,
  onCancel,
  onConfirm,
}) => {
  return (
    <View
      style={[
        styles.previewCropBarCard,
        isMobile && styles.previewCropBarCardCompact,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cropPresetScroll}
      >
        {CROP_PRESETS.map((preset) => {
          const isSelected = cropPreset === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              style={[
                styles.cropPresetChip,
                isSelected && styles.cropPresetChipActive,
              ]}
              onPress={() => onApplyPreset(preset.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.cropPresetText,
                  isSelected && styles.cropPresetTextActive,
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.cropActionsRow}>
        <TouchableOpacity
          style={styles.cropResetBtn}
          onPress={onReset}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={13} color="#94A3B8" />
          <Text style={styles.cropResetText}>Reset</Text>
        </TouchableOpacity>

        <View style={styles.cropActionsRight}>
          <TouchableOpacity
            style={styles.cropCancelBtn}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={14} color="#CBD5E1" />
            <Text style={styles.cropCancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cropApplyBtn}
            onPress={onConfirm}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={14} color="#000000" />
            <Text style={styles.cropApplyText}>Apply Crop</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const PlayerCropBar = React.memo(PlayerCropBarComponent);
export default PlayerCropBar;
