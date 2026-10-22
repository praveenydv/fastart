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
import { addNotification } from '../../utils/storage';
import { persistLargeMedia } from '../../utils/largeMediaStorage';

interface MediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddMedia: (clip: any) => void;
}

export default function MediaPickerModal({ visible, onClose, onAddMedia }: MediaPickerModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Directly ask to upload whenever modal becomes visible
  useEffect(() => {
    if (visible) {
      handleDeviceUpload();
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
              <Text style={styles.sheetTitle}>Import Media</Text>
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
            {/* Direct Device Upload Box */}
            <View style={styles.uploadPromptContainer}>
              <View style={styles.uploadIconOuterCircle}>
                <View style={styles.uploadIconInnerCircle}>
                  <Ionicons name="cloud-upload" size={40} color="#00F2FE" />
                </View>
              </View>

              <Text style={styles.uploadMainTitle}>Upload From Device</Text>
              <Text style={styles.uploadSubtitle}>
                Select video or photo from your device library to add directly to your project timeline.
              </Text>

              {/* Supported Format Pills */}
              <View style={styles.formatPillsRow}>
                <View style={styles.formatPill}>
                  <Ionicons name="videocam-outline" size={12} color="#00F2FE" />
                  <Text style={styles.formatPillText}>MP4 / MOV / WebM</Text>
                </View>
                <View style={styles.formatPill}>
                  <Ionicons name="image-outline" size={12} color="#10B981" />
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
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="add-circle" size={20} color="#000000" />
                )}
                <Text style={styles.primaryUploadButtonText}>
                  {isLoading ? 'Importing Media...' : 'Choose File From Device'}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadIconInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 242, 254, 0.16)',
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
    backgroundColor: '#00F2FE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#00F2FE',
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
});
