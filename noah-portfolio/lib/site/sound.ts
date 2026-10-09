// Synthesised site sounds: small tech noises while the model writes, plastic brick clicks while the
// site assembles. Nothing is created until a visitor's Ask click calls `unlockSiteSound()`.

const MUTE_KEY = "siteSoundMuted";
const VOLUME = 0.8;
// The thinking noises' own level under VOLUME, so they stay well below the brick clicks.
const THINKING_VOLUME = 0.5;

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

const between = (low: number, high: number) => low + Math.random() * (high - low);
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** A filtered noise burst: the transient that makes a tick or a click sound physical. */
function burst(at: number, frequency: number, q: number, gain: number, decay: number, out?: AudioNode): void {
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
  source.connect(filter).connect(envelope).connect(out ?? audio.master);
  source.start(at);
  source.stop(at + decay + 0.01);
}

/** A sine thump that drops in pitch: the body of a brick seating. */
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

/** An oscillator note gliding through `pitches` (Hz) over `length` seconds: the voice of a bleep. */
function glide(
  at: number,
  pitches: readonly number[],
  length: number,
  gain: number,
  out: AudioNode,
  type: OscillatorType = "sine",
): void {
  const audio = live();
  if (!audio) return;
  const oscillator = audio.ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(pitches[0], at);
  pitches.forEach((pitch, index) => {
    if (index > 0) oscillator.frequency.exponentialRampToValueAtTime(pitch, at + (length * index) / (pitches.length - 1));
  });
  const envelope = audio.ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  envelope.gain.exponentialRampToValueAtTime(gain * 0.5, at + length * 0.75);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
  oscillator.connect(envelope).connect(out);
  oscillator.start(at);
  oscillator.stop(at + length + 0.02);
}

/** One thinking noise scheduled from `at` into `out`; returns how long it lasts in seconds. */
type Noise = (at: number, out: AudioNode) => number;

/** R2-D2 chatter: a quick run of whistled bleeps that swoop up, drop away or warble. */
const chatter: Noise = (at, out) => {
  let time = at;
  for (let bleeps = 2 + Math.floor(Math.random() * 4); bleeps > 0; bleeps -= 1) {
    const pitch = between(1300, 2900);
    const length = between(0.04, 0.11);
    const contour = pick([[pitch, pitch * 1.6], [pitch * 1.5, pitch * 0.75], [pitch, pitch * 1.3, pitch * 0.9, pitch * 1.25]]);
    glide(time, contour, length, 0.028, out);
    time += length + between(0.015, 0.05);
  }
  return time - at;
};

/** A wrench ratcheting: one or two strokes of quick, bright pawl clicks. */
const ratchet: Noise = (at, out) => {
  let time = at;
  for (let strokes = 1 + Math.floor(Math.random() * 2); strokes > 0; strokes -= 1) {
    const pitch = between(2800, 4200);
    const spacing = between(0.024, 0.04);
    for (let clicks = 4 + Math.floor(Math.random() * 5); clicks > 0; clicks -= 1) {
      burst(time, pitch, 4, 0.6, 0.008, out);
      time += spacing;
    }
    time += between(0.14, 0.28);
  }
  return time - at;
};

/** A small clock: an even tick-tock run. */
const clock: Noise = (at, out) => {
  const ticks = 4 + Math.floor(Math.random() * 3);
  const spacing = between(0.18, 0.26);
  for (let tick = 0; tick < ticks; tick += 1) burst(at + tick * spacing, tick % 2 ? 2000 : 2600, 8, 1, 0.015, out);
  return ticks * spacing;
};

const BLIP_PITCHES = [1047, 1319, 1568, 1760, 2093];

/** A computer reading data: a patter of soft blips on random notes. */
const blips: Noise = (at, out) => {
  const count = 3 + Math.floor(Math.random() * 5);
  for (let blip = 0; blip < count; blip += 1) glide(at + blip * 0.06, [pick(BLIP_PITCHES)], 0.03, 0.05, out, "triangle");
  return count * 0.06;
};

/** A tiny servo motor: a muffled buzz winding up or down. */
const servo: Noise = (at, out) => {
  const audio = live();
  const length = between(0.16, 0.36);
  if (audio) {
    const filter = audio.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    filter.connect(out);
    glide(at, Math.random() < 0.5 ? [190, 330] : [330, 200], length, 0.036, filter, "sawtooth");
  }
  return length;
};

// Chatter is listed twice so the droid voice comes round more often than any one machine noise.
const THINKING_NOISES = [chatter, chatter, ratchet, clock, blips, servo];

/**
 * Start the thinking noises while the model writes: chatter, ratchets, clock ticks, blips and servo
 * whirrs at random, with random gaps and never the same kind twice running, on their own quiet bus.
 * The returned stop function fades out whatever is still sounding.
 */
export function startThinkingNoises(): () => void {
  if (!ctx || !master) return () => undefined;
  const audio = ctx;
  const bus = audio.createGain();
  bus.gain.value = THINKING_VOLUME;
  bus.connect(master);
  let last: Noise | undefined;
  let timer = window.setTimeout(function play() {
    last = pick(THINKING_NOISES.filter((noise) => noise !== last));
    const length = last(audio.currentTime + 0.03, bus);
    // Now and then a longer pause, so the noises never settle into a rhythm.
    timer = window.setTimeout(play, (length + between(0.15, Math.random() < 0.15 ? 1.8 : 0.8)) * 1000);
  }, 400);
  return () => {
    window.clearTimeout(timer);
    bus.gain.setTargetAtTime(0, audio.currentTime, 0.02);
  };
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
