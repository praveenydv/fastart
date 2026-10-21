import { useRef, useEffect } from "react";
import { Platform } from "react-native";
import { soundEngine } from "../../utils/audioEngine";
import { getPointerCoords } from "../Timeline";
import { ActiveTransformItem } from "./playerTypes";

interface UseWebTransformPointerProps {
  activeTransformItem: ActiveTransformItem | null;
  boxWidth: number;
  canvasHeight: number;
  canvasRef: React.RefObject<any>;
  canvasBoxRef: React.RefObject<any>;
  latestTransformRef: React.MutableRefObject<{
    clipId: string;
    clipType: string;
    transform: { x: number; y: number; scale: number; rotation: number };
  } | null>;
  scheduleTransformUpdateRef: React.MutableRefObject<
    (
      clipId: string,
      clipType: string,
      transform: { x: number; y: number; scale: number; rotation: number },
      isFinal?: boolean,
    ) => void
  >;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
}

export function useWebTransformPointer({
  activeTransformItem,
  boxWidth,
  canvasHeight,
  canvasRef,
  canvasBoxRef,
  latestTransformRef,
  scheduleTransformUpdateRef,
  onOpenEditModal,
}: UseWebTransformPointerProps) {
  const lastTapRef = useRef<{ time: number; id: string }>({ time: 0, id: "" });
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const handleStartDrag = (
    e: any,
    mode: "move" | "scale" | "rotate",
    corner?: "tl" | "tr" | "bl" | "br",
    overrideItem?: any,
  ) => {
    if (e.stopPropagation) e.stopPropagation();
    if (e.nativeEvent && e.nativeEvent.stopPropagation)
      e.nativeEvent.stopPropagation();
    if (e.cancelable && e.preventDefault) e.preventDefault();

    const targetItem = overrideItem || activeTransformItem;
    if (!targetItem) return;

    soundEngine.playSfx("click");

    const now = Date.now();
    if (
      mode === "move" &&
      lastTapRef.current &&
      lastTapRef.current.id === targetItem.id &&
      now - lastTapRef.current.time < 320
    ) {
      lastTapRef.current = { time: 0, id: "" };
      soundEngine.playSfx("click");
      if (targetItem.type === "text" || targetItem.type === "sticker") {
        onOpenEditModal?.(targetItem.id, targetItem.type);
      }
      return;
    }
    lastTapRef.current = { time: now, id: targetItem.id };

    const coords = getPointerCoords(e);
    const clientX = coords.clientX;
    const clientY = coords.clientY;
    const itemCenterX = (targetItem.pos.x / 100) * boxWidth;
    const itemCenterY = (targetItem.pos.y / 100) * canvasHeight;

    let rectLeft = 0;
    let rectTop = 0;
    if (typeof window !== "undefined") {
      const el = canvasRef.current || (canvasBoxRef.current as any);
      if (el && typeof el.getBoundingClientRect === "function") {
        const r = el.getBoundingClientRect();
        rectLeft = r.left;
        rectTop = r.top;
      }
    }
    const absCenterX = rectLeft + itemCenterX;
    const absCenterY = rectTop + itemCenterY;
    const startDist = Math.hypot(clientX - absCenterX, clientY - absCenterY);
    const startAngle = Math.atan2(clientY - absCenterY, clientX - absCenterX);

    const dragSession = {
      mode,
      corner,
      clipId: targetItem.id,
      clipType: targetItem.type,
      startClientX: clientX,
      startClientY: clientY,
      startCenterX: itemCenterX,
      startCenterY: itemCenterY,
      absCenterX,
      absCenterY,
      startScale: targetItem.scale ?? 1.0,
      startRotation: targetItem.rotation ?? 0,
      startDist: Math.max(10, startDist),
      startAngle,
    };

    if (Platform.OS !== "web" || typeof window === "undefined") return;

    dragCleanupRef.current?.();

    const handlePointerMove = (moveEvt: any) => {
      if (moveEvt.cancelable && moveEvt.preventDefault) moveEvt.preventDefault();
      const mCoords = getPointerCoords(moveEvt);
      const curX = mCoords.clientX;
      const curY = mCoords.clientY;

      if (dragSession.mode === "move") {
        const dx = curX - dragSession.startClientX;
        const dy = curY - dragSession.startClientY;
        const newCenterX = dragSession.startCenterX + dx;
        const newCenterY = dragSession.startCenterY + dy;

        if (dragSession.clipType === "video") {
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            "video",
            {
              x: Math.round(newCenterX - boxWidth / 2),
              y: Math.round(newCenterY - canvasHeight / 2),
              scale: dragSession.startScale,
              rotation: dragSession.startRotation,
            },
            false,
          );
        } else {
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            dragSession.clipType,
            {
              x: Math.max(0, Math.min(100, Number(((newCenterX / boxWidth) * 100).toFixed(1)))),
              y: Math.max(0, Math.min(100, Number(((newCenterY / canvasHeight) * 100).toFixed(1)))),
              scale: dragSession.startScale,
              rotation: dragSession.startRotation,
            },
            false,
          );
        }
      } else if (dragSession.mode === "scale") {
        const currentDist = Math.hypot(curX - dragSession.absCenterX, curY - dragSession.absCenterY);
        const scaleRatio = currentDist / Math.max(10, dragSession.startDist);
        const newScale = Math.max(0.15, Math.min(5.0, Number((dragSession.startScale * scaleRatio).toFixed(2))));

        if (dragSession.clipType === "video") {
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            "video",
            {
              x: Math.round(dragSession.startCenterX - boxWidth / 2),
              y: Math.round(dragSession.startCenterY - canvasHeight / 2),
              scale: newScale,
              rotation: dragSession.startRotation,
            },
            false,
          );
        } else {
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            dragSession.clipType,
            {
              x: Number(((dragSession.startCenterX / boxWidth) * 100).toFixed(1)),
              y: Number(((dragSession.startCenterY / canvasHeight) * 100).toFixed(1)),
              scale: newScale,
              rotation: dragSession.startRotation,
            },
            false,
          );
        }
      } else if (dragSession.mode === "rotate") {
        const currentAngle = Math.atan2(curY - dragSession.absCenterY, curX - dragSession.absCenterX);
        const angleDiffDeg = ((currentAngle - dragSession.startAngle) * 180) / Math.PI;
        const rawRotation = (dragSession.startRotation + angleDiffDeg) % 360;
        const normalized = Math.round(((rawRotation % 360) + 360) % 360);
        let snapped = normalized;
        [0, 90, 180, 270, 360].forEach((snapAngle) => {
          if (Math.abs(normalized - snapAngle) < 6) snapped = snapAngle % 360;
        });

        if (dragSession.clipType === "video") {
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            "video",
            {
              x: Math.round(dragSession.startCenterX - boxWidth / 2),
              y: Math.round(dragSession.startCenterY - canvasHeight / 2),
              scale: dragSession.startScale,
              rotation: snapped,
            },
            false,
          );
        } else {
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            dragSession.clipType,
            {
              x: Number(((dragSession.startCenterX / boxWidth) * 100).toFixed(1)),
              y: Number(((dragSession.startCenterY / canvasHeight) * 100).toFixed(1)),
              scale: dragSession.startScale,
              rotation: snapped,
            },
            false,
          );
        }
      }
    };

    const handlePointerUp = () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      if (latestTransformRef.current) {
        scheduleTransformUpdateRef.current(
          latestTransformRef.current.clipId,
          latestTransformRef.current.clipType,
          latestTransformRef.current.transform,
          true,
        );
      }
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);
    window.addEventListener("touchcancel", handlePointerUp);

    dragCleanupRef.current = () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
      window.removeEventListener("touchcancel", handlePointerUp);
    };
  };

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  return { handleStartDrag };
}
