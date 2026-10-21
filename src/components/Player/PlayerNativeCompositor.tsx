import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./PlayerStyles";
import { formatTime } from "./playerUtils";
import { TransientTransformState } from "./playerTypes";
import NativeVideoClipPlayer from "../NativeVideoClipPlayer";

interface PlayerNativeCompositorProps {
  activeVideos: any[];
  activeTexts: any[];
  activeStickers: any[];
  activeEffects: any[];
  activeTransient: TransientTransformState | null;
  currentTime: number;
  isPlaying: boolean;
  boxWidth: number;
  canvasHeight: number;
  onSelectClip?: (id: string | null, type?: string) => void;
  getItemBaseDimensions: (
    type: "text" | "sticker" | "video",
    clip: any,
  ) => { baseW: number; baseH: number };
  getInterpolatedTransform: (clip: any, curTime: number) => any;
}

export const PlayerNativeCompositor: React.FC<PlayerNativeCompositorProps> = ({
  activeVideos,
  activeTexts,
  activeStickers,
  activeEffects,
  activeTransient,
  currentTime,
  isPlaying,
  boxWidth,
  canvasHeight,
  onSelectClip,
  getItemBaseDimensions,
  getInterpolatedTransform,
}) => {
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.nativeCompositorContainer]}
      pointerEvents="box-none"
    >
      {/* Layer 1: Active Video / Image Clips */}
      {activeVideos.map((vid) => {
        const isTrans = activeTransient && activeTransient.clipId === vid.id;
        const kfT = getInterpolatedTransform(vid, currentTime);
        const posX = isTrans ? activeTransient!.x : kfT.x;
        const posY = isTrans ? activeTransient!.y : kfT.y;
        const baseScale = isTrans
          ? activeTransient!.scale
          : kfT.scale * (vid.scale || 1);
        const rot = isTrans
          ? activeTransient!.rotation
          : kfT.rotation + (vid.rotation || 0);
        const opacity =
          kfT.opacity * (vid.opacity !== undefined ? vid.opacity : 1);
        const { baseW, baseH } = getItemBaseDimensions("video", vid);
        const w = Math.round(baseW * baseScale);
        const h = Math.round(baseH * baseScale);
        const cx = boxWidth / 2 + posX;
        const cy = canvasHeight / 2 + posY;

        return (
          <TouchableOpacity
            key={vid.id}
            activeOpacity={0.98}
            onPress={() => onSelectClip?.(vid.id, "video")}
            style={[
              {
                position: "absolute",
                left: cx - w / 2,
                top: cy - h / 2,
                width: w,
                height: h,
                justifyContent: "center",
                alignItems: "center",
                opacity,
                transform: [
                  { scaleX: vid.transform?.flipX ? -1 : 1 },
                  { scaleY: vid.transform?.flipY ? -1 : 1 },
                  { rotate: `${rot}deg` },
                ],
              },
            ]}
          >
            <NativeVideoClipPlayer
              clip={vid}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSelect={() => onSelectClip?.(vid.id, "video")}
            />
          </TouchableOpacity>
        );
      })}

      {/* Layer 2: Active Text Overlays */}
      {activeTexts.map((txt) => {
        const isTrans = activeTransient && activeTransient.clipId === txt.id;
        const kfT = getInterpolatedTransform(txt, currentTime);
        const effX = isTrans
          ? activeTransient!.x
          : (txt.position?.x ?? 50) + (kfT.x / boxWidth) * 100;
        const effY = isTrans
          ? activeTransient!.y
          : (txt.position?.y ?? 35) + (kfT.y / canvasHeight) * 100;
        const cx = (effX / 100) * boxWidth;
        const cy = (effY / 100) * canvasHeight;
        const s = isTrans
          ? activeTransient!.scale
          : (txt.scale || 1.0) * kfT.scale;
        const rot = isTrans
          ? activeTransient!.rotation
          : (txt.rotation || 0) + kfT.rotation;
        const { baseW, baseH } = getItemBaseDimensions("text", txt);
        const w = Math.round(baseW * s);
        const h = Math.round(baseH * s);
        const fontSize = txt.style?.fontSize || 22;

        return (
          <TouchableOpacity
            key={txt.id}
            activeOpacity={0.9}
            onPress={() => onSelectClip?.(txt.id, "text")}
            style={{
              position: "absolute",
              left: cx - w / 2,
              top: cy - h / 2,
              width: w,
              height: h,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ rotate: `${rot}deg` }],
            }}
          >
            <Text
              numberOfLines={1}
              style={[
                {
                  color: txt.style?.color || "#FFFFFF",
                  fontSize: Math.max(8, fontSize * s),
                  fontWeight: (txt.style?.fontWeight as any) || "700",
                  backgroundColor: txt.style?.backgroundColor || "transparent",
                  textAlign: "center",
                  paddingHorizontal: 8 * s,
                  paddingVertical: 4 * s,
                  borderRadius: 4,
                },
              ]}
            >
              {txt.text}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Layer 3: Active Stickers */}
      {activeStickers.map((stk) => {
        const isTrans = activeTransient && activeTransient.clipId === stk.id;
        const kfT = getInterpolatedTransform(stk, currentTime);
        const effX = isTrans
          ? activeTransient!.x
          : (stk.position?.x ?? 50) + (kfT.x / boxWidth) * 100;
        const effY = isTrans
          ? activeTransient!.y
          : (stk.position?.y ?? 50) + (kfT.y / canvasHeight) * 100;
        const cx = (effX / 100) * boxWidth;
        const cy = (effY / 100) * canvasHeight;
        const s = isTrans
          ? activeTransient!.scale
          : (stk.scale || 1.2) * kfT.scale;
        const rot = isTrans
          ? activeTransient!.rotation
          : (stk.rotation || 0) + kfT.rotation;
        const { baseW, baseH } = getItemBaseDimensions("sticker", stk);
        const w = Math.round(baseW * s);
        const h = Math.round(baseH * s);
        const isBadge = (stk.char || "").length > 2;

        return (
          <TouchableOpacity
            key={stk.id}
            activeOpacity={0.9}
            onPress={() => onSelectClip?.(stk.id, "sticker")}
            style={{
              position: "absolute",
              left: cx - w / 2,
              top: cy - h / 2,
              width: w,
              height: h,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ rotate: `${rot}deg` }],
            }}
          >
            <Text
              style={{
                fontSize: isBadge ? Math.max(10, 16 * s) : Math.max(12, 38 * s),
              }}
            >
              {stk.char}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Layer 4: Active Effects Overlays on Native Mobile */}
      {activeEffects.map((eff) => {
        const intensity = eff.intensity || 0.8;
        if (eff.type === "vignette") {
          return (
            <View
              key={eff.id}
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderWidth: 24 * intensity,
                  borderColor: "rgba(0,0,0,0.65)",
                  borderRadius: 8,
                },
              ]}
            />
          );
        }
        if (eff.type === "neon_edge") {
          return (
            <View
              key={eff.id}
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderWidth: 6 * intensity,
                  borderColor: "rgba(0, 242, 254, 0.75)",
                  borderRadius: 8,
                },
              ]}
            />
          );
        }
        if (eff.type === "glitch" || eff.type === "rgb_split") {
          return (
            <View
              key={eff.id}
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(255, 0, 80, 0.14)",
                },
              ]}
            />
          );
        }
        if (eff.type === "flash") {
          const flashVal = Math.sin(currentTime * 12);
          if (flashVal > 0.6) {
            return (
              <View
                key={eff.id}
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: `rgba(255, 255, 255, ${(flashVal - 0.6) * 2 * intensity})`,
                  },
                ]}
              />
            );
          }
        }
        if (eff.type === "rainbow_flow") {
          const hue = Math.floor((currentTime * 120) % 360);
          return (
            <View
              key={eff.id}
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: `hsla(${hue}, 90%, 50%, 0.12)`,
                },
              ]}
            />
          );
        }
        return null;
      })}

      {/* Empty State when no clips at playhead */}
      {activeVideos.length === 0 &&
        activeTexts.length === 0 &&
        activeStickers.length === 0 && (
          <View style={styles.nativeEmptyScrub}>
            <Ionicons name="film-outline" size={32} color="#374151" />
            <Text style={styles.nativeEmptyScrubText}>
              No clip at {formatTime(currentTime)}
            </Text>
          </View>
        )}
    </View>
  );
};

export default React.memo(PlayerNativeCompositor);
