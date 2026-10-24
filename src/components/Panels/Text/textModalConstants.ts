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

export const STROKE_COLOR_SWATCHES = [
  { label: "None", value: "none" },
  { label: "Black", value: "#000000" },
  { label: "White", value: "#FFFFFF" },
  { label: "Yellow", value: "#FFE600" },
  { label: "Cyan", value: "#00F2FE" },
  { label: "Red", value: "#FF0050" },
  { label: "Green", value: "#10B981" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Pink", value: "#FB7185" },
  { label: "Orange", value: "#F59E0B" },
  { label: "Blue", value: "#38BDF8" },
  { label: "Slate", value: "#64748B" },
];

export const STROKE_WIDTH_OPTIONS = [
  { label: "None", value: 0 },
  { label: "1px", value: 1 },
  { label: "2px", value: 2 },
  { label: "3px", value: 3 },
  { label: "5px", value: 5 },
  { label: "8px", value: 8 },
];

import { FONT_CATALOG, FontDefinition } from "../../../utils/fontCatalog";

export const FONT_OPTIONS = FONT_CATALOG;

export const ANIMATION_OPTIONS = [
  // --- ENTRANCE (IN) ---
  { id: "none", label: "None (Static)", icon: "remove-circle-outline", category: "in" },
  { id: "fade", label: "Fade In", icon: "eye-outline", category: "in" },
  { id: "slideUp", label: "Slide Up", icon: "arrow-up-circle-outline", category: "in" },
  { id: "slideDown", label: "Slide Down", icon: "arrow-down-circle-outline", category: "in" },
  { id: "slide", label: "Slide Left", icon: "arrow-back-circle-outline", category: "in" },
  { id: "slideRight", label: "Slide Right", icon: "arrow-forward-circle-outline", category: "in" },
  { id: "zoomIn", label: "Zoom In", icon: "expand-outline", category: "in" },
  { id: "bounce", label: "Bounce Pop", icon: "trending-up", category: "in" },
  { id: "typewriter", label: "Typewriter", icon: "keypad-outline", category: "in" },
  { id: "stamp", label: "Stamp Down", icon: "download-outline", category: "in" },
  { id: "roll", label: "Roll In", icon: "sync-outline", category: "in" },
  { id: "flip", label: "Flip 3D", icon: "swap-horizontal-outline", category: "in" },
  { id: "blurIn", label: "Blur Focus", icon: "aperture-outline", category: "in" },

  // --- LOOP / CONTINUOUS ---
  { id: "pulse", label: "Heartbeat Pulse", icon: "heart-outline", category: "loop" },
  { id: "glitch", label: "Glitch Jitter", icon: "flash-outline", category: "loop" },
  { id: "shake", label: "Camera Shake", icon: "radio-outline", category: "loop" },
  { id: "wave", label: "Floating Wave", icon: "water-outline", category: "loop" },
  { id: "wiggle", label: "Wiggle Jiggle", icon: "shuffle-outline", category: "loop" },
  { id: "flicker", label: "Neon Flicker", icon: "bulb-outline", category: "loop" },
  { id: "karaoke", label: "Karaoke Bounce", icon: "musical-note-outline", category: "loop" },
];

export const BORDER_OPTIONS = [
  { label: "No Border", color: undefined },
  { label: "Cyan Glow", color: "#00F2FE" },
  { label: "Coral Glow", color: "#FF0050" },
  { label: "Yellow Glow", color: "#FFE600" },
  { label: "Green Glow", color: "#10B981" },
  { label: "Purple Glow", color: "#A855F7" },
  { label: "White Border", color: "#FFFFFF" },
  { label: "Black Outline", color: "#000000" },
];

export const TEXT_EFFECT_OPTIONS = [
  { id: "none", label: "Clean", desc: "No Effect", icon: "sparkles-outline" },
  { id: "neon", label: "Neon Glow", desc: "Radiant Halo", icon: "flash" },
  { id: "3d", label: "3D Pop", desc: "Extruded Depth", icon: "cube" },
  { id: "shadow", label: "Drop Shadow", desc: "Cinema Shade", icon: "contrast" },
  { id: "stroke", label: "Outline", desc: "Sharp Border", icon: "brush" },
  { id: "cyber", label: "Cyber Split", desc: "RGB Flare", icon: "color-wand" },
  { id: "gold", label: "Gold Luxury", desc: "Amber Glow", icon: "sunny" },
  { id: "glitch", label: "Glitch Jitter", desc: "RGB Shift", icon: "hardware-chip" },
  { id: "retro_box", label: "Retro Box", desc: "Solid Block", icon: "square-outline" },
  { id: "fire", label: "Flame Core", desc: "Hot Orange", icon: "flame-outline" },
  { id: "frost", label: "Ice Frost", desc: "Sub-Zero", icon: "snow-outline" },
  { id: "hologram", label: "Hologram", desc: "Futuristic", icon: "radio-outline" },
];

