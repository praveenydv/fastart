import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FILTER_PRESETS, PRESET_PREVIEW_IMAGE } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';
import { parseCubeLut, PRO_3D_LUTS } from '../../utils/lutParser';
import { CustomLutConfig } from '../../types/project';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { CompactSliderInput } from '../Common/CompactSliderInput';

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  activeFilter?: string;
  onSelectFilter: (filterId: string, customLut?: CustomLutConfig, applyToAll?: boolean, intensity?: number) => void;
  isInline?: boolean;
  isWholeProject?: boolean;
  selectedClip?: any;
  project?: any;
}

const FILTER_CATEGORIES = [
  { id: 'All', label: 'All' },
  { id: '3D_LUTs', label: '3D LUTs' },
  { id: 'Cinematic', label: 'Cinematic' },
  { id: 'Retro', label: 'Vintage' },
  { id: 'Vibrant', label: 'Vibrant' },
];

const FILTER_COLOR_MAP: Record<string, string> = {
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

export default function FiltersModal({
  visible,
  onClose,
  onApply,
  activeFilter = 'normal',
  onSelectFilter,
  isInline = false,
  isWholeProject = false,
  selectedClip,
  project,
}: FiltersModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [customLuts, setCustomLuts] = useState<CustomLutConfig[]>(PRO_3D_LUTS);
  const [selectedLutId, setSelectedLutId] = useState<string>(activeFilter);
  const [filterIntensity, setFilterIntensity] = useState<number>(() => {
    return Math.round((selectedClip?.filterIntensity !== undefined ? selectedClip.filterIntensity : 1.0) * 100);
  });

  // Standardized prefix reference model image for consistent, clear filter previews
  const previewThumb = PRESET_PREVIEW_IMAGE;

  useEffect(() => {
    if (selectedClip?.filterIntensity !== undefined) {
      setFilterIntensity(Math.round(selectedClip.filterIntensity * 100));
    }
  }, [selectedClip]);

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

  if (!visible) return null;

  const categories = FILTER_CATEGORIES;
  const filterColorMap = FILTER_COLOR_MAP;

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

          onSelectFilter(newLut.id, newLut, isWholeProject, filterIntensity / 100);
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  const handleSelectStandardPreset = (presetId: string) => {
    soundEngine.playSfx('click');
    setSelectedLutId(presetId);
    onSelectFilter(presetId, undefined, isWholeProject, filterIntensity / 100);
  };

  const handleSelectCustomLut = (lut: CustomLutConfig) => {
    soundEngine.playSfx('click');
    setSelectedLutId(lut.id);
    onSelectFilter(lut.id, lut, isWholeProject, filterIntensity / 100);
  };

  const handleResetToNormal = () => {
    soundEngine.playSfx('click');
    setSelectedLutId('normal');
    onSelectFilter('normal', undefined, isWholeProject, 1.0);
  };

  const filteredPresets = FILTER_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    if (activeCategory === '3D_LUTs') return false;
    return item.category === activeCategory;
  });

  const showCustomLuts = activeCategory === 'All' || activeCategory === '3D_LUTs';
  const isNormal = !selectedLutId || selectedLutId === 'normal';

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Panel Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.unifiedHeader}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="color-filter-outline" size={16} color="#FFFFFF" />
            <Text style={styles.sheetTitle}>Filters & LUTs</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleResetToNormal}
              style={[
                styles.resetBtn,
                isNormal && { opacity: 0.4 },
              ]}
              disabled={isNormal}
              activeOpacity={0.7}
              accessibilityLabel="Reset to original filter"
            >
              <Ionicons name="refresh-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.resetText} numberOfLines={1}>Original</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtnCircle}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

          {/* Top Bar: Category Pills + Import LUT button */}
          <View style={styles.categoryRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {!isNormal && (
                <TouchableOpacity
                  style={[
                    styles.categoryPill,
                    {
                      borderColor: 'rgba(255, 255, 255, 0.35)',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      flexDirection: 'row',
                      alignItems: 'center',
                    },
                  ]}
                  onPress={handleResetToNormal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: '#FFFFFF', fontWeight: '500', flexShrink: 0 },
                      Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : null,
                    ]}
                    numberOfLines={1}
                  >
                    Original
                  </Text>
                </TouchableOpacity>
              )}
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.importBtn}
                  onPress={handleImportCubeFile}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cloud-upload-outline" size={11} color="#FFFFFF" />
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

          {/* Continuous Filter Strength / Intensity Slider */}
          {!isNormal && (
            <View style={styles.intensitySliderRow}>
              <CompactSliderInput
                label="Filter Strength"
                value={filterIntensity}
                min={0}
                max={100}
                step={1}
                unit="%"
                defaultValue={100}
                accentColor="#00F2FE"
                showSteppers={true}
                onChange={(val) => {
                  setFilterIntensity(val);
                  const activeCustom = customLuts.find((l) => l.id === selectedLutId);
                  onSelectFilter(selectedLutId, activeCustom, isWholeProject, val / 100);
                }}
              />
            </View>
          )}

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
                    const sampleColor = filterColorMap[lut.id] || '#475569';
                    return (
                      <TouchableOpacity
                        key={lut.id}
                        style={[styles.card, isSelected && styles.cardActive]}
                        onPress={() => handleSelectCustomLut(lut)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.colorPreview}>
                          <View style={styles.splitFilterBox}>
                            {/* Left Half: Before (Original) */}
                            <View style={styles.splitLeftHalf}>
                              <ExpoImage
                                source={{ uri: previewThumb }}
                                style={styles.splitImgLeft}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={120}
                              />
                              <View style={styles.splitBadgeLeft}>
                                <Text style={styles.splitBadgeText}>ORIG</Text>
                              </View>
                            </View>

                            {/* Right Half: After (3D LUT Grade) */}
                            <View style={styles.splitRightHalf}>
                              <ExpoImage
                                source={{ uri: previewThumb }}
                                style={[
                                  styles.splitImgRight,
                                  Platform.OS === 'web'
                                    ? ({ filter: `contrast(1.22) saturate(1.28) ${lut.id.includes('warm') ? 'sepia(0.35)' : lut.id.includes('cold') ? 'hue-rotate(180deg)' : ''}` } as any)
                                    : null,
                                ]}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={120}
                              />
                              <View
                                style={[
                                  StyleSheet.absoluteFill,
                                  {
                                    backgroundColor: sampleColor,
                                    opacity: 0.2,
                                    mixBlendMode: 'color' as any,
                                  },
                                ]}
                              />
                              <View style={styles.splitBadgeRight}>
                                <Text style={styles.splitBadgeText}>LUT</Text>
                              </View>
                            </View>

                            {/* Center Split Divider */}
                            <View style={styles.splitDividerLine}>
                              <View style={styles.splitDividerHandle} />
                            </View>
                          </View>
                          {isSelected && (
                            <View style={styles.activeCheckBadge}>
                              <Ionicons name="checkmark" size={9} color="#000000" />
                            </View>
                          )}
                        </View>
                        <View style={styles.metaBox}>
                          <Text
                            style={[styles.filterName, isSelected && styles.filterNameActive]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {lut.name}
                          </Text>
                          <Text style={styles.filterDescText} numberOfLines={1}>
                            Professional 3D Cube Color Grade
                          </Text>
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
                    const sampleColor = filterColorMap[item.id] || '#475569';
                    const isItemNormal = item.id === 'normal';

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.card, isSelected && styles.cardActive]}
                        onPress={() => handleSelectStandardPreset(item.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.colorPreview}>
                          {isItemNormal ? (
                            <ExpoImage
                              source={{ uri: previewThumb }}
                              style={styles.previewImage}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={120}
                            />
                          ) : (
                            <View style={styles.splitFilterBox}>
                              {/* Left Half: Before (Original) */}
                              <View style={styles.splitLeftHalf}>
                                <ExpoImage
                                  source={{ uri: previewThumb }}
                                  style={styles.splitImgLeft}
                                  contentFit="cover"
                                  cachePolicy="memory-disk"
                                  transition={120}
                                />
                                <View style={styles.splitBadgeLeft}>
                                  <Text style={styles.splitBadgeText}>ORIG</Text>
                                </View>
                              </View>

                              {/* Right Half: After (Filtered) */}
                              <View style={styles.splitRightHalf}>
                                <ExpoImage
                                  source={{ uri: previewThumb }}
                                  style={[
                                    styles.splitImgRight,
                                    Platform.OS === 'web' && item.css && item.css !== 'none'
                                      ? ({ filter: item.css } as any)
                                      : null,
                                  ]}
                                  contentFit="cover"
                                  cachePolicy="memory-disk"
                                  transition={120}
                                />
                                <View
                                  style={[
                                    StyleSheet.absoluteFill,
                                    {
                                      backgroundColor: sampleColor,
                                      opacity: 0.18,
                                      mixBlendMode: 'color' as any,
                                    },
                                  ]}
                                />
                                <View style={styles.splitBadgeRight}>
                                  <Text style={styles.splitBadgeText}>FX</Text>
                                </View>
                              </View>

                              {/* Center Split Divider Line */}
                              <View style={styles.splitDividerLine}>
                                <View style={styles.splitDividerHandle} />
                              </View>
                            </View>
                          )}
                          {isSelected && (
                            <View style={styles.activeCheckBadge}>
                              <Ionicons name="checkmark" size={9} color="#000000" />
                            </View>
                          )}
                        </View>
                        <View style={styles.metaBox}>
                          <Text
                            style={[styles.filterName, isSelected && styles.filterNameActive]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.name}
                          </Text>
                          <Text style={styles.filterDescText} numberOfLines={1}>
                            {(item as any).desc || item.category}
                          </Text>
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

  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0F131D',
  },
  unifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
  },
  closeBtnCircle: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 12 : 4,
    borderTopWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 28,
    height: 2.5,
    backgroundColor: '#1F2637',
    borderRadius: 1.5,
    alignSelf: 'center',
    marginTop: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  resetText: {
    color: '#8E95A5',
    fontSize: 9.5,
    fontWeight: '400',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : {}),
  },
  doneBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
  },
  categoryScroll: {
    gap: 4,
    alignItems: 'center',
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  importBtnText: {
    color: '#8E95A5',
    fontSize: 9.5,
    fontWeight: '400',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderColor: 'rgba(0, 242, 254, 0.35)',
  },
  categoryPillText: {
    color: '#8E95A5',
    fontSize: 9.5,
    fontWeight: '400',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : {}),
  },
  categoryPillTextActive: {
    color: '#00F2FE',
    fontWeight: '500',
  },
  sheetBody: {
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  gridContainer: {
    paddingBottom: 8,
  },
  sectionBlock: {
    marginBottom: 8,
  },
  intensitySliderRow: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(0, 242, 254, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 2,
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '500',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  card: {
    width: '23.8%',
    backgroundColor: '#131826',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  cardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  colorPreview: {
    height: 36,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#08090E',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#00F2FE',
    width: 11,
    height: 11,
    borderRadius: 5.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBox: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  filterName: {
    color: '#8E95A5',
    fontSize: 8.5,
    fontWeight: '400',
    textAlign: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? ({
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          width: '100%',
        } as any)
      : {}),
  },
  filterNameActive: {
    color: '#00F2FE',
    fontWeight: '500',
  },
  filterDescText: {
    display: 'none' as any,
  },
  splitFilterBox: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
  },
  splitLeftHalf: {
    width: '50%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  splitRightHalf: {
    width: '50%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  splitImgLeft: {
    width: 55,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  splitImgRight: {
    width: 55,
    height: '100%',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  splitBadgeLeft: {
    position: 'absolute',
    bottom: 1,
    left: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 2,
    paddingVertical: 0.5,
    borderRadius: 2,
    zIndex: 3,
  },
  splitBadgeRight: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    backgroundColor: 'rgba(0, 242, 254, 0.35)',
    borderWidth: 0.5,
    borderColor: '#00F2FE',
    paddingHorizontal: 2,
    paddingVertical: 0.5,
    borderRadius: 2,
    zIndex: 3,
  },
  splitBadgeText: {
    color: '#FFFFFF',
    fontSize: 5.5,
    fontWeight: '500',
  },
  splitDividerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 0.75,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  splitDividerHandle: {
    width: 3,
    height: 6,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  categoryTag: {
    display: 'none' as any,
  },
});
