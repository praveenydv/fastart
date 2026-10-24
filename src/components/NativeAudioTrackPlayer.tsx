import React, { useEffect } from "react";
import { View } from "react-native";
import { useVideoPlayer } from "expo-video";
import { AudioClip } from "../types/project";

interface NativeAudioTrackPlayerProps {
  clip: AudioClip;
  currentTime: number;
  isPlaying: boolean;
}

function NativeAudioTrackPlayerComponent({
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
  const isUpcoming = currentTime < startTime;
  const clipLocalTime = Math.max(0, (currentTime - startTime) * speed + trimIn);
  const targetAudioTime = isUpcoming ? trimIn : clipLocalTime;

  const lastSeekTargetRef = React.useRef<number>(-1);
  const lastSeekTimestampRef = React.useRef<number>(0);
  const isPlayingRef = React.useRef<boolean>(false);
  const targetAudioTimeRef = React.useRef<number>(targetAudioTime);
  targetAudioTimeRef.current = targetAudioTime;

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = !isInside || volume === 0;
    p.playbackRate = speed;
    try {
      p.currentTime = targetAudioTime;
      lastSeekTargetRef.current = targetAudioTime;
    } catch {}
    if (typeof (p as any).volume === "number") {
      (p as any).volume = !isInside ? 0 : Math.max(0, Math.min(1, volume));
    }
  });

  // Track status changes and perform one-time initial pre-warm when ready
  useEffect(() => {
    if (!player) return;
    const sub = (player as any).addListener?.("statusChange", (payload: any) => {
      if (payload?.status === "readyToPlay") {
        const curTarget = targetAudioTimeRef.current;
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

  // Sync volume & speed
  useEffect(() => {
    if (!player) return;
    try {
      player.muted = !isInside || volume === 0;
      player.playbackRate = speed;
      if (typeof (player as any).volume === "number") {
        (player as any).volume = !isInside ? 0 : Math.max(0, Math.min(1, volume));
      }
    } catch {}
  }, [player, volume, speed, isInside]);

  // Play / Pause transition - start immediately if isInside, otherwise stay paused and pre-warmed
  useEffect(() => {
    if (!player) return;
    const curTarget = targetAudioTimeRef.current;
    try {
      if (isPlaying && isInside) {
        if (Math.abs(player.currentTime - curTarget) > 0.4) {
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
        player.play();
      } else {
        player.pause();
        if (!isPlaying && Math.abs(lastSeekTargetRef.current - curTarget) > 0.04) {
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
      }
    } catch {}
  }, [player, isPlaying, isInside]);

  // Scrubbing/seeking when paused
  useEffect(() => {
    if (!player || isPlaying) return;
    const now = Date.now();
    try {
      if (
        Math.abs(lastSeekTargetRef.current - targetAudioTime) > 0.03 &&
        now - lastSeekTimestampRef.current > 25
      ) {
        lastSeekTimestampRef.current = now;
        lastSeekTargetRef.current = targetAudioTime;
        player.currentTime = targetAudioTime;
      }
    } catch {}
  }, [player, targetAudioTime, isPlaying]);

  // Periodic drift check during active playback (interval instead of per-frame effect)
  useEffect(() => {
    if (!player || !isPlaying || !isInside) return;
    const interval = setInterval(() => {
      try {
        const curTarget = targetAudioTimeRef.current;
        if (Math.abs(player.currentTime - curTarget) > 0.5) {
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
      } catch {}
    }, 600);
    return () => clearInterval(interval);
  }, [player, isPlaying, isInside]);

  return <View style={{ width: 0, height: 0 }} pointerEvents="none" />;
}

export default React.memo(NativeAudioTrackPlayerComponent);
