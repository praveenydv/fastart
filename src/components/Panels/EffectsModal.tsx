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
import { EFFECT_PRESETS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

export default function EffectsModal({
  visible,
  onClose,
  activeEffect,
  onAddEffect,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Video Effects & Shaders</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            <View style={styles.grid}>
              {EFFECT_PRESETS.map((item) => {
                const isActive = activeEffect === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.effectCard, isActive && styles.effectCardActive]}
                    onPress={() => {
                      soundEngine.playSfx('pop');
                      onAddEffect(item);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.iconBox}>
                      <Ionicons
                        name={(item.icon || 'sparkles-outline') as any}
                        size={24}
                        color={isActive ? '#D946EF' : '#8E95A5'}
                      />
                    </View>
                    <Text
                      style={[styles.effectLabel, isActive && styles.effectLabelActive]}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  effectCard: {
    width: '30%',
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E2333',
  },
  effectCardActive: {
    borderColor: '#D946EF',
    backgroundColor: 'rgba(217, 70, 239, 0.1)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  effectLabel: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  effectLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
