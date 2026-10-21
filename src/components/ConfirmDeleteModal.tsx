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
    callback();

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
                      color="#00F2FE"
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
    backgroundColor: 'rgba(5, 7, 12, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  card: {
    position: 'relative',
    zIndex: 10,
    width: 360,
    maxWidth: '92%',
    backgroundColor: '#141721',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#252B3B',
    alignItems: 'center',
    shadowColor: '#FF0050',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconContainer: {
    marginBottom: 14,
  },
  iconPulse: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 0, 80, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 0, 80, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    color: '#8E95A5',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  itemBox: {
    width: '100%',
    backgroundColor: '#0B0D13',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 14,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: 'rgba(0, 242, 254, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeIcon: {
    marginRight: 4,
  },
  typeBadgeText: {
    color: '#00F2FE',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemDetailsText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  itemNameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#8E95A5',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#FF0050',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF0050',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
