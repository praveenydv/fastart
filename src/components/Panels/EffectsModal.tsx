import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
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
  const [selectedEffectId, setSelectedEffectId] = useState<string>(activeEffect || 'glitch');

  useEffect(() => {
    if (visible) {
      if (editingClip) {
        const effType = editingClip.type || 'glitch';
        setSelectedEffectId(effType);
        setIntensity(editingClip.intensity !== undefined ? editingClip.intensity : 0.8);
        const preset = EFFECT_PRESETS.find((p) => p.type === effType || p.id === effType);
        if (preset && preset.category) {
          setActiveCategory(preset.category);
        }
      } else {
        setSelectedEffectId(activeEffect || 'glitch');
        setIntensity(0.8);
      }
    }
  }, [visible, editingClip, activeEffect]);

  const categories = [
    { id: 'All', label: 'All' },
    { id: 'Glitch', label: 'Glitch' },
    { id: 'Retro', label: 'Retro' },
    { id: 'Motion', label: 'Motion' },
  ];

  const filteredEffects = EFFECT_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });

  const handleSelect = (item: any) => {
    soundEngine.playSfx('pop');
    setSelectedEffectId(item.type || item.id);
    if (editingClip && onUpdateEffect) {
      const updated: EffectClip = {
        ...editingClip,
        type: item.type || item.id,
        name: item.name,
        intensity: item.id === 'none' ? 0 : intensity,
      };
      onUpdateEffect(updated);
      onClose();
      return;
    }
    onAddEffect({
      ...item,
      intensity: item.id === 'none' ? 0 : intensity,
    });
    onClose();
  };

  const handleIntensityChange = (val: number) => {
    soundEngine.playSfx('click');
    setIntensity(val);
    if (editingClip && onUpdateEffect) {
      onUpdateEffect({
        ...editingClip,
        intensity: val,
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>
                {editingClip ? 'Edit Effect' : 'Effects'}
              </Text>
              {editingClip && (
                <Text style={styles.sheetSubtitle}>
                  {editingClip.name || editingClip.type} • {(editingClip.duration || 0).toFixed(1)}s
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {editingClip && (
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.doneBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={15} color="#10B981" />
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Filter Pills */}
          <View style={styles.categoryRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
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
                  >
                    <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Intensity Selector */}
          <View style={styles.intensityRow}>
            <Text style={styles.intensityLabel}>Intensity:</Text>
            <View style={styles.intensityBtns}>
              {[
                { label: 'Mild', val: 0.4 },
                { label: 'Standard', val: 0.8 },
                { label: 'Intense', val: 1.0 },
              ].map((opt) => {
                const isSelected = Math.abs(intensity - opt.val) < 0.05;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.intensityPill, isSelected && styles.intensityPillActive]}
                    onPress={() => handleIntensityChange(opt.val)}
                  >
                    <Text style={[styles.intensityText, isSelected && styles.intensityTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ScrollView style={styles.sheetBody}>
            <View style={styles.grid}>
              {filteredEffects.map((item) => {
                const isCurrentActive =
                  selectedEffectId === item.id ||
                  selectedEffectId === item.type ||
                  activeEffect === item.id ||
                  activeEffect === item.type;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.effectCard, isCurrentActive && styles.effectCardActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, isCurrentActive && styles.iconBoxActive]}>
                      <Ionicons
                        name={(item.icon || 'sparkles-outline') as any}
                        size={24}
                        color={isCurrentActive ? '#00F2FE' : '#D946EF'}
                      />
                    </View>
                    <Text
                      style={[styles.effectLabel, isCurrentActive && styles.effectLabelActive]}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1.5,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  doneBtnText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  categoryScroll: {
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(217, 70, 239, 0.15)',
    borderColor: '#D946EF',
  },
  categoryPillText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#D946EF',
  },
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0B0D13',
  },
  intensityLabel: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  intensityBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  intensityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1E2333',
  },
  intensityPillActive: {
    backgroundColor: '#D946EF',
  },
  intensityText: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '700',
  },
  intensityTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  sheetBody: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  effectCard: {
    width: '30.8%',
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E2333',
  },
  effectCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(217, 70, 239, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconBoxActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
  },
  effectLabel: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  effectLabelActive: {
    color: '#FFFFFF',
  },
});
