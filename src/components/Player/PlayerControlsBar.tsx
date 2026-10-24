import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./PlayerStyles";
import { formatTime } from "./playerUtils";

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
  fullscreen,
  toggleFullscreen,
  isMobile,
}) => {
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
        <View style={styles.timecodePill}>
          <Text style={styles.timecodeText}>
            {formatTime(currentTime)}
            <Text style={styles.timecodeTotalText}>
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
            size={isMobile ? 12 : 13}
            color="#8E8E93"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.playPauseBtn,
            isMobile && styles.playPauseBtnMobile,
            totalDuration <= 0 && { opacity: 0.4 },
          ]}
          onPress={onTogglePlay}
          disabled={totalDuration <= 0}
          activeOpacity={0.8}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={isMobile ? 15 : 17}
            color="#FFFFFF"
            style={!isPlaying ? { marginLeft: 1.5 } : undefined}
          />
        </TouchableOpacity>

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
            size={isMobile ? 12 : 13}
            color="#8E8E93"
          />
        </TouchableOpacity>
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
            size={14}
            color={showSafeZone ? "#00E5FF" : "#8E8E93"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.smallBtn,
            styles.keyframeBtn,
            hasKeyframeAtCurrentTime && styles.keyframeActive,
          ]}
          onPress={onOpenKeyframeModal || handleKeyframePress}
          onLongPress={handleKeyframePress}
          delayLongPress={350}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityLabel="Keyframe"
        >
          <Ionicons
            name={hasKeyframeAtCurrentTime ? "diamond" : "diamond-outline"}
            size={15}
            color={hasKeyframeAtCurrentTime ? "#00E5FF" : "#8E8E93"}
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
              color={hasKeyframeAtCurrentTime ? "#FFFFFF" : "#00E5FF"}
            />
          </View>
        </TouchableOpacity>

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
            color={fullscreen ? "#00E5FF" : "#8E8E93"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const PlayerControlsBar = React.memo(PlayerControlsBarComponent);
export default PlayerControlsBar;
