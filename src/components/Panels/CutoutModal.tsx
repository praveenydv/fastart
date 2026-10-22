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
  currentCutout?: CutoutConfig;
  onApplyCutout: (config: CutoutConfig) => void;
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
  currentCutout,
  onApplyCutout,
}: CutoutModalProps) {
  const [enabled, setEnabled] = useState<boolean>(currentCutout?.enabled || false);
  const [mode, setMode] = useState<'chroma' | 'auto'>(currentCutout?.mode || 'chroma');
  const [keyColor, setKeyColor] = useState<string>(currentCutout?.keyColor || '#00FF00');
  const [intensity, setIntensity] = useState<number>(currentCutout?.intensity ?? 45);
  const [shadow, setShadow] = useState<number>(currentCutout?.shadow ?? 25);
  const [strokeColor, setStrokeColor] = useState<string>(currentCutout?.strokeColor || 'none');
  const [strokeWidth, setStrokeWidth] = useState<number>(currentCutout?.strokeWidth || 3);
  const [bgColor, setBgColor] = useState<string>(currentCutout?.bgColor || 'none');

  useEffect(() => {
    if (visible) {
      setEnabled(currentCutout?.enabled || false);
      setMode(currentCutout?.mode || 'chroma');
      setKeyColor(currentCutout?.keyColor || '#00FF00');
      setIntensity(currentCutout?.intensity ?? 45);
      setShadow(currentCutout?.shadow ?? 25);
      setStrokeColor(currentCutout?.strokeColor || 'none');
      setStrokeWidth(currentCutout?.strokeWidth || 3);
      setBgColor(currentCutout?.bgColor || 'none');
    }
  }, [visible, currentCutout]);

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
    syncConfig();
    onClose();
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              <Ionicons name="person-remove-outline" size={20} color="#00F2FE" />
              <Text style={styles.sheetTitle}>{"Cutout & Chroma"}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Enable Toggle Banner */}
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Enable Cutout</Text>
                <Text style={styles.toggleSub}>Real-time background keying & extraction</Text>
              </View>
              <TouchableOpacity
                style={[styles.switchTrack, enabled && styles.switchTrackActive]}
                onPress={() => {
                  soundEngine.playSfx('pop');
                  const nextVal = !enabled;
                  setEnabled(nextVal);
                  syncConfig({ enabled: nextVal });
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.switchThumb, enabled && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

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

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={18} color="#8E95A5" />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={18} color="#000000" />
              <Text style={styles.applyBtnText}>Apply Cutout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
