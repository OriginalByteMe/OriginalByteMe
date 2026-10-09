import type { AreaId } from "@/components/character/world/types";

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

type CorpusSource = `content/about-me/${string}.md`;
/** A spoken line. Facts carry a repository-relative public corpus `source`; no private context. */
export type CharacterLine = Readonly<{ id: string; line: string; source?: CorpusSource }>;

const BIO = "content/about-me/bio.md";
const CAREER = "content/about-me/career.md";
const FUN = "content/about-me/fun-facts.md";
const project = (slug: string): CorpusSource => `content/about-me/projects/${slug}.md`;

export const PORTRAIT_LINE: CharacterLine = { id: "portrait-admire", line: "Huh. Maybe that's what I'd look like." };
export const CHASE_LINE: CharacterLine = { id: "chase", line: "Hey, wait for me!" };
export const JUMP_LINE: CharacterLine = { id: "jump", line: "Hup! Coming back up!" };
/** Walking into furniture. */
export const BUMP_LINE: CharacterLine = { id: "bump", line: "Oops, excuse me, furniture." };
/** Escalating replies to afro clicks; index by click count, clamped to the last. */
export const AFRO_LINES: readonly CharacterLine[] = [
  { id: "afro-1", line: "Stop, don't do that." },
  { id: "afro-2", line: "Hey! The afro is not a button." },
  { id: "afro-3", line: "Seriously, I just fluffed it!" },
  { id: "afro-4", line: "Okay, now you're doing it on purpose." },
];
/** Spoken at recover after landing; the land beat already has its own "Ow". */
export const AREA_ARRIVAL_LINES: Readonly<Record<AreaId, CharacterLine>> = {
  bedroom: { id: "arrive-bedroom", line: "Home sweet bedroom!" },
  lab: { id: "arrive-lab", line: "Oh hey, welcome to my lab!" },
  about: { id: "arrive-about", line: "Okay, this part's about me." },
};

/** Keyed by the station ids he plays on his own; the scene picks one when a station's routine starts. Skill groups and jobs only present, with lines their rooms build. */
export const STATION_LINES: Readonly<Record<string, readonly CharacterLine[]>> = {
  desk: [
    { id: "desk-merchantspring", line: "Building marketplace analytics at MerchantSpring. Click clack!", source: CAREER },
    { id: "desk-senior-ai", line: "Senior AI Engineer, reporting for keyboard duty!", source: CAREER },
  ],
  printer: [
    { id: "printer-bowiq", line: "CAD design and FDM printing. That's my Bowiq work!", source: CAREER },
    { id: "printer-layers", line: "I'm into 3D printing and CAD. Look at those layers!", source: FUN },
  ],
  rack: [
    { id: "rack-self-hosted", line: "I self-host on Proxmox and Unraid. Hi, little servers!", source: FUN },
    { id: "rack-docker", line: "Self-hosting and Docker? Yes please!", source: CAREER },
  ],
  ball: [
    { id: "ball-toss", line: "Up it goes... and catch!" },
    { id: "ball-record", line: "Two catches in a row. New record!" },
  ],
  bed: [{ id: "bed-read", line: "Quick reading break. Don't tell the servers." }],
  "project:ai-image-cutout": [
    { id: "project-ai-image-cutout", line: "This one cuts people out of photos to make stickers!", source: project("ai-image-cutout") },
  ],
  "project:ask-me-portfolio": [
    { id: "project-ask-me-portfolio", line: "You're on this one! An LLM composes every answer.", source: project("ask-me-portfolio") },
  ],
  "project:llm-comparison": [
    { id: "project-llm-comparison", line: "Pit two LLMs against each other and see how they compare!", source: project("llm-comparison") },
  ],
  "project:moodify": [
    { id: "project-moodify", line: "Moodify paints the page in an album cover's colours!", source: project("moodify") },
  ],
  "project:story-model-benchmark": [
    { id: "project-story-model-benchmark", line: "This benchmark helps choose the model behind my Story!", source: project("story-model-benchmark") },
  ],
  portrait: [PORTRAIT_LINE, { id: "portrait-straighten", line: "A little to the left... perfect." }],
  skyline: [{ id: "skyline-kl", line: "Kuala Lumpur, Malaysia. That's where I'm based!", source: BIO }],
};

