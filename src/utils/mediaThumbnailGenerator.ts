import { Platform } from "react-native";
import { isImageClip } from "./mediaDuration";
import { getLiveMediaUrl } from "./largeMediaStorage";
import { globalActiveVideoElements } from "./renderer/rendererMediaSync";

// In-memory thumbnail cache keyed by clipId or mediaUrl
export const globalThumbnailCache = new Map<string, string>();

type ThumbnailListener = (clipId: string, thumbUrl: string) => void;
const listeners = new Set<ThumbnailListener>();

export function subscribeThumbnailChange(listener: ThumbnailListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyThumbnailListeners(clipId: string, thumbUrl: string): void {
  listeners.forEach((fn) => {
    try {
      fn(clipId, thumbUrl);
    } catch (e) {
      // Ignore listener error
    }
  });
}

/**
 * Synchronously or near-instantaneously snapshots the current frame of an active video or canvas at the split point
 */
export function captureActiveFrameNow(mediaUrl?: string, seekSec?: number): string | null {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;

  try {
    // 1. Check global active video elements
    if (mediaUrl && globalActiveVideoElements.has(mediaUrl)) {
      const vid = globalActiveVideoElements.get(mediaUrl);
      if (vid && vid.videoWidth > 0 && vid.readyState >= 2) {
        if (seekSec === undefined || Math.abs(vid.currentTime - seekSec) <= 0.35) {
          const canvas = document.createElement("canvas");
          const aspect = (vid.videoWidth || 16) / (vid.videoHeight || 9);
          const tw = 240;
          const th = Math.round(tw / aspect);
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(vid, 0, 0, tw, th);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            if (dataUrl && dataUrl.length > 200) {
              return dataUrl;
            }
          }
        }
      }
    }

    // 2. Check any video elements in DOM
    const vids = document.querySelectorAll("video");
    for (let i = 0; i < vids.length; i++) {
      const vid = vids[i];
      if (
        (!mediaUrl || vid.src === mediaUrl || vid.currentSrc === mediaUrl) &&
        vid.videoWidth > 0 &&
        vid.readyState >= 2
      ) {
        if (seekSec === undefined || Math.abs(vid.currentTime - seekSec) <= 0.35) {
          const canvas = document.createElement("canvas");
          const aspect = (vid.videoWidth || 16) / (vid.videoHeight || 9);
          const tw = 240;
          const th = Math.round(tw / aspect);
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(vid, 0, 0, tw, th);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            if (dataUrl && dataUrl.length > 200) {
              return dataUrl;
            }
          }
        }
      }
    }
  } catch (e) {}

  return null;
}

const inFlightRequests = new Set<string>();

export function isCanvasBlackOrEmpty(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const w = canvas.width;
    const h = canvas.height;
    if (w <= 0 || h <= 0) return true;

    // Sample 9 spread points across the canvas
    const samplePoints: [number, number][] = [
      [w * 0.5, h * 0.5],
      [w * 0.25, h * 0.25],
      [w * 0.75, h * 0.75],
      [w * 0.5, h * 0.25],
      [w * 0.5, h * 0.75],
      [w * 0.25, h * 0.5],
      [w * 0.75, h * 0.5],
      [w * 0.35, h * 0.65],
      [w * 0.65, h * 0.35],
    ];

    let coloredSamples = 0;
    for (const [x, y] of samplePoints) {
      const p = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      // [r, g, b, a]
      if (p[3] > 10 && (p[0] > 16 || p[1] > 16 || p[2] > 16)) {
        coloredSamples++;
      }
    }
    // If fewer than 2 sample points have visible color, it is essentially black/empty
    return coloredSamples < 2;
  } catch (e) {
    // If tainted by CORS, do not treat as empty
    return false;
  }
}

/**
 * Returns thumbnail URL if immediately available, otherwise returns null and triggers background extraction.
 * For splitted clips (trimIn > 0), verifies that the thumbnail matches the split trimIn point.
 */
