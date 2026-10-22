import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';

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
  onApplyVolume: (volume: number, fadeIn: number, fadeOut: number, denoise?: boolean) => void;
  onExtractAudio?: () => void;
}

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : View;

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
}: VolumeModalProps) {
  const [volume, setVolume] = useState(currentVolume);
  const [fadeIn, setFadeIn] = useState(currentFadeIn);
  const [fadeOut, setFadeOut] = useState(currentFadeOut);

  // Sync when opened
  React.useEffect(() => {
    if (visible) {
      setVolume(currentVolume);
      setFadeIn(currentFadeIn);
      setFadeOut(currentFadeOut);
    }
  }, [visible, currentVolume, currentFadeIn, currentFadeOut]);

  const volumePresets = [
    { label: 'Mute', val: 0.0, icon: 'volume-mute' },
    { label: '50%', val: 0.5, icon: 'volume-low' },
    { label: '100%', val: 1.0, icon: 'volume-medium' },
    { label: '150%', val: 1.5, icon: 'volume-high' },
    { label: '200%', val: 2.0, icon: 'megaphone' },
  ];

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(2.0, parseFloat(newVol.toFixed(2))));
    setVolume(clamped);
    onApplyVolume(clamped, fadeIn, fadeOut, currentDenoise);
  };

  const handleFadeInChange = (newFade: number) => {
    const clamped = Math.max(0, Math.min(5.0, parseFloat(newFade.toFixed(1))));
    setFadeIn(clamped);
    onApplyVolume(volume, clamped, fadeOut, currentDenoise);
  };

  const handleFadeOutChange = (newFade: number) => {
    const clamped = Math.max(0, Math.min(5.0, parseFloat(newFade.toFixed(1))));
    setFadeOut(clamped);
    onApplyVolume(volume, fadeIn, clamped, currentDenoise);
  };

  const handleReset = () => {
    soundEngine.playSfx('click');
    setVolume(1.0);
    setFadeIn(0);
    setFadeOut(0);
    onApplyVolume(1.0, 0, 0, currentDenoise);
  };

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    onClose();
  };

  const handleDone = () => {
    soundEngine.playSfx('whoosh');
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Top Handle */}
          <View style={styles.sheetHandle} />

          {/* Standardized Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={handleCancel}
                style={[styles.doneBtnCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                activeOpacity={0.7}
                accessibilityLabel="Cancel changes"
              >
                <Ionicons name="close" size={17} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleReset}
                style={styles.resetBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headerTitleRow}>
              <View style={styles.titleIconBox}>
                <Ionicons name="volume-high" size={15} color="#00F2FE" />
              </View>
              <Text style={styles.headerTitle}>Volume & Fade</Text>
            </View>

            <TouchableOpacity
              onPress={handleDone}
              style={styles.doneBtnCircle}
              activeOpacity={0.7}
              accessibilityLabel="Apply volume"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {isFromVideo && !hasAudio && (
              <View style={styles.noAudioBanner}>
                <View style={styles.noAudioIconBox}>
                  <Ionicons name="volume-mute" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noAudioTitle}>No Audio Track Detected</Text>
                  <Text style={styles.noAudioSubtitle}>
                    This video contains no audio stream or was recorded without sound. Adjusting volume or fades will not produce audible playback.
                  </Text>
                </View>
              </View>
            )}

            {/* Main Volume Level */}
            <View style={styles.compactSection}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
              {Platform.OS === 'web' ? (
                <WebDiv style={{ margin: '10px 0 8px' }}>
                  <WebInput
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={volume}
                    onChange={(e: any) => handleVolumeChange(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: '#00F2FE',
                      height: 6,
                      borderRadius: 3,
                      cursor: 'pointer',
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
                      style={[styles.presetCard, isSelected && styles.presetCardActive]}
                      onPress={() => {
                        soundEngine.playSfx('pop');
                        handleVolumeChange(p.val);
                      }}
                    >
                      <Ionicons
                        name={p.icon as any}
                        size={14}
                        color={isSelected ? '#000000' : '#8E95A5'}
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
                {Platform.OS === 'web' ? (
                  <WebDiv style={{ flex: 1, margin: '0 10px' }}>
                    <WebInput
                      type="range"
                      min="0"
                      max="5"
                      step="0.2"
                      value={fadeIn}
                      onChange={(e: any) => handleFadeInChange(parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        accentColor: '#10B981',
                        height: 5,
                        borderRadius: 3,
                        cursor: 'pointer',
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
                {Platform.OS === 'web' ? (
                  <WebDiv style={{ flex: 1, margin: '0 10px' }}>
                    <WebInput
                      type="range"
                      min="0"
                      max="5"
                      step="0.2"
                      value={fadeOut}
                      onChange={(e: any) => handleFadeOutChange(parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        accentColor: '#F59E0B',
                        height: 5,
                        borderRadius: 3,
                        cursor: 'pointer',
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
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2638',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2234',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#141A28',
    borderWidth: 1,
    borderColor: '#1E2638',
  },
  resetBtnText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#00F2FE',
  },
  doneBtnCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#000000',
    fontSize: 11.5,
    fontWeight: '800',
  },
  contentScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  compactSection: {
    backgroundColor: '#141926',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2638',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  valueBadge: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 6,
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22293A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#22293A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  presetCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#1C2232',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242C3E',
  },
  presetCardActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  presetCardText: {
    color: '#8E95A5',
    fontSize: 10.5,
    fontWeight: '600',
  },
  presetCardTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  fadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  fadeLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  fadeLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  fadeValText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 34,
    textAlign: 'right',
  },
  fadeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noAudioBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  noAudioIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAudioTitle: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  noAudioSubtitle: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '400',
  },
  silentBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  silentBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
  },
});
