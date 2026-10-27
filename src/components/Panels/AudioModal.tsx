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
import { persistLargeMedia } from '../../utils/largeMediaStorage';
import { detectAudioBeats, toggleProjectBeatMarkers } from '../../utils/audioBeatDetector';

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
  const [isLoading, setIsLoading] = useState(false);

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
        };
        setTimeout(() => {
          try {
            input.click();
          } catch (_) {}
        }, 40);
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
              url: asset.uri,
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

  const hasBeats = Boolean(project?.beatMarkers && project.beatMarkers.length > 0);

  const handleToggleBeats = async () => {
    if (!project || !onUpdateProject) return;
    soundEngine.playSfx('click');
    const res = await detectAudioBeats(project);
    const updated = toggleProjectBeatMarkers(project, res.beats);
    onUpdateProject(updated);
    soundEngine.playSfx('pop');
  };

  if (!visible) return null;

  return (
    <View style={styles.inlineWrapper}>
      <View style={styles.sheetContainer}>
        {/* Unified Live Panel Header */}
        <View style={styles.unifiedHeader}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="musical-notes" size={16} color="#00F2FE" />
            <Text style={styles.sheetTitle}>Import Audio</Text>
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

        <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Direct Device Audio Upload Box */}
            <View style={styles.uploadPromptContainer}>
              <View style={styles.uploadIconOuterCircle}>
                <View style={styles.uploadIconInnerCircle}>
                  <Ionicons name="musical-notes" size={28} color="#00F2FE" />
                </View>
              </View>

              <Text style={styles.uploadMainTitle}>Upload Audio From Device</Text>
              <Text style={styles.uploadSubtitle}>
                Select MP3, WAV, M4A, AAC, or FLAC audio files from your device to add directly to your project.
              </Text>

              {/* Supported Format Pills */}
              <View style={styles.formatPillsRow}>
                <View style={styles.formatPill}>
                  <Ionicons name="musical-note" size={12} color="#00F2FE" />
                  <Text style={styles.formatPillText}>MP3 / WAV</Text>
                </View>
                <View style={styles.formatPill}>
                  <Ionicons name="musical-note" size={12} color="#00F2FE" />
                  <Text style={styles.formatPillText}>M4A / AAC / FLAC</Text>
                </View>
              </View>

              {/* Primary Direct Upload Button */}
              <TouchableOpacity
                style={styles.primaryUploadButton}
                onPress={handleDeviceAudioUpload}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#08090E" />
                ) : (
                  <Ionicons name="cloud-upload" size={16} color="#08090E" />
                )}
                <Text style={styles.primaryUploadButtonText}>
                  {isLoading ? 'Importing Audio...' : 'Choose Audio File'}
                </Text>
              </TouchableOpacity>

              {/* Optional AI Beat Detection Utility */}
              {project && onUpdateProject && (
                <TouchableOpacity
                  onPress={handleToggleBeats}
                  style={[
                    styles.beatsUtilityBtn,
                    hasBeats && styles.beatsUtilityBtnActive,
                  ]}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="musical-note"
                    size={14}
                    color={hasBeats ? '#00F2FE' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      styles.beatsUtilityBtnText,
                      hasBeats && styles.beatsUtilityBtnTextActive,
                    ]}
                  >
                    {hasBeats ? '✓ AI Beat Markers Active' : 'Detect AI Beat Markers'}
                  </Text>
                </TouchableOpacity>
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
    paddingVertical: 14,
  },
  uploadPromptContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  uploadIconOuterCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadIconInnerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 242, 254, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadMainTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  uploadSubtitle: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 14,
  },
  formatPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  formatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  formatPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  primaryUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00F2FE',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 280,
  },
  primaryUploadButtonText: {
    color: '#08090E',
    fontSize: 12,
    fontWeight: '700',
  },
  beatsUtilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  beatsUtilityBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
  },
  beatsUtilityBtnText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  beatsUtilityBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
});
