import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { DomWebView } from "@expo/dom-webview";
import * as FileSystem from "expo-file-system/legacy";
import {
  registerCutoutBridgeListener,
  notifyCutoutBridgeReady,
  generateCutoutBridgeHtml,
  CutoutBridgeTask,
} from "../../../services/mobileCutoutBridge";
import {
  setNativeMaskUri,
  notifyMaskUpdated,
} from "../../../services/selfieSegmentationService";

export default function MobileCutoutBridgeView() {
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);
  const activeTaskRef = useRef<CutoutBridgeTask | null>(null);
  const isEngineReadyRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function setupHtml() {
      try {
        const html = generateCutoutBridgeHtml();
        const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
        const tempPath = `${baseDir}fastart_cutout_engine.html`;
        await FileSystem.writeAsStringAsync(tempPath, html, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (isMounted) {
          setHtmlUri(`${tempPath}?t=${Date.now()}`);
        }
      } catch (e) {
        console.warn("[MobileCutoutBridgeView] Failed to initialize cutout HTML:", e);
      }
    }

    setupHtml();

    const unregister = registerCutoutBridgeListener((task) => {
      activeTaskRef.current = task;
      if (task && isEngineReadyRef.current && webViewRef.current) {
        const taskPayload = {
          id: task.id,
          clipUrl: task.clipUrl,
          clipId: task.clipId,
          frameIdx: task.frameIdx,
          frameTime: task.frameTime,
          threshold: task.threshold,
          feather: task.feather,
          mode: task.mode,
          keyColor: task.keyColor,
          strokeColor: task.strokeColor,
          strokeWidth: task.strokeWidth,
          bgColor: task.bgColor,
          isBatch: !!task.isBatch,
          duration: task.duration,
          trimIn: task.trimIn,
          speed: task.speed,
          fps: task.fps,
        };
        const script = `if (typeof window.executeCutoutTask === "function") { window.executeCutoutTask(${JSON.stringify(taskPayload)}); } true;`;
        webViewRef.current.injectJavaScript(script);
      }
    });

    return () => {
      isMounted = false;
      unregister();
    };
  }, []);

  const handleMessage = async (event: any) => {
    try {
      const raw = event?.nativeEvent?.data;
      if (!raw) return;
      const data = JSON.parse(raw);

      if (data.type === "READY") {
        isEngineReadyRef.current = true;
        notifyCutoutBridgeReady();

        // If there's an active task waiting for engine warmup, execute it immediately
        const task = activeTaskRef.current;
        if (task && webViewRef.current) {
          const taskPayload = {
            id: task.id,
            clipUrl: task.clipUrl,
            clipId: task.clipId,
            frameIdx: task.frameIdx,
            frameTime: task.frameTime,
            threshold: task.threshold,
            feather: task.feather,
            mode: task.mode,
            keyColor: task.keyColor,
            strokeColor: task.strokeColor,
            strokeWidth: task.strokeWidth,
            bgColor: task.bgColor,
            isBatch: !!task.isBatch,
            duration: task.duration,
            trimIn: task.trimIn,
            speed: task.speed,
            fps: task.fps,
          };
          const script = `if (typeof window.executeCutoutTask === "function") { window.executeCutoutTask(${JSON.stringify(taskPayload)}); } true;`;
          webViewRef.current.injectJavaScript(script);
        }
      } else if (data.type === "FRAME_DONE") {
        const { clipId, frameIdx, base64Png } = data;
        if (clipId && base64Png) {
          const dir = (FileSystem.cacheDirectory ?? "") + "cutout/";
          try {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          } catch {}
          const safeClipId = clipId.replace(/[^a-zA-Z0-9]/g, "_");
          const fname = `${safeClipId}_${frameIdx}.png`;
          const filePath = `${dir}${fname}`;

          await FileSystem.writeAsStringAsync(filePath, base64Png, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const uriWithTimestamp = `${filePath}?t=${Date.now()}`;
          setNativeMaskUri(clipId, frameIdx, uriWithTimestamp);
          notifyMaskUpdated();
        }

        const task = activeTaskRef.current;
        if (task && !task.isBatch && task.id === data.id) {
          task.resolve(true);
          activeTaskRef.current = null;
        }
      } else if (data.type === "BATCH_PROGRESS") {
        const task = activeTaskRef.current;
        if (task && task.onProgress && typeof data.pct === "number") {
          task.onProgress(data.pct, data.current || 0, data.total || 0);
        }
      } else if (data.type === "BATCH_COMPLETE") {
        const task = activeTaskRef.current;
        if (task && task.id === data.id) {
          task.resolve(data.totalFrames || 1);
          activeTaskRef.current = null;
        }
      } else if (data.type === "ERROR") {
        const task = activeTaskRef.current;
        if (task && task.id === data.id) {
          task.reject(new Error(data.message || "Cutout bridge error"));
          activeTaskRef.current = null;
        }
      }
    } catch (err: any) {
      console.warn("[MobileCutoutBridgeView] Message parse error:", err);
    }
  };

  if (Platform.OS === "web" || !htmlUri) {
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
    top: -9999,
    left: -9999,
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -999,
  },
  webView: {
    width: 1,
    height: 1,
    backgroundColor: "#000000",
  },
});

