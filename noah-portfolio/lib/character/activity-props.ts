import * as THREE from 'three';
import type { ActivityFrame, ActivityPropMode } from './activities';
import type { StationKind, Vec3 } from '@/components/character/world/types';

const BALL_RADIUS = .15;

/** World-space arm/head overlay for a station kind, or both hands guarding the afro. */
export type StationPose = {
  kind: StationKind | 'afro';
  /** World point the hands or eyes go to (keyboard, rack button, frame corner, afro centre). */
  reach: THREE.Vector3;
  /** 0 leaves the clip untouched, 1 is full contact. */
  weight: number;
  time: number;
  /** 0..1 through the perform; admire looks first, then reaches. */
  progress: number;
};
export type ActivityProps = {
  group: THREE.Group;
  /** Remove the last IK overlay BEFORE mixer.update, including constant clip tracks. */
  beforeMixer(): void;
  /** Call after actor transforms and mixer.update. Never changes the actor root. */
  apply(frame: ActivityFrame): void;
  /** Call after apply(); layers a station or afro pose onto the same reversible overlay. */
  pose(pose: StationPose): void;
  reset(): void;
  dispose(): void;
};
type BonePose = { bone: THREE.Object3D; quaternion: THREE.Quaternion };
type Arm = { upper: THREE.Object3D; forearm: THREE.Object3D; hand: THREE.Object3D; side: number };
type Prop = {
  object: THREE.Group;
  home: THREE.Vector3;
  mode: ActivityPropMode;
  release: { from: THREE.Vector3; rotation: THREE.Quaternion; at: number } | null;
  tossOrigin: THREE.Vector3;
};
const smooth = (t: number) => { const p = THREE.MathUtils.clamp(t, 0, 1); return p * p * (3 - 2 * p); };
const vector = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z);

