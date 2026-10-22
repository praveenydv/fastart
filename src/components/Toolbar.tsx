import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";

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
  onOpenEnhance?: () => void;
  onOpenAutoCut?: () => void;
  onOpenCutoutModal?: () => void;
  onOpenMotionTracking?: () => void;
  onOpenCanvasModal?: () => void;
  onOpenKeyframeModal?: () => void;
  onOpenAutoCaptions?: () => void;
  onToggleDenoise?: () => void;
  onExtractAudio?: () => void;
}

function Toolbar({
  selectedClip,
  selectedClipType = "video",
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
  onOpenEnhance,
  onOpenAutoCut,
  onOpenCutoutModal,
  onOpenMotionTracking,
  onOpenCanvasModal,
  onOpenKeyframeModal,
  onOpenAutoCaptions,
  onToggleDenoise,
  onExtractAudio,
}: ToolbarProps) {
  // If a clip is actively selected, show Contextual Editing Tools based on clip type
  if (selectedClip) {
    const isVideo = selectedClipType === "video";
    const isAudio = selectedClipType === "audio";
    const isCaption =
      selectedClipType === "caption" || selectedClipType === "captions";
    const isText = selectedClipType === "text";
    const isSticker =
      selectedClipType === "sticker" || selectedClipType === "stickers";
    const isEffect =
      selectedClipType === "effects" || selectedClipType === "effect";

    const categoryTitle = isVideo
      ? "Video"
      : isAudio
        ? "Audio"
        : isCaption
          ? "Captions"
          : isText
            ? "Text"
            : isSticker
              ? "Sticker"
              : isEffect
                ? "Effect"
                : "Clip";

    return (
      <View style={styles.toolbarContainer}>
        {/* Deselect / Back handle with Category indicator */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={onDeselectClip}
          activeOpacity={0.7}
          accessibilityLabel={`Back from ${categoryTitle} editing`}
        >
          <Ionicons name="chevron-back" size={16} color="#00F2FE" />
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
                  soundEngine.playSfx("split");
                  onSplitClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="cut-outline" size={17} color="#00F2FE" />
                </View>
                <Text style={styles.toolLabel}>Split</Text>
              </TouchableOpacity>

              {/* 2. Speed */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenSpeedModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="speedometer-outline" size={17} color="#38BDF8" />
                </View>
                <Text style={styles.toolLabel}>Speed</Text>
              </TouchableOpacity>

              {/* 3. Volume */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenVolumeModal) onOpenVolumeModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="volume-high-outline" size={17} color="#10B981" />
                </View>
                <Text style={styles.toolLabel}>Volume</Text>
              </TouchableOpacity>

              {/* 4. 1-Tap AI Noise Reduction */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onToggleDenoise) onToggleDenoise();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, selectedClip.denoise && styles.activeCircle]}>
                  <Ionicons
                    name="ear-outline"
                    size={17}
                    color={selectedClip.denoise ? "#000000" : "#10B981"}
                  />
                </View>
                <Text style={[styles.toolLabel, selectedClip.denoise && { color: "#00F2FE" }]}>
                  {selectedClip.denoise ? "Denoise On" : "Denoise"}
                </Text>
              </TouchableOpacity>

              {/* 5. Delete (Fast Access) */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDeleteClip();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, styles.deleteCircle]}>
                  <Ionicons name="trash-outline" size={17} color="#FF0050" />
                </View>
                <Text style={[styles.toolLabel, { color: "#FF0050" }]}>Delete</Text>
              </TouchableOpacity>

              {/* 6. Duplicate */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDuplicateClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="copy-outline" size={17} color="#E2E8F0" />
                </View>
                <Text style={styles.toolLabel}>Duplicate</Text>
              </TouchableOpacity>

              {/* 7. Crop */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenCropModal) onOpenCropModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="crop-outline" size={17} color="#38BDF8" />
                </View>
                <Text style={styles.toolLabel}>Crop</Text>
              </TouchableOpacity>

              {/* 8. Rotate */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  if (onRotateClip) onRotateClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="refresh-outline" size={17} color="#38BDF8" />
                </View>
                <Text style={styles.toolLabel}>Rotate</Text>
              </TouchableOpacity>

              {/* 9. Filters */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenFiltersModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="color-filter-outline" size={17} color="#FBBF24" />
                </View>
                <Text style={styles.toolLabel}>Filters</Text>
              </TouchableOpacity>

              {/* 10. AI Magic (Enhance) */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenEnhance) onOpenEnhance();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="sparkles" size={17} color="#D946EF" />
                </View>
                <Text style={styles.toolLabel}>AI Magic</Text>
              </TouchableOpacity>

              {/* 11. Effects */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenEffectsModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="sparkles-outline" size={17} color="#818CF8" />
                </View>
                <Text style={styles.toolLabel}>Effects</Text>
              </TouchableOpacity>

              {/* 12. Cutout & Chroma Key */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenCutoutModal) onOpenCutoutModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="person-remove-outline" size={17} color="#00F2FE" />
                </View>
                <Text style={styles.toolLabel}>Cutout</Text>
              </TouchableOpacity>

              {/* 13. Masking */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenMaskModal) onOpenMaskModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="shapes-outline" size={17} color="#F43F5E" />
                </View>
                <Text style={styles.toolLabel}>Mask</Text>
              </TouchableOpacity>

              {/* 14. Motion Tracking */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenMotionTracking) onOpenMotionTracking();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="scan-outline" size={17} color="#FFE600" />
                </View>
                <Text style={styles.toolLabel}>Tracking</Text>
              </TouchableOpacity>

              {/* 15. Keyframe Animation */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenKeyframeModal) onOpenKeyframeModal();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconCircle,
                    (selectedClip?.keyframes?.length ?? 0) > 0 &&
                      styles.activeKeyframeCircle,
                  ]}
                >
                  <Ionicons name="diamond-outline" size={17} color="#FFE600" />
                </View>
                <Text style={styles.toolLabel}>Keyframe</Text>
              </TouchableOpacity>

              {/* 16. Extract Audio */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  if (onExtractAudio) onExtractAudio();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="musical-notes-outline" size={17} color="#A78BFA" />
                </View>
                <Text style={styles.toolLabel}>Extract Audio</Text>
              </TouchableOpacity>

              {/* 17. Reverse */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  if (onToggleReverse) onToggleReverse();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconCircle,
                    selectedClip.reverse && styles.activeCircle,
                  ]}
                >
                  <Ionicons
                    name="play-back-outline"
                    size={17}
                    color={selectedClip.reverse ? "#000000" : "#FFFFFF"}
                  />
                </View>
                <Text
                  style={[
                    styles.toolLabel,
                    selectedClip.reverse && { color: "#00F2FE" },
                  ]}
                >
                  {selectedClip.reverse ? "Reversed" : "Reverse"}
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
                  soundEngine.playSfx("click");
                  if (onOpenVolumeModal) onOpenVolumeModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="volume-high-outline" size={17} color="#10B981" />
                </View>
                <Text style={styles.toolLabel}>Volume</Text>
              </TouchableOpacity>

              {/* 2. Denoise Audio */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onToggleDenoise) onToggleDenoise();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, selectedClip.denoise && styles.activeCircle]}>
                  <Ionicons
                    name="ear-outline"
                    size={17}
                    color={selectedClip.denoise ? "#000000" : "#10B981"}
                  />
                </View>
                <Text style={[styles.toolLabel, selectedClip.denoise && { color: "#00F2FE" }]}>
                  {selectedClip.denoise ? "Denoise On" : "Denoise"}
                </Text>
              </TouchableOpacity>

              {/* 3. Split Audio */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("split");
                  onSplitClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="cut-outline" size={17} color="#00F2FE" />
                </View>
                <Text style={styles.toolLabel}>Split</Text>
              </TouchableOpacity>

              {/* 4. Speed / Pitch */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenSpeedModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="speedometer-outline" size={17} color="#38BDF8" />
                </View>
                <Text style={styles.toolLabel}>Speed</Text>
              </TouchableOpacity>

              {/* 5. Delete */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDeleteClip();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, styles.deleteCircle]}>
                  <Ionicons name="trash-outline" size={17} color="#FF0050" />
                </View>
                <Text style={[styles.toolLabel, { color: "#FF0050" }]}>Delete</Text>
              </TouchableOpacity>

              {/* 6. Duplicate */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDuplicateClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="copy-outline" size={17} color="#E2E8F0" />
                </View>
                <Text style={styles.toolLabel}>Duplicate</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ================= CAPTION TOOLS ================= */}
          {isCaption && (
            <>
              {/* 1. Edit Caption Text & Style */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenTextModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="pencil" size={17} color="#00F2FE" />
                </View>
                <Text style={styles.toolLabel}>Edit</Text>
              </TouchableOpacity>

              {/* 2. Re-generate / Batch Captions */}
              {onOpenAutoCaptions && (
                <TouchableOpacity
                  style={styles.toolItem}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    onOpenAutoCaptions();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconCircle}>
                    <Ionicons name="chatbox-ellipses" size={17} color="#A855F7" />
                  </View>
                  <Text style={styles.toolLabel}>AI Captions</Text>
                </TouchableOpacity>
              )}

              {/* 3. Split Caption */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("split");
                  onSplitClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="cut-outline" size={17} color="#00F2FE" />
                </View>
                <Text style={styles.toolLabel}>Split</Text>
              </TouchableOpacity>

              {/* 4. Delete */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDeleteClip();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, styles.deleteCircle]}>
                  <Ionicons name="trash-outline" size={17} color="#FF0050" />
                </View>
                <Text style={[styles.toolLabel, { color: "#FF0050" }]}>Delete</Text>
              </TouchableOpacity>

              {/* 5. Duplicate */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDuplicateClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="copy-outline" size={17} color="#E2E8F0" />
                </View>
                <Text style={styles.toolLabel}>Duplicate</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ================= TEXT TOOLS ================= */}
          {isText && (
            <>
              {/* 1. Edit Text */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenTextModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="pencil" size={17} color="#00F2FE" />
                </View>
                <Text style={styles.toolLabel}>Edit</Text>
              </TouchableOpacity>

              {/* 2. Keyframe Animation */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenKeyframeModal) onOpenKeyframeModal();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconCircle,
                    (selectedClip?.keyframes?.length ?? 0) > 0 &&
                      styles.activeKeyframeCircle,
                  ]}
                >
                  <Ionicons name="diamond-outline" size={17} color="#FFE600" />
                </View>
                <Text style={styles.toolLabel}>Keyframe</Text>
              </TouchableOpacity>

              {/* 3. Delete */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDeleteClip();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, styles.deleteCircle]}>
                  <Ionicons name="trash-outline" size={17} color="#FF0050" />
                </View>
                <Text style={[styles.toolLabel, { color: "#FF0050" }]}>Delete</Text>
              </TouchableOpacity>

              {/* 4. Duplicate */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDuplicateClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="copy-outline" size={17} color="#E2E8F0" />
                </View>
                <Text style={styles.toolLabel}>Duplicate</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ================= STICKER TOOLS ================= */}
          {isSticker && (
            <>
              {/* 1. Edit Sticker */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenStickersModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="pencil" size={17} color="#FBBF24" />
                </View>
                <Text style={styles.toolLabel}>Edit</Text>
              </TouchableOpacity>

              {/* 2. Keyframe Animation */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  if (onOpenKeyframeModal) onOpenKeyframeModal();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconCircle,
                    (selectedClip?.keyframes?.length ?? 0) > 0 &&
                      styles.activeKeyframeCircle,
                  ]}
                >
                  <Ionicons name="diamond-outline" size={17} color="#FFE600" />
                </View>
                <Text style={styles.toolLabel}>Keyframe</Text>
              </TouchableOpacity>

              {/* 3. Delete */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDeleteClip();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, styles.deleteCircle]}>
                  <Ionicons name="trash-outline" size={17} color="#FF0050" />
                </View>
                <Text style={[styles.toolLabel, { color: "#FF0050" }]}>Delete</Text>
              </TouchableOpacity>

              {/* 4. Duplicate */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDuplicateClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="copy-outline" size={17} color="#E2E8F0" />
                </View>
                <Text style={styles.toolLabel}>Duplicate</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ================= EFFECT TOOLS ================= */}
          {isEffect && (
            <>
              {/* 1. Edit Effect */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenEffectsModal();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="pencil" size={17} color="#818CF8" />
                </View>
                <Text style={styles.toolLabel}>Edit</Text>
              </TouchableOpacity>

              {/* 2. Delete */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDeleteClip();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, styles.deleteCircle]}>
                  <Ionicons name="trash-outline" size={17} color="#FF0050" />
                </View>
                <Text style={[styles.toolLabel, { color: "#FF0050" }]}>Delete</Text>
              </TouchableOpacity>

              {/* 3. Duplicate */}
              <TouchableOpacity
                style={styles.toolItem}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onDuplicateClip();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="copy-outline" size={17} color="#E2E8F0" />
                </View>
                <Text style={styles.toolLabel}>Duplicate</Text>
              </TouchableOpacity>
            </>
          )}
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
            soundEngine.playSfx("click");
            onOpenMediaPicker();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="film-outline" size={17} color="#00F2FE" />
          </View>
          <Text style={styles.toolLabel}>Media</Text>
        </TouchableOpacity>

        {/* 2. Audio Library */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx("click");
            onOpenAudioModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="musical-notes-outline" size={17} color="#10B981" />
          </View>
          <Text style={styles.toolLabel}>Audio</Text>
        </TouchableOpacity>

        {/* 3. Text Titles */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx("click");
            onOpenTextModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="text-outline" size={17} color="#D946EF" />
          </View>
          <Text style={styles.toolLabel}>Text</Text>
        </TouchableOpacity>

        {/* 4. AI Auto-Captions */}
        {onOpenAutoCaptions && (
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx("click");
              onOpenAutoCaptions();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name="chatbox-ellipses-outline"
                size={17}
                color="#00F2FE"
              />
            </View>
            <Text style={styles.toolLabel}>Captions</Text>
          </TouchableOpacity>
        )}

        {/* 5. Filters & 3D LUTs */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx("click");
            onOpenFiltersModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="color-filter-outline" size={17} color="#FBBF24" />
          </View>
          <Text style={styles.toolLabel}>Filters</Text>
        </TouchableOpacity>

        {/* 6. Effects */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx("click");
            onOpenEffectsModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles-outline" size={17} color="#818CF8" />
          </View>
          <Text style={styles.toolLabel}>Effects</Text>
        </TouchableOpacity>

        {/* 7. AI Voice (TTS Generator) */}
        {onOpenTTS && (
          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => {
              soundEngine.playSfx("click");
              onOpenTTS();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="mic-outline" size={17} color="#A855F7" />
            </View>
            <Text style={styles.toolLabel}>AI Voice</Text>
          </TouchableOpacity>
        )}

        {/* 8. Stickers & Emojis */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx("click");
            onOpenStickersModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="happy-outline" size={17} color="#FBBF24" />
          </View>
          <Text style={styles.toolLabel}>Stickers</Text>
        </TouchableOpacity>

        {/* 9. Canvas Aspect Ratio & Format */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx("click");
            if (onOpenCanvasModal) onOpenCanvasModal();
            else if (onOpenCropModal) onOpenCropModal();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="scan-outline" size={17} color="#38BDF8" />
          </View>
          <Text style={styles.toolLabel}>Canvas</Text>
        </TouchableOpacity>

        {/* 10. AutoCut Template Generator */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            soundEngine.playSfx("click");
            if (onOpenAutoCut) onOpenAutoCut();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="flash-outline" size={17} color="#00F2FE" />
          </View>
          <Text style={styles.toolLabel}>AutoCut</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarContainer: {
    height: 58,
    backgroundColor: "#0B0D13",
    borderTopWidth: 1,
    borderTopColor: "#1A1E29",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#161B26",
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#1E2536",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 2,
  },
  toolsScroll: {
    alignItems: "center",
    paddingRight: 16,
    gap: 4,
  },
  toolItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
    paddingHorizontal: 2,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#161B26",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "#1E2536",
  },
  activeCircle: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  activeKeyframeCircle: {
    backgroundColor: "rgba(255, 230, 0, 0.2)",
    borderWidth: 1.5,
    borderColor: "#FFE600",
  },
  deleteCircle: {
    backgroundColor: "rgba(255, 0, 80, 0.12)",
    borderColor: "rgba(255, 0, 80, 0.3)",
  },
  toolLabel: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "600",
  },
});

export default React.memo(Toolbar);
