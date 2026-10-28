import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { styles } from "./PlayerStyles";
import { ActiveTransformItem } from "./playerTypes";
import { applyMotionTracking } from "../../utils/renderer/rendererEffects";

interface PlayerTransformOverlayProps {
  selectedClipId?: string | null;
  activeVideos: any[];
  activeCaptions?: any[];
  activeTexts: any[];
  activeStickers: any[];
  activeTransformItem: ActiveTransformItem | null;
  boxWidth: number;
  canvasHeight: number;
  currentTime: number;
  onSelectClip?: (id: string | null, type?: string) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  onOpenMaskModal?: (clipId: string) => void;
  onOpenAnimationModal?: () => void;
  onDeleteClip?: (clipId: string, clipType: string) => void;
  handleEnterCropMode: (clipId?: string) => void;
  handleStartDrag: (
    e: any,
    mode: "move" | "scale" | "rotate",
    corner?: "tl" | "tr" | "bl" | "br",
    customItem?: any,
  ) => void;
  canvasMultiTouchPanResponder: any;
  nativeBoxPanResponder: any;
  nativeRotPanResponder: any;
  scaleTLResponder: any;
  scaleTRResponder: any;
  scaleBLResponder: any;
  scaleBRResponder: any;
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

const PlayerTransformOverlayComponent: React.FC<PlayerTransformOverlayProps> = ({
  selectedClipId,
  activeVideos,
  activeCaptions,
  activeTexts,
  activeStickers,
  activeTransformItem,
  boxWidth,
  canvasHeight,
  currentTime,
  onSelectClip,
  onOpenEditModal,
  onOpenMaskModal,
  onOpenAnimationModal,
  onDeleteClip,
  handleEnterCropMode,
  handleStartDrag,
  canvasMultiTouchPanResponder,
  nativeBoxPanResponder,
  nativeRotPanResponder,
  scaleTLResponder,
  scaleTRResponder,
  scaleBLResponder,
  scaleBRResponder,
  getItemBaseDimensions,
  getInterpolatedTransform,
}) => {
  const safeBoxW = Math.max(1, boxWidth || 360);
  const safeCanvasH = Math.max(1, canvasHeight || 640);

  const unselectedHitboxes = useMemo(
    () => (
      <>
        {/* Unselected Clickable & Immediately Draggable Hit Areas for Active Videos */}
        {activeVideos.map((vid) => {
          if (selectedClipId === vid.id) return null;
          const vidTrackZ =
            (typeof vid.trackIndex === "number" ? vid.trackIndex : 0) * 100 + 10;
          const kfT = getInterpolatedTransform(vid, currentTime, "video");
          let motionX = 0;
          let motionY = 0;
          let motionScale = 1.0;
          let motionRot = 0;
          if (vid.motionTrack && vid.motionTrack.enabled && vid.motionTrack.actionType === 'camera_center') {
            const motion = applyMotionTracking(
              currentTime,
              vid.startTime,
              vid.duration,
              vid.motionTrack,
            );
            motionX = (motion.dx / 100) * boxWidth;
            motionY = (motion.dy / 100) * canvasHeight;
            motionScale = motion.dScale;
            motionRot = motion.dRot;
          }
          const s = (kfT?.scale ?? vid.transform?.scale ?? vid.scale ?? 1.0) * motionScale;
          const rot = (kfT?.rotation ?? vid.transform?.rotation ?? vid.rotation ?? 0) + motionRot;
          const rawX = kfT ? kfT.x : (vid.transform?.x || 0);
          const rawY = kfT ? kfT.y : (vid.transform?.y || 0);
          const cx = boxWidth / 2 + rawX + motionX;
          const cy = canvasHeight / 2 + rawY + motionY;
          const { baseW, baseH } = getItemBaseDimensions("video", vid);
          const w = Math.round(baseW * s);
          const h = Math.round(baseH * s);
          const itemObj = {
            id: vid.id,
            type: "video" as const,
            label: vid.title,
            pos: {
              x: 50 + ((rawX + motionX) / safeBoxW) * 100,
              y: 50 + ((rawY + motionY) / safeCanvasH) * 100,
            },
            scale: s,
            rotation: rot,
            width: w,
            height: h,
          };
          return (
            <TouchableOpacity
              key={vid.id}
              activeOpacity={0.85}
              onPress={() => onSelectClip?.(vid.id, vid.type || "video")}
              style={[
                styles.unselectedHitBox,
                {
                  left: cx - w / 2,
                  top: cy - h / 2,
                  width: w,
                  height: h,
                  zIndex: vidTrackZ,
                  transform: [{ rotate: `${rot}deg` }],
                },
              ]}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => {
                      onSelectClip?.(vid.id, vid.type || "video");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                    onTouchStart: (e: any) => {
                      onSelectClip?.(vid.id, vid.type || "video");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                  } as any)
                : {})}
            />
          );
        })}

        {/* Unselected Clickable & Immediately Draggable Hit Boxes for Active Captions */}
        {(activeCaptions || []).map((cap) => {
          if (cap.id === selectedClipId) return null;
          const capTrackZ =
            (typeof cap.trackIndex === "number" ? cap.trackIndex : 2) * 100 + 15;
          const kfT = getInterpolatedTransform(cap, currentTime, "caption");
          const elapsed = Math.max(0, currentTime - cap.startTime);
          const anim = (cap.animation || "none").toLowerCase();
          let animScale = 1.0;
          if (anim === "bounce" && elapsed < 0.35) {
            const p = elapsed / 0.35;
            animScale = 0.5 + Math.sin(p * Math.PI) * 0.7;
          } else if (anim === "zoomin" && elapsed < 0.3) {
            const p = elapsed / 0.3;
            animScale = 0.4 + p * 0.6;
          }
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
          const s = (kfT?.scale ?? cap.scale ?? 1.0) * animScale * motionScale;
          const rot = (kfT?.rotation ?? cap.rotation ?? 0) + motionRot;
          const rawX = kfT ? kfT.x : (cap.position?.x ?? 50);
          const rawY = kfT ? kfT.y : (cap.position?.y ?? 80);
          const cx = (rawX / 100) * boxWidth + motionX;
          const cy = (rawY / 100) * canvasHeight + motionY;
          const { baseW, baseH } = getItemBaseDimensions("caption", cap);
          const w = Math.round(baseW * s);
          const h = Math.round(baseH * s);
          const itemObj = {
            id: cap.id,
            type: "caption" as const,
            label: cap.text,
            pos: {
              x: rawX + (motionX / safeBoxW) * 100,
              y: rawY + (motionY / safeCanvasH) * 100,
            },
            scale: s,
            rotation: rot,
            width: w,
            height: h,
          };
          return (
            <TouchableOpacity
              key={cap.id}
              activeOpacity={0.85}
              onPress={() => onSelectClip?.(cap.id, "caption")}
              style={[
                styles.unselectedHitBox,
                {
                  left: cx - w / 2,
                  top: cy - h / 2,
                  width: w,
                  height: h,
                  zIndex: capTrackZ,
                  transform: [{ rotate: `${rot}deg` }],
                },
              ]}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => {
                      onSelectClip?.(cap.id, "caption");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                    onTouchStart: (e: any) => {
                      onSelectClip?.(cap.id, "caption");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                  } as any)
                : {})}
            />
          );
        })}

        {/* Unselected Clickable & Immediately Draggable Hit Boxes for Active Texts */}
        {activeTexts.map((txt) => {
          if (txt.id === selectedClipId) return null;
          const txtTrackZ =
            (typeof txt.trackIndex === "number" ? txt.trackIndex : 2) * 100 + 20;
          const kfT = getInterpolatedTransform(txt, currentTime, "text");
          const elapsed = Math.max(0, currentTime - (txt.startTime || 0));
          let animScale = 1.0;
          let animOffsetX = 0;
          let animOffsetY = 0;
          const anim = (txt.animation || "none").toLowerCase();
          if (anim === "bounce" && elapsed < 0.4) {
            const p = elapsed / 0.4;
            animScale = 0.5 + Math.sin(p * Math.PI) * 0.7;
          } else if (anim === "zoomin" && elapsed < 0.35) {
            const p = elapsed / 0.35;
            animScale = 0.4 + p * 0.6;
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
            const motion = applyMotionTracking(
              currentTime,
              txt.startTime,
              txt.duration,
              txt.motionTrack,
            );
            motionX = (motion.dx / 100) * boxWidth;
            motionY = (motion.dy / 100) * canvasHeight;
            motionScale = motion.dScale;
            motionRot = motion.dRot;
          }
          const s = (kfT?.scale ?? txt.scale ?? 1.0) * animScale * motionScale;
          const rot = (kfT?.rotation ?? txt.rotation ?? 0) + motionRot;
          const rawX = kfT ? kfT.x : (txt.position?.x ?? 50);
          const rawY = kfT ? kfT.y : (txt.position?.y ?? 35);
          const cx = (rawX / 100) * boxWidth + animOffsetX + motionX;
          const cy = (rawY / 100) * canvasHeight + animOffsetY + motionY;
          const { baseW, baseH } = getItemBaseDimensions("text", txt);
          const w = Math.round(baseW * s);
          const h = Math.round(baseH * s);
          const itemObj = {
            id: txt.id,
            type: "text" as const,
            label: txt.text,
            pos: {
              x: rawX + ((animOffsetX + motionX) / safeBoxW) * 100,
              y: rawY + ((animOffsetY + motionY) / safeCanvasH) * 100,
            },
            scale: s,
            rotation: rot,
            width: w,
            height: h,
          };
          return (
            <TouchableOpacity
              key={txt.id}
              activeOpacity={0.85}
              onPress={() => onSelectClip?.(txt.id, "text")}
              style={[
                styles.unselectedHitBox,
                {
                  left: cx - w / 2,
                  top: cy - h / 2,
                  width: w,
                  height: h,
                  zIndex: txtTrackZ,
                  transform: [{ rotate: `${rot}deg` }],
                },
              ]}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => {
                      onSelectClip?.(txt.id, "text");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                    onTouchStart: (e: any) => {
                      onSelectClip?.(txt.id, "text");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                  } as any)
                : {})}
            />
          );
        })}

        {/* Unselected Clickable & Immediately Draggable Hit Boxes for Active Stickers */}
        {activeStickers.map((stk) => {
          if (stk.id === selectedClipId) return null;
          const stkTrackZ =
            (typeof stk.trackIndex === "number" ? stk.trackIndex : 3) * 100 + 25;
          const kfT = getInterpolatedTransform(stk, currentTime, "sticker");
          const elapsed = Math.max(0, currentTime - (stk.startTime || 0));
          let animScale = 1.0;
          let animOffsetY = 0;
          const anim = stk.animation || "none";
          if (anim === "bounce") {
            animScale = 1.0 + Math.sin(elapsed * 4) * 0.08;
          } else if (anim === "pulse") {
            animScale = 1.0 + Math.sin(elapsed * 6) * 0.1;
          } else if (anim === "wave") {
            animOffsetY = Math.sin(elapsed * 4) * 8;
          } else if (anim === "pop" && elapsed < 0.3) {
            const p = elapsed / 0.3;
            animScale = 0.3 + p * 0.85;
          }
          let motionX = 0;
          let motionY = 0;
          let motionScale = 1.0;
          let motionRot = 0;
          if (stk.motionTrack && stk.motionTrack.enabled) {
            const motion = applyMotionTracking(
              currentTime,
              stk.startTime,
              stk.duration,
              stk.motionTrack,
            );
            motionX = (motion.dx / 100) * boxWidth;
            motionY = (motion.dy / 100) * canvasHeight;
            motionScale = motion.dScale;
            motionRot = motion.dRot;
          }
          const s = (kfT?.scale ?? stk.scale ?? 1.2) * animScale * motionScale;
          const rot = (kfT?.rotation ?? stk.rotation ?? 0) + motionRot;
          const rawX = kfT ? kfT.x : (stk.position?.x ?? 50);
          const rawY = kfT ? kfT.y : (stk.position?.y ?? 50);
          const cx = (rawX / 100) * boxWidth + motionX;
          const cy = (rawY / 100) * canvasHeight + animOffsetY + motionY;
          const { baseW, baseH } = getItemBaseDimensions("sticker", stk);
          const w = Math.round(baseW * s);
          const h = Math.round(baseH * s);
          const itemObj = {
            id: stk.id,
            type: "sticker" as const,
            label: stk.char,
            pos: {
              x: rawX + (motionX / safeBoxW) * 100,
              y: rawY + ((animOffsetY + motionY) / safeCanvasH) * 100,
            },
            scale: s,
            rotation: rot,
            width: w,
            height: h,
          };
          return (
            <TouchableOpacity
              key={stk.id}
              activeOpacity={0.85}
              onPress={() => onSelectClip?.(stk.id, "sticker")}
              style={[
                styles.unselectedHitBox,
                {
                  left: cx - w / 2,
                  top: cy - h / 2,
                  width: w,
                  height: h,
                  zIndex: stkTrackZ,
                  transform: [{ rotate: `${rot}deg` }],
                },
              ]}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => {
                      onSelectClip?.(stk.id, "sticker");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                    onTouchStart: (e: any) => {
                      onSelectClip?.(stk.id, "sticker");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                  } as any)
                : {})}
            />
          );
        })}
      </>
    ),
    [
      activeVideos,
      activeCaptions,
      activeTexts,
      activeStickers,
      selectedClipId,
      boxWidth,
      canvasHeight,
      currentTime,
      safeBoxW,
      safeCanvasH,
      onSelectClip,
      handleStartDrag,
      getItemBaseDimensions,
      getInterpolatedTransform,
    ],
  );

  return (
    <>
      <View
        style={StyleSheet.absoluteFill}
        {...canvasMultiTouchPanResponder.panHandlers}
      >
        {/* Background Tap on empty canvas area to cleanly Deselect */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (selectedClipId) onSelectClip?.(null);
          }}
        />

        {/* Unselected Clickable & Immediately Draggable Hit Areas */}
        {unselectedHitboxes}

        {/* Active Selected Transform Bounding Box with Hand Drag, Resize & Rotate Handles */}
        {activeTransformItem && (
          <View
            style={[
              styles.activeTransformBox,
              {
                zIndex: 10000,
                left: 0,
                top: 0,
                width: activeTransformItem.width,
                height: activeTransformItem.height,
                transform: [
                  {
                    translateX:
                      (activeTransformItem.pos.x / 100) * boxWidth -
                      activeTransformItem.width / 2,
                  },
                  {
                    translateY:
                      (activeTransformItem.pos.y / 100) * canvasHeight -
                      activeTransformItem.height / 2,
                  },
                  { rotate: `${activeTransformItem.rotation}deg` },
                ],
              },
            ]}
            {...(Platform.OS === "web"
              ? ({
                  onMouseDown: (e: any) => handleStartDrag(e, "move"),
                  onTouchStart: (e: any) => handleStartDrag(e, "move"),
                  onDoubleClick: (e: any) => {
                    e.stopPropagation?.();
                    if (
                      activeTransformItem.type === "text" ||
                      activeTransformItem.type === "caption" ||
                      activeTransformItem.type === "sticker"
                    ) {
                      onOpenEditModal?.(
                        activeTransformItem.id,
                        activeTransformItem.type,
                      );
                    } else if (activeTransformItem.type === "video") {
                      handleEnterCropMode(activeTransformItem.id);
                    }
                  },
                } as any)
              : nativeBoxPanResponder.panHandlers)}
          >
            {/* Top Rotation Stem Line & Handle Knob */}
            <>
              <View style={styles.rotStem} pointerEvents="none" />
              <View
                style={styles.rotKnob}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                {...(Platform.OS === "web"
                  ? ({
                      onMouseDown: (e: any) => handleStartDrag(e, "rotate"),
                      onTouchStart: (e: any) => handleStartDrag(e, "rotate"),
                    } as any)
                  : nativeRotPanResponder.panHandlers)}
              >
                <Ionicons name="sync-outline" size={16} color="#000000" />
              </View>
            </>

            {/* 4 Corner Resize Handles */}
            <View
              style={[styles.cornerHandle, styles.handleTL]}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => handleStartDrag(e, "scale", "tl"),
                    onTouchStart: (e: any) => handleStartDrag(e, "scale", "tl"),
                  } as any)
                : scaleTLResponder.panHandlers)}
            />
            <View
              style={[styles.cornerHandle, styles.handleTR]}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => handleStartDrag(e, "scale", "tr"),
                    onTouchStart: (e: any) => handleStartDrag(e, "scale", "tr"),
                  } as any)
                : scaleTRResponder.panHandlers)}
            />
            <View
              style={[styles.cornerHandle, styles.handleBL]}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => handleStartDrag(e, "scale", "bl"),
                    onTouchStart: (e: any) => handleStartDrag(e, "scale", "bl"),
                  } as any)
                : scaleBLResponder.panHandlers)}
            />
            <View
              style={[styles.cornerHandle, styles.handleBR]}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => handleStartDrag(e, "scale", "br"),
                    onTouchStart: (e: any) => handleStartDrag(e, "scale", "br"),
                  } as any)
                : scaleBRResponder.panHandlers)}
            />
          </View>
        )}
      </View>

      {/* Quick Action HUD Bar for Selected Item */}
      {activeTransformItem && (
        <View style={styles.floatingHudContainer} pointerEvents="box-none">
          <View style={styles.floatingHudContentCompact} pointerEvents="auto">
            {/* Edit Action (for text, captions and stickers only; videos use Crop) */}
            {(activeTransformItem.type === "text" ||
              activeTransformItem.type === "caption" ||
              activeTransformItem.type === "sticker") && (
              <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenEditModal?.(
                    activeTransformItem.id,
                    activeTransformItem.type,
                  );
                }}
                {...(Platform.OS === "web"
                  ? ({
                      onClick: (e: any) => {
                        e.stopPropagation?.();
                        soundEngine.playSfx("click");
                        onOpenEditModal?.(
                          activeTransformItem.id,
                          activeTransformItem.type,
                        );
                      },
                      onMouseDown: (e: any) => e.stopPropagation?.(),
                    } as any)
                  : {})}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil" size={13} color="#FFFFFF" />
                <Text style={styles.floatingBtnText}>Edit</Text>
              </TouchableOpacity>
            )}

            {/* Video Crop Action */}
            {activeTransformItem.type === "video" && (
              <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => {
                  soundEngine.playSfx("click");
                  handleEnterCropMode(activeTransformItem.id);
                }}
                {...(Platform.OS === "web"
                  ? ({
                      onClick: (e: any) => {
                        e.stopPropagation?.();
                        soundEngine.playSfx("click");
                        handleEnterCropMode(activeTransformItem.id);
                      },
                      onMouseDown: (e: any) => e.stopPropagation?.(),
                    } as any)
                  : {})}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="crop" size={13} color="#FFFFFF" />
                <Text style={styles.floatingBtnText}>Crop</Text>
              </TouchableOpacity>
            )}

            {/* Video Mask Action */}
            {activeTransformItem.type === "video" && (
              <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenMaskModal?.(activeTransformItem.id);
                }}
                {...(Platform.OS === "web"
                  ? ({
                      onClick: (e: any) => {
                        e.stopPropagation?.();
                        soundEngine.playSfx("click");
                        onOpenMaskModal?.(activeTransformItem.id);
                      },
                      onMouseDown: (e: any) => e.stopPropagation?.(),
                    } as any)
                  : {})}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="shapes-outline" size={13} color="#00F2FE" />
                <Text style={[styles.floatingBtnText, { color: "#00F2FE" }]}>
                  Mask
                </Text>
              </TouchableOpacity>
            )}

            {/* Animation Action */}
            {onOpenAnimationModal && (
              <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenAnimationModal();
                }}
                {...(Platform.OS === "web"
                  ? ({
                      onClick: (e: any) => {
                        e.stopPropagation?.();
                        soundEngine.playSfx("click");
                        onOpenAnimationModal();
                      },
                      onMouseDown: (e: any) => e.stopPropagation?.(),
                    } as any)
                  : {})}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="play-circle-outline" size={13} color="#A78BFA" />
                <Text style={[styles.floatingBtnText, { color: "#A78BFA" }]}>
                  Anim
                </Text>
              </TouchableOpacity>
            )}

            {/* Delete */}
            <TouchableOpacity
              style={[styles.floatingActionBtn, styles.floatingDeleteBtn]}
              onPress={() => {
                soundEngine.playSfx("click");
                onDeleteClip?.(activeTransformItem.id, activeTransformItem.type);
              }}
              {...(Platform.OS === "web"
                ? ({
                    onClick: (e: any) => {
                      e.stopPropagation?.();
                      soundEngine.playSfx("click");
                      onDeleteClip?.(activeTransformItem.id, activeTransformItem.type);
                    },
                    onMouseDown: (e: any) => e.stopPropagation?.(),
                  } as any)
                : {})}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={13} color="#FB7185" />
              <Text style={[styles.floatingBtnText, { color: "#FB7185" }]}>
                Delete
              </Text>
            </TouchableOpacity>

            {/* Done */}
            <TouchableOpacity
              style={[styles.floatingActionBtn, styles.floatingDoneBtn]}
              onPress={() => {
                soundEngine.playSfx("pop");
                onSelectClip?.(null);
              }}
              {...(Platform.OS === "web"
                ? ({
                    onClick: (e: any) => {
                      e.stopPropagation?.();
                      soundEngine.playSfx("pop");
                      onSelectClip?.(null);
                    },
                    onMouseDown: (e: any) => e.stopPropagation?.(),
                  } as any)
                : {})}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#10B981"
              />
              <Text style={[styles.floatingBtnText, { color: "#10B981" }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
};

export const PlayerTransformOverlay = React.memo(PlayerTransformOverlayComponent);
export default PlayerTransformOverlay;
