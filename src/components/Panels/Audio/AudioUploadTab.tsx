import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './AudioModalStyles';
import { AudioTrackItem } from './AudioTrackItem';

interface AudioUploadTabProps {
  filteredUploadedTracks: any[];
  searchQuery: string;
  playingId: string | null;
  onDeviceUpload: () => void;
  onTogglePreview: (item: any) => void;
  onSelectAudio: (item: any) => void;
}

export const AudioUploadTab: React.FC<AudioUploadTabProps> = ({
  filteredUploadedTracks,
  searchQuery,
  playingId,
  onDeviceUpload,
  onTogglePreview,
  onSelectAudio,
}) => {
  return (
    <>
      <Text style={styles.sectionTitle}>
        YOUR UPLOADED AUDIO ({filteredUploadedTracks.length})
      </Text>
      {filteredUploadedTracks.length === 0 ? (
        <View style={styles.emptyUploadBox}>
          <Ionicons name="musical-notes-outline" size={44} color="#374151" />
          <Text style={styles.emptyUploadTitle}>
            {searchQuery.trim() ? 'No Matching Uploaded Audio' : 'No Custom Audio Yet'}
          </Text>
          <Text style={styles.emptyUploadSubtext}>
            {searchQuery.trim()
              ? 'Try clearing your search query.'
              : 'Import MP3, WAV, or M4A music files directly from your phone or computer.'}
          </Text>
          {!searchQuery.trim() && (
            <TouchableOpacity
              style={styles.emptyUploadCta}
              onPress={onDeviceUpload}
            >
              <Ionicons name="cloud-upload" size={16} color="#08090E" />
              <Text style={styles.emptyUploadCtaText}>Choose Audio File</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        filteredUploadedTracks.map((item) => (
          <AudioTrackItem
            key={item.id}
            item={item}
            isPlaying={playingId === item.id}
            onTogglePlay={onTogglePreview}
            onSelect={onSelectAudio}
          />
        ))
      )}
    </>
  );
};
