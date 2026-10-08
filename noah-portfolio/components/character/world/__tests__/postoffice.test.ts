import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { createCharacterState, stepCharacter } from '@/lib/character/controller';
import { worldContent, type WorldContent } from '@/lib/character/world-content';
import { loadCorpus } from '@/lib/corpus/loader';
import { createPostoffice } from '../postoffice';
import { lotOrigin } from '../town';
import type { WorldArea } from '../types';

const real = worldContent(loadCorpus().corpus);
const noBlog: WorldContent = { ...real, contact: { ...real.contact, blog: null } };
const origin = lotOrigin(6);
const ALL = ['contact:email', 'contact:github', 'contact:linkedin', 'contact:blog'];
/** The afro is about 1.2 wide and centred over his stand point. */
const AFRO_HALF_WIDTH = .6;

let texts: string[];
beforeEach(() => {
  texts = [];
  stubCanvas2d().mockImplementation(() => new Proxy({}, {
    get: (_, key) => key === 'measureText' ? (text: string) => ({ width: text.length * 20 }) : key === 'fillText' ? (text: string) => { texts.push(text); } : () => ({ addColorStop() {} }),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

const flat = (point: { x: number; z: number }) => new THREE.Vector2(point.x, point.z);
const localBox = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object).translate(origin.clone().negate());

describe('createPostoffice', () => {
  it('builds the say-hi lot with a station for email, GitHub, LinkedIn and the blog, and drops the blog when there is none', () => {
    const area = createPostoffice(origin.clone(), real);
    expect(area.id).toBe('postoffice');
    expect(area.group.position.toArray()).toEqual(origin.toArray());
    expect(area.stations.map((station) => station.id)).toEqual(ALL);
    for (const id of ALL) expect(area.group.getObjectByName(id)?.userData.station).toBe(id);
    for (const name of ['Say hi', 'Email', 'GitHub', 'LinkedIn', 'Blog']) expect(texts).toContain(name);

    texts = [];
    const without = createPostoffice(origin.clone(), noBlog);
    expect(without.stations.map((station) => station.id)).toEqual(ALL.slice(0, 3));
    expect(without.group.getObjectByName('contact:blog')).toBeUndefined();
    expect(texts).not.toContain('Blog');
  });

  it('presents every contact with sourced lines and a Visit link that exactly matches the contact', () => {
    const { stations } = createPostoffice(origin.clone(), real);
    const urls = Object.fromEntries(stations.map((station) => [station.id, station.present?.url]));
    expect(urls).toEqual({
      'contact:email': `mailto:${real.contact.email}`,
      'contact:github': real.contact.github,
      'contact:linkedin': real.contact.linkedin,
      'contact:blog': real.contact.blog,
    });
    for (const station of stations) {
      expect(station.present!.lines.length, station.id).toBeGreaterThan(0);
      expect(station.present!.linkLabel, station.id).toMatch(/\w{3}/);
      for (const line of station.present!.lines) {
        expect(line.source, line.id).toBe('content/about-me/contact.md');
        expect(line.line.length, line.id).toBeGreaterThan(5);
      }
    }
    expect(new Set(stations.flatMap((station) => station.present!.lines.map((line) => line.id))).size).toBe(stations.flatMap((station) => station.present!.lines).length);
  });

  it.each([['with', real], ['without', noBlog]])('lays the lot out %s a blog: inside its extents, reachable stations he does not hide', (_, content) => {
    const area = createPostoffice(origin.clone(), content);
    const { bounds, obstacles } = area;
    const box = localBox(area.group);
    expect(box.min.toArray().map((value, axis) => value >= [-7, -3, -4.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [7, 7, 4.5][axis])).toEqual([true, true, true]);
    expect((bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)).toBeGreaterThan(60);

    const inset = (point: { x: number; z: number }) => point.x >= bounds.minX + .22 && point.x <= bounds.maxX - .22 && point.z >= bounds.minZ + .22 && point.z <= bounds.maxZ - .22;
    const clear = (point: { x: number; z: number }) => obstacles.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + .22);
    for (const station of area.stations) {
      expect(inset(station.stand) && clear(station.stand), station.id).toBe(true);
      const ahead = flat(station.reach).sub(flat(station.stand));
      expect(ahead.length(), station.id).toBeGreaterThanOrEqual(.35);
      expect(ahead.length(), station.id).toBeLessThanOrEqual(.55);
      expect(station.reach.y, station.id).toBeGreaterThanOrEqual(.85);
      expect(station.reach.y, station.id).toBeLessThanOrEqual(1.3);
      const facing = Math.atan2(ahead.x, ahead.y) - station.heading;
      expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))), station.id).toBeLessThan(.5);
      // From the dead-on camera a good part of the object shows beside him.
      const object = localBox(area.group.getObjectByName(station.id)!);
      expect(Math.max(object.max.x - (station.stand.x + AFRO_HALF_WIDTH), station.stand.x - AFRO_HALF_WIDTH - object.min.x), station.id).toBeGreaterThan(.3);
    }
    for (const [index, a] of area.stations.entries()) for (const b of area.stations.slice(index + 1)) expect(flat(a.stand).distanceTo(flat(b.stand))).toBeGreaterThan(1);

    expect(inset(area.entry) && clear(area.entry)).toBe(true);
    expect(area.entry.z).toBeGreaterThan(bounds.maxZ - .6);
    // A visitor can send him to a station from wherever a floor click left him, the walk-in spot included.
    const floor = [area.entry];
    for (let x = bounds.minX + .22; x <= bounds.maxX - .22; x += .75) for (let z = bounds.minZ + .22; z <= bounds.maxZ - .22; z += .75) if (clear({ x, z })) floor.push({ x, z });
    for (const station of area.stations) for (const from of floor) {
      const state = createCharacterState({ ...from });
      for (let frame = 0; frame < 1800; frame++) stepCharacter(state, station.stand, 1 / 60, obstacles, bounds);
      expect(Math.hypot(state.position.x - station.stand.x, state.position.z - station.stand.z), `${station.id} from ${from.x.toFixed(2)}, ${from.z.toFixed(2)}`).toBeLessThan(.13);
    }

    let drawCalls = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      drawCalls += 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    expect(drawCalls).toBeLessThanOrEqual(40);
    expect(triangles).toBeLessThanOrEqual(20000);
  });

  it('picks the station for every part of the mailbox, parcels, flag and blog board, and nothing for floor or walls', () => {
    const area = createPostoffice(origin.clone(), real);
    area.update(1 / 30, 1, { stationId: null, progress: 0 });
    const ray = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Raycaster(from, to.clone().sub(from).normalize());
    // Aim from the camera side at the part's box centre, else at its vertices, until the ray really touches the part.
    const aim = (mesh: THREE.Mesh) => {
      mesh.updateWorldMatrix(true, false);
      const position = mesh.geometry.attributes.position, target = new THREE.Vector3();
      for (let vertex = -1; vertex < position.count; vertex += 3) {
        if (vertex < 0) new THREE.Box3().setFromObject(mesh).getCenter(target);
        else mesh.localToWorld(target.fromBufferAttribute(position, vertex));
        const raycaster = ray(target.clone().add(new THREE.Vector3(0, .3, 1.3)), target);
        if (raycaster.intersectObject(mesh).length && area.pick(raycaster) !== null) return raycaster;
      }
      throw new Error(`no ray reaches a part of ${mesh.parent?.name}`);
    };
    for (const id of ALL) {
      const parts: THREE.Mesh[] = [];
      area.group.getObjectByName(id)!.traverse((node) => { if (node instanceof THREE.Mesh && node.visible) parts.push(node); });
      expect(parts.length, id).toBeGreaterThanOrEqual(2);
      for (const part of parts) expect(area.pick(aim(part)), id).toBe(id);
    }
    const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(origin);
    const floor = ray(local(area.entry.x, 3, area.entry.z), local(area.entry.x, 0, area.entry.z));
    const backWall = ray(local(.4, 3.4, 3), local(.4, 3.4, -10));
    for (const raycaster of [floor, backWall]) {
      expect(raycaster.intersectObject(area.group, true).length).toBeGreaterThan(0);
      expect(area.pick(raycaster)).toBeNull();
    }
  });

  const pose = (object: THREE.Object3D) => {
    object.updateWorldMatrix(true, true);
    const values: number[] = [];
    object.traverse((node) => {
      values.push(...node.matrixWorld.elements, node.visible ? 1 : 0);
      if (node instanceof THREE.InstancedMesh) values.push(...node.instanceMatrix.array);
      if (node instanceof THREE.Mesh && 'color' in node.material && node.material.color instanceof THREE.Color) values.push(...node.material.color.toArray());
    });
    return values;
  };
  const difference = (a: number[], b: number[]) => a.length !== b.length ? Infinity : a.reduce((largest, value, index) => Math.max(largest, Math.abs(value - b[index])), 0);
  const run = (area: WorldArea, stationId: string | null) => {
    for (let frame = 1; frame <= 60; frame++) area.update(1 / 30, frame / 30, { stationId, progress: frame / 60 });
  };

  it('keeps the street end alive while nobody presents', () => {
    const area = createPostoffice(origin.clone(), real);
    const before = pose(area.group);
    run(area, null);
    expect(difference(before, pose(area.group))).toBeGreaterThan(.03);
  });

  it.each(ALL)('%s runs its machine while he presents it and nothing else changes', (active) => {
    const idle = createPostoffice(origin.clone(), real), busy = createPostoffice(origin.clone(), real);
    run(idle, null); run(busy, active);
    for (const id of ALL) {
      const change = difference(pose(idle.group.getObjectByName(id)!), pose(busy.group.getObjectByName(id)!));
      if (id === active) expect(change, id).toBeGreaterThan(.1);
      else expect(change, id).toBe(0);
    }
  });

  it('dispose frees every geometry, material and texture it put in the scene', () => {
    const area = createPostoffice(origin.clone(), real);
    const owned = new Set<unknown>();
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      owned.add(node.geometry);
      if (node instanceof THREE.InstancedMesh) owned.add(node);
      for (const material of [node.material].flat()) {
        owned.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) owned.add(value);
      }
    });
    expect([...owned].some((item) => item instanceof THREE.CanvasTexture)).toBe(true);
    const dispatch = vi.spyOn(THREE.EventDispatcher.prototype, 'dispatchEvent');
    area.dispose();
    const freed = new Set<unknown>(dispatch.mock.calls.flatMap(([event], index) => event.type === 'dispose' ? [dispatch.mock.contexts[index]] : []));
    expect([...owned].filter((item) => !freed.has(item))).toEqual([]);
  });
});
