import { useEffect, useRef, useCallback, useState } from "react";
import { Platform } from "react-native";
import { FastArtProject } from "../types/project";
import { saveProject } from "../utils/storage";

interface UseProjectAutoSaveProps {
  project: FastArtProject | null;
  projectRef: React.MutableRefObject<FastArtProject | null>;
  setProjects: React.Dispatch<React.SetStateAction<FastArtProject[]>>;
  debounceMs?: number;
  intervalMs?: number;
}

/**
 * High-performance, resilient Auto-Save system.
 * Continuously monitors project state and guarantees all edits (cutouts, layer order,
 * transforms, texts, speeds, filters) are saved to storage without user intervention,
 * surviving browser refresh, tab closing, and modal interactions.
 */
export function useProjectAutoSave({
  project,
  projectRef,
  setProjects,
  debounceMs = 1800,
  intervalMs = 4000,
}: UseProjectAutoSaveProps) {
  const lastSavedJsonRef = useRef<string>("");
  const lastSavedObjRef = useRef<FastArtProject | null>(null);
  const debounceTimerRef = useRef<any>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Initialize baseline snapshot
  useEffect(() => {
    if (project && !lastSavedObjRef.current) {
      lastSavedObjRef.current = project;
      try {
        lastSavedJsonRef.current = JSON.stringify(project);
      } catch {}
    }
  }, [project?.id]);

  const commitSave = useCallback(
    (targetProject: FastArtProject | null, isSync: boolean = false) => {
      if (!targetProject || !targetProject.id) return;
      try {
        if (targetProject === lastSavedObjRef.current) {
          setSaveStatus("saved");
          return;
        }

        const curJson = JSON.stringify(targetProject);
        if (curJson === lastSavedJsonRef.current) {
          lastSavedObjRef.current = targetProject;
          setSaveStatus("saved");
          return;
        }

        setSaveStatus("saving");
        const saved = saveProject(targetProject);
        lastSavedObjRef.current = saved;
        lastSavedJsonRef.current = JSON.stringify(saved);
        setSaveStatus("saved");
      } catch (err) {
        console.warn("[AutoSave] Error persisting project:", err);
        setSaveStatus("unsaved");
      }
    },
    [setProjects],
  );

  // 1. Debounced save triggered on every project state change
  useEffect(() => {
    if (!project || !project.id) return;

    // Fast reference check: skip stringification when object reference is unchanged
    if (project === lastSavedObjRef.current) {
      return;
    }

    let currentJson = "";
    try {
      currentJson = JSON.stringify(project);
    } catch {
      return;
    }

    if (currentJson === lastSavedJsonRef.current) {
      lastSavedObjRef.current = project;
      return;
    }

    setSaveStatus("unsaved");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      commitSave(projectRef.current || project);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [project, commitSave, debounceMs, projectRef]);

  // 2. Periodic interval check: guarantees uncommitted modal preview adjustments are safely persisted
  useEffect(() => {
    const interval = setInterval(() => {
      const cur = projectRef.current;
      if (!cur || !cur.id) return;
      if (cur === lastSavedObjRef.current) return;
      try {
        const json = JSON.stringify(cur);
        if (json !== lastSavedJsonRef.current) {
          commitSave(cur);
        } else {
          lastSavedObjRef.current = cur;
        }
      } catch {}
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, commitSave, projectRef]);

  // 3. Web Lifecycle handlers: immediately commit on page refresh, navigation, or tab switch
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleBeforeUnload = () => {
      const cur = projectRef.current;
      if (cur && cur.id) {
        commitSave(cur, true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const cur = projectRef.current;
        if (cur && cur.id) {
          commitSave(cur);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [commitSave, projectRef]);

  const triggerImmediateSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    commitSave(projectRef.current || project);
  }, [commitSave, project, projectRef]);

  return {
    saveStatus,
    triggerImmediateSave,
  };
}

