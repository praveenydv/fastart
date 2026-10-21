import React from "react";
import { View, Text } from "react-native";
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
}) => {
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
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "pan"),
            onTouchStart: (e: any) => handleCropDragStart(e, "pan"),
          } as any)}
        />

        {/* 4 Corner Handles */}
        <View
          style={[styles.cropCornerHitArea, styles.cropCornerTL]}
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "tl"),
            onTouchStart: (e: any) => handleCropDragStart(e, "tl"),
          } as any)}
        >
          <View style={[styles.cropCornerArmH, { top: 0, left: 0 }]} />
          <View style={[styles.cropCornerArmV, { top: 0, left: 0 }]} />
        </View>

        <View
          style={[styles.cropCornerHitArea, styles.cropCornerTR]}
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "tr"),
            onTouchStart: (e: any) => handleCropDragStart(e, "tr"),
          } as any)}
        >
          <View style={[styles.cropCornerArmH, { top: 0, right: 0 }]} />
          <View style={[styles.cropCornerArmV, { top: 0, right: 0 }]} />
        </View>

        <View
          style={[styles.cropCornerHitArea, styles.cropCornerBL]}
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "bl"),
            onTouchStart: (e: any) => handleCropDragStart(e, "bl"),
          } as any)}
        >
          <View style={[styles.cropCornerArmH, { bottom: 0, left: 0 }]} />
          <View style={[styles.cropCornerArmV, { bottom: 0, left: 0 }]} />
        </View>

        <View
          style={[styles.cropCornerHitArea, styles.cropCornerBR]}
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "br"),
            onTouchStart: (e: any) => handleCropDragStart(e, "br"),
          } as any)}
        >
          <View style={[styles.cropCornerArmH, { bottom: 0, right: 0 }]} />
          <View style={[styles.cropCornerArmV, { bottom: 0, right: 0 }]} />
        </View>

        {/* 4 Edge Handles */}
        <View
          style={[styles.cropEdgeHitAreaH, styles.cropEdgeTop]}
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "t"),
            onTouchStart: (e: any) => handleCropDragStart(e, "t"),
          } as any)}
        >
          <View style={styles.cropEdgePillH} />
        </View>

        <View
          style={[styles.cropEdgeHitAreaH, styles.cropEdgeBottom]}
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "b"),
            onTouchStart: (e: any) => handleCropDragStart(e, "b"),
          } as any)}
        >
          <View style={styles.cropEdgePillH} />
        </View>

        <View
          style={[styles.cropEdgeHitAreaV, styles.cropEdgeLeft]}
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "l"),
            onTouchStart: (e: any) => handleCropDragStart(e, "l"),
          } as any)}
        >
          <View style={styles.cropEdgePillV} />
        </View>

        <View
          style={[styles.cropEdgeHitAreaV, styles.cropEdgeRight]}
          {...({
            onMouseDown: (e: any) => handleCropDragStart(e, "r"),
            onTouchStart: (e: any) => handleCropDragStart(e, "r"),
          } as any)}
        >
          <View style={styles.cropEdgePillV} />
        </View>
      </View>
    </>
  );
};

export default React.memo(PlayerCropOverlay);
