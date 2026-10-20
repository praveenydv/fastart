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
import { SPEED_PRESETS, SPEED_CURVES } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

export default function SpeedModal({
  visible,
  onClose,
  currentSpeed = 1.0,
  onApplySpeed,
}) {
  const [activeTab, setActiveTab] = useState('normal');
  const [speedVal, setSpeedVal] = useState(currentSpeed);
  const [activeCurve, setActiveCurve] = useState('montage');

  const handleSelectNormal = (val) => {
    setSpeedVal(val);
    soundEngine.playSfx('click');
    onApplySpeed(val);
  };

  const handleSelectCurve = (curve) => {
    setActiveCurve(curve.id);
    soundEngine.playSfx('click');
    onApplySpeed(1.5, curve);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'normal' && styles.tabBtnActive]}
                onPress={() => setActiveTab('normal')}
              >
                <Text style={[styles.tabText, activeTab === 'normal' && styles.tabTextActive]}>
                  Normal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'curve' && styles.tabBtnActive]}
                onPress={() => setActiveTab('curve')}
              >
                <Text style={[styles.tabText, activeTab === 'curve' && styles.tabTextActive]}>
                  Curve
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            {activeTab === 'normal' && (
              <>
                <Text style={styles.speedDisplay}>{speedVal}x</Text>
                <Text style={styles.sectionTitle}>PLAYBACK SPEED PRESETS</Text>
                <View style={styles.speedGrid}>
                  {SPEED_PRESETS.map((item) => {
                    const isActive = speedVal === item.value;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[styles.speedPill, isActive && styles.speedPillActive]}
                        onPress={() => handleSelectNormal(item.value)}
                      >
                        <Text
                          style={[styles.speedText, isActive && styles.speedTextActive]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {activeTab === 'curve' && (
              <>
                <Text style={styles.sectionTitle}>SPEED RAMPING CURVES</Text>
                <View style={styles.curveGrid}>
                  {SPEED_CURVES.map((c) => {
                    const isActive = activeCurve === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.curveCard, isActive && styles.curveCardActive]}
                        onPress={() => handleSelectCurve(c)}
                      >
                        <View style={styles.curveGraphBox}>
                          <Ionicons
                            name="trending-up-outline"
                            size={28}
                            color={isActive ? '#00F2FE' : '#8E95A5'}
                          />
                        </View>
                        <Text
                          style={[styles.curveLabel, isActive && styles.curveLabelActive]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
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
    maxHeight: '60%',
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0B0D13',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#1E2333',
  },
  tabText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
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
  speedDisplay: {
    color: '#00F2FE',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginVertical: 10,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  speedPill: {
    width: '22%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: '#1E2333',
    alignItems: 'center',
  },
  speedPillActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1E2333',
  },
  speedText: {
    color: '#8E95A5',
    fontSize: 14,
    fontWeight: '700',
  },
  speedTextActive: {
    color: '#00F2FE',
  },
  curveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  curveCard: {
    width: '48%',
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E2333',
  },
  curveCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
  },
  curveGraphBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  curveLabel: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '600',
  },
  curveLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
