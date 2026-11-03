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
    color: '#00F2FE',
  },
  {
    id: 'chipmunk',
    name: 'Chipmunk',
    desc: 'High-speed comic pitch',
    icon: 'paw',
    badge: 'Trending',
    color: '#FACC15',
  },
  {
    id: 'deep_bass',
    name: 'Deep Bass',
    desc: 'Low-frequency monster resonance',
    icon: 'speaker',
    badge: 'Cinema',
    color: '#8B5CF6',
  },
  {
    id: 'megaphone',
    name: 'Megaphone',
    desc: 'Walkie-talkie bandpass drive',
    icon: 'bullhorn-outline',
    badge: 'Retro',
    color: '#F97316',
  },
  {
    id: 'echo',
    name: 'Echo / Arena',
    desc: 'Expansive spatial delay decay',
    icon: 'waveform',
    badge: 'Spatial',
    color: '#10B981',
  },
  {
    id: 'vinyl',
    name: 'Lo-Fi Vinyl',
    desc: 'Warm crackle gramophone tone',
    icon: 'disc',
    badge: 'Vintage',
    color: '#EC4899',
  },
  {
    id: 'helium',
    name: 'Helium',
    desc: 'Ultra-light vocal balloon shift',
    icon: 'balloon',
    badge: 'Funny',
    color: '#38BDF8',
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
            title="Voice Changer & Audio FX"
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
          <Text style={styles.sectionTitle}>Character Voice Profiles</Text>
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
                      <Ionicons name="checkmark-circle" size={14} color="#00F2FE" />
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
    backgroundColor: '#0D0E15',
  },
  inlineWrapperDocked: {
    height: '100%',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#0D0E15',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 34,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: '#12141F',
  },
  cancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtnText: {
    fontSize: 9.5,
    color: '#A1A1AA',
    fontWeight: '400',
  },
  applyBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 8,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#A1A1AA',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  presetGrid: {
    gap: 5,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171926',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 8,
  },
  presetCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  cardIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
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
    color: '#FFFFFF',
  },
  cardNameActive: {
    color: '#00F2FE',
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
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 8.5,
    color: '#71717A',
  },
  selectedCheck: {
    marginLeft: 4,
  },
});
