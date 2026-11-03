import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { DomWebView } from "@expo/dom-webview";
import { FastArtProject } from "../../../types/project";
import { ExportOptions, ExportResult } from "../../../utils/videoRenderer";
import { generateCanvasBridgeHtml } from "../../../utils/renderer/mobileWebBridge";

interface MobileCanvasExportViewProps {
  isExporting: boolean;
  project: FastArtProject;
  options: ExportOptions;
  onProgress?: (percent: number) => void;
  onComplete: (result: ExportResult) => void;
  onError: (error: Error) => void;
}

async function resolveUrlForWebView(url: string | undefined, id: string, defaultExt: string, dir: string): Promise<string | undefined> {
  if (!url || !url.startsWith("content://")) return url;
  try {
    const ext = url.split("?")[0].split(".").pop() || defaultExt;
    const localPath = `${dir}wv_media_${id}_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: url, to: localPath });
    return localPath.startsWith("file://") ? localPath : `file://${localPath}`;
  } catch (e) {
    console.warn("[MobileCanvasExportView] Failed to copy content media for webview:", e);
    return url;
  }
}

async function resolveProjectMediaForWebView(proj: FastArtProject): Promise<FastArtProject> {
  const cloned: FastArtProject = JSON.parse(JSON.stringify(proj));
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";

  if (cloned.tracks?.video) {
    for (const clip of cloned.tracks.video) {
      if (clip.url) {
        clip.url = (await resolveUrlForWebView(clip.url, clip.id, clip.type === "video" ? "mp4" : "jpg", dir)) || clip.url;
      }
      if (clip.thumbnail) {
        clip.thumbnail = await resolveUrlForWebView(clip.thumbnail, `${clip.id}_thumb`, "jpg", dir);
      }
    }
  }

  if (cloned.tracks?.audio) {
    for (const clip of cloned.tracks.audio) {
      if (clip.url) {
        clip.url = (await resolveUrlForWebView(clip.url, clip.id, "wav", dir)) || clip.url;
      }
    }
  }

  if (cloned.tracks?.stickers) {
    for (const clip of cloned.tracks.stickers) {
      const stickerUrl = (clip as any).url;
      if (stickerUrl) {
        (clip as any).url = (await resolveUrlForWebView(stickerUrl, clip.id, "png", dir)) || stickerUrl;
      }
    }
  }

  if (cloned.canvasBackground && typeof cloned.canvasBackground === "string" && cloned.canvasBackground.startsWith("image:")) {
    const rawBg = cloned.canvasBackground.replace("image:", "");
    const resolvedBg = await resolveUrlForWebView(rawBg, "bg_image", "jpg", dir);
    if (resolvedBg) {
      cloned.canvasBackground = `image:${resolvedBg}`;
    }
  }

  return cloned;
}

function cleanBase64Payload(raw: string): string {
  if (!raw) return "";
  let s = raw;
  const commaIdx = s.indexOf(",");
  if (commaIdx >= 0) {
    s = s.slice(commaIdx + 1);
  }
  // Strip whitespace, linebreaks, and illegal characters
  s = s.replace(/[^A-Za-z0-9+/=]/g, "");
  // Pad with '=' to guarantee 4-character alignment required by Android Base64.decode
  const mod = s.length % 4;
  if (mod === 2) s += "==";
  else if (mod === 3) s += "=";
  else if (mod === 1) s = s.slice(0, -1);
  return s;
}

