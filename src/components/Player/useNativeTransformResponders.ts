import { useRef } from "react";
import { PanResponder } from "react-native";
import { ActiveTransformItem } from "./playerTypes";
import { useCanvasMultiTouchResponder } from "./useCanvasMultiTouchResponder";

interface UseNativeTransformRespondersProps {
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

export function useNativeTransformResponders({
  activeTransformItemRef,
  boxWidthRef,
  canvasHeightRef,
  latestTransformRef,
  scheduleTransformUpdateRef,
}: UseNativeTransformRespondersProps) {
  // 1. Native Box PanResponder
  const nativeBoxStartRef = useRef<any>(null);
  const nativeBoxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 1 || Math.abs(gs.dy) > 1,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (evt) => {
        const item = activeTransformItemRef.current;
        if (!item) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const startCenterX = (item.pos.x / 100) * bw;
        const startCenterY = (item.pos.y / 100) * ch;
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          const t1 = touches[0];
          const t2 = touches[1];
          const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
          const angle = Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX);
          nativeBoxStartRef.current = {
            clipId: item.id,
            clipType: item.type,
            startCenterX,
            startCenterY,
            startScale: item.scale,
            startRotation: item.rotation,
            initialDist: Math.max(10, dist),
            initialAngle: angle,
            touch2StartX: (t1.pageX + t2.pageX) / 2,
            touch2StartY: (t1.pageY + t2.pageY) / 2,
          };
        } else {
          nativeBoxStartRef.current = {
            clipId: item.id,
            clipType: item.type,
            startCenterX,
            startCenterY,
            startScale: item.scale,
            startRotation: item.rotation,
          };
        }
      },
      onPanResponderMove: (evt, gs) => {
        const s = nativeBoxStartRef.current;
        if (!s) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          const t1 = touches[0];
          const t2 = touches[1];
          const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
          const angle = Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX);
          const midX = (t1.pageX + t2.pageX) / 2;
          const midY = (t1.pageY + t2.pageY) / 2;

          if (!s.initialDist) {
            s.initialDist = Math.max(10, dist);
            s.initialAngle = angle;
            s.touch2StartX = midX;
            s.touch2StartY = midY;
            return;
          }

          const scaleRatio = dist / s.initialDist;
          const newScale = Math.max(
            0.15,
            Math.min(5.0, Number((s.startScale * scaleRatio).toFixed(2))),
          );
          const angleDiffDeg =
            ((angle - (s.initialAngle || 0)) * 180) / Math.PI;
          const rawDeg = (s.startRotation + angleDiffDeg) % 360;
          let newRotation = Math.round(((rawDeg % 360) + 360) % 360);
          [0, 90, 180, 270, 360].forEach((deg) => {
            if (Math.abs(newRotation - deg) < 4) newRotation = deg % 360;
          });

          const dx = midX - (s.touch2StartX || midX);
          const dy = midY - (s.touch2StartY || midY);

          if (s.clipType === "video") {
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
            const newPctX = Math.max(
              0,
              Math.min(100, ((s.startCenterX + dx) / bw) * 100),
            );
            const newPctY = Math.max(
              0,
              Math.min(100, ((s.startCenterY + dy) / ch) * 100),
            );
            scheduleTransformUpdateRef.current(
              s.clipId,
              s.clipType,
              {
                x: Number(newPctX.toFixed(1)),
                y: Number(newPctY.toFixed(1)),
                scale: newScale,
                rotation: newRotation,
              },
              false,
            );
          }
        } else {
          const dx = gs.dx;
          const dy = gs.dy;
          if (s.clipType === "video") {
            scheduleTransformUpdateRef.current(
              s.clipId,
              "video",
              {
                x: Math.round(s.startCenterX - bw / 2 + dx),
                y: Math.round(s.startCenterY - ch / 2 + dy),
                scale: s.startScale,
                rotation: s.startRotation,
              },
              false,
            );
          } else {
            const newPctX = Math.max(
              0,
              Math.min(100, ((s.startCenterX + dx) / bw) * 100),
            );
            const newPctY = Math.max(
              0,
              Math.min(100, ((s.startCenterY + dy) / ch) * 100),
            );
            scheduleTransformUpdateRef.current(
              s.clipId,
              s.clipType,
              {
                x: Number(newPctX.toFixed(1)),
                y: Number(newPctY.toFixed(1)),
                scale: s.startScale,
                rotation: s.startRotation,
              },
              false,
            );
          }
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
        nativeBoxStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        nativeBoxStartRef.current = null;
      },
    }),
  ).current;

  // 2. Native Rotation Handle Responder
  const nativeRotStartRef = useRef<any>(null);
  const nativeRotPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const item = activeTransformItemRef.current;
        if (!item) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const itemCenterX = (item.pos.x / 100) * bw;
        const itemCenterY = (item.pos.y / 100) * ch;
        const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
        const knobPageX = pageX - (locationX ?? 16) + 16;
        const knobPageY = pageY - (locationY ?? 16) + 16;
        const itemCenterPageX = knobPageX;
        const itemCenterPageY = knobPageY + 30 + item.height / 2;
        const startAngle = Math.atan2(
          pageY - itemCenterPageY,
          pageX - itemCenterPageX,
        );
        nativeRotStartRef.current = {
          clipId: item.id,
          clipType: item.type,
          startRotation: item.rotation || 0,
          startScale: item.scale || 1,
          startCenterX: itemCenterX,
          startCenterY: itemCenterY,
          itemCenterPageX,
          itemCenterPageY,
          startAngle,
        };
      },
      onPanResponderMove: (evt, gs) => {
        const s = nativeRotStartRef.current;
        if (!s) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const curAngle = Math.atan2(
          evt.nativeEvent.pageY - s.itemCenterPageY,
          evt.nativeEvent.pageX - s.itemCenterPageX,
        );
        const angleDiffDeg = ((curAngle - s.startAngle) * 180) / Math.PI;
        const rotDelta =
          Math.abs(angleDiffDeg) > 0.5 ? angleDiffDeg : gs.dx * 0.9;
        const rawDeg = (s.startRotation + rotDelta) % 360;
        const newRot = Math.round(((rawDeg % 360) + 360) % 360);
        let snappedRot = newRot;
        [0, 90, 180, 270, 360].forEach((deg) => {
          if (Math.abs(newRot - deg) < 5) snappedRot = deg % 360;
        });

        if (s.clipType === "video") {
          scheduleTransformUpdateRef.current(
            s.clipId,
            "video",
            {
              x: Math.round(s.startCenterX - bw / 2),
              y: Math.round(s.startCenterY - ch / 2),
              scale: s.startScale,
              rotation: snappedRot,
            },
            false,
          );
        } else {
          scheduleTransformUpdateRef.current(
            s.clipId,
            s.clipType,
            {
              x: Number(((s.startCenterX / bw) * 100).toFixed(1)),
              y: Number(((s.startCenterY / ch) * 100).toFixed(1)),
              scale: s.startScale,
              rotation: snappedRot,
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
        nativeRotStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        nativeRotStartRef.current = null;
      },
    }),
  ).current;

  // 3. Directional Corner Scale Responders
  const createCornerScaleResponder = (corner: "tl" | "tr" | "bl" | "br") => {
    const startRef = {
      clipId: "",
      clipType: "",
      startRotation: 0,
      startScale: 1,
      startCenterX: 0,
      startCenterY: 0,
    };
    const signX = corner === "tl" || corner === "bl" ? -1 : 1;
    const signY = corner === "tl" || corner === "tr" ? -1 : 1;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const item = activeTransformItemRef.current;
        if (!item) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        startRef.clipId = item.id;
        startRef.clipType = item.type;
        startRef.startRotation = item.rotation || 0;
        startRef.startScale = item.scale || 1;
        startRef.startCenterX = (item.pos.x / 100) * bw;
        startRef.startCenterY = (item.pos.y / 100) * ch;
      },
      onPanResponderMove: (_, gs) => {
        if (!startRef.clipId) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const projectedDelta = (gs.dx * signX + gs.dy * signY) / 2;
        const scaleDelta = projectedDelta / 75;
        const newScale = Math.max(
          0.15,
          Math.min(
            5.0,
            Number((startRef.startScale * (1 + scaleDelta)).toFixed(2)),
          ),
        );

        if (startRef.clipType === "video") {
          scheduleTransformUpdateRef.current(
            startRef.clipId,
            "video",
            {
              x: Math.round(startRef.startCenterX - bw / 2),
              y: Math.round(startRef.startCenterY - ch / 2),
              scale: newScale,
              rotation: startRef.startRotation,
            },
            false,
          );
        } else {
          scheduleTransformUpdateRef.current(
            startRef.clipId,
            startRef.clipType,
            {
              x: Number(((startRef.startCenterX / bw) * 100).toFixed(1)),
              y: Number(((startRef.startCenterY / ch) * 100).toFixed(1)),
              scale: newScale,
              rotation: startRef.startRotation,
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
        startRef.clipId = "";
      },
      onPanResponderTerminate: () => {
        startRef.clipId = "";
      },
    });
  };

  const scaleTLResponder = useRef(createCornerScaleResponder("tl")).current;
  const scaleTRResponder = useRef(createCornerScaleResponder("tr")).current;
  const scaleBLResponder = useRef(createCornerScaleResponder("bl")).current;
  const scaleBRResponder = useRef(createCornerScaleResponder("br")).current;

  const { canvasMultiTouchPanResponder } = useCanvasMultiTouchResponder({
    activeTransformItemRef,
    boxWidthRef,
    canvasHeightRef,
    latestTransformRef,
    scheduleTransformUpdateRef,
  });

  return {
    nativeBoxPanResponder,
    nativeRotPanResponder,
    scaleTLResponder,
    scaleTRResponder,
    scaleBLResponder,
    scaleBRResponder,
    canvasMultiTouchPanResponder,
  };
}
