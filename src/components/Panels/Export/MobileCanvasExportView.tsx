import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system/legacy";
import { DomWebView } from "@expo/dom-webview";
import { FastArtProject } from "../../../types/project";
import { ExportOptions, ExportResult } from "../../../utils/videoRenderer";
import { generateCanvasBridgeHtml } from "../../../utils/renderer/mobileWebBridge";
import { getLiveMediaUrl, loadMasksRLE } from "../../../utils/largeMediaStorage";

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
    const cleanId = id.replace(/[^A-Za-z0-9_-]/g, "_");
    const localPath = `${dir}wv_media_${cleanId}.${ext}`;
    
    // Check if valid cached copy already exists in cache to skip re-copying large media
    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists && typeof (info as any).size === "number" && (info as any).size > 0) {
        return localPath.startsWith("file://") ? localPath : `file://${localPath}`;
      }
    } catch (_) {}

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
  const tasks: Promise<any>[] = [];

  if (cloned.tracks?.video) {
    for (const clip of cloned.tracks.video) {
      if (clip.url) {
        tasks.push(
          (async () => {
            const liveUrl = (await getLiveMediaUrl(clip.sourceMediaId || clip.id, clip.title || (clip as any).name)) || clip.url;
            const res = await resolveUrlForWebView(liveUrl, clip.id, clip.type === "video" ? "mp4" : "jpg", dir);
            if (res) clip.url = res;
          })()
        );
      }
      if (clip.thumbnail) {
        tasks.push(
          resolveUrlForWebView(clip.thumbnail, `${clip.id}_thumb`, "jpg", dir)
            .then((res) => { if (res) clip.thumbnail = res; })
        );
      }
      if (clip.cutout?.enabled) {
        tasks.push(
          (async () => {
            try {
              const idToLoad = clip.id;
              const fallbackId = clip.sourceMediaId;
              let rleData = await loadMasksRLE(idToLoad);
              if (!rleData && fallbackId) {
                rleData = await loadMasksRLE(fallbackId);
              }
              if (rleData?.masks) {
                const serializableMasks: Record<string, string> = {};
                for (const [k, v] of Object.entries(rleData.masks)) {
                  const b64 = Buffer.from(v).toString("base64");
                  serializableMasks[k] = b64;
                  // Also extract numeric frame index so `serializableMasks[frameIdx]` always matches
                  const parts = k.split("_");
                  const lastPart = parts[parts.length - 1];
                  if (/^\d+$/.test(lastPart)) {
                    serializableMasks[lastPart] = b64;
                  }
                }
                (clip as any).cutoutMasks = {
                  masks: serializableMasks,
                  fps: rleData.fps || 30,
                };
              }
            } catch (e) {
              console.warn("[MobileCanvasExportView] Failed to load cutout masks:", e);
            }
          })()
        );
      }
    }
  }

  if (cloned.tracks?.audio) {
    for (const clip of cloned.tracks.audio) {
      if (clip.url) {
        tasks.push(
          (async () => {
            const liveUrl = (await getLiveMediaUrl(clip.sourceMediaId || clip.id, clip.title || (clip as any).name)) || clip.url;
            const res = await resolveUrlForWebView(liveUrl, clip.id, "wav", dir);
            if (res) clip.url = res;
          })()
        );
      }
    }
  }

  if (cloned.tracks?.stickers) {
    for (const clip of cloned.tracks.stickers) {
      const stickerUrl = (clip as any).url;
      if (stickerUrl) {
        tasks.push(
          resolveUrlForWebView(stickerUrl, clip.id, "png", dir)
            .then((res) => { if (res) (clip as any).url = res; })
        );
      }
    }
  }

  if (cloned.canvasBackground && typeof cloned.canvasBackground === "string" && cloned.canvasBackground.startsWith("image:")) {
    const rawBg = cloned.canvasBackground.replace("image:", "");
    tasks.push(
      resolveUrlForWebView(rawBg, "bg_image", "jpg", dir)
        .then((res) => { if (res) cloned.canvasBackground = `image:${res}`; })
    );
  }

  await Promise.all(tasks);
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
          rawTitle = options.format === "png" ? "FastArt_Cover" : "FastArt_Video";
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
        onProgress?.(100);
        onComplete(result);
      } else if (data.type === "COMPLETE" && !isDoneRef.current) {
        isDoneRef.current = true;
        const { base64, mimeType, extension, fileSize } = data;

        let rawTitle = (project.title || (project as any).name || "").trim();
        if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === project.id) {
          rawTitle = options.format === "png" ? "FastArt_Cover" : "FastArt_Video";
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

        onProgress?.(100);
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
    opacity: 0.01, // Near-invisible to human eye, but at top of view hierarchy so OS compositor never throttles GPU loop
    zIndex: 9999, // Tops the view hierarchy to bypass occlusion detection
  },
  webView: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
