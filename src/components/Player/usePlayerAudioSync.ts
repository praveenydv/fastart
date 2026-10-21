import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { FastArtProject } from "../../types/project";
import { setCachedMediaDuration } from "../../utils/mediaDuration";

interface UsePlayerAudioSyncProps {
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
}

export function usePlayerAudioSync({
  project,
  currentTime,
  isPlaying,
}: UsePlayerAudioSyncProps) {
  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const audioClips = project.tracks.audio || [];
    const activeIds = new Set(audioClips.map((a) => a.id));

    // Cleanup and release hardware audio decoders for removed audio tracks
    Object.keys(audioElementsRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        const el = audioElementsRef.current[id];
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch {}
        delete audioElementsRef.current[id];
      }
    });

    audioClips.forEach((clip) => {
      let el = audioElementsRef.current[clip.id];
      if (!el || el.src !== clip.url) {
        if (el) {
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
          } catch {}
        }
        el = new Audio(clip.url);
        el.addEventListener("loadedmetadata", () => {
          if (
            el.duration &&
            !isNaN(el.duration) &&
            isFinite(el.duration) &&
            el.duration > 0
          ) {
            setCachedMediaDuration(clip.url, el.duration);
            if (clip.id) setCachedMediaDuration(clip.id, el.duration);
          }
        });
        audioElementsRef.current[clip.id] = el;
      }

      const clipStart = clip.startTime || 0;
      const clipEnd = clipStart + (clip.duration || 0);
      const isInside = currentTime >= clipStart && currentTime <= clipEnd;

      if (isPlaying && isInside) {
        const audioOffset = currentTime - clipStart + (clip.trimIn || 0);
        if (Math.abs(el.currentTime - audioOffset) > 0.25) {
          el.currentTime = Math.max(0, audioOffset);
        }
        el.volume = Math.max(0, Math.min(1, clip.volume ?? 1.0));
        el.play().catch(() => {});
      } else {
        el.pause();
        if (isInside) {
          const audioOffset = currentTime - clipStart + (clip.trimIn || 0);
          el.currentTime = Math.max(0, audioOffset);
        }
      }
    });

    return () => {
      if (!isPlaying) {
        Object.values(audioElementsRef.current).forEach((el: any) => {
          try {
            el.pause();
          } catch {}
        });
      }
    };
  }, [isPlaying, project.tracks.audio, currentTime]);

  return { audioElementsRef };
}
