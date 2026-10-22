import { FastArtProject, CustomCrop } from "../../types/project";

export interface PlayerProps {
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
  totalDuration: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onAddKeyframe: () => void;
  hasKeyframeAtCurrentTime: boolean;
  onOpenKeyframeModal?: () => void;
  onOpenMediaPicker: () => void;
  selectedClipId?: string | null;
  selectedClipType?: string;
  onSelectClip?: (id: string | null, type?: string) => void;
  onUpdateClipTransform?: (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal?: boolean,
  ) => void;
  onOpenEditModal?: (clipId: string, clipType: string) => void;
  onOpenCropModal?: (clipId: string) => void;
  onOpenMaskModal?: (clipId: string) => void;
  onDeleteClip?: (clipId: string, clipType: string) => void;
  onDuplicateClip?: (clipId: string, clipType: string) => void;
  onSplitClip?: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isCroppingPreview?: boolean;
  onToggleCropPreview?: (isCropping: boolean) => void;
  onUpdateClipCrop?: (
    clipId: string,
    crop: CustomCrop,
    isFinal?: boolean,
  ) => void;
  isProcessing?: boolean;
  processingMessage?: string;
}

export interface CropPreset {
  id: string;
  label: string;
  ratio: number;
}

export interface TransientTransformState {
  clipId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface ActiveTransformItem {
  id: string;
  type: "text" | "sticker" | "video" | "caption";
  label?: string;
  pos: { x: number; y: number };
  scale: number;
  rotation: number;
  baseW: number;
  baseH: number;
  width: number;
  height: number;
}

export interface DragState {
  mode: "move" | "scale" | "rotate";
  corner?: "tl" | "tr" | "bl" | "br";
  clipId: string;
  clipType: string;
  startClientX: number;
  startClientY: number;
  startCenterX: number;
  startCenterY: number;
  absCenterX: number;
  absCenterY: number;
  startScale: number;
  startRotation: number;
  startDist: number;
  startAngle: number;
}

export interface CropDragState {
  handle:
    | "move"
    | "tl"
    | "tr"
    | "bl"
    | "br"
    | "edge-top"
    | "edge-bottom"
    | "edge-left"
    | "edge-right";
  startClientX: number;
  startClientY: number;
  startCrop: CustomCrop;
  renderW: number;
  renderH: number;
}

export interface KeyframeToastState {
  text: string;
  isAdd: boolean;
}
