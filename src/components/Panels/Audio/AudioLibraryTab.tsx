import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './AudioModalStyles';
import { AudioTrackItem } from './AudioTrackItem';
import { OpenAudioItem } from '../../../services/openMediaService';

interface AudioLibraryTabProps {
  activeTab: 'sfx' | 'music';
  audioItems: OpenAudioItem[];
  isLoading: boolean;
  playingId: string | null;
  onTogglePreview: (item: any) => void;
  onSelectAudio: (item: any) => void;
}

export const AudioLibraryTab: React.FC<AudioLibraryTabProps> = ({
  activeTab,
  audioItems,
  isLoading,
  playingId,
  onTogglePreview,
  onSelectAudio,
}) => {
  return (
    <>
      <View style={styles.sourceBannerRow}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'sfx' ? 'OPEN SOURCE SOUND EFFECTS' : 'OPEN SOURCE SOUNDTRACKS'}
        </Text>
        <View style={styles.ossBadge}>
          <Ionicons name="globe-outline" size={10} color="#00F2FE" />
          <Text style={styles.ossBadgeText}>{"Openverse & CC0 Library"}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#00F2FE" />
          <Text style={styles.loadingText}>Searching open-source library...</Text>
        </View>
      ) : audioItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={36} color="#374151" />
          <Text style={styles.emptyTitle}>No Matching Audio Found</Text>
          <Text style={styles.emptySubtext}>
            Try searching with different keywords like "whoosh", "impact", "piano", or "glitch"
          </Text>
        </View>
      ) : (
        audioItems.map((item) => (
          <AudioTrackItem
            key={item.id}
            item={item}
            isPlaying={playingId === item.id}
            onTogglePlay={onTogglePreview}
            onSelect={onSelectAudio}
            showLicense={true}
          />
        ))
      )}
    </>
  );
};
