import React from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { MaskedView } from "@expo/ui/community/masked-view";
import { SvgXml } from "react-native-svg";
import type { MaskConfig } from "../../types/project";
import { buildMaskSvg, maskSvgDataUri } from "../../utils/maskGeometry";
import { LinearGradient } from "expo-linear-gradient";
import { getNativeMaskUri, setOnMaskUpdated, getClipBakedFps } from "../../services/selfieSegmentationService";
import { styles } from "./PlayerStyles";
import { TransientTransformState } from "./playerTypes";
import { computeVideoClipDimensions } from "./playerUtils";
import NativeVideoClipPlayer from "../NativeVideoClipPlayer";
import NativeAudioTrackPlayer from "../NativeAudioTrackPlayer";
import { applyMotionTracking, FILTER_CSS_MAP, scaleCssFilter } from "../../utils/renderer/rendererEffects";
import { evaluateClipAnimation } from "../../utils/animationEngine";
import {
  buildHslCssFilter,
  isHslActive,
  HSL_CHANNEL_KEYS,
  HSL_CHANNEL_METRICS,
} from "../../utils/hslEngine";

interface PlayerNativeCompositorProps {
  activeVideos: any[];
  activeAudios?: any[];
  activeCaptions?: any[];
  activeTexts: any[];
  activeStickers: any[];
  activeEffects: any[];
  activeTransient: TransientTransformState | null;
  currentTime: number;
  isPlaying: boolean;
  boxWidth: number;
  canvasHeight: number;
  onSelectClip?: (id: string | null, type?: string) => void;
  canvasBackground?: string;
  getItemBaseDimensions: (
    type: "text" | "sticker" | "video" | "caption",
    clip: any,
  ) => { baseW: number; baseH: number };
  getInterpolatedTransform: (
    clip: any,
    curTime: number,
    clipType?: string,
  ) => any;
}

function renderClipEnhanceOverlay(clip: any) {
  const enhance = clip.enhance;
  if (!enhance) return null;
  const hasHdr = Boolean(enhance.hdr);
  const colorBoost = (enhance.colorBoost || 0) / 100;
  const skinSmooth = (enhance.skinSmoothing || 0) / 100;
  const faceRad = (enhance.faceRadiance || 0) / 100;

  if (!hasHdr && colorBoost === 0 && skinSmooth === 0 && faceRad === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {(faceRad > 0 || skinSmooth > 0) && (
        <LinearGradient
          colors={[
            `rgba(255, 235, 225, ${(faceRad * 0.22 + skinSmooth * 0.12).toFixed(2)})`,
            `rgba(255, 245, 235, ${(skinSmooth * 0.08).toFixed(2)})`,
            `rgba(255, 225, 215, ${(faceRad * 0.18).toFixed(2)})`,
          ]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {hasHdr && (
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.12)", "transparent", "rgba(0, 0, 0, 0.15)"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {colorBoost > 0 && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(0, 242, 254, ${(colorBoost * 0.08).toFixed(2)})` },
          ]}
        />
      )}
    </View>
  );
}

function renderMosaicCensor(clip: any, clipW: number, clipH: number, currentTime: number) {
  if (!clip.motionTrack || !clip.motionTrack.enabled || clip.motionTrack.actionType !== 'mosaic_censor') {
    return null;
  }
  const track = clip.motionTrack;
  const rect = track.targetRect || { x: 35, y: 30, width: 30, height: 30 };
  const motion = applyMotionTracking(currentTime, clip.startTime, clip.duration, track);

  // rect.x, rect.width and motion.dx are in percent (0..100)
  const centerNormX = Math.max(0, Math.min(1, (rect.x + rect.width / 2 + motion.dx) / 100));
  const centerNormY = Math.max(0, Math.min(1, (rect.y + rect.height / 2 + motion.dy) / 100));
  const boxNormW = Math.max(0.04, Math.min(1, (rect.width / 100) * motion.dScale));
  const boxNormH = Math.max(0.04, Math.min(1, (rect.height / 100) * motion.dScale));

  const boxPixelW = Math.max(20, Math.round(clipW * boxNormW));
  const boxPixelH = Math.max(20, Math.round(clipH * boxNormH));
  const boxLeft = Math.round(clipW * centerNormX - boxPixelW / 2);
  const boxTop = Math.round(clipH * centerNormY - boxPixelH / 2);

  const radius = track.mosaicRadius ?? 18;
  const isPixelate = track.mosaicStyle === 'pixelate';
  const isCircle = track.mosaicShape === 'circle';
  const bRadius = isCircle ? 9999 : isPixelate ? 4 : Math.round(Math.min(boxPixelW, boxPixelH) / 4);

  const webBackdropStyle: any = Platform.OS === 'web' ? {
    backdropFilter: isPixelate
      ? `blur(${Math.max(2, Math.round(radius * 0.4))}px) contrast(170%) brightness(90%)`
      : `blur(${radius}px)`,
    WebkitBackdropFilter: isPixelate
      ? `blur(${Math.max(2, Math.round(radius * 0.4))}px) contrast(170%) brightness(90%)`
      : `blur(${radius}px)`,
  } : {};

  // Procedural mosaic blocks pattern for native mobile & web
  const gridRows = isPixelate ? Math.max(3, Math.min(8, Math.round(boxPixelH / Math.max(6, radius * 0.8)))) : 0;
  const gridCols = isPixelate ? Math.max(3, Math.min(8, Math.round(boxPixelW / Math.max(6, radius * 0.8)))) : 0;

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: boxLeft,
          top: boxTop,
          width: boxPixelW,
          height: boxPixelH,
          borderRadius: bRadius,
          backgroundColor: isPixelate ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.15)',
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: 'rgba(0, 242, 254, 0.45)',
          zIndex: 99,
          justifyContent: 'center',
          alignItems: 'center',
        },
        webBackdropStyle,
      ]}
    >
      {isPixelate && (
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'column' }]}>
          {Array.from({ length: gridRows }).map((_, rIdx) => (
            <View key={`r-${rIdx}`} style={{ flex: 1, flexDirection: 'row' }}>
              {Array.from({ length: gridCols }).map((_, cIdx) => {
                const shade = ((rIdx + cIdx) % 3 === 0 ? 0.35 : (rIdx + cIdx) % 2 === 0 ? 0.5 : 0.2);
                return (
                  <View
                    key={`c-${cIdx}`}
                    style={{
                      flex: 1,
                      backgroundColor: `rgba(0, 0, 0, ${shade})`,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const FILTER_TINT_CONFIG: Record<string, { colors?: [string, string, ...string[]]; bg?: string; contrast?: boolean }> = {
  cyberpunk: { colors: ["rgba(217, 70, 239, 0.36)", "rgba(0, 242, 254, 0.30)"] },
  teal_orange: { colors: ["rgba(0, 242, 254, 0.30)", "rgba(255, 125, 20, 0.28)"] },
  lut_teal_orange_film: { colors: ["rgba(0, 242, 254, 0.30)", "rgba(255, 125, 20, 0.28)"] },
  vintage: { colors: ["rgba(180, 83, 9, 0.32)", "rgba(217, 119, 6, 0.22)"], bg: "rgba(245, 158, 11, 0.12)" },
  sepia_antique: { colors: ["rgba(180, 83, 9, 0.38)", "rgba(217, 119, 6, 0.24)"] },
  noir: { bg: "rgba(18, 18, 22, 0.76)", contrast: true },
  bw: { bg: "rgba(18, 18, 22, 0.76)", contrast: true },
  warm_sunset: { colors: ["rgba(245, 158, 11, 0.30)", "rgba(239, 68, 68, 0.20)"] },
  cinematic_warm: { colors: ["rgba(245, 158, 11, 0.28)", "rgba(239, 68, 68, 0.18)"] },
  cold_moody: { colors: ["rgba(15, 23, 42, 0.34)", "rgba(56, 189, 248, 0.24)"] },
  emerald: { colors: ["rgba(16, 185, 129, 0.32)", "rgba(5, 150, 105, 0.22)"] },
  matrix_code: { colors: ["rgba(16, 185, 129, 0.34)", "rgba(5, 150, 105, 0.24)"] },
  vhs_retro: { colors: ["rgba(225, 29, 72, 0.26)", "rgba(168, 85, 247, 0.20)"] },
  pastel_dream: { colors: ["rgba(244, 114, 182, 0.26)", "rgba(192, 132, 252, 0.22)"] },
  high_contrast: { colors: ["rgba(0, 0, 0, 0.28)", "transparent", "rgba(0, 0, 0, 0.28)"], contrast: true },
  polaroid_fade: { bg: "rgba(203, 213, 225, 0.24)" },
  solar_pop: { colors: ["rgba(168, 85, 247, 0.28)", "rgba(245, 158, 11, 0.24)"] },
  lut_kodak_2383: { colors: ["rgba(217, 119, 6, 0.32)", "rgba(180, 83, 9, 0.24)"] },
  lut_fuji_pro400h: { colors: ["rgba(56, 189, 248, 0.26)", "rgba(16, 185, 129, 0.20)"] },
  lut_bleach_bypass: { bg: "rgba(226, 232, 240, 0.28)", contrast: true },
};

function renderNativeFilterOverlay(filterId?: string, customLut?: any, intensity: number = 1.0) {
  const normIntensity = Math.max(0, Math.min(1, intensity));
  if (normIntensity <= 0.01) return null;

  // 1. Custom 3D LUT
  if (customLut) {
    const lutKey = (customLut.id || customLut.name || "").toLowerCase().replace(/[-_]/g, "");
    if (lutKey.includes("kodak") || lutKey.includes("2383")) {
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[
              `rgba(217, 119, 6, ${(0.32 * normIntensity).toFixed(3)})`,
              `rgba(180, 83, 9, ${(0.24 * normIntensity).toFixed(3)})`,
            ]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      );
    }
    if (lutKey.includes("fuji") || lutKey.includes("pro400h")) {
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[
              `rgba(56, 189, 248, ${(0.26 * normIntensity).toFixed(3)})`,
              `rgba(16, 185, 129, ${(0.20 * normIntensity).toFixed(3)})`,
            ]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      );
    }
    if (lutKey.includes("bleach")) {
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(226, 232, 240, ${(0.28 * normIntensity).toFixed(3)})` }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0, 0, 0, ${(0.16 * normIntensity).toFixed(3)})` }]} />
        </View>
      );
    }
    const tint = customLut.color || "#00F2FE";
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tint, opacity: Math.min(0.35, 0.24 * normIntensity) },
          ]}
        />
      </View>
    );
  }

  // 2. Preset Filter
  const f = (filterId || "").toLowerCase();
  if (!f || f === "none" || f === "normal") return null;

  const cfg = FILTER_TINT_CONFIG[f];
  if (!cfg) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {cfg.colors && (
        <LinearGradient
          colors={cfg.colors.map((c) => {
            const match = c.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/i);
            if (match) {
              const alpha = Math.min(1, Math.max(0, parseFloat(match[4]) * normIntensity)).toFixed(3);
              return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
            }
            return c;
          }) as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {cfg.bg && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: cfg.bg.replace(/([0-9.]+)\s*\)$/, (m, a) => `${(parseFloat(a) * normIntensity).toFixed(3)})`),
            },
          ]}
        />
      )}
      {cfg.contrast && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: `rgba(255, 255, 255, ${(0.07 * normIntensity).toFixed(3)})`,
            },
          ]}
        />
      )}
    </View>
  );
}

