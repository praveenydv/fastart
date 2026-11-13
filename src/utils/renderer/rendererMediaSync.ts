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

function getMediaContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let container = document.getElementById("fastart-media-sync-container");
  if (!container && document.body) {
    container = document.createElement("div");
    container.id = "fastart-media-sync-container";
    container.style.position = "fixed";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    container.style.width = "1px";
    container.style.height = "1px";
    container.style.opacity = "0.001";
    container.style.pointerEvents = "none";
    container.style.overflow = "hidden";
    container.style.zIndex = "-9999";
    container.setAttribute("aria-hidden", "true");
    document.body.appendChild(container);
  }
  return container;
}

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
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
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
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
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

  const cachedEl = ctx.videoElements.get(elementKey) || ctx.videoElements.get(clip.url);
  if (cachedEl) {
    if (clip.type === "video" && cachedEl instanceof HTMLVideoElement) {
      if (typeof document !== "undefined" && !cachedEl.parentNode) {
        const container = getMediaContainer();
        if (container) container.appendChild(cachedEl);
      }
      if (!cachedEl.muted) cachedEl.muted = true;
      if (!cachedEl.defaultMuted) cachedEl.defaultMuted = true;
      const currentSrc = cachedEl.src || cachedEl.currentSrc || "";
      const isDead = Boolean(cachedEl.error) || (cachedEl.networkState === 3);
      const urlChanged = Boolean(clip.url && currentSrc && !currentSrc.endsWith(clip.url) && currentSrc !== clip.url);

      if (clip.url && (urlChanged || isDead)) {
        try {
          cachedEl.pause();
          if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
            cachedEl.crossOrigin = "anonymous";
          } else {
            cachedEl.removeAttribute("crossorigin");
          }
          cachedEl.src = clip.url;
          cachedEl.load();
          ctx.videoElements.set(clip.url, cachedEl);
          globalActiveVideoElements.set(clip.url, cachedEl);
          ctx.videoElements.set(elementKey, cachedEl);
          globalActiveVideoElements.set(elementKey, cachedEl);
          if (clip.id) {
            ctx.videoElements.set(clip.id, cachedEl);
            globalActiveVideoElements.set(clip.id, cachedEl);
          }
        } catch (e) {}
      }
      return cachedEl;
    } else if (clip.type === "photo" && cachedEl instanceof HTMLImageElement) {
      const currentSrc = cachedEl.src || "";
      const urlChanged = Boolean(clip.url && currentSrc !== clip.url);
      if (clip.url && urlChanged) {
        cachedEl.src = clip.url;
        ctx.videoElements.set(clip.url, cachedEl);
        ctx.videoElements.set(elementKey, cachedEl);
      }
      return cachedEl;
    }
    return cachedEl;
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
            if (oldEl.parentNode) {
              oldEl.parentNode.removeChild(oldEl);
            }
          } catch (e) {}
        }
        ctx.videoElements.delete(oldestUrl);
        ctx.lastUsedTimestamp.delete(oldestUrl);
      }
    }

    const vid = document.createElement("video");
    const container = getMediaContainer();
    if (container && !vid.parentNode) {
      container.appendChild(vid);
    }
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
    const onSeeked = () => {
      trigger();
      if (vid.paused && typeof (vid as any)._targetMediaTime === "number") {
        const target = (vid as any)._targetMediaTime;
        if (Math.abs(vid.currentTime - target) > 0.02) {
          try {
            vid.currentTime = Math.max(0, target);
          } catch {}
        }
      }
    };
    vid.addEventListener("seeked", onSeeked);
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
        const curSrc = vid.src || vid.currentSrc || "";
        if (freshUrl && (!curSrc.endsWith(freshUrl) && curSrc !== freshUrl)) {
          ctx.videoElements.delete(clip.url);
          globalActiveVideoElements.delete(clip.url);
          clip.url = freshUrl;
          ctx.videoElements.set(freshUrl, vid);
          globalActiveVideoElements.set(freshUrl, vid);
          ctx.videoElements.set(elementKey, vid);
          globalActiveVideoElements.set(elementKey, vid);
          if (clip.id) {
            ctx.videoElements.set(clip.id, vid);
            globalActiveVideoElements.set(clip.id, vid);
          }
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
    if (clip.sourceMediaId) {
      ctx.videoElements.set(clip.sourceMediaId, vid);
      globalActiveVideoElements.set(clip.sourceMediaId, vid);
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
      (el as any)._playSessionActive = false;
      (el as any)._wasPlayingBeforePause = true;
      (el as any)._pauseTimestamp = now;
      (el as any)._isPlayPending = false;
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
      if (c.sourceMediaId) activeKeys.add(c.sourceMediaId);
    }
  });

  // 1. Pause any video that is NOT in activeClips
  ctx.videoElements.forEach((el, key) => {
    if (el instanceof HTMLVideoElement && !activeKeys.has(key)) {
      if (!el.paused) {
        try {
          el.pause();
        } catch {}
      }
      (el as any)._playSessionActive = false;
      (el as any)._isPlayPending = false;
    }
  });

  // 2. Synchronize all active videos simultaneously
  activeClips.forEach((activeClip) => {
    if (activeClip.type !== "video") return;

    const mediaEl =
      (activeClip.id ? ctx.videoElements.get(activeClip.id) : null) ||
      (activeClip.sourceMediaId ? ctx.videoElements.get(activeClip.sourceMediaId) : null) ||
      ctx.videoElements.get(activeClip.url);
    if (!mediaEl || !(mediaEl instanceof HTMLVideoElement)) return;
    const vid = mediaEl as HTMLVideoElement;

    // Ensure it remains attached to DOM container so Chromium/WebKit don't throttle decoders
    if (typeof document !== "undefined" && !vid.parentNode) {
      const container = getMediaContainer();
      if (container) container.appendChild(vid);
    }

    // Auto-heal URL mismatch or dead blob on active video element
    const curSrc = vid.src || vid.currentSrc || "";
    if (activeClip.url && (!curSrc.endsWith(activeClip.url) && curSrc !== activeClip.url)) {
      vid.src = activeClip.url;
      vid.load();
    }

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

      // Ensure audio muted on canvas video element so autoplay policy never rejects playback
      if (!vid.muted) vid.muted = true;
      if (!vid.defaultMuted) vid.defaultMuted = true;

      // If active seek is in flight, allow decoder to complete its buffer
      if (vid.seeking) {
        const seekDuration = now - ((vid as any)._seekStartTime || 0);
        if (seekDuration < 400) {
          return;
        }
      }

      // Startup synchronization: align position ONCE per play session
      if (!(vid as any)._playSessionActive) {
        (vid as any)._playSessionActive = true;
        const startDrift = Math.abs(vid.currentTime - mediaTime);
        if (vid.readyState >= 1 && startDrift > 0.05) {
          (vid as any)._lastHardSeek = now;
          (vid as any)._seekStartTime = now;
          try {
            vid.currentTime = Math.max(0, mediaTime);
          } catch (e) {}
        }
      }

      if (vid.paused) {
        // Start playback if not already pending
        if (!(vid as any)._isPlayPending) {
          (vid as any)._isPlayPending = true;
          vid.playbackRate = speed;
          const p = vid.play();
          if (p && typeof p.then === "function") {
            p.then(() => {
              (vid as any)._isPlayPending = false;
            }).catch(() => {
              (vid as any)._isPlayPending = false;
            });
          } else {
            (vid as any)._isPlayPending = false;
          }
        }
      } else {
        (vid as any)._isPlayPending = false;
        const drift = vid.currentTime - mediaTime;

        // ONLY perform a hard seek during playback if drift is catastrophic (> 2.0s, e.g. timeline jump)
        // Hard seeking flushes hardware decoders and drops playback frames if called repeatedly!
        if (Math.abs(drift) > 2.0 && now - lastHardSeek > 2000) {
          (vid as any)._lastHardSeek = now;
          (vid as any)._seekStartTime = now;
          try {
            vid.currentTime = Math.max(0, mediaTime);
          } catch (e) {}
        } else if (Math.abs(drift) > 0.02) {
          // Dynamic smooth micro-adjustment via playbackRate to eliminate drift smoothly without freezes:
          // If drift < 0 (video behind), adjust > 0 to speed up (up to 1.30x)
          // If drift > 0 (video ahead), adjust < 0 to slow down (down to 0.70x)
          const compFactor = Math.max(0.70, Math.min(1.30, 1 - drift * 0.8));
          const compRate = speed * compFactor;
          if (Math.abs(vid.playbackRate - compRate) > 0.015) {
            vid.playbackRate = Math.max(0.2, Math.min(16, compRate));
          }
        } else {
          if (Math.abs(vid.playbackRate - speed) > 0.01) {
            vid.playbackRate = speed;
          }
        }
      }
    } else {
      // Paused / Scrubbing state
      if ((vid as any)._playSessionActive || !vid.paused) {
        (vid as any)._playSessionActive = false;
        (vid as any)._isPlayPending = false;
        (vid as any)._pauseTimestamp = now;
        if (!vid.paused) {
          try {
            vid.pause();
          } catch {}
        }
        if (Math.abs(vid.playbackRate - speed) > 0.01) {
          vid.playbackRate = speed;
        }
      }

      (vid as any)._targetMediaTime = mediaTime;
      const diff = Math.abs(vid.currentTime - mediaTime);

      if (diff > 0.02) {
        const timeSinceLastSeek = now - lastHardSeek;
        const MIN_SEEK_INTERVAL_MS = 24; // Smooth ~40 FPS seek cadence while moving playhead

        const performSeek = (target: number) => {
          (vid as any)._lastHardSeek = Date.now();
          (vid as any)._seekStartTime = Date.now();
          if ((vid as any)._pendingSeekTimer) {
            clearTimeout((vid as any)._pendingSeekTimer);
            (vid as any)._pendingSeekTimer = null;
          }
          try {
            vid.currentTime = Math.max(0, target);
          } catch (e) {}
        };

        if (!vid.seeking && timeSinceLastSeek >= MIN_SEEK_INTERVAL_MS) {
          performSeek(mediaTime);
        } else {
          // Latest-frame-wins: Always schedule a trailing seek so the exact playhead position
          // is rendered even if the user stopped scrubbing during an in-flight seek
          if (!(vid as any)._pendingSeekTimer) {
            (vid as any)._pendingSeekTimer = setTimeout(() => {
              (vid as any)._pendingSeekTimer = null;
              if (vid.paused && typeof (vid as any)._targetMediaTime === "number") {
                const finalTarget = (vid as any)._targetMediaTime;
                if (Math.abs(vid.currentTime - finalTarget) > 0.02) {
                  performSeek(finalTarget);
                }
              }
            }, 35);
          }
        }
      }
    }
    ctx.lastUsedTimestamp.set(activeClip.url, Date.now());
    if (activeClip.id) {
      ctx.lastUsedTimestamp.set(activeClip.id, Date.now());
    }
    if (activeClip.sourceMediaId) {
      ctx.lastUsedTimestamp.set(activeClip.sourceMediaId, Date.now());
    }
  });
}
