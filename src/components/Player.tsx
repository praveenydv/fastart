import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);

  // Compute aspect ratio dimensions
  const getAspectRatioDimensions = () => {
    const { width: winW } = Dimensions.get('window');
    const containerH = fullscreen ? 550 : 260;
    const containerW = winW - 24;

    const ratioMap: Record<string, number> = {
      '9:16': 9 / 16,
      '16:9': 16 / 9,
      '1:1': 1 / 1,
      '4:5': 4 / 5,
      '2.35:1': 235 / 100,
    };

    const targetRatio = ratioMap[project.aspectRatio] || 9 / 16;
    let w = containerH * targetRatio;
    let h = containerH;

    if (w > containerW) {
      w = containerW;
      h = w / targetRatio;
    }

    return { width: Math.round(w), height: Math.round(h) };
  };

  const { width: canvasWidth, height: canvasHeight } = getAspectRatioDimensions();

  // Initialize renderer
  useEffect(() => {
    if (Platform.OS === 'web' && canvasRef.current) {
      rendererRef.current = new VideoRenderer(canvasRef.current);

      const clips = project.tracks.video || [];
      clips.forEach((clip) => {
        rendererRef.current?.preloadClip(clip);
      });
    }
  }, [project.aspectRatio]);

  // Render frame on timestamp or project change
  useEffect(() => {
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(project, currentTime);
    }
  }, [currentTime, project]);

  // Audio playback synchronization
  useEffect(() => {
    const activeAudio = project.tracks.audio?.[0];
    if (Platform.OS === 'web' && activeAudio) {
      if (!audioRef.current) {
        audioRef.current = new Audio(activeAudio.url);
      }
      if (isPlaying) {
        audioRef.current.currentTime = currentTime;
        audioRef.current.volume = activeAudio.volume ?? 1.0;
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isPlaying]);

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
      {/* Canvas Viewport Area */}
      <View style={styles.viewportWrapper}>
        <View style={[styles.canvasBox, { width: canvasWidth, height: canvasHeight }]}>
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
          {(!project.tracks.video || project.tracks.video.length === 0) && (
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
                Tap here to upload a video or photo
              </Text>
              <View style={styles.emptyUploadBtn}>
                <Ionicons name="add" size={16} color="#000000" />
                <Text style={styles.emptyUploadBtnText}>Add Media</Text>
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
      <View style={styles.controlBar}>
        {/* Left: Safezone and Keyframe diamond */}
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

        {/* Center: Frame stepping and Big Play/Pause */}
        <View style={styles.controlGroupCenter}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => stepFrame(-1)} activeOpacity={0.7}>
            <Ionicons name="play-skip-back" size={16} color="#8E95A5" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playPauseBtn} onPress={onTogglePlay} activeOpacity={0.8}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.stepBtn} onPress={() => stepFrame(1)} activeOpacity={0.7}>
            <Ionicons name="play-skip-forward" size={16} color="#8E95A5" />
          </TouchableOpacity>
        </View>

        {/* Right: Timestamp and Fullscreen */}
        <View style={styles.controlGroupRight}>
          <Text style={styles.timecodeText}>
            {formatTime(currentTime)} <Text style={{ color: '#4B5563' }}>/ {formatTime(totalDuration)}</Text>
          </Text>

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B0D13',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  containerFullscreen: {
    paddingVertical: 16,
  },
  viewportWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00F2FE',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 4,
  },
  emptyUploadBtnText: {
    color: '#000000',
    fontSize: 12,
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
    marginTop: 8,
  },
  controlGroupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlGroupCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlGroupRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF0050',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF0050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  timecodeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
