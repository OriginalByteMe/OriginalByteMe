import { describe, expect, it } from 'vitest';
import { ACTIVITY_CONFIG, ACTIVITY_STATIONS, CharacterActivityController, type ActivityFrame, type ActivityPhase } from '../activities';
import { CHARACTER_CONFIG, createCharacterState, stepCharacter, type Vec2 } from '../controller';

function run(seconds = 65, fps = 60) {
  const controller = new CharacterActivityController();
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

describe('autonomous character activities', () => {
  it('waits ten active seconds, approaches, throws/catches twice, then reads and alternates', () => {
    const { frames } = run();
    expect(frames.slice(0, 599).every((frame) => !frame.active && frame.target === null)).toBe(true);
    expect(phaseSequence(frames).slice(0, 18)).toEqual([
      'idle', 'approach-ball', 'pickup-ball', 'toss-ball', 'catch-ball', 'toss-ball', 'catch-ball', 'return-ball', 'idle',
      'approach-book', 'pickup-book', 'sit', 'read', 'stand', 'return-book', 'idle', 'approach-ball', 'pickup-ball',
    ]);
    expect(frames.find((frame) => frame.phase === 'return-ball')?.catches).toBe(2);
    expect(frames.filter((frame) => frame.phase === 'read').every((frame) => frame.sitProgress === 1 && frame.book.mode === 'held' && frame.animation === 'sit')).toBe(true);
  });

  it('waits for both arrival and braking before picking up a prop', () => {
    const controller = new CharacterActivityController();
    for (let index = 0; index < 101; index += 1) controller.tick(.1, { position: { x: 0, z: 0 } });
    expect(controller.tick(.1, { position: ACTIVITY_STATIONS.ball, speed: 1 }).phase).toBe('approach-ball');
    expect(controller.tick(.1, { position: { x: -.5, z: .8 }, speed: 0 }).phase).toBe('approach-ball');
    expect(controller.tick(.1, { position: ACTIVITY_STATIONS.ball, speed: 0 }).phase).toBe('pickup-ball');
  });

  it('cancels every phase immediately and cannot steal repeated live commands', () => {
    const allPhases = new Set(run().frames.map((frame) => frame.phase));
    for (const desired of allPhases) {
      const controller = new CharacterActivityController();
      let position: Vec2 = { x: 0, z: 0 }; let frame = controller.tick(0, { position });
      for (let index = 0; frame.phase !== desired && index < 4000; index += 1) {
        frame = controller.tick(.02, { position }); if (frame.target) position = frame.target;
      }
      expect(frame.phase).toBe(desired);
      expect(controller.cancel()).toMatchObject({ phase: 'idle', active: false, target: null, ball: { mode: 'home' }, book: { mode: 'home' } });
      for (let index = 0; index < 300; index += 1) {
        expect(controller.tick(.1, { position, commanded: true }).active).toBe(false);
        if (index % 7 === 0) controller.cancel();
      }
      for (let index = 0; index < 99; index += 1) expect(controller.tick(.1, { position }).active).toBe(false);
      expect(controller.tick(.1, { position }).active).toBe(true);
    }
  });

  it('resets book, ball, timer, and alternation even on repeated resets', () => {
    const { controller, position } = run(40);
    for (let index = 0; index < 3; index += 1) {
      expect(controller.reset()).toMatchObject({ time: 0, phase: 'idle', sitProgress: 0, catches: 0, ball: { mode: 'home' }, book: { mode: 'home' } });
    }
    for (let index = 0; index < 100; index += 1) controller.tick(.1, { position });
    expect(controller.tick(0, { position }).target).toEqual(ACTIVITY_STATIONS.ball);
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

  it('keeps immutable station targets inside mobile limits and accessible around sculptures', () => {
    const bounds = { minX: -2.3, maxX: 2.3, minZ: -2, maxZ: 2.2 };
    const obstacles = [
      { x: -1.35, z: -.45, radius: .34 }, { x: 1.3, z: -1.15, radius: .38 }, { x: .65, z: 1.4, radius: .25 },
    ];
    const controller = new CharacterActivityController();
    const state = createCharacterState({ x: 1.4, z: .42 });
    const visited = new Set<ActivityPhase>();
    for (let index = 0; index < 90 * 60; index += 1) {
      const frame = controller.tick(1 / 60, { position: state.position, speed: state.speed }); visited.add(frame.phase);
      stepCharacter(state, frame.target, 1 / 60, obstacles, bounds);
      expect(state.position.x).toBeGreaterThanOrEqual(bounds.minX + CHARACTER_CONFIG.radius - 1e-6);
      expect(state.position.x).toBeLessThanOrEqual(bounds.maxX - CHARACTER_CONFIG.radius + 1e-6);
      if (frame.target) frame.target.x = 500; // Returned frames cannot corrupt station constants.
    }
    expect(visited.has('read')).toBe(true); expect(visited.has('return-ball')).toBe(true);
    expect(ACTIVITY_STATIONS.ball.x).toBe(-1.6);
  });

  it('times out inaccessible navigation instead of getting trapped forever', () => {
    const controller = new CharacterActivityController();
    const phases: ActivityPhase[] = [];
    for (let index = 0; index < 650; index += 1) phases.push(controller.tick(.1, { position: { x: NaN, z: Infinity } }).phase);
    expect(phases).toContain('approach-ball'); expect(phases).toContain('approach-book');
    expect(phases).not.toContain('pickup-ball'); expect(phases).not.toContain('pickup-book');
  });
});
