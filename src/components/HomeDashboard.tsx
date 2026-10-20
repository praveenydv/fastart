import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FastArtLogo from './FastArtLogo';
import { soundEngine } from '../utils/audioEngine';

export default function HomeDashboard({
  projects,
  onOpenProject,
  onCreateNewProject,
  onDuplicateProject,
  onDeleteProject,
  onOpenSettings,
  onOpenNotifications,
  unreadNotificationsCount = 0,
}) {
  const shortcuts = [
    { id: 'autocut', title: 'AutoCut', icon: 'flash', color: '#00F2FE' },
    { id: 'tts', title: 'AI Voice', icon: 'mic', color: '#10B981' },
    { id: 'enhance', title: 'AI Enhance', icon: 'sparkles', color: '#D946EF' },
    { id: 'camera', title: 'Camera', icon: 'camera', color: '#F59E0B' },
  ];

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <View style={styles.logoRow}>
          <FastArtLogo size={34} />
          <Text style={styles.logoText}>FastArt</Text>
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>

        <View style={styles.navActions}>
          <TouchableOpacity
            style={styles.navIconBtn}
            activeOpacity={0.7}
            onPress={() => {
              soundEngine.playSfx('click');
              onOpenNotifications();
            }}
          >
            <Ionicons name="notifications-outline" size={20} color="#8E95A5" />
            {unreadNotificationsCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotificationsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navIconBtn}
            activeOpacity={0.7}
            onPress={() => {
              soundEngine.playSfx('click');
              onOpenSettings();
            }}
          >
            <Ionicons name="settings-outline" size={20} color="#8E95A5" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollArea}>
        {/* "+ New Project" Hero Card */}
        <TouchableOpacity
          style={styles.newProjectCard}
          onPress={() => {
            soundEngine.playSfx('whoosh');
            onCreateNewProject();
          }}
          activeOpacity={0.85}
        >
          <View style={styles.newProjectPlusCircle}>
            <Ionicons name="add" size={32} color="#000000" />
          </View>
          <Text style={styles.newProjectTitle}>New Project</Text>
          <Text style={styles.newProjectSubtext}>
            Start creating with videos, photos, and music
          </Text>
        </TouchableOpacity>

        {/* Shortcuts Banner */}
        <View style={styles.shortcutsRow}>
          {shortcuts.map((sc) => (
            <TouchableOpacity
              key={sc.id}
              style={styles.shortcutItem}
              onPress={() => {
                soundEngine.playSfx('pop');
                onCreateNewProject();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: `${sc.color}20` }]}>
                <Ionicons name={sc.icon as any} size={22} color={sc.color} />
              </View>
              <Text style={styles.shortcutLabel}>{sc.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Projects List */}
        <View style={styles.projectsHeaderRow}>
          <Text style={styles.sectionHeader}>RECENT PROJECTS ({projects.length})</Text>
        </View>

        {projects.map((proj) => {
          const videoClips = proj.tracks?.video || [];
          const numClips = videoClips.length;
          return (
            <TouchableOpacity
              key={proj.id}
              style={styles.projectCard}
              onPress={() => {
                soundEngine.playSfx('click');
                onOpenProject(proj.id);
              }}
              activeOpacity={0.8}
            >
              {/* Thumbnail representation */}
              <View style={styles.projectThumb}>
                <Ionicons name="film" size={24} color="#00F2FE" />
                <View style={styles.thumbDurationBadge}>
                  <Text style={styles.thumbDurationText}>{proj.aspectRatio}</Text>
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.projectTitle} numberOfLines={1}>
                  {proj.title}
                </Text>
                <Text style={styles.projectMeta}>
                  {numClips} clips • {proj.resolution || '1080p'} • Updated today
                </Text>
              </View>

              {/* Action Buttons: Duplicate & Delete */}
              <View style={styles.projectActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    soundEngine.playSfx('pop');
                    onDuplicateProject(proj.id);
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color="#8E95A5" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    soundEngine.playSfx('pop');
                    onDeleteProject(proj.id);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF0050" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D13',
  },
  navBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  proBadge: {
    backgroundColor: '#FFE600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  navActions: {
    flexDirection: 'row',
    gap: 8,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141721',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF0050',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0B0D13',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  scrollArea: {
    flex: 1,
    padding: 16,
  },
  newProjectCard: {
    backgroundColor: '#141721',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#252B3B',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  newProjectPlusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  newProjectTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  newProjectSubtext: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 4,
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  shortcutItem: {
    alignItems: 'center',
    width: '22%',
  },
  shortcutIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shortcutLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  projectsHeaderRow: {
    marginBottom: 12,
  },
  sectionHeader: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141721',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  projectThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbDurationBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  thumbDurationText: {
    color: '#00F2FE',
    fontSize: 8,
    fontWeight: '800',
  },
  projectTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  projectMeta: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 4,
  },
  projectActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
