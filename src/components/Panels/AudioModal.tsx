import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { soundEngine } from '../../utils/audioEngine';
import { AudioClip } from '../../types/project';
import { openMediaService, OpenAudioItem } from '../../services/openMediaService';
import { loadUploadedAudio, saveUploadedAudio } from '../../utils/storage';
import { persistLargeMedia } from '../../utils/largeMediaStorage';
import { styles } from './Audio/AudioModalStyles';
import { AudioLibraryTab } from './Audio/AudioLibraryTab';
import { AudioUploadTab } from './Audio/AudioUploadTab';

interface AudioModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAudio: (clip: AudioClip) => void;
}

const SFX_CATEGORIES = [
  { id: 'all', label: 'All SFX' },
  { id: 'whoosh', label: 'Whoosh' },
  { id: 'impact', label: 'Impact' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'game sfx', label: 'Game' },
  { id: 'camera', label: 'Camera' },
  { id: 'nature', label: 'Nature' },
];

const MUSIC_CATEGORIES = [
  { id: 'all', label: 'All Music' },
  { id: 'lo-fi', label: 'Lo-Fi' },
  { id: 'beats', label: 'Beats' },
  { id: 'cinematic', label: 'Cinematic' },
];

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

  const activeCategories = activeTab === 'sfx' ? SFX_CATEGORIES : MUSIC_CATEGORIES;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

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
              <AudioLibraryTab
                activeTab={activeTab}
                audioItems={audioItems}
                isLoading={isLoading}
                playingId={playingId}
                onTogglePreview={togglePreview}
                onSelectAudio={handleSelectAudio}
              />
            )}

            {/* TAB: UPLOADED AUDIO */}
            {activeTab === 'upload' && (
              <AudioUploadTab
                filteredUploadedTracks={filteredUploadedTracks}
                searchQuery={searchQuery}
                playingId={playingId}
                onDeviceUpload={handleDeviceAudioUpload}
                onTogglePreview={togglePreview}
                onSelectAudio={handleSelectAudio}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
