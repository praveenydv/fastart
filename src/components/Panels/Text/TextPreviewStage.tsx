import React from "react";
import { View, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./TextModalStyles";

interface TextPreviewStageProps {
  inputText: string;
  selectedAnim: string;
  animTick: number;
  selectedTextEffect: string;
  selectedBorderColor?: string;
  selectedColor: string;
  selectedStrokeColor?: string;
  selectedBg: string;
  selectedScale: number;
  selectedRotation: number;
  selectedFontSize: number;
  selectedFont: string;
}

export default function TextPreviewStage({
  inputText,
  selectedAnim,
  animTick,
  selectedTextEffect,
  selectedBorderColor,
  selectedColor,
  selectedStrokeColor,
  selectedBg,
  selectedScale,
  selectedRotation,
  selectedFontSize,
  selectedFont,
}: TextPreviewStageProps) {
  let previewTextValue = inputText || "Your Text Here";
  if (selectedAnim === "typewriter") {
    const len = Math.max(1, (animTick * 2) % (previewTextValue.length + 6));
    previewTextValue = previewTextValue.slice(
      0,
      Math.min(len, previewTextValue.length),
    );
  }

  let animScale = 1.0;
  let animTranslateY = 0;
  let animTranslateX = 0;

  if (selectedAnim === "pulse") {
    animScale = 1.0 + Math.sin(animTick * 0.4) * 0.08;
  } else if (selectedAnim === "bounce") {
    animScale = 1.0 + Math.abs(Math.sin(animTick * 0.5)) * 0.12;
  } else if (selectedAnim === "wave") {
    animTranslateY = Math.sin(animTick * 0.35) * 5;
  } else if (selectedAnim === "glitch") {
    animTranslateX = animTick % 7 === 0 ? 3 : animTick % 9 === 0 ? -3 : 0;
  } else if (selectedAnim === "shake") {
    animTranslateX = Math.sin(animTick * 1.8) * 3;
  }

  let effectShadowColor = "rgba(0,0,0,0.5)";
  let effectShadowRadius = 6;
  let effectShadowOffset = { width: 0, height: 0 };
  let webTextShadow: string | undefined = undefined;
  let webStroke: string | undefined = undefined;

  if (selectedTextEffect === "neon") {
    const glowColor = selectedBorderColor || selectedColor || "#00F2FE";
    effectShadowColor = glowColor;
    effectShadowRadius = 18;
    webTextShadow = `0 0 8px ${glowColor}, 0 0 18px ${glowColor}, 0 0 32px ${glowColor}`;
  } else if (selectedTextEffect === "3d") {
    effectShadowColor = "rgba(0,0,0,0.9)";
    effectShadowRadius = 2;
    effectShadowOffset = { width: 4, height: 4 };
    webTextShadow =
      "1px 1px 0 #000, 2px 2px 0 #111, 3px 3px 0 #222, 4px 4px 6px rgba(0,0,0,0.8)";
  } else if (selectedTextEffect === "shadow") {
    effectShadowColor = "rgba(0,0,0,0.92)";
    effectShadowRadius = 12;
    effectShadowOffset = { width: 3, height: 5 };
    webTextShadow = "3px 5px 12px rgba(0,0,0,0.92)";
  } else if (selectedTextEffect === "stroke") {
    effectShadowColor = selectedStrokeColor || "#000000";
    effectShadowRadius = 2;
    webStroke = `1.5px ${selectedStrokeColor || "#000000"}`;
    webTextShadow =
      "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
  } else if (selectedTextEffect === "cyber") {
    effectShadowColor = "#FF0050";
    effectShadowRadius = 8;
    effectShadowOffset = { width: 3, height: 2 };
    webTextShadow = "2px 2px 0 #FF0050, -2px -2px 0 #00F2FE";
  } else if (selectedTextEffect === "gold") {
    effectShadowColor = "#FFE600";
    effectShadowRadius = 16;
    webTextShadow =
      "0 0 10px #FFE600, 0 0 20px #F59E0B, 2px 2px 4px rgba(0,0,0,0.6)";
  } else if (selectedTextEffect === "glitch") {
    effectShadowColor = "#00F2FE";
    effectShadowRadius = 6;
    effectShadowOffset = { width: -3, height: 0 };
    webTextShadow = "3px 0 #FF0050, -3px 0 #00F2FE";
  } else if (selectedBorderColor) {
    effectShadowColor = selectedBorderColor;
    effectShadowRadius = 8;
  }

  return (
    <View style={styles.previewStage}>
      <View style={styles.previewTopBar}>
        <View style={styles.effectBadge}>
          <Ionicons name="color-wand" size={10} color="#FFE600" />
          <Text style={styles.effectBadgeText}>
            {selectedTextEffect.toUpperCase()} EFFECT
          </Text>
        </View>
        <View style={styles.animBadge}>
          <Ionicons name="sparkles" size={10} color="#00F2FE" />
          <Text style={styles.animBadgeText}>
            {selectedAnim.toUpperCase()}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.previewPill,
          {
            backgroundColor: selectedBg,
            borderColor: selectedBorderColor || "transparent",
            borderWidth: selectedBorderColor ? 2 : 0,
            transform: [
              { scale: selectedScale * animScale },
              { rotate: `${selectedRotation}deg` },
              { translateX: animTranslateX },
              { translateY: animTranslateY },
            ],
          },
        ]}
      >
        <Text
          style={[
            styles.previewText,
            {
              color: selectedColor,
              fontSize: selectedFontSize,
              fontFamily: selectedFont,
              textShadowColor: effectShadowColor,
              textShadowRadius: effectShadowRadius,
              textShadowOffset: effectShadowOffset,
              ...(Platform.OS === "web" && webTextShadow
                ? ({ textShadow: webTextShadow } as any)
                : {}),
              ...(Platform.OS === "web" && webStroke
                ? ({ WebkitTextStroke: webStroke } as any)
                : {}),
            },
          ]}
          numberOfLines={2}
        >
          {previewTextValue}
        </Text>
      </View>
    </View>
  );
}
