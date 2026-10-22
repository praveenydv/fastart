import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastArtLogo from "./FastArtLogo";
import { soundEngine } from "../utils/audioEngine";
import { triggerHaptic } from "../utils/haptics";
import { clearAppCache } from "../utils/storage";

interface SettingsScreenProps {
  settings: any;
  onUpdateSettings: (newSettings: any) => void;
  onBack: () => void;
  onReloadData?: () => void;
}

export default function SettingsScreen({
  settings,
  onUpdateSettings,
  onBack,
}: SettingsScreenProps) {
  const [localSettings, setLocalSettings] = useState(settings || {});
  const [cachedSize, setCachedSize] = useState(
    typeof settings?.cachedSizeMb === "number" ? settings.cachedSizeMb : 142.8
  );
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      if (typeof settings.cachedSizeMb === "number") {
        setCachedSize(settings.cachedSizeMb);
      }
    }
  }, [settings]);

  const toggleSwitch = (key: string) => {
    soundEngine.playSfx("click");
    const updatedVal = !localSettings[key];
    const isHapticOn =
      key === "hapticFeedback"
        ? updatedVal
        : localSettings.hapticFeedback !== false;
    triggerHaptic("light", isHapticOn);

    const updated = { ...localSettings, [key]: updatedVal };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const setOption = (key: string, val: any) => {
    soundEngine.playSfx("click");
    triggerHaptic("selection", localSettings.hapticFeedback !== false);
    const updated = { ...localSettings, [key]: val };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const handleClearCache = () => {
    soundEngine.playSfx("pop");
    triggerHaptic("medium", localSettings.hapticFeedback !== false);
    const newSize = clearAppCache();
    setCachedSize(newSize);
    setCacheCleared(true);
    const updated = { ...localSettings, cachedSizeMb: newSize };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const resolutions = ["720p", "1080p", "2K/4K"];
  const frameRates = [24, 30, 60];
  const aspectRatios = ["9:16", "16:9", "1:1"];

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            soundEngine.playSfx("click");
            triggerHaptic("light", localSettings.hapticFeedback !== false);
            onBack();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.navTitle}>Settings</Text>

        <View style={styles.navRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerWrapper}>
          {/* Compact Profile Banner */}
          <View style={styles.profileBanner}>
            <FastArtLogo size={34} />
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileTitle}>FastArt</Text>
                <View style={styles.versionBadge}>
                  <Text style={styles.versionText}>v1.0</Text>
                </View>
              </View>
              <Text style={styles.profileSubtitle}>
                Mobile Video Editor Studio
              </Text>
            </View>
            <View style={styles.accelBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.accelText}>GPU Accel</Text>
            </View>
          </View>

          {/* SECTION 1: EXPORT & CANVAS DEFAULTS */}
          <Text style={styles.sectionHeader}>DEFAULTS & CANVAS</Text>
          <View style={styles.cardGroup}>
            {/* 1. Default Resolution */}
            <View style={styles.selectorItem}>
              <View style={styles.selectorHeader}>
                <View style={styles.itemTitleRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="videocam-outline" size={13} color="#00F2FE" />
                  </View>
                  <Text style={styles.itemTitle}>Default Resolution</Text>
                </View>
                <Text style={styles.activeValueText}>
                  {localSettings.defaultResolution || "1080p"}
                </Text>
              </View>
              <View style={styles.segmentedTrack}>
                {resolutions.map((res) => {
                  const isSelected =
                    (localSettings.defaultResolution || "1080p") === res;
                  return (
                    <TouchableOpacity
                      key={res}
                      style={[
                        styles.segmentBtn,
                        isSelected && styles.segmentBtnActive,
                      ]}
                      onPress={() => setOption("defaultResolution", res)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          isSelected && styles.segmentTextActive,
                        ]}
                      >
                        {res}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

            {/* 2. Default Frame Rate */}
            <View style={styles.selectorItem}>
              <View style={styles.selectorHeader}>
                <View style={styles.itemTitleRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="speedometer-outline"
                      size={13}
                      color="#00F2FE"
                    />
                  </View>
                  <Text style={styles.itemTitle}>Default Frame Rate</Text>
                </View>
                <Text style={styles.activeValueText}>
                  {localSettings.defaultFps || 30} FPS
                </Text>
              </View>
              <View style={styles.segmentedTrack}>
                {frameRates.map((fps) => {
                  const isSelected =
                    (localSettings.defaultFps || 30) === fps;
                  return (
                    <TouchableOpacity
                      key={fps}
                      style={[
                        styles.segmentBtn,
                        isSelected && styles.segmentBtnActive,
                      ]}
                      onPress={() => setOption("defaultFps", fps)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          isSelected && styles.segmentTextActive,
                        ]}
                      >
                        {fps} FPS
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

            {/* 3. Canvas Aspect Ratio */}
            <View style={styles.selectorItem}>
              <View style={styles.selectorHeader}>
                <View style={styles.itemTitleRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="crop-outline" size={13} color="#00F2FE" />
                  </View>
                  <Text style={styles.itemTitle}>Default Aspect Ratio</Text>
                </View>
                <Text style={styles.activeValueText}>
                  {localSettings.defaultAspectRatio || "9:16"}
                </Text>
              </View>
              <View style={styles.segmentedTrack}>
                {aspectRatios.map((ratio) => {
                  const isSelected =
                    (localSettings.defaultAspectRatio || "9:16") === ratio;
                  return (
                    <TouchableOpacity
                      key={ratio}
                      style={[
                        styles.segmentBtn,
                        isSelected && styles.segmentBtnActive,
                      ]}
                      onPress={() => setOption("defaultAspectRatio", ratio)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          isSelected && styles.segmentTextActive,
                        ]}
                      >
                        {ratio}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* SECTION 2: EDITING & TIMELINE PREFERENCES */}
          <Text style={styles.sectionHeader}>EDITING & TIMELINE</Text>
          <View style={styles.cardGroup}>
            {/* Magnetic Snapping */}
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="magnet-outline" size={13} color="#00F2FE" />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Timeline Snapping</Text>
                  <Text style={styles.toggleSubtitle}>
                    Snap playhead to cuts, beats & keyframes
                  </Text>
                </View>
              </View>
              <Switch
                value={localSettings.magneticSnapping !== false}
                onValueChange={() => toggleSwitch("magneticSnapping")}
                trackColor={{ false: "#1E2538", true: "#00F2FE" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Haptic Feedback */}
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="finger-print-outline" size={13} color="#00F2FE" />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Haptic Feedback</Text>
                  <Text style={styles.toggleSubtitle}>
                    Vibrate lightly when cutting & snapping
                  </Text>
                </View>
              </View>
              <Switch
                value={localSettings.hapticFeedback !== false}
                onValueChange={() => toggleSwitch("hapticFeedback")}
                trackColor={{ false: "#1E2538", true: "#00F2FE" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Sound Effects */}
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name="volume-medium-outline"
                    size={13}
                    color="#00F2FE"
                  />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Sound Effects (SFX)</Text>
                  <Text style={styles.toggleSubtitle}>
                    Acoustic feedback on button taps
                  </Text>
                </View>
              </View>
              <Switch
                value={localSettings.soundEffects === true}
                onValueChange={() => toggleSwitch("soundEffects")}
                trackColor={{ false: "#1E2538", true: "#00F2FE" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Auto Add Default Ending */}
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="film-outline" size={13} color="#00F2FE" />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Auto Add Outro</Text>
                  <Text style={styles.toggleSubtitle}>
                    Attach FastArt logo outro to new projects
                  </Text>
                </View>
              </View>
              <Switch
                value={localSettings.autoAddEnding === true}
                onValueChange={() => toggleSwitch("autoAddEnding")}
                trackColor={{ false: "#1E2538", true: "#00F2FE" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* SECTION 3: STORAGE & CACHE */}
          <Text style={styles.sectionHeader}>STORAGE & CACHE</Text>
          <View style={styles.cardGroup}>
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: "rgba(244, 63, 94, 0.12)" },
                  ]}
                >
                  <Ionicons name="trash-outline" size={13} color="#FB7185" />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Temporary Cache</Text>
                  <Text style={styles.toggleSubtitle}>
                    {cacheCleared
                      ? "Cache cleared (0.0 MB)"
                      : `${cachedSize.toFixed(1)} MB cached assets`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.clearBtn,
                  cacheCleared && styles.clearBtnDisabled,
                ]}
                onPress={handleClearCache}
                disabled={cacheCleared}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.clearBtnText,
                    cacheCleared && { color: "#64748B" },
                  ]}
                >
                  {cacheCleared ? "Cleared" : "Clear"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footerText}>FastArt Video Editor • Build 2026.10</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0D13",
  },
  navBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "#0E1118",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  navTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  navRight: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 32,
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 640,
  },
  // Compact Profile Banner
  profileBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131722",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileTitle: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "800",
  },
  versionBadge: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  versionText: {
    color: "#00F2FE",
    fontSize: 9.5,
    fontWeight: "800",
  },
  profileSubtitle: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 1,
  },
  accelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  accelText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
  },
  // Section Headers
  sectionHeader: {
    color: "#64748B",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  // Unified Grouped Card
  cardGroup: {
    backgroundColor: "#131722",
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginLeft: 46,
  },
  // Icon Badge Circle
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Selector Items (Resolution, FPS, Aspect Ratio)
  selectorItem: {
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  selectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemTitle: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "600",
  },
  activeValueText: {
    color: "#00F2FE",
    fontSize: 11.5,
    fontWeight: "700",
  },
  segmentedTrack: {
    flexDirection: "row",
    backgroundColor: "#0B0E15",
    borderRadius: 7,
    padding: 2.5,
    gap: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 5.5,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#00F2FE",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    color: "#64748B",
    fontSize: 11.5,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  // Toggle Items (Switches)
  toggleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  toggleTextGroup: {
    flex: 1,
  },
  toggleTitle: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "600",
  },
  toggleSubtitle: {
    color: "#64748B",
    fontSize: 10.5,
    marginTop: 1.5,
  },
  // Clear Cache Button
  clearBtn: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  clearBtnDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  clearBtnText: {
    color: "#FB7185",
    fontSize: 11.5,
    fontWeight: "700",
  },
  footerText: {
    color: "#475569",
    fontSize: 10.5,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 12,
  },
});
