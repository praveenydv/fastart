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
  currentVolume?: number;
  currentFadeIn?: number;
  currentFadeOut?: number;
  onApplyVolume: (volume: number, fadeIn: number, fadeOut: number) => void;
}

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export default function VolumeModal({
  visible,
  onClose,
  currentVolume = 1.0,
  currentFadeIn = 0,
  currentFadeOut = 0,
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

  const handleApply = () => {
    soundEngine.playSfx('click');
    onApplyVolume(volume, fadeIn, fadeOut);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="volume-high" size={20} color="#00F2FE" />
              <Text style={styles.headerTitle}>Volume & Fade</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll}>
            {/* Main Volume Level */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Volume</Text>
                <Text style={styles.valueBadge}>{Math.round(volume * 100)}%</Text>
              </View>

              {/* Slider for Web / Mobile */}
              {Platform.OS === 'web' ? (
                <WebDiv style={{ margin: '14px 0 10px' }}>
                  <WebInput
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={volume}
                    onChange={(e: any) => setVolume(parseFloat(e.target.value))}
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
                    onPress={() => setVolume((v) => Math.max(0, parseFloat((v - 0.1).toFixed(2))))}
                  >
                    <Ionicons name="remove" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.stepperVal}>{Math.round(volume * 100)}%</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setVolume((v) => Math.min(2.0, parseFloat((v + 0.1).toFixed(2))))}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
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
                        setVolume(p.val);
                      }}
                    >
                      <Ionicons
                        name={p.icon as any}
                        size={16}
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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fade In / Out</Text>

              {/* Fade In */}
              <View style={styles.fadeRow}>
                <View style={styles.fadeLabelBox}>
                  <Ionicons name="trending-up" size={16} color="#10B981" />
                  <Text style={styles.fadeLabel}>Fade In</Text>
                </View>
                <Text style={styles.fadeValText}>{fadeIn.toFixed(1)}s</Text>
                {Platform.OS === 'web' ? (
                  <WebDiv style={{ flex: 1, margin: '0 12px' }}>
                    <WebInput
                      type="range"
                      min="0"
                      max="5"
                      step="0.2"
                      value={fadeIn}
                      onChange={(e: any) => setFadeIn(parseFloat(e.target.value))}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setFadeIn((f) => Math.max(0, parseFloat((f - 0.2).toFixed(1))))}
                    >
                      <Ionicons name="remove" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setFadeIn((f) => Math.min(5, parseFloat((f + 0.2).toFixed(1))))}
                    >
                      <Ionicons name="add" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Fade Out */}
              <View style={styles.fadeRow}>
                <View style={styles.fadeLabelBox}>
                  <Ionicons name="trending-down" size={16} color="#F59E0B" />
                  <Text style={styles.fadeLabel}>Fade Out</Text>
                </View>
                <Text style={styles.fadeValText}>{fadeOut.toFixed(1)}s</Text>
                {Platform.OS === 'web' ? (
                  <WebDiv style={{ flex: 1, margin: '0 12px' }}>
                    <WebInput
                      type="range"
                      min="0"
                      max="5"
                      step="0.2"
                      value={fadeOut}
                      onChange={(e: any) => setFadeOut(parseFloat(e.target.value))}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setFadeOut((f) => Math.max(0, parseFloat((f - 0.2).toFixed(1))))}
                    >
                      <Ionicons name="remove" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setFadeOut((f) => Math.min(5, parseFloat((f + 0.2).toFixed(1))))}
                    >
                      <Ionicons name="add" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Apply Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Ionicons name="checkmark" size={18} color="#000000" />
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121620',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  contentScroll: {
    padding: 16,
  },
  section: {
    backgroundColor: '#161B26',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#252B3D',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  valueBadge: {
    backgroundColor: '#00F2FE20',
    color: '#00F2FE',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 12,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#202637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  presetCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2536',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  presetCardActive: {
    backgroundColor: '#00F2FE',
  },
  presetCardText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  presetCardTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  fadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  fadeLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 90,
  },
  fadeLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  fadeValText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  applyBtn: {
    backgroundColor: '#00F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  applyBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
