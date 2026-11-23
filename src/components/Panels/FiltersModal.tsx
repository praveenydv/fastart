import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FILTER_PRESETS, PRESET_PREVIEW_IMAGE } from '../../constants/sampleMedia';
import { CustomLutConfig } from '../../types/project';
import { CompactSliderInput } from '../Common/CompactSliderInput';
import { ModalHeader } from '../Common';
import { PRO_3D_LUTS, parseCubeLut } from '../../utils/lutParser';

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
  { id: 'LUTs', label: '3D LUTs' },
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
};

function FiltersModalComponent({
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
  const [selectedFilterId, setSelectedFilterId] = useState<string>(activeFilter);
  const [selectedLutId, setSelectedLutId] = useState<string>(
    selectedClip?.customLut?.id || ''
  );
  const [importedLuts, setImportedLuts] = useState<CustomLutConfig[]>([]);
  const [filterIntensity, setFilterIntensity] = useState<number>(() => {
    return Math.round((selectedClip?.filterIntensity !== undefined ? selectedClip.filterIntensity : 1.0) * 100);
  });

  // Standardized prefix reference model image for consistent, clear filter previews
  const previewThumb = PRESET_PREVIEW_IMAGE;

  useEffect(() => {
    if (selectedClip?.filterIntensity !== undefined) {
      setFilterIntensity(Math.round(selectedClip.filterIntensity * 100));
    }
    if (selectedClip?.customLut?.id) {
      setSelectedLutId(selectedClip.customLut.id);
    } else {
      setSelectedLutId('');
    }
  }, [selectedClip]);

  useEffect(() => {
    setSelectedFilterId(activeFilter);
  }, [visible, activeFilter]);

  if (!visible) return null;

  const categories = FILTER_CATEGORIES;
  const filterColorMap = FILTER_COLOR_MAP;

  const handleSelectFilter = (presetId: string) => {
    setSelectedLutId('');
    setSelectedFilterId(presetId);
    onSelectFilter(presetId, undefined, isWholeProject, filterIntensity / 100);
  };

  const handleSelectLut = (lut: CustomLutConfig) => {
    setSelectedLutId(lut.id);
    setSelectedFilterId('normal');
    onSelectFilter('normal', lut, isWholeProject, filterIntensity / 100);
  };

  const handleImportCubeFile = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.cube';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          try {
            const textContent = await file.text();
            const parsed = parseCubeLut(textContent, file.name);
            const newLut: CustomLutConfig = {
              id: `lut_${Date.now()}`,
              name: parsed.title,
              cssFilter: parsed.cssFilter,
            };
            setImportedLuts((prev) => [newLut, ...prev]);
            handleSelectLut(newLut);
          } catch (err: any) {
            console.warn('[FiltersModal] Failed to parse .cube LUT:', err);
          }
        }
      };
      input.click();
    }
  };

  const handleResetToNormal = () => {
    setSelectedFilterId('normal');
    setSelectedLutId('');
    onSelectFilter('normal', undefined, isWholeProject, 1.0);
  };

  const isNormal = (!selectedFilterId || selectedFilterId === 'normal') && !selectedLutId;

  const allLuts = [...importedLuts, ...PRO_3D_LUTS];

  const filteredPresets = FILTER_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Panel Header - only shown in standalone modal */}
      {!isInline ? (
        <ModalHeader
          title="Filters"
          iconName="color-filter-outline"
          onClose={onClose}
          onReset={handleResetToNormal}
          resetText="Original"
        />
      ) : null}

      {/* Top Bar: Category Pills */}
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
                  borderColor: '#00F2FE',
                  backgroundColor: '#18181A',
                  flexDirection: 'row',
                  alignItems: 'center',
                },
              ]}
              onPress={handleResetToNormal}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={10} color="#00F2FE" style={{ marginRight: 3 }} />
              <Text
                style={[
                  styles.categoryPillText,
                  { color: '#00F2FE', fontWeight: '600', flexShrink: 0 },
                  Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : null,
                ]}
                numberOfLines={1}
              >
                Original
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
            label="Strength"
            value={filterIntensity}
            min={0}
            max={100}
            step={1}
            unit="%"
            defaultValue={100}
            accentColor="#FFFFFF"
            showSteppers={true}
            onChange={(val) => {
              setFilterIntensity(val);
              if (selectedLutId) {
                const activeLut = allLuts.find((l) => l.id === selectedLutId);
                onSelectFilter('normal', activeLut, isWholeProject, val / 100);
              } else {
                onSelectFilter(selectedFilterId, undefined, isWholeProject, val / 100);
              }
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
        <View style={styles.sectionBlock}>
          <View style={styles.grid}>
            {activeCategory === 'LUTs' ? (
              <>
                {/* 1. Custom .cube file import button */}
                <TouchableOpacity
                  style={[styles.card, { borderColor: 'rgba(255, 255, 255, 0.3)', borderStyle: 'dashed' }]}
                  onPress={handleImportCubeFile}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.faceFrame,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Ionicons name="folder-open-outline" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.metaBox}>
                    <Text style={[styles.filterName, { color: '#FFFFFF' }]} numberOfLines={1}>
                      + Import .cube
                    </Text>
                    <Text style={styles.filterDescText} numberOfLines={1}>
                      Custom 3D LUT
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. List of 3D LUTs */}
                {allLuts.map((lut) => {
                  const isSelected = selectedLutId === lut.id;
                  return (
                    <TouchableOpacity
                      key={lut.id}
                      style={[styles.card, isSelected && styles.cardActive]}
                      onPress={() => handleSelectLut(lut)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.faceFrame}>
                        <View style={styles.splitFilterBox}>
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
                          <View style={styles.splitRightHalf}>
                            <ExpoImage
                              source={{ uri: previewThumb }}
                              style={[
                                styles.splitImgRight,
                                Platform.OS === 'web' && lut.cssFilter
                                  ? ({ filter: lut.cssFilter } as any)
                                  : null,
                              ]}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={120}
                            />
                            <View style={styles.splitBadgeRight}>
                              <Text style={styles.splitBadgeText}>3D LUT</Text>
                            </View>
                          </View>
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
                        >
                          {lut.name}
                        </Text>
                        <Text style={styles.filterDescText} numberOfLines={1}>
                          Pro 3D LUT
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            ) : (
              filteredPresets.map((item) => {
                const isSelected = selectedFilterId === item.id && !selectedLutId;
                const sampleColor = filterColorMap[item.id] || '#475569';
                const isItemNormal = item.id === 'normal';

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.card, isSelected && styles.cardActive]}
                    onPress={() => handleSelectFilter(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.faceFrame}>
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
                          {/* Left Half: Before (Actual Original Face) */}
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

                          {/* Right Half: After (Filtered Face) */}
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
                                  opacity: 0.22,
                                  mixBlendMode: 'color' as any,
                                },
                              ]}
                            />
                            <View style={styles.splitBadgeRight}>
                              <Text style={styles.splitBadgeText}>FILTER</Text>
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
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

export const FiltersModal = React.memo(FiltersModalComponent);
export default FiltersModal;

const styles: any = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121214',
  },
  unifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
    backgroundColor: '#121214',
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#27272A',
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
    backgroundColor: '#121214',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 12 : 4,
    borderTopWidth: 1,
    borderColor: '#1F1F23',
  },
  sheetHandle: {
    width: 28,
    height: 2.5,
    backgroundColor: '#2C2C2E',
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
    borderBottomColor: '#1F1F23',
    backgroundColor: '#121214',
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
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  resetText: {
    color: '#00F2FE',
    fontSize: 9.5,
    fontWeight: '500',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : {}),
  },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
    backgroundColor: '#121214',
  },
  categoryScroll: {
    gap: 4,
    alignItems: 'center',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  categoryPillActive: {
    backgroundColor: '#18181A',
    borderColor: '#00F2FE',
  },
  categoryPillText: {
    color: '#8E8E93',
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
    paddingBottom: 56,
  },
  sectionBlock: {
    marginBottom: 8,
  },
  intensitySliderRow: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#141416',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
    marginBottom: 2,
  },
  sectionHeader: {
    color: '#71717A',
    fontSize: 8.5,
    fontWeight: '400',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  card: {
    width: '23.8%',
    backgroundColor: '#18181A',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 2,
    alignItems: 'center',
  },
  cardActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#18181A',
  },
  faceFrame: {
    height: 48,
    width: '100%',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#141416',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    width: 11,
    height: 11,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  metaBox: {
    paddingHorizontal: 3,
    paddingVertical: 2.5,
    alignItems: 'center',
  },
  filterName: {
    color: '#8E8E93',
    fontSize: 8.5,
    fontWeight: '400',
    textAlign: 'center',
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
    width: '200%',
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  splitImgRight: {
    width: '200%',
    height: '100%',
    position: 'absolute',
    left: '-100%',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
