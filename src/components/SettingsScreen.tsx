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

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
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
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.navTitle}>Settings</Text>

        <View style={styles.navRight}>
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.innerWrapper}>
          {/* App Profile Card */}
          <View style={styles.profileCard}>
            <FastArtLogo size={52} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={styles.profileTitle}>FastArt</Text>
                <View style={styles.proTag}>
                  <Text style={styles.proTagText}>PRO</Text>
                </View>
              </View>
              <Text style={styles.profileSubtitle}>
                v1.0.0 • Hardware Acceleration Enabled
              </Text>
            </View>
          </View>

          {/* DEFAULT EXPORT SETTINGS */}
          <Text style={styles.sectionHeader}>DEFAULT EXPORT SETTINGS</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Default Resolution</Text>
            <View style={styles.pillGroup}>
              {resolutions.map((res) => (
                <TouchableOpacity
                  key={res}
                  style={[
                    styles.choicePill,
                    localSettings.defaultResolution === res &&
                      styles.choicePillActive,
                  ]}
                  onPress={() => setOption("defaultResolution", res)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      localSettings.defaultResolution === res &&
                        styles.choiceTextActive,
                    ]}
                  >
                    {res}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Default Frame Rate</Text>
            <View style={styles.pillGroup}>
              {frameRates.map((fps) => (
                <TouchableOpacity
                  key={fps}
                  style={[
                    styles.choicePill,
                    localSettings.defaultFps === fps && styles.choicePillActive,
                  ]}
                  onPress={() => setOption("defaultFps", fps)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      localSettings.defaultFps === fps &&
                        styles.choiceTextActive,
                    ]}
                  >
                    {fps} FPS
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Default Aspect Ratio</Text>
            <View style={styles.pillGroup}>
              {aspectRatios.map((ratio) => (
                <TouchableOpacity
                  key={ratio}
                  style={[
                    styles.choicePill,
                    localSettings.defaultAspectRatio === ratio &&
                      styles.choicePillActive,
                  ]}
                  onPress={() => setOption("defaultAspectRatio", ratio)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      localSettings.defaultAspectRatio === ratio &&
                        styles.choiceTextActive,
                    ]}
                  >
                    {ratio}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* EDITING & TIMELINE PREFERENCES */}
          <Text style={styles.sectionHeader}>
            EDITING & TIMELINE PREFERENCES
          </Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.toggleTitle}>Magnetic Timeline Snapping</Text>
              <Text style={styles.toggleSubtitle}>
                Snap playhead to clip cuts, audio beats, and text keyframes
              </Text>
            </View>
            <Switch
              value={localSettings.magneticSnapping !== false}
              onValueChange={() => toggleSwitch("magneticSnapping")}
              trackColor={{ false: "#334155", true: "#00F2FE" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.toggleTitle}>Haptic Feedback on Cuts</Text>
              <Text style={styles.toggleSubtitle}>
                Vibrate when splitting or snapping clips
              </Text>
            </View>
            <Switch
              value={localSettings.hapticFeedback !== false}
              onValueChange={() => toggleSwitch("hapticFeedback")}
              trackColor={{ false: "#334155", true: "#00F2FE" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.toggleTitle}>
                Interface Sound Effects (SFX)
              </Text>
              <Text style={styles.toggleSubtitle}>
                Play smooth, warm acoustic taps and pops
              </Text>
            </View>
            <Switch
              value={localSettings.soundEffects === true}
              onValueChange={() => toggleSwitch("soundEffects")}
              trackColor={{ false: "#334155", true: "#00F2FE" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.toggleRow, { marginBottom: 36 }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.toggleTitle}>Auto Add Default Ending</Text>
              <Text style={styles.toggleSubtitle}>
                Attach FastArt logo outro to new projects
              </Text>
            </View>
            <Switch
              value={localSettings.autoAddEnding === true}
              onValueChange={() => toggleSwitch("autoAddEnding")}
              trackColor={{ false: "#334155", true: "#00F2FE" }}
              thumbColor="#FFFFFF"
            />
          </View>
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
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
    backgroundColor: "#0E1118",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  navTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  navRight: {
    width: 60,
    alignItems: "flex-end",
  },
  proBadge: {
    backgroundColor: "#FFE600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  proText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "900",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    padding: 16,
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 720,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141721",
    padding: 18,
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  profileTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  profileSubtitle: {
    color: "#8E95A5",
    fontSize: 12,
    marginTop: 3,
  },
  proTag: {
    backgroundColor: "#FFE600",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proTagText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "900",
  },
  sectionHeader: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 10,
  },
  settingCard: {
    backgroundColor: "#141721",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  settingLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  pillGroup: {
    flexDirection: "row",
    gap: 8,
  },
  choicePill: {
    flex: 1,
    backgroundColor: "#10131A",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  choicePillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  choiceText: {
    color: "#8E95A5",
    fontSize: 13,
    fontWeight: "700",
  },
  choiceTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#141721",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  toggleTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleSubtitle: {
    color: "#8E95A5",
    fontSize: 11,
    marginTop: 3,
  },
});
