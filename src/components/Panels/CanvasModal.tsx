import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { FastArtProject, AspectRatio } from '../../types/project';
import { ASPECT_RATIOS } from '../../constants/sampleMedia';

interface CanvasModalProps {
  visible: boolean;
  onClose: () => void;
  project: FastArtProject | null;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
}

const CANVAS_COLORS = [
  { id: '#000000', name: 'Black' },
  { id: '#0B0D13', name: 'Studio Dark' },
  { id: '#1A1E29', name: 'Slate' },
  { id: '#0A192F', name: 'Navy' },
  { id: '#1E1035', name: 'Violet' },
  { id: '#06251E', name: 'Emerald' },
  { id: '#2B0E1E', name: 'Crimson' },
  { id: '#FFFFFF', name: 'White' },
];

export default function CanvasModal({
  visible,
  onClose,
  project,
  onUpdateProject,
}: CanvasModalProps) {
  if (!project) return null;

  const currentRatio = project.aspectRatio || '9:16';
  const currentBg = project.canvasBackground || '#000000';
  const activeColorObj = CANVAS_COLORS.find(
    (c) => c.id.toLowerCase() === currentBg.toLowerCase(),
  );

  // Compute preview aspect ratio box dimensions (fit in 100x100)
  const getPreviewBoxStyle = () => {
    switch (currentRatio) {
      case '9:16':
        return { width: 50, height: 88 };
      case '16:9':
        return { width: 92, height: 52 };
      case '1:1':
        return { width: 68, height: 68 };
      case '4:5':
        return { width: 58, height: 72 };
      case '2.35:1':
        return { width: 94, height: 40 };
      default:
        return { width: 50, height: 88 };
    }
  };

  const handleSelectRatio = (ratio: AspectRatio) => {
    soundEngine.playSfx('pop');
    onUpdateProject({ aspectRatio: ratio });
  };

  const handleSelectColor = (color: string) => {
    soundEngine.playSfx('pop');
    onUpdateProject({ canvasBackground: color });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="scan-outline" size={18} color="#00F2FE" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Canvas Settings</Text>
                <Text style={styles.headerSubtitle}>Format, aspect ratio & canvas background</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                soundEngine.playSfx('click');
                onClose();
              }}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Live Canvas Preview Card */}
            <View style={styles.previewCard}>
              <View style={styles.previewStage}>
                <View
                  style={[
                    styles.previewRatioBox,
                    getPreviewBoxStyle(),
                    { backgroundColor: currentBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.previewRatioText,
                      currentBg === '#FFFFFF' ? { color: '#000000' } : { color: '#00F2FE' },
                    ]}
                  >
                    {currentRatio}
                  </Text>
                </View>
              </View>
              <View style={styles.previewMeta}>
                <View style={styles.metaBadge}>
                  <Ionicons name="film-outline" size={13} color="#00F2FE" />
                  <Text style={styles.metaBadgeText}>{currentRatio}</Text>
                </View>
                <View style={styles.metaBadge}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: currentBg,
                      borderWidth: currentBg.toLowerCase() === '#ffffff' ? 1 : 0,
                      borderColor: '#4B5563',
                    }}
                  />
                  <Text style={styles.metaBadgeText}>
                    {activeColorObj?.name || 'Background'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 1. Aspect Ratio Formats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Aspect Ratio (Canvas Format)</Text>
              <View style={styles.ratioGrid}>
                {ASPECT_RATIOS.map((item) => {
                  const isSelected = currentRatio === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.ratioCard, isSelected && styles.ratioCardActive]}
                      onPress={() => handleSelectRatio(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.ratioIconRow}>
                        <Ionicons
                          name={item.icon || 'phone-portrait-outline'}
                          size={20}
                          color={isSelected ? '#00F2FE' : '#8E95A5'}
                        />
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color="#00F2FE" />
                        )}
                      </View>
                      <Text style={[styles.ratioLabel, isSelected && styles.ratioLabelActive]}>
                        {item.label}
                      </Text>
                      <Text style={styles.ratioDesc} numberOfLines={1}>
                        {item.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Canvas Background Colors */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Canvas Background Color</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorRow}
              >
                {CANVAS_COLORS.map((col) => {
                  const isSelected = currentBg.toLowerCase() === col.id.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={col.id}
                      style={[
                        styles.colorSwatchBtn,
                        isSelected && styles.colorSwatchBtnActive,
                      ]}
                      onPress={() => handleSelectColor(col.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.colorCircle,
                          { backgroundColor: col.id },
                          col.id === '#FFFFFF' && { borderWidth: 1, borderColor: '#4B5563' },
                        ]}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={col.id === '#FFFFFF' ? '#000000' : '#00F2FE'}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.colorName,
                          isSelected && styles.colorNameActive,
                        ]}
                      >
                        {col.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                soundEngine.playSfx('whoosh');
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={18} color="#000000" />
              <Text style={styles.applyBtnText}>Done</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0E1118',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#1E2333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#161B26',
  },
  contentScroll: {
    padding: 16,
  },
  previewCard: {
    backgroundColor: '#141824',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22283A',
    alignItems: 'center',
  },
  previewStage: {
    width: '100%',
    height: 110,
    backgroundColor: '#090B10',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1A1F2C',
  },
  previewRatioBox: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  previewRatioText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E2436',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A324B',
  },
  metaBadgeText: {
    color: '#E0E7FF',
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#131722',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2436',
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  ratioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratioCard: {
    width: '48.5%',
    backgroundColor: '#1B202E',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  ratioCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  ratioIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ratioLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ratioLabelActive: {
    color: '#00F2FE',
  },
  ratioDesc: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 3,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  colorSwatchBtn: {
    alignItems: 'center',
    gap: 6,
  },
  colorSwatchBtnActive: {
    opacity: 1,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorName: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '600',
  },
  colorNameActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  applyBtn: {
    backgroundColor: '#00F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  applyBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});
