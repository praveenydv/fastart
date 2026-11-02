import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { View, Text, StyleSheet, Platform, PanResponder } from "react-native";
import { Buffer } from "buffer";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { MaskConfig } from "../../types/project";
import { getInterpolatedMask } from "../../utils/keyframeEngine";
import { getPointerCoords } from "../Timeline";
import { THEME_COLORS } from "../../constants/designConstants";
import { computeVideoClipDimensions } from "./playerUtils";

interface PlayerMaskOverlayProps {
  targetClip: any;
  boxWidth: number;
  canvasHeight: number;
  currentTime: number;
  project?: any;
  onUpdateClipMask?: (
    clipId: string,
    mask: MaskConfig,
    isFinal?: boolean,
  ) => void;
  onTransientMaskUpdate?: (clipId: string, mask: MaskConfig | null) => void;
  onCloseMaskPreview?: () => void;
  getInterpolatedTransform?: (
    clip: any,
    curTime: number,
    clipType?: string,
  ) => any;
  rendererRef?: React.RefObject<any>;
  canvasBoxRef?: React.RefObject<any>;
}

export const PlayerMaskOverlay: React.FC<PlayerMaskOverlayProps> = ({
  targetClip,
  boxWidth,
  canvasHeight,
  currentTime,
  project,
  onUpdateClipMask,
  onTransientMaskUpdate,
  onCloseMaskPreview,
  getInterpolatedTransform,
  rendererRef,
  canvasBoxRef,
}) => {
  const containerRef = useRef<any>(null);
  const mask: MaskConfig = useMemo(() => {
    return (
      getInterpolatedMask(targetClip, currentTime) ||
      targetClip?.mask ||
      targetClip?.transform?.mask || {
        shape: "none",
        size: 60,
        width: 60,
        height: 60,
        feather: 0,
        roundness: 16,
        inverted: false,
        x: 0,
        y: 0,
        rotation: 0,
      }
    );
  }, [targetClip, currentTime]);

  const [activeDrag, setActiveDrag] = useState<
    "move" | "rotate" | "scale" | "scale-w" | "scale-h" | "feather" | null
  >(null);
  const [localMask, setLocalMask] = useState<MaskConfig>(mask);
  const isDraggingRef = useRef(false);

  const pendingMaskRafRef = useRef<number | null>(null);
  const pendingMaskRef = useRef<MaskConfig>(mask);
  pendingMaskRef.current = localMask;

  const projectRef = useRef(project);
  projectRef.current = project;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const boxWidthRef = useRef(boxWidth);
  boxWidthRef.current = boxWidth;
  const canvasHeightRef = useRef(canvasHeight);
  canvasHeightRef.current = canvasHeight;

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalMask(mask);
    }
  }, [mask]);

  const onUpdateClipMaskRef = useRef(onUpdateClipMask);
  onUpdateClipMaskRef.current = onUpdateClipMask;
  const onTransientMaskUpdateRef = useRef(onTransientMaskUpdate);
  onTransientMaskUpdateRef.current = onTransientMaskUpdate;

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      if (pendingMaskRafRef.current !== null) {
        cancelAnimationFrame(pendingMaskRafRef.current);
        pendingMaskRafRef.current = null;
      }
      onTransientMaskUpdateRef.current?.(targetClip.id, null);
    };
  }, [targetClip.id]);

  // Clip transform on canvas
  const clipT = useMemo(() => {
    if (getInterpolatedTransform) {
      return getInterpolatedTransform(targetClip, currentTime, "video");
    }
    return targetClip?.transform || { x: 0, y: 0, scale: 1, rotation: 0 };
  }, [getInterpolatedTransform, targetClip, currentTime]);

  const clipCx = boxWidth / 2 + (clipT.x || 0);
  const clipCy = canvasHeight / 2 + (clipT.y || 0);
  const clipScaleX = Math.max(
    0.01,
    Math.abs((clipT.scale || 1.0) * (clipT.scaleX ?? 1.0)),
  );
  const clipScaleY = Math.max(
    0.01,
    Math.abs((clipT.scale || 1.0) * (clipT.scaleY ?? 1.0)),
  );
  const clipScale = Math.max(0.01, Math.abs(clipT.scale || 1.0));
  const clipRot = clipT.rotation || 0;

  // Calculate dw and dh of the clip inside canvas exactly matching rendererClip.ts and PlayerNativeCompositor.tsx
  const { dw, dh } = useMemo(() => {
    if (rendererRef?.current?.getClipRenderDimensions) {
      const dims = rendererRef.current.getClipRenderDimensions(
        targetClip,
        boxWidth,
        canvasHeight,
      );
      if (dims && dims.dw > 0 && dims.dh > 0)
        return { dw: dims.dw, dh: dims.dh };
    }
    const { baseW, baseH } = computeVideoClipDimensions(
      targetClip,
      boxWidth,
      canvasHeight,
    );
    return { dw: baseW, dh: baseH };
  }, [rendererRef, targetClip, boxWidth, canvasHeight]);

  const currentX = localMask.x || 0;
  const currentY = localMask.y || 0;
  const currentRot = localMask.rotation || 0;
  const currentSize = Math.max(5, Math.min(250, localMask.size ?? 60));
  const currentW = Math.max(
    5,
    Math.min(250, localMask.width ?? localMask.size ?? 60),
  );
  const currentH = Math.max(
    5,
    Math.min(250, localMask.height ?? localMask.size ?? 60),
  );

  // Compute canvas pixel position of mask center
  const rad = (clipRot * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const localOffsetX = (currentX / 100) * dw * clipScaleX;
  const localOffsetY = (currentY / 100) * dh * clipScaleY;

  const maskCanvasCenterX =
    clipCx + (localOffsetX * cosA - localOffsetY * sinA);
  const maskCanvasCenterY =
    clipCy + (localOffsetX * sinA + localOffsetY * cosA);
  const totalMaskRotation = clipRot + currentRot;

  // Mask bounding box in pixels matching buildMaskPath
  const minDim = Math.min(dw * clipScaleX, dh * clipScaleY);
  let maskBoxW = Math.max(16, (minDim * currentW) / 100);
  let maskBoxH = Math.max(16, (minDim * currentH) / 100);
  if (localMask.shape === "rectangle") {
    maskBoxW = Math.max(16, (dw * clipScaleX * currentW) / 100);
    maskBoxH = Math.max(16, (dh * clipScaleY * currentH) / 100);
  } else if (localMask.shape === "mirror") {
    maskBoxW = Math.max(dw, dh) * Math.max(clipScaleX, clipScaleY) * 2.0;
    maskBoxH = Math.max(16, (dh * clipScaleY * currentH) / 100);
  } else if (localMask.shape === "linear") {
    maskBoxW = Math.max(dw, dh) * Math.max(clipScaleX, clipScaleY) * 2.0;
    maskBoxH = 40;
  }

  // Generate SVG path / outline for shape with dashed bounding box and center crosshair
  const shapeSvgContent = useMemo(() => {
    const w = maskBoxW;
    const h = maskBoxH;
    const shape = localMask.shape;
    const isLine = shape === "linear" || shape === "mirror";

    return (
      <>
        {/* Outer dashed bounding box and crosshairs only for 2D shapes (circle, rect, heart, star) */}
        {!isLine && (
          <>
            <rect
              x={1}
              y={1}
              width={Math.max(2, w - 2)}
              height={Math.max(2, h - 2)}
              fill="none"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />

            {/* Center horizontal & vertical dashed crosshair lines */}
            <line
              x1={0}
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
            <line
              x1={w / 2}
              y1={0}
              x2={w / 2}
              y2={h}
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
          </>
        )}

        {/* Actual mask shape outline matching video canvas mask */}
        {shape === "circle" && (
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={Math.max(1, w / 2 - 1.5)}
            ry={Math.max(1, h / 2 - 1.5)}
            fill="rgba(0, 242, 254, 0.08)"
            stroke="#00F2FE"
            strokeWidth="2.5"
          />
        )}

        {shape === "rectangle" && (
          <rect
            x={1.5}
            y={1.5}
            width={Math.max(2, w - 3)}
            height={Math.max(2, h - 3)}
            rx={Math.min(localMask.roundness ?? 16, Math.min(w, h) / 2)}
            fill="rgba(0, 242, 254, 0.08)"
            stroke="#00F2FE"
            strokeWidth="2.5"
          />
        )}

        {shape === "heart" && (
          <g
            transform={`translate(${w / 2}, ${h / 2}) scale(${w / 100}, ${h / 100})`}
          >
            <path
              d="M 0,44 C -28,18 -50,0 -50,-20 A 25,25 0 0,1 0,-20 A 25,25 0 0,1 50,-20 C 50,0 28,18 0,44 Z"
              fill="rgba(0, 242, 254, 0.08)"
              stroke="#00F2FE"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}

        {shape === "star" &&
          (() => {
            const points: string[] = [];
            for (let i = 0; i < 10; i++) {
              const radiusFactor = i % 2 === 0 ? 0.5 : 0.21;
              const a = (i * Math.PI) / 5 - Math.PI / 2;
              points.push(
                `${w / 2 + w * radiusFactor * Math.cos(a)},${h / 2 + h * radiusFactor * Math.sin(a)}`,
              );
            }
            return (
              <polygon
                points={points.join(" ")}
                fill="rgba(0, 242, 254, 0.08)"
                stroke="#00F2FE"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })()}

        {shape === "mirror" && (
          <>
            <line
              x1={0}
              y1={0}
              x2={w}
              y2={0}
              stroke="#00F2FE"
              strokeWidth="2.5"
            />
            <line
              x1={0}
              y1={h}
              x2={w}
              y2={h}
              stroke="#00F2FE"
              strokeWidth="2.5"
            />
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill="rgba(0, 242, 254, 0.08)"
            />
          </>
        )}

        {shape === "linear" && (
          <>
            <line
              x1={0}
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="#00F2FE"
              strokeWidth="3"
            />
            <rect
              x={0}
              y={h / 2}
              width={w}
              height={h * 2}
              fill="rgba(0, 242, 254, 0.08)"
            />
          </>
        )}
      </>
    );
  }, [maskBoxW, maskBoxH, localMask]);

  const dragCleanupRef = useRef<(() => void) | null>(null);

  // Pointer drag session handling
  const startDrag = useCallback(
    (
      e: any,
      mode: "move" | "rotate" | "scale" | "scale-w" | "scale-h" | "feather",
    ) => {
      if (e.stopPropagation) e.stopPropagation();
      if (e.cancelable && e.preventDefault) e.preventDefault();

      setActiveDrag(mode);
      isDraggingRef.current = true;

      const coords = getPointerCoords(e);
      const startClientX = coords.clientX;
      const startClientY = coords.clientY;

      const startMaskX = localMask.x || 0;
      const startMaskY = localMask.y || 0;
      const startMaskRot = localMask.rotation || 0;
      const startMaskW = Math.max(5, localMask.width ?? localMask.size ?? 60);
      const startMaskH = Math.max(5, localMask.height ?? localMask.size ?? 60);
      const startMaskSize = Math.max(5, localMask.size ?? 60);
      const startMaskFeather = localMask.feather || 0;

      // Accurately compute canvas screen bounding offset
      let canvasRectLeft = 0;
      let canvasRectTop = 0;
      if (typeof window !== "undefined") {
        const el =
          canvasBoxRef?.current ||
          containerRef.current ||
          rendererRef?.current?.canvas;
        if (el && typeof el.getBoundingClientRect === "function") {
          const r = el.getBoundingClientRect();
          canvasRectLeft = r.left;
          canvasRectTop = r.top;
        } else if (typeof document !== "undefined") {
          const c = document.querySelector("canvas");
          if (c) {
            const r = c.getBoundingClientRect();
            canvasRectLeft = r.left;
            canvasRectTop = r.top;
          }
        }
      }

      // True absolute mask center in viewport client space
      const absMaskCenterX = canvasRectLeft + maskCanvasCenterX;
      const absMaskCenterY = canvasRectTop + maskCanvasCenterY;

      // Distance and angle in absolute client space
      const startDist = Math.max(
        15,
        Math.hypot(
          startClientX - absMaskCenterX,
          startClientY - absMaskCenterY,
        ),
      );
      const startAngle = Math.atan2(
        startClientY - absMaskCenterY,
        startClientX - absMaskCenterX,
      );

      const totalRotRad = (totalMaskRotation * Math.PI) / 180;
      const cosTR = Math.cos(totalRotRad);
      const sinTR = Math.sin(totalRotRad);

      // Stable base dimensions for deformation handles (starts at exact 1.0 factor)
      const startDistX = Math.max(15, maskBoxW / 2);
      const startDistY = Math.max(15, maskBoxH / 2);

      let currentUpdatedMask = { ...localMask };
      pendingMaskRef.current = currentUpdatedMask;

      dragCleanupRef.current?.();

      const onPointerMove = (moveEv: any) => {
        if (moveEv.cancelable && moveEv.preventDefault) moveEv.preventDefault();
        const moveCoords = getPointerCoords(moveEv);
        const curClientX = moveCoords.clientX;
        const curClientY = moveCoords.clientY;

        if (mode === "move") {
          const dxPx = curClientX - startClientX;
          const dyPx = curClientY - startClientY;

          // Inverse rotate delta by clip's rotation and scale
          const unrotDx = (dxPx * cosA + dyPx * sinA) / clipScaleX;
          const unrotDy = (-dxPx * sinA + dyPx * cosA) / clipScaleY;

          // Sub-pixel floating point precision with 2 decimals - matches clip move exactly
          const nextX = Number(
            Math.max(
              -100,
              Math.min(100, startMaskX + (unrotDx / dw) * 100),
            ).toFixed(2),
          );
          const nextY = Number(
            Math.max(
              -100,
              Math.min(100, startMaskY + (unrotDy / dh) * 100),
            ).toFixed(2),
          );

          currentUpdatedMask = {
            ...currentUpdatedMask,
            x: nextX,
            y: nextY,
          };
        } else if (mode === "rotate") {
          const curAngle = Math.atan2(
            curClientY - absMaskCenterY,
            curClientX - absMaskCenterX,
          );
          const angleDiffDeg = ((curAngle - startAngle) * 180) / Math.PI;
          const rawRotation = (startMaskRot + angleDiffDeg) % 360;
          const normalized = Math.round(((rawRotation % 360) + 360) % 360);
          let snapped = normalized;
          [0, 45, 90, 135, 180, 225, 270, 315, 360].forEach((snapAngle) => {
            if (Math.abs(normalized - snapAngle) < 4) snapped = snapAngle % 360;
          });
          if (snapped > 180) snapped -= 360;
          if (snapped < -180) snapped += 360;

          currentUpdatedMask = {
            ...currentUpdatedMask,
            rotation: snapped,
          };
        } else if (mode === "scale") {
          // Proportional diagonal corner resize identical to clip resize
          const curDist = Math.hypot(
            curClientX - absMaskCenterX,
            curClientY - absMaskCenterY,
          );
          const scaleRatio = curDist / startDist;
          const nextW = Number(
            Math.max(5, Math.min(250, startMaskW * scaleRatio)).toFixed(2),
          );
          const nextH = Number(
            Math.max(5, Math.min(250, startMaskH * scaleRatio)).toFixed(2),
          );
          const nextSize = Math.max(nextW, nextH);

          currentUpdatedMask = {
            ...currentUpdatedMask,
            size: nextSize,
            width: nextW,
            height: nextH,
          };
        } else if (mode === "scale-w") {
          // Width deformation handle (smooth, starts at exact 1.0 factor)
          const curVecX = curClientX - absMaskCenterX;
          const curVecY = curClientY - absMaskCenterY;
          const curLocalDistX = Math.abs(curVecX * cosTR + curVecY * sinTR);
          const scaleRatioX = curLocalDistX / startDistX;
          const nextW = Number(
            Math.max(5, Math.min(250, startMaskW * scaleRatioX)).toFixed(2),
          );

          currentUpdatedMask = {
            ...currentUpdatedMask,
            width: nextW,
            size: Math.max(nextW, currentUpdatedMask.height ?? startMaskH),
          };
        } else if (mode === "scale-h") {
          // Height deformation handle (smooth, starts at exact 1.0 factor)
          const curVecX = curClientX - absMaskCenterX;
          const curVecY = curClientY - absMaskCenterY;
          const curLocalDistY = Math.abs(-curVecX * sinTR + curVecY * cosTR);
          const scaleRatioY = curLocalDistY / startDistY;
          const nextH = Number(
            Math.max(5, Math.min(250, startMaskH * scaleRatioY)).toFixed(2),
          );

          currentUpdatedMask = {
            ...currentUpdatedMask,
            height: nextH,
            size: Math.max(currentUpdatedMask.width ?? startMaskW, nextH),
          };
        } else if (mode === "feather") {
          const dy = -(curClientY - startClientY);
          const nextFeather = Math.round(
            Math.max(0, Math.min(80, startMaskFeather + dy * 0.5)),
          );

          currentUpdatedMask = {
            ...currentUpdatedMask,
            feather: nextFeather,
          };
        }

        pendingMaskRef.current = currentUpdatedMask;
        scheduleMaskUpdateRef.current(currentUpdatedMask, false);
      };

      const onPointerUp = () => {
        setActiveDrag(null);

        const finalMask = pendingMaskRef.current;
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;

        scheduleMaskUpdateRef.current(finalMask, true);
      };

      const cleanup = () => {
        if (
          Platform.OS === "web" &&
          typeof window !== "undefined" &&
          typeof window.removeEventListener === "function"
        ) {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerUp);
          window.removeEventListener("touchmove", onPointerMove);
          window.removeEventListener("touchend", onPointerUp);
          window.removeEventListener("touchcancel", onPointerUp);
          window.removeEventListener("mousemove", onPointerMove);
          window.removeEventListener("mouseup", onPointerUp);
        }
      };
      dragCleanupRef.current = cleanup;

      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        typeof window.addEventListener === "function"
      ) {
        window.addEventListener("pointermove", onPointerMove, {
          passive: false,
        });
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        window.addEventListener("touchmove", onPointerMove, { passive: false });
        window.addEventListener("touchend", onPointerUp);
        window.addEventListener("touchcancel", onPointerUp);
        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);
      }
    },
    [
      localMask,
      maskCanvasCenterX,
      maskCanvasCenterY,
      clipScaleX,
      clipScaleY,
      cosA,
      sinA,
      dw,
      dh,
      targetClip.id,
      totalMaskRotation,
      maskBoxW,
      maskBoxH,
      canvasBoxRef,
      rendererRef,
    ],
  );

  const localMaskRef = useRef<MaskConfig>(localMask);
  localMaskRef.current = localMask;
  const dwRef = useRef(dw);
  dwRef.current = dw;
  const dhRef = useRef(dh);
  dhRef.current = dh;
  const clipScaleRef = useRef({ sx: clipScaleX, sy: clipScaleY });
  clipScaleRef.current = { sx: clipScaleX, sy: clipScaleY };
  const clipRotRef = useRef(clipRot);
  clipRotRef.current = clipRot;
  const maskBoxDimsRef = useRef({ w: maskBoxW, h: maskBoxH });
  maskBoxDimsRef.current = { w: maskBoxW, h: maskBoxH };
  const totalMaskRotRef = useRef(totalMaskRotation);
  totalMaskRotRef.current = totalMaskRotation;

  const scheduleMaskUpdate = useCallback(
    (nextMask: MaskConfig, isFinal = false) => {
      pendingMaskRef.current = nextMask;
      localMaskRef.current = nextMask;

      if (isFinal) {
        isDraggingRef.current = false;
        if (pendingMaskRafRef.current !== null) {
          cancelAnimationFrame(pendingMaskRafRef.current);
          pendingMaskRafRef.current = null;
        }
        setLocalMask(nextMask);
        if (rendererRef?.current && projectRef.current) {
          rendererRef.current.renderFrame(
            projectRef.current,
            currentTimeRef.current,
            false,
            boxWidthRef.current,
            canvasHeightRef.current,
            {
              clipId: targetClip.id,
              mask: nextMask,
            },
          );
        }
        onTransientMaskUpdateRef.current?.(targetClip.id, null);
        onUpdateClipMaskRef.current?.(targetClip.id, nextMask, true);
        return;
      }

      isDraggingRef.current = true;
      if (pendingMaskRafRef.current === null) {
        pendingMaskRafRef.current = requestAnimationFrame(() => {
          pendingMaskRafRef.current = null;
          const cur = pendingMaskRef.current;
          if (!cur) return;
          setLocalMask(cur);

          if (rendererRef?.current && projectRef.current) {
            rendererRef.current.renderFrame(
              projectRef.current,
              currentTimeRef.current,
              false,
              boxWidthRef.current,
              canvasHeightRef.current,
              {
                clipId: targetClip.id,
                mask: cur,
              },
            );
          } else {
            onTransientMaskUpdateRef.current?.(targetClip.id, cur);
          }
        });
      }
    },
    [rendererRef, targetClip.id],
  );
  const scheduleMaskUpdateRef = useRef(scheduleMaskUpdate);
  scheduleMaskUpdateRef.current = scheduleMaskUpdate;

  // Native Mobile PanResponder 1: Move Mask Center + Two-Finger Pinch Zoom
  const startMoveRef = useRef<{ startX: number; startY: number } | null>(null);
  const pinchStartRef = useRef<{ startDist: number; startW: number; startH: number } | null>(null);

  const nativeMovePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 1 || Math.abs(gs.dy) > 1,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        isDraggingRef.current = true;
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          setActiveDrag("scale");
          const dist = Math.hypot(
            touches[1].pageX - touches[0].pageX,
            touches[1].pageY - touches[0].pageY,
          );
          pinchStartRef.current = {
            startDist: Math.max(10, dist),
            startW: Math.max(5, localMaskRef.current.width ?? localMaskRef.current.size ?? 60),
            startH: Math.max(5, localMaskRef.current.height ?? localMaskRef.current.size ?? 60),
          };
          startMoveRef.current = null;
        } else {
          setActiveDrag("move");
          pinchStartRef.current = null;
          startMoveRef.current = {
            startX: localMaskRef.current.x || 0,
            startY: localMaskRef.current.y || 0,
          };
        }
      },
      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          const p = pinchStartRef.current;
          if (!p) {
            const dist = Math.hypot(
              touches[1].pageX - touches[0].pageX,
              touches[1].pageY - touches[0].pageY,
            );
            pinchStartRef.current = {
              startDist: Math.max(10, dist),
              startW: Math.max(5, localMaskRef.current.width ?? localMaskRef.current.size ?? 60),
              startH: Math.max(5, localMaskRef.current.height ?? localMaskRef.current.size ?? 60),
            };
            return;
          }
          const curDist = Math.hypot(
            touches[1].pageX - touches[0].pageX,
            touches[1].pageY - touches[0].pageY,
          );
          const ratio = Math.max(0.1, curDist / p.startDist);
          const nextW = Number(Math.max(5, Math.min(250, p.startW * ratio)).toFixed(2));
          const nextH = Number(Math.max(5, Math.min(250, p.startH * ratio)).toFixed(2));
          const nextMask: MaskConfig = {
            ...localMaskRef.current,
            width: nextW,
            height: nextH,
            size: Math.max(nextW, nextH),
          };
          scheduleMaskUpdateRef.current(nextMask, false);
          return;
        }

        const s = startMoveRef.current;
        if (!s) return;
        const rotRad = (clipRotRef.current * Math.PI) / 180;
        const cosA = Math.cos(rotRad);
        const sinA = Math.sin(rotRad);
        const sx = clipScaleRef.current.sx;
        const sy = clipScaleRef.current.sy;
        const dwVal = Math.max(1, dwRef.current);
        const dhVal = Math.max(1, dhRef.current);

        const unrotDx = (gs.dx * cosA + gs.dy * sinA) / sx;
        const unrotDy = (-gs.dx * sinA + gs.dy * cosA) / sy;

        const nextX = Number(
          Math.max(
            -100,
            Math.min(100, s.startX + (unrotDx / dwVal) * 100),
          ).toFixed(2),
        );
        const nextY = Number(
          Math.max(
            -100,
            Math.min(100, s.startY + (unrotDy / dhVal) * 100),
          ).toFixed(2),
        );

        const nextMask: MaskConfig = {
          ...localMaskRef.current,
          x: nextX,
          y: nextY,
        };
        scheduleMaskUpdateRef.current(nextMask, false);
      },
      onPanResponderRelease: () => {
        setActiveDrag(null);
        scheduleMaskUpdateRef.current(localMaskRef.current, true);
        startMoveRef.current = null;
        pinchStartRef.current = null;
      },
    }),
  ).current;

  // Native Mobile PanResponder 2: Rotate Knob at Top
  const startRotStateRef = useRef<{
    startRot: number;
    initialTouchAngle: number;
  } | null>(null);

  const nativeRotPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setActiveDrag("rotate");
        isDraggingRef.current = true;
        const totRotRad = (totalMaskRotRef.current * Math.PI) / 180;
        const initialAngle = -Math.PI / 2 + totRotRad;
        startRotStateRef.current = {
          startRot: localMaskRef.current.rotation || 0,
          initialTouchAngle: initialAngle,
        };
      },
      onPanResponderMove: (_, gs) => {
        const s = startRotStateRef.current;
        if (!s) return;
        const mbH = maskBoxDimsRef.current.h;
        const dist = mbH / 2 + 46;
        const v0x = dist * Math.cos(s.initialTouchAngle);
        const v0y = dist * Math.sin(s.initialTouchAngle);

        const curVx = v0x + gs.dx;
        const curVy = v0y + gs.dy;

        const angleDiffDeg =
          ((Math.atan2(curVy, curVx) - Math.atan2(v0y, v0x)) * 180) / Math.PI;
        const rawRot = (s.startRot + angleDiffDeg) % 360;
        const normalized = Math.round(((rawRot % 360) + 360) % 360);
        let snapped = normalized;
        [0, 45, 90, 135, 180, 225, 270, 315, 360].forEach((snap) => {
          if (Math.abs(normalized - snap) < 4) snapped = snap % 360;
        });
        if (snapped > 180) snapped -= 360;
        if (snapped < -180) snapped += 360;

        const nextMask: MaskConfig = {
          ...localMaskRef.current,
          rotation: snapped,
        };
        scheduleMaskUpdateRef.current(nextMask, false);
      },
      onPanResponderRelease: () => {
        setActiveDrag(null);
        scheduleMaskUpdateRef.current(localMaskRef.current, true);
        startRotStateRef.current = null;
      },
    }),
  ).current;

  // Directional Corner & Side Scaling Helper Factory
  const makeCornerResponder = (signX: number, signY: number) => {
    let startW = 60;
    let startH = 60;
    let startHalfW = 30;
    let startHalfH = 30;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setActiveDrag("scale");
        isDraggingRef.current = true;
        startW = Math.max(5, localMaskRef.current.width ?? localMaskRef.current.size ?? 60);
        startH = Math.max(5, localMaskRef.current.height ?? localMaskRef.current.size ?? 60);
        startHalfW = Math.max(10, maskBoxDimsRef.current.w / 2);
        startHalfH = Math.max(10, maskBoxDimsRef.current.h / 2);
      },
      onPanResponderMove: (_, gs) => {
        const totRad = (totalMaskRotRef.current * Math.PI) / 180;
        const cosR = Math.cos(totRad);
        const sinR = Math.sin(totRad);

        const localDx = gs.dx * cosR + gs.dy * sinR;
        const localDy = -gs.dx * sinR + gs.dy * cosR;

        const projX = localDx * signX;
        const projY = localDy * signY;

        const scaleX = (startHalfW + projX) / startHalfW;
        const scaleY = (startHalfH + projY) / startHalfH;
        const scale = Math.max(0.08, (scaleX + scaleY) / 2);

        const nextW = Number(Math.max(5, Math.min(250, startW * scale)).toFixed(2));
        const nextH = Number(Math.max(5, Math.min(250, startH * scale)).toFixed(2));

        const nextMask: MaskConfig = {
          ...localMaskRef.current,
          size: Math.max(nextW, nextH),
          width: nextW,
          height: nextH,
        };
        scheduleMaskUpdateRef.current(nextMask, false);
      },
      onPanResponderRelease: () => {
        setActiveDrag(null);
        scheduleMaskUpdateRef.current(localMaskRef.current, true);
      },
    });
  };

  const makeSideWResponder = (signX: number) => {
    let startW = 60;
    let startHalfW = 30;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setActiveDrag("scale-w");
        isDraggingRef.current = true;
        startW = Math.max(5, localMaskRef.current.width ?? localMaskRef.current.size ?? 60);
        startHalfW = Math.max(10, maskBoxDimsRef.current.w / 2);
      },
      onPanResponderMove: (_, gs) => {
        const totRad = (totalMaskRotRef.current * Math.PI) / 180;
        const cosR = Math.cos(totRad);
        const sinR = Math.sin(totRad);

        const localDx = gs.dx * cosR + gs.dy * sinR;
        const projX = localDx * signX;
        const scale = Math.max(0.08, (startHalfW + projX) / startHalfW);

        const nextW = Number(Math.max(5, Math.min(250, startW * scale)).toFixed(2));
        const nextMask: MaskConfig = {
          ...localMaskRef.current,
          width: nextW,
          size: Math.max(nextW, localMaskRef.current.height ?? 60),
        };
        scheduleMaskUpdateRef.current(nextMask, false);
      },
      onPanResponderRelease: () => {
        setActiveDrag(null);
        scheduleMaskUpdateRef.current(localMaskRef.current, true);
      },
    });
  };

  const makeSideHResponder = (signY: number) => {
    let startH = 60;
    let startHalfH = 30;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setActiveDrag("scale-h");
        isDraggingRef.current = true;
        startH = Math.max(5, localMaskRef.current.height ?? localMaskRef.current.size ?? 60);
        startHalfH = Math.max(10, maskBoxDimsRef.current.h / 2);
      },
      onPanResponderMove: (_, gs) => {
        const totRad = (totalMaskRotRef.current * Math.PI) / 180;
        const cosR = Math.cos(totRad);
        const sinR = Math.sin(totRad);

        const localDy = -gs.dx * sinR + gs.dy * cosR;
        const projY = localDy * signY;
        const scale = Math.max(0.08, (startHalfH + projY) / startHalfH);

        const nextH = Number(Math.max(5, Math.min(250, startH * scale)).toFixed(2));
        const nextMask: MaskConfig = {
          ...localMaskRef.current,
          height: nextH,
          size: Math.max(localMaskRef.current.width ?? 60, nextH),
        };
        scheduleMaskUpdateRef.current(nextMask, false);
      },
      onPanResponderRelease: () => {
        setActiveDrag(null);
        scheduleMaskUpdateRef.current(localMaskRef.current, true);
      },
    });
  };

  const nativeScaleCornerBR = useRef(makeCornerResponder(1, 1)).current;
  const nativeScaleCornerBL = useRef(makeCornerResponder(-1, 1)).current;
  const nativeScaleCornerTR = useRef(makeCornerResponder(1, -1)).current;
  const nativeScaleCornerTL = useRef(makeCornerResponder(-1, -1)).current;

  const nativeScaleWRight = useRef(makeSideWResponder(1)).current;
  const nativeScaleWLeft = useRef(makeSideWResponder(-1)).current;

  const nativeScaleHTop = useRef(makeSideHResponder(-1)).current;
  const nativeScaleHBottom = useRef(makeSideHResponder(1)).current;

  let nativeFeatherStart = 0;
  const nativeFeatherDrag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setActiveDrag("feather");
        isDraggingRef.current = true;
        nativeFeatherStart = localMaskRef.current.feather ?? 0;
      },
      onPanResponderMove: (_, gesture) => {
        const feather = Math.round(Math.max(0, Math.min(80, nativeFeatherStart - gesture.dy * 0.5)));
        scheduleMaskUpdateRef.current({ ...localMaskRef.current, feather }, false);
      },
      onPanResponderRelease: () => {
        setActiveDrag(null);
        scheduleMaskUpdateRef.current(localMaskRef.current, true);
      },
    }),
  ).current;



  if (localMask.shape === "none") {
    return null;
  }

  const isLinear = localMask.shape === "linear";
  const isMirror = localMask.shape === "mirror";
  const isLineShape = isLinear || isMirror;

  return (
    <View
      ref={containerRef}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {/* Top HUD Display for interactive mask parameters */}
      <View style={styles.topHudContainer} pointerEvents="none">
        <View style={styles.hudPill}>
          <View style={styles.hudBadge}>
            <Ionicons name="scan-outline" size={12} color={THEME_COLORS.accent} />
            <Text style={styles.hudTitle}>
              {localMask.shape.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.hudText}>
            Softness: {localMask.feather || 0}%
          </Text>
          {localMask.rotation !== 0 && (
            <Text style={styles.hudText}>
              {localMask.rotation}°
            </Text>
          )}
        </View>
      </View>

      {/* Layer 1: Canvas-Bounded Visuals (strictly clipped to player boundaries) */}
      <View style={styles.canvasClipBounds} pointerEvents="none">
        <View
          style={[
            styles.maskContainer,
            {
              left: 0,
              top: 0,
              width: maskBoxW,
              height: maskBoxH,
              transform: [
                { translateX: maskCanvasCenterX - maskBoxW / 2 },
                { translateY: maskCanvasCenterY - maskBoxH / 2 },
                { rotate: `${totalMaskRotation}deg` },
              ],
            },
          ]}
          pointerEvents="none"
        >
          {/* Mask Visuals: Parallel Linear (Mirror) Lines & Shaded Band */}
          {isMirror && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[styles.mirrorLine, { top: 0 }]} />
              <View style={[styles.mirrorLine, { bottom: 0 }]} />
              <View style={styles.shapeFill} />
            </View>
          )}

          {/* Mask Visuals: Single Linear (Split) Line & Shaded Half */}
          {isLinear && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.linearSplitLine} />
              <View style={styles.linearHalfFill} />
            </View>
          )}

          {/* Outer dashed bounding box - ONLY for non-line shapes (circle, rect, heart, star) */}
          {!isLineShape && (
            <View style={styles.boundingDashedBox} pointerEvents="none" />
          )}

          {/* Center Crosshair Lines - ONLY for non-line shapes */}
          {!isLineShape && (
            <>
              <View style={styles.crosshairH} pointerEvents="none" />
              <View style={styles.crosshairV} pointerEvents="none" />
              <View style={styles.crosshairCenterDot} pointerEvents="none" />
            </>
          )}

          {/* Mask Shape Outlines for Circle & Rectangle */}
          {localMask.shape === "circle" && (
            <View
              style={[
                styles.shapeCircle,
                {
                  width: Math.max(2, maskBoxW - 2),
                  height: Math.max(2, maskBoxH - 2),
                  borderRadius: Math.max(maskBoxW, maskBoxH),
                },
              ]}
              pointerEvents="none"
            />
          )}

          {localMask.shape === "rectangle" && (
            <View
              style={[
                styles.shapeRectangle,
                {
                  width: Math.max(2, maskBoxW - 2),
                  height: Math.max(2, maskBoxH - 2),
                  borderRadius: Math.min(
                    localMask.roundness ?? 16,
                    Math.min(maskBoxW, maskBoxH) / 2,
                  ),
                },
              ]}
              pointerEvents="none"
            />
          )}

          {(localMask.shape === "heart" || localMask.shape === "star") && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: maskBoxW,
                height: maskBoxH,
                justifyContent: "center",
                alignItems: "center",
              }}
              pointerEvents="none"
            >
              {Platform.OS === "web" ? (
                <svg
                  viewBox="0 0 100 100"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "visible",
                  }}
                >
                  {localMask.shape === "heart" ? (
                    <path
                      d="M 50 96 C 22 72 0 56 0 40 A 25 25 0 0 1 50 40 A 25 25 0 0 1 100 40 C 100 56 78 72 50 96 Z"
                      fill="rgba(0, 242, 254, 0.12)"
                      stroke="#00F2FE"
                      strokeWidth="2.5"
                    />
                  ) : (
                    <polygon
                      points="50,2 63,38 100,38 69,60 82,98 50,75 18,98 31,60 0,38 37,38"
                      fill="rgba(0, 242, 254, 0.12)"
                      stroke="#00F2FE"
                      strokeWidth="2.5"
                    />
                  )}
                </svg>
              ) : (
                <ExpoImage
                  source={{
                    uri: `data:image/svg+xml;base64,${Buffer.from(
                      localMask.shape === "heart"
                        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${maskBoxW}" height="${maskBoxH}"><path d="M 50 96 C 22 72 0 56 0 40 A 25 25 0 0 1 50 40 A 25 25 0 0 1 100 40 C 100 56 78 72 50 96 Z" fill="rgba(0, 242, 254, 0.12)" stroke="#00F2FE" stroke-width="2.5"/></svg>`
                        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${maskBoxW}" height="${maskBoxH}"><polygon points="50,2 63,38 100,38 69,60 82,98 50,75 18,98 31,60 0,38 37,38" fill="rgba(0, 242, 254, 0.12)" stroke="#00F2FE" stroke-width="2.5"/></svg>`
                    ).toString("base64")}`,
                  }}
                  style={{
                    width: maskBoxW,
                    height: maskBoxH,
                  }}
                  contentFit="fill"
                  cachePolicy="memory"
                />
              )}
            </View>
          )}
        </View>
      </View>

      {/* Layer 2: Interactive Controls & Handles (unclipped for smooth dragging & rotation) */}
      <View
        style={[
          styles.maskContainer,
          {
            left: 0,
            top: 0,
            width: maskBoxW,
            height: maskBoxH,
            transform: [
              { translateX: maskCanvasCenterX - maskBoxW / 2 },
              { translateY: maskCanvasCenterY - maskBoxH / 2 },
              { rotate: `${totalMaskRotation}deg` },
            ],
          },
        ]}
        collapsable={false}
        pointerEvents="box-none"
      >
        {/* Interior Drag Surface for non-line shapes (circle, rect, heart, star) */}
        {!isLineShape && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "transparent" },
            ]}
            collapsable={false}
            pointerEvents="auto"
            {...(Platform.OS === "web"
              ? ({
                  onMouseDown: (e: any) => startDrag(e, "move"),
                  onTouchStart: (e: any) => startDrag(e, "move"),
                } as any)
              : nativeMovePanResponder.panHandlers)}
          />
        )}
        {/* Touch drag strip for Linear Split Line */}
        {isLinear && (
          <View
            style={styles.linearTouchStrip}
            collapsable={false}
            {...(Platform.OS === "web"
              ? ({
                  onMouseDown: (e: any) => startDrag(e, "move"),
                  onTouchStart: (e: any) => startDrag(e, "move"),
                } as any)
              : nativeMovePanResponder.panHandlers)}
          />
        )}

        {/* Touch drag strip for Mirror Band */}
        {isMirror && (
          <View
            style={styles.mirrorTouchStrip}
            collapsable={false}
            {...(Platform.OS === "web"
              ? ({
                  onMouseDown: (e: any) => startDrag(e, "move"),
                  onTouchStart: (e: any) => startDrag(e, "move"),
                } as any)
              : nativeMovePanResponder.panHandlers)}
          />
        )}

        {/* Center Move Knob for Linear & Mirror (Clean circular handle, no box!) */}
        {isLineShape && (
          <View
            style={styles.lineCenterMoveHandle}
            collapsable={false}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...(Platform.OS === "web"
              ? ({
                  onMouseDown: (e: any) => startDrag(e, "move"),
                  onTouchStart: (e: any) => startDrag(e, "move"),
                } as any)
              : nativeMovePanResponder.panHandlers)}
          >
            <Ionicons name="move" size={13} color="#000000" />
          </View>
        )}

        {/* Top Rotation Control Handle (always available for rotating mask angle) */}
        <View style={styles.rotStemTop} pointerEvents="none" />
        <View
          style={styles.rotKnobTop}
          collapsable={false}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "rotate"),
                onTouchStart: (e: any) => startDrag(e, "rotate"),
              } as any)
            : nativeRotPanResponder.panHandlers)}
        >
          <Ionicons name="sync-outline" size={14} color="#000000" />
        </View>

        {/* Corner dots & Width pill handles ONLY for non-line shapes (circle, rect, heart, star) */}
        {!isLineShape && (
          <>
            <View
              style={[styles.cornerDot, styles.dotTL]}
              collapsable={false}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale"),
                    onTouchStart: (e: any) => startDrag(e, "scale"),
                  } as any)
                : nativeScaleCornerTL.panHandlers)}
            />
            <View
              style={[styles.cornerDot, styles.dotTR]}
              collapsable={false}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale"),
                    onTouchStart: (e: any) => startDrag(e, "scale"),
                  } as any)
                : nativeScaleCornerTR.panHandlers)}
            />
            <View
              style={[styles.cornerDot, styles.dotBL]}
              collapsable={false}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale"),
                    onTouchStart: (e: any) => startDrag(e, "scale"),
                  } as any)
                : nativeScaleCornerBL.panHandlers)}
            />
            <View
              style={[styles.cornerDot, styles.dotBR]}
              collapsable={false}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale"),
                    onTouchStart: (e: any) => startDrag(e, "scale"),
                  } as any)
                : nativeScaleCornerBR.panHandlers)}
            />

            <View
              style={[styles.pillHandleV, styles.pillLeft]}
              collapsable={false}
              hitSlop={{ top: 14, bottom: 14, left: 16, right: 16 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale-w"),
                    onTouchStart: (e: any) => startDrag(e, "scale-w"),
                  } as any)
                : nativeScaleWLeft.panHandlers)}
            />
            <View
              style={[styles.pillHandleV, styles.pillRight]}
              collapsable={false}
              hitSlop={{ top: 14, bottom: 14, left: 16, right: 16 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale-w"),
                    onTouchStart: (e: any) => startDrag(e, "scale-w"),
                  } as any)
                : nativeScaleWRight.panHandlers)}
            />
          </>
        )}

        {/* Height adjustment pills for shapes with height (rectangle, mirror, heart, star; NOT linear) */}
        {localMask.shape !== "linear" && (
          <>
            <View
              style={[styles.pillHandleH, styles.pillTop]}
              collapsable={false}
              hitSlop={{ top: 16, bottom: 16, left: 14, right: 14 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale-h"),
                    onTouchStart: (e: any) => startDrag(e, "scale-h"),
                  } as any)
                : nativeScaleHTop.panHandlers)}
            />
            <View
              style={[styles.pillHandleH, styles.pillBottom]}
              collapsable={false}
              hitSlop={{ top: 16, bottom: 16, left: 14, right: 14 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale-h"),
                    onTouchStart: (e: any) => startDrag(e, "scale-h"),
                  } as any)
                : nativeScaleHBottom.panHandlers)}
            />
          </>
        )}


      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  featherHandleWrap: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10003,
  },
  featherPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#141416",
    borderWidth: 1.5,
    borderColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 8,
  },
  topHudContainer: {
    position: "absolute",
    top: 10,
    left: 8,
    right: 8,
    zIndex: 10001,
    alignItems: "center",
  },
  hudPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(24, 24, 26, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME_COLORS.cyanBorder,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  hudBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hudTitle: {
    color: THEME_COLORS.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  hudText: {
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "600",
  },
  hudActionBtn: {
    backgroundColor: THEME_COLORS.cyanBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: THEME_COLORS.cyanBorder,
  },
  hudActionText: {
    color: THEME_COLORS.accent,
    fontSize: 10,
    fontWeight: "700",
  },
  maskContainer: {
    position: "absolute",
    zIndex: 10000,
    alignItems: "center",
    justifyContent: "center",
    willChange: "transform" as any,
    transition: "none" as any,
    cursor: "move" as any,
  },
  boundingDashedBox: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.75)",
    borderStyle: "dashed",
  },
  crosshairH: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    marginTop: -0.5,
  },
  crosshairV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    marginLeft: -0.5,
  },
  crosshairCenterDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME_COLORS.accent,
    top: "50%",
    left: "50%",
    marginTop: -3,
    marginLeft: -3,
  },
  shapeCircle: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  shapeRectangle: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#00F2FE",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  canvasClipBounds: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    borderRadius: 8,
    ...(Platform.OS === "web"
      ? ({ clipPath: "inset(0 round 8px)" } as any)
      : {}),
  },
  lineCenterMoveHandle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: THEME_COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -13,
    marginTop: -13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 10015,
    cursor: "move" as any,
  },
  linearTouchStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 48,
    marginTop: -24,
    backgroundColor: "transparent",
    cursor: "move" as any,
    zIndex: 10005,
  },
  mirrorTouchStrip: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
    cursor: "move" as any,
    zIndex: 10005,
  },
  mirrorLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: "#00F2FE",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  shapeFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  linearSplitLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 2.5,
    backgroundColor: "#00F2FE",
    marginTop: -1.25,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  linearHalfFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1600,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
  },
  heartStarMobileBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  rotStemTop: {
    position: "absolute",
    top: -46,
    left: "50%",
    width: 2,
    height: 46,
    backgroundColor: THEME_COLORS.accent,
    marginLeft: -1,
    zIndex: 10014,
  },
  rotKnobTop: {
    position: "absolute",
    top: -46,
    left: "50%",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: THEME_COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 10015,
    cursor: "grab" as any,
  },
  cornerDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: THEME_COLORS.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 6,
    zIndex: 10010,
  },
  dotTL: {
    top: -7,
    left: -7,
    cursor: "nwse-resize" as any,
  },
  dotTR: {
    top: -7,
    right: -7,
    cursor: "nesw-resize" as any,
  },
  dotBL: {
    bottom: -7,
    left: -7,
    cursor: "nesw-resize" as any,
  },
  dotBR: {
    bottom: -7,
    right: -7,
    cursor: "nwse-resize" as any,
  },
  pillHandleV: {
    position: "absolute",
    width: 12,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: THEME_COLORS.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 7,
    zIndex: 10012,
    cursor: "ew-resize" as any,
  },
  pillLeft: {
    top: "50%",
    left: -6,
    marginTop: -16,
  },
  pillRight: {
    top: "50%",
    right: -6,
    marginTop: -16,
  },
  pillHandleH: {
    position: "absolute",
    width: 32,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: THEME_COLORS.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 7,
    zIndex: 10012,
    cursor: "ns-resize" as any,
  },
  pillTop: {
    left: "50%",
    top: -6,
    marginLeft: -16,
  },
  pillBottom: {
    left: "50%",
    bottom: -6,
    marginLeft: -16,
  },
} as any);
