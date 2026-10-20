import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
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

  React.useEffect(() => {
    if (visible) {
      if (editingClip) {
        setDuration(editingClip.duration || 3.0);
      } else {
        setDuration(3.0);
      }
    }
  }, [visible, editingClip]);

  const durationPresets = [1.5, 3.0, 5.0, 8.0, 10.0, 15.0];

  const handleAdjustDuration = (delta: number) => {
    soundEngine.playSfx('click');
    setDuration((prev) => Math.max(0.5, Math.min(60, Number((prev + delta).toFixed(1)))));
  };

  const categories = [
    { id: 'All', label: 'All Stickers' },
    { id: 'Reactions', label: 'Reactions 🔥' },
    { id: 'Creator', label: 'Creator Badges 🎬' },
    { id: 'Comic', label: 'Comic Words 💥' },
    { id: 'Symbols', label: 'Symbols 🎯' },
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
    };
    soundEngine.playSfx('pop');
    onAddSticker(stickerClip);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>
                {editingClip ? 'Change Sticker / Emoji' : 'Stickers & Emojis Suite'}
              </Text>
              <Text style={styles.sheetSubtitle}>
                Tap any sticker to insert at {startTimeDisplay.toFixed(1)}s (Duration: {duration.toFixed(1)}s)
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Time Frame & Duration Control Panel */}
          <View style={styles.timeframeBar}>
            <View style={styles.timeframeTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time-outline" size={15} color="#FBBF24" style={{ marginRight: 6 }} />
                <Text style={styles.timeframeTitle}>TIME FRAME & DURATION</Text>
              </View>
              <View style={styles.timeframeRangePill}>
                <Text style={styles.timeframeRangeText}>
                  {startTimeDisplay.toFixed(1)}s ➔ {endTimeDisplay.toFixed(1)}s
                </Text>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleAdjustDuration(-0.5)}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color="#FFFFFF" />
                <Text style={styles.stepperBtnSubtext}>-0.5s</Text>
              </TouchableOpacity>

              <View style={styles.stepperCenter}>
                <Text style={styles.stepperValue}>{duration.toFixed(1)}s</Text>
                <Text style={styles.stepperLabel}>Display Duration</Text>
              </View>

              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleAdjustDuration(0.5)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.stepperBtnSubtext}>+0.5s</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Duration Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {durationPresets.map((d) => {
                const isActive = Math.abs(duration - d) < 0.05;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.durPill, isActive && styles.durPillActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setDuration(d);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.durPillText, isActive && styles.durPillTextActive]}>
                      {d.toFixed(1)}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#8E95A5" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search stickers, emojis, or badges..."
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
          </View>

          <ScrollView style={styles.sheetBody}>
            <View style={styles.grid}>
              {filteredStickers.map((item) => {
                const isBadge = item.char.length > 2;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.stickerCard, isBadge && styles.badgeCard]}
                    onPress={() => handleSelectSticker(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stickerEmoji, isBadge && styles.badgeText]}>
                      {item.char}
                    </Text>
                    <Text style={styles.stickerLabel} numberOfLines={1}>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
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
    fontSize: 16,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0D13',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    borderWidth: 1,
    borderColor: '#252B3B',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    marginLeft: 8,
    paddingVertical: 0,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: '#1E2333',
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
    padding: 16,
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
  timeframeBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0E1118',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  timeframeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeframeTitle: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  timeframeRangePill: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  timeframeRangeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#151922',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#232938',
  },
  stepperBtn: {
    width: 54,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1E2433',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnSubtext: {
    color: '#8E95A5',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  stepperCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  stepperValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  stepperLabel: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  durPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#151922',
    borderWidth: 1,
    borderColor: '#232938',
    marginRight: 6,
  },
  durPillActive: {
    backgroundColor: '#FBBF24',
    borderColor: '#FBBF24',
  },
  durPillText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  durPillTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
});
