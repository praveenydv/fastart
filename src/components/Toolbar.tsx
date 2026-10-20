import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../utils/audioEngine';
import { VideoClip } from '../types/project';

interface ToolbarProps {
  selectedClip: VideoClip | null;
  onDeselectClip: () => void;
  onSplitClip: () => void;
  onDeleteClip: () => void;
  onDuplicateClip: () => void;
  onRotateClip: () => void;
  onToggleReverse?: () => void;
  onOpenSpeedModal: () => void;
  onOpenVolumeModal?: () => void;
  onOpenCropModal?: () => void;
  onOpenAudioModal: () => void;
  onOpenTextModal: () => void;
  onOpenFiltersModal: () => void;
  onOpenEffectsModal: () => void;
  onOpenStickersModal: () => void;
  onOpenMediaPicker: () => void;
  onOpenTTS?: () => void;
  onOpenCamera?: () => void;
  onOpenEnhance?: () => void;
  onOpenAutoCut?: () => void;
}

export default function Toolbar({
  selectedClip,
  onDeselectClip,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onRotateClip,
  onToggleReverse,
  onOpenSpeedModal,
  onOpenVolumeModal,
  onOpenCropModal,
  onOpenAudioModal,
  onOpenTextModal,
  onOpenFiltersModal,
  onOpenEffectsModal,
  onOpenStickersModal,
  onOpenMediaPicker,
  onOpenTTS,
  onOpenCamera,
  onOpenEnhance,
  onOpenAutoCut,
}: ToolbarProps) {
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

          {/* 3. Volume & Dynamics */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('click');
              if (onOpenVolumeModal) onOpenVolumeModal();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="volume-high-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.toolLabel}>Volume</Text>
          </TouchableOpacity>

          {/* 4. Crop & Transform */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('click');
              if (onOpenCropModal) onOpenCropModal();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="crop-outline" size={20} color="#38BDF8" />
            </View>
            <Text style={styles.toolLabel}>Transform</Text>
          </TouchableOpacity>

          {/* 5. Filters */}
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

          {/* 6. Effects */}
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

          {/* 7. Reverse */}
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('pop');
              if (onToggleReverse) onToggleReverse();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, selectedClip.reverse && styles.activeCircle]}>
              <Ionicons
                name="play-back-outline"
                size={20}
                color={selectedClip.reverse ? '#000000' : '#FFFFFF'}
              />
            </View>
            <Text style={[styles.toolLabel, selectedClip.reverse && { color: '#00F2FE' }]}>
              {selectedClip.reverse ? 'Reversed' : 'Reverse'}
            </Text>
          </TouchableOpacity>

          {/* 8. Rotate 90 deg */}
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

          {/* 9. Duplicate */}
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

          {/* 10. Delete */}
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

        {/* 4. AI Voice (TTS) */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            if (onOpenTTS) onOpenTTS();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="mic-outline" size={20} color="#10B981" />
          </View>
          <Text style={styles.toolLabel}>AI Voice</Text>
        </TouchableOpacity>

        {/* 5. Live Camera Record */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            if (onOpenCamera) onOpenCamera();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="camera-outline" size={20} color="#F59E0B" />
          </View>
          <Text style={styles.toolLabel}>Camera</Text>
        </TouchableOpacity>

        {/* 6. AI Enhance */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            if (onOpenEnhance) onOpenEnhance();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={20} color="#A855F7" />
          </View>
          <Text style={styles.toolLabel}>AI Magic</Text>
        </TouchableOpacity>

        {/* 7. Canvas Aspect Ratio */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            if (onOpenCropModal) onOpenCropModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="crop-outline" size={20} color="#38BDF8" />
          </View>
          <Text style={styles.toolLabel}>Canvas</Text>
        </TouchableOpacity>

        {/* 8. Stickers */}
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

        {/* 9. Effects */}
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

        {/* 10. Filters */}
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

        {/* 11. AutoCut */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx('click');
            if (onOpenAutoCut) onOpenAutoCut();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="flash-outline" size={20} color="#00F2FE" />
          </View>
          <Text style={styles.toolLabel}>AutoCut</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarContainer: {
    height: 78,
    backgroundColor: '#0B0D13',
    borderTopWidth: 1,
    borderTopColor: '#1A1E29',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#1E2333',
    borderRadius: 8,
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
    paddingRight: 16,
    gap: 4,
  },
  toolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161A26',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeCircle: {
    backgroundColor: '#00F2FE',
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
