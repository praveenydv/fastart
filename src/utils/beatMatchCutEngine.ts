// FastArt Beat Match Cut Engine
// Automatically splits and aligns video clips to musical beat markers (CapCut Auto Match Cut)

import { FastArtProject, VideoClip } from '../types/project';

/**
 * Automatically splits main-track video clips at all detected beat markers,
 * creating an instant rhythmic montage aligned with musical transients.
 *
 * @param project The FastArtProject containing video tracks and beatMarkers
 * @param minSliceDuration Minimum allowed slice duration in seconds (prevents sub-frame slivers)
 * @returns Updated array of VideoClips split at beat boundaries
 */
export function autoMatchCutVideoToBeats(
  project: FastArtProject,
  minSliceDuration: number = 0.35
): VideoClip[] {
  const beats = project.beatMarkers;
  if (!beats || beats.length === 0 || !project.tracks?.video || project.tracks.video.length === 0) {
    return project.tracks?.video || [];
  }

  // Filter and sort beat markers
  const sortedBeats = Array.from(new Set(beats))
    .filter((b) => typeof b === 'number' && b > 0)
    .sort((a, b) => a - b);

  if (sortedBeats.length === 0) {
    return project.tracks.video;
  }

  const newVideoClips: VideoClip[] = [];

  for (const clip of project.tracks.video) {
    // Only apply match cut to main-track video clips (trackIndex 0 or undefined)
    if (clip.trackIndex && clip.trackIndex > 0) {
      newVideoClips.push({ ...clip });
      continue;
    }

    const clipStart = clip.startTime || 0;
    const clipDur = clip.duration || 0;
    const clipEnd = clipStart + clipDur;
    const speed = Math.max(0.1, Math.min(16, clip.speed || 1.0));
    const baseTrimIn = clip.trimIn || 0;

    // Find all beats that fall inside this clip with safe margins
    const insideBeats = sortedBeats.filter(
      (b) => b >= clipStart + minSliceDuration && b <= clipEnd - minSliceDuration
    );

    if (insideBeats.length === 0) {
      newVideoClips.push({ ...clip });
      continue;
    }

    // Split clip into successive slices
    let currentSliceStart = clipStart;
    const splitPoints = [...insideBeats, clipEnd];

    for (let i = 0; i < splitPoints.length; i++) {
      const currentSliceEnd = splitPoints[i];
      const sliceDuration = Number((currentSliceEnd - currentSliceStart).toFixed(3));

      if (sliceDuration < minSliceDuration && i < splitPoints.length - 1) {
        // Skip sliver and continue to next beat
        continue;
      }

      const mediaOffset = Number(((currentSliceStart - clipStart) * speed).toFixed(3));
      const sliceTrimIn = Number((baseTrimIn + mediaOffset).toFixed(3));
      const sliceTrimOut = Number((sliceTrimIn + sliceDuration * speed).toFixed(3));

      const sliceId = `${clip.id}_beat_${i}_${Date.now()}`;

      const sliceClip: VideoClip = {
        ...clip,
        id: sliceId,
        sourceMediaId: clip.sourceMediaId || clip.id,
        startTime: Number(currentSliceStart.toFixed(3)),
        duration: sliceDuration,
        trimIn: sliceTrimIn,
        trimOut: sliceTrimOut,
        // Add subtle flash transition between beat cuts for viral dynamic impact
        transition: i > 0 && !clip.transition ? { type: 'flash', duration: 0.2 } : clip.transition,
      };

      newVideoClips.push(sliceClip);
      currentSliceStart = currentSliceEnd;
    }
  }

  return newVideoClips;
}

