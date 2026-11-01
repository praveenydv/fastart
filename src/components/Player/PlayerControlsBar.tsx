import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, useWindowDimensions, Platform } from "react-native";
import Slider from "@react-native-community/slider";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./PlayerStyles";
import { formatTime } from "./playerUtils";
import { THEME_COLORS } from "../../constants/designConstants";

interface PlayerControlsBarProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  stepFrame: (frames: number) => void;
  showSafeZone: boolean;
  setShowSafeZone: (show: boolean | ((prev: boolean) => boolean)) => void;
  hasKeyframeAtCurrentTime: boolean;
  handleKeyframePress: () => void;
  onOpenKeyframeModal?: () => void;
  hasPrevKeyframe?: boolean;
  hasNextKeyframe?: boolean;
  onJumpPrevKeyframe?: () => void;
  onJumpNextKeyframe?: () => void;
  hasKeyframesOnClip?: boolean;
  fullscreen: boolean;
  toggleFullscreen: () => void;
  isMobile: boolean;
  onSeek?: (time: number) => void;
}

const TimecodePill = React.memo<{
  currentTime: number;
  totalDuration: number;
  isNarrow: boolean;
}>(({ currentTime, totalDuration, isNarrow }) => {
  return (
    <View style={[styles.timecodePill, isNarrow && { paddingHorizontal: 6, paddingVertical: 2.5 }]}>
      <Text style={[styles.timecodeText, isNarrow && { fontSize: 10.5 }]}>
        {formatTime(currentTime)}
        <Text style={[styles.timecodeTotalText, isNarrow && { fontSize: 10 }]}>
          {" "}
          / {formatTime(totalDuration)}
        </Text>
      </Text>
    </View>
  );
});

/**
 * Compact Stereo VU Meter giving live broadcast visual audio feedback
 */
const StereoVuMeter = React.memo<{ isPlaying: boolean; isNarrow: boolean }>(
  ({ isPlaying, isNarrow }) => {
    if (isNarrow) return null;
    return (
      <View style={meterStyles.container} accessibilityLabel="Audio Level Meter">
        <View style={meterStyles.channelCol}>
          <View
            style={[
              meterStyles.barSegment,
              meterStyles.peakRed,
              isPlaying && { opacity: 0.2 },
            ]}
          />
          <View
            style={[
              meterStyles.barSegment,
              meterStyles.midAmber,
              isPlaying && { opacity: 0.8 },
            ]}
          />
          <View
            style={[
              meterStyles.barSegment,
              meterStyles.greenLevel,
              isPlaying && { opacity: 1 },
            ]}
          />
        </View>
        <View style={meterStyles.channelCol}>
          <View
            style={[
              meterStyles.barSegment,
              meterStyles.peakRed,
              isPlaying && { opacity: 0.15 },
            ]}
          />
          <View
            style={[
              meterStyles.barSegment,
              meterStyles.midAmber,
              isPlaying && { opacity: 0.75 },
            ]}
          />
          <View
            style={[
              meterStyles.barSegment,
              meterStyles.greenLevel,
              isPlaying && { opacity: 0.95 },
            ]}
          />
        </View>
      </View>
    );
  }
);

const meterStyles = {
  container: {
    flexDirection: "row" as const,
    gap: 2,
    height: 16,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#16171B",
    borderWidth: 1,
    borderColor: "#25262D",
    alignItems: "flex-end" as const,
    justifyContent: "center" as const,
  },
  channelCol: {
    width: 3,
    height: "100%" as const,
    flexDirection: "column-reverse" as const,
    gap: 1.5,
    justifyContent: "flex-start" as const,
  },
  barSegment: {
    width: 3,
    height: 3,
    borderRadius: 0.5,
    opacity: 0.25,
  },
  greenLevel: {
    backgroundColor: "#10B981",
  },
  midAmber: {
    backgroundColor: "#F59E0B",
  },
  peakRed: {
    backgroundColor: "#EF4444",
  },
};

