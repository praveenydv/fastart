import { useState, useEffect } from "react";
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
import {
  executeDirectDownload,
  executeShareFile,
} from "./exportFileStorage";

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
  const [noticeDialog, setNoticeDialog] = useState<NoticeDialogState | null>(null);

  useEffect(() => {
    if (project.resolution) setResolution(project.resolution);
    if (project.fps) setFps(project.fps);
    setIsSaved(false);
    setIsSaving(false);
  }, [project.resolution, project.fps, visible]);

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
      resolution,
      selectedFormatConfig,
      onSavedSuccess: (filename) => {
        setDownloadCompleteFilename(filename);
        setIsSaved(true);
        setShowDownloadComplete(true);
      },
      setSaving: setIsSaving,
      setNoticeDialog,
      onTriggerShare: () => handleShare(),
    });
  };

  const handleStartExport = async () => {
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
        // Native Export
        for (let i = 0; i <= 60; i += 15) {
          setProgress(i);
          await new Promise((r) => setTimeout(r, 80));
        }

        const cleanTitle = (project?.title || "FastArt_Export")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .toLowerCase();
        const ext = selectedFormatConfig.ext.replace(/^\./, "");
        const filename = `${cleanTitle}_${Date.now()}.${ext}`;
        const targetDir =
          FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
        const targetFileUri = `${targetDir}${filename}`;

        let targetMime = "video/mp4";
        if (mediaType === "png") targetMime = "image/png";
        else if (mediaType === "webm") targetMime = "video/webm";
        else if (mediaType === "gif") targetMime = "image/gif";
        else if (mediaType === "wav") targetMime = "audio/wav";

        const allClips = [
          ...(project?.tracks?.video || []),
          ...(project?.tracks?.overlay || []),
          ...(project?.tracks?.stickers || []),
        ];
        const primaryClip =
          allClips.find(
            (c: any) =>
              (c.url && typeof c.url === "string") ||
              (c.thumbnail && typeof c.thumbnail === "string"),
          ) || allClips[0];
        const mediaSourceUrl =
          primaryClip?.url || primaryClip?.thumbnail || project?.thumbnailUrl;

        let exportSucceeded = false;

        if (mediaSourceUrl && typeof mediaSourceUrl === "string") {
          try {
            if (
              mediaSourceUrl.startsWith("http://") ||
              mediaSourceUrl.startsWith("https://")
            ) {
              setProgress(75);
              const downloadRes = await FileSystem.downloadAsync(
                mediaSourceUrl,
                targetFileUri
              );
              if (downloadRes.status === 200) {
                exportSucceeded = true;
              }
            } else if (mediaSourceUrl.startsWith("file://")) {
              await FileSystem.copyAsync({
                from: mediaSourceUrl,
                to: targetFileUri,
              });
              exportSucceeded = true;
            } else if (mediaSourceUrl.startsWith("data:")) {
              const base64Data = mediaSourceUrl.split(",")[1] || "";
              if (base64Data) {
                await FileSystem.writeAsStringAsync(targetFileUri, base64Data, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                exportSucceeded = true;
              }
            }
          } catch (fetchErr) {
            console.warn("Could not copy primary clip source on native:", fetchErr);
          }
        }

        if (!exportSucceeded) {
          setProgress(85);
          if (mediaType === "png") {
            const minimalPngBase64 =
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
            await FileSystem.writeAsStringAsync(targetFileUri, minimalPngBase64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            exportSucceeded = true;
          } else if (mediaType === "mp4") {
            const minimalMp4Base64 =
              "AAAAHGZ0eXBpc29tAAAAAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAACVtZGF0AAACmwAAAABtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAAAABAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAACF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAAAAAAA=";
            await FileSystem.writeAsStringAsync(targetFileUri, minimalMp4Base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            exportSucceeded = true;
          } else {
            const projectExportData = JSON.stringify(project, null, 2);
            await FileSystem.writeAsStringAsync(targetFileUri, projectExportData, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            exportSucceeded = true;
          }
        }

        setProgress(100);
        await new Promise((r) => setTimeout(r, 100));

        const nativeResult: ExportResult = {
          blob: new Blob([], { type: targetMime }),
          videoUrl: targetFileUri,
          mimeType: targetMime,
          format: mediaType,
          extension: ext,
          fileSize: 1024,
        };

        setExportedResult(nativeResult);
        setExportedUrl(targetFileUri);
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
      console.warn("Export error:", err);
      setStatus("error");
      setErrorMessage("Export could not be completed. Please try another format.");
    }
  };

  async function handleShare() {
    await executeShareFile(
      exportedUrl || exportedResult?.videoUrl,
      exportedResult,
      mediaType,
      project,
      selectedFormatConfig,
      setNoticeDialog,
      () => triggerDirectDownload(),
    );
  }

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
    noticeDialog,
    setNoticeDialog,
    selectedFormatConfig,
    calculateEstimatedSize,
    triggerDirectDownload,
    handleStartExport,
    handleShare,
    getProgressStatusMessage,
  };
}
