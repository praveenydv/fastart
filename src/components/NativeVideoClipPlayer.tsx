import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoClip } from '../types/project';
import { useVideoPlayer, VideoView } from 'expo-video';

interface NativeVideoClipPlayerProps {
  clip: VideoClip;
  currentTime: number;
  isPlaying: boolean;
  onSelect?: () => void;
}

export default function NativeVideoClipPlayer({
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

  const clipDuration = Math.max(0.1, clip.duration || 10);
  const clipLocalTime = Math.max(0, Math.min(clipDuration, currentTime - clip.startTime));

  if (!mediaUri) {
    return (
      <View style={styles.fallbackBox}>
        <Ionicons name="film-outline" size={32} color="#00F2FE" />
        <Text style={styles.fallbackTitle}>{clip.title || 'Video Clip'}</Text>
      </View>
    );
  }

  if (isVideo) {
    return (
      <VideoClipRenderer
        uri={mediaUri}
        clipLocalTime={clipLocalTime}
        isPlaying={isPlaying}
        muted={clip.volume !== undefined ? clip.volume === 0 : false}
        speed={clip.speed || 1.0}
        fallbackThumbnail={clip.thumbnail}
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
  clipLocalTime,
  isPlaying,
  muted,
  speed,
  fallbackThumbnail,
}: {
  uri: string;
  clipLocalTime: number;
  isPlaying: boolean;
  muted: boolean;
  speed: number;
  fallbackThumbnail?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const lastSyncTimeRef = React.useRef(0);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = muted;
    p.playbackRate = speed;
  });

  useEffect(() => {
    if (!player) return;
    const sub = (player as any).addListener?.("statusChange", (payload: any) => {
      if (payload?.status === "error" || payload?.error) {
        setHasError(true);
      }
    });
    return () => {
      sub?.remove?.();
    };
  }, [player]);

  // Sync muted & speed
  useEffect(() => {
    if (!player || hasError) return;
    try {
      player.muted = muted;
      player.playbackRate = speed;
    } catch {}
  }, [player, muted, speed, hasError]);

  // Play / Pause transition
  useEffect(() => {
    if (!player || hasError) return;
    try {
      if (isPlaying) {
        if (Math.abs(player.currentTime - clipLocalTime) > 0.25) {
          player.currentTime = clipLocalTime;
        }
        player.play();
      } else {
        player.pause();
        if (Math.abs(player.currentTime - clipLocalTime) > 0.05) {
          player.currentTime = clipLocalTime;
        }
      }
    } catch {}
  }, [player, isPlaying, hasError]);

  // Scrubbing/seeking when paused, with throttled drift correction during play
  useEffect(() => {
    if (!player || hasError) return;
    try {
      if (!isPlaying) {
        if (Math.abs(player.currentTime - clipLocalTime) > 0.04) {
          player.currentTime = clipLocalTime;
        }
      } else {
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 400) {
          lastSyncTimeRef.current = now;
          if (Math.abs(player.currentTime - clipLocalTime) > 0.45) {
            player.currentTime = clipLocalTime;
          }
        }
      }
    } catch {}
  }, [player, clipLocalTime, isPlaying, hasError]);

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
        <Ionicons name="film-outline" size={32} color="#00F2FE" />
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
