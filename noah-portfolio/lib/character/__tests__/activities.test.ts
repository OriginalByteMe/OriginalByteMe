import { describe, expect, it } from 'vitest';
import { ACTIVITY_CONFIG, CharacterActivityController, type ActivityFrame, type ActivityPhase, type ActivityStation } from '../activities';
import { CHARACTER_CONFIG, createCharacterState, stepCharacter, type Vec2 } from '../controller';

const BALL: ActivityStation = { id: 'ball', kind: 'ball', stand: { x: -1.6, z: .8 }, heading: 0 };
const BED: ActivityStation = { id: 'bed', kind: 'read', stand: { x: 1.65, z: -.4 }, heading: .3, seat: .66 };
const DESK: ActivityStation = { id: 'desk', kind: 'type', stand: { x: .4, z: -1.2 }, heading: Math.PI, seat: .62 };
const PRINTER: ActivityStation = { id: 'printer', kind: 'watch', stand: { x: -1, z: -1.4 }, heading: 2.8 };
const RACK: ActivityStation = { id: 'rack', kind: 'tinker', stand: { x: 2, z: 1 }, heading: 1.2 };
const BEDROOM = [DESK, PRINTER, RACK, BALL, BED];

/** Teleports onto every target, so arrival happens on the tick after the approach starts. */
function run(seconds = 65, fps = 60, controller = new CharacterActivityController([BALL, BED])) {
  const frames: ActivityFrame[] = [];
  let position: Vec2 = { x: 0, z: 0 };
  for (let index = 0; index < seconds * fps; index += 1) {
    const frame = controller.tick(1 / fps, { position });
    if (frame.target) position = frame.target;
    frames.push(frame);
  }
  return { controller, frames, position };
}
const phaseSequence = (frames: ActivityFrame[]) => frames.filter((frame, index) => !index || frames[index - 1].phase !== frame.phase).map((frame) => frame.phase);
const performed = (frames: ActivityFrame[]) => frames.flatMap((frame) => frame.started ? [frame.started] : []);

