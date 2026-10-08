export type VoiceKind = "greeting" | "fact" | "bonk" | "annoyed" | "wonder";
export type SfxName = "step" | "jump" | "trip" | "fall" | "land" | "bonk" | "pickup" | "toss" | "catch"
  | "type" | "printer" | "rack" | "poke" | "sparkle" | "select";
export type AudioContextFactory = () => AudioContext | null;

type Vowel = "a" | "e" | "i" | "o" | "u";
type Onset = "hiss" | "tick" | null;
type Wave = "sine" | "triangle" | "square" | "sawtooth" | "pulse" | "buzz";
type Bus = "voice" | "sfx" | "music";
type Syllable = { vowel: Vowel; onset: Onset; pause: number; mark: string; fromEnd: number };
type Blip = Readonly<{ at: number; length: number; from: number; to: number; vowel: Vowel; onset: Onset; peak: number }>;
type Chain = Readonly<{ source: AudioScheduledSourceNode; gain: GainNode; nodes: readonly AudioNode[] }>;
type Graph = Readonly<{ buses: Record<Bus, GainNode>; noise: AudioBuffer; pulse: PeriodicWave; buzz: PeriodicWave }>;

const VOWELS: readonly Vowel[] = ["a", "e", "i", "o", "u"];
/** Rough first and second formants: parallel bandpasses at these make a buzzy blip read as that vowel. */
const FORMANTS: Record<Vowel, readonly [number, number]> = {
  a: [800, 1200], e: [400, 2000], i: [300, 2300], o: [450, 800], u: [325, 700],
};
/** Base pitch (Hz), syllables per second, pitch spread and whole-line rise (semitones), source wave, breath noise. */
const VOICES: Record<VoiceKind, Readonly<{ base: number; rate: number; jitter: number; rise: number; wave: Wave; breath: number }>> = {
  greeting: { base: 430, rate: 15, jitter: 4, rise: 0, wave: "sawtooth", breath: 0 },
  fact: { base: 330, rate: 13, jitter: 2.5, rise: 0, wave: "sawtooth", breath: 0 },
  wonder: { base: 500, rate: 12.5, jitter: 3, rise: 5, wave: "sawtooth", breath: 0.35 },
  annoyed: { base: 250, rate: 17, jitter: 1.5, rise: -2, wave: "buzz", breath: 0 },
  bonk: { base: 330, rate: 1, jitter: 0, rise: 0, wave: "sawtooth", breath: 0 },
};
const VOICE_START = 0.02, MAX_BABBLE = 5, WORD_GAP = 0.015, COMMA_PAUSE = 0.14, SENTENCE_PAUSE = 0.26, FADE = 0.03;

