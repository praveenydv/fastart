import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './CutoutModalStyles';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

interface AutoCutoutControlsProps {
  intensity: number;
  setIntensity: (val: number) => void;
  shadow: number;
  setShadow: (val: number) => void;
}

export const AutoCutoutControls: React.FC<AutoCutoutControlsProps> = ({
  intensity,
  setIntensity,
  shadow,
  setShadow,
}) => {
  return (
    <View style={styles.sectionBox}>
      <View style={styles.autoCutoutBadge}>
        <Ionicons name="person" size={17} color="#FFE600" />
        <Text style={styles.autoCutoutBadgeText}>
          AI Human Cutout & Portrait Isolation
        </Text>
      </View>
      <Text style={styles.helperText}>
        Neural human figure segmentation. Automatically isolates human persons, face, hair, and body from video or photo backgrounds without green screen.
      </Text>

      <View style={styles.sliderGroup}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>Cutout Sensitivity</Text>
          <Text style={styles.sliderVal}>{intensity}%</Text>
        </View>
        <View style={styles.sliderContainer}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setIntensity(Math.max(1, intensity - 5))}
          >
            <Ionicons name="remove" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <WebInput
              type="range"
              min="1"
              max="100"
              value={intensity}
              onChange={(e: any) => setIntensity(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#00F2FE' }}
            />
          ) : (
            <View style={styles.trackFallback}>
              <View style={[styles.fillFallback, { width: `${intensity}%` }]} />
            </View>
          )}
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setIntensity(Math.min(100, intensity + 5))}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sliderGroup}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>Edge Feathering</Text>
          <Text style={styles.sliderVal}>{shadow}%</Text>
        </View>
        <View style={styles.sliderContainer}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setShadow(Math.max(0, shadow - 5))}
          >
            <Ionicons name="remove" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <WebInput
              type="range"
              min="0"
              max="100"
              value={shadow}
              onChange={(e: any) => setShadow(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#00F2FE' }}
            />
          ) : (
            <View style={styles.trackFallback}>
              <View style={[styles.fillFallback, { width: `${shadow}%` }]} />
            </View>
          )}
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setShadow(Math.min(100, shadow + 5))}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
