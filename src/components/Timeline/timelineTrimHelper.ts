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
) {
  const isUnlimited = isExtendableClip(targetClip, targetClip.type);
  const mediaDur = isUnlimited
    ? null
    : getMediaDuration(targetClip.rawClip, targetClip.type);
  const isMediaClip = !isUnlimited && mediaDur !== null && mediaDur > 0;
  const speed = Math.max(0.1, Math.min(16, targetClip?.rawClip?.speed || 1.0));

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

  const maxDelta = initialDur - MIN_CLIP_DURATION;
  const minTrackDelta = minAllowedStart - initialStart;
  const minMediaDelta = isMediaClip ? -(initialTrimIn / speed) : -Infinity;
  const minDelta = Math.max(minTrackDelta, minMediaDelta);

  const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaX));
  const newStart = Math.max(minAllowedStart, initialStart + clampedDelta);
  const newDur = Math.max(MIN_CLIP_DURATION, initialDur - clampedDelta);
  const newTrimIn = isMediaClip
    ? Math.max(0, initialTrimIn + clampedDelta * speed)
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
) {
  const isUnlimited = isExtendableClip(targetClip, targetClip.type);
  const mediaDur = isUnlimited
    ? null
    : getMediaDuration(targetClip.rawClip, targetClip.type);
  const isMediaClip = !isUnlimited && mediaDur !== null && mediaDur > 0;
  const speed = Math.max(0.1, Math.min(16, targetClip?.rawClip?.speed || 1.0));
  const currentTrimIn = Math.max(0, targetClip?.rawClip?.trimIn || 0);

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

  const maxMediaDur = isMediaClip
    ? Math.max(MIN_CLIP_DURATION, (mediaDur - currentTrimIn) / speed)
    : Infinity;

  const maxAllowedDur = Math.min(maxTrackDur, maxMediaDur);

  const rawDur = initialDur + deltaX;
  const newDur = Math.max(
    MIN_CLIP_DURATION,
    Math.min(maxAllowedDur, rawDur),
  );
  const newTrimOut = isMediaClip
    ? Math.min(mediaDur, currentTrimIn + newDur * speed)
    : Math.max(MIN_CLIP_DURATION, initialTrimOut + deltaX);

  return {
    duration: Number(newDur.toFixed(3)),
    trimOut: Number(newTrimOut.toFixed(3)),
    trackIndex,
  };
}
