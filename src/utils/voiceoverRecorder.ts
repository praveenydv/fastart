/**
 * FastArt Live Voiceover Recorder
 * 
 * Hardware microphone recording with real-time VU meter analysis and automatic
 * duration calculation. Exports to playable audio data URI / Blob URL.
 */

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let animFrameId: number | null = null;
let recordingStartTime = 0;

export async function isMicPermissionAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  return true;
}

export async function startVoiceoverRecording(
  onLevelUpdate?: (normalizedLevel: number) => void
): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported in this environment');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    audioChunks = [];
    recordingStartTime = Date.now();

    // Setup real-time VU audio meter
    try {
      const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(mediaStream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        source.connect(analyserNode);

        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        const pollLevel = () => {
          if (!analyserNode) return;
          analyserNode.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const norm = Math.min(1.0, Math.max(0, avg / 128));
          if (onLevelUpdate) {
            onLevelUpdate(norm);
          }
          if (typeof requestAnimationFrame !== 'undefined') {
            animFrameId = requestAnimationFrame(pollLevel);
          }
        };
        pollLevel();
      }
    } catch (e) {
      console.warn('[voiceoverRecorder] AudioContext VU meter fallback:', e);
    }

    // Determine supported mimeType
    let mimeType = 'audio/webm';
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }
    }

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(100); // 100ms chunk timeslices
    return true;
  } catch (err) {
    console.warn('[voiceoverRecorder] Failed to start recording:', err);
    cleanup();
    throw err;
  }
}

export async function stopVoiceoverRecording(): Promise<{ url: string; duration: number } | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      cleanup();
      resolve(null);
      return;
    }

    const duration = Math.max(0.5, (Date.now() - recordingStartTime) / 1000);

    mediaRecorder.onstop = async () => {
      try {
        const mimeType = mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunks, { type: mimeType });
        let url = '';
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          url = URL.createObjectURL(blob);
        } else if (typeof FileReader !== 'undefined') {
          const reader = new FileReader();
          url = await new Promise<string>((res) => {
            reader.onloadend = () => res((reader.result as string) || '');
            reader.readAsDataURL(blob);
          });
        }
        cleanup();
        resolve({ url, duration });
      } catch (e) {
        console.warn('[voiceoverRecorder] Error packaging recording blob:', e);
        cleanup();
        resolve(null);
      }
    };

    mediaRecorder.stop();
  });
}

function cleanup() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (audioContext) {
    try {
      audioContext.close();
    } catch {}
    audioContext = null;
  }
  analyserNode = null;
  if (mediaStream) {
    try {
      mediaStream.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaStream = null;
  }
  mediaRecorder = null;
  audioChunks = [];
}

