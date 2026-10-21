export interface AutoCutTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  filter: string;
  pace: 'fast' | 'medium' | 'smooth';
  textTitle: string;
  effectType: string;
}

export const STOCK_PRESET_CLIPS = [
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

export const STOCK_SOUNDTRACKS = [
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

export const AUTOCUT_TEMPLATES: AutoCutTemplate[] = [
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
