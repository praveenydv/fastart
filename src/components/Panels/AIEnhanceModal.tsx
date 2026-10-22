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
import { soundEngine } from '../../utils/audioEngine';

interface AIEnhanceModalProps {
  visible: boolean;
  onClose: () => void;
  initialValues?: {
    hdr?: boolean;
    sharpness?: number;
    colorBoost?: number;
    skinSmoothing?: number;
    faceRadiance?: number;
  };
  onApplyEnhance: (preset: {
    hdr?: boolean;
    sharpness?: number;
    colorBoost?: number;
    skinSmoothing?: number;
    faceRadiance?: number;
    filterLut?: string;
  }) => void;
}

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export default function AIEnhanceModal({
  visible,
  onClose,
  initialValues,
  onApplyEnhance,
}: AIEnhanceModalProps) {
  const [activeTab, setActiveTab] = useState<'beauty' | 'clarity'>('beauty');

  // Values (0 - 100)
  const [skinSmoothing, setSkinSmoothing] = useState(initialValues?.skinSmoothing ?? 0);
  const [faceRadiance, setFaceRadiance] = useState(initialValues?.faceRadiance ?? 0);
  const [hdr, setHdr] = useState(initialValues?.hdr ?? false);
  const [sharpness, setSharpness] = useState(initialValues?.sharpness ?? 0);
  const [colorBoost, setColorBoost] = useState(initialValues?.colorBoost ?? 0);

  // Sync if initialValues changes
  useEffect(() => {
    if (initialValues) {
      setSkinSmoothing(initialValues.skinSmoothing ?? 0);
      setFaceRadiance(initialValues.faceRadiance ?? 0);
      setHdr(initialValues.hdr ?? false);
      setSharpness(initialValues.sharpness ?? 0);
      setColorBoost(initialValues.colorBoost ?? 0);
    }
  }, [initialValues]);

  // Live trigger
  const triggerUpdate = (updates: Partial<{
    hdr: boolean;
    sharpness: number;
    colorBoost: number;
    skinSmoothing: number;
    faceRadiance: number;
  }>) => {
    const nextHdr = updates.hdr !== undefined ? updates.hdr : hdr;
    const nextSharp = updates.sharpness !== undefined ? updates.sharpness : sharpness;
    const nextBoost = updates.colorBoost !== undefined ? updates.colorBoost : colorBoost;
    const nextSmooth = updates.skinSmoothing !== undefined ? updates.skinSmoothing : skinSmoothing;
    const nextRad = updates.faceRadiance !== undefined ? updates.faceRadiance : faceRadiance;

    onApplyEnhance({
      hdr: nextHdr,
      sharpness: nextSharp,
      colorBoost: nextBoost,
      skinSmoothing: nextSmooth,
      faceRadiance: nextRad,
    });
  };

  const handleReset = () => {
    soundEngine.playSfx('pop');
    setSkinSmoothing(0);
    setFaceRadiance(0);
    setHdr(false);
    setSharpness(0);
    setColorBoost(0);
    onApplyEnhance({
      hdr: false,
      sharpness: 0,
      colorBoost: 0,
      skinSmoothing: 0,
      faceRadiance: 0,
    });
  };

  const isModified = skinSmoothing > 0 || faceRadiance > 0 || hdr || sharpness > 0 || colorBoost > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Compact Space-Optimized Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, !isModified && { opacity: 0.4 }]}
              disabled={!isModified}
              activeOpacity={0.7}
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <Ionicons name="sparkles" size={17} color="#D946EF" />
              <Text style={styles.headerTitle}>AI Enhance</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.doneBtn} activeOpacity={0.7}>
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Tabs: Beauty vs Clarity */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'beauty' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('beauty');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-outline"
                size={15}
                color={activeTab === 'beauty' ? '#D946EF' : '#8E95A5'}
              />
              <Text
                style={[styles.tabText, activeTab === 'beauty' && { color: '#D946EF', fontWeight: '700' }]}
              >
                Face Beauty
              </Text>
              {(skinSmoothing > 0 || faceRadiance > 0) && <View style={styles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'clarity' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('clarity');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="color-wand-outline"
                size={15}
                color={activeTab === 'clarity' ? '#00F2FE' : '#8E95A5'}
              />
              <Text
                style={[styles.tabText, activeTab === 'clarity' && { color: '#00F2FE', fontWeight: '700' }]}
              >
                Clarity & HDR
              </Text>
              {(hdr || sharpness > 0 || colorBoost > 0) && <View style={styles.activeDotCyan} />}
            </TouchableOpacity>
          </View>

          {/* Controls Body */}
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {activeTab === 'beauty' && (
              <View style={styles.controlsGroup}>
                {/* Skin Smoothing */}
                <View style={styles.sliderCard}>
                  <View style={styles.labelRow}>
                    <View style={styles.rowLeft}>
                      <Ionicons name="happy-outline" size={16} color="#D946EF" />
                      <Text style={styles.sliderLabel}>Skin Smoothing</Text>
                    </View>
                    <Text style={[styles.badge, { color: '#D946EF' }]}>{skinSmoothing}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0 2px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max="100"
                        value={skinSmoothing}
                        onChange={(e: any) => {
                          const val = parseInt(e.target.value) || 0;
                          setSkinSmoothing(val);
                          triggerUpdate({ skinSmoothing: val });
                        }}
                        style={{
                          width: '100%',
                          accentColor: '#D946EF',
                          height: 4,
                          cursor: 'pointer',
                        }}
                      />
                    </WebDiv>
                  ) : (
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.max(0, skinSmoothing - 10);
                          setSkinSmoothing(val);
                          triggerUpdate({ skinSmoothing: val });
                        }}
                      >
                        <Ionicons name="remove" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{skinSmoothing}%</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.min(100, skinSmoothing + 10);
                          setSkinSmoothing(val);
                          triggerUpdate({ skinSmoothing: val });
                        }}
                      >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Face Radiance */}
                <View style={styles.sliderCard}>
                  <View style={styles.labelRow}>
                    <View style={styles.rowLeft}>
                      <Ionicons name="sunny-outline" size={16} color="#FBBF24" />
                      <Text style={styles.sliderLabel}>Face Radiance & Glow</Text>
                    </View>
                    <Text style={[styles.badge, { color: '#FBBF24' }]}>{faceRadiance}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0 2px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max="100"
                        value={faceRadiance}
                        onChange={(e: any) => {
                          const val = parseInt(e.target.value) || 0;
                          setFaceRadiance(val);
                          triggerUpdate({ faceRadiance: val });
                        }}
                        style={{
                          width: '100%',
                          accentColor: '#FBBF24',
                          height: 4,
                          cursor: 'pointer',
                        }}
                      />
                    </WebDiv>
                  ) : (
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.max(0, faceRadiance - 10);
                          setFaceRadiance(val);
                          triggerUpdate({ faceRadiance: val });
                        }}
                      >
                        <Ionicons name="remove" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{faceRadiance}%</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.min(100, faceRadiance + 10);
                          setFaceRadiance(val);
                          triggerUpdate({ faceRadiance: val });
                        }}
                      >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {activeTab === 'clarity' && (
              <View style={styles.controlsGroup}>
                {/* Auto HDR Toggle */}
                <TouchableOpacity
                  style={styles.toggleCard}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    const next = !hdr;
                    setHdr(next);
                    triggerUpdate({ hdr: next });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.toggleInfo}>
                    <Ionicons name="sparkles" size={16} color="#00F2FE" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.toggleTitle}>Auto HDR Dynamic Range</Text>
                      <Text style={styles.toggleSub}>Expand highlights and shadow recovery</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={hdr ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={hdr ? '#00F2FE' : '#8E95A5'}
                  />
                </TouchableOpacity>

                {/* Sharpness */}
                <View style={styles.sliderCard}>
                  <View style={styles.labelRow}>
                    <View style={styles.rowLeft}>
                      <Ionicons name="eye-outline" size={16} color="#38BDF8" />
                      <Text style={styles.sliderLabel}>Crisp Sharpness</Text>
                    </View>
                    <Text style={[styles.badge, { color: '#38BDF8' }]}>{sharpness}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0 2px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max="100"
                        value={sharpness}
                        onChange={(e: any) => {
                          const val = parseInt(e.target.value) || 0;
                          setSharpness(val);
                          triggerUpdate({ sharpness: val });
                        }}
                        style={{
                          width: '100%',
                          accentColor: '#38BDF8',
                          height: 4,
                          cursor: 'pointer',
                        }}
                      />
                    </WebDiv>
                  ) : (
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.max(0, sharpness - 10);
                          setSharpness(val);
                          triggerUpdate({ sharpness: val });
                        }}
                      >
                        <Ionicons name="remove" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{sharpness}%</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.min(100, sharpness + 10);
                          setSharpness(val);
                          triggerUpdate({ sharpness: val });
                        }}
                      >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Color Saturation / Vibrance */}
                <View style={styles.sliderCard}>
                  <View style={styles.labelRow}>
                    <View style={styles.rowLeft}>
                      <Ionicons name="color-palette-outline" size={16} color="#10B981" />
                      <Text style={styles.sliderLabel}>Color Saturation</Text>
                    </View>
                    <Text style={[styles.badge, { color: '#10B981' }]}>{colorBoost}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0 2px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max="100"
                        value={colorBoost}
                        onChange={(e: any) => {
                          const val = parseInt(e.target.value) || 0;
                          setColorBoost(val);
                          triggerUpdate({ colorBoost: val });
                        }}
                        style={{
                          width: '100%',
                          accentColor: '#10B981',
                          height: 4,
                          cursor: 'pointer',
                        }}
                      />
                    </WebDiv>
                  ) : (
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.max(0, colorBoost - 10);
                          setColorBoost(val);
                          triggerUpdate({ colorBoost: val });
                        }}
                      >
                        <Ionicons name="remove" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{colorBoost}%</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.min(100, colorBoost + 10);
                          setColorBoost(val);
                          triggerUpdate({ colorBoost: val });
                        }}
                      >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121620',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '48%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
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
    borderBottomColor: '#1A1F2C',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1A1F2C',
  },
  resetText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#161B26',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: '#202636',
  },
  tabText: {
    fontSize: 13,
    color: '#8E95A5',
    fontWeight: '500',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D946EF',
    position: 'absolute',
    top: 6,
    right: 12,
  },
  activeDotCyan: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00F2FE',
    position: 'absolute',
    top: 6,
    right: 12,
  },
  contentScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  controlsGroup: {
    gap: 8,
    paddingBottom: 10,
  },
  sliderCard: {
    backgroundColor: '#161B26',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sliderLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161B26',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleSub: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 6,
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
