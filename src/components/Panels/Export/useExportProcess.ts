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
import {
  MEDIA_FORMATS,
  NoticeDialogState,
  getExportResolutionDimensions,
  getLogicalBaseDimensions,
} from "./exportTypes";
import { executeDirectDownload } from "./exportFileStorage";
import { exportFastArtProject } from "../../../utils/renderer/unifiedExporter";
import { rustCoreBridge } from "../../../services/rustCoreBridge";

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
  const lastSeenProgressRef = useRef(0);
  const [isMobileCanvasRendering, setIsMobileCanvasRendering] = useState(false);
  const mobileCanvasResolverRef = useRef<{
    resolve: (res: ExportResult) => void;
    reject: (err: any) => void;
  } | null>(null);

  const updateProgressMonotonic = (pct: number) => {
    const safe = Math.min(100, Math.max(lastSeenProgressRef.current, Math.round(pct)));
    lastSeenProgressRef.current = safe;
    setProgress(safe);
  };

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
    lastSeenProgressRef.current = 0;
    if (mobileCanvasResolverRef.current) {
      mobileCanvasResolverRef.current.reject(new Error("Export cancelled"));
      mobileCanvasResolverRef.current = null;
    }
    setIsMobileCanvasRendering(false);
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
    lastSeenProgressRef.current = 0;
    setStatus("rendering");
    setErrorMessage(null);
    setProgress(0);
    soundEngine.playSfx("whoosh");

    try {
      const renderDuration = Math.max(totalDuration || 2.0, 1.0);
      updateProgressMonotonic(5);

      let result: ExportResult | null = null;
      try {
        result = await exportFastArtProject(
          project,
          {
            fps,
            duration: renderDuration,
            format: mediaType,
            currentTime: project?.currentTime || 0,
            resolution,
            isCancelled: () => isCancelledRef.current,
          },
          (pct) => {
            updateProgressMonotonic(pct);
          }
        );
      } catch (nativeErr: any) {
        if (isCancelledRef.current || nativeErr?.message === "Export cancelled") {
          throw nativeErr;
        }

        // On Native Mobile (iOS/Android): If native Rust is unlinked or falls back, engage headless DomWebView canvas bridge
        if (
          Platform.OS !== "web" &&
          (mediaType === "mp4" || mediaType === "webm") &&
          (nativeErr?.message === "NATIVE_BRIDGE_FALLBACK_REQUIRED" ||
            nativeErr?.message?.includes("could not be rendered"))
        ) {
          console.log("[useExportProcess] Native Rust unavailable, engaging Headless Canvas WebView bridge fallback...");
          setIsMobileCanvasRendering(true);
          result = await new Promise<ExportResult>((resolve, reject) => {
            mobileCanvasResolverRef.current = { resolve, reject };
          });
        } else {
          throw nativeErr;
        }
      }

      if (isCancelledRef.current || !result) return;

      updateProgressMonotonic(100);
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
    } catch (err: any) {
      if (err?.message === "Export cancelled" || isCancelledRef.current) {
        setStatus("idle");
        setProgress(0);
        return;
      }
      console.warn("Export error:", err);
      setStatus("error");
      setErrorMessage("Export could not be completed. Please try another format.");
    } finally {
      setIsMobileCanvasRendering(false);
      mobileCanvasResolverRef.current = null;
    }
  };

  const handleMobileCanvasComplete = (result: ExportResult) => {
    if (mobileCanvasResolverRef.current) {
      mobileCanvasResolverRef.current.resolve(result);
      mobileCanvasResolverRef.current = null;
    }
  };

  const handleMobileCanvasError = (err: Error) => {
    if (mobileCanvasResolverRef.current) {
      mobileCanvasResolverRef.current.reject(err);
      mobileCanvasResolverRef.current = null;
    }
  };

  const handleMobileCanvasProgress = (pct: number) => {
    updateProgressMonotonic(pct);
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
    isMobileCanvasRendering,
    handleMobileCanvasComplete,
    handleMobileCanvasError,
    handleMobileCanvasProgress,
  };
}
