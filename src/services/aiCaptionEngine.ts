import {
  FastArtProject,
  TextClip,
  CaptionClip,
  computeTotalDuration,
} from "../types/project";
import { getMediaBinaryBuffer } from "../utils/largeMediaStorage";
import {
  mediaHasAudioTrack,
  isMediaAudioDetected,
  setMediaHasAudio,
} from "../utils/mediaAudioDetector";
import { splitCaptionIntoPunchySections } from "../utils/srtParser";

export interface CaptionStylePreset {
  id: string;
  name: string;
  desc: string;
  color: string;
  bgColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: any;
  strokeColor?: string;
  strokeWidth?: number;
  textEffect?: string;
  animation: string;
  previewText: string;
}

export const CAPTION_STYLE_PRESETS: CaptionStylePreset[] = [
  {
    id: "mrbeast",
    name: "Viral Pop (MrBeast)",
    desc: "Bold yellow with heavy black stroke & active bounce",
    color: "#FFE600",
    bgColor: "transparent",
    fontFamily: "Impact, Arial Black, sans-serif",
    fontSize: 28,
    fontWeight: "900",
    strokeColor: "#000000",
    strokeWidth: 4,
    textEffect: "3d",
    animation: "bounce",
    previewText: "DON'T MISS THIS! 🔥",
  },
  {
    id: "hormozi",
    name: "Hormozi Punch",
    desc: "Vibrant emerald green with heavy black stroke & zoom",
    color: "#22C55E",
    bgColor: "transparent",
    fontFamily: "Impact, Arial Black, sans-serif",
    fontSize: 28,
    fontWeight: "900",
    strokeColor: "#000000",
    strokeWidth: 3.5,
    textEffect: "3d",
    animation: "zoomIn",
    previewText: "MAKE AN OFFER! 🚀",
  },
  {
    id: "karaoke",
    name: "Karaoke Glow",
    desc: "Vibrant cyan with rhythmic neon pulse",
    color: "#00F2FE",
    bgColor: "transparent",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto",
    fontSize: 26,
    fontWeight: "800",
    strokeColor: "#003344",
    strokeWidth: 2,
    textEffect: "neon",
    animation: "karaoke",
    previewText: "Singing Every Word 🎤",
  },
  {
    id: "minimal_box",
    name: "Modern Subtitle Box",
    desc: "Translucent studio backdrop with crisp white text",
    color: "#FFFFFF",
    bgColor: "rgba(11, 13, 19, 0.85)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto",
    fontSize: 22,
    fontWeight: "700",
    textEffect: "none",
    animation: "fade",
    previewText: "Clean spoken dialogue subtitles",
  },
  {
    id: "cyber_violet",
    name: "Cyberpunk Neon",
    desc: "Electric fuchsia with vivid violet pulse & bounce",
    color: "#E879F9",
    bgColor: "transparent",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto",
    fontSize: 26,
    fontWeight: "800",
    strokeColor: "#3B0764",
    strokeWidth: 2.5,
    textEffect: "neon",
    animation: "bounce",
    previewText: "FUTURE RETRO VIBES ⚡",
  },
  {
    id: "cinema_yellow",
    name: "Cinema Classic",
    desc: "Editorial golden serif with deep cinema shade",
    color: "#FDE047",
    bgColor: "transparent",
    fontFamily: "Georgia, serif",
    fontSize: 22,
    fontWeight: "700",
    strokeColor: "#000000",
    strokeWidth: 1.5,
    textEffect: "shadow",
    animation: "none",
    previewText: "Classic theatrical movie subtitle",
  },
];

export const CAPTION_LANGUAGES = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "es-ES", label: "Spanish" },
  { id: "hi-IN", label: "Hindi (हिंदी)" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
  { id: "ja-JP", label: "Japanese" },
  { id: "pt-BR", label: "Portuguese" },
  { id: "ar-SA", label: "Arabic" },
  { id: "id-ID", label: "Indonesian" },
];

export interface CaptionSegment {
  text: string;
  startTime: number;
  duration: number;
}

/**
/**
 * Resamples any audio buffer (44.1kHz, 48kHz, stereo/mono) down to 16,000Hz mono Float32Array
 * as strictly required by neural speech recognition models (Whisper).
 */
