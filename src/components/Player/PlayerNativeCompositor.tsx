import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./PlayerStyles";
import { TransientTransformState } from "./playerTypes";
import NativeVideoClipPlayer from "../NativeVideoClipPlayer";
import { applyMotionTracking } from "../../utils/renderer/rendererEffects";

interface PlayerNativeCompositorProps {
  activeVideos: any[];
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

export const PlayerNativeCompositor: React.FC<PlayerNativeCompositorProps> = ({
  activeVideos,
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
  const rawBg = canvasBackground || "#000000";
  const isBlur = rawBg.startsWith("blur:");
  const isGradient = rawBg.startsWith("gradient:");
  const effectiveBgColor = isBlur
    ? "rgba(11, 13, 19, 0.95)"
    : isGradient
    ? rawBg.replace("gradient:", "").split(",")[0] || "#0B0D13"
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
      {/* Background Blur Fill for Pillarbox / Letterbox */}
      {isBlur && activeVideos.length > 0 && activeVideos[0].thumbnail && (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
          <Image
            source={{ uri: activeVideos[0].thumbnail }}
            style={[StyleSheet.absoluteFill, { opacity: 0.5, transform: [{ scale: 1.3 }] }]}
            blurRadius={20}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Layer 1: Active Video / Image Clips */}
      {activeVideos.map((vid) => {
        const isTrans = activeTransient && activeTransient.clipId === vid.id;
        const kfT = getInterpolatedTransform(vid, currentTime);
        const posX = isTrans
          ? activeTransient!.x
          : (kfT?.x ?? vid.transform?.x ?? 0);
        const posY = isTrans
          ? activeTransient!.y
          : (kfT?.y ?? vid.transform?.y ?? 0);
        const baseScale = isTrans
          ? activeTransient!.scale
          : (kfT?.scale ?? vid.transform?.scale ?? vid.scale ?? 1.0);
        const rot = isTrans
          ? activeTransient!.rotation
          : (kfT?.rotation ?? vid.transform?.rotation ?? vid.rotation ?? 0);
        const opacity =
          (kfT?.opacity ?? 1) * (vid.opacity !== undefined ? vid.opacity : 1);

        let motionX = 0;
        let motionY = 0;
        let motionScale = 1.0;
        let motionRot = 0;
        if (vid.motionTrack && vid.motionTrack.enabled) {
          const motion = applyMotionTracking(currentTime, vid.startTime, vid.duration, vid.motionTrack);
          motionX = motion.dx;
          motionY = motion.dy;
          motionScale = motion.dScale;
          motionRot = motion.dRot;
        }

        const effScale = baseScale * motionScale;
        const effRot = rot + motionRot;
        const { baseW, baseH } = getItemBaseDimensions("video", vid);
        const w = Math.round(baseW * effScale);
        const h = Math.round(baseH * effScale);
        const cx = boxWidth / 2 + posX + motionX;
        const cy = canvasHeight / 2 + posY + motionY;

        const mask = vid.mask || vid.transform?.mask;
        let maskBorderRadius: number | undefined = undefined;
        let hasMaskShape = false;
        if (mask && mask.shape && mask.shape !== "none") {
          hasMaskShape = true;
          if (mask.shape === "circle") {
            maskBorderRadius = Math.round(Math.min(w, h) / 2);
          } else if (mask.shape === "rectangle") {
            maskBorderRadius = Math.max(0, mask.roundness ?? 16);
          }
        }

        const crop = vid.crop || vid.transform?.crop;
        const hasCrop =
          !!crop &&
          (crop.width < 100 ||
            crop.height < 100 ||
            crop.x > 0 ||
            crop.y > 0);

        if (hasCrop) {
          const cropW = Math.max(0.01, crop.width / 100);
          const cropH = Math.max(0.01, crop.height / 100);
          const cropX = Math.max(0, crop.x / 100);
          const cropY = Math.max(0, crop.y / 100);
          const croppedContainerW = Math.round(w * cropW);
          const croppedContainerH = Math.round(h * cropH);

          return (
            <TouchableOpacity
              key={vid.id}
              activeOpacity={0.98}
              onPress={() => onSelectClip?.(vid.id, vid.type || "video")}
              style={[
                {
                  position: "absolute",
                  left: cx - croppedContainerW / 2,
                  top: cy - croppedContainerH / 2,
                  width: croppedContainerW,
                  height: croppedContainerH,
                  overflow: "hidden",
                  borderRadius: maskBorderRadius,
                  opacity,
                  transform: [
                    { scaleX: vid.transform?.flipX ? -1 : 1 },
                    { scaleY: vid.transform?.flipY ? -1 : 1 },
                    { rotate: `${effRot}deg` },
                  ],
                },
              ]}
            >
              <View
                style={{
                  position: "absolute",
                  left: -Math.round(w * cropX),
                  top: -Math.round(h * cropY),
                  width: w,
                  height: h,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <NativeVideoClipPlayer
                  clip={vid}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onSelect={() => onSelectClip?.(vid.id, vid.type || "video")}
                />
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={vid.id}
            activeOpacity={0.98}
            onPress={() => onSelectClip?.(vid.id, vid.type || "video")}
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
                overflow: hasMaskShape ? "hidden" : "visible",
                borderRadius: maskBorderRadius,
                transform: [
                  { scaleX: vid.transform?.flipX ? -1 : 1 },
                  { scaleY: vid.transform?.flipY ? -1 : 1 },
                  { rotate: `${effRot}deg` },
                ],
              },
            ]}
          >
            <NativeVideoClipPlayer
              clip={vid}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSelect={() => onSelectClip?.(vid.id, vid.type || "video")}
            />
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
        const timeLeft = Math.max(0, duration - elapsed);
        let animScale = 1.0;
        let animAlpha = 1.0;
        let animOffsetX = 0;
        let animOffsetY = 0;
        let displayText = txt.text || "";
        const anim = (txt.animation || "none").toLowerCase().replace(/[-_]/g, "");
        const introDur = Math.min(0.5, duration * 0.35);
        const exitDur = Math.min(0.35, duration * 0.25);

        if (anim === "typewriter") {
          const chars = Math.min(displayText.length, Math.floor(elapsed * 14));
          displayText = displayText.slice(0, chars);
        } else if (anim === "bounce") {
          if (elapsed < introDur) {
            const p = elapsed / introDur;
            animScale = 0.45 + Math.sin(p * Math.PI) * 0.75;
            animAlpha = Math.min(1, p * 2);
          }
        } else if (anim === "fade" || anim === "fadein") {
          if (elapsed < introDur) {
            animAlpha = elapsed / introDur;
          } else if (timeLeft < exitDur) {
            animAlpha = timeLeft / exitDur;
          }
        } else if (anim === "slideup" || anim === "up") {
          if (elapsed < introDur) {
            const p = elapsed / introDur;
            const easeOut = Math.sin((p * Math.PI) / 2);
            animOffsetY = (1 - easeOut) * 45;
            animAlpha = p;
          } else if (timeLeft < exitDur) {
            const p = 1 - (timeLeft / exitDur);
            animOffsetY = -p * 25;
            animAlpha = 1 - p;
          }
        } else if (anim === "slidedown" || anim === "down") {
          if (elapsed < introDur) {
            const p = elapsed / introDur;
            const easeOut = Math.sin((p * Math.PI) / 2);
            animOffsetY = -(1 - easeOut) * 45;
            animAlpha = p;
          } else if (timeLeft < exitDur) {
            const p = 1 - (timeLeft / exitDur);
            animOffsetY = p * 25;
            animAlpha = 1 - p;
          }
        } else if (anim === "slide" || anim === "slideleft") {
          if (elapsed < introDur) {
            const p = elapsed / introDur;
            const easeOut = Math.sin((p * Math.PI) / 2);
            animOffsetX = (1 - easeOut) * 60;
            animAlpha = p;
          } else if (timeLeft < exitDur) {
            const p = 1 - (timeLeft / exitDur);
            animOffsetX = -p * 35;
            animAlpha = 1 - p;
          }
        } else if (anim === "slideright") {
          if (elapsed < introDur) {
            const p = elapsed / introDur;
            const easeOut = Math.sin((p * Math.PI) / 2);
            animOffsetX = -(1 - easeOut) * 60;
            animAlpha = p;
          } else if (timeLeft < exitDur) {
            const p = 1 - (timeLeft / exitDur);
            animOffsetX = p * 35;
            animAlpha = 1 - p;
          }
        } else if (anim === "zoomin" || anim === "zoom") {
          if (elapsed < introDur) {
            const p = elapsed / introDur;
            const easeOut = Math.sin((p * Math.PI) / 2);
            animScale = 0.35 + easeOut * 0.75;
            animAlpha = p;
          } else if (timeLeft < exitDur) {
            const p = 1 - (timeLeft / exitDur);
            animScale = 1.0 + p * 0.25;
            animAlpha = 1 - p;
          }
        } else if (anim === "pulse") {
          animScale = 1.0 + Math.sin(elapsed * 6) * 0.08;
        } else if (anim === "shake") {
          if (elapsed < 0.8) {
            animOffsetX = Math.sin(elapsed * 40) * 4;
          }
        } else if (anim === "wave") {
          animOffsetY = Math.sin(elapsed * 4) * 6;
        }

        let motionX = 0;
        let motionY = 0;
        let motionScale = 1.0;
        let motionRot = 0;
        if (txt.motionTrack && txt.motionTrack.enabled) {
          const motion = applyMotionTracking(currentTime, txt.startTime, txt.duration, txt.motionTrack);
          motionX = motion.dx;
          motionY = motion.dy;
          motionScale = motion.dScale;
          motionRot = motion.dRot;
        }

        const s = baseS * animScale * motionScale;
        const opacity = Math.max(0, Math.min(1, baseOpacity * animAlpha));
        const cx = (effX / 100) * boxWidth + animOffsetX + motionX;
        const cy = (effY / 100) * canvasHeight + animOffsetY + motionY;
        const effRot = rot + motionRot;
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
              minHeight: h,
              maxWidth: boxWidth * 0.9,
              alignItems: "center",
              justifyContent: "center",
              opacity,
              transform: [{ rotate: `${effRot}deg` }],
            }}
          >
            <Text
              numberOfLines={6}
              style={[
                {
                  color: txt.style?.color || "#FFFFFF",
                  fontSize: Math.max(8, fontSize * s),
                  fontWeight: (txt.style?.fontWeight as any) || "700",
                  backgroundColor: txt.style?.backgroundColor || "transparent",
                  textAlign: "center",
                  flexWrap: "wrap",
                  paddingHorizontal: 8 * s,
                  paddingVertical: 4 * s,
                  borderRadius: 4,
                  maxWidth: "100%",
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
        const anim = (cap.animation || "none").toLowerCase();

        let animScale = 1.0;
        let animAlpha = 1.0;
        if (anim === "bounce" && elapsed < 0.35) {
          const p = elapsed / 0.35;
          animScale = 0.5 + Math.sin(p * Math.PI) * 0.7;
        } else if (anim === "zoomin" && elapsed < 0.3) {
          const p = elapsed / 0.3;
          animScale = 0.4 + p * 0.6;
        }

        const s = baseS * animScale;
        const opacity = Math.max(0, Math.min(1, baseOpacity * animAlpha));
        const cx = (effX / 100) * boxWidth;
        const cy = (effY / 100) * canvasHeight;
        const { baseW, baseH } = getItemBaseDimensions("caption", cap);
        const w = Math.round(baseW * s);
        const h = Math.round(baseH * s);
        const fontSize = cap.style?.fontSize || 24;

        return (
          <TouchableOpacity
            key={cap.id}
            activeOpacity={0.9}
            onPress={() => onSelectClip?.(cap.id, "caption")}
            style={{
              position: "absolute",
              left: cx - w / 2,
              top: cy - h / 2,
              width: w,
              minHeight: h,
              maxWidth: boxWidth * 0.9,
              alignItems: "center",
              justifyContent: "center",
              opacity,
              transform: [{ rotate: `${rot}deg` }],
            }}
          >
            <Text
              numberOfLines={6}
              style={[
                {
                  color: cap.style?.color || "#FFE600",
                  fontSize: Math.max(10, fontSize * s),
                  fontWeight: (cap.style?.fontWeight as any) || "900",
                  backgroundColor: cap.style?.backgroundColor || "transparent",
                  textAlign: "center",
                  flexWrap: "wrap",
                  paddingHorizontal: 12 * s,
                  paddingVertical: 5 * s,
                  borderRadius: 6,
                  maxWidth: "100%",
                },
              ]}
            >
              {cap.text}
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
        if (stk.motionTrack && stk.motionTrack.enabled) {
          const motion = applyMotionTracking(currentTime, stk.startTime, stk.duration, stk.motionTrack);
          motionX = motion.dx;
          motionY = motion.dy;
          motionScale = motion.dScale;
          motionRot = motion.dRot;
        }

        const elapsed = Math.max(0, currentTime - (stk.startTime || 0));
        let animScale = 1.0;
        let animAlpha = 1.0;
        let animOffsetY = 0;
        const anim = stk.animation || "bounce";

        if (anim === "bounce") {
          animScale = 1.0 + Math.sin(elapsed * 4) * 0.08;
        } else if (anim === "pulse") {
          animScale = 1.0 + Math.sin(elapsed * 6) * 0.1;
        } else if (anim === "wave") {
          animOffsetY = Math.sin(elapsed * 4) * 8;
        } else if (anim === "fade") {
          if (elapsed < 0.35) animAlpha = elapsed / 0.35;
        } else if (anim === "pop") {
          if (elapsed < 0.3) {
            const p = elapsed / 0.3;
            animScale = 0.3 + p * 0.85;
            animAlpha = p;
          }
        } // if "none", animScale stays 1.0 without bounce

        const s = baseS * animScale * motionScale;
        const opacity = Math.max(0, Math.min(1, baseOpacity * animAlpha));
        const cx = (effX / 100) * boxWidth + motionX;
        const cy = (effY / 100) * canvasHeight + animOffsetY + motionY;
        const effRot = rot + motionRot;
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
              opacity,
              transform: [{ rotate: `${effRot}deg` }],
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
          return null;
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

    </View>
  );
};

export default React.memo(PlayerNativeCompositor);
