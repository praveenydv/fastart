import React from 'react';
import { View, Text } from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../../Common/TactileTouchable';
import { Ionicons } from '@expo/vector-icons';
import { SPEED_CURVES } from '../../../constants/sampleMedia';
import { styles } from './SpeedModalStyles';

interface SpeedPresetCurvesTabProps {
  activeCurveId: string;
  onSelectCurve: (curve: any) => void;
}

export const SpeedPresetCurvesTab: React.FC<SpeedPresetCurvesTabProps> = ({
  activeCurveId,
  onSelectCurve,
}) => {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={styles.sectionTitle}>1-TAP SPEED CURVES</Text>
        <Text style={{ color: '#71717A', fontSize: 9.5 }}>Tap to apply velocity profile</Text>
      </View>
      <View style={styles.curveGrid}>
        {SPEED_CURVES.map((c: any) => {
          const isActive = activeCurveId === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.curveCard,
                { width: '48.5%', padding: 8, alignItems: 'flex-start', marginVertical: 3 },
                isActive && styles.curveCardActive,
              ]}
              onPress={() => onSelectCurve(c)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
                <View style={[styles.curveGraphBox, isActive && { borderColor: '#00F2FE', backgroundColor: 'rgba(0, 242, 254, 0.08)' }]}>
                  <Ionicons
                    name={(c.icon || 'trending-up') as any}
                    size={16}
                    color={isActive ? '#00F2FE' : '#94A3B8'}
                  />
                </View>
                {c.badge && (
                  <View
                    style={{
                      paddingHorizontal: 5,
                      paddingVertical: 1.5,
                      borderRadius: 3,
                      backgroundColor: isActive ? 'rgba(0, 242, 254, 0.15)' : '#141416',
                      borderWidth: 1,
                      borderColor: isActive ? '#00F2FE' : '#27272A',
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? '#00F2FE' : '#8E8E93',
                        fontSize: 8.5,
                        fontWeight: '600',
                      }}
                    >
                      {c.badge}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[styles.curveLabel, { fontSize: 11, fontWeight: '600' }, isActive && styles.curveLabelActive]}>
                {c.name}
              </Text>
              {c.desc && (
                <Text
                  style={{
                    color: '#71717A',
                    fontSize: 8.5,
                    marginTop: 2,
                    lineHeight: 11,
                  }}
                  numberOfLines={2}
                >
                  {c.desc}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};
