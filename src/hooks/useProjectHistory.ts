import { useState, useCallback } from "react";
import { FastArtProject } from "../types/project";
import { saveProject } from "../utils/storage";
import { soundEngine } from "../utils/audioEngine";

interface UseProjectHistoryParams {
  projectRef: React.MutableRefObject<FastArtProject | null>;
  setProject: React.Dispatch<React.SetStateAction<FastArtProject | null>>;
  setProjects: React.Dispatch<React.SetStateAction<FastArtProject[]>>;
}

export function useProjectHistory({
  projectRef,
  setProject,
  setProjects,
}: UseProjectHistoryParams) {
  const [historyStack, setHistoryStack] = useState<FastArtProject[]>([]);
  const [redoStack, setRedoStack] = useState<FastArtProject[]>([]);

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
        JSON.parse(JSON.stringify(snapshot)),
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
  }, [historyStack, projectRef, setProject, setProjects]);

  const handleRedo = useCallback(() => {
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
  }, [redoStack, projectRef, setProject, setProjects]);

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
