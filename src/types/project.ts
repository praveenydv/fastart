// FastArt TypeScript Project Schema & Models

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | '2.35:1';
export type Resolution = '720p' | '1080p' | '2K/4K';
export type FPS = 24 | 25 | 30 | 50 | 60;

export type MaskShape = 'none' | 'linear' | 'mirror' | 'circle' | 'rectangle' | 'heart' | 'star';

export interface MaskConfig {
  shape: MaskShape;
  size?: number; // 10% to 100%
  width?: number; // 5% to 200% width deformation
  height?: number; // 5% to 200% height deformation
  feather?: number; // 0 to 50 blur
  roundness?: number; // 0 to 50 for rectangle
  inverted?: boolean;
  x?: number; // offset x %
  y?: number; // offset y %
  rotation?: number; // mask angle
}

export interface CutoutConfig {
  enabled: boolean;
  mode: 'chroma' | 'auto';
  keyColor: string; // e.g. '#00FF00', '#0000FF'
  intensity: number; // 0..100 (similarity tolerance)
  shadow: number; // 0..100 (edge smoothness/feather)
  strokeColor?: string; // outline color e.g. '#00F2FE'
  strokeWidth?: number; // outline width 0..10
  bgColor?: string; // background fill color e.g. '#000000', '#FFFFFF', '#00F2FE' or 'none'
  clipId?: string;
  clipTime?: number;
}

export interface SpeedCurvePoint {
  t: number; // normalized time 0.0 to 1.0
  s: number; // speed multiplier 0.1 to 10.0
}

export interface CustomLutConfig {
  id: string;
  name: string;
  cssFilter?: string;
  size?: number;
  data?: number[]; // RGB matrix if 3D cube
}

export interface TrajectoryPoint {
  time: number; // in seconds relative to project timeline
  x: number; // normalized center x (0..100) or pixel dx
  y: number; // normalized center y (0..100) or pixel dy
  scale: number; // scale multiplier relative to t0 (1.0 = 100%)
  rotation: number; // rotation offset in degrees
  confidence: number; // 0..1 tracking quality score
  boxWidth?: number; // width in % of frame (0..100)
  boxHeight?: number; // height in % of frame (0..100)
}

export interface TrackingRect {
  x: number; // 0..100%
  y: number; // 0..100%
  width: number; // 0..100%
  height: number; // 0..100%
}

export type TrackingActionType =
  | 'pin_element' // Attach another clip (Text/Sticker/PIP) to track with target
  | 'mosaic_censor' // Dynamic pixelated/blurred censor box over target
  | 'camera_center' // Lock video to keep target centered in viewport
  | 'cinematic_drift'; // Procedural cinematic motion

export interface MotionTrackConfig {
  enabled: boolean;
  mode: 'follow_center' | 'cinematic_drift' | 'dynamic_zoom' | 'orbit_float' | 'custom' | 'object_track';
  intensity?: number;
  // CapCut Object Tracking
  targetRect?: TrackingRect;
  trajectory?: TrajectoryPoint[];
  actionType?: TrackingActionType;
  pinnedClipId?: string; // ID of Text / Sticker / Video clip to follow target
  trackScale?: boolean; // Grow/shrink with subject distance (default: true)
  trackRotation?: boolean; // Rotate with subject tilt (default: true)
  mosaicStyle?: 'pixelate' | 'blur'; // Censor style
  mosaicRadius?: number; // Censor block/blur radius in px (default: 16)
  smoothness?: number; // Damping filter strength 0..100 (default: 60)
  trackingStatus?: 'idle' | 'tracking' | 'completed' | 'failed';
  lastTrackedAt?: number;
}

export interface CustomCrop {
  x: number; // 0..100%
  y: number; // 0..100%
  width: number; // 0..100%
  height: number; // 0..100%
}

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface HSLChannelConfig {
  hue: number; // -180 to 180
  saturation: number; // -100 to 100
  luminance: number; // -100 to 100
}

export type HSLColorChannel =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'magenta';

export type HSLAdjustments = Partial<Record<HSLColorChannel, HSLChannelConfig>>;

export type VoiceEffectId =
  | 'none'
  | 'robot'
  | 'chipmunk'
  | 'deep_bass'
  | 'megaphone'
  | 'echo'
  | 'vinyl'
  | 'helium';

export type KeyframeEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring';

export interface ClipTransform {
  scale?: number;
  scaleX?: number; // Horizontal stretch factor (1.0 = normal)
  scaleY?: number; // Vertical stretch factor (1.0 = normal)
  rotation?: number;
  rotateX?: number; // 3D Pitch / tilt X (degrees) for distance/receding view
  rotateY?: number; // 3D Yaw / tilt Y (degrees) for side angle view
  skewX?: number; // Skew angle X (degrees)
  skewY?: number; // Skew angle Y (degrees)
  perspective?: number; // 3D camera depth distance in px (default 800)
  x?: number;
  y?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  mask?: MaskConfig;
  crop?: CustomCrop;
  cutout?: CutoutConfig;
  blendMode?: BlendMode;
  blur?: number; // Blur radius in px (0..50)
}

export interface TransitionConfig {
  type: string;
  duration: number;
}

export interface KeyframePoint {
  time: number;
  transform: ClipTransform;
  opacity: number;
  easing?: KeyframeEasing;
}

