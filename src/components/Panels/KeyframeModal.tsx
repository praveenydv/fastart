import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { ClipTransform, KeyframePoint } from "../../types/project";

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

const WebDiv: any = Platform.OS === "web" ? "div" : View;
const WebInput: any = Platform.OS === "web" ? "input" : View;

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
  const [confirmClear, setConfirmClear] = useState(false);

  React.useEffect(() => {
    if (visible) {
      soundEngine.playSfx("click");
      setConfirmClear(false);
    }
  }, [visible]);

  if (!visible) return null;

  const clipStart = selectedClip?.startTime ?? 0;
  const clipDuration = selectedClip?.duration ?? 5;
  const localTime = Math.max(0, currentTime - clipStart);

  const rawKeyframes: KeyframePoint[] = selectedClip?.keyframes || [];
  const keyframes = [...rawKeyframes].sort((a, b) => a.time - b.time);

  // Find exact or closest keyframe at playhead
  const currentKeyframe = keyframes.find(
    (k) => Math.abs(k.time - localTime) < 0.12,
  );

  // Active transform & opacity values
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

  // Navigation: find previous and next keyframes
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

  const handleUpdateProperty = (
    key: "scale" | "rotation" | "x" | "y" | "opacity",
    value: number,
  ) => {
    soundEngine.playSfx("click");
    if (onUpdateKeyframeTransform) {
      if (key === "opacity") {
        onUpdateKeyframeTransform(localTime, activeTransform, value);
      } else {
        onUpdateKeyframeTransform(
          localTime,
          { ...activeTransform, [key]: value },
          activeOpacity,
        );
      }
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
            {/* NO CLIP SELECTED VIEW */}
            {!selectedClip ? (
              <View style={styles.noClipContainer}>
                <View style={styles.noClipIconBox}>
                  <Ionicons name="diamond-outline" size={56} color="#FFE600" />
                </View>
                <Text style={styles.noClipTitle}>No Clip Selected</Text>
                <Text style={styles.noClipDesc}>
                  Select any video, photo, text, or sticker on your timeline to
                  animate its position, scale, rotation, and opacity smoothly
                  across time.
                </Text>

                {/* Tutorial Step Cards */}
                <View style={styles.stepsList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>Select a Timeline Clip</Text>
                      <Text style={styles.stepText}>
                        Tap a video, text, or sticker clip to activate it.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>Position the Playhead</Text>
                      <Text style={styles.stepText}>
                        Scrub to the exact second where movement begins.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>Drop Keyframes & Move</Text>
                      <Text style={styles.stepText}>
                        Tap the Diamond ⟐ button to save positions. FastArt
                        interpolates smoothly between diamonds!
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.gotItBtn}
                  onPress={() => {
                    soundEngine.playSfx("pop");
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.gotItBtnText}>Select Clip on Timeline</Text>
                  <Ionicons name="arrow-forward" size={16} color="#000000" />
                </TouchableOpacity>
              </View>
            ) : (
              /* ACTIVE CLIP KEYFRAME STUDIO */
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

                  {/* Primary Add/Remove Toggle Button */}
                  <TouchableOpacity
                    style={[
                      styles.stampKeyframeBtn,
                      hasKeyframeAtCurrentTime
                        ? styles.removeKeyframeBtn
                        : styles.addKeyframeBtn,
                    ]}
                    onPress={() => {
                      onAddKeyframe();
                    }}
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
                <View style={styles.propertySection}>
                  <Text style={styles.sectionHeader}>
                    {hasKeyframeAtCurrentTime
                      ? "KEYFRAME PROPERTIES (AT DIAMOND)"
                      : "CLIP PROPERTIES (ADD KEYFRAME TO SAVE)"}
                  </Text>

                  {/* 1. SCALE */}
                  <View style={styles.propertyRow}>
                    <View style={styles.propLabelRow}>
                      <View style={styles.propLabelLeft}>
                        <Ionicons name="expand" size={15} color="#00F2FE" />
                        <Text style={styles.propName}>Scale / Zoom</Text>
                      </View>
                      <Text style={styles.propValue}>
                        {activeScale.toFixed(2)}x
                      </Text>
                    </View>

                    {Platform.OS === "web" ? (
                      <WebDiv style={{ margin: "6px 0 10px" }}>
                        <WebInput
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.05"
                          value={activeScale}
                          onChange={(e: any) =>
                            handleUpdateProperty(
                              "scale",
                              parseFloat(e.target.value),
                            )
                          }
                          style={{
                            width: "100%",
                            accentColor: "#00F2FE",
                            height: 6,
                            cursor: "pointer",
                          }}
                        />
                      </WebDiv>
                    ) : (
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() =>
                            handleUpdateProperty(
                              "scale",
                              Math.max(
                                0.2,
                                parseFloat((activeScale - 0.1).toFixed(2)),
                              ),
                            )
                          }
                        >
                          <Ionicons name="remove" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.stepperText}>
                          {activeScale.toFixed(2)}x
                        </Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() =>
                            handleUpdateProperty(
                              "scale",
                              Math.min(
                                3.0,
                                parseFloat((activeScale + 0.1).toFixed(2)),
                              ),
                            )
                          }
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Scale Presets */}
                    <View style={styles.presetRow}>
                      {[0.5, 1.0, 1.5, 2.0].map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.presetChip,
                            Math.abs(activeScale - s) < 0.05 &&
                              styles.presetChipActive,
                          ]}
                          onPress={() => handleUpdateProperty("scale", s)}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              Math.abs(activeScale - s) < 0.05 &&
                                styles.presetChipTextActive,
                            ]}
                          >
                            {s}x
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 2. ROTATION */}
                  <View style={styles.propertyRow}>
                    <View style={styles.propLabelRow}>
                      <View style={styles.propLabelLeft}>
                        <Ionicons name="refresh" size={15} color="#38BDF8" />
                        <Text style={styles.propName}>Rotation</Text>
                      </View>
                      <Text style={styles.propValue}>{activeRotation}°</Text>
                    </View>

                    {Platform.OS === "web" ? (
                      <WebDiv style={{ margin: "6px 0 10px" }}>
                        <WebInput
                          type="range"
                          min="-180"
                          max="180"
                          step="5"
                          value={activeRotation}
                          onChange={(e: any) =>
                            handleUpdateProperty(
                              "rotation",
                              parseInt(e.target.value, 10),
                            )
                          }
                          style={{
                            width: "100%",
                            accentColor: "#38BDF8",
                            height: 6,
                            cursor: "pointer",
                          }}
                        />
                      </WebDiv>
                    ) : (
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() =>
                            handleUpdateProperty(
                              "rotation",
                              Math.max(-180, activeRotation - 15),
                            )
                          }
                        >
                          <Ionicons name="remove" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.stepperText}>{activeRotation}°</Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() =>
                            handleUpdateProperty(
                              "rotation",
                              Math.min(180, activeRotation + 15),
                            )
                          }
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Rotation Presets */}
                    <View style={styles.presetRow}>
                      {[-90, 0, 90, 180].map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.presetChip,
                            activeRotation === r && styles.presetChipActive,
                          ]}
                          onPress={() => handleUpdateProperty("rotation", r)}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              activeRotation === r &&
                                styles.presetChipTextActive,
                            ]}
                          >
                            {r}°
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 3. POSITION NUDGE (X & Y) */}
                  <View style={styles.propertyRow}>
                    <View style={styles.propLabelRow}>
                      <View style={styles.propLabelLeft}>
                        <Ionicons
                          name="move-outline"
                          size={15}
                          color="#F59E0B"
                        />
                        <Text style={styles.propName}>Position Offset</Text>
                      </View>
                      <Text style={styles.propValue}>
                        X: {activeX}px • Y: {activeY}px
                      </Text>
                    </View>

                    <View style={styles.nudgePad}>
                      <TouchableOpacity
                        style={styles.nudgeBtn}
                        onPress={() =>
                          handleUpdateProperty("y", activeY - 15)
                        }
                      >
                        <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                      </TouchableOpacity>

                      <View style={styles.nudgeMiddleRow}>
                        <TouchableOpacity
                          style={styles.nudgeBtn}
                          onPress={() =>
                            handleUpdateProperty("x", activeX - 15)
                          }
                        >
                          <Ionicons
                            name="arrow-back"
                            size={16}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.nudgeCenterBtn}
                          onPress={() => {
                            soundEngine.playSfx("pop");
                            if (onUpdateKeyframeTransform) {
                              onUpdateKeyframeTransform(
                                localTime,
                                { ...activeTransform, x: 0, y: 0 },
                                activeOpacity,
                              );
                            }
                          }}
                        >
                          <Text style={styles.nudgeCenterText}>Center</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.nudgeBtn}
                          onPress={() =>
                            handleUpdateProperty("x", activeX + 15)
                          }
                        >
                          <Ionicons
                            name="arrow-forward"
                            size={16}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.nudgeBtn}
                        onPress={() =>
                          handleUpdateProperty("y", activeY + 15)
                        }
                      >
                        <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 4. OPACITY */}
                  <View style={styles.propertyRow}>
                    <View style={styles.propLabelRow}>
                      <View style={styles.propLabelLeft}>
                        <Ionicons
                          name="contrast-outline"
                          size={15}
                          color="#10B981"
                        />
                        <Text style={styles.propName}>Opacity</Text>
                      </View>
                      <Text style={styles.propValue}>
                        {Math.round(activeOpacity * 100)}%
                      </Text>
                    </View>

                    {Platform.OS === "web" ? (
                      <WebDiv style={{ margin: "6px 0 10px" }}>
                        <WebInput
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={activeOpacity}
                          onChange={(e: any) =>
                            handleUpdateProperty(
                              "opacity",
                              parseFloat(e.target.value),
                            )
                          }
                          style={{
                            width: "100%",
                            accentColor: "#10B981",
                            height: 6,
                            cursor: "pointer",
                          }}
                        />
                      </WebDiv>
                    ) : (
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() =>
                            handleUpdateProperty(
                              "opacity",
                              Math.max(
                                0,
                                parseFloat((activeOpacity - 0.1).toFixed(2)),
                              ),
                            )
                          }
                        >
                          <Ionicons name="remove" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.stepperText}>
                          {Math.round(activeOpacity * 100)}%
                        </Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() =>
                            handleUpdateProperty(
                              "opacity",
                              Math.min(
                                1.0,
                                parseFloat((activeOpacity + 0.1).toFixed(2)),
                              ),
                            )
                          }
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Opacity Presets */}
                    <View style={styles.presetRow}>
                      {[0.25, 0.5, 0.75, 1.0].map((op) => (
                        <TouchableOpacity
                          key={op}
                          style={[
                            styles.presetChip,
                            Math.abs(activeOpacity - op) < 0.05 &&
                              styles.presetChipActive,
                          ]}
                          onPress={() => handleUpdateProperty("opacity", op)}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              Math.abs(activeOpacity - op) < 0.05 &&
                                styles.presetChipTextActive,
                            ]}
                          >
                            {Math.round(op * 100)}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Stamped Keyframes List */}
                {keyframes.length > 0 && (
                  <View style={styles.keyframesListCard}>
                    <Text style={styles.sectionHeader}>
                      STAMPED KEYFRAME POINTS ({keyframes.length})
                    </Text>

                    {keyframes.map((kf, idx) => {
                      const isCurrent =
                        Math.abs(kf.time - localTime) < 0.12;
                      const kfScale = kf.transform?.scale ?? 1;
                      const kfRot = kf.transform?.rotation ?? 0;
                      const kfOp =
                        kf.opacity !== undefined ? kf.opacity : 1.0;

                      return (
                        <View
                          key={idx}
                          style={[
                            styles.keyframeItem,
                            isCurrent && styles.keyframeItemActive,
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.keyframeItemLeft}
                            onPress={() => handleJumpToKeyframe(kf.time)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.kfDiamondBadge,
                                isCurrent && styles.kfDiamondBadgeActive,
                              ]}
                            >
                              <Ionicons
                                name="diamond"
                                size={13}
                                color={isCurrent ? "#000000" : "#FFE600"}
                              />
                            </View>
                            <View>
                              <Text style={styles.keyframeItemTime}>
                                {formatSec(clipStart + kf.time)} (+
                                {kf.time.toFixed(2)}s)
                              </Text>
                              <Text style={styles.keyframeItemDetails}>
                                {kfScale.toFixed(1)}x • {kfRot}° •{" "}
                                {Math.round(kfOp * 100)}% op
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <View style={styles.keyframeItemActions}>
                            <TouchableOpacity
                              style={styles.kfJumpBtn}
                              onPress={() => handleJumpToKeyframe(kf.time)}
                            >
                              <Text style={styles.kfJumpBtnText}>
                                {isCurrent ? "Active" : "Jump"}
                              </Text>
                            </TouchableOpacity>

                            {onDeleteKeyframeAtTime && (
                              <TouchableOpacity
                                style={styles.kfDeleteBtn}
                                onPress={() => {
                                  soundEngine.playSfx("pop");
                                  onDeleteKeyframeAtTime(kf.time);
                                }}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={15}
                                  color="#FF0050"
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {/* Clear All Keyframes Button */}
                    {onClearAllKeyframes && (
                      <View style={styles.clearAllContainer}>
                        {confirmClear ? (
                          <View style={styles.confirmClearRow}>
                            <Text style={styles.confirmClearText}>
                              Remove all keyframes?
                            </Text>
                            <TouchableOpacity
                              style={styles.confirmClearYesBtn}
                              onPress={() => {
                                soundEngine.playSfx("pop");
                                onClearAllKeyframes();
                                setConfirmClear(false);
                              }}
                            >
                              <Text style={styles.confirmClearYesText}>
                                Yes, Clear All
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.confirmClearCancelBtn}
                              onPress={() => setConfirmClear(false)}
                            >
                              <Text style={styles.confirmClearCancelText}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.clearAllBtn}
                            onPress={() => setConfirmClear(true)}
                          >
                            <Ionicons
                              name="trash-bin-outline"
                              size={15}
                              color="#8E95A5"
                            />
                            <Text style={styles.clearAllBtnText}>
                              Clear All Keyframes on Clip
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer Bar */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                soundEngine.playSfx("pop");
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>Done / Apply Animation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 7, 14, 0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0D111A",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "#1E2738",
    maxHeight: "88%",
    minHeight: 460,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#171F2E",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  diamondBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255, 230, 0, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 230, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#161D2B",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 30,
  },

  // No Clip View
  noClipContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noClipIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 230, 0, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 230, 0, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  noClipTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  noClipDesc: {
    color: "#8E95A5",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  stepsList: {
    width: "100%",
    backgroundColor: "#111624",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2738",
    marginBottom: 24,
    gap: 16,
  },
  stepItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 230, 0, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 230, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: {
    color: "#FFE600",
    fontSize: 12,
    fontWeight: "800",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  stepText: {
    color: "#8E95A5",
    fontSize: 11,
    lineHeight: 16,
  },
  gotItBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    backgroundColor: "#FFE600",
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#FFE600",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  gotItBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
  },

  // Active Studio
  activeStudio: {
    gap: 16,
  },
  playheadHUD: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111622",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E283A",
  },
  hudInfo: {
    flex: 1,
  },
  hudLabel: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  hudTime: {
    color: "#00F2FE",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  hudRelative: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  stampKeyframeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  addKeyframeBtn: {
    backgroundColor: "rgba(255, 230, 0, 0.12)",
    borderColor: "rgba(255, 230, 0, 0.4)",
  },
  removeKeyframeBtn: {
    backgroundColor: "rgba(255, 0, 80, 0.12)",
    borderColor: "rgba(255, 0, 80, 0.35)",
  },
  stampKeyframeText: {
    color: "#FFE600",
    fontSize: 12,
    fontWeight: "800",
  },

  // Navigator Row
  navigatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0A0D15",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#182030",
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#141A28",
  },
  navBtnDisabled: {
    backgroundColor: "transparent",
    opacity: 0.5,
  },
  navBtnText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  navStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#141A28",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  navStatusText: {
    color: "#C2C9D6",
    fontSize: 11,
    fontWeight: "700",
  },

  // Properties Section
  propertySection: {
    backgroundColor: "#111624",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2738",
    gap: 16,
  },
  sectionHeader: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  propertyRow: {
    gap: 6,
  },
  propLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  propLabelLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  propName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  propValue: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "800",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0A0D15",
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: "#1C2436",
    marginVertical: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1A2234",
    justifyContent: "center",
    alignItems: "center",
  },
  stepperText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  presetRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    flex: 1,
    backgroundColor: "#161D2B",
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#202A3D",
  },
  presetChipActive: {
    backgroundColor: "rgba(0, 242, 254, 0.15)",
    borderColor: "#00F2FE",
  },
  presetChipText: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "600",
  },
  presetChipTextActive: {
    color: "#00F2FE",
    fontWeight: "800",
  },

  // Nudge Pad
  nudgePad: {
    alignItems: "center",
    gap: 4,
    marginVertical: 4,
  },
  nudgeMiddleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nudgeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1A2234",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#243046",
  },
  nudgeCenterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#161D2B",
    borderWidth: 1,
    borderColor: "#253147",
  },
  nudgeCenterText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },

  // Keyframes List Card
  keyframesListCard: {
    backgroundColor: "#111624",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2738",
    gap: 10,
  },
  keyframeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0A0D15",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1A2234",
  },
  keyframeItemActive: {
    borderColor: "#FFE600",
    backgroundColor: "rgba(255, 230, 0, 0.05)",
  },
  keyframeItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  kfDiamondBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(255, 230, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  kfDiamondBadgeActive: {
    backgroundColor: "#FFE600",
  },
  keyframeItemTime: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  keyframeItemDetails: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  keyframeItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kfJumpBtn: {
    backgroundColor: "#161D2B",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  kfJumpBtnText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  kfDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255, 0, 80, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Clear All
  clearAllContainer: {
    marginTop: 6,
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  clearAllBtnText: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "600",
  },
  confirmClearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 0, 80, 0.08)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 0, 80, 0.3)",
  },
  confirmClearText: {
    color: "#FF0050",
    fontSize: 11,
    fontWeight: "700",
  },
  confirmClearYesBtn: {
    backgroundColor: "#FF0050",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  confirmClearYesText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  confirmClearCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  confirmClearCancelText: {
    color: "#8E95A5",
    fontSize: 11,
  },

  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#171F2E",
    backgroundColor: "#0D111A",
  },
  doneBtn: {
    backgroundColor: "#00F2FE",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  doneBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
