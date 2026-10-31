import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { soundEngine } from '../../utils/audioEngine';
import { AudioClip, FastArtProject } from '../../types/project';
import {
  persistLargeMedia,
  pickWebMedia,
  persistNativeMediaCopy,
} from '../../utils/largeMediaStorage';

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
              handle,
              isLinked,
            });

            const audioClip: AudioClip = {
              id: 'clip-a-' + Date.now(),
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
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: false,
            quality: 1,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const dur = asset.duration ? asset.duration / 1000 : 15.0;
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
            soundEngine.playSfx('pop');
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
          <View style={styles.unifiedHeader}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="musical-notes" size={16} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Audio Studio</Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtnCircle}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
          {/* Full-Width Import Action Button */}
          <TouchableOpacity
            style={styles.fullWidthUploadButton}
            onPress={handleDeviceAudioUpload}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#00F2FE" />
            ) : (
              <Ionicons name="musical-notes-outline" size={16} color="#00F2FE" />
            )}
            <Text style={styles.fullWidthUploadButtonText}>
              {isLoading ? 'Importing Audio...' : '+ Import Audio File'}
            </Text>
          </TouchableOpacity>

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
                                duration: asset.duration || 5,
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
                      <Ionicons name="musical-note" size={16} color="#00F2FE" />
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
                        soundEngine.playSfx("pop");
                        onAddAudio({
                          id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          sourceMediaId: asset.sourceMediaId || asset.id,
                          title: asset.title || asset.name || "Audio Clip",
                          url: asset.url,
                          startTime: 0,
                          duration: asset.duration || 5,
                          volume: 1.0,
                          fadeIn: 0,
                          fadeOut: 0,
                        });
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={13} color="#000000" />
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
    backgroundColor: '#0F131D',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#0F131D',
    width: '100%',
    height: '100%',
  },
  unifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtnCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fullWidthUploadButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  fullWidthUploadButtonText: {
    color: '#00F2FE',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2637',
    borderStyle: 'dashed',
    gap: 4,
  },
  emptyStateTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyStateSubtitle: {
    color: '#64748B',
    fontSize: 10.5,
  },
  importedSection: {
    marginTop: 6,
    width: '100%',
  },
  importedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  importedSectionTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  importedCountText: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  importedList: {
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  importedAudioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121622',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2637',
    padding: 10,
    gap: 10,
  },
  importedAudioIconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importedAudioInfo: {
    flex: 1,
  },
  importedAudioTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  importedAudioSubtitle: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  importedAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderWidth: 1,
    borderColor: '#00F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 3,
  },
  importedAddBtnText: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
});
