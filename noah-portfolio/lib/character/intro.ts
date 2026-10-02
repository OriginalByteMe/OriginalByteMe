/**
 * A renderer-independent, active-time introduction. Start ticking only after the
 * character is ready; pass paused:true while hidden, offscreen, or suspended.
 * No scroll position, browser globals, animation mixer, or wall clock is used.
 */
export type IntroPhase = "opening" | "reveal" | "approach" | "bonk" | "recoil" | "recover" | "roam";
export type IntroDialogueId = "approach" | "recoil" | "recover";
export type IntroDialogue = Readonly<{ id: IntroDialogueId; line: string; duration: number }>;

/** Phase lower bounds, in active seconds. */
export const INTRO_PHASE_START = {
  opening: 0,
  reveal: 2.2,
  approach: 3.6,
  bonk: 6.6,
  recoil: 7.05,
  recover: 8.8,
  roam: 11.6,
} as const;
export const INTRO_DURATION = INTRO_PHASE_START.roam;
export const INTRO_MAX_DELTA = 0.1;
export const INTRO_TITLE = "Hi, I’m Noah Rijkaard";
export const INTRO_DIALOGUE: Readonly<Record<IntroDialogueId, IntroDialogue>> = {
  approach: { id: "approach", line: "Hi hi hi hi", duration: 2.4 },
  recoil: { id: "recoil", line: "Ow", duration: 0.7 },
  recover: {
    id: "recover",
    line: "Okay. Click anywhere on the floor to send me exploring.",
    duration: 2.6,
  },
};

export type IntroSampleOptions = { reducedMotion?: boolean };
export type IntroSample = Readonly<{
  elapsed: number;
  progress: number;
  phase: IntroPhase;
  phaseProgress: number;
  revealProgress: number;
  approachProgress: number;
  recoilProgress: number;
  recoverProgress: number;
  /** Zero at the opening camera; one at the final free-roam camera. */
  cameraProgress: number;
  blackOpacity: number;
  titleOpacity: number;
  pose: Readonly<{
    /** Zero is distant, one touches the lens, and free roam starts at 0.45. */
    depth: number;
    /** Metres above the actor's resting floor position. */
    lift: number;
    /** Pitch and yaw in radians. The recoil falls back before standing up. */
    lean: number;
    turn: number;
    /** Y-scale multiplier; one is uncompressed. */
    squash: number;
  }>;
  runBlend: number;
  /** Optional procedural gait; a real animation mixer may use elapsed time. */
  stridePhase: number;
  /** Normalized impact envelope. Zero before and after the bonk. */
  cameraShake: number;
  caption: string | null;
}>;
export type IntroFrame = IntroSample & Readonly<{
  dialogue: IntroDialogue | null;
  /** One-shot cue for opt-in audio/live regions; never emitted while paused. */
  dialogueStarted: IntroDialogue | null;
  /** One-shot cancellation or natural completion edge. */
  dialogueEnded: boolean;
  skipped: boolean;
}>;
export type IntroTickOptions = IntroSampleOptions & { paused?: boolean };
export type IntroControllerOptions = IntroSampleOptions & {
  skipped?: boolean;
  /** Optional session state, stored by the caller rather than this pure module. */
  consumedDialogueIds?: readonly IntroDialogueId[];
};

const PHASES: readonly IntroPhase[] = ["opening", "reveal", "approach", "bonk", "recoil", "recover", "roam"];
const DIALOGUE_IDS: readonly IntroDialogueId[] = ["approach", "recoil", "recover"];
const TIME_BOUNDARIES = [
  ...Object.values(INTRO_PHASE_START),
  ...DIALOGUE_IDS.map((id) => INTRO_PHASE_START[id] + INTRO_DIALOGUE[id].duration),
];
const unit = (value: number) => Math.max(0, Math.min(1, value));
const range = (value: number, start: number, end: number) => unit((value - start) / (end - start));
const smooth = (value: number) => value * value * (3 - 2 * value);
const pulse = (value: number) => value > 0 && value < 1 ? Math.sin(value * Math.PI) : 0;

function safeTime(value: number): number {
  const clamped = Number.isNaN(value) ? 0 : Math.max(0, Math.min(INTRO_DURATION, value));
  // Avoid one-frame phase/cue differences caused by accumulated 30/60 Hz error.
  return TIME_BOUNDARIES.find((boundary) => Math.abs(clamped - boundary) < 1e-9) ?? clamped;
}

function dialogueAt(time: number): IntroDialogue | null {
  for (const id of DIALOGUE_IDS) {
    if (time >= INTRO_PHASE_START[id] && time < INTRO_PHASE_START[id] + INTRO_DIALOGUE[id].duration) {
      return INTRO_DIALOGUE[id];
    }
  }
  return null;
}

