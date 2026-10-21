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

export const SAMPLE_VIDEOS: SampleVideo[] = [];

export const SAMPLE_AUDIO: SampleAudio[] = [];

export const SOUND_EFFECTS: SoundEffect[] = [];

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: '9:16', label: '9:16', desc: 'TikTok / Shorts / Reels', width: 9, height: 16, icon: 'phone-portrait-outline' },
  { id: '16:9', label: '16:9', desc: 'YouTube / Widescreen', width: 16, height: 9, icon: 'phone-landscape-outline' },
  { id: '1:1', label: '1:1', desc: 'Instagram Square', width: 1, height: 1, icon: 'square-outline' },
  { id: '4:5', label: '4:5', desc: 'Instagram Feed Portrait', width: 4, height: 5, icon: 'newspaper-outline' },
  { id: '2.35:1', label: '2.35:1', desc: 'Cinemascope', width: 235, height: 100, icon: 'film-outline' },
];

export const FILTER_PRESETS = [
  { id: 'normal', name: 'Original', css: 'none', category: 'Basic' },
  { id: 'teal_orange', name: 'Teal & Orange', css: 'contrast(1.25) saturate(1.35) hue-rotate(15deg)', category: 'Cinematic' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', css: 'hue-rotate(290deg) contrast(1.4) saturate(1.85)', category: 'Vibrant' },
  { id: 'vintage', name: 'Vintage 90s', css: 'sepia(0.35) contrast(0.95) brightness(1.08)', category: 'Retro' },
  { id: 'noir', name: 'Noir B&W', css: 'grayscale(1) contrast(1.45) brightness(0.92)', category: 'Retro' },
  { id: 'warm_sunset', name: 'Golden Hour', css: 'sepia(0.22) saturate(1.45) brightness(1.08)', category: 'Cinematic' },
  { id: 'cold_moody', name: 'Moody Blue', css: 'hue-rotate(185deg) saturate(0.85) contrast(1.2)', category: 'Cinematic' },
  { id: 'emerald', name: 'Emerald Film', css: 'hue-rotate(95deg) saturate(1.25) contrast(1.12)', category: 'Cinematic' },
  { id: 'vhs_retro', name: 'Retro VHS CRT', css: 'contrast(1.3) saturate(1.6) brightness(1.05)', category: 'Retro' },
  { id: 'pastel_dream', name: 'Pastel Dream', css: 'brightness(1.15) saturate(1.2) contrast(0.9)', category: 'Vibrant' },
  { id: 'cinematic_warm', name: 'Amber Glow', css: 'sepia(0.3) saturate(1.35) contrast(1.15)', category: 'Cinematic' },
  { id: 'matrix_code', name: 'Matrix Green', css: 'hue-rotate(80deg) saturate(1.8) contrast(1.3)', category: 'Vibrant' },
  { id: 'sepia_antique', name: 'Antique Sepia', css: 'sepia(0.85) contrast(1.1) brightness(0.95)', category: 'Retro' },
  { id: 'high_contrast', name: 'Action HDR', css: 'contrast(1.5) saturate(1.3) brightness(1.02)', category: 'Cinematic' },
  { id: 'polaroid_fade', name: 'Faded Polaroid', css: 'contrast(0.9) saturate(0.8) brightness(1.12) sepia(0.15)', category: 'Retro' },
  { id: 'solar_pop', name: 'Vibrant Pop', css: 'saturate(2.0) contrast(1.2)', category: 'Vibrant' },
];

export const EFFECT_PRESETS = [
  { id: 'none', name: 'None', type: 'none', icon: 'close-circle-outline', intensity: 0, category: 'Basic' },
  { id: 'glitch', name: 'Glitch Shake', type: 'glitch', intensity: 0.8, icon: 'flash-outline', category: 'Glitch' },
  { id: 'vhs', name: 'VHS Tape', type: 'vhs', intensity: 0.6, icon: 'videocam-outline', category: 'Retro' },
  { id: 'rgb_split', name: 'RGB Split', type: 'rgb_split', intensity: 0.7, icon: 'layers-outline', category: 'Glitch' },
  { id: 'film_grain', name: 'Film Grain', type: 'film_grain', intensity: 0.5, icon: 'disc-outline', category: 'Retro' },
  { id: 'zoom_pulse', name: 'Zoom Pulse', type: 'zoom_pulse', intensity: 1.0, icon: 'expand-outline', category: 'Motion' },
  { id: 'neon_edge', name: 'Neon Glow', type: 'neon_edge', intensity: 0.9, icon: 'bulb-outline', category: 'Glitch' },
  { id: 'blur_cinematic', name: 'Cinematic Blur', type: 'blur', intensity: 0.4, icon: 'water-outline', category: 'Motion' },
  { id: 'flash', name: 'Strobe Flash', type: 'flash', intensity: 0.8, icon: 'sunny-outline', category: 'Motion' },
  { id: 'vignette', name: 'Dark Vignette', type: 'vignette', intensity: 0.6, icon: 'contract-outline', category: 'Retro' },
  { id: 'mirror', name: 'Mirror Split', type: 'mirror', intensity: 0.8, icon: 'browsers-outline', category: 'Glitch' },
  { id: 'shake', name: 'Action Shake', type: 'shake', intensity: 0.8, icon: 'radio-outline', category: 'Motion' },
  { id: 'rainbow_flow', name: 'Rainbow Psyche', type: 'rainbow_flow', intensity: 0.7, icon: 'color-palette-outline', category: 'Glitch' },
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
      fontWeight: '900' as const,
      fontFamily: 'Impact, Arial Black, sans-serif',
      backgroundColor: '#FF0050',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
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
      fontWeight: '700' as const,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderColor: '#00F2FE',
      borderWidth: 2,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 24,
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
      fontFamily: 'Impact, Arial Black',
      textShadowColor: '#FF0050',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 16,
      textAlign: 'center' as const,
    },
    animation: 'pulse',
  },
  {
    id: 't-4',
    text: 'Cinematic Minimal',
    style: {
      color: '#F8FAFC',
      fontSize: 20,
      fontWeight: '300' as const,
      fontFamily: 'Georgia, serif',
      letterSpacing: 4,
      textAlign: 'center' as const,
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    },
    animation: 'slideUp',
  },
  {
    id: 't-5',
    text: '✨ SUBSCRIBE NOW ✨',
    style: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800' as const,
      fontFamily: 'Impact, Arial Black, sans-serif',
      backgroundColor: '#E50914',
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 8,
      textAlign: 'center' as const,
    },
    animation: 'zoomIn',
  },
  {
    id: 't-6',
    text: 'BREAKING NEWS 🚨',
    style: {
      color: '#000000',
      fontSize: 22,
      fontWeight: '900' as const,
      fontFamily: 'Impact, sans-serif',
      backgroundColor: '#FFE600',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 4,
      textAlign: 'center' as const,
    },
    animation: 'slideDown',
  },
  {
    id: 't-7',
    text: '// SYSTEM_OVERRIDE',
    style: {
      color: '#10B981',
      fontSize: 18,
      fontWeight: '700' as const,
      fontFamily: 'Courier New, monospace',
      backgroundColor: 'rgba(0,0,0,0.85)',
      borderColor: '#10B981',
      borderWidth: 1.5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      textAlign: 'center' as const,
    },
    animation: 'typewriter',
  },
  {
    id: 't-8',
    text: '⚡️ 50% OFF TODAY',
    style: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900' as const,
      backgroundColor: '#8B5CF6',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      textAlign: 'center' as const,
    },
    animation: 'bounce',
  },
  {
    id: 't-9',
    text: 'GLITCH REALITY',
    style: {
      color: '#00F2FE',
      fontSize: 26,
      fontWeight: '900' as const,
      fontFamily: 'Impact, sans-serif',
      textShadowColor: '#FF0050',
      textShadowOffset: { width: 3, height: 0 },
      textShadowRadius: 8,
      textAlign: 'center' as const,
    },
    animation: 'glitch',
  },
  {
    id: 't-10',
    text: 'Golden Luxury 👑',
    style: {
      color: '#FBBF24',
      fontSize: 24,
      fontWeight: '700' as const,
      fontFamily: 'Georgia, serif',
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderColor: '#FBBF24',
      borderWidth: 1.5,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      textAlign: 'center' as const,
    },
    animation: 'fade',
  },
];

