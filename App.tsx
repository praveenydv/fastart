import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import Header from "./src/components/Header";
import Player from "./src/components/Player";
import Timeline from "./src/components/Timeline";
import Toolbar from "./src/components/Toolbar";
import HomeDashboard from "./src/components/HomeDashboard";
import SettingsScreen from "./src/components/SettingsScreen";
import NotificationsScreen from "./src/components/NotificationsScreen";
import ProjectNotFoundScreen from "./src/components/ProjectNotFoundScreen";
import SplashScreen from "./src/components/SplashScreen";
import * as ExpoSplashScreen from "expo-splash-screen";
import { useAppRouter } from "./src/utils/router";

// Keep native splash screen visible while app hydrates
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

// Modals / Panels
import MediaPickerModal from "./src/components/Panels/MediaPickerModal";
import TextModal from "./src/components/Panels/TextModal";
import AudioModal from "./src/components/Panels/AudioModal";
import FiltersModal from "./src/components/Panels/FiltersModal";
import EffectsModal from "./src/components/Panels/EffectsModal";
import StickersModal from "./src/components/Panels/StickersModal";
import TransitionsModal from "./src/components/Panels/TransitionsModal";
import SpeedModal from "./src/components/Panels/SpeedModal";
import ExportModal from "./src/components/Panels/ExportModal";
import SettingsModal from "./src/components/Panels/SettingsModal";
import NotificationsModal from "./src/components/Panels/NotificationsModal";
import VolumeModal from "./src/components/Panels/VolumeModal";
import CropTransformModal from "./src/components/Panels/CropTransformModal";
import AutoCutModal from "./src/components/Panels/AutoCutModal";
import CanvasModal from "./src/components/Panels/CanvasModal";
import AIEnhanceModal from "./src/components/Panels/AIEnhanceModal";
import TextToSpeechModal from "./src/components/Panels/TextToSpeechModal";
import CutoutModal from "./src/components/Panels/CutoutModal";
import MotionTrackingModal from "./src/components/Panels/MotionTrackingModal";
import ConfirmDeleteModal from "./src/components/ConfirmDeleteModal";
import KeyframeModal from "./src/components/Panels/KeyframeModal";

import {
  FastArtProject,
  VideoClip,
  AudioClip,
  TextClip,
  StickerClip,
  EffectClip,
  ClipTransform,
  AspectRatio,
  MaskConfig,
  CustomCrop,
  CutoutConfig,
  MotionTrackConfig,
  CustomLutConfig,
  createDefaultProject,
  computeTotalDuration,
} from "./src/types/project";
import {
  loadAllProjects,
  saveProject,
  deleteProject,
  loadSettings,
  saveSettings,
  loadNotifications,
  saveNotifications,
  addNotification,
  deleteNotification,
  loadLastSession,
  saveLastSession,
  LastEditSession,
  AppSettings,
  AppNotification,
  initNativeStorageAsync,
} from "./src/utils/storage";
import { soundEngine } from "./src/utils/audioEngine";
import { triggerHaptic } from "./src/utils/haptics";
import { getLiveMediaUrl, deleteMedia } from "./src/utils/largeMediaStorage";
import {
  clampClipTrimUpdates,
  getMediaDuration,
} from "./src/utils/mediaDuration";

