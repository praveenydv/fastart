import React from 'react';
import { Modal, Platform } from 'react-native';
import NotificationsScreen from '../NotificationsScreen';
import { AppNotification } from '../../utils/storage';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onDeleteNotification?: (id: string) => void;
  onActionClick?: (notification: AppNotification) => void;
}

/**
 * NotificationsModal is a thin modal wrapper around NotificationsScreen.
 * Eliminates duplicate code and maintains a single source of truth for Notifications UI.
 */
export default function NotificationsModal({
  visible,
  onClose,
  notifications = [],
  onMarkAllAsRead,
  onClearAll,
  onDeleteNotification,
  onActionClick,
}: NotificationsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === "web" ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <NotificationsScreen
        notifications={notifications}
        onMarkAllAsRead={onMarkAllAsRead}
        onClearAll={onClearAll}
        onDeleteNotification={onDeleteNotification}
        onActionClick={onActionClick}
        onBack={onClose}
      />
    </Modal>
  );
}
