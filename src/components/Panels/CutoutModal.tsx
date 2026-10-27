import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CutoutConfig, MaskConfig, MaskShape } from "../../types/project";
import { soundEngine } from "../../utils/audioEngine";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { label: "Green Screen", color: "#00FF00" },
  { label: "Neon Lime", color: "#10B981" },
  { label: "Chroma Blue", color: "#0000FF" },
  { label: "Sky Cyan", color: "#00F2FE" },
  { label: "Studio Black", color: "#000000" },
  { label: "Clean White", color: "#FFFFFF" },
  { label: "Magenta", color: "#FF00FF" },
  { label: "Crimson", color: "#FF0050" },
  { label: "Warm Amber", color: "#F59E0B" },
  { label: "Slate Grey", color: "#64748B" },
];

const STROKE_PRESETS = [
  { label: "None", color: "none" },
  { label: "White", color: "#FFFFFF" },
  { label: "Neon Cyan", color: "#00F2FE" },
  { label: "Amber Gold", color: "#FFE600" },
  { label: "Hot Pink", color: "#FF0050" },
  { label: "Emerald", color: "#10B981" },
  { label: "Purple Glow", color: "#A855F7" },
];

const BG_COLOR_PRESETS = [
  { label: "Transparent", color: "none" },
  { label: "Black", color: "#000000" },
  { label: "White", color: "#FFFFFF" },
  { label: "Neon Cyan", color: "#00F2FE" },
  { label: "Purple", color: "#8B5CF6" },
  { label: "Red", color: "#FF0050" },
  { label: "Amber", color: "#FFE600" },
  { label: "Emerald", color: "#10B981" },
  { label: "Royal Blue", color: "#2563EB" },
  { label: "Deep Slate", color: "#1E293B" },
];

// The full palettes remain available through the native/web color picker. These
// quick picks deliberately stay short so the editor is usable on phone screens.
const QUICK_KEY_COLORS = COLOR_PRESETS.slice(0, 6);
const QUICK_BG_COLORS = BG_COLOR_PRESETS.slice(0, 5);
const QUICK_STROKE_COLORS = STROKE_PRESETS.slice(0, 5);

