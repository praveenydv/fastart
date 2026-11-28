import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, Image } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { VideoClip } from "../types/project";
import { useVideoPlayer, VideoView } from "expo-video";
import { THEME_COLORS } from "../constants/designConstants";
import { registerMediaDimensions } from "./Player/playerUtils";

interface NativeVideoClipPlayerProps {
  clip: VideoClip;
  currentTime: number;
  isPlaying: boolean;
  opacity?: number;
  isInside?: boolean;
  onSelect?: () => void;
}

function NativeVideoClipPlayerComponent({
  clip,
  currentTime,
  isPlaying,
  opacity,
  isInside: isInsideProp,
}: NativeVideoClipPlayerProps) {
  const mediaUri = clip.url || clip.thumbnail || "";
  // Trust the explicit media type. A `file://` URI can point to either a photo
  // or a video; treating every local file as video creates a decoder for large
  // photos and can exhaust native memory.
  const uriPath = mediaUri.split(/[?#]/, 1)[0].toLowerCase();
  const isVideo =
    clip.type === "video" ||
    (!clip.type && /\.(mp4|mov|webm|m4v|3gp|mkv|ts)$/.test(uriPath));

  const clipDuration = Math.max(0.05, clip.duration || 10);
  const effSpeed = Math.max(0.1, Math.min(16, clip.speed || 1.0));
  const isInside =
    isInsideProp !== undefined
      ? isInsideProp
      : currentTime >= clip.startTime &&
        currentTime <= clip.startTime + clipDuration;
  const isUpcoming = currentTime < clip.startTime;
  const isRecent =
    isInsideProp !== undefined
      ? !isInside && currentTime >= clip.startTime + clipDuration
      : currentTime > clip.startTime + clipDuration;

  // Frame-accurate position accounting for trimIn, speed, reverse, and lookahead pre-warming
  const elapsed = isUpcoming
    ? 0
    : isRecent
      ? clipDuration
      : Math.max(0, Math.min(clipDuration, currentTime - clip.startTime));

  const targetMediaTime = clip.reverse
    ? Math.max(
        0,
        (clip.trimOut || (clip.trimIn || 0) + clipDuration) -
          elapsed * effSpeed,
      )
    : (clip.trimIn || 0) + elapsed * effSpeed;

  const effectiveOpacity =
    opacity !== undefined ? Math.max(0, Math.min(1, opacity)) : 1;

  // Pre-load natural dimensions from photo or thumbnail for immediate portrait/landscape alignment
  useEffect(() => {
    if (mediaUri && (!clip.width || !clip.height)) {
      const targetUri = clip.thumbnail || mediaUri;
      if (
        typeof targetUri === "string" &&
        (targetUri.startsWith("file:") ||
          targetUri.startsWith("http") ||
          targetUri.startsWith("content:"))
      ) {
        Image.getSize(
          targetUri,
          (w, h) => {
            if (w > 0 && h > 0) {
              registerMediaDimensions(mediaUri, w, h);
              registerMediaDimensions(clip.id, w, h);
            }
          },
          () => {},
        );
      }
    }
  }, [mediaUri, clip.id, clip.width, clip.height, clip.thumbnail]);

  if (!mediaUri) {
    return (
      <View style={styles.fallbackBox}>
        <Ionicons name="film-outline" size={32} color={THEME_COLORS.accent} />
        <Text style={styles.fallbackTitle}>{clip.title || "Video Clip"}</Text>
      </View>
    );
  }

  const clipVol = clip.volume !== undefined ? clip.volume : 1.0;
  const newElapsed = Math.max(0, currentTime - (clip.startTime || 0));
  const clipDur = clip.duration || 10;
  const remaining = Math.max(0, clipDur - newElapsed);
  let fadeMultiplier = 1.0;
  if (clip.fadeIn && clip.fadeIn > 0 && newElapsed < clip.fadeIn) {
    fadeMultiplier = Math.min(
      fadeMultiplier,
      Math.max(0, newElapsed / clip.fadeIn),
    );
  }
  if (clip.fadeOut && clip.fadeOut > 0 && remaining < clip.fadeOut) {
    fadeMultiplier = Math.min(
      fadeMultiplier,
      Math.max(0, remaining / clip.fadeOut),
    );
  }
  const effectiveVolume = clip.muted
    ? 0
    : Math.max(0, Math.min(1, clipVol * fadeMultiplier));

  if (isVideo) {
    return (
      <VideoClipRenderer
        uri={mediaUri}
        clipId={clip.id}
        targetMediaTime={targetMediaTime}
        isPlaying={isPlaying}
        muted={!isInside || effectiveVolume === 0}
        volume={effectiveVolume}
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
          registerMediaDimensions(
            mediaUri,
            evt.source.width,
            evt.source.height,
          );
          registerMediaDimensions(clip.id, evt.source.width, evt.source.height);
        }
      }}
    />
  );
}

