import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
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
import MaskModal from "../Panels/MaskModal";
import TransformModal from "../Panels/TransformModal";
import AutoCutModal from "../Panels/AutoCutModal";
import CanvasModal from "../Panels/CanvasModal";
import BackgroundModal from "../Panels/BackgroundModal";
import AIEnhanceModal from "../Panels/AIEnhanceModal";
import TextToSpeechModal from "../Panels/TextToSpeechModal";
import CutoutModal from "../Panels/CutoutModal";
import MotionTrackingModal from "../Panels/MotionTrackingModal";
import ConfirmDeleteModal from "../ConfirmDeleteModal";
import KeyframeModal from "../Panels/KeyframeModal";
import AutoCaptionModal from "../Panels/AutoCaptionModal";
import {
  FastArtProject,
  TextClip,
  StickerClip,
  EffectClip,
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
  handleAddKeyframe: () => void;
  isKeyframeAtPlayhead: boolean;
  handleUpdateKeyframeTransform: (time: number, transform: any, opacity?: number) => void;
  handleDeleteKeyframeAtTime: (time?: number) => void;
  handleClearAllKeyframes: () => void;
  handleConfirmDeleteClip: () => void;
  handleAddCaptions?: (captions: any[]) => void;
  handleUpdateCaption?: (clip: any) => void;
  transformInitialTab?: 'crop' | 'flip' | 'rotate' | 'stretch' | 'angle';
  onOpenScreenCrop?: () => void;
  isInline?: boolean;
  handleMoveClip?: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects" | "caption",
    newStartTime: number,
    newTrackIndex?: number,
    isInsertNewTrack?: boolean,
  ) => void;
}

