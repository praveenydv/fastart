import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { VideoRenderer } from "../../utils/videoRenderer";
import { getLiveMediaUrl } from "../../utils/largeMediaStorage";
import { FastArtProject } from "../../types/project";

interface UsePlayerWebRendererProps {
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
  boxWidth: number;
  canvasHeight: number;
}

export function usePlayerWebRenderer({
  project,
  currentTime,
  isPlaying,
  boxWidth,
  canvasHeight,
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

  // Initialize VideoRenderer for Web
  useEffect(() => {
    if (Platform.OS === "web" && canvasRef.current) {
      rendererRef.current = new VideoRenderer(canvasRef.current);
      rendererRef.current.onFrameNeeded = () => {
        if (rendererRef.current && canvasRef.current) {
          rendererRef.current.renderFrame(
            projectRef.current,
            currentTimeRef.current,
            isPlaying,
            boxWidthRef.current,
            canvasHeightRef.current,
          );
        }
      };

      const clips = project.tracks.video || [];
      clips.forEach((clip) => {
        rendererRef.current?.preloadClip(clip);
      });
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
        if (clip.url.startsWith("blob:")) {
          // Verify if element is genuinely working and loaded in DOM
          const existingEl = rendererRef.current?.videoElements.get(clip.url);
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
            const freshUrl = await getLiveMediaUrl(lookupId);
            if (freshUrl) {
              clip.url = freshUrl;
              if (clip.type === "photo" && (!clip.thumbnail || clip.thumbnail.startsWith("blob:"))) {
                clip.thumbnail = freshUrl;
              }
              if (rendererRef.current && canvasRef.current) {
                rendererRef.current.preloadClip(clip);
                rendererRef.current.renderFrame(
                  projectRef.current,
                  currentTimeRef.current,
                  isPlaying,
                  boxWidthRef.current,
                  canvasHeightRef.current,
                );
              }
            }
          } catch (e) {}
        }
      });
    }
  }, [project.id]);

  // Render frame on timestamp, project, or playback state change
  useEffect(() => {
    if (rendererRef.current && canvasRef.current) {
      if (rendererRef.current.canvas !== canvasRef.current) {
        rendererRef.current.setCanvas(canvasRef.current);
      }
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  }, [currentTime, project, isPlaying, boxWidth, canvasHeight]);

  return {
    canvasRef,
    canvasBoxRef,
    rendererRef,
  };
}
