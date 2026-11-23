import React, { useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from './TactileTouchable';
import { Ionicons } from '@expo/vector-icons';
import { FastArtProject } from '../../types/project';
import { detectBeatsFromPeaks } from '../../services/beatDetectionEngine';
import { extractRealMediaAudioPeaks, mediaHasAudioTrack } from '../../utils/mediaAudioDetector';
import { autoMatchCutVideoToBeats } from '../../utils/beatMatchCutEngine';

export interface BeatAndDuckingCardProps {
  project?: FastArtProject | null;
  onUpdateProject?: (updates: Partial<FastArtProject>) => void;
  currentTime?: number;
  selectedClip?: any;
  compact?: boolean;
}

export const BeatAndDuckingCard: React.FC<BeatAndDuckingCardProps> = ({
  project,
  onUpdateProject,
  currentTime,
  selectedClip,
}) => {
  const [isDetectingBeats, setIsDetectingBeats] = useState(false);

  const currentPlayTime =
    typeof currentTime === 'number' ? currentTime : project?.currentTime || 0;
  const existingBeats = project?.beatMarkers || [];
  const nearBeat = existingBeats.find(
    (b) => Math.abs(b - currentPlayTime) < 0.15
  );

  const handleAutoBeatDetect = async (sensitivity: number = 1.0) => {
    if (!project) return;

    let targetMediaUrl: string | undefined;
    let targetMediaId: string | undefined;
    let targetDuration: number = 10;

    if (
      selectedClip?.url &&
      (selectedClip.type === 'audio' || mediaHasAudioTrack(selectedClip))
    ) {
      targetMediaUrl = selectedClip.url;
      targetMediaId = selectedClip.id;
      targetDuration = selectedClip.duration || 10;
    } else if (project.tracks?.audio?.[0]?.url) {
      const audioTrack = project.tracks.audio[0];
      targetMediaUrl = audioTrack.url;
      targetMediaId = audioTrack.id;
      targetDuration = audioTrack.duration || 10;
    } else {
      const videoWithAudio = project.tracks?.video?.find((v) =>
        mediaHasAudioTrack(v)
      );
      if (videoWithAudio?.url) {
        targetMediaUrl = videoWithAudio.url;
        targetMediaId = videoWithAudio.id;
        targetDuration = videoWithAudio.duration || 10;
      }
    }

    if (!targetMediaUrl || !targetMediaId) {
      Alert.alert(
        'No Audio Found',
        'Please select a clip with sound or add audio to detect rhythm beats.'
      );
      return;
    }

    setIsDetectingBeats(true);
    try {
      const peaks = await extractRealMediaAudioPeaks(
        targetMediaUrl,
        targetMediaId
      );
      if (peaks && peaks.length > 0) {
        const beats = detectBeatsFromPeaks(peaks, targetDuration, sensitivity);
        if (onUpdateProject) {
          onUpdateProject({ beatMarkers: beats });
        }
      } else {
        Alert.alert(
          'Beat Detection',
          'Could not detect distinct musical transients in this audio stream.'
        );
      }
    } catch (err: any) {
      console.warn('Beat detection failed:', err);
    } finally {
      setIsDetectingBeats(false);
    }
  };

  const handleToggleBeatAtPlayhead = () => {
    if (!onUpdateProject) return;
    const playheadSec = Number(currentPlayTime.toFixed(2));
    if (nearBeat !== undefined) {
      const nextBeats = existingBeats.filter(
        (b) => Math.abs(b - nearBeat) > 0.05
      );
      onUpdateProject({ beatMarkers: nextBeats });
    } else {
      const nextBeats = Array.from(
        new Set([...existingBeats, playheadSec])
      ).sort((a, b) => a - b);
      onUpdateProject({ beatMarkers: nextBeats });
    }
  };

  const handleMatchCutToBeats = () => {
    if (!project || !onUpdateProject) return;
    if (!existingBeats || existingBeats.length === 0) {
      Alert.alert(
        'No Beats Detected',
        'Detect beats first with Beat 1 or Beat 2, or tap + Beat.'
      );
      return;
    }
    const newVideo = autoMatchCutVideoToBeats(project, 0.35);
    const prevCount = project.tracks?.video?.length || 0;
    if (newVideo.length > prevCount) {
      onUpdateProject({
        tracks: {
          ...project.tracks,
          video: newVideo,
        },
      });
      Alert.alert(
        'Match Cut Complete',
        `Split video into ${newVideo.length} cuts matched to music beats!`
      );
    } else {
      Alert.alert(
        'Match Cut',
        'Video clips already align with detected beats.'
      );
    }
  };

  const handleClearBeats = () => {
    if (onUpdateProject) {
      onUpdateProject({ beatMarkers: [] });
    }
  };

  const isDucking = Boolean(project?.audioDucking);

  return (
    <View style={styles.container}>
      {/* ── 1. Smart Audio Ducking (Compact 1-Row Switch) ── */}
      <View
        style={[
          styles.compactDuckingRow,
          isDucking ? styles.duckingActive : styles.duckingInactive,
        ]}
      >
        <View style={styles.duckingLeft}>
          <Ionicons
            name="volume-low-outline"
            size={15}
            color={isDucking ? '#00F2FE' : '#94A3B8'}
          />
          <Text style={styles.compactTitle}>Auto Ducking</Text>
          {isDucking && (
            <View style={styles.miniBadge}>
              <Text style={styles.miniBadgeText}>-14dB</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => {
            if (onUpdateProject) {
              onUpdateProject({ audioDucking: !isDucking });
            }
          }}
          style={[
            styles.togglePill,
            { backgroundColor: isDucking ? '#00F2FE' : '#27272A' },
          ]}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.togglePillText,
              { color: isDucking ? '#000000' : '#A1A1AA' },
            ]}
          >
            {isDucking ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 2. Beat Mapping & Match Cut (Space-Optimized Studio) ── */}
      <View
        style={[
          styles.compactBeatBox,
          existingBeats.length > 0 ? styles.beatActive : styles.beatInactive,
        ]}
      >
        {/* Header Strip */}
        <View style={styles.compactBeatHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="pulse" size={13} color="#FFE600" />
            <Text style={styles.compactTitle}>Beats</Text>
          </View>
          {existingBeats.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.beatCountText}>
                {existingBeats.length} {existingBeats.length === 1 ? 'Beat' : 'Beats'}
              </Text>
              <TouchableOpacity
                onPress={handleClearBeats}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={13} color="#71717A" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.subtleText}>Rhythm Sync</Text>
          )}
        </View>

        {/* Buttons Row: Beat 1, Beat 2, Live Tap */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.pillBtn}
            onPress={() => handleAutoBeatDetect(1.35)}
            disabled={isDetectingBeats}
            activeOpacity={0.8}
          >
            {isDetectingBeats ? (
              <ActivityIndicator size="small" color="#FFE600" />
            ) : (
              <Text style={styles.pillBtnText}>Beat 1</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pillBtn}
            onPress={() => handleAutoBeatDetect(0.85)}
            disabled={isDetectingBeats}
            activeOpacity={0.8}
          >
            {isDetectingBeats ? (
              <ActivityIndicator size="small" color="#FFE600" />
            ) : (
              <Text style={styles.pillBtnText}>Beat 2</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pillBtn,
              styles.tapBtn,
              nearBeat !== undefined
                ? styles.tapBtnRemove
                : styles.tapBtnAdd,
            ]}
            onPress={handleToggleBeatAtPlayhead}
            activeOpacity={0.8}
          >
            <Ionicons
              name={nearBeat !== undefined ? 'trash-outline' : 'add'}
              size={12}
              color={nearBeat !== undefined ? '#EF4444' : '#FFE600'}
              style={{ marginRight: 2 }}
            />
            <Text
              style={[
                styles.pillBtnText,
                { color: nearBeat !== undefined ? '#EF4444' : '#FFE600' },
              ]}
              numberOfLines={1}
            >
              {nearBeat !== undefined ? 'Del' : '+ Beat'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Match Cut Full Row (Appears when beats are detected) */}
        {existingBeats.length > 0 && (
          <TouchableOpacity
            style={styles.matchCutBar}
            onPress={handleMatchCutToBeats}
            activeOpacity={0.8}
          >
            <Ionicons name="cut" size={11} color="#000000" style={{ marginRight: 4 }} />
            <Text style={styles.matchCutBarText}>Match Cut Video to Beats</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    gap: 6,
  },
  compactDuckingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  duckingActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderColor: 'rgba(0, 242, 254, 0.35)',
  },
  duckingInactive: {
    backgroundColor: '#18181A',
    borderColor: '#27272A',
  },
  duckingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactTitle: {
    color: '#EDEDED',
    fontSize: 12,
    fontWeight: '700',
  },
  miniBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
  },
  miniBadgeText: {
    color: '#00F2FE',
    fontSize: 8.5,
    fontWeight: '700',
  },
  togglePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  togglePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  compactBeatBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
  },
  beatActive: {
    backgroundColor: 'rgba(255, 230, 0, 0.04)',
    borderColor: 'rgba(255, 230, 0, 0.35)',
  },
  beatInactive: {
    backgroundColor: '#18181A',
    borderColor: '#27272A',
  },
  compactBeatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  beatCountText: {
    color: '#FFE600',
    fontSize: 10,
    fontWeight: '700',
  },
  subtleText: {
    color: '#71717A',
    fontSize: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pillBtn: {
    flex: 1,
    height: 28,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  pillBtnText: {
    color: '#EDEDED',
    fontSize: 10.5,
    fontWeight: '700',
  },
  tapBtn: {
    flex: 1.15,
  },
  tapBtnAdd: {
    backgroundColor: 'rgba(255, 230, 0, 0.12)',
    borderColor: 'rgba(255, 230, 0, 0.45)',
  },
  tapBtnRemove: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  matchCutBar: {
    marginTop: 6,
    height: 27,
    borderRadius: 5,
    backgroundColor: '#FFE600',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchCutBarText: {
    color: '#000000',
    fontSize: 10.5,
    fontWeight: '800',
  },
});
