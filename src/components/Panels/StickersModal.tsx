import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Ionicons } from '@expo/vector-icons';
import { STICKER_LIBRARY } from '../../constants/sampleMedia';
import { ModalHeader } from '../Common/ModalHeader';
import { SegmentedPillTabs } from '../Common/SegmentedPillTabs';

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

const STICKER_CATEGORIES = [
  { id: 'All', label: 'All (' + STICKER_LIBRARY.length + ')' },
  { id: 'Reactions', label: '🔥 Reactions' },
  { id: 'Creator', label: '🎬 Badges' },
  { id: 'Comic', label: '💥 Comic & Meme' },
  { id: 'Symbols', label: '🎯 Pointers' },
];

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

  const filteredStickers = React.useMemo(() => {
    if (!visible) return [];
    const query = searchQuery.trim().toLowerCase();
    return STICKER_LIBRARY.filter((item) => {
      const matchesCat = activeCategory === 'All' || item.category === activeCategory;
      const matchesQuery =
        !query ||
        item.label.toLowerCase().includes(query) ||
        item.char.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });
  }, [visible, activeCategory, searchQuery]);

  if (!visible) return null;

  const categories = STICKER_CATEGORIES;

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
      onUpdateSticker(updated);
      if (!isInline) onClose();
      return;
    }

    // This handler runs only after a user selects a sticker.
     
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
    onAddSticker(stickerClip);
    if (!isInline) onClose();
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <ModalHeader
          title="Stickers"
          iconName="happy-outline"
          onClose={onClose}
        />
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
            <View style={{ marginTop: 8 }}>
              <SegmentedPillTabs
                tabs={categories}
                activeTab={activeCategory}
                onTabChange={setActiveCategory}
              />
            </View>

          </View>

          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.scrollContent}>
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
                    <Text style={[styles.stickerLabel, isSelected && { color: '#FFFFFF', fontWeight: '500' }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
  );

  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121214',
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
    backgroundColor: '#121214',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: Platform.OS === 'web' ? '74%' : '82%',
    borderTopWidth: 1,
    borderColor: '#1F1F23',
  },
  sheetHandle: {
    width: 28,
    height: 3,
    backgroundColor: '#27272A',
    borderRadius: 1.5,
    alignSelf: 'center',
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 5,
    backgroundColor: '#121214',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
  },
  sheetTitle: {
    color: '#EDEDED',
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  sheetSubtitle: {
    color: '#71717A',
    fontSize: 8.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: '#121214',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181A',
    borderRadius: 5,
    paddingHorizontal: 8,
    height: 26,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    color: '#EDEDED',
    fontSize: 10,
    marginLeft: 5,
    paddingVertical: 0,
  },
  categoryScroll: {
    gap: 4,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: '#FFFFFF',
  },
  categoryPillText: {
    color: '#8E8E93',
    fontSize: 9.5,
    fontWeight: '400',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  sheetBody: {
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  stickerCard: {
    width: '23.8%',
    backgroundColor: '#18181A',
    borderRadius: 5,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    minHeight: 48,
  },
  badgeCard: {
    width: '48%',
    backgroundColor: '#18181A',
    borderColor: '#27272A',
  },
  stickerEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#EDEDED',
    letterSpacing: 0.5,
  },
  stickerLabel: {
    color: '#8E8E93',
    fontSize: 8,
    fontWeight: '400',
    textAlign: 'center',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  doneBtnText: {
    color: '#121214',
    fontSize: 9.5,
    fontWeight: '500',
  },
  selectedStickerCard: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
