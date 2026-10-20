import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../utils/audioEngine";
import {
  openMediaService,
  OpenAudioItem,
  OpenMediaItem,
} from "../../services/openMediaService";
import { loadUploadedMedia, loadUploadedAudio } from "../../utils/storage";
import {
  FastArtProject,
  VideoClip,
  AudioClip,
  createDefaultProject,
} from "../../types/project";

interface AutoCutModalProps {
  visible: boolean;
  onClose: () => void;
  onAutoCutGenerated: (project: FastArtProject) => void;
}

const WebInput: any = Platform.OS === "web" ? "input" : View;
const WebSpan: any = Platform.OS === "web" ? "span" : Text;
const WebLabel: any = Platform.OS === "web" ? "label" : View;

export default function AutoCutModal({
  visible,
  onClose,
  onAutoCutGenerated,
}: AutoCutModalProps) {
  const [availableVideos, setAvailableVideos] = useState<any[]>([]);
  const [availableMusic, setAvailableMusic] = useState<any[]>([]);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<string>("");
  const [clipPace, setClipPace] = useState<"fast" | "medium" | "smooth">(
    "fast",
  );
  const [customClips, setCustomClips] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadClips = async () => {
      try {
        const uploaded = loadUploadedMedia().filter(
          (m: any) => m.type === "video",
        );
        const ossVideos = await openMediaService.searchMedia("", "video");
        const ossMusic = await openMediaService.searchAudio("", "music");
        const uploadedAudio = loadUploadedAudio();

        if (isMounted) {
          const vids = [...uploaded, ...ossVideos];
          setAvailableVideos(vids);
          if (vids.length > 0) {
            setSelectedClips(vids.slice(0, 3).map((v) => v.id));
          }

          const music = [...uploadedAudio, ...ossMusic];
          setAvailableMusic(music);
          if (music.length > 0) {
            setSelectedMusicId(music[0].id);
          }
        }
      } catch (e) {
        console.warn("Failed to load autocut items:", e);
      }
    };

    if (visible) {
      loadClips();
    }

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const paceOptions = [
    {
      id: "fast",
      label: "Hyper Beat (1.2s)",
      desc: "Phonk / Viral TikTok sync",
      cutDuration: 1.2,
    },
    {
      id: "medium",
      label: "Dynamic (1.8s)",
      desc: "Vlog / Energetic rhythm",
      cutDuration: 1.8,
    },
    {
      id: "smooth",
      label: "Cinematic (2.5s)",
      desc: "Smooth Lo-Fi transitions",
      cutDuration: 2.5,
    },
  ];

  const toggleClipSelection = (id: string) => {
    soundEngine.playSfx("click");
    if (selectedClips.includes(id)) {
      if (selectedClips.length > 1) {
        setSelectedClips(selectedClips.filter((c) => c !== id));
      }
    } else {
      setSelectedClips([...selectedClips, id]);
    }
  };

  const handleFileUpload = (e: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newUploaded: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      const custom = {
        id: "user-clip-" + Date.now() + "-" + i,
        title: file.name.replace(/\.[^/.]+$/, ""),
        url,
        duration: 8.0,
      };
      newUploaded.push(custom);
    }
    setCustomClips((prev) => [...prev, ...newUploaded]);
    setSelectedClips((prev) => [...prev, ...newUploaded.map((u) => u.id)]);
    soundEngine.playSfx("whoosh");
  };

  const allAvailableClips = [...customClips, ...availableVideos];

  const handleGenerate = () => {
    soundEngine.playSfx("whoosh");

    const chosenClips = allAvailableClips.filter((c) =>
      selectedClips.includes(c.id),
    );
    if (chosenClips.length === 0) return;

    const currentPace =
      paceOptions.find((p) => p.id === clipPace) || paceOptions[0];
    const cutDur = currentPace.cutDuration;

    const transitions = [
      { type: "zoom_in", duration: 0.4 },
      { type: "dissolve", duration: 0.5 },
      { type: "slide_left", duration: 0.4 },
      { type: "flash_white", duration: 0.3 },
    ];

    const generatedVideoClips: VideoClip[] = [];
    let currentStart = 0;

    // Generate repeat cut segments to create a compelling beat-synced 10-15s reel
    const targetSegments = Math.max(6, chosenClips.length * 2);
    for (let i = 0; i < targetSegments; i++) {
      const source = chosenClips[i % chosenClips.length];
      const trans = transitions[i % transitions.length];

      generatedVideoClips.push({
        id: `autocut-v-${Date.now()}-${i}`,
        title: `${source.title} (Cut ${i + 1})`,
        type: "video",
        url: source.url,
        duration: cutDur,
        startTime: currentStart,
        trimIn: (i * 1.5) % 6,
        trimOut: ((i * 1.5) % 6) + cutDur,
        speed: 1.0,
        volume: 1.0,
        filter: i % 2 === 0 ? "teal_orange" : "cyberpunk",
        transition: trans,
        transform: { scale: 1, rotation: 0, x: 0, y: 0 },
      });

      currentStart += cutDur;
    }

    const selectedMusic =
      availableMusic.find((a) => a.id === selectedMusicId) ||
      availableMusic[0] || {
        title: "Dynamic Beat",
        artist: "Open Source Audio",
        url: "",
      };

    const generatedAudioClips: AudioClip[] = selectedMusic.url
      ? [
          {
            id: `autocut-a-${Date.now()}`,
            title: selectedMusic.title,
            artist: selectedMusic.artist || "Open Source",
            duration: currentStart,
            startTime: 0,
            volume: 0.9,
            url: selectedMusic.url,
          },
        ]
      : [];

    const newProject: FastArtProject = {
      ...createDefaultProject("AutoCut Viral Reel"),
      aspectRatio: "9:16",
      tracks: {
        video: generatedVideoClips,
        audio: generatedAudioClips,
        text: [
          {
            id: `autocut-t-${Date.now()}`,
            text: "⚡ AUTOCUT REEL",
            startTime: 0,
            duration: 3.0,
            animation: "bounce",
            style: {
              fontSize: 26,
              fontWeight: "800",
              color: "#00F2FE",
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
            },
          },
        ],
        stickers: [],
        effects: [
          {
            id: `autocut-eff-${Date.now()}`,
            type: "rgb_split",
            name: "RGB Glitch Sync",
            startTime: 0,
            duration: 2.0,
            intensity: 0.8,
          },
        ],
      },
    };

    onAutoCutGenerated(newProject);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="flash" size={20} color="#00F2FE" />
              <Text style={styles.headerTitle}>AutoCut AI Reel Generator</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll}>
            {/* Step 1: Select Media Clips */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  1. Select Media ({selectedClips.length} selected)
                </Text>
                {Platform.OS === "web" && (
                  <WebLabel style={styles.uploadBtn}>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={14}
                      color="#00F2FE"
                    />
                    <WebSpan
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#00F2FE",
                        marginLeft: 4,
                      }}
                    >
                      + Upload
                    </WebSpan>
                    <WebInput
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </WebLabel>
                )}
              </View>

              <View style={styles.clipsGrid}>
                {allAvailableClips.map((c) => {
                  const isChecked = selectedClips.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.clipCard,
                        isChecked && styles.clipCardActive,
                      ]}
                      onPress={() => toggleClipSelection(c.id)}
                    >
                      <Ionicons
                        name={
                          isChecked ? "checkmark-circle" : "ellipse-outline"
                        }
                        size={20}
                        color={isChecked ? "#00F2FE" : "#8E95A5"}
                        style={styles.checkIcon}
                      />
                      <Ionicons
                        name="film"
                        size={24}
                        color={isChecked ? "#00F2FE" : "#6B7280"}
                      />
                      <Text style={styles.clipTitle} numberOfLines={1}>
                        {c.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 2: Beat Pace */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Cutting Pace & Rhythms</Text>
              <View style={styles.paceColumn}>
                {paceOptions.map((p) => {
                  const isSelected = clipPace === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.paceCard,
                        isSelected && styles.paceCardActive,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx("pop");
                        setClipPace(p.id as any);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.paceLabel,
                            isSelected && styles.paceLabelActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                        <Text style={styles.paceDesc}>{p.desc}</Text>
                      </View>
                      <Ionicons
                        name={
                          isSelected ? "radio-button-on" : "radio-button-off"
                        }
                        size={20}
                        color={isSelected ? "#00F2FE" : "#8E95A5"}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 3: Sound Track */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Sync Soundtrack</Text>
              <View style={styles.audioRow}>
                {availableMusic.length === 0 ? (
                  <Text style={{ color: '#8E95A5', fontSize: 13, fontStyle: 'italic', paddingVertical: 8 }}>
                    Loading open-source soundtrack library...
                  </Text>
                ) : (
                  availableMusic.slice(0, 10).map((a) => {
                    const isSelected = selectedMusicId === a.id;
                    return (
                      <TouchableOpacity
                        key={a.id}
                        style={[
                          styles.audioCard,
                          isSelected && styles.audioCardActive,
                        ]}
                        onPress={() => {
                          soundEngine.playSfx("click");
                          setSelectedMusicId(a.id);
                        }}
                      >
                        <Ionicons
                          name="musical-note"
                          size={16}
                          color={isSelected ? "#000000" : "#10B981"}
                        />
                        <Text
                          style={[
                            styles.audioTitle,
                            isSelected && styles.audioTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          {a.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerate}
            >
              <Ionicons name="flash" size={18} color="#000000" />
              <Text style={styles.generateBtnText}>Generate AutoCut Video</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#121620",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2333",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  contentScroll: {
    padding: 16,
  },
  section: {
    backgroundColor: "#161B26",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#252B3D",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#8E95A5",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    cursor: "pointer",
    backgroundColor: "#00F2FE20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  clipCard: {
    width: "31%",
    backgroundColor: "#1F2536",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    position: "relative",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  clipCardActive: {
    borderColor: "#00F2FE",
    backgroundColor: "#00F2FE10",
  },
  checkIcon: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  clipTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  paceColumn: {
    gap: 8,
    marginTop: 10,
  },
  paceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2536",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  paceCardActive: {
    borderColor: "#00F2FE",
    backgroundColor: "#00F2FE10",
  },
  paceLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  paceLabelActive: {
    color: "#00F2FE",
  },
  paceDesc: {
    color: "#8E95A5",
    fontSize: 11,
    marginTop: 2,
  },
  audioRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  audioCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1F2536",
    padding: 10,
    borderRadius: 10,
  },
  audioCardActive: {
    backgroundColor: "#10B981",
  },
  audioTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  audioTitleActive: {
    color: "#000000",
    fontWeight: "800",
  },
  footer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  generateBtn: {
    backgroundColor: "#00F2FE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  generateBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
  },
});
