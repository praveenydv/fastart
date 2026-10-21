import React from "react";
import { View, Text, Platform } from "react-native";
import { styles } from "./TimelineStyles";
import { formatPlayheadTime } from "./timelineUtils";

interface TimelinePlayheadProps {
  currentTime: number;
  pxPerSec: number;
  isScrubbingRuler: boolean;
  playheadPanResponder: any;
  handlePlayheadPointerDown: any;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  currentTime,
  pxPerSec,
  isScrubbingRuler,
  playheadPanResponder,
  handlePlayheadPointerDown,
}) => {
  return (
    <View
      style={[
        styles.playheadLine,
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
      {/* Floating real-time timecode badge while dragging */}
      {isScrubbingRuler && (
        <View style={styles.playheadTimePill}>
          <Text style={styles.playheadTimeText} numberOfLines={1}>
            {formatPlayheadTime(currentTime)}
          </Text>
        </View>
      )}

      <View
        style={styles.playheadHeadBox}
        pointerEvents="auto"
        {...(Platform.OS !== "web"
          ? playheadPanResponder.panHandlers
          : {
              onMouseDown: handlePlayheadPointerDown,
              onTouchStart: handlePlayheadPointerDown,
            })}
      >
        <View
          style={[
            styles.diamondShape,
            isScrubbingRuler && styles.diamondShapeActive,
          ]}
        />
      </View>

      <View
        style={[
          styles.playheadNeedle,
          isScrubbingRuler && styles.playheadNeedleActive,
        ]}
        pointerEvents="none"
      />
    </View>
  );
};

export default React.memo(TimelinePlayhead);