/** Idle asides per area; every one is a sourced public fact. */
export const TIDBIT_LINES: Readonly<Record<AreaId, readonly CharacterLine[]>> = {
  bedroom: [
    { id: "tidbit-full-stack", line: "I'm full-stack: backend, infra and frontend!", source: CAREER },
    { id: "tidbit-pragmatic", line: "I lean toward pragmatic, scalable systems.", source: CAREER },
    { id: "tidbit-3d", line: "Fun fact: I'm into CAD and FDM 3D printing!", source: FUN },
    { id: "tidbit-self-hosting", line: "Fun fact: I self-host on Proxmox and Unraid!", source: FUN },
  ],
  lab: [
    { id: "tidbit-llm-open-source", line: "LLM Comparison is open source. Go poke at it!", source: project("llm-comparison") },
    { id: "tidbit-supa-eval", line: "At Supa I shipped LLM evaluation tooling!", source: CAREER },
    { id: "tidbit-benchmark-fallback", line: "My benchmark even picked a free fallback model!", source: project("story-model-benchmark") },
    { id: "tidbit-segment-anything", line: "The sticker maker uses Segment Anything under the hood!", source: project("ai-image-cutout") },
    { id: "tidbit-moodify-hero", line: "Moodify's palette trick recolours this site's hero too!", source: project("moodify") },
  ],
  about: [
    { id: "tidbit-kuala-lumpur", line: "I'm based in Kuala Lumpur, Malaysia!", source: BIO },
    { id: "tidbit-supa-years", line: "Five years at Supa building AI training-data tools!", source: CAREER },
    { id: "tidbit-merchantspring-2026", line: "I joined MerchantSpring in 2026 as a Senior AI Engineer.", source: CAREER },
    { id: "tidbit-design-eye", line: "Full-stack developer with a keen eye for design!", source: BIO },
  ],
};

export const TIDBIT_CONFIG = {
  /** Active seconds between line starts, drawn per line. */
  minimumGap: 18,
  maximumGap: 25,
  /** Uninterrupted ready seconds before speaking. */
  readyTime: 3,
  maximumLines: 12,
  maxDelta: 0.1,
} as const;
export type TidbitInput = {
  area: AreaId;
  /** Free to talk: idle, not speaking, not mid-transition. False restarts the ready wait. */
  ready: boolean;
  /** Hidden, offscreen or paused: freezes every clock. */
  paused?: boolean;
};
export type TidbitOptions = {
  /** Restore from session storage so a remount cannot bypass the cap. */
  spoken?: number;
  seed?: number;
};

/**
 * Idle asides from the current area's pool. Works through a pool before reusing a
 * line and never says the same line twice in a row. Speech timing stays with the
 * caller; this only decides when and what. No browser globals or timers.
 */
export class CharacterTidbitController {
  private elapsed = 0;
  private ready = 0;
  private nextAt = 0;
  private count: number;
  private seed: number;
  private previous: string | null = null;
  private readonly heard = new Set<string>();

  constructor(options: TidbitOptions = {}) {
    const spoken = options.spoken ?? 0;
    this.count = Number.isFinite(spoken) ? Math.max(0, Math.min(TIDBIT_CONFIG.maximumLines, Math.floor(spoken))) : 0;
    this.seed = (options.seed ?? 1) >>> 0;
    this.scheduleNext();
  }

  /** Lines started this session; persist it whenever tick returns a line. */
  get spoken(): number { return this.count; }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 2 ** 32;
  }

  private scheduleNext(): void {
    this.nextAt = this.elapsed + TIDBIT_CONFIG.minimumGap + (TIDBIT_CONFIG.maximumGap - TIDBIT_CONFIG.minimumGap) * this.random();
  }

  /** Returns the line to speak on the tick it starts, else null. */
  tick(activeDeltaSeconds: number, input: TidbitInput): CharacterLine | null {
    if (input.paused) return null;
    const dt = Number.isFinite(activeDeltaSeconds) && activeDeltaSeconds > 0
      ? Math.min(activeDeltaSeconds, TIDBIT_CONFIG.maxDelta) : 0;
    this.elapsed += dt;
    this.ready = input.ready ? this.ready + dt : 0;
    if (dt === 0 || this.count >= TIDBIT_CONFIG.maximumLines || this.elapsed + 1e-9 < this.nextAt
      || this.ready + 1e-9 < TIDBIT_CONFIG.readyTime) return null;
    const pool = TIDBIT_LINES[input.area];
    let options = pool.filter((line) => line.id !== this.previous && !this.heard.has(line.id));
    if (!options.length) {
      for (const line of pool) this.heard.delete(line.id);
      options = pool.filter((line) => line.id !== this.previous);
    }
    const line = options[Math.floor(this.random() * options.length)];
    this.heard.add(line.id);
    this.previous = line.id;
    this.count += 1;
    this.scheduleNext();
    return line;
  }
}
