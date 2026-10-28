import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "./PlayerStyles";
import { TransientTransformState } from "./playerTypes";
import NativeVideoClipPlayer from "../NativeVideoClipPlayer";
import NativeAudioTrackPlayer from "../NativeAudioTrackPlayer";
import { applyMotionTracking } from "../../utils/renderer/rendererEffects";
import { evaluateClipAnimation } from "../../utils/animationEngine";

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
          <Image
            source={{ uri: rawBg.replace('image:', '') }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Background Dynamic Blur Fill (Auto from video or photo) */}
      {(() => {
        if (!isBlur) return null;
        const currentVid =
          activeVideos.find(
            (v) =>
              currentTime >= v.startTime &&
              currentTime <= v.startTime + v.duration,
          ) || activeVideos[0];
        const mediaUri =
          currentVid?.thumbnail ||
          (currentVid?.type === "photo" ? currentVid?.url : null);
        if (!mediaUri) return null;
        const blurAmount = parseInt(rawBg.replace("blur:", ""), 10) || 25;

        return (
          <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
            <Image
              source={{ uri: mediaUri }}
              style={[
                StyleSheet.absoluteFill,
                { opacity: 0.72, transform: [{ scale: 1.45 }] },
                Platform.OS === 'web' ? ({ filter: `blur(${blurAmount}px)` } as any) : null,
              ]}
              blurRadius={blurAmount}
              resizeMode="cover"
            />
          </View>
        );
      })()}

      {/* Layer 1: Active Video / Image Clips */}
      {(() => {
        const renderClipEnhanceOverlay = (clip: any) => {
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
        };

        const renderMosaicCensor = (clip: any, clipW: number, clipH: number) => {
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

          const radius = track.mosaicRadius ?? 16;
          const isPixelate = track.mosaicStyle !== 'blur';

          const webBackdropStyle: any = Platform.OS === 'web' ? {
            backdropFilter: isPixelate ? `blur(${Math.max(4, radius / 2)}px) contrast(180%)` : `blur(${radius}px)`,
            WebkitBackdropFilter: isPixelate ? `blur(${Math.max(4, radius / 2)}px) contrast(180%)` : `blur(${radius}px)`,
          } : {};

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
                  borderRadius: isPixelate ? 4 : Math.round(Math.min(boxPixelW, boxPixelH) / 4),
                  backgroundColor: isPixelate ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.12)',
                  overflow: 'hidden',
                  borderWidth: 1.5,
                  borderColor: 'rgba(0, 242, 254, 0.4)',
                  zIndex: 99,
                },
                webBackdropStyle,
              ]}
            />
          );
        };

        return activeVideos.map((vid) => {
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
        // In CapCut, video layers NEVER slide or rotate when tracking an object for censor blur or pinning elements!
        // The video ONLY moves if actionType is explicitly 'camera_center'.
        if (vid.motionTrack && vid.motionTrack.enabled && vid.motionTrack.actionType === 'camera_center') {
          const motion = applyMotionTracking(currentTime, vid.startTime, vid.duration, vid.motionTrack);
          motionX = (motion.dx / 100) * boxWidth;
          motionY = (motion.dy / 100) * canvasHeight;
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
        let webMaskStyle: any = undefined;
        if (mask && mask.shape && mask.shape !== "none") {
          hasMaskShape = true;
          const effW = mask.width !== undefined ? mask.width : (mask.size ?? 60);
          const effH = mask.height !== undefined ? mask.height : (mask.size ?? 60);
          const rawFeather = Math.max(0, Math.min(80, mask.feather ?? 0));
          const posX = 50 + (mask.x || 0);
          const posY = 50 + (mask.y || 0);
          const rotDeg = mask.rotation || 0;

          if (Platform.OS === "web") {
            if (mask.shape === "circle") {
              const radX = effW / 2;
              const radY = effH / 2;
              if (rawFeather === 0 && !mask.inverted && rotDeg === 0) {
                const clipPath = `ellipse(${radX}% ${radY}% at ${posX}% ${posY}%)`;
                webMaskStyle = {
                  clipPath,
                  WebkitClipPath: clipPath,
                };
              } else {
                const stop1X = Math.max(0, radX - (rawFeather * 0.35));
                const stop2X = Math.min(100, radX + (rawFeather * 0.35));
                const grad = mask.inverted
                  ? `radial-gradient(${radX}% ${radY}% at ${posX}% ${posY}%, rgba(0,0,0,0) ${stop1X}%, black ${stop2X}%)`
                  : `radial-gradient(${radX}% ${radY}% at ${posX}% ${posY}%, black ${stop1X}%, rgba(0,0,0,0) ${stop2X}%)`;
                webMaskStyle = {
                  WebkitMaskImage: grad,
                  maskImage: grad,
                };
              }
            } else if (mask.shape === "rectangle") {
              const rectHalfW = effW / 2;
              const rectHalfH = effH / 2;
              const left = Math.max(0, posX - rectHalfW);
              const right = Math.max(0, 100 - (posX + rectHalfW));
              const top = Math.max(0, posY - rectHalfH);
              const btm = Math.max(0, 100 - (posY + rectHalfH));
              const rad = Math.max(0, mask.roundness ?? 16);

              if (rawFeather === 0 && !mask.inverted && rotDeg === 0) {
                const clipPath = `inset(${top}% ${right}% ${btm}% ${left}% round ${rad}px)`;
                webMaskStyle = {
                  clipPath,
                  WebkitClipPath: clipPath,
                };
              } else {
                const f = Math.max(0.1, rawFeather * 0.35);
                const l1 = posX - rectHalfW;
                const r1 = posX + rectHalfW;
                const t1 = posY - rectHalfH;
                const b1 = posY + rectHalfH;
                const grad = mask.inverted
                  ? `linear-gradient(${rotDeg}deg, black, black)`
                  : `linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0) ${l1 - f}%, black ${l1 + f}%, black ${r1 - f}%, rgba(0,0,0,0) ${r1 + f}%, rgba(0,0,0,0) 100%)`;
                webMaskStyle = {
                  WebkitMaskImage: grad,
                  maskImage: grad,
                };
              }
            } else if (mask.shape === "linear") {
              const splitPct = 50 - effH / 2;
              const stop1 = Math.max(0, splitPct - (rawFeather * 0.35));
              const stop2 = Math.min(100, splitPct + (rawFeather * 0.35));
              const grad = mask.inverted
                ? `linear-gradient(${180 + rotDeg}deg, black ${stop1}%, rgba(0,0,0,0) ${stop2}%)`
                : `linear-gradient(${180 + rotDeg}deg, rgba(0,0,0,0) ${stop1}%, black ${stop2}%)`;
              webMaskStyle = {
                WebkitMaskImage: grad,
                maskImage: grad,
              };
            } else if (mask.shape === "mirror") {
              const bandHalf = effH / 2;
              const topSplit = 50 - bandHalf;
              const btmSplit = 50 + bandHalf;
              const f = rawFeather * 0.3;
              const grad = mask.inverted
                ? `linear-gradient(${180 + rotDeg}deg, black 0%, black ${topSplit - f}%, rgba(0,0,0,0) ${topSplit + f}%, rgba(0,0,0,0) ${btmSplit - f}%, black ${btmSplit + f}%, black 100%)`
                : `linear-gradient(${180 + rotDeg}deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) ${topSplit - f}%, black ${topSplit + f}%, black ${btmSplit - f}%, rgba(0,0,0,0) ${btmSplit + f}%, rgba(0,0,0,0) 100%)`;
              webMaskStyle = {
                WebkitMaskImage: grad,
                maskImage: grad,
              };
            } else if (mask.shape === "heart" || mask.shape === "star") {
              const svgData = mask.shape === "heart"
                ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M 50 96 C 22 72 0 56 0 40 A 25 25 0 0 1 50 40 A 25 25 0 0 1 100 40 C 100 56 78 72 50 96 Z" fill="black"/></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,2 63,38 100,38 69,60 82,98 50,75 18,98 31,60 0,38 37,38" fill="black"/></svg>`;
              const uri = `url("data:image/svg+xml;utf8,${encodeURIComponent(svgData)}")`;
              webMaskStyle = {
                WebkitMaskImage: uri,
                maskImage: uri,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: `${posX}% ${posY}%`,
                maskPosition: `${posX}% ${posY}%`,
                WebkitMaskSize: `${effW}% ${effH}%`,
                maskSize: `${effW}% ${effH}%`,
                transform: [{ rotate: `${rotDeg}deg` }],
              };
            }
          }
        }

        const crop = vid.crop || vid.transform?.crop;
        const hasCrop =
          !!crop &&
          (crop.width < 100 ||
            crop.height < 100 ||
            crop.x > 0 ||
            crop.y > 0);

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
          { perspective: persp },
          { rotateX: `${rotX}deg` },
          { rotateY: `${rotY}deg` },
          { rotate: `${effRot + vidAnimRot}deg` },
          ...(skewX !== 0 ? [{ skewX: `${skewX}deg` }] : []),
          { scaleX: effScaleX },
          { scaleY: effScaleY },
        ];

        if (hasCrop) {
          const cropW = Math.max(0.01, crop.width / 100);
          const cropH = Math.max(0.01, crop.height / 100);
          const cropX = Math.max(0, crop.x / 100);
          const cropY = Math.max(0, crop.y / 100);
          const croppedContainerW = Math.round(w * cropW);
          const croppedContainerH = Math.round(h * cropH);

          const blendMode = vid.blendMode || vid.transform?.blendMode || "normal";
          const webBlendStyle =
            Platform.OS === "web" && blendMode !== "normal"
              ? ({ mixBlendMode: blendMode } as any)
              : undefined;

          const clipBlur = (vid as any).blur || vid.transform?.blur || 0;
          const webBlurStyle =
            Platform.OS === "web" && clipBlur > 0
              ? ({ filter: `blur(${clipBlur}px)` } as any)
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
                  borderRadius: maskBorderRadius,
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
                {renderClipEnhanceOverlay(vid)}
                {renderMosaicCensor(vid, w, h)}
              </View>
            </TouchableOpacity>
          );
        }

        const blendMode = vid.blendMode || vid.transform?.blendMode || "normal";
        const webBlendStyle =
          Platform.OS === "web" && blendMode !== "normal"
            ? ({ mixBlendMode: blendMode } as any)
            : undefined;

        const clipBlur = (vid as any).blur || vid.transform?.blur || 0;
        const webBlurStyle =
          Platform.OS === "web" && clipBlur > 0
            ? ({ filter: `blur(${clipBlur}px)` } as any)
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
                borderRadius: maskBorderRadius,
                zIndex: vidZ,
                elevation: vidElevation,
                transform: clipTransformArray,
              },
              webMaskStyle,
              webBlendStyle,
              webBlurStyle,
            ]}
          >
            <NativeVideoClipPlayer
              clip={vid}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSelect={() => onSelectClip?.(vid.id, vid.type || "video")}
            />
            {renderClipEnhanceOverlay(vid)}
            {renderMosaicCensor(vid, w, h)}
          </TouchableOpacity>
        );
      });
      })()}

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
          : activeVideos.find((v) => v.motionTrack?.enabled && v.motionTrack.pinnedClipId === txt.id)?.motionTrack;
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
        if (cap.motionTrack && cap.motionTrack.enabled) {
          const motion = applyMotionTracking(
            currentTime,
            cap.startTime,
            cap.duration,
            cap.motionTrack,
          );
          motionX = motion.dx;
          motionY = motion.dy;
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
          : activeVideos.find((v) => v.motionTrack?.enabled && v.motionTrack.pinnedClipId === stk.id)?.motionTrack;
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
        const type = (eff.type || "").toLowerCase().replace(/[-_]/g, "");

        const renderEffectBody = () => {
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
            const barH = Math.round(canvasHeight * 0.12 * intensity);
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
                {/* Jitter Slice Bands */}
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
            const barY = Math.floor(((currentTime * 180) + 40) % Math.max(100, canvasHeight - 20));
            const secs = Math.floor(currentTime).toString().padStart(2, "0");
            const ms = Math.floor((currentTime % 1) * 30).toString().padStart(2, "0");
            return (
              <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
                {/* Scanline pattern overlay */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0, 0, 0, 0.15)" }]} />
                {/* VHS tracking glitch bar */}
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
                {/* Retro OSD text */}
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
            const jitterLine = Math.floor(((currentTime * 320) + 80) % (boxWidth || 300));
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
          if (type === "blur" || type === "blurcinematic" || type === "tiltshift") {
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
                {/* Comic Speed Lines at top and bottom */}
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
            const barY = Math.floor(((currentTime * 220) + 50) % (canvasHeight || 400));
            return (
              <View key={eff.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0, 255, 100, ${0.12 * intensity})` }]} />
                {/* Horizontal digital code scanline */}
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
                      borderRadius: Math.round(Math.min(boxWidth, canvasHeight) * 0.45),
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
                      borderRadius: Math.round(Math.min(boxWidth, canvasHeight) * 0.45),
                    },
                  ]}
                />
              </View>
            );
          }

          return null;
        };

        const effectBody = renderEffectBody();
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
