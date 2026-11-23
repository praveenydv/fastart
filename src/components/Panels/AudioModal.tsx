import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AudioClip, FastArtProject } from '../../types/project';
import { ModalHeader } from '../Common/ModalHeader';
import {
  pickWebMedia,
  persistLargeMedia,
  persistNativeMediaCopy,
} from '../../utils/largeMediaStorage';
import {
  CREATOR_SOUND_EFFECTS,
  SoundEffectDefinition,
  getSoundEffectUri,
  playSoundEffectPreview,
} from '../../utils/sfxAudioSynthesizer';
import {
  startVoiceoverRecording,
  stopVoiceoverRecording,
} from '../../utils/voiceoverRecorder';

interface AudioModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAudio: (clip: AudioClip) => void;
  project?: FastArtProject | null;
  onUpdateProject?: (updates: any) => void;
  isInline?: boolean;
  currentTime?: number;
}

type AudioStudioTab = 'music' | 'sfx' | 'voiceover' | 'extract';

export default function AudioModal({
  visible,
  onClose,
  onAddAudio,
  project,
  onUpdateProject,
  isInline = false,
  currentTime = 0,
}: AudioModalProps) {
  const [activeTab, setActiveTab] = useState<AudioStudioTab>('music');
  const [isLoading, setIsLoading] = useState(false);

  // SFX State
  const [selectedSfxCategory, setSelectedSfxCategory] = useState<string>('All');
  const [playingSfxId, setPlayingSfxId] = useState<string | null>(null);
  const stopPreviewRef = useRef<(() => void) | null>(null);

  // Voiceover State
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [vuLevel, setVuLevel] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (stopPreviewRef.current) {
        stopPreviewRef.current();
        stopPreviewRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      stopVoiceoverRecording().catch(() => {});
    };
  }, []);

  const importedAudioAssets = React.useMemo(() => {
    const assets = (project?.assets || []).filter((a) => a.type === 'audio');
    if (assets.length > 0) return assets;
    const trackAudios = project?.tracks?.audio || [];
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const a of trackAudios) {
      const key = a.sourceMediaId || a.url || a.title;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(a);
      }
    }
    return unique;
  }, [project?.assets, project?.tracks?.audio]);

  // Upload custom audio file from device storage
  const handleDeviceAudioUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        const picked = await pickWebMedia('audio');
        if (!picked) return;

        setIsLoading(true);
        const { file, handle, isLinked } = picked;
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        const trackId = 'user-audio-' + Date.now();

        const probeUrl = URL.createObjectURL(file);
        const probe = new Audio(probeUrl);
        let handled = false;

        const cleanupProbe = () => {
          try {
            probe.onloadedmetadata = null;
            probe.onerror = null;
            probe.src = '';
            URL.revokeObjectURL(probeUrl);
          } catch {}
        };

        const commitAudio = async (dur: number) => {
          if (handled) return;
          handled = true;
          cleanupProbe();
          try {
            const validDuration =
              dur && !isNaN(dur) && isFinite(dur) && dur > 0
                ? Math.round(dur * 10) / 10
                : 15.0;

            const saved = await persistLargeMedia(file, trackId, fileName, 'audio', {
              duration: validDuration,
              handle,
              isLinked,
            });

            const audioClip: AudioClip = {
              id: 'clip-a-' + Date.now(),
              sourceMediaId: saved.id || trackId,
              title: fileName,
              artist: 'Device Audio',
              duration: validDuration,
              startTime: Math.max(0, Number(currentTime.toFixed(3))),
              trimIn: 0,
              trimOut: validDuration,
              mediaDuration: validDuration,
              volume: 1.0,
              url: saved.url,
            };

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
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'FastArt needs media library access to import audio files from your device.'
          );
          return;
        }

        setIsLoading(true);
        try {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsEditing: false,
            quality: 1,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const dur = asset.duration ? (asset.duration > 1000 ? asset.duration / 1000 : asset.duration) : 15.0;
            const fileName = asset.fileName || 'Imported Audio';
            const trackId = 'user-audio-' + Date.now();

            const persistentUri = await persistNativeMediaCopy(
              asset.uri,
              trackId,
              fileName
            );

            const audioClip: AudioClip = {
              id: 'clip-a-' + Date.now(),
              title: fileName,
              artist: 'Device Audio',
              duration: dur,
              startTime: Math.max(0, Number(currentTime.toFixed(3))),
              trimIn: 0,
              trimOut: dur,
              mediaDuration: dur,
              volume: 1.0,
              url: persistentUri,
            };
            onAddAudio(audioClip);
            onClose();
          }
        } finally {
          setIsLoading(false);
        }
      }
    } catch (err: any) {
      console.warn('Audio upload failed:', err);
      Alert.alert(
        'Upload Failed',
        err?.message || 'Unable to import the selected audio file. Please try again.'
      );
      setIsLoading(false);
    }
  };

  // SFX Actions
  const handleTogglePreviewSfx = (sfx: SoundEffectDefinition) => {
    if (playingSfxId === sfx.id) {
      if (stopPreviewRef.current) {
        stopPreviewRef.current();
        stopPreviewRef.current = null;
      }
      setPlayingSfxId(null);
    } else {
      if (stopPreviewRef.current) {
        stopPreviewRef.current();
      }
      setPlayingSfxId(sfx.id);
      stopPreviewRef.current = playSoundEffectPreview(sfx, () => {
        setPlayingSfxId(null);
        stopPreviewRef.current = null;
      });
    }
  };

  const handleAddSfxToTimeline = (sfx: SoundEffectDefinition) => {
    const uri = getSoundEffectUri(sfx);
    const audioClip: AudioClip = {
      id: 'clip-sfx-' + Date.now(),
      title: sfx.name,
      artist: 'Sound FX',
      duration: sfx.duration,
      startTime: Math.max(0, Number(currentTime.toFixed(3))),
      trimIn: 0,
      trimOut: sfx.duration,
      mediaDuration: sfx.duration,
      volume: 1.0,
      url: uri,
    };
    onAddAudio(audioClip);
    onClose();
  };

  // Voiceover Actions
  const handleToggleVoiceover = async () => {
    if (isRecording) {
      // Stop recording
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      setVuLevel(0);
      try {
        const result = await stopVoiceoverRecording();
        if (result && result.url) {
          const clip: AudioClip = {
            id: 'clip-vo-' + Date.now(),
            title: `Voiceover ${new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}`,
            artist: 'Recorded Voiceover',
            duration: Number(result.duration.toFixed(2)),
            startTime: Math.max(0, Number(currentTime.toFixed(3))),
            trimIn: 0,
            trimOut: Number(result.duration.toFixed(2)),
            mediaDuration: Number(result.duration.toFixed(2)),
            volume: 1.0,
            url: result.url,
            isVoiceover: true,
          };
          onAddAudio(clip);
          onClose();
        }
      } catch (err: any) {
        Alert.alert('Recording Error', err?.message || 'Failed to save voiceover recording.');
      }
    } else {
      // Start countdown sequence
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            executeStartRecording();
            return null;
          }
          return prev - 1;
        });
      }, 700);
    }
  };

  const executeStartRecording = async () => {
    try {
      await startVoiceoverRecording((lvl) => {
        setVuLevel(lvl);
      });
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      setIsRecording(false);
      Alert.alert('Microphone Access', err?.message || 'Could not access microphone.');
    }
  };

  const filteredSfx = CREATOR_SOUND_EFFECTS.filter(
    (s) => selectedSfxCategory === 'All' || s.category === selectedSfxCategory
  );

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <View style={styles.inlineWrapper}>
      <View style={styles.sheetContainer}>
        {/* Live Panel Header */}
        {!isInline && (
          <ModalHeader
            title="Audio Studio"
            iconName="musical-notes"
            onClose={onClose}
          />
        )}

        {/* 4-Tab Studio Navigation Bar */}
        <View style={styles.tabsHeader}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'music' && styles.tabBtnActive]}
            onPress={() => setActiveTab('music')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="musical-notes-outline"
              size={13}
              color={activeTab === 'music' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text style={[styles.tabBtnText, activeTab === 'music' && styles.tabBtnTextActive]}>
              Music
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'sfx' && styles.tabBtnActive]}
            onPress={() => setActiveTab('sfx')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="waveform"
              size={14}
              color={activeTab === 'sfx' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text style={[styles.tabBtnText, activeTab === 'sfx' && styles.tabBtnTextActive]}>
              Sound FX
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'voiceover' && styles.tabBtnActive]}
            onPress={() => setActiveTab('voiceover')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="mic-outline"
              size={13}
              color={activeTab === 'voiceover' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text style={[styles.tabBtnText, activeTab === 'voiceover' && styles.tabBtnTextActive]}>
              Voiceover
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'extract' && styles.tabBtnActive]}
            onPress={() => setActiveTab('extract')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="film-outline"
              size={13}
              color={activeTab === 'extract' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text style={[styles.tabBtnText, activeTab === 'extract' && styles.tabBtnTextActive]}>
              Extract
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.sheetBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: MUSIC & DEVICE IMPORT */}
          {activeTab === 'music' && (
            <>
              <TouchableOpacity
                style={styles.fullWidthUploadButton}
                onPress={handleDeviceAudioUpload}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={15} color="#FFFFFF" />
                )}
                <Text style={styles.fullWidthUploadButtonText} numberOfLines={1}>
                  {isLoading ? 'Importing Audio...' : '+ Import Audio from Device'}
                </Text>
              </TouchableOpacity>

              <View style={styles.importedSection}>
                <View style={styles.importedHeaderRow}>
                  <Text style={styles.importedSectionTitle}>PROJECT AUDIO</Text>
                  <Text style={styles.importedCountText}>{importedAudioAssets.length} tracks</Text>
                </View>

                {importedAudioAssets.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <Ionicons name="musical-note-outline" size={24} color="#64748B" />
                    <Text style={styles.emptyStateTitle}>No audio tracks imported yet</Text>
                    <Text style={styles.emptyStateSubtitle}>Tap + Import above to add songs or music files</Text>
                  </View>
                ) : (
                  <View style={styles.importedList}>
                    {importedAudioAssets.map((asset, idx) => (
                      <View key={asset.id || idx} style={styles.importedAudioCard}>
                        <View style={styles.importedAudioIconBox}>
                          <Ionicons name="musical-note" size={13} color="#FFFFFF" />
                        </View>
                        <View style={styles.importedAudioInfo}>
                          <Text style={styles.importedAudioTitle} numberOfLines={1}>
                            {asset.title || asset.name || `Audio Track ${idx + 1}`}
                          </Text>
                          <Text style={styles.importedAudioSubtitle}>
                            {asset.duration ? `${asset.duration.toFixed(1)}s` : '0.0s'} • Audio Clip
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.importedAddBtn}
                          onPress={() => {
                            onAddAudio({
                              id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              sourceMediaId: asset.sourceMediaId || asset.id,
                              title: asset.title || asset.name || "Audio Clip",
                              url: asset.url,
                              startTime: Math.max(0, Number(currentTime.toFixed(3))),
                              duration: asset.duration ? (asset.duration > 1000 ? asset.duration / 1000 : asset.duration) : 5,
                              volume: 1.0,
                              fadeIn: 0,
                              fadeOut: 0,
                            });
                            onClose();
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={13} color="#121214" />
                          <Text style={styles.importedAddBtnText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}

          {/* TAB 2: SOUND EFFECTS (SFX) */}
          {activeTab === 'sfx' && (
            <>
              {/* Category Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScroll}
                contentContainerStyle={styles.categoriesContainer}
              >
                {['All', 'Transitions', 'Impacts', 'Memes', 'Foley & UI'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, selectedSfxCategory === cat && styles.categoryPillActive]}
                    onPress={() => setSelectedSfxCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryPillText, selectedSfxCategory === cat && styles.categoryPillTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Sound Effects List */}
              <View style={styles.sfxList}>
                {filteredSfx.map((sfx) => {
                  const isPlaying = playingSfxId === sfx.id;
                  return (
                    <View key={sfx.id} style={styles.sfxCard}>
                      <TouchableOpacity
                        style={[styles.sfxPlayBtn, isPlaying && styles.sfxPlayBtnActive]}
                        onPress={() => handleTogglePreviewSfx(sfx)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isPlaying ? 'stop' : 'play'}
                          size={15}
                          color={isPlaying ? '#38BDF8' : '#EDEDED'}
                        />
                      </TouchableOpacity>

                      <View style={styles.sfxInfo}>
                        <View style={styles.sfxTitleRow}>
                          <Text style={styles.sfxTitle} numberOfLines={1}>{sfx.name}</Text>
                          <View style={styles.sfxBadge}>
                            <Text style={styles.sfxBadgeText}>{sfx.badge}</Text>
                          </View>
                        </View>
                        <Text style={styles.sfxDesc} numberOfLines={1}>
                          {sfx.duration}s • {sfx.description}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.sfxAddBtn}
                        onPress={() => handleAddSfxToTimeline(sfx)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={13} color="#FFFFFF" />
                        <Text style={styles.sfxAddBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* TAB 3: VOICEOVER RECORDING */}
          {activeTab === 'voiceover' && (
            <View style={styles.voiceoverContainer}>
              {countdown !== null ? (
                <View style={styles.countdownBox}>
                  <Text style={styles.countdownNumber}>{countdown}</Text>
                  <Text style={styles.countdownLabel}>Get Ready to Speak...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.voTitle}>Live Microphone Voiceover</Text>
                  <Text style={styles.voSubtitle}>
                    {isRecording
                      ? 'Recording in progress... speak clearly into your mic.'
                      : 'Records audio and drops it directly onto the timeline at the playhead.'}
                  </Text>

                  {/* Timer Display */}
                  <View style={styles.timerDisplay}>
                    <Text style={[styles.timerDigits, isRecording && styles.timerDigitsActive]}>
                      {formatTimer(recordingSeconds)}
                    </Text>
                  </View>

                  {/* Real-time Level Meter */}
                  <View style={styles.vuMeterContainer}>
                    <View
                      style={[
                        styles.vuMeterFill,
                        {
                          width: `${Math.round(vuLevel * 100)}%`,
                          backgroundColor: vuLevel > 0.85 ? '#EF4444' : vuLevel > 0.6 ? '#F59E0B' : '#38BDF8',
                        },
                      ]}
                    />
                  </View>

                  {/* Large Record Button */}
                  <TouchableOpacity
                    style={[styles.recordCircle, isRecording && styles.recordCircleActive]}
                    onPress={handleToggleVoiceover}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.recordInner, isRecording && styles.recordInnerActive]} />
                  </TouchableOpacity>

                  <Text style={styles.recordActionHint}>
                    {isRecording ? 'Tap to Stop & Insert' : 'Tap to Record Voiceover'}
                  </Text>

                  <View style={styles.duckingNoteBox}>
                    <Ionicons name="information-circle-outline" size={13} color="#94A3B8" />
                    <Text style={styles.duckingNoteText}>
                      Voiceover tracks automatically engage Smart Audio Ducking to lower background music.
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* TAB 4: EXTRACT AUDIO FROM VIDEO */}
          {activeTab === 'extract' && (
            <View style={styles.extractContainer}>
              <View style={styles.extractHero}>
                <Ionicons name="film-outline" size={32} color="#38BDF8" />
                <Text style={styles.extractHeroTitle}>Extract Audio from Video</Text>
                <Text style={styles.extractHeroSub}>
                  Select any video file from your device library to rip its audio track as a standalone music layer.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.fullWidthUploadButton}
                onPress={handleDeviceAudioUpload}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="download-outline" size={15} color="#FFFFFF" />
                )}
                <Text style={styles.fullWidthUploadButtonText} numberOfLines={1}>
                  {isLoading ? 'Demuxing Video...' : 'Select Video to Extract Audio'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#09090B',
  },
  sheetContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  tabsHeader: {
    flexDirection: 'row',
    backgroundColor: '#121214',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabBtnText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sheetBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
  },
  fullWidthUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 12,
  },
  fullWidthUploadButtonText: {
    color: '#EDEDED',
    fontSize: 12,
    fontWeight: '600',
  },
  importedSection: {
    width: '100%',
  },
  importedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  importedSectionTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  importedCountText: {
    color: '#71717A',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#141416',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272A',
    borderStyle: 'dashed',
    gap: 4,
  },
  emptyStateTitle: {
    color: '#EDEDED',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  emptyStateSubtitle: {
    color: '#71717A',
    fontSize: 10,
    textAlign: 'center',
  },
  importedList: {
    gap: 6,
  },
  importedAudioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 8,
    gap: 8,
  },
  importedAudioIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importedAudioInfo: {
    flex: 1,
  },
  importedAudioTitle: {
    color: '#EDEDED',
    fontSize: 12,
    fontWeight: '500',
  },
  importedAudioSubtitle: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 2,
  },
  importedAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 3,
  },
  importedAddBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '600',
  },
  categoriesScroll: {
    marginBottom: 10,
  },
  categoriesContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  categoryPillText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  sfxList: {
    gap: 6,
  },
  sfxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 8,
    gap: 8,
  },
  sfxPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sfxPlayBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  sfxInfo: {
    flex: 1,
  },
  sfxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sfxTitle: {
    color: '#EDEDED',
    fontSize: 12,
    fontWeight: '600',
  },
  sfxBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sfxBadgeText: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '600',
  },
  sfxDesc: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 2,
  },
  sfxAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 2,
  },
  sfxAddBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  voiceoverContainer: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  countdownBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  countdownNumber: {
    color: '#38BDF8',
    fontSize: 64,
    fontWeight: '800',
  },
  countdownLabel: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  voTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  voSubtitle: {
    color: '#71717A',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  timerDisplay: {
    marginBottom: 12,
  },
  timerDigits: {
    color: '#71717A',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  timerDigitsActive: {
    color: '#EF4444',
  },
  vuMeterContainer: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  vuMeterFill: {
    height: '100%',
    borderRadius: 2,
  },
  recordCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  recordCircleActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderColor: '#EF4444',
  },
  recordInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EF4444',
  },
  recordInnerActive: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  recordActionHint: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 16,
  },
  duckingNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '90%',
  },
  duckingNoteText: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
  },
  extractContainer: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  extractHero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  extractHeroTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  extractHeroSub: {
    color: '#71717A',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
  },
});
