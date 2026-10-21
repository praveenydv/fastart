import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './HomeDashboardStyles';
import { soundEngine } from '../../utils/audioEngine';

interface ProjectOptionsMenuProps {
  optionsProject: any | null;
  onClose: () => void;
  onOpenProject: (id: string) => void;
  onOpenRename: (id: string, currentTitle: string) => void;
  onDuplicateProject: (id: string) => void;
  onSelectDelete: (project: any) => void;
}

export const ProjectOptionsMenu: React.FC<ProjectOptionsMenuProps> = ({
  optionsProject,
  onClose,
  onOpenProject,
  onOpenRename,
  onDuplicateProject,
  onSelectDelete,
}) => {
  return (
    <Modal
      visible={!!optionsProject}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.sheetOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Project Header Info */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetThumb}>
              <Ionicons name="film" size={18} color="#00F2FE" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetProjectTitle} numberOfLines={1}>
                {optionsProject?.title}
              </Text>
              <Text style={styles.sheetProjectMeta}>
                {optionsProject?.aspectRatio} •{' '}
                {optionsProject?.resolution || '1080p'} •{' '}
                {optionsProject?.tracks?.video?.length || 0} clips
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.sheetActionsList}>
            <TouchableOpacity
              style={styles.sheetActionItem}
              onPress={() => {
                if (optionsProject) {
                  soundEngine.playSfx('whoosh');
                  onOpenProject(optionsProject.id);
                  onClose();
                }
              }}
            >
              <View
                style={[
                  styles.actionIconBox,
                  { backgroundColor: 'rgba(0, 242, 254, 0.12)' },
                ]}
              >
                <Ionicons name="play" size={17} color="#00F2FE" />
              </View>
              <Text
                style={[
                  styles.sheetActionText,
                  { color: '#00F2FE', fontWeight: '700' },
                ]}
              >
                Open in Editor
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetActionItem}
              onPress={() => {
                if (optionsProject) {
                  onOpenRename(optionsProject.id, optionsProject.title);
                }
              }}
            >
              <View style={styles.actionIconBox}>
                <Ionicons name="pencil-outline" size={17} color="#94A3B8" />
              </View>
              <Text style={styles.sheetActionText}>Rename Project</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetActionItem}
              onPress={() => {
                if (optionsProject) {
                  soundEngine.playSfx('pop');
                  onDuplicateProject(optionsProject.id);
                  onClose();
                }
              }}
            >
              <View style={styles.actionIconBox}>
                <Ionicons name="copy-outline" size={17} color="#94A3B8" />
              </View>
              <Text style={styles.sheetActionText}>Duplicate Project</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetActionItem, styles.sheetActionItemDanger]}
              onPress={() => {
                if (optionsProject) {
                  soundEngine.playSfx('click');
                  onSelectDelete(optionsProject);
                  onClose();
                }
              }}
            >
              <View
                style={[
                  styles.actionIconBox,
                  { backgroundColor: 'rgba(255, 0, 80, 0.12)' },
                ]}
              >
                <Ionicons name="trash-outline" size={17} color="#FF0050" />
              </View>
              <Text style={[styles.sheetActionText, { color: '#FF0050' }]}>
                Delete Project
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.sheetCancelBtn}
            onPress={onClose}
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
