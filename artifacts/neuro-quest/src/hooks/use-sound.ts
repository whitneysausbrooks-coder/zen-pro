// Web Audio API sound synthesis for NeuroQuest — no external files required

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContext()
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === "suspended") {
      audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

function playTone(
  freq: number,
  freqEnd: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = "sine",
  startDelay = 0
) {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.connect(gain)
  gain.connect(ctx.destination)

  const t = ctx.currentTime + startDelay
  osc.frequency.setValueAtTime(freq, t)
  if (freqEnd !== freq) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration)
  }
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(gainPeak, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

  osc.start(t)
  osc.stop(t + duration + 0.05)
}

// Low-frequency "thud" when a reel stops spinning
export function playReelStop() {
  playTone(90, 42, 0.28, 0.4, "sine")
  playTone(120, 55, 0.18, 0.18, "triangle", 0.02)
}

// Short chime on a regular win
export function playWinChime() {
  const notes = [523, 659, 784] // C5, E5, G5
  notes.forEach((freq, i) => {
    playTone(freq, freq, 0.5, 0.25, "sine", i * 0.12)
  })
}

// Jackpot fanfare — ascending celebratory sequence
export function playJackpotFanfare() {
  const notes = [523, 659, 784, 1047, 1319] // C5→E5→G5→C6→E6
  notes.forEach((freq, i) => {
    playTone(freq, freq, 0.6, 0.28, "sine", i * 0.14)
  })
  // Rich low-end thump underneath
  playTone(65, 45, 0.5, 0.5, "sine", 0)
  // Shimmer
  playTone(2093, 2093, 1.0, 0.08, "sine", 0.1)
}

// Subtle click for button interaction
export function playClick() {
  playTone(880, 440, 0.06, 0.12, "sine")
}
