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
