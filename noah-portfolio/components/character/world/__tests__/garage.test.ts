import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { createCharacterState, stepCharacter } from '@/lib/character/controller';
import { worldContent, type WorldContent } from '@/lib/character/world-content';
import { loadCorpus } from '@/lib/corpus/loader';
import { createGarage } from '../garage';
import { lotOrigin } from '../town';
import type { WorldArea } from '../types';

const real = worldContent(loadCorpus().corpus);
const origin = lotOrigin(5);
const lean: WorldContent = { ...real, operatingSystems: real.operatingSystems.slice(0, 1), sideProjects: [] };
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ids = (content: WorldContent) => [
  ...content.operatingSystems.map((group) => `os:${slug(group.name)}`),
  ...content.sideProjects.map((side) => `side:${slug(side.title)}`),
];

type Load = { url: string; texture: THREE.Texture<HTMLImageElement>; onLoad?: (texture: THREE.Texture<HTMLImageElement>) => void; onError?: (error: unknown) => void };
let loads: Load[];
beforeEach(() => {
  loads = [];
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((url, onLoad, _progress, onError) => {
    const texture = new THREE.Texture<HTMLImageElement>();
    loads.push({ url, texture, onLoad, onError });
    return texture;
  });
  stubCanvas2d();
});
afterEach(() => vi.restoreAllMocks());

const flat = (point: { x: number; z: number }) => new THREE.Vector2(point.x, point.z);
const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(origin);
const ray = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Raycaster(from, to.clone().sub(from).normalize());
const station = (area: WorldArea, id: string) => area.group.getObjectByName(id)!;

