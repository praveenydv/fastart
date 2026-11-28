import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import {
  VideoRenderer,
  ExportFormat,
  ExportResult,
  pauseActiveVideoRenderer,
  getActiveVideoRenderer,
} from "../../../utils/videoRenderer";
import { pauseAllAudio } from "../../Player/usePlayerAudioSync";
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
import { setExportingActive, cancelLiveSegmentation } from "../../../services/selfieSegmentationService";

export function useExportProcess(
  project: any,
  totalDuration: number,
  visible: boolean,
) {
  const [mediaType, setMediaType] = useState<ExportFormat>("mp4");
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState(30);
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
  const [mobileBridgeResolution, setMobileBridgeResolution] = useState<string | null>(null);
  const [mobileBridgeFps, setMobileBridgeFps] = useState<number | null>(null);
  const mobileCanvasResolverRef = useRef<{
    resolve: (res: ExportResult) => void;
    reject: (err: any) => void;
  } | null>(null);

  const updateProgressMonotonic = (pct: number, forceReset = false) => {
    if (forceReset || pct === 0) {
      lastSeenProgressRef.current = 0;
      setProgress(0);
      return;
    }
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
    setExportingActive(false);
    setStatus("idle");
    setProgress(0);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (visible) {
      setMediaType("mp4");
      setResolution("1080p");
      setFps(30);
      setIsSaved(false);
      setIsSaving(false);
      setExportFilename(getInitialFilename());
      isCancelledRef.current = false;
      lastSeenProgressRef.current = 0;
    } else {
      isCancelledRef.current = true;
    }
  }, [visible]);

  const selectedFormatConfig =
    MEDIA_FORMATS.find((f) => f.id === mediaType) || MEDIA_FORMATS[0];

  const calculateEstimatedSize = () => {
    const dur = Math.max(totalDuration || 5, 1);
    if (mediaType === "png") {
      const snapMb = resolution === "2K/4K" ? 5.5 : resolution === "1080p" ? 2.2 : 1.1;
      return `~${snapMb.toFixed(1)} MB`;
    }
    if (mediaType === "wav") {
      // 16-bit 44.1kHz Stereo PCM = 176.4 kB/s = ~0.176 MB/s
      return `~${(dur * 0.176).toFixed(1)} MB`;
    }

    // MediaRecorder VBR empirical bitrates across modern browser encoders:
    // 2K/4K: ~4.5 - 6.0 Mbps, 1080p: ~2.8 - 3.6 Mbps, 720p: ~1.4 - 2.0 Mbps
    let targetVideoBps = 3_200_000;
    if (resolution === "2K/4K") {
      targetVideoBps = 4_600_000;
    } else if (resolution === "1080p") {
      targetVideoBps = 3_200_000;
    } else {
      targetVideoBps = 1_800_000;
    }
    if (fps >= 60) {
      targetVideoBps = Math.round(targetVideoBps * 1.35);
    }

    const audioBps = 192_000;
    const totalBytesPerSec = (targetVideoBps + audioBps) / 8;
    const estMb = (totalBytesPerSec * dur) / (1024 * 1024);
    return `~${estMb.toFixed(1)} MB`;
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
    setExportingActive(true);
    try {
      pauseActiveVideoRenderer();
      pauseAllAudio();
      cancelLiveSegmentation();
      // On mobile web browsers, flush the preview player's <video> decoders so hardware
      // decoder slots are freed for export (Player re-attaches them automatically after export).
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      ) {
        getActiveVideoRenderer()?.pruneUnusedMedia(new Set());
      }
    } catch {}

    try {
      const renderDuration = Math.max(totalDuration || 2.0, 1.0);

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
          (mediaType === "mp4" || mediaType === "webm" || mediaType === "png") &&
          (nativeErr?.message === "NATIVE_BRIDGE_FALLBACK_REQUIRED" ||
            nativeErr?.message?.includes("could not be rendered"))
        ) {
          console.log(`[useExportProcess] Native Rust unavailable, engaging Headless Canvas WebView bridge fallback for ${mediaType.toUpperCase()}...`);
          const fallbackSteps: Array<{ res: string; fpsVal: number }> = [];
          fallbackSteps.push({ res: resolution, fpsVal: fps });
          if (resolution === "2K/4K") {
            fallbackSteps.push({ res: "1080p", fpsVal: Math.min(fps, 30) });
            fallbackSteps.push({ res: "720p", fpsVal: 30 });
          } else if (resolution === "1080p") {
            if (fps >= 60) fallbackSteps.push({ res: "1080p", fpsVal: 30 });
            fallbackSteps.push({ res: "720p", fpsVal: 30 });
          } else if (fps >= 60) {
            fallbackSteps.push({ res: "720p", fpsVal: 30 });
          }

          let attemptErr: any = null;
          let finalExportRes = resolution;
          for (let attemptIdx = 0; attemptIdx < fallbackSteps.length; attemptIdx++) {
            if (isCancelledRef.current) throw new Error("Export cancelled");
            const step = fallbackSteps[attemptIdx];
            finalExportRes = step.res;
            setMobileBridgeResolution(step.res);
            setMobileBridgeFps(step.fpsVal);
            if (attemptIdx > 0) {
              setResolution(step.res);
              setFps(step.fpsVal);
              // Remount WebView cleanly after OOM process termination
              setIsMobileCanvasRendering(false);
              lastSeenProgressRef.current = 0;
              setProgress(0);
              await new Promise((r) => setTimeout(r, 250));
              if (isCancelledRef.current) throw new Error("Export cancelled");
            }
            setIsMobileCanvasRendering(true);
            try {
              result = await new Promise<ExportResult>((resolve, reject) => {
                mobileCanvasResolverRef.current = { resolve, reject };
              });
              attemptErr = null;
              break;
            } catch (bridgeErr: any) {
              attemptErr = bridgeErr;
              const isOomTermination =
                typeof bridgeErr?.message === "string" &&
                bridgeErr.message.includes("WEBVIEW_PROCESS_TERMINATED");
              if (!isOomTermination || attemptIdx === fallbackSteps.length - 1 || isCancelledRef.current) {
                throw bridgeErr;
              }
              console.warn(
                `[useExportProcess] WebView terminated at ${step.res}@${step.fpsVal}fps; retrying at lower memory profile...`
              );
            }
          }
          if (attemptErr) throw attemptErr;
          if (isCancelledRef.current || !result) return;

          updateProgressMonotonic(100);
          setExportedResult(result);
          setExportedUrl(result.videoUrl);
          setStatus("done");
          addNotification({
            title: "Export Ready",
            message: `"${project?.title || "Project"}" exported as ${finalExportRes} ${mediaType.toUpperCase()}.`,
            projectId: project?.id,
            projectTitle: project?.title,
            actionText: "Open Project",
            icon: "videocam",
          });
          return;
        } else {
          throw nativeErr;
        }
      }

      if (isCancelledRef.current || !result) return;

      updateProgressMonotonic(100);
      setExportedResult(result);
      setExportedUrl(result.videoUrl);
      setStatus("done");
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
      const msg = typeof err?.message === "string" ? err.message : "";
      if (msg.includes("WEBVIEW_PROCESS_TERMINATED")) {
        setErrorMessage(
          "Your device ran low on memory during export. Try exporting at 720p or closing background apps."
        );
      } else {
        setErrorMessage("Export could not be completed. Please try another format or lower resolution.");
      }
    } finally {
      setExportingActive(false);
      setIsMobileCanvasRendering(false);
      setMobileBridgeResolution(null);
      setMobileBridgeFps(null);
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
    if (progress === 0) {
      return "Preparing project media & hardware encoder...";
    }
    if (progress >= 99) {
      return "Finalizing container and optimizing stream...";
    }
    switch (mediaType) {
      case "mp4":
        return `Encoding hardware MP4 (${progress}%)...`;
      case "webm":
        return `Rendering WebM video frames (${progress}%)...`;
      case "png":
        return `Compositing lossless PNG snapshot (${progress}%)...`;
      case "wav":
        return `Synthesizing 16-bit stereo PCM audio (${progress}%)...`;
      default:
        return `Rendering frames (${progress}%)...`;
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
    mobileBridgeResolution,
    mobileBridgeFps,
    handleMobileCanvasComplete,
    handleMobileCanvasError,
    handleMobileCanvasProgress,
  };
}
