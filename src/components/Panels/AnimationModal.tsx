import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';

export interface AnimationPresetItem {
  id: string;
  name: string;
  category: 'in' | 'out' | 'loop' | 'combo';
  icon: keyof typeof Ionicons.glyphMap;
  description?: string;
}

export const ANIMATION_IN_PRESETS: AnimationPresetItem[] = [
  { id: 'none', name: 'None', category: 'in', icon: 'close-circle-outline' },
  { id: 'fade_in', name: 'Fade In', category: 'in', icon: 'arrow-up-circle-outline' },
  { id: 'zoom_in', name: 'Zoom In', category: 'in', icon: 'expand-outline' },
  { id: 'zoom_in_2', name: 'Pop Zoom', category: 'in', icon: 'sparkles-outline' },
  { id: 'slide_right', name: 'Slide Right', category: 'in', icon: 'arrow-forward-outline' },
  { id: 'slide_left', name: 'Slide Left', category: 'in', icon: 'arrow-back-outline' },
  { id: 'slide_up', name: 'Slide Up', category: 'in', icon: 'arrow-up-outline' },
  { id: 'slide_down', name: 'Slide Down', category: 'in', icon: 'arrow-down-outline' },
  { id: 'spin_in', name: 'Spin In', category: 'in', icon: 'refresh-outline' },
  { id: 'bounce_in', name: 'Bounce In', category: 'in', icon: 'flash-outline' },
  { id: 'wipe_right', name: 'Wipe In', category: 'in', icon: 'swap-horizontal-outline' },
  { id: 'shake_in', name: 'Shake In', category: 'in', icon: 'pulse-outline' },
  { id: 'blur_in', name: 'Blur In', category: 'in', icon: 'water-outline' },
];

export const ANIMATION_OUT_PRESETS: AnimationPresetItem[] = [
  { id: 'none', name: 'None', category: 'out', icon: 'close-circle-outline' },
  { id: 'fade_out', name: 'Fade Out', category: 'out', icon: 'arrow-down-circle-outline' },
  { id: 'zoom_out', name: 'Zoom Out', category: 'out', icon: 'contract-outline' },
  { id: 'slide_left', name: 'Slide Left', category: 'out', icon: 'arrow-back-outline' },
  { id: 'slide_right', name: 'Slide Right', category: 'out', icon: 'arrow-forward-outline' },
  { id: 'slide_down', name: 'Slide Down', category: 'out', icon: 'arrow-down-outline' },
  { id: 'slide_up', name: 'Slide Up', category: 'out', icon: 'arrow-up-outline' },
  { id: 'spin_out', name: 'Spin Out', category: 'out', icon: 'refresh-outline' },
  { id: 'shrink_out', name: 'Shrink', category: 'out', icon: 'remove-circle-outline' },
  { id: 'wipe_left', name: 'Wipe Out', category: 'out', icon: 'swap-horizontal-outline' },
  { id: 'shake_out', name: 'Shake Out', category: 'out', icon: 'pulse-outline' },
  { id: 'dissolve', name: 'Dissolve', category: 'out', icon: 'color-filter-outline' },
];

export const ANIMATION_LOOP_PRESETS: AnimationPresetItem[] = [
  { id: 'none', name: 'None', category: 'loop', icon: 'close-circle-outline' },
  { id: 'pulse', name: 'Pulse', category: 'loop', icon: 'heart-outline' },
  { id: 'bounce', name: 'Bounce', category: 'loop', icon: 'flash-outline' },
  { id: 'float', name: 'Float', category: 'loop', icon: 'cloud-outline' },
  { id: 'wave', name: 'Wave', category: 'loop', icon: 'water-outline' },
  { id: 'wobble', name: 'Wobble', category: 'loop', icon: 'radio-outline' },
  { id: 'pendulum', name: 'Pendulum', category: 'loop', icon: 'timer-outline' },
  { id: 'swing', name: 'Swing', category: 'loop', icon: 'repeat-outline' },
  { id: 'heartbeat', name: 'Heartbeat', category: 'loop', icon: 'fitness-outline' },
  { id: 'zoom_pulse', name: 'Zoom Pulse', category: 'loop', icon: 'expand-outline' },
  { id: 'jitter', name: 'Jitter', category: 'loop', icon: 'flash-outline' },
];

export const ANIMATION_COMBO_PRESETS = ANIMATION_LOOP_PRESETS;

interface AnimationModalProps {
  visible: boolean;
  onClose: () => void;
  selectedClip: any;
  selectedClipType: string;
  project: any;
  updateProjectWithHistory: (proj: any) => void;
  isInline?: boolean;
}

