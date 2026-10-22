import { useState, useCallback, useMemo, useRef } from "react";
import { Platform, Dimensions } from "react-native";
import { soundEngine } from "../../utils/audioEngine";
import { TRACK_ROW_HEIGHT } from "./timelineTypes";

interface UseTimelineResizeProps {
  activeTrackCount: number;
  isMobile: boolean;
}

export function useTimelineResize({
  activeTrackCount,
  isMobile,
}: UseTimelineResizeProps) {
  const { height: screenHeight } = Dimensions.get("window");

  const [userTimelineHeight, setUserTimelineHeight] = useState<number | null>(
    () => {
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        window.localStorage
      ) {
        try {
          const saved = window.localStorage.getItem("fastart_timeline_height");
          if (saved) {
            const parsed = parseFloat(saved);
            if (!isNaN(parsed) && parsed >= 74 && parsed <= 500) {
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
    const contentH =
      10 + 30 + 26 + Math.max(1, activeTrackCount) * TRACK_ROW_HEIGHT + 2;
    const maxH = isMobile ? 240 : 280;
    return Math.min(maxH, contentH);
  }, [activeTrackCount, isMobile]);

  const timelineHeight =
    userTimelineHeight !== null
      ? Math.max(userTimelineHeight, Math.min(autoTimelineHeight, isMobile ? 160 : 190))
      : autoTimelineHeight;

  const minTimelineHeight = 74;
  const maxTimelineHeight = Math.min(450, Math.round(screenHeight * 0.55));

  const handleResizeMouseDown = useCallback(
    (e: any) => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      e.preventDefault();
      e.stopPropagation();
      setIsResizingHeight(true);

      const startY = e.clientY;
      const initialH = timelineHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const newH = Math.round(
          Math.max(
            minTimelineHeight,
            Math.min(maxTimelineHeight, initialH - deltaY),
          ),
        );
        setUserTimelineHeight(newH);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        setIsResizingHeight(false);
        if (typeof window.removeEventListener === "function") {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
        }
        if (
          Platform.OS === "web" &&
          typeof window !== "undefined" &&
          window.localStorage
        ) {
          try {
            const finalDeltaY = upEvent.clientY - startY;
            const finalH = Math.round(
              Math.max(
                minTimelineHeight,
                Math.min(maxTimelineHeight, initialH - finalDeltaY),
              ),
            );
            window.localStorage.setItem(
              "fastart_timeline_height",
              String(finalH),
            );
          } catch (_) {}
        }
      };

      if (typeof window.addEventListener === "function") {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
      }
    },
    [timelineHeight, minTimelineHeight, maxTimelineHeight],
  );

  const handleResetResizeHeight = useCallback(() => {
    setUserTimelineHeight(null);
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        window.localStorage.removeItem("fastart_timeline_height");
      } catch (_) {}
    }
    soundEngine.playSfx("pop");
  }, []);

  const touchStartYRef = useRef<number>(0);
  const touchStartHeightRef = useRef<number>(0);

  const handleResizeTouchStart = useCallback(
    (e: any) => {
      const touch = e.nativeEvent.touches?.[0] || e.nativeEvent;
      touchStartYRef.current = touch.pageY;
      touchStartHeightRef.current = timelineHeight;
      setIsResizingHeight(true);
    },
    [timelineHeight],
  );

  const handleResizeTouchMove = useCallback(
    (e: any) => {
      if (!isResizingHeight) return;
      const touch = e.nativeEvent.touches?.[0] || e.nativeEvent;
      const deltaY = touch.pageY - touchStartYRef.current;
      const newH = Math.round(
        Math.max(
          minTimelineHeight,
          Math.min(maxTimelineHeight, touchStartHeightRef.current - deltaY),
        ),
      );
      setUserTimelineHeight(newH);
    },
    [isResizingHeight, minTimelineHeight, maxTimelineHeight],
  );

  const handleResizeTouchEnd = useCallback(() => {
    setIsResizingHeight(false);
    if (userTimelineHeight !== null) {
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        window.localStorage
      ) {
        try {
          window.localStorage.setItem(
            "fastart_timeline_height",
            String(userTimelineHeight),
          );
        } catch (_) {}
      }
    }
  }, [userTimelineHeight]);

  return {
    timelineHeight,
    isResizingHeight,
    handleResizeMouseDown,
    handleResetResizeHeight,
    handleResizeTouchStart,
    handleResizeTouchMove,
    handleResizeTouchEnd,
  };
}
