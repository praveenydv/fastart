import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
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

export interface CanvasColorOption {
  id: string;
  name: string;
}

export interface ColorPaletteGroup {
  category: string;
  colors: CanvasColorOption[];
}

export const CANVAS_PALETTES: ColorPaletteGroup[] = [
  {
    category: 'Studio & Neutrals',
    colors: [
      { id: '#000000', name: 'Black' },
      { id: '#0B0D13', name: 'Studio Dark' },
      { id: '#1E293B', name: 'Slate' },
      { id: '#475569', name: 'Steel' },
      { id: '#94A3B8', name: 'Silver' },
      { id: '#F1F5F9', name: 'Soft White' },
      { id: '#FFFFFF', name: 'Pure White' },
    ],
  },
  {
    category: 'Vibrant & Creators',
    colors: [
      { id: '#EF4444', name: 'Crimson' },
      { id: '#F43F5E', name: 'Rose' },
      { id: '#F97316', name: 'Sunset' },
      { id: '#F59E0B', name: 'Amber' },
      { id: '#10B981', name: 'Emerald' },
      { id: '#06B6D4', name: 'Cyan' },
      { id: '#00F2FE', name: 'FastArt Cyan' },
      { id: '#3B82F6', name: 'Electric Blue' },
      { id: '#6366F1', name: 'Indigo' },
      { id: '#8B5CF6', name: 'Neon Violet' },
      { id: '#EC4899', name: 'Hot Pink' },
    ],
  },
  {
    category: 'Production Keying',
    colors: [
      { id: '#00FF00', name: 'Chroma Green' },
      { id: '#0000FF', name: 'Chroma Blue' },
      { id: '#FF00FF', name: 'Chroma Magenta' },
    ],
  },
];

const QUICK_PRESETS = [
  '#000000',
  '#FFFFFF',
  '#00FF00',
  '#00F2FE',
  '#EF4444',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
];

function isLightColor(color: string): boolean {
  if (!color) return false;
  const hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return !isNaN(r) && !isNaN(g) && !isNaN(b) && (r * 299 + g * 587 + b * 114) / 1000 > 155;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return !isNaN(r) && !isNaN(g) && !isNaN(b) && (r * 299 + g * 587 + b * 114) / 1000 > 155;
  }
  return false;
}

