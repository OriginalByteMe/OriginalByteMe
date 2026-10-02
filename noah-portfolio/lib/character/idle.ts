/** Pure active-scene clock. Do not tick while paused, hidden, or offscreen. */
export type GreetingId = "intro" | "hello";
export type CharacterGreeting = Readonly<{ id: GreetingId; line: string; duration: number }>;
export type GreetingBeat = Readonly<{ at: number; duration: number; pitch: number }>;

export const CHARACTER_GREETINGS: readonly CharacterGreeting[] = [
  { id: "intro", line: "Hey, my name is Noah. Ask me a question down here.", duration: 5.2 },
  { id: "hello", line: "Hi, you see me? Do you see me? Oh, hello.", duration: 4.8 },
];

/** Original nonverbal syllable rhythms shared by the face and synthesized voice. */
export const GREETING_BEATS: Readonly<Record<GreetingId, readonly GreetingBeat[]>> = {
  intro: [
    { at: 0.12, duration: 0.22, pitch: 440 },
    { at: 0.52, duration: 0.13, pitch: 392 },
    { at: 0.76, duration: 0.2, pitch: 494 },
    { at: 1.08, duration: 0.12, pitch: 440 },
    { at: 1.32, duration: 0.22, pitch: 523 },
    { at: 1.61, duration: 0.25, pitch: 466 },
    { at: 2.26, duration: 0.19, pitch: 494 },
    { at: 2.57, duration: 0.15, pitch: 440 },
    { at: 2.84, duration: 0.13, pitch: 392 },
    { at: 3.12, duration: 0.19, pitch: 523 },
    { at: 3.39, duration: 0.15, pitch: 494 },
    { at: 3.88, duration: 0.22, pitch: 440 },
    { at: 4.26, duration: 0.29, pitch: 392 },
  ],
  hello: [
    { at: 0.12, duration: 0.24, pitch: 523 },
    { at: 0.68, duration: 0.13, pitch: 440 },
    { at: 0.94, duration: 0.18, pitch: 494 },
    { at: 1.26, duration: 0.25, pitch: 587 },
    { at: 1.92, duration: 0.12, pitch: 440 },
    { at: 2.16, duration: 0.13, pitch: 494 },
    { at: 2.4, duration: 0.19, pitch: 523 },
    { at: 2.71, duration: 0.25, pitch: 587 },
    { at: 3.41, duration: 0.24, pitch: 466 },
    { at: 3.94, duration: 0.16, pitch: 523 },
    { at: 4.22, duration: 0.29, pitch: 440 },
  ],
};

export const IDLE_CONFIG = {
  maximumGreetings: 2,
  firstGreetingMin: 6,
  firstGreetingMax: 9,
  minimumQuietGap: 35,
  requiredStationaryTime: 3,
  blinkMinInterval: 3,
  blinkMaxInterval: 6,
  blinkMinDuration: 0.15,
  blinkMaxDuration: 0.22,
  maxDelta: 0.1,
} as const;

export type IdleFrame = {
  greeting: CharacterGreeting | null;
  /** Edge event: present only on the frame a greeting starts. Persist greetingsShown then. */
  greetingStarted: CharacterGreeting | null;
  /** Includes natural completion and cancellation by movement. */
  greetingEnded: boolean;
  greetingsShown: number;
  talking: boolean;
  /** Mouth blend strength: 0–0.15 when idle, 0–0.8 during a greeting. */
  mouthOpen: number;
  /** Eyelid closure: zero is open, one is closed. */
  blink: number;
  /** Subtle vertical offset in metres, bounded by ±0.015. */
  bob: number;
};

export type IdleOptions = {
  /** Caller owns session storage; cancelled greetings still count toward the cap. */
  greetingsShown?: number;
  seed?: number;
  random?: () => number;
};

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function pulse(progress: number): number {
  return progress > 0 && progress < 1 ? Math.sin(progress * Math.PI) ** 2 : 0;
}

export class CharacterIdleController {
  private readonly random: () => number;
  private elapsed = 0;
  private stationaryTime = 0;
  private greetingCount: number;
  private nextGreetingAt: number;
  private currentGreeting: CharacterGreeting | null = null;
  private greetingStartedAt = 0;
  private blinkStartedAt = 0;
  private blinkDuration = 0;
  private nextBlinkAt: number;
  private mouthStartedAt = 0;
  private mouthDuration = 0;
  private nextMouthAt: number;
  private cancellationPending = false;
  private manualGreetingPending: CharacterGreeting | null = null;

  constructor(options: IdleOptions = {}) {
    this.random = options.random ?? seededRandom(options.seed ?? 0x4e6f6168);
    const count = options.greetingsShown ?? 0;
    this.greetingCount = Number.isFinite(count)
      ? Math.max(0, Math.min(IDLE_CONFIG.maximumGreetings, Math.floor(count)))
      : 0;
    this.nextGreetingAt = this.greetingCount === 0
      ? this.between(IDLE_CONFIG.firstGreetingMin, IDLE_CONFIG.firstGreetingMax)
      : this.between(IDLE_CONFIG.minimumQuietGap, IDLE_CONFIG.minimumQuietGap + 10);
    this.nextBlinkAt = this.between(IDLE_CONFIG.blinkMinInterval, IDLE_CONFIG.blinkMaxInterval);
    this.nextMouthAt = this.between(2.5, 5.5);
  }

