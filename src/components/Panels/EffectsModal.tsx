import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EFFECT_PRESETS } from '../../constants/sampleMedia';
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
}

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
}: EffectsModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [intensity, setIntensity] = useState<number>(activeIntensity !== undefined ? activeIntensity : 0.8);
  const [selectedEffectId, setSelectedEffectId] = useState<string>(activeEffect || 'none');
  const [activeSessionClipId, setActiveSessionClipId] = useState<string | null>(null);

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
                    <View
                      style={[
                        styles.iconBox,
                        isCurrentActive && styles.iconBoxActive,
                        isItemNone && styles.iconBoxNone,
                      ]}
                    >
                      <Ionicons
                        name={(item.icon || 'sparkles-outline') as any}
                        size={20}
                        color={
                          isItemNone
                            ? '#64748B'
                            : isCurrentActive
                            ? '#00F2FE'
                            : '#94A3B8'
                        }
                      />
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
    width: '23.5%',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 3,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  effectCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
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
