import { Ionicons } from "@expo/vector-icons";
import { ExportFormat, ExportResult } from "../../../utils/videoRenderer";

export interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  project: any;
  totalDuration: number;
}

export interface MediaFormatOption {
  id: ExportFormat;
  label: string;
  shortLabel: string;
  ext: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  isRecommended?: boolean;
  desc: string;
}

export interface NoticeDialogState {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  primaryText?: string;
  onPrimary?: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
}

export const MEDIA_FORMATS: MediaFormatOption[] = [
  {
    id: "mp4",
    label: "MP4 Video",
    shortLabel: "MP4",
    ext: ".mp4",
    icon: "videocam",
    badge: "Universal",
    isRecommended: true,
    desc: "Compatible with Instagram, YouTube, TikTok, iOS & Android",
  },
  {
    id: "webm",
    label: "WebM Video",
    shortLabel: "WebM",
    ext: ".webm",
    icon: "globe-outline",
    badge: "Fast",
    isRecommended: false,
    desc: "High-efficiency VP9 video format for web playback",
  },
  {
    id: "gif",
    label: "Animated GIF",
    shortLabel: "GIF",
    ext: ".gif",
    icon: "film-outline",
    badge: "Loop",
    isRecommended: false,
    desc: "Looped animation clip for messaging & stickers",
  },
  {
    id: "png",
    label: "PNG Cover",
    shortLabel: "PNG",
    ext: ".png",
    icon: "image-outline",
    badge: "HD",
    isRecommended: false,
    desc: "Lossless HD snapshot frame for thumbnails",
  },
  {
    id: "wav",
    label: "WAV Audio",
    shortLabel: "WAV",
    ext: ".wav",
    icon: "musical-notes-outline",
    badge: "Audio",
    isRecommended: false,
    desc: "Uncompressed stereo master soundtrack audio",
  },
];

export const RESOLUTIONS = ["720p", "1080p", "2K/4K"];
export const FRAME_RATES = [24, 30, 60];

export const RESOLUTION_DIMENSIONS: Record<string, Record<string, [number, number]>> = {
  "720p": {
    "9:16": [720, 1280],
    "16:9": [1280, 720],
    "1:1": [720, 720],
    "4:5": [720, 900],
    "2.35:1": [1280, 545],
  },
  "1080p": {
    "9:16": [1080, 1920],
    "16:9": [1920, 1080],
    "1:1": [1080, 1080],
    "4:5": [1080, 1350],
    "2.35:1": [1920, 817],
  },
  "2K/4K": {
    "9:16": [2160, 3840],
    "16:9": [3840, 2160],
    "1:1": [2160, 2160],
    "4:5": [2160, 2700],
    "2.35:1": [3840, 1634],
  },
};

export const LOGICAL_BASE_DIMENSIONS: Record<string, [number, number]> = {
  "9:16": [360, 640],
  "16:9": [640, 360],
  "1:1": [480, 480],
  "4:5": [384, 480],
  "2.35:1": [705, 300],
};

export function getExportResolutionDimensions(
  resolution: string = "1080p",
  aspectRatio: string = "9:16"
): [number, number] {
  const resMap = RESOLUTION_DIMENSIONS[resolution] || RESOLUTION_DIMENSIONS["1080p"];
  return resMap[aspectRatio] || [1080, 1920];
}

export function getLogicalBaseDimensions(aspectRatio: string = "9:16"): [number, number] {
  return LOGICAL_BASE_DIMENSIONS[aspectRatio] || [360, 640];
}
