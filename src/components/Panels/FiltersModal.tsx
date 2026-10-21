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
import { FILTER_PRESETS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';
import { parseCubeLut, PRO_3D_LUTS } from '../../utils/lutParser';
import { CustomLutConfig } from '../../types/project';
import { getStorageItem, setStorageItem } from '../../utils/storage';

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  activeFilter?: string;
  onSelectFilter: (filterId: string, customLut?: CustomLutConfig) => void;
}

export default function FiltersModal({
  visible,
  onClose,
  activeFilter = 'normal',
  onSelectFilter,
}: FiltersModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [customLuts, setCustomLuts] = useState<CustomLutConfig[]>(PRO_3D_LUTS);
  const [selectedLutId, setSelectedLutId] = useState<string>(activeFilter);

  useEffect(() => {
    setSelectedLutId(activeFilter);
    // Load stored user custom LUTs
    const loadStoredLuts = async () => {
      try {
        const stored = await getStorageItem('fastart_custom_luts');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setCustomLuts([...PRO_3D_LUTS, ...parsed]);
          }
        }
      } catch (e) {}
    };
    loadStoredLuts();
  }, [visible, activeFilter]);

  const categories = [
    { id: 'All', label: 'All' },
    { id: '3D_LUTs', label: '3D LUTs' },
    { id: 'Cinematic', label: 'Cinematic' },
    { id: 'Retro', label: 'Vintage' },
    { id: 'Vibrant', label: 'Vibrant' },
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
    lut_kodak_2383: '#D97706',
    lut_fuji_pro400h: '#38BDF8',
    lut_bleach_bypass: '#E2E8F0',
    lut_teal_orange_film: '#00F2FE',
  };

  const handleImportCubeFile = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.cube,.txt';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          const content = evt.target?.result as string;
          if (!content) return;

          const parsed = parseCubeLut(content, file.name);
          const newLut: CustomLutConfig = {
            id: `custom_lut_${Date.now()}`,
            name: parsed.title,
            cssFilter: parsed.cssFilter,
            size: parsed.size,
          };

          const updated = [...customLuts, newLut];
          setCustomLuts(updated);
          setSelectedLutId(newLut.id);
          soundEngine.playSfx('whoosh');

          // Save custom user LUTs to local storage
          try {
            const userOnly = updated.filter(
              (l) => !PRO_3D_LUTS.some((pl) => pl.id === l.id)
            );
            setStorageItem('fastart_custom_luts', JSON.stringify(userOnly));
          } catch (err) {}

          onSelectFilter(newLut.id, newLut);
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  const handleSelectStandardPreset = (presetId: string) => {
    soundEngine.playSfx('click');
    setSelectedLutId(presetId);
    onSelectFilter(presetId);
  };

  const handleSelectCustomLut = (lut: CustomLutConfig) => {
    soundEngine.playSfx('click');
    setSelectedLutId(lut.id);
    onSelectFilter(lut.id, lut);
  };

  const filteredPresets = FILTER_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    if (activeCategory === '3D_LUTs') return false;
    return item.category === activeCategory;
  });

  const showCustomLuts = activeCategory === 'All' || activeCategory === '3D_LUTs';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{"Filters & LUTs"}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Import .cube LUT CTA & Category Filter Pills */}
          <View style={styles.topActionRow}>
            <TouchableOpacity
              style={styles.importBtn}
              onPress={handleImportCubeFile}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload-outline" size={16} color="#000000" />
              <Text style={styles.importBtnText}>+ Import LUT (.cube)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categoryRow}>
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
          </View>

          <ScrollView style={styles.sheetBody}>
            {/* 3D LUTs Section */}
            {showCustomLuts && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeader}>3D LUT FILES (.CUBE)</Text>
                <View style={styles.grid}>
                  {customLuts.map((lut) => {
                    const isSelected = selectedLutId === lut.id;
                    const sampleColor = filterColorMap[lut.id] || '#00F2FE';
                    return (
                      <TouchableOpacity
                        key={lut.id}
                        style={[styles.card, isSelected && styles.cardActive]}
                        onPress={() => handleSelectCustomLut(lut)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.colorPreview, { backgroundColor: sampleColor }]}>
                          <Ionicons
                            name="cube-outline"
                            size={22}
                            color={sampleColor === '#FFFFFF' ? '#000' : '#FFF'}
                          />
                          {isSelected && (
                            <View style={styles.activeCheckBadge}>
                              <Ionicons name="checkmark" size={14} color="#000000" />
                            </View>
                          )}
                        </View>
                        <View style={styles.metaBox}>
                          <Text
                            style={[styles.filterName, isSelected && styles.filterNameActive]}
                            numberOfLines={1}
                          >
                            {lut.name}
                          </Text>
                          <Text style={styles.categoryTag}>3D LUT</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Standard Presets Section */}
            {activeCategory !== '3D_LUTs' && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeader}>CANVAS COLOR PRESETS</Text>
                <View style={styles.grid}>
                  {filteredPresets.map((item) => {
                    const isSelected = selectedLutId === item.id;
                    const sampleColor = filterColorMap[item.id] || '#00F2FE';
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.card, isSelected && styles.cardActive]}
                        onPress={() => handleSelectStandardPreset(item.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.colorPreview, { backgroundColor: sampleColor }]}>
                          <Ionicons
                            name="color-filter-outline"
                            size={20}
                            color={sampleColor === '#FFFFFF' ? '#000' : '#FFF'}
                          />
                          {isSelected && (
                            <View style={styles.activeCheckBadge}>
                              <Ionicons name="checkmark" size={14} color="#000000" />
                            </View>
                          )}
                        </View>
                        <View style={styles.metaBox}>
                          <Text
                            style={[styles.filterName, isSelected && styles.filterNameActive]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text style={styles.categoryTag}>{item.category}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sheetSubtitle: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActionRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00F2FE',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  importBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  categoryRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
    paddingBottom: 10,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E2333',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  categoryPillText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  sheetBody: {
    padding: 16,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  card: {
    width: '31%',
    backgroundColor: '#10131A',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#1E2333',
  },
  cardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  colorPreview: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#00F2FE',
    borderRadius: 8,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBox: {
    padding: 6,
    alignItems: 'center',
  },
  filterName: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterNameActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  categoryTag: {
    color: '#666',
    fontSize: 9,
    marginTop: 2,
  },
});
