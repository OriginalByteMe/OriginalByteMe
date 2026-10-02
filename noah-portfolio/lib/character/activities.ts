import type { Vec2 } from './controller';

/** All stations fit the narrow/mobile stage and clear its sculpture colliders. */
export const ACTIVITY_STATIONS = {
  ball: { x: -1.6, z: .8 },
  book: { x: 1.65, z: -.4 },
} as const;

export const ACTIVITY_CONFIG = {
  idle: 10,
  pickup: 1.1,
  toss: 1.15,
  catch: .7,
  return: 1.1,
  sit: 1.5,
  read: 7.5,
  stand: 1.5,
  arrivalRadius: .13,
  arrivalSpeed: .1,
  approachTimeout: 18,
  maxDelta: .1,
} as const;

export type ActivityPhase = 'idle' | 'approach-ball' | 'pickup-ball' | 'toss-ball'
  | 'catch-ball' | 'return-ball' | 'approach-book' | 'pickup-book' | 'sit' | 'read'
  | 'stand' | 'return-book';
export type ActivityPropMode = 'home' | 'pickup' | 'held' | 'toss' | 'return';
export type ActivityPropFrame = { mode: ActivityPropMode; progress: number };
export type ActivityFrame = {
  phase: ActivityPhase;
  active: boolean;
  /** Active-scene seconds only; prop flight and release easing use this clock. */
  time: number;
  progress: number;
  target: Vec2 | null;
  animation: 'idle' | 'walk' | 'sit';
  /** Face the audience during activities. Locomotion owns heading while approaching. */
  heading: number | null;
  /** Scrub 08_Sit_Relaxed to sitProgress * 1.5 seconds; do not loop that clip. */
  sitProgress: number;
  ball: ActivityPropFrame;
  book: ActivityPropFrame;
  /** Zero before first toss, one after first catch, two after second catch. */
  catches: number;
};
export type ActivityInput = {
  position: Vec2;
  speed?: number;
  /** True for the entire lifetime of a click/keyboard/wave command, not just its first frame. */
  commanded?: boolean;
  paused?: boolean;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const duration = (phase: ActivityPhase): number => {
  if (phase === 'idle') return ACTIVITY_CONFIG.idle;
  if (phase.startsWith('approach-')) return ACTIVITY_CONFIG.approachTimeout;
  if (phase.startsWith('pickup-')) return ACTIVITY_CONFIG.pickup;
  if (phase.startsWith('return-')) return ACTIVITY_CONFIG.return;
  if (phase === 'toss-ball') return ACTIVITY_CONFIG.toss;
  if (phase === 'catch-ball') return ACTIVITY_CONFIG.catch;
  return ACTIVITY_CONFIG[phase as 'sit' | 'read' | 'stand'];
};

/**
 * Pure deterministic ball → reading → ball scheduler. It never reads a cursor,
 * advances while paused, moves the actor itself, or steals a live user command.
 * Call cancel() synchronously on input; tick with commanded=true until arrival.
 */
export class CharacterActivityController {
  private phase: ActivityPhase = 'idle';
  private phaseTime = 0;
  private elapsed = 0;
  private next: 'ball' | 'book' = 'ball';
  private catches = 0;

  /** Drop all ownership immediately. Repeated clicks restart the quiet period. */
  cancel(): ActivityFrame {
    this.phase = 'idle';
    this.phaseTime = 0;
    this.catches = 0;
    return this.frame();
  }

  reset(): ActivityFrame {
    this.elapsed = 0;
    this.next = 'ball';
    return this.cancel();
  }

  private enter(phase: ActivityPhase): void {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private advance(): void {
    switch (this.phase) {
      case 'idle': this.catches = 0; this.enter(this.next === 'ball' ? 'approach-ball' : 'approach-book'); break;
      case 'pickup-ball': this.enter('toss-ball'); break;
      case 'toss-ball': this.catches += 1; this.enter('catch-ball'); break;
      case 'catch-ball': this.enter(this.catches < 2 ? 'toss-ball' : 'return-ball'); break;
      case 'return-ball': this.next = 'book'; this.enter('idle'); break;
      case 'pickup-book': this.enter('sit'); break;
      case 'sit': this.enter('read'); break;
      case 'read': this.enter('stand'); break;
      case 'stand': this.enter('return-book'); break;
      case 'return-book': this.next = 'ball'; this.enter('idle'); break;
      // If navigation cannot arrive, release the target rather than remaining stuck.
      case 'approach-ball': this.next = 'book'; this.enter('idle'); break;
      case 'approach-book': this.next = 'ball'; this.enter('idle'); break;
    }
  }

  tick(deltaSeconds: number, input: ActivityInput): ActivityFrame {
    if (input.paused) return this.frame();
    const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(ACTIVITY_CONFIG.maxDelta, deltaSeconds)) : 0;
    this.elapsed += dt;
    if (input.commanded) return this.cancel();
    if (dt === 0) return this.frame();

    let remaining = dt;
    // Carry fractional overshoot through transitions so cadence is FPS-independent.
    for (let transitions = 0; remaining > 1e-10 && transitions < 8; transitions += 1) {
      if (this.phase === 'approach-ball' || this.phase === 'approach-book') {
        const station = ACTIVITY_STATIONS[this.phase === 'approach-ball' ? 'ball' : 'book'];
        if (Number.isFinite(input.position.x) && Number.isFinite(input.position.z)
          && Math.hypot(input.position.x - station.x, input.position.z - station.z) <= ACTIVITY_CONFIG.arrivalRadius
          && Math.abs(input.speed ?? 0) <= ACTIVITY_CONFIG.arrivalSpeed) {
          this.enter(this.phase === 'approach-ball' ? 'pickup-ball' : 'pickup-book');
        }
      }
      const consumed = Math.min(remaining, Math.max(0, duration(this.phase) - this.phaseTime));
      this.phaseTime += consumed;
      remaining -= consumed;
      if (this.phaseTime + 1e-9 >= duration(this.phase)) this.advance();
    }
    return this.frame();
  }

  private frame(): ActivityFrame {
    const phase = this.phase;
    const progress = clamp01(this.phaseTime / duration(phase));
    const approaching = phase === 'approach-ball' || phase === 'approach-book';
    const sitting = phase === 'sit' || phase === 'read' || phase === 'stand';
    const ball: ActivityPropFrame = { mode: 'home', progress: 0 };
    const book: ActivityPropFrame = { mode: 'home', progress: 0 };
    if (phase === 'pickup-ball') { ball.mode = 'pickup'; ball.progress = progress; }
    if (phase === 'toss-ball') { ball.mode = 'toss'; ball.progress = progress; }
    if (phase === 'catch-ball') { ball.mode = 'held'; ball.progress = progress; }
    if (phase === 'return-ball') { ball.mode = 'return'; ball.progress = progress; }
    if (phase === 'pickup-book') { book.mode = 'pickup'; book.progress = progress; }
    if (sitting) { book.mode = 'held'; book.progress = progress; }
    if (phase === 'return-book') { book.mode = 'return'; book.progress = progress; }
    return {
      phase, active: phase !== 'idle', time: this.elapsed, progress,
      target: approaching ? { ...ACTIVITY_STATIONS[phase === 'approach-ball' ? 'ball' : 'book'] } : null,
      animation: approaching ? 'walk' : sitting ? 'sit' : 'idle',
      heading: phase === 'idle' || approaching ? null : 0,
      sitProgress: phase === 'read' ? 1 : phase === 'sit' ? progress : phase === 'stand' ? 1 - progress : 0,
      ball, book, catches: this.catches,
    };
  }
}
