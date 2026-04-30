import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export interface NeuralPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "binaural" | "solfeggio" | "ambient" | "gamma";
  science: string;
  baseFreq: number;
  beatFreq?: number;
  color: string;
}

export const NEURAL_PRESETS: NeuralPreset[] = [
  {
    id: "alpha_flow",
    name: "Alpha Flow",
    description: "10Hz alpha waves for relaxation and creative flow",
    icon: "🌊",
    category: "binaural",
    science: "Alpha brainwave entrainment (8-13Hz) activates the default mode network, enhancing creativity and reducing anxiety. Stanford research shows alpha states increase divergent thinking by 30%.",
    baseFreq: 200,
    beatFreq: 10,
    color: "#60A5FA",
  },
  {
    id: "deep_focus",
    name: "Deep Focus",
    description: "18Hz beta waves for laser concentration",
    icon: "🎯",
    category: "binaural",
    science: "Beta entrainment (14-30Hz) strengthens dorsolateral prefrontal cortex activity, the brain region responsible for sustained attention and working memory.",
    baseFreq: 250,
    beatFreq: 18,
    color: "#FBBF24",
  },
  {
    id: "theta_meditation",
    name: "Theta Meditation",
    description: "6Hz theta waves for deep meditation",
    icon: "🧘",
    category: "binaural",
    science: "Theta waves (4-8Hz) are associated with deep meditative states, enhanced intuition, and memory consolidation. fMRI studies show increased connectivity between the hippocampus and prefrontal cortex.",
    baseFreq: 180,
    beatFreq: 6,
    color: "#A78BFA",
  },
  {
    id: "gamma_cognition",
    name: "40Hz Gamma",
    description: "40Hz for cognitive enhancement and memory",
    icon: "⚡",
    category: "gamma",
    science: "MIT research (Li-Huei Tsai, 2016) demonstrated 40Hz gamma entrainment reduces amyloid plaques and improves cognitive function. Gamma oscillations bind neural information across brain regions.",
    baseFreq: 220,
    beatFreq: 40,
    color: "#F472B6",
  },
  {
    id: "solfeggio_528",
    name: "528Hz Healing",
    description: "The 'Love Frequency' for restoration",
    icon: "💚",
    category: "solfeggio",
    science: "528Hz is called the 'Miracle Tone.' Research in the Journal of Addiction Research & Therapy found it reduces cortisol and increases oxytocin. Used in sound therapy for cellular regeneration.",
    baseFreq: 528,
    color: "#4ADE80",
  },
  {
    id: "solfeggio_432",
    name: "432Hz Calm",
    description: "Natural tuning frequency for deep calm",
    icon: "🕊️",
    category: "solfeggio",
    science: "432Hz aligns with the Schumann Resonance of the Earth. Studies show it reduces heart rate and blood pressure more effectively than 440Hz standard tuning (Calamassi & Pomponi, 2019).",
    baseFreq: 432,
    color: "#E8DFC8",
  },
  {
    id: "solfeggio_396",
    name: "396Hz Liberation",
    description: "Release fear and guilt patterns",
    icon: "🦋",
    category: "solfeggio",
    science: "396Hz targets the root chakra frequency, associated with releasing deep-seated fear patterns. EEG studies show reduced amygdala activation during exposure to this frequency.",
    baseFreq: 396,
    color: "#F97316",
  },
  {
    id: "brown_noise",
    name: "Brown Noise",
    description: "Deep low-frequency noise for deep focus",
    icon: "🌳",
    category: "ambient",
    science: "Brown noise emphasizes lower frequencies, mimicking natural sounds like waterfalls. Research shows it activates the parasympathetic nervous system, reducing cortisol levels by up to 25%.",
    baseFreq: 0,
    color: "#8B6914",
  },
  {
    id: "pink_noise",
    name: "Pink Noise",
    description: "Balanced noise for memory consolidation",
    icon: "🌸",
    category: "ambient",
    science: "Northwestern University found pink noise during sleep increases slow-wave activity and improves memory recall by 25%. The 1/f spectral density mirrors natural neural oscillations.",
    baseFreq: 0,
    color: "#EC4899",
  },
];

const NATIVE_AUDIO_SOURCES: Record<string, number> = {
  alpha_flow: require("../assets/audio/alpha_flow.wav"),
  deep_focus: require("../assets/audio/deep_focus.wav"),
  theta_meditation: require("../assets/audio/theta_meditation.wav"),
  gamma_cognition: require("../assets/audio/gamma_cognition.wav"),
  solfeggio_528: require("../assets/audio/solfeggio_528.wav"),
  solfeggio_432: require("../assets/audio/solfeggio_432.wav"),
  solfeggio_396: require("../assets/audio/solfeggio_396.wav"),
  brown_noise: require("../assets/audio/brown_noise.wav"),
  pink_noise: require("../assets/audio/pink_noise.wav"),
};

interface AudioNodes {
  ctx: any;
  osc1?: OscillatorNode;
  osc2?: OscillatorNode;
  gain: GainNode;
  merger?: ChannelMergerNode;
  gainL?: GainNode;
  gainR?: GainNode;
  noiseSource?: AudioBufferSourceNode;
}

let nativeAudioModeConfigured = false;