const HSL_CHANNEL_TINTS: Record<string, string> = {
  red: "#EF4444",
  orange: "#F97316",
  yellow: "#EAB308",
  green: "#22C55E",
  cyan: "#06B6D4",
  blue: "#3B82F6",
  purple: "#A855F7",
  magenta: "#EC4899",
};

function renderNativeHslOverlay(hslAdjustments?: any) {
  if (!hslAdjustments || !isHslActive(hslAdjustments)) return null;

  let totalWeight = 0;
  let weightedHue = 0;
  let weightedSat = 0;
  let weightedLum = 0;
  let maxChannelDev = 0;
  let dominantChannel = "red";
  let dominantSat = 0;
  let dominantHue = 0;

  for (let i = 0; i < HSL_CHANNEL_KEYS.length; i++) {
    const ch = HSL_CHANNEL_KEYS[i];
    const cfg = hslAdjustments[ch];
    if (!cfg) continue;
    const metric = HSL_CHANNEL_METRICS[ch];
    if (!metric) continue;

    const h = cfg.hue || 0;
    const s = cfg.saturation || 0;
    const l = cfg.luminance || 0;
    if (h === 0 && s === 0 && l === 0) continue;

    const w = metric.weight;
    totalWeight += w;
    weightedHue += h * w;
    weightedSat += s * w;
    weightedLum += l * w;

    const dev = Math.abs(s) * 1.2 + Math.abs(l) * 0.8 + Math.abs(h) * 0.5;
    if (dev > maxChannelDev) {
      maxChannelDev = dev;
      dominantChannel = ch;
      dominantSat = s;
      dominantHue = h;
    }
  }

  if (totalWeight <= 0) return null;

  const effectiveLum = weightedLum / totalWeight;
  const effectiveSat = weightedSat / totalWeight;
  const dominantColor = HSL_CHANNEL_TINTS[dominantChannel] || "#00F2FE";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {effectiveLum < -2 && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#000000",
              opacity: Math.min(0.85, (Math.abs(effectiveLum) / 100) * 0.72),
            },
          ]}
        />
      )}
      {effectiveLum > 2 && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#FFFFFF",
              opacity: Math.min(0.55, (effectiveLum / 100) * 0.42),
            },
          ]}
        />
      )}
      {effectiveSat < -2 && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#1C1C22",
              opacity: Math.min(0.82, (Math.abs(effectiveSat) / 100) * 0.68),
            },
          ]}
        />
      )}
      {(Math.abs(dominantSat) > 4 || Math.abs(dominantHue) > 4) && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: dominantColor,
              opacity: Math.min(
                0.32,
                (Math.abs(dominantSat) / 100) * 0.18 + (Math.abs(dominantHue) / 180) * 0.16,
              ),
            },
          ]}
        />
      )}
    </View>
  );
}

function renderNativeCutoutOverlay(_vid: any) {
  // Cutout strokes are applied as a silhouette glow directly onto the transparent alpha matte,
  // preventing unwanted rectangular box lines from appearing around the clip container.
  return null;
}

/**
 * Renders the AI-cutout or Chroma Key processed frame as an Image overlay on native.
 * Shows when cutout is enabled and a processed PNG URI exists.
 * The PNG has a transparent background from Rust/JS segmentation.
 */
function NativeCutoutLayer({
  clipId,
  frameIdx,
  cutout,
}: {
  clipId: string;
  frameIdx: number;
  cutout: any;
}) {
  const [, forceUpdate] = React.useState(0);

  React.useEffect(() => {
    const onMask = () => forceUpdate((v) => v + 1);
    const unsub = setOnMaskUpdated(onMask);
    return () => {
      unsub();
    };
  }, [clipId]);

  const maskUri = getNativeMaskUri(clipId, frameIdx) ?? getNativeMaskUri(clipId, 0);

  if (!maskUri || !cutout?.enabled) return null;

  const hasStroke =
    cutout.strokeColor &&
    cutout.strokeColor !== "none" &&
    cutout.strokeColor !== "transparent" &&
    cutout.strokeWidth &&
    cutout.strokeWidth > 0;
  const strokeW = Math.max(1, Math.min(16, cutout.strokeWidth || 3));
  const strokeColor = cutout.strokeColor || "#00F2FE";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {cutout.bgColor && cutout.bgColor !== "none" && cutout.bgColor !== "transparent" && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: cutout.bgColor }]} />
      )}
      <ExpoImage
        source={{ uri: maskUri }}
        style={[
          StyleSheet.absoluteFill,
          hasStroke && {
            shadowColor: strokeColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.95,
            shadowRadius: strokeW * 2,
          },
        ]}
        contentFit="contain"
        cachePolicy="none"
      />
    </View>
  );
}

