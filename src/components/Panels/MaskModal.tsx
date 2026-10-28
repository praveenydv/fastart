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
import { MaskConfig, MaskShape } from '../../types/project';
import { CompactSliderInput } from '../Common/CompactSliderInput';

interface MaskModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentMask?: MaskConfig;
  onApplyMask: (newMask: MaskConfig) => void;
  isInline?: boolean;
}

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : View;

const MASK_SHAPES: { id: MaskShape; label: string; icon: string; desc: string }[] = [
  { id: 'none', label: 'None', icon: 'close-circle-outline', desc: 'Full Video' },
  { id: 'circle', label: 'Radial Circle', icon: 'radio-button-on-outline', desc: 'Spotlight' },
  { id: 'rectangle', label: 'Rounded Box', icon: 'square-outline', desc: 'Pill Box' },
  { id: 'linear', label: 'Split Line', icon: 'remove-outline', desc: 'Half Screen' },
  { id: 'mirror', label: 'Mirror Band', icon: 'pause-outline', desc: 'Center Band' },
  { id: 'heart', label: 'Love Heart', icon: 'heart-outline', desc: 'Vignette' },
  { id: 'star', label: 'Star', icon: 'star-outline', desc: 'Badge' },
];

export default function MaskModal({
  visible,
  onClose,
  onApply,
  currentMask,
  onApplyMask,
  isInline = false,
}: MaskModalProps) {
  const [maskShape, setMaskShape] = useState<MaskShape>(currentMask?.shape || 'none');
  const [maskSize, setMaskSize] = useState<number>(currentMask?.size || 60);
  const [maskWidth, setMaskWidth] = useState<number>(currentMask?.width || currentMask?.size || 60);
  const [maskHeight, setMaskHeight] = useState<number>(currentMask?.height || currentMask?.size || 60);
  const [isAspectLocked, setIsAspectLocked] = useState<boolean>(false);
  const [maskFeather, setMaskFeather] = useState<number>(currentMask?.feather || 0);
  const [maskRoundness, setMaskRoundness] = useState<number>(currentMask?.roundness || 16);
  const [maskInverted, setMaskInverted] = useState<boolean>(currentMask?.inverted || false);
  const [maskX, setMaskX] = useState<number>(currentMask?.x || 0);
  const [maskY, setMaskY] = useState<number>(currentMask?.y || 0);
  const [maskRotation, setMaskRotation] = useState<number>(currentMask?.rotation || 0);

  useEffect(() => {
    if (visible) {
      setMaskShape(currentMask?.shape || 'none');
      const s = currentMask?.size || 60;
      setMaskSize(s);
      setMaskWidth(currentMask?.width !== undefined ? currentMask.width : s);
      setMaskHeight(currentMask?.height !== undefined ? currentMask.height : s);
      setMaskFeather(currentMask?.feather || 0);
      setMaskRoundness(currentMask?.roundness || 16);
      setMaskInverted(currentMask?.inverted || false);
      setMaskX(currentMask?.x || 0);
      setMaskY(currentMask?.y || 0);
      setMaskRotation(currentMask?.rotation || 0);
    }
  }, [visible, currentMask]);

  const triggerUpdate = (overrides?: {
    shape?: MaskShape;
    size?: number;
    width?: number;
    height?: number;
    feather?: number;
    roundness?: number;
    inverted?: boolean;
    x?: number;
    y?: number;
    rotation?: number;
  }) => {
    const nextShape = overrides?.shape !== undefined ? overrides.shape : maskShape;
    const nextSize = overrides?.size !== undefined ? overrides.size : maskSize;
    const nextWidth = overrides?.width !== undefined ? overrides.width : maskWidth;
    const nextHeight = overrides?.height !== undefined ? overrides.height : maskHeight;
    const nextFeather = overrides?.feather !== undefined ? overrides.feather : maskFeather;
    const nextRoundness = overrides?.roundness !== undefined ? overrides.roundness : maskRoundness;
    const nextInverted = overrides?.inverted !== undefined ? overrides.inverted : maskInverted;
    const nextX = overrides?.x !== undefined ? overrides.x : maskX;
    const nextY = overrides?.y !== undefined ? overrides.y : maskY;
    const nextRotation = overrides?.rotation !== undefined ? overrides.rotation : maskRotation;

    const newMask: MaskConfig = {
      shape: nextShape,
      size: nextSize,
      width: nextWidth,
      height: nextHeight,
      feather: nextFeather,
      roundness: nextRoundness,
      inverted: nextInverted,
      x: nextX,
      y: nextY,
      rotation: nextRotation,
    };

    onApplyMask(newMask);
  };

  const handleReset = () => {
    soundEngine.playSfx('pop');
    setMaskShape('none');
    setMaskSize(60);
    setMaskWidth(60);
    setMaskHeight(60);
    setIsAspectLocked(false);
    setMaskFeather(0);
    setMaskRoundness(16);
    setMaskInverted(false);
    setMaskX(0);
    setMaskY(0);
    setMaskRotation(0);

    triggerUpdate({
      shape: 'none',
      size: 60,
      width: 60,
      height: 60,
      feather: 0,
      roundness: 16,
      inverted: false,
      x: 0,
      y: 0,
      rotation: 0,
    });
  };

  const isModified = maskShape !== 'none';

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const sheetContent = (
    <View
      style={[
        styles.sheetContainer,
        styles.inlineSheetContainer,
        Platform.OS === 'web' ? ({ pointerEvents: 'auto' } as any) : undefined,
      ]}
      pointerEvents="auto"
    >
      {/* Unified Live Panel Header - only shown in standalone modal */}
      {!isInline && (
        <View style={styles.unifiedHeader}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="shapes-outline" size={16} color="#00F2FE" />
            <Text style={styles.sheetTitle}>Mask</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, !isModified && { opacity: 0.4 }, { paddingHorizontal: 10, height: 26 }]}
              disabled={!isModified}
              activeOpacity={0.7}
              accessibilityLabel="Reset mask"
            >
              <Ionicons name="refresh-outline" size={12} color="#00F2FE" style={{ marginRight: 3 }} />
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtnCircle}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      )}

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.groupContainer}>
              {/* Mask Shapes Grid */}
              <View style={styles.maskGrid}>
                {MASK_SHAPES.map((m) => {
                  const isSelected = maskShape === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.maskCard, isSelected && styles.maskCardActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setMaskShape(m.id);
                        triggerUpdate({ shape: m.id });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={20}
                        color={isSelected ? '#00F2FE' : '#8E95A5'}
                      />
                      <Text
                        style={[
                          styles.maskCardTitle,
                          isSelected && styles.maskCardTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {maskShape !== 'none' && (
                <View style={styles.controlsCard}>
                  {/* Dimensions & Deformation Header */}
                  <View style={styles.dimHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="resize-outline" size={13} color="#00F2FE" />
                      <Text style={styles.dimLabel}>Dimensions & Deformation</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.lockBtn, isAspectLocked && styles.lockBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setIsAspectLocked(!isAspectLocked);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isAspectLocked ? 'lock-closed' : 'lock-open-outline'}
                        size={11}
                        color={isAspectLocked ? '#00F2FE' : '#8E95A5'}
                      />
                      <Text style={[styles.lockBtnText, isAspectLocked && styles.lockBtnTextActive]}>
                        {isAspectLocked ? 'Linked' : 'Free Deform'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Deformation Aspect Ratio Quick Presets */}
                  <View style={styles.ratioPillsRow}>
                    {[
                      { label: '1:1 Square', w: 60, h: 60 },
                      { label: '16:9 Wide', w: 80, h: 45 },
                      { label: '9:16 Tall', w: 45, h: 80 },
                      { label: '2:1 Pill', w: 84, h: 42 },
                      { label: '4:3 Standard', w: 72, h: 54 },
                    ].map((preset) => {
                      const isActive = maskWidth === preset.w && maskHeight === preset.h;
                      return (
                        <TouchableOpacity
                          key={preset.label}
                          style={[styles.ratioPill, isActive && styles.ratioPillActive]}
                          onPress={() => {
                            soundEngine.playSfx('click');
                            setMaskWidth(preset.w);
                            setMaskHeight(preset.h);
                            setMaskSize(Math.max(preset.w, preset.h));
                            triggerUpdate({
                              width: preset.w,
                              height: preset.h,
                              size: Math.max(preset.w, preset.h),
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.ratioPillText, isActive && styles.ratioPillTextActive]}>
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Mask Width Slider */}
                  <View style={styles.sliderRow}>
                    <CompactSliderInput
                      label="Mask Width"
                      value={maskWidth}
                      min={10}
                      max={150}
                      step={1}
                      unit="%"
                      defaultValue={60}
                      accentColor="#00F2FE"
                      onChange={(val) => {
                        setMaskWidth(val);
                        if (isAspectLocked) {
                          const ratio = maskWidth > 0 ? maskHeight / maskWidth : 1;
                          const newH = Math.round(Math.max(10, Math.min(150, val * ratio)));
                          setMaskHeight(newH);
                          triggerUpdate({ width: val, height: newH, size: Math.max(val, newH) });
                        } else {
                          triggerUpdate({ width: val, size: Math.max(val, maskHeight) });
                        }
                      }}
                    />
                  </View>

                  {/* Mask Height Slider */}
                  <View style={styles.sliderRow}>
                    <CompactSliderInput
                      label="Mask Height"
                      value={maskHeight}
                      min={10}
                      max={150}
                      step={1}
                      unit="%"
                      defaultValue={60}
                      accentColor="#00F2FE"
                      onChange={(val) => {
                        setMaskHeight(val);
                        if (isAspectLocked) {
                          const ratio = maskHeight > 0 ? maskWidth / maskHeight : 1;
                          const newW = Math.round(Math.max(10, Math.min(150, val * ratio)));
                          setMaskWidth(newW);
                          triggerUpdate({ height: val, width: newW, size: Math.max(newW, val) });
                        } else {
                          triggerUpdate({ height: val, size: Math.max(maskWidth, val) });
                        }
                      }}
                    />
                  </View>

                  {/* Edge Softness (Feather) */}
                  <View style={styles.sliderRow}>
                    <CompactSliderInput
                      label="Edge Softness (Feather)"
                      value={maskFeather}
                      min={0}
                      max={80}
                      step={1}
                      unit="%"
                      defaultValue={0}
                      accentColor="#00F2FE"
                      onChange={(val) => {
                        setMaskFeather(val);
                        triggerUpdate({ feather: val });
                      }}
                    />
                  </View>

                  {/* Box Roundness (if rectangle) */}
                  {maskShape === 'rectangle' && (
                    <View style={styles.sliderRow}>
                      <CompactSliderInput
                        label="Corner Roundness"
                        value={maskRoundness}
                        min={0}
                        max={60}
                        step={1}
                        unit="px"
                        defaultValue={16}
                        accentColor="#00F2FE"
                        onChange={(val) => {
                          setMaskRoundness(val);
                          triggerUpdate({ roundness: val });
                        }}
                      />
                    </View>
                  )}

                  {/* Rotation Angle Slider */}
                  <View style={styles.sliderRow}>
                    <CompactSliderInput
                      label="Rotation Angle"
                      value={maskRotation}
                      min={-180}
                      max={180}
                      step={1}
                      unit="°"
                      defaultValue={0}
                      showReset={true}
                      accentColor="#00F2FE"
                      onChange={(val) => {
                        setMaskRotation(val);
                        triggerUpdate({ rotation: val });
                      }}
                      onReset={() => {
                        setMaskRotation(0);
                        triggerUpdate({ rotation: 0 });
                      }}
                    />
                  </View>

                  {/* Position HUD & Sliders */}
                  <View style={styles.sliderRow}>
                    <View style={styles.labelValueRow}>
                      <Text style={styles.sliderLabel}>Position Offset</Text>
                      {(maskX !== 0 || maskY !== 0) && (
                        <TouchableOpacity
                          onPress={() => {
                            soundEngine.playSfx('click');
                            setMaskX(0);
                            setMaskY(0);
                            triggerUpdate({ x: 0, y: 0 });
                          }}
                          style={{
                            backgroundColor: 'rgba(0, 242, 254, 0.15)',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: '#00F2FE', fontSize: 10, fontWeight: '700' }}>Center</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <CompactSliderInput
                      label="Position X"
                      value={maskX}
                      min={-100}
                      max={100}
                      step={1}
                      unit="%"
                      defaultValue={0}
                      accentColor="#00F2FE"
                      onChange={(val) => {
                        setMaskX(val);
                        triggerUpdate({ x: val });
                      }}
                    />
                    <CompactSliderInput
                      label="Position Y"
                      value={maskY}
                      min={-100}
                      max={100}
                      step={1}
                      unit="%"
                      defaultValue={0}
                      accentColor="#00F2FE"
                      onChange={(val) => {
                        setMaskY(val);
                        triggerUpdate({ y: val });
                      }}
                    />
                    <Text style={{ color: '#64748B', fontSize: 10.5, marginTop: 4 }}>
                      💡 Tip: Drag, rotate & scale mask directly on preview
                    </Text>
                  </View>

                  {/* Invert Mask Toggle */}
                  <TouchableOpacity
                    style={styles.toggleRow}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      const next = !maskInverted;
                      setMaskInverted(next);
                      triggerUpdate({ inverted: next });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sliderLabel}>Invert Mask (Outside Area)</Text>
                    <Ionicons
                      name={maskInverted ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={maskInverted ? '#00F2FE' : '#8E95A5'}
                    />
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
  unifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtnCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSheetContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: '#1F2637',
    paddingBottom: 16,
  },
  sheetHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F2637',
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderColor: '#1F2637',
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
  contentScroll: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  groupContainer: {
    gap: 8,
    paddingBottom: 12,
  },
  maskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  maskCard: {
    width: '23.5%',
    backgroundColor: '#131826',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  maskCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  maskCardTitle: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  maskCardTitleActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  controlsCard: {
    backgroundColor: '#131826',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1F2637',
    gap: 8,
  },
  sliderRow: {
    gap: 4,
  },
  labelValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  badge: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1F2637',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 3,
  },
  stepBtn: {
    backgroundColor: '#1B2234',
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
  dimHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2130',
  },
  dimLabel: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161D2B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#242F45',
  },
  lockBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
  },
  lockBtnText: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '600',
  },
  lockBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  ratioPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginVertical: 2,
  },
  ratioPill: {
    backgroundColor: '#131826',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  ratioPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  ratioPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  ratioPillTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
});
