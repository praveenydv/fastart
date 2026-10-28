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
import { soundEngine } from "../utils/audioEngine";
import { useTimelineClips } from "./Timeline/useTimelineClips";
import { useTimelineResize } from "./Timeline/useTimelineResize";
import { useTimelineScrubbing } from "./Timeline/useTimelineScrubbing";
import { useTimelineDragTrim } from "./Timeline/useTimelineDragTrim";
import { TimelineHeaderBar } from "./Timeline/TimelineHeaderBar";
import { TimelineTracksView } from "./Timeline/TimelineTracksView";
import TimelinePlayhead from "./Timeline/TimelinePlayhead";
import { THEME_COLORS } from "../constants/designConstants";

// Re-export constants and helpers for backwards-compatibility
export {
  MAX_TRACKS,
  TRACK_ROW_HEIGHT,
  MIN_CLIP_DURATION,
  formatPlayheadTime,
  getPointerCoords,
};

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  totalDuration,
  isPlaying,
  onSeek,
  selectedClipId,
  onSelectClip,
  onTrimClip,
  onMoveClip,
  onOpenTransitions,
  zoom,
  onZoomChange,
  selectedClipType,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onFreezeFrame,
  onToggleReverse,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onTimelineHeightChange,
  onOpenEditModal,
  onUpdateProject,
  onAddMedia,
  onAddAudio,
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
    onUpdateProject,
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

  useEffect(() => {
    if (onTimelineHeightChange) {
      onTimelineHeightChange(timelineHeight);
    }
  }, [timelineHeight, onTimelineHeightChange]);

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
    handleClipTouchStart,
    handleClipTouchMove,
    handleClipTouchEnd,
    handleClipTouchCancel,
    handleLeftTrimStart,
    handleRightTrimStart,
  } = useTimelineDragTrim({
    allClips: allClipsWithTracks,
    selectedClipId,
    activeTrackCount,
    pxPerSec,
    isSnappingEnabled,
    isHapticEnabled,
    currentTime,
    onSeek,
    onSelectClip,
    onOpenEditModal,
    onMoveClip,
    onTrimClip,
  });

  const currentScrollXRef = useRef(0);

  // Auto-scroll when playing (only scroll when playhead approaches screen edge to avoid 60fps stutter)
  useEffect(() => {
    if (!isPlaying && !project?.isPlaying) return;
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
      const sLeft = currentScrollXRef.current;
      const viewW = screenWidth - (isMobile ? 55 : 80);
      if (playheadX > sLeft + viewW - 100 || playheadX < sLeft) {
        el.scrollTo({ x: Math.max(0, playheadX - 60), animated: false });
      }
    }
  }, [project?.isPlaying, currentTime, pxPerSec, screenWidth, isMobile]);

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

  // Memoize rendered tick marks and beat markers to prevent re-evaluations during active playback
  const renderedTicks = useMemo(() => {
    return (
      <>
        {ticks.map((tk, i) => (
          <View
            key={i}
            style={[styles.tickWrapper, { left: tk.time * pxPerSec }]}
          >
            <View
              style={[
                styles.tickLine,
                tk.isMajor ? styles.tickLineMajor : null,
              ]}
            />
            <Text style={[styles.tickText, tk.isMajor && styles.tickTextMajor]}>
              {tk.label}
            </Text>
          </View>
        ))}
        {project?.beatMarkers &&
          project.beatMarkers.map((beatTime, idx) => (
            <View
              key={`beat-${idx}`}
              style={{
                position: "absolute",
                left: beatTime * pxPerSec - 3,
                top: 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: "#FFE600",
                zIndex: 10,
              }}
            />
          ))}
      </>
    );
  }, [ticks, pxPerSec, project?.beatMarkers]);

  // Left track header cells (stable layout with ZERO layout displacement)
  const renderedTrackHeaders = useMemo(() => {
    const headers: React.ReactNode[] = [];

    trackRows.forEach((_rowClips, idx) => {
      const isSeamActive =
        dragState?.isInsertingNewTrack && dragState?.insertTrackIndex === idx;

      headers.push(
        <View
          key={`track-header-${idx}`}
          style={styles.trackHeaderCellUniversal}
        >
          {/* Inter-Track Boundary Seam Indicator between headers */}
          {isSeamActive && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -7,
                left: 2,
                right: 2,
                height: 14,
                backgroundColor: THEME_COLORS.background,
                borderColor: THEME_COLORS.accent,
                borderWidth: 1.5,
                borderRadius: 7,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                gap: 2,
                ...(Platform.OS === "web"
                  ? {
                      boxShadow: `0 0 8px ${THEME_COLORS.cyanBorder}`,
                    }
                  : {}),
              }}
            >
              <Ionicons name="add" size={10} color={THEME_COLORS.accent} />
              <Text style={{ color: THEME_COLORS.accent, fontSize: 9, fontWeight: "800" }}>
                New
              </Text>
            </View>
          )}

          <View style={styles.trackHeaderLabelBox}>
            <Text style={styles.trackHeaderLabelUniversal}>
              {`T${idx + 1}`}
            </Text>
          </View>
        </View>,
      );
    });

    // Bottom new track header preview when dragging clip (only if track just above it is not empty)
    const isLastTrackEmpty =
      trackRows.length > 0 &&
      (trackRows[trackRows.length - 1].length === 0 ||
        (trackRows[trackRows.length - 1].length === 1 &&
          trackRows[trackRows.length - 1][0].id === dragState?.clipId));

    if (dragState && activeTrackCount < 10 && !isLastTrackEmpty) {
      const isBottomActive =
        dragState.isInsertingNewTrack &&
        (dragState.insertTrackIndex === null ||
          dragState.insertTrackIndex === undefined ||
          dragState.insertTrackIndex >= trackRows.length);

      headers.push(
        <View
          key="insert-header-bottom"
          style={[
            styles.trackHeaderCellUniversal,
            {
              borderColor: isBottomActive ? THEME_COLORS.accent : THEME_COLORS.cyanBorder,
              borderWidth: 1.5,
              borderStyle: "dashed",
              backgroundColor: isBottomActive
                ? THEME_COLORS.cyanBg
                : "transparent",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              ...(Platform.OS === "web"
                ? {
                    transition: "all 0.18s ease",
                  }
                : {}),
            },
          ]}
        >
          <Ionicons
            name="add"
            size={12}
            color={isBottomActive ? THEME_COLORS.accent : THEME_COLORS.textMuted}
          />
          <Text
            style={[
              styles.trackHeaderLabelUniversal,
              {
                color: isBottomActive ? THEME_COLORS.accent : THEME_COLORS.textMuted,
                fontWeight: "700",
              },
            ]}
          >
            {isMobile ? `+T` : "New"}
          </Text>
        </View>,
      );
    }

    return headers;
  }, [
    trackRows,
    isMobile,
    dragState?.isInsertingNewTrack,
    dragState?.insertTrackIndex,
    !!dragState,
    activeTrackCount,
    handleRemoveTrack,
  ]);

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
        onDeselectClip={() => onSelectClip("", "video")}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onSplitClip={onSplitClip}
        onDeleteClip={onDeleteClip}
        onFreezeFrame={onFreezeFrame}
        onToggleReverse={onToggleReverse}
        hasSelectedClip={Boolean(selectedClipId)}
        selectedClipType={selectedClipType}
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
                <Ionicons name="add" size={12} color={THEME_COLORS.accent} />
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
            scrollEventThrottle={16}
            onScroll={(e) => {
              currentScrollXRef.current = e.nativeEvent.contentOffset.x;
            }}
            style={[
              styles.timelineScroll,
              {
                touchAction: isInteractingWithTimeline ? "none" : "pan-x",
              } as any,
            ]}
            contentContainerStyle={styles.timelineContent}
          >
            <View
              style={{ width: timelineContentWidth, position: "relative" }}
              {...(Platform.OS === "web"
                ? {
                    onDragOver: (e: any) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                    },
                    onDrop: (e: any) => {
                      e.preventDefault();
                      try {
                        const raw = e.dataTransfer.getData("application/fastart-clip");
                        if (!raw) return;
                        const data = JSON.parse(raw);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const dropX = Math.max(0, e.clientX - rect.left);
                        const dropTime = Math.max(0, dropX / pxPerSec);
                        soundEngine.playSfx("whoosh");
                        if (data.type === "media" && onAddMedia) {
                          onAddMedia({
                            ...data.clip,
                            id: `clip-${Date.now()}`,
                            startTime: dropTime,
                          });
                        } else if (data.type === "audio" && onAddAudio) {
                          onAddAudio({
                            ...data.clip,
                            id: `audio-${Date.now()}`,
                            startTime: dropTime,
                          });
                        }
                      } catch (err) {
                        console.error("Drop failed:", err);
                      }
                    },
                  }
                : {})}
            >
              <TimelineTracksView
                trackRows={trackRows}
                activeTrackCount={activeTrackCount}
                timelineContentWidth={timelineContentWidth}
                rulerRef={rulerRef}
                rulerPanResponder={rulerPanResponder}
                renderedTicks={renderedTicks}
                selectedClipId={selectedClipId}
                pxPerSec={pxPerSec}
                activeTrimming={activeTrimming}
                activeTrimDelta={activeTrimDelta}
                dragState={dragState}
                onSelectClip={onSelectClip}
                onOpenTransitions={onOpenTransitions}
                handleRemoveTrack={handleRemoveTrack}
                handleClipPress={handleClipPress}
                handleClipLongPress={handleClipLongPress}
                handleClipMouseDown={handleClipMouseDown}
                handleClipTouchStart={handleClipTouchStart}
                handleClipTouchMove={handleClipTouchMove}
                handleClipTouchEnd={handleClipTouchEnd}
                handleClipTouchCancel={handleClipTouchCancel}
                leftTrimPanResponder={leftTrimPanResponder}
                rightTrimPanResponder={rightTrimPanResponder}
                clipMovePanResponder={clipMovePanResponder}
                handleLeftTrimStart={handleLeftTrimStart}
                handleRightTrimStart={handleRightTrimStart}
                onOpenEditModal={onOpenEditModal}
              />

              <TimelinePlayhead
                currentTime={currentTime}
                pxPerSec={pxPerSec}
                isScrubbingRuler={isScrubbingRuler}
                playheadPanResponder={playheadPanResponder}
                handlePlayheadPointerDown={handlePlayheadPointerDown}
              />
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

export default React.memo(Timeline);
