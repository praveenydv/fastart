// FastArt TypeScript Project Schema & Models

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | '2.35:1';
export type Resolution = '720p' | '1080p' | '2K/4K';
export type FPS = 24 | 25 | 30 | 50 | 60;

export type MaskShape = 'none' | 'linear' | 'mirror' | 'circle' | 'rectangle' | 'heart' | 'star';

export interface MaskConfig {
  shape: MaskShape;
  size?: number; // 10% to 100%
  feather?: number; // 0 to 50 blur
  roundness?: number; // 0 to 50 for rectangle
  inverted?: boolean;
  x?: number; // offset x %
  y?: number; // offset y %
  rotation?: number; // mask angle
}

export interface CustomCrop {
  x: number; // 0..100%
  y: number; // 0..100%
  width: number; // 0..100%
  height: number; // 0..100%
}

export interface ClipTransform {
  scale?: number;
  rotation?: number;
  x?: number;
  y?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  mask?: MaskConfig;
  crop?: CustomCrop;
}

export interface TransitionConfig {
  type: string;
  duration: number;
}

export interface KeyframePoint {
  time: number;
  transform: ClipTransform;
  opacity: number;
}

export interface VideoClip {
  id: string;
  title: string;
  type: 'video' | 'photo';
  url: string;
  duration: number;
  startTime: number;
  trimIn?: number;
  trimOut?: number;
  speed?: number;
  speedCurve?: number[] | null;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  reverse?: boolean;
  filter?: string;
  effect?: string;
  transition?: TransitionConfig;
  transform?: ClipTransform;
  mask?: MaskConfig;
  crop?: CustomCrop;
  keyframes?: KeyframePoint[];
  trackIndex?: number;
}

export interface AudioClip {
  id: string;
  title: string;
  artist?: string;
  duration: number;
  startTime: number;
  trimIn?: number;
  trimOut?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  url: string;
  trackIndex?: number;
}

export interface TextStyle {
  color?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  backgroundColor?: string;
  paddingHorizontal?: number;
  paddingVertical?: number;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  letterSpacing?: number;
  fontFamily?: string;
  textShadowColor?: string;
  textShadowRadius?: number;
  textShadowOffset?: { width: number; height: number };
  textEffect?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface TextClip {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  position?: { x: number; y: number };
  scale?: number;
  rotation?: number;
  animation?: 'bounce' | 'typewriter' | 'fade' | 'slideUp' | 'pulse' | string;
  style?: TextStyle;
  trackIndex?: number;
}

export interface StickerClip {
  id: string;
  char: string;
  startTime: number;
  duration: number;
  position?: { x: number; y: number };
  scale?: number;
  rotation?: number;
  trackIndex?: number;
}

export interface EffectClip {
  id: string;
  type: string;
  name: string;
  startTime: number;
  duration: number;
  intensity?: number;
  trackIndex?: number;
}

export interface ProjectTracks {
  video: VideoClip[];
  audio: AudioClip[];
  text: TextClip[];
  stickers: StickerClip[];
  effects: EffectClip[];
  filters?: any[];
}

export interface FastArtProject {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  fps: FPS;
  currentTime: number;
  isPlaying?: boolean;
  zoom: number;
  thumbnailUrl?: string;
  tracks: ProjectTracks;
}

export const createDefaultProject = (title = 'New Project'): FastArtProject => ({
  id: 'proj-' + Date.now(),
  title,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  aspectRatio: '9:16',
  resolution: '1080p',
  fps: 30,
  currentTime: 0,
  isPlaying: false,
  zoom: 60,
  tracks: {
    video: [],
    audio: [],
    text: [],
    stickers: [],
    effects: [],
  },
});

export const computeTotalDuration = (tracks?: ProjectTracks | null): number => {
  let maxDur = 0;
  if (!tracks) return 0;
  Object.values(tracks).forEach((trackList) => {
    if (Array.isArray(trackList)) {
      trackList.forEach((clip: any) => {
        const end = (clip.startTime || 0) + (clip.duration || 0);
        if (end > maxDur) maxDur = end;
      });
    }
  });
  return Math.max(maxDur, 0);
};
