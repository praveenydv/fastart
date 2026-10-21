import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DownloadCompleteModal from "./DownloadCompleteModal";
import { ExportModalProps } from "./Export/exportTypes";
import { styles } from "./Export/ExportModalStyles";
import { useExportProcess } from "./Export/useExportProcess";
import ExportIdleSettings from "./Export/ExportIdleSettings";
import ExportResultView from "./Export/ExportResultView";

export default function ExportModal({
  visible,
  onClose,
  project,
  totalDuration,
}: ExportModalProps) {
  const {
    mediaType,
    setMediaType,
    resolution,
    setResolution,
    fps,
    setFps,
    status,
    setStatus,
    errorMessage,
    progress,
    exportedResult,
    exportedUrl,
    isSaving,
    isSaved,
    setIsSaved,
    showDownloadComplete,
    setShowDownloadComplete,
    downloadCompleteFilename,
    downloadDestination,
    noticeDialog,
    setNoticeDialog,
    selectedFormatConfig,
    calculateEstimatedSize,
    triggerDirectDownload,
    handleStartExport,
    getProgressStatusMessage,
  } = useExportProcess(project, totalDuration, visible);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleRow}>
              <Ionicons
                name="cloud-download-outline"
                size={18}
                color="#00F2FE"
              />
              <Text style={styles.sheetTitle}>Export Video</Text>
            </View>
            {status !== "rendering" && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            {status === "idle" ? (
              <ExportIdleSettings
                mediaType={mediaType}
                setMediaType={setMediaType}
                resolution={resolution}
                setResolution={setResolution}
                fps={fps}
                setFps={setFps}
                selectedFormatConfig={selectedFormatConfig}
                project={project}
                totalDuration={totalDuration}
                calculateEstimatedSize={calculateEstimatedSize}
                onStartExport={handleStartExport}
              />
            ) : (
              <ExportResultView
                status={status}
                progress={progress}
                getProgressStatusMessage={getProgressStatusMessage}
                selectedFormatConfig={selectedFormatConfig}
                mediaType={mediaType}
                resolution={resolution}
                fps={fps}
                isSaved={isSaved}
                isSaving={isSaving}
                errorMessage={errorMessage}
                downloadDestination={downloadDestination}
                onDownload={() => triggerDirectDownload(exportedResult, exportedUrl)}
                onReExport={() => {
                  setStatus("idle");
                  setIsSaved(false);
                }}
                onClose={() => {
                  setStatus("idle");
                  setIsSaved(false);
                  onClose();
                }}
              />
            )}
          </ScrollView>
        </View>
      </View>

      {/* Modern Sleek Download Complete Modal */}
      <DownloadCompleteModal
        visible={showDownloadComplete}
        onClose={() => setShowDownloadComplete(false)}
        filename={
          downloadCompleteFilename ||
          `${(project?.title || "FastArt").replace(/[^a-zA-Z0-9_-]/g, "_")}.${selectedFormatConfig.ext}`
        }
        formatLabel={selectedFormatConfig.label}
        formatExt={selectedFormatConfig.ext}
        destinationPath={downloadDestination}
        resolution={
          mediaType !== "png" && mediaType !== "wav" ? resolution : undefined
        }
        fps={mediaType !== "png" && mediaType !== "wav" ? fps : undefined}
        fileSize={calculateEstimatedSize()}
        duration={totalDuration}
        isSavedToGallery={true}
        onDownloadAgain={() => triggerDirectDownload()}
      />

      {/* Sleek Modern In-App Notice Dialog */}
      {noticeDialog?.visible && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setNoticeDialog(null)}
        >
          <View style={styles.noticeBackdrop}>
            <View style={styles.noticeModalCard}>
              <View
                style={[
                  styles.noticeIconCircle,
                  {
                    backgroundColor: `${noticeDialog.iconColor || "#00F2FE"}1A`,
                    borderColor: `${noticeDialog.iconColor || "#00F2FE"}44`,
                  },
                ]}
              >
                <Ionicons
                  name={noticeDialog.icon || "information-circle-outline"}
                  size={32}
                  color={noticeDialog.iconColor || "#00F2FE"}
                />
              </View>
              <Text style={styles.noticeTitle}>{noticeDialog.title}</Text>
              <Text style={styles.noticeMessage}>{noticeDialog.message}</Text>
              <View style={styles.noticeActions}>
                {noticeDialog.primaryText && noticeDialog.onPrimary && (
                  <TouchableOpacity
                    style={styles.noticePrimaryBtn}
                    onPress={noticeDialog.onPrimary}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.noticePrimaryText}>
                      {noticeDialog.primaryText}
                    </Text>
                  </TouchableOpacity>
                )}
                {noticeDialog.secondaryText && noticeDialog.onSecondary && (
                  <TouchableOpacity
                    style={styles.noticeSecondaryBtn}
                    onPress={noticeDialog.onSecondary}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.noticeSecondaryText}>
                      {noticeDialog.secondaryText}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}
