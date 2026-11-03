import { useSyncExternalStore } from "react";
import { playheadCoordinator } from "./playheadCoordinator";

type PlaybackTimeUpdate = number | ((current: number) => number);

let playbackTime = 0;
const listeners = new Set<() => void>();

export function getPlaybackTime(): number {
  return playbackTime;
}

export function setPlaybackTime(update: PlaybackTimeUpdate): number {
  const nextTime = typeof update === "function" ? update(playbackTime) : update;
  if (!Number.isFinite(nextTime) || Object.is(nextTime, playbackTime)) return playbackTime;
  playbackTime = nextTime;
  playheadCoordinator.notify(nextTime);
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn("[PlaybackTimeStore] Subscriber failed:", error);
    }
  });
  return playbackTime;
}

function subscribePlaybackTime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const subscribeWithoutPlaybackUpdates = () => () => {};

export function usePlaybackTime(enabled = true): number {
  return useSyncExternalStore(
    enabled ? subscribePlaybackTime : subscribeWithoutPlaybackUpdates,
    getPlaybackTime,
    getPlaybackTime,
  );
}
