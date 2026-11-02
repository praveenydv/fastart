import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { FastArtProject } from '../../types/project';
import { getLivePlayerCanvasSnapshot } from '../../utils/videoRenderer';
import { getMediaThumbnail } from '../../utils/mediaThumbnailGenerator';
import { CustomColorPickerButton } from '../Common/CustomColorPickerButton';

interface BackgroundModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  project: FastArtProject | null;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
  isInline?: boolean;
  currentTime?: number;
  selectedClip?: any;
}

export const BACKGROUND_COLORS = [
  { id: '#000000', name: 'Black' },
  { id: '#121215', name: 'Charcoal' },
  { id: '#1E293B', name: 'Slate' },
  { id: '#FFFFFF', name: 'White' },
  { id: '#00F2FE', name: 'Cyan' },
  { id: '#00FF00', name: 'Green Screen' },
  { id: '#0000FF', name: 'Blue Screen' },
  { id: '#FF0050', name: 'Crimson' },
  { id: '#8B5CF6', name: 'Purple' },
  { id: '#F59E0B', name: 'Amber' },
  { id: '#10B981', name: 'Emerald' },
  { id: '#EC4899', name: 'Pink' },
  { id: '#F97316', name: 'Orange' },
];

export const BLUR_PRESETS = [
  { id: '#000000', name: 'None', desc: 'No Blur', px: 0 },
  { id: 'blur:10', name: 'Soft', desc: '10px Blur', px: 10 },
  { id: 'blur:25', name: 'Medium', desc: '25px Blur', px: 25 },
  { id: 'blur:50', name: 'Deep', desc: '50px Blur', px: 50 },
  { id: 'blur:80', name: 'Intense', desc: '80px Blur', px: 80 },
];

export const WALLPAPER_PRESETS = [
  {
    id: 'image:https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    name: 'Studio Dark',
    desc: 'Deep minimalist studio backdrop',
  },
  {
    id: 'image:https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80',
    name: 'Cyber Glow',
    desc: 'Vibrant neon gradient aura',
  },
  {
    id: 'image:https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80',
    name: 'Bokeh Lights',
    desc: 'Soft blurred city bokeh lights',
  },
  {
    id: 'image:https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80',
    name: 'Minimal Mesh',
    desc: 'Sleek dark gradient mesh',
  },
  {
    id: 'image:https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=800&q=80',
    name: 'Deep Cosmos',
    desc: 'Starlight cosmic dust',
  },
  {
    id: 'image:https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80',
    name: 'Cyber Grid',
    desc: 'Futuristic geometric mesh',
  },
  {
    id: 'image:https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
    name: 'Velvet Paper',
    desc: 'Textured luxury dark paper',
  },
];

function normalizeHex(input: string): string | null {
  const clean = input.replace(/[^0-9A-Fa-f]/g, '');
  if (clean.length === 6) {
    return `#${clean.toUpperCase()}`;
  }
  if (clean.length === 3) {
    return `#${clean.split('').map((c) => c + c).join('').toUpperCase()}`;
  }
  return null;
}

