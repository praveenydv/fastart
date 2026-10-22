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
  activeTransition?: { type: string; duration?: number };
  onApplyTransition: (transition: { type: string; duration: number }) => void;
}

export default function TransitionsModal({
  visible,
  onClose,
  activeTransition,
  onApplyTransition,
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
    onApplyTransition({
      type: activeTransition?.type || 'none',
      duration: activeTransition?.duration ?? 0.5,
    });
    onClose();
  };

  const handleApply = () => {
    soundEngine.playSfx('whoosh');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

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
              <Ionicons name="flash-outline" size={16} color="#00F2FE" />
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
                        color={isActive ? '#00F2FE' : '#8E95A5'}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121620',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '48%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderColor: '#1E2333',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
    borderBottomColor: '#1A1F2C',
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
    letterSpacing: 0.3,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1A1F2C',
  },
  resetText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#161B26',
  },
  durationLabel: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  durationPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  durationPillActive: {
    backgroundColor: '#00F2FE',
    borderColor: '#00F2FE',
  },
  durationText: {
    color: '#8E95A5',
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
    borderRadius: 10,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  transitionCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1A2234',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E2433',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconBoxActive: {
    backgroundColor: '#00F2FE22',
  },
  transitionLabel: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  transitionLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
