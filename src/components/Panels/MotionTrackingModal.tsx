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
    {
      id: 'orbit_float',
      title: 'Orbit / Ambient Float',
      description: 'Continuous smooth rhythmic micro-movement',
      icon: 'radio-outline',
    },
  ];

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    onApplyTracking({
      enabled,
      mode,
      intensity,
    });
    onClose();
  };

  const handleReset = () => {
    soundEngine.playSfx('click');
    setEnabled(false);
    onApplyTracking({
      enabled: false,
      mode: 'follow_center',
      intensity: 60,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              <Ionicons name="scan" size={20} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Motion Tracking</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Toggle Enable */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleTitle}>Enable Tracking</Text>
              <TouchableOpacity
                style={[styles.switchTrack, enabled && styles.switchTrackActive]}
                onPress={() => {
                  soundEngine.playSfx('pop');
                  setEnabled(!enabled);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.switchThumb, enabled && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

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
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modeIconBox}>
                      <Ionicons
                        name={m.icon as any}
                        size={22}
                        color={isSelected ? '#00F2FE' : '#8E95A5'}
                      />
                    </View>
                    <View style={styles.modeMeta}>
                      <Text style={[styles.modeTitle, isSelected && styles.modeTitleActive]}>
                        {m.title}
                      </Text>
                      <Text style={styles.modeDesc}>{m.description}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#00F2FE" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tracking Intensity / Sensitivity */}
            <View style={styles.sliderBox}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Tracking Damping / Sensitivity</Text>
                <Text style={styles.sliderVal}>{intensity}%</Text>
              </View>
              <View style={styles.sliderContainer}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setIntensity(Math.max(10, intensity - 10))}
                >
                  <Ionicons name="remove" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                {Platform.OS === 'web' ? (
                  <WebInput
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={intensity}
                    onChange={(e: any) => setIntensity(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#00F2FE' }}
                  />
                ) : (
                  <View style={styles.trackFallback}>
                    <View style={[styles.fillFallback, { width: `${intensity}%` }]} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setIntensity(Math.min(100, intensity + 10))}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={18} color="#8E95A5" />
              <Text style={styles.resetBtnText}>Disable</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={18} color="#000000" />
              <Text style={styles.applyBtnText}>Apply Tracking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2637',
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2030',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#8E95A5',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1E2333',
  },
  sheetBody: {
    padding: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#191E2C',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252C3F',
    marginBottom: 16,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toggleSub: {
    fontSize: 11,
    color: '#8E95A5',
    marginTop: 2,
  },
  switchTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A334A',
    justifyContent: 'center',
    padding: 3,
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
    fontSize: 11,
    fontWeight: '800',
    color: '#8E95A5',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modesContainer: {
    gap: 10,
    marginBottom: 16,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191E2C',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#252C3F',
  },
  modeCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  modeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141721',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modeMeta: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  modeTitleActive: {
    color: '#00F2FE',
  },
  modeDesc: {
    fontSize: 11,
    color: '#8E95A5',
    marginTop: 2,
  },
  sliderBox: {
    backgroundColor: '#191E2C',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#252C3F',
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  sliderVal: {
    fontSize: 12,
    color: '#00F2FE',
    fontWeight: '700',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#2A334A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackFallback: {
    flex: 1,
    height: 6,
    backgroundColor: '#2A334A',
    borderRadius: 3,
  },
  fillFallback: {
    height: 6,
    backgroundColor: '#00F2FE',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A2030',
    gap: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E2333',
  },
  resetBtnText: {
    fontSize: 13,
    color: '#8E95A5',
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#00F2FE',
  },
  applyBtnText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '700',
  },
});
