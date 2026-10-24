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
import { TRANSITION_PRESETS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

interface TransitionsModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  activeTransition?: { type: string; duration?: number };
  onApplyTransition: (transition: { type: string; duration: number }) => void;
  isInline?: boolean;
}

export default function TransitionsModal({
  visible,
  onClose,
  onApply,
  activeTransition,
  onApplyTransition,
  isInline = false,
}: TransitionsModalProps) {
  const [duration, setDuration] = useState(activeTransition?.duration || 0.5);
  const [selectedType, setSelectedType] = useState<string>(activeTransition?.type || 'none');

  const durations = [0.3, 0.5, 0.8, 1.0];

  const handleSelect = (item: any) => {
    soundEngine.playSfx('whoosh');
    setSelectedType(item.id);
    onApplyTransition({
      type: item.id,
      duration: item.duration > 0 ? duration : 0,
    });
  };

  const handleClear = () => {
    soundEngine.playSfx('click');
    setSelectedType('none');
    onApplyTransition({
      type: 'none',
      duration: 0,
    });
  };

  const allPresets = [
    { id: 'none', name: 'None', duration: 0 },
    ...TRANSITION_PRESETS,
  ];

  const isNone = !selectedType || selectedType === 'none';

  const handleCancel = () => {
    soundEngine.playSfx('pop');
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, isInline && styles.inlineSheetContainer]}>
      {/* Sheet Handle */}
      {!isInline && <View style={styles.sheetHandle} />}

      {/* Space-Optimized Header */}
      <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={handleCancel}
                style={[styles.doneBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                activeOpacity={0.7}
                accessibilityLabel="Cancel changes"
              >
                <Ionicons name="close" size={17} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleClear}
                style={[styles.resetBtn, isNone && { opacity: 0.4 }]}
                disabled={isNone}
                activeOpacity={0.7}
              >
                <Text style={styles.resetText}>None</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headerTitleRow}>
              <Ionicons name="flash-outline" size={16} color="#FFFFFF" />
              <Text style={styles.sheetTitle}>Transitions</Text>
            </View>

            <TouchableOpacity
              onPress={handleApply}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Apply transition"
            >
              <Ionicons name="checkmark" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Duration Selector Bar */}
          {!isNone && (
            <View style={styles.durationRow}>
              <Text style={styles.durationLabel}>Duration:</Text>
              {durations.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationPill, duration === d && styles.durationPillActive]}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    setDuration(d);
                    onApplyTransition({
                      type: selectedType,
                      duration: d,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.durationText,
                      duration === d && styles.durationTextActive,
                    ]}
                  >
                    {d}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Transitions Grid */}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {allPresets.map((item) => {
                const isActive = (selectedType === item.id) || (isNone && item.id === 'none');
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.transitionCard, isActive && styles.transitionCardActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                      <Ionicons
                        name={item.id === 'none' ? 'close-circle-outline' : 'flash-outline'}
                        size={20}
                        color={isActive ? '#FFFFFF' : '#71717A'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.transitionLabel,
                        isActive && styles.transitionLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
  );

  if (isInline) {
    if (!visible) return null;
    return <View style={styles.inlineWrapper}>{sheetContent}</View>;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        {sheetContent}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121215',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderColor: '#27272F',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#27272F',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272F',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  resetText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '600',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#27272F',
  },
  durationLabel: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
  },
  durationPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  durationPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  durationText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  durationTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transitionCard: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272F',
  },
  transitionCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#202026',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#202026',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconBoxActive: {
    backgroundColor: '#FFFFFF22',
  },
  transitionLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  transitionLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
