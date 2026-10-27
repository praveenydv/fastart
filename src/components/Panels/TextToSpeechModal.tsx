import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  initialScript?: string;
  isInline?: boolean;
}

export default function TextToSpeechModal({
  visible,
  onClose,
  onAddAudio,
  initialScript,
  isInline = false,
}: TextToSpeechModalProps) {
  const [script, setScript] = useState('Welcome to FastArt Pro, the ultimate video editing studio.');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);
  const [pitch, setPitch] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (visible && initialScript && initialScript.trim()) {
      setScript(initialScript.trim());
    }
  }, [visible, initialScript]);

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

  const sheetContent = (
    <View style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Unified Live Header */}
      <View style={styles.sheetHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="mic" size={16} color="#00F2FE" />
          <Text style={styles.sheetTitle}>AI Voice Generator</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={handleUseVoiceover}
            style={[
              {
                paddingHorizontal: 10,
                height: 24,
                borderRadius: 6,
                backgroundColor: '#00F2FE',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              },
              !script.trim() && { opacity: 0.4 },
            ]}
            disabled={!script.trim()}
            activeOpacity={0.7}
            accessibilityLabel="Add Voice to Track"
          >
            <Ionicons name="add" size={13} color="#08090E" />
            <Text style={{ color: '#08090E', fontSize: 10.5, fontWeight: '700' }}>
              Add to Track
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
            accessibilityLabel="Close panel"
          >
            <Ionicons name="close" size={14} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Script</Text>
            <TextInput
              style={styles.scriptInput}
              value={script}
              onChangeText={setScript}
              multiline
              numberOfLines={4}
              placeholder="Enter text to convert into natural speech..."
              placeholderTextColor="#6B7280"
            />

            <Text style={styles.sectionTitle}>Voices</Text>
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

            <Text style={styles.sectionTitle}>Speed</Text>
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
                  {isSpeaking ? 'Stop' : 'Preview'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.useBtn} onPress={handleUseVoiceover}>
                <Ionicons name="add-circle" size={20} color="#000000" />
                <Text style={styles.useBtnText}>Add Voice</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0F131D',
  },
  inlineSheetContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    borderTopWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
    backgroundColor: '#08090E',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  scriptInput: {
    backgroundColor: '#08090E',
    borderRadius: 8,
    padding: 8,
    color: '#FFFFFF',
    fontSize: 11.5,
    minHeight: 52,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#1F2637',
    marginBottom: 8,
  },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#08090E',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2637',
    marginRight: 6,
    gap: 4,
  },
  voicePillActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  voiceName: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  voiceNameActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  rateRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  choicePill: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#08090E',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  choicePillActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  choiceText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  choiceTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 5,
  },
  previewBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  previewBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  useBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F2FE',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 5,
  },
  useBtnText: {
    color: '#08090E',
    fontSize: 11,
    fontWeight: '700',
  },
});
