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
  const trackWidthRef = React.useRef<number>(260);

  const handleTrackTouch = (locationX: number) => {
    const width = trackWidthRef.current || 260;
    const ratio = Math.max(0, Math.min(1, locationX / width));
    const rawVal = 0.1 + ratio * (5.0 - 0.1);
    const snapped = Number((Math.round(rawVal * 20) / 20).toFixed(2));
    onSelectSpeed(Math.max(0.1, Math.min(5.0, snapped)));
  };

  const fillPercent = Math.max(0, Math.min(100, ((speedVal - 0.1) / (5.0 - 0.1)) * 100));

  return (
    <>
      <Text style={styles.speedDisplay}>{speedVal.toFixed(2)}x</Text>
      <Text style={styles.sectionTitle}>SPEED PRESETS</Text>
      <View style={styles.speedGrid}>
        {SPEED_PRESETS.map((item) => {
          const isActive = Math.abs(speedVal - item.value) < 0.02;
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
            onPress={() => onSelectSpeed(Math.max(0.1, Number((speedVal - 0.1).toFixed(2))))}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
              style={{ flex: 1, accentColor: '#00F2FE', height: 28 }}
            />
          ) : (
            <View
              style={styles.sliderTrackTouchable}
              onLayout={(e) => {
                trackWidthRef.current = e.nativeEvent.layout.width;
              }}
              onTouchStart={(e) => handleTrackTouch(e.nativeEvent.locationX)}
              onTouchMove={(e) => handleTrackTouch(e.nativeEvent.locationX)}
            >
              <View style={styles.sliderTrackBg}>
                <View style={[styles.sliderTrackFill, { width: `${fillPercent}%` }]} />
              </View>
              <View
                style={[
                  styles.sliderThumb,
                  { left: `${Math.max(0, Math.min(94, fillPercent))}%` },
                ]}
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => onSelectSpeed(Math.min(5.0, Number((speedVal + 0.1).toFixed(2))))}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};
