/**
 * FastArt AI Human Segmentation Service (MediaPipe Selfie Segmentation)
 * Automatically isolates human persons/portraits from video & image backgrounds in real time.
 */

let isScriptLoading = false;
let isScriptLoaded = false;
let selfieSegmentationInstance: any = null;
let lastSegmentedMask: HTMLCanvasElement | null = null;
let lastSegmentedCtx: CanvasRenderingContext2D | null = null;
let isProcessingFrame = false;
let lastProcessedTime = 0;

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

        selfieSegmentationInstance.setOptions({
          modelSelection: 1, // 1: Landscape (higher accuracy for full human figure/portrait)
          selfieMode: false,
        });

        selfieSegmentationInstance.onResults((results: any) => {
          if (results.segmentationMask) {
            if (!lastSegmentedMask) {
              lastSegmentedMask = document.createElement("canvas");
              lastSegmentedCtx = lastSegmentedMask.getContext("2d", { willReadFrequently: true });
            }
            if (lastSegmentedMask && lastSegmentedCtx) {
              const mw = results.segmentationMask.width || 640;
              const mh = results.segmentationMask.height || 360;
              if (lastSegmentedMask.width !== mw || lastSegmentedMask.height !== mh) {
                lastSegmentedMask.width = mw;
                lastSegmentedMask.height = mh;
              }
              lastSegmentedCtx.clearRect(0, 0, mw, mh);
              lastSegmentedCtx.drawImage(results.segmentationMask, 0, 0);
            }
          }
          isProcessingFrame = false;
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
  // Throttle neural inference to ~25-30 fps for smooth, lightweight real-time playback
  if (now - lastProcessedTime < 33) return;

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

    isProcessingFrame = true;
    lastProcessedTime = now;
    selfieSegmentationInstance.send({ image: mediaElement }).catch(() => {
      isProcessingFrame = false;
    });
  } catch {
    isProcessingFrame = false;
  }
}
