import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import MediaPickerModal from "../Panels/MediaPickerModal";
import TextModal from "../Panels/TextModal";
import AudioModal from "../Panels/AudioModal";
import FiltersModal from "../Panels/FiltersModal";
import EffectsModal from "../Panels/EffectsModal";
import StickersModal from "../Panels/StickersModal";
import TransitionsModal from "../Panels/TransitionsModal";
import SpeedModal from "../Panels/SpeedModal";
import ExportModal from "../Panels/ExportModal";
import SettingsModal from "../Panels/SettingsModal";
import NotificationsModal from "../Panels/NotificationsModal";
import VolumeModal from "../Panels/VolumeModal";
import TransformModal from "../Panels/TransformModal";
import AutoCutModal from "../Panels/AutoCutModal";
import CanvasModal from "../Panels/CanvasModal";
import BackgroundModal from "../Panels/BackgroundModal";
import AIEnhanceModal from "../Panels/AIEnhanceModal";
import TextToSpeechModal from "../Panels/TextToSpeechModal";
import CutoutModal from "../Panels/CutoutModal";
import MaskModal from "../Panels/MaskModal";
import MotionTrackingModal from "../Panels/MotionTrackingModal";
import ConfirmDeleteModal from "../ConfirmDeleteModal";
import KeyframeModal from "../Panels/KeyframeModal";
import AutoCaptionModal from "../Panels/AutoCaptionModal";
import AnimationModal from "../Panels/AnimationModal";
import BlendModeModal from "../Panels/BlendModeModal";
import HSLAdjustModal from "../Panels/HSLAdjustModal";
import VoiceEffectsModal from "../Panels/VoiceEffectsModal";
import {
  FastArtProject,
  VideoClip,
  TextClip,
  StickerClip,
  EffectClip,
  BlendMode,
  HSLAdjustments,
  VoiceEffectId,
} from "../../types/project";
import { mediaHasAudioTrack } from "../../utils/mediaAudioDetector";

interface EditorModalsProps {
  activeModal: string | null;
  closeModal: () => void;
  onCancelModal?: () => void;
  onApplyModal?: () => void;
  project: FastArtProject | null;
  route: any;
  totalDuration: number;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  selectedClipId?: string | null;
  selectedClip: any;
  selectedClipType: string;
  settings: any;
  notifications: any[];
  transitionTargetClipId: string | null;
  clipToDelete: {
    id: string;
    type: string;
    name?: string;
    duration?: number;
  } | null;
  setClipToDelete: (val: any) => void;
  handleAddMedia: (media: any[]) => void;
  handleApplyCutout: (cutout: any) => void;
  cutoutInitialMode?: 'auto' | 'chroma';
  handleApplyMotionTracking: (track: any) => void;
  handleAddText: (clip: TextClip) => void;
  handleUpdateText: (clip: TextClip) => void;
  handleAddAudio: (item: any) => void;
  handleApplyFilter: (lut: string) => void;
  handleAddEffect: (effect: any) => void;
  handleUpdateEffect: (clip: EffectClip) => void;
  handleAddSticker: (sticker: any) => void;
  handleUpdateSticker: (clip: StickerClip) => void;
  handleApplyTransition: (transition: any) => void;
  handleApplySpeed: (speed: number, curve?: any, smoothSlowMo?: "none" | "blend" | "optical_flow") => void;
  handleUpdateSettings: (updates: any) => void;
  handleReloadAllData: () => void;
  handleMarkAllAsRead: () => void;
  handleClearAllNotifications: () => void;
  handleDeleteNotification: (id: string) => void;
  handleNotificationAction: (notif: any) => void;
  handleApplyVolume: (vol: number, fadeIn: number, fadeOut: number, denoise?: boolean) => void;
  handleExtractAudioFromVideo?: () => void;
  handleApplyTransform: (t: any, ratio?: any, mask?: any) => void;
  handleAutoCutGenerated: (proj: any) => void;
  updateProjectWithHistory: (proj: any) => void;
  handleApplyEnhance: (preset: any) => void;
  handleApplyBlendMode?: (mode: BlendMode, opacity?: number) => void;
  handleApplyHSL?: (adjustments: HSLAdjustments) => void;
  handleApplyVoiceEffect?: (effectId: VoiceEffectId) => void;
  handleAddKeyframe: () => void;
  isKeyframeAtPlayhead: boolean;
  handleUpdateKeyframeTransform: (time: number, transform: any, opacity?: number, easing?: any) => void;
  handleDeleteKeyframeAtTime: (time?: number) => void;
  handleClearAllKeyframes: () => void;
  handleConfirmDeleteClip: () => void;
  handleAddCaptions?: (captions: any[]) => void;
  handleUpdateCaption?: (clip: any) => void;
  transformInitialTab?: 'crop' | 'flip' | 'rotate' | 'stretch' | 'angle';
  onOpenScreenCrop?: () => void;
  setIsCroppingPreview?: (c: boolean) => void;
  isInline?: boolean;
  handleUpdateClipMask?: (clipId: string, mask: any, isFinal?: boolean) => void;
  handleMoveClip?: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects" | "caption",
    newStartTime: number,
    newTrackIndex?: number,
    isInsertNewTrack?: boolean,
  ) => void;
}

