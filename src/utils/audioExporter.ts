// FastArt Studio Multi-Track PCM Audio Export & Mixing Engine
// Replaces synthetic audio hums with genuine sample-accurate decoded PCM audio.
// Accurately renders:
// - Audio Tracks (music, sound effects, voiceovers, background audio)
// - Video Clips with synchronized dialogue and audio
// - Trimming (trimIn / trimOut offsets)
// - Variable Playback Speed & Pitch
// - Volume Gain Levels & Muting
// - Smooth Fade In & Fade Out Envelopes
// - AI Denoise & Noise-Floor Attenuation Gate
// - Master Soft-Knee Limiter (prevents digital clipping/distortion)
// - Zero Audio Hum: Outputs clean digital silence when no sound is present

import { FastArtProject, AudioClip, VideoClip } from '../types/project';
import { mediaHasAudioTrack, isMediaAudioDetected } from './mediaAudioDetector';
import { getMediaBinaryBuffer } from './largeMediaStorage';

export interface DecodedAudio {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
}

const decodedAudioCache = new Map<string, DecodedAudio>();

/**
 * Pure-JS 16-bit, 24-bit, 32-bit float, and 8-bit PCM WAV decoder
 */
export function decodeWavPcm(buf: ArrayBuffer): DecodedAudio | null {
  if (!buf || buf.byteLength < 44) return null;
  const view = new DataView(buf);
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== 'RIFF' || wave !== 'WAVE') return null;

  let offset = 12;
  let numChannels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let audioFormat = 1; // 1 = PCM, 3 = IEEE Float
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= buf.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, buf.byteLength - dataOffset);
      break;
    }
    offset += 8 + chunkSize;
  }

  if (dataOffset < 0 || dataLength <= 0 || numChannels <= 0 || sampleRate <= 0) return null;

  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * numChannels;
  const totalFrames = Math.floor(dataLength / bytesPerFrame);
  if (totalFrames <= 0) return null;

  const left = new Float32Array(totalFrames);
  const right = numChannels > 1 ? new Float32Array(totalFrames) : left;

  if (audioFormat === 1 && bitsPerSample === 16) {
    for (let f = 0; f < totalFrames; f++) {
      const frameOffset = dataOffset + f * bytesPerFrame;
      left[f] = view.getInt16(frameOffset, true) / 32768.0;
      if (numChannels > 1) {
        right[f] = view.getInt16(frameOffset + 2, true) / 32768.0;
      }
    }
  } else if (audioFormat === 1 && bitsPerSample === 8) {
    for (let f = 0; f < totalFrames; f++) {
      const frameOffset = dataOffset + f * bytesPerFrame;
      left[f] = (view.getUint8(frameOffset) - 128) / 128.0;
      if (numChannels > 1) {
        right[f] = (view.getUint8(frameOffset + 1) - 128) / 128.0;
      }
    }
  } else if (audioFormat === 1 && bitsPerSample === 24) {
    for (let f = 0; f < totalFrames; f++) {
      const frameOffset = dataOffset + f * bytesPerFrame;
      const b0 = view.getUint8(frameOffset);
      const b1 = view.getUint8(frameOffset + 1);
      const b2 = view.getInt8(frameOffset + 2);
      left[f] = ((b2 << 16) | (b1 << 8) | b0) / 8388608.0;
      if (numChannels > 1) {
        const rb0 = view.getUint8(frameOffset + 3);
        const rb1 = view.getUint8(frameOffset + 4);
        const rb2 = view.getInt8(frameOffset + 5);
        right[f] = ((rb2 << 16) | (rb1 << 8) | rb0) / 8388608.0;
      }
    }
  } else if (audioFormat === 3 && bitsPerSample === 32) {
    for (let f = 0; f < totalFrames; f++) {
      const frameOffset = dataOffset + f * bytesPerFrame;
      left[f] = view.getFloat32(frameOffset, true);
      if (numChannels > 1) {
        right[f] = view.getFloat32(frameOffset + 4, true);
      }
    }
  }

  return { sampleRate, left, right };
}

/**
 * Loads and decodes audio samples from any media file (AudioClip or VideoClip)
 */
