import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoClip } from '../types/project';
import { useVideoPlayer, VideoView } from 'expo-video';
import { THEME_COLORS } from '../constants/designConstants';

interface NativeVideoClipPlayerProps {
  clip: VideoClip;
  currentTime: number;
  isPlaying: boolean;
  onSelect?: () => void;
}

function NativeVideoClipPlayerComponent({
  clip,
  currentTime,
  isPlaying,
}: NativeVideoClipPlayerProps) {
  const mediaUri = clip.url || clip.thumbnail || '';
  const isVideo =
    clip.type === 'video' ||
    (mediaUri &&
      (mediaUri.includes('.mp4') ||
        mediaUri.includes('.mov') ||
        mediaUri.includes('.webm') ||
        mediaUri.startsWith('file:') ||
        mediaUri.startsWith('content:') ||
        mediaUri.startsWith('http')));

  const clipDuration = Math.max(0.05, clip.duration || 10);
  const effSpeed = Math.max(0.1, Math.min(16, clip.speed || 1.0));
  const isInside = currentTime >= clip.startTime && currentTime <= clip.startTime + clipDuration;
  const isUpcoming = currentTime < clip.startTime;
  const isRecent = currentTime > clip.startTime + clipDuration;

  // Frame-accurate position accounting for trimIn, speed, reverse, and lookahead pre-warming
  const elapsed = isUpcoming
    ? 0
    : isRecent
    ? clipDuration
    : Math.max(0, Math.min(clipDuration, currentTime - clip.startTime));

  const targetMediaTime = clip.reverse
    ? Math.max(
        0,
        (clip.trimOut || (clip.trimIn || 0) + clipDuration) - elapsed * effSpeed,
      )
    : (clip.trimIn || 0) + elapsed * effSpeed;

  if (!mediaUri) {
    return (
      <View style={styles.fallbackBox}>
        <Ionicons name="film-outline" size={32} color={THEME_COLORS.accent} />
        <Text style={styles.fallbackTitle}>{clip.title || 'Video Clip'}</Text>
      </View>
    );
  }

  if (isVideo) {
    return (
      <VideoClipRenderer
        uri={mediaUri}
        targetMediaTime={targetMediaTime}
        isPlaying={isPlaying}
        muted={!isInside || (clip.volume !== undefined ? clip.volume === 0 : false)}
        speed={effSpeed}
        fallbackThumbnail={clip.thumbnail}
        isInside={isInside}
      />
    );
  }

  // Photo or image clip
  return (
    <Image
      source={{ uri: mediaUri }}
      style={styles.fullMedia}
      resizeMode="contain"
    />
  );
}

function VideoClipRenderer({
  uri,
  targetMediaTime,
  isPlaying,
  muted,
  speed,
  fallbackThumbnail,
  isInside,
}: {
  uri: string;
  targetMediaTime: number;
  isPlaying: boolean;
  muted: boolean;
  speed: number;
  fallbackThumbnail?: string;
  isInside: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const lastSeekTargetRef = React.useRef<number>(-1);
  const lastSeekTimestampRef = React.useRef<number>(0);
  const isPlayingRef = React.useRef<boolean>(false);
  const targetMediaTimeRef = React.useRef<number>(targetMediaTime);
  targetMediaTimeRef.current = targetMediaTime;

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = muted;
    p.playbackRate = speed;
    try {
      p.currentTime = targetMediaTime;
      lastSeekTargetRef.current = targetMediaTime;
    } catch {}
  });

  // Track status changes and perform one-time initial frame pre-warm when ready
  useEffect(() => {
    if (!player) return;
    const sub = (player as any).addListener?.("statusChange", (payload: any) => {
      if (payload?.status === "error" || payload?.error) {
        setHasError(true);
      } else if (payload?.status === "readyToPlay") {
        const curTarget = targetMediaTimeRef.current;
        if (!isPlayingRef.current && Math.abs(player.currentTime - curTarget) > 0.05) {
          try {
            player.currentTime = curTarget;
            lastSeekTargetRef.current = curTarget;
          } catch {}
        }
      }
    });
    return () => {
      sub?.remove?.();
    };
  }, [player]);

  useEffect(() => {
    isPlayingRef.current = isPlaying && isInside;
  }, [isPlaying, isInside]);

  // Sync muted & speed
  useEffect(() => {
    if (!player || hasError) return;
    try {
      player.muted = muted;
      player.playbackRate = speed;
    } catch {}
  }, [player, muted, speed, hasError]);

  // Seamless cut boundary play / pause transition:
  // When isInside becomes true during playback, start immediately from pre-warmed buffer without redundant seek
  useEffect(() => {
    if (!player || hasError) return;
    const curTarget = targetMediaTimeRef.current;
    try {
      if (isPlaying && isInside) {
        // If drifted excessively (> 0.4s), re-seek, otherwise start immediately for 0-latency cut transition
        if (Math.abs(player.currentTime - curTarget) > 0.4) {
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
        player.play();
      } else {
        // Stay paused and hold pre-warmed frame
        player.pause();
        // If not actively playing (e.g. scrubbing or pre-warming), seek to target frame.
        // During active playback when clip reaches its cut (isRecent), do not re-seek — preserve rendered final frame!
        if (!isPlaying && Math.abs(lastSeekTargetRef.current - curTarget) > 0.04) {
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
      }
    } catch {}
  }, [player, isPlaying, isInside, hasError]);

  // Throttled scrub/seek only when paused
  useEffect(() => {
    if (!player || hasError || isPlaying) return;
    const now = Date.now();
    try {
      if (
        Math.abs(lastSeekTargetRef.current - targetMediaTime) > 0.03 &&
        now - lastSeekTimestampRef.current > 25
      ) {
        lastSeekTimestampRef.current = now;
        lastSeekTargetRef.current = targetMediaTime;
        player.currentTime = targetMediaTime;
      }
    } catch {}
  }, [player, targetMediaTime, isPlaying, hasError]);

  // Periodic drift check during active playback (interval instead of per-frame effect)
  useEffect(() => {
    if (!player || hasError || !isPlaying || !isInside) return;
    const interval = setInterval(() => {
      try {
        const curTarget = targetMediaTimeRef.current;
        if (Math.abs(player.currentTime - curTarget) > 0.5) {
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
      } catch {}
    }, 600);
    return () => clearInterval(interval);
  }, [player, isPlaying, isInside, hasError]);

  if (hasError) {
    if (fallbackThumbnail) {
      return (
        <Image
          source={{ uri: fallbackThumbnail }}
          style={styles.fullMedia}
          resizeMode="contain"
        />
      );
    }
    return (
      <View style={styles.fallbackBox}>
        <Ionicons name="film-outline" size={32} color={THEME_COLORS.accent} />
        <Text style={styles.fallbackTitle}>Video Clip</Text>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={styles.fullMedia}
      contentFit="contain"
      nativeControls={false}
      surfaceType="textureView"
    />
  );
}

const styles = StyleSheet.create({
  fullMedia: {
    width: '100%',
    height: '100%',
  },
  fallbackBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#161924',
    borderRadius: 8,
    padding: 16,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
});

export default React.memo(NativeVideoClipPlayerComponent);
