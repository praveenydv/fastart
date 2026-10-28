import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, PanResponder } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MaskConfig, MaskShape } from "../../types/project";
import { soundEngine } from "../../utils/audioEngine";
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
}) => {
  const mask: MaskConfig = useMemo(() => {
    return (
      targetClip?.mask ||
      targetClip?.transform?.mask || {
        shape: "heart",
        size: 60,
        feather: 0,
        x: 0,
        y: 0,
        rotation: 0,
      }
    );
  }, [targetClip]);

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
  const clipScale = Math.max(0.01, clipT.scale || 1.0);
  const clipRot = clipT.rotation || 0;

  // Calculate dw and dh of the clip inside canvas
  const { dw, dh } = useMemo(() => {
    const naturalDims = rendererRef?.current?.getMediaNaturalDimensions(targetClip?.url);
    const nw = naturalDims?.width || 0;
    const nh = naturalDims?.height || 0;
    const aspect = nw > 0 && nh > 0 ? nw / nh : boxWidth / canvasHeight;

    let w = boxWidth;
    let h = boxWidth / aspect;
    if (h > canvasHeight) {
      h = canvasHeight;
      w = canvasHeight * aspect;
    }
    return { dw: w, dh: h };
  }, [rendererRef, targetClip?.url, boxWidth, canvasHeight]);

  const currentX = localMask.x || 0;
  const currentY = localMask.y || 0;
  const currentRot = localMask.rotation || 0;
  const currentSize = Math.max(10, Math.min(100, localMask.size ?? 60));
  const currentW = Math.max(10, Math.min(150, localMask.width ?? localMask.size ?? 60));
  const currentH = Math.max(10, Math.min(150, localMask.height ?? localMask.size ?? 60));

  // Compute canvas pixel position of mask center
  const rad = (clipRot * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const localOffsetX = (currentX / 100) * dw * clipScale;
  const localOffsetY = (currentY / 100) * dh * clipScale;

  const maskCanvasCenterX = clipCx + (localOffsetX * cosA - localOffsetY * sinA);
  const maskCanvasCenterY = clipCy + (localOffsetX * sinA + localOffsetY * cosA);
  const totalMaskRotation = clipRot + currentRot;

  // Mask bounding box in pixels
  const minDim = Math.min(dw, dh) * clipScale;
  let maskBoxW = Math.max(20, (minDim * currentW) / 100);
  let maskBoxH = Math.max(20, (minDim * currentH) / 100);
  if (localMask.shape === "rectangle") {
    maskBoxW = Math.max(20, (dw * clipScale * currentW) / 100);
    maskBoxH = Math.max(20, (dh * clipScale * currentH) / 100);
  } else if (localMask.shape === "mirror" || localMask.shape === "linear") {
    maskBoxW = Math.max(dw, dh) * clipScale * 1.5;
    maskBoxH = Math.max(16, (dh * clipScale * currentH) / 100);
  }

  // Generate SVG path / outline for shape with dashed bounding box and center crosshair
  const shapeSvgContent = useMemo(() => {
    const w = maskBoxW;
    const h = maskBoxH;
    const shape = localMask.shape;

    return (
      <>
        {/* Outer dashed bounding box (matching reference design) */}
        <rect
          x={1}
          y={1}
          width={Math.max(2, w - 2)}
          height={Math.max(2, h - 2)}
          fill="none"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Center horizontal & vertical dashed crosshair lines */}
        <line
          x1={0}
          y1={h / 2}
          x2={w}
          y2={h / 2}
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <line
          x1={w / 2}
          y1={0}
          x2={w / 2}
          y2={h}
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Actual mask shape outline (solid white, conforms to face / object) */}
        {shape === "circle" && (
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={Math.max(2, w / 2 - 2)}
            ry={Math.max(2, h / 2 - 2)}
            fill="rgba(0, 242, 254, 0.05)"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
        )}

        {shape === "rectangle" && (
          <rect
            x={2}
            y={2}
            width={Math.max(2, w - 4)}
            height={Math.max(2, h - 4)}
            rx={Math.min(localMask.roundness ?? 16, Math.min(w, h) / 2)}
            fill="rgba(0, 242, 254, 0.05)"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
        )}

        {shape === "heart" && (
          <g transform={`scale(${w / 100}, ${h / 100})`}>
            <path
              d="M 50 96 C 22 72, 0 56, 0 40 A 25 25 0 0 1 50 40 A 25 25 0 0 1 100 40 C 100 56, 78 72, 50 96 Z"
              fill="rgba(0, 242, 254, 0.05)"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}

        {shape === "star" && (() => {
          const outerR = 48;
          const innerR = 20;
          const cx = 50;
          const cy = 50;
          const points: string[] = [];
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            points.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
          }
          return (
            <g transform={`scale(${w / 100}, ${h / 100})`}>
              <polygon
                points={points.join(" ")}
                fill="rgba(0, 242, 254, 0.05)"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })()}

        {shape === "mirror" && (
          <>
            <line x1={0} y1={0} x2={w} y2={0} stroke="#FFFFFF" strokeWidth="2.5" />
            <line x1={0} y1={h} x2={w} y2={h} stroke="#FFFFFF" strokeWidth="2.5" />
          </>
        )}

        {shape === "linear" && (
          <line
            x1={0}
            y1={h / 2}
            x2={w}
            y2={h / 2}
            stroke="#FFFFFF"
            strokeWidth="3"
          />
        )}
      </>
    );
  }, [maskBoxW, maskBoxH, localMask]);

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
      const startMaskSize = localMask.size ?? 60;
      const startMaskW = localMask.width ?? localMask.size ?? 60;
      const startMaskH = localMask.height ?? localMask.size ?? 60;
      const startMaskFeather = localMask.feather || 0;

      const startAngle =
        Math.atan2(startClientY - maskCanvasCenterY, startClientX - maskCanvasCenterX) *
        (180 / Math.PI);
      const startDist = Math.hypot(
        startClientX - maskCanvasCenterX,
        startClientY - maskCanvasCenterY,
      );

      const totalRotRad = (totalMaskRotation * Math.PI) / 180;
      const cosTR = Math.cos(totalRotRad);
      const sinTR = Math.sin(totalRotRad);

      const startLocalDistX = Math.max(10, maskBoxW / 2);
      const startLocalDistY = Math.max(10, maskBoxH / 2);

      let currentUpdatedMask = { ...localMask };
      pendingMaskRef.current = currentUpdatedMask;

      const onPointerMove = (moveEv: any) => {
        if (moveEv.cancelable && moveEv.preventDefault) moveEv.preventDefault();
        const moveCoords = getPointerCoords(moveEv);
        const curClientX = moveCoords.clientX;
        const curClientY = moveCoords.clientY;

        if (mode === "move") {
          const dxPx = curClientX - startClientX;
          const dyPx = curClientY - startClientY;

          // Inverse rotate delta by clip's rotation and scale
          const unrotDx = (dxPx * cosA + dyPx * sinA) / clipScale;
          const unrotDy = (-dxPx * sinA + dyPx * cosA) / clipScale;

          const nextX = Math.round(
            Math.max(-100, Math.min(100, startMaskX + (unrotDx / dw) * 100)),
          );
          const nextY = Math.round(
            Math.max(-100, Math.min(100, startMaskY + (unrotDy / dh) * 100)),
          );

          currentUpdatedMask = {
            ...currentUpdatedMask,
            x: nextX,
            y: nextY,
          };
        } else if (mode === "rotate") {
          const curAngle =
            Math.atan2(curClientY - maskCanvasCenterY, curClientX - maskCanvasCenterX) *
            (180 / Math.PI);
          const dAngle = curAngle - startAngle;
          let nextRot = Math.round((startMaskRot + dAngle) % 360);
          if (nextRot > 180) nextRot -= 360;
          if (nextRot < -180) nextRot += 360;

          currentUpdatedMask = {
            ...currentUpdatedMask,
            rotation: nextRot,
          };
        } else if (mode === "scale") {
          const curDist = Math.hypot(
            curClientX - maskCanvasCenterX,
            curClientY - maskCanvasCenterY,
          );
          const factor = curDist / Math.max(1, startDist);
          const nextW = Math.round(Math.max(10, Math.min(150, startMaskW * factor)));
          const nextH = Math.round(Math.max(10, Math.min(150, startMaskH * factor)));
          const nextSize = Math.max(nextW, nextH);

          currentUpdatedMask = {
            ...currentUpdatedMask,
            size: nextSize,
            width: nextW,
            height: nextH,
          };
        } else if (mode === "scale-w") {
          const dx = curClientX - maskCanvasCenterX;
          const dy = curClientY - maskCanvasCenterY;
          const curLocalDistX = Math.abs(dx * cosTR + dy * sinTR);
          const factor = curLocalDistX / startLocalDistX;
          const nextW = Math.round(Math.max(10, Math.min(150, startMaskW * factor)));

          currentUpdatedMask = {
            ...currentUpdatedMask,
            width: nextW,
            size: Math.max(nextW, currentUpdatedMask.height ?? startMaskH),
          };
        } else if (mode === "scale-h") {
          const dx = curClientX - maskCanvasCenterX;
          const dy = curClientY - maskCanvasCenterY;
          const curLocalDistY = Math.abs(-dx * sinTR + dy * cosTR);
          const factor = curLocalDistY / startLocalDistY;
          const nextH = Math.round(Math.max(10, Math.min(150, startMaskH * factor)));

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
        onUpdateClipMaskRef.current?.(targetClip.id, finalMask, true);
      };

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
      clipScale,
      cosA,
      sinA,
      dw,
      dh,
      targetClip.id,
      totalMaskRotation,
      maskBoxW,
      maskBoxH,
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
    return (
      <View
        style={[
          styles.maskContainer,
          {
            left: clipCx - (dw * clipScale) / 2,
            top: clipCy - (dh * clipScale) / 2,
            width: dw * clipScale,
            height: dh * clipScale,
            borderWidth: 1.5,
            borderColor: THEME_COLORS.accent,
            borderStyle: "dashed",
            borderRadius: 8,
            backgroundColor: "rgba(0, 229, 201, 0.05)",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          },
        ]}
      >
        <View style={[styles.hudPill, { pointerEvents: "none" }]}>
          <Ionicons name="shapes-outline" size={14} color={THEME_COLORS.accent} />
          <Text style={styles.hudTitle}>Select a mask shape below</Text>
        </View>
      </View>
    );
  }

  return (
    <>
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
              {...(Platform.OS === "web"
                ? ({
                    onClick: (e: any) => {
                      e.stopPropagation?.();
                      soundEngine.playSfx("pop");
                      if (targetClip?.id && onUpdateClipMask) {
                        onUpdateClipMask(targetClip.id, localMask, true);
                      }
                      onCloseMaskPreview();
                    },
                    onMouseDown: (e: any) => e.stopPropagation?.(),
                  } as any)
                : {})}
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
            left: maskCanvasCenterX - maskBoxW / 2,
            top: maskCanvasCenterY - maskBoxH / 2,
            width: maskBoxW,
            height: maskBoxH,
            transform: [{ rotate: `${totalMaskRotation}deg` }],
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

        {/* Top Feather / Softness Control Handle (Matching Screenshot: Circle with Chevron-Up) */}
        <View
          style={styles.featherKnob}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "feather"),
                onTouchStart: (e: any) => startDrag(e, "feather"),
                style: { cursor: "ns-resize" },
              } as any)
            : {})}
        >
          <Ionicons name="chevron-up" size={16} color="#000000" />
        </View>

        {/* Bottom Rotation Control Handle (Matching Screenshot: Circle with Rotate Arrow) */}
        <View
          style={styles.rotKnobBottom}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "rotate"),
                onTouchStart: (e: any) => startDrag(e, "rotate"),
                style: { cursor: "grab" },
              } as any)
            : {})}
        >
          <Ionicons name="sync-outline" size={15} color="#000000" />
        </View>

        {/* 4 Corner Solid White Resize Dots (Matching Screenshot) */}
        <View
          style={[styles.cornerDot, styles.dotTL]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
                style: { cursor: "nwse-resize" },
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
                style: { cursor: "nesw-resize" },
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
                style: { cursor: "nesw-resize" },
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
                style: { cursor: "nwse-resize" },
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
                style: { cursor: "ew-resize" },
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
                style: { cursor: "ew-resize" },
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
                    style: { cursor: "ns-resize" },
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
                    style: { cursor: "ns-resize" },
                  } as any)
                : {})}
            />
          </>
        )}
      </View>
    </>
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
    willChange: "transform, left, top" as any,
    transition: "none" as any,
    cursor: "move" as any,
  },
  featherKnob: {
    position: "absolute",
    top: -46,
    left: "50%",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 10015,
  },
  rotKnobBottom: {
    position: "absolute",
    bottom: -46,
    left: "50%",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 10015,
  },
  cornerDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
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
  },
  dotTR: {
    top: -7,
    right: -7,
  },
  dotBL: {
    bottom: -7,
    left: -7,
  },
  dotBR: {
    bottom: -7,
    right: -7,
  },
  pillHandleV: {
    position: "absolute",
    width: 12,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 7,
    zIndex: 10012,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 7,
    zIndex: 10012,
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
