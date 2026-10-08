/**
 * Which area the character belongs to as the visitor scrolls, and the timed
 * transition that carries him there: down is chase, trip, fall, land, recover;
 * up is jump, land, recover. One area per transition. Active time only.
 */
export type TourPhase = 'settled' | 'chase' | 'trip' | 'fall' | 'land' | 'recover' | 'jump';
export type TourFrame = {
  /** Area the character belongs to; becomes `to` when 'fall' or 'jump' ends. */
  area: number;
  /** Equal when settled. */
  from: number; to: number;
  /** 0..1 within the phase; 0 while settled. */
  phase: TourPhase; progress: number;
  /** Phase entered on this tick, one-shot (speech and sfx hooks). */
  started: TourPhase | null;
};
export type TourInput = { viewArea: number };

export const TOUR_PHASE_DURATION = { chase: .9, trip: .45, fall: 1.3, land: .55, recover: 1.1, jump: 1.2 } as const;
/** Seconds a new viewArea must hold before a transition starts. */
export const TOUR_DEBOUNCE = .35;
export const TOUR_MAX_DELTA = .1;
const NEXT: Record<Exclude<TourPhase, 'settled'>, TourPhase> = {
  chase: 'trip', trip: 'fall', fall: 'land', jump: 'land', land: 'recover', recover: 'settled',
};

export class CharacterTourController {
  private readonly areas: number;
  private area: number;
  private from: number;
  private to: number;
  private phase: TourPhase = 'settled';
  private phaseTime = 0;
  private pending = 0;

  constructor(options: { areas: number; start?: number }) {
    this.areas = Math.max(1, Math.floor(options.areas));
    this.area = this.from = this.to = this.clampArea(options.start ?? 0);
  }

  private clampArea(area: number): number {
    return Math.max(0, Math.min(this.areas - 1, Math.round(area)));
  }

  /** Instant, for reduced paths, reset and initial load mid-page. */
  jumpTo(area: number): void {
    this.area = this.from = this.to = Number.isFinite(area) ? this.clampArea(area) : this.area;
    this.phase = 'settled';
    this.phaseTime = this.pending = 0;
  }

  tick(deltaSeconds: number, input: TourInput): TourFrame {
    const view = Number.isFinite(input.viewArea) ? this.clampArea(input.viewArea) : this.area;
    let remaining = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(TOUR_MAX_DELTA, deltaSeconds)) : 0;
    let started: TourPhase | null = null;
    // Carry overshoot through phase changes so timing does not depend on frame rate.
    for (let transitions = 0; remaining > 1e-10 && transitions < 8; transitions += 1) {
      if (this.phase === 'settled') {
        if (view === this.area) { this.pending = 0; break; }
        const wait = Math.min(remaining, TOUR_DEBOUNCE - this.pending);
        this.pending += wait; remaining -= wait;
        if (this.pending + 1e-9 < TOUR_DEBOUNCE) break;
        started = this.begin(view);
        continue;
      }
      const duration = TOUR_PHASE_DURATION[this.phase];
      const consumed = Math.min(remaining, duration - this.phaseTime);
      this.phaseTime += consumed; remaining -= consumed;
      if (this.phaseTime + 1e-9 < duration) break;
      if (this.phase === 'fall' || this.phase === 'jump') this.area = this.to;
      this.phase = NEXT[this.phase];
      this.phaseTime = 0;
      started = this.phase;
      if (this.phase === 'settled') {
        this.from = this.area;
        // The visitor already held the new view through the transition: follow without a second debounce.
        if (view !== this.area) started = this.begin(view);
      }
    }
    return this.frame(started);
  }

  private begin(view: number): TourPhase {
    this.from = this.area;
    this.to = this.area + Math.sign(view - this.area);
    this.phase = this.to > this.area ? 'chase' : 'jump';
    this.phaseTime = this.pending = 0;
    return this.phase;
  }

  private frame(started: TourPhase | null): TourFrame {
    const phase = this.phase;
    return {
      area: this.area, from: this.from, to: this.to,
      phase, progress: phase === 'settled' ? 0 : Math.min(1, this.phaseTime / TOUR_PHASE_DURATION[phase]),
      started,
    };
  }
}

/**
 * Continuous area position, 0..sections.length-1, from viewport-relative section
 * rects in page order. Boundary i is crossed as section i+1 rises from the viewport
 * bottom to its top.
 */
export function areaScrollPosition(sections: readonly { top: number; height: number }[], viewportHeight: number): number {
  if (!(viewportHeight > 0) || !Number.isFinite(viewportHeight)) return 0;
  let position = 0;
  for (const { top } of sections.slice(1)) {
    if (Number.isFinite(top)) position += Math.max(0, Math.min(1, (viewportHeight - top) / viewportHeight));
  }
  return position;
}
