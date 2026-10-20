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

import { createDefaultProject, computeTotalDuration } from './src/types/project';
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
  const [screen, setScreen] = useState('home'); // 'home' | 'editor'
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [settings, setSettings] = useState(loadSettings());
  const [notifications, setNotifications] = useState(loadNotifications());

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [selectedClipType, setSelectedClipType] = useState('video');
  const [zoom, setZoom] = useState(60);

  // History state (Undo / Redo)
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Active modal sheets
  const [activeModal, setActiveModal] = useState(null);
  const [transitionTargetClipId, setTransitionTargetClipId] = useState(null);

  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Load projects on startup
  useEffect(() => {
    const projs = loadAllProjects();
    setProjects(projs);
    if (projs.length > 0) {
      setProject(projs[0]);
    }
  }, []);

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

    const currentRotation = videoClips[idx].transform?.rotation || 0;
    videoClips[idx] = {
      ...videoClips[idx],
      transform: {
        ...(videoClips[idx].transform || {}),
        rotation: (currentRotation + 90) % 360,
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
  const handleOpenProject = (id) => {
    const found = projects.find((p) => p.id === id);
    if (found) {
      setProject(found);
      setCurrentTime(0);
      setIsPlaying(false);
      setSelectedClipId(null);
      setScreen('editor');
    }
  };

  const handleUpdateSettings = (newSettings) => {
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
    setScreen('editor');
  };

  const handleDuplicateProject = (id) => {
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

  const handleDeleteProject = (id) => {
    const updated = deleteProject(id);
    setProjects(updated);
    if (project?.id === id) {
      setProject(updated[0] || null);
    }
  };

  return (
    <SafeAreaView style={styles.rootContainer}>
      <StatusBar barStyle="light-content" />

      {/* 1. HOME DASHBOARD SCREEN */}
      {screen === 'home' && (
        <HomeDashboard
          projects={projects}
          onOpenProject={handleOpenProject}
          onCreateNewProject={handleCreateNewProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onOpenSettings={() => setActiveModal('settings')}
          onOpenNotifications={() => setActiveModal('notifications')}
          unreadNotificationsCount={notifications.filter((n) => n.unread).length}
        />
      )}

      {/* 2. FULL CAPCUT EDITOR SUITE */}
      {screen === 'editor' && project && (
        <View style={styles.editorContainer}>
          {/* Top Header Bar */}
          <Header
            project={project}
            onUpdateProject={(updates) => updateProjectWithHistory({ ...project, ...updates })}
            onBackToHome={() => {
              soundEngine.playSfx('click');
              setIsPlaying(false);
              setScreen('home');
            }}
            canUndo={historyStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onOpenExport={() => setActiveModal('export')}
          />

          {/* Canvas Viewport & Player Controls */}
          <Player
            project={project}
            currentTime={currentTime}
            isPlaying={isPlaying}
            totalDuration={totalDuration}
            onTogglePlay={() => {
              soundEngine.playSfx('click');
              setIsPlaying(!isPlaying);
            }}
            onSeek={(t) => setCurrentTime(t)}
            onAddKeyframe={handleAddKeyframe}
            hasKeyframeAtCurrentTime={
              selectedClip?.keyframes?.some(
                (k) => Math.abs(k.time - (currentTime - selectedClip.startTime)) < 0.1
              ) || false
            }
            onOpenMediaPicker={() => setActiveModal('media')}
          />

          {/* Multi-Track Timeline */}
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
            onOpenTransitions={(clipId) => {
              setTransitionTargetClipId(clipId);
              setActiveModal('transitions');
            }}
            onOpenMediaPicker={() => setActiveModal('media')}
            onOpenTextModal={() => setActiveModal('text')}
            onOpenAudioModal={() => setActiveModal('audio')}
            onOpenEffectsModal={() => setActiveModal('effects')}
            onOpenStickersModal={() => setActiveModal('stickers')}
            zoom={zoom}
            onZoomChange={setZoom}
          />

          {/* Bottom Docked Toolbar */}
          <Toolbar
            selectedClip={selectedClip}
            onDeselectClip={() => setSelectedClipId(null)}
            onSplitClip={handleSplitClip}
            onDeleteClip={handleDeleteClip}
            onDuplicateClip={handleDuplicateClip}
            onRotateClip={handleRotateClip}
            onOpenSpeedModal={() => setActiveModal('speed')}
            onOpenAudioModal={() => setActiveModal('audio')}
            onOpenTextModal={() => setActiveModal('text')}
            onOpenFiltersModal={() => setActiveModal('filters')}
            onOpenEffectsModal={() => setActiveModal('effects')}
            onOpenStickersModal={() => setActiveModal('stickers')}
            onOpenMediaPicker={() => setActiveModal('media')}
          />
        </View>
      )}

      {/* MODALS */}
      <MediaPickerModal
        visible={activeModal === 'media'}
        onClose={() => setActiveModal(null)}
        onAddMedia={handleAddMedia}
      />

      <TextModal
        visible={activeModal === 'text'}
        onClose={() => setActiveModal(null)}
        onAddText={handleAddText}
      />

      <AudioModal
        visible={activeModal === 'audio'}
        onClose={() => setActiveModal(null)}
        onAddAudio={handleAddAudio}
      />

      <FiltersModal
        visible={activeModal === 'filters'}
        onClose={() => setActiveModal(null)}
        activeFilter={selectedClip?.filter || 'normal'}
        onSelectFilter={handleApplyFilter}
      />

      <EffectsModal
        visible={activeModal === 'effects'}
        onClose={() => setActiveModal(null)}
        activeEffect={selectedClip?.effect || 'none'}
        onAddEffect={handleAddEffect}
      />

      <StickersModal
        visible={activeModal === 'stickers'}
        onClose={() => setActiveModal(null)}
        onAddSticker={handleAddSticker}
      />

      <TransitionsModal
        visible={activeModal === 'transitions'}
        onClose={() => setActiveModal(null)}
        activeTransition={
          project?.tracks?.video?.find((c) => c.id === transitionTargetClipId)?.transition
        }
        onApplyTransition={handleApplyTransition}
      />

      <SpeedModal
        visible={activeModal === 'speed'}
        onClose={() => setActiveModal(null)}
        currentSpeed={selectedClip?.speed || 1.0}
        onApplySpeed={handleApplySpeed}
      />

      {project && (
        <ExportModal
          visible={activeModal === 'export'}
          onClose={() => setActiveModal(null)}
          project={project}
          totalDuration={totalDuration}
        />
      )}

      <SettingsModal
        visible={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <NotificationsModal
        visible={activeModal === 'notifications'}
        onClose={() => setActiveModal(null)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAllNotifications}
        onActionClick={() => handleCreateNewProject()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0B0D13',
  },
  editorContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
