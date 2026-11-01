import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Platform, Dimensions, PanResponder } from "react-native";
import { soundEngine } from "../../utils/audioEngine";
import { TRACK_ROW_HEIGHT } from "./timelineTypes";

interface UseTimelineResizeProps {
  activeTrackCount?: number;
  isMobile: boolean;
  windowHeight?: number;
}

export function useTimelineResize({
  activeTrackCount = 1,
  isMobile,
  windowHeight,
}: UseTimelineResizeProps) {
  const screenHeight = windowHeight || Dimensions.get("window").height;

  const storageKey = isMobile
    ? "fastart_timeline_height_mobile"
    : "fastart_timeline_height";

  // Min and max limits
  // On mobile: comfortable range guaranteeing ample player preview room
  const minTimelineHeight = isMobile ? 180 : 74;
  const maxTimelineHeight = isMobile
    ? Math.min(Math.round(screenHeight * 0.60), Math.max(minTimelineHeight, screenHeight - 250))
    : Math.min(550, Math.max(280, Math.round(screenHeight * 0.55)));

  const defaultHeight = isMobile ? 200 : 220;

  const [userTimelineHeight, setUserTimelineHeight] = useState<number | null>(
    () => {
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        window.localStorage
      ) {
        try {
          const saved = window.localStorage.getItem(storageKey);
          if (saved) {
            const parsed = parseFloat(saved);
            if (
              !isNaN(parsed) &&
              parsed >= minTimelineHeight &&
              parsed <= maxTimelineHeight
            ) {
              return parsed;
            }
          }
        } catch (_) {}
      }
      return null;
    },
  );
  const [isResizingHeight, setIsResizingHeight] = useState(false);

  const autoTimelineHeight = useMemo(() => {
    if (isMobile) {
      return defaultHeight;
    }
    const contentH =
      10 + 30 + 26 + Math.max(1, activeTrackCount) * TRACK_ROW_HEIGHT + 2;
    const maxH = Math.max(280, Math.min(450, Math.round(screenHeight * 0.45)));
    return Math.max(200, Math.min(maxH, contentH));
  }, [activeTrackCount, isMobile, screenHeight, defaultHeight]);

  const timelineHeight = useMemo(() => {
    if (userTimelineHeight !== null) {
      return Math.max(
        minTimelineHeight,
        Math.min(maxTimelineHeight, userTimelineHeight),
      );
    }
    return autoTimelineHeight;
  }, [
    userTimelineHeight,
    autoTimelineHeight,
    minTimelineHeight,
    maxTimelineHeight,
  ]);

  const timelineHeightRef = useRef(timelineHeight);
  useEffect(() => {
    timelineHeightRef.current = timelineHeight;
  }, [timelineHeight]);

  const saveHeight = useCallback(
    (h: number) => {
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        window.localStorage
      ) {
        try {
          window.localStorage.setItem(storageKey, String(h));
        } catch (_) {}
      }
    },
    [storageKey],
  );

  const handleResetResizeHeight = useCallback(() => {
    setUserTimelineHeight(defaultHeight);
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (_) {}
    }
    soundEngine.playSfx("pop");
  }, [storageKey, defaultHeight]);

  // Pointer / Mouse / Touch down handler for Web
  const handleResizePointerDown = useCallback(
    (e: any) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;

      e.preventDefault?.();
      e.stopPropagation?.();

      const startY =
        e.clientY ?? e.pageY ?? e.touches?.[0]?.clientY ?? 0;
      const initialH = timelineHeightRef.current;
      let currentH = initialH;
      let targetH = initialH;
      let rafHandle: number | null = null;

      setIsResizingHeight(true);

      const onPointerMove = (moveEvt: any) => {
        moveEvt.preventDefault?.();
        const clientY =
          moveEvt.clientY ??
          moveEvt.pageY ??
          moveEvt.touches?.[0]?.clientY ??
          0;
        const deltaY = clientY - startY;
        targetH = Math.round(
          Math.max(
            minTimelineHeight,
            Math.min(maxTimelineHeight, initialH - deltaY),
          ),
        );
        currentH = targetH;
        if (rafHandle === null) {
          rafHandle = requestAnimationFrame(() => {
            rafHandle = null;
            setUserTimelineHeight(targetH);
          });
        }
      };

      const onPointerUp = () => {
        if (rafHandle !== null) {
          cancelAnimationFrame(rafHandle);
          rafHandle = null;
        }
        setUserTimelineHeight(currentH);
        setIsResizingHeight(false);
        if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.removeEventListener === "function") {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("mousemove", onPointerMove);
          window.removeEventListener("mouseup", onPointerUp);
          window.removeEventListener("touchmove", onPointerMove);
          window.removeEventListener("touchend", onPointerUp);
          window.removeEventListener("touchcancel", onPointerUp);
        }
        saveHeight(currentH);
      };

      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("pointermove", onPointerMove, { passive: false });
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);
        window.addEventListener("touchmove", onPointerMove, { passive: false });
        window.addEventListener("touchend", onPointerUp);
        window.addEventListener("touchcancel", onPointerUp);
      }
    },
    [minTimelineHeight, maxTimelineHeight, saveHeight],
  );

  // PanResponder for Native iOS and Android
  const panStartHeightRef = useRef(0);
  const nativeRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (nativeRafRef.current !== null) {
        cancelAnimationFrame(nativeRafRef.current);
        nativeRafRef.current = null;
      }
    };
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          panStartHeightRef.current = timelineHeightRef.current;
          setIsResizingHeight(true);
        },
        onPanResponderMove: (_, gestureState) => {
          const newH = Math.round(
            Math.max(
              minTimelineHeight,
              Math.min(
                maxTimelineHeight,
                panStartHeightRef.current - gestureState.dy,
              ),
            ),
          );
          if (nativeRafRef.current !== null) {
            cancelAnimationFrame(nativeRafRef.current);
          }
          nativeRafRef.current = requestAnimationFrame(() => {
            nativeRafRef.current = null;
            setUserTimelineHeight(newH);
          });
        },
        onPanResponderRelease: (_, gestureState) => {
          if (nativeRafRef.current !== null) {
            cancelAnimationFrame(nativeRafRef.current);
            nativeRafRef.current = null;
          }
          setIsResizingHeight(false);
          const finalH = Math.round(
            Math.max(
              minTimelineHeight,
              Math.min(
                maxTimelineHeight,
                panStartHeightRef.current - gestureState.dy,
              ),
            ),
          );
          setUserTimelineHeight(finalH);
          saveHeight(finalH);
        },
        onPanResponderTerminate: () => {
          if (nativeRafRef.current !== null) {
            cancelAnimationFrame(nativeRafRef.current);
            nativeRafRef.current = null;
          }
          setIsResizingHeight(false);
        },
      }),
    [minTimelineHeight, maxTimelineHeight, saveHeight],
  );

  // Double-tap detector for mobile
  const lastTapRef = useRef<number>(0);
  const handleTouchStartWithDoubleTap = useCallback(
    (e: any) => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleResetResizeHeight();
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      if (Platform.OS === "web") {
        handleResizePointerDown(e);
      }
    },
    [handleResetResizeHeight, handleResizePointerDown],
  );

  // Bundled props for the drag handle View
  const resizeHandleProps = useMemo(() => {
    if (Platform.OS === "web") {
      return {
        onPointerDown: handleResizePointerDown,
        onMouseDown: handleResizePointerDown,
        onTouchStart: handleTouchStartWithDoubleTap,
        onDoubleClick: handleResetResizeHeight,
      };
    }
    return {
      ...panResponder.panHandlers,
      onTouchStart: handleTouchStartWithDoubleTap,
    };
  }, [
    handleResizePointerDown,
    handleTouchStartWithDoubleTap,
    handleResetResizeHeight,
    panResponder,
  ]);

  return {
    timelineHeight,
    setTimelineHeight: setUserTimelineHeight,
    isResizingHeight,
    handleResizeMouseDown: handleResizePointerDown,
    handleResetResizeHeight,
    handleResizeTouchStart: handleTouchStartWithDoubleTap,
    handleResizeTouchMove: () => {},
    handleResizeTouchEnd: () => {},
    resizeHandleProps,
  };
}