describe('createGarage', () => {
  it('turns every operating system group into a machine and every side project into a gadget', () => {
    const area = createGarage(origin.clone(), real);
    expect(area.id).toBe('garage');
    expect(area.group.position.toArray()).toEqual(origin.toArray());
    expect(area.stations.map((entry) => entry.id)).toEqual(ids(real));
    expect(new Set(area.stations.map((entry) => entry.id)).size).toBe(area.stations.length);
    for (const entry of area.stations) {
      expect(entry.label.length, entry.id).toBeGreaterThan(3);
      expect(['type', 'tinker', 'watch'], entry.id).toContain(entry.kind);
      expect(station(area, entry.id), entry.id).toBeDefined();
    }
    expect(createGarage(origin.clone(), lean).stations.map((entry) => entry.id)).toEqual(ids(lean));
  });

  it.each([['the real', real], ['one machine and no gadgets', lean]])('lays out %s rig inside the lot with reachable stations he does not hide', (_, content) => {
    const area = createGarage(origin.clone(), content);
    const { bounds, obstacles } = area;
    const box = new THREE.Box3().setFromObject(area.group).translate(origin.clone().negate());
    expect(box.min.toArray().map((value, axis) => value >= [-7, -3, -4.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [7, 7, 4.5][axis])).toEqual([true, true, true]);
    expect(box.min.y).toBeLessThan(0);
    expect((bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)).toBeGreaterThan(80);

    const inset = (point: { x: number; z: number }) => point.x >= bounds.minX + .22 && point.x <= bounds.maxX - .22 && point.z >= bounds.minZ + .22 && point.z <= bounds.maxZ - .22;
    const clear = (point: { x: number; z: number }) => obstacles.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + .22);
    expect(inset(area.entry) && clear(area.entry)).toBe(true);
    expect(area.entry.z).toBeGreaterThan(bounds.maxZ - .6);
    for (const entry of area.stations) {
      expect(inset(entry.stand) && clear(entry.stand), entry.id).toBe(true);
      const ahead = flat(entry.reach).sub(flat(entry.stand));
      expect(ahead.length(), entry.id).toBeLessThanOrEqual(.85);
      expect(entry.reach.y, entry.id).toBeGreaterThanOrEqual(.85);
      expect(entry.reach.y, entry.id).toBeLessThanOrEqual(1.5);
      const facing = Math.atan2(ahead.x, ahead.y) - entry.heading;
      expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))), entry.id).toBeLessThan(.3);
      // Facing the dead-on camera to present, he stands beside his machine, not in front of it.
      const machine = new THREE.Box3().setFromObject(station(area, entry.id)).translate(origin.clone().negate()).getCenter(new THREE.Vector3());
      expect(Math.abs(machine.x - entry.stand.x), entry.id).toBeGreaterThanOrEqual(.6);
      expect(entry.seat, entry.id).toBeUndefined();

      const walker = createCharacterState({ ...area.entry });
      for (let frame = 0; frame < 1800; frame++) stepCharacter(walker, entry.stand, 1 / 60, obstacles, bounds);
      expect(Math.hypot(walker.position.x - entry.stand.x, walker.position.z - entry.stand.z), entry.id).toBeLessThan(.13);
    }
    for (const [index, a] of area.stations.entries()) for (const b of area.stations.slice(index + 1)) expect(flat(a.stand).distanceTo(flat(b.stand))).toBeGreaterThan(.8);
    const machines = area.stations.map((entry) => new THREE.Box3().setFromObject(station(area, entry.id)));
    for (const [index, machine] of machines.entries()) for (const other of machines.slice(index + 1)) expect(machine.intersectsBox(other)).toBe(false);

    let drawCalls = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      drawCalls += 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    expect(drawCalls).toBeLessThanOrEqual(120);
    expect(triangles).toBeLessThanOrEqual(30000);
  });

  it('presents every machine with sourced public facts and a Visit sign only where the side project links somewhere', () => {
    const area = createGarage(origin.clone(), real);
    for (const entry of area.stations) {
      expect(entry.present?.lines.length, entry.id).toBeGreaterThan(0);
      for (const line of entry.present!.lines) {
        expect(line.line.length, line.id).toBeGreaterThan(8);
        expect(line.source, line.id).toMatch(/^content\/about-me\/.+\.md$/);
        expect(existsSync(resolve(process.cwd(), line.source!)), line.source).toBe(true);
      }
    }
    for (const side of real.sideProjects) {
      const present = area.stations.find((entry) => entry.id === `side:${slug(side.title)}`)!.present!;
      expect(present.url).toBe(side.url ?? undefined);
      if (side.url) expect(present.linkLabel).toMatch(/\S/);
    }
    for (const group of real.operatingSystems) expect(area.stations.find((entry) => entry.id === `os:${slug(group.name)}`)!.present!.url).toBeUndefined();
    const all = area.stations.flatMap((entry) => entry.present!.lines.map((line) => line.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('hangs every system icon over its machine, loading each icon url once in sRGB and leaving a failed one blank', () => {
    const area = createGarage(origin.clone(), real);
    const urls = [...new Set([...real.operatingSystems.flatMap((group) => group.systems.map((system) => system.icon)), ...real.sideProjects.flatMap((side) => side.icon ? [side.icon] : [])])];
    expect(loads.map((load) => load.url).sort()).toEqual(urls.sort());
    const shown = (id: string) => {
      const maps: THREE.Texture[] = [];
      station(area, id).traverse((node) => { if (node instanceof THREE.Mesh && node.material.map && node.material.visible) maps.push(node.material.map); });
      return maps;
    };
    const [ok, broken] = loads;
    ok.texture.image = Object.assign(document.createElement('img'), { width: 128, height: 128 });
    ok.onLoad?.(ok.texture);
    broken.onError?.(new Error('404'));
    expect(ok.texture.colorSpace).toBe(THREE.SRGBColorSpace);
    const groupWith = (url: string) => real.operatingSystems.filter((group) => group.systems.some((system) => system.icon === url));
    for (const group of groupWith(ok.url)) {
      const count = group.systems.filter((system) => system.icon === ok.url).length;
      expect(shown(`os:${slug(group.name)}`).filter((map) => map === ok.texture).length, group.name).toBe(count);
    }
    for (const group of groupWith(broken.url)) expect(shown(`os:${slug(group.name)}`).includes(broken.texture), group.name).toBe(false);
  });

  it('picks the station for every part of a machine or gadget, and nothing for the floor or walls', () => {
    const area = createGarage(origin.clone(), real);
    area.group.updateMatrixWorld(true);
    // Aim from the camera side at the part's box centre, else at its vertices, until the ray really touches the part.
    const aim = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.attributes.position, target = new THREE.Vector3();
      for (let vertex = -1; vertex < position.count; vertex += 3) {
        if (vertex < 0) new THREE.Box3().setFromObject(mesh).getCenter(target);
        else mesh.localToWorld(target.fromBufferAttribute(position, vertex));
        const raycaster = ray(target.clone().add(new THREE.Vector3(0, .4, 1.3)), target);
        if (raycaster.intersectObject(mesh).length) return raycaster;
      }
      return null;
    };
    for (const id of ids(real)) {
      const parts: THREE.Mesh[] = [];
      station(area, id).traverse((node) => { if (node instanceof THREE.Mesh) parts.push(node); });
      const aimed = parts.map(aim).filter((raycaster) => raycaster !== null);
      expect(aimed.length, id).toBeGreaterThanOrEqual(4);
      for (const raycaster of aimed) expect(area.pick(raycaster), `${id} first hit at ${raycaster.intersectObject(area.group, true)[0]?.point.toArray().map((value) => value.toFixed(2))}`).toBe(id);
      const entry = area.stations.find((candidate) => candidate.id === id)!;
      const eye = local(entry.stand.x, 1.6, entry.stand.z);
      expect(area.pick(ray(eye, local(entry.reach.x, entry.reach.y, entry.reach.z))), id).toBe(id);
    }
    const floor = ray(local(area.entry.x, 3, area.entry.z), local(area.entry.x, 0, area.entry.z));
    const sideWall = ray(local(0, 3.6, -1.5), local(-10, 3.6, -1.5));
    for (const raycaster of [floor, sideWall]) {
      expect(raycaster.intersectObject(area.group, true).length).toBeGreaterThan(0);
      expect(area.pick(raycaster)).toBeNull();
    }
  });

  const pose = (object: THREE.Object3D) => {
    object.updateWorldMatrix(true, true);
    const values: number[] = [];
    object.traverse((node) => {
      values.push(...node.matrixWorld.elements);
      if (node instanceof THREE.InstancedMesh) values.push(...node.instanceMatrix.array, ...(node.instanceColor?.array ?? []));
      if (node instanceof THREE.Mesh && 'color' in node.material && node.material.color instanceof THREE.Color) values.push(...node.material.color.toArray());
    });
    return values;
  };
  const difference = (a: number[], b: number[]) => a.reduce((largest, value, index) => Math.max(largest, Math.abs(value - b[index])), 0);
  const run = (area: WorldArea, stationId: string | null) => {
    for (let frame = 1; frame <= 60; frame++) area.update(1 / 30, frame / 30, { stationId, progress: frame / 60 });
  };

  it('keeps every machine and the garage itself alive while nobody is at them', () => {
    const area = createGarage(origin.clone(), real);
    const before = ids(real).map((id) => pose(station(area, id)));
    const room = pose(area.group);
    run(area, null);
    ids(real).forEach((id, index) => expect(difference(before[index], pose(station(area, id))), id).toBeGreaterThan(0));
    expect(difference(room, pose(area.group))).toBeGreaterThan(0);
  });

  it.each(ids(real))('%s boots up visibly while he presents it and nothing else does', (active) => {
    const idle = createGarage(origin.clone(), real), busy = createGarage(origin.clone(), real);
    run(idle, null); run(busy, active);
    for (const id of ids(real)) {
      const change = difference(pose(station(idle, id)), pose(station(busy, id)));
      if (id === active) expect(change, id).toBeGreaterThan(.05);
      else expect(change, id).toBe(0);
    }
  });

  it('dispose frees every geometry, material and texture it put in the scene, including an icon that loads afterwards', () => {
    const area = createGarage(origin.clone(), real);
    const [early, late] = loads;
    early.texture.image = Object.assign(document.createElement('img'), { width: 128, height: 128 });
    early.onLoad?.(early.texture);
    const owned = new Set<unknown>(loads.map((load) => load.texture));
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      owned.add(node.geometry);
      if (node instanceof THREE.InstancedMesh) owned.add(node);
      for (const material of [node.material].flat()) {
        owned.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) owned.add(value);
      }
    });
    const dispatch = vi.spyOn(THREE.EventDispatcher.prototype, 'dispatchEvent');
    area.dispose();
    late.texture.image = Object.assign(document.createElement('img'), { width: 128, height: 128 });
    late.onLoad?.(late.texture);

    const freed = new Set<unknown>(dispatch.mock.calls.flatMap(([event], index) => event.type === 'dispose' ? [dispatch.mock.contexts[index]] : []));
    expect([...owned].filter((item) => !freed.has(item))).toEqual([]);
    expect([...owned].some((item) => item instanceof THREE.CanvasTexture)).toBe(true);
    let attached = false;
    area.group.traverse((node) => { if (node instanceof THREE.Mesh && 'map' in node.material && node.material.map === late.texture) attached = true; });
    expect(attached).toBe(false);
  });
});
