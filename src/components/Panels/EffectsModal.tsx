import React, { useState } from 'react';
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

interface EffectsModalProps {
  visible: boolean;
  onClose: () => void;
  activeEffect?: string;
  onAddEffect: (effect: any) => void;
}

export default function EffectsModal({
  visible,
  onClose,
  activeEffect,
  onAddEffect,
}: EffectsModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [intensity, setIntensity] = useState<number>(0.8);

  const categories = [
    { id: 'All', label: 'All Effects' },
    { id: 'Glitch', label: 'Glitch & Cyber' },
    { id: 'Retro', label: 'Retro & Film' },
    { id: 'Motion', label: 'Motion & Zoom' },
  ];

  const filteredEffects = EFFECT_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });

  const handleSelect = (item: any) => {
    soundEngine.playSfx('pop');
    onAddEffect({
      ...item,
      intensity: item.id === 'none' ? 0 : intensity,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Video Effects & Shaders</Text>
              <Text style={styles.sheetSubtitle}>Real-time GPU visual effects & distortions</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
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
            <Text style={styles.intensityLabel}>EFFECT INTENSITY:</Text>
            <View style={styles.intensityBtns}>
              {[
                { label: 'Mild', val: 0.4 },
                { label: 'Standard', val: 0.8 },
                { label: 'Intense', val: 1.0 },
              ].map((opt) => {
                const isSelected = intensity === opt.val;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.intensityPill, isSelected && styles.intensityPillActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setIntensity(opt.val);
                    }}
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
                const isActive = activeEffect === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.effectCard, isActive && styles.effectCardActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                      <Ionicons
                        name={(item.icon || 'sparkles-outline') as any}
                        size={24}
                        color={isActive ? '#00F2FE' : '#D946EF'}
                      />
                    </View>
                    <Text
                      style={[styles.effectLabel, isActive && styles.effectLabelActive]}
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
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
