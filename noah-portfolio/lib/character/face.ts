import {
  PropertyBinding,
  type AnimationClip,
  type Interpolant,
  type KeyframeTrack,
  type Mesh,
  type Object3D,
} from "three";

/** Lowest priority first: each expression blends over the mixer's face and over every expression before it. */
export const EXPRESSIONS = ["focused", "sleepy", "yawn", "wink", "laugh", "surprised", "annoyed", "angry"] as const;
export type ExpressionName = (typeof EXPRESSIONS)[number];

export type FaceFrame = {
  /** Eyelid closure, 0 (open) to 1 (closed). */
  blink: number;
  /** Expression envelope, 0 to 1. Normal speech reaches about 0.6. */
  mouth: number;
  /** Elapsed seconds; the authored talk clip is sampled in a loop. */
  time: number;
  /** Enable in live scene states; disable to restore the underlying mixer pose. */
  active: boolean;
  /** Expression weights, 0 to 1. Talk and blink still layer on top of them. */
  expressions?: Readonly<Partial<Record<ExpressionName, number>>>;
};

export type FaceLayer = { apply(frame: FaceFrame): void };

// A 0.6 speech pulse previously became only 0.27 of the authored pose. Since
// the idle pose is already an open grin, that barely changed its silhouette.
// Ease the normal speech range into the complete authored mouth vector; keep
// the small (0.12) idle envelope gentle and never extrapolate beyond the asset.
const MAX_TALK_BLEND = 0.95;
const SPEECH_ENVELOPE_PEAK = 0.6;
// Give a 150–220ms blink a short fully closed hold even at the 30fps frame cap.
const BLINK_CLOSED_THRESHOLD = 0.7;
const MOUTH_NAME = /^FACE2_mouth_(cavity|teeth|tongue)(?:_\d+)?$/;
const EYE_NAME = /^FACE2_(eye_white|eyelid|pupil)_[LR](?:_\d+)?$/;
const BROW_NAME = /^FACE2_brow_[LR](?:_\d+)?$/;
const weight = (value: number, fallback = 0) => Number.isFinite(value)
  ? Math.max(0, Math.min(1, value)) : fallback;

/** Seconds of an authored clip, with all its corrective weights: laugh loops the ha-ha section, wink holds the closed eye. */
const CLIP_POSES = {
  laugh: { clip: "04_Laugh", from: 0.5, to: 2.5 },
  wink: { clip: "09_Wink", from: 0.5, to: 0.5 },
} as const;
type Part = "brow" | "eye" | "mouth";
/**
 * Hand-set expressions as morph weights per part. Every unlisted weight on that
 * part goes to zero, including Smile, HappyEyes and the SURFACE_* correctives;
 * "Blink" is the eye's own Blink.L or Blink.R. The rig has no angry brow or
 * narrowed eye: a partial Blink narrows the eyes, and negative BrowRaise and
 * BrowSad extrapolate the authored brows down and in toward the nose. Frown
 * barely reads at 1, so anger extrapolates it too. All checked in the browser:
 * none of these tears the face meshes.
 */
const POSES: Record<Exclude<ExpressionName, keyof typeof CLIP_POSES>, Record<Part, Record<string, number>>> = {
  focused: { brow: { BrowRaise: -0.3, BrowSad: -0.6 }, eye: { Blink: 0.2 }, mouth: { Frown: 0.4 } },
  sleepy: { brow: { BrowRaise: -0.2, BrowSad: 0.5 }, eye: { Blink: 0.55 }, mouth: {} },
  yawn: { brow: { BrowRaise: 0.5, BrowSad: 0.3 }, eye: { Blink: 0.8 }, mouth: { O: 1 } },
  surprised: { brow: { BrowRaise: 1 }, eye: {}, mouth: { O: 0.85 } },
  annoyed: { brow: { BrowRaise: -0.45, BrowSad: -0.9 }, eye: { Blink: 0.22 }, mouth: { Frown: 0.7 } },
  angry: { brow: { BrowRaise: -0.85, BrowSad: -1.7 }, eye: { Blink: 0.4 }, mouth: { Frown: 1.7 } },
};

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
  blinkIndices?: ReadonlySet<number>;
  /** Full-length weight vector per expression, given the frame's elapsed seconds. */
  poses: Partial<Record<ExpressionName, (seconds: number) => ArrayLike<number>>>;
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

function makeTarget(mesh: MorphMesh, part: Part, indices: number[], sampler?: Interpolant, blinkIndices?: ReadonlySet<number>): Target {
  const poses: Target["poses"] = {};
  for (const [name, pose] of Object.entries(POSES) as [keyof typeof POSES, Record<Part, Record<string, number>>][]) {
    const vector = Array(mesh.morphTargetInfluences.length).fill(0);
    for (const [morph, value] of Object.entries(pose[part])) {
      for (const index of morph === "Blink" ? blinkIndices ?? [] : [mesh.morphTargetDictionary[morph]]) {
        if (Number.isInteger(index) && index >= 0 && index < vector.length) vector[index] = value;
      }
    }
    poses[name] = () => vector;
  }
  return {
    mesh, indices, sampler, blinkIndices, poses,
    baseline: mesh.morphTargetInfluences.map((value) => weight(value)),
    applied: Array(mesh.morphTargetInfluences.length).fill(0),
    hasApplied: false,
  };
}