export function getMediaThumbnail(clip: any): string | null {
  if (!clip) return null;
  const raw = clip.rawClip || clip;
  const trimIn = typeof raw.trimIn === "number" ? raw.trimIn : 0;
  const isSplitted = trimIn > 0.05;

  // 1. If explicit thumbnail property is present on rawClip
  if (raw.thumbnail && typeof raw.thumbnail === "string" && raw.thumbnail.length > 0) {
    if (isSplitted) {
      if (typeof raw.thumbnailTrimIn === "number" && Math.abs(raw.thumbnailTrimIn - trimIn) <= 0.25) {
        globalThumbnailCache.set(clip.id, raw.thumbnail);
        return raw.thumbnail;
      }
      // Stale or inherited thumbnail detected: clear and request fresh frame at split point
      raw.thumbnail = undefined;
      requestMediaThumbnail(clip, true);
      return null;
    } else {
      globalThumbnailCache.set(clip.id, raw.thumbnail);
      return raw.thumbnail;
    }
  }

  // 2. If it's an image/photo clip, the image URL IS the preview thumbnail
  if (isImageClip(clip)) {
    const imgUrl = raw.url || clip.url || raw.thumbnail || clip.thumbnail;
    if (imgUrl) {
      globalThumbnailCache.set(clip.id, imgUrl);
      return imgUrl;
    }
  }

  // 3. Check memory cache by clipId + trimIn or clipId
  const trimKey = `${clip.id}_t${trimIn.toFixed(2)}`;
  if (globalThumbnailCache.has(trimKey)) {
    return globalThumbnailCache.get(trimKey)!;
  }
  if (!isSplitted && globalThumbnailCache.has(clip.id)) {
    return globalThumbnailCache.get(clip.id)!;
  }

  // 4. Check memory cache by url + trimIn
  const mediaUrl = raw.url || clip.url;
  if (mediaUrl) {
    const urlTimeKey = `${mediaUrl}_t${trimIn.toFixed(2)}`;
    if (globalThumbnailCache.has(urlTimeKey)) {
      const cached = globalThumbnailCache.get(urlTimeKey)!;
      globalThumbnailCache.set(clip.id, cached);
      globalThumbnailCache.set(trimKey, cached);
      return cached;
    }
    if (!isSplitted && globalThumbnailCache.has(mediaUrl)) {
      const cached = globalThumbnailCache.get(mediaUrl)!;
      globalThumbnailCache.set(clip.id, cached);
      return cached;
    }
  }

  // 5. Trigger instant capture or async extraction
  if (mediaUrl) {
    requestMediaThumbnail(clip);
  }

  return null;
}

/**
 * Asynchronously generates/extracts a video thumbnail for a clip at its exact split/trim position and caches it
 */
export async function requestMediaThumbnail(clip: any, forceRefresh = false): Promise<string | null> {
  if (!clip) return null;
  const raw = clip.rawClip || clip;
  const clipId = clip.id || raw.id;
  let mediaUrl = raw.url || clip.url;
  const trimIn = typeof raw.trimIn === "number" ? Math.max(0, raw.trimIn) : 0;
  const isSplitted = trimIn > 0.05;

  if (!clipId || !mediaUrl) return null;

  // Rehydrate dead blob URL on web if needed
  if (Platform.OS === "web" && typeof mediaUrl === "string" && mediaUrl.startsWith("blob:")) {
    const live = await getLiveMediaUrl(raw.sourceMediaId || clipId, raw.title || clip.title);
    if (live) {
      mediaUrl = live;
      if (raw) raw.url = live;
      if (clip) clip.url = live;
    }
  }

  const trimKey = `${clipId}_t${trimIn.toFixed(2)}`;
  const urlTimeKey = `${mediaUrl}_t${trimIn.toFixed(2)}`;

  // Check cache unless forced refresh
  if (!forceRefresh) {
    if (globalThumbnailCache.has(trimKey)) {
      return globalThumbnailCache.get(trimKey)!;
    }
    if (globalThumbnailCache.has(urlTimeKey)) {
      const cached = globalThumbnailCache.get(urlTimeKey)!;
      globalThumbnailCache.set(clipId, cached);
      return cached;
    }
  }

  // 1. Try immediate synchronous capture from active player video element or DOM
  if (Platform.OS === "web") {
    const instantThumb = captureActiveFrameNow(mediaUrl, trimIn);
    if (instantThumb) {
      globalThumbnailCache.set(clipId, instantThumb);
      globalThumbnailCache.set(trimKey, instantThumb);
      globalThumbnailCache.set(urlTimeKey, instantThumb);
      if (!isSplitted) {
        globalThumbnailCache.set(mediaUrl, instantThumb);
      }
      if (raw) {
        raw.thumbnail = instantThumb;
        raw.thumbnailTrimIn = trimIn;
      }
      notifyThumbnailListeners(clipId, instantThumb);
      return instantThumb;
    }
  }

  // If already in flight for this exact clip and time, don't spawn duplicate extraction tasks
  const flightKey = `${clipId}_${trimIn.toFixed(2)}`;
  if (inFlightRequests.has(flightKey)) {
    return null;
  }
  inFlightRequests.add(flightKey);

  try {
    // If it's an image
    if (isImageClip(clip)) {
      globalThumbnailCache.set(clipId, mediaUrl);
      globalThumbnailCache.set(trimKey, mediaUrl);
      if (raw && !raw.thumbnail) raw.thumbnail = mediaUrl;
      inFlightRequests.delete(flightKey);
      notifyThumbnailListeners(clipId, mediaUrl);
      return mediaUrl;
    }

    // WEB: Extract thumbnail via offscreen video + canvas at clip's exact trimIn point
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const seekTarget = trimIn;
      const thumb = await extractWebVideoThumbnail(mediaUrl, seekTarget);
      if (thumb) {
        globalThumbnailCache.set(clipId, thumb);
        globalThumbnailCache.set(trimKey, thumb);
        globalThumbnailCache.set(urlTimeKey, thumb);
        if (!isSplitted) {
          globalThumbnailCache.set(mediaUrl, thumb);
        }
        if (raw) {
          raw.thumbnail = thumb;
          raw.thumbnailTrimIn = seekTarget;
        }
        notifyThumbnailListeners(clipId, thumb);
        return thumb;
      }
    }

    // NATIVE (iOS / Android): Extract thumbnail via expo-video-thumbnails
    if (Platform.OS !== "web") {
      try {
        const { getThumbnailAsync } = await import("expo-video-thumbnails");
        const seekMs = Math.max(100, Math.round((trimIn + 0.1) * 1000));
        const result = await getThumbnailAsync(mediaUrl, {
          time: seekMs,
          quality: 0.85,
        });
        if (result && result.uri) {
          globalThumbnailCache.set(clipId, result.uri);
          globalThumbnailCache.set(trimKey, result.uri);
          globalThumbnailCache.set(urlTimeKey, result.uri);
          if (!isSplitted) {
            globalThumbnailCache.set(mediaUrl, result.uri);
          }
          if (raw) {
            raw.thumbnail = result.uri;
            raw.thumbnailTrimIn = trimIn;
          }
          notifyThumbnailListeners(clipId, result.uri);
          return result.uri;
        }
      } catch (err) {}
    }
  } catch (err) {
  } finally {
    inFlightRequests.delete(flightKey);
  }

  return null;
}

