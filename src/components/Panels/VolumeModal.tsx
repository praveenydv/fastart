import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";

interface VolumeModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentVolume?: number;
  currentFadeIn?: number;
  currentFadeOut?: number;
  currentDenoise?: boolean;
  isFromVideo?: boolean;
  hasAudio?: boolean;
  onApplyVolume: (
    volume: number,
    fadeIn: number,
    fadeOut: number,
    denoise?: boolean,
  ) => void;
  onExtractAudio?: () => void;
  isInline?: boolean;
}

const WebDiv: any = Platform.OS === "web" ? "div" : View;
const WebInput: any = Platform.OS === "web" ? "input" : View;

export default function VolumeModal({
  visible,
  onClose,
  onApply,
  currentVolume = 1.0,
  currentFadeIn = 0,
  currentFadeOut = 0,
  currentDenoise = false,
  isFromVideo = false,
  hasAudio = true,
  onApplyVolume,
  isInline = false,
}: VolumeModalProps) {
  const [volume, setVolume] = useState(currentVolume);
  const [fadeIn, setFadeIn] = useState(currentFadeIn);
  const [fadeOut, setFadeOut] = useState(currentFadeOut);
  const [denoise, setDenoise] = useState(currentDenoise);

  // Sync when opened
  React.useEffect(() => {
    if (visible) {
      setVolume(currentVolume);
      setFadeIn(currentFadeIn);
      setFadeOut(currentFadeOut);
      setDenoise(currentDenoise);
    }
  }, [visible, currentVolume, currentFadeIn, currentFadeOut, currentDenoise]);

  const volumePresets = [
    { label: "Mute", val: 0.0, icon: "volume-mute" },
    { label: "50%", val: 0.5, icon: "volume-low" },
    { label: "100%", val: 1.0, icon: "volume-medium" },
    { label: "150%", val: 1.5, icon: "volume-high" },
    { label: "200%", val: 2.0, icon: "megaphone" },
  ];

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(2.0, parseFloat(newVol.toFixed(2))));
    setVolume(clamped);
    onApplyVolume(clamped, fadeIn, fadeOut, denoise);
  };

  const handleFadeInChange = (newFade: number) => {
    const clamped = Math.max(0, Math.min(5.0, parseFloat(newFade.toFixed(1))));
    setFadeIn(clamped);
    onApplyVolume(volume, clamped, fadeOut, denoise);
  };

  const handleFadeOutChange = (newFade: number) => {
    const clamped = Math.max(0, Math.min(5.0, parseFloat(newFade.toFixed(1))));
    setFadeOut(clamped);
    onApplyVolume(volume, fadeIn, clamped, denoise);
  };

  const handleToggleDenoise = () => {
    const next = !denoise;
    setDenoise(next);
    soundEngine.playSfx(next ? "pop" : "click");
    onApplyVolume(volume, fadeIn, fadeOut, next);
  };

  const handleReset = () => {
    soundEngine.playSfx("click");
    setVolume(1.0);
    setFadeIn(0);
    setFadeOut(0);
    setDenoise(false);
    onApplyVolume(1.0, 0, 0, false);
  };

  const sheetContent = (
    <View
      style={[styles.sheetContainer, styles.inlineSheetContainer]}
    >
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.titleIconBox}>
              <Ionicons name="volume-high" size={15} color="#FFFFFF" />
            </View>
            <Text style={styles.headerTitle}>Volume & Fade</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, { paddingHorizontal: 10, height: 26, flexDirection: 'row', alignItems: 'center' }]}
              activeOpacity={0.7}
              accessibilityLabel="Reset volume to 100%"
            >
              <Ionicons name="refresh-outline" size={12} color="#00F2FE" style={{ marginRight: 4 }} />
              <Text style={[styles.resetBtnText, { fontSize: 11 }]}>100%</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.doneBtnCircle}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={[styles.contentScroll, isInline && { paddingTop: 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {isFromVideo && !hasAudio && (
          <View style={styles.noAudioBanner}>
            <View style={styles.noAudioIconBox}>
              <Ionicons name="volume-mute" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noAudioTitle}>No Audio Track Detected</Text>
              <Text style={styles.noAudioSubtitle}>
                This video contains no audio stream or was recorded without
                sound. Adjusting volume or fades will not produce audible
                playback.
              </Text>
            </View>
          </View>
        )}

        {/* Main Volume Level */}
        <View style={styles.compactSection}>
          <View style={styles.sectionHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={styles.sectionTitle}>Volume Level</Text>
              {isFromVideo && !hasAudio && (
                <View style={styles.silentBadge}>
                  <Text style={styles.silentBadgeText}>Silent Video</Text>
                </View>
              )}
            </View>
            <Text style={styles.valueBadge}>{Math.round(volume * 100)}%</Text>
          </View>

          {/* Slider for Web / Mobile */}
          {Platform.OS === "web" ? (
            <WebDiv style={{ margin: "10px 0 8px" }}>
              <WebInput
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={volume}
                onChange={(e: any) =>
                  handleVolumeChange(parseFloat(e.target.value))
                }
                style={{
                  width: "100%",
                  accentColor: "#FFFFFF",
                  height: 6,
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              />
            </WebDiv>
          ) : (
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleVolumeChange(volume - 0.1)}
              >
                <Ionicons name="remove" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.stepperVal}>{Math.round(volume * 100)}%</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleVolumeChange(volume + 0.1)}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Preset Buttons */}
          <View style={styles.presetsGrid}>
            {volumePresets.map((p) => {
              const isSelected = Math.abs(volume - p.val) < 0.05;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[
                    styles.presetCard,
                    isSelected && styles.presetCardActive,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("pop");
                    handleVolumeChange(p.val);
                  }}
                >
                  <Ionicons
                    name={p.icon as any}
                    size={14}
                    color={isSelected ? "#000000" : "#8E95A5"}
                  />
                  <Text
                    style={[
                      styles.presetCardText,
                      isSelected && styles.presetCardTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Fade In & Fade Out Controls */}
        <View style={styles.compactSection}>
          <Text style={styles.sectionTitle}>Fades</Text>

          {/* Fade In */}
          <View style={styles.fadeRow}>
            <View style={styles.fadeLabelBox}>
              <Ionicons name="trending-up" size={15} color="#10B981" />
              <Text style={styles.fadeLabel}>Fade In</Text>
            </View>
            <Text style={styles.fadeValText}>{fadeIn.toFixed(1)}s</Text>
            {Platform.OS === "web" ? (
              <WebDiv style={{ flex: 1, margin: "0 10px" }}>
                <WebInput
                  type="range"
                  min="0"
                  max="5"
                  step="0.2"
                  value={fadeIn}
                  onChange={(e: any) =>
                    handleFadeInChange(parseFloat(e.target.value))
                  }
                  style={{
                    width: "100%",
                    accentColor: "#10B981",
                    height: 5,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                />
              </WebDiv>
            ) : (
              <View style={styles.fadeStepperRow}>
                <TouchableOpacity
                  style={styles.stepBtnSmall}
                  onPress={() => handleFadeInChange(fadeIn - 0.2)}
                >
                  <Ionicons name="remove" size={13} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtnSmall}
                  onPress={() => handleFadeInChange(fadeIn + 0.2)}
                >
                  <Ionicons name="add" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Fade Out */}
          <View style={styles.fadeRow}>
            <View style={styles.fadeLabelBox}>
              <Ionicons name="trending-down" size={15} color="#F59E0B" />
              <Text style={styles.fadeLabel}>Fade Out</Text>
            </View>
            <Text style={styles.fadeValText}>{fadeOut.toFixed(1)}s</Text>
            {Platform.OS === "web" ? (
              <WebDiv style={{ flex: 1, margin: "0 10px" }}>
                <WebInput
                  type="range"
                  min="0"
                  max="5"
                  step="0.2"
                  value={fadeOut}
                  onChange={(e: any) =>
                    handleFadeOutChange(parseFloat(e.target.value))
                  }
                  style={{
                    width: "100%",
                    accentColor: "#F59E0B",
                    height: 5,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                />
              </WebDiv>
            ) : (
              <View style={styles.fadeStepperRow}>
                <TouchableOpacity
                  style={styles.stepBtnSmall}
                  onPress={() => handleFadeOutChange(fadeOut - 0.2)}
                >
                  <Ionicons name="remove" size={13} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtnSmall}
                  onPress={() => handleFadeOutChange(fadeOut + 0.2)}
                >
                  <Ionicons name="add" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* AI Audio Denoise Card */}
          <TouchableOpacity
            style={[styles.denoiseCard, denoise && styles.denoiseCardActive]}
            onPress={handleToggleDenoise}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Toggle AI Audio Denoise"
          >
            <View style={styles.denoiseLeft}>
              <View
                style={[
                  styles.denoiseIconBox,
                  denoise && styles.denoiseIconBoxActive,
                ]}
              >
                <Ionicons
                  name={denoise ? "ear" : "ear-outline"}
                  size={18}
                  color={denoise ? "#FFFFFF" : "#71717A"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text
                    style={[
                      styles.denoiseTitle,
                      denoise && styles.denoiseTitleActive,
                    ]}
                  >
                    AI Audio Denoise
                  </Text>
                  <View
                    style={[
                      styles.denoiseBadge,
                      denoise && styles.denoiseBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.denoiseBadgeText,
                        denoise && styles.denoiseBadgeTextActive,
                      ]}
                    >
                      {denoise ? "ACTIVE" : "OFF"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.denoiseSubtitle}>
                  Attenuates background hiss, hum & room noise
                </Text>
              </View>
            </View>
            <View
              style={[styles.toggleTrack, denoise && styles.toggleTrackActive]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  denoise && styles.toggleThumbActive,
                ]}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#121215",
  },
  inlineSheetContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    maxHeight: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0F131D",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: Platform.OS === "web" ? "72%" : "80%",
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: "#2C364D",
    borderRadius: 1.5,
    alignSelf: "center",
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2637",
    backgroundColor: "#131826",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleIconBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#131826",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  resetBtnText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "600",
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  doneBtnCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  contentScroll: {
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  compactSection: {
    backgroundColor: "#131826",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  valueBadge: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: "#0F131D",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginVertical: 4,
  },
  stepperVal: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 44,
    textAlign: "center",
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F131D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  stepBtnSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#0F131D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  presetsGrid: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },
  presetCard: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "#131826",
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1F2637",
  },
  presetCardActive: {
    backgroundColor: "#1F2637",
    borderColor: "#00F2FE",
  },
  presetCardText: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "600",
  },
  presetCardTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  fadeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  fadeLabelBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 80,
  },
  fadeLabel: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "500",
  },
  fadeValText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    minWidth: 34,
    textAlign: "right",
  },
  fadeStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noAudioBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.28)",
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  noAudioIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  noAudioTitle: {
    color: "#F59E0B",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  noAudioSubtitle: {
    color: "#D1D5DB",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "400",
  },
  silentBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  silentBadgeText: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "700",
  },
  denoiseCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181C",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#27272F",
    marginTop: 14,
  },
  denoiseCardActive: {
    backgroundColor: "#202026",
    borderColor: "#FFFFFF",
  },
  denoiseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  denoiseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#18181C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272F",
  },
  denoiseIconBoxActive: {
    backgroundColor: "#202026",
    borderColor: "#FFFFFF",
  },
  denoiseTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  denoiseTitleActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  denoiseSubtitle: {
    color: "#71717A",
    fontSize: 11,
    marginTop: 2,
  },
  denoiseBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "#202026",
    borderWidth: 1,
    borderColor: "#27272F",
  },
  denoiseBadgeActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  denoiseBadgeText: {
    color: "#71717A",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  denoiseBadgeTextActive: {
    color: "#000000",
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#27272F",
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: "#FFFFFF",
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#71717A",
  },
  toggleThumbActive: {
    backgroundColor: "#000000",
    alignSelf: "flex-end",
  },
});
