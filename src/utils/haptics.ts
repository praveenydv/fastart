import { Platform, Vibration } from 'react-native';

export type HapticType = 'light' | 'medium' | 'selection' | 'success' | 'warning';

// Global timestamp to prevent hardware motor rattling and loud buzzing noise on mobile devices
let lastHapticTimestamp = 0;
const HAPTIC_MIN_INTERVAL_MS = 100;

/**
 * Universal cross-platform haptic feedback helper
 * Works on Mobile (iOS / Android) and Web (Navigator Vibration API)
 * Automatically throttles rapid requests to prevent haptic motor chatter/noise.
 */
export const triggerHaptic = (
  type: HapticType = 'light',
  enabled: boolean = true,
  force: boolean = false
): void => {
  if (!enabled) return;

  const now = Date.now();
  if (!force && now - lastHapticTimestamp < HAPTIC_MIN_INTERVAL_MS) {
    return;
  }
  lastHapticTimestamp = now;

  try {
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        if (type === 'selection') {
          navigator.vibrate(6);
        } else if (type === 'light') {
          navigator.vibrate(10);
        } else if (type === 'medium') {
          navigator.vibrate(18);
        } else if (type === 'warning') {
          navigator.vibrate([12, 24, 12]);
        } else {
          navigator.vibrate(12);
        }
      }
    } else {
      if (type === 'selection') {
        Vibration.vibrate(8);
      } else if (type === 'medium') {
        Vibration.vibrate(20);
      } else if (type === 'warning') {
        Vibration.vibrate(30);
      } else {
        Vibration.vibrate(12);
      }
    }
  } catch (_e) {
    // Ignore environments where vibration is unavailable or blocked by permissions
  }
};
