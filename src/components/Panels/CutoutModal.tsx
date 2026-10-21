import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CutoutConfig } from '../../types/project';
import { soundEngine } from '../../utils/audioEngine';

interface CutoutModalProps {
  visible: boolean;
  onClose: () => void;
  currentCutout?: CutoutConfig;
  onApplyCutout: (config: CutoutConfig) => void;
}

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

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

  const colorPresets = [
    { label: 'Green Screen', color: '#00FF00' },
    { label: 'Blue Screen', color: '#0000FF' },
    { label: 'Studio Black', color: '#000000' },
    { label: 'High Key White', color: '#FFFFFF' },
    { label: 'Magenta Screen', color: '#FF00FF' },
  ];

  const strokePresets = [
    { label: 'None', color: 'none' },
    { label: 'White', color: '#FFFFFF' },
    { label: 'Neon Cyan', color: '#00F2FE' },
    { label: 'Amber Gold', color: '#FFE600' },
    { label: 'Hot Pink', color: '#FF0050' },
    { label: 'Emerald', color: '#10B981' },
    { label: 'Purple Glow', color: '#A855F7' },
  ];

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
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              <Ionicons name="person-remove-outline" size={20} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Cutout & Chroma</Text>
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
                          setEnabled(true);
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
                          setEnabled(true);
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
            )}

            {/* Smart Auto Cutout Controls */}
            {mode === 'auto' && (
              <View style={styles.sectionBox}>
                <View style={styles.autoCutoutBadge}>
                  <Ionicons name="sparkles" size={18} color="#FFE600" />
                  <Text style={styles.autoCutoutBadgeText}>
                    Subject Segmentation & Luminance Thresholding
                  </Text>
                </View>
                <Text style={styles.helperText}>
                  Automatically isolates foreground subjects and cuts out static or high-contrast background without requiring a green screen.
                </Text>

                <View style={styles.sliderGroup}>
                  <View style={styles.sliderHeader}>
                    <Text style={styles.sliderLabel}>Cutout Sensitivity</Text>
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

                <View style={styles.sliderGroup}>
                  <View style={styles.sliderHeader}>
                    <Text style={styles.sliderLabel}>Edge Feathering</Text>
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
            )}

            {/* Cutout Stroke / Glowing Edge (CapCut Pro feature) */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>CUTOUT STROKE & GLOW (PRO)</Text>
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2637',
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2030',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#8E95A5',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1E2333',
  },
  sheetBody: {
    padding: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#191E2C',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252C3F',
    marginBottom: 16,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toggleSub: {
    fontSize: 11,
    color: '#8E95A5',
    marginTop: 2,
  },
  switchTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A334A',
    justifyContent: 'center',
    padding: 3,
  },
  switchTrackActive: {
    backgroundColor: '#00F2FE',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#10131A',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#00F2FE',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E95A5',
  },
  tabLabelActive: {
    color: '#000000',
  },
  sectionBox: {
    backgroundColor: '#191E2C',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#252C3F',
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E95A5',
    letterSpacing: 1,
    marginBottom: 12,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#141721',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A334A',
  },
  colorChipSelected: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  chipText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  customColorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#22283A',
    marginBottom: 12,
  },
  colorInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sampleSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  hexCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sliderGroup: {
    marginTop: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  sliderVal: {
    fontSize: 12,
    color: '#00F2FE',
    fontWeight: '700',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#2A334A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackFallback: {
    flex: 1,
    height: 6,
    backgroundColor: '#2A334A',
    borderRadius: 3,
  },
  fillFallback: {
    height: 6,
    backgroundColor: '#00F2FE',
    borderRadius: 3,
  },
  autoCutoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 230, 0, 0.12)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  autoCutoutBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFE600',
  },
  helperText: {
    fontSize: 12,
    color: '#8E95A5',
    lineHeight: 17,
    marginBottom: 12,
  },
  strokeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  strokeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#141721',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A334A',
  },
  strokeChipSelected: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
  },
  strokeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  strokeText: {
    fontSize: 11,
    color: '#8E95A5',
  },
  strokeTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A2030',
    gap: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E2333',
  },
  resetBtnText: {
    fontSize: 13,
    color: '#8E95A5',
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#00F2FE',
  },
  applyBtnText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '700',
  },
});
