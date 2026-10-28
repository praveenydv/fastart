import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import {
  FastArtProject,
  ClipTransform,
  CustomCrop,
  MaskConfig,
  MaskShape,
  CutoutConfig,
  AspectRatio,
  Resolution,
  FPS,
  computeTotalDuration,
} from '../../types/project';
import { THEME_COLORS } from '../../constants/designConstants';
import { FILTER_PRESETS } from '../../constants/sampleMedia';
import { CompactSliderInput } from '../Common/CompactSliderInput';

interface DesktopInspectorProps {
  project: FastArtProject;
  selectedClip: any;
  selectedClipType: string;
  currentTime: number;
  onUpdateProject: (updates: Partial<FastArtProject>) => void;
  onUpdateClipTransform?: (clipId: string, transform: ClipTransform, isFinal?: boolean) => void;
  onUpdateClipCrop?: (clipId: string, crop: CustomCrop) => void;
  onUpdateClipMask?: (clipId: string, mask: MaskConfig, isFinal?: boolean) => void;
  onApplyVolume?: (vol: number, fadeIn: number, fadeOut: number, denoise?: boolean) => void;
  onApplySpeed?: (speed: number, curve?: any, smoothSlowMo?: any) => void;
  onApplyEnhance?: (preset: any) => void;
  onApplyFilter?: (filterId: string) => void;
  onDeleteClip?: () => void;
  onDuplicateClip?: () => void;
  onAddKeyframe?: () => void;
  hasKeyframeAtPlayhead?: boolean;
  onOpenModal?: (modal: string) => void;
  width?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  style?: any;
}

const WebInput: any = Platform.OS === 'web' ? 'input' : TextInput;
const WebDiv: any = Platform.OS === 'web' ? 'div' : View;

const MASK_SHAPES: { id: MaskShape; label: string; icon: string }[] = [
  { id: 'none', label: 'None', icon: 'close-circle-outline' },
  { id: 'circle', label: 'Circle', icon: 'radio-button-on-outline' },
  { id: 'rectangle', label: 'Rectangle', icon: 'square-outline' },
  { id: 'linear', label: 'Split', icon: 'remove-outline' },
  { id: 'mirror', label: 'Mirror', icon: 'pause-outline' },
  { id: 'heart', label: 'Heart', icon: 'heart-outline' },
  { id: 'star', label: 'Star', icon: 'star-outline' },
];

