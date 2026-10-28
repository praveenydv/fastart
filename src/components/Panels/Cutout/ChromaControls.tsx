import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './CutoutModalStyles';
import { soundEngine } from '../../../utils/audioEngine';
import { CompactSliderInput } from '../../Common/CompactSliderInput';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

interface ChromaControlsProps {
  keyColor: string;
  setKeyColor: (color: string) => void;
  intensity: number;
  setIntensity: (val: number) => void;
  shadow: number;
  setShadow: (val: number) => void;
  colorPresets?: { label: string; color: string }[];
  onEnable: () => void;
}

function isLightColor(hex: string): boolean {
  if (!hex || hex === 'none' || hex === 'transparent') return false;
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

export const ChromaControls: React.FC<ChromaControlsProps> = ({
  keyColor,
  setKeyColor,
  intensity,
  setIntensity,
  shadow,
  setShadow,
  onEnable,
}) => {
  const colorInputRef = React.useRef<any>(null);

  const handleOpenEyeDropper = async () => {
    soundEngine.playSfx('click');
    if (typeof window !== 'undefined' && (window as any).EyeDropper) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          setKeyColor(result.sRGBHex);
          onEnable();
        }
      } catch {
        // User cancelled eyedropper
      }
    } else if (Platform.OS === 'web' && colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  return (
    <View style={styles.sectionBox}>
      <View style={styles.dropperHeaderRow}>
        <Text style={styles.sectionHeader}>CHROMA KEY COLOR</Text>
        <TouchableOpacity
          style={styles.dropperIconBtn}
          onPress={handleOpenEyeDropper}
          activeOpacity={0.8}
          accessibilityLabel="Pick color with dropper"
        >
          <Ionicons name="eyedrop" size={17} color="#00F2FE" />
        </TouchableOpacity>
      </View>

      <View style={styles.dropperCard}>
        <TouchableOpacity
          style={styles.dropperCardTouch}
          onPress={handleOpenEyeDropper}
          activeOpacity={0.85}
        >
          <View style={[styles.dropperSwatchLarge, { backgroundColor: keyColor }]} />
          <View style={styles.dropperInfo}>
            <Text style={styles.dropperCardTitle}>Key Color</Text>
            <Text style={styles.dropperCardHex}>{keyColor.toUpperCase()}</Text>
          </View>
          <View style={styles.dropperIconPill}>
            <Ionicons name="eyedrop" size={18} color="#00F2FE" />
          </View>
        </TouchableOpacity>

        {Platform.OS === 'web' && (
          <WebInput
            ref={colorInputRef}
            type="color"
            value={keyColor}
            onChange={(e: any) => {
              setKeyColor(e.target.value);
              onEnable();
            }}
            style={{
              position: 'absolute',
              opacity: 0,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        )}
      </View>
      <Text style={styles.dropperHint}>
        Tap the eyedropper to sample any green screen or background color directly from the video.
      </Text>

      {/* Intensity Slider */}
      <View style={styles.sliderGroup}>
        <CompactSliderInput
          label="Intensity / Similarity Tolerance"
          value={intensity}
          min={1}
          max={100}
          step={1}
          unit="%"
          defaultValue={40}
          accentColor="#00F2FE"
          onChange={setIntensity}
        />
      </View>

      {/* Shadow / Smoothness Slider */}
      <View style={styles.sliderGroup}>
        <CompactSliderInput
          label="Shadow / Edge Softness"
          value={shadow}
          min={0}
          max={100}
          step={1}
          unit="%"
          defaultValue={20}
          accentColor="#00F2FE"
          onChange={setShadow}
        />
      </View>
    </View>
  );
};
