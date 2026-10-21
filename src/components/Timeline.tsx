import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TimelineProps,
  MAX_TRACKS,
  TRACK_ROW_HEIGHT,
  MIN_CLIP_DURATION,
} from "./Timeline/timelineTypes";
import { formatPlayheadTime, getPointerCoords } from "./Timeline/timelineUtils";
import { styles } from "./Timeline/TimelineStyles";
import { useTimelineClips } from "./Timeline/useTimelineClips";
import { useTimelineResize } from "./Timeline/useTimelineResize";
import { useTimelineScrubbing } from "./Timeline/useTimelineScrubbing";
import { useTimelineDragTrim } from "./Timeline/useTimelineDragTrim";
import { TimelineHeaderBar } from "./Timeline/TimelineHeaderBar";
import { TimelineTracksView } from "./Timeline/TimelineTracksView";

// Re-export constants and helpers for backwards-compatibility
export { MAX_TRACKS, TRACK_ROW_HEIGHT, MIN_CLIP_DURATION, formatPlayheadTime, getPointerCoords };

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  totalDuration,
  onSeek,
  selectedClipId,
  onSelectClip,
  onTrimClip,
  onMoveClip,
  onOpenTransitions,
  zoom,
  onZoomChange,
  onOpenEditModal,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const pxPerSec = Math.max(20, Math.min(1000, zoom));

  const scrollRef = useRef<any>(null);
  const containerRef = useRef<any>(null);
  const rulerRef = useRef<any>(null);

  // Clips and Tracks aggregation (first pass with empty drag state)
  const {
    allClipsWithTracks,
    trackRows,
    activeTrackCount,
    handleAddTrack,
    handleRemoveTrack,
  } = useTimelineClips({
    project,
    dragState: null,
    selectedClipId,
  });

  // User timeline height & resize logic
  const {
    timelineHeight,
    isResizingHeight,
    handleResizeMouseDown,
    handleResetResizeHeight,
    handleResizeTouchStart,
    handleResizeTouchMove,
    handleResizeTouchEnd,
  } = useTimelineResize({
    activeTrackCount,
    isMobile,
  });

  // Settings
  const isSnappingEnabled = (project as any)?.settings?.snapping !== false;
  const isHapticEnabled = (project as any)?.settings?.haptics !== false;

  // Scrubbing & seeking handlers
  const {
    isScrubbingRuler,
    playheadPanResponder,
    rulerPanResponder,
    handlePlayheadPointerDown,
  } = useTimelineScrubbing({
    currentTime,
    totalDuration,
    pxPerSec,
    allClips: allClipsWithTracks,
    isSnappingEnabled,
    isHapticEnabled,
    onSeek,
    rulerRef,
  });

  // Dragging and trimming handlers
  const {
    activeTrimming,
    activeTrimDelta,
    dragState,
    isDraggingClip,
    clipMovePanResponder,
    leftTrimPanResponder,
    rightTrimPanResponder,
    handleClipPress,
    handleClipLongPress,
    handleClipMouseDown,
    handleLeftTrimStart,
    handleRightTrimStart,
  } = useTimelineDragTrim({
    allClips: allClipsWithTracks,
    selectedClipId,
    activeTrackCount,
    pxPerSec,
    isSnappingEnabled,
    isHapticEnabled,
    onSelectClip,
    onOpenEditModal,
    onMoveClip,
    onTrimClip,
  });

  // Auto-scroll when playing
  useEffect(() => {
    if (!project?.isPlaying) return;
    const playheadX = currentTime * pxPerSec;
    const el = scrollRef.current;
    if (Platform.OS === "web") {
      const domNode = (el as any)?._inputRef || (el as any);
      if (domNode && domNode.scrollLeft !== undefined) {
        const viewW = domNode.clientWidth || screenWidth;
        const sLeft = domNode.scrollLeft;
        if (playheadX > sLeft + viewW - 120 || playheadX < sLeft) {
          domNode.scrollLeft = Math.max(0, playheadX - 60);
        }
      }
    } else if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ x: Math.max(0, playheadX - 60), animated: true });
    }
  }, [project?.isPlaying, currentTime, pxPerSec, screenWidth]);

  // Touch pinch-to-zoom
  const [isPinching, setIsPinching] = useState(false);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef<number>(pxPerSec);

  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent?.touches;
    if (touches && touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = pxPerSec;
      setIsPinching(true);
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.nativeEvent?.touches;
    if (touches && touches.length === 2 && pinchStartDist.current) {
      if (e.cancelable && e.preventDefault) e.preventDefault();
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const currentDist = Math.hypot(dx, dy);
      const ratio = currentDist / pinchStartDist.current;
      const newZoom = Math.max(
        20,
        Math.min(1000, Math.round(pinchStartZoom.current * ratio)),
      );
      onZoomChange(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchStartDist.current = null;
    setIsPinching(false);
  };

  // Active clip info for top bar
  const activeClipInfo = useMemo(() => {
    if (!selectedClipId) return null;
    const found = allClipsWithTracks.find((c) => c.id === selectedClipId);
    if (!found) return null;
    return {
      id: found.id,
      rawType: found.type,
      type: found.type.toUpperCase(),
      color: found.accentColor,
      title: found.title,
      start: found.startTime,
      duration: found.duration,
      trackIndex: found.effectiveTrackIndex,
    };
  }, [allClipsWithTracks, selectedClipId]);

  const isInteractingWithTimeline =
    isDraggingClip ||
    !!dragState ||
    !!activeTrimming ||
    isScrubbingRuler ||
    isPinching ||
    isResizingHeight;

  // Timeline horizontal content width
  const timelineContentWidth = Math.max(
    screenWidth,
    Math.max(10, totalDuration) * pxPerSec + 300,
  );

  // Generate ruler tick marks with adaptive density to prevent mobile DOM slowdown
  const ticks = useMemo(() => {
    const list: Array<{ time: number; label: string; isMajor: boolean }> = [];
    const maxDur = Math.max(10, totalDuration) + 3;
    const targetPxSpacing = 65;
    const minTimeStep = targetPxSpacing / pxPerSec;
    const candidateSteps = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const step = candidateSteps.find((s) => s >= minTimeStep) || 60;
    const totalTicks = Math.ceil(maxDur / step);
    const limit = Math.min(totalTicks, 180);

    for (let i = 0; i <= limit; i++) {
      const t = Number((i * step).toFixed(2));
      if (t > maxDur) break;
      const sec = Math.floor(t);
      const ms = Math.round((t - sec) * 1000);
      let label: string;
      let isMajor = false;
      if (step < 1) {
        isMajor = Math.abs(t - Math.round(t)) < 0.001;
        label = isMajor ? `${sec}s` : `.${Math.floor(ms / 100)}`;
      } else {
        isMajor = t % (step * 5) < 0.01 || t === 0;
        const mins = Math.floor(sec / 60);
        const remSecs = sec % 60;
        label =
          mins > 0
            ? `${mins}:${remSecs.toString().padStart(2, "0")}`
            : `${sec}s`;
      }
      list.push({ time: t, label, isMajor });
    }
    return list;
  }, [totalDuration, pxPerSec]);

  // Memoize rendered tick marks to prevent re-evaluations during active playback
  const renderedTicks = useMemo(() => {
    return ticks.map((tk, i) => (
      <View
        key={i}
        style={[styles.tickWrapper, { left: tk.time * pxPerSec }]}
      >
        <View
          style={[styles.tickLine, tk.isMajor ? styles.tickLineMajor : null]}
        />
        <Text style={[styles.tickText, tk.isMajor && styles.tickTextMajor]}>
          {tk.label}
        </Text>
      </View>
    ));
  }, [ticks, pxPerSec]);

  // Left track header cells
  const renderedTrackHeaders = useMemo(() => {
    return trackRows.map((_, idx) => (
      <View key={idx} style={styles.trackHeaderCellUniversal}>
        <View style={styles.trackHeaderLabelBox}>
          <Text style={styles.trackHeaderLabelUniversal}>
            {isMobile ? `T${idx + 1}` : `Track ${idx + 1}`}
          </Text>
        </View>
      </View>
    ));
  }, [trackRows, isMobile]);

  return (
    <View
      ref={containerRef}
      style={[styles.container, { height: timelineHeight }]}
      onMoveShouldSetResponder={(e) =>
        (e.nativeEvent?.touches?.length || 0) === 2
      }
      onResponderGrant={handleTouchStart}
      onResponderMove={handleTouchMove}
      onResponderRelease={handleTouchEnd}
      onResponderTerminate={handleTouchEnd}
    >
      {/* Top Preference & Active Clip Info Bar */}
      <TimelineHeaderBar
        isResizingHeight={isResizingHeight}
        handleResizeMouseDown={handleResizeMouseDown}
        handleResetResizeHeight={handleResetResizeHeight}
        handleResizeTouchStart={handleResizeTouchStart}
        handleResizeTouchMove={handleResizeTouchMove}
        handleResizeTouchEnd={handleResizeTouchEnd}
        isMobile={isMobile}
        activeClipInfo={activeClipInfo}
        pxPerSec={pxPerSec}
        onZoomChange={onZoomChange}
      />

      {/* Synchronized Vertical Scroll for all tracks */}
      <ScrollView
        style={[
          styles.timelineVerticalScroll,
          {
            touchAction: isInteractingWithTimeline ? "none" : "pan-y",
          } as any,
        ]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isInteractingWithTimeline}
      >
        <View style={styles.timelineBody}>
          {/* General Left Track Headers Column */}
          <View
            style={[
              styles.leftHeadersColumn,
              isMobile && styles.leftHeadersColumnMobile,
            ]}
          >
            <View style={styles.rulerCornerHeader}>
              <Ionicons name="time-outline" size={11} color="#6B7280" />
            </View>

            {renderedTrackHeaders}

            {activeTrackCount < MAX_TRACKS && (
              <TouchableOpacity
                style={styles.addTrackLeftColumnBtn}
                onPress={handleAddTrack}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={12} color="#00F2FE" />
                {!isMobile && (
                  <Text style={styles.addTrackLeftColumnText}>Track</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Scrollable Timeline Canvas */}
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!isInteractingWithTimeline}
            style={[
              styles.timelineScroll,
              {
                touchAction: isInteractingWithTimeline ? "none" : "pan-x",
              } as any,
            ]}
            contentContainerStyle={styles.timelineContent}
          >
            <TimelineTracksView
              trackRows={trackRows}
              activeTrackCount={activeTrackCount}
              timelineContentWidth={timelineContentWidth}
              rulerRef={rulerRef}
              rulerPanResponder={rulerPanResponder}
              renderedTicks={renderedTicks}
              selectedClipId={selectedClipId}
              currentTime={currentTime}
              pxPerSec={pxPerSec}
              activeTrimming={activeTrimming}
              activeTrimDelta={activeTrimDelta}
              dragState={dragState}
              isScrubbingRuler={isScrubbingRuler}
              onSelectClip={onSelectClip}
              onOpenTransitions={onOpenTransitions}
              handleRemoveTrack={handleRemoveTrack}
              handleClipPress={handleClipPress}
              handleClipLongPress={handleClipLongPress}
              handleClipMouseDown={handleClipMouseDown}
              leftTrimPanResponder={leftTrimPanResponder}
              rightTrimPanResponder={rightTrimPanResponder}
              clipMovePanResponder={clipMovePanResponder}
              playheadPanResponder={playheadPanResponder}
              handlePlayheadPointerDown={handlePlayheadPointerDown}
              handleLeftTrimStart={handleLeftTrimStart}
              handleRightTrimStart={handleRightTrimStart}
              onOpenEditModal={onOpenEditModal}
            />
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

export default Timeline;
