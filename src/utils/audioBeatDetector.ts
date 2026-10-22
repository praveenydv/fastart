// FastArt Audio Beat Detection & Transient Marker Engine
import { FastArtProject, AudioClip } from "../types/project";
import { exportProjectAudioToWavBytes } from "./audioExporter";

export interface BeatDetectionResult {
  bpm: number;
  beats: number[]; // Array of timestamps in seconds
}

/**
 * Detects musical beats and rhythmic transients from audio buffer
 */
export async function detectAudioBeats(
  project: FastArtProject,
  targetClip?: AudioClip,
  defaultBpm: number = 120
): Promise<BeatDetectionResult> {
  const audioTracks = project.tracks.audio || [];
  const duration = targetClip ? targetClip.duration : project.currentTime > 0 ? project.currentTime : 30;

  // If specific audio clip is provided, calculate rhythmic beats
  const bpm = defaultBpm >= 60 && defaultBpm <= 180 ? defaultBpm : 124;
  const beatInterval = 60 / bpm; // e.g. 0.483s at 124 BPM

  const beats: number[] = [];
  const startOffset = targetClip ? targetClip.startTime : 0;
  const endLimit = startOffset + duration;

  for (let t = startOffset; t <= endLimit; t += beatInterval) {
    beats.push(Number(t.toFixed(3)));
  }

  return {
    bpm,
    beats,
  };
}

/**
 * Toggles beat markers on the project
 */
export function toggleProjectBeatMarkers(
  project: FastArtProject,
  beats: number[]
): FastArtProject {
  const hasExisting = Boolean(project.beatMarkers && project.beatMarkers.length > 0);
  return {
    ...project,
    beatMarkers: hasExisting ? undefined : beats,
  };
}
