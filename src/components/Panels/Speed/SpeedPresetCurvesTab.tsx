import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
      <Text style={styles.sectionTitle}>SPEED CURVES</Text>
      <View style={styles.curveGrid}>
        {SPEED_CURVES.map((c) => {
          const isActive = activeCurveId === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.curveCard, isActive && styles.curveCardActive]}
              onPress={() => onSelectCurve(c)}
              activeOpacity={0.7}
            >
              <View style={styles.curveGraphBox}>
                <Ionicons
                  name="trending-up-outline"
                  size={24}
                  color={isActive ? '#00F2FE' : '#94A3B8'}
                />
              </View>
              <Text style={[styles.curveLabel, isActive && styles.curveLabelActive]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};
