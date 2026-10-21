import { FastArtProject } from "../../types/project";

export const MAX_TRACKS = 10;
export const TRACK_ROW_HEIGHT = 48;
export const MIN_CLIP_DURATION = 0.05; // 50 milliseconds precision

export interface UnifiedClipItem {
  id: string;
  type: "video" | "audio" | "text" | "sticker" | "effects";
  startTime: number;
  duration: number;
  trackIndex?: number;
  effectiveTrackIndex: number;
  title: string;
  subtitle?: string;
  badge?: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  iconName: any;
  rawClip: any;
}

export interface SnapPoint {
  time: number;
  type: "start" | "end" | "playhead" | "keyframe";
  clipId?: string;
}

export interface DragSession {
  clipId: string;
  clipType: "video" | "audio" | "text" | "sticker" | "effects";
  originalStartTime: number;
  duration: number;
  originalTrackIndex: number;
  currentStartTime: number;
  currentTrackIndex: number;
  startClientX: number;
  startClientY: number;
  initialScrollLeft: number;
}

export interface TrimSession {
  clipId: string;
  clipType: "video" | "audio" | "text" | "sticker" | "effects";
  side: "left" | "right";
  originalStartTime: number;
  originalDuration: number;
  originalTrimIn: number;
  originalTrimOut: number;
  trackIndex: number;
  startClientX: number;
  currentStartTime: number;
  currentDuration: number;
  currentTrimIn: number;
  currentTrimOut: number;
}

export interface TimelineProps {
  project: FastArtProject;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  selectedClipId: string | null;
  selectedClipType?: string;
  onSelectClip: (
    id: string,
    type: "video" | "audio" | "text" | "sticker" | "effects",
  ) => void;
  onTrimClip?: (
    clipId: string,
    updates: {
      startTime?: number;
      duration?: number;
      trimIn?: number;
      trimOut?: number;
      trackIndex?: number;
    },
    isFinal?: boolean,
  ) => void;
  onMoveClip?: (
    clipId: string,
    trackType: "video" | "audio" | "text" | "sticker" | "effects",
    newStartTime: number,
    newTrackIndex?: number,
  ) => void;
  onOpenTransitions: (clipId: string) => void;
  onOpenMediaPicker?: () => void;
  onOpenTextModal?: () => void;
  onOpenAudioModal?: () => void;
  onOpenEffectsModal?: () => void;
  onOpenStickersModal?: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onAdjustDuration?: (delta: number) => void;
  onUpdateProject?: (updates: Partial<FastArtProject>) => void;
  onSplitClip?: () => void;
  onDuplicateClip?: () => void;
  onDeleteClip?: () => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  settings?: any;
}
