import { FastArtProject } from "../types/project";

export function getAllTrackClips(proj: FastArtProject): {
  id: string;
  startTime: number;
  duration: number;
  trackIndex: number;
  type: string;
}[] {
  const clips: {
    id: string;
    startTime: number;
    duration: number;
    trackIndex: number;
    type: string;
  }[] = [];

  (proj.tracks.video || []).forEach((c) =>
    clips.push({
      id: c.id,
      startTime: c.startTime,
      duration: c.duration,
      trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 0,
      type: "video",
    }),
  );
  (proj.tracks.audio || []).forEach((c) =>
    clips.push({
      id: c.id,
      startTime: c.startTime,
      duration: c.duration,
      trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 1,
      type: "audio",
    }),
  );
  (proj.tracks.text || []).forEach((c) =>
    clips.push({
      id: c.id,
      startTime: c.startTime,
      duration: c.duration,
      trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 2,
      type: "text",
    }),
  );
  (proj.tracks.stickers || []).forEach((c) =>
    clips.push({
      id: c.id,
      startTime: c.startTime,
      duration: c.duration,
      trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 3,
      type: "stickers",
    }),
  );
  (proj.tracks.effects || []).forEach((c) =>
    clips.push({
      id: c.id,
      startTime: c.startTime,
      duration: c.duration,
      trackIndex: typeof c.trackIndex === "number" ? c.trackIndex : 4,
      type: "effects",
    }),
  );
  return clips;
}

// Check if interval [start, start + duration] collides with any clip in a track list
export function doesClipOverlap(
  start: number,
  duration: number,
  clips: { startTime: number; duration: number; id?: string }[],
  ignoreClipId?: string,
): boolean {
  const end = start + duration;
  return clips.some((c) => {
    if (ignoreClipId && c.id === ignoreClipId) return false;
    const cEnd = c.startTime + c.duration;
    return start < cEnd - 0.02 && end > c.startTime + 0.02;
  });
}

// Intelligent track allocation: if preferred track does not have enough space, finds next non-overlapping track (0..9)
export function allocateClipPlacement(
  proj: FastArtProject | null,
  desiredStart: number,
  duration: number,
  preferredTrack: number,
  ignoreClipId?: string,
): { trackIndex: number; startTime: number } | null {
  if (!proj) return null;
  const allClips = getAllTrackClips(proj);
  const start = Math.max(0, Number(desiredStart.toFixed(3)));
  const dur = Math.max(0.1, Number(duration.toFixed(3)));

  // 1. Check if preferred track has space
  const preferredClips = allClips.filter(
    (c) =>
      c.trackIndex === preferredTrack &&
      (!ignoreClipId || c.id !== ignoreClipId),
  );

  if (!doesClipOverlap(start, dur, preferredClips)) {
    return { trackIndex: preferredTrack, startTime: start };
  }

  // 2. Space is NOT enough on preferred track! Check other tracks (up to 10 tracks, 0-9)
  const otherTracks: number[] = [];
  for (let t = 0; t < 10; t++) {
    if (t !== preferredTrack) {
      otherTracks.push(t);
    }
  }

  // Sort so empty tracks are checked first, then higher tracks
  otherTracks.sort((a, b) => {
    const countA = allClips.filter((c) => c.trackIndex === a).length;
    const countB = allClips.filter((c) => c.trackIndex === b).length;
    if (countA === 0 && countB > 0) return -1;
    if (countB === 0 && countA > 0) return 1;
    return a - b;
  });

  for (const trackIdx of otherTracks) {
    const trackClips = allClips.filter(
      (c) =>
        c.trackIndex === trackIdx && (!ignoreClipId || c.id !== ignoreClipId),
    );
    if (!doesClipOverlap(start, dur, trackClips)) {
      return { trackIndex: trackIdx, startTime: start };
    }
  }

  // 3. All 10 tracks occupied at desiredStart!
  return null;
}