describe('autonomous character activities', () => {
  it('waits ten active seconds, approaches, throws/catches twice, then reads and alternates', () => {
    const { frames } = run();
    expect(frames.slice(0, 599).every((frame) => !frame.active && frame.target === null && frame.stationId === null)).toBe(true);
    expect(phaseSequence(frames).slice(0, 18)).toEqual([
      'idle', 'approach-ball', 'pickup-ball', 'toss-ball', 'catch-ball', 'toss-ball', 'catch-ball', 'return-ball', 'idle',
      'approach-book', 'pickup-book', 'sit', 'read', 'stand', 'return-book', 'idle', 'approach-ball', 'pickup-ball',
    ]);
    expect(frames.find((frame) => frame.phase === 'approach-ball')).toMatchObject({ target: BALL.stand, stationId: 'ball', kind: 'ball', heading: null, animation: 'walk' });
    expect(frames.find((frame) => frame.phase === 'return-ball')?.catches).toBe(2);
    expect(frames.filter((frame) => frame.phase === 'toss-ball').every((frame) => frame.ball.mode === 'toss' && frame.book.mode === 'home' && frame.heading === 0)).toBe(true);
    expect(frames.filter((frame) => frame.phase === 'read').every((frame) => frame.sitProgress === 1 && frame.book.mode === 'held'
      && frame.animation === 'sit' && frame.stationId === 'bed' && frame.kind === 'read' && frame.heading === .3)).toBe(true);
  });

  it('reports each station once, on the tick its routine begins after arrival', () => {
    const { frames } = run();
    const starts = frames.flatMap((frame, index) => frame.started ? [[frame.started, frames[index - 1].phase, frame.phase]] : []);
    expect(starts.slice(0, 3)).toEqual([['ball', 'approach-ball', 'pickup-ball'], ['bed', 'approach-book', 'pickup-book'], ['ball', 'approach-ball', 'pickup-ball']]);
  });

  it('starts a routine only once he faces the station, handing him its heading to turn to at the stand point', () => {
    const controller = new CharacterActivityController([PRINTER]);
    controller.request('printer');
    expect(controller.tick(1 / 60, { position: { x: 0, z: 0 }, heading: 0 })).toMatchObject({ phase: 'approach', heading: null });
    // At the stand point but still facing away: he keeps approaching and is told which way to turn.
    expect(controller.tick(1 / 60, { position: PRINTER.stand, heading: 0 })).toMatchObject({ phase: 'approach', heading: 2.8, started: null });
    expect(controller.tick(1 / 60, { position: PRINTER.stand, heading: 2.8 + ACTIVITY_CONFIG.arrivalFacing * 2 }).started).toBeNull();
    expect(controller.tick(1 / 60, { position: PRINTER.stand, heading: 2.8 - ACTIVITY_CONFIG.arrivalFacing / 2 })).toMatchObject({ phase: 'perform', started: 'printer' });
    // Across the ±π seam counts as facing too.
    const desk = new CharacterActivityController([DESK]);
    desk.request('desk');
    expect(desk.tick(1 / 60, { position: DESK.stand, heading: -Math.PI + .02 }).started).toBe('desk');
  });

  it('runs other kinds as approach, perform for a kind duration, done; seated ones sit and scrub like reading', () => {
    const { frames } = run(40, 20, new CharacterActivityController([DESK, PRINTER]));
    expect(phaseSequence(frames).slice(0, 9)).toEqual(['idle', 'approach', 'sit', 'perform', 'stand', 'idle', 'approach', 'perform', 'idle']);
    const typing = frames.filter((frame) => frame.stationId === 'desk' && frame.phase === 'perform');
    expect(typing.length / 20).toBeCloseTo(ACTIVITY_CONFIG.perform.type, 0);
    expect(typing.every((frame) => frame.animation === 'sit' && frame.sitProgress === 1 && frame.heading === Math.PI && frame.kind === 'type')).toBe(true);
    expect(frames.find((frame) => frame.phase === 'stand' && frame.progress >= .5)?.sitProgress).toBeCloseTo(.5, 1);
    const watching = frames.filter((frame) => frame.stationId === 'printer' && frame.phase === 'perform');
    expect(watching.length / 20).toBeCloseTo(ACTIVITY_CONFIG.perform.watch, 0);
    expect(watching.every((frame) => frame.animation === 'idle' && frame.sitProgress === 0 && frame.heading === 2.8
      && frame.ball.mode === 'home' && frame.book.mode === 'home')).toBe(true);
    expect(performed(frames).slice(0, 2)).toEqual(['desk', 'printer']);
  });

  it('cycles in a deterministic, varied order and never repeats a station back to back', () => {
    const first = performed(run(900, 20, new CharacterActivityController(BEDROOM)).frames);
    expect(performed(run(900, 20, new CharacterActivityController(BEDROOM)).frames)).toEqual(first);
    expect(first.length).toBeGreaterThan(20);
    expect(new Set(first)).toEqual(new Set(BEDROOM.map((station) => station.id)));
    first.slice(1).forEach((id, index) => expect(id).not.toBe(first[index]));
    expect(first.slice(5, 10)).not.toEqual(first.slice(0, 5));
    expect(new Set(performed(run(60, 20, new CharacterActivityController([PRINTER])).frames))).toEqual(new Set(['printer']));
  });

  it('starts a requested station at once, interrupting, and ignores unknown ids', () => {
    const controller = new CharacterActivityController(BEDROOM);
    expect(controller.request('desk')).toBe(true);
    expect(controller.tick(.05, { position: { x: 0, z: 0 } })).toMatchObject({ phase: 'approach', stationId: 'desk', target: DESK.stand });
    controller.request('ball');
    let position = BALL.stand;
    let frame = controller.tick(.05, { position });
    for (let index = 0; frame.phase !== 'toss-ball' && index < 100; index += 1) frame = controller.tick(.05, { position });
    expect(frame.phase).toBe('toss-ball');
    const before = controller.tick(0, { position });
    expect(controller.request('project:nope')).toBe(false);
    expect(controller.tick(0, { position })).toEqual(before);
    expect(controller.request('ball')).toBe(true);
    expect(controller.tick(0, { position })).toEqual(before);
    expect(controller.request('rack')).toBe(true);
    frame = controller.tick(.05, { position });
    expect(frame).toMatchObject({ phase: 'approach', stationId: 'rack', target: RACK.stand, catches: 0, ball: { mode: 'home' } });
    position = RACK.stand;
    expect(controller.tick(.05, { position }).started).toBe('rack');
  });

  it('cancels the current activity when the stations change, then cycles only the new ones', () => {
    const { controller, frames, position } = run(32, 20, new CharacterActivityController([BALL, BED]));
    expect(frames.at(-1)?.phase).toBe('read');
    controller.setStations([PRINTER, RACK]);
    expect(controller.tick(0, { position })).toMatchObject({ phase: 'idle', active: false, stationId: null, kind: null, book: { mode: 'home' }, sitProgress: 0 });
    expect(controller.request('ball')).toBe(false);
    const next = run(60, 20, controller).frames;
    expect(new Set(performed(next))).toEqual(new Set(['printer', 'rack']));
  });

  it('waits for both arrival and braking before picking up a prop', () => {
    const controller = new CharacterActivityController([BALL, BED]);
    for (let index = 0; index < 101; index += 1) controller.tick(.1, { position: { x: 0, z: 0 } });
    expect(controller.tick(.1, { position: BALL.stand, speed: 1 }).phase).toBe('approach-ball');
    expect(controller.tick(.1, { position: { x: -.5, z: .8 }, speed: 0 }).phase).toBe('approach-ball');
    expect(controller.tick(.1, { position: BALL.stand, speed: 0 }).phase).toBe('pickup-ball');
  });

  it('cancels every phase immediately and cannot steal repeated live commands', () => {
    const stations = [BALL, BED, DESK, PRINTER];
    const allPhases = new Set(run(120, 60, new CharacterActivityController(stations)).frames.map((frame) => frame.phase));
    expect(allPhases.size).toBe(14);
    for (const desired of allPhases) {
      const controller = new CharacterActivityController(stations);
      let position: Vec2 = { x: 0, z: 0 }; let frame = controller.tick(0, { position });
      for (let index = 0; frame.phase !== desired && index < 8000; index += 1) {
        frame = controller.tick(.02, { position }); if (frame.target) position = frame.target;
      }
      expect(frame.phase).toBe(desired);
      expect(controller.cancel()).toMatchObject({ phase: 'idle', active: false, target: null, stationId: null, ball: { mode: 'home' }, book: { mode: 'home' } });
      for (let index = 0; index < 300; index += 1) {
        expect(controller.tick(.1, { position, commanded: true }).active).toBe(false);
        if (index % 7 === 0) controller.cancel();
      }
      for (let index = 0; index < 99; index += 1) expect(controller.tick(.1, { position }).active).toBe(false);
      expect(controller.tick(.1, { position }).active).toBe(true);
    }
  });

  it('resets book, ball, timer, and the cycle even on repeated resets', () => {
    const { controller, position } = run(40);
    for (let index = 0; index < 3; index += 1) {
      expect(controller.reset()).toMatchObject({ time: 0, phase: 'idle', sitProgress: 0, catches: 0, started: null, ball: { mode: 'home' }, book: { mode: 'home' } });
    }
    for (let index = 0; index < 100; index += 1) controller.tick(.1, { position });
    expect(controller.tick(0, { position }).target).toEqual(BALL.stand);
  });

  it('is FPS-independent and does not advance on paused/invalid-delta frames', () => {
    const slow = run(50, 20).frames;
    const fast = run(50, 120).frames;
    expect(phaseSequence(slow)).toEqual(phaseSequence(fast));
    expect(slow.at(-1)?.phase).toBe(fast.at(-1)?.phase);
    expect(slow.at(-1)?.progress).toBeCloseTo(fast.at(-1)!.progress, 1);
    for (const { controller, position } of [run(11), run(13), run(33)]) {
      const before = controller.tick(0, { position });
      for (let index = 0; index < 100; index += 1) expect(controller.tick(2, { position, paused: true })).toEqual(before);
      for (const dt of [0, -1, NaN, Infinity]) expect(controller.tick(dt, { position })).toEqual(before);
      expect(controller.tick(99, { position }).time - before.time).toBeCloseTo(ACTIVITY_CONFIG.maxDelta);
    }
  });

  it('keeps station targets reachable inside limits and immutable through returned frames', () => {
    const bounds = { minX: -2.3, maxX: 2.3, minZ: -2, maxZ: 2.2 };
    const obstacles = [
      { x: -1.35, z: -.45, radius: .34 }, { x: 1.3, z: -1.15, radius: .38 }, { x: .65, z: 1.4, radius: .25 },
    ];
    const controller = new CharacterActivityController([BALL, BED]);
    const state = createCharacterState({ x: 1.4, z: .42 });
    const visited = new Set<ActivityPhase>();
    for (let index = 0; index < 90 * 60; index += 1) {
      const frame = controller.tick(1 / 60, { position: state.position, speed: state.speed }); visited.add(frame.phase);
      stepCharacter(state, frame.target, 1 / 60, obstacles, bounds);
      expect(state.position.x).toBeGreaterThanOrEqual(bounds.minX + CHARACTER_CONFIG.radius - 1e-6);
      expect(state.position.x).toBeLessThanOrEqual(bounds.maxX - CHARACTER_CONFIG.radius + 1e-6);
      if (frame.target) frame.target.x = 500; // Returned frames cannot corrupt the station inputs.
    }
    expect(visited.has('read')).toBe(true); expect(visited.has('return-ball')).toBe(true);
    expect(BALL.stand.x).toBe(-1.6);
  });

  it('times out inaccessible navigation instead of getting trapped forever', () => {
    const controller = new CharacterActivityController([BALL, BED]);
    const phases: ActivityPhase[] = [];
    for (let index = 0; index < 650; index += 1) phases.push(controller.tick(.1, { position: { x: NaN, z: Infinity } }).phase);
    expect(phases).toContain('approach-ball'); expect(phases).toContain('approach-book');
    expect(phases).not.toContain('pickup-ball'); expect(phases).not.toContain('pickup-book');
  });

  it('stays idle without stations', () => {
    const { frames } = run(30, 20, new CharacterActivityController());
    expect(frames.every((frame) => frame.phase === 'idle' && frame.target === null)).toBe(true);
  });
});
