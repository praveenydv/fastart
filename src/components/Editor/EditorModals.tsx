import React from "react";
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
import CropTransformModal from "../Panels/CropTransformModal";
import AutoCutModal from "../Panels/AutoCutModal";
import CanvasModal from "../Panels/CanvasModal";
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
}

export const EditorModals: React.FC<EditorModalsProps> = ({
  activeModal,
  closeModal,
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
}) => {
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
          onClose={closeModal}
          currentCutout={selectedClip?.cutout}
          onApplyCutout={handleApplyCutout}
        />
      )}

      {activeModal === "tracking" && (
        <MotionTrackingModal
          visible={true}
          onClose={closeModal}
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
            onClose={closeModal}
            onAddText={handleAddText}
            editingClip={editingTarget}
            onUpdateText={(clip) => {
              if (handleUpdateText) {
                handleUpdateText(clip);
              }
            }}
            currentPlayheadTime={currentTime}
          />
        );
      })()}

      {activeModal === "audio" && (
        <AudioModal
          visible={true}
          onClose={closeModal}
          onAddAudio={handleAddAudio}
        />
      )}

      {activeModal === "filters" && (
        <FiltersModal
          visible={true}
          onClose={closeModal}
          activeFilter={selectedClip?.filter || "normal"}
          onSelectFilter={handleApplyFilter}
        />
      )}

      {activeModal === "effects" && (
        <EffectsModal
          visible={true}
          onClose={closeModal}
          activeEffect={selectedClip?.effect || "none"}
          onAddEffect={handleAddEffect}
          editingClip={
            selectedClipType === "effects" || selectedClipType === "effect"
              ? (selectedClip as EffectClip)
              : null
          }
          onUpdateEffect={handleUpdateEffect}
        />
      )}

      {activeModal === "stickers" && (
        <StickersModal
          visible={true}
          onClose={closeModal}
          onAddSticker={handleAddSticker}
          editingClip={
            selectedClipType === "stickers" || selectedClipType === "sticker"
              ? (selectedClip as StickerClip)
              : null
          }
          onUpdateSticker={handleUpdateSticker}
          currentPlayheadTime={currentTime}
        />
      )}

      {activeModal === "transitions" && (
        <TransitionsModal
          visible={true}
          onClose={closeModal}
          activeTransition={
            project?.tracks?.video?.find(
              (c) => c.id === transitionTargetClipId,
            )?.transition
          }
          onApplyTransition={handleApplyTransition}
        />
      )}

      {activeModal === "speed" && (
        <SpeedModal
          visible={true}
          onClose={closeModal}
          currentSpeed={selectedClip?.speed || 1.0}
          currentCurve={selectedClip?.speedCurve}
          currentSlowMo={selectedClip?.smoothSlowMo}
          onApplySpeed={handleApplySpeed}
        />
      )}

      {(activeModal === "export" || route.screen === "export") && project && (
        <ExportModal
          visible={true}
          onClose={closeModal}
          project={project}
          totalDuration={totalDuration}
        />
      )}

      {activeModal === "settings" && (
        <SettingsModal
          visible={true}
          onClose={closeModal}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onReloadData={handleReloadAllData}
        />
      )}

      {activeModal === "notifications" && (
        <NotificationsModal
          visible={true}
          onClose={closeModal}
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
          onClose={closeModal}
          currentVolume={selectedClip?.volume ?? 1.0}
          currentFadeIn={selectedClip?.fadeIn ?? 0}
          currentFadeOut={selectedClip?.fadeOut ?? 0}
          currentDenoise={Boolean(selectedClip?.denoise)}
          isFromVideo={selectedClipType === "video"}
          hasAudio={mediaHasAudioTrack(selectedClip)}
          onApplyVolume={handleApplyVolume}
          onExtractAudio={handleExtractAudioFromVideo}
        />
      )}

      {activeModal === "mask" && (
        <CropTransformModal
          visible={true}
          onClose={closeModal}
          currentTransform={selectedClip?.transform}
          currentMask={selectedClip?.mask || selectedClip?.transform?.mask}
          initialTab="mask"
          onApplyTransform={handleApplyTransform}
        />
      )}

      {activeModal === "autocut" && (
        <AutoCutModal
          visible={true}
          onClose={closeModal}
          onAutoCutGenerated={handleAutoCutGenerated}
          currentProject={project}
        />
      )}

      {activeModal === "canvas" && (
        <CanvasModal
          visible={true}
          onClose={closeModal}
          project={project}
          onUpdateProject={(updates) => updateProjectWithHistory(updates)}
        />
      )}

      {activeModal === "enhance" && (
        <AIEnhanceModal
          visible={true}
          onClose={closeModal}
          initialValues={(selectedClip as any)?.enhance}
          onApplyEnhance={handleApplyEnhance}
        />
      )}

      {activeModal === "tts" && (
        <TextToSpeechModal
          visible={true}
          onClose={closeModal}
          onAddAudio={handleAddAudio}
          initialScript={
            selectedClipType === "text" && selectedClip
              ? (selectedClip as TextClip).text
              : undefined
          }
        />
      )}

      {/* Modern Sleek Keyframe Animation Studio Modal */}
      {activeModal === "keyframe" && (
        <KeyframeModal
          visible={true}
          onClose={closeModal}
          selectedClip={selectedClip}
          selectedClipType={selectedClipType || "video"}
          currentTime={currentTime}
          onSeek={(t) => setCurrentTime(t)}
          onAddKeyframe={handleAddKeyframe}
          hasKeyframeAtCurrentTime={isKeyframeAtPlayhead}
          onUpdateKeyframeTransform={handleUpdateKeyframeTransform}
          onDeleteKeyframeAtTime={handleDeleteKeyframeAtTime}
          onClearAllKeyframes={handleClearAllKeyframes}
        />
      )}

      {/* AI Speech Auto-Captions & Subtitle Studio Modal */}
      {activeModal === "captions" && (
        <AutoCaptionModal
          visible={true}
          onClose={closeModal}
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
};
