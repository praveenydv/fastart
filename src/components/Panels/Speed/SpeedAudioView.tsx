import React from 'react';
import { View, Text } from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../../Common/TactileTouchable';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './SpeedModalStyles';
import { CompactSliderInput } from '../../Common/CompactSliderInput';

interface SpeedAudioViewProps {
  speedVal: number;
  onSelectSpeed: (val: number) => void;
  clipDuration?: number;
  keepPitch: boolean;
  onToggleKeepPitch: () => void;
}

export const AUDIO_SPEED_PRESETS = [
  { label: '0.25x', value: 0.25, hint: 'Quarter' },
  { label: '0.5x', value: 0.5, hint: 'Half' },
  { label: '0.75x', value: 0.75, hint: 'Slow' },
  { label: '1.0x', value: 1.0, hint: 'Normal' },
  { label: '1.25x', value: 1.25, hint: 'Brisk' },
  { label: '1.5x', value: 1.5, hint: 'Fast' },
  { label: '2.0x', value: 2.0, hint: 'Double' },
  { label: '3.0x', value: 3.0, hint: 'Triple' },
];

export const SpeedAudioView: React.FC<SpeedAudioViewProps> = ({
  speedVal,
  onSelectSpeed,
  clipDuration = 0,
  keepPitch,
  onToggleKeepPitch,
}) => {
  // Dynamic duration calculation
  const baseDuration = Math.max(0.1, clipDuration);
  const newDuration = Math.max(0.05, baseDuration / Math.max(0.1, speedVal));
  const diffSec = newDuration - baseDuration;

  return (
    <View style={styles.audioViewContainer}>
      {/* Big Speed Readout & Live Duration */}
      <View style={styles.speedReadoutContainer}>
        <Text style={styles.audioSpeedDisplay}>{speedVal.toFixed(2)}x</Text>

        {clipDuration > 0 && (
          <View style={styles.audioDurationPill}>
            <Ionicons name="time-outline" size={13} color="#00F2FE" />
            <Text style={styles.audioDurationText}>
              {baseDuration.toFixed(1)}s ➔ {newDuration.toFixed(1)}s
            </Text>
            <Text
              style={[
                styles.audioDurationDiff,
                diffSec < 0 ? styles.diffNegative : diffSec > 0 ? styles.diffPositive : null,
              ]}
            >
              ({diffSec >= 0 ? `+${diffSec.toFixed(1)}s` : `${diffSec.toFixed(1)}s`})
            </Text>
          </View>
        )}
      </View>

      {/* Preset Pills */}
      <Text style={styles.sectionTitle}>AUDIO PRESETS</Text>
      <View style={styles.audioPresetGrid}>
        {AUDIO_SPEED_PRESETS.map((item) => {
          const isActive = Math.abs(speedVal - item.value) < 0.02;
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.audioPresetCard, isActive && styles.audioPresetCardActive]}
              onPress={() => {
                onSelectSpeed(item.value);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.audioPresetLabel, isActive && styles.audioPresetLabelActive]}>
                {item.label}
              </Text>
              <Text style={[styles.audioPresetHint, isActive && styles.audioPresetHintActive]}>
                {item.hint}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Fine Tuning Interactive Slider with Steppers */}
      <View style={styles.audioSliderBox}>
        <CompactSliderInput
          label="Fine Tuning"
          value={speedVal}
          min={0.2}
          max={4.0}
          step={0.05}
          decimals={2}
          unit="x"
          defaultValue={1.0}
          accentColor="#00F2FE"
          showSteppers={true}
          onChange={(val) => onSelectSpeed(val)}
        />
      </View>

      {/* Pitch Preservation Feature Card */}
      <TouchableOpacity
        style={[styles.pitchCard, keepPitch && styles.pitchCardActive]}
        onPress={() => {
          onToggleKeepPitch();
        }}
        activeOpacity={0.8}
      >
        <View style={styles.pitchCardLeft}>
          <View style={[styles.pitchIconBox, keepPitch && styles.pitchIconBoxActive]}>
            <Ionicons
              name={keepPitch ? 'musical-note' : 'musical-note-outline'}
              size={16}
              color={keepPitch ? '#00F2FE' : '#94A3B8'}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.pitchCardTitle}>Voice Pitch Correction</Text>
            <Text style={styles.pitchCardDesc}>
              {keepPitch
                ? 'Maintains natural vocal tone without chipmunk distortion'
                : 'Pitch shifts dynamically with playback speed'}
            </Text>
          </View>
        </View>
        <View style={[styles.pitchToggleBadge, keepPitch && styles.pitchToggleBadgeActive]}>
          <Ionicons
            name={keepPitch ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={keepPitch ? '#00F2FE' : '#64748B'}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(SpeedAudioView);