const PlayerControlsBarComponent: React.FC<PlayerControlsBarProps> = ({
  currentTime,
  totalDuration,
  isPlaying,
  onTogglePlay,
  stepFrame,
  showSafeZone,
  setShowSafeZone,
  hasKeyframeAtCurrentTime,
  handleKeyframePress,
  onOpenKeyframeModal,
  hasPrevKeyframe,
  hasNextKeyframe,
  onJumpPrevKeyframe,
  onJumpNextKeyframe,
  hasKeyframesOnClip,
  fullscreen,
  toggleFullscreen,
  isMobile,
  onSeek,
}) => {
  const { width } = useWindowDimensions();
  const isNarrow = width < 375;

  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(currentTime);
  const isDraggingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const lastSeekTimeRef = useRef(0);
  const rafSeekRef = useRef<number | null>(null);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafSeekRef.current) {
        cancelAnimationFrame(rafSeekRef.current);
      }
    };
  }, []);

  const handleSlidingStart = useCallback(
    (val: number) => {
      isDraggingRef.current = true;
      setIsDragging(true);
      setDragValue(val);
      wasPlayingRef.current = isPlaying;
      if (isPlaying) {
        onTogglePlay();
      }
    },
    [isPlaying, onTogglePlay]
  );

  const handleSliderValueChange = useCallback(
    (val: number) => {
      if (!isDraggingRef.current) return;
      setDragValue(val);
      const now = Date.now();
      if (now - lastSeekTimeRef.current > 32) {
        lastSeekTimeRef.current = now;
        onSeek?.(val);
      } else if (!rafSeekRef.current) {
        rafSeekRef.current = requestAnimationFrame(() => {
          rafSeekRef.current = null;
          if (isDraggingRef.current) {
            onSeek?.(val);
          }
        });
      }
    },
    [onSeek]
  );

  const handleSlidingComplete = useCallback(
    (val: number) => {
      if (rafSeekRef.current) {
        cancelAnimationFrame(rafSeekRef.current);
        rafSeekRef.current = null;
      }
      isDraggingRef.current = false;
      setIsDragging(false);
      setDragValue(val);
      onSeek?.(val);
      if (wasPlayingRef.current) {
        onTogglePlay();
      }
    },
    [onSeek, onTogglePlay]
  );

  const maxDur = Math.max(0.1, totalDuration);
  const displayVal = isDragging ? dragValue : currentTime;
  const progressPercent =
    maxDur > 0 ? Math.max(0, Math.min(100, (displayVal / maxDur) * 100)) : 0;

  return (
    <View
      style={[
        styles.controlBar,
        isMobile && styles.controlBarCompact,
        fullscreen && styles.controlBarFullscreen,
      ]}
    >
      {/* Draggable Progress Slider in Fullscreen View */}
      {fullscreen && (
        <View style={styles.fullscreenSliderContainer}>
          {isDragging && (
            <View
              style={[
                styles.sliderTooltip,
                { left: `${Math.max(4, Math.min(96, progressPercent))}%` },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.sliderTooltipText}>
                {formatTime(dragValue)}
              </Text>
            </View>
          )}
          <Slider
            style={[
              styles.fullscreenSlider,
              totalDuration <= 0 && { opacity: 0.35 },
              Platform.OS === "web"
                ? ({ cursor: "pointer" } as any)
                : undefined,
            ]}
            value={displayVal}
            minimumValue={0}
            maximumValue={maxDur}
            step={0}
            minimumTrackTintColor={THEME_COLORS.accent}
            maximumTrackTintColor="rgba(255, 255, 255, 0.22)"
            thumbTintColor={THEME_COLORS.accent}
            disabled={totalDuration <= 0}
            tapToSeek={true}
            onSlidingStart={handleSlidingStart}
            onValueChange={handleSliderValueChange}
            onSlidingComplete={handleSlidingComplete}
          />
        </View>
      )}

      {/* Controls Buttons Row */}
      <View
        style={
          fullscreen ? styles.fullscreenButtonsRow : styles.normalControlsRow
        }
      >
        {/* Left: Timecode & Stereo VU Meter */}
        <View style={styles.controlGroupLeft}>
          <TimecodePill
            currentTime={isDragging ? dragValue : currentTime}
            totalDuration={totalDuration}
            isNarrow={isNarrow}
          />
          <StereoVuMeter isPlaying={isPlaying} isNarrow={isNarrow} />
        </View>

        {/* Center: Frame Step & Play / Pause Button */}
        <View style={styles.controlGroupCenter} pointerEvents="box-none">
          {!isNarrow && (
            <TouchableOpacity
              style={[
                styles.stepBtn,
                isMobile && styles.stepBtnMobile,
                totalDuration <= 0 && { opacity: 0.3 },
              ]}
              onPress={() => {
                if (totalDuration <= 0) return;
                stepFrame(-1);
              }}
              disabled={totalDuration <= 0}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Previous Frame"
            >
              <Ionicons
                name="play-skip-back"
                size={isMobile ? 12 : 14}
                color={THEME_COLORS.textMuted}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.playPauseBtn,
              isMobile && styles.playPauseBtnMobile,
              totalDuration <= 0 && { opacity: 0.4 },
            ]}
            onPress={onTogglePlay}
            disabled={totalDuration <= 0}
            activeOpacity={0.85}
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={isMobile ? 16 : 18}
              color="#000000"
              style={!isPlaying ? { marginLeft: 1.5 } : undefined}
            />
          </TouchableOpacity>

          {!isNarrow && (
            <TouchableOpacity
              style={[
                styles.stepBtn,
                isMobile && styles.stepBtnMobile,
                totalDuration <= 0 && { opacity: 0.3 },
              ]}
              onPress={() => {
                if (totalDuration <= 0) return;
                stepFrame(1);
              }}
              disabled={totalDuration <= 0}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Next Frame"
            >
              <Ionicons
                name="play-skip-forward"
                size={isMobile ? 12 : 14}
                color={THEME_COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Right: Keyframe, Grid, Fullscreen */}
        <View style={styles.controlGroupRight}>
          <TouchableOpacity
            style={[styles.smallBtn, showSafeZone && styles.smallBtnActive]}
            onPress={() => setShowSafeZone((prev) => !prev)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel="Toggle Safe Zone Grid"
          >
            <Ionicons
              name="grid-outline"
              size={15}
              color={
                showSafeZone ? THEME_COLORS.accent : THEME_COLORS.textMuted
              }
            />
          </TouchableOpacity>

          {/* Jump to Previous Keyframe */}
          {hasKeyframesOnClip && (
            <TouchableOpacity
              style={[styles.smallBtn, !hasPrevKeyframe && { opacity: 0.3 }]}
              onPress={onJumpPrevKeyframe}
              disabled={!hasPrevKeyframe}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityLabel="Previous Keyframe"
            >
              <Ionicons
                name="caret-back"
                size={13}
                color={
                  hasPrevKeyframe
                    ? THEME_COLORS.accent
                    : THEME_COLORS.textMuted
                }
              />
            </TouchableOpacity>
          )}

          {/* Toggle Keyframe at Playhead */}
          <TouchableOpacity
            style={[
              styles.smallBtn,
              styles.keyframeBtn,
              hasKeyframeAtCurrentTime && styles.keyframeActive,
            ]}
            onPress={handleKeyframePress}
            onLongPress={onOpenKeyframeModal}
            delayLongPress={350}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityLabel="Keyframe Toggle"
          >
            <Ionicons
              name={hasKeyframeAtCurrentTime ? "diamond" : "diamond-outline"}
              size={15}
              color={
                hasKeyframeAtCurrentTime
                  ? THEME_COLORS.accent
                  : THEME_COLORS.textMuted
              }
            />
            <View
              style={[
                styles.kfBadgeIcon,
                hasKeyframeAtCurrentTime
                  ? styles.kfBadgeIconRemove
                  : styles.kfBadgeIconAdd,
              ]}
            >
              <Ionicons
                name={hasKeyframeAtCurrentTime ? "remove" : "add"}
                size={6}
                color={
                  hasKeyframeAtCurrentTime ? "#FFFFFF" : THEME_COLORS.accent
                }
              />
            </View>
          </TouchableOpacity>

          {/* Jump to Next Keyframe */}
          {hasKeyframesOnClip && (
            <TouchableOpacity
              style={[styles.smallBtn, !hasNextKeyframe && { opacity: 0.3 }]}
              onPress={onJumpNextKeyframe}
              disabled={!hasNextKeyframe}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityLabel="Next Keyframe"
            >
              <Ionicons
                name="caret-forward"
                size={13}
                color={
                  hasNextKeyframe
                    ? THEME_COLORS.accent
                    : THEME_COLORS.textMuted
                }
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.smallBtn, fullscreen && styles.smallBtnActive]}
            onPress={toggleFullscreen}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel={
              fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"
            }
          >
            <Ionicons
              name={fullscreen ? "contract-outline" : "expand-outline"}
              size={14}
              color={fullscreen ? THEME_COLORS.accent : THEME_COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const PlayerControlsBar = React.memo(PlayerControlsBarComponent);
export default PlayerControlsBar;
