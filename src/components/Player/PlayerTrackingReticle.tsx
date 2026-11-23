import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Platform,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { TrackingRect, TrajectoryPoint } from '../../types/project';

interface PlayerTrackingReticleProps {
  targetRect: TrackingRect; // 0..100%
  onChangeTargetRect: (rect: TrackingRect) => void;
  boxWidth: number; // player container width in px
  canvasHeight: number; // player container height in px
  isScanning?: boolean;
  scanProgress?: number; // 0..100
  isCompleted?: boolean;
  trajectory?: TrajectoryPoint[];
  currentTime?: number;
}

type DragHandleType = 'pan' | 'nw' | 'ne' | 'sw' | 'se';

const PlayerTrackingReticleComponent: React.FC<PlayerTrackingReticleProps> = ({
  targetRect,
  onChangeTargetRect,
  boxWidth,
  canvasHeight,
  isScanning = false,
  scanProgress = 0,
  isCompleted = false,
  trajectory,
  currentTime,
}) => {
  const rectRef = useRef(targetRect);
  rectRef.current = targetRect;

  const startRectRef = useRef<TrackingRect>(targetRect);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeHandleRef = useRef<DragHandleType | null>(null);

  // Pixel coordinates calculation for display
  const bw = Math.max(1, boxWidth);
  const bh = Math.max(1, canvasHeight);

  // When tracked trajectory exists, interpolate box position & scale at currentTime
  const currentTrackedPoint = useMemo(() => {
    if (!isCompleted || !trajectory || trajectory.length === 0 || typeof currentTime !== 'number') {
      return null;
    }
    if (currentTime <= trajectory[0].time) return trajectory[0];
    if (currentTime >= trajectory[trajectory.length - 1].time) {
      return trajectory[trajectory.length - 1];
    }
    let low = 0;
    let high = trajectory.length - 1;
    while (low + 1 < high) {
      const mid = (low + high) >> 1;
      if (trajectory[mid].time <= currentTime) low = mid;
      else high = mid;
    }
    const p0 = trajectory[low];
    const p1 = trajectory[high];
    const dt = Math.max(0.0001, p1.time - p0.time);
    const frac = Math.min(1, Math.max(0, (currentTime - p0.time) / dt));

    return {
      x: p0.x + (p1.x - p0.x) * frac,
      y: p0.y + (p1.y - p0.y) * frac,
      scale: (p0.scale || 1.0) + ((p1.scale || 1.0) - (p0.scale || 1.0)) * frac,
      rotation: (p0.rotation || 0) + ((p1.rotation || 0) - (p0.rotation || 0)) * frac,
    };
  }, [isCompleted, trajectory, currentTime]);

  const currentScale = currentTrackedPoint ? (currentTrackedPoint.scale || 1.0) : 1.0;
  const currentRotation = currentTrackedPoint ? (currentTrackedPoint.rotation || 0) : 0;

  const normW = targetRect.width * currentScale;
  const normH = targetRect.height * currentScale;

  let normX = targetRect.x;
  let normY = targetRect.y;

  if (currentTrackedPoint) {
    normX = currentTrackedPoint.x - normW / 2;
    normY = currentTrackedPoint.y - normH / 2;
  }

  const pxW = Math.max(36, (normW / 100) * bw);
  const pxH = Math.max(36, (normH / 100) * bh);
  const pxX = (normX / 100) * bw;
  const pxY = (normY / 100) * bh;

  // Web Pointer Drag Logic
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handlePointerMove = (e: PointerEvent) => {
      const handle = activeHandleRef.current;
      if (!handle) return;

      const deltaPixelX = e.clientX - startPointerRef.current.x;
      const deltaPixelY = e.clientY - startPointerRef.current.y;

      const deltaXPercent = (deltaPixelX / bw) * 100;
      const deltaYPercent = (deltaPixelY / bh) * 100;

      const sr = startRectRef.current;
      let nextX = sr.x;
      let nextY = sr.y;
      let nextW = sr.width;
      let nextH = sr.height;

      if (handle === 'pan') {
        const maxX = Math.max(0, 100 - sr.width);
        const maxY = Math.max(0, 100 - sr.height);
        nextX = Math.max(0, Math.min(maxX, sr.x + deltaXPercent));
        nextY = Math.max(0, Math.min(maxY, sr.y + deltaYPercent));
      } else if (handle === 'se') {
        // Bottom-Right: adjust width & height
        const maxW = 100 - sr.x;
        const maxH = 100 - sr.y;
        nextW = Math.max(8, Math.min(maxW, sr.width + deltaXPercent));
        nextH = Math.max(8, Math.min(maxH, sr.height + deltaYPercent));
      } else if (handle === 'sw') {
        // Bottom-Left: adjust x, width & height
        const candidateX = Math.max(0, Math.min(sr.x + sr.width - 8, sr.x + deltaXPercent));
        nextW = sr.width + (sr.x - candidateX);
        nextX = candidateX;
        const maxH = 100 - sr.y;
        nextH = Math.max(8, Math.min(maxH, sr.height + deltaYPercent));
      } else if (handle === 'ne') {
        // Top-Right: adjust y, width & height
        const candidateY = Math.max(0, Math.min(sr.y + sr.height - 8, sr.y + deltaYPercent));
        nextH = sr.height + (sr.y - candidateY);
        nextY = candidateY;
        const maxW = 100 - sr.x;
        nextW = Math.max(8, Math.min(maxW, sr.width + deltaXPercent));
      } else if (handle === 'nw') {
        // Top-Left: adjust x, y, width & height
        const candidateX = Math.max(0, Math.min(sr.x + sr.width - 8, sr.x + deltaXPercent));
        const candidateY = Math.max(0, Math.min(sr.y + sr.height - 8, sr.y + deltaYPercent));
        nextW = sr.width + (sr.x - candidateX);
        nextH = sr.height + (sr.y - candidateY);
        nextX = candidateX;
        nextY = candidateY;
      }

      onChangeTargetRect({
        x: Number(nextX.toFixed(2)),
        y: Number(nextY.toFixed(2)),
        width: Number(nextW.toFixed(2)),
        height: Number(nextH.toFixed(2)),
      });
    };

    const handlePointerUp = () => {
      activeHandleRef.current = null;
    };

    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      }
    };
  }, [bw, bh, onChangeTargetRect]);

  const startDrag = (handle: DragHandleType, clientX: number, clientY: number) => {
    activeHandleRef.current = handle;
    startRectRef.current = { ...rectRef.current };
    startPointerRef.current = { x: clientX, y: clientY };
  };

  // React Native PanResponder for Native iOS/Android
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRectRef.current = { ...rectRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        if (bw <= 0 || bh <= 0) return;
        const deltaXPercent = (gestureState.dx / bw) * 100;
        const deltaYPercent = (gestureState.dy / bh) * 100;
        const sr = startRectRef.current;

        const maxX = Math.max(0, 100 - sr.width);
        const maxY = Math.max(0, 100 - sr.height);
        const newX = Math.max(0, Math.min(maxX, sr.x + deltaXPercent));
        const newY = Math.max(0, Math.min(maxY, sr.y + deltaYPercent));

        onChangeTargetRect({
          ...sr,
          x: Number(newX.toFixed(2)),
          y: Number(newY.toFixed(2)),
        });
      },
    })
  ).current;

  // React Native Resize PanResponder (Bottom-Right SE)
  const resizePanResponderSE = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRectRef.current = { ...rectRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        if (bw <= 0 || bh <= 0) return;
        const deltaWPercent = (gestureState.dx / bw) * 100;
        const deltaHPercent = (gestureState.dy / bh) * 100;
        const sr = startRectRef.current;

        const maxW = 100 - sr.x;
        const maxH = 100 - sr.y;
        const newW = Math.max(8, Math.min(maxW, sr.width + deltaWPercent));
        const newH = Math.max(8, Math.min(maxH, sr.height + deltaHPercent));

        onChangeTargetRect({
          ...sr,
          width: Number(newW.toFixed(2)),
          height: Number(newH.toFixed(2)),
        });
      },
    })
  ).current;

  // React Native Resize PanResponder (Bottom-Left SW)
  const resizePanResponderSW = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRectRef.current = { ...rectRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        if (bw <= 0 || bh <= 0) return;
        const deltaXPercent = (gestureState.dx / bw) * 100;
        const deltaHPercent = (gestureState.dy / bh) * 100;
        const sr = startRectRef.current;

        const candidateX = Math.max(0, Math.min(sr.x + sr.width - 8, sr.x + deltaXPercent));
        const newW = sr.width + (sr.x - candidateX);
        const maxH = 100 - sr.y;
        const newH = Math.max(8, Math.min(maxH, sr.height + deltaHPercent));

        onChangeTargetRect({
          ...sr,
          x: Number(candidateX.toFixed(2)),
          width: Number(newW.toFixed(2)),
          height: Number(newH.toFixed(2)),
        });
      },
    })
  ).current;

  // React Native Resize PanResponder (Top-Right NE)
  const resizePanResponderNE = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRectRef.current = { ...rectRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        if (bw <= 0 || bh <= 0) return;
        const deltaWPercent = (gestureState.dx / bw) * 100;
        const deltaYPercent = (gestureState.dy / bh) * 100;
        const sr = startRectRef.current;

        const candidateY = Math.max(0, Math.min(sr.y + sr.height - 8, sr.y + deltaYPercent));
        const newH = sr.height + (sr.y - candidateY);
        const maxW = 100 - sr.x;
        const newW = Math.max(8, Math.min(maxW, sr.width + deltaWPercent));

        onChangeTargetRect({
          ...sr,
          y: Number(candidateY.toFixed(2)),
          width: Number(newW.toFixed(2)),
          height: Number(newH.toFixed(2)),
        });
      },
    })
  ).current;

  // React Native Resize PanResponder (Top-Left NW)
  const resizePanResponderNW = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRectRef.current = { ...rectRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        if (bw <= 0 || bh <= 0) return;
        const deltaXPercent = (gestureState.dx / bw) * 100;
        const deltaYPercent = (gestureState.dy / bh) * 100;
        const sr = startRectRef.current;

        const candidateX = Math.max(0, Math.min(sr.x + sr.width - 8, sr.x + deltaXPercent));
        const candidateY = Math.max(0, Math.min(sr.y + sr.height - 8, sr.y + deltaYPercent));
        const newW = sr.width + (sr.x - candidateX);
        const newH = sr.height + (sr.y - candidateY);

        onChangeTargetRect({
          x: Number(candidateX.toFixed(2)),
          y: Number(candidateY.toFixed(2)),
          width: Number(newW.toFixed(2)),
          height: Number(newH.toFixed(2)),
        });
      },
    })
  ).current;

  const accentColor = isCompleted ? '#10B981' : '#00F2FE';

  const webDragProps = (handle: DragHandleType) => {
    if (Platform.OS !== 'web') return {};
    return {
      onPointerDown: (e: any) => {
        e.stopPropagation?.();
        if (e.preventDefault) e.preventDefault();
        startDrag(handle, e.clientX, e.clientY);
      },
      onMouseDown: (e: any) => {
        e.stopPropagation?.();
        if (e.preventDefault) e.preventDefault();
        startDrag(handle, e.clientX, e.clientY);
      },
    };
  };

  return (
    <View
      style={[
        styles.overlayContainer,
        { width: boxWidth, height: canvasHeight },
      ]}
      pointerEvents="box-none"
    >
      {/* Motion Trajectory Trail / Breadcrumbs */}
      {trajectory && trajectory.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {trajectory.map((pt, idx) => {
            const posX = (pt.x / 100) * bw;
            const posY = (pt.y / 100) * bh;
            const isCurrent =
              typeof currentTime === 'number' &&
              Math.abs(pt.time - currentTime) < 0.15;
            return (
              <View
                key={`traj-${idx}`}
                style={[
                  styles.trajectoryDot,
                  {
                    left: posX - (isCurrent ? 6 : 2.5),
                    top: posY - (isCurrent ? 6 : 2.5),
                    width: isCurrent ? 12 : 5,
                    height: isCurrent ? 12 : 5,
                    borderRadius: isCurrent ? 6 : 2.5,
                    backgroundColor: isCurrent ? '#00F2FE' : 'rgba(0, 242, 254, 0.55)',
                    borderWidth: isCurrent ? 2 : 0,
                    borderColor: '#FFFFFF',
                    shadowColor: '#00F2FE',
                    shadowRadius: isCurrent ? 6 : 2,
                    shadowOpacity: isCurrent ? 0.9 : 0.5,
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Reticle Bounding Box */}
      <View
        style={[
          styles.reticleBox,
          {
            left: pxX,
            top: pxY,
            width: pxW,
            height: pxH,
            transform: currentRotation ? [{ rotate: `${currentRotation}deg` }] : undefined,
          },
        ]}
        {...panResponder.panHandlers}
        {...webDragProps('pan')}
      >
        {/* Crisp Dashed Outline (SVG for sharp cross-platform dashed stroke) */}
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={pxW}
          height={pxH}
        >
          {/* Subtle dark backing for contrast */}
          <Rect
            x={1}
            y={1}
            width={Math.max(0, pxW - 2)}
            height={Math.max(0, pxH - 2)}
            rx={4}
            ry={4}
            fill="none"
            stroke="rgba(0, 0, 0, 0.6)"
            strokeWidth={2.4}
            strokeDasharray={[6, 9]}
          />
          {/* Crisp accent dashed line */}
          <Rect
            x={1}
            y={1}
            width={Math.max(0, pxW - 2)}
            height={Math.max(0, pxH - 2)}
            rx={4}
            ry={4}
            fill="none"
            stroke={accentColor}
            strokeWidth={1.8}
            strokeDasharray={[6, 9]}
          />
        </Svg>

        {/* Animated Scanning Beam when tracking is in progress */}
        {isScanning && (
          <View
            style={[
              styles.scanBeam,
              {
                top: `${(scanProgress % 100)}%`,
                backgroundColor: accentColor,
              },
            ]}
          />
        )}

        {/* Center Crosshair */}
        <View style={styles.centerCrosshair} pointerEvents="none">
          <View style={[styles.crosshairH, { backgroundColor: accentColor }]} />
          <View style={[styles.crosshairV, { backgroundColor: accentColor }]} />
          <View style={[styles.crosshairDot, { backgroundColor: accentColor }]} />
        </View>

        {/* Status / Target Label Pill */}
        <View
          style={[
            styles.tagPill,
            { backgroundColor: 'rgba(13, 14, 21, 0.9)', borderColor: accentColor },
          ]}
          pointerEvents="none"
        >
          <Ionicons
            name={isScanning ? 'sync' : isCompleted ? 'checkmark-circle' : 'scan'}
            size={11}
            color={accentColor}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tagText, { color: accentColor }]}>
            {isScanning
              ? `TRACKING ${scanProgress}%`
              : isCompleted
              ? 'TARGET LOCKED'
              : 'OBJECT TARGET'}
          </Text>
        </View>

        {/* 4 Interactive Corner Resize Pinch Handles */}
        {/* Top-Left (NW) */}
        <View
          style={[styles.handle, styles.handleNW, { borderColor: accentColor }]}
          {...resizePanResponderNW.panHandlers}
          {...webDragProps('nw')}
        >
          <View style={[styles.handleInner, { backgroundColor: accentColor }]} />
        </View>

        {/* Top-Right (NE) */}
        <View
          style={[styles.handle, styles.handleNE, { borderColor: accentColor }]}
          {...resizePanResponderNE.panHandlers}
          {...webDragProps('ne')}
        >
          <View style={[styles.handleInner, { backgroundColor: accentColor }]} />
        </View>

        {/* Bottom-Left (SW) */}
        <View
          style={[styles.handle, styles.handleSW, { borderColor: accentColor }]}
          {...resizePanResponderSW.panHandlers}
          {...webDragProps('sw')}
        >
          <View style={[styles.handleInner, { backgroundColor: accentColor }]} />
        </View>

        {/* Bottom-Right (SE) */}
        <View
          style={[styles.handle, styles.handleSE, { borderColor: accentColor }]}
          {...resizePanResponderSE.panHandlers}
          {...webDragProps('se')}
        >
          <View style={[styles.handleInner, { backgroundColor: accentColor }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 999,
  },
  reticleBox: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderRadius: 4,
    cursor: 'move' as any,
  },
  scanBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.95,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowColor: '#00F2FE',
  },
  centerCrosshair: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 16,
    height: 1.5,
    borderRadius: 1,
  },
  crosshairV: {
    position: 'absolute',
    width: 1.5,
    height: 16,
    borderRadius: 1,
  },
  crosshairDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  tagPill: {
    position: 'absolute',
    top: -26,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  handle: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#0D0E15',
    borderWidth: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  handleNW: {
    top: -10,
    left: -10,
    cursor: 'nwse-resize' as any,
  },
  handleNE: {
    top: -10,
    right: -10,
    cursor: 'nesw-resize' as any,
  },
  handleSW: {
    bottom: -10,
    left: -10,
    cursor: 'nesw-resize' as any,
  },
  handleSE: {
    bottom: -10,
    right: -10,
    cursor: 'nwse-resize' as any,
  },
  handleInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trajectoryDot: {
    position: 'absolute',
    zIndex: 10,
  },
});

export const PlayerTrackingReticle = React.memo(PlayerTrackingReticleComponent);
export default PlayerTrackingReticle;
