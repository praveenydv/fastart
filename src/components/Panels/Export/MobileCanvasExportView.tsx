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

async function resolveProjectMediaForWebView(proj: FastArtProject): Promise<FastArtProject> {
  const cloned: FastArtProject = JSON.parse(JSON.stringify(proj));
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";

  if (cloned.tracks?.video) {
    for (const clip of cloned.tracks.video) {
      if (clip.url && clip.url.startsWith("content://")) {
        try {
          const ext = clip.url.split("?")[0].split(".").pop() || (clip.type === "video" ? "mp4" : "jpg");
          const localPath = `${dir}wv_media_${clip.id}_${Date.now()}.${ext}`;
          await FileSystem.copyAsync({ from: clip.url, to: localPath });
          clip.url = localPath.startsWith("file://") ? localPath : `file://${localPath}`;
        } catch (e) {
          console.warn("[MobileCanvasExportView] Failed to copy content media for webview:", e);
        }
      }
    }
  }
  return cloned;
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
  const currentChunkedFileRef = useRef<{ uri: string; mimeType: string; extension: string; fileSize?: number } | null>(null);

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
          setHtmlUri(`${tempPath}?t=${Date.now()}`);
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
          rawTitle = "FastArt_Video";
        }
        const cleanTitle =
          rawTitle.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || "FastArt_Video";
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
        const targetFileUri = `${dir}${cleanTitle}_${Date.now()}.${data.extension || "mp4"}`;

        // Initialize empty file
        await FileSystem.writeAsStringAsync(targetFileUri, "", { encoding: FileSystem.EncodingType.UTF8 });
        currentChunkedFileRef.current = {
          uri: targetFileUri,
          mimeType: data.mimeType || "video/mp4",
          extension: data.extension || "mp4",
          fileSize: data.fileSize,
        };
      } else if (data.type === "CHUNK_DATA" && currentChunkedFileRef.current) {
        if (data.chunk) {
          await FileSystem.writeAsStringAsync(currentChunkedFileRef.current.uri, data.chunk, {
            encoding: FileSystem.EncodingType.Base64,
            append: true,
          });
        }
      } else if (data.type === "CHUNK_END" && currentChunkedFileRef.current && !isDoneRef.current) {
        isDoneRef.current = true;
        const info = currentChunkedFileRef.current;
        const fileStat = await FileSystem.getInfoAsync(info.uri);

        const result: ExportResult = {
          blob: { size: fileStat.exists ? (fileStat as any).size : (info.fileSize || 0), type: info.mimeType } as any,
          videoUrl: info.uri,
          mimeType: info.mimeType,
          format: options.format || "mp4",
          extension: info.extension,
          fileSize: fileStat.exists ? (fileStat as any).size : info.fileSize,
        };
        onComplete(result);
      } else if (data.type === "COMPLETE" && !isDoneRef.current) {
        isDoneRef.current = true;
        const { base64, mimeType, extension, fileSize } = data;

        let rawTitle = (project.title || (project as any).name || "").trim();
        if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === project.id) {
          rawTitle = "FastArt_Video";
        }
        const cleanTitle =
          rawTitle.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || "FastArt_Video";
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
        const targetFileUri = `${dir}${cleanTitle}_${Date.now()}.${extension}`;

        await FileSystem.writeAsStringAsync(targetFileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const result: ExportResult = {
          blob: { size: fileSize || 0, type: mimeType } as any,
          videoUrl: targetFileUri,
          mimeType,
          format: options.format || "mp4",
          extension,
          fileSize: fileSize || Math.round(base64.length * 0.75),
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
