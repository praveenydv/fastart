import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
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

interface MotionTrackingModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  targetType?: "text" | "sticker" | "overlay" | "video";
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
  const isElementClip = targetType === "text" || targetType === "sticker" || targetType === "overlay";
  // Primary States
  const [enabled, setEnabled] = useState<boolean>(
    currentTrack?.enabled || false,
  );
  const [activeTab, setActiveTab] = useState<"censor" | "pin" | "camera">(
    currentTrack?.actionType === "camera_center"
      ? "camera"
      : currentTrack?.actionType === "pin_element"
      ? "pin"
      : "censor"
  );

  // Target Reticle
  const [targetRect, setTargetRect] = useState<TrackingRect>(
    currentTrack?.targetRect || { x: 35, y: 25, width: 30, height: 30 },
  );

  // Operations
  const [actionType, setActionType] = useState<TrackingActionType>(
    currentTrack?.actionType || "mosaic_censor",
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

  // Tracking Progress & Trajectory
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusText, setScanStatusText] = useState<string>("");
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>(
    currentTrack?.trajectory || [],
  );
  const [bakedSuccess, setBakedSuccess] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (visible && currentTrack) {
      setEnabled(currentTrack.enabled || false);
      if (currentTrack.targetRect) setTargetRect(currentTrack.targetRect);
      if (currentTrack.actionType) {
        setActionType(currentTrack.actionType);
        if (currentTrack.actionType === "camera_center") setActiveTab("camera");
        else if (currentTrack.actionType === "pin_element") setActiveTab("pin");
        else setActiveTab("censor");
      }
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
      if (currentTrack.trajectory) setTrajectory(currentTrack.trajectory);
    }
  }, [visible, currentTrack]);

  // Synchronize updates to parent clip
  const syncTracking = useCallback(
    (overrides?: Partial<MotionTrackConfig>) => {
      const config: MotionTrackConfig = {
        enabled: overrides?.enabled !== undefined ? overrides.enabled : enabled,
        mode: "object_track",
        intensity: overrides?.smoothness !== undefined ? overrides.smoothness : smoothness,
        targetRect: overrides?.targetRect || targetRect,
        trajectory: overrides?.trajectory || trajectory,
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
        anchorTime: overrides?.anchorTime !== undefined ? overrides.anchorTime : currentTrack?.anchorTime,
        trackingStatus:
          overrides?.trackingStatus ||
          ((overrides?.trajectory || trajectory).length > 0 ? "completed" : "idle"),
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
        if (changed) {
          updateProjectWithHistory(proj);
        }
      }
    },
    [
      enabled,
      smoothness,
      targetRect,
      trajectory,
      actionType,
      pinnedClipId,
      trackScale,
      trackRotation,
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
        sampleFps: 12,
        smoothness,
        trackScale,
        trackRotation,
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

      const effectiveActionType = isElementClip ? "pin_element" : actionType;
      const effectivePinnedId = isElementClip ? selectedClip.id : pinnedClipId;

      syncTracking({
        enabled: true,
        trajectory: generatedTrajectory,
        targetRect,
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
      setIsScanning(false);
      syncTracking({ trackingStatus: trajectory.length > 0 ? "completed" : "idle" });
    }
  }, [
    isElementClip,
    currentTime,
    selectedClip,
    project,
    targetRect,
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
    }
    setIsScanning(false);
    triggerHaptic("warning");
    syncTracking({ trackingStatus: trajectory.length > 0 ? "completed" : "idle" });
  }, [trajectory.length, syncTracking]);

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

  const handleReset = useCallback(() => {
    triggerHaptic("selection");
    setEnabled(false);
    setTrajectory([]);
    syncTracking({
      enabled: false,
      trajectory: [],
      pinnedClipId: "",
      actionType: "mosaic_censor",
      trackingStatus: "idle",
    });
  }, [syncTracking]);

  const hasTrajectory = trajectory && trajectory.length > 0;

  if (!visible) return null;

  return (
    <View style={[styles.container, isInline && styles.inlineSheetContainer]}>
      {/* Header for standalone modal */}
      {!isInline && (
        <View style={styles.sheetHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="scan-outline" size={15} color={THEME_COLORS.accent} />
            </View>
            <Text style={styles.sheetTitle}>Motion Tracking</Text>
            {hasTrajectory && (
              <View style={styles.statusBadge}>
                <View style={styles.statusDotActive} />
                <Text style={styles.statusBadgeText}>{trajectory.length} pts</Text>
              </View>
            )}
          </View>

          <View style={styles.headerRight}>
            {hasTrajectory && (
              <TouchableOpacity
                onPress={handleReset}
                style={styles.clearBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="trash-outline" size={12} color="#EF4444" style={{ marginRight: 3 }} />
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="close" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
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
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
              color={THEME_COLORS.accent}
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

      {/* Mode Switcher Tabs for Main Video Clip */}
      {!isElementClip && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "censor" && styles.tabBtnActive]}
            onPress={() => {
              triggerHaptic("selection");
              setActiveTab("censor");
              setActionType("mosaic_censor");
              syncTracking({ actionType: "mosaic_censor", enabled: true });
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="eye-off-outline"
              size={13}
              color={activeTab === "censor" ? THEME_COLORS.accent : "#94A3B8"}
            />
            <Text style={[styles.tabText, activeTab === "censor" && styles.tabTextActive]}>
              Censor Blur
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "pin" && styles.tabBtnActive]}
            onPress={() => {
              triggerHaptic("selection");
              setActiveTab("pin");
              setActionType("pin_element");
              syncTracking({ actionType: "pin_element", enabled: true });
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="attach-outline"
              size={13}
              color={activeTab === "pin" ? THEME_COLORS.accent : "#94A3B8"}
            />
            <Text style={[styles.tabText, activeTab === "pin" && styles.tabTextActive]}>
              Pin Element
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "camera" && styles.tabBtnActive]}
            onPress={() => {
              triggerHaptic("selection");
              setActiveTab("camera");
              setActionType("camera_center");
              syncTracking({ actionType: "camera_center", enabled: true });
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="videocam-outline"
              size={13}
              color={activeTab === "camera" ? THEME_COLORS.accent : "#94A3B8"}
            />
            <Text style={[styles.tabText, activeTab === "camera" && styles.tabTextActive]}>
              Lock Camera
            </Text>
          </TouchableOpacity>
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
                <ActivityIndicator size="small" color={THEME_COLORS.accent} />
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
            <TouchableOpacity
              style={[styles.startTrackBtn, hasTrajectory && styles.retrackBtn]}
              onPress={handleStartTracking}
              activeOpacity={0.8}
            >
              <Ionicons
                name={hasTrajectory ? "refresh" : "scan"}
                size={14}
                color="#000000"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.startTrackBtnText}>
                {hasTrajectory ? "RE-TRACK TARGET" : "START TRACKING"}
              </Text>
            </TouchableOpacity>

            {hasTrajectory && (
              <TouchableOpacity
                style={[styles.bakeBtn, bakedSuccess && styles.bakeBtnSuccess]}
                onPress={handleBakeKeyframes}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={bakedSuccess ? "checkmark-circle" : "key-outline"}
                  size={13}
                  color={bakedSuccess ? "#10B981" : THEME_COLORS.accent}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.bakeBtnText, bakedSuccess && styles.bakeBtnTextSuccess]}>
                  {bakedSuccess ? "Baked!" : "Bake Keyframes"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ELEMENT FOLLOW CONTROLS (for Text, Sticker, PIP Overlay) */}
        {isElementClip && (
          <View style={{ marginBottom: 6 }}>
            <View style={styles.elementTipCard}>
              <Ionicons name="scan-outline" size={13} color={THEME_COLORS.accent} style={{ marginRight: 6 }} />
              <Text style={styles.elementTipText}>
                Position the green box on video player over the subject to follow.
              </Text>
            </View>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.togglePill, trackScale && styles.togglePillActive]}
                onPress={() => {
                  triggerHaptic("selection");
                  const nextVal = !trackScale;
                  setTrackScale(nextVal);
                  syncTracking({ trackScale: nextVal });
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={trackScale ? "checkbox" : "square-outline"}
                  size={15}
                  color={trackScale ? THEME_COLORS.accent : "#64748B"}
                />
                <Text style={[styles.togglePillText, trackScale && styles.togglePillTextActive]}>
                  Follow Scale
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
              >
                <Ionicons
                  name={trackRotation ? "checkbox" : "square-outline"}
                  size={15}
                  color={trackRotation ? THEME_COLORS.accent : "#64748B"}
                />
                <Text style={[styles.togglePillText, trackRotation && styles.togglePillTextActive]}>
                  Follow Tilt
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MAIN VIDEO TRACKING MODES */}
        {!isElementClip && activeTab === "censor" && (
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
              >
                <Ionicons
                  name="square-outline"
                  size={14}
                  color={mosaicShape === "rectangle" ? THEME_COLORS.accent : "#94A3B8"}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.segmentText, mosaicShape === "rectangle" && styles.segmentTextActive]}>
                  Rectangle Box
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
              >
                <Ionicons
                  name="ellipse-outline"
                  size={14}
                  color={mosaicShape === "circle" ? THEME_COLORS.accent : "#94A3B8"}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.segmentText, mosaicShape === "circle" && styles.segmentTextActive]}>
                  Circle / Oval
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
              >
                <Ionicons
                  name="water-outline"
                  size={14}
                  color={mosaicStyle === "blur" ? THEME_COLORS.accent : "#94A3B8"}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.segmentText, mosaicStyle === "blur" && styles.segmentTextActive]}>
                  Gaussian Blur
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
              >
                <Ionicons
                  name="grid-outline"
                  size={14}
                  color={mosaicStyle === "pixelate" ? THEME_COLORS.accent : "#94A3B8"}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.segmentText, mosaicStyle === "pixelate" && styles.segmentTextActive]}>
                  Pixelate Mosaic
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
              layout="inline"
              accentColor={THEME_COLORS.accent}
              onChange={(val) => {
                setMosaicRadius(val);
                syncTracking({ mosaicRadius: val });
              }}
              containerStyle={styles.compactSliderWrap}
            />
          </View>
        )}

        {/* TAB 2: PIN ELEMENT */}
        {!isElementClip && activeTab === "pin" && (
          <View style={styles.tabContentSection}>
            {availableClipsToPin.length === 0 ? (
              <View style={styles.emptyClipsBox}>
                <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
                <Text style={styles.emptyClipsText}>
                  Add a Text, Sticker, or PIP Video to pin to this moving target.
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

                <View style={styles.pinVerticalList}>
                  {availableClipsToPin.map((c) => {
                    const isSelected = pinnedClipId === c.id;
                    const layerTag =
                      c.type === "text"
                        ? "Text Layer"
                        : c.type === "sticker"
                        ? "Sticker Layer"
                        : "Video Overlay";
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.pinClipRow, isSelected && styles.pinClipRowActive]}
                        onPress={() => {
                          triggerHaptic("selection");
                          const nextId = isSelected ? "" : c.id;
                          setPinnedClipId(nextId);
                          setActionType("pin_element");
                          syncTracking({
                            pinnedClipId: nextId,
                            actionType: "pin_element",
                            enabled: true,
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.pinClipIconWrap, isSelected && styles.pinClipIconWrapActive]}>
                          <Ionicons
                            name={c.icon as any}
                            size={14}
                            color={isSelected ? THEME_COLORS.accent : "#94A3B8"}
                          />
                        </View>
                        <View style={styles.pinClipInfo}>
                          <Text
                            style={[styles.pinClipLabel, isSelected && styles.pinClipLabelActive]}
                            numberOfLines={1}
                          >
                            {c.label}
                          </Text>
                          <Text style={styles.pinClipSubtext}>{layerTag}</Text>
                        </View>
                        <View style={[styles.pinRadioIndicator, isSelected && styles.pinRadioIndicatorActive]}>
                          {isSelected ? (
                            <Ionicons
                              name="checkmark"
                              size={12}
                              color="#000000"
                            />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Scale & Tilt Toggles in 2 compact columns */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.togglePill, trackScale && styles.togglePillActive]}
                onPress={() => {
                  triggerHaptic("selection");
                  const nextVal = !trackScale;
                  setTrackScale(nextVal);
                  syncTracking({ trackScale: nextVal });
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={trackScale ? "checkbox" : "square-outline"}
                  size={15}
                  color={trackScale ? THEME_COLORS.accent : "#64748B"}
                />
                <Text style={[styles.togglePillText, trackScale && styles.togglePillTextActive]}>
                  Follow Scale
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
              >
                <Ionicons
                  name={trackRotation ? "checkbox" : "square-outline"}
                  size={15}
                  color={trackRotation ? THEME_COLORS.accent : "#64748B"}
                />
                <Text style={[styles.togglePillText, trackRotation && styles.togglePillTextActive]}>
                  Follow Tilt
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 3: CAMERA LOCK */}
        {!isElementClip && activeTab === "camera" && (
          <View style={styles.tabContentSection}>
            <View style={styles.cameraInfoCard}>
              <Ionicons name="videocam" size={16} color={THEME_COLORS.accent} style={{ marginRight: 8 }} />
              <Text style={styles.cameraInfoDesc}>
                Locks player camera onto tracked subject. Auto-centers screen and scales to eliminate canvas borders.
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
              >
                <Ionicons
                  name={cameraFitToScreen ? "checkbox" : "square-outline"}
                  size={15}
                  color={cameraFitToScreen ? THEME_COLORS.accent : "#64748B"}
                />
                <Text style={[styles.togglePillText, cameraFitToScreen && styles.togglePillTextActive]}>
                  Fit to Screen
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
              >
                <Ionicons
                  name={cameraLockCenter ? "checkbox" : "square-outline"}
                  size={15}
                  color={cameraLockCenter ? THEME_COLORS.accent : "#64748B"}
                />
                <Text style={[styles.togglePillText, cameraLockCenter && styles.togglePillTextActive]}>
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
                  layout="inline"
                  accentColor={THEME_COLORS.accent}
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

        {/* Motion Smoothness Slider */}
        <View style={styles.tabContentSection}>
          <CompactSliderInput
            label="Smoothness"
            value={smoothness}
            min={0}
            max={100}
            step={5}
            unit="%"
            layout="inline"
            accentColor={THEME_COLORS.accent}
            onChange={(val) => {
              setSmoothness(val);
              syncTracking({ smoothness: val });
            }}
            containerStyle={styles.compactSliderWrap}
          />
        </View>

        <View style={{ height: 16 }} />
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
    backgroundColor: "rgba(0, 229, 201, 0.12)",
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
    backgroundColor: "rgba(0, 229, 201, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 201, 0.25)",
  },
  elementIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(0, 229, 201, 0.16)",
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
    backgroundColor: "rgba(0, 229, 201, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 201, 0.4)",
  },
  tabText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  tabTextActive: {
    color: THEME_COLORS.accent || "#00E5C9",
    fontWeight: "700",
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingBottom: 10,
  },
  scanningCard: {
    backgroundColor: "rgba(0, 229, 201, 0.06)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 201, 0.25)",
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
    color: THEME_COLORS.accent || "#00E5C9",
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
    backgroundColor: THEME_COLORS.accent || "#00E5C9",
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
    backgroundColor: THEME_COLORS.accent || "#00E5C9",
    paddingVertical: 8,
    borderRadius: 7,
  },
  retrackBtn: {
    backgroundColor: THEME_COLORS.accent || "#00E5C9",
  },
  startTrackBtnText: {
    color: "#000000",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.3,
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
    color: THEME_COLORS.accent || "#00E5C9",
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
    backgroundColor: "rgba(0, 229, 201, 0.12)",
    borderColor: "rgba(0, 229, 201, 0.4)",
  },
  segmentText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: THEME_COLORS.accent || "#00E5C9",
    fontWeight: "700",
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
    backgroundColor: "rgba(0, 229, 201, 0.10)",
    borderColor: "rgba(0, 229, 201, 0.4)",
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
    backgroundColor: "rgba(0, 229, 201, 0.18)",
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
    color: THEME_COLORS.accent || "#00E5C9",
    fontWeight: "700",
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
    backgroundColor: THEME_COLORS.accent || "#00E5C9",
    borderColor: THEME_COLORS.accent || "#00E5C9",
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
    backgroundColor: "rgba(0, 229, 201, 0.08)",
    borderColor: "rgba(0, 229, 201, 0.25)",
  },
  togglePillText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
  },
  togglePillTextActive: {
    color: "#E2E8F0",
    fontWeight: "700",
  },
  cameraInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0, 229, 201, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 201, 0.18)",
  },
  cameraInfoDesc: {
    flex: 1,
    color: "#CBD5E1",
    fontSize: 11,
    lineHeight: 15,
  },
});
