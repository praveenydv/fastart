import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { theme } from '../../constants/theme';
import { formatPlayheadTime } from '../Timeline/timelineUtils';

interface ProjectCardItemProps {
  project: any;
  onOpenProject: (id: string) => void;
  onOptionsPress: (proj: any) => void;
  variant?: 'grid' | 'list';
}

function formatRelativeTime(timestamp?: number | string): string {
  if (!timestamp) return 'Recently edited';
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(time)) return 'Recently edited';
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const date = new Date(time);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const ProjectCardItemComponent: React.FC<ProjectCardItemProps> = ({
  project,
  onOpenProject,
  onOptionsPress,
  variant = 'list',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const videoClips = project.tracks?.video || [];
  const numClips = videoClips.length;
  const thumbUrl =
    project.thumbnailUrl ||
    videoClips[0]?.thumbnail ||
    videoClips[0]?.url;

  const durationStr = formatPlayheadTime(project.duration || 0);
  const updatedStr = formatRelativeTime(project.updatedAt || project.createdAt);

  if (variant === 'grid') {
    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          isHovered && styles.gridCardHovered,
        ]}
        onPress={() => {
          soundEngine.playSfx('whoosh');
          onOpenProject(project.id);
        }}
        activeOpacity={0.88}
        {...(Platform.OS === 'web'
          ? ({
              onMouseEnter: () => setIsHovered(true),
              onMouseLeave: () => setIsHovered(false),
            } as any)
          : {})}
      >
        {/* 16:9 Thumbnail Area */}
        <View style={styles.gridThumbContainer}>
          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={styles.gridThumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.gridPlaceholder}>
              <View style={styles.placeholderIconRing}>
                <Ionicons name="film-outline" size={26} color="#94A3B8" />
              </View>
            </View>
          )}

          {/* Gradient Overlay for contrast */}
          <View style={styles.gridThumbGradient} pointerEvents="none" />

          {/* Aspect Ratio Badge Top Left */}
          <View style={styles.gridAspectBadge}>
            <Text style={styles.gridAspectText}>{project.aspectRatio || '9:16'}</Text>
          </View>

          {/* Duration Badge Bottom Right */}
          <View style={styles.gridDurationBadge}>
            <Text style={styles.gridDurationText}>{durationStr}</Text>
          </View>

          {/* Desktop Hover Quick Play Action */}
          {isHovered && Platform.OS === 'web' && (
            <View style={styles.gridHoverOverlay}>
              <View style={styles.gridPlayCircle}>
                <Ionicons name="play" size={18} color="#000000" />
              </View>
            </View>
          )}
        </View>

        {/* Info Footer */}
        <View style={styles.gridInfoFooter}>
          <View style={styles.gridTextColumn}>
            <Text style={styles.gridTitle} numberOfLines={1}>
              {project.title || 'Untitled Project'}
            </Text>
            <View style={styles.gridMetaRow}>
              <Text style={styles.gridMetaText}>{updatedStr}</Text>
              <Text style={styles.gridDot}>•</Text>
              <Text style={styles.gridMetaText}>
                {numClips} {numClips === 1 ? 'clip' : 'clips'}
              </Text>
              <Text style={styles.gridDot}>•</Text>
              <Text style={styles.gridResolutionText}>
                {project.resolution || '1080P'}
              </Text>
            </View>
          </View>

          {/* More 3-dots Menu Button */}
          <TouchableOpacity
            style={styles.gridMoreBtn}
            onPress={(e: any) => {
              e?.stopPropagation?.();
              soundEngine.playSfx('click');
              onOptionsPress(project);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Project options"
          >
            <Feather name="more-horizontal" size={18} color={isHovered ? '#FFFFFF' : theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // Mobile / List Variant
  return (
    <TouchableOpacity
      style={styles.listCard}
      onPress={() => {
        soundEngine.playSfx('whoosh');
        onOpenProject(project.id);
      }}
      activeOpacity={0.8}
    >
      {/* Thumbnail */}
      <View style={styles.listThumbWrapper}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.listThumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.listThumbnailPlaceholder}>
            <Ionicons name="film-outline" size={22} color="#64748B" />
          </View>
        )}
        <View style={styles.listDurationBadge}>
          <Text style={styles.listDurationText}>{durationStr}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.listInfoContainer}>
        <View style={styles.listTitleRow}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {project.title || 'Untitled Project'}
          </Text>
          <TouchableOpacity
            style={styles.listMoreButton}
            onPress={(e: any) => {
              e?.stopPropagation?.();
              soundEngine.playSfx('click');
              onOptionsPress(project);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Project options"
          >
            <Feather name="more-horizontal" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.listMetaRow}>
          <View style={styles.listAspectChip}>
            <Text style={styles.listAspectText}>
              {project.aspectRatio || '9:16'}
            </Text>
          </View>
          <Text style={styles.listMetaText}>{updatedStr}</Text>
          <Text style={styles.listDotSeparator}>•</Text>
          <Text style={styles.listMetaText}>
            {numClips} {numClips === 1 ? 'clip' : 'clips'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Grid Card Styles (Laptop/Desktop)
  gridCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  gridCardHovered: {
    borderColor: theme.colors.borderGlow,
    backgroundColor: theme.colors.cardElevated,
    transform: [{ translateY: -2 }],
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  gridThumbContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0A0D15',
    position: 'relative',
    overflow: 'hidden',
  },
  gridThumbnail: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F131F',
  },
  placeholderIconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridThumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 38,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  gridAspectBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(8, 10, 16, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridAspectText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  gridDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridDurationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  gridHoverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridPlayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  gridInfoFooter: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gridTextColumn: {
    flex: 1,
  },
  gridTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '600',
    marginBottom: 4,
  },
  gridMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gridMetaText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  gridResolutionText: {
    color: '#00F2FE',
    fontSize: 10,
    fontWeight: '700',
  },
  gridDot: {
    color: theme.colors.borderLight,
    fontSize: 9,
  },
  gridMoreBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List Card Styles (Mobile)
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  listThumbWrapper: {
    width: 74,
    height: 54,
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F131D',
  },
  listThumbnail: {
    width: '100%',
    height: '100%',
  },
  listThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121623',
  },
  listDurationBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  listDurationText: {
    fontSize: 8.5,
    color: '#FFFFFF',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  listInfoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  listMoreButton: {
    padding: 4,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listAspectChip: {
    backgroundColor: '#1C2333',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  listAspectText: {
    fontSize: 9,
    color: '#00F2FE',
    fontWeight: '700',
  },
  listMetaText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  listDotSeparator: {
    fontSize: 8,
    color: theme.colors.borderLight,
  },
});

export const ProjectCardItem = React.memo(ProjectCardItemComponent);
export default ProjectCardItem;
