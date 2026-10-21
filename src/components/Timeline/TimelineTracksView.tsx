import React from "react";
import { View, Text, TouchableOpacity, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { UnifiedClipItem } from "./timelineTypes";
import { styles } from "./TimelineStyles";
import { TimelinePlayhead } from "./TimelinePlayhead";

interface TimelineTracksViewProps {
  trackRows: UnifiedClipItem[][];
  activeTrackCount: number;
  timelineContentWidth: number;
  rulerRef: React.RefObject<any>;
  rulerPanResponder: any;
  renderedTicks: React.ReactNode;
  selectedClipId: string | null;
  currentTime: number;
  pxPerSec: number;
  activeTrimming: any;
  activeTrimDelta: any;
  dragState: any;
  isScrubbingRuler: boolean;
  onSelectClip: (
    id: string,
    type: "video" | "audio" | "text" | "sticker" | "effects",
  ) => void;
  onOpenTransitions: (clipId: string) => void;
  handleRemoveTrack: (trackIdx: number) => void;
  handleClipPress: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
  ) => void;
  handleClipLongPress: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
    start: number,
    track: number,
    dur: number,
  ) => void;
  handleClipMouseDown: (
    e: any,
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
    start: number,
    track: number,
    dur: number,
  ) => void;
  leftTrimPanResponder: any;
  rightTrimPanResponder: any;
  clipMovePanResponder: any;
  playheadPanResponder: any;
  handlePlayheadPointerDown: (e: any) => void;
  handleLeftTrimStart: (
    e: any,
    clipId: string,
    start: number,
    dur: number,
    trimIn: number,
    track: number,
  ) => void;
  handleRightTrimStart: (
    e: any,
    clipId: string,
    start: number,
    dur: number,
    trimOut: number,
    track: number,
  ) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
}