function resampleAudioBufferTo16k(audioBuffer: AudioBuffer): Float32Array {
  const sourceRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const inLength = audioBuffer.length;
  const targetRate = 16000;

  if (sourceRate === targetRate && numChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const outLength = Math.max(
    1,
    Math.round((inLength * targetRate) / sourceRate),
  );
  const result = new Float32Array(outLength);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  const ratio = (inLength - 1) / Math.max(1, outLength - 1);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const srcIndex = Math.floor(srcPos);
    const fraction = srcPos - srcIndex;
    const nextIndex = Math.min(srcIndex + 1, inLength - 1);

    let sampleSum = 0;
    for (let c = 0; c < numChannels; c++) {
      const s1 = channels[c][srcIndex];
      const s2 = channels[c][nextIndex];
      sampleSum += s1 + (s2 - s1) * fraction;
    }
    result[i] = sampleSum / numChannels;
  }

  return result;
}

/**
 * Extracts and composites timeline audio from ALL media clips across the final video.
 * Mixes each video clip and audio clip at its precise timeline position (startTime to startTime + duration),
 * taking into account trimIn, speed, and volume.
 */
export async function extractCompositeTimelineAudio(
  project: FastArtProject,
  targetDuration: number,
  targetSampleRate: number = 16000,
): Promise<Float32Array | null> {
  if (typeof window === "undefined") return null;
  const AudioCtxClass =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;

  // Gather ALL sound sources across the final video timeline
  const videoAudioClips = (project.tracks.video || [])
    .filter(
      (v) =>
        Boolean(v.url) &&
        v.type !== "photo" &&
        !v.isEnding &&
        v.hasAudio !== false &&
        (v.volume === undefined || v.volume > 0),
    )
    .map((v) => ({
      id: v.id,
      url: v.url,
      startTime: Math.max(0, v.startTime || 0),
      duration: Math.max(0.1, v.duration || 5),
      trimIn: Math.max(0, v.trimIn || 0),
      speed: Math.max(0.1, v.speed || 1.0),
      volume:
        (v.volume ?? 100) > 2 ? (v.volume ?? 100) / 100 : (v.volume ?? 1.0),
    }));

  const rawAudioClips = (project.tracks.audio || [])
    .filter((a) => a.url && (a.volume === undefined || a.volume > 0))
    .map((a) => ({
      id: a.id,
      url: a.url,
      startTime: Math.max(0, a.startTime || 0),
      duration: Math.max(0.1, a.duration || 5),
      trimIn: Math.max(0, a.trimIn || 0),
      speed: Math.max(0.1, a.speed || 1.0),
      volume:
        (a.volume ?? 100) > 2 ? (a.volume ?? 100) / 100 : (a.volume ?? 1.0),
    }));

  const allSoundClips = [...videoAudioClips, ...rawAudioClips];
  if (allSoundClips.length === 0) return null;

  const totalSamples = Math.ceil(targetDuration * targetSampleRate);
  if (totalSamples <= 0) return null;
  const masterBuffer = new Float32Array(totalSamples);

  let sharedCtx: any = null;
  try {
    sharedCtx = new AudioCtxClass();
  } catch (e) {
    console.warn("FastArt: Could not create AudioContext for timeline audio:", e);
    return null;
  }

  // Cache decoded buffers per URL so clips from the same media are decoded only once
  const decodedCache = new Map<string, Float32Array>();
  let hasRealAudio = false;

  for (const clip of allSoundClips) {
    try {
      let resampledClipAudio = decodedCache.get(clip.url);

      if (!resampledClipAudio) {
        const arrayBuf = await getMediaBinaryBuffer(clip.url, clip.id);

        if (arrayBuf && arrayBuf.byteLength > 0) {
          try {
            const decodedBuf = await sharedCtx.decodeAudioData(arrayBuf.slice(0));
            if (
              decodedBuf &&
              decodedBuf.numberOfChannels > 0 &&
              decodedBuf.length > 0
            ) {
              resampledClipAudio = resampleAudioBufferTo16k(decodedBuf);
              decodedCache.set(clip.url, resampledClipAudio);
              setMediaHasAudio(clip.url, true);
              if (clip.id) setMediaHasAudio(clip.id, true);
            }
          } catch (decErr) {
            console.warn("FastArt: decodeAudioData failed for", clip.url, decErr);
          }
        }
      }

      if (resampledClipAudio && resampledClipAudio.length > 0) {
        hasRealAudio = true;
        const clipStartSample = Math.floor(clip.startTime * targetSampleRate);
        const clipNumSamples = Math.floor(clip.duration * targetSampleRate);
        const trimInSamples = Math.floor(clip.trimIn * targetSampleRate);

        for (let i = 0; i < clipNumSamples; i++) {
          const masterIdx = clipStartSample + i;
          if (masterIdx >= totalSamples) break;

          const srcIdx = trimInSamples + Math.floor(i * clip.speed);
          if (srcIdx < resampledClipAudio.length) {
            masterBuffer[masterIdx] += resampledClipAudio[srcIdx] * clip.volume;
          }
        }
      }
    } catch (clipErr) {
      console.warn(
        "FastArt: Timeline clip audio extraction skipped:",
        clip.id,
        clipErr,
      );
    }
  }

  try {
    sharedCtx.close();
  } catch {}

  if (!hasRealAudio) return null;

  // Soft clamp to [-1.0, 1.0] to prevent audio clipping distortion
  for (let i = 0; i < masterBuffer.length; i++) {
    const val = masterBuffer[i];
    if (val > 1.0) masterBuffer[i] = 1.0;
    else if (val < -1.0) masterBuffer[i] = -1.0;
  }

  return masterBuffer;
}

