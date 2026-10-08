import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { corpus } from '@/lib/corpus';
import { worldContent, type WorldContent } from '@/lib/character/world-content';
import type { WorldArea } from '../types';
import { createAbout } from '../about';
import { lotOrigin } from '../town';

const ORIGIN = lotOrigin(4);
const CONTENT = worldContent(corpus);
const BARE: WorldContent = { ...CONTENT, career: [], funFacts: [] };
/** A job without a same-origin logo and one more fun fact than the corpus has. */
const ODD: WorldContent = {
  ...CONTENT,
  career: [...CONTENT.career, { company: 'Elsewhere Ltd', role: 'Intern', period: '2019 - 2020', logo: 'https://example.com/logo.png', url: '', highlights: [] }],
  funFacts: [...CONTENT.funFacts, 'Collects houseplants'],
};
/** Dead-on view direction from the lot toward the camera, with its gentle downward tilt. */
const TO_CAMERA = new THREE.Vector3(0, .3, 1).normalize();
/** The camera's eye, area-local, at its closest framing (about 23 units out at 1280x800): its perspective spreads near things over far ones. */
const eye = (area: WorldArea) => new THREE.Vector3(area.view.center.x, area.view.center.y, area.view.center.z).addScaledVector(TO_CAMERA, 23);
/** His silhouette at a station, area-local: an afro sphere on a body column. */
const AFRO = { y: 1.86, radius: .6 }, BODY = { top: 1.3, radius: .3 };

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
/** A ray from the camera's eye through area-local (x, y) on the plane z = 0. */
const fromCamera = (area: WorldArea, x: number, y: number) => {
  const from = eye(area).add(ORIGIN);
  return new THREE.Raycaster(from, new THREE.Vector3(x, y, 0).add(ORIGIN).sub(from).normalize());
};
const firstHit = (area: WorldArea, raycaster: THREE.Raycaster) => raycaster.intersectObject(area.group, true).find((hit) => hit.object.visible);
const portraitImage = (area: WorldArea) => firstHit(area, fromCamera(area, 0, 3.1))!.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
const width = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).x;
const startYear = (period: string) => Number(period.match(/\d{4}/)?.[0]);
/** Whether he, standing at `stand`, blocks the eye's view of an area-local point. */
const blocked = (point: THREE.Vector3, stand: { x: number; z: number }, from: THREE.Vector3) => {
  const toward = from.clone().sub(point).normalize();
  for (let t = 0; t < 8; t += .04) {
    const x = point.x + toward.x * t, y = point.y + toward.y * t, z = point.z + toward.z * t;
    if (Math.hypot(x - stand.x, y - AFRO.y, z - stand.z) < AFRO.radius) return true;
    if (y < BODY.top && Math.hypot(x - stand.x, z - stand.z) < BODY.radius) return true;
  }
  return false;
};
/** The next station along the ray behind the one it hits first, if any. */
const behind = (area: WorldArea, raycaster: THREE.Raycaster, id: string) => {
  const { direction } = raycaster.ray;
  for (let hit = firstHit(area, raycaster), step = 0; hit && step < 8; step++) {
    const next = new THREE.Raycaster(hit.point.clone().addScaledVector(direction, .002), direction);
    const other = area.pick(next);
    if (other && other !== id) return other;
    hit = firstHit(area, next);
  }
  return null;
};
/** Everything a visitor sees change: placement, visibility, colours, instance transforms. Hidden meshes count only as hidden. */
const look = (area: WorldArea) => {
  const values: number[] = [];
  area.group.updateMatrixWorld(true);
  area.group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const start = values.length;
    values.push(+node.visible, ...node.matrixWorld.elements);
    for (const material of [node.material].flat() as THREE.MeshStandardMaterial[]) {
      values.push(material.opacity, ...(material.color?.toArray() ?? []), ...(material.emissive?.toArray() ?? []), material.emissiveIntensity ?? 0);
    }
    if (node instanceof THREE.InstancedMesh) values.push(...node.instanceMatrix.array, ...(node.instanceColor?.array ?? []));
    if (!node.visible) values.fill(0, start);
  });
  return values;
};