function normalizeHex(input: string): string | null {
  const val = input.trim().toLowerCase();
  const NAMED_COLORS: Record<string, string> = {
    black: '#000000',
    white: '#FFFFFF',
    transparent: 'transparent',
    red: '#EF4444',
    green: '#10B981',
    blue: '#3B82F6',
    yellow: '#F59E0B',
    purple: '#8B5CF6',
    pink: '#EC4899',
    cyan: '#00F2FE',
    orange: '#F97316',
    gray: '#6B7280',
    grey: '#6B7280',
    dark: '#121622',
  };
  if (NAMED_COLORS[val]) return NAMED_COLORS[val];
  if (val === '0' || val === '000' || val === '000000') return '#000000';
  const clean = val.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(clean)) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/.test(clean)) {
    return `#${clean}`.toUpperCase();
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
  const currentBg = (project.canvasBackground || '#000000').toUpperCase();

  const [customHexInput, setCustomHexInput] = useState(currentBg);

  useEffect(() => {
    setCustomHexInput(currentBg);
  }, [currentBg]);

  // Find label for active color across all groups
  let activeColorName = 'Custom';
  for (const group of CANVAS_PALETTES) {
    const found = group.colors.find(
      (c) => c.id.toUpperCase() === currentBg.toUpperCase(),
    );
    if (found) {
      activeColorName = found.name;
      break;
    }
  }

  const isLight = isLightColor(currentBg);

  // Compute preview aspect ratio box dimensions (fit in 100x100)
  const getPreviewBoxStyle = () => {
    switch (currentRatio) {
      case '9:16':
        return { width: 50, height: 88 };
      case '16:9':
        return { width: 92, height: 52 };
      case '1:1':
        return { width: 68, height: 68 };
      case '4:5':
        return { width: 58, height: 72 };
      case '2.35:1':
        return { width: 94, height: 40 };
      default:
        return { width: 50, height: 88 };
    }
  };

  const handleSelectRatio = (ratio: AspectRatio) => {
    soundEngine.playSfx('pop');
    onUpdateProject({ aspectRatio: ratio });
  };

  const handleSelectColor = (color: string) => {
    soundEngine.playSfx('pop');
    const formatted = normalizeHex(color) || color.toUpperCase();
    setCustomHexInput(formatted);
    onUpdateProject({ canvasBackground: formatted });
  };

  const handleCustomHexChange = (text: string) => {
    setCustomHexInput(text);
    const validHex = normalizeHex(text);
    if (validHex) {
      onUpdateProject({ canvasBackground: validHex });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="scan-outline" size={18} color="#00F2FE" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Canvas Settings</Text>
                <Text style={styles.headerSubtitle}>Format, aspect ratio & canvas background</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                soundEngine.playSfx('click');
                onClose();
              }}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Live Canvas Preview Card */}
            <View style={styles.previewCard}>
              <View style={styles.previewStage}>
                <View
                  style={[
                    styles.previewRatioBox,
                    getPreviewBoxStyle(),
                    { backgroundColor: currentBg },
                    isLight && { borderColor: 'rgba(0,0,0,0.35)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.previewRatioText,
                      isLight ? { color: '#0F172A' } : { color: '#00F2FE' },
                    ]}
                  >
                    {currentRatio}
                  </Text>
                </View>
              </View>
              <View style={styles.previewMeta}>
                <View style={styles.metaBadge}>
                  <Ionicons name="film-outline" size={13} color="#00F2FE" />
                  <Text style={styles.metaBadgeText}>{currentRatio}</Text>
                </View>
                <View style={styles.metaBadge}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: currentBg,
                      borderWidth: isLight ? 1 : 0,
                      borderColor: '#4B5563',
                    }}
                  />
                  <Text style={styles.metaBadgeText}>
                    {activeColorName} ({currentBg})
                  </Text>
                </View>
                {currentBg !== '#000000' && (
                  <TouchableOpacity
                    style={[
                      styles.metaBadge,
                      {
                        backgroundColor: 'rgba(0, 242, 254, 0.15)',
                        borderColor: '#00F2FE',
                      },
                    ]}
                    onPress={() => handleSelectColor('#000000')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh-outline" size={13} color="#00F2FE" />
                    <Text
                      style={[
                        styles.metaBadgeText,
                        { color: '#00F2FE', fontWeight: '700' },
                      ]}
                    >
                      Reset Black
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 1. Aspect Ratio Formats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Aspect Ratio (Canvas Format)</Text>
              <View style={styles.ratioGrid}>
                {ASPECT_RATIOS.map((item) => {
                  const isSelected = currentRatio === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.ratioCard, isSelected && styles.ratioCardActive]}
                      onPress={() => handleSelectRatio(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.ratioIconRow}>
                        <Ionicons
                          name={item.icon || 'phone-portrait-outline'}
                          size={20}
                          color={isSelected ? '#00F2FE' : '#8E95A5'}
                        />
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color="#00F2FE" />
                        )}
                      </View>
                      <Text style={[styles.ratioLabel, isSelected && styles.ratioLabelActive]}>
                        {item.label}
                      </Text>
                      <Text style={styles.ratioDesc} numberOfLines={1}>
                        {item.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Custom Hex Color Input */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>2. Custom Color / Hex Code</Text>
                <Text style={styles.sectionBadge}>{currentBg}</Text>
              </View>

              <View style={styles.customColorRow}>
                <View
                  style={[
                    styles.customColorPreview,
                    { backgroundColor: currentBg },
                    isLight && { borderColor: 'rgba(0,0,0,0.3)' },
                  ]}
                >
                  <Ionicons
                    name="color-palette-outline"
                    size={16}
                    color={isLight ? '#0F172A' : '#FFFFFF'}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.hashSymbol}>#</Text>
                  <TextInput
                    style={styles.hexInput}
                    value={customHexInput.replace(/^#/, '')}
                    onChangeText={(val) => handleCustomHexChange(val)}
                    placeholder="FFFFFF"
                    placeholderTextColor="#4B5563"
                    maxLength={8}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.applyColorBtn,
                    normalizeHex(customHexInput) && styles.applyColorBtnActive,
                  ]}
                  onPress={() => {
                    const valid = normalizeHex(customHexInput);
                    if (valid) handleSelectColor(valid);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark" size={18} color="#000000" />
                </TouchableOpacity>
              </View>

              {/* Quick Preset Pills */}
              <View style={styles.quickPresetRow}>
                {QUICK_PRESETS.map((pCol) => {
                  const isPSelected = currentBg.toUpperCase() === pCol.toUpperCase();
                  const pLight = isLightColor(pCol);
                  return (
                    <TouchableOpacity
                      key={pCol}
                      style={[
                        styles.quickPresetPill,
                        { backgroundColor: pCol },
                        pLight && { borderWidth: 1, borderColor: '#4B5563' },
                        isPSelected && styles.quickPresetPillActive,
                      ]}
                      onPress={() => handleSelectColor(pCol)}
                      activeOpacity={0.7}
                    >
                      {isPSelected && (
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color={pLight ? '#000000' : '#FFFFFF'}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Canvas Background Palettes */}
            {CANVAS_PALETTES.map((group) => (
              <View key={group.category} style={styles.section}>
                <Text style={styles.sectionTitle}>{group.category}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorRow}
                >
                  {group.colors.map((col) => {
                    const isSelected = currentBg.toUpperCase() === col.id.toUpperCase();
                    const itemIsLight = isLightColor(col.id);
                    return (
                      <TouchableOpacity
                        key={col.id}
                        style={[
                          styles.colorSwatchBtn,
                          isSelected && styles.colorSwatchBtnActive,
                        ]}
                        onPress={() => handleSelectColor(col.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.colorCircle,
                            { backgroundColor: col.id },
                            itemIsLight && { borderWidth: 1, borderColor: '#4B5563' },
                            isSelected && {
                              borderColor: '#00F2FE',
                              borderWidth: 2.5,
                              transform: [{ scale: 1.08 }],
                            },
                          ]}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color={itemIsLight ? '#000000' : '#00F2FE'}
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.colorName,
                            isSelected && styles.colorNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {col.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                soundEngine.playSfx('whoosh');
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={18} color="#000000" />
              <Text style={styles.applyBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0E1118',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '82%',
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1.5,
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
    borderBottomColor: '#1A1E29',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#161B26',
  },
  contentScroll: {
    padding: 16,
  },
  previewCard: {
    backgroundColor: '#141824',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22283A',
    alignItems: 'center',
  },
  previewStage: {
    width: '100%',
    height: 110,
    backgroundColor: '#090B10',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1A1F2C',
  },
  previewRatioBox: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  previewRatioText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E2436',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A324B',
  },
  metaBadgeText: {
    color: '#E0E7FF',
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#131722',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2436',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionBadge: {
    backgroundColor: '#1E2436',
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2B354F',
    letterSpacing: 0.5,
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customColorPreview: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2A324B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B202E',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2A324B',
    paddingHorizontal: 12,
    height: 42,
  },
  hashSymbol: {
    color: '#00F2FE',
    fontSize: 15,
    fontWeight: '800',
    marginRight: 4,
  },
  hexInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    padding: 0,
  },
  applyColorBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  applyColorBtnActive: {
    backgroundColor: '#00F2FE',
    opacity: 1,
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  quickPresetPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPresetPillActive: {
    borderWidth: 2,
    borderColor: '#00F2FE',
    transform: [{ scale: 1.15 }],
  },
  ratioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratioCard: {
    width: '48.5%',
    backgroundColor: '#1B202E',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  ratioCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  ratioIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ratioLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ratioLabelActive: {
    color: '#00F2FE',
  },
  ratioDesc: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 3,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  colorSwatchBtn: {
    alignItems: 'center',
    gap: 6,
    width: 58,
  },
  colorSwatchBtnActive: {
    opacity: 1,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorName: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  colorNameActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  applyBtn: {
    backgroundColor: '#00F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  applyBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});

