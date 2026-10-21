import React from "react";
import { View, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./PlayerStyles";
import { CustomCrop } from "../../types/project";

interface PlayerCropOverlayProps {
  cropPixelX: number;
  cropPixelY: number;
  cropPixelW: number;
  cropPixelH: number;
  cropBox: CustomCrop;
  cropPreset: string;
  mw: number;
  mh: number;
  handleCropDragStart: (e: any, handle: string) => void;
  cropResponders?: Record<string, any>;
}

export const PlayerCropOverlay: React.FC<PlayerCropOverlayProps> = ({
  cropPixelX,
  cropPixelY,
  cropPixelW,
  cropPixelH,
  cropBox,
  cropPreset,
  mw,
  mh,
  handleCropDragStart,
  cropResponders,
}) => {
  const getResponderProps = (handle: string) => {
    if (Platform.OS === "web") {
      return {
        onMouseDown: (e: any) => handleCropDragStart(e, handle),
        onTouchStart: (e: any) => handleCropDragStart(e, handle),
      };
    }
    return cropResponders?.[handle]?.panHandlers || {};
  };

  return (
    <>
      {/* 4 Dimmed Scrim Panels outside crop area */}
      <View
        style={[
          styles.cropScrim,
          {
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(0, cropPixelY),
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.cropScrim,
          {
            top: cropPixelY + cropPixelH,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.cropScrim,
          {
            top: cropPixelY,
            left: 0,
            width: Math.max(0, cropPixelX),
            height: cropPixelH,
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.cropScrim,
          {
            top: cropPixelY,
            left: cropPixelX + cropPixelW,
            right: 0,
            height: cropPixelH,
          },
        ]}
        pointerEvents="none"
      />

      {/* Interactive Crop Box Frame */}
      <View
        style={[
          styles.cropBoxFrame,
          {
            left: cropPixelX,
            top: cropPixelY,
            width: cropPixelW,
            height: cropPixelH,
          },
        ]}
      >
        {/* Rule-of-Thirds Composition Grid */}
        <View
          style={[styles.cropGridLine, styles.cropGridLineH, { top: "33.33%" }]}
          pointerEvents="none"
        />
        <View
          style={[styles.cropGridLine, styles.cropGridLineH, { top: "66.66%" }]}
          pointerEvents="none"
        />
        <View
          style={[styles.cropGridLine, styles.cropGridLineV, { left: "33.33%" }]}
          pointerEvents="none"
        />
        <View
          style={[styles.cropGridLine, styles.cropGridLineV, { left: "66.66%" }]}
          pointerEvents="none"
        />

        {/* Viewfinder Badge */}
        <View style={styles.cropBadgePill} pointerEvents="none">
          <Ionicons
            name="crop"
            size={10}
            color="#00F2FE"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.cropBadgeText}>
            {cropPreset.toUpperCase()} • {Math.round((cropBox.width / 100) * mw)}×
            {Math.round((cropBox.height / 100) * mh)}
          </Text>
        </View>

        {/* Center Pan Hit Area */}
        <View
          style={styles.cropPanHitArea}
          {...getResponderProps("pan")}
        />

        {/* 4 Corner Handles */}
        <View
          style={[styles.cropCornerHitArea, styles.cropCornerTL]}
          {...getResponderProps("tl")}
        >
          <View style={[styles.cropCornerArmH, { top: 0, left: 0 }]} />
          <View style={[styles.cropCornerArmV, { top: 0, left: 0 }]} />
        </View>

        <View
          style={[styles.cropCornerHitArea, styles.cropCornerTR]}
          {...getResponderProps("tr")}
        >
          <View style={[styles.cropCornerArmH, { top: 0, right: 0 }]} />
          <View style={[styles.cropCornerArmV, { top: 0, right: 0 }]} />
        </View>

        <View
          style={[styles.cropCornerHitArea, styles.cropCornerBL]}
          {...getResponderProps("bl")}
        >
          <View style={[styles.cropCornerArmH, { bottom: 0, left: 0 }]} />
          <View style={[styles.cropCornerArmV, { bottom: 0, left: 0 }]} />
        </View>

        <View
          style={[styles.cropCornerHitArea, styles.cropCornerBR]}
          {...getResponderProps("br")}
        >
          <View style={[styles.cropCornerArmH, { bottom: 0, right: 0 }]} />
          <View style={[styles.cropCornerArmV, { bottom: 0, right: 0 }]} />
        </View>

        {/* 4 Edge Handles */}
        <View
          style={[styles.cropEdgeHitAreaH, styles.cropEdgeTop]}
          {...getResponderProps("t")}
        >
          <View style={styles.cropEdgePillH} />
        </View>

        <View
          style={[styles.cropEdgeHitAreaH, styles.cropEdgeBottom]}
          {...getResponderProps("b")}
        >
          <View style={styles.cropEdgePillH} />
        </View>

        <View
          style={[styles.cropEdgeHitAreaV, styles.cropEdgeLeft]}
          {...getResponderProps("l")}
        >
          <View style={styles.cropEdgePillV} />
        </View>

        <View
          style={[styles.cropEdgeHitAreaV, styles.cropEdgeRight]}
          {...getResponderProps("r")}
        >
          <View style={styles.cropEdgePillV} />
        </View>
      </View>
    </>
  );
};

export default React.memo(PlayerCropOverlay);
