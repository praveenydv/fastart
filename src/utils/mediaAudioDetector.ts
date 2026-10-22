// FastArt Media Audio Track Detection, Waveform Peak Cache & Audio State Helpers

// Global caches for audio track detection and normalized audio peaks
const mediaAudioPresenceCache = new Map<string, boolean>();
const mediaPeaksCache = new Map<string, number[]>();
const mediaAudioDurationCache = new Map<string, number>();
const inFlightDecodes = new Map<string, Promise<number[] | null>>();
const listeners = new Set<() => void>();

export function subscribeMediaAudioChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notifyAudioChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

/**
 * Manually set or update known audio presence for a media URL or clip ID
 */
export function setMediaHasAudio(key: string, hasAudio: boolean): void {
  if (!key) return;
  if (mediaAudioPresenceCache.get(key) === hasAudio) return;
  mediaAudioPresenceCache.set(key, hasAudio);
  notifyAudioChange();
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
 * Cache decoded peak samples (0.0 to 1.0) for a media URL
 */
export function setCachedMediaPeaks(url: string, peaks: number[], duration?: number): void {
  if (!url || !peaks) return;
  mediaPeaksCache.set(url, peaks);
  if (duration !== undefined && duration > 0) {
    mediaAudioDurationCache.set(url, duration);
  }
  setMediaHasAudio(url, peaks.length > 0);
  notifyAudioChange();
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
 * - Audio clip: TRUE (unless volume is 0 or muted)
 * - Video clip:
 *   - Photo (type === 'photo'): FALSE (photos never have audio)
 *   - Ending card (isEnding === true): FALSE
 *   - Muted (volume === 0 or muted === true): FALSE
 *   - Explicitly flagged hasAudio === false: FALSE
 *   - Explicitly flagged hasAudio === true: TRUE
 *   - Runtime probe result in cache: returns cached boolean
 *   - Default for standard video clips: TRUE
 * - Text/Stickers/Effects: FALSE
 */
export function clipHasAudio(clip: any): boolean {
  if (!clip) return false;
  const type = clip.type;
  const raw = clip.rawClip || clip;

  // 1. Audio track
  if (type === "audio") {
    if (raw.volume === 0 || raw.muted === true) return false;
    return true;
  }

  // 2. Video track
  if (type === "video") {
    // Photos never have audio
    if (raw.type === "photo") return false;
    // Project ending bumper is silent
    if (raw.isEnding) return false;
    // Muted video clips have no active audio
    if (raw.volume === 0 || raw.muted === true) return false;
    // Explicit flags
    if (raw.hasAudio === false) return false;
    if (raw.hasAudio === true) return true;

    // Check runtime detection cache by clip ID or URL
    if (raw.id) {
      const byId = isMediaAudioDetected(raw.id);
      if (byId !== null) return byId;
    }
    if (raw.url) {
      const byUrl = isMediaAudioDetected(raw.url);
      if (byUrl !== null) return byUrl;
    }

    // Standard video files with positive volume contain audio by default
    return Boolean(raw.url);
  }

  return false;
}

let sharedAudioCtx: any = null;

function getSharedAudioContext(): any {
  if (typeof window === "undefined") return null;
  const AudioCtxClass =
    (window as any).AudioContext ||
    (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    try {
      sharedAudioCtx = new AudioCtxClass();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

/**
 * Extracts genuine audio waveform peaks (normalized 0.0 - 1.0) from media URL
 * using Web Audio API decodeAudioData. Computes true RMS and peak amplitude.
 */
export async function extractRealMediaAudioPeaks(
  url: string,
  clipId?: string,
): Promise<number[] | null> {
  if (!url) return null;

  // If already extracted and cached
  if (mediaPeaksCache.has(url)) {
    const cached = mediaPeaksCache.get(url)!;
    const hasSound = cached.length > 0;
    if (clipId) setMediaHasAudio(clipId, hasSound);
    return cached;
  }

  // Skip photo and static image extensions
  const cleanUrl = url.split("?")[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/i.test(cleanUrl)) {
    setMediaHasAudio(url, false);
    if (clipId) setMediaHasAudio(clipId, false);
    mediaPeaksCache.set(url, []);
    return [];
  }

  // If already in flight, reuse existing promise
  if (inFlightDecodes.has(url)) {
    return inFlightDecodes.get(url)!;
  }

  const decodePromise = (async () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) {
        return null;
      }

      // 1. Fetch binary data
      const resp = await fetch(url);
      if (!resp.ok) {
        return null;
      }
      const arrayBuf = await resp.arrayBuffer();
      if (!arrayBuf || arrayBuf.byteLength === 0) {
        return null;
      }

      // 2. Decode audio stream
      const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        try {
          const res = ctx.decodeAudioData(
            arrayBuf,
            (buf: AudioBuffer) => resolve(buf),
            (err: any) => reject(err),
          );
          if (res && typeof res.then === "function") {
            res.then(resolve).catch(reject);
          }
        } catch (err) {
          reject(err);
        }
      });

      if (!audioBuffer || audioBuffer.numberOfChannels === 0 || audioBuffer.length === 0) {
        setMediaHasAudio(url, false);
        if (clipId) setMediaHasAudio(clipId, false);
        mediaPeaksCache.set(url, []);
        notifyAudioChange();
        return [];
      }

      const duration = audioBuffer.duration;
      const length = audioBuffer.length;
      const numChannels = audioBuffer.numberOfChannels;
      const ch0 = audioBuffer.getChannelData(0);
      const ch1 = numChannels > 1 ? audioBuffer.getChannelData(1) : null;

      // Extract high resolution peaks (800 - 2400 points across the whole media file)
      const numPoints = Math.min(2400, Math.max(800, Math.floor(duration * 50)));
      const blockSize = Math.floor(length / numPoints);
      const rawPeaks = new Float32Array(numPoints);
      let maxVal = 0.0001;

      for (let i = 0; i < numPoints; i++) {
        const start = i * blockSize;
        const end = Math.min(start + blockSize, length);
        let peak = 0;
        let sumSquares = 0;
        const step = Math.max(1, Math.floor((end - start) / 50));
        let count = 0;

        for (let j = start; j < end; j += step) {
          let s = Math.abs(ch0[j]);
          if (ch1) {
            s = (s + Math.abs(ch1[j])) * 0.5;
          }
          if (s > peak) peak = s;
          sumSquares += s * s;
          count++;
        }

        const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
        // Visual blend: 72% peak + 28% RMS provides clean, punchy NLE waveform dynamics
        const combined = peak * 0.72 + rms * 0.28;
        rawPeaks[i] = combined;
        if (combined > maxVal) {
          maxVal = combined;
        }
      }

      const hasSound = maxVal > 0.003;
      setMediaHasAudio(url, hasSound);
      if (clipId) setMediaHasAudio(clipId, hasSound);
      mediaAudioDurationCache.set(url, duration);

      if (!hasSound) {
        mediaPeaksCache.set(url, []);
        notifyAudioChange();
        return [];
      }

      // Normalize to 0.0 - 1.0 with speech-clarity curve
      const normalizedPeaks = new Array<number>(numPoints);
      for (let i = 0; i < numPoints; i++) {
        const norm = Math.min(1.0, rawPeaks[i] / maxVal);
        // Exponent 0.78 gently boosts quieter speech while keeping true dynamics
        normalizedPeaks[i] = Math.pow(norm, 0.78);
      }

      mediaPeaksCache.set(url, normalizedPeaks);
      notifyAudioChange();
      return normalizedPeaks;
    } catch (err) {
      console.warn("[mediaAudioDetector] Could not decode audio from:", url, err);
      // Media may not contain an audio track
      setMediaHasAudio(url, false);
      if (clipId) setMediaHasAudio(clipId, false);
      mediaPeaksCache.set(url, []);
      notifyAudioChange();
      return [];
    } finally {
      inFlightDecodes.delete(url);
      notifyAudioChange();
    }
  })();

  inFlightDecodes.set(url, decodePromise);
  notifyAudioChange();
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
  // Trigger real audio extraction pipeline
  extractRealMediaAudioPeaks(url, clipId);
}

