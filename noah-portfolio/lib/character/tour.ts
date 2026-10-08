/**
 * Which lot the character belongs to as the visitor scrolls along the street, and when
 * his walk there starts, turns and ends. One trip may pass several lots; a new view that
 * holds through the debounce starts a trip, or turns the current one toward it from
 * wherever he has got to. The scene walks him along the street at its own pace and
 * reports `arrived` when he reaches the trip's lot. Active time only.
 */
export type TourPhase = 'settled' | 'travel';
export type TourFrame = {
  /** Lot the character belongs to; becomes `to` when the walk ends. */
  area: number;
  /** Street position, in lots, where this leg started (fractional after a turn mid-walk), and the lot it heads to. Equal when settled. */
  from: number; to: number;
  phase: TourPhase;
  /** Phase entered on this tick, one-shot (speech and path hooks); 'travel' again when a leg turns. */
  started: TourPhase | null;
};
export type TourInput = {
  viewArea: number;
  /** His street position in lots (0 at the first lot); a leg that turns mid-walk starts from here. */
  at?: number;
  /** The scene has walked him to `to`: the trip ends on this tick. */
  arrived?: boolean;
};

/** Seconds a new viewArea must hold before a leg starts or turns. */
export const TOUR_DEBOUNCE = .35;
export const TOUR_MAX_DELTA = .1;

export class CharacterTourController {
  private readonly areas: number;
  private area: number;
  private from: number;
  private to: number;
  private phase: TourPhase = 'settled';
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
    this.pending = 0;
  }

  tick(deltaSeconds: number, input: TourInput): TourFrame {
    let started: TourPhase | null = null;
    if (this.phase === 'travel' && input.arrived) {
      this.area = this.from = this.to;
      this.phase = 'settled';
      started = 'settled';
    }
    // Settled, `to` equals `area`: either way it is where he is headed.
    const view = Number.isFinite(input.viewArea) ? this.clampArea(input.viewArea) : this.to;
    if (view === this.to) this.pending = 0;
    else {
      this.pending += Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(TOUR_MAX_DELTA, deltaSeconds)) : 0;
      if (this.pending + 1e-9 >= TOUR_DEBOUNCE) started = this.begin(view, input.at);
    }
    return { area: this.area, from: this.from, to: this.to, phase: this.phase, started };
  }

  /** A new leg toward `view`, from his lot when settled or from his street position mid-walk. */
  private begin(view: number, at: number | undefined): TourPhase {
    if (this.phase === 'travel' && at !== undefined && Number.isFinite(at)) this.from = Math.max(0, Math.min(this.areas - 1, at));
    else if (this.phase === 'settled') this.from = this.area;
    this.to = view;
    this.phase = 'travel';
    this.pending = 0;
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
