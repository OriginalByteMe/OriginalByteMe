import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createActivityProps } from '../activity-props';
import { CharacterActivityController, type ActivityFrame } from '../activities';

const RESTS = { ball: { x: -1.9, y: .6, z: 1.16 }, book: { x: 1.77, y: .43, z: .03 } };
const STAND = { x: -1.6, z: .8 };
const SHOULDER_VOLUMES = ['L', 'R'].flatMap((side) => ['045', '090', '135', '180'].map((angle) => `ShoulderVolume_${side}_${angle}`));
/** What the mixer left on the shirt this frame. */
const MIXER_VOLUME = .03;

function fixture() {
  // The area group sits at the lab's origin to prove rests are area-local.
  const world = new THREE.Group(), actor = new THREE.Group(), model = new THREE.Group();
  world.position.set(0, -18, 0); world.add(actor); actor.add(model);
  const spine = new THREE.Bone(); spine.name = 'spine'; model.add(spine);
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = 1.5; spine.add(head);
  for (const [side, suffix] of [[-1, 'R'], [1, 'L']] as const) {
    const upper = new THREE.Bone(), forearm = new THREE.Bone(), hand = new THREE.Bone();
    upper.name = `upper_arm${suffix}`; forearm.name = `forearm${suffix}`; hand.name = `hand${suffix}`;
    upper.position.set(side * .228, 1.137, .098); forearm.position.set(side * .12, -.317, 0); hand.position.set(side * .07, -.248, 0);
    spine.add(upper); upper.add(forearm); forearm.add(hand);
  }
  // The shirt's eight shoulder correctives, at an idle-level value as the clips bake them.
  const shirt = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  shirt.name = 'Shirt'; shirt.morphTargetDictionary = Object.fromEntries(SHOULDER_VOLUMES.map((name, index) => [name, index]));
  shirt.morphTargetInfluences = SHOULDER_VOLUMES.map(() => MIXER_VOLUME);
  model.add(shirt);
  world.updateMatrixWorld(true);
  const props = createActivityProps(world, actor, model, RESTS);
  const base = new CharacterActivityController().tick(0, { position: { x: 0, z: 0 } });
  const frame = (patch: Partial<ActivityFrame>): ActivityFrame => ({ ...base, ...patch });
  return { world, actor, model, props, frame, shirt, ball: props.group.getObjectByName('activity-ball')!, book: props.group.getObjectByName('activity-book')! };
}
const worldOf = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3());
const volume = (shirt: THREE.Mesh, name: string) => shirt.morphTargetInfluences![shirt.morphTargetDictionary![name]];

