import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';

export interface DesktopLeftSidebarProps {
  activeTab: string; // 'media' | 'audio' | activeModal
  onSelectTab: (tab: string) => void;
  selectedClip: any | null;
  selectedClipType?: string;
  onSplitClip?: () => void;
  onDuplicateClip?: () => void;
  onDeleteClip?: () => void;
  onRotateClip?: () => void;
}

export const DesktopLeftSidebar: React.FC<DesktopLeftSidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedClip,
  selectedClipType,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onRotateClip,
}) => {
  const items = [
    { id: 'media', label: 'Media', icon: 'images-outline', type: 'ion' },
    { id: 'audio', label: 'Audio', icon: 'musical-notes-outline', type: 'ion' },
    { id: 'text', label: 'Text', icon: 'text-outline', type: 'ion' },
    { id: 'stickers', label: 'Stickers', icon: 'happy-outline', type: 'ion' },
    { id: 'effects', label: 'Effects', icon: 'sparkles-outline', type: 'ion' },
    { id: 'transitions', label: 'Transitions', icon: 'swap-horizontal-outline', type: 'ion' },
    { id: 'filters', label: 'Filters', icon: 'color-filter-outline', type: 'ion' },
    { id: 'transform', label: 'Transform', icon: 'crop-outline', type: 'ion' },
    { id: 'mask', label: 'Mask', icon: 'shapes-outline', type: 'ion' },
    { id: 'speed', label: 'Speed', icon: 'speedometer-outline', type: 'ion' },
    { id: 'volume', label: 'Volume', icon: 'volume-high-outline', type: 'ion' },
    { id: 'cutout', label: 'Cutout', icon: 'person-outline', type: 'ion' },
    { id: 'canvas', label: 'Canvas', icon: 'aspect-ratio-outline', type: 'ion' },
    { id: 'background', label: 'Background', icon: 'image-outline', type: 'ion' },
    { id: 'captions', label: 'Captions', icon: 'chatbox-ellipses-outline', type: 'ion' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.sidebarBtn, isActive && styles.sidebarBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                onSelectTab(item.id);
              }}
              activeOpacity={0.7}
            >
              {isActive && <View style={styles.activeBar} />}
              <Ionicons
                name={item.icon as any}
                size={20}
                color={isActive ? '#00F2FE' : '#8E95A5'}
              />
              <Text
                style={[styles.btnLabel, isActive && styles.btnLabelActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Selected Clip Quick Shortcuts Divider */}
        {selectedClip && (
          <View style={styles.clipSection}>
            <View style={styles.divider} />
            <Text style={styles.sectionHeader}>CLIP</Text>

            {onSplitClip && (
              <TouchableOpacity
                style={styles.clipActionBtn}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onSplitClip();
                }}
                activeOpacity={0.7}
                accessibilityLabel="Split clip"
              >
                <Ionicons name="cut-outline" size={18} color="#E4E4E7" />
                <Text style={styles.clipActionText}>Split</Text>
              </TouchableOpacity>
            )}

            {onDuplicateClip && (
              <TouchableOpacity
                style={styles.clipActionBtn}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onDuplicateClip();
                }}
                activeOpacity={0.7}
                accessibilityLabel="Duplicate clip"
              >
                <Ionicons name="copy-outline" size={18} color="#E4E4E7" />
                <Text style={styles.clipActionText}>Duplicate</Text>
              </TouchableOpacity>
            )}

            {onRotateClip && (
              <TouchableOpacity
                style={styles.clipActionBtn}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onRotateClip();
                }}
                activeOpacity={0.7}
                accessibilityLabel="Rotate clip"
              >
                <Ionicons name="reload-outline" size={18} color="#E4E4E7" />
                <Text style={styles.clipActionText}>Rotate</Text>
              </TouchableOpacity>
            )}

            {onDeleteClip && (
              <TouchableOpacity
                style={[styles.clipActionBtn, styles.deleteBtn]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onDeleteClip();
                }}
                activeOpacity={0.7}
                accessibilityLabel="Delete clip"
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={[styles.clipActionText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 68,
    backgroundColor: '#0D0E12',
    borderRightWidth: 1,
    borderRightColor: '#1E2028',
    height: '100%',
    zIndex: 20,
  },
  scrollContent: {
    paddingVertical: 8,
    alignItems: 'center',
    gap: 4,
  },
  sidebarBtn: {
    width: 58,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  sidebarBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  activeBar: {
    position: 'absolute',
    left: 2,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 1.5,
    backgroundColor: '#00F2FE',
  },
  btnLabel: {
    color: '#8E95A5',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  btnLabelActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  clipSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 4,
  },
  divider: {
    width: 44,
    height: 1,
    backgroundColor: '#1E2028',
    marginBottom: 6,
  },
  sectionHeader: {
    color: '#52525B',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  clipActionBtn: {
    width: 58,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  clipActionText: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
});