function extractWebVideoThumbnail(url: string, seekSec: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined" || !url) {
      return resolve(null);
    }

    try {
      // 1. Fast path: check active video elements
      const activeEl = globalActiveVideoElements.get(url);
      if (
        activeEl instanceof HTMLVideoElement &&
        activeEl.videoWidth > 0 &&
        activeEl.readyState >= 2 &&
        Math.abs(activeEl.currentTime - (seekSec || 0)) <= 0.3
      ) {
        try {
          const canvas = document.createElement("canvas");
          const aspect = (activeEl.videoWidth || 16) / (activeEl.videoHeight || 9);
          const tw = 240;
          const th = Math.round(tw / aspect);
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(activeEl, 0, 0, tw, th);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            if (dataUrl && dataUrl.length > 200) {
              return resolve(dataUrl);
            }
          }
        } catch (e) {}
      }

      // 2. Offscreen video element attached to DOM
      const vid = document.createElement("video");
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "auto";
      vid.style.position = "fixed";
      vid.style.top = "-9999px";
      vid.style.left = "-9999px";
      vid.style.width = "320px";
      vid.style.height = "180px";
      vid.style.opacity = "0.01";
      vid.style.pointerEvents = "none";

      if (!url.startsWith("blob:") && !url.startsWith("data:")) {
        vid.crossOrigin = "anonymous";
      }

      let done = false;
      let seekAttempt = 0;

      const finish = (result: string | null) => {
        if (done) return;
        done = true;
        try {
          vid.pause();
          vid.removeAttribute("src");
          vid.load();
          if (vid.parentNode) {
            vid.parentNode.removeChild(vid);
          }
        } catch (e) {}
        resolve(result);
      };

      const timer = setTimeout(() => {
        finish(null);
      }, 6000);

      const captureFrame = () => {
        try {
          const vw = vid.videoWidth || 320;
          const vh = vid.videoHeight || 180;
          if (vw <= 0 || vh <= 0) return;
          const aspect = vw / (vh || 1);
          const targetW = 240;
          const targetH = Math.round(targetW / aspect);

          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(vid, 0, 0, targetW, targetH);

            const dur = vid.duration && isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 5;
            // ONLY retry black frames if seekSec <= 0.05 (initial file start)!
            // For splitted clips (seekSec > 0.05), the frame at seekSec IS the user's split point!
            if (seekSec <= 0.05 && isCanvasBlackOrEmpty(canvas) && seekAttempt < 2 && dur > 0.5) {
              seekAttempt++;
              vid.currentTime = Math.min(dur - 0.05, 0.15 * (seekAttempt + 1));
              return;
            }

            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            clearTimeout(timer);
            finish(dataUrl);
            return;
          }
        } catch (e) {}
      };

      const doSeek = () => {
        const dur = vid.duration && isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 5;
        const safeSeek = seekSec > 0.05
          ? Math.min(seekSec, Math.max(0, dur - 0.03))
          : Math.min(0.15, Math.max(0.05, dur - 0.05));

        if (Math.abs(vid.currentTime - safeSeek) < 0.02 && vid.readyState >= 2) {
          captureFrame();
        } else {
          vid.currentTime = safeSeek;
        }
      };

      vid.onloadedmetadata = () => {
        doSeek();
      };

      vid.onloadeddata = () => {
        doSeek();
      };

      vid.oncanplay = () => {
        if (vid.currentTime <= 0.05) {
          doSeek();
        }
      };

      vid.onseeked = () => {
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(() => captureFrame());
        } else {
          setTimeout(captureFrame, 30);
        }
      };

      vid.onerror = () => {
        if (vid.crossOrigin) {
          vid.removeAttribute("crossorigin");
          vid.src = url;
          vid.load();
          return;
        }
        clearTimeout(timer);
        finish(null);
      };

      document.body.appendChild(vid);
      vid.src = url;
      vid.load();
    } catch (e) {
      resolve(null);
    }
  });
}
