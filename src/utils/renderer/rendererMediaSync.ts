import { VideoClip } from "../../types/project";
import { getLiveMediaUrl } from "../largeMediaStorage";
import { setCachedMediaDuration } from "../mediaDuration";
import { evaluateSpeedCurve } from "./rendererEffects";

export interface MediaSyncContext {
  videoElements: Map<string, HTMLVideoElement | HTMLImageElement>;
  thumbnailElements: Map<string, HTMLImageElement>;
  lastUsedTimestamp: Map<string, number>;
  maxDecoders: number;
  onFrameNeeded?: () => void;
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
      } catch (e) {}
    }
  });
  ctx.videoElements.clear();
  ctx.thumbnailElements.clear();
  ctx.lastUsedTimestamp.clear();
  if (offscreenCanvas) {
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;
  }
}

export function pruneUnusedMedia(
  ctx: MediaSyncContext,
  activeUrls: Set<string>,
) {
  ctx.videoElements.forEach((el, url) => {
    if (!activeUrls.has(url)) {
      if (el instanceof HTMLVideoElement) {
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch (e) {}
      }
      ctx.videoElements.delete(url);
      ctx.lastUsedTimestamp.delete(url);
    }
  });
}

export async function preloadClip(
  ctx: MediaSyncContext,
  clip: VideoClip,
): Promise<HTMLVideoElement | HTMLImageElement | null> {
  if (typeof window === "undefined") return null;
  ctx.lastUsedTimestamp.set(clip.url, Date.now());

  // Preload clip thumbnail immediately for instant preview rendering & fallback
  if (clip.thumbnail && !ctx.thumbnailElements.has(clip.id)) {
    const thumb = new Image();
    thumb.onload = () => {
      if (ctx.onFrameNeeded) ctx.onFrameNeeded();
    };
    thumb.src = clip.thumbnail;
    ctx.thumbnailElements.set(clip.id, thumb);
  }

  if (ctx.videoElements.has(clip.url)) {
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
      if (ctx.onFrameNeeded) ctx.onFrameNeeded();
    };

    vid.addEventListener("loadeddata", trigger);
    vid.addEventListener("canplay", trigger);
    vid.addEventListener("seeked", trigger);
    vid.addEventListener("loadedmetadata", () => {
      if (vid.duration && !isNaN(vid.duration) && isFinite(vid.duration) && vid.duration > 0) {
        setCachedMediaDuration(clip.url, vid.duration);
        if (clip.id) setCachedMediaDuration(clip.id, vid.duration);
      }
      trigger();
    });
    vid.addEventListener("error", async () => {
      try {
        const freshUrl = await getLiveMediaUrl(clip.id);
        if (freshUrl && freshUrl !== clip.url) {
          ctx.videoElements.delete(clip.url);
          clip.url = freshUrl;
          ctx.videoElements.set(freshUrl, vid);
          vid.src = freshUrl;
          vid.load();
          return;
        }
      } catch (e) {}
      if (ctx.onFrameNeeded) ctx.onFrameNeeded();
    });
    vid.load();

    ctx.videoElements.set(clip.url, vid);
    return vid;
  } else {
    const img = new Image();
    if (!clip.url.startsWith("blob:") && !clip.url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      if (ctx.onFrameNeeded) ctx.onFrameNeeded();
    };
    img.src = clip.url;
    ctx.videoElements.set(clip.url, img);
    return img;
  }
}

export function syncPlayback(
  ctx: MediaSyncContext,
  activeClips: VideoClip[],
  time: number,
  isPlaying: boolean,
) {
  if (typeof window === "undefined") return;

  const activeUrls = new Set(activeClips.filter((c) => c.type === "video").map((c) => c.url));

  // 1. Pause any video that is NOT in activeClips
  ctx.videoElements.forEach((el, url) => {
    if (el instanceof HTMLVideoElement && !activeUrls.has(url)) {
      if (!el.paused) {
        el.pause();
      }
    }
  });

  // 2. Synchronize all active videos simultaneously
  activeClips.forEach((activeClip) => {
    if (activeClip.type !== "video") return;

    const mediaEl = ctx.videoElements.get(activeClip.url);
    if (!mediaEl || !(mediaEl instanceof HTMLVideoElement)) return;
    const vid = mediaEl as HTMLVideoElement;

    if (vid.duration && !isNaN(vid.duration) && isFinite(vid.duration) && vid.duration > 0) {
      setCachedMediaDuration(activeClip.url, vid.duration);
      if (activeClip.id) setCachedMediaDuration(activeClip.id, vid.duration);
    }

    const clipLocalTime = Math.max(0, time - activeClip.startTime);
    let effectiveSpeed = Math.max(0.1, Math.min(16, activeClip.speed || 1.0));
    if (
      activeClip.speedCurve &&
      Array.isArray(activeClip.speedCurve) &&
      activeClip.speedCurve.length > 0
    ) {
      effectiveSpeed = evaluateSpeedCurve(
        activeClip.speedCurve as any[],
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
    if (vid.playbackRate !== speed) {
      vid.playbackRate = speed;
    }

    if (isPlaying) {
      if (vid.paused) {
        if (Math.abs(vid.currentTime - mediaTime) > 0.15) {
          vid.currentTime = Math.max(0, mediaTime);
        }
        vid.play().catch(() => {});
      } else {
        const drift = vid.currentTime - mediaTime;
        if (Math.abs(drift) > 0.6) {
          vid.currentTime = Math.max(0, mediaTime);
        } else if (Math.abs(drift) > 0.06) {
          const compRate = drift > 0 ? speed * 0.95 : speed * 1.05;
          if (Math.abs(vid.playbackRate - compRate) > 0.02) {
            vid.playbackRate = Math.max(0.1, Math.min(16, compRate));
          }
        } else {
          if (vid.playbackRate !== speed) {
            vid.playbackRate = speed;
          }
        }
      }
    } else {
      if (!vid.paused) {
        vid.pause();
      }
      if (Math.abs(vid.currentTime - mediaTime) > 0.04) {
        const target = Math.max(0, mediaTime);
        if (typeof (vid as any).fastSeek === "function") {
          try {
            (vid as any).fastSeek(target);
          } catch (e) {
            vid.currentTime = target;
          }
        } else {
          vid.currentTime = target;
        }
      }
    }
    ctx.lastUsedTimestamp.set(activeClip.url, Date.now());
  });
}
