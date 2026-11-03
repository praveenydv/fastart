import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClipAnimationConfig } from "../../types/project";
import { PRESET_PREVIEW_IMAGE } from "../../constants/sampleMedia";
import { CompactSliderInput } from "../Common/CompactSliderInput";
import { rustCoreBridge } from "../../services/rustCoreBridge";
import AnimationModal, {
  ANIMATION_IN_PRESETS,
  ANIMATION_LOOP_PRESETS,
  ANIMATION_OUT_PRESETS,
  type AnimationModalProps,
  type AnimationPresetItem,
} from "./AnimationModal";

type AnimationCategory = "in" | "out" | "loop";

function readAnimationConfig(value: unknown): ClipAnimationConfig {
  if (typeof value === "object" && value !== null) {
    return value as ClipAnimationConfig;
  }
  if (typeof value !== "string" || value === "none") return {};

  if (value.endsWith("_in")) {
    return { preset: value, type: "in", inPreset: value };
  }
  if (value.endsWith("_out")) {
    return { preset: value, type: "out", outPreset: value };
  }
  return { preset: value, type: "loop", loopPreset: value };
}

function getCategoryPreset(
  animation: ClipAnimationConfig,
  category: AnimationCategory,
): string {
  if (category === "in") {
    return animation.inPreset || (animation.type === "in" ? animation.preset : undefined) || "none";
  }
  if (category === "out") {
    return animation.outPreset || (animation.type === "out" ? animation.preset : undefined) || "none";
  }
  return animation.loopPreset || animation.comboPreset ||
    ((animation.type === "loop" || animation.type === "combo") ? animation.preset : undefined) ||
    (!animation.inPreset && !animation.outPreset ? animation.preset : undefined) || "none";
}

function getTrackKey(tracks: Record<string, unknown>, selectedClipType: string): string {
  const type = selectedClipType.toLowerCase();
  if (type === "caption" || type === "captions") return "captions";
  if (type === "text" || type === "texts") return "text";
  if (type === "sticker" || type === "stickers") return "stickers";
  return Array.isArray(tracks[type]) ? type : "video";
}

function updateClipAnimation(
  props: AnimationModalProps,
  animation: ClipAnimationConfig | undefined,
): void {
  const { project, selectedClip, selectedClipType, updateProjectWithHistory } = props;
  if (!project || !selectedClip?.id) return;

  const tracks = project.tracks || {};
  const trackKey = getTrackKey(tracks, selectedClipType || "video");
  const clips = Array.isArray(tracks[trackKey]) ? [...tracks[trackKey]] : [];
  const clipIndex = clips.findIndex((clip: any) => clip.id === selectedClip.id);
  if (clipIndex < 0) return;

  clips[clipIndex] = { ...clips[clipIndex], animation };
  updateProjectWithHistory({
    ...project,
    tracks: { ...tracks, [trackKey]: clips },
  });
}

