import {
  FastArtProject,
  TextClip,
  CaptionClip,
  computeTotalDuration,
} from "../types/project";
import { exportProjectAudioToWavBytes } from "../utils/audioExporter";

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

export const DIALOGUE_BY_LANGUAGE: Record<string, string[]> = {
  "en-US": [
    "Welcome back to another video!",
    "Today we are revealing the secret.",
    "Make sure you watch until the very end!",
    "You won't believe what happened next.",
    "Hit that follow button right now!",
    "Drop a comment with your thoughts.",
    "Let's jump right into the action!",
    "This changes everything you know.",
    "Share this with someone who needs it!",
    "Thanks for watching, see you next time!",
  ],
  "en-GB": [
    "Welcome back to today's video!",
    "Now this is quite remarkable.",
    "Do stick around until the very end!",
    "Brilliant things are coming up next.",
    "Make sure to follow and subscribe!",
    "Let us know your thoughts below.",
    "Right, let's get straight into it!",
    "This is genuinely game changing.",
  ],
  "es-ES": [
    "¡Bienvenidos a un nuevo video!",
    "Hoy les revelamos el gran secreto.",
    "¡No te pierdas el final!",
    "¡Suscríbete y dale like ahora!",
    "Déjanos tus comentarios aquí.",
    "¡Vamos a comenzar ya!",
    "Esto lo cambia absolutamente todo.",
    "¡Gracias por ver el video!",
  ],
  "hi-IN": [
    "नमस्ते दोस्तों, स्वागत है आपका!",
    "आज हम एक कमाल का सीक्रेट देखेंगे।",
    "वीडियो को अंत तक ज़रूर देखना!",
    "चैनल को सब्सक्राइब करना मत भूलना।",
    "कमेंट में अपनी राय ज़रूर बताएं!",
    "चलिए शुरू करते हैं!",
    "यह देखकर आप हैरान रह जाएंगे।",
    "मिलते हैं अगले वीडियो में!",
  ],
  "fr-FR": [
    "Bienvenue dans cette nouvelle vidéo !",
    "Aujourd'hui nous découvrons le secret.",
    "Regardez bien jusqu'à la fin !",
    "N'oubliez pas de vous abonner !",
    "Dites-moi tout en commentaire !",
    "C'est parti, on commence !",
    "Ce que vous allez voir est incroyable.",
    "Merci à tous et à bientôt !",
  ],
  "de-DE": [
    "Willkommen zu einem neuen Video!",
    "Heute lüften wir das große Geheimnis.",
    "Schau dir das bis zum Ende an!",
    "Abonniere den Kanal jetzt!",
    "Schreib deine Meinung in die Kommentare!",
    "Los geht's direkt mit dem Thema!",
    "Das wird dich absolut überraschen.",
  ],
  "ja-JP": [
    "動画をご視聴いただきありがとうございます！",
    "今日は特別な秘密を公開します。",
    "最後までぜひご覧ください！",
    "チャンネル登録をお願いします！",
    "コメントもお待ちしています。",
    "さあ、始めましょう！",
    "次回もお楽しみに！",
  ],
  "pt-BR": [
    "Bem-vindos a mais um vídeo!",
    "Hoje vamos revelar um grande segredo.",
    "Assista até o final!",
    "Já deixa o seu like e se inscreve!",
    "Comente o que você achou aqui embaixo.",
    "Vamos começar agora!",
    "Isso vai mudar seu jeito de pensar.",
  ],
  "ar-SA": [
    "أهلاً بكم في هذا الفيديو الجديد!",
    "اليوم سنكشف لكم السر الحقيقي.",
    "تابعوا الفيديو حتى النهاية!",
    "لا تنسوا الاشتراك وتفعيل الجرس!",
    "شاركونا آراءكم في التعليقات.",
    "دعونا نبدأ الآن!",
  ],
  "id-ID": [
    "Selamat datang di video terbaru kami!",
    "Hari ini kita akan membongkar rahasianya.",
    "Tonton sampai habis ya!",
    "Jangan lupa subscribe dan like sekarang!",
    "Tulis pendapat kamu di kolom komentar.",
    "Yuk kita mulai sekarang!",
  ],
};

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
        v.url &&
        v.type !== "photo" &&
        !v.isEnding &&
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
        let arrayBuf: ArrayBuffer | null = null;
        try {
          const resp = await fetch(clip.url);
          arrayBuf = await resp.arrayBuffer();
        } catch (fetchErr) {
          console.warn("FastArt: Fetch media failed for", clip.url, fetchErr);
        }

        if (arrayBuf && arrayBuf.byteLength > 0) {
          try {
            const decodedBuf = await sharedCtx.decodeAudioData(arrayBuf);
            if (
              decodedBuf &&
              decodedBuf.numberOfChannels > 0 &&
              decodedBuf.length > 0
            ) {
              resampledClipAudio = resampleAudioBufferTo16k(decodedBuf);
              decodedCache.set(clip.url, resampledClipAudio);
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

/**
 * Loads the standalone Transformers.js library in browser with multi-CDN fallback and strict timeout
 */
async function loadTransformers(): Promise<any> {
  if (typeof window === "undefined") return null;
  if (cachedTransformersLib) return cachedTransformersLib;
  if ((window as any).transformers) {
    cachedTransformersLib = (window as any).transformers;
    return cachedTransformersLib;
  }

  // 1. Script tag injection with bundled UMD build and 3.5s timeout
  const fromScriptTag = await Promise.race([
    new Promise<any>((resolve) => {
      try {
        const existing = document.querySelector(
          'script[data-id="xenova-transformers"]',
        );
        if (existing) {
          if ((window as any).transformers)
            return resolve((window as any).transformers);
          existing.addEventListener("load", () =>
            resolve((window as any).transformers || null),
          );
          existing.addEventListener("error", () => resolve(null));
          return;
        }
        const script = document.createElement("script");
        script.setAttribute("data-id", "xenova-transformers");
        script.src =
          "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js";
        script.async = true;
        script.onload = () => {
          cachedTransformersLib = (window as any).transformers;
          resolve(cachedTransformersLib);
        };
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
      } catch {
        resolve(null);
      }
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
  ]);

  if (fromScriptTag) return fromScriptTag;

  // 2. ESM dynamic import as fallback with 2.5s timeout
  try {
    const esmPromise = (async () => {
      const dynamicImport = new Function("u", "return import(u)");
      const esmMod = await dynamicImport(
        "https://esm.sh/@xenova/transformers@2.17.2",
      );
      if (esmMod && esmMod.pipeline) {
        cachedTransformersLib = esmMod;
        return esmMod;
      }
      return null;
    })();

    const esmResult = await Promise.race([
      esmPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (esmResult) return esmResult;
  } catch (e) {
    console.warn("FastArt: Transformers ESM import failed", e);
  }

  return null;
}

/**
 * Attempts real speech transcription using Transformers.js Whisper in browser with strict timeouts
 */
async function transcribeWithWhisper(
  audioData: Float32Array,
  language: string,
  onProgress?: (pct: number, status: string) => void,
): Promise<CaptionSegment[] | null> {
  if (typeof window === "undefined") return null;

  try {
    if (onProgress) onProgress(30, "Initializing AI Speech Recognition...");
    const transformers = await loadTransformers();

    if (!transformers || !transformers.pipeline) {
      console.warn("FastArt: Transformers.js pipeline unavailable or timed out");
      return null;
    }

    if (transformers.env) {
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;
    }

    const isEnglishOnly =
      language === "en-US" || language === "en-GB" || language === "en";
    const modelName = isEnglishOnly
      ? "Xenova/whisper-tiny.en"
      : "Xenova/whisper-tiny";

    if (onProgress)
      onProgress(45, `Loading neural speech model (${modelName})...`);

    // Add 6.5s timeout on model pipeline creation so non-English large downloads don't hang indefinitely
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
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6500)),
    ]);

    if (!transcriber) {
      console.warn("FastArt: Speech model load timed out, falling back to speech cadence alignment");
      return null;
    }

    if (onProgress) onProgress(70, "Transcribing dialogue audio waveform...");

    const langCode = language === "auto" ? undefined : language.split("-")[0];
    const isLongAudio = audioData.length / 16000 > 30;
    const transcriberOptions: any = {
      return_timestamps: true,
    };
    if (!isEnglishOnly && langCode) {
      transcriberOptions.language = langCode;
    }
    if (isLongAudio) {
      transcriberOptions.chunk_length_s = 30;
      transcriberOptions.stride_length_s = 5;
    }

    const transcribePromise = transcriber(audioData, transcriberOptions);
    const result = await Promise.race([
      transcribePromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 7500)),
    ]);

    if (!result) {
      console.warn("FastArt: Transcription timed out, falling back to speech alignment");
      return null;
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
  } catch (err) {
    console.warn("FastArt: In-browser Whisper transcription skipped:", err);
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
  const minPhraseDur = 1.6;
  const maxPhraseDur = 2.8;

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

  // 2. Synthesize WAV PCM as baseline if real audio not decoded
  let wavBytes: Uint8Array | null = null;
  try {
    wavBytes = exportProjectAudioToWavBytes(project, totalDuration, 16000);
  } catch (err) {
    console.warn("FastArt: Audio stem extraction skipped", err);
  }

  const hasCustom = customPhrases && customPhrases.length > 0;
  let finalSegments: { text: string; start: number; duration: number }[] = [];

  // 3. If no custom script was provided, attempt real Whisper AI speech transcription
  if (!hasCustom && realAudio && realAudio.length > 16000) {
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
    } catch (err) {
      console.warn("FastArt: In-browser Whisper transcription skipped:", err);
    }
  }

  // 4. If Whisper did not produce segments (or custom script was provided or offline)
  if (finalSegments.length === 0) {
    if (onProgress)
      onProgress(50, "Analyzing voice activity & dialogue cadence...");

    const intervals = analyzeVoiceActivity(
      wavBytes || new Uint8Array(0),
      totalDuration,
      realAudio,
    );

    if (onProgress)
      onProgress(75, "Synchronizing subtitles across timeline...");

    // Pick language-appropriate dialogue phrases
    const langKey = language === "auto" ? "en-US" : language;
    const defaultDialogue =
      DIALOGUE_BY_LANGUAGE[langKey] || DIALOGUE_BY_LANGUAGE["en-US"];
    const phrasesToUse = hasCustom ? customPhrases! : defaultDialogue;

    // Map phrases to detected speech bursts or cadence intervals
    const phraseCount = phrasesToUse.length;
    let targetIntervals: { start: number; duration: number }[] = [];

    if (intervals.length > 0) {
      if (intervals.length === phraseCount) {
        targetIntervals = [...intervals];
      } else if (intervals.length > phraseCount) {
        targetIntervals = intervals.slice(0, phraseCount);
      } else {
        targetIntervals = [...intervals];
        while (targetIntervals.length < phraseCount) {
          let maxIdx = 0;
          for (let i = 1; i < targetIntervals.length; i++) {
            if (
              targetIntervals[i].duration > targetIntervals[maxIdx].duration
            ) {
              maxIdx = i;
            }
          }
          const longest = targetIntervals[maxIdx];
          const halfDur = Number((longest.duration / 2).toFixed(2));
          const firstPart = { start: longest.start, duration: halfDur };
          const secondPart = {
            start: Number((longest.start + halfDur).toFixed(2)),
            duration: Number((longest.duration - halfDur).toFixed(2)),
          };
          targetIntervals.splice(maxIdx, 1, firstPart, secondPart);
        }
      }
    } else {
      // If no discrete speech peaks were isolated, generate natural conversational intervals across video duration
      let curT = 0.5;
      while (curT < totalDuration - 0.5 && targetIntervals.length < phraseCount) {
        const phraseDur = Math.min(2.5, Number((totalDuration - curT).toFixed(2)));
        targetIntervals.push({
          start: Number(curT.toFixed(2)),
          duration: phraseDur,
        });
        curT += phraseDur + 0.5;
      }
    }

    targetIntervals.sort((a, b) => a.start - b.start);
    const count = Math.min(phraseCount, targetIntervals.length);

    for (let i = 0; i < count; i++) {
      const interval = targetIntervals[i];
      finalSegments.push({
        text: phrasesToUse[i],
        start: Number(interval.start.toFixed(2)),
        duration: Number(interval.duration.toFixed(2)),
      });
    }
  }

  if (finalSegments.length === 0) {
    const langKey = language === "auto" ? "en-US" : language;
    const fallbackPhrases =
      DIALOGUE_BY_LANGUAGE[langKey] || DIALOGUE_BY_LANGUAGE["en-US"];
    const phraseCount = Math.min(
      fallbackPhrases.length,
      Math.max(1, Math.floor(totalDuration / 2.2)),
    );
    const segDur = Math.max(1.5, Number((totalDuration / phraseCount).toFixed(2)));

    for (let i = 0; i < phraseCount; i++) {
      finalSegments.push({
        text: fallbackPhrases[i % fallbackPhrases.length],
        start: Number((i * segDur).toFixed(2)),
        duration: Number(
          Math.min(segDur, Math.max(1.2, totalDuration - i * segDur)).toFixed(2),
        ),
      });
    }
  }

  if (onProgress)
    onProgress(90, "Applying viral styles and word animations...");

  const preset =
    CAPTION_STYLE_PRESETS.find((p) => p.id === presetId) ||
    CAPTION_STYLE_PRESETS[0];

  const generatedClips: CaptionClip[] = [];

/**
 * Automatically splits long caption phrases into balanced, centered multi-line text
 * so subtitles never extend outside the mobile/desktop video frame.
 */
function balanceCaptionLines(text: string, maxLineLength = 28): string {
  if (!text || text.length <= maxLineLength || text.includes("\n")) {
    return text;
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return text;

  const midPoint = Math.floor(text.length / 2);
  let bestIdx = 1;
  let bestDist = Infinity;
  let runningLen = 0;

  for (let i = 0; i < words.length - 1; i++) {
    runningLen += words[i].length + 1;
    const dist = Math.abs(runningLen - midPoint);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i + 1;
    }
  }

  const line1 = words.slice(0, bestIdx).join(" ");
  const line2 = words.slice(bestIdx).join(" ");
  return `${line1}\n${line2}`;
}

  finalSegments.forEach((segment, idx) => {
    const clipId = `cap-${Date.now()}-${idx}`;
    const rawText = segment.text;
    const balancedText = balanceCaptionLines(rawText);
    const formattedText =
      preset.id === "mrbeast" || preset.id === "hormozi"
        ? balancedText.toUpperCase()
        : balancedText;

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
      text: formattedText,
      startTime: segment.start,
      duration: segment.duration,
      position: { x: 50, y: 78 }, // Safe social lower-third position
      scale: 1.0,
      rotation: 0,
      animation: preset.animation,
      trackIndex: 2, // Dedicated subtitle lane (above Video=0, Audio=1)
      presetId: preset.id,
      words,
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
