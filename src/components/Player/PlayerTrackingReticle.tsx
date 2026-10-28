import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrackingRect } from '../../types/project';

interface PlayerTrackingReticleProps {
  targetRect: TrackingRect; // 0..100%
  onChangeTargetRect: (rect: TrackingRect) => void;
  boxWidth: number; // player container width in px
  canvasHeight: number; // player container height in px
  isScanning?: boolean;
  scanProgress?: number; // 0..100
  isCompleted?: boolean;
}

type DragHandleType = 'pan' | 'nw' | 'ne' | 'sw' | 'se';

export const PlayerTrackingReticle: React.FC<PlayerTrackingReticleProps> = ({
  targetRect,
  onChangeTargetRect,
  boxWidth,
  canvasHeight,
  isScanning = false,
  scanProgress = 0,
  isCompleted = false,
}) => {
  const rectRef = useRef(targetRect);
  rectRef.current = targetRect;

  const startRectRef = useRef<TrackingRect>(targetRect);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeHandleRef = useRef<DragHandleType | null>(null);

  // Pixel coordinates calculation for display
  const bw = Math.max(1, boxWidth);
  const bh = Math.max(1, canvasHeight);

  const pxW = Math.max(36, (targetRect.width / 100) * bw);
  const pxH = Math.max(36, (targetRect.height / 100) * bh);
  const pxX = (targetRect.x / 100) * bw;
  const pxY = (targetRect.y / 100) * bh;

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

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
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

  // React Native Resize PanResponder (Bottom-Right)
  const resizePanResponder = useRef(
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
      {/* Reticle Bounding Box */}
      <View
        style={[
          styles.reticleBox,
          {
            left: pxX,
            top: pxY,
            width: pxW,
            height: pxH,
            borderColor: accentColor,
            shadowColor: accentColor,
          },
        ]}
        {...panResponder.panHandlers}
        {...webDragProps('pan')}
      >
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
          {...webDragProps('nw')}
        >
          <View style={[styles.handleInner, { backgroundColor: accentColor }]} />
        </View>

        {/* Top-Right (NE) */}
        <View
          style={[styles.handle, styles.handleNE, { borderColor: accentColor }]}
          {...webDragProps('ne')}
        >
          <View style={[styles.handleInner, { backgroundColor: accentColor }]} />
        </View>

        {/* Bottom-Left (SW) */}
        <View
          style={[styles.handle, styles.handleSW, { borderColor: accentColor }]}
          {...webDragProps('sw')}
        >
          <View style={[styles.handleInner, { backgroundColor: accentColor }]} />
        </View>

        {/* Bottom-Right (SE) */}
        <View
          style={[styles.handle, styles.handleSE, { borderColor: accentColor }]}
          {...resizePanResponder.panHandlers}
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
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
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
});
