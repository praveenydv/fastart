import React, { useState } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { soundEngine } from '../../utils/audioEngine';
import { addNotification } from '../../utils/storage';
import { persistLargeMedia } from '../../utils/largeMediaStorage';
import { FastArtProject } from '../../types/project';

interface MediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddMedia: (clip: any) => void;
  project?: FastArtProject;
  onDeleteMedia?: (clipId: string, clipType?: string) => void;
}

export default function MediaPickerModal({ visible, onClose, onAddMedia, project, onDeleteMedia }: MediaPickerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const projectClips = project?.tracks?.video || [];

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
                duration: saved.duration,
                startTime: 0,
                trimIn: 0,
                trimOut: saved.duration,
                mediaDuration: isVideo ? saved.duration : undefined,
                speed: 1.0,
                volume: 1.0,
                filter: 'normal',
                effect: 'none',
                transform: { scale: 1, rotation: 0, x: 0, y: 0 },
              };

              addNotification({
                title: 'Media Added',
                message: `Added "${clip.title}" to project timeline.`,
                icon: clip.type === 'video' ? 'videocam-outline' : 'image-outline',
              });

              soundEngine.playSfx('pop');
              onAddMedia(clip);
              onClose();
            } finally {
              setIsLoading(false);
            }
          }
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
            'FastArt needs media library access to import photos and videos into your project.'
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
            const isVideo = asset.type === 'video';
            const dur = asset.duration ? asset.duration / 1000 : isVideo ? 6.0 : 4.0;

            let thumbnailUri: string | undefined = !isVideo ? asset.uri : undefined;
            if (isVideo) {
              try {
                const { getThumbnailAsync } = await import('expo-video-thumbnails');
                const thumb = await getThumbnailAsync(asset.uri, { time: 500 });
                if (thumb && thumb.uri) {
                  thumbnailUri = thumb.uri;
                }
              } catch (thumbErr) {
                console.warn('Video thumbnail generation fallback:', thumbErr);
              }
            }

            const clip = {
              id: 'clip-' + Date.now(),
              sourceMediaId: 'clip-' + Date.now(),
              title: asset.fileName || (isVideo ? 'Imported Video' : 'Imported Photo'),
              type: isVideo ? 'video' : 'photo',
              url: asset.uri,
              thumbnail: thumbnailUri,
              duration: dur,
              startTime: 0,
              trimIn: 0,
              trimOut: dur,
              mediaDuration: isVideo ? dur : undefined,
              speed: 1.0,
              volume: 1.0,
              filter: 'normal',
              effect: 'none',
              transform: { scale: 1, rotation: 0, x: 0, y: 0 },
            };

            addNotification({
              title: 'Media Added',
              message: `Added "${clip.title}" to project timeline.`,
              icon: clip.type === 'video' ? 'videocam-outline' : 'image-outline',
            });

            soundEngine.playSfx('pop');
            onAddMedia(clip);
            onClose();
          }
        } finally {
          setIsLoading(false);
        }
      }
    } catch (err: any) {
      console.warn('Error picking media from device:', err);
      Alert.alert(
        'Import Failed',
        err?.message || 'Unable to import selected media from your device. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType={Platform.OS === "web" ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Standardized Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={15} color="#94A3B8" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="images-outline" size={15} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Import Media</Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: '#00F2FE', borderColor: '#00F2FE' }]}
              activeOpacity={0.7}
              accessibilityLabel="Done"
            >
              <Ionicons name="checkmark" size={15} color="#08090E" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Direct Device Upload Box */}
            <View style={styles.uploadPromptContainer}>
              <View style={styles.uploadIconOuterCircle}>
                <View style={styles.uploadIconInnerCircle}>
                  <Ionicons name="cloud-upload" size={32} color="#00F2FE" />
                </View>
              </View>

              <Text style={styles.uploadMainTitle}>Upload From Device</Text>
              <Text style={styles.uploadSubtitle}>
                Select video or photo from your device library to add directly to your project timeline.
              </Text>

              {/* Supported Format Pills */}
              <View style={styles.formatPillsRow}>
                <View style={styles.formatPill}>
                  <Ionicons name="videocam-outline" size={11} color="#00F2FE" />
                  <Text style={styles.formatPillText}>MP4 / MOV / WebM</Text>
                </View>
                <View style={styles.formatPill}>
                  <Ionicons name="image-outline" size={11} color="#00F2FE" />
                  <Text style={styles.formatPillText}>JPG / PNG / WebP</Text>
                </View>
              </View>

              {/* Primary Direct Upload Button */}
              <TouchableOpacity
                style={styles.primaryUploadButton}
                onPress={handleDeviceUpload}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#08090E" />
                ) : (
                  <Ionicons name="add-circle" size={16} color="#08090E" />
                )}
                <Text style={styles.primaryUploadButtonText}>
                  {isLoading ? 'Importing Media...' : 'Choose File From Device'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Section: Already Imported Project Media */}
            {projectClips.length > 0 && (
              <View style={styles.importedSection}>
                <View style={styles.importedHeaderRow}>
                  <Text style={styles.importedSectionTitle}>IMPORTED IN PROJECT</Text>
                  <Text style={styles.importedCountText}>{projectClips.length} items</Text>
                </View>

                <View style={styles.importedGrid}>
                  {projectClips.map((clip, idx) => (
                    <View key={clip.id || idx} style={styles.importedCard}>
                      <View style={styles.importedThumbBox}>
                        {clip.thumbnail ? (
                          <Image source={{ uri: clip.thumbnail }} style={styles.importedThumbImg} />
                        ) : (
                          <View style={styles.importedThumbFallback}>
                            <Ionicons
                              name={clip.type === 'photo' ? 'image-outline' : 'videocam-outline'}
                              size={20}
                              color="#00F2FE"
                            />
                          </View>
                        )}
                        <View style={styles.importedDurBadge}>
                          <Text style={styles.importedDurText}>
                            {clip.duration ? `${clip.duration.toFixed(1)}s` : '0.0s'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.importedCardInfo}>
                        <Text style={styles.importedTitle} numberOfLines={1}>
                          {clip.title || `Clip ${idx + 1}`}
                        </Text>
                        <View style={styles.importedMetaRow}>
                          <Text style={styles.importedTypeTag}>
                            {clip.type === 'photo' ? 'PHOTO' : 'VIDEO'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            {onDeleteMedia && (
                              <TouchableOpacity
                                style={styles.importedDeleteBtn}
                                onPress={() => {
                                  soundEngine.playSfx('cut');
                                  onDeleteMedia(clip.id, clip.type || 'video');
                                }}
                                activeOpacity={0.7}
                                accessibilityLabel="Delete clip"
                              >
                                <Ionicons name="trash-outline" size={12} color="#EF4444" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.importedAddBtn}
                              onPress={() => {
                                soundEngine.playSfx('pop');
                                onAddMedia({
                                  ...clip,
                                  id: `clip-copy-${Date.now()}`,
                                  startTime: 0,
                                });
                                onClose();
                              }}
                              activeOpacity={0.7}
                              accessibilityLabel="Add to timeline"
                            >
                              <Ionicons name="add" size={13} color="#000000" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#1F2637',
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: '#1F2637',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  closeBtn: {
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
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  uploadPromptContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  uploadIconOuterCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 242, 254, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadIconInnerCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadMainTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  uploadSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 16,
  },
  formatPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  formatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formatPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  primaryUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00F2FE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 280,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryUploadButtonText: {
    color: '#08090E',
    fontSize: 12.5,
    fontWeight: '800',
  },
  importedSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1F2637',
    paddingTop: 16,
  },
  importedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  importedSectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  importedCountText: {
    color: '#00F2FE',
    fontSize: 10.5,
    fontWeight: '700',
  },
  importedGrid: {
    gap: 8,
  },
  importedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2637',
    overflow: 'hidden',
    paddingRight: 8,
  },
  importedThumbBox: {
    width: 60,
    height: 48,
    backgroundColor: '#08090E',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  importedThumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  importedThumbFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importedDurBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  importedDurText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  importedCardInfo: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  importedTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  importedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  importedTypeTag: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  importedDeleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  importedAddBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
