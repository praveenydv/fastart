import { VideoClip } from "../../types/project";
import { getLiveMediaUrl } from "../largeMediaStorage";
import { setCachedMediaDuration } from "../mediaDuration";
import { evaluateSpeedCurve } from "./rendererEffects";
import { registerMediaDimensions } from "../../components/Player/playerUtils";

export interface MediaSyncContext {
  videoElements: Map<string, HTMLVideoElement | HTMLImageElement>;
  thumbnailElements: Map<string, HTMLImageElement>;
  lastUsedTimestamp: Map<string, number>;
  maxDecoders: number;
  onFrameNeeded?: () => void;
  isPlaying?: boolean;
}

// Global registry of active player video elements for 0ms frame extraction and split snapshots
export const globalActiveVideoElements = new Map<string, HTMLVideoElement>();

export function cleanupMedia(
  ctx: MediaSyncContext,
  offscreenCanvas?: HTMLCanvasElement | null,
) {
  ctx.videoElements.forEach((el) => {
    if (el instanceof HTMLVideoElement) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch (e) {}
    }
  });
  ctx.videoElements.clear();
  globalActiveVideoElements.clear();
  ctx.thumbnailElements.clear();
  ctx.lastUsedTimestamp.clear();
  if (offscreenCanvas) {
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;
  }
}

export function pruneUnusedMedia(
  ctx: MediaSyncContext,
  activeKeys: Set<string>,
) {
  // Collect all elements that are still referenced by any active key
  const stillNeededElements = new Set<HTMLVideoElement | HTMLImageElement>();
  activeKeys.forEach((key) => {
    const el = ctx.videoElements.get(key);
    if (el) stillNeededElements.add(el);
  });

  ctx.videoElements.forEach((el, key) => {
    if (!activeKeys.has(key)) {
      if (!stillNeededElements.has(el)) {
        if (el instanceof HTMLVideoElement) {
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
          } catch (e) {}
        }
      }
      ctx.videoElements.delete(key);
      globalActiveVideoElements.delete(key);
      ctx.lastUsedTimestamp.delete(key);
    }
  });
}

