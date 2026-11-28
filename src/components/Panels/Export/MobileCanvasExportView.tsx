import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system/legacy";
import { File, FileMode } from "expo-file-system";
import type { FileHandle } from "expo-file-system";
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

async function resolveUrlForWebView(
  url: string | undefined,
  id: string,
  defaultExt: string,
  dir: string
): Promise<string | undefined> {
  if (!url) return url;
  if (url.startsWith("/") && !url.startsWith("//")) {
    return `file://${url}`;
  }
  const needsCopy =
    url.startsWith("content://") ||
    url.startsWith("ph://") ||
    url.startsWith("assets-library://");
  if (!needsCopy) return url;

  try {
    const rawExt = url.split("?")[0].split(".").pop();
    const ext = rawExt && /^[a-zA-Z0-9]{2,5}$/.test(rawExt) ? rawExt : defaultExt;
    const cleanId = id.replace(/[^A-Za-z0-9_-]/g, "_");
    const localPath = `${dir}wv_media_${cleanId}.${ext}`;

    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists && typeof (info as any).size === "number" && (info as any).size > 0) {
        return localPath.startsWith("file://") ? localPath : `file://${localPath}`;
      }
    } catch (_) {}

    await FileSystem.copyAsync({ from: url, to: localPath });
    return localPath.startsWith("file://") ? localPath : `file://${localPath}`;
  } catch (e) {
    console.warn("[MobileCanvasExportView] Failed to copy media for webview:", e);
    return url;
  }
}

function stripHeavyFieldsForExport(proj: FastArtProject): void {
  delete (proj as any).assets;
  delete (proj as any).thumbnailUrl;
  delete (proj as any).beatMarkers;

  if (proj.tracks?.video) {
    for (const clip of proj.tracks.video as any[]) {
      delete clip.peaks;
      delete clip.waveform;
      delete clip.compoundClips;
      if (typeof clip.thumbnail === "string" && clip.thumbnail.startsWith("data:") && clip.thumbnail.length > 4096) {
        delete clip.thumbnail;
      }
      if (clip.motionTrack && !clip.motionTrack.enabled) {
        delete clip.motionTrack;
      }
    }
  }
  if (proj.tracks?.audio) {
    for (const clip of proj.tracks.audio as any[]) {
      delete clip.peaks;
      delete clip.beatMarkers;
    }
  }
}

