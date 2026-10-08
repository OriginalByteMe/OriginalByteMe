import { describe, expect, it } from 'vitest';
import { areaScrollPosition, CharacterTourController, type TourFrame } from '../tour';

const STEP = .05;
type View = number | ((time: number) => number);
type TimedFrame = TourFrame & { time: number };
function run(tour: CharacterTourController, seconds: number, view: View, from = 0) {
  const frames: TimedFrame[] = [];
  for (let index = 1; index <= Math.round(seconds / STEP); index += 1) {
    const time = from + index * STEP;
    frames.push({ ...tour.tick(STEP, { viewArea: typeof view === 'number' ? view : view(time) }), time });
  }
  return frames;
}
const starts = (frames: TimedFrame[]) => frames.flatMap((frame) => frame.started ? [[frame.started, +frame.time.toFixed(2)]] : []);
const at = (frames: TimedFrame[], time: number) => frames.find((frame) => Math.abs(frame.time - time) < 1e-6)!;

describe('walking along the street between lots', () => {
  it('walks to the next lot in one timed trip and joins it on arrival', () => {
    const frames = run(new CharacterTourController({ areas: 7 }), 4, 1);
    // One lot: a 1 s walk out and in plus 1.5 s along the street, after the .35 s debounce.
    expect(starts(frames)).toEqual([['travel', .35], ['settled', 2.85]]);
    expect(at(frames, .3)).toMatchObject({ phase: 'settled', area: 0, from: 0, to: 0 });
    expect(at(frames, 1)).toMatchObject({ phase: 'travel', area: 0, from: 0, to: 1 });
    expect(at(frames, 1.6).progress).toBeCloseTo(.5);
    expect(at(frames, 2.85)).toMatchObject({ phase: 'settled', area: 1, from: 1, to: 1 });
    expect(frames.at(-1)).toMatchObject({ area: 1, from: 1, to: 1, phase: 'settled', progress: 0, started: null });
  });

  it('walks back to the previous lot the same way', () => {
    const frames = run(new CharacterTourController({ areas: 7, start: 3 }), 4, 2);
    expect(starts(frames)).toEqual([['travel', .35], ['settled', 2.85]]);
    expect(at(frames, 1)).toMatchObject({ phase: 'travel', area: 3, from: 3, to: 2 });
    expect(frames.at(-1)).toMatchObject({ phase: 'settled', area: 2 });
  });

  it('passes several lots in one trip, capped at five seconds, without stopping on the way', () => {
    const frames = run(new CharacterTourController({ areas: 7 }), 6, 6);
    expect(starts(frames)).toEqual([['travel', .35], ['settled', 5.35]]);
    const travel = frames.filter((frame) => frame.phase === 'travel');
    expect(travel.every((frame) => frame.area === 0 && frame.from === 0 && frame.to === 6)).toBe(true);
    expect(frames.at(-1)).toMatchObject({ phase: 'settled', area: 6 });
  });

  it('extends the trip when a fast scroll carries on past the lot he was heading to', () => {
    const frames = run(new CharacterTourController({ areas: 7 }), 7, (time) => time <= .5 ? 1 : 4);
    // The new view holds through the debounce from .55 s; he is a fifth of the way to lot 1 by then.
    expect(starts(frames)).toEqual([['travel', .35], ['travel', .85], ['settled', 5.85]]);
    expect(at(frames, .9).from).toBeCloseTo(.2);
    expect(at(frames, .9)).toMatchObject({ phase: 'travel', area: 0, to: 4 });
    expect(frames.some((frame) => frame.area === 1)).toBe(false);
    expect(frames.at(-1)).toMatchObject({ phase: 'settled', area: 4 });
  });

  it('turns back mid-walk when the visitor scrolls back, from wherever he has got to', () => {
    const frames = run(new CharacterTourController({ areas: 7 }), 6, (time) => time <= 1.5 ? 2 : 0);
    expect(starts(frames).map(([phase]) => phase)).toEqual(['travel', 'travel', 'settled']);
    const back = frames.find((frame) => frame.started === 'travel' && frame.to === 0)!;
    expect(back.from).toBeGreaterThan(0); expect(back.from).toBeLessThan(2);
    expect(frames.at(-1)).toMatchObject({ phase: 'settled', area: 0 });
  });

  it('waits for the view to hold through the debounce and ignores a flicker', () => {
    const tour = new CharacterTourController({ areas: 7 });
    const flicker = [...run(tour, .3, 1), ...run(tour, .05, 0), ...run(tour, .3, 1)];
    expect(flicker.every((frame) => frame.phase === 'settled' && frame.started === null)).toBe(true);
    expect(tour.tick(STEP, { viewArea: 1 }).started).toBe('travel');
    const travelling = new CharacterTourController({ areas: 7 });
    run(travelling, .5, 3);
    const steady = run(travelling, .3, 5).concat(run(travelling, .05, 3));
    expect(steady.every((frame) => frame.started === null && frame.to === 3)).toBe(true);
  });

  it('starts settled at a deep-linked lot, and jumpTo settles instantly, clamps and drops a trip', () => {
    expect(new CharacterTourController({ areas: 7, start: 4 }).tick(STEP, { viewArea: 4 }))
      .toEqual({ area: 4, from: 4, to: 4, phase: 'settled', progress: 0, started: null });
    const tour = new CharacterTourController({ areas: 7 });
    run(tour, 1, 3);
    tour.jumpTo(2);
    expect(tour.tick(STEP, { viewArea: 2 })).toEqual({ area: 2, from: 2, to: 2, phase: 'settled', progress: 0, started: null });
    tour.jumpTo(9);
    expect(tour.tick(STEP, { viewArea: 6 }).area).toBe(6);
    tour.jumpTo(-3);
    expect(run(tour, 2, NaN).every((frame) => frame.phase === 'settled' && frame.area === 0)).toBe(true);
    expect(run(tour, .35, 9).at(-1)).toMatchObject({ started: 'travel', to: 6 });
  });
});

describe('areaScrollPosition', () => {
  const page = (scroll: number) => [
    { top: -scroll, height: 800 }, { top: 800 - scroll, height: 900 }, { top: 1700 - scroll, height: 900 },
  ];
  it.each([
    [0, 0], [400, .5], [800, 1], [1300, 1.5], [1700, 2], [5000, 2], [-300, 0],
  ])('maps scrollY %s to area position %s', (scroll, position) => {
    expect(areaScrollPosition(page(scroll), 800)).toBeCloseTo(position);
  });

  it('handles zero-height sections, empty input, bad viewports and non-finite rects without NaN', () => {
    expect(areaScrollPosition([{ top: -400, height: 800 }, { top: 400, height: 0 }, { top: 400, height: 900 }], 800)).toBe(1);
    expect(areaScrollPosition([], 800)).toBe(0);
    expect(areaScrollPosition([{ top: -500, height: 800 }], 800)).toBe(0);
    expect(areaScrollPosition(page(400), 0)).toBe(0);
    expect(areaScrollPosition(page(400), -10)).toBe(0);
    expect(areaScrollPosition(page(400), NaN)).toBe(0);
    expect(areaScrollPosition([{ top: 0, height: 800 }, { top: NaN, height: 800 }], 800)).toBe(0);
  });
});
