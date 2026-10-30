import React from "react";
import { View, Text, TouchableOpacity, useWindowDimensions } from "react-native";
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
}

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
}) => {
  const { width } = useWindowDimensions();
  const isNarrow = width < 375;

  return (
    <View
      style={[
        styles.controlBar,
        isMobile && styles.controlBarCompact,
        fullscreen && styles.controlBarFullscreen,
      ]}
    >
      {/* Left: Timecode */}
      <View style={styles.controlGroupLeft}>
        <View style={[styles.timecodePill, isNarrow && { paddingHorizontal: 6, paddingVertical: 2.5 }]}>
          <Text style={[styles.timecodeText, isNarrow && { fontSize: 10.5 }]}>
            {formatTime(currentTime)}
            <Text style={[styles.timecodeTotalText, isNarrow && { fontSize: 10 }]}>
              {" "}
              / {formatTime(totalDuration)}
            </Text>
          </Text>
        </View>
      </View>

      {/* Center: Frame Step & Play / Pause Button */}
      <View
        style={styles.controlGroupCenter}
        pointerEvents="box-none"
      >
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
            color={showSafeZone ? THEME_COLORS.accent : THEME_COLORS.textMuted}
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
              color={hasPrevKeyframe ? THEME_COLORS.accent : THEME_COLORS.textMuted}
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
            color={hasKeyframeAtCurrentTime ? THEME_COLORS.accent : THEME_COLORS.textMuted}
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
              color={hasKeyframeAtCurrentTime ? "#FFFFFF" : THEME_COLORS.accent}
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
              color={hasNextKeyframe ? THEME_COLORS.accent : THEME_COLORS.textMuted}
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
  );
};

export const PlayerControlsBar = React.memo(PlayerControlsBarComponent);
export default PlayerControlsBar;
