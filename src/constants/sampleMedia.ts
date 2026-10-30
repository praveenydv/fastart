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

/** Standardized high-quality reference prefix image for list previews (filters, effects, animations) */
export const PRESET_PREVIEW_IMAGE = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';

export const FILTER_PRESETS = [
  { id: 'normal', name: 'Original', desc: 'No color grading', css: 'none', category: 'Basic' },
  { id: 'teal_orange', name: 'Teal & Orange', desc: 'Blockbuster cinematic look', css: 'contrast(1.25) saturate(1.35) hue-rotate(15deg)', category: 'Cinematic' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', desc: 'Futuristic magenta & cyan', css: 'hue-rotate(290deg) contrast(1.4) saturate(1.85)', category: 'Vibrant' },
  { id: 'vintage', name: 'Vintage 90s', desc: 'Retro warm analog film', css: 'sepia(0.35) contrast(0.95) brightness(1.08)', category: 'Retro' },
  { id: 'noir', name: 'Noir B&W', desc: 'High-contrast monochrome', css: 'grayscale(1) contrast(1.45) brightness(0.92)', category: 'Retro' },
  { id: 'warm_sunset', name: 'Golden Hour', desc: 'Warm amber sunlight glow', css: 'sepia(0.22) saturate(1.45) brightness(1.08)', category: 'Cinematic' },
  { id: 'cold_moody', name: 'Moody Blue', desc: 'Deep blue moody shadows', css: 'hue-rotate(185deg) saturate(0.85) contrast(1.2)', category: 'Cinematic' },
  { id: 'emerald', name: 'Emerald Film', desc: 'Rich organic green film', css: 'hue-rotate(95deg) saturate(1.25) contrast(1.12)', category: 'Cinematic' },
  { id: 'vhs_retro', name: 'Retro VHS CRT', desc: '80s analog tape colors', css: 'contrast(1.3) saturate(1.6) brightness(1.05)', category: 'Retro' },
  { id: 'pastel_dream', name: 'Pastel Dream', desc: 'Soft glowing airy tones', css: 'brightness(1.15) saturate(1.2) contrast(0.9)', category: 'Vibrant' },
  { id: 'cinematic_warm', name: 'Amber Glow', desc: 'Warm theatrical lighting', css: 'sepia(0.3) saturate(1.35) contrast(1.15)', category: 'Cinematic' },
  { id: 'matrix_code', name: 'Matrix Green', desc: 'Hacker sci-fi tint', css: 'hue-rotate(80deg) saturate(1.8) contrast(1.3)', category: 'Vibrant' },
  { id: 'sepia_antique', name: 'Antique Sepia', desc: 'Aged historical photo', css: 'sepia(0.85) contrast(1.1) brightness(0.95)', category: 'Retro' },
  { id: 'high_contrast', name: 'Action HDR', desc: 'Punchy vivid dynamic range', css: 'contrast(1.5) saturate(1.3) brightness(1.02)', category: 'Cinematic' },
  { id: 'polaroid_fade', name: 'Faded Polaroid', desc: 'Sun-faded instant print', css: 'contrast(0.9) saturate(0.8) brightness(1.12) sepia(0.15)', category: 'Retro' },
  { id: 'solar_pop', name: 'Vibrant Pop', desc: 'Hyper-saturated colors', css: 'saturate(2.0) contrast(1.2)', category: 'Vibrant' },
];

export const EFFECT_PRESETS = [
  { id: 'none', name: 'None', desc: 'No visual effect', type: 'none', icon: 'close-circle-outline', intensity: 0, category: 'Basic' },
  // --- ✨ AI EFFECTS SUITE ---
  { id: 'beauty_smooth', name: 'AI Beauty Smooth', desc: 'Flawless skin & soft glow', type: 'beauty_smooth', intensity: 0.6, icon: 'heart-outline', category: 'AI' },
  { id: 'ai_cyberpunk', name: 'AI Cyberpunk Glow', desc: 'Neon edges & futuristic aura', type: 'ai_cyberpunk', intensity: 0.75, icon: 'color-wand-outline', category: 'AI' },
  { id: 'ai_manga', name: 'AI Anime Manga', desc: 'Stylized Japanese comic inks', type: 'ai_manga', intensity: 0.8, icon: 'brush-outline', category: 'AI' },
  { id: 'ai_matrix', name: 'AI Matrix Cascade', desc: 'Digital green rain & binary', type: 'ai_matrix', intensity: 0.75, icon: 'code-slash-outline', category: 'AI' },
  { id: 'thermal', name: 'AI Thermal Heatmap', desc: 'Infrared heat vision map', type: 'thermal', intensity: 0.8, icon: 'flame-outline', category: 'AI' },
  { id: 'ai_aura', name: 'AI Radiant Aura', desc: 'Rainbow luminescent halo', type: 'ai_aura', intensity: 0.7, icon: 'sparkles', category: 'AI' },
  { id: 'ai_night_vision', name: 'AI Night Vision', desc: 'Military phosphor reticle', type: 'ai_night_vision', intensity: 0.75, icon: 'eye-outline', category: 'AI' },
  { id: 'ai_cartoon', name: 'AI Cel Cartoon', desc: 'Vibrant animated comic look', type: 'ai_cartoon', intensity: 0.7, icon: 'happy-outline', category: 'AI' },
  // --- CREATIVE VIDEO EFFECTS ---
  { id: 'glitch', name: 'Glitch Shake', desc: 'Digital signal twitch & shake', type: 'glitch', intensity: 0.8, icon: 'flash-outline', category: 'Glitch' },
  { id: 'vhs', name: 'VHS Tape', desc: '80s tracking lines & REC tag', type: 'vhs', intensity: 0.6, icon: 'videocam-outline', category: 'Retro' },
  { id: 'rgb_split', name: 'RGB Split', desc: 'Chromatic aberration pulse', type: 'rgb_split', intensity: 0.7, icon: 'layers-outline', category: 'Glitch' },
  { id: 'film_grain', name: 'Film Grain 16mm', desc: 'Analog organic dust & grain', type: 'film_grain', intensity: 0.5, icon: 'disc-outline', category: 'Retro' },
  { id: 'old_film', name: '1920s Silent Film', desc: 'Classic sepia flicker & frame', type: 'old_film', intensity: 0.7, icon: 'film-outline', category: 'Retro' },
  { id: 'crt_tv', name: 'CRT TV Screen', desc: 'Cathode ray phosphor lines', type: 'crt_tv', intensity: 0.6, icon: 'tv-outline', category: 'Retro' },
  { id: 'zoom_pulse', name: 'Zoom Pulse', desc: 'Bass-drop rhythmic punch', type: 'zoom_pulse', intensity: 1.0, icon: 'expand-outline', category: 'Motion' },
  { id: 'neon_edge', name: 'Neon Glow', desc: 'Glowing electric contours', type: 'neon_edge', intensity: 0.9, icon: 'bulb-outline', category: 'Glitch' },
  { id: 'blur_cinematic', name: 'Cinematic Blur', desc: 'Soft dreamy depth blur', type: 'blur', intensity: 0.4, icon: 'water-outline', category: 'Motion' },
  { id: 'gaussian_blur', name: 'Gaussian Blur', desc: 'Smooth heavy diffusion', type: 'gaussian_blur', intensity: 0.6, icon: 'water-outline', category: 'Motion' },
  { id: 'motion_blur', name: 'Fast Motion Blur', desc: 'High-speed velocity streaking', type: 'motion_blur', intensity: 0.7, icon: 'speedometer-outline', category: 'Motion' },
  { id: 'radial_blur', name: 'Radial Zoom Blur', desc: 'Tunnel-vision rush blur', type: 'radial_blur', intensity: 0.65, icon: 'disc-outline', category: 'Motion' },
  { id: 'mosaic_blur', name: 'Mosaic Pixelate', desc: '8-bit retro censor pixelation', type: 'mosaic_blur', intensity: 0.7, icon: 'grid-outline', category: 'Glitch' },
  { id: 'flash', name: 'Strobe Flash', desc: 'High-energy white club strobe', type: 'flash', intensity: 0.8, icon: 'sunny-outline', category: 'Motion' },
  { id: 'vignette', name: 'Dark Vignette', desc: 'Dramatic dark corner falloff', type: 'vignette', intensity: 0.6, icon: 'contract-outline', category: 'Retro' },
  { id: 'mirror', name: 'Mirror Split', desc: 'Symmetrical center reflection', type: 'mirror', intensity: 0.8, icon: 'browsers-outline', category: 'Glitch' },
  { id: 'shake', name: 'Action Shake', desc: 'Handheld camera impact tremor', type: 'shake', intensity: 0.8, icon: 'radio-outline', category: 'Motion' },
  { id: 'rainbow_flow', name: 'Rainbow Psyche', desc: 'Psychedelic color spectrum', type: 'rainbow_flow', intensity: 0.7, icon: 'color-palette-outline', category: 'Glitch' },
  { id: 'prism_leak', name: 'Prism Light Leak', desc: 'Diagonal lens rainbow streak', type: 'prism_leak', intensity: 0.7, icon: 'sparkles-outline', category: 'Light' },
  { id: 'sun_flare', name: 'Sun Lens Flare', desc: 'Anamorphic golden sunlight beam', type: 'sun_flare', intensity: 0.8, icon: 'sunny', category: 'Light' },
  { id: 'cyberpunk_dual', name: 'Cyberpunk Dual', desc: 'Split dual-color lighting', type: 'cyberpunk_dual', intensity: 0.75, icon: 'color-wand-outline', category: 'Light' },
  { id: 'water_ripple', name: 'Water Ripple', desc: 'Refractive liquid distortion', type: 'water_ripple', intensity: 0.6, icon: 'water', category: 'Glitch' },
  { id: 'fisheye', name: 'Fisheye Lens', desc: 'Wide-angle curved barrel lens', type: 'fisheye', intensity: 0.7, icon: 'aperture-outline', category: 'Motion' },
  { id: 'tilt_shift', name: 'Tilt Shift Blur', desc: 'Miniature model focus slice', type: 'tilt_shift', intensity: 0.5, icon: 'camera-outline', category: 'Motion' },
  { id: 'kaleidoscope', name: 'Kaleidoscope Quad', desc: '4-quadrant geometric mirror', type: 'kaleidoscope', intensity: 0.8, icon: 'grid-outline', category: 'Glitch' },
];

export const TRANSITION_PRESETS = [
  { id: 'cut', name: 'Hard Cut', desc: 'Instant clean switch', duration: 0 },
  { id: 'dissolve', name: 'Dissolve', desc: 'Smooth crossfade blend', duration: 0.6 },
  { id: 'zoom_in', name: 'Zoom In Punch', desc: 'Dramatic forward push', duration: 0.5 },
  { id: 'zoom_out', name: 'Zoom Out Pull', desc: 'Dynamic backward pull', duration: 0.5 },
  { id: 'slide_left', name: 'Slide Left Push', desc: 'Pushes scene to left', duration: 0.4 },
  { id: 'slide_right', name: 'Slide Right Push', desc: 'Pushes scene to right', duration: 0.4 },
  { id: 'push_up', name: 'Push Up Wipe', desc: 'Vertical upward wipe', duration: 0.4 },
  { id: 'push_down', name: 'Push Down Wipe', desc: 'Vertical downward wipe', duration: 0.4 },
  { id: 'flash_white', name: 'Flash White', desc: 'Bright strobe burst', duration: 0.3 },
  { id: 'fade_black', name: 'Fade To Black', desc: 'Cinematic dip to dark', duration: 0.5 },
  { id: 'glitch_transition', name: 'Glitch Warp', desc: 'Chromatic data glitch', duration: 0.5 },
  { id: 'spin_cw', name: 'Spin Clockwise', desc: 'Fast 360° rotation wipe', duration: 0.5 },
  { id: 'spin_ccw', name: 'Spin Counter', desc: 'Reverse 360° rotation wipe', duration: 0.5 },
  { id: 'light_leak', name: 'Light Leak Flare', desc: 'Warm anamorphic flare sweep', duration: 0.4 },
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
  // --- REACTIONS & VIRAL VIBES ---
  { id: 'stk-1', char: '🔥', label: 'Fire Hot', category: 'Reactions' },
  { id: 'stk-2', char: '✨', label: 'Sparkles', category: 'Reactions' },
  { id: 'stk-3', char: '⚡️', label: 'Lightning Shock', category: 'Reactions' },
  { id: 'stk-4', char: '💥', label: 'Explosion', category: 'Reactions' },
  { id: 'stk-5', char: '🚀', label: 'Rocket Moon', category: 'Reactions' },
  { id: 'stk-6', char: '❤️', label: 'Red Heart', category: 'Reactions' },
  { id: 'stk-7', char: '👑', label: 'King Crown', category: 'Reactions' },
  { id: 'stk-8', char: '💯', label: '100 Score', category: 'Reactions' },
  { id: 'stk-9', char: '💀', label: 'Dead Skull', category: 'Reactions' },
  { id: 'stk-10', char: '😎', label: 'Cool Shades', category: 'Reactions' },
  { id: 'stk-11', char: '🎉', label: 'Party Popper', category: 'Reactions' },
  { id: 'stk-12', char: '👀', label: 'Curious Eyes', category: 'Reactions' },
  { id: 'stk-13', char: '🤩', label: 'Star Eyes', category: 'Reactions' },
  { id: 'stk-14', char: '🥶', label: 'Cold Ice Freeze', category: 'Reactions' },
  { id: 'stk-15', char: '💎', label: 'Diamond Bling', category: 'Reactions' },
  { id: 'stk-16', char: '🤯', label: 'Mind Blown', category: 'Reactions' },
  { id: 'stk-17', char: '💰', label: 'Money Bag', category: 'Reactions' },
  { id: 'stk-18', char: '💸', label: 'Flying Cash', category: 'Reactions' },
  { id: 'stk-19', char: '🤡', label: 'Clown Face', category: 'Reactions' },
  { id: 'stk-20', char: '👽', label: 'Alien UFO', category: 'Reactions' },
  { id: 'stk-21', char: '😈', label: 'Devil Smirk', category: 'Reactions' },
  { id: 'stk-22', char: '🥳', label: 'Birthday Celebration', category: 'Reactions' },
  { id: 'stk-23', char: '🤫', label: 'Secret Shh', category: 'Reactions' },
  { id: 'stk-24', char: '🫡', label: 'Salute Respect', category: 'Reactions' },
  { id: 'stk-25', char: '🫠', label: 'Melting Mood', category: 'Reactions' },
  { id: 'stk-26', char: '💖', label: 'Sparkle Heart', category: 'Reactions' },
  { id: 'stk-27', char: '🔥👀', label: 'Look Here', category: 'Reactions' },
  { id: 'stk-28', char: '🎯💯', label: 'On Point', category: 'Reactions' },

  // --- CREATOR & SOCIAL BADGES ---
  { id: 'stk-b1', char: '🔴 LIVE', label: 'Live Broadcast', category: 'Creator' },
  { id: 'stk-b2', char: '▶️ SUBSCRIBE', label: 'Subscribe Button', category: 'Creator' },
  { id: 'stk-b3', char: '👍 LIKE', label: 'Like Thumbs Up', category: 'Creator' },
  { id: 'stk-b4', char: '🔔 FOLLOW', label: 'Follow & Bell', category: 'Creator' },
  { id: 'stk-b5', char: '🌟 4K HDR', label: '4K Ultra HD', category: 'Creator' },
  { id: 'stk-b6', char: '⚡️ VIRAL', label: 'Viral Trend', category: 'Creator' },
  { id: 'stk-b7', char: '🏷️ NEW', label: 'New Arrival', category: 'Creator' },
  { id: 'stk-b8', char: '💎 VIP', label: 'VIP Member', category: 'Creator' },
  { id: 'stk-b9', char: '🎬 SCENE 1', label: 'Scene 1 Clap', category: 'Creator' },
  { id: 'stk-b10', char: '📌 PINNED', label: 'Pinned Comment', category: 'Creator' },
  { id: 'stk-b11', char: '🔗 LINK IN BIO', label: 'Link In Bio', category: 'Creator' },
  { id: 'stk-b12', char: '🔊 SOUND ON', label: 'Sound On Audio', category: 'Creator' },
  { id: 'stk-b13', char: '⏳ WAIT FOR IT', label: 'Wait For It', category: 'Creator' },
  { id: 'stk-b14', char: '💬 COMMENT', label: 'Comment Prompt', category: 'Creator' },
  { id: 'stk-b15', char: '🔁 SHARE', label: 'Share Video', category: 'Creator' },
  { id: 'stk-b16', char: '✅ VERIFIED', label: 'Verified Badge', category: 'Creator' },
  { id: 'stk-b17', char: '📈 TRENDING', label: 'Trending #1', category: 'Creator' },
  { id: 'stk-b18', char: '🏆 OFFICIAL', label: 'Official Tag', category: 'Creator' },
  { id: 'stk-b19', char: '🎧 USE HEADPHONES', label: 'Headphones Audio', category: 'Creator' },
  { id: 'stk-b20', char: '⚠️ SPOILER ALERT', label: 'Spoiler Warning', category: 'Creator' },

  // --- COMIC, ACTION & MEME ---
  { id: 'stk-c1', char: '💥 BOOM!', label: 'Boom Explosion', category: 'Comic' },
  { id: 'stk-c2', char: '😮 WOW!', label: 'Wow Surprised', category: 'Comic' },
  { id: 'stk-c3', char: '😱 OMG!', label: 'Oh My God', category: 'Comic' },
  { id: 'stk-c4', char: '😂 LOL', label: 'Laugh Out Loud', category: 'Comic' },
  { id: 'stk-c5', char: '⚡️ POW!', label: 'Pow Punch', category: 'Comic' },
  { id: 'stk-c6', char: '🏆 WINNER', label: 'Winner Cup', category: 'Comic' },
  { id: 'stk-c7', char: '🚨 ALERT', label: 'Emergency Alert', category: 'Comic' },
  { id: 'stk-c8', char: '🥇 TOP 1', label: 'Top 1 Champion', category: 'Comic' },
  { id: 'stk-c9', char: '🧠 BIG BRAIN', label: 'Big Brain IQ', category: 'Comic' },
  { id: 'stk-c10', char: '🐐 THE GOAT', label: 'The GOAT', category: 'Comic' },
  { id: 'stk-c11', char: '🔥 LIT AF', label: 'Lit AF', category: 'Comic' },
  { id: 'stk-c12', char: '💀 BRUH', label: 'Bruh Moment', category: 'Comic' },
  { id: 'stk-c13', char: '✨ MAGIC', label: 'Magic Spell', category: 'Comic' },
  { id: 'stk-c14', char: '🍕 PIZZA TIME', label: 'Pizza Time', category: 'Comic' },
  { id: 'stk-c15', char: '☕️ CHILL', label: 'Coffee Chill', category: 'Comic' },
  { id: 'stk-c16', char: '⛔️ STOP', label: 'Stop Sign', category: 'Comic' },

  // --- SYMBOLS, ARROWS & POINTERS ---
  { id: 'stk-s1', char: '⬇️', label: 'Arrow Down', category: 'Symbols' },
  { id: 'stk-s2', char: '➡️', label: 'Arrow Right', category: 'Symbols' },
  { id: 'stk-s3', char: '⬅️', label: 'Arrow Left', category: 'Symbols' },
  { id: 'stk-s4', char: '⬆️', label: 'Arrow Up', category: 'Symbols' },
  { id: 'stk-s5', char: '🎯', label: 'Bulls Eye Target', category: 'Symbols' },
  { id: 'stk-s6', char: '✔️', label: 'Green Check', category: 'Symbols' },
  { id: 'stk-s7', char: '❌', label: 'Red Cross', category: 'Symbols' },
  { id: 'stk-s8', char: '⭐', label: 'Gold Star', category: 'Symbols' },
  { id: 'stk-s9', char: '🔔', label: 'Alert Bell', category: 'Symbols' },
  { id: 'stk-s10', char: '💡', label: 'Idea Bulb', category: 'Symbols' },
  { id: 'stk-s11', char: '👇', label: 'Pointing Down', category: 'Symbols' },
  { id: 'stk-s12', char: '👉', label: 'Pointing Right', category: 'Symbols' },
  { id: 'stk-s13', char: '👈', label: 'Pointing Left', category: 'Symbols' },
  { id: 'stk-s14', char: '👆', label: 'Pointing Up', category: 'Symbols' },
  { id: 'stk-s15', char: '⭕', label: 'Red Circle', category: 'Symbols' },
  { id: 'stk-s16', char: '⏳', label: 'Hourglass Timer', category: 'Symbols' },
  { id: 'stk-s17', char: '🎵', label: 'Musical Note', category: 'Symbols' },
  { id: 'stk-s18', char: '🎶', label: 'Melody Tunes', category: 'Symbols' },
  { id: 'stk-s19', char: '📸', label: 'Flash Camera', category: 'Symbols' },
  { id: 'stk-s20', char: '🕹️', label: 'Arcade Joystick', category: 'Symbols' },
  { id: 'stk-s21', char: '🎮', label: 'Game Controller', category: 'Symbols' },
  { id: 'stk-s22', char: '🔋', label: 'Full Battery', category: 'Symbols' },
  { id: 'stk-s23', char: '🪩', label: 'Disco Ball', category: 'Symbols' },
  { id: 'stk-s24', char: '🌈', label: 'Rainbow Arc', category: 'Symbols' },
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