export default function App() {
  const { route, navigate, goBack } = useAppRouter();
  const screen = route.screen;
  const setScreen = (s: string) => {
    if (s === "home") navigate("/");
    else if (s === "editor" && project) navigate(`/project/${project.id}`);
    else navigate(`/${s}`);
  };
  const [projects, setProjects] = useState<FastArtProject[]>(() =>
    loadAllProjects(),
  );
  const [project, setProject] = useState<FastArtProject | null>(null);
  const projectRef = useRef<FastArtProject | null>(project);
  projectRef.current = project;
  const [lastSession, setLastSession] = useState<LastEditSession | null>(() =>
    loadLastSession(),
  );
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    loadNotifications(),
  );

  // Branded In-App Splash & Hydration State
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashStatus, setSplashStatus] = useState("Initializing FastArt Studio...");

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
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

  // History state (Undo / Redo)
  const [historyStack, setHistoryStack] = useState<FastArtProject[]>([]);
  const [redoStack, setRedoStack] = useState<FastArtProject[]>([]);

  // Fullscreen Cinema mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Active modal sheets
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [transitionTargetClipId, setTransitionTargetClipId] = useState<
    string | null
  >(null);
  const [isCroppingPreview, setIsCroppingPreview] = useState(false);

  const animFrameRef = useRef<any>(null);
  const lastTimeRef = useRef<any>(null);

  // ESC key listener to exit fullscreen mode on web
  useEffect(() => {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isFullscreen) {
          setIsFullscreen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        if (typeof window.removeEventListener === "function") {
          window.removeEventListener("keydown", handleKeyDown);
        }
      };
    }
  }, [isFullscreen]);

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

        // Pre-resolve project if direct URL has /project/:key
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

    // Live notification synchronization
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleSyncNotifs = () => {
        setNotifications(loadNotifications());
      };
      window.addEventListener("fastart:notification_added", handleSyncNotifs);
      window.addEventListener(
        "fastart:notifications_changed",
        handleSyncNotifs,
      );
      return () => {
        isMounted = false;
        window.removeEventListener(
          "fastart:notification_added",
          handleSyncNotifs,
        );
        window.removeEventListener(
          "fastart:notifications_changed",
          handleSyncNotifs,
        );
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Mobile web gesture smoothing & touch-action performance optimization
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.style.backgroundColor = "#0B0D13";
      document.body.style.backgroundColor = "#0B0D13";
      const styleEl = document.createElement("style");
      styleEl.innerHTML = `
        html, body, #root {
          background-color: #0B0D13 !important;
          overscroll-behavior: none !important;
          overscroll-behavior-y: none !important;
          touch-action: manipulation;
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `;
      document.head.appendChild(styleEl);

      const unlockAudio = () => {
        try {
          soundEngine.getAudioContext()?.resume();
        } catch (e) {}
        window.removeEventListener("touchstart", unlockAudio);
        window.removeEventListener("pointerdown", unlockAudio);
      };
      window.addEventListener("touchstart", unlockAudio, { passive: true });
      window.addEventListener("pointerdown", unlockAudio, { passive: true });

      return () => {
        try {
          document.head.removeChild(styleEl);
        } catch (e) {}
        window.removeEventListener("touchstart", unlockAudio);
        window.removeEventListener("pointerdown", unlockAudio);
      };
    }
  }, []);

  // Sync route and project / modal selection
  useEffect(() => {
    if (projects.length === 0) return;

    if (route.screen === "editor") {
      const key = route.projectKey;
      if (!key) {
        // e.g. /project without key -> default to first project URL
        navigate(`/project/${projects[0].id}`, { replace: true });
        return;
      }

      if (key === "new") {
        handleCreateNewProject();
        return;
      }

      // 1. Exact ID match
      let matched = projects.find((p) => p.id === key);

      // 2. 1-based index match (e.g. key === '1' -> projects[0], key === '2' -> projects[1])
      if (!matched) {
        const num = parseInt(key, 10);
        if (!isNaN(num) && num > 0 && num <= projects.length) {
          matched = projects[num - 1];
        }
      }

      // 3. Title or slug match
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
      if (isPlaying) {
        setIsPlaying(false);
      }
      setIsFullscreen(false);
    }
  }, [route.screen, route.projectKey, route.tool, projects]);

  // Persist last active editing session (playhead, zoom, selection)
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
  }, [project?.id, currentTime, zoom, selectedClipId, route.screen, isPlaying]);

  // Modal helpers synced with URL
  const openModal = (modalName: string) => {
    setActiveModal(modalName);
    if (route.screen === "editor" && project) {
      navigate(`/project/${project.id}?tool=${modalName}`, { replace: true });
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    if (route.screen === "editor" && project) {
      navigate(`/project/${project.id}`, { replace: true });
    }
  };

  // Memoized modal opener callbacks to keep Toolbar & Header props reference-stable
  const handleOpenSpeedModal = useCallback(
    () => openModal("speed"),
    [route.screen, project?.id],
  );
  const handleOpenVolumeModal = useCallback(
    () => openModal("volume"),
    [route.screen, project?.id],
  );
  const handleOpenMaskModal = useCallback(
    () => openModal("mask"),
    [route.screen, project?.id],
  );
  const handleOpenAudioModal = useCallback(
    () => openModal("audio"),
    [route.screen, project?.id],
  );
  const handleOpenTextModal = useCallback(
    () => openModal("text"),
    [route.screen, project?.id],
  );
  const handleOpenFiltersModal = useCallback(
    () => openModal("filters"),
    [route.screen, project?.id],
  );
  const handleOpenEffectsModal = useCallback(
    () => openModal("effects"),
    [route.screen, project?.id],
  );
  const handleOpenStickersModal = useCallback(
    () => openModal("stickers"),
    [route.screen, project?.id],
  );
  const handleOpenMediaPicker = useCallback(
    () => openModal("media"),
    [route.screen, project?.id],
  );
  const handleOpenTTS = useCallback(
    () => openModal("tts"),
    [route.screen, project?.id],
  );
  const handleOpenEnhance = useCallback(
    () => openModal("enhance"),
    [route.screen, project?.id],
  );
  const handleOpenAutoCut = useCallback(
    () => openModal("autocut"),
    [route.screen, project?.id],
  );
  const handleOpenCanvasModal = useCallback(
    () => openModal("canvas"),
    [route.screen, project?.id],
  );
  const handleOpenKeyframeModal = useCallback(
    () => openModal("keyframe"),
    [route.screen, project?.id],
  );
  const handleOpenCutoutModal = useCallback(
    () => openModal("cutout"),
    [route.screen, project?.id],
  );
  const handleOpenMotionTracking = useCallback(
    () => openModal("tracking"),
    [route.screen, project?.id],
  );
  const handleOpenExport = useCallback(
    () => openModal("export"),
    [route.screen, project?.id],
  );
  const handleDeselectClip = useCallback(() => setSelectedClipId(null), []);
  const handleBackToHome = useCallback(() => {
    soundEngine.playSfx("click");
    setIsPlaying(false);
    navigate("/");
  }, []);

  // Compute total duration
  const totalDuration = project ? computeTotalDuration(project.tracks) : 10.0;

  // 60 FPS Playback loop
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const currentTimeStamp =
          typeof now === "number" ? now : performance.now();
        const delta = Math.min(
          0.1,
          Math.max(
            0.001,
            (currentTimeStamp - (lastTimeRef.current || currentTimeStamp)) /
              1000,
          ),
        );
        lastTimeRef.current = currentTimeStamp;

        const effectiveTotal = Math.max(totalDuration, 1.0);
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= effectiveTotal) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });

        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, totalDuration]);

  // Restore any large media object URLs stored in IndexedDB across reloads
  useEffect(() => {
    if (Platform.OS === "web" && project) {
      let changed = false;
      const checkAndRestore = async () => {
        const vClips = [...(project.tracks.video || [])];
        for (let i = 0; i < vClips.length; i++) {
          const c = vClips[i];
          if (c.id && (!c.url || c.url.startsWith("blob:"))) {
            const liveUrl = await getLiveMediaUrl(c.id);
            if (liveUrl && liveUrl !== c.url) {
              vClips[i] = { ...c, url: liveUrl };
              changed = true;
            }
          }
        }
        const aClips = [...(project.tracks.audio || [])];
        for (let i = 0; i < aClips.length; i++) {
          const c = aClips[i];
          if (c.id && (!c.url || c.url.startsWith("blob:"))) {
            const liveUrl = await getLiveMediaUrl(c.id);
            if (liveUrl && liveUrl !== c.url) {
              aClips[i] = { ...c, url: liveUrl };
              changed = true;
            }
          }
        }
        if (changed) {
          setProject((prev) =>
            prev
              ? {
                  ...prev,
                  tracks: { ...prev.tracks, video: vClips, audio: aClips },
                }
              : prev,
          );
        }
      };
      checkAndRestore();
    }
  }, [project?.id]);

  // Push state to undo stack with memory cap (max 20 snapshots)
  const updateProjectWithHistory = useCallback((updatedProject: any) => {
    const current = projectRef.current;
    if (!current) return;
    const fullProject: FastArtProject = {
      ...current,
      ...(updatedProject || {}),
      tracks: updatedProject?.tracks ? updatedProject.tracks : current.tracks,
    };
    setHistoryStack((prev) => [
      ...prev.slice(-20),
      JSON.parse(JSON.stringify(current)),
    ]);
    setRedoStack([]);
    const saved = saveProject(fullProject);
    projectRef.current = saved;
    setProject(saved);
    setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
  }, []);

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const current = projectRef.current;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    if (current) {
      setRedoStack((r) => [...r.slice(-20), JSON.parse(JSON.stringify(current))]);
    }
    const saved = saveProject(prev);
    projectRef.current = saved;
    setProject(saved);
    setProjects((all) => all.map((p) => (p.id === saved.id ? saved : p)));
    soundEngine.playSfx("click");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const current = projectRef.current;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    if (current) {
      setHistoryStack((s) => [
        ...s.slice(-20),
        JSON.parse(JSON.stringify(current)),
      ]);
    }
    const saved = saveProject(next);
    projectRef.current = saved;
    setProject(saved);
    setProjects((all) => all.map((p) => (p.id === saved.id ? saved : p)));
    soundEngine.playSfx("click");
  };

  // Find currently selected clip object
  const getSelectedClip = () => {
    if (!selectedClipId || !project) return null;
    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "effect" || selectedClipType === "effects"
          ? "effects"
          : selectedClipType
    ) as keyof typeof project.tracks;

    const list = (project.tracks[key] as any[]) || [];
    const found = list.find((c: any) => c.id === selectedClipId);
    if (found) return found;

    // Fallback search across all tracks in case type mismatch
    for (const trackKey of Object.keys(
      project.tracks,
    ) as (keyof typeof project.tracks)[]) {
      const match = (project.tracks[trackKey] as any[])?.find(
        (c: any) => c.id === selectedClipId,
      );
      if (match) return match;
    }
    return null;
  };

  // Stable ref for currentTime to prevent Toolbar and callbacks from invalidating memoization 60 times/sec
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const selectedClip = useMemo(() => {
    return getSelectedClip();
  }, [selectedClipId, selectedClipType, project]);

  // Split active clip at currentTime
  const handleSplitClip = useCallback(() => {
    if (!project || !selectedClipId) return;
    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "effect" || selectedClipType === "effects"
          ? "effects"
          : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...((project.tracks[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const clip = list[idx];
    const clipStart = clip.startTime || 0;
    const clipEnd = clipStart + (clip.duration || 0);

    const curTime = currentTimeRef.current;
    // Check if playhead is within clip boundaries
    if (curTime <= clipStart + 0.05 || curTime >= clipEnd - 0.05) {
      soundEngine.playSfx("click");
      Alert.alert(
        "Split Position",
        "Move the playhead inside the selected clip to split it into two sections.",
      );
      return;
    }

    soundEngine.playSfx("split");
    triggerHaptic("medium", settings?.hapticFeedback !== false);

    const firstDuration = curTime - clipStart;
    const secondDuration = clipEnd - curTime;

    const firstClip = {
      ...clip,
      duration: Number(firstDuration.toFixed(3)),
      ...(clip.trimIn !== undefined
        ? { trimOut: Number(((clip.trimIn || 0) + firstDuration).toFixed(3)) }
        : {}),
    };

    const secondClip = {
      ...clip,
      id: `clip-${String(key)[0]}-${Date.now()}`,
      startTime: Number(curTime.toFixed(3)),
      duration: Number(secondDuration.toFixed(3)),
      ...(clip.trimIn !== undefined
        ? {
            trimIn: Number(((clip.trimIn || 0) + firstDuration).toFixed(3)),
            trimOut: clip.trimOut,
          }
        : {}),
    };

    list.splice(idx, 1, firstClip, secondClip);

    const updated = {
      ...project,
      tracks: {
        ...project.tracks,
        [key]: list,
      },
    };
    setSelectedClipId(secondClip.id);
    updateProjectWithHistory(updated);
  }, [project, selectedClipId, selectedClipType, settings]);

  // Memoized crop modal opener
  const handleOpenCropModal = useCallback(() => {
    soundEngine.playSfx("click");
    if (selectedClip && selectedClipType === "video") {
      setIsCroppingPreview(true);
    } else {
      const curTime = currentTimeRef.current;
      const activeVids = (project?.tracks.video || []).filter(
        (v) => curTime >= v.startTime && curTime <= v.startTime + v.duration,
      );
      const targetVid = activeVids[0] || (project?.tracks.video || [])[0];
      if (targetVid) {
        setSelectedClipId(targetVid.id);
        setSelectedClipType("video");
        setIsCroppingPreview(true);
      }
    }
  }, [selectedClip, selectedClipType, project]);

  // Request delete clip with confirmation modal
  const handleDeleteClip = useCallback(
    (targetId?: string, targetType?: string) => {
      if (!project) return;
      const clipId = targetId || selectedClipId;
      if (!clipId) return;

      let clipType = targetType || selectedClipType;
      let foundTrackKey: keyof typeof project.tracks | null = null;
      let clip: any = null;

      // Search across all tracks to find the exact clip even if trackType is omitted or desynced
      const trackKeys: Array<keyof typeof project.tracks> = [
        "video",
        "audio",
        "text",
        "stickers",
        "effects",
      ];
      if (clipType) {
        const preferredKey = (
          clipType === "sticker" || clipType === "stickers"
            ? "stickers"
            : clipType === "effect" || clipType === "effects"
              ? "effects"
              : clipType
        ) as keyof typeof project.tracks;
        const list = (project.tracks[preferredKey] as any[]) || [];
        const match = list.find((c) => c.id === clipId);
        if (match) {
          foundTrackKey = preferredKey;
          clip = match;
        }
      }

      if (!clip) {
        for (const k of trackKeys) {
          const list = (project.tracks[k] as any[]) || [];
          const match = list.find((c) => c.id === clipId);
          if (match) {
            foundTrackKey = k;
            clip = match;
            clipType =
              k === "stickers" ? "sticker" : k === "effects" ? "effects" : k;
            break;
          }
        }
      }

      let name = `${(clipType || "item").charAt(0).toUpperCase() + (clipType || "item").slice(1)} Clip`;
      if (clip) {
        if (clipType === "text" && clip.text) {
          name = `"${clip.text.length > 25 ? clip.text.slice(0, 25) + "..." : clip.text}"`;
        } else if (clip.name) {
          name = clip.name;
        } else if (clip.label) {
          name = clip.label;
        } else if (clip.char) {
          name = `Sticker ${clip.char}`;
        } else if (clip.title) {
          name = clip.title;
        }
      }

      setClipToDelete({
        id: clipId,
        type: clipType || (foundTrackKey === "stickers" ? "sticker" : "video"),
        name,
        duration: clip?.duration,
      });
    },
    [project, selectedClipId, selectedClipType],
  );

  // Perform actual deletion after confirmation
  const handleConfirmDeleteClip = () => {
    if (!project || !clipToDelete) return;
    const { id: clipId, type: clipType } = clipToDelete;

    const trackKeys: Array<keyof typeof project.tracks> = [
      "video",
      "audio",
      "text",
      "stickers",
      "effects",
    ];
    const preferredKey = (
      clipType === "sticker" || clipType === "stickers"
        ? "stickers"
        : clipType === "effect" || clipType === "effects"
          ? "effects"
          : clipType
    ) as keyof typeof project.tracks;

    let targetKey = preferredKey;
    if (
      !((project.tracks[targetKey] as any[]) || []).some((c) => c.id === clipId)
    ) {
      for (const k of trackKeys) {
        if (((project.tracks[k] as any[]) || []).some((c) => c.id === clipId)) {
          targetKey = k;
          break;
        }
      }
    }

    const list = [...((project.tracks[targetKey] as any[]) || [])];
    const filtered = list.filter((c) => c.id !== clipId);

    // Ripple reposition if main video track
    if (targetKey === "video") {
      let t = 0;
      filtered.forEach((c) => {
        if (!c.trackIndex || c.trackIndex === 0) {
          c.startTime = t;
          t += c.duration;
        }
      });
    }

    const updated = {
      ...project,
      tracks: {
        ...project.tracks,
        [targetKey]: filtered,
      },
    };
    setSelectedClipId(null);
    setSelectedClipType(null);
    soundEngine.playSfx("pop");
    triggerHaptic("warning", settings?.hapticFeedback !== false);
    updateProjectWithHistory(updated);
    setClipToDelete(null);
    deleteMedia(clipId).catch(() => {});
  };

  // Desktop / Laptop Keyboard Shortcuts:
  // Space: Play/Pause, S / Cmd+K: Split, D: Duplicate, Del: Delete, Cmd+Z: Undo, Esc: Deselect/Close, Arrows: Step
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as any).isContentEditable)
      ) {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // 1. Play / Pause with Space
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        soundEngine.playSfx("click");
        if (
          !isPlaying &&
          (currentTime >= totalDuration - 0.05 || currentTime >= totalDuration)
        ) {
          setCurrentTime(0);
        }
        setIsPlaying((p) => !p);
        return;
      }

      // 2. Undo / Redo
      if (isCmdOrCtrl && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (isCmdOrCtrl && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // 3. Split Clip (S or Cmd+K)
      if ((e.key === "s" || e.key === "S") && !isCmdOrCtrl) {
        if (selectedClipId && route.screen === "editor" && !activeModal) {
          e.preventDefault();
          soundEngine.playSfx("split");
          handleSplitClip();
        }
        return;
      }
      if (isCmdOrCtrl && (e.key === "k" || e.key === "K")) {
        if (selectedClipId && route.screen === "editor" && !activeModal) {
          e.preventDefault();
          soundEngine.playSfx("split");
          handleSplitClip();
        }
        return;
      }

      // 4. Duplicate Clip (D or Cmd+D)
      if ((e.key === "d" || e.key === "D") && !e.shiftKey) {
        if (selectedClipId && route.screen === "editor" && !activeModal) {
          e.preventDefault();
          soundEngine.playSfx("pop");
          handleDuplicateClip();
        }
        return;
      }

      // 5. Delete Clip (Delete or Backspace)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          selectedClipId &&
          route.screen === "editor" &&
          !activeModal &&
          !clipToDelete
        ) {
          e.preventDefault();
          handleDeleteClip();
        }
        return;
      }

      // 6. Escape (Close modal or deselect)
      if (e.key === "Escape") {
        e.preventDefault();
        if (clipToDelete) {
          setClipToDelete(null);
        } else if (activeModal) {
          closeModal();
        } else if (selectedClipId) {
          setSelectedClipId(null);
        }
        return;
      }

      // 7. Arrow Left / Right Frame Step
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const delta = e.shiftKey ? 1.0 : 1 / 30;
        setCurrentTime((t) => Math.max(0, t - delta));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const delta = e.shiftKey ? 1.0 : 1 / 30;
        setCurrentTime((t) => Math.min(totalDuration, t + delta));
        return;
      }

      // 8. Zoom in / out (+ / -)
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(120, z + 10));
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => Math.max(20, z - 10));
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        setZoom(60);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedClipId,
    route.screen,
    activeModal,
    clipToDelete,
    project,
    selectedClipType,
    isPlaying,
    currentTime,
    totalDuration,
    historyStack,
    redoStack,
  ]);

  // Helper: get all clips across all tracks with their effective track indices
  const getAllTrackClips = (proj: typeof project) => {
    if (!proj) return [];
    const clips: {
      id: string;
      startTime: number;
      duration: number;
      trackIndex: number;
      type: string;
    }[] = [];
    (proj.tracks.video || []).forEach((c) =>
      clips.push({
        id: c.id,
        startTime: c.startTime,
        duration: c.duration,
        trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 0,
        type: "video",
      }),
    );
    (proj.tracks.audio || []).forEach((c) =>
      clips.push({
        id: c.id,
        startTime: c.startTime,
        duration: c.duration,
        trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 1,
        type: "audio",
      }),
    );
    (proj.tracks.text || []).forEach((c) =>
      clips.push({
        id: c.id,
        startTime: c.startTime,
        duration: c.duration,
        trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 2,
        type: "text",
      }),
    );
    (proj.tracks.stickers || []).forEach((c) =>
      clips.push({
        id: c.id,
        startTime: c.startTime,
        duration: c.duration,
        trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 3,
        type: "stickers",
      }),
    );
    (proj.tracks.effects || []).forEach((c) =>
      clips.push({
        id: c.id,
        startTime: c.startTime,
        duration: c.duration,
        trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 4,
        type: "effects",
      }),
    );
    return clips;
  };

  // Helper: check if interval [start, start + duration] collides with any clip in a track list
  const doesClipOverlap = (
    start: number,
    duration: number,
    clips: { startTime: number; duration: number; id?: string }[],
    ignoreClipId?: string,
  ): boolean => {
    const end = start + duration;
    return clips.some((c) => {
      if (ignoreClipId && c.id === ignoreClipId) return false;
      const cEnd = c.startTime + c.duration;
      return start < cEnd - 0.02 && end > c.startTime + 0.02;
    });
  };

  // Intelligent track allocation: if preferred track does not have enough space, finds next non-overlapping track (0..9)
  const allocateClipPlacement = (
    proj: typeof project,
    desiredStart: number,
    duration: number,
    preferredTrack: number,
    ignoreClipId?: string,
  ): { trackIndex: number; startTime: number } | null => {
    if (!proj) return null;
    const allClips = getAllTrackClips(proj);
    const start = Math.max(0, Number(desiredStart.toFixed(3)));
    const dur = Math.max(0.1, Number(duration.toFixed(3)));

    // 1. Check if preferred track has space
    const preferredClips = allClips.filter(
      (c) =>
        c.trackIndex === preferredTrack &&
        (!ignoreClipId || c.id !== ignoreClipId),
    );

    if (!doesClipOverlap(start, dur, preferredClips)) {
      return { trackIndex: preferredTrack, startTime: start };
    }

    // 2. Space is NOT enough on preferred track! Check other tracks (up to 10 tracks, 0-9)
    const otherTracks: number[] = [];
    for (let t = 0; t < 10; t++) {
      if (t !== preferredTrack) {
        otherTracks.push(t);
      }
    }

    // Sort so empty tracks are checked first, then higher tracks
    otherTracks.sort((a, b) => {
      const countA = allClips.filter((c) => c.trackIndex === a).length;
      const countB = allClips.filter((c) => c.trackIndex === b).length;
      if (countA === 0 && countB > 0) return -1;
      if (countB === 0 && countA > 0) return 1;
      return a - b;
    });

    for (const trackIdx of otherTracks) {
      const trackClips = allClips.filter(
        (c) =>
          c.trackIndex === trackIdx && (!ignoreClipId || c.id !== ignoreClipId),
      );
      if (!doesClipOverlap(start, dur, trackClips)) {
        return { trackIndex: trackIdx, startTime: start };
      }
    }

    // 3. All 10 tracks occupied at desiredStart!
    return null;
  };

  // Duplicate selected clip with non-overlapping multi-track placement
  const handleDuplicateClip = useCallback(
    (targetId?: string, targetType?: string) => {
      if (!project) return;
      const clipId = targetId || selectedClipId;
      const clipType = targetType || selectedClipType;
      if (!clipId) return;

      const key = (
        clipType === "sticker" || clipType === "stickers"
          ? "stickers"
          : clipType === "effect" || clipType === "effects"
            ? "effects"
            : clipType
      ) as keyof typeof project.tracks;
      const list = [...((project.tracks[key] as any[]) || [])];
      const idx = list.findIndex((c) => c.id === clipId);
      if (idx === -1) return;

      const original = list[idx];
      const dur = original.duration || 3.0;
      const origTrack =
        typeof original.trackIndex === "number"
          ? original.trackIndex
          : clipType === "audio"
            ? 1
            : clipType === "text"
              ? 2
              : clipType === "sticker" || clipType === "stickers"
                ? 3
                : clipType === "effects"
                  ? 4
                  : 0;

      const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id: `clip-${clipType[0]}-${Date.now()}`,
        position: original.position
          ? {
              x: Math.min(85, (original.position.x || 50) + 5),
              y: Math.min(85, (original.position.y || 50) + 5),
            }
          : undefined,
      };

      if (clipType === "video" && origTrack === 0) {
        // Main track video duplication: append sequentially
        clone.startTime = original.startTime + original.duration;
        clone.trackIndex = 0;
        list.splice(idx + 1, 0, clone);
        let t = 0;
        list.forEach((c) => {
          c.startTime = t;
          t += c.duration;
        });
      } else {
        // Non-video or overlay: place on new track at original.startTime to prevent overlapping
        const placement = allocateClipPlacement(
          project,
          original.startTime,
          dur,
          origTrack + 1,
          original.id,
        );
        if (placement) {
          clone.startTime = placement.startTime;
          clone.trackIndex = placement.trackIndex;
          addNotification({
            title: "Clip Duplicated",
            message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
            icon: "copy-outline",
          });
        } else {
          // If all other tracks are full, place after original ends
          clone.startTime = original.startTime + original.duration;
          clone.trackIndex = origTrack;
        }
        list.push(clone);
      }

      const updated = {
        ...project,
        tracks: {
          ...project.tracks,
          [key]: list,
        },
      };
      setSelectedClipId(clone.id);
      setSelectedClipType(clipType);
      updateProjectWithHistory(updated);
    },
    [project, selectedClipId, selectedClipType],
  );

  // Direct on-canvas transform update (move with hand, resize, rotate)
  const handleUpdateClipTransform = useCallback(
    (
      clipId: string,
      clipType: string,
      transform: { x: number; y: number; scale: number; rotation: number },
      isFinal: boolean = true,
    ) => {
      const current = projectRef.current;
      if (!current) return;
      const key = (
        clipType === "sticker" || clipType === "stickers" ? "stickers" : clipType
      ) as keyof typeof current.tracks;
      const list = [...((current.tracks[key] as any[]) || [])];
      const idx = list.findIndex((c) => c.id === clipId);
      if (idx < 0) return;

      if (clipType === "video" || clipType === "photo") {
        list[idx] = {
          ...list[idx],
          transform: {
            ...(list[idx].transform || {}),
            x: transform.x,
            y: transform.y,
            scale: transform.scale,
            rotation: transform.rotation,
          },
        };
      } else {
        list[idx] = {
          ...list[idx],
          position: { x: transform.x, y: transform.y },
          scale: transform.scale,
          rotation: transform.rotation,
        };
      }

      const updated = {
        ...current,
        tracks: { ...current.tracks, [key]: list } as any,
      };

      if (isFinal) {
        updateProjectWithHistory(updated);
      } else {
        projectRef.current = updated;
        setProject(updated);
      }
    },
    [updateProjectWithHistory],
  );

  // Update text clip from modal
  const handleUpdateText = useCallback(
    (updatedClip: TextClip) => {
      const current = projectRef.current;
      if (!current) return;
      const list = [...(current.tracks.text || [])];
      const idx = list.findIndex((c) => c.id === updatedClip.id);
      if (idx >= 0) {
        list[idx] = updatedClip;
        updateProjectWithHistory({
          tracks: { ...current.tracks, text: list },
        });
      }
    },
    [updateProjectWithHistory],
  );

  // Update sticker clip from modal
  const handleUpdateSticker = useCallback(
    (updatedClip: StickerClip) => {
      const current = projectRef.current;
      if (!current) return;
      const list = [...(current.tracks.stickers || [])];
      const idx = list.findIndex((c) => c.id === updatedClip.id);
      if (idx >= 0) {
        list[idx] = updatedClip;
        updateProjectWithHistory({
          tracks: { ...current.tracks, stickers: list },
        });
      }
    },
    [updateProjectWithHistory],
  );

  // Update effect clip from modal
  const handleUpdateEffect = useCallback(
    (updatedClip: EffectClip) => {
      const current = projectRef.current;
      if (!current) return;
      const list = [...(current.tracks.effects || [])];
      const idx = list.findIndex((c) => c.id === updatedClip.id);
      if (idx >= 0) {
        list[idx] = updatedClip;
        updateProjectWithHistory({
          tracks: { ...current.tracks, effects: list },
        });
      }
    },
    [updateProjectWithHistory],
  );

  // Rotate clip 90 degrees
  const handleRotateClip = useCallback(() => {
    if (!project || !selectedClip) return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const currentTransform = videoClips[idx].transform || {
      scale: 1,
      rotation: 0,
      x: 0,
      y: 0,
    };
    videoClips[idx] = {
      ...videoClips[idx],
      transform: {
        ...currentTransform,
        rotation: ((currentTransform.rotation || 0) + 90) % 360,
      },
    };

    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, video: videoClips },
    });
  }, [project, selectedClip, selectedClipId]);

  // Add new media clip — if space is not enough on Track 0, places on new track or alerts
  const handleAddMedia = (newClip: any) => {
    if (!project) return;
    const videoClips = [...(project.tracks.video || [])];
    const endingIdx = videoClips.findIndex((c) => (c as any).isEnding);
    const endingClip =
      endingIdx >= 0 ? videoClips.splice(endingIdx, 1)[0] : null;
    const newDuration = newClip.duration || 5.0;

    let targetStart = currentTime > 0 ? currentTime : 0;
    if (typeof newClip.startTime === "number" && newClip.startTime > 0) {
      targetStart = newClip.startTime;
    }

    const track0Clips = videoClips.filter((c) => (c.trackIndex ?? 0) === 0);
    const lastTrack0End =
      track0Clips.length > 0
        ? Math.max(...track0Clips.map((c) => c.startTime + c.duration))
        : 0;

    // If playhead is at 0 and track 0 has clips, append to track 0
    if (targetStart === 0 && track0Clips.length > 0) {
      targetStart = lastTrack0End;
    }

    const fitsOnTrack0 = !doesClipOverlap(
      targetStart,
      newDuration,
      track0Clips,
    );

    if (fitsOnTrack0) {
      newClip.startTime = Math.max(0, Number(targetStart.toFixed(3)));
      newClip.trackIndex = 0;
      videoClips.push(newClip);
    } else {
      // Space is NOT enough on Track 0: add on new track or alert if all tracks full
      const placement = allocateClipPlacement(
        project,
        targetStart,
        newDuration,
        0,
      );
      if (placement && placement.trackIndex !== 0) {
        newClip.startTime = placement.startTime;
        newClip.trackIndex = placement.trackIndex;
        videoClips.push(newClip);
        addNotification({
          title: "Added on New Track",
          message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
          icon: "videocam-outline",
        });
      } else {
        // Fallback: append after the last clip on Track 0 so clips never overlap
        newClip.startTime = Math.max(0, Number(lastTrack0End.toFixed(3)));
        newClip.trackIndex = 0;
        videoClips.push(newClip);
        addNotification({
          title: "Appended to Timeline",
          message: `Position occupied; placed after previous clip to prevent overlap.`,
          icon: "videocam-outline",
        });
      }
    }

    if (endingClip) {
      const maxEnd = Math.max(
        ...videoClips.map((c) => c.startTime + c.duration),
      );
      endingClip.startTime = maxEnd;
      videoClips.push(endingClip);
    }

    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, video: videoClips },
    });
  };

  // Add text overlay — if space is not enough on Track 2, places on new track or alerts
  const handleAddText = (newTextClip: any) => {
    if (!project) return;
    const dur = newTextClip.duration || 3.0;
    const desiredStart = currentTime;
    const placement = allocateClipPlacement(project, desiredStart, dur, 2);

    if (!placement) {
      Alert.alert(
        "Not Enough Space",
        "All tracks are occupied at this playhead position. Please move existing clips or free up a track.",
      );
      return;
    }

    newTextClip.startTime = placement.startTime;
    newTextClip.trackIndex = placement.trackIndex;
    const textClips = [...(project.tracks.text || []), newTextClip];

    if (placement.trackIndex !== 2) {
      addNotification({
        title: "Text Overlay Added",
        message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
        icon: "text-outline",
      });
    }

    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, text: textClips },
    });
  };

  // Add audio clip — if space is not enough on Track 1, places on new track or alerts
  const handleAddAudio = (newAudioClip: any) => {
    if (!project) return;
    const dur = newAudioClip.duration || 5.0;
    const desiredStart = currentTime;
    const placement = allocateClipPlacement(project, desiredStart, dur, 1);

    if (!placement) {
      Alert.alert(
        "Not Enough Space",
        "All audio/track lanes are occupied at this playhead position. Please move existing clips or free up a track.",
      );
      return;
    }

    newAudioClip.startTime = placement.startTime;
    newAudioClip.trackIndex = placement.trackIndex;
    const audioClips = [...(project.tracks.audio || []), newAudioClip];

    if (placement.trackIndex !== 1) {
      addNotification({
        title: "Audio Track Added",
        message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
        icon: "musical-notes-outline",
      });
    }

    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, audio: audioClips },
    });
  };

  // Add sticker overlay — if space is not enough on Track 3, places on new track or alerts
  const handleAddSticker = (newStickerClip: any) => {
    if (!project) return;
    const dur = newStickerClip.duration || 3.0;
    const desiredStart = currentTime;
    const placement = allocateClipPlacement(project, desiredStart, dur, 3);

    if (!placement) {
      Alert.alert(
        "Not Enough Space",
        "All tracks are occupied at this playhead position. Please move existing clips or free up a track.",
      );
      return;
    }

    newStickerClip.startTime = placement.startTime;
    newStickerClip.trackIndex = placement.trackIndex;
    const stickerClips = [...(project.tracks.stickers || []), newStickerClip];

    if (placement.trackIndex !== 3) {
      addNotification({
        title: "Sticker Added",
        message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
        icon: "happy-outline",
      });
    }

    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, stickers: stickerClips },
    });
  };

  // Add effect — if space is not enough on Track 4, places on new track or alerts
  const handleAddEffect = (preset: any) => {
    if (!project) return;
    if (selectedClip && selectedClipType === "video") {
      // Apply effect to active video clip
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx >= 0) {
        videoClips[idx] = { ...videoClips[idx], effect: preset.id };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: videoClips },
        });
      }
    } else {
      // Add as adjustment layer
      const dur = 3.0;
      const desiredStart = currentTime;
      const placement = allocateClipPlacement(project, desiredStart, dur, 4);

      if (!placement) {
        Alert.alert(
          "Not Enough Space",
          "All tracks are occupied at this playhead position. Please move existing clips or free up a track.",
        );
        return;
      }

      const newEff = {
        id: "eff-" + Date.now(),
        type: preset.type,
        name: preset.name,
        startTime: placement.startTime,
        duration: dur,
        intensity: preset.intensity || 0.8,
        trackIndex: placement.trackIndex,
      };
      const effectClips = [...(project.tracks.effects || []), newEff];

      if (placement.trackIndex !== 4) {
        addNotification({
          title: "Effect Added",
          message: `Placed on Track ${placement.trackIndex + 1} to prevent overlapping.`,
          icon: "sparkles-outline",
        });
      }

      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, effects: effectClips },
      });
    }
    setActiveModal(null);
  };

  // Apply color filter or custom 3D LUT
  const handleApplyFilter = (filterId: string, customLut?: CustomLutConfig) => {
    if (!project) return;
    if (selectedClip && selectedClipType === "video") {
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx >= 0) {
        videoClips[idx] = {
          ...videoClips[idx],
          filter: filterId,
          customLut: customLut,
        };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: videoClips },
        });
      }
    }
    setActiveModal(null);
  };

  // Apply Cutout (Chroma Key & Auto Cutout)
  const handleApplyCutout = (cutoutConfig: CutoutConfig) => {
    if (!project || !selectedClip) return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      videoClips[idx] = {
        ...videoClips[idx],
        cutout: cutoutConfig,
        transform: {
          ...(videoClips[idx].transform || {}),
          cutout: cutoutConfig,
        },
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    }
  };

  // Apply AI Motion Tracking
  const handleApplyMotionTracking = (motionConfig: MotionTrackConfig) => {
    if (!project || !selectedClip) return;
    if (selectedClipType === "text") {
      const textClips = [...(project.tracks.text || [])];
      const idx = textClips.findIndex((t) => t.id === selectedClipId);
      if (idx >= 0) {
        textClips[idx] = { ...textClips[idx], motionTrack: motionConfig };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, text: textClips },
        });
      }
    } else if (
      selectedClipType === "stickers" ||
      selectedClipType === "sticker"
    ) {
      const stickerClips = [...(project.tracks.stickers || [])];
      const idx = stickerClips.findIndex((s) => s.id === selectedClipId);
      if (idx >= 0) {
        stickerClips[idx] = { ...stickerClips[idx], motionTrack: motionConfig };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, stickers: stickerClips },
        });
      }
    } else if (selectedClipType === "video") {
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((v) => v.id === selectedClipId);
      if (idx >= 0) {
        videoClips[idx] = { ...videoClips[idx], motionTrack: motionConfig };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: videoClips },
        });
      }
    }
  };

  // Apply transition
  const handleApplyTransition = (trans: any) => {
    if (!project || !transitionTargetClipId) return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === transitionTargetClipId);
    if (idx >= 0) {
      videoClips[idx] = { ...videoClips[idx], transition: trans };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    }
  };

  // Apply speed change (Presets or Custom Bezier Curve + Smooth Slow-Mo)
  const handleApplySpeed = (
    speedVal: number,
    curve?: any,
    smoothSlowMo?: "none" | "blend" | "optical_flow",
  ) => {
    if (!project || !selectedClip) return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      const clip = videoClips[idx];
      const mediaDur = getMediaDuration(clip, clip.type);
      let newDuration = clip.duration;
      let newTrimOut = clip.trimOut;

      if (mediaDur && mediaDur > 0 && clip.type === "video") {
        const currentTrimIn = Math.max(0, clip.trimIn || 0);
        const maxTimelineDur = (mediaDur - currentTrimIn) / speedVal;
        if (newDuration > maxTimelineDur) {
          newDuration = Number(maxTimelineDur.toFixed(3));
          newTrimOut = mediaDur;
        }
      }

      videoClips[idx] = {
        ...clip,
        duration: newDuration,
        trimOut: newTrimOut,
        speed: speedVal,
        speedCurve: curve ? curve.points || curve : null,
        smoothSlowMo: smoothSlowMo || "none",
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    }
  };

  const isKeyframeAtPlayhead = useMemo(() => {
    let clip = selectedClip;
    if (!clip) {
      const curTime = currentTime;
      const videoClips = project?.tracks?.video || [];
      clip = videoClips.find(
        (c: any) =>
          curTime >= (c.startTime || 0) - 0.05 &&
          curTime <= (c.startTime || 0) + (c.duration || 0) + 0.05,
      );
    }
    if (!clip?.keyframes || clip.keyframes.length === 0) return false;
    const localTime = Math.max(0, currentTime - (clip.startTime || 0));
    return clip.keyframes.some((k: any) => Math.abs(k.time - localTime) < 0.12);
  }, [selectedClip, project?.tracks?.video, currentTime]);

  // Add Keyframe to active clip (Modern - zero system alerts!)
  const handleAddKeyframe = (): { action: "added" | "removed"; time: number } | void => {
    let targetClip = selectedClip;
    let targetType = selectedClipType;
    let targetId = selectedClipId;

    // Auto-target: If user hasn't tapped a clip, target the video clip right under playhead!
    if (!targetClip) {
      const curTime = currentTimeRef.current;
      const videoClips = project?.tracks?.video || [];
      const activeVideo = videoClips.find(
        (c: any) =>
          curTime >= (c.startTime || 0) - 0.05 &&
          curTime <= (c.startTime || 0) + (c.duration || 0) + 0.05,
      );
      if (activeVideo) {
        targetClip = activeVideo;
        targetType = "video";
        targetId = activeVideo.id;
        setSelectedClipId(activeVideo.id);
        setSelectedClipType("video");
      }
    }

    if (!targetClip) {
      soundEngine.playSfx("click");
      openModal("keyframe");
      return;
    }

    soundEngine.playSfx("pop");
    // Toggle keyframe stamp
    const keyframes = targetClip.keyframes || [];
    const localTime = Math.max(0, currentTime - targetClip.startTime);
    const exists = keyframes.some(
      (k: any) => Math.abs(k.time - localTime) < 0.12,
    );

    let updatedKf = [];
    let actionType: "added" | "removed" = "added";
    if (exists) {
      actionType = "removed";
      updatedKf = keyframes.filter(
        (k: any) => Math.abs(k.time - localTime) >= 0.12,
      );
    } else {
      actionType = "added";
      updatedKf = [
        ...keyframes,
        {
          time: localTime,
          transform: {
            ...(targetClip.transform || {
              scale: 1,
              rotation: 0,
              x: 0,
              y: 0,
            }),
          },
          opacity: targetClip.opacity !== undefined ? targetClip.opacity : 1.0,
        },
      ];
    }

    const key = (
      targetType === "sticker" || targetType === "stickers"
        ? "stickers"
        : targetType === "effect" || targetType === "effects"
          ? "effects"
          : targetType === "text" || targetType === "texts"
            ? "text"
            : targetType
    ) as keyof typeof project.tracks;

    const list = [...((project.tracks[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === targetId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], keyframes: updatedKf };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, [key]: list } as any,
      });
    }

    return { action: actionType, time: currentTime };
  };

  const handleUpdateKeyframeTransform = (
    time: number,
    transform: any,
    opacity?: number,
  ) => {
    if (!selectedClip) return;
    const keyframes: any[] = selectedClip.keyframes || [];
    const existingIndex = keyframes.findIndex(
      (k) => Math.abs(k.time - time) < 0.12,
    );

    let updatedKf = [...keyframes];
    if (existingIndex >= 0) {
      const existing = updatedKf[existingIndex];
      updatedKf[existingIndex] = {
        ...existing,
        transform: { ...(existing.transform || {}), ...transform },
        opacity: opacity !== undefined ? opacity : (existing.opacity ?? 1.0),
      };
    } else {
      updatedKf.push({
        time,
        transform: { ...(selectedClip.transform || {}), ...transform },
        opacity: opacity !== undefined ? opacity : (selectedClip.opacity ?? 1.0),
      });
    }

    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "effect" || selectedClipType === "effects"
          ? "effects"
          : selectedClipType === "text" || selectedClipType === "texts"
            ? "text"
            : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...((project.tracks[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        transform: { ...(list[idx].transform || {}), ...transform },
        opacity: opacity !== undefined ? opacity : (list[idx].opacity ?? 1.0),
        keyframes: updatedKf,
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, [key]: list } as any,
      });
    }
  };

  const handleDeleteKeyframeAtTime = (time: number) => {
    if (!selectedClip) return;
    const keyframes: any[] = selectedClip.keyframes || [];
    const updatedKf = keyframes.filter((k) => Math.abs(k.time - time) >= 0.12);

    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "effect" || selectedClipType === "effects"
          ? "effects"
          : selectedClipType === "text" || selectedClipType === "texts"
            ? "text"
            : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...((project.tracks[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], keyframes: updatedKf };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, [key]: list } as any,
      });
    }
  };

  const handleClearAllKeyframes = () => {
    if (!selectedClip) return;
    const key = (
      selectedClipType === "sticker" || selectedClipType === "stickers"
        ? "stickers"
        : selectedClipType === "effect" || selectedClipType === "effects"
          ? "effects"
          : selectedClipType === "text" || selectedClipType === "texts"
            ? "text"
            : selectedClipType
    ) as keyof typeof project.tracks;

    const list = [...((project.tracks[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], keyframes: [] };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, [key]: list } as any,
      });
    }
  };

  // Project Management Handlers (Home Screen)
  const handleOpenProject = (id: string) => {
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
  };

  const handleUpdateSettings = (newSettings: any) => {
    const updated = saveSettings(newSettings);
    setSettings(updated);
    soundEngine.setEnabled(updated.soundEffects === true);
  };

  const handleReloadAllData = () => {
    const projs = loadAllProjects();
    const currentSettings = loadSettings();
    const currentNotifs = loadNotifications();
    const currentSession = loadLastSession();
    setProjects(projs);
    setSettings(currentSettings);
    setNotifications(currentNotifs);
    setLastSession(currentSession);
    soundEngine.setEnabled(currentSettings.soundEffects === true);
    if (projs.length > 0) {
      setProject(projs[0]);
    } else {
      setProject(null);
    }
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, unread: false }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const handleDeleteNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleNotificationAction = (notification: AppNotification) => {
    // Mark clicked notification as read
    const updated = notifications.map((n) =>
      n.id === notification.id ? { ...n, unread: false } : n,
    );
    setNotifications(updated);
    saveNotifications(updated);

    // If notification has a specific projectId, open it directly!
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
  };

  const handleCreateNewProject = () => {
    const newProj = createDefaultProject(`Project ${projects.length + 1}`);
    newProj.aspectRatio = settings?.defaultAspectRatio || "9:16";
    newProj.resolution = settings?.defaultResolution || "1080p";
    newProj.fps = settings?.defaultFps || 30;

    // Apply Auto Add Default Ending setting
    if (settings?.autoAddEnding) {
      newProj.tracks.video = [
        {
          id: "clip-outro-" + Date.now(),
          title: "FastArt Outro",
          type: "video",
          url: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-code-31910-large.mp4",
          duration: 2.5,
          startTime: 0,
          trimIn: 0,
          trimOut: 2.5,
          volume: 1,
          isEnding: true,
        },
      ];
      newProj.tracks.text = [
        {
          id: "text-outro-" + Date.now(),
          text: "FAST★ART",
          startTime: 0.2,
          duration: 2.1,
          style: {
            fontSize: 34,
            color: "#00F2FE",
            fontFamily: "system-ui",
            textAlign: "center",
            fontWeight: "bold",
          },
        },
      ];
    }

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
  };

  const handleDuplicateProject = (id: string) => {
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
  };

  const handleDeleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    const updated = deleteProject(id);
    setProjects(updated);
    if (project?.id === id) {
      setProject(null);
    }
    // Always navigate back to homepage on project deletion
    navigate("/", { replace: true });

    // Clean up project media from IndexedDB
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
  };

  const handleRenameProject = (id: string, newTitle: string) => {
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
  };

  // Apply Volume & Dynamics
  const handleApplyVolume = (vol: number, fadeIn: number, fadeOut: number) => {
    if (!project || !selectedClip) return;
    const list = [
      ...(project.tracks[selectedClipType as keyof typeof project.tracks] ||
        []),
    ];
    const idx = list.findIndex((c: any) => c.id === selectedClipId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        volume: vol,
        fadeIn,
        fadeOut,
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, [selectedClipType]: list } as any,
      });
    }
  };

  // Apply Transform, Mask & Canvas Ratio (Crop decoupled)
  const handleApplyTransform = (
    t: ClipTransform,
    newAspectRatio?: AspectRatio,
    newMask?: MaskConfig,
  ) => {
    const current = projectRef.current;
    if (!current) return;
    let updated: any = { ...current };
    if (newAspectRatio && newAspectRatio !== current.aspectRatio) {
      updated.aspectRatio = newAspectRatio;
    }
    if (selectedClip && selectedClipType === "video") {
      const videoClips = [...(current.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx >= 0) {
        const finalMask =
          newMask !== undefined
            ? newMask
            : t.mask !== undefined
              ? t.mask
              : videoClips[idx].mask;
        const preservedCrop = videoClips[idx].crop;
        videoClips[idx] = {
          ...videoClips[idx],
          transform: {
            ...(videoClips[idx].transform || {}),
            ...t,
            mask: finalMask,
            crop: preservedCrop,
          },
          mask: finalMask,
          crop: preservedCrop,
        };
        updated.tracks = { ...current.tracks, video: videoClips };
      }
    }
    updateProjectWithHistory(updated);
  };

  // Direct clip crop from on-preview cropping interface
  const handleUpdateClipCrop = (
    clipId: string,
    newCrop: CustomCrop,
    isFinal = true,
  ) => {
    const current = projectRef.current;
    if (!current) return;
    const videoClips = [...(current.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === clipId);
    if (idx >= 0) {
      videoClips[idx] = {
        ...videoClips[idx],
        crop: newCrop,
        transform: {
          ...(videoClips[idx].transform || {}),
          crop: newCrop,
        },
      };
      const updatedProject = {
        ...current,
        tracks: { ...current.tracks, video: videoClips },
      };
      if (isFinal) {
        updateProjectWithHistory(updatedProject);
      } else {
        projectRef.current = updatedProject;
        setProject(updatedProject);
      }
    }
  };

  // Toggle Reverse
  const handleToggleReverse = useCallback(() => {
    if (!project || !selectedClip || selectedClipType !== "video") return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      videoClips[idx] = {
        ...videoClips[idx],
        reverse: !videoClips[idx].reverse,
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    }
  }, [project, selectedClip, selectedClipType, selectedClipId]);

  // Apply AI Enhance
  const handleApplyEnhance = (preset: { filterLut: string }) => {
    if (!project) return;
    const videoClips = (project.tracks.video || []).map((c) => {
      if (!selectedClipId || c.id === selectedClipId) {
        return { ...c, filter: preset.filterLut };
      }
      return c;
    });
    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, video: videoClips },
    });
  };

  // AutoCut Generated Project
  const handleAutoCutGenerated = (newProj: FastArtProject) => {
    saveProject(newProj);
    setProjects((prev: any) => [newProj, ...prev]);
    setProject(newProj);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedClipId(null);
    closeModal();
    navigate(`/project/${newProj.id}`);
  };

  // Draggable Trim Clip for Video, Audio, and Text
  const handleTrimClip = (
    clipId: string,
    updates: {
      startTime?: number;
      duration?: number;
      trimIn?: number;
      trimOut?: number;
      trackIndex?: number;
    },
    isFinal: boolean = true,
  ) => {
    if (!project) return;
    const tracks = {
      video: project.tracks.video ? [...project.tracks.video] : [],
      audio: project.tracks.audio ? [...project.tracks.audio] : [],
      text: project.tracks.text ? [...project.tracks.text] : [],
      stickers: project.tracks.stickers ? [...project.tracks.stickers] : [],
      effects: project.tracks.effects ? [...project.tracks.effects] : [],
      filters: project.tracks.filters ? [...project.tracks.filters] : [],
    };

    let found = false;
    // Check video clips
    if (tracks.video) {
      const idx = tracks.video.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        const clampedUpdates = clampClipTrimUpdates(
          tracks.video[idx],
          updates,
          tracks.video[idx].type,
        );
        tracks.video[idx] = { ...tracks.video[idx], ...clampedUpdates };
        found = true;
      }
    }
    // Check audio clips
    if (!found && tracks.audio) {
      const idx = tracks.audio.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        const clampedUpdates = clampClipTrimUpdates(
          tracks.audio[idx],
          updates,
          "audio",
        );
        tracks.audio[idx] = { ...tracks.audio[idx], ...clampedUpdates };
        found = true;
      }
    }
    // Check text clips
    if (!found && tracks.text) {
      const idx = tracks.text.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        tracks.text[idx] = { ...tracks.text[idx], ...updates };
        found = true;
      }
    }
    // Check sticker clips
    if (!found && tracks.stickers) {
      const idx = tracks.stickers.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        tracks.stickers[idx] = { ...tracks.stickers[idx], ...updates };
        found = true;
      }
    }
    // Check effect clips
    if (!found && tracks.effects) {
      const idx = tracks.effects.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        tracks.effects[idx] = { ...tracks.effects[idx], ...updates };
        found = true;
      }
    }

    const updated = { ...project, tracks };
    if (isFinal) {
      updateProjectWithHistory(updated);
    } else {
      setProject(updated);
    }
  };

  // Draggable Move Clip along timeline tracks
  const handleMoveClip = (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
    newStartTime: number,
    newTrackIndex?: number,
  ) => {
    if (!project) return;
    const tracks = {
      video: project.tracks.video ? [...project.tracks.video] : [],
      audio: project.tracks.audio ? [...project.tracks.audio] : [],
      text: project.tracks.text ? [...project.tracks.text] : [],
      stickers: project.tracks.stickers ? [...project.tracks.stickers] : [],
      effects: project.tracks.effects ? [...project.tracks.effects] : [],
      filters: project.tracks.filters ? [...project.tracks.filters] : [],
    };

    const updateItem = (c: any) =>
      c.id === clipId
        ? {
            ...c,
            startTime: newStartTime,
            ...(typeof newTrackIndex === "number"
              ? { trackIndex: newTrackIndex }
              : {}),
          }
        : c;

    if (trackType === "video" && tracks.video) {
      tracks.video = tracks.video.map(updateItem);
    } else if (trackType === "audio" && tracks.audio) {
      tracks.audio = tracks.audio.map(updateItem);
    } else if (trackType === "text" && tracks.text) {
      tracks.text = tracks.text.map(updateItem);
    } else if (trackType === "sticker" && tracks.stickers) {
      tracks.stickers = tracks.stickers.map(updateItem);
    } else if (trackType === "effects" && tracks.effects) {
      tracks.effects = tracks.effects.map(updateItem);
    }

    updateProjectWithHistory({ ...project, tracks });
  };

  return (
    <View style={styles.rootWrapper}>
      <StatusBar barStyle="light-content" />
      <View style={styles.rootContainer}>
        {/* 1. HOME DASHBOARD SCREEN (URL: / or /home) */}
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

        {/* 2. DEDICATED SETTINGS SCREEN (URL: /settings) */}
        {route.screen === "settings" && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBack={() => {
              navigate("/");
            }}
            onReloadData={handleReloadAllData}
          />
        )}

        {/* 3. DEDICATED NOTIFICATIONS SCREEN (URL: /notifications) */}
        {route.screen === "notifications" && (
          <NotificationsScreen
            notifications={notifications}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClearAll={handleClearAllNotifications}
            onDeleteNotification={handleDeleteNotification}
            onActionClick={handleNotificationAction}
            onBack={() => {
              navigate("/");
            }}
          />
        )}

        {/* 4. Loading placeholder while project hydrates */}
        {route.screen === "editor" &&
          !project &&
          projects.some((p) => p.id === route.projectKey) && (
            <View style={styles.projectLoadingSurface}>
              <ActivityIndicator size="large" color="#00F2FE" />
              <Text style={styles.projectLoadingText}>Opening project...</Text>
            </View>
          )}

        {/* 4b. PROJECT NOT FOUND SCREEN (URL: /project/:invalidKey) */}
        {!isAppLoading &&
          projects.length > 0 &&
          route.screen === "editor" &&
          route.projectKey &&
          !project &&
          !projects.some(
            (p) =>
              p.id === route.projectKey ||
              p.id.toLowerCase() === (route.projectKey || "").toLowerCase()
          ) && (
            <ProjectNotFoundScreen
              projectKey={route.projectKey || ""}
              onGoHome={() => navigate("/")}
              onCreateNew={handleCreateNewProject}
              onOpenDefault={
                projects.length > 0
                  ? () => navigate(`/project/${projects[0].id}`)
                  : undefined
              }
            />
          )}

        {/* 5. FULL VIDEO EDITOR SUITE (URL: /project/:key) */}
        {(route.screen === "editor" || route.screen === "export") &&
          project && (
            <View style={styles.editorContainer}>
              {/* Top Header Bar */}
              {!isFullscreen && (
                <Header
                  project={project}
                  onUpdateProject={(updates) =>
                    updateProjectWithHistory(updates)
                  }
                  onBackToHome={handleBackToHome}
                  canUndo={historyStack.length > 0}
                  canRedo={redoStack.length > 0}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onOpenExport={handleOpenExport}
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
                  onAddKeyframe={handleAddKeyframe}
                  onOpenKeyframeModal={handleOpenKeyframeModal}
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
                    else if (normalizedType === "stickers")
                      openModal("stickers");
                    else if (normalizedType === "effects") openModal("effects");
                    else setIsCroppingPreview(true);
                  }}
                  onOpenCropModal={(clipId) => {
                    setSelectedClipId(clipId);
                    setSelectedClipType("video");
                    setIsCroppingPreview(true);
                  }}
                  onOpenMaskModal={(clipId) => {
                    setSelectedClipId(clipId);
                    setSelectedClipType("video");
                    openModal("mask");
                  }}
                  onDeleteClip={handleDeleteClip}
                  onDuplicateClip={handleDuplicateClip}
                  onSplitClip={handleSplitClip}
                />
              </View>

              {/* Bottom Docked Section: Timeline and Editing Options Toolbar */}
              {!isFullscreen && (
                <View style={styles.bottomDock}>
                  <Timeline
                    project={project}
                    currentTime={currentTime}
                    totalDuration={totalDuration}
                    onSeek={(t) => setCurrentTime(t)}
                    selectedClipId={selectedClipId}
                    onSelectClip={(id, type) => {
                      setSelectedClipId(id);
                      const normalizedType =
                        type === "sticker"
                          ? "stickers"
                          : type === "effects"
                            ? "effects"
                            : type;
                      setSelectedClipType(normalizedType);
                    }}
                    onTrimClip={handleTrimClip}
                    onMoveClip={handleMoveClip}
                    onOpenTransitions={(clipId) => {
                      setTransitionTargetClipId(clipId);
                      openModal("transitions");
                    }}
                    onOpenMediaPicker={() => openModal("media")}
                    onOpenTextModal={() => openModal("text")}
                    onOpenAudioModal={() => openModal("audio")}
                    onOpenEffectsModal={() => openModal("effects")}
                    onOpenStickersModal={() => openModal("stickers")}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    onUpdateProject={(updates) =>
                      updateProjectWithHistory(updates)
                    }
                    onAdjustDuration={(delta) => {
                      if (!project || !selectedClipId) return;
                      const key =
                        selectedClipType === "sticker" ||
                        selectedClipType === "stickers"
                          ? "stickers"
                          : selectedClipType;
                      const list = [...((project.tracks as any)[key] || [])];
                      const idx = list.findIndex(
                        (c: any) => c.id === selectedClipId,
                      );
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
                      else if (normalizedType === "stickers")
                        openModal("stickers");
                      else if (normalizedType === "audio") openModal("volume");
                      else if (normalizedType === "effects")
                        openModal("effects");
                      else setIsCroppingPreview(true);
                    }}
                    settings={settings}
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
                    onOpenKeyframeModal={handleOpenKeyframeModal}
                  />
                </View>
              )}
            </View>
          )}

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

        {activeModal === "text" && (
          <TextModal
            visible={true}
            onClose={closeModal}
            onAddText={handleAddText}
            editingClip={
              selectedClipType === "text" ? (selectedClip as TextClip) : null
            }
            onUpdateText={handleUpdateText}
            currentPlayheadTime={currentTime}
          />
        )}

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

        {activeModal === "volume" && (
          <VolumeModal
            visible={true}
            onClose={closeModal}
            currentVolume={selectedClip?.volume ?? 1.0}
            currentFadeIn={selectedClip?.fadeIn ?? 0}
            currentFadeOut={selectedClip?.fadeOut ?? 0}
            onApplyVolume={handleApplyVolume}
          />
        )}

        {activeModal === "mask" && (
          <CropTransformModal
            visible={true}
            onClose={closeModal}
            currentTransform={selectedClip?.transform}
            currentAspectRatio={project?.aspectRatio || "9:16"}
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
            onUpdateProject={(updates) =>
              updateProjectWithHistory(updates)
            }
          />
        )}

        {activeModal === "enhance" && (
          <AIEnhanceModal
            visible={true}
            onClose={closeModal}
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
  projectLoadingSurface: {
    flex: 1,
    backgroundColor: "#0B0D13",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  projectLoadingText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
});
