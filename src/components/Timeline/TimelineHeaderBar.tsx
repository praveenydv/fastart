import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./TimelineStyles";

interface TimelineHeaderBarProps {
  isResizingHeight: boolean;
  resizeHandleProps?: any;
  handleResizeMouseDown?: any;
  handleResetResizeHeight?: any;
  handleResizeTouchStart?: any;
  handleResizeTouchMove?: any;
  handleResizeTouchEnd?: any;
  isMobile: boolean;
  activeClipInfo: {
    color: string;
    type: string;
    trackIndex: number;
    start: number;
    duration: number;
  } | null;
  pxPerSec: number;
  onZoomChange: (zoom: number) => void;
  onDeselectClip?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onSplitClip?: () => void;
  onDeleteClip?: () => void;
  onFreezeFrame?: () => void;
  onToggleReverse?: () => void;
  hasSelectedClip?: boolean;
  selectedClipType?: string;
}

export const TimelineHeaderBar: React.FC<TimelineHeaderBarProps> = ({
  isResizingHeight,
  resizeHandleProps,
  handleResizeMouseDown,
  handleResetResizeHeight,
  handleResizeTouchStart,
  handleResizeTouchMove,
  handleResizeTouchEnd,
  isMobile,
  activeClipInfo,
  pxPerSec,
  onZoomChange,
  onDeselectClip,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onSplitClip,
  onDeleteClip,
  onFreezeFrame,
  onToggleReverse,
  hasSelectedClip = false,
  selectedClipType,
}) => {
  const isVideoSelected = selectedClipType === "video" || (!selectedClipType && hasSelectedClip);

  return (
    <>
      {/* Interactive Top Drag-to-Resize Handle (Desktop only; on mobile, handled universally in EditorWorkspace) */}
      {!isMobile && (
        <View
          style={[
            styles.resizeHandleBar,
            isResizingHeight && styles.resizeHandleBarActive,
          ]}
          {...(resizeHandleProps
            ? resizeHandleProps
            : {
                ...(Platform.OS === "web"
                  ? {
                      onMouseDown: handleResizeMouseDown,
                      onDoubleClick: handleResetResizeHeight,
                    }
                  : {}),
                onTouchStart: handleResizeTouchStart,
                onTouchMove: handleResizeTouchMove,
                onTouchEnd: handleResizeTouchEnd,
              })}
          accessibilityLabel="Drag up or down to adjust timeline height"
        >
          <View
            style={[
              styles.resizeGripPill,
              isResizingHeight && styles.resizeGripPillActive,
            ]}
          />
        </View>
      )}

      {/* Top Preference Bar: Multi-Track Info, Track Counter, Active Clip Details & Fluid Zoom Controls */}
      <View style={styles.timelineBar}>
        <View style={styles.timelineBarLeft}>
          <View style={styles.trackPreferenceGroup}>
            <View style={styles.trackTitleBadge}>
              <Ionicons name="layers-outline" size={12} color="#00F2FE" />
              <Text style={styles.trackLabelTitle}>
                {isMobile ? "TRACKS" : "MULTI-TRACK"}
              </Text>
            </View>
          </View>

          {/* Undo / Redo Quick Actions (Desktop only - mobile has top header undo/redo) */}
          {!isMobile && (onUndo || onRedo) && (
            <View style={styles.actionBtnGroup}>
              {onUndo && (
                <TouchableOpacity
                  style={[styles.actionBtn, !canUndo && styles.actionBtnDisabled]}
                  onPress={canUndo ? onUndo : undefined}
                  disabled={!canUndo}
                  accessibilityLabel="Undo"
                >
                  <Ionicons name="arrow-undo-outline" size={12} color={canUndo ? "#E2E8F0" : "#64748B"} />
                </TouchableOpacity>
              )}
              {onRedo && (
                <TouchableOpacity
                  style={[styles.actionBtn, !canRedo && styles.actionBtnDisabled]}
                  onPress={canRedo ? onRedo : undefined}
                  disabled={!canRedo}
                  accessibilityLabel="Redo"
                >
                  <Ionicons name="arrow-redo-outline" size={12} color={canRedo ? "#E2E8F0" : "#64748B"} />
                </TouchableOpacity>
              )}
              <View style={styles.actionDivider} />
            </View>
          )}

          {/* Quick Editing Actions: Split, Freeze, Reverse, Delete */}
          {!isMobile && (
            <View style={styles.actionBtnGroup}>
              {onSplitClip && (
                <TouchableOpacity
                  style={[styles.actionBtn, !hasSelectedClip && styles.actionBtnDisabled]}
                  onPress={hasSelectedClip ? onSplitClip : undefined}
                  disabled={!hasSelectedClip}
                  accessibilityLabel="Split clip at playhead"
                >
                  <Ionicons name="cut-outline" size={12} color={hasSelectedClip ? "#00F2FE" : "#64748B"} />
                  <Text style={styles.actionBtnText}>Split</Text>
                </TouchableOpacity>
              )}
              {onFreezeFrame && isVideoSelected && (
                <TouchableOpacity
                  style={[styles.actionBtn, !hasSelectedClip && styles.actionBtnDisabled]}
                  onPress={hasSelectedClip ? onFreezeFrame : undefined}
                  disabled={!hasSelectedClip}
                  accessibilityLabel="Freeze frame at playhead"
                >
                  <Ionicons name="snow-outline" size={12} color={hasSelectedClip ? "#38BDF8" : "#64748B"} />
                  <Text style={styles.actionBtnText}>Freeze</Text>
                </TouchableOpacity>
              )}
              {onToggleReverse && isVideoSelected && (
                <TouchableOpacity
                  style={[styles.actionBtn, !hasSelectedClip && styles.actionBtnDisabled]}
                  onPress={hasSelectedClip ? onToggleReverse : undefined}
                  disabled={!hasSelectedClip}
                  accessibilityLabel="Reverse clip"
                >
                  <Ionicons name="swap-horizontal-outline" size={12} color={hasSelectedClip ? "#A78BFA" : "#64748B"} />
                  <Text style={styles.actionBtnText}>Reverse</Text>
                </TouchableOpacity>
              )}
              {onDeleteClip && (
                <TouchableOpacity
                  style={[styles.actionBtn, !hasSelectedClip && styles.actionBtnDisabled]}
                  onPress={hasSelectedClip ? onDeleteClip : undefined}
                  disabled={!hasSelectedClip}
                  accessibilityLabel="Delete selected clip"
                >
                  <Ionicons name="trash-outline" size={12} color={hasSelectedClip ? "#EF4444" : "#64748B"} />
                  <Text style={[styles.actionBtnText, hasSelectedClip && { color: "#FCA5A5" }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Selected Clip Time Details */}
          {activeClipInfo ? (
            <View style={styles.activeClipTimeframePill}>
              <View
                style={[
                  styles.activeClipTypeBadge,
                  { backgroundColor: activeClipInfo.color },
                ]}
              >
                <Text style={styles.activeClipTypeBadgeText}>
                  {activeClipInfo.type} • T{activeClipInfo.trackIndex + 1}
                </Text>
              </View>
              <Ionicons name="time-outline" size={10} color="#A1A1AA" />
              <Text style={styles.activeClipTimeframeText} numberOfLines={1}>
                {isMobile
                  ? `${activeClipInfo.duration.toFixed(1)}s`
                  : `${activeClipInfo.start.toFixed(2)}s ➔ ${(activeClipInfo.start + activeClipInfo.duration).toFixed(2)}s (${activeClipInfo.duration.toFixed(2)}s)`}
              </Text>
              {onDeselectClip && (
                <TouchableOpacity
                  onPress={onDeselectClip}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 4, opacity: 0.8 }}
                  accessibilityLabel="Deselect clip"
                >
                  <Ionicons name="close-circle" size={13} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>

        {/* Fluid Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => onZoomChange(Math.max(20, pxPerSec - 25))}
            activeOpacity={0.7}
            accessibilityLabel="Zoom Out"
          >
            <Ionicons name="remove" size={12} color="#8E95A5" />
          </TouchableOpacity>

          <Text style={styles.zoomText}>{isMobile ? `${pxPerSec}` : `${pxPerSec}px/s`}</Text>

          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => onZoomChange(Math.min(1000, pxPerSec + 25))}
            activeOpacity={0.7}
            accessibilityLabel="Zoom In"
          >
            <Ionicons name="add" size={12} color="#8E95A5" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

export default React.memo(TimelineHeaderBar);
