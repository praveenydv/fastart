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
import { ClipTransform, MaskConfig, MaskShape } from '../../types/project';

interface CropTransformModalProps {
  visible: boolean;
  onClose: () => void;
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
  currentTransform,
  currentMask,
  initialTab = 'mask',
  onApplyTransform,
}: CropTransformModalProps) {
  const [activeTab, setActiveTab] = useState<'mask' | 'adjust'>(initialTab === 'adjust' ? 'adjust' : 'mask');
  const [flipX, setFlipX] = useState(currentTransform?.flipX || false);
  const [flipY, setFlipY] = useState(currentTransform?.flipY || false);
  const [opacity, setOpacity] = useState(currentTransform?.opacity ?? 1.0);

  // Masking state
  const [maskShape, setMaskShape] = useState<MaskShape>(currentMask?.shape || 'none');
  const [maskSize, setMaskSize] = useState<number>(currentMask?.size || 60);
  const [maskFeather, setMaskFeather] = useState<number>(currentMask?.feather || 0);
  const [maskRoundness, setMaskRoundness] = useState<number>(currentMask?.roundness || 16);
  const [maskInverted, setMaskInverted] = useState<boolean>(currentMask?.inverted || false);

  React.useEffect(() => {
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

  const handleApply = () => {
    soundEngine.playSfx('click');
    const newMask: MaskConfig = {
      shape: maskShape,
      size: maskSize,
      feather: maskFeather,
      roundness: maskRoundness,
      inverted: maskInverted,
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
        flipX,
        flipY,
        opacity,
        mask: newMask,
      },
      undefined,
      newMask
    );
    onClose();
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
              <Ionicons name="shapes-outline" size={18} color="#00F2FE" />
              <Text style={styles.headerTitle}>Mask & Transform</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#8E95A5" />
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
                name="color-filter"
                size={14}
                color={activeTab === 'mask' ? '#00F2FE' : '#8E95A5'}
              />
              <Text style={[styles.tabBtnText, activeTab === 'mask' && styles.tabBtnTextActive]}>
                Mask
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
              <Text style={[styles.tabBtnText, activeTab === 'adjust' && styles.tabBtnTextActive]}>
                Transform
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* TAB 1: VIDEO MASKING */}
            {activeTab === 'mask' && (
              <View>
                <Text style={styles.sectionTitle}>MASK SHAPES</Text>
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
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={m.icon as any}
                          size={20}
                          color={isSelected ? '#00F2FE' : '#8E95A5'}
                        />
                        <Text style={[styles.maskCardTitle, isSelected && styles.maskCardTitleActive]}>
                          {m.label}
                        </Text>
                        <Text style={styles.maskCardDesc}>{m.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {maskShape !== 'none' && (
                  <View style={styles.section}>
                    {/* Aperture Size */}
                    <View style={styles.labelValueRow}>
                      <Text style={styles.sectionSubTitle}>Aperture Size</Text>
                      <Text style={styles.badge}>{maskSize}%</Text>
                    </View>
                    {Platform.OS === 'web' ? (
                      <WebDiv style={{ margin: '6px 0' }}>
                        <WebInput
                          type="range"
                          min="15"
                          max="100"
                          step="1"
                          value={maskSize}
                          onChange={(e: any) => setMaskSize(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: '#00F2FE', height: 4, cursor: 'pointer' }}
                        />
                      </WebDiv>
                    ) : (
                      <View style={styles.stepperRow}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setMaskSize((s) => Math.max(15, s - 5))}
                        >
                          <Ionicons name="remove" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.stepperVal}>{maskSize}%</Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setMaskSize((s) => Math.min(100, s + 5))}
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Corner Roundness */}
                    {maskShape === 'rectangle' && (
                      <>
                        <View style={styles.labelValueRow}>
                          <Text style={styles.sectionSubTitle}>Corner Roundness</Text>
                          <Text style={styles.badge}>{maskRoundness}px</Text>
                        </View>
                        {Platform.OS === 'web' ? (
                          <WebDiv style={{ margin: '6px 0' }}>
                            <WebInput
                              type="range"
                              min="0"
                              max="60"
                              step="2"
                              value={maskRoundness}
                              onChange={(e: any) => setMaskRoundness(parseFloat(e.target.value))}
                              style={{ width: '100%', accentColor: '#00F2FE', height: 4, cursor: 'pointer' }}
                            />
                          </WebDiv>
                        ) : (
                          <View style={styles.stepperRow}>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => setMaskRoundness((r) => Math.max(0, r - 4))}
                            >
                              <Ionicons name="remove" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.stepperVal}>{maskRoundness}px</Text>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => setMaskRoundness((r) => Math.min(60, r + 4))}
                            >
                              <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
                    )}

                    {/* Edge Feather */}
                    <View style={styles.labelValueRow}>
                      <Text style={styles.sectionSubTitle}>Edge Feather Blur</Text>
                      <Text style={styles.badge}>{maskFeather}px</Text>
                    </View>
                    {Platform.OS === 'web' ? (
                      <WebDiv style={{ margin: '6px 0' }}>
                        <WebInput
                          type="range"
                          min="0"
                          max="40"
                          step="2"
                          value={maskFeather}
                          onChange={(e: any) => setMaskFeather(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: '#00F2FE', height: 4, cursor: 'pointer' }}
                        />
                      </WebDiv>
                    ) : (
                      <View style={styles.stepperRow}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setMaskFeather((f) => Math.max(0, f - 2))}
                        >
                          <Ionicons name="remove" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.stepperVal}>{maskFeather}px</Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setMaskFeather((f) => Math.min(40, f + 2))}
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Invert Button */}
                    <TouchableOpacity
                      style={[styles.invertBtn, maskInverted && styles.invertBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('pop');
                        setMaskInverted(!maskInverted);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="invert-mode-outline"
                        size={16}
                        color={maskInverted ? '#000000' : '#FFFFFF'}
                      />
                      <Text style={[styles.invertBtnText, maskInverted && styles.invertBtnTextActive]}>
                        Invert Mask (Keep Outside)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: ADJUSTMENTS & FLIPS */}
            {activeTab === 'adjust' && (
              <View>
                {/* Orientation & Flips */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>ORIENTATION & FLIPS</Text>
                  <View style={styles.toolsRow}>
                    <TouchableOpacity
                      style={[styles.toolBtn, flipX && styles.toolBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('pop');
                        setFlipX(!flipX);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={18}
                        color={flipX ? '#000000' : '#FFFFFF'}
                      />
                      <Text style={[styles.toolBtnText, flipX && styles.toolBtnTextActive]}>
                        Flip Horiz
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toolBtn, flipY && styles.toolBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('pop');
                        setFlipY(!flipY);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="swap-vertical"
                        size={18}
                        color={flipY ? '#000000' : '#FFFFFF'}
                      />
                      <Text style={[styles.toolBtnText, flipY && styles.toolBtnTextActive]}>
                        Flip Vert
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Opacity */}
                <View style={styles.section}>
                  <View style={styles.labelValueRow}>
                    <Text style={styles.sectionSubTitle}>Opacity</Text>
                    <Text style={styles.badge}>{Math.round(opacity * 100)}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={opacity}
                        onChange={(e: any) => setOpacity(parseFloat(e.target.value))}
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
                        onPress={() => setOpacity((o) => Math.max(0, parseFloat((o - 0.1).toFixed(2))))}
                      >
                        <Ionicons name="remove" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{Math.round(opacity * 100)}%</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => setOpacity((o) => Math.min(1.0, parseFloat((o + 0.1).toFixed(2))))}
                      >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
              <Ionicons name="reload" size={14} color="#8E95A5" />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={16} color="#000000" />
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
    fontSize: 14,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A202E',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#161A26',
    borderWidth: 1,
    borderColor: '#242C3F',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  tabBtnText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  contentScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionSubTitle: {
    color: '#CBD5E1',
    fontSize: 11.5,
    fontWeight: '600',
  },
  labelValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 4,
  },
  badge: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  maskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  maskCard: {
    width: '31.5%',
    backgroundColor: '#161A26',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242C3F',
  },
  maskCardActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  maskCardTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  maskCardTitleActive: {
    color: '#00F2FE',
  },
  maskCardDesc: {
    color: '#64748B',
    fontSize: 8.5,
    textAlign: 'center',
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'center',
  },
  invertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161A26',
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#242C3F',
    gap: 6,
    marginTop: 8,
  },
  invertBtnActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  invertBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  invertBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toolBtn: {
    flex: 1,
    backgroundColor: '#1E2333',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  toolBtnActive: {
    backgroundColor: '#00F2FE',
  },
  toolBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  toolBtnTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E2333',
    gap: 5,
  },
  resetBtnText: {
    color: '#8E95A5',
    fontSize: 11.5,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 1,
    backgroundColor: '#00F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  applyBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
});
