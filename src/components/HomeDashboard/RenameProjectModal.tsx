import React from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './HomeDashboardStyles';
import { soundEngine } from '../../utils/audioEngine';

interface RenameProjectModalProps {
  renamingProject: { id: string; title: string } | null;
  newTitleText: string;
  setNewTitleText: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export const RenameProjectModal: React.FC<RenameProjectModalProps> = ({
  renamingProject,
  newTitleText,
  setNewTitleText,
  onClose,
  onSave,
}) => {
  return (
    <Modal
      visible={!!renamingProject}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <View style={styles.modalHeaderIcon}>
              <Ionicons name="create-outline" size={18} color="#00F2FE" />
            </View>
            <Text style={styles.modalTitle}>Rename Project</Text>
          </View>

          <TextInput
            style={styles.titleInput}
            value={newTitleText}
            onChangeText={setNewTitleText}
            placeholder="Project title..."
            placeholderTextColor="#64748B"
            autoFocus
            selectTextOnFocus
            maxLength={40}
            onSubmitEditing={onSave}
          />

          <View style={styles.modalButtonsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                soundEngine.playSfx('click');
                onClose();
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                !newTitleText.trim() && styles.saveBtnDisabled,
              ]}
              disabled={!newTitleText.trim()}
              onPress={onSave}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
