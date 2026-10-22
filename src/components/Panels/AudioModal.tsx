import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
import { AudioClip, FastArtProject } from '../../types/project';
import { loadUploadedAudio, saveUploadedAudio } from '../../utils/storage';
import { persistLargeMedia } from '../../utils/largeMediaStorage';
import { detectAudioBeats, toggleProjectBeatMarkers } from '../../utils/audioBeatDetector';
import { styles } from './Audio/AudioModalStyles';

interface AudioModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAudio: (clip: AudioClip) => void;
  project?: FastArtProject | null;
  onUpdateProject?: (updates: any) => void;
}

export default function AudioModal({
  visible,
  onClose,
  onAddAudio,
  project,
  onUpdateProject,
}: AudioModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [uploadedTracks, setUploadedTracks] = useState<any[]>(loadUploadedAudio());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setUploadedTracks(loadUploadedAudio());
    }
  }, [visible]);

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
      soundEngine.playSfx('click');
      setPlayingId(item.id);
    }
  };

  const handleSelectAudio = (item: any) => {
    if (audioEl) audioEl.pause();
    const audioClip: AudioClip = {
      id: 'clip-a-' + Date.now(),
      title: item.title,
      artist: item.artist || 'Device Audio',
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

  const handleDeleteAudio = (id: string, e: any) => {
    e?.stopPropagation?.();
    if (playingId === id && audioEl) {
      audioEl.pause();
      setPlayingId(null);
    }
    soundEngine.playSfx('pop');
    setUploadedTracks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveUploadedAudio(updated);
      return updated;
    });
  };

  // Upload custom audio file from device storage (MP3, WAV, M4A, AAC, OGG, FLAC)
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

              const newTrack = {
                id: trackId,
                title: fileName || 'Uploaded Audio Track',
                artist: 'Device Audio',
                duration: validDuration,
                url: saved.url,
                bpm: 120,
                icon: 'musical-notes',
              };

              setUploadedTracks((prev) => {
                const updated = [newTrack, ...prev.filter((t) => t.id !== newTrack.id)];
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
            } finally {
              setIsLoading(false);
            }
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
        setTimeout(() => {
          try {
            input.click();
          } catch (_) {}
        }, 40);
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsEditing: false,
          quality: 1,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          const dur = asset.duration ? asset.duration / 1000 : 15.0;
          const fileName = asset.fileName || 'Imported Audio';
          const trackId = 'user-audio-' + Date.now();
          const newTrack = {
            id: trackId,
            title: fileName,
            artist: 'Device Library',
            duration: dur,
            url: asset.uri,
          };
          setUploadedTracks((prev) => {
            const updated = [newTrack, ...prev.filter((t) => t.id !== newTrack.id)];
            saveUploadedAudio(updated);
            return updated;
          });
          const audioClip: AudioClip = {
            id: 'clip-a-' + Date.now(),
            title: fileName,
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
      setIsLoading(false);
    }
  };

  const filteredUploadedTracks = uploadedTracks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (t.title || '').toLowerCase().includes(q) ||
      (t.artist || '').toLowerCase().includes(q)
    );
  });

  const hasBeats = Boolean(project?.beatMarkers && project.beatMarkers.length > 0);

  const handleToggleBeats = async () => {
    if (!project || !onUpdateProject) return;
    soundEngine.playSfx('click');
    const res = await detectAudioBeats(project);
    const updated = toggleProjectBeatMarkers(project, res.beats);
    onUpdateProject(updated);
    soundEngine.playSfx('pop');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Standardized Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }]}
              activeOpacity={0.7}
              accessibilityLabel="Cancel changes"
            >
              <Ionicons name="close" size={17} color="#EF4444" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="musical-notes" size={17} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Music & Audio</Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: '#00F2FE' }]}
              activeOpacity={0.7}
              accessibilityLabel="Done"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Search Bar & Beats Utility */}
          <View style={[styles.searchContainer, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
            <View style={[styles.searchBar, { flex: 1, marginBottom: 0 }]}>
              <Ionicons name="search" size={16} color="#8E95A5" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search device audio..."
                placeholderTextColor="#64748B"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#8E95A5" />
                </TouchableOpacity>
              )}
            </View>

            {project && onUpdateProject && (
              <TouchableOpacity
                onPress={handleToggleBeats}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: hasBeats ? '#FFE600' : 'rgba(255, 230, 0, 0.12)',
                  borderWidth: 1,
                  borderColor: '#FFE600',
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="musical-note"
                  size={13}
                  color={hasBeats ? '#000000' : '#FFE600'}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: hasBeats ? '#000000' : '#FFE600',
                  }}
                >
                  Beats
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
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
                  <Text style={styles.deviceUploadTitle}>Upload From Device</Text>
                  <View style={styles.formatBadge}>
                    <Text style={styles.formatBadgeText}>MP3 / WAV / M4A</Text>
                  </View>
                </View>
                <Text style={styles.deviceUploadSubtext}>
                  Add audio files directly from your computer or phone
                </Text>
              </View>
              <View style={styles.uploadBtnCircle}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="add" size={18} color="#000000" />
                )}
              </View>
            </TouchableOpacity>

            {/* List of Device Audio Tracks */}
            <View style={styles.sourceBannerRow}>
              <Text style={styles.sectionTitle}>
                DEVICE AUDIO ({filteredUploadedTracks.length})
              </Text>
            </View>

            {filteredUploadedTracks.length === 0 ? (
              <View style={styles.emptyUploadBox}>
                <Ionicons name="musical-notes-outline" size={44} color="#374151" />
                <Text style={styles.emptyUploadTitle}>
                  {searchQuery.trim() ? 'No Matching Audio Tracks' : 'No Custom Audio Yet'}
                </Text>
                <Text style={styles.emptyUploadSubtext}>
                  {searchQuery.trim()
                    ? `No audio matching "${searchQuery}". Try a different keyword.`
                    : 'Import MP3, WAV, or M4A music files directly from your phone or computer.'}
                </Text>
                {!searchQuery.trim() && (
                  <TouchableOpacity
                    style={styles.emptyUploadCta}
                    onPress={handleDeviceAudioUpload}
                    activeOpacity={0.8}
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
                    style={[styles.playIconBtn, playingId === item.id && styles.playIconBtnActive]}
                    onPress={() => togglePreview(item)}
                    activeOpacity={0.7}
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
                        {item.artist || 'Device Audio'} • {item.duration}s
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={(e) => handleDeleteAudio(item.id, e)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.usePill}
                      onPress={() => handleSelectAudio(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.usePillText}>Use</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
