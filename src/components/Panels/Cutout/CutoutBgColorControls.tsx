import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './CutoutModalStyles';
import { soundEngine } from '../../../utils/audioEngine';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

interface CutoutBgColorControlsProps {
  bgColor: string;
  setBgColor: (color: string) => void;
  bgPresets: { label: string; color: string }[];
}

export const CutoutBgColorControls: React.FC<CutoutBgColorControlsProps> = ({
  bgColor,
  setBgColor,
  bgPresets,
}) => {
  const isCustom = !bgPresets.some((p) => p.color.toUpperCase() === bgColor.toUpperCase());

  return (
    <View style={styles.sectionBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={styles.sectionHeader}>{"ADD BACKGROUND COLOR (REPLACE BG)"}</Text>
        {bgColor !== 'none' && (
          <TouchableOpacity
            onPress={() => {
              soundEngine.playSfx('click');
              setBgColor('none');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 11, color: '#00F2FE', fontWeight: '600' }}>Clear Color</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.helperText}>
        Replace the removed video background with a solid backdrop color or keep transparent.
      </Text>

      <View style={styles.bgGrid}>
        {bgPresets.map((preset) => {
          const isSelected = bgColor.toUpperCase() === preset.color.toUpperCase();
          return (
            <TouchableOpacity
              key={preset.color}
              style={[styles.bgChip, isSelected && styles.bgChipSelected]}
              onPress={() => {
                soundEngine.playSfx('click');
                setBgColor(preset.color);
              }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.bgDot,
                  {
                    backgroundColor: preset.color === 'none' ? 'transparent' : preset.color,
                    borderWidth: preset.color === 'none' || preset.color === '#000000' ? 1 : 0,
                    borderColor: preset.color === 'none' ? '#00F2FE' : '#333333',
                  },
                ]}
              >
                {preset.color === 'none' && (
                  <Ionicons name="close" size={10} color="#00F2FE" style={{ alignSelf: 'center' }} />
                )}
              </View>
              <Text style={[styles.bgText, isSelected && styles.bgTextActive]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom Background Color Picker */}
      <View style={styles.customColorRow}>
        <Text style={styles.sliderLabel}>Custom Background Color:</Text>
        <View style={styles.colorInputBox}>
          <View
            style={[
              styles.sampleSquare,
              { backgroundColor: bgColor === 'none' ? '#141721' : bgColor },
            ]}
          />
          {Platform.OS === 'web' ? (
            <WebInput
              type="color"
              value={bgColor === 'none' ? '#000000' : bgColor}
              onChange={(e: any) => {
                setBgColor(e.target.value);
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
          <Text style={styles.hexCodeText}>
            {bgColor === 'none' ? 'TRANSPARENT' : bgColor.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
};
