import React, { useState, useEffect } from 'react';
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

interface CutoutModalProps {
  visible: boolean;
  onClose: () => void;
  currentCutout?: CutoutConfig;
  onApplyCutout: (config: CutoutConfig) => void;
}

const COLOR_PRESETS = [
  { label: 'Green Screen', color: '#00FF00' },
  { label: 'Blue Screen', color: '#0000FF' },
  { label: 'Studio Black', color: '#000000' },
  { label: 'High Key White', color: '#FFFFFF' },
  { label: 'Magenta Screen', color: '#FF00FF' },
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

  useEffect(() => {
    if (visible) {
      setEnabled(currentCutout?.enabled || false);
      setMode(currentCutout?.mode || 'chroma');
      setKeyColor(currentCutout?.keyColor || '#00FF00');
      setIntensity(currentCutout?.intensity ?? 45);
      setShadow(currentCutout?.shadow ?? 25);
      setStrokeColor(currentCutout?.strokeColor || 'none');
      setStrokeWidth(currentCutout?.strokeWidth || 3);
    }
  }, [visible, currentCutout]);

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    onApplyCutout({
      enabled,
      mode,
      keyColor,
      intensity,
      shadow,
      strokeColor: strokeColor === 'none' ? undefined : strokeColor,
      strokeWidth: strokeColor === 'none' ? 0 : strokeWidth,
    });
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
    onApplyCutout({
      enabled: false,
      mode: 'chroma',
      keyColor: '#00FF00',
      intensity: 45,
      shadow: 25,
      strokeWidth: 0,
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
              <Text style={styles.toggleTitle}>Enable Cutout</Text>
              <TouchableOpacity
                style={[styles.switchTrack, enabled && styles.switchTrackActive]}
                onPress={() => {
                  soundEngine.playSfx('pop');
                  setEnabled(!enabled);
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

            {/* Chroma Key Controls */}
            {mode === 'chroma' && (
              <ChromaControls
                keyColor={keyColor}
                setKeyColor={setKeyColor}
                intensity={intensity}
                setIntensity={setIntensity}
                shadow={shadow}
                setShadow={setShadow}
                colorPresets={COLOR_PRESETS}
                onEnable={() => setEnabled(true)}
              />
            )}

            {/* Smart Auto Cutout Controls */}
            {mode === 'auto' && (
              <AutoCutoutControls
                intensity={intensity}
                setIntensity={setIntensity}
                shadow={shadow}
                setShadow={setShadow}
              />
            )}

            {/* Cutout Stroke / Glowing Edge */}
            <CutoutStrokeControls
              strokeColor={strokeColor}
              setStrokeColor={setStrokeColor}
              strokeWidth={strokeWidth}
              setStrokeWidth={setStrokeWidth}
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
