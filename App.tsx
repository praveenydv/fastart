import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { StyleSheet, View, StatusBar, Platform } from "react-native";
import HomeDashboard from "./src/components/HomeDashboard";
import SettingsScreen from "./src/components/SettingsScreen";
import NotificationsScreen from "./src/components/NotificationsScreen";
import SplashScreen from "./src/components/SplashScreen";
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
import { computeTotalDuration } from "./src/types/project";
import { soundEngine } from "./src/utils/audioEngine";
import { saveLastSession, LastEditSession } from "./src/utils/storage";

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

  // Modal helpers synced with URL
  const openModal = useCallback((modalName: string) => {
    setActiveModal(modalName);
    if (route.screen === "editor" && projectRef.current) {
      navigate(`/project/${projectRef.current.id}?tool=${modalName}`, { replace: true });
    }
  }, [route.screen, navigate]);

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
    updateProjectWithHistory,
    handleUndo,
    handleRedo,
  } = useProjectHistory({
    projectRef,
    setProject,
    setProjects,
  });

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
    updateProjectWithHistory,
    setActiveModal,
    setSelectedClipId,
    setSelectedClipType,
  });

  // Clip mutations hook
  const {
    handleSplitClip,
    handleDeleteClip,
    handleConfirmDeleteClip,
    handleDuplicateClip,
    handleRotateClip,
    handleToggleReverse,
    handleUpdateClipTransform,
    handleUpdateClipCrop,
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
    updateProjectWithHistory,
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
    updateProjectWithHistory,
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
    closeModal,
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

  // Persist last active editing session
  useEffect(() => {
    if (project && route.screen === "editor" && !isPlaying) {
      const session: LastEditSession = {
        projectId: project.id,
        currentTime,
        zoom,
        selectedClipId,
        updatedAt: Date.now(),
      };
      saveLastSession(session);
      setLastSession(session);
    }
  }, [project?.id, currentTime, zoom, selectedClipId, route.screen, isPlaying, setLastSession]);

  const handleOpenTransitionsModal = useCallback((clipId: string) => {
    setTransitionTargetClipId(clipId);
    openModal("transitions");
  }, [openModal]);

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
              soundEngine.playSfx("click");
              setIsPlaying(false);
              navigate("/");
            }}
            onAddKeyframe={handleAddKeyframe}
            onOpenKeyframeModal={() => openModal("keyframe")}
            isKeyframeAtPlayhead={isKeyframeAtPlayhead}
            openModal={openModal}
            updateProjectWithHistory={updateProjectWithHistory}
            handleUpdateClipTransform={handleUpdateClipTransform}
            handleUpdateClipCrop={handleUpdateClipCrop}
            handleSplitClip={handleSplitClip}
            handleDuplicateClip={handleDuplicateClip}
            handleDeleteClip={handleDeleteClip}
            handleMoveClip={handleMoveClip}
            handleTrimClip={handleTrimClip}
            handleRotateClip={handleRotateClip}
            handleToggleReverse={handleToggleReverse}
            handleOpenTransitionsModal={handleOpenTransitionsModal}
            handleDeselectClip={() => setSelectedClipId(null)}
            handleOpenSpeedModal={() => openModal("speed")}
            handleOpenVolumeModal={() => openModal("volume")}
            handleOpenCropModal={() => {
              soundEngine.playSfx("click");
              setIsCroppingPreview(true);
            }}
            handleOpenMaskModal={() => openModal("mask")}
            handleOpenAudioModal={() => openModal("audio")}
            handleOpenTextModal={() => openModal("text")}
            handleOpenFiltersModal={() => openModal("filters")}
            handleOpenEffectsModal={() => openModal("effects")}
            handleOpenStickersModal={() => openModal("stickers")}
            handleOpenMediaPicker={() => openModal("media")}
            handleOpenTTS={() => openModal("tts")}
            handleOpenEnhance={() => openModal("enhance")}
            handleOpenAutoCut={() => openModal("autocut")}
            handleOpenCanvasModal={() => openModal("canvas")}
            handleOpenCutoutModal={() => openModal("cutout")}
            handleOpenMotionTracking={() => openModal("tracking")}
            handleOpenAutoCaptions={() => openModal("captions")}
            handleToggleDenoise={handleToggleDenoise}
            handleExtractAudio={handleExtractAudioFromVideo}
            isProcessing={isProcessing}
            processingMessage={processingMessage}
          />
        )}

        {/* LAZY LOADED MODALS */}
        <EditorModals
          activeModal={activeModal}
          closeModal={closeModal}
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
          updateProjectWithHistory={updateProjectWithHistory}
          handleApplyEnhance={handleApplyEnhance}
          handleAddKeyframe={handleAddKeyframe}
          isKeyframeAtPlayhead={isKeyframeAtPlayhead}
          handleUpdateKeyframeTransform={handleUpdateKeyframeTransform}
          handleDeleteKeyframeAtTime={handleDeleteKeyframeAtTime}
          handleClearAllKeyframes={handleClearAllKeyframes}
          handleConfirmDeleteClip={handleConfirmDeleteClip}
          handleAddCaptions={handleAddCaptions}
          handleUpdateCaption={handleUpdateCaption}
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
    backgroundColor: "#0B0D13",
    paddingTop: STATUS_BAR_HEIGHT,
  },
  rootContainer: {
    flex: 1,
    backgroundColor: "#0B0D13",
    overflow: "hidden" as any,
  },
});
