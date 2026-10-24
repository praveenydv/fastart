import { Platform } from "react-native";
import { isImageClip } from "./mediaDuration";
import { getLiveMediaUrl } from "./largeMediaStorage";

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
 */
export function getMediaThumbnail(clip: any): string | null {
  if (!clip) return null;
  const raw = clip.rawClip || clip;

  // 1. If explicit thumbnail property is present on rawClip
  if (raw.thumbnail && typeof raw.thumbnail === "string" && raw.thumbnail.length > 0) {
    // If on web and it's a blob: URL, verify it's still alive, otherwise trigger extraction
    if (Platform.OS === "web" && raw.thumbnail.startsWith("blob:")) {
      globalThumbnailCache.set(clip.id, raw.thumbnail);
      requestMediaThumbnail(clip);
      return raw.thumbnail;
    }
    globalThumbnailCache.set(clip.id, raw.thumbnail);
    if (raw.url) globalThumbnailCache.set(raw.url, raw.thumbnail);
    return raw.thumbnail;
  }

  // 2. If it's an image/photo clip, the image URL IS the preview thumbnail
  if (isImageClip(clip)) {
    const imgUrl = raw.url || clip.url || raw.thumbnail || clip.thumbnail;
    if (imgUrl) {
      globalThumbnailCache.set(clip.id, imgUrl);
      return imgUrl;
    }
  }

  // 3. Check memory cache by clipId
  if (globalThumbnailCache.has(clip.id)) {
    return globalThumbnailCache.get(clip.id)!;
  }

  // 4. Check memory cache by url
  const mediaUrl = raw.url || clip.url;
  if (mediaUrl && globalThumbnailCache.has(mediaUrl)) {
    const cached = globalThumbnailCache.get(mediaUrl)!;
    globalThumbnailCache.set(clip.id, cached);
    return cached;
  }

  // 5. Trigger async extraction if media URL is present
  if (mediaUrl) {
    requestMediaThumbnail(clip);
  }

  return null;
}

/**
 * Asynchronously generates/extracts a video thumbnail and caches it
 */
