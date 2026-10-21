import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoRenderer } from '../utils/videoRenderer';
import { FastArtProject } from '../types/project';

interface PlayerProps {
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
  totalDuration: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onAddKeyframe: () => void;
  hasKeyframeAtCurrentTime: boolean;
  onOpenMediaPicker: () => void;
  selectedClipId?: string | null;
  selectedClipType?: string;
  onSelectClip?: (id: string | null, type?: string) => void;
  onUpdateClipTransform?: (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal?: boolean
  ) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  onOpenCropModal?: (clipId: string) => void;
  onOpenMaskModal?: (clipId: string) => void;
  onDeleteClip?: (clipId: string, clipType: string) => void;
  onDuplicateClip?: (clipId: string, clipType: string) => void;
}

export default function Player({
  project,
  currentTime,
  isPlaying,
  totalDuration,
  onTogglePlay,
  onSeek,
  onAddKeyframe,
  hasKeyframeAtCurrentTime,
  onOpenMediaPicker,
  selectedClipId,
  selectedClipType,
  onSelectClip,
  onUpdateClipTransform,
  onOpenEditModal,
  onOpenCropModal,
  onOpenMaskModal,
  onDeleteClip,
  onDuplicateClip,
}: PlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasBoxRef = useRef<any>(null);
  const rendererRef = useRef<VideoRenderer | null>(null);
  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'scale' | 'rotate';
    corner?: 'tl' | 'tr' | 'bl' | 'br';
    clipId: string;
    clipType: string;
    startClientX: number;
    startClientY: number;
    startCenterX: number;
    startCenterY: number;
    startScale: number;
    startRotation: number;
    startDist: number;
    startAngle: number;
  } | null>(null);

  const touchGestureRef = useRef<{
    initialDist: number;
    initialAngle: number;
    initialScale: number;
    initialRotation: number;
    initialCenterX: number;
    initialCenterY: number;
  } | null>(null);

  const { width: winW, height: winH } = useWindowDimensions();
  const isMobile = winW < 640;

  // Responsive canvas dimensions — dynamically optimized to utilize screen space
  const getAspectRatioDimensions = () => {

    const ratioMap: Record<string, number> = {
      '9:16': 9 / 16,
      '16:9': 16 / 9,
      '1:1': 1 / 1,
      '4:5': 4 / 5,
      '2.35:1': 235 / 100,
    };
    const targetRatio = ratioMap[project.aspectRatio] || 9 / 16;

    if (fullscreen) {
      // Fullscreen Cinema mode: strictly fit within screen dimensions leaving room for top bar & controls
      const maxFsH = Math.max(200, winH - 130);
      const maxFsW = Math.max(200, winW - 32);
      let w = maxFsH * targetRatio;
      let h = maxFsH;
      if (w > maxFsW) {
        w = maxFsW;
        h = w / targetRatio;
      }
      return { width: Math.round(w), height: Math.round(h) };
    }

    // Normal mode: Reserved height for header (52), player control bar (56), timeline (~250), toolbar (74)
    const reservedH = isMobile ? 420 : 440;
    const availableH = Math.max(160, winH - reservedH);

    const maxContainerH = isMobile
      ? Math.min(availableH, 320)
      : Math.min(availableH, 380);

    const containerH = Math.max(160, maxContainerH);
    const containerW = isMobile ? winW - 24 : Math.min(winW - 60, 720);

    let w = containerH * targetRatio;
    let h = containerH;

    if (w > containerW) {
      w = containerW;
      h = w / targetRatio;
    }

    return { width: Math.round(w), height: Math.round(h) };
  };

  const { width: canvasWidth, height: canvasHeight } = getAspectRatioDimensions();
  const hasAnyTrackContent = Boolean(
    (project.tracks.video && project.tracks.video.length > 0) ||
    (project.tracks.text && project.tracks.text.length > 0) ||
    (project.tracks.stickers && project.tracks.stickers.length > 0) ||
    (project.tracks.effects && project.tracks.effects.length > 0) ||
    (project.tracks.audio && project.tracks.audio.length > 0)
  );
  const isProjectEmpty = !hasAnyTrackContent;
  // Ensure empty state has comfortable width for buttons and text
  const boxWidth = isProjectEmpty ? Math.max(canvasWidth, Math.min(winW - 32, 320)) : canvasWidth;

  // ESC key listener to exit fullscreen mode
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  // Initialize renderer
  useEffect(() => {
    if (Platform.OS === 'web' && canvasRef.current) {
      rendererRef.current = new VideoRenderer(canvasRef.current);

      // Re-render frame immediately whenever a media element loads or seeks
      rendererRef.current.onFrameNeeded = () => {
        if (rendererRef.current && canvasRef.current) {
          rendererRef.current.renderFrame(project, currentTime, isPlaying);
        }
      };

      const clips = project.tracks.video || [];
      clips.forEach((clip) => {
        rendererRef.current?.preloadClip(clip);
      });
    }
  }, [project.aspectRatio]);

  // Render frame on timestamp, project, or playback state change
  useEffect(() => {
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(project, currentTime, isPlaying);
    }
  }, [currentTime, project, isPlaying]);

  // Multi-Track Audio playback synchronization across all simultaneous audio clips
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const audioClips = project.tracks.audio || [];
    const activeIds = new Set(audioClips.map((a) => a.id));

    // Cleanup removed audio tracks
    Object.keys(audioElementsRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        audioElementsRef.current[id].pause();
        delete audioElementsRef.current[id];
      }
    });

    audioClips.forEach((clip) => {
      let el = audioElementsRef.current[clip.id];
      if (!el || el.src !== clip.url) {
        if (el) el.pause();
        el = new Audio(clip.url);
        audioElementsRef.current[clip.id] = el;
      }

      const clipStart = clip.startTime || 0;
      const clipEnd = clipStart + (clip.duration || 0);
      const isInside = currentTime >= clipStart && currentTime <= clipEnd;

      if (isPlaying && isInside) {
        const audioOffset = (currentTime - clipStart) + (clip.trimIn || 0);
        if (Math.abs(el.currentTime - audioOffset) > 0.25) {
          el.currentTime = Math.max(0, audioOffset);
        }
        el.volume = Math.max(0, Math.min(1, clip.volume ?? 1.0));
        el.play().catch(() => {});
      } else {
        el.pause();
        if (isInside) {
          const audioOffset = (currentTime - clipStart) + (clip.trimIn || 0);
          el.currentTime = Math.max(0, audioOffset);
        }
      }
    });
  }, [isPlaying, project.tracks.audio, currentTime]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 30);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const activeTexts = (project.tracks.text || []).filter(
    (t) => currentTime >= t.startTime && currentTime <= t.startTime + t.duration
  );
  const activeStickers = (project.tracks.stickers || []).filter(
    (s) => currentTime >= s.startTime && currentTime <= s.startTime + s.duration
  );
  const activeVideo = (project.tracks.video || []).find(
    (v) => currentTime >= v.startTime && currentTime <= v.startTime + v.duration
  );

  const selectedText = activeTexts.find((t) => t.id === selectedClipId);
  const selectedSticker = activeStickers.find((s) => s.id === selectedClipId);
  const selectedVideo =
    selectedClipType === 'video' && activeVideo && activeVideo.id === selectedClipId
      ? activeVideo
      : null;

  const activeTransformItem = selectedText
    ? {
        id: selectedText.id,
        type: 'text',
        label: selectedText.text,
        pos: selectedText.position || { x: 50, y: 35 },
        scale: selectedText.scale ?? 1.0,
        rotation: selectedText.rotation ?? 0,
        width: Math.min(
          boxWidth * 0.9,
          Math.max(80, (selectedText.text || '').length * ((selectedText.style?.fontSize || 24) * 0.58) + 36)
        ) * (selectedText.scale ?? 1.0),
        height: Math.max(44, ((selectedText.style?.fontSize || 24) * 1.4 + 20) * (selectedText.scale ?? 1.0)),
      }
    : selectedSticker
    ? {
        id: selectedSticker.id,
        type: 'sticker',
        label: selectedSticker.char,
        pos: selectedSticker.position || { x: 50, y: 50 },
        scale: selectedSticker.scale ?? 1.2,
        rotation: selectedSticker.rotation ?? 0,
        width: (selectedSticker.char.length > 2 ? 140 : 68) * (selectedSticker.scale ?? 1.2),
        height: (selectedSticker.char.length > 2 ? 46 : 68) * (selectedSticker.scale ?? 1.2),
      }
    : selectedVideo
    ? {
        id: selectedVideo.id,
        type: 'video',
        label: selectedVideo.title,
        pos: {
          x: 50 + (((selectedVideo.transform?.x || 0) / boxWidth) * 100),
          y: 50 + (((selectedVideo.transform?.y || 0) / canvasHeight) * 100),
        },
        scale: selectedVideo.transform?.scale ?? 1.0,
        rotation: selectedVideo.transform?.rotation ?? 0,
        width: Math.max(100, boxWidth * 0.85 * (selectedVideo.transform?.scale ?? 1.0)),
        height: Math.max(80, canvasHeight * 0.85 * (selectedVideo.transform?.scale ?? 1.0)),
      }
    : null;

  const latestTransformRef = useRef<{
    clipId: string;
    clipType: string;
    transform: { x: number; y: number; scale: number; rotation: number };
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const scheduleTransformUpdate = (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal = false
  ) => {
    latestTransformRef.current = { clipId, clipType, transform };
    if (isFinal) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      onUpdateClipTransform?.(clipId, clipType, transform, true);
      latestTransformRef.current = null;
      return;
    }

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (latestTransformRef.current) {
          onUpdateClipTransform?.(
            latestTransformRef.current.clipId,
            latestTransformRef.current.clipType,
            latestTransformRef.current.transform,
            false
          );
        }
      });
    }
  };

  const handleQuickRotate = (item: any) => {
    const nextRot = (Math.round(item.rotation || 0) + 90) % 360;
    if (item.type === 'video') {
      const curX = item.pos ? (item.pos.x / 100) * boxWidth - boxWidth / 2 : 0;
      const curY = item.pos ? (item.pos.y / 100) * canvasHeight - canvasHeight / 2 : 0;
      onUpdateClipTransform?.(
        item.id,
        'video',
        {
          x: Math.round(curX),
          y: Math.round(curY),
          scale: item.scale,
          rotation: nextRot,
        },
        true
      );
    } else {
      onUpdateClipTransform?.(
        item.id,
        item.type,
        {
          x: item.pos.x,
          y: item.pos.y,
          scale: item.scale,
          rotation: nextRot,
        },
        true
      );
    }
  };

  const handleQuickReset = (item: any) => {
    if (item.type === 'video') {
      onUpdateClipTransform?.(
        item.id,
        'video',
        {
          x: 0,
          y: 0,
          scale: 1.0,
          rotation: 0,
        },
        true
      );
    } else {
      onUpdateClipTransform?.(
        item.id,
        item.type,
        {
          x: 50,
          y: item.type === 'text' ? 35 : 50,
          scale: item.type === 'sticker' ? 1.2 : 1.0,
          rotation: 0,
        },
        true
      );
    }
  };

  const handleStartDrag = (
    e: any,
    mode: 'move' | 'scale' | 'rotate',
    corner?: 'tl' | 'tr' | 'bl' | 'br',
    overrideItem?: any
  ) => {
    e.stopPropagation?.();
    if (e.preventDefault && Platform.OS === 'web') {
      e.preventDefault();
    }
    const targetItem = overrideItem || activeTransformItem;
    if (!targetItem) return;

    const clientX =
      e.touches && e.touches.length > 0
        ? e.touches[0].clientX
        : e.clientX !== undefined
        ? e.clientX
        : e.nativeEvent?.pageX || 0;
    const clientY =
      e.touches && e.touches.length > 0
        ? e.touches[0].clientY
        : e.clientY !== undefined
        ? e.clientY
        : e.nativeEvent?.pageY || 0;

    const itemCenterX = (targetItem.pos.x / 100) * boxWidth;
    const itemCenterY = (targetItem.pos.y / 100) * canvasHeight;

    const boxRect = canvasBoxRef.current?.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
    };
    const absCenterX = boxRect.left + itemCenterX;
    const absCenterY = boxRect.top + itemCenterY;

    const startDist = Math.hypot(clientX - absCenterX, clientY - absCenterY);
    const startAngle = Math.atan2(clientY - absCenterY, clientX - absCenterX);

    setDragState({
      mode,
      corner,
      clipId: targetItem.id,
      clipType: targetItem.type,
      startClientX: clientX,
      startClientY: clientY,
      startCenterX: itemCenterX,
      startCenterY: itemCenterY,
      startScale: targetItem.scale,
      startRotation: targetItem.rotation,
      startDist: Math.max(10, startDist),
      startAngle,
    });
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !dragState) return;

    const handlePointerMove = (e: any) => {
      const clientX =
        e.touches && e.touches.length > 0
          ? e.touches[0].clientX
          : e.clientX !== undefined
          ? e.clientX
          : 0;
      const clientY =
        e.touches && e.touches.length > 0
          ? e.touches[0].clientY
          : e.clientY !== undefined
          ? e.clientY
          : 0;

      if (dragState.mode === 'move') {
        const dx = clientX - dragState.startClientX;
        const dy = clientY - dragState.startClientY;
        const newCenterX = dragState.startCenterX + dx;
        const newCenterY = dragState.startCenterY + dy;

        if (dragState.clipType === 'video') {
          const transformX = newCenterX - boxWidth / 2;
          const transformY = newCenterY - canvasHeight / 2;
          scheduleTransformUpdate(
            dragState.clipId,
            'video',
            {
              x: Math.round(transformX),
              y: Math.round(transformY),
              scale: dragState.startScale,
              rotation: dragState.startRotation,
            },
            false
          );
        } else {
          const newPctX = Math.max(5, Math.min(95, Number(((newCenterX / boxWidth) * 100).toFixed(1))));
          const newPctY = Math.max(5, Math.min(95, Number(((newCenterY / canvasHeight) * 100).toFixed(1))));
          scheduleTransformUpdate(
            dragState.clipId,
            dragState.clipType,
            {
              x: newPctX,
              y: newPctY,
              scale: dragState.startScale,
              rotation: dragState.startRotation,
            },
            false
          );
        }
      } else if (dragState.mode === 'scale') {
        const boxRect = canvasBoxRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
        const absCenterX = boxRect.left + dragState.startCenterX;
        const absCenterY = boxRect.top + dragState.startCenterY;

        const currentDist = Math.hypot(clientX - absCenterX, clientY - absCenterY);
        const ratio = currentDist / Math.max(10, dragState.startDist);
        const newScale = Math.max(0.2, Math.min(4.0, Number((dragState.startScale * ratio).toFixed(2))));

        if (dragState.clipType === 'video') {
          const transformX = dragState.startCenterX - boxWidth / 2;
          const transformY = dragState.startCenterY - canvasHeight / 2;
          scheduleTransformUpdate(
            dragState.clipId,
            'video',
            {
              x: Math.round(transformX),
              y: Math.round(transformY),
              scale: newScale,
              rotation: dragState.startRotation,
            },
            false
          );
        } else {
          const posX = (dragState.startCenterX / boxWidth) * 100;
          const posY = (dragState.startCenterY / canvasHeight) * 100;
          scheduleTransformUpdate(
            dragState.clipId,
            dragState.clipType,
            {
              x: posX,
              y: posY,
              scale: newScale,
              rotation: dragState.startRotation,
            },
            false
          );
        }
      } else if (dragState.mode === 'rotate') {
        const boxRect = canvasBoxRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
        const absCenterX = boxRect.left + dragState.startCenterX;
        const absCenterY = boxRect.top + dragState.startCenterY;

        const currentAngle = Math.atan2(clientY - absCenterY, clientX - absCenterX);
        const angleDiffDeg = ((currentAngle - dragState.startAngle) * 180) / Math.PI;
        const rawDeg = (dragState.startRotation + angleDiffDeg) % 360;
        const normalized = ((rawDeg % 360) + 360) % 360;

        let snapped = Math.round(normalized);
        [0, 90, 180, 270, 360].forEach((snap) => {
          if (Math.abs(snapped - snap) <= 4) snapped = snap % 360;
        });

        if (dragState.clipType === 'video') {
          const transformX = dragState.startCenterX - boxWidth / 2;
          const transformY = dragState.startCenterY - canvasHeight / 2;
          scheduleTransformUpdate(
            dragState.clipId,
            'video',
            {
              x: Math.round(transformX),
              y: Math.round(transformY),
              scale: dragState.startScale,
              rotation: snapped,
            },
            false
          );
        } else {
          const posX = (dragState.startCenterX / boxWidth) * 100;
          const posY = (dragState.startCenterY / canvasHeight) * 100;
          scheduleTransformUpdate(
            dragState.clipId,
            dragState.clipType,
            {
              x: posX,
              y: posY,
              scale: dragState.startScale,
              rotation: snapped,
            },
            false
          );
        }
      }
    };

    const handlePointerUp = () => {
      if (latestTransformRef.current) {
        scheduleTransformUpdate(
          latestTransformRef.current.clipId,
          latestTransformRef.current.clipType,
          latestTransformRef.current.transform,
          true
        );
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [dragState, boxWidth, canvasHeight]);

  // Two-Finger Gesture Support for Mobile touchscreens (Pinch-to-scale, Twist-to-rotate, Pan-to-move)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleTouchStartMulti = (e: TouchEvent) => {
      if (e.touches.length === 2 && activeTransformItem) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        touchGestureRef.current = {
          initialDist: Math.max(10, dist),
          initialAngle: angle,
          initialScale: activeTransformItem.scale,
          initialRotation: activeTransformItem.rotation,
          initialCenterX: (activeTransformItem.pos.x / 100) * boxWidth,
          initialCenterY: (activeTransformItem.pos.y / 100) * canvasHeight,
          midClientX: midX,
          midClientY: midY,
          clipId: activeTransformItem.id,
          clipType: activeTransformItem.type,
        } as any;
      }
    };

    const handleTouchMoveMulti = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchGestureRef.current) {
        if (e.preventDefault) e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        const g: any = touchGestureRef.current;
        const scaleRatio = dist / Math.max(10, g.initialDist);
        const newScale = Math.max(0.2, Math.min(4.0, Number((g.initialScale * scaleRatio).toFixed(2))));

        const angleDiffDeg = ((angle - g.initialAngle) * 180) / Math.PI;
        const rawDeg = (g.initialRotation + angleDiffDeg) % 360;
        const newRotation = Math.round(((rawDeg % 360) + 360) % 360);

        const dx = midX - g.midClientX;
        const dy = midY - g.midClientY;
        const newCenterX = g.initialCenterX + dx;
        const newCenterY = g.initialCenterY + dy;

        if (g.clipType === 'video') {
          const transformX = newCenterX - boxWidth / 2;
          const transformY = newCenterY - canvasHeight / 2;
          scheduleTransformUpdate(
            g.clipId,
            'video',
            {
              x: Math.round(transformX),
              y: Math.round(transformY),
              scale: newScale,
              rotation: newRotation,
            },
            false
          );
        } else {
          const newPctX = Math.max(5, Math.min(95, Number(((newCenterX / boxWidth) * 100).toFixed(1))));
          const newPctY = Math.max(5, Math.min(95, Number(((newCenterY / canvasHeight) * 100).toFixed(1))));
          scheduleTransformUpdate(
            g.clipId,
            g.clipType,
            {
              x: newPctX,
              y: newPctY,
              scale: newScale,
              rotation: newRotation,
            },
            false
          );
        }
      }
    };

    const handleTouchEndMulti = (e: TouchEvent) => {
      if (latestTransformRef.current) {
        scheduleTransformUpdate(
          latestTransformRef.current.clipId,
          latestTransformRef.current.clipType,
          latestTransformRef.current.transform,
          true
        );
      }
      if (e.touches.length < 2) {
        touchGestureRef.current = null;
      }
    };

    window.addEventListener('touchstart', handleTouchStartMulti);
    window.addEventListener('touchmove', handleTouchMoveMulti, { passive: false });
    window.addEventListener('touchend', handleTouchEndMulti);

    return () => {
      window.removeEventListener('touchstart', handleTouchStartMulti);
      window.removeEventListener('touchmove', handleTouchMoveMulti);
      window.removeEventListener('touchend', handleTouchEndMulti);
    };
  }, [activeTransformItem, boxWidth, canvasHeight]);

  const stepFrame = (frames: number) => {
    const fps = 30;
    const nextTime = Math.max(0, Math.min(totalDuration, currentTime + frames / fps));
    onSeek(nextTime);
  };

  return (
    <View style={[styles.container, fullscreen && styles.containerFullscreen]}>
      {/* Fullscreen Mode Top Bar with Clear Revert / Exit Button */}
      {fullscreen && (
        <View style={styles.fullscreenTopBar}>
          <View style={styles.hudBadgeFullscreen}>
            <Text style={styles.hudText}>{project.aspectRatio} • {project.resolution || '1080P'}</Text>
          </View>
          <TouchableOpacity
            style={styles.exitFullscreenBtn}
            onPress={() => setFullscreen(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="contract" size={16} color="#000000" />
            <Text style={styles.exitFullscreenBtnText}>Exit Fullscreen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Canvas Viewport Area */}
      <View style={styles.viewportWrapper}>
        <View
          ref={canvasBoxRef}
          style={[styles.canvasBox, { width: boxWidth, height: canvasHeight }]}
        >
          {Platform.OS === 'web' ? (
            <canvas
              ref={canvasRef as any}
              width={canvasWidth * 2}
              height={canvasHeight * 2}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                borderRadius: 8,
              }}
            />
          ) : (
            <View style={styles.nativeFallback}>
              <Ionicons name="film-outline" size={48} color="#4B5563" />
              <Text style={styles.nativeFallbackText}>Live Canvas Engine</Text>
            </View>
          )}

          {/* Interactive On-Canvas Transform Overlay Layer */}
          {/* Interactive On-Canvas Transform Overlay Layer */}
          <View style={styles.interactiveCanvasLayer} pointerEvents="box-none">
            {/* Unselected Clickable & Immediately Draggable Hit Area for Active Video */}
            {activeVideo && selectedClipId !== activeVideo.id && (
              <View
                style={styles.unselectedVideoHitBox}
                {...({
                  onMouseDown: (e: any) => {
                    onSelectClip?.(activeVideo.id, 'video');
                    handleStartDrag(e, 'move', undefined, {
                      id: activeVideo.id,
                      type: 'video',
                      label: activeVideo.title,
                      pos: {
                        x: 50 + (((activeVideo.transform?.x || 0) / boxWidth) * 100),
                        y: 50 + (((activeVideo.transform?.y || 0) / canvasHeight) * 100),
                      },
                      scale: activeVideo.transform?.scale ?? 1.0,
                      rotation: activeVideo.transform?.rotation ?? 0,
                    });
                  },
                  onTouchStart: (e: any) => {
                    onSelectClip?.(activeVideo.id, 'video');
                    handleStartDrag(e, 'move', undefined, {
                      id: activeVideo.id,
                      type: 'video',
                      label: activeVideo.title,
                      pos: {
                        x: 50 + (((activeVideo.transform?.x || 0) / boxWidth) * 100),
                        y: 50 + (((activeVideo.transform?.y || 0) / canvasHeight) * 100),
                      },
                      scale: activeVideo.transform?.scale ?? 1.0,
                      rotation: activeVideo.transform?.rotation ?? 0,
                    });
                  },
                } as any)}
              />
            )}

            {/* Unselected Clickable & Immediately Draggable Hit Boxes for Active Texts */}
            {activeTexts.map((txt) => {
              if (txt.id === selectedClipId) return null;
              const cx = ((txt.position?.x ?? 50) / 100) * boxWidth;
              const cy = ((txt.position?.y ?? 35) / 100) * canvasHeight;
              const s = txt.scale || 1.0;
              const w = Math.min(boxWidth * 0.9, Math.max(80, (txt.text || '').length * ((txt.style?.fontSize || 24) * 0.58) + 30)) * s;
              const h = Math.max(40, ((txt.style?.fontSize || 24) * 1.3 + 16) * s);
              const itemObj = {
                id: txt.id,
                type: 'text',
                label: txt.text,
                pos: txt.position || { x: 50, y: 35 },
                scale: txt.scale ?? 1.0,
                rotation: txt.rotation ?? 0,
              };
              return (
                <View
                  key={txt.id}
                  style={[
                    styles.unselectedHitBox,
                    {
                      left: cx - w / 2,
                      top: cy - h / 2,
                      width: w,
                      height: h,
                      transform: [{ rotate: `${txt.rotation || 0}deg` }],
                    },
                  ]}
                  {...({
                    onMouseDown: (e: any) => {
                      onSelectClip?.(txt.id, 'text');
                      handleStartDrag(e, 'move', undefined, itemObj);
                    },
                    onTouchStart: (e: any) => {
                      onSelectClip?.(txt.id, 'text');
                      handleStartDrag(e, 'move', undefined, itemObj);
                    },
                  } as any)}
                />
              );
            })}

            {/* Unselected Clickable & Immediately Draggable Hit Boxes for Active Stickers */}
            {activeStickers.map((stk) => {
              if (stk.id === selectedClipId) return null;
              const cx = ((stk.position?.x ?? 50) / 100) * boxWidth;
              const cy = ((stk.position?.y ?? 50) / 100) * canvasHeight;
              const s = stk.scale || 1.2;
              const isBadge = stk.char.length > 2;
              const w = (isBadge ? 130 : 64) * s;
              const h = (isBadge ? 42 : 64) * s;
              const itemObj = {
                id: stk.id,
                type: 'sticker',
                label: stk.char,
                pos: stk.position || { x: 50, y: 50 },
                scale: stk.scale ?? 1.2,
                rotation: stk.rotation ?? 0,
              };
              return (
                <View
                  key={stk.id}
                  style={[
                    styles.unselectedHitBox,
                    {
                      left: cx - w / 2,
                      top: cy - h / 2,
                      width: w,
                      height: h,
                      transform: [{ rotate: `${stk.rotation || 0}deg` }],
                    },
                  ]}
                  {...({
                    onMouseDown: (e: any) => {
                      onSelectClip?.(stk.id, 'sticker');
                      handleStartDrag(e, 'move', undefined, itemObj);
                    },
                    onTouchStart: (e: any) => {
                      onSelectClip?.(stk.id, 'sticker');
                      handleStartDrag(e, 'move', undefined, itemObj);
                    },
                  } as any)}
                />
              );
            })}

            {/* Active Selected Transform Bounding Box with Hand Drag, Resize & Rotate Handles */}
            {activeTransformItem && (
              <View
                style={[
                  styles.activeTransformBox,
                  {
                    left: (activeTransformItem.pos.x / 100) * boxWidth - activeTransformItem.width / 2,
                    top: (activeTransformItem.pos.y / 100) * canvasHeight - activeTransformItem.height / 2,
                    width: activeTransformItem.width,
                    height: activeTransformItem.height,
                    transform: [{ rotate: `${activeTransformItem.rotation}deg` }],
                  },
                ]}
                {...({
                  onMouseDown: (e: any) => handleStartDrag(e, 'move'),
                  onTouchStart: (e: any) => handleStartDrag(e, 'move'),
                } as any)}
              >
                {/* Top Rotation Stem Line */}
                <View style={styles.rotStem} pointerEvents="none" />

                {/* Top Rotation Handle Knob */}
                <View
                  style={styles.rotKnob}
                  {...({
                    onMouseDown: (e: any) => handleStartDrag(e, 'rotate'),
                    onTouchStart: (e: any) => handleStartDrag(e, 'rotate'),
                  } as any)}
                >
                  <Ionicons name="sync-outline" size={13} color="#000000" />
                </View>

                {/* 4 Corner Resize Handles */}
                <View
                  style={[styles.cornerHandle, styles.handleTL]}
                  {...({
                    onMouseDown: (e: any) => handleStartDrag(e, 'scale', 'tl'),
                    onTouchStart: (e: any) => handleStartDrag(e, 'scale', 'tl'),
                  } as any)}
                />
                <View
                  style={[styles.cornerHandle, styles.handleTR]}
                  {...({
                    onMouseDown: (e: any) => handleStartDrag(e, 'scale', 'tr'),
                    onTouchStart: (e: any) => handleStartDrag(e, 'scale', 'tr'),
                  } as any)}
                />
                <View
                  style={[styles.cornerHandle, styles.handleBL]}
                  {...({
                    onMouseDown: (e: any) => handleStartDrag(e, 'scale', 'bl'),
                    onTouchStart: (e: any) => handleStartDrag(e, 'scale', 'bl'),
                  } as any)}
                />
                <View
                  style={[styles.cornerHandle, styles.handleBR]}
                  {...({
                    onMouseDown: (e: any) => handleStartDrag(e, 'scale', 'br'),
                    onTouchStart: (e: any) => handleStartDrag(e, 'scale', 'br'),
                  } as any)}
                />

                {/* Floating Quick Action Bar */}
                <View
                  style={[
                    styles.floatingBar,
                    (activeTransformItem.pos.y / 100) * canvasHeight < 70
                      ? styles.floatingBarBottom
                      : styles.floatingBarTop,
                    { transform: [{ rotate: `${-activeTransformItem.rotation}deg` }] },
                  ]}
                  {...({
                    onMouseDown: (e: any) => e.stopPropagation?.(),
                    onTouchStart: (e: any) => e.stopPropagation?.(),
                  } as any)}
                >
                  <View style={styles.floatingInfoPill}>
                    <Text style={styles.floatingInfoText}>
                      {activeTransformItem.scale.toFixed(1)}x • {Math.round(activeTransformItem.rotation)}°
                    </Text>
                  </View>

                  {/* Video specific: Custom Crop & Masking */}
                  {activeTransformItem.type === 'video' && (
                    <>
                      <TouchableOpacity
                        style={styles.floatingActionBtn}
                        onPress={() => onOpenCropModal?.(activeTransformItem.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="crop" size={13} color="#38BDF8" />
                        <Text style={styles.floatingBtnText}>Crop</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.floatingActionBtn}
                        onPress={() => onOpenMaskModal?.(activeTransformItem.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="shapes-outline" size={13} color="#F43F5E" />
                        <Text style={styles.floatingBtnText}>Mask</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Text/Sticker specific: Edit */}
                  {(activeTransformItem.type === 'text' || activeTransformItem.type === 'sticker') && (
                    <TouchableOpacity
                      style={styles.floatingActionBtn}
                      onPress={() => onOpenEditModal?.(activeTransformItem.id, activeTransformItem.type)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="pencil" size={13} color="#00F2FE" />
                      <Text style={styles.floatingBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  {/* Quick 90° Rotate */}
                  <TouchableOpacity
                    style={styles.floatingActionBtn}
                    onPress={() => handleQuickRotate(activeTransformItem)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="refresh" size={13} color="#FBBF24" />
                    <Text style={styles.floatingBtnText}>90°</Text>
                  </TouchableOpacity>

                  {/* Quick Reset */}
                  <TouchableOpacity
                    style={styles.floatingActionBtn}
                    onPress={() => handleQuickReset(activeTransformItem)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="reload-outline" size={13} color="#94A3B8" />
                    <Text style={styles.floatingBtnText}>Reset</Text>
                  </TouchableOpacity>

                  {/* Duplicate */}
                  <TouchableOpacity
                    style={styles.floatingActionBtn}
                    onPress={() => onDuplicateClip?.(activeTransformItem.id, activeTransformItem.type)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="copy-outline" size={13} color="#FFFFFF" />
                  </TouchableOpacity>

                  {/* Delete */}
                  <TouchableOpacity
                    style={[styles.floatingActionBtn, styles.floatingDeleteBtn]}
                    onPress={() => onDeleteClip?.(activeTransformItem.id, activeTransformItem.type)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="trash-outline" size={13} color="#FB7185" />
                  </TouchableOpacity>

                  {/* Done */}
                  <TouchableOpacity
                    style={[styles.floatingActionBtn, styles.floatingDoneBtn]}
                    onPress={() => onSelectClip?.(null)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="checkmark" size={14} color="#00F2FE" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Safe Zone Grid Overlay */}
          {showSafeZone && (
            <View style={styles.safeZoneBox} pointerEvents="none">
              <View style={styles.safeZoneLineHoriz} />
              <View style={styles.safeZoneLineVert} />
            </View>
          )}

          {/* Empty State Overlay when no track content is added */}
          {isProjectEmpty && (
            <TouchableOpacity
              style={styles.emptyCanvasOverlay}
              activeOpacity={0.85}
              onPress={onOpenMediaPicker}
            >
              <View style={styles.emptyUploadCircle}>
                <Ionicons name="film-outline" size={32} color="#00F2FE" />
              </View>
              <Text style={styles.emptyCanvasTitle}>No Media Added</Text>
              <Text style={styles.emptyCanvasSubtitle}>
                Import photos, videos, or pick from verified library
              </Text>
              <View style={styles.emptyActionRow}>
                <View style={styles.emptyUploadBtn}>
                  <Ionicons name="add" size={16} color="#000000" />
                  <Text style={styles.emptyUploadBtnText}>Add Media</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* HUD Badge: Aspect Ratio & Filter */}
          <View style={styles.hudBadge}>
            <Text style={styles.hudText}>{project.aspectRatio}</Text>
          </View>
        </View>
      </View>

      {/* Control Bar beneath player */}
      <View style={[styles.controlBar, isMobile && styles.controlBarMobile]}>
        {isMobile ? (
          <>
            {/* Mobile Row 1: Timecode on left, Utilities on right */}
            <View style={styles.mobileRowTop}>
              <View style={styles.timecodePill}>
                <Ionicons name="time-outline" size={13} color="#00F2FE" style={{ marginRight: 5 }} />
                <Text style={styles.timecodeText}>
                  {formatTime(currentTime)}
                  <Text style={styles.timecodeTotalText}> / {formatTime(totalDuration)}</Text>
                </Text>
              </View>

              <View style={styles.mobileActionsGroup}>
                <TouchableOpacity
                  style={[styles.smallBtn, showSafeZone && styles.smallBtnActive]}
                  onPress={() => setShowSafeZone(!showSafeZone)}
                  activeOpacity={0.7}
                  accessibilityLabel="Toggle Safe Zone Grid"
                >
                  <Ionicons name="grid-outline" size={15} color={showSafeZone ? '#00F2FE' : '#8E95A5'} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallBtn, hasKeyframeAtCurrentTime && styles.keyframeActive]}
                  onPress={onAddKeyframe}
                  activeOpacity={0.7}
                  accessibilityLabel="Add or Remove Keyframe"
                >
                  <Ionicons
                    name={hasKeyframeAtCurrentTime ? 'diamond' : 'diamond-outline'}
                    size={15}
                    color={hasKeyframeAtCurrentTime ? '#FFE600' : '#8E95A5'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() => setFullscreen(!fullscreen)}
                  activeOpacity={0.7}
                  accessibilityLabel={fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                >
                  <Ionicons
                    name={fullscreen ? 'contract-outline' : 'expand-outline'}
                    size={15}
                    color="#8E95A5"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Mobile Row 2: Playback Controls (Previous Frame, Play/Pause, Next Frame) */}
            <View style={styles.mobilePlaybackRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => stepFrame(-1)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Previous Frame"
              >
                <Ionicons name="play-skip-back" size={18} color="#8E95A5" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playPauseBtn}
                onPress={onTogglePlay}
                activeOpacity={0.8}
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={22}
                  color="#FFFFFF"
                  style={!isPlaying ? { marginLeft: 2 } : undefined}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => stepFrame(1)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Next Frame"
              >
                <Ionicons name="play-skip-forward" size={18} color="#8E95A5" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Desktop: 3-column layout where items never overlap */}
            <View style={styles.controlGroupLeft}>
              <TouchableOpacity
                style={[styles.smallBtn, showSafeZone && styles.smallBtnActive]}
                onPress={() => setShowSafeZone(!showSafeZone)}
                activeOpacity={0.7}
              >
                <Ionicons name="grid-outline" size={16} color={showSafeZone ? '#00F2FE' : '#8E95A5'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.smallBtn, hasKeyframeAtCurrentTime && styles.keyframeActive]}
                onPress={onAddKeyframe}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={hasKeyframeAtCurrentTime ? 'diamond' : 'diamond-outline'}
                  size={16}
                  color={hasKeyframeAtCurrentTime ? '#FFE600' : '#8E95A5'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.controlGroupCenter}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => stepFrame(-1)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Previous Frame"
              >
                <Ionicons name="play-skip-back" size={17} color="#8E95A5" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playPauseBtn}
                onPress={onTogglePlay}
                activeOpacity={0.8}
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={22}
                  color="#FFFFFF"
                  style={!isPlaying ? { marginLeft: 2 } : undefined}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => stepFrame(1)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Next Frame"
              >
                <Ionicons name="play-skip-forward" size={17} color="#8E95A5" />
              </TouchableOpacity>
            </View>

            <View style={styles.controlGroupRight}>
              <View style={styles.timecodePill}>
                <Ionicons name="time-outline" size={12} color="#00F2FE" style={{ marginRight: 4 }} />
                <Text style={styles.timecodeText}>
                  {formatTime(currentTime)}
                  <Text style={styles.timecodeTotalText}> / {formatTime(totalDuration)}</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => setFullscreen(!fullscreen)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={fullscreen ? 'contract-outline' : 'expand-outline'}
                  size={16}
                  color="#8E95A5"
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0B0D13',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
    overflow: 'hidden' as any,
  },
  containerFullscreen: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    backgroundColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullscreenTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
    zIndex: 100,
  },
  hudBadgeFullscreen: {
    backgroundColor: 'rgba(20, 23, 33, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#252B3B',
  },
  exitFullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00F2FE',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  exitFullscreenBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  viewportWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  canvasBox: {
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'visible' as any,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1E2333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  interactiveCanvasLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    overflow: 'visible' as any,
  },
  unselectedHitBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 8,
    cursor: 'pointer' as any,
    zIndex: 21,
  },
  unselectedVideoHitBox: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    cursor: 'pointer' as any,
  },
  activeTransformBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#00F2FE',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 242, 254, 0.05)',
    borderRadius: 8,
    zIndex: 25,
    cursor: 'move' as any,
    boxShadow: '0 0 14px rgba(0, 242, 254, 0.35)' as any,
  },
  rotStem: {
    position: 'absolute',
    top: -24,
    left: '50%',
    width: 1.5,
    height: 24,
    backgroundColor: '#00F2FE',
    marginLeft: -0.75,
  },
  rotKnob: {
    position: 'absolute',
    top: -42,
    left: '50%',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#00F2FE',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -13,
    cursor: 'grab' as any,
    boxShadow: '0 2px 6px rgba(0,0,0,0.6)' as any,
    zIndex: 28,
  },
  cornerHandle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00F2FE',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    boxShadow: '0 2px 6px rgba(0,0,0,0.6)' as any,
    zIndex: 27,
  },
  handleTL: {
    top: -8,
    left: -8,
    cursor: 'nwse-resize' as any,
  },
  handleTR: {
    top: -8,
    right: -8,
    cursor: 'nesw-resize' as any,
  },
  handleBL: {
    bottom: -8,
    left: -8,
    cursor: 'nesw-resize' as any,
  },
  handleBR: {
    bottom: -8,
    right: -8,
    cursor: 'nwse-resize' as any,
  },
  floatingBar: {
    position: 'absolute',
    left: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 20, 29, 0.96)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A3245',
    boxShadow: '0 6px 16px rgba(0,0,0,0.7)' as any,
    gap: 5,
    zIndex: 30,
  },
  floatingBarTop: {
    bottom: '100%',
    marginBottom: 48,
    marginLeft: -155,
  },
  floatingBarBottom: {
    top: '100%',
    marginTop: 22,
    marginLeft: -155,
  },
  floatingInfoPill: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
  },
  floatingInfoText: {
    color: '#00F2FE',
    fontSize: 9,
    fontWeight: '800',
  },
  floatingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#202636',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  floatingBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  floatingDeleteBtn: {
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
  },
  floatingDoneBtn: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
  },
  emptyCanvasOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0E1118',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 10,
  },
  emptyUploadCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyCanvasTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyCanvasSubtitle: {
    color: '#8E95A5',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 14,
  },
  emptyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00F2FE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyUploadBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  nativeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10131A',
  },
  nativeFallbackText: {
    color: '#8E95A5',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  safeZoneBox: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
    margin: 16,
  },
  safeZoneLineHoriz: {
    position: 'absolute',
    top: '33.33%',
    bottom: '33.33%',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  safeZoneLineVert: {
    position: 'absolute',
    left: '33.33%',
    right: '33.33%',
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  hudBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hudText: {
    color: '#00F2FE',
    fontSize: 10,
    fontWeight: '800',
  },
  controlBar: {
    width: '100%',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    marginTop: 4,
    marginBottom: 4,
    flexShrink: 0,
  },
  controlBarMobile: {
    height: 'auto',
    minHeight: 72,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 4,
  },
  mobileRowTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobilePlaybackRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  controlGroupLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  controlGroupCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  controlGroupRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  smallBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#141721',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnActive: {
    backgroundColor: '#1E2B3E',
  },
  keyframeActive: {
    backgroundColor: 'rgba(255, 230, 0, 0.2)',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(20, 23, 33, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FF0050',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF0050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  timecodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141721',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  timecodeText: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timecodeTotalText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
