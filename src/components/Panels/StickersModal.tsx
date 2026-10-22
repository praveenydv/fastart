import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STICKER_LIBRARY } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

import { StickerClip } from '../../types/project';

interface StickersModalProps {
  visible: boolean;
  onClose: () => void;
  onAddSticker: (clip: StickerClip) => void;
  editingClip?: StickerClip | null;
  onUpdateSticker?: (clip: StickerClip) => void;
  currentPlayheadTime?: number;
}

export default function StickersModal({
  visible,
  onClose,
  onAddSticker,
  editingClip,
  onUpdateSticker,
  currentPlayheadTime = 0,
}: StickersModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [duration, setDuration] = useState(3.0);
  const [selectedAnim, setSelectedAnim] = useState<string>('bounce');

  React.useEffect(() => {
    if (visible) {
      if (editingClip) {
        setDuration(editingClip.duration || 3.0);
        setSelectedAnim(editingClip.animation || 'bounce');
      } else {
        setDuration(3.0);
        setSelectedAnim('bounce');
      }
    }
  }, [visible, editingClip]);

  const STICKER_ANIMATIONS = [
    { id: 'none', label: 'None', icon: 'remove-circle-outline' },
    { id: 'bounce', label: 'Bounce', icon: 'trending-up' },
    { id: 'pulse', label: 'Pulse', icon: 'heart-outline' },
    { id: 'wave', label: 'Wave', icon: 'water-outline' },
    { id: 'fade', label: 'Fade In', icon: 'eye-outline' },
    { id: 'pop', label: 'Pop In', icon: 'expand-outline' },
  ];

  const categories = [
    { id: 'All', label: 'All (' + STICKER_LIBRARY.length + ')' },
    { id: 'Reactions', label: '🔥 Reactions' },
    { id: 'Creator', label: '🎬 Badges' },
    { id: 'Comic', label: '💥 Comic & Meme' },
    { id: 'Symbols', label: '🎯 Pointers' },
  ];

  const filteredStickers = STICKER_LIBRARY.filter((item) => {
    const matchesCat = activeCategory === 'All' || item.category === activeCategory;
    const matchesQuery =
      !searchQuery.trim() ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.char.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const startTimeDisplay = editingClip ? (editingClip.startTime || 0) : currentPlayheadTime;
  const endTimeDisplay = Number((startTimeDisplay + duration).toFixed(1));

  const handleSelectSticker = (item: any) => {
    const isBadge = item.char.length > 2;

    if (editingClip && onUpdateSticker) {
      const updated: StickerClip = {
        ...editingClip,
        char: item.char,
        duration,
        animation: selectedAnim as any,
        scale: isBadge ? 1.0 : (editingClip.scale || 1.2),
      };
      soundEngine.playSfx('pop');
      onUpdateSticker(updated);
      onClose();
      return;
    }

    const stickerClip: StickerClip = {
      id: 'clip-s-' + Date.now(),
      char: item.char,
      startTime: currentPlayheadTime,
      duration,
      position: { x: 50, y: isBadge ? 45 : 50 },
      scale: isBadge ? 1.0 : 1.2,
      rotation: 0,
      animation: selectedAnim as any,
    };
    soundEngine.playSfx('pop');
    onAddSticker(stickerClip);
    onClose();
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
              <Ionicons name="happy-outline" size={17} color="#00F2FE" />
              <Text style={styles.sheetTitle}>
                {editingClip ? 'Edit Sticker' : 'Stickers & Badges'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: '#00F2FE' }]}
              activeOpacity={0.7}
              accessibilityLabel="Apply sticker"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#8E95A5" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search stickers & emojis..."
                placeholderTextColor="#64748B"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#8E95A5" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setActiveCategory(cat.id);
                    }}
                  >
                    <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Animation Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryScroll, { marginTop: 6 }]}>
              {STICKER_ANIMATIONS.map((anim) => {
                const isActive = selectedAnim === anim.id;
                return (
                  <TouchableOpacity
                    key={anim.id}
                    style={[
                      styles.categoryPill,
                      isActive && { backgroundColor: '#00F2FE', borderColor: '#00F2FE' },
                    ]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setSelectedAnim(anim.id);
                    }}
                  >
                    <Ionicons
                      name={anim.icon as any}
                      size={12}
                      color={isActive ? '#000000' : '#8E95A5'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.categoryPillText,
                        isActive && { color: '#000000', fontWeight: '800' },
                      ]}
                    >
                      {anim.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView style={styles.sheetBody}>
            <View style={styles.grid}>
              {filteredStickers.map((item) => {
                const isBadge = item.char.length > 2;
                const isSelected = editingClip?.char === item.char;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.stickerCard, isBadge && styles.badgeCard, isSelected && styles.selectedStickerCard]}
                    onPress={() => handleSelectSticker(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stickerEmoji, isBadge && styles.badgeText]}>
                      {item.char}
                    </Text>
                    <Text style={[styles.stickerLabel, isSelected && { color: '#00F2FE', fontWeight: '800' }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Platform.OS === 'web' ? '74%' : '82%',
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
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2234',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0D14',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 32,
    borderWidth: 1,
    borderColor: '#1E2638',
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    marginLeft: 6,
    paddingVertical: 0,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#141A28',
    borderWidth: 1,
    borderColor: '#1E2638',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  categoryPillText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#00F2FE',
  },
  sheetBody: {
    padding: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stickerCard: {
    width: '22.5%',
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E2333',
    minHeight: 80,
  },
  badgeCard: {
    width: '47.5%',
    backgroundColor: '#161B26',
    borderColor: 'rgba(0, 242, 254, 0.25)',
  },
  stickerEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#00F2FE',
    letterSpacing: 0.5,
  },
  stickerLabel: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneBtnText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedStickerCard: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
});
