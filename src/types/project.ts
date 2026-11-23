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
  keyframes?: MaskKeyframePoint[];
}

export interface MaskKeyframePoint {
  time: number;
  mask: MaskConfig;
  easing?: KeyframeEasing;
  bezierCurve?: [number, number, number, number];
}

export interface CutoutConfig {
  enabled: boolean;
  mode: 'chroma' | 'auto' | 'none';
  quality?: 'fast' | 'studio' | 'best'; // High-performance unified single-quality neural matting
  bakedFps?: number;
  keyColor: string; // e.g. '#00FF00', '#0000FF'
  intensity: number; // 0..100 (similarity tolerance)
  shadow: number; // 0..100 (edge smoothness/feather)
  strokeColor?: string; // outline color e.g. '#00F2FE'
  strokeWidth?: number; // outline width 0..10
  strokeStyle?: 'solid' | 'glow' | 'dotted'; // outline style preset
  edgeRefine?: boolean; // AI edge refinement for fine hair & translucent edges
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
  mosaicShape?: 'circle' | 'rectangle'; // Censor shape (default: 'rectangle')
  cameraFitToScreen?: boolean; // CapCut Camera Tracking: automatically zoom to fit screen without black borders (default: true)
  cameraZoom?: number; // Custom camera zoom level (e.g. 1.0 to 2.5, default: 1.25)
  cameraLockCenter?: boolean; // Center the tracked subject at (50%, 50%) of canvas (default: true)
  smoothness?: number; // Damping filter strength 0..100 (default: 60)
  trackDirection?: 'forward' | 'backward' | 'bidirectional'; // Tracking timeline direction
  anchorTime?: number; // Timeline time where tracking target was selected
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
  | 'helium'
  | 'isolate_vocal'
  | 'remove_vocal';

export type KeyframeEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'spring'
  | 'smooth'
  | 'whip'
  | 'bounce'
  | 'jump'
  | 'anticipate'
  | 'bezier';

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
  bezierCurve?: [number, number, number, number];
  mask?: MaskConfig;
}

export interface VideoClip {
  id: string;
  title: string;
  type: 'video' | 'photo';
  url: string;
  thumbnail?: string;
  sourceMediaId?: string;
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
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
  filterIntensity?: number; // 0..1 (default 1.0)
  customLut?: CustomLutConfig;
  effect?: string;
  effectIntensity?: number;
  transition?: TransitionConfig;
  transform?: ClipTransform;
  scale?: number;
  rotation?: number;
  opacity?: number;
  fit?: 'contain' | 'cover';
  sourceFrameRate?: number;
  frameRate?: number;
  mask?: MaskConfig;
  crop?: CustomCrop;
  cutout?: CutoutConfig;
  blendMode?: BlendMode;
  hslAdjustments?: HSLAdjustments;
  voiceEffect?: VoiceEffectId;
  keyframes?: KeyframePoint[];
  maskKeyframes?: MaskKeyframePoint[];
  motionTrack?: MotionTrackConfig;
  animation?: ClipAnimationConfig | string;
  trackIndex?: number;
  layer?: number;
  isEnding?: boolean;
  isMissing?: boolean;
  needsPermission?: boolean;
  isLinked?: boolean;
  peaks?: number[];
  autoReframe?: { targetRatio: string; trackingSpeed?: 'slow' | 'default' | 'fast'; enabled?: boolean };
  isCompoundClip?: boolean;
  compoundClips?: any[];
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
  beatMarkers?: number[];
  voiceEffect?: VoiceEffectId;
  ducking?: boolean;
  isVoiceover?: boolean;
  isMissing?: boolean;
  needsPermission?: boolean;
  isLinked?: boolean;
}

export interface TextStyle {
  color?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic';
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
  autoEmoji?: boolean;
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
  opacity?: number;
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
  opacity?: number;
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
  autoEmoji?: boolean;
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
  opacity?: number;
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
  filterIntensity?: number; // 0..1 (default 1.0)
  customLut?: CustomLutConfig;
  keyframes?: KeyframePoint[];
  trackIndex?: number;
  layer?: number;
  isWholeProject?: boolean;
  isAdjustmentLayer?: boolean;
  hslAdjustments?: HSLAdjustments;
  opacity?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  exposure?: number;
  temperature?: number;
  vignette?: number;
  sharpness?: number;
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

export interface ProjectAsset {
  id: string;
  sourceMediaId?: string;
  title: string;
  type: 'video' | 'photo' | 'audio';
  url: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
  importedAt?: number;
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
  magneticTimeline?: boolean;
  audioDucking?: boolean;
  audioDuckingLevel?: number;
  captionSettings?: any;
  filter?: string;
  filterIntensity?: number; // 0..1 (default 1.0)
  customLut?: CustomLutConfig;
  assets?: ProjectAsset[];
  hiddenTracks?: number[];
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
  magneticTimeline: true,
  audioDucking: false,
  audioDuckingLevel: 0.3,
  assets: [],
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
  if (!tracks) return 0;
  let videoMax = 0;
  if (Array.isArray(tracks.video) && tracks.video.length > 0) {
    tracks.video.forEach((clip: any) => {
      const parsedDur = typeof clip.duration === 'number' ? clip.duration : parseFloat(clip.duration);
      const parsedMediaDur = typeof clip.mediaDuration === 'number' ? clip.mediaDuration : parseFloat(clip.mediaDuration);
      const dur = (!isNaN(parsedDur) && parsedDur > 0)
        ? parsedDur
        : (!isNaN(parsedMediaDur) && parsedMediaDur > 0)
          ? parsedMediaDur
          : 0;
      const start = typeof clip.startTime === 'number' ? clip.startTime : parseFloat(clip.startTime);
      const end = (isNaN(start) ? 0 : start) + dur;
      if (end > videoMax) videoMax = end;
    });
  }

  // Also include text, captions, stickers, and effects so overlays near or at the end are never chopped
  let visualMax = videoMax;
  const visualTracks = [tracks.text, tracks.captions, tracks.stickers, tracks.effects];
  visualTracks.forEach((trackList) => {
    if (Array.isArray(trackList)) {
      trackList.forEach((clip: any) => {
        const dur = typeof clip.duration === 'number' ? clip.duration : parseFloat(clip.duration);
        const start = typeof clip.startTime === 'number' ? clip.startTime : parseFloat(clip.startTime);
        const end = (isNaN(start) ? 0 : start) + (isNaN(dur) ? 0 : dur);
        if (end > visualMax) visualMax = end;
      });
    }
  });

  if (visualMax > 0) {
    // If audio tracks end within a slight margin (<= 1.5s ring-out), include it.
    // Otherwise anchor to visualMax to prevent a long background song from inflating video duration.
    let audioMax = 0;
    if (Array.isArray(tracks.audio)) {
      tracks.audio.forEach((clip: any) => {
        const dur = typeof clip.duration === 'number' ? clip.duration : parseFloat(clip.duration);
        const start = typeof clip.startTime === 'number' ? clip.startTime : parseFloat(clip.startTime);
        const end = (isNaN(start) ? 0 : start) + (isNaN(dur) ? 0 : dur);
        if (end > audioMax) audioMax = end;
      });
    }
    if (audioMax > visualMax && audioMax <= visualMax + 1.5) {
      return audioMax;
    }
    return visualMax;
  }

  let maxDur = 0;
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
