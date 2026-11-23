/**
 * FastArt Procedural Sound Effects (SFX) Synthesizer
 * 
 * Generates broadcast-quality, royalty-free creator sound effects in-memory using
 * pure mathematical DSP synthesis. Produces standard 44.1kHz 16-bit PCM WAV data URIs
 * with zero external asset downloads or network latency.
 */

import { Buffer } from 'buffer';

export interface SoundEffectDefinition {
  id: string;
  name: string;
  category: 'Transitions' | 'Impacts' | 'Memes' | 'Foley & UI';
  duration: number; // in seconds
  description: string;
  badge: string;
  icon: string;
  generate: () => Float32Array;
}

const SAMPLE_RATE = 44100;

function createBuffer(duration: number): Float32Array {
  return new Float32Array(Math.floor(duration * SAMPLE_RATE));
}

function bufferToWavDataUri(samples: Float32Array, sampleRate = SAMPLE_RATE): string {
  const numChannels = 1; // Mono for SFX
  const totalSamples = samples.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = totalSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write 16-bit PCM samples with soft-limiting
  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    let s = samples[i];
    if (s > 1.0) s = 1.0;
    else if (s < -1.0) s = -1.0;
    const val = (s * (s < 0 ? 32768 : 32767)) | 0;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  // Convert buffer to binary base64 string safely across Web and Hermes/React Native
  const bytes = new Uint8Array(buffer);
  try {
    if (typeof Buffer !== 'undefined') {
      return `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}`;
    }
  } catch (_) {}

  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return `data:audio/wav;base64,${typeof btoa !== 'undefined' ? btoa(binary) : ''}`;
}

// ─── Procedural Synthesis Functions ──────────────────────────────────────────

// 1. Fast Air Whoosh (0.35s)
function synthFastWhoosh(): Float32Array {
  const dur = 0.35;
  const buf = createBuffer(dur);
  const n = buf.length;
  let filterPrev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Bell envelope
    const env = Math.sin(Math.PI * t) ** 2;
    // White noise
    const white = Math.random() * 2 - 1;
    // Dynamic lowpass filter sweep: sweeps 400Hz -> 2400Hz -> 300Hz
    const cutoff = 300 + 2200 * Math.sin(Math.PI * t);
    const alpha = Math.min(1, (2 * Math.PI * cutoff) / SAMPLE_RATE);
    filterPrev += alpha * (white - filterPrev);
    buf[i] = filterPrev * env * 0.95;
  }
  return buf;
}

// 2. Cinematic Swish (0.65s)
function synthCinematicSwish(): Float32Array {
  const dur = 0.65;
  const buf = createBuffer(dur);
  const n = buf.length;
  let f1 = 0;
  let f2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = (Math.sin(Math.PI * t) ** 1.8) * Math.min(1, t * 8);
    const white = Math.random() * 2 - 1;
    const cutoff = 200 + 3200 * Math.sin(Math.PI * t);
    const alpha = Math.min(1, (2 * Math.PI * cutoff) / SAMPLE_RATE);
    f1 += alpha * (white - f1);
    f2 += alpha * (f1 - f2);
    // Add low-end body sine
    const sub = Math.sin(2 * Math.PI * (80 + 120 * (1 - t)) * (i / SAMPLE_RATE)) * 0.3;
    buf[i] = (f2 * 0.8 + sub) * env * 0.9;
  }
  return buf;
}

// 3. Whip Pan Snap (0.22s)
function synthWhipPan(): Float32Array {
  const dur = 0.22;
  const buf = createBuffer(dur);
  const n = buf.length;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * t) ** 3;
    const white = Math.random() * 2 - 1;
    const cutoff = 600 + 4500 * Math.sin(Math.PI * t);
    const alpha = (2 * Math.PI * cutoff) / SAMPLE_RATE;
    lp += alpha * (white - lp);
    const snap = Math.sin(2 * Math.PI * 440 * (i / SAMPLE_RATE)) * Math.exp(-t * 25) * 0.4;
    buf[i] = (lp * 0.75 + snap) * env * 0.95;
  }
  return buf;
}

// 4. Cinematic Sub Drop (1.6s)
function synthSubDrop(): Float32Array {
  const dur = 1.6;
  const buf = createBuffer(dur);
  const n = buf.length;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Exponential frequency sweep from 95Hz down to 26Hz
    const freq = 26 + (95 - 26) * Math.exp(-t * 3.5);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    // Attack-decay envelope
    const env = (1 - Math.exp(-t * 30)) * Math.exp(-t * 2.2);
    // Soft sine + subtle 2nd harmonic
    const s = Math.sin(phase) + 0.2 * Math.sin(phase * 2);
    buf[i] = Math.tanh(s * 1.3) * env * 0.95;
  }
  return buf;
}

