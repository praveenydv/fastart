/**
 * FastArt Standard Minimal Monotone Design System Constants
 * 
 * Single source of truth for all colors, dimensions, typography,
 * radii, spacing, and surface elevations across Mobile & Desktop.
 */

export const THEME_COLORS = {
  // --- Surface & Elevation Hierarchy (CapCut Dark Studio) ---
  background: "#121214",       // CapCut workspace backdrop & player framing
  surface: "#18181A",          // Inset panels, search fields, timecode pill, card buttons
  cardBackground: "#1B1C20",   // Timeline clips base, modal sheets, project cards
  card: "#1B1C20",             // Shorthand alias for cardBackground
  cardElevated: "#222328",     // Context menus, floating popovers, dropdown lists
  surfaceElevated: "#222328",  // Shorthand alias for cardElevated
  cardHover: "#2A2B32",        // Hover feedback state

  // --- Borders & Dividers ---
  border: "#25262B",           // Standard 1px crisp CapCut divider
  borderLight: "#32343C",      // Highlight border for modals & popovers
  borderSubtle: "rgba(255, 255, 255, 0.08)", // Inner card lines & timeline clip separation
  borderGlow: "rgba(0, 229, 201, 0.35)",      // Focus ring for selected tools (CapCut Cyan Glow)

  // --- Signature CapCut Cyan Palette ---
  primary: "#00E5C9",          // Export button, New Project CTA, CapCut Teal Hero
  primaryDark: "#00B39D",      // Deep contrast cyan
  primaryText: "#000000",      // Bold text on cyan buttons
  primaryHover: "#33EBCE",

  accent: "#00E5C9",           // CapCut Cyan accent: playhead scrub handle, active tab, active tool, keyframe diamond
  accentHover: "#33EBCE",
  accentGlow: "rgba(0, 229, 201, 0.15)",      // Active chip background tint, studio badge
  cyan: "#00E5C9",
  cyanBg: "rgba(0, 229, 201, 0.12)",
  cyanBorder: "rgba(0, 229, 201, 0.35)",

  // --- Typography Colors ---
  textPrimary: "#FFFFFF",      // 100% white for titles, active buttons, root toolbar icons
  textSecondary: "#94A3B8",    // Slate 400 for tool labels, subtitles, timecode duration, descriptions
  textMuted: "#64748B",        // Slate 500 for timestamps, placeholder copy, disabled icons
  textDisabled: "#475569",     // Slate 600 for inactive/disabled states

  // --- Status & Utility Colors ---
  danger: "#EF4444",           // Delete clip, delete project
  error: "#EF4444",            // Shorthand alias for danger
  dangerBg: "rgba(239, 68, 68, 0.08)",
  success: "#10B981",          // Export complete, download confirmation
  successBg: "rgba(16, 185, 129, 0.12)",
  warning: "#F59E0B",
  proGold: "#FBBF24",

  // --- CapCut Track & Clip Color Theme (Exact from CapCut Studio) ---
  timelineTrackBg: "#121214",
  timelineClipBg: "#1E3A5F",
  timelineClipBorder: "rgba(255, 255, 255, 0.12)",
  timelineHandle: "#FFFFFF",
  timelineRulerMark: "#3F3F46",

  // Specific CapCut Clip Types
  clipVideoBg: "#1E3A5F",      // Muted Navy Blue (Main Video Track)
  clipVideoBorder: "#3B82F6",
  clipPhotoBg: "#16384C",      // Muted Teal Cyan (Photo/Image Track)
  clipPhotoBorder: "#00E5C9",
  clipTextBg: "#8C483A",       // Terra-cotta / Rust Red (Text Track)
  clipTextBorder: "#EF4444",
  clipAudioBg: "#1E5A44",      // Forest Green (Audio Track)
  clipAudioBorder: "#10B981",
  clipEffectBg: "#4C2D7A",     // Muted Deep Purple (Effects Track)
  clipEffectBorder: "#A855F7",
  clipStickerBg: "#6B4C28",    // Muted Warm Amber (Sticker Track)
  clipStickerBorder: "#F59E0B",
  clipCaptionBg: "#373E4F",    // Muted Slate (Caption Track)
  clipCaptionBorder: "#64748B",

  // CapCut Desktop Studio Surfaces
  capcutHeaderBg: "#141518",
  capcutSidebarBg: "#101114",
  capcutPanelBg: "#141518",
  capcutSurfaceInset: "#1A1B20",
  capcutBorder: "#24262C",
  capcutBorderLight: "#32353E",
  capcutTabActive: "#24262E",
  capcutTeal: "#00E5C9",
  capcutPlayhead: "#FFFFFF",
} as const;

