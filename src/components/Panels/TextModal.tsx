import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { TactileTouchable as TouchableOpacity } from "../Common/TactileTouchable";
import { ModalHeader } from "../Common";
import { Ionicons } from "@expo/vector-icons";
import { TextClip } from "../../types/project";
import {
  startLiveSpeechRecognition,
  isLiveSpeechRecognitionSupported,
} from "../../services/aiCaptionEngine";
import { FontDefinition, loadGoogleFont } from "../../utils/fontCatalog";
import {
  COLOR_SWATCHES,
  FONT_OPTIONS,
  TEXT_EFFECT_OPTIONS,
} from "./Text/textModalConstants";
import { CustomColorPickerButton } from "../Common/CustomColorPickerButton";
import { CompactSliderInput } from "../Common/CompactSliderInput";
import { styles } from "./Text/TextModalStyles";

interface TextModalProps {
  visible: boolean;
  onClose: () => void;
  onAddText: (clip: TextClip) => void;
  editingClip?: TextClip | null;
  onUpdateText?: (clip: TextClip) => void;
  currentPlayheadTime?: number;
  isInline?: boolean;
}

export default function TextModal({
  visible,
  onClose,
  onAddText,
  editingClip,
  onUpdateText,
  currentPlayheadTime = 0,
  isInline = false,
}: TextModalProps) {
  const [inputText, setInputText] = useState("VIRAL HOOK");
  const [colorMode, setColorMode] = useState<"text" | "stroke" | "bg" | "border">("text");

  // Core Style States
  const [selectedColor, setSelectedColor] = useState("#FFFFFF");
  const [selectedBg, setSelectedBg] = useState("#FF0050");
  const [selectedFont, setSelectedFont] = useState(
    "Impact, Arial Black, sans-serif",
  );
  const [selectedFontSize, setSelectedFontSize] = useState(26);
  const [selectedBorderColor, setSelectedBorderColor] = useState<
    string | undefined
  >(undefined);
  const [selectedBorderWidth, setSelectedBorderWidth] = useState<number>(0);
  const [selectedBorderRadius, setSelectedBorderRadius] = useState<number>(10);
  const [selectedTextEffect, setSelectedTextEffect] = useState<string>("none");
  const [selectedStrokeColor, setSelectedStrokeColor] = useState<
    string | undefined
  >(undefined);
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState<number>(0);
  const [selectedTextAlign, setSelectedTextAlign] = useState<
    "left" | "center" | "right"
  >("center");
  const [selectedFontWeight, setSelectedFontWeight] = useState<
    "normal" | "bold" | "800"
  >("800");
  const [selectedUppercase, setSelectedUppercase] = useState<boolean>(false);

  const [selectedScale, setSelectedScale] = useState<number>(1.0);
  const [selectedRotation, setSelectedRotation] = useState<number>(0);
  const [selectedPosition, setSelectedPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 50, y: 35 });
  const [duration, setDuration] = useState(3.0);

  const lastLoadedClipIdRef = useRef<string | null>(null);
  const wasVisibleRef = useRef<boolean>(false);
  const isInitialLoadFlagRef = useRef<boolean>(true);
  const editingClipRef = useRef(editingClip);
  editingClipRef.current = editingClip;

  const [isListening, setIsListening] = useState(false);
  const recognitionSessionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionSessionRef.current) {
        try {
          recognitionSessionRef.current.stop();
        } catch (_) {}
        recognitionSessionRef.current = null;
      }
    };
  }, []);

  const handleToggleSpeechToText = () => {
    if (isListening) {
      if (recognitionSessionRef.current) {
        try {
          recognitionSessionRef.current.stop();
        } catch (_) {}
        recognitionSessionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    if (isLiveSpeechRecognitionSupported()) {
      const session = startLiveSpeechRecognition(
        "auto",
        (transcript: string) => {
          if (transcript) {
            setInputText(transcript);
          }
        },
        (err: any) => {
          console.warn("Speech recognition error:", err);
          setIsListening(false);
        }
      );
      if (session) {
        recognitionSessionRef.current = session;
        setIsListening(true);
      } else {
        Alert.alert(
          "Microphone Unavailable",
          "Speech recognition could not be started. Please check microphone permissions."
        );
      }
    } else {
      Alert.alert(
        "Speech to Text",
        "Live speech-to-text dictation is supported in modern browsers like Chrome, Edge, and Safari."
      );
    }
  };

  useEffect(() => {
    if (visible) {
      const isNewlyOpened = !wasVisibleRef.current;
      const currentClipId = editingClip ? editingClip.id : null;
      const isClipChanged = currentClipId !== lastLoadedClipIdRef.current;

      if (isNewlyOpened || isClipChanged) {
        lastLoadedClipIdRef.current = currentClipId;
        isInitialLoadFlagRef.current = true;
        if (editingClip) {
          setInputText(editingClip.text || "");
          setDuration(editingClip.duration || 3.0);
          setSelectedColor(editingClip.style?.color || "#FFFFFF");
          setSelectedBg(editingClip.style?.backgroundColor || "transparent");
          if (editingClip.style?.fontFamily)
            setSelectedFont(editingClip.style.fontFamily);
          if (editingClip.style?.fontSize)
            setSelectedFontSize(editingClip.style.fontSize);
          setSelectedBorderColor(editingClip.style?.borderColor);
          setSelectedBorderWidth(
            editingClip.style?.borderWidth !== undefined
              ? editingClip.style.borderWidth
              : editingClip.style?.borderColor ? 2 : 0
          );
          setSelectedBorderRadius(
            editingClip.style?.borderRadius !== undefined
              ? editingClip.style.borderRadius
              : 10
          );
          setSelectedTextEffect(editingClip.style?.textEffect || "none");
          setSelectedStrokeColor(editingClip.style?.strokeColor);
          setSelectedStrokeWidth(
            editingClip.style?.strokeWidth !== undefined
              ? editingClip.style.strokeWidth
              : editingClip.style?.strokeColor ? 2 : 0
          );
          if (editingClip.style?.textAlign)
            setSelectedTextAlign(editingClip.style.textAlign as any);
          if (editingClip.style?.fontWeight)
            setSelectedFontWeight(editingClip.style.fontWeight as any);
          if (editingClip.style?.uppercase !== undefined)
            setSelectedUppercase(editingClip.style.uppercase);
          setSelectedScale(editingClip.scale ?? 1.0);
          setSelectedRotation(editingClip.rotation ?? 0);
          if (editingClip.position) setSelectedPosition(editingClip.position);
        } else {
          setInputText("VIRAL HOOK");
          setDuration(3.0);
          setSelectedColor("#FFFFFF");
          setSelectedBg("#FF0050");
          setSelectedBorderColor(undefined);
          setSelectedBorderWidth(0);
          setSelectedBorderRadius(10);
          setSelectedTextEffect("none");
          setSelectedStrokeColor(undefined);
          setSelectedStrokeWidth(0);
          setSelectedTextAlign("center");
          setSelectedFontWeight("800");
          setSelectedUppercase(false);
          setSelectedScale(1.0);
          setSelectedRotation(0);
          setSelectedPosition({ x: 50, y: 35 });
        }
      }
    } else {
      if (recognitionSessionRef.current) {
        try {
          recognitionSessionRef.current.stop();
        } catch (_) {}
        recognitionSessionRef.current = null;
      }
      setIsListening(false);
      lastLoadedClipIdRef.current = null;
      isInitialLoadFlagRef.current = true;
    }
    wasVisibleRef.current = visible;
  }, [visible, editingClip]);

  const buildBaseStyle = () => {
    let shadowColor: string | undefined = undefined;
    let shadowRadius = 0;
    let shadowOffset = { width: 0, height: 0 };

    if (selectedTextEffect === "neon") {
      shadowColor = selectedColor || "#00F2FE";
      shadowRadius = 18;
    } else if (selectedTextEffect === "3d") {
      shadowColor = "#000000";
      shadowRadius = 4;
      shadowOffset = { width: 4, height: 4 };
    } else if (selectedTextEffect === "shadow") {
      shadowColor = "rgba(0,0,0,0.85)";
      shadowRadius = 12;
      shadowOffset = { width: 3, height: 4 };
    } else if (selectedTextEffect === "cyber") {
      shadowColor = "#FF0050";
      shadowRadius = 8;
      shadowOffset = { width: 3, height: 2 };
    } else if (selectedTextEffect === "gold") {
      shadowColor = "#FFE600";
      shadowRadius = 16;
      shadowOffset = { width: 0, height: 0 };
    } else if (selectedTextEffect === "glitch") {
      shadowColor = "#00F2FE";
      shadowRadius = 6;
      shadowOffset = { width: -3, height: 0 };
    }

    const hasBg = Boolean(
      selectedBg && selectedBg !== "transparent" && selectedBg !== "none"
    );
    const hasBorder = Boolean(
      selectedBorderColor &&
      selectedBorderColor !== "transparent" &&
      selectedBorderColor !== "none" &&
      selectedBorderWidth > 0
    );

    return {
      color: selectedColor,
      fontSize: selectedFontSize,
      fontWeight: selectedFontWeight as any,
      fontFamily: selectedFont,
      backgroundColor: hasBg ? selectedBg : "transparent",
      borderColor: hasBorder ? selectedBorderColor : undefined,
      borderWidth: hasBorder ? selectedBorderWidth : 0,
      borderRadius: selectedBorderRadius,
      paddingHorizontal: hasBg || hasBorder ? 14 : 0,
      paddingVertical: hasBg || hasBorder ? 7 : 0,
      textAlign: selectedTextAlign,
      uppercase: selectedUppercase,
      textShadowColor: shadowColor,
      textShadowRadius: shadowRadius,
      textShadowOffset: shadowOffset,
      textEffect: selectedTextEffect,
      strokeColor:
        selectedStrokeWidth > 0 &&
        selectedStrokeColor &&
        selectedStrokeColor !== "none" &&
        selectedStrokeColor !== "transparent"
          ? selectedStrokeColor
          : undefined,
      strokeWidth: selectedStrokeWidth > 0 ? selectedStrokeWidth : 0,
    };
  };

  // Live apply updates directly to editingClip in real time
  useEffect(() => {
    const target = editingClipRef.current || editingClip;
    if (!visible || !target || !onUpdateText) return;
    if (isInitialLoadFlagRef.current) {
      isInitialLoadFlagRef.current = false;
      return;
    }

    const baseStyle = buildBaseStyle();
    let updatedWords = (target as any).words;
    if (updatedWords && inputText.trim()) {
      const newWordStrings = inputText.trim().split(/\s+/).filter(Boolean);
      const clipStart = target.startTime || 0;
      const clipDur = duration || target.duration || 3.0;
      const wDur = clipDur / Math.max(1, newWordStrings.length);
      updatedWords = newWordStrings.map((w: string, wIdx: number) => ({
        word: w,
        start: Number((clipStart + wIdx * wDur).toFixed(2)),
        end: Number((clipStart + (wIdx + 1) * wDur).toFixed(2)),
      }));
    }

    const finalText = selectedUppercase ? inputText.toUpperCase() : inputText;

    const updatedClip: TextClip = {
      ...target,
      text: finalText,
      duration: duration || target.duration || 3.0,
      animation: target.animation,
      scale: selectedScale ?? target.scale ?? 1.0,
      rotation: selectedRotation ?? target.rotation ?? 0,
      position: selectedPosition ?? target.position ?? { x: 50, y: 35 },
      ...(updatedWords ? { words: updatedWords } : {}),
      style: {
        ...target.style,
        ...baseStyle,
      },
    };
    onUpdateText(updatedClip);
  }, [
    inputText,
    selectedColor,
    selectedBg,
    selectedFont,
    selectedFontSize,
    selectedBorderColor,
    selectedBorderWidth,
    selectedBorderRadius,
    selectedTextEffect,
    selectedStrokeColor,
    selectedStrokeWidth,
    selectedTextAlign,
    selectedFontWeight,
    selectedUppercase,
    selectedScale,
    selectedRotation,
    selectedPosition,
    duration,
  ]);

  const handleSelectFont = (font: FontDefinition) => {
    loadGoogleFont(font);
    setSelectedFont(font.fontFamily || font.id);
  };

  const handleAddTextClip = () => {
    if (!inputText.trim()) return;
    const baseStyle = buildBaseStyle();
    const finalText = selectedUppercase ? inputText.toUpperCase() : inputText;
    const textClip: TextClip = {
      id: "clip-t-" + Date.now(),
      text: finalText,
      startTime: currentPlayheadTime,
      duration: duration || 3.0,
      position: selectedPosition,
      scale: selectedScale,
      rotation: selectedRotation,
      animation: undefined,
      style: baseStyle,
    };
    onAddText(textClip);
  };

  const handleSave = () => {
    if (editingClip) {
      onClose();
    } else {
      handleAddTextClip();
    }
  };

  const sheetContent = (
    <View style={[styles.sheetContainer, styles.inlineSheetContainer]}>
      {/* Unified Live Header */}
      {!isInline ? (
        <ModalHeader
          title={editingClip ? "Edit Text" : "Add Text"}
          iconName="text"
          onClose={onClose}
          onDone={handleSave}
          doneText={editingClip ? "Save" : "Add"}
          doneDisabled={!inputText.trim()}
        />
      ) : null}

      <ScrollView
        style={[styles.sheetBody, isInline && { paddingTop: 4 }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. INPUT ROW + SPEECH DICTATION + INLINE ACTION */}
        <View
          style={[
            styles.inputContainer,
            isListening && {
              borderColor: "#FF0050",
              backgroundColor: "rgba(255, 0, 80, 0.05)",
            },
          ]}
        >
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              isListening ? "Listening... Speak now" : "Type text..."
            }
            placeholderTextColor={isListening ? "#FF0050" : "#64748B"}
            returnKeyType="done"
            onSubmitEditing={handleSave}
            {...(Platform.OS === "web"
              ? {
                  onKeyDown: (e: any) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSave();
                    }
                  },
                }
              : {})}
          />
          {inputText.length > 0 && (
            <TouchableOpacity
              onPress={() => setInputText("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 6 }}
            >
              <Ionicons name="close-circle" size={15} color="#8E95A5" />
            </TouchableOpacity>
          )}

          {/* Speech to Text Microphone */}
          <TouchableOpacity
            onPress={handleToggleSpeechToText}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              marginRight: isInline && !editingClip ? 6 : 0,
              padding: 3,
              borderRadius: 4,
              backgroundColor: isListening
                ? "rgba(255, 0, 80, 0.2)"
                : "rgba(0, 242, 254, 0.08)",
            }}
            accessibilityLabel={
              isListening ? "Stop voice dictation" : "Speech to Text"
            }
          >
            <Ionicons
              name={isListening ? "mic" : "mic-outline"}
              size={14}
              color={isListening ? "#FF0050" : "#EDEDED"}
            />
          </TouchableOpacity>

          {isInline && !editingClip && (
            <TouchableOpacity
              onPress={handleAddTextClip}
              style={[
                styles.inlineApplyBtn,
                { opacity: inputText.trim() ? 1 : 0.4 },
              ]}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={13} color="#000000" />
              <Text
                style={{ color: "#000000", fontSize: 10.5, fontWeight: "700" }}
              >
                Add
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2. TYPOGRAPHY & FONT SIZE */}
        <View style={styles.controlGroup}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Font Size</Text>
          </View>

          {/* Full-Width Inline Slider (No Left Label) */}
          <CompactSliderInput
            value={selectedFontSize}
            min={10}
            max={96}
            step={1}
            unit="px"
            layout="inline"
            accentColor="#FFFFFF"
            showSteppers
            onChange={setSelectedFontSize}
          />

          {/* Horizontal Font Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalRow}
            contentContainerStyle={{ gap: 5, paddingVertical: 1 }}
          >
            {FONT_OPTIONS.map((f) => {
              const isActive =
                selectedFont === f.id || selectedFont === f.fontFamily;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.fontChip, isActive && styles.fontChipActive]}
                  onPress={() => handleSelectFont(f)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.fontChipText,
                      { fontFamily: f.fontFamily as any },
                      isActive && styles.fontChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionDivider} />

        {/* 3. COLOR STUDIO (Text | Stroke | Background | Border) */}
        <View style={styles.controlGroup}>
          {/* Segmented Color Target Switcher with Live Color Dots */}
          <View style={styles.colorModeBar}>
            <TouchableOpacity
              style={[
                styles.colorModeBtn,
                colorMode === "text" && styles.colorModeBtnActive,
              ]}
              onPress={() => setColorMode("text")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="text"
                size={12}
                color={colorMode === "text" ? "#00F2FE" : "#8E9AA8"}
              />
              <Text
                style={[
                  styles.colorModeBtnText,
                  colorMode === "text" && styles.colorModeBtnTextActive,
                ]}
                numberOfLines={1}
              >
                Text
              </Text>
              <View
                style={[
                  styles.colorModeDot,
                  {
                    backgroundColor:
                      selectedColor && selectedColor !== "transparent" && selectedColor !== "none"
                        ? selectedColor
                        : "#FFFFFF",
                  },
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.colorModeBtn,
                colorMode === "stroke" && styles.colorModeBtnActive,
              ]}
              onPress={() => setColorMode("stroke")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="brush-outline"
                size={12}
                color={colorMode === "stroke" ? "#00F2FE" : "#8E9AA8"}
              />
              <Text
                style={[
                  styles.colorModeBtnText,
                  colorMode === "stroke" && styles.colorModeBtnTextActive,
                ]}
                numberOfLines={1}
              >
                Stroke
              </Text>
              <View
                style={[
                  styles.colorModeDot,
                  {
                    backgroundColor:
                      selectedStrokeWidth > 0 && selectedStrokeColor && selectedStrokeColor !== "none"
                        ? selectedStrokeColor
                        : "transparent",
                    borderWidth: selectedStrokeWidth > 0 ? 0 : 1,
                    borderColor: "#64748B",
                  },
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.colorModeBtn,
                colorMode === "bg" && styles.colorModeBtnActive,
              ]}
              onPress={() => setColorMode("bg")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="square"
                size={11}
                color={colorMode === "bg" ? "#00F2FE" : "#8E9AA8"}
              />
              <Text
                style={[
                  styles.colorModeBtnText,
                  colorMode === "bg" && styles.colorModeBtnTextActive,
                ]}
                numberOfLines={1}
              >
                Background
              </Text>
              <View
                style={[
                  styles.colorModeDot,
                  {
                    backgroundColor:
                      selectedBg && selectedBg !== "transparent" && selectedBg !== "none"
                        ? selectedBg
                        : "transparent",
                    borderWidth:
                      selectedBg && selectedBg !== "transparent" && selectedBg !== "none" ? 0 : 1,
                    borderColor: "#64748B",
                  },
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.colorModeBtn,
                colorMode === "border" && styles.colorModeBtnActive,
              ]}
              onPress={() => setColorMode("border")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="square-outline"
                size={11}
                color={colorMode === "border" ? "#00F2FE" : "#8E9AA8"}
              />
              <Text
                style={[
                  styles.colorModeBtnText,
                  colorMode === "border" && styles.colorModeBtnTextActive,
                ]}
                numberOfLines={1}
              >
                Border
              </Text>
              <View
                style={[
                  styles.colorModeDot,
                  {
                    backgroundColor:
                      selectedBorderWidth > 0 && selectedBorderColor && selectedBorderColor !== "none"
                        ? selectedBorderColor
                        : "transparent",
                    borderWidth: selectedBorderWidth > 0 ? 0 : 1,
                    borderColor: "#64748B",
                  },
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* MODE 1: TEXT COLOR */}
          {colorMode === "text" && (
            <View style={{ gap: 6 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalRow}
                contentContainerStyle={{
                  alignItems: "center",
                  paddingVertical: 2,
                }}
              >
                {/* Custom Color Picker Button on FIRST POSITION */}
                <CustomColorPickerButton
                  value={
                    selectedColor && selectedColor !== "transparent" && selectedColor !== "none"
                      ? selectedColor
                      : "#FFFFFF"
                  }
                  presets={COLOR_SWATCHES}
                  onColorChange={setSelectedColor}
                  size={24}
                  shape="circle"
                  style={{ marginRight: 8 }}
                  accessibilityLabel="Pick custom text color"
                />

                {/* None Option Circle on SECOND POSITION */}
                <TouchableOpacity
                  style={[
                    styles.noneCircle,
                    (selectedColor === "transparent" || selectedColor === "none") &&
                      styles.noneCircleSelected,
                  ]}
                  onPress={() => setSelectedColor("transparent")}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="ban-outline"
                    size={13}
                    color={
                      selectedColor === "transparent" || selectedColor === "none"
                        ? "#EF4444"
                        : "#64748B"
                    }
                  />
                </TouchableOpacity>

                {/* Preset Color Swatches */}
                {COLOR_SWATCHES.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setSelectedColor(color)}
                      activeOpacity={0.75}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={
                            color === "#FFFFFF" || color === "#FFE600"
                              ? "#000000"
                              : "#FFFFFF"
                          }
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Text Formatting Toolbar (Bold, Uppercase, Alignment) */}
              <View style={styles.formatBar}>
                <TouchableOpacity
                  style={[
                    styles.formatBtn,
                    selectedFontWeight === "bold" && styles.formatBtnActive,
                  ]}
                  onPress={() =>
                    setSelectedFontWeight(
                      selectedFontWeight === "bold" ? "normal" : "bold"
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.formatBtnText,
                      selectedFontWeight === "bold" && styles.formatBtnTextActive,
                      { fontWeight: "bold" },
                    ]}
                  >
                    B
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatBtn,
                    selectedUppercase && styles.formatBtnActive,
                  ]}
                  onPress={() => setSelectedUppercase(!selectedUppercase)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.formatBtnText,
                      selectedUppercase && styles.formatBtnTextActive,
                    ]}
                  >
                    AA
                  </Text>
                </TouchableOpacity>

                <View style={{ width: 1, height: 16, backgroundColor: "#1C2436", marginHorizontal: 2 }} />

                <TouchableOpacity
                  style={[
                    styles.formatBtn,
                    selectedTextAlign === "left" && styles.formatBtnActive,
                  ]}
                  onPress={() => setSelectedTextAlign("left")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="filter-outline"
                    size={12}
                    color={selectedTextAlign === "left" ? "#FFFFFF" : "#8E9AA8"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatBtn,
                    selectedTextAlign === "center" && styles.formatBtnActive,
                  ]}
                  onPress={() => setSelectedTextAlign("center")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="menu-outline"
                    size={12}
                    color={selectedTextAlign === "center" ? "#FFFFFF" : "#8E9AA8"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatBtn,
                    selectedTextAlign === "right" && styles.formatBtnActive,
                  ]}
                  onPress={() => setSelectedTextAlign("right")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="list-outline"
                    size={12}
                    color={selectedTextAlign === "right" ? "#FFFFFF" : "#8E9AA8"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* MODE 2: STROKE (Color + Thickness together) */}
          {colorMode === "stroke" && (
            <View style={{ gap: 6 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalRow}
                contentContainerStyle={{
                  alignItems: "center",
                  paddingVertical: 2,
                }}
              >
                {/* Custom Color Picker Button on FIRST POSITION */}
                <CustomColorPickerButton
                  value={
                    selectedStrokeColor && selectedStrokeColor !== "none"
                      ? selectedStrokeColor
                      : "#FFFFFF"
                  }
                  presets={COLOR_SWATCHES}
                  onColorChange={(color) => {
                    setSelectedStrokeColor(color);
                    if (selectedStrokeWidth === 0) {
                      setSelectedStrokeWidth(2.5);
                    }
                  }}
                  size={24}
                  shape="circle"
                  style={{ marginRight: 8 }}
                  accessibilityLabel="Pick custom stroke color"
                />

                {/* None Option Circle on SECOND POSITION */}
                <TouchableOpacity
                  style={[
                    styles.noneCircle,
                    (selectedStrokeWidth === 0 ||
                      selectedStrokeColor === "none" ||
                      !selectedStrokeColor) &&
                      styles.noneCircleSelected,
                  ]}
                  onPress={() => {
                    setSelectedStrokeColor("none");
                    setSelectedStrokeWidth(0);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="ban-outline"
                    size={13}
                    color={
                      selectedStrokeWidth === 0 ||
                      selectedStrokeColor === "none" ||
                      !selectedStrokeColor
                        ? "#EF4444"
                        : "#64748B"
                    }
                  />
                </TouchableOpacity>

                {/* Preset Stroke Colors */}
                {COLOR_SWATCHES.map((color) => {
                  const isSelected =
                    selectedStrokeWidth > 0 && selectedStrokeColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => {
                        setSelectedStrokeColor(color);
                        if (selectedStrokeWidth === 0) {
                          setSelectedStrokeWidth(2.5);
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={
                            color === "#FFFFFF" || color === "#FFE600"
                              ? "#000000"
                              : "#FFFFFF"
                          }
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Stroke Thickness Contextual Slider */}
              <View style={styles.tabSlidersContainer}>
                <Text style={styles.subSliderTitle}>Stroke Thickness</Text>
                <CompactSliderInput
                  value={selectedStrokeWidth}
                  min={0}
                  max={16}
                  step={0.5}
                  unit="px"
                  layout="inline"
                  accentColor="#FFFFFF"
                  showSteppers
                  onChange={(val) => {
                    setSelectedStrokeWidth(val);
                    if (val > 0 && (!selectedStrokeColor || selectedStrokeColor === "none")) {
                      setSelectedStrokeColor("#000000");
                    }
                  }}
                />
              </View>
            </View>
          )}

          {/* MODE 3: BACKGROUND (Color + Corner Radius + Border together) */}
          {colorMode === "bg" && (
            <View style={{ gap: 6 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalRow}
                contentContainerStyle={{
                  alignItems: "center",
                  paddingVertical: 2,
                }}
              >
                {/* Custom Color Picker Button on FIRST POSITION */}
                <CustomColorPickerButton
                  value={
                    selectedBg && selectedBg !== "transparent" && selectedBg !== "none"
                      ? selectedBg
                      : "#FF0050"
                  }
                  presets={COLOR_SWATCHES}
                  onColorChange={(color) => setSelectedBg(color)}
                  size={24}
                  shape="circle"
                  style={{ marginRight: 8 }}
                  accessibilityLabel="Pick custom background color"
                />

                {/* None Option Circle on SECOND POSITION */}
                <TouchableOpacity
                  style={[
                    styles.noneCircle,
                    (!selectedBg || selectedBg === "transparent" || selectedBg === "none") &&
                      styles.noneCircleSelected,
                  ]}
                  onPress={() => setSelectedBg("transparent")}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="ban-outline"
                    size={13}
                    color={
                      !selectedBg || selectedBg === "transparent" || selectedBg === "none"
                        ? "#EF4444"
                        : "#64748B"
                    }
                  />
                </TouchableOpacity>

                {/* Preset Background Swatches */}
                {COLOR_SWATCHES.map((color) => {
                  const isSelected = selectedBg === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setSelectedBg(color)}
                      activeOpacity={0.75}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={
                            color === "#FFFFFF" || color === "#FFE600"
                              ? "#000000"
                              : "#FFFFFF"
                          }
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Corner Radius Slider */}
              <View style={styles.tabSlidersContainer}>
                <Text style={styles.subSliderTitle}>Corner Radius</Text>
                <CompactSliderInput
                  value={selectedBorderRadius}
                  min={0}
                  max={40}
                  step={1}
                  unit="px"
                  layout="inline"
                  accentColor="#00F2FE"
                  showSteppers
                  onChange={setSelectedBorderRadius}
                />
              </View>
            </View>
          )}

          {/* MODE 4: BORDER (Box Border Color + Thickness together) */}
          {colorMode === "border" && (
            <View style={{ gap: 6 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalRow}
                contentContainerStyle={{
                  alignItems: "center",
                  paddingVertical: 2,
                }}
              >
                {/* Custom Color Picker Button on FIRST POSITION */}
                <CustomColorPickerButton
                  value={
                    selectedBorderWidth > 0 && selectedBorderColor && selectedBorderColor !== "none"
                      ? selectedBorderColor
                      : "#FFFFFF"
                  }
                  presets={COLOR_SWATCHES}
                  onColorChange={(color) => {
                    setSelectedBorderColor(color);
                    if (selectedBorderWidth === 0) {
                      setSelectedBorderWidth(2);
                    }
                  }}
                  size={24}
                  shape="circle"
                  style={{ marginRight: 8 }}
                  accessibilityLabel="Pick custom border color"
                />

                {/* None Option Circle on SECOND POSITION */}
                <TouchableOpacity
                  style={[
                    styles.noneCircle,
                    (selectedBorderWidth === 0 ||
                      !selectedBorderColor ||
                      selectedBorderColor === "none" ||
                      selectedBorderColor === "transparent") &&
                      styles.noneCircleSelected,
                  ]}
                  onPress={() => {
                    setSelectedBorderColor("none");
                    setSelectedBorderWidth(0);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="ban-outline"
                    size={13}
                    color={
                      selectedBorderWidth === 0 ||
                      !selectedBorderColor ||
                      selectedBorderColor === "none" ||
                      selectedBorderColor === "transparent"
                        ? "#EF4444"
                        : "#64748B"
                    }
                  />
                </TouchableOpacity>

                {/* Preset Border Colors */}
                {COLOR_SWATCHES.map((color) => {
                  const isSelected =
                    selectedBorderWidth > 0 && selectedBorderColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => {
                        setSelectedBorderColor(color);
                        if (selectedBorderWidth === 0) {
                          setSelectedBorderWidth(2);
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={
                            color === "#FFFFFF" || color === "#FFE600"
                              ? "#000000"
                              : "#FFFFFF"
                          }
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Border Thickness Contextual Slider */}
              <View style={styles.tabSlidersContainer}>
                <Text style={styles.subSliderTitle}>Border Thickness</Text>
                <CompactSliderInput
                  value={selectedBorderWidth}
                  min={0}
                  max={10}
                  step={1}
                  unit="px"
                  layout="inline"
                  accentColor="#00F2FE"
                  showSteppers
                  onChange={(val) => {
                    setSelectedBorderWidth(val);
                    if (val > 0 && (!selectedBorderColor || selectedBorderColor === "none")) {
                      setSelectedBorderColor("#FFFFFF");
                    }
                  }}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionDivider} />

        {/* 5. EFFECTS */}
        <View style={styles.controlGroup}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Effects & Glow</Text>
            {selectedTextEffect !== "none" && (
              <TouchableOpacity
                onPress={() => setSelectedTextEffect("none")}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 8.5,
                    color: "#8E8E93",
                    fontWeight: "400",
                  }}
                >
                  Reset
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalRow}
            contentContainerStyle={{ paddingVertical: 1 }}
          >
            {TEXT_EFFECT_OPTIONS.map((eff) => {
              const isActive = selectedTextEffect === eff.id;
              return (
                <TouchableOpacity
                  key={eff.id}
                  style={[
                    styles.effectChip,
                    isActive && styles.effectChipActive,
                  ]}
                  onPress={() => setSelectedTextEffect(eff.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={eff.icon as any}
                    size={12}
                    color={isActive ? "#FFFFFF" : "#8E8E93"}
                  />
                  <Text
                    style={[
                      styles.effectChipText,
                      isActive && styles.effectChipTextActive,
                    ]}
                  >
                    {eff.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}
