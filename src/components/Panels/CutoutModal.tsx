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
  updateActiveFrameMatteParams,
  hasClipMasks,
  getClipProcessedCount,
  clearClipMasks,
  clearPreviewFrame,
  getClipBakedFps,
  getCutoutQualityFps,
  ensureCutoutModelReady,
  getCutoutModelState,
  subscribeCutoutModelState,
  CutoutModelState,
  notifyMaskUpdated,
  restoreClipMasksFromStorage,
  setCutoutProcessingActive,
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

  const [config, setConfig] = useState<CutoutConfig>(() => {
    const isActivelyCutout = Boolean(currentCutout?.enabled && currentCutout?.mode && currentCutout.mode !== "none");
    const resolvedMode = isActivelyCutout
      ? currentCutout!.mode
      : (initialMode || (currentCutout?.mode && currentCutout.mode !== "none" ? currentCutout.mode : "none"));
    return {
      enabled: resolvedMode !== "none",
      mode: resolvedMode,
      keyColor: currentCutout?.keyColor ?? "#00FF00",
      intensity: currentCutout?.intensity ?? 45,
      shadow: currentCutout?.shadow ?? 25,
      strokeColor: currentCutout?.strokeColor ?? "none",
      strokeWidth: currentCutout?.strokeWidth ?? 3,
      strokeStyle: currentCutout?.strokeStyle ?? "solid",
      bgColor: currentCutout?.bgColor ?? "none",
      quality: currentCutout?.quality ?? "best",
    };
  });

  const configRef = useRef<CutoutConfig>(config);
  configRef.current = config;

  // Processing state
  const [isProcessingFrames, setIsProcessingFrames] = useState<boolean>(false);
  const [isProcessingActiveFrame, setIsProcessingActiveFrame] = useState<boolean>(false);
  const [frameProgress, setFrameProgress] = useState<number>(0);
  const [processedFrames, setProcessedFrames] = useState<number>(0);
  const [totalFramesToProcess, setTotalFramesToProcess] = useState<number>(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [modelState, setModelState] = useState<CutoutModelState>(() => getCutoutModelState());
  const [hasAttemptedRestore, setHasAttemptedRestore] = useState<boolean>(false);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const previewInFlightRef = useRef(false);
  const resetGenerationRef = useRef(0);

  const clipDuration = Math.max(0.1, selectedClip?.duration || 1.0);
  const declaredSourceFps = Number(
    selectedClip?.sourceFrameRate ?? selectedClip?.frameRate ?? 30,
  );
  const targetFps = Number.isFinite(declaredSourceFps) && declaredSourceFps > 0
    ? Math.min(240, Math.max(1, declaredSourceFps))
    : 30;
  const currentQuality = config.quality || currentCutout?.quality || "best";
  const qualityFps = getCutoutQualityFps(currentQuality, targetFps);
  const estTotal = Math.max(1, Math.ceil(clipDuration * qualityFps));

  const currentProcessedCount = clipId
    ? getClipProcessedCount(clipId) || (selectedClip?.sourceMediaId ? getClipProcessedCount(selectedClip.sourceMediaId) : 0)
    : 0;
  const isAlreadyProcessed = clipId
    ? isVideoClip
      ? currentProcessedCount >= Math.max(1, Math.floor(estTotal * 0.90))
      : hasClipMasks(clipId) || (selectedClip?.sourceMediaId ? hasClipMasks(selectedClip.sourceMediaId) : false)
    : false;

  // Frame calculation for preview
  const clipStart = selectedClip?.startTime || 0;
  const localTime = Math.max(0, (currentTime || 0) - clipStart);
  const effectiveSpeed = Math.max(0.1, Math.min(16, selectedClip?.speed || 1.0));
  const elapsedClipTime = localTime * effectiveSpeed;
  const trimIn = selectedClip?.trimIn || 0;
  const sourceMediaDuration = (selectedClip?.duration || 0) * effectiveSpeed;
  const mediaTime = selectedClip?.reverse
    ? Math.max(trimIn, (trimIn + sourceMediaDuration) - elapsedClipTime)
    : trimIn + elapsedClipTime;
  const clipSourceFps = selectedClip?.sourceFrameRate ?? selectedClip?.frameRate ?? 30;
  const bakedFps =
    currentCutout?.bakedFps ||
    getClipBakedFps(clipId) ||
    (selectedClip?.sourceMediaId ? getClipBakedFps(selectedClip.sourceMediaId) : 0) ||
    qualityFps ||
    clipSourceFps;
  const frameIdx = Math.max(0, Math.round(localTime * bakedFps));

  // Sync state when clipId or modal visibility changes
  const prevClipIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (visible && clipId && clipId !== prevClipIdRef.current) {
      prevClipIdRef.current = clipId;
      const isActivelyCutout = Boolean(currentCutout?.enabled && currentCutout?.mode && currentCutout.mode !== "none");
      const resolvedMode = isActivelyCutout
        ? currentCutout!.mode
        : (initialMode || (currentCutout?.mode && currentCutout.mode !== "none" ? currentCutout.mode : "none"));
      const newCfg: CutoutConfig = {
        enabled: resolvedMode !== "none",
        mode: resolvedMode,
        keyColor: currentCutout?.keyColor ?? "#00FF00",
        intensity: currentCutout?.intensity ?? 45,
        shadow: currentCutout?.shadow ?? 25,
        strokeColor: currentCutout?.strokeColor ?? "none",
        strokeWidth: currentCutout?.strokeWidth ?? 3,
        strokeStyle: currentCutout?.strokeStyle ?? "solid",
        bgColor: currentCutout?.bgColor ?? "none",
        quality: currentCutout?.quality ?? "best",
      };
      setConfig(newCfg);
      if (newCfg.enabled && newCfg.mode !== "none") {
        onApplyCutout(newCfg, clipId);
        if (selectedClip?.url) {
          setTimeout(() => {
            const targetIdx = isVideoClip ? frameIdx : 0;
            const targetTime = isVideoClip ? mediaTime : 0;
            void runPreview(selectedClip, clipId, targetIdx, targetTime, newCfg).then((ok) => {
              if (ok) {
                onApplyCutout(newCfg, clipId);
                notifyMaskUpdated();
              }
            });
          }, 80);
        }
      }
    } else if (!visible) {
      prevClipIdRef.current = null;
    }
  }, [visible, clipId, initialMode]);

  // Prewarm neural engine, subscribe to model loading/download state, and restore persistent masks
  useEffect(() => {
    if (!visible) {
      setHasAttemptedRestore(false);
      return;
    }
    const unsubModel = subscribeCutoutModelState(setModelState);
    void ensureCutoutModelReady(false);
    if (clipId) {
      setHasAttemptedRestore(false);
      const fps = selectedClip?.sourceFrameRate ?? selectedClip?.frameRate ?? 30;
      const tasks = [restoreClipMasksFromStorage(clipId, fps)];
      if (selectedClip?.sourceMediaId) {
        tasks.push(restoreClipMasksFromStorage(selectedClip.sourceMediaId, fps));
      }
      Promise.all(tasks).finally(() => {
        setHasAttemptedRestore(true);
      });
    }
    return () => {
      unsubModel();
    };
  }, [visible, clipId, selectedClip?.sourceMediaId, selectedClip?.sourceFrameRate, selectedClip?.frameRate]);

  // Clean up debounce timer and preview flag on modal close, but preserve background video extraction
  useEffect(() => {
    if (!visible) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      previewInFlightRef.current = false;
      setIsProcessingActiveFrame(false);
      // Clean up uncommitted preview frame only if cutout was truly not enabled
      const isCutoutActive =
        (configRef.current?.enabled && configRef.current?.mode !== "none") ||
        (currentCutout?.enabled && currentCutout?.mode !== "none");
      if (!isCutoutActive) {
        if (abortCtrlRef.current) {
          abortCtrlRef.current.abort();
          abortCtrlRef.current = null;
        }
        setIsProcessingFrames(false);
        clearPreviewFrame(clipId, selectedClip?.sourceMediaId);
      }
    }
  }, [visible, currentCutout?.enabled, currentCutout?.mode, clipId, selectedClip?.sourceMediaId]);

  const onApplyCutoutRef = useRef(onApplyCutout);
  onApplyCutoutRef.current = onApplyCutout;

  const clipIdRef = useRef(clipId);
  clipIdRef.current = clipId;

  // Cleanup on unmount only - never trigger state updates or re-run cleanup on function reference changes
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

      // Save and persist active cutout config when leaving or unmounting the tool panel
      const targetClipId = clipIdRef.current;
      if (configRef.current?.enabled && configRef.current?.mode !== "none" && targetClipId) {
        onApplyCutoutRef.current?.(configRef.current, targetClipId);
        notifyMaskUpdated();
      }
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
      const isChroma = previewConfig.mode === "chroma";
      if (!isChroma) {
        const modelReady = await ensureCutoutModelReady(false);
        if (!modelReady) {
          const latestModel = getCutoutModelState();
          setProcessingError(
            latestModel.error ||
              "AI Cutout model could not be loaded. Check your connection or build and tap Retry.",
          );
          return false;
        }
      }
      const threshold = isChroma
        ? Math.max(0, Math.min(1, (previewConfig.intensity ?? 45) / 100))
        : 0.45;
      const feather = Math.max(0, Math.min(1, (previewConfig.shadow ?? 25) / 100));
      const ok = await processClipUnified(
        clip.url,
        id,
        index,
        time,
        threshold,
        feather,
        previewConfig.mode === "chroma" ? "chroma" : "auto",
        previewConfig.keyColor || "#00FF00",
        clip.type === "video" ? "video" : "photo",
      );
      if (generationAtStart !== resetGenerationRef.current) {
        clearPreviewFrame(id);
        return false;
      }
      if (!ok) {
        const latestModel = getCutoutModelState();
        setProcessingError(
          previewConfig.mode === "auto"
            ? latestModel.error ||
                "Auto Cutout could not create a mask for this frame. Tap Retry or try another frame."
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

  const handleConfigChange = (newConfig: CutoutConfig) => {
    if (isProcessingFrames) return;
    setConfig(newConfig);
    if (newConfig.mode === "none" || !newConfig.enabled) {
      clearPreviewFrame(clipId, selectedClip?.sourceMediaId);
    }
    onApplyCutout(newConfig, clipId);

    // If background fill or stroke outline changed, update the display immediately
    const stylingChanged =
      newConfig.bgColor !== config.bgColor ||
      newConfig.strokeColor !== config.strokeColor ||
      newConfig.strokeWidth !== config.strokeWidth ||
      newConfig.strokeStyle !== config.strokeStyle;
    if (stylingChanged) {
      notifyMaskUpdated();
    }

    const isChroma = newConfig.mode === "chroma";
    if (isChroma && Platform.OS === "web") {
      // Real-time GPU/WASM chroma compositing on web canvas
      notifyMaskUpdated();
    }

    const targetIdx = isVideoClip ? frameIdx : 0;
    const targetTime = isVideoClip ? mediaTime : 0;

    // Fast path: instant edge smoothness update on active frame without re-running neural network
    let instantUpdated = false;
    if (newConfig.mode === "auto" && newConfig.shadow !== config.shadow) {
      const sNorm = Math.max(0, Math.min(1, (newConfig.shadow ?? 25) / 100));
      instantUpdated = updateActiveFrameMatteParams(clipId, targetIdx, 0.45, sNorm);
      if (instantUpdated) {
        notifyMaskUpdated();
      }
    }

    // Trigger preview when enabling cutout, switching modes, or adjusting chroma parameters on native
    if (newConfig.enabled && newConfig.mode !== "none" && selectedClip?.url) {
      const modeChanged =
        newConfig.mode !== config.mode || (!config.enabled && newConfig.enabled);
      const chromaParamChanged =
        isChroma &&
        (newConfig.keyColor !== config.keyColor ||
          newConfig.intensity !== config.intensity ||
          newConfig.shadow !== config.shadow);
      const autoSmoothnessNeedsPreview =
        !isChroma &&
        !instantUpdated &&
        newConfig.shadow !== config.shadow;

      if (modeChanged || autoSmoothnessNeedsPreview || (chromaParamChanged && Platform.OS !== "web")) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        const delay = modeChanged ? 0 : 120;
        debounceTimerRef.current = setTimeout(() => {
          void runPreview(selectedClip, clipId, targetIdx, targetTime, newConfig).then((ok) => {
            if (ok) {
              onApplyCutout(newConfig, clipId);
              notifyMaskUpdated();
            }
          });
        }, delay);
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
    // Replace active frame preview without discarding already baked video frames
    clearPreviewFrame(clipId, selectedClip?.sourceMediaId);
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

  const handleProcessVideo = async (overrideConfig?: CutoutConfig) => {
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
    setCutoutProcessingActive(true);
    // Reprocess: Replace existing cutout data, disk files, and RAM caches to prevent storage bloat
    clearClipMasks(clipId, selectedClip?.sourceMediaId);
    clearPreviewFrame(clipId, selectedClip?.sourceMediaId);
    const validOverride = (overrideConfig && typeof overrideConfig === "object" && typeof overrideConfig.mode === "string")
      ? overrideConfig as CutoutConfig
      : undefined;
    const baseConfig = validOverride || config;
    const resolvedMode = baseConfig.mode && baseConfig.mode !== "none" ? baseConfig.mode : "auto";
    const selectedQuality = (validOverride && validOverride.quality) || config.quality || "best";
    const processingConfig: CutoutConfig = {
      ...config,
      ...validOverride,
      enabled: true,
      mode: resolvedMode,
      quality: selectedQuality,
    };
    setConfig(processingConfig);
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
    const qualityFps = getCutoutQualityFps(selectedQuality, targetFps);
    const estTotal = Math.max(1, Math.ceil(clipDuration * qualityFps));
    setTotalFramesToProcess(estTotal);
    setProcessedFrames(0);
    let lastProgressUpdateAt = 0;

    try {
      setProcessingError(null);
      const isChroma = processingConfig.mode === "chroma";
      const threshold = isChroma
        ? Math.max(0, Math.min(1, (processingConfig.intensity ?? 45) / 100))
        : 0.45;
      const feather = Math.max(0, Math.min(1, (processingConfig.shadow ?? 25) / 100));
      const processed = await processVideoUnified(
        selectedClip.url,
        clipId,
        clipDuration,
        selectedClip.trimIn || 0,
        selectedClip.speed || 1.0,
        qualityFps,
        threshold,
        feather,
        processingConfig.mode === "chroma" ? "chroma" : "auto",
        processingConfig.keyColor || "#00FF00",
        (pct, cur, tot) => {
          const now = Date.now();
          if (cur > 0 && pct < 100 && now - lastProgressUpdateAt < 60) return;
          lastProgressUpdateAt = now;
          setFrameProgress(pct);
          setProcessedFrames(cur);
          setTotalFramesToProcess(tot);
        },
        abortCtrlRef.current.signal,
        selectedQuality,
        !!selectedClip.reverse,
        selectedClip.sourceMediaId,
      );
      if (processed === 0) {
        setProcessingError("No frames were processed. Check clip access and cutout engine readiness, then retry.");
      } else {
        setFrameProgress(100);
        setProcessedFrames(processed);
        const finalConfig: CutoutConfig = {
          ...processingConfig,
          enabled: true,
          bakedFps: qualityFps,
          quality: selectedQuality,
        };
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
        clearClipMasks(clipId, selectedClip?.sourceMediaId);
        clearPreviewFrame(clipId, selectedClip?.sourceMediaId);
      }
      setCutoutProcessingActive(false);
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
      abortCtrlRef.current = null;
    }
    previewInFlightRef.current = false;
    setIsProcessingFrames(false);
    setIsProcessingActiveFrame(false);
    setFrameProgress(0);
    setProcessedFrames(0);
    setTotalFramesToProcess(0);
    setProcessingError(null);

    // Completely remove all cutout data, frames, caches, and storage like it was never done
    if (clipId) {
      clearClipMasks(clipId, selectedClip?.sourceMediaId);
    }
    clearPreviewFrame(clipId, selectedClip?.sourceMediaId);

    const resetCfg: CutoutConfig = {
      enabled: false,
      mode: "none",
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
    const isNone = config.mode === "none";
    const declaredSourceFps = Number(
      selectedClip?.sourceFrameRate ?? selectedClip?.frameRate ?? 30,
    );
    const targetFps = Number.isFinite(declaredSourceFps) && declaredSourceFps > 0
      ? Math.min(240, Math.max(1, declaredSourceFps))
      : 30;
    const finalConfig: CutoutConfig = {
      ...config,
      enabled: !isNone,
      mode: isNone ? "none" : config.mode,
      strokeStyle: config.strokeStyle || "solid",
      bakedFps: isNone ? undefined : (config.bakedFps || getCutoutQualityFps(currentQuality, targetFps)),
      quality: currentQuality,
    };
    if (isNone) {
      clearClipMasks(clipId, selectedClip?.sourceMediaId);
      clearPreviewFrame(clipId, selectedClip?.sourceMediaId);
    }
    onApplyCutout(finalConfig, clipId);
    notifyMaskUpdated();
    onApply?.();
    onClose();
  }, [config, clipId, onApplyCutout, onApply, onClose, handleCancelProcessing, selectedClip?.sourceMediaId, selectedClip?.sourceFrameRate, selectedClip?.frameRate, currentQuality]);

  const handleClose = useCallback(() => {
    handleCancelProcessing();
    // If cutout is configured and active, save and commit it on close
    if (config.enabled && config.mode !== "none") {
      const declaredSourceFps = Number(
        selectedClip?.sourceFrameRate ?? selectedClip?.frameRate ?? 30,
      );
      const targetFps =
        Number.isFinite(declaredSourceFps) && declaredSourceFps > 0
          ? Math.min(240, Math.max(1, declaredSourceFps))
          : 30;
      const finalConfig: CutoutConfig = {
        ...config,
        enabled: true,
        mode: config.mode,
        strokeStyle: config.strokeStyle || "solid",
        bakedFps:
          config.bakedFps ||
          getCutoutQualityFps(currentQuality, targetFps),
      };
      onApplyCutout(finalConfig, clipId);
      notifyMaskUpdated();
    } else {
      // Cutout was turned off or none: clean up preview and persist reset
      clearPreviewFrame(clipId, selectedClip?.sourceMediaId);
      if (currentCutout && currentCutout.enabled && currentCutout.mode !== "none") {
        onApplyCutout(currentCutout, clipId);
      } else {
        onApplyCutout(
          {
            enabled: false,
            mode: "none",
            keyColor: "#00FF00",
            intensity: 45,
            shadow: 25,
            strokeColor: "none",
            strokeWidth: 3,
            strokeStyle: "solid",
            bgColor: "none",
            quality: "fast",
          },
          clipId,
        );
      }
      notifyMaskUpdated();
    }
    onClose();
  }, [
    handleCancelProcessing,
    config,
    currentCutout,
    clipId,
    selectedClip?.sourceMediaId,
    selectedClip?.sourceFrameRate,
    selectedClip?.frameRate,
    currentQuality,
    onApplyCutout,
    onClose,
  ]);

  const handleRetryModelInit = useCallback(async () => {
    setProcessingError(null);
    const ok = await ensureCutoutModelReady(true);
    if (ok && configRef.current?.enabled && configRef.current?.mode === "auto" && selectedClip?.url) {
      const targetIdx = isVideoClip ? frameIdx : 0;
      const targetTime = isVideoClip ? mediaTime : 0;
      const previewOk = await runPreview(selectedClip, clipId, targetIdx, targetTime, configRef.current);
      if (previewOk) {
        onApplyCutout(configRef.current, clipId);
        notifyMaskUpdated();
      }
    }
  }, [clipId, frameIdx, isVideoClip, mediaTime, onApplyCutout, runPreview, selectedClip]);

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
            modelState={modelState}
            onRetryModelInit={handleRetryModelInit}
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
    backgroundColor: "#121214",
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: "#121214",
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
    backgroundColor: "#121214",
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetTitle: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#EDEDED",
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 6,
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  resetText: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "600",
  },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
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
