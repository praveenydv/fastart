import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import { FastArtProject, TextClip, CaptionClip } from "../../types/project";
import {
  CAPTION_STYLE_PRESETS,
  CAPTION_LANGUAGES,
  CaptionStylePreset,
  generateAutoCaptions,
  isLiveSpeechRecognitionSupported,
  startLiveSpeechRecognition,
} from "../../services/aiCaptionEngine";
import { loadAllProjects } from "../../utils/storage";

interface AutoCaptionModalProps {
  visible: boolean;
  onClose: () => void;
  project: FastArtProject | null;
  onAddCaptions: (clips: CaptionClip[]) => void;
}

export default function AutoCaptionModal({
  visible,
  onClose,
  project,
  onAddCaptions,
}: AutoCaptionModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [selectedPresetId, setSelectedPresetId] = useState("mrbeast");
  const [customScript, setCustomScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationSession, setDictationSession] = useState<{ stop: () => void } | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    if (!visible && isDictating && dictationSession) {
      dictationSession.stop();
      setDictationSession(null);
      setIsDictating(false);
    }
  }, [visible, isDictating, dictationSession]);

  const activePreset: CaptionStylePreset =
    CAPTION_STYLE_PRESETS.find((p) => p.id === selectedPresetId) ||
    CAPTION_STYLE_PRESETS[0];

  const handleToggleLiveDictation = () => {
    if (isDictating && dictationSession) {
      dictationSession.stop();
      setDictationSession(null);
      setIsDictating(false);
      soundEngine.playSfx("click");
    } else {
      soundEngine.playSfx("click");
      const session = startLiveSpeechRecognition(
        selectedLanguage,
        (text) => {
          setCustomScript(text);
        },
        (err) => {
          console.warn("Live speech dictation error:", err);
          setIsDictating(false);
          setStatusText("Microphone dictation error: " + (err?.message || "Check permissions"));
        }
      );
      if (session) {
        setDictationSession(session);
        setIsDictating(true);
        setStatusText("Listening... Speak clearly to dictate captions.");
      } else {
        setStatusText("Speech recognition not supported in this browser. Please type or paste script.");
      }
    }
  };

  const handleGenerate = async () => {
    const targetProject = project || loadAllProjects()[0] || null;
    if (!targetProject) {
      setStatusText("Please open or create a project first.");
      return;
    }
    soundEngine.playSfx("click");
    setIsGenerating(true);
    setProgressPct(10);
    setStatusText("Analyzing master timeline audio...");

    try {
      const phrases = customScript.trim()
        ? customScript
            .split(/[\n,.;!?]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : undefined;

      const generated = await generateAutoCaptions(
        targetProject,
        selectedLanguage,
        selectedPresetId,
        phrases,
        (pct, status) => {
          setProgressPct(pct);
          setStatusText(status);
        }
      );

      soundEngine.playSfx("pop");
      onAddCaptions(generated);
      onClose();
    } catch (err: any) {
      console.error("FastArt: AutoCaption error", err);
      setStatusText(err.message || "Failed to generate captions.");
      soundEngine.playSfx("click");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="chatbox-ellipses-outline" size={18} color="#00F2FE" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Auto-Captions (Speech AI)</Text>
                <Text style={styles.headerSubtitle}>
                  Transcribe video speech into viral animated captions
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                soundEngine.playSfx("click");
                onClose();
              }}
              style={styles.closeBtn}
              activeOpacity={0.7}
              disabled={isGenerating}
            >
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Live Template Preview Banner */}
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>LIVE STYLE PREVIEW</Text>
              <View
                style={[
                  styles.previewBox,
                  activePreset.bgColor !== "transparent" && {
                    backgroundColor: activePreset.bgColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.previewText,
                    {
                      color: activePreset.color,
                      fontFamily: activePreset.fontFamily as any,
                      fontSize: activePreset.fontSize - 4,
                      fontWeight: activePreset.fontWeight,
                    },
                  ]}
                >
                  {activePreset.previewText}
                </Text>
              </View>
              <Text style={styles.previewDesc}>{activePreset.desc}</Text>
            </View>

            {/* 1. Language Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. SPOKEN LANGUAGE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalRow}
              >
                {CAPTION_LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguage === lang.id;
                  return (
                    <TouchableOpacity
                      key={lang.id}
                      style={[styles.langPill, isSelected && styles.langPillActive]}
                      onPress={() => {
                        soundEngine.playSfx("click");
                        setSelectedLanguage(lang.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.langPillText,
                          isSelected && styles.langPillTextActive,
                        ]}
                      >
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2. Viral Caption Style Templates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. CAPTION STYLE TEMPLATE</Text>
              <View style={styles.templatesGrid}>
                {CAPTION_STYLE_PRESETS.map((tmpl) => {
                  const isSelected = selectedPresetId === tmpl.id;
                  return (
                    <TouchableOpacity
                      key={tmpl.id}
                      style={[
                        styles.templateCard,
                        isSelected && styles.templateCardActive,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx("pop");
                        setSelectedPresetId(tmpl.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.cardHeader}>
                        <Text
                          style={[
                            styles.templateTitle,
                            isSelected && { color: "#00F2FE" },
                          ]}
                        >
                          {tmpl.name}
                        </Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color="#00F2FE"
                          />
                        )}
                      </View>
                      <Text style={styles.templateDesc}>{tmpl.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Optional Custom Script Override or Live Mic Dictation */}
            <View style={styles.section}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>3. CUSTOM SCRIPT / TRANSCRIPT (OPTIONAL)</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {customScript.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        soundEngine.playSfx("click");
                        setCustomScript("");
                      }}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, color: "#8E95A5" }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                  {isLiveSpeechRecognitionSupported() && (
                    <TouchableOpacity
                      onPress={handleToggleLiveDictation}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: isDictating ? "#EF4444" : "rgba(0, 242, 254, 0.15)",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isDictating ? "#EF4444" : "#00F2FE",
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isDictating ? "mic" : "mic-outline"}
                        size={13}
                        color={isDictating ? "#FFFFFF" : "#00F2FE"}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: isDictating ? "#FFFFFF" : "#00F2FE",
                        }}
                      >
                        {isDictating ? "Listening..." : "Live Mic"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <TextInput
                style={styles.scriptInput}
                placeholder="Paste speech transcript lines to sync timings, tap Live Mic to dictate, or leave empty for auto audio detection..."
                placeholderTextColor="#4B5563"
                value={customScript}
                onChangeText={setCustomScript}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            {isGenerating ? (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[styles.progressBarFill, { width: `${progressPct}%` }]}
                  />
                </View>
                <View style={styles.progressStatusRow}>
                  <ActivityIndicator size="small" color="#00F2FE" />
                  <Text style={styles.statusText}>{statusText}</Text>
                  <Text style={styles.pctText}>{progressPct}%</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={handleGenerate}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={18} color="#000000" />
                <Text style={styles.generateBtnText}>Generate Auto-Captions</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0E1118",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "84%",
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 1.5,
    alignSelf: "center",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#8E95A5",
    fontSize: 11,
  },
  closeBtn: {
    padding: 6,
  },
  contentScroll: {
    padding: 16,
  },
  previewCard: {
    backgroundColor: "#141824",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#22293A",
    alignItems: "center",
    marginBottom: 16,
  },
  previewLabel: {
    color: "#8E95A5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  previewBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  previewText: {
    textAlign: "center",
    letterSpacing: 0.5,
  },
  previewDesc: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 6,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  horizontalRow: {
    flexDirection: "row",
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#141824",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#22293A",
    marginRight: 8,
  },
  langPillActive: {
    backgroundColor: "#00F2FE",
    borderColor: "#00F2FE",
  },
  langPillText: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
  },
  langPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  templatesGrid: {
    gap: 8,
  },
  templateCard: {
    backgroundColor: "#141824",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#22293A",
  },
  templateCardActive: {
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderColor: "#00F2FE",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  templateTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  templateDesc: {
    color: "#8E95A5",
    fontSize: 12,
    marginTop: 2,
  },
  scriptInput: {
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#22293A",
    borderRadius: 10,
    padding: 10,
    color: "#FFFFFF",
    fontSize: 12,
    minHeight: 64,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  generateBtn: {
    flexDirection: "row",
    backgroundColor: "#00F2FE",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  generateBtnText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "900",
  },
  progressContainer: {
    gap: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#1E2333",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 3,
  },
  progressStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    flex: 1,
    color: "#8E95A5",
    fontSize: 12,
  },
  pctText: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "800",
  },
});
