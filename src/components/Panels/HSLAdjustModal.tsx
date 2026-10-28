import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { HSLAdjustments, HSLColorChannel, HSLChannelConfig } from '../../types/project';
import { CompactSliderInput } from '../Common/CompactSliderInput';

export interface HSLAdjustModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (adjustments: HSLAdjustments) => void;
  initialAdjustments?: HSLAdjustments;
  isInline?: boolean;
}

interface ChannelDef {
  id: HSLColorChannel;
  name: string;
  color: string;
}

const CHANNELS: ChannelDef[] = [
  { id: 'red', name: 'Red', color: '#EF4444' },
  { id: 'orange', name: 'Orange', color: '#F97316' },
  { id: 'yellow', name: 'Yellow', color: '#FACC15' },
  { id: 'green', name: 'Green', color: '#22C55E' },
  { id: 'cyan', name: 'Cyan', color: '#06B6D4' },
  { id: 'blue', name: 'Blue', color: '#3B82F6' },
  { id: 'purple', name: 'Purple', color: '#A855F7' },
  { id: 'magenta', name: 'Magenta', color: '#EC4899' },
];

const DEFAULT_CONFIG: HSLChannelConfig = {
  hue: 0,
  saturation: 0,
  luminance: 0,
};

export default function HSLAdjustModal({
  visible,
  onClose,
  onApply,
  initialAdjustments,
  isInline = false,
}: HSLAdjustModalProps) {
  const [activeChannel, setActiveChannel] = useState<HSLColorChannel>('red');
  const [adjustments, setAdjustments] = useState<HSLAdjustments>(
    initialAdjustments || {}
  );

  if (!visible) return null;

  const currentConfig: HSLChannelConfig =
    adjustments[activeChannel] || { ...DEFAULT_CONFIG };

  const handleUpdate = (field: keyof HSLChannelConfig, delta: number) => {
    soundEngine.playSfx('click');
    const newConfig: HSLChannelConfig = {
      ...currentConfig,
      [field]: Math.max(
        field === 'hue' ? -180 : -100,
        Math.min(field === 'hue' ? 180 : 100, currentConfig[field] + delta)
      ),
    };
    const nextAdjustments: HSLAdjustments = {
      ...adjustments,
      [activeChannel]: newConfig,
    };
    setAdjustments(nextAdjustments);
    onApply(nextAdjustments);
  };

  const handleSet = (field: keyof HSLChannelConfig, value: number) => {
    const minVal = field === 'hue' ? -180 : -100;
    const maxVal = field === 'hue' ? 180 : 100;
    const clamped = Math.max(minVal, Math.min(maxVal, Math.round(value)));
    const newConfig: HSLChannelConfig = {
      ...currentConfig,
      [field]: clamped,
    };
    const nextAdjustments: HSLAdjustments = {
      ...adjustments,
      [activeChannel]: newConfig,
    };
    setAdjustments(nextAdjustments);
    onApply(nextAdjustments);
  };

  const handleResetChannel = () => {
    soundEngine.playSfx('click');
    const next = { ...adjustments };
    delete next[activeChannel];
    setAdjustments(next);
    onApply(next);
  };

  const handleResetAll = () => {
    soundEngine.playSfx('click');
    setAdjustments({});
    onApply({});
  };

  const handleDone = () => {
    soundEngine.playSfx('pop');
    onApply(adjustments);
    onClose();
  };

  const currentDef = CHANNELS.find((c) => c.id === activeChannel)!;

  return (
    <View style={[styles.inlineWrapper, isInline && styles.inlineWrapperDocked]}>
      <View style={styles.sheetContainer}>
        {/* Standardized Header - only shown in standalone modal */}
        {!isInline && (
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#EF4444" />
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBadge}>
                <MaterialCommunityIcons name="palette-swatch" size={16} color="#00F2FE" />
              </View>
              <Text style={styles.headerTitle}>HSL Color Grading</Text>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleResetAll}>
                <Text style={styles.resetBtnText}>Reset All</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.applyBtn} onPress={handleDone}>
                <Ionicons name="checkmark" size={18} color="#0B0D13" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 8 Color Channel Swatches */}
          <Text style={styles.sectionTitle}>Select Color Channel</Text>
          <View style={styles.swatchRow}>
            {CHANNELS.map((ch) => {
              const isSelected = activeChannel === ch.id;
              const hasMod =
                adjustments[ch.id] &&
                (adjustments[ch.id]?.hue !== 0 ||
                  adjustments[ch.id]?.saturation !== 0 ||
                  adjustments[ch.id]?.luminance !== 0);

              return (
                <TouchableOpacity
                  key={ch.id}
                  style={[
                    styles.swatchBtn,
                    isSelected && styles.swatchBtnSelected,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    setActiveChannel(ch.id);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.swatchDot, { backgroundColor: ch.color }]}>
                    {hasMod && <View style={styles.swatchModIndicator} />}
                  </View>
                  <Text
                    style={[
                      styles.swatchLabel,
                      isSelected && styles.swatchLabelSelected,
                    ]}
                  >
                    {ch.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Active Channel Tuning Box */}
          <View style={styles.tuningCard}>
            <View style={styles.tuningCardHeader}>
              <View style={styles.tuningCardTitleRow}>
                <View
                  style={[
                    styles.smallColorBadge,
                    { backgroundColor: currentDef.color },
                  ]}
                />
                <Text style={styles.tuningCardTitle}>{currentDef.name} Tuning</Text>
              </View>
              <TouchableOpacity
                style={styles.resetChannelBtn}
                onPress={handleResetChannel}
              >
                <Text style={styles.resetChannelText}>Reset Channel</Text>
              </TouchableOpacity>
            </View>

            {/* Slider 1: Hue */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Hue (Shift)"
                value={currentConfig.hue}
                min={-180}
                max={180}
                step={1}
                unit="°"
                defaultValue={0}
                accentColor={currentDef.color}
                onChange={(val) => handleSet('hue', val)}
              />
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('hue', -10)}
                >
                  <Text style={styles.stepBtnText}>-10°</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('hue', -2)}
                >
                  <Text style={styles.stepBtnText}>-2°</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepperCenter}
                  onPress={() => handleSet('hue', 0)}
                >
                  <Text style={styles.stepperCenterText}>0° (Reset)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('hue', 2)}
                >
                  <Text style={styles.stepBtnText}>+2°</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('hue', 10)}
                >
                  <Text style={styles.stepBtnText}>+10°</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Slider 2: Saturation */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Saturation (Vibrancy)"
                value={currentConfig.saturation}
                min={-100}
                max={100}
                step={1}
                unit="%"
                defaultValue={0}
                accentColor={currentDef.color}
                onChange={(val) => handleSet('saturation', val)}
              />
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('saturation', -10)}
                >
                  <Text style={styles.stepBtnText}>-10%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('saturation', -2)}
                >
                  <Text style={styles.stepBtnText}>-2%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepperCenter}
                  onPress={() => handleSet('saturation', 0)}
                >
                  <Text style={styles.stepperCenterText}>0% (Reset)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('saturation', 2)}
                >
                  <Text style={styles.stepBtnText}>+2%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('saturation', 10)}
                >
                  <Text style={styles.stepBtnText}>+10%</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Slider 3: Luminance */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Luminance (Brightness)"
                value={currentConfig.luminance}
                min={-100}
                max={100}
                step={1}
                unit="%"
                defaultValue={0}
                accentColor={currentDef.color}
                onChange={(val) => handleSet('luminance', val)}
              />
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('luminance', -10)}
                >
                  <Text style={styles.stepBtnText}>-10%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('luminance', -2)}
                >
                  <Text style={styles.stepBtnText}>-2%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepperCenter}
                  onPress={() => handleSet('luminance', 0)}
                >
                  <Text style={styles.stepperCenterText}>0% (Reset)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('luminance', 2)}
                >
                  <Text style={styles.stepBtnText}>+2%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleUpdate('luminance', 10)}
                >
                  <Text style={styles.stepBtnText}>+10%</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D0E15',
  },
  inlineWrapperDocked: {
    height: '100%',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#0D0E15',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#12141F',
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtnText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  applyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A1A1AA',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#171926',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  swatchBtn: {
    alignItems: 'center',
    padding: 4,
    borderRadius: 8,
  },
  swatchBtnSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  swatchDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  swatchModIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  swatchLabel: {
    fontSize: 10,
    color: '#71717A',
    fontWeight: '600',
  },
  swatchLabelSelected: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  tuningCard: {
    backgroundColor: '#171926',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tuningCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 10,
    marginBottom: 14,
  },
  tuningCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallColorBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  tuningCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resetChannelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resetChannelText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  controlRow: {
    marginBottom: 14,
  },
  controlLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D4D4D8',
  },
  controlValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00F2FE',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D4D4D8',
  },
  stepperCenter: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCenterText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