export default function MobileCanvasExportView({
  isExporting,
  project,
  options,
  onProgress,
  onComplete,
  onError,
}: MobileCanvasExportViewProps) {
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);
  const isDoneRef = useRef(false);
  const currentChunkedFileRef = useRef<{
    uri: string;
    mimeType: string;
    extension: string;
    fileSize?: number;
    writeQueue: Promise<void>;
    writeError?: Error;
  } | null>(null);

  useEffect(() => {
    if (!isExporting) {
      setHtmlUri(null);
      isDoneRef.current = false;
      currentChunkedFileRef.current = null;
      return;
    }

    let isMounted = true;
    isDoneRef.current = false;
    currentChunkedFileRef.current = null;

    async function prepareHtml() {
      try {
        const resolvedProject = await resolveProjectMediaForWebView(project);
        const html = generateCanvasBridgeHtml(resolvedProject, options);
        const tempPath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}fastart_canvas_export.html`;
        await FileSystem.writeAsStringAsync(tempPath, html, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (isMounted) {
          // Never append query parameters (e.g. ?t=...) to local file:// URIs on Android
          setHtmlUri(tempPath);
        }
      } catch (err: any) {
        if (isMounted) {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    prepareHtml();

    return () => {
      isMounted = false;
    };
  }, [isExporting, project, options]);

  const handleMessage = async (event: any) => {
    try {
      const rawData = event?.nativeEvent?.data;
      if (!rawData) return;
      const data = JSON.parse(rawData);

      if (data.type === "PROGRESS") {
        if (onProgress && typeof data.progress === "number") {
          onProgress(data.progress);
        }
      } else if (data.type === "CHUNK_START") {
        let rawTitle = (project.title || (project as any).name || "").trim();
        if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === project.id) {
          rawTitle = options.format === "png" ? "FastArt_Cover" : options.format === "gif" ? "FastArt_Anim" : "FastArt_Video";
        }
        const cleanTitle =
          rawTitle.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || "FastArt_Video";
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
        const targetFileUri = `${dir}${cleanTitle}_${Date.now()}.${data.extension || "mp4"}`;

        const output: NonNullable<typeof currentChunkedFileRef.current> = {
          uri: targetFileUri,
          mimeType: data.mimeType || "video/mp4",
          extension: data.extension || "mp4",
          fileSize: data.fileSize,
          writeQueue: Promise.resolve(),
        };
        currentChunkedFileRef.current = output;
        output.writeQueue = FileSystem.writeAsStringAsync(targetFileUri, "", {
          encoding: FileSystem.EncodingType.Base64,
        }).catch((err) => {
          output.writeError = err instanceof Error ? err : new Error(String(err));
        });
      } else if (data.type === "CHUNK_DATA" && currentChunkedFileRef.current) {
        const output = currentChunkedFileRef.current;
        if (data.chunk && !output.writeError) {
          // Serialize appends because WebView messages can arrive before the
          // prior native filesystem write has completed. The bridge's chunks
          // are base64-aligned, so each append decodes independently.
          output.writeQueue = output.writeQueue
            .then(() => output.writeError ? undefined : FileSystem.writeAsStringAsync(output.uri, data.chunk, {
                encoding: FileSystem.EncodingType.Base64,
                append: true,
              }))
            .catch((err) => {
              output.writeError = err instanceof Error ? err : new Error(String(err));
            });
        }
      } else if (data.type === "CHUNK_END" && currentChunkedFileRef.current && !isDoneRef.current) {
        isDoneRef.current = true;
        const info = currentChunkedFileRef.current;
        await info.writeQueue;
        if (info.writeError) {
          currentChunkedFileRef.current = null;
          onError(info.writeError);
          return;
        }

        const fileStat = await FileSystem.getInfoAsync(info.uri);
        const result: ExportResult = {
          blob: { size: fileStat.exists ? (fileStat as any).size : (info.fileSize || 0), type: info.mimeType } as any,
          videoUrl: info.uri,
          mimeType: info.mimeType,
          format: options.format || "mp4",
          extension: info.extension,
          fileSize: fileStat.exists ? (fileStat as any).size : info.fileSize,
        };
        currentChunkedFileRef.current = null;
        onComplete(result);
      } else if (data.type === "COMPLETE" && !isDoneRef.current) {
        isDoneRef.current = true;
        const { base64, mimeType, extension, fileSize } = data;

        let rawTitle = (project.title || (project as any).name || "").trim();
        if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === project.id) {
          rawTitle = options.format === "png" ? "FastArt_Cover" : options.format === "gif" ? "FastArt_Anim" : "FastArt_Video";
        }
        const cleanTitle =
          rawTitle.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || "FastArt_Video";
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
        const targetFileUri = `${dir}${cleanTitle}_${Date.now()}.${extension}`;

        const cleanB64 = cleanBase64Payload(base64);
        await FileSystem.writeAsStringAsync(targetFileUri, cleanB64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const result: ExportResult = {
          blob: { size: fileSize || 0, type: mimeType } as any,
          videoUrl: targetFileUri,
          mimeType,
          format: options.format || "mp4",
          extension,
          fileSize: fileSize || Math.round(cleanB64.length * 0.75),
        };

        onComplete(result);
      } else if (data.type === "ERROR") {
        onError(new Error(data.message || "Canvas export error in WebView"));
      }
    } catch (e: any) {
      console.warn("[MobileCanvasExportView] Message parse error:", e);
    }
  };

  if (!isExporting || !htmlUri || Platform.OS === "web") {
    return null;
  }

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <DomWebView
        ref={webViewRef}
        source={{ uri: htmlUri }}
        style={styles.webView}
        containerStyle={styles.webView}
        onMessage={handleMessage}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 1, // Visible to Android compositor so GPU pipeline runs at 60 fps
    zIndex: -1, // Sits safely behind the modal card
  },
  webView: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
