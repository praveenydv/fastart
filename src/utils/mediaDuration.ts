/**
 * Media Duration Resolution & Trimming Boundary Safety Utility
 * Ensures video and audio clips can never be expanded beyond their actual media file lengths.
 */

// Shared memory cache for media durations (keyed by clip.url and clip.id)
export const globalMediaDurationCache = new Map<string, number>();

// Set a duration directly in cache (e.g. from VideoRenderer or Audio element)
export function setCachedMediaDuration(key: string, duration: number): void {
  if (!key || isNaN(duration) || !isFinite(duration) || duration <= 0) return;
  globalMediaDurationCache.set(key, duration);
}

// Probe video/audio metadata asynchronously in Web environment and cache it
export function probeAndCacheMediaDuration(url: string, id?: string, isAudio = false): void {
  if (typeof window === "undefined" || !url) return;
  if (globalMediaDurationCache.has(url)) return;

  try {
    if (isAudio) {
      const audio = new Audio();
      audio.preload = "metadata";
      const onMeta = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
          globalMediaDurationCache.set(url, audio.duration);
          if (id) globalMediaDurationCache.set(id, audio.duration);
        }
      };
      audio.onloadedmetadata = onMeta;
      audio.src = url;
      if (audio.readyState >= 1 && audio.duration) {
        onMeta();
      }
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const onMeta = () => {
        if (video.duration && !isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
          globalMediaDurationCache.set(url, video.duration);
          if (id) globalMediaDurationCache.set(id, video.duration);
        }
      };
      video.onloadedmetadata = onMeta;
      video.src = url;
      if (video.readyState >= 1 && video.duration) {
        onMeta();
      }
    }
  } catch (e) {
    // Probing errors are non-fatal
  }
}

/**
 * Checks whether a clip is an image/photo (which has no fixed media duration ceiling).
 */
