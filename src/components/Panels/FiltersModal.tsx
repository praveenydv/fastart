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
import { FILTER_PRESETS, PRESET_PREVIEW_IMAGE } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';
import { parseCubeLut, PRO_3D_LUTS } from '../../utils/lutParser';
import { CustomLutConfig } from '../../types/project';
import { getStorageItem, setStorageItem } from '../../utils/storage';

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  activeFilter?: string;
  onSelectFilter: (filterId: string, customLut?: CustomLutConfig, applyToAll?: boolean) => void;
  isInline?: boolean;
  isWholeProject?: boolean;
  selectedClip?: any;
  project?: any;
}

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

  // Standardized prefix reference model image for consistent, clear filter previews
  const previewThumb = PRESET_PREVIEW_IMAGE;

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

          onSelectFilter(newLut.id, newLut, isWholeProject);
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  const handleSelectStandardPreset = (presetId: string) => {
    soundEngine.playSfx('click');
    setSelectedLutId(presetId);
    onSelectFilter(presetId, undefined, isWholeProject);
  };

  const handleSelectCustomLut = (lut: CustomLutConfig) => {
    soundEngine.playSfx('click');
    setSelectedLutId(lut.id);
    onSelectFilter(lut.id, lut, isWholeProject);
  };

  const handleResetToNormal = () => {
    soundEngine.playSfx('click');
    setSelectedLutId('normal');
    onSelectFilter('normal', undefined, isWholeProject);
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
          <View style={[styles.categoryRow, isInline && { marginTop: 8 }]}>
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
                  <Ionicons name="refresh-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: '#FFFFFF', fontWeight: '700', flexShrink: 0 },
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
                  <Ionicons name="cloud-upload-outline" size={13} color="#FFFFFF" />
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
                              <Image
                                source={{ uri: previewThumb }}
                                style={styles.splitImgLeft}
                                resizeMode="cover"
                              />
                              <View style={styles.splitBadgeLeft}>
                                <Text style={styles.splitBadgeText}>ORIG</Text>
                              </View>
                            </View>

                            {/* Right Half: After (3D LUT Grade) */}
                            <View style={styles.splitRightHalf}>
                              <Image
                                source={{ uri: previewThumb }}
                                style={[
                                  styles.splitImgRight,
                                  Platform.OS === 'web'
                                    ? ({ filter: `contrast(1.22) saturate(1.28) ${lut.id.includes('warm') ? 'sepia(0.35)' : lut.id.includes('cold') ? 'hue-rotate(180deg)' : ''}` } as any)
                                    : null,
                                ]}
                                resizeMode="cover"
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
                              <Ionicons name="checkmark" size={12} color="#000000" />
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
                            <Image
                              source={{ uri: previewThumb }}
                              style={styles.previewImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.splitFilterBox}>
                              {/* Left Half: Before (Original) */}
                              <View style={styles.splitLeftHalf}>
                                <Image
                                  source={{ uri: previewThumb }}
                                  style={styles.splitImgLeft}
                                  resizeMode="cover"
                                />
                                <View style={styles.splitBadgeLeft}>
                                  <Text style={styles.splitBadgeText}>ORIG</Text>
                                </View>
                              </View>

                              {/* Right Half: After (Filtered) */}
                              <View style={styles.splitRightHalf}>
                                <Image
                                  source={{ uri: previewThumb }}
                                  style={[
                                    styles.splitImgRight,
                                    Platform.OS === 'web' && item.css && item.css !== 'none'
                                      ? ({ filter: item.css } as any)
                                      : null,
                                  ]}
                                  resizeMode="cover"
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
                              <Ionicons name="checkmark" size={12} color="#000000" />
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
  unifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
  },
  closeBtnCircle: {
    width: 28,
    height: 28,
    borderRadius: 7,
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
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    borderTopWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: '#1F2637',
    borderRadius: 1.5,
    alignSelf: 'center',
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  resetText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : {}),
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
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
    borderRadius: 7,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  categoryPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : {}),
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 16,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  sectionHeader: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  card: {
    width: '31%',
    backgroundColor: '#131826',
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  cardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  colorPreview: {
    height: 54,
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
    top: 3,
    right: 3,
    backgroundColor: '#FFFFFF',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBox: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  filterName: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterDescText: {
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
    width: 90,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  splitImgRight: {
    width: 90,
    height: '100%',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  splitBadgeLeft: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    zIndex: 3,
  },
  splitBadgeRight: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 242, 254, 0.35)',
    borderWidth: 0.5,
    borderColor: '#00F2FE',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    zIndex: 3,
  },
  splitBadgeText: {
    color: '#FFFFFF',
    fontSize: 6.5,
    fontWeight: '800',
  },
  splitDividerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  splitDividerHandle: {
    width: 5,
    height: 9,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  categoryTag: {
    display: 'none' as any,
  },
});
