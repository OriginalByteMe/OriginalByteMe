import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import type { WorldContent } from '@/lib/character/world-content';
import type { WorldArea } from '../types';
import { createAbout } from '../about';

const ORIGIN = new THREE.Vector3(0, -36, 0);
const CONTENT: WorldContent = {
  projects: [], skills: [], funFacts: [],
  headline: 'Full-stack software engineer', location: 'Kuala Lumpur, Malaysia',
  career: [
    { company: 'MerchantSpring', role: 'Senior AI Engineer', period: '2026 - Present', logo: '/logos/merchantspring.svg' },
    { company: 'Supa (formerly Supahands)', role: 'Full-Stack Developer', period: '2020 - 2025', logo: '/logos/supa.png' },
    { company: 'Bowiq', role: 'CAD Designer & 3D Printing Engineer', period: '2023 - Present', logo: '/logos/bowiq.png' },
  ],
};
const EMPTY_CAREER: WorldContent = { ...CONTENT, career: [] };

type Load = { url: string; texture: THREE.Texture<HTMLImageElement>; disposed: boolean; onLoad?: (texture: THREE.Texture<HTMLImageElement>) => void; onError?: (error: unknown) => void };
let loads: Load[] = [];
beforeEach(() => {
  stubCanvas2d();
  loads = [];
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((url, onLoad, _progress, onError) => {
    const load: Load = { url, texture: new THREE.Texture<HTMLImageElement>(), disposed: false, onLoad, onError };
    load.texture.addEventListener('dispose', () => { load.disposed = true; });
    loads.push(load);
    return load.texture;
  });
});
afterEach(() => { vi.restoreAllMocks(); });

const build = (content = CONTENT) => { const area = createAbout(ORIGIN.clone(), content); area.group.updateMatrixWorld(true); return area; };
const finish = (load: Load, width: number, height: number) => { load.texture.image = { width, height } as HTMLImageElement; load.onLoad?.(load.texture); };
/** Ray between two area-local points. */
const ray = (from: [number, number, number], to: [number, number, number]) => {
  const start = new THREE.Vector3(...from).add(ORIGIN);
  return new THREE.Raycaster(start, new THREE.Vector3(...to).add(ORIGIN).sub(start).normalize());
};
/** A ray from the camera side straight at the back wall through area-local (x, y). */
const straightOn = (x: number, y: number) => ray([x, y, 6], [x, y, -6]);
const firstHit = (area: WorldArea, raycaster: THREE.Raycaster) => raycaster.intersectObject(area.group, true).find((hit) => hit.object.visible);
const portraitImage = (area: WorldArea) => firstHit(area, straightOn(0, 2.6))!.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
const width = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).x;