export const TimelineTracksView: React.FC<TimelineTracksViewProps> = ({
  trackRows,
  timelineContentWidth,
  rulerRef,
  rulerPanResponder,
  renderedTicks,
  selectedClipId,
  currentTime,
  pxPerSec,
  activeTrimming,
  activeTrimDelta,
  dragState,
  isScrubbingRuler,
  onSelectClip,
  onOpenTransitions,
  handleRemoveTrack,
  handleClipPress,
  handleClipLongPress,
  handleClipMouseDown,
  leftTrimPanResponder,
  rightTrimPanResponder,
  playheadPanResponder,
  handlePlayheadPointerDown,
  handleLeftTrimStart,
  handleRightTrimStart,
  onOpenEditModal,
}) => {
  return (
    <View style={[styles.tracksContainer, { width: timelineContentWidth }]}>
      {/* Time Ruler (Interactive Tap & Drag to Seek with ms precision) */}
      <View
        ref={rulerRef}
        style={styles.rulerContainer}
        {...rulerPanResponder.panHandlers}
      >
        {renderedTicks}
      </View>

      {/* General Multi-Track Rows */}
      {trackRows.map((rowClips, trackIdx) => {
        const isEmptyTrack = rowClips.length === 0;

        return (
          <Pressable
            key={trackIdx}
            style={styles.universalTrackLane}
            onPress={() => onSelectClip("", "video")}
          >
            {/* Subtle track lane guideline */}
            <View style={styles.trackLaneGuideline} />

            {/* Empty track lane helper with quick delete option */}
            {isEmptyTrack && (
              <View style={styles.emptyTrackLaneContainer}>
                <Text style={styles.emptyTrackLanePrompt}>
                  Track {trackIdx + 1} is empty
                </Text>
                <TouchableOpacity
                  style={styles.removeEmptyTrackLaneBtn}
                  onPress={() => handleRemoveTrack(trackIdx)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={11} color="#EF4444" />
                  <Text style={styles.removeEmptyTrackLaneText}>
                    Remove Track
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Render all clips in this track */}
            {rowClips.map((clip, clipIndexInRow) => {
              const isThisTrimmed =
                activeTrimDelta && activeTrimDelta.clipId === clip.id;
              const displayStart = isThisTrimmed
                ? activeTrimDelta.startTime
                : clip.startTime;
              const displayDuration = isThisTrimmed
                ? activeTrimDelta.duration
                : clip.duration;
              const left = displayStart * pxPerSec;
              const width = Math.max(24, displayDuration * pxPerSec);
              const isSelected = selectedClipId === clip.id;
              const isBeingDragged =
                dragState && dragState.clipId === clip.id;

              return (
                <React.Fragment key={clip.id}>
                  {/* Draggable Clip Card across tracks & time */}
                  <Pressable
                    onPress={() => handleClipPress(clip.id, clip.type)}
                    onLongPress={() =>
                      handleClipLongPress(
                        clip.id,
                        clip.type,
                        clip.startTime,
                        trackIdx,
                        clip.duration,
                      )
                    }
                    delayLongPress={220}
                    {...(Platform.OS === "web"
                      ? {
                          className: "clip-draggable-container",
                          onMouseDown: (e: any) =>
                            handleClipMouseDown(
                              e,
                              clip.id,
                              clip.type,
                              clip.startTime,
                              trackIdx,
                              clip.duration,
                            ),
                          onDoubleClick: (e: any) => {
                            if (e.stopPropagation) e.stopPropagation();
                            soundEngine.playSfx("click");
                            onSelectClip(clip.id, clip.type);
                            onOpenEditModal?.(clip.id, clip.type);
                          },
                        }
                      : {})}
                    style={({ pressed }) => [
                      {
                        position: "absolute",
                        left,
                        width,
                        top: 2,
                        bottom: 2,
                        cursor: "grab",
                        zIndex: isBeingDragged
                          ? 50
                          : isSelected
                            ? 20
                            : 6,
                        display: "flex",
                        transform: isBeingDragged
                          ? [{ scale: 1.03 }]
                          : undefined,
                        opacity: isBeingDragged
                          ? 0.95
                          : pressed && !isSelected
                            ? 0.88
                            : 1,
                        touchAction: isBeingDragged
                          ? "none"
                          : ("pan-x pan-y" as any),
                        userSelect: "none",
                        WebkitUserSelect: "none",
                      } as any,
                    ]}
                  >
                    <View
                      style={[
                        styles.universalClipCard,
                        {
                          borderColor:
                            isSelected || isBeingDragged
                              ? clip.accentColor
                              : "rgba(255,255,255,0.12)",
                          backgroundColor: clip.bgColor,
                        },
                        (isSelected || isBeingDragged) && [
                          styles.clipSelectedUniversal,
                          {
                            borderColor: clip.accentColor,
                            shadowColor: clip.accentColor,
                          },
                        ],
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
                          hitSlop={{
                            top: 18,
                            bottom: 18,
                            left: 18,
                            right: 18,
                          }}
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
                            <View
                              style={[styles.trimGripBar, { marginLeft: 2 }]}
                            />
                          </View>
                        </View>
                      )}

                      {/* Clip Title and Details */}
                      <View style={styles.universalClipInner}>
                        <View style={styles.universalClipHeader}>
                          <Ionicons
                            name={clip.iconName}
                            size={12}
                            color={clip.accentColor}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={styles.universalClipTitle}
                            numberOfLines={1}
                          >
                            {clip.title}
                          </Text>
                        </View>
                        {clip.subtitle ? (
                          <Text
                            style={styles.universalClipSubtitle}
                            numberOfLines={1}
                          >
                            {clip.subtitle}
                          </Text>
                        ) : null}
                      </View>

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
                          hitSlop={{
                            top: 18,
                            bottom: 18,
                            left: 18,
                            right: 18,
                          }}
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
                            <View
                              style={[styles.trimGripBar, { marginLeft: 2 }]}
                            />
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
                            left:
                              (clip.startTime + clip.duration) *
                                pxPerSec -
                              11,
                          },
                          Boolean(
                            clip.rawClip?.transition?.type &&
                              clip.rawClip?.transition?.type !== "none",
                          ) && styles.transitionButtonActive,
                        ]}
                        onPress={() => onOpenTransitions(clip.id)}
                        activeOpacity={0.8}
                        accessibilityLabel="Transition between clips"
                      >
                        <Ionicons
                          name={
                            clip.rawClip?.transition?.type &&
                            clip.rawClip?.transition?.type !== "none"
                              ? "flash"
                              : "swap-horizontal"
                          }
                          size={11}
                          color={
                            clip.rawClip?.transition?.type &&
                            clip.rawClip?.transition?.type !== "none"
                              ? "#00F2FE"
                              : "#94A3B8"
                          }
                        />
                      </TouchableOpacity>
                    )}
                </React.Fragment>
              );
            })}
          </Pressable>
        );
      })}

      {/* Playhead Needle with Diamond Head */}
      <TimelinePlayhead
        currentTime={currentTime}
        pxPerSec={pxPerSec}
        isScrubbingRuler={isScrubbingRuler}
        playheadPanResponder={playheadPanResponder}
        handlePlayheadPointerDown={handlePlayheadPointerDown}
      />
    </View>
  );
};