/**
 * Generates an array of normalized bar heights (0.04 to 1.0)
 * for a clip based on its actual decoded audio peaks, respecting duration, trimIn, and speed.
 * Never outputs synthetic dummy waveforms.
 */
export function getClipWaveformPeaks(
  clipId: string,
  url: string | undefined,
  width: number,
  duration: number,
  trimIn: number = 0,
  speed: number = 1.0,
  barWidth: number = 2.5,
  barGap: number = 1.5,
): number[] {
  const numBars = Math.max(4, Math.min(500, Math.floor(width / (barWidth + barGap))));

  // If real audio peak data is cached for this URL
  if (url && mediaPeaksCache.has(url)) {
    const allPeaks = mediaPeaksCache.get(url)!;
    if (allPeaks.length > 0) {
      const mediaDuration =
        mediaAudioDurationCache.get(url) || Math.max(0.1, trimIn + duration * speed);
      const sourceDuration = Math.max(0.05, duration * speed);
      const result: number[] = new Array(numBars);

      for (let i = 0; i < numBars; i++) {
        const clipFrac = i / numBars;
        const sourceTime = trimIn + clipFrac * sourceDuration;
        const sourceFrac = Math.max(0, Math.min(1.0, sourceTime / mediaDuration));
        const peakIdx = Math.floor(sourceFrac * (allPeaks.length - 1));
        const val = allPeaks[Math.max(0, Math.min(allPeaks.length - 1, peakIdx))];
        result[i] = Math.max(0.04, Math.min(1.0, val));
      }
      return result;
    }
  }

  // If known to have no audio, return empty array
  if (url && isMediaAudioDetected(url) === false) {
    return [];
  }
  if (clipId && isMediaAudioDetected(clipId) === false) {
    return [];
  }

  // Kick off real extraction if URL exists
  if (url) {
    extractRealMediaAudioPeaks(url, clipId);
  }

  // Return empty array while real audio is decoding — no dummy sine waves
  return [];
}
