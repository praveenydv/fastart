import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MotionTrackConfig,
  TrackingRect,
  TrackingActionType,
  TrajectoryPoint,
  FastArtProject,
  VideoClip,
} from "../../types/project";
import { soundEngine } from "../../utils/audioEngine";
import { ObjectTrackerEngine } from "../../utils/objectTrackerEngine";

interface MotionTrackingModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  targetType: "text" | "sticker" | "video";
  currentTrack?: MotionTrackConfig;
  onApplyTracking: (config: MotionTrackConfig) => void;
  isInline?: boolean;
  project?: FastArtProject;
  selectedClip?: any;
  updateProjectWithHistory?: (proj: FastArtProject) => void;
}

const WebInput: any = Platform.OS === "web" ? "input" : View;

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
  updateProjectWithHistory,
}: MotionTrackingModalProps) {
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
      if (currentTrack.smoothness !== undefined) setSmoothness(currentTrack.smoothness);
      if (currentTrack.trajectory) setTrajectory(currentTrack.trajectory);
    }
  }, [visible, currentTrack]);

  // Synchronize updates to parent clip
  const syncTracking = (overrides?: Partial<MotionTrackConfig>) => {
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
      smoothness: overrides?.smoothness !== undefined ? overrides.smoothness : smoothness,
      trackingStatus: (overrides?.trajectory || trajectory).length > 0 ? "completed" : "idle",
      lastTrackedAt: Date.now(),
    };

    onApplyTracking(config);
  };

  // Find candidate clips in project that can be pinned
  const availableClipsToPin = React.useMemo(() => {
    if (!project) return [];
    const list: { id: string; label: string; icon: string; type: string }[] = [];

    (project.tracks.text || []).forEach((t) => {
      list.push({
        id: t.id,
        label: `Text: "${t.text.slice(0, 16)}${t.text.length > 16 ? "..." : ""}"`,
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
  }, [project, selectedClip]);

  // Quick Preset Selection for Reticle
  const handleSelectPreset = (preset: "face" | "center" | "body" | "wide") => {
    soundEngine.playSfx("click");
    let nextRect: TrackingRect;
    if (preset === "face") {
      nextRect = { x: 35, y: 16, width: 30, height: 32 };
    } else if (preset === "body") {
      nextRect = { x: 35, y: 15, width: 30, height: 68 };
    } else if (preset === "center") {
      nextRect = { x: 35, y: 35, width: 30, height: 30 };
    } else {
      nextRect = { x: 20, y: 20, width: 60, height: 60 };
    }
    setTargetRect(nextRect);
    syncTracking({ targetRect: nextRect });
  };

  // Run Real Computer-Vision Tracking
  const handleStartTracking = async () => {
    soundEngine.playSfx("whoosh");
    setIsScanning(true);
    setScanProgress(0);
    setScanStatusText("Analyzing Video Frames...");

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
        clip: clipToTrack,
        targetRect,
        sampleFps: 12,
        smoothness,
        trackScale,
        trackRotation,
        signal: abortControllerRef.current.signal,
        onProgress: (p) => {
          setScanProgress(p.percent);
          setScanStatusText(p.statusText);
        },
      });

      soundEngine.playSfx("whoosh");
      setTrajectory(generatedTrajectory);
      setEnabled(true);
      setIsScanning(false);
      setScanStatusText("");

      syncTracking({
        enabled: true,
        trajectory: generatedTrajectory,
        targetRect,
        actionType,
      });
    } catch (err) {
      console.warn("[MotionTracking] Tracking error or abort:", err);
      setIsScanning(false);
    }
  };

  const handleCancelTracking = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsScanning(false);
    soundEngine.playSfx("pop");
  };

  const handleBakeKeyframes = () => {
    if (!trajectory || trajectory.length === 0 || !project || !updateProjectWithHistory) {
      return;
    }
    soundEngine.playSfx("whoosh");

    const targetClip = selectedClip;
    const baseTransform = targetClip?.transform || {};
    const keyframes = ObjectTrackerEngine.bakeTrajectoryToKeyframes(
      trajectory,
      baseTransform,
      targetClip?.duration || 5,
      0.2,
    );

    const currentProj = { ...project };
    let found = false;

    const videos = [...(currentProj.tracks.video || [])];
    const vIdx = videos.findIndex((v) => v.id === targetClip?.id);
    if (vIdx >= 0) {
      videos[vIdx] = { ...videos[vIdx], keyframes };
      currentProj.tracks = { ...currentProj.tracks, video: videos };
      found = true;
    }

    if (!found) {
      const texts = [...(currentProj.tracks.text || [])];
      const tIdx = texts.findIndex((t) => t.id === targetClip?.id);
      if (tIdx >= 0) {
        texts[tIdx] = { ...texts[tIdx], keyframes };
        currentProj.tracks = { ...currentProj.tracks, text: texts };
        found = true;
      }
    }

    if (!found) {
      const stickers = [...(currentProj.tracks.stickers || [])];
      const sIdx = stickers.findIndex((s) => s.id === targetClip?.id);
      if (sIdx >= 0) {
        stickers[sIdx] = { ...stickers[sIdx], keyframes };
        currentProj.tracks = { ...currentProj.tracks, stickers };
        found = true;
      }
    }

    if (found) {
      updateProjectWithHistory(currentProj);
      setBakedSuccess(true);
      setTimeout(() => setBakedSuccess(false), 3000);
    }
  };

  const handleReset = () => {
    soundEngine.playSfx("click");
    setEnabled(false);
    setTrajectory([]);
    syncTracking({
      enabled: false,
      trajectory: [],
      pinnedClipId: "",
      actionType: "mosaic_censor",
    });
  };

  const hasTrajectory = trajectory && trajectory.length > 0;

  const content = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Header (when modal) */}
      {!isInline && (
        <View style={styles.sheetHeader}>
          <View style={styles.titleRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="scan-outline" size={16} color="#00F2FE" />
            </View>
            <Text style={styles.sheetTitle}>Object Tracking & Blur</Text>
            {hasTrajectory && (
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                <Text style={styles.statusBadgeText}>{trajectory.length} PTS</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {hasTrajectory && (
              <TouchableOpacity
                onPress={handleReset}
                style={styles.resetBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={12} color="#EF4444" style={{ marginRight: 3 }} />
                <Text style={[styles.resetText, { color: "#EF4444" }]}>Clear</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onClose} style={styles.doneBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Mode Switcher Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "censor" && styles.tabBtnActive]}
          onPress={() => {
            soundEngine.playSfx("click");
            setActiveTab("censor");
            setActionType("mosaic_censor");
            syncTracking({ actionType: "mosaic_censor", enabled: true });
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="eye-off-outline"
            size={14}
            color={activeTab === "censor" ? "#00F2FE" : "#94A3B8"}
          />
          <Text style={[styles.tabText, activeTab === "censor" && styles.tabTextActive]}>
            Censor Blur
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "pin" && styles.tabBtnActive]}
          onPress={() => {
            soundEngine.playSfx("click");
            setActiveTab("pin");
            setActionType("pin_element");
            syncTracking({ actionType: "pin_element", enabled: true });
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="attach"
            size={14}
            color={activeTab === "pin" ? "#00F2FE" : "#94A3B8"}
          />
          <Text style={[styles.tabText, activeTab === "pin" && styles.tabTextActive]}>
            Pin Element
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "camera" && styles.tabBtnActive]}
          onPress={() => {
            soundEngine.playSfx("click");
            setActiveTab("camera");
            setActionType("camera_center");
            syncTracking({ actionType: "camera_center", enabled: true });
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="videocam-outline"
            size={14}
            color={activeTab === "camera" ? "#00F2FE" : "#94A3B8"}
          />
          <Text style={[styles.tabText, activeTab === "camera" && styles.tabTextActive]}>
            Camera Lock
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
        {/* Reticle Guide Card */}
        <View style={styles.reticleGuideCard}>
          <View style={styles.guideTextRow}>
            <Ionicons name="expand-outline" size={14} color="#00F2FE" />
            <Text style={styles.guideTitle}>Frame Subject on Player</Text>
          </View>
          <Text style={styles.guideDesc}>
            Drag or resize the cyan box on the player to cover the moving object or face.
          </Text>

          {/* Quick Snap Presets */}
          <View style={styles.presetPillsRow}>
            <TouchableOpacity
              style={styles.presetPill}
              onPress={() => handleSelectPreset("face")}
              activeOpacity={0.7}
            >
              <Ionicons name="person-outline" size={12} color="#94A3B8" />
              <Text style={styles.presetPillText}>Face</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetPill}
              onPress={() => handleSelectPreset("body")}
              activeOpacity={0.7}
            >
              <Ionicons name="body-outline" size={12} color="#94A3B8" />
              <Text style={styles.presetPillText}>Person</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetPill}
              onPress={() => handleSelectPreset("center")}
              activeOpacity={0.7}
            >
              <Ionicons name="disc-outline" size={12} color="#94A3B8" />
              <Text style={styles.presetPillText}>Center</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetPill}
              onPress={() => handleSelectPreset("wide")}
              activeOpacity={0.7}
            >
              <Ionicons name="scan-outline" size={12} color="#94A3B8" />
              <Text style={styles.presetPillText}>Wide</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scanning Progress HUD when active */}
        {isScanning && (
          <View style={styles.scanningCard}>
            <View style={styles.scanningHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color="#00F2FE" />
                <Text style={styles.scanningTitle}>Tracking Target...</Text>
              </View>
              <Text style={styles.scanningPercent}>{scanProgress}%</Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${scanProgress}%` }]} />
            </View>

            <Text style={styles.scanningDesc}>{scanStatusText}</Text>

            <TouchableOpacity
              style={styles.cancelScanBtn}
              onPress={handleCancelTracking}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.cancelScanText}>Cancel Tracking</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Primary Action Button (Start / Re-Track) */}
        {!isScanning && (
          <View style={styles.actionBtnRow}>
            <TouchableOpacity
              style={[styles.startTrackBtn, hasTrajectory && styles.retrackBtn]}
              onPress={handleStartTracking}
              activeOpacity={0.8}
            >
              <Ionicons
                name={hasTrajectory ? "refresh" : "scan"}
                size={16}
                color="#0D0E15"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.startTrackBtnText}>
                {hasTrajectory ? "RE-TRACK SUBJECT" : "START TRACKING"}
              </Text>
            </TouchableOpacity>

            {hasTrajectory && (
              <TouchableOpacity
                style={styles.bakeBtn}
                onPress={handleBakeKeyframes}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={bakedSuccess ? "checkmark-circle" : "key-outline"}
                  size={15}
                  color={bakedSuccess ? "#10B981" : "#00F2FE"}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.bakeBtnText, bakedSuccess && { color: "#10B981" }]}>
                  {bakedSuccess ? "Baked!" : "Bake Keyframes"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* TAB 1: CENSOR BLUR */}
        {activeTab === "censor" && (
          <View style={styles.tabContentSection}>
            <Text style={styles.sectionHeader}>CENSOR STYLE</Text>
            <View style={styles.styleSegmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, mosaicStyle === "blur" && styles.segmentBtnActive]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setMosaicStyle("blur");
                  syncTracking({ mosaicStyle: "blur" });
                }}
              >
                <Ionicons
                  name="water-outline"
                  size={16}
                  color={mosaicStyle === "blur" ? "#00F2FE" : "#94A3B8"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.segmentText, mosaicStyle === "blur" && styles.segmentTextActive]}>
                  Gaussian Blur
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, mosaicStyle === "pixelate" && styles.segmentBtnActive]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setMosaicStyle("pixelate");
                  syncTracking({ mosaicStyle: "pixelate" });
                }}
              >
                <Ionicons
                  name="grid-outline"
                  size={16}
                  color={mosaicStyle === "pixelate" ? "#00F2FE" : "#94A3B8"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.segmentText, mosaicStyle === "pixelate" && styles.segmentTextActive]}>
                  Pixelate Mosaic
                </Text>
              </TouchableOpacity>
            </View>

            {/* Radius / Blur Strength Slider */}
            <View style={styles.sliderSection}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Blur Intensity / Radius</Text>
                <Text style={styles.sliderVal}>{mosaicRadius}px</Text>
              </View>
              {Platform.OS === "web" ? (
                <WebInput
                  type="range"
                  min="6"
                  max="48"
                  value={mosaicRadius}
                  onChange={(e: any) => {
                    const val = Number(e.target.value);
                    setMosaicRadius(val);
                    syncTracking({ mosaicRadius: val });
                  }}
                  style={styles.webRange}
                />
              ) : null}
            </View>
          </View>
        )}

        {/* TAB 2: PIN ELEMENT */}
        {activeTab === "pin" && (
          <View style={styles.tabContentSection}>
            <Text style={styles.sectionHeader}>SELECT OVERLAY TO FOLLOW TARGET</Text>
            {availableClipsToPin.length === 0 ? (
              <View style={styles.emptyClipsBox}>
                <Ionicons name="information-circle-outline" size={18} color="#94A3B8" />
                <Text style={styles.emptyClipsText}>
                  Add a Text layer, Sticker, or Picture-in-Picture video to pin it to this object.
                </Text>
              </View>
            ) : (
              <View style={styles.pinnedClipsGrid}>
                {availableClipsToPin.map((c) => {
                  const isSelected = pinnedClipId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.pinClipCard, isSelected && styles.pinClipCardActive]}
                      onPress={() => {
                        soundEngine.playSfx("click");
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
                      <Ionicons
                        name={c.icon as any}
                        size={15}
                        color={isSelected ? "#00F2FE" : "#94A3B8"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[styles.pinClipLabel, isSelected && styles.pinClipLabelActive]}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={14} color="#00F2FE" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Scale Toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Track Distance / Scale</Text>
                <Text style={styles.toggleDesc}>Element scales as target moves closer</Text>
              </View>
              <TouchableOpacity
                style={[styles.switchTrack, trackScale && styles.switchTrackActive]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  const nextVal = !trackScale;
                  setTrackScale(nextVal);
                  syncTracking({ trackScale: nextVal });
                }}
              >
                <View style={[styles.switchThumb, trackScale && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            {/* Rotation Toggle (Default OFF) */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Track Tilt / Rotation</Text>
                <Text style={styles.toggleDesc}>Keep OFF for upright, stable text & stickers</Text>
              </View>
              <TouchableOpacity
                style={[styles.switchTrack, trackRotation && styles.switchTrackActive]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  const nextVal = !trackRotation;
                  setTrackRotation(nextVal);
                  syncTracking({ trackRotation: nextVal });
                }}
              >
                <View style={[styles.switchThumb, trackRotation && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 3: CAMERA LOCK */}
        {activeTab === "camera" && (
          <View style={styles.tabContentSection}>
            <View style={styles.cameraInfoCard}>
              <Ionicons name="videocam" size={20} color="#00F2FE" style={{ marginBottom: 6 }} />
              <Text style={styles.cameraInfoTitle}>Camera Follow Mode</Text>
              <Text style={styles.cameraInfoDesc}>
                This stabilizes the camera by actively moving the video frame to keep the tracked subject locked in the center of the screen.
              </Text>
            </View>
          </View>
        )}

        {/* Motion Smoothness Slider */}
        <View style={styles.tabContentSection}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Motion Jitter Reduction (Smoothness)</Text>
            <Text style={styles.sliderVal}>{smoothness}%</Text>
          </View>
          {Platform.OS === "web" ? (
            <WebInput
              type="range"
              min="0"
              max="100"
              value={smoothness}
              onChange={(e: any) => {
                const val = Number(e.target.value);
                setSmoothness(val);
                syncTracking({ smoothness: val });
              }}
              style={styles.webRange}
            />
          ) : null}
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );

  if (!visible) return null;
  return content;
}

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: "#0D0E15",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: 460,
  },
  inlineSheetContainer: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 4,
    maxHeight: undefined,
    flex: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  resetText: {
    fontSize: 11,
    fontWeight: "600",
  },
  doneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 10,
    padding: 3,
    marginVertical: 10,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
  },
  tabText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  sheetBody: {
    flex: 1,
  },
  reticleGuideCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
    marginBottom: 10,
  },
  guideTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  guideTitle: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "700",
  },
  guideDesc: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  presetPillsRow: {
    flexDirection: "row",
    gap: 6,
  },
  presetPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  presetPillText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
  },
  scanningCard: {
    backgroundColor: "rgba(0, 242, 254, 0.06)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.3)",
    marginBottom: 10,
  },
  scanningHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  scanningTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  scanningPercent: {
    color: "#00F2FE",
    fontSize: 13,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 3,
  },
  scanningDesc: {
    color: "#94A3B8",
    fontSize: 11,
    marginBottom: 8,
  },
  cancelScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  cancelScanText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  startTrackBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00F2FE",
    paddingVertical: 10,
    borderRadius: 9,
    shadowColor: "#00F2FE",
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  retrackBtn: {
    backgroundColor: "#00F2FE",
  },
  startTrackBtnText: {
    color: "#0D0E15",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  bakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  bakeBtnText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  tabContentSection: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  sectionHeader: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  styleSegmentRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  segmentBtnActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "rgba(0, 242, 254, 0.4)",
  },
  segmentText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  sliderSection: {
    marginTop: 4,
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sliderLabel: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
  },
  sliderVal: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  webRange: {
    width: "100%",
    ...(Platform.OS === "web" ? ({ accentColor: "#00F2FE", cursor: "pointer" } as any) : {}),
  },
  emptyClipsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginBottom: 8,
  },
  emptyClipsText: {
    flex: 1,
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 15,
  },
  pinnedClipsGrid: {
    gap: 6,
    marginBottom: 10,
  },
  pinClipCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  pinClipCardActive: {
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    borderColor: "rgba(0, 242, 254, 0.35)",
  },
  pinClipLabel: {
    flex: 1,
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
  },
  pinClipLabelActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  toggleTitle: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
  },
  toggleDesc: {
    color: "#64748B",
    fontSize: 10,
    marginTop: 1,
  },
  switchTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    padding: 2,
    justifyContent: "center",
  },
  switchTrackActive: {
    backgroundColor: "#00F2FE",
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  switchThumbActive: {
    transform: [{ translateX: 16 }],
    backgroundColor: "#0D0E15",
  },
  cameraInfoCard: {
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(0, 242, 254, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.2)",
  },
  cameraInfoTitle: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  cameraInfoDesc: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});
