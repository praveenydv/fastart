// FastArt Sample Media, Presets, Fonts, and Effect Definitions (TypeScript)
import { AspectRatio } from '../types/project';

export interface SampleVideo {
  id: string;
  title: string;
  duration: number;
  url: string;
  localUrl: string;
  type: 'video';
  width: number;
  height: number;
}

export interface SampleAudio {
  id: string;
  title: string;
  artist: string;
  duration: number;
  category: string;
  url: string;
  bpm: number;
}

export interface SoundEffect {
  id: string;
  title: string;
  duration: number;
  icon: string;
  url: string;
}

export interface AspectRatioOption {
  id: AspectRatio;
  label: string;
  desc: string;
  width: number;
  height: number;
  icon: any;
}

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: 'vid-1',
    title: 'Flower Macro Bloom',
    duration: 5.0,
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    localUrl: '/assets/media/videos/flower_macro.mp4',
    type: 'video',
    width: 640,
    height: 360,
  },
  {
    id: 'vid-2',
    title: 'Friday City Life',
    duration: 5.0,
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    localUrl: '/assets/media/videos/friday_vlog.mp4',
    type: 'video',
    width: 640,
    height: 360,
  },
  {
    id: 'vid-3',
    title: 'Sintel Cinematic Scene',
    duration: 12.0,
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    localUrl: '/assets/media/videos/sintel_cinematic.mp4',
    type: 'video',
    width: 854,
    height: 480,
  },
];

export const SAMPLE_AUDIO: SampleAudio[] = [
  {
    id: 'aud-1',
    title: 'Viral Phonk 808 Beat',
    artist: 'FastArt Studio',
    duration: 15.0,
    category: 'Trending',
    url: '/assets/media/audio/viral_phonk.wav',
    bpm: 130,
  },
  {
    id: 'aud-2',
    title: 'Lo-Fi Chill Sunset',
    artist: 'Aesthetic Chill',
    duration: 15.0,
    category: 'Vlog',
    url: '/assets/media/audio/lofi_chill.wav',
    bpm: 80,
  },
];

export const SOUND_EFFECTS: SoundEffect[] = [
  { id: 'sfx-1', title: 'Whoosh Fast', duration: 0.6, icon: 'flash', url: '/assets/media/sfx/whoosh.wav' },
  { id: 'sfx-2', title: 'Cut Split Click', duration: 0.12, icon: 'cut', url: '/assets/media/sfx/cut_click.wav' },
  { id: 'sfx-3', title: 'Bass Drop Boom', duration: 1.8, icon: 'volume-high', url: '/assets/media/sfx/bass_drop.wav' },
];

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: '9:16', label: '9:16', desc: 'TikTok / Shorts / Reels', width: 9, height: 16, icon: 'phone-portrait-outline' },
  { id: '16:9', label: '16:9', desc: 'YouTube / Widescreen', width: 16, height: 9, icon: 'phone-landscape-outline' },
  { id: '1:1', label: '1:1', desc: 'Instagram Square', width: 1, height: 1, icon: 'square-outline' },
  { id: '4:5', label: '4:5', desc: 'Instagram Feed Portrait', width: 4, height: 5, icon: 'newspaper-outline' },
  { id: '2.35:1', label: '2.35:1', desc: 'Cinemascope', width: 235, height: 100, icon: 'film-outline' },
];

export const FILTER_PRESETS = [
  { id: 'normal', name: 'Original', css: 'none' },
  { id: 'teal_orange', name: 'Teal & Orange', css: 'contrast(1.2) saturate(1.3) hue-rotate(15deg)' },
  { id: 'vintage', name: 'Vintage 90s', css: 'sepia(0.35) contrast(0.95) brightness(1.1)' },
  { id: 'cyberpunk', name: 'Cyberpunk', css: 'hue-rotate(290deg) contrast(1.4) saturate(1.8)' },
  { id: 'noir', name: 'Noir B&W', css: 'grayscale(1) contrast(1.4) brightness(0.9)' },
  { id: 'warm_sunset', name: 'Golden Hour', css: 'sepia(0.25) saturate(1.4) brightness(1.05)' },
  { id: 'cold_moody', name: 'Moody Blue', css: 'hue-rotate(180deg) saturate(0.8) contrast(1.15)' },
  { id: 'emerald', name: 'Emerald', css: 'hue-rotate(90deg) saturate(1.2) contrast(1.1)' },
];

