// FastArt Media Audio Track Detection, Waveform Peak Cache & Audio State Helpers

import { Platform } from "react-native";
import { getMediaBinaryBuffer } from "./largeMediaStorage";
import { getStorageItem, setStorageItem } from "./storage";
import { rustCoreBridge } from "../services/rustCoreBridge";
import { LruCache } from "./lruCache";

const STORAGE_PEAKS_PREFIX = "@fastart_peaks_";
const mediaAudioPresenceCache = new LruCache<string, boolean>(150);
const mediaPeaksCache = new LruCache<string, number[]>(100);
const mediaAudioDurationCache = new LruCache<string, number>(150);
const inFlightDecodes = new Map<string, Promise<number[] | null>>();
const listeners = new Set<(changedKey?: string) => void>();

export function subscribeMediaAudioChange(fn: (changedKey?: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let notifyScheduled = false;
const pendingAudioChangeKeys = new Set<string>();

function notifyAudioChange(key?: string) {
  if (key) pendingAudioChangeKeys.add(key);
  if (notifyScheduled) return;
  notifyScheduled = true;
  const dispatch = () => {
    notifyScheduled = false;
    const keys = Array.from(pendingAudioChangeKeys);
    pendingAudioChangeKeys.clear();
    listeners.forEach((fn) => {
      try {
        if (keys.length === 0) {
          fn();
        } else {
          for (const k of keys) {
            fn(k);
          }
        }
      } catch {}
    });
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(dispatch);
  } else {
    setTimeout(dispatch, 0);
  }
}

/**
 * Manually set or update known audio presence for a media URL or clip ID
 */
export function setMediaHasAudio(key: string, hasAudio: boolean): void {
  if (!key) return;
  if (mediaAudioPresenceCache.get(key) === hasAudio) return;
  mediaAudioPresenceCache.set(key, hasAudio);
  notifyAudioChange(key);
}

/**
 * Check if audio presence has already been determined for this key (URL or ID)
 */
export function isMediaAudioDetected(key?: string): boolean | null {
  if (!key) return null;
  if (mediaAudioPresenceCache.has(key)) {
    return mediaAudioPresenceCache.get(key)!;
  }
  return null;
}

/**
 * Cache decoded peak samples (0.0 to 1.0) for a media URL or ID and persist in storage
 */
export function setCachedMediaPeaks(
  urlOrKey: string,
  peaks: number[],
  duration?: number,
): void {
  if (!urlOrKey || !peaks) return;
  mediaPeaksCache.set(urlOrKey, peaks);
  if (duration !== undefined && duration > 0) {
    mediaAudioDurationCache.set(urlOrKey, duration);
  }
  setMediaHasAudio(urlOrKey, peaks.length > 0);

  // Persist compact peaks (2 decimal places) to local storage so page refresh retains waveforms instantly
  try {
    const storageKey = STORAGE_PEAKS_PREFIX + urlOrKey;
    const compact = peaks.map((p) => Math.round(p * 100) / 100);
    setStorageItem(storageKey, JSON.stringify(compact));
  } catch (_) {}

  notifyAudioChange(urlOrKey);
}

/**
 * Returns cached peak samples (0.0 to 1.0) for a media URL or clip ID if available
 */
export function getCachedMediaPeaks(key?: string): number[] | null {
  if (!key) return null;
  return mediaPeaksCache.get(key) ?? null;
}

/**
 * Returns the cached total audio duration in seconds for a media URL
 */
export function getMediaAudioDuration(url?: string): number | null {
  if (!url) return null;
  return mediaAudioDurationCache.get(url) ?? null;
}

/**
 * Checks whether a timeline clip has audio.
 */
export function clipHasAudio(clip: any): boolean {
  if (!clip) return false;
  const raw = clip.rawClip || clip;

  // 1. If volume is 0 or muted
  if (raw.volume === 0 || raw.muted === true) return false;

  // 2. Delegate to mediaHasAudioTrack for source audio stream verification
  return mediaHasAudioTrack(clip);
}

/**
 * Checks whether the source media file contains an actual audio stream
 * (even if current clip volume is 0 or temporarily muted).
 * Returns false for photos, endings, or media files verified to have 0 audio tracks.
 */
export function mediaHasAudioTrack(clip: any): boolean {
  if (!clip) return false;
  const raw = clip.rawClip || clip;
  const type = clip.type || raw.type;
  const clipId = raw.id || clip.id;
  const clipUrl = raw.url || clip.url;

  // 1. Photos, images, endings definitely have NO audio track
  if (type === "photo" || raw.type === "photo") return false;
  if (raw.isEnding) return false;

  // 2. Explicit flag set on clip or media
  if (raw.hasAudio === false || clip.hasAudio === false) return false;
  if (raw.hasAudio === true || clip.hasAudio === true) return true;

  // 3. Audio track lane clips (type === "audio")
  if (type === "audio") {
    return Boolean(clipUrl);
  }

  // 4. Check file extension: photo and image formats never have audio
  if (clipUrl) {
    const cleanUrl = clipUrl.split("?")[0].toLowerCase();
    if (/\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/i.test(cleanUrl)) {
      setMediaHasAudio(clipUrl, false);
      if (clipId) setMediaHasAudio(clipId, false);
      return false;
    }
  }

  // 5. Check cached audio presence by clip ID or URL
  if (clipId) {
    const byId = isMediaAudioDetected(clipId);
    if (byId !== null) return byId;
  }
  if (clipUrl) {
    const byUrl = isMediaAudioDetected(clipUrl);
    if (byUrl !== null) return byUrl;
  }

  // 6. For video clips (type === "video"):
  // Trigger background binary audio extraction immediately if not already decoded
  if (clipUrl) {
    extractRealMediaAudioPeaks(clipUrl, clipId);
  }

  // Standard video files (MP4, WebM, MOV, camera clips) contain audio tracks by default
  return Boolean(clipUrl);
}

/**
 * Spectral Denoise Transfer Function for Waveform Peaks:
 * Simulates AI noise gate & vocal speech isolation via native Rust/WASM:
 * - Ambient noise floor (< 0.22) is attenuated to a quiet baseline (0.02 - 0.04)
 * - Dialogue, speech harmonics, and prominent audio transients are cleanly boosted
 */
export async function applyDenoiseToPeaks(rawPeaks: number[]): Promise<number[]> {
  return rustCoreBridge.denoiseWaveformPeaks(rawPeaks);
}

/**
 * Decodes media and reduces it to waveform peaks in the shared Rust core.
 */
export async function extractRealMediaAudioPeaks(
  url: string,
  clipId?: string,
): Promise<number[] | null> {
  if (!url) return null;

  // 1. Check in-memory cache
  if (mediaPeaksCache.has(url)) {
    const cached = mediaPeaksCache.get(url)!;
    const hasSound = cached.length > 0;
    if (clipId) setMediaHasAudio(clipId, hasSound);
    return cached;
  }

  // 2. If already in flight, reuse existing promise
  if (inFlightDecodes.has(url)) {
    return inFlightDecodes.get(url)!;
  }

  // 3. Check persistent storage (survives page refresh & app reload)
  try {
    const rawStored =
      getStorageItem(STORAGE_PEAKS_PREFIX + url) ||
      (clipId ? getStorageItem(STORAGE_PEAKS_PREFIX + clipId) : null);
    if (rawStored) {
      const parsed = JSON.parse(rawStored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        mediaPeaksCache.set(url, parsed);
        if (clipId) mediaPeaksCache.set(clipId, parsed);
        setMediaHasAudio(url, true);
        if (clipId) setMediaHasAudio(clipId, true);
        notifyAudioChange(url);
        return parsed;
      }
    }
  } catch (_) {}

  // Skip photo and static image extensions
  const cleanUrl = url.split("?")[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/i.test(cleanUrl)) {
    setMediaHasAudio(url, false);
    if (clipId) setMediaHasAudio(clipId, false);
    mediaPeaksCache.set(url, []);
    return [];
  }

  const decodePromise = (async () => {
    try {
      // 1. Fetch binary data using multi-strategy loader (handles blob URLs, mobile FileSystem, XHR, and IndexedDB)
      const arrayBuf = await getMediaBinaryBuffer(url, clipId);
      if (!arrayBuf || arrayBuf.byteLength === 0) {
        setMediaHasAudio(url, true);
        if (clipId) setMediaHasAudio(clipId, true);
        mediaPeaksCache.set(url, []);
        notifyAudioChange(url);
        return [];
      }

      const audioParsed = await rustCoreBridge.decodeAudioPeaks(arrayBuf, 24000);
      if (audioParsed?.peaks.length) {
        setCachedMediaPeaks(url, audioParsed.peaks, audioParsed.duration);
        if (clipId) setCachedMediaPeaks(clipId, audioParsed.peaks, audioParsed.duration);
        return audioParsed.peaks;
      }

      // Compressed formats without a platform decoder keep native playback but have no fabricated peaks.
      setMediaHasAudio(url, true);
      if (clipId) setMediaHasAudio(clipId, true);
      mediaPeaksCache.set(url, []);
      notifyAudioChange(url);
      return [];
    } catch (err) {
      console.warn("[mediaAudioDetector] Could not decode audio from:", url, err);
      const isPhoto = /\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/i.test(cleanUrl);
      if (isPhoto) {
        setMediaHasAudio(url, false);
        if (clipId) setMediaHasAudio(clipId, false);
      } else {
        setMediaHasAudio(url, true);
        if (clipId) setMediaHasAudio(clipId, true);
      }
      mediaPeaksCache.set(url, []);
      notifyAudioChange(url);
      return [];
    } finally {
      inFlightDecodes.delete(url);
      notifyAudioChange(url);
    }
  })();

  inFlightDecodes.set(url, decodePromise);
  notifyAudioChange(url);
  return decodePromise;
}

/**
 * Checks if a media URL is currently actively having its audio decoded
 */
export function isMediaAudioDecoding(url?: string): boolean {
  if (!url) return false;
  return inFlightDecodes.has(url);
}

/**
 * Asynchronously probes if a media URL contains an audio track and extracts real peaks
 */
export function probeVideoHasAudio(url: string, clipId?: string): void {
  if (!url) return;
  extractRealMediaAudioPeaks(url, clipId);
}

/**
 * Generates an array of normalized bar heights (0.04 to 1.0)
 * for a clip based on its actual decoded audio peaks, respecting duration, trimIn, and speed.
 * Never outputs synthetic dummy waveforms.
 */
export async function getClipWaveformPeaks(
  clipId: string,
  url: string | undefined,
  width: number,
  duration: number,
  trimIn: number = 0,
  speed: number = 1.0,
  barWidth: number = 2.0,
  barGap: number = 1.0,
  denoise: boolean = false,
  clipPeaks?: number[],
  clipMediaDuration?: number,
): Promise<number[]> {
  const targetStep = barWidth + barGap;
  const maxBars = Platform.OS !== "web" ? 800 : 8000;
  const numBars = Math.max(
    8,
    Math.min(maxBars, Math.floor(width / targetStep)),
  );

  // 1. Use explicit clip peaks if attached to the clip object
  let allPeaks: number[] | null = null;
  if (clipPeaks && clipPeaks.length > 0) {
    allPeaks = clipPeaks;
  } else if (url && mediaPeaksCache.has(url)) {
    allPeaks = mediaPeaksCache.get(url)!;
  } else if (clipId && mediaPeaksCache.has(clipId)) {
    allPeaks = mediaPeaksCache.get(clipId)!;
  } else {
    // 2. Check persistent storage so after page refresh peaks load in 0ms
    try {
      const stored =
        (url ? getStorageItem(STORAGE_PEAKS_PREFIX + url) : null) ||
        (clipId ? getStorageItem(STORAGE_PEAKS_PREFIX + clipId) : null);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allPeaks = parsed;
          if (url) mediaPeaksCache.set(url, parsed);
          if (clipId) mediaPeaksCache.set(clipId, parsed);
        }
      }
    } catch (_) {}
  }

  // If real audio peak data is available
  if (allPeaks && allPeaks.length > 0) {
    const totalMediaDur =
      clipMediaDuration ||
      (url ? mediaAudioDurationCache.get(url) : null) ||
      Math.max(0.1, trimIn + duration * speed);
    const effectiveDuration = Math.max(0.05, duration * speed);
    const result: number[] = new Array(numBars);
    const allPeaksLen = allPeaks.length;

    for (let i = 0; i < numBars; i++) {
      const clipFracStart = i / numBars;
      const clipFracEnd = (i + 1) / numBars;
      const srcTimeStart = trimIn + clipFracStart * effectiveDuration;
      const srcTimeEnd = trimIn + clipFracEnd * effectiveDuration;
      const srcFracStart = Math.max(0, Math.min(1.0, srcTimeStart / totalMediaDur));
      const srcFracEnd = Math.max(0, Math.min(1.0, srcTimeEnd / totalMediaDur));

      const idxStart = Math.floor(srcFracStart * (allPeaksLen - 1));
      const idxEnd = Math.max(idxStart, Math.floor(srcFracEnd * (allPeaksLen - 1)));

      let maxP = 0;
      for (let j = idxStart; j <= idxEnd; j++) {
        const v = allPeaks[j];
        if (v > maxP) maxP = v;
      }
      result[i] = Math.max(0.04, Math.min(1.0, maxP));
    }

    // Apply spectral noise gate transfer function when Denoise is active
    if (denoise) {
      return await applyDenoiseToPeaks(result);
    }

    return result;
  }

  // If known to have no audio, return empty array
  if (url && isMediaAudioDetected(url) === false) {
    return [];
  }
  if (clipId && isMediaAudioDetected(clipId) === false) {
    return [];
  }

  // Kick off real extraction in background if URL exists
  if (url) {
    extractRealMediaAudioPeaks(url, clipId);
  }

  return [];
}
