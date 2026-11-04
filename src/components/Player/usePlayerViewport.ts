import { useState, useCallback, useEffect, useRef } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { FastArtProject } from "../../types/project";

interface UsePlayerViewportProps {
  project: FastArtProject;
  fullscreen: boolean;
  isResizing?: boolean;
  containerWidth?: number;
  containerHeight?: number;
}

export function usePlayerViewport({
  project,
  fullscreen,
  isResizing = false,
  containerWidth,
  containerHeight,
}: UsePlayerViewportProps) {
  const { width: winW, height: winH } = useWindowDimensions();
  const isMobile = winW < 768;

  const viewportWrapperRef = useRef<any>(null);
  const [viewportDims, setViewportDims] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const rafLayoutRef = useRef<number | null>(null);
  const isResizingRef = useRef(isResizing);
  useEffect(() => {
    isResizingRef.current = isResizing;
  }, [isResizing]);

  const applyDims = useCallback((width: number, height: number) => {
    // During active resize/drag, update dimensions synchronously without frame delays
    if (isResizingRef.current) {
      if (rafLayoutRef.current !== null) {
        cancelAnimationFrame(rafLayoutRef.current);
        rafLayoutRef.current = null;
      }
      setViewportDims((prev) => {
        if (prev && prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
      return;
    }

    if (rafLayoutRef.current !== null) {
      cancelAnimationFrame(rafLayoutRef.current);
    }
    rafLayoutRef.current = requestAnimationFrame(() => {
      rafLayoutRef.current = null;
      setViewportDims((prev) => {
        if (
          prev &&
          Math.abs(prev.width - width) < 2 &&
          Math.abs(prev.height - height) < 2
        ) {
          return prev;
        }
        return { width, height };
      });
    });
  }, []);

  const handleViewportLayout = useCallback((e: any) => {
    const layout = e.nativeEvent?.layout;
    if (layout && layout.width > 0 && layout.height > 0) {
      applyDims(Math.round(layout.width), Math.round(layout.height));
    }
  }, [applyDims]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const el = viewportWrapperRef.current as unknown as HTMLElement;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          applyDims(Math.round(width), Math.round(height));
        }
      }
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafLayoutRef.current !== null) {
        cancelAnimationFrame(rafLayoutRef.current);
        rafLayoutRef.current = null;
      }
    };
  }, [applyDims]);

  const getAspectRatioDimensions = () => {
    const ratioMap: Record<string, number> = {
      "9:16": 9 / 16,
      "16:9": 16 / 9,
      "1:1": 1 / 1,
      "4:5": 4 / 5,
      "2.35:1": 235 / 100,
    };
    const targetRatio = ratioMap[project.aspectRatio] || 9 / 16;

    if (fullscreen) {
      const maxFsH = Math.max(120, winH - (isMobile ? 24 : 64));
      const maxFsW = Math.max(120, winW - (isMobile ? 16 : 24));
      let w = maxFsH * targetRatio;
      let h = maxFsH;
      if (w > maxFsW) {
        w = maxFsW;
        h = w / targetRatio;
      }
      return { width: Math.round(w), height: Math.round(h) };
    }

    // Chrome vertical footprint: Desktop header (28px, only on desktop); Control bar (36px + 1px border on mobile, 38px on desktop); border (1px)
    const chromeH = fullscreen ? 0 : isMobile ? 38 : 67;

    const effectiveContainerW =
      containerWidth && containerWidth > 0
        ? containerWidth
        : viewportDims && viewportDims.width > 0
        ? viewportDims.width
        : winW;

    // Continuous single source of truth: when containerHeight is provided (e.g. mobile workspace),
    // derive the height directly without branch-switching on isResizing.
    // This completely eliminates size bumping, micro-shrinking, and layout snapping on mobile touch start/release.
    const effectiveContainerH =
      containerHeight && containerHeight > 0
        ? Math.max(40, containerHeight - chromeH)
        : viewportDims && viewportDims.height > 0
        ? viewportDims.height
        : Math.max(40, winH - (isMobile ? 240 : 280) - chromeH);

    const availW = Math.max(40, effectiveContainerW - (isMobile ? 16 : 24));
    const availH = Math.max(40, effectiveContainerH - (isMobile ? 8 : 16));

    let w = availH * targetRatio;
    let h = availH;

    if (w > availW) {
      w = availW;
      h = w / targetRatio;
    }

    if (h > availH) {
      h = availH;
      w = h * targetRatio;
    }

    return {
      width: Math.round(Math.max(40, w)),
      height: Math.round(Math.max(40, h)),
    };
  };

  const { width: canvasWidth, height: canvasHeight } = getAspectRatioDimensions();
  const boxWidth = canvasWidth;

  return {
    viewportWrapperRef,
    isMobile,
    canvasWidth,
    canvasHeight,
    boxWidth,
    handleViewportLayout,
  };
}
