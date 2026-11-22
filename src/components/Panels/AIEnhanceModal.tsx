import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Ionicons } from '@expo/vector-icons';
import { CompactSliderInput } from '../Common/CompactSliderInput';
import { ModalHeader } from '../Common';

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
  const [isSliderDragging, setIsSliderDragging] = useState(false);

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
    onClose();
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <ModalHeader
          title="Enhance"
          iconName="sparkles"
          onClose={onClose}
          onReset={handleReset}
          resetText="Reset"
        />
      ) : null}

          {/* Tabs: Beauty vs Clarity */}
          <View style={[styles.tabContainer, isInline && { marginTop: 4 }]}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'beauty' && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab('beauty');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-outline"
                size={12}
                color={activeTab === 'beauty' ? '#FFFFFF' : '#8A8A8E'}
              />
              <Text
                style={[styles.tabText, activeTab === 'beauty' && { color: '#FFFFFF', fontWeight: '400' }]}
              >
                Beauty
              </Text>
              {(skinSmoothing > 0 || faceRadiance > 0) && <View style={styles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'clarity' && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab('clarity');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="color-wand-outline"
                size={12}
                color={activeTab === 'clarity' ? '#FFFFFF' : '#8A8A8E'}
              />
              <Text
                style={[styles.tabText, activeTab === 'clarity' && { color: '#FFFFFF', fontWeight: '400' }]}
              >
                Clarity
              </Text>
              {(hdr || sharpness > 0 || colorBoost > 0) && <View style={styles.activeDotCyan} />}
            </TouchableOpacity>
          </View>

          {/* Controls Body */}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isSliderDragging}
          >
            {activeTab === 'beauty' && (
              <View style={styles.controlsGroup}>
                {/* Skin Smoothing */}
                <View style={styles.sliderCard}>
                  <CompactSliderInput
                    label="Smoothing"
                    icon={<Ionicons name="sparkles-outline" size={12} color="#94A3B8" />}
                    value={skinSmoothing}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={0}
                    showSteppers={true}
                    accentColor="#FFFFFF"
                    onDragStart={() => setIsSliderDragging(true)}
                    onDragEnd={() => setIsSliderDragging(false)}
                    onChange={(val) => {
                      setSkinSmoothing(val);
                      triggerUpdate({ skinSmoothing: val });
                    }}
                  />
                </View>

                {/* Face Radiance */}
                <View style={styles.sliderCard}>
                  <CompactSliderInput
                    label="Radiance"
                    icon={<Ionicons name="sunny-outline" size={12} color="#94A3B8" />}
                    value={faceRadiance}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={0}
                    showSteppers={true}
                    accentColor="#FFFFFF"
                    onDragStart={() => setIsSliderDragging(true)}
                    onDragEnd={() => setIsSliderDragging(false)}
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
                    const next = !hdr;
                    setHdr(next);
                    triggerUpdate({ hdr: next });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.toggleInfo}>
                    <Ionicons name="sparkles" size={13} color="#CBD5E1" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.toggleTitle}>Auto HDR</Text>
                      <Text style={styles.toggleSub}>Highlights & shadows</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={hdr ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={hdr ? '#FFFFFF' : '#71717A'}
                  />
                </TouchableOpacity>

                {/* Sharpness */}
                <View style={styles.sliderCard}>
                  <CompactSliderInput
                    label="Sharpness"
                    icon={<Ionicons name="eye-outline" size={12} color="#94A3B8" />}
                    value={sharpness}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={0}
                    showSteppers={true}
                    accentColor="#FFFFFF"
                    onDragStart={() => setIsSliderDragging(true)}
                    onDragEnd={() => setIsSliderDragging(false)}
                    onChange={(val) => {
                      setSharpness(val);
                      triggerUpdate({ sharpness: val });
                    }}
                  />
                </View>

                {/* Color Saturation / Vibrance */}
                <View style={styles.sliderCard}>
                  <CompactSliderInput
                    label="Saturation"
                    icon={<Ionicons name="color-palette-outline" size={12} color="#94A3B8" />}
                    value={colorBoost}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={0}
                    showSteppers={true}
                    accentColor="#FFFFFF"
                    onDragStart={() => setIsSliderDragging(true)}
                    onDragEnd={() => setIsSliderDragging(false)}
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
    backgroundColor: '#121214',
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
    backgroundColor: '#121214',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    borderWidth: 1,
    borderColor: '#1F1F23',
  },
  sheetHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#27272A',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#121214',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#EDEDED',
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
    flexDirection: "row",
    alignItems: "center",
  },
  resetText: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "600",
  },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 3,
    backgroundColor: '#18181A',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 3.5,
    borderRadius: 4,
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 9.5,
    color: '#8E8E93',
    fontWeight: '400',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 4,
    right: 8,
  },
  activeDotCyan: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 4,
    right: 8,
  },
  contentScroll: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  controlsGroup: {
    gap: 4,
    paddingBottom: 6,
  },
  sliderCard: {
    backgroundColor: '#18181A',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sliderLabel: {
    color: '#EDEDED',
    fontSize: 9.5,
    fontWeight: '400',
  },
  badge: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181A',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTitle: {
    color: '#EDEDED',
    fontSize: 10.5,
    fontWeight: '500',
  },
  toggleSub: {
    color: '#71717A',
    fontSize: 8.5,
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 3,
  },
  stepBtn: {
    backgroundColor: '#141416',
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  stepperVal: {
    color: '#EDEDED',
    fontSize: 9.5,
    fontWeight: '400',
    minWidth: 30,
    textAlign: 'center',
  },
  inlineApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 4,
  },
  inlineAppliedBtn: {
    backgroundColor: '#27272A',
  },
  inlineApplyText: {
    color: '#121214',
    fontSize: 9.5,
    fontWeight: '500',
  },
});
