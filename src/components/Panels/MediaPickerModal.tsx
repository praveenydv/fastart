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
import { openMediaService, OpenMediaItem } from '../../services/openMediaService';
import { loadUploadedMedia, saveUploadedMedia } from '../../utils/storage';

interface MediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddMedia: (clip: any) => void;
}

export default function MediaPickerModal({ visible, onClose, onAddMedia }: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'photo' | 'uploaded'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaItems, setMediaItems] = useState<OpenMediaItem[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<any[]>(loadUploadedMedia());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setUploadedMedia(loadUploadedMedia());
    }
  }, [visible]);

  useEffect(() => {
    let isMounted = true;
    const fetchMedia = async () => {
      if (activeTab === 'uploaded') return;
      setIsLoading(true);
      try {
        const typeFilter = activeTab === 'all' ? 'all' : activeTab;
        const results = await openMediaService.searchMedia(searchQuery, typeFilter);
        if (isMounted) {
          setMediaItems(results);
        }
      } catch (err) {
        console.warn('Error fetching media:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchMedia, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab]);

  // Handle local device file upload
  const handleDeviceUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,image/*';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            const isVideo = file.type.startsWith('video');
            const clip = {
              id: 'clip-' + Date.now(),
              title: file.name.replace(/\.[^/.]+$/, ''),
              type: isVideo ? 'video' : 'photo',
              url,
              duration: isVideo ? 6.0 : 4.0,
              startTime: 0,
              trimIn: 0,
              trimOut: isVideo ? 6.0 : 4.0,
              speed: 1.0,
              volume: 1.0,
              filter: 'normal',
              effect: 'none',
              transform: { scale: 1, rotation: 0, x: 0, y: 0 },
            };

            setUploadedMedia((prev) => {
              const updated = [clip, ...prev];
              saveUploadedMedia(updated);
              return updated;
            });

            soundEngine.playSfx('pop');
            onAddMedia(clip);
            onClose();
          }
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
          const clip = {
            id: 'clip-' + Date.now(),
            title: asset.fileName || 'Imported Clip',
            type: asset.type === 'video' ? 'video' : 'photo',
            url: asset.uri,
            duration: asset.duration ? asset.duration / 1000 : 5.0,
            startTime: 0,
            trimIn: 0,
            trimOut: asset.duration ? asset.duration / 1000 : 5.0,
            speed: 1.0,
            volume: 1.0,
            filter: 'normal',
            effect: 'none',
            transform: { scale: 1, rotation: 0, x: 0, y: 0 },
          };

          setUploadedMedia((prev) => {
            const updated = [clip, ...prev];
            saveUploadedMedia(updated);
            return updated;
          });

          soundEngine.playSfx('pop');
          onAddMedia(clip);
          onClose();
        }
      }
    } catch (err) {
      console.warn('Error picking media:', err);
    }
  };

  const handleSelectOpenMedia = (item: OpenMediaItem) => {
    const clip = {
      id: 'clip-' + Date.now(),
      title: item.title,
      type: item.type,
      url: item.url,
      duration: item.duration,
      startTime: 0,
      trimIn: 0,
      trimOut: item.duration,
      speed: 1.0,
      volume: 1.0,
      filter: 'normal',
      effect: 'none',
      transform: { scale: 1, rotation: 0, x: 0, y: 0 },
    };
    soundEngine.playSfx('pop');
    onAddMedia(clip);
    onClose();
  };

  const handleSelectUploadedMedia = (item: any) => {
    const clip = {
      ...item,
      id: 'clip-' + Date.now(),
      startTime: 0,
      trimIn: 0,
      trimOut: item.duration || 5.0,
    };
    soundEngine.playSfx('pop');
    onAddMedia(clip);
    onClose();
  };

  const filteredUploaded = uploadedMedia.filter((m) => {
    if (!searchQuery.trim()) return true;
    return (m.title || '').toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Import Media</Text>
              <Text style={styles.sheetSubtitle}>Upload device files or pick live open-source media</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.filterSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#8E95A5" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={
                  activeTab === 'uploaded'
                    ? 'Search your uploaded media...'
                    : 'Search open-source library (cinematic, nature, timelapse)...'
                }
                placeholderTextColor="#64748B"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#8E95A5" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.typeFilterRow}>
              <TouchableOpacity
                style={[styles.typePill, activeTab === 'all' && styles.typePillActive]}
                onPress={() => setActiveTab('all')}
              >
                <Text style={[styles.typePillText, activeTab === 'all' && styles.typePillTextActive]}>
                  All Open Source
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typePill, activeTab === 'video' && styles.typePillActive]}
                onPress={() => setActiveTab('video')}
              >
                <Ionicons
                  name="videocam-outline"
                  size={12}
                  color={activeTab === 'video' ? '#00F2FE' : '#8E95A5'}
                />
                <Text style={[styles.typePillText, activeTab === 'video' && styles.typePillTextActive]}>
                  Videos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typePill, activeTab === 'photo' && styles.typePillActive]}
                onPress={() => setActiveTab('photo')}
              >
                <Ionicons
                  name="image-outline"
                  size={12}
                  color={activeTab === 'photo' ? '#00F2FE' : '#8E95A5'}
                />
                <Text style={[styles.typePillText, activeTab === 'photo' && styles.typePillTextActive]}>
                  Photos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typePill, activeTab === 'uploaded' && styles.typePillActive]}
                onPress={() => setActiveTab('uploaded')}
              >
                <Ionicons
                  name="cloud-done-outline"
                  size={12}
                  color={activeTab === 'uploaded' ? '#00F2FE' : '#8E95A5'}
                />
                <Text style={[styles.typePillText, activeTab === 'uploaded' && styles.typePillTextActive]}>
                  Uploaded ({uploadedMedia.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.sheetBody}>
            {/* Quick Device Import Card */}
            <TouchableOpacity style={styles.deviceImportCard} onPress={handleDeviceUpload} activeOpacity={0.8}>
              <View style={styles.deviceIconBox}>
                <Ionicons name="cloud-upload" size={26} color="#00F2FE" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.deviceCardTitle}>Upload From Device</Text>
                <Text style={styles.deviceCardSubtext}>
                  Select video (MP4, MOV) or photo from your computer/device
                </Text>
              </View>
              <View style={styles.uploadChevronBox}>
                <Ionicons name="add" size={20} color="#00F2FE" />
              </View>
            </TouchableOpacity>

            {/* TAB: UPLOADED MEDIA */}
            {activeTab === 'uploaded' && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeader}>YOUR UPLOADED MEDIA ({filteredUploaded.length})</Text>
                </View>

                {filteredUploaded.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="folder-open-outline" size={36} color="#374151" />
                    <Text style={styles.emptyTitle}>No Uploaded Media</Text>
                    <Text style={styles.emptySubtext}>
                      Click "Upload From Device" above to add videos or photos from your local library.
                    </Text>
                  </View>
                ) : (
                  filteredUploaded.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.sampleMediaCard}
                      onPress={() => handleSelectUploadedMedia(item)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.thumbBox}>
                        {item.type === 'photo' ? (
                          <Image source={{ uri: item.url }} style={styles.thumbImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.videoPlaceholder}>
                            <Ionicons name="videocam" size={22} color="#00F2FE" />
                          </View>
                        )}
                        <View style={styles.durationPill}>
                          <Text style={styles.durationText}>{item.duration}s</Text>
                        </View>
                      </View>

                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.sampleTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.sampleSubtext}>
                          {item.type.toUpperCase()} • Local Upload
                        </Text>
                        <View style={styles.licenseRow}>
                          <View style={[styles.licensePill, { backgroundColor: 'rgba(0,242,254,0.15)' }]}>
                            <Text style={[styles.licenseText, { color: '#00F2FE' }]}>Uploaded</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.addPill}>
                        <Ionicons name="add" size={14} color="#000000" />
                        <Text style={styles.addPillText}>Add</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}

            {/* TAB: OPEN SOURCE MEDIA LIBRARY */}
            {activeTab !== 'uploaded' && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.sectionHeader}>
                      {activeTab === 'video'
                        ? 'OPEN SOURCE VIDEOS (WIKIMEDIA COMMONS)'
                        : activeTab === 'photo'
                        ? 'OPEN SOURCE PHOTOS (OPENVERSE CC)'
                        : 'OPEN SOURCE MEDIA LIBRARY'}
                    </Text>
                    <View style={styles.ossBadge}>
                      <Ionicons name="globe-outline" size={10} color="#00F2FE" />
                      <Text style={styles.ossBadgeText}>CC0 & Creative Commons</Text>
                    </View>
                  </View>
                </View>

                {isLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#00F2FE" />
                    <Text style={styles.loadingText}>Searching open-source media library...</Text>
                  </View>
                ) : mediaItems.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="search-outline" size={36} color="#374151" />
                    <Text style={styles.emptyTitle}>No Media Found</Text>
                    <Text style={styles.emptySubtext}>
                      Try searching with other keywords like "nature", "sky", "city", or "timelapse".
                    </Text>
                  </View>
                ) : (
                  mediaItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.sampleMediaCard}
                      onPress={() => handleSelectOpenMedia(item)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.thumbBox}>
                        {item.type === 'photo' ? (
                          <Image
                            source={{ uri: item.thumbnailUrl || item.url }}
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

                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.sampleTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.sampleSubtext}>
                          {item.width}x{item.height} • {item.source}
                        </Text>
                        <View style={styles.licenseRow}>
                          <View style={styles.licensePill}>
                            <Text style={styles.licenseText}>{item.license}</Text>
                          </View>
                          {item.author && (
                            <Text style={styles.authorText} numberOfLines={1}>
                              by {item.author}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.addPill}>
                        <Ionicons name="add" size={14} color="#000000" />
                        <Text style={styles.addPillText}>Add</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '84%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sheetSubtitle: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0F15',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    padding: 0,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1A1E2B',
    borderWidth: 1,
    borderColor: '#252B3B',
  },
  typePillActive: {
    backgroundColor: 'rgba(0,242,254,0.12)',
    borderColor: '#00F2FE',
  },
  typePillText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#00F2FE',
  },
  sheetBody: {
    padding: 16,
  },
  deviceImportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.06)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    marginBottom: 16,
  },
  deviceIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deviceCardSubtext: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  uploadChevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,242,254,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeader: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  ossBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,242,254,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,242,254,0.25)',
  },
  ossBadgeText: {
    color: '#00F2FE',
    fontSize: 9,
    fontWeight: '700',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    color: '#8E95A5',
    fontSize: 12,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  sampleMediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E2B',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#252B3B',
  },
  thumbBox: {
    width: 68,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#0D0F15',
    overflow: 'hidden',
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
    backgroundColor: '#1E2333',
  },
  durationPill: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  sampleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sampleSubtext: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  licensePill: {
    backgroundColor: '#252B3B',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  licenseText: {
    color: '#00F2FE',
    fontSize: 9,
    fontWeight: '700',
  },
  authorText: {
    color: '#64748B',
    fontSize: 10,
    maxWidth: 120,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addPillText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
});