export async function requestMediaThumbnail(clip: any): Promise<string | null> {
  if (!clip) return null;
  const raw = clip.rawClip || clip;
  const clipId = clip.id || raw.id;
  let mediaUrl = raw.url || clip.url;

  if (!clipId || !mediaUrl) return null;

  // Rehydrate dead blob URL on web if needed
  if (Platform.OS === "web" && typeof mediaUrl === "string" && mediaUrl.startsWith("blob:")) {
    const live = await getLiveMediaUrl(raw.sourceMediaId || clipId);
    if (live) {
      mediaUrl = live;
      if (raw) raw.url = live;
      if (clip) clip.url = live;
    }
  }

  // Check cache
  if (globalThumbnailCache.has(clipId)) {
    return globalThumbnailCache.get(clipId)!;
  }
  if (globalThumbnailCache.has(mediaUrl)) {
    const cached = globalThumbnailCache.get(mediaUrl)!;
    globalThumbnailCache.set(clipId, cached);
    return cached;
  }

  // If already in flight, don't spawn duplicate extraction tasks
  const flightKey = `${clipId}_${mediaUrl}`;
  if (inFlightRequests.has(flightKey)) {
    return null;
  }
  inFlightRequests.add(flightKey);

  try {
    // If it's an image
    if (isImageClip(clip)) {
      globalThumbnailCache.set(clipId, mediaUrl);
      globalThumbnailCache.set(mediaUrl, mediaUrl);
      if (raw && !raw.thumbnail) raw.thumbnail = mediaUrl;
      inFlightRequests.delete(flightKey);
      notifyThumbnailListeners(clipId, mediaUrl);
      return mediaUrl;
    }

    // WEB: Extract thumbnail via offscreen video + canvas
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const seekTarget = raw.trimIn || 0.1;
      const thumb = await extractWebVideoThumbnail(mediaUrl, seekTarget);
      if (thumb) {
        globalThumbnailCache.set(clipId, thumb);
        globalThumbnailCache.set(mediaUrl, thumb);
        if (raw) raw.thumbnail = thumb;
        notifyThumbnailListeners(clipId, thumb);
        return thumb;
      }
    }

    // NATIVE (iOS / Android): Extract thumbnail via expo-video-thumbnails
    if (Platform.OS !== "web") {
      try {
        const { getThumbnailAsync } = await import("expo-video-thumbnails");
        const result = await getThumbnailAsync(mediaUrl, {
          time: Math.max(100, Math.round(((raw.trimIn || 0) + 0.25) * 1000)),
          quality: 0.85,
        });
        if (result && result.uri) {
          globalThumbnailCache.set(clipId, result.uri);
          globalThumbnailCache.set(mediaUrl, result.uri);
          if (raw) raw.thumbnail = result.uri;
          notifyThumbnailListeners(clipId, result.uri);
          return result.uri;
        }
      } catch (err) {
        // Native thumbnail extraction fallback
      }
    }
  } catch (err) {
    // Non-fatal error during thumbnail generation
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
      // 1. Fast path: check if DOM already has an active video element matching this URL and close to seek time
      const existingVids = document.querySelectorAll("video");
      for (let i = 0; i < existingVids.length; i++) {
        const v = existingVids[i];
        if (
          (v.src === url || v.currentSrc === url) &&
          v.videoWidth > 0 &&
          v.readyState >= 2 && // MUST have current frame data
          Math.abs(v.currentTime - (seekSec || 0)) <= 1.5 // MUST be near the clip's time
        ) {
          try {
            const canvas = document.createElement("canvas");
            const aspect = (v.videoWidth || 16) / (v.videoHeight || 9);
            const tw = 240;
            const th = Math.round(tw / aspect);
            canvas.width = tw;
            canvas.height = th;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";
              ctx.drawImage(v, 0, 0, tw, th);
              if (!isCanvasBlackOrEmpty(canvas)) {
                const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                if (dataUrl && dataUrl.length > 500) {
                  return resolve(dataUrl);
                }
              }
            }
          } catch (e) {
            // Continue to offscreen loader
          }
        }
      }

      // 2. Offscreen video element loader attached to DOM (required for WebKit/Blink frame decoding)
      const vid = document.createElement("video");
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "auto";
      vid.style.position = "fixed";
      vid.style.top = "-9999px";
      vid.style.left = "-9999px";
      vid.style.width = "1px";
      vid.style.height = "1px";
      vid.style.opacity = "0";
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
      }, 5000);

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
            // If frame is pure black and we haven't retried yet, seek further to find visual frame
            if (isCanvasBlackOrEmpty(canvas) && seekAttempt < 2 && dur > 0.8) {
              seekAttempt++;
              const nextSeek = seekAttempt === 1
                ? Math.min(dur * 0.25, Math.max(0.5, (seekSec || 0) + 0.8))
                : Math.min(dur * 0.5, Math.max(1.0, (seekSec || 0) + 1.8));
              vid.currentTime = nextSeek;
              return;
            }

            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            clearTimeout(timer);
            finish(dataUrl);
            return;
          }
        } catch (e) {
          // Fallback
        }
      };

      const doSeek = () => {
        const dur = vid.duration && isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 5;
        // Never seek to 0.0 or 0.05 which is almost always a black frame on MP4s
        const safeSeek = Math.min(
          Math.max(0.25, (seekSec || 0) + 0.15),
          Math.max(0.2, dur - 0.2)
        );
        if (Math.abs(vid.currentTime - safeSeek) < 0.05 && vid.readyState >= 2) {
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
        // Wait one RAF tick so the video frame is completely decoded into buffer
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

      // Attach to body so browser actively decodes video frames
      document.body.appendChild(vid);
      vid.src = url;
      vid.load();
    } catch (e) {
      resolve(null);
    }
  });
}
