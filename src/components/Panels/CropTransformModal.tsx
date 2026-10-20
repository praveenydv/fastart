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
import { ClipTransform, AspectRatio } from '../../types/project';

interface CropTransformModalProps {
  visible: boolean;
  onClose: () => void;
  currentTransform?: ClipTransform;
  currentAspectRatio?: AspectRatio;
  onApplyTransform: (transform: ClipTransform, newAspectRatio?: AspectRatio) => void;
}

const WebDiv: any = Platform.OS === 'web' ? 'div' : View;
const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export default function CropTransformModal({
  visible,
  onClose,
  currentTransform,
  currentAspectRatio = '9:16',
  onApplyTransform,
}: CropTransformModalProps) {
  const [scale, setScale] = useState(currentTransform?.scale || 1.0);
  const [rotation, setRotation] = useState(currentTransform?.rotation || 0);
  const [x, setX] = useState(currentTransform?.x || 0);
  const [y, setY] = useState(currentTransform?.y || 0);
  const [flipX, setFlipX] = useState(currentTransform?.flipX || false);
  const [flipY, setFlipY] = useState(currentTransform?.flipY || false);
  const [opacity, setOpacity] = useState(currentTransform?.opacity ?? 1.0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(currentAspectRatio);

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
    }
  }, [visible, currentTransform, currentAspectRatio]);

  const ratios: { id: AspectRatio; label: string; icon: string }[] = [
    { id: '9:16', label: '9:16 (TikTok)', icon: 'phone-portrait-outline' },
    { id: '16:9', label: '16:9 (YouTube)', icon: 'phone-landscape-outline' },
    { id: '1:1', label: '1:1 (Square)', icon: 'square-outline' },
    { id: '4:5', label: '4:5 (Post)', icon: 'image-outline' },
    { id: '2.35:1', label: '2.35:1 (Cinema)', icon: 'film-outline' },
  ];

  const handleApply = () => {
    soundEngine.playSfx('click');
    onApplyTransform(
      {
        scale,
        rotation,
        x,
        y,
        flipX,
        flipY,
        opacity,
      },
      aspectRatio
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
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="crop" size={20} color="#00F2FE" />
              <Text style={styles.headerTitle}>Crop, Canvas & Transform</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll}>
            {/* Canvas Aspect Ratio */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Canvas Aspect Ratio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
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
                          size={18}
                          color={isSelected ? '#000000' : '#8E95A5'}
                        />
                        <Text
                          style={[
                            styles.ratioCardText,
                            isSelected && styles.ratioCardTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Scale Slider */}
            <View style={styles.section}>
              <View style={styles.labelValueRow}>
                <Text style={styles.sectionTitle}>Scale / Zoom</Text>
                <Text style={styles.badge}>{scale.toFixed(2)}x</Text>
              </View>
              {Platform.OS === 'web' ? (
                <WebDiv style={{ margin: '10px 0' }}>
                  <WebInput
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.05"
                    value={scale}
                    onChange={(e: any) => setScale(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: '#00F2FE',
                      height: 5,
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  />
                </WebDiv>
              ) : null}
            </View>

            {/* Flip & Rotate Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Orientation & Flips</Text>
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

                <TouchableOpacity
                  style={styles.toolBtn}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    setRotation((r) => (r + 90) % 360);
                  }}
                >
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.toolBtnText}>+90° ({rotation}°)</Text>
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
                      height: 5,
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  />
                </WebDiv>
              ) : null}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Ionicons name="reload" size={16} color="#8E95A5" />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Ionicons name="checkmark" size={18} color="#000000" />
              <Text style={styles.applyBtnText}>Apply Transform</Text>
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
    maxHeight: '85%',
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
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: '#00F2FE20',
    color: '#00F2FE',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F2536',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ratioCardActive: {
    backgroundColor: '#00F2FE',
  },
  ratioCardText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  ratioCardTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  toolBtn: {
    flex: 1,
    backgroundColor: '#1F2536',
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
    color: '#000000',
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1E2333',
    gap: 6,
  },
  resetBtnText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 1,
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
