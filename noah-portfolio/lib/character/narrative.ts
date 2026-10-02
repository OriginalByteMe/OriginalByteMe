/**
 * Scroll, not elapsed time, drives the cinematic. All values are renderer-agnostic:
 * a scene maps normalized depth to its own distant/lens/stage positions.
 */
export type NarrativePhase = "intro" | "approach" | "bonk" | "invitation" | "roam";
export type NarrativeDialogueId = "approach" | "bonk" | "invitation";
export type NarrativeDialogue = Readonly<{
  id: NarrativeDialogueId;
  line: string;
  /** Seconds of optional nonverbal voice. Never advances the cinematic. */
  duration: number;
}>;

export const NARRATIVE_PHASE_START = {
  intro: 0,
  approach: 0.12,
  bonk: 0.38,
  invitation: 0.5,
  roam: 0.65,
} as const;

export const NARRATIVE_DIALOGUE: Readonly<Record<NarrativeDialogueId, NarrativeDialogue>> = {
  approach: { id: "approach", line: "Hi hi hi hi", duration: 2.4 },
  bonk: { id: "bonk", line: "Ow", duration: 0.7 },
  invitation: {
    id: "invitation",
    line: "Hey, is there anything you’d like to know about me? I’m just gonna follow you around for a little bit.",
    duration: 7.2,
  },
};

export type PublicCharacterFact = Readonly<{
  id: string;
  line: string;
  duration: number;
  /** Repository-relative, public portfolio corpus source; no private context. */
  source: `content/about-me/${string}.md`;
}>;

export const PUBLIC_CHARACTER_FACTS: readonly PublicCharacterFact[] = [
  {
    id: "making-in-3d",
    line: "I make things in 3D, too: CAD and 3D printing.",
    duration: 4.4,
    source: "content/about-me/fun-facts.md",
  },
  {
    id: "self-hosted",
    line: "My servers live a self-hosted life on Proxmox and Unraid.",
    duration: 4.8,
    source: "content/about-me/fun-facts.md",
  },
  {
    id: "marketplace-analytics",
    line: "I build marketplace analytics at MerchantSpring. Lots of moving parts!",
    duration: 4.8,
    source: "content/about-me/career.md",
  },
  {
    id: "llm-comparison",
    line: "I built an app that lets two LLMs go head-to-head.",
    duration: 4.5,
    source: "content/about-me/projects/llm-comparison.md",
  },
];

export type NarrativeSample = Readonly<{
  progress: number;
  phase: NarrativePhase;
  phaseProgress: number;
  approachProgress: number;
  recoilProgress: number;
  invitationProgress: number;
  pose: Readonly<{
    /** Zero is distant, one is touching the lens; roam rests at 0.45. */
    depth: number;
    /** Metres above the floor. */
    lift: number;
    /** Forward/backward pitch and yaw, in radians. */
    lean: number;
    turn: number;
    /** Small impact compression; scene may apply this to its outer actor. */
    squash: number;
  }>;
  runBlend: number;
  /** Eight run cycles, derived only from scroll and safe to scrub in reverse. */
  stridePhase: number;
  /** Normalized shake envelope, zero outside the short impact beat. */
  cameraShake: number;
  caption: string | null;
}>;

export type NarrativeSampleOptions = { reducedMotion?: boolean };

