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
import { ClipTransform, AspectRatio, MaskConfig, CustomCrop, MaskShape } from '../../types/project';

interface CropTransformModalProps {
  visible: boolean;
  onClose: () => void;
  currentTransform?: ClipTransform;
  currentAspectRatio?: AspectRatio;
  currentMask?: MaskConfig;
  currentCrop?: CustomCrop;
  initialTab?: 'crop' | 'mask';
  onApplyTransform: (
    transform: ClipTransform,
    newAspectRatio?: AspectRatio,
    newMask?: MaskConfig,
    newCrop?: CustomCrop
  ) => void;
}

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export default function CropTransformModal({
  visible,
  onClose,
  currentTransform,
  currentAspectRatio = '9:16',
  currentMask,
  currentCrop,
  initialTab = 'crop',
  onApplyTransform,
}: CropTransformModalProps) {
  const [activeTab, setActiveTab] = useState<'crop' | 'mask' | 'adjust'>(initialTab);
  const [scale, setScale] = useState(currentTransform?.scale || 1.0);
  const [rotation, setRotation] = useState(currentTransform?.rotation || 0);
  const [x, setX] = useState(currentTransform?.x || 0);
  const [y, setY] = useState(currentTransform?.y || 0);
  const [flipX, setFlipX] = useState(currentTransform?.flipX || false);
  const [flipY, setFlipY] = useState(currentTransform?.flipY || false);
  const [opacity, setOpacity] = useState(currentTransform?.opacity ?? 1.0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(currentAspectRatio);

  // Masking state
  const [maskShape, setMaskShape] = useState<MaskShape>(currentMask?.shape || 'none');
  const [maskSize, setMaskSize] = useState<number>(currentMask?.size || 60);
  const [maskFeather, setMaskFeather] = useState<number>(currentMask?.feather || 0);
  const [maskRoundness, setMaskRoundness] = useState<number>(currentMask?.roundness || 16);
  const [maskInverted, setMaskInverted] = useState<boolean>(currentMask?.inverted || false);

  // Custom Crop state
  const [cropX, setCropX] = useState<number>(currentCrop?.x || 0);
  const [cropY, setCropY] = useState<number>(currentCrop?.y || 0);
  const [cropWidth, setCropWidth] = useState<number>(currentCrop?.width || 100);
  const [cropHeight, setCropHeight] = useState<number>(currentCrop?.height || 100);
  const [selectedCropPreset, setSelectedCropPreset] = useState<string>('free');

  React.useEffect(() => {
    if (visible) {
      setScale(currentTransform?.scale || 1.0);
      setRotation(currentTransform?.rotation || 0);
      setX(currentTransform?.x || 0);
      setY(currentTransform?.y || 0);
      setFlipX(currentTransform?.flipX || false);
      setFlipY(currentTransform?.flipY || false);
      setOpacity(currentTransform?.opacity ?? 1.0);
      setAspectRatio(currentAspectRatio);

      const m = currentMask || currentTransform?.mask;
      setMaskShape(m?.shape || 'none');
      setMaskSize(m?.size || 60);
      setMaskFeather(m?.feather || 0);
      setMaskRoundness(m?.roundness || 16);
      setMaskInverted(m?.inverted || false);

      const c = currentCrop || currentTransform?.crop;
      setCropX(c?.x || 0);
      setCropY(c?.y || 0);
      setCropWidth(c?.width || 100);
      setCropHeight(c?.height || 100);
      setActiveTab(initialTab);
    }
  }, [visible, currentTransform, currentAspectRatio, currentMask, currentCrop, initialTab]);

  const ratios: { id: AspectRatio; label: string; icon: string }[] = [
    { id: '9:16', label: '9:16 (TikTok)', icon: 'phone-portrait-outline' },
    { id: '16:9', label: '16:9 (YouTube)', icon: 'phone-landscape-outline' },
    { id: '1:1', label: '1:1 (Square)', icon: 'square-outline' },
    { id: '4:5', label: '4:5 (Post)', icon: 'image-outline' },
    { id: '2.35:1', label: '2.35:1 (Cinema)', icon: 'film-outline' },
  ];

  const maskShapes: { id: MaskShape; label: string; icon: string; desc: string }[] = [
    { id: 'none', label: 'None', icon: 'close-circle-outline', desc: 'Full Video' },
    { id: 'circle', label: 'Radial Circle', icon: 'radio-button-on-outline', desc: 'Circular Spotlight' },
    { id: 'rectangle', label: 'Rounded Box', icon: 'square-outline', desc: 'Custom Pill Box' },
    { id: 'linear', label: 'Split Line', icon: 'remove-outline', desc: 'Half Screen Split' },
    { id: 'mirror', label: 'Mirror Band', icon: 'pause-outline', desc: 'Center Band' },
    { id: 'heart', label: 'Love Heart', icon: 'heart-outline', desc: 'Romantic Vignette' },
    { id: 'star', label: 'Star', icon: 'star-outline', desc: 'Creator Badge' },
  ];

  const cropPresets = [
    { id: 'free', label: 'Freeform', w: 100, h: 100 },
    { id: '16:9', label: '16:9 Wide', w: 100, h: 56.25 },
    { id: '9:16', label: '9:16 Story', w: 56.25, h: 100 },
    { id: '1:1', label: '1:1 Square', w: 80, h: 80 },
    { id: '4:5', label: '4:5 Portrait', w: 75, h: 93.75 },
    { id: '2.35:1', label: '2.35:1 Movie', w: 100, h: 42.5 },
  ];

  const handleApplyPresetCrop = (preset: any) => {
    soundEngine.playSfx('click');
    setSelectedCropPreset(preset.id);
    const newW = preset.w;
    const newH = preset.h;
    setCropWidth(newW);
    setCropHeight(newH);
    setCropX(Number(((100 - newW) / 2).toFixed(1)));
    setCropY(Number(((100 - newH) / 2).toFixed(1)));
  };

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

    const newCrop: CustomCrop = {
      x: Math.round(cropX),
      y: Math.round(cropY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight),
    };

    onApplyTransform(
      {
        scale: currentTransform?.scale ?? scale,
        rotation: currentTransform?.rotation ?? rotation,
        x: currentTransform?.x ?? x,
        y: currentTransform?.y ?? y,
        flipX,
        flipY,
        opacity,
        mask: newMask,
        crop: newCrop,
      },
      aspectRatio,
      newMask,
      newCrop
    );
    onClose();
  };

  const handleReset = () => {
    soundEngine.playSfx('pop');
    setScale(1.0);
    setRotation(0);
    setX(0);
    setY(0);
    setFlipX(false);
    setFlipY(false);
    setOpacity(1.0);
    setMaskShape('none');
    setMaskSize(60);
    setMaskFeather(0);
    setMaskRoundness(16);
    setMaskInverted(false);
    setCropX(0);
    setCropY(0);
    setCropWidth(100);
    setCropHeight(100);
    setSelectedCropPreset('free');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="shapes-outline" size={20} color="#00F2FE" />
              <Text style={styles.headerTitle}>Crop & Mask</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'crop' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('crop');
              }}
            >
              <Ionicons
                name="crop"
                size={16}
                color={activeTab === 'crop' ? '#00F2FE' : '#8E95A5'}
              />
              <Text style={[styles.tabBtnText, activeTab === 'crop' && styles.tabBtnTextActive]}>
                Crop
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'mask' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('mask');
              }}
            >
              <Ionicons
                name="color-filter"
                size={16}
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
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={activeTab === 'adjust' ? '#00F2FE' : '#8E95A5'}
              />
              <Text style={[styles.tabBtnText, activeTab === 'adjust' && styles.tabBtnTextActive]}>
                Transform
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* TAB 1: CUSTOM SIZE CROP */}
            {activeTab === 'crop' && (
              <View>
                {/* Crop Visual Stage Preview */}
                <View style={styles.cropPreviewStage}>
                  <View style={styles.cropBackdrop}>
                    <View
                      style={[
                        styles.cropActiveBox,
                        {
                          left: `${cropX}%`,
                          top: `${cropY}%`,
                          width: `${cropWidth}%`,
                          height: `${cropHeight}%`,
                        },
                      ]}
                    >
                      <View style={styles.cropCornerTL} />
                      <View style={styles.cropCornerTR} />
                      <View style={styles.cropCornerBL} />
                      <View style={styles.cropCornerBR} />
                      <View style={styles.cropCenterTag}>
                        <Text style={styles.cropCenterTagText}>
                          {Math.round(cropWidth)}% × {Math.round(cropHeight)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Preset Aspect Ratios */}
                <Text style={styles.sectionTitle}>ASPECT RATIO PRESETS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={styles.ratioRow}>
                    {cropPresets.map((p) => {
                      const isSelected = selectedCropPreset === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.ratioCard, isSelected && styles.ratioCardActive]}
                          onPress={() => handleApplyPresetCrop(p)}
                        >
                          <Text style={[styles.ratioCardText, isSelected && styles.ratioCardTextActive]}>
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Fine-Tuning Sliders for Custom Size Crop */}
                <View style={styles.section}>
                  <View style={styles.labelValueRow}>
                    <Text style={styles.sectionTitle}>Crop Width</Text>
                    <Text style={styles.badge}>{Math.round(cropWidth)}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0' }}>
                      <WebInput
                        type="range"
                        min="10"
                        max="100"
                        step="1"
                        value={cropWidth}
                        onChange={(e: any) => {
                          setSelectedCropPreset('custom');
                          setCropWidth(parseFloat(e.target.value));
                        }}
                        style={{ width: '100%', accentColor: '#00F2FE', height: 6, cursor: 'pointer' }}
                      />
                    </WebDiv>
                  ) : null}

                  <View style={styles.labelValueRow}>
                    <Text style={styles.sectionTitle}>Crop Height</Text>
                    <Text style={styles.badge}>{Math.round(cropHeight)}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0' }}>
                      <WebInput
                        type="range"
                        min="10"
                        max="100"
                        step="1"
                        value={cropHeight}
                        onChange={(e: any) => {
                          setSelectedCropPreset('custom');
                          setCropHeight(parseFloat(e.target.value));
                        }}
                        style={{ width: '100%', accentColor: '#00F2FE', height: 6, cursor: 'pointer' }}
                      />
                    </WebDiv>
                  ) : null}

                  <View style={styles.labelValueRow}>
                    <Text style={styles.sectionTitle}>Crop Position (X Offset)</Text>
                    <Text style={styles.badge}>{Math.round(cropX)}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max={Math.max(0, 100 - cropWidth)}
                        step="1"
                        value={cropX}
                        onChange={(e: any) => setCropX(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#00F2FE', height: 6, cursor: 'pointer' }}
                      />
                    </WebDiv>
                  ) : null}

                  <View style={styles.labelValueRow}>
                    <Text style={styles.sectionTitle}>Crop Position (Y Offset)</Text>
                    <Text style={styles.badge}>{Math.round(cropY)}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '8px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max={Math.max(0, 100 - cropHeight)}
                        step="1"
                        value={cropY}
                        onChange={(e: any) => setCropY(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#00F2FE', height: 6, cursor: 'pointer' }}
                      />
                    </WebDiv>
                  ) : null}
                </View>

                {/* Overall Canvas Aspect Ratio */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>CANVAS RATIO</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View style={styles.ratioRow}>
                      {ratios.map((r) => {
                        const isSelected = aspectRatio === r.id;
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.ratioCard, isSelected && styles.ratioCardActive]}
                            onPress={() => {
                              soundEngine.playSfx('pop');
                              setAspectRatio(r.id);
                            }}
                          >
                            <Ionicons
                              name={r.icon as any}
                              size={16}
                              color={isSelected ? '#000000' : '#8E95A5'}
                            />
                            <Text style={[styles.ratioCardText, isSelected && styles.ratioCardTextActive]}>
                              {r.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              </View>
            )}

            {/* TAB 2: VIDEO MASKING */}
            {activeTab === 'mask' && (
              <View>
                {/* Mask Shape Selection */}
                <Text style={styles.sectionTitle}>MASK SHAPES</Text>
                <View style={styles.maskGrid}>
                  {maskShapes.map((m) => {
                    const isSelected = maskShape === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.maskCard, isSelected && styles.maskCardActive]}
                        onPress={() => {
                          soundEngine.playSfx('click');
                          setMaskShape(m.id);
                        }}
                      >
                        <Ionicons
                          name={m.icon as any}
                          size={24}
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
                    <View style={styles.labelValueRow}>
                      <Text style={styles.sectionTitle}>Mask Aperture Size</Text>
                      <Text style={styles.badge}>{maskSize}%</Text>
                    </View>
                    {Platform.OS === 'web' ? (
                      <WebDiv style={{ margin: '8px 0' }}>
                        <WebInput
                          type="range"
                          min="15"
                          max="100"
                          step="1"
                          value={maskSize}
                          onChange={(e: any) => setMaskSize(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: '#00F2FE', height: 6, cursor: 'pointer' }}
                        />
                      </WebDiv>
                    ) : null}

                    {maskShape === 'rectangle' && (
                      <>
                        <View style={styles.labelValueRow}>
                          <Text style={styles.sectionTitle}>Corner Roundness</Text>
                          <Text style={styles.badge}>{maskRoundness}px</Text>
                        </View>
                        {Platform.OS === 'web' ? (
                          <WebDiv style={{ margin: '8px 0' }}>
                            <WebInput
                              type="range"
                              min="0"
                              max="60"
                              step="2"
                              value={maskRoundness}
                              onChange={(e: any) => setMaskRoundness(parseFloat(e.target.value))}
                              style={{ width: '100%', accentColor: '#00F2FE', height: 6, cursor: 'pointer' }}
                            />
                          </WebDiv>
                        ) : null}
                      </>
                    )}

                    <View style={styles.labelValueRow}>
                      <Text style={styles.sectionTitle}>Edge Feather Blur</Text>
                      <Text style={styles.badge}>{maskFeather}px</Text>
                    </View>
                    {Platform.OS === 'web' ? (
                      <WebDiv style={{ margin: '8px 0' }}>
                        <WebInput
                          type="range"
                          min="0"
                          max="40"
                          step="2"
                          value={maskFeather}
                          onChange={(e: any) => setMaskFeather(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: '#00F2FE', height: 6, cursor: 'pointer' }}
                        />
                      </WebDiv>
                    ) : null}

                    {/* Invert Button */}
                    <TouchableOpacity
                      style={[styles.invertBtn, maskInverted && styles.invertBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('pop');
                        setMaskInverted(!maskInverted);
                      }}
                    >
                      <Ionicons
                        name="invert-mode-outline"
                        size={18}
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

            {/* TAB 3: ADJUSTMENTS & FLIPS */}
            {activeTab === 'adjust' && (
              <View>
                {/* Flip & Rotate Buttons */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>ORIENTATION & FLIPS</Text>
                  <View style={styles.toolsRow}>
                    <TouchableOpacity
                      style={[styles.toolBtn, flipX && styles.toolBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('pop');
                        setFlipX(!flipX);
                      }}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={20}
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
                    >
                      <Ionicons
                        name="swap-vertical"
                        size={20}
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
                    <Text style={styles.sectionTitle}>Opacity / Transparency</Text>
                    <Text style={styles.badge}>{Math.round(opacity * 100)}%</Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <WebDiv style={{ margin: '10px 0' }}>
                      <WebInput
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={opacity}
                        onChange={(e: any) => setOpacity(parseFloat(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: '#D946EF',
                          height: 6,
                          borderRadius: 3,
                          cursor: 'pointer',
                        }}
                      />
                    </WebDiv>
                  ) : null}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Ionicons name="reload" size={16} color="#8E95A5" />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Ionicons name="checkmark" size={18} color="#000000" />
              <Text style={styles.applyBtnText}>Apply to Video</Text>
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
    maxHeight: '88%',
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    paddingVertical: 8,
    borderRadius: 8,
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
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  contentScroll: {
    padding: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  labelValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  badge: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cropPreviewStage: {
    backgroundColor: '#090B10',
    borderRadius: 12,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2333',
    padding: 10,
  },
  cropBackdrop: {
    width: '100%',
    height: '100%',
    backgroundColor: '#161A26',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  cropActiveBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropCornerTL: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  cropCornerTR: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  cropCornerBL: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  cropCornerBR: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  cropCenterTag: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cropCenterTagText: {
    color: '#00F2FE',
    fontSize: 9,
    fontWeight: '800',
  },
  ratioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratioCard: {
    backgroundColor: '#161A26',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242C3F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratioCardActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    borderColor: '#00F2FE',
  },
  ratioCardText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  ratioCardTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  maskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  maskCard: {
    width: '31%',
    backgroundColor: '#161A26',
    borderRadius: 10,
    padding: 10,
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
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  maskCardTitleActive: {
    color: '#00F2FE',
  },
  maskCardDesc: {
    color: '#64748B',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
  invertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161A26',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242C3F',
    gap: 8,
    marginTop: 10,
  },
  invertBtnActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  invertBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  invertBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toolBtn: {
    flex: 1,
    backgroundColor: '#1E2333',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  toolBtnActive: {
    backgroundColor: '#00F2FE',
  },
  toolBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  toolBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E2333',
    gap: 6,
  },
  resetBtnText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 1,
    backgroundColor: '#00F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  applyBtnText: {
    color: '#00F2FE',
    fontSize: 13,
    fontWeight: '900',
  },
});
