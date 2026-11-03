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
    setSelectedFilterId(activeFilter);
  }, [visible, activeFilter]);

  if (!visible) return null;

  const categories = FILTER_CATEGORIES;
  const filterColorMap = FILTER_COLOR_MAP;

  const handleSelectFilter = (presetId: string) => {
    setSelectedFilterId(presetId);
    onSelectFilter(presetId, undefined, isWholeProject, filterIntensity / 100);
  };

  const handleResetToNormal = () => {
    setSelectedFilterId('normal');
    onSelectFilter('normal', undefined, isWholeProject, 1.0);
  };

  const filteredPresets = FILTER_PRESETS.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });

  const isNormal = !selectedFilterId || selectedFilterId === 'normal';

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
              onSelectFilter(selectedFilterId, undefined, isWholeProject, val / 100);
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
            {filteredPresets.map((item) => {
              const isSelected = selectedFilterId === item.id;
              const sampleColor = filterColorMap[item.id] || '#475569';
              const isItemNormal = item.id === 'normal';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.card, isSelected && styles.cardActive]}
                  onPress={() => handleSelectFilter(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.phoneFrame}>
                    <View style={styles.phoneNotch} />
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
                        {/* Left Half: Before (Actual Original) */}
                        <View style={styles.splitLeftHalf}>
                          <ExpoImage
                            source={{ uri: previewThumb }}
                            style={styles.splitImgLeft}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={120}
                          />
                          <View style={styles.splitBadgeLeft}>
                            <Text style={styles.splitBadgeText}>ACTUAL</Text>
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
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

export const FiltersModal = React.memo(FiltersModalComponent);
export default FiltersModal;

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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00F2FE',
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
    paddingBottom: 44,
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
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2637',
    padding: 2,
    alignItems: 'center',
  },
  cardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  phoneFrame: {
    height: 46,
    width: '100%',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#242C3D',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#08090E',
  },
  phoneNotch: {
    position: 'absolute',
    top: 1.5,
    width: 12,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#0F131D',
    zIndex: 10,
    alignSelf: 'center',
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
    color: '#8E95A5',
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
