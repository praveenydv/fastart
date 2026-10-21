import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
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
  errorMessage: string | null;
  onDownload: () => void;
  onShare: () => void;
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
  errorMessage,
  onDownload,
  onShare,
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
          Generating {selectedFormatConfig.label} ({selectedFormatConfig.ext})
        </Text>
      </View>
    );
  }

  if (status === "done") {
    return (
      <View style={styles.doneContainer}>
        <View style={styles.successIconBox}>
          <Ionicons name="checkmark-circle" size={68} color="#10B981" />
        </View>
        <Text style={styles.doneTitle}>Ready to Download!</Text>
        <Text style={styles.doneSubtext}>
          Exported successfully as{" "}
          <Text style={{ color: "#00F2FE", fontWeight: "800" }}>
            {selectedFormatConfig.label} ({selectedFormatConfig.ext})
          </Text>
          {mediaType !== "png" && mediaType !== "wav"
            ? ` in ${resolution} @ ${fps}fps`
            : ""}
        </Text>

        {isSaved && (
          <View style={styles.savedBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.savedBannerText}>
              Saved directly to Photos / Gallery!
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.downloadBtn, isSaving && { opacity: 0.8 }]}
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
            {isSaving
              ? "Saving directly to device..."
              : isSaved
              ? `Saved to Photos (Tap to Save Again)`
              : `Download / Save to Device (${selectedFormatConfig.shortLabel})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareOptionBtn}
          onPress={onShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={18} color="#00F2FE" />
          <Text style={styles.shareOptionBtnText}>
            Share via Apps (WhatsApp, AirDrop, etc.)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.reExportBtn} onPress={onReExport}>
          <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
          <Text style={styles.reExportBtnText}>
            Choose Another Media Type / Re-export
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
            "Unable to encode video in the selected format. Please try WebM or PNG cover snapshot."}
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
