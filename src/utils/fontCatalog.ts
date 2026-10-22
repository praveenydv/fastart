// FastArt 50+ Universal & Google Fonts Catalog + Dynamic Loader

export interface FontDefinition {
  id: string;
  label: string;
  category: 'trending' | 'sans' | 'display' | 'serif' | 'script' | 'retro';
  fontFamily: string;
  googleFontName?: string; // Name for Google Fonts API
  weight?: string;
  isCustom?: boolean;
}

export const FONT_CATEGORIES = [
  { id: 'all', label: 'All Fonts' },
  { id: 'trending', label: '🔥 Trending' },
  { id: 'display', label: '💥 Viral / Display' },
  { id: 'sans', label: '✨ Modern Sans' },
  { id: 'serif', label: '🎬 Cinematic Serif' },
  { id: 'script', label: '✍️ Script / Hand' },
  { id: 'retro', label: '👾 Retro / Pixel' },
] as const;

export const FONT_CATALOG: FontDefinition[] = [
  // --- TRENDING / TOP VIRAL ---
  {
    id: "Impact, Arial Black, sans-serif",
    label: "Viral Impact",
    category: "trending",
    fontFamily: "Impact, Arial Black, sans-serif",
    weight: "900",
  },
  {
    id: "Anton",
    label: "Anton Bold",
    category: "trending",
    fontFamily: "'Anton', Impact, sans-serif",
    googleFontName: "Anton",
    weight: "700",
  },
  {
    id: "Montserrat",
    label: "Montserrat Black",
    category: "trending",
    fontFamily: "'Montserrat', sans-serif",
    googleFontName: "Montserrat:wght@800;900",
    weight: "900",
  },
  {
    id: "Poppins",
    label: "Poppins Extra Bold",
    category: "trending",
    fontFamily: "'Poppins', sans-serif",
    googleFontName: "Poppins:wght@700;800;900",
    weight: "800",
  },
  {
    id: "Bebas Neue",
    label: "Bebas Neue Pro",
    category: "trending",
    fontFamily: "'Bebas Neue', cursive, sans-serif",
    googleFontName: "Bebas+Neue",
    weight: "700",
  },
  {
    id: "Oswald",
    label: "Oswald Heavy",
    category: "trending",
    fontFamily: "'Oswald', sans-serif",
    googleFontName: "Oswald:wght@600;700",
    weight: "700",
  },

  // --- VIRAL / DISPLAY ---
  {
    id: "Bangers",
    label: "Bangers Comic",
    category: "display",
    fontFamily: "'Bangers', cursive",
    googleFontName: "Bangers",
    weight: "400",
  },
  {
    id: "Bungee",
    label: "Bungee Block",
    category: "display",
    fontFamily: "'Bungee', cursive",
    googleFontName: "Bungee",
    weight: "400",
  },
  {
    id: "Permanent Marker",
    label: "Permanent Marker",
    category: "display",
    fontFamily: "'Permanent Marker', cursive",
    googleFontName: "Permanent+Marker",
    weight: "400",
  },
  {
    id: "Righteous",
    label: "Righteous Modern",
    category: "display",
    fontFamily: "'Righteous', cursive",
    googleFontName: "Righteous",
    weight: "400",
  },
  {
    id: "Titan One",
    label: "Titan Chubby",
    category: "display",
    fontFamily: "'Titan One', cursive",
    googleFontName: "Titan+One",
    weight: "400",
  },
  {
    id: "Black Han Sans",
    label: "Black Han Bold",
    category: "display",
    fontFamily: "'Black Han Sans', sans-serif",
    googleFontName: "Black+Han+Sans",
    weight: "900",
  },
  {
    id: "Rubik Glitch",
    label: "Rubik Glitch",
    category: "display",
    fontFamily: "'Rubik Glitch', cursive",
    googleFontName: "Rubik+Glitch",
    weight: "400",
  },
  {
    id: "Alfa Slab One",
    label: "Alfa Slab",
    category: "display",
    fontFamily: "'Alfa Slab One', cursive",
    googleFontName: "Alfa+Slab+One",
    weight: "400",
  },
  {
    id: "Russo One",
    label: "Russo Action",
    category: "display",
    fontFamily: "'Russo One', sans-serif",
    googleFontName: "Russo+One",
    weight: "400",
  },

  // --- MODERN SANS-SERIF ---
  {
    id: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
    label: "Clean Modern (System)",
    category: "sans",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
    weight: "700",
  },
  {
    id: "Inter",
    label: "Inter Pro",
    category: "sans",
    fontFamily: "'Inter', sans-serif",
    googleFontName: "Inter:wght@600;700;800",
    weight: "700",
  },
  {
    id: "Roboto",
    label: "Roboto Bold",
    category: "sans",
    fontFamily: "'Roboto', sans-serif",
    googleFontName: "Roboto:wght@700;900",
    weight: "700",
  },
  {
    id: "Outfit",
    label: "Outfit Geometric",
    category: "sans",
    fontFamily: "'Outfit', sans-serif",
    googleFontName: "Outfit:wght@700;800",
    weight: "700",
  },
  {
    id: "Space Grotesk",
    label: "Space Grotesk",
    category: "sans",
    fontFamily: "'Space Grotesk', sans-serif",
    googleFontName: "Space+Grotesk:wght@600;700",
    weight: "700",
  },
  {
    id: "Plus Jakarta Sans",
    label: "Jakarta Sans",
    category: "sans",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    googleFontName: "Plus+Jakarta+Sans:wght@700;800",
    weight: "700",
  },
  {
    id: "DM Sans",
    label: "DM Sans Sleek",
    category: "sans",
    fontFamily: "'DM Sans', sans-serif",
    googleFontName: "DM+Sans:wght@700;800",
    weight: "700",
  },
  {
    id: "Syne",
    label: "Syne Ultra Extra",
    category: "sans",
    fontFamily: "'Syne', sans-serif",
    googleFontName: "Syne:wght@700;800",
    weight: "800",
  },
  {
    id: "Orbitron",
    label: "Orbitron Sci-Fi",
    category: "sans",
    fontFamily: "'Orbitron', sans-serif",
    googleFontName: "Orbitron:wght@700;900",
    weight: "800",
  },
  {
    id: "Comfortaa",
    label: "Comfortaa Rounded",
    category: "sans",
    fontFamily: "'Comfortaa', cursive",
    googleFontName: "Comfortaa:wght@700",
    weight: "700",
  },

  // --- CINEMATIC SERIF ---
  {
    id: "Georgia, serif",
    label: "Cinematic Serif",
    category: "serif",
    fontFamily: "Georgia, serif",
    weight: "600",
  },
  {
    id: "Playfair Display",
    label: "Playfair Luxury",
    category: "serif",
    fontFamily: "'Playfair Display', serif",
    googleFontName: "Playfair+Display:ital,wght@0,700;0,900;1,700",
    weight: "700",
  },
  {
    id: "Cinzel",
    label: "Cinzel Epic Film",
    category: "serif",
    fontFamily: "'Cinzel', serif",
    googleFontName: "Cinzel:wght@700;900",
    weight: "700",
  },
  {
    id: "Merriweather",
    label: "Merriweather Classic",
    category: "serif",
    fontFamily: "'Merriweather', serif",
    googleFontName: "Merriweather:wght@700;900",
    weight: "700",
  },
  {
    id: "Cormorant Garamond",
    label: "Cormorant Garamond",
    category: "serif",
    fontFamily: "'Cormorant Garamond', serif",
    googleFontName: "Cormorant+Garamond:wght@600;700",
    weight: "700",
  },
  {
    id: "Bodoni Moda",
    label: "Bodoni Fashion",
    category: "serif",
    fontFamily: "'Bodoni Moda', serif",
    googleFontName: "Bodoni+Moda:wght@700;900",
    weight: "700",
  },
  {
    id: "Prata",
    label: "Prata High Fashion",
    category: "serif",
    fontFamily: "'Prata', serif",
    googleFontName: "Prata",
    weight: "400",
  },
  {
    id: "Libre Baskerville",
    label: "Libre Baskerville",
    category: "serif",
    fontFamily: "'Libre Baskerville', serif",
    googleFontName: "Libre+Baskerville:wght@700",
    weight: "700",
  },
  {
    id: "Abril Fatface",
    label: "Abril Fatface",
    category: "serif",
    fontFamily: "'Abril Fatface', cursive",
    googleFontName: "Abril+Fatface",
    weight: "400",
  },

  // --- SCRIPT / HANDWRITING ---
  {
    id: "cursive, Comic Sans MS",
    label: "Creative Script",
    category: "script",
    fontFamily: "cursive, Comic Sans MS",
    weight: "700",
  },
  {
    id: "Pacifico",
    label: "Pacifico Surfer",
    category: "script",
    fontFamily: "'Pacifico', cursive",
    googleFontName: "Pacifico",
    weight: "400",
  },
  {
    id: "Dancing Script",
    label: "Dancing Script",
    category: "script",
    fontFamily: "'Dancing Script', cursive",
    googleFontName: "Dancing+Script:wght@700",
    weight: "700",
  },
  {
    id: "Caveat",
    label: "Caveat Handwritten",
    category: "script",
    fontFamily: "'Caveat', cursive",
    googleFontName: "Caveat:wght@700",
    weight: "700",
  },
  {
    id: "Lobster",
    label: "Lobster Vintage",
    category: "script",
    fontFamily: "'Lobster', cursive",
    googleFontName: "Lobster",
    weight: "400",
  },
  {
    id: "Satisfy",
    label: "Satisfy Flow",
    category: "script",
    fontFamily: "'Satisfy', cursive",
    googleFontName: "Satisfy",
    weight: "400",
  },
  {
    id: "Great Vibes",
    label: "Great Vibes Cursive",
    category: "script",
    fontFamily: "'Great Vibes', cursive",
    googleFontName: "Great+Vibes",
    weight: "400",
  },
  {
    id: "Sacramento",
    label: "Sacramento Elegant",
    category: "script",
    fontFamily: "'Sacramento', cursive",
    googleFontName: "Sacramento",
    weight: "400",
  },
  {
    id: "Yellowtail",
    label: "Yellowtail Diner",
    category: "script",
    fontFamily: "'Yellowtail', cursive",
    googleFontName: "Yellowtail",
    weight: "400",
  },

  // --- RETRO / PIXEL / MONO ---
  {
    id: "Courier New, monospace",
    label: "Typewriter Classic",
    category: "retro",
    fontFamily: "Courier New, monospace",
    weight: "700",
  },
  {
    id: "Press Start 2P",
    label: "Press Start 8-Bit",
    category: "retro",
    fontFamily: "'Press Start 2P', monospace",
    googleFontName: "Press+Start+2P",
    weight: "400",
  },
  {
    id: "VT323",
    label: "VT323 Terminal CRT",
    category: "retro",
    fontFamily: "'VT323', monospace",
    googleFontName: "VT323",
    weight: "400",
  },
  {
    id: "Silkscreen",
    label: "Silkscreen Arcade",
    category: "retro",
    fontFamily: "'Silkscreen', monospace",
    googleFontName: "Silkscreen:wght@700",
    weight: "700",
  },
  {
    id: "Space Mono",
    label: "Space Mono Hacker",
    category: "retro",
    fontFamily: "'Space Mono', monospace",
    googleFontName: "Space+Mono:wght@700",
    weight: "700",
  },
  {
    id: "Share Tech Mono",
    label: "Share Tech Mono",
    category: "retro",
    fontFamily: "'Share Tech Mono', monospace",
    googleFontName: "Share+Tech+Mono",
    weight: "400",
  },
];

