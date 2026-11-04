import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Image,
  PanResponder,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { rustCoreBridge } from "../../../services/rustCoreBridge";
import { CHROMA_QUICK_PRESETS } from "./CutoutConstants";

interface CutoutColorDropperModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectColor: (hex: string) => void;
  initialColor?: string;
  selectedClip?: any;
  currentTime?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const CutoutColorDropperModal: React.FC<CutoutColorDropperModalProps> = ({
  visible,
  onClose,
  onSelectColor,
  initialColor = "#00FF00",
  selectedClip,
  currentTime = 0,
}) => {
  const [sampledColor, setSampledColor] = useState<string>(initialColor);
  const [reticlePos, setReticlePos] = useState<{ x: number; y: number }>({
    x: SCREEN_WIDTH * 0.5,
    y: SCREEN_HEIGHT * 0.4,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const frameBoxRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
  });

  const lastSampledTimeRef = useRef<number>(0);
  const clipUrl = selectedClip?.url || selectedClip?.thumbnail || "";

  const sampleAtPosition = async (screenX: number, screenY: number) => {
    const box = frameBoxRef.current;
    if (box.width <= 0 || box.height <= 0) return;

    const relX = Math.max(0, Math.min(box.width, screenX - box.x));
    const relY = Math.max(0, Math.min(box.height, screenY - box.y));

    const normX = relX / box.width;
    const normY = relY / box.height;

    const now = Date.now();
    if (now - lastSampledTimeRef.current < 25) return; // Cap at 40 FPS sampling
    lastSampledTimeRef.current = now;

    try {
      const hex = await rustCoreBridge.sampleVideoPixel(clipUrl, currentTime, normX, normY);
      if (hex) {
        setSampledColor(hex);
      }
    } catch {}
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          setIsDragging(true);
          const { pageX, pageY } = evt.nativeEvent;
          setReticlePos({ x: pageX, y: pageY });
          sampleAtPosition(pageX, pageY);
        },
        onPanResponderMove: (evt) => {
          const { pageX, pageY } = evt.nativeEvent;
          setReticlePos({ x: pageX, y: pageY });
          sampleAtPosition(pageX, pageY);
        },
        onPanResponderRelease: (evt) => {
          setIsDragging(false);
          const { pageX, pageY } = evt.nativeEvent;
          sampleAtPosition(pageX, pageY);
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clipUrl, currentTime]
  );

  const handleAutoDetect = async () => {
    try {
      const detected = await rustCoreBridge.detectBackdropColor(clipUrl, currentTime);
      if (detected) {
        setSampledColor(detected);
      }
    } catch {
      setSampledColor("#00FF00");
    }
  };

  const handleApply = () => {
    onSelectColor(sampledColor);
    onClose();
  };

  if (!visible) return null;

  // Float the loupe 55px above the finger touch position so thumb doesn't hide target
  const loupeX = Math.max(45, Math.min(SCREEN_WIDTH - 45, reticlePos.x));
  const loupeY = Math.max(90, Math.min(SCREEN_HEIGHT - 160, reticlePos.y - 55));

  const imageSource = selectedClip?.thumbnail
    ? { uri: selectedClip.thumbnail }
    : selectedClip?.url && (selectedClip.url.endsWith(".png") || selectedClip.url.endsWith(".jpg") || selectedClip.url.endsWith(".jpeg") || selectedClip.url.endsWith(".webp"))
    ? { uri: selectedClip.url }
    : null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={s.container}>
        {/* Header Bar */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.headerBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={s.headerTitleWrap}>
            <Ionicons name="eyedrop" size={15} color="#00F2FE" />
            <Text style={s.headerTitle}>Color Dropper</Text>
          </View>
          <TouchableOpacity onPress={handleApply} style={s.applyHeaderBtn} activeOpacity={0.8}>
            <Ionicons name="checkmark" size={16} color="#08090E" />
            <Text style={s.applyHeaderBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Guidance Prompt */}
        <View style={s.guidanceBanner}>
          <Text style={s.guidanceText}>
            Touch and drag the crosshair over the video background to sample its color.
          </Text>
        </View>

        {/* Interactive Video Surface with Loupe */}
        <View
          style={s.canvasArea}
          onLayout={(e) => {
            frameBoxRef.current = e.nativeEvent.layout;
          }}
          {...panResponder.panHandlers}
        >
          {/* Frame Display */}
          {imageSource ? (
            <Image source={imageSource} style={s.frameImage} resizeMode="contain" />
          ) : (
            <View style={s.placeholderFrame}>
              <Ionicons name="videocam-outline" size={48} color="#334155" />
              <Text style={s.placeholderText}>Tap anywhere to sample color</Text>
            </View>
          )}

          {/* Touch Point Indicator */}
          <View style={[s.touchPoint, { left: reticlePos.x - 6, top: reticlePos.y - 6 }]} />

          {/* Dotted Connection Line */}
          <View
            style={[
              s.connectorLine,
              {
                left: reticlePos.x - 1,
                top: Math.min(reticlePos.y, loupeY + 36),
                height: Math.max(0, reticlePos.y - (loupeY + 36)),
              },
            ]}
          />

          {/* Floating Magnifying Loupe */}
          <View
            style={[
              s.loupeCircle,
              {
                left: loupeX - 36,
                top: loupeY - 36,
                borderColor: sampledColor,
                shadowColor: sampledColor,
              },
              isDragging && s.loupeDragging,
            ]}
          >
            {/* Loupe Color Core */}
            <View style={[s.loupeCore, { backgroundColor: sampledColor }]} />

            {/* Precision Crosshair */}
            <View style={s.crosshairV} />
            <View style={s.crosshairH} />
            <View style={[s.centerTargetDot, { borderColor: sampledColor }]} />

            {/* Hex Value Floating Pill */}
            <View style={s.hexPill}>
              <View style={[s.hexColorDot, { backgroundColor: sampledColor }]} />
              <Text style={s.hexPillText}>{sampledColor.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Bottom Control Dock */}
        <View style={s.bottomDock}>
          {/* Quick Chroma Presets & Auto Detect */}
          <View style={s.presetsRow}>
            <TouchableOpacity
              style={s.autoDetectBtn}
              onPress={handleAutoDetect}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={13} color="#10B981" />
              <Text style={s.autoDetectBtnText}>Auto Detect</Text>
            </TouchableOpacity>

            <View style={s.swatchesList}>
              {CHROMA_QUICK_PRESETS.map((p) => {
                const isSelected = sampledColor.toUpperCase() === p.color.toUpperCase();
                return (
                  <TouchableOpacity
                    key={p.color}
                    style={[
                      s.swatchItem,
                      { backgroundColor: p.color },
                      isSelected && s.swatchItemSelected,
                    ]}
                    onPress={() => setSampledColor(p.color)}
                    activeOpacity={0.8}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={p.color === "#FFFFFF" || p.color === "#00FF00" ? "#000000" : "#FFFFFF"}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity style={s.setButton} onPress={handleApply} activeOpacity={0.85}>
            <View style={[s.btnColorPreview, { backgroundColor: sampledColor }]} />
            <Text style={s.setButtonText}>Set Chroma Color ({sampledColor.toUpperCase()})</Text>
            <Ionicons name="checkmark-circle" size={18} color="#08090E" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07090E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#0C101A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E273A",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#161D2E",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  applyHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#00F2FE",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  applyHeaderBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#08090E",
  },
  guidanceBanner: {
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 242, 254, 0.15)",
  },
  guidanceText: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },
  canvasArea: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
    overflow: "hidden",
  },
  frameImage: {
    width: "100%",
    height: "100%",
  },
  placeholderFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderText: {
    fontSize: 12,
    color: "#64748B",
  },
  touchPoint: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 2,
    borderColor: "#000000",
    zIndex: 10,
  },
  connectorLine: {
    position: "absolute",
    width: 2,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    zIndex: 9,
  },
  loupeCircle: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    backgroundColor: "rgba(10, 14, 23, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  loupeDragging: {
    transform: [{ scale: 1.08 }],
  },
  loupeCore: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    opacity: 0.95,
  },
  crosshairV: {
    position: "absolute",
    width: 1.5,
    height: 32,
    backgroundColor: "#FFFFFF",
    zIndex: 22,
  },
  crosshairH: {
    position: "absolute",
    width: 32,
    height: 1.5,
    backgroundColor: "#FFFFFF",
    zIndex: 22,
  },
  centerTargetDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
    zIndex: 23,
  },
  hexPill: {
    position: "absolute",
    top: -26,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#070A11",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E273A",
  },
  hexColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hexPillText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  bottomDock: {
    backgroundColor: "#0A0D15",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: "#1E273A",
    gap: 12,
  },
  presetsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  autoDetectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  autoDetectBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#10B981",
  },
  swatchesList: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  swatchItem: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  swatchItemSelected: {
    borderColor: "#00F2FE",
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  setButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00F2FE",
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnColorPreview: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#08090E",
  },
  setButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#08090E",
  },
});
