import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlendMode } from '../../types/project';
import { CompactSliderInput } from '../Common/CompactSliderInput';
import { ModalHeader } from '../Common';

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

function BlendModeModalComponent({
  visible,
  onClose,
  onApply,
  currentMode = 'normal',
  currentOpacity = 1.0,
  isInline = false,
}: BlendModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<BlendMode>(currentMode);
  const [opacity, setOpacity] = useState<number>(currentOpacity);
  const [isSliderDragging, setIsSliderDragging] = useState<boolean>(false);

  useEffect(() => {
    setSelectedMode(currentMode);
    setOpacity(currentOpacity);
  }, [currentMode, currentOpacity]);

  if (!visible) return null;

  const handleSelect = (mode: BlendMode) => {
    setSelectedMode(mode);
    onApply(mode, opacity);
  };

  const handleDone = () => {
    onApply(selectedMode, opacity);
    onClose();
  };

  const handleReset = () => {
    setSelectedMode('normal');
    setOpacity(1.0);
    onApply('normal', 1.0);
  };

  return (
    <View style={[styles.inlineWrapper, isInline && styles.inlineWrapperDocked]}>
      <View style={styles.sheetContainer}>
        {/* Standardized Header - only shown in standalone modal */}
        {!isInline && (
          <ModalHeader
            title="Blend Mode"
            iconName="layers"
            onClose={onClose}
            onReset={handleReset}
            resetText="Reset"
            onDone={handleDone}
          />
        )}

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isSliderDragging}
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
              showSteppers={true}
              accentColor="#00F2FE"
              onDragStart={() => setIsSliderDragging(true)}
              onDragEnd={() => setIsSliderDragging(false)}
              onChange={(val) => {
                const nextOp = Math.max(0, Math.min(100, val)) / 100;
                setOpacity(nextOp);
                onApply(selectedMode, nextOp);
              }}
              onReset={() => {
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

export const BlendModeModal = React.memo(BlendModeModalComponent);
export default BlendModeModal;

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
    height: 34,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: '#12141F',
  },
  cancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtnText: {
    fontSize: 9.5,
    color: '#A1A1AA',
    fontWeight: '400',
  },
  applyBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 6,
    paddingBottom: 16,
  },
  opacityCard: {
    backgroundColor: '#171926',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  opacityRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#A1A1AA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  opacityValueBadge: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#00F2FE',
  },
  opacityPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  opacityPill: {
    flex: 1,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opacityPillActive: {
    backgroundColor: '#00F2FE',
  },
  opacityPillText: {
    fontSize: 9,
    fontWeight: '400',
    color: '#D4D4D8',
  },
  opacityPillTextActive: {
    color: '#0B0D13',
    fontWeight: '500',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  presetCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171926',
    borderRadius: 6,
    padding: 5,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 5,
  },
  presetCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  cardIconBox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 9.5,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  cardNameActive: {
    color: '#00F2FE',
    fontWeight: '500',
  },
  cardDesc: {
    fontSize: 7.5,
    color: '#71717A',
    marginTop: 1,
  },
  selectedBadge: {
    marginLeft: 'auto',
  },
});
