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
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { soundEngine } from '../../utils/audioEngine';
import {
  loadUploadedMedia,
  saveUploadedMedia,
  addNotification,
} from '../../utils/storage';
import { persistLargeMedia } from '../../utils/largeMediaStorage';

interface MediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddMedia: (clip: any) => void;
}

export default function MediaPickerModal({ visible, onClose, onAddMedia }: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'photo'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<any[]>(loadUploadedMedia());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setUploadedMedia(loadUploadedMedia());
    }
  }, [visible]);

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
                mediaDuration: saved.duration,
                speed: 1.0,
                volume: 1.0,
                filter: 'normal',
                effect: 'none',
                transform: { scale: 1, rotation: 0, x: 0, y: 0 },
              };

              setUploadedMedia((prev) => {
                const updated = [clip, ...prev.filter((m) => m.id !== clip.id)];
                saveUploadedMedia(updated);
                return updated;
              });

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
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsEditing: false,
          quality: 1,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          const isVideo = asset.type === 'video';
          const dur = asset.duration ? asset.duration / 1000 : isVideo ? 6.0 : 4.0;
          const clip = {
            id: 'clip-' + Date.now(),
            sourceMediaId: 'clip-' + Date.now(),
            title: asset.fileName || (isVideo ? 'Imported Video' : 'Imported Photo'),
            type: isVideo ? 'video' : 'photo',
            url: asset.uri,
            duration: dur,
            startTime: 0,
            trimIn: 0,
            trimOut: dur,
            mediaDuration: dur,
            speed: 1.0,
            volume: 1.0,
            filter: 'normal',
            effect: 'none',
            transform: { scale: 1, rotation: 0, x: 0, y: 0 },
          };

          setUploadedMedia((prev) => {
            const updated = [clip, ...prev.filter((m) => m.id !== clip.id)];
            saveUploadedMedia(updated);
            return updated;
          });

          addNotification({
            title: 'Media Added',
            message: `Added "${clip.title}" to project timeline.`,
            icon: clip.type === 'video' ? 'videocam-outline' : 'image-outline',
          });

          soundEngine.playSfx('pop');
          onAddMedia(clip);
          onClose();
        }
      }
    } catch (err) {
      console.warn('Error picking media from device:', err);
      setIsLoading(false);
    }
  };

  const handleSelectUploadedMedia = (item: any) => {
    const clip = {
      ...item,
      id: 'clip-' + Date.now(),
      sourceMediaId: item.sourceMediaId || item.id,
      startTime: 0,
      trimIn: 0,
      trimOut: item.duration || 5.0,
      mediaDuration: item.mediaDuration || item.duration || 5.0,
    };
    soundEngine.playSfx('pop');
    onAddMedia(clip);
    onClose();
  };

  const handleDeleteMedia = (id: string, e: any) => {
    e?.stopPropagation?.();
    soundEngine.playSfx('pop');
    setUploadedMedia((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveUploadedMedia(updated);
      return updated;
    });
  };

  const filteredMedia = uploadedMedia.filter((m) => {
    if (activeTab === 'video' && m.type !== 'video') return false;
    if (activeTab === 'photo' && m.type !== 'photo') return false;
    if (!searchQuery.trim()) return true;
    return (m.title || '').toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const videoCount = uploadedMedia.filter((m) => m.type === 'video').length;
  const photoCount = uploadedMedia.filter((m) => m.type === 'photo').length;

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
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={17} color="#EF4444" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="images-outline" size={17} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Device Media</Text>
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

          {/* Search Bar & Type Filter */}
          <View style={styles.filterSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#8E95A5" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search device media..."
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

            {/* Filter Tabs (All / Videos / Photos) */}
            <View style={styles.typeFilterRow}>
              <TouchableOpacity
                style={[styles.typePill, activeTab === 'all' && styles.typePillActive]}
                onPress={() => setActiveTab('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.typePillText, activeTab === 'all' && styles.typePillTextActive]}>
                  All ({uploadedMedia.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typePill, activeTab === 'video' && styles.typePillActive]}
                onPress={() => setActiveTab('video')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="videocam-outline"
                  size={13}
                  color={activeTab === 'video' ? '#00F2FE' : '#8E95A5'}
                />
                <Text style={[styles.typePillText, activeTab === 'video' && styles.typePillTextActive]}>
                  Videos ({videoCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typePill, activeTab === 'photo' && styles.typePillActive]}
                onPress={() => setActiveTab('photo')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="image-outline"
                  size={13}
                  color={activeTab === 'photo' ? '#00F2FE' : '#8E95A5'}
                />
                <Text style={[styles.typePillText, activeTab === 'photo' && styles.typePillTextActive]}>
                  Photos ({photoCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Quick Device Import Card */}
            <TouchableOpacity
              style={styles.deviceImportCard}
              onPress={handleDeviceUpload}
              activeOpacity={0.8}
            >
              <View style={styles.deviceIconBox}>
                <Ionicons name="cloud-upload" size={24} color="#000000" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.deviceCardTitle}>Upload From Device</Text>
                <Text style={styles.deviceCardSubtext}>
                  Select video (MP4, MOV) or photo from your library
                </Text>
              </View>
              <View style={styles.uploadChevronBox}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#00F2FE" />
                ) : (
                  <Ionicons name="add" size={20} color="#00F2FE" />
                )}
              </View>
            </TouchableOpacity>

            {/* List of Device Uploads */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>
                DEVICE MEDIA ({filteredMedia.length})
              </Text>
            </View>

            {filteredMedia.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="folder-open-outline" size={40} color="#374151" />
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim() ? 'No Matching Media Found' : 'No Device Media Yet'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery.trim()
                    ? `No media matching "${searchQuery}". Try a different keyword.`
                    : 'Tap "Upload From Device" above to add videos or photos from your library.'}
                </Text>
              </View>
            ) : (
              filteredMedia.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.sampleMediaCard}
                  onPress={() => handleSelectUploadedMedia(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.thumbBox}>
                    {item.type === 'photo' ? (
                      <Image
                        source={{ uri: item.url }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.videoPlaceholder}>
                        <Ionicons name="videocam" size={22} color="#00F2FE" />
                      </View>
                    )}
                    <View style={styles.durationPill}>
                      <Text style={styles.durationText}>{item.duration}s</Text>
                    </View>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.sampleTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.sampleSubtext}>
                      {item.type.toUpperCase()} • Device File
                    </Text>
                  </View>

                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={(e) => handleDeleteMedia(item.id, e)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>

                    <View style={styles.addPill}>
                      <Ionicons name="add" size={14} color="#000000" />
                      <Text style={styles.addPillText}>Add</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Platform.OS === 'web' ? '76%' : '84%',
    borderTopWidth: 1,
    borderColor: '#1E2638',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2234',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sheetSubtitle: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E2638',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2234',
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0D14',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1E2638',
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    padding: 0,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#141A28',
    borderWidth: 1,
    borderColor: '#20283A',
  },
  typePillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
  },
  typePillText: {
    color: '#8E95A5',
    fontSize: 11.5,
    fontWeight: '700',
  },
  typePillTextActive: {
    color: '#00F2FE',
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  deviceImportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.07)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.28)',
    marginBottom: 10,
  },
  deviceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  deviceCardSubtext: {
    color: '#8E95A5',
    fontSize: 10.5,
    marginTop: 1,
  },
  uploadChevronBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    marginBottom: 6,
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sampleMediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141926',
    borderRadius: 10,
    padding: 7,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1E2638',
  },
  thumbBox: {
    width: 52,
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#0A0D14',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161E2E',
  },
  durationPill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
  },
  sampleTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  sampleSubtext: {
    color: '#8E95A5',
    fontSize: 10,
    marginTop: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addPillText: {
    color: '#000000',
    fontSize: 10.5,
    fontWeight: '800',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtext: {
    color: '#8E95A5',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 15,
  },
});