export const DesktopInspector: React.FC<DesktopInspectorProps> = ({
  project,
  selectedClip,
  selectedClipType,
  currentTime,
  onUpdateProject,
  onUpdateClipTransform,
  onUpdateClipCrop,
  onUpdateClipMask,
  onApplyVolume,
  onApplySpeed,
  onApplyEnhance,
  onApplyFilter,
  onDeleteClip,
  onDuplicateClip,
  onAddKeyframe,
  hasKeyframeAtPlayhead = false,
  onOpenModal,
  width = 300,
  isCollapsed = false,
  onToggleCollapse,
  style,
}) => {
  const isVisual = selectedClipType === 'video' || selectedClipType === 'photo';
  const isAudio = selectedClipType === 'audio';
  const isText = selectedClipType === 'text' || selectedClipType === 'caption' || selectedClipType === 'captions';

  // Primary tab
  const [activeTab, setActiveTab] = useState<string>('visual');
  // Visual sub-tab: basic, crop, cutout, mask
  const [visualSubTab, setVisualSubTab] = useState<'basic' | 'crop' | 'cutout' | 'mask'>('basic');

  useEffect(() => {
    if (!selectedClip) {
      setActiveTab('project');
    } else if (isVisual) {
      setActiveTab('visual');
    } else if (isAudio) {
      setActiveTab('audio');
    } else if (isText) {
      setActiveTab('text');
    } else {
      setActiveTab('visual');
    }
  }, [selectedClip?.id, selectedClipType]);

  // Collapsed side rail
  if (isCollapsed) {
    return (
      <View style={[styles.collapsedRail, style]}>
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={onToggleCollapse}
          activeOpacity={0.7}
          accessibilityLabel="Expand properties inspector"
        >
          <Ionicons name="chevron-back" size={16} color={THEME_COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.collapsedLabel}>
          {selectedClip ? (selectedClip.title || 'Clip') : 'Project'}
        </Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Project Properties (when no clip is selected)
  // ─────────────────────────────────────────────
  if (!selectedClip) {
    const aspectRatios: AspectRatio[] = ['16:9', '9:16', '1:1', '4:5', '2.35:1'];
    const resolutions: Resolution[] = ['720p', '1080p', '2K/4K'];
    const frameRates: FPS[] = [24, 25, 30, 50, 60];
    const bgColors = ['#000000', '#121214', '#1B1C20', '#25262B', '#FFFFFF', '#00E5C9', '#1E3A5F', '#8C483A'];

    return (
      <View style={[styles.container, width !== undefined && { width }, style]}>
        {/* Panel Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="options-outline" size={15} color={THEME_COLORS.accent} />
            <Text style={styles.headerTitle}>Project Settings</Text>
          </View>
          {onToggleCollapse && (
            <TouchableOpacity onPress={onToggleCollapse} style={styles.iconBtn}>
              <Ionicons name="chevron-forward" size={15} color={THEME_COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* Project Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Name</Text>
            <View style={styles.inputBox}>
              <WebInput
                style={styles.textInput}
                value={project.title || 'Untitled Project'}
                onChangeText={(val: string) => onUpdateProject({ title: val })}
                placeholderTextColor={THEME_COLORS.textMuted}
              />
            </View>
          </View>

          {/* Aspect Ratio */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Canvas Aspect Ratio</Text>
            <View style={styles.chipsRow}>
              {aspectRatios.map((ratio) => {
                const isActive = (project.aspectRatio || '16:9') === ratio;
                return (
                  <TouchableOpacity
                    key={ratio}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onUpdateProject({ aspectRatio: ratio });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {ratio}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Resolution */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Canvas Resolution</Text>
            <View style={styles.chipsRow}>
              {resolutions.map((res) => {
                const isActive = (project.resolution || '1080p') === res;
                return (
                  <TouchableOpacity
                    key={res}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onUpdateProject({ resolution: res });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {res}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Frame Rate (FPS) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frame Rate (FPS)</Text>
            <View style={styles.chipsRow}>
              {frameRates.map((fps) => {
                const isActive = (project.fps || 30) === fps;
                return (
                  <TouchableOpacity
                    key={fps}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onUpdateProject({ fps });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {fps} FPS
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Canvas Background Color */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Canvas Background</Text>
            <View style={styles.colorSwatchesRow}>
              {bgColors.map((col) => {
                const isSelected = (project.canvasBackground || '#000000') === col;
                return (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: col },
                      isSelected && styles.colorSwatchActive,
                    ]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onUpdateProject({ canvasBackground: col });
                    }}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={col === '#FFFFFF' ? '#000000' : '#FFFFFF'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Project Summary Stats */}
          <View style={[styles.section, { borderBottomWidth: 0 }]}>
            <Text style={styles.sectionTitle}>Project Overview</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Duration:</Text>
              <Text style={styles.statValue}>
                {computeTotalDuration(project.tracks).toFixed(2)}s
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Video & Photo Clips:</Text>
              <Text style={styles.statValue}>
                {project.tracks.video?.length || 0}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Audio Tracks:</Text>
              <Text style={styles.statValue}>
                {project.tracks.audio?.length || 0}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Selected Clip Properties Inspector
  // ─────────────────────────────────────────────
  const transform = selectedClip.transform || {};
  const currentScale = transform.scale ?? 1.0;
  const currentPosX = transform.x ?? 0;
  const currentPosY = transform.y ?? 0;
  const currentRotation = transform.rotation ?? 0;
  const currentOpacity = selectedClip.opacity ?? transform.opacity ?? 1.0;
  const isFlipX = transform.flipX || false;
  const isFlipY = transform.flipY || false;

  const handleTransformChange = (overrides: Partial<ClipTransform>) => {
    if (!onUpdateClipTransform) return;
    const next: ClipTransform = {
      ...transform,
      ...overrides,
    };
    onUpdateClipTransform(selectedClip.id, next, true);
  };

  const currentMask = selectedClip.mask || transform.mask || { shape: 'none', size: 60, feather: 0 };
  const currentCutout: CutoutConfig = selectedClip.cutout || { enabled: false, mode: 'chroma', keyColor: '#00FF00', intensity: 45, shadow: 25 };

  return (
    <View style={[styles.container, width !== undefined && { width }, style]}>
      {/* Top Header with Clip Name & Category Tabs */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons
            name={
              isVisual
                ? selectedClipType === 'photo'
                  ? 'image-outline'
                  : 'videocam-outline'
                : isAudio
                ? 'musical-notes-outline'
                : 'text-outline'
            }
            size={15}
            color={THEME_COLORS.accent}
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedClip.title || 'Selected Clip'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {onDuplicateClip && (
            <TouchableOpacity
              onPress={onDuplicateClip}
              style={styles.iconBtn}
              accessibilityLabel="Duplicate"
            >
              <Ionicons name="copy-outline" size={14} color={THEME_COLORS.textSecondary} />
            </TouchableOpacity>
          )}
          {onDeleteClip && (
            <TouchableOpacity
              onPress={onDeleteClip}
              style={styles.iconBtn}
              accessibilityLabel="Delete"
            >
              <Ionicons name="trash-outline" size={14} color={THEME_COLORS.error} />
            </TouchableOpacity>
          )}
          {onToggleCollapse && (
            <TouchableOpacity onPress={onToggleCollapse} style={styles.iconBtn}>
              <Ionicons name="chevron-forward" size={15} color={THEME_COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Primary Category Tabs (Video/Image, Audio, Speed, Adjust) */}
      <View style={styles.primaryTabBar}>
        {isVisual && (
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'visual' && styles.primaryTabActive]}
            onPress={() => {
              soundEngine.playSfx('click');
              setActiveTab('visual');
            }}
          >
            <Text style={[styles.primaryTabText, activeTab === 'visual' && styles.primaryTabTextActive]}>
              {selectedClipType === 'photo' ? 'Image' : 'Video'}
            </Text>
          </TouchableOpacity>
        )}

        {isVisual && selectedClipType === 'video' && (
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'audio' && styles.primaryTabActive]}
            onPress={() => {
              soundEngine.playSfx('click');
              setActiveTab('audio');
            }}
          >
            <Text style={[styles.primaryTabText, activeTab === 'audio' && styles.primaryTabTextActive]}>
              Audio
            </Text>
          </TouchableOpacity>
        )}

        {isVisual && selectedClipType === 'video' && (
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'speed' && styles.primaryTabActive]}
            onPress={() => {
              soundEngine.playSfx('click');
              setActiveTab('speed');
            }}
          >
            <Text style={[styles.primaryTabText, activeTab === 'speed' && styles.primaryTabTextActive]}>
              Speed
            </Text>
          </TouchableOpacity>
        )}

        {isVisual && (
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'adjust' && styles.primaryTabActive]}
            onPress={() => {
              soundEngine.playSfx('click');
              setActiveTab('adjust');
            }}
          >
            <Text style={[styles.primaryTabText, activeTab === 'adjust' && styles.primaryTabTextActive]}>
              Adjust
            </Text>
          </TouchableOpacity>
        )}

        {isAudio && (
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'audio' && styles.primaryTabActive]}
            onPress={() => {
              soundEngine.playSfx('click');
              setActiveTab('audio');
            }}
          >
            <Text style={[styles.primaryTabText, activeTab === 'audio' && styles.primaryTabTextActive]}>
              Audio
            </Text>
          </TouchableOpacity>
        )}

        {isText && (
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'text' && styles.primaryTabActive]}
            onPress={() => {
              soundEngine.playSfx('click');
              setActiveTab('text');
            }}
          >
            <Text style={[styles.primaryTabText, activeTab === 'text' && styles.primaryTabTextActive]}>
              Text
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ─────────────────────────────────────────────
          TAB CONTENT: Visual (Basic, Crop, Cutout, Mask)
          ───────────────────────────────────────────── */}
      {activeTab === 'visual' && isVisual && (
        <>
          {/* Sub Tab Bar: Basic | Crop | Cutout | Mask */}
          <View style={styles.subTabBar}>
            {(['basic', 'crop', 'cutout', 'mask'] as const).map((st) => {
              const isActive = visualSubTab === st;
              const labels = {
                basic: 'Basic',
                crop: 'Crop',
                cutout: 'Cutout',
                mask: 'Mask',
              };
              return (
                <TouchableOpacity
                  key={st}
                  style={[styles.subTab, isActive && styles.subTabActive]}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    setVisualSubTab(st);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                    {labels[st]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* SUB-TAB: BASIC TRANSFORM */}
            {visualSubTab === 'basic' && (
              <View style={styles.section}>
                {/* Scale Slider */}
                <View style={styles.controlRow}>
                  <CompactSliderInput
                    label="Scale"
                    value={Math.round(currentScale * 100)}
                    min={10}
                    max={300}
                    step={1}
                    unit="%"
                    defaultValue={100}
                    onChange={(val) => {
                      handleTransformChange({ scale: val / 100 });
                    }}
                  />
                </View>

                {/* Position X Slider & Small Input */}
                <View style={styles.controlRow}>
                  <CompactSliderInput
                    label="Position X"
                    value={Math.round(currentPosX)}
                    min={-500}
                    max={500}
                    step={1}
                    unit="px"
                    defaultValue={0}
                    onChange={(val) => {
                      handleTransformChange({ x: val });
                    }}
                  />
                </View>

                {/* Position Y Slider & Small Input */}
                <View style={styles.controlRow}>
                  <CompactSliderInput
                    label="Position Y"
                    value={Math.round(currentPosY)}
                    min={-500}
                    max={500}
                    step={1}
                    unit="px"
                    defaultValue={0}
                    onChange={(val) => {
                      handleTransformChange({ y: val });
                    }}
                  />
                </View>

                {/* Rotation Slider & Small Input */}
                <View style={styles.controlRow}>
                  <CompactSliderInput
                    label="Rotation"
                    value={Math.round(currentRotation)}
                    min={-180}
                    max={180}
                    step={1}
                    unit="°"
                    defaultValue={0}
                    onChange={(val) => {
                      handleTransformChange({ rotation: val });
                    }}
                  />
                </View>

                {/* Opacity Slider & Small Input */}
                <View style={styles.controlRow}>
                  <CompactSliderInput
                    label="Opacity"
                    value={Math.round(currentOpacity * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    defaultValue={100}
                    onChange={(val) => {
                      handleTransformChange({ opacity: val / 100 });
                    }}
                  />
                </View>

                {/* Flip Buttons */}
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Flip & Orientation</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, isFlipX && styles.actionBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        handleTransformChange({ flipX: !isFlipX });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={15}
                        color={isFlipX ? THEME_COLORS.accent : THEME_COLORS.textSecondary}
                      />
                      <Text style={[styles.actionBtnText, isFlipX && styles.actionBtnTextActive]}>
                        Flip H
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, isFlipY && styles.actionBtnActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        handleTransformChange({ flipY: !isFlipY });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="swap-vertical"
                        size={15}
                        color={isFlipY ? THEME_COLORS.accent : THEME_COLORS.textSecondary}
                      />
                      <Text style={[styles.actionBtnText, isFlipY && styles.actionBtnTextActive]}>
                        Flip V
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        handleTransformChange({
                          scale: 1,
                          x: 0,
                          y: 0,
                          rotation: 0,
                          opacity: 1,
                          flipX: false,
                          flipY: false,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh" size={14} color={THEME_COLORS.textSecondary} />
                      <Text style={styles.actionBtnText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* SUB-TAB: CROP */}
            {visualSubTab === 'crop' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Crop & Frame Preset</Text>
                <View style={styles.chipsRow}>
                  {['Free', '16:9', '9:16', '1:1', '4:5'].map((ratio) => (
                    <TouchableOpacity
                      key={ratio}
                      style={styles.chip}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        onOpenModal?.('transform');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipText}>{ratio}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { marginTop: 12 }]}
                  onPress={() => onOpenModal?.('transform')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="crop" size={14} color="#000000" />
                  <Text style={styles.primaryActionBtnText}>Open Advanced Crop Editor</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* SUB-TAB: CUTOUT */}
            {visualSubTab === 'cutout' && (
              <View style={styles.section}>
                <View style={styles.labelValueHeader}>
                  <Text style={styles.sectionTitle}>Chroma Key Cutout</Text>
                  <TouchableOpacity
                    style={[styles.miniToggle, currentCutout.enabled && styles.miniToggleActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onOpenModal?.('cutout');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.miniToggleText, currentCutout.enabled && styles.miniToggleTextActive]}>
                      {currentCutout.enabled ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { marginTop: 12 }]}
                  onPress={() => onOpenModal?.('cutout')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="color-wand" size={14} color="#000000" />
                  <Text style={styles.primaryActionBtnText}>Configure Chroma Key</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* SUB-TAB: MASK */}
            {visualSubTab === 'mask' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shape Mask</Text>
                <View style={styles.maskGrid}>
                  {MASK_SHAPES.map((m) => {
                    const isSelected = (currentMask.shape || 'none') === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.maskCard, isSelected && styles.maskCardActive]}
                        onPress={() => {
                          soundEngine.playSfx('click');
                          if (onUpdateClipMask) {
                            onUpdateClipMask(selectedClip.id, {
                              ...currentMask,
                              shape: m.id,
                            }, true);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={m.icon as any}
                          size={18}
                          color={isSelected ? THEME_COLORS.accent : THEME_COLORS.textSecondary}
                        />
                        <Text style={[styles.maskCardLabel, isSelected && styles.maskCardLabelActive]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {currentMask.shape !== 'none' && (
                  <View style={{ marginTop: 12 }}>
                    {/* Aperture Size */}
                    <View style={styles.controlRow}>
                      <CompactSliderInput
                        label="Mask Size"
                        value={currentMask.size ?? 60}
                        min={15}
                        max={100}
                        step={1}
                        unit="%"
                        defaultValue={60}
                        onChange={(val) => {
                          if (onUpdateClipMask) {
                            onUpdateClipMask(selectedClip.id, {
                              ...currentMask,
                              size: val,
                            }, true);
                          }
                        }}
                      />
                    </View>

                    {/* Edge Softness / Feather */}
                    <View style={styles.controlRow}>
                      <CompactSliderInput
                        label="Feather Softness"
                        value={currentMask.feather ?? 0}
                        min={0}
                        max={50}
                        step={1}
                        unit="%"
                        defaultValue={0}
                        onChange={(val) => {
                          if (onUpdateClipMask) {
                            onUpdateClipMask(selectedClip.id, {
                              ...currentMask,
                              feather: val,
                            }, true);
                          }
                        }}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}

      {/* ─────────────────────────────────────────────
          TAB CONTENT: Audio (Volume, Fade, Denoise)
          ───────────────────────────────────────────── */}
      {activeTab === 'audio' && (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            {/* Volume Slider */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Volume"
                value={Math.round((selectedClip.volume ?? 1.0) * 100)}
                min={0}
                max={200}
                step={1}
                unit="%"
                defaultValue={100}
                onChange={(val) => {
                  onApplyVolume?.(val / 100, selectedClip.fadeIn || 0, selectedClip.fadeOut || 0, selectedClip.denoise || false);
                }}
              />
            </View>

            {/* Fade In & Fade Out */}
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Fade Duration (s)</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <Text style={styles.inputPrefix}>In</Text>
                  <WebInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={String(selectedClip.fadeIn || 0)}
                    onChangeText={(val: string) => {
                      const num = Number(val) || 0;
                      onApplyVolume?.(selectedClip.volume ?? 1.0, num, selectedClip.fadeOut || 0, selectedClip.denoise || false);
                    }}
                  />
                </View>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <Text style={styles.inputPrefix}>Out</Text>
                  <WebInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={String(selectedClip.fadeOut || 0)}
                    onChangeText={(val: string) => {
                      const num = Number(val) || 0;
                      onApplyVolume?.(selectedClip.volume ?? 1.0, selectedClip.fadeIn || 0, num, selectedClip.denoise || false);
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Denoise Toggle */}
            <View style={[styles.controlRow, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[styles.actionBtn, selectedClip.denoise && styles.actionBtnActive]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  const nextDenoise = !selectedClip.denoise;
                  onApplyVolume?.(selectedClip.volume ?? 1.0, selectedClip.fadeIn || 0, selectedClip.fadeOut || 0, nextDenoise);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="ear-outline"
                  size={15}
                  color={selectedClip.denoise ? THEME_COLORS.accent : THEME_COLORS.textSecondary}
                />
                <Text style={[styles.actionBtnText, selectedClip.denoise && styles.actionBtnTextActive]}>
                  Noise Reduction ({selectedClip.denoise ? 'ON' : 'OFF'})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────
          TAB CONTENT: Speed
          ───────────────────────────────────────────── */}
      {activeTab === 'speed' && (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            {/* Speed Value & Slider */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Playback Speed"
                value={parseFloat((selectedClip.speed || 1.0).toFixed(1))}
                min={0.1}
                max={5.0}
                step={0.1}
                unit="x"
                decimals={1}
                defaultValue={1.0}
                onChange={(val) => {
                  onApplySpeed?.(val);
                }}
              />
            </View>

            {/* Speed Preset Chips */}
            <View style={[styles.chipsRow, { marginTop: 8 }]}>
              {[0.5, 1.0, 1.5, 2.0, 4.0].map((s) => {
                const isActive = Math.abs((selectedClip.speed || 1.0) - s) < 0.05;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onApplySpeed?.(s);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {s}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────
          TAB CONTENT: Adjust & Filters
          ───────────────────────────────────────────── */}
      {activeTab === 'adjust' && (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Color Filters & LUTs</Text>
            <View style={styles.chipsRow}>
              {FILTER_PRESETS.slice(0, 8).map((fp) => {
                const isSelected = (selectedClip.filter || 'normal') === fp.id;
                return (
                  <TouchableOpacity
                    key={fp.id}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => {
                      soundEngine.playSfx('click');
                      onApplyFilter?.(fp.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {fp.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.primaryActionBtn, { marginTop: 14 }]}
              onPress={() => onOpenModal?.('filters')}
              activeOpacity={0.8}
            >
              <Ionicons name="color-filter-outline" size={14} color="#000000" />
              <Text style={styles.primaryActionBtnText}>Browse Full 3D LUT Library</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────
          TAB CONTENT: Text
          ───────────────────────────────────────────── */}
      {activeTab === 'text' && isText && (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Text Content</Text>
            <View style={styles.inputBox}>
              <WebInput
                style={[styles.textInput, { minHeight: 60 }]}
                multiline
                value={selectedClip.text || ''}
                onChangeText={(val: string) => {
                  if (onUpdateProject && project.tracks.text) {
                    const texts = project.tracks.text.map((t) =>
                      t.id === selectedClip.id ? { ...t, text: val } : t
                    );
                    onUpdateProject({ tracks: { ...project.tracks, text: texts } });
                  }
                }}
                placeholder="Enter caption or title..."
                placeholderTextColor={THEME_COLORS.textMuted}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryActionBtn, { marginTop: 14 }]}
              onPress={() => onOpenModal?.('text')}
              activeOpacity={0.8}
            >
              <Ionicons name="text-outline" size={14} color="#000000" />
              <Text style={styles.primaryActionBtnText}>Edit Font, Styles & Animations</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const webSliderStyle: any = {
  width: '100%',
  accentColor: THEME_COLORS.accent,
  height: 4,
  cursor: 'pointer',
  marginTop: 6,
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME_COLORS.surface,
    borderLeftWidth: 1,
    borderLeftColor: THEME_COLORS.borderSubtle,
    height: '100%',
    flexDirection: 'column',
  },
  collapsedRail: {
    width: 24,
    height: '100%',
    backgroundColor: THEME_COLORS.surface,
    borderLeftWidth: 1,
    borderLeftColor: THEME_COLORS.borderSubtle,
    alignItems: 'center',
    paddingTop: 8,
  },
  expandBtn: {
    width: 20,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.card,
    borderRadius: 4,
  },
  collapsedLabel: {
    color: THEME_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 20,
    transform: [{ rotate: '90deg' }],
    width: 100,
  },
  header: {
    height: 38,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: THEME_COLORS.surfaceElevated,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  headerTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  iconBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: THEME_COLORS.card,
  },
  primaryTabBar: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
    paddingHorizontal: 8,
    backgroundColor: THEME_COLORS.background,
    gap: 4,
  },
  primaryTab: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryTabActive: {
    backgroundColor: THEME_COLORS.cyanBg,
    borderBottomWidth: 2,
    borderBottomColor: THEME_COLORS.accent,
  },
  primaryTabText: {
    color: THEME_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  primaryTabTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: '700',
  },
  subTabBar: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
    gap: 4,
  },
  subTab: {
    flex: 1,
    height: 22,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subTabActive: {
    backgroundColor: THEME_COLORS.cardHover,
  },
  subTabText: {
    color: THEME_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: THEME_COLORS.textPrimary,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  section: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.borderSubtle,
  },
  sectionTitle: {
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  controlRow: {
    marginBottom: 10,
  },
  labelValueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlLabel: {
    color: THEME_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  controlValue: {
    color: THEME_COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inputBox: {
    backgroundColor: THEME_COLORS.card,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 30,
  },
  inputPrefix: {
    color: THEME_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginRight: 6,
  },
  textInput: {
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    flex: 1,
    padding: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: THEME_COLORS.card,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  chipActive: {
    backgroundColor: THEME_COLORS.cyanBg,
    borderColor: THEME_COLORS.cyanBorder,
  },
  chipText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  chipTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: '700',
  },
  colorSwatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: THEME_COLORS.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchActive: {
    borderColor: THEME_COLORS.accent,
    transform: [{ scale: 1.15 }],
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    color: THEME_COLORS.textMuted,
    fontSize: 11,
  },
  statValue: {
    color: THEME_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: THEME_COLORS.card,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    borderRadius: 5,
    height: 28,
  },
  actionBtnActive: {
    backgroundColor: THEME_COLORS.cyanBg,
    borderColor: THEME_COLORS.cyanBorder,
  },
  actionBtnText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  actionBtnTextActive: {
    color: THEME_COLORS.accent,
    fontWeight: '700',
  },
  primaryActionBtn: {
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 6,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
  miniToggle: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME_COLORS.card,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
  },
  miniToggleActive: {
    backgroundColor: THEME_COLORS.cyanBg,
    borderColor: THEME_COLORS.cyanBorder,
  },
  miniToggleText: {
    color: THEME_COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  miniToggleTextActive: {
    color: THEME_COLORS.accent,
  },
  maskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  maskCard: {
    width: '31%',
    backgroundColor: THEME_COLORS.card,
    borderWidth: 1,
    borderColor: THEME_COLORS.borderSubtle,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  maskCardActive: {
    backgroundColor: THEME_COLORS.cyanBg,
    borderColor: THEME_COLORS.cyanBorder,
  },
  maskCardLabel: {
    color: THEME_COLORS.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  maskCardLabelActive: {
    color: THEME_COLORS.accent,
    fontWeight: '700',
  },
});
