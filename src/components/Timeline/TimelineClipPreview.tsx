import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Image, StyleSheet, Platform } from "react-native";
import { UnifiedClipItem } from "./timelineTypes";
import {
  getMediaThumbnail,
  subscribeThumbnailChange,
  requestMediaThumbnail,
  globalThumbnailCache,
} from "../../utils/mediaThumbnailGenerator";
import { isImageClip } from "../../utils/mediaDuration";

interface TimelineClipPreviewProps {
  clip: UnifiedClipItem;
  width: number;
}

const FRAME_WIDTH = 54;

export const TimelineClipPreview: React.FC<TimelineClipPreviewProps> = ({
  clip,
  width,
}) => {
  // Only video and photo/image clips have media visual previews
  const isVisual =
    clip.type === "video" || isImageClip(clip);

  if (!isVisual) {
    return null;
  }

  const [thumbUri, setThumbUri] = useState<string | null>(() =>
    getMediaThumbnail(clip)
  );

  useEffect(() => {
    // Check if thumbnail is already available or changed
    const current = getMediaThumbnail(clip);
    if (current && current !== thumbUri) {
      setThumbUri(current);
    } else if (!current) {
      requestMediaThumbnail(clip);
    }

    // Subscribe to background thumbnail generation completion
    const unsubscribe = subscribeThumbnailChange((clipId, newUri) => {
      if (clipId === clip.id || clipId === clip.rawClip?.id) {
        setThumbUri(newUri);
      }
    });

    return unsubscribe;
  }, [
    clip.id,
    clip.rawClip?.thumbnail,
    clip.rawClip?.url,
    clip.rawClip?.trimIn,
    clip.rawClip?.thumbnailTrimIn,
  ]);

  const handleImageError = useCallback(() => {
    globalThumbnailCache.delete(clip.id);
    if (clip.rawClip) {
      clip.rawClip.thumbnail = undefined;
    }
    setThumbUri(null);
    requestMediaThumbnail(clip);
  }, [clip]);

  // Compute number of filmstrip frames that fit in this clip
  const frameCount = useMemo(() => {
    if (width <= 0) return 0;
    const count = Math.max(1, Math.ceil(width / FRAME_WIDTH));
    return Platform.OS === "web" ? count : Math.min(count, 20);
  }, [width]);

  if (!thumbUri || frameCount <= 0) {
    return null;
  }

  // 100% Optimized Web Fast-Path: 1 single DOM node with GPU CSS background-repeat
  if (Platform.OS === "web") {
    return (
      <View style={previewStyles.container} pointerEvents="none">
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: `url(${thumbUri})`,
              backgroundRepeat: "repeat-x",
              backgroundSize: `${FRAME_WIDTH}px 100%`,
              backgroundPosition: "left center",
            } as any,
          ]}
        />
        <View style={previewStyles.contrastWash} />
      </View>
    );
  }

  return (
    <View style={previewStyles.container} pointerEvents="none">
      {/* Repeating Filmstrip Thumbnail Frames */}
      <View style={previewStyles.filmstripRow}>
        {Array.from({ length: frameCount }).map((_, idx) => (
          <View
            key={`film-frame-${idx}`}
            style={[
              previewStyles.frameBox,
              { width: FRAME_WIDTH },
              idx < frameCount - 1 && previewStyles.frameDivider,
            ]}
          >
            <Image
              source={{ uri: thumbUri }}
              style={previewStyles.frameImage}
              resizeMode="cover"
              onError={handleImageError}
            />
          </View>
        ))}
      </View>

      {/* Subtle modern vignette wash so overlay text remains easily readable without dimming preview */}
      <View style={previewStyles.contrastWash} />
    </View>
  );
};

const previewStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    zIndex: 1,
  },
  filmstripRow: {
    flex: 1,
    flexDirection: "row",
    height: "100%",
  },
  frameBox: {
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#0F172A",
  },
  frameDivider: {
    borderRightWidth: 0.75,
    borderRightColor: "rgba(0, 0, 0, 0.4)",
  },
  frameImage: {
    width: "100%",
    height: "100%",
    opacity: 1,
  },
  contrastWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
});

export default React.memo(TimelineClipPreview);