async function ensureNativeAudioMode() {
  if (nativeAudioModeConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });
    nativeAudioModeConfigured = true;
  } catch (e) {
    console.warn("setAudioModeAsync failed", e);
  }
}

export function useNeuralAudio() {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nativeUnavailable, setNativeUnavailable] = useState(false);
  const nodesRef = useRef<AudioNodes | null>(null);
  const ctxRef = useRef<any>(null);
  const nativeSoundRef = useRef<Audio.Sound | null>(null);
  const loadTokenRef = useRef(0);

  const isWeb = Platform.OS === "web";

  const getContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    if (isWeb && typeof window !== "undefined") {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        ctxRef.current = new AC();
        return ctxRef.current;
      }
    }
    return null;
  }, [isWeb]);

  const generateBrownNoise = useCallback((ctx: any, duration: number) => {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    return buffer;
  }, []);

  const generatePinkNoise = useCallback((ctx: any, duration: number) => {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }, []);

  const stop = useCallback(() => {
    loadTokenRef.current++;

    if (nodesRef.current) {
      const { osc1, osc2, gain, noiseSource } = nodesRef.current;
      try {
        gain.gain.linearRampToValueAtTime(0, gain.context.currentTime + 0.5);
        setTimeout(() => {
          try {
            osc1?.stop();
            osc2?.stop();
            noiseSource?.stop();
            osc1?.disconnect();
            osc2?.disconnect();
            noiseSource?.disconnect();
            gain.disconnect();
          } catch {}
        }, 600);
      } catch {}
      nodesRef.current = null;
    }

    const sound = nativeSoundRef.current;
    if (sound) {
      nativeSoundRef.current = null;
      sound.stopAsync().catch(() => {}).finally(() => {
        sound.unloadAsync().catch(() => {});
      });
    }

    setActivePreset(null);
    setIsPlaying(false);
  }, []);

  const play = useCallback(
    (presetId: string) => {
      const preset = NEURAL_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      stop();

      if (!isWeb) {
        const source = NATIVE_AUDIO_SOURCES[presetId];
        if (!source) {
          setNativeUnavailable(true);
          setTimeout(() => setNativeUnavailable(false), 3000);
          return;
        }

        const myToken = ++loadTokenRef.current;
        setActivePreset(presetId);
        setIsPlaying(true);

        (async () => {
          try {
            await ensureNativeAudioMode();
            const { sound } = await Audio.Sound.createAsync(
              source,
              { shouldPlay: true, isLooping: true, volume },
              null,
              false
            );
            if (loadTokenRef.current !== myToken) {
              await sound.unloadAsync().catch(() => {});
              return;
            }
            nativeSoundRef.current = sound;
          } catch (e) {
            console.warn("Failed to load neural audio", presetId, e);
            if (loadTokenRef.current === myToken) {
              setActivePreset(null);
              setIsPlaying(false);
              setNativeUnavailable(true);
              setTimeout(() => setNativeUnavailable(false), 3000);
            }
          }
        })();
        return;
      }

      const ctx = getContext();
      if (!ctx) return;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);
      masterGain.connect(ctx.destination);

      if (preset.category === "ambient") {
        const buffer =
          preset.id === "brown_noise"
            ? generateBrownNoise(ctx, 10)
            : generatePinkNoise(ctx, 10);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(masterGain);
        source.start();

        nodesRef.current = { ctx, gain: masterGain, noiseSource: source };
      } else if (preset.beatFreq && preset.beatFreq > 0) {
        const merger = ctx.createChannelMerger(2);
        const gainL = ctx.createGain();
        const gainR = ctx.createGain();
        gainL.gain.value = 1;
        gainR.gain.value = 1;

        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.value = preset.baseFreq;

        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.value = preset.baseFreq + preset.beatFreq;

        osc1.connect(gainL);
        osc2.connect(gainR);
        gainL.connect(merger, 0, 0);
        gainR.connect(merger, 0, 1);
        merger.connect(masterGain);

        osc1.start();
        osc2.start();

        nodesRef.current = {
          ctx,
          osc1,
          osc2,
          gain: masterGain,
          merger,
          gainL,
          gainR,
        };
      } else {
        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.value = preset.baseFreq;
        osc1.connect(masterGain);
        osc1.start();

        nodesRef.current = { ctx, osc1, gain: masterGain };
      }

      setActivePreset(presetId);
      setIsPlaying(true);
    },
    [volume, isWeb, getContext, generateBrownNoise, generatePinkNoise, stop]
  );

  const updateVolume = useCallback(
    (newVol: number) => {
      setVolume(newVol);
      if (nodesRef.current) {
        const { gain } = nodesRef.current;
        try {
          gain.gain.linearRampToValueAtTime(newVol, gain.context.currentTime + 0.1);
        } catch {}
      }
      const sound = nativeSoundRef.current;
      if (sound) {
        sound.setVolumeAsync(newVol).catch(() => {});
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  return {
    presets: NEURAL_PRESETS,
    activePreset,
    isPlaying,
    volume,
    nativeUnavailable,
    play,
    stop,
    updateVolume,
    toggle: useCallback(
      (presetId: string) => {
        if (activePreset === presetId) {
          stop();
        } else {
          play(presetId);
        }
      },
      [activePreset, play, stop]
    ),
  };
}