// 5. Dramatic Trailer Impact (0.9s)
function synthDramaticHit(): Float32Array {
  const dur = 0.9;
  const buf = createBuffer(dur);
  const n = buf.length;
  let phase = 0;
  let noiseF = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 45 + 160 * Math.exp(-t * 12);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const envSine = Math.exp(-t * 4);
    const envNoise = Math.exp(-t * 18);
    const white = Math.random() * 2 - 1;
    noiseF += 0.15 * (white - noiseF);
    const hit = Math.sin(phase) * envSine * 0.7 + noiseF * envNoise * 0.8;
    buf[i] = Math.tanh(hit * 1.5) * 0.95;
  }
  return buf;
}

// 6. Glitch Circuit Zap (0.35s)
function synthGlitchZap(): Float32Array {
  const dur = 0.35;
  const buf = createBuffer(dur);
  const n = buf.length;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 180 + 800 * Math.sin(t * 70);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const bitcrush = Math.round(Math.sin(phase) * 6) / 6;
    const noiseBurst = (Math.random() > 0.6 ? Math.random() * 2 - 1 : 0) * 0.4;
    const env = Math.exp(-t * 8);
    buf[i] = (bitcrush + noiseBurst) * env * 0.85;
  }
  return buf;
}

// 7. Metal Clang (0.75s)
function synthMetalClang(): Float32Array {
  const dur = 0.75;
  const buf = createBuffer(dur);
  const n = buf.length;
  // Non-harmonic modal frequencies
  const freqs = [420, 780, 1140, 1680, 2400];
  const phases = [0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    let s = 0;
    for (let f = 0; f < freqs.length; f++) {
      phases[f] += (2 * Math.PI * freqs[f]) / SAMPLE_RATE;
      s += Math.sin(phases[f]) * Math.exp(-t * (4 + f * 3));
    }
    const env = Math.exp(-t * 5);
    buf[i] = Math.tanh(s * 0.6) * env * 0.9;
  }
  return buf;
}

// 8. Vine Boom (1.1s)
function synthVineBoom(): Float32Array {
  const dur = 1.1;
  const buf = createBuffer(dur);
  const n = buf.length;
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 35 + 85 * Math.exp(-t * 6);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const white = Math.random() * 2 - 1;
    lp += 0.2 * (white - lp);
    const sub = Math.sin(phase) * 1.5;
    const crunch = Math.tanh(sub + lp * 0.75);
    const env = (1 - Math.exp(-t * 40)) * Math.exp(-t * 3.2);
    buf[i] = crunch * env * 0.95;
  }
  return buf;
}

// 9. Record Scratch Pause (0.55s)
function synthRecordScratch(): Float32Array {
  const dur = 0.55;
  const buf = createBuffer(dur);
  const n = buf.length;
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Pitch drops from 600Hz down to zero
    const freq = Math.max(20, 700 * (1 - t) ** 2);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const white = Math.random() * 2 - 1;
    lp += 0.18 * (white - lp);
    const env = Math.exp(-t * 4.5);
    buf[i] = (Math.sin(phase) * 0.6 + lp * 0.7) * env * 0.9;
  }
  return buf;
}

// 10. Cartoon Boing (0.6s)
function synthCartoonBoing(): Float32Array {
  const dur = 0.6;
  const buf = createBuffer(dur);
  const n = buf.length;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Upward pitch bend + vibrato
    const freq = 140 + 380 * (t ** 0.8) + Math.sin(t * 45) * 25;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const env = (1 - Math.exp(-t * 35)) * Math.exp(-t * 3.8);
    // Triangle wave
    const tri = 2 * Math.abs(2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5))) - 1;
    buf[i] = tri * env * 0.88;
  }
  return buf;
}

// 11. Camera Shutter Click (0.25s)
function synthCameraShutter(): Float32Array {
  const dur = 0.25;
  const buf = createBuffer(dur);
  const n = buf.length;
  const click1 = 0.04 * SAMPLE_RATE;
  const click2 = 0.12 * SAMPLE_RATE;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const d1 = i - click1;
    const d2 = i - click2;
    let env = 0;
    if (d1 >= 0 && d1 < 0.05 * SAMPLE_RATE) {
      env += Math.exp(-d1 / (0.01 * SAMPLE_RATE));
    }
    if (d2 >= 0 && d2 < 0.07 * SAMPLE_RATE) {
      env += Math.exp(-d2 / (0.015 * SAMPLE_RATE));
    }
    const white = Math.random() * 2 - 1;
    lp += 0.35 * (white - lp);
    buf[i] = lp * env * 0.9;
  }
  return buf;
}

