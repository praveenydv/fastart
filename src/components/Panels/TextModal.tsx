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
import { TextClip } from '../../types/project';

interface TextModalProps {
  visible: boolean;
  onClose: () => void;
  onAddText: (clip: TextClip) => void;
  editingClip?: TextClip | null;
  onUpdateText?: (clip: TextClip) => void;
  currentPlayheadTime?: number;
}

export default function TextModal({
  visible,
  onClose,
  onAddText,
  editingClip,
  onUpdateText,
  currentPlayheadTime = 0,
}: TextModalProps) {
  const [inputText, setInputText] = useState('VIRAL HOOK');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [selectedBg, setSelectedBg] = useState('#FF0050');
  const [selectedAnim, setSelectedAnim] = useState('bounce');
  const [selectedFont, setSelectedFont] = useState('Impact, Arial Black, sans-serif');
  const [selectedFontSize, setSelectedFontSize] = useState(26);
  const [selectedBorderColor, setSelectedBorderColor] = useState<string | undefined>(undefined);
  const [duration, setDuration] = useState(3.0);

  // Sync state when modal opens or editingClip changes
  React.useEffect(() => {
    if (visible) {
      if (editingClip) {
        setInputText(editingClip.text || '');
        setDuration(editingClip.duration || 3.0);
        setSelectedColor(editingClip.style?.color || '#FFFFFF');
        setSelectedBg(editingClip.style?.backgroundColor || 'transparent');
        setSelectedAnim(editingClip.animation || 'bounce');
        if (editingClip.style?.fontFamily) setSelectedFont(editingClip.style.fontFamily);
        if (editingClip.style?.fontSize) setSelectedFontSize(editingClip.style.fontSize);
        setSelectedBorderColor(editingClip.style?.borderColor);
      } else {
        setInputText('VIRAL HOOK');
        setDuration(3.0);
        setSelectedColor('#FFFFFF');
        setSelectedBg('#FF0050');
        setSelectedAnim('bounce');
        setSelectedBorderColor(undefined);
      }
    }
  }, [visible, editingClip]);

  const durationPresets = [1.0, 2.0, 3.0, 4.0, 5.0, 8.0, 10.0];

  const handleAdjustDuration = (delta: number) => {
    soundEngine.playSfx('click');
    setDuration((prev) => Math.max(0.5, Math.min(60, Number((prev + delta).toFixed(1)))));
  };

  const colorSwatches = [
    '#FFFFFF',
    '#FFE600',
    '#00F2FE',
    '#FF0050',
    '#10B981',
    '#A855F7',
    '#F59E0B',
    '#FB7185',
    '#38BDF8',
    '#4ADE80',
    '#94A3B8',
    '#000000',
  ];

  const bgSwatches = [
    { label: 'None', value: 'transparent' },
    { label: 'Red', value: '#FF0050' },
    { label: 'Cyan', value: '#00F2FE' },
    { label: 'Dark', value: 'rgba(0,0,0,0.75)' },
    { label: 'Yellow', value: '#FFE600' },
    { label: 'Green', value: '#10B981' },
    { label: 'Purple', value: '#8B5CF6' },
    { label: 'Netflix', value: '#E50914' },
    { label: 'White', value: 'rgba(255,255,255,0.92)' },
  ];

  const fontOptions = [
    { id: 'Impact, Arial Black, sans-serif', label: 'Viral Impact', weight: '900' },
    { id: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto', label: 'Clean Modern', weight: '700' },
    { id: 'Courier New, monospace', label: 'Typewriter', weight: '700' },
    { id: 'Georgia, serif', label: 'Cinematic Serif', weight: '600' },
    { id: 'cursive, Comic Sans MS', label: 'Creative Script', weight: '700' },
  ];

  const fontSizeOptions = [
    { label: 'Small', size: 18 },
    { label: 'Medium', size: 24 },
    { label: 'Large', size: 32 },
    { label: 'Mega', size: 42 },
  ];

  const animationOptions = [
    { id: 'bounce', label: 'Bounce In', icon: 'trending-up' },
    { id: 'typewriter', label: 'Typewriter', icon: 'keypad-outline' },
    { id: 'fade', label: 'Fade In', icon: 'eye-outline' },
    { id: 'slideUp', label: 'Slide Up', icon: 'arrow-up-circle-outline' },
    { id: 'slideDown', label: 'Slide Down', icon: 'arrow-down-circle-outline' },
    { id: 'zoomIn', label: 'Zoom In', icon: 'expand-outline' },
    { id: 'pulse', label: 'Heartbeat Pulse', icon: 'heart-outline' },
    { id: 'glitch', label: 'Glitch Jitter', icon: 'flash-outline' },
    { id: 'shake', label: 'Camera Shake', icon: 'radio-outline' },
    { id: 'wave', label: 'Floating Wave', icon: 'water-outline' },
  ];

  const borderOptions = [
    { label: 'No Border', color: undefined },
    { label: 'Cyan Glow', color: '#00F2FE' },
    { label: 'Coral Glow', color: '#FF0050' },
    { label: 'Yellow Glow', color: '#FFE600' },
    { label: 'White Border', color: '#FFFFFF' },
  ];

  const handleApplyTemplate = (tmpl: any) => {
    setInputText(tmpl.text);
    setSelectedColor(tmpl.style?.color || '#FFFFFF');
    setSelectedBg(tmpl.style?.backgroundColor || 'transparent');
    setSelectedAnim(tmpl.animation || 'fade');
    if (tmpl.style?.fontFamily) setSelectedFont(tmpl.style.fontFamily);
    if (tmpl.style?.fontSize) setSelectedFontSize(tmpl.style.fontSize);
    if (tmpl.style?.borderColor) setSelectedBorderColor(tmpl.style.borderColor);
    soundEngine.playSfx('click');
  };

  const handleSave = () => {
    if (!inputText.trim()) return;

    const baseStyle = {
      color: selectedColor,
      fontSize: selectedFontSize,
      fontWeight: '800' as const,
      fontFamily: selectedFont,
      backgroundColor: selectedBg,
      borderColor: selectedBorderColor,
      borderWidth: selectedBorderColor ? 2 : 0,
      paddingHorizontal: selectedBg !== 'transparent' ? 16 : 0,
      paddingVertical: selectedBg !== 'transparent' ? 8 : 0,
      borderRadius: 10,
      textAlign: 'center' as const,
      textShadowColor: selectedBorderColor ? selectedBorderColor : 'rgba(0,0,0,0.5)',
      textShadowRadius: 8,
    };

    if (editingClip && onUpdateText) {
      const updatedClip: TextClip = {
        ...editingClip,
        text: inputText,
        duration,
        animation: selectedAnim as any,
        style: {
          ...editingClip.style,
          ...baseStyle,
        },
      };
      soundEngine.playSfx('pop');
      onUpdateText(updatedClip);
      onClose();
      return;
    }

    const textClip: TextClip = {
      id: 'clip-t-' + Date.now(),
      text: inputText,
      startTime: currentPlayheadTime,
      duration,
      position: { x: 50, y: 35 },
      scale: 1.0,
      rotation: 0,
      animation: selectedAnim as any,
      style: baseStyle,
    };

    soundEngine.playSfx('pop');
    onAddText(textClip);
    onClose();
  };

  const startTimeDisplay = editingClip ? (editingClip.startTime || 0) : currentPlayheadTime;
  const endTimeDisplay = Number((startTimeDisplay + duration).toFixed(1));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose} style={styles.navBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>
              {editingClip ? 'Edit Text Overlay' : 'Text & Typography Studio'}
            </Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>
                {editingClip ? 'Update' : 'Add to Video'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Input Box */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type your viral text..."
                placeholderTextColor="#64748B"
                autoFocus
              />
              {inputText.length > 0 && (
                <TouchableOpacity onPress={() => setInputText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#8E95A5" />
                </TouchableOpacity>
              )}
            </View>

            {/* Live Text Canvas Preview Stage */}
            <View style={styles.previewStage}>
              <View
                style={[
                  styles.previewPill,
                  {
                    backgroundColor: selectedBg,
                    borderColor: selectedBorderColor || 'transparent',
                    borderWidth: selectedBorderColor ? 2 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.previewText,
                    {
                      color: selectedColor,
                      fontSize: selectedFontSize,
                      fontFamily: selectedFont,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {inputText || 'Your Text Here'}
                </Text>
              </View>
              <View style={styles.animBadge}>
                <Ionicons name="sparkles" size={10} color="#00F2FE" />
                <Text style={styles.animBadgeText}>{selectedAnim.toUpperCase()}</Text>
              </View>
            </View>

            {/* Time Frame & Duration Control (Like Media) */}
            <View style={styles.timeframeBox}>
              <View style={styles.timeframeHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="time-outline" size={16} color="#00F2FE" style={{ marginRight: 6 }} />
                  <Text style={styles.timeframeTitle}>TIME FRAME & DURATION</Text>
                </View>
                <View style={styles.timeframeBadge}>
                  <Text style={styles.timeframeBadgeText}>
                    {startTimeDisplay.toFixed(1)}s ➔ {endTimeDisplay.toFixed(1)}s
                  </Text>
                </View>
              </View>

              {/* Stepper Controls */}
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleAdjustDuration(-0.5)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color="#FFFFFF" />
                  <Text style={styles.stepperSubtext}>-0.5s</Text>
                </TouchableOpacity>

                <View style={styles.stepperValueContainer}>
                  <Text style={styles.stepperDurationNumber}>{duration.toFixed(1)}</Text>
                  <Text style={styles.stepperDurationUnit}>seconds</Text>
                  <Text style={styles.stepperSubinfo}>
                    Visible from {startTimeDisplay.toFixed(1)}s to {endTimeDisplay.toFixed(1)}s
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleAdjustDuration(0.5)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.stepperSubtext}>+0.5s</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Duration Preset Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                {durationPresets.map((d) => {
                  const isActive = Math.abs(duration - d) < 0.05;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.durPresetPill, isActive && styles.durPresetPillActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setDuration(d);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.durPresetText, isActive && styles.durPresetTextActive]}>
                        {d.toFixed(1)}s
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 1. Quick Viral Templates */}
            <Text style={styles.sectionTitle}>VIRAL PRESETS & HOOKS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
              {TEXT_TEMPLATES.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={styles.templatePill}
                  onPress={() => handleApplyTemplate(tmpl)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.templatePillText}>{tmpl.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 2. Animation Preset Selector */}
            <Text style={styles.sectionTitle}>TEXT ANIMATION & IN-OUT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
              {animationOptions.map((anim) => {
                const isActive = selectedAnim === anim.id;
                return (
                  <TouchableOpacity
                    key={anim.id}
                    style={[styles.animPill, isActive && styles.animPillActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setSelectedAnim(anim.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={anim.icon as any}
                      size={14}
                      color={isActive ? '#000000' : '#8E95A5'}
                    />
                    <Text style={[styles.animPillText, isActive && styles.animPillTextActive]}>
                      {anim.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 3. Font Family */}
            <Text style={styles.sectionTitle}>TYPOGRAPHY & FONT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
              {fontOptions.map((f) => {
                const isActive = selectedFont === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.fontPill, isActive && styles.fontPillActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setSelectedFont(f.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.fontPillText, isActive && styles.fontPillTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 4. Font Size Scale */}
            <Text style={styles.sectionTitle}>FONT SIZE SCALE</Text>
            <View style={styles.sizeRow}>
              {fontSizeOptions.map((s) => {
                const isActive = selectedFontSize === s.size;
                return (
                  <TouchableOpacity
                    key={s.size}
                    style={[styles.sizeBtn, isActive && styles.sizeBtnActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setSelectedFontSize(s.size);
                    }}
                  >
                    <Text style={[styles.sizeBtnText, isActive && styles.sizeBtnTextActive]}>
                      {s.label} ({s.size}px)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 5. Text Color Palette */}
            <Text style={styles.sectionTitle}>TEXT COLOR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
              {colorSwatches.map((color) => {
                const isSelected = selectedColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: color },
                      isSelected && styles.colorCircleSelected,
                    ]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setSelectedColor(color);
                    }}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={color === '#FFFFFF' || color === '#FFE600' ? '#000000' : '#FFFFFF'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 6. Background Pill Color */}
            <Text style={styles.sectionTitle}>BACKGROUND PILL / BOX</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
              {bgSwatches.map((bg) => {
                const isSelected = selectedBg === bg.value;
                return (
                  <TouchableOpacity
                    key={bg.value}
                    style={[styles.bgOptionPill, isSelected && styles.bgOptionPillActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setSelectedBg(bg.value);
                    }}
                  >
                    <View
                      style={[
                        styles.bgPreviewDot,
                        {
                          backgroundColor: bg.value === 'transparent' ? '#1E2333' : bg.value,
                          borderWidth: bg.value === 'transparent' ? 1 : 0,
                          borderColor: '#8E95A5',
                        },
                      ]}
                    />
                    <Text style={[styles.bgOptionText, isSelected && styles.bgOptionTextActive]}>
                      {bg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 7. Neon Border & Outline */}
            <Text style={styles.sectionTitle}>NEON BORDER / OUTLINE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
              {borderOptions.map((b) => {
                const isSelected = selectedBorderColor === b.color;
                return (
                  <TouchableOpacity
                    key={b.label}
                    style={[styles.bgOptionPill, isSelected && styles.bgOptionPillActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      setSelectedBorderColor(b.color);
                    }}
                  >
                    {b.color && (
                      <View style={[styles.bgPreviewDot, { backgroundColor: b.color }]} />
                    )}
                    <Text style={[styles.bgOptionText, isSelected && styles.bgOptionTextActive]}>
                      {b.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  navBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cancelText: {
    color: '#8E95A5',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  saveBtn: {
    backgroundColor: '#00F2FE',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },
  sheetBody: {
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0D13',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#00F2FE',
    marginBottom: 14,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 10,
  },
  previewStage: {
    backgroundColor: '#07080C',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1E2333',
    minHeight: 100,
    position: 'relative',
  },
  previewPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '90%',
  },
  previewText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  animBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  animBadgeText: {
    color: '#00F2FE',
    fontSize: 8,
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  horizontalRow: {
    marginBottom: 14,
  },
  templatePill: {
    backgroundColor: '#1A2130',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#252B3B',
  },
  templatePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  animPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10131A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  animPillActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  animPillText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  animPillTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  fontPill: {
    backgroundColor: '#10131A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  fontPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  fontPillText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  fontPillTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#10131A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  sizeBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  sizeBtnText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  sizeBtnTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  bgOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10131A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  bgOptionPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  bgPreviewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bgOptionText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
  },
  bgOptionTextActive: {
    color: '#00F2FE',
  },
  timeframeBox: {
    backgroundColor: '#10131A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 16,
  },
  timeframeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeframeTitle: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  timeframeBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  timeframeBadgeText: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161A26',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#242C3F',
  },
  stepperBtn: {
    width: 60,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#202636',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSubtext: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  stepperValueContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  stepperDurationNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stepperDurationUnit: {
    color: '#00F2FE',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepperSubinfo: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  durPresetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#161A26',
    borderWidth: 1,
    borderColor: '#242C3F',
    marginRight: 8,
  },
  durPresetPillActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  durPresetText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  durPresetTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
});
