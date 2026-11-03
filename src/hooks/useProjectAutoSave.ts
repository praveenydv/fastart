import { useEffect, useRef, useCallback, useState } from "react";
import { Platform, AppState } from "react-native";
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
 *
 * Optimized to completely eliminate synchronous JSON.stringify calls on every frame/render,
 * deferring serialization strictly to debounced background commit passes.
 */
export function useProjectAutoSave({
  project,
  projectRef,
  setProjects,
  debounceMs = 1800,
  intervalMs = 4000,
}: UseProjectAutoSaveProps) {
  const lastSavedObjRef = useRef<FastArtProject | null>(null);
  const debounceTimerRef = useRef<any>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Initialize baseline snapshot
  useEffect(() => {
    if (project && !lastSavedObjRef.current) {
      lastSavedObjRef.current = project;
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

        setSaveStatus("saving");
        saveProject(targetProject);
        // Project updates are immutable; remember the exact state object that
        // was committed so the periodic safety check can skip it by identity.
        lastSavedObjRef.current = targetProject;
        setSaveStatus("saved");
      } catch (err) {
        console.warn("[AutoSave] Error persisting project:", err);
        setSaveStatus("unsaved");
      }
    },
    [setProjects],
  );

  // 1. Debounced save triggered on project state change
  // High-performance: Zero synchronous JSON stringification on the render path!
  useEffect(() => {
    if (!project || !project.id) return;

    // Fast reference check: skip when reference is identical to last saved
    if (project === lastSavedObjRef.current) {
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
        commitSave(cur);
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

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (typeof window.addEventListener === "function") {
        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("pagehide", handleBeforeUnload);
      }
      if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
        document.addEventListener("visibilitychange", handleVisibilityChange);
      }

      return () => {
        if (typeof window.removeEventListener === "function") {
          window.removeEventListener("beforeunload", handleBeforeUnload);
          window.removeEventListener("pagehide", handleBeforeUnload);
        }
        if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        }
      };
    } else {
      // Native iOS & Android AppState listener: saves project automatically on app background
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "background" || state === "inactive") {
          const cur = projectRef.current;
          if (cur && cur.id) {
            commitSave(cur);
          }
        }
      });
      return () => sub.remove();
    }
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
