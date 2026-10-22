export const formatPlayheadTime = (sec = 0): string => {
  const totalSecs = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

// Strict non-overlapping clamp: another item starts ONLY when the one before it ends
export function clampNonOverlapping(
  desiredStart: number,
  duration: number,
  otherClips: { id: string; startTime: number; duration: number }[],
): number {
  if (!otherClips || otherClips.length === 0) {
    return Math.max(0, desiredStart);
  }

  const sorted = [...otherClips].sort((a, b) => a.startTime - b.startTime);
  let start = Math.max(0, desiredStart);

  // Prevent overlapping with any existing clip on this track
  for (const c of sorted) {
    const cEnd = c.startTime + c.duration;
    const overlaps =
      start < cEnd - 0.01 && start + duration > c.startTime + 0.01;
    if (overlaps) {
      if (start + duration / 2 >= c.startTime + c.duration / 2) {
        start = cEnd;
      } else {
        const beforeStart = c.startTime - duration;
        if (beforeStart >= 0) {
          start = beforeStart;
        } else {
          start = cEnd;
        }
      }
    }
  }

  // Verification pass
  for (const c of sorted) {
    const cEnd = c.startTime + c.duration;
    if (start < cEnd - 0.01 && start + duration > c.startTime + 0.01) {
      start = cEnd;
    }
  }

  return Math.max(0, Number(start.toFixed(3)));
}

// Robust pointer & touch coordinate extractor for Web (mouse, touch, pointer) and React Native
export function getPointerCoords(e: any): { clientX: number; clientY: number } {
  if (!e) return { clientX: 0, clientY: 0 };
  const touches = e.touches || e.nativeEvent?.touches;
  if (touches && touches.length > 0) {
    return {
      clientX: touches[0].clientX ?? touches[0].pageX ?? 0,
      clientY: touches[0].clientY ?? touches[0].pageY ?? 0,
    };
  }
  const changed = e.changedTouches || e.nativeEvent?.changedTouches;
  if (changed && changed.length > 0) {
    return {
      clientX: changed[0].clientX ?? changed[0].pageX ?? 0,
      clientY: changed[0].clientY ?? changed[0].pageY ?? 0,
    };
  }
  return {
    clientX:
      e.clientX ?? e.nativeEvent?.clientX ?? e.pageX ?? e.nativeEvent?.pageX ?? 0,
    clientY:
      e.clientY ?? e.nativeEvent?.clientY ?? e.pageY ?? e.nativeEvent?.pageY ?? 0,
  };
}
