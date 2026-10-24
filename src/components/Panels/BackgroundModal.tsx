import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { soundEngine } from '../../utils/audioEngine';
import { FastArtProject } from '../../types/project';

interface BackgroundModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  project: FastArtProject | null;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
  isInline?: boolean;
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

  // Find sample active media thumbnail to preview auto blur
  const sampleMediaThumb =
    project.tracks?.video?.[0]?.thumbnail ||
    (project.tracks?.video?.[0]?.type === 'photo'
      ? project.tracks?.video?.[0]?.url
      : null) ||
    'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=400&q=80';

  const handleSelectBg = (bg: string) => {
    soundEngine.playSfx('pop');
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
    soundEngine.playSfx('pop');
    onUpdateProject({ canvasBackground: '#000000' });
    setCustomHexInput('#000000');
  };

  const handlePickCustomImage = async () => {
    soundEngine.playSfx('click');
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

  const isDefault = rawBg === '#000000';

  const sheetContent = (
    <View style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Header (Only for floating modal mode) */}
      {!isInline && (
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerCloseBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close Background"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, isDefault && { opacity: 0.4 }]}
              disabled={isDefault}
              activeOpacity={0.7}
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerTitleRow}>
            <Ionicons name="color-palette-outline" size={16} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Background</Text>
          </View>

          <TouchableOpacity
            onPress={handleApply}
            style={styles.doneBtn}
            activeOpacity={0.7}
            accessibilityLabel="Apply background"
          >
            <Ionicons name="checkmark" size={18} color="#000000" />
          </TouchableOpacity>
        </View>
      )}

          {/* Navigation Tabs: Color, Image, Blur */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'color' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('color');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="color-palette-outline"
                size={14}
                color={activeTab === 'color' ? '#FFFFFF' : '#71717A'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'color' && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                Color
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'image' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('image');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="image-outline"
                size={14}
                color={activeTab === 'image' ? '#FFFFFF' : '#71717A'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'image' && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                Image
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'blur' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('blur');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="water-outline"
                size={14}
                color={activeTab === 'blur' ? '#FFFFFF' : '#71717A'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'blur' && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                Blur
              </Text>
            </TouchableOpacity>
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
                            col.id === '#000000' && { borderWidth: 1, borderColor: '#27272F' },
                          ]}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={15}
                              color={col.id === '#FFFFFF' ? '#000000' : '#FFFFFF'}
                            />
                          )}
                        </View>
                        <Text
                          style={[styles.colorLabel, isSelected && styles.colorLabelActive]}
                          numberOfLines={1}
                        >
                          {col.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Custom Hex Color Picker Input */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Custom Hex Color</Text>
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
                        <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadTitle}>Choose from Photos / Gallery</Text>
                        <Text style={styles.uploadSubtitle}>
                          Select custom picture or wallpaper from device
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#71717A" />
                    </>
                  )}
                </TouchableOpacity>

                {/* Active Custom Image Indicator if user uploaded */}
                {isImage && (
                  <View style={styles.activeCustomImageContainer}>
                    <Image
                      source={{ uri: rawBg.replace('image:', '') }}
                      style={styles.activeCustomImageThumb}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1, paddingLeft: 10 }}>
                      <Text style={styles.activeCustomImageText}>Active Image Background</Text>
                      <Text style={styles.activeCustomImageSub} numberOfLines={1}>
                        {rawBg.replace('image:', '')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleReset}
                      style={styles.removeImageBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Curated Aesthetic Wallpapers */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
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
                        <Image
                          source={{ uri }}
                          style={styles.wallpaperCardImage}
                          resizeMode="cover"
                        />
                        <View style={styles.wallpaperCardOverlay}>
                          <Text style={styles.wallpaperCardTitle} numberOfLines={1}>
                            {wp.name}
                          </Text>
                          {isSelected && (
                            <View style={styles.wallpaperCheckBadge}>
                              <Ionicons name="checkmark" size={12} color="#000000" />
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
                  <Ionicons name="sparkles" size={15} color="#FFFFFF" />
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
                              <Ionicons name="ban-outline" size={20} color="#71717A" />
                            </View>
                          ) : (
                            <Image
                              source={{ uri: sampleMediaThumb }}
                              style={[
                                styles.blurThumbImage,
                                Platform.OS === 'web'
                                  ? ({ filter: `blur(${b.px}px)` } as any)
                                  : null,
                              ]}
                              blurRadius={b.px}
                              resizeMode="cover"
                            />
                          )}
                          {isSelected && (
                            <View style={styles.blurSelectedCheckBadge}>
                              <Ionicons name="checkmark" size={12} color="#000000" />
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
                        <Text style={styles.blurCardDesc}>{b.desc}</Text>
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
      <View style={styles.overlay}>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: Platform.OS === 'web' ? '70%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderColor: '#27272F',
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#18181C',
  },
  headerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#18181C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 11,
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: '#09090B',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#202026',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#18181C',
  },
  tabText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '600',
  },
  contentScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  scrollBody: {
    paddingBottom: 24,
  },
  tabBodySection: {
    flex: 1,
  },
  sectionTitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  colorItem: {
    alignItems: 'center',
    width: 48,
  },
  colorItemActive: {
    transform: [{ scale: 1.05 }],
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorLabel: {
    fontSize: 10,
    color: '#71717A',
    marginTop: 4,
    textAlign: 'center',
  },
  colorLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272F',
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  colorCircleSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  hexInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  uploadCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  uploadIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#202026',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  uploadSubtitle: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  activeCustomImageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272F',
    padding: 8,
    marginTop: 10,
  },
  activeCustomImageThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  activeCustomImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeCustomImageSub: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 1,
  },
  removeImageBtn: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  wallpaperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wallpaperCard: {
    width: '31%',
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#27272F',
    position: 'relative',
  },
  wallpaperCardActive: {
    borderColor: '#FFFFFF',
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wallpaperCardTitle: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    flex: 1,
  },
  wallpaperCheckBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181C',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272F',
    marginBottom: 14,
  },
  blurNoticeText: {
    color: '#A1A1AA',
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  blurLevelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  blurPresetCard: {
    width: '31%',
    backgroundColor: '#18181C',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#27272F',
  },
  blurPresetCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#202026',
  },
  blurThumbnailContainer: {
    width: '100%',
    height: 52,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#09090B',
    marginBottom: 6,
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
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurCardTitle: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  blurCardTitleActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  blurCardDesc: {
    color: '#71717A',
    fontSize: 9,
    marginTop: 1,
  },
});
