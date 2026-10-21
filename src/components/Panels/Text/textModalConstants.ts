export const COLOR_SWATCHES = [
  "#FFFFFF",
  "#FFE600",
  "#00F2FE",
  "#FF0050",
  "#10B981",
  "#A855F7",
  "#F59E0B",
  "#FB7185",
  "#38BDF8",
  "#4ADE80",
  "#94A3B8",
  "#000000",
];

export const BG_SWATCHES = [
  { label: "None", value: "transparent" },
  { label: "Red", value: "#FF0050" },
  { label: "Cyan", value: "#00F2FE" },
  { label: "Dark", value: "rgba(0,0,0,0.75)" },
  { label: "Yellow", value: "#FFE600" },
  { label: "Green", value: "#10B981" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Netflix", value: "#E50914" },
  { label: "White", value: "rgba(255,255,255,0.92)" },
];

export const FONT_OPTIONS = [
  {
    id: "Impact, Arial Black, sans-serif",
    label: "Viral Impact",
    weight: "900",
  },
  {
    id: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
    label: "Clean Modern",
    weight: "700",
  },
  { id: "Courier New, monospace", label: "Typewriter", weight: "700" },
  { id: "Georgia, serif", label: "Cinematic Serif", weight: "600" },
  { id: "cursive, Comic Sans MS", label: "Creative Script", weight: "700" },
];

export const ANIMATION_OPTIONS = [
  { id: "none", label: "None (Static)", icon: "remove-circle-outline" },
  { id: "fade", label: "Fade In", icon: "eye-outline" },
  { id: "slideUp", label: "Slide Up", icon: "arrow-up-circle-outline" },
  { id: "slideDown", label: "Slide Down", icon: "arrow-down-circle-outline" },
  { id: "slide", label: "Slide Left", icon: "arrow-back-circle-outline" },
  { id: "slideRight", label: "Slide Right", icon: "arrow-forward-circle-outline" },
  { id: "zoomIn", label: "Zoom In", icon: "expand-outline" },
  { id: "bounce", label: "Bounce In", icon: "trending-up" },
  { id: "typewriter", label: "Typewriter", icon: "keypad-outline" },
  { id: "pulse", label: "Heartbeat Pulse", icon: "heart-outline" },
  { id: "glitch", label: "Glitch Jitter", icon: "flash-outline" },
  { id: "shake", label: "Camera Shake", icon: "radio-outline" },
  { id: "wave", label: "Floating Wave", icon: "water-outline" },
];

export const BORDER_OPTIONS = [
  { label: "No Border", color: undefined },
  { label: "Cyan Glow", color: "#00F2FE" },
  { label: "Coral Glow", color: "#FF0050" },
  { label: "Yellow Glow", color: "#FFE600" },
  { label: "White Border", color: "#FFFFFF" },
];

export const TEXT_EFFECT_OPTIONS = [
  { id: "none", label: "Clean", desc: "No Effect", icon: "sparkles-outline" },
  { id: "neon", label: "Neon Glow", desc: "Radiant Halo", icon: "flash" },
  { id: "3d", label: "3D Pop", desc: "Extruded Depth", icon: "cube" },
  {
    id: "shadow",
    label: "Drop Shadow",
    desc: "Cinema Shade",
    icon: "contrast",
  },
  { id: "stroke", label: "Outline", desc: "Sharp Border", icon: "brush" },
  {
    id: "cyber",
    label: "Cyber Split",
    desc: "RGB Flare",
    icon: "color-wand",
  },
  { id: "gold", label: "Gold Luxury", desc: "Amber Glow", icon: "sunny" },
  {
    id: "glitch",
    label: "Glitch Jitter",
    desc: "RGB Shift",
    icon: "hardware-chip",
  },
];