function NativeAnimationModal(props: AnimationModalProps) {
  const {
    visible,
    onClose,
    selectedClip,
    isInline = false,
  } = props;
  const [activeCategory, setActiveCategory] = useState<AnimationCategory>("in");
  const animation = useMemo(
    () => readAnimationConfig(selectedClip?.animation),
    [selectedClip?.animation],
  );
  const [duration, setDuration] = useState(() =>
    Math.max(0.1, animation.inDuration || animation.duration || 0.5),
  );
  const [preview] = useState(() => ({
    opacity: new Animated.Value(1),
    scaleX: new Animated.Value(1),
    scaleY: new Animated.Value(1),
    translateX: new Animated.Value(0),
    translateY: new Animated.Value(0),
    rotation: new Animated.Value(0),
  }));

  const maxDuration = Math.max(
    0.1,
    Math.min(3, (selectedClip?.duration || 3) * 0.5),
  );
  const activePreset = getCategoryPreset(animation, activeCategory);
  const presets = activeCategory === "in"
    ? ANIMATION_IN_PRESETS
    : activeCategory === "out"
      ? ANIMATION_OUT_PRESETS
      : ANIMATION_LOOP_PRESETS;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let animationLoop: Animated.CompositeAnimation | null = null;

    if (activePreset === "none") {
      Object.values(preview).forEach((value) => value.setValue(1));
      preview.translateX.setValue(0);
      preview.translateY.setValue(0);
      preview.rotation.setValue(0);
      return;
    }

    rustCoreBridge
      .generateAnimationKeyframes(activePreset, activeCategory, 24)
      .then((frames) => {
        if (cancelled || frames.length < 2) return;
        const firstFrame = frames[0];
        preview.opacity.setValue(firstFrame[0]);
        preview.scaleX.setValue(firstFrame[1]);
        preview.scaleY.setValue(firstFrame[2]);
        preview.translateX.setValue(firstFrame[3] * 1.04);
        preview.translateY.setValue(firstFrame[4] * 1.04);
        preview.rotation.setValue(firstFrame[5]);
        const frameDuration = Math.max(16, (duration * 1000) / (frames.length - 1));
        const keys = [
          preview.opacity,
          preview.scaleX,
          preview.scaleY,
          preview.translateX,
          preview.translateY,
          preview.rotation,
        ];
        const timeline = frames.slice(1).map((frame) =>
          Animated.parallel(
            keys.map((value, index) =>
              Animated.timing(value, {
                toValue: index === 3 || index === 4 ? frame[index] * 1.04 : frame[index],
                duration: frameDuration,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ),
          ),
        );
        animationLoop = Animated.loop(Animated.sequence(timeline));
        animationLoop.start();
      })
      .catch((error) => {
        console.warn("[UnifiedAnimationModal] Rust preview generation failed:", error);
      });

    return () => {
      cancelled = true;
      animationLoop?.stop();
    };
  }, [visible, activePreset, activeCategory, duration, preview]);

  const handlePresetSelect = (item: AnimationPresetItem) => {
    const next: ClipAnimationConfig = { ...animation };
    const preset = item.id === "none" ? undefined : item.id;

    if (activeCategory === "in") {
      next.inPreset = preset;
      next.inDuration = preset ? duration : undefined;
    } else if (activeCategory === "out") {
      next.outPreset = preset;
      next.outDuration = preset ? duration : undefined;
    } else {
      next.loopPreset = preset;
      next.comboPreset = preset;
    }

    const hasAnimation = Boolean(next.inPreset || next.outPreset || next.loopPreset);
    if (hasAnimation) {
      next.preset = next.inPreset || next.outPreset || next.loopPreset;
      next.type = next.inPreset ? "in" : next.outPreset ? "out" : "loop";
      next.duration = next.inPreset
        ? next.inDuration
        : next.outPreset
          ? next.outDuration
          : duration;
      updateClipAnimation(props, next);
    } else {
      updateClipAnimation(props, undefined);
    }
  };

  const handleDurationChange = (value: number) => {
    setDuration(value);
    const next: ClipAnimationConfig = {
      ...animation,
      duration: value,
    };
    if (activeCategory === "in") next.inDuration = value;
    if (activeCategory === "out") next.outDuration = value;
    updateClipAnimation(props, next);
  };

  const handleClear = () => {
    updateClipAnimation(props, undefined);
  };

  if (!visible) return null;

  return (
    <View style={[styles.container, isInline && styles.inlineContainer]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="play-circle-outline" size={18} color="#00F2FE" />
          <Text style={styles.title}>Clip Animation</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(["in", "out", "loop"] as const).map((category) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={category}
            onPress={() => {
              setActiveCategory(category);
              const nextDuration = category === "in"
                ? animation.inDuration || animation.duration
                : category === "out"
                  ? animation.outDuration || animation.duration
                  : animation.duration;
              if (nextDuration) {
                setDuration(Math.min(maxDuration, Math.max(0.1, nextDuration)));
              }
            }}
            style={[styles.tab, activeCategory === category && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeCategory === category && styles.activeTabText]}>
              {category === "in" ? "IN" : category === "out" ? "OUT" : "LOOP"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.presetGrid}>
        {presets.map((item) => {
          const selected = activePreset === item.id;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={item.id}
              onPress={() => handlePresetSelect(item)}
              style={[styles.preset, selected && styles.selectedPreset]}
            >
              <Ionicons name={item.icon} size={24} color={selected ? "#00F2FE" : "#c8d0da"} />
              <Text numberOfLines={2} style={styles.presetLabel}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.durationRow}>
        <Text style={styles.durationLabel}>Duration · {duration.toFixed(1)}s</Text>
        <CompactSliderInput
          min={0.1}
          max={maxDuration}
          step={0.1}
          value={duration}
          onChange={handleDurationChange}
        />
      </View>

      <TouchableOpacity accessibilityRole="button" onPress={handleClear} style={styles.clearButton}>
        <Text style={styles.clearText}>Clear animation</Text>
      </TouchableOpacity>

      <View style={styles.preview}>
        <Animated.Image
          source={{ uri: PRESET_PREVIEW_IMAGE }}
          style={[
            styles.previewImage,
            {
              opacity: preview.opacity,
              transform: [
                { translateX: preview.translateX },
                { translateY: preview.translateY },
                {
                  rotate: preview.rotation.interpolate({
                    inputRange: [-360, 360],
                    outputRange: ["-360deg", "360deg"],
                  }),
                },
                { scaleX: preview.scaleX },
                { scaleY: preview.scaleY },
              ],
            },
          ]}
          resizeMode="cover"
        />
        <Text style={styles.previewCaption}>Preview</Text>
      </View>
    </View>
  );
}

export default function UnifiedAnimationModal(props: AnimationModalProps) {
  return <AnimationModal {...props} isInline={props.isInline ?? true} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#11151c",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  inlineContainer: {
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    padding: 6,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#39424e",
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#00F2FE",
  },
  tabText: {
    color: "#8b96a5",
    fontSize: 12,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fff",
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  preset: {
    width: "31.5%",
    minHeight: 84,
    marginBottom: 10,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e2631",
    borderWidth: 1,
    borderColor: "#2b3542",
    borderRadius: 10,
  },
  selectedPreset: {
    borderColor: "#00F2FE",
    backgroundColor: "#123037",
  },
  presetLabel: {
    marginTop: 6,
    color: "#e3e8ef",
    fontSize: 11,
    textAlign: "center",
  },
  durationRow: {
    marginTop: 4,
  },
  durationLabel: {
    marginBottom: 6,
    color: "#c8d0da",
    fontSize: 12,
  },
  clearButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  clearText: {
    color: "#aab5c3",
    fontSize: 12,
  },
  preview: {
    alignItems: "center",
    marginTop: 8,
  },
  previewImage: {
    width: 104,
    height: 104,
    borderRadius: 12,
  },
  previewCaption: {
    color: "#8b96a5",
    fontSize: 11,
    marginTop: 5,
  },
});
