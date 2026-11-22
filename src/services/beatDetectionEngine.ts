// FastArt Audio Beat Detection Engine
// Detects rhythmic transients and musical onsets from audio peaks / decoded audio PCM

import { rustCoreBridge } from "./rustCoreBridge";
import { LruCache } from "../utils/lruCache";
import { getStorageItem, setStorageItem } from "../utils/storage";

const STORAGE_BEATS_PREFIX = "@fastart_beats_";
const beatCache = new LruCache<string, number[]>(100);

/**
 * Calculates rhythmic musical onsets and beat timestamps from normalized waveform peaks.
 * Uses spectral flux energy thresholding with a moving local window and refractory period.
 *
 * @param peaks Array of audio amplitude peak samples (0.0 to 1.0)
 * @param duration Total duration of the audio in seconds
 * @param sensitivity Multiplier for onset detection threshold (1.0 = normal, 0.8 = more beats, 1.3 = prominent beats only)
 * @returns Array of beat timestamps in seconds, sorted ascending
 */
export function detectBeatsFromPeaks(
  peaks: number[],
  duration: number,
  sensitivity: number = 1.0
): number[] {
  if (!peaks || peaks.length < 10 || duration <= 0) {
    return [];
  }

  const sampleCount = peaks.length;
  const timePerSample = duration / sampleCount;

  // Window size for moving average (~0.4 seconds)
  const windowRadius = Math.max(3, Math.round(0.2 / timePerSample));
  const minIntervalSec = 0.22; // Maximum ~272 BPM
  const minIntervalSamples = Math.max(2, Math.round(minIntervalSec / timePerSample));

  const beats: number[] = [];
  let lastBeatSample = -minIntervalSamples;

  // Calculate local threshold and detect onset peaks
  for (let i = 1; i < sampleCount - 1; i++) {
    const cur = peaks[i];
    const prev = peaks[i - 1];
    const next = peaks[i + 1];

    // Must be a local maximum
    if (cur <= prev || cur < next || cur < 0.12) {
      continue;
    }

    // Refractory period check
    if (i - lastBeatSample < minIntervalSamples) {
      continue;
    }

    // Calculate local energy window average
    const start = Math.max(0, i - windowRadius);
    const end = Math.min(sampleCount, i + windowRadius + 1);
    let sum = 0;
    for (let w = start; w < end; w++) {
      sum += peaks[w];
    }
    const localAvg = sum / (end - start);

    // Dynamic threshold: peak must exceed local average by sensitivity factor
    const threshold = Math.max(0.18, localAvg * (1.2 * sensitivity));
    if (cur >= threshold) {
      const beatTime = Number((i * timePerSample).toFixed(3));
      beats.push(beatTime);
      lastBeatSample = i;
    }
  }

  return beats;
}

/**
 * Analyzes audio array buffer and returns detected beat timestamps in seconds.
 */
export async function detectBeatsFromAudioBuffer(
  buffer: ArrayBuffer,
  cacheKey?: string,
  sensitivity: number = 1.0
): Promise<number[]> {
  if (cacheKey && beatCache.has(cacheKey)) {
    return beatCache.get(cacheKey)!;
  }

  if (cacheKey) {
    try {
      const stored = getStorageItem(STORAGE_BEATS_PREFIX + cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          beatCache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (_) {}
  }

  try {
    const decoded = await rustCoreBridge.decodeAudioPeaks(buffer, 24000);
    if (!decoded || !decoded.peaks || decoded.peaks.length === 0) {
      return [];
    }

    const beats = detectBeatsFromPeaks(decoded.peaks, decoded.duration, sensitivity);
    if (cacheKey && beats.length > 0) {
      beatCache.set(cacheKey, beats);
      try {
        setStorageItem(STORAGE_BEATS_PREFIX + cacheKey, JSON.stringify(beats));
      } catch (_) {}
    }
    return beats;
  } catch (err) {
    console.warn("[beatDetectionEngine] Failed to detect beats:", err);
    return [];
  }
}

/**
 * Snaps a given timeline time to the nearest beat marker within a given threshold.
 */
export function snapTimeToNearestBeat(
  time: number,
  beats: number[] | undefined | null,
  thresholdSec: number = 0.12
): { time: number; isSnapped: boolean } {
  if (!beats || beats.length === 0) {
    return { time, isSnapped: false };
  }

  let closestDiff = thresholdSec;
  let snappedTime = time;

  for (const b of beats) {
    const diff = Math.abs(b - time);
    if (diff < closestDiff) {
      closestDiff = diff;
      snappedTime = b;
    }
  }

  return {
    time: closestDiff < thresholdSec ? snappedTime : time,
    isSnapped: closestDiff < thresholdSec,
  };
}
