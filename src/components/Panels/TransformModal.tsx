import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { ClipTransform, CustomCrop } from "../../types/project";
import { CompactSliderInput } from "../Common/CompactSliderInput";

interface TransformModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentTransform?: ClipTransform;
  currentCrop?: CustomCrop;
  initialTab?: "crop" | "flip" | "rotate" | "stretch" | "angle";
  onApplyTransform: (transform: ClipTransform, newAspectRatio?: any) => void;
  onOpenScreenCrop?: () => void;
  setIsCroppingPreview?: (active: boolean) => void;
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
  setIsCroppingPreview,
  isInline = false,
}: TransformModalProps) {
  const [activeTab, setActiveTab] = useState<
    "crop" | "flip" | "rotate" | "stretch" | "angle"
  >(initialTab);

  // Automatically activate interactive crop on player when crop tab is open
  useEffect(() => {
    if (visible && activeTab === "crop") {
      setIsCroppingPreview?.(true);
    } else {
      setIsCroppingPreview?.(false);
    }
    return () => {
      setIsCroppingPreview?.(false);
    };
  }, [visible, activeTab, setIsCroppingPreview]);

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

  const prevVisibleRef = useRef<boolean>(false);
  const prevInitialTabRef = useRef<string>(initialTab);

  useEffect(() => {
    const justOpened = !prevVisibleRef.current && visible;
    const initialTabChanged = prevInitialTabRef.current !== initialTab;

    if (visible && (justOpened || initialTabChanged)) {
      setActiveTab(initialTab);
      prevInitialTabRef.current = initialTab;
    }

    if (justOpened) {
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

    prevVisibleRef.current = visible;
  }, [visible, initialTab]);

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

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons
              name="vector-arrange-below"
              size={18}
              color="#00F2FE"
            />
            <Text style={styles.headerTitle}>Transform</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                if (activeTab === "crop") handleResetCrop();
                else if (activeTab === "rotate") handleResetRotation();
                else if (activeTab === "flip") handleResetFlip();
                else if (activeTab === "stretch") handleResetStretch();
                else handleResetAngle();
              }}
              style={[
                styles.resetBtn,
                {
                  paddingHorizontal: 10,
                  height: 26,
                  flexDirection: "row",
                  alignItems: "center",
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel={`Reset ${activeTab}`}
            >
              <Ionicons
                name="refresh-outline"
                size={12}
                color="#00F2FE"
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.resetBtnText, { fontSize: 11 }]}>
                Reset {activeTab.toUpperCase()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* 5 Main Tabs: Crop, Rotate, Flip, Stretch, 3D Angle */}
      <View style={[styles.tabBarContainer, isInline && { marginTop: 6 }]}>
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
              size={13}
              color={activeTab === "crop" ? "#00F2FE" : "#94A3B8"}
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
              size={13}
              color={activeTab === "rotate" ? "#00F2FE" : "#94A3B8"}
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
              size={14}
              color={activeTab === "flip" ? "#00F2FE" : "#94A3B8"}
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
              size={14}
              color={activeTab === "stretch" ? "#00F2FE" : "#94A3B8"}
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
              size={14}
              color={activeTab === "angle" ? "#00F2FE" : "#94A3B8"}
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


            {/* Custom Crop Sliders */}
            <View style={styles.card}>
              <CompactSliderInput
                label="Width"
                value={cropWidth}
                min={10}
                max={100}
                step={1}
                unit="%"
                defaultValue={100}
                accentColor="#00F2FE"
                onChange={(val) => {
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
              />

              <CompactSliderInput
                label="Height"
                value={cropHeight}
                min={10}
                max={100}
                step={1}
                unit="%"
                defaultValue={100}
                accentColor="#00F2FE"
                onChange={(val) => {
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
              />
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
              <CompactSliderInput
                label="Fine Rotation Angle"
                value={((Math.round(rotation) + 180) % 360) - 180}
                min={-180}
                max={180}
                step={1}
                unit="°"
                defaultValue={0}
                showReset={true}
                accentColor="#00F2FE"
                onChange={(val) => {
                  const normalized = (Math.round(val) + 360) % 360;
                  setRotation(normalized);
                  syncTransform({ rotation: normalized });
                }}
                onReset={handleResetRotation}
              />

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
                <CompactSliderInput
                  label="Horizontal Stretch (Width)"
                  icon={
                    <MaterialCommunityIcons
                      name="arrow-expand-horizontal"
                      size={15}
                      color="#00F2FE"
                    />
                  }
                  value={scaleX}
                  min={0.2}
                  max={3.0}
                  step={0.01}
                  unit="x"
                  decimals={2}
                  defaultValue={1.0}
                  accentColor="#00F2FE"
                  onChange={(val) => handleUpdateScaleX(val)}
                />

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
                <CompactSliderInput
                  label="Vertical Stretch (Height)"
                  icon={
                    <MaterialCommunityIcons
                      name="arrow-expand-vertical"
                      size={15}
                      color="#00F2FE"
                    />
                  }
                  value={scaleY}
                  min={0.2}
                  max={3.0}
                  step={0.01}
                  unit="x"
                  decimals={2}
                  defaultValue={1.0}
                  accentColor="#00F2FE"
                  onChange={(val) => handleUpdateScaleY(val)}
                />

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

            {/* 3D Angle Controls Card */}
            <View style={styles.card}>
              {/* Distance View (Pitch / Tilt X) */}
              <View style={styles.sliderRow}>
                <CompactSliderInput
                  label="Distance View (Tilt X / Pitch)"
                  icon={
                    <MaterialCommunityIcons
                      name="road-variant"
                      size={15}
                      color="#00F2FE"
                    />
                  }
                  value={rotateX}
                  min={-65}
                  max={65}
                  step={1}
                  unit="°"
                  defaultValue={0}
                  accentColor="#00F2FE"
                  hint="Tilts backward to create a receding distance view (ground / horizon perspective)."
                  onChange={(val) => {
                    setRotateX(val);
                    syncTransform({ rotateX: val });
                  }}
                />

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
                <CompactSliderInput
                  label="Angle View (Tilt Y / Yaw)"
                  icon={
                    <MaterialCommunityIcons
                      name="axis-z-rotate-clockwise"
                      size={15}
                      color="#00F2FE"
                    />
                  }
                  value={rotateY}
                  min={-65}
                  max={65}
                  step={1}
                  unit="°"
                  defaultValue={0}
                  accentColor="#00F2FE"
                  hint="Angles the clip from the left or right side in 3D space."
                  onChange={(val) => {
                    setRotateY(val);
                    syncTransform({ rotateY: val });
                  }}
                />

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
                    <Text style={styles.fineBtnText}>0° (Flat)</Text>
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
                <CompactSliderInput
                  label="Angle Shear (Skew X)"
                  icon={
                    <MaterialCommunityIcons
                      name="skew-more"
                      size={15}
                      color="#00F2FE"
                    />
                  }
                  value={skewX}
                  min={-45}
                  max={45}
                  step={1}
                  unit="°"
                  defaultValue={0}
                  accentColor="#00F2FE"
                  onChange={(val) => {
                    setSkewX(val);
                    syncTransform({ skewX: val });
                  }}
                />

                {/* Steppers */}
                <View style={styles.fineTuneRow}>
                  <TouchableOpacity
                    style={styles.fineBtn}
                    onPress={() => {
                      const next = Math.max(-45, skewX - 5);
                      setRotateX(next);
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
                <CompactSliderInput
                  label="Camera Distance (Perspective Depth)"
                  icon={
                    <MaterialCommunityIcons
                      name="camera-iris"
                      size={15}
                      color="#00F2FE"
                    />
                  }
                  value={perspective}
                  min={400}
                  max={1600}
                  step={50}
                  unit="px"
                  defaultValue={800}
                  accentColor="#00F2FE"
                  onChange={(val) => {
                    setPerspective(val);
                    syncTransform({ perspective: val });
                  }}
                />
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

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#0F131D",
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
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0F131D",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderColor: "#1F2637",
    paddingBottom: 16,
  },
  sheetHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#1F2637",
    backgroundColor: "#08090E",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarContainer: {
    marginTop: 6,
    marginBottom: 4,
  },
  tabBarScroll: {
    paddingHorizontal: 10,
    gap: 6,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 7,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  tabBtnActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "#00F2FE",
  },
  tabBtnText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  contentScroll: {
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  sectionContainer: {
    gap: 8,
    paddingBottom: 16,
  },
  sectionLabel: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 2,
  },
  hintText: {
    color: "#64748B",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 2,
  },
  ratioScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  ratioChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#131826",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  ratioChipActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "#00F2FE",
  },
  ratioChipText: {
    color: "#94A3B8",
    fontSize: 11,
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
    gap: 6,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
    paddingVertical: 8,
    borderRadius: 7,
  },
  screenCropBtnText: {
    color: "#00F2FE",
    fontSize: 11.5,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#131826",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1F2637",
    gap: 8,
  },
  sliderRow: {
    gap: 3,
  },
  sliderTitleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  labelValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabel: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
  },
  badge: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  lockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
  },
  lockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    fontSize: 10.5,
    fontWeight: "600",
  },
  lockBtnTextActive: {
    color: "#08090E",
    fontWeight: "700",
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    paddingVertical: 8,
    borderRadius: 7,
  },
  secondaryBtnText: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "600",
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#00F2FE",
    paddingVertical: 8,
    borderRadius: 7,
  },
  primaryActionBtnText: {
    color: "#08090E",
    fontSize: 11.5,
    fontWeight: "700",
  },
  flipGrid: {
    flexDirection: "row",
    gap: 8,
  },
  flipCard: {
    flex: 1,
    backgroundColor: "#08090E",
    borderWidth: 1,
    borderColor: "#1F2637",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 4,
  },
  flipCardActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "#00F2FE",
  },
  flipCardTitle: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "600",
  },
  flipCardTitleActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  flipCardSub: {
    color: "#94A3B8",
    fontSize: 9.5,
    fontWeight: "500",
  },
  flipCardSubActive: {
    color: "#00F2FE",
    fontWeight: "600",
  },
  quickRotateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
    paddingVertical: 9,
    borderRadius: 7,
  },
  quickRotateBtnText: {
    color: "#00F2FE",
    fontSize: 11.5,
    fontWeight: "700",
  },
  rotatePresetsRow: {
    flexDirection: "row",
    gap: 6,
  },
  rotatePresetBtn: {
    flex: 1,
    backgroundColor: "#08090E",
    borderWidth: 1,
    borderColor: "#1F2637",
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: "center",
  },
  rotatePresetBtnActive: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderColor: "#00F2FE",
  },
  rotatePresetBtnText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  rotatePresetBtnTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  fineTuneRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  fineBtn: {
    flex: 1,
    backgroundColor: "#08090E",
    borderWidth: 1,
    borderColor: "#1F2637",
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  fineBtnText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
  },
});
