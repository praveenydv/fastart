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
  activeEffect?: string;
  onAddEffect: (effect: any) => void;
  editingClip?: EffectClip | null;
  onUpdateEffect?: (effect: EffectClip) => void;
}

export default function EffectsModal({
  visible,
  onClose,
  activeEffect,
  onAddEffect,
  editingClip,
  onUpdateEffect,
}: EffectsModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [intensity, setIntensity] = useState<number>(0.8);
  const [selectedEffectId, setSelectedEffectId] = useState<string>(activeEffect || 'none');

  useEffect(() => {
    if (visible) {
      if (editingClip) {
        const effType = editingClip.type || 'none';
        setSelectedEffectId(effType);
        setIntensity(editingClip.intensity !== undefined ? editingClip.intensity : 0.8);
        const preset = EFFECT_PRESETS.find((p) => p.type === effType || p.id === effType);
        if (preset && preset.category) {
          setActiveCategory(preset.category);
        }
      } else {
        setSelectedEffectId(activeEffect || 'none');
        setIntensity(0.8);
      }
    }
  }, [visible, editingClip, activeEffect]);

  const categories = [
    { id: 'All', label: 'All' },
    { id: 'Glitch', label: 'Glitch' },
    { id: 'Retro', label: 'Retro' },
    { id: 'Motion', label: 'Motion' },
    { id: 'Light', label: 'Light' },
  ];

  const filteredEffects = EFFECT_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });

  const handleSelect = (item: any) => {
    soundEngine.playSfx('pop');
    const effId = item.type || item.id;
    setSelectedEffectId(effId);

    if (editingClip && onUpdateEffect) {
      const updated: EffectClip = {
        ...editingClip,
        type: effId,
        name: item.name,
        intensity: item.id === 'none' ? 0 : intensity,
      };
      onUpdateEffect(updated);
      return;
    }

    onAddEffect({
      ...item,
      intensity: item.id === 'none' ? 0 : intensity,
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

    if (editingClip && onUpdateEffect) {
      onUpdateEffect({
        ...editingClip,
        intensity: val,
      });
    } else {
      const currentPreset = EFFECT_PRESETS.find(
        (p) => p.id === selectedEffectId || p.type === selectedEffectId
      );
      if (currentPreset) {
        onAddEffect({
          ...currentPreset,
          intensity: val,
        });
      }
    }
  };

  const isNone = !selectedEffectId || selectedEffectId === 'none';

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    if (editingClip && onUpdateEffect) {
      onUpdateEffect(editingClip);
    }
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

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
              <Ionicons name="sparkles" size={16} color="#D946EF" />
              <Text style={styles.sheetTitle}>
                {editingClip ? 'Edit Effect' : 'Video Effects'}
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
                            ? '#8E95A5'
                            : isCurrentActive
                            ? '#00F2FE'
                            : '#D946EF'
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
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
  sheetHeader: {
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
  sheetTitle: {
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
  controlsBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#161B26',
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  categoryPillActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  categoryPillText: {
    color: '#8E95A5',
    fontSize: 12,
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
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  intensityPillActive: {
    backgroundColor: '#262D3D',
    borderColor: '#D946EF',
  },
  intensityText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '600',
  },
  intensityTextActive: {
    color: '#D946EF',
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
    borderRadius: 10,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  effectCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1A2234',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E2433',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconBoxActive: {
    backgroundColor: '#00F2FE22',
  },
  iconBoxNone: {
    backgroundColor: '#1E2433',
  },
  effectLabel: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  effectLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
