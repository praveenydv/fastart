import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./TimelineStyles";

interface TimelineHeaderBarProps {
  isResizingHeight: boolean;
  handleResizeMouseDown: any;
  handleResetResizeHeight: any;
  handleResizeTouchStart: any;
  handleResizeTouchMove: any;
  handleResizeTouchEnd: any;
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
}

export const TimelineHeaderBar: React.FC<TimelineHeaderBarProps> = ({
  isResizingHeight,
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
}) => {
  return (
    <>
      {/* Interactive Top Drag-to-Resize Handle */}
      <View
        style={[
          styles.resizeHandleBar,
          isResizingHeight && styles.resizeHandleBarActive,
        ]}
        {...(Platform.OS === "web"
          ? {
              onMouseDown: handleResizeMouseDown,
              onDoubleClick: handleResetResizeHeight,
            }
          : {})}
        onTouchStart={handleResizeTouchStart}
        onTouchMove={handleResizeTouchMove}
        onTouchEnd={handleResizeTouchEnd}
        accessibilityLabel="Drag up or down to adjust timeline height"
      >
        <View
          style={[
            styles.resizeGripPill,
            isResizingHeight && styles.resizeGripPillActive,
          ]}
        />
      </View>

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
              <Ionicons name="time-outline" size={10} color="#00F2FE" />
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
