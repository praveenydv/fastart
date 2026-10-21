import React from 'react';
import { Modal } from 'react-native';
import SettingsScreen from '../SettingsScreen';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: any;
  onUpdateSettings: (newSettings: any) => void;
  onReloadData?: () => void;
}

/**
 * SettingsModal is a thin modal wrapper around SettingsScreen.
 * Eliminates duplicate code and maintains a single source of truth for Settings UI.
 */
export default function SettingsModal({
  visible,
  onClose,
  settings,
  onUpdateSettings,
  onReloadData,
}: SettingsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SettingsScreen
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        onBack={onClose}
        onReloadData={onReloadData}
      />
    </Modal>
  );
}
