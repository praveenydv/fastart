import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CutoutConfig } from '../../types/project';
import { soundEngine } from '../../utils/audioEngine';
import { styles } from './Cutout/CutoutModalStyles';
import { ChromaControls } from './Cutout/ChromaControls';
import { AutoCutoutControls } from './Cutout/AutoCutoutControls';
import { CutoutStrokeControls } from './Cutout/CutoutStrokeControls';
import { CutoutBgColorControls } from './Cutout/CutoutBgColorControls';

interface CutoutModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentCutout?: CutoutConfig;
  onApplyCutout: (config: CutoutConfig) => void;
  initialMode?: 'auto' | 'chroma';
  isInline?: boolean;
}

const COLOR_PRESETS = [
  { label: 'Green Screen', color: '#00FF00' },
  { label: 'Neon Lime', color: '#10B981' },
  { label: 'Chroma Blue', color: '#0000FF' },
  { label: 'Sky Cyan', color: '#00F2FE' },
  { label: 'Studio Black', color: '#000000' },
  { label: 'Clean White', color: '#FFFFFF' },
  { label: 'Magenta Screen', color: '#FF00FF' },
  { label: 'Studio Crimson', color: '#FF0050' },
  { label: 'Warm Amber', color: '#F59E0B' },
  { label: 'Slate Grey', color: '#64748B' },
];

const STROKE_PRESETS = [
  { label: 'None', color: 'none' },
  { label: 'White', color: '#FFFFFF' },
  { label: 'Neon Cyan', color: '#00F2FE' },
  { label: 'Amber Gold', color: '#FFE600' },
  { label: 'Hot Pink', color: '#FF0050' },
  { label: 'Emerald', color: '#10B981' },
  { label: 'Purple Glow', color: '#A855F7' },
];

const BG_COLOR_PRESETS = [
  { label: 'Transparent', color: 'none' },
  { label: 'Studio Black', color: '#000000' },
  { label: 'Pure White', color: '#FFFFFF' },
  { label: 'Neon Cyan', color: '#00F2FE' },
  { label: 'Cyberpunk Purple', color: '#8B5CF6' },
  { label: 'Sunset Red', color: '#FF0050' },
  { label: 'Amber Gold', color: '#FFE600' },
  { label: 'Emerald Green', color: '#10B981' },
  { label: 'Royal Blue', color: '#2563EB' },
  { label: 'Deep Slate', color: '#1E293B' },
];

