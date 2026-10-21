import { useState, useEffect, useCallback } from "react";
import * as ExpoSplashScreen from "expo-splash-screen";
import { soundEngine } from "../utils/audioEngine";
import { deleteMedia } from "../utils/largeMediaStorage";
import {
  FastArtProject,
  createDefaultProject,
} from "../types/project";
import {
  loadAllProjects,
  saveProject,
  deleteProject,
  loadSettings,
  saveSettings,
  loadNotifications,
  saveNotifications,
  addNotification,
  loadLastSession,
  saveLastSession,
  LastEditSession,
  AppSettings,
  AppNotification,
  initNativeStorageAsync,
} from "../utils/storage";

interface UseAppBootstrapParams {
  route: any;
  navigate: (path: string, options?: any) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedClipId: (id: string | null) => void;
  setActiveModal: (modal: string | null) => void;
  setIsFullscreen: (full: boolean) => void;
  closeModal: () => void;
}

export function useAppBootstrap({
  route,
  navigate,
  setCurrentTime,
  setIsPlaying,
  setSelectedClipId,
  setActiveModal,
  setIsFullscreen,
  closeModal,
}: UseAppBootstrapParams) {
  const [projects, setProjects] = useState<FastArtProject[]>(() =>
    loadAllProjects(),
  );
  const [project, setProject] = useState<FastArtProject | null>(null);
  const [lastSession, setLastSession] = useState<LastEditSession | null>(() =>
    loadLastSession(),
  );
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    loadNotifications(),
  );

  const [isAppLoading, setIsAppLoading] = useState(true);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashStatus, setSplashStatus] = useState("Initializing FastArt Studio...");

  // Load and hydrate projects, settings & notifications on startup
  useEffect(() => {
    let isMounted = true;
    if (settings) {
      soundEngine.setEnabled(settings.soundEffects === true);
    }

    setSplashStatus("Connecting local workspace...");
    initNativeStorageAsync()
      .then(() => {
        if (!isMounted) return;
        setSplashStatus("Loading projects & settings...");
        const projs = loadAllProjects();
        const currentSettings = loadSettings();
        const currentNotifs = loadNotifications();
        const session = loadLastSession();
        setProjects(projs);
        setSettings(currentSettings);
        setNotifications(currentNotifs);
        setLastSession(session);
        soundEngine.setEnabled(currentSettings.soundEffects === true);

        if (route.screen === "editor" && route.projectKey) {
          const key = route.projectKey;
          let matched = projs.find((p) => p.id === key);
          if (!matched) {
            const num = parseInt(key, 10);
            if (!isNaN(num) && num > 0 && num <= projs.length) {
              matched = projs[num - 1];
            }
          }
          if (!matched) {
            matched = projs.find(
              (p) =>
                p.id.toLowerCase() === key.toLowerCase() ||
                p.title.toLowerCase() === key.toLowerCase() ||
                p.title.toLowerCase().replace(/\s+/g, "-") === key.toLowerCase()
            );
          }
          if (matched) {
            setProject(matched);
            const resumeTime =
              session &&
              session.projectId === matched.id &&
              typeof session.currentTime === "number"
                ? session.currentTime
                : matched.currentTime || 0;
            setCurrentTime(resumeTime);
            setSelectedClipId(
              session && session.projectId === matched.id
                ? session.selectedClipId || null
                : null
            );
          }
        }

        setSplashStatus("Ready");
        setTimeout(() => {
          if (isMounted) {
            setIsAppLoading(false);
            ExpoSplashScreen.hideAsync().catch(() => {});
          }
        }, 300);
      })
      .catch((err) => {
        console.warn("Storage hydration error:", err);
        if (isMounted) {
          setIsAppLoading(false);
          ExpoSplashScreen.hideAsync().catch(() => {});
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Project management handlers
  const handleOpenProject = useCallback((id: string) => {
    const target = projects.find((p) => p.id === id);
    if (target) {
      setProject(target);
      const session = loadLastSession();
      const resumeTime =
        session &&
        session.projectId === target.id &&
        typeof session.currentTime === "number"
          ? session.currentTime
          : target.currentTime || 0;
      setCurrentTime(resumeTime);
      setSelectedClipId(null);
    }
    navigate(`/project/${id}`);
  }, [projects, navigate, setCurrentTime, setSelectedClipId]);

  const handleCreateNewProject = useCallback(() => {
    const newProj = createDefaultProject(`Project ${projects.length + 1}`);
    newProj.aspectRatio = settings?.defaultAspectRatio || "9:16";
    newProj.resolution = settings?.defaultResolution || "1080p";
    newProj.fps = settings?.defaultFps || 30;

    saveProject(newProj);
    setProjects((prev) => [newProj, ...prev]);
    setProject(newProj);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedClipId(null);
    navigate(`/project/${newProj.id}`);

    addNotification({
      title: "Project Created",
      message: `"${newProj.title}" is ready for editing.`,
      projectId: newProj.id,
      projectTitle: newProj.title,
      actionText: "Open in Editor",
      icon: "film-outline",
    });
  }, [projects.length, settings, navigate, setCurrentTime, setIsPlaying, setSelectedClipId]);

  const handleDuplicateProject = useCallback((id: string) => {
    const found = projects.find((p) => p.id === id);
    if (found) {
      const clone = {
        ...JSON.parse(JSON.stringify(found)),
        id: "proj-" + Date.now(),
        title: `${found.title} (Copy)`,
        updatedAt: Date.now(),
      };
      saveProject(clone);
      setProjects((prev) => [clone, ...prev]);

      addNotification({
        title: "Project Duplicated",
        message: `Created duplicate "${clone.title}".`,
        projectId: clone.id,
        projectTitle: clone.title,
        actionText: "Open Project",
        icon: "copy-outline",
      });
    }
  }, [projects]);

  const handleDeleteProject = useCallback((id: string) => {
    const target = projects.find((p) => p.id === id);
    const updated = deleteProject(id);
    setProjects(updated);
    if (project?.id === id) {
      setProject(null);
    }
    navigate("/", { replace: true });

    if (target && target.tracks) {
      const clipIds = [
        ...(target.tracks.video || []).map((v: any) => v.id),
        ...(target.tracks.audio || []).map((a: any) => a.id),
      ];
      clipIds.forEach((cid) => deleteMedia(cid).catch(() => {}));
    }

    addNotification({
      title: "Project Deleted",
      message: `"${target?.title || "Project"}" was removed.`,
      icon: "trash-outline",
    });
  }, [projects, project?.id, navigate]);

  const handleRenameProject = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const updated = projects.map((p) =>
      p.id === id ? { ...p, title: trimmed } : p,
    );
    setProjects(updated);
    const targetProj = updated.find((p) => p.id === id);
    if (targetProj) saveProject(targetProj);
    if (project?.id === id) {
      setProject((prev: any) => (prev ? { ...prev, title: trimmed } : null));
    }
  }, [projects, project?.id]);

  const handleUpdateSettings = useCallback((newSettings: any) => {
    const updated = saveSettings(newSettings);
    setSettings(updated);
    soundEngine.setEnabled(updated.soundEffects === true);
  }, []);

  const handleReloadAllData = useCallback(() => {
    const projs = loadAllProjects();
    const currentSettings = loadSettings();
    const currentNotifs = loadNotifications();
    const currentSession = loadLastSession();
    setProjects(projs);
    setSettings(currentSettings);
    setNotifications(currentNotifs);
    setLastSession(currentSession);
    soundEngine.setEnabled(currentSettings.soundEffects === true);
    setProject(projs.length > 0 ? projs[0] : null);
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    const updated = notifications.map((n) => ({ ...n, unread: false }));
    setNotifications(updated);
    saveNotifications(updated);
  }, [notifications]);

  const handleClearAllNotifications = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  const handleDeleteNotification = useCallback((id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveNotifications(updated);
  }, [notifications]);

  const handleNotificationAction = useCallback((notification: AppNotification) => {
    const updated = notifications.map((n) =>
      n.id === notification.id ? { ...n, unread: false } : n,
    );
    setNotifications(updated);
    saveNotifications(updated);

    if (notification.projectId) {
      const target = projects.find((p) => p.id === notification.projectId);
      if (target) {
        setProject(target);
        setCurrentTime(0);
        setIsPlaying(false);
        setSelectedClipId(null);
        navigate(`/project/${target.id}`);
        return;
      }
    }

    if (projects.length > 0) {
      const target = project || projects[0];
      setProject(target);
      navigate(`/project/${target.id}`);
    } else {
      handleCreateNewProject();
    }
  }, [notifications, projects, project, navigate, setCurrentTime, setIsPlaying, setSelectedClipId, handleCreateNewProject]);

  const handleAutoCutGenerated = useCallback((newProj: FastArtProject) => {
    saveProject(newProj);
    setProjects((prev: any) => [newProj, ...prev]);
    setProject(newProj);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedClipId(null);
    closeModal();
    navigate(`/project/${newProj.id}`);
  }, [navigate, setCurrentTime, setIsPlaying, setSelectedClipId, closeModal]);

  // Sync route and project selection
  useEffect(() => {
    if (projects.length === 0) return;

    if (route.screen === "editor") {
      const key = route.projectKey;
      if (!key) {
        navigate(`/project/${projects[0].id}`, { replace: true });
        return;
      }
      if (key === "new") {
        handleCreateNewProject();
        return;
      }

      let matched = projects.find((p) => p.id === key);
      if (!matched) {
        const num = parseInt(key, 10);
        if (!isNaN(num) && num > 0 && num <= projects.length) {
          matched = projects[num - 1];
        }
      }
      if (!matched) {
        matched = projects.find(
          (p) =>
            p.id.toLowerCase() === key.toLowerCase() ||
            p.title.toLowerCase() === key.toLowerCase() ||
            p.title.toLowerCase().replace(/\s+/g, "-") === key.toLowerCase(),
        );
      }

      if (matched) {
        if (!project || project.id !== matched.id) {
          setProject(matched);
          const session = loadLastSession();
          const resumeTime =
            session &&
            session.projectId === matched.id &&
            typeof session.currentTime === "number"
              ? session.currentTime
              : matched.currentTime || 0;
          setCurrentTime(resumeTime);
          setIsPlaying(false);
          setSelectedClipId(
            session && session.projectId === matched.id
              ? session.selectedClipId || null
              : null,
          );
        }
      } else {
        setProject(null);
      }

      if (route.tool) {
        setActiveModal(route.tool);
      }
    } else {
      setIsPlaying(false);
      setIsFullscreen(false);
    }
  }, [route.screen, route.projectKey, route.tool, projects]);

  return {
    projects,
    setProjects,
    project,
    setProject,
    lastSession,
    setLastSession,
    settings,
    setSettings,
    notifications,
    setNotifications,
    isAppLoading,
    setIsAppLoading,
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
  };
}
