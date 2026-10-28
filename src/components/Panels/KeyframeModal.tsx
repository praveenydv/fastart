import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { ClipTransform, KeyframePoint } from "../../types/project";
import {
  cleanAndSortKeyframes,
  findKeyframeAtTime,
  getInterpolatedTransform,
} from "../../utils/keyframeEngine";
import { styles } from "./Keyframe/KeyframeModalStyles";
import KeyframeNoClipView from "./Keyframe/KeyframeNoClipView";
import KeyframePropertyControls from "./Keyframe/KeyframePropertyControls";
import KeyframePointsList from "./Keyframe/KeyframePointsList";

export interface KeyframeModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  selectedClip: any | null;
  selectedClipType?: string;
  currentTime: number;
  onSeek?: (time: number) => void;
  onAddKeyframe: () => void;
  hasKeyframeAtCurrentTime: boolean;
  onUpdateKeyframeTransform?: (
    time: number,
    transform: Partial<ClipTransform>,
    opacity?: number,
    easing?: any,
  ) => void;
  onDeleteKeyframeAtTime?: (time: number) => void;
  onClearAllKeyframes?: () => void;
  isInline?: boolean;
}

export default function KeyframeModal({
  visible,
  onClose,
  onApply,
  selectedClip,
  selectedClipType = "video",
  currentTime,
  onSeek,
  onAddKeyframe,
  hasKeyframeAtCurrentTime,
  onUpdateKeyframeTransform,
  onDeleteKeyframeAtTime,
  onClearAllKeyframes,
  isInline = false,
}: KeyframeModalProps) {
  useEffect(() => {
    if (visible) {
      soundEngine.playSfx("click");
    }
  }, [visible]);

  if (!visible) return null;

  const clipStart = selectedClip?.startTime ?? 0;
  const localTime = Math.max(0, currentTime - clipStart);

  const rawKeyframes: KeyframePoint[] = selectedClip?.keyframes || [];
  const keyframes = cleanAndSortKeyframes(rawKeyframes);

  const currentKeyframe = findKeyframeAtTime(keyframes, localTime, 0.12);

  const interpolatedT = getInterpolatedTransform(
    selectedClip,
    currentTime,
    selectedClipType,
  );

  const activeTransform: ClipTransform = currentKeyframe?.transform || {
    scale: interpolatedT?.scale ?? 1.0,
    rotation: interpolatedT?.rotation ?? 0,
    x: interpolatedT?.x ?? 0,
    y: interpolatedT?.y ?? 0,
  };
  const activeScale = activeTransform?.scale ?? 1.0;
  const activeRotation = activeTransform?.rotation ?? 0;
  const activeX = Math.round(activeTransform?.x ?? 0);
  const activeY = Math.round(activeTransform?.y ?? 0);
  const activeOpacity =
    currentKeyframe?.opacity !== undefined
      ? currentKeyframe.opacity
      : (selectedClip?.opacity ?? 1.0);

  const prevKeyframe = [...keyframes]
    .reverse()
    .find((k) => k.time < localTime - 0.12);
  const nextKeyframe = keyframes.find((k) => k.time > localTime + 0.12);

  const handleJumpToKeyframe = (time: number) => {
    soundEngine.playSfx("pop");
    if (onSeek) {
      onSeek(clipStart + time);
    }
  };

  const formatSec = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min < 10 ? "0" : ""}${min}:${sec < 10 ? "0" : ""}${sec.toFixed(2)}`;
  };

  const sheetContent = (
    <View style={[styles.modalCard, { flex: 1, maxHeight: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderWidth: 0 } as any]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.diamondBadge}>
              <Ionicons name="diamond" size={13} color="#00F2FE" />
            </View>
            <Text style={styles.headerTitle}>Keyframe Animation</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {keyframes.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onClearAllKeyframes?.();
                }}
                style={[styles.closeBtn, { width: 'auto', paddingHorizontal: 8, height: 24, backgroundColor: 'rgba(239, 68, 68, 0.12)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                activeOpacity={0.7}
                accessibilityLabel="Clear all keyframes"
              >
                <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}>Clear All</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                soundEngine.playSfx("click");
                onClose();
              }}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

          {/* Body Content */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {!selectedClip ? (
              <KeyframeNoClipView onClose={onClose} />
            ) : (
              <View style={styles.activeStudio}>
                {/* Playhead HUD Strip */}
                <View style={styles.playheadHUD}>
                  <View style={styles.hudInfo}>
                    <Text style={styles.hudLabel}>PLAYHEAD TIME</Text>
                    <Text style={styles.hudTime}>{formatSec(currentTime)}</Text>
                    <Text style={styles.hudRelative}>
                      Clip offset: +{localTime.toFixed(2)}s
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.stampKeyframeBtn,
                      hasKeyframeAtCurrentTime
                        ? styles.removeKeyframeBtn
                        : styles.addKeyframeBtn,
                    ]}
                    onPress={onAddKeyframe}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={
                        hasKeyframeAtCurrentTime
                          ? "remove-circle"
                          : "add-circle"
                      }
                      size={18}
                      color={hasKeyframeAtCurrentTime ? "#EF4444" : "#00F2FE"}
                    />
                    <Text
                      style={[
                        styles.stampKeyframeText,
                        hasKeyframeAtCurrentTime && { color: "#EF4444" },
                      ]}
                    >
                      {hasKeyframeAtCurrentTime
                        ? "Remove"
                        : "Stamp Keyframe"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Keyframe Step Navigator */}
                <View style={styles.navigatorRow}>
                  <TouchableOpacity
                    style={[
                      styles.navBtn,
                      !prevKeyframe && styles.navBtnDisabled,
                    ]}
                    disabled={!prevKeyframe}
                    onPress={() =>
                      prevKeyframe && handleJumpToKeyframe(prevKeyframe.time)
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="play-skip-back"
                      size={13}
                      color={prevKeyframe ? "#00F2FE" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.navBtnText,
                        !prevKeyframe && { color: "#64748B" },
                      ]}
                    >
                      Prev
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.navStatusPill}>
                    <Ionicons
                      name="diamond"
                      size={11}
                      color={hasKeyframeAtCurrentTime ? "#00F2FE" : "#64748B"}
                    />
                    <Text style={styles.navStatusText}>
                      {hasKeyframeAtCurrentTime
                        ? `On Keyframe`
                        : `${keyframes.length} Keyframe${keyframes.length === 1 ? "" : "s"}`}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.navBtn,
                      !nextKeyframe && styles.navBtnDisabled,
                    ]}
                    disabled={!nextKeyframe}
                    onPress={() =>
                      nextKeyframe && handleJumpToKeyframe(nextKeyframe.time)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.navBtnText,
                        !nextKeyframe && { color: "#64748B" },
                      ]}
                    >
                      Next
                    </Text>
                    <Ionicons
                      name="play-skip-forward"
                      size={13}
                      color={nextKeyframe ? "#00F2FE" : "#64748B"}
                    />
                  </TouchableOpacity>
                </View>

                {/* Property Adjuster Card */}
                <KeyframePropertyControls
                  hasKeyframeAtCurrentTime={hasKeyframeAtCurrentTime}
                  activeScale={activeScale}
                  activeRotation={activeRotation}
                  activeX={activeX}
                  activeY={activeY}
                  activeOpacity={activeOpacity}
                  activeEasing={currentKeyframe?.easing || "easeInOut"}
                  activeTransform={activeTransform}
                  localTime={localTime}
                  onUpdateKeyframeTransform={onUpdateKeyframeTransform}
                />

                {/* Stamped Keyframes List */}
                <KeyframePointsList
                  keyframes={keyframes}
                  localTime={localTime}
                  clipStart={clipStart}
                  formatSec={formatSec}
                  onJumpToKeyframe={handleJumpToKeyframe}
                  onDeleteKeyframeAtTime={onDeleteKeyframeAtTime}
                  onClearAllKeyframes={onClearAllKeyframes}
                />
              </View>
            )}
          </ScrollView>
        </View>
  );

  if (!visible) return null;
  return (
    <View style={{ flex: 1, width: "100%", height: "100%", backgroundColor: "#0F131D" }}>
      {sheetContent}
    </View>
  );
}