// 12. Pop Cork (0.2s)
function synthPopCork(): Float32Array {
  const dur = 0.2;
  const buf = createBuffer(dur);
  const n = buf.length;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 450 * Math.exp(-t * 18);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const env = Math.exp(-t * 22);
    buf[i] = Math.sin(phase) * env * 0.95;
  }
  return buf;
}

// 13. Cash Register (Cha-Ching) (0.85s)
function synthCashRegister(): Float32Array {
  const dur = 0.85;
  const buf = createBuffer(dur);
  const n = buf.length;
  let p1 = 0;
  let p2 = 0;
  const delayT = 0.15 * SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    p1 += (2 * Math.PI * 1350) / SAMPLE_RATE;
    let s = Math.sin(p1) * Math.exp(-t * 6);
    if (i > delayT) {
      const t2 = (i - delayT) / n;
      p2 += (2 * Math.PI * 2700) / SAMPLE_RATE;
      s += Math.sin(p2) * Math.exp(-t2 * 4.5) * 1.2;
    }
    buf[i] = Math.tanh(s * 0.8) * 0.9;
  }
  return buf;
}

// 14. Crystal Ding Bell (1.2s)
function synthDingBell(): Float32Array {
  const dur = 1.2;
  const buf = createBuffer(dur);
  const n = buf.length;
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    p1 += (2 * Math.PI * 1046.5) / SAMPLE_RATE; // C6
    p2 += (2 * Math.PI * 2093.0) / SAMPLE_RATE; // C7
    const s = Math.sin(p1) + 0.35 * Math.sin(p2);
    const env = Math.exp(-t * 3.5);
    buf[i] = s * env * 0.85;
  }
  return buf;
}

// 15. Success Chime (0.75s)
function synthSuccessChime(): Float32Array {
  const dur = 0.75;
  const buf = createBuffer(dur);
  const n = buf.length;
  const splitIdx = Math.floor(0.18 * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = i < splitIdx ? 523.25 : 783.99; // C5 -> G5
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const env = i < splitIdx ? Math.exp(-t * 6) : Math.exp(-(t - 0.18) * 4.5);
    buf[i] = Math.sin(phase) * env * 0.88;
  }
  return buf;
}

// 16. Gentle Bubble Pop (0.18s)
function synthBubblePop(): Float32Array {
  const dur = 0.18;
  const buf = createBuffer(dur);
  const n = buf.length;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Upward pitch chirp
    const freq = 320 + 850 * (t ** 1.5);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const env = Math.sin(Math.PI * t) ** 1.5;
    buf[i] = Math.sin(phase) * env * 0.9;
  }
  return buf;
}

// ─── Sound Effects Registry ──────────────────────────────────────────────────

