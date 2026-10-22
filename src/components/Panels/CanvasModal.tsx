import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { FastArtProject, AspectRatio } from '../../types/project';
import { ASPECT_RATIOS } from '../../constants/sampleMedia';

interface CanvasModalProps {
  visible: boolean;
  onClose: () => void;
  project: FastArtProject | null;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
}

export const CANVAS_COLORS = [
  { id: '#000000', name: 'Black' },
  { id: '#0B0D13', name: 'Dark' },
  { id: '#1E293B', name: 'Slate' },
  { id: '#FFFFFF', name: 'White' },
  { id: '#00F2FE', name: 'Cyan' },
  { id: '#00FF00', name: 'Green Screen' },
  { id: '#0000FF', name: 'Blue Screen' },
  { id: '#FF0050', name: 'Crimson' },
  { id: '#8B5CF6', name: 'Purple' },
  { id: '#F59E0B', name: 'Amber' },
  { id: '#10B981', name: 'Emerald' },
];

export const BLUR_PRESETS = [
  { id: 'blur:10', name: 'Soft Blur', px: 10 },
  { id: 'blur:25', name: 'Standard Blur', px: 25 },
  { id: 'blur:50', name: 'Deep Blur', px: 50 },
];

export const GRADIENT_PRESETS = [
  { id: 'gradient:#0F2027,#2C5364', name: 'Deep Sea', c1: '#0F2027' },
  { id: 'gradient:#FF416C,#FF4B2B', name: 'Sunset', c1: '#FF416C' },
  { id: 'gradient:#00F2FE,#4FACFE', name: 'Electric', c1: '#00F2FE' },
  { id: 'gradient:#11998E,#38EF7D', name: 'Mint', c1: '#11998E' },
  { id: 'gradient:#FC466B,#3F5EFB', name: 'Cyberpunk', c1: '#FC466B' },
  { id: 'gradient:#434343,#000000', name: 'Carbon', c1: '#434343' },
];

function normalizeHex(input: string): string | null {
  const clean = input.replace(/[^0-9A-Fa-f]/g, '');
  if (clean.length === 6) {
    return `#${clean.toUpperCase()}`;
  }
  if (clean.length === 3) {
    return `#${clean.split('').map((c) => c + c).join('').toUpperCase()}`;
  }
  return null;
}

