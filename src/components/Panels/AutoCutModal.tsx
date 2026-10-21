import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
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
import { FastArtProject } from '../../types/project';
import {
  STOCK_PRESET_CLIPS,
  STOCK_SOUNDTRACKS,
  AUTOCUT_TEMPLATES,
  AutoCutTemplate,
} from './AutoCut/autoCutConstants';
import { styles } from './AutoCut/AutoCutStyles';
import {
  generateAutoCutProject,
  PACE_OPTIONS,
} from './AutoCut/autoCutGenerator';

interface AutoCutModalProps {
  visible: boolean;
  onClose: () => void;
  onAutoCutGenerated: (project: FastArtProject) => void;
  currentProject?: FastArtProject | null;
}

const WebInput: any = Platform.OS === 'web' ? 'input' : View;
const WebSpan: any = Platform.OS === 'web' ? 'span' : Text;
const WebLabel: any = Platform.OS === 'web' ? 'label' : View;

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
        const projectClips = (currentProject?.tracks.video || []).map((v) => ({
          id: v.id,
          title: v.title || 'Timeline Clip',
          url: v.url,
          thumbnailUrl: v.thumbnail || v.url,
          duration: v.duration || 5.0,
          isTimelineClip: true,
        }));

        const uploaded = loadUploadedMedia()
          .filter((m: any) => m.type === 'video')
          .map((m: any) => ({
            id: m.id,
            title: m.title || 'Uploaded Clip',
            url: m.url,
            thumbnailUrl: m.thumbnail || m.url,
            duration: m.duration || 6.0,
          }));

        let openStockVideos: any[] = [];
        try {
          const fetched = await openMediaService.searchMedia('trending', 'video');
          openStockVideos = (fetched || []).slice(0, 6).map((m: OpenMediaItem) => ({
            id: `open-${m.id}`,
            title: m.title || 'Stock Video',
            url: m.url,
            thumbnailUrl: m.thumbnailUrl || m.url,
            duration: m.duration || 8.0,
          }));
        } catch (e) {
          console.warn('Open media stock videos load fallback to preset:', e);
        }

        const mergedVideos = [
          ...projectClips,
          ...uploaded,
          ...openStockVideos,
          ...STOCK_PRESET_CLIPS,
        ];

        const uniqueVideos = Array.from(
          new Map(mergedVideos.map((item) => [item.url, item])).values()
        );

        if (isMounted) {
          setAvailableVideos(uniqueVideos);
          if (uniqueVideos.length > 0 && selectedClips.length === 0) {
            setSelectedClips(uniqueVideos.slice(0, 3).map((v) => v.id));
          }
        }
      } catch (err) {
        console.warn('AutoCut clip loader error:', err);
        if (isMounted) {
          setAvailableVideos(STOCK_PRESET_CLIPS);
          setSelectedClips(STOCK_PRESET_CLIPS.slice(0, 3).map((v) => v.id));
        }
      }
    };

    const loadMusic = async () => {
      try {
        const userAudio = loadUploadedAudio().map((a: any) => ({
          id: a.id,
          title: a.title || 'My Audio',
          artist: a.artist || 'Local Upload',
          url: a.url,
        }));

        let openAudio: any[] = [];
        try {
          const fetched = await openMediaService.searchAudio('trending', 'music');
          openAudio = (fetched || []).slice(0, 6).map((a: OpenAudioItem) => ({
            id: `open-audio-${a.id}`,
            title: a.title,
            artist: a.artist || 'Trending Sound',
            url: a.url,
          }));
        } catch (e) {
          console.warn('Open audio load fallback to stock:', e);
        }

        const mergedMusic = [...userAudio, ...openAudio, ...STOCK_SOUNDTRACKS];
        const uniqueMusic = Array.from(
          new Map(mergedMusic.map((item) => [item.url, item])).values()
        );

        if (isMounted) {
          setAvailableMusic(uniqueMusic);
        }
      } catch (e) {
        console.warn('AutoCut audio loader error:', e);
      }
    };

    if (visible) {
      loadClips();
      loadMusic();
    }

    return () => {
      isMounted = false;
    };
  }, [visible, currentProject]);

  const toggleClipSelection = (id: string) => {
    soundEngine.playSfx('click');
    setSelectedClips((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectTemplate = (template: AutoCutTemplate) => {
    soundEngine.playSfx('click');
    setSelectedTemplate(template.id);
    setClipPace(template.pace);
  };

  const handleCustomFileUpload = (e: any) => {
    const files = e.target?.files;
    if (!files || files.length === 0) return;

    const newClips: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const blobUrl = URL.createObjectURL(file);
      const newClip = {
        id: `custom-upload-${Date.now()}-${i}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        url: blobUrl,
        thumbnailUrl: blobUrl,
        duration: 8.0,
      };
      newClips.push(newClip);
    }

    setCustomClips((prev) => [...newClips, ...prev]);
    setSelectedClips((prev) => [...newClips.map((c) => c.id), ...prev]);
    soundEngine.playSfx('whoosh');
  };

  const allAvailableClips = [...customClips, ...availableVideos];

  const handleGenerate = () => {
    soundEngine.playSfx('whoosh');
    const newProject = generateAutoCutProject({
      allAvailableClips,
      selectedClips,
      selectedTemplate,
      clipPace,
      availableMusic,
      selectedMusicId,
    });
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
                  2. Select Clips ({selectedClips.length} selected)
                </Text>
                {Platform.OS === 'web' && (
                  <WebLabel style={styles.uploadBtn}>
                    <Ionicons name="cloud-upload-outline" size={14} color="#00F2FE" />
                    <WebSpan style={styles.uploadBtnText}>Upload Files</WebSpan>
                    <WebInput
                      type="file"
                      accept="video/*,image/*"
                      multiple
                      onChange={handleCustomFileUpload}
                      style={{ display: 'none' }}
                    />
                  </WebLabel>
                )}
              </View>

              <View style={styles.clipsGrid}>
                {allAvailableClips.slice(0, 9).map((clip) => {
                  const isSelected = selectedClips.includes(clip.id);
                  return (
                    <TouchableOpacity
                      key={clip.id}
                      style={[
                        styles.clipCard,
                        isSelected && styles.clipCardActive,
                      ]}
                      onPress={() => toggleClipSelection(clip.id)}
                      activeOpacity={0.8}
                    >
                      {clip.thumbnailUrl ? (
                        <Image
                          source={{ uri: clip.thumbnailUrl }}
                          style={styles.clipThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.clipThumbPlaceholder}>
                          <Ionicons name="film" size={24} color="#64748B" />
                        </View>
                      )}
                      {isSelected && (
                        <View style={styles.checkIcon}>
                          <Ionicons name="checkmark-circle" size={22} color="#00F2FE" />
                        </View>
                      )}
                      <View style={styles.clipMetaOverlay}>
                        <Text style={styles.clipTitle} numberOfLines={1}>
                          {clip.title}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 3: Cutting Rhythm Pace */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Rhythm Pace & Cut Speed</Text>
              <View style={styles.paceColumn}>
                {PACE_OPTIONS.map((pace) => {
                  const isSelected = clipPace === pace.id;
                  return (
                    <TouchableOpacity
                      key={pace.id}
                      style={[styles.paceCard, isSelected && styles.paceCardActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setClipPace(pace.id as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? '#00F2FE' : '#64748B'}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.paceLabel,
                            isSelected && styles.paceLabelActive,
                          ]}
                        >
                          {pace.name}
                        </Text>
                        <Text style={styles.paceDesc}>{pace.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 4: Music Soundtrack Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Select Beat Soundtrack</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.audioRow}
              >
                {availableMusic.map((music) => {
                  const isSelected = selectedMusicId === music.id;
                  return (
                    <TouchableOpacity
                      key={music.id}
                      style={[styles.audioCard, isSelected && styles.audioCardActive]}
                      onPress={() => {
                        soundEngine.playSfx('click');
                        setSelectedMusicId(music.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.audioIconCircle}>
                        <Ionicons
                          name={isSelected ? 'musical-notes' : 'musical-note'}
                          size={16}
                          color={isSelected ? '#10B981' : '#8E95A5'}
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
                          {music.title}
                        </Text>
                        <Text
                          style={[
                            styles.audioArtist,
                            isSelected && styles.audioArtistActive,
                          ]}
                          numberOfLines={1}
                        >
                          {music.artist || 'FastArt Track'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Footer Generate CTA */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerate}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={18} color="#000000" />
              <Text style={styles.generateBtnText}>
                Generate Beat-Synced Reel ({selectedClips.length} Clips)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