const SIXTEENTH = 60 / 112 / 4, LOOKAHEAD = 0.15, TICK_MS = 25;
const SCALE = [0, 2, 4, 5, 7, 9, 11];
/** Original 16-bar loop in C major, A section (bars 1-8) then B (9-16). Eighth notes; "-" holds, "." rests. */
const MELODY = [
  "C5 E5 G5 - E5 - C5 D5", "E5 - A5 - G5 E5 C5 -", "F5 - A5 - C6 - A5 G5", "G5 - D5 - B4 - . .",
  "C5 E5 G5 - C6 - B5 C6", "B5 - G5 - E5 - G5 -", "A5 G5 F5 A5 G5 F5 E5 D5", "D5 - E5 - D5 - . .",
  "A4 C5 F5 - A5 - F5 -", "G5 - B4 D5 G5 - D5 -", "E5 G5 B5 - G5 - E5 -", "C6 - B5 A5 E5 - C5 -",
  "D5 F5 A5 - F5 - D5 F5", "G5 - F5 E5 D5 - B4 -", "C5 - E5 G5 C6 - G5 E5", "D5 - G5 - B4 - D5 -",
].flatMap((bar) => bar.split(" "));
const CHORDS = "C Am F G C Em F G F G Em Am Dm G C G".split(" ");
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Deterministic 0..1 per syllable from the caption hash (murmur3 finalizer). */
function unit(seed: number, index: number): number {
  let x = Math.imul(seed ^ (index + 1), 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
}

/** Latin letters become onset + vowel-nucleus syllables; other letters and digits one neutral syllable each. */
function syllabify(line: string): { syllables: Syllable[]; hash: number } {
  const chars = [...line.slice(0, 400).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()];
  const syllables: Syllable[] = [];
  let hash = 2166136261, onset = "", nucleus = false, wordStart = 0;
  const add = (vowel: Vowel) => {
    syllables.push({ vowel, onset: /[sfzxj]|[cst]h/.test(onset) ? "hiss" : /[pbtdkgqc]/.test(onset) ? "tick" : null, pause: 0, mark: "", fromEnd: 0 });
    onset = "";
  };
  const endWord = (pause: number, mark = "") => {
    if (onset && syllables.length === wordStart) add("u"); // vowel-less words like "hmm"
    onset = "";
    nucleus = false;
    wordStart = syllables.length;
    const last = syllables.at(-1);
    if (last) { last.pause = Math.max(last.pause, pause); last.mark = mark || last.mark; }
  };
  for (const [index, char] of chars.entries()) {
    if (/[\p{L}\p{N}]/u.test(char)) {
      hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
      if (!/[a-z]/.test(char)) { add(VOWELS[char.codePointAt(0)! % 5]); nucleus = false; }
      else if (/[aeiou]/.test(char) || (char === "y" && !/[aeiou]/.test(chars[index + 1] ?? ""))) {
        if (!nucleus) add(char === "y" ? "i" : char as Vowel);
        nucleus = true;
      } else { onset += char; nucleus = false; }
    } else if (/\s/.test(char)) endWord(WORD_GAP);
    else if (/[,;:\u2013\u2014]/.test(char)) endWord(COMMA_PAUSE);
    else if (/[.!?\u2026]/.test(char)) endWord(SENTENCE_PAUSE, char === "?" || char === "!" ? char : ".");
  }
  endWord(0);
  for (let index = syllables.length - 1, mark = ".", fromEnd = 0; index >= 0; index -= 1, fromEnd += 1) {
    if (syllables[index].mark) { mark = syllables[index].mark; fromEnd = 0; }
    syllables[index].mark = mark;
    syllables[index].fromEnd = fromEnd;
  }
  return { syllables, hash };
}

/** Blip schedule relative to the speak() call, capped at MAX_BABBLE seconds. */
function babble(line: string, kind: VoiceKind): Blip[] {
  const { syllables, hash } = syllabify(line);
  const voice = VOICES[kind];
  if (!syllables.length) return [];
  if (kind === "bonk") return [{ at: VOICE_START, length: 0.3, from: voice.base, to: voice.base * 0.45, vowel: "u", onset: null, peak: 1 }];
  const step = 1 / voice.rate, length = step * 0.82;
  const span = Math.max(1, Math.min(syllables.length, MAX_BABBLE * voice.rate) - 1);
  const blips: Blip[] = [];
  for (let index = 0, at = VOICE_START; index < syllables.length && at + length <= MAX_BABBLE; index += 1) {
    const { vowel, onset, pause, mark, fromEnd } = syllables[index];
    let semis = (unit(hash, index) * 2 - 1) * voice.jitter + (voice.rise * index) / span;
    let glide = 0.97, peak = 0.9;
    // Questions rise over the last two syllables, exclamations lift the sentence, statements drop the final one.
    if (mark === "?" && fromEnd < 2) { semis += fromEnd ? 2 : 5; glide = fromEnd ? glide : 1.15; }
    else if (mark === "!") { semis += fromEnd ? 2 : 4; peak = fromEnd ? peak : 1.1; }
    else if (mark === "." && !fromEnd) { semis -= 3; glide = 0.88; }
    const from = voice.base * 2 ** (semis / 12);
    blips.push({ at, length, from, to: from * glide, vowel, onset, peak });
    at += step + pause;
  }
  return blips;
}

/** Seconds from speak() to the end of the last babble blip; 0 when the line has nothing to say. */
export function utteranceDuration(line: string, kind: VoiceKind = "greeting"): number {
  const last = babble(line, kind).at(-1);
  return last ? last.at + last.length : 0;
}

/** Linear attack to `peak`, optional hold for a fraction of the note, linear release to silence at `end`. */
function envelope(param: AudioParam, at: number, end: number, peak: number, hold: number): void {
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, at + Math.min(0.008, (end - at) / 3));
  if (hold) param.setValueAtTime(peak, at + (end - at) * hold);
  param.linearRampToValueAtTime(0, end);
}

