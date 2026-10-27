import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, PanResponder } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MaskConfig, MaskShape } from "../../types/project";
import { soundEngine } from "../../utils/audioEngine";
import { getPointerCoords } from "../Timeline";

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

  const [activeDrag, setActiveDrag] = useState<"move" | "rotate" | "scale" | null>(null);
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
  const sizePx = Math.max(20, (minDim * currentSize) / 100);

  let maskBoxW = sizePx;
  let maskBoxH = sizePx;
  if (localMask.shape === "rectangle") {
    maskBoxW = Math.max(20, (dw * clipScale * currentSize) / 100);
    maskBoxH = Math.max(20, (dh * clipScale * currentSize) / 100);
  } else if (localMask.shape === "mirror" || localMask.shape === "linear") {
    maskBoxW = Math.max(dw, dh) * clipScale * 1.5;
    maskBoxH = Math.max(16, (dh * clipScale * currentSize) / 100);
  }

  // Generate SVG path / outline for shape
  const shapeSvgContent = useMemo(() => {
    const w = maskBoxW;
    const h = maskBoxH;
    const shape = localMask.shape;

    if (shape === "heart") {
      const s = Math.min(w, h);
      const cx = w / 2;
      const r = s * 0.25;
      const cy = h / 2 - s * 0.10;
      const bottomY = h / 2 + s * 0.46;
      const d = `
        M ${cx} ${bottomY}
        C ${cx - s * 0.28} ${h / 2 + s * 0.22}, ${cx - s * 0.50} ${h / 2 + s * 0.06}, ${cx - s * 0.50} ${cy}
        A ${r} ${r} 0 0 1 ${cx} ${cy}
        A ${r} ${r} 0 0 1 ${cx + s * 0.50} ${cy}
        C ${cx + s * 0.50} ${h / 2 + s * 0.06}, ${cx + s * 0.28} ${h / 2 + s * 0.22}, ${cx} ${bottomY}
        Z
      `;
      return (
        <path
          d={d}
          fill="rgba(0, 242, 254, 0.08)"
          stroke="#00F2FE"
          strokeWidth="2.5"
          strokeDasharray="6 4"
        />
      );
    }

    if (shape === "circle") {
      return (
        <circle
          cx={w / 2}
          cy={h / 2}
          r={w / 2 - 2}
          fill="rgba(0, 242, 254, 0.08)"
          stroke="#00F2FE"
          strokeWidth="2.5"
          strokeDasharray="6 4"
        />
      );
    }

    if (shape === "rectangle") {
      const rad = Math.min(localMask.roundness ?? 16, Math.min(w, h) / 2);
      return (
        <rect
          x={2}
          y={2}
          width={w - 4}
          height={h - 4}
          rx={rad}
          fill="rgba(0, 242, 254, 0.08)"
          stroke="#00F2FE"
          strokeWidth="2.5"
          strokeDasharray="6 4"
        />
      );
    }

    if (shape === "star") {
      const outerR = Math.min(w, h) / 2 - 2;
      const innerR = outerR * 0.42;
      const cx = w / 2;
      const cy = h / 2;
      const points: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        points.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
      }
      return (
        <polygon
          points={points.join(" ")}
          fill="rgba(0, 242, 254, 0.08)"
          stroke="#00F2FE"
          strokeWidth="2.5"
          strokeDasharray="6 4"
        />
      );
    }

    if (shape === "mirror") {
      return (
        <>
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill="rgba(0, 242, 254, 0.08)"
            stroke="#00F2FE"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
          <line x1={0} y1={0} x2={w} y2={0} stroke="#00F2FE" strokeWidth="2" />
          <line x1={0} y1={h} x2={w} y2={h} stroke="#00F2FE" strokeWidth="2" />
        </>
      );
    }

    if (shape === "linear") {
      return (
        <>
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill="rgba(0, 242, 254, 0.08)"
            stroke="#00F2FE"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <line
            x1={0}
            y1={h / 2}
            x2={w}
            y2={h / 2}
            stroke="#00F2FE"
            strokeWidth="3"
            strokeDasharray="4 4"
          />
        </>
      );
    }

    return null;
  }, [maskBoxW, maskBoxH, localMask]);

  // Pointer drag session handling
  const startDrag = useCallback(
    (e: any, mode: "move" | "rotate" | "scale") => {
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

      const startAngle =
        Math.atan2(startClientY - maskCanvasCenterY, startClientX - maskCanvasCenterX) *
        (180 / Math.PI);
      const startDist = Math.hypot(
        startClientX - maskCanvasCenterX,
        startClientY - maskCanvasCenterY,
      );

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
          const nextSize = Math.round(Math.max(10, Math.min(100, startMaskSize * factor)));

          currentUpdatedMask = {
            ...currentUpdatedMask,
            size: nextSize,
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

  if (localMask.shape === "none") return null;

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
              color="#00F2FE"
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
            X:{currentX}% Y:{currentY}% • {currentRot}° • {currentSize}%
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
              style={[styles.hudActionBtn, { backgroundColor: "rgba(255, 255, 255, 0.15)" }]}
              onPress={onCloseMaskPreview}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
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
              filter: "drop-shadow(0 0 6px rgba(0, 242, 254, 0.4))",
            }}
            viewBox={`0 0 ${maskBoxW} ${maskBoxH}`}
          >
            {shapeSvgContent}
          </svg>
        )}

        {/* Center Move Handle Knob */}
        <View style={styles.centerMoveKnob} pointerEvents="none">
          <Ionicons name="move" size={15} color="#00F2FE" />
        </View>

        {/* Top Rotation Stem Line & Handle Knob */}
        <View style={styles.rotStem} pointerEvents="none" />
        <View
          style={styles.rotKnob}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "rotate"),
                onTouchStart: (e: any) => startDrag(e, "rotate"),
              } as any)
            : {})}
        >
          <Ionicons name="sync-outline" size={15} color="#000000" />
        </View>

        {/* 4 Corner Resize / Scale Handles */}
        <View
          style={[styles.scaleHandle, styles.handleTL]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
              } as any)
            : {})}
        />
        <View
          style={[styles.scaleHandle, styles.handleTR]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
              } as any)
            : {})}
        />
        <View
          style={[styles.scaleHandle, styles.handleBL]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
              } as any)
            : {})}
        />
        <View
          style={[styles.scaleHandle, styles.handleBR]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          {...(Platform.OS === "web"
            ? ({
                onMouseDown: (e: any) => startDrag(e, "scale"),
                onTouchStart: (e: any) => startDrag(e, "scale"),
              } as any)
            : {})}
        />
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
    backgroundColor: "rgba(13, 17, 26, 0.94)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
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
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  hudText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  hudActionBtn: {
    backgroundColor: "rgba(0, 242, 254, 0.2)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: "rgba(0, 242, 254, 0.4)",
  },
  hudActionText: {
    color: "#00F2FE",
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
  },
  centerMoveKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(13, 17, 26, 0.85)",
    borderWidth: 1.5,
    borderColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  rotStem: {
    position: "absolute",
    top: -30,
    left: "50%",
    width: 2,
    height: 30,
    backgroundColor: "#00F2FE",
    marginLeft: -1,
  },
  rotKnob: {
    position: "absolute",
    top: -56,
    left: "50%",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00F2FE",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10010,
  },
  scaleHandle: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#00F2FE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 10010,
  },
  handleTL: {
    top: -10,
    left: -10,
  },
  handleTR: {
    top: -10,
    right: -10,
  },
  handleBL: {
    bottom: -10,
    left: -10,
  },
  handleBR: {
    bottom: -10,
    right: -10,
  },
} as any);
