import React from "react";
import { View, Text, Platform } from "react-native";
import { styles } from "./TimelineStyles";
import { formatPlayheadTime } from "./timelineUtils";

export interface TimelinePlayheadHeadProps {
  currentTime: number;
  pxPerSec: number;
  isScrubbingRuler: boolean;
  playheadPanResponder: any;
  handlePlayheadPointerDown: any;
}

export const TimelinePlayheadHead: React.FC<TimelinePlayheadHeadProps> = React.memo(
  ({
    currentTime,
    pxPerSec,
    isScrubbingRuler,
    playheadPanResponder,
    handlePlayheadPointerDown,
  }) => {
    return (
      <View
        style={[
          styles.playheadHeadInRuler,
          {
            left: 0,
            transform: [{ translateX: currentTime * pxPerSec }],
            ...(Platform.OS === "web"
              ? {
                  willChange: "transform",
                  transform: `translate3d(${currentTime * pxPerSec}px, 0, 0)`,
                }
              : {}),
          } as any,
        ]}
        pointerEvents="auto"
        {...(Platform.OS !== "web"
          ? playheadPanResponder.panHandlers
          : {
              onMouseDown: handlePlayheadPointerDown,
              onTouchStart: handlePlayheadPointerDown,
            })}
      >
        {/* Floating real-time timecode badge while dragging */}
        {isScrubbingRuler && (
          <View style={styles.playheadTimePill}>
            <Text style={styles.playheadTimeText} numberOfLines={1}>
              {formatPlayheadTime(currentTime)}
            </Text>
          </View>
        )}

        <View style={styles.playheadHeadBox}>
          <View
            style={[
              styles.diamondShape,
              isScrubbingRuler && styles.diamondShapeActive,
            ]}
          />
        </View>
      </View>
    );
  },
);

export interface TimelinePlayheadNeedleProps {
  currentTime: number;
  pxPerSec: number;
  isScrubbingRuler: boolean;
}

export const TimelinePlayheadNeedle: React.FC<TimelinePlayheadNeedleProps> = React.memo(
  ({ currentTime, pxPerSec, isScrubbingRuler }) => {
    return (
      <View
        style={[
          styles.playheadNeedleLine,
          {
            left: 0,
            transform: [{ translateX: currentTime * pxPerSec }],
            ...(Platform.OS === "web"
              ? {
                  willChange: "transform",
                  transform: `translate3d(${currentTime * pxPerSec}px, 0, 0)`,
                }
              : {}),
          } as any,
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.playheadNeedle,
            isScrubbingRuler && styles.playheadNeedleActive,
          ]}
          pointerEvents="none"
        />
      </View>
    );
  },
);

export interface TimelinePlayheadProps extends TimelinePlayheadHeadProps {
  showNeedle?: boolean;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  currentTime,
  pxPerSec,
  isScrubbingRuler,
  playheadPanResponder,
  handlePlayheadPointerDown,
  showNeedle = true,
}) => {
  return (
    <>
      <TimelinePlayheadHead
        currentTime={currentTime}
        pxPerSec={pxPerSec}
        isScrubbingRuler={isScrubbingRuler}
        playheadPanResponder={playheadPanResponder}
        handlePlayheadPointerDown={handlePlayheadPointerDown}
      />
      {showNeedle && (
        <TimelinePlayheadNeedle
          currentTime={currentTime}
          pxPerSec={pxPerSec}
          isScrubbingRuler={isScrubbingRuler}
        />
      )}
    </>
  );
};

export default React.memo(TimelinePlayhead);
