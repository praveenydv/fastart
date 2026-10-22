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
      <View style={styles.controlGroupLeft}>
        <View style={[styles.timecodePill, isMobile && { paddingHorizontal: 5 }]}>
          <Ionicons
            name="time-outline"
            size={isMobile ? 10 : 11}
            color="#00F2FE"
            style={{ marginRight: 2 }}
          />
          <Text style={[styles.timecodeText, isMobile && { fontSize: 10 }]}>
            {formatTime(currentTime)}
            <Text style={[styles.timecodeTotalText, isMobile && { fontSize: 9.5 }]}>
              {" "}
              / {formatTime(totalDuration)}
            </Text>
          </Text>
        </View>
      </View>

      <View
        style={[styles.controlGroupCenter, isMobile && { gap: 6 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[
            styles.stepBtn,
            isMobile && styles.stepBtnMobile,
            totalDuration <= 0 && { opacity: 0.4 },
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
            color="#8E95A5"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.playPauseBtn,
            isMobile && styles.playPauseBtnMobile,
            totalDuration <= 0 && { opacity: 0.5 },
          ]}
          onPress={onTogglePlay}
          disabled={totalDuration <= 0}
          activeOpacity={totalDuration <= 0 ? 1 : 0.8}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={isMobile ? 16 : 20}
            color="#FFFFFF"
            style={!isPlaying ? { marginLeft: 2 } : undefined}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.stepBtn,
            isMobile && styles.stepBtnMobile,
            totalDuration <= 0 && { opacity: 0.4 },
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
            color="#8E95A5"
          />
        </TouchableOpacity>
      </View>

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
            size={isMobile ? 13 : 15}
            color={showSafeZone ? "#00F2FE" : "#8E95A5"}
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
          accessibilityLabel="Open Keyframe Studio (Hold to stamp)"
        >
          <Ionicons
            name={hasKeyframeAtCurrentTime ? "diamond" : "diamond-outline"}
            size={isMobile ? 14 : 16}
            color={hasKeyframeAtCurrentTime ? "#FFE600" : "#8E95A5"}
          />
          {/* Badge indicator (+ / -) */}
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
              size={7}
              color={hasKeyframeAtCurrentTime ? "#FFFFFF" : "#00F2FE"}
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
            size={isMobile ? 13 : 15}
            color={fullscreen ? "#00F2FE" : "#8E95A5"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const PlayerControlsBar = React.memo(PlayerControlsBarComponent);
export default PlayerControlsBar;