export const CREATOR_SOUND_EFFECTS: SoundEffectDefinition[] = [
  // Transitions
  {
    id: 'sfx_fast_whoosh',
    name: 'Fast Whoosh',
    category: 'Transitions',
    duration: 0.35,
    description: 'Clean air swipe for jump cuts & zooms',
    badge: 'Popular',
    icon: 'flash-outline',
    generate: synthFastWhoosh,
  },
  {
    id: 'sfx_cinematic_swish',
    name: 'Cinematic Swish',
    category: 'Transitions',
    duration: 0.65,
    description: 'Deep organic rush for slide transitions',
    badge: 'Cinema',
    icon: 'swap-horizontal',
    generate: synthCinematicSwish,
  },
  {
    id: 'sfx_whip_pan',
    name: 'Whip Pan Snap',
    category: 'Transitions',
    duration: 0.22,
    description: 'High velocity whip pan transition sound',
    badge: 'Viral',
    icon: 'camera-reverse-outline',
    generate: synthWhipPan,
  },

  // Impacts & Booms
  {
    id: 'sfx_sub_drop',
    name: 'Cinematic Sub Drop',
    category: 'Impacts',
    duration: 1.6,
    description: 'Deep 30Hz bass drop for title reveals',
    badge: 'Bass',
    icon: 'radio-outline',
    generate: synthSubDrop,
  },
  {
    id: 'sfx_dramatic_hit',
    name: 'Dramatic Trailer Hit',
    category: 'Impacts',
    duration: 0.9,
    description: 'Punchy low-end hit for keyframe accents',
    badge: 'Trailer',
    icon: 'disc-outline',
    generate: synthDramaticHit,
  },
  {
    id: 'sfx_glitch_zap',
    name: 'Glitch Circuit Zap',
    category: 'Impacts',
    duration: 0.35,
    description: 'Digital cyber glitch distortion burst',
    badge: 'Glitch',
    icon: 'hardware-chip-outline',
    generate: synthGlitchZap,
  },
  {
    id: 'sfx_metal_clang',
    name: 'Metal Strike Clang',
    category: 'Impacts',
    duration: 0.75,
    description: 'Crisp metallic ring for dramatic beats',
    badge: 'Impact',
    icon: 'shield-outline',
    generate: synthMetalClang,
  },

  // Memes & Social
  {
    id: 'sfx_vine_boom',
    name: 'Vine Boom',
    category: 'Memes',
    duration: 1.1,
    description: 'The iconic bass-boosted punch sound',
    badge: 'Trending',
    icon: 'flame-outline',
    generate: synthVineBoom,
  },
  {
    id: 'sfx_record_scratch',
    name: 'Record Scratch',
    category: 'Memes',
    duration: 0.55,
    description: 'DJ turntable pause for awkward freeze frames',
    badge: 'Classic',
    icon: 'pause-circle-outline',
    generate: synthRecordScratch,
  },
  {
    id: 'sfx_cartoon_boing',
    name: 'Cartoon Boing',
    category: 'Memes',
    duration: 0.6,
    description: 'Springy comic bounce for funny moments',
    badge: 'Funny',
    icon: 'happy-outline',
    generate: synthCartoonBoing,
  },
  {
    id: 'sfx_camera_shutter',
    name: 'Camera Shutter',
    category: 'Memes',
    duration: 0.25,
    description: 'Mechanical snap for photo snapshots',
    badge: 'Photo',
    icon: 'camera-outline',
    generate: synthCameraShutter,
  },
  {
    id: 'sfx_pop_cork',
    name: 'Pop Cork',
    category: 'Memes',
    duration: 0.2,
    description: 'Champagne cork pop for sticker stamps',
    badge: 'Cute',
    icon: 'sparkles-outline',
    generate: synthPopCork,
  },

  // Foley & UI
  {
    id: 'sfx_cash_register',
    name: 'Cash Register',
    category: 'Foley & UI',
    duration: 0.85,
    description: 'Crisp cha-ching money bell',
    badge: 'Viral',
    icon: 'cash-outline',
    generate: synthCashRegister,
  },
  {
    id: 'sfx_ding_bell',
    name: 'Crystal Bell Ding',
    category: 'Foley & UI',
    duration: 1.2,
    description: 'Pristine C6 notification ring',
    badge: 'Clean',
    icon: 'notifications-outline',
    generate: synthDingBell,
  },
  {
    id: 'sfx_success_chime',
    name: 'Success Chime',
    category: 'Foley & UI',
    duration: 0.75,
    description: 'Ascending two-tone achievement chime',
    badge: 'Positive',
    icon: 'checkmark-circle-outline',
    generate: synthSuccessChime,
  },
  {
    id: 'sfx_bubble_pop',
    name: 'Bubble Pop',
    category: 'Foley & UI',
    duration: 0.18,
    description: 'Tactile water bubble burst for text pop-ins',
    badge: 'Tactile',
    icon: 'water-outline',
    generate: synthBubblePop,
  },
];

// In-memory cache of generated data URIs to ensure 0ms instantaneous play
const URI_CACHE = new Map<string, string>();

/**
 * Returns a playable data URI for the given sound effect, caching the generated WAV
 */
export function getSoundEffectUri(def: SoundEffectDefinition): string {
  if (URI_CACHE.has(def.id)) {
    return URI_CACHE.get(def.id)!;
  }
  const samples = def.generate();
  const uri = bufferToWavDataUri(samples);
  URI_CACHE.set(def.id, uri);
  return uri;
}

let activePreviewAudio: HTMLAudioElement | null = null;

/**
 * Preview playback helper
 */
export function playSoundEffectPreview(def: SoundEffectDefinition, onEnd?: () => void): () => void {
  try {
    if (typeof Audio === 'undefined') {
      if (onEnd) onEnd();
      return () => {};
    }

    if (activePreviewAudio) {
      activePreviewAudio.pause();
      activePreviewAudio.src = '';
      activePreviewAudio = null;
    }

    const uri = getSoundEffectUri(def);
    const audio = new Audio(uri);
    audio.volume = 1.0;
    activePreviewAudio = audio;

    audio.onended = () => {
      if (activePreviewAudio === audio) activePreviewAudio = null;
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      if (activePreviewAudio === audio) activePreviewAudio = null;
      if (onEnd) onEnd();
    };

    audio.play().catch(() => {
      if (activePreviewAudio === audio) activePreviewAudio = null;
      if (onEnd) onEnd();
    });

    return () => {
      try {
        audio.pause();
        audio.src = '';
      } catch {}
      if (activePreviewAudio === audio) activePreviewAudio = null;
    };
  } catch {
    if (onEnd) onEnd();
    return () => {};
  }
}

