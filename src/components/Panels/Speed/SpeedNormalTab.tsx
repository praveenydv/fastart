import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPEED_PRESETS } from '../../../constants/sampleMedia';
import { styles } from './SpeedModalStyles';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

interface SpeedNormalTabProps {
  speedVal: number;
  onSelectSpeed: (val: number) => void;
}

export const SpeedNormalTab: React.FC<SpeedNormalTabProps> = ({
  speedVal,
  onSelectSpeed,
}) => {
  return (
    <>
      <Text style={styles.speedDisplay}>{speedVal}x</Text>
      <Text style={styles.sectionTitle}>SPEED PRESETS</Text>
      <View style={styles.speedGrid}>
        {SPEED_PRESETS.map((item) => {
          const isActive = speedVal === item.value;
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.speedPill, isActive && styles.speedPillActive]}
              onPress={() => onSelectSpeed(item.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.speedText, isActive && styles.speedTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Fine Speed Slider */}
      <View style={styles.sliderBox}>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Fine Tuning</Text>
          <Text style={styles.sliderVal}>{speedVal.toFixed(2)}x</Text>
        </View>
        <View style={styles.sliderControls}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => onSelectSpeed(Math.max(0.1, Number((speedVal - 0.1).toFixed(1))))}
          >
            <Ionicons name="remove" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <WebInput
              type="range"
              min="0.1"
              max="5.0"
              step="0.05"
              value={speedVal}
              onChange={(e: any) => onSelectSpeed(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#00F2FE' }}
            />
          ) : (
            <View style={styles.trackFallback}>
              <View style={[styles.fillFallback, { width: `${(speedVal / 5) * 100}%` }]} />
            </View>
          )}
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => onSelectSpeed(Math.min(5.0, Number((speedVal + 0.1).toFixed(1))))}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};
