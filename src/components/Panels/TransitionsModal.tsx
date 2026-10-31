import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TRANSITION_PRESETS, PRESET_PREVIEW_IMAGE } from '../../constants/sampleMedia';
import { soundEngine } from '../../utils/audioEngine';

interface TransitionsModalProps {
  visible: boolean;
  onClose: () => void;
  onApply?: () => void;
  activeTransition?: { type: string; duration?: number };
  onApplyTransition: (transition: { type: string; duration: number }) => void;
  isInline?: boolean;
}

const getTransitionIcon = (id: string): keyof typeof Ionicons.glyphMap => {
  switch (id) {
    case 'cut': return 'cut-outline';
    case 'dissolve': return 'color-filter-outline';
    case 'zoom_in': return 'expand-outline';
    case 'zoom_out': return 'contract-outline';
    case 'slide_left': return 'arrow-back-outline';
    case 'slide_right': return 'arrow-forward-outline';
    case 'push_up': return 'arrow-up-outline';
    case 'push_down': return 'arrow-down-outline';
    case 'flash_white': return 'sunny-outline';
    case 'fade_black': return 'moon-outline';
    case 'glitch_transition': return 'flash-outline';
    case 'spin_cw': return 'refresh-outline';
    case 'spin_ccw': return 'reload-outline';
    case 'light_leak': return 'sparkles-outline';
    default: return 'close-circle-outline';
  }
};

const getTransitionAnimStyle = (id: string): any => {
  if (Platform.OS !== 'web') return null;
  switch (id) {
    case 'dissolve': return { animation: 'transDissolve 2.2s ease-in-out infinite' };
    case 'slide_left': return { animation: 'transSlideLeft 2.2s ease-in-out infinite' };
    case 'slide_right': return { animation: 'transSlideRight 2.2s ease-in-out infinite' };
    case 'push_up': return { animation: 'transPushUp 2.2s ease-in-out infinite' };
    case 'push_down': return { animation: 'transPushDown 2.2s ease-in-out infinite' };
    case 'zoom_in': return { animation: 'transZoomIn 2.2s ease-in-out infinite' };
    case 'zoom_out': return { animation: 'transZoomOut 2.2s ease-in-out infinite' };
    case 'flash_white': return { animation: 'transFlashWhite 2.2s ease-in-out infinite' };
    case 'fade_black': return { animation: 'transFadeBlack 2.2s ease-in-out infinite' };
    case 'glitch_transition': return { animation: 'transGlitch 2.2s ease-in-out infinite' };
    case 'spin_cw': return { animation: 'transSpinCw 2.2s ease-in-out infinite' };
    case 'spin_ccw': return { animation: 'transSpinCcw 2.2s ease-in-out infinite' };
    case 'light_leak': return { animation: 'transLightLeak 2.2s ease-in-out infinite' };
    case 'cut': return { animation: 'transCut 2.2s steps(1) infinite' };
    default: return null;
  }
};