async function resolveProjectMediaForWebView(proj: FastArtProject): Promise<FastArtProject> {
  const cloned: FastArtProject = JSON.parse(JSON.stringify(proj));
  stripHeavyFieldsForExport(cloned);
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
      if (clip.cutout?.enabled && clip.cutout.mode === "auto") {
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
                const maskFps = rleData.fps || 30;
                const speed = Math.max(0.1, Math.min(16, clip.speed || 1.0));
                const startSec = Math.max(0, (clip.trimIn || 0) - 1.0);
                const endSec = (clip.trimIn || 0) + (clip.duration || 5.0) * speed + 1.0;
                const minFrame = Math.max(0, Math.floor(startSec * maskFps));
                const maxFrame = Math.ceil(endSec * maskFps);

                const serializableMasks: Record<string, string> = {};
                for (const [k, v] of Object.entries(rleData.masks)) {
                  const parts = k.split("_");
                  const lastPart = parts[parts.length - 1];
                  const numIdx = /^\d+$/.test(lastPart) ? parseInt(lastPart, 10) : -1;
                  if (numIdx >= 0) {
                    if (numIdx >= minFrame && numIdx <= maxFrame) {
                      serializableMasks[lastPart] = Buffer.from(v).toString("base64");
                    }
                  } else if (parts.length === 1) {
                    serializableMasks[k] = Buffer.from(v).toString("base64");
                  }
                }
                (clip as any).cutoutMasks = {
                  masks: serializableMasks,
                  fps: maskFps,
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
  s = s.replace(/[^A-Za-z0-9+/=]/g, "");
  const mod = s.length % 4;
  if (mod === 2) s += "==";
  else if (mod === 3) s += "=";
  else if (mod === 1) s = s.slice(0, -1);
  return s;
}

type ChunkedOutputState = {
  uri: string;
  mimeType: string;
  extension: string;
  fileSize?: number;
  queue: string[];
  isWriting: boolean;
  hasWrittenInitial: boolean;
  lastProgressAt: number;
  handle: FileHandle | null;
  writeError?: Error;
  onDrain?: () => void;
};

function closeOutputHandle(output: ChunkedOutputState | null): void {
  if (!output?.handle) return;
  try {
    output.handle.close();
  } catch (_) {}
  output.handle = null;
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
  const htmlUriRef = useRef<string | null>(null);
  const currentChunkedFileRef = useRef<ChunkedOutputState | null>(null);

  // Snapshot latest project/options & callbacks in refs so mid-export parent re-renders
  // (e.g. currentTime or autosave) never restart the WebView or wipe chunk buffers.
  const projectRef = useRef(project);
  const optionsRef = useRef(options);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    projectRef.current = project;
    optionsRef.current = options;
    onProgressRef.current = onProgress;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [project, options, onProgress, onComplete, onError]);

  const cleanupExportArtifacts = (deletePartialOutput: boolean) => {
    const out = currentChunkedFileRef.current;
    if (out) {
      out.queue.length = 0;
      closeOutputHandle(out);
      if (deletePartialOutput && out.uri) {
        FileSystem.deleteAsync(out.uri, { idempotent: true }).catch(() => {});
      }
      currentChunkedFileRef.current = null;
    }
    if (htmlUriRef.current) {
      FileSystem.deleteAsync(htmlUriRef.current, { idempotent: true }).catch(() => {});
      htmlUriRef.current = null;
    }
  };

  const pumpWriteQueue = async (output: ChunkedOutputState) => {
    if (output.isWriting) return;
    output.isWriting = true;
    try {
      while (output.queue.length > 0 && !output.writeError) {
        if (output.handle) {
          // Batch consecutive chunks up to ~512KB of base64 to minimize native calls
          let totalBytes = 0;
          const parts: Buffer[] = [];
          while (output.queue.length > 0 && totalBytes < 524288) {
            const nextChunk = output.queue.shift();
            if (!nextChunk) continue;
            const buf = Buffer.from(nextChunk, "base64");
            if (buf.length > 0) {
              parts.push(buf);
              totalBytes += buf.length;
            }
          }
          if (parts.length > 0) {
            const merged = parts.length === 1 ? parts[0] : Buffer.concat(parts, totalBytes);
            await output.handle.writeBytes(
              new Uint8Array(merged.buffer, merged.byteOffset, merged.byteLength)
            );
            output.hasWrittenInitial = true;
            output.lastProgressAt = Date.now();
          }
        } else {
          const nextChunk = output.queue.shift();
          if (nextChunk) {
            await FileSystem.writeAsStringAsync(output.uri, nextChunk, {
              encoding: FileSystem.EncodingType.Base64,
              append: output.hasWrittenInitial,
            });
            output.hasWrittenInitial = true;
            output.lastProgressAt = Date.now();
          }
        }
      }
    } catch (err: any) {
      output.writeError = err instanceof Error ? err : new Error(String(err));
      output.queue.length = 0;
    } finally {
      output.isWriting = false;
      if (output.queue.length === 0 && output.onDrain) {
        const cb = output.onDrain;
        output.onDrain = undefined;
        cb();
      }
    }
  };

  useEffect(() => {
    if (!isExporting) {
      cleanupExportArtifacts(true);
      setHtmlUri(null);
      isDoneRef.current = false;
      return;
    }

    let isMounted = true;
    isDoneRef.current = false;
    cleanupExportArtifacts(true);

    try {
      const { Image: ExpoImage } = require("expo-image");
      ExpoImage?.clearMemoryCache?.();
    } catch {}

    async function prepareHtml() {
      try {
        const resolvedProject = await resolveProjectMediaForWebView(projectRef.current);
        if (!isMounted) return;
        const html = generateCanvasBridgeHtml(resolvedProject, optionsRef.current);
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
        const tempPath = `${dir}fastart_canvas_export_${Date.now()}.html`;
        await FileSystem.writeAsStringAsync(tempPath, html, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (isMounted) {
          htmlUriRef.current = tempPath;
          setHtmlUri(tempPath);
        } else {
          FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
        }
      } catch (err: any) {
        if (isMounted) {
          onErrorRef.current(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    prepareHtml();

    return () => {
      isMounted = false;
      cleanupExportArtifacts(!isDoneRef.current);
    };
  }, [isExporting]);

  const handleWebViewTerminated = (reason: string) => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    cleanupExportArtifacts(true);
    onErrorRef.current(new Error(`WEBVIEW_PROCESS_TERMINATED: ${reason}`));
  };

  const handleMessage = async (event: any) => {
    try {
      const rawData = event?.nativeEvent?.data;
      if (!rawData) return;
      const data = JSON.parse(rawData);

      if (data.type === "PROGRESS") {
        if (onProgressRef.current && typeof data.progress === "number") {
          onProgressRef.current(data.progress);
        }
      } else if (data.type === "CHUNK_START") {
        const activeProj = projectRef.current;
        const activeOpts = optionsRef.current;
        let rawTitle = (activeProj.title || (activeProj as any).name || "").trim();
        if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === activeProj.id) {
          rawTitle = activeOpts.format === "png" ? "FastArt_Cover" : "FastArt_Video";
        }
        const cleanTitle =
          rawTitle.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || "FastArt_Video";
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
        const targetFileUri = `${dir}${cleanTitle}_${Date.now()}.${data.extension || "mp4"}`;

        let handle: FileHandle | null = null;
        try {
          const outFile = new File(targetFileUri);
          outFile.create({ overwrite: true });
          handle = outFile.open(FileMode.WriteOnly);
        } catch (handleErr) {
          console.warn("[MobileCanvasExportView] FileHandle open fallback to Base64 writes:", handleErr);
          handle = null;
        }

        const output: ChunkedOutputState = {
          uri: targetFileUri,
          mimeType: data.mimeType || "video/mp4",
          extension: data.extension || "mp4",
          fileSize: data.fileSize,
          queue: [],
          isWriting: !handle,
          hasWrittenInitial: Boolean(handle),
          lastProgressAt: Date.now(),
          handle,
        };
        currentChunkedFileRef.current = output;

        if (!handle) {
          FileSystem.writeAsStringAsync(targetFileUri, "", {
            encoding: FileSystem.EncodingType.Base64,
          })
            .catch((err) => {
              output.writeError = err instanceof Error ? err : new Error(String(err));
            })
            .finally(() => {
              output.isWriting = false;
              pumpWriteQueue(output);
            });
        }
      } else if (data.type === "CHUNK_DATA" && currentChunkedFileRef.current) {
        const output = currentChunkedFileRef.current;
        if (data.chunk && !output.writeError) {
          output.queue.push(data.chunk);
          pumpWriteQueue(output);
        }
      } else if (data.type === "CHUNK_END" && currentChunkedFileRef.current && !isDoneRef.current) {
        isDoneRef.current = true;
        const info = currentChunkedFileRef.current;

        if (info.isWriting || info.queue.length > 0) {
          await new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
              if (!settled) {
                settled = true;
                clearInterval(watchdog);
                resolve();
              }
            };
            const watchdog = setInterval(() => {
              if (Date.now() - info.lastProgressAt > 15000) {
                info.writeError = info.writeError || new Error("Disk write stalled while finalizing export");
                finish();
              }
            }, 1000);
            info.onDrain = finish;
            pumpWriteQueue(info);
          });
        }

        closeOutputHandle(info);

        if (info.writeError) {
          cleanupExportArtifacts(true);
          onErrorRef.current(info.writeError);
          return;
        }

        const fileStat = await FileSystem.getInfoAsync(info.uri);
        const result: ExportResult = {
          blob: { size: fileStat.exists ? (fileStat as any).size : (info.fileSize || 0), type: info.mimeType } as any,
          videoUrl: info.uri,
          mimeType: info.mimeType,
          format: optionsRef.current.format || "mp4",
          extension: info.extension,
          fileSize: fileStat.exists ? (fileStat as any).size : info.fileSize,
        };
        currentChunkedFileRef.current = null;
        if (htmlUriRef.current) {
          FileSystem.deleteAsync(htmlUriRef.current, { idempotent: true }).catch(() => {});
          htmlUriRef.current = null;
        }
        try {
          const { Image: ExpoImage } = require("expo-image");
          ExpoImage?.clearMemoryCache?.();
        } catch {}
        onProgressRef.current?.(100);
        onCompleteRef.current(result);
      } else if (data.type === "COMPLETE" && !isDoneRef.current) {
        isDoneRef.current = true;
        const { base64, mimeType, extension, fileSize } = data;
        const activeProj = projectRef.current;
        const activeOpts = optionsRef.current;

        let rawTitle = (activeProj.title || (activeProj as any).name || "").trim();
        if (!rawTitle || /^proj[_-]\d+/i.test(rawTitle) || rawTitle === activeProj.id) {
          rawTitle = activeOpts.format === "png" ? "FastArt_Cover" : "FastArt_Video";
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
          format: activeOpts.format || "mp4",
          extension,
          fileSize: fileSize || Math.round(cleanB64.length * 0.75),
        };

        if (htmlUriRef.current) {
          FileSystem.deleteAsync(htmlUriRef.current, { idempotent: true }).catch(() => {});
          htmlUriRef.current = null;
        }
        onProgressRef.current?.(100);
        onCompleteRef.current(result);
      } else if (data.type === "ERROR") {
        isDoneRef.current = true;
        cleanupExportArtifacts(true);
        onErrorRef.current(new Error(data.message || "Canvas export error in WebView"));
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
        onRenderProcessGone={(e) => {
          const crashed = e?.nativeEvent?.didCrash;
          handleWebViewTerminated(crashed ? "Android renderer crashed" : "Android renderer killed for memory");
        }}
        onContentProcessDidTerminate={() => {
          handleWebViewTerminated("iOS WebContent process terminated due to memory pressure");
        }}
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
    width: 16,
    height: 16,
    opacity: 0.01, // Near-invisible to human eye, tiny compositor footprint so OS never throttles GPU loop
    overflow: "hidden",
    zIndex: 9999,
  },
  webView: {
    width: 16,
    height: 16,
    backgroundColor: "#000000",
  },
});
