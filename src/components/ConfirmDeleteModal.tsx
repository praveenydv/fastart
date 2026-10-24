import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../utils/audioEngine';

export interface ConfirmDeleteModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  itemType?: string;
  itemDetails?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  visible,
  title = 'Delete Confirmation',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  itemName,
  itemType,
  itemDetails,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  const [modalVisible, setModalVisible] = useState(visible);
  const isClosingRef = useRef(false);

  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  // Cache display props so they never vanish or shrink the card during exit animation
  const cachedProps = useRef({
    title,
    message,
    itemName,
    itemType,
    itemDetails,
    confirmText,
    cancelText,
  });

  if (visible) {
    cachedProps.current = {
      title,
      message,
      itemName,
      itemType,
      itemDetails,
      confirmText,
      cancelText,
    };
  }

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setModalVisible(true);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 110,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else if (modalVisible && !isClosingRef.current) {
      closeWithAnimation(() => {});
    }
  }, [visible]);

  const closeWithAnimation = (callback: () => void) => {
    if (isClosingRef.current) {
      callback();
      return;
    }
    isClosingRef.current = true;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setModalVisible(false);
      isClosingRef.current = false;
      callback();
    });
  };

  const handleCancel = () => {
    soundEngine.playSfx('click');
    onCancel();
    setModalVisible(false);
  };

  const handleConfirm = () => {
    soundEngine.playSfx('pop');
    onConfirm();
    setModalVisible(false);
  };

  if (!modalVisible) return null;

  const current = cachedProps.current;
  const typeLower = (current.itemType || '').toLowerCase();
  const typeIcon: keyof typeof Ionicons.glyphMap =
    typeLower.includes('video')
      ? 'videocam-outline'
      : typeLower.includes('audio')
      ? 'musical-notes-outline'
      : typeLower.includes('text')
      ? 'text-outline'
      : typeLower.includes('sticker')
      ? 'happy-outline'
      : 'folder-outline';

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Backdrop touch to cancel */}
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
          activeOpacity={1}
          onPress={handleCancel}
        />

        {/* Modal Card with spring scale & stable geometry */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Danger Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconPulse}>
              <Ionicons name="trash-outline" size={26} color="#FF0050" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{current.title}</Text>

          {/* Message */}
          <Text style={styles.message}>{current.message}</Text>

          {/* Item Highlight Box (Solid width, never shrinks or jumps) */}
          {(current.itemName || current.itemType || current.itemDetails) ? (
            <View style={styles.itemBox}>
              <View style={styles.itemTopRow}>
                {current.itemType ? (
                  <View style={styles.typeBadge}>
                    <Ionicons
                      name={typeIcon}
                      size={12}
                      color="#FFFFFF"
                      style={styles.typeBadgeIcon}
                    />
                    <Text style={styles.typeBadgeText}>
                      {current.itemType.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                {current.itemDetails ? (
                  <Text style={styles.itemDetailsText}>
                    {current.itemDetails}
                  </Text>
                ) : null}
              </View>

              {current.itemName ? (
                <Text style={styles.itemNameText} numberOfLines={2}>
                  {current.itemName}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
            <Text style={styles.warningText}>This action cannot be undone.</Text>
          </View>

          {/* Buttons Row */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelButtonText}>{current.cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name="trash" size={16} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>{current.confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ConfirmDeleteModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  card: {
    position: 'relative',
    zIndex: 10,
    width: 320,
    maxWidth: '92%',
    backgroundColor: '#18181C',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272F',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 10,
  },
  iconPulse: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  message: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  itemBox: {
    width: '100%',
    backgroundColor: '#121215',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#27272F',
    marginBottom: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeIcon: {
    marginRight: 4,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  itemDetailsText: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '500',
  },
  itemNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#27272F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 14,
    width: '100%',
    justifyContent: 'center',
  },
  warningText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#202026',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