  private between(min: number, max: number): number {
    const sample = this.random();
    const unit = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
    return min + unit * (max - min);
  }

  /** Explicit Say hi action, independent of the two automatic greetings per session. */
  greetNow(id: GreetingId = "hello"): CharacterGreeting {
    const greeting = CHARACTER_GREETINGS.find((candidate) => candidate.id === id)!;
    this.currentGreeting = greeting;
    this.manualGreetingPending = greeting;
    this.greetingStartedAt = this.elapsed;
    this.cancellationPending = false;
    this.mouthDuration = 0;
    this.nextGreetingAt = Math.max(this.nextGreetingAt,
      this.elapsed + greeting.duration + IDLE_CONFIG.minimumQuietGap);
    return greeting;
  }

  /** Also call on pause/offscreen so a partially spoken line is never resumed later. */
  cancelGreeting(): void {
    this.cancellationPending ||= this.currentGreeting !== null;
    this.currentGreeting = null;
    this.manualGreetingPending = null;
    this.stationaryTime = 0;
    this.mouthDuration = 0;
  }

  tick(activeDeltaSeconds: number, stationary: boolean): IdleFrame {
    const dt = Number.isFinite(activeDeltaSeconds) && activeDeltaSeconds > 0
      ? Math.min(activeDeltaSeconds, IDLE_CONFIG.maxDelta) : 0;
    let greetingStarted: CharacterGreeting | null = this.manualGreetingPending;
    this.manualGreetingPending = null;
    let greetingEnded = this.cancellationPending;
    this.cancellationPending = false;
    this.elapsed += dt;

    if (!stationary) {
      greetingStarted = null;
      greetingEnded ||= this.currentGreeting !== null;
      this.currentGreeting = null;
      this.stationaryTime = 0;
      this.mouthDuration = 0;
    } else {
      this.stationaryTime += dt;
      if (this.currentGreeting && this.elapsed - this.greetingStartedAt >= this.currentGreeting.duration) {
        this.currentGreeting = null;
        greetingEnded = true;
      }
      if (dt > 0 && !this.currentGreeting && this.greetingCount < IDLE_CONFIG.maximumGreetings
        && this.stationaryTime >= IDLE_CONFIG.requiredStationaryTime
        && this.elapsed >= this.nextGreetingAt) {
        this.currentGreeting = CHARACTER_GREETINGS[this.greetingCount];
        greetingStarted = this.currentGreeting;
        this.greetingStartedAt = this.elapsed;
        this.greetingCount += 1;
        // Measured from the end, giving at least 35 active seconds of quiet.
        this.nextGreetingAt = this.elapsed + this.currentGreeting.duration
          + this.between(IDLE_CONFIG.minimumQuietGap, IDLE_CONFIG.minimumQuietGap + 10);
        this.mouthDuration = 0;
      }
    }

    if (dt > 0 && this.elapsed >= this.nextBlinkAt) {
      this.blinkStartedAt = this.elapsed;
      this.blinkDuration = this.between(IDLE_CONFIG.blinkMinDuration, IDLE_CONFIG.blinkMaxDuration);
      this.nextBlinkAt = this.elapsed + this.between(IDLE_CONFIG.blinkMinInterval, IDLE_CONFIG.blinkMaxInterval);
    }
    if (dt > 0 && stationary && !this.currentGreeting && this.elapsed >= this.nextMouthAt) {
      this.mouthStartedAt = this.elapsed;
      this.mouthDuration = this.between(0.5, 0.9);
      this.nextMouthAt = this.elapsed + this.between(5, 9);
    }

    const greetingAge = this.elapsed - this.greetingStartedAt;
    const mouthOpen = this.currentGreeting
      ? Math.max(0, ...GREETING_BEATS[this.currentGreeting.id].map((beat) =>
        0.8 * pulse((greetingAge - beat.at) / beat.duration)))
      : stationary && this.mouthDuration > 0
        ? 0.12 * pulse((this.elapsed - this.mouthStartedAt) / this.mouthDuration) : 0;
    return {
      greeting: this.currentGreeting,
      greetingStarted,
      greetingEnded,
      greetingsShown: this.greetingCount,
      talking: this.currentGreeting !== null,
      mouthOpen,
      blink: this.blinkDuration > 0 ? pulse((this.elapsed - this.blinkStartedAt) / this.blinkDuration) : 0,
      bob: stationary ? 0.01 * Math.sin(this.elapsed * 1.9) + 0.005 * Math.sin(this.elapsed * 0.83) : 0,
    };
  }
}
