import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpeedCurvePoint } from '../../../types/project';
import { soundEngine } from '../../../utils/audioEngine';
import {
  getClipWaveformPeaks,
  extractRealMediaAudioPeaks,
  subscribeMediaAudioChange,
  mediaHasAudioTrack,
} from '../../../utils/mediaAudioDetector';
import { styles } from './SpeedModalStyles';

const WebInput: any = Platform.OS === 'web' ? 'input' : View;

export interface SpeedCustomCurveTabProps {
  customPoints: SpeedCurvePoint[];
  setCustomPoints: React.Dispatch<React.SetStateAction<SpeedCurvePoint[]>>;
  onApplyCustomCurve: () => void;
  clip?: any;
  clipDuration?: number;
  projectAudioTracks?: any[];
}

export const SpeedCustomCurveTab: React.FC<SpeedCustomCurveTabProps> = ({
  customPoints,
  setCustomPoints,
  onApplyCustomCurve,
  clip,
  clipDuration,
  projectAudioTracks,
}) => {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const graphRef = useRef<any>(null);

  const graphWidth = 320;
  const graphHeight = 170;
  const paddingY = 16;
  const minSpeed = 0.1;
  const maxSpeed = 5.0;

  // 1. Audio Peak Extraction & Dynamic Subscription
  const [, setAudioTick] = useState(0);
  useEffect(() => {
    return subscribeMediaAudioChange(() => {
      setAudioTick((t) => t + 1);
    });
  }, []);

  const audioSource = useMemo(() => {
    if (clip && (clip.type === 'audio' || mediaHasAudioTrack(clip)) && clip.url) {
      return {
        id: clip.id,
        url: clip.url,
        duration: clip.duration || clipDuration || 5,
        trimIn: clip.trimIn || 0,
        peaks: clip.peaks,
        mediaDuration: clip.mediaDuration,
        isNativeAudio: true,
      };
    }
    if (projectAudioTracks && projectAudioTracks.length > 0) {
      const bg = projectAudioTracks[0];
      if (bg && bg.url) {
        return {
          id: bg.id,
          url: bg.url,
          duration: clip?.duration || clipDuration || bg.duration || 5,
          trimIn: (clip?.startTime || 0) + (bg.trimIn || 0),
          peaks: bg.peaks,
          mediaDuration: bg.mediaDuration,
          isNativeAudio: false,
        };
      }
    }
    return null;
  }, [clip, clipDuration, projectAudioTracks]);

  useEffect(() => {
    if (audioSource?.url) {
      extractRealMediaAudioPeaks(audioSource.url, audioSource.id);
    }
  }, [audioSource?.url, audioSource?.id]);

  const waveformPeaks = useMemo(() => {
    if (!audioSource?.url) return [];
    return getClipWaveformPeaks(
      audioSource.id,
      audioSource.url,
      graphWidth,
      audioSource.duration,
      audioSource.trimIn,
      1.0,
      2.4, // bar width
      1.2, // gap
      false,
      audioSource.peaks,
      audioSource.mediaDuration,
    );
  }, [audioSource, graphWidth]);

  // 2. Safe Mathematical Coordinate Mapping with Edge Clearance
  const pointToCoord = useCallback((p: SpeedCurvePoint) => {
    const x = Math.max(0, Math.min(graphWidth, p.t * graphWidth));
    const usableHeight = graphHeight - paddingY * 2;
    const normalizedY = (p.s - minSpeed) / (maxSpeed - minSpeed);
    const y = graphHeight - paddingY - normalizedY * usableHeight;
    return { x, y };
  }, [graphWidth, graphHeight, paddingY, minSpeed, maxSpeed]);

  const coordToPoint = useCallback((x: number, y: number): SpeedCurvePoint => {
    const t = Math.max(0.0, Math.min(1.0, x / graphWidth));
    const usableHeight = graphHeight - paddingY * 2;
    const clampedY = Math.max(paddingY, Math.min(graphHeight - paddingY, y));
    const normalizedY = (graphHeight - paddingY - clampedY) / usableHeight;
    const s = Math.round((minSpeed + normalizedY * (maxSpeed - minSpeed)) * 10) / 10;
    return { t, s: Math.max(0.1, Math.min(5.0, s)) };
  }, [graphWidth, graphHeight, paddingY, minSpeed, maxSpeed]);

  // 3. Pointer & Touch Drag Handlers
  const handleGraphPointerStart = (clientX: number, clientY: number, target: any) => {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const scaleX = graphWidth / (rect.width || graphWidth);
    const scaleY = graphHeight / (rect.height || graphHeight);
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

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

    if (closestIdx >= 0 && closestDist < 35) {
      setSelectedPointIndex(closestIdx);
      setIsDragging(true);
    }
  };

  const handleGraphPointerMove = (clientX: number, clientY: number, target: any) => {
    if (!isDragging || selectedPointIndex < 0 || !target) return;
    const rect = target.getBoundingClientRect();
    const scaleX = graphWidth / (rect.width || graphWidth);
    const scaleY = graphHeight / (rect.height || graphHeight);
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

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

  const handleGraphMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    handleGraphPointerStart(e.clientX, e.clientY, e.currentTarget);
  };

  const handleGraphMouseMove = (e: any) => {
    if (!isDragging || selectedPointIndex < 0 || Platform.OS !== 'web') return;
    handleGraphPointerMove(e.clientX, e.clientY, e.currentTarget);
  };

  const handleGraphMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: any) => {
    const touch = e.nativeEvent?.touches?.[0] || e.touches?.[0];
    if (!touch) return;
    handleGraphPointerStart(touch.clientX, touch.clientY, e.currentTarget);
  };

  const handleTouchMove = (e: any) => {
    if (!isDragging || selectedPointIndex < 0) return;
    const touch = e.nativeEvent?.touches?.[0] || e.touches?.[0];
    if (!touch) return;
    handleGraphPointerMove(touch.clientX, touch.clientY, e.currentTarget);
  };

  // 4. Bezier Line & Semi-transparent Area Fill Paths
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

  const buildSvgAreaPath = () => {
    if (customPoints.length === 0) return '';
    const coords = customPoints.map(pointToCoord);
    let d = `M 0 ${graphHeight} L ${coords[0].x} ${coords[0].y}`;

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

    const last = coords[coords.length - 1];
    d += ` L ${last.x} ${graphHeight} Z`;
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

  // Pre-calculate mathematically aligned grid heights
  const y4x = pointToCoord({ t: 0, s: 4.0 }).y;
  const y3x = pointToCoord({ t: 0, s: 3.0 }).y;
  const y2x = pointToCoord({ t: 0, s: 2.0 }).y;
  const y1x = pointToCoord({ t: 0, s: 1.0 }).y;
  const y05x = pointToCoord({ t: 0, s: 0.5 }).y;

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
              onTouchStart: handleTouchStart,
              onTouchMove: handleTouchMove,
              onTouchEnd: handleGraphMouseUp,
            }
          : {
              onTouchStart: handleTouchStart,
              onTouchMove: handleTouchMove,
              onTouchEnd: handleGraphMouseUp,
            })}
      >
        {/* Mathematically Aligned Grid Lines */}
        <View style={[styles.gridLine, { top: y4x }]}>
          <Text style={styles.gridText}>4.0x</Text>
        </View>
        <View style={[styles.gridLine, { top: y3x }]}>
          <Text style={styles.gridText}>3.0x</Text>
        </View>
        <View style={[styles.gridLine, { top: y2x }]}>
          <Text style={styles.gridText}>2.0x</Text>
        </View>
        <View style={[styles.gridLine, styles.gridLineNormal, { top: y1x }]}>
          <Text style={[styles.gridText, { color: '#00F2FE', fontWeight: '700' }]}>1.0x (Normal)</Text>
        </View>
        <View style={[styles.gridLine, { top: y05x, borderStyle: 'dashed' }]}>
          <Text style={[styles.gridText, { color: '#64748B' }]}>0.5x (Slow)</Text>
        </View>

        {/* SVG Bezier Line, Area Fill & Audio Waveform on Lower Side */}
        {Platform.OS === 'web' ? (
          <svg
            width="100%"
            height={graphHeight}
            viewBox={`0 0 ${graphWidth} ${graphHeight}`}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#00F2FE" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Audio Waveform Bars on Lower Side (Anchored to baseline, 100% visible) */}
            {waveformPeaks.length > 0 ? (
              waveformPeaks.map((peak, idx) => {
                const numBars = waveformPeaks.length;
                const barWidth = 2.4;
                const gap = (graphWidth - numBars * barWidth) / Math.max(1, numBars - 1);
                const maxWaveH = 46;
                const barH = Math.max(3, Math.round(peak * maxWaveH));
                const x = idx * (barWidth + gap);
                const y = graphHeight - barH - 4;
                return (
                  <rect
                    key={`wave-${idx}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={1.2}
                    fill={audioSource?.isNativeAudio ? "rgba(0, 242, 254, 0.42)" : "rgba(52, 211, 153, 0.42)"}
                  />
                );
              })
            ) : (
              /* Clean baseline indicator if audio is silent or analyzing */
              <line
                x1="0"
                y1={graphHeight - 4}
                x2={graphWidth}
                y2={graphHeight - 4}
                stroke="rgba(0, 242, 254, 0.2)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            )}

            {/* Waveform Baseline Line */}
            <line
              x1="0"
              y1={graphHeight - 3}
              x2={graphWidth}
              y2={graphHeight - 3}
              stroke={audioSource?.isNativeAudio ? "rgba(0, 242, 254, 0.28)" : "rgba(52, 211, 153, 0.28)"}
              strokeWidth="1.2"
            />

            {/* Semi-transparent Curve Area Fill */}
            <path
              d={buildSvgAreaPath()}
              fill="url(#curveGradient)"
            />

            {/* Glowing Main Bezier Curve Stroke */}
            <path
              d={buildSvgPath()}
              fill="none"
              stroke="#00F2FE"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        ) : null}

        {/* Audio Waveform Status Badge at Lower-Left */}
        {waveformPeaks.length > 0 && (
          <View style={styles.waveformBadge} pointerEvents="none">
            <Ionicons
              name="musical-notes"
              size={9}
              color={audioSource?.isNativeAudio ? "#00F2FE" : "#34D399"}
            />
            <Text
              style={[
                styles.waveformBadgeText,
                !audioSource?.isNativeAudio && { color: "#34D399" },
              ]}
            >
              Audio Waveform ({audioSource?.isNativeAudio ? "Clip" : "BGM"})
            </Text>
          </View>
        )}

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
                  left: Math.max(0, Math.min(graphWidth - 14, coord.x - 7)),
                  top: Math.max(0, Math.min(graphHeight - 14, coord.y - 7)),
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
