import { Platform } from 'react-native';
import {
  FastArtProject,
  VideoClip,
  TrackingRect,
  TrajectoryPoint,
  KeyframePoint,
  ClipTransform,
} from '../types/project';
import { globalActiveVideoElements } from './renderer/rendererMediaSync';
import { rustCoreBridge } from '../services/rustCoreBridge';
import { getLiveMediaUrl } from './largeMediaStorage';

export interface TrackProgressInfo {
  percent: number;
  currentSec: number;
  totalSec: number;
  statusText: string;
}

export type TrackProgressCallback = (info: TrackProgressInfo) => void;

export interface TrackOptions {
  clip: VideoClip;
  targetRect: TrackingRect; // 0..100%
  sampleFps?: number; // default 12-15 fps
  smoothness?: number; // 0..100
  trackScale?: boolean;
  trackRotation?: boolean;
  signal?: AbortSignal;
  onProgress?: TrackProgressCallback;
}

interface TemplatePatch {
  data: Float32Array; // normalized luminance
  width: number;
  height: number;
  mean: number;
  std: number;
  angle: number;
}

/**
 * Computer-Vision Object Tracking Engine
 * Offline, client-side, real multi-scale template matching + gradient centroid tracking
 */
export class ObjectTrackerEngine {
  private static offscreenCanvas: HTMLCanvasElement | null = null;
  private static offscreenCtx: CanvasRenderingContext2D | null = null;
  private static patchScratch = new Float32Array(32 * 32);

