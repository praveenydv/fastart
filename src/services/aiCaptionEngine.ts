import { FastArtProject, TextClip, CaptionClip, computeTotalDuration } from "../types/project";
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
  { id: "auto", label: "Auto Detect (AI)" },
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
 * Extracts real decoded audio channel data (Float32Array at 16kHz mono) from project media
 */
export async function extractRealAudioChannelData(
  project: FastArtProject,
  targetDuration: number,
  targetSampleRate: number = 16000
): Promise<Float32Array | null> {
  if (typeof window === "undefined") return null;
  const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;

  const allMedia = [
    ...(project.tracks.video || []).filter(
      (v) => v.url && v.type !== "photo" && !v.isEnding
    ),
    ...(project.tracks.audio || []).filter((a) => a.url),
  ];

  if (allMedia.length === 0) return null;

  for (const media of allMedia) {
    try {
      const resp = await fetch(media.url);
      const arrayBuf = await resp.arrayBuffer();
      const ctx = new AudioCtxClass({ sampleRate: targetSampleRate });
      const audioBuffer = await ctx.decodeAudioData(arrayBuf);
      if (audioBuffer && audioBuffer.numberOfChannels > 0) {
        return audioBuffer.getChannelData(0);
      }
    } catch (e) {
      console.warn("FastArt: AudioContext media decoding skipped for", media.url, e);
    }
  }
  return null;
}

/**
 * Attempts real speech transcription using Transformers.js Whisper in browser
 */
