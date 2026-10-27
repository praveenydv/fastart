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
import { soundEngine } from '../../utils/audioEngine';

interface AIEnhanceModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
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
  isInline?: boolean;
}

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export default function AIEnhanceModal({
  visible,
  onClose,
  onApply,
  initialValues,
  onApplyEnhance,
  isInline = false,
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

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    onClose();
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="sparkles" size={17} color="#00F2FE" />
            <Text style={styles.headerTitle}>AI Enhance</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, !isModified && { opacity: 0.4 }, { paddingHorizontal: 10, height: 26, flexDirection: 'row', alignItems: 'center' }]}
              disabled={!isModified}
              activeOpacity={0.7}
              accessibilityLabel="Reset enhancements"
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
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

          {/* Tabs: Beauty vs Clarity */}
          <View style={[styles.tabContainer, isInline && { marginTop: 8 }]}>
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
                color={activeTab === 'clarity' ? '#FFFFFF' : '#71717A'}
              />
              <Text
                style={[styles.tabText, activeTab === 'clarity' && { color: '#FFFFFF', fontWeight: '700' }]}
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
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.toggleTitle}>Auto HDR Dynamic Range</Text>
                      <Text style={styles.toggleSub}>Expand highlights and shadow recovery</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={hdr ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={hdr ? '#FFFFFF' : '#71717A'}
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
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121215',
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderWidth: 1,
    borderColor: '#27272F',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#27272F',
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
    borderBottomColor: '#27272F',
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
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  resetText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '600',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#18181C',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#27272F',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 6,
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: '#202026',
  },
  tabText: {
    fontSize: 11.5,
    color: '#71717A',
    fontWeight: '600',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 6,
    right: 12,
  },
  activeDotCyan: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#18181C',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#27272F',
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
    color: '#FFFFFF',
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
    backgroundColor: '#18181C',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#27272F',
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
    color: '#71717A',
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
    backgroundColor: '#202026',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'center',
  },
  inlineApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 6,
  },
  inlineAppliedBtn: {
    backgroundColor: '#10B981',
  },
  inlineApplyText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
});