export const extractRealAudioChannelData = extractCompositeTimelineAudio;

let cachedTransformersLib: any = null;
let loadTransformersPromise: Promise<any> | null = null;

/**
 * Loads the standalone Transformers.js library in browser using native ES module imports
 * Supports dynamic import with fallback to esm.sh, unpkg, and inline module scripts.
 */
async function loadTransformers(
  onProgress?: (pct: number, status: string) => void,
): Promise<any> {
  if (typeof window === "undefined") return null;
  if (cachedTransformersLib?.pipeline) return cachedTransformersLib;
  if ((window as any).transformers?.pipeline) {
    cachedTransformersLib = (window as any).transformers;
    return cachedTransformersLib;
  }

  if (loadTransformersPromise) return loadTransformersPromise;

  loadTransformersPromise = (async () => {
    if ((window as any).transformers?.pipeline) {
      return (window as any).transformers;
    }

    if (typeof document !== "undefined") {
      const scriptUrls = [
        "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js",
        "https://unpkg.com/@xenova/transformers@2.17.2/dist/transformers.min.js",
      ];

      for (const url of scriptUrls) {
        try {
          if (onProgress) onProgress(30, "Connecting to speech recognition engine...");
          const loaded = await new Promise<boolean>((resolve) => {
            const existing = document.querySelector(`script[src="${url}"]`);
            if (existing && (window as any).transformers?.pipeline) {
              return resolve(true);
            }
            const script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.crossOrigin = "anonymous";
            const timer = setTimeout(() => resolve(false), 12000);
            script.onload = () => {
              clearTimeout(timer);
              resolve(Boolean((window as any).transformers?.pipeline));
            };
            script.onerror = () => {
              clearTimeout(timer);
              resolve(false);
            };
            document.head.appendChild(script);
          });

          if (loaded && (window as any).transformers?.pipeline) {
            cachedTransformersLib = (window as any).transformers;
            return cachedTransformersLib;
          }
        } catch (scriptErr) {
          console.warn("FastArt: Transformers script load error for", url, scriptErr);
        }
      }
    }

    return null;
  })();

  try {
    const res = await loadTransformersPromise;
    return res;
  } finally {
    loadTransformersPromise = null;
  }
}

/**
 * Attempts real speech transcription using Transformers.js Whisper in browser with strict timeouts
 */
