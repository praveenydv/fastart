/**
 * FastArt Mobile Whisper AI Bridge
 *
 * Runs client-side Transformers.js Whisper (Xenova/whisper-tiny.en) inside a headless
 * @expo/dom-webview on Android & iOS devices.
 *
 * Zero API keys required (100% Free).
 * Zero microphone permissions requested (no RECORD_AUDIO).
 * Decodes video & audio tracks directly via Web Audio API + WebAssembly,
 * achieving exact browser parity on mobile.
 */

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { FastArtProject, VideoClip, AudioClip } from "../types/project";
import { mediaHasAudioTrack, isMediaAudioDetected } from "../utils/mediaAudioDetector";

export interface CaptionSegment {
  text: string;
  startTime: number;
  duration: number;
}

export interface WhisperBridgeTask {
  id: string;
  htmlUri: string;
  onProgress?: (pct: number, status: string) => void;
  resolve: (segments: CaptionSegment[]) => void;
  reject: (err: any) => void;
}

type Listener = (task: WhisperBridgeTask | null) => void;
let activeListener: Listener | null = null;
let currentTask: WhisperBridgeTask | null = null;

export function registerWhisperBridgeListener(listener: Listener) {
  activeListener = listener;
  if (currentTask) {
    listener(currentTask);
  }
  return () => {
    if (activeListener === listener) {
      activeListener = null;
    }
  };
}

