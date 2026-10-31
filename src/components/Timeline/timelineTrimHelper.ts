import { getMediaDuration, isImageClip, isExtendableClip } from "../../utils/mediaDuration";
import { UnifiedClipItem, MIN_CLIP_DURATION } from "./timelineTypes";

export function computeLeftTrimUpdates(
  targetClip: UnifiedClipItem,
  initialStart: number,
  initialDur: number,
  initialTrimIn: number,
  trackIndex: number,
  deltaX: number,
  allClips: UnifiedClipItem[],
  isSnappingEnabled = false,
  pxPerSec = 50,
  currentTime = -1,
) {
  const isUnlimited = isExtendableClip(targetClip, targetClip.type);
  const mediaDur = isUnlimited
    ? null
    : getMediaDuration(targetClip.rawClip, targetClip.type);
  const isMediaClip = !isUnlimited && mediaDur !== null && mediaDur > 0;
  const speed = Math.max(0.1, Math.min(16, targetClip?.rawClip?.speed || 1.0));
  const rawClip = targetClip.rawClip || targetClip;

  let minAllowedTrimIn = typeof rawClip.minTrimIn === "number" ? rawClip.minTrimIn : 0;
  const sourceId = rawClip.sourceMediaId || (isMediaClip ? rawClip.url : null);
  if (sourceId) {
    const priorSibling = allClips.find(
      (c) =>
        c.id !== targetClip.id &&
        c.effectiveTrackIndex === trackIndex &&
        (c.rawClip?.sourceMediaId === sourceId || (isMediaClip && c.rawClip?.url === sourceId)) &&
        c.startTime + c.duration <= initialStart + 0.05,
    );
    if (priorSibling && typeof priorSibling.rawClip?.trimOut === "number") {
      minAllowedTrimIn = Math.max(minAllowedTrimIn, priorSibling.rawClip.trimOut);
    }
  }

  const clipsBefore = allClips
    .filter(
      (c) =>
        c.id !== targetClip.id &&
        c.effectiveTrackIndex === trackIndex &&
        c.startTime + c.duration <= initialStart + 0.01,
    )
    .sort((a, b) => a.startTime - b.startTime);

  const minAllowedStart =
    clipsBefore.length > 0
      ? clipsBefore[clipsBefore.length - 1].startTime +
        clipsBefore[clipsBefore.length - 1].duration
      : 0;

  const maxClipAllowedDur = typeof rawClip.maxDuration === "number" ? rawClip.maxDuration : Infinity;
  const maxDelta = initialDur - MIN_CLIP_DURATION;
  const minTrackDelta = minAllowedStart - initialStart;
  const minMediaDelta = isMediaClip ? -((initialTrimIn - minAllowedTrimIn) / speed) : -Infinity;
  const minDurationDelta = isFinite(maxClipAllowedDur) ? -(maxClipAllowedDur - initialDur) : -Infinity;
  const minDelta = Math.max(minTrackDelta, minMediaDelta, minDurationDelta);

  let clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaX));
  let candidateStart = Math.max(minAllowedStart, initialStart + clampedDelta);

  if (isSnappingEnabled) {
    const snapThreshold = 20 / pxPerSec;
    let bestSnap = candidateStart;
    let bestDist = snapThreshold;

    if (currentTime >= 0 && Math.abs(candidateStart - currentTime) < bestDist) {
      bestSnap = currentTime;
      bestDist = Math.abs(candidateStart - currentTime);
    }
    if (Math.abs(candidateStart) < bestDist) {
      bestSnap = 0;
      bestDist = Math.abs(candidateStart);
    }
    allClips.forEach((other) => {
      if (other.id === targetClip.id) return;
      if (Math.abs(candidateStart - other.startTime) < bestDist) {
        bestSnap = other.startTime;
        bestDist = Math.abs(candidateStart - other.startTime);
      }
      const otherEnd = other.startTime + other.duration;
      if (Math.abs(candidateStart - otherEnd) < bestDist) {
        bestSnap = otherEnd;
        bestDist = Math.abs(candidateStart - otherEnd);
      }
    });

    if (bestSnap !== candidateStart) {
      const snapDelta = bestSnap - initialStart;
      if (snapDelta >= minDelta && snapDelta <= maxDelta && bestSnap >= minAllowedStart) {
        clampedDelta = snapDelta;
        candidateStart = bestSnap;
      }
    }
  }

  const newStart = candidateStart;
  const newDur = Math.max(MIN_CLIP_DURATION, Math.min(maxClipAllowedDur, initialDur - clampedDelta));
  const newTrimIn = isMediaClip
    ? Math.max(minAllowedTrimIn, initialTrimIn + clampedDelta * speed)
    : Math.max(0, initialTrimIn + clampedDelta);

  return {
    startTime: Number(newStart.toFixed(3)),
    duration: Number(newDur.toFixed(3)),
    trimIn: Number(newTrimIn.toFixed(3)),
    trackIndex,
  };
}

