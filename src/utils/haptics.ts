import { Platform, Vibration } from 'react-native';

export type HapticType = 'light' | 'medium' | 'selection' | 'success' | 'warning';

/**
 * Universal cross-platform haptic feedback helper
 * Works on Mobile (iOS / Android) and Web (Navigator Vibration API)
 */
export const triggerHaptic = (
  type: HapticType = 'light',
  enabled: boolean = true
): void => {
  if (!enabled) return;

  try {
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        if (type === 'selection') {
          navigator.vibrate(8);
        } else if (type === 'light') {
          navigator.vibrate(12);
        } else if (type === 'medium') {
          navigator.vibrate(22);
        } else if (type === 'warning') {
          navigator.vibrate([15, 30, 15]);
        } else {
          navigator.vibrate(15);
        }
      }
    } else {
      if (type === 'selection') {
        Vibration.vibrate(10);
      } else if (type === 'medium') {
        Vibration.vibrate(25);
      } else if (type === 'warning') {
        Vibration.vibrate(35);
      } else {
        Vibration.vibrate(15);
      }
    }
  } catch (e) {
    // Ignore environments where vibration is unavailable or blocked by permissions
  }
};