export default function BackgroundModal({
  visible,
  onClose,
  onApply,
  project,
  onUpdateProject,
  isInline = false,
  currentTime,
  selectedClip,
}: BackgroundModalProps) {
  if (!project) return null;

  const rawBg = project.canvasBackground || '#000000';
  const isBlur = rawBg.startsWith('blur:');
  const isImage = rawBg.startsWith('image:');
  const initialTab: 'color' | 'image' | 'blur' = isBlur
    ? 'blur'
    : isImage
    ? 'image'
    : 'color';

  const [activeTab, setActiveTab] = useState<'color' | 'image' | 'blur'>(initialTab);
  const [customHexInput, setCustomHexInput] = useState(
    isBlur || isImage ? '#000000' : rawBg
  );
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isBlur && !isImage) {
      setCustomHexInput(rawBg);
    }
  }, [rawBg, isBlur, isImage]);

  // Live Frame capture from player canvas or active video at currentTime
  const [liveCanvasSnap, setLiveCanvasSnap] = useState<string | null>(() => getLivePlayerCanvasSnapshot());

  useEffect(() => {
    if (!visible) return;
    const snap = getLivePlayerCanvasSnapshot();
    if (snap) {
      setLiveCanvasSnap(snap);
    }
  }, [visible]);

  const currentActiveVideo = React.useMemo(() => {
    if (typeof currentTime === 'number' && project.tracks?.video) {
      const active = project.tracks.video.find(
        (v) => currentTime >= v.startTime && currentTime <= v.startTime + v.duration && !v.cutout?.enabled
      );
      if (active) return active;
    }
    return selectedClip || project.tracks?.video?.[0] || null;
  }, [currentTime, project.tracks?.video, selectedClip]);

  const livePreviewUri = React.useMemo(() => {
    if (liveCanvasSnap) return liveCanvasSnap;
    if (currentActiveVideo) {
      if (currentActiveVideo.type === 'photo' && currentActiveVideo.url) {
        return currentActiveVideo.url;
      }
      return (
        getMediaThumbnail(currentActiveVideo) ||
        currentActiveVideo.thumbnail ||
        currentActiveVideo.url ||
        null
      );
    }
    return null;
  }, [liveCanvasSnap, currentActiveVideo]);

  // Use live frame as primary reference instead of raw/fixed Unsplash fallback
  const sampleMediaThumb =
    livePreviewUri ||
    project.tracks?.video?.find((v) => v.thumbnail)?.thumbnail ||
    project.tracks?.video?.find((v) => v.type === 'photo')?.url ||
    project.tracks?.video?.[0]?.thumbnail ||
    'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=400&q=80';

  const handleSelectBg = (bg: string) => {
    onUpdateProject({ canvasBackground: bg });
  };

  const handleCustomHexChange = (text: string) => {
    setCustomHexInput(text);
    const valid = normalizeHex(text);
    if (valid) {
      onUpdateProject({ canvasBackground: valid });
    }
  };

  const handleReset = () => {
    onUpdateProject({ canvasBackground: '#000000' });
    setCustomHexInput('#000000');
  };

  const handlePickCustomImage = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            setIsUploading(true);
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                onUpdateProject({ canvasBackground: `image:${dataUrl}` });
              }
              setIsUploading(false);
            };
            reader.onerror = () => setIsUploading(false);
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.9,
        });

        if (!result.canceled && result.assets && result.assets[0]?.uri) {
          onUpdateProject({ canvasBackground: `image:${result.assets[0].uri}` });
        }
      }
    } catch {
      setIsUploading(false);
    }
  };

  const isDefault = rawBg === '#000000';

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal to avoid duplicate header on desktop */}
      {!isInline ? (
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="color-palette-outline" size={14} color="#00F2FE" />
            <Text style={styles.headerTitle}>Background</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, isDefault && { opacity: 0.4 }, { paddingHorizontal: 6, height: 22 }]}
              disabled={isDefault}
              activeOpacity={0.7}
              accessibilityLabel="Reset background to default"
            >
              <Ionicons name="refresh-outline" size={11} color="#00F2FE" style={{ marginRight: 2 }} />
              <Text style={[styles.resetText, { fontSize: 9 }]}>Default</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={14} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Navigation Tabs: Color, Image, Blur */}
      <View style={[styles.tabContainer, isInline && { marginTop: 4 }]}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'color' && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab('color');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="color-palette-outline"
                size={12}
                color={activeTab === 'color' ? '#00F2FE' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'color' && { color: '#00F2FE', fontWeight: '500' },
                ]}
              >
                Color
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'image' && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab('image');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="image-outline"
                size={12}
                color={activeTab === 'image' ? '#00F2FE' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'image' && { color: '#00F2FE', fontWeight: '500' },
                ]}
              >
                Image
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'blur' && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab('blur');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="water-outline"
                size={12}
                color={activeTab === 'blur' ? '#00F2FE' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'blur' && { color: '#00F2FE', fontWeight: '500' },
                ]}
              >
                Blur
              </Text>
            </TouchableOpacity>

            {isInline && !isDefault && (
              <TouchableOpacity
                onPress={handleReset}
                style={[styles.tabBtn, { maxWidth: 30, paddingHorizontal: 0 }]}
                activeOpacity={0.8}
                accessibilityLabel="Reset background to default"
              >
                <Ionicons name="refresh-outline" size={12} color="#00F2FE" />
              </TouchableOpacity>
            )}
          </View>

          {/* Tab Content Body */}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. COLOR TAB */}
            {activeTab === 'color' && (
              <View style={styles.tabBodySection}>
                <Text style={styles.sectionTitle}>Solid Colors</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorRow}
                >
                  {BACKGROUND_COLORS.map((col) => {
                    const isSelected =
                      !isBlur &&
                      !isImage &&
                      rawBg.toUpperCase() === col.id.toUpperCase();
                    return (
                      <TouchableOpacity
                        key={col.id}
                        style={[styles.colorItem, isSelected && styles.colorItemActive]}
                        onPress={() => handleSelectBg(col.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.colorCircle,
                            { backgroundColor: col.id },
                            col.id === '#FFFFFF' && { borderWidth: 1, borderColor: '#52525B' },
                            col.id === '#000000' && { borderWidth: 1, borderColor: '#1F2637' },
                          ]}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={11}
                              color={col.id === '#FFFFFF' ? '#000000' : '#FFFFFF'}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Custom Color Palette Button */}
                  <View style={[styles.colorItem, { justifyContent: 'center', alignItems: 'center' }]}>
                    <CustomColorPickerButton
                      value={rawBg}
                      presets={BACKGROUND_COLORS}
                      onColorChange={(color) => {
                        handleSelectBg(color);
                        setCustomHexInput(color.toUpperCase());
                      }}
                      size={22}
                      shape="circle"
                      accessibilityLabel="Pick custom background color"
                    />
                  </View>
                </ScrollView>

                {/* Custom Hex Color Picker Input */}
                <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Custom Hex Color</Text>
                <View style={styles.hexInputRow}>
                  <View
                    style={[
                      styles.colorCircleSmall,
                      { backgroundColor: normalizeHex(customHexInput) || '#000000' },
                    ]}
                  />
                  <TextInput
                    style={styles.hexInput}
                    value={customHexInput}
                    onChangeText={handleCustomHexChange}
                    placeholder="#000000"
                    placeholderTextColor="#71717A"
                    maxLength={7}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            )}

            {/* 2. IMAGE TAB */}
            {activeTab === 'image' && (
              <View style={styles.tabBodySection}>
                {/* Upload from Gallery Button */}
                <Text style={styles.sectionTitle}>Upload Background Image</Text>
                <TouchableOpacity
                  style={styles.uploadCardBtn}
                  onPress={handlePickCustomImage}
                  disabled={isUploading}
                  activeOpacity={0.8}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="cloud-upload-outline" size={15} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadTitle}>Choose from Photos / Gallery</Text>
                        <Text style={styles.uploadSubtitle}>
                          Select custom picture or wallpaper from device
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="#71717A" />
                    </>
                  )}
                </TouchableOpacity>

                {/* Active Custom Image Indicator if user uploaded */}
                {isImage && (
                  <View style={styles.activeCustomImageContainer}>
                    <ExpoImage
                      source={{ uri: rawBg.replace('image:', '') }}
                      style={styles.activeCustomImageThumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                    />
                    <View style={{ flex: 1, paddingLeft: 8 }}>
                      <Text style={styles.activeCustomImageText}>Active Image Background</Text>
                      <Text style={styles.activeCustomImageSub} numberOfLines={1}>
                        {rawBg.replace('image:', '')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleReset}
                      style={styles.removeImageBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Live Canvas / Video Frame Option */}
                {livePreviewUri ? (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
                      Live Canvas / Video Frame
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.liveFrameCard,
                        rawBg === `image:${livePreviewUri}` && styles.liveFrameCardActive,
                      ]}
                      onPress={() => handleSelectBg(`image:${livePreviewUri}`)}
                      activeOpacity={0.8}
                    >
                      <ExpoImage
                        source={{ uri: livePreviewUri }}
                        style={styles.liveFrameThumb}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={120}
                      />
                      <View style={{ flex: 1, paddingLeft: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveFrameTitle}>Use Current Live Frame</Text>
                        </View>
                        <Text style={styles.liveFrameSubtitle}>
                          Fill canvas background from the live frame shown on screen
                        </Text>
                      </View>
                      {rawBg === `image:${livePreviewUri}` ? (
                        <View style={styles.liveSelectedBadge}>
                          <Ionicons name="checkmark" size={9} color="#000000" />
                        </View>
                      ) : (
                        <Ionicons name="add-circle-outline" size={16} color="#00F2FE" />
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}

                {/* Curated Aesthetic Wallpapers */}
                <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
                  Curated Studio Wallpapers
                </Text>
                <View style={styles.wallpaperGrid}>
                  {WALLPAPER_PRESETS.map((wp) => {
                    const isSelected = rawBg === wp.id;
                    const uri = wp.id.replace('image:', '');
                    return (
                      <TouchableOpacity
                        key={wp.id}
                        style={[
                          styles.wallpaperCard,
                          isSelected && styles.wallpaperCardActive,
                        ]}
                        onPress={() => handleSelectBg(wp.id)}
                        activeOpacity={0.8}
                      >
                        <ExpoImage
                          source={{ uri }}
                          style={styles.wallpaperCardImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={120}
                        />
                        <View style={styles.wallpaperCardOverlay}>
                          <Text style={styles.wallpaperCardTitle} numberOfLines={1}>
                            {wp.name}
                          </Text>
                          {isSelected && (
                            <View style={styles.wallpaperCheckBadge}>
                              <Ionicons name="checkmark" size={8} color="#000000" />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 3. BLUR TAB ("Auto from video / image blur") */}
            {activeTab === 'blur' && (
              <View style={styles.tabBodySection}>
                <View style={styles.blurNoticeBanner}>
                  <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                  <Text style={styles.blurNoticeText}>
                    Auto-generates synchronized dynamic blur behind video frames for aesthetic letterbox/pillarbox filling.
                  </Text>
                </View>

                {/* Blur Level Selection Cards */}
                <Text style={styles.sectionTitle}>Blur Intensity</Text>
                <View style={styles.blurLevelsGrid}>
                  {BLUR_PRESETS.map((b) => {
                    const isSelected =
                      b.px === 0 ? !isBlur && !isImage : rawBg === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          styles.blurPresetCard,
                          isSelected && styles.blurPresetCardActive,
                        ]}
                        onPress={() => handleSelectBg(b.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.blurThumbnailContainer}>
                          {b.px === 0 ? (
                            <View style={styles.blurNoneBox}>
                              <Ionicons name="ban-outline" size={15} color="#71717A" />
                            </View>
                          ) : (
                            <ExpoImage
                              source={{ uri: sampleMediaThumb }}
                              style={[
                                styles.blurThumbImage,
                                Platform.OS === 'web'
                                  ? ({ filter: `blur(${b.px}px)` } as any)
                                  : null,
                              ]}
                              blurRadius={b.px}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={120}
                            />
                          )}
                          {isSelected && (
                            <View style={styles.blurSelectedCheckBadge}>
                              <Ionicons name="checkmark" size={8} color="#000000" />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.blurCardTitle,
                            isSelected && styles.blurCardTitleActive,
                          ]}
                        >
                          {b.name}
                        </Text>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: Platform.OS === 'web' ? '70%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  headerCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#131826',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '500',
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '400',
  },
  doneBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: '#08090E',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1F2637',
    height: 26,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 4,
  },
  tabBtnActive: {
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  tabText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '400',
  },
  contentScroll: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  scrollBody: {
    paddingBottom: 16,
  },
  tabBodySection: {
    flex: 1,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 2,
  },
  colorItem: {
    alignItems: 'center',
    width: 26,
  },
  colorItemActive: {
    transform: [{ scale: 1.05 }],
  },
  colorCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorLabel: {
    fontSize: 7.5,
    color: '#64748B',
    marginTop: 1,
    textAlign: 'center',
    fontWeight: '400',
  },
  colorLabelActive: {
    color: '#00F2FE',
    fontWeight: '500',
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1F2637',
    paddingHorizontal: 6,
    height: 26,
    gap: 6,
  },
  colorCircleSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  hexInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '400',
  },
  uploadCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 6,
    gap: 6,
  },
  uploadIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1B2234',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '500',
  },
  uploadSubtitle: {
    color: '#64748B',
    fontSize: 8.5,
    marginTop: 1,
  },
  activeCustomImageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
    padding: 5,
    marginTop: 6,
  },
  liveFrameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
    marginTop: 4,
    marginBottom: 4,
  },
  liveFrameCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  liveFrameThumb: {
    width: 48,
    height: 34,
    borderRadius: 4,
    backgroundColor: '#08090E',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00F2FE',
  },
  liveFrameTitle: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '500',
  },
  liveFrameSubtitle: {
    color: '#94A3B8',
    fontSize: 8.5,
    marginTop: 1,
  },
  liveSelectedBadge: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCustomImageThumb: {
    width: 30,
    height: 30,
    borderRadius: 4,
  },
  activeCustomImageText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '500',
  },
  activeCustomImageSub: {
    color: '#64748B',
    fontSize: 8,
    marginTop: 1,
  },
  removeImageBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  wallpaperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  wallpaperCard: {
    width: '23.5%',
    height: 46,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2637',
    position: 'relative',
  },
  wallpaperCardActive: {
    borderColor: '#00F2FE',
  },
  wallpaperCardImage: {
    width: '100%',
    height: '100%',
  },
  wallpaperCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wallpaperCardTitle: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '400',
    flex: 1,
  },
  wallpaperCheckBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#131826',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
    marginBottom: 6,
  },
  blurNoticeText: {
    color: '#94A3B8',
    fontSize: 9.5,
    flex: 1,
    lineHeight: 12,
  },
  blurLevelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  blurPresetCard: {
    width: '23.5%',
    backgroundColor: '#131826',
    borderRadius: 5,
    padding: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  blurPresetCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  blurThumbnailContainer: {
    width: '100%',
    height: 34,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#08090E',
    marginBottom: 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurThumbImage: {
    width: '100%',
    height: '100%',
  },
  blurNoneBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurSelectedCheckBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurCardTitle: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '400',
  },
  blurCardTitleActive: {
    color: '#00F2FE',
    fontWeight: '500',
  },
  blurCardDesc: {
    color: '#64748B',
    fontSize: 7.5,
    marginTop: 1,
  },
  inlineApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  inlineAppliedBtn: {
    backgroundColor: '#10B981',
  },
  inlineApplyText: {
    color: '#08090E',
    fontSize: 9.5,
    fontWeight: '500',
  },
});
