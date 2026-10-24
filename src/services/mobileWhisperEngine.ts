/**
 * FastArt Mobile Speech Recognition Engine
 *
 * Provides on-device native speech recognition via Android SpeechRecognizer
 * & iOS Apple Speech Recognition (via expo-speech-recognition) with zero API keys.
 *
 * Gracefully detects whether native modules are linked in the current APK build
 * and seamlessly falls back to Cloud AI if configured.
 */

import { Platform } from "react-native";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { FastArtProject } from "../types/project";
import { getStorageItem } from "../utils/storage";

export interface CaptionSegment {
  text: string;
  startTime: number;
  duration: number;
}

/**
 * Safely inspect if the native speech recognition module is loaded in the binary
 */
async function loadNativeSpeechModule(): Promise<{
  module: any;
  encodingAndroid: any;
} | null> {
  try {
    const mod = await import("expo-speech-recognition");
    const module = mod?.ExpoSpeechRecognitionModule;
    if (!module) return null;

    let isAvailable = false;
    const anyMod = module as any;
    if (typeof anyMod.isAvailableAsync === "function") {
      isAvailable = await anyMod.isAvailableAsync().catch(() => false);
    } else if (typeof anyMod.start === "function") {
      isAvailable = true;
    }

    if (isAvailable) {
      return {
        module,
        encodingAndroid: mod.AudioEncodingAndroid,
      };
    }
    return null;
  } catch (err: any) {
    console.warn("FastArt: Native speech module not available in this build:", err?.message || err);
    return null;
  }
}

/**
 * Splits transcript text into natural 2-4 word caption segments
 * if word timestamps are not returned by the platform recognizer.
 */
function splitTranscriptIntoTimedSegments(
  text: string,
  totalDuration: number,
  maxWordsPerCue: number = 3,
): CaptionSegment[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerCue) {
    chunks.push(words.slice(i, i + maxWordsPerCue).join(" "));
  }

  const numChunks = chunks.length;
  const safeDur = Math.max(1.0, totalDuration);
  const timePerChunk = Math.min(2.0, Math.max(0.6, (safeDur * 0.95) / numChunks));

  const segments: CaptionSegment[] = [];
  let currentStart = 0.2;

  for (let i = 0; i < numChunks; i++) {
    const dur = Math.min(timePerChunk, Number((safeDur - currentStart).toFixed(2)));
    if (dur <= 0.1) break;

    segments.push({
      text: chunks[i],
      startTime: Number(currentStart.toFixed(2)),
      duration: Math.max(0.4, dur),
    });

    currentStart += dur + 0.05;
    if (currentStart >= safeDur) break;
  }

  return segments;
}

/**
 * Transcribe using native Android (Google Speech) or iOS (Apple Speech)
 */