export const INLINE_MODAL_KEYS = new Set([
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
  'layer',
  'opacity',
  'animation',
  'audio_effects',
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
  handleAddKeyframe,
  isKeyframeAtPlayhead,
  handleUpdateKeyframeTransform,
  handleDeleteKeyframeAtTime,
  handleClearAllKeyframes,
  handleConfirmDeleteClip,
  transformInitialTab,
  onOpenScreenCrop,
  isInline = false,
  handleMoveClip,
}) => {
  const handleCancel = onCancelModal || closeModal;
  const handleApply = onApplyModal || closeModal;

  // When isInline is true, only render if activeModal is an inline modal tool
  if (isInline && (!activeModal || !INLINE_MODAL_KEYS.has(activeModal))) {
    return null;
  }
  // When isInline is false, do not render inline modal tools (they are rendered in the panel/dock)
  if (!isInline && activeModal && INLINE_MODAL_KEYS.has(activeModal)) {
    return null;
  }

  return (
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
        />
      )}

      {activeModal === "filters" && (
        <FiltersModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          activeFilter={selectedClip?.filter || "normal"}
          onSelectFilter={handleApplyFilter}
          isInline={isInline}
        />
      )}

      {activeModal === "effects" && (
        <EffectsModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          activeEffect={selectedClip?.effect || "none"}
          onAddEffect={handleAddEffect}
          editingClip={
            selectedClipType === "effects" || selectedClipType === "effect"
              ? (selectedClip as EffectClip)
              : null
          }
          onUpdateEffect={handleUpdateEffect}
          isVideoClip={selectedClipType === "video" && !!selectedClip}
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

      {activeModal === "volume" && mediaHasAudioTrack(selectedClip) && (
        <VolumeModal
          visible={true}
          onClose={handleCancel}
          onApply={handleApply}
          currentVolume={selectedClip?.volume ?? 1.0}
          currentFadeIn={selectedClip?.fadeIn ?? 0}
          currentFadeOut={selectedClip?.fadeOut ?? 0}
          currentDenoise={Boolean(selectedClip?.denoise)}
          isFromVideo={selectedClipType === "video"}
          hasAudio={mediaHasAudioTrack(selectedClip)}
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
          onApplyMask={(newMask) =>
            handleApplyTransform(selectedClip?.transform || {}, undefined, newMask)
          }
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

      {/* Layer / Track Order Panel */}
      {activeModal === "layer" && selectedClip && (
        <View style={modalStyles.panelContainer}>
          <Text style={modalStyles.panelSectionTitle}>LAYER ORDER</Text>
          <View style={modalStyles.layerInfoBox}>
            <MaterialCommunityIcons name="layers-outline" size={24} color="#00F2FE" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={modalStyles.layerInfoTitle}>
                Current: Layer {((typeof selectedClip.trackIndex === "number" ? selectedClip.trackIndex : (selectedClipType === "video" ? 0 : 2))) + 1}
              </Text>
              <Text style={modalStyles.layerInfoSubtitle}>
                Higher layer numbers render in front of lower layer numbers.
              </Text>
            </View>
          </View>

          <View style={modalStyles.btnGrid}>
            <TouchableOpacity
              style={modalStyles.actionCardBtn}
              onPress={() => {
                soundEngine.playSfx("click");
                const cur = typeof selectedClip.trackIndex === "number" ? selectedClip.trackIndex : 0;
                if (cur > 0 && handleMoveClip) {
                  handleMoveClip(selectedClip.id, selectedClipType as any, selectedClip.startTime, cur - 1);
                } else if (cur > 0 && project) {
                  const tracks = { ...project.tracks };
                  const targetList = (tracks as any)[selectedClipType] || tracks.video;
                  const idx = targetList.findIndex((c: any) => c.id === selectedClip.id);
                  if (idx >= 0) {
                    targetList[idx] = { ...targetList[idx], trackIndex: cur - 1 };
                    updateProjectWithHistory({ ...project, tracks });
                  }
                }
              }}
            >
              <Ionicons name="arrow-down" size={16} color="#00F2FE" />
              <Text style={modalStyles.actionCardText}>Move Down</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={modalStyles.actionCardBtn}
              onPress={() => {
                soundEngine.playSfx("click");
                const cur = typeof selectedClip.trackIndex === "number" ? selectedClip.trackIndex : 0;
                if (handleMoveClip) {
                  handleMoveClip(selectedClip.id, selectedClipType as any, selectedClip.startTime, cur + 1);
                } else if (project) {
                  const tracks = { ...project.tracks };
                  const targetList = (tracks as any)[selectedClipType] || tracks.video;
                  const idx = targetList.findIndex((c: any) => c.id === selectedClip.id);
                  if (idx >= 0) {
                    targetList[idx] = { ...targetList[idx], trackIndex: cur + 1 };
                    updateProjectWithHistory({ ...project, tracks });
                  }
                }
              }}
            >
              <Ionicons name="arrow-up" size={16} color="#00F2FE" />
              <Text style={modalStyles.actionCardText}>Move Up</Text>
            </TouchableOpacity>
          </View>

          <Text style={[modalStyles.panelSectionTitle, { marginTop: 16 }]}>QUICK LAYER ASSIGN</Text>
          <View style={modalStyles.chipRow}>
            {[1, 2, 3, 4, 5].map((lvl) => {
              const curLvl = ((typeof selectedClip.trackIndex === "number" ? selectedClip.trackIndex : (selectedClipType === "video" ? 0 : 2))) + 1;
              const isSel = curLvl === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[modalStyles.chipBtn, isSel && modalStyles.chipBtnActive]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    if (handleMoveClip) {
                      handleMoveClip(selectedClip.id, selectedClipType as any, selectedClip.startTime, lvl - 1);
                    } else if (project) {
                      const tracks = { ...project.tracks };
                      const targetList = (tracks as any)[selectedClipType] || tracks.video;
                      const idx = targetList.findIndex((c: any) => c.id === selectedClip.id);
                      if (idx >= 0) {
                        targetList[idx] = { ...targetList[idx], trackIndex: lvl - 1 };
                        updateProjectWithHistory({ ...project, tracks });
                      }
                    }
                  }}
                >
                  <Text style={[modalStyles.chipText, isSel && modalStyles.chipTextActive]}>
                    Layer {lvl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
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
        <ScrollView style={modalStyles.panelContainer} showsVerticalScrollIndicator={false}>
          <Text style={modalStyles.panelSectionTitle}>ENTRANCE & MOTION</Text>
          <View style={modalStyles.chipGrid}>
            {[
              { id: "none", name: "None", icon: "close-circle-outline" },
              { id: "fade_in", name: "Fade In", icon: "arrow-up-right" },
              { id: "slide_left", name: "Slide Left", icon: "arrow-back-outline" },
              { id: "slide_right", name: "Slide Right", icon: "arrow-forward-outline" },
              { id: "zoom_in", name: "Zoom In", icon: "expand-outline" },
              { id: "zoom_out", name: "Zoom Out", icon: "contract-outline" },
              { id: "bounce", name: "Bounce", icon: "flash-outline" },
            ].map((anim) => {
              const isSel = (selectedClip?.animation?.preset || "none") === anim.id;
              return (
                <TouchableOpacity
                  key={anim.id}
                  style={[modalStyles.animCard, isSel && modalStyles.animCardActive]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    if (project) {
                      const tracks = { ...project.tracks };
                      const targetList = (tracks as any)[selectedClipType] || tracks.video;
                      const idx = targetList.findIndex((c: any) => c.id === selectedClip.id);
                      if (idx >= 0) {
                        targetList[idx] = {
                          ...targetList[idx],
                          animation: anim.id === "none" ? undefined : { preset: anim.id, duration: 0.5 },
                        };
                        updateProjectWithHistory({ ...project, tracks });
                      }
                    }
                  }}
                >
                  <Ionicons name={anim.icon as any} size={20} color={isSel ? "#00F2FE" : "#A1A1AA"} />
                  <Text style={[modalStyles.animCardText, isSel && modalStyles.animCardTextActive]}>
                    {anim.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Audio Effects Panel */}
      {activeModal === "audio_effects" && (
        <ScrollView style={modalStyles.panelContainer} showsVerticalScrollIndicator={false}>
          <Text style={modalStyles.panelSectionTitle}>VOICE & AUDIO EFFECTS</Text>
          <View style={modalStyles.chipGrid}>
            {[
              { id: "deep", name: "Deep Voice", icon: "waveform" },
              { id: "echo", name: "Echo Chamber", icon: "ear-hearing" },
              { id: "robot", name: "Robot Synth", icon: "robot-outline" },
              { id: "reverb", name: "Mic Reverb", icon: "surround-sound" },
              { id: "lofi", name: "Lo-Fi Vinyl", icon: "disc" },
              { id: "high", name: "High Pitch", icon: "arrow-up-circle-outline" },
            ].map((eff) => (
              <TouchableOpacity
                key={eff.id}
                style={modalStyles.animCard}
                onPress={() => {
                  soundEngine.playSfx("click");
                }}
              >
                <MaterialCommunityIcons name={eff.icon as any} size={20} color="#00F2FE" />
                <Text style={modalStyles.animCardText}>{eff.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
};

const modalStyles = StyleSheet.create({
  panelContainer: {
    padding: 16,
    flex: 1,
    backgroundColor: "#0E0F14",
  },
  panelSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717A",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  layerInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16171F",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#262838",
    marginBottom: 16,
  },
  layerInfoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  layerInfoSubtitle: {
    fontSize: 11,
    color: "#8E95A5",
    marginTop: 2,
  },
  btnGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionCardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1B24",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2D3C",
    gap: 6,
  },
  actionCardText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#16171F",
    borderWidth: 1,
    borderColor: "#272836",
  },
  chipBtnActive: {
    backgroundColor: "rgba(0, 242, 254, 0.15)",
    borderColor: "#00F2FE",
  },
  chipText: {
    fontSize: 12,
    color: "#A1A1AA",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  animCard: {
    width: "47%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16171F",
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#262838",
    gap: 6,
  },
  animCardActive: {
    backgroundColor: "rgba(0, 242, 254, 0.15)",
    borderColor: "#00F2FE",
  },
  animCardText: {
    fontSize: 12,
    color: "#D1D5DB",
    fontWeight: "600",
  },
  animCardTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
});
