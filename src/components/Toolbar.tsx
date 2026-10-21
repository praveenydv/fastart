import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../utils/audioEngine';
import { VideoClip } from '../types/project';

interface ToolbarProps {
  selectedClip: any | null;
  selectedClipType?: string;
  onDeselectClip: () => void;
  onSplitClip: () => void;
  onDeleteClip: () => void;
  onDuplicateClip: () => void;
  onRotateClip?: () => void;
  onToggleReverse?: () => void;
  onOpenSpeedModal: () => void;
  onOpenVolumeModal?: () => void;
  onOpenCropModal?: () => void;
  onOpenMaskModal?: () => void;
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
  onOpenCutoutModal?: () => void;
  onOpenMotionTracking?: () => void;
}

export default function Toolbar({
  selectedClip,
  selectedClipType = 'video',
  onDeselectClip,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onRotateClip,
  onToggleReverse,
  onOpenSpeedModal,
  onOpenVolumeModal,
  onOpenCropModal,
  onOpenMaskModal,
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
  onOpenCutoutModal,
  onOpenMotionTracking,
}: ToolbarProps) {
  // If a clip is actively selected, show Contextual Editing Tools based on clip type
  if (selectedClip) {
    const isVideo = selectedClipType === 'video';
    const isAudio = selectedClipType === 'audio';
    const isText = selectedClipType === 'text';
    const isSticker = selectedClipType === 'sticker' || selectedClipType === 'stickers';
    const isEffect = selectedClipType === 'effects' || selectedClipType === 'effect';

    const categoryTitle = isVideo
      ? 'Video'
      : isAudio
      ? 'Audio'
      : isText
      ? 'Text'
      : isSticker
      ? 'Sticker'
      : isEffect
      ? 'Effect'
      : 'Clip';

    return (
      <View style={styles.toolbarContainer}>
        {/* Deselect / Back handle with Category indicator */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={onDeselectClip}
          activeOpacity={0.7}
          accessibilityLabel={`Back from ${categoryTitle} editing`}
        >
          <Ionicons name="chevron-back" size={18} color="#00F2FE" />
          <Text style={styles.backButtonText}>{categoryTitle}</Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolsScroll}
        >
          {/* ================= VIDEO TOOLS ================= */}
          {isVideo && (
            <>
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
                  <Ionicons name="speedometer-outline" size={20} color="#38BDF8" />
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
                <Text style={styles.toolLabel}>Crop</Text>
              </TouchableOpacity>

              {/* 5. Masking */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx('click');
                  if (onOpenMaskModal) onOpenMaskModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="shapes-outline" size={20} color="#F43F5E" />
                </View>
                <Text style={styles.toolLabel}>Mask</Text>
              </TouchableOpacity>

              {/* 5b. Smart Cutout & Chroma Key */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx('click');
                  if (onOpenCutoutModal) onOpenCutoutModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="person-remove-outline" size={20} color="#00F2FE" />
                </View>
                <Text style={styles.toolLabel}>Cutout</Text>
              </TouchableOpacity>

              {/* 5c. AI Motion Tracking */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx('click');
                  if (onOpenMotionTracking) onOpenMotionTracking();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="scan-outline" size={20} color="#FFE600" />
                </View>
                <Text style={styles.toolLabel}>Tracking</Text>
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
                  <Ionicons name="color-filter-outline" size={20} color="#FBBF24" />
                </View>
                <Text style={styles.toolLabel}>Filters</Text>
              </TouchableOpacity>

              {/* 7. AI Magic (Enhance) */}
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

              {/* 8. Effects */}
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


              {/* 9. Reverse */}
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
            </>
          )}

          {/* ================= AUDIO TOOLS ================= */}
          {isAudio && (
            <>
              {/* 1. Volume & Dynamics */}
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

              {/* 2. Split Audio */}
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

              {/* 3. Speed / Pitch */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onOpenSpeedModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="speedometer-outline" size={20} color="#38BDF8" />
                </View>
                <Text style={styles.toolLabel}>Speed</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ================= TEXT TOOLS ================= */}
          {isText && (
            <>
              {/* 1. Edit Text (Content, Font, Colors, Styles, Effects & Animations) */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onOpenTextModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="pencil" size={20} color="#00F2FE" />
                </View>
                <Text style={styles.toolLabel}>Edit</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ================= STICKER TOOLS ================= */}
          {isSticker && (
            <>
              {/* 1. Change Sticker / Emojis */}
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
            </>
          )}

          {/* ================= EFFECT TOOLS ================= */}
          {isEffect && (
            <>
              {/* 1. Change / Adjust Effect */}
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
                <Text style={styles.toolLabel}>Effect</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ================= COMMON ACTIONS (Duplicate & Delete) ================= */}
          {/* Duplicate */}
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

          {/* Delete */}
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

  // Root Mode Toolbar (When no clip is selected) - Clean general creation tools
  return (
    <View style={styles.toolbarContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsScroll}
      >
        {/* 1. Add Media */}
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

        {/* 2. Audio Library */}
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

        {/* 2b. AI Voice (TTS Generator) */}
        {onOpenTTS && (
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx('click');
              onOpenTTS();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="mic-outline" size={20} color="#A855F7" />
            </View>
            <Text style={styles.toolLabel}>AI Voice</Text>
          </TouchableOpacity>
        )}

        {/* 3. Text Titles */}
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

        {/* 4. Stickers & Emojis */}
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

        {/* 5. Adjustment Effects */}
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

        {/* 6. Canvas Aspect Ratio */}
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

        {/* 7. AutoCut Template Generator */}
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
    height: 68,
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
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#1E2333',
    borderRadius: 8,
    marginRight: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
  toolsScroll: {
    alignItems: 'center',
    paddingRight: 16,
    gap: 2,
  },
  toolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161A26',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  activeCircle: {
    backgroundColor: '#00F2FE',
  },
  deleteCircle: {
    backgroundColor: 'rgba(255, 0, 80, 0.15)',
  },
  toolLabel: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '600',
  },
});
