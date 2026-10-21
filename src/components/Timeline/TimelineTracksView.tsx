import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { UnifiedClipItem, TRACK_ROW_HEIGHT } from "./timelineTypes";
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
  handleClipTouchStart: (e: any, clip: any, trackIdx: number) => void;
  handleClipTouchMove: (e: any) => void;
  handleClipTouchEnd: (e: any) => void;
  handleClipTouchCancel: () => void;
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
  handleClipTouchStart,
  handleClipTouchMove,
  handleClipTouchEnd,
  handleClipTouchCancel,
  leftTrimPanResponder,
  rightTrimPanResponder,
  clipMovePanResponder,
  playheadPanResponder,
  handlePlayheadPointerDown,
  handleLeftTrimStart,
  handleRightTrimStart,
  onOpenEditModal,
}) => {
  const draggedClip = useMemo(() => {
    if (!dragState) return null;
    for (const row of trackRows) {
      const found = row.find((c) => c.id === dragState.clipId);
      if (found) return found;
    }
    return null;
  }, [dragState, trackRows]);

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
            onPress={() => {
              if (selectedClipId) {
                soundEngine.playSfx("click");
                onSelectClip("", "video");
              }
            }}
          >
            {/* Subtle track lane guideline */}
            <View style={styles.trackLaneGuideline} />

            {/* Target Drop Zone Ghost Indicator when dragging a clip over this track */}
            {dragState && dragState.currentTrack === trackIdx && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: dragState.currentStart * pxPerSec,
                  width: Math.max(
                    24,
                    (draggedClip ? draggedClip.duration : 1) * pxPerSec,
                  ),
                  top: 2,
                  bottom: 2,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: "#00F2FE",
                  backgroundColor: "rgba(0, 242, 254, 0.14)",
                  zIndex: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  style={{
                    color: "#00F2FE",
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 0.5,
                  }}
                  numberOfLines={1}
                >
                  Track {trackIdx + 1}
                </Text>
              </View>
            )}

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
              const isBeingDragged =
                dragState && dragState.clipId === clip.id;
              const displayStart = isThisTrimmed
                ? activeTrimDelta.startTime
                : isBeingDragged
                  ? dragState.currentStart
                  : clip.startTime;
              const displayDuration = isThisTrimmed
                ? activeTrimDelta.duration
                : clip.duration;
              const left = displayStart * pxPerSec;
              const width = Math.max(24, displayDuration * pxPerSec);
              const isSelected = selectedClipId === clip.id;

              const visualOffsetY = isBeingDragged
                ? (dragState.dragOffsetY ??
                  (dragState.currentTrack - trackIdx) * TRACK_ROW_HEIGHT)
                : 0;

              return (
                <React.Fragment key={clip.id}>
                  {/* Draggable Clip Card across tracks & time */}
                  <Pressable
                    onPress={(e: any) => {
                      if (e?.stopPropagation) e.stopPropagation();
                      if (isBeingDragged) return;
                      handleClipPress(clip.id, clip.type);
                    }}
                    {...(Platform.OS === "web"
                      ? {
                          className: "clip-draggable-container",
                          onMouseDown: (e: any) => {
                            if (e?.stopPropagation) e.stopPropagation();
                            handleClipMouseDown(
                              e,
                              clip.id,
                              clip.type,
                              clip.startTime,
                              trackIdx,
                              clip.duration,
                            );
                          },
                          onDoubleClick: (e: any) => {
                            if (e?.stopPropagation) e.stopPropagation();
                            soundEngine.playSfx("click");
                            onSelectClip(clip.id, clip.type);
                            onOpenEditModal?.(clip.id, clip.type);
                          },
                        }
                      : {
                          onTouchStart: (e: any) =>
                            handleClipTouchStart(e, clip, trackIdx),
                          onTouchMove: (e: any) => handleClipTouchMove(e),
                          onTouchEnd: (e: any) => handleClipTouchEnd(e),
                          onTouchCancel: () => handleClipTouchCancel(),
                        })}
                    style={[
                      {
                        position: "absolute",
                        left,
                        width,
                        top: 2,
                        bottom: 2,
                        transform: [
                          { translateY: visualOffsetY },
                          { scale: isBeingDragged ? 1.03 : 1 },
                        ],
                        cursor: isBeingDragged ? "grabbing" : "grab",
                        zIndex: isBeingDragged
                          ? 9999
                          : isSelected
                            ? 20
                            : 6,
                        display: "flex",
                        opacity: isBeingDragged ? 0.95 : 1,
                        shadowColor: isBeingDragged ? clip.accentColor : "#000000",
                        shadowOffset: { width: 0, height: isBeingDragged ? 6 : 1 },
                        shadowOpacity: isBeingDragged ? 0.45 : 0.2,
                        shadowRadius: isBeingDragged ? 10 : 2,
                        elevation: isBeingDragged ? 25 : 2,
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
                              : (clip.borderColor || clip.accentColor),
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
                            <Ionicons
                              name={clip.iconName}
                              size={11}
                              color="#000000"
                            />
                          )}
                        </View>

                        {/* Title and Duration */}
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
                          <Text
                            style={styles.clipDurationSubtext}
                            numberOfLines={1}
                          >
                            {displayDuration.toFixed(2)}s
                            {clip.rawClip?.speed && clip.rawClip.speed !== 1
                              ? ` • ${clip.rawClip.speed}x`
                              : ""}
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
                                      4 +
                                      Math.abs(Math.sin((wIdx + 1) * 0.8) * 12),
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
                      {clip.rawClip?.keyframes &&
                        clip.rawClip.keyframes.length > 0 && (
                          <View
                            style={[StyleSheet.absoluteFill, { zIndex: 60 }]}
                            pointerEvents="none"
                          >
                            {clip.rawClip.keyframes.map(
                              (kf: any, kfIdx: number) => {
                                const kfPos = kf.time * pxPerSec;
                                if (kfPos < 0 || kfPos > width) return null;
                                const isPlayheadNear =
                                  Math.abs(
                                    clip.startTime + kf.time - currentTime,
                                  ) < 0.12;
                                return (
                                  <View
                                    key={`kf-${kfIdx}`}
                                    style={[
                                      styles.timelineKfMarker,
                                      {
                                        left: Math.max(
                                          2,
                                          Math.min(width - 16, kfPos - 7),
                                        ),
                                      },
                                      isPlayheadNear &&
                                        styles.timelineKfMarkerActive,
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.timelineKfMarkerInner,
                                        isPlayheadNear && {
                                          backgroundColor: "#FFFFFF",
                                        },
                                      ]}
                                    />
                                  </View>
                                );
                              },
                            )}
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

      {/* Tap empty space below tracks to deselect */}
      <Pressable
        style={{ flex: 1, minHeight: 48, width: "100%" }}
        onPress={() => {
          if (selectedClipId) {
            soundEngine.playSfx("click");
            onSelectClip("", "video");
          }
        }}
      />

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
