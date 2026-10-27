import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../../utils/audioEngine';
import { styles } from './SpeedModalStyles';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

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
  const trackWidthRef = useRef<number>(260);

  // Dynamic duration calculation
  const baseDuration = Math.max(0.1, clipDuration);
  const newDuration = Math.max(0.05, baseDuration / Math.max(0.1, speedVal));
  const diffSec = newDuration - baseDuration;

  const handleStep = (delta: number) => {
    soundEngine.playSfx('click');
    const next = Math.max(0.2, Math.min(4.0, Number((speedVal + delta).toFixed(2))));
    onSelectSpeed(next);
  };

  const handleTrackTouch = (locationX: number) => {
    const width = trackWidthRef.current || 260;
    const ratio = Math.max(0, Math.min(1, locationX / width));
    const rawVal = 0.2 + ratio * (4.0 - 0.2);
    const snapped = Number((Math.round(rawVal * 20) / 20).toFixed(2));
    onSelectSpeed(Math.max(0.2, Math.min(4.0, snapped)));
  };

  const fillPercent = Math.max(0, Math.min(100, ((speedVal - 0.2) / (4.0 - 0.2)) * 100));

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
                soundEngine.playSfx('click');
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

      {/* Fine Tuning Stepper & Interactive Slider */}
      <View style={styles.audioSliderBox}>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Fine Tuning</Text>
          <Text style={styles.sliderVal}>{speedVal.toFixed(2)}x (0.2x – 4.0x)</Text>
        </View>

        <View style={styles.sliderControls}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => handleStep(-0.05)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Decrease speed"
          >
            <Ionicons name="remove" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          {Platform.OS === 'web' ? (
            <WebInput
              type="range"
              min="0.2"
              max="4.0"
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
            onPress={() => handleStep(0.05)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Increase speed"
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Pitch Preservation Feature Card */}
      <TouchableOpacity
        style={[styles.pitchCard, keepPitch && styles.pitchCardActive]}
        onPress={() => {
          soundEngine.playSfx('click');
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
