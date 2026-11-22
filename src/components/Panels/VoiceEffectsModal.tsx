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
import { VoiceEffectId } from '../../types/project';

export interface VoiceEffectsModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (effectId: VoiceEffectId) => void;
  currentEffect?: VoiceEffectId;
  isInline?: boolean;
}

interface VoicePreset {
  id: VoiceEffectId;
  name: string;
  desc: string;
  icon: string;
  badge: string;
  color: string;
}

const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'none',
    name: 'Original',
    desc: 'Natural unedited voice',
    icon: 'microphone-outline',
    badge: 'Standard',
    color: '#71717A',
  },
  {
    id: 'robot',
    name: 'Robot',
    desc: 'Metallic ring synthesizer',
    icon: 'robot-outline',
    badge: 'Popular',
    color: '#EDEDED',
  },
  {
    id: 'chipmunk',
    name: 'Chipmunk',
    desc: 'High-speed comic pitch',
    icon: 'paw',
    badge: 'Trending',
    color: '#EDEDED',
  },
  {
    id: 'deep_bass',
    name: 'Deep Bass',
    desc: 'Low-frequency monster resonance',
    icon: 'speaker',
    badge: 'Cinema',
    color: '#EDEDED',
  },
  {
    id: 'megaphone',
    name: 'Megaphone',
    desc: 'Walkie-talkie bandpass drive',
    icon: 'bullhorn-outline',
    badge: 'Retro',
    color: '#EDEDED',
  },
  {
    id: 'echo',
    name: 'Echo / Arena',
    desc: 'Expansive spatial delay decay',
    icon: 'waveform',
    badge: 'Spatial',
    color: '#EDEDED',
  },
  {
    id: 'vinyl',
    name: 'Lo-Fi Vinyl',
    desc: 'Warm crackle gramophone tone',
    icon: 'disc',
    badge: 'Vintage',
    color: '#EDEDED',
  },
  {
    id: 'helium',
    name: 'Helium',
    desc: 'Ultra-light vocal balloon shift',
    icon: 'balloon',
    badge: 'Funny',
    color: '#EDEDED',
  },
];

export default function VoiceEffectsModal({
  visible,
  onClose,
  onApply,
  currentEffect = 'none',
  isInline = false,
}: VoiceEffectsModalProps) {
  const [selectedEffect, setSelectedEffect] = useState<VoiceEffectId>(currentEffect);

  useEffect(() => {
    setSelectedEffect(currentEffect);
  }, [currentEffect]);

  if (!visible) return null;

  const handleSelect = (effectId: VoiceEffectId) => {
    setSelectedEffect(effectId);
    onApply(effectId);
  };

  const handleDone = () => {
    onApply(selectedEffect);
    onClose();
  };

  const handleReset = () => {
    setSelectedEffect('none');
    onApply('none');
  };

  return (
    <View style={[styles.inlineWrapper, isInline && styles.inlineWrapperDocked]}>
      <View style={styles.sheetContainer}>
        {/* Standardized Header */}
        {!isInline && (
          <ModalHeader
            title="Voice Effects"
            iconName="mic-outline"
            onClose={onClose}
            onReset={handleReset}
            resetText="Reset"
            onDone={handleDone}
          />
        )}

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Voice Profiles</Text>
          <View style={styles.presetGrid}>
            {VOICE_PRESETS.map((preset) => {
              const isSelected = selectedEffect === preset.id;

              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetCard,
                    isSelected && styles.presetCardActive,
                  ]}
                  onPress={() => handleSelect(preset.id)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: preset.color + '22' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={preset.icon as any}
                      size={16}
                      color={preset.color}
                    />
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.nameBadgeRow}>
                      <Text
                        style={[
                          styles.cardName,
                          isSelected && styles.cardNameActive,
                        ]}
                      >
                        {preset.name}
                      </Text>
                      <View
                        style={[
                          styles.tagBadge,
                          { backgroundColor: preset.color + '26' },
                        ]}
                      >
                        <Text style={[styles.tagBadgeText, { color: preset.color }]}>
                          {preset.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={1}>
                      {preset.desc}
                    </Text>
                  </View>

                  {isSelected && (
                    <View style={styles.selectedCheck}>
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    </View>
                  )}
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
    width: '100%',
    height: '100%',
    backgroundColor: '#121214',
  },
  inlineWrapperDocked: {
    height: '100%',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#121214',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 34,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: '#121214',
  },
  cancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.35)',
  },
  resetBtnText: {
    fontSize: 9.5,
    color: '#00F2FE',
    fontWeight: '600',
  },
  applyBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 8,
    paddingBottom: 56,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: '400',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  presetGrid: {
    gap: 5,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181A',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 8,
  },
  presetCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardIconBox: {
    width: 28,
    height: 28,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 1,
  },
  cardName: {
    fontSize: 10.5,
    fontWeight: '400',
    color: '#EDEDED',
  },
  cardNameActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  tagBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  tagBadgeText: {
    fontSize: 8,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardDesc: {
    fontSize: 8.5,
    color: '#71717A',
  },
  selectedCheck: {
    marginLeft: 4,
  },
});