async function transcribeWithWhisper(
  audioData: Float32Array,
  language: string = "en",
  onProgress?: (pct: number, status: string) => void,
): Promise<CaptionSegment[] | null> {
  if (typeof window === "undefined") return null;

  try {
    if (onProgress) onProgress(30, "Initializing English AI Speech Model...");
    const transformers = await loadTransformers(onProgress);

    if (!transformers || !transformers.pipeline) {
      console.warn("FastArt: Transformers.js pipeline unavailable or timed out");
      throw new Error(
        "Could not load AI speech recognition engine. Please check your internet connection and try again, or import an .SRT subtitle file."
      );
    }

    if (transformers.env) {
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;
      if (transformers.env.backends?.onnx?.wasm) {
        transformers.env.backends.onnx.wasm.numThreads = 1;
      }
    }

    // English-only Whisper Tiny model (fastest, smallest, highest English accuracy)
    const modelName = "Xenova/whisper-tiny.en";

    if (onProgress)
      onProgress(45, "Loading neural speech model (whisper-tiny.en)...");

    const pipelinePromise = transformers.pipeline(
      "automatic-speech-recognition",
      modelName,
      {
        progress_callback: (p: any) => {
          if (p.status === "progress" && onProgress) {
            const pct = Math.round(45 + (p.progress || 0) * 0.25);
            onProgress(
              pct,
              `Loading AI speech model (${Math.round(p.progress || 0)}%)...`,
            );
          }
        },
      },
    );

    const transcriber = await Promise.race([
      pipelinePromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 120000)),
    ]);

    if (!transcriber) {
      console.warn("FastArt: Speech model load timed out");
      throw new Error(
        "AI speech model initialization timed out. Please check your internet connection and try again, or import an .SRT subtitle file."
      );
    }

    if (onProgress) onProgress(70, "Transcribing dialogue audio waveform...");

    const isLongAudio = audioData.length / 16000 > 30;
    const transcriberOptions: any = {
      return_timestamps: true,
    };
    if (isLongAudio) {
      transcriberOptions.chunk_length_s = 30;
      transcriberOptions.stride_length_s = 5;
    }

    const transcribePromise = transcriber(audioData, transcriberOptions);
    const result = await Promise.race([
      transcribePromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 90000)),
    ]);

    if (!result) {
      console.warn("FastArt: Transcription timed out");
      throw new Error(
        "Speech transcription timed out. Please try with shorter video clips or import an .SRT subtitle file."
      );
    }

    if (result && Array.isArray(result.chunks) && result.chunks.length > 0) {
      const segments: CaptionSegment[] = [];
      result.chunks.forEach((chunk: any) => {
        const text = (chunk.text || "").trim();
        if (!text) return;
        const start = Number((chunk.timestamp?.[0] ?? 0).toFixed(2));
        const rawEnd = chunk.timestamp?.[1] ?? start + 2.0;
        const duration = Number(Math.max(0.8, rawEnd - start).toFixed(2));
        segments.push({ text, startTime: start, duration });
      });
      if (segments.length > 0) return segments;
    }

    if (
      result &&
      typeof result.text === "string" &&
      result.text.trim().length > 0
    ) {
      // Split full transcribed text into natural speech sentences
      const sentences = result.text
        .split(/(?<=[.?!])\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      if (sentences.length > 0) {
        const speechIntervals = analyzeVoiceActivity(
          new Uint8Array(0),
          audioData.length / 16000,
          audioData,
        );
        if (speechIntervals.length > 0) {
          return sentences.map((sent, idx) => {
            const intv =
              speechIntervals[Math.min(idx, speechIntervals.length - 1)];
            return {
              text: sent,
              startTime: intv.start,
              duration: intv.duration,
            };
          });
        }

        const totalDur = audioData.length / 16000;
        const segDur = Math.max(1.2, totalDur / sentences.length);
        return sentences.map((sent, idx) => ({
          text: sent,
          startTime: Number((idx * segDur).toFixed(2)),
          duration: Number(
            Math.min(segDur, Math.max(1.0, totalDur - idx * segDur)).toFixed(2),
          ),
        }));
      }
    }
  } catch (err: any) {
    console.warn("FastArt: In-browser Whisper transcription failed:", err);
    throw err;
  }

  return null;
}

/**
 * Analyzes audio energy peaks and generates voice activity intervals.
 * Guaranteed to break continuous speech into natural, social-ready subtitle phrases (1.5s - 2.8s).
 */