const MASK_SHAPES: { id: MaskShape; label: string; icon: string }[] = [
  { id: "none", label: "None", icon: "ban-outline" },
  { id: "linear", label: "Linear", icon: "remove-outline" },
  { id: "mirror", label: "Mirror", icon: "swap-horizontal-outline" },
  { id: "circle", label: "Circle", icon: "ellipse-outline" },
  { id: "rectangle", label: "Rectangle", icon: "square-outline" },
  { id: "heart", label: "Heart", icon: "heart-outline" },
  { id: "star", label: "Star", icon: "star-outline" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CutoutModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentCutout?: CutoutConfig;
  currentMask?: MaskConfig;
  onApplyCutout: (config: CutoutConfig) => void;
  onApplyMask?: (config: MaskConfig) => void;
  initialMode?: "auto" | "chroma";
  initialTab?: MainTab;
  isInline?: boolean;
}

type MainTab = "cutout" | "mask";
type CutoutMode = "chroma" | "auto";

const WebDiv: any = Platform.OS === "web" ? "div" : View;
const WebInput: any = Platform.OS === "web" ? "input" : View;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CutoutModal({
  visible,
  onClose,
  onApply,
  currentCutout,
  currentMask,
  onApplyCutout,
  onApplyMask,
  initialMode,
  initialTab = "cutout",
  isInline = false,
}: CutoutModalProps) {
  // Main tab: cutout or mask
  const [mainTab, setMainTab] = useState<MainTab>("cutout");

  // Cutout state
  const [enabled, setEnabled] = useState<boolean>(false);
  const [cutoutMode, setCutoutMode] = useState<CutoutMode>("chroma");
  const [keyColor, setKeyColor] = useState<string>("#00FF00");
  const [intensity, setIntensity] = useState<number>(45);
  const [shadow, setShadow] = useState<number>(25);
  const [strokeColor, setStrokeColor] = useState<string>("none");
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [bgColor, setBgColor] = useState<string>("none");

  // Mask state
  const [maskShape, setMaskShape] = useState<MaskShape>("none");
  const [maskSize, setMaskSize] = useState<number>(60);
  const [maskFeather, setMaskFeather] = useState<number>(0);
  const [maskRoundness, setMaskRoundness] = useState<number>(0);
  const [maskInverted, setMaskInverted] = useState<boolean>(false);
  const [maskX, setMaskX] = useState<number>(0);
  const [maskY, setMaskY] = useState<number>(0);
  const [maskRotation, setMaskRotation] = useState<number>(0);

  // Refs for always-current values (avoids stale closures in callbacks)
  const enabledRef = useRef(enabled);
  const cutoutModeRef = useRef(cutoutMode);
  const keyColorRef = useRef(keyColor);
  const intensityRef = useRef(intensity);
  const shadowRef = useRef(shadow);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const bgColorRef = useRef(bgColor);

  // Sync refs whenever state changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    cutoutModeRef.current = cutoutMode;
  }, [cutoutMode]);
  useEffect(() => {
    keyColorRef.current = keyColor;
  }, [keyColor]);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);
  useEffect(() => {
    shadowRef.current = shadow;
  }, [shadow]);
  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);
  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);
  useEffect(() => {
    bgColorRef.current = bgColor;
  }, [bgColor]);

  // Load from props when modal opens
  // NOTE: we intentionally do NOT call onApplyCutout here to prevent
  // applying stale config from a previously selected clip (the "applying from
  // old config" bug). Only user interactions trigger onApplyCutout.
  useEffect(() => {
    if (!visible) return;
    const targetMode: CutoutMode =
      initialMode || currentCutout?.mode || "chroma";
    cutoutModeRef.current = targetMode;
    setCutoutMode(targetMode);
    const en = currentCutout?.enabled || false;
    enabledRef.current = en;
    setEnabled(en);
    const kc = currentCutout?.keyColor || "#00FF00";
    keyColorRef.current = kc;
    setKeyColor(kc);
    const ints = currentCutout?.intensity ?? 45;
    intensityRef.current = ints;
    setIntensity(ints);
    const sh = currentCutout?.shadow ?? 25;
    shadowRef.current = sh;
    setShadow(sh);
    const sc = currentCutout?.strokeColor || "none";
    strokeColorRef.current = sc;
    setStrokeColor(sc);
    const sw = currentCutout?.strokeWidth ?? 3;
    strokeWidthRef.current = sw;
    setStrokeWidth(sw);
    const bg = currentCutout?.bgColor || "none";
    bgColorRef.current = bg;
    setBgColor(bg);

    // Mask
    setMaskShape(currentMask?.shape || "none");
    setMaskSize(currentMask?.size ?? 60);
    setMaskFeather(currentMask?.feather ?? 0);
    setMaskRoundness(currentMask?.roundness ?? 0);
    setMaskInverted(currentMask?.inverted || false);
    setMaskX(currentMask?.x ?? 0);
    setMaskY(currentMask?.y ?? 0);
    setMaskRotation(currentMask?.rotation ?? 0);

    setMainTab(initialTab);
  }, [visible, initialMode, initialTab]); // Values are loaded once per modal session; updates must not reset active controls.

  // Sync cutout — reads from refs so it always has fresh values
  const syncCutout = useCallback(
    (overrides?: Partial<CutoutConfig>) => {
      const nextEnabled =
        overrides?.enabled !== undefined
          ? overrides.enabled
          : enabledRef.current;
      const nextMode =
        overrides?.mode !== undefined ? overrides.mode : cutoutModeRef.current;
      const nextKeyColor =
        overrides?.keyColor !== undefined
          ? overrides.keyColor
          : keyColorRef.current;
      const nextIntensity =
        overrides?.intensity !== undefined
          ? overrides.intensity
          : intensityRef.current;
      const nextShadow =
        overrides?.shadow !== undefined ? overrides.shadow : shadowRef.current;
      const nextStrokeColor =
        overrides?.strokeColor !== undefined
          ? overrides.strokeColor
          : strokeColorRef.current;
      const nextStrokeWidth =
        overrides?.strokeWidth !== undefined
          ? overrides.strokeWidth
          : strokeWidthRef.current;
      const nextBgColor =
        overrides?.bgColor !== undefined
          ? overrides.bgColor
          : bgColorRef.current;

      onApplyCutout({
        enabled: nextEnabled,
        mode: nextMode,
        keyColor: nextKeyColor,
        intensity: nextIntensity,
        shadow: nextShadow,
        strokeColor: nextStrokeColor === "none" ? undefined : nextStrokeColor,
        strokeWidth: nextStrokeColor === "none" ? 0 : nextStrokeWidth,
        bgColor: nextBgColor === "none" ? undefined : nextBgColor,
      });
    },
    [onApplyCutout],
  );

  // Mask sync (uses state directly since mask syncMask is recreated on state change)
  const syncMask = useCallback(
    (overrides?: Partial<MaskConfig>) => {
      if (!onApplyMask) return;
      onApplyMask({
        shape: overrides?.shape !== undefined ? overrides.shape : maskShape,
        size: overrides?.size !== undefined ? overrides.size : maskSize,
        feather:
          overrides?.feather !== undefined ? overrides.feather : maskFeather,
        roundness:
          overrides?.roundness !== undefined
            ? overrides.roundness
            : maskRoundness,
        inverted:
          overrides?.inverted !== undefined ? overrides.inverted : maskInverted,
        x: overrides?.x !== undefined ? overrides.x : maskX,
        y: overrides?.y !== undefined ? overrides.y : maskY,
        rotation:
          overrides?.rotation !== undefined ? overrides.rotation : maskRotation,
      });
    },
    [
      onApplyMask,
      maskShape,
      maskSize,
      maskFeather,
      maskRoundness,
      maskInverted,
      maskX,
      maskY,
      maskRotation,
    ],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleApply = () => {
    soundEngine.playSfx("whoosh");
    syncCutout({ enabled: true });
    if (onApply) onApply();
  };

  const handleReset = () => {
    soundEngine.playSfx("click");
    setEnabled(false);
    setCutoutMode("chroma");
    setKeyColor("#00FF00");
    setIntensity(45);
    setShadow(25);
    setStrokeColor("none");
    setStrokeWidth(3);
    setBgColor("none");
    enabledRef.current = false;
    cutoutModeRef.current = "chroma";
    keyColorRef.current = "#00FF00";
    intensityRef.current = 45;
    shadowRef.current = 25;
    strokeColorRef.current = "none";
    strokeWidthRef.current = 3;
    bgColorRef.current = "none";
    onApplyCutout({
      enabled: false,
      mode: "chroma",
      keyColor: "#00FF00",
      intensity: 45,
      shadow: 25,
      strokeWidth: 0,
    });
  };

  const handleCancel = () => {
    soundEngine.playSfx("pop");
    onClose();
  };

  // Updaters: immediately write to ref AND state AND sync
  const updateIntensity = (val: number) => {
    const v = Math.max(1, Math.min(100, val));
    intensityRef.current = v;
    setIntensity(v);
    enabledRef.current = true;
    setEnabled(true);
    syncCutout({ intensity: v, enabled: true });
  };
  const updateShadow = (val: number) => {
    const v = Math.max(0, Math.min(100, val));
    shadowRef.current = v;
    setShadow(v);
    enabledRef.current = true;
    setEnabled(true);
    syncCutout({ shadow: v, enabled: true });
  };
  const updateKeyColor = (col: string) => {
    keyColorRef.current = col;
    setKeyColor(col);
    enabledRef.current = true;
    setEnabled(true);
    syncCutout({ keyColor: col, enabled: true });
  };
  const updateBgColor = (col: string) => {
    bgColorRef.current = col;
    setBgColor(col);
    enabledRef.current = true;
    setEnabled(true);
    syncCutout({ bgColor: col, enabled: true });
  };
  const updateStrokeColor = (col: string) => {
    strokeColorRef.current = col;
    setStrokeColor(col);
    enabledRef.current = true;
    setEnabled(true);
    syncCutout({ strokeColor: col, enabled: true });
  };
  const updateStrokeWidth = (w: number) => {
    const v = Math.max(1, Math.min(20, w));
    strokeWidthRef.current = v;
    setStrokeWidth(v);
    enabledRef.current = true;
    setEnabled(true);
    syncCutout({ strokeWidth: v, enabled: true });
  };
  const switchCutoutMode = (m: CutoutMode) => {
    soundEngine.playSfx("click");
    cutoutModeRef.current = m;
    setCutoutMode(m);
    enabledRef.current = true;
    setEnabled(true);
    syncCutout({ mode: m, enabled: true });
  };

  const toggleAutoAi = () => {
    switchCutoutMode(cutoutMode === "auto" ? "chroma" : "auto");
  };

  // ── Slider helper ─────────────────────────────────────────────────────────
  const renderSlider = (
    label: string,
    value: number,
    unit: string,
    min: number,
    max: number,
    onChange: (v: number) => void,
    step = 1,
    accentColor = "#00F2FE",
  ) => (
    <View style={s.sliderGroup}>
      <View style={s.sliderHeader}>
        <Text style={s.sliderLabel}>{label}</Text>
        <Text style={s.sliderVal}>
          {value}
          {unit}
        </Text>
      </View>
      <View style={s.sliderContainer}>
        <TouchableOpacity
          style={s.stepBtn}
          onPress={() => onChange(value - step)}
        >
          <Ionicons name="remove" size={14} color="#FFFFFF" />
        </TouchableOpacity>
        {Platform.OS === "web" ? (
          <WebDiv style={{ flex: 1, margin: "0 4px" }}>
            <WebInput
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e: any) => onChange(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor,
                height: 4,
                cursor: "pointer",
              }}
            />
          </WebDiv>
        ) : (
          <View style={s.trackFallback}>
            <View
              style={[
                s.fillFallback,
                {
                  width: `${((value - min) / Math.max(1, max - min)) * 100}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
        )}
        <TouchableOpacity
          style={s.stepBtn}
          onPress={() => onChange(value + step)}
        >
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Cutout Tab Content ────────────────────────────────────────────────────
  const renderCutoutContent = () => (
    <>
      <TouchableOpacity
        style={[s.autoAiToggle, cutoutMode === "auto" && s.autoAiToggleActive]}
        onPress={toggleAutoAi}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Toggle Auto AI cutout"
      >
        <View style={[s.autoAiIcon, cutoutMode === "auto" && s.autoAiIconActive]}>
          <Ionicons
            name="sparkles"
            size={16}
            color={cutoutMode === "auto" ? "#000000" : "#00F2FE"}
          />
        </View>
        <View style={s.removerCopy}>
          <Text style={s.methodValue}>Auto AI cutout</Text>
          <Text style={s.methodLabel}>{cutoutMode === "auto" ? "People & portraits" : "Off — use Chroma Key"}</Text>
        </View>
        <View style={[s.autoSwitchTrack, cutoutMode === "auto" && s.autoSwitchTrackOn]}>
          <View style={[s.autoSwitchThumb, cutoutMode === "auto" && s.autoSwitchThumbOn]} />
        </View>
      </TouchableOpacity>

      <View style={s.sectionBox}>
        {cutoutMode === "chroma" ? (
          <>
            <Text style={s.sectionHeader}>CHROMA KEY COLOR</Text>
            <View style={s.swatchRow}>
              {QUICK_KEY_COLORS.map((preset) => {
                const isSelected =
                  keyColor.toUpperCase() === preset.color.toUpperCase();
                return (
                  <TouchableOpacity
                    key={preset.color}
                    style={[
                      s.colorSwatch,
                      { backgroundColor: preset.color },
                      isSelected && s.colorSwatchSelected,
                    ]}
                    onPress={() => updateKeyColor(preset.color)}
                    activeOpacity={0.8}
                    accessibilityLabel={`Use ${preset.label} as key color`}
                  />
                );
              })}
            </View>
            <View style={s.customColorRow}>
              <Text style={s.sliderLabel}>Custom Color:</Text>
              <View style={s.colorInputBox}>
                <View style={[s.sampleSquare, { backgroundColor: keyColor }]} />
                {Platform.OS === "web" ? (
                  <WebInput
                    type="color"
                    value={keyColor}
                    onChange={(e: any) => updateKeyColor(e.target.value)}
                    style={{
                      width: 38,
                      height: 24,
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  />
                ) : null}
                <Text style={s.hexCodeText}>{keyColor.toUpperCase()}</Text>
              </View>
            </View>
          </>
        ) : <Text style={s.sectionHeader}>AI CUTOUT SETTINGS</Text>}
        {renderSlider(
          cutoutMode === "chroma" ? "Color tolerance" : "Subject sensitivity",
          intensity,
          "%",
          1,
          100,
          updateIntensity,
        )}
        {renderSlider("Edge softness", shadow, "%", 0, 100, updateShadow)}
      </View>

      <View style={s.sectionBox}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <Text style={s.sectionHeader}>FINISH</Text>
          {bgColor !== "none" && (
            <TouchableOpacity onPress={() => updateBgColor("none")}>
              <Text style={s.clearBtn}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.subsectionLabel}>Background</Text>
        <View style={s.swatchRow}>
          {QUICK_BG_COLORS.map((preset) => {
            const isSelected =
              bgColor.toUpperCase() === preset.color.toUpperCase();
            return (
              <TouchableOpacity
                key={preset.color}
                style={[
                  s.colorSwatch,
                  {
                    backgroundColor:
                      preset.color === "none" ? "#202832" : preset.color,
                  },
                  preset.color === "none" && s.transparentSwatch,
                  isSelected && s.colorSwatchSelected,
                ]}
                onPress={() => updateBgColor(preset.color)}
                activeOpacity={0.8}
                accessibilityLabel={`Use ${preset.label} background`}
              >
                {preset.color === "none" && (
                  <Ionicons name="close" size={14} color="#00F2FE" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.customColorRow}>
          <Text style={s.sliderLabel}>Custom</Text>
          <View style={s.colorInputBox}>
            <View
              style={[
                s.sampleSquare,
                { backgroundColor: bgColor === "none" ? "#141721" : bgColor },
              ]}
            />
            {Platform.OS === "web" ? (
              <WebInput
                type="color"
                value={bgColor === "none" ? "#000000" : bgColor}
                onChange={(e: any) => updateBgColor(e.target.value)}
                style={{
                  width: 38,
                  height: 24,
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              />
            ) : null}
            <Text style={s.hexCodeText}>
              {bgColor === "none" ? "TRANSPARENT" : bgColor.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={s.finishDivider} />
        <Text style={s.subsectionLabel}>Outline</Text>
        <View style={s.swatchRow}>
          {QUICK_STROKE_COLORS.map((sp) => {
            const isSelected = strokeColor === sp.color;
            return (
              <TouchableOpacity
                key={sp.color}
                style={[
                  s.colorSwatch,
                  {
                    backgroundColor: sp.color === "none" ? "#202832" : sp.color,
                  },
                  sp.color === "none" && s.transparentSwatch,
                  isSelected && s.colorSwatchSelected,
                ]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  updateStrokeColor(sp.color);
                }}
                activeOpacity={0.8}
                accessibilityLabel={`Use ${sp.label} outline`}
              >
                {sp.color === "none" && (
                  <Ionicons name="close" size={14} color="#00F2FE" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {strokeColor !== "none" && (
          <>
            {renderSlider(
              "Outline width",
              strokeWidth,
              "px",
              1,
              20,
              updateStrokeWidth,
              1,
            )}
            <View style={s.customColorRow}>
              <Text style={s.sliderLabel}>Custom</Text>
              <View style={s.colorInputBox}>
                <View
                  style={[s.sampleSquare, { backgroundColor: strokeColor }]}
                />
                {Platform.OS === "web" ? (
                  <WebInput
                    type="color"
                    value={strokeColor}
                    onChange={(e: any) => updateStrokeColor(e.target.value)}
                    style={{
                      width: 38,
                      height: 24,
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  />
                ) : null}
                <Text style={s.hexCodeText}>{strokeColor.toUpperCase()}</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </>
  );

  // ── Mask Tab Content ──────────────────────────────────────────────────────
  const renderMaskContent = () => (
    <>
      <View style={s.sectionBox}>
        <Text style={s.sectionHeader}>MASK SHAPE</Text>
        <View style={s.maskGrid}>
          {MASK_SHAPES.map((m) => {
            const isSel = maskShape === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.maskCard, isSel && s.maskCardActive]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setMaskShape(m.id);
                  syncMask({ shape: m.id });
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={m.icon as any}
                  size={18}
                  color={isSel ? "#00F2FE" : "#8E95A5"}
                />
                <Text style={[s.maskCardTitle, isSel && s.maskCardTitleActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {maskShape !== "none" && (
        <View style={s.sectionBox}>
          <Text style={s.sectionHeader}>MASK CONTROLS</Text>
          {renderSlider("Aperture Size", maskSize, "%", 15, 100, (v) => {
            setMaskSize(v);
            syncMask({ size: v });
          })}
          {renderSlider("Edge Feathering", maskFeather, "%", 0, 80, (v) => {
            setMaskFeather(v);
            syncMask({ feather: v });
          })}
          {maskShape === "rectangle" &&
            renderSlider(
              "Corner Roundness",
              maskRoundness,
              "px",
              0,
              50,
              (v) => {
                setMaskRoundness(v);
                syncMask({ roundness: v });
              },
            )}
          {renderSlider(
            "Rotation Angle",
            maskRotation,
            "\u00b0",
            -180,
            180,
            (v) => {
              setMaskRotation(v);
              syncMask({ rotation: v });
            },
          )}

          <View style={s.positionRow}>
            <View style={{ flex: 1 }}>
              {renderSlider("Offset X", maskX, "%", -50, 50, (v) => {
                setMaskX(v);
                syncMask({ x: v });
              })}
            </View>
            <View style={{ flex: 1 }}>
              {renderSlider("Offset Y", maskY, "%", -50, 50, (v) => {
                setMaskY(v);
                syncMask({ y: v });
              })}
            </View>
          </View>

          <TouchableOpacity
            style={s.toggleRow}
            onPress={() => {
              soundEngine.playSfx("click");
              const next = !maskInverted;
              setMaskInverted(next);
              syncMask({ inverted: next });
            }}
            activeOpacity={0.7}
          >
            <Text style={s.sliderLabel}>Invert Mask (Outside Area)</Text>
            <Ionicons
              name={maskInverted ? "checkbox" : "square-outline"}
              size={20}
              color={maskInverted ? "#00F2FE" : "#8E95A5"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.resetMaskBtn}
            onPress={() => {
              soundEngine.playSfx("pop");
              setMaskShape("none");
              setMaskSize(60);
              setMaskFeather(0);
              setMaskRoundness(0);
              setMaskInverted(false);
              setMaskX(0);
              setMaskY(0);
              setMaskRotation(0);
              if (onApplyMask) onApplyMask({ shape: "none" });
            }}
          >
            <Ionicons name="refresh-outline" size={13} color="#8E95A5" />
            <Text style={s.resetMaskText}>Reset Mask</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  // ── Sheet Content ─────────────────────────────────────────────────────────
  const sheetContent = (
    <View style={[s.sheetContainer, s.inlineSheet]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={s.header}>
          <View style={s.titleRow}>
            <Ionicons name="person-remove-outline" size={16} color="#00F2FE" />
            <Text style={s.sheetTitle}>Cutout &amp; Mask</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleReset}
              style={[s.resetBtn, { paddingHorizontal: 10, height: 26, flexDirection: 'row', alignItems: 'center' }]}
              activeOpacity={0.7}
              accessibilityLabel="Reset cutout & mask"
            >
              <Ionicons name="refresh-outline" size={12} color="#00F2FE" style={{ marginRight: 3 }} />
              <Text style={[s.resetText, { fontSize: 11 }]}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={s.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Main Tab Bar */}
      <View style={[s.mainTabBar, isInline && { marginTop: 8 }]}>
        <TouchableOpacity
          style={[s.mainTab, mainTab === "cutout" && s.mainTabActive]}
          onPress={() => {
            soundEngine.playSfx("click");
            setMainTab("cutout");
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="cut-outline"
            size={13}
            color={mainTab === "cutout" ? "#00F2FE" : "#94A3B8"}
          />
          <Text
            style={[s.mainTabText, mainTab === "cutout" && s.mainTabTextActive]}
          >
            Cutout &amp; Chroma
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.mainTab, mainTab === "mask" && s.mainTabActive]}
          onPress={() => {
            soundEngine.playSfx("click");
            setMainTab("mask");
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="shapes-outline"
            size={13}
            color={mainTab === "mask" ? "#00F2FE" : "#94A3B8"}
          />
          <Text
            style={[s.mainTabText, mainTab === "mask" && s.mainTabTextActive]}
          >
            Shape Mask
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false}>
        {mainTab === "cutout" ? renderCutoutContent() : renderMaskContent()}
      </ScrollView>
    </View>
  );

  if (!visible) return null;
  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        backgroundColor: "#0F131D",
      }}
    >
      {sheetContent}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0F131D",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2637",
    maxHeight: Platform.OS === "web" ? "82%" : ("88%" as any),
  },
  inlineSheet: {
    flex: 1,
    maxHeight: "100%" as any,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 0,
  },
  sheetHandle: {
    width: 32,
    height: 4,
    backgroundColor: "#1F2637",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#08090E",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  resetText: { color: "#94A3B8", fontSize: 10.5, fontWeight: "600" },
  doneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
    alignItems: "center",
    justifyContent: "center",
  },
  mainTabBar: {
    flexDirection: "row",
    backgroundColor: "#08090E",
    borderRadius: 8,
    padding: 3,
    margin: 10,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  mainTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mainTabActive: { backgroundColor: "#131826", borderWidth: 1, borderColor: "#00F2FE" },
  mainTabText: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
  mainTabTextActive: { color: "#00F2FE", fontWeight: "700" },
  removerCopy: { flex: 1 },
  autoAiToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F2637",
    backgroundColor: "#131826",
    marginBottom: 8,
  },
  autoAiToggleActive: { borderColor: "#00F2FE", backgroundColor: "rgba(0,242,254,0.08)" },
  autoAiIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,242,254,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  autoAiIconActive: { backgroundColor: "#00F2FE" },
  methodLabel: { fontSize: 9.5, color: "#94A3B8", fontWeight: "600" },
  methodValue: {
    fontSize: 10.5,
    color: "#FFFFFF",
    fontWeight: "700",
    marginTop: 1,
  },
  autoSwitchTrack: { width: 34, height: 20, borderRadius: 10, padding: 2, backgroundColor: "#1F2637", justifyContent: "center" },
  autoSwitchTrackOn: { backgroundColor: "#00F2FE", alignItems: "flex-end" },
  autoSwitchThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#94A3B8" },
  autoSwitchThumbOn: { backgroundColor: "#08090E" },
  sheetBody: { padding: 10 },
  sectionBox: {
    backgroundColor: "#131826",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1F2637",
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  subsectionLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: "#00F2FE",
    transform: [{ scale: 1.06 }],
  },
  transparentSwatch: { borderColor: "#00F2FE", borderStyle: "dashed" },
  finishDivider: { height: 1, backgroundColor: "#1F2637", marginVertical: 8 },
  customColorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
    marginTop: 4,
  },
  colorInputBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  sampleSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  hexCodeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  clearBtn: { fontSize: 10.5, color: "#00F2FE", fontWeight: "600" },
  sliderGroup: { marginTop: 8 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sliderLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  sliderVal: { fontSize: 11, color: "#FFFFFF", fontWeight: "700" },
  sliderContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#1B2234",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  trackFallback: {
    flex: 1,
    height: 4,
    backgroundColor: "#1F2637",
    borderRadius: 2,
  },
  fillFallback: { height: 4, backgroundColor: "#00F2FE", borderRadius: 2 },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#131826",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  autoBadgeText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF", flex: 1 },
  helperText: {
    fontSize: 10.5,
    color: "#64748B",
    lineHeight: 15,
    marginBottom: 8,
  },
  maskGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  maskCard: {
    width: "31%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: "#131826",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  maskCardActive: {
    backgroundColor: "rgba(0,242,254,0.08)",
    borderColor: "#00F2FE",
  },
  maskCardTitle: {
    fontSize: 9.5,
    color: "#94A3B8",
    fontWeight: "600",
    textAlign: "center",
  },
  maskCardTitleActive: { color: "#00F2FE", fontWeight: "700" },
  positionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1F2637",
  },
  resetMaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  resetMaskText: { fontSize: 10.5, color: "#94A3B8", fontWeight: "600" },
  inlineApplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#00F2FE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  inlineAppliedBtn: {
    backgroundColor: "#10B981",
  },
  inlineApplyText: {
    color: "#08090E",
    fontSize: 11,
    fontWeight: "700",
  },
});
