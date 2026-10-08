import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { CHARACTER_CONFIG } from '@/lib/character/controller';
import { corpus } from '@/lib/corpus';
import { worldContent } from '@/lib/character/world-content';
import { createBedroom } from '../bedroom';
import type { Vec3, WorldArea } from '../types';

const content = worldContent(corpus);
const R = CHARACTER_CONFIG.radius;
// The scene's default camera: high and in front of the open edge.
const camera = new THREE.Vector3(0, 4.7, 11.5);
const downward = new THREE.Vector3(0, -1, 0);
const down = (p: Vec3) => new THREE.Raycaster(new THREE.Vector3(p.x, p.y, p.z), downward);
const hitBelow = (area: WorldArea, p: Vec3) => { area.group.updateMatrixWorld(true); return down(p).intersectObject(area.group, true)[0]; };
const station = (area: WorldArea, id: string) => area.stations.find((entry) => entry.id === id)!;
const clearance = (area: WorldArea, p: { x: number; z: number }) => Math.min(...area.obstacles.map((o) => Math.hypot(p.x - o.x, p.z - o.z) - o.radius));
// controller.ts confines the character centre to bounds inset by its radius.
const insideInset = (area: WorldArea, p: { x: number; z: number }) => p.x >= area.bounds.minX + R && p.x <= area.bounds.maxX - R && p.z >= area.bounds.minZ + R && p.z <= area.bounds.maxZ - R;
const named = <T extends THREE.Object3D>(area: WorldArea, name: string) => area.group.getObjectByName(name) as T;
const run = (stationId: string | null, read: (area: WorldArea) => number, seconds = 2) => {
  const area = createBedroom(new THREE.Vector3(), content);
  const states = [read(area)];
  for (let frame = 1; frame <= seconds * 30; frame++) {
    area.update(1 / 30, frame / 30, { stationId, progress: frame / (seconds * 30) });
    states.push(read(area));
  }
  area.dispose();
  return states;
};
const changes = (states: number[]) => states.slice(1).filter((value, i) => value !== states[i]).length;
const colours = (name: string) => (a: WorldArea) => Array.from(named<THREE.InstancedMesh>(a, name).instanceColor!.array)
  .reduce((hash, value) => (hash * 31 + Math.round(value * 255)) | 0, 7);