export function analyzeVoiceActivity(
  wavBytes: Uint8Array,
  duration: number,
  realChannelData?: Float32Array | null,
): { start: number; duration: number }[] {
  const intervals: { start: number; duration: number }[] = [];
  const minPhraseDur = 0.9;
  const maxPhraseDur = 1.7;

  // 1. If we have real Float32Array channel data from AudioContext
  if (realChannelData && realChannelData.length > 3200) {
    const sampleRate = 16000;
    const windowFrames = Math.floor(sampleRate / 10); // 100ms
    const numWindows = Math.floor(realChannelData.length / windowFrames);

    // Dynamic energy analysis: calculate RMS distribution
    let maxRms = 0;
    let sumRms = 0;
    const windowRmsList: number[] = new Array(numWindows);

    for (let w = 0; w < numWindows; w++) {
      let sumSquares = 0;
      let count = 0;
      for (let s = 0; s < windowFrames; s += 4) {
        const idx = w * windowFrames + s;
        if (idx < realChannelData.length) {
          const v = realChannelData[idx];
          sumSquares += v * v;
          count++;
        }
      }
      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      windowRmsList[w] = rms;
      sumRms += rms;
      if (rms > maxRms) maxRms = rms;
    }

    const avgRms = numWindows > 0 ? sumRms / numWindows : 0;
    // Adaptive speech threshold: sensitive enough for quiet phone mic speech, but avoids quiet silence
    const speechThreshold = Math.max(
      0.003,
      Math.min(0.02, avgRms * 1.35, maxRms * 0.22),
    );

    let inSpeech = false;
    let speechStartSec = 0;
    let silenceWindows = 0;

    for (let w = 0; w < numWindows; w++) {
      const rms = windowRmsList[w];
      const timeSec = (w * windowFrames) / sampleRate;

      if (rms > speechThreshold) {
        if (!inSpeech) {
          inSpeech = true;
          speechStartSec = timeSec;
          silenceWindows = 0;
        } else {
          silenceWindows = 0;
          // Break continuous speech into natural subtitle chunks (1.6s - 2.8s)
          if (timeSec - speechStartSec >= maxPhraseDur) {
            const segDur = Number((timeSec - speechStartSec).toFixed(2));
            intervals.push({
              start: Number(speechStartSec.toFixed(2)),
              duration: segDur,
            });
            speechStartSec = timeSec;
          }
        }
      } else {
        if (inSpeech) {
          silenceWindows++;
          if (silenceWindows >= 2 || timeSec - speechStartSec >= minPhraseDur) {
            const segDur = Math.max(
              0.8,
              Number((timeSec - speechStartSec).toFixed(2)),
            );
            intervals.push({
              start: Number(speechStartSec.toFixed(2)),
              duration: segDur,
            });
            inSpeech = false;
            silenceWindows = 0;
          }
        }
      }
    }

    if (inSpeech && duration - speechStartSec >= 0.8) {
      intervals.push({
        start: Number(speechStartSec.toFixed(2)),
        duration: Math.max(0.8, Number((duration - speechStartSec).toFixed(2))),
      });
    }
  }

  // 2. If we have raw 16-bit WAV bytes
  if (intervals.length === 0 && wavBytes && wavBytes.byteLength > 44 + 3200) {
    const headerSize = 44;
    const view = new DataView(
      wavBytes.buffer,
      wavBytes.byteOffset,
      wavBytes.byteLength,
    );
    const numChannels = view.getUint16(22, true) || 2;
    const sampleRate = view.getUint32(24, true) || 16000;
    const blockAlign = view.getUint16(32, true) || numChannels * 2;
    const totalFrames = Math.floor(
      (wavBytes.byteLength - headerSize) / blockAlign,
    );

    const windowFrames = Math.floor(sampleRate / 10);
    const numWindows = Math.floor(totalFrames / windowFrames);

    // Dynamic energy analysis: calculate RMS distribution
    let maxRms = 0;
    let sumRms = 0;
    const windowRmsList: number[] = new Array(numWindows);

    for (let w = 0; w < numWindows; w++) {
      let sumSquares = 0;
      let samplesChecked = 0;
      for (let s = 0; s < windowFrames; s += 4) {
        const frameIndex = w * windowFrames + s;
        const offset = headerSize + frameIndex * blockAlign;
        if (offset + 1 < wavBytes.byteLength) {
          const val = view.getInt16(offset, true) / 32768.0;
          sumSquares += val * val;
          samplesChecked++;
        }
      }
      const rms =
        samplesChecked > 0 ? Math.sqrt(sumSquares / samplesChecked) : 0;
      windowRmsList[w] = rms;
      sumRms += rms;
      if (rms > maxRms) maxRms = rms;
    }

    const avgRms = numWindows > 0 ? sumRms / numWindows : 0;
    const speechThreshold = Math.max(
      0.003,
      Math.min(0.02, avgRms * 1.35, maxRms * 0.22),
    );

    let inSpeech = false;
    let speechStartSec = 0;
    let silenceWindows = 0;

    for (let w = 0; w < numWindows; w++) {
      const rms = windowRmsList[w];
      const timeSec = (w * windowFrames) / sampleRate;

      if (rms > speechThreshold) {
        if (!inSpeech) {
          inSpeech = true;
          speechStartSec = timeSec;
          silenceWindows = 0;
        } else {
          silenceWindows = 0;
          // Break continuous speech into natural subtitle chunks (1.6s - 2.8s)
          if (timeSec - speechStartSec >= maxPhraseDur) {
            const segDur = Math.max(
              0.8,
              Number((timeSec - speechStartSec).toFixed(2)),
            );
            intervals.push({
              start: Number(speechStartSec.toFixed(2)),
              duration: segDur,
            });
            speechStartSec = timeSec;
          }
        }
      } else {
        if (inSpeech) {
          silenceWindows++;
          if (silenceWindows >= 2 || timeSec - speechStartSec >= minPhraseDur) {
            const segDur = Math.max(
              0.8,
              Number((timeSec - speechStartSec).toFixed(2)),
            );
            intervals.push({
              start: Number(speechStartSec.toFixed(2)),
              duration: segDur,
            });
            inSpeech = false;
            silenceWindows = 0;
          }
        }
      }
    }

    if (inSpeech && duration - speechStartSec >= 0.8) {
      intervals.push({
        start: Number(speechStartSec.toFixed(2)),
        duration: Math.max(0.8, Number((duration - speechStartSec).toFixed(2))),
      });
    }
  }

  // Return strictly detected audible speech intervals.
  // Silent gaps or pauses between speech bursts will NOT have caption intervals.
  return intervals;
}

