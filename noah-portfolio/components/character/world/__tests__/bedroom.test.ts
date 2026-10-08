import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { CHARACTER_CONFIG } from '@/lib/character/controller';
import type { WorldContent } from '@/lib/character/world-content';
import { createBedroom } from '../bedroom';
import type { Vec3, WorldArea } from '../types';

const content: WorldContent = { projects: [], skills: [], headline: '', location: '', career: [], funFacts: [] };
const R = CHARACTER_CONFIG.radius;
/** The scene looks at view.center from direction (0, .42, 1). */
const TO_CAMERA = new THREE.Vector3(0, .42, 1).normalize();
const ray = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Raycaster(from, to.clone().sub(from).normalize());
const down = (p: Vec3) => new THREE.Raycaster(new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(0, -1, 0));
const hitBelow = (area: WorldArea, p: Vec3) => { area.group.updateMatrixWorld(true); return down(p).intersectObject(area.group, true)[0]; };
const station = (area: WorldArea, id: string) => area.stations.find((entry) => entry.id === id)!;
const clearance = (area: WorldArea, p: { x: number; z: number }) => Math.min(...area.obstacles.map((o) => Math.hypot(p.x - o.x, p.z - o.z) - o.radius));
// controller.ts confines the character centre to bounds inset by its radius.
const insideInset = (area: WorldArea, p: { x: number; z: number }) => p.x >= area.bounds.minX + R && p.x <= area.bounds.maxX - R && p.z >= area.bounds.minZ + R && p.z <= area.bounds.maxZ - R;
const named = <T extends THREE.Object3D>(area: WorldArea, name: string) => area.group.getObjectByName(name) as T;
const meshes = (root: THREE.Object3D) => { const found: THREE.Mesh[] = []; root.traverse((node) => { if (node instanceof THREE.Mesh) found.push(node); }); return found; };
/** What a visitor sees of each mesh, tagged with its station (or its name for decor). */
type Look = { owner: string; values: number[] }[];
const look = (area: WorldArea): Look => {
  area.group.updateMatrixWorld(true);
  return meshes(area.group).map((node) => {
    const material = node.material as THREE.MeshBasicMaterial;
    const instanced = node instanceof THREE.InstancedMesh ? [...node.instanceMatrix.array, ...(node.instanceColor?.array ?? [])] : [];
    return { owner: (node.userData.station as string | undefined) ?? node.name, values: [+node.visible, ...node.matrixWorld.elements, material.opacity, material.map?.offset.y ?? 0, ...instanced] };
  });
};
const changed = (a: Look, b: Look) =>
  [...new Set(a.filter((part, i) => part.values.some((value, j) => Math.abs(value - b[i].values[j]) > 1e-9)).map((part) => part.owner))].sort();
const play = (area: WorldArea, stationId: string | null, frames = 60) => {
  for (let frame = 1; frame <= frames; frame++) area.update(1 / 30, frame / 30, { stationId, progress: frame / frames });
};

