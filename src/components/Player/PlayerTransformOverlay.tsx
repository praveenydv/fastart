import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./PlayerStyles";
import { ActiveTransformItem } from "./playerTypes";

interface PlayerTransformOverlayProps {
  selectedClipId?: string | null;
  activeVideos: any[];
  activeTexts: any[];
  activeStickers: any[];
  activeTransformItem: ActiveTransformItem | null;
  boxWidth: number;
  canvasHeight: number;
  currentTime: number;
  onSelectClip?: (id: string | null, type?: string) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
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
    type: "text" | "sticker" | "video",
    clip: any,
  ) => { baseW: number; baseH: number };
  getInterpolatedTransform: (clip: any, curTime: number) => any;
}

export const PlayerTransformOverlay: React.FC<PlayerTransformOverlayProps> = ({
  selectedClipId,
  activeVideos,
  activeTexts,
  activeStickers,
  activeTransformItem,
  boxWidth,
  canvasHeight,
  currentTime,
  onSelectClip,
  onOpenEditModal,
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

        {/* Unselected Clickable & Immediately Draggable Hit Areas for Active Videos */}
        {activeVideos.map((vid) => {
          if (selectedClipId === vid.id) return null;
          const vidTrackZ =
            (typeof vid.trackIndex === "number" ? vid.trackIndex : 0) * 2 + 10;
          const kfT = getInterpolatedTransform(vid, currentTime);
          const cx = (50 + ((kfT.x / boxWidth) * 100) / 100) * boxWidth;
          const cy = (50 + ((kfT.y / canvasHeight) * 100) / 100) * canvasHeight;
          const s = (vid.scale || 1) * kfT.scale;
          const { baseW, baseH } = getItemBaseDimensions("video", vid);
          const w = Math.round(baseW * s);
          const h = Math.round(baseH * s);
          const itemObj = {
            id: vid.id,
            type: "video" as const,
            label: vid.title,
            pos: {
              x: 50 + ((vid.transform?.x || 0) / boxWidth) * 100,
              y: 50 + ((vid.transform?.y || 0) / canvasHeight) * 100,
            },
            scale: s,
            rotation: vid.transform?.rotation ?? 0,
            width: w,
            height: h,
          };
          return (
            <TouchableOpacity
              key={vid.id}
              activeOpacity={0.85}
              onPress={() => onSelectClip?.(vid.id, "video")}
              style={[
                styles.unselectedHitBox,
                {
                  left: cx - w / 2,
                  top: cy - h / 2,
                  width: w,
                  height: h,
                  zIndex: vidTrackZ,
                  transform: [{ rotate: `${vid.transform?.rotation || 0}deg` }],
                },
              ]}
              {...(Platform.OS === "web"
                ? ({
                    onMouseDown: (e: any) => {
                      onSelectClip?.(vid.id, "video");
                      handleStartDrag(e, "move", undefined, itemObj);
                    },
                    onTouchStart: (e: any) => {
                      onSelectClip?.(vid.id, "video");
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
            (typeof txt.trackIndex === "number" ? txt.trackIndex : 2) * 2 + 30;
          const cx = ((txt.position?.x ?? 50) / 100) * boxWidth;
          const cy = ((txt.position?.y ?? 35) / 100) * canvasHeight;
          const s = txt.scale || 1.0;
          const { baseW, baseH } = getItemBaseDimensions("text", txt);
          const w = Math.round(baseW * s);
          const h = Math.round(baseH * s);
          const itemObj = {
            id: txt.id,
            type: "text" as const,
            label: txt.text,
            pos: txt.position || { x: 50, y: 35 },
            scale: txt.scale ?? 1.0,
            rotation: txt.rotation ?? 0,
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
                  transform: [{ rotate: `${txt.rotation || 0}deg` }],
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
            (typeof stk.trackIndex === "number" ? stk.trackIndex : 3) * 2 + 32;
          const cx = ((stk.position?.x ?? 50) / 100) * boxWidth;
          const cy = ((stk.position?.y ?? 50) / 100) * canvasHeight;
          const s = stk.scale || 1.2;
          const { baseW, baseH } = getItemBaseDimensions("sticker", stk);
          const w = Math.round(baseW * s);
          const h = Math.round(baseH * s);
          const itemObj = {
            id: stk.id,
            type: "sticker" as const,
            label: stk.char,
            pos: stk.position || { x: 50, y: 50 },
            scale: stk.scale ?? 1.2,
            rotation: stk.rotation ?? 0,
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
                  transform: [{ rotate: `${stk.rotation || 0}deg` }],
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

        {/* Active Selected Transform Bounding Box with Hand Drag, Resize & Rotate Handles */}
        {activeTransformItem && (
          <View
            style={[
              styles.activeTransformBox,
              {
                left:
                  (activeTransformItem.pos.x / 100) * boxWidth -
                  activeTransformItem.width / 2,
                top:
                  (activeTransformItem.pos.y / 100) * canvasHeight -
                  activeTransformItem.height / 2,
                width: activeTransformItem.width,
                height: activeTransformItem.height,
                transform: [{ rotate: `${activeTransformItem.rotation}deg` }],
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
          <View style={styles.floatingHudContentCompact}>
            {/* Primary Action */}
            {activeTransformItem.type === "video" ? (
              <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => handleEnterCropMode(activeTransformItem.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="crop" size={13} color="#00F2FE" />
                <Text style={styles.floatingBtnText}>Crop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() =>
                  onOpenEditModal?.(
                    activeTransformItem.id,
                    activeTransformItem.type,
                  )
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil" size={13} color="#00F2FE" />
                <Text style={styles.floatingBtnText}>Edit</Text>
              </TouchableOpacity>
            )}

            {/* Delete */}
            <TouchableOpacity
              style={[styles.floatingActionBtn, styles.floatingDeleteBtn]}
              onPress={() =>
                onDeleteClip?.(activeTransformItem.id, activeTransformItem.type)
              }
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
              onPress={() => onSelectClip?.(null)}
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

export default React.memo(PlayerTransformOverlay);
