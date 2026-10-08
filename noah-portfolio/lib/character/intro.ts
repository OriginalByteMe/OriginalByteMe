/**
 * A renderer-independent, active-time introduction. Start ticking only after the
 * character is ready; pass paused:true while hidden, offscreen, or suspended.
 * No scroll position, browser globals, animation mixer, or wall clock is used.
 *
 * The shot: the camera starts close and dead-on in his room. He runs at it from far
 * back, bonks the lens at full speed, falls back, gets up, then points down at the Ask
 * bar while the camera pulls straight back along its own axis to the roaming framing.
 */
export type IntroPhase = "opening" | "approach" | "bonk" | "recoil" | "recover" | "point" | "roam";
export type IntroDialogueId = "approach" | "recoil" | "recover" | "point";
export type IntroDialogue = Readonly<{ id: IntroDialogueId; line: string; duration: number }>;

/** Phase lower bounds, in active seconds after the click that starts the intro. */
export const INTRO_PHASE_START = {
  opening: 0,
  approach: 0.5,
  bonk: 3.6,
  recoil: 3.95,
  recover: 5.25,
  point: 7.85,
  roam: 10.85,
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
  point: {
    id: "point",
    line: "If you want to know anything I'm not telling you, ask me anything down here!",
    duration: 3,
  },
};
/** He eases into the run over this share of the approach, then holds his speed into the lens. */
const RUN_UP = 0.15;
/** Metres he slides back from the lens while he falls. */
const RECOIL_SLIDE = 0.6;
/** The dolly back to the roaming framing ends this long after he starts pointing. */
const DOLLY_END = INTRO_PHASE_START.point + 1.2;
/** Seconds his pointing arm takes to rise and to drop. */
const POINT_RAMP = 0.45;

export type IntroSampleOptions = { reducedMotion?: boolean };
export type IntroSample = Readonly<{
  elapsed: number;
  progress: number;
  phase: IntroPhase;
  phaseProgress: number;
  blackOpacity: number;
  titleOpacity: number;
  /** One while the camera holds the close lens shot; eases to zero, the roaming framing, while he recovers and points. */
  lens: number;
  /** Weight of his arm pointing down at the Ask bar. */
  point: number;
  pose: Readonly<{
    /** Zero where the run starts, far back; one with his face at the lens. */
    travel: number;
    /** Travel per second, for the run clip's speed. Zero outside the run. */
    pace: number;
    /** Metres he has slid back from the lens since the bonk. */
    slide: number;
    /** Metres above the actor's resting floor position. */
    lift: number;
    /** Pitch and yaw in radians. The recoil falls back before standing up. */
    lean: number;
    turn: number;
    /** Y-scale multiplier; one is uncompressed. */
    squash: number;
  }>;
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

const PHASES: readonly IntroPhase[] = ["opening", "approach", "bonk", "recoil", "recover", "point", "roam"];
const DIALOGUE_IDS: readonly IntroDialogueId[] = ["approach", "recoil", "recover", "point"];
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
    // The tolerance ends a line that runs to the end of the intro on its last frame, despite rounding.
    if (time >= INTRO_PHASE_START[id] && time < INTRO_PHASE_START[id] + INTRO_DIALOGUE[id].duration - 1e-9) {
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
  let travel = 1;
  let pace = 0;
  let slide = RECOIL_SLIDE;
  let lift = 0;
  let lean = 0;
  let turn = 0;
  let squash = 1;
  let cameraShake = 0;
  if (phase === "opening") {
    travel = 0;
    slide = 0;
  } else if (phase === "approach") {
    // Accelerate over the run-up, then a steady sprint: he hits the lens at full speed.
    const u = phaseProgress;
    const scale = 1 - RUN_UP / 2;
    travel = (u < RUN_UP ? u * u / (2 * RUN_UP) : u - RUN_UP / 2) / scale;
    pace = Math.min(1, u / RUN_UP) / scale / (starts.bonk - starts.approach);
    slide = 0;
    lean = 0.14 * smooth(range(u, 0, RUN_UP));
  } else if (phase === "bonk") {
    slide = 0.03 * smooth(phaseProgress);
    lean = 0.14 - 0.34 * smooth(phaseProgress);
    squash = 1 - 0.13 * pulse(phaseProgress);
    cameraShake = pulse(phaseProgress) * (1 - 0.5 * phaseProgress);
  } else if (phase === "recoil") {
    slide = 0.03 + (RECOIL_SLIDE - 0.03) * smooth(phaseProgress);
    lift = 0.1 * pulse(phaseProgress) ** 2;
    lean = -0.2 - 1.02 * smooth(phaseProgress);
  } else if (phase === "recover") {
    // Up on his feet over the first 1.6 s, then the wave plays out.
    lean = -1.22 * (1 - smooth(range(elapsed, starts.recover, starts.recover + 1.6)));
    turn = 0.08 * pulse(phaseProgress);
  }
  return {
    elapsed,
    progress: elapsed / INTRO_DURATION,
    phase,
    phaseProgress,
    blackOpacity: 1 - smooth(range(elapsed, 0, starts.approach)),
    titleOpacity: 1 - smooth(range(elapsed, 0, starts.approach * 0.7)),
    lens: 1 - smooth(range(elapsed, starts.recover, DOLLY_END)),
    point: smooth(range(elapsed, starts.point, starts.point + POINT_RAMP)) * (1 - smooth(range(elapsed, starts.roam - POINT_RAMP, starts.roam))),
    pose: { travel, pace, slide, lift, lean, turn, squash },
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
