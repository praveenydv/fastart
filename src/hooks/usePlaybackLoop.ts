import { useEffect, useRef } from "react";

interface UsePlaybackLoopParams {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  totalDuration: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
}

export function usePlaybackLoop({
  isPlaying,
  setIsPlaying,
  totalDuration,
  setCurrentTime,
}: UsePlaybackLoopParams) {
  const animFrameRef = useRef<any>(null);
  const lastTimeRef = useRef<any>(null);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const currentTimeStamp =
          typeof now === "number" ? now : performance.now();
        const delta = Math.min(
          0.1,
          Math.max(
            0.001,
            (currentTimeStamp - (lastTimeRef.current || currentTimeStamp)) / 1000,
          ),
        );
        lastTimeRef.current = currentTimeStamp;

        const effectiveTotal = Math.max(totalDuration, 1.0);
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= effectiveTotal) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });

        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, totalDuration, setCurrentTime, setIsPlaying]);
}
