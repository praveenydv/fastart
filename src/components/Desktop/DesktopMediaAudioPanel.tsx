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

export interface DesktopMediaAudioPanelProps {
  project: FastArtProject;
  activeTab: 'media' | 'audio';
  onSelectTab: (tab: 'media' | 'audio') => void;
  onAddMedia: (clip: any) => void;
  onAddAudio: (clip: AudioClip) => void;
  currentTime: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  position?: 'left' | 'right';
  onSwapPosition?: () => void;
  style?: any;
}

// Built-in high quality royalty-free BGM and SFX presets
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

export const DesktopMediaAudioPanel: React.FC<DesktopMediaAudioPanelProps> = ({
  project,
  activeTab,
  onSelectTab,
  onAddMedia,
  onAddAudio,
  currentTime,
  isCollapsed = false,
  onToggleCollapse,
  width,
  position = 'right',
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

              soundEngine.playSfx('whoosh');
              onAddMedia(clip);
              addNotification({
                title: 'Media Imported',
                message: `Added "${clip.title}" to project timeline.`,
                icon: clip.type === 'video' ? 'videocam-outline' : 'image-outline',
              });
            } catch (err) {
              console.error('Failed to import media:', err);
            } finally {
              setIsLoading(false);
            }
          }
        };
        input.click();
      }
    } catch (e) {
      setIsLoading(false);
    }
  };

  // Handle local device audio upload (MP3, WAV, M4A, etc.)
  const handleDeviceAudioUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;

          setIsLoading(true);
          const fileName = file.name.replace(/\.[^/.]+$/, '');
          const trackId = 'user-audio-' + Date.now();

          const probe = new Audio(URL.createObjectURL(file));
          let handled = false;

          const commitAudio = async (dur: number) => {
            if (handled) return;
            handled = true;
            try {
              const validDuration =
                dur && !isNaN(dur) && isFinite(dur) && dur > 0
                  ? Math.round(dur * 10) / 10
                  : 15.0;

              const saved = await persistLargeMedia(file, trackId, fileName, 'audio', {
                duration: validDuration,
              });

              const audioClip: AudioClip = {
                id: 'clip-a-' + Date.now(),
                title: fileName,
                url: saved.url,
                startTime: currentTime || 0,
                duration: validDuration,
                volume: 1.0,
                trackIndex: 1,
              };

              soundEngine.playSfx('pop');
              onAddAudio(audioClip);
            } catch (err) {
              console.error('Failed to persist audio:', err);
            } finally {
              setIsLoading(false);
            }
          };

          probe.onloadedmetadata = () => commitAudio(probe.duration);
          probe.onerror = () => commitAudio(15.0);
          setTimeout(() => commitAudio(15.0), 3000);
        };
        input.click();
      }
    } catch (e) {
      setIsLoading(false);
    }
  };

  const handleAddPresetAudio = (preset: typeof AUDIO_PRESETS[0]) => {
    soundEngine.playSfx('pop');
    const newAudioClip: AudioClip = {
      id: 'bgm-' + Date.now(),
      title: preset.title,
      url: '',
      startTime: currentTime || 0,
      duration: preset.duration,
      volume: 1.0,
      trackIndex: 1,
    };
    onAddAudio(newAudioClip);
  };

  if (isCollapsed) {
    return (
      <View
        style={[
          styles.collapsedBar,
          position === 'right'
            ? { borderLeftWidth: 1, borderLeftColor: 'rgba(255, 255, 255, 0.08)', borderRightWidth: 0 }
            : { borderRightWidth: 1, borderRightColor: 'rgba(255, 255, 255, 0.08)', borderLeftWidth: 0 },
          style,
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
            size={16}
            color="#00F2FE"
          />
        </TouchableOpacity>
      </View>
    );
  }

  const videoClips = project?.tracks?.video || [];
  const audioClips = project?.tracks?.audio || [];

  return (
    <View
      style={[
        styles.panelContainer,
        width !== undefined && { width },
        position === 'right'
          ? { borderLeftWidth: 1, borderLeftColor: 'rgba(255, 255, 255, 0.08)', borderRightWidth: 0 }
          : { borderRightWidth: 1, borderRightColor: 'rgba(255, 255, 255, 0.08)', borderLeftWidth: 0 },
        style,
      ]}
    >
      {/* Top Header Tabs */}
      <View style={styles.topTabBar}>
        <View style={styles.tabButtonsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'media' && styles.tabBtnActive]}
            onPress={() => {
              soundEngine.playSfx('click');
              onSelectTab('media');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="images-outline"
              size={14}
              color={activeTab === 'media' ? '#00F2FE' : '#8E95A5'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'media' && styles.tabBtnTextActive,
              ]}
            >
              Media ({videoClips.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'audio' && styles.tabBtnActive]}
            onPress={() => {
              soundEngine.playSfx('click');
              onSelectTab('audio');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="musical-notes-outline"
              size={14}
              color={activeTab === 'audio' ? '#00F2FE' : '#8E95A5'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'audio' && styles.tabBtnTextActive,
              ]}
            >
              Audio ({audioClips.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {onSwapPosition && (
            <TouchableOpacity
              style={styles.collapseToggleBtn}
              onPress={onSwapPosition}
              activeOpacity={0.7}
              accessibilityLabel="Swap panels side"
            >
              <Ionicons name="swap-horizontal" size={14} color="#8E95A5" />
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
                size={15}
                color="#8E95A5"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Media Tab Body */}
      {activeTab === 'media' && (
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
              <ActivityIndicator size="small" color="#00F2FE" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={15} color="#00F2FE" />
                <Text style={styles.importBtnTitle}>+ Import Media</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Section: Project Clips */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>PROJECT ASSETS</Text>
            <Text style={styles.sectionCount}>{videoClips.length} items</Text>
          </View>

          {videoClips.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Ionicons name="film-outline" size={28} color="#3F3F46" />
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
                          color="#00F2FE"
                        />
                      </View>
                    )}
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationBadgeText}>
                        {clip.duration ? `${clip.duration.toFixed(1)}s` : '0.0s'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mediaCardInfo}>
                    <Text style={styles.mediaCardTitle} numberOfLines={1}>
                      {clip.title || `Clip ${idx + 1}`}
                    </Text>
                    <View style={styles.mediaCardMetaRow}>
                      <Text style={styles.mediaTypeTag}>
                        {clip.type === 'photo' ? 'PHOTO' : 'VIDEO'}
                      </Text>
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
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Audio Tab Body */}
      {activeTab === 'audio' && (
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
              <ActivityIndicator size="small" color="#00F2FE" />
            ) : (
              <>
                <Ionicons name="musical-note-outline" size={15} color="#00F2FE" />
                <Text style={styles.importBtnTitle}>+ Import Audio</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Section: Project Audio */}
          {audioClips.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>TIMELINE AUDIO</Text>
                <Text style={styles.sectionCount}>{audioClips.length} tracks</Text>
              </View>
              {audioClips.map((a, i) => (
                <View
                  key={a.id || i}
                  style={[styles.audioRowItem, Platform.OS === 'web' && ({ cursor: 'grab' } as any)]}
                  {...(Platform.OS === 'web'
                    ? {
                        draggable: true,
                        onDragStart: (e: any) => {
                          const payload = {
                            type: 'audio',
                            clip: {
                              ...a,
                              id: `audio-copy-${Date.now()}`,
                            },
                          };
                          e.dataTransfer.setData('application/fastart-clip', JSON.stringify(payload));
                          e.dataTransfer.effectAllowed = 'copy';
                        },
                      }
                    : {})}
                >
                  <Ionicons name="musical-notes" size={15} color="#818CF8" />
                  <View style={{ flex: 1, paddingHorizontal: 8 }}>
                    <Text style={styles.audioRowTitle} numberOfLines={1}>
                      {a.title || `Audio ${i + 1}`}
                    </Text>
                    <Text style={styles.audioRowSubtitle}>
                      {a.duration?.toFixed(1)}s • Track {(a.trackIndex ?? 1) + 1}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Section: Royalty Free Music & Sound Effects */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>STOCK MUSIC & SFX</Text>
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
                    size={12}
                    color={isPlaying ? '#000000' : '#00F2FE'}
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
                  <Ionicons name="add" size={15} color="#000000" />
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
    width: 260,
    backgroundColor: '#0F131D',
    borderRightWidth: 1,
    borderRightColor: '#1F2637',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 15,
  },
  collapsedBar: {
    width: 20,
    backgroundColor: '#08090E',
    borderRightWidth: 1,
    borderRightColor: '#1F2637',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandBtn: {
    width: 20,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 4,
  },
  topTabBar: {
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: '#08090E',
  },
  tabButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  collapseToggleBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  scrollInner: {
    padding: 12,
  },
  importMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.35)',
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 6,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.04)',
  },
  importIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  importBtnTitle: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  importBtnSubtitle: {
    display: 'none' as any,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionCount: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '600',
  },
  emptyStateBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  emptyStateSubtext: {
    color: '#64748B',
    fontSize: 9.5,
    marginTop: 2,
    textAlign: 'center',
  },
  mediaGrid: {
    gap: 6,
  },
  mediaCard: {
    flexDirection: 'row',
    backgroundColor: '#131826',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
    overflow: 'hidden',
    height: 48,
  },
  thumbnailBox: {
    width: 58,
    height: '100%',
    backgroundColor: '#08090E',
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
    paddingVertical: 6,
    justifyContent: 'space-between',
  },
  mediaCardTitle: {
    color: '#E4E4E7',
    fontSize: 11,
    fontWeight: '600',
  },
  mediaCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaTypeTag: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  addDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00F2FE',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 2,
  },
  addDirectBtnText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '700',
  },
  audioRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
    padding: 6,
    marginBottom: 4,
  },
  audioRowTitle: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '600',
  },
  audioRowSubtitle: {
    color: '#64748B',
    fontSize: 8.5,
    marginTop: 1,
  },
  presetAudioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
    padding: 6,
    marginBottom: 4,
  },
  previewPlayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlayCircleActive: {
    backgroundColor: '#00F2FE',
  },
  presetTitle: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '600',
  },
  presetMeta: {
    color: '#64748B',
    fontSize: 8.5,
    marginTop: 1,
  },
});