/** Sine wobble in cents, sampled into a value curve so no LFO node outlives the note. */
function vibrato(detune: AudioParam, at: number, length: number, cents: number, rate: number): void {
  const curve = new Float32Array(Math.max(2, Math.ceil(length * rate * 8)));
  for (let index = 0; index < curve.length; index += 1) curve[index] = cents * Math.sin((2 * Math.PI * rate * length * index) / (curve.length - 1));
  detune.setValueCurveAtTime(curve, at, length);
}

/** Fourier series of a pulse wave with the given duty cycle (0.25 lead, 0.125 thin buzz). */
function pulseWave(context: AudioContext, duty: number): PeriodicWave {
  const real = new Float32Array(32);
  for (let n = 1; n < real.length; n += 1) real[n] = (2 * Math.sin(Math.PI * n * duty)) / (Math.PI * n);
  return context.createPeriodicWave(real, new Float32Array(real.length));
}

function browserAudioContext(): AudioContext | null {
  // Browser globals are consulted only from a click (enableFromGesture/setMusic), never at import or mount.
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  return Context ? new Context() : null;
}

/** Opt-in synthesized babble voice, sound effects and chiptune loop; no samples, speech synthesis or network. */
export class CharacterAudio {
  private context: AudioContext | null = null;
  private graph: Graph | null = null;
  private readonly playing: Record<Bus, Set<Chain>> = { voice: new Set(), sfx: new Set(), music: new Set() };
  private soundOn = false;
  private musicOn = false;
  private suspended = false;
  private disposed = false;
  private soundRevision = 0;
  private musicRevision = 0;
  private timer: number | undefined;
  private musicAt = 0;
  private musicStep = 0;
  private footstep = false;

  constructor(private readonly createContext: AudioContextFactory = browserAudioContext) {}

  get enabled(): boolean { return this.soundOn && !this.disposed; }
  get musicEnabled(): boolean { return this.musicOn && !this.disposed; }

  /** Voice + sfx on. Call only from a Sound button click. */
  async enableFromGesture(): Promise<boolean> {
    const revision = ++this.soundRevision;
    const running = await this.open();
    if (revision !== this.soundRevision) return false;
    this.soundOn = running;
    return running;
  }

  /** Music on/off, independent of voice + sfx. Call only from a Music button click; returns the actual state. */
  async setMusic(on: boolean): Promise<boolean> {
    const revision = ++this.musicRevision;
    if (!on) {
      this.musicOn = false;
      this.stopMusic();
      return false;
    }
    const running = await this.open();
    if (revision !== this.musicRevision) return false;
    this.musicOn = running;
    if (running && !this.suspended) this.startMusic();
    return running;
  }

  mute(): void {
    this.soundRevision += 1;
    this.soundOn = false;
    this.cancel();
  }

  /** Hidden tab, offscreen or paused: silence voice and sfx and stop music scheduling until resumed. */
  suspend(suspended: boolean): void {
    this.suspended = suspended;
    if (suspended) {
      this.cancel();
      this.stopMusic();
    } else if (this.musicEnabled && this.context?.state === "running") this.startMusic();
  }

  /** Babble that follows the caption's syllables and punctuation; replaces any line still playing. */
  speak(line: string, kind: VoiceKind = "greeting"): boolean {
    const context = this.audible();
    const blips = context ? babble(line, kind) : [];
    if (!context || !blips.length) return false;
    this.cut("voice");
    const { wave, breath } = VOICES[kind];
    try {
      for (const blip of blips) this.syllable("voice", blip, context.currentTime, wave, breath);
      return true;
    } catch {
      this.cut("voice");
      return false;
    }
  }

  sfx(name: SfxName, { pitch = 1, volume = 1 }: { pitch?: number; volume?: number } = {}): void {
    const context = this.audible();
    if (!context) return;
    try { this.effect(name, context.currentTime + 0.005, pitch, volume); } catch { /* A failing audio device must not break the scene. */ }
  }

