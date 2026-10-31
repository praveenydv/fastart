import React, { useState, useMemo } from 'react';
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
import {
  persistLargeMedia,
  pickWebMedia,
  persistNativeMediaCopy,
} from '../../utils/largeMediaStorage';
import { FastArtProject } from '../../types/project';

interface MediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddMedia: (clip: any) => void;
  project?: FastArtProject;
  onDeleteMedia?: (clipId: string, clipType?: string) => void;
  isInline?: boolean;
}

export default function MediaPickerModal({ visible, onClose, onAddMedia, project, onDeleteMedia, isInline = false }: MediaPickerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const importedAssets = useMemo(() => {
    if (Array.isArray(project?.assets)) {
      return project.assets.filter((a) => a.type === 'video' || a.type === 'photo');
    }
    const map = new Map<string, any>();
    (project?.tracks?.video || []).forEach((c) => {
      const key = c.sourceMediaId || c.url || c.id;
      if (!map.has(key)) {
        map.set(key, c);
      }
    });
    return Array.from(map.values());
  }, [project?.assets, project?.tracks?.video]);

  // Handle local device file upload (video / photo)
  // Web: Links directly to file location (zero bytes duplicate)
  // App: Copies to permanent app storage
  const handleDeviceUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        const picked = await pickWebMedia('all');
        if (!picked) return;

        setIsLoading(true);
        try {
          const { file, handle, isLinked } = picked;
          const isVideo = file.type.startsWith('video');
          const mediaId = 'clip-' + Date.now();
          const title = file.name.replace(/\.[^/.]+$/, '');

          const saved = await persistLargeMedia(file, mediaId, title, isVideo ? 'video' : 'photo', {
            handle,
            isLinked,
          });

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
            isLinked,
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
            const mediaId = 'clip-' + Date.now();
            const dur = asset.duration ? asset.duration / 1000 : isVideo ? 6.0 : 4.0;

            // On Mobile: Copy to app's persistent Documents/media directory
            const persistentUri = await persistNativeMediaCopy(
              asset.uri,
              mediaId,
              asset.fileName
            );

            let thumbnailUri: string | undefined = !isVideo ? persistentUri : undefined;
            if (isVideo) {
              try {
                const { getThumbnailAsync } = await import('expo-video-thumbnails');
                const thumb = await getThumbnailAsync(persistentUri, { time: 500 });
                if (thumb && thumb.uri) {
                  thumbnailUri = thumb.uri;
                }
              } catch (thumbErr) {
                console.warn('Video thumbnail generation fallback:', thumbErr);
              }
            }

            const clip = {
              id: mediaId,
              sourceMediaId: mediaId,
              title: asset.fileName || (isVideo ? 'Imported Video' : 'Imported Photo'),
              type: isVideo ? 'video' : 'photo',
              url: persistentUri,
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

  if (!visible) return null;

  const sheetContent = (
    <View style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Standardized Header */}
      {!isInline && (
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
      )}

      <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
        {/* Full-Width Import Action Button */}
        <TouchableOpacity
          style={styles.fullWidthUploadButton}
          onPress={handleDeviceUpload}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#00F2FE" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={16} color="#00F2FE" />
          )}
          <Text style={styles.fullWidthUploadButtonText}>
            {isLoading ? 'Importing Media...' : '+ Import Video / Photo'}
          </Text>
        </TouchableOpacity>

        {/* Section: Project Assets */}
        <View style={styles.importedSection}>
          <View style={styles.importedHeaderRow}>
            <Text style={styles.importedSectionTitle}>PROJECT ASSETS</Text>
            <Text style={styles.importedCountText}>{importedAssets.length} items</Text>
          </View>

          {importedAssets.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Ionicons name="film-outline" size={24} color="#64748B" />
              <Text style={styles.emptyStateTitle}>No media imported yet</Text>
              <Text style={styles.emptyStateSubtitle}>Click + Import above to add video or photos</Text>
            </View>
          ) : (
            <View style={styles.importedGrid}>
              {importedAssets.map((clip, idx) => (
                <View
                  key={clip.id || idx}
                  style={[styles.importedCard, Platform.OS === 'web' && ({ cursor: 'grab' } as any)]}
                  {...(Platform.OS === 'web'
                    ? {
                        draggable: true,
                        onDragStart: (e: any) => {
                          const payload = {
                            type: 'media',
                            clip: {
                              ...clip,
                              id: `clip-${Date.now()}`,
                              sourceMediaId: clip.sourceMediaId || clip.id,
                              duration: clip.duration || 4.0,
                            },
                          };
                          e.dataTransfer?.setData('application/fastart-clip', JSON.stringify(payload));
                          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
                        },
                      }
                    : {})}
                >
                  <View style={styles.importedThumbBox}>
                    {clip.thumbnail ? (
                      <Image source={{ uri: clip.thumbnail }} style={styles.importedThumbImg} />
                    ) : (
                      <View style={styles.importedThumbFallback}>
                        <Ionicons
                          name={clip.type === 'photo' ? 'image-outline' : 'videocam-outline'}
                          size={18}
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {onDeleteMedia && (
                          <TouchableOpacity
                            style={styles.importedDeleteBtn}
                            onPress={() => {
                              soundEngine.playSfx('cut');
                              onDeleteMedia(clip.id, clip.type || 'video');
                            }}
                            activeOpacity={0.7}
                            accessibilityLabel="Delete clip from project assets"
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
                              id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              sourceMediaId: clip.sourceMediaId || clip.id,
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
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (isInline) {
    return <View style={styles.inlineWrapper}>{sheetContent}</View>;
  }

  return (
    <Modal visible={visible} animationType={Platform.OS === "web" ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {sheetContent}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0F131D',
  },
  inlineSheetContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
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
