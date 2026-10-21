import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Platform,
} from 'react-native';
import Header from './src/components/Header';
import Player from './src/components/Player';
import Timeline from './src/components/Timeline';
import Toolbar from './src/components/Toolbar';
import HomeDashboard from './src/components/HomeDashboard';
import SettingsScreen from './src/components/SettingsScreen';
import NotificationsScreen from './src/components/NotificationsScreen';
import ProjectNotFoundScreen from './src/components/ProjectNotFoundScreen';
import { useAppRouter } from './src/utils/router';

// Modals / Panels
import MediaPickerModal from './src/components/Panels/MediaPickerModal';
import TextModal from './src/components/Panels/TextModal';
import AudioModal from './src/components/Panels/AudioModal';
import FiltersModal from './src/components/Panels/FiltersModal';
import EffectsModal from './src/components/Panels/EffectsModal';
import StickersModal from './src/components/Panels/StickersModal';
import TransitionsModal from './src/components/Panels/TransitionsModal';
import SpeedModal from './src/components/Panels/SpeedModal';
import ExportModal from './src/components/Panels/ExportModal';
import SettingsModal from './src/components/Panels/SettingsModal';
import NotificationsModal from './src/components/Panels/NotificationsModal';
import VolumeModal from './src/components/Panels/VolumeModal';
import CropTransformModal from './src/components/Panels/CropTransformModal';
import CameraModal from './src/components/Panels/CameraModal';
import AutoCutModal from './src/components/Panels/AutoCutModal';
import AIEnhanceModal from './src/components/Panels/AIEnhanceModal';
import TextToSpeechModal from './src/components/Panels/TextToSpeechModal';
import CutoutModal from './src/components/Panels/CutoutModal';
import MotionTrackingModal from './src/components/Panels/MotionTrackingModal';
import ConfirmDeleteModal from './src/components/ConfirmDeleteModal';

import {
  FastArtProject,
  VideoClip,
  AudioClip,
  TextClip,
  StickerClip,
  ClipTransform,
  AspectRatio,
  MaskConfig,
  CustomCrop,
  CutoutConfig,
  MotionTrackConfig,
  CustomLutConfig,
  createDefaultProject,
  computeTotalDuration,
} from './src/types/project';
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
} from './src/utils/storage';
import { soundEngine } from './src/utils/audioEngine';
import { triggerHaptic } from './src/utils/haptics';
import { getLiveMediaUrl, deleteMedia } from './src/utils/largeMediaStorage';

