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
describe('scroll tour between areas', () => {
  it('goes down one area as chase, trip, fall, land, recover and joins the lower area when the fall ends', () => {
    const frames = run(new CharacterTourController({ areas: 3 }), 6, 1);
    expect(starts(frames)).toEqual([['chase', .35], ['trip', 1.25], ['fall', 1.7], ['land', 3], ['recover', 3.55], ['settled', 4.65]]);
    const at = (time: number) => frames.find((frame) => Math.abs(frame.time - time) < 1e-6)!;
    expect(at(2.95)).toMatchObject({ phase: 'fall', area: 0, from: 0, to: 1 });
    expect(at(3)).toMatchObject({ phase: 'land', area: 1, from: 0, to: 1 });
    expect(at(.3)).toMatchObject({ phase: 'settled', area: 0, from: 0, to: 0 });
    expect(at(6)).toMatchObject({ phase: 'settled', area: 1, from: 1, to: 1, started: null });
    expect(at(2.35).progress).toBeCloseTo(.5);
  });

  it('goes up one area as jump, land, recover and joins the upper area when the jump ends', () => {
    const frames = run(new CharacterTourController({ areas: 3, start: 1 }), 4, 0);
    expect(starts(frames)).toEqual([['jump', .35], ['land', 1.55], ['recover', 2.1], ['settled', 3.2]]);
    expect(frames.find((frame) => frame.phase === 'jump')).toMatchObject({ area: 1, from: 1, to: 0 });
    expect(frames.find((frame) => frame.phase === 'land')?.area).toBe(0);
  });

  it('waits for the view to hold through the debounce and cancels on flicker back', () => {
    const tour = new CharacterTourController({ areas: 3 });
    const flicker = [...run(tour, .3, 1), ...run(tour, .05, 0), ...run(tour, .3, 1)];
    expect(flicker.every((frame) => frame.phase === 'settled' && frame.started === null)).toBe(true);
    expect(tour.tick(STEP, { viewArea: 1 }).started).toBe('chase');
  });

  it('moves one area per transition when the visitor is two areas away', () => {
    const frames = run(new CharacterTourController({ areas: 3 }), 11, 2);
    expect(starts(frames).map(([phase]) => phase)).toEqual([
      'chase', 'trip', 'fall', 'land', 'recover', 'chase', 'trip', 'fall', 'land', 'recover', 'settled',
    ]);
    expect(starts(frames)[5]).toEqual(['chase', 4.65]);
    expect(frames.every((frame) => Math.abs(frame.to - frame.from) <= 1)).toBe(true);
    expect(frames.at(-1)).toMatchObject({ phase: 'settled', area: 2 });
  });

  it('finishes the current step when the visitor scrolls back mid-transition, then heads back', () => {
    const frames = run(new CharacterTourController({ areas: 3 }), 9, (time) => time <= 1 ? 1 : 0);
    expect(starts(frames).map(([phase]) => phase)).toEqual([
      'chase', 'trip', 'fall', 'land', 'recover', 'jump', 'land', 'recover', 'settled',
    ]);
    expect(frames.find((frame) => frame.phase === 'jump')).toMatchObject({ area: 1, from: 1, to: 0 });
    expect(frames.at(-1)).toMatchObject({ phase: 'settled', area: 0 });
  });

  it('jumpTo settles instantly, clamps the area and drops a pending or running transition', () => {
    const tour = new CharacterTourController({ areas: 3 });
    run(tour, 1, 1);
    tour.jumpTo(2);
    expect(tour.tick(STEP, { viewArea: 2 })).toEqual({ area: 2, from: 2, to: 2, phase: 'settled', progress: 0, started: null });
    tour.jumpTo(9);
    expect(tour.tick(STEP, { viewArea: 2 }).area).toBe(2);
    tour.jumpTo(-3);
    expect(run(tour, 2, NaN).every((frame) => frame.phase === 'settled' && frame.area === 0)).toBe(true);
    expect(run(tour, .35, 7).at(-1)).toMatchObject({ started: 'chase', to: 1 });
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
