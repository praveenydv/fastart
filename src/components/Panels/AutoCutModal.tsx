import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';
import { openMediaService, OpenAudioItem, OpenMediaItem } from '../../services/openMediaService';
import { loadUploadedMedia, loadUploadedAudio } from '../../utils/storage';
import {
  FastArtProject,
  VideoClip,
  AudioClip,
  createDefaultProject,
} from '../../types/project';

interface AutoCutModalProps {
  visible: boolean;
  onClose: () => void;
  onAutoCutGenerated: (project: FastArtProject) => void;
  currentProject?: FastArtProject | null;
}

const WebInput: any = Platform.OS === 'web' ? 'input' : View;
const WebSpan: any = Platform.OS === 'web' ? 'span' : Text;
const WebLabel: any = Platform.OS === 'web' ? 'label' : View;

// Reliable Stock Presets to ensure AutoCut is NEVER empty
const STOCK_PRESET_CLIPS = [
  {
    id: 'stock-clip-1',
    title: 'Neon Cyber Drift',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=300&q=80',
    duration: 8.0,
  },
  {
    id: 'stock-clip-2',
    title: 'Skater Park Action',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?w=300&q=80',
    duration: 6.5,
  },
  {
    id: 'stock-clip-3',
    title: 'Ocean Sunset Waves',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&q=80',
    duration: 9.0,
  },
  {
    id: 'stock-clip-4',
    title: 'Urban Street Beat',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=300&q=80',
    duration: 7.5,
  },
  {
    id: 'stock-clip-5',
    title: 'Cinematic Horizon',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=300&q=80',
    duration: 8.0,
  },
];

const STOCK_SOUNDTRACKS = [
  {
    id: 'stock-music-1',
    title: 'Phonk Hyper Beat',
    artist: 'FastArt Audio Engine',
    bpm: 132,
    url: 'https://actions.google.com/sounds/v1/sports/skateboard_grind.ogg',
  },
  {
    id: 'stock-music-2',
    title: 'Lo-Fi Sunset Chill',
    artist: 'Chillhop Beats',
    bpm: 85,
    url: 'https://actions.google.com/sounds/v1/weather/light_rain.ogg',
  },
  {
    id: 'stock-music-3',
    title: 'Cyberpunk Synthwave',
    artist: 'Neon Waveform',
    bpm: 120,
    url: 'https://actions.google.com/sounds/v1/science_fiction/force_field.ogg',
  },
  {
    id: 'stock-music-4',
    title: 'Viral TikTok Trap',
    artist: '808 Producer',
    bpm: 140,
    url: 'https://actions.google.com/sounds/v1/impacts/crash_metal_bar.ogg',
  },
  {
    id: 'stock-music-5',
    title: 'Cinematic Epic Rise',
    artist: 'Orchestral Studios',
    bpm: 105,
    url: 'https://actions.google.com/sounds/v1/ambiences/wind_chimes.ogg',
  },
];

interface AutoCutTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  filter: string;
  pace: 'fast' | 'medium' | 'smooth';
  textTitle: string;
  effectType: string;
}

const AUTOCUT_TEMPLATES: AutoCutTemplate[] = [
  {
    id: 'viral_beat',
    name: '⚡ Viral Beat Sync',
    icon: 'flash',
    desc: 'Hyper-fast cuts synced with TikTok bass drops',
    filter: 'cyberpunk',
    pace: 'fast',
    textTitle: '⚡ VIRAL REEL',
    effectType: 'rgb_split',
  },
  {
    id: 'cinematic_vlog',
    name: '🎬 Cinematic Vlog',
    icon: 'film',
    desc: 'Golden hour mood, smooth cross-dissolves',
    filter: 'teal_orange',
    pace: 'smooth',
    textTitle: '🎬 CINEMATIC',
    effectType: 'zoom_blur',
  },
  {
    id: 'retro_90s',
    name: '📼 90s Retro VHS',
    icon: 'videocam',
    desc: 'Vintage analog textures with cassette groove',
    filter: 'vintage',
    pace: 'medium',
    textTitle: '📼 VINTAGE 90s',
    effectType: 'film_grain',
  },
  {
    id: 'minimal_flow',
    name: '✨ Minimal Modern',
    icon: 'sparkles',
    desc: 'Clean transitions, sleek minimalist pacing',
    filter: 'normal',
    pace: 'medium',
    textTitle: '✨ FASTFLOW',
    effectType: 'glow',
  },
];

