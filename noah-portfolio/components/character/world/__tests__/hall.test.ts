import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_CONFIG, createCharacterState, stepCharacter } from '@/lib/character/controller';
import { worldContent } from '@/lib/character/world-content';
import { corpus } from '@/lib/corpus';
import { createHall } from '../hall';
import { lotOrigin } from '../town';
import type { WorldArea } from '../types';

const content = worldContent(corpus);
const origin = lotOrigin(1);
const [stat] = content.stats;
const STATIONS = ['hall:statue', 'hall:stat', 'hall:globe'];
/** The scene's camera direction and his height with the afro (create-character-scene.ts). */
const CAMERA = new THREE.Vector3(0, .3, 1).normalize();
const HEIGHT = 2.45;

let texts: string[];
beforeEach(() => {
  texts = [];
  // jsdom has no 2D canvas: record what the signs say.
  const context = new Proxy({}, {
    get: (_, key) => key === 'fillText' ? (text: string) => { texts.push(text); } : key === 'measureText' ? (text: string) => ({ width: text.length * 20 }) : () => ({ addColorStop() {} }),
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
});
afterEach(() => { vi.restoreAllMocks(); });

const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(origin);
const meshes = (object: THREE.Object3D) => {
  const found: THREE.Mesh[] = [];
  object.traverse((node) => { if (node instanceof THREE.Mesh) found.push(node); });
  return found;
};
const pose = (object: THREE.Object3D) => {
  object.updateWorldMatrix(true, true);
  const values: number[] = [];
  object.traverse((node) => {
    values.push(...node.matrixWorld.elements);
    if (node instanceof THREE.InstancedMesh) values.push(...node.instanceMatrix.array, ...(node.instanceColor?.array ?? []));
    if (node instanceof THREE.Mesh) {
      values.push(...(node.geometry.attributes.uv?.array ?? []));
      if ('color' in node.material && node.material.color instanceof THREE.Color) values.push(...node.material.color.toArray());
    }
  });
  return values;
};
const difference = (a: number[], b: number[]) => a.reduce((largest, value, index) => Math.max(largest, Math.abs(value - b[index])), 0);
const run = (area: WorldArea, stationId: string | null) => {
  for (let frame = 1; frame <= 45; frame++) area.update(1 / 30, frame / 30, { stationId, progress: frame / 45 });
};

describe('createHall', () => {
  it('stands on its lot inside the extents as a wide open-front plaza', () => {
    const area = createHall(origin.clone(), content);
    expect(area.id).toBe('hall');
    expect(area.group.position.toArray()).toEqual(origin.toArray());
    const box = new THREE.Box3().setFromObject(area.group).translate(origin.clone().negate());
    expect(box.min.toArray().map((value, axis) => value >= [-7, -3, -4.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [7, 7, 4.5][axis])).toEqual([true, true, true]);
    const { bounds } = area;
    expect((bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)).toBeGreaterThan(80);
    // Nothing stands between the street and the plaza: a ray from the camera's side reaches the floor at the entry.
    const entry = local(area.entry.x, 0, area.entry.z);
    const down = new THREE.Raycaster(entry.clone().addScaledVector(CAMERA, 12), CAMERA.clone().negate());
    expect(down.intersectObject(area.group, true)[0]?.point.distanceTo(entry)).toBeLessThan(.05);
  });

  it('puts the chapter title, his headline, his home city and the Chapter 01 stat on short signs', () => {
    createHall(origin.clone(), content);
    for (const text of ['Noah, in brief', content.headline, content.location.split(',')[0], stat.caption, stat.suffix.trim()]) expect(texts.join('\n'), text).toContain(text);
    for (const digit of String(stat.value)) expect(texts).toContain(digit);
    // Short signs only: no paragraph from the bio.
    expect(texts.every((text) => text.length <= 32)).toBe(true);
  });

  it('has three presenting stations he reaches from the street, clear of furniture and not hidden behind him', () => {
    const area = createHall(origin.clone(), content);
    const { bounds, obstacles } = area;
    expect(area.stations.map((station) => station.id)).toEqual(STATIONS);
    const usable = (point: { x: number; z: number }) => point.x >= bounds.minX + .22 && point.x <= bounds.maxX - .22 && point.z >= bounds.minZ + .22 && point.z <= bounds.maxZ - .22
      && obstacles.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + .22);
    expect(usable(area.entry)).toBe(true);
    expect(area.entry.z).toBeGreaterThan(bounds.maxZ - 1);
    const camera = new THREE.Vector3(area.view.center.x, area.view.center.y, area.view.center.z).addScaledVector(CAMERA, 22);

    for (const station of area.stations) {
      expect(usable(station.stand), station.id).toBe(true);
      expect(station.label.length, station.id).toBeGreaterThan(3);
      const ahead = new THREE.Vector2(station.reach.x - station.stand.x, station.reach.z - station.stand.z);
      expect(ahead.length(), station.id).toBeGreaterThanOrEqual(.35);
      expect(ahead.length(), station.id).toBeLessThanOrEqual(.75);
      expect(station.reach.y, station.id).toBeGreaterThanOrEqual(.85);
      expect(station.reach.y, station.id).toBeLessThanOrEqual(1.4);
      const facing = Math.atan2(ahead.x, ahead.y) - station.heading;
      expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))), station.id).toBeLessThan(.3);

      const state = createCharacterState({ ...area.entry });
      let clearance = Infinity;
      for (let frame = 0; frame < 1800; frame++) {
        stepCharacter(state, station.stand, 1 / 60, obstacles, bounds);
        for (const obstacle of obstacles) clearance = Math.min(clearance, Math.hypot(state.position.x - obstacle.x, state.position.z - obstacle.z) - obstacle.radius - CHARACTER_CONFIG.radius);
      }
      expect(Math.hypot(state.position.x - station.stand.x, state.position.z - station.stand.z), station.id).toBeLessThan(.13);
      expect(clearance, station.id).toBeGreaterThanOrEqual(-.001);

      // Standing there and facing the camera, his body and afro cover none of the station's parts.
      const body = new THREE.Box3(new THREE.Vector3(station.stand.x - .42, 0, station.stand.z - .3), new THREE.Vector3(station.stand.x + .42, HEIGHT, station.stand.z + .3));
      for (const part of meshes(area.group.getObjectByName(station.id)!)) {
        const centre = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()).sub(origin);
        const hit = new THREE.Ray(camera, centre.clone().sub(camera).normalize()).intersectBox(body, new THREE.Vector3());
        expect(hit === null || hit.distanceTo(camera) >= centre.distanceTo(camera) - .001, `${station.id} ${part.name}`).toBe(true);
      }
    }
  });

  it('has him present each bio fact with its public source', () => {
    const area = createHall(origin.clone(), content);
    const lines = (id: string) => area.stations.find((station) => station.id === id)!.present!.lines.map((line) => line.line).join(' ');
    for (const station of area.stations) {
      expect(station.present!.lines.length, station.id).toBeGreaterThan(0);
      for (const line of station.present!.lines) {
        expect(line.source, line.id).toMatch(/^content\/about-me\/.+\.md$/);
        expect(existsSync(join(process.cwd(), line.source!)), line.source).toBe(true);
      }
      expect(station.present!.url, station.id).toBeUndefined();
    }
    expect(lines('hall:statue')).toContain(content.headline);
    expect(lines('hall:globe')).toContain(content.location);
    expect(lines('hall:stat')).toContain(`${stat.value}${stat.suffix} ${stat.caption}`);
    const ids = area.stations.flatMap((station) => station.present!.lines.map((line) => line.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('picks the station for every part of it and nothing for floor or walls', () => {
    const area = createHall(origin.clone(), content);
    area.group.updateMatrixWorld(true);
    const ray = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Raycaster(from, to.clone().sub(from).normalize());
    // Aim from the camera's side at the part's box centre, else at its instances or vertices, until the ray really touches the part.
    const aim = (mesh: THREE.Mesh) => {
      const targets = [new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())], matrix = new THREE.Matrix4();
      if (mesh instanceof THREE.InstancedMesh) for (let index = 0; index < mesh.count; index++) targets.push(new THREE.Vector3().setFromMatrixPosition(mesh.getMatrixAt(index, matrix)).applyMatrix4(mesh.matrixWorld));
      else for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex += 3) targets.push(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex)));
      for (const target of targets) {
        const raycaster = ray(target.clone().addScaledVector(CAMERA, 2), target);
        if (raycaster.intersectObject(mesh).length) return raycaster;
      }
      throw new Error(`no ray reaches a part of ${mesh.parent?.name}`);
    };
    for (const id of STATIONS) {
      const parts = meshes(area.group.getObjectByName(id)!);
      expect(parts.length, id).toBeGreaterThanOrEqual(3);
      for (const part of parts) expect(area.pick(aim(part)), id).toBe(id);
    }
    const floor = ray(local(area.entry.x, 3, area.entry.z), local(area.entry.x, 0, area.entry.z));
    const backWall = ray(local(-1.6, 1, 0), local(-1.6, 1, -6));
    for (const raycaster of [floor, backWall]) {
      expect(raycaster.intersectObject(area.group, true).length).toBeGreaterThan(0);
      expect(area.pick(raycaster)).toBeNull();
    }
  });

  it('keeps the plaza alive while nobody presents', () => {
    const area = createHall(origin.clone(), content);
    const before = pose(area.group);
    run(area, null);
    expect(difference(before, pose(area.group))).toBeGreaterThan(.05);
  });

  it.each(STATIONS)('runs the %s display while he presents there and leaves the others alone', (active) => {
    const idle = createHall(origin.clone(), content), busy = createHall(origin.clone(), content);
    run(idle, null); run(busy, active);
    for (const id of STATIONS) {
      const change = difference(pose(idle.group.getObjectByName(id)!), pose(busy.group.getObjectByName(id)!));
      if (id === active) expect(change, id).toBeGreaterThan(.2);
      else expect(change, id).toBe(0);
    }
  });

  it('counts the stat up on its flip board while he presents it and settles on the real value', () => {
    const area = createHall(origin.clone(), content);
    const board = area.group.getObjectByName('hall:stat')!;
    // The printed faces on the board: digit flaps and their labels, without the twinkling bulbs.
    const faces = () => {
      board.updateWorldMatrix(true, true);
      return meshes(board).filter((mesh) => 'map' in mesh.material && mesh.material.map).flatMap((mesh) => [...mesh.matrixWorld.elements, ...mesh.geometry.attributes.uv.array]);
    };
    run(area, null);
    const resting = faces();
    for (let frame = 0; frame < 20; frame++) area.update(1 / 30, 2 + frame / 30, { stationId: 'hall:stat', progress: 0 });
    expect(difference(resting, faces())).toBeGreaterThan(.1);
    for (let frame = 0; frame < 60; frame++) area.update(1 / 30, 3 + frame / 30, { stationId: null, progress: 0 });
    expect(difference(resting, faces())).toBeLessThan(.001);
  });

  it('stays cheap to draw', () => {
    const area = createHall(origin.clone(), content);
    let drawCalls = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      drawCalls += 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    expect(drawCalls).toBeLessThanOrEqual(40);
    expect(triangles).toBeLessThanOrEqual(30000);
  });

  it('dispose frees every geometry, material and texture it put in the scene', () => {
    const area = createHall(origin.clone(), content);
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
    const dispatch = vi.spyOn(THREE.EventDispatcher.prototype, 'dispatchEvent');
    area.dispose();
    const freed = new Set<unknown>(dispatch.mock.calls.flatMap(([event], index) => event.type === 'dispose' ? [dispatch.mock.contexts[index]] : []));
    expect([...owned].filter((item) => !freed.has(item))).toEqual([]);
  });
});
