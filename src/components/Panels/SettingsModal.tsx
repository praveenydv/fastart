import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FastArtLogo from '../FastArtLogo';
import { soundEngine } from '../../utils/audioEngine';

export default function SettingsModal({
  visible,
  onClose,
  settings,
  onUpdateSettings,
}) {
  const [localSettings, setLocalSettings] = useState(settings || {});
  const [cacheClearedMsg, setCacheClearedMsg] = useState(false);

  const toggleSwitch = (key) => {
    soundEngine.playSfx('click');
    const updated = { ...localSettings, [key]: !localSettings[key] };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const setOption = (key, val) => {
    soundEngine.playSfx('click');
    const updated = { ...localSettings, [key]: val };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const handleClearCache = () => {
    soundEngine.playSfx('split');
    const updated = { ...localSettings, cachedSizeMb: 0.0 };
    setLocalSettings(updated);
    onUpdateSettings(updated);
    setCacheClearedMsg(true);
    setTimeout(() => setCacheClearedMsg(false), 3000);
  };

  const resolutions = ['720p', '1080p', '2K/4K'];
  const frameRates = [24, 30, 60];
  const aspectRatios = ['9:16', '16:9', '1:1'];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>FastArt Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* App Profile Card */}
            <View style={styles.profileCard}>
              <FastArtLogo size={48} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.profileTitle}>FastArt Pro Studio</Text>
                  <View style={styles.proTag}>
                    <Text style={styles.proTagText}>PRO</Text>
                  </View>
                </View>
                <Text style={styles.profileSubtitle}>v1.0.0 • Hardware Acceleration Enabled</Text>
              </View>
            </View>

            {/* DEFAULT EXPORT SETTINGS */}
            <Text style={styles.sectionHeader}>DEFAULT EXPORT SETTINGS</Text>

            <View style={styles.settingCard}>
              <Text style={styles.settingLabel}>Default Resolution</Text>
              <View style={styles.pillGroup}>
                {resolutions.map((res) => (
                  <TouchableOpacity
                    key={res}
                    style={[
                      styles.choicePill,
                      localSettings.defaultResolution === res && styles.choicePillActive,
                    ]}
                    onPress={() => setOption('defaultResolution', res)}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        localSettings.defaultResolution === res && styles.choiceTextActive,
                      ]}
                    >
                      {res}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingCard}>
              <Text style={styles.settingLabel}>Default Frame Rate</Text>
              <View style={styles.pillGroup}>
                {frameRates.map((fps) => (
                  <TouchableOpacity
                    key={fps}
                    style={[
                      styles.choicePill,
                      localSettings.defaultFps === fps && styles.choicePillActive,
                    ]}
                    onPress={() => setOption('defaultFps', fps)}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        localSettings.defaultFps === fps && styles.choiceTextActive,
                      ]}
                    >
                      {fps} FPS
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingCard}>
              <Text style={styles.settingLabel}>Default Aspect Ratio</Text>
              <View style={styles.pillGroup}>
                {aspectRatios.map((ratio) => (
                  <TouchableOpacity
                    key={ratio}
                    style={[
                      styles.choicePill,
                      localSettings.defaultAspectRatio === ratio && styles.choicePillActive,
                    ]}
                    onPress={() => setOption('defaultAspectRatio', ratio)}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        localSettings.defaultAspectRatio === ratio && styles.choiceTextActive,
                      ]}
                    >
                      {ratio}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* EDITING & TIMELINE PREFERENCES */}
            <Text style={styles.sectionHeader}>EDITING & TIMELINE</Text>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleTitle}>Magnetic Timeline Snapping</Text>
                <Text style={styles.toggleSubtitle}>
                  Snap playhead to clip cuts, audio beats, and text keyframes
                </Text>
              </View>
              <Switch
                value={localSettings.magneticSnapping !== false}
                onValueChange={() => toggleSwitch('magneticSnapping')}
                trackColor={{ false: '#334155', true: '#00F2FE' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleTitle}>Haptic Feedback on Cuts</Text>
                <Text style={styles.toggleSubtitle}>Vibrate when splitting or snapping clips</Text>
              </View>
              <Switch
                value={localSettings.hapticFeedback !== false}
                onValueChange={() => toggleSwitch('hapticFeedback')}
                trackColor={{ false: '#334155', true: '#00F2FE' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleTitle}>Auto Add Default Ending</Text>
                <Text style={styles.toggleSubtitle}>Attach FastArt logo outro to new projects</Text>
              </View>
              <Switch
                value={localSettings.autoAddEnding === true}
                onValueChange={() => toggleSwitch('autoAddEnding')}
                trackColor={{ false: '#334155', true: '#00F2FE' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* STORAGE & CACHE */}
            <Text style={styles.sectionHeader}>STORAGE & CACHE</Text>

            <View style={styles.storageCard}>
              <View style={styles.storageLeft}>
                <Ionicons name="server-outline" size={24} color="#00F2FE" />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.storageTitle}>Temporary Cache</Text>
                  <Text style={styles.storageMeta}>
                    {(localSettings.cachedSizeMb || 0).toFixed(1)} MB currently cached
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.clearCacheBtn} onPress={handleClearCache}>
                <Text style={styles.clearCacheText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {cacheClearedMsg && (
              <View style={styles.toast}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.toastText}>Cache cleared successfully!</Text>
              </View>
            )}

            {/* ABOUT & INFO */}
            <Text style={styles.sectionHeader}>ABOUT</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Engine</Text>
              <Text style={styles.infoVal}>WebCodecs / Canvas 2D / WebGPU</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoVal}>{Platform.OS.toUpperCase()} Single Codebase</Text>
            </View>
            <View style={[styles.infoRow, { marginBottom: 30 }]}>
              <Text style={styles.infoLabel}>Architecture</Text>
              <Text style={styles.infoVal}>60 FPS Multi-Threaded</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10131A',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 20,
  },
  profileTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  profileSubtitle: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  proTag: {
    backgroundColor: '#FFE600',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proTagText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },
  sectionHeader: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 12,
  },
  settingCard: {
    backgroundColor: '#10131A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  choicePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choicePillActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
  },
  choiceText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: '#00F2FE',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#10131A',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSubtitle: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  storageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#10131A',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  storageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  storageMeta: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  clearCacheBtn: {
    backgroundColor: 'rgba(255, 0, 80, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF0050',
  },
  clearCacheText: {
    color: '#FF0050',
    fontSize: 12,
    fontWeight: '800',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    marginTop: 8,
    gap: 8,
  },
  toastText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  infoLabel: {
    color: '#8E95A5',
    fontSize: 13,
  },
  infoVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
