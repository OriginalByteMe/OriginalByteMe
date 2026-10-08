import * as THREE from 'three';
import { ACTIVITY_CONFIG, type ActivityFrame, type ActivityPropMode } from './activities';
import type { StationKind, Vec3 } from '@/components/character/world/types';

const BALL_RADIUS = .15;
/** Seconds a hand takes to reach for a prop or to let it go. */
const HAND_RAMP = .5;
/** Spread of the hands either side of the afro guard's reach point, onto the afro's sides. */
const AFRO_SPREAD = .44;
/** Share of the arm's length a pointing hand reaches out. */
const POINT_REACH = .85;
/** The shirt's shoulder correctives, one per 45 degrees of upper-arm elevation from hanging straight down. */
const SHOULDER_ANGLES = ['045', '090', '135', '180'] as const;

/** World-space arm/head overlay for a station kind, both hands guarding the afro, one arm pointing, or his right knee raised for a stomp. */
export type StationPose = {
  kind: StationKind | 'afro' | 'point' | 'stomp';
  /** World point the hands or eyes go to (keyboard, rack button, frame corner, the afro's sides, what he points at). */
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
  /** Call after apply(); layers a station, afro, point or stomp pose onto the same reversible overlay. */
  pose(pose: StationPose): void;
  /** Call after pose(); turns neck and head toward a world point within neck limits, taking over from a station look by the same weight. */
  face(target: THREE.Vector3, weight: number): void;
  reset(): void;
  dispose(): void;
};
type BonePose = { bone: THREE.Object3D; quaternion: THREE.Quaternion };
/** `volumes`: this side's shirt shoulder corrective slots, in SHOULDER_ANGLES order. */
type Arm = { upper: THREE.Object3D; forearm: THREE.Object3D; hand: THREE.Object3D; side: number; volumes: number[] };
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
  // The clips bake the shirt's shoulder correctives; a pose that raises an arm drives them from that arm's elevation instead.
  let shirt: THREE.Mesh | undefined;
  model.traverse((node) => { if (!shirt && node instanceof THREE.Mesh && node.morphTargetDictionary?.ShoulderVolume_L_045 !== undefined) shirt = node; });
  const arms: Arm[] = [];
  for (const [suffix, side] of [['R', -1], ['L', 1]] as const) {
    const upper = find(`upper_arm.${suffix}`), forearm = find(`forearm.${suffix}`), hand = find(`hand.${suffix}`);
    const volumes = SHOULDER_ANGLES.map((angle) => shirt?.morphTargetDictionary?.[`ShoulderVolume_${suffix}_${angle}`]).filter((slot): slot is number => slot !== undefined);
    if (upper && forearm && hand) arms.push({ upper, forearm, hand, side, volumes: volumes.length === SHOULDER_ANGLES.length ? volumes : [] });
  }
  /** This frame's IK weight per arm, and the mixer's corrective values the overlay replaced. */
  const reached = new Map<Arm, number>();
  const mixerVolumes = new Map<number, number>();
  const head = find('head');
  const neck = find('neck');
  const spine = find('spine');
  const thigh = find('thigh.R'), shin = find('shin.R'), foot = find('foot.R');
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
    // The mixer skips writes that did not change, so a stale corrective would otherwise stick.
    const influences = shirt?.morphTargetInfluences;
    if (influences) for (const [slot, value] of mixerVolumes) influences[slot] = value;
    mixerVolumes.clear(); reached.clear();
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
  /**
   * Two-bone IK for one arm: solves the arm onto `destination` with the elbow bent toward
   * the hint, then blends that solution in from the pose the arm already has by
   * `influence`, joint by joint, so weight 0 is the clip exactly and a light pose moves
   * every joint only a little.
   */
  const poseArm = (arm: Arm, destination: THREE.Vector3, influence = 1) => {
    if (influence <= 0) return;
    const root = arm.upper.getWorldPosition(new THREE.Vector3());
    const elbow = arm.forearm.getWorldPosition(new THREE.Vector3());
    const l1 = root.distanceTo(elbow), l2 = elbow.distanceTo(arm.hand.getWorldPosition(new THREE.Vector3()));
    if (l1 < .001 || l2 < .001) return;
    reached.set(arm, Math.max(reached.get(arm) ?? 0, influence));
    const before = [arm.upper.quaternion.clone(), arm.forearm.quaternion.clone()];
    const direction = destination.clone().sub(root);
    const d = THREE.MathUtils.clamp(direction.length(), Math.abs(l1 - l2) + .001, l1 + l2 - .001);
    direction.normalize();
    const target = root.clone().addScaledVector(direction, d);
    const bend = new THREE.Vector3(arm.side, -.15, -.5).transformDirection(actor.matrixWorld);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const along = (l1 * l1 + d * d - l2 * l2) / (2 * d);
    const elbowTarget = root.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    rotateToward(arm.upper, arm.forearm, elbowTarget);
    rotateToward(arm.forearm, arm.hand, target);
    if (influence >= 1) return;
    arm.upper.quaternion.copy(before[0].slerp(arm.upper.quaternion, influence));
    arm.forearm.quaternion.copy(before[1].slerp(arm.forearm.quaternion, influence));
    arm.upper.updateWorldMatrix(false, true);
  };
  /** Sets each posed arm's shoulder correctives from its upper arm's elevation, blended over the mixer's by the arm's IK weight. */
  const shoulders = () => {
    const influences = shirt?.morphTargetInfluences;
    if (!influences) return;
    const down = new THREE.Vector3(0, -1, 0).transformDirection(actor.matrixWorld);
    for (const [arm, weight] of reached) {
      const upper = arm.forearm.getWorldPosition(new THREE.Vector3()).sub(arm.upper.getWorldPosition(new THREE.Vector3()));
      const degrees = THREE.MathUtils.radToDeg(upper.angleTo(down));
      arm.volumes.forEach((slot, index) => {
        // Piecewise linear between neighbouring shapes: each peaks at its own angle; the first rises from
        // the 22.5 degrees the clips' arms hang at, the last holds on to straight up.
        const peak = 45 * (index + 1);
        const value = index === SHOULDER_ANGLES.length - 1 ? THREE.MathUtils.clamp((degrees - 135) / 45, 0, 1)
          : Math.max(0, 1 - Math.abs(degrees - peak) / (index === 0 && degrees < peak ? 22.5 : 45));
        if (!mixerVolumes.has(slot)) mixerVolumes.set(slot, influences[slot]);
        influences[slot] = THREE.MathUtils.lerp(mixerVolumes.get(slot)!, value, weight);
      });
    }
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
          const weight = frame.phase === 'pickup-ball' ? smooth(frame.progress * ACTIVITY_CONFIG.pickup / HAND_RAMP)
            : frame.phase === 'return-ball' ? 1 - smooth(1 + (frame.progress - 1) * ACTIVITY_CONFIG.return / HAND_RAMP) : 1;
          poseArm(arm, contact, weight);
        }
      }
      if (holdingBook) {
        const centre = book.object.getWorldPosition(new THREE.Vector3());
        for (const arm of arms) {
          const offset = new THREE.Vector3(arm.side * (open ? .23 : .14), -.015, 0).applyQuaternion(actor.getWorldQuaternion(new THREE.Quaternion()));
          const weight = frame.phase === 'pickup-book' ? smooth(frame.progress * ACTIVITY_CONFIG.pickup / HAND_RAMP)
            : frame.phase === 'return-book' ? 1 - smooth(1 + (frame.progress - 1) * ACTIVITY_CONFIG.return / HAND_RAMP) : 1;
          poseArm(arm, centre.clone().add(offset), weight);
        }
        if (head && open) { save(head); head.rotateX(.18); }
      }
      shoulders();
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
        // Hands on the afro's sides with the elbows bent, well inside his reach.
        hands(AFRO_SPREAD, () => 0);
      } else if (kind === 'point') {
        // The arm on the target's side reaches most of the way toward it; he looks there too.
        const side = Math.sign(reach.clone().sub(actor.getWorldPosition(new THREE.Vector3())).dot(across)) || -1;
        const arm = arms.find((entry) => entry.side === side);
        if (arm) {
          const shoulder = arm.upper.getWorldPosition(new THREE.Vector3()), elbow = arm.forearm.getWorldPosition(new THREE.Vector3());
          const length = shoulder.distanceTo(elbow) + elbow.distanceTo(arm.hand.getWorldPosition(new THREE.Vector3()));
          poseArm(arm, reach.clone().sub(shoulder).setLength(length * POINT_REACH).add(shoulder), weight);
        }
        look(.6);
      } else if (kind === 'stomp') {
        // Right knee up and out, so it reads even from the front camera; the scene drops the weight to zero for the slam.
        if (!thigh || !shin || !foot) return;
        const down = new THREE.Vector3(0, -1, 0).transformDirection(actor.matrixWorld);
        const forward = new THREE.Vector3(0, 0, 1).transformDirection(actor.matrixWorld);
        const hip = thigh.getWorldPosition(new THREE.Vector3()), knee = shin.getWorldPosition(new THREE.Vector3());
        const thighLength = hip.distanceTo(knee), shinLength = knee.distanceTo(foot.getWorldPosition(new THREE.Vector3()));
        const raisedKnee = hip.addScaledVector(down, thighLength * .15).addScaledVector(forward, thighLength * .35).addScaledVector(across, -thighLength * .6);
        rotateToward(thigh, shin, knee.lerp(raisedKnee, weight));
        const raised = shin.getWorldPosition(new THREE.Vector3()).addScaledVector(down, shinLength);
        rotateToward(shin, foot, foot.getWorldPosition(new THREE.Vector3()).lerp(raised, weight));
      } else {
        hands(.12, () => .04 * Math.sin(time * 7));
        look(.5);
      }
      shoulders();
      model.updateWorldMatrix(false, true);
    },
    face(target, weight) {
      if (disposed || weight <= 0 || !head) return;
      actor.updateWorldMatrix(true, true);
      const from = head.getWorldPosition(new THREE.Vector3());
      const facing = actor.getWorldQuaternion(new THREE.Quaternion());
      const local = target.clone().sub(from).applyQuaternion(facing.clone().invert());
      // Up to about 85° to either side, split over neck and head; tilting up a little and barely down.
      const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.48, 1.48);
      const pitch = THREE.MathUtils.clamp(Math.atan2(local.y, Math.hypot(local.x, local.z)), -.15, .3);
      const aim = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(facing).multiplyScalar(10).add(from);
      for (const [bone, share] of [[neck, .4], [head, .6]] as const) {
        if (!bone) continue;
        const earlier = overlays.find((entry) => entry.bone === bone);
        if (earlier) { bone.quaternion.slerp(earlier.quaternion, weight); bone.updateWorldMatrix(false, true); }
        turnToward(bone, aim, share * weight);
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
