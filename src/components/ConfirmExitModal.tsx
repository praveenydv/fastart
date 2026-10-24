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
import { FastArtProject } from '../types/project';

export interface ConfirmExitModalProps {
  visible: boolean;
  project?: FastArtProject | null;
  totalDuration?: number;
  onConfirmExit: () => void;
  onCancel: () => void;
}

export const ConfirmExitModal: React.FC<ConfirmExitModalProps> = ({
  visible,
  project,
  totalDuration = 0,
  onConfirmExit,
  onCancel,
}) => {
  const [modalVisible, setModalVisible] = useState(visible);
  const isClosingRef = useRef(false);

  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  // Cache display props so they never flicker during exit animation
  const cachedProps = useRef({
    title: project?.title || 'Project',
    duration: totalDuration,
    aspectRatio: project?.aspectRatio || '9:16',
  });

  if (visible) {
    cachedProps.current = {
      title: project?.title || 'Project',
      duration: totalDuration,
      aspectRatio: project?.aspectRatio || '9:16',
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
        duration: 140,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 140,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setModalVisible(false);
      isClosingRef.current = false;
      callback();
    });
  };

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    closeWithAnimation(onCancel);
  };

  const handleConfirm = () => {
    soundEngine.playSfx('whoosh');
    closeWithAnimation(onConfirmExit);
  };

  if (!modalVisible && !visible) {
    return null;
  }

  const formatSec = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const current = cachedProps.current;

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

        {/* Modal Card with spring scale */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Home / Exit Icon Badge */}
          <View style={styles.iconContainer}>
            <View style={styles.iconPulse}>
              <Ionicons name="home-outline" size={26} color="#00F2FE" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Exit to Home?</Text>

          {/* Message */}
          <Text style={styles.message}>
            Do you want to save your progress and return to the projects dashboard?
          </Text>

          {/* Project Summary Box */}
          <View style={styles.projectBox}>
            <View style={styles.projectTopRow}>
              <View style={styles.projectBadge}>
                <Ionicons
                  name="film-outline"
                  size={12}
                  color="#00F2FE"
                  style={styles.projectBadgeIcon}
                />
                <Text style={styles.projectBadgeText} numberOfLines={1}>
                  {current.title}
                </Text>
              </View>

              <View style={styles.ratioBadge}>
                <Text style={styles.ratioBadgeText}>{current.aspectRatio}</Text>
              </View>
            </View>

            <View style={styles.durationRow}>
              <Ionicons name="time-outline" size={12} color="#8E95A5" />
              <Text style={styles.durationText}>
                Duration: {formatSec(current.duration)}
              </Text>
            </View>
          </View>

          {/* Auto-save Guarantee Banner */}
          <View style={styles.saveBanner}>
            <Ionicons name="checkmark-circle-outline" size={15} color="#10B981" />
            <Text style={styles.saveBannerText}>
              All edits are automatically saved to your library.
            </Text>
          </View>

          {/* Buttons Row */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelButtonText}>Keep Editing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name="exit-outline" size={16} color="#000000" />
              <Text style={styles.confirmButtonText}>Exit to Home</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#18181C',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272F',
    alignItems: 'center',
    zIndex: 2,
  },
  iconContainer: {
    marginBottom: 12,
  },
  iconPulse: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#202026',
    borderWidth: 1,
    borderColor: '#27272F',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  projectBox: {
    width: '100%',
    backgroundColor: '#121215',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#27272F',
    marginBottom: 12,
  },
  projectTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '75%',
  },
  projectBadgeIcon: {
    marginRight: 4,
  },
  projectBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  ratioBadge: {
    backgroundColor: '#202026',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratioBadgeText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '500',
  },
  saveBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: '#27272F',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 16,
  },
  saveBannerText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  buttonsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#202026',
    borderRadius: 8,
    paddingVertical: 10,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default ConfirmExitModal;