const VideoClipRenderer = React.memo(function VideoClipRenderer({
  uri,
  clipId,
  targetMediaTime,
  isPlaying,
  muted,
  volume = 1.0,
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
  volume?: number;
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
  const pendingSeekTimeoutRef = React.useRef<any>(null);
  const isPlayingRef = React.useRef<boolean>(false);
  const wasPlayingRef = React.useRef<boolean>(false);
  const pauseTimestampRef = React.useRef<number>(0);
  const targetMediaTimeRef = React.useRef<number>(targetMediaTime);
  targetMediaTimeRef.current = targetMediaTime;

  useEffect(() => {
    return () => {
      if (pendingSeekTimeoutRef.current) {
        clearTimeout(pendingSeekTimeoutRef.current);
        pendingSeekTimeoutRef.current = null;
      }
    };
  }, []);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = muted;
    p.playbackRate = speed;
    if (typeof (p as any).volume === "number") {
      (p as any).volume = muted ? 0 : Math.max(0, Math.min(1, volume));
    }
    try {
      p.currentTime = targetMediaTime;
      lastSeekTargetRef.current = targetMediaTime;
    } catch {}
  });

  const [isReady, setIsReady] = useState(
    () => (player as any)?.status === "readyToPlay",
  );

  // Track status changes and perform one-time initial frame pre-warm when ready
  useEffect(() => {
    if (!player) return;
    if ((player as any).status === "readyToPlay") {
      setIsReady(true);
    }
    const sub = (player as any).addListener?.(
      "statusChange",
      (payload: any) => {
        if (payload?.status === "error" || payload?.error) {
          setHasError(true);
        } else if (payload?.status === "readyToPlay") {
          setIsReady(true);
          const curTarget = targetMediaTimeRef.current;
          if (
            !isPlayingRef.current &&
            Math.abs(player.currentTime - curTarget) > 0.05
          ) {
            try {
              player.currentTime = curTarget;
              lastSeekTargetRef.current = curTarget;
            } catch {}
          }
        }
      },
    );
    const subSource = (player as any).addListener?.(
      "sourceLoad",
      (payload: any) => {
        const track = payload?.availableVideoTracks?.[0];
        if (track?.size?.width && track?.size?.height) {
          registerMediaDimensions(uri, track.size.width, track.size.height);
          if (clipId)
            registerMediaDimensions(
              clipId,
              track.size.width,
              track.size.height,
            );
        }
      },
    );
    const subTrack = (player as any).addListener?.(
      "videoTrackChange",
      (payload: any) => {
        const track = payload?.videoTrack;
        if (track?.size?.width && track?.size?.height) {
          registerMediaDimensions(uri, track.size.width, track.size.height);
          if (clipId)
            registerMediaDimensions(
              clipId,
              track.size.width,
              track.size.height,
            );
        }
      },
    );
    return () => {
      sub?.remove?.();
      subSource?.remove?.();
      subTrack?.remove?.();
    };
  }, [player, uri, clipId]);

  useEffect(() => {
    isPlayingRef.current = isPlaying && isInside;
  }, [isPlaying, isInside]);

  // Sync muted, volume & speed
  useEffect(() => {
    if (!player || hasError) return;
    try {
      player.muted = muted;
      player.playbackRate = speed;
      if (typeof (player as any).volume === "number") {
        (player as any).volume = muted ? 0 : Math.max(0, Math.min(1, volume));
      }
    } catch {}
  }, [player, muted, volume, speed, hasError]);

  // Seamless cut boundary play / pause transition:
  // When isInside becomes true during playback, start immediately from pre-warmed buffer without redundant seek
  useEffect(() => {
    if (!player || hasError) return;
    const curTarget = targetMediaTimeRef.current;
    const now = Date.now();
    try {
      try {
        // Never leave scrubbingModeEnabled=true because Android ExpoVideo suppresses playback while enabled
        if ((player as any).scrubbingModeOptions?.scrubbingModeEnabled) {
          (player as any).scrubbingModeOptions = { scrubbingModeEnabled: false };
        }
      } catch {}
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
        // If paused and not actively playing across a cut, seek to target frame so it is pre-warmed & ready
        if (
          !isPlaying &&
          Math.abs(lastSeekTargetRef.current - curTarget) > 0.008
        ) {
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
      }
    } catch {}
  }, [player, isPlaying, isInside, hasError]);

  // Bounded latest-frame-wins scrub/seek queue when paused
  useEffect(() => {
    if (!player || hasError || isPlaying) return;
    const now = Date.now();

    const diff = Math.abs(lastSeekTargetRef.current - targetMediaTime);
    if (diff <= 0.008) return;

    const timeSinceLastSeek = now - lastSeekTimestampRef.current;
    const MIN_SEEK_INTERVAL_MS = 20; // Frame-accurate scrub cadence keeping cutout mask & video aligned

    if (timeSinceLastSeek >= MIN_SEEK_INTERVAL_MS) {
      if (pendingSeekTimeoutRef.current) {
        clearTimeout(pendingSeekTimeoutRef.current);
        pendingSeekTimeoutRef.current = null;
      }
      lastSeekTimestampRef.current = now;
      lastSeekTargetRef.current = targetMediaTime;
      try {
        player.currentTime = targetMediaTime;
      } catch {}
    } else {
      // Schedule trailing seek so the latest scrub position always wins
      if (pendingSeekTimeoutRef.current) {
        clearTimeout(pendingSeekTimeoutRef.current);
      }
      const delay = MIN_SEEK_INTERVAL_MS - timeSinceLastSeek;
      pendingSeekTimeoutRef.current = setTimeout(() => {
        pendingSeekTimeoutRef.current = null;
        if (!player || hasError || isPlayingRef.current) return;
        lastSeekTimestampRef.current = Date.now();
        lastSeekTargetRef.current = targetMediaTimeRef.current;
        try {
          player.currentTime = targetMediaTimeRef.current;
        } catch {}
      }, delay);
    }
  }, [player, targetMediaTime, isPlaying, hasError]);

  // Periodic drift check during active playback (interval instead of per-frame effect)
  useEffect(() => {
    if (!player || hasError || !isPlaying || !isInside) return;
    const interval = setInterval(() => {
      try {
        const curTarget = targetMediaTimeRef.current;
        const now = Date.now();
        // Only hard-seek during active playback if drift is severe (> 1.5s) and not in seek cooldown
        if (
          Math.abs(player.currentTime - curTarget) > 1.5 &&
          now - lastSeekTimestampRef.current > 1500
        ) {
          lastSeekTimestampRef.current = now;
          player.currentTime = curTarget;
          lastSeekTargetRef.current = curTarget;
        }
      } catch {}
    }, 1200);
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
      {fallbackThumbnail ? (
        <ExpoImage
          source={{ uri: fallbackThumbnail }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      ) : null}
      <VideoView
        player={player}
        style={[styles.fullMedia, { opacity: isReady ? opacity : 0 }]}
        contentFit="contain"
        nativeControls={false}
        surfaceType="textureView"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  fullMedia: {
    width: "100%",
    height: "100%",
  },
  fallbackBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#161924",
    borderRadius: 8,
    padding: 16,
  },
  fallbackTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
});

export default React.memo(NativeVideoClipPlayerComponent);