export default function CanvasModal({
  visible,
  onClose,
  project,
  onUpdateProject,
}: CanvasModalProps) {
  if (!project) return null;

  const currentRatio = project.aspectRatio || '9:16';
  const rawBg = project.canvasBackground || '#000000';
  const isBlur = rawBg.startsWith('blur:');
  const isGradient = rawBg.startsWith('gradient:');
  const currentBg = isBlur || isGradient ? rawBg : rawBg.toUpperCase();

  const [activeTab, setActiveTab] = useState<'ratio' | 'background'>('ratio');
  const [customHexInput, setCustomHexInput] = useState(
    isBlur || isGradient ? '#000000' : currentBg
  );

  useEffect(() => {
    if (!isBlur && !isGradient) {
      setCustomHexInput(currentBg);
    }
  }, [currentBg, isBlur, isGradient]);

  const handleSelectRatio = (ratio: AspectRatio) => {
    soundEngine.playSfx('pop');
    onUpdateProject({ aspectRatio: ratio });
  };

  const handleSelectBg = (bg: string) => {
    soundEngine.playSfx('pop');
    const formatted = normalizeHex(bg) || bg;
    setCustomHexInput(formatted);
    onUpdateProject({ canvasBackground: formatted });
  };

  const handleReset = () => {
    soundEngine.playSfx('pop');
    onUpdateProject({
      aspectRatio: '9:16',
      canvasBackground: '#000000',
    });
    setCustomHexInput('#000000');
  };

  const isDefault = currentRatio === '9:16' && currentBg === '#000000';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, isDefault && { opacity: 0.4 }]}
              disabled={isDefault}
              activeOpacity={0.7}
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <Ionicons name="scan-outline" size={16} color="#00F2FE" />
              <Text style={styles.headerTitle}>Canvas & Ratio</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.doneBtn} activeOpacity={0.7}>
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Sub-Tabs: Aspect Ratio vs Background */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'ratio' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('ratio');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={14}
                color={activeTab === 'ratio' ? '#00F2FE' : '#8E95A5'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'ratio' && { color: '#00F2FE', fontWeight: '700' },
                ]}
              >
                Aspect Ratio ({currentRatio})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'background' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('background');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="color-palette-outline"
                size={14}
                color={activeTab === 'background' ? '#D946EF' : '#8E95A5'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'background' && { color: '#D946EF', fontWeight: '700' },
                ]}
              >
                Background
              </Text>
            </TouchableOpacity>
          </View>

          {/* Controls Body */}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'ratio' && (
              <View style={styles.ratioGrid}>
                {ASPECT_RATIOS.map((item) => {
                  const isSelected = currentRatio === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.ratioCard, isSelected && styles.ratioCardActive]}
                      onPress={() => handleSelectRatio(item.id as AspectRatio)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[styles.ratioIconBox, isSelected && styles.ratioIconBoxActive]}
                      >
                        <Ionicons
                          name={(item.icon || 'square-outline') as any}
                          size={22}
                          color={isSelected ? '#00F2FE' : '#8E95A5'}
                        />
                      </View>
                      <Text
                        style={[styles.ratioLabel, isSelected && styles.ratioLabelActive]}
                      >
                        {item.label}
                      </Text>
                      <Text style={styles.ratioDesc} numberOfLines={1}>
                        {item.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {activeTab === 'background' && (
              <View style={styles.bgGroup}>
                {/* 1. Solid Colors */}
                <Text style={styles.sectionTitle}>Solid Colors</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorRow}
                >
                  {CANVAS_COLORS.map((col) => {
                    const isSelected = currentBg.toUpperCase() === col.id.toUpperCase();
                    return (
                      <TouchableOpacity
                        key={col.id}
                        style={[styles.colorItem, isSelected && styles.colorItemActive]}
                        onPress={() => handleSelectBg(col.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.colorCircle,
                            { backgroundColor: col.id },
                            col.id === '#FFFFFF' && { borderWidth: 1, borderColor: '#475569' },
                          ]}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={col.id === '#FFFFFF' ? '#000' : '#00F2FE'}
                            />
                          )}
                        </View>
                        <Text
                          style={[styles.colorLabel, isSelected && styles.colorLabelActive]}
                          numberOfLines={1}
                        >
                          {col.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* 2. Video Blur Presets */}
                <Text style={styles.sectionTitle}>Video Blur</Text>
                <View style={styles.blurRow}>
                  {BLUR_PRESETS.map((blur) => {
                    const isSelected = currentBg === blur.id;
                    return (
                      <TouchableOpacity
                        key={blur.id}
                        style={[styles.blurPill, isSelected && styles.blurPillActive]}
                        onPress={() => handleSelectBg(blur.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="water-outline"
                          size={13}
                          color={isSelected ? '#00F2FE' : '#8E95A5'}
                        />
                        <Text
                          style={[
                            styles.blurPillText,
                            isSelected && styles.blurPillTextActive,
                          ]}
                        >
                          {blur.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 3. Gradients */}
                <Text style={styles.sectionTitle}>Gradients</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorRow}
                >
                  {GRADIENT_PRESETS.map((grad) => {
                    const isSelected = currentBg === grad.id;
                    return (
                      <TouchableOpacity
                        key={grad.id}
                        style={[styles.colorItem, isSelected && styles.colorItemActive]}
                        onPress={() => handleSelectBg(grad.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[styles.colorCircle, { backgroundColor: grad.c1 }]}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="#00F2FE" />
                          )}
                        </View>
                        <Text
                          style={[styles.colorLabel, isSelected && styles.colorLabelActive]}
                          numberOfLines={1}
                        >
                          {grad.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* 4. Custom Hex Input */}
                <Text style={styles.sectionTitle}>Custom Color</Text>
                <View style={styles.hexInputRow}>
                  <View
                    style={[
                      styles.colorCircleSmall,
                      { backgroundColor: normalizeHex(customHexInput) || '#000000' },
                    ]}
                  />
                  <TextInput
                    style={styles.hexInput}
                    value={customHexInput}
                    onChangeText={(val) => {
                      setCustomHexInput(val);
                      const valid = normalizeHex(val);
                      if (valid) {
                        onUpdateProject({ canvasBackground: valid });
                      }
                    }}
                    placeholder="#000000"
                    placeholderTextColor="#64748B"
                    maxLength={7}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121620',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '48%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderColor: '#1E2333',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1F2C',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1A1F2C',
  },
  resetText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#161B26',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#202636',
  },
  tabText: {
    fontSize: 12,
    color: '#8E95A5',
    fontWeight: '500',
  },
  contentScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  scrollBody: {
    paddingBottom: 20,
  },
  ratioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratioCard: {
    width: '31%',
    backgroundColor: '#161B26',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  ratioCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1A2234',
  },
  ratioIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E2433',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ratioIconBoxActive: {
    backgroundColor: '#00F2FE22',
  },
  ratioLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  ratioLabelActive: {
    color: '#00F2FE',
  },
  ratioDesc: {
    color: '#8E95A5',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  bgGroup: {
    gap: 8,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  colorItem: {
    alignItems: 'center',
    width: 52,
  },
  colorItemActive: {
    transform: [{ scale: 1.05 }],
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#262D3D',
  },
  colorLabel: {
    color: '#8E95A5',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  colorLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  blurRow: {
    flexDirection: 'row',
    gap: 8,
  },
  blurPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  blurPillActive: {
    backgroundColor: '#1A2234',
    borderColor: '#00F2FE',
  },
  blurPillText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '600',
  },
  blurPillTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161B26',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  colorCircleSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hexInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
});
