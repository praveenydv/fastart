import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TEXT_TEMPLATES } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

export default function TextModal({ visible, onClose, onAddText }) {
  const [inputText, setInputText] = useState('VIRAL HOOK');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [selectedBg, setSelectedBg] = useState('#FF0050');
  const [selectedAnim, setSelectedAnim] = useState('bounce');

  const colorSwatches = ['#FFFFFF', '#FFE600', '#00F2FE', '#FF0050', '#10B981', '#F59E0B', '#000000'];
  const bgSwatches = ['transparent', '#FF0050', 'rgba(0,0,0,0.7)', '#00F2FE', '#E50914', '#1E2333'];
  const animations = [
    { id: 'bounce', label: 'Bounce In' },
    { id: 'typewriter', label: 'Typewriter' },
    { id: 'fade', label: 'Fade In' },
    { id: 'slideUp', label: 'Slide Up' },
  ];

  const handleApplyTemplate = (tmpl) => {
    setInputText(tmpl.text);
    setSelectedColor(tmpl.style?.color || '#FFFFFF');
    setSelectedBg(tmpl.style?.backgroundColor || 'transparent');
    setSelectedAnim(tmpl.animation || 'fade');
    soundEngine.playSfx('click');
  };

  const handleSave = () => {
    if (!inputText.trim()) return;
    const textClip = {
      id: 'clip-t-' + Date.now(),
      text: inputText,
      startTime: 1.0,
      duration: 4.0,
      position: { x: 50, y: 30 },
      scale: 1.0,
      rotation: 0,
      animation: selectedAnim,
      style: {
        color: selectedColor,
        fontSize: 24,
        fontWeight: '800',
        backgroundColor: selectedBg,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        textAlign: 'center',
      },
    };
    soundEngine.playSfx('pop');
    onAddText(textClip);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Add Text</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            {/* Input Box */}
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Enter text..."
              placeholderTextColor="#6B7280"
              autoFocus
            />

            {/* Live Text Preview Box */}
            <View style={styles.previewBox}>
              <Text
                style={[
                  styles.previewText,
                  {
                    color: selectedColor,
                    backgroundColor: selectedBg,
                  },
                ]}
              >
                {inputText || 'Preview'}
              </Text>
            </View>

            {/* Quick Templates */}
            <Text style={styles.sectionTitle}>CAPCUT TEMPLATES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {TEXT_TEMPLATES.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={styles.templatePill}
                  onPress={() => handleApplyTemplate(tmpl)}
                >
                  <Text style={styles.templatePillText}>{tmpl.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Color Swatches */}
            <Text style={styles.sectionTitle}>TEXT COLOR</Text>
            <View style={styles.swatchRow}>
              {colorSwatches.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    selectedColor === c && styles.swatchActive,
                  ]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>

            {/* Background Color Swatches */}
            <Text style={styles.sectionTitle}>BACKGROUND BOX</Text>
            <View style={styles.swatchRow}>
              {bgSwatches.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[
                    styles.swatch,
                    { backgroundColor: b === 'transparent' ? '#374151' : b },
                    selectedBg === b && styles.swatchActive,
                  ]}
                  onPress={() => setSelectedBg(b)}
                >
                  {b === 'transparent' && <Ionicons name="close" size={14} color="#9CA3AF" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Text Animations */}
            <Text style={styles.sectionTitle}>ANIMATION</Text>
            <View style={styles.animRow}>
              {animations.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.animPill, selectedAnim === a.id && styles.animPillActive]}
                  onPress={() => setSelectedAnim(a.id)}
                >
                  <Text
                    style={[styles.animLabel, selectedAnim === a.id && styles.animLabelActive]}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
    fontSize: 16,
    fontWeight: '700',
  },
  cancelText: {
    color: '#8E95A5',
    fontSize: 14,
  },
  saveText: {
    color: '#00F2FE',
    fontSize: 15,
    fontWeight: '800',
  },
  sheetBody: {
    padding: 16,
  },
  textInput: {
    backgroundColor: '#1E2333',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A354D',
    marginBottom: 16,
  },
  previewBox: {
    backgroundColor: '#0B0D13',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    minHeight: 80,
  },
  previewText: {
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  templatePill: {
    backgroundColor: '#1E2333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2A354D',
  },
  templatePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderColor: '#00F2FE',
    transform: [{ scale: 1.15 }],
  },
  animRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 30,
  },
  animPill: {
    backgroundColor: '#1E2333',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  animPillActive: {
    backgroundColor: '#00F2FE',
  },
  animLabel: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  animLabelActive: {
    color: '#000000',
    fontWeight: '800',
  },
});
