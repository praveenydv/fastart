import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { FastArtProject } from "../../types/project";
import { setCachedMediaDuration } from "../../utils/mediaDuration";

interface UsePlayerAudioSyncProps {
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
}

export function usePlayerAudioSync({
  project,
  currentTime,
  isPlaying,
}: UsePlayerAudioSyncProps) {
  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});
  const audioCtxRef = useRef<any>(null);
  const audioNodesRef = useRef<{
    [id: string]: {
      source: any;
      highpass: any;
      lowpass: any;
      compressor: any;
      gain: any;
    };
  }>({});

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    // 1. Gather all active sound sources: dedicated audio tracks + video clips with audio
    const rawAudioClips = (project.tracks.audio || []).map((a) => ({
      id: a.id,
      sourceClipId: a.id,
      url: a.url,
      startTime: a.startTime || 0,
      duration: a.duration || 10,
      trimIn: a.trimIn || 0,
      volume: a.volume ?? 1.0,
      fadeIn: a.fadeIn || 0,
      fadeOut: a.fadeOut || 0,
      speed: a.speed || 1.0,
      denoise: Boolean(a.denoise || project.aiDenoise),
      isFromVideo: false,
    }));

    const videoAudioClips = (project.tracks.video || [])
      .filter((v) => v.type === "video" && !v.isEnding && Boolean(v.url))
      .map((v) => ({
        id: `vid-audio-${v.id}`,
        sourceClipId: v.id,
        url: v.url,
        startTime: v.startTime || 0,
        duration: v.duration || 10,
        trimIn: v.trimIn || 0,
        volume: v.volume ?? 1.0,
        fadeIn: v.fadeIn || 0,
        fadeOut: v.fadeOut || 0,
        speed: v.speed || 1.0,
        denoise: Boolean(v.denoise || project.aiDenoise),
        isFromVideo: true,
      }));

    const allSoundSources = [...rawAudioClips, ...videoAudioClips];
    const activeIds = new Set(allSoundSources.map((a) => a.id));

    // Cleanup and release hardware audio decoders for removed tracks
    Object.keys(audioElementsRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        const el = audioElementsRef.current[id];
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch {}
        delete audioElementsRef.current[id];
        delete audioNodesRef.current[id];
      }
    });

    // Initialize or resume shared Web Audio Context
    let actx = audioCtxRef.current;
    if (!actx || actx.state === "closed") {
      try {
        const AudioCtxClass =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          actx = new AudioCtxClass();
          audioCtxRef.current = actx;
        }
      } catch {}
    }
    if (actx && actx.state === "suspended" && isPlaying) {
      actx.resume().catch(() => {});
    }

    allSoundSources.forEach((clip) => {
      let el = audioElementsRef.current[clip.id];
      if (!el || el.src !== clip.url) {
        if (el) {
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
          } catch {}
          delete audioNodesRef.current[clip.id];
        }
        el = new Audio();
        if (clip.url.startsWith("http") && !clip.url.includes("localhost") && !clip.url.includes("127.0.0.1")) {
          el.crossOrigin = "anonymous";
        }
        el.src = clip.url;
        el.addEventListener("loadedmetadata", () => {
          if (
            el.duration &&
            !isNaN(el.duration) &&
            isFinite(el.duration) &&
            el.duration > 0
          ) {
            setCachedMediaDuration(clip.url, el.duration);
            if (clip.sourceClipId) setCachedMediaDuration(clip.sourceClipId, el.duration);
          }
        });
        audioElementsRef.current[clip.id] = el;
      }

      // Attach Web Audio API Denoise DSP Filter Chain if supported and not yet attached
      if (actx && el && !audioNodesRef.current[clip.id]) {
        try {
          const source = actx.createMediaElementSource(el);

          // 1. Highpass filter to eliminate low-frequency rumble, AC mains hum (50/60Hz), and mic handling thumps
          const highpass = actx.createBiquadFilter();
          highpass.type = "highpass";
          highpass.frequency.value = clip.denoise ? 95 : 10;
          highpass.Q.value = 0.707;

          // 2. Lowpass filter to attenuate high-frequency preamp hiss, digital quantization hiss, and white noise
          const lowpass = actx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.value = clip.denoise ? 9500 : 22000;
          lowpass.Q.value = 0.707;

          // 3. Dynamics Noise Gate & Compressor to suppress background room noise floor
          const compressor = actx.createDynamicsCompressor();
          compressor.threshold.value = clip.denoise ? -36 : 0;
          compressor.knee.value = 12;
          compressor.ratio.value = clip.denoise ? 6 : 1;
          compressor.attack.value = 0.005;
          compressor.release.value = 0.2;

          // 4. Output gain node
          const gain = actx.createGain();
          gain.gain.value = 1.0;

          // Connect DSP chain: source -> highpass -> lowpass -> compressor -> gain -> destination
          source.connect(highpass);
          highpass.connect(lowpass);
          lowpass.connect(compressor);
          compressor.connect(gain);
          gain.connect(actx.destination);

          audioNodesRef.current[clip.id] = {
            source,
            highpass,
            lowpass,
            compressor,
            gain,
          };
        } catch {
          // If media element source creation fails (e.g. cross-origin restrictions), fallback to direct element volume
        }
      }

      const clipStart = clip.startTime || 0;
      const clipEnd = clipStart + (clip.duration || 0);
      const isInside = currentTime >= clipStart && currentTime <= clipEnd;

      const effSpeed = Math.max(0.1, clip.speed || 1.0);

      if (isPlaying && isInside) {
        const audioOffset = (currentTime - clipStart) * effSpeed + (clip.trimIn || 0);
        if (Math.abs(el.currentTime - audioOffset) > 0.25) {
          el.currentTime = Math.max(0, audioOffset);
        }

        // Calculate dynamic volume with fade-in and fade-out
        let effVol = Math.max(0, Math.min(1.0, clip.volume));
        if (clip.fadeIn > 0) {
          const elapsed = currentTime - clipStart;
          if (elapsed < clip.fadeIn) {
            effVol *= Math.max(0, elapsed / clip.fadeIn);
          }
        }
        if (clip.fadeOut > 0) {
          const remaining = clipEnd - currentTime;
          if (remaining < clip.fadeOut) {
            effVol *= Math.max(0, remaining / clip.fadeOut);
          }
        }

        const nodes = audioNodesRef.current[clip.id];
        const targetVol = clip.volume === 0 ? 0 : Math.max(0, Math.min(1.0, effVol));

        if (nodes && actx) {
          const now = actx.currentTime;
          // Apply active Denoise DSP filtering or transparent bypass
          if (clip.denoise) {
            nodes.highpass.frequency.setTargetAtTime(95, now, 0.02);
            nodes.lowpass.frequency.setTargetAtTime(9500, now, 0.02);
            nodes.compressor.threshold.setTargetAtTime(-36, now, 0.02);
            nodes.compressor.ratio.setTargetAtTime(6, now, 0.02);
          } else {
            nodes.highpass.frequency.setTargetAtTime(10, now, 0.02);
            nodes.lowpass.frequency.setTargetAtTime(22000, now, 0.02);
            nodes.compressor.threshold.setTargetAtTime(0, now, 0.02);
            nodes.compressor.ratio.setTargetAtTime(1, now, 0.02);
          }
          nodes.gain.gain.setTargetAtTime(targetVol, now, 0.02);
          el.muted = false;
        } else {
          // Direct element volume fallback
          if (clip.volume === 0) {
            el.muted = true;
            el.volume = 0;
          } else {
            el.muted = false;
            el.volume = targetVol;
          }
        }

        // Synchronize playback speed
        if (clip.speed > 0 && Math.abs(el.playbackRate - effSpeed) > 0.05) {
          el.playbackRate = Math.max(0.25, Math.min(4.0, effSpeed));
        }

        el.play().catch(() => {});
      } else {
        el.pause();
        if (isInside) {
          const audioOffset = (currentTime - clipStart) * effSpeed + (clip.trimIn || 0);
          el.currentTime = Math.max(0, audioOffset);
        }
      }
    });

    return () => {
      if (!isPlaying) {
        Object.values(audioElementsRef.current).forEach((el: any) => {
          try {
            el.pause();
          } catch {}
        });
      }
    };
  }, [isPlaying, project.tracks.audio, project.tracks.video, currentTime, project.aiDenoise]);

  return { audioElementsRef };
}
