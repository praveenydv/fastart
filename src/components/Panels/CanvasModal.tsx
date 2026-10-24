import React from 'react';
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
import { FastArtProject, AspectRatio } from '../../types/project';

interface CanvasModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  project: FastArtProject | null;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
  isInline?: boolean;
}

export interface ExtendedRatioOption {
  id: AspectRatio;
  label: string;
  desc: string;
  icon: any;
  platform: string;
}

export const RATIO_OPTIONS: ExtendedRatioOption[] = [
  {
    id: '9:16',
    label: '9:16',
    desc: 'TikTok, Shorts, Reels',
    icon: 'phone-portrait-outline',
    platform: 'Mobile Vertical',
  },
  {
    id: '16:9',
    label: '16:9',
    desc: 'YouTube, Landscape',
    icon: 'phone-landscape-outline',
    platform: 'Widescreen',
  },
  {
    id: '1:1',
    label: '1:1',
    desc: 'Instagram, Square Feed',
    icon: 'square-outline',
    platform: 'Square',
  },
  {
    id: '4:5',
    label: '4:5',
    desc: 'Instagram Portrait',
    icon: 'newspaper-outline',
    platform: 'Portrait Feed',
  },
  {
    id: '2.35:1',
    label: '2.35:1',
    desc: 'Cinematic Widescreen',
    icon: 'film-outline',
    platform: 'Cinemascope',
  },
];

export default function CanvasModal({
  visible,
  onClose,
  onApply,
  project,
  onUpdateProject,
  isInline = false,
}: CanvasModalProps) {
  if (!project) return null;

  const currentRatio = project.aspectRatio || '9:16';

  const handleSelectRatio = (ratio: AspectRatio) => {
    soundEngine.playSfx('pop');
    onUpdateProject({ aspectRatio: ratio });
  };

  const handleReset = () => {
    soundEngine.playSfx('pop');
    onUpdateProject({ aspectRatio: '9:16' });
  };

  const isDefault = currentRatio === '9:16';

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
    <View style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Header (Only for floating modal mode) */}
      {!isInline && (
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerCloseBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close Ratio"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetBtn, isDefault && { opacity: 0.4 }]}
              disabled={isDefault}
              activeOpacity={0.7}
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerTitleRow}>
            <Ionicons name="scan-outline" size={16} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Ratio</Text>
          </View>

          <TouchableOpacity
            onPress={handleApply}
            style={styles.doneBtn}
            activeOpacity={0.7}
            accessibilityLabel="Apply Ratio"
          >
            <Ionicons name="checkmark" size={18} color="#000000" />
          </TouchableOpacity>
        </View>
      )}

          {/* Aspect Ratios Grid */}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.ratioGrid}>
              {RATIO_OPTIONS.map((item) => {
                const isSelected = currentRatio === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.ratioCard, isSelected && styles.ratioCardActive]}
                    onPress={() => handleSelectRatio(item.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.ratioIconBox,
                        isSelected && styles.ratioIconBoxActive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={isSelected ? '#000000' : '#A1A1AA'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.ratioLabel,
                        isSelected && styles.ratioLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={styles.ratioDesc} numberOfLines={1}>
                      {item.desc}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={10} color="#000000" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
  );

  if (isInline) {
    if (!visible) return null;
    return <View style={styles.inlineWrapper}>{sheetContent}</View>;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        {sheetContent}
      </View>
    </Modal>
  );
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
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: Platform.OS === 'web' ? '55%' : '65%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderColor: '#27272F',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3F3F46',
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
    borderBottomColor: '#18181C',
  },
  headerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#18181C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272F',
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
    fontSize: 11,
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
  contentScroll: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  scrollBody: {
    paddingBottom: 24,
  },
  ratioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratioCard: {
    width: '31.5%',
    backgroundColor: '#18181C',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#27272F',
    position: 'relative',
  },
  ratioCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#202026',
  },
  ratioIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#202026',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ratioIconBoxActive: {
    backgroundColor: '#FFFFFF',
  },
  ratioLabel: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '600',
    marginBottom: 2,
  },
  ratioLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ratioDesc: {
    fontSize: 9,
    color: '#71717A',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
