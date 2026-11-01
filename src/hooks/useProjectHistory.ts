import { useState, useCallback, useEffect, useRef } from "react";
import { FastArtProject } from "../types/project";
import {
  saveProject,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from "../utils/storage";
import { soundEngine } from "../utils/audioEngine";

// High-performance structured clone of project snapshot without JSON.stringify/parse overhead
export function cloneProjectSnapshot(project: FastArtProject): FastArtProject {
  return {
    ...project,
    captionSettings: project.captionSettings ? { ...project.captionSettings } : undefined,
    customLut: project.customLut ? { ...project.customLut } : undefined,
    beatMarkers: project.beatMarkers ? [...project.beatMarkers] : undefined,
    assets: project.assets ? project.assets.map((a) => ({ ...a })) : [],
    tracks: {
      video: project.tracks?.video ? project.tracks.video.map((c) => ({ ...c })) : [],
      audio: project.tracks?.audio ? project.tracks.audio.map((c) => ({ ...c })) : [],
      text: project.tracks?.text ? project.tracks.text.map((c) => ({ ...c })) : [],
      stickers: project.tracks?.stickers ? project.tracks.stickers.map((c) => ({ ...c })) : [],
      effects: project.tracks?.effects ? project.tracks.effects.map((c) => ({ ...c })) : [],
      captions: project.tracks?.captions ? project.tracks.captions.map((c) => ({ ...c })) : [],
    },
  };
}

function loadStack(key: string): FastArtProject[] {
  try {
    let raw = getStorageItem(key);
    if (!raw && typeof window !== "undefined" && window.sessionStorage) {
      raw = window.sessionStorage.getItem(key);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

// Persist a compact undo slice (latest 3 states) to prevent storage thrashing while retaining recovery
function saveStack(key: string, stack: FastArtProject[]) {
  try {
    if (stack.length === 0) {
      removeStorageItem(key);
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } else {
      const serialized = JSON.stringify(stack.slice(-3));
      setStorageItem(key, serialized);
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(key, serialized);
      }
    }
  } catch {}
}

interface UseProjectHistoryParams {
  projectRef: React.MutableRefObject<FastArtProject | null>;
  setProject: React.Dispatch<React.SetStateAction<FastArtProject | null>>;
  setProjects: React.Dispatch<React.SetStateAction<FastArtProject[]>>;
  projectId?: string;
}

export function useProjectHistory({
  projectRef,
  setProject,
  setProjects,
  projectId,
}: UseProjectHistoryParams) {
  const activeProjectId = projectId || projectRef.current?.id || "";
  const activeProjectRef = useRef(activeProjectId);

  const [historyStack, setHistoryStack] = useState<FastArtProject[]>(() =>
    activeProjectId ? loadStack(`@fastart_hist_${activeProjectId}`) : []
  );
  const [redoStack, setRedoStack] = useState<FastArtProject[]>(() =>
    activeProjectId ? loadStack(`@fastart_redo_${activeProjectId}`) : []
  );

  const pendingSaveTimerRef = useRef<any>(null);
  const pendingHistTimerRef = useRef<any>(null);
  const pendingRedoTimerRef = useRef<any>(null);
  const lastHistoryPushTimeRef = useRef<number>(0);
  const burstSnapshotRef = useRef<FastArtProject | null>(null);

  // Flush pending project save to disk immediately
  const flushPendingSave = useCallback(() => {
    if (pendingSaveTimerRef.current) {
      clearTimeout(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;
    }
    if (projectRef.current) {
      saveProject(projectRef.current);
    }
  }, [projectRef]);

  // Clean up on unmount or beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSave();
    };
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    return () => {
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      flushPendingSave();
    };
  }, [flushPendingSave]);

  // Restore history across project navigation, page reloads, and close/reopen
  useEffect(() => {
    if (!activeProjectId) return;
    activeProjectRef.current = activeProjectId;
    const histKey = `@fastart_hist_${activeProjectId}`;
    const redoKey = `@fastart_redo_${activeProjectId}`;
    const savedHist = loadStack(histKey);
    const savedRedo = loadStack(redoKey);
    setHistoryStack(savedHist);
    setRedoStack(savedRedo);
  }, [activeProjectId]);

  // Persist undo stack to survive refresh, close, and reopen (debounced to avoid serializing during slider drags)
  useEffect(() => {
    if (!activeProjectId || activeProjectRef.current !== activeProjectId) return;
    if (pendingHistTimerRef.current) clearTimeout(pendingHistTimerRef.current);
    pendingHistTimerRef.current = setTimeout(() => {
      saveStack(`@fastart_hist_${activeProjectId}`, historyStack);
    }, 400);
    return () => {
      if (pendingHistTimerRef.current) clearTimeout(pendingHistTimerRef.current);
    };
  }, [activeProjectId, historyStack]);

  // Persist redo stack to survive refresh, close, and reopen (debounced)
  useEffect(() => {
    if (!activeProjectId || activeProjectRef.current !== activeProjectId) return;
    if (pendingRedoTimerRef.current) clearTimeout(pendingRedoTimerRef.current);
    pendingRedoTimerRef.current = setTimeout(() => {
      saveStack(`@fastart_redo_${activeProjectId}`, redoStack);
    }, 400);
    return () => {
      if (pendingRedoTimerRef.current) clearTimeout(pendingRedoTimerRef.current);
    };
  }, [activeProjectId, redoStack]);

  // Push state to undo stack with memory cap (max 20 snapshots) & debounced disk persistence
  const updateProjectWithHistory = useCallback((updatedProject: any) => {
    const current = projectRef.current;
    if (!current) return;
    const fullProject: FastArtProject = {
      ...current,
      ...(updatedProject || {}),
      tracks: updatedProject?.tracks ? updatedProject.tracks : current.tracks,
    };

    const now = Date.now();
    // Burst grouping: if calls occur within 400ms (e.g. dragging a slider),
    // retain the initial baseline snapshot so intermediate frames don't flood the undo stack
    if (now - lastHistoryPushTimeRef.current > 400 || !burstSnapshotRef.current) {
      burstSnapshotRef.current = cloneProjectSnapshot(current);
      setHistoryStack((prev) => [
        ...prev.slice(-20),
        burstSnapshotRef.current!,
      ]);
    }
    lastHistoryPushTimeRef.current = now;
    setRedoStack([]);

    // Update in-memory state and UI immediately (0ms latency, 120 FPS)
    projectRef.current = fullProject;
    setProject(fullProject);
    setProjects((prev) => prev.map((p) => (p.id === fullProject.id ? fullProject : p)));

    // Debounce expensive disk / localStorage writes so continuous slider moves never drop frames
    if (pendingSaveTimerRef.current) {
      clearTimeout(pendingSaveTimerRef.current);
    }
    pendingSaveTimerRef.current = setTimeout(() => {
      pendingSaveTimerRef.current = null;
      if (projectRef.current) {
        saveProject(projectRef.current);
      }
    }, 300);
  }, [projectRef, setProject, setProjects]);

  // Transient live preview update: updates in-memory state without polluting undo history or saving to disk
  const updateProjectPreview = useCallback((updatedProject: any) => {
    const current = projectRef.current;
    if (!current) return;
    const fullProject: FastArtProject = {
      ...current,
      ...(updatedProject || {}),
      tracks: updatedProject?.tracks ? updatedProject.tracks : current.tracks,
    };
    projectRef.current = fullProject;
    setProject(fullProject);
  }, [projectRef, setProject]);

  // Commit changes made during a modal preview session:
  // Pushes the pre-modal snapshot to undo stack once, saves the current project, and clears redo stack.
  const commitPreview = useCallback((snapshot: FastArtProject) => {
    const current = projectRef.current;
    if (!current) return;
    if (JSON.stringify(current) !== JSON.stringify(snapshot)) {
      setHistoryStack((prev) => [
        ...prev.slice(-20),
        cloneProjectSnapshot(snapshot),
      ]);
      setRedoStack([]);
      const saved = saveProject(current);
      projectRef.current = saved;
      setProject(saved);
      setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    }
  }, [projectRef, setProject, setProjects]);

  // Discard preview changes: restores project to pre-modal snapshot without touching history stack
  const discardPreview = useCallback((snapshot: FastArtProject) => {
    const rollback = JSON.parse(JSON.stringify(snapshot));
    projectRef.current = rollback;
    setProject(rollback);
    saveProject(rollback);
    setProjects((prev) => prev.map((p) => (p.id === rollback.id ? rollback : p)));
  }, [projectRef, setProject, setProjects]);

  const handleUndo = useCallback(() => {
    flushPendingSave();
    burstSnapshotRef.current = null;
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
  }, [flushPendingSave, historyStack, projectRef, setProject, setProjects]);

  const handleRedo = useCallback(() => {
    flushPendingSave();
    burstSnapshotRef.current = null;
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
  }, [flushPendingSave, redoStack, projectRef, setProject, setProjects]);

  return {
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
  };
}