export default function CutoutModal({
  visible,
  onClose,
  onApply,
  currentCutout,
  onApplyCutout,
  initialMode,
  isInline = false,
}: CutoutModalProps) {
  const [enabled, setEnabled] = useState<boolean>(currentCutout?.enabled || false);
  const [mode, setMode] = useState<'chroma' | 'auto'>(initialMode || currentCutout?.mode || 'chroma');
  const [keyColor, setKeyColor] = useState<string>(currentCutout?.keyColor || '#00FF00');
  const [intensity, setIntensity] = useState<number>(currentCutout?.intensity ?? 45);
  const [shadow, setShadow] = useState<number>(currentCutout?.shadow ?? 25);
  const [strokeColor, setStrokeColor] = useState<string>(currentCutout?.strokeColor || 'none');
  const [strokeWidth, setStrokeWidth] = useState<number>(currentCutout?.strokeWidth || 3);
  const [bgColor, setBgColor] = useState<string>(currentCutout?.bgColor || 'none');

  useEffect(() => {
    if (visible) {
      const targetMode = initialMode || currentCutout?.mode || 'chroma';
      const shouldEnable = targetMode === 'auto' ? true : (currentCutout?.enabled || false);
      setEnabled(shouldEnable);
      setMode(targetMode);
      setKeyColor(currentCutout?.keyColor || '#00FF00');
      setIntensity(currentCutout?.intensity ?? 45);
      setShadow(currentCutout?.shadow ?? 25);
      setStrokeColor(currentCutout?.strokeColor || 'none');
      setStrokeWidth(currentCutout?.strokeWidth || 3);
      setBgColor(currentCutout?.bgColor || 'none');

      if (targetMode === 'auto' && !currentCutout?.enabled) {
        onApplyCutout({
          enabled: true,
          mode: 'auto',
          keyColor: currentCutout?.keyColor || '#00FF00',
          intensity: currentCutout?.intensity ?? 45,
          shadow: currentCutout?.shadow ?? 25,
          strokeColor: currentCutout?.strokeColor,
          strokeWidth: currentCutout?.strokeWidth,
          bgColor: currentCutout?.bgColor,
        });
      }
    }
  }, [visible, currentCutout, initialMode, onApplyCutout]);

  const syncConfig = useCallback(
    (overrides?: Partial<CutoutConfig>) => {
      const nextEnabled = overrides?.enabled !== undefined ? overrides.enabled : enabled;
      const nextMode = overrides?.mode !== undefined ? overrides.mode : mode;
      const nextKeyColor = overrides?.keyColor !== undefined ? overrides.keyColor : keyColor;
      const nextIntensity = overrides?.intensity !== undefined ? overrides.intensity : intensity;
      const nextShadow = overrides?.shadow !== undefined ? overrides.shadow : shadow;
      const nextStrokeColor = overrides?.strokeColor !== undefined ? overrides.strokeColor : strokeColor;
      const nextStrokeWidth = overrides?.strokeWidth !== undefined ? overrides.strokeWidth : strokeWidth;
      const nextBgColor = overrides?.bgColor !== undefined ? overrides.bgColor : bgColor;

      onApplyCutout({
        enabled: nextEnabled,
        mode: nextMode,
        keyColor: nextKeyColor,
        intensity: nextIntensity,
        shadow: nextShadow,
        strokeColor: nextStrokeColor === 'none' ? undefined : nextStrokeColor,
        strokeWidth: nextStrokeColor === 'none' ? 0 : nextStrokeWidth,
        bgColor: nextBgColor === 'none' ? undefined : nextBgColor,
      });
    },
    [enabled, mode, keyColor, intensity, shadow, strokeColor, strokeWidth, bgColor, onApplyCutout],
  );

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    syncConfig({ enabled: true });
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const handleReset = () => {
    soundEngine.playSfx('click');
    setEnabled(false);
    setMode('chroma');
    setKeyColor('#00FF00');
    setIntensity(45);
    setShadow(25);
    setStrokeColor('none');
    setStrokeWidth(3);
    setBgColor('none');
    onApplyCutout({
      enabled: false,
      mode: 'chroma',
      keyColor: '#00FF00',
      intensity: 45,
      shadow: 25,
      strokeWidth: 0,
      bgColor: undefined,
    });
  };

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    onClose();
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, isInline && ({ flex: 1, maxHeight: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderWidth: 0 } as any)]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Standardized Header */}
      <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={handleCancel}
                style={[styles.doneBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                activeOpacity={0.7}
                accessibilityLabel="Cancel changes"
              >
                <Ionicons name="close" size={17} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleReset}
                style={styles.resetBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.titleRow}>
              <Ionicons name="person-remove-outline" size={17} color="#FFFFFF" />
              <Text style={styles.sheetTitle}>Cutout & Chroma</Text>
            </View>

            <TouchableOpacity
              onPress={handleApply}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Apply cutout"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Mode Selector */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabItem, mode === 'chroma' && styles.tabItemActive]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  setMode('chroma');
                  syncConfig({ mode: 'chroma', enabled: true });
                  setEnabled(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="color-filter-outline"
                  size={16}
                  color={mode === 'chroma' ? '#000000' : '#8E95A5'}
                />
                <Text style={[styles.tabLabel, mode === 'chroma' && styles.tabLabelActive]}>
                  Chroma Key
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, mode === 'auto' && styles.tabItemActive]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  setMode('auto');
                  syncConfig({ mode: 'auto', enabled: true });
                  setEnabled(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="sparkles"
                  size={16}
                  color={mode === 'auto' ? '#000000' : '#8E95A5'}
                />
                <Text style={[styles.tabLabel, mode === 'auto' && styles.tabLabelActive]}>
                  Auto Cutout
                </Text>
              </TouchableOpacity>
            </View>

            {/* Add Background Color (Replace BG) Controls */}
            <CutoutBgColorControls
              bgColor={bgColor}
              setBgColor={(col) => {
                setBgColor(col);
                setEnabled(true);
                syncConfig({ bgColor: col, enabled: true });
              }}
              bgPresets={BG_COLOR_PRESETS}
            />

            {/* Chroma Key Controls */}
            {mode === 'chroma' && (
              <ChromaControls
                keyColor={keyColor}
                setKeyColor={(col) => {
                  setKeyColor(col);
                  setEnabled(true);
                  syncConfig({ keyColor: col, enabled: true });
                }}
                intensity={intensity}
                setIntensity={(val) => {
                  setIntensity(val);
                  syncConfig({ intensity: val });
                }}
                shadow={shadow}
                setShadow={(val) => {
                  setShadow(val);
                  syncConfig({ shadow: val });
                }}
                colorPresets={COLOR_PRESETS}
                onEnable={() => {
                  setEnabled(true);
                  syncConfig({ enabled: true });
                }}
              />
            )}

            {/* Smart Auto Cutout Controls */}
            {mode === 'auto' && (
              <AutoCutoutControls
                intensity={intensity}
                setIntensity={(val) => {
                  setIntensity(val);
                  syncConfig({ intensity: val });
                }}
                shadow={shadow}
                setShadow={(val) => {
                  setShadow(val);
                  syncConfig({ shadow: val });
                }}
              />
            )}

            {/* Cutout Stroke / Glowing Edge */}
            <CutoutStrokeControls
              strokeColor={strokeColor}
              setStrokeColor={(col) => {
                setStrokeColor(col);
                syncConfig({ strokeColor: col });
              }}
              strokeWidth={strokeWidth}
              setStrokeWidth={(w) => {
                setStrokeWidth(w);
                syncConfig({ strokeWidth: w });
              }}
              strokePresets={STROKE_PRESETS}
            />
          </ScrollView>
        </View>
  );

  if (isInline) {
    if (!visible) return null;
    return (
      <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: '#121215' }}>
        {sheetContent}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        {sheetContent}
      </View>
    </Modal>
  );
}