/** Low-poly, texture-free ball and book resting on the area's own furniture, plus a reversible FK/IK contact overlay for V5. */
export function createActivityProps(area: THREE.Object3D, actor: THREE.Object3D, model: THREE.Object3D, rests: { ball: Vec3; book: Vec3 }): ActivityProps {
  const group = new THREE.Group();
  group.name = 'autonomous-activity-props';
  area.add(group);
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .72 });
  const peach = material(0xe7987d), cream = material(0xfff1ce), plum = material(0x745387), green = material(0x9cab90);
  const geometry = (parent: THREE.Object3D, shape: THREE.BufferGeometry, surface: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(shape, surface); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };

  const ballObject = new THREE.Group(); ballObject.name = 'activity-ball'; group.add(ballObject);
  geometry(ballObject, new THREE.SphereGeometry(BALL_RADIUS, 20, 14), peach);
  const stripe = geometry(ballObject, new THREE.TorusGeometry(.151, .012, 5, 32), cream);
  stripe.rotation.x = Math.PI / 2;
  geometry(ballObject, new THREE.TorusGeometry(.151, .009, 5, 32), plum).rotation.y = Math.PI / 2;

  const bookObject = new THREE.Group(); bookObject.name = 'activity-book'; group.add(bookObject);
  const closed = new THREE.Group(); const opened = new THREE.Group(); bookObject.add(closed, opened);
  geometry(closed, new THREE.BoxGeometry(.34, .075, .27), plum);
  geometry(closed, new THREE.BoxGeometry(.31, .042, .254), cream, .007, .002, 0);
  geometry(closed, new THREE.BoxGeometry(.10, .004, .035), peach, 0, .04, 0);
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group(); leaf.position.x = side * .13; leaf.rotation.z = side * .13;
    opened.add(leaf);
    geometry(leaf, new THREE.BoxGeometry(.26, .032, .30), plum);
    geometry(leaf, new THREE.BoxGeometry(.245, .018, .286), cream, 0, .023, 0);
    for (let line = 0; line < 5; line += 1) {
      geometry(leaf, new THREE.BoxGeometry(.16 - line % 2 * .03, .002, .004), green, 0, .033, -.08 + line * .034);
    }
  }
  const makeProp = (object: THREE.Group, home: THREE.Vector3): Prop => ({ object, home, mode: 'home', release: null, tossOrigin: home.clone() });
  const ball = makeProp(ballObject, vector(rests.ball));
  const book = makeProp(bookObject, vector(rests.book));
  const overlays: BonePose[] = [];
  const find = (name: string) => model.getObjectByName(name) ?? model.getObjectByName(name.replace('.', '')) ?? model.getObjectByName(name.replace('.', '_'));
  const arms: Arm[] = [];
  for (const [suffix, side] of [['R', -1], ['L', 1]] as const) {
    const upper = find(`upper_arm.${suffix}`), forearm = find(`forearm.${suffix}`), hand = find(`hand.${suffix}`);
    if (upper && forearm && hand) arms.push({ upper, forearm, hand, side });
  }
  const head = find('head');
  const spine = find('spine');
  let lastTime = 0;
  let disposed = false;
  const localToWorld = (x: number, y: number, z: number) => actor.localToWorld(new THREE.Vector3(x, y, z));
  // All props remain under their world group. Hand ownership is an explicit mode,
  // never reparenting that could leave a stale prop stuck to a travelling character.
  const setWorldPosition = (prop: Prop, position: THREE.Vector3) => prop.object.position.copy(group.worldToLocal(position.clone()));
  const homeWorld = (prop: Prop) => group.localToWorld(prop.home.clone());
  const save = (bone: THREE.Object3D) => { if (!overlays.some((entry) => entry.bone === bone)) overlays.push({ bone, quaternion: bone.quaternion.clone() }); };
  const beforeMixer = () => {
    for (const pose of overlays) pose.bone.quaternion.copy(pose.quaternion);
    overlays.length = 0;
  };
  const rotateToward = (bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) => {
    save(bone);
    const start = bone.getWorldPosition(new THREE.Vector3());
    const from = child.getWorldPosition(new THREE.Vector3()).sub(start).normalize();
    const to = target.clone().sub(start).normalize();
    if (!from.lengthSq() || !to.lengthSq()) return;
    const q = new THREE.Quaternion().setFromUnitVectors(from, to).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    const parentQ = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    bone.quaternion.copy(parentQ.invert().multiply(q)); bone.updateWorldMatrix(false, true);
  };
  const poseArm = (arm: Arm, destination: THREE.Vector3, influence = 1) => {
    const root = arm.upper.getWorldPosition(new THREE.Vector3());
    const elbow = arm.forearm.getWorldPosition(new THREE.Vector3());
    const wrist = arm.hand.getWorldPosition(new THREE.Vector3());
    const target = wrist.clone().lerp(destination, influence);
    const l1 = root.distanceTo(elbow), l2 = elbow.distanceTo(wrist);
    if (l1 < .001 || l2 < .001) return;
    const direction = target.clone().sub(root);
    const d = THREE.MathUtils.clamp(direction.length(), Math.abs(l1 - l2) + .001, l1 + l2 - .001);
    direction.normalize(); target.copy(root).addScaledVector(direction, d);
    const bend = new THREE.Vector3(arm.side, -.15, -.5).transformDirection(actor.matrixWorld);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const along = (l1 * l1 + d * d - l2 * l2) / (2 * d);
    const elbowTarget = root.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    rotateToward(arm.upper, arm.forearm, elbowTarget);
    rotateToward(arm.forearm, arm.hand, target);
  };
  /** Rotates a bone in world space by part of the turn that takes the actor's facing to the target, so the face follows whatever the rig's local axes are. */
  const turnToward = (bone: THREE.Object3D, target: THREE.Vector3, amount: number) => {
    save(bone);
    const to = target.clone().sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    if (!to.lengthSq()) return;
    const facing = new THREE.Vector3(0, 0, 1).transformDirection(actor.matrixWorld);
    const q = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(facing, to), amount).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    const parentQ = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    bone.quaternion.copy(parentQ.invert().multiply(q)); bone.updateWorldMatrix(false, true);
  };
  const reset = () => {
    beforeMixer();
    for (const prop of [ball, book]) {
      prop.mode = 'home'; prop.release = null; prop.object.position.copy(prop.home); prop.object.quaternion.identity();
    }
    opened.visible = false; closed.visible = true; lastTime = 0;
  };
  reset();

  const place = (prop: Prop, mode: ActivityPropMode, progress: number, held: THREE.Vector3, time: number) => {
    if (mode === 'home' && prop.mode !== 'home') {
      prop.release = { from: prop.object.getWorldPosition(new THREE.Vector3()), rotation: prop.object.quaternion.clone(), at: time };
    }
    if (mode !== 'home') prop.release = null;
    if (mode === 'toss' && prop.mode !== 'toss') prop.tossOrigin.copy(held);
    const home = homeWorld(prop);
    if (mode === 'home' && prop.release) {
      const p = smooth((time - prop.release.at) / .65);
      const point = prop.release.from.clone().lerp(home, p);
      point.y += Math.sin(Math.PI * p) * .16;
      setWorldPosition(prop, point);
      prop.object.quaternion.copy(prop.release.rotation).slerp(new THREE.Quaternion(), p);
      if (p >= 1) { prop.release = null; prop.object.position.copy(prop.home); prop.object.quaternion.identity(); }
    } else if (mode === 'home') {
      prop.object.position.copy(prop.home); prop.object.quaternion.identity();
    } else if (mode === 'pickup' || mode === 'return') {
      const p = smooth(progress);
      setWorldPosition(prop, mode === 'pickup' ? home.lerp(held, p) : held.clone().lerp(home, p));
    } else if (mode === 'toss') {
      const point = prop.tossOrigin.clone().lerp(held, progress);
      // Analytic throw: same endpoint at catch, with no variable-step physics drift.
      point.y += 4 * progress * (1 - progress) * .95;
      setWorldPosition(prop, point);
      prop.object.rotation.set(progress * Math.PI * 2, 0, progress * Math.PI);
    } else setWorldPosition(prop, held);
    prop.mode = mode;
  };

  return {
    group, beforeMixer, reset,
    apply(frame) {
      if (disposed) return;
      if (frame.time < lastTime) reset();
      lastTime = frame.time;
      // Also makes repeated apply safe if a caller renders twice without a mixer tick.
      beforeMixer(); actor.updateWorldMatrix(true, true); group.updateWorldMatrix(true, true);
      const ballHeld = localToWorld(-.30, 1.03, .43);
      const bookHeld = localToWorld(0, .94 - .44 * smooth(frame.sitProgress), .43);
      place(ball, frame.ball.mode, frame.ball.progress, ballHeld, frame.time);
      place(book, frame.book.mode, frame.book.progress, bookHeld, frame.time);
      const holdingBook = frame.book.mode !== 'home';
      const open = holdingBook && (frame.phase === 'sit' || frame.phase === 'read' || frame.phase === 'stand');
      opened.visible = open; closed.visible = !open;
      if (holdingBook) {
        const actorQ = actor.getWorldQuaternion(new THREE.Quaternion());
        const groupQ = group.getWorldQuaternion(new THREE.Quaternion());
        book.object.quaternion.copy(groupQ.invert().multiply(actorQ));
        if (open) book.object.rotateX(.25);
      }
      if (spine && (frame.phase.startsWith('pickup-') || frame.phase.startsWith('return-'))) {
        // Apply torso anticipation before IK so the wrists still meet the prop.
        save(spine); spine.rotateX(Math.sin(frame.progress * Math.PI) * .08);
        spine.updateWorldMatrix(false, true);
      }
      if (frame.ball.mode !== 'home') {
        const arm = arms.find((entry) => entry.side === -1);
        if (arm) {
          const contact = frame.ball.mode === 'toss' ? ballHeld.clone() : ball.object.getWorldPosition(new THREE.Vector3());
          contact.y -= BALL_RADIUS * .8;
          if (frame.ball.mode === 'toss') contact.y += Math.sin(frame.ball.progress * Math.PI * 2) * .09;
          const weight = frame.phase === 'pickup-ball' ? smooth(Math.min(1, frame.progress * 4))
            : frame.phase === 'return-ball' ? 1 - smooth(Math.max(0, (frame.progress - .8) / .2)) : 1;
          poseArm(arm, contact, weight);
        }
      }
      if (holdingBook) {
        const centre = book.object.getWorldPosition(new THREE.Vector3());
        for (const arm of arms) {
          const offset = new THREE.Vector3(arm.side * (open ? .23 : .14), -.015, 0).applyQuaternion(actor.getWorldQuaternion(new THREE.Quaternion()));
          const weight = frame.phase === 'pickup-book' ? smooth(Math.min(1, frame.progress * 4))
            : frame.phase === 'return-book' ? 1 - smooth(Math.max(0, (frame.progress - .8) / .2)) : 1;
          poseArm(arm, centre.clone().add(offset), weight);
        }
        if (head && open) { save(head); head.rotateX(.18); }
      }
      model.updateWorldMatrix(false, true);
    },
    pose({ kind, reach, weight, time, progress }) {
      if (disposed || weight <= 0) return;
      actor.updateWorldMatrix(true, true);
      const across = new THREE.Vector3(1, 0, 0).transformDirection(actor.matrixWorld);
      const hands = (spread: number, lift: (side: number) => number) => {
        for (const arm of arms) poseArm(arm, reach.clone().addScaledVector(across, arm.side * spread).setY(reach.y + lift(arm.side)), weight);
      };
      const look = (amount: number, target = reach) => { if (head) turnToward(head, target, amount * weight); };
      if (kind === 'type') {
        // Alternating taps: each hand dips only on its half of the cycle.
        hands(.11, (side) => .025 * Math.max(0, Math.sin(time * 16 + (side > 0 ? Math.PI : 0))));
        look(.35);
      } else if (kind === 'tinker') {
        const arm = arms.find((entry) => entry.side === -1);
        if (arm) poseArm(arm, reach.clone().lerp(arm.upper.getWorldPosition(new THREE.Vector3()), .09 * (1 - Math.cos(time * 9)) / 2), weight);
        look(.6);
      } else if (kind === 'watch') {
        if (spine) { save(spine); spine.rotateX(.14 * weight); spine.updateWorldMatrix(false, true); }
        look(.85);
      } else if (kind === 'admire' && progress < .45) {
        look(.9, reach.clone().setY(reach.y + 1.2));
      } else if (kind === 'afro') {
        hands(.2, () => 0);
      } else {
        hands(.12, () => .04 * Math.sin(time * 7));
        look(.5);
      }
      model.updateWorldMatrix(false, true);
    },
    dispose() {
      if (disposed) return;
      disposed = true; beforeMixer(); group.removeFromParent();
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      group.traverse((node) => { if (node instanceof THREE.Mesh) { geometries.add(node.geometry); for (const surface of Array.isArray(node.material) ? node.material : [node.material]) materials.add(surface); } });
      for (const shape of geometries) shape.dispose(); for (const surface of materials) surface.dispose();
    },
  };
}
