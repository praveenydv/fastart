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
import { ClipTransform, MaskConfig, MaskShape } from '../../types/project';

interface CropTransformModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  currentTransform?: ClipTransform;
  currentMask?: MaskConfig;
  initialTab?: 'mask' | 'adjust';
  onApplyTransform: (
    transform: ClipTransform,
    newAspectRatio?: any,
    newMask?: MaskConfig
  ) => void;
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

export default function CropTransformModal({
  visible,
  onClose,
  onApply,
  currentTransform,
  currentMask,
  initialTab = 'mask',
  onApplyTransform,
}: CropTransformModalProps) {
  const [activeTab, setActiveTab] = useState<'mask' | 'adjust'>(
    initialTab === 'adjust' ? 'adjust' : 'mask'
  );
  const [flipX, setFlipX] = useState(currentTransform?.flipX || false);
  const [flipY, setFlipY] = useState(currentTransform?.flipY || false);
  const [opacity, setOpacity] = useState(currentTransform?.opacity ?? 1.0);

  // Masking state
  const [maskShape, setMaskShape] = useState<MaskShape>(currentMask?.shape || 'none');
  const [maskSize, setMaskSize] = useState<number>(currentMask?.size || 60);
  const [maskFeather, setMaskFeather] = useState<number>(currentMask?.feather || 0);
  const [maskRoundness, setMaskRoundness] = useState<number>(currentMask?.roundness || 16);
  const [maskInverted, setMaskInverted] = useState<boolean>(currentMask?.inverted || false);

  useEffect(() => {
    if (visible) {
      setFlipX(currentTransform?.flipX || false);
      setFlipY(currentTransform?.flipY || false);
      setOpacity(currentTransform?.opacity ?? 1.0);

      const m = currentMask || currentTransform?.mask;
      setMaskShape(m?.shape || 'none');
      setMaskSize(m?.size || 60);
      setMaskFeather(m?.feather || 0);
      setMaskRoundness(m?.roundness || 16);
      setMaskInverted(m?.inverted || false);

      setActiveTab(initialTab === 'adjust' ? 'adjust' : 'mask');
    }
  }, [visible, currentTransform, currentMask, initialTab]);

  const triggerUpdate = (overrides?: {
    shape?: MaskShape;
    size?: number;
    feather?: number;
    roundness?: number;
    inverted?: boolean;
    flipX?: boolean;
    flipY?: boolean;
    opacity?: number;
  }) => {
    const nextShape = overrides?.shape !== undefined ? overrides.shape : maskShape;
    const nextSize = overrides?.size !== undefined ? overrides.size : maskSize;
    const nextFeather = overrides?.feather !== undefined ? overrides.feather : maskFeather;
    const nextRoundness = overrides?.roundness !== undefined ? overrides.roundness : maskRoundness;
    const nextInverted = overrides?.inverted !== undefined ? overrides.inverted : maskInverted;
    const nextFlipX = overrides?.flipX !== undefined ? overrides.flipX : flipX;
    const nextFlipY = overrides?.flipY !== undefined ? overrides.flipY : flipY;
    const nextOpacity = overrides?.opacity !== undefined ? overrides.opacity : opacity;

    const newMask: MaskConfig = {
      shape: nextShape,
      size: nextSize,
      feather: nextFeather,
      roundness: nextRoundness,
      inverted: nextInverted,
      x: 0,
      y: 0,
      rotation: 0,
    };

    onApplyTransform(
      {
        scale: currentTransform?.scale ?? 1.0,
        rotation: currentTransform?.rotation ?? 0,
        x: currentTransform?.x ?? 0,
        y: currentTransform?.y ?? 0,
        flipX: nextFlipX,
        flipY: nextFlipY,
        opacity: nextOpacity,
        mask: newMask,
      },
      undefined,
      newMask
    );
  };

  const handleReset = () => {
    soundEngine.playSfx('pop');
    setFlipX(false);
    setFlipY(false);
    setOpacity(1.0);
    setMaskShape('none');
    setMaskSize(60);
    setMaskFeather(0);
    setMaskRoundness(16);
    setMaskInverted(false);

    triggerUpdate({
      shape: 'none',
      size: 60,
      feather: 0,
      roundness: 16,
      inverted: false,
      flipX: false,
      flipY: false,
      opacity: 1.0,
    });
  };

  const isModified =
    maskShape !== 'none' ||
    flipX ||
    flipY ||
    opacity < 0.99;

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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Space-Optimized Header */}
          <View style={styles.header}>
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
                style={[styles.resetBtn, !isModified && { opacity: 0.4 }]}
                disabled={!isModified}
                activeOpacity={0.7}
              >
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headerTitleRow}>
              <Ionicons name="shapes-outline" size={16} color="#00F2FE" />
              <Text style={styles.headerTitle}>Mask & Transform</Text>
            </View>

            <TouchableOpacity
              onPress={handleApply}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Apply transform"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'mask' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('mask');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="color-filter-outline"
                size={14}
                color={activeTab === 'mask' ? '#00F2FE' : '#8E95A5'}
              />
              <Text style={[styles.tabBtnText, activeTab === 'mask' && styles.tabBtnTextActive]}>
                Mask ({maskShape})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'adjust' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('adjust');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="options-outline"
                size={14}
                color={activeTab === 'adjust' ? '#00F2FE' : '#8E95A5'}
              />
              <Text
                style={[styles.tabBtnText, activeTab === 'adjust' && styles.tabBtnTextActive]}
              >
                Transform
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* TAB 1: VIDEO MASKING */}
            {activeTab === 'mask' && (
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
                          size={18}
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
                    {/* Size Slider */}
                    <View style={styles.sliderRow}>
                      <View style={styles.labelValueRow}>
                        <Text style={styles.sliderLabel}>Aperture Size</Text>
                        <Text style={styles.badge}>{maskSize}%</Text>
                      </View>
                      {Platform.OS === 'web' ? (
                        <WebDiv style={{ margin: '6px 0' }}>
                          <WebInput
                            type="range"
                            min="15"
                            max="100"
                            value={maskSize}
                            onChange={(e: any) => {
                              const val = parseInt(e.target.value) || 60;
                              setMaskSize(val);
                              triggerUpdate({ size: val });
                            }}
                            style={{
                              width: '100%',
                              accentColor: '#00F2FE',
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
                              const val = Math.max(15, maskSize - 5);
                              setMaskSize(val);
                              triggerUpdate({ size: val });
                            }}
                          >
                            <Ionicons name="remove" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                          <Text style={styles.stepperVal}>{maskSize}%</Text>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => {
                              const val = Math.min(100, maskSize + 5);
                              setMaskSize(val);
                              triggerUpdate({ size: val });
                            }}
                          >
                            <Ionicons name="add" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Edge Feather */}
                    <View style={styles.sliderRow}>
                      <View style={styles.labelValueRow}>
                        <Text style={styles.sliderLabel}>Edge Softness (Feather)</Text>
                        <Text style={styles.badge}>{maskFeather}%</Text>
                      </View>
                      {Platform.OS === 'web' ? (
                        <WebDiv style={{ margin: '6px 0' }}>
                          <WebInput
                            type="range"
                            min="0"
                            max="80"
                            value={maskFeather}
                            onChange={(e: any) => {
                              const val = parseInt(e.target.value) || 0;
                              setMaskFeather(val);
                              triggerUpdate({ feather: val });
                            }}
                            style={{
                              width: '100%',
                              accentColor: '#00F2FE',
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
                              const val = Math.max(0, maskFeather - 5);
                              setMaskFeather(val);
                              triggerUpdate({ feather: val });
                            }}
                          >
                            <Ionicons name="remove" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                          <Text style={styles.stepperVal}>{maskFeather}%</Text>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => {
                              const val = Math.min(80, maskFeather + 5);
                              setMaskFeather(val);
                              triggerUpdate({ feather: val });
                            }}
                          >
                            <Ionicons name="add" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      )}
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
            )}

            {/* TAB 2: FLIP & OPACITY */}
            {activeTab === 'adjust' && (
              <View style={styles.groupContainer}>
                {/* Flip Controls */}
                <View style={styles.controlsCard}>
                  <Text style={styles.sliderLabel}>Orientation & Mirroring</Text>
                  <View style={styles.flipBtnRow}>
                    <TouchableOpacity
                      style={[styles.flipBtn, flipX && styles.flipBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        const next = !flipX;
                        setFlipX(next);
                        triggerUpdate({ flipX: next });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={18}
                        color={flipX ? '#000000' : '#FFFFFF'}
                      />
                      <Text style={[styles.flipBtnText, flipX && styles.flipBtnTextActive]}>
                        Flip Horizontal
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.flipBtn, flipY && styles.flipBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        const next = !flipY;
                        setFlipY(next);
                        triggerUpdate({ flipY: next });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="swap-vertical"
                        size={18}
                        color={flipY ? '#000000' : '#FFFFFF'}
                      />
                      <Text style={[styles.flipBtnText, flipY && styles.flipBtnTextActive]}>
                        Flip Vertical
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Opacity Slider */}
                <View style={styles.controlsCard}>
                  <View style={styles.labelValueRow}>
                    <Text style={styles.sliderLabel}>Track Opacity</Text>
                    <Text style={styles.badge}>{Math.round(opacity * 100)}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '6px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(opacity * 100)}
                        onChange={(e: any) => {
                          const val = (parseInt(e.target.value) || 0) / 100;
                          setOpacity(val);
                          triggerUpdate({ opacity: val });
                        }}
                        style={{
                          width: '100%',
                          accentColor: '#00F2FE',
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
                          const val = Math.max(0, parseFloat((opacity - 0.1).toFixed(2)));
                          setOpacity(val);
                          triggerUpdate({ opacity: val });
                        }}
                      >
                        <Ionicons name="remove" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{Math.round(opacity * 100)}%</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const val = Math.min(1.0, parseFloat((opacity + 0.1).toFixed(2)));
                          setOpacity(val);
                          triggerUpdate({ opacity: val });
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderColor: '#1E2638',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2234',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#080B12',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1A2234',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#1E2638',
  },
  tabBtnText: {
    color: '#8E95A5',
    fontSize: 11.5,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  contentScroll: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  groupContainer: {
    gap: 6,
    paddingBottom: 16,
  },
  maskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  maskCard: {
    width: '23.5%',
    backgroundColor: '#141A28',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2638',
  },
  maskCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  maskCardTitle: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  maskCardTitleActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  controlsCard: {
    backgroundColor: '#161B26',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E2536',
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
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  flipBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  flipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E2536',
  },
  flipBtnActive: {
    backgroundColor: '#00F2FE',
  },
  flipBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  flipBtnTextActive: {
    color: '#000000',
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
