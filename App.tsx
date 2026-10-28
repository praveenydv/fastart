import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { StyleSheet, View, StatusBar, Platform, BackHandler } from "react-native";
import HomeDashboard from "./src/components/HomeDashboard";
import SettingsScreen from "./src/components/SettingsScreen";
import NotificationsScreen from "./src/components/NotificationsScreen";
import SplashScreen from "./src/components/SplashScreen";
import ConfirmExitModal from "./src/components/ConfirmExitModal";
import * as ExpoSplashScreen from "expo-splash-screen";
import { useAppRouter } from "./src/utils/router";
import { EditorWorkspace } from "./src/components/Editor/EditorWorkspace";
import { EditorModals } from "./src/components/Editor/EditorModals";
import { ProjectStatusScreens } from "./src/components/Editor/ProjectStatusScreens";
import { useAppBootstrap } from "./src/hooks/useAppBootstrap";
import { useProjectHistory } from "./src/hooks/useProjectHistory";
import { useProjectClipMutations } from "./src/hooks/useProjectClipMutations";
import { useProjectMediaAdders } from "./src/hooks/useProjectMediaAdders";
import { useProjectKeyframes } from "./src/hooks/useProjectKeyframes";
import { useKeyboardShortcuts } from "./src/hooks/useKeyboardShortcuts";
import { usePlaybackLoop } from "./src/hooks/usePlaybackLoop";
import { computeTotalDuration, FastArtProject } from "./src/types/project";
import { soundEngine } from "./src/utils/audioEngine";
import { saveLastSession, LastEditSession, saveProject } from "./src/utils/storage";
import { mediaHasAudioTrack } from "./src/utils/mediaAudioDetector";

