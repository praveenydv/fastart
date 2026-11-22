import React from 'react';
import { View, Text } from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../../Common/TactileTouchable';
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
        <Ionicons name="film-outline" size={18} color="#EDEDED" />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.slowMoTitle}>Smooth Slow-Mo</Text>
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
                size={16}
                color={isSelected ? '#FFFFFF' : '#8E8E93'}
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
