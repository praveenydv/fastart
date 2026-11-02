import { useEffect } from "react";
import { Platform } from "react-native";
import { pauseActiveVideoRenderer } from "../utils/videoRenderer";
import { pauseAllAudio } from "../components/Player/usePlayerAudioSync";

interface UseKeyboardShortcutsParams {
  selectedClipId: string | null;
  selectedClipType: string;
  routeScreen: string;
  activeModal: string | null;
  clipToDelete: any;
  setClipToDelete: (val: any) => void;
  closeModal: () => void;
  setSelectedClipId: (id: string | null) => void;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  totalDuration: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  handleUndo: () => void;
  handleRedo: () => void;
  handleSplitClip: () => void;
  handleDuplicateClip: () => void;
  handleDeleteClip: () => void;
  onOpenShortcuts?: () => void;
}

export function useKeyboardShortcuts({
  selectedClipId,
  routeScreen,
  activeModal,
  clipToDelete,
  setClipToDelete,
  closeModal,
  setSelectedClipId,
  isPlaying,
  setIsPlaying,
  currentTime,
  setCurrentTime,
  totalDuration,
  setZoom,
  handleUndo,
  handleRedo,
  handleSplitClip,
  handleDuplicateClip,
  handleDeleteClip,
  onOpenShortcuts,
}: UseKeyboardShortcutsParams) {
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
        if (totalDuration <= 0) {
          pauseActiveVideoRenderer();
          pauseAllAudio();
          setIsPlaying(false);
          setCurrentTime(0);
          return;
        }
        if (isPlaying) {
          pauseActiveVideoRenderer();
          pauseAllAudio();
          setIsPlaying(false);
        } else {
          if (
            currentTime >= totalDuration - 0.05 ||
            currentTime >= totalDuration
          ) {
            setCurrentTime(0);
          }
          setIsPlaying(true);
        }
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

      // 3. Split Clip (C, S, or Cmd+K)
      if ((e.key === "c" || e.key === "C" || e.key === "s" || e.key === "S") && !isCmdOrCtrl) {
        if (selectedClipId && routeScreen === "editor" && !activeModal) {
          e.preventDefault();
          handleSplitClip();
        }
        return;
      }
      if (isCmdOrCtrl && (e.key === "k" || e.key === "K")) {
        if (selectedClipId && routeScreen === "editor" && !activeModal) {
          e.preventDefault();
          handleSplitClip();
        }
        return;
      }

      // J-K-L Shuttle Controls
      if ((e.key === "j" || e.key === "J") && !isCmdOrCtrl) {
        e.preventDefault();
        setCurrentTime((t) => Math.max(0, t - 1.0));
        return;
      }
      if ((e.key === "k" || e.key === "K") && !isCmdOrCtrl) {
        e.preventDefault();
        pauseActiveVideoRenderer();
        pauseAllAudio();
        setIsPlaying(false);
        return;
      }
      if ((e.key === "l" || e.key === "L") && !isCmdOrCtrl) {
        e.preventDefault();
        if (!isPlaying) {
          setIsPlaying(true);
        } else {
          setCurrentTime((t) => Math.min(totalDuration, t + 1.0));
        }
        return;
      }

      // Open Shortcuts Help (?)
      if (e.key === "?" && onOpenShortcuts) {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // Home & End navigation
      if (e.key === "Home") {
        e.preventDefault();
        setCurrentTime(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setCurrentTime(totalDuration);
        return;
      }

      // 4. Duplicate Clip (D or Cmd+D)
      if ((e.key === "d" || e.key === "D") && !e.shiftKey) {
        if (selectedClipId && routeScreen === "editor" && !activeModal) {
          e.preventDefault();
          handleDuplicateClip();
        }
        return;
      }

      // 5. Delete Clip (Delete or Backspace)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          selectedClipId &&
          routeScreen === "editor" &&
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
        setZoom((z) => Math.max(1, z > 20 ? z - 10 : z > 6 ? z - 4 : z - 1));
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        setZoom(60);
        return;
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        if (typeof window.removeEventListener === "function") {
          window.removeEventListener("keydown", handleKeyDown);
        }
      };
    }
  }, [
    selectedClipId,
    routeScreen,
    activeModal,
    clipToDelete,
    isPlaying,
    currentTime,
    totalDuration,
    setClipToDelete,
    closeModal,
    setSelectedClipId,
    setIsPlaying,
    setCurrentTime,
    setZoom,
    handleUndo,
    handleRedo,
    handleSplitClip,
    handleDuplicateClip,
    handleDeleteClip,
    onOpenShortcuts,
  ]);
}
