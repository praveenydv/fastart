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
import { EFFECT_PRESETS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';
import { EffectClip } from '../../types/project';

interface EffectsModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  activeEffect?: string;
  onAddEffect: (effect: any) => void;
  editingClip?: EffectClip | null;
  onUpdateEffect?: (effect: EffectClip) => void;
  isVideoClip?: boolean;
  isInline?: boolean;
}

export default function EffectsModal({
  visible,
  onClose,
  onApply,
  activeEffect,
  onAddEffect,
  editingClip,
  onUpdateEffect,
  isVideoClip = false,
  isInline = false,
}: EffectsModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [intensity, setIntensity] = useState<number>(0.8);
  const [selectedEffectId, setSelectedEffectId] = useState<string>(activeEffect || 'none');
  const [activeSessionClipId, setActiveSessionClipId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (editingClip) {
        setActiveSessionClipId(editingClip.id);
        const effType = editingClip.type || 'none';
        setSelectedEffectId(effType);
        setIntensity(editingClip.intensity !== undefined ? editingClip.intensity : 0.8);
        const preset = EFFECT_PRESETS.find((p) => p.type === effType || p.id === effType);
        if (preset && preset.category) {
          setActiveCategory(preset.category);
        }
      } else {
        setActiveSessionClipId(null);
        setSelectedEffectId(activeEffect || 'none');
        const preset = EFFECT_PRESETS.find((p) => p.type === activeEffect || p.id === activeEffect);
        if (preset && preset.category) {
          setActiveCategory(preset.category);
        }
        setIntensity(0.8);
      }
    }
  }, [visible, editingClip, activeEffect]);

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

    // 1. Direct on-clip video effect application
    if (isVideoClip) {
      if (item.id === 'none') {
        onAddEffect({
          id: 'none',
          type: 'none',
          name: 'None',
          intensity: 0,
          applyToClip: true,
        });
      } else {
        onAddEffect({
          ...item,
          id: effId,
          type: effId,
          intensity,
          applyToClip: true,
        });
      }
      return;
    }

    // 2. Timeline effect clip clear
    if (item.id === 'none') {
      if (editingClip && onUpdateEffect) {
        onUpdateEffect({
          ...editingClip,
          type: 'none',
          name: 'None',
          intensity: 0,
        });
      }
      return;
    }

    // 3. Update existing timeline effect clip
    const targetId = editingClip?.id || activeSessionClipId;
    if (targetId && onUpdateEffect) {
      const baseClip: EffectClip = editingClip || {
        id: targetId,
        type: effId,
        name: item.name,
        startTime: 0,
        duration: 3.0,
        intensity,
        trackIndex: 4,
      };
      onUpdateEffect({
        ...baseClip,
        type: effId,
        name: item.name,
        intensity,
      });
      return;
    }

    // 4. Create new timeline effect clip for this session
    const newId = 'eff-' + Date.now();
    setActiveSessionClipId(newId);
    onAddEffect({
      ...item,
      id: newId,
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

    if (isVideoClip) {
      const currentPreset = EFFECT_PRESETS.find(
        (p) => p.id === selectedEffectId || p.type === selectedEffectId
      );
      onAddEffect({
        id: selectedEffectId,
        type: selectedEffectId,
        name: currentPreset?.name || 'Effect',
        intensity: val,
        applyToClip: true,
      });
      return;
    }

    const targetId = editingClip?.id || activeSessionClipId;
    if (targetId && onUpdateEffect) {
      const currentPreset = EFFECT_PRESETS.find(
        (p) => p.id === selectedEffectId || p.type === selectedEffectId
      );
      const baseClip: EffectClip = editingClip || {
        id: targetId,
        type: selectedEffectId,
        name: currentPreset?.name || 'Effect',
        startTime: 0,
        duration: 3.0,
        intensity: val,
        trackIndex: 4,
      };
      onUpdateEffect({
        ...baseClip,
        intensity: val,
      });
    }
  };

  const isNone = !selectedEffectId || selectedEffectId === 'none';

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    setActiveSessionClipId(null);
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    setActiveSessionClipId(null);
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Compact Space-Optimized Header */}
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
                onPress={handleClear}
                style={[styles.resetBtn, isNone && { opacity: 0.4 }]}
                disabled={isNone}
                activeOpacity={0.7}
              >
                <Text style={styles.resetText}>None</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headerTitleRow}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.sheetTitle}>
                {editingClip ? 'Edit Effect' : isVideoClip ? 'Video Clip Effect' : 'Video Effects'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleApply}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Apply effect"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Category Tabs & Intensity Row */}
          <View style={styles.controlsBar}>
            {/* Category Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
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

            {/* Intensity Level Quick Controls */}
            {!isNone && (
              <View style={styles.intensityGroup}>
                {[
                  { label: 'Mild', val: 0.4 },
                  { label: 'Normal', val: 0.75 },
                  { label: 'Strong', val: 1.0 },
                ].map((opt) => {
                  const isSelected = Math.abs(intensity - opt.val) < 0.15;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[
                        styles.intensityPill,
                        isSelected && styles.intensityPillActive,
                      ]}
                      onPress={() => handleIntensityChange(opt.val)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.intensityText,
                          isSelected && styles.intensityTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
                        size={22}
                        color={
                          isItemNone
                            ? '#71717A'
                            : isCurrentActive
                            ? '#FFFFFF'
                            : '#A1A1AA'
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

  if (isInline) {
    if (!visible) return null;
    return <View style={styles.inlineWrapper}>{sheetContent}</View>;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        {sheetContent}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121215',
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderColor: '#27272F',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#27272F',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272F',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  resetText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '600',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#27272F',
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  categoryPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  categoryPillText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  intensityGroup: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  intensityPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  intensityPillActive: {
    backgroundColor: '#202026',
    borderColor: '#FFFFFF',
  },
  intensityText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  intensityTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  effectCard: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  effectCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#202026',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#202026',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconBoxActive: {
    backgroundColor: '#FFFFFF22',
  },
  iconBoxNone: {
    backgroundColor: '#202026',
  },
  effectLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  effectLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
