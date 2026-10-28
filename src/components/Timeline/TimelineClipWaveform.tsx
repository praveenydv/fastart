import React, { useMemo, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
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

  const raw = clip.rawClip || {};
  const isMuted = raw.volume === 0 || raw.muted === true;
  // Render waveform if the media contains an audio track, even if muted or extracted
  const shouldRenderWaveform = hasAudioTrack && raw.type !== "photo" && !raw.isEnding;

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
  // Identical 4px horizontal insets on both video and audio
  const horizontalInset = 4;
  const availableWidth = Math.max(10, width - horizontalInset * 2);

  const peaks = useMemo(() => {
    if (!shouldRenderWaveform) return [];
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
    shouldRenderWaveform,
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
    if (shouldRenderWaveform && (isDecoding || Boolean(url))) {
      return (
        <View
          style={isAudio ? styles.audioLoadingOverlay : styles.videoLoadingOverlay}
          pointerEvents="none"
        >
          <View style={styles.loadingPulseRow}>
            <ActivityIndicator
              size="small"
              color={isDenoised ? "#10B981" : isAudio ? "#34D399" : "#FFFFFF"}
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
                        : "#FFFFFF",
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
                      height: Math.round(h * 20),
                      backgroundColor: isDenoised
                        ? "#10B981"
                        : isAudio
                          ? "#34D399"
                          : "#FFFFFF",
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

  const numBars = peaks.length;
  const dynamicGap =
    numBars > 1
      ? Math.max(0.5, (availableWidth - numBars * barWidth) / (numBars - 1))
      : 0;

  // Maximum bar height is 28px on both media and separate audio so waveforms match proportionally
  const maxBarHeight = 28;
  const minBarHeight = 3;

interface WebWaveformCanvasProps {
  peaks: number[];
  availableWidth: number;
  height: number;
  barColor: string;
  isBottomAnchored?: boolean;
}

const WebWaveformCanvas: React.FC<WebWaveformCanvasProps> = ({
  peaks,
  availableWidth,
  height,
  barColor,
  isBottomAnchored = false,
}) => {
  const canvasRef = React.useRef<any>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) return;
    ctx.clearRect(0, 0, availableWidth, height);
    ctx.fillStyle = barColor;

    const numBars = peaks.length;
    const barWidth = 2.0;
    const dynamicGap =
      numBars > 1 ? Math.max(0.5, (availableWidth - numBars * barWidth) / (numBars - 1)) : 0;
    const minH = 2;

    for (let i = 0; i < numBars; i++) {
      const h = Math.max(minH, Math.min(height, Math.round(peaks[i] * height)));
      const x = i * (barWidth + dynamicGap);
      const y = isBottomAnchored ? height - h : (height - h) / 2;
      ctx.fillRect(x, y, barWidth, h);
    }
  }, [peaks, availableWidth, height, barColor, isBottomAnchored]);

  return (
    <canvas
      ref={canvasRef}
      width={availableWidth}
      height={height}
      style={{
        width: availableWidth,
        height,
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
};

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

        {Platform.OS === "web" ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <WebWaveformCanvas
              peaks={peaks}
              availableWidth={availableWidth}
              height={maxBarHeight}
              barColor={barColor}
            />
          </View>
        ) : (
          <View style={styles.barsRow}>
            {peaks.map((peak, idx) => (
              <View
                key={idx}
                style={[
                  styles.waveBar,
                  {
                    height: Math.max(
                      minBarHeight,
                      Math.min(maxBarHeight, Math.round(peak * maxBarHeight)),
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
        )}
      </View>
    );
  }

  // Video clip: genuine audio waveform across the clip body in the same centered way
  if (isVideo) {
    const videoBarColor = isDenoised
      ? isSelected
        ? "#34D399"
        : "#10B981"
      : isMuted
        ? isSelected
          ? "rgba(56, 189, 248, 0.7)"
          : "rgba(148, 163, 184, 0.55)"
        : isSelected
          ? "rgba(56, 189, 248, 0.98)"
          : "rgba(0, 242, 254, 0.85)";

    return (
      <View style={styles.videoWaveformOverlay} pointerEvents="none">
        {/* Transparent bottom-anchored band so video preview remains 100% visible */}
        <View style={styles.videoBackdropBand}>
          {isDenoised && availableWidth > 70 && (
            <View style={styles.videoDenoiseTag}>
              <Ionicons name="sparkles" size={7} color="#10B981" />
              <Text style={styles.videoDenoiseTagText}>Denoised</Text>
            </View>
          )}

          {isMuted && !isDenoised && availableWidth > 65 && (
            <View style={styles.videoMutedTag}>
              <Ionicons name="volume-mute" size={8} color="#94A3B8" />
              <Text style={styles.videoMutedTagText}>Muted</Text>
            </View>
          )}

          {Platform.OS === "web" ? (
            <View style={{ height: 10, justifyContent: "flex-end", alignItems: "center" }}>
              <WebWaveformCanvas
                peaks={peaks}
                availableWidth={availableWidth}
                height={10}
                barColor={videoBarColor}
                isBottomAnchored={true}
              />
            </View>
          ) : (
            <View style={styles.barsRowBottom}>
              {peaks.map((peak, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.waveBar,
                    {
                      height: Math.max(
                        minBarHeight,
                        Math.min(10, Math.round(peak * 10)),
                      ),
                      backgroundColor: videoBarColor,
                      marginRight: idx === numBars - 1 ? 0 : dynamicGap,
                      opacity: isMuted ? 0.6 : 0.95,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  audioWaveformOverlay: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 2,
    bottom: 2,
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 2,
  },
  videoWaveformOverlay: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 2,
    height: 14,
    justifyContent: "flex-end",
    overflow: "hidden",
    zIndex: 2,
  },
  videoBackdropBand: {
    width: "100%",
    height: 14,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    width: "100%",
  },
  barsRowBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 12,
    width: "100%",
  },
  waveBar: {
    width: 2.0,
    borderRadius: 1,
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
    zIndex: 4,
  },
  videoDenoiseTagText: {
    color: "#10B981",
    fontSize: 7,
    fontWeight: "800",
  },
  videoMutedTag: {
    position: "absolute",
    top: 2,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    zIndex: 4,
  },
  videoMutedTagText: {
    color: "#94A3B8",
    fontSize: 7,
    fontWeight: "700",
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
    bottom: 2,
    height: 12,
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
    alignItems: "center",
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
