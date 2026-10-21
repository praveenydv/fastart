import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { soundEngine } from '../../utils/audioEngine';
import { AudioClip } from '../../types/project';
import { openMediaService, OpenAudioItem } from '../../services/openMediaService';
import { loadUploadedAudio, saveUploadedAudio } from '../../utils/storage';
import { persistLargeMedia } from '../../utils/largeMediaStorage';

interface AudioModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAudio: (clip: AudioClip) => void;
}

export default function AudioModal({ visible, onClose, onAddAudio }: AudioModalProps) {
  const [activeTab, setActiveTab] = useState<'sfx' | 'music' | 'upload'>('sfx');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [audioItems, setAudioItems] = useState<OpenAudioItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [uploadedTracks, setUploadedTracks] = useState<any[]>(loadUploadedAudio());

  useEffect(() => {
    if (visible) {
      setUploadedTracks(loadUploadedAudio());
    }
  }, [visible]);

  const filteredUploadedTracks = uploadedTracks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (t.title || '').toLowerCase().includes(q) ||
      (t.artist || '').toLowerCase().includes(q)
    );
  });

  // Categories for sound effects & music
  const sfxCategories = [
    { id: 'all', label: 'All SFX' },
    { id: 'whoosh', label: 'Whoosh' },
    { id: 'impact', label: 'Impact' },
    { id: 'glitch', label: 'Glitch' },
    { id: 'game sfx', label: 'Game' },
    { id: 'camera', label: 'Camera' },
    { id: 'nature', label: 'Nature' },
  ];

  const musicCategories = [
    { id: 'all', label: 'All Music' },
    { id: 'lo-fi', label: 'Lo-Fi' },
    { id: 'beats', label: 'Beats' },
    { id: 'cinematic', label: 'Cinematic' },
  ];

  // Fetch open-source audio based on active tab, category, and search query
  useEffect(() => {
    let isMounted = true;
    const fetchAudios = async () => {
      if (activeTab === 'upload') return;
      setIsLoading(true);
      try {
        const cat = selectedCategory !== 'all' ? selectedCategory : activeTab === 'sfx' ? 'sfx' : 'music';
        const results = await openMediaService.searchAudio(searchQuery, cat);
        if (isMounted) {
          setAudioItems(results);
        }
      } catch (err) {
        console.warn('Failed to load open-source audio:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchAudios, 250);
    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
    };
  }, [activeTab, searchQuery, selectedCategory]);

  // Clean up audio on close or unmount
  useEffect(() => {
    if (!visible && audioEl) {
      audioEl.pause();
      setPlayingId(null);
    }
  }, [visible]);

  const togglePreview = (item: any) => {
    if (playingId === item.id) {
      if (audioEl) {
        audioEl.pause();
      }
      setPlayingId(null);
    } else {
      if (audioEl) {
        audioEl.pause();
      }
      if (Platform.OS === 'web') {
        const a = new Audio(item.url);
        a.play().catch(() => {});
        a.onended = () => setPlayingId(null);
        setAudioEl(a);
      }
      soundEngine.playSfx(item.icon === 'flash' ? 'whoosh' : item.icon === 'cut' ? 'split' : 'click');
      setPlayingId(item.id);
    }
  };

  const handleSelectAudio = (item: any) => {
    if (audioEl) audioEl.pause();
    const audioClip: AudioClip = {
      id: 'clip-a-' + Date.now(),
      title: item.title,
      artist: item.artist || 'Open Audio',
      duration: item.duration || 10.0,
      startTime: 0,
      trimIn: 0,
      trimOut: item.duration || 10.0,
      mediaDuration: item.duration || 10.0,
      volume: 0.9,
      url: item.url,
    };
    soundEngine.playSfx('pop');
    onAddAudio(audioClip);
    onClose();
  };

  // Upload custom audio file from device storage (MP3, WAV, M4A, AAC, OGG)
  const handleDeviceAudioUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;

          const fileName = file.name.replace(/\.[^/.]+$/, '');
          const trackId = 'user-audio-' + Date.now();

          const probe = new Audio(URL.createObjectURL(file));
          let handled = false;

          const commitAudio = async (dur: number) => {
            if (handled) return;
            handled = true;
            const validDuration = dur && !isNaN(dur) && isFinite(dur) && dur > 0
              ? Math.round(dur * 10) / 10
              : 15.0;

            const saved = await persistLargeMedia(file, trackId, fileName, 'audio', { duration: validDuration });

            const newTrack = {
              id: trackId,
              title: fileName || 'Uploaded Audio Track',
              artist: 'Local Device Audio',
              duration: validDuration,
              url: saved.url,
              bpm: 120,
              icon: 'musical-notes',
              license: 'Personal Upload',
              source: 'Device Storage',
            };

            setUploadedTracks((prev) => {
              const updated = [newTrack, ...prev];
              saveUploadedAudio(updated);
              return updated;
            });

            const audioClip: AudioClip = {
              id: 'clip-a-' + Date.now(),
              title: newTrack.title,
              artist: newTrack.artist,
              duration: validDuration,
              startTime: 0,
              trimIn: 0,
              trimOut: validDuration,
              mediaDuration: validDuration,
              volume: 1.0,
              url: saved.url,
            };

            soundEngine.playSfx('pop');
            onAddAudio(audioClip);
            onClose();
          };

          probe.onloadedmetadata = () => {
            commitAudio(probe.duration);
          };

          probe.onerror = () => {
            commitAudio(15.0);
          };

          setTimeout(() => {
            commitAudio(probe.duration || 15.0);
          }, 1000);
        };
        input.click();
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsEditing: false,
          quality: 1,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          const dur = asset.duration ? asset.duration / 1000 : 15.0;
          const audioClip: AudioClip = {
            id: 'clip-a-' + Date.now(),
            title: asset.fileName || 'Uploaded Audio',
            artist: 'Device Library',
            duration: dur,
            startTime: 0,
            trimIn: 0,
            trimOut: dur,
            mediaDuration: dur,
            volume: 1.0,
            url: asset.uri,
          };
          soundEngine.playSfx('pop');
          onAddAudio(audioClip);
          onClose();
        }
      }
    } catch (err) {
      console.warn('Audio upload failed:', err);
    }
  };

  const activeCategories = activeTab === 'sfx' ? sfxCategories : musicCategories;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'sfx' && styles.tabBtnActive]}
                  onPress={() => {
                    setActiveTab('sfx');
                    setSelectedCategory('all');
                  }}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={14}
                    color={activeTab === 'sfx' ? '#00F2FE' : '#8E95A5'}
                  />
                  <Text style={[styles.tabText, activeTab === 'sfx' && styles.tabTextActive]}>
                    SFX
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'music' && styles.tabBtnActive]}
                  onPress={() => {
                    setActiveTab('music');
                    setSelectedCategory('all');
                  }}
                >
                  <Ionicons
                    name="musical-notes-outline"
                    size={14}
                    color={activeTab === 'music' ? '#00F2FE' : '#8E95A5'}
                  />
                  <Text style={[styles.tabText, activeTab === 'music' && styles.tabTextActive]}>
                    Music
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'upload' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('upload')}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={14}
                    color={activeTab === 'upload' ? '#00F2FE' : '#8E95A5'}
                  />
                  <Text style={[styles.tabText, activeTab === 'upload' && styles.tabTextActive]}>
                    Uploads{uploadedTracks.length > 0 ? ` (${uploadedTracks.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#8E95A5" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={
                  activeTab === 'upload'
                    ? 'Search your uploaded audio...'
                    : activeTab === 'sfx'
                    ? 'Search open-source sound effects (whoosh, hit, glitch)...'
                    : 'Search open-source music tracks (lofi, beats, ambient)...'
                }
                placeholderTextColor="#64748B"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#8E95A5" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Pills (for SFX and Music) */}
            {activeTab !== 'upload' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {activeCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryPill,
                      selectedCategory === cat.id && styles.categoryPillActive,
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        selectedCategory === cat.id && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>


          <ScrollView style={styles.sheetBody}>
            {/* Quick Upload From Device Card */}
            <TouchableOpacity
              style={styles.deviceUploadCard}
              onPress={handleDeviceAudioUpload}
              activeOpacity={0.8}
            >
              <View style={styles.deviceIconCircle}>
                <Ionicons name="cloud-upload" size={20} color="#00F2FE" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.deviceUploadTitle}>Upload Custom Audio</Text>
                  <View style={styles.formatBadge}>
                    <Text style={styles.formatBadgeText}>MP3 / WAV / M4A</Text>
                  </View>
                </View>
                <Text style={styles.deviceUploadSubtext}>
                  Add audio directly from your device storage
                </Text>
              </View>
              <View style={styles.uploadBtnCircle}>
                <Ionicons name="add" size={18} color="#000000" />
              </View>
            </TouchableOpacity>

            {/* TAB: SOUND EFFECTS OR MUSIC (OPEN SOURCE LIBRARY) */}
            {activeTab !== 'upload' && (
              <>
                <View style={styles.sourceBannerRow}>
                  <Text style={styles.sectionTitle}>
                    {activeTab === 'sfx' ? 'OPEN SOURCE SOUND EFFECTS' : 'OPEN SOURCE SOUNDTRACKS'}
                  </Text>
                  <View style={styles.ossBadge}>
                    <Ionicons name="globe-outline" size={10} color="#00F2FE" />
                    <Text style={styles.ossBadgeText}>{"Openverse & CC0 Library"}</Text>
                  </View>
                </View>

                {isLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#00F2FE" />
                    <Text style={styles.loadingText}>Searching open-source library...</Text>
                  </View>
                ) : audioItems.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="search-outline" size={36} color="#374151" />
                    <Text style={styles.emptyTitle}>No Matching Audio Found</Text>
                    <Text style={styles.emptySubtext}>
                      Try searching with different keywords like "whoosh", "impact", "piano", or "glitch"
                    </Text>
                  </View>
                ) : (
                  audioItems.map((item) => (
                    <View key={item.id} style={styles.audioRow}>
                      <TouchableOpacity
                        style={[
                          styles.playIconBtn,
                          playingId === item.id && styles.playIconBtnActive,
                        ]}
                        onPress={() => togglePreview(item)}
                      >
                        <Ionicons
                          name={playingId === item.id ? 'pause' : 'play'}
                          size={18}
                          color={playingId === item.id ? '#000000' : '#00F2FE'}
                        />
                      </TouchableOpacity>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.audioTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View style={styles.metaRow}>
                          <Text style={styles.audioMeta}>
                            {item.artist} • {item.duration}s
                          </Text>
                          <View style={styles.licensePill}>
                            <Text style={styles.licenseText}>{item.license}</Text>
                          </View>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.usePill}
                        onPress={() => handleSelectAudio(item)}
                      >
                        <Text style={styles.usePillText}>Use</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
            )}

            {/* TAB: UPLOADED AUDIO */}
            {activeTab === 'upload' && (
              <>
                <Text style={styles.sectionTitle}>
                  YOUR UPLOADED AUDIO ({filteredUploadedTracks.length})
                </Text>
                {filteredUploadedTracks.length === 0 ? (
                  <View style={styles.emptyUploadBox}>
                    <Ionicons name="musical-notes-outline" size={44} color="#374151" />
                    <Text style={styles.emptyUploadTitle}>
                      {searchQuery.trim() ? 'No Matching Uploaded Audio' : 'No Custom Audio Yet'}
                    </Text>
                    <Text style={styles.emptyUploadSubtext}>
                      {searchQuery.trim()
                        ? 'Try clearing your search query.'
                        : 'Import MP3, WAV, or M4A music files directly from your phone or computer.'}
                    </Text>
                    {!searchQuery.trim() && (
                      <TouchableOpacity
                        style={styles.emptyUploadCta}
                        onPress={handleDeviceAudioUpload}
                      >
                        <Ionicons name="cloud-upload" size={18} color="#000000" />
                        <Text style={styles.emptyUploadCtaText}>Choose Audio File</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  filteredUploadedTracks.map((item) => (
                    <View key={item.id} style={styles.audioRow}>
                      <TouchableOpacity
                        style={[
                          styles.playIconBtn,
                          playingId === item.id && styles.playIconBtnActive,
                        ]}
                        onPress={() => togglePreview(item)}
                      >
                        <Ionicons
                          name={playingId === item.id ? 'pause' : 'play'}
                          size={18}
                          color={playingId === item.id ? '#000000' : '#00F2FE'}
                        />
                      </TouchableOpacity>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.audioTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.audioMeta}>
                          {item.artist} • {item.duration}s
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.usePill, { backgroundColor: '#00F2FE' }]}
                        onPress={() => handleSelectAudio(item)}
                      >
                        <Text style={[styles.usePillText, { color: '#000000' }]}>Use</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0B0D13',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#1E2333',
  },
  tabText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0D13',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    borderWidth: 1,
    borderColor: '#252B3B',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    marginLeft: 8,
    paddingVertical: 0,
  },
  categoryScroll: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  categoryPillText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#00F2FE',
  },
  sheetBody: {
    padding: 14,
  },
  deviceUploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  deviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceUploadTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  formatBadge: {
    backgroundColor: '#00F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  formatBadgeText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
  },
  deviceUploadSubtext: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  uploadBtnCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ossBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ossBadgeText: {
    color: '#00F2FE',
    fontSize: 9,
    fontWeight: '800',
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10131A',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  playIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A2130',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconBtnActive: {
    backgroundColor: '#00F2FE',
  },
  audioTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  audioMeta: {
    color: '#8E95A5',
    fontSize: 11,
  },
  licensePill: {
    backgroundColor: '#1E2333',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  licenseText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  usePill: {
    backgroundColor: '#00F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  usePillText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#8E95A5',
    fontSize: 12,
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtext: {
    color: '#8E95A5',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  emptyUploadBox: {
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2333',
    marginVertical: 10,
  },
  emptyUploadTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyUploadSubtext: {
    color: '#8E95A5',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyUploadCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyUploadCtaText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