export function generateWhisperBridgeHtml(
  clips: Array<{
    url: string;
    startTime: number;
    duration: number;
    trimIn: number;
    speed: number;
    volume: number;
  }>,
  totalDuration: number,
  language: string = "en",
): string {
  const modelName =
    language && !language.startsWith("en") && language !== "auto"
      ? "Xenova/whisper-tiny"
      : "Xenova/whisper-tiny.en";

  const clipsJson = JSON.stringify(clips).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FastArt Whisper AI Engine</title>
</head>
<body style="background:#000; color:#fff; font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <div id="status">FastArt Speech Engine Ready</div>

  <script type="module">
    function send(type, data = {}) {
      try {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
        }
      } catch (e) {
        console.error("send error", e);
      }
    }

    window.onerror = function(msg, url, line) {
      send("ERROR", { message: (msg || "Script error") + " at line " + line });
    };

    async function loadTransformers() {
      const cdnUrls = [
        "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2",
        "https://esm.sh/@xenova/transformers@2.17.2",
        "https://unpkg.com/@xenova/transformers@2.17.2"
      ];
      for (const url of cdnUrls) {
        try {
          const mod = await import(url);
          if (mod && (mod.pipeline || mod.default?.pipeline)) {
            return mod.pipeline ? mod : mod.default;
          }
        } catch (e) {
          console.warn("Failed loading Transformers from " + url, e);
        }
      }
      throw new Error("Could not load AI speech engine. Please check your internet connection and try again.");
    }

    async function loadArrayBuffer(url) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab && ab.byteLength > 0) return ab;
        }
      } catch (_) {}

      return new Promise((resolve, reject) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 0) {
              resolve(xhr.response);
            } else {
              reject(new Error("Unable to read media file (status " + xhr.status + ")"));
            }
          };
          xhr.onerror = () => reject(new Error("File access error for " + url));
          xhr.send();
        } catch (xhrErr) {
          reject(xhrErr);
        }
      });
    }

    function resampleAudioBufferTo16k(audioBuf) {
      const inRate = audioBuf.sampleRate;
      const inLen = audioBuf.length;
      const outRate = 16000;
      const numCh = audioBuf.numberOfChannels;
      const outLen = Math.max(1, Math.round((inLen * outRate) / inRate));
      const result = new Float32Array(outLen);
      const ch0 = audioBuf.getChannelData(0);
      const ch1 = numCh > 1 ? audioBuf.getChannelData(1) : null;
      const ratio = (inLen - 1) / Math.max(1, outLen - 1);

      for (let i = 0; i < outLen; i++) {
        const srcPos = i * ratio;
        const idx = Math.floor(srcPos);
        const frac = srcPos - idx;
        const nextIdx = Math.min(idx + 1, inLen - 1);
        let s1 = ch0[idx];
        let s2 = ch0[nextIdx];
        if (ch1) {
          s1 = (s1 + ch1[idx]) * 0.5;
          s2 = (s2 + ch1[nextIdx]) * 0.5;
        }
        result[i] = s1 + (s2 - s1) * frac;
      }
      return result;
    }

    const DB_NAME = "fastart_whisper_cache";
    const STORE_NAME = "model_files";

    function openModelDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async function getCachedFile(key) {
      try {
        const db = await openModelDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
      } catch (_) {
        return null;
      }
    }

    async function putCachedFile(key, blob) {
      try {
        const db = await openModelDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(blob, key);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      } catch (_) {}
    }

    const customCache = {
      async match(request) {
        const url = typeof request === "string" ? request : request.url;
        const key = url.split("?")[0];
        const cachedBlob = await getCachedFile(key);
        if (cachedBlob) {
          return new Response(cachedBlob, {
            status: 200,
            headers: { "Content-Type": "application/octet-stream" }
          });
        }
        return undefined;
      },
      async put(request, response) {
        try {
          const url = typeof request === "string" ? request : request.url;
          const key = url.split("?")[0];
          const blob = await response.clone().blob();
          await putCachedFile(key, blob);
        } catch (_) {}
      }
    };

    async function run() {
      try {
        const CLIPS = ${clipsJson};
        const TOTAL_DURATION = Math.max(1.0, ${totalDuration});
        const MODEL_NAME = "${modelName}";

        send("PROGRESS", { pct: 20, status: "Connecting to AI speech recognition engine..." });

        const transformers = await loadTransformers();

        if (transformers.env) {
          transformers.env.allowLocalModels = false;
          transformers.env.useBrowserCache = false;
          transformers.env.useCustomCache = true;
          transformers.env.customCache = customCache;
          if (transformers.env.backends && transformers.env.backends.onnx) {
            transformers.env.backends.onnx.logLevel = "error";
            if (transformers.env.backends.onnx.wasm) {
              transformers.env.backends.onnx.wasm.numThreads = 1;
            }
          }
        }

        const encoderUrl = "https://huggingface.co/" + MODEL_NAME + "/resolve/main/onnx/encoder_model.onnx";
        const hasModelInLocalCache = Boolean(await getCachedFile(encoderUrl));

        if (hasModelInLocalCache) {
          send("PROGRESS", { pct: 60, status: "Loading AI speech model from device storage..." });
        } else {
          send("PROGRESS", { pct: 25, status: "Downloading AI speech model (saved locally for future use)..." });
        }

        let maxModelProgress = hasModelInLocalCache ? 100 : 0;
        let lastReportedOverallPct = hasModelInLocalCache ? 60 : 25;

        function getWeightedModelProgress(p) {
          if (!p) return maxModelProgress;
          const file = (p.file || "").toLowerCase();
          const filePct = Math.max(0, Math.min(100, Number(p.progress) || 0));

          // Weight files according to their actual size in Whisper model:
          // config & tokenizer: ~2MB total (~8%)
          // encoder_model.onnx: ~18MB (~44%)
          // decoder_model_merged.onnx: ~19MB (~48%)
          let calculated = 0;
          if (file.includes("decoder")) {
            calculated = 52 + filePct * 0.48;
          } else if (file.includes("encoder")) {
            calculated = 8 + filePct * 0.44;
          } else if (file.includes("tokenizer") || file.includes("config")) {
            calculated = Math.min(8, filePct * 0.08);
          } else {
            calculated = filePct;
          }

          if (calculated > maxModelProgress) {
            maxModelProgress = calculated;
          }
          return Math.min(100, Math.round(maxModelProgress));
        }

        const transcriber = await transformers.pipeline(
          "automatic-speech-recognition",
          MODEL_NAME,
          {
            session_options: { logSeverityLevel: 3 },
            progress_callback: (p) => {
              if (p && p.status === "progress" && !hasModelInLocalCache) {
                const modelPct = getWeightedModelProgress(p);
                const overallPct = Math.round(25 + (modelPct * 0.45));
                if (overallPct > lastReportedOverallPct) {
                  lastReportedOverallPct = overallPct;
                  send("PROGRESS", {
                    pct: overallPct,
                    status: "Downloading AI speech model (" + modelPct + "%)..."
                  });
                }
              }
            }
          }
        );

        send("PROGRESS", { pct: 72, status: "Analyzing dialogue audio in video..." });

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          throw new Error("Web Audio API not supported on this device.");
        }
        const actx = new AudioCtx();

        const totalSamples = Math.ceil(TOTAL_DURATION * 16000);
        const masterBuffer = new Float32Array(totalSamples);
        let hasDecodedAnyAudio = false;

        for (const clip of CLIPS) {
          if (!clip.url) continue;
          try {
            const arrayBuf = await loadArrayBuffer(clip.url);
            if (arrayBuf && arrayBuf.byteLength > 0) {
              const audioBuf = await actx.decodeAudioData(arrayBuf.slice(0));
              if (audioBuf && audioBuf.length > 0) {
                const resampled = resampleAudioBufferTo16k(audioBuf);
                const clipStartSample = Math.floor((clip.startTime || 0) * 16000);
                const clipNumSamples = Math.floor((clip.duration || 5) * 16000);
                const trimInSamples = Math.floor((clip.trimIn || 0) * 16000);
                const vol = clip.volume !== undefined ? clip.volume : 1.0;
                const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;

                for (let i = 0; i < clipNumSamples; i++) {
                  const mIdx = clipStartSample + i;
                  if (mIdx >= totalSamples) break;
                  const sIdx = trimInSamples + Math.floor(i * speed);
                  if (sIdx < resampled.length) {
                    masterBuffer[mIdx] += resampled[sIdx] * vol;
                  }
                }
                hasDecodedAnyAudio = true;
              }
            }
          } catch (clipErr) {
            console.warn("Failed decoding audio for clip " + clip.url, clipErr);
          }
        }

        try { actx.close(); } catch (_) {}

        if (!hasDecodedAnyAudio) {
          throw new Error("Could not decode audio from the video's media files. Please check if the video has an audible sound track.");
        }

        // Soft clamp master audio [-1.0, 1.0]
        for (let i = 0; i < masterBuffer.length; i++) {
          const val = masterBuffer[i];
          if (val > 1.0) masterBuffer[i] = 1.0;
          else if (val < -1.0) masterBuffer[i] = -1.0;
        }

        send("PROGRESS", { pct: 85, status: "Transcribing speech into subtitle cues..." });

        const isLong = TOTAL_DURATION > 30;
        const options = { return_timestamps: true };
        if (isLong) {
          options.chunk_length_s = 30;
          options.stride_length_s = 5;
        }

        const result = await transcriber(masterBuffer, options);

        const segments = [];
        if (result && Array.isArray(result.chunks) && result.chunks.length > 0) {
          result.chunks.forEach((chunk) => {
            const text = (chunk.text || "").trim();
            if (!text) return;
            const start = Number((chunk.timestamp?.[0] ?? 0).toFixed(2));
            const rawEnd = chunk.timestamp?.[1] ?? (start + 2.0);
            const duration = Number(Math.max(0.6, rawEnd - start).toFixed(2));
            segments.push({ text, startTime: start, duration });
          });
        } else if (result && typeof result.text === "string" && result.text.trim()) {
          const text = result.text.trim();
          segments.push({ text, startTime: 0, duration: Math.max(1.5, TOTAL_DURATION) });
        }

        send("COMPLETE", { segments });
      } catch (err) {
        send("ERROR", { message: err?.message || String(err) });
      }
    }

    window.addEventListener("DOMContentLoaded", run);
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(run, 50);
    }
  </script>
