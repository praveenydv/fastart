import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './CutoutModalStyles';
import { soundEngine } from '../../../utils/audioEngine';
import { CompactSliderInput } from '../../Common/CompactSliderInput';

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
        <View style={{ marginTop: 12 }}>
          <CompactSliderInput
            label="Outline Stroke Width"
            value={strokeWidth}
            min={1}
            max={10}
            step={1}
            unit="px"
            defaultValue={3}
            accentColor="#00F2FE"
            showSteppers={true}
            onChange={(val) => setStrokeWidth(val)}
          />
        </View>
      )}
    </View>
  );
};
