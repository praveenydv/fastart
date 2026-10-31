import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EFFECT_PRESETS, PRESET_PREVIEW_IMAGE } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';
import { EffectClip } from '../../types/project';
import { CompactSliderInput } from '../Common/CompactSliderInput';

interface EffectsModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  activeEffect?: string;
  activeIntensity?: number;
  onAddEffect: (effect: any) => void;
  editingClip?: EffectClip | null;
  onUpdateEffect?: (effect: EffectClip) => void;
  isInline?: boolean;
  selectedClip?: any;
  project?: any;
}

const getEffectFilterStyle = (type: string): any => {
  if (Platform.OS !== 'web') return null;
  switch (type) {
    case 'glitch':
      return { filter: 'contrast(1.3) hue-rotate(90deg)', animation: 'fastartGlitchSlice 0.8s infinite' };
    case 'vhs':
      return { filter: 'sepia(0.35) saturate(1.4) contrast(1.15)' };
    case 'rgb_split':
      return { filter: 'contrast(1.4) saturate(1.5)' };
    case 'film_grain':
      return { filter: 'sepia(0.4) contrast(1.2) brightness(0.9)' };
    case 'old_film':
      return { filter: 'grayscale(1) sepia(0.65) contrast(1.45)' };
    case 'crt_tv':
      return { filter: 'contrast(1.25) brightness(1.1)' };
    case 'zoom_pulse':
      return { animation: 'fastartZoomPulseAnim 1.4s ease-in-out infinite' };
    case 'neon_edge':
    case 'ai_cyberpunk':
      return { filter: 'saturate(2.2) contrast(1.4)' };
    case 'blur':
    case 'blur_cinematic':
    case 'gaussian_blur':
      return { filter: 'blur(2.5px)' };
    case 'motion_blur':
      return { filter: 'blur(2px) contrast(1.15)' };
    case 'radial_blur':
      return { filter: 'blur(1.8px) contrast(1.2)' };
    case 'mosaic_blur':
      return { filter: 'contrast(1.35) brightness(0.95)' };
    case 'flash':
      return { filter: 'brightness(1.55) contrast(1.25)' };
    case 'vignette':
      return { filter: 'contrast(1.3) brightness(0.85)' };
    case 'mirror':
      return { transform: [{ scaleX: -1 }] };
    case 'shake':
      return { animation: 'fastartShakeAnim 0.7s infinite' };
    case 'thermal':
      return { filter: 'invert(1) hue-rotate(180deg) saturate(3)' };
    case 'ai_matrix':
      return { filter: 'hue-rotate(90deg) saturate(3.5) contrast(1.5) brightness(0.85)' };
    case 'ai_manga':
      return { filter: 'grayscale(0.85) contrast(1.8) brightness(1.1)' };
    case 'ai_night_vision':
      return { filter: 'sepia(1) hue-rotate(85deg) saturate(4) brightness(0.9)' };
    case 'ai_cartoon':
      return { filter: 'saturate(2.2) contrast(1.55)' };
    case 'beauty_smooth':
      return { filter: 'brightness(1.08) contrast(0.95) saturate(1.12)' };
    case 'ai_aura':
      return { filter: 'saturate(1.6) brightness(1.1)' };
    case 'sun_flare':
      return { filter: 'brightness(1.28) saturate(1.35)' };
    case 'prism_leak':
      return { filter: 'saturate(1.7) hue-rotate(45deg)' };
    case 'cyberpunk_dual':
      return { filter: 'contrast(1.35) saturate(1.85)' };
    case 'fisheye':
      return { transform: [{ scale: 1.15 }] };
    case 'water_ripple':
      return { filter: 'hue-rotate(15deg) contrast(1.15)' };
    case 'kaleidoscope':
      return { filter: 'contrast(1.3) saturate(1.4)' };
    default:
      return null;
  }
};

