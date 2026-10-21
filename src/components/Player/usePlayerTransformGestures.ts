import { useRef } from "react";
import { Platform } from "react-native";
import { ActiveTransformItem, TransientTransformState } from "./playerTypes";
import { FastArtProject } from "../../types/project";
import { useNativeTransformResponders } from "./useNativeTransformResponders";
import { useWebTransformPointer } from "./useWebTransformPointer";

interface UsePlayerTransformGesturesProps {
  activeTransformItem: ActiveTransformItem | null;
  boxWidth: number;
  canvasHeight: number;
  canvasRef: React.RefObject<any>;
  canvasBoxRef: React.RefObject<any>;
  rendererRef: React.RefObject<any>;
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
  onUpdateClipTransform?: (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal?: boolean,
  ) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  setActiveTransient: (transient: TransientTransformState | null) => void;
}

export function usePlayerTransformGestures({
  activeTransformItem,
  boxWidth,
  canvasHeight,
  canvasRef,
  canvasBoxRef,
  rendererRef,
  project,
  currentTime,
  isPlaying,
  onUpdateClipTransform,
  onOpenEditModal,
  setActiveTransient,
}: UsePlayerTransformGesturesProps) {
  const latestTransformRef = useRef<{
    clipId: string;
    clipType: string;
    transform: { x: number; y: number; scale: number; rotation: number };
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const activeTransformItemRef = useRef(activeTransformItem);
  activeTransformItemRef.current = activeTransformItem;

  const boxWidthRef = useRef(boxWidth);
  boxWidthRef.current = boxWidth;

  const canvasHeightRef = useRef(canvasHeight);
  canvasHeightRef.current = canvasHeight;

  const onUpdateClipTransformRef = useRef(onUpdateClipTransform);
  onUpdateClipTransformRef.current = onUpdateClipTransform;

  const scheduleTransformUpdate = (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal = false,
  ) => {
    latestTransformRef.current = { clipId, clipType, transform };
    if (isFinal) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setActiveTransient(null);
      onUpdateClipTransformRef.current?.(clipId, clipType, transform, true);
      latestTransformRef.current = null;
      return;
    }

    const transient = {
      clipId,
      x: transform.x,
      y: transform.y,
      scale: transform.scale,
      rotation: transform.rotation,
    };
    setActiveTransient(transient);

    if (Platform.OS === "web" && rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
        transient,
      );
    }
  };

  const scheduleTransformUpdateRef = useRef(scheduleTransformUpdate);
  scheduleTransformUpdateRef.current = scheduleTransformUpdate;

  const nativeResponders = useNativeTransformResponders({
    activeTransformItemRef,
    boxWidthRef,
    canvasHeightRef,
    latestTransformRef,
    scheduleTransformUpdateRef,
  });

  const { handleStartDrag } = useWebTransformPointer({
    activeTransformItem,
    boxWidth,
    canvasHeight,
    canvasRef,
    canvasBoxRef,
    latestTransformRef,
    scheduleTransformUpdateRef,
    onOpenEditModal,
  });

  return {
    ...nativeResponders,
    handleStartDrag,
    scheduleTransformUpdate,
  };
}
