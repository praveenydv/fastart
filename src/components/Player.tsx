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
}: PlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<VideoRenderer | null>(null);
  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
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
  const hasNoMedia = !project.tracks.video || project.tracks.video.length === 0;
  // Ensure empty state has comfortable width for buttons and text
  const boxWidth = hasNoMedia ? Math.max(canvasWidth, Math.min(winW - 32, 320)) : canvasWidth;

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
        <View style={[styles.canvasBox, { width: boxWidth, height: canvasHeight }]}>
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

          {/* Safe Zone Grid Overlay */}
          {showSafeZone && (
            <View style={styles.safeZoneBox} pointerEvents="none">
              <View style={styles.safeZoneLineHoriz} />
              <View style={styles.safeZoneLineVert} />
            </View>
          )}

          {/* Empty State Overlay when no media is added */}
          {hasNoMedia && (
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
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1E2333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
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
