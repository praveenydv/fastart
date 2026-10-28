import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './CutoutModalStyles';

interface AutoCutoutControlsProps {
  intensity?: number;
  setIntensity?: (val: number) => void;
  shadow?: number;
  setShadow?: (val: number) => void;
}

export const AutoCutoutControls: React.FC<AutoCutoutControlsProps> = () => {
  return (
    <View style={styles.sectionBox}>
      <View style={styles.autoCutoutBadge}>
        <Ionicons name="sparkles" size={16} color="#00F2FE" />
        <Text style={styles.autoCutoutBadgeText}>
          Neural AI Background Removal
        </Text>
      </View>
      <Text style={styles.helperText}>
        Fully automated AI portrait isolation. Isolates human persons, face, hair, and body frame-by-frame from video or photo backgrounds without requiring green screen.
      </Text>
    </View>
  );
};
