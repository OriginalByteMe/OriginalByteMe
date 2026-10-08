import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { corpus } from '@/lib/corpus';
import { worldContent } from '@/lib/character/world-content';
import { createGarage } from '../garage';
import { createHall } from '../hall';
import { createPostoffice } from '../postoffice';
import { createToolshed } from '../toolshed';
import { lotOrigin } from '../town';
import type { AreaBuilder } from '../types';

const content = worldContent(corpus);
let texts: string[];
beforeEach(() => {
  texts = [];
  // jsdom has no 2D canvas: record what the sign says.
  const context = new Proxy({}, {
    get: (_, key) => key === 'fillText' ? (text: string) => { texts.push(text); } : key === 'measureText' ? (text: string) => ({ width: text.length * 40 }) : () => ({ addColorStop() {} }),
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
});
afterEach(() => { vi.restoreAllMocks(); });

describe.each<[string, AreaBuilder, number, string]>([
  ['hall', createHall, 1, 'Noah, in brief'],
  ['toolshed', createToolshed, 3, 'The toolbox'],
  ['garage', createGarage, 5, 'The rig'],
  ['postoffice', createPostoffice, 6, 'Say hi'],
])('the %s shell', (id, build, lot, name) => {
  it('is an open-front building about twice the old room floor, named on its sign, with one station he can visit', () => {
    const origin = lotOrigin(lot);
    const area = build(origin.clone(), content);
    area.group.updateMatrixWorld(true);
    expect(area.id).toBe(id);
    expect(area.group.position.toArray()).toEqual(origin.toArray());
    expect(texts).toContain(name);

    const { bounds, obstacles } = area;
    expect((bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)).toBeGreaterThan(80);
    const box = new THREE.Box3().setFromObject(area.group).translate(origin.clone().negate());
    expect([box.min.x, box.min.y, box.min.z].map((value, axis) => value >= [-7, -3, -4.5][axis])).toEqual([true, true, true]);
    expect([box.max.x, box.max.y, box.max.z].map((value, axis) => value <= [7, 7, 4.5][axis])).toEqual([true, true, true]);
    const usable = (point: { x: number; z: number }) => point.x >= bounds.minX + .22 && point.x <= bounds.maxX - .22 && point.z >= bounds.minZ + .22 && point.z <= bounds.maxZ - .22
      && obstacles.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + .22);
    expect(usable(area.entry)).toBe(true);
    expect(area.entry.z).toBeGreaterThan(bounds.maxZ - 1);

    expect(area.stations).toHaveLength(1);
    const [station] = area.stations;
    expect(usable(station.stand)).toBe(true);
    const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(origin);
    const eye = local(station.stand.x, 1.6, station.stand.z);
    expect(area.pick(new THREE.Raycaster(eye, local(station.reach.x, station.reach.y, station.reach.z).sub(eye).normalize()))).toBe(station.id);
    const down = new THREE.Raycaster(local(area.entry.x, 3, area.entry.z), new THREE.Vector3(0, -1, 0));
    expect(down.intersectObject(area.group, true).length).toBeGreaterThan(0);
    expect(area.pick(down)).toBeNull();

    const disposed = new Set<unknown>();
    const created = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      created.add(node.geometry);
      for (const material of [node.material].flat()) { created.add(material); if (material.map) created.add(material.map); }
    });
    for (const resource of created) resource.addEventListener('dispose', () => disposed.add(resource));
    area.dispose();
    expect(disposed.size).toBe(created.size);
  });
});