export default function TransitionsModal({
  visible,
  onClose,
  onApply,
  activeTransition,
  onApplyTransition,
  isInline = false,
}: TransitionsModalProps) {
  const [duration, setDuration] = useState(activeTransition?.duration || 0.5);
  const [selectedType, setSelectedType] = useState<string>(activeTransition?.type || 'none');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'fastart-transition-preview-styles';
    if (document.getElementById(styleId)) return;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      @keyframes transDissolve {
        0%, 30% { opacity: 0; }
        60%, 85% { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes transSlideLeft {
        0%, 30% { transform: translateX(100%); opacity: 0.3; }
        60%, 85% { transform: translateX(0%); opacity: 1; }
        100% { transform: translateX(100%); opacity: 0.3; }
      }
      @keyframes transSlideRight {
        0%, 30% { transform: translateX(-100%); opacity: 0.3; }
        60%, 85% { transform: translateX(0%); opacity: 1; }
        100% { transform: translateX(-100%); opacity: 0.3; }
      }
      @keyframes transPushUp {
        0%, 30% { transform: translateY(100%); opacity: 0.3; }
        60%, 85% { transform: translateY(0%); opacity: 1; }
        100% { transform: translateY(100%); opacity: 0.3; }
      }
      @keyframes transPushDown {
        0%, 30% { transform: translateY(-100%); opacity: 0.3; }
        60%, 85% { transform: translateY(0%); opacity: 1; }
        100% { transform: translateY(-100%); opacity: 0.3; }
      }
      @keyframes transZoomIn {
        0%, 30% { transform: scale(0.2); opacity: 0; }
        60%, 85% { transform: scale(1); opacity: 1; }
        100% { transform: scale(0.2); opacity: 0; }
      }
      @keyframes transZoomOut {
        0%, 30% { transform: scale(1.6); opacity: 0; }
        60%, 85% { transform: scale(1); opacity: 1; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      @keyframes transFlashWhite {
        0%, 30% { opacity: 0; }
        45% { opacity: 1; filter: brightness(2.5); }
        60%, 85% { opacity: 1; filter: brightness(1); }
        100% { opacity: 0; }
      }
      @keyframes transFadeBlack {
        0%, 30% { opacity: 0; }
        45% { opacity: 1; filter: brightness(0); }
        60%, 85% { opacity: 1; filter: brightness(1); }
        100% { opacity: 0; }
      }
      @keyframes transGlitch {
        0%, 30% { opacity: 0; transform: none; }
        45% { opacity: 0.8; transform: skewX(-10deg) scale(1.05); filter: hue-rotate(90deg); }
        55% { opacity: 0.9; transform: skewX(10deg) scale(0.95); filter: hue-rotate(-90deg); }
        65%, 85% { opacity: 1; transform: none; filter: none; }
        100% { opacity: 0; }
      }
      @keyframes transSpinCw {
        0%, 30% { transform: rotate(-180deg) scale(0.25); opacity: 0; }
        60%, 85% { transform: rotate(0deg) scale(1); opacity: 1; }
        100% { transform: rotate(-180deg) scale(0.25); opacity: 0; }
      }
      @keyframes transSpinCcw {
        0%, 30% { transform: rotate(180deg) scale(0.25); opacity: 0; }
        60%, 85% { transform: rotate(0deg) scale(1); opacity: 1; }
        100% { transform: rotate(180deg) scale(0.25); opacity: 0; }
      }
      @keyframes transLightLeak {
        0%, 30% { opacity: 0; }
        48% { opacity: 1; filter: brightness(1.6) sepia(0.5); }
        60%, 85% { opacity: 1; filter: none; }
        100% { opacity: 0; }
      }
      @keyframes transCut {
        0%, 48% { opacity: 0; }
        50%, 85% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  const durations = [0.3, 0.5, 0.8, 1.0];

  const handleSelect = (item: any) => {
    soundEngine.playSfx('whoosh');
    setSelectedType(item.id);
    onApplyTransition({
      type: item.id,
      duration: item.duration > 0 ? duration : 0,
    });
  };

  const handleClear = () => {
    soundEngine.playSfx('click');
    setSelectedType('none');
    onApplyTransition({
      type: 'none',
      duration: 0,
    });
  };

  const allPresets = [
    { id: 'none', name: 'None', duration: 0 },
    ...TRANSITION_PRESETS,
  ];

  const isNone = !selectedType || selectedType === 'none';

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header - only shown in standalone modal */}
      {!isInline ? (
        <View style={styles.sheetHeader}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="flash-outline" size={16} color="#00F2FE" />
            <Text style={styles.sheetTitle}>Transitions</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleClear}
              style={[styles.resetBtn, isNone && { opacity: 0.4 }, { paddingHorizontal: 10, height: 26 }]}
              disabled={isNone}
              activeOpacity={0.7}
              accessibilityLabel="Remove transition"
            >
              <Ionicons name="close-circle-outline" size={12} color="#00F2FE" style={{ marginRight: 3 }} />
              <Text style={[styles.resetText, { fontSize: 11 }]}>None</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.doneBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

          {/* Duration Selector Bar */}
          {!isNone && (
            <View style={styles.durationRow}>
              <Text style={styles.durationLabel}>Duration:</Text>
              {durations.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationPill, duration === d && styles.durationPillActive]}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    setDuration(d);
                    onApplyTransition({
                      type: selectedType,
                      duration: d,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.durationText,
                      duration === d && styles.durationTextActive,
                    ]}
                  >
                    {d}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Transitions Grid */}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {allPresets.map((item) => {
                const isActive = (selectedType === item.id) || (isNone && item.id === 'none');
                const isItemNone = item.id === 'none';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.transitionCard, isActive && styles.transitionCardActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.transPreviewStage}>
                      {isItemNone ? (
                        <View style={styles.noneStage}>
                          <Ionicons name="close-circle-outline" size={22} color="#64748B" />
                          <Text style={styles.noneStageText}>None</Text>
                        </View>
                      ) : (
                        <View style={styles.transStageInner}>
                          {/* Base Clip A */}
                          <View style={styles.clipLayerA}>
                            <Image
                              source={{ uri: PRESET_PREVIEW_IMAGE }}
                              style={[
                                styles.clipImg,
                                Platform.OS === 'web' ? ({ filter: 'sepia(0.35) contrast(1.1) brightness(0.85)' } as any) : null,
                              ]}
                              resizeMode="cover"
                            />
                            <View style={styles.clipTagA}>
                              <Text style={styles.clipTagText}>A</Text>
                            </View>
                          </View>

                          {/* Incoming Clip B executing live transition */}
                          <View style={[styles.clipLayerB, getTransitionAnimStyle(item.id)]}>
                            <Image
                              source={{ uri: PRESET_PREVIEW_IMAGE }}
                              style={[
                                styles.clipImg,
                                Platform.OS === 'web' ? ({ filter: 'contrast(1.25) saturate(1.4)' } as any) : null,
                              ]}
                              resizeMode="cover"
                            />
                            <View style={styles.clipTagB}>
                              <Text style={styles.clipTagText}>B</Text>
                            </View>
                          </View>

                          {/* Center transition icon indicator */}
                          <View style={[styles.transPillCenter, isActive && styles.transPillCenterActive]}>
                            <Ionicons
                              name={getTransitionIcon(item.id)}
                              size={12}
                              color={isActive ? '#00F2FE' : '#FFFFFF'}
                            />
                          </View>

                          {/* Active badge */}
                          {isActive && (
                            <View style={styles.activeCheckBadge}>
                              <Ionicons name="checkmark" size={10} color="#000000" />
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.transitionLabel,
                        isActive && styles.transitionLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.transitionDescText} numberOfLines={1}>
                      {(item as any).desc || 'Transition'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0F131D',
  },
  inlineSheetContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F131D',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Platform.OS === 'web' ? '72%' : '80%',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    borderTopWidth: 1,
    borderColor: '#1F2637',
  },
  sheetHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#1F2637',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#08090E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2637',
  },
  durationLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  durationPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#1F2637',
  },
  durationPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
  },
  durationText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  durationTextActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  transitionCard: {
    width: '31%',
    alignItems: 'center',
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#131826',
    borderWidth: 1.5,
    borderColor: '#1F2637',
  },
  transitionCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  transPreviewStage: {
    width: '100%',
    height: 52,
    borderRadius: 5,
    backgroundColor: '#090B10',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  noneStage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  noneStageText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '600',
  },
  transStageInner: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  clipLayerA: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  clipLayerB: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
  clipImg: {
    width: '100%',
    height: '100%',
  },
  clipTagA: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    zIndex: 4,
  },
  clipTagB: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: 'rgba(0, 242, 254, 0.25)',
    borderWidth: 0.5,
    borderColor: '#00F2FE',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    zIndex: 4,
  },
  clipTagText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '800',
  },
  transPillCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 9, 14, 0.85)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  transPillCenterActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.25)',
  },
  transitionDescText: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#08090E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconBoxActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  transitionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  transitionLabelActive: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  inlineApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  inlineAppliedBtn: {
    backgroundColor: '#10B981',
  },
  inlineApplyText: {
    color: '#08090E',
    fontSize: 11,
    fontWeight: '700',
  },
});
