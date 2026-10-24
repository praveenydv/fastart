import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { DomWebView } from "@expo/dom-webview";
import {
  registerWhisperBridgeListener,
  WhisperBridgeTask,
} from "../../services/mobileWhisperBridge";

export default function MobileWhisperTranscriberView() {
  const [currentTask, setCurrentTask] = useState<WhisperBridgeTask | null>(null);
  const webViewRef = useRef<any>(null);
  const activeTaskRef = useRef<WhisperBridgeTask | null>(null);

  useEffect(() => {
    const unregister = registerWhisperBridgeListener((task) => {
      activeTaskRef.current = task;
      setCurrentTask(task);
    });

    return () => {
      unregister();
      if (activeTaskRef.current) {
        activeTaskRef.current.reject(new Error("Captioning cancelled"));
        activeTaskRef.current = null;
      }
    };
  }, []);

  const handleMessage = (event: any) => {
    try {
      const rawData = event?.nativeEvent?.data;
      if (!rawData) return;
      const data = JSON.parse(rawData);

      const task = activeTaskRef.current;
      if (!task) return;

      if (data.type === "PROGRESS") {
        if (task.onProgress && typeof data.pct === "number") {
          task.onProgress(data.pct, data.status || "Transcribing audio...");
        }
      } else if (data.type === "COMPLETE") {
        const segments = Array.isArray(data.segments) ? data.segments : [];
        task.resolve(segments);
        activeTaskRef.current = null;
        setCurrentTask(null);
      } else if (data.type === "ERROR") {
        task.reject(new Error(data.message || "Whisper transcription error"));
        activeTaskRef.current = null;
        setCurrentTask(null);
      }
    } catch (err: any) {
      console.warn("[MobileWhisperTranscriberView] Message error:", err);
    }
  };

  if (Platform.OS === "web" || !currentTask || !currentTask.htmlUri) {
    return null;
  }

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <DomWebView
        ref={webViewRef}
        source={{ uri: currentTask.htmlUri }}
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
    width: 8,
    height: 8,
    opacity: 0.01,
    overflow: "hidden",
    zIndex: -999,
  },
  webView: {
    width: 8,
    height: 8,
    backgroundColor: "transparent",
  },
});
