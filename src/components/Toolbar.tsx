import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../utils/audioEngine';

export default function Toolbar({
  selectedClip,
  onDeselectClip,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onRotateClip,
  onOpenSpeedModal,
  onOpenAudioModal,
  onOpenTextModal,
  onOpenFiltersModal,
  onOpenEffectsModal,
  onOpenStickersModal,
  onOpenMediaPicker,
}) {
  // If a clip is actively selected, show Clip Editing Tools
  if (selectedClip) {
    return (
      <View style={styles.toolbarContainer}>
        {/* Deselect / Back handle */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={onDeselectClip}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolsScroll}
        >
          {/* 1. Split */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('split');
              onSplitClip();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="cut-outline" size={20} color="#00F2FE" />
            </View>
            <Text style={styles.toolLabel}>Split</Text>
          </TouchableOpacity>

          {/* 2. Speed */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('click');
              onOpenSpeedModal();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="speedometer-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.toolLabel}>Speed</Text>
          </TouchableOpacity>

          {/* 3. Filters */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('click');
              onOpenFiltersModal();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="color-filter-outline" size={20} color="#FBBF24" />
            </View>
            <Text style={styles.toolLabel}>Filters</Text>
          </TouchableOpacity>

          {/* 4. Effects */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('click');
              onOpenEffectsModal();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles-outline" size={20} color="#D946EF" />
            </View>
            <Text style={styles.toolLabel}>Effects</Text>
          </TouchableOpacity>

          {/* 5. Rotate 90 deg */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('click');
              onRotateClip();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.toolLabel}>Rotate</Text>
          </TouchableOpacity>

          {/* 6. Duplicate */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('pop');
              onDuplicateClip();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.toolLabel}>Duplicate</Text>
          </TouchableOpacity>

          {/* 7. Delete */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('pop');
              onDeleteClip();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, styles.deleteCircle]}>
              <Ionicons name="trash-outline" size={20} color="#FF0050" />
            </View>
            <Text style={[styles.toolLabel, { color: '#FF0050' }]}>Delete</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Root Mode Toolbar (When no clip is selected)
  return (
    <View style={styles.toolbarContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsScroll}
      >
        {/* 1. Add Media / Edit */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            onOpenMediaPicker();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="film-outline" size={20} color="#00F2FE" />
          </View>
          <Text style={styles.toolLabel}>Media</Text>
        </TouchableOpacity>

        {/* 2. Audio */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            onOpenAudioModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="musical-notes-outline" size={20} color="#10B981" />
          </View>
          <Text style={styles.toolLabel}>Audio</Text>
        </TouchableOpacity>

        {/* 3. Text */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            onOpenTextModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="text-outline" size={20} color="#D946EF" />
          </View>
          <Text style={styles.toolLabel}>Text</Text>
        </TouchableOpacity>

        {/* 4. Stickers */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            onOpenStickersModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="happy-outline" size={20} color="#FBBF24" />
          </View>
          <Text style={styles.toolLabel}>Stickers</Text>
        </TouchableOpacity>

        {/* 5. Effects */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            onOpenEffectsModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles-outline" size={20} color="#818CF8" />
          </View>
          <Text style={styles.toolLabel}>Effects</Text>
        </TouchableOpacity>

        {/* 6. Filters */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            onOpenFiltersModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="color-filter-outline" size={20} color="#FB923C" />
          </View>
          <Text style={styles.toolLabel}>Filters</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarContainer: {
    height: 72,
    backgroundColor: '#0B0D13',
    borderTopWidth: 1,
    borderTopColor: '#1A1E29',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E2333',
    marginRight: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },
  toolsScroll: {
    alignItems: 'center',
    gap: 12,
    paddingRight: 16,
  },
  toolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141721',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteCircle: {
    backgroundColor: 'rgba(255, 0, 80, 0.15)',
  },
  toolLabel: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '600',
  },
});
