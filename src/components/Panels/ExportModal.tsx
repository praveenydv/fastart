import React from "react";
import { View, Text, Modal, ScrollView, Platform, useWindowDimensions, StyleSheet } from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { ModalHeader } from "../Common/ModalHeader";
import { ExportModalProps } from "./Export/exportTypes";
import { styles } from "./Export/ExportModalStyles";
import { useExportProcess } from "./Export/useExportProcess";
import ExportIdleSettings from "./Export/ExportIdleSettings";
import ExportResultView from "./Export/ExportResultView";
import MobileCanvasExportView from "./Export/MobileCanvasExportView";

function ExportModalComponent({
  visible,
  onClose,
  project,
  totalDuration,
}: ExportModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

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
    <Modal visible={visible} animationType={Platform.OS === "web" ? "fade" : "none"} transparent>
      <View style={[styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        {/* Clickable Backdrop Dismiss for Desktop & Mobile */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (status !== "rendering") {
              onClose();
            }
          }}
        />

        <View style={[styles.sheetContainer, isDesktop && styles.sheetContainerDesktop]}>
          {/* Mobile Drag Handle */}
          {!isDesktop && <View style={styles.sheetHandle} />}

          {/* Header */}
          <ModalHeader
            title={isDesktop ? "Export Project" : "Export Video"}
            subtitle={
              isDesktop
                ? "Configure format, resolution, and render settings"
                : undefined
            }
            iconName="cloud-download-outline"
            onClose={() => {
              if (status === "rendering") {
                handleCancelExport();
              }
              onClose();
            }}
            onDone={
              status === "idle"
                ? handleStartExport
                : status === "done"
                ? onClose
                : undefined
            }
            doneLoading={status === "rendering"}
            rightNode={
              isDesktop ? (
                <View style={styles.headerFormatBadge}>
                  <Ionicons name={selectedFormatConfig.icon} size={12} color="#00F2FE" />
                  <Text style={styles.headerFormatBadgeText}>
                    {selectedFormatConfig.shortLabel}
                    {mediaType !== "wav" && mediaType !== "png" ? ` • ${resolution}` : ""}
                  </Text>
                </View>
              ) : undefined
            }
          />

          <ScrollView
            style={[styles.sheetBody, isDesktop && styles.sheetBodyDesktop]}
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
                isDesktop={isDesktop}
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
                exportFilename={exportFilename}
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

export const ExportModal = React.memo(ExportModalComponent);
export default ExportModal;
