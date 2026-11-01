import React from 'react';
import { View, Text } from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../../Common/TactileTouchable';
import { SPEED_PRESETS } from '../../../constants/sampleMedia';
import { styles } from './SpeedModalStyles';
import { CompactSliderInput } from '../../Common/CompactSliderInput';

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

      {/* Fine Speed Slider with Continuous Dragging & Stepper Buttons */}
      <View style={styles.sliderBox}>
        <CompactSliderInput
          label="Fine Tuning"
          value={speedVal}
          min={0.1}
          max={5.0}
          step={0.05}
          decimals={2}
          unit="x"
          defaultValue={1.0}
          accentColor="#00F2FE"
          showSteppers={true}
          onChange={(val) => onSelectSpeed(val)}
        />
      </View>
    </>
  );
};