describe('createAbout', () => {
  it.each([['the corpus', CONTENT], ['no jobs or fun facts', BARE], ['a remote logo and a third fact', ODD]])('lays out reachable stations inside the lot with %s', (_, content) => {
    const area = build(content);
    const { bounds } = area;
    expect(area.id).toBe('gallery');
    expect(area.group.position.toArray()).toEqual(ORIGIN.toArray());
    const ids = area.stations.map((station) => station.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(area.stations.find((station) => station.id === 'portrait')?.kind).toBe('admire');
    expect(area.stations.find((station) => station.id === 'skyline')?.kind).toBe('watch');
    expect(ids.filter((id) => id.startsWith('career:'))).toHaveLength(content.career.length);
    expect(ids.filter((id) => id.startsWith('fact:'))).toHaveLength(content.funFacts.length);
    expect(ids).toHaveLength(2 + content.career.length + content.funFacts.length);

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
      // His hands land on the station's own object, not on a wall or a neighbour.
      const reachRay = ray([stand.x, 1.6, stand.z], [reach.x, reach.y, reach.z]);
      expect(area.pick(reachRay), station.id).toBe(station.id);
      expect(firstHit(area, reachRay)!.point.sub(ORIGIN).distanceTo(new THREE.Vector3(reach.x, reach.y, reach.z)), station.id).toBeLessThan(.12);
      // Nobody stands on top of anybody: stand points keep his width apart.
      for (const other of area.stations) if (other !== station) expect(Math.hypot(stand.x - other.stand.x, stand.z - other.stand.z), `${station.id} vs ${other.id}`).toBeGreaterThan(.6);
    }

    expect(inside(area.entry.x, area.entry.z)).toBe(true); expect(area.entry.z).toBeGreaterThan(bounds.maxZ - .6);
    for (const obstacle of area.obstacles) expect(Math.hypot(area.entry.x - obstacle.x, area.entry.z - obstacle.z)).toBeGreaterThanOrEqual(obstacle.radius + .22);

    const box = new THREE.Box3().setFromObject(area.group).translate(ORIGIN.clone().negate());
    expect(box.min.x).toBeGreaterThanOrEqual(-7); expect(box.max.x).toBeLessThanOrEqual(7);
    expect(box.min.y).toBeGreaterThanOrEqual(-3); expect(box.max.y).toBeLessThanOrEqual(7);
    expect(box.min.z).toBeGreaterThanOrEqual(-4.5); expect(box.max.z).toBeLessThanOrEqual(4.5);
    expect(bounds.minX).toBeGreaterThan(box.min.x); expect(bounds.maxX).toBeLessThan(box.max.x);
    expect(bounds.minZ).toBeGreaterThan(box.min.z); expect(bounds.maxZ).toBeLessThan(box.max.z);

    // Cheap enough to sit beside six other lots: few draw calls, modest triangles.
    let meshes = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    });
    expect(meshes).toBeLessThanOrEqual(80); expect(triangles).toBeLessThanOrEqual(40_000);
    area.dispose();
  });

  it('runs the career timeline left to right from the oldest job, every stop on one walkable line', () => {
    const area = build();
    const stops = area.stations.filter((station) => station.id.startsWith('career:')).sort((a, b) => a.stand.x - b.stand.x);
    const jobs = [...CONTENT.career].sort((a, b) => startYear(a.period) - startYear(b.period));
    expect(stops.map((station) => station.present?.url)).toEqual(jobs.map((job) => job.url));
    for (const stop of stops) expect(stop.stand.z).toBeCloseTo(stops[0].stand.z, 2);
    for (const [index, stop] of stops.entries()) if (index) expect(stop.stand.x - stops[index - 1].stand.x).toBeGreaterThan(1.5);
    area.dispose();
  });

  it('lets the visitor click every station from the camera, never hides one behind another, and keeps it in view while he stands at it', () => {
    const area = build(), from = eye(area);
    const hits = new Map<string, THREE.Vector3[]>(), covered = new Map<string, number>();
    let empty = 0;
    for (let x = -7; x <= 7; x += .25) {
      for (let y = -.6; y <= 6.6; y += .25) {
        const raycaster = fromCamera(area, x, y), id = area.pick(raycaster);
        if (!id) { empty++; continue; }
        hits.set(id, [...hits.get(id) ?? [], firstHit(area, raycaster)!.point.sub(ORIGIN)]);
        const hidden = behind(area, raycaster, id);
        if (hidden) covered.set(hidden, (covered.get(hidden) ?? 0) + 1);
      }
    }
    expect(empty).toBeGreaterThan(0);
    for (const station of area.stations) {
      const points = hits.get(station.id) ?? [];
      expect(points.length, station.id).toBeGreaterThanOrEqual(4);
      expect((covered.get(station.id) ?? 0) / (points.length + (covered.get(station.id) ?? 0)), `${station.id} behind another station`).toBeLessThan(.1);
      const seen = points.filter((point) => !blocked(point, station.stand, from)).length / points.length;
      expect(seen, station.id).toBeGreaterThanOrEqual(.6);
      // Where he walks in, his afro hides no station.
      expect(points.filter((point) => blocked(point, area.entry, from)).length / points.length, `${station.id} from the entry`).toBeLessThan(.25);
    }
    // Floor, walls and decor pick nothing.
    expect(area.pick(ray([area.entry.x, 4, area.entry.z], [area.entry.x, -1, area.entry.z]))).toBeNull();
    expect(area.pick(ray([0, 4, -1], [0, -1, -1]))).toBeNull();
    expect(area.pick(ray([-6.5, 2, 2], [6.5, 2, 2]))).toBeNull();
    area.dispose();
  }, 60_000);

  it('presents career stops and fun facts in sourced lines, with a Visit sign for each company', () => {
    const area = build(ODD);
    const byId = new Map(area.stations.map((station) => [station.id, station]));
    // The portrait keeps his own admire routine and its line instead of a presentation.
    expect(byId.get('portrait')!.present).toBeUndefined();
    const presented = area.stations.filter((station) => station.present);
    expect(presented.map((station) => station.id).sort()).toEqual([...byId.keys()].filter((id) => id !== 'portrait').sort());
    for (const { id, present } of presented) {
      expect(present!.lines.length, id).toBeGreaterThan(0);
      for (const line of present!.lines) {
        expect(line.line.length, id).toBeGreaterThan(0);
        expect(line.source, id).toMatch(/^content\/about-me\/.+\.md$/);
        expect(existsSync(resolve(process.cwd(), line.source!)), line.source).toBe(true);
      }
    }
    for (const job of ODD.career) {
      const stop = presented.find((station) => station.id.startsWith('career:') && station.present!.lines[0].line.includes(job.role))!;
      expect(stop, job.company).toBeDefined();
      expect(stop.present!.lines.every((line) => line.source === 'content/about-me/career.md')).toBe(true);
      expect(stop.present!.lines).toHaveLength(1 + Math.min(2, job.highlights.length));
      if (job.url) { expect(stop.present!.url).toBe(job.url); expect(stop.present!.linkLabel).toMatch(/^Visit /); } else expect(stop.present!.url).toBeUndefined();
    }
    const facts = presented.filter((station) => station.id.startsWith('fact:'));
    expect(facts).toHaveLength(ODD.funFacts.length);
    for (const fact of facts) {
      expect(fact.present!.lines.every((line) => line.source === 'content/about-me/fun-facts.md')).toBe(true);
      expect(fact.present!.url).toBeUndefined();
    }
    expect(byId.get('skyline')!.present!.lines.every((line) => line.source === 'content/about-me/bio.md')).toBe(true);
    area.dispose();
  });

  it('loads the portrait and each same-origin company logo once, and no remote logos', () => {
    build(ODD).dispose();
    expect(loads.map((load) => load.url).sort()).toEqual(['/hero.png', '/logos/bowiq.png', '/logos/merchantspring.svg', '/logos/supa.png']);
    loads = [];
    build(BARE).dispose();
    expect(loads.map((load) => load.url)).toEqual(['/hero.png']);
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
    expect(area.pick(fromCamera(area, 0, 3.1))).toBe('portrait');
    area.dispose();
  });

  it('tilts the frame crooked while he admires it, then it swings back straight', () => {
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

  it('runs each station\'s machine while he presents there, on top of the ambient life', () => {
    const quiet = build(), busy = build();
    for (const { id } of quiet.stations) {
      for (let frame = 1; frame <= 75; frame++) {
        const elapsed = 10 + frame / 30;
        quiet.update(1 / 30, elapsed, { stationId: null, progress: 0 });
        busy.update(1 / 30, elapsed, { stationId: id, progress: frame / 100 });
      }
      const before = look(quiet), after = look(busy);
      expect(after).toHaveLength(before.length);
      expect(Math.max(...after.map((value, index) => Math.abs(value - before[index]))), id).toBeGreaterThan(.05);
      // Back to rest before the next station.
      for (let frame = 1; frame <= 150; frame++) {
        const elapsed = 20 + frame / 30;
        quiet.update(1 / 30, elapsed, { stationId: null, progress: 0 });
        busy.update(1 / 30, elapsed, { stationId: null, progress: 0 });
      }
      const rested = look(busy), calm = look(quiet);
      expect(Math.max(...rested.map((value, index) => Math.abs(value - calm[index]))), `${id} settles`).toBeLessThan(.02);
    }
    // Ambient life moves with no one at a station.
    const still = look(quiet);
    quiet.update(1 / 30, 40, { stationId: null, progress: 0 });
    expect(Math.max(...look(quiet).map((value, index) => Math.abs(value - still[index])))).toBeGreaterThan(.005);
    quiet.dispose(); busy.dispose();
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
    const hero = loads.find((load) => load.url === '/hero.png')!;
    const logos = loads.filter((load) => load !== hero);
    expect(logos).toHaveLength(3);
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
