import { FastArtProject } from "../../types/project";

export const MAX_TRACKS = 25;
export const TRACK_ROW_HEIGHT = 48;
export const MIN_CLIP_DURATION = 0.05; // 50 milliseconds precision

export interface UnifiedClipItem {
  id: string;
  type: "video" | "photo" | "audio" | "text" | "caption" | "sticker" | "effects";
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
  clipType: "video" | "photo" | "audio" | "text" | "caption" | "sticker" | "effects";
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
  clipType: "video" | "photo" | "audio" | "text" | "caption" | "sticker" | "effects";
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

export interface TimelineDragState {
  clipId: string;
  currentStart: number;
  targetStart?: number;
  currentTrack: number;
  dragOffsetY: number;
  isInsertingNewTrack?: boolean;
  insertTrackIndex?: number | null;
  hasOverlap?: boolean;
}

export interface TimelineProps {
  project: FastArtProject;
  currentTime: number;
  totalDuration: number;
  isPlaying?: boolean;
  onSeek: (time: number) => void;
  selectedClipId: string | null;
  selectedClipType?: string;
  onSelectClip: (
    id: string,
    type: "video" | "photo" | "audio" | "text" | "caption" | "sticker" | "effects",
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
    trackType: "video" | "photo" | "audio" | "text" | "caption" | "sticker" | "effects",
    newStartTime: number,
    newTrackIndex?: number,
    isInsertNewTrack?: boolean,
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
  onFreezeFrame?: () => void;
  onToggleReverse?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  timelineHeight?: number;
  isResizingHeight?: boolean;
  resizeHandleProps?: any;
  handleResetResizeHeight?: () => void;
  onTimelineHeightChange?: (height: number) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  settings?: any;
  onAddMedia?: (clip: any) => void;
  onAddAudio?: (clip: any) => void;
}
