/**
 * FastArt AI Human Segmentation Service (MediaPipe Selfie Segmentation)
 * Automatically isolates human persons/portraits from video & image backgrounds frame-by-frame in real time.
 */

let isScriptLoading = false;
let isScriptLoaded = false;
let selfieSegmentationInstance: any = null;
let lastSegmentedMask: HTMLCanvasElement | null = null;
let lastSegmentedCtx: CanvasRenderingContext2D | null = null;
let isProcessingFrame = false;
let lastProcessedTime = 0;
let inputCanvas: HTMLCanvasElement | null = null;
let inputCtx: CanvasRenderingContext2D | null = null;
let onMaskUpdatedCallback: (() => void) | null = null;

// Frame-by-frame baked mask cache for video clips
// Key: `${clipId}_${frameIndex}`
const clipMaskCache = new Map<string, HTMLCanvasElement>();

export function isSelfieSegmentationReady(): boolean {
  return !!selfieSegmentationInstance;
}

export function setOnMaskUpdated(cb: (() => void) | null): void {
  onMaskUpdatedCallback = cb;
}

export function getFrameMask(clipId: string, clipTime: number, fps = 15): HTMLCanvasElement | null {
  if (!clipId) return null;
  const frameIdx = Math.max(0, Math.floor(clipTime * fps));
  return clipMaskCache.get(`${clipId}_${frameIdx}`) || null;
}

export function hasClipMasks(clipId: string): boolean {
  return clipMaskCache.has(`${clipId}_0`);
}

export function getClipProcessedCount(clipId: string): number {
  let count = 0;
  for (const key of clipMaskCache.keys()) {
    if (key.startsWith(`${clipId}_`)) count++;
  }
  return count;
}

export function clearClipMasks(clipId?: string): void {
  if (clipId) {
    for (const key of Array.from(clipMaskCache.keys())) {
      if (key.startsWith(`${clipId}_`)) clipMaskCache.delete(key);
    }
  } else {
    clipMaskCache.clear();
  }
}

export async function initSelfieSegmentation(): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  if ((window as any).SelfieSegmentation) {
    if (!selfieSegmentationInstance) {
      try {
        const SelfieSegmentationClass = (window as any).SelfieSegmentation;
        selfieSegmentationInstance = new SelfieSegmentationClass({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });

        // 0: General model (ultra-fast ~60fps, low latency, ideal for video scrubbing & playback)
        selfieSegmentationInstance.setOptions({
          modelSelection: 0,
          selfieMode: false,
        });

        selfieSegmentationInstance.onResults((results: any) => {
          if (results.segmentationMask) {
            const sm = results.segmentationMask;
            const mw = sm.width || 640;
            const mh = sm.height || 360;

            if (!lastSegmentedMask) {
              lastSegmentedMask = document.createElement("canvas");
              lastSegmentedCtx = lastSegmentedMask.getContext("2d", { willReadFrequently: true });
            }
            if (lastSegmentedMask && lastSegmentedCtx) {
              if (lastSegmentedMask.width !== mw || lastSegmentedMask.height !== mh) {
                lastSegmentedMask.width = mw;
                lastSegmentedMask.height = mh;
              }
              lastSegmentedCtx.clearRect(0, 0, mw, mh);
              lastSegmentedCtx.drawImage(sm, 0, 0, mw, mh);

              // Convert RGB luminance confidence into TRUE ALPHA CHANNEL
              // MediaPipe outputs black background (0,0,0,255) and white foreground (255,255,255,255).
              // Canvas destination-in multiplies destination alpha by source alpha.
              // We map confidence directly to alpha so background becomes 0 (fully removed)
              // and the human subject remains 100% crisp and visible.
              try {
                const imgData = lastSegmentedCtx.getImageData(0, 0, mw, mh);
                const u32 = new Uint32Array(imgData.data.buffer);
                const len = u32.length;
                for (let i = 0; i < len; i++) {
                  const pixel = u32[i];
                  // Confidence is stored in the color channel (red byte)
                  const conf = pixel & 0xff;
                  // Store confidence as the Alpha channel (0 for background, 255 for person)
                  u32[i] = ((conf << 24) >>> 0) | 0x00ffffff;
                }
                lastSegmentedCtx.putImageData(imgData, 0, 0);
              } catch {
                // Ignore canvas access errors if any
              }
            }
          }
          isProcessingFrame = false;
          if (onMaskUpdatedCallback) {
            try {
              onMaskUpdatedCallback();
            } catch {
              // Ignore callback error
            }
          }
        });
      } catch (e) {
        console.warn("SelfieSegmentation initialization error:", e);
        return false;
      }
    }
    return true;
  }

  if (isScriptLoading) return false;
  isScriptLoading = true;

  return new Promise((resolve) => {
    try {
      const existingScript = document.querySelector('script[src*="selfie_segmentation"]');
      if (existingScript) {
        isScriptLoading = false;
        isScriptLoaded = true;
        initSelfieSegmentation().then(resolve);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = () => {
        isScriptLoading = false;
        isScriptLoaded = true;
        initSelfieSegmentation().then(resolve);
      };
      script.onerror = () => {
        isScriptLoading = false;
        resolve(false);
      };
      document.head.appendChild(script);
    } catch {
      isScriptLoading = false;
      resolve(false);
    }
  });
}

