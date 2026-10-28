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
import { CompactSliderInput } from '../Common/CompactSliderInput';

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

  const rafRef = React.useRef<number | null>(null);

  // Live trigger throttled with requestAnimationFrame for 60fps buttery responsiveness
  const triggerUpdate = (updates: Partial<{
    hdr: boolean;
    sharpness: number;
    colorBoost: number;
    skinSmoothing: number;
    faceRadiance: number;
  }>) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
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
      rafRef.current = null;
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
          <View style={[styles.tabContainer, isInline && { marginTop: 6 }]}>
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
                size={14}
                color={activeTab === 'beauty' ? '#00F2FE' : '#94A3B8'}
              />
              <Text
                style={[styles.tabText, activeTab === 'beauty' && { color: '#00F2FE', fontWeight: '700' }]}
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
                size={14}
                color={activeTab === 'clarity' ? '#00F2FE' : '#94A3B8'}
              />
              <Text
                style={[styles.tabText, activeTab === 'clarity' && { color: '#00F2FE', fontWeight: '700' }]}
              >
                Clarity &amp; HDR
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
                  <CompactSliderInput
                    label="Skin Smoothing"
                    icon={<Ionicons name="sparkles-outline" size={14} color="#00F2FE" />}
                    value={skinSmoothing}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={0}
                    accentColor="#00F2FE"
                    onChange={(val) => {
                      setSkinSmoothing(val);
                      triggerUpdate({ skinSmoothing: val });
                    }}
                  />
                </View>

                {/* Face Radiance */}
                <View style={styles.sliderCard}>
                  <CompactSliderInput
                    label="Face Radiance & Glow"
                    icon={<Ionicons name="sunny-outline" size={14} color="#00F2FE" />}
                    value={faceRadiance}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={0}
                    accentColor="#00F2FE"
                    onChange={(val) => {
                      setFaceRadiance(val);
                      triggerUpdate({ faceRadiance: val });
                    }}
                  />
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
                    <Ionicons name="sparkles" size={15} color="#00F2FE" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.toggleTitle}>Auto HDR Dynamic Range</Text>
                      <Text style={styles.toggleSub}>Expand highlights and shadow recovery</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={hdr ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={hdr ? '#00F2FE' : '#94A3B8'}
                  />
                </TouchableOpacity>

                {/* Sharpness */}
                <View style={styles.sliderCard}>
                  <CompactSliderInput
                    label="Crisp Sharpness"
                    icon={<Ionicons name="eye-outline" size={14} color="#00F2FE" />}
                    value={sharpness}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={0}
                    accentColor="#00F2FE"
                    onChange={(val) => {
                      setSharpness(val);
                      triggerUpdate({ sharpness: val });
                    }}
                  />
                </View>

                {/* Color Saturation / Vibrance */}
                <View style={styles.sliderCard}>
                  <CompactSliderInput
                    label="Color Saturation"
                    icon={<Ionicons name="color-palette-outline" size={14} color="#00F2FE" />}
                    value={colorBoost}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={0}
                    accentColor="#00F2FE"
                    onChange={(val) => {
                      setColorBoost(val);
                      triggerUpdate({ colorBoost: val });
                    }}
                  />
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#1F2637',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  doneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 10,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#08090E',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: 6,
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  tabText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00F2FE',
    position: 'absolute',
    top: 5,
    right: 10,
  },
  activeDotCyan: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00F2FE',
    position: 'absolute',
    top: 5,
    right: 10,
  },
  contentScroll: {
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  controlsGroup: {
    gap: 6,
    paddingBottom: 8,
  },
  sliderCard: {
    backgroundColor: '#131826',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sliderLabel: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00F2FE',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131826',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  toggleSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  stepBtn: {
    backgroundColor: '#1B2234',
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
  inlineApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 6,
  },
  inlineAppliedBtn: {
    backgroundColor: '#10B981',
  },
  inlineApplyText: {
    color: '#08090E',
    fontSize: 11,
    fontWeight: '700',
  },
});