describe('createBedroom', () => {
  let area: WorldArea;
  beforeEach(() => { stubCanvas2d(); area = createBedroom(new THREE.Vector3(), content); });
  afterEach(() => { area.dispose(); vi.restoreAllMocks(); });

  it('stays inside the contract extents with the slab as its lowest point, within budget', () => {
    const box = new THREE.Box3().setFromObject(area.group, true);
    expect(box.min.x).toBeGreaterThanOrEqual(-7); expect(box.max.x).toBeLessThanOrEqual(7);
    expect(box.min.z).toBeGreaterThanOrEqual(-4.5); expect(box.max.z).toBeLessThanOrEqual(4.5);
    expect(box.max.y).toBeLessThanOrEqual(7);
    expect(box.min.y).toBeCloseTo(-0.6, 3);
    let triangles = 0; let draws = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const geometry = node.geometry as THREE.BufferGeometry;
      draws++; triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    expect(triangles).toBeLessThanOrEqual(45_000);
    expect(draws).toBeLessThanOrEqual(40);
    const next = createBedroom(new THREE.Vector3(16, 0, 0), content);
    expect(next.group.position.toArray()).toEqual([16, 0, 0]);
    next.dispose();
  });

  it('is a house with about twice the wave-1 bedroom floor (9.5 by 5.4)', () => {
    const { minX, maxX, minZ, maxZ } = area.bounds;
    expect((maxX - minX) * (maxZ - minZ)).toBeGreaterThanOrEqual(1.8 * 9.5 * 5.4);
  });

  it('places every home station where the character can arrive and face its object', () => {
    expect(area.id).toBe('home');
    expect(Object.fromEntries(area.stations.map((s) => [s.id, s.kind]))).toEqual({ desk: 'type', printer: 'watch', rack: 'tinker', ball: 'ball', bed: 'read' });
    for (const s of area.stations) {
      expect(insideInset(area, s.stand), s.id).toBe(true);
      expect(clearance(area, s.stand), s.id).toBeGreaterThanOrEqual(R);
      expect(s.label.length, s.id).toBeGreaterThan(0);
    }
    for (const s of area.stations.filter((entry) => ['type', 'watch', 'tinker'].includes(entry.kind))) {
      const dx = s.reach.x - s.stand.x; const dz = s.reach.z - s.stand.z; const distance = Math.hypot(dx, dz);
      expect(distance, s.id).toBeGreaterThanOrEqual(0.35); expect(distance, s.id).toBeLessThanOrEqual(0.8);
      expect(s.reach.y, s.id).toBeGreaterThanOrEqual(0.75); expect(s.reach.y, s.id).toBeLessThanOrEqual(1.65);
      expect((Math.sin(s.heading) * dx + Math.cos(s.heading) * dz) / distance, s.id).toBeGreaterThan(0.9);
    }
    expect(insideInset(area, area.entry)).toBe(true);
    expect(clearance(area, area.entry)).toBeGreaterThanOrEqual(R);
    expect(area.entry.z).toBeGreaterThan(area.bounds.maxZ - 0.8);
  });

  it('leaves a clear run from the back door to the front centre', () => {
    // Only the floor, rugs and the doormat lie in the corridor the intro runs him down.
    for (let z = area.bounds.minZ; z <= area.bounds.maxZ + 0.3; z += 0.25) {
      for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) expect(hitBelow(area, { x, y: 6, z }).point.y, `${x},${z}`).toBeLessThanOrEqual(0.06);
    }
    for (const o of area.obstacles) expect(Math.abs(o.x) - o.radius, o.id).toBeGreaterThanOrEqual(R);
  });

  it('hinges a back door that swings out toward -z and frames the town behind it', () => {
    const door = named<THREE.Group>(area, 'back-door');
    expect(door.rotation.y).toBe(0);
    const through = () => { area.group.updateMatrixWorld(true); return new THREE.Raycaster(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1)).intersectObject(area.group, true)[0]; };
    expect(through()?.object.parent).toBe(door);
    expect(through()!.point.z).toBeLessThan(-3.9);
    door.rotation.y = Math.PI / 2;
    expect(through()).toBeUndefined();
    area.group.updateMatrixWorld(true);
    const open = new THREE.Box3().setFromObject(door);
    expect(open.max.z).toBeLessThanOrEqual(-3.95);
    expect(area.pick(new THREE.Raycaster(camera.clone(), new THREE.Vector3(0.2, 1.5, -4.1).sub(camera).normalize()))).toBeNull();
  });

  it.each([
    ['desk', { x: -5.46, y: 0.8, z: -2.98 }], // MacBook keyboard
    ['printer', { x: 2.9, y: 0.35, z: -3.35 }], // printer cabinet door
    ['printer', { x: 3.02, y: 0.8, z: -3.36 }], // printer status screen
    ['rack', { x: 5.75, y: 1.2, z: -3.15 }], // a rack unit
    ['bed', { x: -3, y: 0.33, z: -3.1 }], // blanket
    ['ball', { x: -2.5, y: 0.25, z: 1.6 }], // toy basket
    [null, { x: 1.4, y: 0, z: 2.6 }], // open floor
    [null, { x: -1.6, y: 3.2, z: -3.95 }], // back wall
    [null, { x: -6.47, y: 3, z: 2 }], // side wall
  ])('picks %s for a ray at %o', (id, target) => {
    const at = new THREE.Vector3(target.x, target.y, target.z);
    expect(area.pick(new THREE.Raycaster(camera.clone(), at.sub(camera).normalize()))).toBe(id);
  });

  it.each([
    ['ball', 'ball', 'toybox', 0.15],
    ['book', 'bed', 'bed', 0.0375],
  ] as const)('rests the %s on its surface within reach of the %s stand', (prop, stationId, support, lift) => {
    const rest = area.propRests![prop];
    const s = station(area, stationId);
    expect(hitBelow(area, rest).distance).toBeCloseTo(lift, 1);
    expect(area.pick(down(rest))).toBe(stationId);
    expect(Math.hypot(rest.x - s.stand.x, rest.z - s.stand.z)).toBeLessThanOrEqual(0.8);
    // Only the furniture it lies on stands between the stand point and the prop.
    for (let t = 0; t <= 1; t += 0.05) {
      const p = { x: s.stand.x + (rest.x - s.stand.x) * t, z: s.stand.z + (rest.z - s.stand.z) * t };
      for (const o of area.obstacles) if (Math.hypot(p.x - o.x, p.z - o.z) < o.radius) expect(o.id).toBe(support);
    }
  });

  it('puts a seat at sitting height (his hip is 0.59) under the seated pelvis', () => {
    for (let frame = 1; frame <= 60; frame++) area.update(1 / 30, frame / 30, { stationId: 'desk', progress: frame / 60 });
    for (const id of ['desk', 'bed']) {
      const s = station(area, id);
      expect(s.seat, id).toBeGreaterThanOrEqual(0.3); expect(s.seat, id).toBeLessThanOrEqual(0.35);
      // 08_Sit_Relaxed puts the pelvis 0.15 behind the stand point.
      const pelvis = { x: s.stand.x - Math.sin(s.heading) * 0.15, y: s.seat! + 0.5, z: s.stand.z - Math.cos(s.heading) * 0.15 };
      expect(hitBelow(area, pelvis).point.y, id).toBeCloseTo(s.seat!, 2);
      expect(area.pick(down(pelvis)), id).toBe(id);
    }
  });

  it.each([
    ['printer', (a: WorldArea) => named<THREE.Mesh>(a, 'printer-part').scale.y, (from: number, to: number) => to - from],
    ['rack', (a: WorldArea) => named<THREE.Mesh>(a, 'rack-fan').rotation.z, (from: number, to: number) => Math.abs(to - from)],
    // Code scrolls upward: the texture window slides down and wraps.
    ['desk', (a: WorldArea) => ((named<THREE.Mesh>(a, 'macbook-screen').material as THREE.MeshBasicMaterial).map!.offset.y), (from: number, to: number) => ((from - to) % 1 + 1) % 1],
  ] as const)('keeps the %s alive ambiently and speeds it up while he uses it', (id, read, advance) => {
    const ambient = run(null, read); const active = run(id, read);
    const ambientAdvance = advance(ambient[0], ambient.at(-1)!); const activeAdvance = advance(active[0], active.at(-1)!);
    expect(ambientAdvance).toBeGreaterThan(0);
    expect(activeAdvance).toBeGreaterThan(2.5 * ambientAdvance);
  });

  it('switches the reading lamp on over the bed while he reads', () => {
    const glow = (a: WorldArea) => (named<THREE.Mesh>(a, 'bed-lamp-light').material as THREE.MeshBasicMaterial).opacity;
    expect(run(null, glow).at(-1)).toBeLessThan(0.05);
    expect(run('bed', glow).at(-1)).toBeGreaterThan(0.3);
  });

  it('blinks the rack LEDs deterministically, faster while he tinkers, and keeps the house alive', () => {
    const pattern = colours('rack-leds');
    const ambient = run(null, pattern); const again = run(null, pattern); const active = run('rack', pattern);
    expect(again).toEqual(ambient);
    expect(changes(ambient)).toBeGreaterThan(0);
    expect(changes(active)).toBeGreaterThan(2 * changes(ambient));
    expect(new Set(run(null, (a) => named(a, 'window-cloud').position.x, 3)).size).toBeGreaterThan(10);
    expect(changes(run(null, colours('string-lights'), 3))).toBeGreaterThan(0);
    expect(new Set(run(null, (a) => named(a, 'clock-hand').rotation.x, 3)).size).toBeGreaterThan(10);
  });

  it('disposes every geometry, material, texture and instanced buffer it created', () => {
    const scene = new THREE.Scene();
    const fresh = createBedroom(new THREE.Vector3(), content);
    scene.add(fresh.group);
    const owned = new Set<{ dispose: () => void }>();
    fresh.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      owned.add(node.geometry);
      if (node instanceof THREE.InstancedMesh) owned.add(node);
      for (const material of [node.material].flat()) {
        owned.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) owned.add(value);
      }
    });
    const spies = [...owned].map((item) => vi.spyOn(item, 'dispose'));
    expect(spies.length).toBeGreaterThan(5);
    fresh.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(fresh.group.parent).toBeNull();
  });
});