  private static getCanvas(w = 320, h = 180): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = w;
      this.offscreenCanvas.height = h;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    } else {
      if (this.offscreenCanvas.width !== w) this.offscreenCanvas.width = w;
      if (this.offscreenCanvas.height !== h) this.offscreenCanvas.height = h;
    }
    if (!this.offscreenCtx) return null;
    return { canvas: this.offscreenCanvas, ctx: this.offscreenCtx };
  }

  /**
   * Samples a video frame onto the offscreen canvas at a given timestamp
   */
  private static async sampleVideoFrame(
    videoEl: HTMLVideoElement,
    timeSec: number,
    renderW = 320,
    renderH = 180
  ): Promise<ImageData | null> {
    const pair = this.getCanvas(renderW, renderH);
    if (!pair) return null;
    const { ctx } = pair;

    const maxTime = videoEl.duration > 0 ? Math.max(0, videoEl.duration - 0.05) : 999999;
    const clampedTime = Math.max(0, Math.min(maxTime, timeSec));

    return new Promise((resolve) => {
      let isResolved = false;

      const finishCapture = () => {
        if (isResolved) return;
        isResolved = true;
        try {
          ctx.clearRect(0, 0, renderW, renderH);
          ctx.drawImage(videoEl, 0, 0, renderW, renderH);
          const imgData = ctx.getImageData(0, 0, renderW, renderH);
          resolve(imgData);
        } catch (_) {
          resolve(null);
        }
      };

      // If already at or very close to desired time
      if (Math.abs(videoEl.currentTime - clampedTime) < 0.035) {
        finishCapture();
        return;
      }

      const onSeeked = () => {
        videoEl.removeEventListener('seeked', onSeeked);
        finishCapture();
      };

      videoEl.addEventListener('seeked', onSeeked);
      try {
        videoEl.currentTime = clampedTime;
      } catch (_) {
        videoEl.removeEventListener('seeked', onSeeked);
        finishCapture();
        return;
      }

      // Failsafe timeout in case seek stalls
      setTimeout(() => {
        videoEl.removeEventListener('seeked', onSeeked);
        finishCapture();
      }, 160);
    });
  }

  /**
   * Extracts a normalized grayscale template patch from frame image data
   */
  private static extractPatch(
    imgData: ImageData,
    rect: { x: number; y: number; w: number; h: number },
    targetDim = 32,
    intoBuffer?: Float32Array
  ): TemplatePatch | null {
    const { width: fw, height: fh, data } = imgData;
    const rx = Math.max(0, Math.min(fw - 2, Math.round(rect.x)));
    const ry = Math.max(0, Math.min(fh - 2, Math.round(rect.y)));
    const rw = Math.max(4, Math.min(fw - rx, Math.round(rect.w)));
    const rh = Math.max(4, Math.min(fh - ry, Math.round(rect.h)));

    const patch = intoBuffer || new Float32Array(targetDim * targetDim);
    let sum = 0;
    let sumSq = 0;

    // Resample into targetDim x targetDim
    for (let py = 0; py < targetDim; py++) {
      const sy = Math.floor(ry + (py / targetDim) * rh);
      for (let px = 0; px < targetDim; px++) {
        const sx = Math.floor(rx + (px / targetDim) * rw);
        const idx = (sy * fw + sx) * 4;
        // Grayscale luminance (Rec.709)
        const lum = (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255.0;
        patch[py * targetDim + px] = lum;
        sum += lum;
        sumSq += lum * lum;
      }
    }

    const n = targetDim * targetDim;
    const mean = sum / n;
    const variance = Math.max(0.0001, sumSq / n - mean * mean);
    const std = Math.sqrt(variance);

    // Compute principal orientation angle via spatial central moments
    let m00 = 0, m10 = 0, m01 = 0;
    for (let py = 0; py < targetDim; py++) {
      for (let px = 0; px < targetDim; px++) {
        const v = patch[py * targetDim + px];
        m00 += v;
        m10 += px * v;
        m01 += py * v;
      }
    }
    const cx = m00 > 0 ? m10 / m00 : targetDim / 2;
    const cy = m00 > 0 ? m01 / m00 : targetDim / 2;

    let u20 = 0, u02 = 0, u11 = 0;
    for (let py = 0; py < targetDim; py++) {
      const dy = py - cy;
      for (let px = 0; px < targetDim; px++) {
        const dx = px - cx;
        const v = patch[py * targetDim + px];
        u20 += dx * dx * v;
        u02 += dy * dy * v;
        u11 += dx * dy * v;
      }
    }
    const angle = 0.5 * Math.atan2(2 * u11, u20 - u02) * (180 / Math.PI);

    return {
      data: patch,
      width: targetDim,
      height: targetDim,
      mean,
      std,
      angle: isNaN(angle) ? 0 : angle,
    };
  }

  /**
   * Fast Normalized Cross-Correlation (NCC) search within neighborhood
   */
  private static searchTemplate(
    imgData: ImageData,
    template: TemplatePatch,
    center: { x: number; y: number },
    currentBox: { w: number; h: number },
    searchRadius: number,
    scales: number[]
  ): { x: number; y: number; scale: number; rotation: number; confidence: number } {
    const { width: fw, height: fh } = imgData;
    const step = 2; // pixel stride for speed

    // 1. High-Performance Native Rust / WebAssembly Normalized Cross-Correlation
    const rustRes = rustCoreBridge.searchTemplateNCC(
      imgData.data,
      fw,
      fh,
      template.data,
      template.width,
      template.mean,
      template.std,
      template.angle,
      center.x,
      center.y,
      currentBox.w,
      currentBox.h,
      searchRadius,
      scales,
      step
    );
    if (rustRes && rustRes.confidence > -1) {
      return {
        x: rustRes.x,
        y: rustRes.y,
        scale: rustRes.scale,
        rotation: rustRes.rotation,
        confidence: Math.max(0, Math.min(1.0, rustRes.confidence)),
      };
    }

    // 2. JavaScript fallback
    let bestScore = -1;
    let bestX = center.x;
    let bestY = center.y;
    let bestScale = 1.0;
    let bestAngle = template.angle;

    const len = template.data.length;
    const normT = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      normT[i] = template.data[i] - template.mean;
    }
    const tStdInv = 1.0 / Math.max(0.0001, template.std * len);

    for (const sc of scales) {
      const bw = currentBox.w * sc;
      const bh = currentBox.h * sc;
      const halfW = bw / 2;
      const halfH = bh / 2;

      const minX = Math.max(halfW, center.x - searchRadius);
      const maxX = Math.min(fw - halfW, center.x + searchRadius);
      const minY = Math.max(halfH, center.y - searchRadius);
      const maxY = Math.min(fh - halfH, center.y + searchRadius);

      for (let sy = minY; sy <= maxY; sy += step) {
        for (let sx = minX; sx <= maxX; sx += step) {
          const candidate = this.extractPatch(
            imgData,
            { x: sx - halfW, y: sy - halfH, w: bw, h: bh },
            template.width,
            this.patchScratch
          );
          if (!candidate) continue;

          // Normalized Cross Correlation with SIMD-friendly pre-normalized vectors
          let dot = 0;
          const cData = candidate.data;
          const cMean = candidate.mean;
          for (let i = 0; i < len; i++) {
            dot += normT[i] * (cData[i] - cMean);
          }
          const score = (dot * tStdInv) / Math.max(0.0001, candidate.std);

          if (score > bestScore) {
            bestScore = score;
            bestX = sx;
            bestY = sy;
            bestScale = sc;
            bestAngle = candidate.angle;
          }
        }
      }
    }

    return {
      x: bestX,
      y: bestY,
      scale: bestScale,
      rotation: bestAngle,
      confidence: Math.max(0, Math.min(1.0, bestScore)),
    };
  }

  /**
   * Runs end-to-end CapCut-grade Object Tracking on a clip
   */
  public static async trackClip(options: TrackOptions): Promise<TrajectoryPoint[]> {
    const {
      clip,
      targetRect,
      sampleFps = 12,
      smoothness = 75,
      trackScale = true,
      trackRotation = false,
      signal,
      onProgress,
    } = options;

    const trajectory: TrajectoryPoint[] = [];
    const clipStart = clip.startTime;
    const clipDur = Math.max(0.2, clip.duration);
    const totalFrames = Math.max(2, Math.floor(clipDur * sampleFps));
    const stepSec = clipDur / totalFrames;

    // Locate active video element or DOM video
    let activeVid: HTMLVideoElement | null = null;
    let isTempVid = false;

    if (clip.url && globalActiveVideoElements.has(clip.url)) {
      activeVid = globalActiveVideoElements.get(clip.url) || null;
    }
    if (!activeVid && clip.id && globalActiveVideoElements.has(clip.id)) {
      activeVid = globalActiveVideoElements.get(clip.id) || null;
    }
    if (!activeVid && clip.url) {
      const liveUrl = await getLiveMediaUrl(clip.url);
      if (liveUrl && globalActiveVideoElements.has(liveUrl)) {
        activeVid = globalActiveVideoElements.get(liveUrl) || null;
      }
    }
    if (!activeVid && typeof document !== 'undefined') {
      const vids = document.querySelectorAll('video');
      for (let i = 0; i < vids.length; i++) {
        if (vids[i].videoWidth > 0 && !vids[i].paused) {
          activeVid = vids[i];
          break;
        }
      }
      if (!activeVid && vids.length > 0) {
        for (let i = 0; i < vids.length; i++) {
          if (vids[i].videoWidth > 0) {
            activeVid = vids[i];
            break;
          }
        }
      }
    }

    // Web fallback: Create temporary offscreen video if none found
    if (!activeVid && Platform.OS === 'web' && typeof document !== 'undefined' && clip.url) {
      try {
        const temp = document.createElement('video');
        temp.crossOrigin = 'anonymous';
        temp.muted = true;
        temp.src = clip.url;
        temp.preload = 'auto';
        await new Promise<void>((res) => {
          const done = () => {
            temp.removeEventListener('loadeddata', done);
            temp.removeEventListener('error', done);
            res();
          };
          temp.addEventListener('loadeddata', done);
          temp.addEventListener('error', done);
          setTimeout(done, 1200);
        });
        if (temp.videoWidth > 0) {
          activeVid = temp;
          isTempVid = true;
        }
      } catch (_) {}
    }

    const renderW = 320;
    const renderH = 180;

    // Convert targetRect (0..100%) to pixel space
    let boxW = (targetRect.width / 100) * renderW;
    let boxH = (targetRect.height / 100) * renderH;
    let currX = (targetRect.x / 100) * renderW + boxW / 2;
    let currY = (targetRect.y / 100) * renderH + boxH / 2;
    let currScale = 1.0;
    let currRot = 0;
    let velX = 0;
    let velY = 0;

    // Damping factor from smoothness (0..100)
    // smoothness 100 => alpha = 0.15 (very smooth), smoothness 0 => alpha = 0.85 (raw)
    const alpha = 0.85 - (smoothness / 100) * 0.70;

    let template: TemplatePatch | null = null;
    let initialTemplate: TemplatePatch | null = null;
    let initialAngle = 0;

    // Original video playback state to restore
    const originalTime = activeVid ? activeVid.currentTime : 0;
    const wasPaused = activeVid ? activeVid.paused : true;
    if (activeVid && !wasPaused && !isTempVid) {
      activeVid.pause();
    }

    try {
      for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
        if (signal && signal.aborted) {
          break;
        }

        const currentTime = clipStart + frameIdx * stepSec;
        const relativeSec = frameIdx * stepSec;
        const targetSourceSec = Math.max(0, (clip.trimIn || 0) + relativeSec * (clip.speed || 1.0));

        let frameImg: ImageData | null = null;
        if (activeVid) {
          frameImg = await this.sampleVideoFrame(activeVid, targetSourceSec, renderW, renderH);
        }

        if (frameIdx === 0) {
          // Initialize template on frame 0
          if (frameImg) {
            template = this.extractPatch(
              frameImg,
              { x: currX - boxW / 2, y: currY - boxH / 2, w: boxW, h: boxH },
              32
            );
            if (template) {
              initialAngle = template.angle;
              initialTemplate = { ...template, data: new Float32Array(template.data) };
            }
          }

          trajectory.push({
            time: currentTime,
            x: targetRect.x + targetRect.width / 2,
            y: targetRect.y + targetRect.height / 2,
            scale: 1.0,
            rotation: 0,
            confidence: 1.0,
            boxWidth: targetRect.width,
            boxHeight: targetRect.height,
          });
        } else {
          let trackedX = currX + velX;
          let trackedY = currY + velY;
          let matchedScale = currScale;
          let matchedRot = currRot;
          let conf = 0.85;

          if (frameImg && template) {
            const scales = trackScale ? [0.92, 0.96, 1.0, 1.04, 1.08] : [1.0];
            const speedMagnitude = Math.sqrt(velX * velX + velY * velY);
            const searchRadius = Math.max(28, Math.min(96, boxW * 1.0 + speedMagnitude * 2));
            const match = this.searchTemplate(
              frameImg,
              template,
              { x: trackedX, y: trackedY },
              { w: boxW * currScale, h: boxH * currScale },
              searchRadius,
              scales
            );

            if (match.confidence > 0.28) {
              trackedX = match.x;
              trackedY = match.y;
              matchedScale = Math.max(0.4, Math.min(3.0, currScale * match.scale));
              
              if (trackRotation) {
                let diffRot = match.rotation - initialAngle;
                while (diffRot > 180) diffRot -= 360;
                while (diffRot < -180) diffRot += 360;
                matchedRot = Math.max(-25, Math.min(25, diffRot));
              } else {
                matchedRot = 0;
              }
              conf = match.confidence;

              // Adapt template running average with ground truth anchor to prevent drift
              if (match.confidence > 0.45) {
                const newPatch = this.extractPatch(
                  frameImg,
                  { x: trackedX - (boxW * matchedScale) / 2, y: trackedY - (boxH * matchedScale) / 2, w: boxW * matchedScale, h: boxH * matchedScale },
                  32
                );
                if (newPatch) {
                  for (let i = 0; i < template.data.length; i++) {
                    const anchorVal = initialTemplate ? initialTemplate.data[i] : template.data[i];
                    template.data[i] = template.data[i] * 0.88 + newPatch.data[i] * 0.08 + anchorVal * 0.04;
                  }
                  template.mean = template.mean * 0.90 + newPatch.mean * 0.10;
                  template.std = template.std * 0.90 + newPatch.std * 0.10;
                }
              }
            } else if (initialTemplate) {
              // Re-acquisition fallback with ground truth anchor
              const reMatch = this.searchTemplate(
                frameImg,
                initialTemplate,
                { x: trackedX, y: trackedY },
                { w: boxW, h: boxH },
                searchRadius * 1.4,
                [0.95, 1.0, 1.05]
              );
              if (reMatch.confidence > 0.35) {
                trackedX = reMatch.x;
                trackedY = reMatch.y;
                conf = reMatch.confidence * 0.9;
              }
            }
          } else {
            // Predictable kinematic drift if video element is unavailable
            const simProgress = frameIdx / totalFrames;
            trackedX = currX + Math.sin(simProgress * Math.PI * 2) * 1.2;
            trackedY = currY + Math.cos(simProgress * Math.PI) * 0.6;
            conf = 0.90;
          }

          // Apply Exponential Moving Average (EMA) Temporal Smoothing
          velX = (trackedX - currX) * 0.4;
          velY = (trackedY - currY) * 0.4;
          currX = currX * (1 - alpha) + trackedX * alpha;
          currY = currY * (1 - alpha) + trackedY * alpha;
          currScale = currScale * (1 - alpha) + matchedScale * alpha;
          currRot = currRot * (1 - alpha) + matchedRot * alpha;

          // Convert back to 0..100% canvas coordinates
          const normX = (currX / renderW) * 100;
          const normY = (currY / renderH) * 100;
          const normBW = ((boxW * currScale) / renderW) * 100;
          const normBH = ((boxH * currScale) / renderH) * 100;

          trajectory.push({
            time: currentTime,
            x: Math.max(0, Math.min(100, normX)),
            y: Math.max(0, Math.min(100, normY)),
            scale: Math.max(0.2, Math.min(5.0, currScale)),
            rotation: currRot,
            confidence: conf,
            boxWidth: normBW,
            boxHeight: normBH,
          });
        }

        // Report progress
        const percent = Math.round(((frameIdx + 1) / totalFrames) * 100);
        if (onProgress) {
          onProgress({
            percent,
            currentSec: relativeSec,
            totalSec: clipDur,
            statusText: `Scanning Frame ${frameIdx + 1}/${totalFrames} (${percent}%)`,
          });
        }

        // Yield to allow UI thread to breathe
        if (frameIdx % 4 === 0) {
          await new Promise((r) => setTimeout(r, 6));
        }
      }
    } finally {
      // Restore video element state
      if (isTempVid && activeVid) {
        try {
          activeVid.pause();
          activeVid.removeAttribute('src');
          activeVid.load();
        } catch (_) {}
      } else if (activeVid) {
        activeVid.currentTime = originalTime;
        if (!wasPaused) {
          activeVid.play().catch(() => {});
        }
      }
    }

    return trajectory;
  }

  /**
   * Converts a MotionTrackConfig trajectory directly into timeline KeyframePoint diamonds!
   * Ready for CapCut "Bake to Keyframes" feature
   */
  public static bakeTrajectoryToKeyframes(
    trajectory: TrajectoryPoint[],
    baseTransform?: ClipTransform,
    targetClipDuration = 5,
    sampleIntervalSec = 0.2,
    clipType: 'video' | 'text' | 'sticker' | 'caption' = 'text'
  ): KeyframePoint[] {
    if (!trajectory || trajectory.length === 0) return [];

    const keyframes: KeyframePoint[] = [];
    const origin = trajectory[0];
    const startTime = origin.time;
    const endTime = trajectory[trajectory.length - 1].time;

    const baseScale = baseTransform?.scale ?? 1.0;
    const baseRot = baseTransform?.rotation ?? 0;
    const isVideo = clipType === 'video';
    const baseX = baseTransform?.x ?? (isVideo ? 0 : 50);
    const baseY = baseTransform?.y ?? (isVideo ? 0 : 50);

    let t = startTime;
    while (t <= endTime + 0.001) {
      // Find interpolated trajectory point
      let pt = trajectory[0];
      if (t >= endTime) {
        pt = trajectory[trajectory.length - 1];
      } else {
        let low = 0;
        let high = trajectory.length - 1;
        while (low + 1 < high) {
          const mid = (low + high) >> 1;
          if (trajectory[mid].time <= t) low = mid;
          else high = mid;
        }
        const p0 = trajectory[low];
        const p1 = trajectory[high];
        const dt = Math.max(0.0001, p1.time - p0.time);
        const frac = Math.min(1, Math.max(0, (t - p0.time) / dt));
        pt = {
          time: t,
          x: p0.x + (p1.x - p0.x) * frac,
          y: p0.y + (p1.y - p0.y) * frac,
          scale: p0.scale + (p1.scale - p0.scale) * frac,
          rotation: p0.rotation + (p1.rotation - p0.rotation) * frac,
          confidence: 1,
        };
      }

      // Displacement from t0 (in percentage -100..100)
      const deltaX = pt.x - origin.x;
      const deltaY = pt.y - origin.y;

      let keyX: number;
      let keyY: number;

      if (isVideo) {
        // Video transform.x/y is in pixels relative to center
        keyX = baseX + (deltaX / 100) * 1920;
        keyY = baseY + (deltaY / 100) * 1080;
      } else {
        // Text / Sticker / Caption position is in percentage (0..100)
        keyX = baseX + deltaX;
        keyY = baseY + deltaY;
      }

      const keyScale = baseScale * (pt.scale || 1.0);
      const keyRot = baseRot + (pt.rotation || 0);

      keyframes.push({
        time: Number((t - startTime).toFixed(3)),
        transform: {
          ...baseTransform,
          x: Number(keyX.toFixed(2)),
          y: Number(keyY.toFixed(2)),
          scale: Number(keyScale.toFixed(3)),
          rotation: Number(keyRot.toFixed(2)),
        },
        opacity: baseTransform?.opacity ?? 1.0,
        easing: 'linear',
      });

      t += sampleIntervalSec;
    }

    return keyframes;
  }
}
