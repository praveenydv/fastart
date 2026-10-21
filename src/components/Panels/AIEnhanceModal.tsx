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

interface AIEnhanceModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyEnhance: (preset: {
    hdr: boolean;
    sharpness: number;
    colorBoost: number;
    denoise: boolean;
    filterLut: string;
  }) => void;
}

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export default function AIEnhanceModal({
  visible,
  onClose,
  onApplyEnhance,
}: AIEnhanceModalProps) {
  const [hdr, setHdr] = useState(true);
  const [sharpness, setSharpness] = useState(75);
  const [colorBoost, setColorBoost] = useState(80);
  const [denoise, setDenoise] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<'hdr_pro' | 'vibrant' | 'cinema' | 'portrait'>('hdr_pro');

  const presets = [
    { id: 'hdr_pro', name: 'HDR Ultra', desc: 'Deep dynamic range and shadow recovery', filter: 'teal_orange' },
    { id: 'vibrant', name: 'Viral Pop', desc: 'High saturation & crisp contrast for TikTok', filter: 'cyberpunk' },
    { id: 'cinema', name: 'Film 35mm', desc: 'Cinematic tone curve & natural skin hues', filter: 'warm_sunset' },
    { id: 'portrait', name: 'Clean Studio', desc: 'Soft skin smoothing with vivid highlights', filter: 'vintage' },
  ];

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    const chosen = presets.find((p) => p.id === selectedPreset) || presets[0];
    onApplyEnhance({
      hdr,
      sharpness,
      colorBoost,
      denoise,
      filterLut: chosen.filter,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="sparkles" size={18} color="#D946EF" />
              <Text style={styles.headerTitle}>AI Enhance</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Presets Grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Style Profiles</Text>
              <View style={styles.presetsGrid}>
                {presets.map((p) => {
                  const isSelected = selectedPreset === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.presetCard, isSelected && styles.presetCardActive]}
                      onPress={() => {
                        soundEngine.playSfx('pop');
                        setSelectedPreset(p.id as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.presetHeader}>
                        <Text style={[styles.presetName, isSelected && styles.presetNameActive]}>
                          {p.name}
                        </Text>
                        <Ionicons
                          name={isSelected ? 'sparkles' : 'sparkles-outline'}
                          size={15}
                          color={isSelected ? '#00F2FE' : '#8E95A5'}
                        />
                      </View>
                      <Text style={styles.presetDesc}>{p.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* AI Sliders */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adjustments</Text>

              {/* Sharpness */}
              <View style={styles.sliderRow}>
                <View style={styles.labelRow}>
                  <Text style={styles.sliderLabel}>Clarity & Sharpness</Text>
                  <Text style={styles.badge}>{sharpness}%</Text>
                </View>
                {Platform.OS === 'web' ? (
                  <WebDiv style={{ margin: '6px 0' }}>
                    <WebInput
                      type="range"
                      min="0"
                      max="100"
                      value={sharpness}
                      onChange={(e: any) => setSharpness(parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        accentColor: '#D946EF',
                        height: 4,
                        borderRadius: 2,
                        cursor: 'pointer',
                      }}
                    />
                  </WebDiv>
                ) : (
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setSharpness((s) => Math.max(0, s - 5))}
                    >
                      <Ionicons name="remove" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.stepperVal}>{sharpness}%</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setSharpness((s) => Math.min(100, s + 5))}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Color Boost */}
              <View style={styles.sliderRow}>
                <View style={styles.labelRow}>
                  <Text style={styles.sliderLabel}>Color Saturation</Text>
                  <Text style={styles.badge}>{colorBoost}%</Text>
                </View>
                {Platform.OS === 'web' ? (
                  <WebDiv style={{ margin: '6px 0' }}>
                    <WebInput
                      type="range"
                      min="0"
                      max="100"
                      value={colorBoost}
                      onChange={(e: any) => setColorBoost(parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        accentColor: '#00F2FE',
                        height: 4,
                        borderRadius: 2,
                        cursor: 'pointer',
                      }}
                    />
                  </WebDiv>
                ) : (
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setColorBoost((c) => Math.max(0, c - 5))}
                    >
                      <Ionicons name="remove" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.stepperVal}>{colorBoost}%</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setColorBoost((c) => Math.min(100, c + 5))}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Toggles */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Intelligent Processing</Text>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => {
                  soundEngine.playSfx('click');
                  setHdr(!hdr);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Auto HDR Tone Mapping</Text>
                  <Text style={styles.toggleDesc}>Expand highlight and shadow detail</Text>
                </View>
                <Ionicons
                  name={hdr ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={hdr ? '#00F2FE' : '#8E95A5'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => {
                  soundEngine.playSfx('click');
                  setDenoise(!denoise);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Low-Light Denoise</Text>
                  <Text style={styles.toggleDesc}>Reduce grain and sensor noise</Text>
                </View>
                <Ionicons
                  name={denoise ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={denoise ? '#00F2FE' : '#8E95A5'}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.enhanceBtn} onPress={handleApply} activeOpacity={0.8}>
              <Ionicons name="sparkles" size={16} color="#000000" />
              <Text style={styles.enhanceBtnText}>Apply</Text>
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1.5,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  presetsGrid: {
    gap: 10,
  },
  presetCard: {
    backgroundColor: '#1F2536',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  presetCardActive: {
    borderColor: '#D946EF',
    backgroundColor: '#D946EF10',
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  presetNameActive: {
    color: '#D946EF',
  },
  presetDesc: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 4,
  },
  sliderRow: {
    marginTop: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#D946EF20',
    color: '#D946EF',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 4,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2536',
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleDesc: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  enhanceBtn: {
    backgroundColor: '#D946EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  enhanceBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