  /** Voice and pending sfx; music keeps playing. */
  cancel(): void {
    this.cut("voice");
    this.cut("sfx");
  }

  /** Idempotent; stops everything, clears the music timer and closes the one owned context. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.mute();
    this.musicRevision += 1;
    this.musicOn = false;
    this.stopMusic();
    this.graph = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      try { await context.close(); } catch { /* Teardown must also work after browser shutdown. */ }
    }
  }

  /** Creates the one owned context on first use (always from a click) and resumes it. */
  private async open(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      this.context ??= this.createContext();
      const context = this.context;
      if (!context || context.state === "closed") return false;
      if (!this.graph) {
        // A gentle safety limiter: its makeup gain lifts everything equally, so the threshold stays above normal levels.
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -10;
        compressor.knee.value = 6;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        const master = context.createGain();
        master.gain.value = 0.7;
        compressor.connect(master);
        master.connect(context.destination);
        const bus = (level: number) => {
          const gain = context.createGain();
          gain.gain.value = level;
          gain.connect(compressor);
          return gain;
        };
        const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
        // Music sits well under the voice; sfx between the two.
        this.graph = {
          buses: { voice: bus(0.6), sfx: bus(0.45), music: bus(0.07) },
          noise, pulse: pulseWave(context, 0.25), buzz: pulseWave(context, 0.125),
        };
      }
      if (context.state !== "running") await context.resume();
      return !this.disposed && context.state === "running";
    } catch {
      return false;
    }
  }

  private audible(): AudioContext | null {
    const context = this.context;
    return this.enabled && !this.suspended && context?.state === "running" ? context : null;
  }

  /** Source through optional parallel filters into an enveloped gain on a bus; tracked until it ends or is cut. */
  private emit(bus: Bus, source: AudioScheduledSourceNode, at: number, end: number, peak: number, filters: readonly AudioNode[] = [], hold = 0): void {
    const gain = this.context!.createGain();
    const chain: Chain = { source, gain, nodes: [source, ...filters, gain] };
    for (const filter of filters) {
      source.connect(filter);
      filter.connect(gain);
    }
    if (!filters.length) source.connect(gain);
    gain.connect(this.graph!.buses[bus]);
    envelope(gain.gain, at, end, peak, hold);
    this.playing[bus].add(chain);
    source.onended = () => this.release(bus, chain);
    source.start(at);
    source.stop(end);
  }

  private release(bus: Bus, chain: Chain): void {
    this.playing[bus].delete(chain);
    chain.source.onended = null;
    for (const node of chain.nodes) node.disconnect();
  }

  /** Quick fade instead of a hard stop so cut-offs do not click; nodes disconnect when they end. */
  private cut(bus: Bus): void {
    const now = this.context?.currentTime ?? 0;
    for (const { source, gain } of this.playing[bus]) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, FADE / 4);
        source.stop(now + FADE);
      } catch { /* Already ended, or the context has closed. */ }
    }
    this.playing[bus].clear();
  }

  private osc(wave: Wave, at: number, frequency: number): OscillatorNode {
    const oscillator = this.context!.createOscillator();
    if (wave === "pulse" || wave === "buzz") oscillator.setPeriodicWave(this.graph![wave]);
    else oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, at);
    return oscillator;
  }

  private filter(type: BiquadFilterType, frequency: number, q: number, at: number): BiquadFilterNode {
    const filter = this.context!.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, at);
    return filter;
  }

  private tone(bus: Bus, wave: Wave, at: number, length: number, peak: number, from: number, to = from, hold = 0): OscillatorNode {
    const oscillator = this.osc(wave, at, from);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, at + length);
    this.emit(bus, oscillator, at, at + length, peak, [], hold);
    return oscillator;
  }

  private noise(bus: Bus, at: number, length: number, peak: number, type: BiquadFilterType, from: number, q = 1, to = from, hold = 0): void {
    const source = this.context!.createBufferSource();
    source.buffer = this.graph!.noise;
    source.loop = true;
    const filter = this.filter(type, from, q, at);
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, at + length);
    this.emit(bus, source, at, at + length, peak, [filter], hold);
  }

  /** One voiced blip through the vowel's formants, with a hiss or tick for its consonant onset. */
  private syllable(bus: Bus, blip: Blip, start: number, wave: Wave, breath = 0): void {
    const at = start + blip.at, end = at + blip.length, [f1, f2] = FORMANTS[blip.vowel];
    if (blip.onset === "hiss") this.noise(bus, at, 0.035, 0.3, "highpass", 4500);
    else if (blip.onset === "tick") this.noise(bus, at, 0.012, 0.5, "bandpass", 2500, 2);
    if (breath) this.noise(bus, at, blip.length, breath, "bandpass", f2, 3);
    const oscillator = this.osc(wave, at, blip.from);
    oscillator.frequency.exponentialRampToValueAtTime(blip.to, end);
    this.emit(bus, oscillator, at, end, blip.peak, [this.filter("bandpass", f1, 3.5, at), this.filter("bandpass", f2, 5, at)]);
  }

  private effect(name: SfxName, at: number, p: number, v: number): void {
    const tone = (wave: Wave, start: number, length: number, peak: number, from: number, to = from, hold = 0) =>
      this.tone("sfx", wave, at + start, length, peak * v, from * p, to * p, hold);
    const hiss = (start: number, length: number, peak: number, type: BiquadFilterType, from: number, q = 1, to = from, hold = 0) =>
      this.noise("sfx", at + start, length, peak * v, type, from * p, q, to * p, hold);
    const whoa = (start: number, length: number, from: number, to: number, vowel: Vowel) =>
      this.syllable("sfx", { at: start, length, from: from * p, to: to * p, vowel, onset: null, peak: 0.9 * v }, at, "sawtooth");
    switch (name) {
      case "step":
        this.footstep = !this.footstep;
        tone("triangle", 0, 0.06, 0.35, this.footstep ? 210 : 175, 90);
        hiss(0, 0.02, 0.12, "bandpass", 1400, 1.5);
        break;
      case "jump":
        vibrato(tone("pulse", 0, 0.3, 0.28, 240, 720, 0.4).detune, at + 0.04, 0.26, 35, 14);
        break;
      case "trip":
        hiss(0, 0.18, 0.35, "bandpass", 500, 1.2, 2600);
        whoa(0.1, 0.12, 560, 620, "o");
        whoa(0.23, 0.18, 600, 420, "a");
        break;
      case "fall":
        vibrato(tone("sine", 0, 1.2, 0.32, 1500, 260, 0.75).detune, at, 1.2, 30, 7);
        hiss(0, 1.2, 0.04, "bandpass", 2400, 2, 700, 0.75);
        break;
      case "land":
        tone("sine", 0, 0.2, 0.7, 150, 45);
        hiss(0, 0.08, 0.3, "lowpass", 500);
        tone("sine", 0.17, 0.11, 0.3, 120, 55);
        break;
      case "bonk":
        tone("triangle", 0, 0.16, 0.6, 760, 260);
        tone("square", 0, 0.05, 0.1, 1520, 600);
        hiss(0, 0.015, 0.35, "bandpass", 3000, 2);
        break;
      case "pickup":
        tone("pulse", 0, 0.07, 0.28, 784, 784, 0.7);
        tone("pulse", 0.07, 0.38, 0.28, 1175, 1175, 0.25);
        break;
      case "toss":
        hiss(0, 0.25, 1, "bandpass", 400, 1.5, 3200);
        tone("sine", 0, 0.2, 0.1, 300, 700);
        break;
      case "catch":
        tone("sine", 0, 0.06, 0.45, 420, 980);
        hiss(0, 0.012, 0.25, "bandpass", 1800, 2);
        break;
      case "type": {
        const clicks = 3 + Math.floor(Math.random() * 3);
        for (let index = 0; index < clicks; index += 1) {
          const start = (index * 0.22) / clicks + Math.random() * 0.025;
          hiss(start, 0.018, 0.7, "bandpass", 2600 + Math.random() * 1800, 3);
          tone("square", start, 0.008, 0.05, 1900);
        }
        break;
      }
      case "printer": {
        const whir = tone("sawtooth", 0, 0.6, 0.16, 180, 180, 0.85);
        for (let index = 1; index < 6; index += 1) whir.frequency.setValueAtTime((index % 2 ? 240 : 180) * p, at + index * 0.1);
        tone("square", 0.68, 0.1, 0.22, 1760, 1760, 0.6);
        break;
      }
      case "rack":
        tone("square", 0, 0.06, 0.22, 1320, 1320, 0.6);
        tone("square", 0.11, 0.06, 0.22, 1760, 1760, 0.6);
        hiss(0, 0.7, 0.1, "lowpass", 1400, 0.7, 1400, 0.8);
        break;
      case "poke":
        vibrato(tone("triangle", 0, 0.11, 0.35, 900, 1700).detune, at, 0.11, 40, 30);
        break;
      case "sparkle":
        for (const [index, frequency] of [1047, 1319, 1568, 2093, 2637].entries()) {
          tone("triangle", index * 0.045, 0.09, 0.3, frequency);
          tone("triangle", 0.2 + index * 0.045, 0.09, 0.1, frequency); // echo
        }
        break;
      case "select":
        tone("pulse", 0, 0.08, 0.22, 988, 988, 0.5).frequency.setValueAtTime(1319 * p, at + 0.035);
        break;
    }
  }

  private startMusic(): void {
    if (this.timer !== undefined || !this.context) return;
    this.musicAt = this.context.currentTime + 0.05;
    this.timer = window.setInterval(() => this.scheduleMusic(), TICK_MS);
    this.scheduleMusic();
  }

  private stopMusic(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.cut("music");
  }

  /** Lookahead scheduler: queue every sixteenth that starts within LOOKAHEAD of the audio clock. */
  private scheduleMusic(): void {
    const context = this.context;
    if (!context) return;
    this.musicAt = Math.max(this.musicAt, context.currentTime); // a stalled timer skips ahead instead of bursting
    try {
      for (; this.musicAt < context.currentTime + LOOKAHEAD; this.musicAt += SIXTEENTH) {
        this.playStep(this.musicStep, this.musicAt);
        this.musicStep = (this.musicStep + 1) % (CHORDS.length * 16);
      }
    } catch {
      this.musicOn = false;
      this.stopMusic();
    }
  }

  /** One sixteenth: pulse lead and triangle bass on eighths, thin arpeggio, triangle kick and noise snare/hats. */
  private playStep(step: number, at: number): void {
    const bar = step >> 4, sixteenth = step & 15, b = bar >= 8, chord = CHORDS[bar];
    const root = SCALE["CDEFGAB".indexOf(chord[0])], third = chord.endsWith("m") ? 3 : 4;
    if (sixteenth % 2 === 0) {
      const index = step >> 1, note = MELODY[index];
      if (note !== "-" && note !== ".") {
        let holds = 1;
        while (MELODY[(index + holds) % MELODY.length] === "-") holds += 1;
        const length = holds * 2 * SIXTEENTH * 0.9, pitch = hz(12 * (Number(note[1]) + 1) + SCALE["CDEFGAB".indexOf(note[0])]);
        const lead = this.tone("music", b ? "buzz" : "pulse", at, length, 0.3, pitch, pitch, 0.6);
        if (length > 0.3) vibrato(lead.detune, at + 0.12, length - 0.12, 15, 5.5);
      }
      const bass = (b ? [0, 0, 12, 0, 7, 7, 12, 7] : [0, -1, 12, -1, 7, -1, 12, -1])[sixteenth >> 1];
      if (bass >= 0) this.tone("music", "triangle", at, SIXTEENTH * 1.6, 0.5, hz(48 + root + bass), hz(48 + root + bass), 0.5);
    }
    if (b || sixteenth % 2 === 0) this.tone("music", "buzz", at, SIXTEENTH * 0.7, 0.07, hz(60 + root + [0, third, 7, 12][(b ? sixteenth : sixteenth >> 1) & 3]));
    if (sixteenth % 8 === 0) this.tone("music", "triangle", at, 0.13, 0.6, 150, 45);
    if (sixteenth % 8 === 4) this.noise("music", at, 0.11, 0.28, "bandpass", 1800, 0.8);
    if (b ? sixteenth % 2 === 0 : sixteenth % 4 === 2) this.noise("music", at, 0.03, 0.1, "highpass", 7000);
  }
}
