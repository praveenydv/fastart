import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { TactileTouchable as TouchableOpacity } from '../Common/TactileTouchable';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CompactSliderInput } from '../Common/CompactSliderInput';
import { ModalHeader } from '../Common/ModalHeader';
import { EffectClip } from '../../types/project';

export interface AdjustmentValues {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  exposure?: number;
  temperature?: number;
  vignette?: number;
  sharpness?: number;
  opacity?: number;
}

export interface AdjustModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (adjustments: AdjustmentValues, targetClipId?: string) => void;
  onAddAdjustmentLayer?: () => string | null | void;
  initialValues?: AdjustmentValues;
  isInline?: boolean;
  isAdjustmentLayer?: boolean;
  selectedClip?: any;
}

const DEFAULT_VALUES: Required<AdjustmentValues> = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  vignette: 0,
  sharpness: 0,
  opacity: 100,
};

export default function AdjustModal({
  visible,
  onClose,
  onApply,
  onAddAdjustmentLayer,
  initialValues,
  isInline = false,
  isAdjustmentLayer = false,
  selectedClip,
}: AdjustModalProps) {
  const [createdLayerId, setCreatedLayerId] = useState<string | null>(null);
  const isLayer = isAdjustmentLayer || Boolean(createdLayerId);

  const [values, setValues] = useState<AdjustmentValues>(() => ({
    ...DEFAULT_VALUES,
    ...(initialValues || {}),
  }));

  // If opened without a selected clip (e.g. from root toolbar), auto-create an Adjustment Layer
  useEffect(() => {
    if (!selectedClip && !isAdjustmentLayer && !createdLayerId && onAddAdjustmentLayer) {
      const newId = onAddAdjustmentLayer();
      if (newId) {
        setCreatedLayerId(newId);
      }
    }
  }, []);

  useEffect(() => {
    if (initialValues) {
      setValues({
        ...DEFAULT_VALUES,
        ...initialValues,
      });
    }
  }, [initialValues]);

  if (!visible) return null;

  const handleAddLayerPress = () => {
    if (onAddAdjustmentLayer) {
      const newId = onAddAdjustmentLayer();
      if (newId) {
        setCreatedLayerId(newId);
      }
      setValues({ ...DEFAULT_VALUES });
    }
  };

  const handleChange = (key: keyof AdjustmentValues, val: number) => {
    const updated = { ...values, [key]: Math.round(val) };
    setValues(updated);
    onApply(updated, createdLayerId || undefined);
  };

  const handleReset = () => {
    setValues({ ...DEFAULT_VALUES });
    onApply({ ...DEFAULT_VALUES }, createdLayerId || undefined);
  };

  const hasChanges = Object.entries(values).some(
    ([k, v]) => v !== (DEFAULT_VALUES as any)[k]
  );

  return (
    <View style={[styles.inlineWrapper, isInline && styles.inlineWrapperDocked]}>
      <View style={styles.sheetContainer}>
        {/* Real-time Live Header without Apply button */}
        <ModalHeader
          title={isLayer ? "Adjustment Layer" : "Color Adjust"}
          iconName="color-filter-outline"
          onClose={onClose}
        />

        {/* Top Action Bar: Add Adjustment Layer + Reset */}
        <View style={styles.actionBar}>
          {onAddAdjustmentLayer && !isLayer ? (
            <TouchableOpacity
              style={styles.addLayerBtn}
              onPress={handleAddLayerPress}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="layers-plus" size={16} color="#F59E0B" />
              <Text style={styles.addLayerBtnText}>+ Adjustment Layer</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.layerBadge}>
              <MaterialCommunityIcons name="tune-variant" size={14} color="#F59E0B" />
              <Text style={styles.layerBadgeText}>Global Track Layer (Live)</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.resetBtn, !hasChanges && { opacity: 0.4 }]}
            onPress={handleReset}
            disabled={!hasChanges}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={14} color="#A1A1AA" />
            <Text style={styles.resetBtnText}>Reset All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Tone & Exposure */}
          <Text style={styles.sectionHeader}>TONE & EXPOSURE</Text>
          <View style={styles.sliderGroup}>
            <CompactSliderInput
              label="Brightness"
              value={values.brightness ?? 0}
              min={-100}
              max={100}
              step={1}
              decimals={0}
              defaultValue={0}
              accentColor="#FFFFFF"
              showSteppers={true}
              onChange={(val) => handleChange('brightness', val)}
            />

            <CompactSliderInput
              label="Contrast"
              value={values.contrast ?? 0}
              min={-100}
              max={100}
              step={1}
              decimals={0}
              defaultValue={0}
              accentColor="#FFFFFF"
              showSteppers={true}
              onChange={(val) => handleChange('contrast', val)}
            />

            <CompactSliderInput
              label="Saturation"
              value={values.saturation ?? 0}
              min={-100}
              max={100}
              step={1}
              decimals={0}
              defaultValue={0}
              accentColor="#FFFFFF"
              showSteppers={true}
              onChange={(val) => handleChange('saturation', val)}
            />

            <CompactSliderInput
              label="Exposure"
              value={values.exposure ?? 0}
              min={-100}
              max={100}
              step={1}
              decimals={0}
              defaultValue={0}
              accentColor="#FFFFFF"
              showSteppers={true}
              onChange={(val) => handleChange('exposure', val)}
            />
          </View>

          {/* Section: Color & Atmosphere */}
          <Text style={styles.sectionHeader}>COLOR & ATMOSPHERE</Text>
          <View style={styles.sliderGroup}>
            <CompactSliderInput
              label="Temperature (Cool ↔ Warm)"
              value={values.temperature ?? 0}
              min={-100}
              max={100}
              step={1}
              decimals={0}
              defaultValue={0}
              accentColor="#F59E0B"
              showSteppers={true}
              onChange={(val) => handleChange('temperature', val)}
            />

            <CompactSliderInput
              label="Vignette"
              value={values.vignette ?? 0}
              min={0}
              max={100}
              step={1}
              decimals={0}
              defaultValue={0}
              accentColor="#FFFFFF"
              showSteppers={true}
              onChange={(val) => handleChange('vignette', val)}
            />

            <CompactSliderInput
              label="Sharpness"
              value={values.sharpness ?? 0}
              min={0}
              max={100}
              step={1}
              decimals={0}
              defaultValue={0}
              accentColor="#FFFFFF"
              showSteppers={true}
              onChange={(val) => handleChange('sharpness', val)}
            />

            <CompactSliderInput
              label="Layer Opacity"
              value={values.opacity ?? 100}
              min={0}
              max={100}
              step={1}
              decimals={0}
              unit="%"
              defaultValue={100}
              accentColor="#38BDF8"
              showSteppers={true}
              onChange={(val) => handleChange('opacity', val)}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#09090B',
  },
  inlineWrapperDocked: {
    backgroundColor: 'transparent',
  },
  sheetContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  addLayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  addLayerBtnText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  layerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  layerBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtnText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '500',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sectionHeader: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  sliderGroup: {
    gap: 12,
    marginBottom: 16,
  },
});