export const INLINE_MODAL_KEYS = new Set([
  'audio',
  'filters',
  'transform',
  'mask',
  'speed',
  'volume',
  'text',
  'stickers',
  'effects',
  'captions',
  'transitions',
  'enhance',
  'autocut',
  'canvas',
  'background',
  'keyframe',
  'tts',
  'cutout',
  'tracking',
  'opacity',
  'animation',
  'audio_effects',
  'voice_effects',
  'blend',
  'hsl',
]);

export const EditorModals: React.FC<EditorModalsProps> = ({
  activeModal,
  closeModal,
  onCancelModal,
  onApplyModal,
  project,
  handleAddCaptions,
  handleUpdateCaption,
  route,
  totalDuration,
  currentTime,
  setCurrentTime,
  selectedClipId,
  selectedClip,
  selectedClipType,
  settings,
  notifications,
  transitionTargetClipId,
  clipToDelete,
  setClipToDelete,
  handleAddMedia,
  handleApplyCutout,
  cutoutInitialMode,
  handleApplyMotionTracking,
  handleAddText,
  handleUpdateText,
  handleAddAudio,
  handleApplyFilter,
  handleAddEffect,
  handleUpdateEffect,
  handleAddSticker,
  handleUpdateSticker,
  handleApplyTransition,
  handleApplySpeed,
  handleUpdateSettings,
  handleReloadAllData,
  handleMarkAllAsRead,
  handleClearAllNotifications,
  handleDeleteNotification,
  handleNotificationAction,
  handleApplyVolume,
  handleExtractAudioFromVideo,
  handleApplyTransform,
  handleAutoCutGenerated,
  updateProjectWithHistory,
  handleApplyEnhance,
  handleApplyBlendMode,
  handleApplyHSL,
  handleApplyVoiceEffect,
  handleAddKeyframe,
  isKeyframeAtPlayhead,
  handleUpdateKeyframeTransform,
  handleDeleteKeyframeAtTime,
  handleClearAllKeyframes,
  handleConfirmDeleteClip,
  transformInitialTab,
  onOpenScreenCrop,
  setIsCroppingPreview,
  isInline = false,
  handleUpdateClipMask,
  handleMoveClip,
}) => {
  const handleCancel = onCancelModal || closeModal;
  const handleApply = onApplyModal || closeModal;

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeModal && isInline && Platform.OS !== "web") {
      fadeAnim.setValue(0.85);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [activeModal, isInline]);

  // When isInline is true, only render if activeModal is an inline modal tool
  if (isInline && (!activeModal || !INLINE_MODAL_KEYS.has(activeModal))) {
    return null;
  }
  // When isInline is false, do not render inline modal tools (they are rendered in the panel/dock)
  if (!isInline && activeModal && INLINE_MODAL_KEYS.has(activeModal)) {
    return null;
  }

  const renderedContent = (
    <>
      {/* LAZY LOADED MODALS ON MOBILE (Only mounted when active to save CPU and RAM) */}
      {activeModal === "media" && (
        <MediaPickerModal
          visible={true}
          onClose={closeModal}
          onAddMedia={handleAddMedia}
        />
      )}

      {activeModal === "cutout" && (
        <CutoutModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          currentCutout={selectedClip?.cutout}
          onApplyCutout={handleApplyCutout}
          initialMode={cutoutInitialMode}
          isInline={isInline}
          selectedClip={selectedClip}
        />
      )}

      {activeModal === "tracking" && (
        <MotionTrackingModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          targetType={
            selectedClipType === "text"
              ? "text"
              : selectedClipType === "stickers" ||
                  selectedClipType === "sticker"
                ? "sticker"
                : "video"
          }
          currentTrack={selectedClip?.motionTrack}
          onApplyTracking={handleApplyMotionTracking}
          isInline={isInline}
          project={project}
          selectedClip={selectedClip}
          updateProjectWithHistory={updateProjectWithHistory}
        />
      )}

      {activeModal === "text" && (() => {
        let editingTarget: any = null;
        if (
          selectedClip &&
          (selectedClipType === "text" ||
            (selectedClipType !== "caption" &&
              selectedClipType !== "captions" &&
              typeof (selectedClip as any).text === "string" &&
              !(selectedClip as any).words))
        ) {
          editingTarget = selectedClip;
        } else if (selectedClipId && project) {
          editingTarget =
            project.tracks?.text?.find((c) => c.id === selectedClipId) ||
            null;
        }

        return (
          <TextModal
            visible={true}
            onClose={handleCancel}
            onAddText={handleAddText}
            editingClip={editingTarget}
            onUpdateText={(clip) => {
              if (handleUpdateText) {
                handleUpdateText(clip);
              }
            }}
            currentPlayheadTime={currentTime}
            isInline={isInline}
          />
        );
      })()}

      {activeModal === "audio" && (
        <AudioModal
          visible={true}
          onClose={closeModal}
          onAddAudio={handleAddAudio}
          project={project}
          onUpdateProject={updateProjectWithHistory}
          isInline={isInline}
        />
      )}

      {activeModal === "filters" && (
        <FiltersModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          activeFilter={
            selectedClipType === "video"
              ? (selectedClip as VideoClip)?.filter || "normal"
              : selectedClipType === "effects" || selectedClipType === "effect"
              ? (selectedClip as EffectClip)?.filter || ((selectedClip as EffectClip)?.type?.startsWith("filter_") ? (selectedClip as EffectClip).type.replace(/^filter_/, "") : "normal")
              : "normal"
          }
          onSelectFilter={handleApplyFilter}
          isInline={isInline}
        />
      )}

      {activeModal === "effects" && (
        <EffectsModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          activeEffect={
            selectedClipType === "effects" || selectedClipType === "effect"
              ? (selectedClip as EffectClip)?.type
              : selectedClipType === "video"
              ? (typeof (selectedClip as VideoClip)?.effect === "string"
                  ? (selectedClip as VideoClip)?.effect
                  : (selectedClip as any)?.effect?.type || (selectedClip as any)?.effect?.id || "none")
              : "none"
          }
          activeIntensity={
            selectedClipType === "effects" || selectedClipType === "effect"
              ? (selectedClip as EffectClip)?.intensity
              : selectedClipType === "video"
              ? (selectedClip as any)?.effectIntensity
              : undefined
          }
          onAddEffect={handleAddEffect}
          editingClip={
            selectedClipType === "effects" || selectedClipType === "effect"
              ? (selectedClip as EffectClip)
              : null
          }
          onUpdateEffect={handleUpdateEffect}
          isInline={isInline}
        />
      )}

      {activeModal === "stickers" && (
        <StickersModal
          visible={true}
          onClose={handleCancel}
          onAddSticker={handleAddSticker}
          editingClip={
            selectedClipType === "stickers" || selectedClipType === "sticker"
              ? (selectedClip as StickerClip)
              : null
          }
          onUpdateSticker={handleUpdateSticker}
          currentPlayheadTime={currentTime}
          isInline={isInline}
        />
      )}

      {activeModal === "transitions" && (
        <TransitionsModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          activeTransition={
            project?.tracks?.video?.find(
              (c) => c.id === transitionTargetClipId,
            )?.transition
          }
          onApplyTransition={handleApplyTransition}
          isInline={isInline}
        />
      )}

      {activeModal === "speed" && (
        <SpeedModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          clipType={selectedClipType || selectedClip?.type}
          clipDuration={selectedClip?.duration}
          currentSpeed={selectedClip?.speed || 1.0}
          currentCurve={selectedClip?.speedCurve}
          currentSlowMo={selectedClip?.smoothSlowMo}
          onApplySpeed={handleApplySpeed}
          isInline={isInline}
        />
      )}

      {(activeModal === "export" || route.screen === "export") && project && (
        <ExportModal
          visible={true}
          onClose={handleCancel}
          project={project}
          totalDuration={totalDuration}
        />
      )}

      {activeModal === "settings" && (
        <SettingsModal
          visible={true}
          onClose={handleCancel}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onReloadData={handleReloadAllData}
        />
      )}

      {activeModal === "notifications" && (
        <NotificationsModal
          visible={true}
          onClose={handleCancel}
          notifications={notifications}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClearAll={handleClearAllNotifications}
          onDeleteNotification={handleDeleteNotification}
          onActionClick={handleNotificationAction}
        />
      )}

      {activeModal === "volume" && (selectedClipType === "audio" || mediaHasAudioTrack(selectedClip)) && (
        <VolumeModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          currentVolume={selectedClip?.volume ?? 1.0}
          currentFadeIn={selectedClip?.fadeIn ?? 0}
          currentFadeOut={selectedClip?.fadeOut ?? 0}
          currentDenoise={Boolean(selectedClip?.denoise)}
          isFromVideo={selectedClipType === "video"}
          hasAudio={selectedClipType === "audio" || mediaHasAudioTrack(selectedClip)}
          onApplyVolume={handleApplyVolume}
          onExtractAudio={handleExtractAudioFromVideo}
          isInline={isInline}
        />
      )}

      {activeModal === "mask" && (
        <MaskModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          currentMask={selectedClip?.mask || selectedClip?.transform?.mask}
          onApplyMask={(newMask) => {
            handleApplyTransform(selectedClip?.transform || {}, undefined, newMask);
            if (handleUpdateClipMask && selectedClip?.id) {
              handleUpdateClipMask(selectedClip.id, newMask, true);
            }
          }}
          isInline={isInline}
        />
      )}

      {activeModal === "transform" && (
        <TransformModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          currentTransform={selectedClip?.transform}
          currentCrop={selectedClip?.crop || selectedClip?.transform?.crop}
          initialTab={transformInitialTab || "crop"}
          onApplyTransform={handleApplyTransform}
          onOpenScreenCrop={onOpenScreenCrop}
          setIsCroppingPreview={setIsCroppingPreview}
          isInline={isInline}
        />
      )}

      {activeModal === "autocut" && (
        <AutoCutModal
          visible={true}
          onClose={handleCancel}
          onAutoCutGenerated={handleAutoCutGenerated}
          currentProject={project}
        />
      )}

      {activeModal === "canvas" && (
        <CanvasModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          project={project}
          onUpdateProject={(updates) => updateProjectWithHistory(updates)}
          isInline={isInline}
        />
      )}

      {activeModal === "background" && (
        <BackgroundModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          project={project}
          onUpdateProject={(updates) => updateProjectWithHistory(updates)}
          isInline={isInline}
        />
      )}

      {activeModal === "enhance" && (
        <AIEnhanceModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          initialValues={(selectedClip as any)?.enhance}
          onApplyEnhance={handleApplyEnhance}
          isInline={isInline}
        />
      )}

      {activeModal === "tts" && (
        <TextToSpeechModal
          visible={true}
          onClose={handleCancel}
          onAddAudio={handleAddAudio}
          initialScript={
            selectedClipType === "text" && selectedClip
              ? (selectedClip as TextClip).text
              : undefined
          }
          isInline={isInline}
        />
      )}

      {/* Modern Sleek Keyframe Animation Studio Modal */}
      {activeModal === "keyframe" && (() => {
        let effectiveClip = selectedClip;
        let effectiveType = selectedClipType || "video";
        if (!effectiveClip && project) {
          const videoAtTime = project.tracks.video?.find(
            (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
          ) || project.tracks.video?.[0];
          if (videoAtTime) {
            effectiveClip = videoAtTime;
            effectiveType = "video";
          }
        }

        return (
          <KeyframeModal
            visible={true}
            onClose={handleCancel}
            onApply={handleApply}
            selectedClip={effectiveClip}
            selectedClipType={effectiveType}
            currentTime={currentTime}
            onSeek={(t) => setCurrentTime(t)}
            onAddKeyframe={handleAddKeyframe}
            hasKeyframeAtCurrentTime={isKeyframeAtPlayhead}
            onUpdateKeyframeTransform={handleUpdateKeyframeTransform}
            onDeleteKeyframeAtTime={handleDeleteKeyframeAtTime}
            onClearAllKeyframes={handleClearAllKeyframes}
            isInline={isInline}
          />
        );
      })()}

      {/* AI Speech Auto-Captions Studio Modal */}
      {activeModal === "captions" && (
        <AutoCaptionModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          project={project}
          onAddCaptions={(captions) => {
            if (handleAddCaptions) {
              handleAddCaptions(captions);
            }
            if (captions && captions.length > 0 && setCurrentTime) {
              setCurrentTime(captions[0].startTime);
            }
          }}
          onUpdateProject={updateProjectWithHistory}
          currentTime={currentTime}
          onSeek={(t) => setCurrentTime && setCurrentTime(t)}
          selectedClipId={selectedClipId}
          isInline={isInline}
        />
      )}



      {/* Opacity Panel */}
      {activeModal === "opacity" && selectedClip && (
        <View style={modalStyles.panelContainer}>
          <Text style={modalStyles.panelSectionTitle}>CLIP OPACITY</Text>
          <View style={modalStyles.chipRow}>
            {[100, 75, 50, 25, 0].map((op) => {
              const curOp = selectedClip?.opacity !== undefined ? Math.round(selectedClip.opacity * 100) : 100;
              const isSel = curOp === op;
              return (
                <TouchableOpacity
                  key={op}
                  style={[modalStyles.chipBtn, isSel && modalStyles.chipBtnActive]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    if (project) {
                      const tracks = { ...project.tracks };
                      const targetList = (tracks as any)[selectedClipType] || tracks.video;
                      const idx = targetList.findIndex((c: any) => c.id === selectedClip.id);
                      if (idx >= 0) {
                        targetList[idx] = { ...targetList[idx], opacity: op / 100 };
                        updateProjectWithHistory({ ...project, tracks });
                      }
                    }
                  }}
                >
                  <Text style={[modalStyles.chipText, isSel && modalStyles.chipTextActive]}>
                    {op}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Animation Presets Panel */}
      {activeModal === "animation" && selectedClip && (
        <AnimationModal
          visible={true}
          onClose={handleCancel}
          selectedClip={selectedClip}
          selectedClipType={selectedClipType}
          project={project}
          updateProjectWithHistory={updateProjectWithHistory}
          isInline={isInline}
        />
      )}

      {/* Layer Blend Mode Modal */}
      {activeModal === "blend" && (
        <BlendModeModal
          visible={true}
          onClose={handleCancel}
          isInline={isInline}
          currentMode={selectedClip?.transform?.blendMode || "normal"}
          currentOpacity={selectedClip?.opacity !== undefined ? selectedClip.opacity : 1.0}
          onApply={(mode, op) => {
            if (handleApplyBlendMode) {
              handleApplyBlendMode(mode, op);
            }
          }}
        />
      )}

      {/* 8-Channel Selective HSL Color Grading Modal */}
      {activeModal === "hsl" && (
        <HSLAdjustModal
          visible={true}
          onClose={handleCancel}
          isInline={isInline}
          initialAdjustments={selectedClip?.hslAdjustments}
          onApply={(adj) => {
            if (handleApplyHSL) {
              handleApplyHSL(adj);
            }
          }}
        />
      )}

      {/* CapCut Character Voice Changer & Audio FX Modal */}
      {(activeModal === "audio_effects" || activeModal === "voice_effects") && (
        <VoiceEffectsModal
          visible={true}
          onClose={handleCancel}
          isInline={isInline}
          currentEffect={selectedClip?.voiceEffect || "none"}
          onApply={(effectId) => {
            if (handleApplyVoiceEffect) {
              handleApplyVoiceEffect(effectId);
            }
          }}
        />
      )}

      {/* Clip Deletion Confirmation Modal */}
      <ConfirmDeleteModal
        visible={!!clipToDelete}
        title="Delete Clip?"
        message="Are you sure you want to delete this clip from the timeline?"
        itemName={clipToDelete?.name}
        itemType={clipToDelete?.type}
        itemDetails={
          clipToDelete?.duration
            ? `Duration: ${clipToDelete.duration.toFixed(1)}s`
            : undefined
        }
        confirmText="Delete Clip"
        cancelText="Cancel"
        onConfirm={handleConfirmDeleteClip}
        onCancel={() => setClipToDelete(null)}
      />
    </>
  );

  if (isInline) {
    return (
      <Animated.View
        key={activeModal || "inline-empty"}
        style={[
          {
            flex: 1,
            width: "100%",
            opacity: fadeAnim,
          },
          Platform.OS === "web" && ({
            animation: "fastartFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          } as any),
        ]}
      >
        {renderedContent}
      </Animated.View>
    );
  }

  return renderedContent;
};

const modalStyles = StyleSheet.create({
  panelContainer: {
    padding: 10,
    flex: 1,
    backgroundColor: "#0F131D",
  },
  panelSectionTitle: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  layerInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131826",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
    marginBottom: 10,
  },
  layerInfoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  layerInfoSubtitle: {
    fontSize: 9.5,
    color: "#94A3B8",
    marginTop: 1,
  },
  btnGrid: {
    flexDirection: "row",
    gap: 8,
  },
  actionCardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#131826",
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
    gap: 5,
  },
  actionCardText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  chipBtnActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "#00F2FE",
  },
  chipText: {
    fontSize: 10.5,
    color: "#94A3B8",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  animCard: {
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#131826",
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
    gap: 4,
  },
  animCardActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "#00F2FE",
  },
  animCardText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },
  animCardTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
});
