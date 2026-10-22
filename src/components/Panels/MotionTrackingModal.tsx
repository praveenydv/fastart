import React, { useState, useEffect } from 'react';
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
import { MotionTrackConfig } from '../../types/project';
import { soundEngine } from '../../utils/audioEngine';

interface MotionTrackingModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: 'text' | 'sticker' | 'video';
  currentTrack?: MotionTrackConfig;
  onApplyTracking: (config: MotionTrackConfig) => void;
}

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export default function MotionTrackingModal({
  visible,
  onClose,
  targetType = 'text',
  currentTrack,
  onApplyTracking,
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
    onApplyTracking(
      currentTrack || {
        enabled: false,
        mode: 'follow_center',
      }
    );
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    triggerUpdate({ enabled: true, mode, intensity });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Standardized Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={handleCancel}
                style={[styles.doneBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }]}
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
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.titleRow}>
              <Ionicons name="scan" size={17} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Motion Tracking</Text>
            </View>

            <TouchableOpacity
              onPress={handleApply}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Apply tracking"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
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
                        size={18}
                        color={isSelected ? '#00F2FE' : '#8E95A5'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modeTitle, isSelected && styles.modeTitleActive]}>
                        {m.title}
                      </Text>
                      <Text style={styles.modeDesc}>{m.description}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#00F2FE" />
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
                <View style={{ marginVertical: 6 }}>
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
                    <Ionicons name="remove" size={16} color="#FFFFFF" />
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
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2638',
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2234',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#141A28',
    borderWidth: 1,
    borderColor: '#1E2638',
  },
  resetText: {
    color: '#8E95A5',
    fontSize: 11.5,
    fontWeight: '700',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161B26',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2536',
    marginBottom: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toggleSub: {
    fontSize: 11,
    color: '#8E95A5',
    marginTop: 2,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#262D3D',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#00F2FE',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modesContainer: {
    gap: 6,
    marginBottom: 10,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#161B26',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  modeCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1A2234',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2433',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: '#00F2FE22',
  },
  modeTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  modeTitleActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modeDesc: {
    color: '#8E95A5',
    fontSize: 10,
    marginTop: 1,
  },
  sliderSection: {
    backgroundColor: '#161B26',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E2536',
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sliderLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  sliderVal: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  stepBtn: {
    backgroundColor: '#262D3D',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'center',
  },
});
