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
    callback();

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
    maxWidth: 340,
    backgroundColor: '#121622',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E2638',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 2,
  },
  iconContainer: {
    marginBottom: 14,
  },
  iconPulse: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    color: '#8E95A5',
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  projectBox: {
    width: '100%',
    backgroundColor: '#0A0D15',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#182030',
    marginBottom: 12,
  },
  projectTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '75%',
  },
  projectBadgeIcon: {
    marginRight: 4,
  },
  projectBadgeText: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  ratioBadge: {
    backgroundColor: '#161D2B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratioBadgeText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '500',
  },
  saveBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 18,
  },
  saveBannerText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  buttonsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#181F2E',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#242F46',
  },
  cancelButtonText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1.2,
    flexDirection: 'row',
    backgroundColor: '#00F2FE',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default ConfirmExitModal;
