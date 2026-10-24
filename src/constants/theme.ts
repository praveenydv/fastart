// FastArt Unified Obsidian Dark Design System
export const theme = {
  colors: {
    background: '#08090E',
    surface: '#0F131D',
    cardBackground: '#131826',
    cardElevated: '#1B2234',
    cardHover: '#232B42',
    border: '#1F2637',
    borderLight: '#2C364D',
    borderGlow: 'rgba(0, 242, 254, 0.35)',

    // Brand Accents
    primary: '#FFFFFF',
    primaryHover: '#E4E4E7',
    accent: '#00F2FE',
    accentHover: '#38F8FF',
    accentGlow: 'rgba(0, 242, 254, 0.18)',

    // Text Hierarchy
    white: '#FFFFFF',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textDisabled: '#475569',

    // Status & Utility
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.12)',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.12)',
    warning: '#F59E0B',
    proGold: '#FBBF24',

    // Timeline & Canvas
    timelineTrackBg: '#0F131D',
    timelineVideo: '#FFFFFF',
    timelineAudio: '#18181B',
    timelineAudioText: '#D4D4D8',
    timelineText: '#18181B',
    timelineTextTag: '#D4D4D8',
    timelineEffect: '#18181B',
    timelineEffectTag: '#D4D4D8',
    timelineOverlay: '#18181B',
    timelineOverlayTag: '#D4D4D8',
    timelineHandle: '#00F2FE',
  },
  typography: {
    fontFamily: 'System',
    sizes: {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
      display: 30,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  borderRadius: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },
};

export default theme;
