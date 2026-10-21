import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UnifiedClipItem } from "./timelineTypes";
import { styles } from "./TimelineStyles";

interface TimelineClipItemProps {
  clip: UnifiedClipItem;
  trackIdx: number;
  clipIndexInRow: number;
  rowClips: UnifiedClipItem[];
  pxPerSec: number;
  currentTime: number;
  selectedClipId: string | null;
  activeDragging: any;
  activeTrimming: any;
  onOpenTransitions: (clipId: string) => void;
  handleClipPress: (clip: UnifiedClipItem) => void;
  handleClipTouchStart: (e: any, clip: UnifiedClipItem, trackIdx: number) => void;
  handleLeftTrimStart: (
    e: any,
    clipId: string,
    startTime: number,
    duration: number,
    trimIn: number,
    trackIdx: number,
  ) => void;
  handleRightTrimStart: (
    e: any,
    clipId: string,
    startTime: number,
    duration: number,
    trimOut: number,
    trackIdx: number,
  ) => void;
  leftTrimPanResponder: any;
  rightTrimPanResponder: any;
  clipMovePanResponder: any;
}

export const TimelineClipItem: React.FC<TimelineClipItemProps> = ({
  clip,
  trackIdx,
  clipIndexInRow,
  rowClips,
  pxPerSec,
  currentTime,
  selectedClipId,
  activeDragging,
  activeTrimming,
  onOpenTransitions,
  handleClipPress,
  handleClipTouchStart,
  handleLeftTrimStart,
  handleRightTrimStart,
  leftTrimPanResponder,
  rightTrimPanResponder,
  clipMovePanResponder,
}) => {
  const isSelected = selectedClipId === clip.id;
  const isDraggingThis = activeDragging?.clipId === clip.id;
  const isTrimmingThis = activeTrimming?.clipId === clip.id;

  const left = isDraggingThis
    ? activeDragging.currentStartTime * pxPerSec
    : isTrimmingThis
      ? activeTrimming.currentStartTime * pxPerSec
      : clip.startTime * pxPerSec;

  const width = isTrimmingThis
    ? Math.max(14, activeTrimming.currentDuration * pxPerSec)
    : Math.max(14, clip.duration * pxPerSec);

  const displayDuration = isTrimmingThis
    ? activeTrimming.currentDuration
    : clip.duration;

  return (
    <React.Fragment key={clip.id}>
      <Pressable
        onPress={() => handleClipPress(clip)}
        {...(Platform.OS === "web"
          ? {
              onMouseDown: (e: any) => handleClipTouchStart(e, clip, trackIdx),
              onTouchStart: (e: any) => handleClipTouchStart(e, clip, trackIdx),
            }
          : {})}
        style={[
          {
            position: "absolute",
            left,
            width,
            top: 4,
            bottom: 4,
            zIndex: isSelected ? 30 : 10,
          },
        ]}
      >
        <View
          style={[
            styles.universalClipCard,
            {
              backgroundColor: clip.bgColor,
              borderColor: isSelected ? clip.accentColor : clip.borderColor,
            },
            isSelected && [
              styles.clipSelectedUniversal,
              {
                borderColor: clip.accentColor,
                shadowColor: clip.accentColor,
              },
            ],
            isDraggingThis && {
              opacity: 0.85,
            },
          ]}
        >
          {/* Left Trim Handle */}
          {isSelected && (
            <View
              {...leftTrimPanResponder.panHandlers}
              {...(Platform.OS === "web"
                ? {
                    className: "trim-handle-box",
                    onMouseDown: (e: any) => {
                      e.stopPropagation?.();
                      e.nativeEvent?.stopPropagation?.();
                      handleLeftTrimStart(
                        e,
                        clip.id,
                        clip.startTime,
                        clip.duration,
                        clip.rawClip?.trimIn || 0,
                        trackIdx,
                      );
                    },
                  }
                : {})}
              hitSlop={{ top: 18, bottom: 18, left: 18, right: 18 }}
              style={[
                styles.trimHandleBoxLeft,
                activeTrimming?.clipId === clip.id &&
                  activeTrimming?.side === "left" &&
                  styles.trimHandleBoxActive,
              ]}
            >
              <View
                style={[
                  styles.universalTrimHandle,
                  styles.universalTrimHandleLeft,
                  { backgroundColor: clip.accentColor },
                  activeTrimming?.clipId === clip.id &&
                    activeTrimming?.side === "left" &&
                    styles.universalTrimHandleActive,
                ]}
              >
                <View style={styles.trimGripBar} />
                <View style={[styles.trimGripBar, { marginLeft: 2 }]} />
              </View>
            </View>
          )}

          {/* Center Move Grip Bar */}
          {isSelected && (
            <View
              {...clipMovePanResponder.panHandlers}
              style={styles.clipMoveGripBox}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            >
              <View
                style={[
                  styles.clipMoveGripPill,
                  { backgroundColor: clip.accentColor },
                ]}
              >
                <Ionicons
                  name="reorder-two-outline"
                  size={9}
                  color="#000000"
                />
              </View>
            </View>
          )}

          {/* Inner Content by Clip Type */}
          <View
            style={[
              styles.universalClipInner,
              isSelected && { paddingHorizontal: 22 },
            ]}
          >
            {/* Type Icon Badge */}
            <View
              style={[
                styles.clipIconBadge,
                { backgroundColor: clip.accentColor },
              ]}
            >
              {clip.type === "sticker" ? (
                <Text style={{ fontSize: 11 }}>
                  {clip.rawClip?.char || "✨"}
                </Text>
              ) : (
                <Ionicons name={clip.iconName} size={11} color="#000000" />
              )}
            </View>

            {/* Title and Duration in ms */}
            <View
              style={{
                flex: 1,
                paddingHorizontal: 4,
                justifyContent: "center",
              }}
            >
              <Text style={styles.clipTitleText} numberOfLines={1}>
                {clip.title}
              </Text>
              <Text style={styles.clipDurationSubtext} numberOfLines={1}>
                {displayDuration.toFixed(2)}s •{" "}
                {Math.round(displayDuration * 1000)}ms
              </Text>
            </View>

            {/* Audio Waveform visualization */}
            {clip.type === "audio" && (
              <View style={styles.miniWaveformRow}>
                {Array.from({
                  length: Math.min(24, Math.floor(width / 6)),
                }).map((_, wIdx) => (
                  <View
                    key={wIdx}
                    style={[
                      styles.waveBar,
                      {
                        height:
                          4 + Math.abs(Math.sin((wIdx + 1) * 0.8) * 12),
                      },
                    ]}
                  />
                ))}
              </View>
            )}

            {/* LUT filter indicator */}
            {clip.type === "video" &&
              clip.rawClip?.filter &&
              clip.rawClip?.filter !== "normal" && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>LUT</Text>
                </View>
              )}
          </View>

          {/* Keyframe Diamond Markers */}
          {clip.rawClip?.keyframes && clip.rawClip.keyframes.length > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {clip.rawClip.keyframes.map((kf: any, kfIdx: number) => {
                const kfPos = kf.time * pxPerSec;
                if (kfPos < 0 || kfPos > width) return null;
                const isPlayheadNear =
                  Math.abs(clip.startTime + kf.time - currentTime) < 0.12;
                return (
                  <View
                    key={`kf-${kfIdx}`}
                    style={[
                      styles.timelineKfMarker,
                      { left: Math.max(0, kfPos - 6) },
                      isPlayheadNear && styles.timelineKfMarkerActive,
                    ]}
                  >
                    <Ionicons
                      name="diamond"
                      size={11}
                      color={isPlayheadNear ? "#FFE600" : "#FFFFFF"}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Right Trim Handle */}
          {isSelected && (
            <View
              {...rightTrimPanResponder.panHandlers}
              {...(Platform.OS === "web"
                ? {
                    className: "trim-handle-box",
                    onMouseDown: (e: any) => {
                      e.stopPropagation?.();
                      e.nativeEvent?.stopPropagation?.();
                      handleRightTrimStart(
                        e,
                        clip.id,
                        clip.startTime,
                        clip.duration,
                        clip.rawClip?.trimOut || clip.duration,
                        trackIdx,
                      );
                    },
                  }
                : {})}
              hitSlop={{ top: 18, bottom: 18, left: 18, right: 18 }}
              style={[
                styles.trimHandleBoxRight,
                activeTrimming?.clipId === clip.id &&
                  activeTrimming?.side === "right" &&
                  styles.trimHandleBoxActive,
              ]}
            >
              <View
                style={[
                  styles.universalTrimHandle,
                  styles.universalTrimHandleRight,
                  { backgroundColor: clip.accentColor },
                  activeTrimming?.clipId === clip.id &&
                    activeTrimming?.side === "right" &&
                    styles.universalTrimHandleActive,
                ]}
              >
                <View style={styles.trimGripBar} />
                <View style={[styles.trimGripBar, { marginLeft: 2 }]} />
              </View>
            </View>
          )}
        </View>
      </Pressable>

      {/* Transition Cut Button between adjacent video clips on same track */}
      {clip.type === "video" &&
        clipIndexInRow < rowClips.length - 1 &&
        rowClips[clipIndexInRow + 1].type === "video" &&
        Math.abs(
          rowClips[clipIndexInRow + 1].startTime -
            (clip.startTime + clip.duration),
        ) < 0.25 && (
          <TouchableOpacity
            style={[
              styles.transitionButton,
              {
                left: (clip.startTime + clip.duration) * pxPerSec - 11,
              },
              Boolean(
                clip.rawClip?.transition?.type &&
                  clip.rawClip?.transition?.type !== "none",
              ) && styles.transitionButtonActive,
            ]}
            onPress={() => onOpenTransitions(clip.id)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={
                clip.rawClip?.transition?.type &&
                clip.rawClip?.transition?.type !== "none"
                  ? "flash"
                  : "flash-outline"
              }
              size={11}
              color={
                clip.rawClip?.transition?.type &&
                clip.rawClip?.transition?.type !== "none"
                  ? "#00F2FE"
                  : "#FFFFFF"
              }
            />
          </TouchableOpacity>
        )}
    </React.Fragment>
  );
};

export default React.memo(TimelineClipItem);
