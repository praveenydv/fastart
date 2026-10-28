// CapCut-Style Sound Effects (SFX) Library & Real-Time Synthesizer
import { AudioClip } from '../types/project';

export interface SoundEffectItem {
  id: string;
  name: string;
  category: 'transitions' | 'impacts' | 'social' | 'foley';
  categoryLabel: string;
  duration: number; // in seconds
  icon: string;
  color: string;
  generator: (ctx: AudioContext, dest: AudioNode) => void;
}

/**
 * Creates a standard uncompressed PCM WAV Blob from an AudioBuffer
 */
function bufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const length = buffer.length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Write interleaved PCM samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export const SFX_ITEMS: SoundEffectItem[] = [
  // 1. TRANSITIONS
  {
    id: 'sfx_whoosh_fast',
    name: 'Fast Swoosh',
    category: 'transitions',
    categoryLabel: 'Transitions',
    duration: 0.35,
    icon: 'weather-windy',
    color: '#00F2FE',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.35;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.15);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.35);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.8, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      whiteNoise.start(now);
    },
  },
  {
    id: 'sfx_whoosh_cinema',
    name: 'Cinematic Sweep',
    category: 'transitions',
    categoryLabel: 'Transitions',
    duration: 0.8,
    icon: 'movie-roll',
    color: '#38BDF8',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.35);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.8);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.7, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.8);
    },
  },
  {
    id: 'sfx_whip_pan',
    name: 'Whip Pan Snap',
    category: 'transitions',
    categoryLabel: 'Transitions',
    duration: 0.25,
    icon: 'camera-iris',
    color: '#F43F5E',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.25);
    },
  },

  // 2. IMPACTS & BOOMS
  {
    id: 'sfx_bass_drop',
    name: '808 Bass Drop',
    category: 'impacts',
    categoryLabel: 'Impacts',
    duration: 1.5,
    icon: 'speaker-wireless',
    color: '#A855F7',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 1.2);

      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 1.5);
    },
  },
  {
    id: 'sfx_metal_impact',
    name: 'Metallic Hit',
    category: 'impacts',
    categoryLabel: 'Impacts',
    duration: 0.6,
    icon: 'shield-alert-outline',
    color: '#F97316',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(420, now);
      osc2.frequency.setValueAtTime(630, now);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(dest);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    },
  },
  {
    id: 'sfx_dramatic_boom',
    name: 'Dramatic Boom',
    category: 'impacts',
    categoryLabel: 'Impacts',
    duration: 1.2,
    icon: 'bomb',
    color: '#EF4444',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 1.0);

      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 1.2);
    },
  },

  // 3. SOCIAL, MEMES & ALERTS
  {
    id: 'sfx_bubble_pop',
    name: 'Pop Bubble',
    category: 'social',
    categoryLabel: 'Social & Memes',
    duration: 0.2,
    icon: 'circle-slice-8',
    color: '#FACC15',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.12);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.2);
    },
  },
  {
    id: 'sfx_bell_chime',
    name: 'Success Chime',
    category: 'social',
    categoryLabel: 'Social & Memes',
    duration: 0.7,
    icon: 'bell-ring',
    color: '#10B981',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      [880, 1108, 1318].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.4, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now + idx * 0.08);
        osc.stop(now + 0.7);
      });
    },
  },
  {
    id: 'sfx_camera_click',
    name: 'Camera Shutter',
    category: 'social',
    categoryLabel: 'Social & Memes',
    duration: 0.25,
    icon: 'camera',
    color: '#06B6D4',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.15);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.25);
    },
  },

  // 4. FOLEY & INTERFACE
  {
    id: 'sfx_key_click',
    name: 'Mechanical Key',
    category: 'foley',
    categoryLabel: 'Foley & Clicks',
    duration: 0.15,
    icon: 'keyboard-outline',
    color: '#E4E4E7',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.15);
    },
  },
  {
    id: 'sfx_finger_snap',
    name: 'Finger Snap',
    category: 'foley',
    categoryLabel: 'Foley & Clicks',
    duration: 0.2,
    icon: 'hand-pointing-up',
    color: '#FB923C',
    generator: (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.2);
    },
  },
];

/**
 * Preview SFX using active web AudioContext
 */
export function previewSoundEffect(sfx: SoundEffectItem) {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    sfx.generator(ctx, ctx.destination);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, sfx.duration * 1000 + 300);
  } catch (e) {
    console.warn('Failed to preview SFX:', e);
  }
}

/**
 * Generate an offline WAV blob and return an AudioClip ready to insert on the timeline
 */
export async function createAudioClipFromSfx(
  sfx: SoundEffectItem,
  playheadTime: number
): Promise<AudioClip> {
  let mediaUrl = 'data:audio/wav;base64,';

  if (typeof window !== 'undefined') {
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (OfflineCtx) {
      try {
        const sampleRate = 44100;
        const length = Math.ceil(sfx.duration * sampleRate);
        const offlineCtx = new OfflineCtx(1, length, sampleRate);

        sfx.generator(offlineCtx as any, offlineCtx.destination);
        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = bufferToWavBlob(renderedBuffer);
        mediaUrl = URL.createObjectURL(wavBlob);
      } catch (e) {
        console.warn('Offline rendering SFX failed, falling back to dummy url:', e);
      }
    }
  }

  const clip: AudioClip = {
    id: 'sfx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    title: sfx.name,
    artist: 'Sound FX',
    duration: sfx.duration,
    startTime: playheadTime,
    trimIn: 0,
    trimOut: sfx.duration,
    mediaDuration: sfx.duration,
    volume: 1.0,
    url: mediaUrl,
    trackIndex: 1, // Secondary audio track for sound effects
  };

  return clip;
}