const loadedGoogleFonts = new Set<string>();

/**
 * Dynamically loads a Google Font into the document head on Web
 */
export function loadGoogleFont(font: FontDefinition): void {
  if (typeof document === "undefined" || !font.googleFontName) return;
  if (loadedGoogleFonts.has(font.googleFontName)) return;

  try {
    const linkId = `gfont-${font.googleFontName.replace(/[^a-zA-Z0-9]/g, "-")}`;
    if (document.getElementById(linkId)) {
      loadedGoogleFonts.add(font.googleFontName);
      return;
    }

    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleFontName}&display=swap`;
    document.head.appendChild(link);
    loadedGoogleFonts.add(font.googleFontName);
  } catch (err) {
    console.warn("FastArt: Failed to inject Google Font", font.googleFontName, err);
  }
}

/**
 * Preloads the top trending fonts on app boot
 */
export function preloadTrendingFonts(): void {
  if (typeof document === "undefined") return;
  FONT_CATALOG.filter((f) => f.category === "trending" && f.googleFontName).forEach(
    loadGoogleFont
  );
}

import { Platform } from "react-native";
import * as Font from "expo-font";

/**
 * Registers a custom uploaded font (TTF / OTF / WOFF2) across Web and Native Mobile
 */
export async function registerCustomFont(name: string, fileData: any): Promise<FontDefinition | null> {
  const cleanName = name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_ -]/g, "");

  try {
    if (Platform.OS !== "web") {
      // Native iOS / Android font loading via expo-font
      if (typeof fileData === "string") {
        await Font.loadAsync({ [cleanName]: fileData });
      }
    } else if (typeof window !== "undefined" && typeof FontFace !== "undefined") {
      // Web browser dynamic font face intake
      let buffer: ArrayBuffer;
      if (fileData instanceof Blob) {
        buffer = await fileData.arrayBuffer();
      } else if (typeof fileData === "string") {
        const res = await fetch(fileData);
        buffer = await res.arrayBuffer();
      } else {
        buffer = fileData;
      }

      const fontFace = new FontFace(cleanName, buffer);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);
    }

    const customFont: FontDefinition = {
      id: cleanName,
      label: cleanName,
      category: "trending",
      fontFamily: `'${cleanName}', sans-serif`,
      isCustom: true,
      weight: "700",
    };

    return customFont;
  } catch (err) {
    console.error("FastArt: Custom font load failed", err);
    return null;
  }
}
