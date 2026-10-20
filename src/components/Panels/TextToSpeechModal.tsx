import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { AudioClip } from '../../types/project';

interface TextToSpeechModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAudio: (clip: AudioClip) => void;
}

export default function TextToSpeechModal({
  visible,
  onClose,
  onAddAudio,
}: TextToSpeechModalProps) {
  const [script, setScript] = useState('Welcome to FastArt Pro, the ultimate video editing studio.');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);
  const [pitch, setPitch] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const available = window.speechSynthesis.getVoices();
        if (available.length > 0) {
          setVoices(available);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handlePreview = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    if (voices[selectedVoiceIdx]) {
      utterance.voice = voices[selectedVoiceIdx];
    }
    utterance.pitch = pitch;
    utterance.rate = rate;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    soundEngine.playSfx('click');
    window.speechSynthesis.speak(utterance);
  };

  const handleUseVoiceover = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Estimate spoken duration based on word count (~150 words per minute at 1.0 rate)
    const words = script.trim().split(/\s+/).length;
    const estimatedDuration = Math.max(2.0, Math.round(((words / 150) * 60) / rate * 10) / 10);

    const voiceName = voices[selectedVoiceIdx]?.name || 'AI Voice';
    const clip: AudioClip = {
      id: 'clip-tts-' + Date.now(),
      title: `TTS: ${script.slice(0, 18)}...`,
      artist: voiceName,
      duration: estimatedDuration,
      startTime: 0,
      trimIn: 0,
      trimOut: estimatedDuration,
      volume: 1.0,
      url: '/assets/media/audio/viral_phonk.wav', // fallback playback asset
    };

    soundEngine.playSfx('pop');
    onAddAudio(clip);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="mic" size={20} color="#00F2FE" />
              <Text style={styles.sheetTitle}>AI Text to Speech</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>SCRIPT TO SPEAK</Text>
            <TextInput
              style={styles.scriptInput}
              value={script}
              onChangeText={setScript}
              multiline
              numberOfLines={4}
              placeholder="Enter text to convert into natural speech..."
              placeholderTextColor="#6B7280"
            />

            <Text style={styles.sectionTitle}>SELECT AI VOICE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {(voices.length > 0 ? voices.slice(0, 10) : [{ name: 'Default AI Voice', lang: 'en-US' }]).map(
                (v: any, idx) => {
                  const isSelected = selectedVoiceIdx === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.voicePill, isSelected && styles.voicePillActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setSelectedVoiceIdx(idx);
                      }}
                    >
                      <Ionicons
                        name="person-circle-outline"
                        size={16}
                        color={isSelected ? '#00F2FE' : '#8E95A5'}
                      />
                      <Text
                        style={[styles.voiceName, isSelected && styles.voiceNameActive]}
                        numberOfLines={1}
                      >
                        {v.name.slice(0, 16)}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>

            <Text style={styles.sectionTitle}>SPEED (RATE)</Text>
            <View style={styles.rateRow}>
              {[0.75, 1.0, 1.25, 1.5].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.choicePill, rate === r && styles.choicePillActive]}
                  onPress={() => setRate(r)}
                >
                  <Text style={[styles.choiceText, rate === r && styles.choiceTextActive]}>
                    {r}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.previewBtn, isSpeaking && styles.previewBtnActive]}
                onPress={handlePreview}
              >
                <Ionicons
                  name={isSpeaking ? 'stop-circle' : 'volume-high'}
                  size={20}
                  color={isSpeaking ? '#FF0050' : '#FFFFFF'}
                />
                <Text style={styles.previewBtnText}>
                  {isSpeaking ? 'Stop Preview' : 'Listen Preview'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.useBtn} onPress={handleUseVoiceover}>
                <Ionicons name="add-circle" size={20} color="#000000" />
                <Text style={styles.useBtnText}>Add to Project</Text>
              </TouchableOpacity>
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
    maxHeight: '80%',
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
    fontSize: 16,
    fontWeight: '700',
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
    marginBottom: 8,
  },
  scriptInput: {
    backgroundColor: '#10131A',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 16,
  },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10131A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginRight: 8,
    gap: 6,
  },
  voicePillActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1E2333',
  },
  voiceName: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  voiceNameActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  rateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  choicePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#10131A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  choicePillActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1E2333',
  },
  choiceText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: '#00F2FE',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2333',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  previewBtnActive: {
    backgroundColor: 'rgba(255, 0, 80, 0.15)',
    borderWidth: 1,
    borderColor: '#FF0050',
  },
  previewBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  useBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F2FE',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  useBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
