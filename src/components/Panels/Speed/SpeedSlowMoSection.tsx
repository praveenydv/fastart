import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './SpeedModalStyles';

interface SpeedSlowMoSectionProps {
  smoothSlowMo: 'none' | 'blend' | 'optical_flow';
  onSelectSlowMo: (val: 'none' | 'blend' | 'optical_flow') => void;
}

const SLOW_MO_OPTIONS = [
  {
    id: 'none',
    label: 'Standard',
    desc: 'Normal playback frames',
    icon: 'flash-off-outline',
  },
  {
    id: 'blend',
    label: 'Frame Blend',
    desc: 'Fast temporal blending',
    icon: 'layers-outline',
  },
  {
    id: 'optical_flow',
    label: 'Optical Flow',
    desc: 'Smooth motion interpolation',
    icon: 'sparkles',
  },
] as const;

export const SpeedSlowMoSection: React.FC<SpeedSlowMoSectionProps> = ({
  smoothSlowMo,
  onSelectSlowMo,
}) => {
  return (
    <View style={styles.slowMoSection}>
      <View style={styles.slowMoHeader}>
        <Ionicons name="film-outline" size={18} color="#00F2FE" />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.slowMoTitle}>Smooth Slow-Mo (CapCut Pro)</Text>
          <Text style={styles.slowMoSub}>
            Interpolate frames for buttery smooth slow-motion
          </Text>
        </View>
      </View>

      <View style={styles.slowMoOptions}>
        {SLOW_MO_OPTIONS.map((opt) => {
          const isSelected = smoothSlowMo === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.slowMoCard,
                isSelected && styles.slowMoCardActive,
              ]}
              onPress={() => onSelectSlowMo(opt.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={opt.icon as any}
                size={18}
                color={isSelected ? '#00F2FE' : '#8E95A5'}
              />
              <Text
                style={[
                  styles.slowMoCardTitle,
                  isSelected && styles.slowMoCardTitleActive,
                ]}
              >
                {opt.label}
              </Text>
              <Text style={styles.slowMoCardDesc}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
