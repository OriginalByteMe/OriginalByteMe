import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createActivityProps, ACTIVITY_PROP_LAYOUT } from '../activity-props';
import { ACTIVITY_STATIONS, CharacterActivityController, type ActivityFrame } from '../activities';

function fixture() {
  const world = new THREE.Group(), actor = new THREE.Group(), model = new THREE.Group();
  world.add(actor); actor.add(model);
  const spine = new THREE.Bone(); spine.name = 'spine'; model.add(spine);
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = 1.5; spine.add(head);
  for (const [side, suffix] of [[-1, 'R'], [1, 'L']] as const) {
    const upper = new THREE.Bone(), forearm = new THREE.Bone(), hand = new THREE.Bone();
    upper.name = `upper_arm${suffix}`; forearm.name = `forearm${suffix}`; hand.name = `hand${suffix}`;
    upper.position.set(side * .228, 1.137, .098); forearm.position.set(side * .12, -.317, 0); hand.position.set(side * .07, -.248, 0);
    spine.add(upper); upper.add(forearm); forearm.add(hand);
  }
  const props = createActivityProps(world, actor, model);
  const base = new CharacterActivityController().tick(0, { position: { x: 0, z: 0 } });
  const frame = (patch: Partial<ActivityFrame>): ActivityFrame => ({ ...base, ...patch });
  return { world, actor, model, props, frame, ball: props.group.getObjectByName('activity-ball')!, book: props.group.getObjectByName('activity-book')! };
}

describe('activity props and contact poses', () => {
  it('creates real floor-supported props inside narrow stage bounds', () => {
    const { props, ball, book } = fixture();
    expect(ball.children.length).toBeGreaterThan(1); expect(book.children.length).toBe(2);
    expect(ball.position.toArray()).toEqual(Object.values(ACTIVITY_PROP_LAYOUT.ball));
    const box = new THREE.Box3().setFromObject(props.group);
    expect(box.min.x).toBeGreaterThan(-2.3); expect(box.max.x).toBeLessThan(2.3);
    expect(box.min.z).toBeGreaterThan(-2); expect(box.max.z).toBeLessThan(2.2);
    props.dispose();
  });

  it('moves a ball through a real parabolic toss and catches at the same hand', () => {
    const { props, actor, ball, frame } = fixture();
    actor.position.set(ACTIVITY_STATIONS.ball.x, 0, ACTIVITY_STATIONS.ball.z);
    props.apply(frame({ phase: 'toss-ball', ball: { mode: 'toss', progress: 0 } }));
    const release = ball.position.clone();
    props.apply(frame({ time: .575, phase: 'toss-ball', ball: { mode: 'toss', progress: .5 } }));
    expect(ball.position.y - release.y).toBeCloseTo(.95);
    props.apply(frame({ time: 1.15, phase: 'toss-ball', ball: { mode: 'toss', progress: 1 } }));
    expect(ball.position.distanceTo(release)).toBeLessThan(1e-8);
    props.apply(frame({ time: 1.15, phase: 'catch-ball', ball: { mode: 'held', progress: 0 } }));
    expect(ball.position.distanceTo(release)).toBeLessThan(1e-8);
  });

  it('actually bends the arm to meet a held ball and cleanly restores mixer bones', () => {
    const { props, model, ball, frame } = fixture();
    const upper = model.getObjectByName('upper_armR')!;
    const hand = model.getObjectByName('handR')!;
    const initial = upper.quaternion.clone();
    const held = frame({ phase: 'catch-ball', ball: { mode: 'held', progress: 0 } });
    props.apply(held);
    expect(upper.quaternion.angleTo(initial)).toBeGreaterThan(.3);
    expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(ball.position.clone().add(new THREE.Vector3(0, -.12, 0)))).toBeLessThan(.04);
    const posed = upper.quaternion.clone(); props.apply(held);
    expect(upper.quaternion.angleTo(posed)).toBeLessThan(1e-6);
    props.beforeMixer(); expect(upper.quaternion.angleTo(initial)).toBeLessThan(1e-6);
  });

  it('holds an open book between both hands and removes reading pose after cancel', () => {
    const { props, model, book, frame } = fixture();
    const head = model.getObjectByName('head')!;
    const initial = head.quaternion.clone();
    props.apply(frame({ phase: 'read', sitProgress: 1, book: { mode: 'held', progress: .5 } }));
    expect(book.children[0].visible).toBe(false); expect(book.children[1].visible).toBe(true);
    expect(head.quaternion.angleTo(initial)).toBeCloseTo(.18);
    props.beforeMixer(); props.apply(frame({ time: 1 }));
    expect(head.quaternion.angleTo(initial)).toBeLessThan(1e-6);
    expect(book.children[0].visible).toBe(true);
  });

  it('detaches ownership immediately during every prop phase, eases home, and never follows a later click', () => {
    for (const mode of ['pickup', 'held', 'toss', 'return'] as const) {
      const { props, actor, ball, book, frame } = fixture();
      props.apply(frame({ time: 1, phase: 'catch-ball', ball: { mode, progress: .5 }, book: { mode: mode === 'toss' ? 'held' : mode, progress: .5 } }));
      const released = ball.getWorldPosition(new THREE.Vector3());
      actor.position.set(4, 0, -1);
      props.apply(frame({ time: 1 }));
      expect(ball.getWorldPosition(new THREE.Vector3()).distanceTo(released)).toBeLessThan(1e-8);
      expect(ball.parent).toBe(props.group); expect(book.parent).toBe(props.group);
      props.apply(frame({ time: 1.4 }));
      const intermediate = ball.position.clone(); props.apply(frame({ time: 1.4 }));
      expect(ball.position.toArray()).toEqual(intermediate.toArray()); // Paused clock cannot move a release.
      props.apply(frame({ time: 1.7 }));
      expect(ball.position.toArray()).toEqual(Object.values(ACTIVITY_PROP_LAYOUT.ball));
      expect(book.position.toArray()).toEqual(Object.values(ACTIVITY_PROP_LAYOUT.book));
    }
  });

  it('handles model fallback, reset, remount and idempotent disposal without stranded objects', () => {
    const { props, frame, world, ball } = fixture();
    props.apply(frame({ time: 9, phase: 'read', book: { mode: 'held', progress: .5 } }));
    props.reset(); props.reset(); expect(ball.position.toArray()).toEqual(Object.values(ACTIVITY_PROP_LAYOUT.ball));
    const mesh = ball.children[0] as THREE.Mesh;
    const dispose = vi.spyOn(mesh.geometry, 'dispose'); props.dispose(); props.dispose();
    expect(dispose).toHaveBeenCalledTimes(1); expect(props.group.parent).toBeNull();
    const fallback = createActivityProps(world, new THREE.Group(), new THREE.Group());
    expect(() => fallback.apply(frame({ phase: 'catch-ball', ball: { mode: 'held', progress: 0 } }))).not.toThrow();
    fallback.dispose();
  });
});
