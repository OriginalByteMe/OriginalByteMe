// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AnimationClip, AnimationMixer, Box3, Group, Mesh, NumberKeyframeTrack, Vector3,
  PropertyBinding, Texture, type Object3D,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { CharacterIdleController } from "@/lib/character/idle";
import { createFaceLayer } from "@/lib/character/face";

const MOUTH_MORPHS = ["Smile", "Talk", "Laugh", "O", "Frown"];
for (let left = 0; left < 5; left += 1) {
  for (let right = left + 1; right < 6; right += 1) MOUTH_MORPHS.push(`SURFACE_${left}_${right}`);
}
const neutral = [1, ...Array(19).fill(0)];
const talkStart = [0.2, 0.47, 0, 0.12, 0, 0.17, 0.4, 0, 0.1, 0, 0.38, 0, 0.09, 0, 0, 0.22, 0, 0, 0, 0];
const talkEnd = [0.2, 0.7, 0, 0.2, 0, 0.2, 0.5, 0, 0.16, 0, 0.56, 0, 0.16, 0, 0, 0.56, 0, 0, 0, 0];

function morphMesh(name: string, names: string[], values: number[]) {
  const mesh = new Mesh();
  mesh.name = name;
  mesh.morphTargetDictionary = Object.fromEntries(names.map((name, index) => [name, index]));
  mesh.morphTargetInfluences = [...values];
  return mesh;
}

function fixture(binding: "name" | "uuid" | "path" = "name") {
  const model = new Group();
  model.name = "Character";
  const mouths = ["cavity", "teeth", "tongue"].map((part) =>
    morphMesh(PropertyBinding.sanitizeNodeName(`FACE2 mouth ${part}`), MOUTH_MORPHS, neutral));
  const eyes = ["eye_white", "eyelid", "pupil"].flatMap((part) => ["L", "R"].map((side) =>
    morphMesh(`FACE2_${part}_${side}`, [`Blink.${side === "L" ? "R" : "L"}`, "HappyEyes"], [0, 0.25])));
  const shirt = morphMesh("Shirt_•_continuous_torso_shoulder_and_sleeve_quads",
    Array.from({ length: 8 }, (_, index) => `ShoulderVolume_${index}`), Array(8).fill(0.31));
  const brow = morphMesh("FACE2_brow_L", ["BrowRaise", "BrowSad"], [0.2, 0.4]);
  const unrelated = morphMesh("prop_with_morphs", [...MOUTH_MORPHS, "Blink.L"], [...neutral, 0.3]);
  model.add(...mouths, ...eyes, shirt, brow, unrelated);
  const targetName = (mesh: Mesh) => binding === "uuid" ? mesh.uuid
    : binding === "path" ? `Character/Face/${mesh.name}` : mesh.name;
  const tracks = mouths.map((mesh) => new NumberKeyframeTrack(
    `${targetName(mesh)}.morphTargetInfluences`, [0, 2], [...talkStart, ...talkEnd]));
  tracks.push(new NumberKeyframeTrack(`${shirt.name}.morphTargetInfluences`, [0, 2], Array(16).fill(1)));
  tracks.push(new NumberKeyframeTrack(`${unrelated.name}.morphTargetInfluences`, [0, 2], Array(42).fill(1)));
  const clips = [new AnimationClip("05_Talk", 2, tracks)];
  return { model, mouths, eyes, shirt, brow, unrelated, clips };
}

const talkAmount = (mouth: number) => {
  const unit = Math.max(0, Math.min(1, mouth / 0.6));
  return unit * unit * (3 - 2 * unit) * 0.95;
};
const closureAmount = (blink: number) => Math.min(1, blink / 0.7);
const influences = (mesh: Mesh) => mesh.morphTargetInfluences!;
const expectWeights = (values: number[]) => {
  for (const value of values) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
};

