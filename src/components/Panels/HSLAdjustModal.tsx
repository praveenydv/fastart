import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { HSLAdjustments, HSLColorChannel, HSLChannelConfig } from '../../types/project';
import { CompactSliderInput } from '../Common/CompactSliderInput';
import { ModalHeader } from '../Common/ModalHeader';

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

function HSLAdjustModalComponent({
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
  const [isSliderDragging, setIsSliderDragging] = useState<boolean>(false);

  useEffect(() => {
    setAdjustments(initialAdjustments || {});
  }, [initialAdjustments]);

  if (!visible) return null;

  const currentConfig: HSLChannelConfig =
    adjustments[activeChannel] || { ...DEFAULT_CONFIG };

  const handleUpdate = (field: keyof HSLChannelConfig, delta: number) => {
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
    const next = { ...adjustments };
    delete next[activeChannel];
    setAdjustments(next);
    onApply(next);
  };

  const handleResetAll = () => {
    setAdjustments({});
    onApply({});
  };

  const handleDone = () => {
    onApply(adjustments);
    onClose();
  };

  const currentDef = CHANNELS.find((c) => c.id === activeChannel)!;

  return (
    <View style={[styles.inlineWrapper, isInline && styles.inlineWrapperDocked]}>
      <View style={styles.sheetContainer}>
        {/* Standardized Header - only shown in standalone modal */}
        {!isInline && (
          <ModalHeader
            title="HSL"
            iconName="color-filter-outline"
            onClose={onClose}
            onReset={handleResetAll}
            resetText="Reset All"
            onDone={handleDone}
          />
        )}

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isSliderDragging}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
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
                    setActiveChannel(ch.id);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.swatchDot, { backgroundColor: ch.color }]}>
                    {hasMod && <View style={styles.swatchModIndicator} />}
                  </View>
                  <Text
                    numberOfLines={1}
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
                <Text style={styles.tuningCardTitle}>{currentDef.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.resetChannelBtn}
                onPress={handleResetChannel}
              >
                <Text style={styles.resetChannelText}>Reset</Text>
              </TouchableOpacity>
            </View>

            {/* Slider 1: Hue */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Hue"
                value={currentConfig.hue}
                min={-180}
                max={180}
                step={1}
                unit="°"
                defaultValue={0}
                accentColor={currentDef.color}
                showSteppers={true}
                onDragStart={() => setIsSliderDragging(true)}
                onDragEnd={() => setIsSliderDragging(false)}
                onChange={(val) => handleSet('hue', val)}
              />
            </View>

            {/* Slider 2: Saturation */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Saturation"
                value={currentConfig.saturation}
                min={-100}
                max={100}
                step={1}
                unit="%"
                defaultValue={0}
                accentColor={currentDef.color}
                showSteppers={true}
                onDragStart={() => setIsSliderDragging(true)}
                onDragEnd={() => setIsSliderDragging(false)}
                onChange={(val) => handleSet('saturation', val)}
              />
            </View>

            {/* Slider 3: Luminance */}
            <View style={styles.controlRow}>
              <CompactSliderInput
                label="Luminance"
                value={currentConfig.luminance}
                min={-100}
                max={100}
                step={1}
                unit="%"
                defaultValue={0}
                accentColor={currentDef.color}
                showSteppers={true}
                onDragStart={() => setIsSliderDragging(true)}
                onDragEnd={() => setIsSliderDragging(false)}
                onChange={(val) => handleSet('luminance', val)}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export const HSLAdjustModal = React.memo(HSLAdjustModalComponent);
export default HSLAdjustModal;

const styles = StyleSheet.create({
  inlineWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#121214',
  },
  inlineWrapperDocked: {
    height: '100%',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#121214',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 34,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F23',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: '#121214',
  },
  cancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#EDEDED',
    letterSpacing: 0.1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.35)',
  },
  resetBtnText: {
    fontSize: 9.5,
    color: '#00F2FE',
    fontWeight: '600',
  },
  applyBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 6,
    paddingBottom: 56,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
    backgroundColor: '#18181A',
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  swatchBtn: {
    flexBasis: '22%',
    flexGrow: 1,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  swatchBtnSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: '#FFFFFF',
  },
  swatchDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  swatchModIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
  },
  swatchLabel: {
    fontSize: 8.5,
    color: '#8E8E93',
    fontWeight: '400',
  },
  swatchLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  tuningCard: {
    backgroundColor: '#18181A',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  tuningCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
    paddingBottom: 4,
    marginBottom: 6,
  },
  tuningCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallColorBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tuningCardTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#EDEDED',
  },
  resetChannelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.35)',
  },
  resetChannelText: {
    fontSize: 9,
    color: '#00F2FE',
    fontWeight: '600',
  },
  controlRow: {
    marginBottom: 6,
  },
  controlLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  controlName: {
    fontSize: 9.5,
    fontWeight: '400',
    color: '#A1A1AA',
  },
  controlValue: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 9,
    fontWeight: '400',
    color: '#D4D4D8',
  },
  stepperCenter: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCenterText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
