import { Ionicons } from "@expo/vector-icons";

export const CHROMA_QUICK_PRESETS = [
  { label: "Green", color: "#00FF00" },
  { label: "Blue", color: "#0047FF" },
  { label: "Black", color: "#000000" },
  { label: "White", color: "#FFFFFF" },
  { label: "Magenta", color: "#FF00FF" },
];

export const BG_COLOR_PRESETS = [
  { label: "Transparent", color: "none" },
  { label: "Black", color: "#000000" },
  { label: "White", color: "#FFFFFF" },
  { label: "Neon Cyan", color: "#00F2FE" },
  { label: "Purple", color: "#8B5CF6" },
  { label: "Red", color: "#FF0050" },
  { label: "Amber", color: "#FFE600" },
  { label: "Emerald", color: "#10B981" },
  { label: "Royal Blue", color: "#2563EB" },
  { label: "Deep Slate", color: "#1E293B" },
];

export const STROKE_PRESETS = [
  { label: "None", color: "none" },
  { label: "White", color: "#FFFFFF" },
  { label: "Neon Cyan", color: "#00F2FE" },
  { label: "Amber Gold", color: "#FFE600" },
  { label: "Hot Pink", color: "#FF0050" },
  { label: "Emerald", color: "#10B981" },
  { label: "Purple Glow", color: "#A855F7" },
];

export const QUICK_BG_COLORS = BG_COLOR_PRESETS.slice(0, 5);
export const QUICK_STROKE_COLORS = STROKE_PRESETS.slice(0, 5);

export type CutoutMode = "none" | "chroma" | "auto";

export const CUTOUT_TABS: {
  id: CutoutMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "none", label: "None", icon: "close-circle-outline" },
  { id: "auto", label: "Auto", icon: "sparkles" },
  { id: "chroma", label: "Chroma", icon: "color-filter" },
];
