import React from "react";
import { View, StyleSheet } from "react-native";
import Header from "../Header";
import Player from "../Player";
import Timeline from "../Timeline";
import Toolbar from "../Toolbar";
import { soundEngine } from "../../utils/audioEngine";
import { FastArtProject } from "../../types/project";

interface EditorWorkspaceProps {
  project: FastArtProject;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  totalDuration: number;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  selectedClipType: string;
  setSelectedClipType: (type: string) => void;
  selectedClip: any;
  zoom: number;
  setZoom: (z: number) => void;
  settings: any;
  isCroppingPreview: boolean;
  setIsCroppingPreview: (c: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  onBackToHome: () => void;
  onAddKeyframe: () => void;
  onOpenKeyframeModal: () => void;
  isKeyframeAtPlayhead: boolean;
  openModal: (modal: string) => void;
  updateProjectWithHistory: (updates: any) => void;
  handleUpdateClipTransform: (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal?: boolean,
  ) => void;
  handleUpdateClipCrop: (clipId: string, crop: any, isFinal?: boolean) => void;
  handleSplitClip: () => void;
  handleDuplicateClip: () => void;
  handleDeleteClip: () => void;
  handleMoveClip: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
    newStartTime: number,
    newTrackIndex?: number,
  ) => void;
  handleTrimClip: (
    clipId: string,
    updates: {
      startTime?: number;
      duration?: number;
      trimIn?: number;
      trimOut?: number;
      trackIndex?: number;
    },
    isFinal?: boolean,
  ) => void;
  handleRotateClip: () => void;
  handleToggleReverse: () => void;
  handleOpenTransitionsModal: (clipId: string) => void;
  handleDeselectClip: () => void;
  handleOpenSpeedModal: () => void;
  handleOpenVolumeModal: () => void;
  handleOpenCropModal: () => void;
  handleOpenMaskModal: () => void;
  handleOpenAudioModal: () => void;
  handleOpenTextModal: () => void;
  handleOpenFiltersModal: () => void;
  handleOpenEffectsModal: () => void;
  handleOpenStickersModal: () => void;
  handleOpenMediaPicker: () => void;
  handleOpenTTS: () => void;
  handleOpenEnhance: () => void;
  handleOpenAutoCut: () => void;
  handleOpenCanvasModal: () => void;
  handleOpenCutoutModal: () => void;
  handleOpenMotionTracking: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  project,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  totalDuration,
  isFullscreen,
  setIsFullscreen,
  selectedClipId,
  setSelectedClipId,
  selectedClipType,
  setSelectedClipType,
  selectedClip,
  zoom,
  setZoom,
  settings,
  isCroppingPreview,
  setIsCroppingPreview,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
  onBackToHome,
  onAddKeyframe,
  onOpenKeyframeModal,
  isKeyframeAtPlayhead,
  openModal,
  updateProjectWithHistory,
  handleUpdateClipTransform,
  handleUpdateClipCrop,
  handleSplitClip,
  handleDuplicateClip,
  handleDeleteClip,
  handleMoveClip,
  handleTrimClip,
  handleRotateClip,
  handleToggleReverse,
  handleOpenTransitionsModal,
  handleDeselectClip,
  handleOpenSpeedModal,
  handleOpenVolumeModal,
  handleOpenCropModal,
  handleOpenMaskModal,
  handleOpenAudioModal,
  handleOpenTextModal,
  handleOpenFiltersModal,
  handleOpenEffectsModal,
  handleOpenStickersModal,
  handleOpenMediaPicker,
  handleOpenTTS,
  handleOpenEnhance,
  handleOpenAutoCut,
  handleOpenCanvasModal,
  handleOpenCutoutModal,
  handleOpenMotionTracking,
}) => {
  return (
    <View style={styles.editorContainer}>
      {/* Top Header Bar */}
      {!isFullscreen && (
        <Header
          project={project}
          onUpdateProject={(updates) => updateProjectWithHistory(updates)}
          onBackToHome={onBackToHome}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onOpenExport={onOpenExport}
        />
      )}

      {/* Canvas Viewport & Player Controls in Flex-1 Center Stage */}
      <View
        style={[
          styles.playerStage,
          isFullscreen && styles.playerStageFullscreen,
        ]}
      >
        <Player
          project={project}
          currentTime={currentTime}
          isPlaying={isPlaying}
          totalDuration={totalDuration}
          fullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          onTogglePlay={() => {
            soundEngine.playSfx("click");
            if (
              !isPlaying &&
              (currentTime >= totalDuration - 0.05 ||
                currentTime >= totalDuration)
            ) {
              setCurrentTime(0);
            }
            setIsPlaying(!isPlaying);
          }}
          onSeek={(t) => setCurrentTime(t)}
          onAddKeyframe={onAddKeyframe}
          onOpenKeyframeModal={onOpenKeyframeModal}
          hasKeyframeAtCurrentTime={isKeyframeAtPlayhead}
          onOpenMediaPicker={() => openModal("media")}
          selectedClipId={selectedClipId}
          selectedClipType={selectedClipType}
          onSelectClip={(id, type) => {
            setSelectedClipId(id);
            if (type) setSelectedClipType(type);
          }}
          onUpdateClipTransform={handleUpdateClipTransform}
          isCroppingPreview={isCroppingPreview}
          onToggleCropPreview={setIsCroppingPreview}
          onUpdateClipCrop={handleUpdateClipCrop}
        />
      </View>

      {/* Bottom Multi-Track Timeline & Action Dock */}
      {!isFullscreen && (
        <View style={styles.bottomDock}>
          <Timeline
            project={project}
            currentTime={currentTime}
            totalDuration={totalDuration}
            onSeek={(t) => setCurrentTime(t)}
            selectedClipId={selectedClipId}
            selectedClipType={selectedClipType}
            onSelectClip={(id, type) => {
              setSelectedClipId(id);
              if (type) setSelectedClipType(type);
            }}
            onTrimClip={handleTrimClip}
            onMoveClip={handleMoveClip}
            onOpenTransitions={handleOpenTransitionsModal}
            onOpenMediaPicker={() => openModal("media")}
            onOpenTextModal={() => openModal("text")}
            onOpenAudioModal={() => openModal("audio")}
            onOpenEffectsModal={() => openModal("effects")}
            onOpenStickersModal={() => openModal("stickers")}
            zoom={zoom}
            onZoomChange={(newZoom) => setZoom(newZoom)}
            onAdjustDuration={(delta) => {
              if (!selectedClipId) return;
              const key =
                selectedClipType === "sticker" ||
                selectedClipType === "stickers"
                  ? "stickers"
                  : selectedClipType;
              const list = [...((project.tracks as any)[key] || [])];
              const idx = list.findIndex((c: any) => c.id === selectedClipId);
              if (idx >= 0) {
                const newDur = Math.max(
                  0.05,
                  (list[idx].duration || 0) + delta,
                );
                list[idx] = {
                  ...list[idx],
                  duration: Number(newDur.toFixed(3)),
                };
                updateProjectWithHistory({
                  ...project,
                  tracks: { ...project.tracks, [key]: list } as any,
                });
              }
            }}
            onSplitClip={handleSplitClip}
            onDuplicateClip={handleDuplicateClip}
            onDeleteClip={handleDeleteClip}
            onOpenEditModal={(clipId, clipType) => {
              setSelectedClipId(clipId);
              const normalizedType =
                clipType === "sticker" || clipType === "stickers"
                  ? "stickers"
                  : clipType === "effect" || clipType === "effects"
                    ? "effects"
                    : clipType;
              setSelectedClipType(normalizedType);
              if (normalizedType === "text") openModal("text");
              else if (normalizedType === "stickers") openModal("stickers");
              else if (normalizedType === "audio") openModal("volume");
              else if (normalizedType === "effects") openModal("effects");
              else setIsCroppingPreview(true);
            }}
          />

          <Toolbar
            selectedClip={selectedClip}
            selectedClipType={selectedClipType}
            onDeselectClip={handleDeselectClip}
            onSplitClip={handleSplitClip}
            onDeleteClip={handleDeleteClip}
            onDuplicateClip={handleDuplicateClip}
            onRotateClip={handleRotateClip}
            onToggleReverse={handleToggleReverse}
            onOpenSpeedModal={handleOpenSpeedModal}
            onOpenVolumeModal={handleOpenVolumeModal}
            onOpenCropModal={handleOpenCropModal}
            onOpenMaskModal={handleOpenMaskModal}
            onOpenAudioModal={handleOpenAudioModal}
            onOpenTextModal={handleOpenTextModal}
            onOpenFiltersModal={handleOpenFiltersModal}
            onOpenEffectsModal={handleOpenEffectsModal}
            onOpenStickersModal={handleOpenStickersModal}
            onOpenMediaPicker={handleOpenMediaPicker}
            onOpenTTS={handleOpenTTS}
            onOpenEnhance={handleOpenEnhance}
            onOpenAutoCut={handleOpenAutoCut}
            onOpenCanvasModal={handleOpenCanvasModal}
            onOpenCutoutModal={handleOpenCutoutModal}
            onOpenMotionTracking={handleOpenMotionTracking}
            onOpenKeyframeModal={onOpenKeyframeModal}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  editorContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    backgroundColor: "#0B0D13",
    overflow: "hidden" as any,
  },
  playerStage: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden" as any,
  },
  playerStageFullscreen: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },
  bottomDock: {
    width: "100%",
    flexShrink: 0,
    backgroundColor: "#0E1118",
  },
});
