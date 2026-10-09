import type { StationKind } from '@/components/character/world/types';
import type { Vec2 } from './controller';

export const ACTIVITY_CONFIG = {
  idle: 10,
  pickup: 1.1,
  toss: 1.15,
  catch: .7,
  return: 1.1,
  sit: 1.5,
  read: 7.5,
  stand: 1.5,
  /** Seconds at a station for kinds without a prop routine. */
  perform: { type: 9, watch: 5.5, tinker: 4.5, admire: 5, play: 5 },
  arrivalRadius: .13,
  arrivalSpeed: .1,
  /** Radians off the station heading at which he counts as facing it, so a routine never starts mid-turn. */
  arrivalFacing: .1,
  approachTimeout: 18,
  maxDelta: .1,
} as const;

/** Structurally a subset of the world `Station`, so area stations pass straight in. */
export type ActivityStation = { id: string; kind: StationKind; stand: Vec2; heading: number; seat?: number };
export type ActivityPhase = 'idle' | 'approach-ball' | 'pickup-ball' | 'toss-ball'
  | 'catch-ball' | 'return-ball' | 'approach-book' | 'pickup-book' | 'sit' | 'read'
  | 'stand' | 'return-book' | 'approach' | 'perform';
export type ActivityPropMode = 'home' | 'pickup' | 'held' | 'toss' | 'return';
export type ActivityPropFrame = { mode: ActivityPropMode; progress: number };
export type ActivityFrame = {
  phase: ActivityPhase;
  active: boolean;
  /** Active-scene seconds only; prop flight and release easing use this clock. */
  time: number;
  progress: number;
  /** The station stand point while approaching, else null. */
  target: Vec2 | null;
  animation: 'idle' | 'walk' | 'sit';
  /** Station heading once he stands at it: from reaching the stand point (he turns to it) and through the routine. Locomotion owns heading otherwise. */
  heading: number | null;
  /** Scrub 08_Sit_Relaxed to sitProgress * 1.5 seconds; do not loop that clip. */
  sitProgress: number;
  ball: ActivityPropFrame;
  book: ActivityPropFrame;
  /** Zero before first toss, one after first catch, two after second catch. */
  catches: number;
  /** Station being approached or performed at; null while idle. */
  stationId: string | null;
  kind: StationKind | null;
  /** Station id on the tick he arrives and its routine begins (pickup, sit or perform), one-shot. */
  started: string | null;
};
export type ActivityInput = {
  position: Vec2;
  speed?: number;
  /** True for the entire lifetime of a click/keyboard/wave command, not just its first frame. */
  commanded?: boolean;
  paused?: boolean;
  /** His heading. When given, he arrives only once he faces the station; until then the frame's heading turns him. */
  heading?: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const APPROACH: Partial<Record<StationKind, ActivityPhase>> = { ball: 'approach-ball', read: 'approach-book' };

/**
 * Pure deterministic station scheduler: without commands it cycles the current
 * stations with idle gaps, in a seeded order that never repeats a station back to
 * back. It never reads a cursor, advances while paused, moves the actor itself, or
 * steals a live user command. Call cancel() synchronously on input; tick with
 * commanded=true until arrival. Station clicks use request(), not commanded.
 */
export class CharacterActivityController {
  private stations: readonly ActivityStation[];
  private station: ActivityStation | null = null;
  private last: string | null = null;
  private seed = 1;
  private phase: ActivityPhase = 'idle';
  private phaseTime = 0;
  private elapsed = 0;
  private catches = 0;
  /** Approaching and already at the stand point, turning to face the station. */
  private near = false;

  constructor(stations: readonly ActivityStation[] = []) {
    this.stations = stations;
  }

  /** Area change: cancels the current activity and starts the cycle over. */
  setStations(stations: readonly ActivityStation[]): void {
    this.stations = stations;
    this.last = null;
    this.cancel();
  }

  /** Visitor clicked a station: approach and perform now, interrupting. False for unknown ids. */
  request(id: string): boolean {
    const station = this.stations.find((candidate) => candidate.id === id);
    if (!station) return false;
    if (this.station?.id !== id) this.begin(station);
    return true;
  }

  /** Drop all ownership immediately. Repeated clicks restart the quiet period. */
  cancel(): ActivityFrame {
    this.station = null;
    this.catches = 0;
    this.enter('idle');
    return this.frame(null);
  }

  reset(): ActivityFrame {
    this.elapsed = 0;
    this.last = null;
    this.seed = 1;
    return this.cancel();
  }

  private enter(phase: ActivityPhase): void {
    this.phase = phase;
    this.phaseTime = 0;
    this.near = false;
  }

  private begin(station: ActivityStation): void {
    this.station = station;
    this.catches = 0;
    this.enter(APPROACH[station.kind] ?? 'approach');
  }

  private finish(): void {
    this.last = this.station?.id ?? this.last;
    this.station = null;
    this.enter('idle');
  }

  /** First station in list order, then seeded picks that skip the previous one. */
  private pick(): ActivityStation | undefined {
    const others = this.stations.filter((station) => station.id !== this.last);
    const pool = others.length ? others : this.stations;
    if (this.last === null) return pool[0];
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    // High bits: an LCG's low bits cycle with a short period.
    return pool[Math.floor(this.seed / 2 ** 32 * pool.length)];
  }

  private duration(phase: ActivityPhase): number {
    switch (phase) {
      case 'approach': case 'approach-ball': case 'approach-book': return ACTIVITY_CONFIG.approachTimeout;
      case 'pickup-ball': case 'pickup-book': return ACTIVITY_CONFIG.pickup;
      case 'return-ball': case 'return-book': return ACTIVITY_CONFIG.return;
      case 'toss-ball': return ACTIVITY_CONFIG.toss;
      case 'catch-ball': return ACTIVITY_CONFIG.catch;
      // Ball and read stations run prop routines and never enter 'perform'.
      case 'perform': return ACTIVITY_CONFIG.perform[this.station!.kind as Exclude<StationKind, 'ball' | 'read'>];
      default: return ACTIVITY_CONFIG[phase];
    }
  }

  private arrive(): void {
    const station = this.station!;
    this.enter(station.kind === 'ball' ? 'pickup-ball' : station.kind === 'read' ? 'pickup-book'
      : station.seat !== undefined ? 'sit' : 'perform');
  }

  private advance(): void {
    const reading = this.station?.kind === 'read';
    switch (this.phase) {
      case 'idle': { const next = this.pick(); if (next) this.begin(next); else this.enter('idle'); break; }
      case 'pickup-ball': this.enter('toss-ball'); break;
      case 'toss-ball': this.catches += 1; this.enter('catch-ball'); break;
      case 'catch-ball': this.enter(this.catches < 2 ? 'toss-ball' : 'return-ball'); break;
      case 'pickup-book': this.enter('sit'); break;
      case 'sit': this.enter(reading ? 'read' : 'perform'); break;
      case 'read': this.enter('stand'); break;
      case 'perform': if (this.station?.seat !== undefined) this.enter('stand'); else this.finish(); break;
      case 'stand': if (reading) this.enter('return-book'); else this.finish(); break;
      // Return routines end, and unreachable stations are released rather than remaining stuck.
      default: this.finish();
    }
  }

  tick(deltaSeconds: number, input: ActivityInput): ActivityFrame {
    if (input.paused) return this.frame(null);
    const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(ACTIVITY_CONFIG.maxDelta, deltaSeconds)) : 0;
    this.elapsed += dt;
    if (input.commanded) return this.cancel();
    if (dt === 0) return this.frame(null);

    let started: string | null = null;
    let remaining = dt;
    // Carry fractional overshoot through transitions so cadence is FPS-independent.
    for (let transitions = 0; remaining > 1e-10 && transitions < 8; transitions += 1) {
      const station = this.station;
      this.near = !!station && this.phase.startsWith('approach')
        && Number.isFinite(input.position.x) && Number.isFinite(input.position.z)
        && Math.hypot(input.position.x - station.stand.x, input.position.z - station.stand.z) <= ACTIVITY_CONFIG.arrivalRadius
        && Math.abs(input.speed ?? 0) <= ACTIVITY_CONFIG.arrivalSpeed;
      const facing = input.heading === undefined || !station
        || Math.abs(Math.atan2(Math.sin(input.heading - station.heading), Math.cos(input.heading - station.heading))) <= ACTIVITY_CONFIG.arrivalFacing;
      if (this.near && facing) {
        this.arrive();
        started = station!.id;
      }
      const duration = this.duration(this.phase);
      const consumed = Math.min(remaining, Math.max(0, duration - this.phaseTime));
      this.phaseTime += consumed;
      remaining -= consumed;
      if (this.phaseTime + 1e-9 >= duration) this.advance();
    }
    return this.frame(started);
  }

  private frame(started: string | null): ActivityFrame {
    const { phase, station } = this;
    const progress = clamp01(this.phaseTime / this.duration(phase));
    const approaching = phase.startsWith('approach');
    const seated = phase === 'sit' || phase === 'read' || phase === 'stand' || (phase === 'perform' && station?.seat !== undefined);
    const ball: ActivityPropFrame = { mode: 'home', progress: 0 };
    const book: ActivityPropFrame = { mode: 'home', progress: 0 };
    if (phase === 'pickup-ball') { ball.mode = 'pickup'; ball.progress = progress; }
    if (phase === 'toss-ball') { ball.mode = 'toss'; ball.progress = progress; }
    if (phase === 'catch-ball') { ball.mode = 'held'; ball.progress = progress; }
    if (phase === 'return-ball') { ball.mode = 'return'; ball.progress = progress; }
    if (phase === 'pickup-book') { book.mode = 'pickup'; book.progress = progress; }
    if (seated && station?.kind === 'read') { book.mode = 'held'; book.progress = progress; }
    if (phase === 'return-book') { book.mode = 'return'; book.progress = progress; }
    return {
      phase, active: phase !== 'idle', time: this.elapsed, progress,
      target: approaching && station ? { ...station.stand } : null,
      animation: approaching ? 'walk' : seated ? 'sit' : 'idle',
      heading: phase === 'idle' || (approaching && !this.near) ? null : station?.heading ?? null,
      sitProgress: phase === 'sit' ? progress : phase === 'stand' ? 1 - progress : seated ? 1 : 0,
      ball, book, catches: this.catches,
      stationId: station?.id ?? null, kind: station?.kind ?? null, started,
    };
  }
}