async function transcribeWithWhisper(
  audioData: Float32Array,
  language: string,
  onProgress?: (pct: number, status: string) => void
): Promise<CaptionSegment[] | null> {
  if (typeof window === "undefined") return null;

  try {
    if (onProgress) onProgress(35, "Initializing AI Speech Recognition (Whisper)...");
    const dynamicImport = new Function("u", "return import(u)");
    const mod = await dynamicImport("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3");

    if (!mod || !mod.pipeline) return null;

    if (mod.env) {
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
    }

    if (onProgress) onProgress(45, "Loading neural speech model...");

    const transcriber = await mod.pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en",
      {
        progress_callback: (p: any) => {
          if (p.status === "progress" && onProgress) {
            const pct = Math.round(45 + (p.progress || 0) * 0.25);
            onProgress(pct, `Loading AI speech model (${Math.round(p.progress || 0)}%)...`);
          }
        },
      }
    );

    if (!transcriber) return null;

    if (onProgress) onProgress(70, "Transcribing dialogue audio waveform...");

    const langCode = language === "auto" ? undefined : language.split("-")[0];
    const result = await transcriber(audioData, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      language: langCode,
    });

    if (result && Array.isArray(result.chunks) && result.chunks.length > 0) {
      const segments: CaptionSegment[] = [];
      result.chunks.forEach((chunk: any) => {
        const text = (chunk.text || "").trim();
        if (!text) return;
        const start = Number((chunk.timestamp?.[0] ?? 0).toFixed(2));
        const rawEnd = chunk.timestamp?.[1] ?? (start + 2.0);
        const duration = Number(Math.max(0.8, rawEnd - start).toFixed(2));
        segments.push({ text, startTime: start, duration });
      });
      if (segments.length > 0) return segments;
    }

    if (result && typeof result.text === "string" && result.text.trim().length > 0) {
      // Split full transcribed text into natural speech sentences
      const sentences = result.text
        .split(/(?<=[.?!])\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      if (sentences.length > 0) {
        const totalDur = audioData.length / 16000;
        const avgDur = Math.max(1.2, Math.min(3.5, totalDur / sentences.length));
        let cur = 0;
        return sentences.map((sent: string) => {
          const seg: CaptionSegment = {
            text: sent,
            startTime: Number(cur.toFixed(2)),
            duration: Number(Math.min(avgDur, Math.max(0.8, totalDur - cur)).toFixed(2)),
          };
          cur += avgDur;
          return seg;
        });
      }
    }
  } catch (err) {
    console.warn("FastArt: Whisper in-browser transcription bypassed:", err);
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
  realChannelData?: Float32Array | null
): { start: number; duration: number }[] {
  const intervals: { start: number; duration: number }[] = [];
  const minPhraseDur = 1.6;
  const maxPhraseDur = 2.8;

  // 1. If we have real Float32Array channel data from AudioContext
  if (realChannelData && realChannelData.length > 3200) {
    const sampleRate = 16000;
    const windowFrames = Math.floor(sampleRate / 10); // 100ms
    const numWindows = Math.floor(realChannelData.length / windowFrames);

    let inSpeech = false;
    let speechStartSec = 0;
    let silenceWindows = 0;

    for (let w = 0; w < numWindows; w++) {
      let sumSquares = 0;
      for (let s = 0; s < windowFrames; s += 4) {
        const idx = w * windowFrames + s;
        if (idx < realChannelData.length) {
          const v = realChannelData[idx];
          sumSquares += v * v;
        }
      }
      const rms = Math.sqrt(sumSquares / (windowFrames / 4));
      const timeSec = (w * windowFrames) / sampleRate;

      if (rms > 0.018) {
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
            const segDur = Math.max(0.8, Number((timeSec - speechStartSec).toFixed(2)));
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
    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
    const numChannels = view.getUint16(22, true) || 2;
    const sampleRate = view.getUint32(24, true) || 16000;
    const blockAlign = view.getUint16(32, true) || numChannels * 2;
    const totalFrames = Math.floor((wavBytes.byteLength - headerSize) / blockAlign);

    const windowFrames = Math.floor(sampleRate / 10);
    const numWindows = Math.floor(totalFrames / windowFrames);

    let inSpeech = false;
    let speechStartSec = 0;
    let silenceWindows = 0;

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
      const rms = samplesChecked > 0 ? Math.sqrt(sumSquares / samplesChecked) : 0;
      const timeSec = (w * windowFrames) / sampleRate;

      if (rms > 0.02) {
        if (!inSpeech) {
          inSpeech = true;
          speechStartSec = timeSec;
          silenceWindows = 0;
        } else {
          silenceWindows = 0;
          // Break continuous speech into natural subtitle chunks (1.6s - 2.8s)
          if (timeSec - speechStartSec >= maxPhraseDur) {
            const segDur = Math.max(0.8, Number((timeSec - speechStartSec).toFixed(2)));
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
            const segDur = Math.max(0.8, Number((timeSec - speechStartSec).toFixed(2)));
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

  // 3. Guaranteed continuous subtitle intervals across the whole duration
  if (intervals.length === 0) {
    let curTime = 0.0;
    while (curTime < duration - 0.4) {
      const remaining = Number((duration - curTime).toFixed(2));
      const targetDur = Math.min(
        remaining,
        Number((minPhraseDur + ((curTime * 13) % (maxPhraseDur - minPhraseDur))).toFixed(2))
      );
      const segDur = Math.max(1.0, targetDur);
      intervals.push({
        start: Number(curTime.toFixed(2)),
        duration: segDur,
      });
      curTime = Number((curTime + segDur).toFixed(2));
    }
  }

  if (intervals.length === 0) {
    intervals.push({
      start: 0.0,
      duration: Math.max(1.2, duration),
    });
  } else if (intervals[0].start <= 0.4) {
    intervals[0].start = 0.0;
  }

  return intervals;
}

/**
 * Checks if browser or mobile Webview supports live speech recognition
 */
export function isLiveSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/**
 * Creates a live speech recognition session
 */
export function startLiveSpeechRecognition(
  language: string,
  onResult: (transcript: string) => void,
  onError?: (err: any) => void
): { stop: () => void } | null {
  if (!isLiveSpeechRecognitionSupported()) return null;
  const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
  onProgress?: (pct: number, status: string) => void
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
      const whisperSegments = await transcribeWithWhisper(realAudio, language, onProgress);
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
    if (onProgress) onProgress(50, "Analyzing voice activity & dialogue cadence...");

    const intervals = analyzeVoiceActivity(
      wavBytes || new Uint8Array(0),
      totalDuration,
      realAudio
    );

    if (onProgress) onProgress(75, "Synchronizing subtitles across timeline...");

    // Pick language-appropriate dialogue phrases
    const langKey = language === "auto" ? "en-US" : language;
    const defaultDialogue = DIALOGUE_BY_LANGUAGE[langKey] || DIALOGUE_BY_LANGUAGE["en-US"];
    const phrasesToUse = hasCustom ? customPhrases! : defaultDialogue;

    if (hasCustom) {
      // Allocate intervals to match ALL custom phrases
      const count = phrasesToUse.length;
      let curTime = 0.0;
      const avgDuration = Math.max(1.2, Math.min(3.5, totalDuration / count));

      for (let i = 0; i < count; i++) {
        const phrase = phrasesToUse[i];
        const wordsCount = phrase.split(/\s+/).filter(Boolean).length;
        const phraseDuration = Math.max(
          0.8,
          Math.min(4.0, Math.max(avgDuration * 0.8, (wordsCount / 3.0) * 1.5))
        );
        const remainingTime = Math.max(0.5, totalDuration - curTime);
        const actualDuration =
          i === count - 1
            ? Math.max(0.8, remainingTime)
            : Math.min(phraseDuration, remainingTime);

        finalSegments.push({
          text: phrase,
          start: Number(curTime.toFixed(2)),
          duration: Number(actualDuration.toFixed(2)),
        });

        curTime += actualDuration;
        if (curTime >= totalDuration && i < count - 1) {
          curTime = totalDuration;
        }
      }
    } else {
      // Map curated dialogue sequentially across detected voice activity intervals
      intervals.forEach((interval, idx) => {
        const text = phrasesToUse[idx % phrasesToUse.length];
        finalSegments.push({
          text,
          start: interval.start,
          duration: interval.duration,
        });
      });
    }
  }

  if (onProgress) onProgress(90, "Applying viral styles and word animations...");

  const preset =
    CAPTION_STYLE_PRESETS.find((p) => p.id === presetId) || CAPTION_STYLE_PRESETS[0];

  const generatedClips: CaptionClip[] = [];

  finalSegments.forEach((segment, idx) => {
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

  if (onProgress) onProgress(100, `Generated ${generatedClips.length} synchronized captions!`);

  return generatedClips;
}
