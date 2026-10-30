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
import { TimelineClipWaveform } from "./TimelineClipWaveform";
import { TimelineClipPreview } from "./TimelineClipPreview";
import { clipHasAudio, mediaHasAudioTrack } from "../../utils/mediaAudioDetector";

interface TimelineTracksViewProps {
  trackRows: UnifiedClipItem[][];
  activeTrackCount: number;
  timelineContentWidth: number;
  rulerRef?: React.RefObject<any>;
  rulerPanResponder?: any;
  renderedTicks?: React.ReactNode;
  selectedClipId: string | null;
  pxPerSec: number;
  activeTrimming: any;
  activeTrimDelta: any;
  dragState: any;
  onSelectClip: (
    id: string,
    type: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
  ) => void;
  onOpenTransitions: (clipId: string) => void;
  handleRemoveTrack: (trackIdx: number) => void;
  handleClipPress: (
    clipId: string,
    trackType: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
  ) => void;
  handleClipLongPress: (
    clipId: string,
    trackType: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
    start: number,
    track: number,
    dur: number,
  ) => void;
  handleClipMouseDown: (
    e: any,
    clipId: string,
    trackType: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption",
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

const TimelineTracksViewComponent: React.FC<TimelineTracksViewProps> = ({
  trackRows,
  activeTrackCount,
  timelineContentWidth,
  rulerRef,
  rulerPanResponder,
  renderedTicks,
  selectedClipId,
  pxPerSec,
  activeTrimming,
  activeTrimDelta,
  dragState,
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
      {/* Track Lanes */}
      {trackRows.map((rowClips, trackIdx) => {
        const isEmptyTrack = rowClips.length === 0;
        const isSourceOfDrag =
          dragState && rowClips.some((c) => c.id === dragState.clipId);
        const isTargetOfDrag =
          dragState && dragState.currentTrack === trackIdx;

        return (
          <React.Fragment key={`track-row-fragment-${trackIdx}`}>
            <Pressable
              key={trackIdx}
              style={[
                styles.universalTrackLane,
                {
                  zIndex: isSourceOfDrag ? 10000 : isTargetOfDrag ? 5000 : 1,
                  overflow: "visible",
                },
              ]}
              onPress={() => {
                if (selectedClipId) {
                  soundEngine.playSfx("click");
                  onSelectClip("", "video");
                }
              }}
            >
              {/* Subtle track lane guideline */}
              <View style={styles.trackLaneGuideline} />

              {/* Inter-Track Laser Seam Line (Clipchamp style - ZERO vertical displacement) */}
              {dragState?.isInsertingNewTrack &&
                dragState?.insertTrackIndex === trackIdx && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: -2,
                      left: 0,
                      right: 0,
                      height: 4,
                      backgroundColor: "#FFFFFF",
                      zIndex: 99999,
                      flexDirection: "row",
                      alignItems: "center",
                      ...(Platform.OS === "web"
                        ? {
                            boxShadow: "0 0 10px rgba(255, 255, 255, 0.5), 0 0 4px #FFFFFF",
                          }
                        : {}),
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: Math.max(12, (dragState.targetStart ?? dragState.currentStart) * pxPerSec),
                        backgroundColor: "#08090E",
                        borderWidth: 1.5,
                        borderColor: "#FFFFFF",
                        borderRadius: 12,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        transform: [{ translateY: -10 }],
                        ...(Platform.OS === "web"
                          ? {
                              boxShadow: "0 0 12px rgba(255, 255, 255, 0.35)",
                            }
                          : {}),
                      }}
                    >
                      <Ionicons name="add-circle" size={12} color="#FFFFFF" />
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 10,
                          fontWeight: "700",
                          letterSpacing: 0.3,
                        }}
                      >
                        Insert Track {trackIdx + 1}
                      </Text>
                    </View>
                  </View>
                )}

              {/* Target Drop Zone Ghost Indicator when dragging a clip over this track or onto seam */}
              {dragState &&
                ((!dragState.isInsertingNewTrack && dragState.currentTrack === trackIdx) ||
                  (dragState.isInsertingNewTrack && dragState.insertTrackIndex === trackIdx)) && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: (dragState.targetStart ?? dragState.currentStart) * pxPerSec,
                      width: Math.max(
                        24,
                        (draggedClip ? draggedClip.duration : 1) * pxPerSec,
                      ),
                      top: 2,
                      bottom: 2,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderStyle: "dashed",
                      borderColor: "#FFFFFF",
                      backgroundColor: dragState.isInsertingNewTrack
                        ? "rgba(255, 255, 255, 0.16)"
                        : "rgba(255, 255, 255, 0.10)",
                      zIndex: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 8,
                    }}
                  >
                    <Ionicons
                      name={dragState.isInsertingNewTrack ? "add-circle" : "arrow-down-circle-outline"}
                      size={12}
                      color="#FFFFFF"
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 10.5,
                        fontWeight: "700",
                        letterSpacing: 0.3,
                      }}
                      numberOfLines={1}
                    >
                      {dragState.isInsertingNewTrack
                        ? `New Track ${trackIdx + 1}`
                        : `Drop Position • Track ${trackIdx + 1}`}
                    </Text>
                  </View>
                )}

              {/* Empty track indicator & delete track button directly on the track lane */}
              {isEmptyTrack && !dragState && (
                <View style={styles.emptyTrackLaneContainer} pointerEvents="box-none">
                  <Text style={styles.emptyTrackLanePrompt}>Empty Track</Text>
                  {activeTrackCount > 1 && (
                    <TouchableOpacity
                      style={styles.removeEmptyTrackLaneBtn}
                      onPress={(e: any) => {
                        if (e?.stopPropagation) e.stopPropagation();
                        e?.nativeEvent?.stopPropagation?.();
                        soundEngine.playSfx("click");
                        handleRemoveTrack(trackIdx);
                      }}
                      {...(Platform.OS === "web"
                        ? {
                            onClick: (e: any) => {
                              e.stopPropagation();
                            },
                          }
                        : {})}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={`Delete empty track ${trackIdx + 1}`}
                    >
                      <Ionicons name="trash-outline" size={11} color="#EF4444" />
                      <Text style={styles.removeEmptyTrackLaneText}>Delete Track</Text>
                    </TouchableOpacity>
                  )}
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
                          ? 99999
                          : isSelected
                            ? 20
                            : 6,
                        display: "flex",
                        opacity: isBeingDragged ? 0.95 : 1,
                        shadowColor: isBeingDragged ? clip.accentColor : "#000000",
                        shadowOffset: { width: 0, height: isBeingDragged ? 6 : 1 },
                        shadowOpacity: isBeingDragged ? 0.45 : 0.2,
                        shadowRadius: isBeingDragged ? 10 : 2,
                        elevation: isBeingDragged ? 99 : 2,
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
                              isBeingDragged && dragState?.isInsertingNewTrack
                                ? "#FFFFFF"
                                : isSelected || isBeingDragged
                                  ? clip.accentColor
                                  : "rgba(255, 255, 255, 0.08)",
                            borderWidth: isSelected || isBeingDragged ? 1.5 : 0.5,
                            backgroundColor: clip.bgColor,
                          },
                          (isSelected || isBeingDragged) && [
                            styles.clipSelectedUniversal,
                            {
                              borderColor:
                                isBeingDragged && dragState?.isInsertingNewTrack
                                ? "#FFFFFF"
                                : clip.accentColor,
                              shadowColor:
                                isBeingDragged && dragState?.isInsertingNewTrack
                                ? "#FFFFFF"
                                : clip.accentColor,
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

                      {/* Video & Image Thumbnail Filmstrip Preview */}
                      <TimelineClipPreview clip={clip} width={width} />

                      {/* Audio Waveform visualization (renders in audio clips & video clips with audio) */}
                      <TimelineClipWaveform
                        clip={clip}
                        width={width}
                        isSelected={isSelected || isBeingDragged}
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

                        {/* Title and Duration */}
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
                            <Text style={styles.clipTitleText} numberOfLines={1}>
                              {clip.title}
                            </Text>
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
                                  color="#A1A1AA"
                                  style={{ marginLeft: 3 }}
                                />
                              )
                            )}
                          </View>
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
                                const isPlayheadNear = isSelected;
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
                              ? "#FFFFFF"
                              : "#71717A"
                          }
                        />
                      </TouchableOpacity>
                    )}
                </React.Fragment>
              );
            })}
          </Pressable>
        </React.Fragment>
      );
    })}

      {/* Bottom Drop Target Lane: Only show if track just above it is not empty */}
      {(() => {
        const isLastTrackEmpty =
          trackRows.length > 0 &&
          (trackRows[trackRows.length - 1].length === 0 ||
            (trackRows[trackRows.length - 1].length === 1 &&
              trackRows[trackRows.length - 1][0].id === dragState?.clipId));

        if (!dragState || activeTrackCount >= 10 || isLastTrackEmpty) return null;

        return (
          <View
          key="drag-drop-bottom-target"
          pointerEvents="none"
          style={[
            styles.universalTrackLane,
            {
              borderStyle: "dashed",
              borderColor:
                dragState.isInsertingNewTrack &&
                (dragState.insertTrackIndex === null ||
                  dragState.insertTrackIndex === undefined ||
                  dragState.insertTrackIndex >= activeTrackCount)
                  ? "#FFFFFF"
                  : "rgba(255, 255, 255, 0.25)",
              borderWidth: 1.5,
              backgroundColor:
                dragState.isInsertingNewTrack &&
                (dragState.insertTrackIndex === null ||
                  dragState.insertTrackIndex === undefined ||
                  dragState.insertTrackIndex >= activeTrackCount)
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(255, 255, 255, 0.03)",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              zIndex: 10,
              ...(Platform.OS === "web"
                ? {
                    transition: "all 0.18s ease",
                  }
                : {}),
            },
          ]}
        >
          {dragState.isInsertingNewTrack &&
          (dragState.insertTrackIndex === null ||
            dragState.insertTrackIndex === undefined ||
            dragState.insertTrackIndex >= activeTrackCount) ? (
            <View
              style={{
                position: "absolute",
                left: (dragState.targetStart ?? dragState.currentStart) * pxPerSec,
                width: Math.max(
                  24,
                  (draggedClip ? draggedClip.duration : 1) * pxPerSec,
                ),
                top: 2,
                bottom: 2,
                borderRadius: 4,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: "#FFFFFF",
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <Ionicons name="add-circle" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 10.5,
                  fontWeight: "700",
                  letterSpacing: 0.3,
                }}
                numberOfLines={1}
              >
                New Track {activeTrackCount + 1}
              </Text>
            </View>
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={13} color="#FFFFFF" />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 10.5,
                  fontWeight: "600",
                  letterSpacing: 0.3,
                }}
              >
                Drag here to add to new track
              </Text>
            </>
          )}
        </View>
        );
      })()}

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

    </View>
  );
};

export const TimelineTracksView = React.memo(TimelineTracksViewComponent);
export default TimelineTracksView;