export async function preloadClip(
  ctx: MediaSyncContext,
  clip: VideoClip,
): Promise<HTMLVideoElement | HTMLImageElement | null> {
  if (typeof window === "undefined") return null;
  const elementKey = clip.id || clip.url;
  ctx.lastUsedTimestamp.set(elementKey, Date.now());

  // Preload clip thumbnail immediately for instant preview rendering & fallback
  if (clip.thumbnail && !ctx.thumbnailElements.has(clip.id)) {
    const thumb = new Image();
    thumb.onload = () => {
      if (ctx.onFrameNeeded) ctx.onFrameNeeded();
    };
    thumb.src = clip.thumbnail;
    ctx.thumbnailElements.set(clip.id, thumb);
  }

  if (ctx.videoElements.has(elementKey)) {
    return ctx.videoElements.get(elementKey)!;
  }
  if (
    ctx.videoElements.has(clip.url) &&
    !Array.from(ctx.videoElements.keys()).some((k) => k !== clip.url && k !== elementKey)
  ) {
    return ctx.videoElements.get(clip.url)!;
  }

  if (clip.type === "video") {
    // LRU Eviction: enforce maximum concurrent hardware decoders
    if (ctx.videoElements.size >= ctx.maxDecoders) {
      let oldestUrl: string | null = null;
      let oldestScore = Infinity;
      ctx.videoElements.forEach((el, url) => {
        const t = ctx.lastUsedTimestamp.get(url) || 0;
        const isPaused = el instanceof HTMLVideoElement ? el.paused : true;
        const score = t + (isPaused ? 0 : 1000000);
        if (score < oldestScore) {
          oldestScore = score;
          oldestUrl = url;
        }
      });

      if (oldestUrl) {
        const oldEl = ctx.videoElements.get(oldestUrl);
        if (oldEl instanceof HTMLVideoElement) {
          try {
            oldEl.pause();
            oldEl.removeAttribute("src");
            oldEl.load();
          } catch (e) {}
        }
        ctx.videoElements.delete(oldestUrl);
        ctx.lastUsedTimestamp.delete(oldestUrl);
      }
    }

    const vid = document.createElement("video");
    if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
      vid.crossOrigin = "anonymous";
    }
    vid.muted = true;
    vid.defaultMuted = true;
    vid.playsInline = true;
    vid.setAttribute("playsinline", "true");
    vid.setAttribute("webkit-playsinline", "true");
    vid.setAttribute("x5-playsinline", "true");
    vid.setAttribute("disablePictureInPicture", "true");
    vid.setAttribute("disableRemotePlayback", "true");
    vid.setAttribute("controlsList", "nodownload nofullscreen noremoteplayback");
    vid.setAttribute("muted", "");
    vid.preload = "auto";
    vid.src = clip.url;

    const trigger = () => {
      if (!ctx.isPlaying && ctx.onFrameNeeded) ctx.onFrameNeeded();
    };

    // Hardware-synchronized video frame delivery (zero duplicate draws, locked vsync)
    const onRvfc = () => {
      if (ctx.onFrameNeeded) ctx.onFrameNeeded();
      if (!vid.paused && typeof (vid as any).requestVideoFrameCallback === "function") {
        (vid as any).requestVideoFrameCallback(onRvfc);
      }
    };

    vid.addEventListener("play", () => {
      if (typeof (vid as any).requestVideoFrameCallback === "function") {
        (vid as any).requestVideoFrameCallback(onRvfc);
      }
    });

    vid.addEventListener("loadeddata", trigger);
    vid.addEventListener("canplay", trigger);
    vid.addEventListener("seeked", trigger);
    vid.addEventListener("loadedmetadata", () => {
      if (vid.videoWidth > 0 && vid.videoHeight > 0) {
        clip.width = vid.videoWidth;
        clip.height = vid.videoHeight;
        clip.naturalWidth = vid.videoWidth;
        clip.naturalHeight = vid.videoHeight;
        registerMediaDimensions(clip.url, vid.videoWidth, vid.videoHeight);
        if (clip.id) registerMediaDimensions(clip.id, vid.videoWidth, vid.videoHeight);
      }
      if (vid.duration && !isNaN(vid.duration) && isFinite(vid.duration) && vid.duration > 0) {
        setCachedMediaDuration(clip.url, vid.duration);
        if (clip.id) setCachedMediaDuration(clip.id, vid.duration);
        if (!clip.mediaDuration || (clip.mediaDuration <= 6.01 && vid.duration > 6.01)) {
          clip.mediaDuration = vid.duration;
        }
        if (
          Math.abs((clip.duration || 0) - 6.0) < 0.05 &&
          (clip.trimIn || 0) === 0 &&
          Math.abs((clip.trimOut || 0) - 6.0) < 0.05 &&
          vid.duration > 6.01
        ) {
          clip.duration = vid.duration;
          clip.trimOut = vid.duration;
        }
      }
      trigger();
    });
    vid.addEventListener("error", async () => {
      try {
        const lookupId = clip.sourceMediaId || clip.id;
        const freshUrl = await getLiveMediaUrl(lookupId, clip.title || (clip as any).name);
        if (freshUrl && freshUrl !== clip.url) {
          ctx.videoElements.delete(clip.url);
          globalActiveVideoElements.delete(clip.url);
          clip.url = freshUrl;
          ctx.videoElements.set(freshUrl, vid);
          globalActiveVideoElements.set(freshUrl, vid);
          vid.src = freshUrl;
          vid.load();
          return;
        }
      } catch (e) {}
      if (ctx.onFrameNeeded) ctx.onFrameNeeded();
    });
    vid.load();

    ctx.videoElements.set(elementKey, vid);
    if (clip.id) {
      ctx.videoElements.set(clip.id, vid);
      globalActiveVideoElements.set(clip.id, vid);
    }
    if (!ctx.videoElements.has(clip.url)) {
      ctx.videoElements.set(clip.url, vid);
    }
    globalActiveVideoElements.set(elementKey, vid);
    globalActiveVideoElements.set(clip.url, vid);
    return vid;
  } else {
    const img = new Image();
    if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        clip.width = img.naturalWidth;
        clip.height = img.naturalHeight;
        clip.naturalWidth = img.naturalWidth;
        clip.naturalHeight = img.naturalHeight;
        registerMediaDimensions(clip.url, img.naturalWidth, img.naturalHeight);
        if (clip.id) registerMediaDimensions(clip.id, img.naturalWidth, img.naturalHeight);
      }
      if (ctx.onFrameNeeded) ctx.onFrameNeeded();
    };
    img.onerror = async () => {
      try {
        const lookupId = clip.sourceMediaId || clip.id;
        const freshUrl = await getLiveMediaUrl(lookupId);
        if (freshUrl && freshUrl !== clip.url) {
          ctx.videoElements.delete(elementKey);
          ctx.videoElements.delete(clip.url);
          clip.url = freshUrl;
          ctx.videoElements.set(elementKey, img);
          img.src = freshUrl;
          return;
        }
      } catch (e) {}
      if (clip.thumbnail && clip.thumbnail !== clip.url) {
        img.src = clip.thumbnail;
        return;
      }
      if (img.crossOrigin) {
        img.removeAttribute("crossorigin");
        img.src = clip.url;
      }
    };
    img.src = clip.url;
    ctx.videoElements.set(elementKey, img);
    if (!ctx.videoElements.has(clip.url)) {
      ctx.videoElements.set(clip.url, img);
    }
    return img;
  }
}

export function pauseAllMedia(ctx: MediaSyncContext) {
  if (typeof window === "undefined") return;
  ctx.isPlaying = false;
  const now = Date.now();
  ctx.videoElements.forEach((el) => {
    if (el instanceof HTMLVideoElement) {
      (el as any)._wasPlayingBeforePause = true;
      (el as any)._pauseTimestamp = now;
      if (!el.paused) {
        try {
          el.pause();
        } catch {}
      }
    }
  });
}

