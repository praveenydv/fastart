import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExportFormat } from "../../../utils/videoRenderer";
import { MediaFormatOption } from "./exportTypes";
import { styles } from "./ExportModalStyles";

interface ExportResultViewProps {
  status: "rendering" | "done" | "error";
  progress: number;
  getProgressStatusMessage: () => string;
  selectedFormatConfig: MediaFormatOption;
  mediaType: ExportFormat;
  resolution: string;
  fps: number;
  isSaved: boolean;
  isSaving: boolean;
  downloadDestination?: string;
  downloadFilename?: string;
  errorMessage: string | null;
  onDownload: () => void;
  onReExport: () => void;
  onClose: () => void;
  onCancelExport?: () => void;
  exportFilename?: string;
}

export default function ExportResultView({
  status,
  progress,
  getProgressStatusMessage,
  selectedFormatConfig,
  mediaType,
  resolution,
  fps,
  isSaved,
  isSaving,
  downloadDestination,
  downloadFilename,
  errorMessage,
  onDownload,
  onReExport,
  onClose,
  onCancelExport,
  exportFilename,
}: ExportResultViewProps) {
  if (status === "rendering") {
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressRadialBox}>
          <Text style={styles.progressPercent}>{progress}%</Text>
        </View>

        <Text style={styles.progressStatusText}>
          {getProgressStatusMessage()}
        </Text>

        <View style={styles.progressBarTrack}>
          <View
            style={[styles.progressBarFill, { width: `${progress}%` }]}
          />
        </View>

        <Text style={styles.formatProgressNotice}>
          Encoding {selectedFormatConfig.label} ({selectedFormatConfig.ext}) with all edits
        </Text>

        {onCancelExport && (
          <TouchableOpacity
            style={styles.cancelExportBtn}
            onPress={onCancelExport}
            activeOpacity={0.7}
            accessibilityLabel="Cancel Export"
          >
            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
            <Text style={styles.cancelExportBtnText}>Cancel Export</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (status === "done") {
    const isWeb = Platform.OS === "web";
    const isIOS = Platform.OS === "ios";
    const isAndroid = Platform.OS === "android";

    const defaultLocation = isWeb
      ? "Downloads Folder"
      : isIOS
      ? "Photos & Files"
      : "Gallery & Files";

    const finalLocation = downloadDestination || defaultLocation;

    const getButtonText = () => {
      if (isSaving) {
        return isWeb ? "Downloading file..." : "Saving directly to device...";
      }
      if (isSaved) {
        return isWeb ? "✓ Downloaded (Save Copy)" : "✓ Saved to Device (Save Copy)";
      }
      return isWeb
        ? `Download ${selectedFormatConfig.shortLabel} File`
        : `Save ${selectedFormatConfig.shortLabel} to Device`;
    };

    const getHintText = () => {
      if (isSaved) {
        if (isWeb) {
          return "✓ File downloaded successfully to your computer's Downloads directory.";
        }
        if (isIOS) {
          return "✓ File saved successfully to your Photos & Files app.";
        }
        if (isAndroid) {
          return "✓ File saved to device storage and accessible in Gallery.";
        }
        return "✓ File saved successfully to your device.";
      }
      if (isWeb) {
        return "Click above to download the rendered file directly to your computer.";
      }
      if (isIOS) {
        return "Tap above to save directly to your Camera Roll and Files app.";
      }
      if (isAndroid) {
        return "Tap above to save directly to your Device Gallery and FastArt folder.";
      }
      return "Tap above to save directly to your device storage.";
    };

    return (
      <View style={styles.doneContainer}>
        {/* Glowing Success Emblem */}
        <View style={styles.successIconBox}>
          <Ionicons name="checkmark" size={36} color="#00F2FE" />
        </View>

        <Text style={styles.doneTitle}>Export Complete!</Text>
        <Text style={styles.doneSubtext}>
          {exportFilename ? (
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
              {exportFilename}{selectedFormatConfig.ext}{" "}
            </Text>
          ) : null}
          is rendered and ready for playback or sharing.
        </Text>

        {/* Technical Metadata Strip */}
        <View style={styles.doneMetaCard}>
          <View style={styles.doneMetaItem}>
            <Text style={styles.doneMetaLabel}>Format</Text>
            <Text style={styles.doneMetaValue}>{selectedFormatConfig.shortLabel}</Text>
          </View>
          <View style={styles.summaryDivider} />
          {mediaType !== "wav" && (
            <>
              <View style={styles.doneMetaItem}>
                <Text style={styles.doneMetaLabel}>Resolution</Text>
                <Text style={styles.doneMetaValue}>{resolution}</Text>
              </View>
              <View style={styles.summaryDivider} />
            </>
          )}
          {mediaType !== "png" && mediaType !== "wav" && (
            <>
              <View style={styles.doneMetaItem}>
                <Text style={styles.doneMetaLabel}>FPS</Text>
                <Text style={styles.doneMetaValue}>{fps} fps</Text>
              </View>
              <View style={styles.summaryDivider} />
            </>
          )}
          <View style={styles.doneMetaItem}>
            <Text style={styles.doneMetaLabel}>Status</Text>
            <Text style={[styles.doneMetaValue, { color: "#10B981" }]}>
              {isSaved ? "Saved" : "Ready"}
            </Text>
          </View>
        </View>

        {/* 1. Primary Direct Download Button */}
        <TouchableOpacity
          style={[
            styles.downloadBtn,
            isSaved && { backgroundColor: "#00F2FE" },
            isSaving && { opacity: 0.8 },
          ]}
          onPress={onDownload}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#08090E" />
          ) : (
            <Ionicons
              name={isSaved ? "checkmark-done" : "cloud-download"}
              size={19}
              color="#08090E"
            />
          )}
          <Text style={styles.downloadBtnText}>{getButtonText()}</Text>
        </TouchableOpacity>

        {/* 2. Download Location Info Card */}
        <View style={styles.downloadLocationCard}>
          <View style={styles.downloadLocationHeader}>
            <Ionicons name="folder-open-outline" size={15} color="#00F2FE" />
            <Text style={styles.downloadLocationTitle}>Saved Location</Text>
          </View>
          <Text style={styles.downloadLocationPath} numberOfLines={2}>
            {finalLocation}
          </Text>
          <Text style={styles.downloadLocationHint}>{getHintText()}</Text>
        </View>

        {/* 3. Secondary Actions */}
        <TouchableOpacity style={styles.reExportBtn} onPress={onReExport} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={15} color="#94A3B8" />
          <Text style={styles.reExportBtnText}>
            Export In Another Format
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.doneDismissBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.doneDismissText}>Done / Return to Editor</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.doneContainer}>
        <View style={[styles.successIconBox, { borderColor: "rgba(239, 68, 68, 0.4)", backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
          <Ionicons name="alert" size={32} color="#EF4444" />
        </View>
        <Text style={styles.doneTitle}>Export Issue</Text>
        <Text style={styles.doneSubtext}>
          {errorMessage ||
            "Unable to encode video in the selected format. Please try PNG cover or GIF."}
        </Text>
        <TouchableOpacity style={styles.downloadBtn} onPress={onReExport} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={18} color="#08090E" />
          <Text style={styles.downloadBtnText}>Try Another Format</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