// Keep native splash screen visible while app hydrates
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const { route, navigate } = useAppRouter();

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipType, setSelectedClipType] = useState<string>("video");
  const [zoom, setZoom] = useState(60);
  const [clipToDelete, setClipToDelete] = useState<{
    id: string;
    type: string;
    name?: string;
    duration?: number;
  } | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [transitionTargetClipId, setTransitionTargetClipId] = useState<string | null>(null);
  const [isCroppingPreview, setIsCroppingPreview] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  // Undefined means reopen the clip using its saved cutout mode. Explicit
  // toolbar shortcuts still select Auto or Chroma Key deliberately.
  const [cutoutInitialMode, setCutoutInitialMode] = useState<'auto' | 'chroma' | undefined>(undefined);
  const [transformInitialTab, setTransformInitialTab] = useState<'crop' | 'flip' | 'rotate' | 'stretch' | 'angle'>('crop');

  // Snapshot refs for rolling back unapplied preview changes
  const modalInitialSnapshotRef = useRef<FastArtProject | null>(null);
  const initialHistoryLengthRef = useRef<number>(0);
  const historyStackRef = useRef<FastArtProject[]>([]);

  // Modals that support interactive preview with cancel rollback
  const PREVIEW_MODALS = new Set([
    "filters",
    "effects",
    "transitions",
    "speed",
    "volume",
    "mask",
    "cutout",
    "canvas",
    "enhance",
    "keyframe",
    "tracking",
    "transform",
    "animation",
    "blend",
    "hsl",
    "audio_effects",
    "voice_effects",
    "opacity",
  ]);

  // Modal helpers synced with URL
  const openModal = useCallback((modalName: string) => {
    const CLIP_DEPENDENT_TOOLS = new Set([
      "transitions",
      "speed",
      "volume",
      "mask",
      "cutout",
      "enhance",
      "keyframe",
      "tracking",
      "transform",
      "animation",
      "blend",
      "hsl",
      "audio_effects",
      "voice_effects",
      "opacity",
    ]);
    if (CLIP_DEPENDENT_TOOLS.has(modalName) && !selectedClipId && projectRef.current) {
      const curTime = currentTimeRef.current || 0;
      const target =
        projectRef.current.tracks?.video?.find(
          (c) => curTime >= c.startTime && curTime <= c.startTime + c.duration,
        ) || projectRef.current.tracks?.video?.[0];
      if (target) {
        setSelectedClipId(target.id);
        setSelectedClipType("video");
      }
    }

    if (PREVIEW_MODALS.has(modalName) && projectRef.current) {
      modalInitialSnapshotRef.current = JSON.parse(JSON.stringify(projectRef.current));
      initialHistoryLengthRef.current = historyStackRef.current.length;
    } else {
      modalInitialSnapshotRef.current = null;
    }
    setActiveModal(modalName);
    if (route.screen === "editor" && projectRef.current) {
      navigate(`/project/${projectRef.current.id}?tool=${modalName}`, { replace: true });
    }
  }, [route.screen, navigate, selectedClipId]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    if (route.screen === "editor" && projectRef.current) {
      navigate(`/project/${projectRef.current.id}`, { replace: true });
    }
  }, [route.screen, navigate]);

  // App initialization, hydration, and routing sync hook
  const {
    projects,
    setProjects,
    project,
    setProject,
    lastSession,
    setLastSession,
    settings,
    notifications,
    isAppLoading,
    splashVisible,
    setSplashVisible,
    splashStatus,
    handleOpenProject,
    handleCreateNewProject,
    handleDuplicateProject,
    handleDeleteProject,
    handleRenameProject,
    handleUpdateSettings,
    handleReloadAllData,
    handleMarkAllAsRead,
    handleClearAllNotifications,
    handleDeleteNotification,
    handleNotificationAction,
    handleAutoCutGenerated,
  } = useAppBootstrap({
    route,
    navigate,
    setCurrentTime,
    setIsPlaying,
    setSelectedClipId,
    setActiveModal,
    setIsFullscreen,
    closeModal,
  });

  const projectRef = useRef(project);
  projectRef.current = project;

  // History stack hook
  const {
    historyStack,
    redoStack,
    setHistoryStack,
    setRedoStack,
    updateProjectWithHistory,
    updateProjectPreview,
    commitPreview,
    discardPreview,
    handleUndo,
    handleRedo,
  } = useProjectHistory({
    projectRef,
    setProject,
    setProjects,
  });
  historyStackRef.current = historyStack;

  // Staged Preview Dispatcher:
  // When inside any modal (modalInitialSnapshotRef.current != null):
  // Updates are live, transient previews (zero history pollution, 60fps in-memory preview, no disk I/O).
  // Outside modals (timeline split/trim/delete/move/add): records normal undo history and saves to storage.
  const updateProjectDispatcher = useCallback(
    (updatedProject: any) => {
      if (modalInitialSnapshotRef.current) {
        updateProjectPreview(updatedProject);
      } else {
        updateProjectWithHistory(updatedProject);
      }
    },
    [updateProjectPreview, updateProjectWithHistory],
  );

  // Intelligent Apply: Commits preview changes into undo stack, updates baseline snapshot, and KEEPS modal open!
  const handleApplyModal = useCallback(() => {
    if (modalInitialSnapshotRef.current) {
      commitPreview(modalInitialSnapshotRef.current);
      // Advance snapshot to current state so further tweaks can also be previewed / committed
      if (projectRef.current) {
        modalInitialSnapshotRef.current = JSON.parse(JSON.stringify(projectRef.current));
      }
    }
    soundEngine.playSfx("whoosh");
    // Modal stays open so user can keep editing or viewing results
  }, [commitPreview]);

  // Close modal intelligently keeping live adjustments
  const handleCancelModal = useCallback(() => {
    if (modalInitialSnapshotRef.current) {
      commitPreview(modalInitialSnapshotRef.current);
      modalInitialSnapshotRef.current = null;
    }
    closeModal();
  }, [closeModal, commitPreview]);

  // Selected clip object
  const selectedClip = useMemo(() => {
    if (!selectedClipId || !project) return null;
    const key = (
      selectedClipType === "caption" || selectedClipType === "captions"
        ? "captions"
        : selectedClipType === "sticker" || selectedClipType === "stickers"
          ? "stickers"
          : selectedClipType === "effect" || selectedClipType === "effects"
            ? "effects"
            : selectedClipType === "photo"
              ? "video"
              : selectedClipType
    ) as keyof typeof project.tracks;

    const list = (project.tracks[key] as any[]) || [];
    const found = list.find((c: any) => c.id === selectedClipId);
    if (found) return found;

    for (const trackKey of Object.keys(project.tracks) as (keyof typeof project.tracks)[]) {
      const match = (project.tracks[trackKey] as any[])?.find(
        (c: any) => c.id === selectedClipId,
      );
      if (match) return match;
    }
    return null;
  }, [selectedClipId, selectedClipType, project]);

  // Auto-target active video or photo clip at playhead if none is explicitly selected
  const ensureSelectedVideoClip = useCallback(() => {
    if (!selectedClipId && projectRef.current) {
      const curTime = currentTimeRef.current || 0;
      const target =
        projectRef.current.tracks?.video?.find(
          (c) => curTime >= c.startTime && curTime <= c.startTime + c.duration,
        ) || projectRef.current.tracks?.video?.[0];
      if (target) {
        setSelectedClipId(target.id);
        setSelectedClipType(target.type === "photo" ? "photo" : "video");
        return target;
      }
    }
    return selectedClip;
  }, [selectedClipId, selectedClip]);

  // Media addition & modal apply hook
  const {
    handleUpdateText,
    handleUpdateCaption,
    handleUpdateSticker,
    handleUpdateEffect,
    handleAddMedia,
    handleAddText,
    handleAddAudio,
    handleAddSticker,
    handleAddEffect,
    handleApplyFilter,
    handleApplyCutout,
    handleApplyMotionTracking,
    handleApplyTransition,
    handleApplySpeed,
    handleApplyVolume,
    handleToggleDenoise,
    handleExtractAudioFromVideo,
    handleApplyTransform,
    handleApplyEnhance,
    handleApplyBlendMode,
    handleApplyHSL,
    handleApplyVoiceEffect,
    handleAddCaptions,
    isProcessing,
    processingMessage,
    startProcessing,
  } = useProjectMediaAdders({
    project,
    projectRef,
    selectedClip,
    selectedClipId,
    selectedClipType,
    currentTime,
    transitionTargetClipId,
    updateProjectWithHistory: updateProjectDispatcher,
    setActiveModal,
    setSelectedClipId,
    setSelectedClipType,
  });

  // Clip mutations hook
  const {
    handleSplitClip,
    handleFreezeFrame,
    handleDeleteClip,
    handleConfirmDeleteClip,
    handleDuplicateClip,
    handleRotateClip,
    handleToggleReverse,
    handleUpdateClipTransform,
    handleUpdateClipCrop,
    handleUpdateClipMask,
    handleTrimClip,
    handleMoveClip,
  } = useProjectClipMutations({
    project,
    projectRef,
    setProject,
    selectedClip,
    selectedClipId,
    setSelectedClipId,
    selectedClipType,
    setSelectedClipType,
    currentTimeRef,
    settings,
    clipToDelete,
    setClipToDelete,
    updateProjectWithHistory: updateProjectDispatcher,
    setIsCroppingPreview,
    startProcessing,
  });

  // Keyframes hook
  const {
    isKeyframeAtPlayhead,
    handleAddKeyframe,
    handleUpdateKeyframeTransform,
    handleDeleteKeyframeAtTime,
    handleClearAllKeyframes,
  } = useProjectKeyframes({
    project,
    selectedClip,
    selectedClipId,
    selectedClipType,
    setSelectedClipId,
    setSelectedClipType,
    currentTime,
    currentTimeRef,
    updateProjectWithHistory: updateProjectDispatcher,
    openModal,
  });

  const totalDuration = project ? computeTotalDuration(project.tracks) : 10.0;

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    selectedClipId,
    selectedClipType,
    routeScreen: route.screen,
    activeModal,
    clipToDelete,
    setClipToDelete,
    closeModal: handleCancelModal,
    setSelectedClipId,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    totalDuration,
    setZoom,
    handleUndo,
    handleRedo,
    handleSplitClip,
    handleDuplicateClip,
    handleDeleteClip,
  });

  // 60 FPS Playback loop hook
  usePlaybackLoop({
    isPlaying,
    setIsPlaying,
    totalDuration,
    setCurrentTime,
  });

  // Clamp currentTime to 0 and stop playback whenever timeline is empty or duration is 0
  useEffect(() => {
    if (totalDuration <= 0) {
      if (isPlaying) setIsPlaying(false);
      if (currentTime !== 0) setCurrentTime(0);
    }
  }, [totalDuration, isPlaying, currentTime, setIsPlaying, setCurrentTime]);

  // Persist last active editing session (debounced by 1500ms to eliminate synchronous disk I/O while scrubbing)
  useEffect(() => {
    if (!project || route.screen !== "editor" || isPlaying) return;

    const timer = setTimeout(() => {
      const session: LastEditSession = {
        projectId: project.id,
        currentTime,
        zoom,
        selectedClipId,
        updatedAt: Date.now(),
      };
      saveLastSession(session);
    }, 1500);

    return () => clearTimeout(timer);
  }, [project?.id, currentTime, zoom, selectedClipId, route.screen, isPlaying]);

  const handleOpenTransitionsModal = useCallback((clipId: string) => {
    setTransitionTargetClipId(clipId);
    openModal("transitions");
  }, [openModal]);

  // Confirm project exit handler
  const handleConfirmExitProject = useCallback(() => {
    setShowExitConfirmModal(false);
    setIsPlaying(false);
    soundEngine.playSfx("click");
    navigate("/");
  }, [navigate]);

  // Synchronized state refs for Hardware Back Handler
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;

  const handleCancelModalRef = useRef(handleCancelModal);
  handleCancelModalRef.current = handleCancelModal;

  const clipToDeleteRef = useRef(clipToDelete);
  clipToDeleteRef.current = clipToDelete;

  const isCroppingPreviewRef = useRef(isCroppingPreview);
  isCroppingPreviewRef.current = isCroppingPreview;

  const selectedClipIdRef = useRef(selectedClipId);
  selectedClipIdRef.current = selectedClipId;

  const showExitConfirmModalRef = useRef(showExitConfirmModal);
  showExitConfirmModalRef.current = showExitConfirmModal;

  const routeRef = useRef(route);
  routeRef.current = route;

  // Intercept Phone Hardware/Gesture Back Button on Android
  useEffect(() => {
    const handleHardwareBack = () => {
      // 1. If Exit Confirmation Modal is visible, cancel/close it
      if (showExitConfirmModalRef.current) {
        setShowExitConfirmModal(false);
        return true;
      }

      // 2. If Delete Confirmation Modal is visible, cancel delete
      if (clipToDeleteRef.current) {
        setClipToDelete(null);
        return true;
      }

      // 3. If any Editing/Tool Modal is active, dismiss the modal and discard preview changes
      if (activeModalRef.current) {
        handleCancelModalRef.current();
        return true;
      }

      // 4. If Cropping preview is active, close cropping preview
      if (isCroppingPreviewRef.current) {
        setIsCroppingPreview(false);
        return true;
      }

      // 5. If on Editor screen:
      if (routeRef.current.screen === "editor") {
        // If a clip is selected on timeline, deselect it first
        if (selectedClipIdRef.current) {
          setSelectedClipId(null);
          return true;
        }

        // Prompt user to confirm exit to home (preventing OS app exit)
        soundEngine.playSfx("pop");
        setShowExitConfirmModal(true);
        return true;
      }

      // 6. If on Settings or Notifications, move back to Homepage
      if (
        routeRef.current.screen === "settings" ||
        routeRef.current.screen === "notifications"
      ) {
        soundEngine.playSfx("click");
        navigate("/");
        return true;
      }

      // 7. On Home screen: allow normal Android OS back behavior (exit app)
      return false;
    };

    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      handleHardwareBack,
    );
    return () => {
      sub.remove();
    };
  }, [closeModal, navigate]);

  return (
    <View style={styles.rootWrapper}>
      <StatusBar barStyle="light-content" />
      <View style={styles.rootContainer}>
        {/* 1. HOME DASHBOARD SCREEN */}
        {route.screen === "home" && (
          <HomeDashboard
            projects={projects}
            onOpenProject={handleOpenProject}
            onCreateNewProject={handleCreateNewProject}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
            onOpenSettings={() => navigate("/settings")}
            onOpenNotifications={() => navigate("/notifications")}
            unreadNotificationsCount={
              notifications.filter((n) => n.unread).length
            }
            lastSession={lastSession}
          />
        )}

        {/* 2. DEDICATED SETTINGS SCREEN */}
        {route.screen === "settings" && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBack={() => navigate("/")}
            onReloadData={handleReloadAllData}
          />
        )}

        {/* 3. DEDICATED NOTIFICATIONS SCREEN */}
        {route.screen === "notifications" && (
          <NotificationsScreen
            notifications={notifications}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClearAll={handleClearAllNotifications}
            onDeleteNotification={handleDeleteNotification}
            onActionClick={handleNotificationAction}
            onBack={() => navigate("/")}
          />
        )}

        {/* 4. LOADING & NOT FOUND SCREENS */}
        <ProjectStatusScreens
          screen={route.screen}
          project={project}
          projects={projects}
          projectKey={route.projectKey}
          isAppLoading={isAppLoading}
          onGoHome={() => navigate("/")}
          onCreateNewProject={handleCreateNewProject}
          onOpenProject={handleOpenProject}
        />

        {/* 5. FULL VIDEO EDITOR SUITE */}
        {(() => {
          const renderSharedModals = (isInline?: boolean) => (
            <EditorModals
              activeModal={activeModal}
              closeModal={handleCancelModal}
              onCancelModal={handleCancelModal}
              onApplyModal={handleApplyModal}
              project={project}
              route={route}
              totalDuration={totalDuration}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              selectedClipId={selectedClipId}
              selectedClip={selectedClip}
              selectedClipType={selectedClipType}
              settings={settings}
              notifications={notifications}
              transitionTargetClipId={transitionTargetClipId}
              clipToDelete={clipToDelete}
              setClipToDelete={setClipToDelete}
              handleAddMedia={handleAddMedia}
              handleApplyCutout={handleApplyCutout}
              cutoutInitialMode={cutoutInitialMode}
              transformInitialTab={transformInitialTab}
              setIsCroppingPreview={setIsCroppingPreview}
              onOpenScreenCrop={() => {
                soundEngine.playSfx("click");
                closeModal();
                setIsCroppingPreview(true);
              }}
              handleApplyMotionTracking={handleApplyMotionTracking}
              handleAddText={handleAddText}
              handleUpdateText={handleUpdateText}
              handleAddAudio={handleAddAudio}
              handleApplyFilter={handleApplyFilter}
              handleAddEffect={handleAddEffect}
              handleUpdateEffect={handleUpdateEffect}
              handleAddSticker={handleAddSticker}
              handleUpdateSticker={handleUpdateSticker}
              handleApplyTransition={handleApplyTransition}
              handleApplySpeed={handleApplySpeed}
              handleUpdateSettings={handleUpdateSettings}
              handleReloadAllData={handleReloadAllData}
              handleMarkAllAsRead={handleMarkAllAsRead}
              handleClearAllNotifications={handleClearAllNotifications}
              handleDeleteNotification={handleDeleteNotification}
              handleNotificationAction={handleNotificationAction}
              handleApplyVolume={handleApplyVolume}
              handleExtractAudioFromVideo={handleExtractAudioFromVideo}
              handleApplyTransform={handleApplyTransform}
              handleAutoCutGenerated={handleAutoCutGenerated}
              updateProjectWithHistory={updateProjectDispatcher}
              handleApplyEnhance={handleApplyEnhance}
              handleApplyBlendMode={handleApplyBlendMode}
              handleApplyHSL={handleApplyHSL}
              handleApplyVoiceEffect={handleApplyVoiceEffect}
              handleAddKeyframe={handleAddKeyframe}
              isKeyframeAtPlayhead={isKeyframeAtPlayhead}
              handleUpdateKeyframeTransform={handleUpdateKeyframeTransform}
              handleDeleteKeyframeAtTime={handleDeleteKeyframeAtTime}
              handleClearAllKeyframes={handleClearAllKeyframes}
              handleConfirmDeleteClip={handleConfirmDeleteClip}
              handleDeleteClip={handleDeleteClip}
              handleAddCaptions={handleAddCaptions}
              handleUpdateCaption={handleUpdateCaption}
              handleMoveClip={handleMoveClip}
              isInline={isInline}
            />
          );

          return (
            <>
              {(route.screen === "editor" || route.screen === "export") && project && (
                <EditorWorkspace
                  project={project}
                  currentTime={currentTime}
                  setCurrentTime={setCurrentTime}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  totalDuration={totalDuration}
                  isFullscreen={isFullscreen}
                  setIsFullscreen={setIsFullscreen}
                  selectedClipId={selectedClipId}
                  setSelectedClipId={setSelectedClipId}
                  selectedClipType={selectedClipType}
                  setSelectedClipType={setSelectedClipType}
                  selectedClip={selectedClip}
                  zoom={zoom}
                  setZoom={setZoom}
                  settings={settings}
                  isCroppingPreview={isCroppingPreview}
                  setIsCroppingPreview={setIsCroppingPreview}
                  canUndo={historyStack.length > 0}
                  canRedo={redoStack.length > 0}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onOpenExport={() => openModal("export")}
                  onBackToHome={() => {
                    soundEngine.playSfx("pop");
                    setShowExitConfirmModal(true);
                  }}
                  onAddKeyframe={handleAddKeyframe}
                  onOpenKeyframeModal={() => {
                    if (!selectedClipId && project) {
                      const videoAtTime =
                        project.tracks.video?.find(
                          (c) =>
                            currentTime >= c.startTime &&
                            currentTime <= c.startTime + c.duration,
                        ) || project.tracks.video?.[0];
                      if (videoAtTime) {
                        setSelectedClipId(videoAtTime.id);
                        setSelectedClipType("video");
                      }
                    }
                    openModal("keyframe");
                  }}
                  isKeyframeAtPlayhead={isKeyframeAtPlayhead}
                  activeModal={activeModal}
                  openModal={openModal}
                  closeModal={closeModal}
                  onCloseModal={handleCancelModal}
                  updateProjectWithHistory={updateProjectDispatcher}
                  handleUpdateClipTransform={handleUpdateClipTransform}
                  handleUpdateClipCrop={handleUpdateClipCrop}
                  handleUpdateClipMask={handleUpdateClipMask}
                  handleSplitClip={handleSplitClip}
                  handleFreezeFrame={handleFreezeFrame}
                  handleDuplicateClip={handleDuplicateClip}
                  handleDeleteClip={handleDeleteClip}
                  handleMoveClip={handleMoveClip}
                  handleTrimClip={handleTrimClip}
                  handleRotateClip={handleRotateClip}
                  handleToggleReverse={handleToggleReverse}
                  handleOpenTransitionsModal={handleOpenTransitionsModal}
                  handleDeselectClip={() => setSelectedClipId(null)}
                  handleOpenSpeedModal={() => {
                    ensureSelectedVideoClip();
                    openModal("speed");
                  }}
                  handleOpenVolumeModal={() => {
                    const clip = ensureSelectedVideoClip();
                    if (clip && selectedClipType === "video" && !mediaHasAudioTrack(clip)) {
                      return;
                    }
                    openModal("volume");
                  }}
                  handleOpenCropModal={() => {
                    soundEngine.playSfx("click");
                    setIsCroppingPreview(true);
                  }}
                  handleOpenTransformModal={(tab?: 'crop' | 'flip' | 'rotate' | 'stretch' | 'angle') => {
                    ensureSelectedVideoClip();
                    setTransformInitialTab(tab || 'crop');
                    openModal("transform");
                  }}
                  handleOpenMaskModal={() => {
                    ensureSelectedVideoClip();
                    openModal("mask");
                  }}
                  handleOpenAudioModal={() => openModal("audio")}
                  handleOpenTextModal={() => openModal("text")}
                  handleOpenFiltersModal={() => {
                    openModal("filters");
                  }}
                  handleOpenEffectsModal={() => {
                    openModal("effects");
                  }}
                  handleOpenStickersModal={() => openModal("stickers")}
                  handleOpenMediaPicker={() => openModal("media")}
                  handleOpenTTS={() => openModal("tts")}
                  handleOpenEnhance={() => {
                    ensureSelectedVideoClip();
                    openModal("enhance");
                  }}
                  handleOpenAutoCut={() => openModal("autocut")}
                  handleOpenCanvasModal={() => openModal("canvas")}
                  handleOpenBackgroundModal={() => openModal("background")}
                  handleOpenCutoutModal={(mode?: 'auto' | 'chroma') => {
                    ensureSelectedVideoClip();
                    setCutoutInitialMode(mode);
                    openModal("cutout");
                  }}
                  handleOpenMotionTracking={() => {
                    ensureSelectedVideoClip();
                    openModal("tracking");
                  }}
                  handleOpenAutoCaptions={() => openModal("captions")}
                  handleToggleDenoise={handleToggleDenoise}
                  handleExtractAudio={handleExtractAudioFromVideo}
                  isProcessing={isProcessing}
                  processingMessage={processingMessage}
                  renderModals={renderSharedModals}
                  handleAddMedia={handleAddMedia}
                  handleAddAudio={handleAddAudio}
                />
              )}

              {/* OVERLAY / FULLSCREEN MODALS (media picker, audio picker, export, settings, notifications, delete confirm) */}
              {renderSharedModals(false)}
            </>
          );
        })()}

        {/* Confirmation Modal to Exit Project to Home */}
        <ConfirmExitModal
          visible={showExitConfirmModal}
          project={project}
          totalDuration={totalDuration}
          onConfirmExit={handleConfirmExitProject}
          onCancel={() => setShowExitConfirmModal(false)}
        />
      </View>

      {/* Branded In-App FastArt SplashScreen Overlay */}
      {splashVisible && (
        <SplashScreen
          isReady={!isAppLoading}
          statusText={splashStatus}
          onFinished={() => setSplashVisible(false)}
        />
      )}
    </View>
  );
}

const STATUS_BAR_HEIGHT =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0;

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: "#09090B",
    paddingTop: STATUS_BAR_HEIGHT,
  },
  rootContainer: {
    flex: 1,
    backgroundColor: "#09090B",
    overflow: "hidden" as any,
  },
});
