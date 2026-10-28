import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { TextClip } from "../../types/project";
import {
  startLiveSpeechRecognition,
  isLiveSpeechRecognitionSupported,
} from "../../services/aiCaptionEngine";
import { styles } from "./Text/TextModalStyles";
import TextFontTab from "./Text/TextFontTab";
import TextStyleTab from "./Text/TextStyleTab";
import TextEffectsTab from "./Text/TextEffectsTab";

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
  const [selectedColor, setSelectedColor] = useState("#FFFFFF");
  const [selectedBg, setSelectedBg] = useState("#FF0050");
  const [selectedFont, setSelectedFont] = useState(
    "Impact, Arial Black, sans-serif",
  );
  const [selectedFontSize, setSelectedFontSize] = useState(26);
  const [selectedBorderColor, setSelectedBorderColor] = useState<
    string | undefined
  >(undefined);
  const [selectedTextEffect, setSelectedTextEffect] = useState<string>("none");
  const [selectedStrokeColor, setSelectedStrokeColor] = useState<
    string | undefined
  >(undefined);
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState<number>(2);
  const [selectedScale, setSelectedScale] = useState<number>(1.0);
  const [selectedRotation, setSelectedRotation] = useState<number>(0);
  const [selectedPosition, setSelectedPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 50, y: 35 });
  const [duration, setDuration] = useState(3.0);
  const [activeTab, setActiveTab] = useState<"font" | "style" | "effects">(
    "font",
  );
  const lastLoadedClipIdRef = useRef<string | null>(null);
  const wasVisibleRef = useRef<boolean>(false);
  const isInitialLoadRef = useRef<boolean>(true);

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
      soundEngine.playSfx("click");
      return;
    }

    soundEngine.playSfx("pop");
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
        isInitialLoadRef.current = true;
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
          setSelectedTextEffect(editingClip.style?.textEffect || "none");
          setSelectedStrokeColor(editingClip.style?.strokeColor);
          setSelectedStrokeWidth(editingClip.style?.strokeWidth || 2);
          setSelectedScale(editingClip.scale ?? 1.0);
          setSelectedRotation(editingClip.rotation ?? 0);
          if (editingClip.position) setSelectedPosition(editingClip.position);
        } else {
          setInputText("VIRAL HOOK");
          setDuration(3.0);
          setSelectedColor("#FFFFFF");
          setSelectedBg("#FF0050");
          setSelectedBorderColor(undefined);
          setSelectedTextEffect("none");
          setSelectedStrokeColor(undefined);
          setSelectedStrokeWidth(2);
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
      isInitialLoadRef.current = true;
    }
    wasVisibleRef.current = visible;
  }, [visible, editingClip]);

  const buildBaseStyle = () => {
    let shadowColor = "rgba(0,0,0,0.5)";
    let shadowRadius = 8;
    let shadowOffset = { width: 0, height: 0 };

    if (selectedTextEffect === "neon") {
      shadowColor = selectedBorderColor || selectedColor || "#00F2FE";
      shadowRadius = 18;
    } else if (selectedTextEffect === "3d") {
      shadowColor = "#000000";
      shadowRadius = 4;
      shadowOffset = { width: 4, height: 4 };
    } else if (selectedTextEffect === "shadow") {
      shadowColor = "rgba(0,0,0,0.9)";
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
    } else if (selectedBorderColor) {
      shadowColor = selectedBorderColor;
      shadowRadius = 8;
    }

    return {
      color: selectedColor,
      fontSize: selectedFontSize,
      fontWeight: "800" as const,
      fontFamily: selectedFont,
      backgroundColor: selectedBg,
      borderColor: selectedBorderColor,
      borderWidth: selectedBorderColor ? 2 : 0,
      paddingHorizontal: selectedBg !== "transparent" ? 16 : 0,
      paddingVertical: selectedBg !== "transparent" ? 8 : 0,
      borderRadius: 10,
      textAlign: "center" as const,
      textShadowColor: shadowColor,
      textShadowRadius: shadowRadius,
      textShadowOffset: shadowOffset,
      textEffect: selectedTextEffect,
      strokeColor: selectedStrokeColor,
      strokeWidth: selectedStrokeWidth,
    };
  };

  // Live apply updates directly to editingClip in real time
  useEffect(() => {
    if (!visible || !editingClip || !onUpdateText) return;
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    const baseStyle = buildBaseStyle();
    let updatedWords = (editingClip as any).words;
    if (updatedWords && inputText.trim()) {
      const newWordStrings = inputText.trim().split(/\s+/).filter(Boolean);
      const clipStart = editingClip.startTime || 0;
      const clipDur = duration || editingClip.duration || 3.0;
      const wDur = clipDur / Math.max(1, newWordStrings.length);
      updatedWords = newWordStrings.map((w: string, wIdx: number) => ({
        word: w,
        start: Number((clipStart + wIdx * wDur).toFixed(2)),
        end: Number((clipStart + (wIdx + 1) * wDur).toFixed(2)),
      }));
    }

    const updatedClip: TextClip = {
      ...editingClip,
      text: inputText,
      duration: duration || editingClip.duration || 3.0,
      animation: editingClip.animation,
      scale: editingClip.scale ?? selectedScale,
      rotation: editingClip.rotation ?? selectedRotation,
      position: editingClip.position ?? selectedPosition,
      ...(updatedWords ? { words: updatedWords } : {}),
      style: {
        ...editingClip.style,
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
    selectedTextEffect,
    selectedStrokeColor,
    selectedStrokeWidth,
    duration,
  ]);

  const handleApplyTemplate = (tmpl: any) => {
    setInputText(tmpl.text);
    setSelectedColor(tmpl.style?.color || "#FFFFFF");
    setSelectedBg(tmpl.style?.backgroundColor || "transparent");
    if (tmpl.style?.fontFamily) setSelectedFont(tmpl.style.fontFamily);
    if (tmpl.style?.fontSize) setSelectedFontSize(tmpl.style.fontSize);
    if (tmpl.style?.borderColor) setSelectedBorderColor(tmpl.style.borderColor);
    if (tmpl.style?.textEffect) setSelectedTextEffect(tmpl.style.textEffect);
    soundEngine.playSfx("click");
  };

  const handleAddTextClip = () => {
    if (!inputText.trim()) return;
    const baseStyle = buildBaseStyle();
    const textClip: TextClip = {
      id: "clip-t-" + Date.now(),
      text: inputText,
      startTime: currentPlayheadTime,
      duration: duration || 3.0,
      position: selectedPosition,
      scale: selectedScale,
      rotation: selectedRotation,
      animation: undefined,
      style: baseStyle,
    };
    soundEngine.playSfx("pop");
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
      {/* Unified Live Header - only shown in standalone modal to avoid duplicate header on desktop */}
      {!isInline ? (
        <View style={styles.sheetHeader}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="text" size={16} color="#FFFFFF" />
            <Text style={styles.sheetTitle}>
              {editingClip ? "Edit Text" : "Add Text"}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!editingClip && (
              <TouchableOpacity
                onPress={handleAddTextClip}
                style={[
                  {
                    paddingHorizontal: 10,
                    height: 24,
                    borderRadius: 6,
                    backgroundColor: '#FFFFFF',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  },
                  !inputText.trim() && { opacity: 0.4 },
                ]}
                disabled={!inputText.trim()}
                activeOpacity={0.7}
                accessibilityLabel="Add text to track"
              >
                <Ionicons name="add" size={13} color="#08090E" />
                <Text style={{ color: '#08090E', fontSize: 10.5, fontWeight: '700' }}>
                  Add to Track
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close panel"
            >
              <Ionicons name="close" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

          <ScrollView
            style={[styles.sheetBody, isInline && { paddingTop: 10 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Input Box + Inline Add Button */}
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
                placeholder={isListening ? "Listening... Speak now" : "Type your viral text..."}
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
                  <Ionicons name="close-circle" size={18} color="#8E95A5" />
                </TouchableOpacity>
              )}

              {/* Speech to Text Microphone inside text input */}
              <TouchableOpacity
                onPress={handleToggleSpeechToText}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  marginRight: isInline && !editingClip ? 6 : 0,
                  padding: 4,
                  borderRadius: 6,
                  backgroundColor: isListening ? "rgba(255, 0, 80, 0.2)" : "rgba(0, 242, 254, 0.08)",
                }}
                accessibilityLabel={isListening ? "Stop voice dictation" : "Speech to Text"}
              >
                <Ionicons
                  name={isListening ? "mic" : "mic-outline"}
                  size={17}
                  color={isListening ? "#FF0050" : "#00F2FE"}
                />
              </TouchableOpacity>
              {isInline && !editingClip && (
                <TouchableOpacity
                  onPress={handleAddTextClip}
                  style={{
                    backgroundColor: "#00F2FE",
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    opacity: inputText.trim() ? 1 : 0.4,
                  }}
                  disabled={!inputText.trim()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={14} color="#000000" />
                  <Text style={{ color: "#000000", fontSize: 11, fontWeight: "700" }}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Category Tab Bar for Modern Ergonomic Text Configuration */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12, flexGrow: 0 }}
              contentContainerStyle={[styles.tabBar, { marginBottom: 0, minWidth: "100%" }]}
            >
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === "font" && styles.tabBtnActive,
                ]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setActiveTab("font");
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="text-outline"
                  size={13}
                  color={activeTab === "font" ? "#00F2FE" : "#8E9AA8"}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "font" && styles.tabBtnTextActive,
                  ]}
                >
                  Font
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === "style" && styles.tabBtnActive,
                ]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setActiveTab("style");
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="color-palette-outline"
                  size={13}
                  color={activeTab === "style" ? "#00F2FE" : "#8E9AA8"}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "style" && styles.tabBtnTextActive,
                  ]}
                >
                  Style
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === "effects" && styles.tabBtnActive,
                ]}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setActiveTab("effects");
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={13}
                  color={activeTab === "effects" ? "#00F2FE" : "#8E9AA8"}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "effects" && styles.tabBtnTextActive,
                  ]}
                >
                  Effects
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {activeTab === "font" && (
              <TextFontTab
                selectedFont={selectedFont}
                setSelectedFont={setSelectedFont}
                selectedFontSize={selectedFontSize}
                setSelectedFontSize={setSelectedFontSize}
              />
            )}

            {activeTab === "style" && (
              <TextStyleTab
                selectedColor={selectedColor}
                setSelectedColor={setSelectedColor}
                selectedBg={selectedBg}
                setSelectedBg={setSelectedBg}
                selectedStrokeColor={selectedStrokeColor}
                setSelectedStrokeColor={setSelectedStrokeColor}
                selectedStrokeWidth={selectedStrokeWidth}
                setSelectedStrokeWidth={setSelectedStrokeWidth}
              />
            )}

            {activeTab === "effects" && (
              <TextEffectsTab
                selectedTextEffect={selectedTextEffect}
                setSelectedTextEffect={setSelectedTextEffect}
                selectedBorderColor={selectedBorderColor}
                setSelectedBorderColor={setSelectedBorderColor}
              />
            )}
          </ScrollView>
        </View>
  );

  if (!visible) return null;
  return <View style={styles.inlineWrapper}>{sheetContent}</View>;
}
