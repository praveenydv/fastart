import React, { useRef, useEffect, useState } from "react";
import { View, Text, Platform } from "react-native";
import { styles } from "./TimelineStyles";
import { formatPlayheadTime } from "./timelineUtils";
import { playheadCoordinator } from "../../utils/playheadCoordinator";
import { getPlaybackTime } from "../../utils/playbackTimeStore";

export interface TimelinePlayheadHeadProps {
  pxPerSec: number;
  isScrubbingRuler: boolean;
  playheadPanResponder: any;
  handlePlayheadPointerDown: any;
}

export const TimelinePlayheadHead: React.FC<TimelinePlayheadHeadProps> = React.memo(
  ({
    pxPerSec,
    isScrubbingRuler,
    playheadPanResponder,
    handlePlayheadPointerDown,
  }) => {
    const headRef = useRef<any>(null);
    const [scrubTime, setScrubTime] = useState(getPlaybackTime);
    const pxPerSecRef = useRef(pxPerSec);
    pxPerSecRef.current = pxPerSec;

    useEffect(() => {
      return playheadCoordinator.subscribe((time) => {
        if (isScrubbingRuler) setScrubTime(time);
        const x = time * pxPerSecRef.current;
        if (Platform.OS === "web") {
          const domNode = headRef.current?._inputRef || headRef.current;
          if (domNode && domNode.style) {
            domNode.style.transform = `translate3d(${x}px, 0, 0)`;
          }
        } else if (headRef.current && typeof headRef.current.setNativeProps === "function") {
          headRef.current.setNativeProps({
            style: { transform: [{ translateX: x }] },
          });
        }
      });
    }, [isScrubbingRuler]);

    const currentTime = isScrubbingRuler ? scrubTime : getPlaybackTime();

    return (
      <View
        ref={headRef}
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
TimelinePlayheadHead.displayName = "TimelinePlayheadHead";

export interface TimelinePlayheadNeedleProps {
  pxPerSec: number;
  isScrubbingRuler: boolean;
}

export const TimelinePlayheadNeedle: React.FC<TimelinePlayheadNeedleProps> = React.memo(
  ({ pxPerSec, isScrubbingRuler }) => {
    const needleRef = useRef<any>(null);
    const currentTime = getPlaybackTime();
    const pxPerSecRef = useRef(pxPerSec);
    pxPerSecRef.current = pxPerSec;

    useEffect(() => {
      return playheadCoordinator.subscribe((time) => {
        const x = time * pxPerSecRef.current;
        if (Platform.OS === "web") {
          const domNode = needleRef.current?._inputRef || needleRef.current;
          if (domNode && domNode.style) {
            domNode.style.transform = `translate3d(${x}px, 0, 0)`;
          }
        } else if (needleRef.current && typeof needleRef.current.setNativeProps === "function") {
          needleRef.current.setNativeProps({
            style: { transform: [{ translateX: x }] },
          });
        }
      });
    }, []);

    return (
      <View
        ref={needleRef}
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
TimelinePlayheadNeedle.displayName = "TimelinePlayheadNeedle";

export interface TimelinePlayheadProps extends TimelinePlayheadHeadProps {
  showNeedle?: boolean;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  pxPerSec,
  isScrubbingRuler,
  playheadPanResponder,
  handlePlayheadPointerDown,
  showNeedle = true,
}) => {
  return (
    <>
      <TimelinePlayheadHead
        pxPerSec={pxPerSec}
        isScrubbingRuler={isScrubbingRuler}
        playheadPanResponder={playheadPanResponder}
        handlePlayheadPointerDown={handlePlayheadPointerDown}
      />
      {showNeedle && (
        <TimelinePlayheadNeedle
          pxPerSec={pxPerSec}
          isScrubbingRuler={isScrubbingRuler}
        />
      )}
    </>
  );
};

export default React.memo(TimelinePlayhead);
