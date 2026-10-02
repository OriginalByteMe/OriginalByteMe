import { GREETING_BEATS, type CharacterGreeting, type GreetingBeat } from "./idle";

export type UtteranceKind = "greeting" | "bonk" | "fact";

/** Finite, deterministic nonverbal rhythms, independent of browser speech services. */
function utteranceBeats(line: string, kind: UtteranceKind): readonly GreetingBeat[] {
  const text = line.trim().slice(0, 400);
  if (!text) return [];
  if (kind === "bonk") return [{ at: 0.025, duration: 0.2, pitch: 185 }];
  const wordCount = text.split(/\s+/).length;
  const count = Math.max(2, Math.min(18, Math.ceil(wordCount * 1.6)));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  const steps = [0, 3, 7, 2, 5, -2, 0, 4];
  const base = kind === "fact" ? 370 : 440;
  return Array.from({ length: count }, (_, index) => ({
    at: 0.05 + index * 0.21 + Math.floor(index / 4) * 0.13,
    duration: 0.13 + ((hash >>> (index % 24)) % 8) * 0.01,
    pitch: base * 2 ** (steps[(index + hash % steps.length) % steps.length] / 12),
  }));
}

/** Includes scheduling lead/tail; never exceeds 4.5 seconds. Empty captions return zero. */
export function utteranceDuration(line: string, kind: UtteranceKind = "greeting"): number {
  const last = utteranceBeats(line, kind).at(-1);
  return last ? last.at + last.duration + 0.03 : 0;
}

export type AudioContextFactory = () => AudioContext | null;
type MeepNode = { oscillator: OscillatorNode; gain: GainNode };

function browserAudioContext(): AudioContext | null {
  // Browser globals are consulted only inside enableFromGesture(), never at import/mount.
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  return Context ? new Context() : null;
}

/** Opt-in, original oscillator meeps; no recordings, speech synthesis, or network calls. */
export class CharacterMeepAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly nodes = new Set<MeepNode>();
  private disposed = false;
  private soundEnabled = false;
  private enableRevision = 0;

  constructor(private readonly createContext: AudioContextFactory = browserAudioContext) {}

  get enabled(): boolean { return this.soundEnabled && !this.disposed; }

  /** Invoke only from an explicit Sound on click/tap, never from movement or autoplay. */
  async enableFromGesture(): Promise<boolean> {
    if (this.disposed) return false;
    const revision = ++this.enableRevision;
    try {
      if (!this.context) this.context = this.createContext();
      const context = this.context;
      if (!context || context.state === "closed") return false;
      if (!this.master) {
        this.master = context.createGain();
        this.master.gain.setValueAtTime(0.12, context.currentTime);
        this.master.connect(context.destination);
      }
      if (context.state !== "running") await context.resume();
      if (this.disposed || revision !== this.enableRevision) return false;
      this.soundEnabled = context.state === "running";
      return this.soundEnabled;
    } catch {
      if (revision === this.enableRevision) this.soundEnabled = false;
      return false;
    }
  }

  /** Starts only when already gesture-enabled. Returns false when unavailable or muted. */
  playGreeting(greeting: CharacterGreeting): boolean {
    return this.playBeats(GREETING_BEATS[greeting.id]);
  }

  /** Captions remain readable text; these bounded meeps do not speak literal words. */
  playUtterance(line: string, kind: UtteranceKind = "greeting"): boolean {
    const beats = utteranceBeats(line, kind);
    return beats.length > 0 && this.playBeats(beats, kind === "bonk");
  }

  private playBeats(beats: readonly GreetingBeat[], bonk = false): boolean {
    const context = this.context;
    if (!this.enabled || !context || !this.master || context.state !== "running") return false;
    this.cancel();
    const start = context.currentTime + 0.015;
    try {
      for (const beat of beats) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const node = { oscillator, gain };
        this.nodes.add(node);
        const at = start + beat.at;
        const end = at + beat.duration;
        oscillator.type = bonk ? "sine" : "triangle";
        // A rounded little upward scoop followed by a falling tail, rather than speech.
        oscillator.frequency.setValueAtTime(beat.pitch * 0.88, at);
        oscillator.frequency.exponentialRampToValueAtTime(beat.pitch * 1.06, at + beat.duration * 0.28);
        oscillator.frequency.exponentialRampToValueAtTime(beat.pitch * 0.96, end);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.26, at + Math.min(0.025, beat.duration * 0.2));
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(this.master);
        oscillator.onended = () => this.release(node);
        oscillator.start(at);
        oscillator.stop(end + 0.015);
      }
      return true;
    } catch {
      this.cancel();
      return false;
    }
  }

  private release(node: MeepNode): void {
    if (!this.nodes.delete(node)) return;
    node.oscillator.onended = null;
    node.oscillator.disconnect();
    node.gain.disconnect();
  }

  /** Stop scheduled as well as playing meeps on movement, pause, or offscreen. */
  cancel(): void {
    const now = this.context?.currentTime ?? 0;
    for (const node of [...this.nodes]) {
      try {
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setValueAtTime(0, now);
        node.oscillator.stop(now);
      } catch { /* It may already have ended or its context may have closed. */ }
      this.release(node);
    }
  }

  mute(): void {
    this.enableRevision += 1;
    this.soundEnabled = false;
    this.cancel();
  }

  /** Idempotent; closes the one owned context and releases every scheduled node. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.mute();
    this.master?.disconnect();
    this.master = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      try { await context.close(); } catch { /* Teardown must also work after browser shutdown. */ }
    }
  }
}
