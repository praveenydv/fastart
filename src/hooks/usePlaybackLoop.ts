import { useEffect, useRef } from "react";
import { getActiveVideoRenderer } from "../utils/videoRenderer";

interface UsePlaybackLoopParams {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  totalDuration: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  currentTimeRef: React.MutableRefObject<number>;
}

const getNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export function usePlaybackLoop({
  isPlaying,
  setIsPlaying,
  totalDuration,
  setCurrentTime,
  currentTimeRef,
}: UsePlaybackLoopParams) {
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastReactUpdateRef = useRef<number>(0);
  const currentPosRef = useRef<number>(currentTimeRef.current || 0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const totalDurationRef = useRef(totalDuration);
  totalDurationRef.current = totalDuration;
  const setIsPlayingRef = useRef(setIsPlaying);
  setIsPlayingRef.current = setIsPlaying;
  const setCurrentTimeRef = useRef(setCurrentTime);
  setCurrentTimeRef.current = setCurrentTime;

  useEffect(() => {
    if (!isPlaying || totalDuration <= 0) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    // Initialize playhead start position from external ref
    currentPosRef.current = currentTimeRef.current || 0;
    lastTimeRef.current = getNow();
    lastReactUpdateRef.current = getNow();

    const loop = (now: number) => {
      if (!isPlayingRef.current || totalDurationRef.current <= 0) {
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        return;
      }

      // Check if user jumped or scrubbed during playback
      if (Math.abs((currentTimeRef.current || 0) - currentPosRef.current) > 0.4) {
        currentPosRef.current = currentTimeRef.current || 0;
      }

      const currentTimeStamp = typeof now === "number" ? now : getNow();
      const rawDelta = (currentTimeStamp - (lastTimeRef.current || currentTimeStamp)) / 1000;
      const delta = Math.min(0.1, Math.max(0.0005, rawDelta));
      lastTimeRef.current = currentTimeStamp;

      const nextTime = currentPosRef.current + delta;

      if (nextTime >= totalDurationRef.current) {
        currentPosRef.current = 0;
        currentTimeRef.current = 0;
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        setIsPlayingRef.current(false);
        setCurrentTimeRef.current(0);
        return;
      }

      currentPosRef.current = nextTime;
      currentTimeRef.current = nextTime;

      // 1. Direct 60 FPS Hardware Canvas Render (bypasses React virtual DOM overhead)
      const renderer = getActiveVideoRenderer();
      if (renderer && renderer.onFrameNeeded) {
        renderer.onFrameNeeded();
      }

      // 2. Throttled React state update for UI controls (~30 FPS, ~33ms)
      // Completely eliminates "Maximum update depth exceeded" and CPU starvation
      if (currentTimeStamp - lastReactUpdateRef.current >= 33) {
        lastReactUpdateRef.current = currentTimeStamp;
        setCurrentTimeRef.current(nextTime);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      // On stop, ensure exact final playhead is committed to React state
      setCurrentTimeRef.current(currentPosRef.current);
    };
  }, [isPlaying, totalDuration, currentTimeRef]);
}