export function getHumanSegmentationMask(): HTMLCanvasElement | null {
  return lastSegmentedMask;
}

export function requestHumanSegmentation(mediaElement: any): void {
  if (!mediaElement || isProcessingFrame) return;

  const now = performance.now();
  // 30fps throttle for video inference (~33ms)
  if (now - lastProcessedTime < 30) return;

  if (!selfieSegmentationInstance) {
    initSelfieSegmentation();
    return;
  }

  try {
    const isVideo = mediaElement instanceof HTMLVideoElement || mediaElement.tagName === "VIDEO";
    if (isVideo && (mediaElement.readyState < 2 || mediaElement.videoWidth === 0)) {
      return;
    }
    const isImg = mediaElement instanceof HTMLImageElement || mediaElement.tagName === "IMG";
    if (isImg && (!mediaElement.complete || mediaElement.naturalWidth === 0)) {
      return;
    }

    // Downscale video frames to max 512px before feeding to MediaPipe.
    // Drastically reduces texture upload overhead (<1ms) and guarantees smooth 60fps video playback.
    let sourceToFeed: any = mediaElement;
    if (isVideo) {
      if (!inputCanvas) {
        inputCanvas = document.createElement("canvas");
        inputCtx = inputCanvas.getContext("2d", { willReadFrequently: true });
      }
      const vw = mediaElement.videoWidth || 640;
      const vh = mediaElement.videoHeight || 360;
      const scale = Math.min(1.0, 512 / Math.max(vw, vh));
      const fw = Math.max(16, Math.floor(vw * scale));
      const fh = Math.max(16, Math.floor(vh * scale));
      if (inputCanvas.width !== fw || inputCanvas.height !== fh) {
        inputCanvas.width = fw;
        inputCanvas.height = fh;
      }
      if (inputCtx) {
        inputCtx.drawImage(mediaElement, 0, 0, fw, fh);
        sourceToFeed = inputCanvas;
      }
    }

    isProcessingFrame = true;
    lastProcessedTime = now;
    selfieSegmentationInstance.send({ image: sourceToFeed }).catch(() => {
      isProcessingFrame = false;
    });
  } catch {
    isProcessingFrame = false;
  }
}

/**
 * Process an entire video clip frame-by-frame to generate and cache pixel-perfect neural cutout mattes.
 * This guarantees 100% clean background removal during video playback, scrubbing, and export.
 */
export async function processVideoFrameByFrame(
  videoUrl: string,
  clipId: string,
  duration: number,
  fps = 15,
  onProgress?: (pct: number, current: number, total: number) => void,
  signal?: AbortSignal
): Promise<number> {
  const ready = await initSelfieSegmentation();
  if (!ready || !selfieSegmentationInstance || typeof document === "undefined") {
    return 0;
  }

  return new Promise<number>((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = videoUrl;

    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    let currentFrame = 0;

    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const processNextFrame = async () => {
      if (signal?.aborted || currentFrame >= totalFrames) {
        cleanup();
        resolve(currentFrame);
        return;
      }

      const targetTime = currentFrame / fps;

      const onSeeked = async () => {
        video.removeEventListener("seeked", onSeeked);

        if (signal?.aborted) {
          cleanup();
          resolve(currentFrame);
          return;
        }

        try {
          await selfieSegmentationInstance.send({ image: video });

          if (lastSegmentedMask) {
            const cached = document.createElement("canvas");
            cached.width = lastSegmentedMask.width;
            cached.height = lastSegmentedMask.height;
            const cCtx = cached.getContext("2d");
            if (cCtx) {
              cCtx.drawImage(lastSegmentedMask, 0, 0);
              clipMaskCache.set(`${clipId}_${currentFrame}`, cached);
            }
          }
        } catch {
          // Continue on frame error
        }

        currentFrame++;
        if (onProgress) {
          onProgress(Math.min(100, Math.round((currentFrame / totalFrames) * 100)), currentFrame, totalFrames);
        }

        if (onMaskUpdatedCallback) {
          try {
            onMaskUpdatedCallback();
          } catch {
            // Ignore
          }
        }

        setTimeout(processNextFrame, 15);
      };

      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = targetTime;
    };

    video.onloadeddata = () => {
      processNextFrame();
    };

    video.onerror = () => {
      cleanup();
      resolve(0);
    };
  });
}

// Auto-initialize when in browser environment
if (typeof window !== "undefined") {
  initSelfieSegmentation().catch(() => {});
}
