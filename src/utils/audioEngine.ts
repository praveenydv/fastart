import { Platform } from 'react-native';

export type SfxType = 'whoosh' | 'split' | 'cut' | 'pop' | 'boom' | 'click';

class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private soundBuffers: Partial<Record<SfxType, AudioBuffer>> = {};
  private lastBeat: number = -1;
  private isEnabled: boolean = false; // Disabled by default
  private isInitialized: boolean = false;

  constructor() {
    this.setupAutoUnlock();
    // Disabled by default; initialize from saved settings on web if user explicitly enabled it
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem('@fastart_settings_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          this.isEnabled = parsed.soundEffects === true;
        } else {
          this.isEnabled = false;
        }
      } catch {
        this.isEnabled = false;
      }
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Initializes or returns the current AudioContext with lowest latency interactive mode
   */
  getAudioContext(): AudioContext | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
        } catch {
          this.audioCtx = new AudioCtx();
        }
        this.pregenerateBuffers();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Automatically warm up and unlock audio context on very first user interaction in the capture phase
   */
  private setupAutoUnlock() {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function'
    ) {
      return;
    }

    const unlock = () => {
      this.initAudio();
      // Once running, remove listeners
      if (this.audioCtx && this.audioCtx.state === 'running') {
        ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((evt) => {
          if (typeof window.removeEventListener === 'function') {
            window.removeEventListener(evt, unlock, true);
          }
        });
      }
    };

    ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, unlock, { passive: true, capture: true });
    });
  }

  /**
   * Force context initialization and resume
   */
  initAudio() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Pre-renders clean, smooth PCM waveforms into AudioBuffers so playback starts in 0 ms without harsh distortion
   */
  private pregenerateBuffers() {
    if (!this.audioCtx || this.isInitialized) return;
    this.isInitialized = true;
    const ctx = this.audioCtx;
    const sampleRate = ctx.sampleRate || 44100;

    try {
      // 1. Click: Soft, warm acoustic tap (22ms) - gentle felt-like contact without sharp high-frequency snap
      const clickLen = Math.floor(sampleRate * 0.022);
      const clickBuf = ctx.createBuffer(1, clickLen, sampleRate);
      const clickData = clickBuf.getChannelData(0);
      for (let i = 0; i < clickLen; i++) {
        const t = i / sampleRate;
        const p = i / clickLen;
        const freq = 320 - 110 * p;
        const env = Math.sin(p * Math.PI) * Math.exp(-p * 8.0);
        clickData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.12;
      }
      this.soundBuffers['click'] = clickBuf;

      // 2. Pop: Smooth, gentle water-drop / soft bubble pop (40ms)
      const popLen = Math.floor(sampleRate * 0.04);
      const popBuf = ctx.createBuffer(1, popLen, sampleRate);
      const popData = popBuf.getChannelData(0);
      for (let i = 0; i < popLen; i++) {
        const t = i / sampleRate;
        const p = i / popLen;
        const freq = 240 + 120 * Math.sin(p * Math.PI * 0.5);
        const env = Math.sin(p * Math.PI) * Math.exp(-p * 5.0);
        popData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.13;
      }
      this.soundBuffers['pop'] = popBuf;

      // 3. Split / Cut: Harmonious smooth dual-tone micro-snap (35ms) - warm sine blend without razor clipping
      const splitLen = Math.floor(sampleRate * 0.035);
      const splitBuf = ctx.createBuffer(1, splitLen, sampleRate);
      const splitData = splitBuf.getChannelData(0);
      for (let i = 0; i < splitLen; i++) {
        const t = i / sampleRate;
        const p = i / splitLen;
        const freq1 = 420 - 200 * p;
        const freq2 = 210 - 100 * p;
        const env = Math.sin(p * Math.PI) * Math.exp(-p * 7.5);
        const wave = Math.sin(2 * Math.PI * freq1 * t) * 0.65 + Math.sin(2 * Math.PI * freq2 * t) * 0.35;
        splitData[i] = wave * env * 0.14;
      }
      this.soundBuffers['split'] = splitBuf;
      this.soundBuffers['cut'] = splitBuf;

      // 4. Whoosh: Smooth aerodynamic velvet breath (140ms)
      const whooshLen = Math.floor(sampleRate * 0.14);
      const whooshBuf = ctx.createBuffer(1, whooshLen, sampleRate);
      const whooshData = whooshBuf.getChannelData(0);
      for (let i = 0; i < whooshLen; i++) {
        const t = i / sampleRate;
        const p = i / whooshLen;
        const freq = 180 - 100 * (p * p);
        const env = Math.sin(p * Math.PI) * Math.exp(-p * 2.0);
        whooshData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.09;
      }
      this.soundBuffers['whoosh'] = whooshBuf;

      // 5. Boom: Warm rounded sub-bass pulse (200ms)
      const boomLen = Math.floor(sampleRate * 0.20);
      const boomBuf = ctx.createBuffer(1, boomLen, sampleRate);
      const boomData = boomBuf.getChannelData(0);
      for (let i = 0; i < boomLen; i++) {
        const t = i / sampleRate;
        const p = i / boomLen;
        const freq = 80 - 40 * p;
        const env = Math.exp(-p * 5.0);
        boomData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.16;
      }
      this.soundBuffers['boom'] = boomBuf;
    } catch (err) {
      // Audio buffer creation fallback
    }
  }

  /**
   * Play procedural sound effects with ZERO delay on touch
   */
  playSfx(type: SfxType = 'click') {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        this.emitImmediateSound(ctx, type);
      }).catch(() => {});
      return;
    }

    this.emitImmediateSound(ctx, type);
  }

  /**
   * Internal instant audio dispatcher: Uses pre-rendered PCM buffer if available,
   * otherwise falls back to real-time synthesis.
   */
  private emitImmediateSound(ctx: AudioContext, type: SfxType) {
    const preBuffer = this.soundBuffers[type];
    if (preBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = preBuffer;
        source.connect(ctx.destination);
        source.start(0);
        return;
      } catch (e) {
        // Fall back to synthesis
      }
    }

    // Direct oscillator synthesis fallback with smooth warm tones
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      // Automatically reclaim Web Audio nodes from mobile RAM when sound ends
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };

      if (type === 'whoosh') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'split' || type === 'cut') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.035);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.04);
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);
      } else if (type === 'boom') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else {
        // Soft Click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.022);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.025);
      }
    } catch (e) {
      // Audio playback error guard
    }
  }

  /**
   * Play background musical tone/beat
   */
  playMusicalBeat(time: number, isPlaying: boolean) {
    if (!isPlaying || !this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;

    const beat = Math.floor(time * 2);
    if (this.lastBeat !== beat) {
      this.lastBeat = beat;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };
        osc.type = 'sine';
        osc.frequency.setValueAtTime(beat % 2 === 0 ? 110 : 85, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } catch (e) {}
    }
  }
}

export const soundEngine = new SoundEngine();