function unit(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function range(value: number, start: number, end: number): number {
  return unit((value - start) / (end - start));
}

function smooth(value: number): number { return value * value * (3 - 2 * value); }
function pulse(value: number): number {
  return value > 0 && value < 1 ? Math.sin(value * Math.PI) : 0;
}

/** Recompute from current geometry after scroll and resize, without cached offsets. */
export function heroScrollProgress(
  heroRect: Readonly<{ top: number; height: number }>,
  viewportHeight: number,
): number {
  if (![heroRect.top, heroRect.height, viewportHeight].every(Number.isFinite)
    || heroRect.height <= 0 || viewportHeight <= 0) return 0;
  const travel = Math.max(0, heroRect.height - viewportHeight);
  // A non-scrolling hero has no cinematic runway. Preserve its landing state.
  return travel > 0 ? unit(-heroRect.top / travel) : 0;
}

/** Pure and reversible: sampling the same progress always gives the same pose. */
export function sampleNarrative(progress: number, options: NarrativeSampleOptions = {}): NarrativeSample {
  const p = options.reducedMotion ? 1 : unit(progress);
  const starts = NARRATIVE_PHASE_START;
  const approachProgress = range(p, starts.approach, starts.bonk);
  const recoilProgress = range(p, starts.bonk, starts.invitation);
  const invitationProgress = range(p, starts.invitation, starts.roam);
  const phase: NarrativePhase = p < starts.approach ? "intro"
    : p < starts.bonk ? "approach"
      : p < starts.invitation ? "bonk"
        : p < starts.roam ? "invitation" : "roam";
  const end = phase === "intro" ? starts.approach
    : phase === "approach" ? starts.bonk
      : phase === "bonk" ? starts.invitation
        : phase === "invitation" ? starts.roam : 1;
  const phaseProgress = range(p, starts[phase], end);
  const stridePhase = approachProgress * Math.PI * 16;
  const runBlend = phase === "approach"
    ? smooth(range(approachProgress, 0, 0.12)) * (1 - smooth(range(approachProgress, 0.84, 1))) : 0;
  const impact = phase === "bonk" ? pulse(range(recoilProgress, 0, 0.42)) : 0;
  const depth = phase === "intro" ? 0
    : phase === "approach" ? smooth(approachProgress)
      : phase === "bonk" ? 1 - 0.5 * smooth(recoilProgress)
        : phase === "invitation" ? 0.5 - 0.05 * smooth(invitationProgress) : 0.45;
  return {
    progress: p,
    phase,
    phaseProgress,
    approachProgress,
    recoilProgress,
    invitationProgress,
    pose: {
      depth,
      lift: phase === "approach" ? Math.abs(Math.sin(stridePhase)) * 0.045 * runBlend : 0,
      lean: phase === "approach" ? 0.13 * runBlend
        : phase === "bonk" ? -0.24 * pulse(recoilProgress) : 0,
      turn: phase === "invitation" ? 0.08 * pulse(invitationProgress) : 0,
      squash: 1 - 0.035 * impact,
    },
    runBlend,
    stridePhase,
    cameraShake: options.reducedMotion ? 0 : impact * (1 - recoilProgress),
    caption: phase === "approach" || phase === "bonk" || phase === "invitation"
      ? NARRATIVE_DIALOGUE[phase].line : null,
  };
}

export type NarrativeFrame = NarrativeSample & Readonly<{
  /** First-visit caption; null after rewind, skip, or cancellation. */
  caption: string | null;
  dialogue: NarrativeDialogue | null;
  /** One-shot edge, suitable for opt-in audio and live-region announcements. */
  dialogueStarted: NarrativeDialogue | null;
  /** Phase exit/cancellation edge. Stop scheduled voice when true. */
  dialogueEnded: boolean;
  skipped: boolean;
}>;

export type NarrativeUpdateOptions = NarrativeSampleOptions & { paused?: boolean };
export type NarrativeControllerOptions = NarrativeSampleOptions & {
  skipped?: boolean;
  /** Restore these IDs from session storage if the scene itself is remounted. */
  consumedDialogueIds?: readonly NarrativeDialogueId[];
};

const DIALOGUE_ORDER: readonly NarrativeDialogueId[] = ["approach", "bonk", "invitation"];

/**
 * Own one instance for the hero session. Poses scrub freely; dialogue does not.
 * Jumping past a line consumes it, so reverse scrolling never queues stale speech.
 */
export class CharacterNarrativeController {
  private sample: NarrativeSample;
  private readonly consumed: Set<NarrativeDialogueId>;
  private currentDialogue: NarrativeDialogue | null = null;
  private skipped: boolean;
  private reducedMotion: boolean;
  private cancellationPending = false;

  constructor(options: NarrativeControllerOptions = {}) {
    this.skipped = options.skipped ?? false;
    this.reducedMotion = options.reducedMotion ?? false;
    this.consumed = new Set(options.consumedDialogueIds ?? []);
    this.sample = sampleNarrative(this.skipped ? 1 : 0, { reducedMotion: this.reducedMotion });
    if (this.skipped || this.reducedMotion) this.consumeThrough(1);
  }

  /** Persist on dialogueStarted or skip; the helper never accesses browser storage. */
  get consumedDialogueIds(): readonly NarrativeDialogueId[] {
    return DIALOGUE_ORDER.filter((id) => this.consumed.has(id));
  }

  /** Permanent for this visit; a backwards scroll cannot restart the introduction. */
  skipIntro(): void {
    this.skipped = true;
    this.cancellationPending ||= this.currentDialogue !== null;
    this.currentDialogue = null;
    this.sample = sampleNarrative(1);
    this.consumeThrough(1);
  }

  private consumeThrough(progress: number): void {
    for (const id of DIALOGUE_ORDER) {
      if (progress >= NARRATIVE_PHASE_START[id]) this.consumed.add(id);
    }
  }

  update(progress: number, options: NarrativeUpdateOptions = {}): NarrativeFrame {
    let dialogueEnded = this.cancellationPending;
    this.cancellationPending = false;
    let dialogueStarted: NarrativeDialogue | null = null;
    if (options.reducedMotion !== undefined) this.reducedMotion = options.reducedMotion;

    // Reduced motion and an explicit skip take priority even if playback is paused.
    if (this.skipped || this.reducedMotion) {
      dialogueEnded ||= this.currentDialogue !== null;
      this.currentDialogue = null;
      this.sample = sampleNarrative(1);
      this.consumeThrough(1);
    } else if (options.paused) {
      // Freeze progress and cancel rather than resuming a half-spoken line later.
      dialogueEnded ||= this.currentDialogue !== null;
      this.currentDialogue = null;
    } else {
      const next = sampleNarrative(progress);
      const nextDialogue = next.phase === "approach" || next.phase === "bonk" || next.phase === "invitation"
        ? NARRATIVE_DIALOGUE[next.phase] : null;
      if (this.currentDialogue?.id !== nextDialogue?.id) {
        dialogueEnded ||= this.currentDialogue !== null;
        this.currentDialogue = null;
      }
      if (nextDialogue && !this.consumed.has(nextDialogue.id)) {
        this.currentDialogue = nextDialogue;
        dialogueStarted = nextDialogue;
      }
      this.consumeThrough(next.progress);
      this.sample = next;
    }
    return {
      ...this.sample,
      caption: this.currentDialogue?.line ?? null,
      dialogue: this.currentDialogue,
      dialogueStarted,
      dialogueEnded,
      skipped: this.skipped,
    };
  }
}

export const NARRATIVE_FACT_CONFIG = {
  maximumFacts: 3,
  requiredStationaryTime: 3,
  minimumQuietGap: 25,
  maxDelta: 0.1,
} as const;

export type NarrativeFactFrame = Readonly<{
  activeFact: PublicCharacterFact | null;
  factStarted: PublicCharacterFact | null;
  /** True once after natural completion, movement, leaving roam, or pause. */
  factEnded: boolean;
  /** Caller persists this immediately when factStarted is present. */
  count: number;
}>;
export type NarrativeFactOptions = { factsShown?: number };
export type NarrativeFactTickOptions = {
  phase: NarrativePhase;
  stationary: boolean;
  paused?: boolean;
};

/**
 * Active-scene clock for optional fact asides, separate from the scroll cinematic.
 * Paused/hidden/offscreen callers pass paused:true or stop ticking and call cancel().
 * The quiet gap accrues during active roaming, including movement; speaking still
 * requires three uninterrupted stationary seconds. No browser globals or timers.
 */
export class NarrativeFactController {
  private elapsed = 0;
  private stationaryTime = 0;
  private count: number;
  private nextFactAt: number;
  private activeFact: PublicCharacterFact | null = null;
  private startedAt = 0;
  private cancellationPending = false;

  constructor(options: NarrativeFactOptions = {}) {
    const count = options.factsShown ?? 0;
    this.count = Number.isFinite(count)
      ? Math.max(0, Math.min(NARRATIVE_FACT_CONFIG.maximumFacts, Math.floor(count))) : 0;
    // Remounting cannot reset the quiet interval or bypass the session cap.
    this.nextFactAt = this.count > 0 ? NARRATIVE_FACT_CONFIG.minimumQuietGap : 0;
  }

  /** Cancelled lines still count toward the session limit. */
  cancel(): void {
    this.stationaryTime = 0;
    if (this.activeFact) {
      this.cancellationPending = true;
      this.activeFact = null;
      this.nextFactAt = this.elapsed + NARRATIVE_FACT_CONFIG.minimumQuietGap;
    }
  }

  tick(activeDeltaSeconds: number, options: NarrativeFactTickOptions): NarrativeFactFrame {
    const dt = Number.isFinite(activeDeltaSeconds) && activeDeltaSeconds > 0
      ? Math.min(activeDeltaSeconds, NARRATIVE_FACT_CONFIG.maxDelta) : 0;
    let factStarted: PublicCharacterFact | null = null;
    if (options.paused || options.phase !== "roam") {
      this.cancel();
    } else {
      this.elapsed += dt;
      if (!options.stationary) {
        this.cancel();
      } else {
        this.stationaryTime += dt;
        if (this.activeFact && this.elapsed - this.startedAt >= this.activeFact.duration) {
          this.cancel();
        }
        if (dt > 0 && !this.activeFact && this.count < NARRATIVE_FACT_CONFIG.maximumFacts
          && this.stationaryTime >= NARRATIVE_FACT_CONFIG.requiredStationaryTime
          && this.elapsed >= this.nextFactAt) {
          this.activeFact = PUBLIC_CHARACTER_FACTS[this.count];
          factStarted = this.activeFact;
          this.startedAt = this.elapsed;
          this.count += 1;
        }
      }
    }
    const factEnded = this.cancellationPending;
    this.cancellationPending = false;
    return { activeFact: this.activeFact, factStarted, factEnded, count: this.count };
  }
}
