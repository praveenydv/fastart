import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { ClipTransform, CustomCrop } from "../../types/project";

interface TransformModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentTransform?: ClipTransform;
  currentCrop?: CustomCrop;
  initialTab?: "crop" | "flip" | "rotate" | "stretch" | "angle";
  onApplyTransform: (transform: ClipTransform, newAspectRatio?: any) => void;
  onOpenScreenCrop?: () => void;
  isInline?: boolean;
}

const WebDiv: any = Platform.OS === "web" ? "div" : View;
const WebInput: any = Platform.OS === "web" ? "input" : View;

const ASPECT_PRESETS: { label: string; ratio?: number; id: string }[] = [
  { id: "free", label: "Free" },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "2.35:1", label: "2.35:1", ratio: 2.35 },
];

const ROTATION_PRESETS = [0, 90, 180, 270];

const STRETCH_PRESETS = [
  { id: "normal", label: "1:1 Normal", scaleX: 1.0, scaleY: 1.0 },
  { id: "anamorphic", label: "Anamorphic (1.33x)", scaleX: 1.33, scaleY: 1.0 },
  { id: "ultrawide", label: "Ultra-Wide (1.45x)", scaleX: 1.45, scaleY: 1.0 },
  { id: "vertical", label: "Vertical (1.25x)", scaleX: 1.0, scaleY: 1.25 },
  { id: "cinema_squash", label: "Cinema Squash", scaleX: 1.35, scaleY: 0.85 },
  { id: "compact", label: "Compact (0.8x)", scaleX: 0.8, scaleY: 0.8 },
];

const ANGLE_3D_PRESETS = [
  {
    id: "reset",
    label: "Flat View",
    rotateX: 0,
    rotateY: 0,
    skewX: 0,
    perspective: 800,
  },
  {
    id: "distance_road",
    label: "Distance View (Road/Floor)",
    rotateX: 35,
    rotateY: 0,
    skewX: 0,
    perspective: 700,
  },
  {
    id: "distance_deep",
    label: "Deep Distance (Horizon)",
    rotateX: 52,
    rotateY: 0,
    skewX: 0,
    perspective: 600,
  },
  {
    id: "angle_left",
    label: "Left Angle View",
    rotateX: 0,
    rotateY: 30,
    skewX: 0,
    perspective: 800,
  },
  {
    id: "angle_right",
    label: "Right Angle View",
    rotateX: 0,
    rotateY: -30,
    skewX: 0,
    perspective: 800,
  },
  {
    id: "isometric",
    label: "3D Isometric Angle",
    rotateX: 25,
    rotateY: 25,
    skewX: 0,
    perspective: 900,
  },
  {
    id: "billboard",
    label: "Billboard Angle",
    rotateX: 10,
    rotateY: -35,
    skewX: 5,
    perspective: 750,
  },
  {
    id: "overhead",
    label: "Overhead Tilt",
    rotateX: -30,
    rotateY: 0,
    skewX: 0,
    perspective: 800,
  },
];

