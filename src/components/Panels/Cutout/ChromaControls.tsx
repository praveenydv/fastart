import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './CutoutModalStyles';
import { soundEngine } from '../../../utils/audioEngine';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

interface ChromaControlsProps {
  keyColor: string;
  setKeyColor: (color: string) => void;
  intensity: number;
  setIntensity: (val: number) => void;
  shadow: number;
  setShadow: (val: number) => void;
  colorPresets: { label: string; color: string }[];
  onEnable: () => void;
}

export const ChromaControls: React.FC<ChromaControlsProps> = ({
  keyColor,
  setKeyColor,
  intensity,
  setIntensity,
  shadow,
  setShadow,
  colorPresets,
  onEnable,
}) => {
  return (
    <View style={styles.sectionBox}>
      <Text style={styles.sectionHeader}>KEY COLOR</Text>
      <View style={styles.presetsGrid}>
        {colorPresets.map((preset) => {
          const isSelected = keyColor.toUpperCase() === preset.color.toUpperCase();
          return (
            <TouchableOpacity
              key={preset.color}
              style={[styles.colorChip, isSelected && styles.colorChipSelected]}
              onPress={() => {
                soundEngine.playSfx('click');
                setKeyColor(preset.color);
                onEnable();
              }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: preset.color },
                  preset.color === '#000000' && { borderWidth: 1, borderColor: '#333' },
                ]}
              />
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom Color Eyedropper / Hex */}
      <View style={styles.customColorRow}>
        <Text style={styles.sliderLabel}>Selected Color Code:</Text>
        <View style={styles.colorInputBox}>
          <View style={[styles.sampleSquare, { backgroundColor: keyColor }]} />
          {Platform.OS === 'web' ? (
            <WebInput
              type="color"
              value={keyColor}
              onChange={(e: any) => {
                setKeyColor(e.target.value);
                onEnable();
              }}
              style={{
                width: 44,
                height: 28,
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            />
          ) : null}
          <Text style={styles.hexCodeText}>{keyColor.toUpperCase()}</Text>
        </View>
      </View>

      {/* Intensity Slider */}
      <View style={styles.sliderGroup}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>Intensity / Similarity Tolerance</Text>
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

      {/* Shadow / Smoothness Slider */}
      <View style={styles.sliderGroup}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>Shadow / Edge Softness</Text>
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
