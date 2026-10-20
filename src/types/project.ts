// FastArt TypeScript Project Schema & Models

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | '2.35:1';
export type Resolution = '720p' | '1080p' | '2K/4K';
export type FPS = 24 | 25 | 30 | 50 | 60;

export interface ClipTransform {
  scale: number;
  rotation: number;
  x: number;
  y: number;
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
  filter?: string;
  effect?: string;
  transition?: TransitionConfig;
  transform?: ClipTransform;
  keyframes?: KeyframePoint[];
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
  url: string;
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
  textShadowColor?: string;
  textShadowRadius?: number;
  textShadowOffset?: { width: number; height: number };
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
}

export interface StickerClip {
  id: string;
  char: string;
  startTime: number;
  duration: number;
  position?: { x: number; y: number };
  scale?: number;
  rotation?: number;
}

export interface EffectClip {
  id: string;
  type: string;
  name: string;
  startTime: number;
  duration: number;
  intensity?: number;
}

export interface ProjectTracks {
  video: VideoClip[];
  audio: AudioClip[];
  text: TextClip[];
  stickers: StickerClip[];
  effects: EffectClip[];
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
  isPlaying: boolean;
  zoom: number;
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
