import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionTrackConfig } from '../../types/project';
import { soundEngine } from '../../utils/audioEngine';

interface MotionTrackingModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  targetType: 'text' | 'sticker' | 'video';
  currentTrack?: MotionTrackConfig;
  onApplyTracking: (config: MotionTrackConfig) => void;
  isInline?: boolean;
}

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export default function MotionTrackingModal({
  visible,
  onClose,
  onApply,
  targetType = 'text',
  currentTrack,
  onApplyTracking,
  isInline = false,
}: MotionTrackingModalProps) {
  const [enabled, setEnabled] = useState<boolean>(currentTrack?.enabled || false);
  const [mode, setMode] = useState<MotionTrackConfig['mode']>(
    currentTrack?.mode || 'follow_center'
  );
  const [intensity, setIntensity] = useState<number>(currentTrack?.intensity ?? 60);

  useEffect(() => {
    if (visible) {
      setEnabled(currentTrack?.enabled || false);
      setMode(currentTrack?.mode || 'follow_center');
      setIntensity(currentTrack?.intensity ?? 60);
    }
  }, [visible, currentTrack]);

  const triggerUpdate = (overrides?: {
    enabled?: boolean;
    mode?: MotionTrackConfig['mode'];
    intensity?: number;
  }) => {
    const nextEnabled = overrides?.enabled !== undefined ? overrides.enabled : enabled;
    const nextMode = overrides?.mode !== undefined ? overrides.mode : mode;
    const nextIntensity = overrides?.intensity !== undefined ? overrides.intensity : intensity;

    onApplyTracking({
      enabled: nextEnabled,
      mode: nextMode,
      intensity: nextIntensity,
    });
  };

  const trackingModes: {
    id: MotionTrackConfig['mode'];
    title: string;
    description: string;
    icon: string;
  }[] = [
    {
      id: 'follow_center',
      title: 'Follow Subject (Center)',
      description: 'Locks to primary subject with smooth damping',
      icon: 'locate-outline',
    },
    {
      id: 'cinematic_drift',
      title: 'Cinematic Drift',
      description: 'Organic horizontal/diagonal parallax drift',
      icon: 'trending-up-outline',
    },
    {
      id: 'dynamic_zoom',
      title: 'Dynamic Zoom Track',
      description: 'Scales and shifts dynamically with camera motion',
      icon: 'scan-outline',
    },
  ];

  const handleReset = () => {
    soundEngine.playSfx('click');
    setEnabled(false);
    triggerUpdate({
      enabled: false,
      mode: 'follow_center',
      intensity: 60,
    });
  };

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    triggerUpdate({ enabled: true, mode, intensity });
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.sheetHeader}>
          <View style={styles.titleRow}>
            <Ionicons name="scan" size={16} color="#00F2FE" />
            <Text style={styles.sheetTitle}>Motion Tracking</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, { paddingHorizontal: 10, height: 26, flexDirection: 'row', alignItems: 'center' }]}
              activeOpacity={0.7}
              accessibilityLabel="Reset tracking"
            >
              <Ionicons name="refresh-outline" size={12} color="#00F2FE" style={{ marginRight: 3 }} />
              <Text style={[styles.resetText, { fontSize: 11 }]}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

          <ScrollView style={[styles.sheetBody, isInline && { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
            {/* Mode Cards */}
            <Text style={styles.sectionHeader}>TRACKING MODES</Text>
            <View style={styles.modesContainer}>
              {trackingModes.map((m) => {
                const isSelected = mode === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.modeCard, isSelected && styles.modeCardActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setMode(m.id);
                      setEnabled(true);
                      triggerUpdate({ mode: m.id, enabled: true });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                      <Ionicons
                        name={m.icon as any}
                        size={16}
                        color={isSelected ? '#00F2FE' : '#94A3B8'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modeTitle, isSelected && styles.modeTitleActive]}>
                        {m.title}
                      </Text>
                      <Text style={styles.modeDesc}>{m.description}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={16} color="#00F2FE" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Intensity Slider */}
            <View style={styles.sliderSection}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Smoothing Intensity</Text>
                <Text style={styles.sliderVal}>{intensity}%</Text>
              </View>

              {Platform.OS === 'web' ? (
                <View style={{ marginVertical: 4 }}>
                  <WebInput
                    type="range"
                    min="10"
                    max="100"
                    value={intensity}
                    onChange={(e: any) => {
                      const val = parseInt(e.target.value) || 60;
                      setIntensity(val);
                      triggerUpdate({ intensity: val });
                    }}
                    style={{
                      width: '100%',
                      accentColor: '#00F2FE',
                      height: 4,
                      cursor: 'pointer',
                    }}
                  />
                </View>
              ) : (
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => {
                      const val = Math.max(10, intensity - 10);
                      setIntensity(val);
                      triggerUpdate({ intensity: val });
                    }}
                  >
                    <Ionicons name="remove" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.stepperVal}>{intensity}%</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => {
                      const val = Math.min(100, intensity + 10);
                      setIntensity(val);
                      triggerUpdate({ intensity: val });
                    }}
                  >
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
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
    width: '100%',
    height: '100%',
    backgroundColor: '#0F131D',
  },
  inlineSheetContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 0,
    paddingBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2637',
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  resetText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  doneBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#131826',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2637',
    marginBottom: 8,
  },
  toggleTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toggleSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  switchTrack: {
    width: 38,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#08090E',
    borderWidth: 1,
    borderColor: '#1F2637',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#08090E',
  },
  sectionHeader: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  modesContainer: {
    gap: 5,
    marginBottom: 8,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#131826',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  modeCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#08090E',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  modeTitle: {
    color: '#E2E8F0',
    fontSize: 11.5,
    fontWeight: '600',
  },
  modeTitleActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modeDesc: {
    color: '#94A3B8',
    fontSize: 9.5,
    marginTop: 1,
  },
  sliderSection: {
    backgroundColor: '#131826',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1F2637',
    marginBottom: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sliderLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  sliderVal: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 2,
  },
  stepBtn: {
    backgroundColor: '#08090E',
    borderWidth: 1,
    borderColor: '#1F2637',
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
});
