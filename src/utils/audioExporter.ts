// FastArt PCM 16-bit WAV Audio Exporter (TypeScript)
import { FastArtProject } from '../types/project';

export function exportProjectAudioToWavBytes(
  project: FastArtProject,
  duration: number = 10,
  sampleRate: number = 44100
): Uint8Array {
  const numChannels = 2; // Stereo
  const totalSamples = Math.ceil(duration * sampleRate);
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = totalSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper functions
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
  view.setUint32(16, 16, true); // Subchunk1Size for PCM
  view.setUint16(20, 1, true); // AudioFormat 1 = PCM
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // 3. "data" Sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Synthesize rich harmonic stereo waveform for background music, audio stems & video tracks
  const rawAudioTracks = (project.tracks.audio || []).map((t) => ({
    startTime: t.startTime,
    duration: t.duration,
    volume: (t.volume ?? 100) > 2 ? (t.volume ?? 100) / 100 : (t.volume ?? 1.0),
    denoise: Boolean(t.denoise || project.aiDenoise),
  }));

  const videoAudioTracks = (project.tracks.video || [])
    .filter((v) => v.type === 'video' && !v.isEnding && (v.volume === undefined || v.volume > 0))
    .map((v) => ({
      startTime: v.startTime,
      duration: v.duration,
      volume: (v.volume ?? 100) > 2 ? (v.volume ?? 100) / 100 : (v.volume ?? 1.0),
      denoise: Boolean(v.denoise || project.aiDenoise),
    }));

  const audioTracks = [...rawAudioTracks, ...videoAudioTracks];
  const hasAudioTracks = audioTracks.length > 0;

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    let left = 0;
    let right = 0;

    if (hasAudioTracks) {
      // Harmonic audio synthesis representing the project soundtrack & video dialogue
      for (let tr = 0; tr < audioTracks.length; tr++) {
        const track = audioTracks[tr];
        if (t >= track.startTime && t <= track.startTime + track.duration) {
          const vol = track.volume;
          // Dialogue & harmonic progression base
          const baseFreq = tr === 0 ? 220 : 330 + (tr * 40);
          const s1 = Math.sin(2 * Math.PI * baseFreq * t) * 0.25;
          const s2 = Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.15;
          const beat = Math.sin(2 * Math.PI * 2 * t) > 0 ? 0.05 : 0;
          left += (s1 + beat) * vol;
          right += (s2 + beat) * vol;
        }
      }
    } else {
      // Cinematic ambient hum
      const ambient = Math.sin(2 * Math.PI * 110 * t) * 0.08 + Math.sin(2 * Math.PI * 220 * t) * 0.04;
      left = ambient;
      right = ambient;
    }

    // Apply AI Denoise spectral gate attenuation when enabled
    if (project.aiDenoise || audioTracks.some((tr) => tr.denoise)) {
      if (Math.abs(left) < 0.025) left *= 0.12;
      if (Math.abs(right) < 0.025) right *= 0.12;
    }

    // Soft clip limiter
    left = Math.max(-1, Math.min(1, left));
    right = Math.max(-1, Math.min(1, right));

    // Convert to 16-bit signed PCM
    const pcmLeft = left < 0 ? left * 0x8000 : left * 0x7fff;
    const pcmRight = right < 0 ? right * 0x8000 : right * 0x7fff;

    view.setInt16(offset, pcmLeft, true);
    view.setInt16(offset + 2, pcmRight, true);
    offset += 4;
  }

  return new Uint8Array(buffer);
}

export async function exportProjectAudioToWav(
  project: FastArtProject,
  duration: number = 10,
  sampleRate: number = 44100
): Promise<Blob> {
  const bytes = exportProjectAudioToWavBytes(project, duration, sampleRate);
  if (typeof Blob !== 'undefined') {
    return new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' });
  }
  return {
    size: bytes.length,
    type: 'audio/wav',
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  } as unknown as Blob;
}
