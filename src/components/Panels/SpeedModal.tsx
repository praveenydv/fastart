import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { SpeedCurvePoint } from '../../types/project';
import { styles } from './Speed/SpeedModalStyles';
import { SpeedNormalTab } from './Speed/SpeedNormalTab';
import { SpeedPresetCurvesTab } from './Speed/SpeedPresetCurvesTab';
import { SpeedCustomCurveTab } from './Speed/SpeedCustomCurveTab';
import { SpeedSlowMoSection } from './Speed/SpeedSlowMoSection';

interface SpeedModalProps {
  visible: boolean;
  onClose: () => void;
  currentSpeed?: number;
  currentCurve?: any;
  currentSlowMo?: 'none' | 'blend' | 'optical_flow';
  onApplySpeed: (
    speed: number,
    curve?: any,
    smoothSlowMo?: 'none' | 'blend' | 'optical_flow'
  ) => void;
}

export default function SpeedModal({
  visible,
  onClose,
  currentSpeed = 1.0,
  currentCurve,
  currentSlowMo = 'none',
  onApplySpeed,
}: SpeedModalProps) {
  const [activeTab, setActiveTab] = useState<'normal' | 'curve' | 'custom'>('normal');
  const [speedVal, setSpeedVal] = useState<number>(currentSpeed);
  const [activeCurveId, setActiveCurveId] = useState<string>('montage');
  const [smoothSlowMo, setSmoothSlowMo] = useState<'none' | 'blend' | 'optical_flow'>(currentSlowMo || 'none');

  // Custom Bezier Curve Control Points
  const [customPoints, setCustomPoints] = useState<SpeedCurvePoint[]>([
    { t: 0.0, s: 1.0 },
    { t: 0.25, s: 2.5 },
    { t: 0.5, s: 0.4 },
    { t: 0.75, s: 0.4 },
    { t: 1.0, s: 2.0 },
  ]);

  useEffect(() => {
    if (visible) {
      setSpeedVal(currentSpeed);
      setSmoothSlowMo(currentSlowMo || 'none');
      if (Array.isArray(currentCurve) && currentCurve.length > 0) {
        if (typeof currentCurve[0] === 'object' && 't' in currentCurve[0]) {
          setCustomPoints(currentCurve);
          setActiveTab('custom');
        }
      }
    }
  }, [visible, currentSpeed, currentCurve, currentSlowMo]);

  const handleSelectNormal = (val: number) => {
    setSpeedVal(val);
    soundEngine.playSfx('click');
    onApplySpeed(val, null, smoothSlowMo);
  };

  const handleSelectPresetCurve = (curve: any) => {
    setActiveCurveId(curve.id);
    soundEngine.playSfx('click');
    onApplySpeed(1.5, curve, smoothSlowMo);
  };

  const handleApplyCustomCurve = () => {
    soundEngine.playSfx('whoosh');
    onApplySpeed(1.0, { id: 'custom', name: 'Custom Bezier', points: customPoints }, smoothSlowMo);
    onClose();
  };

  const handleSelectSlowMo = (val: 'none' | 'blend' | 'optical_flow') => {
    soundEngine.playSfx('click');
    setSmoothSlowMo(val);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'normal' && styles.tabBtnActive]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  setActiveTab('normal');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === 'normal' && styles.tabTextActive]}>
                  Normal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'curve' && styles.tabBtnActive]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  setActiveTab('curve');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === 'curve' && styles.tabTextActive]}>
                  Curves
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'custom' && styles.tabBtnActive]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  setActiveTab('custom');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === 'custom' && styles.tabTextActive]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* 1. NORMAL SPEED TAB */}
            {activeTab === 'normal' && (
              <SpeedNormalTab speedVal={speedVal} onSelectSpeed={handleSelectNormal} />
            )}

            {/* 2. CURVE PRESETS TAB */}
            {activeTab === 'curve' && (
              <SpeedPresetCurvesTab
                activeCurveId={activeCurveId}
                onSelectCurve={handleSelectPresetCurve}
              />
            )}

            {/* 3. CUSTOM BEZIER CURVE EDITOR */}
            {activeTab === 'custom' && (
              <SpeedCustomCurveTab
                customPoints={customPoints}
                setCustomPoints={setCustomPoints}
                onApplyCustomCurve={handleApplyCustomCurve}
              />
            )}

            {/* 4. OPTICAL FLOW / FRAME BLENDING SMOOTH SLOW-MO */}
            <SpeedSlowMoSection
              smoothSlowMo={smoothSlowMo}
              onSelectSlowMo={handleSelectSlowMo}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