export default function TransformModal({
  visible,
  onClose,
  onApply,
  currentTransform,
  currentCrop,
  initialTab = "crop",
  onApplyTransform,
  onOpenScreenCrop,
  isInline = false,
}: TransformModalProps) {
  const [activeTab, setActiveTab] = useState<
    "crop" | "flip" | "rotate" | "stretch" | "angle"
  >(initialTab);

  // Crop states
  const [cropWidth, setCropWidth] = useState<number>(currentCrop?.width ?? 100);
  const [cropHeight, setCropHeight] = useState<number>(
    currentCrop?.height ?? 100,
  );
  const [cropX, setCropX] = useState<number>(currentCrop?.x ?? 0);
  const [cropY, setCropY] = useState<number>(currentCrop?.y ?? 0);
  const [selectedRatio, setSelectedRatio] = useState<string>("free");

  // Flip states
  const [flipX, setFlipX] = useState<boolean>(currentTransform?.flipX || false);
  const [flipY, setFlipY] = useState<boolean>(currentTransform?.flipY || false);

  // Rotate states
  const [rotation, setRotation] = useState<number>(
    currentTransform?.rotation ?? 0,
  );

  // Stretch states
  const [scaleX, setScaleX] = useState<number>(currentTransform?.scaleX ?? 1.0);
  const [scaleY, setScaleY] = useState<number>(currentTransform?.scaleY ?? 1.0);
  const [isAspectLinked, setIsAspectLinked] = useState<boolean>(false);

  // 3D Angle & Distance states
  const [rotateX, setRotateX] = useState<number>(
    currentTransform?.rotateX ?? 0,
  ); // Distance view (Pitch)
  const [rotateY, setRotateY] = useState<number>(
    currentTransform?.rotateY ?? 0,
  ); // Angle view (Yaw)
  const [skewX, setSkewX] = useState<number>(currentTransform?.skewX ?? 0); // Angle shear
  const [perspective, setPerspective] = useState<number>(
    currentTransform?.perspective ?? 800,
  ); // 3D depth

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setFlipX(currentTransform?.flipX || false);
      setFlipY(currentTransform?.flipY || false);
      setRotation(currentTransform?.rotation ?? 0);
      setScaleX(currentTransform?.scaleX ?? 1.0);
      setScaleY(currentTransform?.scaleY ?? 1.0);
      setRotateX(currentTransform?.rotateX ?? 0);
      setRotateY(currentTransform?.rotateY ?? 0);
      setSkewX(currentTransform?.skewX ?? 0);
      setPerspective(currentTransform?.perspective ?? 800);

      const c = currentCrop || currentTransform?.crop;
      setCropWidth(c?.width ?? 100);
      setCropHeight(c?.height ?? 100);
      setCropX(c?.x ?? 0);
      setCropY(c?.y ?? 0);
      setSelectedRatio("free");
    }
  }, [visible, currentTransform, currentCrop, initialTab]);

  const syncTransform = (overrides?: {
    crop?: CustomCrop | null;
    flipX?: boolean;
    flipY?: boolean;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    rotateX?: number;
    rotateY?: number;
    skewX?: number;
    perspective?: number;
  }) => {
    const nextFlipX = overrides?.flipX !== undefined ? overrides.flipX : flipX;
    const nextFlipY = overrides?.flipY !== undefined ? overrides.flipY : flipY;
    const nextRotation =
      overrides?.rotation !== undefined ? overrides.rotation : rotation;
    const nextScaleX =
      overrides?.scaleX !== undefined ? overrides.scaleX : scaleX;
    const nextScaleY =
      overrides?.scaleY !== undefined ? overrides.scaleY : scaleY;
    const nextRotateX =
      overrides?.rotateX !== undefined ? overrides.rotateX : rotateX;
    const nextRotateY =
      overrides?.rotateY !== undefined ? overrides.rotateY : rotateY;
    const nextSkewX = overrides?.skewX !== undefined ? overrides.skewX : skewX;
    const nextPerspective =
      overrides?.perspective !== undefined
        ? overrides.perspective
        : perspective;

    let nextCrop: CustomCrop | undefined = undefined;
    if (overrides?.crop !== undefined) {
      if (overrides.crop) nextCrop = overrides.crop;
    } else {
      if (cropWidth < 100 || cropHeight < 100 || cropX > 0 || cropY > 0) {
        nextCrop = {
          x: cropX,
          y: cropY,
          width: cropWidth,
          height: cropHeight,
        };
      }
    }

    onApplyTransform({
      scale: currentTransform?.scale ?? 1.0,
      scaleX: nextScaleX,
      scaleY: nextScaleY,
      rotation: nextRotation,
      rotateX: nextRotateX,
      rotateY: nextRotateY,
      skewX: nextSkewX,
      perspective: nextPerspective,
      x: currentTransform?.x ?? 0,
      y: currentTransform?.y ?? 0,
      flipX: nextFlipX,
      flipY: nextFlipY,
      opacity: currentTransform?.opacity ?? 1.0,
      mask: currentTransform?.mask,
      crop: nextCrop,
    });
  };

  // Dedicated Crop Handlers
  const handleSelectAspectPreset = (preset: (typeof ASPECT_PRESETS)[0]) => {
    soundEngine.playSfx("click");
    setSelectedRatio(preset.id);
    if (!preset.ratio) {
      // Free / original full frame
      setCropWidth(100);
      setCropHeight(100);
      setCropX(0);
      setCropY(0);
      syncTransform({
        crop: { x: 0, y: 0, width: 100, height: 100 },
      });
      return;
    }

    // Fit preset into 100x100 bounding box
    let w = 100;
    let h = 100;
    if (preset.ratio >= 1) {
      w = 100;
      h = Math.round(100 / preset.ratio);
    } else {
      h = 100;
      w = Math.round(100 * preset.ratio);
    }
    const x = Math.round((100 - w) / 2);
    const y = Math.round((100 - h) / 2);

    setCropWidth(w);
    setCropHeight(h);
    setCropX(x);
    setCropY(y);

    syncTransform({
      crop: { x, y, width: w, height: h },
    });
  };

  const handleResetCrop = () => {
    soundEngine.playSfx("pop");
    setCropWidth(100);
    setCropHeight(100);
    setCropX(0);
    setCropY(0);
    setSelectedRatio("free");
    syncTransform({
      crop: { x: 0, y: 0, width: 100, height: 100 },
    });
  };

  const handleApplyCrop = () => {
    soundEngine.playSfx("whoosh");
    syncTransform({
      crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
    });
  };

  // Dedicated Flip Handlers
  const handleToggleFlipX = () => {
    soundEngine.playSfx("click");
    const next = !flipX;
    setFlipX(next);
    syncTransform({ flipX: next });
  };

  const handleToggleFlipY = () => {
    soundEngine.playSfx("click");
    const next = !flipY;
    setFlipY(next);
    syncTransform({ flipY: next });
  };

  const handleResetFlip = () => {
    soundEngine.playSfx("pop");
    setFlipX(false);
    setFlipY(false);
    syncTransform({ flipX: false, flipY: false });
  };

  // Dedicated Rotate Handlers
  const handleRotate90 = () => {
    soundEngine.playSfx("click");
    const next = (Math.round(rotation / 90) * 90 + 90) % 360;
    setRotation(next);
    syncTransform({ rotation: next });
  };

  const handleSelectRotatePreset = (deg: number) => {
    soundEngine.playSfx("click");
    setRotation(deg);
    syncTransform({ rotation: deg });
  };

  const handleResetRotation = () => {
    soundEngine.playSfx("pop");
    setRotation(0);
    syncTransform({ rotation: 0 });
  };

  // Dedicated Stretch Handlers
  const handleSelectStretchPreset = (preset: (typeof STRETCH_PRESETS)[0]) => {
    soundEngine.playSfx("click");
    setScaleX(preset.scaleX);
    setScaleY(preset.scaleY);
    syncTransform({ scaleX: preset.scaleX, scaleY: preset.scaleY });
  };

  const handleResetStretch = () => {
    soundEngine.playSfx("pop");
    setScaleX(1.0);
    setScaleY(1.0);
    syncTransform({ scaleX: 1.0, scaleY: 1.0 });
  };

  const handleUpdateScaleX = (val: number) => {
    const clampedX = Math.max(0.2, Math.min(3.0, Number(val.toFixed(2))));
    setScaleX(clampedX);
    if (isAspectLinked) {
      const clampedY = Math.max(
        0.2,
        Math.min(
          3.0,
          Number((clampedX * (scaleY / Math.max(0.01, scaleX))).toFixed(2)),
        ),
      );
      setScaleY(clampedY);
      syncTransform({ scaleX: clampedX, scaleY: clampedY });
    } else {
      syncTransform({ scaleX: clampedX });
    }
  };

  const handleUpdateScaleY = (val: number) => {
    const clampedY = Math.max(0.2, Math.min(3.0, Number(val.toFixed(2))));
    setScaleY(clampedY);
    if (isAspectLinked) {
      const clampedX = Math.max(
        0.2,
        Math.min(
          3.0,
          Number((clampedY * (scaleX / Math.max(0.01, scaleY))).toFixed(2)),
        ),
      );
      setScaleX(clampedX);
      syncTransform({ scaleX: clampedX, scaleY: clampedY });
    } else {
      syncTransform({ scaleY: clampedY });
    }
  };

  // Dedicated 3D Angle & Distance Handlers
  const handleSelectAnglePreset = (preset: (typeof ANGLE_3D_PRESETS)[0]) => {
    soundEngine.playSfx("click");
    setRotateX(preset.rotateX);
    setRotateY(preset.rotateY);
    setSkewX(preset.skewX);
    setPerspective(preset.perspective);
    syncTransform({
      rotateX: preset.rotateX,
      rotateY: preset.rotateY,
      skewX: preset.skewX,
      perspective: preset.perspective,
    });
  };

  const handleResetAngle = () => {
    soundEngine.playSfx("pop");
    setRotateX(0);
    setRotateY(0);
    setSkewX(0);
    setPerspective(800);
    syncTransform({ rotateX: 0, rotateY: 0, skewX: 0, perspective: 800 });
  };

  const handleApplyAll = () => {
    soundEngine.playSfx("whoosh");
    syncTransform();
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const handleCancel = () => {
    soundEngine.playSfx("pop");
    onClose();
  };

  const sheetContent = (
    <View
      style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}
    >
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Modal Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          style={[
            styles.doneBtn,
            {
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              borderWidth: 1,
              borderColor: "rgba(239, 68, 68, 0.3)",
            },
          ]}
          activeOpacity={0.7}
          accessibilityLabel="Cancel changes"
        >
          <Ionicons name="close" size={17} color="#EF4444" />
        </TouchableOpacity>

        <View style={styles.headerTitleRow}>
          <MaterialCommunityIcons
            name="vector-arrange-below"
            size={18}
            color="#00F2FE"
          />
          <Text style={styles.headerTitle}>Transform</Text>
        </View>

        <TouchableOpacity
          onPress={handleApplyAll}
          style={styles.doneBtn}
          activeOpacity={0.7}
          accessibilityLabel="Apply all transform changes"
        >
          <Ionicons name="checkmark" size={18} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* 5 Main Tabs: Crop, Rotate, Flip, Stretch, 3D Angle */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "crop" && styles.tabBtnActive]}
            onPress={() => {
              soundEngine.playSfx("click");
              setActiveTab("crop");
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="crop"
              size={14}
              color={activeTab === "crop" ? "#000000" : "#8E95A5"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "crop" && styles.tabBtnTextActive,
              ]}
            >
              Crop
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "rotate" && styles.tabBtnActive,
            ]}
            onPress={() => {
              soundEngine.playSfx("click");
              setActiveTab("rotate");
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="reload"
              size={14}
              color={activeTab === "rotate" ? "#000000" : "#8E95A5"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "rotate" && styles.tabBtnTextActive,
              ]}
            >
              Rotate ({Math.round(rotation)}°)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "flip" && styles.tabBtnActive]}
            onPress={() => {
              soundEngine.playSfx("click");
              setActiveTab("flip");
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="flip-horizontal"
              size={15}
              color={activeTab === "flip" ? "#000000" : "#8E95A5"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "flip" && styles.tabBtnTextActive,
              ]}
            >
              Flip
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "stretch" && styles.tabBtnActive,
            ]}
            onPress={() => {
              soundEngine.playSfx("click");
              setActiveTab("stretch");
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="arrow-expand-horizontal"
              size={15}
              color={activeTab === "stretch" ? "#000000" : "#8E95A5"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "stretch" && styles.tabBtnTextActive,
              ]}
            >
              Stretch{" "}
              {scaleX !== 1 || scaleY !== 1 ? `(${scaleX.toFixed(2)}x)` : ""}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "angle" && styles.tabBtnActive,
            ]}
            onPress={() => {
              soundEngine.playSfx("click");
              setActiveTab("angle");
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="cube-outline"
              size={15}
              color={activeTab === "angle" ? "#000000" : "#8E95A5"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "angle" && styles.tabBtnTextActive,
              ]}
            >
              3D Angle{" "}
              {rotateX !== 0 || rotateY !== 0
                ? `(${Math.round(rotateX)}°)`
                : ""}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.contentScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. CROP SECTION */}
        {activeTab === "crop" && (
          <View style={styles.sectionContainer}>
            {/* Aspect Ratio Presets */}
            <Text style={styles.sectionLabel}>Aspect Ratio Presets</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ratioScroll}
            >
              {ASPECT_PRESETS.map((p) => {
                const isSelected = selectedRatio === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.ratioChip,
                      isSelected && styles.ratioChipActive,
                    ]}
                    onPress={() => handleSelectAspectPreset(p)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.ratioChipText,
                        isSelected && styles.ratioChipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Open Interactive Visual Cropper Button */}
            {onOpenScreenCrop ? (
              <TouchableOpacity
                style={styles.screenCropBtn}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenScreenCrop();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="scan-outline" size={17} color="#00F2FE" />
                <Text style={styles.screenCropBtnText}>
                  Open Interactive Visual Crop Tool
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Custom Crop Sliders */}
            <View style={styles.card}>
              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <Text style={styles.sliderLabel}>Width</Text>
                  <Text style={styles.badge}>{cropWidth}%</Text>
                </View>
                {Platform.OS === "web" ? (
                  <WebDiv style={{ margin: "4px 0" }}>
                    <WebInput
                      type="range"
                      min="10"
                      max="100"
                      value={cropWidth}
                      onChange={(e: any) => {
                        const val = parseInt(e.target.value) || 10;
                        setCropWidth(val);
                        setSelectedRatio("custom");
                        syncTransform({
                          crop: {
                            x: cropX,
                            y: cropY,
                            width: val,
                            height: cropHeight,
                          },
                        });
                      }}
                      style={{
                        width: "100%",
                        accentColor: "#00F2FE",
                        height: 4,
                        cursor: "pointer",
                      }}
                    />
                  </WebDiv>
                ) : null}
              </View>

              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <Text style={styles.sliderLabel}>Height</Text>
                  <Text style={styles.badge}>{cropHeight}%</Text>
                </View>
                {Platform.OS === "web" ? (
                  <WebDiv style={{ margin: "4px 0" }}>
                    <WebInput
                      type="range"
                      min="10"
                      max="100"
                      value={cropHeight}
                      onChange={(e: any) => {
                        const val = parseInt(e.target.value) || 10;
                        setCropHeight(val);
                        setSelectedRatio("custom");
                        syncTransform({
                          crop: {
                            x: cropX,
                            y: cropY,
                            width: cropWidth,
                            height: val,
                          },
                        });
                      }}
                      style={{
                        width: "100%",
                        accentColor: "#00F2FE",
                        height: 4,
                        cursor: "pointer",
                      }}
                    />
                  </WebDiv>
                ) : null}
              </View>
            </View>

            {/* Separate Apply & Reset for Crop */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleResetCrop}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
                <Text style={styles.secondaryBtnText}>Reset Crop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleApplyCrop}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#000000" />
                <Text style={styles.primaryActionBtnText}>Apply Crop</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 2. ROTATE SECTION */}
        {activeTab === "rotate" && (
          <View style={styles.sectionContainer}>
            {/* Quick 90 Degree Button */}
            <TouchableOpacity
              style={styles.quickRotateBtn}
              onPress={handleRotate90}
              activeOpacity={0.8}
            >
              <Ionicons name="reload" size={20} color="#00F2FE" />
              <Text style={styles.quickRotateBtnText}>
                Rotate +90° (Current: {Math.round(rotation)}°)
              </Text>
            </TouchableOpacity>

            {/* Quick Rotation Angle Presets */}
            <Text style={styles.sectionLabel}>Angle Presets</Text>
            <View style={styles.rotatePresetsRow}>
              {ROTATION_PRESETS.map((deg) => {
                const isSelected = Math.round(rotation) % 360 === deg;
                return (
                  <TouchableOpacity
                    key={deg}
                    style={[
                      styles.rotatePresetBtn,
                      isSelected && styles.rotatePresetBtnActive,
                    ]}
                    onPress={() => handleSelectRotatePreset(deg)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.rotatePresetBtnText,
                        isSelected && styles.rotatePresetBtnTextActive,
                      ]}
                    >
                      {deg}°
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Fine Angle Slider */}
            <View style={styles.card}>
              <View style={styles.labelValueRow}>
                <Text style={styles.sliderLabel}>Fine Rotation Angle</Text>
                <Text style={styles.badge}>{Math.round(rotation)}°</Text>
              </View>

              {Platform.OS === "web" ? (
                <WebDiv style={{ margin: "8px 0" }}>
                  <WebInput
                    type="range"
                    min="-180"
                    max="180"
                    value={((Math.round(rotation) + 180) % 360) - 180}
                    onChange={(e: any) => {
                      const val = parseInt(e.target.value) || 0;
                      const normalized = (val + 360) % 360;
                      setRotation(normalized);
                      syncTransform({ rotation: normalized });
                    }}
                    style={{
                      width: "100%",
                      accentColor: "#00F2FE",
                      height: 4,
                      cursor: "pointer",
                    }}
                  />
                </WebDiv>
              ) : null}

              {/* Steppers for precise adjustment */}
              <View style={styles.fineTuneRow}>
                <TouchableOpacity
                  style={styles.fineBtn}
                  onPress={() => {
                    const next = (Math.round(rotation) - 5 + 360) % 360;
                    setRotation(next);
                    syncTransform({ rotation: next });
                  }}
                >
                  <Text style={styles.fineBtnText}>-5°</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fineBtn}
                  onPress={() => {
                    const next = (Math.round(rotation) - 1 + 360) % 360;
                    setRotation(next);
                    syncTransform({ rotation: next });
                  }}
                >
                  <Text style={styles.fineBtnText}>-1°</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fineBtn}
                  onPress={handleResetRotation}
                >
                  <Text style={styles.fineBtnText}>0°</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fineBtn}
                  onPress={() => {
                    const next = (Math.round(rotation) + 1) % 360;
                    setRotation(next);
                    syncTransform({ rotation: next });
                  }}
                >
                  <Text style={styles.fineBtnText}>+1°</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fineBtn}
                  onPress={() => {
                    const next = (Math.round(rotation) + 5) % 360;
                    setRotation(next);
                    syncTransform({ rotation: next });
                  }}
                >
                  <Text style={styles.fineBtnText}>+5°</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Separate Reset & Apply for Rotate */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleResetRotation}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
                <Text style={styles.secondaryBtnText}>Reset Rotate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  soundEngine.playSfx("whoosh");
                  syncTransform({ rotation });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#000000" />
                <Text style={styles.primaryActionBtnText}>Apply Rotate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 3. FLIP SECTION */}
        {activeTab === "flip" && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Mirror & Orientation</Text>

            <View style={styles.card}>
              <View style={styles.flipGrid}>
                {/* Flip Horizontal */}
                <TouchableOpacity
                  style={[styles.flipCard, flipX && styles.flipCardActive]}
                  onPress={handleToggleFlipX}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="flip-horizontal"
                    size={28}
                    color={flipX ? "#000000" : "#00F2FE"}
                  />
                  <Text
                    style={[
                      styles.flipCardTitle,
                      flipX && styles.flipCardTitleActive,
                    ]}
                  >
                    Flip Horizontal
                  </Text>
                  <Text
                    style={[
                      styles.flipCardSub,
                      flipX && styles.flipCardSubActive,
                    ]}
                  >
                    {flipX ? "Mirrored (On)" : "Normal (Off)"}
                  </Text>
                </TouchableOpacity>

                {/* Flip Vertical */}
                <TouchableOpacity
                  style={[styles.flipCard, flipY && styles.flipCardActive]}
                  onPress={handleToggleFlipY}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="flip-vertical"
                    size={28}
                    color={flipY ? "#000000" : "#00F2FE"}
                  />
                  <Text
                    style={[
                      styles.flipCardTitle,
                      flipY && styles.flipCardTitleActive,
                    ]}
                  >
                    Flip Vertical
                  </Text>
                  <Text
                    style={[
                      styles.flipCardSub,
                      flipY && styles.flipCardSubActive,
                    ]}
                  >
                    {flipY ? "Upside Down (On)" : "Normal (Off)"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Separate Reset & Apply for Flip */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleResetFlip}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
                <Text style={styles.secondaryBtnText}>Reset Flip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  soundEngine.playSfx("whoosh");
                  syncTransform({ flipX, flipY });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#000000" />
                <Text style={styles.primaryActionBtnText}>Apply Flip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. STRETCH SECTION */}
        {activeTab === "stretch" && (
          <View style={styles.sectionContainer}>
            {/* Stretch Presets */}
            <Text style={styles.sectionLabel}>Stretch Presets</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ratioScroll}
            >
              {STRETCH_PRESETS.map((p) => {
                const isSelected =
                  Math.abs(scaleX - p.scaleX) < 0.05 &&
                  Math.abs(scaleY - p.scaleY) < 0.05;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.ratioChip,
                      isSelected && styles.ratioChipActive,
                    ]}
                    onPress={() => handleSelectStretchPreset(p)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.ratioChipText,
                        isSelected && styles.ratioChipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Stretch Controls Card */}
            <View style={styles.card}>
              {/* Link aspect ratio toggle */}
              <View style={styles.lockRow}>
                <Text style={styles.sliderLabel}>Stretch Dimensions</Text>
                <TouchableOpacity
                  style={[
                    styles.lockBtn,
                    isAspectLinked && styles.lockBtnActive,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("click");
                    setIsAspectLinked(!isAspectLinked);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isAspectLinked ? "lock-closed" : "lock-open-outline"}
                    size={14}
                    color={isAspectLinked ? "#000000" : "#00F2FE"}
                  />
                  <Text
                    style={[
                      styles.lockBtnText,
                      isAspectLinked && styles.lockBtnTextActive,
                    ]}
                  >
                    {isAspectLinked ? "Linked (Proportional)" : "Free Stretch"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Horizontal Stretch (Width) */}
              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <View style={styles.sliderTitleWithIcon}>
                    <MaterialCommunityIcons
                      name="arrow-expand-horizontal"
                      size={16}
                      color="#00F2FE"
                    />
                    <Text style={styles.sliderLabel}>
                      Horizontal Stretch (Width)
                    </Text>
                  </View>
                  <Text style={styles.badge}>{scaleX.toFixed(2)}x</Text>
                </View>

                {Platform.OS === "web" ? (
                  <WebDiv style={{ margin: "6px 0" }}>
                    <WebInput
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.01"
                      value={scaleX}
                      onChange={(e: any) => {
                        const val = parseFloat(e.target.value) || 1.0;
                        handleUpdateScaleX(val);
                      }}
                      style={{
                        width: "100%",
                        accentColor: "#00F2FE",
                        height: 4,
                        cursor: "pointer",
                      }}
                    />
                  </WebDiv>
                ) : null}

                {/* Steppers */}
                <View style={styles.fineTuneRow}>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleX(scaleX - 0.1)}
                  >
                    <Text style={styles.fineBtnText}>-0.1x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleX(scaleX - 0.02)}
                  >
                    <Text style={styles.fineBtnText}>-0.02x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleX(1.0)}
                  >
                    <Text style={styles.fineBtnText}>1.00x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleX(scaleX + 0.02)}
                  >
                    <Text style={styles.fineBtnText}>+0.02x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleX(scaleX + 0.1)}
                  >
                    <Text style={styles.fineBtnText}>+0.1x</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Vertical Stretch (Height) */}
              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <View style={styles.sliderTitleWithIcon}>
                    <MaterialCommunityIcons
                      name="arrow-expand-vertical"
                      size={16}
                      color="#00F2FE"
                    />
                    <Text style={styles.sliderLabel}>
                      Vertical Stretch (Height)
                    </Text>
                  </View>
                  <Text style={styles.badge}>{scaleY.toFixed(2)}x</Text>
                </View>

                {Platform.OS === "web" ? (
                  <WebDiv style={{ margin: "6px 0" }}>
                    <WebInput
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.01"
                      value={scaleY}
                      onChange={(e: any) => {
                        const val = parseFloat(e.target.value) || 1.0;
                        handleUpdateScaleY(val);
                      }}
                      style={{
                        width: "100%",
                        accentColor: "#00F2FE",
                        height: 4,
                        cursor: "pointer",
                      }}
                    />
                  </WebDiv>
                ) : null}

                {/* Steppers */}
                <View style={styles.fineTuneRow}>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleY(scaleY - 0.1)}
                  >
                    <Text style={styles.fineBtnText}>-0.1x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleY(scaleY - 0.02)}
                  >
                    <Text style={styles.fineBtnText}>-0.02x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleY(1.0)}
                  >
                    <Text style={styles.fineBtnText}>1.00x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleY(scaleY + 0.02)}
                  >
                    <Text style={styles.fineBtnText}>+0.02x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => handleUpdateScaleY(scaleY + 0.1)}
                  >
                    <Text style={styles.fineBtnText}>+0.1x</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Separate Reset & Apply for Stretch */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleResetStretch}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
                <Text style={styles.secondaryBtnText}>Reset Stretch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  soundEngine.playSfx("whoosh");
                  syncTransform({ scaleX, scaleY });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#000000" />
                <Text style={styles.primaryActionBtnText}>Apply Stretch</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 5. 3D ANGLE & DISTANCE VIEW SECTION */}
        {activeTab === "angle" && (
          <View style={styles.sectionContainer}>
            {/* 3D Presets */}
            <Text style={styles.sectionLabel}>Perspective & Angle Presets</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ratioScroll}
            >
              {ANGLE_3D_PRESETS.map((p) => {
                const isSelected =
                  Math.abs(rotateX - p.rotateX) < 2 &&
                  Math.abs(rotateY - p.rotateY) < 2 &&
                  Math.abs(skewX - p.skewX) < 2;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.ratioChip,
                      isSelected && styles.ratioChipActive,
                    ]}
                    onPress={() => handleSelectAnglePreset(p)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.ratioChipText,
                        isSelected && styles.ratioChipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Distance View (Pitch / Tilt X) */}
            <View style={styles.card}>
              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <View style={styles.sliderTitleWithIcon}>
                    <MaterialCommunityIcons
                      name="road-variant"
                      size={16}
                      color="#00F2FE"
                    />
                    <Text style={styles.sliderLabel}>
                      Distance View (Tilt X / Pitch)
                    </Text>
                  </View>
                  <Text style={styles.badge}>{Math.round(rotateX)}°</Text>
                </View>
                <Text style={styles.hintText}>
                  Tilts backward to create a receding distance view (ground /
                  horizon perspective).
                </Text>

                {Platform.OS === "web" ? (
                  <WebDiv style={{ margin: "6px 0" }}>
                    <WebInput
                      type="range"
                      min="-65"
                      max="65"
                      step="1"
                      value={rotateX}
                      onChange={(e: any) => {
                        const val = parseInt(e.target.value) || 0;
                        setRotateX(val);
                        syncTransform({ rotateX: val });
                      }}
                      style={{
                        width: "100%",
                        accentColor: "#00F2FE",
                        height: 4,
                        cursor: "pointer",
                      }}
                    />
                  </WebDiv>
                ) : null}

                {/* Steppers */}
                <View style={styles.fineTuneRow}>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.max(-65, rotateX - 5);
                      setRotateX(next);
                      syncTransform({ rotateX: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>-5°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.max(-65, rotateX - 1);
                      setRotateX(next);
                      syncTransform({ rotateX: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>-1°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      setRotateX(0);
                      syncTransform({ rotateX: 0 });
                    }}
                  >
                    <Text style={styles.fineBtnText}>0° (Flat)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.min(65, rotateX + 1);
                      setRotateX(next);
                      syncTransform({ rotateX: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>+1°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.min(65, rotateX + 5);
                      setRotateX(next);
                      syncTransform({ rotateX: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>+5°</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Angle View (Yaw / Tilt Y) */}
              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <View style={styles.sliderTitleWithIcon}>
                    <MaterialCommunityIcons
                      name="axis-z-rotate-clockwise"
                      size={16}
                      color="#00F2FE"
                    />
                    <Text style={styles.sliderLabel}>
                      Angle View (Tilt Y / Yaw)
                    </Text>
                  </View>
                  <Text style={styles.badge}>{Math.round(rotateY)}°</Text>
                </View>
                <Text style={styles.hintText}>
                  Angles the clip from the left or right side in 3D space.
                </Text>

                {Platform.OS === "web" ? (
                  <WebDiv style={{ margin: "6px 0" }}>
                    <WebInput
                      type="range"
                      min="-65"
                      max="65"
                      step="1"
                      value={rotateY}
                      onChange={(e: any) => {
                        const val = parseInt(e.target.value) || 0;
                        setRotateY(val);
                        syncTransform({ rotateY: val });
                      }}
                      style={{
                        width: "100%",
                        accentColor: "#00F2FE",
                        height: 4,
                        cursor: "pointer",
                      }}
                    />
                  </WebDiv>
                ) : null}

                {/* Steppers */}
                <View style={styles.fineTuneRow}>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.max(-65, rotateY - 5);
                      setRotateY(next);
                      syncTransform({ rotateY: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>-5°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.max(-65, rotateY - 1);
                      setRotateY(next);
                      syncTransform({ rotateY: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>-1°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      setRotateY(0);
                      syncTransform({ rotateY: 0 });
                    }}
                  >
                    <Text style={styles.fineBtnText}>0° (Front)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.min(65, rotateY + 1);
                      setRotateY(next);
                      syncTransform({ rotateY: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>+1°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.min(65, rotateY + 5);
                      setRotateY(next);
                      syncTransform({ rotateY: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>+5°</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Skew Angle X */}
              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <View style={styles.sliderTitleWithIcon}>
                    <MaterialCommunityIcons
                      name="skew-more"
                      size={16}
                      color="#00F2FE"
                    />
                    <Text style={styles.sliderLabel}>Angle Shear (Skew X)</Text>
                  </View>
                  <Text style={styles.badge}>{Math.round(skewX)}°</Text>
                </View>

                {Platform.OS === "web" ? (
                  <WebDiv style={{ margin: "6px 0" }}>
                    <WebInput
                      type="range"
                      min="-45"
                      max="45"
                      step="1"
                      value={skewX}
                      onChange={(e: any) => {
                        const val = parseInt(e.target.value) || 0;
                        setSkewX(val);
                        syncTransform({ skewX: val });
                      }}
                      style={{
                        width: "100%",
                        accentColor: "#00F2FE",
                        height: 4,
                        cursor: "pointer",
                      }}
                    />
                  </WebDiv>
                ) : null}

                {/* Steppers */}
                <View style={styles.fineTuneRow}>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.max(-45, skewX - 5);
                      setSkewX(next);
                      syncTransform({ skewX: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>-5°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      setSkewX(0);
                      syncTransform({ skewX: 0 });
                    }}
                  >
                    <Text style={styles.fineBtnText}>0°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.min(45, skewX + 5);
                      setSkewX(next);
                      syncTransform({ skewX: next });
                    }}
                  >
                    <Text style={styles.fineBtnText}>+5°</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Perspective Depth / Camera Distance */}
              <View style={styles.sliderRow}>
                <View style={styles.labelValueRow}>
                  <View style={styles.sliderTitleWithIcon}>
                    <MaterialCommunityIcons
                      name="camera-iris"
                      size={16}
                      color="#00F2FE"
                    />
                    <Text style={styles.sliderLabel}>
                      Camera Distance (Perspective Depth)
                    </Text>
                  </View>
                  <Text style={styles.badge}>{Math.round(perspective)}px</Text>
                </View>

                {Platform.OS === "web" ? (
                  <WebDiv style={{ margin: "6px 0" }}>
                    <WebInput
                      type="range"
                      min="400"
                      max="1600"
                      step="50"
                      value={perspective}
                      onChange={(e: any) => {
                        const val = parseInt(e.target.value) || 800;
                        setPerspective(val);
                        syncTransform({ perspective: val });
                      }}
                      style={{
                        width: "100%",
                        accentColor: "#00F2FE",
                        height: 4,
                        cursor: "pointer",
                      }}
                    />
                  </WebDiv>
                ) : null}
              </View>
            </View>

            {/* Separate Reset & Apply for Angle */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleResetAngle}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
                <Text style={styles.secondaryBtnText}>Reset 3D Angle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  soundEngine.playSfx("whoosh");
                  syncTransform({ rotateX, rotateY, skewX, perspective });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#000000" />
                <Text style={styles.primaryActionBtnText}>Apply 3D Angle</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );

  if (isInline) {
    if (!visible) return null;
    return <View style={styles.inlineWrapper}>{sheetContent}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>{sheetContent}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#0D111A",
  },
  inlineSheetContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    maxHeight: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0D111A",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderColor: "#1E2638",
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A354D",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#182030",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarContainer: {
    marginTop: 10,
    marginBottom: 6,
  },
  tabBarScroll: {
    paddingHorizontal: 14,
    gap: 6,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#141A28",
    borderWidth: 1,
    borderColor: "#1E2638",
  },
  tabBtnActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  tabBtnText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  contentScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  sectionContainer: {
    gap: 10,
    paddingBottom: 20,
  },
  sectionLabel: {
    color: "#8E95A5",
    fontSize: 11.5,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  hintText: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 2,
  },
  ratioScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  ratioChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#161B26",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#1E2536",
  },
  ratioChipActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "#00F2FE",
  },
  ratioChipText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "600",
  },
  ratioChipTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  screenCropBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
    paddingVertical: 10,
    borderRadius: 9,
  },
  screenCropBtnText: {
    color: "#00F2FE",
    fontSize: 12.5,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#161B26",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E2536",
    gap: 12,
  },
  sliderRow: {
    gap: 4,
  },
  sliderTitleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  labelValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabel: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
  badge: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "700",
  },
  lockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1F283C",
  },
  lockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  lockBtnActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  lockBtnText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "600",
  },
  lockBtnTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#1A2130",
    borderWidth: 1,
    borderColor: "#263145",
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "600",
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00F2FE",
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "700",
  },
  flipGrid: {
    flexDirection: "row",
    gap: 10,
  },
  flipCard: {
    flex: 1,
    backgroundColor: "#111622",
    borderWidth: 1,
    borderColor: "#1E2536",
    borderRadius: 9,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
  },
  flipCardActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  flipCardTitle: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "600",
  },
  flipCardTitleActive: {
    color: "#000000",
    fontWeight: "700",
  },
  flipCardSub: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "500",
  },
  flipCardSubActive: {
    color: "#000000",
    fontWeight: "600",
  },
  quickRotateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.3)",
    paddingVertical: 12,
    borderRadius: 9,
  },
  quickRotateBtnText: {
    color: "#00F2FE",
    fontSize: 13,
    fontWeight: "700",
  },
  rotatePresetsRow: {
    flexDirection: "row",
    gap: 8,
  },
  rotatePresetBtn: {
    flex: 1,
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "#1E2536",
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: "center",
  },
  rotatePresetBtnActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  rotatePresetBtnText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "600",
  },
  rotatePresetBtnTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  fineTuneRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  fineBtn: {
    flex: 1,
    backgroundColor: "#1E2536",
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  fineBtnText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
  },
});
