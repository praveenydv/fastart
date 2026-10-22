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
}: ExportResultViewProps) {
  if (status === "rendering") {
    return (
      <View style={styles.progressContainer}>
        <ActivityIndicator
          size="large"
          color="#00F2FE"
          style={{ marginBottom: 16 }}
        />
        <Text style={styles.progressPercent}>{progress}%</Text>
        <Text style={styles.progressStatusText}>
          {getProgressStatusMessage()}
        </Text>
        <View style={styles.progressBarTrack}>
          <View
            style={[styles.progressBarFill, { width: `${progress}%` }]}
          />
        </View>
        <Text style={styles.formatProgressNotice}>
          Generating {selectedFormatConfig.label} ({selectedFormatConfig.ext}) with all edits
        </Text>
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
        ? `Download File (${selectedFormatConfig.shortLabel})`
        : `Save to Device (${selectedFormatConfig.shortLabel})`;
    };

    const getHintText = () => {
      if (isSaved) {
        if (isWeb) {
          return "✓ File downloaded successfully. Accessible in your Downloads folder.";
        }
        if (isIOS) {
          return "✓ File saved successfully. Accessible in your Photos & Files app.";
        }
        if (isAndroid) {
          return "✓ File saved to device storage. Accessible in your Gallery & Files.";
        }
        return "✓ File saved successfully to your device.";
      }
      if (isWeb) {
        return "Tap the button above to download directly to your computer.";
      }
      if (isIOS) {
        return "Tap the button above to save directly to your Photos & Files.";
      }
      if (isAndroid) {
        return "Tap the button above to save directly to your Gallery & Files.";
      }
      return "Tap the button above to save directly to your device.";
    };

    return (
      <View style={styles.doneContainer}>
        <View style={styles.successIconBox}>
          <Ionicons name="checkmark-circle" size={68} color="#10B981" />
        </View>
        <Text style={styles.doneTitle}>Export Ready!</Text>
        <Text style={styles.doneSubtext}>
          Successfully rendered all text, stickers & video layers as{" "}
          <Text style={{ color: "#00F2FE", fontWeight: "800" }}>
            {selectedFormatConfig.label} ({selectedFormatConfig.ext})
          </Text>
          {mediaType !== "png" && mediaType !== "wav"
            ? ` in ${resolution} @ ${fps}fps`
            : ""}
        </Text>

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
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Ionicons
              name={isSaved ? "checkmark-done" : "cloud-download"}
              size={20}
              color="#000000"
            />
          )}
          <Text style={styles.downloadBtnText}>
            {getButtonText()}
          </Text>
        </TouchableOpacity>

        {/* 2. Download Location Info Card */}
        <View style={styles.downloadLocationCard}>
          <View style={styles.downloadLocationHeader}>
            <Ionicons name="folder-open-outline" size={16} color="#00F2FE" />
            <Text style={styles.downloadLocationTitle}>Saved Location</Text>
          </View>
          <Text style={styles.downloadLocationPath} numberOfLines={2}>
            {finalLocation}
          </Text>
          <Text style={styles.downloadLocationHint}>
            {getHintText()}
          </Text>
        </View>

        {/* 3. Clean Secondary Actions */}
        <TouchableOpacity style={styles.reExportBtn} onPress={onReExport}>
          <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
          <Text style={styles.reExportBtnText}>
            Choose Another Format / Re-Export
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.doneDismissBtn} onPress={onClose}>
          <Text style={styles.doneDismissText}>Done / Back to Editor</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.doneContainer}>
        <View style={styles.successIconBox}>
          <Ionicons name="alert-circle" size={68} color="#EF4444" />
        </View>
        <Text style={styles.doneTitle}>Export Issue</Text>
        <Text style={styles.doneSubtext}>
          {errorMessage ||
            "Unable to encode video in the selected format. Please try PNG cover or GIF."}
        </Text>
        <TouchableOpacity style={styles.downloadBtn} onPress={onReExport}>
          <Ionicons name="refresh-outline" size={20} color="#000000" />
          <Text style={styles.downloadBtnText}>Try Another Format</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