async function transcribeWithNativeSpeech(
  audioUri: string,
  speechModule: any,
  encodingAndroid: any,
  language: string = "en-US",
  totalDuration: number = 5,
  onProgress?: (pct: number, status: string) => void,
): Promise<CaptionSegment[]> {
  // Check and prompt for speech recognition permission if not yet granted
  if (typeof speechModule.getPermissionsAsync === "function") {
    const current = await speechModule.getPermissionsAsync().catch(() => null);
    if (!current?.granted && typeof speechModule.requestPermissionsAsync === "function") {
      if (onProgress) onProgress(35, "Requesting speech recognition permission...");
      const requested = await speechModule.requestPermissionsAsync().catch(() => null);
      if (!requested?.granted) {
        throw new Error(
          "Android requires speech recognition permission to process video audio. Please tap 'Allow' when prompted, or import an .SRT file."
        );
      }
    }
  }

  if (onProgress) onProgress(45, "Transcribing spoken dialogue from video...");

  const audioEncoding = encodingAndroid?.ENCODING_PCM_16BIT ?? 2;

  return new Promise<CaptionSegment[]>((resolve, reject) => {
    let capturedSegments: CaptionSegment[] = [];
    let fullTranscript = "";
    let isDone = false;

    const subResult = speechModule.addListener("result", (event: any) => {
      if (event.results && event.results.length > 0) {
        const top = event.results[0];
        if (top.transcript) {
          fullTranscript = top.transcript;
        }

        if (top.segments && top.segments.length > 0) {
          capturedSegments = top.segments
            .map((s: any) => ({
              text: (s.segment || "").trim(),
              startTime: Math.max(0, (s.startTimeMillis || 0) / 1000),
              duration: Math.max(
                0.2,
                ((s.endTimeMillis || 0) - (s.startTimeMillis || 0)) / 1000,
              ),
            }))
            .filter((s: CaptionSegment) => s.text.length > 0);
        }
      }
    });

    const cleanup = () => {
      try { subResult.remove(); } catch (_) {}
      try { subEnd.remove(); } catch (_) {}
      try { subError.remove(); } catch (_) {}
    };

    const finish = () => {
      if (isDone) return;
      isDone = true;
      cleanup();
      try { speechModule.stop(); } catch (_) {}

      if (capturedSegments.length > 0) {
        resolve(capturedSegments);
      } else if (fullTranscript.trim().length > 0) {
        resolve(splitTranscriptIntoTimedSegments(fullTranscript.trim(), totalDuration));
      } else {
        resolve([]);
      }
    };

    const subEnd = speechModule.addListener("end", () => {
      finish();
    });

    const subError = speechModule.addListener("error", (event: any) => {
      console.warn("FastArt: Native speech recognition event error:", event);
      if (!isDone) {
        if (capturedSegments.length > 0 || fullTranscript.trim().length > 0) {
          finish();
        } else {
          isDone = true;
          cleanup();
          reject(new Error(event?.message || `Native speech error (${event?.error})`));
        }
      }
    });

    const timeout = setTimeout(() => {
      if (!isDone) {
        finish();
      }
    }, Math.max(15000, Math.min(60000, totalDuration * 2000)));

    try {
      speechModule.start({
        lang: language === "auto" ? "en-US" : language,
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: false,
        audioSource: {
          uri: audioUri,
          audioEncoding,
          sampleRate: 44100,
          audioChannels: 2,
        },
      });
    } catch (startErr) {
      clearTimeout(timeout);
      cleanup();
      reject(startErr);
    }
  });
}

/**
 * Main entry point for mobile speech transcription.
 * Uses Whisper AI directly on the video's audio with ZERO microphone permissions needed
 * and ZERO API keys required (100% Free browser parity).
 */
export async function transcribeMobileSpeech(
  project: FastArtProject,
  totalDuration: number,
  language: string = "en-US",
  onProgress?: (pct: number, status: string) => void,
): Promise<CaptionSegment[]> {
  // 1. If user optionally configured a Cloud Whisper key, use it for ultra-fast processing
  const savedKey = getStorageItem("@fastart_whisper_api_key");
  if (savedKey && savedKey.trim()) {
    try {
      if (onProgress) onProgress(30, "Transcribing with Whisper AI...");
      const { transcribeWithCloudWhisper } = await import("./aiCaptionEngine");
      const { exportProjectAudioToWavBytes } = await import("../utils/audioExporter");
      const wavBytes = await exportProjectAudioToWavBytes(project, totalDuration);
      const cloudSegments = await transcribeWithCloudWhisper(wavBytes, onProgress);
      if (cloudSegments && cloudSegments.length > 0) {
        return cloudSegments.map((cs) => ({
          text: cs.text,
          startTime: cs.startTime,
          duration: cs.duration,
        }));
      }
    } catch (cloudErr: any) {
      console.warn("FastArt: Cloud Whisper error, falling back to local free engine:", cloudErr);
    }
  }

  // 2. Free on-device Whisper AI via Web Bridge (zero API keys, zero mic permissions, browser parity)
  const { requestWhisperTranscription } = await import("./mobileWhisperBridge");
  return requestWhisperTranscription(project, totalDuration, language, onProgress);
}
