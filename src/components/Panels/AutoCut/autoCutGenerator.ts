import {
  FastArtProject,
  VideoClip,
  AudioClip,
  createDefaultProject,
} from '../../../types/project';
import {
  AUTOCUT_TEMPLATES,
  STOCK_PRESET_CLIPS,
  STOCK_SOUNDTRACKS,
} from './autoCutConstants';

export interface GenerateAutoCutOptions {
  allAvailableClips: any[];
  selectedClips: string[];
  selectedTemplate: string;
  clipPace: 'fast' | 'medium' | 'smooth';
  availableMusic: any[];
  selectedMusicId: string;
}

export const PACE_OPTIONS = [
  {
    id: 'fast',
    name: '⚡ Hyper Fast Beat (0.6s cuts)',
    desc: 'Perfect for TikTok phonk, trap drops, and dynamic drift videos',
    cutDuration: 0.6,
  },
  {
    id: 'medium',
    name: '🎶 Rhythm Pulse (1.2s cuts)',
    desc: 'Balanced cuts for Instagram Reels, YouTube Shorts, & Vlogs',
    cutDuration: 1.2,
  },
  {
    id: 'smooth',
    name: '🌊 Cinematic Flow (2.0s cuts)',
    desc: 'Relaxed storytelling with seamless long dissolves',
    cutDuration: 2.0,
  },
];

export function generateAutoCutProject({
  allAvailableClips,
  selectedClips,
  selectedTemplate,
  clipPace,
  availableMusic,
  selectedMusicId,
}: GenerateAutoCutOptions): FastArtProject {
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
    PACE_OPTIONS.find((p) => p.id === clipPace) || PACE_OPTIONS[0];
  const cutDur = currentPace.cutDuration;

  const transitions = [
    { type: 'zoom_in', duration: 0.35 },
    { type: 'dissolve', duration: 0.4 },
    { type: 'slide_left', duration: 0.35 },
    { type: 'flash_white', duration: 0.25 },
  ];

  const generatedVideoClips: VideoClip[] = [];
  let currentStart = 0;

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

  return {
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
}