export default function EffectsModal({
  visible,
  onClose,
  onApply,
  activeEffect,
  activeIntensity,
  onAddEffect,
  editingClip,
  onUpdateEffect,
  isInline = false,
  selectedClip,
  project,
}: EffectsModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [intensity, setIntensity] = useState<number>(activeIntensity !== undefined ? activeIntensity : 0.8);
  const [selectedEffectId, setSelectedEffectId] = useState<string>(activeEffect || 'none');
  const [activeSessionClipId, setActiveSessionClipId] = useState<string | null>(null);

  // Standardized prefix reference model image for consistent, high-clarity effect previews
  const previewThumb = PRESET_PREVIEW_IMAGE;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'fastart-effect-preview-styles';
    if (document.getElementById(styleId)) return;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      @keyframes fastartGlitchSlice {
        0%, 100% { transform: translate(0); }
        20% { transform: translate(-2px, 1px) skewX(2deg); }
        40% { transform: translate(2px, -1px) skewX(-2deg); }
        60% { transform: translate(-1px, 2px); }
        80% { transform: translate(1px, -1px); }
      }
      @keyframes fastartRecBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.2; }
      }
      @keyframes fastartZoomPulseAnim {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
      }
      @keyframes fastartStrobeFlash {
        0%, 75%, 100% { opacity: 0; }
        80%, 92% { opacity: 0.65; }
      }
      @keyframes fastartNeonEdgePulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; filter: drop-shadow(0 0 6px #00f2fe); }
      }
      @keyframes fastartShakeAnim {
        0%, 100% { transform: translate(0); }
        25% { transform: translate(-1.5px, 1px) rotate(-1deg); }
        75% { transform: translate(1.5px, -1px) rotate(1deg); }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  useEffect(() => {
    if (visible) {
      setActiveCategory('All');
      if (editingClip) {
        setActiveSessionClipId(editingClip.id);
        const effType = editingClip.type || 'none';
        setSelectedEffectId(effType);
        setIntensity(editingClip.intensity !== undefined ? editingClip.intensity : (activeIntensity !== undefined ? activeIntensity : 0.8));
      } else {
        setActiveSessionClipId(null);
        setSelectedEffectId(activeEffect || 'none');
        setIntensity(activeIntensity !== undefined ? activeIntensity : 0.8);
      }
    }
  }, [visible, editingClip, activeEffect, activeIntensity]);

  const categories = [
    { id: 'All', label: 'All' },
    { id: 'AI', label: '✨ AI Effects' },
    { id: 'Glitch', label: 'Glitch' },
    { id: 'Retro', label: 'Retro' },
    { id: 'Motion', label: 'Motion' },
    { id: 'Light', label: 'Light' },
  ];

  const filteredEffects = EFFECT_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    if (activeCategory === 'AI') {
      return item.category === 'AI' || item.name.startsWith('AI ');
    }
    return item.category === activeCategory;
  });

  const handleSelect = (item: any) => {
    soundEngine.playSfx('pop');
    const effId = item.type || item.id;
    setSelectedEffectId(effId);

    // 1. None selected: remove effect from selected video clip or timeline clip
    if (item.id === 'none' || item.type === 'none') {
      if (editingClip && onUpdateEffect) {
        onUpdateEffect({
          ...editingClip,
          type: 'none',
          name: 'None',
          intensity: 0,
        });
      }
      if (onAddEffect) {
        onAddEffect(item);
      }
      setActiveSessionClipId(null);
      return;
    }

    // 2. Update existing timeline effect clip
    const targetId = editingClip?.id || activeSessionClipId;
    if (editingClip && onUpdateEffect) {
      onUpdateEffect({
        ...editingClip,
        type: effId,
        name: item.name,
        intensity,
      });
      return;
    }

    // 3. Attach effect to selected video clip OR create new standalone timeline effect clip
    const newId = activeSessionClipId || ('eff-' + Date.now());
    setActiveSessionClipId(newId);
    onAddEffect({
      ...item,
      id: newId,
      type: effId,
      duration: 3.0,
      intensity,
    });
  };

  const handleClear = () => {
    soundEngine.playSfx('click');
    setSelectedEffectId('none');
    const noneItem = EFFECT_PRESETS.find((p) => p.id === 'none') || { id: 'none', type: 'none', name: 'None' };
    handleSelect(noneItem);
  };

  const handleIntensityChange = (val: number) => {
    soundEngine.playSfx('click');
    setIntensity(val);
    if (selectedEffectId === 'none') return;

    const currentPreset = EFFECT_PRESETS.find(
      (p) => p.id === selectedEffectId || p.type === selectedEffectId
    );

    const targetId = editingClip?.id || activeSessionClipId;
    if (editingClip && onUpdateEffect) {
      onUpdateEffect({
        ...editingClip,
        intensity: val,
      });
    } else if (onAddEffect) {
      onAddEffect({
        ...currentPreset,
        id: targetId || selectedEffectId,
        type: selectedEffectId,
        name: currentPreset?.name || selectedEffectId,
        intensity: val,
      });
    }
  };

  const isNone = !selectedEffectId || selectedEffectId === 'none';

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.sheetHeader}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="sparkles" size={16} color="#00F2FE" />
            <Text style={styles.sheetTitle}>
              {editingClip ? 'Edit Effect' : 'Video Effects'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleClear}
              style={[styles.resetBtn, isNone && { opacity: 0.4 }, { paddingHorizontal: 10, height: 26, flexDirection: 'row', alignItems: 'center' }]}
              disabled={isNone}
              activeOpacity={0.7}
              accessibilityLabel="Clear effect"
            >
              <Ionicons name="refresh-outline" size={12} color="#00F2FE" style={{ marginRight: 4 }} />
              <Text style={[styles.resetText, { fontSize: 11 }]} numberOfLines={1}>None</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

          {/* Category Tabs & Intensity Row */}
          <View style={[styles.controlsBar, isInline && { marginTop: 8 }]}>
            {/* Category Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {isInline && !isNone && (
                <TouchableOpacity
                  style={[
                    styles.categoryPill,
                    {
                      borderColor: '#00F2FE',
                      backgroundColor: 'rgba(0, 242, 254, 0.12)',
                      flexDirection: 'row',
                      alignItems: 'center',
                    },
                  ]}
                  onPress={handleClear}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={11} color="#00F2FE" style={{ marginRight: 4 }} />
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: '#00F2FE', fontWeight: '700', flexShrink: 0 },
                      Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : null,
                    ]}
                    numberOfLines={1}
                  >
                    None
                  </Text>
                </TouchableOpacity>
              )}
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setActiveCategory(cat.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isActive && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Continuous Intensity Slider & Presets */}
            {!isNone && (
              <View style={styles.intensityCard}>
                <View style={styles.intensityHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={13} color="#00F2FE" />
                    <Text style={styles.intensityActiveName} numberOfLines={1}>
                      {EFFECT_PRESETS.find((p) => p.id === selectedEffectId || p.type === selectedEffectId)?.name || 'Active Effect'}
                    </Text>
                  </View>
                  <Text style={styles.intensityBadgeText}>{Math.round(intensity * 100)}%</Text>
                </View>

                <CompactSliderInput
                  label="Effect Intensity"
                  value={Math.round(intensity * 100)}
                  min={5}
                  max={100}
                  step={1}
                  unit="%"
                  defaultValue={80}
                  accentColor="#00F2FE"
                  onChange={(newPct) => handleIntensityChange(newPct / 100)}
                />

                <View style={styles.quickPresetRow}>
                  {[
                    { label: '25%', val: 0.25 },
                    { label: '50%', val: 0.5 },
                    { label: '75%', val: 0.75 },
                    { label: '100%', val: 1.0 },
                  ].map((opt) => {
                    const isSelected = Math.abs(intensity - opt.val) < 0.08;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        style={[
                          styles.quickPresetPill,
                          isSelected && styles.quickPresetPillActive,
                        ]}
                        onPress={() => handleIntensityChange(opt.val)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickPresetText,
                            isSelected && styles.quickPresetTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Effects Grid Scroll */}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {filteredEffects.map((item) => {
                const isItemNone = item.id === 'none';
                const isCurrentActive = isItemNone
                  ? isNone
                  : selectedEffectId === item.id || selectedEffectId === item.type;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.effectCard,
                      isCurrentActive && styles.effectCardActive,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.previewBox}>
                      {isItemNone ? (
                        <View style={styles.nonePreviewBox}>
                          <Ionicons name="close-circle-outline" size={24} color="#64748B" />
                          <Text style={styles.nonePreviewText}>None</Text>
                        </View>
                      ) : (
                        <>
                          <Image
                            source={{ uri: previewThumb }}
                            style={[styles.previewImg, getEffectFilterStyle(item.type)]}
                            resizeMode="cover"
                          />
                          {/* Visual effect overlays */}
                          {item.type === 'vhs' && (
                            <View style={styles.recBadge}>
                              <View style={[styles.recDot, Platform.OS === 'web' ? ({ animation: 'fastartRecBlink 1s infinite' } as any) : null]} />
                              <Text style={styles.recText}>REC</Text>
                            </View>
                          )}
                          {item.type === 'glitch' && (
                            <>
                              <View style={styles.glitchStripe1} />
                              <View style={styles.glitchStripe2} />
                            </>
                          )}
                          {item.type === 'ai_matrix' && (
                            <View style={styles.matrixOverlay}>
                              <Text style={styles.matrixCodeText}>10101</Text>
                            </View>
                          )}
                          {item.type === 'thermal' && <View style={styles.thermalOverlay} />}
                          {item.type === 'crt_tv' && <View style={styles.crtScanlines} />}
                          {item.type === 'mirror' && <View style={styles.mirrorLine} />}
                          {item.type === 'kaleidoscope' && (
                            <>
                              <View style={styles.kaleidoscopeCrossH} />
                              <View style={styles.kaleidoscopeCrossV} />
                            </>
                          )}
                          {(item.type === 'neon_edge' || item.type === 'ai_cyberpunk') && (
                            <View style={[styles.neonBorder, Platform.OS === 'web' ? ({ animation: 'fastartNeonEdgePulse 1.4s ease-in-out infinite' } as any) : null]} />
                          )}
                          {item.type === 'vignette' && <View style={styles.vignetteShadow} />}
                          {item.type === 'flash' && (
                            <View style={[styles.centerGlow, Platform.OS === 'web' ? ({ animation: 'fastartStrobeFlash 1.2s infinite' } as any) : null]} />
                          )}
                          {(item.type === 'prism_leak' || item.type === 'sun_flare') && (
                            <View style={styles.lightLeakStripe} />
                          )}
                          <View style={styles.badgeTag}>
                            <Text style={styles.badgeTagText}>{item.category || 'FX'}</Text>
                          </View>
                          {isCurrentActive && (
                            <View style={styles.activeCheckBadge}>
                              <Ionicons name="checkmark" size={12} color="#000000" />
                            </View>
                          )}
                        </>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.effectLabel,
                        isCurrentActive && styles.effectLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.effectDescText} numberOfLines={1}>
                      {(item as any).desc || item.category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0F131D',
  },
  inlineSheetContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    borderTopWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#1F2637',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  doneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBar: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  categoryScroll: {
    gap: 5,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
  },
  categoryPillText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  intensityCard: {
    backgroundColor: '#0F131F',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.2)',
  },
  intensityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  intensityActiveName: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 200,
  },
  intensityBadgeText: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '800',
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  quickPresetPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  quickPresetPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  quickPresetText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  quickPresetTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  effectCard: {
    width: '31%',
    alignItems: 'center',
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#131826',
    borderWidth: 1.5,
    borderColor: '#1F2637',
  },
  effectCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  previewBox: {
    width: '100%',
    height: 52,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#090B10',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  nonePreviewBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0A0D14',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  nonePreviewText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '600',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  recBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 5,
  },
  recDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  recText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  glitchStripe1: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(0, 242, 254, 0.45)',
  },
  glitchStripe2: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: 'rgba(255, 0, 80, 0.45)',
  },
  matrixOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#10B981',
    zIndex: 5,
  },
  matrixCodeText: {
    color: '#10B981',
    fontSize: 7,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  thermalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderBottomWidth: 3,
    borderColor: '#F59E0B',
  },
  crtScanlines: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  mirrorLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  kaleidoscopeCrossH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  kaleidoscopeCrossV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  neonBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderColor: '#00F2FE',
    borderRadius: 5,
  },
  vignetteShadow: {
    ...StyleSheet.absoluteFill,
    borderWidth: 4,
    borderColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 5,
  },
  centerGlow: {
    position: 'absolute',
    top: '25%',
    left: '25%',
    width: '50%',
    height: '50%',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  lightLeakStripe: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 30,
    height: 60,
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
    transform: [{ rotate: '35deg' }],
  },
  badgeTag: {
    position: 'absolute',
    bottom: 2,
    left: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    zIndex: 5,
  },
  badgeTagText: {
    color: '#94A3B8',
    fontSize: 7,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#08090E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  iconBoxActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  iconBoxNone: {
    backgroundColor: '#08090E',
  },
  effectLabel: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  effectLabelActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  effectDescText: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
        } as any)
      : {}),
  },
  inlineApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 6,
  },
  inlineAppliedBtn: {
    backgroundColor: '#10B981',
  },
  inlineApplyText: {
    color: '#08090E',
    fontSize: 11,
    fontWeight: '700',
  },
});
