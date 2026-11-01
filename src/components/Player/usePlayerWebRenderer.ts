import { useEffect, useLayoutEffect, useRef } from "react";
import { Platform } from "react-native";
import { VideoRenderer } from "../../utils/videoRenderer";
import { getLiveMediaUrl } from "../../utils/largeMediaStorage";
import { FastArtProject } from "../../types/project";

const useIsomorphicLayoutEffect =
  Platform.OS === "web" && typeof window !== "undefined"
    ? useLayoutEffect
    : useEffect;

interface UsePlayerWebRendererProps {
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
  boxWidth: number;
  canvasHeight: number;
  isResizing?: boolean;
}

export function usePlayerWebRenderer({
  project,
  currentTime,
  isPlaying,
  boxWidth,
  canvasHeight,
  isResizing = false,
}: UsePlayerWebRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasBoxRef = useRef<any>(null);
  const rendererRef = useRef<VideoRenderer | null>(null);

  const projectRef = useRef(project);
  projectRef.current = project;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const boxWidthRef = useRef(boxWidth);
  boxWidthRef.current = boxWidth;
  const canvasHeightRef = useRef(canvasHeight);
  canvasHeightRef.current = canvasHeight;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Initialize VideoRenderer for Web
  useIsomorphicLayoutEffect(() => {
    if (Platform.OS === "web" && canvasRef.current) {
      rendererRef.current = new VideoRenderer(canvasRef.current);
      rendererRef.current.onFrameNeeded = () => {
        if (rendererRef.current && canvasRef.current) {
          rendererRef.current.renderFrame(
            projectRef.current,
            currentTimeRef.current,
            isPlayingRef.current,
            boxWidthRef.current,
            canvasHeightRef.current,
          );
        }
      };

      const clips = project.tracks.video || [];
      clips.forEach((clip) => {
        rendererRef.current?.preloadClip(clip);
      });

      // Synchronously render the initial frame
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
      }
    };
  }, [project.aspectRatio]);

  // Prune unused media elements when video track clips change
  useEffect(() => {
    if (rendererRef.current && project.tracks.video) {
      const activeKeys = new Set<string>();
      project.tracks.video.forEach((c) => {
        if (c.id) activeKeys.add(c.id);
        if (c.url) activeKeys.add(c.url);
        if (c.sourceMediaId) activeKeys.add(c.sourceMediaId);
      });
      rendererRef.current.pruneUnusedMedia(activeKeys);
      project.tracks.video.forEach((clip) => {
        rendererRef.current?.preloadClip(clip);
      });
    }
  }, [project.tracks.video]);

  // Rehydrate live media URLs from IndexedDB for blob URLs on initial project load only
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const clips = project.tracks.video || [];
      clips.forEach(async (clip) => {
        if (clip.url && clip.url.startsWith("blob:")) {
          // Verify if element is genuinely working and loaded in DOM
          const existingEl =
            rendererRef.current?.videoElements.get(clip.id) ||
            rendererRef.current?.videoElements.get(clip.url);
          const isMediaWorking =
            existingEl instanceof HTMLVideoElement
              ? !(existingEl as any).error && existingEl.readyState >= 1
              : existingEl instanceof HTMLImageElement
                ? existingEl.complete && existingEl.naturalWidth > 0
                : false;
          if (isMediaWorking) {
            return;
          }

          try {
            const lookupId = clip.sourceMediaId || clip.id;
            const freshUrl = await getLiveMediaUrl(lookupId, clip.title || (clip as any).name);
            if (freshUrl) {
              clip.url = freshUrl;
              if (clip.type === "photo" && (!clip.thumbnail || clip.thumbnail.startsWith("blob:"))) {
                clip.thumbnail = freshUrl;
              }
              if (rendererRef.current) {
                rendererRef.current.videoElements.delete(clip.id);
                rendererRef.current.videoElements.delete(clip.url);
                rendererRef.current.preloadClip(clip);
                if (canvasRef.current) {
                  rendererRef.current.renderFrame(
                    projectRef.current,
                    currentTimeRef.current,
                    isPlaying,
                    boxWidthRef.current,
                    canvasHeightRef.current,
                  );
                }
              }
            }
          } catch (e) {}
        }
      });
    }
  }, [project.id]);

  // Instantly pause hardware decoders when playback stops
  useEffect(() => {
    if (!isPlaying && rendererRef.current) {
      rendererRef.current.pauseAll();
    }
  }, [isPlaying]);

  // Render frame synchronously on timestamp, project, or paused state / dimension change before browser paint
  useIsomorphicLayoutEffect(() => {
    if (rendererRef.current && canvasRef.current) {
      if (rendererRef.current.canvas !== canvasRef.current) {
        rendererRef.current.setCanvas(canvasRef.current);
      }
      // When playing, the hardware animation loop in usePlaybackLoop renders frames directly at 60fps
      if (isPlaying) {
        return;
      }
      // While actively resizing/dragging layout, skip clearing and re-rendering every sub-pixel.
      // CSS scales the existing canvas buffer butter-smooth without context clears or flickering!
      if (isResizing) {
        return;
      }
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  }, [currentTime, project, isPlaying, boxWidth, canvasHeight, isResizing]);

  return {
    canvasRef,
    canvasBoxRef,
    rendererRef,
  };
}