/** Deterministic inspection/sampling; elapsedSeconds is active time, not scroll. */
export function sampleTimedIntro(elapsedSeconds: number, options: IntroSampleOptions = {}): IntroSample {
  const elapsed = safeTime(options.reducedMotion ? INTRO_DURATION : elapsedSeconds);
  const starts = INTRO_PHASE_START;
  const phase = PHASES.findLast((name) => elapsed >= starts[name]) ?? "opening";
  const phaseIndex = PHASES.indexOf(phase);
  const phaseProgress = phase === "roam" ? 1 : range(elapsed, starts[phase], starts[PHASES[phaseIndex + 1]]);
  const revealProgress = range(elapsed, starts.reveal, starts.approach);
  const approachProgress = range(elapsed, starts.approach, starts.bonk);
  const recoilProgress = range(elapsed, starts.recoil, starts.recover);
  const recoverProgress = range(elapsed, starts.recover, starts.roam);
  const stridePhase = approachProgress * Math.PI * 12;
  const runBlend = smooth(range(approachProgress, 0, 0.12))
    * (1 - smooth(range(approachProgress, 0.88, 1)));
  let depth = 0;
  let lift = 0;
  let lean = 0;
  let turn = 0;
  let squash = 1;
  let cameraShake = 0;
  if (phase === "approach") {
    depth = smooth(approachProgress);
    lift = Math.sin(stridePhase) ** 2 * 0.045 * runBlend;
    lean = 0.14 * runBlend;
  } else if (phase === "bonk") {
    depth = 1 - 0.02 * smooth(phaseProgress);
    lean = -0.2 * smooth(phaseProgress);
    squash = 1 - 0.13 * pulse(phaseProgress);
    cameraShake = pulse(phaseProgress) * (1 - 0.5 * phaseProgress);
  } else if (phase === "recoil") {
    depth = 0.98 - 0.34 * smooth(recoilProgress);
    lift = 0.1 * pulse(recoilProgress) ** 2;
    lean = -0.2 - 1.02 * smooth(recoilProgress);
  } else if (phase === "recover") {
    depth = 0.64 - 0.19 * smooth(recoverProgress);
    lean = -1.22 * (1 - smooth(recoverProgress));
    turn = 0.08 * pulse(recoverProgress);
  } else if (phase === "roam") {
    depth = 0.45;
  }
  return {
    elapsed,
    progress: elapsed / INTRO_DURATION,
    phase,
    phaseProgress,
    revealProgress,
    approachProgress,
    recoilProgress,
    recoverProgress,
    cameraProgress: smooth(range(elapsed, starts.reveal, starts.roam)),
    blackOpacity: 1 - smooth(revealProgress),
    titleOpacity: smooth(range(elapsed, 0.15, 0.75)) * (1 - smooth(range(elapsed, starts.reveal, 2.9))),
    pose: { depth, lift, lean, turn, squash },
    runBlend,
    stridePhase,
    cameraShake,
    caption: dialogueAt(elapsed)?.line ?? null,
  };
}

/** Own one controller per hero session; the caller controls readiness/visibility. */
export class CharacterIntroController {
  private sample: IntroSample;
  private readonly consumed: Set<IntroDialogueId>;
  private currentDialogue: IntroDialogue | null = null;
  private skipped: boolean;
  private reducedMotion: boolean;

  constructor(options: IntroControllerOptions = {}) {
    this.skipped = options.skipped ?? false;
    this.reducedMotion = options.reducedMotion ?? false;
    this.consumed = new Set(options.consumedDialogueIds ?? []);
    this.sample = sampleTimedIntro(this.skipped || this.reducedMotion ? INTRO_DURATION : 0);
    this.consumeThrough(this.sample.elapsed);
  }

  get consumedDialogueIds(): readonly IntroDialogueId[] {
    return DIALOGUE_IDS.filter((id) => this.consumed.has(id));
  }

  private consumeThrough(time: number): void {
    for (const id of DIALOGUE_IDS) {
      if (time >= INTRO_PHASE_START[id]) this.consumed.add(id);
    }
  }

  private frame(dialogueStarted: IntroDialogue | null = null, dialogueEnded = false): IntroFrame {
    return {
      ...this.sample,
      caption: this.currentDialogue?.line ?? null,
      dialogue: this.currentDialogue,
      dialogueStarted,
      dialogueEnded,
      skipped: this.skipped,
    };
  }

  /** Immediate and permanent until reset. Handle the returned cancellation edge. */
  skip(): IntroFrame {
    const dialogueEnded = this.currentDialogue !== null;
    this.currentDialogue = null;
    this.skipped = true;
    this.sample = sampleTimedIntro(INTRO_DURATION);
    this.consumeThrough(INTRO_DURATION);
    return this.frame(null, dialogueEnded);
  }

  /** Explicit replay clears cue history, while honoring the current motion preference. */
  reset(options: IntroSampleOptions = {}): IntroFrame {
    const dialogueEnded = this.currentDialogue !== null;
    this.currentDialogue = null;
    this.skipped = false;
    this.reducedMotion = options.reducedMotion ?? this.reducedMotion;
    this.consumed.clear();
    this.sample = sampleTimedIntro(0, { reducedMotion: this.reducedMotion });
    this.consumeThrough(this.sample.elapsed);
    return this.frame(null, dialogueEnded);
  }

  tick(deltaSeconds: number, options: IntroTickOptions = {}): IntroFrame {
    if (options.reducedMotion !== undefined) this.reducedMotion = options.reducedMotion;
    const dt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? Math.min(deltaSeconds, INTRO_MAX_DELTA) : 0;
    let dialogueEnded = false;
    let dialogueStarted: IntroDialogue | null = null;
    if (this.skipped || this.reducedMotion) {
      dialogueEnded = this.currentDialogue !== null;
      this.currentDialogue = null;
      this.sample = sampleTimedIntro(INTRO_DURATION);
      this.consumeThrough(INTRO_DURATION);
    } else if (options.paused) {
      // Do not restart a half-spoken cue after a hidden tab or offscreen pause.
      dialogueEnded = this.currentDialogue !== null;
      this.currentDialogue = null;
    } else if (dt > 0) {
      this.sample = sampleTimedIntro(this.sample.elapsed + dt);
      const nextDialogue = dialogueAt(this.sample.elapsed);
      if (this.currentDialogue?.id !== nextDialogue?.id) {
        dialogueEnded = this.currentDialogue !== null;
        this.currentDialogue = null;
      }
      if (nextDialogue && !this.consumed.has(nextDialogue.id)) {
        this.currentDialogue = nextDialogue;
        dialogueStarted = nextDialogue;
      }
      this.consumeThrough(this.sample.elapsed);
    }
    return this.frame(dialogueStarted, dialogueEnded);
  }
}
