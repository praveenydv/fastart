import React, { useState, useRef, useEffect } from 'react';
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
import { SPEED_PRESETS, SPEED_CURVES } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';
import { SpeedCurvePoint } from '../../types/project';

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

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

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
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const graphRef = useRef<any>(null);

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

  const handleAddPoint = () => {
    soundEngine.playSfx('pop');
    // Add point between selected and next
    const idx = selectedPointIndex >= 0 ? selectedPointIndex : 1;
    const p1 = customPoints[idx] || customPoints[0];
    const p2 = customPoints[Math.min(customPoints.length - 1, idx + 1)] || customPoints[customPoints.length - 1];
    const newT = Math.min(0.95, Math.max(0.05, (p1.t + p2.t) / 2));
    const newS = Math.min(5.0, Math.max(0.2, (p1.s + p2.s) / 2));

    const updated = [...customPoints, { t: newT, s: newS }].sort((a, b) => a.t - b.t);
    setCustomPoints(updated);
    setSelectedPointIndex(updated.findIndex((p) => p.t === newT));
  };

  const handleDeletePoint = () => {
    if (customPoints.length <= 2) return; // Keep at least start and end
    if (selectedPointIndex === 0 || selectedPointIndex === customPoints.length - 1) return; // Don't delete endpoints
    soundEngine.playSfx('click');
    const updated = customPoints.filter((_, i) => i !== selectedPointIndex);
    setCustomPoints(updated);
    setSelectedPointIndex(Math.max(0, selectedPointIndex - 1));
  };

  const handleResetCurve = () => {
    soundEngine.playSfx('click');
    const defaultPoints: SpeedCurvePoint[] = [
      { t: 0.0, s: 1.0 },
      { t: 0.25, s: 2.0 },
      { t: 0.5, s: 0.5 },
      { t: 0.75, s: 0.5 },
      { t: 1.0, s: 2.0 },
    ];
    setCustomPoints(defaultPoints);
    setSelectedPointIndex(1);
  };

  // Convert normalized curve points to SVG path / Canvas coordinates
  const graphWidth = 320;
  const graphHeight = 160;
  const minSpeed = 0.1;
  const maxSpeed = 5.0;

  const pointToCoord = (p: SpeedCurvePoint) => {
    const x = p.t * graphWidth;
    // Invert Y: 5.0x at top (0), 0.1x at bottom (graphHeight)
    const normalizedY = (p.s - minSpeed) / (maxSpeed - minSpeed);
    const y = graphHeight - normalizedY * graphHeight;
    return { x, y };
  };

  const coordToPoint = (x: number, y: number): SpeedCurvePoint => {
    const t = Math.max(0.0, Math.min(1.0, x / graphWidth));
    const normalizedY = Math.max(0.0, Math.min(1.0, (graphHeight - y) / graphHeight));
    const s = Math.round((minSpeed + normalizedY * (maxSpeed - minSpeed)) * 10) / 10;
    return { t, s: Math.max(0.1, Math.min(10.0, s)) };
  };

  // Web drag handler for curve points
  const handleGraphMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find closest point
    let closestDist = Infinity;
    let closestIdx = -1;
    customPoints.forEach((p, idx) => {
      const coord = pointToCoord(p);
      const dist = Math.hypot(coord.x - x, coord.y - y);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx >= 0 && closestDist < 30) {
      setSelectedPointIndex(closestIdx);
      setIsDragging(true);
    }
  };

  const handleGraphMouseMove = (e: any) => {
    if (!isDragging || selectedPointIndex < 0 || Platform.OS !== 'web') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newPt = coordToPoint(x, y);
    setCustomPoints((prev) => {
      const copy = [...prev];
      // Keep endpoints locked at t=0 and t=1
      if (selectedPointIndex === 0) {
        copy[0] = { t: 0, s: newPt.s };
      } else if (selectedPointIndex === copy.length - 1) {
        copy[copy.length - 1] = { t: 1, s: newPt.s };
      } else {
        copy[selectedPointIndex] = newPt;
      }
      return copy.sort((a, b) => a.t - b.t);
    });
  };

  const handleGraphMouseUp = () => {
    setIsDragging(false);
  };

  // Build SVG path string connecting points with smooth cubic Bezier
  const buildSvgPath = () => {
    if (customPoints.length === 0) return '';
    const coords = customPoints.map(pointToCoord);
    let d = `M ${coords[0].x} ${coords[0].y}`;

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(0, i - 1)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(coords.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const hasSlowSpeed =
    activeTab === 'normal'
      ? speedVal < 1.0
      : customPoints.some((p) => p.s < 1.0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
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
              <>
                <Text style={styles.speedDisplay}>{speedVal}x</Text>
                <Text style={styles.sectionTitle}>SPEED PRESETS</Text>
                <View style={styles.speedGrid}>
                  {SPEED_PRESETS.map((item) => {
                    const isActive = speedVal === item.value;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[styles.speedPill, isActive && styles.speedPillActive]}
                        onPress={() => handleSelectNormal(item.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.speedText, isActive && styles.speedTextActive]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Fine Speed Slider */}
                <View style={styles.sliderBox}>
                  <View style={styles.sliderRow}>
                    <Text style={styles.sliderLabel}>Fine Tuning</Text>
                    <Text style={styles.sliderVal}>{speedVal.toFixed(2)}x</Text>
                  </View>
                  <View style={styles.sliderControls}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleSelectNormal(Math.max(0.1, Number((speedVal - 0.1).toFixed(1))))}
                    >
                      <Ionicons name="remove" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    {Platform.OS === 'web' ? (
                      <WebInput
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.05"
                        value={speedVal}
                        onChange={(e: any) => handleSelectNormal(parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: '#00F2FE' }}
                      />
                    ) : (
                      <View style={styles.trackFallback}>
                        <View style={[styles.fillFallback, { width: `${(speedVal / 5) * 100}%` }]} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleSelectNormal(Math.min(5.0, Number((speedVal + 0.1).toFixed(1))))}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* 2. CURVE PRESETS TAB */}
            {activeTab === 'curve' && (
              <>
                <Text style={styles.sectionTitle}>SPEED CURVES</Text>
                <View style={styles.curveGrid}>
                  {SPEED_CURVES.map((c) => {
                    const isActive = activeCurveId === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.curveCard, isActive && styles.curveCardActive]}
                        onPress={() => handleSelectPresetCurve(c)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.curveGraphBox}>
                          <Ionicons
                            name="trending-up-outline"
                            size={28}
                            color={isActive ? '#00F2FE' : '#8E95A5'}
                          />
                        </View>
                        <Text style={[styles.curveLabel, isActive && styles.curveLabelActive]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* 3. CUSTOM BEZIER CURVE EDITOR */}
            {activeTab === 'custom' && (
              <View style={styles.customSection}>
                <View style={styles.customHeader}>
                  <Text style={styles.sectionTitle}>SPEED GRAPH</Text>
                </View>

                {/* Visual SVG / HTML Graph Canvas */}
                <View
                  style={styles.graphContainer}
                  ref={graphRef}
                  {...(Platform.OS === 'web'
                    ? {
                        onMouseDown: handleGraphMouseDown,
                        onMouseMove: handleGraphMouseMove,
                        onMouseUp: handleGraphMouseUp,
                      }
                    : {})}
                >
                  {/* Grid Lines */}
                  <View style={[styles.gridLine, { top: '20%' }]}>
                    <Text style={styles.gridText}>4.0x</Text>
                  </View>
                  <View style={[styles.gridLine, { top: '40%' }]}>
                    <Text style={styles.gridText}>3.0x</Text>
                  </View>
                  <View style={[styles.gridLine, styles.gridLineNormal, { top: '80%' }]}>
                    <Text style={[styles.gridText, { color: '#00F2FE' }]}>1.0x (Normal)</Text>
                  </View>

                  {/* SVG Bezier Line */}
                  {Platform.OS === 'web' ? (
                    <svg
                      width="100%"
                      height={graphHeight}
                      viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                      style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
                    >
                      <path
                        d={buildSvgPath()}
                        fill="none"
                        stroke="#00F2FE"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : null}

                  {/* Control Points */}
                  {customPoints.map((pt, i) => {
                    const coord = pointToCoord(pt);
                    const isSelected = i === selectedPointIndex;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.controlPoint,
                          isSelected && styles.controlPointSelected,
                          {
                            left: Math.max(0, Math.min(graphWidth - 16, coord.x - 8)),
                            top: Math.max(0, Math.min(graphHeight - 16, coord.y - 8)),
                          },
                        ]}
                      >
                        {isSelected && (
                          <View style={styles.pointTooltip}>
                            <Text style={styles.pointTooltipText}>{pt.s}x</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Point Controls & Actions */}
                <View style={styles.graphToolbar}>
                  <TouchableOpacity
                    style={styles.graphActionBtn}
                    onPress={handleAddPoint}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color="#00F2FE" />
                    <Text style={styles.graphActionText}>Add Point</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.graphActionBtn,
                      customPoints.length <= 2 && { opacity: 0.4 },
                    ]}
                    onPress={handleDeletePoint}
                    disabled={customPoints.length <= 2}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF0050" />
                    <Text style={[styles.graphActionText, { color: '#FF0050' }]}>Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.graphActionBtn}
                    onPress={handleResetCurve}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
                    <Text style={styles.graphActionText}>Reset</Text>
                  </TouchableOpacity>
                </View>

                {/* Selected Point Speed Slider */}
                {selectedPointIndex >= 0 && customPoints[selectedPointIndex] && (
                  <View style={styles.pointFineTuneBox}>
                    <View style={styles.sliderRow}>
                      <Text style={styles.sliderLabel}>
                        Point #{selectedPointIndex + 1} Speed
                      </Text>
                      <Text style={styles.sliderVal}>
                        {customPoints[selectedPointIndex].s.toFixed(1)}x
                      </Text>
                    </View>
                    <View style={styles.sliderControls}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const copy = [...customPoints];
                          copy[selectedPointIndex].s = Math.max(
                            0.1,
                            Number((copy[selectedPointIndex].s - 0.2).toFixed(1))
                          );
                          setCustomPoints(copy);
                        }}
                      >
                        <Ionicons name="remove" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      {Platform.OS === 'web' ? (
                        <WebInput
                          type="range"
                          min="0.1"
                          max="5.0"
                          step="0.1"
                          value={customPoints[selectedPointIndex].s}
                          onChange={(e: any) => {
                            const copy = [...customPoints];
                            copy[selectedPointIndex].s = parseFloat(e.target.value);
                            setCustomPoints(copy);
                          }}
                          style={{ flex: 1, accentColor: '#00F2FE' }}
                        />
                      ) : null}
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const copy = [...customPoints];
                          copy[selectedPointIndex].s = Math.min(
                            5.0,
                            Number((copy[selectedPointIndex].s + 0.2).toFixed(1))
                          );
                          setCustomPoints(copy);
                        }}
                      >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.applyCustomBtn}
                  onPress={handleApplyCustomCurve}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={18} color="#000000" />
                  <Text style={styles.applyCustomBtnText}>Apply Custom Curve</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 4. OPTICAL FLOW / FRAME BLENDING SMOOTH SLOW-MO (CAPCUT PRO) */}
            <View style={styles.slowMoSection}>
              <View style={styles.slowMoHeader}>
                <Ionicons name="film-outline" size={18} color="#00F2FE" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.slowMoTitle}>Smooth Slow-Mo (CapCut Pro)</Text>
                  <Text style={styles.slowMoSub}>
                    Interpolate frames for buttery smooth slow-motion
                  </Text>
                </View>
              </View>

              <View style={styles.slowMoOptions}>
                {[
                  {
                    id: 'none',
                    label: 'Standard',
                    desc: 'Normal playback frames',
                    icon: 'flash-off-outline',
                  },
                  {
                    id: 'blend',
                    label: 'Frame Blend',
                    desc: 'Fast temporal blending',
                    icon: 'layers-outline',
                  },
                  {
                    id: 'optical_flow',
                    label: 'Optical Flow',
                    desc: 'Smooth motion interpolation',
                    icon: 'sparkles',
                  },
                ].map((opt) => {
                  const isSelected = smoothSlowMo === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.slowMoCard,
                        isSelected && styles.slowMoCardActive,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setSmoothSlowMo(opt.id as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={18}
                        color={isSelected ? '#00F2FE' : '#8E95A5'}
                      />
                      <Text
                        style={[
                          styles.slowMoCardTitle,
                          isSelected && styles.slowMoCardTitleActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.slowMoCardDesc}>{opt.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#1E2333',
  },
  tabText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#00F2FE',
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
    marginBottom: 16,
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
  sliderBox: {
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 16,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  sliderVal: {
    fontSize: 12,
    color: '#00F2FE',
    fontWeight: '700',
  },
  sliderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#2A334A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackFallback: {
    flex: 1,
    height: 6,
    backgroundColor: '#2A334A',
    borderRadius: 3,
  },
  fillFallback: {
    height: 6,
    backgroundColor: '#00F2FE',
    borderRadius: 3,
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
  customSection: {
    marginBottom: 16,
  },
  customHeader: {
    marginBottom: 10,
  },
  customSub: {
    fontSize: 11,
    color: '#8E95A5',
    marginTop: -8,
    marginBottom: 12,
  },
  graphContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#0B0D13',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
    position: 'relative',
    overflow: 'hidden',
    userSelect: 'none',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingLeft: 8,
    justifyContent: 'center',
  },
  gridLineNormal: {
    backgroundColor: 'rgba(0, 242, 254, 0.25)',
  },
  gridText: {
    fontSize: 9,
    color: '#666',
    fontWeight: '600',
  },
  controlPoint: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#00F2FE',
    cursor: 'pointer',
    zIndex: 10,
  },
  controlPointSelected: {
    backgroundColor: '#00F2FE',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.3 }],
  },
  pointTooltip: {
    position: 'absolute',
    top: -24,
    left: -12,
    backgroundColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  pointTooltipText: {
    fontSize: 10,
    color: '#00F2FE',
    fontWeight: '700',
  },
  graphToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 12,
  },
  graphActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1E2333',
    borderRadius: 8,
  },
  graphActionText: {
    fontSize: 12,
    color: '#00F2FE',
    fontWeight: '600',
  },
  pointFineTuneBox: {
    backgroundColor: '#10131A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 12,
  },
  applyCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00F2FE',
    paddingVertical: 12,
    borderRadius: 10,
  },
  applyCustomBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  slowMoSection: {
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginTop: 8,
  },
  slowMoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  slowMoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  slowMoSub: {
    fontSize: 11,
    color: '#8E95A5',
    marginTop: 1,
  },
  slowMoOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  slowMoCard: {
    flex: 1,
    backgroundColor: '#141721',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E2333',
    alignItems: 'center',
  },
  slowMoCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  slowMoCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E95A5',
    marginTop: 6,
  },
  slowMoCardTitleActive: {
    color: '#00F2FE',
  },
  slowMoCardDesc: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
});
