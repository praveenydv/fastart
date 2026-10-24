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
  onApply?: () => void;
  activeFilter?: string;
  onSelectFilter: (filterId: string, customLut?: CustomLutConfig) => void;
  isInline?: boolean;
}

export default function FiltersModal({
  visible,
  onClose,
  onApply,
  activeFilter = 'normal',
  onSelectFilter,
  isInline = false,
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

  const handleResetToNormal = () => {
    soundEngine.playSfx('click');
    setSelectedLutId('normal');
    onSelectFilter('normal');
  };

  const filteredPresets = FILTER_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    if (activeCategory === '3D_LUTs') return false;
    return item.category === activeCategory;
  });

  const showCustomLuts = activeCategory === 'All' || activeCategory === '3D_LUTs';
  const isNormal = !selectedLutId || selectedLutId === 'normal';

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
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
                onPress={handleResetToNormal}
                style={[styles.resetBtn, isNormal && { opacity: 0.4 }]}
                disabled={isNormal}
                activeOpacity={0.7}
              >
                <Text style={styles.resetText}>Original</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headerTitleRow}>
              <Ionicons name="color-filter-outline" size={16} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Filters & LUTs</Text>
            </View>

            <TouchableOpacity
              onPress={handleApply}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Apply filter"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Top Bar: Category Pills + Import LUT button */}
          <View style={styles.categoryRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.importBtn}
                  onPress={handleImportCubeFile}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cloud-upload-outline" size={13} color="#00F2FE" />
                  <Text style={styles.importBtnText}>+ .cube</Text>
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
          </View>

          {/* Filters Grid */}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
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
                            size={18}
                            color={sampleColor === '#FFFFFF' ? '#000' : '#FFF'}
                          />
                          {isSelected && (
                            <View style={styles.activeCheckBadge}>
                              <Ionicons name="checkmark" size={12} color="#000000" />
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
                <Text style={styles.sectionHeader}>COLOR PRESETS</Text>
                <View style={styles.grid}>
                  {filteredPresets.map((item) => {
                    const isSelected = selectedLutId === item.id;
                    const sampleColor = filterColorMap[item.id] || '#00F2FE';
                    const isItemNormal = item.id === 'normal';

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.card, isSelected && styles.cardActive]}
                        onPress={() => handleSelectStandardPreset(item.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.colorPreview,
                            { backgroundColor: sampleColor },
                            isItemNormal && { borderWidth: 1, borderColor: '#333D52' },
                          ]}
                        >
                          <Ionicons
                            name={isItemNormal ? 'contrast-outline' : 'color-filter-outline'}
                            size={18}
                            color={sampleColor === '#FFFFFF' ? '#000' : '#FFF'}
                          />
                          {isSelected && (
                            <View style={styles.activeCheckBadge}>
                              <Ionicons name="checkmark" size={12} color="#000000" />
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
  categoryRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#27272F',
  },
  categoryScroll: {
    gap: 6,
    alignItems: 'center',
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
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
  sheetBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 20,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  sectionHeader: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: '31%',
    backgroundColor: '#18181C',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  cardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#202026',
  },
  colorPreview: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBox: {
    padding: 6,
  },
  filterName: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  filterNameActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryTag: {
    color: '#71717A',
    fontSize: 9,
    marginTop: 2,
  },
});
