import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
import { SpeedAudioView } from './Speed/SpeedAudioView';

interface SpeedModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  clipType?: string;
  clipDuration?: number;
  currentSpeed?: number;
  currentCurve?: any;
  currentSlowMo?: 'none' | 'blend' | 'optical_flow';
  onApplySpeed: (
    speed: number,
    curve?: any,
    smoothSlowMo?: 'none' | 'blend' | 'optical_flow'
  ) => void;
  isInline?: boolean;
  selectedClip?: any;
  projectAudioTracks?: any[];
}

export default function SpeedModal({
  visible,
  onClose,
  onApply,
  clipType,
  clipDuration,
  currentSpeed = 1.0,
  currentCurve,
  currentSlowMo = 'none',
  onApplySpeed,
  isInline = false,
  selectedClip,
  projectAudioTracks,
}: SpeedModalProps) {
  const isAudio = clipType === 'audio';
  const [activeTab, setActiveTab] = useState<'normal' | 'curve' | 'custom'>('normal');
  const [speedVal, setSpeedVal] = useState<number>(currentSpeed);
  const [activeCurveId, setActiveCurveId] = useState<string>('montage');
  const [smoothSlowMo, setSmoothSlowMo] = useState<'none' | 'blend' | 'optical_flow'>(currentSlowMo || 'none');
  const [keepPitch, setKeepPitch] = useState<boolean>(true);

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
    onApplySpeed(val, null, isAudio ? 'none' : smoothSlowMo);
  };

  const handleSelectPresetCurve = (curve: any) => {
    setActiveCurveId(curve.id);
    soundEngine.playSfx('click');
    onApplySpeed(1.5, curve, smoothSlowMo);
  };

  const handleApplyCustomCurve = () => {
    soundEngine.playSfx('whoosh');
    onApplySpeed(1.0, { id: 'custom', name: 'Custom Bezier', points: customPoints }, smoothSlowMo);
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const handleSelectSlowMo = (val: 'none' | 'blend' | 'optical_flow') => {
    soundEngine.playSfx('click');
    setSmoothSlowMo(val);
    const curvePayload =
      activeTab === 'custom'
        ? { id: 'custom', name: 'Custom Bezier', points: customPoints }
        : null;
    onApplySpeed(speedVal, curvePayload, val);
  };

  const handleResetSpeed = () => {
    soundEngine.playSfx('click');
    setSpeedVal(1.0);
    setActiveTab('normal');
    setSmoothSlowMo('none');
    onApplySpeed(1.0, null, 'none');
  };

  const isDefaultSpeed = speedVal === 1.0 && (isAudio || (activeTab === 'normal' && smoothSlowMo === 'none'));

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.sheetHeader}>
          <View style={styles.titleRow}>
            <Ionicons
              name={isAudio ? "musical-notes-outline" : "speedometer-outline"}
              size={16}
              color="#00F2FE"
            />
            <Text style={styles.sheetTitle}>
              {isAudio ? "Audio Speed" : "Speed & Curve"}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleResetSpeed}
              style={[styles.resetBtn, isDefaultSpeed && { opacity: 0.4 }, { paddingHorizontal: 10, height: 26 }]}
              disabled={isDefaultSpeed}
              activeOpacity={0.7}
              accessibilityLabel="Reset speed to 1.0x"
            >
              <Ionicons name="refresh-outline" size={12} color="#00F2FE" style={{ marginRight: 3 }} />
              <Text style={[styles.resetText, { fontSize: 11 }]}>1.0x</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

          {/* Sub-Tabs: Normal / Curves / Custom (Only for Video clips) */}
          {!isAudio && (
            <View style={[styles.tabsRow, isInline && { marginTop: 8 }]}>
              {isInline && !isDefaultSpeed && (
                <TouchableOpacity
                  style={[styles.tabBtn, { borderColor: '#00F2FE', backgroundColor: 'rgba(0, 242, 254, 0.12)', maxWidth: 48 }]}
                  onPress={handleResetSpeed}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, { color: '#00F2FE', fontWeight: '700' }]}>1.0x</Text>
                </TouchableOpacity>
              )}
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
          )}

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {isAudio ? (
              /* DEDICATED STREAMLINED AUDIO SPEED VIEW */
              <SpeedAudioView
                speedVal={speedVal}
                onSelectSpeed={handleSelectNormal}
                clipDuration={clipDuration}
                keepPitch={keepPitch}
                onToggleKeepPitch={() => setKeepPitch((prev) => !prev)}
              />
            ) : (
              /* VIDEO SPEED VIEWS */
              <>
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
                    clip={selectedClip}
                    clipDuration={clipDuration}
                    projectAudioTracks={projectAudioTracks}
                  />
                )}

                {/* 4. OPTICAL FLOW / FRAME BLENDING SMOOTH SLOW-MO */}
                <SpeedSlowMoSection
                  smoothSlowMo={smoothSlowMo}
                  onSelectSlowMo={handleSelectSlowMo}
                />
              </>
            )}
          </ScrollView>
        </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}
