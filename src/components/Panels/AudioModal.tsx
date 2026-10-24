import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
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
              <Text style={styles.sheetTitle}>Import Audio</Text>
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

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Direct Device Audio Upload Box */}
            <View style={styles.uploadPromptContainer}>
              <View style={styles.uploadIconOuterCircle}>
                <View style={styles.uploadIconInnerCircle}>
                  <Ionicons name="musical-notes" size={38} color="#10B981" />
                </View>
              </View>

              <Text style={styles.uploadMainTitle}>Upload Audio From Device</Text>
              <Text style={styles.uploadSubtitle}>
                Select MP3, WAV, M4A, AAC, or FLAC audio files from your device to add directly to your project.
              </Text>

              {/* Supported Format Pills */}
              <View style={styles.formatPillsRow}>
                <View style={styles.formatPill}>
                  <Ionicons name="musical-note" size={12} color="#10B981" />
                  <Text style={styles.formatPillText}>MP3 / WAV</Text>
                </View>
                <View style={styles.formatPill}>
                  <Ionicons name="musical-note" size={12} color="#34D399" />
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
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="cloud-upload" size={19} color="#000000" />
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
                    size={15}
                    color={hasBeats ? '#000000' : '#FFE600'}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  uploadPromptContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  uploadIconOuterCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadIconInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadMainTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  uploadSubtitle: {
    color: '#8E95A5',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: 18,
  },
  formatPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  formatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  formatPillText: {
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  primaryUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryUploadButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  beatsUtilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 230, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 230, 0, 0.3)',
  },
  beatsUtilityBtnActive: {
    backgroundColor: '#FFE600',
    borderColor: '#FFE600',
  },
  beatsUtilityBtnText: {
    color: '#FFE600',
    fontSize: 12,
    fontWeight: '800',
  },
  beatsUtilityBtnTextActive: {
    color: '#000000',
  },
});
