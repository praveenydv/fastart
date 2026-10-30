import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, PanResponder } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MaskConfig, MaskShape } from "../../types/project";
import { soundEngine } from "../../utils/audioEngine";
import { getInterpolatedMask } from "../../utils/keyframeEngine";
import { getPointerCoords } from "../Timeline";
import { THEME_COLORS } from "../../constants/designConstants";

interface PlayerMaskOverlayProps {
  targetClip: any;
  boxWidth: number;
  canvasHeight: number;
  currentTime: number;
  project?: any;
  onUpdateClipMask?: (clipId: string, mask: MaskConfig, isFinal?: boolean) => void;
  onCloseMaskPreview?: () => void;
  getInterpolatedTransform?: (clip: any, curTime: number, clipType?: string) => any;
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

  const [activeDrag, setActiveDrag] = useState<"move" | "rotate" | "scale" | "scale-w" | "scale-h" | "feather" | null>(null);
  const [localMask, setLocalMask] = useState<MaskConfig>(mask);

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
    setLocalMask(mask);
  }, [mask]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      if (pendingMaskRafRef.current !== null) {
        cancelAnimationFrame(pendingMaskRafRef.current);
        pendingMaskRafRef.current = null;
      }
    };
  }, []);

  const onUpdateClipMaskRef = useRef(onUpdateClipMask);
  onUpdateClipMaskRef.current = onUpdateClipMask;

  // Clip transform on canvas
  const clipT = useMemo(() => {
    if (getInterpolatedTransform) {
      return getInterpolatedTransform(targetClip, currentTime, "video");
    }
    return targetClip?.transform || { x: 0, y: 0, scale: 1, rotation: 0 };
  }, [getInterpolatedTransform, targetClip, currentTime]);

  const clipCx = boxWidth / 2 + (clipT.x || 0);
  const clipCy = canvasHeight / 2 + (clipT.y || 0);
  const clipScaleX = Math.max(0.01, Math.abs((clipT.scale || 1.0) * (clipT.scaleX ?? 1.0)));
  const clipScaleY = Math.max(0.01, Math.abs((clipT.scale || 1.0) * (clipT.scaleY ?? 1.0)));
  const clipScale = Math.max(0.01, Math.abs(clipT.scale || 1.0));
  const clipRot = clipT.rotation || 0;

  // Calculate dw and dh of the clip inside canvas exactly matching rendererClip.ts
  const { dw, dh } = useMemo(() => {
    if (rendererRef?.current?.getClipRenderDimensions) {
      const dims = rendererRef.current.getClipRenderDimensions(targetClip, boxWidth, canvasHeight);
      if (dims && dims.dw > 0 && dims.dh > 0) return { dw: dims.dw, dh: dims.dh };
    }
    const naturalDims = rendererRef?.current?.getMediaNaturalDimensions(targetClip?.url);
    const nw = naturalDims?.width || targetClip?.naturalWidth || targetClip?.width || 1920;
    const nh = naturalDims?.height || targetClip?.naturalHeight || targetClip?.height || 1080;

    const crop = targetClip?.crop || targetClip?.transform?.crop;
    let sw = nw;
    let sh = nh;
    if (crop && crop.width > 0 && crop.height > 0) {
      sw = (crop.width / 100) * nw;
      sh = (crop.height / 100) * nh;
    }

    const aspect = (sw / sh) || (16 / 9);
    let w = boxWidth;
    let h = boxWidth / aspect;
    const fitMode = targetClip?.fit || "contain";

    if (fitMode === "cover") {
      if (h < canvasHeight) {
        h = canvasHeight;
        w = canvasHeight * aspect;
      }
    } else {
      if (h > canvasHeight) {
        h = canvasHeight;
        w = canvasHeight * aspect;
      }
    }
    return { dw: w, dh: h };
  }, [rendererRef, targetClip, boxWidth, canvasHeight]);

  const currentX = localMask.x || 0;
  const currentY = localMask.y || 0;
  const currentRot = localMask.rotation || 0;
  const currentSize = Math.max(5, Math.min(250, localMask.size ?? 60));
  const currentW = Math.max(5, Math.min(250, localMask.width ?? localMask.size ?? 60));
  const currentH = Math.max(5, Math.min(250, localMask.height ?? localMask.size ?? 60));

  // Compute canvas pixel position of mask center
  const rad = (clipRot * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const localOffsetX = (currentX / 100) * dw * clipScaleX;
  const localOffsetY = (currentY / 100) * dh * clipScaleY;

  const maskCanvasCenterX = clipCx + (localOffsetX * cosA - localOffsetY * sinA);
  const maskCanvasCenterY = clipCy + (localOffsetX * sinA + localOffsetY * cosA);
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

    return (
      <>
        {/* Outer dashed bounding box */}
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
          <g transform={`translate(${w / 2}, ${h / 2}) scale(${w / 100}, ${h / 100})`}>
            <path
              d="M 0,44 C -28,18 -50,0 -50,-20 A 25,25 0 0,1 0,-20 A 25,25 0 0,1 50,-20 C 50,0 28,18 0,44 Z"
              fill="rgba(0, 242, 254, 0.08)"
              stroke="#00F2FE"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}

        {shape === "star" && (() => {
          const points: string[] = [];
          for (let i = 0; i < 10; i++) {
            const radiusFactor = i % 2 === 0 ? 0.5 : 0.21;
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            points.push(`${w / 2 + w * radiusFactor * Math.cos(a)},${h / 2 + h * radiusFactor * Math.sin(a)}`);
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
            <line x1={0} y1={0} x2={w} y2={0} stroke="#00F2FE" strokeWidth="2.5" />
            <line x1={0} y1={h} x2={w} y2={h} stroke="#00F2FE" strokeWidth="2.5" />
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
    (e: any, mode: "move" | "rotate" | "scale" | "scale-w" | "scale-h" | "feather") => {
      if (e.stopPropagation) e.stopPropagation();
      if (e.cancelable && e.preventDefault) e.preventDefault();

      soundEngine.playSfx("click");
      setActiveDrag(mode);

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
        const el = canvasBoxRef?.current || containerRef.current || rendererRef?.current?.canvas;
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
        Math.hypot(startClientX - absMaskCenterX, startClientY - absMaskCenterY),
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
            Math.max(-100, Math.min(100, startMaskX + (unrotDx / dw) * 100)).toFixed(2),
          );
          const nextY = Number(
            Math.max(-100, Math.min(100, startMaskY + (unrotDy / dh) * 100)).toFixed(2),
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
          const nextW = Number(Math.max(5, Math.min(250, startMaskW * scaleRatio)).toFixed(2));
          const nextH = Number(Math.max(5, Math.min(250, startMaskH * scaleRatio)).toFixed(2));
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
          const nextW = Number(Math.max(5, Math.min(250, startMaskW * scaleRatioX)).toFixed(2));

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
          const nextH = Number(Math.max(5, Math.min(250, startMaskH * scaleRatioY)).toFixed(2));

          currentUpdatedMask = {
            ...currentUpdatedMask,
            height: nextH,
            size: Math.max(currentUpdatedMask.width ?? startMaskW, nextH),
          };
        } else if (mode === "feather") {
          const dy = -(curClientY - startClientY);
          const nextFeather = Math.round(Math.max(0, Math.min(80, startMaskFeather + dy * 0.5)));

          currentUpdatedMask = {
            ...currentUpdatedMask,
            feather: nextFeather,
          };
        }

        pendingMaskRef.current = currentUpdatedMask;

        if (pendingMaskRafRef.current === null) {
          pendingMaskRafRef.current = requestAnimationFrame(() => {
            pendingMaskRafRef.current = null;
            const targetMask = pendingMaskRef.current;
            setLocalMask(targetMask);

            // Directly render live mask preview on canvas at 60fps without full project re-render
            if (rendererRef?.current && projectRef.current) {
              rendererRef.current.renderFrame(
                projectRef.current,
                currentTimeRef.current,
                false,
                boxWidthRef.current,
                canvasHeightRef.current,
                {
                  clipId: targetClip.id,
                  mask: targetMask,
                },
              );
            }
          });
        }
      };

      const onPointerUp = () => {
        setActiveDrag(null);
        soundEngine.playSfx("pop");

        if (pendingMaskRafRef.current !== null) {
          cancelAnimationFrame(pendingMaskRafRef.current);
          pendingMaskRafRef.current = null;
        }

        const finalMask = pendingMaskRef.current;
        setLocalMask(finalMask);

        dragCleanupRef.current?.();
        dragCleanupRef.current = null;

        onUpdateClipMaskRef.current?.(targetClip.id, finalMask, true);
      };

      const cleanup = () => {
        if (typeof window !== "undefined") {
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

      if (typeof window !== "undefined") {
        window.addEventListener("pointermove", onPointerMove, { passive: false });
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

  const handleResetPosition = () => {
    soundEngine.playSfx("click");
    const updated = { ...localMask, x: 0, y: 0 };
    setLocalMask(updated);
    onUpdateClipMaskRef.current?.(targetClip.id, updated, true);
  };

  const handleResetRotation = () => {
    soundEngine.playSfx("click");
    const updated = { ...localMask, rotation: 0 };
    setLocalMask(updated);
    onUpdateClipMaskRef.current?.(targetClip.id, updated, true);
  };

  if (localMask.shape === "none") {
    return null;
  }

  return (
    <View ref={containerRef} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Top Floating HUD with Live Position, Rotation, Size & Reset Controls */}
      <View style={styles.topHudContainer} pointerEvents="box-none">
        <View style={styles.hudPill} pointerEvents="auto">
          <View style={styles.hudBadge}>
            <Ionicons
              name={
                localMask.shape === "heart"
                  ? "heart"
                  : localMask.shape === "star"
                  ? "star"
                  : localMask.shape === "circle"
                  ? "radio-button-on"
                  : "shapes"
              }
              size={13}
              color={THEME_COLORS.accent}
            />
            <Text style={styles.hudTitle}>
              {localMask.shape === "heart"
                ? "Love Heart"
                : localMask.shape === "star"
                ? "Star"
                : localMask.shape === "circle"
                ? "Circle"
                : localMask.shape === "rectangle"
                ? "Rectangle"
                : localMask.shape === "linear"
                ? "Split"
                : "Mirror"}
            </Text>
          </View>

          <Text style={styles.hudText}>
            X:{currentX}% Y:{currentY}% • {currentRot}° • W:{currentW}% H:{currentH}%
          </Text>

          {(currentX !== 0 || currentY !== 0) && (
            <TouchableOpacity
              style={styles.hudActionBtn}
              onPress={handleResetPosition}
              activeOpacity={0.7}
            >
              <Text style={styles.hudActionText}>Center</Text>
            </TouchableOpacity>
          )}

          {currentRot !== 0 && (
            <TouchableOpacity
              style={styles.hudActionBtn}
              onPress={handleResetRotation}
              activeOpacity={0.7}
            >
              <Text style={styles.hudActionText}>0°</Text>
            </TouchableOpacity>
          )}

          {onCloseMaskPreview && (
            <TouchableOpacity
              style={[
                styles.hudActionBtn,
                {
                  backgroundColor: "rgba(16, 185, 129, 0.2)",
                  borderColor: "rgba(16, 185, 129, 0.5)",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                },
              ]}
              onPress={() => {
                soundEngine.playSfx("pop");
                if (targetClip?.id && onUpdateClipMask) {
                  onUpdateClipMask(targetClip.id, localMask, true);
                }
                onCloseMaskPreview();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityLabel="Confirm and close mask"
            >
              <Ionicons name="checkmark" size={13} color="#10B981" />
              <Text style={{ color: "#10B981", fontSize: 10, fontWeight: "700" }}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Mask Interactive Bounding Box on Canvas */}
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
        {...(Platform.OS === "web"
          ? ({
              onMouseDown: (e: any) => startDrag(e, "move"),
              onTouchStart: (e: any) => startDrag(e, "move"),
            } as any)
          : {})}
      >
        {/* SVG Outline for the Mask Shape */}
        {Platform.OS === "web" && (
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: maskBoxW,
              height: maskBoxH,
              overflow: "visible",
              pointerEvents: "none",
              filter: `drop-shadow(0 0 6px ${THEME_COLORS.cyanBorder})`,
            }}
            viewBox={`0 0 ${maskBoxW} ${maskBoxH}`}
          >
            {shapeSvgContent}
          </svg>
        )}

        {/* Top Rotation Control Handle (Moved to top per user request, replacing arrow) */}
        <View style={styles.rotStemTop} pointerEvents="none" />
        <View
          style={styles.rotKnobTop}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "rotate"),
                onTouchStart: (e: any) => startDrag(e, "rotate"),
              } as any)
            : {})}
        >
          <Ionicons name="sync-outline" size={15} color="#000000" />
        </View>

        {/* 4 Corner Solid White Resize Dots */}
        <View
          style={[styles.cornerDot, styles.dotTL]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
              } as any)
            : {})}
        />
        <View
          style={[styles.cornerDot, styles.dotTR]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
              } as any)
            : {})}
        />
        <View
          style={[styles.cornerDot, styles.dotBL]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
              } as any)
            : {})}
        />
        <View
          style={[styles.cornerDot, styles.dotBR]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
              } as any)
            : {})}
        />

        {/* 4 Side Deformation White Capsule/Pill Handles (Left & Right for Width, Top & Bottom for Height) */}
        <View
          style={[styles.pillHandleV, styles.pillLeft]}
          hitSlop={{ top: 10, bottom: 10, left: 14, right: 14 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale-w"),
                onTouchStart: (e: any) => startDrag(e, "scale-w"),
              } as any)
            : {})}
        />
        <View
          style={[styles.pillHandleV, styles.pillRight]}
          hitSlop={{ top: 10, bottom: 10, left: 14, right: 14 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale-w"),
                onTouchStart: (e: any) => startDrag(e, "scale-w"),
              } as any)
            : {})}
        />
        {localMask.shape !== "linear" && (
          <>
            <View
              style={[styles.pillHandleH, styles.pillTop]}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale-h"),
                    onTouchStart: (e: any) => startDrag(e, "scale-h"),
                  } as any)
                : {})}
            />
            <View
              style={[styles.pillHandleH, styles.pillBottom]}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => startDrag(e, "scale-h"),
                    onTouchStart: (e: any) => startDrag(e, "scale-h"),
                  } as any)
                : {})}
            />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
