import { useRef } from "react";
import { PanResponder } from "react-native";
import { ActiveTransformItem } from "./playerTypes";

interface UseCanvasMultiTouchProps {
  activeTransformItemRef: React.MutableRefObject<ActiveTransformItem | null>;
  boxWidthRef: React.MutableRefObject<number>;
  canvasHeightRef: React.MutableRefObject<number>;
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
}

export function useCanvasMultiTouchResponder({
  activeTransformItemRef,
  boxWidthRef,
  canvasHeightRef,
  latestTransformRef,
  scheduleTransformUpdateRef,
}: UseCanvasMultiTouchProps) {
  const canvasMultiTouchStartRef = useRef<any>(null);
  const canvasMultiTouchPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) =>
        !!activeTransformItemRef.current &&
        (evt.nativeEvent.touches?.length || 0) >= 2,
      onMoveShouldSetPanResponderCapture: (evt) =>
        !!activeTransformItemRef.current &&
        (evt.nativeEvent.touches?.length || 0) >= 2,
      onStartShouldSetPanResponder: (evt) =>
        !!activeTransformItemRef.current &&
        (evt.nativeEvent.touches?.length || 0) >= 2,
      onMoveShouldSetPanResponder: (evt) =>
        !!activeTransformItemRef.current &&
        (evt.nativeEvent.touches?.length || 0) >= 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const item = activeTransformItemRef.current;
        if (!item) return;
        const touches = evt.nativeEvent.touches;
        if (!touches || touches.length < 2) return;
        const t1 = touches[0];
        const t2 = touches[1];
        const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
        const angle = Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX);
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        canvasMultiTouchStartRef.current = {
          clipId: item.id,
          clipType: item.type,
          startScale: item.scale,
          startRotation: item.rotation,
          startCenterX: (item.pos.x / 100) * bw,
          startCenterY: (item.pos.y / 100) * ch,
          initialDist: Math.max(10, dist),
          initialAngle: angle,
          initialMidX: (t1.pageX + t2.pageX) / 2,
          initialMidY: (t1.pageY + t2.pageY) / 2,
        };
      },
      onPanResponderMove: (evt) => {
        const s = canvasMultiTouchStartRef.current;
        if (!s) return;
        const touches = evt.nativeEvent.touches;
        if (!touches || touches.length < 2) return;
        const t1 = touches[0];
        const t2 = touches[1];
        const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
        const angle = Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX);
        const midX = (t1.pageX + t2.pageX) / 2;
        const midY = (t1.pageY + t2.pageY) / 2;

        const scaleRatio = dist / s.initialDist;
        const newScale = Math.max(
          0.15,
          Math.min(5.0, Number((s.startScale * scaleRatio).toFixed(2))),
        );
        const angleDiffDeg = ((angle - s.initialAngle) * 180) / Math.PI;
        const rawDeg = (s.startRotation + angleDiffDeg) % 360;
        let newRotation = Math.round(((rawDeg % 360) + 360) % 360);
        [0, 90, 180, 270, 360].forEach((deg) => {
          if (Math.abs(newRotation - deg) < 4) newRotation = deg % 360;
        });

        const dx = midX - s.initialMidX;
        const dy = midY - s.initialMidY;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;

        if (s.clipType === "video" || s.clipType === "photo") {
          scheduleTransformUpdateRef.current(
            s.clipId,
            "video",
            {
              x: Math.round(s.startCenterX - bw / 2 + dx),
              y: Math.round(s.startCenterY - ch / 2 + dy),
              scale: newScale,
              rotation: newRotation,
            },
            false,
          );
        } else {
          scheduleTransformUpdateRef.current(
            s.clipId,
            s.clipType,
            {
              x: Number((((s.startCenterX + dx) / bw) * 100).toFixed(1)),
              y: Number((((s.startCenterY + dy) / ch) * 100).toFixed(1)),
              scale: newScale,
              rotation: newRotation,
            },
            false,
          );
        }
      },
      onPanResponderRelease: () => {
        if (latestTransformRef.current) {
          scheduleTransformUpdateRef.current(
            latestTransformRef.current.clipId,
            latestTransformRef.current.clipType,
            latestTransformRef.current.transform,
            true,
          );
        }
        canvasMultiTouchStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        canvasMultiTouchStartRef.current = null;
      },
    }),
  ).current;

  return { canvasMultiTouchPanResponder };
}
