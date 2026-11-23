import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ModalHeader } from '../Common/ModalHeader';
import { VideoClip } from '../../types/project';

export interface AutoReframeConfig {
  targetRatio: string;
  trackingSpeed: 'slow' | 'default' | 'fast';
  enabled: boolean;
}

export interface AutoReframeModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (config: AutoReframeConfig) => void;
  selectedClip?: VideoClip | null;
  isInline?: boolean;
}

interface RatioPreset {
  id: string;
  label: string;
  sub: string;
  icon: string;
  aspectDesc: string;
}

const RATIO_PRESETS: RatioPreset[] = [
  {
    id: '9:16',
    label: '9:16 Vertical',
    sub: 'TikTok • Reels • Shorts',
    icon: 'cellphone',
    aspectDesc: 'Full-bleed mobile format',
  },
  {
    id: '1:1',
    label: '1:1 Square',
    sub: 'Instagram • Post feed',
    icon: 'crop-square',
    aspectDesc: 'Balanced square frame',
  },
  {
    id: '4:5',
    label: '4:5 Portrait',
    sub: 'Instagram • Facebook',
    icon: 'image-outline',
    aspectDesc: 'Optimized vertical feed',
  },
  {
    id: '16:9',
    label: '16:9 Widescreen',
    sub: 'YouTube • TV • Film',
    icon: 'monitor',
    aspectDesc: 'Standard landscape video',
  },
  {
    id: '2.35:1',
    label: '2.35:1 Cinema',
    sub: 'Anamorphic Ultrawide',
    icon: 'filmstrip',
    aspectDesc: 'Cinematic widescreen look',
  },
];

const SPEED_OPTIONS: { id: 'slow' | 'default' | 'fast'; label: string; desc: string; icon: string }[] = [
  {
    id: 'slow',
    label: 'Smooth',
    desc: 'Cinematic gentle drift',
    icon: 'walk-outline',
  },
  {
    id: 'default',
    label: 'Balanced',
    desc: 'Adaptive natural tracking',
    icon: 'camera-outline',
  },
  {
    id: 'fast',
    label: 'Action',
    desc: 'Snappy response for sports',
    icon: 'flash-outline',
  },
];

export default function AutoReframeModal({
  visible,
  onClose,
  onApply,
  selectedClip,
  isInline = false,
}: AutoReframeModalProps) {
  const currentReframe = selectedClip?.autoReframe;

  const [targetRatio, setTargetRatio] = useState<string>(
    currentReframe?.targetRatio || '9:16'
  );
  const [trackingSpeed, setTrackingSpeed] = useState<'slow' | 'default' | 'fast'>(
    currentReframe?.trackingSpeed || 'default'
  );
  const [enabled, setEnabled] = useState<boolean>(
    currentReframe?.enabled ?? true
  );

  useEffect(() => {
    if (selectedClip?.autoReframe) {
      setTargetRatio(selectedClip.autoReframe.targetRatio || '9:16');
      setTrackingSpeed(selectedClip.autoReframe.trackingSpeed || 'default');
      setEnabled(selectedClip.autoReframe.enabled ?? true);
    }
  }, [selectedClip]);

  if (!visible) return null;

  const handleSelectRatio = (ratioId: string) => {
    setTargetRatio(ratioId);
    onApply({
      targetRatio: ratioId,
      trackingSpeed,
      enabled: true,
    });
  };

  const handleSelectSpeed = (speedId: 'slow' | 'default' | 'fast') => {
    setTrackingSpeed(speedId);
    onApply({
      targetRatio,
      trackingSpeed: speedId,
      enabled: true,
    });
  };

  const handleToggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    onApply({
      targetRatio,
      trackingSpeed,
      enabled: next,
    });
  };

  return (
    <View style={[styles.inlineWrapper, isInline && styles.inlineWrapperDocked]}>
      <View style={styles.sheetContainer}>
        <ModalHeader
          title="Auto-Reframe"
          onClose={onClose}
          onDone={onClose}
        />

        {/* Master AI Tracking Toggle Card */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={styles.aiBadge}>
              <MaterialCommunityIcons name="auto-fix" size={14} color="#38BDF8" />
              <Text style={styles.aiBadgeText}>AI Vision</Text>
            </View>
            <Text style={styles.toggleTitle}>Smart Subject Centering</Text>
            <Text style={styles.toggleSub}>
              Intelligently keep main actors centered across aspect ratio changes
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.switchPill, enabled && styles.switchPillActive]}
            onPress={handleToggleEnabled}
            activeOpacity={0.8}
          >
            <Text style={[styles.switchPillText, enabled && styles.switchPillTextActive]}>
              {enabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Target Aspect Ratios */}
          <Text style={styles.sectionHeader}>TARGET ASPECT RATIO</Text>
          <View style={styles.ratioGrid}>
            {RATIO_PRESETS.map((preset) => {
              const isSelected = targetRatio === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.ratioCard,
                    isSelected && styles.ratioCardActive,
                  ]}
                  onPress={() => handleSelectRatio(preset.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.ratioCardTop}>
                    <MaterialCommunityIcons
                      name={preset.icon as any}
                      size={20}
                      color={isSelected ? '#FFFFFF' : '#A1A1AA'}
                    />
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={16} color="#38BDF8" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.ratioLabel,
                      isSelected && styles.ratioLabelActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text style={styles.ratioSub}>{preset.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tracking Dynamics / Speed */}
          <Text style={styles.sectionHeader}>CAMERA TRACKING SPEED</Text>
          <View style={styles.speedRow}>
            {SPEED_OPTIONS.map((opt) => {
              const isSelected = trackingSpeed === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.speedCard,
                    isSelected && styles.speedCardActive,
                  ]}
                  onPress={() => handleSelectSpeed(opt.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={16}
                    color={isSelected ? '#38BDF8' : '#71717A'}
                  />
                  <Text
                    style={[
                      styles.speedCardLabel,
                      isSelected && styles.speedCardLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.speedCardDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#09090B',
  },
  inlineWrapperDocked: {
    backgroundColor: 'transparent',
  },
  sheetContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  toggleLeft: {
    flex: 1,
    paddingRight: 12,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  aiBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleSub: {
    color: '#71717A',
    fontSize: 11,
    lineHeight: 15,
  },
  switchPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  switchPillActive: {
    backgroundColor: '#38BDF8',
  },
  switchPillText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },
  switchPillTextActive: {
    color: '#000000',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  sectionHeader: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 12,
  },
  ratioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratioCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  ratioCardActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38BDF8',
  },
  ratioCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratioLabel: {
    color: '#E4E4E7',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  ratioLabelActive: {
    color: '#FFFFFF',
  },
  ratioSub: {
    color: '#71717A',
    fontSize: 10,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  speedCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  speedCardActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38BDF8',
  },
  speedCardLabel: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 2,
  },
  speedCardLabelActive: {
    color: '#FFFFFF',
  },
  speedCardDesc: {
    color: '#71717A',
    fontSize: 9,
    textAlign: 'center',
  },
});
