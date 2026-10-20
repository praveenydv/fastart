// FastArt Real-time Canvas Rendering & Video Export Engine (TypeScript)
import { FastArtProject, VideoClip, TextClip, StickerClip, EffectClip } from '../types/project';

export interface ExportOptions {
  fps?: number;
  duration?: number;
}

export interface ExportResult {
  blob: Blob;
  videoUrl: string;
  mimeType: string;
}

export class VideoRenderer {
  public canvas: HTMLCanvasElement | null;
  public ctx: CanvasRenderingContext2D | null;
  public videoElements: Map<string, HTMLVideoElement | HTMLImageElement>;

  constructor(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.videoElements = new Map();
  }

  setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
  }

  // Preload and cache media elements
  async preloadClip(clip: VideoClip): Promise<HTMLVideoElement | HTMLImageElement | null> {
    if (typeof window === 'undefined') return null;
    if (this.videoElements.has(clip.url)) {
      return this.videoElements.get(clip.url)!;
    }

    if (clip.type === 'video') {
      const vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      vid.src = clip.url;
      this.videoElements.set(clip.url, vid);
      return vid;
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = clip.url;
      this.videoElements.set(clip.url, img);
      return img;
    }
  }

  // Render a specific timestamp frame
  renderFrame(project: FastArtProject, time: number, targetWidth = 1080, targetHeight = 1920) {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear background
    ctx.fillStyle = '#0B0D13';
    ctx.fillRect(0, 0, w, h);

    const videoClips = project.tracks.video || [];
    let activeClip: VideoClip | null = null;
    let nextClip: VideoClip | null = null;

    for (let i = 0; i < videoClips.length; i++) {
      const c = videoClips[i];
      const start = c.startTime;
      const end = c.startTime + c.duration;
      if (time >= start && time <= end) {
        activeClip = c;
        if (i < videoClips.length - 1) {
          nextClip = videoClips[i + 1];
        }
        break;
      }
    }

    // 1. Draw Active Video Clip Frame
    if (activeClip) {
      this.drawClip(ctx, activeClip, time, w, h, nextClip);
    } else if (videoClips.length > 0) {
      this.drawProceduralPlaceholder(ctx, w, h, 'FastArt Video Engine', time);
    } else {
      this.drawProceduralPlaceholder(ctx, w, h, 'No Media Added', time);
    }

    // 2. Draw Active Effects
    const effects = project.tracks.effects || [];
    effects.forEach((eff) => {
      if (time >= eff.startTime && time <= eff.startTime + eff.duration) {
        this.applyEffectOverlay(ctx, eff, time, w, h);
      }
    });

    // 3. Draw Active Stickers
    const stickers = project.tracks.stickers || [];
    stickers.forEach((stk) => {
      if (time >= stk.startTime && time <= stk.startTime + stk.duration) {
        this.drawSticker(ctx, stk, time, w, h);
      }
    });

    // 4. Draw Active Text Overlays
    const texts = project.tracks.text || [];
    texts.forEach((txt) => {
      if (time >= txt.startTime && time <= txt.startTime + txt.duration) {
        this.drawTextOverlay(ctx, txt, time, w, h);
      }
    });
  }

  drawClip(
    ctx: CanvasRenderingContext2D,
    clip: VideoClip,
    time: number,
    w: number,
    h: number,
    nextClip: VideoClip | null
  ) {
    ctx.save();

    const clipLocalTime = time - clip.startTime;
    const timeLeft = clip.duration - clipLocalTime;
    const trans = clip.transition;
    let alpha = 1.0;
    let scaleModifier = 1.0;
    let xOffset = 0;

    if (trans && trans.duration > 0 && timeLeft <= trans.duration) {
      const progress = 1 - timeLeft / trans.duration;
      if (trans.type === 'dissolve') {
        alpha = 1 - progress;
      } else if (trans.type === 'zoom_in') {
        scaleModifier = 1 + progress * 0.4;
        alpha = 1 - progress * 0.5;
      } else if (trans.type === 'slide_left') {
        xOffset = -progress * w;
      } else if (trans.type === 'flash_white') {
        if (progress > 0.5) alpha = 1 - (progress - 0.5) * 2;
      }
    }

    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const t = clip.transform || { scale: 1, rotation: 0, x: 0, y: 0 };
    ctx.translate(w / 2 + t.x + xOffset, h / 2 + t.y);
    ctx.rotate(((t.rotation || 0) * Math.PI) / 180);
    ctx.scale((t.scale || 1) * scaleModifier, (t.scale || 1) * scaleModifier);

    this.applyColorFilter(ctx, clip.filter);

    const mediaEl = this.videoElements.get(clip.url);
    if (mediaEl && (mediaEl as any).readyState >= 2) {
      const mediaTime = (clip.trimIn || 0) + clipLocalTime * (clip.speed || 1.0);
      const vid = mediaEl as HTMLVideoElement;
      if (Math.abs(vid.currentTime - mediaTime) > 0.15) {
        vid.currentTime = mediaTime;
      }
      const mw = vid.videoWidth || (mediaEl as any).width || 1280;
      const mh = vid.videoHeight || (mediaEl as any).height || 720;
      const aspect = mw / mh;
      let dw = w;
      let dh = w / aspect;
      if (dh < h) {
        dh = h;
        dw = h * aspect;
      }
      ctx.drawImage(mediaEl, -dw / 2, -dh / 2, dw, dh);
    } else {
      this.drawProceduralVideoScene(ctx, clip, clipLocalTime, w, h);
    }

    ctx.restore();

    if (trans && trans.type === 'flash_white' && timeLeft <= trans.duration) {
      const p = 1 - timeLeft / trans.duration;
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(p * Math.PI)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  drawProceduralVideoScene(
    ctx: CanvasRenderingContext2D,
    clip: VideoClip,
    localTime: number,
    w: number,
    h: number
  ) {
    const dw = w;
    const dh = h;
    const left = -dw / 2;
    const top = -dh / 2;

    const grad = ctx.createLinearGradient(left, top, left + dw, top + dh);
    if (clip.filter === 'cyberpunk') {
      grad.addColorStop(0, '#0f0c29');
      grad.addColorStop(0.5, '#302b63');
      grad.addColorStop(1, '#24243e');
    } else if (clip.filter === 'teal_orange') {
      grad.addColorStop(0, '#005c53');
      grad.addColorStop(0.5, '#042940');
      grad.addColorStop(1, '#db5a42');
    } else if (clip.filter === 'warm_sunset') {
      grad.addColorStop(0, '#ff4e50');
      grad.addColorStop(1, '#f9d423');
    } else {
      grad.addColorStop(0, '#141e30');
      grad.addColorStop(1, '#243b55');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(left, top, dw, dh);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    const gridSize = 60;
    const offset = (localTime * 40) % gridSize;

    for (let x = left + offset; x < left + dw; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + dh);
      ctx.stroke();
    }

    const orbX = left + dw * 0.5 + Math.sin(localTime * 2.5) * 120;
    const orbY = top + dh * 0.45 + Math.cos(localTime * 1.8) * 80;
    const orbGrad = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, 180);
    orbGrad.addColorStop(0, 'rgba(0, 242, 254, 0.8)');
    orbGrad.addColorStop(0.5, 'rgba(79, 172, 254, 0.3)');
    orbGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 180, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(left + dw * 0.2, top + dh * 0.4, dw * 0.6, 120, 16);
    } else {
      ctx.rect(left + dw * 0.2, top + dh * 0.4, dw * 0.6, 120);
    }
    ctx.fill();

    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(clip.title || 'Clip', 0, 0);

    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`${localTime.toFixed(2)}s / ${(clip.duration || 0).toFixed(1)}s • ${clip.speed || 1}x`, 0, 30);
  }

  applyColorFilter(ctx: CanvasRenderingContext2D, filterId?: string) {
    if (filterId === 'teal_orange') {
      ctx.filter = 'contrast(1.2) saturate(1.3) hue-rotate(15deg)';
    } else if (filterId === 'vintage') {
      ctx.filter = 'sepia(0.35) contrast(0.95) brightness(1.05)';
    } else if (filterId === 'cyberpunk') {
      ctx.filter = 'hue-rotate(290deg) contrast(1.35) saturate(1.8)';
    } else if (filterId === 'noir') {
      ctx.filter = 'grayscale(1) contrast(1.4) brightness(0.9)';
    } else if (filterId === 'warm_sunset') {
      ctx.filter = 'sepia(0.25) saturate(1.4) brightness(1.05)';
    } else if (filterId === 'cold_moody') {
      ctx.filter = 'hue-rotate(180deg) saturate(0.8) contrast(1.15)';
    } else if (filterId === 'emerald') {
      ctx.filter = 'hue-rotate(90deg) saturate(1.2) contrast(1.1)';
    } else {
      ctx.filter = 'none';
    }
  }

  applyEffectOverlay(ctx: CanvasRenderingContext2D, eff: EffectClip, time: number, w: number, h: number) {
    if (!this.canvas) return;
    ctx.save();
    if (eff.type === 'glitch') {
      const sliceH = 20;
      for (let y = 0; y < h; y += sliceH * 2) {
        if (Math.random() > 0.4) {
          const shift = (Math.random() - 0.5) * 40 * (eff.intensity || 0.8);
          ctx.drawImage(this.canvas, 0, y, w, sliceH, shift, y, w, sliceH);
        }
      }
      ctx.fillStyle = 'rgba(255, 0, 80, 0.15)';
      ctx.fillRect(0, 0, w, h);
    } else if (eff.type === 'vhs') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 2);
      }
      const barY = ((time * 300) % h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(0, barY, w, 12);
      ctx.font = 'bold 18px Courier, monospace';
      ctx.fillStyle = '#00FF66';
      ctx.fillText(`PLAY ▶ SP 00:${Math.floor(time).toString().padStart(2, '0')}:${Math.floor((time % 1) * 30).toString().padStart(2, '0')}`, 30, h - 40);
    } else if (eff.type === 'rgb_split') {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(0, 242, 254, 0.25)';
      ctx.fillRect(5, 0, w, h);
      ctx.fillStyle = 'rgba(255, 0, 80, 0.25)';
      ctx.fillRect(-5, 0, w, h);
    } else if (eff.type === 'film_grain') {
      const numDots = 150;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let i = 0; i < numDots; i++) {
        const rx = Math.random() * w;
        const ry = Math.random() * h;
        ctx.fillRect(rx, ry, 2, 2);
      }
    }
    ctx.restore();
  }

  drawSticker(ctx: CanvasRenderingContext2D, stk: StickerClip, time: number, w: number, h: number) {
    ctx.save();
    const px = (stk.position?.x ?? 50) * (w / 100);
    const py = (stk.position?.y ?? 50) * (h / 100);
    const scale = stk.scale || 1.0;
    const rot = stk.rotation || 0;

    const bounce = Math.sin((time - stk.startTime) * 4) * 0.08;

    ctx.translate(px, py);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(scale + bounce, scale + bounce);
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stk.char || '🔥', 0, 0);
    ctx.restore();
  }

  drawTextOverlay(ctx: CanvasRenderingContext2D, txt: TextClip, time: number, w: number, h: number) {
    ctx.save();
    const px = (txt.position?.x ?? 50) * (w / 100);
    const py = (txt.position?.y ?? 50) * (h / 100);
    const elapsed = time - txt.startTime;
    let displayText = txt.text || '';
    let scale = txt.scale || 1.0;
    let alpha = 1.0;
    let yOffset = 0;

    if (txt.animation === 'typewriter') {
      const chars = Math.min(displayText.length, Math.floor(elapsed * 12));
      displayText = displayText.slice(0, chars);
    } else if (txt.animation === 'bounce') {
      if (elapsed < 0.4) {
        const p = elapsed / 0.4;
        scale = 0.5 + Math.sin(p * Math.PI) * 0.8;
      }
    } else if (txt.animation === 'fade') {
      if (elapsed < 0.5) alpha = elapsed / 0.5;
    } else if (txt.animation === 'slideUp') {
      if (elapsed < 0.4) {
        const p = elapsed / 0.4;
        yOffset = (1 - p) * 40;
      }
    }

    ctx.translate(px, py + yOffset);
    ctx.rotate(((txt.rotation || 0) * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const style = txt.style || {};
    const fontSize = style.fontSize || 24;
    const fontWeight = style.fontWeight || 'bold';
    ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(displayText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2;

    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      ctx.fillStyle = style.backgroundColor;
      const padX = style.paddingHorizontal || 14;
      const padY = style.paddingVertical || 8;
      const radius = style.borderRadius || 8;

      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(
          -textWidth / 2 - padX,
          -textHeight / 2 - padY,
          textWidth + padX * 2,
          textHeight + padY * 2,
          radius
        );
      } else {
        ctx.rect(
          -textWidth / 2 - padX,
          -textHeight / 2 - padY,
          textWidth + padX * 2,
          textHeight + padY * 2
        );
      }
      ctx.fill();

      if (style.borderColor && style.borderWidth) {
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = style.borderWidth;
        ctx.stroke();
      }
    }

    if (style.textShadowColor) {
      ctx.shadowColor = style.textShadowColor;
      ctx.shadowBlur = style.textShadowRadius || 10;
      ctx.shadowOffsetX = style.textShadowOffset?.width || 0;
      ctx.shadowOffsetY = style.textShadowOffset?.height || 0;
    }

    ctx.fillStyle = style.color || '#FFFFFF';
    ctx.fillText(displayText, 0, 0);

    ctx.restore();
  }

  drawProceduralPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, time: number) {
    ctx.fillStyle = '#10131A';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#252A36';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = '#6B7280';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, h / 2 - 10);

    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = '#4B5563';
    ctx.fillText('Tap + to add video clips or audio tracks', w / 2, h / 2 + 25);
  }

  async exportVideo(
    project: FastArtProject,
    options: ExportOptions = {},
    onProgress?: (percent: number, currentTime: number, duration: number) => void
  ): Promise<ExportResult> {
    if (typeof window === 'undefined' || !this.canvas) {
      throw new Error('Canvas export requires browser environment');
    }

    const { fps = 30, duration = 10.0 } = options;
    const totalFrames = Math.ceil(duration * fps);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const exportRenderer = new VideoRenderer(exportCanvas);

    const stream = (exportCanvas as any).captureStream(fps);
    const mimeType = (window as any).MediaRecorder?.isTypeSupported?.('video/mp4')
      ? 'video/mp4'
      : (window as any).MediaRecorder?.isTypeSupported?.('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recordedChunks: Blob[] = [];
    const mediaRecorder = new (window as any).MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8000000,
    });

    mediaRecorder.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    return new Promise(async (resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);
        resolve({ blob, videoUrl, mimeType });
      };

      mediaRecorder.onerror = (err: any) => reject(err);

      mediaRecorder.start();

      for (let frame = 0; frame < totalFrames; frame++) {
        const currentTime = frame / fps;
        exportRenderer.renderFrame(project, currentTime);

        if (onProgress) {
          const percent = Math.round((frame / totalFrames) * 100);
          onProgress(percent, currentTime, duration);
        }

        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      mediaRecorder.stop();
    });
  }
}
