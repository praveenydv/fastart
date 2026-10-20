import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SAMPLE_AUDIO, SOUND_EFFECTS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

export default function AudioModal({ visible, onClose, onAddAudio }) {
  const [activeTab, setActiveTab] = useState('music');
  const [playingId, setPlayingId] = useState(null);
  const [audioEl, setAudioEl] = useState(null);

  const togglePreview = (item) => {
    if (playingId === item.id) {
      if (audioEl) {
        audioEl.pause();
      }
      setPlayingId(null);
    } else {
      if (audioEl) {
        audioEl.pause();
      }
      if (Platform.OS === 'web') {
        const a = new Audio(item.url);
        a.play().catch(() => {});
        a.onended = () => setPlayingId(null);
        setAudioEl(a);
      }
      soundEngine.playSfx(item.icon === 'flash' ? 'whoosh' : item.icon === 'cut' ? 'split' : 'click');
      setPlayingId(item.id);
    }
  };

  const handleSelectAudio = (item) => {
    if (audioEl) audioEl.pause();
    const audioClip = {
      id: 'clip-a-' + Date.now(),
      title: item.title,
      artist: item.artist || 'CapCut',
      duration: item.duration || 10.0,
      startTime: 0,
      trimIn: 0,
      trimOut: item.duration || 10.0,
      volume: 0.9,
      url: item.url,
    };
    soundEngine.playSfx('pop');
    onAddAudio(audioClip);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'music' && styles.tabBtnActive]}
                onPress={() => setActiveTab('music')}
              >
                <Text style={[styles.tabText, activeTab === 'music' && styles.tabTextActive]}>
                  Music
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'sfx' && styles.tabBtnActive]}
                onPress={() => setActiveTab('sfx')}
              >
                <Text style={[styles.tabText, activeTab === 'sfx' && styles.tabTextActive]}>
                  Sound Effects
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            {activeTab === 'music' && (
              <>
                <Text style={styles.sectionTitle}>AUTHENTIC SOUNDTRACKS</Text>
                {SAMPLE_AUDIO.map((item) => (
                  <View key={item.id} style={styles.audioRow}>
                    <TouchableOpacity
                      style={styles.playIconBtn}
                      onPress={() => togglePreview(item)}
                    >
                      <Ionicons
                        name={playingId === item.id ? 'pause' : 'play'}
                        size={18}
                        color="#10B981"
                      />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.audioTitle}>{item.title}</Text>
                      <Text style={styles.audioMeta}>
                        {item.artist} • {item.bpm} BPM • {item.duration}s
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.usePill}
                      onPress={() => handleSelectAudio(item)}
                    >
                      <Text style={styles.usePillText}>Use</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {activeTab === 'sfx' && (
              <>
                <Text style={styles.sectionTitle}>POPULAR SOUND EFFECTS</Text>
                {SOUND_EFFECTS.map((item) => (
                  <View key={item.id} style={styles.audioRow}>
                    <TouchableOpacity
                      style={styles.playIconBtn}
                      onPress={() => togglePreview(item)}
                    >
                      <Ionicons
                        name={playingId === item.id ? 'pause' : 'play'}
                        size={18}
                        color="#00F2FE"
                      />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.audioTitle}>{item.title}</Text>
                      <Text style={styles.audioMeta}>{item.duration}s duration</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.usePill, { backgroundColor: '#00F2FE' }]}
                      onPress={() => handleSelectAudio(item)}
                    >
                      <Text style={[styles.usePillText, { color: '#000000' }]}>Use</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
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
    maxHeight: '75%',
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0B0D13',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#1E2333',
  },
  tabText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    padding: 16,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10131A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  playIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A2130',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  audioMeta: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  usePill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  usePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
