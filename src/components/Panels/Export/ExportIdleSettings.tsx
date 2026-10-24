import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
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
}: ExportIdleSettingsProps) {
  return (
    <>
      {/* 1. FILE NAME (Synced with project name, never key) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>FILE NAME</Text>
        <Text style={styles.sectionHint} numberOfLines={1}>
          Saved as project name
        </Text>
      </View>

      <View style={styles.fileNameInputContainer}>
        <Ionicons name="document-text-outline" size={16} color="#A1A1AA" />
        <TextInput
          style={styles.fileNameInput}
          value={exportFilename}
          onChangeText={setExportFilename}
          placeholder="File name..."
          placeholderTextColor="#71717A"
          maxLength={60}
          selectTextOnFocus
        />
        <View style={styles.extBadge}>
          <Text style={styles.extBadgeText}>{selectedFormatConfig.ext}</Text>
        </View>
      </View>

      {/* 2. MEDIA FORMAT PILLS */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>FORMAT</Text>
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
              <Ionicons
                name={fmt.icon}
                size={13}
                color={isSelected ? "#000000" : "#8E95A5"}
              />
              <Text
                style={[
                  styles.formatChipText,
                  isSelected && styles.formatChipTextActive,
                ]}
              >
                {fmt.shortLabel}
              </Text>
              {fmt.isRecommended && (
                <View
                  style={[styles.recDot, isSelected && styles.recDotActive]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2. RESOLUTION */}
      {mediaType !== "wav" && (
        <View style={styles.specSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>RESOLUTION</Text>
            <Text style={styles.sectionHint}>
              {project.aspectRatio || "9:16"}
            </Text>
          </View>
          <View style={styles.compactRow}>
            {RESOLUTIONS.map((r) => {
              const isSel = resolution === r;
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
                  {r === "1080p" && (
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
                        HD
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 3. FRAME RATE (For video & GIF) */}
      {mediaType !== "png" && mediaType !== "wav" && (
        <View style={styles.specSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>FRAME RATE</Text>
            <Text style={styles.sectionHint}>
              {mediaType === "gif" ? "Max 12fps for GIF" : "Smooth motion"}
            </Text>
          </View>
          <View style={styles.compactRow}>
            {FRAME_RATES.map((f) => {
              const isSel = fps === f;
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* SPECIAL NOTICES FOR WAV / STILL FRAME */}
      {mediaType === "wav" && (
        <View style={styles.noticeCard}>
          <Ionicons name="musical-notes" size={15} color="#FFFFFF" />
          <Text style={styles.noticeCardText}>
            Master 16-bit 48kHz Stereo PCM audio mixdown from all tracks.
          </Text>
        </View>
      )}
      {mediaType === "png" && (
        <View style={styles.noticeCard}>
          <Ionicons name="image" size={15} color="#FFFFFF" />
          <Text style={styles.noticeCardText}>
            Single full-resolution lossless snapshot frame captured at playhead.
          </Text>
        </View>
      )}

      {/* 4. COMPACT STATS STRIP */}
      <View style={styles.compactSummaryCard}>
        <View style={styles.summaryItem}>
          <Ionicons name="document-text-outline" size={12} color="#A1A1AA" />
          <Text style={styles.summaryValue}>
            {selectedFormatConfig.shortLabel}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Ionicons name="speedometer-outline" size={12} color="#A1A1AA" />
          <Text style={styles.summaryValue}>{calculateEstimatedSize()}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Ionicons name="time-outline" size={12} color="#A1A1AA" />
          <Text style={styles.summaryValue}>
            {mediaType === "png" ? "1 Frame" : `${totalDuration.toFixed(1)}s`}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Ionicons name="crop-outline" size={12} color="#A1A1AA" />
          <Text style={styles.summaryValue}>
            {project.aspectRatio || "9:16"}
          </Text>
        </View>
      </View>

      {/* 5. PRIMARY EXPORT CTA */}
      <TouchableOpacity
        style={styles.exportCtaBtn}
        onPress={onStartExport}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-up-circle-outline" size={18} color="#000000" />
        <Text style={styles.exportCtaText}>
          Export {selectedFormatConfig.shortLabel}
        </Text>
      </TouchableOpacity>
    </>
  );
}