export function syncPlayback(
  ctx: MediaSyncContext,
  activeClips: VideoClip[],
  time: number,
  isPlaying: boolean,
) {
  if (typeof window === "undefined") return;
  ctx.isPlaying = isPlaying;

  const activeKeys = new Set<string>();
  activeClips.forEach((c) => {
    if (c.type === "video") {
      activeKeys.add(c.id || c.url);
      activeKeys.add(c.url);
    }
  });

  // 1. Pause any video that is NOT in activeClips
  ctx.videoElements.forEach((el, key) => {
    if (el instanceof HTMLVideoElement && !activeKeys.has(key)) {
      if (!el.paused) {
        el.pause();
      }
    }
  });

  // 2. Synchronize all active videos simultaneously
  activeClips.forEach((activeClip) => {
    if (activeClip.type !== "video") return;

    const mediaEl = ctx.videoElements.get(activeClip.id) || ctx.videoElements.get(activeClip.url);
    if (!mediaEl || !(mediaEl instanceof HTMLVideoElement)) return;
    const vid = mediaEl as HTMLVideoElement;

    if (vid.duration && !isNaN(vid.duration) && isFinite(vid.duration) && vid.duration > 0) {
      if (!(vid as any)._durationCached) {
        (vid as any)._durationCached = true;
        setCachedMediaDuration(activeClip.url, vid.duration);
        if (activeClip.id) setCachedMediaDuration(activeClip.id, vid.duration);
      }
    }

    const clipLocalTime = Math.max(0, time - activeClip.startTime);
    let effectiveSpeed = Math.max(0.1, Math.min(16, activeClip.speed || 1.0));
    if (activeClip.speedCurve) {
      effectiveSpeed = evaluateSpeedCurve(
        activeClip.speedCurve,
        clipLocalTime / Math.max(0.1, activeClip.duration),
      );
    }

    const rawMediaTime = activeClip.reverse
      ? Math.max(
          0,
          (activeClip.trimOut || activeClip.duration) -
            clipLocalTime * effectiveSpeed,
        )
      : (activeClip.trimIn || 0) + clipLocalTime * effectiveSpeed;

    const mediaTime = vid.duration && vid.duration > 0
      ? Math.min(vid.duration, Math.max(0, rawMediaTime))
      : Math.max(0, rawMediaTime);

    const speed = Math.max(0.1, Math.min(16, effectiveSpeed));
    const now = Date.now();
    const lastHardSeek = (vid as any)._lastHardSeek || 0;

    if (isPlaying) {
      (vid as any)._wasPlayingBeforePause = false;
      (vid as any)._pauseTimestamp = 0;
      if (vid.seeking) {
        // Active seek is currently in flight: do not interrupt decoder buffer
        return;
      }

      if (vid.paused) {
        // Startup sync: snap directly to mediaTime if drift > 0.04s before starting playback
        if (Math.abs(vid.currentTime - mediaTime) > 0.04 && now - lastHardSeek > 400) {
          (vid as any)._lastHardSeek = now;
          vid.currentTime = Math.max(0, mediaTime);
        }
        vid.play().catch(() => {});
      } else {
        const drift = vid.currentTime - mediaTime;
        // Only hard-seek during playback if drift is severe (> 0.65s) and not in cooldown
        // This eliminates choppy playback and allows hardware decoding to run uninterrupted
        if (Math.abs(drift) > 0.65 && now - lastHardSeek > 800) {
          (vid as any)._lastHardSeek = now;
          vid.currentTime = Math.max(0, mediaTime);
        } else if (Math.abs(drift) > 0.025) {
          // Dynamic smooth micro-adjustment via playback rate to catch up in < 150ms without stutter
          const compFactor = Math.max(0.85, Math.min(1.15, 1 - drift * 0.8));
          const compRate = speed * compFactor;
          if (Math.abs(vid.playbackRate - compRate) > 0.01) {
            vid.playbackRate = Math.max(0.1, Math.min(16, compRate));
          }
        } else {
          if (Math.abs(vid.playbackRate - speed) > 0.01) {
            vid.playbackRate = speed;
          }
        }
      }
    } else {
      const wasPlaying = (vid as any)._wasPlayingBeforePause || false;
      if (!vid.paused) {
        vid.pause();
        (vid as any)._wasPlayingBeforePause = true;
        (vid as any)._pauseTimestamp = now;
      }
      // If the video was playing and just paused, preserve the rendered frame: DO NOT rewind to lagging state!
      // Only seek if the user is scrubbing while paused and we are past the pause transition window (250ms).
      const isWithinPauseGracePeriod = wasPlaying && (now - ((vid as any)._pauseTimestamp || 0) < 250);
      if (!isWithinPauseGracePeriod) {
        (vid as any)._wasPlayingBeforePause = false;
        if (!vid.seeking && Math.abs(vid.currentTime - mediaTime) > 0.04 && now - lastHardSeek > 100) {
          (vid as any)._lastHardSeek = now;
          vid.currentTime = Math.max(0, mediaTime);
        }
      }
    }
    ctx.lastUsedTimestamp.set(activeClip.url, Date.now());
    if (activeClip.id) {
      ctx.lastUsedTimestamp.set(activeClip.id, Date.now());
    }
  });
}