export const STICKER_LIBRARY = [
  // Reactions
  { id: 'stk-1', char: '🔥', label: 'Fire', category: 'Reactions' },
  { id: 'stk-2', char: '✨', label: 'Sparkles', category: 'Reactions' },
  { id: 'stk-3', char: '⚡️', label: 'Lightning', category: 'Reactions' },
  { id: 'stk-4', char: '💥', label: 'Boom', category: 'Reactions' },
  { id: 'stk-5', char: '🚀', label: 'Rocket', category: 'Reactions' },
  { id: 'stk-6', char: '❤️', label: 'Heart', category: 'Reactions' },
  { id: 'stk-7', char: '👑', label: 'Crown', category: 'Reactions' },
  { id: 'stk-8', char: '💯', label: '100', category: 'Reactions' },
  { id: 'stk-9', char: '💀', label: 'Skull', category: 'Reactions' },
  { id: 'stk-10', char: '😎', label: 'Cool', category: 'Reactions' },
  { id: 'stk-11', char: '🎉', label: 'Party', category: 'Reactions' },
  { id: 'stk-12', char: '👀', label: 'Eyes', category: 'Reactions' },
  { id: 'stk-13', char: '🤩', label: 'Star Eyes', category: 'Reactions' },
  { id: 'stk-14', char: '🥶', label: 'Cold Ice', category: 'Reactions' },
  { id: 'stk-15', char: '💎', label: 'Diamond', category: 'Reactions' },

  // Creator Badges
  { id: 'stk-b1', char: '🔴 LIVE', label: 'Live Badge', category: 'Creator' },
  { id: 'stk-b2', char: '▶️ SUBSCRIBE', label: 'Subscribe', category: 'Creator' },
  { id: 'stk-b3', char: '👍 LIKE', label: 'Like', category: 'Creator' },
  { id: 'stk-b4', char: '🔔 FOLLOW', label: 'Follow', category: 'Creator' },
  { id: 'stk-b5', char: '🌟 4K HDR', label: '4K Ultra HD', category: 'Creator' },
  { id: 'stk-b6', char: '⚡️ VIRAL', label: 'Viral', category: 'Creator' },
  { id: 'stk-b7', char: '🏷️ NEW', label: 'New Tag', category: 'Creator' },
  { id: 'stk-b8', char: '💎 VIP', label: 'VIP Badge', category: 'Creator' },
  { id: 'stk-b9', char: '🎬 SCENE 1', label: 'Scene 1', category: 'Creator' },

  // Comic & Action
  { id: 'stk-c1', char: '💥 BOOM!', label: 'Boom Alert', category: 'Comic' },
  { id: 'stk-c2', char: '😮 WOW!', label: 'Wow', category: 'Comic' },
  { id: 'stk-c3', char: '😱 OMG!', label: 'OMG', category: 'Comic' },
  { id: 'stk-c4', char: '😂 LOL', label: 'LOL', category: 'Comic' },
  { id: 'stk-c5', char: '⚡️ POW!', label: 'Pow', category: 'Comic' },
  { id: 'stk-c6', char: '🏆 WINNER', label: 'Winner', category: 'Comic' },
  { id: 'stk-c7', char: '🚨 ALERT', label: 'Alert', category: 'Comic' },
  { id: 'stk-c8', char: '🥇 TOP 1', label: 'Top 1', category: 'Comic' },

  // Symbols & Pointers
  { id: 'stk-s1', char: '⬇️', label: 'Arrow Down', category: 'Symbols' },
  { id: 'stk-s2', char: '➡️', label: 'Arrow Right', category: 'Symbols' },
  { id: 'stk-s3', char: '🎯', label: 'Target', category: 'Symbols' },
  { id: 'stk-s4', char: '✔️', label: 'Checkmark', category: 'Symbols' },
  { id: 'stk-s5', char: '❌', label: 'Cross', category: 'Symbols' },
  { id: 'stk-s6', char: '⭐', label: 'Star', category: 'Symbols' },
  { id: 'stk-s7', char: '🔔', label: 'Bell', category: 'Symbols' },
  { id: 'stk-s8', char: '💡', label: 'Idea Bulb', category: 'Symbols' },
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