export function isImageClip(clip: any, clipType?: string): boolean {
  if (!clip) return false;
  const raw = clip.rawClip || clip;

  // 1. Direct type attributes
  const rawType = (raw.type || clip.type || "").toLowerCase();
  const cType = (clipType || "").toLowerCase();
  if (rawType === "photo" || rawType === "image" || cType === "photo" || cType === "image") {
    return true;
  }
  if (raw.isImage || clip.isImage || clip.mediaType === "image" || raw.mediaType === "image") {
    return true;
  }
  if (clip.iconName === "image" || raw.iconName === "image") {
    return true;
  }

  // 2. Data URLs and image file extensions
  const url = (raw.url || clip.url || raw.thumbnail || clip.thumbnail || "").toLowerCase();
  if (url) {
    if (url.startsWith("data:image/")) return true;
    if (
      url.includes("format=jpg") ||
      url.includes("format=png") ||
      url.includes("format=webp") ||
      url.includes("format=jpeg")
    ) {
      return true;
    }
    if (/\.(jpe?g|png|gif|webp|svg|bmp|avif|ico)(\?.*)?$/i.test(url)) {
      return true;
    }
  }

  // 3. Title indicators (e.g., "Imported Photo", "photo-123.jpg")
  const title = (raw.title || clip.title || "").toLowerCase();
  if (
    title.includes("photo") ||
    title.endsWith(".jpg") ||
    title.endsWith(".jpeg") ||
    title.endsWith(".png") ||
    title.endsWith(".webp") ||
    title.endsWith(".svg")
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether a clip is an extendable element without a fixed media file length limit
 * (e.g. photos, images, text, captions, stickers, effects, and filters).
 */
export function isExtendableClip(clip: any, clipType?: string): boolean {
  if (!clip) return false;
  if (isImageClip(clip, clipType)) return true;

  const raw = clip.rawClip || clip;
  const rawType = (raw.type || clip.type || clipType || "").toLowerCase();
  const cType = (clipType || clip.type || "").toLowerCase();
  const id = String(clip.id || raw.id || "").toLowerCase();

  // Effects & Filters
  if (
    rawType === "effect" ||
    rawType === "effects" ||
    cType === "effect" ||
    cType === "effects" ||
    id.startsWith("eff-") ||
    id.startsWith("effect-") ||
    clip.intensity !== undefined ||
    raw.intensity !== undefined
  ) {
    return true;
  }

  // Text
  if (
    rawType === "text" ||
    rawType === "texts" ||
    cType === "text" ||
    cType === "texts" ||
    id.startsWith("text-") ||
    clip.text !== undefined ||
    raw.text !== undefined
  ) {
    return true;
  }

  // Captions
  if (
    rawType === "caption" ||
    rawType === "captions" ||
    cType === "caption" ||
    cType === "captions" ||
    id.startsWith("cap-")
  ) {
    return true;
  }

  // Stickers
  if (
    rawType === "sticker" ||
    rawType === "stickers" ||
    cType === "sticker" ||
    cType === "stickers" ||
    id.startsWith("stk-") ||
    id.startsWith("sticker-") ||
    raw.char !== undefined
  ) {
    return true;
  }

  // Filters
  if (
    rawType === "filter" ||
    rawType === "filters" ||
    cType === "filter" ||
    cType === "filters"
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves the true media file duration in seconds for a clip.
 * Returns null if the clip is not a finite media file (e.g. photo, image, text, sticker, filter, effect).
 */
export function getMediaDuration(clip: any, clipType?: string): number | null {
  if (!clip) return null;

  // Photos, images, text, captions, stickers, and effects have NO native file length limit!
  if (isExtendableClip(clip, clipType)) {
    return null;
  }

  const raw = clip.rawClip || clip;
  const type = (raw.type || clip.type || clipType || "").toLowerCase();
  if (
    type === "photo" ||
    type === "image" ||
    type === "text" ||
    type === "sticker" ||
    type === "effect" ||
    type === "effects" ||
    type === "filter" ||
    type === "filters" ||
    type === "caption"
  ) {
    return null;
  }

  // 1. Explicit properties stored on clip
  if (typeof clip.mediaDuration === "number" && clip.mediaDuration > 0) {
    return clip.mediaDuration;
  }
  if (clip.rawClip && typeof clip.rawClip.mediaDuration === "number" && clip.rawClip.mediaDuration > 0) {
    return clip.rawClip.mediaDuration;
  }
  if (typeof clip.sourceDuration === "number" && clip.sourceDuration > 0) {
    return clip.sourceDuration;
  }
  if (typeof clip.originalDuration === "number" && clip.originalDuration > 0) {
    return clip.originalDuration;
  }

  // 2. Check memory cache by url or id
  if (clip.url && globalMediaDurationCache.has(clip.url)) {
    return globalMediaDurationCache.get(clip.url)!;
  }
  if (clip.id && globalMediaDurationCache.has(clip.id)) {
    return globalMediaDurationCache.get(clip.id)!;
  }
  if (clip.rawClip?.url && globalMediaDurationCache.has(clip.rawClip.url)) {
    return globalMediaDurationCache.get(clip.rawClip.url)!;
  }
  if (clip.rawClip?.id && globalMediaDurationCache.has(clip.rawClip.id)) {
    return globalMediaDurationCache.get(clip.rawClip.id)!;
  }

  // 3. Web DOM check: inspect active video or audio tags
  if (typeof document !== "undefined") {
    const targetUrl = clip.url || clip.rawClip?.url;
    if (targetUrl) {
      if (type === "audio") {
        const audios = document.querySelectorAll("audio");
        for (let i = 0; i < audios.length; i++) {
          const a = audios[i];
          if (a.duration && !isNaN(a.duration) && isFinite(a.duration) && a.duration > 0) {
            if (a.src === targetUrl || a.currentSrc === targetUrl || targetUrl.includes(a.src)) {
              setCachedMediaDuration(targetUrl, a.duration);
              if (clip.id) setCachedMediaDuration(clip.id, a.duration);
              return a.duration;
            }
          }
        }
        // Trigger background probe if not cached
        probeAndCacheMediaDuration(targetUrl, clip.id, true);
      } else {
        const videos = document.querySelectorAll("video");
        for (let i = 0; i < videos.length; i++) {
          const v = videos[i];
          if (v.duration && !isNaN(v.duration) && isFinite(v.duration) && v.duration > 0) {
            if (v.src === targetUrl || v.currentSrc === targetUrl || targetUrl.includes(v.src)) {
              setCachedMediaDuration(targetUrl, v.duration);
              if (clip.id) setCachedMediaDuration(clip.id, v.duration);
              return v.duration;
            }
          }
        }
        // Trigger background probe if not cached
        probeAndCacheMediaDuration(targetUrl, clip.id, false);
      }
    }
  }

  // 4. Fallback from initial clip metadata (trimOut / duration)
  const trimOut = clip.trimOut || clip.rawClip?.trimOut;
  const dur = clip.duration || clip.rawClip?.duration;
  const fallback = Math.max(
    typeof trimOut === "number" && trimOut > 0 ? trimOut : 0,
    typeof dur === "number" && dur > 0 ? dur : 0
  );

  if (fallback > 0) {
    return fallback;
  }

  return null;
}

/**
 * Calculates the maximum allowed timeline duration for a clip.
 * Takes speed and current trimIn into account: (mediaDuration - trimIn) / speed.
 */
export function getMaxTimelineDuration(clip: any, clipType?: string): number {
  const mediaDur = getMediaDuration(clip, clipType);
  if (!mediaDur || mediaDur <= 0) return Infinity;

  const rawClip = clip.rawClip || clip;
  const trimIn = Math.max(0, rawClip.trimIn || clip.trimIn || 0);
  const speed = Math.max(0.1, Math.min(16, rawClip.speed || clip.speed || 1.0));

  const availableMedia = Math.max(0.1, mediaDur - trimIn);
  return Number((availableMedia / speed).toFixed(3));
}

/**
 * Clamps clip trimming updates strictly within the media file boundaries:
 * - trimIn cannot be < 0
 * - trimOut cannot exceed mediaDuration
 * - duration cannot exceed (mediaDuration - trimIn) / speed
 */
export function clampClipTrimUpdates(
  clip: any,
  updates: { startTime?: number; duration?: number; trimIn?: number; trimOut?: number; trackIndex?: number },
  clipType?: string,
  minDuration = 0.2
): { startTime?: number; duration?: number; trimIn?: number; trimOut?: number; trackIndex?: number } {
  const clamped = { ...updates };

  if (typeof clamped.startTime === "number") {
    clamped.startTime = Math.max(0, clamped.startTime);
  }

  // Photos, images, text, stickers, captions, effects have NO native media limit - allow extending freely!
  if (isExtendableClip(clip, clipType)) {
    if (typeof clamped.duration === "number") {
      clamped.duration = Math.max(minDuration, clamped.duration);
    }
    if (typeof clamped.trimOut === "number") {
      clamped.trimOut = Math.max(minDuration, clamped.trimOut);
    }
    return clamped;
  }

  const mediaDur = getMediaDuration(clip, clipType);

  // If photo or text, only clamp min duration
  if (!mediaDur || mediaDur <= 0) {
    if (typeof clamped.duration === "number") {
      clamped.duration = Math.max(minDuration, clamped.duration);
    }
    return clamped;
  }

  const rawClip = clip.rawClip || clip;
  const speed = Math.max(0.1, Math.min(16, rawClip.speed || clip.speed || 1.0));
  const currentTrimIn = typeof clamped.trimIn === "number" ? clamped.trimIn : Math.max(0, rawClip.trimIn || clip.trimIn || 0);

  // 1. Clamp trimIn to never go before start of media (>= 0)
  if (typeof clamped.trimIn === "number") {
    clamped.trimIn = Math.max(0, Math.min(mediaDur - minDuration * speed, clamped.trimIn));
  }

  // 2. Maximum timeline duration possible from currentTrimIn
  const maxAllowedTimelineDur = Math.max(minDuration, (mediaDur - currentTrimIn) / speed);

  // 3. Clamp duration
  if (typeof clamped.duration === "number") {
    clamped.duration = Math.max(minDuration, Math.min(maxAllowedTimelineDur, clamped.duration));
  }

  // 4. Clamp trimOut
  if (typeof clamped.trimOut === "number") {
    clamped.trimOut = Math.max(currentTrimIn + minDuration * speed, Math.min(mediaDur, clamped.trimOut));
  } else if (typeof clamped.duration === "number") {
    clamped.trimOut = Math.min(mediaDur, currentTrimIn + clamped.duration * speed);
  }

  return clamped;
}
