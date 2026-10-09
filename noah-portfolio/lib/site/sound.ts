// Synthesised site sounds: bassy knob ticks while the model writes, plastic brick clicks while the
// site assembles. Nothing is created until a visitor's Ask click calls `unlockSiteSound()`.

const MUTE_KEY = "siteSoundMuted";
const VOLUME = 0.8;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

export function isSiteSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSiteSoundMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* Storage can be unavailable in privacy modes; the toggle still applies to this page. */
  }
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.015);
}

/** Call synchronously inside the visitor's click so Safari's gesture rule allows playback. */
export function unlockSiteSound(): void {
  if (typeof window === "undefined") return;
  const Context =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  if (!ctx) {
    ctx = new Context();
    master = ctx.createGain();
    master.gain.value = isSiteSoundMuted() ? 0 : VOLUME;
    const limiter = ctx.createDynamicsCompressor();
    master.connect(limiter).connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
  }
  void ctx.resume().catch(() => undefined);
}

function live(): { ctx: AudioContext; master: GainNode; noise: AudioBuffer } | null {
  return ctx && master && noise && ctx.state === "running" && !isSiteSoundMuted()
    ? { ctx, master, noise }
    : null;
}

/** A filtered noise burst: the transient that makes a tick or a click sound physical. */
function burst(at: number, frequency: number, q: number, gain: number, decay: number): void {
  const audio = live();
  if (!audio) return;
  const source = audio.ctx.createBufferSource();
  source.buffer = audio.noise;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const envelope = audio.ctx.createGain();
  envelope.gain.setValueAtTime(gain, at);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(filter).connect(envelope).connect(audio.master);
  source.start(at);
  source.stop(at + decay + 0.01);
}

/** A sine thump that drops in pitch: the bass body of a tick. */
function thump(at: number, frequency: number, gain: number, decay: number): void {
  const audio = live();
  if (!audio) return;
  const oscillator = audio.ctx.createOscillator();
  oscillator.frequency.setValueAtTime(frequency * 2.4, at);
  oscillator.frequency.exponentialRampToValueAtTime(frequency, at + 0.025);
  const envelope = audio.ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  oscillator.connect(envelope).connect(audio.master);
  oscillator.start(at);
  oscillator.stop(at + decay + 0.02);
}

/**
 * Start the generation ticks: a detented volume knob turned slowly up, but bassy. The tick rate,
 * pitch and click brightness rise as time passes; every fourth tick is accented like a techno bar.
 * Returns a stop function.
 */
export function startGenerationTicks(): () => void {
  if (!ctx) return () => undefined;
  const audio = ctx;
  const startedAt = audio.currentTime;
  let next = startedAt + 0.05;
  let beat = 0;
  const timer = window.setInterval(() => {
    while (next < audio.currentTime + 0.12) {
      // lean: ticks follow elapsed time, not real model progress; add stream progress events if wanted.
      const level = 1 - Math.exp(-(next - startedAt) / 14);
      const accent = beat % 4 === 0;
      thump(next, 52 + level * 34, accent ? 0.9 : 0.55, accent ? 0.16 : 0.09);
      burst(next, 1100 + level * 1600, 7, accent ? 0.22 : 0.12, 0.012);
      next += 0.3 - 0.16 * level;
      beat += 1;
    }
  }, 25);
  return () => window.clearInterval(timer);
}

/** One toy-brick snap: a bright plastic click and the lower clack of it seating, `weight` 0..1. */
export function playBrickSnap(delaySeconds = 0, weight = 1): void {
  if (!ctx) return;
  const at = ctx.currentTime + 0.01 + delaySeconds;
  const detune = 0.92 + Math.random() * 0.16;
  burst(at, 3400 * detune, 9, 0.45 * weight, 0.018);
  burst(at + 0.026, 1700 * detune, 6, 0.3 * weight, 0.03);
  thump(at + 0.026, 180 * detune, 0.25 * weight, 0.05);
}