function renderEffectContent(
  eff: { id?: string; type?: string; filter?: string; intensity?: number },
  width: number,
  height: number,
  currentTime: number,
): React.ReactNode {
  const intensity = eff.intensity !== undefined ? eff.intensity : 0.8;
  const type = (eff.type || "").toLowerCase().replace(/[-_]/g, "");

  // 0. Filter clip on timeline
  if (eff.filter || eff.type?.startsWith("filter_")) {
    const filterName = (eff.filter || eff.type.replace(/^filter_/, "")).toLowerCase();
    let tint = "rgba(0,0,0,0)";
    if (filterName === "cyberpunk") tint = `rgba(0, 242, 254, ${0.16 * intensity})`;
    else if (filterName === "warm" || filterName === "vintage" || filterName === "sunset") tint = `rgba(255, 160, 0, ${0.15 * intensity})`;
    else if (filterName === "cool" || filterName === "frost") tint = `rgba(0, 140, 255, ${0.14 * intensity})`;
    else if (filterName === "bw" || filterName === "noir") tint = `rgba(20, 20, 20, ${0.35 * intensity})`;
    else if (filterName === "cinematic") tint = `rgba(15, 25, 45, ${0.18 * intensity})`;
    else if (filterName === "emerald") tint = `rgba(16, 185, 129, ${0.14 * intensity})`;
    else tint = `rgba(255, 255, 255, ${0.08 * intensity})`;
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      </View>
    );
  }

  // 1. Dark Vignette / Cinematic Border
  if (type === "vignette" || type === "darkborder") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["rgba(0,0,0," + (0.75 * intensity) + ")", "transparent", "transparent", "rgba(0,0,0," + (0.75 * intensity) + ")"]}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: Math.round(20 * intensity),
              borderColor: "rgba(0, 0, 0, " + (0.65 * intensity) + ")",
              borderRadius: 4,
            },
          ]}
        />
      </View>
    );
  }

  // 2. Cinema Letterbox Bars
  if (type === "cinematic" || type === "letterbox" || type === "bars") {
    const barH = Math.round(height * 0.12 * intensity);
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: barH, backgroundColor: "#000000" }} />
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: barH, backgroundColor: "#000000" }} />
      </View>
    );
  }

  // 3. Glitch Shake
  if (type === "glitch") {
    const shift1 = Math.round(((Math.sin(currentTime * 45) * 6) + 4) * intensity);
    const shift2 = Math.round(((Math.cos(currentTime * 38) * 6) + 4) * intensity);
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              left: shift1,
              backgroundColor: "rgba(0, 242, 254, " + (0.22 * intensity) + ")",
            },
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              left: -shift2,
              backgroundColor: "rgba(255, 0, 80, " + (0.22 * intensity) + ")",
            },
          ]}
        />
        <View
          style={{
            position: "absolute",
            top: "28%",
            left: shift1 * 1.5,
            right: 0,
            height: 16,
            backgroundColor: "rgba(0, 242, 254, " + (0.4 * intensity) + ")",
          }}
        />
        <View
          style={{
            position: "absolute",
            top: "62%",
            left: -shift2 * 1.5,
            right: 0,
            height: 12,
            backgroundColor: "rgba(255, 0, 80, " + (0.4 * intensity) + ")",
          }}
        />
      </View>
    );
  }

  // 4. RGB Split
  if (type === "rgbsplit") {
    const offset = Math.max(3, Math.round(6 * intensity));
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              left: offset,
              backgroundColor: "rgba(0, 242, 254, " + (0.28 * intensity) + ")",
            },
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              left: -offset,
              backgroundColor: "rgba(255, 0, 80, " + (0.28 * intensity) + ")",
            },
          ]}
        />
      </View>
    );
  }

  // 5. Action Shake
  if (type === "shake" || type === "earthquake") {
    const jx = Math.round((Math.sin(currentTime * 36) * 5) * intensity);
    const jy = Math.round((Math.cos(currentTime * 48) * 5) * intensity);
    return (
      <View
        key={eff.id}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX: jx }, { translateY: jy }],
          },
        ]}
      />
    );
  }

  // 6. Zoom Pulse / Heartbeat
  if (type === "zoompulse" || type === "pulse" || type === "heartbeat") {
    const pulse = (0.04 + Math.abs(Math.sin(currentTime * 8)) * 0.08) * intensity;
    return (
      <View
        key={eff.id}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: Math.round(4 + pulse * 20),
            borderColor: "rgba(0, 242, 254, " + (0.45 + pulse * 4) + ")",
            borderRadius: 6,
          },
        ]}
      />
    );
  }

  // 7. Neon Glow Edge
  if (type === "neonedge" || type === "neon") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: Math.round(6 * intensity),
              borderColor: "rgba(0, 242, 254, 0.85)",
              borderRadius: 8,
            },
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              margin: 4,
              borderWidth: Math.round(2 * intensity),
              borderColor: "rgba(255, 0, 80, 0.7)",
              borderRadius: 6,
            },
          ]}
        />
      </View>
    );
  }

  // 8. Strobe Flash
  if (type === "flash") {
    const flashPulse = Math.abs(Math.sin(currentTime * 16));
    const alpha = Math.min(0.85, (0.28 + flashPulse * 0.55) * intensity);
    return (
      <View
        key={eff.id}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "rgba(255, 255, 255, " + alpha + ")",
          },
        ]}
      />
    );
  }

  // 9. Retro VHS & CRT Screen
  if (type === "vhs" || type === "crttv") {
    const barY = Math.floor(((currentTime * 180) + 40) % Math.max(20, height - 20));
    const secs = Math.floor(currentTime).toString().padStart(2, "0");
    const ms = Math.floor((currentTime % 1) * 30).toString().padStart(2, "0");
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0, 0, 0, 0.15)" }]} />
        <View
          style={{
            position: "absolute",
            top: barY,
            left: 0,
            right: 0,
            height: 14,
            backgroundColor: "rgba(255, 255, 255, 0.28)",
          }}
        />
        <View style={{ position: "absolute", bottom: 16, left: 16, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: "#00FF66", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontWeight: "800", fontSize: 13, textShadowColor: "#000", textShadowRadius: 3 }}>
            PLAY ▶ SP 00:{secs}:{ms}
          </Text>
        </View>
      </View>
    );
  }

  // 10. Film Grain & 1920s Old Film
  if (type === "filmgrain" || type === "oldfilm") {
    const jitterLine = Math.floor(((currentTime * 320) + 80) % (width || 300));
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(160, 100, 30, " + (0.22 * intensity) + ")" }]} />
        <View style={{ position: "absolute", top: 0, bottom: 0, left: jitterLine, width: 2, backgroundColor: "rgba(255, 255, 255, 0.35)" }} />
      </View>
    );
  }

  // 11. Prism Light Leak & Sun Flare
  if (type === "prismleak" || type === "sunflare" || type === "lightleak") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["rgba(255, 170, 0, " + (0.45 * intensity) + ")", "transparent", "rgba(255, 210, 60, " + (0.35 * intensity) + ")"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  // 12. Cyberpunk Dual
  if (type === "cyberpunkdual" || type === "cyberpunk") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["rgba(0, 242, 254, " + (0.32 * intensity) + ")", "transparent", "rgba(255, 0, 128, " + (0.32 * intensity) + ")"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  // 13. Rainbow Psyche Flow
  if (type === "rainbowflow" || type === "rainbow") {
    const hue = Math.floor((currentTime * 120) % 360);
    return (
      <View
        key={eff.id}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: `hsla(${hue}, 90%, 50%, ${0.18 * intensity})`,
          },
        ]}
      />
    );
  }

  // 14. Blur / Cinematic Blur / Tilt Shift
  if (type === "blur" || type === "blurcinematic" || type === "tiltshift" || type === "gaussianblur" || type === "radialblur" || type === "motionblur") {
    return (
      <View
        key={eff.id}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "rgba(15, 23, 42, " + (0.36 * intensity) + ")",
          },
        ]}
      />
    );
  }

  // 15. Mirror & Kaleidoscope Split
  if (type === "mirror" || type === "kaleidoscope") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, opacity: 0.12 * intensity, backgroundColor: "rgba(0, 242, 254, 0.2)" }} />
      </View>
    );
  }

  // 16. Thermal Infrared Heatmap
  if (type === "thermal") {
    return (
      <View
        key={eff.id}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "rgba(255, 0, 128, " + (0.24 * intensity) + ")",
          },
        ]}
      />
    );
  }

  // 17. AI Beauty Smooth Glow
  if (type === "beautysmooth" || type === "aibeautysmooth") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[
            `rgba(255, 235, 230, ${0.25 * intensity})`,
            `rgba(255, 215, 210, ${0.1 * intensity})`,
            `rgba(255, 240, 235, ${0.2 * intensity})`,
          ]}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: Math.round(12 * intensity),
              borderColor: `rgba(255, 255, 255, ${0.2 * intensity})`,
            },
          ]}
        />
      </View>
    );
  }

  // 18. AI Cyberpunk Glow
  if (type === "aicyberpunk") {
    const glowThick = Math.max(3, Math.round(6 * intensity));
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[`rgba(0, 242, 254, ${0.32 * intensity})`, "transparent", `rgba(255, 0, 128, ${0.32 * intensity})`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderTopWidth: glowThick,
              borderTopColor: "rgba(0, 242, 254, 0.85)",
              borderBottomWidth: glowThick,
              borderBottomColor: "rgba(255, 0, 128, 0.85)",
            },
          ]}
        />
      </View>
    );
  }

  // 19. AI Anime Manga
  if (type === "aimanga" || type === "manga") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0, 0, 0, ${0.28 * intensity})` }]} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 16, backgroundColor: `rgba(0, 0, 0, ${0.7 * intensity})` }} />
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 16, backgroundColor: `rgba(0, 0, 0, ${0.7 * intensity})` }} />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: Math.max(4, Math.round(8 * intensity)),
              borderColor: "rgba(255, 255, 255, 0.35)",
            },
          ]}
        />
      </View>
    );
  }

  // 20. AI Matrix Cascade
  if (type === "aimatrix" || type === "matrix") {
    const barY = Math.floor(((currentTime * 220) + 50) % (height || 400));
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0, 255, 100, ${0.12 * intensity})` }]} />
        <View
          style={{
            position: "absolute",
            top: barY,
            left: 0,
            right: 0,
            height: 14,
            backgroundColor: `rgba(0, 255, 120, ${0.35 * intensity})`,
          }}
        />
        <View style={{ position: "absolute", top: 12, right: 14 }}>
          <Text style={{ color: "#00FF66", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontWeight: "800", fontSize: 11, textShadowColor: "#000", textShadowRadius: 3 }}>
            AI MATRIX // RUNNING
          </Text>
        </View>
      </View>
    );
  }

  // 21. AI Radiant Aura
  if (type === "aiaura" || type === "aura") {
    const pulse = (0.5 + Math.sin(currentTime * 6) * 0.35) * intensity;
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: Math.round(10 * (0.8 + pulse * 0.5)),
              borderColor: `rgba(0, 242, 254, ${0.5 + pulse * 0.4})`,
              borderRadius: 12,
            },
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              margin: 6,
              borderWidth: Math.round(4 * (0.8 + pulse * 0.5)),
              borderColor: `rgba(255, 0, 128, ${0.45 + pulse * 0.4})`,
              borderRadius: 8,
            },
          ]}
        />
      </View>
    );
  }

  // 22. AI Night Vision
  if (type === "ainightvision" || type === "nightvision") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(10, 255, 60, ${0.22 * intensity})` }]} />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: Math.round(24 * intensity),
              borderColor: "rgba(0, 0, 0, 0.7)",
              borderRadius: Math.round(Math.min(width, height) * 0.45),
            },
          ]}
        />
        <View style={{ position: "absolute", top: 12, left: 14 }}>
          <Text style={{ color: "#00FF66", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontWeight: "800", fontSize: 11, textShadowColor: "#000", textShadowRadius: 3 }}>
            AI NVG-GEN4 // 1080P
          </Text>
        </View>
      </View>
    );
  }

  // 23. AI Cel Cartoon
  if (type === "aicartoon" || type === "cartoon") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: Math.round(8 * intensity),
              borderColor: "rgba(255, 230, 0, 0.8)",
              borderRadius: 6,
            },
          ]}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255, 230, 0, ${0.08 * intensity})` }]} />
      </View>
    );
  }

  // 24. Water Ripple
  if (type === "waterripple") {
    const rScale = 1.0 + Math.sin(currentTime * 6) * 0.05 * intensity;
    return (
      <View
        key={eff.id}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <View
          style={{
            width: Math.round(180 * rScale),
            height: Math.round(180 * rScale),
            borderRadius: 999,
            borderWidth: 3,
            borderColor: "rgba(0, 242, 254, " + (0.55 * intensity) + ")",
          }}
        />
      </View>
    );
  }

  // 25. Fisheye Lens
  if (type === "fisheye") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: Math.round(28 * intensity),
              borderColor: "rgba(0, 0, 0, 0.75)",
              borderRadius: Math.round(Math.min(width, height) * 0.45),
            },
          ]}
        />
      </View>
    );
  }

  // 26. Mosaic Pixelate Blur
  if (type === "mosaicblur") {
    return (
      <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0, 0, 0, ${0.35 * intensity})` }]} />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: 2,
              borderColor: "rgba(0, 242, 254, 0.3)",
            },
          ]}
        />
      </View>
    );
  }

  return null;
}

function renderNativeClipEffectOverlay(
  vid: any,
  clipW: number,
  clipH: number,
  currentTime: number,
) {
  const effType = typeof vid.effect === "string" ? vid.effect : (vid.effect?.type || vid.effect?.id);
  if (!effType || effType === "none" || effType === "None") return null;
  const intensity = vid.effectIntensity !== undefined ? vid.effectIntensity : 0.8;
  return renderEffectContent(
    { id: `clip-eff-${vid.id}`, type: effType, intensity },
    clipW,
    clipH,
    currentTime,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const CachedMaskSvg = React.memo(function CachedMaskSvg({
  xml,
  width,
  height,
}: {
  xml: string;
  width: number;
  height: number;
}) {
  return <SvgXml xml={xml} width={width} height={height} />;
});

function renderMaskedClipContent(
  mediaNode: React.ReactNode,
  mask: MaskConfig | null | undefined,
  w: number,
  h: number,
) {
  if (!mask || !mask.shape || mask.shape === "none") return mediaNode;
  const svg = buildMaskSvg(mask, w, h, Platform.OS === "android");
  if (!svg) return mediaNode;
  if (Platform.OS === "web") return mediaNode;

  return (
    <MaskedView
      style={{ width: w, height: h }}
      maskElement={<CachedMaskSvg xml={svg} width={w} height={h} />}
    >
      {mediaNode}
    </MaskedView>
  );
}

const PlayerNativeCompositorComponent: React.FC<PlayerNativeCompositorProps> = ({
  activeVideos,
  activeAudios = [],
  activeCaptions = [],
  activeTexts,
  activeStickers,
  activeEffects,
  activeTransient,
  currentTime,
  isPlaying,
  boxWidth,
  canvasHeight,
  canvasBackground,
  onSelectClip,
  getItemBaseDimensions,
  getInterpolatedTransform,
}) => {
  const pinnedTracksMap = React.useMemo(() => {
    const tracks = new Map<string, any>();
    for (let i = 0; i < activeVideos.length; i++) {
      const video = activeVideos[i];
      if (video.motionTrack?.enabled && video.motionTrack.pinnedClipId) {
        tracks.set(video.motionTrack.pinnedClipId, video.motionTrack);
      }
    }
    return tracks;
  }, [activeVideos]);
  const [, setMaskVersion] = React.useState(0);
  React.useEffect(() => {
    const onMaskUpdate = () => setMaskVersion((v) => v + 1);
    const unsub = setOnMaskUpdated(onMaskUpdate);
    return () => {
      unsub();
    };
  }, []);
  const rawBg = canvasBackground || "#000000";
  const isBlur = rawBg.startsWith("blur:");
  const isImage = rawBg.startsWith("image:");
  const isGradient = rawBg.startsWith("gradient:");
  const effectiveBgColor = isBlur
    ? "rgba(11, 13, 19, 0.95)"
    : isGradient
    ? rawBg.replace("gradient:", "").split(",")[0] || "#0B0D13"
    : isImage
    ? "#000000"
    : rawBg;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.nativeCompositorContainer,
        { backgroundColor: effectiveBgColor },
      ]}
      pointerEvents="box-none"
    >
      {/* Background Custom Image Fill */}
      {isImage && (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
          <ExpoImage
            source={{ uri: rawBg.replace('image:', '') }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        </View>
      )}

      {/* Background Dynamic Blur Fill (Live from active video or photo) */}
      {(() => {
        if (!isBlur) return null;
        const currentVid =
          activeVideos.find(
            (v) =>
              currentTime >= v.startTime &&
              currentTime <= v.startTime + v.duration &&
              !v.cutout?.enabled,
          ) || activeVideos.find((v) => !v.cutout?.enabled);
        if (!currentVid) return null;
        const blurAmount = parseInt(rawBg.replace("blur:", ""), 10) || 25;

        // 1. Live video player for video clips on Web only (avoids exhausting mobile hardware decoders)
        if (Platform.OS === "web" && currentVid.type === "video" && currentVid.url) {
          return (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  overflow: "hidden",
                  opacity: 0.75,
                  transform: [{ scale: 1.45 }],
                },
                Platform.OS === "web"
                  ? ({ filter: `blur(${blurAmount}px)` } as any)
                  : null,
              ]}
              pointerEvents="none"
            >
              <NativeVideoClipPlayer
                clip={currentVid}
                currentTime={currentTime}
                isPlaying={isPlaying}
              />
            </View>
          );
        }

        // 2. High-performance blurred media image fill (Native mobile & photo clips)
        const mediaUri =
          (currentVid?.type === "photo" ? currentVid?.url : null) ||
          currentVid?.thumbnail ||
          currentVid?.url;
        if (!mediaUri) return null;

        return (
          <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
            <ExpoImage
              source={{ uri: mediaUri }}
              style={[
                StyleSheet.absoluteFill,
                { opacity: 0.72, transform: [{ scale: 1.45 }] },
                Platform.OS === 'web' ? ({ filter: `blur(${blurAmount}px)` } as any) : null,
              ]}
              blurRadius={blurAmount}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </View>
        );
      })()}

      {/* Layer 1: Active Video / Image Clips */}
      {activeVideos.map((vid) => {
        const isTrans = activeTransient && activeTransient.clipId === vid.id;
        const kfT = getInterpolatedTransform(vid, currentTime);
        const posX = (isTrans && !activeTransient!.mask)
          ? activeTransient!.x
          : (kfT?.x ?? vid.transform?.x ?? 0);
        const posY = (isTrans && !activeTransient!.mask)
          ? activeTransient!.y
          : (kfT?.y ?? vid.transform?.y ?? 0);
        const baseScale = (isTrans && !activeTransient!.mask)
          ? activeTransient!.scale
          : (kfT?.scale ?? vid.transform?.scale ?? vid.scale ?? 1.0);
        const rot = (isTrans && !activeTransient!.mask)
          ? activeTransient!.rotation
          : (kfT?.rotation ?? vid.transform?.rotation ?? vid.rotation ?? 0);
        const opacity =
          (kfT?.opacity ?? 1) * (vid.opacity !== undefined ? vid.opacity : 1);

        let motionX = 0;
        let motionY = 0;
        let motionScale = 1.0;
        let motionRot = 0;
        // Video movement: Camera Center stabilization OR Pinned overlay video
        const effectiveTrack = (vid.motionTrack && vid.motionTrack.enabled)
          ? vid.motionTrack
          : pinnedTracksMap.get(vid.id);

        if (effectiveTrack && effectiveTrack.enabled) {
          const isCameraCenter = effectiveTrack.actionType === 'camera_center' && vid.motionTrack?.actionType === 'camera_center';
          const isPinnedOverlay = effectiveTrack.pinnedClipId === vid.id;

          if (isCameraCenter || isPinnedOverlay) {
            const motion = applyMotionTracking(currentTime, vid.startTime, vid.duration, effectiveTrack);
            motionX = (motion.dx / 100) * boxWidth;
            motionY = (motion.dy / 100) * canvasHeight;
            motionScale = motion.dScale;
            motionRot = motion.dRot;
          }
        }

        const effScale = baseScale * motionScale;
        const effRot = rot + motionRot;
        const clipDims = computeVideoClipDimensions(vid, boxWidth, canvasHeight);
        const baseW = clipDims.baseW;
        const baseH = clipDims.baseH;
        const fullW = Math.round(clipDims.uncroppedW * effScale);
        const fullH = Math.round(clipDims.uncroppedH * effScale);
        const w = Math.round(baseW * effScale);
        const h = Math.round(baseH * effScale);
        const cx = boxWidth / 2 + posX + motionX;
        const cy = canvasHeight / 2 + posY + motionY;

        const mask = (isTrans && activeTransient?.mask) ? activeTransient.mask : (kfT?.mask || vid.mask || vid.transform?.mask);
        const crop = vid.crop || vid.transform?.crop;
        const hasCrop =
          !!crop &&
          (crop.width < 100 ||
            crop.height < 100 ||
            crop.x > 0 ||
            crop.y > 0);

        const hasMaskShape = Boolean(mask?.shape && mask.shape !== "none");
        let webMaskStyle: any = undefined;
        if (hasMaskShape && Platform.OS === "web") {
          const maskWidth = hasCrop ? Math.round(fullW * Math.max(0.01, crop.width / 100)) : w;
          const maskHeight = hasCrop ? Math.round(fullH * Math.max(0.01, crop.height / 100)) : h;
          const maskUri = maskSvgDataUri(mask, maskWidth, maskHeight);
          if (maskUri) {
            webMaskStyle = {
              maskImage: `url("${maskUri}")`,
              WebkitMaskImage: `url("${maskUri}")`,
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            };
          }
        }

        // Pre-warm & transition states for seamless 60fps cuts
        const isInside = currentTime >= vid.startTime && currentTime <= vid.startTime + vid.duration;
        const isUpcoming = currentTime < vid.startTime;
        const isRecent = currentTime > vid.startTime + vid.duration;

        let effectiveOpacity = isUpcoming ? 0 : opacity;
        let isInteractive = isInside;
        let transX = 0;
        let transY = 0;
        let transScaleModifier = 1.0;

        // Transition handling for cross-clip transitions
        const cEnd = vid.startTime + vid.duration;
        const trans = vid.transition;
        const transDur = trans && trans.type && trans.type !== "none" && trans.type !== "cut" ? (trans.duration || 0.5) : 0;

        if (transDur > 0 && currentTime >= cEnd - transDur && currentTime <= cEnd) {
          // Outgoing clip
          const p = Math.max(0, Math.min(1, (currentTime - (cEnd - transDur)) / transDur));
          if (trans.type === "dissolve") effectiveOpacity *= (1 - p);
          else if (trans.type === "zoom_in") { transScaleModifier *= (1 + p * 0.3); effectiveOpacity *= (1 - p); }
          else if (trans.type === "zoom_out") { transScaleModifier *= (1 - p * 0.3); effectiveOpacity *= (1 - p); }
          else if (trans.type === "slide_left") transX -= p * w;
          else if (trans.type === "slide_right") transX += p * w;
          else if (trans.type === "push_up") transY -= p * h;
          else if (trans.type === "push_down") transY += p * h;
          else if (trans.type === "fade_black") effectiveOpacity *= Math.max(0, 1 - p * 2);
          else if (trans.type === "flash_white") { if (p > 0.5) effectiveOpacity = 0; }
        } else if (isUpcoming) {
          // Check if this upcoming clip is receiving an incoming transition from adjacent previous clip
          const prevClip = activeVideos.find(
            (other) =>
              other.id !== vid.id &&
              (other.trackIndex || 0) === (vid.trackIndex || 0) &&
              Math.abs(other.startTime + other.duration - vid.startTime) < 0.35,
          );
          if (prevClip && prevClip.transition && prevClip.transition.type && prevClip.transition.type !== "none" && prevClip.transition.type !== "cut") {
            const prevTrans = prevClip.transition;
            const prevTransDur = prevTrans.duration || 0.5;
            const prevEnd = prevClip.startTime + prevClip.duration;
            if (currentTime >= prevEnd - prevTransDur && currentTime <= prevEnd) {
              const p = Math.max(0, Math.min(1, (currentTime - (prevEnd - prevTransDur)) / prevTransDur));
              effectiveOpacity = opacity * p;
              if (prevTrans.type === "zoom_in") transScaleModifier *= (0.8 + p * 0.2);
              else if (prevTrans.type === "zoom_out") transScaleModifier *= (1.3 - p * 0.3);
              else if (prevTrans.type === "slide_left") transX += (1 - p) * w;
              else if (prevTrans.type === "slide_right") transX -= (1 - p) * w;
              else if (prevTrans.type === "push_up") transY += (1 - p) * h;
              else if (prevTrans.type === "push_down") transY -= (1 - p) * h;
              else if (prevTrans.type === "fade_black") effectiveOpacity = opacity * Math.max(0, (p - 0.5) * 2);
              else if (prevTrans.type === "flash_white") { if (p < 0.5) effectiveOpacity = 0; }
            }
          }
        } else if (isRecent) {
          // A clip that has finished must not render beyond its duration
          effectiveOpacity = 0;
          isInteractive = false;
        }

        let vidAnimAlpha = 1.0;
        let vidAnimScaleX = 1.0;
        let vidAnimScaleY = 1.0;
        let vidAnimOffsetX = 0;
        let vidAnimOffsetY = 0;
        let vidAnimRot = 0;
        if (vid.animation && vid.animation !== "none") {
          const vElapsed = Math.max(0, currentTime - (vid.startTime || 0));
          const vDur = Math.max(0.1, vid.duration || 3.0);
          const vEval = evaluateClipAnimation(
            vid.animation,
            vElapsed,
            vDur,
            w,
            h,
            1.0
          );
          vidAnimAlpha = vEval.alpha;
          vidAnimScaleX = vEval.scaleX;
          vidAnimScaleY = vEval.scaleY;
          vidAnimOffsetX = vEval.offsetX;
          vidAnimOffsetY = vEval.offsetY;
          vidAnimRot = vEval.rotation;
        }

        const vidTrk = typeof vid.trackIndex === "number" ? vid.trackIndex : 0;
        const vidZ = vidTrk * 100 + (isInside ? 10 : isUpcoming ? 1 : 4);
        const vidElevation = Math.max(1, Math.floor(vidZ / 10));

        effectiveOpacity *= vidAnimAlpha;
        const effScaleX = (vid.transform?.flipX ? -1 : 1) * (vid.transform?.scaleX ?? kfT?.scaleX ?? 1.0) * transScaleModifier * vidAnimScaleX;
        const effScaleY = (vid.transform?.flipY ? -1 : 1) * (vid.transform?.scaleY ?? kfT?.scaleY ?? 1.0) * transScaleModifier * vidAnimScaleY;
        const rotX = vid.transform?.rotateX ?? kfT?.rotateX ?? 0;
        const rotY = vid.transform?.rotateY ?? kfT?.rotateY ?? 0;
        const skewX = vid.transform?.skewX ?? kfT?.skewX ?? 0;
        const persp = vid.transform?.perspective ?? kfT?.perspective ?? 800;

        const clipTransformArray: any[] = [
          { perspective: isNaN(persp) ? 800 : persp },
          { rotateX: `${isNaN(rotX) ? 0 : rotX}deg` },
          { rotateY: `${isNaN(rotY) ? 0 : rotY}deg` },
          { rotate: `${isNaN(effRot + vidAnimRot) ? 0 : effRot + vidAnimRot}deg` },
          ...(skewX && !isNaN(skewX) && skewX !== 0 ? [{ skewX: `${skewX}deg` }] : []),
          { scaleX: isNaN(effScaleX) ? 1.0 : effScaleX },
          { scaleY: isNaN(effScaleY) ? 1.0 : effScaleY },
        ].filter(Boolean);

        if (hasCrop) {
          const cropW = Math.max(0.01, crop.width / 100);
          const cropH = Math.max(0.01, crop.height / 100);
          const cropX = Math.max(0, crop.x / 100);
          const cropY = Math.max(0, crop.y / 100);
          const croppedContainerW = Math.round(fullW * cropW);
          const croppedContainerH = Math.round(fullH * cropH);

          const blendMode = vid.blendMode || vid.transform?.blendMode || "normal";
          const webBlendStyle =
            Platform.OS === "web" && blendMode !== "normal"
              ? ({ mixBlendMode: blendMode } as any)
              : undefined;

          const baseFilterCss = vid.customLut?.cssFilter || (vid.filter && vid.filter !== "none" && vid.filter !== "normal" ? FILTER_CSS_MAP[vid.filter] : "");
          const scaledFilterCss = baseFilterCss ? scaleCssFilter(baseFilterCss, vid.filterIntensity ?? 1.0) : "";
          const clipBlur = (vid as any).blur || vid.transform?.blur || 0;
          const blurFilter = clipBlur > 0 ? `blur(${clipBlur}px)` : "";
          const hslFilter = vid.hslAdjustments ? buildHslCssFilter(vid.hslAdjustments) : "";
          const filterParts = [scaledFilterCss, blurFilter, hslFilter].filter(Boolean);
          const filterStr = filterParts.join(" ");
          const webBlurStyle =
            Platform.OS === "web" && filterStr
              ? ({ filter: filterStr } as any)
              : undefined;

          return (
            <TouchableOpacity
              key={vid.id}
              activeOpacity={0.98}
              disabled={!isInteractive}
              onPress={() => onSelectClip?.(vid.id, vid.type || "video")}
              style={[
                {
                  position: "absolute",
                  left: cx - croppedContainerW / 2 + transX + vidAnimOffsetX,
                  top: cy - croppedContainerH / 2 + transY + vidAnimOffsetY,
                  width: croppedContainerW,
                  height: croppedContainerH,
                  overflow: "hidden",
                  opacity: effectiveOpacity,
                  zIndex: vidZ,
                  elevation: vidElevation,
                  transform: clipTransformArray,
                },
                webMaskStyle,
                webBlendStyle,
                webBlurStyle,
              ]}
            >
              {renderMaskedClipContent(
                <View
                  needsOffscreenAlphaCompositing={effectiveOpacity < 1}
                  style={{
                    position: "absolute",
                    left: -Math.round(fullW * cropX),
                    top: -Math.round(fullH * cropY),
                    width: fullW,
                    height: fullH,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {(() => {
                    const isCutoutActive = Platform.OS !== "web" && !!vid.cutout?.enabled;
                    const elapsed = Math.max(0, currentTime - (vid.startTime || 0));
                    const effSpeed = Math.max(0.1, vid.speed || 1.0);
                    const bakedFps = getClipBakedFps(vid.id) || 20;
                    const activeFrameIdx = Math.max(0, Math.floor(elapsed * effSpeed * bakedFps));
                    const cutoutMaskUri = isCutoutActive
                      ? (getNativeMaskUri(vid.id, activeFrameIdx) ?? getNativeMaskUri(vid.id, 0))
                      : null;
                    const hideUnderlying = isCutoutActive && !!cutoutMaskUri;

                    return (
                      <>
                        <NativeVideoClipPlayer
                          clip={vid}
                          currentTime={currentTime}
                          isPlaying={isPlaying}
                          opacity={hideUnderlying ? 0 : effectiveOpacity}
                        />
                        {renderClipEnhanceOverlay(vid)}
                        {renderNativeFilterOverlay(vid.filter, vid.customLut, vid.filterIntensity ?? 1.0)}
                        {renderNativeHslOverlay(vid.hslAdjustments)}
                        {renderNativeClipEffectOverlay(vid, w, h, currentTime)}
                        {renderMosaicCensor(vid, w, h, currentTime)}
                        {renderNativeCutoutOverlay(vid)}
                        {isCutoutActive && (
                          <NativeCutoutLayer
                            clipId={vid.id}
                            frameIdx={activeFrameIdx}
                            cutout={vid.cutout}
                          />
                        )}
                      </>
                    );
                  })()}
                </View>,
                mask,
                croppedContainerW,
                croppedContainerH,
              )}
            </TouchableOpacity>
          );
        }

        const blendMode = vid.blendMode || vid.transform?.blendMode || "normal";
        const webBlendStyle =
          Platform.OS === "web" && blendMode !== "normal"
            ? ({ mixBlendMode: blendMode } as any)
            : undefined;

        const baseFilterCss = vid.customLut?.cssFilter || (vid.filter && vid.filter !== "none" && vid.filter !== "normal" ? FILTER_CSS_MAP[vid.filter] : "");
        const scaledFilterCss = baseFilterCss ? scaleCssFilter(baseFilterCss, vid.filterIntensity ?? 1.0) : "";
        const clipBlur = (vid as any).blur || vid.transform?.blur || 0;
        const blurFilter = clipBlur > 0 ? `blur(${clipBlur}px)` : "";
        const hslFilter = vid.hslAdjustments ? buildHslCssFilter(vid.hslAdjustments) : "";
        const filterParts = [scaledFilterCss, blurFilter, hslFilter].filter(Boolean);
        const filterStr = filterParts.join(" ");
        const webBlurStyle =
          Platform.OS === "web" && filterStr
            ? ({ filter: filterStr } as any)
            : undefined;

        return (
          <TouchableOpacity
            key={vid.id}
            activeOpacity={0.98}
            disabled={!isInteractive}
            onPress={() => onSelectClip?.(vid.id, vid.type || "video")}
            style={[
              {
                position: "absolute",
                left: cx - w / 2 + transX + vidAnimOffsetX,
                top: cy - h / 2 + transY + vidAnimOffsetY,
                width: w,
                height: h,
                justifyContent: "center",
                alignItems: "center",
                opacity: effectiveOpacity,
                overflow: hasMaskShape ? "hidden" : "visible",
                zIndex: vidZ,
                elevation: vidElevation,
                transform: clipTransformArray,
              },
              webMaskStyle,
              webBlendStyle,
              webBlurStyle,
            ]}
          >
            {renderMaskedClipContent(
              <View
                needsOffscreenAlphaCompositing={effectiveOpacity < 1}
                style={{
                  width: "100%",
                  height: "100%",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {(() => {
                  const isCutoutActive = Platform.OS !== "web" && !!vid.cutout?.enabled;
                  const elapsed = Math.max(0, currentTime - (vid.startTime || 0));
                  const effSpeed = Math.max(0.1, vid.speed || 1.0);
                  const bakedFps = getClipBakedFps(vid.id) || 20;
                  const activeFrameIdx = Math.max(0, Math.floor(elapsed * effSpeed * bakedFps));
                  const cutoutMaskUri = isCutoutActive
                    ? (getNativeMaskUri(vid.id, activeFrameIdx) ?? getNativeMaskUri(vid.id, 0))
                    : null;
                  const hideUnderlying = isCutoutActive && !!cutoutMaskUri;

                  return (
                    <>
                      <NativeVideoClipPlayer
                        clip={vid}
                        currentTime={currentTime}
                        isPlaying={isPlaying}
                        opacity={hideUnderlying ? 0 : effectiveOpacity}
                      />
                      {renderClipEnhanceOverlay(vid)}
                      {renderNativeFilterOverlay(vid.filter, vid.customLut, vid.filterIntensity ?? 1.0)}
                      {renderNativeHslOverlay(vid.hslAdjustments)}
                      {renderNativeClipEffectOverlay(vid, w, h, currentTime)}
                      {renderMosaicCensor(vid, w, h, currentTime)}
                      {renderNativeCutoutOverlay(vid)}
                      {isCutoutActive && (
                        <NativeCutoutLayer
                          clipId={vid.id}
                          frameIdx={activeFrameIdx}
                          cutout={vid.cutout}
                        />
                      )}
                    </>
                  );
                })()}
              </View>,
              mask,
              w,
              h,
            )}
          </TouchableOpacity>
        );
      })}

      {/* Layer 2: Active Text Overlays */}
      {activeTexts.map((txt) => {
        const isTrans = activeTransient && activeTransient.clipId === txt.id;
        const kfT = getInterpolatedTransform(txt, currentTime, "text");
        const effX = isTrans ? activeTransient!.x : kfT.x;
        const effY = isTrans ? activeTransient!.y : kfT.y;
        const baseS = isTrans ? activeTransient!.scale : kfT.scale;
        const rot = isTrans ? activeTransient!.rotation : kfT.rotation;
        const baseOpacity =
          (kfT.opacity ?? 1) * (txt.opacity !== undefined ? txt.opacity : 1);

        const elapsed = Math.max(0, currentTime - (txt.startTime || 0));
        const duration = Math.max(0.5, txt.duration || 3.0);
        const { baseW, baseH } = getItemBaseDimensions("text", txt);
        const previewScale = Math.max(0.2, (boxWidth || 360) / 360);

        const animEval = evaluateClipAnimation(
          txt.animation,
          elapsed,
          duration,
          baseW,
          baseH,
          previewScale,
          txt.text || ""
        );
        const animScale = (animEval.scaleX + animEval.scaleY) / 2;
        const animAlpha = animEval.alpha;
        const animOffsetX = animEval.offsetX;
        const animOffsetY = animEval.offsetY;
        const animRot = animEval.rotation;
        const displayText = animEval.displayText ?? (txt.text || "");

        let motionX = 0;
        let motionY = 0;
        let motionScale = 1.0;
        let motionRot = 0;
        const effectiveTrack = (txt.motionTrack && txt.motionTrack.enabled)
          ? txt.motionTrack
          : pinnedTracksMap.get(txt.id);
        if (effectiveTrack && effectiveTrack.enabled) {
          const motion = applyMotionTracking(currentTime, txt.startTime, txt.duration, effectiveTrack);
          motionX = (motion.dx / 100) * boxWidth;
          motionY = (motion.dy / 100) * canvasHeight;
          motionScale = motion.dScale;
          motionRot = motion.dRot;
        }

        const s = baseS * animScale * motionScale;
        const opacity = Math.max(0, Math.min(1, baseOpacity * animAlpha));
        const cx = (effX / 100) * boxWidth + animOffsetX + motionX;
        const cy = (effY / 100) * canvasHeight + animOffsetY + motionY;
        const effRot = rot + motionRot + animRot;
        const w = Math.round(baseW * s);
        const h = Math.round(baseH * s);
        const fontSize = txt.style?.fontSize || 22;

        const isTxtStroke =
          Boolean(
            txt.style?.strokeColor &&
              txt.style.strokeColor !== "none" &&
              txt.style.strokeColor !== "transparent",
          ) &&
          (txt.style?.strokeWidth ?? 0) > 0;
        const strokeW = Math.max(0.5, (txt.style?.strokeWidth || 2) * s * previewScale);
        const strokeC = txt.style?.strokeColor || "#000000";
        const txtTrk = typeof txt.trackIndex === "number" ? txt.trackIndex : 2;
        const txtZ = txtTrk * 100 + 20;
        const txtElevation = Math.max(1, Math.floor(txtZ / 10));

        return (
          <TouchableOpacity
            key={txt.id}
            activeOpacity={0.9}
            onPress={() => onSelectClip?.(txt.id, "text")}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: w,
              height: h,
              maxWidth: boxWidth * 0.9,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              opacity,
              zIndex: txtZ,
              elevation: txtElevation,
              transform: [
                { translateX: cx - w / 2 },
                { translateY: cy - h / 2 },
                { rotate: `${effRot}deg` },
              ],
            }}
          >
            <Text
              numberOfLines={6}
              style={[
                {
                  color: txt.style?.color || "#FFFFFF",
                  fontSize: Math.max(8, fontSize * s * previewScale),
                  fontWeight: (txt.style?.fontWeight as any) || "700",
                  backgroundColor: txt.style?.backgroundColor || "transparent",
                  textAlign: "center",
                  flexWrap: "wrap",
                  paddingHorizontal: 8 * s * previewScale,
                  paddingVertical: 4 * s * previewScale,
                  borderRadius: 4,
                  maxWidth: "100%",
                  ...(Platform.OS === "web" && isTxtStroke
                    ? ({
                        WebkitTextStroke: `${strokeW}px ${strokeC}`,
                        textShadow: `${-strokeW}px ${-strokeW}px 0 ${strokeC}, ${strokeW}px ${-strokeW}px 0 ${strokeC}, ${-strokeW}px ${strokeW}px 0 ${strokeC}, ${strokeW}px ${strokeW}px 0 ${strokeC}`,
                      } as any)
                    : isTxtStroke
                      ? {
                          textShadowColor: strokeC,
                          textShadowRadius: strokeW,
                          textShadowOffset: { width: 0, height: 0 },
                        }
                      : {}),
                },
              ]}
            >
              {displayText}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Layer 2b: Active Captions / Subtitles */}
      {activeCaptions.map((cap) => {
        const isTrans = activeTransient && activeTransient.clipId === cap.id;
        const kfT = getInterpolatedTransform(cap, currentTime, "caption");
        const effX = isTrans ? activeTransient!.x : kfT.x;
        const effY = isTrans ? activeTransient!.y : kfT.y;
        const baseS = isTrans ? activeTransient!.scale : kfT.scale;
        const rot = isTrans ? activeTransient!.rotation : kfT.rotation;
        const baseOpacity =
          (kfT.opacity ?? 1) * (cap.opacity !== undefined ? cap.opacity : 1);

        const elapsed = Math.max(0, currentTime - cap.startTime);
        const duration = Math.max(0.5, cap.duration || 2.0);
        const { baseW, baseH } = getItemBaseDimensions("caption", cap);
        const previewScale = Math.max(0.2, (boxWidth || 360) / 360);

        const animEval = evaluateClipAnimation(
          cap.animation,
          elapsed,
          duration,
          baseW,
          baseH,
          previewScale,
          cap.text || ""
        );
        const animScale = (animEval.scaleX + animEval.scaleY) / 2;
        const animAlpha = animEval.alpha;
        const animOffsetX = animEval.offsetX;
        const animOffsetY = animEval.offsetY;
        const animRot = animEval.rotation;
        const displayCapText = animEval.displayText ?? (cap.text || "");

        let motionX = 0;
        let motionY = 0;
        let motionScale = 1.0;
        let motionRot = 0;
        const effectiveTrack = (cap.motionTrack && cap.motionTrack.enabled)
          ? cap.motionTrack
          : pinnedTracksMap.get(cap.id);
        if (effectiveTrack && effectiveTrack.enabled) {
          const motion = applyMotionTracking(
            currentTime,
            cap.startTime,
            cap.duration,
            effectiveTrack,
          );
          motionX = (motion.dx / 100) * boxWidth;
          motionY = (motion.dy / 100) * canvasHeight;
          motionScale = motion.dScale;
          motionRot = motion.dRot;
        }

        const s = baseS * animScale * motionScale;
        const opacity = Math.max(0, Math.min(1, baseOpacity * animAlpha));
        const cx = (effX / 100) * boxWidth + animOffsetX + motionX;
        const cy = (effY / 100) * canvasHeight + animOffsetY + motionY;
        const effRot = rot + motionRot + animRot;
        const w = Math.round(baseW * s);
        const h = Math.round(baseH * s);
        const fontSize = cap.style?.fontSize || 24;

        const isCapStroke =
          Boolean(
            cap.style?.strokeColor &&
              cap.style.strokeColor !== "none" &&
              cap.style.strokeColor !== "transparent",
          ) &&
          (cap.style?.strokeWidth ?? 0) > 0;
        const capStrokeW = Math.max(0.5, (cap.style?.strokeWidth || 2) * s * previewScale);
        const capStrokeC = cap.style?.strokeColor || "#000000";
        const capTrk = typeof cap.trackIndex === "number" ? cap.trackIndex : 2;
        const capZ = capTrk * 100 + 15;
        const capElevation = Math.max(1, Math.floor(capZ / 10));

        return (
          <TouchableOpacity
            key={cap.id}
            activeOpacity={0.9}
            onPress={() => onSelectClip?.(cap.id, "caption")}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: w,
              height: h,
              maxWidth: boxWidth * 0.9,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              opacity,
              zIndex: capZ,
              elevation: capElevation,
              transform: [
                { translateX: cx - w / 2 },
                { translateY: cy - h / 2 },
                { rotate: `${effRot}deg` },
              ],
            }}
          >
            <Text
              numberOfLines={6}
              style={[
                {
                  color: cap.style?.color || "#FFE600",
                  fontSize: Math.max(10, fontSize * s * previewScale),
                  fontWeight: (cap.style?.fontWeight as any) || "900",
                  backgroundColor: cap.style?.backgroundColor || "transparent",
                  textAlign: "center",
                  flexWrap: "wrap",
                  paddingHorizontal: 12 * s * previewScale,
                  paddingVertical: 5 * s * previewScale,
                  borderRadius: 6,
                  maxWidth: "100%",
                  ...(Platform.OS === "web" && isCapStroke
                    ? ({
                        WebkitTextStroke: `${capStrokeW}px ${capStrokeC}`,
                        textShadow: `${-capStrokeW}px ${-capStrokeW}px 0 ${capStrokeC}, ${capStrokeW}px ${-capStrokeW}px 0 ${capStrokeC}, ${-capStrokeW}px ${capStrokeW}px 0 ${capStrokeC}, ${capStrokeW}px ${capStrokeW}px 0 ${capStrokeC}`,
                      } as any)
                    : isCapStroke
                      ? {
                          textShadowColor: capStrokeC,
                          textShadowRadius: capStrokeW,
                          textShadowOffset: { width: 0, height: 0 },
                        }
                      : {}),
                },
              ]}
            >
              {displayCapText}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Layer 3: Active Stickers */}
      {activeStickers.map((stk) => {
        const isTrans = activeTransient && activeTransient.clipId === stk.id;
        const kfT = getInterpolatedTransform(stk, currentTime, "sticker");
        const effX = isTrans ? activeTransient!.x : kfT.x;
        const effY = isTrans ? activeTransient!.y : kfT.y;
        const baseS = isTrans ? activeTransient!.scale : kfT.scale;
        const rot = isTrans ? activeTransient!.rotation : kfT.rotation;
        const baseOpacity =
          (kfT.opacity ?? 1) * (stk.opacity !== undefined ? stk.opacity : 1);

        let motionX = 0;
        let motionY = 0;
        let motionScale = 1.0;
        let motionRot = 0;
        const effectiveTrack = (stk.motionTrack && stk.motionTrack.enabled)
          ? stk.motionTrack
          : pinnedTracksMap.get(stk.id);
        if (effectiveTrack && effectiveTrack.enabled) {
          const motion = applyMotionTracking(currentTime, stk.startTime, stk.duration, effectiveTrack);
          motionX = (motion.dx / 100) * boxWidth;
          motionY = (motion.dy / 100) * canvasHeight;
          motionScale = motion.dScale;
          motionRot = motion.dRot;
        }

        const elapsed = Math.max(0, currentTime - (stk.startTime || 0));
        const duration = Math.max(0.5, stk.duration || 3.0);
        const { baseW, baseH } = getItemBaseDimensions("sticker", stk);
        const previewScale = Math.max(0.2, (boxWidth || 360) / 360);

        const animEval = evaluateClipAnimation(
          stk.animation,
          elapsed,
          duration,
          baseW,
          baseH,
          previewScale
        );
        const animScale = (animEval.scaleX + animEval.scaleY) / 2;
        const animAlpha = animEval.alpha;
        const animOffsetX = animEval.offsetX;
        const animOffsetY = animEval.offsetY;
        const animRot = animEval.rotation;

        const s = baseS * animScale * motionScale;
        const opacity = Math.max(0, Math.min(1, baseOpacity * animAlpha));
        const cx = (effX / 100) * boxWidth + animOffsetX + motionX;
        const cy = (effY / 100) * canvasHeight + animOffsetY + motionY;
        const effRot = rot + motionRot + animRot;
        const w = Math.round(baseW * s);
        const h = Math.round(baseH * s);
        const isBadge = (stk.char || "").length > 2;
        const stkTrk = typeof stk.trackIndex === "number" ? stk.trackIndex : 3;
        const stkZ = stkTrk * 100 + 25;
        const stkElevation = Math.max(1, Math.floor(stkZ / 10));

        return (
          <TouchableOpacity
            key={stk.id}
            activeOpacity={0.9}
            onPress={() => onSelectClip?.(stk.id, "sticker")}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: w,
              height: h,
              alignItems: "center",
              justifyContent: "center",
              opacity,
              zIndex: stkZ,
              elevation: stkElevation,
              transform: [
                { translateX: cx - w / 2 },
                { translateY: cy - h / 2 },
                { rotate: `${effRot}deg` },
              ],
            }}
          >
            <Text
              style={{
                fontSize: isBadge
                  ? Math.max(8, 16 * s * previewScale)
                  : Math.max(10, 38 * s * previewScale),
              }}
            >
              {stk.char}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Layer 4: Active Effects Overlays on Native Mobile */}
      {activeEffects.map((eff) => {
        const effTrk = typeof eff.trackIndex === "number" ? eff.trackIndex : 4;
        const effZ = effTrk * 100 + 50;
        const effElevation = Math.max(1, Math.floor(effZ / 10));
        const intensity = eff.intensity !== undefined ? eff.intensity : 0.8;
        const effectBody = renderEffectContent(
          { ...eff, intensity },
          boxWidth,
          canvasHeight,
          currentTime,
        );
        if (!effectBody) return null;

        return (
          <View
            key={eff.id}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { zIndex: effZ, elevation: effElevation },
            ]}
          >
            {effectBody}
          </View>
        );
      })}

      {/* Layer 5: Active Dedicated Audio Tracks (BGM, Voiceover, SFX) */}
      {activeAudios.map((audio) => (
        <NativeAudioTrackPlayer
          key={audio.id}
          clip={audio}
          currentTime={currentTime}
          isPlaying={isPlaying}
        />
      ))}
    </View>
  );
};

export const PlayerNativeCompositor = React.memo(PlayerNativeCompositorComponent);
export default PlayerNativeCompositor;
