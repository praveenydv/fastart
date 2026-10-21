import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './CutoutModalStyles';
import { soundEngine } from '../../../utils/audioEngine';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

interface CutoutStrokeControlsProps {
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  strokePresets: { label: string; color: string }[];
}

export const CutoutStrokeControls: React.FC<CutoutStrokeControlsProps> = ({
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  strokePresets,
}) => {
  return (
    <View style={styles.sectionBox}>
      <Text style={styles.sectionHeader}>{"CUTOUT STROKE & GLOW"}</Text>
      <View style={styles.strokeGrid}>
        {strokePresets.map((sp) => {
          const isSelected = strokeColor === sp.color;
          return (
            <TouchableOpacity
              key={sp.color}
              style={[styles.strokeChip, isSelected && styles.strokeChipSelected]}
              onPress={() => {
                soundEngine.playSfx('click');
                setStrokeColor(sp.color);
              }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.strokeDot,
                  { backgroundColor: sp.color === 'none' ? '#222' : sp.color },
                ]}
              />
              <Text style={[styles.strokeText, isSelected && styles.strokeTextActive]}>
                {sp.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {strokeColor !== 'none' && (
        <View style={[styles.sliderGroup, { marginTop: 12 }]}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Outline Stroke Width</Text>
            <Text style={styles.sliderVal}>{strokeWidth}px</Text>
          </View>
          <View style={styles.sliderContainer}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
            >
              <Ionicons name="remove" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            {Platform.OS === 'web' ? (
              <WebInput
                type="range"
                min="1"
                max="10"
                value={strokeWidth}
                onChange={(e: any) => setStrokeWidth(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#00F2FE' }}
              />
            ) : (
              <View style={styles.trackFallback}>
                <View style={[styles.fillFallback, { width: `${strokeWidth * 10}%` }]} />
              </View>
            )}
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setStrokeWidth(Math.min(10, strokeWidth + 1))}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