export function computeRightTrimUpdates(
  targetClip: UnifiedClipItem,
  initialStart: number,
  initialDur: number,
  initialTrimOut: number,
  trackIndex: number,
  deltaX: number,
  allClips: UnifiedClipItem[],
  isSnappingEnabled = false,
  pxPerSec = 50,
  currentTime = -1,
) {
  const isUnlimited = isExtendableClip(targetClip, targetClip.type);
  const mediaDur = isUnlimited
    ? null
    : getMediaDuration(targetClip.rawClip, targetClip.type);
  const isMediaClip = !isUnlimited && mediaDur !== null && mediaDur > 0;
  const speed = Math.max(0.1, Math.min(16, targetClip?.rawClip?.speed || 1.0));
  const rawClip = targetClip.rawClip || targetClip;
  const currentTrimIn = Math.max(0, rawClip.trimIn || 0);

  let maxAllowedTrimOut = typeof rawClip.maxTrimOut === "number"
    ? (mediaDur !== null ? Math.min(mediaDur, rawClip.maxTrimOut) : rawClip.maxTrimOut)
    : (mediaDur ?? Infinity);

  const sourceId = rawClip.sourceMediaId || (isMediaClip ? rawClip.url : null);
  if (sourceId) {
    const nextSibling = allClips.find(
      (c) =>
        c.id !== targetClip.id &&
        c.effectiveTrackIndex === trackIndex &&
        (c.rawClip?.sourceMediaId === sourceId || (isMediaClip && c.rawClip?.url === sourceId)) &&
        c.startTime >= initialStart + initialDur - 0.05,
    );
    if (nextSibling && typeof nextSibling.rawClip?.trimIn === "number") {
      maxAllowedTrimOut = Math.min(maxAllowedTrimOut, nextSibling.rawClip.trimIn);
    }
  }

  const clipsAfter = allClips
    .filter(
      (c) =>
        c.id !== targetClip.id &&
        c.effectiveTrackIndex === trackIndex &&
        c.startTime >= initialStart + initialDur - 0.01,
    )
    .sort((a, b) => a.startTime - b.startTime);

  const maxTrackDur =
    clipsAfter.length > 0 ? clipsAfter[0].startTime - initialStart : Infinity;

  const maxMediaDur = isMediaClip && isFinite(maxAllowedTrimOut)
    ? Math.max(MIN_CLIP_DURATION, (maxAllowedTrimOut - currentTrimIn) / speed)
    : (isMediaClip && mediaDur ? (mediaDur - currentTrimIn) / speed : Infinity);

  const maxClipAllowedDur = typeof rawClip.maxDuration === "number" ? rawClip.maxDuration : Infinity;

  const maxAllowedDur = Math.min(maxTrackDur, maxMediaDur, maxClipAllowedDur);

  const rawDur = initialDur + deltaX;
  let candidateDur = Math.max(
    MIN_CLIP_DURATION,
    Math.min(maxAllowedDur, rawDur),
  );

  if (isSnappingEnabled) {
    const snapThreshold = 20 / pxPerSec;
    const candidateEnd = initialStart + candidateDur;
    let bestSnap = candidateEnd;
    let bestDist = snapThreshold;

    if (currentTime >= 0 && Math.abs(candidateEnd - currentTime) < bestDist) {
      bestSnap = currentTime;
      bestDist = Math.abs(candidateEnd - currentTime);
    }
    allClips.forEach((other) => {
      if (other.id === targetClip.id) return;
      const otherEnd = other.startTime + other.duration;
      if (Math.abs(candidateEnd - otherEnd) < bestDist) {
        bestSnap = otherEnd;
        bestDist = Math.abs(candidateEnd - otherEnd);
      }
      if (Math.abs(candidateEnd - other.startTime) < bestDist) {
        bestSnap = other.startTime;
        bestDist = Math.abs(candidateEnd - other.startTime);
      }
    });

    if (bestSnap !== candidateEnd) {
      const snapDur = bestSnap - initialStart;
      if (snapDur >= MIN_CLIP_DURATION && snapDur <= maxAllowedDur) {
        candidateDur = snapDur;
      }
    }
  }

  const newDur = candidateDur;
  const newTrimOut = isMediaClip
    ? Math.min(maxAllowedTrimOut, currentTrimIn + newDur * speed)
    : Math.max(MIN_CLIP_DURATION, initialTrimOut + (newDur - initialDur));

  return {
    duration: Number(newDur.toFixed(3)),
    trimOut: Number(newTrimOut.toFixed(3)),
    trackIndex,
  };
}
