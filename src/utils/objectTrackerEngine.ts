import { Platform } from 'react-native';
import { Buffer } from 'buffer';
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
import { getActiveVideoRenderer, setMotionTrackingActive } from './videoRenderer';

export interface TrackProgressInfo {
  percent: number;
  currentSec: number;
  totalSec: number;
  statusText: string;
}

export type TrackProgressCallback = (info: TrackProgressInfo) => void;

export interface TrackOptions {
  clip: any; // VideoClip | TextClip | StickerClip | CaptionClip
  sourceVideoClip?: VideoClip | null;
  project?: FastArtProject | null;
  targetRect: TrackingRect; // 0..100%
  aiTarget?: 'auto' | 'face' | 'body' | 'object'; // AI Subject Target Mode
  sampleFps?: number; // default 12-15 fps
  smoothness?: number; // 0..100
  trackScale?: boolean;
  trackRotation?: boolean;
  direction?: 'forward' | 'backward' | 'bidirectional';
  currentTime?: number;
  signal?: AbortSignal;
  onProgress?: TrackProgressCallback;
}

export interface FeatureKeypoint {
  x: number;
  y: number;
  score: number;
}

export interface OpticalFlowResult {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
  confidence: number;
  inliers: number;
}

/**
 * 1€ Adaptive Filter for silky-smooth jitter-free tracking
 * High-cutoff at low speeds prevents jitter; dynamic low-cutoff at high speeds eliminates lag
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  public reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  public filter(x: number, t: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = t;
      return x;
    }
    const dt = Math.max(1e-4, t - this.tPrev);
    this.tPrev = t;

    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(dt, this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(dt, cutoff);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }

  private alpha(dt: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }
}

/**
 * Constant-Velocity 2D Kalman Filter with Momentum Covariance
 * Coasting trajectory predictor through occlusions and rapid camera turns
 */
export class TrackingKalmanFilter {
  public x: number;
  public y: number;
  public vx = 0;
  public vy = 0;
  public scale: number;
  public vs = 0;
  private pX = 1.0;
  private pY = 1.0;
  private pS = 0.5;
  private readonly qPos = 0.05;
  private readonly qVel = 0.10;
  private readonly qScale = 0.02;

  constructor(initX: number, initY: number, initScale = 1.0) {
    this.x = initX;
    this.y = initY;
    this.scale = initScale;
  }

  public predict(dt: number = 1.0): { x: number; y: number; scale: number } {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.scale = Math.max(0.1, this.scale + this.vs * dt);
    this.pX += this.qPos * dt;
    this.pY += this.qPos * dt;
    this.pS += this.qScale * dt;
    return { x: this.x, y: this.y, scale: this.scale };
  }

