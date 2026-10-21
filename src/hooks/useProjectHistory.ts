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
    handleUndo,
    handleRedo,
  };
}