export const DESIGN_CONSTANTS = {
  // --- Standard Layout Dimensions ---
  DIMENSIONS: {
    // Header & Navigation
    headerHeight: 48,
    navButtonSize: 32,

    // Video Player & Controls
    playerControlBarHeight: 38,
    playerControlBarCompactHeight: 36,
    playButtonSize: 32,
    stepButtonSize: 28,
    utilityButtonSize: 28,

    // Timeline
    timelineHeaderHeight: 32,
    trackRowHeight: 44,
    timelineZoomMin: 20,
    timelineZoomMax: 1000,
    timelineZoomDefault: 60,

    // Bottom Docks & Sidebars
    mobileDockHeight: 52,
    mobileToolBtnWidth: 46,
    mobileToolBtnHeight: 44,
    desktopSidebarWidth: 62,
    desktopToolBtnWidth: 52,
    desktopToolBtnHeight: 44,

    // Tool Sheets & Modals
    mobileInlineSheetHeight: 300,
    modalMaxHeightMobile: "82%",
    modalMaxHeightDesktop: "76%",

    // Touch Targets & Swatches
    touchTargetMin: 44,
    touchTargetMicro: 28,
    colorSwatchSize: 28,
    colorSwatchRadius: 14,
    colorSwatchMargin: 8,
  },

  // --- Typography Scale (Standard Legibility) ---
  TYPOGRAPHY: {
    fontFamily: "System",
    sizes: {
      micro: 9.5,    // Bottom dock labels, desktop sidebar labels, status badges
      subtext: 10,   // Timestamps, hint copy, aspect ratio details
      label: 11,     // Tab bar buttons, timecode numbers, section headers
      body: 12,      // Subtitles, card secondary descriptions
      input: 12.5,   // Text inputs, search fields, button copy
      title: 13.5,   // Modal titles, project card names, panel headers
      heading: 15,   // Screen headers, section main titles
      display: 24,   // FastArt logo, hero titles
    },
    weights: {
      regular: "400" as const,
      medium: "500" as const,
      semibold: "600" as const,
      bold: "700" as const,
      extrabold: "800" as const,
    },
    letterSpacing: {
      tight: -0.3,
      normal: 0,
      wide: 0.2,
      wider: 0.5,
      widest: 1.0,
    },
  },

  // --- Spacing Scale ---
  SPACING: {
    xs: 4,     // Micro-gap inside badges and icon clusters
    sm: 6,     // Spacing between icons and text
    md: 8,     // Standard card gap, button cluster gap
    base: 12,  // Standard panel padding
    lg: 16,    // Modal horizontal padding
    xl: 20,    // Page container margins
    xxl: 28,   // Desktop studio wrapper gutter
  },

  // --- Border Radii ---
  RADII: {
    xs: 4,     // Small badges, micro-pills
    sm: 6,     // Preset chips, subtle inputs
    md: 8,     // Standard cards, header buttons, inputs
    lg: 14,    // Modal sheet top corners, hero cards
    xl: 20,    // Floating toast notifications
    full: 9999,// Circular play buttons, color swatches
  },

  // --- Z-Index Layering ---
  Z_INDEX: {
    base: 0,
    canvas: 5,
    overlayHandles: 20,
    controlsBar: 30,
    timelineResizeGrip: 40,
    header: 50,
    bottomDock: 60,
    modalInline: 70,
    modalPopup: 100,
    toast: 9999,
  },

  // --- Standard Iconography System ---
  ICONS: {
    family: "Ionicons", // Primary standard icon library
    sizes: {
      micro: 11,    // Stepper indicators, badge icons, inline sub-icons
      inline: 13,   // Buttons with text, search bar icons, format pills
      nav: 16,      // Header back/close/undo/redo, modal dismiss buttons
      control: 16,  // Player control bar buttons (grid, keyframe, fullscreen)
      playCenter: 18, // Center play/pause icon
      tool: 20,     // Bottom dock tools, desktop sidebar items
      display: 24,  // Empty state hero icons, media picker icons
    },
    colors: {
      active: "#00E5C9",
      inactive: "#94A3B8",
      muted: "#64748B",
      primaryOnWhite: "#000000",
      cyan: "#00E5C9",
      danger: "#EF4444",
      success: "#10B981",
    },
  },

  // --- Predefined Shadow Profiles ---
  SHADOWS: {
    card: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    primaryBtn: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 4,
    },
    glowAccent: {
      shadowColor: "#FFFFFF",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
  },
} as const;

export default {
  colors: THEME_COLORS,
  ...DESIGN_CONSTANTS,
};