describe('createAbout', () => {
  it.each([['three jobs', CONTENT], ['no jobs', EMPTY_CAREER]])('lays out reachable, pickable stations inside the extents with %s', (_, content) => {
    const area = build(content);
    const { bounds } = area;
    expect(area.id).toBe('about');
    expect(area.group.position.toArray()).toEqual(ORIGIN.toArray());
    expect(Object.fromEntries(area.stations.map((station) => [station.id, station.kind]))).toEqual({ portrait: 'admire', skyline: 'watch', career: 'watch' });
    // controller.ts clamps the character centre to bounds inset by its .22 radius, so every target must sit inside that.
    const inside = (x: number, z: number) => x >= bounds.minX + .22 && x <= bounds.maxX - .22 && z >= bounds.minZ + .22 && z <= bounds.maxZ - .22;
    for (const station of area.stations) {
      const { stand, reach } = station;
      expect(inside(stand.x, stand.z), station.id).toBe(true);
      for (const obstacle of area.obstacles) expect(Math.hypot(stand.x - obstacle.x, stand.z - obstacle.z), `${station.id} vs ${obstacle.id}`).toBeGreaterThanOrEqual(obstacle.radius + .22);
      const ahead = Math.hypot(reach.x - stand.x, reach.z - stand.z);
      expect(ahead, station.id).toBeGreaterThanOrEqual(.3); expect(ahead, station.id).toBeLessThanOrEqual(.9);
      expect(reach.y, station.id).toBeGreaterThanOrEqual(.8); expect(reach.y, station.id).toBeLessThanOrEqual(1.6);
      const facing = Math.atan2(reach.x - stand.x, reach.z - stand.z) - station.heading;
      expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))), station.id).toBeLessThan(.6);
      // His hands land on the station's own object, not on a wall behind it.
      const reachRay = ray([stand.x, 1.6, stand.z], [reach.x, reach.y, reach.z]);
      expect(area.pick(reachRay), station.id).toBe(station.id);
      expect(firstHit(area, reachRay)!.point.sub(ORIGIN).distanceTo(new THREE.Vector3(reach.x, reach.y, reach.z)), station.id).toBeLessThan(.12);
    }

    // He lands on the couch seat: something solid right under the landing point, away from every station.
    const { landing, exit } = area;
    expect(inside(landing.x, landing.z)).toBe(true);
    expect(landing.y).toBeGreaterThan(.3);
    const drop = ray([landing.x, landing.y + 1, landing.z], [landing.x, -1, landing.z]);
    expect(firstHit(area, drop)!.point.y - ORIGIN.y).toBeCloseTo(landing.y, 1);
    expect(area.pick(drop)).toBeNull();
    for (const station of area.stations) expect(Math.hypot(landing.x - station.stand.x, landing.z - station.stand.z)).toBeGreaterThan(1.2);
    expect(inside(exit.x, exit.z)).toBe(true); expect(exit.z).toBeGreaterThan(bounds.maxZ - .6);

    const box = new THREE.Box3().setFromObject(area.group).translate(ORIGIN.clone().negate());
    expect(box.min.x).toBeGreaterThanOrEqual(-7); expect(box.max.x).toBeLessThanOrEqual(7);
    expect(box.min.y).toBeGreaterThanOrEqual(-3); expect(box.max.y).toBeLessThanOrEqual(7);
    expect(box.min.z).toBeGreaterThanOrEqual(-4.5); expect(box.max.z).toBeLessThanOrEqual(4.5);
    expect(bounds.minX).toBeGreaterThan(box.min.x); expect(bounds.maxX).toBeLessThan(box.max.x);
    expect(bounds.minZ).toBeGreaterThan(box.min.z); expect(bounds.maxZ).toBeLessThan(box.max.z);

    let meshes = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    });
    expect(meshes).toBeLessThanOrEqual(120); expect(triangles).toBeLessThanOrEqual(25_000);
    area.dispose();
  });

  it('hangs a big portrait on the back wall with its bottom edge at y 1.4, and picks nothing on floor or walls', () => {
    const area = build();
    const hits: [number, number, string | null][] = [
      [0, 2.6, 'portrait'], [0, 1.46, 'portrait'], [0, 3.7, 'portrait'], [-.85, 2.6, 'portrait'], [.85, 2.6, 'portrait'],
      [0, 1.3, null], [1.05, 2.6, null], [-1.05, 2.6, null], [3, 3.6, null], [-3, 3.6, null],
    ];
    for (const [x, y, id] of hits) {
      const raycaster = straightOn(x, y);
      expect(firstHit(area, raycaster), `${x}, ${y}`).toBeDefined();
      expect(area.pick(raycaster), `${x}, ${y}`).toBe(id);
    }
    expect(area.pick(ray([1.5, 4, 1.8], [1.5, -1, 1.8]))).toBeNull();
    expect(area.pick(ray([-6.5, 2, 0], [6, 2, 0]))).toBeNull();
    area.dispose();
  });

  it.each([
    ['loads', true],
    ['fails', false],
  ])('shows a framed placeholder until the portrait %s', (_, succeeds) => {
    const area = build();
    const hero = loads.find((load) => load.url === '/hero.png')!;
    const image = portraitImage(area);
    const placeholder = image.material.map;
    expect(placeholder).toBeInstanceOf(THREE.Texture);
    if (succeeds) finish(hero, 1408, 1926); else hero.onError?.(new Error('404'));
    expect(image.visible).toBe(true);
    expect(portraitImage(area)).toBe(image);
    expect(image.material.map).toBe(succeeds ? hero.texture : placeholder);
    if (succeeds) expect(hero.texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(area.pick(straightOn(.85, 2.6))).toBe('portrait');
    area.dispose();
  });

  it('loads one career logo per job and none for an empty career', () => {
    const urls = () => loads.map((load) => load.url).filter((url) => url !== '/hero.png');
    build().dispose();
    expect(urls()).toEqual(['/logos/merchantspring.svg', '/logos/supa.png', '/logos/bowiq.png']);
    loads = [];
    const empty = build(EMPTY_CAREER);
    expect(urls()).toEqual([]);
    const shelf = empty.stations.find((station) => station.id === 'career')!;
    expect(empty.pick(ray([shelf.stand.x, .5, shelf.stand.z], [shelf.stand.x, .5, -4]))).toBe('career');
    empty.dispose();
  });

  it('tilts the frame crooked while he plays with it, then it swings back straight', () => {
    const area = build();
    const image = portraitImage(area);
    const straight = width(image);
    let elapsed = 0;
    const run = (seconds: number, stationId: string | null, progress: (t: number) => number) => {
      let widest = 0;
      for (let t = 0; t < seconds; t += 1 / 30) {
        elapsed += 1 / 30;
        area.update(1 / 30, elapsed, { stationId, progress: progress(t / seconds) });
        area.group.updateMatrixWorld(true);
        widest = Math.max(widest, width(image));
      }
      return widest;
    };
    expect(run(2, 'skyline', (p) => p)).toBeCloseTo(straight, 4);
    expect(run(2, 'portrait', (p) => p)).toBeGreaterThan(straight + .05);
    run(6, null, () => 0);
    expect(width(image)).toBeCloseTo(straight, 2);
    area.dispose();
  });

  it('disposes every geometry, material and texture it created, including loads that finish after dispose', () => {
    const area = build();
    const owned = new Set<object>();
    const collect = () => area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      owned.add(node.geometry);
      for (const material of [node.material].flat()) {
        owned.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) owned.add(value);
      }
    });
    collect();
    const [hero, ...logos] = loads;
    expect(hero.url).toBe('/hero.png');
    finish(logos[0], 44, 44);
    logos[1].onError?.(new Error('404'));
    collect();
    const image = portraitImage(area);
    const spies = [vi.spyOn(THREE.BufferGeometry.prototype, 'dispose'), vi.spyOn(THREE.Material.prototype, 'dispose'), vi.spyOn(THREE.Texture.prototype, 'dispose')];
    area.dispose();
    const freed = new Set(spies.flatMap((spy) => spy.mock.contexts));
    finish(hero, 1408, 1926);
    finish(logos[2], 284, 112);
    expect([...owned].filter((resource) => !freed.has(resource))).toEqual([]);
    expect(loads.filter((load) => !load.disposed).map((load) => load.url)).toEqual([]);
    expect(image.material.map).not.toBe(hero.texture);
  });
});
