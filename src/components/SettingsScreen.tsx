import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastArtLogo from "./FastArtLogo";
import { soundEngine } from "../utils/audioEngine";
import { triggerHaptic } from "../utils/haptics";
import { clearAppCache } from "../utils/storage";
import { theme } from "../constants/theme";

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
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [localSettings, setLocalSettings] = useState(settings || {});
  const [cachedSize, setCachedSize] = useState(
    typeof settings?.cachedSizeMb === "number" ? settings.cachedSizeMb : 142.8,
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
        <View
          style={[
            styles.navBarInner,
            isDesktop ? styles.desktopWrapper : styles.mobileWrapper,
          ]}
        >
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
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Home</Text>
          </TouchableOpacity>

          <View style={styles.navTitleRow}>
            <Text style={styles.navTitle}>Settings</Text>
          </View>

          <View style={{ width: 68 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.contentContainer,
            isDesktop ? styles.desktopWrapper : styles.mobileWrapper,
          ]}
        >
          {/* Studio Profile Banner */}
          <View style={styles.profileBanner}>
            <FastArtLogo size={36} />
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileTitle}>FastArt</Text>
                <View style={styles.versionBadge}>
                  <Text style={styles.versionText}>v1.0</Text>
                </View>
              </View>
              <Text style={styles.profileSubtitle}>
                Mobile & Web Video Editor Studio
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
                    <Ionicons
                      name="videocam-outline"
                      size={14}
                      color="#FFFFFF"
                    />
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
                      size={14}
                      color="#FFFFFF"
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
                  const isSelected = (localSettings.defaultFps || 30) === fps;
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
                    <Ionicons name="crop-outline" size={14} color="#FFFFFF" />
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
            {/* Timeline Snapping */}
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="magnet-outline" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Timeline Snapping</Text>
                  <Text style={styles.toggleSubtitle}>
                    Snap playhead to cuts, transitions & keyframes
                  </Text>
                </View>
              </View>
              <Switch
                value={localSettings.magneticSnapping !== false}
                onValueChange={() => toggleSwitch("magneticSnapping")}
                trackColor={{ false: "#1B2234", true: "#FFFFFF" }}
                thumbColor={localSettings.magneticSnapping !== false ? "#000000" : "#94A3B8"}
              />
            </View>

            <View style={styles.divider} />

            {/* Haptic Feedback */}
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name="finger-print-outline"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Haptic Feedback</Text>
                  <Text style={styles.toggleSubtitle}>
                    Vibrate lightly when cutting, dragging & snapping
                  </Text>
                </View>
              </View>
              <Switch
                value={localSettings.hapticFeedback !== false}
                onValueChange={() => toggleSwitch("hapticFeedback")}
                trackColor={{ false: "#1B2234", true: "#FFFFFF" }}
                thumbColor={localSettings.hapticFeedback !== false ? "#000000" : "#94A3B8"}
              />
            </View>

            <View style={styles.divider} />

            {/* Sound Effects */}
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name="volume-medium-outline"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Sound Effects (SFX)</Text>
                  <Text style={styles.toggleSubtitle}>
                    Acoustic feedback on button taps and edits
                  </Text>
                </View>
              </View>
              <Switch
                value={localSettings.soundEffects === true}
                onValueChange={() => toggleSwitch("soundEffects")}
                trackColor={{ false: "#1B2234", true: "#FFFFFF" }}
                thumbColor={localSettings.soundEffects === true ? "#000000" : "#94A3B8"}
              />
            </View>

            <View style={styles.divider} />

            {/* Auto Add Default Ending */}
            <View style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="film-outline" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Auto Add Outro</Text>
                  <Text style={styles.toggleSubtitle}>
                    Attach FastArt outro card to new projects
                  </Text>
                </View>
              </View>
              <Switch
                value={localSettings.autoAddEnding === true}
                onValueChange={() => toggleSwitch("autoAddEnding")}
                trackColor={{ false: "#1B2234", true: "#FFFFFF" }}
                thumbColor={localSettings.autoAddEnding === true ? "#000000" : "#94A3B8"}
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
                    { backgroundColor: "rgba(239, 68, 68, 0.12)" },
                  ]}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                </View>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Temporary Cache</Text>
                  <Text style={styles.toggleSubtitle}>
                    {cacheCleared
                      ? "Cache cleared (0.0 MB)"
                      : `${cachedSize.toFixed(1)} MB cached previews & thumbnails`}
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
                    cacheCleared && { color: theme.colors.textMuted },
                  ]}
                >
                  {cacheCleared ? "Cleared" : "Clear"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footerText}>
            FastArt Video Studio • Version 1.0.4 (Build 2026.10)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  desktopWrapper: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  mobileWrapper: {
    width: "100%",
    paddingHorizontal: 16,
  },

  // Navbar
  navBar: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: "rgba(8, 9, 14, 0.95)",
    zIndex: 100,
  },
  navBarInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  navTitleRow: {
    alignItems: "center",
  },
  navTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  contentContainer: {
    paddingTop: 16,
  },

  // Profile Banner
  profileBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  versionBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  versionText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  profileSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  accelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  accelText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // Section Headers
  sectionHeader: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Card Groups
  cardGroup: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },

  // Segment Selector
  selectorItem: {
    padding: 16,
  },
  selectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  activeValueText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  segmentedTrack: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  segmentText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#000000",
    fontWeight: "700",
  },

  // Toggle Switch Item
  toggleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  toggleTextGroup: {
    flex: 1,
  },
  toggleTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  toggleSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },

  // Clear Button
  clearBtn: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clearBtnDisabled: {
    opacity: 0.5,
  },
  clearBtnText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },

  footerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 20,
  },
});