describe('activity props and contact poses', () => {
  it('rests the ball and book on the area rest points with no pedestals of their own', () => {
    const { props, ball, book } = fixture();
    expect(ball.children.length).toBeGreaterThan(1); expect(book.children.length).toBe(2);
    expect(props.group.children).toEqual([ball, book]);
    expect(ball.position.toArray()).toEqual([-1.9, .6, 1.16]);
    expect(worldOf(ball).toArray()).toEqual([-1.9, -17.4, 1.16]);
    expect(book.position.toArray()).toEqual([1.77, .43, .03]);
    props.dispose();
  });

  it('moves a ball through a real parabolic toss and catches at the same hand', () => {
    const { props, actor, ball, frame } = fixture();
    actor.position.set(STAND.x, 0, STAND.z);
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
    expect(worldOf(hand).distanceTo(worldOf(ball).add(new THREE.Vector3(0, -.12, 0)))).toBeLessThan(.04);
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
      const released = worldOf(ball);
      actor.position.set(4, 0, -1);
      props.apply(frame({ time: 1 }));
      expect(worldOf(ball).distanceTo(released)).toBeLessThan(1e-8);
      expect(ball.parent).toBe(props.group); expect(book.parent).toBe(props.group);
      props.apply(frame({ time: 1.4 }));
      const intermediate = ball.position.clone(); props.apply(frame({ time: 1.4 }));
      expect(ball.position.toArray()).toEqual(intermediate.toArray()); // Paused clock cannot move a release.
      props.apply(frame({ time: 1.7 }));
      expect(ball.position.toArray()).toEqual([-1.9, .6, 1.16]);
      expect(book.position.toArray()).toEqual([1.77, .43, .03]);
    }
  });

  it('poses both hands on a keyboard, one finger on a rack, both on the afro, and the head toward a print', () => {
    const { props, actor, model } = fixture();
    actor.position.set(0, 0, 0);
    const bone = (name: string) => model.getObjectByName(name)!;
    const rest = Object.fromEntries(['upper_armR', 'upper_armL', 'forearmR', 'forearmL', 'head'].map((name) => [name, bone(name).quaternion.clone()]));
    // At time 0 neither typing hand is mid-tap, so both land exactly 0.11 either side of the keys.
    const keys = worldOf(model).add(new THREE.Vector3(0, 1, .5));
    props.pose({ kind: 'type', reach: keys, weight: 1, time: 0, progress: .5 });
    expect(worldOf(bone('handR')).distanceTo(keys.clone().add(new THREE.Vector3(-.11, 0, 0)))).toBeLessThan(1e-3);
    expect(worldOf(bone('handL')).distanceTo(keys.clone().add(new THREE.Vector3(.11, 0, 0)))).toBeLessThan(1e-3);
    props.beforeMixer();
    for (const [name, quaternion] of Object.entries(rest)) expect(bone(name).quaternion.angleTo(quaternion)).toBeLessThan(1e-6);

    const rack = worldOf(model).add(new THREE.Vector3(-.3, 1.1, .45));
    props.pose({ kind: 'tinker', reach: rack, weight: 1, time: 0, progress: .5 });
    expect(worldOf(bone('handR')).distanceTo(rack)).toBeLessThan(.1);
    expect(bone('upper_armL').quaternion.angleTo(rest.upper_armL)).toBeLessThan(1e-6);
    props.beforeMixer();

    const afro = worldOf(model).add(new THREE.Vector3(0, 1.9, .1));
    props.pose({ kind: 'afro', reach: afro, weight: 1, time: 0, progress: .5 });
    for (const side of ['R', 'L']) expect(worldOf(bone(`hand${side}`)).y).toBeGreaterThan(worldOf(bone(`upper_arm${side}`)).y);
    props.beforeMixer();

    const print = worldOf(model).add(new THREE.Vector3(.6, 1.0, .6));
    const toward = print.clone().sub(worldOf(bone('head'))).normalize();
    const facing = () => new THREE.Vector3(0, 0, 1).applyQuaternion(bone('head').getWorldQuaternion(new THREE.Quaternion()));
    const before = facing().angleTo(toward);
    props.pose({ kind: 'watch', reach: print, weight: 1, time: 0, progress: .5 });
    expect(facing().angleTo(toward)).toBeLessThan(before * .4);

    props.beforeMixer();
    props.pose({ kind: 'play', reach: print, weight: 0, time: 0, progress: .5 });
    for (const [name, quaternion] of Object.entries(rest)) expect(bone(name).quaternion.angleTo(quaternion)).toBeLessThan(1e-6);
  });

  it('leaves the clip pose exactly as it was at weight zero and barely moves the elbows at a small weight', () => {
    const { props, model, frame } = fixture();
    const bone = (name: string) => model.getObjectByName(name)!;
    const clip = Object.fromEntries(['upper_armR', 'forearmR'].map((name) => [name, bone(name).quaternion.clone()]));
    // The first frame of a ball pickup weights the hand at zero.
    props.apply(frame({ phase: 'pickup-ball', progress: 0, ball: { mode: 'pickup', progress: 0 } }));
    for (const [name, quaternion] of Object.entries(clip)) expect(bone(name).quaternion.angleTo(quaternion)).toBeLessThan(1e-6);
    props.beforeMixer();
    const elbows = ['forearmR', 'forearmL'].map((name) => worldOf(bone(name)));
    props.pose({ kind: 'type', reach: worldOf(model).add(new THREE.Vector3(0, 1, .5)), weight: .05, time: 0, progress: .5 });
    ['forearmR', 'forearmL'].forEach((name, index) => expect(worldOf(bone(name)).distanceTo(elbows[index])).toBeLessThan(.03));
  });

  it('points one arm, the one on that side, most of the way toward a target and looks there', () => {
    const { props, model } = fixture();
    const bone = (name: string) => model.getObjectByName(name)!;
    const left = bone('upper_armL').quaternion.clone();
    const shoulder = worldOf(bone('upper_armR'));
    const target = worldOf(model).add(new THREE.Vector3(-2, -.5, 3));
    const headBefore = new THREE.Vector3(0, 0, 1).applyQuaternion(bone('head').getWorldQuaternion(new THREE.Quaternion()));
    props.pose({ kind: 'point', reach: target, weight: 1, time: 0, progress: 0 });
    const hand = worldOf(bone('handR'));
    const length = worldOf(bone('forearmR')).distanceTo(shoulder) + hand.distanceTo(worldOf(bone('forearmR')));
    expect(hand.distanceTo(shoulder)).toBeCloseTo(.85 * length, 2);
    expect(hand.clone().sub(shoulder).normalize().angleTo(target.clone().sub(shoulder).normalize())).toBeLessThan(.02);
    expect(bone('upper_armL').quaternion.angleTo(left)).toBeLessThan(1e-6);
    const toward = target.clone().sub(worldOf(bone('head'))).normalize();
    const headAfter = new THREE.Vector3(0, 0, 1).applyQuaternion(bone('head').getWorldQuaternion(new THREE.Quaternion()));
    expect(headAfter.angleTo(toward)).toBeLessThan(headBefore.angleTo(toward));
  });

  it('drives the shirt shoulder correctives from how high the posed arm is, and hands them back to the mixer', () => {
    const { props, model, shirt } = fixture();
    const shoulder = worldOf(model.getObjectByName('upper_armL')!);
    // Both hands reaching far overhead: both arms straight up.
    props.pose({ kind: 'play', reach: worldOf(model).add(new THREE.Vector3(0, 4, .1)), weight: 1, time: 0, progress: 0 });
    for (const side of ['L', 'R']) {
      expect(volume(shirt, `ShoulderVolume_${side}_180`)).toBeGreaterThan(.5);
      expect(volume(shirt, `ShoulderVolume_${side}_045`)).toBeLessThan(.1);
    }
    props.beforeMixer();
    for (const name of SHOULDER_VOLUMES) expect(volume(shirt, name)).toBe(MIXER_VOLUME);
    // The left arm out to the side at shoulder height: the 90 degree shape, and the right arm left to the clip.
    props.pose({ kind: 'point', reach: shoulder.clone().add(new THREE.Vector3(2, 0, 0)), weight: 1, time: 0, progress: 0 });
    expect(volume(shirt, 'ShoulderVolume_L_090')).toBeGreaterThan(.7);
    expect(volume(shirt, 'ShoulderVolume_L_180')).toBe(0);
    for (const angle of ['045', '090', '135', '180']) expect(volume(shirt, `ShoulderVolume_R_${angle}`)).toBe(MIXER_VOLUME);
    props.beforeMixer();
    for (const name of SHOULDER_VOLUMES) expect(volume(shirt, name)).toBe(MIXER_VOLUME);
  });

  it('handles model fallback, reset, remount and idempotent disposal without stranded objects', () => {
    const { props, frame, world, ball } = fixture();
    props.apply(frame({ time: 9, phase: 'read', book: { mode: 'held', progress: .5 } }));
    props.reset(); props.reset(); expect(ball.position.toArray()).toEqual([-1.9, .6, 1.16]);
    const mesh = ball.children[0] as THREE.Mesh;
    const dispose = vi.spyOn(mesh.geometry, 'dispose'); props.dispose(); props.dispose();
    expect(dispose).toHaveBeenCalledTimes(1); expect(props.group.parent).toBeNull();
    const fallback = createActivityProps(world, new THREE.Group(), new THREE.Group(), RESTS);
    expect(() => fallback.apply(frame({ phase: 'catch-ball', ball: { mode: 'held', progress: 0 } }))).not.toThrow();
    expect(() => fallback.pose({ kind: 'type', reach: new THREE.Vector3(0, 1, .5), weight: 1, time: 0, progress: .5 })).not.toThrow();
    fallback.dispose();
  });
});
