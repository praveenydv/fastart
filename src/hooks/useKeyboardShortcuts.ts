import { useEffect } from "react";
import { Platform } from "react-native";
import { soundEngine } from "../utils/audioEngine";

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
          soundEngine.playSfx("click");
          setIsPlaying(false);
          setCurrentTime(0);
          return;
        }
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
        if (selectedClipId && routeScreen === "editor" && !activeModal) {
          e.preventDefault();
          soundEngine.playSfx("split");
          handleSplitClip();
        }
        return;
      }
      if (isCmdOrCtrl && (e.key === "k" || e.key === "K")) {
        if (selectedClipId && routeScreen === "editor" && !activeModal) {
          e.preventDefault();
          soundEngine.playSfx("split");
          handleSplitClip();
        }
        return;
      }

      // 4. Duplicate Clip (D or Cmd+D)
      if ((e.key === "d" || e.key === "D") && !e.shiftKey) {
        if (selectedClipId && routeScreen === "editor" && !activeModal) {
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
  ]);
}
