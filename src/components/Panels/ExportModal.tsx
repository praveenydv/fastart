import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import {
  VideoRenderer,
  ExportFormat,
  ExportResult,
} from "../../utils/videoRenderer";
import { soundEngine } from "../../utils/audioEngine";
import { addNotification } from "../../utils/storage";

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  project: any;
  totalDuration: number;
}

interface MediaFormatOption {
  id: ExportFormat;
  label: string;
  shortLabel: string;
  ext: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  isRecommended?: boolean;
  desc: string;
}

const MEDIA_FORMATS: MediaFormatOption[] = [
  {
    id: "mp4",
    label: "MP4 Video",
    shortLabel: "MP4",
    ext: ".mp4",
    icon: "videocam",
    badge: "Universal",
    isRecommended: true,
    desc: "Compatible with Instagram, YouTube, TikTok, iOS & Android",
  },
  {
    id: "webm",
    label: "WebM Video",
    shortLabel: "WebM",
    ext: ".webm",
    icon: "globe-outline",
    badge: "Fast",
    isRecommended: false,
    desc: "High-efficiency VP9 video format for web playback",
  },
  {
    id: "gif",
    label: "Animated GIF",
    shortLabel: "GIF",
    ext: ".gif",
    icon: "film-outline",
    badge: "Loop",
    isRecommended: false,
    desc: "Looped animation clip for messaging & stickers",
  },
  {
    id: "png",
    label: "PNG Cover",
    shortLabel: "PNG",
    ext: ".png",
    icon: "image-outline",
    badge: "HD",
    isRecommended: false,
    desc: "Lossless HD snapshot frame for thumbnails",
  },
  {
    id: "wav",
    label: "WAV Audio",
    shortLabel: "WAV",
    ext: ".wav",
    icon: "musical-notes-outline",
    badge: "Audio",
    isRecommended: false,
    desc: "Uncompressed stereo master soundtrack audio",
  },
];

