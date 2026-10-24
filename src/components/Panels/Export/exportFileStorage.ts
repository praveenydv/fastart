import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { BinaryFileWriter } from "../../../utils/renderer/mobileExporter";
import {
  Asset,
  requestPermissionsAsync,
  getPermissionsAsync,
} from "expo-media-library";
import * as MediaLibraryLegacy from "expo-media-library/legacy";
import { soundEngine } from "../../../utils/audioEngine";
import { ExportResult } from "../../../utils/videoRenderer";
import { MediaFormatOption, NoticeDialogState } from "./exportTypes";
import { triggerDownloadNotification } from "../../../utils/downloadNotification";

export interface DirectDownloadOptions {
  activeResult?: ExportResult | null;
  activeUrl?: string | null;
  mediaType: string;
  project: any;
  customFilename?: string;
  resolution: string;
  selectedFormatConfig: MediaFormatOption;
  onSavedSuccess: (filename: string, destinationPath?: string) => void;
  setSaving: (saving: boolean) => void;
  setNoticeDialog: (dialog: NoticeDialogState | null) => void;
}

export function resolveExportFilename(
  project: any,
  options: {
    customFilename?: string;
    mediaType?: string;
    ext?: string;
    resolution?: string;
  } = {}
): string {
  const { customFilename, mediaType = "mp4", ext = "mp4" } = options;

  // 1. Pick base title: custom filename first, then project title or name
  let rawTitle = (customFilename || "").trim();
  if (!rawTitle) {
    rawTitle = (project?.title || project?.name || "").trim();
  }

  // 2. If title is missing or equals the key (proj-1792... or starts with proj-), NEVER use key!
  if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === project?.id) {
    if (project?.title && !/^proj[_-]\d+/i.test(project.title) && project.title !== project?.id) {
      rawTitle = project.title;
    } else if (project?.name && !/^proj[_-]\d+/i.test(project.name) && project.name !== project?.id) {
      rawTitle = project.name;
    } else {
      rawTitle = "FastArt Video";
    }
  }

  // 3. Clean characters invalid in filenames across operating systems while keeping spaces
  const cleanBase = rawTitle.replace(/[/\\?%*:|"<>]/g, "").trim() || "FastArt Video";

  // 4. Strip redundant extension if already included by the user
  const cleanWithoutExt = cleanBase.replace(new RegExp(`\\.${ext}$`, "i"), "");

  // 5. Build final filename
  if (mediaType === "png") {
    return `${cleanWithoutExt}_Cover.${ext}`;
  } else if (mediaType === "wav") {
    return `${cleanWithoutExt}_Soundtrack.${ext}`;
  } else {
    // Keep clean file name with project name!
    return `${cleanWithoutExt}.${ext}`;
  }
}

export async function executeDirectDownload({
  activeResult,
  activeUrl,
  mediaType,
  project,
  customFilename,
  resolution,
  selectedFormatConfig,
  onSavedSuccess,
  setSaving,
  setNoticeDialog,
}: DirectDownloadOptions) {
  const targetUrl = activeUrl || activeResult?.videoUrl;
  if (!activeResult && !targetUrl) return;

  const ext = activeResult?.extension || selectedFormatConfig.id;
  const filename = resolveExportFilename(project, {
    customFilename,
    mediaType,
    ext,
    resolution,
  });

  // --- 1. WEB DIRECT DOWNLOAD ---
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

      // Modern File System Access API
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

          const destPath = `Downloads / ${filename}`;
          await triggerDownloadNotification({
            filename,
            destinationPath: destPath,
            projectId: project?.id,
            projectTitle: project?.title,
            fileSize: blob.size,
          });
          onSavedSuccess(filename, destPath);
          return;
        } catch (pickerErr: any) {
          if (pickerErr?.name === "AbortError") {
            return;
          }
        }
      }

      // Classic Browser Download Anchor
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

      document.body.appendChild(a);
      a.click();
      soundEngine.playSfx("pop");

      const destPath = `Downloads / ${filename}`;
      await triggerDownloadNotification({
        filename,
        destinationPath: destPath,
        projectId: project?.id,
        projectTitle: project?.title,
        fileSize: blob?.size,
      });
      onSavedSuccess(filename, destPath);

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
    // --- 2. MOBILE DIRECT DOWNLOAD (ANDROID / IOS) ---
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
      let savedPath = Platform.OS === "ios" ? "Photos & Files" : "Gallery / FastArt";
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
            const asset = await Asset.create(fileToSave);
            savedSuccess = true;
            savedPath =
              Platform.OS === "ios"
                ? `Photos / ${filename}`
                : (asset as any)?.uri
                ? `Gallery / DCIM / FastArt / ${filename}`
                : "Gallery / FastArt";
          }
        } catch (createErr) {
          console.warn("Asset.create failed, trying legacy save:", createErr);
        }

        if (!savedSuccess) {
          try {
            if (MediaLibraryLegacy?.saveToLibraryAsync) {
              await MediaLibraryLegacy.saveToLibraryAsync(fileToSave);
              savedSuccess = true;
              savedPath =
                Platform.OS === "ios"
                  ? "Photos / FastArt"
                  : "Gallery / Photos / FastArt";
            } else if (MediaLibraryLegacy?.createAssetAsync) {
              const asset = await MediaLibraryLegacy.createAssetAsync(fileToSave);
              savedSuccess = true;
              savedPath =
                asset?.uri ||
                (Platform.OS === "ios"
                  ? "Photos / FastArt"
                  : "Gallery / DCIM / FastArt");
            }
          } catch (legacyErr) {
            console.warn("Legacy saveToLibraryAsync error:", legacyErr);
          }
        }
      }

      // Android StorageAccessFramework Fallback (Downloads folder picker)
      if (
        !savedSuccess &&
        Platform.OS === "android" &&
        FileSystem.StorageAccessFramework
      ) {
        try {
          const perm =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (perm.granted) {
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

            // Stream file directly to SAF createdUri with zero monolithic heap allocations
            let copied = false;

            // Strategy 1: Native SAF copyAsync (zero memory overhead, native Java stream transfer)
            try {
              if ((FileSystem as any).StorageAccessFramework?.copyAsync) {
                await (FileSystem as any).StorageAccessFramework.copyAsync({
                  from: fileToSave,
                  to: createdUri,
                });
                copied = true;
              } else if (FileSystem.copyAsync) {
                await FileSystem.copyAsync({
                  from: fileToSave,
                  to: createdUri,
                });
                copied = true;
              }
            } catch (copyErr) {
              console.warn("SAF native copy failed, trying streams:", copyErr);
            }

            // Strategy 2: WebStreams file pipe
            if (!copied) {
              try {
                const srcFile = new File(fileToSave);
                const destFile = new File(createdUri);
                await srcFile.readableStream().pipeTo(destFile.writableStream());
                copied = true;
              } catch (streamErr) {
                console.warn("SAF stream pipe failed, falling back to chunked writer:", streamErr);
              }
            }

            // Strategy 3: Binary bytes write
            if (!copied) {
              try {
                const srcFile = new File(fileToSave);
                const bytes = await srcFile.bytes();
                const writer = new BinaryFileWriter(createdUri);
                await writer.write(bytes);
                await writer.close();
                copied = true;
              } catch (bytesErr) {
                console.warn("SAF binary copy failed, falling back to chunked Base64:", bytesErr);
              }
            }

            if (!copied) {
              // Legacy chunked read/write
              const info = await FileSystem.getInfoAsync(fileToSave);
              const size = (info as any).size || 0;
              const CHUNK = 512 * 1024;
              if (size > 0) {
                for (let pos = 0; pos < size; pos += CHUNK) {
                  const b64 = await FileSystem.readAsStringAsync(fileToSave, {
                    encoding: FileSystem.EncodingType.Base64,
                    position: pos,
                    length: Math.min(CHUNK, size - pos),
                  });
                  await FileSystem.writeAsStringAsync(createdUri, b64, {
                    encoding: FileSystem.EncodingType.Base64,
                    append: pos > 0,
                  });
                }
              }
            }

            if (copied) {
              savedSuccess = true;
              savedPath = "Device Downloads / " + filename;
            }
          }
        } catch (safErr) {
          console.warn("StorageAccessFramework save error:", safErr);
        }
      }

      setSaving(false);

      if (savedSuccess) {
        soundEngine.playSfx("pop");

        // Trigger system / in-app notification
        await triggerDownloadNotification({
          filename,
          destinationPath: savedPath,
          projectId: project?.id,
          projectTitle: project?.title,
          fileSize: activeResult?.fileSize,
        });

        onSavedSuccess(filename, savedPath);
      } else if (!hasPermission) {
        const isIOS = Platform.OS === "ios";
        setNoticeDialog({
          visible: true,
          title: "Permission Required",
          message: isIOS
            ? "Photos & Media Library permission is required to save directly to your Photos. Please grant permission to download."
            : "Photos & Media Library permission is required to save directly to your device storage. Please grant permission to download.",
          icon: "lock-closed-outline",
          iconColor: "#FFE600",
          primaryText: "Grant Permission",
          onPrimary: async () => {
            setNoticeDialog(null);
            await requestPermissionsAsync();
          },
          secondaryText: "Dismiss",
          onSecondary: () => setNoticeDialog(null),
        });
      } else {
        // Fallback file location without interrupting with an extra modal
        const fallbackPath = fileToSave.replace("file://", "");
        await triggerDownloadNotification({
          filename,
          destinationPath: fallbackPath,
          projectId: project?.id,
          projectTitle: project?.title,
          fileSize: activeResult?.fileSize,
        });

        onSavedSuccess(filename, fallbackPath);
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
