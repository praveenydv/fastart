import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { KeyframePoint, MaskKeyframePoint } from "../../../types/project";
import { styles } from "./KeyframeModalStyles";

interface KeyframePointsListProps {
  keyframes: KeyframePoint[];
  maskKeyframes?: MaskKeyframePoint[];
  localTime: number;
  clipStart: number;
  formatSec: (s: number) => string;
  onJumpToKeyframe: (time: number) => void;
  onDeleteKeyframeAtTime?: (time: number) => void;
  onDeleteMaskKeyframeAtTime?: (time: number) => void;
  onClearAllKeyframes?: () => void;
  onClearAllMaskKeyframes?: () => void;
}

export default function KeyframePointsList({
  keyframes,
  maskKeyframes,
  localTime,
  clipStart,
  formatSec,
  onJumpToKeyframe,
  onDeleteKeyframeAtTime,
  onDeleteMaskKeyframeAtTime,
  onClearAllKeyframes,
  onClearAllMaskKeyframes,
}: KeyframePointsListProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmClearMask, setConfirmClearMask] = useState(false);

  const hasMotionKfs = keyframes && keyframes.length > 0;
  const hasMaskKfs = maskKeyframes && maskKeyframes.length > 0;

  if (!hasMotionKfs && !hasMaskKfs) return null;

  return (
    <View style={styles.keyframesListCard}>
      {/* 1. Motion / Transform Keyframe Points */}
      {hasMotionKfs && (
        <>
          <Text style={styles.sectionHeader}>
            MOTION KEYFRAME POINTS ({keyframes.length})
          </Text>

          {keyframes.map((kf, idx) => {
            const isCurrent = Math.abs(kf.time - localTime) < 0.12;
            const kfScale = kf.transform?.scale ?? 1;
            const kfRot = kf.transform?.rotation ?? 0;
            const kfOp = kf.opacity !== undefined ? kf.opacity : 1.0;

            return (
              <View
                key={`motion-${idx}`}
                style={[styles.keyframeItem, isCurrent && styles.keyframeItemActive]}
              >
                <TouchableOpacity
                  style={styles.keyframeItemLeft}
                  onPress={() => onJumpToKeyframe(kf.time)}
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
                      size={12}
                      color={isCurrent ? "#08090E" : "#00F2FE"}
                    />
                  </View>
                  <View>
                    <Text style={styles.keyframeItemTime}>
                      {formatSec(clipStart + kf.time)} (+{kf.time.toFixed(2)}s)
                    </Text>
                    <Text style={styles.keyframeItemDetails}>
                      {kfScale.toFixed(1)}x • {kfRot}° • {Math.round(kfOp * 100)}% op
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.keyframeItemActions}>
                  <TouchableOpacity
                    style={styles.kfJumpBtn}
                    onPress={() => onJumpToKeyframe(kf.time)}
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
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* Clear All Transform Keyframes Button */}
          {onClearAllKeyframes && (
            <View style={styles.clearAllContainer}>
              {confirmClear ? (
                <View style={styles.confirmClearRow}>
                  <Text style={styles.confirmClearText}>Remove all motion keyframes?</Text>
                  <TouchableOpacity
                    style={styles.confirmClearYesBtn}
                    onPress={() => {
                      soundEngine.playSfx("pop");
                      onClearAllKeyframes();
                      setConfirmClear(false);
                    }}
                  >
                    <Text style={styles.confirmClearYesText}>Yes, Clear All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmClearCancelBtn}
                    onPress={() => setConfirmClear(false)}
                  >
                    <Text style={styles.confirmClearCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={() => setConfirmClear(true)}
                >
                  <Ionicons name="trash-bin-outline" size={13} color="#94A3B8" />
                  <Text style={styles.clearAllBtnText}>
                    Clear Motion Keyframes
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}

      {/* 2. Mask Keyframe Points */}
      {hasMaskKfs && (
        <View style={{ marginTop: hasMotionKfs ? 14 : 0 }}>
          <Text style={[styles.sectionHeader, { color: "#C084FC" }]}>
            MASK KEYFRAME POINTS ({maskKeyframes.length})
          </Text>

          {maskKeyframes.map((mkf, idx) => {
            const isCurrent = Math.abs(mkf.time - localTime) < 0.12;
            const shape = mkf.mask?.shape || "mask";
            const size = Math.round(mkf.mask?.size ?? 60);
            const feather = Math.round(mkf.mask?.feather ?? 0);
            const rot = Math.round(mkf.mask?.rotation ?? 0);
            const posX = Math.round(mkf.mask?.x ?? 0);
            const posY = Math.round(mkf.mask?.y ?? 0);

            return (
              <View
                key={`mask-${idx}`}
                style={[
                  styles.keyframeItem,
                  isCurrent && [styles.keyframeItemActive, { borderColor: "#A855F7" }],
                ]}
              >
                <TouchableOpacity
                  style={styles.keyframeItemLeft}
                  onPress={() => onJumpToKeyframe(mkf.time)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.kfDiamondBadge,
                      { backgroundColor: isCurrent ? "#A855F7" : "rgba(168, 85, 247, 0.15)" },
                      isCurrent && { borderColor: "#C084FC" },
                    ]}
                  >
                    <Ionicons
                      name="diamond"
                      size={12}
                      color={isCurrent ? "#FFFFFF" : "#A855F7"}
                    />
                  </View>
                  <View>
                    <Text style={styles.keyframeItemTime}>
                      {formatSec(clipStart + mkf.time)} (+{mkf.time.toFixed(2)}s)
                    </Text>
                    <Text style={styles.keyframeItemDetails}>
                      {shape.toUpperCase()} • ({posX > 0 ? `+${posX}` : posX}, {posY > 0 ? `+${posY}` : posY}) • {size}% sz • {feather}px ftr • {rot}°
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.keyframeItemActions}>
                  <TouchableOpacity
                    style={[styles.kfJumpBtn, { backgroundColor: isCurrent ? "rgba(168, 85, 247, 0.25)" : "#182030" }]}
                    onPress={() => onJumpToKeyframe(mkf.time)}
                  >
                    <Text style={[styles.kfJumpBtnText, isCurrent && { color: "#C084FC" }]}>
                      {isCurrent ? "Active" : "Jump"}
                    </Text>
                  </TouchableOpacity>

                  {onDeleteMaskKeyframeAtTime && (
                    <TouchableOpacity
                      style={styles.kfDeleteBtn}
                      onPress={() => {
                        soundEngine.playSfx("pop");
                        onDeleteMaskKeyframeAtTime(mkf.time);
                      }}
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* Clear All Mask Keyframes Button */}
          {onClearAllMaskKeyframes && (
            <View style={styles.clearAllContainer}>
              {confirmClearMask ? (
                <View style={styles.confirmClearRow}>
                  <Text style={styles.confirmClearText}>Remove all mask keyframes?</Text>
                  <TouchableOpacity
                    style={styles.confirmClearYesBtn}
                    onPress={() => {
                      soundEngine.playSfx("pop");
                      onClearAllMaskKeyframes();
                      setConfirmClearMask(false);
                    }}
                  >
                    <Text style={styles.confirmClearYesText}>Yes, Clear All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmClearCancelBtn}
                    onPress={() => setConfirmClearMask(false)}
                  >
                    <Text style={styles.confirmClearCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={() => setConfirmClearMask(true)}
                >
                  <Ionicons name="trash-bin-outline" size={13} color="#C084FC" />
                  <Text style={[styles.clearAllBtnText, { color: "#C084FC" }]}>
                    Clear Mask Keyframes
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