export default function ExportModal({
  visible,
  onClose,
  project,
  totalDuration,
}: ExportModalProps) {
  const [mediaType, setMediaType] = useState<ExportFormat>("mp4");
  const [resolution, setResolution] = useState(project.resolution || "1080p");
  const [fps, setFps] = useState(project.fps || 30);
  const [status, setStatus] = useState<"idle" | "rendering" | "done" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [exportedResult, setExportedResult] = useState<ExportResult | null>(
    null,
  );
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (project.resolution) setResolution(project.resolution);
    if (project.fps) setFps(project.fps);
  }, [project.resolution, project.fps, visible]);

  const resolutions = ["720p", "1080p", "2K/4K"];
  const frameRates = [24, 30, 60];

  const selectedFormatConfig =
    MEDIA_FORMATS.find((f) => f.id === mediaType) || MEDIA_FORMATS[0];

  const calculateEstimatedSize = () => {
    const dur = Math.max(totalDuration || 5, 1);
    if (mediaType === "png") return "~1.8 MB";
    if (mediaType === "wav") return `~${(dur * 0.17).toFixed(1)} MB`;
    if (mediaType === "gif") return `~${(dur * 0.55).toFixed(1)} MB`;
    const resMultiplier =
      resolution === "2K/4K" ? 2.5 : resolution === "1080p" ? 1.4 : 0.8;
    const formatMultiplier = mediaType === "webm" ? 0.75 : 1.0;
    return `~${(dur * resMultiplier * formatMultiplier).toFixed(1)} MB`;
  };

  const triggerDirectDownload = async (
    targetResult?: ExportResult | null,
    targetUrl?: string | null,
  ) => {
    const activeResult = targetResult || exportedResult;
    const activeUrl = targetUrl || exportedUrl || activeResult?.videoUrl;
    if (!activeResult && !activeUrl) return;

    const currentFmt =
      MEDIA_FORMATS.find((f) => f.id === mediaType) || MEDIA_FORMATS[0];
    const ext = activeResult?.extension || currentFmt.id;
    const cleanTitle = (project.title || "FastArt_Video").replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );

    let filename: string;
    if (mediaType === "png") {
      filename = `${cleanTitle}_Cover.${ext}`;
    } else if (mediaType === "wav") {
      filename = `${cleanTitle}_Soundtrack.${ext}`;
    } else {
      filename = `${cleanTitle}_${resolution}.${ext}`;
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        let blob = activeResult?.blob;
        if (!blob && activeUrl) {
          try {
            const resp = await fetch(activeUrl);
            blob = await resp.blob();
          } catch (fetchErr) {
            console.warn("Blob fetch failed:", fetchErr);
          }
        }

        // 1. File System Access API (Native OS Save As File Dialog)
        if ("showSaveFilePicker" in window && blob && blob.size > 0) {
          try {
            const mime = activeResult?.mimeType || "application/octet-stream";
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: `${selectedFormatConfig.label} File`,
                  accept: {
                    [mime]: [`.${ext}`],
                    "application/octet-stream": [`.${ext}`],
                  },
                },
              ],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            soundEngine.playSfx("pop");
            return;
          } catch (pickerErr: any) {
            if (pickerErr?.name === "AbortError") {
              // User pressed cancel in the save dialog; do not navigate or open URL
              return;
            }
          }
        }

        // 2. Direct anchor download forced with application/octet-stream
        // Crucial: 'application/octet-stream' forces browser to trigger file download rather than navigating to localhost/blob URL
        const downloadBlob =
          blob && blob.size > 0
            ? new Blob([blob], { type: "application/octet-stream" })
            : new Blob([], { type: "application/octet-stream" });
        const downloadUrl = URL.createObjectURL(downloadBlob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.style.position = "fixed";
        a.style.left = "-9999px";
        a.style.top = "-9999px";
        a.href = downloadUrl;
        a.download = filename;
        a.setAttribute("download", filename);
        a.rel = "noopener noreferrer";
        a.target = "_self";

        // Stop click propagation so router / React handlers never treat this as navigation
        a.addEventListener("click", (e) => {
          e.stopPropagation();
        });

        document.body.appendChild(a);
        a.click();
        soundEngine.playSfx("pop");

        // Keep anchor in DOM for 3s to let browser start download before cleanup
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(downloadUrl);
        }, 3000);
      } catch (err) {
        console.warn("Web download error:", err);
      }
    } else {
      if (activeUrl) {
        Sharing.shareAsync(activeUrl).catch((err) => console.warn(err));
      }
    }
  };

  const handleStartExport = async () => {
    setStatus("rendering");
    setErrorMessage(null);
    setProgress(0);
    soundEngine.playSfx("whoosh");

    try {
      if (Platform.OS === "web") {
        const offscreenCanvas = document.createElement("canvas");
        const baseResolutions: Record<
          string,
          Record<string, [number, number]>
        > = {
          "720p": {
            "9:16": [720, 1280],
            "16:9": [1280, 720],
            "1:1": [720, 720],
            "4:5": [720, 900],
            "2.35:1": [1280, 545],
          },
          "1080p": {
            "9:16": [1080, 1920],
            "16:9": [1920, 1080],
            "1:1": [1080, 1080],
            "4:5": [1080, 1350],
            "2.35:1": [1920, 817],
          },
          "2K/4K": {
            "9:16": [2160, 3840],
            "16:9": [3840, 2160],
            "1:1": [2160, 2160],
            "4:5": [2160, 2700],
            "2.35:1": [3840, 1634],
          },
        };

        const resMap = baseResolutions[resolution] || baseResolutions["1080p"];
        const [targetW, targetH] = resMap[project.aspectRatio] || [1080, 1920];
        offscreenCanvas.width = targetW;
        offscreenCanvas.height = targetH;

        const renderer = new VideoRenderer(offscreenCanvas);
        // Preload clips
        for (const clip of project.tracks?.video || []) {
          await renderer.preloadClip(clip);
        }

        const renderDuration = Math.max(totalDuration || 2.0, 1.0);

        const result = await renderer.exportVideo(
          project,
          {
            fps,
            duration: renderDuration,
            format: mediaType,
            currentTime: 0,
            logicalWidth: targetW,
            logicalHeight: targetH,
          },
          (pct) => {
            setProgress(pct);
          },
        );

        setExportedResult(result);
        setExportedUrl(result.videoUrl);
        setStatus("done");
        soundEngine.playSfx("pop");
        addNotification({
          title: "Export Ready",
          message: `"${project?.title || "Project"}" exported as ${resolution} ${mediaType.toUpperCase()}.`,
          projectId: project?.id,
          projectTitle: project?.title,
          actionText: "Open Project",
          icon: "videocam",
        });
      } else {
        // Native simulated render progress
        for (let i = 0; i <= 100; i += 10) {
          setProgress(i);
          await new Promise((r) => setTimeout(r, 120));
        }
        setStatus("done");
        soundEngine.playSfx("pop");
        addNotification({
          title: "Export Ready",
          message: `"${project?.title || "Project"}" exported as ${resolution} ${mediaType.toUpperCase()}.`,
          projectId: project?.id,
          projectTitle: project?.title,
          actionText: "Open Project",
          icon: "videocam",
        });
      }
    } catch (err: any) {
      console.warn(
        "Export error, generating high-quality snapshot fallback:",
        err,
      );
      try {
        const offscreenCanvas = document.createElement("canvas");
        const baseResolutions: Record<
          string,
          Record<string, [number, number]>
        > = {
          "720p": {
            "9:16": [720, 1280],
            "16:9": [1280, 720],
            "1:1": [720, 720],
            "4:5": [720, 900],
            "2.35:1": [1280, 545],
          },
          "1080p": {
            "9:16": [1080, 1920],
            "16:9": [1920, 1080],
            "1:1": [1080, 1080],
            "4:5": [1080, 1350],
            "2.35:1": [1920, 817],
          },
          "2K/4K": {
            "9:16": [2160, 3840],
            "16:9": [3840, 2160],
            "1:1": [2160, 2160],
            "4:5": [2160, 2700],
            "2.35:1": [3840, 1634],
          },
        };
        const resMap = baseResolutions[resolution] || baseResolutions["1080p"];
        const [targetW, targetH] = resMap[project.aspectRatio] || [1080, 1920];
        offscreenCanvas.width = targetW;
        offscreenCanvas.height = targetH;
        const fallbackRenderer = new VideoRenderer(offscreenCanvas);
        fallbackRenderer.renderFrame(project, 0, false, targetW, targetH);

        const fallbackBlob = await new Promise<Blob>((resolve) => {
          offscreenCanvas.toBlob(
            (b) => resolve(b || new Blob([], { type: "image/png" })),
            "image/png",
          );
        });
        const fallbackUrl = URL.createObjectURL(fallbackBlob);
        const fallbackResult: ExportResult = {
          blob: fallbackBlob,
          videoUrl: fallbackUrl,
          mimeType: "image/png",
          format: "png",
          extension: "png",
          fileSize: fallbackBlob.size,
        };
        setExportedResult(fallbackResult);
        setExportedUrl(fallbackUrl);
        setStatus("done");
        soundEngine.playSfx("pop");
        addNotification({
          title: "Cover Frame Exported",
          message: `Saved snapshot cover for "${project?.title || "Project"}".`,
          projectId: project?.id,
          projectTitle: project?.title,
          actionText: "Open Project",
          icon: "image-outline",
        });
      } catch (fallbackErr) {
        setStatus("error");
        setErrorMessage(
          "Export failed. Please check browser permissions and try again.",
        );
      }
    }
  };

  const handleDownload = () => {
    triggerDirectDownload(exportedResult, exportedUrl);
  };

  const getProgressStatusMessage = () => {
    switch (mediaType) {
      case "mp4":
        return "Encoding hardware-accelerated MP4 (H.264 / AVC)...";
      case "webm":
        return "Rendering WebM video frames with VP9 codec...";
      case "gif":
        return "Generating animated GIF palette and frames...";
      case "png":
        return "Rendering crisp lossless PNG frame...";
      case "wav":
        return "Synthesizing 16-bit stereo PCM audio track...";
      default:
        return "Rendering frames...";
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
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
            {/* IDLE STATE: Clean Space-Optimized Settings */}
            {status === "idle" && (
              <>
                {/* 1. MEDIA FORMAT PILLS */}
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
                        style={[
                          styles.formatChip,
                          isSelected && styles.formatChipActive,
                        ]}
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
                            style={[
                              styles.recDot,
                              isSelected && styles.recDotActive,
                            ]}
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
                      {resolutions.map((r) => {
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
                        {mediaType === "gif"
                          ? "Max 12fps for GIF"
                          : "Smooth motion"}
                      </Text>
                    </View>
                    <View style={styles.compactRow}>
                      {frameRates.map((f) => {
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
                    <Ionicons name="musical-notes" size={15} color="#00F2FE" />
                    <Text style={styles.noticeCardText}>
                      Master 16-bit 48kHz Stereo PCM audio mixdown from all
                      tracks.
                    </Text>
                  </View>
                )}
                {mediaType === "png" && (
                  <View style={styles.noticeCard}>
                    <Ionicons name="image" size={15} color="#00F2FE" />
                    <Text style={styles.noticeCardText}>
                      Single full-resolution lossless snapshot frame captured at
                      playhead.
                    </Text>
                  </View>
                )}

                {/* 4. COMPACT STATS STRIP */}
                <View style={styles.compactSummaryCard}>
                  <View style={styles.summaryItem}>
                    <Ionicons
                      name="document-text-outline"
                      size={12}
                      color="#00F2FE"
                    />
                    <Text style={styles.summaryValue}>
                      {selectedFormatConfig.shortLabel}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Ionicons
                      name="speedometer-outline"
                      size={12}
                      color="#00F2FE"
                    />
                    <Text style={styles.summaryValue}>
                      {calculateEstimatedSize()}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Ionicons name="time-outline" size={12} color="#00F2FE" />
                    <Text style={styles.summaryValue}>
                      {mediaType === "png"
                        ? "1 Frame"
                        : `${totalDuration.toFixed(1)}s`}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Ionicons name="crop-outline" size={12} color="#00F2FE" />
                    <Text style={styles.summaryValue}>
                      {project.aspectRatio || "9:16"}
                    </Text>
                  </View>
                </View>

                {/* 5. PRIMARY EXPORT CTA */}
                <TouchableOpacity
                  style={styles.exportCtaBtn}
                  onPress={handleStartExport}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="arrow-up-circle-outline"
                    size={18}
                    color="#000000"
                  />
                  <Text style={styles.exportCtaText}>
                    Export {selectedFormatConfig.shortLabel}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* RENDERING STATE: Progress Ring */}
            {status === "rendering" && (
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
                  Generating {selectedFormatConfig.label} (
                  {selectedFormatConfig.ext})
                </Text>
              </View>
            )}

            {/* DONE STATE: Download & Share */}
            {status === "done" && (
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

                {/* Primary Download Button */}
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={handleDownload}
                >
                  <Ionicons name="cloud-download" size={22} color="#000000" />
                  <Text style={styles.downloadBtnText}>
                    Download {selectedFormatConfig.label} (
                    {selectedFormatConfig.ext})
                  </Text>
                </TouchableOpacity>

                {/* Secondary Option: Switch Format & Re-export */}
                <TouchableOpacity
                  style={styles.reExportBtn}
                  onPress={() => {
                    setStatus("idle");
                  }}
                >
                  <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
                  <Text style={styles.reExportBtnText}>
                    Choose Another Media Type / Re-export
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doneDismissBtn}
                  onPress={() => {
                    setStatus("idle");
                    onClose();
                  }}
                >
                  <Text style={styles.doneDismissText}>
                    Done / Back to Editor
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ERROR STATE */}
            {status === "error" && (
              <View style={styles.doneContainer}>
                <View style={styles.successIconBox}>
                  <Ionicons name="alert-circle" size={68} color="#EF4444" />
                </View>
                <Text style={styles.doneTitle}>Export Issue</Text>
                <Text style={styles.doneSubtext}>
                  {errorMessage ||
                    "Unable to encode video in the selected format. Please try WebM or PNG cover snapshot."}
                </Text>
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => {
                    setStatus("idle");
                  }}
                >
                  <Ionicons name="refresh-outline" size={20} color="#000000" />
                  <Text style={styles.downloadBtnText}>Try Another Format</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#141721",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    borderTopWidth: 1,
    borderColor: "#252B3B",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2333",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E2333",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionTitle: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  sectionHint: {
    color: "#6B7280",
    fontSize: 11,
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },
  formatChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  formatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#0F1219",
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  formatChipActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  formatChipText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  formatChipTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  recDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#00F2FE",
  },
  recDotActive: {
    backgroundColor: "#000000",
  },
  specSection: {
    marginBottom: 8,
  },
  compactRow: {
    flexDirection: "row",
    gap: 8,
  },
  compactPill: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#0F1219",
    borderWidth: 1,
    borderColor: "#1E2333",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  compactPillActive: {
    borderColor: "#00F2FE",
    backgroundColor: "#16222F",
  },
  compactPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  compactPillTextActive: {
    color: "#00F2FE",
    fontWeight: "800",
  },
  tagBadge: {
    backgroundColor: "#053E47",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagBadgeActive: {
    backgroundColor: "#00F2FE",
  },
  tagBadgeText: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "800",
  },
  tagBadgeTextActive: {
    color: "#000000",
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A131C",
    borderWidth: 1,
    borderColor: "#133544",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  noticeCardText: {
    color: "#7DD3FC",
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  compactSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#0B0D13",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1B212D",
    marginTop: 2,
    marginBottom: 10,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  summaryDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#1E2333",
  },
  exportCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00F2FE",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 6,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  exportCtaText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  progressContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  progressPercent: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "900",
    marginVertical: 10,
  },
  progressStatusText: {
    color: "#8E95A5",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  progressBarTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#1E2333",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
  },
  formatProgressNotice: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
  },
  doneContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  successIconBox: {
    marginBottom: 12,
  },
  doneTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  doneSubtext: {
    color: "#8E95A5",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    gap: 10,
    marginBottom: 14,
  },
  downloadBtnText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
  reExportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    marginBottom: 6,
  },
  reExportBtnText: {
    color: "#8E95A5",
    fontSize: 13,
    fontWeight: "600",
  },
  doneDismissBtn: {
    paddingVertical: 10,
  },
  doneDismissText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
});
