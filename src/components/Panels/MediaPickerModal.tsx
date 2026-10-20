import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SAMPLE_VIDEOS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

export default function MediaPickerModal({ visible, onClose, onAddMedia }) {
  // Handle local device file upload
  const handleDeviceUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        // Standard HTML5 file picker for instant video import
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,image/*';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
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
            title: 'Imported Clip',
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
          soundEngine.playSfx('pop');
          onAddMedia(clip);
          onClose();
        }
      }
    } catch (err) {
      console.warn('Error picking media:', err);
    }
  };

  const handleSelectSample = (sample) => {
    const clip = {
      id: 'clip-' + Date.now(),
      title: sample.title,
      type: 'video',
      url: sample.url,
      duration: sample.duration,
      startTime: 0,
      trimIn: 0,
      trimOut: sample.duration,
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Import Media</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            {/* Device Import Button */}
            <TouchableOpacity style={styles.deviceImportCard} onPress={handleDeviceUpload}>
              <View style={styles.deviceIconBox}>
                <Ionicons name="folder-open" size={28} color="#00F2FE" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.deviceCardTitle}>Upload From Device</Text>
                <Text style={styles.deviceCardSubtext}>
                  Select your own MP4, MOV videos, or photos from storage
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E95A5" />
            </TouchableOpacity>

            {/* Curated Authentic Stock Media Library */}
            <Text style={styles.sectionHeader}>VERIFIED VIDEO LIBRARY</Text>

            {SAMPLE_VIDEOS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.sampleMediaCard}
                onPress={() => handleSelectSample(item)}
              >
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={20} color="#00F2FE" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.sampleTitle}>{item.title}</Text>
                  <Text style={styles.sampleSubtext}>
                    {item.duration}s • {item.width}x{item.height} • Genuine MP4
                  </Text>
                </View>
                <View style={styles.addPill}>
                  <Text style={styles.addPillText}>+ Add</Text>
                </View>
              </TouchableOpacity>
            ))}
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
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    padding: 16,
  },
  deviceImportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2333',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A354D',
    marginBottom: 20,
  },
  deviceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deviceCardSubtext: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sampleMediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10131A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  videoBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1A2130',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sampleSubtext: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  addPill: {
    backgroundColor: '#00F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addPillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
});
