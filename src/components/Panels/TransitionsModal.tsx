import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.sheetHeader}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="flash-outline" size={16} color="#00F2FE" />
            <Text style={styles.sheetTitle}>Transitions</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleClear}
              style={[styles.resetBtn, isNone && { opacity: 0.4 }, { paddingHorizontal: 10, height: 26 }]}
              disabled={isNone}
              activeOpacity={0.7}
              accessibilityLabel="Remove transition"
            >
              <Ionicons name="close-circle-outline" size={12} color="#00F2FE" style={{ marginRight: 3 }} />
              <Text style={[styles.resetText, { fontSize: 11 }]}>None</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

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
                        size={18}
                        color={isActive ? '#00F2FE' : '#94A3B8'}
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    borderTopWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#1F2637',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  durationLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  durationPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  durationPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
  },
  durationText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  durationTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  transitionCard: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 7,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  transitionCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#08090E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconBoxActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  transitionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  transitionLabelActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  inlineApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  inlineAppliedBtn: {
    backgroundColor: '#10B981',
  },
  inlineApplyText: {
    color: '#08090E',
    fontSize: 11,
    fontWeight: '700',
  },
});
