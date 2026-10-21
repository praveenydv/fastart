import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './AudioModalStyles';

interface AudioTrackItemProps {
  item: any;
  isPlaying: boolean;
  onTogglePlay: (item: any) => void;
  onSelect: (item: any) => void;
  showLicense?: boolean;
}

export const AudioTrackItem: React.FC<AudioTrackItemProps> = ({
  item,
  isPlaying,
  onTogglePlay,
  onSelect,
  showLicense = false,
}) => {
  return (
    <View style={styles.audioRow}>
      <TouchableOpacity
        style={[styles.playIconBtn, isPlaying && styles.playIconBtnActive]}
        onPress={() => onTogglePlay(item)}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color={isPlaying ? '#000000' : '#00F2FE'}
        />
      </TouchableOpacity>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.audioTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.audioMeta}>
            {item.artist} • {item.duration}s
          </Text>
          {showLicense && item.license ? (
            <View style={styles.licensePill}>
              <Text style={styles.licenseText}>{item.license}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.usePill}
        onPress={() => onSelect(item)}
      >
        <Text style={styles.usePillText}>Use</Text>
      </TouchableOpacity>
    </View>
  );
};