export async function decodeMediaAudio(url: string, clipId?: string): Promise<DecodedAudio | null> {
  if (!url) return null;
  const cacheKey = `${url}_${clipId || ''}`;
  if (decodedAudioCache.has(cacheKey)) {
    return decodedAudioCache.get(cacheKey)!;
  }

  try {
    const arrayBuf = await getMediaBinaryBuffer(url, clipId);
    if (!arrayBuf || arrayBuf.byteLength === 0) return null;

    // 1. Web Audio API decoder (browser environment: handles MP3, WAV, AAC, M4A, FLAC, OGG, WebM)
    if (typeof window !== 'undefined') {
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          const ctx = new AudioCtxClass();
          const decoded: AudioBuffer = await new Promise((resolve, reject) => {
            const res = ctx.decodeAudioData(
              arrayBuf.slice(0),
              (buf: AudioBuffer) => resolve(buf),
              (err: any) => reject(err)
            );
            if (res && typeof (res as any).then === 'function') {
              (res as any).then(resolve).catch(reject);
            }
          });
          if (decoded && decoded.length > 0) {
            const left = decoded.getChannelData(0);
            const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;
            const result: DecodedAudio = {
              sampleRate: decoded.sampleRate,
              left,
              right,
            };
            decodedAudioCache.set(cacheKey, result);
            try {
              ctx.close();
            } catch {}
            return result;
          }
          try {
            ctx.close();
          } catch {}
        } catch (_) {}
      }
    }

    // 2. Pure-JS WAV PCM decoder (works in all JS engines without browser AudioContext)
    const wav = decodeWavPcm(arrayBuf);
    if (wav) {
      decodedAudioCache.set(cacheKey, wav);
      return wav;
    }
  } catch (err) {
    console.warn('[audioExporter] Could not decode audio from:', url, err);
  }

  return null;
}

/**
 * Renders all project audio tracks & video soundtracks into a 16-bit Stereo PCM WAV byte array.
 * Never synthesizes artificial sine waves; accurately blends real audio stems with timeline effects.
 */
