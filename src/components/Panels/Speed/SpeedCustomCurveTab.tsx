import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpeedCurvePoint } from '../../../types/project';
import { soundEngine } from '../../../utils/audioEngine';
import { styles } from './SpeedModalStyles';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

interface SpeedCustomCurveTabProps {
  customPoints: SpeedCurvePoint[];
  setCustomPoints: React.Dispatch<React.SetStateAction<SpeedCurvePoint[]>>;
  onApplyCustomCurve: () => void;
}

export const SpeedCustomCurveTab: React.FC<SpeedCustomCurveTabProps> = ({
  customPoints,
  setCustomPoints,
  onApplyCustomCurve,
}) => {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const graphRef = useRef<any>(null);

  const graphWidth = 320;
  const graphHeight = 160;
  const minSpeed = 0.1;
  const maxSpeed = 5.0;

  const pointToCoord = (p: SpeedCurvePoint) => {
    const x = p.t * graphWidth;
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

  const handleGraphMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

  const handleAddPoint = () => {
    soundEngine.playSfx('pop');
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
    if (customPoints.length <= 2) return;
    if (selectedPointIndex === 0 || selectedPointIndex === customPoints.length - 1) return;
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

  return (
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
          <Ionicons name="trash-outline" size={14} color="#EF4444" />
          <Text style={[styles.graphActionText, { color: '#EF4444' }]}>Delete</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.graphActionBtn}
          onPress={handleResetCurve}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={14} color="#94A3B8" />
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
        onPress={onApplyCustomCurve}
        activeOpacity={0.8}
      >
        <Ionicons name="checkmark" size={18} color="#000000" />
        <Text style={styles.applyCustomBtnText}>Apply Custom Curve</Text>
      </TouchableOpacity>
    </View>
  );
};