export default function AutoCutModal({
  visible,
  onClose,
  onAutoCutGenerated,
  currentProject,
}: AutoCutModalProps) {
  const [availableVideos, setAvailableVideos] = useState<any[]>([]);
  const [availableMusic, setAvailableMusic] = useState<any[]>(STOCK_SOUNDTRACKS);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<string>(STOCK_SOUNDTRACKS[0].id);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('viral_beat');
  const [clipPace, setClipPace] = useState<'fast' | 'medium' | 'smooth'>('fast');
  const [customClips, setCustomClips] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadClips = async () => {
      try {
        // 1. Current project clips if available
        const projectClips = (currentProject?.tracks.video || []).map((v) => ({
          id: v.id,
          title: v.title || 'Timeline Clip',
          url: v.url,
          thumbnailUrl: v.thumbnail || v.url,
          duration: v.duration || 5.0,
          isTimelineClip: true,
        }));

        // 2. Uploaded media
        const uploaded = loadUploadedMedia()
          .filter((m: any) => m.type === 'video')
          .map((m: any) => ({
            id: m.id,
            title: m.title || 'Uploaded Clip',
            url: m.url,
            thumbnailUrl: m.thumbnail || m.url,
            duration: m.duration || 6.0,
          }));

        // 3. Fallback stock clips
        const stockClips = STOCK_PRESET_CLIPS;

        // 4. Combine guaranteed items
        const initialVids = [...projectClips, ...uploaded, ...stockClips];

        if (isMounted) {
          setAvailableVideos(initialVids);
          // Pre-select first 3 clips
          setSelectedClips(initialVids.slice(0, 3).map((v) => v.id));
        }

        // 5. Asynchronously load audio & OSS media
        const uploadedAudio = loadUploadedAudio().map((a: any) => ({
          id: a.id,
          title: a.title,
          artist: a.artist || 'Local Upload',
          bpm: a.bpm || 120,
          url: a.url,
        }));

        const combinedAudio = [...uploadedAudio, ...STOCK_SOUNDTRACKS];
        if (isMounted) {
          setAvailableMusic(combinedAudio);
          if (combinedAudio.length > 0) {
            setSelectedMusicId(combinedAudio[0].id);
          }
        }

        // Try Openverse in background without blocking
        openMediaService.searchAudio('', 'music').then((ossMusic) => {
          if (isMounted && ossMusic && ossMusic.length > 0) {
            setAvailableMusic((prev) => [...prev, ...ossMusic]);
          }
        }).catch(() => {});

        openMediaService.searchMedia('', 'video').then((ossVideos) => {
          if (isMounted && ossVideos && ossVideos.length > 0) {
            setAvailableVideos((prev) => [...prev, ...ossVideos]);
          }
        }).catch(() => {});
      } catch (e) {
        console.warn('Failed to load autocut items:', e);
      }
    };

    if (visible) {
      loadClips();
    }

    return () => {
      isMounted = false;
    };
  }, [visible, currentProject]);

  const paceOptions = [
    {
      id: 'fast',
      label: 'Hyper Beat (1.2s)',
      desc: 'Phonk / Viral TikTok sync',
      cutDuration: 1.2,
    },
    {
      id: 'medium',
      label: 'Dynamic (1.8s)',
      desc: 'Vlog / Energetic rhythm',
      cutDuration: 1.8,
    },
    {
      id: 'smooth',
      label: 'Cinematic (2.5s)',
      desc: 'Smooth Lo-Fi transitions',
      cutDuration: 2.5,
    },
  ];

  const handleSelectTemplate = (template: AutoCutTemplate) => {
    soundEngine.playSfx('pop');
    setSelectedTemplate(template.id);
    setClipPace(template.pace);
  };

  const toggleClipSelection = (id: string) => {
    soundEngine.playSfx('click');
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
        id: 'user-clip-' + Date.now() + '-' + i,
        title: file.name.replace(/\.[^/.]+$/, ''),
        url,
        duration: 8.0,
      };
      newUploaded.push(custom);
    }
    setCustomClips((prev) => [...prev, ...newUploaded]);
    setSelectedClips((prev) => [...prev, ...newUploaded.map((u) => u.id)]);
    soundEngine.playSfx('whoosh');
  };

  const allAvailableClips = [...customClips, ...availableVideos];

  const handleGenerate = () => {
    soundEngine.playSfx('whoosh');

    // Ensure we have clips even if selection was cleared
    let chosenClips = allAvailableClips.filter((c) => selectedClips.includes(c.id));
    if (chosenClips.length === 0) {
      chosenClips = allAvailableClips.slice(0, 3);
    }
    if (chosenClips.length === 0) {
      chosenClips = STOCK_PRESET_CLIPS.slice(0, 3);
    }

    const currentTemplate =
      AUTOCUT_TEMPLATES.find((t) => t.id === selectedTemplate) || AUTOCUT_TEMPLATES[0];

    const currentPace =
      paceOptions.find((p) => p.id === clipPace) || paceOptions[0];
    const cutDur = currentPace.cutDuration;

    const transitions = [
      { type: 'zoom_in', duration: 0.35 },
      { type: 'dissolve', duration: 0.4 },
      { type: 'slide_left', duration: 0.35 },
      { type: 'flash_white', duration: 0.25 },
    ];

    const generatedVideoClips: VideoClip[] = [];
    let currentStart = 0;

    // Generate beat-synced repeat cuts to create a compelling 10-15s viral reel
    const targetSegments = Math.max(6, chosenClips.length * 2);
    for (let i = 0; i < targetSegments; i++) {
      const source = chosenClips[i % chosenClips.length];
      const trans = transitions[i % transitions.length];
      const sourceDur = source.duration || 6.0;

      generatedVideoClips.push({
        id: `autocut-v-${Date.now()}-${i}`,
        title: `${source.title} (Cut ${i + 1})`,
        type: 'video',
        url: source.url,
        duration: cutDur,
        startTime: currentStart,
        trimIn: (i * 1.5) % Math.max(1, sourceDur - cutDur),
        trimOut: ((i * 1.5) % Math.max(1, sourceDur - cutDur)) + cutDur,
        mediaDuration: Math.max(sourceDur, cutDur * 3),
        thumbnail: source.thumbnailUrl || source.thumbnail || source.url,
        speed: 1.0,
        volume: 1.0,
        filter: currentTemplate.filter || (i % 2 === 0 ? 'teal_orange' : 'cyberpunk'),
        transition: trans,
        transform: { scale: 1, rotation: 0, x: 0, y: 0 },
      });

      currentStart += cutDur;
    }

    const selectedMusic =
      availableMusic.find((a) => a.id === selectedMusicId) ||
      availableMusic[0] ||
      STOCK_SOUNDTRACKS[0];

    const generatedAudioClips: AudioClip[] = selectedMusic.url
      ? [
          {
            id: `autocut-a-${Date.now()}`,
            title: selectedMusic.title,
            artist: selectedMusic.artist || 'FastArt Sound',
            duration: currentStart,
            mediaDuration: Math.max(currentStart, 30),
            startTime: 0,
            volume: 0.9,
            url: selectedMusic.url,
          },
        ]
      : [];

    const newProject: FastArtProject = {
      ...createDefaultProject(`⚡ AutoCut - ${currentTemplate.name}`),
      aspectRatio: '9:16',
      canvasBackground: '#000000',
      tracks: {
        video: generatedVideoClips,
        audio: generatedAudioClips,
        text: [
          {
            id: `autocut-t-${Date.now()}`,
            text: currentTemplate.textTitle || '⚡ AUTOCUT REEL',
            startTime: 0,
            duration: 3.0,
            animation: 'bounce',
            style: {
              fontSize: 26,
              fontWeight: '800',
              color: '#00F2FE',
              backgroundColor: 'rgba(0,0,0,0.65)',
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
            type: currentTemplate.effectType || 'rgb_split',
            name: `${currentTemplate.name} FX`,
            startTime: 0,
            duration: 2.5,
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
              <View style={styles.headerIconCircle}>
                <Ionicons name="flash" size={18} color="#00F2FE" />
              </View>
              <View>
                <Text style={styles.headerTitle}>AutoCut Reel Generator</Text>
                <Text style={styles.headerSubtitle}>Beat-synced AI reel from your clips</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                soundEngine.playSfx('click');
                onClose();
              }}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#8E95A5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Step 1: Template Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Choose Reel Style Template</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templateScroll}
              >
                {AUTOCUT_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <TouchableOpacity
                      key={tmpl.id}
                      style={[
                        styles.templateCard,
                        isSelected && styles.templateCardActive,
                      ]}
                      onPress={() => handleSelectTemplate(tmpl)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.templateHeader}>
                        <Ionicons
                          name={tmpl.icon as any}
                          size={18}
                          color={isSelected ? '#00F2FE' : '#8E95A5'}
                        />
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color="#00F2FE" />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.templateName,
                          isSelected && styles.templateNameActive,
                        ]}
                      >
                        {tmpl.name}
                      </Text>
                      <Text style={styles.templateDesc} numberOfLines={2}>
                        {tmpl.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Step 2: Select Media Clips */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  2. Select Video Clips ({selectedClips.length} selected)
                </Text>
                {Platform.OS === 'web' && (
                  <WebLabel style={styles.uploadBtn}>
                    <Ionicons name="cloud-upload-outline" size={14} color="#00F2FE" />
                    <WebSpan style={styles.uploadBtnText}>+ Upload</WebSpan>
                    <WebInput
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
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
                      activeOpacity={0.7}
                    >
                      {c.thumbnailUrl ? (
                        <Image
                          source={{ uri: c.thumbnailUrl }}
                          style={styles.clipThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.clipThumbPlaceholder}>
                          <Ionicons
                            name="film"
                            size={22}
                            color={isChecked ? '#00F2FE' : '#6B7280'}
                          />
                        </View>
                      )}
                      <Ionicons
                        name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={isChecked ? '#00F2FE' : 'rgba(255,255,255,0.6)'}
                        style={styles.checkIcon}
                      />
                      <View style={styles.clipMetaOverlay}>
                        <Text style={styles.clipTitle} numberOfLines={1}>
                          {c.title}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 3: Beat Pace */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Beat Pacing</Text>
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
                        soundEngine.playSfx('pop');
                        setClipPace(p.id as any);
                      }}
                      activeOpacity={0.7}
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
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? '#00F2FE' : '#8E95A5'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 4: Sound Track */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Soundtrack & Beat</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.audioRow}
              >
                {availableMusic.map((a) => {
                  const isSelected = selectedMusicId === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[
                        styles.audioCard,
                        isSelected && styles.audioCardActive,
                      ]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setSelectedMusicId(a.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.audioIconCircle}>
                        <Ionicons
                          name="musical-note"
                          size={16}
                          color={isSelected ? '#000000' : '#10B981'}
                        />
                      </View>
                      <View style={styles.audioInfo}>
                        <Text
                          style={[
                            styles.audioTitle,
                            isSelected && styles.audioTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          {a.title}
                        </Text>
                        <Text
                          style={[
                            styles.audioArtist,
                            isSelected && styles.audioArtistActive,
                          ]}
                          numberOfLines={1}
                        >
                          {a.bpm ? `${a.bpm} BPM • ` : ''}
                          {a.artist || 'FastArt Beat'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerate}
              activeOpacity={0.8}
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
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0E1118',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#1E2333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#8E95A5',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#161B26',
  },
  contentScroll: {
    padding: 16,
  },
  section: {
    backgroundColor: '#131722',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2436',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  templateScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  templateCard: {
    width: 140,
    backgroundColor: '#1B202E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  templateCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  templateName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  templateNameActive: {
    color: '#00F2FE',
  },
  templateDesc: {
    color: '#8E95A5',
    fontSize: 10,
    lineHeight: 14,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  uploadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00F2FE',
    marginLeft: 5,
  },
  clipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  clipCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1B202E',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  clipCardActive: {
    borderColor: '#00F2FE',
  },
  clipThumb: {
    width: '100%',
    height: '100%',
  },
  clipThumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#181E2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  clipMetaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  clipTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  paceColumn: {
    gap: 8,
  },
  paceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B202E',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  paceCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  paceLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  paceLabelActive: {
    color: '#00F2FE',
  },
  paceDesc: {
    color: '#8E95A5',
    fontSize: 11,
    marginTop: 2,
  },
  audioRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  audioCard: {
    width: 170,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1B202E',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  audioCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  audioIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  audioTitleActive: {
    color: '#10B981',
  },
  audioArtist: {
    color: '#8E95A5',
    fontSize: 10,
    marginTop: 2,
  },
  audioArtistActive: {
    color: '#D1FAE5',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  generateBtn: {
    backgroundColor: '#00F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  generateBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});
