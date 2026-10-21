import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  useWindowDimensions,
  ScrollView,
  Image,
  PanResponder,
  GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../utils/audioEngine";
import { VideoRenderer } from "../utils/videoRenderer";
import {
  FastArtProject,
  CustomCrop,
  AspectRatio,
  Resolution,
} from "../types/project";
import { getLiveMediaUrl } from "../utils/largeMediaStorage";
import { getPointerCoords } from "./Timeline";
import { setCachedMediaDuration } from "../utils/mediaDuration";
import NativeVideoClipPlayer from "./NativeVideoClipPlayer";

interface PlayerProps {
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
}

const CROP_PRESETS = [
  { id: "free", label: "Free", ratio: 0 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "2.35:1", label: "2.35:1", ratio: 2.35 },
];

function Player({
  project,
  currentTime,
  isPlaying,
  totalDuration,
  onTogglePlay,
  onSeek,
  onAddKeyframe,
  hasKeyframeAtCurrentTime,
  onOpenKeyframeModal,
  onOpenMediaPicker,
  selectedClipId,
  selectedClipType,
  onSelectClip,
  onUpdateClipTransform,
  onOpenEditModal,
  onOpenCropModal,
  onOpenMaskModal,
  onDeleteClip,
  onDuplicateClip,
  onSplitClip,
  fullscreen: fullscreenProp,
  onToggleFullscreen,
  isCroppingPreview: isCroppingPreviewProp,
  onToggleCropPreview,
  onUpdateClipCrop,
}: PlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasBoxRef = useRef<any>(null);
  const rendererRef = useRef<VideoRenderer | null>(null);
  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const fullscreen =
    fullscreenProp !== undefined ? fullscreenProp : internalFullscreen;

  // On-Preview interactive crop state
  const [internalCroppingMode, setInternalCroppingMode] = useState(false);
  const isCroppingMode =
    isCroppingPreviewProp !== undefined
      ? isCroppingPreviewProp
      : internalCroppingMode;
  const [cropBox, setCropBox] = useState<CustomCrop>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [cropPreset, setCropPreset] = useState<string>("free");
  const [cropTargetClipId, setCropTargetClipId] = useState<string | null>(null);
  const [cropDragState, setCropDragState] = useState<{
    handle: "pan" | "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";
    startClientX: number;
    startClientY: number;
    startCrop: CustomCrop;
    mediaDisplayW: number;
    mediaDisplayH: number;
  } | null>(null);

  const toggleFullscreen = () => {
    soundEngine.playSfx("click");
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen((prev) => !prev);
    }
  };

  const [showSafeZone, setShowSafeZone] = useState(false);
  const [dragState, setDragState] = useState<{
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
  } | null>(null);

  const touchGestureRef = useRef<{
    initialDist: number;
    initialAngle: number;
    initialScale: number;
    initialRotation: number;
    initialCenterX: number;
    initialCenterY: number;
  } | null>(null);

  const lastTapRef = useRef<{ time: number; id: string }>({ time: 0, id: "" });
  const [mediaLoadErrors, setMediaLoadErrors] = useState<
    Record<string, boolean>
  >({});

  const { width: winW, height: winH } = useWindowDimensions();
  const isMobile = winW < 640;
  const isSmallScreen = winW < 768 || Platform.OS !== "web";
  const [activeTransient, setActiveTransient] = useState<{
    clipId: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
  } | null>(null);

  // Dynamic viewport measurement of actual remaining space between header and timeline
  const viewportWrapperRef = useRef<any>(null);
  const [viewportDims, setViewportDims] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const handleViewportLayout = useCallback((e: any) => {
    const layout = e.nativeEvent?.layout;
    if (layout && layout.width > 0 && layout.height > 0) {
      setViewportDims((prev) => {
        if (
          prev &&
          Math.abs(prev.width - layout.width) < 2 &&
          Math.abs(prev.height - layout.height) < 2
        ) {
          return prev;
        }
        return {
          width: Math.round(layout.width),
          height: Math.round(layout.height),
        };
      });
    }
  }, []);

  // Web ResizeObserver for instant continuous updates while dragging timeline height
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const el = viewportWrapperRef.current as unknown as HTMLElement;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setViewportDims((prev) => {
            if (
              prev &&
              Math.abs(prev.width - width) < 2 &&
              Math.abs(prev.height - height) < 2
            ) {
              return prev;
            }
            return {
              width: Math.round(width),
              height: Math.round(height),
            };
          });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Responsive canvas dimensions — dynamically fitted to remaining space without clipping or hiding
  const getAspectRatioDimensions = () => {
    const ratioMap: Record<string, number> = {
      "9:16": 9 / 16,
      "16:9": 16 / 9,
      "1:1": 1 / 1,
      "4:5": 4 / 5,
      "2.35:1": 235 / 100,
    };
    const targetRatio = ratioMap[project.aspectRatio] || 9 / 16;

    if (fullscreen) {
      // Fullscreen Cinema mode: maximize canvas space within window
      const maxFsH = Math.max(120, winH - 64);
      const maxFsW = Math.max(120, winW - 20);
      let w = maxFsH * targetRatio;
      let h = maxFsH;
      if (w > maxFsW) {
        w = maxFsW;
        h = w / targetRatio;
      }
      return { width: Math.round(w), height: Math.round(h) };
    }

    // Normal mode: dynamically scale canvas to fit strictly inside the measured remaining space of viewportWrapper
    const availW = viewportDims
      ? Math.max(60, viewportDims.width - (isMobile ? 12 : 24))
      : Math.max(60, winW - (isMobile ? 24 : 50));

    const availH = viewportDims
      ? Math.max(60, viewportDims.height - 10)
      : Math.max(60, winH - (isMobile ? 240 : 280));

    let w = availH * targetRatio;
    let h = availH;

    if (w > availW) {
      w = availW;
      h = w / targetRatio;
    }

    if (h > availH) {
      h = availH;
      w = h * targetRatio;
    }

    return {
      width: Math.round(Math.max(40, w)),
      height: Math.round(Math.max(40, h)),
    };
  };

  const { width: canvasWidth, height: canvasHeight } =
    getAspectRatioDimensions();
  const hasAnyTrackContent = Boolean(
    (project.tracks.video && project.tracks.video.length > 0) ||
    (project.tracks.text && project.tracks.text.length > 0) ||
    (project.tracks.stickers && project.tracks.stickers.length > 0) ||
    (project.tracks.effects && project.tracks.effects.length > 0) ||
    (project.tracks.audio && project.tracks.audio.length > 0),
  );
  const isProjectEmpty = !hasAnyTrackContent;
  const boxWidth = canvasWidth;

  // ESC key listener to exit fullscreen mode
  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    )
      return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (typeof window.removeEventListener === "function") {
        window.removeEventListener("keydown", onKeyDown);
      }
    };
  }, [fullscreen]);

  // Initialize renderer
  useEffect(() => {
    if (Platform.OS === "web" && canvasRef.current) {
      rendererRef.current = new VideoRenderer(canvasRef.current);

      // Re-render frame immediately whenever a media element loads or seeks
      rendererRef.current.onFrameNeeded = () => {
        if (rendererRef.current && canvasRef.current) {
          rendererRef.current.renderFrame(
            project,
            currentTime,
            isPlaying,
            boxWidth,
            canvasHeight,
          );
        }
      };

      const clips = project.tracks.video || [];
      clips.forEach((clip) => {
        rendererRef.current?.preloadClip(clip);
      });
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
      }
    };
  }, [project.aspectRatio]);

  // Prune unused media elements when video track clips change to free mobile GPU memory
  useEffect(() => {
    if (rendererRef.current && project.tracks.video) {
      const activeUrls = new Set(project.tracks.video.map((c) => c.url));
      rendererRef.current.pruneUnusedMedia(activeUrls);
      project.tracks.video.forEach((clip) => {
        rendererRef.current?.preloadClip(clip);
      });
    }
  }, [project.tracks.video]);

  // Rehydrate live media URLs from IndexedDB for clips with expired blob URLs
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const clips = project.tracks.video || [];
      clips.forEach(async (clip) => {
        if (clip.url.startsWith("blob:")) {
          try {
            const freshUrl = await getLiveMediaUrl(clip.id);
            if (freshUrl && freshUrl !== clip.url) {
              clip.url = freshUrl;
              if (rendererRef.current && canvasRef.current) {
                rendererRef.current.preloadClip(clip);
                rendererRef.current.renderFrame(
                  project,
                  currentTime,
                  isPlaying,
                  boxWidth,
                  canvasHeight,
                );
              }
            }
          } catch (e) {}
        }
      });
    }
  }, [project.id]);

  // Render frame on timestamp, project, or playback state change
  useEffect(() => {
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  }, [currentTime, project, isPlaying, boxWidth, canvasHeight]);

  // Multi-Track Audio playback synchronization across all simultaneous audio clips
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const audioClips = project.tracks.audio || [];
    const activeIds = new Set(audioClips.map((a) => a.id));

    // Cleanup and release hardware audio decoders for removed audio tracks
    Object.keys(audioElementsRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        const el = audioElementsRef.current[id];
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch {}
        delete audioElementsRef.current[id];
      }
    });

    audioClips.forEach((clip) => {
      let el = audioElementsRef.current[clip.id];
      if (!el || el.src !== clip.url) {
        if (el) {
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
          } catch {}
        }
        el = new Audio(clip.url);
        el.addEventListener("loadedmetadata", () => {
          if (
            el.duration &&
            !isNaN(el.duration) &&
            isFinite(el.duration) &&
            el.duration > 0
          ) {
            setCachedMediaDuration(clip.url, el.duration);
            if (clip.id) setCachedMediaDuration(clip.id, el.duration);
          }
        });
        audioElementsRef.current[clip.id] = el;
      }

      const clipStart = clip.startTime || 0;
      const clipEnd = clipStart + (clip.duration || 0);
      const isInside = currentTime >= clipStart && currentTime <= clipEnd;

      if (isPlaying && isInside) {
        const audioOffset = currentTime - clipStart + (clip.trimIn || 0);
        if (Math.abs(el.currentTime - audioOffset) > 0.25) {
          el.currentTime = Math.max(0, audioOffset);
        }
        el.volume = Math.max(0, Math.min(1, clip.volume ?? 1.0));
        el.play().catch(() => {});
      } else {
        el.pause();
        if (isInside) {
          const audioOffset = currentTime - clipStart + (clip.trimIn || 0);
          el.currentTime = Math.max(0, audioOffset);
        }
      }
    });

    return () => {
      if (!isPlaying) {
        Object.values(audioElementsRef.current).forEach((el: any) => {
          try {
            el.pause();
          } catch {}
        });
      }
    };
  }, [isPlaying, project.tracks.audio, currentTime]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 30);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const activeTexts = (project.tracks.text || []).filter(
    (t) =>
      currentTime >= t.startTime && currentTime <= t.startTime + t.duration,
  );
  const activeStickers = (project.tracks.stickers || []).filter(
    (s) =>
      currentTime >= s.startTime && currentTime <= s.startTime + s.duration,
  );
  const activeVideos = (project.tracks.video || []).filter(
    (v) =>
      currentTime >= v.startTime && currentTime <= v.startTime + v.duration,
  );
  const activeEffects = (project.tracks.effects || []).filter(
    (e) =>
      currentTime >= e.startTime && currentTime <= e.startTime + e.duration,
  );

  const selectedText = activeTexts.find((t) => t.id === selectedClipId);
  const selectedSticker = activeStickers.find((s) => s.id === selectedClipId);
  const selectedVideo =
    selectedClipType === "video"
      ? activeVideos.find((v) => v.id === selectedClipId) || null
      : null;

  // Resolved video clip for on-preview cropping
  const targetCropClip =
    (project.tracks.video || []).find(
      (v) => v.id === (cropTargetClipId || selectedClipId),
    ) ||
    selectedVideo ||
    activeVideos[0] ||
    (project.tracks.video || [])[0] ||
    null;

  // Natural or project target reference dimensions for accurate resolution display and cropping
  const projectTargetDims = React.useMemo(() => {
    const res = project.resolution || "1080p";
    const aspect = project.aspectRatio || "9:16";
    let baseH = 1080;
    if (res === "720p") baseH = 720;
    else if (res === "2K/4K") baseH = 2160;
    else baseH = 1080;

    switch (aspect) {
      case "9:16":
        return {
          width: baseH === 720 ? 720 : baseH === 2160 ? 2160 : 1080,
          height: baseH === 720 ? 1280 : baseH === 2160 ? 3840 : 1920,
        };
      case "1:1":
        return {
          width: baseH === 720 ? 720 : baseH === 2160 ? 2160 : 1080,
          height: baseH === 720 ? 720 : baseH === 2160 ? 2160 : 1080,
        };
      case "4:5":
        return {
          width: baseH === 720 ? 720 : baseH === 2160 ? 2160 : 1080,
          height: Math.round(baseH * 1.25),
        };
      case "2.35:1":
        return {
          width: Math.round(baseH * 2.35),
          height: baseH,
        };
      case "16:9":
      default:
        return {
          width: baseH === 720 ? 1280 : baseH === 2160 ? 3840 : 1920,
          height: baseH,
        };
    }
  }, [project.resolution, project.aspectRatio]);

  const mediaNaturalDims = targetCropClip
    ? rendererRef.current?.getMediaNaturalDimensions(targetCropClip.url)
    : null;
  const naturalW = mediaNaturalDims?.width || 0;
  const naturalH = mediaNaturalDims?.height || 0;
  // Natural video size or project target resolution, minimum 1080p height so crop can increase above 720 smoothly
  const mw = Math.max(naturalW, projectTargetDims.width, 1080);
  const mh = Math.max(naturalH, projectTargetDims.height, 1080);
  const mediaAspect =
    naturalW > 0 && naturalH > 0
      ? naturalW / naturalH
      : projectTargetDims.width / projectTargetDims.height;

  let mediaDisplayW = boxWidth;
  let mediaDisplayH = boxWidth / mediaAspect;
  if (mediaDisplayH > canvasHeight) {
    mediaDisplayH = canvasHeight;
    mediaDisplayW = canvasHeight * mediaAspect;
  }
  const mediaDisplayLeft = (boxWidth - mediaDisplayW) / 2;
  const mediaDisplayTop = (canvasHeight - mediaDisplayH) / 2;

  // Real pixel coordinates of crop box relative to canvasBox
  const cropPixelX = mediaDisplayLeft + (cropBox.x / 100) * mediaDisplayW;
  const cropPixelY = mediaDisplayTop + (cropBox.y / 100) * mediaDisplayH;
  const cropPixelW = (cropBox.width / 100) * mediaDisplayW;
  const cropPixelH = (cropBox.height / 100) * mediaDisplayH;

  const getItemBaseDimensions = useCallback(
    (type: "text" | "sticker" | "video", clip: any) => {
      if (type === "text") {
        const fontSize = clip.style?.fontSize || 22;
        const str = clip.text || "";
        let textWidth = 0;
        if (Platform.OS === "web" && typeof document !== "undefined") {
          try {
            const font = `${clip.style?.fontWeight || "bold"} ${fontSize}px ${clip.style?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'}`;
            const canvas =
              (document as any)._measureCanvas ||
              ((document as any)._measureCanvas =
                document.createElement("canvas"));
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.font = font;
              textWidth = ctx.measureText(str).width;
            }
          } catch {}
        }
        if (!textWidth) {
          textWidth = Math.round(str.length * (fontSize * 0.58));
        }
        const padX = clip.style?.paddingHorizontal || 14;
        const padY = clip.style?.paddingVertical || 8;
        const baseW = Math.max(
          50,
          Math.min(boxWidth * 0.95, Math.round(textWidth + padX * 2)),
        );
        const baseH = Math.max(30, Math.round(fontSize * 1.25 + padY * 2));
        return { baseW, baseH };
      }
      if (type === "sticker") {
        const isBadge = (clip.char || "").length > 2;
        const baseW = isBadge
          ? Math.max(90, Math.round((clip.char || "").length * 11 + 24))
          : 56;
        const baseH = isBadge ? 36 : 56;
        return { baseW, baseH };
      }
      return { baseW: boxWidth, baseH: canvasHeight };
    },
    [boxWidth, canvasHeight],
  );

  const getInterpolatedTransform = useCallback(
    (clip: any, curTime: number) => {
      const baseT = clip.transform || { x: 0, y: 0, scale: 1, rotation: 0 };
      const baseOp = clip.opacity !== undefined ? clip.opacity : 1.0;
      if (
        !clip.keyframes ||
        !Array.isArray(clip.keyframes) ||
        clip.keyframes.length === 0
      ) {
        return {
          x: baseT.x || 0,
          y: baseT.y || 0,
          scale: baseT.scale ?? 1.0,
          rotation: baseT.rotation ?? 0,
          opacity: baseOp,
        };
      }

      const localTime = Math.max(0, curTime - (clip.startTime || 0));
      const kfs = [...clip.keyframes].sort(
        (a: any, b: any) => a.time - b.time,
      );

      if (localTime <= kfs[0].time) {
        const t0 = kfs[0].transform || {};
        return {
          x: t0.x ?? baseT.x ?? 0,
          y: t0.y ?? baseT.y ?? 0,
          scale: t0.scale ?? baseT.scale ?? 1.0,
          rotation: t0.rotation ?? baseT.rotation ?? 0,
          opacity: kfs[0].opacity !== undefined ? kfs[0].opacity : baseOp,
        };
      }

      if (localTime >= kfs[kfs.length - 1].time) {
        const last = kfs[kfs.length - 1];
        const tLast = last.transform || {};
        return {
          x: tLast.x ?? baseT.x ?? 0,
          y: tLast.y ?? baseT.y ?? 0,
          scale: tLast.scale ?? baseT.scale ?? 1.0,
          rotation: tLast.rotation ?? baseT.rotation ?? 0,
          opacity: last.opacity !== undefined ? last.opacity : baseOp,
        };
      }

      for (let i = 0; i < kfs.length - 1; i++) {
        const k1 = kfs[i];
        const k2 = kfs[i + 1];
        if (localTime >= k1.time && localTime <= k2.time) {
          const span = k2.time - k1.time;
          const progress = span > 0 ? (localTime - k1.time) / span : 0;
          const ease = progress * progress * (3 - 2 * progress);
          const t1 = k1.transform || {};
          const t2 = k2.transform || {};
          const op1 = k1.opacity !== undefined ? k1.opacity : baseOp;
          const op2 = k2.opacity !== undefined ? k2.opacity : baseOp;
          return {
            x:
              (t1.x ?? baseT.x ?? 0) +
              ((t2.x ?? baseT.x ?? 0) - (t1.x ?? baseT.x ?? 0)) * ease,
            y:
              (t1.y ?? baseT.y ?? 0) +
              ((t2.y ?? baseT.y ?? 0) - (t1.y ?? baseT.y ?? 0)) * ease,
            scale:
              (t1.scale ?? baseT.scale ?? 1.0) +
              ((t2.scale ?? baseT.scale ?? 1.0) -
                (t1.scale ?? baseT.scale ?? 1.0)) *
                ease,
            rotation:
              (t1.rotation ?? baseT.rotation ?? 0) +
              ((t2.rotation ?? baseT.rotation ?? 0) -
                (t1.rotation ?? baseT.rotation ?? 0)) *
                ease,
            opacity: op1 + (op2 - op1) * ease,
          };
        }
      }

      return {
        x: baseT.x || 0,
        y: baseT.y || 0,
        scale: baseT.scale ?? 1.0,
        rotation: baseT.rotation ?? 0,
        opacity: baseOp,
      };
    },
    [],
  );

  const [kfToast, setKfToast] = useState<{
    text: string;
    isAdd: boolean;
  } | null>(null);
  const kfToastTimer = useRef<any>(null);

  const handleKeyframePress = useCallback(() => {
    const res = (onAddKeyframe as any)?.();
    if (res && res.action) {
      const timeSec = res.time ?? currentTime;
      const min = Math.floor(timeSec / 60);
      const sec = timeSec % 60;
      const timeStr = `${min < 10 ? "0" : ""}${min}:${sec < 10 ? "0" : ""}${sec.toFixed(1)}`;
      setKfToast({
        text:
          res.action === "added"
            ? `◆ Keyframe Stamped at ${timeStr}`
            : `◇ Keyframe Removed`,
        isAdd: res.action === "added",
      });
      if (kfToastTimer.current) clearTimeout(kfToastTimer.current);
      kfToastTimer.current = setTimeout(() => {
        setKfToast(null);
      }, 1800);
    }
  }, [onAddKeyframe, currentTime]);

  const isTransText =
    activeTransient &&
    selectedText &&
    activeTransient.clipId === selectedText.id;
  const isTransStk =
    activeTransient &&
    selectedSticker &&
    activeTransient.clipId === selectedSticker.id;
  const isTransVid =
    activeTransient &&
    selectedVideo &&
    activeTransient.clipId === selectedVideo.id;

  const activeTransformItem = isCroppingMode
    ? null
    : selectedText
      ? (() => {
          const { baseW, baseH } = getItemBaseDimensions("text", selectedText);
          const s = isTransText
            ? activeTransient!.scale
            : (selectedText.scale ?? 1.0);
          const rot = isTransText
            ? activeTransient!.rotation
            : (selectedText.rotation ?? 0);
          const pos = isTransText
            ? { x: activeTransient!.x, y: activeTransient!.y }
            : selectedText.position || { x: 50, y: 35 };
          return {
            id: selectedText.id,
            type: "text" as const,
            label: selectedText.text,
            pos,
            scale: s,
            rotation: rot,
            baseW,
            baseH,
            width: Math.round(baseW * s),
            height: Math.round(baseH * s),
          };
        })()
      : selectedSticker
        ? (() => {
            const { baseW, baseH } = getItemBaseDimensions(
              "sticker",
              selectedSticker,
            );
            const s = isTransStk
              ? activeTransient!.scale
              : (selectedSticker.scale ?? 1.2);
            const rot = isTransStk
              ? activeTransient!.rotation
              : (selectedSticker.rotation ?? 0);
            const pos = isTransStk
              ? { x: activeTransient!.x, y: activeTransient!.y }
              : selectedSticker.position || { x: 50, y: 50 };
            return {
              id: selectedSticker.id,
              type: "sticker" as const,
              label: selectedSticker.char,
              pos,
              scale: s,
              rotation: rot,
              baseW,
              baseH,
              width: Math.round(baseW * s),
              height: Math.round(baseH * s),
            };
          })()
        : selectedVideo
          ? (() => {
              const { baseW, baseH } = getItemBaseDimensions(
                "video",
                selectedVideo,
              );
              const s = isTransVid
                ? activeTransient!.scale
                : (selectedVideo.transform?.scale ?? 1.0);
              const rot = isTransVid
                ? activeTransient!.rotation
                : (selectedVideo.transform?.rotation ?? 0);
              const pos = isTransVid
                ? {
                    x: 50 + (activeTransient!.x / boxWidth) * 100,
                    y: 50 + (activeTransient!.y / canvasHeight) * 100,
                  }
                : {
                    x:
                      50 + ((selectedVideo.transform?.x || 0) / boxWidth) * 100,
                    y:
                      50 +
                      ((selectedVideo.transform?.y || 0) / canvasHeight) * 100,
                  };
              return {
                id: selectedVideo.id,
                type: "video" as const,
                label: selectedVideo.title,
                pos,
                scale: s,
                rotation: rot,
                baseW,
                baseH,
                width: Math.round(baseW * s),
                height: Math.round(baseH * s),
              };
            })()
          : null;

  const latestTransformRef = useRef<{
    clipId: string;
    clipType: string;
    transform: { x: number; y: number; scale: number; rotation: number };
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const activeTransformItemRef = useRef(activeTransformItem);
  activeTransformItemRef.current = activeTransformItem;

  const boxWidthRef = useRef(boxWidth);
  boxWidthRef.current = boxWidth;

  const canvasHeightRef = useRef(canvasHeight);
  canvasHeightRef.current = canvasHeight;

  const onUpdateClipTransformRef = useRef(onUpdateClipTransform);
  onUpdateClipTransformRef.current = onUpdateClipTransform;

  const onUpdateClipCropRef = useRef(onUpdateClipCrop);
  onUpdateClipCropRef.current = onUpdateClipCrop;

  const scheduleTransformUpdateRef = useRef<
    (
      clipId: string,
      clipType: string,
      transform: { x: number; y: number; scale: number; rotation: number },
      isFinal?: boolean,
    ) => void
  >(() => {});

  // 1. Native Box PanResponder (Move + 2-Finger Pinch/Twist on selected item)
  const nativeBoxStartRef = useRef<{
    clipId: string;
    clipType: string;
    startCenterX: number;
    startCenterY: number;
    startScale: number;
    startRotation: number;
    initialDist?: number;
    initialAngle?: number;
    touch2StartX?: number;
    touch2StartY?: number;
  } | null>(null);

  const nativeBoxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 1 || Math.abs(gs.dy) > 1,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (evt) => {
        const item = activeTransformItemRef.current;
        if (!item) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const startCenterX = (item.pos.x / 100) * bw;
        const startCenterY = (item.pos.y / 100) * ch;
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          const t1 = touches[0];
          const t2 = touches[1];
          const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
          const angle = Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX);
          const midX = (t1.pageX + t2.pageX) / 2;
          const midY = (t1.pageY + t2.pageY) / 2;
          nativeBoxStartRef.current = {
            clipId: item.id,
            clipType: item.type,
            startCenterX,
            startCenterY,
            startScale: item.scale,
            startRotation: item.rotation,
            initialDist: Math.max(10, dist),
            initialAngle: angle,
            touch2StartX: midX,
            touch2StartY: midY,
          };
        } else {
          nativeBoxStartRef.current = {
            clipId: item.id,
            clipType: item.type,
            startCenterX,
            startCenterY,
            startScale: item.scale,
            startRotation: item.rotation,
          };
        }
      },
      onPanResponderMove: (evt, gs) => {
        const s = nativeBoxStartRef.current;
        if (!s) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          const t1 = touches[0];
          const t2 = touches[1];
          const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
          const angle = Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX);
          const midX = (t1.pageX + t2.pageX) / 2;
          const midY = (t1.pageY + t2.pageY) / 2;

          if (!s.initialDist) {
            s.initialDist = Math.max(10, dist);
            s.initialAngle = angle;
            s.touch2StartX = midX;
            s.touch2StartY = midY;
            const currentItem = activeTransformItemRef.current;
            if (currentItem) {
              s.startScale = currentItem.scale;
              s.startRotation = currentItem.rotation;
              s.startCenterX = (currentItem.pos.x / 100) * bw;
              s.startCenterY = (currentItem.pos.y / 100) * ch;
            }
            return;
          }

          // Two-finger scale
          const scaleRatio = dist / s.initialDist;
          const newScale = Math.max(
            0.15,
            Math.min(5.0, Number((s.startScale * scaleRatio).toFixed(2))),
          );

          // Two-finger rotation (natural twist)
          const angleDiffDeg =
            ((angle - (s.initialAngle || 0)) * 180) / Math.PI;
          const rawDeg = (s.startRotation + angleDiffDeg) % 360;
          let newRotation = Math.round(((rawDeg % 360) + 360) % 360);
          [0, 90, 180, 270, 360].forEach((deg) => {
            if (Math.abs(newRotation - deg) < 4) newRotation = deg % 360;
          });

          // Two-finger translate
          const dx = midX - (s.touch2StartX || midX);
          const dy = midY - (s.touch2StartY || midY);

          if (s.clipType === "video") {
            scheduleTransformUpdateRef.current(
              s.clipId,
              "video",
              {
                x: Math.round(s.startCenterX - bw / 2 + dx),
                y: Math.round(s.startCenterY - ch / 2 + dy),
                scale: newScale,
                rotation: newRotation,
              },
              false,
            );
          } else {
            const newPctX = Math.max(
              0,
              Math.min(100, ((s.startCenterX + dx) / bw) * 100),
            );
            const newPctY = Math.max(
              0,
              Math.min(100, ((s.startCenterY + dy) / ch) * 100),
            );
            scheduleTransformUpdateRef.current(
              s.clipId,
              s.clipType,
              {
                x: Number(newPctX.toFixed(1)),
                y: Number(newPctY.toFixed(1)),
                scale: newScale,
                rotation: newRotation,
              },
              false,
            );
          }
        } else {
          // If was two fingers and now single finger, reset baseline seamlessly to prevent jump
          if (s.initialDist) {
            s.initialDist = undefined;
            s.initialAngle = undefined;
            s.touch2StartX = undefined;
            s.touch2StartY = undefined;
            const currentItem = activeTransformItemRef.current;
            if (currentItem) {
              s.startScale = currentItem.scale;
              s.startRotation = currentItem.rotation;
              s.startCenterX = (currentItem.pos.x / 100) * bw - gs.dx;
              s.startCenterY = (currentItem.pos.y / 100) * ch - gs.dy;
            }
          }

          // Single-finger drag: move
          const dx = gs.dx;
          const dy = gs.dy;
          if (s.clipType === "video") {
            scheduleTransformUpdateRef.current(
              s.clipId,
              "video",
              {
                x: Math.round(s.startCenterX - bw / 2 + dx),
                y: Math.round(s.startCenterY - ch / 2 + dy),
                scale: s.startScale,
                rotation: s.startRotation,
              },
              false,
            );
          } else {
            const newPctX = Math.max(
              0,
              Math.min(100, ((s.startCenterX + dx) / bw) * 100),
            );
            const newPctY = Math.max(
              0,
              Math.min(100, ((s.startCenterY + dy) / ch) * 100),
            );
            scheduleTransformUpdateRef.current(
              s.clipId,
              s.clipType,
              {
                x: Number(newPctX.toFixed(1)),
                y: Number(newPctY.toFixed(1)),
                scale: s.startScale,
                rotation: s.startRotation,
              },
              false,
            );
          }
        }
      },
      onPanResponderRelease: () => {
        if (latestTransformRef.current) {
          scheduleTransformUpdateRef.current(
            latestTransformRef.current.clipId,
            latestTransformRef.current.clipType,
            latestTransformRef.current.transform,
            true,
          );
        }
        nativeBoxStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        nativeBoxStartRef.current = null;
      },
    }),
  ).current;

  // 2. Native Rotation Handle PanResponder (Captures touches, non-terminatable by parent)
  const nativeRotStartRef = useRef<{
    clipId: string;
    clipType: string;
    startRotation: number;
    startScale: number;
    startCenterX: number;
    startCenterY: number;
    itemCenterPageX: number;
    itemCenterPageY: number;
    startAngle: number;
  } | null>(null);

  const nativeRotPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const item = activeTransformItemRef.current;
        if (!item) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const itemCenterX = (item.pos.x / 100) * bw;
        const itemCenterY = (item.pos.y / 100) * ch;

        const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
        const knobPageX = pageX - (locationX ?? 16) + 16;
        const knobPageY = pageY - (locationY ?? 16) + 16;
        const itemCenterPageX = knobPageX;
        const itemCenterPageY = knobPageY + 30 + item.height / 2;

        const startAngle = Math.atan2(
          pageY - itemCenterPageY,
          pageX - itemCenterPageX,
        );

        nativeRotStartRef.current = {
          clipId: item.id,
          clipType: item.type,
          startRotation: item.rotation || 0,
          startScale: item.scale || 1,
          startCenterX: itemCenterX,
          startCenterY: itemCenterY,
          itemCenterPageX,
          itemCenterPageY,
          startAngle,
        };
      },
      onPanResponderMove: (evt, gs) => {
        const s = nativeRotStartRef.current;
        if (!s) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;

        const curAngle = Math.atan2(
          evt.nativeEvent.pageY - s.itemCenterPageY,
          evt.nativeEvent.pageX - s.itemCenterPageX,
        );
        const angleDiffDeg = ((curAngle - s.startAngle) * 180) / Math.PI;
        const rotDelta =
          Math.abs(angleDiffDeg) > 0.5 ? angleDiffDeg : gs.dx * 0.9;
        const rawDeg = (s.startRotation + rotDelta) % 360;
        const newRot = Math.round(((rawDeg % 360) + 360) % 360);
        let snappedRot = newRot;
        [0, 90, 180, 270, 360].forEach((deg) => {
          if (Math.abs(newRot - deg) < 5) snappedRot = deg % 360;
        });

        if (s.clipType === "video") {
          scheduleTransformUpdateRef.current(
            s.clipId,
            "video",
            {
              x: Math.round(s.startCenterX - bw / 2),
              y: Math.round(s.startCenterY - ch / 2),
              scale: s.startScale,
              rotation: snappedRot,
            },
            false,
          );
        } else {
          const newPctX = (s.startCenterX / bw) * 100;
          const newPctY = (s.startCenterY / ch) * 100;
          scheduleTransformUpdateRef.current(
            s.clipId,
            s.clipType,
            {
              x: Number(newPctX.toFixed(1)),
              y: Number(newPctY.toFixed(1)),
              scale: s.startScale,
              rotation: snappedRot,
            },
            false,
          );
        }
      },
      onPanResponderRelease: () => {
        if (latestTransformRef.current) {
          scheduleTransformUpdateRef.current(
            latestTransformRef.current.clipId,
            latestTransformRef.current.clipType,
            latestTransformRef.current.transform,
            true,
          );
        }
        nativeRotStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        nativeRotStartRef.current = null;
      },
    }),
  ).current;

  // 3. Directional Corner Scale Responders (Omni-directional scaling from item center)
  const createCornerScaleResponder = (corner: "tl" | "tr" | "bl" | "br") => {
    const startRef = {
      clipId: "",
      clipType: "",
      startRotation: 0,
      startScale: 1,
      startCenterX: 0,
      startCenterY: 0,
    };
    const signX = corner === "tl" || corner === "bl" ? -1 : 1;
    const signY = corner === "tl" || corner === "tr" ? -1 : 1;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const item = activeTransformItemRef.current;
        if (!item) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        startRef.clipId = item.id;
        startRef.clipType = item.type;
        startRef.startRotation = item.rotation || 0;
        startRef.startScale = item.scale || 1;
        startRef.startCenterX = (item.pos.x / 100) * bw;
        startRef.startCenterY = (item.pos.y / 100) * ch;
      },
      onPanResponderMove: (_, gs) => {
        if (!startRef.clipId) return;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        // Natural projection along corner diagonal: pulling outward increases scale, pushing inward decreases scale
        const projectedDelta = (gs.dx * signX + gs.dy * signY) / 2;
        const scaleDelta = projectedDelta / 75;
        const newScale = Math.max(
          0.15,
          Math.min(
            5.0,
            Number((startRef.startScale * (1 + scaleDelta)).toFixed(2)),
          ),
        );

        if (startRef.clipType === "video") {
          scheduleTransformUpdateRef.current(
            startRef.clipId,
            "video",
            {
              x: Math.round(startRef.startCenterX - bw / 2),
              y: Math.round(startRef.startCenterY - ch / 2),
              scale: newScale,
              rotation: startRef.startRotation,
            },
            false,
          );
        } else {
          const newPctX = (startRef.startCenterX / bw) * 100;
          const newPctY = (startRef.startCenterY / ch) * 100;
          scheduleTransformUpdateRef.current(
            startRef.clipId,
            startRef.clipType,
            {
              x: Number(newPctX.toFixed(1)),
              y: Number(newPctY.toFixed(1)),
              scale: newScale,
              rotation: startRef.startRotation,
            },
            false,
          );
        }
      },
      onPanResponderRelease: () => {
        if (latestTransformRef.current) {
          scheduleTransformUpdateRef.current(
            latestTransformRef.current.clipId,
            latestTransformRef.current.clipType,
            latestTransformRef.current.transform,
            true,
          );
        }
        startRef.clipId = "";
      },
      onPanResponderTerminate: () => {
        startRef.clipId = "";
      },
    });
  };

  const scaleTLResponder = useRef(createCornerScaleResponder("tl")).current;
  const scaleTRResponder = useRef(createCornerScaleResponder("tr")).current;
  const scaleBLResponder = useRef(createCornerScaleResponder("bl")).current;
  const scaleBRResponder = useRef(createCornerScaleResponder("br")).current;

  // 4. Unified Canvas Multi-Touch Responder: Catches 2-finger touches ANYWHERE across preview for intuitive twist & pinch
  const canvasMultiTouchStartRef = useRef<{
    clipId: string;
    clipType: string;
    startScale: number;
    startRotation: number;
    startCenterX: number;
    startCenterY: number;
    initialDist: number;
    initialAngle: number;
    initialMidX: number;
    initialMidY: number;
  } | null>(null);

  const canvasMultiTouchPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) =>
        !!activeTransformItemRef.current &&
        (evt.nativeEvent.touches?.length || 0) >= 2,
      onMoveShouldSetPanResponderCapture: (evt) =>
        !!activeTransformItemRef.current &&
        (evt.nativeEvent.touches?.length || 0) >= 2,
      onStartShouldSetPanResponder: (evt) =>
        !!activeTransformItemRef.current &&
        (evt.nativeEvent.touches?.length || 0) >= 2,
      onMoveShouldSetPanResponder: (evt) =>
        !!activeTransformItemRef.current &&
        (evt.nativeEvent.touches?.length || 0) >= 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const item = activeTransformItemRef.current;
        if (!item) return;
        const touches = evt.nativeEvent.touches;
        if (!touches || touches.length < 2) return;

        const t1 = touches[0];
        const t2 = touches[1];
        const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
        const angle = Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX);
        const midX = (t1.pageX + t2.pageX) / 2;
        const midY = (t1.pageY + t2.pageY) / 2;

        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;
        const startCenterX = (item.pos.x / 100) * bw;
        const startCenterY = (item.pos.y / 100) * ch;

        canvasMultiTouchStartRef.current = {
          clipId: item.id,
          clipType: item.type,
          startScale: item.scale,
          startRotation: item.rotation,
          startCenterX,
          startCenterY,
          initialDist: Math.max(10, dist),
          initialAngle: angle,
          initialMidX: midX,
          initialMidY: midY,
        };
      },
      onPanResponderMove: (evt) => {
        const s = canvasMultiTouchStartRef.current;
        if (!s) return;
        const touches = evt.nativeEvent.touches;
        if (!touches || touches.length < 2) return;

        const t1 = touches[0];
        const t2 = touches[1];
        const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
        const angle = Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX);
        const midX = (t1.pageX + t2.pageX) / 2;
        const midY = (t1.pageY + t2.pageY) / 2;

        // 1. Two-finger Scale (pinch)
        const scaleRatio = dist / s.initialDist;
        const newScale = Math.max(
          0.15,
          Math.min(5.0, Number((s.startScale * scaleRatio).toFixed(2))),
        );

        // 2. Two-finger Rotation (natural twist)
        const angleDiffDeg = ((angle - s.initialAngle) * 180) / Math.PI;
        const rawDeg = (s.startRotation + angleDiffDeg) % 360;
        let newRotation = Math.round(((rawDeg % 360) + 360) % 360);
        [0, 90, 180, 270, 360].forEach((deg) => {
          if (Math.abs(newRotation - deg) < 4) newRotation = deg % 360;
        });

        // 3. Two-finger Translate (pan)
        const dx = midX - s.initialMidX;
        const dy = midY - s.initialMidY;
        const bw = boxWidthRef.current;
        const ch = canvasHeightRef.current;

        if (s.clipType === "video") {
          scheduleTransformUpdateRef.current(
            s.clipId,
            "video",
            {
              x: Math.round(s.startCenterX - bw / 2 + dx),
              y: Math.round(s.startCenterY - ch / 2 + dy),
              scale: newScale,
              rotation: newRotation,
            },
            false,
          );
        } else {
          const newPctX = Math.max(
            0,
            Math.min(100, ((s.startCenterX + dx) / bw) * 100),
          );
          const newPctY = Math.max(
            0,
            Math.min(100, ((s.startCenterY + dy) / ch) * 100),
          );
          scheduleTransformUpdateRef.current(
            s.clipId,
            s.clipType,
            {
              x: Number(newPctX.toFixed(1)),
              y: Number(newPctY.toFixed(1)),
              scale: newScale,
              rotation: newRotation,
            },
            false,
          );
        }
      },
      onPanResponderRelease: () => {
        if (latestTransformRef.current) {
          scheduleTransformUpdateRef.current(
            latestTransformRef.current.clipId,
            latestTransformRef.current.clipType,
            latestTransformRef.current.transform,
            true,
          );
        }
        canvasMultiTouchStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        canvasMultiTouchStartRef.current = null;
      },
    }),
  ).current;

  const scheduleTransformUpdate = (
    clipId: string,
    clipType: string,
    transform: { x: number; y: number; scale: number; rotation: number },
    isFinal = false,
  ) => {
    latestTransformRef.current = { clipId, clipType, transform };
    if (isFinal) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setActiveTransient(null);
      onUpdateClipTransformRef.current?.(clipId, clipType, transform, true);
      latestTransformRef.current = null;
      return;
    }

    // Instant local micro-update at 60fps/120fps with zero lag
    const transient = {
      clipId,
      x: transform.x,
      y: transform.y,
      scale: transform.scale,
      rotation: transform.rotation,
    };
    setActiveTransient(transient);

    // Instant continuous 60fps/120fps canvas update on web without full App re-rendering
    if (Platform.OS === "web" && rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
        transient,
      );
    }
  };
  scheduleTransformUpdateRef.current = scheduleTransformUpdate;

  const handleQuickRotate = (item: any) => {
    const nextRot = (Math.round(item.rotation || 0) + 90) % 360;
    if (item.type === "video") {
      const curX = item.pos ? (item.pos.x / 100) * boxWidth - boxWidth / 2 : 0;
      const curY = item.pos
        ? (item.pos.y / 100) * canvasHeight - canvasHeight / 2
        : 0;
      onUpdateClipTransformRef.current?.(
        item.id,
        "video",
        {
          x: Math.round(curX),
          y: Math.round(curY),
          scale: item.scale,
          rotation: nextRot,
        },
        true,
      );
    } else {
      onUpdateClipTransformRef.current?.(
        item.id,
        item.type,
        {
          x: item.pos.x,
          y: item.pos.y,
          scale: item.scale,
          rotation: nextRot,
        },
        true,
      );
    }
  };

  const handleQuickReset = (item: any) => {
    if (item.type === "video") {
      onUpdateClipTransformRef.current?.(
        item.id,
        "video",
        {
          x: 0,
          y: 0,
          scale: 1.0,
          rotation: 0,
        },
        true,
      );
    } else {
      onUpdateClipTransformRef.current?.(
        item.id,
        item.type,
        {
          x: 50,
          y: item.type === "text" ? 35 : 50,
          scale: item.type === "sticker" ? 1.2 : 1.0,
          rotation: 0,
        },
        true,
      );
    }
  };

  const handleQuickScale = (item: any, delta: number) => {
    soundEngine.playSfx("click");
    const newScale = Math.max(
      0.2,
      Math.min(4.0, Number(((item.scale || 1.0) + delta).toFixed(2))),
    );
    if (item.type === "video") {
      const curX = item.pos ? (item.pos.x / 100) * boxWidth - boxWidth / 2 : 0;
      const curY = item.pos
        ? (item.pos.y / 100) * canvasHeight - canvasHeight / 2
        : 0;
      onUpdateClipTransformRef.current?.(
        item.id,
        "video",
        {
          x: Math.round(curX),
          y: Math.round(curY),
          scale: newScale,
          rotation: item.rotation || 0,
        },
        true,
      );
    } else {
      onUpdateClipTransformRef.current?.(
        item.id,
        item.type,
        {
          x: item.pos.x,
          y: item.pos.y,
          scale: newScale,
          rotation: item.rotation || 0,
        },
        true,
      );
    }
  };

  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const handleStartDrag = (
    e: any,
    mode: "move" | "scale" | "rotate",
    corner?: "tl" | "tr" | "bl" | "br",
    overrideItem?: any,
  ) => {
    if (e.stopPropagation) e.stopPropagation();
    if (e.nativeEvent && e.nativeEvent.stopPropagation)
      e.nativeEvent.stopPropagation();
    if (e.cancelable && e.preventDefault) e.preventDefault();

    const targetItem = overrideItem || activeTransformItem;
    if (!targetItem) return;

    soundEngine.playSfx("click");

    // Fast 1-click editing: Double-tap text or sticker opens edit modal
    const now = Date.now();
    if (
      mode === "move" &&
      lastTapRef.current &&
      lastTapRef.current.id === targetItem.id &&
      now - lastTapRef.current.time < 320
    ) {
      lastTapRef.current = { time: 0, id: "" };
      soundEngine.playSfx("click");
      if (targetItem.type === "text" || targetItem.type === "sticker") {
        onOpenEditModal?.(targetItem.id, targetItem.type);
      }
      return;
    }
    lastTapRef.current = { time: now, id: targetItem.id };

    const coords = getPointerCoords(e);
    const clientX = coords.clientX;
    const clientY = coords.clientY;

    const itemCenterX = (targetItem.pos.x / 100) * boxWidth;
    const itemCenterY = (targetItem.pos.y / 100) * canvasHeight;

    let rectLeft = 0;
    let rectTop = 0;
    if (typeof window !== "undefined") {
      const el = canvasRef.current || (canvasBoxRef.current as any);
      if (el && typeof el.getBoundingClientRect === "function") {
        const r = el.getBoundingClientRect();
        rectLeft = r.left;
        rectTop = r.top;
      }
    }
    const absCenterX = rectLeft + itemCenterX;
    const absCenterY = rectTop + itemCenterY;

    const startDist = Math.hypot(clientX - absCenterX, clientY - absCenterY);
    const startAngle = Math.atan2(clientY - absCenterY, clientX - absCenterX);

    const dragSession = {
      mode,
      corner,
      clipId: targetItem.id,
      clipType: targetItem.type,
      startClientX: clientX,
      startClientY: clientY,
      startCenterX: itemCenterX,
      startCenterY: itemCenterY,
      absCenterX,
      absCenterY,
      startScale: targetItem.scale ?? 1.0,
      startRotation: targetItem.rotation ?? 0,
      startDist: Math.max(10, startDist),
      startAngle,
    };

    setDragState(dragSession);

    if (Platform.OS !== "web" || typeof window === "undefined") return;

    // Clean up any existing listeners before attaching new ones
    dragCleanupRef.current?.();

    const handlePointerMove = (moveEvt: any) => {
      if (moveEvt.cancelable && moveEvt.preventDefault) {
        moveEvt.preventDefault();
      }
      const mCoords = getPointerCoords(moveEvt);
      const curX = mCoords.clientX;
      const curY = mCoords.clientY;

      if (dragSession.mode === "move") {
        const dx = curX - dragSession.startClientX;
        const dy = curY - dragSession.startClientY;
        const newCenterX = dragSession.startCenterX + dx;
        const newCenterY = dragSession.startCenterY + dy;

        if (dragSession.clipType === "video") {
          const transformX = newCenterX - boxWidth / 2;
          const transformY = newCenterY - canvasHeight / 2;
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            "video",
            {
              x: Math.round(transformX),
              y: Math.round(transformY),
              scale: dragSession.startScale,
              rotation: dragSession.startRotation,
            },
            false,
          );
        } else {
          const newPctX = Math.max(
            0,
            Math.min(100, Number(((newCenterX / boxWidth) * 100).toFixed(1))),
          );
          const newPctY = Math.max(
            0,
            Math.min(
              100,
              Number(((newCenterY / canvasHeight) * 100).toFixed(1)),
            ),
          );
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            dragSession.clipType,
            {
              x: newPctX,
              y: newPctY,
              scale: dragSession.startScale,
              rotation: dragSession.startRotation,
            },
            false,
          );
        }
      } else if (dragSession.mode === "scale") {
        const currentDist = Math.hypot(
          curX - dragSession.absCenterX,
          curY - dragSession.absCenterY,
        );
        const scaleRatio = currentDist / Math.max(10, dragSession.startDist);
        const newScale = Math.max(
          0.15,
          Math.min(
            5.0,
            Number((dragSession.startScale * scaleRatio).toFixed(2)),
          ),
        );

        if (dragSession.clipType === "video") {
          const transformX = dragSession.startCenterX - boxWidth / 2;
          const transformY = dragSession.startCenterY - canvasHeight / 2;
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            "video",
            {
              x: Math.round(transformX),
              y: Math.round(transformY),
              scale: newScale,
              rotation: dragSession.startRotation,
            },
            false,
          );
        } else {
          const posX = (dragSession.startCenterX / boxWidth) * 100;
          const posY = (dragSession.startCenterY / canvasHeight) * 100;
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            dragSession.clipType,
            {
              x: Number(posX.toFixed(1)),
              y: Number(posY.toFixed(1)),
              scale: newScale,
              rotation: dragSession.startRotation,
            },
            false,
          );
        }
      } else if (dragSession.mode === "rotate") {
        const currentAngle = Math.atan2(
          curY - dragSession.absCenterY,
          curX - dragSession.absCenterX,
        );
        const angleDiffDeg =
          ((currentAngle - dragSession.startAngle) * 180) / Math.PI;
        const rawRotation = (dragSession.startRotation + angleDiffDeg) % 360;
        const normalized = Math.round(((rawRotation % 360) + 360) % 360);
        let snapped = normalized;
        [0, 90, 180, 270, 360].forEach((snapAngle) => {
          if (Math.abs(normalized - snapAngle) < 6) {
            snapped = snapAngle % 360;
          }
        });

        if (dragSession.clipType === "video") {
          const transformX = dragSession.startCenterX - boxWidth / 2;
          const transformY = dragSession.startCenterY - canvasHeight / 2;
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            "video",
            {
              x: Math.round(transformX),
              y: Math.round(transformY),
              scale: dragSession.startScale,
              rotation: snapped,
            },
            false,
          );
        } else {
          const posX = (dragSession.startCenterX / boxWidth) * 100;
          const posY = (dragSession.startCenterY / canvasHeight) * 100;
          scheduleTransformUpdateRef.current(
            dragSession.clipId,
            dragSession.clipType,
            {
              x: Number(posX.toFixed(1)),
              y: Number(posY.toFixed(1)),
              scale: dragSession.startScale,
              rotation: snapped,
            },
            false,
          );
        }
      }
    };

    const handlePointerUp = () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      if (latestTransformRef.current) {
        scheduleTransformUpdateRef.current(
          latestTransformRef.current.clipId,
          latestTransformRef.current.clipType,
          latestTransformRef.current.transform,
          true,
        );
      }
      setDragState(null);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);
    window.addEventListener("touchcancel", handlePointerUp);

    dragCleanupRef.current = () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
      window.removeEventListener("touchcancel", handlePointerUp);
    };
  };

  // Two-Finger Gesture Support for Mobile touchscreens (Pinch-to-scale, Twist-to-rotate, Pan-to-move)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleTouchStartMulti = (e: TouchEvent) => {
      if (e.touches.length === 2 && activeTransformItem) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY,
        );
        const angle = Math.atan2(
          t2.clientY - t1.clientY,
          t2.clientX - t1.clientX,
        );
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        touchGestureRef.current = {
          initialDist: Math.max(10, dist),
          initialAngle: angle,
          initialScale: activeTransformItem.scale,
          initialRotation: activeTransformItem.rotation,
          initialCenterX: (activeTransformItem.pos.x / 100) * boxWidth,
          initialCenterY: (activeTransformItem.pos.y / 100) * canvasHeight,
          midClientX: midX,
          midClientY: midY,
          clipId: activeTransformItem.id,
          clipType: activeTransformItem.type,
        } as any;
      }
    };

    const handleTouchMoveMulti = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchGestureRef.current) {
        if (e.preventDefault) e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY,
        );
        const angle = Math.atan2(
          t2.clientY - t1.clientY,
          t2.clientX - t1.clientX,
        );
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        const g: any = touchGestureRef.current;
        const scaleRatio = dist / Math.max(10, g.initialDist);
        const newScale = Math.max(
          0.2,
          Math.min(4.0, Number((g.initialScale * scaleRatio).toFixed(2))),
        );

        const angleDiffDeg = ((angle - g.initialAngle) * 180) / Math.PI;
        const rawDeg = (g.initialRotation + angleDiffDeg) % 360;
        const newRotation = Math.round(((rawDeg % 360) + 360) % 360);

        const dx = midX - g.midClientX;
        const dy = midY - g.midClientY;
        const newCenterX = g.initialCenterX + dx;
        const newCenterY = g.initialCenterY + dy;

        if (g.clipType === "video") {
          const transformX = newCenterX - boxWidth / 2;
          const transformY = newCenterY - canvasHeight / 2;
          scheduleTransformUpdateRef.current(
            g.clipId,
            "video",
            {
              x: Math.round(transformX),
              y: Math.round(transformY),
              scale: newScale,
              rotation: newRotation,
            },
            false,
          );
        } else {
          const newPctX = Math.max(
            5,
            Math.min(95, Number(((newCenterX / boxWidth) * 100).toFixed(1))),
          );
          const newPctY = Math.max(
            5,
            Math.min(
              95,
              Number(((newCenterY / canvasHeight) * 100).toFixed(1)),
            ),
          );
          scheduleTransformUpdateRef.current(
            g.clipId,
            g.clipType,
            {
              x: newPctX,
              y: newPctY,
              scale: newScale,
              rotation: newRotation,
            },
            false,
          );
        }
      }
    };

    const handleTouchEndMulti = (e: TouchEvent) => {
      if (latestTransformRef.current) {
        scheduleTransformUpdateRef.current(
          latestTransformRef.current.clipId,
          latestTransformRef.current.clipType,
          latestTransformRef.current.transform,
          true,
        );
      }
      if (e.touches.length < 2) {
        touchGestureRef.current = null;
      }
    };

    window.addEventListener("touchstart", handleTouchStartMulti);
    window.addEventListener("touchmove", handleTouchMoveMulti, {
      passive: false,
    });
    window.addEventListener("touchend", handleTouchEndMulti);

    return () => {
      window.removeEventListener("touchstart", handleTouchStartMulti);
      window.removeEventListener("touchmove", handleTouchMoveMulti);
      window.removeEventListener("touchend", handleTouchEndMulti);
    };
  }, [activeTransformItem, boxWidth, canvasHeight]);

  // Sync preview crop mode with VideoRenderer
  useEffect(() => {
    if (isCroppingMode) {
      const targetId =
        cropTargetClipId || selectedClipId || activeVideos[0]?.id;
      if (targetId) {
        setCropTargetClipId(targetId);
        rendererRef.current?.setPreviewCropMode(targetId);
        const clip = (project.tracks.video || []).find(
          (c) => c.id === targetId,
        );
        if (clip) {
          const c = clip.crop || clip.transform?.crop;
          if (c && c.width > 0 && c.height > 0) {
            setCropBox({
              x: Math.max(0, Math.min(90, c.x)),
              y: Math.max(0, Math.min(90, c.y)),
              width: Math.max(10, Math.min(100, c.width)),
              height: Math.max(10, Math.min(100, c.height)),
            });
          } else {
            setCropBox({ x: 0, y: 0, width: 100, height: 100 });
          }
          setCropPreset("free");
        }
      }
    } else {
      rendererRef.current?.setPreviewCropMode(null);
      setCropTargetClipId(null);
    }
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  }, [isCroppingMode]);

  const handleEnterCropMode = (clipId?: string) => {
    soundEngine.playSfx("click");
    const targetId = clipId || selectedClipId || activeVideos[0]?.id;
    if (!targetId) return;
    const clip = (project.tracks.video || []).find((c) => c.id === targetId);
    if (!clip) return;

    setCropTargetClipId(targetId);
    if (selectedClipId !== targetId) {
      onSelectClip?.(targetId, "video");
    }
    const c = clip.crop || clip.transform?.crop;
    if (c && c.width > 0 && c.height > 0) {
      setCropBox({
        x: Math.max(0, Math.min(90, c.x)),
        y: Math.max(0, Math.min(90, c.y)),
        width: Math.max(10, Math.min(100, c.width)),
        height: Math.max(10, Math.min(100, c.height)),
      });
    } else {
      setCropBox({ x: 0, y: 0, width: 100, height: 100 });
    }
    setCropPreset("free");
    rendererRef.current?.setPreviewCropMode(targetId);
    if (onToggleCropPreview) {
      onToggleCropPreview(true);
    } else {
      setInternalCroppingMode(true);
    }
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  };

  const handleCropDragStart = (
    e: any,
    handle: "pan" | "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r",
  ) => {
    e.stopPropagation?.();
    e.nativeEvent?.stopPropagation?.();
    if (e.cancelable && e.preventDefault) {
      e.preventDefault();
    }
    const { clientX, clientY } = getPointerCoords(e);

    setCropDragState({
      handle,
      startClientX: clientX,
      startClientY: clientY,
      startCrop: { ...cropBox },
      mediaDisplayW,
      mediaDisplayH,
    });
  };

  const handleApplyPresetCrop = (presetId: string) => {
    soundEngine.playSfx("click");
    setCropPreset(presetId);
    if (presetId === "free") {
      return;
    }
    const preset = CROP_PRESETS.find((p) => p.id === presetId);
    if (!preset || preset.ratio <= 0) return;

    const targetRatio = preset.ratio;
    const ratioFactor = targetRatio / mediaAspect;

    let newW = 100;
    let newH = newW / ratioFactor;
    if (newH > 100) {
      newH = 100;
      newW = newH * ratioFactor;
    }
    newW = Math.max(10, Math.min(100, Number(newW.toFixed(2))));
    newH = Math.max(10, Math.min(100, Number(newH.toFixed(2))));
    const newX = Number(((100 - newW) / 2).toFixed(2));
    const newY = Number(((100 - newH) / 2).toFixed(2));

    setCropBox({
      x: newX,
      y: newY,
      width: newW,
      height: newH,
    });
  };

  const handleResetCrop = () => {
    soundEngine.playSfx("click");
    setCropBox({ x: 0, y: 0, width: 100, height: 100 });
    setCropPreset("free");
  };

  const handleCancelCrop = () => {
    soundEngine.playSfx("click");
    rendererRef.current?.setPreviewCropMode(null);
    if (onToggleCropPreview) {
      onToggleCropPreview(false);
    } else {
      setInternalCroppingMode(false);
    }
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  };

  const handleConfirmCrop = () => {
    soundEngine.playSfx("click");
    const targetId = cropTargetClipId || selectedClipId || activeVideos[0]?.id;
    if (targetId && onUpdateClipCropRef.current) {
      onUpdateClipCropRef.current(
        targetId,
        {
          x: Math.round(cropBox.x),
          y: Math.round(cropBox.y),
          width: Math.round(cropBox.width),
          height: Math.round(cropBox.height),
        },
        true,
      );
    }
    rendererRef.current?.setPreviewCropMode(null);
    if (onToggleCropPreview) {
      onToggleCropPreview(false);
    } else {
      setInternalCroppingMode(false);
    }
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.renderFrame(
        project,
        currentTime,
        isPlaying,
        boxWidth,
        canvasHeight,
      );
    }
  };

  useEffect(() => {
    if (!cropDragState) return;

    let pendingRaf: number | null = null;
    let latestBox = { ...cropBox };

    const handlePointerMove = (e: any) => {
      if (e.cancelable && e.preventDefault) {
        e.preventDefault();
      }
      const { clientX, clientY } = getPointerCoords(e);

      const dxPx = clientX - cropDragState.startClientX;
      const dyPx = clientY - cropDragState.startClientY;
      const dxPct = (dxPx / cropDragState.mediaDisplayW) * 100;
      const dyPct = (dyPx / cropDragState.mediaDisplayH) * 100;

      const { handle, startCrop } = cropDragState;
      let nextX = startCrop.x;
      let nextY = startCrop.y;
      let nextW = startCrop.width;
      let nextH = startCrop.height;

      if (handle === "pan") {
        nextX = Math.max(
          0,
          Math.min(100 - startCrop.width, startCrop.x + dxPct),
        );
        nextY = Math.max(
          0,
          Math.min(100 - startCrop.height, startCrop.y + dyPct),
        );
      } else if (handle === "br") {
        nextW = Math.max(
          10,
          Math.min(100 - startCrop.x, startCrop.width + dxPct),
        );
        nextH = Math.max(
          10,
          Math.min(100 - startCrop.y, startCrop.height + dyPct),
        );
      } else if (handle === "tl") {
        const candidateX = Math.max(
          0,
          Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dxPct),
        );
        const candidateY = Math.max(
          0,
          Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dyPct),
        );
        nextW = startCrop.width - (candidateX - startCrop.x);
        nextH = startCrop.height - (candidateY - startCrop.y);
        nextX = candidateX;
        nextY = candidateY;
      } else if (handle === "tr") {
        const candidateY = Math.max(
          0,
          Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dyPct),
        );
        nextW = Math.max(
          10,
          Math.min(100 - startCrop.x, startCrop.width + dxPct),
        );
        nextH = startCrop.height - (candidateY - startCrop.y);
        nextY = candidateY;
      } else if (handle === "bl") {
        const candidateX = Math.max(
          0,
          Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dxPct),
        );
        nextW = startCrop.width - (candidateX - startCrop.x);
        nextH = Math.max(
          10,
          Math.min(100 - startCrop.y, startCrop.height + dyPct),
        );
        nextX = candidateX;
      } else if (handle === "t") {
        const candidateY = Math.max(
          0,
          Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dyPct),
        );
        nextH = startCrop.height - (candidateY - startCrop.y);
        nextY = candidateY;
      } else if (handle === "b") {
        nextH = Math.max(
          10,
          Math.min(100 - startCrop.y, startCrop.height + dyPct),
        );
      } else if (handle === "l") {
        const candidateX = Math.max(
          0,
          Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dxPct),
        );
        nextW = startCrop.width - (candidateX - startCrop.x);
        nextX = candidateX;
      } else if (handle === "r") {
        nextW = Math.max(
          10,
          Math.min(100 - startCrop.x, startCrop.width + dxPct),
        );
      }

      latestBox = {
        x: Number(nextX.toFixed(2)),
        y: Number(nextY.toFixed(2)),
        width: Number(nextW.toFixed(2)),
        height: Number(nextH.toFixed(2)),
      };

      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(() => {
          pendingRaf = null;
          setCropBox(latestBox);
        });
      }
    };

    const handlePointerUp = () => {
      if (pendingRaf !== null) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = null;
      }
      setCropBox(latestBox);
      setCropDragState(null);
    };

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);
      window.addEventListener("touchmove", handlePointerMove, {
        passive: false,
      });
      window.addEventListener("touchend", handlePointerUp);
      window.addEventListener("touchcancel", handlePointerUp);
      return () => {
        if (pendingRaf !== null) {
          cancelAnimationFrame(pendingRaf);
        }
        if (typeof window.removeEventListener === "function") {
          window.removeEventListener("mousemove", handlePointerMove);
          window.removeEventListener("mouseup", handlePointerUp);
          window.removeEventListener("touchmove", handlePointerMove);
          window.removeEventListener("touchend", handlePointerUp);
          window.removeEventListener("touchcancel", handlePointerUp);
        }
      };
    }
  }, [cropDragState]);

  const stepFrame = (frames: number) => {
    const fps = 30;
    const nextTime = Math.max(
      0,
      Math.min(totalDuration, currentTime + frames / fps),
    );
    onSeek(nextTime);
  };

  return (
    <View
      style={[
        styles.container,
        fullscreen && styles.containerFullscreen,
        Platform.OS === "web"
          ? ({
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
            } as any)
          : undefined,
      ]}
    >
      {/* Floating Exit Fullscreen Button in Cinema Fullscreen Mode */}
      {fullscreen && (
        <TouchableOpacity
          style={styles.floatingExitBtn}
          onPress={toggleFullscreen}
          activeOpacity={0.8}
        >
          <Ionicons name="contract" size={15} color="#000000" />
          <Text style={styles.floatingExitBtnText}>Exit Fullscreen</Text>
        </TouchableOpacity>
      )}

      {/* Canvas Viewport Area */}
      <View
        ref={viewportWrapperRef}
        style={styles.viewportWrapper}
        onLayout={handleViewportLayout}
      >
        <View
          ref={canvasBoxRef}
          style={[
            styles.canvasBox,
            {
              width: boxWidth,
              height: canvasHeight,
              backgroundColor: project.canvasBackground || "#000000",
            },
          ]}
        >
          {Platform.OS === "web" ? (
            <canvas
              ref={canvasRef as any}
              width={Math.round(
                canvasWidth *
                  (typeof window !== "undefined"
                    ? Math.min(
                        window.devicePixelRatio || 1,
                        isMobile ? 1.5 : 2.0,
                      )
                    : 1),
              )}
              height={Math.round(
                canvasHeight *
                  (typeof window !== "undefined"
                    ? Math.min(
                        window.devicePixelRatio || 1,
                        isMobile ? 1.5 : 2.0,
                      )
                    : 1),
              )}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                borderRadius: 8,
              }}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.nativeCompositorContainer,
              ]}
              pointerEvents="box-none"
            >
              {/* Layer 1: Active Video / Image Clips */}
              {activeVideos.map((vid) => {
                const isTrans =
                  activeTransient && activeTransient.clipId === vid.id;
                const kfT = getInterpolatedTransform(vid, currentTime);
                const posX = isTrans ? activeTransient!.x : kfT.x;
                const posY = isTrans ? activeTransient!.y : kfT.y;
                const baseScale = isTrans
                  ? activeTransient!.scale
                  : kfT.scale * (vid.scale || 1);
                const rot = isTrans
                  ? activeTransient!.rotation
                  : kfT.rotation + (vid.rotation || 0);
                const opacity =
                  kfT.opacity * (vid.opacity !== undefined ? vid.opacity : 1);
                const { baseW, baseH } = getItemBaseDimensions("video", vid);
                const w = Math.round(baseW * baseScale);
                const h = Math.round(baseH * baseScale);
                const cx = boxWidth / 2 + posX;
                const cy = canvasHeight / 2 + posY;

                return (
                  <TouchableOpacity
                    key={vid.id}
                    activeOpacity={0.98}
                    onPress={() => onSelectClip?.(vid.id, "video")}
                    style={[
                      {
                        position: "absolute",
                        left: cx - w / 2,
                        top: cy - h / 2,
                        width: w,
                        height: h,
                        justifyContent: "center",
                        alignItems: "center",
                        opacity,
                        transform: [
                          { scaleX: vid.transform?.flipX ? -1 : 1 },
                          { scaleY: vid.transform?.flipY ? -1 : 1 },
                          { rotate: `${rot}deg` },
                        ],
                      },
                    ]}
                  >
                    <NativeVideoClipPlayer
                      clip={vid}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                      onSelect={() => onSelectClip?.(vid.id, "video")}
                    />
                  </TouchableOpacity>
                );
              })}

              {/* Layer 2: Active Text Overlays */}
              {activeTexts.map((txt) => {
                const isTrans =
                  activeTransient && activeTransient.clipId === txt.id;
                const kfT = getInterpolatedTransform(txt, currentTime);
                const effX = isTrans
                  ? activeTransient!.x
                  : (txt.position?.x ?? 50) + (kfT.x / boxWidth) * 100;
                const effY = isTrans
                  ? activeTransient!.y
                  : (txt.position?.y ?? 35) + (kfT.y / canvasHeight) * 100;
                const cx = (effX / 100) * boxWidth;
                const cy = (effY / 100) * canvasHeight;
                const s = isTrans
                  ? activeTransient!.scale
                  : (txt.scale || 1.0) * kfT.scale;
                const rot = isTrans
                  ? activeTransient!.rotation
                  : (txt.rotation || 0) + kfT.rotation;
                const { baseW, baseH } = getItemBaseDimensions("text", txt);
                const w = Math.round(baseW * s);
                const h = Math.round(baseH * s);
                const fontSize = txt.style?.fontSize || 22;

                return (
                  <TouchableOpacity
                    key={txt.id}
                    activeOpacity={0.9}
                    onPress={() => onSelectClip?.(txt.id, "text")}
                    style={{
                      position: "absolute",
                      left: cx - w / 2,
                      top: cy - h / 2,
                      width: w,
                      height: h,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ rotate: `${rot}deg` }],
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        {
                          color: txt.style?.color || "#FFFFFF",
                          fontSize: Math.max(8, fontSize * s),
                          fontWeight: (txt.style?.fontWeight as any) || "700",
                          backgroundColor:
                            txt.style?.backgroundColor || "transparent",
                          textAlign: "center",
                          paddingHorizontal: 8 * s,
                          paddingVertical: 4 * s,
                          borderRadius: 4,
                        },
                      ]}
                    >
                      {txt.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Layer 3: Active Stickers */}
              {activeStickers.map((stk) => {
                const isTrans =
                  activeTransient && activeTransient.clipId === stk.id;
                const kfT = getInterpolatedTransform(stk, currentTime);
                const effX = isTrans
                  ? activeTransient!.x
                  : (stk.position?.x ?? 50) + (kfT.x / boxWidth) * 100;
                const effY = isTrans
                  ? activeTransient!.y
                  : (stk.position?.y ?? 50) + (kfT.y / canvasHeight) * 100;
                const cx = (effX / 100) * boxWidth;
                const cy = (effY / 100) * canvasHeight;
                const s = isTrans
                  ? activeTransient!.scale
                  : (stk.scale || 1.2) * kfT.scale;
                const rot = isTrans
                  ? activeTransient!.rotation
                  : (stk.rotation || 0) + kfT.rotation;
                const { baseW, baseH } = getItemBaseDimensions("sticker", stk);
                const w = Math.round(baseW * s);
                const h = Math.round(baseH * s);
                const isBadge = (stk.char || "").length > 2;

                return (
                  <TouchableOpacity
                    key={stk.id}
                    activeOpacity={0.9}
                    onPress={() => onSelectClip?.(stk.id, "sticker")}
                    style={{
                      position: "absolute",
                      left: cx - w / 2,
                      top: cy - h / 2,
                      width: w,
                      height: h,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ rotate: `${rot}deg` }],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: isBadge
                          ? Math.max(10, 16 * s)
                          : Math.max(12, 38 * s),
                      }}
                    >
                      {stk.char}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Layer 4: Active Effects Overlays on Native Mobile */}
              {activeEffects.map((eff) => {
                const intensity = eff.intensity || 0.8;
                if (eff.type === "vignette") {
                  return (
                    <View
                      key={eff.id}
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderWidth: 24 * intensity,
                          borderColor: "rgba(0,0,0,0.65)",
                          borderRadius: 8,
                        },
                      ]}
                    />
                  );
                }
                if (eff.type === "neon_edge") {
                  return (
                    <View
                      key={eff.id}
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderWidth: 6 * intensity,
                          borderColor: "rgba(0, 242, 254, 0.75)",
                          borderRadius: 8,
                        },
                      ]}
                    />
                  );
                }
                if (eff.type === "glitch" || eff.type === "rgb_split") {
                  return (
                    <View
                      key={eff.id}
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: "rgba(255, 0, 80, 0.14)",
                        },
                      ]}
                    />
                  );
                }
                if (eff.type === "flash") {
                  const flashVal = Math.sin(currentTime * 12);
                  if (flashVal > 0.6) {
                    return (
                      <View
                        key={eff.id}
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: `rgba(255, 255, 255, ${(flashVal - 0.6) * 2 * intensity})`,
                          },
                        ]}
                      />
                    );
                  }
                }
                if (eff.type === "rainbow_flow") {
                  const hue = Math.floor((currentTime * 120) % 360);
                  return (
                    <View
                      key={eff.id}
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: `hsla(${hue}, 90%, 50%, 0.12)`,
                        },
                      ]}
                    />
                  );
                }
                return null;
              })}

              {/* Empty State when no clips at playhead */}
              {activeVideos.length === 0 &&
                activeTexts.length === 0 &&
                activeStickers.length === 0 && (
                  <View style={styles.nativeEmptyScrub}>
                    <Ionicons name="film-outline" size={32} color="#374151" />
                    <Text style={styles.nativeEmptyScrubText}>
                      No clip at {formatTime(currentTime)}
                    </Text>
                  </View>
                )}
            </View>
          )}

          {/* Interactive On-Canvas Transform Overlay Layer */}
          <View style={styles.interactiveCanvasLayer} pointerEvents="box-none">
            {isCroppingMode && targetCropClip ? (
              <>
                {/* 4 Dimmed Scrim Panels outside crop area */}
                <View
                  style={[
                    styles.cropScrim,
                    {
                      top: 0,
                      left: 0,
                      right: 0,
                      height: Math.max(0, cropPixelY),
                    },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.cropScrim,
                    {
                      top: cropPixelY + cropPixelH,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.cropScrim,
                    {
                      top: cropPixelY,
                      left: 0,
                      width: Math.max(0, cropPixelX),
                      height: cropPixelH,
                    },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.cropScrim,
                    {
                      top: cropPixelY,
                      left: cropPixelX + cropPixelW,
                      right: 0,
                      height: cropPixelH,
                    },
                  ]}
                  pointerEvents="none"
                />

                {/* Interactive Crop Box Frame */}
                <View
                  style={[
                    styles.cropBoxFrame,
                    {
                      left: cropPixelX,
                      top: cropPixelY,
                      width: cropPixelW,
                      height: cropPixelH,
                    },
                  ]}
                >
                  {/* Rule-of-Thirds Composition Grid */}
                  <View
                    style={[
                      styles.cropGridLine,
                      styles.cropGridLineH,
                      { top: "33.33%" },
                    ]}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      styles.cropGridLine,
                      styles.cropGridLineH,
                      { top: "66.66%" },
                    ]}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      styles.cropGridLine,
                      styles.cropGridLineV,
                      { left: "33.33%" },
                    ]}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      styles.cropGridLine,
                      styles.cropGridLineV,
                      { left: "66.66%" },
                    ]}
                    pointerEvents="none"
                  />

                  {/* Viewfinder Badge */}
                  <View style={styles.cropBadgePill} pointerEvents="none">
                    <Ionicons
                      name="crop"
                      size={10}
                      color="#00F2FE"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.cropBadgeText}>
                      {cropPreset.toUpperCase()} •{" "}
                      {Math.round((cropBox.width / 100) * mw)}×
                      {Math.round((cropBox.height / 100) * mh)}
                    </Text>
                  </View>

                  {/* Center Pan Hit Area */}
                  <View
                    style={styles.cropPanHitArea}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "pan"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "pan"),
                    } as any)}
                  />

                  {/* 4 Corner Handles */}
                  <View
                    style={[styles.cropCornerHitArea, styles.cropCornerTL]}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "tl"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "tl"),
                    } as any)}
                  >
                    <View
                      style={[styles.cropCornerArmH, { top: 0, left: 0 }]}
                    />
                    <View
                      style={[styles.cropCornerArmV, { top: 0, left: 0 }]}
                    />
                  </View>

                  <View
                    style={[styles.cropCornerHitArea, styles.cropCornerTR]}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "tr"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "tr"),
                    } as any)}
                  >
                    <View
                      style={[styles.cropCornerArmH, { top: 0, right: 0 }]}
                    />
                    <View
                      style={[styles.cropCornerArmV, { top: 0, right: 0 }]}
                    />
                  </View>

                  <View
                    style={[styles.cropCornerHitArea, styles.cropCornerBL]}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "bl"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "bl"),
                    } as any)}
                  >
                    <View
                      style={[styles.cropCornerArmH, { bottom: 0, left: 0 }]}
                    />
                    <View
                      style={[styles.cropCornerArmV, { bottom: 0, left: 0 }]}
                    />
                  </View>

                  <View
                    style={[styles.cropCornerHitArea, styles.cropCornerBR]}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "br"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "br"),
                    } as any)}
                  >
                    <View
                      style={[styles.cropCornerArmH, { bottom: 0, right: 0 }]}
                    />
                    <View
                      style={[styles.cropCornerArmV, { bottom: 0, right: 0 }]}
                    />
                  </View>

                  {/* 4 Edge Handles */}
                  <View
                    style={[styles.cropEdgeHitAreaH, styles.cropEdgeTop]}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "t"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "t"),
                    } as any)}
                  >
                    <View style={styles.cropEdgePillH} />
                  </View>

                  <View
                    style={[styles.cropEdgeHitAreaH, styles.cropEdgeBottom]}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "b"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "b"),
                    } as any)}
                  >
                    <View style={styles.cropEdgePillH} />
                  </View>

                  <View
                    style={[styles.cropEdgeHitAreaV, styles.cropEdgeLeft]}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "l"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "l"),
                    } as any)}
                  >
                    <View style={styles.cropEdgePillV} />
                  </View>

                  <View
                    style={[styles.cropEdgeHitAreaV, styles.cropEdgeRight]}
                    {...({
                      onMouseDown: (e: any) => handleCropDragStart(e, "r"),
                      onTouchStart: (e: any) => handleCropDragStart(e, "r"),
                    } as any)}
                  >
                    <View style={styles.cropEdgePillV} />
                  </View>
                </View>
              </>
            ) : (
              <View
                style={StyleSheet.absoluteFill}
                {...canvasMultiTouchPanResponder.panHandlers}
              >
                {/* Background Tap on empty canvas area to cleanly Deselect */}
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => {
                    if (selectedClipId) onSelectClip?.(null);
                  }}
                />

                {/* Unselected Clickable & Immediately Draggable Hit Areas for Active Videos (Track-layered) */}
                {activeVideos.map((vid) => {
                  if (selectedClipId === vid.id) return null;
                  const vidTrackZ =
                    (typeof vid.trackIndex === "number" ? vid.trackIndex : 0) *
                      2 +
                    10;
                  const kfT = getInterpolatedTransform(vid, currentTime);
                  const cx =
                    (50 + ((kfT.x / boxWidth) * 100) / 100) * boxWidth;
                  const cy =
                    (50 + ((kfT.y / canvasHeight) * 100) / 100) * canvasHeight;
                  const s = (vid.scale || 1) * kfT.scale;
                  const { baseW, baseH } = getItemBaseDimensions("video", vid);
                  const w = Math.round(baseW * s);
                  const h = Math.round(baseH * s);
                  const itemObj = {
                    id: vid.id,
                    type: "video",
                    label: vid.title,
                    pos: {
                      x: 50 + ((vid.transform?.x || 0) / boxWidth) * 100,
                      y: 50 + ((vid.transform?.y || 0) / canvasHeight) * 100,
                    },
                    scale: s,
                    rotation: vid.transform?.rotation ?? 0,
                    width: w,
                    height: h,
                  };
                  return (
                    <TouchableOpacity
                      key={vid.id}
                      activeOpacity={0.85}
                      onPress={() => onSelectClip?.(vid.id, "video")}
                      style={[
                        styles.unselectedHitBox,
                        {
                          left: cx - w / 2,
                          top: cy - h / 2,
                          width: w,
                          height: h,
                          zIndex: vidTrackZ,
                          transform: [
                            { rotate: `${vid.transform?.rotation || 0}deg` },
                          ],
                        },
                      ]}
                      {...(Platform.OS === "web"
                        ? ({
                            onMouseDown: (e: any) => {
                              onSelectClip?.(vid.id, "video");
                              handleStartDrag(e, "move", undefined, itemObj);
                            },
                            onTouchStart: (e: any) => {
                              onSelectClip?.(vid.id, "video");
                              handleStartDrag(e, "move", undefined, itemObj);
                            },
                          } as any)
                        : {})}
                    />
                  );
                })}

                {/* Unselected Clickable & Immediately Draggable Hit Boxes for Active Texts */}
                {activeTexts.map((txt) => {
                  if (txt.id === selectedClipId) return null;
                  const txtTrackZ =
                    (typeof txt.trackIndex === "number" ? txt.trackIndex : 2) *
                      2 +
                    30;
                  const cx = ((txt.position?.x ?? 50) / 100) * boxWidth;
                  const cy = ((txt.position?.y ?? 35) / 100) * canvasHeight;
                  const s = txt.scale || 1.0;
                  const { baseW, baseH } = getItemBaseDimensions("text", txt);
                  const w = Math.round(baseW * s);
                  const h = Math.round(baseH * s);
                  const itemObj = {
                    id: txt.id,
                    type: "text",
                    label: txt.text,
                    pos: txt.position || { x: 50, y: 35 },
                    scale: txt.scale ?? 1.0,
                    rotation: txt.rotation ?? 0,
                    width: w,
                    height: h,
                  };
                  return (
                    <TouchableOpacity
                      key={txt.id}
                      activeOpacity={0.85}
                      onPress={() => onSelectClip?.(txt.id, "text")}
                      style={[
                        styles.unselectedHitBox,
                        {
                          left: cx - w / 2,
                          top: cy - h / 2,
                          width: w,
                          height: h,
                          zIndex: txtTrackZ,
                          transform: [{ rotate: `${txt.rotation || 0}deg` }],
                        },
                      ]}
                      {...(Platform.OS === "web"
                        ? ({
                            onMouseDown: (e: any) => {
                              onSelectClip?.(txt.id, "text");
                              handleStartDrag(e, "move", undefined, itemObj);
                            },
                            onTouchStart: (e: any) => {
                              onSelectClip?.(txt.id, "text");
                              handleStartDrag(e, "move", undefined, itemObj);
                            },
                          } as any)
                        : {})}
                    />
                  );
                })}

                {/* Unselected Clickable & Immediately Draggable Hit Boxes for Active Stickers */}
                {activeStickers.map((stk) => {
                  if (stk.id === selectedClipId) return null;
                  const stkTrackZ =
                    (typeof stk.trackIndex === "number" ? stk.trackIndex : 3) *
                      2 +
                    32;
                  const cx = ((stk.position?.x ?? 50) / 100) * boxWidth;
                  const cy = ((stk.position?.y ?? 50) / 100) * canvasHeight;
                  const s = stk.scale || 1.2;
                  const { baseW, baseH } = getItemBaseDimensions(
                    "sticker",
                    stk,
                  );
                  const w = Math.round(baseW * s);
                  const h = Math.round(baseH * s);
                  const itemObj = {
                    id: stk.id,
                    type: "sticker",
                    label: stk.char,
                    pos: stk.position || { x: 50, y: 50 },
                    scale: stk.scale ?? 1.2,
                    rotation: stk.rotation ?? 0,
                    width: w,
                    height: h,
                  };
                  return (
                    <TouchableOpacity
                      key={stk.id}
                      activeOpacity={0.85}
                      onPress={() => onSelectClip?.(stk.id, "sticker")}
                      style={[
                        styles.unselectedHitBox,
                        {
                          left: cx - w / 2,
                          top: cy - h / 2,
                          width: w,
                          height: h,
                          zIndex: stkTrackZ,
                          transform: [{ rotate: `${stk.rotation || 0}deg` }],
                        },
                      ]}
                      {...(Platform.OS === "web"
                        ? ({
                            onMouseDown: (e: any) => {
                              onSelectClip?.(stk.id, "sticker");
                              handleStartDrag(e, "move", undefined, itemObj);
                            },
                            onTouchStart: (e: any) => {
                              onSelectClip?.(stk.id, "sticker");
                              handleStartDrag(e, "move", undefined, itemObj);
                            },
                          } as any)
                        : {})}
                    />
                  );
                })}

                {/* Active Selected Transform Bounding Box with Hand Drag, Resize & Rotate Handles */}
                {activeTransformItem && (
                  <View
                    style={[
                      styles.activeTransformBox,
                      {
                        left:
                          (activeTransformItem.pos.x / 100) * boxWidth -
                          activeTransformItem.width / 2,
                        top:
                          (activeTransformItem.pos.y / 100) * canvasHeight -
                          activeTransformItem.height / 2,
                        width: activeTransformItem.width,
                        height: activeTransformItem.height,
                        transform: [
                          { rotate: `${activeTransformItem.rotation}deg` },
                        ],
                      },
                    ]}
                    {...(Platform.OS === "web"
                      ? ({
                          onMouseDown: (e: any) => handleStartDrag(e, "move"),
                          onTouchStart: (e: any) => handleStartDrag(e, "move"),
                          onDoubleClick: (e: any) => {
                            e.stopPropagation?.();
                            if (
                              activeTransformItem.type === "text" ||
                              activeTransformItem.type === "sticker"
                            ) {
                              onOpenEditModal?.(
                                activeTransformItem.id,
                                activeTransformItem.type,
                              );
                            } else if (activeTransformItem.type === "video") {
                              handleEnterCropMode(activeTransformItem.id);
                            }
                          },
                        } as any)
                      : nativeBoxPanResponder.panHandlers)}
                  >
                    {/* Top Rotation Stem Line & Handle Knob - ONLY on desktop/large screens; small screens use intuitive 2-finger rotation */}
                    {/* {!isSmallScreen && ( */}
                    <>
                      <View style={styles.rotStem} pointerEvents="none" />
                      <View
                        style={styles.rotKnob}
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                        {...(Platform.OS === "web"
                          ? ({
                              onMouseDown: (e: any) =>
                                handleStartDrag(e, "rotate"),
                              onTouchStart: (e: any) =>
                                handleStartDrag(e, "rotate"),
                            } as any)
                          : nativeRotPanResponder.panHandlers)}
                      >
                        <Ionicons
                          name="sync-outline"
                          size={16}
                          color="#000000"
                        />
                      </View>
                    </>
                    {/* )} */}

                    {/* 4 Corner Resize Handles with Omnidirectional Natural Finger Scaling */}
                    <View
                      style={[styles.cornerHandle, styles.handleTL]}
                      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                      {...(Platform.OS === "web"
                        ? ({
                            onMouseDown: (e: any) =>
                              handleStartDrag(e, "scale", "tl"),
                            onTouchStart: (e: any) =>
                              handleStartDrag(e, "scale", "tl"),
                          } as any)
                        : scaleTLResponder.panHandlers)}
                    />
                    <View
                      style={[styles.cornerHandle, styles.handleTR]}
                      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                      {...(Platform.OS === "web"
                        ? ({
                            onMouseDown: (e: any) =>
                              handleStartDrag(e, "scale", "tr"),
                            onTouchStart: (e: any) =>
                              handleStartDrag(e, "scale", "tr"),
                          } as any)
                        : scaleTRResponder.panHandlers)}
                    />
                    <View
                      style={[styles.cornerHandle, styles.handleBL]}
                      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                      {...(Platform.OS === "web"
                        ? ({
                            onMouseDown: (e: any) =>
                              handleStartDrag(e, "scale", "bl"),
                            onTouchStart: (e: any) =>
                              handleStartDrag(e, "scale", "bl"),
                          } as any)
                        : scaleBLResponder.panHandlers)}
                    />
                    <View
                      style={[styles.cornerHandle, styles.handleBR]}
                      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                      {...(Platform.OS === "web"
                        ? ({
                            onMouseDown: (e: any) =>
                              handleStartDrag(e, "scale", "br"),
                            onTouchStart: (e: any) =>
                              handleStartDrag(e, "scale", "br"),
                          } as any)
                        : scaleBRResponder.panHandlers)}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Quick Action HUD Bar for Selected Item - Clean action options */}
            {activeTransformItem && (
              <View
                style={styles.floatingHudContainer}
                pointerEvents="box-none"
              >
                <View style={styles.floatingHudContentCompact}>
                  {/* Option 1: Primary Action (Edit for text/sticker, Crop for video) */}
                  {activeTransformItem.type === "video" ? (
                    <TouchableOpacity
                      style={styles.floatingActionBtn}
                      onPress={() =>
                        handleEnterCropMode(activeTransformItem.id)
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="crop" size={13} color="#00F2FE" />
                      <Text style={styles.floatingBtnText}>Crop</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.floatingActionBtn}
                      onPress={() =>
                        onOpenEditModal?.(
                          activeTransformItem.id,
                          activeTransformItem.type,
                        )
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil" size={13} color="#00F2FE" />
                      <Text style={styles.floatingBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  {/* Option 2: Delete */}
                  <TouchableOpacity
                    style={[styles.floatingActionBtn, styles.floatingDeleteBtn]}
                    onPress={() =>
                      onDeleteClip?.(
                        activeTransformItem.id,
                        activeTransformItem.type,
                      )
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={13} color="#FB7185" />
                    <Text
                      style={[styles.floatingBtnText, { color: "#FB7185" }]}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>

                  {/* Option 3: Done */}
                  <TouchableOpacity
                    style={[styles.floatingActionBtn, styles.floatingDoneBtn]}
                    onPress={() => onSelectClip?.(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={14}
                      color="#10B981"
                    />
                    <Text
                      style={[styles.floatingBtnText, { color: "#10B981" }]}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Safe Zone Grid Overlay */}
          {showSafeZone && (
            <View style={styles.safeZoneBox} pointerEvents="none">
              <View style={styles.safeZoneLineHoriz} />
              <View style={styles.safeZoneLineVert} />
            </View>
          )}

          {/* Empty State Overlay when no track content is added */}
          {isProjectEmpty && (
            <TouchableOpacity
              style={styles.emptyCanvasOverlay}
              activeOpacity={0.85}
              onPress={onOpenMediaPicker}
            >
              <View style={styles.emptyUploadCircle}>
                <Ionicons name="film-outline" size={32} color="#00F2FE" />
              </View>
              <Text style={styles.emptyCanvasTitle}>No Media Added</Text>
              <Text style={styles.emptyCanvasSubtitle}>
                Import photos, videos, or pick from verified library
              </Text>
              <View style={styles.emptyActionRow}>
                <View style={styles.emptyUploadBtn}>
                  <Ionicons name="add" size={16} color="#000000" />
                  <Text style={styles.emptyUploadBtnText}>Add Media</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* HUD Badge: Aspect Ratio & Filter */}
          <View style={styles.hudBadge}>
            <Text style={styles.hudText}>{project.aspectRatio}</Text>
          </View>

          {/* Floating Keyframe Action HUD Toast */}
          {kfToast && (
            <View style={styles.floatingKfToast} pointerEvents="none">
              <Ionicons
                name={kfToast.isAdd ? "diamond" : "diamond-outline"}
                size={14}
                color={kfToast.isAdd ? "#FFE600" : "#C2C9D6"}
              />
              <Text style={styles.floatingKfToastText}>{kfToast.text}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Control Bar beneath player OR on-preview crop bar card */}
      {isCroppingMode ? (
        <View
          style={[
            styles.previewCropBarCard,
            isMobile && styles.previewCropBarCardCompact,
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cropPresetScroll}
          >
            {CROP_PRESETS.map((preset) => {
              const isSelected = cropPreset === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.cropPresetChip,
                    isSelected && styles.cropPresetChipActive,
                  ]}
                  onPress={() => handleApplyPresetCrop(preset.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cropPresetText,
                      isSelected && styles.cropPresetTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.cropActionsRow}>
            <TouchableOpacity
              style={styles.cropResetBtn}
              onPress={handleResetCrop}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={13} color="#94A3B8" />
              <Text style={styles.cropResetText}>Reset</Text>
            </TouchableOpacity>

            <View style={styles.cropActionsRight}>
              <TouchableOpacity
                style={styles.cropCancelBtn}
                onPress={handleCancelCrop}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={14} color="#CBD5E1" />
                <Text style={styles.cropCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cropApplyBtn}
                onPress={handleConfirmCrop}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={14} color="#000000" />
                <Text style={styles.cropApplyText}>Apply Crop</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.controlBar,
            isMobile && styles.controlBarCompact,
            fullscreen && styles.controlBarFullscreen,
          ]}
        >
          <View style={styles.controlGroupLeft}>
            <View style={styles.timecodePill}>
              <Ionicons
                name="time-outline"
                size={11}
                color="#00F2FE"
                style={{ marginRight: 3 }}
              />
              <Text style={styles.timecodeText}>
                {formatTime(currentTime)}
                <Text style={styles.timecodeTotalText}>
                  {" "}
                  / {formatTime(totalDuration)}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.controlGroupCenter} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.stepBtn, isMobile && styles.stepBtnMobile]}
              onPress={() => stepFrame(-1)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Previous Frame"
            >
              <Ionicons
                name="play-skip-back"
                size={isMobile ? 12 : 14}
                color="#8E95A5"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.playPauseBtn,
                isMobile && styles.playPauseBtnMobile,
              ]}
              onPress={onTogglePlay}
              activeOpacity={0.8}
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={isMobile ? 16 : 20}
                color="#FFFFFF"
                style={!isPlaying ? { marginLeft: 2 } : undefined}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.stepBtn, isMobile && styles.stepBtnMobile]}
              onPress={() => stepFrame(1)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Next Frame"
            >
              <Ionicons
                name="play-skip-forward"
                size={isMobile ? 12 : 14}
                color="#8E95A5"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.controlGroupRight}>
            <TouchableOpacity
              style={[styles.smallBtn, showSafeZone && styles.smallBtnActive]}
              onPress={() => setShowSafeZone(!showSafeZone)}
              activeOpacity={0.7}
              accessibilityLabel="Toggle Safe Zone Grid"
            >
              <Ionicons
                name="grid-outline"
                size={isMobile ? 13 : 15}
                color={showSafeZone ? "#00F2FE" : "#8E95A5"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smallBtn,
                styles.keyframeBtn,
                hasKeyframeAtCurrentTime && styles.keyframeActive,
              ]}
              onPress={handleKeyframePress}
              onLongPress={onOpenKeyframeModal || handleKeyframePress}
              hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityLabel={
                hasKeyframeAtCurrentTime
                  ? "Remove Keyframe at Playhead"
                  : "Add Keyframe at Playhead (Hold for Studio)"
              }
            >
              <Ionicons
                name={hasKeyframeAtCurrentTime ? "diamond" : "diamond-outline"}
                size={isMobile ? 14 : 16}
                color={hasKeyframeAtCurrentTime ? "#FFE600" : "#8E95A5"}
              />
              {/* Badge indicator (+ / -) */}
              <View
                style={[
                  styles.kfBadgeIcon,
                  hasKeyframeAtCurrentTime
                    ? styles.kfBadgeIconRemove
                    : styles.kfBadgeIconAdd,
                ]}
              >
                <Ionicons
                  name={hasKeyframeAtCurrentTime ? "remove" : "add"}
                  size={7}
                  color={hasKeyframeAtCurrentTime ? "#FFFFFF" : "#00F2FE"}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallBtn, fullscreen && styles.smallBtnActive]}
              onPress={toggleFullscreen}
              activeOpacity={0.7}
              accessibilityLabel={
                fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"
              }
            >
              <Ionicons
                name={fullscreen ? "contract-outline" : "expand-outline"}
                size={isMobile ? 13 : 15}
                color={fullscreen ? "#00F2FE" : "#8E95A5"}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0B0D13",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
    overflow: "hidden" as any,
  },
  containerFullscreen: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    backgroundColor: "#000000",
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingExitBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00F2FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    zIndex: 10000,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingExitBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },
  floatingHudContentCompact: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(14, 17, 24, 0.94)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    gap: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  viewportWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  canvasBox: {
    backgroundColor: "#000000",
    borderRadius: 8,
    overflow: "visible" as any,
    position: "relative",
    borderWidth: 1,
    borderColor: "#1E2333",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  interactiveCanvasLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    overflow: "visible" as any,
  },
  unselectedHitBox: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: 8,
    cursor: "pointer" as any,
    zIndex: 25,
    touchAction: "none" as any,
  },
  unselectedVideoHitBox: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    cursor: "pointer" as any,
    touchAction: "none" as any,
  },
  activeTransformBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#00F2FE",
    borderStyle: "dashed",
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderRadius: 8,
    zIndex: 100,
    cursor: "move" as any,
    boxShadow: "0 0 16px rgba(0, 242, 254, 0.45)" as any,
    touchAction: "none" as any,
    userSelect: "none" as any,
    WebkitUserSelect: "none" as any,
  },
  rotStem: {
    position: "absolute",
    top: -30,
    left: "50%",
    width: 2,
    height: 30,
    backgroundColor: "#00F2FE",
    marginLeft: -1,
  },
  rotKnob: {
    position: "absolute",
    top: -56,
    left: "50%",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00F2FE",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -18,
    cursor: "grab" as any,
    boxShadow: "0 2px 10px rgba(0,0,0,0.6)" as any,
    zIndex: 110,
    touchAction: "none" as any,
    userSelect: "none" as any,
    WebkitUserSelect: "none" as any,
  },
  cornerHandle: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#00F2FE",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    boxShadow: "0 2px 10px rgba(0,0,0,0.6)" as any,
    zIndex: 110,
    touchAction: "none" as any,
    userSelect: "none" as any,
    WebkitUserSelect: "none" as any,
  },
  handleTL: {
    top: -12,
    left: -12,
    cursor: "nwse-resize" as any,
  },
  handleTR: {
    top: -12,
    right: -12,
    cursor: "nesw-resize" as any,
  },
  handleBL: {
    bottom: -12,
    left: -12,
    cursor: "nesw-resize" as any,
  },
  handleBR: {
    bottom: -12,
    right: -12,
    cursor: "nwse-resize" as any,
  },
  floatingHudContainer: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 35,
    alignItems: "center",
  },
  floatingHudContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 18, 26, 0.94)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A3245",
    gap: 4,
  },
  floatingInfoPill: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.25)",
  },
  floatingInfoText: {
    color: "#00F2FE",
    fontSize: 9,
    fontWeight: "800",
  },
  floatingActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#202636",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  floatingBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  floatingDeleteBtn: {
    backgroundColor: "rgba(251, 113, 133, 0.15)",
  },
  floatingDoneBtn: {
    backgroundColor: "rgba(0, 242, 254, 0.15)",
  },
  emptyCanvasOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0E1118",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10,
  },
  emptyUploadCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyCanvasTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptyCanvasSubtitle: {
    color: "#8E95A5",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 14,
  },
  emptyActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00F2FE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyUploadBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
  nativeCompositorContainer: {
    backgroundColor: "#000000",
    borderRadius: 8,
    overflow: "hidden" as any,
  },
  nativeCardFallback: {
    width: "90%",
    height: "90%",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(0, 242, 254, 0.35)",
    backgroundColor: "#141824",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  nativeCardTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  nativeCardSubtitle: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  nativePlaceholderMedia: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#1E2333",
    justifyContent: "center",
    alignItems: "center",
  },
  nativeEmptyScrub: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0D1017",
    borderRadius: 8,
    gap: 8,
  },
  nativeEmptyScrubText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
  },
  nativeFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10131A",
  },
  nativeFallbackText: {
    color: "#8E95A5",
    fontSize: 14,
    marginTop: 8,
    fontWeight: "600",
  },
  safeZoneBox: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.4)",
    margin: 16,
  },
  safeZoneLineHoriz: {
    position: "absolute",
    top: "33.33%",
    bottom: "33.33%",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  safeZoneLineVert: {
    position: "absolute",
    left: "33.33%",
    right: "33.33%",
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  hudBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hudText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "800",
  },
  controlBar: {
    width: "100%",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    height: 48,
    marginTop: 2,
    marginBottom: 4,
    flexShrink: 0,
  },
  controlBarCompact: {
    paddingHorizontal: 8,
    height: 42,
    marginTop: 1,
    marginBottom: 3,
  },
  controlBarFullscreen: {
    position: "absolute",
    bottom: 12,
    left: 14,
    right: 14,
    width: "auto",
    backgroundColor: "rgba(14, 17, 24, 0.92)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 9999,
  },
  playPauseBtnMobile: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  controlGroupLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexShrink: 0,
    zIndex: 3,
  },
  controlGroupCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 2,
  },
  controlGroupRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    flexShrink: 0,
    zIndex: 3,
  },
  smallBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#141721",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnActive: {
    backgroundColor: "#1E2B3E",
  },
  keyframeBtn: {
    position: "relative",
  },
  keyframeActive: {
    backgroundColor: "rgba(255, 230, 0, 0.2)",
    borderWidth: 1.2,
    borderColor: "#FFE600",
  },
  kfBadgeIcon: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  kfBadgeIconAdd: {
    backgroundColor: "#161D2B",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  kfBadgeIconRemove: {
    backgroundColor: "#FF0050",
  },
  floatingKfToast: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(13, 17, 26, 0.94)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 230, 0, 0.45)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  floatingKfToastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20, 23, 33, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnMobile: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  playPauseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FF0050",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF0050",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  timecodePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141721",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1E2333",
    flexShrink: 0,
  },
  timecodeText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timecodeTotalText: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  cropScrim: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    zIndex: 22,
  },
  cropBoxFrame: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "#00F2FE",
    zIndex: 25,
    boxShadow: "0 0 12px rgba(0, 242, 254, 0.45)" as any,
    touchAction: "none",
  } as any,
  cropGridLine: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  cropGridLineH: {
    left: 0,
    right: 0,
    height: 1,
  },
  cropGridLineV: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  cropBadgePill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10, 13, 22, 0.82)",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.35)",
    zIndex: 28,
  },
  cropBadgeText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
  cropPanHitArea: {
    ...StyleSheet.absoluteFill,
    cursor: "move" as any,
    zIndex: 26,
    touchAction: "none",
  } as any,
  cropCornerHitArea: {
    position: "absolute",
    width: 44,
    height: 44,
    zIndex: 35,
    touchAction: "none",
  } as any,
  cropCornerTL: {
    top: -14,
    left: -14,
    cursor: "nwse-resize" as any,
  },
  cropCornerTR: {
    top: -14,
    right: -14,
    cursor: "nesw-resize" as any,
  },
  cropCornerBL: {
    bottom: -14,
    left: -14,
    cursor: "nesw-resize" as any,
  },
  cropCornerBR: {
    bottom: -14,
    right: -14,
    cursor: "nwse-resize" as any,
  },
  cropCornerArmH: {
    position: "absolute",
    width: 18,
    height: 4,
    backgroundColor: "#00F2FE",
    borderRadius: 2,
  },
  cropCornerArmV: {
    position: "absolute",
    width: 4,
    height: 18,
    backgroundColor: "#00F2FE",
    borderRadius: 2,
  },
  cropEdgeHitAreaH: {
    position: "absolute",
    left: "50%",
    marginLeft: -26,
    width: 52,
    height: 36,
    zIndex: 34,
    alignItems: "center",
    justifyContent: "center",
    touchAction: "none",
  } as any,
  cropEdgeTop: {
    top: -18,
    cursor: "ns-resize" as any,
  },
  cropEdgeBottom: {
    bottom: -18,
    cursor: "ns-resize" as any,
  },
  cropEdgePillH: {
    width: 28,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#00F2FE",
  },
  cropEdgeHitAreaV: {
    position: "absolute",
    top: "50%",
    marginTop: -26,
    width: 36,
    height: 52,
    zIndex: 34,
    alignItems: "center",
    justifyContent: "center",
    touchAction: "none",
  } as any,
  cropEdgeLeft: {
    left: -18,
    cursor: "ew-resize" as any,
  },
  cropEdgeRight: {
    right: -18,
    cursor: "ew-resize" as any,
  },
  cropEdgePillV: {
    width: 5,
    height: 28,
    borderRadius: 2.5,
    backgroundColor: "#00F2FE",
  },
  previewCropBarCard: {
    width: "100%",
    backgroundColor: "rgba(15, 18, 28, 0.95)",
    borderTopWidth: 1,
    borderColor: "#1E2333",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  previewCropBarCardCompact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  cropPresetScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  cropPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#1E2333",
    borderWidth: 1,
    borderColor: "#2D3548",
  },
  cropPresetChipActive: {
    backgroundColor: "rgba(0, 242, 254, 0.15)",
    borderColor: "#00F2FE",
  },
  cropPresetText: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "600",
  },
  cropPresetTextActive: {
    color: "#00F2FE",
    fontWeight: "700",
  },
  cropActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cropResetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1A1E2C",
  },
  cropResetText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  cropActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cropCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1E2333",
    borderWidth: 1,
    borderColor: "#2D3548",
  },
  cropCancelText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  cropApplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#00F2FE",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  cropApplyText: {
    color: "#00F2FE",
    fontSize: 12,
    fontWeight: "700",
  },
} as any);

export default React.memo(Player);
