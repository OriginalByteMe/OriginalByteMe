/**
 * Which lot the character belongs to as the visitor scrolls along the street, and
 * the timed walk that carries him there. One trip may pass several lots; a new view
 * that holds through the debounce mid-walk turns the trip toward it from wherever he
 * has got to. Active time only.
 */
export type TourPhase = 'settled' | 'travel';
export type TourFrame = {
  /** Lot the character belongs to; becomes `to` when the walk ends. */
  area: number;
  /** Street position, in lots, where this leg started (fractional after a turn mid-walk), and the lot it heads to. Equal when settled. */
  from: number; to: number;
  /** 0..1 of the leg; 0 while settled. */
  phase: TourPhase; progress: number;
  /** Phase entered on this tick, one-shot (speech and path hooks); 'travel' again when a leg turns. */
  started: TourPhase | null;
};
export type TourInput = { viewArea: number };

/** Seconds per leg: the walk out to the street and in to the next lot, plus the street itself, capped so a long trip stays short. */
export const TOUR_TRAVEL = { base: 1, perLot: 1.5, max: 5 } as const;
/** Seconds a new viewArea must hold before a leg starts or turns. */
export const TOUR_DEBOUNCE = .35;
export const TOUR_MAX_DELTA = .1;

export class CharacterTourController {
  private readonly areas: number;
  private area: number;
  private from: number;
  private to: number;
  private phase: TourPhase = 'settled';
  private time = 0;
  private duration = 0;
  private pending = 0;

  constructor(options: { areas: number; start?: number }) {
    this.areas = Math.max(1, Math.floor(options.areas));
    this.area = this.from = this.to = this.clampArea(options.start ?? 0);
  }

  private clampArea(area: number): number {
    return Math.max(0, Math.min(this.areas - 1, Math.round(area)));
  }

  /** Instant, for reset and initial load mid-page. */
  jumpTo(area: number): void {
    this.area = this.from = this.to = Number.isFinite(area) ? this.clampArea(area) : this.area;
    this.phase = 'settled';
    this.time = this.pending = 0;
  }

  tick(deltaSeconds: number, input: TourInput): TourFrame {
    // Settled, `to` equals `area`: either way it is where he is headed.
    const view = Number.isFinite(input.viewArea) ? this.clampArea(input.viewArea) : this.to;
    let remaining = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(TOUR_MAX_DELTA, deltaSeconds)) : 0;
    let started: TourPhase | null = null;
    // Carry overshoot through arrivals and turns so timing does not depend on frame rate.
    for (let steps = 0; steps < 8; steps += 1) {
      const waiting = view !== this.to;
      if (!waiting) this.pending = 0;
      if (waiting && this.pending + 1e-9 >= TOUR_DEBOUNCE) { started = this.begin(view); continue; }
      if (remaining <= 1e-10 || (!waiting && this.phase === 'settled')) break;
      const step = Math.min(remaining, waiting ? TOUR_DEBOUNCE - this.pending : Infinity, this.phase === 'travel' ? this.duration - this.time : Infinity);
      remaining -= step;
      if (waiting) this.pending += step;
      if (this.phase === 'travel') {
        this.time += step;
        if (this.time + 1e-9 >= this.duration) { this.area = this.from = this.to; this.phase = 'settled'; this.time = 0; started = 'settled'; }
      }
    }
    return {
      area: this.area, from: this.from, to: this.to,
      phase: this.phase, progress: this.phase === 'settled' ? 0 : Math.min(1, this.time / this.duration),
      started,
    };
  }

  /** A new leg from his current street position; the walk itself goes no faster than the cap allows. */
  private begin(view: number): TourPhase {
    this.from = this.phase === 'settled' ? this.area : this.from + (this.to - this.from) * Math.min(1, this.time / this.duration);
    this.to = view;
    this.phase = 'travel';
    this.time = this.pending = 0;
    this.duration = Math.min(TOUR_TRAVEL.max, TOUR_TRAVEL.base + TOUR_TRAVEL.perLot * Math.abs(view - this.from));
    return this.phase;
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
