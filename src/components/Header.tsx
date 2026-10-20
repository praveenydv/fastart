import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FastArtLogo from './FastArtLogo';
import { ASPECT_RATIOS } from '../constants/sampleMedia';
import { FastArtProject, AspectRatio, Resolution } from '../types/project';

interface HeaderProps {
  project: FastArtProject;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
  onBackToHome: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
}

export default function Header({
  project,
  onUpdateProject,
  onBackToHome,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
}: HeaderProps) {
  const [ratioModalVisible, setRatioModalVisible] = useState(false);
  const [resModalVisible, setResModalVisible] = useState(false);

  const currentRatio = ASPECT_RATIOS.find((r) => r.id === project.aspectRatio) || ASPECT_RATIOS[0];
  const resolutions: Resolution[] = ['720p', '1080p', '2K/4K'];

  return (
    <View style={styles.header}>
      {/* Left: Back button & FastArt Brand & Ratio */}
      <View style={styles.leftSection}>
        <TouchableOpacity style={styles.iconButton} onPress={onBackToHome} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <FastArtLogo size={26} />
        <TouchableOpacity
          style={styles.ratioPill}
          onPress={() => setRatioModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name={currentRatio.icon || 'phone-portrait-outline'} size={14} color="#00F2FE" />
          <Text style={styles.ratioText}>{currentRatio.label}</Text>
          <Ionicons name="chevron-down" size={12} color="#8E95A5" />
        </TouchableOpacity>
      </View>

      {/* Center: Undo / Redo */}
      <View style={styles.centerSection}>
        <TouchableOpacity
          style={[styles.historyButton, !canUndo && styles.disabledButton]}
          onPress={onUndo}
          disabled={!canUndo}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-undo-outline" size={20} color={canUndo ? '#FFFFFF' : '#4B5563'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.historyButton, !canRedo && styles.disabledButton]}
          onPress={onRedo}
          disabled={!canRedo}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-redo-outline" size={20} color={canRedo ? '#FFFFFF' : '#4B5563'} />
        </TouchableOpacity>
      </View>

      {/* Right: Resolution selector & Export CTA */}
      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.resPill}
          onPress={() => setResModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.resText}>{project.resolution || '1080p'}</Text>
          <Ionicons name="caret-down" size={10} color="#8E95A5" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={onOpenExport} activeOpacity={0.8}>
          <Ionicons name="arrow-up" size={18} color="#000000" />
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Aspect Ratio Modal */}
      <Modal visible={ratioModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRatioModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Canvas Aspect Ratio</Text>
            {ASPECT_RATIOS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.modalItem, project.aspectRatio === item.id && styles.modalItemActive]}
                onPress={() => {
                  onUpdateProject({ aspectRatio: item.id });
                  setRatioModalVisible(false);
                }}
              >
                <View style={styles.modalItemLeft}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={project.aspectRatio === item.id ? '#00F2FE' : '#8E95A5'}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.modalItemLabel}>{item.label}</Text>
                    <Text style={styles.modalItemDesc}>{item.desc}</Text>
                  </View>
                </View>
                {project.aspectRatio === item.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#00F2FE" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Resolution Modal */}
      <Modal visible={resModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setResModalVisible(false)}
        >
          <View style={[styles.modalContent, { width: 260 }]}>
            <Text style={styles.modalTitle}>Export Resolution</Text>
            {resolutions.map((res) => (
              <TouchableOpacity
                key={res}
                style={[styles.modalItem, project.resolution === res && styles.modalItemActive]}
                onPress={() => {
                  onUpdateProject({ resolution: res });
                  setResModalVisible(false);
                }}
              >
                <Text style={styles.modalItemLabel}>{res}</Text>
                {project.resolution === res && (
                  <Ionicons name="checkmark-circle" size={20} color="#00F2FE" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    backgroundColor: '#0B0D13',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
    zIndex: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141721',
  },
  ratioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141721',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252B3B',
    gap: 6,
  },
  ratioText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  centerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141721',
  },
  disabledButton: {
    opacity: 0.4,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141721',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  resText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00F2FE',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 4,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  exportText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 300,
    backgroundColor: '#141721',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#252B3B',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalItemActive: {
    backgroundColor: '#1E2333',
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalItemLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalItemDesc: {
    color: '#8E95A5',
    fontSize: 11,
  },
});
