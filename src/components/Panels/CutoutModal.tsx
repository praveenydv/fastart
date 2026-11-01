import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Platform,
  StyleSheet,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { CutoutConfig } from "../../types/project";
import { soundEngine } from "../../utils/audioEngine";
import {
  CutoutControls,
  CutoutMode,
} from "./Cutout/CutoutControls";
import MobileCutoutBridgeView from "./Cutout/MobileCutoutBridgeView";
import {
  processVideoUnified,
  processClipUnified,
  hasClipMasks,
  hasFrameMask,
  getClipProcessedCount,
  clearClipMasks,
  clearNativeMaskUris,
  getClipBakedFps,
  updateActiveFrameMatteParams,
  initSelfieSegmentation,
  initStudioNeuralEngine,
} from "../../services/selfieSegmentationService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CutoutModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentCutout?: CutoutConfig;
  onApplyCutout: (config: CutoutConfig, clipId?: string) => void;
  initialMode?: "auto" | "chroma";
  isInline?: boolean;
  selectedClip?: any;
  currentTime?: number;
  isPlaying?: boolean;
  onReplaceClipWithMedia?: (
    clipId: string,
    newUrl: string,
    newThumbnail?: string,
  ) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CutoutModal({
  visible,
  onClose,
  onApply,
  currentCutout,
  onApplyCutout,
  initialMode,
  isInline = false,
  selectedClip,
  currentTime = 0,
  isPlaying = false,
  onReplaceClipWithMedia,
}: CutoutModalProps) {
  const clipId = selectedClip?.id || "";
  const isVideoClip =
    selectedClip?.type === "video" ||
    (typeof selectedClip?.url === "string" &&
      !selectedClip.url.endsWith(".png") &&
      !selectedClip.url.endsWith(".jpg") &&
      !selectedClip.url.endsWith(".jpeg") &&
      !selectedClip.url.endsWith(".webp"));

  const [config, setConfig] = useState<CutoutConfig>(() => ({
    enabled: currentCutout?.enabled ?? false,
    mode: currentCutout?.mode ?? initialMode ?? "chroma",
    keyColor: currentCutout?.keyColor ?? "#00FF00",
    intensity: currentCutout?.intensity ?? 45,
    shadow: currentCutout?.shadow ?? 25,
    strokeColor: currentCutout?.strokeColor ?? "none",
    strokeWidth: currentCutout?.strokeWidth ?? 3,
    bgColor: currentCutout?.bgColor ?? "none",
  }));

  // Processing state
  const [isProcessingFrames, setIsProcessingFrames] = useState<boolean>(false);
  const [isProcessingActiveFrame, setIsProcessingActiveFrame] = useState<boolean>(false);
  const [frameProgress, setFrameProgress] = useState<number>(0);
  const [processedFrames, setProcessedFrames] = useState<number>(0);
  const [totalFramesToProcess, setTotalFramesToProcess] = useState<number>(0);
  const abortCtrlRef = useRef<AbortController | null>(null);

  const isAlreadyProcessed = clipId ? hasClipMasks(clipId) : false;
  const currentProcessedCount = clipId ? getClipProcessedCount(clipId) : 0;

  // Frame calculation for preview
  const clipStart = selectedClip?.startTime || 0;
  const localTime = Math.max(0, (currentTime || 0) - clipStart);
  const effectiveSpeed = Math.max(0.1, Math.min(16, selectedClip?.speed || 1.0));
  const elapsedClipTime = localTime * effectiveSpeed;
  const trimIn = selectedClip?.trimIn || 0;
  const mediaTime = selectedClip?.reverse
    ? Math.max(0, (selectedClip?.duration || 0) - elapsedClipTime - trimIn)
    : trimIn + elapsedClipTime;
  const bakedFps = getClipBakedFps(clipId);
  const frameIdx = Math.max(0, Math.floor(elapsedClipTime * bakedFps));

  // Sync state when currentCutout prop changes
  useEffect(() => {
    if (currentCutout) {
      setConfig({
        enabled: currentCutout.enabled ?? false,
        mode: currentCutout.mode ?? "chroma",
        keyColor: currentCutout.keyColor ?? "#00FF00",
        intensity: currentCutout.intensity ?? 45,
        shadow: currentCutout.shadow ?? 25,
        strokeColor: currentCutout.strokeColor ?? "none",
        strokeWidth: currentCutout.strokeWidth ?? 3,
        bgColor: currentCutout.bgColor ?? "none",
      });
    }
  }, [currentCutout]);

  // Prewarm neural engines on Web
  useEffect(() => {
    if (visible && Platform.OS === "web") {
      initStudioNeuralEngine().catch(() => {});
      initSelfieSegmentation().catch(() => {});
    }
  }, [visible]);

  // Auto-process current active frame on mobile when modal opens with cutout enabled
  useEffect(() => {
    if (visible && Platform.OS !== "web" && config.enabled && selectedClip?.url && !hasClipMasks(clipId)) {
      processClipUnified(
        selectedClip.url,
        clipId,
        frameIdx,
        mediaTime,
        (config.intensity ?? 45) / 100,
        (config.shadow ?? 25) / 100,
        config.mode || "auto",
        config.keyColor || "#00FF00"
      ).catch(() => {});
    }
  }, [visible, config.enabled, config.mode, clipId]);

  const debounceTimerRef = useRef<any>(null);

  const handleConfigChange = (newConfig: CutoutConfig) => {
    setConfig(newConfig);
    onApplyCutout(newConfig, clipId);

    // If auto cutout and threshold/shadow changed, update cached active frame matte instantly via Rust
    if (Platform.OS === "web") {
      if (newConfig.mode === "auto" && clipId) {
        updateActiveFrameMatteParams(
          clipId,
          frameIdx,
          (newConfig.intensity ?? 45) / 100,
          (newConfig.shadow ?? 25) / 100
        );
      }
    } else {
      // Mobile real-time preview on slider or color adjustment
      if (newConfig.enabled && selectedClip?.url) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          processClipUnified(
            selectedClip.url,
            clipId,
            frameIdx,
            mediaTime,
            (newConfig.intensity ?? 45) / 100,
            (newConfig.shadow ?? 25) / 100,
            newConfig.mode || "auto",
            newConfig.keyColor || "#00FF00"
          ).catch(() => {});
        }, 100);
      }
    }
  };

  const handleProcessActiveFrame = async () => {
    if (!selectedClip?.url || isProcessingActiveFrame) return;
    setIsProcessingActiveFrame(true);
    try {
      await processClipUnified(
        selectedClip.url,
        clipId,
        frameIdx,
        mediaTime,
        (config.intensity ?? 45) / 100,
        (config.shadow ?? 25) / 100,
        config.mode || "auto",
        config.keyColor || "#00FF00"
      );
    } catch (e) {
      console.warn("[CutoutModal] handleProcessActiveFrame error:", e);
    } finally {
      setIsProcessingActiveFrame(false);
    }
  };

  const handleProcessVideo = async () => {
    if (!selectedClip?.url || isProcessingFrames) return;
    abortCtrlRef.current = new AbortController();
    setIsProcessingFrames(true);
    setFrameProgress(0);

    const clipDuration = Math.max(0.1, selectedClip.duration || 1.0);
    const fps = bakedFps || 20;
    const estTotal = Math.max(1, Math.ceil(clipDuration * fps));
    setTotalFramesToProcess(estTotal);

    try {
      await processVideoUnified(
        selectedClip.url,
        clipId,
        clipDuration,
        selectedClip.trimIn || 0,
        selectedClip.speed || 1.0,
        fps,
        (config.intensity ?? 45) / 100,
        (config.shadow ?? 25) / 100,
        config.mode || "auto",
        config.keyColor || "#00FF00",
        (pct, cur, tot) => {
          setFrameProgress(pct);
          setProcessedFrames(cur);
          setTotalFramesToProcess(tot);
        },
        abortCtrlRef.current.signal
      );
    } catch (e) {
      console.warn("[CutoutModal] handleProcessVideo error:", e);
    } finally {
      setIsProcessingFrames(false);
      abortCtrlRef.current = null;
    }
  };

  const handleCancelProcessing = () => {
    soundEngine.playSfx("click");
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    setIsProcessingFrames(false);
  };

  const handleReset = () => {
    soundEngine.playSfx("click");
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    if (clipId) {
      clearClipMasks(clipId);
      clearNativeMaskUris(clipId);
    }
    const resetCfg: CutoutConfig = {
      enabled: false,
      mode: "chroma",
      keyColor: "#00FF00",
      intensity: 45,
      shadow: 25,
      strokeColor: "none",
      strokeWidth: 3,
      bgColor: "none",
    };
    setConfig(resetCfg);
    onApplyCutout(resetCfg, clipId);
  };

  if (!visible) return null;

  return (
    <View style={s.modalWrapper}>
      <View style={[s.sheetContainer, isInline && s.inlineSheet]}>
        {!isInline && (
          <View style={s.header}>
            <View style={s.titleRow}>
              <Ionicons name="person-remove-outline" size={14} color="#00F2FE" />
              <Text style={s.sheetTitle}>Cutout</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TouchableOpacity
                onPress={handleReset}
                style={s.resetBtn}
                activeOpacity={0.7}
                accessibilityLabel="Reset cutout"
              >
                <Ionicons name="refresh-outline" size={11} color="#00F2FE" style={{ marginRight: 2 }} />
                <Text style={s.resetText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={s.doneBtn}
                activeOpacity={0.7}
                accessibilityLabel="Close cutout"
              >
                <Ionicons name="close" size={14} color="#A1A1AA" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          style={s.sheetBody}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <CutoutControls
            config={config}
            onChange={handleConfigChange}
            selectedClip={selectedClip}
            isPlaying={isPlaying}
            isProcessingFrames={isProcessingFrames}
            isProcessingActiveFrame={isProcessingActiveFrame}
            frameProgress={frameProgress}
            processedFrames={processedFrames}
            totalFramesToProcess={totalFramesToProcess}
            isAlreadyProcessed={isAlreadyProcessed}
            processedCount={currentProcessedCount}
            onPreviewFrame={handleProcessActiveFrame}
            onProcessVideo={handleProcessVideo}
            onCancelProcessing={handleCancelProcessing}
            onReset={handleReset}
          />
        </ScrollView>
      </View>
      {Platform.OS !== "web" && <MobileCutoutBridgeView />}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#0F131D",
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: "#0F131D",
  },
  inlineSheet: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#08090E",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 6,
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  resetText: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "500",
  },
  doneBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    flex: 1,
    padding: 8,
  },
});
