import { useEffect, useRef, useState, useMemo } from "react";
import { Platform } from "react-native";
import { FastArtProject, VoiceEffectId } from "../../types/project";
import { setCachedMediaDuration } from "../../utils/mediaDuration";
import { setMediaHasAudio, mediaHasAudioTrack, subscribeMediaAudioChange } from "../../utils/mediaAudioDetector";
import { evaluateSpeedCurve } from "../../utils/renderer/rendererEffects";

interface UsePlayerAudioSyncProps {
  project: FastArtProject;
  currentTime: number;
  isPlaying: boolean;
}

// Global registry of active Web Audio elements for 0ms instantaneous hardware pause
export const globalActiveAudioElements = new Set<HTMLAudioElement>();

export function pauseAllAudio() {
  if (typeof window === "undefined") return;
  globalActiveAudioElements.forEach((el) => {
    try {
      el.pause();
    } catch {}
  });
}

export function usePlayerAudioSync({
  project,
  currentTime,
  isPlaying,
}: UsePlayerAudioSyncProps) {
  const [audioPresenceTick, setAudioPresenceTick] = useState(0);

  useEffect(() => {
    return subscribeMediaAudioChange(() => {
      setAudioPresenceTick((t) => t + 1);
    });
  }, []);

  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});
  const audioCtxRef = useRef<any>(null);
  const audioNodesRef = useRef<{
    [id: string]: {
      source: any;
      highpass: any;
      presence: any;
      lowpass: any;
      compressor: any;
      gain: any;
      voiceEqLow: any;
      voiceEqMid: any;
      voiceEqHigh: any;
      dryGain: any;
      wetGain: any;
      robotGain: any;
      robotOsc: any;
      megaphoneGain: any;
      echoGain: any;
      vinylGain: any;
      lastVoiceEffect?: VoiceEffectId;
      lastDenoise?: boolean;
      lastVol?: number;
    };
  }>({});
  const wasPlayingRef = useRef<boolean>(false);
  const pauseTimestampRef = useRef<number>(0);

  // 1. Memoize sound sources (audio tracks + video tracks with detected audio)
  const allSoundSources = useMemo(() => {
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
      speedCurve: a.speedCurve,
      keepPitch: (a as any).keepPitch,
      denoise: Boolean(a.denoise || project.aiDenoise),
      voiceEffect: (a.voiceEffect || "none") as VoiceEffectId,
      isFromVideo: false,
    }));

    const videoAudioClips = (project.tracks.video || [])
      .filter((v) => v.type === "video" && !v.isEnding && Boolean(v.url) && mediaHasAudioTrack(v))
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
        speedCurve: v.speedCurve,
        keepPitch: (v as any).keepPitch,
        denoise: Boolean(v.denoise || project.aiDenoise),
        voiceEffect: (v.voiceEffect || "none") as VoiceEffectId,
        isFromVideo: true,
      }));

    const rawSources = [...rawAudioClips, ...videoAudioClips];
    return rawSources.map((clip) => {
      const clipEnd = clip.startTime + clip.duration;
      const hasAdjacentAudio = rawSources.some(
        (other) =>
          other.id !== clip.id &&
          other.url === clip.url &&
          Math.abs(other.startTime - clipEnd) < 0.01,
      );
      return {
        ...clip,
        hasAdjacentAudio,
      };
    });
  }, [project.tracks.audio, project.tracks.video, project.aiDenoise, audioPresenceTick]);

  // 2. Audio Elements & Web Audio Nodes lifecycle (only when sound sources change)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const activeIds = new Set(allSoundSources.map((a) => a.id));

    // Release hardware audio decoders for removed tracks
    Object.keys(audioElementsRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        const el = audioElementsRef.current[id];
        if (el) {
          globalActiveAudioElements.delete(el);
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
          } catch {}
        }
        const nodeGroup = audioNodesRef.current[id];
        if (nodeGroup?.robotOsc) {
          try { nodeGroup.robotOsc.stop(); } catch {}
        }
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

    allSoundSources.forEach((clip) => {
      let el = audioElementsRef.current[clip.id];
      const existingUrl = (el as any)?._fastartUrl || "";
      if (!el || existingUrl !== clip.url) {
        if (el) {
          globalActiveAudioElements.delete(el);
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
          } catch {}
          delete audioNodesRef.current[clip.id];
        }
        el = new Audio();
        el.loop = false;
        globalActiveAudioElements.add(el);
        (el as any)._fastartUrl = clip.url;
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
            setMediaHasAudio(clip.url, true);
            if (clip.sourceClipId) setMediaHasAudio(clip.sourceClipId, true);
          }
        });
        el.addEventListener("error", (e) => {
          // Never mark clip as having no audio; an element error can happen
          // due to temporary browser decode delays, format differences, or stale blob URLs
          // that are being rehydrated upon page refresh.
          if (__DEV__) {
            console.debug(`[usePlayerAudioSync] Audio load notice for ${clip.id}:`, e);
          }
        });
        audioElementsRef.current[clip.id] = el;
      }

      // Attach Web Audio API Denoise & Audio FX DSP Filter Chain if supported and not yet attached
      if (actx && el && !audioNodesRef.current[clip.id]) {
        try {
          const source = actx.createMediaElementSource(el);

          // 1. Highpass filter to eliminate sub-bass rumble (<55Hz), DC drift & mic handling thumps
          const highpass = actx.createBiquadFilter();
          highpass.type = "highpass";
          highpass.frequency.value = clip.denoise ? 55 : 10;
          highpass.Q.value = 0.707;

          // 2. Vocal presence peaking filter for gentle speech intelligibility without harshness
          const presence = actx.createBiquadFilter();
          presence.type = "peaking";
          presence.frequency.value = 2800;
          presence.Q.value = 0.8;
          presence.gain.value = clip.denoise ? 1.2 : 0;

          // 3. Lowpass filter preserving natural vocal sibilance, air, and high-frequency brilliance
          const lowpass = actx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.value = clip.denoise ? 19000 : 22000;
          lowpass.Q.value = 0.707;

          // 4. Voice EQ Stage (for formant shifting & tonal character: Chipmunk, Deep Bass, Helium)
          const voiceEqLow = actx.createBiquadFilter();
          voiceEqLow.type = "lowshelf";
          voiceEqLow.frequency.value = 180;
          voiceEqLow.gain.value = 0;

          const voiceEqMid = actx.createBiquadFilter();
          voiceEqMid.type = "peaking";
          voiceEqMid.frequency.value = 2400;
          voiceEqMid.Q.value = 1.8;
          voiceEqMid.gain.value = 0;

          const voiceEqHigh = actx.createBiquadFilter();
          voiceEqHigh.type = "highshelf";
          voiceEqHigh.frequency.value = 4500;
          voiceEqHigh.gain.value = 0;

          // 5. Routing Gains (Dry / Wet)
          const fxInputGain = actx.createGain();
          fxInputGain.gain.value = 1.0;

          const dryGain = actx.createGain();
          dryGain.gain.value = 1.0;

          const wetGain = actx.createGain();
          wetGain.gain.value = 0.0;

          // 6. Robot Ring Modulator (55Hz carrier + bandpass)
          const robotModGain = actx.createGain();
          robotModGain.gain.value = 0.0;

          const robotOsc = actx.createOscillator();
          robotOsc.type = "sine";
          robotOsc.frequency.value = 55;
          robotOsc.connect(robotModGain.gain);
          try { robotOsc.start(); } catch {}

          const robotFilter = actx.createBiquadFilter();
          robotFilter.type = "bandpass";
          robotFilter.frequency.value = 1250;
          robotFilter.Q.value = 2.5;

          const robotGain = actx.createGain();
          robotGain.gain.value = 0.0;

          fxInputGain.connect(robotModGain);
          robotModGain.connect(robotFilter);
          robotFilter.connect(robotGain);
          robotGain.connect(wetGain);

          // 7. Megaphone (Walkie-talkie bandpass)
          const megaphoneHp = actx.createBiquadFilter();
          megaphoneHp.type = "highpass";
          megaphoneHp.frequency.value = 750;
          megaphoneHp.Q.value = 2.0;

          const megaphonePeak = actx.createBiquadFilter();
          megaphonePeak.type = "peaking";
          megaphonePeak.frequency.value = 1400;
          megaphonePeak.Q.value = 3.0;
          megaphonePeak.gain.value = 9;

          const megaphoneLp = actx.createBiquadFilter();
          megaphoneLp.type = "lowpass";
          megaphoneLp.frequency.value = 2300;
          megaphoneLp.Q.value = 2.0;

          const megaphoneGain = actx.createGain();
          megaphoneGain.gain.value = 0.0;

          fxInputGain.connect(megaphoneHp);
          megaphoneHp.connect(megaphonePeak);
          megaphonePeak.connect(megaphoneLp);
          megaphoneLp.connect(megaphoneGain);
          megaphoneGain.connect(wetGain);

          // 8. Echo / Arena (Feedback Delay)
          const echoDelay = actx.createDelay(1.0);
          echoDelay.delayTime.value = 0.22;

          const echoFeedback = actx.createGain();
          echoFeedback.gain.value = 0.42;

          const echoFilter = actx.createBiquadFilter();
          echoFilter.type = "lowpass";
          echoFilter.frequency.value = 3200;

          const echoGain = actx.createGain();
          echoGain.gain.value = 0.0;

          fxInputGain.connect(echoDelay);
          echoDelay.connect(echoFilter);
          echoFilter.connect(echoFeedback);
          echoFeedback.connect(echoDelay);
          echoFilter.connect(echoGain);
          echoGain.connect(wetGain);

          // 9. Lo-Fi Vinyl (Warm Bandwidth restriction)
          const vinylHp = actx.createBiquadFilter();
          vinylHp.type = "highpass";
          vinylHp.frequency.value = 380;
          vinylHp.Q.value = 1.0;

          const vinylPeak = actx.createBiquadFilter();
          vinylPeak.type = "peaking";
          vinylPeak.frequency.value = 1200;
          vinylPeak.gain.value = 5;
          vinylPeak.Q.value = 2.0;

          const vinylLp = actx.createBiquadFilter();
          vinylLp.type = "lowpass";
          vinylLp.frequency.value = 3400;
          vinylLp.Q.value = 1.2;

          const vinylGain = actx.createGain();
          vinylGain.gain.value = 0.0;

          fxInputGain.connect(vinylHp);
          vinylHp.connect(vinylPeak);
          vinylPeak.connect(vinylLp);
          vinylLp.connect(vinylGain);
          vinylGain.connect(wetGain);

          // 10. Transparent dynamics limiter
          const compressor = actx.createDynamicsCompressor();
          compressor.threshold.value = clip.denoise ? -6 : 0;
          compressor.knee.value = 24;
          compressor.ratio.value = clip.denoise ? 1.5 : 1;
          compressor.attack.value = 0.005;
          compressor.release.value = 0.15;

          // 11. Output gain node
          const gain = actx.createGain();
          gain.gain.value = 1.0;

          // Connect serial pre-FX chain:
          source.connect(highpass);
          highpass.connect(presence);
          presence.connect(lowpass);
          lowpass.connect(voiceEqLow);
          voiceEqLow.connect(voiceEqMid);
          voiceEqMid.connect(voiceEqHigh);
          voiceEqHigh.connect(fxInputGain);

          // Connect Dry + Wet sum into compressor -> gain -> destination
          fxInputGain.connect(dryGain);
          dryGain.connect(compressor);
          wetGain.connect(compressor);
          compressor.connect(gain);
          gain.connect(actx.destination);

          audioNodesRef.current[clip.id] = {
            source,
            highpass,
            presence,
            lowpass,
            compressor,
            gain,
            voiceEqLow,
            voiceEqMid,
            voiceEqHigh,
            dryGain,
            wetGain,
            robotGain,
            robotOsc,
            megaphoneGain,
            echoGain,
            vinylGain,
          };
        } catch {
          // If media element source creation fails (e.g. cross-origin restrictions), fallback to direct element volume
        }
      }
    });

    return () => {
      // Cleanup on unmount
      Object.values(audioElementsRef.current).forEach((el: any) => {
        globalActiveAudioElements.delete(el);
        try {
          el.pause();
        } catch {}
      });
    };
  }, [allSoundSources]);

  // 3. High-performance Playback Time Synchronization and Volume/DSP control
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const now = Date.now();
    const wasPlaying = wasPlayingRef.current;
    if (wasPlaying && !isPlaying) {
      pauseTimestampRef.current = now;
    }
    wasPlayingRef.current = isPlaying;
    const isWithinPauseGracePeriod = !isPlaying && now - pauseTimestampRef.current < 250;

    const actx = audioCtxRef.current;
    if (actx && actx.state === "suspended" && isPlaying) {
      actx.resume().catch(() => {});
    }

    allSoundSources.forEach((clip) => {
      const el = audioElementsRef.current[clip.id];
      if (!el) return;

      const clipStart = clip.startTime || 0;
      const clipEnd = clipStart + (clip.duration || 0);
      const isInside = (clip as any).hasAdjacentAudio
        ? currentTime >= clipStart && currentTime < clipEnd
        : currentTime >= clipStart && currentTime <= clipEnd;

      let effSpeed = Math.max(0.1, clip.speed || 1.0);
      if (clip.speedCurve) {
        const localProg = Math.max(0, Math.min(1, (currentTime - clipStart) / Math.max(0.05, clip.duration || 1)));
        effSpeed = evaluateSpeedCurve(clip.speedCurve, localProg);
      }

      if (isPlaying && isInside) {
        const audioOffset = (currentTime - clipStart) * effSpeed + (clip.trimIn || 0);
        if (el.paused || Math.abs(el.currentTime - audioOffset) > 0.25) {
          if (Math.abs(el.currentTime - audioOffset) > 0.04) {
            el.currentTime = Math.max(0, audioOffset);
          }
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
          // Apply active Denoise DSP filtering only when configuration actually changes
          if (nodes.lastDenoise !== clip.denoise) {
            nodes.lastDenoise = clip.denoise;
            if (clip.denoise) {
              nodes.highpass.frequency.setTargetAtTime(55, now, 0.02);
              nodes.presence.gain.setTargetAtTime(1.2, now, 0.02);
              nodes.lowpass.frequency.setTargetAtTime(19000, now, 0.02);
              nodes.compressor.threshold.setTargetAtTime(-6, now, 0.02);
              nodes.compressor.ratio.setTargetAtTime(1.5, now, 0.02);
            } else {
              nodes.highpass.frequency.setTargetAtTime(10, now, 0.02);
              nodes.presence.gain.setTargetAtTime(0, now, 0.02);
              nodes.lowpass.frequency.setTargetAtTime(22000, now, 0.02);
              nodes.compressor.threshold.setTargetAtTime(0, now, 0.02);
              nodes.compressor.ratio.setTargetAtTime(1, now, 0.02);
            }
          }

          // Apply active Character Voice Changer & Audio FX DSP filtering
          const effect = clip.voiceEffect || "none";
          if (nodes.lastVoiceEffect !== effect) {
            nodes.lastVoiceEffect = effect;

            // Route Wet branches
            if (nodes.robotGain) nodes.robotGain.gain.setTargetAtTime(effect === "robot" ? 1.0 : 0.0, now, 0.02);
            if (nodes.megaphoneGain) nodes.megaphoneGain.gain.setTargetAtTime(effect === "megaphone" ? 1.2 : 0.0, now, 0.02);
            if (nodes.echoGain) nodes.echoGain.gain.setTargetAtTime(effect === "echo" ? 0.75 : 0.0, now, 0.02);
            if (nodes.vinylGain) nodes.vinylGain.gain.setTargetAtTime(effect === "vinyl" ? 1.0 : 0.0, now, 0.02);

            if (effect === "none") {
              nodes.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
              nodes.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
              nodes.voiceEqLow.gain.setTargetAtTime(0, now, 0.02);
              nodes.voiceEqMid.gain.setTargetAtTime(0, now, 0.02);
              nodes.voiceEqHigh.gain.setTargetAtTime(0, now, 0.02);
            } else if (effect === "robot") {
              nodes.dryGain.gain.setTargetAtTime(0.15, now, 0.02);
              nodes.wetGain.gain.setTargetAtTime(1.0, now, 0.02);
              nodes.voiceEqLow.gain.setTargetAtTime(-12, now, 0.02);
              nodes.voiceEqMid.frequency.setTargetAtTime(1250, now, 0.02);
              nodes.voiceEqMid.gain.setTargetAtTime(6, now, 0.02);
              nodes.voiceEqHigh.gain.setTargetAtTime(-8, now, 0.02);
            } else if (effect === "chipmunk") {
              nodes.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
              nodes.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
              nodes.voiceEqLow.frequency.setTargetAtTime(450, now, 0.02);
              nodes.voiceEqLow.gain.setTargetAtTime(-18, now, 0.02);
              nodes.voiceEqMid.frequency.setTargetAtTime(2200, now, 0.02);
              nodes.voiceEqMid.gain.setTargetAtTime(14, now, 0.02);
              nodes.voiceEqHigh.frequency.setTargetAtTime(4000, now, 0.02);
              nodes.voiceEqHigh.gain.setTargetAtTime(8, now, 0.02);
            } else if (effect === "deep_bass") {
              nodes.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
              nodes.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
              nodes.voiceEqLow.frequency.setTargetAtTime(120, now, 0.02);
              nodes.voiceEqLow.gain.setTargetAtTime(14, now, 0.02);
              nodes.voiceEqMid.frequency.setTargetAtTime(240, now, 0.02);
              nodes.voiceEqMid.gain.setTargetAtTime(8, now, 0.02);
              nodes.voiceEqHigh.frequency.setTargetAtTime(2800, now, 0.02);
              nodes.voiceEqHigh.gain.setTargetAtTime(-14, now, 0.02);
            } else if (effect === "megaphone") {
              nodes.dryGain.gain.setTargetAtTime(0.0, now, 0.02);
              nodes.wetGain.gain.setTargetAtTime(1.0, now, 0.02);
              nodes.voiceEqLow.gain.setTargetAtTime(-18, now, 0.02);
              nodes.voiceEqMid.frequency.setTargetAtTime(1400, now, 0.02);
              nodes.voiceEqMid.gain.setTargetAtTime(10, now, 0.02);
              nodes.voiceEqHigh.gain.setTargetAtTime(-12, now, 0.02);
            } else if (effect === "echo") {
              nodes.dryGain.gain.setTargetAtTime(0.85, now, 0.02);
              nodes.wetGain.gain.setTargetAtTime(0.85, now, 0.02);
              nodes.voiceEqLow.gain.setTargetAtTime(0, now, 0.02);
              nodes.voiceEqMid.gain.setTargetAtTime(2, now, 0.02);
              nodes.voiceEqHigh.gain.setTargetAtTime(3, now, 0.02);
            } else if (effect === "vinyl") {
              nodes.dryGain.gain.setTargetAtTime(0.1, now, 0.02);
              nodes.wetGain.gain.setTargetAtTime(1.0, now, 0.02);
              nodes.voiceEqLow.gain.setTargetAtTime(-8, now, 0.02);
              nodes.voiceEqMid.frequency.setTargetAtTime(1100, now, 0.02);
              nodes.voiceEqMid.gain.setTargetAtTime(5, now, 0.02);
              nodes.voiceEqHigh.gain.setTargetAtTime(-10, now, 0.02);
            } else if (effect === "helium") {
              nodes.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
              nodes.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
              nodes.voiceEqLow.frequency.setTargetAtTime(650, now, 0.02);
              nodes.voiceEqLow.gain.setTargetAtTime(-24, now, 0.02);
              nodes.voiceEqMid.frequency.setTargetAtTime(2800, now, 0.02);
              nodes.voiceEqMid.gain.setTargetAtTime(16, now, 0.02);
              nodes.voiceEqHigh.frequency.setTargetAtTime(5000, now, 0.02);
              nodes.voiceEqHigh.gain.setTargetAtTime(10, now, 0.02);
            }
          }

          if (nodes.lastVol === undefined || Math.abs(nodes.lastVol - targetVol) > 0.005) {
            nodes.lastVol = targetVol;
            nodes.gain.gain.setTargetAtTime(targetVol, now, 0.02);
          }
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

        // Synchronize playback speed & pitch shifting for character voices
        const voiceEffect = clip.voiceEffect || "none";
        let pitchRateMultiplier = 1.0;
        if (voiceEffect === "chipmunk") {
          (el as any).preservesPitch = false;
          (el as any).mozPreservesPitch = false;
          (el as any).webkitPreservesPitch = false;
          pitchRateMultiplier = 1.45;
        } else if (voiceEffect === "helium") {
          (el as any).preservesPitch = false;
          (el as any).mozPreservesPitch = false;
          (el as any).webkitPreservesPitch = false;
          pitchRateMultiplier = 1.62;
        } else if (voiceEffect === "deep_bass") {
          (el as any).preservesPitch = false;
          (el as any).mozPreservesPitch = false;
          (el as any).webkitPreservesPitch = false;
          pitchRateMultiplier = 0.82;
        } else {
          (el as any).preservesPitch = true;
          (el as any).mozPreservesPitch = true;
          (el as any).webkitPreservesPitch = true;
          pitchRateMultiplier = 1.0;
        }

        const targetPlaybackRate = Math.max(0.25, Math.min(4.0, effSpeed * pitchRateMultiplier));
        if (clip.speed > 0 && Math.abs(el.playbackRate - targetPlaybackRate) > 0.03) {
          el.playbackRate = targetPlaybackRate;
        }

        if (el.paused) {
          el.play().catch(() => {});
        }
      } else {
        el.pause();
        // If we just paused from active playback, hold the exact audio playhead: DO NOT rewind to lagging state!
        // Only seek if the user is scrubbing while paused (outside the pause settling window).
        if (!isWithinPauseGracePeriod && isInside) {
          const audioOffset = (currentTime - clipStart) * effSpeed + (clip.trimIn || 0);
          if (Math.abs(el.currentTime - audioOffset) > 0.04) {
            el.currentTime = Math.max(0, audioOffset);
          }
        } else if (isPlaying && currentTime < clipStart && clipStart - currentTime <= 1.0) {
          // Pre-warm and pre-seek upcoming audio clip so it starts with 0ms latency at the cut
          const startTarget = clip.trimIn || 0;
          if (Math.abs(el.currentTime - startTarget) > 0.04) {
            try {
              el.currentTime = Math.max(0, startTarget);
            } catch {}
          }
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
  }, [isPlaying, currentTime, allSoundSources]);

  return { audioElementsRef };
}
