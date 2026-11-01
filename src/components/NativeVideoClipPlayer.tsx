import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { VideoClip } from '../types/project';
import { useVideoPlayer, VideoView } from 'expo-video';
import { THEME_COLORS } from '../constants/designConstants';
import { registerMediaDimensions } from './Player/playerUtils';

interface NativeVideoClipPlayerProps {
  clip: VideoClip;
  currentTime: number;
  isPlaying: boolean;
  opacity?: number;
  onSelect?: () => void;
}

function NativeVideoClipPlayerComponent({
  clip,
  currentTime,
  isPlaying,
  opacity,
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

  const effectiveOpacity = opacity !== undefined ? Math.max(0, Math.min(1, opacity)) : 1;

  // Pre-load natural dimensions from photo or thumbnail for immediate portrait/landscape alignment
  useEffect(() => {
    if (mediaUri && (!clip.width || !clip.height)) {
      const targetUri = clip.thumbnail || mediaUri;
      if (typeof targetUri === 'string' && (targetUri.startsWith('file:') || targetUri.startsWith('http') || targetUri.startsWith('content:'))) {
        Image.getSize(
          targetUri,
          (w, h) => {
            if (w > 0 && h > 0) {
              registerMediaDimensions(mediaUri, w, h);
              registerMediaDimensions(clip.id, w, h);
            }
          },
          () => {}
        );
      }
    }
  }, [mediaUri, clip.id, clip.width, clip.height, clip.thumbnail]);

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
        clipId={clip.id}
        targetMediaTime={targetMediaTime}
        isPlaying={isPlaying}
        muted={!isInside || (clip.volume !== undefined ? clip.volume === 0 : false)}
        speed={effSpeed}
        fallbackThumbnail={clip.thumbnail}
        isInside={isInside}
        opacity={effectiveOpacity}
      />
    );
  }

  // Photo or image clip
  return (
    <ExpoImage
      source={{ uri: mediaUri }}
      style={[styles.fullMedia, { opacity: effectiveOpacity }]}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={120}
      onLoad={(evt) => {
        if (evt.source?.width && evt.source?.height) {
          registerMediaDimensions(mediaUri, evt.source.width, evt.source.height);
          registerMediaDimensions(clip.id, evt.source.width, evt.source.height);
        }
      }}
    />
  );
}

function VideoClipRenderer({
  uri,
  clipId,
  targetMediaTime,
  isPlaying,
  muted,
  speed,
  fallbackThumbnail,
  isInside,
  opacity = 1,
}: {
  uri: string;
  clipId?: string;
  targetMediaTime: number;
  isPlaying: boolean;
  muted: boolean;
  speed: number;
  fallbackThumbnail?: string;
  isInside: boolean;
  opacity?: number;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);
  const lastSeekTargetRef = React.useRef<number>(-1);
  const lastSeekTimestampRef = React.useRef<number>(0);
  const isPlayingRef = React.useRef<boolean>(false);
  const wasPlayingRef = React.useRef<boolean>(false);
  const pauseTimestampRef = React.useRef<number>(0);
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
    const subSource = (player as any).addListener?.("sourceLoad", (payload: any) => {
      const track = payload?.availableVideoTracks?.[0];
      if (track?.size?.width && track?.size?.height) {
        registerMediaDimensions(uri, track.size.width, track.size.height);
        if (clipId) registerMediaDimensions(clipId, track.size.width, track.size.height);
      }
    });
    const subTrack = (player as any).addListener?.("videoTrackChange", (payload: any) => {
      const track = payload?.videoTrack;
      if (track?.size?.width && track?.size?.height) {
        registerMediaDimensions(uri, track.size.width, track.size.height);
        if (clipId) registerMediaDimensions(clipId, track.size.width, track.size.height);
      }
    });
    return () => {
      sub?.remove?.();
      subSource?.remove?.();
      subTrack?.remove?.();
    };
  }, [player, uri, clipId]);

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
    const now = Date.now();
    try {
      if (isPlaying && isInside) {
        wasPlayingRef.current = true;
        pauseTimestampRef.current = 0;
        // If drifted excessively (> 0.4s), re-seek, otherwise start immediately for 0-latency cut transition
        if (Math.abs(player.currentTime - curTarget) > 0.4) {
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
        player.play();
      } else {
        const wasPlaying = wasPlayingRef.current;
        if (wasPlaying && !isPlaying) {
          pauseTimestampRef.current = now;
        }
        wasPlayingRef.current = isPlaying && isInside;
        // Stay paused and hold pre-warmed frame
        player.pause();
        const isWithinPauseGracePeriod = !isPlaying && now - pauseTimestampRef.current < 250;
        // If not actively playing and outside the pause settling window, seek to target frame.
        // During active playback when clip reaches its cut (isRecent), do not re-seek — preserve rendered final frame!
        if (!isPlaying && !isWithinPauseGracePeriod && Math.abs(lastSeekTargetRef.current - curTarget) > 0.04) {
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
    if (now - pauseTimestampRef.current < 250) return;
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
        <ExpoImage
          source={{ uri: fallbackThumbnail }}
          style={[styles.fullMedia, { opacity }]}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
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
    <View style={styles.fullMedia} needsOffscreenAlphaCompositing={opacity < 1}>
      <VideoView
        player={player}
        style={[styles.fullMedia, { opacity }]}
        contentFit="contain"
        nativeControls={false}
        surfaceType="textureView"
      />
    </View>
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
