import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { KeyframePoint } from "../../../types/project";
import { styles } from "./KeyframeModalStyles";

interface KeyframePointsListProps {
  keyframes: KeyframePoint[];
  localTime: number;
  clipStart: number;
  formatSec: (s: number) => string;
  onJumpToKeyframe: (time: number) => void;
  onDeleteKeyframeAtTime?: (time: number) => void;
  onClearAllKeyframes?: () => void;
}

export default function KeyframePointsList({
  keyframes,
  localTime,
  clipStart,
  formatSec,
  onJumpToKeyframe,
  onDeleteKeyframeAtTime,
  onClearAllKeyframes,
}: KeyframePointsListProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  if (keyframes.length === 0) return null;

  return (
    <View style={styles.keyframesListCard}>
      <Text style={styles.sectionHeader}>
        STAMPED KEYFRAME POINTS ({keyframes.length})
      </Text>

      {keyframes.map((kf, idx) => {
        const isCurrent = Math.abs(kf.time - localTime) < 0.12;
        const kfScale = kf.transform?.scale ?? 1;
        const kfRot = kf.transform?.rotation ?? 0;
        const kfOp = kf.opacity !== undefined ? kf.opacity : 1.0;

        return (
          <View
            key={idx}
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
                  size={13}
                  color={isCurrent ? "#000000" : "#FFE600"}
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
                  <Ionicons name="trash-outline" size={15} color="#FF0050" />
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
              <Text style={styles.confirmClearText}>Remove all keyframes?</Text>
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
              <Ionicons name="trash-bin-outline" size={15} color="#8E95A5" />
              <Text style={styles.clearAllBtnText}>
                Clear All Keyframes on Clip
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
