import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FastArtLogo from './FastArtLogo';
import { soundEngine } from '../utils/audioEngine';
import {
  clearAppCache,
  exportAllAppData,
  importAllAppData,
  resetAllAppData,
} from '../utils/storage';

interface SettingsScreenProps {
  settings: any;
  onUpdateSettings: (newSettings: any) => void;
  onBack: () => void;
  onReloadData?: () => void;
}

export default function SettingsScreen({
  settings,
  onUpdateSettings,
  onBack,
  onReloadData,
}: SettingsScreenProps) {
  const [localSettings, setLocalSettings] = useState(settings || {});
  const [cacheClearedMsg, setCacheClearedMsg] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const toggleSwitch = (key: string) => {
    soundEngine.playSfx('click');
    const updated = { ...localSettings, [key]: !localSettings[key] };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const setOption = (key: string, val: any) => {
    soundEngine.playSfx('click');
    const updated = { ...localSettings, [key]: val };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const handleClearCache = () => {
    soundEngine.playSfx('split');
    clearAppCache();
    const updated = { ...localSettings, cachedSizeMb: 0.0 };
    setLocalSettings(updated);
    onUpdateSettings(updated);
    setCacheClearedMsg(true);
    setTimeout(() => setCacheClearedMsg(false), 3000);
  };

  const handleExportBackup = () => {
    soundEngine.playSfx('pop');
    try {
      const json = exportAllAppData();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fastart_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatusMsg({ type: 'success', text: 'All projects & settings exported to backup file!' });
      } else {
        setStatusMsg({ type: 'success', text: 'Backup data generated successfully!' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Could not export backup.' });
    }
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleImportBackup = () => {
    soundEngine.playSfx('click');
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
              const ok = importAllAppData(content);
              if (ok) {
                soundEngine.playSfx('pop');
                setStatusMsg({ type: 'success', text: 'Projects and settings restored successfully!' });
                onReloadData?.();
              } else {
                setStatusMsg({ type: 'error', text: 'Invalid backup file format.' });
              }
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    } else {
      setStatusMsg({ type: 'error', text: 'Import file picker available on Web.' });
    }
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleConfirmReset = () => {
    soundEngine.playSfx('split');
    resetAllAppData();
    setShowResetConfirm(false);
    setStatusMsg({ type: 'success', text: 'All app data reset to factory defaults.' });
    onReloadData?.();
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const resolutions = ['720p', '1080p', '2K/4K'];
  const frameRates = [24, 30, 60];
  const aspectRatios = ['9:16', '16:9', '1:1'];

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            soundEngine.playSfx('click');
            onBack();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.navTitle}>Settings</Text>

        <View style={styles.navRight}>
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.innerWrapper}>
          {/* App Profile Card */}
          <View style={styles.profileCard}>
            <FastArtLogo size={52} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.profileTitle}>FastArt Pro Studio</Text>
                <View style={styles.proTag}>
                  <Text style={styles.proTagText}>PRO ACTIVE</Text>
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
          <Text style={styles.sectionHeader}>EDITING & TIMELINE PREFERENCES</Text>

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
              <Text style={styles.toggleTitle}>Interface Sound Effects (SFX)</Text>
              <Text style={styles.toggleSubtitle}>Play acoustic clicks, pops, and whooshes</Text>
            </View>
            <Switch
              value={localSettings.soundEffects !== false}
              onValueChange={() => toggleSwitch('soundEffects')}
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

          {/* DATA PERSISTENCE & BACKUP */}
          <Text style={styles.sectionHeader}>DATA PERSISTENCE & BACKUP</Text>

          <View style={styles.persistenceCard}>
            <View style={styles.persistenceHeader}>
              <View style={styles.persistenceIconBox}>
                <Ionicons name="shield-checkmark" size={22} color="#00F2FE" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.persistenceTitle}>Persistent Storage Engine</Text>
                <Text style={styles.persistenceSubtitle}>
                  {Platform.OS === 'web'
                    ? 'Browser LocalStorage & Fast In-Memory Sync (Active)'
                    : 'Mobile File System Persistent Sandbox (Active)'}
                </Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>SYNCED</Text>
              </View>
            </View>

            <View style={styles.persistenceButtons}>
              <TouchableOpacity
                style={styles.backupBtn}
                onPress={handleExportBackup}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={16} color="#000000" />
                <Text style={styles.backupBtnText}>Export Backup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={handleImportBackup}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={16} color="#00F2FE" />
                <Text style={styles.restoreBtnText}>Import Backup</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => setShowResetConfirm(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color="#FF0050" />
              <Text style={styles.resetBtnText}>Reset All App Data</Text>
            </TouchableOpacity>
          </View>

          {statusMsg && (
            <View
              style={[
                styles.toast,
                statusMsg.type === 'error' && {
                  backgroundColor: 'rgba(255, 0, 80, 0.15)',
                  borderColor: '#FF0050',
                },
              ]}
            >
              <Ionicons
                name={statusMsg.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
                size={16}
                color={statusMsg.type === 'error' ? '#FF0050' : '#10B981'}
              />
              <Text
                style={[
                  styles.toastText,
                  statusMsg.type === 'error' && { color: '#FF0050' },
                ]}
              >
                {statusMsg.text}
              </Text>
            </View>
          )}

          {/* ABOUT & SYSTEM */}
          <Text style={styles.sectionHeader}>ABOUT & SYSTEM</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rendering Engine</Text>
            <Text style={styles.infoVal}>WebCodecs / Canvas 2D / WebGL2</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoVal}>{Platform.OS.toUpperCase()} Single Codebase</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Performance</Text>
            <Text style={styles.infoVal}>60 FPS Hardware-Accelerated</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0, marginBottom: 40 }]}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoVal}>1.0.0 (Production Build)</Text>
          </View>
        </View>
      </ScrollView>

      {/* Reset Confirmation Modal */}
      <Modal visible={showResetConfirm} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="warning" size={32} color="#FF0050" />
            </View>
            <Text style={styles.confirmTitle}>Reset All FastArt Data?</Text>
            <Text style={styles.confirmMessage}>
              This will delete all saved projects, uploaded media, custom audio, and restore factory default settings. This action cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowResetConfirm(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={handleConfirmReset}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteConfirmBtnText}>Reset Everything</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D13',
  },
  navBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
    backgroundColor: '#0E1118',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  navTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  navRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  proBadge: {
    backgroundColor: '#FFE600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  proText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 16,
  },
  innerWrapper: {
    width: '100%',
    maxWidth: 720,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141721',
    padding: 18,
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  profileTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  profileSubtitle: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 3,
  },
  profileMeta: {
    color: '#00F2FE',
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginTop: 4,
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
    marginTop: 18,
    marginBottom: 10,
  },
  settingCard: {
    backgroundColor: '#141721',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  choicePill: {
    flex: 1,
    backgroundColor: '#10131A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  choicePillActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  choiceText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141721',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
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
    marginTop: 3,
  },
  storageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141721',
    padding: 14,
    borderRadius: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    marginTop: 10,
    gap: 8,
  },
  toastText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
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
  persistenceCard: {
    backgroundColor: '#141721',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 10,
  },
  persistenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  persistenceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
  },
  persistenceTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  persistenceSubtitle: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  persistenceButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F2FE',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  backupBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  restoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: '#00F2FE',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  restoreBtnText: {
    color: '#00F2FE',
    fontSize: 13,
    fontWeight: '800',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 0, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 80, 0.3)',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  resetBtnText: {
    color: '#FF0050',
    fontSize: 12,
    fontWeight: '700',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#141721',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#252B3B',
    alignItems: 'center',
  },
  confirmIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 0, 80, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 80, 0.3)',
  },
  confirmTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmMessage: {
    color: '#8E95A5',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 22,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1E2333',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteConfirmBtn: {
    flex: 1,
    backgroundColor: '#FF0050',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