export const EFFECT_PRESETS = [
  { id: 'none', name: 'None', type: 'none', icon: 'close-circle-outline', intensity: 0 },
  { id: 'glitch', name: 'Glitch Shake', type: 'glitch', intensity: 0.8, icon: 'flash-outline' },
  { id: 'vhs', name: 'VHS Tape', type: 'vhs', intensity: 0.6, icon: 'videocam-outline' },
  { id: 'rgb_split', name: 'RGB Split', type: 'rgb_split', intensity: 0.7, icon: 'layers-outline' },
  { id: 'film_grain', name: 'Film Grain', type: 'film_grain', intensity: 0.5, icon: 'disc-outline' },
  { id: 'zoom_pulse', name: 'Zoom Pulse', type: 'zoom_pulse', intensity: 1.0, icon: 'expand-outline' },
  { id: 'neon_edge', name: 'Neon Glow', type: 'neon_edge', intensity: 0.9, icon: 'bulb-outline' },
  { id: 'blur_cinematic', name: 'Cinematic Blur', type: 'blur', intensity: 0.4, icon: 'water-outline' },
];

export const TRANSITION_PRESETS = [
  { id: 'cut', name: 'Hard Cut', duration: 0 },
  { id: 'dissolve', name: 'Dissolve / Crossfade', duration: 0.6 },
  { id: 'zoom_in', name: 'Zoom In', duration: 0.5 },
  { id: 'slide_left', name: 'Slide Left', duration: 0.4 },
  { id: 'flash_white', name: 'Flash White', duration: 0.3 },
  { id: 'glitch_transition', name: 'Glitch Warp', duration: 0.5 },
  { id: 'spin_cw', name: 'Spin Clockwise', duration: 0.5 },
];

export const TEXT_TEMPLATES = [
  {
    id: 't-1',
    text: 'VIRAL HOOK',
    style: {
      color: '#FFFFFF',
      fontSize: 26,
      fontWeight: 'bold' as const,
      backgroundColor: '#FF0050',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      letterSpacing: 1.5,
      textAlign: 'center' as const,
    },
    animation: 'bounce',
  },
  {
    id: 't-2',
    text: 'AESTHETIC VIBE',
    style: {
      color: '#00F2FE',
      fontSize: 24,
      fontWeight: '600' as const,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderColor: '#00F2FE',
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      letterSpacing: 2,
      textAlign: 'center' as const,
    },
    animation: 'fade',
  },
  {
    id: 't-3',
    text: 'NEON GLOW 🔥',
    style: {
      color: '#FFE600',
      fontSize: 28,
      fontWeight: '900' as const,
      textShadowColor: '#FF0050',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
      textAlign: 'center' as const,
    },
    animation: 'typewriter',
  },
  {
    id: 't-4',
    text: 'Cinematic Title',
    style: {
      color: '#E0E0E0',
      fontSize: 22,
      fontWeight: '300' as const,
      letterSpacing: 4,
      textAlign: 'center' as const,
    },
    animation: 'slideUp',
  },
  {
    id: 't-5',
    text: '✨ SUBSCRIBE ✨',
    style: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800' as const,
      backgroundColor: '#E50914',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      textAlign: 'center' as const,
    },
    animation: 'pulse',
  },
];

export const STICKER_LIBRARY = [
  { id: 'stk-1', char: '🔥', label: 'Fire', category: 'Reaction' },
  { id: 'stk-2', char: '✨', label: 'Sparkles', category: 'Aesthetic' },
  { id: 'stk-3', char: '⚡️', label: 'Lightning', category: 'Energy' },
  { id: 'stk-4', char: '🎬', label: 'Clapper', category: 'Movie' },
  { id: 'stk-5', char: '💥', label: 'Boom', category: 'Action' },
  { id: 'stk-6', char: '🚀', label: 'Rocket', category: 'Trending' },
  { id: 'stk-7', char: '❤️', label: 'Heart', category: 'Love' },
  { id: 'stk-8', char: '👑', label: 'Crown', category: 'VIP' },
  { id: 'stk-9', char: '💯', label: 'Hundred', category: 'Viral' },
  { id: 'stk-10', char: '⚠️', label: 'Warning', category: 'Alert' },
  { id: 'stk-11', char: '👀', label: 'Eyes', category: 'Look' },
  { id: 'stk-12', char: '🎉', label: 'Party', category: 'Celebration' },
];

export const SPEED_PRESETS = [
  { label: '0.2x', value: 0.2 },
  { label: '0.5x', value: 0.5 },
  { label: '1.0x', value: 1.0 },
  { label: '1.5x', value: 1.5 },
  { label: '2.0x', value: 2.0 },
  { label: '5.0x', value: 5.0 },
  { label: '10x', value: 10.0 },
];

export const SPEED_CURVES = [
  { id: 'custom', name: 'Custom Curve', points: [0.5, 2.0, 0.3, 1.0] },
  { id: 'montage', name: 'Montage', points: [0.3, 3.0, 0.4, 1.2] },
  { id: 'hero', name: 'Hero Slow-Mo', points: [1.5, 0.2, 0.2, 1.8] },
  { id: 'bullet', name: 'Bullet Time', points: [2.5, 0.1, 0.1, 2.0] },
  { id: 'flash_in', name: 'Flash In', points: [4.0, 1.0, 1.0, 1.0] },
];
