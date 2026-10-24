import React from 'react';
import { View, Text, TouchableOpacity, Modal, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { styles } from './HomeDashboardStyles';
import { soundEngine } from '../../utils/audioEngine';
import { theme } from '../../constants/theme';

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
  const thumbUrl =
    optionsProject?.thumbnailUrl ||
    optionsProject?.tracks?.video?.[0]?.thumbnail ||
    optionsProject?.tracks?.video?.[0]?.url;

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
              {thumbUrl ? (
                <Image
                  source={{ uri: thumbUrl }}
                  style={{ width: "100%", height: "100%", borderRadius: 6 }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="film-outline" size={18} color="#FFFFFF" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetProjectTitle} numberOfLines={1}>
                {optionsProject?.title}
              </Text>
              <Text style={styles.sheetProjectMeta}>
                {optionsProject?.aspectRatio || '9:16'} •{' '}
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
              <View style={styles.actionIconBox}>
                <Ionicons name="play" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.sheetActionText}>Open in Editor</Text>
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
                <Feather name="edit-2" size={16} color="#A1A1AA" />
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
                <Feather name="copy" size={16} color="#A1A1AA" />
              </View>
              <Text style={styles.sheetActionText}>Duplicate Project</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetActionItem}
              onPress={() => {
                if (optionsProject) {
                  soundEngine.playSfx('click');
                  onSelectDelete(optionsProject);
                  onClose();
                }
              }}
            >
              <View style={[styles.actionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Feather name="trash-2" size={16} color={theme.colors.danger} />
              </View>
              <Text style={[styles.sheetActionText, { color: theme.colors.danger }]}>
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

export default ProjectOptionsMenu;