export default function App() {
  const { route, navigate, goBack } = useAppRouter();
  const screen = route.screen;
  const setScreen = (s: string) => {
    if (s === 'home') navigate('/');
    else if (s === 'editor' && project) navigate(`/project/${project.id}`);
    else navigate(`/${s}`);
  };
  const [projects, setProjects] = useState<FastArtProject[]>(() => loadAllProjects());
  const [project, setProject] = useState<FastArtProject | null>(null);
  const [lastSession, setLastSession] = useState<LastEditSession | null>(() => loadLastSession());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadNotifications());

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipType, setSelectedClipType] = useState<string>('video');
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
  const [transitionTargetClipId, setTransitionTargetClipId] = useState<string | null>(null);

  const animFrameRef = useRef<any>(null);
  const lastTimeRef = useRef<any>(null);

  // ESC key listener to exit fullscreen mode on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isFullscreen) {
          setIsFullscreen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen]);

  // Load and hydrate projects, settings & notifications on startup
  useEffect(() => {
    if (settings) {
      soundEngine.setEnabled(settings.soundEffects === true);
    }
    initNativeStorageAsync().then(() => {
      const projs = loadAllProjects();
      const currentSettings = loadSettings();
      const currentNotifs = loadNotifications();
      const session = loadLastSession();
      setProjects(projs);
      setSettings(currentSettings);
      setNotifications(currentNotifs);
      setLastSession(session);
      soundEngine.setEnabled(currentSettings.soundEffects === true);
    });

    // Live notification synchronization
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleSyncNotifs = () => {
        setNotifications(loadNotifications());
      };
      window.addEventListener('fastart:notification_added', handleSyncNotifs);
      window.addEventListener('fastart:notifications_changed', handleSyncNotifs);
      return () => {
        window.removeEventListener('fastart:notification_added', handleSyncNotifs);
        window.removeEventListener('fastart:notifications_changed', handleSyncNotifs);
      };
    }
  }, []);

  // Mobile web gesture smoothing & touch-action performance optimization
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleEl = document.createElement('style');
      styleEl.innerHTML = `
        html, body, #root {
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
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('pointerdown', unlockAudio);
      };
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('pointerdown', unlockAudio, { passive: true });

      return () => {
        try {
          document.head.removeChild(styleEl);
        } catch (e) {}
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('pointerdown', unlockAudio);
      };
    }
  }, []);

  // Sync route and project / modal selection
  useEffect(() => {
    if (projects.length === 0) return;

    if (route.screen === 'editor') {
      const key = route.projectKey;
      if (!key) {
        // e.g. /project without key -> default to first project URL
        navigate(`/project/${projects[0].id}`, { replace: true });
        return;
      }

      if (key === 'new') {
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
            p.title.toLowerCase().replace(/\s+/g, '-') === key.toLowerCase()
        );
      }

      if (matched) {
        if (!project || project.id !== matched.id) {
          setProject(matched);
          const session = loadLastSession();
          const resumeTime =
            session && session.projectId === matched.id && typeof session.currentTime === 'number'
              ? session.currentTime
              : (matched.currentTime || 0);
          setCurrentTime(resumeTime);
          setIsPlaying(false);
          setSelectedClipId(session && session.projectId === matched.id ? session.selectedClipId || null : null);
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
    if (project && route.screen === 'editor' && !isPlaying) {
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
    if (route.screen === 'editor' && project) {
      navigate(`/project/${project.id}?tool=${modalName}`, { replace: true });
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    if (route.screen === 'editor' && project) {
      navigate(`/project/${project.id}`, { replace: true });
    }
  };

  // Compute total duration
  const totalDuration = project ? computeTotalDuration(project.tracks) : 10.0;

  // 60 FPS Playback loop
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (now) => {
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= totalDuration) {
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
    if (Platform.OS === 'web' && project) {
      let changed = false;
      const checkAndRestore = async () => {
        const vClips = [...(project.tracks.video || [])];
        for (let i = 0; i < vClips.length; i++) {
          const c = vClips[i];
          if (c.id && (!c.url || c.url.startsWith('blob:'))) {
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
          if (c.id && (!c.url || c.url.startsWith('blob:'))) {
            const liveUrl = await getLiveMediaUrl(c.id);
            if (liveUrl && liveUrl !== c.url) {
              aClips[i] = { ...c, url: liveUrl };
              changed = true;
            }
          }
        }
        if (changed) {
          setProject((prev) => (prev ? { ...prev, tracks: { ...prev.tracks, video: vClips, audio: aClips } } : prev));
        }
      };
      checkAndRestore();
    }
  }, [project?.id]);

  // Push state to undo stack with memory cap
  const updateProjectWithHistory = (updatedProject: any) => {
    setHistoryStack((prev) => [...prev.slice(-20), JSON.parse(JSON.stringify(project))]);
    setRedoStack([]);
    const saved = saveProject(updatedProject);
    setProject(saved);
    setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, JSON.parse(JSON.stringify(project))]);
    const saved = saveProject(prev);
    setProject(saved);
    setProjects((all) => all.map((p) => (p.id === saved.id ? saved : p)));
    soundEngine.playSfx('click');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setHistoryStack((s) => [...s, JSON.parse(JSON.stringify(project))]);
    const saved = saveProject(next);
    setProject(saved);
    setProjects((all) => all.map((p) => (p.id === saved.id ? saved : p)));
    soundEngine.playSfx('click');
  };

  // Find currently selected clip object
  const getSelectedClip = () => {
    if (!selectedClipId || !project) return null;
    const list = project.tracks[selectedClipType] || [];
    return list.find((c) => c.id === selectedClipId);
  };

  const selectedClip = getSelectedClip();

  // Split active clip at currentTime
  const handleSplitClip = () => {
    if (!project || !selectedClipId) return;
    const key = (selectedClipType === 'sticker' || selectedClipType === 'stickers'
      ? 'stickers'
      : selectedClipType === 'effect' || selectedClipType === 'effects'
      ? 'effects'
      : selectedClipType) as keyof typeof project.tracks;

    const list = [...((project.tracks[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const clip = list[idx];
    const clipStart = clip.startTime || 0;
    const clipEnd = clipStart + (clip.duration || 0);

    // Check if playhead is within clip boundaries
    if (currentTime <= clipStart + 0.05 || currentTime >= clipEnd - 0.05) return;

    soundEngine.playSfx('split');
    triggerHaptic('medium', settings?.hapticFeedback !== false);

    const firstDuration = currentTime - clipStart;
    const secondDuration = clipEnd - currentTime;

    const firstClip = {
      ...clip,
      duration: Number(firstDuration.toFixed(3)),
      ...(clip.trimIn !== undefined ? { trimOut: Number(((clip.trimIn || 0) + firstDuration).toFixed(3)) } : {}),
    };

    const secondClip = {
      ...clip,
      id: `clip-${String(key)[0]}-${Date.now()}`,
      startTime: Number(currentTime.toFixed(3)),
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
  };

  // Request delete clip with confirmation modal
  const handleDeleteClip = (targetId?: string, targetType?: string) => {
    if (!project) return;
    const clipId = targetId || selectedClipId;
    if (!clipId) return;

    let clipType = targetType || selectedClipType;
    let foundTrackKey: keyof typeof project.tracks | null = null;
    let clip: any = null;

    // Search across all tracks to find the exact clip even if trackType is omitted or desynced
    const trackKeys: Array<keyof typeof project.tracks> = ['video', 'audio', 'text', 'stickers', 'effects'];
    if (clipType) {
      const preferredKey = (clipType === 'sticker' || clipType === 'stickers' ? 'stickers' : clipType === 'effect' || clipType === 'effects' ? 'effects' : clipType) as keyof typeof project.tracks;
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
          clipType = k === 'stickers' ? 'sticker' : k === 'effects' ? 'effects' : k;
          break;
        }
      }
    }

    let name = `${(clipType || 'item').charAt(0).toUpperCase() + (clipType || 'item').slice(1)} Clip`;
    if (clip) {
      if (clipType === 'text' && clip.text) {
        name = `"${clip.text.length > 25 ? clip.text.slice(0, 25) + '...' : clip.text}"`;
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
      type: clipType || (foundTrackKey === 'stickers' ? 'sticker' : 'video'),
      name,
      duration: clip?.duration,
    });
  };

  // Perform actual deletion after confirmation
  const handleConfirmDeleteClip = () => {
    if (!project || !clipToDelete) return;
    const { id: clipId, type: clipType } = clipToDelete;

    const trackKeys: Array<keyof typeof project.tracks> = ['video', 'audio', 'text', 'stickers', 'effects'];
    const preferredKey = (clipType === 'sticker' || clipType === 'stickers' ? 'stickers' : clipType === 'effect' || clipType === 'effects' ? 'effects' : clipType) as keyof typeof project.tracks;

    let targetKey = preferredKey;
    if (!((project.tracks[targetKey] as any[]) || []).some((c) => c.id === clipId)) {
      for (const k of trackKeys) {
        if (((project.tracks[k] as any[]) || []).some((c) => c.id === clipId)) {
          targetKey = k;
          break;
        }
      }
    }

    const list = [...((project.tracks[targetKey] as any[]) || [])];
    const filtered = list.filter((c) => c.id !== clipId);

    // Ripple reposition if video track
    if (targetKey === 'video') {
      let t = 0;
      filtered.forEach((c) => {
        c.startTime = t;
        t += c.duration;
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
    soundEngine.playSfx('pop');
    triggerHaptic('warning', settings?.hapticFeedback !== false);
    updateProjectWithHistory(updated);
    setClipToDelete(null);
    deleteMedia(clipId).catch(() => {});
  };

  // Desktop / Laptop Keyboard Shortcuts:
  // Space: Play/Pause, S / Cmd+K: Split, D: Duplicate, Del: Delete, Cmd+Z: Undo, Esc: Deselect/Close, Arrows: Step
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as any).isContentEditable)
      ) {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // 1. Play / Pause with Space
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        soundEngine.playSfx('click');
        if (!isPlaying && (currentTime >= totalDuration - 0.05 || currentTime >= totalDuration)) {
          setCurrentTime(0);
        }
        setIsPlaying((p) => !p);
        return;
      }

      // 2. Undo / Redo
      if (isCmdOrCtrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (isCmdOrCtrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // 3. Split Clip (S or Cmd+K)
      if ((e.key === 's' || e.key === 'S') && !isCmdOrCtrl) {
        if (selectedClipId && route.screen === 'editor' && !activeModal) {
          e.preventDefault();
          soundEngine.playSfx('split');
          handleSplitClip();
        }
        return;
      }
      if (isCmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        if (selectedClipId && route.screen === 'editor' && !activeModal) {
          e.preventDefault();
          soundEngine.playSfx('split');
          handleSplitClip();
        }
        return;
      }

      // 4. Duplicate Clip (D or Cmd+D)
      if ((e.key === 'd' || e.key === 'D') && !e.shiftKey) {
        if (selectedClipId && route.screen === 'editor' && !activeModal) {
          e.preventDefault();
          soundEngine.playSfx('pop');
          handleDuplicateClip();
        }
        return;
      }

      // 5. Delete Clip (Delete or Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId && route.screen === 'editor' && !activeModal && !clipToDelete) {
          e.preventDefault();
          handleDeleteClip();
        }
        return;
      }

      // 6. Escape (Close modal or deselect)
      if (e.key === 'Escape') {
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
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const delta = e.shiftKey ? 1.0 : 1 / 30;
        setCurrentTime((t) => Math.max(0, t - delta));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.shiftKey ? 1.0 : 1 / 30;
        setCurrentTime((t) => Math.min(totalDuration, t + delta));
        return;
      }

      // 8. Zoom in / out (+ / -)
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(120, z + 10));
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(20, z - 10));
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        setZoom(60);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // Duplicate selected clip (video, text, sticker, etc.)
  const handleDuplicateClip = (targetId?: string, targetType?: string) => {
    if (!project) return;
    const clipId = targetId || selectedClipId;
    const clipType = targetType || selectedClipType;
    if (!clipId) return;

    const key = (clipType === 'sticker' || clipType === 'stickers' ? 'stickers' : clipType) as keyof typeof project.tracks;
    const list = [...((project.tracks[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === clipId);
    if (idx === -1) return;

    const original = list[idx];
    const clone = {
      ...JSON.parse(JSON.stringify(original)),
      id: `clip-${clipType[0]}-${Date.now()}`,
      startTime: original.startTime + 0.2,
      position: original.position
        ? {
            x: Math.min(85, (original.position.x || 50) + 5),
            y: Math.min(85, (original.position.y || 50) + 5),
          }
        : undefined,
    };

    if (clipType === 'video') {
      clone.startTime = original.startTime + original.duration;
      list.splice(idx + 1, 0, clone);
      let t = 0;
      list.forEach((c) => {
        c.startTime = t;
        t += c.duration;
      });
    } else {
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
  };

  // Direct on-canvas transform update (move with hand, resize, rotate)
  const handleUpdateClipTransform = (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal: boolean = true
  ) => {
    if (!project) return;
    const key = (clipType === 'sticker' || clipType === 'stickers' ? 'stickers' : clipType) as keyof typeof project.tracks;
    const list = [...((project.tracks[key] as any[]) || [])];
    const idx = list.findIndex((c) => c.id === clipId);
    if (idx < 0) return;

    if (clipType === 'video' || clipType === 'photo') {
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
      ...project,
      tracks: { ...project.tracks, [key]: list } as any,
    };

    if (isFinal) {
      updateProjectWithHistory(updated);
    } else {
      setProject(updated);
    }
  };

  // Update text clip from modal
  const handleUpdateText = (updatedClip: TextClip) => {
    if (!project) return;
    const list = [...(project.tracks.text || [])];
    const idx = list.findIndex((c) => c.id === updatedClip.id);
    if (idx >= 0) {
      list[idx] = updatedClip;
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, text: list },
      });
    }
  };

  // Update sticker clip from modal
  const handleUpdateSticker = (updatedClip: StickerClip) => {
    if (!project) return;
    const list = [...(project.tracks.stickers || [])];
    const idx = list.findIndex((c) => c.id === updatedClip.id);
    if (idx >= 0) {
      list[idx] = updatedClip;
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, stickers: list },
      });
    }
  };

  // Rotate clip 90 degrees
  const handleRotateClip = () => {
    if (!project || !selectedClip) return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const currentTransform = videoClips[idx].transform || { scale: 1, rotation: 0, x: 0, y: 0 };
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
  };

  // Add new media clip
  const handleAddMedia = (newClip: any) => {
    if (!project) return;
    const videoClips = [...(project.tracks.video || [])];
    const endingIdx = videoClips.findIndex((c) => (c as any).isEnding);

    if (endingIdx >= 0) {
      // Keep ending outro clip at the very end
      const endingClip = videoClips[endingIdx];
      videoClips.splice(endingIdx, 1);
      const lastClip = videoClips[videoClips.length - 1];
      newClip.startTime = lastClip ? lastClip.startTime + lastClip.duration : 0;
      videoClips.push(newClip);
      endingClip.startTime = newClip.startTime + newClip.duration;
      videoClips.push(endingClip);
    } else {
      const lastClip = videoClips[videoClips.length - 1];
      const start = lastClip ? lastClip.startTime + lastClip.duration : 0;
      newClip.startTime = start;
      videoClips.push(newClip);
    }

    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, video: videoClips },
    });
  };

  // Add text overlay
  const handleAddText = (newTextClip) => {
    if (!project) return;
    newTextClip.startTime = currentTime;
    const textClips = [...(project.tracks.text || []), newTextClip];
    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, text: textClips },
    });
  };

  // Add audio clip
  const handleAddAudio = (newAudioClip) => {
    if (!project) return;
    newAudioClip.startTime = currentTime;
    const audioClips = [...(project.tracks.audio || []), newAudioClip];
    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, audio: audioClips },
    });
  };

  // Add sticker overlay
  const handleAddSticker = (newStickerClip) => {
    if (!project) return;
    newStickerClip.startTime = currentTime;
    const stickerClips = [...(project.tracks.stickers || []), newStickerClip];
    updateProjectWithHistory({
      ...project,
      tracks: { ...project.tracks, stickers: stickerClips },
    });
  };

  // Add effect
  const handleAddEffect = (preset) => {
    if (!project) return;
    if (selectedClip && selectedClipType === 'video') {
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
      const newEff = {
        id: 'eff-' + Date.now(),
        type: preset.type,
        name: preset.name,
        startTime: currentTime,
        duration: 3.0,
        intensity: preset.intensity || 0.8,
      };
      const effectClips = [...(project.tracks.effects || []), newEff];
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
    if (selectedClip && selectedClipType === 'video') {
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
    if (selectedClipType === 'text') {
      const textClips = [...(project.tracks.text || [])];
      const idx = textClips.findIndex((t) => t.id === selectedClipId);
      if (idx >= 0) {
        textClips[idx] = { ...textClips[idx], motionTrack: motionConfig };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, text: textClips },
        });
      }
    } else if (selectedClipType === 'stickers' || selectedClipType === 'sticker') {
      const stickerClips = [...(project.tracks.stickers || [])];
      const idx = stickerClips.findIndex((s) => s.id === selectedClipId);
      if (idx >= 0) {
        stickerClips[idx] = { ...stickerClips[idx], motionTrack: motionConfig };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, stickers: stickerClips },
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
    smoothSlowMo?: 'none' | 'blend' | 'optical_flow'
  ) => {
    if (!project || !selectedClip) return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      videoClips[idx] = {
        ...videoClips[idx],
        speed: speedVal,
        speedCurve: curve ? (curve.points || curve) : null,
        smoothSlowMo: smoothSlowMo || 'none',
      };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    }
  };

  // Add Keyframe to active clip
  const handleAddKeyframe = () => {
    if (!selectedClip) return;
    soundEngine.playSfx('pop');
    // Toggle keyframe stamp
    const keyframes = selectedClip.keyframes || [];
    const localTime = currentTime - selectedClip.startTime;
    const exists = keyframes.some((k) => Math.abs(k.time - localTime) < 0.1);

    let updatedKf = [];
    if (exists) {
      updatedKf = keyframes.filter((k) => Math.abs(k.time - localTime) >= 0.1);
    } else {
      updatedKf = [
        ...keyframes,
        {
          time: localTime,
          transform: { ...(selectedClip.transform || { scale: 1, rotation: 0, x: 0, y: 0 }) },
          opacity: 1.0,
        },
      ];
    }

    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      videoClips[idx] = { ...videoClips[idx], keyframes: updatedKf };
      updateProjectWithHistory({
        ...project,
        tracks: { ...project.tracks, video: videoClips },
      });
    }
  };

  // Project Management Handlers (Home Screen)
  const handleOpenProject = (id: string) => {
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
      n.id === notification.id ? { ...n, unread: false } : n
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
    newProj.aspectRatio = settings?.defaultAspectRatio || '9:16';
    newProj.resolution = settings?.defaultResolution || '1080p';
    newProj.fps = settings?.defaultFps || 30;

    // Apply Auto Add Default Ending setting
    if (settings?.autoAddEnding) {
      newProj.tracks.video = [
        {
          id: 'clip-outro-' + Date.now(),
          title: 'FastArt Outro',
          type: 'video',
          url: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-code-31910-large.mp4',
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
          id: 'text-outro-' + Date.now(),
          text: 'FAST★ART',
          startTime: 0.2,
          duration: 2.1,
          style: {
            fontSize: 34,
            color: '#00F2FE',
            fontFamily: 'system-ui',
            textAlign: 'center',
            fontWeight: 'bold',
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
      title: 'Project Created',
      message: `"${newProj.title}" is ready for editing.`,
      projectId: newProj.id,
      projectTitle: newProj.title,
      actionText: 'Open in Editor',
      icon: 'film-outline',
    });
  };

  const handleDuplicateProject = (id: string) => {
    const found = projects.find((p) => p.id === id);
    if (found) {
      const clone = {
        ...JSON.parse(JSON.stringify(found)),
        id: 'proj-' + Date.now(),
        title: `${found.title} (Copy)`,
        updatedAt: Date.now(),
      };
      saveProject(clone);
      setProjects((prev) => [clone, ...prev]);

      addNotification({
        title: 'Project Duplicated',
        message: `Created duplicate "${clone.title}".`,
        projectId: clone.id,
        projectTitle: clone.title,
        actionText: 'Open Project',
        icon: 'copy-outline',
      });
    }
  };

  const handleDeleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    const updated = deleteProject(id);
    setProjects(updated);
    if (project?.id === id) {
      if (updated.length > 0) {
        setProject(updated[0]);
        navigate(`/project/${updated[0].id}`, { replace: true });
      } else {
        setProject(null);
        navigate('/', { replace: true });
      }
    }

    // Clean up project media from IndexedDB
    if (target && target.tracks) {
      const clipIds = [
        ...(target.tracks.video || []).map((v: any) => v.id),
        ...(target.tracks.audio || []).map((a: any) => a.id),
      ];
      clipIds.forEach((cid) => deleteMedia(cid).catch(() => {}));
    }

    addNotification({
      title: 'Project Deleted',
      message: `"${target?.title || 'Project'}" was removed.`,
      icon: 'trash-outline',
    });
  };

  const handleRenameProject = (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const updated = projects.map((p) => (p.id === id ? { ...p, title: trimmed } : p));
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
    const list = [...(project.tracks[selectedClipType as keyof typeof project.tracks] || [])];
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

  // Apply Transform, Mask, Crop & Canvas Ratio
  const handleApplyTransform = (
    t: ClipTransform,
    newAspectRatio?: AspectRatio,
    newMask?: MaskConfig,
    newCrop?: CustomCrop
  ) => {
    if (!project) return;
    let updated: any = { ...project };
    if (newAspectRatio && newAspectRatio !== project.aspectRatio) {
      updated.aspectRatio = newAspectRatio;
    }
    if (selectedClip && selectedClipType === 'video') {
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx >= 0) {
        const finalMask = newMask !== undefined ? newMask : t.mask !== undefined ? t.mask : videoClips[idx].mask;
        const finalCrop = newCrop !== undefined ? newCrop : t.crop !== undefined ? t.crop : videoClips[idx].crop;
        videoClips[idx] = {
          ...videoClips[idx],
          transform: {
            ...(videoClips[idx].transform || {}),
            ...t,
            mask: finalMask,
            crop: finalCrop,
          },
          mask: finalMask,
          crop: finalCrop,
        };
        updated.tracks = { ...project.tracks, video: videoClips };
      }
    }
    updateProjectWithHistory(updated);
  };

  // Toggle Reverse
  const handleToggleReverse = () => {
    if (!project || !selectedClip || selectedClipType !== 'video') return;
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
  };

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
    navigate(`/project/${newProj.id}`);
  };

  // Live Camera Recording Added
  const handleAddRecordedClip = (newClip: VideoClip) => {
    if (!project) {
      const newProj = createDefaultProject('Camera Recording Project');
      newClip.startTime = 0;
      newProj.tracks.video = [newClip];
      saveProject(newProj);
      setProjects((prev: any) => [newProj, ...prev]);
      setProject(newProj);
      navigate(`/project/${newProj.id}`);
    } else {
      handleAddMedia(newClip);
      navigate(`/project/${project.id}`);
    }
  };

  // Draggable Trim Clip for Video, Audio, and Text
  const handleTrimClip = (
    clipId: string,
    updates: { startTime?: number; duration?: number; trimIn?: number; trimOut?: number; trackIndex?: number },
    isFinal: boolean = true
  ) => {
    if (!project) return;
    const tracks = { ...project.tracks };

    let found = false;
    // Check video clips
    if (tracks.video) {
      const idx = tracks.video.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        tracks.video[idx] = { ...tracks.video[idx], ...updates };
        found = true;
      }
    }
    // Check audio clips
    if (!found && tracks.audio) {
      const idx = tracks.audio.findIndex((c) => c.id === clipId);
      if (idx >= 0) {
        tracks.audio[idx] = { ...tracks.audio[idx], ...updates };
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
    trackType: 'video' | 'audio' | 'text' | 'sticker' | 'effects',
    newStartTime: number,
    newTrackIndex?: number
  ) => {
    if (!project) return;
    const tracks = { ...project.tracks };

    const updateItem = (c: any) =>
      c.id === clipId
        ? {
            ...c,
            startTime: newStartTime,
            ...(typeof newTrackIndex === 'number' ? { trackIndex: newTrackIndex } : {}),
          }
        : c;

    if (trackType === 'video' && tracks.video) {
      tracks.video = tracks.video.map(updateItem);
    } else if (trackType === 'audio' && tracks.audio) {
      tracks.audio = tracks.audio.map(updateItem);
    } else if (trackType === 'text' && tracks.text) {
      tracks.text = tracks.text.map(updateItem);
    } else if (trackType === 'sticker' && tracks.stickers) {
      tracks.stickers = tracks.stickers.map(updateItem);
    } else if (trackType === 'effects' && tracks.effects) {
      tracks.effects = tracks.effects.map(updateItem);
    }

    updateProjectWithHistory({ ...project, tracks });
  };

  return (
    <View style={styles.rootWrapper}>
      <StatusBar barStyle="light-content" />
      <View style={styles.rootContainer}>

      {/* 1. HOME DASHBOARD SCREEN (URL: / or /home) */}
      {route.screen === 'home' && (
        <HomeDashboard
          projects={projects}
          onOpenProject={handleOpenProject}
          onCreateNewProject={handleCreateNewProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={handleRenameProject}
          onOpenSettings={() => navigate('/settings')}
          onOpenNotifications={() => navigate('/notifications')}
          unreadNotificationsCount={notifications.filter((n) => n.unread).length}
          lastSession={lastSession}
        />
      )}

      {/* 2. DEDICATED SETTINGS SCREEN (URL: /settings) */}
      {route.screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onBack={() => {
            navigate('/');
          }}
          onReloadData={handleReloadAllData}
        />
      )}

      {/* 3. DEDICATED NOTIFICATIONS SCREEN (URL: /notifications) */}
      {route.screen === 'notifications' && (
        <NotificationsScreen
          notifications={notifications}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClearAll={handleClearAllNotifications}
          onDeleteNotification={handleDeleteNotification}
          onActionClick={handleNotificationAction}
          onBack={() => {
            navigate('/');
          }}
        />
      )}

      {/* 4. PROJECT NOT FOUND SCREEN (URL: /project/:invalidKey) */}
      {route.screen === 'editor' && !project && (
        <ProjectNotFoundScreen
          projectKey={route.projectKey || ''}
          onGoHome={() => navigate('/')}
          onCreateNew={handleCreateNewProject}
          onOpenDefault={projects.length > 0 ? () => navigate(`/project/${projects[0].id}`) : undefined}
        />
      )}

      {/* 5. FULL VIDEO EDITOR SUITE (URL: /project/:key) */}
      {(route.screen === 'editor' || route.screen === 'export') && project && (
        <View style={styles.editorContainer}>
          {/* Top Header Bar */}
          {!isFullscreen && (
            <Header
              project={project}
              onUpdateProject={(updates) => updateProjectWithHistory({ ...project, ...updates })}
              onBackToHome={() => {
                soundEngine.playSfx('click');
                setIsPlaying(false);
                navigate('/');
              }}
              canUndo={historyStack.length > 0}
              canRedo={redoStack.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onOpenExport={() => openModal('export')}
            />
          )}

          {/* Canvas Viewport & Player Controls in Flex-1 Center Stage */}
          <View style={[styles.playerStage, isFullscreen && styles.playerStageFullscreen]}>
            <Player
              project={project}
              currentTime={currentTime}
              isPlaying={isPlaying}
              totalDuration={totalDuration}
              fullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
              onTogglePlay={() => {
                soundEngine.playSfx('click');
                if (!isPlaying && (currentTime >= totalDuration - 0.05 || currentTime >= totalDuration)) {
                  setCurrentTime(0);
                }
                setIsPlaying(!isPlaying);
              }}
              onSeek={(t) => setCurrentTime(t)}
              onAddKeyframe={handleAddKeyframe}
              hasKeyframeAtCurrentTime={
                selectedClip?.keyframes?.some(
                  (k: any) => Math.abs(k.time - (currentTime - selectedClip.startTime)) < 0.1
                ) || false
              }
              onOpenMediaPicker={() => openModal('media')}
              selectedClipId={selectedClipId}
              selectedClipType={selectedClipType}
              onSelectClip={(id, type) => {
                setSelectedClipId(id);
                if (type) setSelectedClipType(type);
              }}
              onUpdateClipTransform={handleUpdateClipTransform}
              onOpenEditModal={(clipId, clipType) => {
                setSelectedClipId(clipId);
                setSelectedClipType(clipType);
                openModal(clipType === 'text' ? 'text' : clipType === 'stickers' || clipType === 'sticker' ? 'stickers' : 'crop');
              }}
              onOpenCropModal={(clipId) => {
                setSelectedClipId(clipId);
                setSelectedClipType('video');
                openModal('crop');
              }}
              onOpenMaskModal={(clipId) => {
                setSelectedClipId(clipId);
                setSelectedClipType('video');
                openModal('mask');
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
                setSelectedClipType(type);
              }}
              onTrimClip={handleTrimClip}
              onMoveClip={handleMoveClip}
              onOpenTransitions={(clipId) => {
                setTransitionTargetClipId(clipId);
                openModal('transitions');
              }}
              onOpenMediaPicker={() => openModal('media')}
              onOpenTextModal={() => openModal('text')}
              onOpenAudioModal={() => openModal('audio')}
              onOpenEffectsModal={() => openModal('effects')}
              onOpenStickersModal={() => openModal('stickers')}
              zoom={zoom}
              onZoomChange={setZoom}
              onUpdateProject={(updates) => updateProjectWithHistory({ ...project, ...updates })}
              onAdjustDuration={(delta) => {
                if (!project || !selectedClipId) return;
                const key = selectedClipType === 'sticker' ? 'stickers' : selectedClipType;
                const list = [...((project.tracks as any)[key] || [])];
                const idx = list.findIndex((c: any) => c.id === selectedClipId);
                if (idx >= 0) {
                  const newDur = Math.max(0.05, (list[idx].duration || 0) + delta);
                  list[idx] = { ...list[idx], duration: Number(newDur.toFixed(3)) };
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
                setSelectedClipType(clipType);
                if (clipType === 'text') openModal('text');
                else if (clipType === 'sticker' || clipType === 'stickers') openModal('stickers');
                else if (clipType === 'audio') openModal('volume');
                else if (clipType === 'effects' || clipType === 'effect') openModal('effects');
                else openModal('crop');
              }}
              settings={settings}
            />

            <Toolbar
              selectedClip={selectedClip}
              selectedClipType={selectedClipType}
              onDeselectClip={() => setSelectedClipId(null)}
              onSplitClip={handleSplitClip}
              onDeleteClip={handleDeleteClip}
              onDuplicateClip={handleDuplicateClip}
              onRotateClip={handleRotateClip}
              onToggleReverse={handleToggleReverse}
              onOpenSpeedModal={() => openModal('speed')}
              onOpenVolumeModal={() => openModal('volume')}
              onOpenCropModal={() => openModal('crop')}
              onOpenMaskModal={() => openModal('mask')}
              onOpenAudioModal={() => openModal('audio')}
              onOpenTextModal={() => openModal('text')}
              onOpenFiltersModal={() => openModal('filters')}
              onOpenEffectsModal={() => openModal('effects')}
              onOpenStickersModal={() => openModal('stickers')}
              onOpenMediaPicker={() => openModal('media')}
              onOpenTTS={() => openModal('tts')}
              onOpenCamera={() => openModal('camera')}
              onOpenEnhance={() => openModal('enhance')}
              onOpenAutoCut={() => openModal('autocut')}
              onOpenCutoutModal={() => openModal('cutout')}
              onOpenMotionTracking={() => openModal('tracking')}
            />
          </View>
          )}
        </View>
      )}

      {/* MODALS */}
      <MediaPickerModal
        visible={activeModal === 'media'}
        onClose={closeModal}
        onAddMedia={handleAddMedia}
      />

      <CutoutModal
        visible={activeModal === 'cutout'}
        onClose={closeModal}
        currentCutout={selectedClip?.cutout}
        onApplyCutout={handleApplyCutout}
      />

      <MotionTrackingModal
        visible={activeModal === 'tracking'}
        onClose={closeModal}
        targetType={
          selectedClipType === 'text'
            ? 'text'
            : selectedClipType === 'stickers' || selectedClipType === 'sticker'
            ? 'sticker'
            : 'video'
        }
        currentTrack={selectedClip?.motionTrack}
        onApplyTracking={handleApplyMotionTracking}
      />

      <TextModal
        visible={activeModal === 'text'}
        onClose={closeModal}
        onAddText={handleAddText}
        editingClip={selectedClipType === 'text' ? (selectedClip as TextClip) : null}
        onUpdateText={handleUpdateText}
        currentPlayheadTime={currentTime}
      />

      <AudioModal
        visible={activeModal === 'audio'}
        onClose={closeModal}
        onAddAudio={handleAddAudio}
      />

      <FiltersModal
        visible={activeModal === 'filters'}
        onClose={closeModal}
        activeFilter={selectedClip?.filter || 'normal'}
        onSelectFilter={handleApplyFilter}
      />

      <EffectsModal
        visible={activeModal === 'effects'}
        onClose={closeModal}
        activeEffect={selectedClip?.effect || 'none'}
        onAddEffect={handleAddEffect}
      />

      <StickersModal
        visible={activeModal === 'stickers'}
        onClose={closeModal}
        onAddSticker={handleAddSticker}
        editingClip={
          selectedClipType === 'stickers' || selectedClipType === 'sticker'
            ? (selectedClip as StickerClip)
            : null
        }
        onUpdateSticker={handleUpdateSticker}
        currentPlayheadTime={currentTime}
      />

      <TransitionsModal
        visible={activeModal === 'transitions'}
        onClose={closeModal}
        activeTransition={
          project?.tracks?.video?.find((c) => c.id === transitionTargetClipId)?.transition
        }
        onApplyTransition={handleApplyTransition}
      />

      <SpeedModal
        visible={activeModal === 'speed'}
        onClose={closeModal}
        currentSpeed={selectedClip?.speed || 1.0}
        currentCurve={selectedClip?.speedCurve}
        currentSlowMo={selectedClip?.smoothSlowMo}
        onApplySpeed={handleApplySpeed}
      />

      {project && (
        <ExportModal
          visible={activeModal === 'export' || route.screen === 'export'}
          onClose={closeModal}
          project={project}
          totalDuration={totalDuration}
        />
      )}

      <SettingsModal
        visible={activeModal === 'settings'}
        onClose={closeModal}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onReloadData={handleReloadAllData}
      />

      <NotificationsModal
        visible={activeModal === 'notifications'}
        onClose={closeModal}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAllNotifications}
        onDeleteNotification={handleDeleteNotification}
        onActionClick={handleNotificationAction}
      />

      <VolumeModal
        visible={activeModal === 'volume'}
        onClose={closeModal}
        currentVolume={selectedClip?.volume ?? 1.0}
        currentFadeIn={selectedClip?.fadeIn ?? 0}
        currentFadeOut={selectedClip?.fadeOut ?? 0}
        onApplyVolume={handleApplyVolume}
      />

      <CropTransformModal
        visible={activeModal === 'crop' || activeModal === 'mask'}
        onClose={closeModal}
        currentTransform={selectedClip?.transform}
        currentAspectRatio={project?.aspectRatio || '9:16'}
        currentMask={selectedClip?.mask || selectedClip?.transform?.mask}
        currentCrop={selectedClip?.crop || selectedClip?.transform?.crop}
        initialTab={activeModal === 'mask' ? 'mask' : 'crop'}
        onApplyTransform={handleApplyTransform}
      />

      <CameraModal
        visible={activeModal === 'camera'}
        onClose={closeModal}
        onAddRecordedClip={handleAddRecordedClip}
      />

      <AutoCutModal
        visible={activeModal === 'autocut'}
        onClose={closeModal}
        onAutoCutGenerated={handleAutoCutGenerated}
      />

      <AIEnhanceModal
        visible={activeModal === 'enhance'}
        onClose={closeModal}
        onApplyEnhance={handleApplyEnhance}
      />

      <TextToSpeechModal
        visible={activeModal === 'tts'}
        onClose={closeModal}
        onAddAudio={handleAddAudio}
        initialScript={selectedClipType === 'text' && selectedClip ? (selectedClip as TextClip).text : undefined}
      />

      {/* Clip Deletion Confirmation Modal */}
      <ConfirmDeleteModal
        visible={!!clipToDelete}
        title="Delete Clip?"
        message="Are you sure you want to delete this clip from the timeline?"
        itemName={clipToDelete?.name}
        itemType={clipToDelete?.type}
        itemDetails={clipToDelete?.duration ? `Duration: ${clipToDelete.duration.toFixed(1)}s` : undefined}
        confirmText="Delete Clip"
        cancelText="Cancel"
        onConfirm={handleConfirmDeleteClip}
        onCancel={() => setClipToDelete(null)}
      />
    </View>
    </View>
  );
}

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: '#0B0D13',
    paddingTop: STATUS_BAR_HEIGHT,
  },
  rootContainer: {
    flex: 1,
    backgroundColor: '#0B0D13',
    overflow: 'hidden' as any,
  },
  editorContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#0B0D13',
    overflow: 'hidden' as any,
  },
  playerStage: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden' as any,
  },
  playerStageFullscreen: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  bottomDock: {
    width: '100%',
    flexShrink: 0,
    backgroundColor: '#0E1118',
  },
});
