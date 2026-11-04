/**
 * FastArt Mobile AI Whisper Engine
 *
 * Runs client-side Transformers.js Whisper AI via the on-device WebBridge.
 * 100% Free, zero API keys, zero microphone permissions, pure on-device neural AI transcription.
 */

import { FastArtProject } from "../types/project";
import { requestWhisperTranscription, CaptionSegment } from "./mobileWhisperBridge";

export type { CaptionSegment };

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
  signal?: AbortSignal,
): Promise<CaptionSegment[]> {
  if (signal?.aborted) {
    throw new Error("Caption generation cancelled.");
  }

  if (onProgress) onProgress(25, "Running on-device Whisper AI model...");
  return requestWhisperTranscription(project, totalDuration, language, onProgress, signal);
}
