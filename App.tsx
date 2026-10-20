import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
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

import {
  FastArtProject,
  VideoClip,
  AudioClip,
  ClipTransform,
  AspectRatio,
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
} from './src/utils/storage';
import { soundEngine } from './src/utils/audioEngine';

export default function App() {
  const { route, navigate, goBack } = useAppRouter();
  const screen = route.screen;
  const setScreen = (s: string) => {
    if (s === 'home') navigate('/');
    else if (s === 'editor' && project) navigate(`/project/${project.id}`);
    else navigate(`/${s}`);
  };
  const [projects, setProjects] = useState<FastArtProject[]>([]);
  const [project, setProject] = useState<FastArtProject | null>(null);
  const [settings, setSettings] = useState(loadSettings());
  const [notifications, setNotifications] = useState(loadNotifications());

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipType, setSelectedClipType] = useState<string>('video');
  const [zoom, setZoom] = useState(60);

  // History state (Undo / Redo)
  const [historyStack, setHistoryStack] = useState<FastArtProject[]>([]);
  const [redoStack, setRedoStack] = useState<FastArtProject[]>([]);

  // Active modal sheets
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [transitionTargetClipId, setTransitionTargetClipId] = useState<string | null>(null);

  const animFrameRef = useRef<any>(null);
  const lastTimeRef = useRef<any>(null);

  // Load projects on startup
  useEffect(() => {
    const projs = loadAllProjects();
    setProjects(projs);
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
          setCurrentTime(0);
          setIsPlaying(false);
          setSelectedClipId(null);
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
    }
  }, [route.screen, route.projectKey, route.tool, projects]);

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

  // Push state to undo stack
  const updateProjectWithHistory = (updatedProject) => {
    setHistoryStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(project))]);
    setRedoStack([]);
    setProject(updatedProject);
    saveProject(updatedProject);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, JSON.parse(JSON.stringify(project))]);
    setProject(prev);
    soundEngine.playSfx('click');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setHistoryStack((s) => [...s, JSON.parse(JSON.stringify(project))]);
    setProject(next);
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
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const clip = videoClips[idx];
    const clipStart = clip.startTime;
    const clipEnd = clip.startTime + clip.duration;

    // Check if playhead is within clip boundaries
    if (currentTime <= clipStart + 0.2 || currentTime >= clipEnd - 0.2) return;

    const firstDuration = currentTime - clipStart;
    const secondDuration = clipEnd - currentTime;

    const firstClip = {
      ...clip,
      duration: firstDuration,
      trimOut: (clip.trimIn || 0) + firstDuration,
    };

    const secondClip = {
      ...clip,
      id: 'clip-v-' + Date.now(),
      startTime: currentTime,
      duration: secondDuration,
      trimIn: (clip.trimIn || 0) + firstDuration,
      trimOut: clip.trimOut,
    };

    videoClips.splice(idx, 1, firstClip, secondClip);

    const updated = {
      ...project,
      tracks: {
        ...project.tracks,
        video: videoClips,
      },
    };
    setSelectedClipId(secondClip.id);
    updateProjectWithHistory(updated);
  };

  // Delete selected clip
  const handleDeleteClip = () => {
    if (!project || !selectedClipId) return;
    const list = [...(project.tracks[selectedClipType] || [])];
    const filtered = list.filter((c) => c.id !== selectedClipId);

    // Ripple reposition if video track
    if (selectedClipType === 'video') {
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
        [selectedClipType]: filtered,
      },
    };
    setSelectedClipId(null);
    updateProjectWithHistory(updated);
  };

  // Duplicate selected clip
  const handleDuplicateClip = () => {
    if (!project || !selectedClip) return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx === -1) return;

    const original = videoClips[idx];
    const clone = {
      ...JSON.parse(JSON.stringify(original)),
      id: 'clip-v-' + Date.now(),
      startTime: original.startTime + original.duration,
    };

    videoClips.splice(idx + 1, 0, clone);

    // Recalculate start times for subsequent clips
    let t = 0;
    videoClips.forEach((c) => {
      c.startTime = t;
      t += c.duration;
    });

    const updated = {
      ...project,
      tracks: {
        ...project.tracks,
        video: videoClips,
      },
    };
    setSelectedClipId(clone.id);
    updateProjectWithHistory(updated);
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
  const handleAddMedia = (newClip) => {
    if (!project) return;
    const videoClips = [...(project.tracks.video || [])];
    const lastClip = videoClips[videoClips.length - 1];
    const start = lastClip ? lastClip.startTime + lastClip.duration : 0;
    newClip.startTime = start;
    videoClips.push(newClip);

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

  // Apply color filter
  const handleApplyFilter = (filterId) => {
    if (!project) return;
    if (selectedClip && selectedClipType === 'video') {
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx >= 0) {
        videoClips[idx] = { ...videoClips[idx], filter: filterId };
        updateProjectWithHistory({
          ...project,
          tracks: { ...project.tracks, video: videoClips },
        });
      }
    }
    setActiveModal(null);
  };

  // Apply transition
  const handleApplyTransition = (trans) => {
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

  // Apply speed change
  const handleApplySpeed = (speedVal, curve) => {
    if (!project || !selectedClip) return;
    const videoClips = [...(project.tracks.video || [])];
    const idx = videoClips.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0) {
      videoClips[idx] = {
        ...videoClips[idx],
        speed: speedVal,
        speedCurve: curve ? curve.points : null,
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
    setSettings(newSettings);
    saveSettings(newSettings);
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

  const handleCreateNewProject = () => {
    const newProj = createDefaultProject(`Project ${projects.length + 1}`);
    newProj.aspectRatio = settings?.defaultAspectRatio || '9:16';
    newProj.resolution = settings?.defaultResolution || '1080p';
    newProj.fps = settings?.defaultFps || 30;
    saveProject(newProj);
    setProjects((prev) => [newProj, ...prev]);
    setProject(newProj);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedClipId(null);
    navigate(`/project/${newProj.id}`);
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
    }
  };

  const handleDeleteProject = (id: string) => {
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

  // Apply Transform & Canvas Ratio
  const handleApplyTransform = (t: ClipTransform, newAspectRatio?: AspectRatio) => {
    if (!project) return;
    let updated: any = { ...project };
    if (newAspectRatio && newAspectRatio !== project.aspectRatio) {
      updated.aspectRatio = newAspectRatio;
    }
    if (selectedClip && selectedClipType === 'video') {
      const videoClips = [...(project.tracks.video || [])];
      const idx = videoClips.findIndex((c) => c.id === selectedClipId);
      if (idx >= 0) {
        videoClips[idx] = {
          ...videoClips[idx],
          transform: { ...(videoClips[idx].transform || {}), ...t },
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
    updates: { startTime?: number; duration?: number; trimIn?: number; trimOut?: number }
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

    updateProjectWithHistory({ ...project, tracks });
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
      <SafeAreaView style={styles.rootContainer}>

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
        />
      )}

      {/* 3. DEDICATED NOTIFICATIONS SCREEN (URL: /notifications) */}
      {route.screen === 'notifications' && (
        <NotificationsScreen
          notifications={notifications}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClearAll={handleClearAllNotifications}
          onActionClick={() => handleCreateNewProject()}
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

          {/* Canvas Viewport & Player Controls in Flex-1 Center Stage */}
          <View style={styles.playerStage}>
            <Player
              project={project}
              currentTime={currentTime}
              isPlaying={isPlaying}
              totalDuration={totalDuration}
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
            />
          </View>

          {/* Bottom Docked Section: Timeline and Editing Options Toolbar */}
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
            />

            <Toolbar
              selectedClip={selectedClip}
              onDeselectClip={() => setSelectedClipId(null)}
              onSplitClip={handleSplitClip}
              onDeleteClip={handleDeleteClip}
              onDuplicateClip={handleDuplicateClip}
              onRotateClip={handleRotateClip}
              onToggleReverse={handleToggleReverse}
              onOpenSpeedModal={() => openModal('speed')}
              onOpenVolumeModal={() => openModal('volume')}
              onOpenCropModal={() => openModal('crop')}
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
            />
          </View>
        </View>
      )}

      {/* MODALS */}
      <MediaPickerModal
        visible={activeModal === 'media'}
        onClose={closeModal}
        onAddMedia={handleAddMedia}
      />

      <TextModal
        visible={activeModal === 'text'}
        onClose={closeModal}
        onAddText={handleAddText}
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
      />

      <NotificationsModal
        visible={activeModal === 'notifications'}
        onClose={closeModal}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAllNotifications}
        onActionClick={() => handleCreateNewProject()}
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
        visible={activeModal === 'crop'}
        onClose={closeModal}
        currentTransform={selectedClip?.transform}
        currentAspectRatio={project?.aspectRatio || '9:16'}
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
      />
    </SafeAreaView>
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
  bottomDock: {
    width: '100%',
    flexShrink: 0,
    backgroundColor: '#0E1118',
  },
});