export async function exportProjectAudioToWavBytes(
  project: FastArtProject,
  duration: number = 10,
  sampleRate: number = 44100
): Promise<Uint8Array> {
  const numChannels = 2; // Stereo
  const totalSamples = Math.ceil(duration * sampleRate);
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = totalSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper function to write ASCII strings into RIFF chunks
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // 1. RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // File size - 8
  writeString(8, 'WAVE');

  // 2. "fmt " Sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size = 16 for PCM
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true); // NumChannels = 2
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // 3. "data" Sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Collect all eligible audio sources from the project
  const audioClips = (project.tracks.audio || []).filter((c) => c && c.duration > 0);
  const videoAudioClips = (project.tracks.video || []).filter(
    (v) =>
      v &&
      v.type === 'video' &&
      !v.isEnding &&
      !v.muted &&
      v.hasAudio !== false &&
      (v.volume === undefined || v.volume > 0) &&
      (mediaHasAudioTrack(v) || isMediaAudioDetected(v.id || v.url) !== false)
  );

  // Pre-load and decode real audio from all active clips concurrently
  const loadedAudioTracks: Array<{
    clip: AudioClip | VideoClip;
    decoded: DecodedAudio;
    volume: number;
    speed: number;
    trimIn: number;
    fadeIn: number;
    fadeOut: number;
    denoise: boolean;
  }> = [];

  const allClips = [...audioClips, ...videoAudioClips];
  await Promise.all(
    allClips.map(async (c) => {
      if (!c.url) return;
      const decoded = await decodeMediaAudio(c.url, c.id);
      if (decoded && decoded.left && decoded.left.length > 0) {
        const rawVol = c.volume !== undefined ? c.volume : 1.0;
        const volume = rawVol > 2 ? rawVol / 100 : Math.max(0, rawVol);
        const speed = (c as any).speed && (c as any).speed > 0 ? (c as any).speed : 1.0;
        const trimIn = Math.max(0, c.trimIn || 0);
        const fadeIn = Math.max(0, (c as any).fadeIn || 0);
        const fadeOut = Math.max(0, (c as any).fadeOut || 0);
        const denoise = Boolean(c.denoise || project.aiDenoise);

        loadedAudioTracks.push({
          clip: c,
          decoded,
          volume,
          speed,
          trimIn,
          fadeIn,
          fadeOut,
          denoise,
        });
      }
    })
  );

  // Master mixdown accumulators
  const masterLeft = new Float32Array(totalSamples);
  const masterRight = new Float32Array(totalSamples);

  // Mix every loaded audio track with frame-accurate interpolation & envelope curves
  for (const track of loadedAudioTracks) {
    const { clip, decoded, volume, speed, trimIn, fadeIn, fadeOut, denoise } = track;
    if (volume <= 0) continue;

    const clipStart = Math.max(0, clip.startTime || 0);
    const clipDuration = clip.duration || 10;
    const clipEnd = Math.min(duration, clipStart + clipDuration);

    const startSample = Math.floor(clipStart * sampleRate);
    const endSample = Math.min(totalSamples, Math.ceil(clipEnd * sampleRate));

    const srcLeft = decoded.left;
    const srcRight = decoded.right;
    const srcRate = decoded.sampleRate;
    const srcLen = srcLeft.length;

    for (let i = startSample; i < endSample; i++) {
      const timelineTime = i / sampleRate;
      const relTime = timelineTime - clipStart;
      const sourceTime = trimIn + relTime * speed;
      const srcFrame = sourceTime * srcRate;

      if (srcFrame >= 0 && srcFrame < srcLen - 1) {
        const idx0 = Math.floor(srcFrame);
        const idx1 = idx0 + 1;
        const frac = srcFrame - idx0;

        let leftSamp = srcLeft[idx0] * (1 - frac) + srcLeft[idx1] * frac;
        let rightSamp = srcRight[idx0] * (1 - frac) + srcRight[idx1] * frac;

        // Apply Fade In envelope
        let env = 1.0;
        if (fadeIn > 0 && relTime < fadeIn) {
          env *= Math.max(0, relTime / fadeIn);
        }
        // Apply Fade Out envelope
        if (fadeOut > 0 && relTime > clipDuration - fadeOut) {
          env *= Math.max(0, (clipDuration - relTime) / fadeOut);
        }

        // Apply AI Denoise gate
        if (denoise) {
          if (Math.abs(leftSamp) < 0.02) leftSamp *= 0.1;
          if (Math.abs(rightSamp) < 0.02) rightSamp *= 0.1;
        }

        const effVol = volume * env;
        masterLeft[i] += leftSamp * effVol;
        masterRight[i] += rightSamp * effVol;
      }
    }
  }

  // Master soft-knee limiter & 16-bit PCM conversion
  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    let l = masterLeft[i];
    let r = masterRight[i];

    // Clean soft-limiting curve to prevent harsh digital clipping
    if (l > 1.0) l = 1.0 - Math.exp(1.0 - l);
    else if (l < -1.0) l = -1.0 + Math.exp(1.0 + l);

    if (r > 1.0) r = 1.0 - Math.exp(1.0 - r);
    else if (r < -1.0) r = -1.0 + Math.exp(1.0 + r);

    // Convert to 16-bit signed integer [-32768, 32767]
    const pcmLeft = Math.round(l < 0 ? l * 0x8000 : l * 0x7fff);
    const pcmRight = Math.round(r < 0 ? r * 0x8000 : r * 0x7fff);

    view.setInt16(offset, Math.max(-32768, Math.min(32767, pcmLeft)), true);
    view.setInt16(offset + 2, Math.max(-32768, Math.min(32767, pcmRight)), true);
    offset += 4;
  }

  return new Uint8Array(buffer);
}

/**
 * Creates a standard WAV Blob from the mixed project audio tracks
 */
export async function exportProjectAudioToWav(
  project: FastArtProject,
  duration: number = 10,
  sampleRate: number = 44100
): Promise<Blob> {
  const bytes = await exportProjectAudioToWavBytes(project, duration, sampleRate);
  if (typeof Blob !== 'undefined') {
    return new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' });
  }
  return {
    size: bytes.length,
    type: 'audio/wav',
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  } as unknown as Blob;
}
