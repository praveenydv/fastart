import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FILTER_PRESETS } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

export default function FiltersModal({
  visible,
  onClose,
  activeFilter,
  onSelectFilter,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Color Filters & LUTs</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            <View style={styles.grid}>
              {FILTER_PRESETS.map((item) => {
                const isActive = activeFilter === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.filterCard, isActive && styles.filterCardActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onSelectFilter(item.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.colorPreviewCircle}>
                      <Ionicons
                        name="color-wand"
                        size={22}
                        color={isActive ? '#00F2FE' : '#8E95A5'}
                      />
                    </View>
                    <Text
                      style={[styles.filterLabel, isActive && styles.filterLabelActive]}
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
  filterCard: {
    width: '30%',
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E2333',
  },
  filterCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
  },
  colorPreviewCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
