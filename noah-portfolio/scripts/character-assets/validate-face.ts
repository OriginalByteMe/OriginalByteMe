/** Offline geometry QA, not a browser/WebGL test.
 * Run from noah-portfolio: node --import tsx scripts/character-assets/validate-face.ts /tmp/face-qa
 * Optionally render its exact influence snapshots with render-face.py and a
 * decoded copy of the same shipped GLB (see the asset rebuild README).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AnimationMixer, Box3, Mesh, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createFaceLayer } from "../../lib/character/face";

async function main() {
  const output = resolve(process.argv[2] ?? "/tmp/good-vibes-face-qa");
  mkdirSync(output, { recursive: true });
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register((parser) => ({
    name: "face-qa-textures",
    beforeRoot() { parser.loadTextureImage = async () => new Texture(); return null; },
  }));
  const file = readFileSync(resolve("public/models/good-vibes-hero.glb"));
  const gltf = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), "");
  const mixer = new AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find((clip) => clip.name === "01_Idle_Breathe")!).play();
  mixer.update(0.63);
  gltf.scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  gltf.scene.traverse((node) => { if (node instanceof Mesh && node.morphTargetInfluences) meshes.push(node); });
  const baselines = new Map(meshes.map((mesh) => [mesh, mesh.morphTargetInfluences!.slice()]));
  const positions = (mesh: Mesh) => [...new Set(mesh.geometry.index!.array)]
    .map((index) => mesh.getVertexPosition(index, new Vector3()));
  const restVertices = new Map(meshes.map((mesh) => [mesh, positions(mesh)]));
  const reset = () => meshes.forEach((mesh) => mesh.morphTargetInfluences!.splice(0, Infinity, ...baselines.get(mesh)!));
  const snapshots: object[] = [];
  const capture = (name: string, title: string) => {
    const geometry = Object.fromEntries(meshes.filter((mesh) => /^FACE2_(mouth|eye_white|pupil)/.test(mesh.name)).map((mesh) => {
      const points = positions(mesh);
      return [mesh.name, {
        indexedVertices: points.length,
        size: new Box3().setFromPoints(points).getSize(new Vector3()).toArray(),
        maximumDisplacement: Math.max(...points.map((point, i) => point.distanceTo(restVertices.get(mesh)![i]))),
      }];
    }));
    snapshots.push({ name, title, geometry, weights: Object.fromEntries(meshes.map((mesh) => [mesh.name, mesh.morphTargetInfluences!.slice()])) });
  };
  capture("neutral", "Resting smile");
  // Reproduce the previous normal speech frame for a true before/after comparison.
  const talk = gltf.animations.find((clip) => clip.name === "05_Talk")!;
  for (const mesh of meshes.filter((mesh) => mesh.name.startsWith("FACE2_mouth_"))) {
    const sample = talk.tracks.find((track) => track.name === `${mesh.name}.morphTargetInfluences`)!
      .InterpolantFactoryMethodLinear().evaluate(1.125);
    mesh.morphTargetInfluences!.forEach((_, i, values) => {
      const base = baselines.get(mesh)![i];
      values[i] = base + (sample[i] - base) * 0.6 * 0.45;
    });
  }
  capture("before-speech", "Before: speech pulse");
  reset();
  const face = createFaceLayer(gltf.scene, gltf.animations);
  for (const [name, title, blink, mouth, time] of [
    ["after-speech", "After: same speech pulse", 0, 0.6, 1.125],
    ["speech-open", "After: open phoneme", 0, 0.6, 0.1],
    ["speech-closed", "After: closed phoneme", 0, 0.6, 2],
    ["blink", "After: closed blink", 0.75, 0, 0],
  ] as const) {
    mixer.update(0); // Exercises the mixer's skipped constant-weight writes.
    face.apply({ active: true, blink, mouth, time });
    capture(name, title);
  }
  face.apply({ active: false, blink: 0, mouth: 0, time: 0 });
  const restored = meshes.every((mesh) => mesh.morphTargetInfluences!.every((value, i) => value === baselines.get(mesh)![i]));
  if (!restored) throw new Error("Face pass did not restore its mixer baseline");
  const report = { model: "public/models/good-vibes-hero.glb", sha256: createHash("sha256").update(file).digest("hex"),
    idleTime: 0.63, restored, note: "Indexed, skinned Three.js geometry after AnimationMixer; offline renders are not browser QA", snapshots };
  writeFileSync(resolve(output, "face-validation.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  mixer.stopAllAction();
}
void main();
