import {
  PropertyBinding,
  type AnimationClip,
  type Interpolant,
  type KeyframeTrack,
  type Mesh,
  type Object3D,
} from "three";

export type FaceFrame = {
  /** Eyelid closure, 0 (open) to 1 (closed). */
  blink: number;
  /** Expression envelope, 0 to 1. Internally capped to a subtle talk blend. */
  mouth: number;
  /** Elapsed seconds; the authored talk clip is sampled in a loop. */
  time: number;
  /** Enable only while idle or greeting, not during locomotion. */
  active: boolean;
};

export type FaceLayer = { apply(frame: FaceFrame): void };

// Keep the underlying idle / greeting expression clearly dominant.
const MAX_TALK_BLEND = 0.45;
const MOUTH_NAME = /^FACE2_mouth_(cavity|teeth|tongue)(?:_\d+)?$/;
const EYE_NAME = /^FACE2_(eye_white|eyelid|pupil)_[LR](?:_\d+)?$/;
const weight = (value: number, fallback = 0) => Number.isFinite(value)
  ? Math.max(0, Math.min(1, value)) : fallback;

type MorphMesh = Mesh & {
  morphTargetInfluences: number[];
  morphTargetDictionary: Record<string, number>;
};

type Target = {
  mesh: MorphMesh;
  indices: number[];
  baseline: number[];
  applied: number[];
  hasApplied: boolean;
  sampler?: Interpolant;
};

// Three / GLTFLoader provide this factory at runtime, but @types/three omits
// the dynamically assigned method. Use it to preserve authored interpolation.
type SamplableTrack = KeyframeTrack & {
  createInterpolant: ((result?: Float32Array) => Interpolant) & {
    isInterpolantFactoryMethodGLTFCubicSpline?: boolean;
  };
};

function isMorphMesh(node: Object3D): node is MorphMesh {
  const mesh = node as MorphMesh;
  return mesh.isMesh === true && Array.isArray(mesh.morphTargetInfluences)
    && !!mesh.morphTargetDictionary;
}

function makeTarget(mesh: MorphMesh, indices: number[], sampler?: Interpolant): Target {
  return {
    mesh, indices, sampler,
    baseline: mesh.morphTargetInfluences.map((value) => weight(value)),
    applied: Array(mesh.morphTargetInfluences.length).fill(0),
    hasApplied: false,
  };
}

/**
 * A small, non-additive face pass for Good Vibes. Call AFTER mixer.update(dt),
 * every frame (including inactive frames). No mixer actions or clips are edited.
 *
 * Mouth pose includes ALL baked SURFACE_* correction weights from 05_Talk;
 * driving the Talk target alone breaks this model's mouth geometry. Only the
 * three known mouth meshes and six known eye meshes may be modified. Shirt
 * shoulder correctives, brows, bones and HappyEyes remain the mixer's property.
 */
export function createFaceLayer(model: Object3D, clips: readonly AnimationClip[]): FaceLayer {
  const eyes: Target[] = [];
  const mouths: Target[] = [];
  const mouthMeshes = new Set<MorphMesh>();
  model.traverse((node) => {
    if (!isMorphMesh(node)) return;
    const name = PropertyBinding.sanitizeNodeName(node.name);
    if (MOUTH_NAME.test(name) && Number.isInteger(node.morphTargetDictionary.Talk)) {
      mouthMeshes.add(node);
    } else if (EYE_NAME.test(name)) {
      const indices = Object.entries(node.morphTargetDictionary)
        .filter(([name, index]) => /^Blink\.[LR]$/.test(name) && Number.isInteger(index)
          && index >= 0 && index < node.morphTargetInfluences.length)
        .map(([, index]) => index);
      if (indices.length) eyes.push(makeTarget(node, [...new Set(indices)]));
    }
  });

  const talk = clips.find((clip) => clip.name === "05_Talk");
  if (talk) {
    for (const track of talk.tracks) {
      let path: ReturnType<typeof PropertyBinding.parseTrackName>;
      try { path = PropertyBinding.parseTrackName(track.name); } catch { continue; }
      if (path.propertyName !== "morphTargetInfluences" || path.propertyIndex !== undefined
        || path.objectName !== undefined) continue;
      // Resolve the actual Three binding, including sanitized names / UUIDs,
      // rather than guessing a glTF node name from a substring of a track.
      const node = PropertyBinding.findNode(model, path.nodeName) as Object3D | null;
      if (!node || !isMorphMesh(node) || !mouthMeshes.has(node)) continue;
      const source = track as SamplableTrack;
      if (typeof source.createInterpolant !== "function" || !source.times.length) continue;
      const size = node.morphTargetInfluences.length;
      const stride = source.getValueSize()
        / (source.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline ? 3 : 1);
      // Never apply a partial vector: its missing correctives could tear seams.
      if (stride !== size || !size) continue;
      const sampler = source.createInterpolant(new Float32Array(size));
      mouths.push(makeTarget(node, Array.from({ length: size }, (_, index) => index), sampler));
      mouthMeshes.delete(node);
    }
  }

  const targets = [...mouths, ...eyes];
  const duration = talk && Number.isFinite(talk.duration) && talk.duration > 0 ? talk.duration : 0;

  return {
    apply({ blink, mouth, time, active }) {
      const closure = weight(blink);
      const amount = weight(mouth) * MAX_TALK_BLEND;
      const seconds = Number.isFinite(time) ? time : 0;
      const phase = duration ? ((seconds % duration) + duration) % duration : 0;

      for (const target of targets) {
        const values = target.mesh.morphTargetInfluences;
        if (values.length !== target.baseline.length) continue;
        const stillOurPose = target.hasApplied
          && values.every((value, index) => value === target.applied[index]);

        // PropertyMixer skips writes when its animation result has not changed.
        // Do not mistake our previous overlay for a new animated baseline.
        if (!stillOurPose) {
          for (let index = 0; index < values.length; index += 1) {
            target.baseline[index] = weight(values[index]);
          }
        }

        if (!active) {
          // Usually the mixer already replaced the expression. If a constant
          // track skipped its write, remove only our own stale overlay once.
          if (stillOurPose) {
            for (const index of target.indices) values[index] = target.baseline[index];
          }
          target.hasApplied = false;
          continue;
        }

        const pose = target.sampler?.evaluate(phase);
        for (const index of target.indices) {
          const base = target.baseline[index];
          values[index] = pose
            ? base + (weight(pose[index], base) - base) * amount
            : base + (1 - base) * closure;
        }
        for (let index = 0; index < values.length; index += 1) target.applied[index] = values[index];
        target.hasApplied = true;
      }
    },
  };
}
