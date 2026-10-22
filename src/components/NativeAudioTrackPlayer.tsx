import React, { useEffect } from "react";
import { View } from "react-native";
import { useVideoPlayer } from "expo-video";
import { AudioClip } from "../types/project";

interface NativeAudioTrackPlayerProps {
  clip: AudioClip;
  currentTime: number;
  isPlaying: boolean;
}

export default function NativeAudioTrackPlayer({
  clip,
  currentTime,
  isPlaying,
}: NativeAudioTrackPlayerProps) {
  const mediaUri = clip.url || "";
  if (!mediaUri) return null;

  return (
    <NativeAudioPlayerInstance
      uri={mediaUri}
      startTime={clip.startTime || 0}
      duration={clip.duration || 10}
      trimIn={clip.trimIn || 0}
      volume={clip.volume ?? 1.0}
      speed={clip.speed || 1.0}
      currentTime={currentTime}
      isPlaying={isPlaying}
    />
  );
}

function NativeAudioPlayerInstance({
  uri,
  startTime,
  duration,
  trimIn,
  volume,
  speed,
  currentTime,
  isPlaying,
}: {
  uri: string;
  startTime: number;
  duration: number;
  trimIn: number;
  volume: number;
  speed: number;
  currentTime: number;
  isPlaying: boolean;
}) {
  const isInside =
    currentTime >= startTime && currentTime <= startTime + duration;
  const clipLocalTime = Math.max(0, (currentTime - startTime) * speed + trimIn);

  const lastSyncTimeRef = React.useRef(0);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = volume === 0;
    p.playbackRate = speed;
    if (typeof (p as any).volume === "number") {
      (p as any).volume = Math.max(0, Math.min(1, volume));
    }
  });

  // Sync volume & speed
  useEffect(() => {
    if (!player) return;
    try {
      player.muted = volume === 0;
      player.playbackRate = speed;
      if (typeof (player as any).volume === "number") {
        (player as any).volume = Math.max(0, Math.min(1, volume));
      }
    } catch {}
  }, [player, volume, speed]);

  // Play / Pause transition
  useEffect(() => {
    if (!player) return;
    try {
      if (isPlaying && isInside) {
        if (Math.abs(player.currentTime - clipLocalTime) > 0.25) {
          player.currentTime = clipLocalTime;
        }
        player.play();
      } else {
        player.pause();
        if (isInside && Math.abs(player.currentTime - clipLocalTime) > 0.05) {
          player.currentTime = clipLocalTime;
        }
      }
    } catch {}
  }, [player, isPlaying, isInside]);

  // Scrubbing/seeking when paused, with throttled drift correction during play
  useEffect(() => {
    if (!player) return;
    try {
      if (!isPlaying) {
        if (isInside && Math.abs(player.currentTime - clipLocalTime) > 0.04) {
          player.currentTime = clipLocalTime;
        }
      } else if (isInside) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 400) {
          lastSyncTimeRef.current = now;
          if (Math.abs(player.currentTime - clipLocalTime) > 0.45) {
            player.currentTime = clipLocalTime;
          }
        }
      }
    } catch {}
  }, [player, clipLocalTime, isPlaying, isInside]);

  return <View style={{ width: 0, height: 0 }} pointerEvents="none" />;
}