  public update(measX: number, measY: number, measScale: number, confidence: number): void {
    const conf = Math.max(0.01, Math.min(1.0, confidence));
    const rPos = Math.max(0.05, (1.0 - conf) * 12.0);
    const rScale = Math.max(0.02, (1.0 - conf) * 4.0);

    const kX = this.pX / (this.pX + rPos);
    const kY = this.pY / (this.pY + rPos);
    const kS = this.pS / (this.pS + rScale);

    const resX = measX - this.x;
    const resY = measY - this.y;
    const resS = measScale - this.scale;

    this.x += kX * resX;
    this.y += kY * resY;
    this.scale = Math.max(0.15, this.scale + kS * resS);

    this.vx = this.vx * 0.7 + (kX * resX) * 0.3;
    this.vy = this.vy * 0.7 + (kY * resY) * 0.3;
    this.vs = this.vs * 0.7 + (kS * resS) * 0.3;

    this.pX = (1 - kX) * this.pX;
    this.pY = (1 - kY) * this.pY;
    this.pS = (1 - kS) * this.pS;
  }
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
  private static _cachedThumbnails: any = null;
  private static _cachedFS: any = null;
  private static _cachedJpegJs: any = null;

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
   * High-accuracy native frame sampler for React Native iOS/Android via expo-video-thumbnails + jpeg-js
   */
  private static async sampleNativeVideoFrame(
    uri: string,
    timeSec: number,
    renderW = 320,
    renderH = 180
  ): Promise<ImageData | null> {
    if (Platform.OS === 'web' || !uri) return null;
    try {
      if (!this._cachedThumbnails) {
        this._cachedThumbnails = await import('expo-video-thumbnails');
      }
      if (!this._cachedFS) {
        this._cachedFS = await import('expo-file-system/legacy').catch(() => import('expo-file-system'));
      }
      if (!this._cachedJpegJs) {
        this._cachedJpegJs = await import('jpeg-js');
      }

      const seekMs = Math.max(10, Math.round(timeSec * 1000));
      const thumb = await this._cachedThumbnails.getThumbnailAsync(uri, {
        time: seekMs,
        quality: 0.45,
      });
      if (!thumb?.uri) return null;

      const FS = this._cachedFS;
      const b64 = await FS.readAsStringAsync(thumb.uri, {
        encoding: FS.EncodingType?.Base64 || 'base64',
      });
      if (!b64) return null;

      const bytes = Buffer.from(b64, 'base64');
      const decoded = this._cachedJpegJs.decode(bytes, {
        useTArray: true,
        formatAsRGBA: true,
        maxMemoryUsageInMB: 64,
      });
      if (!decoded?.data || decoded.width <= 0 || decoded.height <= 0) return null;

      const srcData = decoded.data as Uint8Array;
      const sw = decoded.width;
      const sh = decoded.height;
      const outData = new Uint8ClampedArray(renderW * renderH * 4);

      for (let y = 0; y < renderH; y++) {
        const sy = Math.min(sh - 1, Math.floor((y / renderH) * sh));
        const outRow = y * renderW * 4;
        const srcRow = sy * sw * 4;
        for (let x = 0; x < renderW; x++) {
          const sx = Math.min(sw - 1, Math.floor((x / renderW) * sw));
          const outIdx = outRow + x * 4;
          const srcIdx = srcRow + sx * 4;
          outData[outIdx] = srcData[srcIdx];
          outData[outIdx + 1] = srcData[srcIdx + 1];
          outData[outIdx + 2] = srcData[srcIdx + 2];
          outData[outIdx + 3] = 255;
        }
      }

      return {
        data: outData,
        width: renderW,
        height: renderH,
        colorSpace: 'srgb',
      } as ImageData;
    } catch (e) {
      console.warn('[ObjectTrackerEngine] Native frame extraction warning:', e);
      return null;
    }
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

    // Clear any renderer pause lock on target media time so video seeks freely to sample frames
    delete (videoEl as any)._targetMediaTime;

    // If already at or very close to desired time and has frame data
    if (Math.abs(videoEl.currentTime - clampedTime) < 0.025 && videoEl.readyState >= 2) {
      try {
        ctx.clearRect(0, 0, renderW, renderH);
        ctx.drawImage(videoEl, 0, 0, renderW, renderH);
        return ctx.getImageData(0, 0, renderW, renderH);
      } catch (_) {
        return null;
      }
    }

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

      const onSeeked = () => {
        videoEl.removeEventListener('seeked', onSeeked);
        // Small 25ms tick allows the hardware video decoder / GPU compositor to commit the newly seeked texture
        setTimeout(finishCapture, 25);
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
      }, 350);
    });
  }

  /**
   * Samples a single frame at a specific timeline second for immediate AI target detection
   */
  public static async sampleCurrentFrame(
    clip: any,
    timeSec: number,
    renderW = 320,
    renderH = 180
  ): Promise<ImageData | null> {
    const effectiveUrl = clip?.url;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      let activeVid: HTMLVideoElement | null = null;
      if (clip?.id && globalActiveVideoElements.has(clip.id)) {
        activeVid = globalActiveVideoElements.get(clip.id) || null;
      }
      if (!activeVid && effectiveUrl && globalActiveVideoElements.has(effectiveUrl)) {
        activeVid = globalActiveVideoElements.get(effectiveUrl) || null;
      }
      if (!activeVid) {
        const vids = document.querySelectorAll('video');
        for (let i = 0; i < vids.length; i++) {
          if (vids[i].videoWidth > 0) {
            activeVid = vids[i];
            break;
          }
        }
      }
      if (activeVid) {
        return await this.sampleVideoFrame(activeVid, timeSec, renderW, renderH);
      }
    }
    if (effectiveUrl) {
      return await this.sampleNativeVideoFrame(effectiveUrl, timeSec, renderW, renderH);
    }
    return null;
  }

  /**
   * AI Subject Target Detection & Snapping
   * Auto-detects faces, human bodies, or high-salience objects in frame and returns tight bounding box in 0..100%
   */
  public static detectSubjectTarget(
    imgData: ImageData,
    mode: 'auto' | 'face' | 'body' | 'object' = 'auto',
    hintRect?: TrackingRect
  ): TrackingRect {
    const { width: fw, height: fh, data } = imgData;
    if (fw <= 0 || fh <= 0) {
      return hintRect || { x: 35, y: 25, width: 30, height: 30 };
    }

    const hx = hintRect ? (hintRect.x / 100) * fw : fw * 0.25;
    const hy = hintRect ? (hintRect.y / 100) * fh : fh * 0.2;
    const hw = hintRect ? (hintRect.width / 100) * fw : fw * 0.5;
    const hh = hintRect ? (hintRect.height / 100) * fh : fh * 0.6;

    const minSearchX = Math.max(0, Math.floor(hx - hw * 0.4));
    const maxSearchX = Math.min(fw - 1, Math.ceil(hx + hw * 1.4));
    const minSearchY = Math.max(0, Math.floor(hy - hh * 0.4));
    const maxSearchY = Math.min(fh - 1, Math.ceil(hy + hh * 1.4));

    // 1. Face Candidate Test (Skin Chrominance)
    if (mode === 'auto' || mode === 'face') {
      let skinCount = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = fw, maxX = 0, minY = fh, maxY = 0;

      for (let y = minSearchY; y <= maxSearchY; y += 2) {
        for (let x = minSearchX; x <= maxSearchX; x += 2) {
          const idx = (y * fw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const yLum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (yLum < 35 || yLum > 245) continue;
          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

          if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
            skinCount++;
            sumX += x;
            sumY += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (skinCount >= 18) {
        const cx = sumX / skinCount;
        const cy = sumY / skinCount;
        const spanX = Math.max(24, (maxX - minX) * 1.15);
        const spanY = Math.max(24, (maxY - minY) * 1.15);
        const faceSize = Math.max(spanX, spanY);
        const normX = Math.max(2, Math.min(98 - (faceSize / fw) * 100, ((cx - faceSize / 2) / fw) * 100));
        const normY = Math.max(2, Math.min(98 - (faceSize / fh) * 100, ((cy - faceSize / 2) / fh) * 100));
        const normDim = Math.max(12, Math.min(70, (faceSize / Math.min(fw, fh)) * 60));
        return {
          x: Number(normX.toFixed(1)),
          y: Number(normY.toFixed(1)),
          width: Number(normDim.toFixed(1)),
          height: Number(normDim.toFixed(1)),
        };
      }
    }

    // 2. Body / Silhouette Candidate Test
    if (mode === 'auto' || mode === 'body') {
      let fgCount = 0;
      let minX = fw, maxX = 0, minY = fh, maxY = 0;
      const refMeanLum = 128;

      for (let y = minSearchY; y <= maxSearchY; y += 2) {
        for (let x = minSearchX; x <= maxSearchX; x += 2) {
          const idx = (y * fw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);

          if (Math.abs(lum - refMeanLum) > 20 || sat > 25) {
            fgCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (fgCount >= 30) {
        const bw = Math.max(30, maxX - minX);
        const bh = Math.max(45, maxY - minY);
        const normX = Math.max(2, Math.min(98 - (bw / fw) * 100, (minX / fw) * 100));
        const normY = Math.max(2, Math.min(98 - (bh / fh) * 100, (minY / fh) * 100));
        const normW = Math.max(15, Math.min(80, (bw / fw) * 100));
        const normH = Math.max(20, Math.min(90, (bh / fh) * 100));
        return {
          x: Number(normX.toFixed(1)),
          y: Number(normY.toFixed(1)),
          width: Number(normW.toFixed(1)),
          height: Number(normH.toFixed(1)),
        };
      }
    }

    // 3. Salient Object Gradient Test
    if (mode === 'auto' || mode === 'object') {
      let minX = fw, maxX = 0, minY = fh, maxY = 0;
      let edgeCount = 0;

      for (let y = minSearchY + 1; y < maxSearchY - 1; y += 2) {
        const rowPrev = (y - 1) * fw * 4;
        const rowCurr = y * fw * 4;
        const rowNext = (y + 1) * fw * 4;
        for (let x = minSearchX + 1; x < maxSearchX - 1; x += 2) {
          const lumL = data[rowCurr + (x - 1) * 4];
          const lumR = data[rowCurr + (x + 1) * 4];
          const lumT = data[rowPrev + x * 4];
          const lumB = data[rowNext + x * 4];
          const grad = Math.abs(lumR - lumL) + Math.abs(lumB - lumT);

          if (grad > 55) {
            edgeCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (edgeCount >= 20) {
        const padX = (maxX - minX) * 0.15;
        const padY = (maxY - minY) * 0.15;
        const bx = Math.max(0, minX - padX);
        const by = Math.max(0, minY - padY);
        const bw = Math.min(fw - bx, (maxX - minX) + padX * 2);
        const bh = Math.min(fh - by, (maxY - minY) + padY * 2);

        return {
          x: Number(Math.max(2, (bx / fw) * 100).toFixed(1)),
          y: Number(Math.max(2, (by / fh) * 100).toFixed(1)),
          width: Number(Math.max(10, Math.min(85, (bw / fw) * 100)).toFixed(1)),
          height: Number(Math.max(10, Math.min(85, (bh / fh) * 100)).toFixed(1)),
        };
      }
    }

    return hintRect || { x: 35, y: 25, width: 30, height: 30 };
  }

  /**
   * Detects up to N strongest Shi-Tomasi feature keypoints inside ROI
   * Based on min eigenvalue of spatial structure tensor: min(lambda1, lambda2)
   */
  public static detectShiTomasiCorners(
    imgData: ImageData,
    roi: { x: number; y: number; w: number; h: number },
    maxCorners = 28,
    minDistance = 4
  ): FeatureKeypoint[] {
    const { width: fw, height: fh, data } = imgData;
    const rx = Math.max(2, Math.floor(roi.x));
    const ry = Math.max(2, Math.floor(roi.y));
    const rw = Math.max(8, Math.min(fw - rx - 2, Math.floor(roi.w)));
    const rh = Math.max(8, Math.min(fh - ry - 2, Math.floor(roi.h)));

    const candidates: FeatureKeypoint[] = [];

    for (let y = ry + 2; y < ry + rh - 2; y += 2) {
      for (let x = rx + 2; x < rx + rw - 2; x += 2) {
        let m00 = 0;
        let m11 = 0;
        let m01 = 0;

        for (let dy = -1; dy <= 1; dy++) {
          const cy = y + dy;
          const rPrev = cy * fw * 4;
          const rUp = (cy - 1) * fw * 4;
          const rDn = (cy + 1) * fw * 4;
          for (let dx = -1; dx <= 1; dx++) {
            const cx = x + dx;
            const ix = (data[rPrev + (cx + 1) * 4] - data[rPrev + (cx - 1) * 4]) * 0.5;
            const iy = (data[rDn + cx * 4] - data[rUp + cx * 4]) * 0.5;
            m00 += ix * ix;
            m11 += iy * iy;
            m01 += ix * iy;
          }
        }

        const trace = m00 + m11;
        const det = m00 * m11 - m01 * m01;
        const disc = Math.max(0, trace * trace - 4 * det);
        const lambdaMin = (trace - Math.sqrt(disc)) * 0.5;

        if (lambdaMin > 45) {
          candidates.push({ x, y, score: lambdaMin });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const selected: FeatureKeypoint[] = [];
    const minDistSq = minDistance * minDistance;

    for (const cand of candidates) {
      let tooClose = false;
      for (const sel of selected) {
        const dx = cand.x - sel.x;
        const dy = cand.y - sel.y;
        if (dx * dx + dy * dy < minDistSq) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        selected.push(cand);
        if (selected.length >= maxCorners) break;
      }
    }

    return selected;
  }

  /**
   * High-accuracy Pyramidal Lucas-Kanade Optical Flow with Forward-Backward Consistency
   */
  public static computePyramidalLucasKanadeOpticalFlow(
    prevImg: ImageData,
    currImg: ImageData,
    points: FeatureKeypoint[],
    windowRadius = 4,
    maxIter = 5
  ): OpticalFlowResult {
    if (points.length === 0) {
      return { dx: 0, dy: 0, scale: 1.0, rotation: 0, confidence: 0, inliers: 0 };
    }

    const fw = prevImg.width;
    const fh = prevImg.height;
    const prevData = prevImg.data;
    const currData = currImg.data;

    const validDisplacements: Array<{ dx: number; dy: number; pOrig: FeatureKeypoint }> = [];

    for (const pt of points) {
      // Level 1: Coarse Optical Flow Search (stride 2, window radius 6, covers up to ±36px motion)
      let coarseVx = 0;
      let coarseVy = 0;
      for (let iter = 0; iter < 4; iter++) {
        let a00 = 0, a11 = 0, a01 = 0;
        let b0 = 0, b1 = 0;

        for (let wy = -6; wy <= 6; wy += 2) {
          const py = Math.floor(pt.y + wy);
          const cy = Math.floor(pt.y + coarseVy + wy);
          if (py < 2 || py >= fh - 2 || cy < 2 || cy >= fh - 2) continue;

          for (let wx = -6; wx <= 6; wx += 2) {
            const px = Math.floor(pt.x + wx);
            const cx = Math.floor(pt.x + coarseVx + wx);
            if (px < 2 || px >= fw - 2 || cx < 2 || cx >= fw - 2) continue;

            const idxPrev = (py * fw + px) * 4;
            const idxCurr = (cy * fw + cx) * 4;

            const lumPrev = 0.2126 * prevData[idxPrev] + 0.7152 * prevData[idxPrev + 1] + 0.0722 * prevData[idxPrev + 2];
            const lumCurr = 0.2126 * currData[idxCurr] + 0.7152 * currData[idxCurr + 1] + 0.0722 * currData[idxCurr + 2];

            const ix = (0.2126 * prevData[idxPrev + 8] - 0.2126 * prevData[idxPrev - 8]) * 0.25;
            const iy = (0.2126 * prevData[(py + 2) * fw * 4 + px * 4] - 0.2126 * prevData[(py - 2) * fw * 4 + px * 4]) * 0.25;
            const it = lumCurr - lumPrev;

            a00 += ix * ix;
            a11 += iy * iy;
            a01 += ix * iy;
            b0 += ix * it;
            b1 += iy * it;
          }
        }

        const det = a00 * a11 - a01 * a01;
        if (Math.abs(det) < 1e-4) break;

        const dvx = -(a11 * b0 - a01 * b1) / det;
        const dvy = -(a00 * b1 - a01 * b0) / det;

        coarseVx += Math.max(-10, Math.min(10, dvx));
        coarseVy += Math.max(-10, Math.min(10, dvy));
        if (dvx * dvx + dvy * dvy < 0.05) break;
      }

      // Level 0: Fine Sub-pixel Lucas-Kanade (initialized from coarse displacement)
      let vx = coarseVx;
      let vy = coarseVy;

      for (let iter = 0; iter < maxIter; iter++) {
        let a00 = 0, a11 = 0, a01 = 0;
        let b0 = 0, b1 = 0;

        for (let wy = -windowRadius; wy <= windowRadius; wy++) {
          const py = Math.floor(pt.y + wy);
          const cy = Math.floor(pt.y + vy + wy);
          if (py < 1 || py >= fh - 1 || cy < 1 || cy >= fh - 1) continue;

          for (let wx = -windowRadius; wx <= windowRadius; wx++) {
            const px = Math.floor(pt.x + wx);
            const cx = Math.floor(pt.x + vx + wx);
            if (px < 1 || px >= fw - 1 || cx < 1 || cx >= fw - 1) continue;

            const idxPrev = (py * fw + px) * 4;
            const idxCurr = (cy * fw + cx) * 4;

            const lumPrev = 0.2126 * prevData[idxPrev] + 0.7152 * prevData[idxPrev + 1] + 0.0722 * prevData[idxPrev + 2];
            const lumCurr = 0.2126 * currData[idxCurr] + 0.7152 * currData[idxCurr + 1] + 0.0722 * currData[idxCurr + 2];

            const ix = (0.2126 * prevData[idxPrev + 4] - 0.2126 * prevData[idxPrev - 4]) * 0.5;
            const iy = (0.2126 * prevData[(py + 1) * fw * 4 + px * 4] - 0.2126 * prevData[(py - 1) * fw * 4 + px * 4]) * 0.5;
            const it = lumCurr - lumPrev;

            a00 += ix * ix;
            a11 += iy * iy;
            a01 += ix * iy;
            b0 += ix * it;
            b1 += iy * it;
          }
        }

        const det = a00 * a11 - a01 * a01;
        if (Math.abs(det) < 1e-4) break;

        const dvx = -(a11 * b0 - a01 * b1) / det;
        const dvy = -(a00 * b1 - a01 * b0) / det;

        vx += dvx;
        vy += dvy;
        if (dvx * dvx + dvy * dvy < 0.02) break;
      }

      // Backward Consistency Check (roundtrip error)
      let backVx = 0;
      let backVy = 0;
      const targetX = pt.x + vx;
      const targetY = pt.y + vy;

      for (let iter = 0; iter < 3; iter++) {
        let a00 = 0, a11 = 0, a01 = 0;
        let b0 = 0, b1 = 0;

        for (let wy = -windowRadius; wy <= windowRadius; wy++) {
          const cy = Math.floor(targetY + wy);
          const py = Math.floor(targetY + backVy + wy);
          if (cy < 1 || cy >= fh - 1 || py < 1 || py >= fh - 1) continue;

          for (let wx = -windowRadius; wx <= windowRadius; wx++) {
            const cx = Math.floor(targetX + wx);
            const px = Math.floor(targetX + backVx + wx);
            if (cx < 1 || cx >= fw - 1 || px < 1 || px >= fw - 1) continue;

            const idxCurr = (cy * fw + cx) * 4;
            const idxPrev = (py * fw + px) * 4;

            const lumCurr = 0.2126 * currData[idxCurr] + 0.7152 * currData[idxCurr + 1] + 0.0722 * currData[idxCurr + 2];
            const lumPrev = 0.2126 * prevData[idxPrev] + 0.7152 * prevData[idxPrev + 1] + 0.0722 * prevData[idxPrev + 2];

            const ix = (0.2126 * currData[idxCurr + 4] - 0.2126 * currData[idxCurr - 4]) * 0.5;
            const iy = (0.2126 * currData[(cy + 1) * fw * 4 + cx * 4] - 0.2126 * currData[(cy - 1) * fw * 4 + cx * 4]) * 0.5;
            const it = lumPrev - lumCurr;

            a00 += ix * ix;
            a11 += iy * iy;
            a01 += ix * iy;
            b0 += ix * it;
            b1 += iy * it;
          }
        }

        const det = a00 * a11 - a01 * a01;
        if (Math.abs(det) < 1e-4) break;

        const dvx = -(a11 * b0 - a01 * b1) / det;
        const dvy = -(a00 * b1 - a01 * b0) / det;
        backVx += dvx;
        backVy += dvy;
        if (dvx * dvx + dvy * dvy < 0.02) break;
      }

      // Check distance between original point and backwards-tracked point
      const roundtripError = Math.hypot(vx + backVx, vy + backVy);
      if (roundtripError < 3.5 && Math.hypot(vx, vy) < 65) {
        validDisplacements.push({ dx: vx, dy: vy, pOrig: pt });
      }
    }

    if (validDisplacements.length === 0) {
      return { dx: 0, dy: 0, scale: 1.0, rotation: 0, confidence: 0, inliers: 0 };
    }

    // Median inlier displacement
    const dxs = validDisplacements.map((v) => v.dx).sort((a, b) => a - b);
    const dys = validDisplacements.map((v) => v.dy).sort((a, b) => a - b);
    const medDx = dxs[Math.floor(dxs.length / 2)];
    const medDy = dys[Math.floor(dys.length / 2)];

    // Median scale ratio from pairwise distance comparisons
    let scaleRatio = 1.0;
    if (validDisplacements.length >= 4) {
      const scaleRatios: number[] = [];
      const n = validDisplacements.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < Math.min(n, i + 5); j++) {
          const p1 = validDisplacements[i].pOrig;
          const p2 = validDisplacements[j].pOrig;
          const origDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (origDist > 8) {
            const currDist = Math.hypot(
              (p2.x + validDisplacements[j].dx) - (p1.x + validDisplacements[i].dx),
              (p2.y + validDisplacements[j].dy) - (p1.y + validDisplacements[i].dy)
            );
            scaleRatios.push(currDist / origDist);
          }
        }
      }
      if (scaleRatios.length > 0) {
        scaleRatios.sort((a, b) => a - b);
        scaleRatio = Math.max(0.6, Math.min(1.8, scaleRatios[Math.floor(scaleRatios.length / 2)]));
      }
    }

    const inliersRatio = validDisplacements.length / Math.max(1, points.length);
    const confidence = Math.max(0.2, Math.min(1.0, inliersRatio * 1.25));

    return {
      dx: medDx,
      dy: medDy,
      scale: scaleRatio,
      rotation: 0,
      confidence,
      inliers: validDisplacements.length,
    };
  }

  /**
   * Extracts a normalized grayscale template patch from frame image data with Bilinear anti-aliasing
   */
  private static extractPatch(
    imgData: ImageData,
    rect: { x: number; y: number; w: number; h: number },
    targetDim = 32,
    intoBuffer?: Float32Array
  ): TemplatePatch | null {
    const { width: fw, height: fh, data } = imgData;
    const rx = Math.max(0, Math.min(fw - 2, rect.x));
    const ry = Math.max(0, Math.min(fh - 2, rect.y));
    const rw = Math.max(4, Math.min(fw - rx, rect.w));
    const rh = Math.max(4, Math.min(fh - ry, rect.h));

    const patch = intoBuffer || new Float32Array(targetDim * targetDim);
    let sum = 0;
    let sumSq = 0;

    // High quality Bilinear sampling for continuous, anti-aliased subpixel template matching
    const invDim = 1.0 / targetDim;
    for (let py = 0; py < targetDim; py++) {
      const srcY = ry + (py + 0.5) * invDim * rh;
      const y0 = Math.max(0, Math.min(fh - 1, Math.floor(srcY)));
      const y1 = Math.max(0, Math.min(fh - 1, y0 + 1));
      const wy1 = srcY - y0;
      const wy0 = 1.0 - wy1;

      for (let px = 0; px < targetDim; px++) {
        const srcX = rx + (px + 0.5) * invDim * rw;
        const x0 = Math.max(0, Math.min(fw - 1, Math.floor(srcX)));
        const x1 = Math.max(0, Math.min(fw - 1, x0 + 1));
        const wx1 = srcX - x0;
        const wx0 = 1.0 - wx1;

        const idx00 = (y0 * fw + x0) * 4;
        const idx10 = (y0 * fw + x1) * 4;
        const idx01 = (y1 * fw + x0) * 4;
        const idx11 = (y1 * fw + x1) * 4;

        const lum00 = 0.2126 * data[idx00] + 0.7152 * data[idx00 + 1] + 0.0722 * data[idx00 + 2];
        const lum10 = 0.2126 * data[idx10] + 0.7152 * data[idx10 + 1] + 0.0722 * data[idx10 + 2];
        const lum01 = 0.2126 * data[idx01] + 0.7152 * data[idx01 + 1] + 0.0722 * data[idx01 + 2];
        const lum11 = 0.2126 * data[idx11] + 0.7152 * data[idx11 + 1] + 0.0722 * data[idx11 + 2];

        const top = lum00 * wx0 + lum10 * wx1;
        const bot = lum01 * wx0 + lum11 * wx1;
        const lum = (top * wy0 + bot * wy1) / 255.0;

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
   * Fast Normalized Cross-Correlation (NCC) search within neighborhood with Coarse-to-Fine refinement
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
      2
    );
    if (rustRes && rustRes.confidence > 0.15) {
      return {
        x: rustRes.x,
        y: rustRes.y,
        scale: rustRes.scale,
        rotation: rustRes.rotation,
        confidence: Math.max(0, Math.min(1.0, rustRes.confidence)),
      };
    }

    // 2. High-Precision Coarse-to-Fine Search
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

    // Pass 1: Coarse search (stride 2)
    const coarseStep = 2;
    for (const sc of scales) {
      const bw = currentBox.w * sc;
      const bh = currentBox.h * sc;
      const halfW = bw / 2;
      const halfH = bh / 2;

      const minX = Math.max(halfW, center.x - searchRadius);
      const maxX = Math.min(fw - halfW, center.x + searchRadius);
      const minY = Math.max(halfH, center.y - searchRadius);
      const maxY = Math.min(fh - halfH, center.y + searchRadius);

      for (let sy = minY; sy <= maxY; sy += coarseStep) {
        for (let sx = minX; sx <= maxX; sx += coarseStep) {
          const candidate = this.extractPatch(
            imgData,
            { x: sx - halfW, y: sy - halfH, w: bw, h: bh },
            template.width,
            this.patchScratch
          );
          if (!candidate) continue;

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

    // Pass 2: Fine Sub-pixel refinement (stride 1 in 4x4 window around peak)
    if (bestScore > 0.25) {
      const fineRadius = 3;
      const bw = currentBox.w * bestScale;
      const bh = currentBox.h * bestScale;
      const halfW = bw / 2;
      const halfH = bh / 2;

      const fMinX = Math.max(halfW, bestX - fineRadius);
      const fMaxX = Math.min(fw - halfW, bestX + fineRadius);
      const fMinY = Math.max(halfH, bestY - fineRadius);
      const fMaxY = Math.min(fh - halfH, bestY + fineRadius);

      for (let sy = fMinY; sy <= fMaxY; sy += 1) {
        for (let sx = fMinX; sx <= fMaxX; sx += 1) {
          const candidate = this.extractPatch(
            imgData,
            { x: sx - halfW, y: sy - halfH, w: bw, h: bh },
            template.width,
            this.patchScratch
          );
          if (!candidate) continue;

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
      sourceVideoClip,
      project,
      targetRect,
      sampleFps = 4,
      smoothness = 75,
      trackScale = true,
      trackRotation = false,
      direction = 'bidirectional',
      currentTime: requestedTime,
      signal,
      onProgress,
    } = options;

    const clipStart = clip?.startTime ?? 0;
    const clipDur = Math.max(0.2, clip?.duration ?? 5);

    // Adaptive sparse keyframe sampling: 4 FPS (every 0.25s) is optimal for high-speed tracking
    // Trajectory is continuously interpolated at 60 FPS playback via cubic Hermite splines
    const effectiveFps = options.sampleFps ? Math.min(options.sampleFps, 5) : 4;
    const maxTrackFrames = 60;
    const totalFrames = Math.max(3, Math.min(maxTrackFrames, Math.floor(clipDur * effectiveFps)));
    const stepSec = clipDur / (totalFrames - 1);

    const anchorTimelineTime =
      requestedTime !== undefined && requestedTime >= clipStart && requestedTime <= clipStart + clipDur
        ? requestedTime
        : clipStart;
    const anchorIdx = Math.max(
      0,
      Math.min(totalFrames - 1, Math.round(((anchorTimelineTime - clipStart) / clipDur) * (totalFrames - 1)))
    );

    // Resolve which video clip is the background visual source
    let bgVideoClip: VideoClip | null = sourceVideoClip || null;
    if (!bgVideoClip && project?.tracks?.video) {
      bgVideoClip =
        project.tracks.video.find(
          (v) =>
            (v.trackIndex === 0 || !v.trackIndex) &&
            anchorTimelineTime >= v.startTime &&
            anchorTimelineTime < v.startTime + v.duration
        ) ||
        project.tracks.video.find(
          (v) => anchorTimelineTime >= v.startTime && anchorTimelineTime < v.startTime + v.duration
        ) ||
        project.tracks.video[0] ||
        null;
    }
    if (!bgVideoClip && clip?.url) {
      bgVideoClip = clip as VideoClip;
    }

    // Freeze player preview canvas so seeking happens silently in background without showing video playing
    setMotionTrackingActive(true);

    // Locate active video element in the DOM
    let activeVid: HTMLVideoElement | null = null;
    let freezeOverlay: HTMLCanvasElement | null = null;
    let originalTime = 0;
    const effectiveUrl = bgVideoClip?.url || clip?.url;

    const candidateUrls: string[] = [];
    const candidateIds: string[] = [];
    if (bgVideoClip) {
      if (bgVideoClip.url) candidateUrls.push(bgVideoClip.url);
      if (bgVideoClip.id) candidateIds.push(bgVideoClip.id);
      if ((bgVideoClip as any).largeMediaId) candidateIds.push((bgVideoClip as any).largeMediaId);
    }
    if (clip) {
      if (clip.url) candidateUrls.push(clip.url);
      if (clip.id) candidateIds.push(clip.id);
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        for (const url of candidateUrls) {
          if (globalActiveVideoElements.has(url)) {
            activeVid = globalActiveVideoElements.get(url) || null;
            if (activeVid && activeVid.videoWidth > 0) break;
          }
        }
        if (!activeVid) {
          for (const id of candidateIds) {
            if (globalActiveVideoElements.has(id)) {
              activeVid = globalActiveVideoElements.get(id) || null;
              if (activeVid && activeVid.videoWidth > 0) break;
            }
          }
        }
        if (!activeVid && bgVideoClip?.id) {
          const activeRenderer = getActiveVideoRenderer();
          if (activeRenderer) {
            activeVid =
              (activeRenderer.videoElements?.get(bgVideoClip.id) as HTMLVideoElement) ||
              ((activeRenderer as any).getVideoElement?.(bgVideoClip.id) as HTMLVideoElement) ||
              null;
          }
        }
        if (!activeVid) {
          const vids = document.querySelectorAll('video');
          for (let i = 0; i < vids.length; i++) {
            if (vids[i].videoWidth > 0) {
              activeVid = vids[i];
              break;
            }
          }
        }

        // Pause on-screen video elements so audio/video does not play
        const vids = document.querySelectorAll('video');
        vids.forEach((v) => {
          if (!v.paused) {
            try { v.pause(); } catch (_) {}
          }
        });

        // Place a static freeze-frame canvas overlay over the video element
        // This ensures the user sees a calm, frozen preview while seeking happens silently underneath
        if (activeVid && activeVid.videoWidth > 0) {
          originalTime = activeVid.currentTime;
          delete (activeVid as any)._targetMediaTime;
          freezeOverlay = document.createElement('canvas');
          freezeOverlay.width = activeVid.videoWidth;
          freezeOverlay.height = activeVid.videoHeight;
          const fCtx = freezeOverlay.getContext('2d');
          if (fCtx) {
            fCtx.drawImage(activeVid, 0, 0, freezeOverlay.width, freezeOverlay.height);
            freezeOverlay.style.position = 'absolute';
            freezeOverlay.style.top = '0';
            freezeOverlay.style.left = '0';
            freezeOverlay.style.width = '100%';
            freezeOverlay.style.height = '100%';
            freezeOverlay.style.objectFit = 'contain';
            freezeOverlay.style.pointerEvents = 'none';
            freezeOverlay.style.zIndex = '999';
            activeVid.parentElement?.appendChild(freezeOverlay);
          }
        }
      } catch (err) {
        console.warn('[ObjectTrackerEngine] Background freeze overlay error:', err);
      }
    }

    const renderW = 320;
    const renderH = 180;

    // Convert targetRect (0..100%) to pixel space
    const boxW = Math.max(16, (targetRect.width / 100) * renderW);
    const boxH = Math.max(16, (targetRect.height / 100) * renderH);
    const initialCenterNormX = targetRect.x + targetRect.width / 2;
    const initialCenterNormY = targetRect.y + targetRect.height / 2;
    const initialPixelX = (initialCenterNormX / 100) * renderW;
    const initialPixelY = (initialCenterNormY / 100) * renderH;

    // Damping factor from smoothness (0..100)
    const alpha = 0.85 - (smoothness / 100) * 0.70;

    const getSourceSecForTime = (timeSec: number): number => {
      let v = bgVideoClip;
      if (project?.tracks?.video) {
        const match = project.tracks.video.find(
          (c) =>
            (c.trackIndex === 0 || !c.trackIndex) &&
            timeSec >= c.startTime &&
            timeSec < c.startTime + c.duration
        );
        if (match) v = match;
      }
      if (!v) {
        const rel = Math.max(0, timeSec - clipStart);
        return Math.max(0, (clip?.trimIn || 0) + rel * (clip?.speed || 1.0));
      }
      const relTime = Math.max(0, timeSec - v.startTime);
      const spd = v.speed || 1.0;
      return v.reverse
        ? Math.max(0, (v.trimOut || v.duration) - relTime * spd)
        : Math.max(0, (v.trimIn || 0) + relTime * spd);
    };

    const recomputeMeanStd = (t: TemplatePatch) => {
      let sum = 0;
      const len = t.data.length;
      for (let i = 0; i < len; i++) sum += t.data[i];
      const mean = sum / len;
      let varSum = 0;
      for (let i = 0; i < len; i++) {
        const diff = t.data[i] - mean;
        varSum += diff * diff;
      }
      t.mean = mean;
      t.std = Math.max(1e-4, Math.sqrt(varSum / len));
    };

    const trajectory: TrajectoryPoint[] = new Array(totalFrames);

    try {
      // Unified high-precision frame fetcher (web activeVid OR native mobile via expo-video-thumbnails)
      const fetchFrameAtTime = async (timeSec: number): Promise<ImageData | null> => {
        const sourceSec = getSourceSecForTime(timeSec);
        if (Platform.OS === 'web' && activeVid) {
          return await this.sampleVideoFrame(activeVid, sourceSec, renderW, renderH);
        } else if (effectiveUrl) {
          return await this.sampleNativeVideoFrame(effectiveUrl, sourceSec, renderW, renderH);
        }
        return null;
      };

      // Step 1: Sample frame at anchor time and extract initial anchor template
      let anchorFrameImg: ImageData | null = await fetchFrameAtTime(anchorTimelineTime);

      let initialTemplate: TemplatePatch | null = null;
      let initialAngle = 0;

      if (anchorFrameImg) {
        initialTemplate = this.extractPatch(
          anchorFrameImg,
          { x: initialPixelX - boxW / 2, y: initialPixelY - boxH / 2, w: boxW, h: boxH },
          32
        );
        if (initialTemplate) {
          initialAngle = initialTemplate.angle;
        }
      }

      let initialCorners: FeatureKeypoint[] = [];
      if (anchorFrameImg) {
        initialCorners = this.detectShiTomasiCorners(
          anchorFrameImg,
          { x: initialPixelX - boxW / 2, y: initialPixelY - boxH / 2, w: boxW, h: boxH },
          32
        );
      }

      trajectory[anchorIdx] = {
        time: anchorTimelineTime,
        x: initialCenterNormX,
        y: initialCenterNormY,
        scale: 1.0,
        rotation: 0,
        confidence: 1.0,
        boxWidth: targetRect.width,
        boxHeight: targetRect.height,
      };

      // Helper function to track a single step with Pyramidal Optical Flow + Kalman + 1€ Filter
      const processFrame = async (
        frameIdx: number,
        fTime: number,
        state: {
          currX: number;
          currY: number;
          currScale: number;
          currRot: number;
          velX: number;
          velY: number;
          template: TemplatePatch | null;
          corners: FeatureKeypoint[];
          prevFrameImg: ImageData | null;
          kalman: TrackingKalmanFilter;
          oneEuroX: OneEuroFilter;
          oneEuroY: OneEuroFilter;
          oneEuroScale: OneEuroFilter;
        }
      ) => {
        let frameImg: ImageData | null = await fetchFrameAtTime(fTime);

        // Kalman Prediction step (momentum extrapolation)
        const pred = state.kalman.predict(1.0);
        let trackedX = pred.x;
        let trackedY = pred.y;
        let matchedScale = pred.scale;
        let matchedRot = state.currRot;
        let conf = 0.80;
        let opticalFlowUsed = false;

        // 1. Pyramidal Lucas-Kanade Optical Flow (KLT) with Forward-Backward Consistency
        if (frameImg && state.prevFrameImg && state.corners.length >= 4) {
          const flow = this.computePyramidalLucasKanadeOpticalFlow(
            state.prevFrameImg,
            frameImg,
            state.corners,
            5,
            6
          );

          if (flow.inliers >= 4) {
            opticalFlowUsed = true;
            trackedX = state.currX + flow.dx;
            trackedY = state.currY + flow.dy;
            matchedScale = Math.max(0.3, Math.min(4.0, state.currScale * flow.scale));
            conf = flow.confidence;

            // Update tracked corners to new frame coordinates
            state.corners = state.corners
              .map((c) => ({ x: c.x + flow.dx, y: c.y + flow.dy, score: c.score }))
              .filter((c) => c.x >= 2 && c.x < renderW - 2 && c.y >= 2 && c.y < renderH - 2);

            // Re-seed keypoints if inlier density drops
            if (state.corners.length < 10) {
              const fresh = this.detectShiTomasiCorners(
                frameImg,
                {
                  x: trackedX - (boxW * matchedScale) / 2,
                  y: trackedY - (boxH * matchedScale) / 2,
                  w: boxW * matchedScale,
                  h: boxH * matchedScale,
                },
                24
              );
              state.corners = [...state.corners, ...fresh].slice(0, 32);
            }
          }
        }

        // 2. Multi-Scale Normalized Cross-Correlation (Template Matching) Cross-Verification
        if (frameImg && state.template && (!opticalFlowUsed || conf < 0.55)) {
          const scales = trackScale ? [0.94, 0.97, 1.0, 1.03, 1.06] : [1.0];
          const speedMagnitude = Math.sqrt(state.velX * state.velX + state.velY * state.velY);
          const searchRadius = Math.max(30, Math.min(100, boxW * 1.1 + speedMagnitude * 2));

          const match = this.searchTemplate(
            frameImg,
            state.template,
            { x: trackedX, y: trackedY },
            { w: boxW * state.currScale, h: boxH * state.currScale },
            searchRadius,
            scales
          );

          if (match.confidence > 0.28) {
            if (!opticalFlowUsed || match.confidence > conf) {
              trackedX = match.x;
              trackedY = match.y;
              matchedScale = Math.max(0.4, Math.min(3.0, state.currScale * match.scale));
              conf = Math.max(conf, match.confidence);
            }

            if (trackRotation) {
              let diffRot = match.rotation - initialAngle;
              while (diffRot > 180) diffRot -= 360;
              while (diffRot < -180) diffRot += 360;
              matchedRot = Math.max(-25, Math.min(25, diffRot));
            } else {
              matchedRot = 0;
            }

            // Adapt running template with ground-truth anchor blend to prevent drift
            if (match.confidence > 0.45) {
              const newPatch = this.extractPatch(
                frameImg,
                {
                  x: trackedX - (boxW * matchedScale) / 2,
                  y: trackedY - (boxH * matchedScale) / 2,
                  w: boxW * matchedScale,
                  h: boxH * matchedScale,
                },
                32
              );
              if (newPatch) {
                for (let i = 0; i < state.template.data.length; i++) {
                  const anchorVal = initialTemplate ? initialTemplate.data[i] : state.template.data[i];
                  state.template.data[i] =
                    state.template.data[i] * 0.88 + newPatch.data[i] * 0.08 + anchorVal * 0.04;
                }
                recomputeMeanStd(state.template);
              }
            }
          } else if (initialTemplate) {
            // Re-acquisition search with ground-truth template
            const reMatch = this.searchTemplate(
              frameImg,
              initialTemplate,
              { x: trackedX, y: trackedY },
              { w: boxW, h: boxH },
              searchRadius * 1.5,
              [0.95, 1.0, 1.05]
            );
            if (reMatch.confidence > 0.32) {
              trackedX = reMatch.x;
              trackedY = reMatch.y;
              conf = reMatch.confidence * 0.9;
            }
          }
        }

        // 3. Kalman Filter Measurement Fusion
        state.kalman.update(trackedX, trackedY, matchedScale, conf);
        trackedX = state.kalman.x;
        trackedY = state.kalman.y;
        matchedScale = state.kalman.scale;

        // 4. One-Euro Adaptive Low-Pass Filter
        const smoothedX = state.oneEuroX.filter(trackedX, fTime);
        const smoothedY = state.oneEuroY.filter(trackedY, fTime);
        const smoothedScale = state.oneEuroScale.filter(matchedScale, fTime);

        // Update kinematic state
        state.velX = smoothedX - state.currX;
        state.velY = smoothedY - state.currY;
        state.currX = smoothedX;
        state.currY = smoothedY;
        state.currScale = smoothedScale;
        state.currRot = state.currRot * (1 - alpha) + matchedRot * alpha;
        if (frameImg) {
          state.prevFrameImg = frameImg;
        }

        const normX = (state.currX / renderW) * 100;
        const normY = (state.currY / renderH) * 100;
        const normBW = ((boxW * state.currScale) / renderW) * 100;
        const normBH = ((boxH * state.currScale) / renderH) * 100;

        trajectory[frameIdx] = {
          time: fTime,
          x: Math.max(0, Math.min(100, normX)),
          y: Math.max(0, Math.min(100, normY)),
          scale: Math.max(0.2, Math.min(5.0, state.currScale)),
          rotation: state.currRot,
          confidence: conf,
          boxWidth: normBW,
          boxHeight: normBH,
        };
      };

      let framesCompleted = 1;

      // Forward Pass: anchorIdx + 1 -> totalFrames - 1
      if (anchorIdx < totalFrames - 1) {
        if (direction === 'backward') {
          for (let frameIdx = anchorIdx + 1; frameIdx < totalFrames; frameIdx++) {
            trajectory[frameIdx] = {
              ...trajectory[anchorIdx],
              time: clipStart + frameIdx * stepSec,
            };
          }
        } else {
          const forwardKalman = new TrackingKalmanFilter(initialPixelX, initialPixelY, 1.0);
          const oneEuroX = new OneEuroFilter(0.8, 0.007);
          const oneEuroY = new OneEuroFilter(0.8, 0.007);
          const oneEuroScale = new OneEuroFilter(0.8, 0.007);

          const forwardState = {
            currX: initialPixelX,
            currY: initialPixelY,
            currScale: 1.0,
            currRot: 0,
            velX: 0,
            velY: 0,
            template: initialTemplate ? { ...initialTemplate, data: new Float32Array(initialTemplate.data) } : null,
            corners: initialCorners.map((c) => ({ ...c })),
            prevFrameImg: anchorFrameImg,
            kalman: forwardKalman,
            oneEuroX,
            oneEuroY,
            oneEuroScale,
          };

          for (let frameIdx = anchorIdx + 1; frameIdx < totalFrames; frameIdx++) {
            if (signal && signal.aborted) break;
            const fTime = clipStart + frameIdx * stepSec;
            await processFrame(frameIdx, fTime, forwardState);

            framesCompleted++;
            const percent = Math.round((framesCompleted / totalFrames) * 100);
            if (onProgress) {
              onProgress({
                percent,
                currentSec: fTime - clipStart,
                totalSec: clipDur,
                statusText: `Scanning Forward ${percent}%`,
              });
            }
            if (frameIdx % 3 === 0) {
              await new Promise((r) => setTimeout(r, 4));
            }
          }
        }
      }

      // Backward Pass: anchorIdx - 1 -> 0
      if (anchorIdx > 0) {
        if (direction === 'forward') {
          for (let frameIdx = anchorIdx - 1; frameIdx >= 0; frameIdx--) {
            trajectory[frameIdx] = {
              ...trajectory[anchorIdx],
              time: clipStart + frameIdx * stepSec,
            };
          }
        } else {
          const backwardKalman = new TrackingKalmanFilter(initialPixelX, initialPixelY, 1.0);
          const oneEuroX = new OneEuroFilter(0.8, 0.007);
          const oneEuroY = new OneEuroFilter(0.8, 0.007);
          const oneEuroScale = new OneEuroFilter(0.8, 0.007);

          const backwardState = {
            currX: initialPixelX,
            currY: initialPixelY,
            currScale: 1.0,
            currRot: 0,
            velX: 0,
            velY: 0,
            template: initialTemplate ? { ...initialTemplate, data: new Float32Array(initialTemplate.data) } : null,
            corners: initialCorners.map((c) => ({ ...c })),
            prevFrameImg: anchorFrameImg,
            kalman: backwardKalman,
            oneEuroX,
            oneEuroY,
            oneEuroScale,
          };

          for (let frameIdx = anchorIdx - 1; frameIdx >= 0; frameIdx--) {
            if (signal && signal.aborted) break;
            const fTime = clipStart + frameIdx * stepSec;
            await processFrame(frameIdx, fTime, backwardState);

            framesCompleted++;
            const percent = Math.round((framesCompleted / totalFrames) * 100);
            if (onProgress) {
              onProgress({
                percent,
                currentSec: fTime - clipStart,
                totalSec: clipDur,
                statusText: `Scanning Backward ${percent}%`,
              });
            }
            if (frameIdx % 3 === 0) {
              await new Promise((r) => setTimeout(r, 4));
            }
          }
        }
      }
    } finally {
      setMotionTrackingActive(false);
      // Remove freeze overlay and restore video element to anchor time (paused)
      if (freezeOverlay && freezeOverlay.parentElement) {
        try {
          freezeOverlay.parentElement.removeChild(freezeOverlay);
        } catch (_) {}
      }
      if (activeVid) {
        try {
          (activeVid as any)._targetMediaTime = originalTime;
          activeVid.currentTime = originalTime;
          activeVid.pause();
        } catch (_) {}
      }
      // Re-render clean frame now that tracking is done
      const activeRenderer = getActiveVideoRenderer();
      if (activeRenderer && project) {
        try {
          activeRenderer.renderFrame(
            project,
            anchorTimelineTime,
            false,
            undefined,
            undefined,
          );
        } catch (_) {}
      }
    }

    // Filter and sanitize trajectory points
    const finalTrajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < totalFrames; i++) {
      if (trajectory[i]) {
        finalTrajectory.push(trajectory[i]);
      }
    }

    // Sort trajectory chronologically
    finalTrajectory.sort((a, b) => a.time - b.time);
    return finalTrajectory;
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
    clipType: 'video' | 'text' | 'sticker' | 'caption' = 'text',
    anchorTime?: number
  ): KeyframePoint[] {
    if (!trajectory || trajectory.length === 0) return [];

    const keyframes: KeyframePoint[] = [];
    let origin = trajectory[0];
    if (anchorTime !== undefined && Number.isFinite(anchorTime)) {
      let bestDist = Infinity;
      for (let i = 0; i < trajectory.length; i++) {
        const dist = Math.abs(trajectory[i].time - anchorTime);
        if (dist < bestDist) {
          bestDist = dist;
          origin = trajectory[i];
        }
      }
    }
    const startTime = trajectory[0].time;
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
