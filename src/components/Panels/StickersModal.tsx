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

  const sheetContent = (
    <View style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

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
              <Ionicons name="happy-outline" size={17} color="#FFFFFF" />
              <Text style={styles.sheetTitle}>
                {editingClip ? 'Edit Sticker' : 'Stickers & Badges'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: '#FFFFFF' }]}
              activeOpacity={0.7}
              accessibilityLabel="Apply sticker"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

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

            {/* Animation Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryScroll, { marginTop: 6 }]}>
              {STICKER_ANIMATIONS.map((anim) => {
                const isActive = selectedAnim === anim.id;
                return (
                  <TouchableOpacity
                    key={anim.id}
                    style={[
                      styles.categoryPill,
                      isActive && { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
                    ]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setSelectedAnim(anim.id);
                    }}
                  >
                    <Ionicons
                      name={anim.icon as any}
                      size={12}
                      color={isActive ? '#000000' : '#71717A'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.categoryPillText,
                        isActive && { color: '#000000', fontWeight: '700' },
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
                    <Text style={[styles.stickerLabel, isSelected && { color: '#FFFFFF', fontWeight: '700' }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
  );

  if (isInline) {
    if (!visible) return null;
    return <View style={styles.inlineWrapper}>{sheetContent}</View>;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
    backgroundColor: '#121215',
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '74%' : '82%',
    borderTopWidth: 1,
    borderColor: '#27272F',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#27272F',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272F',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sheetSubtitle: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#202026',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#27272F',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181C',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    borderWidth: 1,
    borderColor: '#27272F',
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
    borderRadius: 8,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  categoryPillActive: {
    backgroundColor: '#202026',
    borderColor: '#FFFFFF',
  },
  categoryPillText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#18181C',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272F',
    minHeight: 80,
  },
  badgeCard: {
    width: '47.5%',
    backgroundColor: '#18181C',
    borderColor: '#27272F',
  },
  stickerEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stickerLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  doneBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedStickerCard: {
    borderColor: '#FFFFFF',
    backgroundColor: '#202026',
  },
});