/** Whole-vector morph samplers from a clip, per accepted mesh. */
function samplers(model: Object3D, clip: AnimationClip | undefined, accept: (mesh: MorphMesh) => boolean) {
  const found = new Map<MorphMesh, Interpolant>();
  for (const track of clip?.tracks ?? []) {
    let path: ReturnType<typeof PropertyBinding.parseTrackName>;
    try { path = PropertyBinding.parseTrackName(track.name); } catch { continue; }
    if (path.propertyName !== "morphTargetInfluences" || path.propertyIndex !== undefined
      || path.objectName !== undefined) continue;
    // Resolve the actual Three binding, including sanitized names / UUIDs,
    // rather than guessing a glTF node name from a substring of a track.
    const node = PropertyBinding.findNode(model, path.nodeName) as Object3D | null;
    if (!node || !isMorphMesh(node) || !accept(node) || found.has(node)) continue;
    const source = track as SamplableTrack;
    if (typeof source.createInterpolant !== "function" || !source.times.length) continue;
    const size = node.morphTargetInfluences.length;
    const stride = source.getValueSize()
      / (source.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline ? 3 : 1);
    // Never apply a partial vector: its missing correctives could tear seams.
    if (stride !== size || !size) continue;
    found.set(node, source.createInterpolant(new Float32Array(size)));
  }
  return found;
}

/**
 * A non-additive face pass for Good Vibes. Call AFTER mixer.update(dt),
 * every frame (including inactive frames). No mixer actions or clips are edited.
 *
 * Mouth pose includes ALL baked SURFACE_* correction weights from 05_Talk;
 * driving the Talk target alone breaks this model's mouth geometry. Only the
 * three known mouth meshes, six known eye meshes and two brows may be modified.
 * Shirt shoulder correctives and bones remain the mixer's property, and so do
 * the brows while no expression is weighted. Expressions replace a part's whole
 * vector, then talk and blink layer on top. HappyEyes is crossfaded out only
 * during a blink: its white/pupil deformation is the same collapse as Blink, so
 * adding the two can invert the visible eye. All mixer expressions are restored
 * when the envelopes return to zero.
 */
export function createFaceLayer(model: Object3D, clips: readonly AnimationClip[]): FaceLayer {
  const targets: Target[] = [];
  const mouthMeshes = new Set<MorphMesh>();
  model.traverse((node) => {
    if (!isMorphMesh(node)) return;
    const name = PropertyBinding.sanitizeNodeName(node.name);
    const valid = (index: number) => Number.isInteger(index) && index >= 0 && index < node.morphTargetInfluences.length;
    if (MOUTH_NAME.test(name) && Number.isInteger(node.morphTargetDictionary.Talk)) {
      mouthMeshes.add(node);
    } else if (EYE_NAME.test(name)) {
      const indices = Object.entries(node.morphTargetDictionary)
        .filter(([name, index]) => /^Blink\.[LR]$/.test(name) && valid(index))
        .map(([, index]) => index);
      if (indices.length) {
        const blinkIndices = new Set(indices);
        const happy = node.morphTargetDictionary.HappyEyes;
        if (valid(happy)) indices.push(happy);
        targets.push(makeTarget(node, "eye", [...new Set(indices)], undefined, blinkIndices));
      }
    } else if (BROW_NAME.test(name)) {
      const indices = ["BrowRaise", "BrowSad"].map((morph) => node.morphTargetDictionary[morph]).filter(valid);
      if (indices.length) targets.push(makeTarget(node, "brow", indices));
    }
  });

  const talk = clips.find((clip) => clip.name === "05_Talk");
  for (const [mesh, sampler] of samplers(model, talk, (mesh) => mouthMeshes.has(mesh))) {
    targets.push(makeTarget(mesh, "mouth", Array.from({ length: mesh.morphTargetInfluences.length }, (_, index) => index), sampler));
  }
  const byMesh = new Map(targets.map((target) => [target.mesh, target]));
  for (const [name, { clip, from, to }] of Object.entries(CLIP_POSES) as [keyof typeof CLIP_POSES, (typeof CLIP_POSES)[keyof typeof CLIP_POSES]][]) {
    const span = to - from;
    for (const [mesh, sampler] of samplers(model, clips.find((each) => each.name === clip), (mesh) => byMesh.has(mesh))) {
      byMesh.get(mesh)!.poses[name] = (seconds) => sampler.evaluate(span > 0 ? from + ((seconds % span) + span) % span : from);
    }
  }

  const duration = talk && Number.isFinite(talk.duration) && talk.duration > 0 ? talk.duration : 0;

  return {
    apply({ blink, mouth, time, active, expressions }) {
      const closure = weight(weight(blink) / BLINK_CLOSED_THRESHOLD);
      const speech = weight(weight(mouth) / SPEECH_ENVELOPE_PEAK);
      const amount = speech * speech * (3 - 2 * speech) * MAX_TALK_BLEND;
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

        for (const index of target.indices) values[index] = target.baseline[index];
        for (const name of EXPRESSIONS) {
          const share = weight(expressions?.[name] ?? 0);
          const pose = share > 0 ? target.poses[name]?.(seconds) : undefined;
          if (!pose) continue;
          for (const index of target.indices) {
            if (Number.isFinite(pose[index])) values[index] += (pose[index] - values[index]) * share;
          }
        }
        const pose = target.sampler?.evaluate(phase);
        for (const index of target.indices) {
          const base = values[index];
          if (pose) values[index] = base + (weight(pose[index], base) - base) * amount;
          else if (target.blinkIndices) values[index] = base + ((target.blinkIndices.has(index) ? 1 : 0) - base) * closure;
        }
        for (let index = 0; index < values.length; index += 1) target.applied[index] = values[index];
        target.hasApplied = true;
      }
    },
  };
}
