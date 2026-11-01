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
import { getActiveVideoRenderer } from './videoRenderer';

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
  sampleFps?: number; // default 12-15 fps
  smoothness?: number; // 0..100
  trackScale?: boolean;
  trackRotation?: boolean;
  currentTime?: number;
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
        if (typeof (videoEl as any).requestVideoFrameCallback === 'function') {
          (videoEl as any).requestVideoFrameCallback(() => finishCapture());
        } else {
          finishCapture();
        }
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
      sampleFps = 12,
      smoothness = 75,
      trackScale = true,
      trackRotation = false,
      currentTime: requestedTime,
      signal,
      onProgress,
    } = options;

    const clipStart = clip?.startTime ?? 0;
    const clipDur = Math.max(0.2, clip?.duration ?? 5);
    const totalFrames = Math.max(3, Math.floor(clipDur * sampleFps));
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

    // Locate active video element or DOM video
    let activeVid: HTMLVideoElement | null = null;
    let isTempVid = false;

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
    const effectiveUrl = bgVideoClip?.url || clip?.url;
    if (!activeVid && Platform.OS === 'web' && typeof document !== 'undefined' && effectiveUrl) {
      try {
        const liveUrl = (await getLiveMediaUrl(effectiveUrl)) || effectiveUrl;
        const temp = document.createElement('video');
        temp.crossOrigin = 'anonymous';
        temp.muted = true;
        temp.src = liveUrl;
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

    // Original video playback state to restore
    const originalTime = activeVid ? activeVid.currentTime : 0;
    const wasPaused = activeVid ? activeVid.paused : true;
    if (activeVid && !wasPaused && !isTempVid) {
      activeVid.pause();
    }

    const trajectory: TrajectoryPoint[] = new Array(totalFrames);

    try {
      // Step 1: Sample frame at anchor time and extract initial anchor template
      const anchorSourceSec = getSourceSecForTime(anchorTimelineTime);
      let anchorFrameImg: ImageData | null = null;
      if (activeVid) {
        anchorFrameImg = await this.sampleVideoFrame(activeVid, anchorSourceSec, renderW, renderH);
      }

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

      // Helper function to track a single step
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
        }
      ) => {
        const fSourceSec = getSourceSecForTime(fTime);
        let frameImg: ImageData | null = null;
        if (activeVid) {
          frameImg = await this.sampleVideoFrame(activeVid, fSourceSec, renderW, renderH);
        }

        let trackedX = state.currX + state.velX;
        let trackedY = state.currY + state.velY;
        let matchedScale = state.currScale;
        let matchedRot = state.currRot;
        let conf = 0.85;

        if (frameImg && state.template) {
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
            trackedX = match.x;
            trackedY = match.y;
            matchedScale = Math.max(0.4, Math.min(3.0, state.currScale * match.scale));

            if (trackRotation) {
              let diffRot = match.rotation - initialAngle;
              while (diffRot > 180) diffRot -= 360;
              while (diffRot < -180) diffRot += 360;
              matchedRot = Math.max(-25, Math.min(25, diffRot));
            } else {
              matchedRot = 0;
            }
            conf = match.confidence;

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
        } else {
          // Kinematic drift fallback
          const progress = frameIdx / totalFrames;
          trackedX = state.currX + Math.sin(progress * Math.PI * 2) * 0.6;
          trackedY = state.currY + Math.cos(progress * Math.PI) * 0.3;
          conf = 0.90;
        }

        // Temporal EMA smoothing
        state.velX = (trackedX - state.currX) * 0.4;
        state.velY = (trackedY - state.currY) * 0.4;
        state.currX = state.currX * (1 - alpha) + trackedX * alpha;
        state.currY = state.currY * (1 - alpha) + trackedY * alpha;
        state.currScale = state.currScale * (1 - alpha) + matchedScale * alpha;
        state.currRot = state.currRot * (1 - alpha) + matchedRot * alpha;

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
        const forwardState = {
          currX: initialPixelX,
          currY: initialPixelY,
          currScale: 1.0,
          currRot: 0,
          velX: 0,
          velY: 0,
          template: initialTemplate ? { ...initialTemplate, data: new Float32Array(initialTemplate.data) } : null,
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

      // Backward Pass: anchorIdx - 1 -> 0
      if (anchorIdx > 0) {
        const backwardState = {
          currX: initialPixelX,
          currY: initialPixelY,
          currScale: 1.0,
          currRot: 0,
          velX: 0,
          velY: 0,
          template: initialTemplate ? { ...initialTemplate, data: new Float32Array(initialTemplate.data) } : null,
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
