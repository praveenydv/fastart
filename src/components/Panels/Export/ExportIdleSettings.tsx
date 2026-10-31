import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { ExportFormat } from "../../../utils/videoRenderer";
import {
  MEDIA_FORMATS,
  RESOLUTIONS,
  FRAME_RATES,
  MediaFormatOption,
} from "./exportTypes";
import { styles } from "./ExportModalStyles";

interface ExportIdleSettingsProps {
  mediaType: ExportFormat;
  setMediaType: (fmt: ExportFormat) => void;
  resolution: string;
  setResolution: (res: string) => void;
  fps: number;
  setFps: (fps: number) => void;
  exportFilename: string;
  setExportFilename: (name: string) => void;
  selectedFormatConfig: MediaFormatOption;
  project: any;
  totalDuration: number;
  calculateEstimatedSize: () => string;
  onStartExport: () => void;
  isDesktop?: boolean;
}

export default function ExportIdleSettings({
  mediaType,
  setMediaType,
  resolution,
  setResolution,
  fps,
  setFps,
  exportFilename,
  setExportFilename,
  selectedFormatConfig,
  project,
  totalDuration,
  calculateEstimatedSize,
  onStartExport,
  isDesktop: propIsDesktop,
}: ExportIdleSettingsProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = propIsDesktop ?? windowWidth >= 768;

  const aspectRatio = project?.aspectRatio || "9:16";

  // Calculate proportional mock canvas size for desktop preview
  const canvasFrameDimensions = useMemo(() => {
    switch (aspectRatio) {
      case "16:9":
        return { width: 176, height: 99 };
      case "1:1":
        return { width: 120, height: 120 };
      case "4:5":
        return { width: 110, height: 138 };
      case "2.35:1":
        return { width: 180, height: 76 };
      case "9:16":
      default:
        return { width: 88, height: 156 };
    }
  }, [aspectRatio]);

  // Track breakdown
  const mediaCount =
    (project?.tracks?.video?.length || 0) +
    (project?.tracks?.media?.length || 0) +
    (project?.tracks?.overlay?.length || 0);
  const audioCount = project?.tracks?.audio?.length || 0;
  const textCount =
    (project?.tracks?.text?.length || 0) +
    (project?.tracks?.sticker?.length || 0);

  const getCodecName = () => {
    switch (mediaType) {
      case "mp4":
        return "H.264 / AAC";
      case "webm":
        return "VP9 / Opus";
      case "gif":
        return "Animated GIF";
      case "png":
        return "Lossless PNG";
      case "wav":
        return "16-bit PCM";
      default:
        return "Auto";
    }
  };

  const formattedDuration = `${Math.floor(totalDuration / 60)
    .toString()
    .padStart(2, "0")}:${(totalDuration % 60).toFixed(1).padStart(4, "0")}`;

  const renderControls = () => (
    <>
      {/* 1. FILE NAME */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>FILE NAME</Text>
        <Text style={styles.sectionHint} numberOfLines={1}>
          Output name
        </Text>
      </View>

      <View style={styles.fileNameInputContainer}>
        <Ionicons name="document-text-outline" size={16} color="#00F2FE" />
        <TextInput
          style={styles.fileNameInput}
          value={exportFilename}
          onChangeText={setExportFilename}
          placeholder="File name..."
          placeholderTextColor="#64748B"
          maxLength={60}
          selectTextOnFocus
        />
        <View style={styles.extBadge}>
          <Text style={styles.extBadgeText}>{selectedFormatConfig.ext}</Text>
        </View>
      </View>

      {/* 2. MEDIA FORMAT CHIPS */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>EXPORT FORMAT</Text>
        <Text style={styles.sectionHint} numberOfLines={1}>
          {selectedFormatConfig.desc}
        </Text>
      </View>

      <View style={styles.formatChipRow}>
        {MEDIA_FORMATS.map((fmt) => {
          const isSelected = mediaType === fmt.id;
          return (
            <TouchableOpacity
              key={fmt.id}
              style={[styles.formatChip, isSelected && styles.formatChipActive]}
              onPress={() => {
                setMediaType(fmt.id);
                soundEngine.playSfx("click");
              }}
              activeOpacity={0.7}
            >
              <View style={styles.formatChipHeader}>
                <Ionicons
                  name={fmt.icon}
                  size={14}
                  color={isSelected ? "#00F2FE" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.formatChipText,
                    isSelected && styles.formatChipTextActive,
                  ]}
                >
                  {fmt.shortLabel}
                </Text>
              </View>

              <View
                style={[
                  styles.formatChipBadge,
                  isSelected && styles.formatChipBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.formatChipBadgeText,
                    isSelected && styles.formatChipBadgeTextActive,
                  ]}
                >
                  {fmt.badge}
                </Text>
              </View>

              {fmt.isRecommended && (
                <View
                  style={[styles.recDot, isSelected && styles.recDotActive]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. RESOLUTION */}
      {mediaType !== "wav" && (
        <View style={styles.specSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>RESOLUTION</Text>
            <Text style={styles.sectionHint}>Aspect Ratio {aspectRatio}</Text>
          </View>
          <View style={styles.compactRow}>
            {RESOLUTIONS.map((r) => {
              const isSel = resolution === r;
              const badgeLabel =
                r === "720p" ? "HD" : r === "1080p" ? "FHD" : "4K";
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.compactPill,
                    isSel && styles.compactPillActive,
                  ]}
                  onPress={() => {
                    setResolution(r);
                    soundEngine.playSfx("click");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.compactPillText,
                      isSel && styles.compactPillTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                  <View
                    style={[
                      styles.tagBadge,
                      isSel && styles.tagBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagBadgeText,
                        isSel && styles.tagBadgeTextActive,
                      ]}
                    >
                      {badgeLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 4. FRAME RATE */}
      {mediaType !== "png" && mediaType !== "wav" && (
        <View style={styles.specSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>FRAME RATE</Text>
            <Text style={styles.sectionHint}>
              {mediaType === "gif" ? "Max 12fps for GIF" : "Smooth Playback"}
            </Text>
          </View>
          <View style={styles.compactRow}>
            {FRAME_RATES.map((f) => {
              const isSel = fps === f;
              const rateLabel =
                f === 24 ? "Cinematic" : f === 30 ? "Standard" : "Smooth";
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.compactPill,
                    isSel && styles.compactPillActive,
                  ]}
                  onPress={() => {
                    setFps(f);
                    soundEngine.playSfx("click");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.compactPillText,
                      isSel && styles.compactPillTextActive,
                    ]}
                  >
                    {f} FPS
                  </Text>
                  <View
                    style={[
                      styles.tagBadge,
                      isSel && styles.tagBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagBadgeText,
                        isSel && styles.tagBadgeTextActive,
                      ]}
                    >
                      {rateLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* SPECIAL NOTICES FOR WAV / STILL FRAME */}
      {mediaType === "wav" && (
        <View style={styles.noticeCard}>
          <Ionicons name="musical-notes" size={15} color="#00F2FE" />
          <Text style={styles.noticeCardText}>
            Master 16-bit 48kHz Stereo PCM audio mixdown from all audio and video tracks.
          </Text>
        </View>
      )}
      {mediaType === "png" && (
        <View style={styles.noticeCard}>
          <Ionicons name="image" size={15} color="#00F2FE" />
          <Text style={styles.noticeCardText}>
            Single full-resolution lossless snapshot frame captured at current playhead position.
          </Text>
        </View>
      )}

      {/* 5. COMPACT STATS STRIP */}
      <View style={styles.compactSummaryCard}>
        <View style={styles.summaryItem}>
          <Ionicons name="document-text-outline" size={13} color="#00F2FE" />
          <Text style={styles.summaryValue}>
            {selectedFormatConfig.shortLabel}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Ionicons name="speedometer-outline" size={13} color="#00F2FE" />
          <Text style={styles.summaryValue}>{calculateEstimatedSize()}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Ionicons name="time-outline" size={13} color="#00F2FE" />
          <Text style={styles.summaryValue}>
            {mediaType === "png" ? "1 Frame" : `${totalDuration.toFixed(1)}s`}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Ionicons name="crop-outline" size={13} color="#00F2FE" />
          <Text style={styles.summaryValue}>{aspectRatio}</Text>
        </View>
      </View>

      {/* 6. PRIMARY EXPORT CTA */}
      <TouchableOpacity
        style={styles.exportCtaBtn}
        onPress={onStartExport}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-up-circle-outline" size={19} color="#08090E" />
        <Text style={styles.exportCtaText}>
          Export {selectedFormatConfig.shortLabel}
          {mediaType !== "wav" && mediaType !== "png" ? ` (${resolution})` : ""}
        </Text>
      </TouchableOpacity>
    </>
  );

  if (isDesktop) {
    return (
      <View style={styles.desktopColumns}>
        {/* Left Column: Project Preview & Canvas Info */}
        <View style={styles.desktopLeftColumn}>
          <View style={styles.previewCard}>
            <View style={styles.previewCardHeader}>
              <Text style={styles.previewCardTitle}>CANVAS PREVIEW</Text>
              <View style={styles.previewAspectPill}>
                <Text style={styles.previewAspectPillText}>{aspectRatio}</Text>
              </View>
            </View>

            <View style={styles.canvasPreviewViewport}>
              <View
                style={[
                  styles.canvasMockFrame,
                  {
                    width: canvasFrameDimensions.width,
                    height: canvasFrameDimensions.height,
                  },
                ]}
              >
                <View style={styles.canvasCenterEmblem}>
                  <Ionicons name="play" size={14} color="#00F2FE" style={{ marginLeft: 2 }} />
                </View>

                {mediaType !== "wav" && (
                  <View style={styles.canvasResStamp}>
                    <Text style={styles.canvasResStampText}>{resolution}</Text>
                  </View>
                )}

                <View style={styles.canvasDurationStamp}>
                  <Text style={styles.canvasDurationStampText}>
                    {mediaType === "png" ? "1F" : formattedDuration}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Project Specs Card */}
          <View style={styles.projectSpecsCard}>
            <View style={styles.projectSpecsRow}>
              <Text style={styles.projectSpecLabel}>Codec</Text>
              <Text style={styles.projectSpecValue}>{getCodecName()}</Text>
            </View>

            <View style={styles.projectSpecsRow}>
              <Text style={styles.projectSpecLabel}>Est. Size</Text>
              <Text style={styles.projectSpecValue}>{calculateEstimatedSize()}</Text>
            </View>

            <View style={styles.projectSpecsRow}>
              <Text style={styles.projectSpecLabel}>Duration</Text>
              <Text style={styles.projectSpecValue}>{totalDuration.toFixed(1)}s</Text>
            </View>

            <View style={styles.trackBadgesRow}>
              {mediaCount > 0 && (
                <View style={styles.trackBadgeItem}>
                  <Ionicons name="videocam-outline" size={11} color="#00F2FE" />
                  <Text style={styles.trackBadgeText}>{mediaCount} Media</Text>
                </View>
              )}
              {audioCount > 0 && (
                <View style={styles.trackBadgeItem}>
                  <Ionicons name="musical-notes-outline" size={11} color="#00F2FE" />
                  <Text style={styles.trackBadgeText}>{audioCount} Audio</Text>
                </View>
              )}
              {textCount > 0 && (
                <View style={styles.trackBadgeItem}>
                  <Ionicons name="text-outline" size={11} color="#00F2FE" />
                  <Text style={styles.trackBadgeText}>{textCount} Text</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Right Column: Settings & CTA */}
        <View style={styles.desktopRightColumn}>{renderControls()}</View>
      </View>
    );
  }

  // Small screen mobile view
  return <View>{renderControls()}</View>;
}
