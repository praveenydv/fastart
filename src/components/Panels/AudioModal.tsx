import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { ModalHeader } from '../Common';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AudioClip, FastArtProject } from '../../types/project';
import {
  persistLargeMedia,
  pickWebMedia,
  persistNativeMediaCopy,
} from '../../utils/largeMediaStorage';
import { detectBeatsFromPeaks } from '../../services/beatDetectionEngine';
import { extractRealMediaAudioPeaks } from '../../utils/mediaAudioDetector';

interface AudioModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAudio: (clip: AudioClip) => void;
  project?: FastArtProject | null;
  onUpdateProject?: (updates: any) => void;
  isInline?: boolean;
}

export default function AudioModal({
  visible,
  onClose,
  onAddAudio,
  project,
  onUpdateProject,
  isInline = false,
}: AudioModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingBeats, setIsDetectingBeats] = useState(false);

  const handleAutoBeatDetect = async () => {
    if (!project) return;
    const audioTrack = project.tracks?.audio?.[0];
    if (!audioTrack?.url) {
      Alert.alert(
        "No Audio Track",
        "Please add or import an audio track first to automatically detect rhythm beats."
      );
      return;
    }
    setIsDetectingBeats(true);
    try {
      const peaks = await extractRealMediaAudioPeaks(audioTrack.url, audioTrack.id);
      if (peaks && peaks.length > 0) {
        const beats = detectBeatsFromPeaks(peaks, audioTrack.duration || 10);
        if (onUpdateProject) {
          onUpdateProject({ beatMarkers: beats });
        }
      } else {
        Alert.alert("Beat Detection", "Could not detect distinct audio beats in this track.");
      }
    } catch (err: any) {
      console.warn("Beat detection failed:", err);
      Alert.alert("Beat Detection Failed", err?.message || "Could not analyze audio waveform.");
    } finally {
      setIsDetectingBeats(false);
    }
  };

  const handleClearBeats = () => {
    if (onUpdateProject) {
      onUpdateProject({ beatMarkers: [] });
    }
  };

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

  // Upload custom audio file from device storage (MP3, WAV, M4A, AAC, OGG, FLAC)
  // Web: Links directly to file location (zero bytes duplicate)
  // App: Copies to permanent app storage
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
              startTime: 0,
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

            // On Mobile: Copy to app's persistent Documents/media directory
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
              startTime: 0,
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

  if (!visible) return null;

  return (
    <View style={styles.inlineWrapper}>
      <View style={styles.sheetContainer}>
        {/* Unified Live Panel Header - only shown in standalone modal */}
        {!isInline && (
          <ModalHeader
            title="Audio"
            iconName="musical-notes"
            onClose={onClose}
          />
        )}

        <ScrollView
          style={styles.sheetBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Actions: Import Audio + Auto Beat Sync */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.fullWidthUploadButton, { flex: 1, marginVertical: 0 }]}
              onPress={handleDeviceAudioUpload}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="musical-notes-outline" size={15} color="#FFFFFF" />
              )}
              <Text style={styles.fullWidthUploadButtonText} numberOfLines={1}>
                {isLoading ? 'Importing...' : '+ Import Audio'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.fullWidthUploadButton,
                {
                  flex: 1,
                  marginVertical: 0,
                  backgroundColor: project?.beatMarkers?.length
                    ? 'rgba(255, 230, 0, 0.12)'
                    : 'rgba(255, 255, 255, 0.05)',
                  borderColor: project?.beatMarkers?.length
                    ? 'rgba(255, 230, 0, 0.6)'
                    : '#27272A',
                },
              ]}
              onPress={project?.beatMarkers?.length ? handleClearBeats : handleAutoBeatDetect}
              disabled={isDetectingBeats}
              activeOpacity={0.8}
            >
              {isDetectingBeats ? (
                <ActivityIndicator size="small" color="#FFE600" />
              ) : (
                <Ionicons
                  name={project?.beatMarkers?.length ? 'flash' : 'pulse-outline'}
                  size={15}
                  color={project?.beatMarkers?.length ? '#FFE600' : '#EDEDED'}
                />
              )}
              <Text
                style={[
                  styles.fullWidthUploadButtonText,
                  { color: project?.beatMarkers?.length ? '#FFE600' : '#EDEDED' },
                ]}
                numberOfLines={1}
              >
                {isDetectingBeats
                  ? 'Analyzing...'
                  : project?.beatMarkers?.length
                  ? `${project.beatMarkers.length} Beats (Clear)`
                  : 'Auto Beat Sync'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section: Project Imported Audio */}
          <View style={styles.importedSection}>
            <View style={styles.importedHeaderRow}>
              <Text style={styles.importedSectionTitle}>PROJECT AUDIO</Text>
              <Text style={styles.importedCountText}>{importedAudioAssets.length} tracks</Text>
            </View>

            {importedAudioAssets.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <Ionicons name="musical-note-outline" size={24} color="#64748B" />
                <Text style={styles.emptyStateTitle}>No audio tracks imported yet</Text>
                <Text style={styles.emptyStateSubtitle}>Click + Import above to add audio files</Text>
              </View>
            ) : (
              <View style={styles.importedList}>
                {importedAudioAssets.map((asset, idx) => (
                  <View
                    key={asset.id || idx}
                    style={[styles.importedAudioCard, Platform.OS === 'web' && ({ cursor: 'grab' } as any)]}
                    {...(Platform.OS === 'web'
                      ? {
                          draggable: true,
                          onDragStart: (e: any) => {
                            const payload = {
                              type: 'audio',
                              clip: {
                                id: `audio-${Date.now()}`,
                                sourceMediaId: asset.sourceMediaId || asset.id,
                                title: asset.title || asset.name || "Audio Clip",
                                url: asset.url,
                                startTime: 0,
                                duration: asset.duration ? (asset.duration > 1000 ? asset.duration / 1000 : asset.duration) : 5,
                                volume: 1.0,
                                fadeIn: 0,
                                fadeOut: 0,
                              },
                            };
                            e.dataTransfer?.setData('application/fastart-clip', JSON.stringify(payload));
                            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
                          },
                        }
                      : {})}
                  >
                    <View style={styles.importedAudioIconBox}>
                      <Ionicons name="musical-note" size={13} color="#FFFFFF" />
                    </View>
                    <View style={styles.importedAudioInfo}>
                      <Text style={styles.importedAudioTitle} numberOfLines={1}>
                        {asset.title || asset.name || `Audio ${idx + 1}`}
                      </Text>
                      <Text style={styles.importedAudioSubtitle}>
                        {asset.duration ? `${asset.duration.toFixed(1)}s` : '0.0s'} • Audio Track
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
                          startTime: 0,
                          duration: asset.duration ? (asset.duration > 1000 ? asset.duration / 1000 : asset.duration) : 5,
                          volume: 1.0,
                          fadeIn: 0,
                          fadeOut: 0,
                        });
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={11} color="#000000" />
                      <Text style={styles.importedAddBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121214',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#121214',
    width: '100%',
    height: '100%',
  },
  unifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
    backgroundColor: '#121214',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    color: '#EDEDED',
    fontSize: 11.5,
    fontWeight: '500',
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
  sheetBody: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  fullWidthUploadButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  fullWidthUploadButtonText: {
    color: '#EDEDED',
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: '#141416',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272A',
    borderStyle: 'dashed',
    gap: 3,
  },
  emptyStateTitle: {
    color: '#EDEDED',
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 3,
  },
  emptyStateSubtitle: {
    color: '#71717A',
    fontSize: 9,
  },
  importedSection: {
    marginTop: 4,
    width: '100%',
  },
  importedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 3,
  },
  importedSectionTitle: {
    color: '#8E8E93',
    fontSize: 8.5,
    fontWeight: '500',
    letterSpacing: 0.8,
  },
  importedCountText: {
    color: '#71717A',
    fontSize: 8.5,
    fontFamily: 'monospace',
  },
  importedList: {
    flexDirection: 'column',
    gap: 5,
    width: '100%',
  },
  importedAudioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 6,
    gap: 8,
  },
  importedAudioIconBox: {
    width: 28,
    height: 28,
    borderRadius: 5,
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
    fontSize: 10.5,
    fontWeight: '400',
    marginBottom: 1,
  },
  importedAudioSubtitle: {
    color: '#71717A',
    fontSize: 8.5,
    fontFamily: 'monospace',
  },
  importedAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 5,
    gap: 2,
  },
  importedAddBtnText: {
    color: '#121214',
    fontSize: 9.5,
    fontWeight: '500',
  },
});
