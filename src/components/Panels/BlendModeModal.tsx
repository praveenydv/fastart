import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { BlendMode } from '../../types/project';
import { CompactSliderInput } from '../Common/CompactSliderInput';

export interface BlendModeModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (mode: BlendMode, opacity?: number) => void;
  currentMode?: BlendMode;
  currentOpacity?: number;
  isInline?: boolean;
}

interface BlendPreset {
  id: BlendMode;
  name: string;
  desc: string;
  icon: string;
  previewGradient: [string, string];
}

const BLEND_PRESETS: BlendPreset[] = [
  {
    id: 'normal',
    name: 'Normal',
    desc: 'Default composite',
    icon: 'layers-outline',
    previewGradient: ['#3F3F46', '#27272A'],
  },
  {
    id: 'screen',
    name: 'Screen',
    desc: 'Light leaks & fire',
    icon: 'weather-sunny',
    previewGradient: ['#F59E0B', '#EF4444'],
  },
  {
    id: 'multiply',
    name: 'Multiply',
    desc: 'Shadows & textures',
    icon: 'texture-box',
    previewGradient: ['#3B82F6', '#1E3A8A'],
  },
  {
    id: 'overlay',
    name: 'Overlay',
    desc: 'High contrast mix',
    icon: 'contrast-circle',
    previewGradient: ['#8B5CF6', '#EC4899'],
  },
  {
    id: 'darken',
    name: 'Darken',
    desc: 'Keep dark values',
    icon: 'weather-night',
    previewGradient: ['#1E293B', '#0F172A'],
  },
  {
    id: 'lighten',
    name: 'Lighten',
    desc: 'Keep bright values',
    icon: 'white-balance-sunny',
    previewGradient: ['#FDE047', '#F97316'],
  },
  {
    id: 'color-dodge',
    name: 'Color Dodge',
    desc: 'Glowing neon bursts',
    icon: 'flare',
    previewGradient: ['#00F2FE', '#4FACFE'],
  },
  {
    id: 'color-burn',
    name: 'Color Burn',
    desc: 'Dramatic burn depth',
    icon: 'fire',
    previewGradient: ['#DC2626', '#7F1D1D'],
  },
  {
    id: 'soft-light',
    name: 'Soft Light',
    desc: 'Gentle diffusion',
    icon: 'blur',
    previewGradient: ['#A7F3D0', '#34D399'],
  },
  {
    id: 'difference',
    name: 'Difference',
    desc: 'Inverted color clash',
    icon: 'invert-colors',
    previewGradient: ['#F43F5E', '#8B5CF6'],
  },
  {
    id: 'exclusion',
    name: 'Exclusion',
    desc: 'Muted solarization',
    icon: 'circle-slice-8',
    previewGradient: ['#64748B', '#334155'],
  },
];

export default function BlendModeModal({
  visible,
  onClose,
  onApply,
  currentMode = 'normal',
  currentOpacity = 1.0,
  isInline = false,
}: BlendModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<BlendMode>(currentMode);
  const [opacity, setOpacity] = useState<number>(currentOpacity);

  useEffect(() => {
    setSelectedMode(currentMode);
    setOpacity(currentOpacity);
  }, [currentMode, currentOpacity]);

  if (!visible) return null;

  const handleSelect = (mode: BlendMode) => {
    soundEngine.playSfx('click');
    setSelectedMode(mode);
    onApply(mode, opacity);
  };

  const handleDone = () => {
    soundEngine.playSfx('pop');
    onApply(selectedMode, opacity);
    onClose();
  };

  const handleReset = () => {
    soundEngine.playSfx('click');
    setSelectedMode('normal');
    setOpacity(1.0);
    onApply('normal', 1.0);
  };

  return (
    <View style={[styles.inlineWrapper, isInline && styles.inlineWrapperDocked]}>
      <View style={styles.sheetContainer}>
        {/* Standardized Header - only shown in standalone modal */}
        {!isInline && (
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#EF4444" />
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBadge}>
                <MaterialCommunityIcons name="layers" size={16} color="#00F2FE" />
              </View>
              <Text style={styles.headerTitle}>Blend Mode</Text>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.applyBtn} onPress={handleDone}>
                <Ionicons name="checkmark" size={18} color="#0B0D13" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Layer Opacity Slider & Quick Presets */}
          <View style={styles.opacityCard}>
            <CompactSliderInput
              label="Layer Opacity"
              value={Math.round(opacity * 100)}
              min={0}
              max={100}
              step={1}
              unit="%"
              defaultValue={100}
              showReset={true}
              accentColor="#00F2FE"
              onChange={(val) => {
                const nextOp = Math.max(0, Math.min(100, val)) / 100;
                setOpacity(nextOp);
                onApply(selectedMode, nextOp);
              }}
              onReset={() => {
                soundEngine.playSfx('click');
                setOpacity(1.0);
                onApply(selectedMode, 1.0);
              }}
            />
            <View style={[styles.opacityPillsRow, { marginTop: 8 }]}>
              {[0, 0.25, 0.5, 0.75, 1.0].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.opacityPill,
                    Math.abs(opacity - val) < 0.03 && styles.opacityPillActive,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    setOpacity(val);
                    onApply(selectedMode, val);
                  }}
                >
                  <Text
                    style={[
                      styles.opacityPillText,
                      Math.abs(opacity - val) < 0.03 && styles.opacityPillTextActive,
                    ]}
                  >
                    {Math.round(val * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Blend Mode Grid */}
          <Text style={styles.sectionTitle}>Compositing Presets</Text>
          <View style={styles.presetGrid}>
            {BLEND_PRESETS.map((preset) => {
              const isSelected = selectedMode === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.presetCard, isSelected && styles.presetCardActive]}
                  onPress={() => handleSelect(preset.id)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: preset.previewGradient[0] + '33' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={preset.icon as any}
                      size={20}
                      color={isSelected ? '#00F2FE' : '#F4F4F5'}
                    />
                  </View>

                  <View style={styles.cardInfo}>
                    <Text
                      style={[
                        styles.cardName,
                        isSelected && styles.cardNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {preset.name}
                    </Text>
                    <Text style={styles.cardDesc} numberOfLines={1}>
                      {preset.desc}
                    </Text>
                  </View>

                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#00F2FE" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D0E15',
  },
  inlineWrapperDocked: {
    height: '100%',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#0D0E15',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#12141F',
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtnText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  applyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  opacityCard: {
    backgroundColor: '#171926',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  opacityRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A1A1AA',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  opacityValueBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00F2FE',
  },
  opacityPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  opacityPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opacityPillActive: {
    backgroundColor: '#00F2FE',
  },
  opacityPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D4D4D8',
  },
  opacityPillTextActive: {
    color: '#0B0D13',
    fontWeight: '700',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  presetCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171926',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 10,
  },
  presetCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardNameActive: {
    color: '#00F2FE',
  },
  cardDesc: {
    fontSize: 10.5,
    color: '#71717A',
    marginTop: 2,
  },
  selectedBadge: {
    marginLeft: 'auto',
  },
});
