import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Platform,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../../Common/TactileTouchable';
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
import { CompactSliderInput } from '../../Common/CompactSliderInput';

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
  const { width: windowWidth } = useWindowDimensions();
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    Math.max(260, Math.min(600, windowWidth - 32))
  );

  const graphWidth = Math.max(240, containerWidth);
  const graphHeight = 135;
  const paddingY = 14;
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

  // 2. Safe Mathematical Coordinate Mapping
  const pointToCoord = useCallback(
    (p: SpeedCurvePoint) => {
      const x = Math.max(0, Math.min(graphWidth, p.t * graphWidth));
      const usableHeight = graphHeight - paddingY * 2;
      const normalizedY = (p.s - minSpeed) / (maxSpeed - minSpeed);
      const y = graphHeight - paddingY - normalizedY * usableHeight;
      return { x, y };
    },
    [graphWidth, graphHeight, paddingY, minSpeed, maxSpeed]
  );

  const coordToPoint = useCallback(
    (x: number, y: number): SpeedCurvePoint => {
      const t = Math.max(0.0, Math.min(1.0, x / graphWidth));
      const usableHeight = graphHeight - paddingY * 2;
      const clampedY = Math.max(paddingY, Math.min(graphHeight - paddingY, y));
      const normalizedY = (graphHeight - paddingY - clampedY) / usableHeight;
      const s = Math.round((minSpeed + normalizedY * (maxSpeed - minSpeed)) * 10) / 10;
      return { t, s: Math.max(0.1, Math.min(5.0, s)) };
    },
    [graphWidth, graphHeight, paddingY, minSpeed, maxSpeed]
  );

  // 3. Dynamic PanResponder for Reliable Finger Touches & Movement on Mobile & Web
  const customPointsRef = useRef(customPoints);
  customPointsRef.current = customPoints;

  const draggedPointIdxRef = useRef<number>(-1);
  const startPointCoordRef = useRef<{ x: number; y: number } | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (evt) => {
          const locX = evt.nativeEvent.locationX;
          const locY = evt.nativeEvent.locationY;
          const points = customPointsRef.current;

          let bestDist = Infinity;
          let bestIdx = -1;

          points.forEach((p, idx) => {
            const coord = pointToCoord(p);
            const dist = Math.hypot(coord.x - locX, coord.y - locY);
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = idx;
            }
          });

          // If finger touches within 48px of any point, lock on to it!
          if (bestIdx >= 0 && bestDist <= 48) {
            draggedPointIdxRef.current = bestIdx;
            setSelectedPointIndex(bestIdx);
            const coord = pointToCoord(points[bestIdx]);
            startPointCoordRef.current = { x: coord.x, y: coord.y };
            soundEngine.playSfx('click');
          } else {
            draggedPointIdxRef.current = -1;
            startPointCoordRef.current = null;
          }
        },

        onPanResponderMove: (evt, gestureState) => {
          const idx = draggedPointIdxRef.current;
          if (idx < 0 || !startPointCoordRef.current) return;

          const currentX = startPointCoordRef.current.x + gestureState.dx;
          const currentY = startPointCoordRef.current.y + gestureState.dy;

          const newPt = coordToPoint(currentX, currentY);

          setCustomPoints((prev) => {
            const copy = [...prev];
            if (idx === 0) {
              copy[0] = { t: 0, s: newPt.s };
            } else if (idx === copy.length - 1) {
              copy[copy.length - 1] = { t: 1, s: newPt.s };
            } else {
              const prevT = (copy[idx - 1]?.t ?? 0) + 0.02;
              const nextT = (copy[idx + 1]?.t ?? 1) - 0.02;
              copy[idx] = {
                t: Math.max(prevT, Math.min(nextT, newPt.t)),
                s: newPt.s,
              };
            }
            return copy;
          });
        },

        onPanResponderRelease: () => {
          draggedPointIdxRef.current = -1;
          startPointCoordRef.current = null;
        },

        onPanResponderTerminate: () => {
          draggedPointIdxRef.current = -1;
          startPointCoordRef.current = null;
        },
      }),
    [pointToCoord, coordToPoint]
  );

  // 4. Sampled Bezier Segments for Native Mobile Curve Rendering (100% visible on Android/iOS)
  const curveSegments = useMemo(() => {
    if (customPoints.length === 0) return [];
    const coords = customPoints.map(pointToCoord);
    const segments: Array<{ midX: number; midY: number; len: number; angle: number }> = [];

    const STEPS_PER_SPAN = 10;
    const sampledPoints: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(0, i - 1)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(coords.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      for (let s = 0; s <= STEPS_PER_SPAN; s++) {
        if (i > 0 && s === 0) continue;
        const t = s / STEPS_PER_SPAN;
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        const x = mt3 * p1.x + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * p2.x;
        const y = mt3 * p1.y + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * p2.y;
        sampledPoints.push({ x, y });
      }
    }

    for (let i = 0; i < sampledPoints.length - 1; i++) {
      const ptA = sampledPoints[i];
      const ptB = sampledPoints[i + 1];
      const dx = ptB.x - ptA.x;
      const dy = ptB.y - ptA.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      segments.push({
        midX: (ptA.x + ptB.x) / 2,
        midY: (ptA.y + ptB.y) / 2,
        len,
        angle,
      });
    }

    return segments;
  }, [customPoints, pointToCoord]);

  // 5. Bezier Line & Semi-transparent Area Fill Paths (for Web SVG)
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
    setSelectedPointIndex(updated.findIndex((p) => Math.abs(p.t - newT) < 0.001));
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
      { t: 0.25, s: 2.5 },
      { t: 0.5, s: 0.4 },
      { t: 0.75, s: 0.4 },
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
      {/* Visual Graph Canvas with Multi-Touch Finger Responder */}
      <View
        style={styles.graphContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 100 && Math.abs(w - containerWidth) > 2) {
            setContainerWidth(w);
          }
        }}
        {...panResponder.panHandlers}
      >
        {/* Mathematically Aligned Grid Lines */}
        <View style={[styles.gridLine, { top: y4x }]} pointerEvents="none">
          <Text style={styles.gridText}>4.0x</Text>
        </View>
        <View style={[styles.gridLine, { top: y3x }]} pointerEvents="none">
          <Text style={styles.gridText}>3.0x</Text>
        </View>
        <View style={[styles.gridLine, { top: y2x }]} pointerEvents="none">
          <Text style={styles.gridText}>2.0x</Text>
        </View>
        <View style={[styles.gridLine, styles.gridLineNormal, { top: y1x }]} pointerEvents="none">
          <Text style={[styles.gridText, { color: '#00F2FE', fontWeight: '700' }]}>
            1.0x (Normal)
          </Text>
        </View>
        <View style={[styles.gridLine, { top: y05x, borderStyle: 'dashed' }]} pointerEvents="none">
          <Text style={[styles.gridText, { color: '#64748B' }]}>0.5x (Slow)</Text>
        </View>

        {/* 1. NATIVE MOBILE: Connected Bezier Curve Segments (100% visible on Android/iOS) */}
        {Platform.OS !== 'web' &&
          curveSegments.map((seg, idx) => (
            <View
              key={`native-curve-seg-${idx}`}
              style={{
                position: 'absolute',
                left: seg.midX - seg.len / 2,
                top: seg.midY - 1.5,
                width: seg.len + 0.6,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: '#00F2FE',
                transform: [{ rotate: `${seg.angle}deg` }],
              }}
              pointerEvents="none"
            />
          ))}

        {/* 2. NATIVE MOBILE: Audio Waveform Peak Bars */}
        {Platform.OS !== 'web' && waveformPeaks.length > 0 && (
          <View
            style={{
              position: 'absolute',
              bottom: 4,
              left: 0,
              right: 0,
              height: 34,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              paddingHorizontal: 4,
            }}
            pointerEvents="none"
          >
            {waveformPeaks.map((peak, idx) => (
              <View
                key={`native-wave-${idx}`}
                style={{
                  width: 2.2,
                  height: Math.max(2.5, Math.round(peak * 30)),
                  borderRadius: 1,
                  backgroundColor: audioSource?.isNativeAudio
                    ? 'rgba(0, 242, 254, 0.35)'
                    : 'rgba(52, 211, 153, 0.35)',
                }}
              />
            ))}
          </View>
        )}

        {/* 3. WEB SVG: Crisp Bezier Curve, Linear Gradient Fill & Waveforms */}
        {Platform.OS === 'web' && (
          <svg
            width="100%"
            height={graphHeight}
            viewBox={`0 0 ${graphWidth} ${graphHeight}`}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
          >
            <defs>
              <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#00F2FE" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Audio Waveform Bars */}
            {waveformPeaks.length > 0 ? (
              waveformPeaks.map((peak, idx) => {
                const numBars = waveformPeaks.length;
                const barWidth = 2.4;
                const gap = (graphWidth - numBars * barWidth) / Math.max(1, numBars - 1);
                const maxWaveH = 34;
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
                    fill={audioSource?.isNativeAudio ? 'rgba(0, 242, 254, 0.42)' : 'rgba(52, 211, 153, 0.42)'}
                  />
                );
              })
            ) : (
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

            {/* Waveform Baseline */}
            <line
              x1="0"
              y1={graphHeight - 3}
              x2={graphWidth}
              y2={graphHeight - 3}
              stroke={audioSource?.isNativeAudio ? 'rgba(0, 242, 254, 0.28)' : 'rgba(52, 211, 153, 0.28)'}
              strokeWidth="1.2"
            />

            {/* Semi-transparent Curve Area Fill */}
            <path d={buildSvgAreaPath()} fill="url(#curveGradient)" />

            {/* Glowing Main Bezier Curve Stroke */}
            <path
              d={buildSvgPath()}
              fill="none"
              stroke="#00F2FE"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Audio Waveform Status Badge at Lower-Left */}
        {waveformPeaks.length > 0 && (
          <View style={styles.waveformBadge} pointerEvents="none">
            <Ionicons
              name="musical-notes"
              size={9}
              color={audioSource?.isNativeAudio ? '#00F2FE' : '#34D399'}
            />
            <Text
              style={[
                styles.waveformBadgeText,
                !audioSource?.isNativeAudio && { color: '#34D399' },
              ]}
            >
              Audio ({audioSource?.isNativeAudio ? 'Clip' : 'BGM'})
            </Text>
          </View>
        )}

        {/* Interactive Control Points (Touch wrapper: 44x44, Visible point: 18x18 with glowing center) */}
        {customPoints.map((pt, i) => {
          const coord = pointToCoord(pt);
          const isSelected = i === selectedPointIndex;
          return (
            <View
              key={i}
              style={[
                styles.controlPointTouchWrapper,
                {
                  left: coord.x - 22,
                  top: coord.y - 22,
                },
              ]}
              pointerEvents="none"
            >
              <View
                style={[
                  styles.controlPoint,
                  isSelected && styles.controlPointSelected,
                ]}
              >
                {isSelected && (
                  <View style={styles.pointTooltip}>
                    <Text style={styles.pointTooltipText}>{pt.s.toFixed(1)}x</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Point Controls & Actions Toolbar */}
      <View style={styles.graphToolbar}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={styles.graphActionBtn}
            onPress={handleAddPoint}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="add" size={14} color="#00F2FE" />
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
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="trash-outline" size={13} color="#EF4444" />
            <Text style={[styles.graphActionText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.graphActionBtn}
            onPress={handleResetCurve}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="refresh-outline" size={13} color="#94A3B8" />
            <Text style={styles.graphActionText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Point Indicator */}
        {selectedPointIndex >= 0 && customPoints[selectedPointIndex] && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: 'rgba(0, 242, 254, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(0, 242, 254, 0.3)',
            }}
          >
            <Text style={{ fontSize: 10, color: '#00F2FE', fontWeight: '700' }}>
              Pt #{selectedPointIndex + 1}: {customPoints[selectedPointIndex].s.toFixed(1)}x
            </Text>
          </View>
        )}
      </View>

      {/* Selected Point Speed Slider (Compact & responsive) */}
      {selectedPointIndex >= 0 && customPoints[selectedPointIndex] && (
        <View style={styles.pointFineTuneBox}>
          <CompactSliderInput
            label={`Point #${selectedPointIndex + 1} Velocity`}
            value={parseFloat(customPoints[selectedPointIndex].s.toFixed(1))}
            min={0.1}
            max={5.0}
            step={0.1}
            decimals={1}
            unit="x"
            defaultValue={1.0}
            accentColor="#00F2FE"
            showSteppers={true}
            onChange={(val) => {
              const copy = [...customPoints];
              copy[selectedPointIndex].s = val;
              setCustomPoints(copy);
            }}
          />
        </View>
      )}

      {/* 1-Tap Apply CTA Button */}
      <TouchableOpacity
        style={styles.applyCustomBtn}
        onPress={onApplyCustomCurve}
        activeOpacity={0.8}
      >
        <Ionicons name="checkmark" size={16} color="#08090E" />
        <Text style={styles.applyCustomBtnText}>Apply Custom Curve</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SpeedCustomCurveTab;
