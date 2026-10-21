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

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = muted;
    p.playbackRate = speed;
  });

  useEffect(() => {
    if (!player) return;
    try {
      player.muted = muted;
      player.playbackRate = speed;
      if (isPlaying) {
        if (Math.abs(player.currentTime - clipLocalTime) > 0.35) {
          player.currentTime = clipLocalTime;
        }
        player.play();
      } else {
        player.pause();
        if (Math.abs(player.currentTime - clipLocalTime) > 0.1) {
          player.currentTime = clipLocalTime;
        }
      }
    } catch {
      // Safe fallback
    }
  }, [player, isPlaying, clipLocalTime, muted, speed]);

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
