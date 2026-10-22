import React, { useMemo, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UnifiedClipItem } from "./timelineTypes";
import {
  clipHasAudio,
  mediaHasAudioTrack,
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
  const hasAudioTrack = mediaHasAudioTrack(clip);
  const hasAudio = clipHasAudio(clip) && hasAudioTrack;

  const raw = clip.rawClip || {};
  const duration = clip.duration || 5;
  const trimIn = raw.trimIn || 0;
  const speed = raw.speed || 1.0;
  const volume = raw.volume ?? 1.0;
  const url = raw.url;
  const isDenoised = Boolean(raw.denoise);
  const clipPeaks = raw.peaks;
  const clipMediaDuration = raw.mediaDuration;

  // Re-render when background audio peak decoding completes
  const [, setTick] = useState(0);
  useEffect(() => {
    return subscribeMediaAudioChange(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Trigger real audio extraction as soon as clip mounts or URL changes
  useEffect(() => {
    if (
      (isAudio || isVideo) &&
      url &&
      raw.type !== "photo" &&
      !raw.isEnding
    ) {
      extractRealMediaAudioPeaks(url, clip.id).then((extracted) => {
        if (extracted && extracted.length > 0 && !raw.peaks) {
          raw.peaks = extracted;
        }
      });
    }
  }, [isAudio, isVideo, url, clip.id, raw.type, raw.isEnding]);

  // Compute waveform peaks based on real decoded PCM audio data
  const barWidth = 2.0;
  const barGap = 1.5;
  const availableWidth = Math.max(10, width - 6);

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
      isDenoised,
      clipPeaks,
      clipMediaDuration,
    );
  }, [
    hasAudio,
    clip.id,
    url,
    availableWidth,
    duration,
    trimIn,
    speed,
    barWidth,
    barGap,
    isDenoised,
    clipPeaks,
    clipMediaDuration,
  ]);

  const isDecoding = isMediaAudioDecoding(url);

  // If peaks are still decoding in the background, show clean processing skeleton
  if (peaks.length === 0) {
    if ((isDecoding || hasAudio) && hasAudio && raw.type !== "photo" && !raw.isEnding) {
      return (
        <View
          style={isAudio ? styles.audioLoadingOverlay : styles.videoLoadingOverlay}
          pointerEvents="none"
        >
          <View style={styles.loadingPulseRow}>
            <ActivityIndicator
              size="small"
              color={isDenoised ? "#10B981" : isAudio ? "#34D399" : "#00F2FE"}
            />
            {availableWidth > 80 && (
              <Text
                style={[
                  styles.loadingAudioText,
                  {
                    color: isDenoised
                      ? "#10B981"
                      : isAudio
                        ? "#34D399"
                        : "#00F2FE",
                  },
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
                      backgroundColor: isDenoised
                        ? "#10B981"
                        : isAudio
                          ? "#34D399"
                          : "#00F2FE",
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
  const numBars = peaks.length;
  const dynamicGap =
    numBars > 1
      ? Math.max(0.5, (availableWidth - numBars * barWidth) / (numBars - 1))
      : 0;

  // Audio clip: full-height centered waveform across the whole clip
  if (isAudio) {
    const barColor = isDenoised
      ? isSelected
        ? "#34D399"
        : "#10B981"
      : isSelected
        ? "#6EE7B7"
        : "#34D399";

    return (
      <View style={styles.audioWaveformOverlay} pointerEvents="none">
        {/* Denoised Status Indicator */}
        {isDenoised && availableWidth > 60 && (
          <View style={styles.denoiseBadge}>
            <Ionicons name="sparkles" size={8} color="#10B981" />
            <Text style={styles.denoiseBadgeText}>AI Denoise</Text>
          </View>
        )}

        <View style={styles.audioBarsRow}>
          {peaks.map((peak, idx) => (
            <View
              key={idx}
              style={[
                styles.audioWaveBar,
                {
                  height: Math.max(
                    3,
                    Math.min(34, Math.round(peak * 32 * volumeScale)),
                  ),
                  backgroundColor: barColor,
                  marginRight: idx === numBars - 1 ? 0 : dynamicGap,
                  shadowColor: isDenoised ? "#10B981" : "transparent",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isDenoised ? 0.6 : 0,
                  shadowRadius: 2,
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
    const videoBarColor = isDenoised
      ? isSelected
        ? "#34D399"
        : "#10B981"
      : isSelected
        ? "rgba(56, 189, 248, 0.98)"
        : "rgba(0, 242, 254, 0.75)";

    return (
      <View style={styles.videoWaveformOverlay} pointerEvents="none">
        {/* Clean dark backdrop strip for high contrast across video thumbnails/cards */}
        <View style={styles.videoBackdropBand}>
          {isDenoised && availableWidth > 70 && (
            <View style={styles.videoDenoiseTag}>
              <Ionicons name="sparkles" size={7} color="#10B981" />
              <Text style={styles.videoDenoiseTagText}>Denoised</Text>
            </View>
          )}

          <View style={styles.videoBarsRow}>
            {peaks.map((peak, idx) => (
              <View
                key={idx}
                style={[
                  styles.videoWaveBar,
                  {
                    height: Math.max(
                      2,
                      Math.min(26, Math.round(peak * 24 * volumeScale)),
                    ),
                    backgroundColor: videoBarColor,
                    marginRight: idx === numBars - 1 ? 0 : dynamicGap,
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
};

const styles = StyleSheet.create({
  audioWaveformOverlay: {
    position: "absolute",
    left: 3,
    right: 3,
    top: 2,
    bottom: 2,
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 1,
  },
  audioBarsRow: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    width: "100%",
  },
  audioWaveBar: {
    width: 2.0,
    borderRadius: 1,
    opacity: 0.95,
  },
  denoiseBadge: {
    position: "absolute",
    top: 2,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(6, 78, 59, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 4,
  },
  denoiseBadgeText: {
    color: "#6EE7B7",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  videoWaveformOverlay: {
    position: "absolute",
    left: 2,
    right: 2,
    bottom: 2,
    height: 30,
    justifyContent: "flex-end",
    overflow: "hidden",
    zIndex: 1,
  },
  videoBackdropBand: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(3, 7, 18, 0.6)",
    borderRadius: 4,
    paddingHorizontal: 2,
    justifyContent: "flex-end",
  },
  videoDenoiseTag: {
    position: "absolute",
    top: 2,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  videoDenoiseTagText: {
    color: "#10B981",
    fontSize: 7,
    fontWeight: "800",
  },
  videoBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 26,
    width: "100%",
  },
  videoWaveBar: {
    width: 2.0,
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
