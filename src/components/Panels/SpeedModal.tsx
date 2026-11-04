import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Ionicons } from '@expo/vector-icons';
import { SpeedCurvePoint } from '../../types/project';
import { ModalHeader } from '../Common/ModalHeader';
import { SegmentedPillTabs, TabItem } from '../Common/SegmentedPillTabs';
import { styles } from './Speed/SpeedModalStyles';
import { SpeedNormalTab } from './Speed/SpeedNormalTab';
import { SpeedPresetCurvesTab } from './Speed/SpeedPresetCurvesTab';
import { SpeedCustomCurveTab } from './Speed/SpeedCustomCurveTab';
import { SpeedSlowMoSection } from './Speed/SpeedSlowMoSection';
import { SpeedAudioView } from './Speed/SpeedAudioView';

const SPEED_TABS: TabItem<'normal' | 'curve' | 'custom'>[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'curve', label: 'Curves' },
  { id: 'custom', label: 'Custom' },
];

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

function SpeedModalComponent({
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
    onApplySpeed(val, null, isAudio ? 'none' : smoothSlowMo);
  };

  const handleSelectPresetCurve = (curve: any) => {
    setActiveCurveId(curve.id);
    onApplySpeed(1.5, curve, smoothSlowMo);
  };

  const handleApplyCustomCurve = () => {
    onApplySpeed(1.0, { id: 'custom', name: 'Custom Bezier', points: customPoints }, smoothSlowMo);
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const handleSelectSlowMo = (val: 'none' | 'blend' | 'optical_flow') => {
    setSmoothSlowMo(val);
    const curvePayload =
      activeTab === 'custom'
        ? { id: 'custom', name: 'Custom Bezier', points: customPoints }
        : null;
    onApplySpeed(speedVal, curvePayload, val);
  };

  const handleResetSpeed = () => {
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
        <ModalHeader
          title={isAudio ? "Audio Speed" : "Speed & Curve"}
          iconName={isAudio ? "musical-notes-outline" : "speedometer-outline"}
          onClose={onClose}
          onReset={!isDefaultSpeed ? handleResetSpeed : undefined}
          resetText="1.0x"
        />
      ) : null}

      {/* Sub-Tabs: Normal / Curves / Custom (Only for Video clips) */}
      {!isAudio && (
        <View style={{ paddingHorizontal: 12, marginTop: isInline ? 6 : 2, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isInline && !isDefaultSpeed && (
            <TouchableOpacity
              style={[styles.tabBtn, { borderColor: '#00F2FE', backgroundColor: 'rgba(0, 242, 254, 0.12)', maxWidth: 48 }]}
              onPress={handleResetSpeed}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: '#00F2FE', fontWeight: '700' }]}>1.0x</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <SegmentedPillTabs<'normal' | 'curve' | 'custom'>
              tabs={SPEED_TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </View>
        </View>
      )}

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
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

export const SpeedModal = React.memo(SpeedModalComponent);
export default SpeedModal;
