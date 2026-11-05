import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  ScrollView,
  Platform,
  StyleSheet,
} from "react-native";
import { ModalHeader } from "../Common";
import { CutoutConfig } from "../../types/project";
import { CutoutControls } from "./Cutout/CutoutControls";
import {
  processVideoUnified,
  processClipUnified,
  hasClipMasks,
  getClipProcessedCount,
  clearClipMasks,
  getClipBakedFps,
  updateActiveFrameMatteParams,
  initStudioNeuralEngine,
  notifyMaskUpdated,
  restoreClipMasksFromStorage,
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

function CutoutModalComponent({
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
    mode: currentCutout?.mode ?? initialMode ?? "auto",
    keyColor: currentCutout?.keyColor ?? "#00FF00",
    intensity: currentCutout?.intensity ?? 45,
    shadow: currentCutout?.shadow ?? 25,
    strokeColor: currentCutout?.strokeColor ?? "none",
    strokeWidth: currentCutout?.strokeWidth ?? 3,
    bgColor: currentCutout?.bgColor ?? "none",
    quality: currentCutout?.quality ?? "fast",
  }));

  // Processing state
  const [isProcessingFrames, setIsProcessingFrames] = useState<boolean>(false);
  const [isProcessingActiveFrame, setIsProcessingActiveFrame] = useState<boolean>(false);
  const [frameProgress, setFrameProgress] = useState<number>(0);
  const [processedFrames, setProcessedFrames] = useState<number>(0);
  const [totalFramesToProcess, setTotalFramesToProcess] = useState<number>(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [hasAttemptedRestore, setHasAttemptedRestore] = useState<boolean>(false);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const previewInFlightRef = useRef(false);
  const resetGenerationRef = useRef(0);

  const currentProcessedCount = clipId ? getClipProcessedCount(clipId) : 0;
  const isAlreadyProcessed = clipId
    ? isVideoClip
      ? currentProcessedCount > 1
      : hasClipMasks(clipId)
    : false;

  // Frame calculation for preview
  const clipStart = selectedClip?.startTime || 0;
  const localTime = Math.max(0, (currentTime || 0) - clipStart);
  const effectiveSpeed = Math.max(0.1, Math.min(16, selectedClip?.speed || 1.0));
  const elapsedClipTime = localTime * effectiveSpeed;
  const trimIn = selectedClip?.trimIn || 0;
  const mediaTime = selectedClip?.reverse
    ? trimIn + Math.max(0, (selectedClip?.duration || 0) - elapsedClipTime)
    : trimIn + elapsedClipTime;
  const clipSourceFps = selectedClip?.sourceFrameRate ?? selectedClip?.frameRate ?? 30;
  const bakedFps = getClipBakedFps(clipId) || (selectedClip?.sourceMediaId ? getClipBakedFps(selectedClip.sourceMediaId) : 0) || clipSourceFps;
  const frameIdx = Math.max(0, Math.floor(elapsedClipTime * bakedFps));

  // Sync state when currentCutout prop changes
  useEffect(() => {
    if (currentCutout) {
      setConfig((prev) => ({
        enabled: currentCutout.enabled ?? false,
        mode: currentCutout.mode ?? prev.mode ?? "auto",
        keyColor: currentCutout.keyColor ?? "#00FF00",
        intensity: currentCutout.intensity ?? 45,
        shadow: currentCutout.shadow ?? 25,
        strokeColor: currentCutout.strokeColor ?? "none",
        strokeWidth: currentCutout.strokeWidth ?? 3,
        bgColor: currentCutout.bgColor ?? "none",
        quality: currentCutout.quality ?? prev.quality ?? "fast",
      }));
    }
  }, [currentCutout]);

  // Prewarm neural engine and restore persistent masks on both Web and Mobile
  useEffect(() => {
    if (visible && clipId) {
      initStudioNeuralEngine().catch(() => {});
      setHasAttemptedRestore(false);
      const fps = selectedClip?.sourceFrameRate ?? selectedClip?.frameRate ?? 30;
      const tasks = [restoreClipMasksFromStorage(clipId, fps)];
      if (selectedClip?.sourceMediaId) {
        tasks.push(restoreClipMasksFromStorage(selectedClip.sourceMediaId, fps));
      }
      Promise.all(tasks).finally(() => {
        setHasAttemptedRestore(true);
      });
    } else if (!visible) {
      setHasAttemptedRestore(false);
    }
  }, [visible, clipId, selectedClip?.sourceMediaId, selectedClip?.sourceFrameRate, selectedClip?.frameRate]);

  // Stop all active processing when modal closes, becomes hidden, or unmounts
  useEffect(() => {
    if (!visible) {
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort();
        abortCtrlRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      previewInFlightRef.current = false;
      setIsProcessingFrames(false);
      setIsProcessingActiveFrame(false);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort();
        abortCtrlRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      previewInFlightRef.current = false;
      setIsProcessingFrames(false);
      setIsProcessingActiveFrame(false);
    };
  }, []);

  const debounceTimerRef = useRef<any>(null);

  const runPreview = useCallback(async (
    clip: any,
    id: string,
    index: number,
    time: number,
    previewConfig: CutoutConfig,
  ) => {
    if (!clip?.url || previewInFlightRef.current || abortCtrlRef.current) return false;
    previewInFlightRef.current = true;
    const generationAtStart = resetGenerationRef.current;
    setIsProcessingActiveFrame(true);
    setProcessingError(null);
    try {
      const isAuto = (previewConfig.mode || "auto") === "auto";
      const threshold = isAuto ? 0.0 : (previewConfig.intensity ?? 45) / 100;
      const feather = isAuto ? 0.0 : (previewConfig.shadow ?? 25) / 100;
      const ok = await processClipUnified(
        clip.url,
        id,
        index,
        time,
        threshold,
        feather,
        previewConfig.mode || "auto",
        previewConfig.keyColor || "#00FF00",
        clip.type === "video" ? "video" : "photo",
      );
      if (generationAtStart !== resetGenerationRef.current) {
        clearClipMasks(id);
        return false;
      }
      if (!ok) {
        setProcessingError(
          previewConfig.mode === "auto"
            ? "Auto Cutout could not create a mask. Check model initialization and try another frame."
            : "Chroma Key could not process this frame. Check the clip and try again.",
        );
      }
      return ok;
    } catch (error) {
      console.warn("[CutoutModal] Preview frame processing failed:", error);
      setProcessingError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      previewInFlightRef.current = false;
      setIsProcessingActiveFrame(false);
    }
  }, []);

  // Auto-preview current frame when modal is opened with auto cutout enabled
  useEffect(() => {
    if (
      visible &&
      hasAttemptedRestore &&
      config.enabled &&
      config.mode === "auto" &&
      clipId &&
      !isAlreadyProcessed &&
      !isProcessingActiveFrame &&
      !previewInFlightRef.current
    ) {
      const targetIdx = isVideoClip ? frameIdx : 0;
      const targetTime = isVideoClip ? mediaTime : 0;
      void runPreview(selectedClip, clipId, targetIdx, targetTime, config);
    }
  }, [
    visible,
    hasAttemptedRestore,
    isVideoClip,
    config.enabled,
    config.mode,
    clipId,
    isAlreadyProcessed,
    isProcessingActiveFrame,
    runPreview,
    selectedClip,
    config,
    frameIdx,
    mediaTime,
  ]);

  const handleConfigChange = (newConfig: CutoutConfig) => {
    setConfig(newConfig);
    onApplyCutout(newConfig, clipId);

    // If auto cutout and threshold/shadow changed, update cached active frame matte instantly via Rust
    if (Platform.OS === "web") {
      if (config.enabled && config.mode === "auto" && newConfig.mode === "auto" && clipId) {
        const rawIntensity = newConfig.intensity ?? 45;
        const rawShadow = newConfig.shadow ?? 25;
        const thresh = rawIntensity === 45 ? 0.0 : Math.max(0.0, (rawIntensity / 100) * 0.4);
        const feat = rawShadow === 25 ? 0.0 : Math.max(0.0, (rawShadow / 100) * 0.3);
        updateActiveFrameMatteParams(
          clipId,
          frameIdx,
          thresh,
          feat,
        );
      }
    } else {
      // Mobile real-time preview on slider or color adjustment
      if (newConfig.enabled && config.enabled && selectedClip?.url) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          void runPreview(selectedClip, clipId, frameIdx, mediaTime, newConfig);
        }, 100);
      }
    }
  };

  const handleProcessActiveFrame = async () => {
    if (!selectedClip?.url || previewInFlightRef.current || abortCtrlRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    resetGenerationRef.current += 1;
    clearClipMasks(clipId);
    // Reset leaves Auto selected but disabled. Explicitly requesting a frame
    // preview activates the cutout so the resulting mask is shown in the player.
    const previewConfig = config.enabled ? config : { ...config, enabled: true };
    if (!config.enabled) {
      setConfig(previewConfig);
      onApplyCutout(previewConfig, clipId);
    }
    const targetIdx = isVideoClip ? frameIdx : 0;
    const targetTime = isVideoClip ? mediaTime : 0;
    const ok = await runPreview(selectedClip, clipId, targetIdx, targetTime, previewConfig);
    if (ok) {
      onApplyCutout(previewConfig, clipId);
      notifyMaskUpdated();
    }
  };

  const handleProcessVideo = async () => {
    if (!selectedClip?.url || isProcessingFrames || previewInFlightRef.current) return;
    if (!isVideoClip) {
      await handleProcessActiveFrame();
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const operationGeneration = ++resetGenerationRef.current;
    clearClipMasks(clipId);
    const processingConfig = config.enabled ? config : { ...config, enabled: true };
    if (!config.enabled) {
      setConfig(processingConfig);
      onApplyCutout(processingConfig, clipId);
    }
    abortCtrlRef.current = new AbortController();
    setIsProcessingFrames(true);
    setFrameProgress(0);

    const clipDuration = Math.max(0.1, selectedClip.duration || 1.0);
    // Native decoders read the clip's actual frame rate. On web, use source
    // metadata when available and otherwise process at standard 30 fps.
    const declaredSourceFps = Number(
      selectedClip.sourceFrameRate ?? selectedClip.frameRate ?? 30,
    );
    const targetFps = Number.isFinite(declaredSourceFps) && declaredSourceFps > 0
      ? Math.min(240, Math.max(1, declaredSourceFps))
      : 30;
    const estTotal = Math.max(1, Math.ceil(clipDuration * targetFps));
    setTotalFramesToProcess(estTotal);
    let lastProgressUpdateAt = 0;

    try {
      setProcessingError(null);
      const isAuto = (processingConfig.mode || "auto") === "auto";
      const threshold = isAuto ? 0.0 : (processingConfig.intensity ?? 45) / 100;
      const feather = isAuto ? 0.0 : (processingConfig.shadow ?? 25) / 100;
      const processed = await processVideoUnified(
        selectedClip.url,
        clipId,
        clipDuration,
        selectedClip.trimIn || 0,
        selectedClip.speed || 1.0,
        targetFps,
        threshold,
        feather,
        processingConfig.mode || "auto",
        processingConfig.keyColor || "#00FF00",
        (pct, cur, tot) => {
          const now = Date.now();
          if (pct < 100 && now - lastProgressUpdateAt < 100) return;
          lastProgressUpdateAt = now;
          setFrameProgress(pct);
          setProcessedFrames(cur);
          setTotalFramesToProcess(tot);
        },
        abortCtrlRef.current.signal,
        processingConfig.quality || "fast",
        !!selectedClip.reverse,
        selectedClip.sourceMediaId,
      );
      if (processed === 0) {
        setProcessingError("No frames were processed. Check clip access and cutout engine readiness, then retry.");
      } else {
        setFrameProgress(100);
        setProcessedFrames(processed);
        const finalConfig = { ...processingConfig, enabled: true };
        setConfig(finalConfig);
        onApplyCutout(finalConfig, clipId);
        notifyMaskUpdated();
        setTimeout(() => {
          notifyMaskUpdated();
        }, 60);
      }
    } catch (e) {
      console.warn("[CutoutModal] handleProcessVideo error:", e);
      setProcessingError(e instanceof Error ? e.message : String(e));
    } finally {
      if (operationGeneration !== resetGenerationRef.current) {
        clearClipMasks(clipId);
      }
      setIsProcessingFrames(false);
      abortCtrlRef.current = null;
    }
  };

  const handleCancelProcessing = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
  };

  const handleReset = () => {
    resetGenerationRef.current += 1;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    if (clipId) {
      clearClipMasks(clipId);
    }
    setProcessingError(null);
    const resetCfg: CutoutConfig = {
      enabled: false,
      mode: "auto",
      keyColor: "#00FF00",
      intensity: 45,
      shadow: 25,
      strokeColor: "none",
      strokeWidth: 3,
      bgColor: "none",
      quality: "fast",
    };
    setConfig(resetCfg);
    onApplyCutout(resetCfg, clipId);
    notifyMaskUpdated();
  };

  const handleApply = useCallback(() => {
    handleCancelProcessing();
    const finalConfig = {
      ...config,
      enabled: (config.mode as any) !== "none" ? (config.enabled ?? true) : false,
    };
    onApplyCutout(finalConfig, clipId);
    notifyMaskUpdated();
    onApply?.();
    onClose();
  }, [config, clipId, onApplyCutout, onApply, onClose, handleCancelProcessing]);

  const handleClose = useCallback(() => {
    handleCancelProcessing();
    onClose();
  }, [handleCancelProcessing, onClose]);

  if (!visible) return null;

  return (
    <View style={s.modalWrapper}>
      <View style={[s.sheetContainer, isInline && s.inlineSheet]}>
        {!isInline && (
          <ModalHeader
            title="Cutout"
            iconName="person-remove-outline"
            onClose={handleClose}
            onDone={handleApply}
            doneText="Apply"
            onReset={handleReset}
            resetText="Reset"
          />
        )}

        <ScrollView
          style={s.sheetBody}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <CutoutControls
            config={config}
            onChange={handleConfigChange}
            selectedClip={selectedClip}
            currentTime={currentTime}
            isPlaying={isPlaying}
            isProcessingFrames={isProcessingFrames}
            isProcessingActiveFrame={isProcessingActiveFrame}
            frameProgress={frameProgress}
            processedFrames={processedFrames}
            totalFramesToProcess={totalFramesToProcess}
            isAlreadyProcessed={isAlreadyProcessed}
            processedCount={currentProcessedCount}
            errorMessage={processingError}
            onPreviewFrame={handleProcessActiveFrame}
            onProcessVideo={handleProcessVideo}
            onCancelProcessing={handleCancelProcessing}
            onReset={handleReset}
          />
        </ScrollView>
      </View>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  scrollContent: {
    paddingBottom: 56,
  },
});

export const CutoutModal = React.memo(CutoutModalComponent);
export default CutoutModal;
