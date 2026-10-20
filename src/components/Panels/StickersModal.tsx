import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STICKER_LIBRARY } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

export default function StickersModal({ visible, onClose, onAddSticker }) {
  const handleSelectSticker = (item) => {
    const stickerClip = {
      id: 'clip-s-' + Date.now(),
      char: item.char,
      startTime: 1.0,
      duration: 3.5,
      position: { x: 50, y: 50 },
      scale: 1.2,
      rotation: 0,
    };
    soundEngine.playSfx('pop');
    onAddSticker(stickerClip);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Stickers & Emojis</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            <Text style={styles.sectionTitle}>REACTION STICKERS</Text>
            <View style={styles.grid}>
              {STICKER_LIBRARY.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.stickerCard}
                  onPress={() => handleSelectSticker(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stickerEmoji}>{item.char}</Text>
                  <Text style={styles.stickerLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    padding: 16,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stickerCard: {
    width: '22%',
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  stickerEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  stickerLabel: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '600',
  },
});
