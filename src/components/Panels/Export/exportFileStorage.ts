import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import {
  Asset,
  requestPermissionsAsync,
  getPermissionsAsync,
} from "expo-media-library";
import * as MediaLibraryLegacy from "expo-media-library/legacy";
import { soundEngine } from "../../../utils/audioEngine";
import { ExportResult } from "../../../utils/videoRenderer";
import { MediaFormatOption, NoticeDialogState } from "./exportTypes";

export interface DirectDownloadOptions {
  activeResult?: ExportResult | null;
  activeUrl?: string | null;
  mediaType: string;
  project: any;
  resolution: string;
  selectedFormatConfig: MediaFormatOption;
  onSavedSuccess: (filename: string) => void;
  setSaving: (saving: boolean) => void;
  setNoticeDialog: (dialog: NoticeDialogState | null) => void;
  onTriggerShare: () => void;
}

export async function executeDirectDownload({
  activeResult,
  activeUrl,
  mediaType,
  project,
  resolution,
  selectedFormatConfig,
  onSavedSuccess,
  setSaving,
  setNoticeDialog,
  onTriggerShare,
}: DirectDownloadOptions) {
  const targetUrl = activeUrl || activeResult?.videoUrl;
  if (!activeResult && !targetUrl) return;

  const ext = activeResult?.extension || selectedFormatConfig.id;
  const cleanTitle = (project.title || "FastArt_Video").replace(/[^a-zA-Z0-9_-]/g, "_");

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
      if (!blob && targetUrl) {
        try {
          const resp = await fetch(targetUrl);
          blob = await resp.blob();
        } catch (fetchErr) {
          console.warn("Blob fetch failed:", fetchErr);
        }
      }

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
          onSavedSuccess(filename);
          return;
        } catch (pickerErr: any) {
          if (pickerErr?.name === "AbortError") {
            return;
          }
        }
      }

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

      a.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      document.body.appendChild(a);
      a.click();
      soundEngine.playSfx("pop");
      onSavedSuccess(filename);

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
    try {
      setSaving(true);
      const fileToSave = targetUrl;
      if (!fileToSave) {
        setNoticeDialog({
          visible: true,
          title: "File Not Ready",
          message: "Please wait for export to finish before downloading.",
          icon: "hourglass-outline",
          iconColor: "#FFE600",
          secondaryText: "Dismiss",
          onSecondary: () => setNoticeDialog(null),
        });
        setSaving(false);
        return;
      }

      let savedSuccess = false;
      let hasPermission = false;
      try {
        const permStatus = await getPermissionsAsync();
        if (permStatus.granted) {
          hasPermission = true;
        } else {
          const req = await requestPermissionsAsync();
          hasPermission = req.granted;
        }
      } catch (permErr) {
        try {
          const legacyReq = await MediaLibraryLegacy.requestPermissionsAsync();
          hasPermission = legacyReq.granted;
        } catch (e) {
          console.warn("Permission check error:", e);
        }
      }

      if (hasPermission) {
        try {
          if (Asset && typeof Asset.create === "function") {
            await Asset.create(fileToSave);
            savedSuccess = true;
          }
        } catch (createErr) {
          console.warn("Asset.create failed, trying legacy save:", createErr);
        }

        if (!savedSuccess) {
          try {
            if (MediaLibraryLegacy?.saveToLibraryAsync) {
              await MediaLibraryLegacy.saveToLibraryAsync(fileToSave);
              savedSuccess = true;
            } else if (MediaLibraryLegacy?.createAssetAsync) {
              await MediaLibraryLegacy.createAssetAsync(fileToSave);
              savedSuccess = true;
            }
          } catch (legacyErr) {
            console.warn("Legacy saveToLibraryAsync error:", legacyErr);
          }
        }
      }

      if (
        !savedSuccess &&
        Platform.OS === "android" &&
        FileSystem.StorageAccessFramework
      ) {
        try {
          const perm =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (perm.granted) {
            const fileContent = await FileSystem.readAsStringAsync(fileToSave, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const mime =
              activeResult?.mimeType ||
              (mediaType === "mp4"
                ? "video/mp4"
                : mediaType === "png"
                ? "image/png"
                : "application/octet-stream");
            const createdUri =
              await FileSystem.StorageAccessFramework.createFileAsync(
                perm.directoryUri,
                filename,
                mime
              );
            await FileSystem.writeAsStringAsync(createdUri, fileContent, {
              encoding: FileSystem.EncodingType.Base64,
            });
            savedSuccess = true;
          }
        } catch (safErr) {
          console.warn("StorageAccessFramework save error:", safErr);
        }
      }

      setSaving(false);

      if (savedSuccess) {
        soundEngine.playSfx("pop");
        onSavedSuccess(filename);
      } else if (!hasPermission) {
        setNoticeDialog({
          visible: true,
          title: "Permission Required",
          message:
            "Photos & Media Library access is required to save directly to your device gallery. You can still share the video directly to WhatsApp, Instagram, and other apps.",
          icon: "lock-closed-outline",
          iconColor: "#FFE600",
          primaryText: "Share via Apps",
          onPrimary: () => {
            setNoticeDialog(null);
            onTriggerShare();
          },
          secondaryText: "Dismiss",
          onSecondary: () => setNoticeDialog(null),
        });
      } else {
        setNoticeDialog({
          visible: true,
          title: "Download Notice",
          message: `File exported successfully to:\n${fileToSave}\n\nWould you like to share it to another app?`,
          icon: "information-circle-outline",
          iconColor: "#00F2FE",
          primaryText: "Share via Apps",
          onPrimary: () => {
            setNoticeDialog(null);
            onTriggerShare();
          },
          secondaryText: "Dismiss",
          onSecondary: () => setNoticeDialog(null),
        });
      }
    } catch (err: any) {
      setSaving(false);
      console.warn("Native download error:", err);
      setNoticeDialog({
        visible: true,
        title: "Download Issue",
        message:
          "Could not save file to device: " + (err?.message || "unknown error"),
        icon: "alert-circle-outline",
        iconColor: "#FF0050",
        secondaryText: "Dismiss",
        onSecondary: () => setNoticeDialog(null),
      });
    }
  }
}

