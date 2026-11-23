import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import {
  MotionTrackConfig,
  TrackingRect,
  TrackingActionType,
  TrajectoryPoint,
  FastArtProject,
  VideoClip,
} from "../../types/project";
import { triggerHaptic } from "../../utils/haptics";
import { ObjectTrackerEngine } from "../../utils/objectTrackerEngine";
import { CompactSliderInput } from "../Common/CompactSliderInput";
import { THEME_COLORS } from "../../constants/designConstants";
import { ModalHeader } from "../Common/ModalHeader";
import { pauseActiveVideoRenderer, setMotionTrackingActive } from "../../utils/videoRenderer";

interface MotionTrackingModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  targetType?: "text" | "sticker" | "overlay" | "video" | "caption";
  currentTrack?: MotionTrackConfig;
  onApplyTracking: (config: MotionTrackConfig) => void;
  isInline?: boolean;
  project?: FastArtProject;
  selectedClip?: any;
  currentTime?: number;
  updateProjectWithHistory?: (proj: FastArtProject) => void;
}

export default function MotionTrackingModal({
  visible,
  onClose,
  onApply,
  targetType = "video",
  currentTrack,
  onApplyTracking,
  isInline = false,
  project,
  selectedClip,
  currentTime,
  updateProjectWithHistory,
}: MotionTrackingModalProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 375;

  const isElementClip = targetType === "text" || targetType === "sticker" || targetType === "caption";
  // Primary States
  const [enabled, setEnabled] = useState<boolean>(
    currentTrack?.enabled || false,
  );
  const [activeTab, setActiveTab] = useState<"censor" | "pin" | "camera">(
    currentTrack?.actionType === "camera_center"
      ? "camera"
      : currentTrack?.actionType === "pin_element"
      ? "pin"
      : isElementClip
      ? "pin"
      : "censor"
  );

  // Target Reticle
  const [targetRect, setTargetRect] = useState<TrackingRect>(
    currentTrack?.targetRect || { x: 35, y: 25, width: 30, height: 30 },
  );

  // Operations
  const [actionType, setActionType] = useState<TrackingActionType>(
    currentTrack?.actionType || (isElementClip ? "pin_element" : "mosaic_censor"),
  );
  const [aiTarget, setAiTarget] = useState<'auto' | 'face' | 'body' | 'object'>(
    currentTrack?.aiTarget || 'auto'
  );
  const [pinnedClipId, setPinnedClipId] = useState<string>(
    currentTrack?.pinnedClipId || "",
  );
  const [trackScale, setTrackScale] = useState<boolean>(
    currentTrack?.trackScale !== false,
  );
  // Default trackRotation to FALSE so objects and text never tilt or twist
  const [trackRotation, setTrackRotation] = useState<boolean>(
    currentTrack?.trackRotation === true,
  );
  const [mosaicStyle, setMosaicStyle] = useState<"pixelate" | "blur">(
    currentTrack?.mosaicStyle || "blur",
  );
  const [mosaicRadius, setMosaicRadius] = useState<number>(
    currentTrack?.mosaicRadius ?? 18,
  );
  const [mosaicShape, setMosaicShape] = useState<"rectangle" | "circle">(
    currentTrack?.mosaicShape || "rectangle",
  );
  const [cameraFitToScreen, setCameraFitToScreen] = useState<boolean>(
    currentTrack?.cameraFitToScreen !== false,
  );
  const [cameraZoom, setCameraZoom] = useState<number>(
    currentTrack?.cameraZoom ?? 1.25,
  );
  const [cameraLockCenter, setCameraLockCenter] = useState<boolean>(
    currentTrack?.cameraLockCenter !== false,
  );
  const [smoothness, setSmoothness] = useState<number>(
    currentTrack?.smoothness ?? 75,
  );
  const [trackDirection, setTrackDirection] = useState<'forward' | 'backward' | 'bidirectional'>(
    currentTrack?.trackDirection || 'bidirectional'
  );

  // Tracking Progress & Trajectory
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusText, setScanStatusText] = useState<string>("");
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>(
    currentTrack?.trajectory || [],
  );
  const hasTrajectory = trajectory && trajectory.length > 0;
  const [bakedSuccess, setBakedSuccess] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (currentTrack && ((currentTrack.trajectory && currentTrack.trajectory.length > 0) || currentTrack.enabled)) {
      setEnabled(currentTrack.enabled || false);
      if (currentTrack.targetRect) setTargetRect(currentTrack.targetRect);
      if (currentTrack.actionType) {
        setActionType(currentTrack.actionType);
        if (currentTrack.actionType === "camera_center") setActiveTab("camera");
        else if (currentTrack.actionType === "pin_element") setActiveTab("pin");
        else setActiveTab("censor");
      }
      if (currentTrack.aiTarget) setAiTarget(currentTrack.aiTarget);
      if (currentTrack.pinnedClipId) setPinnedClipId(currentTrack.pinnedClipId);
      if (currentTrack.trackScale !== undefined) setTrackScale(currentTrack.trackScale);
      if (currentTrack.trackRotation !== undefined) setTrackRotation(currentTrack.trackRotation);
      if (currentTrack.mosaicStyle) setMosaicStyle(currentTrack.mosaicStyle);
      if (currentTrack.mosaicRadius !== undefined) setMosaicRadius(currentTrack.mosaicRadius);
      if (currentTrack.mosaicShape) setMosaicShape(currentTrack.mosaicShape);
      if (currentTrack.cameraFitToScreen !== undefined) setCameraFitToScreen(currentTrack.cameraFitToScreen);
      if (currentTrack.cameraZoom !== undefined) setCameraZoom(currentTrack.cameraZoom);
      if (currentTrack.cameraLockCenter !== undefined) setCameraLockCenter(currentTrack.cameraLockCenter);
      if (currentTrack.smoothness !== undefined) setSmoothness(currentTrack.smoothness);
      setTrajectory(currentTrack.trajectory || []);
    } else {
      // Untracked or newly switched clip: initialize clean state
      setEnabled(false);
      setTrajectory([]);
      setTargetRect(currentTrack?.targetRect || { x: 35, y: 25, width: 30, height: 30 });
      const defaultAction = isElementClip ? "pin_element" : "mosaic_censor";
      setActionType(currentTrack?.actionType || defaultAction);
      setActiveTab(
        currentTrack?.actionType === "camera_center"
          ? "camera"
          : currentTrack?.actionType === "pin_element"
          ? "pin"
          : isElementClip
          ? "pin"
          : "censor"
      );
      setAiTarget(currentTrack?.aiTarget || "auto");
      setPinnedClipId(currentTrack?.pinnedClipId || "");
      setTrackScale(currentTrack?.trackScale !== false);
      setTrackRotation(currentTrack?.trackRotation === true);
      setMosaicStyle(currentTrack?.mosaicStyle || "blur");
      setMosaicRadius(currentTrack?.mosaicRadius ?? 18);
      setMosaicShape(currentTrack?.mosaicShape || "rectangle");
      setCameraFitToScreen(currentTrack?.cameraFitToScreen !== false);
      setCameraZoom(currentTrack?.cameraZoom ?? 1.25);
      setCameraLockCenter(currentTrack?.cameraLockCenter !== false);
      setSmoothness(currentTrack?.smoothness ?? 75);
    }
  }, [visible, selectedClip?.id, currentTrack, isElementClip]);

  // Synchronize updates to parent clip
  const syncTracking = useCallback(
    (overrides?: Partial<MotionTrackConfig>) => {
      const nextTrajectory = overrides?.trajectory !== undefined ? overrides.trajectory : trajectory;
      const hasTraj = nextTrajectory.length > 0;
      // Never enable tracking without trajectory unless explicitly overridden while tracking
      const nextEnabled = overrides?.enabled !== undefined
        ? overrides.enabled
        : (hasTraj ? enabled : false);

      const config: MotionTrackConfig = {
        enabled: nextEnabled,
        mode: "object_track",
        intensity: overrides?.smoothness !== undefined ? overrides.smoothness : smoothness,
        aiTarget: overrides?.aiTarget || aiTarget,
        targetRect: overrides?.targetRect || targetRect,
        trajectory: nextTrajectory,
        actionType: overrides?.actionType || actionType,
        pinnedClipId: overrides?.pinnedClipId !== undefined ? overrides.pinnedClipId : pinnedClipId,
        trackScale: overrides?.trackScale !== undefined ? overrides.trackScale : trackScale,
        trackRotation: overrides?.trackRotation !== undefined ? overrides.trackRotation : trackRotation,
        mosaicStyle: overrides?.mosaicStyle || mosaicStyle,
        mosaicRadius: overrides?.mosaicRadius !== undefined ? overrides.mosaicRadius : mosaicRadius,
        mosaicShape: overrides?.mosaicShape || mosaicShape,
        cameraFitToScreen: overrides?.cameraFitToScreen !== undefined ? overrides.cameraFitToScreen : cameraFitToScreen,
        cameraZoom: overrides?.cameraZoom !== undefined ? overrides.cameraZoom : cameraZoom,
        cameraLockCenter: overrides?.cameraLockCenter !== undefined ? overrides.cameraLockCenter : cameraLockCenter,
        smoothness: overrides?.smoothness !== undefined ? overrides.smoothness : smoothness,
        trackDirection: 'bidirectional',
        anchorTime: overrides?.anchorTime !== undefined ? overrides.anchorTime : currentTrack?.anchorTime,
        trackingStatus:
          overrides?.trackingStatus ||
          (hasTraj ? "completed" : "idle"),
        lastTrackedAt: Date.now(),
      };

      onApplyTracking(config);

      // If pinning a specific clip and we have full project updater, sync tracking to pinned clip as well
      const effectivePinnedId = overrides?.pinnedClipId !== undefined ? overrides.pinnedClipId : pinnedClipId;
      if (project && updateProjectWithHistory && effectivePinnedId) {
        const proj = { ...project };
        let changed = false;
        const texts = [...(proj.tracks.text || [])];
        const tIdx = texts.findIndex((t) => t.id === effectivePinnedId);
        if (tIdx >= 0) {
          texts[tIdx] = { ...texts[tIdx], motionTrack: config };
          proj.tracks = { ...proj.tracks, text: texts };
          changed = true;
        }
        const stickers = [...(proj.tracks.stickers || [])];
        const sIdx = stickers.findIndex((s) => s.id === effectivePinnedId);
        if (sIdx >= 0) {
          stickers[sIdx] = { ...stickers[sIdx], motionTrack: config };
          proj.tracks = { ...proj.tracks, stickers };
          changed = true;
        }
        const captions = [...(proj.tracks.captions || [])];
        const cIdx = captions.findIndex((c) => c.id === effectivePinnedId);
        if (cIdx >= 0) {
          captions[cIdx] = { ...captions[cIdx], motionTrack: config };
          proj.tracks = { ...proj.tracks, captions };
          changed = true;
        }
        const videos = [...(proj.tracks.video || [])];
        const vIdx = videos.findIndex((v) => v.id === effectivePinnedId);
        if (vIdx >= 0) {
          videos[vIdx] = { ...videos[vIdx], motionTrack: config };
          proj.tracks = { ...proj.tracks, video: videos };
          changed = true;
        }
        if (changed) {
          updateProjectWithHistory(proj);
        }
      }
    },
    [
      enabled,
      smoothness,
      targetRect,
      aiTarget,
      trajectory,
      actionType,
      pinnedClipId,
      trackScale,
      trackRotation,
      trackDirection,
      mosaicStyle,
      mosaicRadius,
      mosaicShape,
      cameraFitToScreen,
      cameraZoom,
      cameraLockCenter,
      currentTrack?.anchorTime,
      onApplyTracking,
      project,
      updateProjectWithHistory,
    ],
  );

  // Find candidate clips in project that can be pinned
  const availableClipsToPin = useMemo(() => {
    if (!visible || !project) return [];
    const list: { id: string; label: string; icon: string; type: string }[] = [];

    (project.tracks.text || []).forEach((t) => {
      list.push({
        id: t.id,
        label: t.text ? `"${t.text.slice(0, 14)}${t.text.length > 14 ? "…" : ""}"` : "Text",
        icon: "text-outline",
        type: "text",
      });
    });

    (project.tracks.stickers || []).forEach((s, idx) => {
      list.push({
        id: s.id,
        label: `Sticker #${idx + 1}`,
        icon: "happy-outline",
        type: "sticker",
      });
    });

    (project.tracks.captions || []).forEach((c, idx) => {
      if (c.id !== selectedClip?.id) {
        list.push({
          id: c.id,
          label: c.text ? `"${c.text.slice(0, 14)}${c.text.length > 14 ? "…" : ""}"` : `Caption #${idx + 1}`,
          icon: "chatbubble-ellipses-outline",
          type: "caption",
        });
      }
    });

    (project.tracks.video || []).forEach((v, idx) => {
      if (v.id !== selectedClip?.id) {
        list.push({
          id: v.id,
          label: `Overlay #${idx + 1}`,
          icon: "videocam-outline",
          type: "video",
        });
      }
    });

    return list;
  }, [visible, project, selectedClip]);

  // Run Real Computer-Vision Tracking
  const handleStartTracking = useCallback(async () => {
    triggerHaptic("medium");
    setIsScanning(true);
    setScanProgress(0);
    setScanStatusText("Analyzing Video Frames...");

    // Silence video playback so preview remains calm and static during background tracking
    setMotionTrackingActive(true);
    pauseActiveVideoRenderer();
    if (typeof document !== 'undefined') {
      try {
        document.querySelectorAll('video').forEach((v) => {
          if (!v.paused) {
            try { v.pause(); } catch (_) {}
          }
        });
      } catch (_) {}
    }

    syncTracking({ trackingStatus: "tracking" });

    const anchorTime = currentTime !== undefined ? currentTime : (selectedClip?.startTime ?? 0);

    let bgVideoClip: VideoClip | null = null;
    if (isElementClip && project?.tracks?.video) {
      bgVideoClip =
        project.tracks.video.find(
          (v) =>
            (v.trackIndex === 0 || !v.trackIndex) &&
            anchorTime >= v.startTime &&
            anchorTime < v.startTime + v.duration
        ) ||
        project.tracks.video.find(
          (v) => anchorTime >= v.startTime && anchorTime < v.startTime + v.duration
        ) ||
        project.tracks.video[0] ||
        null;
    } else if (!isElementClip) {
      bgVideoClip = selectedClip;
    }

    const clipToTrack: VideoClip = selectedClip || {
      id: "active_clip",
      startTime: 0,
      duration: 5,
      url: "",
      title: "Video",
      type: "video",
    };

    abortControllerRef.current = new AbortController();

    try {
      const generatedTrajectory = await ObjectTrackerEngine.trackClip({
        clip: selectedClip || clipToTrack,
        sourceVideoClip: bgVideoClip,
        project,
        targetRect,
        aiTarget,
        sampleFps: 4, // Optimized sparse keyframe sampling (4 FPS) for fast tracking
        smoothness,
        trackScale,
        trackRotation,
        direction: 'bidirectional', // Always trace the whole clip
        currentTime: anchorTime,
        signal: abortControllerRef.current.signal,
        onProgress: (p) => {
          setScanProgress(p.percent);
          setScanStatusText(p.statusText);
        },
      });

      triggerHaptic("success");
      setTrajectory(generatedTrajectory);
      setEnabled(true);
      setIsScanning(false);
      setScanStatusText("");

      const effectiveActionType = actionType;
      const effectivePinnedId = actionType === "pin_element"
        ? (pinnedClipId || (isElementClip ? selectedClip.id : ""))
        : "";

      syncTracking({
        enabled: true,
        trajectory: generatedTrajectory,
        targetRect,
        aiTarget,
        actionType: effectiveActionType,
        pinnedClipId: effectivePinnedId,
        anchorTime,
        trackScale,
        trackRotation,
        mosaicStyle,
        mosaicRadius,
        mosaicShape,
        cameraFitToScreen,
        cameraZoom,
        cameraLockCenter,
        smoothness,
        trackingStatus: "completed",
      });
    } catch (err) {
      console.warn("[MotionTracking] Tracking error or abort:", err);
      setMotionTrackingActive(false);
      setIsScanning(false);
      syncTracking({ trackingStatus: trajectory.length > 0 ? "completed" : "idle" });
    }
  }, [
    isElementClip,
    currentTime,
    selectedClip,
    project,
    targetRect,
    aiTarget,
    trackDirection,
    smoothness,
    trackScale,
    trackRotation,
    mosaicStyle,
    mosaicRadius,
    mosaicShape,
    cameraFitToScreen,
    cameraZoom,
    cameraLockCenter,
    actionType,
    pinnedClipId,
    trajectory.length,
    syncTracking,
  ]);

  const handleCancelTracking = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMotionTrackingActive(false);
    setIsScanning(false);
    triggerHaptic("warning");
    syncTracking({ trackingStatus: trajectory.length > 0 ? "completed" : "idle" });
  }, [trajectory.length, syncTracking]);

  const handleClose = useCallback(() => {
    handleCancelTracking();
    onClose();
  }, [handleCancelTracking, onClose]);

  // Clean up and abort active tracking if modal becomes hidden or unmounts
  useEffect(() => {
    if (!visible) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setMotionTrackingActive(false);
      setIsScanning(false);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setMotionTrackingActive(false);
    };
  }, [visible]);

  const handleBakeKeyframes = useCallback(() => {
    if (!trajectory || trajectory.length === 0 || !project || !updateProjectWithHistory) {
      return;
    }
    triggerHaptic("success");

    let targetClip = selectedClip;
    let targetKind: "video" | "text" | "sticker" | "caption" =
      targetType === "overlay" ? "video" : (targetType as any);

    if (!isElementClip && pinnedClipId) {
      const foundTxt = (project.tracks.text || []).find((t) => t.id === pinnedClipId);
      if (foundTxt) {
        targetClip = foundTxt;
        targetKind = "text";
      }
      const foundStk = (project.tracks.stickers || []).find((s) => s.id === pinnedClipId);
      if (foundStk) {
        targetClip = foundStk;
        targetKind = "sticker";
      }
      const foundCap = (project.tracks.captions || []).find((c) => c.id === pinnedClipId);
      if (foundCap) {
        targetClip = foundCap;
        targetKind = "caption";
      }
      const foundVid = (project.tracks.video || []).find((v) => v.id === pinnedClipId);
      if (foundVid) {
        targetClip = foundVid;
        targetKind = "video";
      }
    }

    const baseTransform = targetClip?.transform || {
      x: targetClip?.position?.x ?? (targetKind === "video" ? 0 : 50),
      y: targetClip?.position?.y ?? (targetKind === "video" ? 0 : 50),
      scale: targetClip?.scale ?? 1.0,
      rotation: targetClip?.rotation ?? 0,
    };

    const keyframes = ObjectTrackerEngine.bakeTrajectoryToKeyframes(
      trajectory,
      baseTransform,
      targetClip?.duration || 5,
      0.2,
      targetKind,
      currentTrack?.anchorTime
    );

    const currentProj = { ...project };
    let found = false;

    if (targetKind === "video") {
      const videos = [...(currentProj.tracks.video || [])];
      const vIdx = videos.findIndex((v) => v.id === targetClip?.id);
      if (vIdx >= 0) {
        videos[vIdx] = { ...videos[vIdx], keyframes };
        currentProj.tracks = { ...currentProj.tracks, video: videos };
        found = true;
      }
    } else if (targetKind === "text") {
      const texts = [...(currentProj.tracks.text || [])];
      const tIdx = texts.findIndex((t) => t.id === targetClip?.id);
      if (tIdx >= 0) {
        texts[tIdx] = { ...texts[tIdx], keyframes };
        currentProj.tracks = { ...currentProj.tracks, text: texts };
        found = true;
      }
    } else if (targetKind === "sticker") {
      const stickers = [...(currentProj.tracks.stickers || [])];
      const sIdx = stickers.findIndex((s) => s.id === targetClip?.id);
      if (sIdx >= 0) {
        stickers[sIdx] = { ...stickers[sIdx], keyframes };
        currentProj.tracks = { ...currentProj.tracks, stickers };
        found = true;
      }
    } else if (targetKind === "caption") {
      const captions = [...(currentProj.tracks.captions || [])];
      const cIdx = captions.findIndex((c) => c.id === targetClip?.id);
      if (cIdx >= 0) {
        captions[cIdx] = { ...captions[cIdx], keyframes };
        currentProj.tracks = { ...currentProj.tracks, captions };
        found = true;
      }
    }

    if (found) {
      updateProjectWithHistory(currentProj);
      setBakedSuccess(true);
      setTimeout(() => setBakedSuccess(false), 2500);
    }
  }, [
    trajectory,
    project,
    updateProjectWithHistory,
    selectedClip,
    targetType,
    isElementClip,
    pinnedClipId,
    currentTrack?.anchorTime,
  ]);

  const handleDone = useCallback(() => {
    triggerHaptic("success");
    syncTracking({ enabled: hasTrajectory });
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  }, [hasTrajectory, onApply, onClose, syncTracking]);

  const handleReset = useCallback(() => {
    triggerHaptic("warning");
    const defaultRect = { x: 35, y: 25, width: 30, height: 30 };
    setEnabled(false);
    setTrajectory([]);
    setTargetRect(defaultRect);
    setPinnedClipId("");
    syncTracking({
      enabled: false,
      trajectory: [],
      targetRect: defaultRect,
      pinnedClipId: "",
      actionType: "mosaic_censor",
      trackingStatus: "idle",
    });

    // If an element was pinned in project, unpin it cleanly
    if (project && updateProjectWithHistory && pinnedClipId) {
      const proj = { ...project };
      let changed = false;
      const texts = [...(proj.tracks.text || [])];
      const tIdx = texts.findIndex((t) => t.id === pinnedClipId);
      if (tIdx >= 0) {
        texts[tIdx] = { ...texts[tIdx], motionTrack: undefined };
        proj.tracks = { ...proj.tracks, text: texts };
        changed = true;
      }
      const stickers = [...(proj.tracks.stickers || [])];
      const sIdx = stickers.findIndex((s) => s.id === pinnedClipId);
      if (sIdx >= 0) {
        stickers[sIdx] = { ...stickers[sIdx], motionTrack: undefined };
        proj.tracks = { ...proj.tracks, stickers };
        changed = true;
      }
      const captions = [...(proj.tracks.captions || [])];
      const cIdx = captions.findIndex((c) => c.id === pinnedClipId);
      if (cIdx >= 0) {
        captions[cIdx] = { ...captions[cIdx], motionTrack: undefined };
        proj.tracks = { ...proj.tracks, captions };
        changed = true;
      }
      const videos = [...(proj.tracks.video || [])];
      const vIdx = videos.findIndex((v) => v.id === pinnedClipId);
      if (vIdx >= 0) {
        videos[vIdx] = { ...videos[vIdx], motionTrack: undefined };
        proj.tracks = { ...proj.tracks, video: videos };
        changed = true;
      }
      if (changed) {
        updateProjectWithHistory(proj);
      }
    }
  }, [project, updateProjectWithHistory, pinnedClipId, syncTracking]);

  if (!visible) return null;

  return (
    <View style={[styles.container, isInline && styles.inlineSheetContainer]}>
      {/* Header for standalone modal */}
      {!isInline && (
        <ModalHeader
          title="Tracking"
          subtitle={hasTrajectory ? `${trajectory.length} pts` : undefined}
          iconName="scan-outline"
          onClose={handleClose}
          onReset={hasTrajectory ? handleReset : undefined}
          resetText="Clear"
        />
      )}

      {/* Inline Subheader / Quick Status bar */}
      {isInline && (
        <View style={styles.inlineStatusBar}>
          <View style={styles.inlineStatusLeft}>
            {hasTrajectory ? (
              <View style={styles.statusBadge}>
                <View style={styles.statusDotActive} />
                <Text style={styles.statusBadgeText}>{trajectory.length} pts tracked</Text>
              </View>
            ) : (
              <View style={styles.statusBadgeIdle}>
                <View style={styles.statusDotIdle} />
                <Text style={styles.statusBadgeIdleText}>Ready to Track</Text>
              </View>
            )}
          </View>

          {hasTrajectory && (
            <TouchableOpacity
              onPress={handleReset}
              style={styles.clearBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={11} color="#EF4444" style={{ marginRight: 3 }} />
              <Text style={styles.clearBtnText}>Clear Track</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Target Element Header Badge for Text / Sticker / Overlay Clip */}
      {isElementClip && (
        <View style={styles.elementHeaderCard}>
          <View style={styles.elementIconBadge}>
            <Ionicons
              name={
                targetType === "text"
                  ? "text"
                  : targetType === "sticker"
                  ? "happy"
                  : "layers"
              }
              size={14}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.elementInfoCol}>
            <Text style={styles.elementTitle} numberOfLines={1}>
              {targetType === "text"
                ? `Text: "${selectedClip?.text || "Text"}"`
                : targetType === "sticker"
                ? `Sticker: ${selectedClip?.char || "Graphic"}`
                : "PIP Video Overlay"}
            </Text>
            <Text style={styles.elementSubtitle}>
              Element automatically follows video motion
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.sheetBody}
        contentContainerStyle={styles.sheetBodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scanning Progress HUD when active */}
        {isScanning ? (
          <View style={styles.scanningCard}>
            <View style={styles.scanningHeader}>
              <View style={styles.scanningLeft}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.scanningTitle}>{scanStatusText || "Tracking Target…"}</Text>
              </View>
              <Text style={styles.scanningPercent}>{scanProgress}%</Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${scanProgress}%` }]} />
            </View>

            <TouchableOpacity
              style={styles.cancelScanBtn}
              onPress={handleCancelTracking}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.cancelScanText}>Cancel Tracking</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Primary Tracking Action Bar */
          <View style={styles.actionBtnRow}>
            {/* Start / Re-Track Target */}
            <TouchableOpacity
              style={[
                styles.startTrackBtn,
                hasTrajectory && styles.retrackBtn,
                (hasTrajectory && !isInline) && { flex: 1.4 },
              ]}
              onPress={handleStartTracking}
              activeOpacity={0.8}
            >
              <Ionicons
                name={hasTrajectory ? "refresh" : "scan"}
                size={isSmallScreen ? 14 : 16}
                color="#000000"
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.startTrackBtnText, isSmallScreen && { fontSize: 11.5 }]} numberOfLines={1}>
                {hasTrajectory
                  ? isSmallScreen
                    ? "RE-TRACK"
                    : "RE-TRACK CLIP"
                  : isSmallScreen
                  ? "TRACK CLIP"
                  : "START TRACKING"}
              </Text>
            </TouchableOpacity>

            {/* Clear Track Button: Only visible in standalone modal when tracked (in inline sheet, inlineStatusBar has it) */}
            {hasTrajectory && !isInline && (
              <TouchableOpacity
                style={[styles.resetTrackActionBtn, isSmallScreen && { paddingHorizontal: 10 }]}
                onPress={handleReset}
                activeOpacity={0.8}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name="trash-outline"
                  size={isSmallScreen ? 13 : 15}
                  color="#EF4444"
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.resetTrackActionBtnText, isSmallScreen && { fontSize: 10.5 }]} numberOfLines={1}>
                  Clear Track
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─────────────────────────────────────────────
            SECTION: WHAT TO DO AFTER TRACKING
            ───────────────────────────────────────────── */}
        <View style={styles.afterTrackingSection}>
          <View style={styles.afterTrackingHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, paddingRight: 6 }}>
              <Ionicons
                name={hasTrajectory ? "checkmark-circle" : "options-outline"}
                size={isSmallScreen ? 12 : 14}
                color={hasTrajectory ? "#10B981" : "#00F2FE"}
              />
              <Text style={[styles.afterTrackingTitle, isSmallScreen && { fontSize: 10 }]} numberOfLines={1}>
                {isSmallScreen ? "POST-TRACK ACTION" : "WHAT TO DO AFTER TRACKING"}
              </Text>
            </View>
            <View style={hasTrajectory ? styles.trackedBadgeActive : styles.trackedBadgeIdle}>
              <Text style={hasTrajectory ? styles.trackedBadgeTextActive : styles.trackedBadgeTextIdle}>
                {hasTrajectory
                  ? isSmallScreen
                    ? `${trajectory.length} pts`
                    : `${trajectory.length} Pts Tracked`
                  : "Ready"}
              </Text>
            </View>
          </View>

          {/* Action Choice Tabs: Censor Blur, Pin Element, Lock Camera */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "censor" && styles.tabBtnActive]}
              onPress={() => {
                triggerHaptic("selection");
                setActiveTab("censor");
                setActionType("mosaic_censor");
                syncTracking({ actionType: "mosaic_censor" });
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="eye-off-outline"
                size={isSmallScreen ? 12 : 13}
                color={activeTab === "censor" ? "#00F2FE" : "#8E8E93"}
              />
              <Text
                style={[
                  styles.tabText,
                  isSmallScreen && { fontSize: 10 },
                  activeTab === "censor" && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                {isSmallScreen ? "Blur" : "Censor Blur"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "pin" && styles.tabBtnActive]}
              onPress={() => {
                triggerHaptic("selection");
                setActiveTab("pin");
                setActionType("pin_element");
                syncTracking({ actionType: "pin_element" });
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="attach-outline"
                size={isSmallScreen ? 12 : 13}
                color={activeTab === "pin" ? "#00F2FE" : "#8E8E93"}
              />
              <Text
                style={[
                  styles.tabText,
                  isSmallScreen && { fontSize: 10 },
                  activeTab === "pin" && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                {isSmallScreen ? "Pin" : "Pin Element"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "camera" && styles.tabBtnActive]}
              onPress={() => {
                triggerHaptic("selection");
                setActiveTab("camera");
                setActionType("camera_center");
                syncTracking({ actionType: "camera_center" });
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="videocam-outline"
                size={isSmallScreen ? 12 : 13}
                color={activeTab === "camera" ? "#00F2FE" : "#8E8E93"}
              />
              <Text
                style={[
                  styles.tabText,
                  isSmallScreen && { fontSize: 10 },
                  activeTab === "camera" && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                {isSmallScreen ? "Camera" : "Lock Camera"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ACTION 1: CENSOR BLUR SETTINGS */}
          {activeTab === "censor" && (
            <View style={styles.tabContentSection}>
              {/* Shape Selection: Rectangle vs Circle */}
              <View style={styles.styleSegmentRow}>
                <TouchableOpacity
                  style={[styles.segmentBtn, mosaicShape === "rectangle" && styles.segmentBtnActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    setMosaicShape("rectangle");
                    syncTracking({ mosaicShape: "rectangle" });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name="square-outline"
                    size={isSmallScreen ? 12 : 14}
                    color={mosaicShape === "rectangle" ? "#00F2FE" : "#8E8E93"}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[styles.segmentText, isSmallScreen && { fontSize: 10 }, mosaicShape === "rectangle" && styles.segmentTextActive]}
                    numberOfLines={1}
                  >
                    {isSmallScreen ? "Rectangle" : "Rectangle Box"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentBtn, mosaicShape === "circle" && styles.segmentBtnActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    setMosaicShape("circle");
                    syncTracking({ mosaicShape: "circle" });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name="ellipse-outline"
                    size={isSmallScreen ? 12 : 14}
                    color={mosaicShape === "circle" ? "#00F2FE" : "#8E8E93"}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[styles.segmentText, isSmallScreen && { fontSize: 10 }, mosaicShape === "circle" && styles.segmentTextActive]}
                    numberOfLines={1}
                  >
                    {isSmallScreen ? "Circle" : "Circle / Oval"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Blur Style Selection: Blur vs Pixelate */}
              <View style={styles.styleSegmentRow}>
                <TouchableOpacity
                  style={[styles.segmentBtn, mosaicStyle === "blur" && styles.segmentBtnActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    setMosaicStyle("blur");
                    syncTracking({ mosaicStyle: "blur" });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name="water-outline"
                    size={isSmallScreen ? 12 : 14}
                    color={mosaicStyle === "blur" ? "#00F2FE" : "#8E8E93"}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[styles.segmentText, isSmallScreen && { fontSize: 10 }, mosaicStyle === "blur" && styles.segmentTextActive]}
                    numberOfLines={1}
                  >
                    {isSmallScreen ? "Gaussian" : "Gaussian Blur"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentBtn, mosaicStyle === "pixelate" && styles.segmentBtnActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    setMosaicStyle("pixelate");
                    syncTracking({ mosaicStyle: "pixelate" });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name="grid-outline"
                    size={isSmallScreen ? 12 : 14}
                    color={mosaicStyle === "pixelate" ? "#00F2FE" : "#8E8E93"}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[styles.segmentText, isSmallScreen && { fontSize: 10 }, mosaicStyle === "pixelate" && styles.segmentTextActive]}
                    numberOfLines={1}
                  >
                    {isSmallScreen ? "Pixelate" : "Pixelate Mosaic"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Compact Blur Radius / Block Size Slider */}
              <CompactSliderInput
                label={mosaicStyle === "pixelate" ? "Block Size" : "Blur Radius"}
                value={mosaicRadius}
                min={4}
                max={60}
                step={1}
                unit="px"
                accentColor="#FFFFFF"
                onChange={(val) => {
                  setMosaicRadius(val);
                  syncTracking({ mosaicRadius: val });
                }}
                containerStyle={styles.compactSliderWrap}
              />

              {/* Fit to Scale for Censor Blur */}
              <View style={[styles.toggleRow, { marginTop: 6 }]}>
                <TouchableOpacity
                  style={[styles.togglePill, trackScale && styles.togglePillActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    const nextVal = !trackScale;
                    setTrackScale(nextVal);
                    syncTracking({ trackScale: nextVal });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={trackScale ? "checkbox" : "square-outline"}
                    size={isSmallScreen ? 13 : 15}
                    color={trackScale ? "#00F2FE" : "#8E8E93"}
                  />
                  <Text
                    style={[styles.togglePillText, isSmallScreen && { fontSize: 10 }, trackScale && styles.togglePillTextActive]}
                    numberOfLines={1}
                  >
                    {isSmallScreen ? "Fit to Scale" : "Fit to Scale (Follow Target Size)"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ACTION 2: PIN ELEMENT SETTINGS */}
          {activeTab === "pin" && (
            <View style={styles.tabContentSection}>
              {isElementClip ? (
                <View style={styles.elementActionNotice}>
                  <Ionicons name="link-outline" size={13} color="#00F2FE" style={{ marginRight: 5 }} />
                  <Text style={[styles.elementActionNoticeText, isSmallScreen && { fontSize: 9.5 }]} numberOfLines={2}>
                    This element automatically follows the tracked subject in video
                  </Text>
                </View>
              ) : availableClipsToPin.length === 0 ? (
                <View style={styles.emptyClipsBox}>
                  <Ionicons name="information-circle-outline" size={13} color="#94A3B8" />
                  <Text style={[styles.emptyClipsText, isSmallScreen && { fontSize: 10 }]}>
                    Add a Text, Sticker, Caption, or Overlay Video to pin to this moving target.
                  </Text>
                </View>
              ) : (
                <View style={styles.pinVerticalContainer}>
                  <View style={styles.pinSectionHeader}>
                    <Text style={styles.pinSectionTitle}>ATTACH TO TARGET</Text>
                    {pinnedClipId ? (
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic("selection");
                          setPinnedClipId("");
                          syncTracking({ pinnedClipId: "", actionType: "pin_element" });
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.pinDetachText}>Detach</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                    <View style={styles.pinVerticalList}>
                      {availableClipsToPin.map((c) => {
                        const isSelected = pinnedClipId === c.id;
                        const layerTag =
                          c.type === "text"
                            ? "Text"
                            : c.type === "sticker"
                            ? "Sticker"
                            : c.type === "caption"
                            ? "Caption"
                            : "Overlay";
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[styles.pinClipRow, isSelected && styles.pinClipRowActive, isSmallScreen && { paddingVertical: 5, paddingHorizontal: 7 }]}
                            onPress={() => {
                              triggerHaptic("selection");
                              const nextId = isSelected ? "" : c.id;
                              setPinnedClipId(nextId);
                              setActionType("pin_element");
                              syncTracking({
                                pinnedClipId: nextId,
                                actionType: "pin_element",
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.pinClipIconWrap, isSelected && styles.pinClipIconWrapActive, isSmallScreen && { width: 22, height: 22, marginRight: 6 }]}>
                              <Ionicons
                                name={c.icon as any}
                                size={isSmallScreen ? 12 : 14}
                                color={isSelected ? "#00F2FE" : "#8E8E93"}
                              />
                            </View>
                            <View style={styles.pinClipInfo}>
                              <Text
                                style={[styles.pinClipLabel, isSmallScreen && { fontSize: 10.5 }, isSelected && styles.pinClipLabelActive]}
                                numberOfLines={1}
                              >
                                {c.label}
                              </Text>
                              <Text style={[styles.pinClipSubtext, isSmallScreen && { fontSize: 9 }]}>{layerTag}</Text>
                            </View>
                            <View style={[styles.pinRadioIndicator, isSelected && styles.pinRadioIndicatorActive, isSmallScreen && { width: 16, height: 16, borderRadius: 8 }]}>
                              {isSelected ? (
                                <Ionicons
                                  name="checkmark"
                                  size={isSmallScreen ? 10 : 12}
                                  color="#08090E"
                                />
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Scale & Tilt Toggles in 2 compact columns */}
              <View style={[styles.toggleRow, { marginTop: 6 }]}>
                <TouchableOpacity
                  style={[styles.togglePill, trackScale && styles.togglePillActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    const nextVal = !trackScale;
                    setTrackScale(nextVal);
                    syncTracking({ trackScale: nextVal });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={trackScale ? "checkbox" : "square-outline"}
                    size={isSmallScreen ? 13 : 15}
                    color={trackScale ? "#00F2FE" : "#8E8E93"}
                  />
                  <Text style={[styles.togglePillText, isSmallScreen && { fontSize: 10 }, trackScale && styles.togglePillTextActive]} numberOfLines={1}>
                    Fit to Scale
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.togglePill, trackRotation && styles.togglePillActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    const nextVal = !trackRotation;
                    setTrackRotation(nextVal);
                    syncTracking({ trackRotation: nextVal });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={trackRotation ? "checkbox" : "square-outline"}
                    size={isSmallScreen ? 13 : 15}
                    color={trackRotation ? "#00F2FE" : "#8E8E93"}
                  />
                  <Text style={[styles.togglePillText, isSmallScreen && { fontSize: 10 }, trackRotation && styles.togglePillTextActive]} numberOfLines={1}>
                    Follow Tilt
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ACTION 3: CAMERA LOCK SETTINGS */}
          {activeTab === "camera" && (
            <View style={styles.tabContentSection}>
              <View style={styles.cameraInfoCard}>
                <Ionicons name="videocam" size={15} color="#EDEDED" style={{ marginRight: 6 }} />
                <Text style={[styles.cameraInfoDesc, isSmallScreen && { fontSize: 10, lineHeight: 14 }]}>
                  Locks camera onto tracked subject and auto-centers the frame.
                </Text>
              </View>

              <View style={[styles.toggleRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.togglePill, cameraFitToScreen && styles.togglePillActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    const nextVal = !cameraFitToScreen;
                    setCameraFitToScreen(nextVal);
                    syncTracking({ cameraFitToScreen: nextVal, actionType: "camera_center" });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={cameraFitToScreen ? "checkbox" : "square-outline"}
                    size={isSmallScreen ? 13 : 15}
                    color={cameraFitToScreen ? "#00F2FE" : "#8E8E93"}
                  />
                  <Text style={[styles.togglePillText, isSmallScreen && { fontSize: 10 }, cameraFitToScreen && styles.togglePillTextActive]} numberOfLines={1}>
                    {isSmallScreen ? "Fit to Scale" : "Fit to Scale (Screen)"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.togglePill, cameraLockCenter && styles.togglePillActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    const nextVal = !cameraLockCenter;
                    setCameraLockCenter(nextVal);
                    syncTracking({ cameraLockCenter: nextVal, actionType: "camera_center" });
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={cameraLockCenter ? "checkbox" : "square-outline"}
                    size={isSmallScreen ? 13 : 15}
                    color={cameraLockCenter ? "#00F2FE" : "#8E8E93"}
                  />
                  <Text style={[styles.togglePillText, isSmallScreen && { fontSize: 10 }, cameraLockCenter && styles.togglePillTextActive]} numberOfLines={1}>
                    Lock Center
                  </Text>
                </TouchableOpacity>
              </View>

              {cameraFitToScreen && (
                <View style={{ marginTop: 8 }}>
                  <CompactSliderInput
                    label="Camera Zoom"
                    value={Math.round(cameraZoom * 100)}
                    min={100}
                    max={250}
                    step={5}
                    unit="%"
                    accentColor="#FFFFFF"
                    onChange={(val) => {
                      const z = Number((val / 100).toFixed(2));
                      setCameraZoom(z);
                      syncTracking({ cameraZoom: z, actionType: "camera_center" });
                    }}
                    containerStyle={styles.compactSliderWrap}
                  />
                </View>
              )}
            </View>
          )}

          {/* Burn into Keyframes Action */}
          <View style={styles.bakeSection}>
            <View style={styles.bakeInfoRow}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={[styles.bakeTitle, isSmallScreen && { fontSize: 10.5 }]}>Burn into Keyframes</Text>
                <Text style={[styles.bakeSubtitle, isSmallScreen && { fontSize: 9 }]} numberOfLines={1}>
                  {isSmallScreen ? "Convert track into timeline keyframes" : "Converts tracking trajectory into standard editable keyframes"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.bakeActionBtn,
                  bakedSuccess && styles.bakeActionBtnSuccess,
                  !hasTrajectory && { opacity: 0.5 },
                  isSmallScreen && { paddingHorizontal: 8, paddingVertical: 5 },
                ]}
                onPress={handleBakeKeyframes}
                activeOpacity={0.7}
                disabled={!hasTrajectory}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name={bakedSuccess ? "checkmark-circle" : "key-outline"}
                  size={12}
                  color={bakedSuccess ? "#10B981" : "#EDEDED"}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.bakeActionBtnText,
                    bakedSuccess && styles.bakeActionBtnTextSuccess,
                    isSmallScreen && { fontSize: 9.5 },
                  ]}
                  numberOfLines={1}
                >
                  {bakedSuccess ? "Baked!" : isSmallScreen ? "Bake" : "Bake Keyframes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Motion Smoothness Slider */}
        <View style={[styles.tabContentSection, { marginTop: 8 }]}>
          <CompactSliderInput
            label="Trajectory Smoothness"
            value={smoothness}
            min={0}
            max={100}
            step={5}
            unit="%"
            accentColor="#FFFFFF"
            onChange={(val) => {
              setSmoothness(val);
              syncTracking({ smoothness: val });
            }}
            containerStyle={styles.compactSliderWrap}
          />
        </View>

        {/* Confirm / Apply Tracking Button */}
        <TouchableOpacity
          style={[styles.doneActionBtn, isSmallScreen && { paddingVertical: 8.5 }]}
          onPress={handleDone}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={isSmallScreen ? 15 : 16} color="#08090E" />
          <Text style={[styles.doneActionBtnText, isSmallScreen && { fontSize: 11.5 }]}>
            {hasTrajectory ? (isSmallScreen ? "APPLY & DONE" : "APPLY TRACKING & DONE") : "DONE"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME_COLORS.cardBackground || "#1B1C20",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingTop: 10,
    maxHeight: 440,
  },
  inlineSheetContainer: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 10,
    paddingTop: 0,
    maxHeight: undefined,
    flex: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  inlineStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginBottom: 4,
  },
  inlineStatusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  statusDotActive: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusBadgeText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadgeIdle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  statusDotIdle: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#64748B",
  },
  statusBadgeIdleText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  clearBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#EF4444",
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  elementHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181A",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  elementIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  elementInfoCol: {
    flex: 1,
    justifyContent: "center",
  },
  elementTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  elementSubtitle: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 1,
  },
  elementTipCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  elementTipText: {
    flex: 1,
    color: "#94A3B8",
    fontSize: 10.5,
    lineHeight: 14,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: THEME_COLORS.surface || "#18181A",
    borderRadius: 8,
    padding: 2,
    marginVertical: 6,
    gap: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  tabText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#00F2FE",
    fontWeight: "600",
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingBottom: Platform.OS === "ios" ? 72 : 48,
  },
  scanningCard: {
    backgroundColor: "#18181A",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 6,
  },
  scanningHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  scanningLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scanningTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  scanningPercent: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  cancelScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  cancelScanText: {
    color: "#EF4444",
    fontSize: 10.5,
    fontWeight: "700",
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  startTrackBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 9,
    borderRadius: 8,
  },
  retrackBtn: {
    backgroundColor: "#FFFFFF",
  },
  startTrackBtnText: {
    color: "#121214",
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  bakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  bakeBtnSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  bakeBtnText: {
    color: "#EDEDED",
    fontSize: 10.5,
    fontWeight: "700",
  },
  bakeBtnTextSuccess: {
    color: "#10B981",
  },
  tabContentSection: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
    padding: 7,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  styleSegmentRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  segmentBtnActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  segmentText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#00F2FE",
    fontWeight: "600",
  },
  compactSliderWrap: {
    marginVertical: 0,
    paddingVertical: 0,
  },
  emptyClipsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginBottom: 6,
  },
  emptyClipsText: {
    flex: 1,
    color: "#94A3B8",
    fontSize: 10.5,
    lineHeight: 14,
  },
  pinVerticalContainer: {
    marginBottom: 8,
  },
  pinSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  pinSectionTitle: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  pinDetachText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "600",
  },
  pinVerticalList: {
    flexDirection: "column",
    gap: 5,
  },
  pinClipRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  pinClipRowActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  pinClipIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  pinClipIconWrapActive: {
    backgroundColor: "#27272A",
  },
  pinClipInfo: {
    flex: 1,
    justifyContent: "center",
  },
  pinClipLabel: {
    color: "#E2E8F0",
    fontSize: 11.5,
    fontWeight: "600",
  },
  pinClipLabelActive: {
    color: "#00F2FE",
    fontWeight: "600",
  },
  pinClipSubtext: {
    color: "#64748B",
    fontSize: 9.5,
    marginTop: 1,
  },
  pinRadioIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  pinRadioIndicatorActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 6,
  },
  togglePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  togglePillActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  togglePillText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
  },
  togglePillTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  cameraInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  cameraInfoDesc: {
    flex: 1,
    color: "#CBD5E1",
    fontSize: 11,
    lineHeight: 15,
  },
  afterTrackingSection: {
    marginTop: 10,
    backgroundColor: "#16181F",
    borderRadius: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  afterTrackingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  afterTrackingTitle: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  trackedBadgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  trackedBadgeTextActive: {
    color: "#10B981",
    fontSize: 9.5,
    fontWeight: "700",
  },
  trackedBadgeIdle: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  trackedBadgeTextIdle: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "600",
  },
  elementActionNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderColor: "rgba(0, 242, 254, 0.2)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  elementActionNoticeText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "600",
    flex: 1,
  },
  bakeSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  bakeInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bakeTitle: {
    color: "#EDEDED",
    fontSize: 11,
    fontWeight: "700",
  },
  bakeSubtitle: {
    color: "#64748B",
    fontSize: 9.5,
    marginTop: 1,
  },
  bakeActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F2937",
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bakeActionBtnSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  bakeActionBtnText: {
    color: "#EDEDED",
    fontSize: 10.5,
    fontWeight: "600",
  },
  bakeActionBtnTextSuccess: {
    color: "#10B981",
    fontWeight: "700",
  },
  doneActionBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00F2FE",
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  doneActionBtnText: {
    color: "#08090E",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  resetTrackActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  resetTrackActionBtnText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
  },
  headerResetPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  headerResetPillText: {
    color: "#EF4444",
    fontSize: 9.5,
    fontWeight: "700",
  },
});
