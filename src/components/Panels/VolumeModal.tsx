import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { Ionicons } from "@expo/vector-icons";
import { CompactSliderInput } from "../Common/CompactSliderInput";
import { ModalHeader } from "../Common";

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

function VolumeModalComponent({
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
  const [isSliderDragging, setIsSliderDragging] = useState(false);

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
    onApplyVolume(volume, fadeIn, fadeOut, next);
  };

  const handleReset = () => {
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
        <ModalHeader
          title="Volume"
          iconName="volume-high"
          onClose={onClose}
          onReset={handleReset}
          resetText="100%"
        />
      ) : null}

      <ScrollView
        style={[styles.contentScroll, isInline && { paddingTop: 10 }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSliderDragging}
      >
        {isFromVideo && !hasAudio && (
          <View style={styles.noAudioBanner}>
            <Ionicons name="volume-mute" size={13} color="#A1A1AA" style={{ marginRight: 6 }} />
            <Text style={styles.noAudioSubtitle}>
              No audio stream detected.
            </Text>
          </View>
        )}

        {/* Main Volume Level */}
        <View style={styles.compactSection}>
          <View style={styles.sectionHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={styles.sectionTitle}>Volume</Text>
              {isFromVideo && !hasAudio && (
                <View style={styles.silentBadge}>
                  <Text style={styles.silentBadgeText}>Silent</Text>
                </View>
              )}
            </View>
            <Text style={styles.valueBadge}>{Math.round(volume * 100)}%</Text>
          </View>

          {/* Slider for Web / Mobile with Small Text Input */}
          <View style={{ marginVertical: 4 }}>
            <CompactSliderInput
              label="Level"
              value={Math.round(volume * 100)}
              min={0}
              max={200}
              step={1}
              unit="%"
              defaultValue={100}
              accentColor="#FFFFFF"
              showSteppers={true}
              onDragStart={() => setIsSliderDragging(true)}
              onDragEnd={() => setIsSliderDragging(false)}
              onChange={(val) => handleVolumeChange(val / 100)}
            />
          </View>

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
                    handleVolumeChange(p.val);
                  }}
                >
                  <Ionicons
                    name={p.icon as any}
                    size={12}
                    color={isSelected ? "#00F2FE" : "#8A8A8E"}
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
          <View style={{ marginVertical: 4 }}>
            <CompactSliderInput
              label="Fade In"
              icon={<Ionicons name="trending-up" size={12} color="#94A3B8" />}
              value={parseFloat(fadeIn.toFixed(1))}
              min={0}
              max={5}
              step={0.1}
              unit="s"
              decimals={1}
              defaultValue={0}
              accentColor="#FFFFFF"
              showSteppers={true}
              onDragStart={() => setIsSliderDragging(true)}
              onDragEnd={() => setIsSliderDragging(false)}
              onChange={(val) => handleFadeInChange(val)}
            />
          </View>

          {/* Fade Out */}
          <View style={{ marginVertical: 4 }}>
            <CompactSliderInput
              label="Fade Out"
              icon={<Ionicons name="trending-down" size={12} color="#94A3B8" />}
              value={parseFloat(fadeOut.toFixed(1))}
              min={0}
              max={5}
              step={0.1}
              unit="s"
              decimals={1}
              defaultValue={0}
              accentColor="#FFFFFF"
              showSteppers={true}
              onDragStart={() => setIsSliderDragging(true)}
              onDragEnd={() => setIsSliderDragging(false)}
              onChange={(val) => handleFadeOutChange(val)}
            />
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
                  size={14}
                  color={denoise ? "#00F2FE" : "#71717A"}
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
                    Denoise
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
                      {denoise ? "ON" : "OFF"}
                    </Text>
                  </View>
                </View>
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

export const VolumeModal = React.memo(VolumeModalComponent);
export default VolumeModal;

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#121214",
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
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#121214",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: Platform.OS === "web" ? "72%" : "80%",
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "#1F1F23",
  },
  sheetHandle: {
    width: 28,
    height: 2.5,
    backgroundColor: "#2C2C2E",
    borderRadius: 1.5,
    alignSelf: "center",
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F23",
    backgroundColor: "#121214",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  titleIconBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  resetBtnText: {
    color: "#00F2FE",
    fontSize: 9.5,
    fontWeight: "500",
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  doneBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#18181A",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "500",
  },
  contentScroll: {
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  compactSection: {
    backgroundColor: "#18181A",
    borderRadius: 4,
    padding: 5,
    marginBottom: 3,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  sectionTitle: {
    color: "#CBD5E1",
    fontSize: 10,
    fontWeight: "400",
  },
  valueBadge: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "400",
    backgroundColor: "#141416",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginVertical: 2,
  },
  stepperVal: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "500",
    minWidth: 32,
    textAlign: "center",
  },
  stepBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  stepBtnSmall: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  presetsGrid: {
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  presetCard: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "#141416",
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  presetCardActive: {
    backgroundColor: "#141416",
    borderColor: "#00F2FE",
  },
  presetCardText: {
    color: "#8A8A8E",
    fontSize: 8.5,
    fontWeight: "400",
  },
  presetCardTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  fadeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  fadeLabelBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 65,
  },
  fadeLabel: {
    color: "#8E95A5",
    fontSize: 9.5,
    fontWeight: "400",
  },
  fadeValText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "500",
    minWidth: 28,
    textAlign: "right",
  },
  fadeStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  noAudioBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    padding: 6,
    marginBottom: 6,
    gap: 6,
  },
  noAudioIconBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  noAudioTitle: {
    color: "#F59E0B",
    fontSize: 10.5,
    fontWeight: "500",
    marginBottom: 1,
  },
  noAudioSubtitle: {
    color: "#94A3B8",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "400",
  },
  silentBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  silentBadgeText: {
    color: "#F59E0B",
    fontSize: 8.5,
    fontWeight: "500",
  },
  denoiseCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181A",
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272A",
    marginTop: 4,
  },
  denoiseCardActive: {
    backgroundColor: "#18181A",
    borderColor: "#00F2FE",
  },
  denoiseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  denoiseIconBox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: "#141416",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  denoiseIconBoxActive: {
    backgroundColor: "#141416",
    borderColor: "#00F2FE",
  },
  denoiseTitle: {
    color: "#CBD5E1",
    fontSize: 10,
    fontWeight: "400",
  },
  denoiseTitleActive: {
    color: "#00F2FE",
    fontWeight: "600",
  },
  denoiseSubtitle: {
    color: "#71717A",
    fontSize: 8.5,
    marginTop: 1,
  },
  denoiseBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  denoiseBadgeActive: {
    backgroundColor: "#141416",
    borderColor: "#00F2FE",
  },
  denoiseBadgeText: {
    color: "#8E8E93",
    fontSize: 8,
    fontWeight: "400",
    letterSpacing: 0.3,
  },
  denoiseBadgeTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#27272A",
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: "#00F2FE",
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#71717A",
  },
  toggleThumbActive: {
    backgroundColor: "#08090E",
    alignSelf: "flex-end",
  },
});
