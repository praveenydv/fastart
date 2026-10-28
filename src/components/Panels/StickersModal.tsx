import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  isInline?: boolean;
}

export default function StickersModal({
  visible,
  onClose,
  onAddSticker,
  editingClip,
  onUpdateSticker,
  currentPlayheadTime = 0,
  isInline = false,
}: StickersModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [duration, setDuration] = useState(3.0);

  React.useEffect(() => {
    if (visible) {
      if (editingClip) {
        setDuration(editingClip.duration || 3.0);
      } else {
        setDuration(3.0);
      }
    }
  }, [visible, editingClip]);

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
        animation: editingClip.animation,
        scale: isBadge ? 1.0 : (editingClip.scale || 1.2),
      };
      soundEngine.playSfx('pop');
      onUpdateSticker(updated);
      if (!isInline) onClose();
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
      animation: undefined,
    };
    soundEngine.playSfx('pop');
    onAddSticker(stickerClip);
    if (!isInline) onClose();
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.sheetHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="happy-outline" size={16} color="#00F2FE" />
            <Text style={styles.sheetTitle}>
              {editingClip ? 'Edit Sticker' : 'Stickers & Badges'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
            accessibilityLabel="Close panel"
          >
            <Ionicons name="close" size={16} color="#A1A1AA" />
          </TouchableOpacity>
        </View>
      ) : null}

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#71717A" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search stickers & emojis..."
                placeholderTextColor="#71717A"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#71717A" />
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
                    <Text style={[styles.stickerLabel, isSelected && { color: '#00F2FE', fontWeight: '700' }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
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
    borderTopWidth: 0,
    paddingBottom: 0,
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
    maxHeight: Platform.OS === 'web' ? '74%' : '82%',
    borderTopWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#1F2637',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sheetSubtitle: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 7,
    paddingHorizontal: 10,
    height: 34,
    borderWidth: 1,
    borderColor: '#1F2637',
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 6,
    paddingVertical: 0,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
  },
  categoryPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  sheetBody: {
    padding: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stickerCard: {
    width: '22.8%',
    backgroundColor: '#131826',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1F2637',
    minHeight: 72,
  },
  badgeCard: {
    width: '47.5%',
    backgroundColor: '#131826',
    borderColor: '#1F2637',
  },
  stickerEmoji: {
    fontSize: 28,
    marginBottom: 3,
  },
  badgeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stickerLabel: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00F2FE',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  doneBtnText: {
    color: '#08090E',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedStickerCard: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
});