export default function AnimationModal({
  visible,
  onClose,
  selectedClip,
  selectedClipType,
  project,
  updateProjectWithHistory,
  isInline = false,
}: AnimationModalProps) {
  const [activeCategory, setActiveCategory] = useState<'in' | 'out' | 'loop'>('in');

  // Helper to resolve target tracks key cleanly across all clip types
  const resolveTargetKey = (tracks: any) => {
    const norm = (selectedClipType || '').toLowerCase();
    if (norm === 'caption' || norm === 'captions') return 'captions';
    if (norm === 'text' || norm === 'texts') return 'text';
    if (norm === 'sticker' || norm === 'stickers') return 'stickers';
    if (tracks[norm]) return norm;
    return 'video';
  };

  // Parse existing animation config
  const existingAnim = selectedClip?.animation;
  const inPreset = existingAnim?.inPreset || (existingAnim?.type === 'in' ? existingAnim?.preset : (existingAnim?.preset?.endsWith('_in') ? existingAnim.preset : 'none'));
  const outPreset = existingAnim?.outPreset || (existingAnim?.type === 'out' ? existingAnim?.preset : (existingAnim?.preset?.endsWith('_out') ? existingAnim.preset : 'none'));
  const loopPreset = existingAnim?.loopPreset || existingAnim?.comboPreset || (existingAnim?.type === 'loop' || existingAnim?.type === 'combo' ? existingAnim?.preset : 'none');

  const [inDuration, setInDuration] = useState<number>(existingAnim?.inDuration || existingAnim?.duration || 0.5);
  const [outDuration, setOutDuration] = useState<number>(existingAnim?.outDuration || existingAnim?.duration || 0.5);

  const clipDuration = selectedClip?.duration || 3.0;
  const maxAnimDuration = Math.min(3.0, Number((clipDuration * 0.5).toFixed(1)) || 1.5);

  const activePresetId = useMemo(() => {
    if (activeCategory === 'in') return inPreset || 'none';
    if (activeCategory === 'out') return outPreset || 'none';
    return loopPreset || 'none';
  }, [activeCategory, inPreset, outPreset, loopPreset]);

  const presets = useMemo(() => {
    if (activeCategory === 'in') return ANIMATION_IN_PRESETS;
    if (activeCategory === 'out') return ANIMATION_OUT_PRESETS;
    return ANIMATION_LOOP_PRESETS;
  }, [activeCategory]);

  const handleSelectPreset = (presetId: string) => {
    soundEngine.playSfx('click');
    if (!project || !selectedClip) return;

    const tracks = { ...project.tracks };
    const targetKey = resolveTargetKey(tracks);
    const targetList = [...((tracks as any)[targetKey] || tracks.video || [])];
    const idx = targetList.findIndex((c: any) => c.id === selectedClip.id);
    if (idx < 0) return;

    let updatedIn = inPreset;
    let updatedOut = outPreset;
    let updatedLoop = loopPreset;

    if (activeCategory === 'in') {
      updatedIn = presetId === 'none' ? undefined : presetId;
    } else if (activeCategory === 'out') {
      updatedOut = presetId === 'none' ? undefined : presetId;
    } else {
      updatedLoop = presetId === 'none' ? undefined : presetId;
    }

    const hasAny = Boolean(updatedIn || updatedOut || updatedLoop);

    const newAnimConfig = hasAny
      ? {
          inPreset: updatedIn,
          inDuration: updatedIn ? inDuration : undefined,
          outPreset: updatedOut,
          outDuration: updatedOut ? outDuration : undefined,
          loopPreset: updatedLoop,
          comboPreset: updatedLoop, // backwards-compatible alias
          // Compatibility fields for legacy readers:
          preset: updatedIn || updatedOut || updatedLoop,
          type: updatedIn ? 'in' : (updatedOut ? 'out' : 'loop'),
          duration: updatedIn ? inDuration : (updatedOut ? outDuration : 0.5),
        }
      : undefined;

    targetList[idx] = {
      ...targetList[idx],
      animation: newAnimConfig,
    };

    updateProjectWithHistory({
      ...project,
      tracks: {
        ...tracks,
        [targetKey]: targetList,
      },
    });
  };

  const handleClearAll = () => {
    soundEngine.playSfx('pop');
    if (!project || !selectedClip) return;

    const tracks = { ...project.tracks };
    const targetKey = resolveTargetKey(tracks);
    const targetList = [...((tracks as any)[targetKey] || tracks.video || [])];
    const idx = targetList.findIndex((c: any) => c.id === selectedClip.id);
    if (idx < 0) return;

    targetList[idx] = {
      ...targetList[idx],
      animation: undefined,
    };

    updateProjectWithHistory({
      ...project,
      tracks: {
        ...tracks,
        [targetKey]: targetList,
      },
    });
  };

  const handleDurationChange = (val: number) => {
    soundEngine.playSfx('click');
    if (!project || !selectedClip) return;

    if (activeCategory === 'in') {
      setInDuration(val);
    } else if (activeCategory === 'out') {
      setOutDuration(val);
    }

    const tracks = { ...project.tracks };
    const targetKey = resolveTargetKey(tracks);
    const targetList = [...((tracks as any)[targetKey] || tracks.video || [])];
    const idx = targetList.findIndex((c: any) => c.id === selectedClip.id);
    if (idx < 0) return;

    const currentAnim = targetList[idx].animation || {};
    targetList[idx] = {
      ...targetList[idx],
      animation: {
        ...currentAnim,
        inDuration: activeCategory === 'in' ? val : (currentAnim.inDuration || inDuration),
        outDuration: activeCategory === 'out' ? val : (currentAnim.outDuration || outDuration),
        duration: val,
      },
    };

    updateProjectWithHistory({
      ...project,
      tracks: {
        ...tracks,
        [targetKey]: targetList,
      },
    });
  };

  const isNoneActive = !existingAnim || (!existingAnim.inPreset && !existingAnim.outPreset && !existingAnim.loopPreset && !existingAnim.comboPreset && (!existingAnim.preset || existingAnim.preset === 'none'));

  return (
    <View style={[styles.container, isInline && styles.inlineContainer]}>
      {/* Header - only shown in standalone modal */}
      {!isInline && (
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="play-circle-outline" size={17} color="#00F2FE" />
            <Text style={styles.titleText}>Clip Animation</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.resetBtn, isNoneActive && styles.resetBtnDisabled]}
              disabled={isNoneActive}
              onPress={handleClearAll}
              activeOpacity={0.7}
              accessibilityLabel="Remove all animations"
            >
              <Ionicons name="refresh-outline" size={12} color="#00F2FE" style={{ marginRight: 4 }} />
              <Text style={styles.resetBtnText}>None</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tabs: IN | OUT | COMBO */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeCategory === 'in' && styles.tabItemActive]}
          onPress={() => {
            soundEngine.playSfx('click');
            setActiveCategory('in');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeCategory === 'in' && styles.tabTextActive]}>
            In
          </Text>
          {inPreset && inPreset !== 'none' && <View style={styles.tabBadgeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeCategory === 'out' && styles.tabItemActive]}
          onPress={() => {
            soundEngine.playSfx('click');
            setActiveCategory('out');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeCategory === 'out' && styles.tabTextActive]}>
            Out
          </Text>
          {outPreset && outPreset !== 'none' && <View style={styles.tabBadgeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeCategory === 'loop' && styles.tabItemActive]}
          onPress={() => {
            soundEngine.playSfx('click');
            setActiveCategory('loop');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeCategory === 'loop' && styles.tabTextActive]}>
            Loop
          </Text>
          {loopPreset && loopPreset !== 'none' && <View style={styles.tabBadgeDot} />}
        </TouchableOpacity>
      </View>

      {/* Duration Slider (Only for In & Out animations when an active preset is chosen) */}
      {(activeCategory === 'in' || activeCategory === 'out') && activePresetId !== 'none' && (
        <View style={styles.durationRow}>
          <View style={styles.durationLabelContainer}>
            <Text style={styles.durationLabel}>Duration</Text>
            <Text style={styles.durationValue}>
              {(activeCategory === 'in' ? inDuration : outDuration).toFixed(1)}s
            </Text>
          </View>
          {Platform.OS === 'web' ? (
            <input
              type="range"
              min="0.1"
              max={maxAnimDuration.toString()}
              step="0.1"
              value={(activeCategory === 'in' ? inDuration : outDuration).toString()}
              onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: 4,
                accentColor: '#00F2FE',
                cursor: 'pointer',
                margin: 0,
              } as any}
            />
          ) : (
            <View style={styles.durationQuickRow}>
              {[0.3, 0.5, 0.8, 1.0, 1.5].filter((d) => d <= maxAnimDuration).map((d) => {
                const isSel = Math.abs((activeCategory === 'in' ? inDuration : outDuration) - d) < 0.05;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.quickDurPill, isSel && styles.quickDurPillActive]}
                    onPress={() => handleDurationChange(d)}
                  >
                    <Text style={[styles.quickDurText, isSel && styles.quickDurTextActive]}>
                      {d}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Grid of Animation Presets */}
      <ScrollView style={styles.presetScroll} contentContainerStyle={styles.presetGrid} showsVerticalScrollIndicator={false}>
        {presets.map((item) => {
          const isSelected = activePresetId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.presetCard, isSelected && styles.presetCardActive]}
              onPress={() => handleSelectPreset(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, isSelected && styles.iconCircleActive]}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isSelected ? '#000000' : '#E4E4E7'}
                />
              </View>
              <Text
                style={[styles.presetName, isSelected && styles.presetNameActive]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F1117',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 12,
    maxHeight: 380,
    width: '100%',
  },
  inlineContainer: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: 8,
    maxHeight: undefined,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  resetBtnDisabled: {
    opacity: 0.35,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  resetBtnText: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '600',
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#161922',
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
  },
  tabItemActive: {
    backgroundColor: '#272B3B',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00F2FE',
  },
  durationRow: {
    backgroundColor: '#161922',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  durationLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  durationLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  durationValue: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  durationQuickRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickDurPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  quickDurPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  quickDurText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
  },
  quickDurTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  presetScroll: {
    flex: 1,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
  },
  presetCard: {
    width: '31%',
    backgroundColor: '#161922',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  presetCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#222634',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconCircleActive: {
    backgroundColor: '#00F2FE',
  },
  presetName: {
    color: '#A1A1AA',
    fontSize: 10.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  presetNameActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
});
