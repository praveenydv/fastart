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
  selectedScale?: number;
  selectedRotation?: number;
  selectedFontSize?: number;
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
  selectedFont,
}: TextPreviewStageProps) {
  let previewTextValue = inputText || "Your Text Here";

  const cycleTicks = 34;
  const tickInCycle = animTick % cycleTicks;
  const cycleProgress = tickInCycle / cycleTicks; // 0.0 to 1.0

  let animScale = 1.0;
  let animTranslateY = 0;
  let animTranslateX = 0;
  let animOpacity = 1.0;

  const animNorm = (selectedAnim || "none").toLowerCase().replace(/[-_]/g, "");

  if (animNorm === "typewriter") {
    const totalChars = previewTextValue.length;
    const charProgress = Math.min(1, cycleProgress / 0.65);
    const len = Math.max(1, Math.floor(charProgress * totalChars));
    previewTextValue = previewTextValue.slice(0, len);
  } else if (animNorm === "bounce") {
    if (cycleProgress < 0.42) {
      const p = cycleProgress / 0.42;
      animScale = 0.4 + Math.sin(p * Math.PI) * 0.75;
      animOpacity = Math.min(1, p * 2.5);
    } else {
      animScale = 1.0;
      animOpacity = 1.0;
    }
  } else if (animNorm === "fade" || animNorm === "fadein") {
    if (cycleProgress < 0.35) {
      animOpacity = cycleProgress / 0.35;
    } else if (cycleProgress > 0.88) {
      animOpacity = (1.0 - cycleProgress) / 0.12;
    } else {
      animOpacity = 1.0;
    }
  } else if (animNorm === "slideup" || animNorm === "up") {
    if (cycleProgress < 0.38) {
      const p = cycleProgress / 0.38;
      const easeOut = Math.sin((p * Math.PI) / 2);
      animTranslateY = (1 - easeOut) * 38;
      animOpacity = p;
    } else if (cycleProgress > 0.88) {
      const p = (cycleProgress - 0.88) / 0.12;
      animTranslateY = -p * 20;
      animOpacity = 1 - p;
    } else {
      animTranslateY = 0;
      animOpacity = 1.0;
    }
  } else if (animNorm === "slidedown" || animNorm === "down") {
    if (cycleProgress < 0.38) {
      const p = cycleProgress / 0.38;
      const easeOut = Math.sin((p * Math.PI) / 2);
      animTranslateY = -(1 - easeOut) * 38;
      animOpacity = p;
    } else if (cycleProgress > 0.88) {
      const p = (cycleProgress - 0.88) / 0.12;
      animTranslateY = p * 20;
      animOpacity = 1 - p;
    } else {
      animTranslateY = 0;
      animOpacity = 1.0;
    }
  } else if (animNorm === "slide" || animNorm === "slideleft") {
    if (cycleProgress < 0.38) {
      const p = cycleProgress / 0.38;
      const easeOut = Math.sin((p * Math.PI) / 2);
      animTranslateX = (1 - easeOut) * 55;
      animOpacity = p;
    } else if (cycleProgress > 0.88) {
      const p = (cycleProgress - 0.88) / 0.12;
      animTranslateX = -p * 30;
      animOpacity = 1 - p;
    } else {
      animTranslateX = 0;
      animOpacity = 1.0;
    }
  } else if (animNorm === "slideright") {
    if (cycleProgress < 0.38) {
      const p = cycleProgress / 0.38;
      const easeOut = Math.sin((p * Math.PI) / 2);
      animTranslateX = -(1 - easeOut) * 55;
      animOpacity = p;
    } else if (cycleProgress > 0.88) {
      const p = (cycleProgress - 0.88) / 0.12;
      animTranslateX = p * 30;
      animOpacity = 1 - p;
    } else {
      animTranslateX = 0;
      animOpacity = 1.0;
    }
  } else if (animNorm === "zoomin" || animNorm === "zoom") {
    if (cycleProgress < 0.38) {
      const p = cycleProgress / 0.38;
      const easeOut = Math.sin((p * Math.PI) / 2);
      animScale = 0.3 + easeOut * 0.7;
      animOpacity = p;
    } else if (cycleProgress > 0.88) {
      const p = (cycleProgress - 0.88) / 0.12;
      animScale = 1.0 + p * 0.2;
      animOpacity = 1 - p;
    } else {
      animScale = 1.0;
      animOpacity = 1.0;
    }
  } else if (animNorm === "pulse") {
    animScale = 1.0 + Math.sin(animTick * 0.4) * 0.09;
  } else if (animNorm === "wave") {
    animTranslateY = Math.sin(animTick * 0.35) * 6;
  } else if (animNorm === "glitch") {
    animTranslateX = animTick % 6 === 0 ? 4 : animTick % 8 === 0 ? -4 : 0;
  } else if (animNorm === "shake") {
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
  } else if (selectedTextEffect === "fire") {
    effectShadowColor = "#FF3300";
    effectShadowRadius = 20;
    webTextShadow = "0 -2px 10px #FF3300, 0 -6px 18px #FF8800";
  } else if (selectedTextEffect === "frost") {
    effectShadowColor = "#00F2FE";
    effectShadowRadius = 18;
    webTextShadow = "0 0 10px #00F2FE, 0 0 20px #0284C7";
  } else if (selectedTextEffect === "retro_box") {
    webTextShadow = "none";
  } else if (selectedTextEffect === "hologram") {
    effectShadowColor = "rgba(0, 242, 254, 0.7)";
    effectShadowRadius = 8;
    webTextShadow = "-2px 0 0 rgba(0, 242, 254, 0.8), 2px 0 0 rgba(255, 0, 128, 0.8)";
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
            opacity: animOpacity,
            // Default transformation: no rotation, default scale (1.0 * animScale), default alignment
            transform: [
              { scale: animScale },
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
              // Default text size in preview for clean, readable text add/edit
              fontSize: 20,
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