export interface VideoClip {
  id: string;
  title: string;
  type: 'video' | 'photo';
  url: string;
  thumbnail?: string;
  sourceMediaId?: string;
  duration: number;
  startTime: number;
  trimIn?: number;
  trimOut?: number;
  minTrimIn?: number;
  maxTrimOut?: number;
  maxDuration?: number;
  mediaDuration?: number;
  thumbnailTrimIn?: number;
  speed?: number;
  speedCurve?: number[] | SpeedCurvePoint[] | { id: string; name?: string; points: any } | null;
  smoothSlowMo?: 'none' | 'blend' | 'optical_flow';
  volume?: number;
  hasAudio?: boolean;
  muted?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  denoise?: boolean;
  reverse?: boolean;
  filter?: string;
  customLut?: CustomLutConfig;
  effect?: string;
  effectIntensity?: number;
  transition?: TransitionConfig;
  transform?: ClipTransform;
  scale?: number;
  rotation?: number;
  opacity?: number;
  fit?: 'contain' | 'cover';
  mask?: MaskConfig;
  crop?: CustomCrop;
  cutout?: CutoutConfig;
  blendMode?: BlendMode;
  hslAdjustments?: HSLAdjustments;
  voiceEffect?: VoiceEffectId;
  keyframes?: KeyframePoint[];
  motionTrack?: MotionTrackConfig;
  animation?: ClipAnimationConfig | string;
  trackIndex?: number;
  layer?: number;
  isEnding?: boolean;
  peaks?: number[];
}

export interface ClipAnimationConfig {
  inPreset?: string;
  inDuration?: number;
  outPreset?: string;
  outDuration?: number;
  loopPreset?: string;
  comboPreset?: string; // backwards compatibility alias for loopPreset
  preset?: string;
  type?: 'in' | 'out' | 'loop' | 'combo';
  duration?: number;
}

export interface AudioClip {
  id: string;
  title: string;
  artist?: string;
  duration: number;
  startTime: number;
  trimIn?: number;
  trimOut?: number;
  minTrimIn?: number;
  maxTrimOut?: number;
  maxDuration?: number;
  mediaDuration?: number;
  speed?: number;
  speedCurve?: number[] | SpeedCurvePoint[] | { id: string; name?: string; points: any } | null;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  denoise?: boolean;
  url: string;
  sourceMediaId?: string;
  trackIndex?: number;
  peaks?: number[];
  voiceEffect?: VoiceEffectId;
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
  highlightColor?: string;
  highlightStyle?: 'color' | 'box' | 'scale' | 'glow' | 'underline';
  enableWordHighlight?: boolean;
  uppercase?: boolean;
}

export interface TextClip {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  position?: { x: number; y: number };
  scale?: number;
  rotation?: number;
  animation?: ClipAnimationConfig | 'none' | 'bounce' | 'typewriter' | 'fade' | 'slideUp' | 'slideDown' | 'zoomIn' | 'pulse' | 'glitch' | 'shake' | 'wave' | string;
  style?: TextStyle;
  keyframes?: KeyframePoint[];
  trackIndex?: number;
  layer?: number;
  motionTrack?: MotionTrackConfig;
}

export interface CaptionClip {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  position?: { x: number; y: number };
  scale?: number;
  rotation?: number;
  animation?: ClipAnimationConfig | 'none' | 'bounce' | 'karaoke' | 'typewriter' | 'fade' | 'slideUp' | 'slideDown' | 'zoomIn' | 'pulse' | 'glitch' | 'shake' | 'wave' | string;
  style?: TextStyle;
  keyframes?: KeyframePoint[];
  trackIndex?: number;
  layer?: number;
  motionTrack?: MotionTrackConfig;
  presetId?: string;
  words?: { word: string; start: number; end: number }[];
  highlightColor?: string;
  highlightStyle?: 'color' | 'box' | 'scale' | 'glow' | 'underline';
  enableWordHighlight?: boolean;
  uppercase?: boolean;
}

export interface StickerClip {
  id: string;
  char: string;
  startTime: number;
  duration: number;
  position?: { x: number; y: number };
  scale?: number;
  rotation?: number;
  animation?: ClipAnimationConfig | 'none' | 'bounce' | 'pulse' | 'wave' | 'fade' | 'pop' | string;
  keyframes?: KeyframePoint[];
  trackIndex?: number;
  layer?: number;
  motionTrack?: MotionTrackConfig;
}

export interface EffectClip {
  id: string;
  type: string;
  name: string;
  startTime: number;
  duration: number;
  intensity?: number;
  filter?: string;
  customLut?: CustomLutConfig;
  keyframes?: KeyframePoint[];
  trackIndex?: number;
  layer?: number;
  isWholeProject?: boolean;
}

export interface ProjectTracks {
  video: VideoClip[];
  audio: AudioClip[];
  text: TextClip[];
  captions?: CaptionClip[];
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
  canvasBackground?: string;
  beatMarkers?: number[];
  aiDenoise?: boolean;
  captionSettings?: any;
  filter?: string;
  customLut?: CustomLutConfig;
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
  canvasBackground: '#000000',
  tracks: {
    video: [],
    audio: [],
    text: [],
    captions: [],
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