</body>
</html>`;
}

export async function requestWhisperTranscription(
  project: FastArtProject,
  totalDuration: number,
  language: string = "en",
  onProgress?: (pct: number, status: string) => void,
): Promise<CaptionSegment[]> {
  // 1. Gather all clips containing audio
  const videoClips = (project.tracks.video || []).filter(
    (v) =>
      Boolean(v.url) &&
      v.type !== "photo" &&
      !v.isEnding &&
      v.hasAudio !== false &&
      !v.muted &&
      (v.volume === undefined || v.volume > 0) &&
      (mediaHasAudioTrack(v) || isMediaAudioDetected(v.id || v.url) !== false || Platform.OS !== "web"),
  );

  const audioClips = (project.tracks.audio || []).filter(
    (a) => Boolean(a.url) && !(a as any).muted && (a.volume === undefined || a.volume > 0),
  );

  const rawSoundClips = [...videoClips, ...audioClips];
  if (rawSoundClips.length === 0) {
    throw new Error(
      "No audible clips detected in this project. Please add video or audio with speech, or import an .SRT file."
    );
  }

  // 2. Prepare file URLs: convert any content:// to local cached file:// URLs so WebView can read them
  if (onProgress) onProgress(15, "Preparing media audio for AI transcription...");

  const preparedClips: Array<{
    url: string;
    startTime: number;
    duration: number;
    trimIn: number;
    speed: number;
    volume: number;
  }> = [];

  const tempFilesToClean: string[] = [];

  for (let i = 0; i < rawSoundClips.length; i++) {
    const clip = rawSoundClips[i];
    let safeUrl = clip.url;

    if (safeUrl.startsWith("content://")) {
      const ext = safeUrl.includes(".wav") ? "wav" : safeUrl.includes(".mp3") ? "mp3" : "mp4";
      const dest = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}caption_media_${Date.now()}_${i}.${ext}`;
      try {
        await FileSystem.copyAsync({ from: safeUrl, to: dest });
        safeUrl = dest;
        tempFilesToClean.push(dest);
      } catch (_) {
        try {
          const b64 = await FileSystem.readAsStringAsync(safeUrl, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await FileSystem.writeAsStringAsync(dest, b64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          safeUrl = dest;
          tempFilesToClean.push(dest);
        } catch (readErr) {
          console.warn("Failed preparing content URI for captioning:", readErr);
        }
      }
    }

    if (safeUrl.startsWith("/") && !safeUrl.startsWith("file://")) {
      safeUrl = `file://${safeUrl}`;
    }

    preparedClips.push({
      url: safeUrl,
      startTime: Math.max(0, clip.startTime || 0),
      duration: Math.max(0.1, clip.duration || 5),
      trimIn: Math.max(0, clip.trimIn || 0),
      speed: Math.max(0.1, clip.speed || 1.0),
      volume: (clip.volume ?? 100) > 2 ? (clip.volume ?? 100) / 100 : (clip.volume ?? 1.0),
    });
  }

  // 3. Generate HTML & save to permanent document storage (preserves IndexedDB origin permanently)
  const html = generateWhisperBridgeHtml(preparedClips, totalDuration, language);
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";
  const bridgeHtmlPath = `${baseDir}fastart_whisper_engine.html`;
  await FileSystem.writeAsStringAsync(bridgeHtmlPath, html, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const htmlUri = bridgeHtmlPath.startsWith("file://") ? bridgeHtmlPath : `file://${bridgeHtmlPath}`;

  // 4. Delegate to mounted MobileWhisperTranscriberView via listener
  return new Promise<CaptionSegment[]>((resolve, reject) => {
    const task: WhisperBridgeTask = {
      id: "whisper_" + Date.now(),
      htmlUri,
      onProgress,
      resolve: (segments) => {
        currentTask = null;
        if (activeListener) activeListener(null);
        // Clean up temporary files
        tempFilesToClean.forEach((f) => {
          FileSystem.deleteAsync(f, { idempotent: true }).catch(() => {});
        });
        resolve(segments);
      },
      reject: (err) => {
        currentTask = null;
        if (activeListener) activeListener(null);
        tempFilesToClean.forEach((f) => {
          FileSystem.deleteAsync(f, { idempotent: true }).catch(() => {});
        });
        reject(err);
      },
    };

    currentTask = task;

    if (activeListener) {
      activeListener(task);
    } else {
      setTimeout(() => {
        if (currentTask === task) {
          task.reject(
            new Error("Speech recognition bridge view is not mounted. Please ensure AutoCaptionModal is open.")
          );
        }
      }, 5000);
    }
  });
}
