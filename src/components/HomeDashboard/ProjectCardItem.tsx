import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './HomeDashboardStyles';
import { soundEngine } from '../../utils/audioEngine';

interface ProjectCardItemProps {
  project: any;
  onOpenProject: (id: string) => void;
  onOptionsPress: (proj: any) => void;
}

export const ProjectCardItem: React.FC<ProjectCardItemProps> = ({
  project,
  onOpenProject,
  onOptionsPress,
}) => {
  const videoClips = project.tracks?.video || [];
  const numClips = videoClips.length;
  const thumbUrl = videoClips[0]?.thumbnail;

  return (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={() => {
        soundEngine.playSfx('click');
        onOpenProject(project.id);
      }}
      activeOpacity={0.75}
    >
      {/* Clean Thumbnail */}
      <View style={styles.projectThumb}>
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={styles.thumbImage}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="film" size={20} color="#00F2FE" />
        )}
        <View style={styles.aspectBadge}>
          <Text style={styles.aspectBadgeText}>
            {project.aspectRatio || '9:16'}
          </Text>
        </View>
      </View>

      {/* Info Column */}
      <View style={styles.projectInfoCol}>
        <Text style={styles.projectTitle} numberOfLines={1}>
          {project.title}
        </Text>
        <Text style={styles.projectMeta} numberOfLines={1}>
          {numClips} {numClips === 1 ? 'clip' : 'clips'} •{' '}
          {project.resolution || '1080p'} • {project.fps || 30}fps
        </Text>
      </View>

      {/* Minimalist Options Button */}
      <TouchableOpacity
        style={styles.optionsBtn}
        onPress={(e: any) => {
          e?.stopPropagation?.();
          soundEngine.playSfx('click');
          onOptionsPress(project);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Project options"
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={18}
          color="#94A3B8"
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};
