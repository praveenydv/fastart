import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { FastArtProject, AudioClip } from '../../types/project';
import { persistLargeMedia } from '../../utils/largeMediaStorage';
import { addNotification } from '../../utils/storage';
import { THEME_COLORS } from '../../constants/designConstants';

export type DesktopResourceTab = 'media' | 'audio';

export interface DesktopMediaAudioPanelProps {
  project: FastArtProject;
  activeTab: DesktopResourceTab;
  onSelectTab: (tab: DesktopResourceTab) => void;
  onAddMedia: (clip: any) => void;
  onAddAudio: (clip: AudioClip) => void;
  onAddText?: (text: string, color?: string) => void;
  onAddSticker?: (sticker: string) => void;
  onAddEffect?: (effectName: string) => void;
  onAddTransition?: (transitionId: string) => void;
  currentTime: number;
  onDeleteMedia?: (clipId: string, clipType?: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  position?: 'left' | 'right';
  onSwapPosition?: () => void;
  style?: any;
}

// Royalty-free BGM and SFX presets
const AUDIO_PRESETS = [
  { id: 'bgm-1', title: 'Upbeat Vlog Beat', duration: 18.5, category: 'Music', tone: 'Energetic' },
  { id: 'bgm-2', title: 'Cinematic Ambient', duration: 24.0, category: 'Music', tone: 'Epic' },
  { id: 'bgm-3', title: 'Chill Lo-Fi Sunset', duration: 20.0, category: 'Music', tone: 'Relaxed' },
  { id: 'bgm-4', title: 'Cyberpunk Synth', duration: 16.0, category: 'Music', tone: 'Modern' },
  { id: 'sfx-1', title: 'Smooth Whoosh Transition', duration: 1.2, category: 'SFX', tone: 'Air' },
  { id: 'sfx-2', title: 'Deep Impact Hit', duration: 1.8, category: 'SFX', tone: 'Bass' },
  { id: 'sfx-3', title: 'Camera Shutter Snap', duration: 0.8, category: 'SFX', tone: 'Mechanical' },
  { id: 'sfx-4', title: 'Digital Pop & Click', duration: 0.5, category: 'SFX', tone: 'Minimal' },
];

// CapCut style text title templates
const TEXT_TEMPLATES = [
  { id: 'text-default', title: 'Default Text', text: 'Add Headline', color: '#FFFFFF', bg: '#1E2024' },
  { id: 'text-cyan', title: 'Cyan Neon', text: 'GLOW UP', color: '#00E5C9', bg: '#082928' },
  { id: 'text-gold', title: 'Cinematic Gold', text: 'CHAPTER ONE', color: '#F59E0B', bg: '#291F09' },
  { id: 'text-bold-red', title: 'Bold Red', text: 'DON’T MISS', color: '#EF4444', bg: '#2B0E0E' },
  { id: 'text-purple', title: 'Vlog Daily', text: 'Daily Vlog', color: '#A855F7', bg: '#250E36' },
  { id: 'text-subtitle', title: 'Clean Subtitle', text: 'Subtitle text goes here', color: '#E2E8F0', bg: '#1B2230' },
];

// Curated stickers/emojis
const STICKER_CATEGORIES = [
  { name: 'Trending', items: ['🔥', '✨', '⚡', '💯', '❤️', '🎉', '🚀', '🌟'] },
  { name: 'Reactions', items: ['😂', '😍', '🤯', '😎', '👏', '🙌', '👀', '🤫'] },
  { name: 'Vlog & Social', items: ['🔔', '👍', '📌', '🎬', '📸', '🎵', '💡', '🏆'] },
];

// Video effect presets
const EFFECT_TEMPLATES = [
  { id: 'glow', label: 'Cyan Glow', desc: 'Futuristic neon radiance', icon: 'sunny-outline' },
  { id: 'vintage', label: 'Vintage Film', desc: 'Classic 35mm warmth & grain', icon: 'film-outline' },
  { id: 'vhs', label: 'VHS Glitch', desc: 'Retro 80s tape distortion', icon: 'tv-outline' },
  { id: 'blur', label: 'Soft Blur', desc: 'Atmospheric depth of field', icon: 'water-outline' },
  { id: 'zoom', label: 'Pulse Zoom', desc: 'Rhythmic bass impact scale', icon: 'contract-outline' },
  { id: 'rgb', label: 'RGB Split', desc: 'Chromatic aberration twitch', icon: 'color-filter-outline' },
  { id: 'bw', label: 'Noir B&W', desc: 'High contrast monochrome', icon: 'contrast-outline' },
];

// Video transition presets
const TRANSITION_TEMPLATES = [
  { id: 'dissolve', label: 'Dissolve', desc: 'Smooth cross-fade', icon: 'git-merge-outline' },
  { id: 'fade-black', label: 'Fade to Black', desc: 'Cinematic dip to dark', icon: 'moon-outline' },
  { id: 'slide-left', label: 'Slide Left', desc: 'Horizontal wipe left', icon: 'arrow-forward-outline' },
  { id: 'slide-right', label: 'Slide Right', desc: 'Horizontal wipe right', icon: 'arrow-back-outline' },
  { id: 'zoom-in', label: 'Zoom In', desc: 'Dynamic scale punch through', icon: 'expand-outline' },
  { id: 'whip-pan', label: 'Whip Pan', desc: 'Fast directional motion blur', icon: 'swap-horizontal-outline' },
];

export const DesktopMediaAudioPanel: React.FC<DesktopMediaAudioPanelProps> = ({
  project,
  activeTab,
  onSelectTab,
  onAddMedia,
  onAddAudio,
  onAddText,
  onAddSticker,
  onAddEffect,
  onAddTransition,
  currentTime,
  onDeleteMedia,
  isCollapsed = false,
  onToggleCollapse,
  width,
  position = 'left',
  onSwapPosition,
  style,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);

  // Handle local device file upload (video / photo)
  const handleDeviceUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,image/*';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            setIsLoading(true);
            try {
              const isVideo = file.type.startsWith('video');
              const mediaId = 'clip-' + Date.now();
              const title = file.name.replace(/\.[^/.]+$/, '');

              const saved = await persistLargeMedia(file, mediaId, title, isVideo ? 'video' : 'photo');

              const clip = {
                id: mediaId,
                sourceMediaId: mediaId,
                title,
                type: isVideo ? 'video' : 'photo',
                url: saved.url,
                thumbnail: saved.thumbnail,
                duration: saved.duration || (isVideo ? 5.0 : 3.0),
                startTime: currentTime || 0,
                trimIn: 0,
                trimOut: saved.duration || (isVideo ? 5.0 : 3.0),
                mediaDuration: isVideo ? saved.duration : undefined,
                speed: 1.0,
                volume: 1.0,
                filter: 'normal',
                effect: 'none',
                transform: { scale: 1, rotation: 0, x: 0, y: 0 },
              };

              soundEngine.playSfx('pop');
              onAddMedia(clip);
              addNotification({
                title: isVideo ? 'Video Imported' : 'Photo Imported',
                message: `Added "${title}" to project at ${currentTime.toFixed(1)}s`,
                type: 'success',
              });
            } catch (err: any) {
              console.error('Failed to import media file:', err);
              addNotification({
                title: 'Import Failed',
                message: err?.message || 'Could not load media file',
                type: 'error',
              });
            } finally {
              setIsLoading(false);
            }
          }
        };
        input.click();
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  // Handle local device audio file upload
  const handleDeviceAudioUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            setIsLoading(true);
            try {
              const audioId = 'audio-' + Date.now();
              const title = file.name.replace(/\.[^/.]+$/, '');
              const url = URL.createObjectURL(file);

              const clip: AudioClip = {
                id: audioId,
                title,
                url,
                duration: 10.0,
                startTime: currentTime || 0,
                trackIndex: 1,
                volume: 1.0,
                fadeIn: 0,
                fadeOut: 0,
              };

              soundEngine.playSfx('pop');
              onAddAudio(clip);
              addNotification({
                title: 'Audio Imported',
                message: `Added "${title}" to project at ${currentTime.toFixed(1)}s`,
                type: 'success',
              });
            } catch (err: any) {
              console.error('Failed to import audio:', err);
            } finally {
              setIsLoading(false);
            }
          }
        };
        input.click();
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  // Add preset audio directly to timeline
  const handleAddPresetAudio = (preset: typeof AUDIO_PRESETS[0]) => {
    soundEngine.playSfx('pop');
    const clip: AudioClip = {
      id: `audio-${Date.now()}`,
      title: preset.title,
      duration: preset.duration || 10.0,
      startTime: currentTime || 0,
      trackIndex: 1,
      volume: 1.0,
      url: 'https://actions.google.com/sounds/v1/ambiences/outdoor_ambience.ogg',
    };
    onAddAudio(clip);
    addNotification({
      title: 'Audio Added',
      message: `Added "${preset.title}" at ${currentTime.toFixed(1)}s`,
      type: 'success',
    });
  };

  const videoClips = project.tracks?.video || [];
  const audioClips = project.tracks?.audio || [];

  if (isCollapsed) {
    return (
      <View
        style={[
          styles.collapsedBar,
          position === 'right'
            ? { borderLeftWidth: 1, borderLeftColor: THEME_COLORS.borderSubtle, borderRightWidth: 0 }
            : {},
        ]}
      >
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={onToggleCollapse}
          activeOpacity={0.7}
          accessibilityLabel="Expand media panel"
        >
          <Ionicons
            name={position === 'right' ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={THEME_COLORS.accent}
          />
        </TouchableOpacity>
      </View>
    );
  }

  const effectiveTab: DesktopResourceTab = activeTab === 'audio' ? 'audio' : 'media';

  const tabs: { id: DesktopResourceTab; label: string; icon: any }[] = [
    { id: 'media', label: 'Video', icon: 'videocam-outline' },
    { id: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
  ];

  return (
    <View
      style={[
        styles.panelContainer,
        width !== undefined && { width },
        position === 'right'
          ? { borderLeftWidth: 1, borderLeftColor: THEME_COLORS.borderSubtle, borderRightWidth: 0 }
          : {},
        style,
      ]}
    >
      {/* Top Tab Bar: CapCut categories */}
      <View style={styles.topTabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollView}
          contentContainerStyle={styles.tabButtonsRow}
        >
          {tabs.map((tab) => {
            const isActive = effectiveTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onSelectTab(tab.id);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon}
                  size={12}
                  color={isActive ? THEME_COLORS.accent : THEME_COLORS.textMuted}
                />
                <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.tabActionsRow}>
          {onSwapPosition && (
            <TouchableOpacity
              style={styles.collapseToggleBtn}
              onPress={onSwapPosition}
              activeOpacity={0.7}
              accessibilityLabel="Swap panels side"
            >
              <Ionicons name="swap-horizontal" size={13} color="#8E95A5" />
            </TouchableOpacity>
          )}

          {onToggleCollapse && (
            <TouchableOpacity
              style={styles.collapseToggleBtn}
              onPress={onToggleCollapse}
              activeOpacity={0.7}
              accessibilityLabel="Collapse media panel"
            >
              <Ionicons
                name={position === 'right' ? 'chevron-forward' : 'chevron-back'}
                size={14}
                color="#8E95A5"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─────────────────────────────────────────────
          1. MEDIA TAB BODY
          ───────────────────────────────────────────── */}
      {effectiveTab === 'media' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Action: Import Device Media */}
          <TouchableOpacity
            style={styles.importMediaBtn}
            onPress={handleDeviceUpload}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={THEME_COLORS.accent} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={15} color={THEME_COLORS.accent} />
                <Text style={styles.importBtnTitle}>+ Import Video / Photo</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Section: Project Assets */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>PROJECT ASSETS</Text>
            <Text style={styles.sectionCount}>{videoClips.length} items</Text>
          </View>

          {videoClips.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Ionicons name="film-outline" size={28} color={THEME_COLORS.textMuted} />
              <Text style={styles.emptyStateText}>No media clips uploaded yet</Text>
              <Text style={styles.emptyStateSubtext}>Click Import above to add video or photo</Text>
            </View>
          ) : (
            <View style={styles.mediaGrid}>
              {videoClips.map((clip, idx) => (
                <View
                  key={clip.id || idx}
                  style={[styles.mediaCard, Platform.OS === 'web' && ({ cursor: 'grab' } as any)]}
                  {...(Platform.OS === 'web'
                    ? {
                        draggable: true,
                        onDragStart: (e: any) => {
                          const payload = {
                            type: 'media',
                            clip: {
                              ...clip,
                              id: `clip-${Date.now()}`,
                              duration: clip.duration || 4.0,
                            },
                          };
                          e.dataTransfer.setData('application/fastart-clip', JSON.stringify(payload));
                          e.dataTransfer.effectAllowed = 'copy';
                        },
                      }
                    : {})}
                >
                  <View style={styles.thumbnailBox}>
                    {clip.thumbnail ? (
                      <Image source={{ uri: clip.thumbnail }} style={styles.thumbnailImg} />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <Ionicons
                          name={clip.type === 'photo' ? 'image-outline' : 'videocam-outline'}
                          size={18}
                          color={THEME_COLORS.accent}
                        />
                      </View>
                    )}
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationBadgeText}>
                        {clip.duration ? `${clip.duration.toFixed(1)}s` : '0.0s'}
                      </Text>
                    </View>

                    {/* Corner Delete Button on Thumbnail */}
                    {onDeleteMedia && (
                      <TouchableOpacity
                        style={styles.cardDeleteCornerBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          soundEngine.playSfx('cut');
                          onDeleteMedia(clip.id, clip.type || 'video');
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Delete imported clip"
                      >
                        <Ionicons name="trash-outline" size={11} color="#FF6B6B" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.mediaCardInfo}>
                    <Text style={styles.mediaCardTitle} numberOfLines={1}>
                      {clip.title || `Clip ${idx + 1}`}
                    </Text>
                    <View style={styles.mediaCardMetaRow}>
                      <Text style={styles.mediaTypeTag}>
                        {clip.type === 'photo' ? 'PHOTO' : 'VIDEO'}
                      </Text>
                      <View style={styles.mediaCardActions}>
                        {onDeleteMedia && (
                          <TouchableOpacity
                            style={styles.deleteDirectBtn}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              soundEngine.playSfx('cut');
                              onDeleteMedia(clip.id, clip.type || 'video');
                            }}
                            activeOpacity={0.7}
                            accessibilityLabel="Delete imported clip"
                          >
                            <Ionicons name="trash-outline" size={12} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.addDirectBtn}
                          onPress={() => {
                            soundEngine.playSfx('pop');
                            onAddMedia({
                              ...clip,
                              id: `clip-copy-${Date.now()}`,
                              startTime: currentTime,
                            });
                          }}
                          activeOpacity={0.7}
                          accessibilityLabel="Add to timeline"
                        >
                          <Ionicons name="add" size={14} color="#000000" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────
          2. AUDIO TAB BODY
          ───────────────────────────────────────────── */}
      {effectiveTab === 'audio' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Action: Import Device Audio */}
          <TouchableOpacity
            style={styles.importMediaBtn}
            onPress={handleDeviceAudioUpload}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={THEME_COLORS.accent} />
            ) : (
              <>
                <Ionicons name="musical-note-outline" size={15} color={THEME_COLORS.accent} />
                <Text style={styles.importBtnTitle}>+ Import Audio</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Section: Project Imported Audio */}
          {audioClips.length > 0 && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>IMPORTED AUDIO</Text>
                <Text style={styles.sectionCount}>{audioClips.length} tracks</Text>
              </View>

              {audioClips.map((audioClip, idx) => {
                const isPlaying = playingPreviewId === audioClip.id;
                return (
                  <View
                    key={audioClip.id || idx}
                    style={[styles.presetAudioCard, Platform.OS === 'web' && ({ cursor: 'grab' } as any)]}
                  >
                    <TouchableOpacity
                      style={[styles.previewPlayCircle, isPlaying && styles.previewPlayCircleActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setPlayingPreviewId(isPlaying ? null : audioClip.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={11}
                        color={isPlaying ? '#000000' : THEME_COLORS.accent}
                      />
                    </TouchableOpacity>

                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                      <Text style={styles.presetTitle} numberOfLines={1}>
                        {audioClip.title || `Audio ${idx + 1}`}
                      </Text>
                      <Text style={styles.presetMeta}>
                        Imported • {audioClip.duration ? `${audioClip.duration.toFixed(1)}s` : '10.0s'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {onDeleteMedia && (
                        <TouchableOpacity
                          style={styles.deleteDirectBtn}
                          onPress={() => {
                            soundEngine.playSfx('cut');
                            onDeleteMedia(audioClip.id, 'audio');
                          }}
                          activeOpacity={0.7}
                          accessibilityLabel="Delete imported audio"
                        >
                          <Ionicons name="trash-outline" size={12} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.addDirectBtn}
                        onPress={() => {
                          soundEngine.playSfx('pop');
                          onAddAudio({
                            ...audioClip,
                            id: `audio-copy-${Date.now()}`,
                            startTime: currentTime || 0,
                          });
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Add to timeline"
                      >
                        <Ionicons name="add" size={14} color="#000000" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>SOUNDTRACKS & SFX</Text>
            <Text style={styles.sectionCount}>{AUDIO_PRESETS.length} tracks</Text>
          </View>

          {AUDIO_PRESETS.map((preset) => {
            const isPlaying = playingPreviewId === preset.id;
            return (
              <View
                key={preset.id}
                style={[styles.presetAudioCard, Platform.OS === 'web' && ({ cursor: 'grab' } as any)]}
                {...(Platform.OS === 'web'
                  ? {
                      draggable: true,
                      onDragStart: (e: any) => {
                        const payload = {
                          type: 'audio',
                          clip: {
                            id: `audio-${Date.now()}`,
                            title: preset.title,
                            duration: preset.duration || 10.0,
                            startTime: 0,
                            trackIndex: 1,
                            volume: 1.0,
                            url: 'https://actions.google.com/sounds/v1/ambiences/outdoor_ambience.ogg',
                          },
                        };
                        e.dataTransfer.setData('application/fastart-clip', JSON.stringify(payload));
                        e.dataTransfer.effectAllowed = 'copy';
                      },
                    }
                  : {})}
              >
                <TouchableOpacity
                  style={[styles.previewPlayCircle, isPlaying && styles.previewPlayCircleActive]}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    setPlayingPreviewId(isPlaying ? null : preset.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={11}
                    color={isPlaying ? '#000000' : THEME_COLORS.accent}
                  />
                </TouchableOpacity>

                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <Text style={styles.presetTitle} numberOfLines={1}>
                    {preset.title}
                  </Text>
                  <Text style={styles.presetMeta}>
                    {preset.category} • {preset.duration}s • {preset.tone}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.addDirectBtn}
                  onPress={() => handleAddPresetAudio(preset)}
                  activeOpacity={0.7}
                  accessibilityLabel="Add to timeline"
                >
                  <Ionicons name="add" size={14} color="#000000" />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}


    </View>
  );
};

const styles = StyleSheet.create({
  panelContainer: {
    width: 270,
    backgroundColor: THEME_COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: THEME_COLORS.borderSubtle,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 15,
  },
  collapsedBar: {
    width: 20,
    backgroundColor: THEME_COLORS.background,
    borderRightWidth: 1,
    borderRightColor: THEME_COLORS.borderSubtle,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandBtn: {
    width: 20,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.card,
    borderRadius: 4,
  },
  topTabBar: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 6,
    backgroundColor: '#12151E',
  },
  tabsScrollView: {
    flex: 1,
    height: 40,
  },
  tabButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    gap: 3,
    paddingRight: 8,
  },
  tabActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#12151E',
    gap: 4,
    zIndex: 2,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  tabBtnText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  tabBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  collapseToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  scrollInner: {
    padding: 10,
  },
  importMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME_COLORS.cyanBorder,
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 10,
    gap: 6,
    justifyContent: 'center',
    backgroundColor: THEME_COLORS.cyanBg,
  },
  importBtnTitle: {
    color: THEME_COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    color: THEME_COLORS.textMuted,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionCount: {
    color: THEME_COLORS.textMuted,
    fontSize: 8.5,
    fontWeight: '600',
  },
  emptyStateBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: THEME_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  emptyStateSubtext: {
    color: THEME_COLORS.textMuted,
    fontSize: 9.5,
    marginTop: 2,
    textAlign: 'center',
  },
  mediaGrid: {
    gap: 6,
  },
  mediaCard: {
    flexDirection: 'row',
    backgroundColor: THEME_COLORS.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    overflow: 'hidden',
    height: 48,
  },
  thumbnailBox: {
    width: 58,
    height: '100%',
    backgroundColor: THEME_COLORS.background,
    position: 'relative',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  durationBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
  },
  mediaCardInfo: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  mediaCardTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  mediaCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  mediaTypeTag: {
    color: THEME_COLORS.textSecondary,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mediaCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deleteDirectBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDeleteCornerBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  addDirectBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetAudioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    padding: 7,
    marginBottom: 6,
  },
  previewPlayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME_COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlayCircleActive: {
    backgroundColor: THEME_COLORS.accent,
  },
  presetTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 10.5,
    fontWeight: '600',
  },
  presetMeta: {
    color: THEME_COLORS.textMuted,
    fontSize: 8.5,
    marginTop: 1,
  },
  textTemplatesGrid: {
    gap: 8,
  },
  textTemplateCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    padding: 10,
    justifyContent: 'center',
  },
  textTemplatePreview: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textTemplateFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  textTemplateTitle: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9.5,
    fontWeight: '600',
  },
  textAddPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: THEME_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stickerItem: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: THEME_COLORS.card,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerEmoji: {
    fontSize: 18,
  },
  effectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    padding: 8,
    marginBottom: 6,
  },
  effectIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME_COLORS.cyanBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  effectTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  effectDesc: {
    color: THEME_COLORS.textSecondary,
    fontSize: 9,
    marginTop: 1,
  },
});