export async function executeShareFile(
  fileToShare: string | null | undefined,
  exportedResult: ExportResult | null,
  mediaType: string,
  project: any,
  selectedFormatConfig: MediaFormatOption,
  setNoticeDialog: (dialog: NoticeDialogState | null) => void,
  onFallbackDownload: () => void,
) {
  if (!fileToShare) {
    setNoticeDialog({
      visible: true,
      title: "File Not Ready",
      message: "Please wait for export to finish or re-export your video first.",
      icon: "hourglass-outline",
      iconColor: "#FFE600",
      secondaryText: "Dismiss",
      onSecondary: () => setNoticeDialog(null),
    });
    return;
  }

  try {
    if (Platform.OS === "web") {
      if (
        typeof navigator !== "undefined" &&
        (navigator as any).share &&
        exportedResult?.blob
      ) {
        try {
          const file = new File(
            [exportedResult.blob],
            `${(project?.title || "FastArt").replace(/[^a-zA-Z0-9_-]/g, "_")}.${selectedFormatConfig.ext.replace(/^\./, "")}`,
            { type: exportedResult.mimeType || "video/mp4" }
          );
          await (navigator as any).share({
            title: project?.title || "FastArt Video",
            files: [file],
          });
          soundEngine.playSfx("pop");
          return;
        } catch (webShareErr) {
          console.warn("Web share dismissed or unavailable:", webShareErr);
        }
      }
      onFallbackDownload();
      return;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      setNoticeDialog({
        visible: true,
        title: "Share Unavailable",
        message: `Direct app sharing is not supported in this environment. Your file is saved at: ${fileToShare}`,
        icon: "share-social-outline",
        iconColor: "#00F2FE",
        secondaryText: "Got It",
        onSecondary: () => setNoticeDialog(null),
      });
      return;
    }

    const mime =
      exportedResult?.mimeType ||
      (mediaType === "mp4"
        ? "video/mp4"
        : mediaType === "png"
        ? "image/png"
        : "application/octet-stream");

    await Sharing.shareAsync(fileToShare, {
      mimeType: mime,
      dialogTitle: `Share ${project?.title || "Video"}`,
      UTI:
        mediaType === "mp4"
          ? "public.movie"
          : mediaType === "png"
          ? "public.image"
          : undefined,
    });
    soundEngine.playSfx("pop");
  } catch (err: any) {
    console.warn("Native share error:", err);
  }
}
