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
import { FILTER_PRESETS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  activeFilter?: string;
  onSelectFilter: (filterId: string) => void;
}

export default function FiltersModal({
  visible,
  onClose,
  activeFilter = 'normal',
  onSelectFilter,
}: FiltersModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = [
    { id: 'All', label: 'All LUTs' },
    { id: 'Cinematic', label: 'Cinematic 🎬' },
    { id: 'Retro', label: 'Vintage & B&W 🎞️' },
    { id: 'Vibrant', label: 'Vibrant & Neon ⚡' },
  ];

  const filterColorMap: Record<string, string> = {
    normal: '#8E95A5',
    teal_orange: '#00F2FE',
    cyberpunk: '#D946EF',
    vintage: '#D97706',
    noir: '#FFFFFF',
    warm_sunset: '#F59E0B',
    cold_moody: '#38BDF8',
    emerald: '#10B981',
    vhs_retro: '#E11D48',
    pastel_dream: '#F472B6',
    cinematic_warm: '#FB923C',
    matrix_code: '#22C55E',
    sepia_antique: '#B45309',
    high_contrast: '#60A5FA',
    polaroid_fade: '#CBD5E1',
    solar_pop: '#A855F7',
  };

  const filteredPresets = FILTER_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Color Filters & Cinematic LUTs</Text>
              <Text style={styles.sheetSubtitle}>Hollywood color grading & atmospheric presets</Text>
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

          <ScrollView style={styles.sheetBody}>
            <View style={styles.grid}>
              {filteredPresets.map((item) => {
                const isActive = activeFilter === item.id;
                const accentColor = filterColorMap[item.id] || '#00F2FE';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.filterCard, isActive && styles.filterCardActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onSelectFilter(item.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.colorPreviewCircle,
                        { backgroundColor: `${accentColor}25`, borderColor: accentColor },
                        isActive && styles.circleActive,
                      ]}
                    >
                      <Ionicons
                        name="color-wand"
                        size={22}
                        color={accentColor}
                      />
                    </View>
                    <Text
                      style={[styles.filterLabel, isActive && styles.filterLabelActive]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {isActive && (
                      <View style={styles.activeCheckBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#00F2FE" />
                      </View>
                    )}
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
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  categoryPillText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#00F2FE',
  },
  sheetBody: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterCard: {
    width: '30.8%',
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E2333',
    position: 'relative',
  },
  filterCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  colorPreviewCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
  },
  circleActive: {
    transform: [{ scale: 1.05 }],
  },
  filterLabel: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
});
