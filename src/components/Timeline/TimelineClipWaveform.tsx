import React, { useMemo, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { UnifiedClipItem } from "./timelineTypes";
import {
  clipHasAudio,
  getClipWaveformPeaks,
  extractRealMediaAudioPeaks,
  isMediaAudioDecoding,
  subscribeMediaAudioChange,
} from "../../utils/mediaAudioDetector";

interface TimelineClipWaveformProps {
  clip: UnifiedClipItem;
  width: number;
  isSelected?: boolean;
}

const TimelineClipWaveformComponent: React.FC<TimelineClipWaveformProps> = ({
  clip,
  width,
  isSelected,
}) => {
  const isAudio = clip.type === "audio";
  const isVideo = clip.type === "video";
  const hasAudio = clipHasAudio(clip);

  const raw = clip.rawClip || {};
  const duration = clip.duration || 5;
  const trimIn = raw.trimIn || 0;
  const speed = raw.speed || 1.0;
  const volume = raw.volume ?? 1.0;
  const url = raw.url;

  // Re-render when background audio peak decoding completes
  const [, setTick] = useState(0);
  useEffect(() => {
    return subscribeMediaAudioChange(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Trigger real audio extraction as soon as clip mounts or URL changes
  useEffect(() => {
    if ((isAudio || isVideo) && url && raw.type !== "photo" && !raw.isEnding) {
      extractRealMediaAudioPeaks(url, clip.id);
    }
  }, [isAudio, isVideo, url, clip.id, raw.type, raw.isEnding]);

  // Compute waveform peaks based on real decoded PCM audio data
  const barWidth = 2;
  const barGap = 1.5;
  const availableWidth = Math.max(8, width - 8);

  const peaks = useMemo(() => {
    if (!hasAudio) return [];
    return getClipWaveformPeaks(
      clip.id,
      url,
      availableWidth,
      duration,
      trimIn,
      speed,
      barWidth,
      barGap,
    );
  }, [hasAudio, clip.id, url, availableWidth, duration, trimIn, speed, barWidth, barGap]);

  const isDecoding = isMediaAudioDecoding(url);

  // If peaks are still decoding in the background, show clean processing skeleton
  if (peaks.length === 0) {
    if (isDecoding && hasAudio) {
      return (
        <View
          style={isAudio ? styles.audioLoadingOverlay : styles.videoLoadingOverlay}
          pointerEvents="none"
        >
          <View style={styles.loadingPulseRow}>
            <ActivityIndicator size="small" color={isAudio ? "#34D399" : "#00F2FE"} />
            {availableWidth > 75 && (
              <Text
                style={[
                  styles.loadingAudioText,
                  { color: isAudio ? "#34D399" : "#00F2FE" },
                ]}
                numberOfLines={1}
              >
                Analyzing Audio...
              </Text>
            )}
            <View style={styles.shimmerBarsRow}>
              {[0.35, 0.75, 0.5, 0.9, 0.6, 0.8, 0.45].map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.loadingBar,
                    {
                      height: Math.round(h * (isAudio ? 20 : 13)),
                      backgroundColor: isAudio ? "#34D399" : "#00F2FE",
                      opacity: 0.35 + (i % 3) * 0.25,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      );
    }
    return null;
  }

  const volumeScale = Math.min(1.5, Math.max(0.2, volume));

  // Audio clip: full-height centered waveform across the whole clip
  if (isAudio) {
    return (
      <View style={styles.audioWaveformOverlay} pointerEvents="none">
        <View style={styles.audioBarsRow}>
          {peaks.map((peak, idx) => (
            <View
              key={idx}
              style={[
                styles.audioWaveBar,
                {
                  height: Math.max(3, Math.min(32, Math.round(peak * 30 * volumeScale))),
                  backgroundColor: isSelected ? "#6EE7B7" : "#34D399",
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  // Video clip: genuine audio waveform across the whole clip body
  if (isVideo) {
    return (
      <View style={styles.videoWaveformOverlay} pointerEvents="none">
        <View style={styles.videoBarsRow}>
          {peaks.map((peak, idx) => (
            <View
              key={idx}
              style={[
                styles.videoWaveBar,
                {
                  height: Math.max(2, Math.min(30, Math.round(peak * 26 * volumeScale))),
                  backgroundColor: isSelected
                    ? "rgba(56, 189, 248, 0.95)"
                    : "rgba(0, 242, 254, 0.65)",
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  audioWaveformOverlay: {
    position: "absolute",
    left: 2,
    right: 2,
    top: 4,
    bottom: 4,
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 1,
  },
  audioBarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1.5,
    height: "100%",
  },
  audioWaveBar: {
    width: 2,
    borderRadius: 1,
    opacity: 0.92,
  },
  videoWaveformOverlay: {
    position: "absolute",
    left: 2,
    right: 2,
    top: 4,
    bottom: 2,
    justifyContent: "flex-end",
    overflow: "hidden",
    zIndex: 1,
  },
  videoBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1.5,
    height: "100%",
  },
  videoWaveBar: {
    width: 2,
    borderRadius: 1,
  },
  audioLoadingOverlay: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 1,
  },
  videoLoadingOverlay: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 4,
    bottom: 2,
    justifyContent: "flex-end",
    overflow: "hidden",
    zIndex: 1,
  },
  loadingPulseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    opacity: 0.85,
    paddingBottom: 2,
  },
  loadingAudioText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  shimmerBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1.5,
    marginLeft: 2,
  },
  loadingBar: {
    width: 2,
    borderRadius: 1,
  },
});

export const TimelineClipWaveform = React.memo(TimelineClipWaveformComponent);
export default TimelineClipWaveform;
