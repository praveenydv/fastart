import React from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExportModalProps } from "./Export/exportTypes";
import { styles } from "./Export/ExportModalStyles";
import { useExportProcess } from "./Export/useExportProcess";
import ExportIdleSettings from "./Export/ExportIdleSettings";
import ExportResultView from "./Export/ExportResultView";
import MobileCanvasExportView from "./Export/MobileCanvasExportView";

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
    downloadDestination,
    noticeDialog,
    setNoticeDialog,
    selectedFormatConfig,
    calculateEstimatedSize,
    triggerDirectDownload,
    handleStartExport,
    handleCancelExport,
    getProgressStatusMessage,
    exportFilename,
    setExportFilename,
    isMobileCanvasRendering,
    handleMobileCanvasComplete,
    handleMobileCanvasError,
    handleMobileCanvasProgress,
  } = useExportProcess(project, totalDuration, visible);

  const mobileExportOptions = React.useMemo(
    () => ({
      fps,
      duration: Math.max(totalDuration || 2.0, 1.0),
      format: mediaType,
      resolution,
      currentTime: project?.currentTime || 0,
    }),
    [fps, totalDuration, mediaType, resolution, project?.currentTime]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Standardized Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={() => {
                if (status === "rendering") {
                  handleCancelExport();
                }
                onClose();
              }}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.3)",
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel={
                status === "rendering" ? "Cancel Export and Close" : "Cancel"
              }
            >
              <Ionicons name="close" size={17} color="#EF4444" />
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <Ionicons
                name="cloud-download-outline"
                size={17}
                color="#00F2FE"
              />
              <Text style={styles.sheetTitle}>Export Video</Text>
            </View>

            {status === "idle" ? (
              <TouchableOpacity
                onPress={handleStartExport}
                style={[styles.closeBtn, { backgroundColor: "#00F2FE" }]}
                activeOpacity={0.7}
                accessibilityLabel="Start Export"
              >
                <Ionicons name="checkmark" size={18} color="#000000" />
              </TouchableOpacity>
            ) : status === "done" ? (
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: "#00F2FE" }]}
                activeOpacity={0.7}
                accessibilityLabel="Done"
              >
                <Ionicons name="checkmark" size={18} color="#000000" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 28 }} />
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
                exportFilename={exportFilename}
                setExportFilename={setExportFilename}
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
                onDownload={() =>
                  triggerDirectDownload(exportedResult, exportedUrl)
                }
                onReExport={() => {
                  setStatus("idle");
                  setIsSaved(false);
                }}
                onClose={() => {
                  setStatus("idle");
                  setIsSaved(false);
                  onClose();
                }}
                onCancelExport={handleCancelExport}
              />
            )}
          </ScrollView>
        </View>
      </View>

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

      {/* Hardware-accelerated Skia Canvas & MediaRecorder engine on mobile */}
      {Platform.OS !== "web" && isMobileCanvasRendering && (
        <MobileCanvasExportView
          isExporting={isMobileCanvasRendering}
          project={project}
          options={mobileExportOptions}
          onProgress={handleMobileCanvasProgress}
          onComplete={handleMobileCanvasComplete}
          onError={handleMobileCanvasError}
        />
      )}
    </Modal>
  );
}
