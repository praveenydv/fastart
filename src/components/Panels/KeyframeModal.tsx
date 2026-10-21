import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { ClipTransform, KeyframePoint } from "../../types/project";
import { styles } from "./Keyframe/KeyframeModalStyles";
import KeyframeNoClipView from "./Keyframe/KeyframeNoClipView";
import KeyframePropertyControls from "./Keyframe/KeyframePropertyControls";
import KeyframePointsList from "./Keyframe/KeyframePointsList";

export interface KeyframeModalProps {
  visible: boolean;
  onClose: () => void;
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
  ) => void;
  onDeleteKeyframeAtTime?: (time: number) => void;
  onClearAllKeyframes?: () => void;
}

export default function KeyframeModal({
  visible,
  onClose,
  selectedClip,
  selectedClipType = "video",
  currentTime,
  onSeek,
  onAddKeyframe,
  hasKeyframeAtCurrentTime,
  onUpdateKeyframeTransform,
  onDeleteKeyframeAtTime,
  onClearAllKeyframes,
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
  const keyframes = [...rawKeyframes].sort((a, b) => a.time - b.time);

  const currentKeyframe = keyframes.find(
    (k) => Math.abs(k.time - localTime) < 0.12,
  );

  const activeTransform: ClipTransform = currentKeyframe?.transform ||
    selectedClip?.transform || {
      scale: 1,
      rotation: 0,
      x: 0,
      y: 0,
    };
  const activeScale = activeTransform.scale ?? 1.0;
  const activeRotation = activeTransform.rotation ?? 0;
  const activeX = Math.round(activeTransform.x ?? 0);
  const activeY = Math.round(activeTransform.y ?? 0);
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.diamondBadge}>
                <Ionicons name="diamond" size={16} color="#FFE600" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Keyframe Animation</Text>
                <Text style={styles.headerSubtitle}>
                  {selectedClip
                    ? `${selectedClip.title || selectedClipType.toUpperCase()} • ${keyframes.length} Keyframe${keyframes.length === 1 ? "" : "s"}`
                    : "Transform & Opacity Motion"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                soundEngine.playSfx("click");
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

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
                      size={20}
                      color={hasKeyframeAtCurrentTime ? "#FF0050" : "#FFE600"}
                    />
                    <Text
                      style={[
                        styles.stampKeyframeText,
                        hasKeyframeAtCurrentTime && { color: "#FF0050" },
                      ]}
                    >
                      {hasKeyframeAtCurrentTime
                        ? "Remove Keyframe"
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
                      size={14}
                      color={prevKeyframe ? "#00F2FE" : "#4A5268"}
                    />
                    <Text
                      style={[
                        styles.navBtnText,
                        !prevKeyframe && { color: "#4A5268" },
                      ]}
                    >
                      Prev Diamond
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.navStatusPill}>
                    <Ionicons
                      name="diamond"
                      size={12}
                      color={hasKeyframeAtCurrentTime ? "#FFE600" : "#8E95A5"}
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
                        !nextKeyframe && { color: "#4A5268" },
                      ]}
                    >
                      Next Diamond
                    </Text>
                    <Ionicons
                      name="play-skip-forward"
                      size={14}
                      color={nextKeyframe ? "#00F2FE" : "#4A5268"}
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

          {/* Footer Bar - only shown when editing an active clip */}
          {selectedClip && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  soundEngine.playSfx("pop");
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
