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
import { TimelineClipWaveform } from "./TimelineClipWaveform";
import { TimelineClipPreview } from "./TimelineClipPreview";
import { clipHasAudio, mediaHasAudioTrack } from "../../utils/mediaAudioDetector";

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
              borderColor: isSelected
                ? clip.accentColor
                : (clip as any).isMissing
                  ? "rgba(239, 68, 68, 0.7)"
                  : (clip as any).needsPermission
                    ? "rgba(0, 242, 254, 0.6)"
                    : "rgba(255, 255, 255, 0.08)",
              borderWidth: isSelected || (clip as any).isMissing || (clip as any).needsPermission ? 1.5 : 0.5,
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

          {/* Video & Image Thumbnail Filmstrip Preview */}
          <TimelineClipPreview clip={clip} width={width} />

          {/* Audio Waveform visualization (renders in audio clips & video clips with audio) */}
          <TimelineClipWaveform
            clip={clip}
            width={width}
            isSelected={isSelected}
          />

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
                clip.type === "video"
                  ? {
                      backgroundColor: "rgba(0, 0, 0, 0.65)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    }
                  : { backgroundColor: clip.accentColor },
              ]}
            >
              <Ionicons
                name={clip.iconName}
                size={11}
                color="#FFFFFF"
              />
            </View>

            {/* Title and Duration in ms */}
            <View
              style={{
                flex: 1,
                paddingHorizontal: 4,
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text
                  style={[
                    styles.clipTitleText,
                    (clip as any).isMissing && { color: "#FCA5A5" },
                    (clip as any).needsPermission && { color: "#BAE6FD" },
                  ]}
                  numberOfLines={1}
                >
                  {clip.title}
                </Text>
                {(clip as any).isMissing && (
                  <Ionicons
                    name="alert-circle"
                    size={11}
                    color="#EF4444"
                    style={{ marginLeft: 3 }}
                  />
                )}
                {!(clip as any).isMissing && (clip as any).needsPermission && (
                  <Ionicons
                    name="link-outline"
                    size={11}
                    color="#00F2FE"
                    style={{ marginLeft: 3 }}
                  />
                )}
                {clip.type === "video" && mediaHasAudioTrack(clip) && (
                  clip.rawClip?.volume === 0 || clip.rawClip?.muted ? (
                    <Ionicons
                      name="volume-mute-outline"
                      size={10}
                      color="#F87171"
                      style={{ marginLeft: 3 }}
                    />
                  ) : (
                    <Ionicons
                      name="volume-medium-outline"
                      size={10}
                      color="#E2E8F0"
                      style={{ marginLeft: 3 }}
                    />
                  )
                )}
              </View>
              <Text style={styles.clipDurationSubtext} numberOfLines={1}>
                {displayDuration.toFixed(2)}s
                {clip.rawClip?.speed && clip.rawClip.speed !== 1
                  ? ` • ${clip.rawClip.speed}x`
                  : ""}
              </Text>
            </View>

            {/* LUT filter indicator */}
            {clip.type === "video" &&
              clip.rawClip?.filter &&
              clip.rawClip?.filter !== "normal" && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>LUT</Text>
                </View>
              )}

            {/* Cutout indicator */}
            {clip.rawClip?.cutout?.enabled && (
              <View style={[styles.filterTag, { backgroundColor: "rgba(0, 242, 254, 0.2)", borderColor: "rgba(0, 242, 254, 0.5)", flexDirection: "row", alignItems: "center" }]}>
                <Ionicons name="sparkles" size={8} color="#00F2FE" style={{ marginRight: 2 }} />
                <Text style={[styles.filterTagText, { color: "#00F2FE", fontWeight: "700" }]}>
                  {clip.rawClip.cutout.mode === "auto" ? "AI CUT" : "CHROMA"}
                </Text>
              </View>
            )}
          </View>

          {/* Keyframe Diamond Markers (Transform & Mask) */}
          {((clip.rawClip?.keyframes && clip.rawClip.keyframes.length > 0) ||
            (clip.rawClip?.maskKeyframes && clip.rawClip.maskKeyframes.length > 0) ||
            (clip.rawClip?.mask?.keyframes && clip.rawClip.mask.keyframes.length > 0)) && (
            <View
              style={[StyleSheet.absoluteFill, { zIndex: 60 }]}
              pointerEvents="none"
            >
              {/* Transform Motion Keyframes (Gold/Yellow) */}
              {(clip.rawClip?.keyframes || []).map((kf: any, kfIdx: number) => {
                const kfPos = kf.time * pxPerSec;
                if (kfPos < 0 || kfPos > width) return null;
                const isPlayheadNear =
                  Math.abs(clip.startTime + kf.time - currentTime) < 0.12;
                return (
                  <View
                    key={`kf-${kfIdx}`}
                    style={[
                      styles.timelineKfMarker,
                      { left: Math.max(2, Math.min(width - 16, kfPos - 7)) },
                      isPlayheadNear && styles.timelineKfMarkerActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.timelineKfMarkerInner,
                        isPlayheadNear && { backgroundColor: "#FFFFFF" },
                      ]}
                    />
                  </View>
                );
              })}

              {/* Mask Keyframes (Purple) */}
              {(clip.rawClip?.maskKeyframes || clip.rawClip?.mask?.keyframes || []).map((mkf: any, mkfIdx: number) => {
                const mkfPos = mkf.time * pxPerSec;
                if (mkfPos < 0 || mkfPos > width) return null;
                const isPlayheadNear =
                  Math.abs(clip.startTime + mkf.time - currentTime) < 0.12;
                return (
                  <View
                    key={`mkf-${mkfIdx}`}
                    style={[
                      (styles as any).timelineMaskKfMarker,
                      { left: Math.max(2, Math.min(width - 16, mkfPos - 7)) },
                      isPlayheadNear && (styles as any).timelineMaskKfMarkerActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.timelineKfMarkerInner,
                        { backgroundColor: isPlayheadNear ? "#FFFFFF" : "#4A044E" },
                      ]}
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
              color="#FFFFFF"
            />
          </TouchableOpacity>
        )}
    </React.Fragment>
  );
};

export default React.memo(TimelineClipItem);