async function loadCharacter() {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    // Geometry, tracks, nodes and binding names are real; textures are irrelevant
    // to this headless structural test. This is not a visual/browser QA claim.
    loader.register((parser) => ({
      name: "face-test-textures",
      beforeRoot() {
        parser.loadTextureImage = async () => new Texture();
        return null;
      },
    }));
    const file = readFileSync(resolve(process.cwd(), "public/models/good-vibes-hero.glb"));
    return loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), "");
}

/** Only referenced vertices draw; shared GLB accessors also contain other face parts. */
function vertices(mesh: Mesh) {
  const indices = mesh.geometry.index
    ? [...new Set(mesh.geometry.index.array)]
    : Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
  return indices.map((index) => mesh.getVertexPosition(index, new Vector3()));
}

function extent(mesh: Mesh) {
  return new Box3().setFromPoints(vertices(mesh)).getSize(new Vector3());
}

describe("Good Vibes face layer", () => {
  it("blends all 20 mouth weights, including baked corrections, without touching body or brows", () => {
    const { model, mouths, eyes, shirt, brow, unrelated, clips } = fixture();
    const untouched = [shirt, brow, unrelated].map((mesh) => [...influences(mesh)]);
    const sourceValues = [...clips[0].tracks[0].values];
    const face = createFaceLayer(model, clips);
    face.apply({ active: true, blink: 0.8, mouth: 1, time: 1 });
    for (const mesh of mouths) {
      influences(mesh).forEach((value, index) => {
        const sample = (talkStart[index] + talkEnd[index]) / 2;
        expect(value).toBeCloseTo(neutral[index] + (sample - neutral[index]) * 0.95);
      });
      expect(influences(mesh)[5]).toBeGreaterThan(0);
      expect(influences(mesh)[15]).toBeGreaterThan(0);
    }
    for (const eye of eyes) expect(influences(eye)).toEqual([1, 0]);
    [shirt, brow, unrelated].forEach((mesh, index) => expect(influences(mesh)).toEqual(untouched[index]));
    expect([...clips[0].tracks[0].values]).toEqual(sourceValues);
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });

  it.each(["name", "uuid", "path"] as const)("resolves actual Three %s bindings", (binding) => {
    const { model, mouths, clips } = fixture(binding);
    createFaceLayer(model, clips).apply({ active: true, blink: 0, mouth: 1, time: 0 });
    for (const mesh of mouths) expect(influences(mesh)[1]).toBeCloseTo(talkStart[1] * 0.95);
  });

  it("does not accumulate over repeated applications and restores a zero envelope", () => {
    const { model, mouths, eyes, clips } = fixture();
    const face = createFaceLayer(model, clips);
    const frame = { active: true, blink: 0.4, mouth: 0.5, time: 0.75 };
    face.apply(frame);
    const first = [...mouths, ...eyes].map((mesh) => [...influences(mesh)]);
    for (let index = 0; index < 200; index += 1) face.apply(frame);
    [...mouths, ...eyes].forEach((mesh, index) => expect(influences(mesh)).toEqual(first[index]));
    face.apply({ ...frame, blink: 0, mouth: 0 });
    for (const mesh of mouths) expect(influences(mesh)).toEqual(neutral);
    for (const eye of eyes) expect(influences(eye)).toEqual([0, 0.25]);
  });

  it("handles AnimationMixer's skipped constant writes and leaves no stale pose when disabled", () => {
    const { model, mouths, eyes, clips } = fixture();
    const targets = [...mouths, ...eyes];
    const idle = new AnimationClip("01_Idle_Breathe", 2, targets.map((mesh) =>
      new NumberKeyframeTrack(`${mesh.name}.morphTargetInfluences`, [0, 2],
        [...influences(mesh), ...influences(mesh)])));
    const mixer = new AnimationMixer(model);
    mixer.clipAction(idle).play();
    const face = createFaceLayer(model, [...clips, idle]);
    for (let index = 0; index < 200; index += 1) {
      mixer.update(1 / 60);
      face.apply({ active: true, blink: 0.8, mouth: 0.5, time: 0 });
      expect(influences(mouths[0])[1]).toBeCloseTo(talkStart[1] * talkAmount(0.5));
      expect(influences(eyes[0])[0]).toBe(1);
    }
    mixer.update(1 / 60);
    face.apply({ active: false, blink: 1, mouth: 1, time: 0 });
    for (const mesh of mouths) expect(influences(mesh)).toEqual(neutral);
    for (const eye of eyes) expect(influences(eye)).toEqual([0, 0.25]);
    mixer.stopAllAction();
  });

  it("blends from a fresh mixer pose and does not overwrite fresh locomotion weights when inactive", () => {
    const { model, mouths, eyes, clips } = fixture();
    const face = createFaceLayer(model, clips);
    face.apply({ active: true, blink: 1, mouth: 1, time: 1 });
    for (const mesh of mouths) influences(mesh).fill(0.12);
    for (const eye of eyes) influences(eye).splice(0, 2, 0.2, 0.35);
    face.apply({ active: true, blink: 0.5, mouth: 0.5, time: 0 });
    expect(influences(mouths[0])[1]).toBeCloseTo(0.12 + (talkStart[1] - 0.12) * talkAmount(0.5));
    expect(influences(eyes[0])[0]).toBeCloseTo(0.2 + 0.8 * closureAmount(0.5));
    expect(influences(eyes[0])[1]).toBeCloseTo(0.35 * (1 - closureAmount(0.5)));
    for (const mesh of mouths) influences(mesh).fill(0.07);
    for (const eye of eyes) influences(eye).splice(0, 2, 0.1, 0.7);
    face.apply({ active: false, blink: 1, mouth: 1, time: 0 });
    for (const mesh of mouths) expect(influences(mesh)).toEqual(Array(20).fill(0.07));
    for (const eye of eyes) expect(influences(eye)).toEqual([0.1, 0.7]);
  });

  it("samples deterministically in seconds, with positive and negative loop wrapping", () => {
    const { model, mouths, clips } = fixture();
    const face = createFaceLayer(model, clips);
    face.apply({ active: true, blink: 0, mouth: 1, time: 0.5 });
    const first = [...influences(mouths[0])];
    for (const time of [2.5, 100.5, -1.5]) {
      face.apply({ active: true, blink: 0, mouth: 1, time });
      expect(influences(mouths[0])).toEqual(first);
    }
  });

  it("ignores missing, partial, indexed, and unrelated mouth tracks safely", () => {
    for (const mode of ["missing", "partial", "indexed", "unrelated"] as const) {
      const { model, mouths, eyes, clips } = fixture();
      const tracks = mode === "missing" ? [] : mouths.map((mesh) => new NumberKeyframeTrack(
        `${mesh.name}.${mode === "unrelated" ? "position" : "morphTargetInfluences"}${mode === "indexed" ? "[Talk]" : ""}`,
        [0, 1], [0, 1]));
      clips[0].tracks = tracks;
      const face = createFaceLayer(model, mode === "missing" ? [] : clips);
      expect(() => face.apply({ active: true, blink: 0.5, mouth: 1, time: 0.4 })).not.toThrow();
      for (const mesh of mouths) expect(influences(mesh)).toEqual(neutral);
      for (const eye of eyes) expect(influences(eye)).toEqual([closureAmount(0.5), 0.25 * (1 - closureAmount(0.5))]);
    }
  });

  it("bounds malformed envelopes and nonfinite sampled weights without NaN propagation", () => {
    const { model, mouths, eyes, clips } = fixture();
    clips[0].tracks[0].values[1] = NaN;
    clips[0].tracks[0].values[2] = Infinity;
    influences(mouths[0])[3] = NaN;
    const face = createFaceLayer(model, clips);
    for (const input of [-10, 10, NaN, Infinity, -Infinity]) {
      face.apply({ active: true, blink: input, mouth: input, time: input });
      for (const mesh of [...mouths, ...eyes]) expectWeights(influences(mesh));
    }
  });

  it("integrates with the shipped compressed GLB, preserving its shirt and full mouth correction vectors", async () => {
    const gltf = await loadCharacter();
    const talk = gltf.animations.find((clip) => clip.name === "05_Talk")!;
    const idle = gltf.animations.find((clip) => clip.name === "01_Idle_Breathe")!;
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(idle).play();
    mixer.update(0.63);
    const untouched = new Map<Object3D, number[]>();
    gltf.scene.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.morphTargetInfluences && !/^FACE2_(mouth|eye_white|eyelid|pupil)_/.test(mesh.name)) {
        untouched.set(mesh, [...mesh.morphTargetInfluences]);
      }
    });
    const mouths = ["cavity", "teeth", "tongue"].map((part) => gltf.scene.getObjectByName(`FACE2_mouth_${part}`) as Mesh);
    const baselines = mouths.map((mesh) => [...influences(mesh)]);
    const face = createFaceLayer(gltf.scene, gltf.animations);
    face.apply({ active: true, blink: 0.85, mouth: 0.7, time: 1.125 });
    mouths.forEach((mesh, meshIndex) => {
      expect(influences(mesh)).toHaveLength(20);
      const track = talk.tracks.find((track) => track.name === `${mesh.name}.morphTargetInfluences`)!;
      const sample = track.InterpolantFactoryMethodLinear().evaluate(1.125);
      influences(mesh).forEach((value, index) => {
        const base = baselines[meshIndex][index];
        expect(value).toBeCloseTo(base + (sample[index] - base) * talkAmount(0.7), 7);
      });
      expectWeights(influences(mesh));
    });
    for (const [mesh, before] of untouched) expect(influences(mesh as Mesh)).toEqual(before);
    expect(untouched.size).toBe(3); // Both brows plus the shirt's eight shoulder correctives.
    for (const part of ["eye_white", "eyelid", "pupil"]) {
      for (const side of ["L", "R"]) {
        const mesh = gltf.scene.getObjectByName(`FACE2_${part}_${side}`) as Mesh;
        expect(influences(mesh)[0]).toBeGreaterThanOrEqual(0.85);
      }
    }
    mixer.stopAllAction();
  });

  it("gives real indexed mouth geometry a readable open/closed silhouette after mixer updates", async () => {
    const gltf = await loadCharacter();
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations.find((clip) => clip.name === "01_Idle_Breathe")!).play();
    mixer.update(0.63);
    gltf.scene.updateMatrixWorld(true);
    const mouth = gltf.scene.getObjectByName("FACE2_mouth_cavity") as Mesh;
    const rest = vertices(mouth);
    const restExtent = extent(mouth);
    const face = createFaceLayer(gltf.scene, gltf.animations);

    // Both frames use a normal 0.6 speech pulse, not a test-only oversized input.
    mixer.update(0);
    face.apply({ active: true, blink: 0, mouth: 0.6, time: 0.1 });
    const openExtent = extent(mouth);
    const displacement = Math.max(...vertices(mouth).map((p, i) => p.distanceTo(rest[i])));
    expect(displacement).toBeGreaterThan(0.08);
    expect(openExtent.x).toBeLessThan(restExtent.x * 0.72);
    mixer.update(0); // Constant morph tracks intentionally skip this write.
    face.apply({ active: true, blink: 0, mouth: 0.6, time: 2 });
    const closedExtent = extent(mouth);
    expect(openExtent.y / closedExtent.y).toBeGreaterThan(1.85);

    face.apply({ active: false, blink: 0, mouth: 0, time: 2 });
    vertices(mouth).forEach((p, index) => expect(p.distanceTo(rest[index])).toBeLessThan(1e-10));
    mixer.stopAllAction();
  });

  it("fully closes the shipped eyes at 30fps without adding HappyEyes twice", async () => {
    const gltf = await loadCharacter();
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations.find((clip) => clip.name === "02_Wave_Hello")!).play();
    mixer.update(0.5);
    gltf.scene.updateMatrixWorld(true);
    const eyes = ["eye_white", "pupil"].flatMap((part) => ["L", "R"].map((side) =>
      gltf.scene.getObjectByName(`FACE2_${part}_${side}`) as Mesh));
    const openSizes = eyes.map((mesh) => {
      influences(mesh).splice(0, 2, 0, 0);
      return extent(mesh);
    });
    // The two targets share their white/pupil collapse. Their sum must not
    // exceed one, including when blinking during a happy greeting expression.
    for (const mesh of eyes) influences(mesh).splice(0, 2, 0, 0.45);
    const face = createFaceLayer(gltf.scene, gltf.animations);
    face.apply({ active: true, blink: 0.75, mouth: 0, time: 0 });
    eyes.forEach((mesh, index) => {
      expect(influences(mesh)).toEqual([1, 0]);
      const size = extent(mesh);
      expect(size.x * size.y).toBeLessThan(openSizes[index].x * openSizes[index].y * 0.015);
    });
    face.apply({ active: true, blink: 0, mouth: 0, time: 0 });
    eyes.forEach((mesh) => expect(influences(mesh)).toEqual([0, 0.45]));

    const idle = new CharacterIdleController({ random: () => 0, greetingsShown: 2 });
    let fullyClosedFrames = 0;
    let reopenFrames = 0;
    for (let frame = 0; frame < 104; frame += 1) {
      mixer.update(1 / 30);
      const state = idle.tick(1 / 30, true);
      face.apply({ active: true, blink: state.blink, mouth: 0, time: frame / 30 });
      if (influences(eyes[0])[0] === 1) fullyClosedFrames += 1;
      if (frame > 99 && influences(eyes[0])[0] === 0) reopenFrames += 1;
    }
    expect(fullyClosedFrames).toBeGreaterThanOrEqual(1);
    expect(reopenFrames).toBeGreaterThan(0);
    mixer.stopAllAction();
  });

  it("keeps rendered mouth vertices within the complete corrected authored pose blend", async () => {
    const gltf = await loadCharacter();
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations.find((clip) => clip.name === "01_Idle_Breathe")!).play();
    mixer.update(0.63);
    gltf.scene.updateMatrixWorld(true);
    const talk = gltf.animations.find((clip) => clip.name === "05_Talk")!;
    const mouths = ["cavity", "teeth", "tongue"].map((part) =>
      gltf.scene.getObjectByName(`FACE2_mouth_${part}`) as Mesh);
    const baselineWeights = mouths.map((mesh) => [...influences(mesh)]);
    const baselineVertices = mouths.map(vertices);
    const times = [0, 0.1, 1.125, 2, 3.2];
    const authored = times.map((time) => mouths.map((mesh) => {
      const track = talk.tracks.find((track) => track.name === `${mesh.name}.morphTargetInfluences`)!;
      influences(mesh).splice(0, 20, ...track.InterpolantFactoryMethodLinear().evaluate(time));
      return vertices(mesh);
    }));
    mouths.forEach((mesh, index) => influences(mesh).splice(0, 20, ...baselineWeights[index]));
    const face = createFaceLayer(gltf.scene, gltf.animations);
    times.forEach((time, frame) => {
      mixer.update(0);
      face.apply({ active: true, blink: 0, mouth: 0.6, time });
      mouths.forEach((mesh, meshIndex) => {
        vertices(mesh).forEach((point, vertex) => {
          const expected = baselineVertices[meshIndex][vertex].clone()
            .lerp(authored[frame][meshIndex][vertex], 0.95);
          expect(point.distanceTo(expected)).toBeLessThan(1e-8);
        });
      });
    });
    mixer.stopAllAction();
  });

});