/**
 * Checks if browser or mobile Webview supports live speech recognition
 */
export function isLiveSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition,
  );
}

/**
 * Creates a live speech recognition session
 */
export function startLiveSpeechRecognition(
  language: string,
  onResult: (transcript: string) => void,
  onError?: (err: any) => void,
): { stop: () => void } | null {
  if (!isLiveSpeechRecognitionSupported()) return null;
  const SpeechClass =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  const recognition = new SpeechClass();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = language === "auto" ? "en-US" : language;

  recognition.onresult = (event: any) => {
    let full = "";
    for (let i = 0; i < event.results.length; i++) {
      full += event.results[i][0].transcript + " ";
    }
    onResult(full.trim());
  };

  if (onError) {
    recognition.onerror = onError;
  }

  try {
    recognition.start();
    return {
      stop: () => {
        try {
          recognition.stop();
        } catch (_) {}
      },
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}


/**
 * Generates subtitle CaptionClips from audio transcription, voice activity & speech AI
 */
export async function generateAutoCaptions(
  project: FastArtProject,
  language: string = "auto",
  presetId: string = "mrbeast",
  customPhrases?: string[],
  onProgress?: (pct: number, status: string) => void,
  styleOverrides?: Partial<CaptionClip>,
): Promise<CaptionClip[]> {
  const computedDur = computeTotalDuration(project.tracks);
  const totalDuration = computedDur > 0 ? computedDur : 5.0;

  if (onProgress) onProgress(15, "Decoding master timeline audio tracks...");

  // 1. Try extracting real audio channel data from project media
  let realAudio: Float32Array | null = null;
  try {
    realAudio = await extractRealAudioChannelData(project, totalDuration);
  } catch (err) {
    console.warn("FastArt: Real audio channel data extraction skipped", err);
  }

  const hasCustom = customPhrases && customPhrases.length > 0;
  let finalSegments: { text: string; start: number; duration: number }[] = [];

  // 2. Transcribe speech using Whisper AI (strictly no canned fallback)
  if (!hasCustom) {
    if (!realAudio || realAudio.length < 8000) {
      throw new Error(
        "No audio detected in this video. Please ensure the video has an audible sound track or import an .SRT subtitle file."
      );
    }

    try {
      const whisperSegments = await transcribeWithWhisper(
        realAudio,
        language,
        onProgress,
      );
      if (whisperSegments && whisperSegments.length > 0) {
        finalSegments = whisperSegments.map((ws) => ({
          text: ws.text,
          start: ws.startTime,
          duration: ws.duration,
        }));
      }
    } catch (err: any) {
      console.warn("FastArt: In-browser Whisper transcription failed:", err);
      throw err;
    }
  } else {
    // Custom dialogue script provided: align to voice activity intervals
    if (onProgress)
      onProgress(55, "Detecting vocal cadences and spoken dialogue bursts...");

    let intervals = analyzeVoiceActivity(
      new Uint8Array(0),
      totalDuration,
      realAudio,
    );

    if (intervals.length === 0 && totalDuration > 0.8) {
      let curT = 0.5;
      while (curT < totalDuration - 0.4) {
        const segDur = Math.min(1.6, Number((totalDuration - curT).toFixed(2)));
        intervals.push({
          start: Number(curT.toFixed(2)),
          duration: segDur,
        });
        curT += segDur + 0.35;
      }
    }

    if (onProgress)
      onProgress(70, "Aligning script to dialogue cadence...");
    const phrasesToUse = customPhrases!;
    const count = Math.min(phrasesToUse.length, intervals.length);
    for (let i = 0; i < count; i++) {
      finalSegments.push({
        text: phrasesToUse[i],
        start: intervals[i].start,
        duration: intervals[i].duration,
      });
    }
  }

  // 3. Strict error if speech recognition could not detect any dialogue
  if (finalSegments.length === 0) {
    throw new Error(
      "No spoken English dialogue detected in this video's audio. Please ensure the video has clear speech and try again, or import an .SRT subtitle file."
    );
  }

  if (onProgress)
    onProgress(90, "Applying viral styles and word animations...");

  const preset =
    CAPTION_STYLE_PRESETS.find((p) => p.id === presetId) ||
    CAPTION_STYLE_PRESETS[0];

  const generatedClips: CaptionClip[] = [];

  // Split all segments into punchy, short subtitle phrases (2 to 4 words max)
  const maxWords = (styleOverrides as any)?.maxWordsPerCue ?? 3;
  const punchySegments: { text: string; start: number; duration: number }[] = [];

  finalSegments.forEach((segment) => {
    const pieces = splitCaptionIntoPunchySections(
      segment.text,
      segment.start,
      segment.duration,
      maxWords,
      1.8,
    );
    pieces.forEach((p) => {
      punchySegments.push({
        text: p.text,
        start: p.startTime,
        duration: p.duration,
      });
    });
  });

  punchySegments.forEach((segment, idx) => {
    const clipId = `cap-${Date.now()}-${idx}`;
    const rawText = segment.text;
    const formattedText =
      preset.id === "mrbeast" || preset.id === "hormozi"
        ? rawText.toUpperCase()
        : rawText;

    // Generate word timestamps for karaoke and kinetic typography
    const wordsList = formattedText.split(/\s+/).filter(Boolean);
    const wordDur = segment.duration / Math.max(1, wordsList.length);
    const words = wordsList.map((w, wIdx) => ({
      word: w,
      start: Number((segment.start + wIdx * wordDur).toFixed(2)),
      end: Number((segment.start + (wIdx + 1) * wordDur).toFixed(2)),
    }));

    const captionClip: CaptionClip = {
      id: clipId,
      text: styleOverrides?.uppercase ? formattedText.toUpperCase() : formattedText,
      startTime: segment.start,
      duration: segment.duration,
      position: styleOverrides?.position || { x: 50, y: 78 }, // Safe social lower-third position
      scale: styleOverrides?.scale || 1.0,
      rotation: styleOverrides?.rotation || 0,
      animation: styleOverrides?.animation || preset.animation,
      trackIndex: 2, // Dedicated subtitle lane (above Video=0, Audio=1)
      presetId: styleOverrides?.presetId || preset.id,
      enableWordHighlight: styleOverrides?.enableWordHighlight !== false,
      highlightColor:
        styleOverrides?.highlightColor ||
        (preset.id === "hormozi"
          ? "#22C55E"
          : preset.id === "karaoke"
            ? "#00F2FE"
            : preset.id === "cyber_violet"
              ? "#E879F9"
              : "#FFE600"),
      uppercase: styleOverrides?.uppercase,
      words: styleOverrides?.uppercase
        ? words.map((w) => ({ ...w, word: w.word.toUpperCase() }))
        : words,
      style: {
        color: preset.color,
        backgroundColor: preset.bgColor,
        fontFamily: preset.fontFamily,
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        strokeColor: preset.strokeColor,
        strokeWidth: preset.strokeWidth,
        textEffect: preset.textEffect,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        textAlign: "center",
        ...(styleOverrides?.style || {}),
      },
    };

    generatedClips.push(captionClip);
  });

  if (onProgress)
    onProgress(
      100,
      `Generated ${generatedClips.length} synchronized captions!`,
    );

  return generatedClips;
}