describe('createBedroom', () => {
  let area: WorldArea;
  beforeEach(() => { stubCanvas2d(); area = createBedroom(new THREE.Vector3(), content); });
  afterEach(() => { area.dispose(); vi.restoreAllMocks(); });

  it('fits the island envelope at its origin in few draw calls', () => {
    const box = new THREE.Box3().setFromObject(area.group, true);
    expect(box.min.toArray().map((value, axis) => value >= [-9, -3, -6.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [9, 8, 6][axis])).toEqual([true, true, true]);
    let triangles = 0;
    const all = meshes(area.group);
    for (const node of all) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    expect(triangles).toBeLessThanOrEqual(45_000);
    expect(all.length).toBeLessThanOrEqual(40);
    const lower = createBedroom(new THREE.Vector3(0, -18, 0), content);
    expect(lower.group.position.toArray()).toEqual([0, -18, 0]);
    lower.dispose();
  });

  it('puts every station, the exit and the hop off the landing where he can stand, with the exit at the open front', () => {
    expect(area.id).toBe('bedroom');
    expect(Object.fromEntries(area.stations.map((s) => [s.id, s.kind]))).toEqual({ desk: 'type', printer: 'watch', rack: 'tinker', ball: 'ball', bed: 'read' });
    // The scene hops him down 0.9 in front of the landing.
    const hop = { x: area.landing.x, z: area.landing.z + .9 };
    for (const [id, p] of [...area.stations.map((s) => [s.id, s.stand] as const), ['exit', area.exit] as const, ['hop', hop] as const]) {
      expect(insideInset(area, p), id).toBe(true);
      expect(clearance(area, p), id).toBeGreaterThanOrEqual(R);
    }
    for (const s of area.stations.filter((entry) => ['type', 'watch', 'tinker'].includes(entry.kind))) {
      const dx = s.reach.x - s.stand.x; const dz = s.reach.z - s.stand.z; const distance = Math.hypot(dx, dz);
      expect(distance, s.id).toBeGreaterThanOrEqual(.35); expect(distance, s.id).toBeLessThanOrEqual(.8);
      expect(s.reach.y, s.id).toBeGreaterThanOrEqual(.75); expect(s.reach.y, s.id).toBeLessThanOrEqual(1.65);
      expect((Math.sin(s.heading) * dx + Math.cos(s.heading) * dz) / distance, s.id).toBeGreaterThan(.9);
    }
    expect(area.exit.z).toBeGreaterThan(area.bounds.maxZ - .8);
    // He lands on a raised top surface.
    expect(area.landing.y).toBeGreaterThan(.2);
    expect(hitBelow(area, { ...area.landing, y: area.landing.y + .5 }).point.y).toBeCloseTo(area.landing.y, 2);
  });

  it('trips him over the network cable that runs past the exit', () => {
    const position = named<THREE.Mesh>(area, 'network-cable').geometry.attributes.position;
    let nearest = Infinity;
    for (let i = 0; i < position.count; i++) nearest = Math.min(nearest, Math.hypot(position.getX(i) - area.exit.x, position.getZ(i) - area.exit.z));
    expect(nearest).toBeLessThan(.35);
  });

  it('picks the station for every part of it from the front, and nothing for floor, walls or the back door', () => {
    // Aim from in front of and above the part at its box centre (an instanced part: its first instance), else at its vertices, until the ray touches it.
    const aim = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.attributes.position, target = new THREE.Vector3(), instance = new THREE.Matrix4();
      for (let vertex = -1; vertex < position.count; vertex += 3) {
        if (vertex >= 0) mesh.localToWorld(target.fromBufferAttribute(position, vertex));
        else if (mesh instanceof THREE.InstancedMesh) { mesh.getMatrixAt(0, instance); mesh.localToWorld(target.setFromMatrixPosition(instance)); }
        else new THREE.Box3().setFromObject(mesh).getCenter(target);
        const raycaster = ray(target.clone().add(new THREE.Vector3(0, .3, 1.3)), target);
        if (raycaster.intersectObject(mesh).length) return raycaster;
      }
      throw new Error(`no ray reaches ${mesh.name}`);
    };
    area.group.updateMatrixWorld(true);
    const parts = meshes(area.group).filter((node) => typeof node.userData.station === 'string');
    expect([...new Set(parts.map((part) => part.userData.station))].sort()).toEqual(['ball', 'bed', 'desk', 'printer', 'rack']);
    for (const part of parts) expect(area.pick(aim(part)), part.name).toBe(part.userData.station);
    const { center } = area.view;
    const camera = new THREE.Vector3(center.x, center.y, center.z).addScaledVector(TO_CAMERA, 20);
    for (const target of [[1.4, 0, 2.6], [-1.6, 3.2, -3.95], [-6.47, 3, 2], [.3, 1.5, -4.05]] as const) {
      const raycaster = ray(camera, new THREE.Vector3(...target));
      expect(raycaster.intersectObject(area.group, true).length, `${target}`).toBeGreaterThan(0);
      expect(area.pick(raycaster), `${target}`).toBeNull();
    }
  });

  it.each([
    ['ball', 'ball', 'toybox', .15],
    ['book', 'bed', 'bed', .0375],
  ] as const)('rests the %s on its surface within reach of the %s stand', (prop, stationId, support, lift) => {
    const rest = area.propRests![prop];
    const s = station(area, stationId);
    expect(hitBelow(area, rest).distance).toBeCloseTo(lift, 1);
    expect(area.pick(down(rest))).toBe(stationId);
    expect(Math.hypot(rest.x - s.stand.x, rest.z - s.stand.z)).toBeLessThanOrEqual(.8);
    // Only the furniture it lies on stands between the stand point and the prop.
    for (let t = 0; t <= 1; t += .05) {
      const p = { x: s.stand.x + (rest.x - s.stand.x) * t, z: s.stand.z + (rest.z - s.stand.z) * t };
      for (const o of area.obstacles) if (Math.hypot(p.x - o.x, p.z - o.z) < o.radius) expect(o.id).toBe(support);
    }
  });

  it('puts a seat at sitting height (his hip is 0.59) under the seated pelvis', () => {
    play(area, 'desk');
    for (const id of ['desk', 'bed']) {
      const s = station(area, id);
      expect(s.seat, id).toBeGreaterThanOrEqual(.3); expect(s.seat, id).toBeLessThanOrEqual(.35);
      // 08_Sit_Relaxed puts the pelvis 0.15 behind the stand point.
      const pelvis = { x: s.stand.x - Math.sin(s.heading) * .15, y: s.seat! + .5, z: s.stand.z - Math.cos(s.heading) * .15 };
      expect(hitBelow(area, pelvis).point.y, id).toBeCloseTo(s.seat!, 2);
      expect(area.pick(down(pelvis)), id).toBe(id);
    }
  });

  it('hangs the back door in the back wall on the run line and swings it out without moving anything else', () => {
    const door = named<THREE.Object3D>(area, 'back-door');
    expect(door.rotation.y).toBe(0);
    const x0 = area.view.center.x;
    area.group.updateMatrixWorld(true);
    const wallFront = new THREE.Raycaster(new THREE.Vector3(x0, 3.5, 0), new THREE.Vector3(0, 0, -1)).intersectObject(area.group, true)[0].point.z;
    const shut = new THREE.Box3().setFromObject(door);
    expect(shut.getCenter(new THREE.Vector3()).x).toBeCloseTo(x0, 1);
    expect(shut.min.z).toBeGreaterThan(wallFront - .4); expect(shut.max.z).toBeLessThanOrEqual(wallFront);
    expect(shut.max.y - shut.min.y).toBeGreaterThan(2.6);
    // Body-height rays down the run line from the open front: the shut door stops them, the open one lets them out.
    const through = () => {
      area.group.updateMatrixWorld(true);
      return [-R, 0, R].flatMap((dx) => [.3, 1.2, 2.45].map((y) => new THREE.Raycaster(new THREE.Vector3(x0 + dx, y, area.bounds.maxZ), new THREE.Vector3(0, 0, -1)).intersectObject(area.group, true)[0]));
    };
    for (const hit of through()) {
      let node: THREE.Object3D | null = hit.object;
      while (node && node !== door) node = node.parent;
      expect(node).toBe(door);
    }
    const others = () => meshes(area.group).filter((node) => !meshes(door).includes(node)).map((node) => node.matrixWorld.toArray());
    const before = others();
    door.rotation.y = Math.PI / 2;
    expect(through()).toEqual(Array(9).fill(undefined));
    expect(others()).toEqual(before);
    expect(new THREE.Box3().setFromObject(door).max.z).toBeLessThanOrEqual(wallFront);
  });

  it('runs a flat, clear line on x = view.center.x from a stoop behind the door to the open front', () => {
    const x0 = area.view.center.x;
    const door = named<THREE.Object3D>(area, 'back-door');
    area.group.updateMatrixWorld(true);
    const doorZ = door.getWorldPosition(new THREE.Vector3()).z;
    // The stoop: floor at y 0, 1.2 wide and deep enough that the run starts 1.2 behind the door on solid ground.
    for (const dx of [-.6, 0, .6]) {
      for (const back of [.2, .45, .7, .95, 1.2, 1.45]) expect(hitBelow(area, { x: x0 + dx, y: 2, z: doorZ - back })?.point.y, `${dx}, ${back}`).toBeCloseTo(0, 3);
    }
    // With the door open only the floor, the stoop, rugs and the doormat lie under his path.
    door.rotation.y = Math.PI / 2;
    for (let z = doorZ - 1.2; z <= area.bounds.maxZ; z += .2) {
      for (const dx of [-R, 0, R]) {
        const y = hitBelow(area, { x: x0 + dx, y: 2.9, z })?.point.y;
        expect(y, `${dx}, ${z}`).toBeGreaterThanOrEqual(-.001); expect(y, `${dx}, ${z}`).toBeLessThanOrEqual(.06);
      }
    }
    for (const o of area.obstacles) expect(Math.abs(o.x - x0) - o.radius, o.id).toBeGreaterThanOrEqual(R);
  });

  it('keeps the house alive with nobody at a station', () => {
    const start = look(area);
    play(area, null, 90);
    expect(changed(start, look(area))).toEqual(expect.arrayContaining(['clock-hand', 'desk', 'printer', 'rack', 'string-lights', 'window-cloud']));
  });

  it.each([
    ['desk', ['desk']], ['printer', ['printer']], ['rack', ['rack']], ['ball', []], ['bed', ['bed-lamp-light']],
  ])('changes only what belongs to the %s while he is there', (id, owners) => {
    const busy = createBedroom(new THREE.Vector3(), content);
    play(area, null); play(busy, id);
    expect(changed(look(area), look(busy))).toEqual(owners);
    busy.dispose();
  });

  it('disposes every geometry, material, texture and instanced buffer it created', () => {
    const scene = new THREE.Scene();
    const fresh = createBedroom(new THREE.Vector3(), content);
    scene.add(fresh.group);
    const owned = new Set<{ dispose: () => void }>();
    for (const node of meshes(fresh.group)) {
      owned.add(node.geometry);
      if (node instanceof THREE.InstancedMesh) owned.add(node);
      for (const material of [node.material].flat()) {
        owned.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) owned.add(value);
      }
    }
    const spies = [...owned].map((item) => vi.spyOn(item, 'dispose'));
    expect(spies.length).toBeGreaterThan(5);
    fresh.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(fresh.group.parent).toBeNull();
  });
});
