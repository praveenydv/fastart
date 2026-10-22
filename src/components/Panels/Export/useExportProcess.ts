import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import {
  VideoRenderer,
  ExportFormat,
  ExportResult,
} from "../../../utils/videoRenderer";
import { soundEngine } from "../../../utils/audioEngine";
import { addNotification } from "../../../utils/storage";
import { MEDIA_FORMATS, NoticeDialogState } from "./exportTypes";
import { executeDirectDownload } from "./exportFileStorage";
import { exportMobileProject } from "../../../utils/renderer/mobileExporter";

export function useExportProcess(
  project: any,
  totalDuration: number,
  visible: boolean,
) {
  const [mediaType, setMediaType] = useState<ExportFormat>("mp4");
  const [resolution, setResolution] = useState(project.resolution || "1080p");
  const [fps, setFps] = useState(project.fps || 30);
  const [status, setStatus] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [exportedResult, setExportedResult] = useState<ExportResult | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showDownloadComplete, setShowDownloadComplete] = useState(false);
  const [downloadCompleteFilename, setDownloadCompleteFilename] = useState("");
  const [downloadDestination, setDownloadDestination] = useState(
    Platform.OS === "web"
      ? "Downloads"
      : Platform.OS === "ios"
      ? "Photos & Files"
      : "Gallery / FastArt",
  );
  const [noticeDialog, setNoticeDialog] = useState<NoticeDialogState | null>(null);
  const isCancelledRef = useRef(false);

  const getInitialFilename = () => {
    let raw = (project?.title || project?.name || "").trim();
    if (!raw || /^proj[_-]\d+/i.test(raw) || raw === project?.id) {
      return "FastArt Video";
    }
    return raw;
  };

  const [exportFilename, setExportFilename] = useState(getInitialFilename);

  const handleCancelExport = () => {
    isCancelledRef.current = true;
    setStatus("idle");
    setProgress(0);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (!visible) {
      isCancelledRef.current = true;
    }
  }, [visible]);

  useEffect(() => {
    if (project?.resolution) setResolution(project.resolution);
    if (project?.fps) setFps(project.fps);
    setIsSaved(false);
    setIsSaving(false);
    setExportFilename(getInitialFilename());
  }, [project?.resolution, project?.fps, project?.title, project?.name, visible]);

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
    await executeDirectDownload({
      activeResult: targetResult || exportedResult,
      activeUrl: targetUrl || exportedUrl,
      mediaType,
      project,
      customFilename: exportFilename,
      resolution,
      selectedFormatConfig,
      onSavedSuccess: (filename, dest) => {
        setDownloadCompleteFilename(filename);
        if (dest) setDownloadDestination(dest);
        setIsSaved(true);
        // Do not popup extra modal on download
      },
      setSaving: setIsSaving,
      setNoticeDialog,
    });
  };

  const handleStartExport = async () => {
    isCancelledRef.current = false;
    setStatus("rendering");
    setErrorMessage(null);
    setProgress(0);
    soundEngine.playSfx("whoosh");

    try {
      if (Platform.OS === "web") {
        const offscreenCanvas = document.createElement("canvas");
        const baseResolutions: Record<string, Record<string, [number, number]>> = {
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

        const baseLogicalDims: Record<string, [number, number]> = {
          "9:16": [360, 640],
          "16:9": [640, 360],
          "1:1": [480, 480],
          "4:5": [384, 480],
          "2.35:1": [705, 300],
        };
        const [baseW, baseH] = baseLogicalDims[project.aspectRatio] || [360, 640];

        const renderer = new VideoRenderer(offscreenCanvas);
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
            logicalWidth: baseW,
            logicalHeight: baseH,
            isCancelled: () => isCancelledRef.current,
          },
          (pct) => {
            setProgress(pct);
          },
        );

        if (isCancelledRef.current) return;

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
        // Native Composite Mobile Export (bakes in canvas background, text, stickers, video, audio)
        const renderDuration = Math.max(totalDuration || 2.0, 1.0);
        const result = await exportMobileProject(
          project,
          {
            fps,
            duration: renderDuration,
            format: mediaType,
            currentTime: project.currentTime || 0,
            resolution,
            isCancelled: () => isCancelledRef.current,
          },
          (pct) => {
            setProgress(pct);
          }
        );

        if (isCancelledRef.current) return;

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
      }
    } catch (err: any) {
      if (err?.message === "Export cancelled" || isCancelledRef.current) {
        setStatus("idle");
        setProgress(0);
        return;
      }
      console.warn("Export error:", err);
      setStatus("error");
      setErrorMessage("Export could not be completed. Please try another format.");
    }
  };

  const getProgressStatusMessage = () => {
    switch (mediaType) {
      case "mp4":
        return "Encoding hardware-accelerated MP4 with text & stickers...";
      case "webm":
        return "Rendering WebM video frames with VP9 codec...";
      case "gif":
        return "Compositing multi-track animated GIF frames...";
      case "png":
        return "Compositing crisp lossless PNG snapshot with all text & stickers...";
      case "wav":
        return "Synthesizing 16-bit stereo PCM audio track...";
      default:
        return "Rendering frames...";
    }
  };

  return {
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
    handleCancelExport,
    getProgressStatusMessage,
    exportFilename,
    setExportFilename,
  };
}
