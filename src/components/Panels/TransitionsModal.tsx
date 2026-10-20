import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TRANSITION_PRESETS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

export default function TransitionsModal({
  visible,
  onClose,
  activeTransition,
  onApplyTransition,
}) {
  const [duration, setDuration] = useState(0.5);

  const durations = [0.3, 0.5, 0.8, 1.0];

  const handleSelect = (item) => {
    soundEngine.playSfx('whoosh');
    onApplyTransition({
      type: item.id,
      duration: item.duration > 0 ? duration : 0,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Video Transitions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            {/* Duration selector */}
            <Text style={styles.sectionTitle}>TRANSITION DURATION</Text>
            <View style={styles.durationRow}>
              {durations.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationPill, duration === d && styles.durationPillActive]}
                  onPress={() => setDuration(d)}
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

            <Text style={styles.sectionTitle}>TRANSITION PRESETS</Text>
            <View style={styles.grid}>
              {TRANSITION_PRESETS.map((item) => {
                const isActive = activeTransition?.type === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.transitionCard, isActive && styles.transitionCardActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.iconBox}>
                      <Ionicons
                        name="flash-outline"
                        size={22}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
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
    marginBottom: 10,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  durationPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: '#1E2333',
    alignItems: 'center',
  },
  durationPillActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1E2333',
  },
  durationText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '700',
  },
  durationTextActive: {
    color: '#00F2FE',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  transitionCard: {
    width: '48%',
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E2333',
  },
  transitionCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  transitionLabel: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  transitionLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
